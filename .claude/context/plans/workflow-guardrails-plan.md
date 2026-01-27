# Workflow Guardrails Plan

## Problem Analysis

### Issues That Occurred

1. **Wrong Directory** - Agents created in `C:\dev\projects\.claude\` instead of `agent-studio\.claude\`
2. **Orphaned Skills** - 70% of skills weren't assigned to any agent
3. **Empty Skills** - Skills created with minimal/placeholder content
4. **Routing Table Not Updated** - New agents weren't added to CLAUDE.md
5. **Validation Not Run** - Errors weren't caught before completion

### Root Causes

1. **No Directory Enforcement** - Subagents inherit CWD but aren't told the correct project path
2. **Manual Checklists** - System Impact Analysis exists but isn't automated
3. **No Content Validation** - Skills can be "created" with 3 lines of content
4. **No Orphan Detection** - No way to know if a skill is actually usable

---

## Proposed Solutions

### 1. Project Directory Enforcement (CRITICAL)

**Problem:** Subagents don't know which project they're working in.

**Solution:** Add mandatory `PROJECT_ROOT` to all spawn prompts.

```javascript
// In CLAUDE.md and router.md spawn examples
Task({
  subagent_type: 'general-purpose',
  description: 'Developer fixing bug',
  prompt: `You are the DEVELOPER agent.

## PROJECT CONTEXT (CRITICAL)
PROJECT_ROOT: C:/dev/projects/agent-studio
All file operations MUST be relative to this path.
- Agents: ${PROJECT_ROOT}/.claude/agents/
- Skills: ${PROJECT_ROOT}/.claude/skills/
- DO NOT create files outside PROJECT_ROOT

## Your Task
...`,
});
```

**Implementation:**

- [ ] Update CLAUDE.md spawn examples with PROJECT_ROOT
- [ ] Update router.md spawn examples
- [ ] Update agent-creator to include PROJECT_ROOT in generated spawn commands
- [ ] Add validation in create-agent.mjs to verify output path

### 2. Automated Pre-Creation Validation

**Problem:** Validation only runs after creation, not during.

**Solution:** Add pre-creation checks to create.cjs and create-agent.mjs.

```javascript
// In create-agent.mjs
async function preValidation(options) {
  const errors = [];

  // 1. Verify working directory is correct project
  if (!fs.existsSync('.claude/CLAUDE.md')) {
    errors.push('ERROR: Not in a Claude Code project. Missing .claude/CLAUDE.md');
  }

  // 2. Verify all skills exist before assigning
  for (const skill of options.skills || []) {
    if (!fs.existsSync(`.claude/skills/${skill}/SKILL.md`)) {
      errors.push(`ERROR: Skill "${skill}" does not exist`);
    }
  }

  // 3. Check for duplicate agent name
  if (glob.sync(`.claude/agents/**/${options.name}.md`).length > 0) {
    errors.push(`ERROR: Agent "${options.name}" already exists`);
  }

  if (errors.length > 0) {
    console.error('Pre-creation validation failed:');
    errors.forEach(e => console.error(`  ${e}`));
    process.exit(1);
  }
}
```

**Implementation:**

- [ ] Add preValidation() to create-agent.mjs
- [ ] Add preValidation() to skill-creator/scripts/create.cjs
- [ ] Fail fast on validation errors

### 3. Skill Content Minimum Requirements

**Problem:** Skills created with 3 lines of content.

**Solution:** Enforce minimum content standards.

```javascript
// In create.cjs and validate-all.cjs
const MINIMUM_REQUIREMENTS = {
  totalLines: 50, // At least 50 lines
  hasSection: {
    Purpose: true,
    Usage: true,
    Examples: true,
    'Memory Protocol': true,
  },
  descriptionLength: 50, // At least 50 chars
};

