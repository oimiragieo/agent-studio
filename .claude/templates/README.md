# Templates Directory

Standardized templates for creating new agents, skills, and workflows in the multi-agent orchestration framework.

## Template Types

### Agent Templates (`agents/`)

Use when creating new specialized agents.

**File:** `agents/agent-template.md`

**Usage:**
1. Copy template to `.claude/agents/<category>/<agent-name>.md`
2. Replace all `{{PLACEHOLDER}}` values
3. Add agent to CLAUDE.md routing table (Section 3)
4. Update learnings.md with integration summary

**Categories:**
- `core/` - Essential agents (planner, developer, architect, qa)
- `specialized/` - Domain-specific experts (security, devops, database)
- `domain/` - Language/framework specialists (python-pro, nextjs-pro)
- `orchestrators/` - Multi-agent coordinators

### Skill Templates (`skills/`)

Use when creating new reusable skills.

**File:** `skills/skill-template.md`

**Usage:**
1. Create directory `.claude/skills/<skill-name>/`
2. Copy template to `SKILL.md` in that directory
3. Replace all `{{PLACEHOLDER}}` values
4. Add to CLAUDE.md Section 8.5 if user-invocable
5. Assign to agents via their `skills:` frontmatter array

**Skill Types:**
- **User-invocable** (`user_invocable: true`): Can be invoked with `Skill({ skill: "name" })`
- **Agent-only** (`user_invocable: false`): Only available to agents with the skill assigned

### Workflow Templates (`workflows/`)

Use when creating multi-agent orchestration patterns.

**File:** `workflows/workflow-template.md`

**Usage:**
1. Copy template to `.claude/workflows/<category>/<workflow-name>.md`
2. Replace all `{{PLACEHOLDER}}` values
3. Add to CLAUDE.md Section 3 "Multi-Agent Workflows"
4. Document trigger conditions

**Categories:**
- `enterprise/` - Complex multi-phase workflows
- `operations/` - Operational workflows (incident response, deployment)
- Root level - Simpler single-purpose workflows

### Code Style Templates (`code-styles/`)

Language-specific coding style guidelines.

**Available:**
- `python.md` - Python style guidelines
- `typescript.md` - TypeScript style guidelines
- `javascript.md` - JavaScript style guidelines
- `go.md` - Go style guidelines
- `dart.md` - Dart style guidelines
- `csharp.md` - C# style guidelines
- `html-css.md` - HTML/CSS style guidelines
- `general.md` - General coding principles

### Hook Templates (`hooks/`) - Future

Templates for pre/post execution hooks.

**Usage:**
1. Create directory `.claude/templates/hooks/` if not exists
2. Use `template-creator` skill to generate hook templates
3. Copy to `.claude/hooks/` for implementation

### Code Pattern Templates (`code/`) - Future

Language-specific code scaffolding patterns.

**Usage:**
1. Create directory `.claude/templates/code/` if not exists
2. Use `template-creator` skill to generate code patterns
3. Copy patterns when scaffolding new code

### Schema Templates (`schemas/`) - Future

JSON/YAML schema templates for validation.

**Usage:**
1. Create directory `.claude/templates/schemas/` if not exists
2. Use `template-creator` skill to generate schema templates
3. Copy to `.claude/schemas/` for validation

## Template Creator Skill

Use the `template-creator` skill to create new templates:

```javascript
Skill({ skill: 'template-creator' });
```

The skill ensures:
- Consistent placeholder format (`{{UPPER_CASE}}`)
- Required sections (POST-CREATION CHECKLIST, Memory Protocol)
- Documentation for all placeholders
- README updates

## Critical Reminders

### ROUTER UPDATE REQUIRED

After creating ANY agent, skill, or workflow:

1. **Update CLAUDE.md** - Add to routing table, skills section, or workflows section
2. **Update learnings.md** - Record the integration
3. **Verify with grep** - Ensure your new artifact is discoverable

```bash
# Verify agent is in routing table
grep "<agent-name>" .claude/CLAUDE.md

# Verify skill is documented
grep "<skill-name>" .claude/CLAUDE.md

# Verify workflow is documented
grep "<workflow-file>" .claude/CLAUDE.md
```

**WHY:** Artifacts not in CLAUDE.md are invisible to the Router and will never be used.

### Memory Protocol

All templates include memory protocol sections. Ensure agents:
1. Read `learnings.md` before starting
2. Record decisions to `decisions.md`
3. Document issues in `issues.md`

### Context Files

All agent templates include:
```yaml
context_files:
  - .claude/context/memory/learnings.md
```

This ensures agents automatically load institutional memory.

## Quick Reference

| Creating | Template | CLAUDE.md Section | Output Path |
|----------|----------|-------------------|-------------|
| Agent | `agents/agent-template.md` | Section 3 (Routing Table) | `.claude/agents/<category>/` |
| Skill | `skills/skill-template.md` | Section 8.5 (Skills) | `.claude/skills/<name>/SKILL.md` |
| Workflow | `workflows/workflow-template.md` | Section 3 (Workflows) | `.claude/workflows/<category>/` |
| Hook | `hooks/<hook-type>.md` | N/A | `.claude/hooks/<category>/` |
| Code Pattern | `code/<language>-<pattern>.md` | N/A | Project source |
| Schema | `schemas/<schema-type>.md` | N/A | `.claude/schemas/` |

## Creator Skills

| Need | Skill | Invocation |
|------|-------|------------|
| New agent | `agent-creator` | `Skill({ skill: 'agent-creator' })` |
| New skill | `skill-creator` | `Skill({ skill: 'skill-creator' })` |
| New template | `template-creator` | `Skill({ skill: 'template-creator' })` |
