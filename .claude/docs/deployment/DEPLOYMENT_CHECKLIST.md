# Orchestration Enforcement - Deployment Checklist

## Pre-Deployment Checklist

Complete ALL items before starting Phase 1:

### Environment Preparation

- [ ] All tests passing: `node .claude/tools/task-classifier.test.mjs`
- [ ] Git working directory clean or committed
- [ ] Non-production environment available for testing
- [ ] Backup of current `.claude/CLAUDE.md` created
- [ ] Backup of current `.claude/config.yaml` created

### Team Preparation

- [ ] Team notified 48 hours in advance
- [ ] Rollout timeline shared with team
- [ ] On-call engineer assigned for rollout period
- [ ] Emergency escalation path confirmed
- [ ] Team training session scheduled (for Phase 3)

### Documentation Review

- [ ] `PHASE_SUMMARY.md` reviewed by tech lead
- [ ] `ORCHESTRATION_ENFORCEMENT_ROLLOUT.md` reviewed by DevOps
- [ ] `PR_DESCRIPTIONS.md` templates ready
- [ ] Rollback procedures tested in non-prod

### Monitoring Setup

- [ ] Monitoring dashboards created for key metrics
- [ ] Alert thresholds configured
- [ ] Log aggregation enabled
- [ ] Performance baseline captured

### Approval

- [ ] Tech lead approval to proceed
- [ ] DevOps approval to proceed
- [ ] QA sign-off on test plan
- [ ] Product owner notified

---

## Phase 1: Foundation (LOW RISK)

### Pre-Deployment

- [ ] Create feature branch: `feat/orchestration-enforcement-phase1`
- [ ] Review all 12 files to be added
- [ ] Validate test suite runs successfully
- [ ] Confirm schemas are valid JSON
- [ ] Verify agent frontmatter is valid YAML

### Deployment

- [ ] Add all Phase 1 files (12 total)
- [ ] Commit with conventional commit message
- [ ] Push feature branch
- [ ] Create PR using template from `PR_DESCRIPTIONS.md`
- [ ] Request reviews from tech lead + 1 engineer
- [ ] Wait for CI/CD to pass
- [ ] Merge PR (squash and merge)

### Validation (Post-Merge)

- [ ] Run unit tests: `node .claude/tools/task-classifier.test.mjs` ✅
- [ ] Test task classification:
  - [ ] Trivial: `node .claude/tools/task-classifier.mjs --task "Fix typo"`
  - [ ] Complex: `node .claude/tools/task-classifier.mjs --task "Refactor all APIs"`
- [ ] Validate schemas load without errors
- [ ] Verify agent files load correctly
- [ ] Confirm existing workflows still work

### Monitoring (2 Days)

- [ ] Day 1: Check metrics every 2 hours
  - [ ] Workflow success rate: **\_\_**%
  - [ ] No new errors in logs
  - [ ] No performance degradation
- [ ] Day 2: Check metrics every 4 hours
  - [ ] Workflow success rate: **\_\_**%
  - [ ] Team feedback collected
  - [ ] No issues reported

### Go/No-Go Decision for Phase 2

- [ ] All validation checks passed
- [ ] No critical issues in 2-day monitoring period
- [ ] Workflow success rate ≥95%
- [ ] Team confirms no regressions

**Decision**: ⏹️ STOP / ✅ PROCEED to Phase 2

---

## Phase 2: Workflow Integration (MEDIUM RISK)

### Pre-Deployment

- [ ] Confirm Phase 1 has been stable for 2 days
- [ ] Create feature branch: `feat/orchestration-enforcement-phase2`
- [ ] Review all 12 files to be modified
- [ ] Validate all YAML syntax locally
- [ ] Test workflow runner on modified workflows

### Deployment

- [ ] Modify all 11 workflow files + config.yaml
- [ ] Commit with conventional commit message
- [ ] Push feature branch
- [ ] Create PR using template from `PR_DESCRIPTIONS.md`
- [ ] Request reviews from tech lead + DevOps
- [ ] Validate YAML syntax in CI/CD
- [ ] Wait for approval
- [ ] Merge PR (squash and merge)

### Validation (Post-Merge)

- [ ] Validate all YAML files:
  ```bash
  for f in .claude/workflows/*.yaml; do
    node -e "require('js-yaml').load(require('fs').readFileSync('$f', 'utf8'))"
  done
  ```
