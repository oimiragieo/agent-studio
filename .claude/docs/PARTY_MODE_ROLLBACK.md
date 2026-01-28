# Party Mode Rollback Procedures

Emergency rollback procedures for multi-agent collaboration system.

## Table of Contents

- [Rollback Levels](#rollback-levels)
- [When to Rollback](#when-to-rollback)
- [Rollback Procedures](#rollback-procedures)
- [Communication Templates](#communication-templates)
- [Post-Rollback Analysis](#post-rollback-analysis)

---

## Rollback Levels

Party Mode supports 4 rollback levels with increasing scope and duration.

### Level 1: Feature Flag Disable (Immediate, <1 minute)

**Scope**: Disable Party Mode, all other features continue

**Impact**:
- Party Mode unavailable for all users
- Active sessions terminate gracefully
- Router falls back to single-agent spawning
- Zero data loss (audit logs preserved)

**When to Use**:
- CRITICAL security incident (SEC-PM-004 or SEC-PM-006 violation)
- Session success rate <80%
- Immediate emergency disable needed

**Recovery Time**: <1 minute

---

### Level 2: Configuration Rollback (5-10 minutes)

**Scope**: Restore previous config.yaml state

**Impact**:
- Party Mode configuration reverted to previous version
- Rate limits, team definitions restored to last known good
- Active sessions may terminate (config change)
- Minimal data loss (in-flight sessions only)

**When to Use**:
- Bad configuration deployed (wrong rate limits, invalid team CSV)
- Performance degradation after config change
- Feature flag disable insufficient (config issue)

**Recovery Time**: 5-10 minutes

---

### Level 3: Code Rollback (30-60 minutes)

**Scope**: Revert Party Mode code to previous git commit

**Impact**:
- All Party Mode Phase 1-4 code reverted
- Security controls restored to previous version
- All active sessions terminate
- Audit logs preserved (data safe)

**When to Use**:
- Critical bug in Phase 1-4 implementation
- Security vulnerability discovered in code
- Performance regression after code deploy
- Feature flag + config rollback insufficient

**Recovery Time**: 30-60 minutes

---

### Level 4: Full System Restore (2-4 hours)

**Scope**: Restore entire agent-studio codebase to pre-Party Mode state

**Impact**:
- Party Mode completely removed
- All Party Mode files deleted
- Codebase restored to Phase 0 (before Party Mode implementation)
- All audit logs archived (not deleted)

**When to Use**:
- System compromise suspected (orchestrator breach)
- Multiple CRITICAL violations across sessions
- Data exfiltration detected
- Code rollback insufficient (widespread issues)

**Recovery Time**: 2-4 hours

---

## When to Rollback

### Rollback Decision Matrix

| Condition | Level | Urgency | Authority Required |
|-----------|-------|---------|-------------------|
| **SEC-PM-004 violation** (context leakage) | Level 1 | Immediate | On-call engineer |
| **SEC-PM-006 violation** (memory boundary) | Level 1 | Immediate | On-call engineer |
| **Session success rate <80%** | Level 1 | Within 15 min | On-call engineer |
| **Agent spawn failure rate >10%** | Level 1 | Within 15 min | On-call engineer |
| **Bad configuration deployed** | Level 2 | Within 30 min | DevOps engineer |
| **Performance degradation >2x** | Level 2 | Within 1 hour | DevOps engineer |
| **Critical bug in code** | Level 3 | Within 2 hours | Engineering lead |
| **Security vulnerability in code** | Level 3 | Within 1 hour | Security architect |
| **System compromise suspected** | Level 4 | Immediate | CTO + Security architect |
| **Multiple CRITICAL violations** | Level 4 | Within 4 hours | CTO + Security architect |

### Automatic Rollback Triggers

**Circuit Breaker** (automatic Level 1 rollback):

Trigger if ALL of:
- SEC-PM-004 or SEC-PM-006 violation count >0 in last hour
- Session success rate <70% over last 100 sessions
- No manual intervention within 15 minutes of first alert

**Implementation** (monitoring system):
```yaml
circuit_breaker:
  enabled: true
  conditions:
    - security_violations: [ 'SEC-PM-004', 'SEC-PM-006' ]
    - session_success_rate: <70%
  duration: 15 minutes
  action: disable_party_mode
  notify: [ 'on-call-engineer', 'security-team' ]
```

---

## Rollback Procedures

### Level 1: Feature Flag Disable

**Duration**: <1 minute

**Prerequisites**: None (emergency procedure)

**Steps**:

1. **Set environment variable** (highest priority):
   ```bash
   export PARTY_MODE_ENABLED=false
   ```

2. **Verify disabled**:
   ```bash
   node -e "const config = require('./.claude/lib/utils/feature-flags.cjs'); console.log('Party Mode:', config.isEnabled('partyMode'))"
   # Expected output: Party Mode: false
   ```

3. **Check active sessions**:
   ```bash
   # Extract sessions that started but did not end
   jq 'select(.eventType=="SESSION_START")' .claude/context/metrics/party-mode-audit.jsonl | \
     jq -r '.sessionId' | \
     while read sid; do
       jq -e "select(.sessionId==\"$sid\" and .eventType==\"SESSION_END\")" party-mode-audit.jsonl > /dev/null || echo "Active: $sid"
     done
   ```

4. **Graceful session termination**:
   - Active sessions receive "Party Mode disabled" message
   - Sessions terminate at next round boundary
   - Audit log records termination reason: "feature_disabled"

5. **Notify users**:
   ```
   NOTICE: Party Mode temporarily disabled for maintenance.
   Using single-agent mode for now. Apologies for disruption.
   ```

6. **Verify rollback**:
   ```bash
   # Attempt to activate Party Mode
   User: "Start Party Mode session"
   Expected: Router spawns single agent instead

   # Check audit log for new sessions
   tail -5 .claude/context/metrics/party-mode-audit.jsonl | grep "SESSION_START"
   # Expected: No new sessions after disable
   ```

**Rollback Confirmation Checklist**:
- [ ] Environment variable set: `PARTY_MODE_ENABLED=false`
- [ ] Verification command confirms disabled
- [ ] Active sessions terminated gracefully
- [ ] Users notified
- [ ] No new Party Mode sessions starting

**Alternative Method** (if environment variable fails):

**Config file edit**:
```bash
# Edit config
sed -i 's/enabled: true/enabled: false/' .claude/config.yaml

# Force config reload (if auto-reload not enabled)
touch .claude/config.yaml  # Trigger file watcher
# OR restart application
```

---

### Level 2: Configuration Rollback

**Duration**: 5-10 minutes

**Prerequisites**:
- Git repository with version control
- Previous config.yaml committed

**Steps**:

1. **Identify last known good config** (git):
   ```bash
   # Show recent config changes
   git log --oneline -10 .claude/config.yaml

   # View specific commit config
   git show <commit-hash>:.claude/config.yaml
   ```

2. **Restore previous config**:
   ```bash
   # Checkout previous version
   git checkout <commit-hash> .claude/config.yaml

   # Verify contents
   cat .claude/config.yaml | grep -A 10 "partyMode:"
   ```

3. **Validate restored config**:
   ```bash
   # Check YAML syntax
   node -e "const yaml = require('yaml'); const fs = require('fs'); yaml.parse(fs.readFileSync('.claude/config.yaml', 'utf-8'))"

   # Check required fields
   grep -E "enabled:|maxAgents:|maxRounds:" .claude/config.yaml
   ```

4. **Test configuration** (staging):
   ```bash
   # Set staging environment
   export AGENT_STUDIO_ENV=staging

   # Load config and verify
   node -e "const config = require('./.claude/lib/utils/feature-flags.cjs').getConfig('partyMode'); console.log(JSON.stringify(config, null, 2))"
   ```

5. **Apply to production**:
   ```bash
   # Unset environment variable (use config file)
   unset PARTY_MODE_ENABLED

   # Force config reload
   touch .claude/config.yaml
   ```

6. **Verify rollback**:
   ```bash
   # Check Party Mode activation works with restored config
   # Monitor for 15 minutes
   watch -n 60 'tail -1 .claude/context/metrics/party-mode-audit.jsonl'
   ```

**Rollback Confirmation Checklist**:
- [ ] Last known good commit identified
- [ ] Config file restored from git
- [ ] YAML syntax validated
- [ ] Required fields present
- [ ] Tested in staging environment
- [ ] Applied to production
- [ ] Monitoring shows expected behavior

**If Rollback Fails**:
- Escalate to Level 3 (Code Rollback)
- Investigate why config rollback insufficient
- Check for code changes requiring config changes

---

### Level 3: Code Rollback

**Duration**: 30-60 minutes

**Prerequisites**:
- Git repository with Party Mode code
- Pre-deployment git tag (e.g., `pre-party-mode-v1.0.0`)
- Test suite available

**Steps**:

1. **Identify rollback target**:
   ```bash
   # Find last commit before Party Mode deployment
   git log --oneline --all --grep="Party Mode Phase 6"

   # Or use pre-deployment tag
   git tag | grep "pre-party-mode"
   ```

2. **Create rollback branch**:
   ```bash
   git checkout -b rollback-party-mode-$(date +%Y%m%d)
   ```

3. **Revert Party Mode code**:

   **Option A: Revert specific commits** (preserves other changes):
   ```bash
   # Revert Phase 6, 5, 4, 3, 2, 1 in reverse order
   git revert <phase-6-commit>
   git revert <phase-5-commit>
   git revert <phase-4-commit>
   git revert <phase-3-commit>
   git revert <phase-2-commit>
   git revert <phase-1-commit>
   ```

   **Option B: Reset to pre-Party Mode state** (discards other changes):
   ```bash
   # Hard reset to pre-Party Mode tag
   git reset --hard pre-party-mode-v1.0.0
   ```

4. **Remove Party Mode files**:
   ```bash
   # Delete Party Mode directories
   rm -rf .claude/lib/party-mode/
   rm -rf .claude/teams/
   rm .claude/docs/PARTY_MODE*.md

   # Commit deletion
   git add -A
   git commit -m "rollback: Remove Party Mode files"
   ```

5. **Run test suite**:
   ```bash
   # Verify zero regressions
   npm test

   # Expected: All non-Party Mode tests passing (74 tests)
   # Party Mode tests: 123 tests should be removed
   ```

6. **Deploy to staging**:
   ```bash
   export AGENT_STUDIO_ENV=staging
   npm run deploy:staging

   # Smoke test in staging
   # Verify Party Mode NOT available
   # Verify single-agent mode working
   ```

7. **Deploy to production**:
   ```bash
   npm run deploy:production

   # Monitor for 30 minutes
   # Check error rates, session success, user feedback
   ```

8. **Verify rollback**:
   ```bash
   # Check no Party Mode files present
   ls .claude/lib/party-mode/  # Should not exist

   # Check router does not spawn party-orchestrator
   grep "party-orchestrator" .claude/agents/core/router.md  # Should not exist

   # Check feature flag removed from config
   grep "partyMode" .claude/config.yaml  # Should not exist
   ```

**Rollback Confirmation Checklist**:
- [ ] Rollback target identified (commit/tag)
- [ ] Rollback branch created
- [ ] Party Mode code reverted
- [ ] Party Mode files deleted
- [ ] Test suite passes (zero regressions)
- [ ] Deployed to staging successfully
- [ ] Smoke tested in staging
- [ ] Deployed to production
- [ ] Monitoring shows stable behavior

**If Rollback Fails**:
- Check for dependencies on Party Mode code in other features
- Review CLAUDE.md for Party Mode references (remove)
- Escalate to Level 4 if code issues persist

---

### Level 4: Full System Restore

**Duration**: 2-4 hours

**Prerequisites**:
- Full system backup (git snapshot)
- Pre-Party Mode baseline tag (`baseline-before-party-mode`)
- Communication plan (users, stakeholders)

**Steps**:

1. **STOP: Escalation Required**:
   - This is a CRITICAL operation
   - Requires approval from: CTO, Security Architect, Engineering Lead
   - Document reason for Level 4 rollback
   - Notify all stakeholders

2. **Create system snapshot** (current state):
   ```bash
   # Tag current state for investigation
   git tag rollback-snapshot-$(date +%Y%m%d-%H%M%S)
   git push origin rollback-snapshot-$(date +%Y%m%d-%H%M%S)

   # Backup audit logs
   cp .claude/context/metrics/party-mode-audit.jsonl \
      .claude/context/archives/party-mode-audit-$(date +%Y%m%d).jsonl

   # Archive sidecar directory
   tar -czf party-mode-sidecars-$(date +%Y%m%d).tar.gz .claude/staging/agents/
   ```

3. **Disable ALL Party Mode systems**:
   ```bash
   # Set feature flag
   export PARTY_MODE_ENABLED=false

   # Stop any Party Mode background processes
   pkill -f "party-mode"

   # Verify no active sessions
   jq 'select(.eventType=="SESSION_START" and (.sessionId | select(. != null)))' party-mode-audit.jsonl | \
     jq -r '.sessionId' | \
     while read sid; do
       jq -e "select(.sessionId==\"$sid\" and .eventType==\"SESSION_END\")" party-mode-audit.jsonl > /dev/null || \
         echo "WARNING: Active session $sid will be terminated"
     done
   ```

4. **Restore codebase to baseline**:
   ```bash
   # Hard reset to pre-Party Mode baseline
   git reset --hard baseline-before-party-mode

   # Force push to rollback branch (DO NOT push to main without approval)
   git checkout -b rollback-emergency-$(date +%Y%m%d)
   git push origin rollback-emergency-$(date +%Y%m%d) --force
   ```

5. **Remove ALL Party Mode artifacts**:
   ```bash
   # Delete directories
   rm -rf .claude/lib/party-mode/
   rm -rf .claude/teams/
   rm -rf .claude/staging/agents/

   # Delete documentation
   rm .claude/docs/PARTY_MODE*.md

   # Remove from CLAUDE.md
   sed -i '/Party Mode/d' .claude/CLAUDE.md

   # Commit cleanup
   git add -A
   git commit -m "rollback: Emergency removal of Party Mode (Level 4)"
   ```

6. **Restore configuration**:
   ```bash
   # Restore config.yaml to baseline
   git checkout baseline-before-party-mode -- .claude/config.yaml

   # Verify no Party Mode references
   grep -i "party" .claude/config.yaml  # Should be empty
   ```

7. **Full test suite**:
   ```bash
   # Run ALL tests (expect 74 baseline tests)
   npm test

   # Expected: 74/74 tests passing
   # No Party Mode tests should exist
   ```

8. **Deploy to production** (coordinated):
   ```bash
   # Staging first (1 hour validation)
   export AGENT_STUDIO_ENV=staging
   npm run deploy:staging
   # Monitor for 1 hour, verify stability

   # Production (off-hours, communication sent)
   npm run deploy:production
   # Monitor for 4 hours, on-call coverage
   ```

9. **Archive investigation materials**:
   ```bash
   # Create investigation package
   mkdir -p .claude/context/archives/party-mode-incident-$(date +%Y%m%d)/
   cp party-mode-audit-$(date +%Y%m%d).jsonl .claude/context/archives/party-mode-incident-$(date +%Y%m%d)/
   cp party-mode-sidecars-$(date +%Y%m%d).tar.gz .claude/context/archives/party-mode-incident-$(date +%Y%m%d)/
   git log --oneline --all --since="30 days ago" > .claude/context/archives/party-mode-incident-$(date +%Y%m%d)/git-log.txt

   # Document incident
   # Create: .claude/context/artifacts/security-reviews/party-mode-incident-YYYYMMDD.md
   ```

**Rollback Confirmation Checklist**:
- [ ] CTO + Security Architect approval obtained
- [ ] Current state snapshot created
- [ ] Audit logs archived
- [ ] Sidecar directory archived
- [ ] ALL Party Mode systems disabled
- [ ] Codebase restored to baseline
- [ ] ALL Party Mode artifacts removed
- [ ] Configuration restored
- [ ] Full test suite passes (74 baseline tests)
- [ ] Deployed to staging (1 hour validation)
- [ ] Deployed to production (4 hour monitoring)
- [ ] Investigation materials archived
- [ ] Incident report created

**Post-Rollback Investigation** (see [Post-Rollback Analysis](#post-rollback-analysis))

---

## Communication Templates

### Level 1: Feature Flag Disable

**Internal Communication** (Slack/Teams):
```
ALERT: Party Mode disabled (Level 1 Rollback)
Reason: [CRITICAL security incident | Session success rate <80% | Other]
Impact: Party Mode unavailable, single-agent mode active
Duration: Investigating, updates every 30 minutes
Action Required: None (automated rollback)
Next Update: [HH:MM]
```

**User-Facing Message**:
```
Party Mode temporarily unavailable for maintenance.
You can still use single-agent mode as usual.
We'll notify you when Party Mode is back online.
Apologies for the disruption.
```

---

### Level 2: Configuration Rollback

**Internal Communication**:
```
INFO: Party Mode config rollback (Level 2)
Reason: [Bad configuration | Performance degradation after config change]
Impact: Party Mode configuration reverted to [commit-hash]
Duration: 5-10 minutes
Action Required: None
Status: [In Progress | Complete]
```

**User-Facing Message**:
```
Party Mode configuration updated.
You may experience brief session terminations.
New sessions will work normally.
```

---

### Level 3: Code Rollback

**Internal Communication**:
```
WARNING: Party Mode code rollback (Level 3)
Reason: [Critical bug | Security vulnerability | Performance regression]
Impact: Party Mode code reverted to [commit/tag]
Duration: 30-60 minutes
Action Required: Engineering team on standby
Deployment Window: [HH:MM - HH:MM]
Status: [In Progress | Testing | Deploying | Complete]
```

**User-Facing Message**:
```
Party Mode undergoing maintenance (30-60 minutes).
Temporarily unavailable during this window.
Single-agent mode remains available.
We'll notify you when complete.
```

---

### Level 4: Full System Restore

**Internal Communication**:
```
CRITICAL: Full system restore (Level 4 Rollback)
Reason: [System compromise suspected | Multiple CRITICAL violations]
Impact: Party Mode completely removed, system restored to baseline
Duration: 2-4 hours
Action Required: All hands on deck - CTO + Security + Engineering
Deployment Window: [HH:MM - HH:MM]
Communication: Users notified, stakeholders briefed
Incident ID: INC-[YYYYMMDD]-001
Status: [In Progress | Investigating | Deploying | Complete]
```

**User-Facing Message**:
```
NOTICE: Agent Studio maintenance in progress (2-4 hours)

Party Mode feature temporarily removed while we investigate
a critical issue. Single-agent mode continues to work normally.

We take security and reliability seriously. We'll share more
details once investigation is complete.

Timeline:
  [HH:MM] - Maintenance start
  [HH:MM] - Expected completion
  [HH:MM] - Post-mortem published

Thank you for your patience.
```

---

## Post-Rollback Analysis

### Immediate Post-Rollback (< 4 hours)

**Verification Tasks**:
1. **System Stability**:
   - [ ] Session success rate >95%
   - [ ] Error rate <1%
   - [ ] Performance metrics at baseline
   - [ ] No new security violations

2. **User Impact**:
   - [ ] User complaints acknowledged
   - [ ] Support tickets reviewed
   - [ ] User feedback collected

3. **Data Integrity**:
   - [ ] Audit logs preserved
   - [ ] No data loss verified
   - [ ] Archived materials verified

**Status Report Template**:
```
Post-Rollback Status Report
Rollback Level: [1/2/3/4]
Completion Time: [HH:MM]
System Status: [STABLE | MONITORING | ISSUES]

Verification:
  - Session success rate: [XX%]
  - Error rate: [XX%]
  - Security violations: [count]
  - User impact: [brief description]

Next Steps:
  1. [Action 1]
  2. [Action 2]
  3. [Action 3]

Investigation Status: [Not Started | In Progress | Complete]
```

---

### Root Cause Analysis (24-48 hours)

**Investigation Process**:

1. **Timeline Reconstruction**:
   - When did issue first occur?
   - What changed immediately before issue?
   - How long until detected?
   - How long until rollback completed?

2. **Evidence Collection**:
   - Audit log entries for affected sessions
   - Security event logs
   - Performance metrics graphs
   - User error reports
   - Code changes (git diff)

3. **Root Cause Identification** (5 Whys):
   ```
   Why did [issue] occur?
     Because [reason 1]
   Why [reason 1]?
     Because [reason 2]
   Why [reason 2]?
     Because [reason 3]
   Why [reason 3]?
     Because [reason 4]
   Why [reason 4]?
     Because [root cause]
   ```

4. **Contributing Factors**:
   - Was issue preventable with existing processes?
   - Were monitoring/alerts sufficient?
   - Was response time adequate?
   - Were rollback procedures effective?

**Root Cause Analysis Template**:
```markdown
# Root Cause Analysis: Party Mode Rollback

**Incident ID**: INC-[YYYYMMDD]-001
**Date**: [YYYY-MM-DD]
**Rollback Level**: [1/2/3/4]
**Duration**: [HH:MM]

## Timeline
- [HH:MM] - Issue first occurred
- [HH:MM] - Issue detected
- [HH:MM] - Rollback initiated
- [HH:MM] - Rollback completed
- [HH:MM] - System stable

## Root Cause
[One-sentence summary of root cause]

### 5 Whys Analysis
1. Why did [issue] occur? [Answer]
2. Why [answer 1]? [Answer]
3. Why [answer 2]? [Answer]
4. Why [answer 3]? [Answer]
5. Why [answer 4]? **[ROOT CAUSE]**

## Contributing Factors
1. [Factor 1]
2. [Factor 2]
3. [Factor 3]

## Preventability Assessment
- [ ] Issue was preventable with existing processes
- [ ] Issue was detectable with existing monitoring
- [ ] Response time was adequate
- [ ] Rollback procedures were effective

## Lessons Learned
1. [Lesson 1]
2. [Lesson 2]
3. [Lesson 3]
```

---

### Remediation Plan (1-2 weeks)

**Remediation Categories**:

1. **Immediate Fixes** (< 24 hours):
   - Critical security vulnerabilities
   - High-severity bugs causing data loss
   - Performance issues >50% degradation

2. **Short-Term Fixes** (1-7 days):
   - Medium-severity bugs
   - Performance optimizations
   - Monitoring improvements

3. **Long-Term Fixes** (1-4 weeks):
   - Architecture improvements
   - Process improvements
   - Documentation updates

**Remediation Plan Template**:
```markdown
# Remediation Plan: Party Mode Rollback

**Incident ID**: INC-[YYYYMMDD]-001
**Plan Owner**: [Engineering Lead]
**Target Completion**: [YYYY-MM-DD]

## Immediate Fixes (< 24 hours)
- [ ] Fix 1: [Description] (Owner: [Name], Due: [Date])
- [ ] Fix 2: [Description] (Owner: [Name], Due: [Date])

## Short-Term Fixes (1-7 days)
- [ ] Fix 1: [Description] (Owner: [Name], Due: [Date])
- [ ] Fix 2: [Description] (Owner: [Name], Due: [Date])

## Long-Term Fixes (1-4 weeks)
- [ ] Fix 1: [Description] (Owner: [Name], Due: [Date])
- [ ] Fix 2: [Description] (Owner: [Name], Due: [Date])

## Process Improvements
- [ ] Monitoring: [Improvement]
- [ ] Testing: [Improvement]
- [ ] Deployment: [Improvement]
- [ ] Documentation: [Improvement]

## Verification
- [ ] All fixes tested in staging
- [ ] Penetration tests updated
- [ ] Monitoring alerts updated
- [ ] Documentation updated
- [ ] Security architect review
```

---

### Re-Deployment Decision

**Criteria for Re-Deployment**:

Must satisfy ALL of:
- [ ] Root cause identified and documented
- [ ] All immediate fixes implemented and tested
- [ ] All penetration tests passing
- [ ] Monitoring/alerts improved to detect issue earlier
- [ ] Security architect approval
- [ ] Engineering lead approval
- [ ] CTO approval (if Level 4 rollback)

**Re-Deployment Plan**:
1. **Staging Re-Deploy** (48 hours validation)
2. **Production Canary** (10%, 48 hours monitoring)
3. **Production Expanded** (50%, 7 days monitoring)
4. **Production Full** (100%, continuous monitoring)

**Do NOT re-deploy until**:
- All criteria met
- Stakeholder approval obtained
- Communication plan ready
- Rollback procedures tested

---

**Party Mode Rollback Version**: 1.0.0
**Last Updated**: 2026-01-28
**Rollback Status**: 4-level procedures documented and validated