function validateContent(skillPath) {
  const content = fs.readFileSync(skillPath, 'utf-8');
  const lines = content.split('\n').length;

  if (lines < MINIMUM_REQUIREMENTS.totalLines) {
    return {
      valid: false,
      error: `Skill has only ${lines} lines (minimum: ${MINIMUM_REQUIREMENTS.totalLines})`,
    };
  }

  for (const [section, required] of Object.entries(MINIMUM_REQUIREMENTS.hasSection)) {
    if (required && !content.includes(`## ${section}`)) {
      return {
        valid: false,
        error: `Missing required section: ## ${section}`,
      };
    }
  }

  return { valid: true };
}
```

**Implementation:**

- [ ] Add content validation to create.cjs
- [ ] Add content check to validate-all.cjs
- [ ] Fail creation if content is too minimal
- [ ] Require research (WebSearch) before creating skills

### 4. Automated Orphan Detection

**Problem:** No way to know if skills are actually assigned to agents.

**Solution:** Add orphan-detector script.

```javascript
// .claude/tools/detect-orphans.mjs
async function detectOrphans() {
  const skills = glob.sync('.claude/skills/*/SKILL.md');
  const agents = glob.sync('.claude/agents/**/*.md');

  const assignedSkills = new Set();
  for (const agentPath of agents) {
    const content = fs.readFileSync(agentPath, 'utf-8');
    const frontmatter = yaml.parse(content.split('---')[1]);
    (frontmatter.skills || []).forEach(s => assignedSkills.add(s));
  }

  const orphans = [];
  for (const skillPath of skills) {
    const skillName = path.basename(path.dirname(skillPath));
    if (!assignedSkills.has(skillName)) {
      orphans.push(skillName);
    }
  }

  if (orphans.length > 0) {
    console.error(`WARNING: ${orphans.length} orphaned skills found:`);
    orphans.forEach(s => console.error(`  - ${s}`));
    return 1;
  }

  console.log('✅ All skills are assigned to at least one agent');
  return 0;
}
```

**Implementation:**

- [ ] Create detect-orphans.mjs
- [ ] Add to validation suite
- [ ] Run after skill/agent creation
- [ ] Block creation if it would create an orphan

### 5. Automated Routing Table Updates

**Problem:** Routing table requires manual updates that are forgotten.

**Solution:** Auto-update CLAUDE.md when creating agents.

```javascript
// In create-agent.mjs
async function updateRoutingTable(agentConfig) {
  const claudeMd = fs.readFileSync('.claude/CLAUDE.md', 'utf-8');

  // Find routing table section
  const tableStart = claudeMd.indexOf('## 3. AGENT ROUTING TABLE');
  const tableEnd = claudeMd.indexOf('| **No match**');

  // Build new row
  const newRow = `| ${agentConfig.requestType} | \`${agentConfig.name}\` | \`.claude/agents/${agentConfig.category}/${agentConfig.name}.md\` |`;

  // Insert before "No match" row
  const updated = claudeMd.slice(0, tableEnd) + newRow + '\n' + claudeMd.slice(tableEnd);

  fs.writeFileSync('.claude/CLAUDE.md', updated);
  console.log(`✅ Added to CLAUDE.md routing table: ${agentConfig.name}`);
}
```

**Implementation:**

- [ ] Add updateRoutingTable() to create-agent.mjs
- [ ] Prompt user for "request type" description
- [ ] Auto-insert row in correct position
- [ ] Verify insertion with grep after update

### 6. Post-Creation Verification Gate

**Problem:** Creation succeeds even when incomplete.

**Solution:** Add mandatory verification step before completion.

```javascript
// In create-agent.mjs and create.cjs
async function verifyCreation(type, name) {
  const checks = [];

  if (type === 'agent') {
    // Agent-specific checks
    checks.push({
      name: 'Agent file exists',
      fn: () => glob.sync(`.claude/agents/**/${name}.md`).length > 0,
    });
    checks.push({
      name: 'In routing table',
      fn: () => fs.readFileSync('.claude/CLAUDE.md', 'utf-8').includes(name),
    });
    checks.push({
      name: 'Has verification-before-completion',
      fn: () => {
        const content = fs.readFileSync(glob.sync(`.claude/agents/**/${name}.md`)[0], 'utf-8');
        return content.includes('verification-before-completion');
      },
    });
  } else if (type === 'skill') {
    // Skill-specific checks
    checks.push({
      name: 'Skill file exists',
      fn: () => fs.existsSync(`.claude/skills/${name}/SKILL.md`),
    });
    checks.push({
      name: 'Assigned to agent',
      fn: () => {
        const agents = glob.sync('.claude/agents/**/*.md');
        return agents.some(a => fs.readFileSync(a, 'utf-8').includes(name));
      },
    });
    checks.push({
      name: 'Content is comprehensive',
      fn: () => {
        const content = fs.readFileSync(`.claude/skills/${name}/SKILL.md`, 'utf-8');
        return content.split('\n').length >= 50;
      },
    });
  }

  console.log('\n📋 Verification Checklist:');
  let allPassed = true;
  for (const check of checks) {
    const passed = check.fn();
    console.log(`  ${passed ? '✅' : '❌'} ${check.name}`);
    if (!passed) allPassed = false;
  }

  if (!allPassed) {
    console.error('\n❌ Verification failed. Fix issues before proceeding.');
    process.exit(1);
  }

  console.log('\n✅ All verification checks passed!');
}
```

### 7. Git Pre-Commit Hook

**Problem:** Invalid agents/skills can be committed.

**Solution:** Add pre-commit validation.

```bash
#!/bin/bash
# .claude/hooks/pre-commit-validate.sh