- [ ] Validate config.yaml loads correctly
- [ ] Confirm new agents registered in config
- [ ] Test workflow execution (dry run):
  ```bash
  node .claude/tools/workflow_runner.js \
    --workflow .claude/workflows/code-quality-flow.yaml \
    --step 1 --id test-002 --dry-run
  ```
- [ ] Verify backward compatibility with existing workflows

### Monitoring (3 Days)

- [ ] Day 1: Check metrics every 2 hours
  - [ ] Workflow success rate: **\_\_**%
  - [ ] Review gate activations: **\_\_**
  - [ ] No workflow parsing errors
- [ ] Day 2: Check metrics every 4 hours
  - [ ] Workflow success rate: **\_\_**%
  - [ ] New agents spawned successfully: **\_\_**
  - [ ] No validation schema errors
- [ ] Day 3: Check metrics every 6 hours
  - [ ] Workflow success rate: **\_\_**%
  - [ ] Team feedback collected
  - [ ] No performance issues

### Go/No-Go Decision for Phase 3

- [ ] All validation checks passed
- [ ] No critical issues in 3-day monitoring period
- [ ] Workflow success rate ≥95%
- [ ] New agents working correctly
- [ ] Tech lead approval for Phase 3
- [ ] DevOps approval for Phase 3

**Decision**: ⏹️ STOP / ✅ PROCEED to Phase 3

---

## Phase 3: Enforcement Activation (HIGH RISK) ⚠️

### ⚠️ CRITICAL: HIGH RISK DEPLOYMENT

This phase changes core orchestrator behavior. **Manual testing required.**

### Pre-Deployment

- [ ] Confirm Phase 2 has been stable for 3 days
- [ ] **MANDATORY**: Schedule 2-hour window for deployment
- [ ] **MANDATORY**: On-call engineer standing by
- [ ] **MANDATORY**: Rollback procedure reviewed and tested
- [ ] Create feature branch: `feat/orchestration-enforcement-phase3`
- [ ] Review changes to CLAUDE.md (enforcement section)
- [ ] Review changes to orchestrator agents
- [ ] Test enforcement rules in non-production environment

### Manual Testing (REQUIRED)

Complete ALL manual tests BEFORE merging:

#### Test 1: Orchestrator Delegation

- [ ] Prompt: "Review all skills and fix issues"
- [ ] Expected: Orchestrator spawns developer/qa subagents
- [ ] Actual: ****************\_\_\_****************
- [ ] Result: ✅ PASS / ❌ FAIL

#### Test 2: Plan Rating

- [ ] Prompt: "Build a new feature with authentication"
- [ ] Expected: Planner → Rate (≥7/10) → Execute
- [ ] Actual: ****************\_\_\_****************
- [ ] Result: ✅ PASS / ❌ FAIL

#### Test 3: 3-File Rule

- [ ] Prompt: "Analyze these 5 files for patterns"
- [ ] Expected: Spawns analyst subagent
- [ ] Actual: ****************\_\_\_****************
- [ ] Result: ✅ PASS / ❌ FAIL

#### Test 4: Self-Correction

- [ ] Prompt: Complex multi-file task
- [ ] Expected: Stops and delegates
- [ ] Actual: ****************\_\_\_****************
- [ ] Result: ✅ PASS / ❌ FAIL

**All tests MUST pass before proceeding.**

### Deployment

- [ ] Add CRITICAL section to CLAUDE.md
- [ ] Update orchestrator.md with enforcement reminders
- [ ] Update model-orchestrator.md (if needed)
- [ ] Commit with conventional commit message + BREAKING CHANGE
- [ ] Push feature branch
- [ ] Create PR using template from `PR_DESCRIPTIONS.md`
- [ ] **MANDATORY**: Request approval from tech lead
- [ ] **MANDATORY**: Request approval from DevOps
- [ ] **MANDATORY**: QA sign-off on manual testing
- [ ] Wait for all approvals
- [ ] Merge PR (squash and merge)

### Validation (Post-Merge) - IMMEDIATE

- [ ] Verify enforcement section in CLAUDE.md:
  ```bash
  grep -q "ORCHESTRATION ENFORCEMENT" .claude/CLAUDE.md && echo "✓ Active"
  ```
