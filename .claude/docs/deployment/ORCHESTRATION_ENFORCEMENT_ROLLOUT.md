# Orchestration Enforcement Rollout Plan

## Overview

This document outlines the phased deployment strategy for the orchestration enforcement system, which ensures orchestrators delegate work to specialized agents instead of performing work directly.

**Key Components**:
- Task classification system (task-classifier.mjs)
- Impact analysis agent (impact-analyzer.md)
- Code simplification agent (code-simplifier.md)
- Response rating enforcement (response-rater skill)
- Workflow review gates
- Orchestrator behavioral constraints

**Rollout Strategy**: 4 phases with increasing risk, each fully testable and reversible

---

## Pre-Deployment Checklist

Before starting any phase:

- [ ] All tests passing: `node .claude/tools/task-classifier.test.mjs`
- [ ] Git working directory clean or changes committed
- [ ] Backup of current `.claude/CLAUDE.md` and `.claude/config.yaml`
- [ ] Team notified of upcoming changes
- [ ] Rollback procedures reviewed and understood
- [ ] Validation commands tested in non-production environment

---

## Phase 1: Foundation (LOW RISK)

**Purpose**: Deploy infrastructure without changing behavior

### Files Included

**Tools** (7 files):
- `.claude/tools/task-classifier.mjs` - Task complexity classifier
- `.claude/tools/task-classifier.test.mjs` - Unit tests
- `.claude/tools/task-classifier.test.md` - Test documentation
- `.claude/tools/task-classifier-optimizations.md` - Performance notes

**Agents** (2 files):
- `.claude/agents/impact-analyzer.md` - Impact analysis agent
- `.claude/agents/code-simplifier.md` - Code simplification agent

**Schemas** (2 files):
- `.claude/schemas/impact_analysis.schema.json` - Impact analysis validation
- `.claude/schemas/simplification-report.schema.json` - Simplification validation

**Documentation** (1 file):
- `.claude/docs/cujs/CUJ-051.md` - Critical User Journey for artifact publishing

### Deployment Steps

```bash
# 1. Create feature branch
git checkout -b feat/orchestration-enforcement-phase1

# 2. Add foundation files
git add .claude/tools/task-classifier.mjs
git add .claude/tools/task-classifier.test.mjs
git add .claude/tools/task-classifier.test.md
git add .claude/tools/task-classifier-optimizations.md
git add .claude/agents/impact-analyzer.md
git add .claude/agents/code-simplifier.md
git add .claude/schemas/impact_analysis.schema.json
git add .claude/schemas/simplification-report.schema.json
git add .claude/docs/cujs/CUJ-051.md

# 3. Commit
git commit -m "feat: Add orchestration enforcement foundation (Phase 1)

- Add task-classifier.mjs for complexity analysis
- Add impact-analyzer agent for change impact analysis
- Add code-simplifier agent for complexity reduction
- Add validation schemas for new outputs
- Add CUJ-051 for artifact publishing validation

BREAKING CHANGE: None (infrastructure only, no behavior changes)
"

# 4. Push and create PR
git push origin feat/orchestration-enforcement-phase1
```

### Validation Commands

```bash
# Run unit tests
node .claude/tools/task-classifier.test.mjs

# Test task classification
node .claude/tools/task-classifier.mjs --task "Fix typo in README"
node .claude/tools/task-classifier.mjs --task "Refactor all API endpoints"

# Validate schema files
node -e "require('./.claude/schemas/impact_analysis.schema.json')"
node -e "require('./.claude/schemas/simplification-report.schema.json')"

# Check agent files load correctly
cat .claude/agents/impact-analyzer.md | head -20
cat .claude/agents/code-simplifier.md | head -20
```

### Success Criteria

- [ ] All tests pass (task-classifier.test.mjs)
- [ ] Schema files are valid JSON
- [ ] Agent markdown files have valid frontmatter
- [ ] No runtime errors when loading new files
- [ ] Existing workflows still work (no regressions)

### Rollback Procedure

```bash
# Revert the commit
git revert HEAD

# Or reset to previous commit
git reset --hard HEAD~1

# Force push if already deployed
git push origin main --force-with-lease
```

---

## Phase 2: Workflow Integration (MEDIUM RISK)

**Purpose**: Add review steps to workflows (gates in place but not enforced)

### Files Included

