# Rollback Procedures

**Version**: 1.0.0
**Last Updated**: 2026-01-28
**Owner**: DevOps Team

This document outlines emergency rollback procedures for all Phase 1 features in the upgrade roadmap.

---

## Table of Contents

1. [General Rollback Strategy](#general-rollback-strategy)
2. [Feature: Party Mode](#feature-party-mode)
3. [Feature: Advanced Elicitation](#feature-advanced-elicitation)
4. [Feature: Knowledge Base Indexing](#feature-knowledge-base-indexing)
5. [Feature: Agent Sidecar Memory](#feature-agent-sidecar-memory)
6. [Feature: Cost Tracking](#feature-cost-tracking)
7. [Emergency Contacts](#emergency-contacts)

---

## General Rollback Strategy

### Rollback Levels

| Level | Method | Impact | Recovery Time |
|-------|--------|--------|---------------|
| **Level 1: Feature Flag** | Disable via environment variable | Immediate | < 1 minute |
| **Level 2: Config Change** | Edit `.claude/config.yaml` | Requires restart | < 5 minutes |
| **Level 3: Git Revert** | Revert commits | Code changes | < 30 minutes |
| **Level 4: Full Restore** | Restore from backup | Complete rollback | < 2 hours |

### Pre-Rollback Checklist

Before performing any rollback:

- [ ] Document the issue (what went wrong, when, impact)
- [ ] Capture logs and error messages
- [ ] Notify team members
- [ ] Create incident ticket
- [ ] Tag commit for investigation

### Post-Rollback Checklist

After rollback:

- [ ] Verify system is stable
- [ ] Run smoke tests
- [ ] Monitor for regressions
- [ ] Update memory files (issues.md)
- [ ] Schedule post-mortem

---

## Feature: Party Mode

### Quick Disable (Level 1)

**Method**: Set environment variable

```bash
# Windows (PowerShell)
$env:PARTY_MODE_ENABLED = "false"

# Unix/Mac
export PARTY_MODE_ENABLED=false

# Restart Claude Code session
```

**Verification**:
```bash
# Check logs for "[party-mode] Feature disabled via flag"
tail -f .claude/logs/agent-studio.log | grep party-mode
```

**Recovery Time**: Immediate (< 1 minute)

---

### Config Disable (Level 2)

**Method**: Edit config file

```bash
# Edit .claude/config.yaml
# Set features.partyMode.enabled: false
```

**Verification**:
```bash
# Test feature flag
node -e "const ff = require('./.claude/lib/utils/feature-flags.cjs'); console.log('Party Mode:', ff.isEnabled('features.partyMode.enabled'));"
```

**Recovery Time**: < 5 minutes (requires session restart)

---

### Code Rollback (Level 3)

**Method**: Revert Git commits

```bash
# Find party-mode commits
git log --oneline --grep="party-mode" --grep="Party Mode" -i

# Revert specific commit
git revert <commit-hash>

# Or revert range
git revert <start-commit>..<end-commit>

# Push revert
git push origin main
```

**Recovery Time**: < 30 minutes

---

### Full Restore (Level 4)

**Method**: Restore from backup

```bash
# Restore party-mode directory from backup
cp -r .claude.archive/party-mode-backup-{timestamp}/* .claude/skills/party-mode/

# Restore team definitions
cp -r .claude.archive/teams-backup-{timestamp}/* .claude/teams/

# Verify restore
git status
git diff
```

**Recovery Time**: < 2 hours

---

### Known Issues

#### Issue #1: Context Overflow

**Symptom**: "Context limit exceeded" error during multi-agent collaboration

**Workaround**: Reduce `maxAgents` from 5 to 3
```yaml
features:
  partyMode:
    maxAgents: 3  # Reduced from 5
```

#### Issue #2: Agent Response Conflicts

**Symptom**: Conflicting advice from multiple agents

**Workaround**: Enable sequential execution (disable parallel)
```yaml
features:
  partyMode:
    parallelExecution: false
```

#### Issue #3: Session Not Saving

**Symptom**: Session summary not written to memory

**Workaround**: Manually save session
```bash
# Export session to memory
node .claude/tools/cli/export-session.js --session-id <id> --output .claude/context/memory/sessions/
```

---

## Feature: Advanced Elicitation

### Quick Disable (Level 1)

**Method**: Set environment variable

```bash
# Windows (PowerShell)
$env:ELICITATION_ENABLED = "false"

# Unix/Mac
export ELICITATION_ENABLED=false
```

**Verification**:
```bash
# Check elicitation is skipped
grep "Elicitation skipped" .claude/logs/agent-studio.log
```

**Recovery Time**: Immediate

---

### Config Disable (Level 2)

**Method**: Edit config file

```bash
# Edit .claude/config.yaml
# Set features.advancedElicitation.enabled: false
```

**Recovery Time**: < 5 minutes

---

### Code Rollback (Level 3)

**Method**: Revert elicitation commits

```bash
git log --oneline --grep="elicitation" -i
git revert <commit-hash>
```

**Recovery Time**: < 30 minutes

---

### Known Issues

#### Issue #1: Cost Explosion

**Symptom**: LLM costs exceed budget (2x expected)

**Workaround**: Reduce method count
```yaml
features:
  advancedElicitation:
    methods: ["first-principles", "pre-mortem"]  # Only 2 methods
    costBudget: 5.0  # Reduced budget
```

#### Issue #2: Method Selection Irrelevant

**Symptom**: Suggested reasoning methods don't apply to task

**Workaround**: Increase confidence threshold
```yaml
features:
  advancedElicitation:
    minConfidence: 0.8  # Skip unless 80%+ confidence
```

---

## Feature: Knowledge Base Indexing

### Quick Disable (Level 1)

**Method**: Delete index file (fallback to directory scan)

```bash
# Remove index (system falls back to directory scan)
rm .claude/knowledge/skill-index.csv
rm .claude/knowledge/agent-index.csv
```

**Verification**:
```bash
# Check logs for "Index not found, falling back to directory scan"
tail -f .claude/logs/agent-studio.log | grep "Index not found"
```

**Recovery Time**: Immediate

---

### Code Rollback (Level 2)

**Method**: Revert indexing commits

```bash
git log --oneline --grep="knowledge-base" --grep="indexing" -i
git revert <commit-hash>
```

**Recovery Time**: < 30 minutes

---

### Known Issues

#### Issue #1: Index Corruption

**Symptom**: "Invalid CSV format" error

**Workaround**: Rebuild index
```bash
node .claude/tools/cli/rebuild-index.js --skills --agents
```

#### Issue #2: Stale Index

**Symptom**: New skills/agents not discovered

**Workaround**: Force rebuild
```bash
node .claude/tools/cli/rebuild-index.js --force
```

---

## Feature: Agent Sidecar Memory

### Quick Disable (Level 1)

**Method**: Remove sidecar directory (fallback to shared memory)

```bash
# Rename sidecar directory (preserves data)
mv .claude/memory/agents .claude/memory/agents.disabled
```

**Verification**:
```bash
# Check logs for "Sidecar not found, using shared memory"
tail -f .claude/logs/agent-studio.log | grep "Sidecar not found"
```

**Recovery Time**: Immediate

---

### Code Rollback (Level 2)

**Method**: Revert sidecar memory commits

```bash
git log --oneline --grep="sidecar" --grep="agent-specific memory" -i
git revert <commit-hash>
```

**Recovery Time**: < 30 minutes

---

### Known Issues

#### Issue #1: Memory Divergence

**Symptom**: Agent standards differ from shared standards

**Workaround**: Sync sidecar with shared
```bash
# Copy shared standards to sidecar
cp .claude/context/memory/learnings.md .claude/memory/agents/developer/standards.md
```

#### Issue #2: Sidecar Size Growth

**Symptom**: Sidecar files exceed 50KB limit

**Workaround**: Archive old entries
```bash
node .claude/tools/cli/archive-sidecar.js --agent developer --older-than 90d
```

---

## Feature: Cost Tracking

### Quick Disable (Level 1)

**Method**: Remove hook from settings.json

```bash
# Edit .claude/settings.json
# Remove "cost-tracking.cjs" from hooks array
```

**Verification**:
```bash
# Check no cost logs generated
ls .claude/context/metrics/cost-log.jsonl
```

**Recovery Time**: Immediate

---

### Code Rollback (Level 2)

**Method**: Revert cost tracking commits

```bash
git log --oneline --grep="cost-tracking" -i
git revert <commit-hash>
```

**Recovery Time**: < 30 minutes

---

### Known Issues

#### Issue #1: Inaccurate Token Counts

**Symptom**: Cost calculations don't match actual usage

**Workaround**: Update pricing data
```bash
# Edit .claude/lib/utils/pricing.json with current Anthropic pricing
```

#### Issue #2: Log File Growth

**Symptom**: cost-log.jsonl exceeds 100MB

**Workaround**: Rotate logs
```bash
node .claude/tools/cli/rotate-cost-logs.js --keep-last 30d
```

---

## Emergency Contacts

| Role | Contact | Availability |
|------|---------|--------------|
| **On-Call Engineer** | @devops-team | 24/7 |
| **Security Team** | @security | Business hours |
| **Architecture Team** | @architects | Business hours |

---

## Rollback Decision Matrix

Use this matrix to decide rollback level:

| Severity | Impact | Rollback Level | Approval Required |
|----------|--------|----------------|-------------------|
| **P0 (Critical)** | Production down, data loss | Level 1-2 | Any engineer |
| **P1 (High)** | Major functionality broken | Level 1-2 | Team lead |
| **P2 (Medium)** | Minor functionality broken | Level 1-2 | Team lead |
| **P3 (Low)** | Cosmetic issues | None (fix forward) | None |

---

## Post-Mortem Template

After rollback, create post-mortem:

```markdown
## Incident Post-Mortem: [Feature Name] Rollback

**Date**: YYYY-MM-DD
**Severity**: P0/P1/P2/P3
**Duration**: HH:MM
**Rollback Level**: 1/2/3/4

### What Happened
[Describe the incident]

### Root Cause
[Why did it happen?]

### Timeline
- HH:MM - Incident detected
- HH:MM - Rollback initiated
- HH:MM - System stable

### Impact
- Users affected: N
- Data loss: Yes/No
- Downtime: HH:MM

### Prevention
- [ ] Add monitoring
- [ ] Update tests
- [ ] Document edge case
- [ ] Review design

### Follow-up Tasks
- [ ] Fix root cause
- [ ] Update runbook
- [ ] Share learnings
```

---

**Document Version**: 1.0.0
**Next Review**: 2026-02-28
**Maintained By**: DevOps Team