echo "🔍 Running pre-commit validation..."

# Check for staged agent/skill files
STAGED_AGENTS=$(git diff --cached --name-only | grep "\.claude/agents/.*\.md$")
STAGED_SKILLS=$(git diff --cached --name-only | grep "\.claude/skills/.*/SKILL\.md$")

if [ -n "$STAGED_AGENTS" ] || [ -n "$STAGED_SKILLS" ]; then
  echo "Found staged agent/skill changes. Running validation..."

  # Run agent validation
  node .claude/tools/validate-agents.mjs
  if [ $? -ne 0 ]; then
    echo "❌ Agent validation failed. Fix errors before committing."
    exit 1
  fi

  # Run skill validation
  node .claude/skills/skill-creator/scripts/validate-all.cjs
  if [ $? -ne 0 ]; then
    echo "❌ Skill validation failed. Fix errors before committing."
    exit 1
  fi

  # Run orphan detection
  node .claude/tools/detect-orphans.mjs
  if [ $? -ne 0 ]; then
    echo "⚠️ Orphaned skills detected. Consider assigning them to agents."
  fi
fi

echo "✅ Pre-commit validation passed!"
exit 0
```

---

## Implementation Priority

### Phase 1: Critical (Implement Immediately)

1. ✅ PROJECT_ROOT in spawn prompts (CLAUDE.md updated)
2. ✅ Pre-creation validation (create-agent.mjs, create.cjs)
3. ✅ Skill content minimum requirements (create.cjs)

### Phase 2: High (Implement This Week)

4. ✅ Orphan detection script (detect-orphans.mjs created)
5. ✅ Automated routing table updates (create-agent.mjs)
6. ✅ Post-creation verification gate (create-agent.mjs, create.cjs)

### Phase 3: Medium (Implement This Month)

7. ⬜ Git pre-commit hook
8. ⬜ CI/CD validation pipeline
9. ⬜ Dashboard showing orphan count

---

## Updated Iron Laws

Add these to agent-creator and skill-creator:

```
## Enhanced Iron Laws

8. NO CREATION WITHOUT PROJECT_ROOT
   - Every spawn prompt MUST include PROJECT_ROOT path
   - All file paths MUST be absolute or relative to PROJECT_ROOT
   - Verify output path before writing

9. NO SKILL WITH LESS THAN 50 LINES
   - Skills must have comprehensive content
   - Minimum sections: Purpose, Usage, Examples, Memory Protocol
   - Use WebSearch to research before creating

10. VERIFICATION GATE BEFORE COMPLETION
    - Run full validation after creation
    - Check routing table entry
    - Check agent assignment
    - Do not mark complete until all checks pass

11. ORPHAN DETECTION MANDATORY
    - Run detect-orphans.mjs after skill creation
    - Fix any orphans before proceeding
    - Skills without agents are useless
```

---

## Summary

The existing workflows have good documentation but lack enforcement. The key additions are:

1. **PROJECT_ROOT enforcement** - Prevents wrong-directory errors
2. **Pre-creation validation** - Catches issues before they happen
3. **Content minimums** - Prevents empty/placeholder skills
4. **Orphan detection** - Ensures skills are actually usable
5. **Auto-routing** - Removes manual step that gets forgotten
6. **Verification gate** - Blocks incomplete work
7. **Pre-commit hook** - Last line of defense

With these guardrails, the issues we encountered would have been caught:

- Wrong directory → PROJECT_ROOT check fails
- Empty skills → Content minimum check fails
- Orphaned skills → Orphan detection warns/fails
- Missing routing → Auto-routing adds entry
- Incomplete work → Verification gate blocks