**Workflows** (11 files):
- `.claude/workflows/ai-system-flow.yaml` - Add impact-analyzer and code-simplifier steps
- `.claude/workflows/bmad-greenfield-standard.yaml` - Add review gates
- `.claude/workflows/brownfield-fullstack.yaml` - Add review gates
- `.claude/workflows/code-quality-flow.yaml` - Add review gates
- `.claude/workflows/enterprise-track.yaml` - Add review gates
- `.claude/workflows/greenfield-fullstack.yaml` - Add review gates
- `.claude/workflows/incident-flow.yaml` - Add review gates
- `.claude/workflows/mobile-flow.yaml` - Add review gates
- `.claude/workflows/performance-flow.yaml` - Add review gates
- `.claude/workflows/quick-flow.yaml` - Add review gates
- `.claude/workflows/ui-perfection-loop.yaml` - Add review gates

**Config** (1 file):
- `.claude/config.yaml` - Add impact-analyzer and code-simplifier to agents map

### Deployment Steps

```bash
# 1. Create feature branch (or continue from Phase 1)
git checkout -b feat/orchestration-enforcement-phase2

# 2. Add workflow files
git add .claude/workflows/*.yaml
git add .claude/config.yaml

# 3. Commit
git commit -m "feat: Add review gates to workflows (Phase 2)

- Add impact-analyzer steps to complex workflows
- Add code-simplifier steps to code quality workflows
- Add review gates before deployment steps
- Register new agents in config.yaml

BREAKING CHANGE: None (gates added but not enforced)
"

# 4. Push and create PR
git push origin feat/orchestration-enforcement-phase2
```

### Validation Commands

```bash
# Validate workflow YAML syntax
for f in .claude/workflows/*.yaml; do
  node -e "require('js-yaml').load(require('fs').readFileSync('$f', 'utf8'))"
done

# Check workflow schema compliance
node .claude/tools/workflow_runner.js --workflow .claude/workflows/code-quality-flow.yaml --validate

# Verify config.yaml is valid
node -e "require('js-yaml').load(require('fs').readFileSync('.claude/config.yaml', 'utf8'))"

# Test workflow step execution (dry run)
node .claude/tools/workflow_runner.js --workflow .claude/workflows/code-quality-flow.yaml --step 1 --id test-001 --dry-run
```

### Success Criteria

- [ ] All workflow YAML files have valid syntax
- [ ] config.yaml loads without errors
- [ ] New agents (impact-analyzer, code-simplifier) registered in config
- [ ] Workflow runner validates all updated workflows
- [ ] Existing workflow executions still work (backward compatible)

### Rollback Procedure

```bash
# Restore previous workflow files from git history
git checkout HEAD~1 -- .claude/workflows/
git checkout HEAD~1 -- .claude/config.yaml

# Commit rollback
git commit -m "revert: Rollback workflow integration (Phase 2)"
git push origin main
```

---

## Phase 3: Enforcement Activation (HIGH RISK)

**Purpose**: Enable orchestrator constraints and plan rating requirements

### Files Included

**Core Config** (1 file):
- `.claude/CLAUDE.md` - Add orchestration enforcement rules at top of file

**Agent Updates** (2 files):
- `.claude/agents/orchestrator.md` - Add enforcement reminders
- `.claude/agents/model-orchestrator.md` - Add enforcement reminders (if modified)

### Deployment Steps

```bash
# 1. Create feature branch
git checkout -b feat/orchestration-enforcement-phase3

# 2. Add CRITICAL section to CLAUDE.md (prepend to file)
# This is already done in your working copy

# 3. Update orchestrator agents
git add .claude/CLAUDE.md
git add .claude/agents/orchestrator.md
git add .claude/agents/model-orchestrator.md  # if modified

# 4. Commit
git commit -m "feat: Activate orchestration enforcement (Phase 3)

- Add CRITICAL orchestration enforcement rules to CLAUDE.md
- Enforce delegation pattern for orchestrators
- Require plan rating (min 7/10) before execution
- Add 3-file rule and analysis rule
- Add enforcement violations detection

BREAKING CHANGE: Orchestrators must now delegate instead of doing work directly
"

# 5. Push and create PR (REQUIRES APPROVAL)
git push origin feat/orchestration-enforcement-phase3
```

### Validation Commands