- [ ] Verify critical markers present:
  ```bash
  grep -q "NON-NEGOTIABLE" .claude/CLAUDE.md && echo "✓ Critical"
  ```
- [ ] Validate orchestrator agent frontmatter
- [ ] Test orchestrator delegation (repeat Test 1)
- [ ] Test plan rating (repeat Test 2)
- [ ] Monitor for immediate issues (first 30 minutes)

### Monitoring (7 Days) - CRITICAL PERIOD

#### First 24 Hours (CRITICAL)

Check metrics **EVERY HOUR**:

- [ ] Hour 1: Orchestrator delegation rate: **\_\_**%
  - [ ] Plan rating compliance: **\_\_**%
  - [ ] Workflow success rate: **\_\_**%
  - [ ] Subagent spawn failures: **\_\_**
  - [ ] Infinite loops detected: **\_\_**
- [ ] Hour 2: (repeat metrics)
- [ ] Hour 4: (repeat metrics)
- [ ] Hour 8: (repeat metrics)
- [ ] Hour 24: (repeat metrics)

**ROLLBACK IMMEDIATELY** if:

- Orchestrator delegation <75%
- Plan rating compliance <95%
- Workflow success rate <90%
- Any infinite loops detected
- Any deadlocks detected

#### Days 2-3

Check metrics **EVERY 4 HOURS**:

- [ ] Day 2 AM: Metrics within targets
- [ ] Day 2 PM: Metrics within targets
- [ ] Day 3 AM: Metrics within targets
- [ ] Day 3 PM: Metrics within targets

#### Days 4-7

Check metrics **EVERY 12 HOURS**:

- [ ] Day 4: Metrics stable
- [ ] Day 5: Metrics stable
- [ ] Day 6: Metrics stable
- [ ] Day 7: Metrics stable

### Metrics Targets

| Metric                  | Target | Alert Threshold | Action                 |
| ----------------------- | ------ | --------------- | ---------------------- |
| Orchestrator delegation | ≥90%   | <75%            | Investigate            |
| Plan rating compliance  | 100%   | <95%            | Rollback               |
| Workflow success rate   | ≥95%   | <90%            | Rollback               |
| Subagent spawn failures | 0%     | >5%             | Rollback               |
| Infinite loops          | 0      | 1+              | **IMMEDIATE ROLLBACK** |

### Emergency Rollback Procedure

If ANY critical issue occurs:

```bash
# Step 1: Revert CLAUDE.md (IMMEDIATE)
git checkout HEAD~1 -- .claude/CLAUDE.md

# Step 2: Revert agents
git checkout HEAD~1 -- .claude/agents/orchestrator.md
git checkout HEAD~1 -- .claude/agents/model-orchestrator.md

# Step 3: Commit and push URGENTLY
git commit -m "revert: EMERGENCY rollback orchestration enforcement (Phase 3)"
git push origin main --force-with-lease

# Step 4: Notify team
echo "⚠️ ORCHESTRATION ENFORCEMENT ROLLED BACK"
# Post in team chat immediately
```

**Rollback time**: <5 minutes

### Go/No-Go Decision for Phase 4

- [ ] All validation checks passed
- [ ] No critical issues in 7-day monitoring period
- [ ] Orchestrator delegation ≥90%
- [ ] Plan rating compliance = 100%
- [ ] Workflow success rate ≥95%
- [ ] Zero infinite loops or deadlocks
- [ ] Team feedback positive
- [ ] No emergency rollbacks triggered

**Decision**: ⏹️ STOP / ✅ PROCEED to Phase 4

---

## Phase 4: Documentation (NO RISK)

### Pre-Deployment

- [ ] Confirm Phase 3 has been stable for 7 days
- [ ] Create feature branch: `feat/orchestration-enforcement-phase4`
- [ ] Review all documentation files to update
- [ ] Check for broken links
- [ ] Validate examples show correct patterns

### Deployment