```bash
# Test orchestrator delegation (should spawn subagent)
# This requires Claude Code or manual testing

# Validate CLAUDE.md syntax
grep -q "ORCHESTRATION ENFORCEMENT" .claude/CLAUDE.md && echo "✓ Enforcement section present"

# Check for critical markers
grep -q "NON-NEGOTIABLE" .claude/CLAUDE.md && echo "✓ Critical markers present"

# Validate agent frontmatter
node -e "
const fs = require('fs');
const yaml = require('js-yaml');
const content = fs.readFileSync('.claude/agents/orchestrator.md', 'utf8');
const match = content.match(/^---\n([\s\S]*?)\n---/);
if (match) yaml.load(match[1]);
console.log('✓ Orchestrator agent frontmatter valid');
"
```

### Testing Protocol

**Manual Testing Required**:

1. **Test Orchestrator Delegation**:
   - Prompt: "Review all skills and fix issues"
   - Expected: Orchestrator spawns developer/qa subagents
   - Failure: Orchestrator reads files directly

2. **Test Plan Rating**:
   - Prompt: "Build a new feature with authentication"
   - Expected: Planner creates plan → Orchestrator rates it → Execution if ≥7/10
   - Failure: Plan executed without rating

3. **Test 3-File Rule**:
   - Prompt: "Analyze these 5 files for patterns"
   - Expected: Orchestrator spawns analyst subagent
   - Failure: Orchestrator reads all 5 files directly

4. **Test Violation Detection**:
   - Check orchestrator stops itself when about to violate rules
   - Expected: Self-correction or delegation
   - Failure: Continues with violation

### Success Criteria

- [ ] Orchestrator delegates multi-file tasks to subagents
- [ ] Plans are rated before execution (min 7/10)
- [ ] 3-file rule enforced (orchestrator stops at 2 files)
- [ ] Analysis tasks delegated to analyst/architect
- [ ] Implementation tasks delegated to developer
- [ ] No regressions in existing workflows

### Rollback Procedure

**CRITICAL: This is a behavioral change - rollback immediately if issues occur**

```bash
# Emergency rollback: Remove enforcement section from CLAUDE.md
git checkout HEAD~1 -- .claude/CLAUDE.md
git checkout HEAD~1 -- .claude/agents/orchestrator.md
git checkout HEAD~1 -- .claude/agents/model-orchestrator.md

# Commit rollback
git commit -m "revert: Emergency rollback orchestration enforcement (Phase 3)"
git push origin main --force-with-lease

# Notify team
echo "⚠️ ORCHESTRATION ENFORCEMENT ROLLED BACK - Phase 3 reverted"
```

---

## Phase 4: Documentation (NO RISK)

**Purpose**: Update all documentation to reflect new enforcement rules

### Files Included

**Documentation** (estimated 5-10 files):
- `.claude/docs/ORCHESTRATION_PATTERNS.md` - Update with enforcement examples
- `.claude/workflows/WORKFLOW-GUIDE.md` - Add review gate documentation
- `.claude/docs/ADVANCED_TOOL_USE.md` - Update delegation patterns
- `.claude/docs/setup-guides/CLAUDE_SETUP_GUIDE.md` - Add enforcement validation
- Other relevant docs as needed

### Deployment Steps

```bash
# 1. Create feature branch
git checkout -b feat/orchestration-enforcement-phase4

# 2. Update documentation files
git add .claude/docs/*.md
git add .claude/workflows/WORKFLOW-GUIDE.md

# 3. Commit
git commit -m "docs: Update documentation for orchestration enforcement (Phase 4)

- Add enforcement examples to ORCHESTRATION_PATTERNS.md
- Document review gates in WORKFLOW-GUIDE.md
- Update delegation patterns in ADVANCED_TOOL_USE.md
- Add enforcement validation to setup guide

BREAKING CHANGE: None (documentation only)
"

# 4. Push and create PR
git push origin feat/orchestration-enforcement-phase4
```

### Validation Commands

```bash
# Check for broken links
grep -r "\.md)" .claude/docs/ | grep -v ".git" | while read line; do
  # Extract markdown links and verify files exist
  echo "$line" | grep -oP '\[.*?\]\(\K[^)]+' | while read link; do
    if [[ ! -f ".claude/docs/$link" && ! -f "$link" ]]; then
      echo "Broken link: $link in $line"
    fi
  done
done

# Validate markdown syntax
for f in .claude/docs/*.md .claude/workflows/*.md; do
  if [[ -f "$f" ]]; then
    node -e "const fs = require('fs'); fs.readFileSync('$f', 'utf8');" && echo "✓ $f"
  fi
done
```

### Success Criteria

- [ ] All documentation updated with enforcement examples
- [ ] No broken links in documentation
- [ ] Examples show correct delegation patterns
- [ ] Setup guide includes enforcement validation steps

### Rollback Procedure

Not critical (documentation only), but can revert if needed:

```bash
git checkout HEAD~1 -- .claude/docs/
git commit -m "revert: Rollback documentation updates (Phase 4)"
```

---

## Monitoring and Validation

### Post-Deployment Monitoring

After each phase, monitor:

1. **Workflow Success Rate**: Track workflow completion rates
2. **Agent Spawning**: Verify orchestrators are spawning subagents
3. **Plan Rating**: Confirm all plans rated before execution
4. **Error Logs**: Check for new errors or violations

### Key Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Workflow success rate | >95% | Count successful workflow completions |
| Plan rating compliance | 100% | All plans rated before execution |
| Orchestrator delegation | >90% | Orchestrators spawn subagents for complex tasks |
| 3-file rule compliance | 100% | Orchestrators never read 3+ files directly |

### Validation Queries

```bash
# Check recent workflow runs
ls -lt .claude/context/runs/ | head -10

# Check gate files for validation status
find .claude/context/runs/ -name "*.json" -type f | xargs grep -l '"valid": true'

# Check for plan ratings in artifacts
grep -r "plan_rating" .claude/context/runs/*/artifacts/ | head -5
```

---

## Emergency Procedures

### Critical Issues

If any of these occur, IMMEDIATELY rollback the current phase:

1. **Orchestrator Infinite Loop**: Orchestrator continuously spawns itself
2. **Plan Rating Deadlock**: Plans never reach 7/10, blocking all work
3. **3-File Rule Too Restrictive**: Legitimate 2-file tasks blocked
4. **Subagent Spawn Failures**: Task tool fails to spawn subagents
5. **Workflow Breakage**: Existing workflows fail with new changes

### Rollback Decision Matrix

| Severity | Impact | Action | Timeline |
|----------|--------|--------|----------|
| Critical | System unusable | Immediate rollback | <5 minutes |
| High | Major feature broken | Rollback within 1 hour | <1 hour |
| Medium | Minor regressions | Fix forward or rollback | <1 day |
| Low | Documentation issues | Fix forward | <1 week |

### Communication Protocol

1. **Before Deployment**: Notify team of upcoming changes
2. **During Deployment**: Announce each phase start
3. **After Deployment**: Report success/failure and metrics
4. **On Rollback**: Immediate notification with root cause

---

## Success Criteria (Overall)

The orchestration enforcement rollout is considered successful when:

- [ ] All 4 phases deployed without rollbacks
- [ ] Orchestrators delegate 90%+ of complex tasks
- [ ] All plans rated before execution (100% compliance)
- [ ] 3-file rule enforced (100% compliance)
- [ ] No increase in workflow failure rates
- [ ] Documentation complete and accurate
- [ ] Team trained on new enforcement rules

---

## Appendix: Quick Reference

### Phase Summary

| Phase | Risk | Files | Rollback Time | Validation |
|-------|------|-------|---------------|------------|
| 1: Foundation | LOW | 12 | <1 min | Unit tests |
| 2: Workflows | MEDIUM | 12 | <5 min | YAML validation |
| 3: Enforcement | HIGH | 3 | <5 min | Manual testing |
| 4: Documentation | NONE | 5-10 | <1 min | Link checking |

### Command Cheatsheet

```bash
# Test classifier
node .claude/tools/task-classifier.test.mjs

# Validate workflow
node .claude/tools/workflow_runner.js --workflow .claude/workflows/<name>.yaml --validate

# Check YAML syntax
node -e "require('js-yaml').load(require('fs').readFileSync('<file>.yaml', 'utf8'))"

# Rollback last commit
git revert HEAD

# Force rollback
git reset --hard HEAD~1 && git push origin main --force-with-lease
```

### Support Contacts

- **Technical Lead**: [Name]
- **DevOps**: [Name]
- **On-Call**: [Contact Info]

---

**Document Version**: 1.0
**Last Updated**: 2026-01-04
**Next Review**: After Phase 4 completion