- [ ] Update ORCHESTRATION_PATTERNS.md with enforcement examples
- [ ] Update WORKFLOW-GUIDE.md with review gate documentation
- [ ] Update ADVANCED_TOOL_USE.md with delegation patterns
- [ ] Update CLAUDE_SETUP_GUIDE.md with validation steps
- [ ] Update other relevant docs as needed
- [ ] Commit with conventional commit message
- [ ] Push feature branch
- [ ] Create PR using template from `PR_DESCRIPTIONS.md`
- [ ] Request review from technical writer
- [ ] Merge PR (squash and merge)

### Validation (Post-Merge)

- [ ] Check for broken links:
  ```bash
  find .claude/docs -name "*.md" -exec grep -H "\.md)" {} \;
  ```
- [ ] Validate markdown syntax:
  ```bash
  for f in .claude/docs/*.md; do
    node -e "require('fs').readFileSync('$f', 'utf8');"
  done
  ```
- [ ] Verify examples show correct delegation patterns
- [ ] Confirm enforcement validation steps in setup guide
- [ ] Check troubleshooting section complete

### Monitoring (1 Day)

- [ ] No broken links reported
- [ ] Team confirms documentation accurate
- [ ] Examples tested and working
- [ ] Setup validation steps verified

---

## Post-Deployment (After Phase 4)

### Completion Checklist

- [ ] All 4 phases deployed successfully
- [ ] No rollbacks required
- [ ] All metrics within targets
- [ ] Team trained on enforcement rules
- [ ] Documentation complete and accurate

### Final Metrics Validation

- [ ] Orchestrator delegation rate: **\_\_**% (target: ≥90%)
- [ ] Plan rating compliance: **\_\_**% (target: 100%)
- [ ] 3-file rule compliance: **\_\_**% (target: 100%)
- [ ] Workflow success rate: **\_\_**% (target: ≥95%)
- [ ] Infinite loops detected: **\_\_** (target: 0)
- [ ] Emergency rollbacks: **\_\_** (target: 0)

### Retrospective

- [ ] Schedule team retrospective meeting
- [ ] Document lessons learned
- [ ] Update rollout procedures based on learnings
- [ ] Share success metrics with stakeholders
- [ ] Archive deployment documentation

### Knowledge Transfer

- [ ] Team training session conducted
- [ ] Enforcement rules documented in onboarding
- [ ] Troubleshooting guide available
- [ ] Monitoring dashboards shared with team

---

## Success Criteria (Overall)

The orchestration enforcement rollout is **COMPLETE** when:

### Technical Success

- [x] All 4 phases deployed without rollbacks
- [x] Orchestrator delegation rate ≥90%
- [x] Plan rating compliance = 100%
- [x] 3-file rule compliance = 100%
- [x] Workflow success rate ≥95%
- [x] Zero infinite loops or deadlocks

### Operational Success

- [x] Documentation complete and accurate
- [x] Team trained on enforcement rules
- [x] Monitoring dashboards updated
- [x] Rollback procedures validated
- [x] Retrospective completed

### Business Success

- [x] No production incidents caused by rollout
- [x] No velocity degradation
- [x] Improved code quality metrics
- [x] Reduced tech debt accumulation
- [x] Team confidence in orchestration system

---

## Rollout Status Tracker

| Phase            | Status     | Deployed | Monitored | Issues | Decision |
| ---------------- | ---------- | -------- | --------- | ------ | -------- |
| 1: Foundation    | ⏳ Pending | -        | -         | -      | -        |
| 2: Workflows     | ⏳ Pending | -        | -         | -      | -        |
| 3: Enforcement   | ⏳ Pending | -        | -         | -      | -        |
| 4: Documentation | ⏳ Pending | -        | -         | -      | -        |

**Overall Status**: ⏳ Not Started

**Legend**:

- ⏳ Pending
- 🚀 In Progress
- ✅ Complete
- ❌ Failed
- 🔄 Rolled Back

---

## Emergency Contacts

### Escalation Path

1. **On-Call Engineer**: [Name] - [Contact]
2. **Tech Lead**: [Name] - [Contact]
3. **DevOps Lead**: [Name] - [Contact]
4. **Engineering Manager**: [Name] - [Contact]

### Communication Channels

- **Deployment Updates**: #engineering-deploys
- **Incidents**: #incidents
- **Team Chat**: #engineering-team
- **Escalations**: @oncall

---

**Checklist Version**: 1.0
**Last Updated**: 2026-01-04
**Maintained By**: DevOps Team
**Next Review**: After each phase deployment
