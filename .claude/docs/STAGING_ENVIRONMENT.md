# Staging Environment Guide

## Overview

The staging environment is a production-like environment for pre-production validation. It enables testing Phase 1A features (Knowledge Base, Cost Tracking, Advanced Elicitation) and Phase 1B+ features (Party Mode, Sidecar Memory) in a safe, isolated environment before production deployment.

## Key Features

- **Isolated Data**: Separate directories for all staging data (`.claude/staging/`)
- **Test Data Seeding**: Auto-populate with test artifacts and configuration
- **Relaxed Thresholds**: 2x more lenient monitoring thresholds than production
- **All Features Enabled**: Party Mode, Advanced Elicitation, and all Phase 1A features enabled by default
- **Verbose Logging**: Enhanced logging for troubleshooting
- **Environment Detection**: Automatic configuration based on `AGENT_STUDIO_ENV` variable

## Setup

### Prerequisites

- Node.js 18+ installed
- Agent-Studio project cloned
- All Phase 1A tests passing (29 tests)

### Step 1: Set Environment Variable

```bash
# Linux/macOS
export AGENT_STUDIO_ENV=staging

# Windows (PowerShell)
$env:AGENT_STUDIO_ENV = "staging"

# Windows (cmd)
set AGENT_STUDIO_ENV=staging
```

### Step 2: Initialize Staging Environment

```bash
node .claude/tools/cli/init-staging.cjs
```

**Output:**
```
╔════════════════════════════════════════════════════════════════╗
║       Agent-Studio Staging Environment Initialization          ║
╚════════════════════════════════════════════════════════════════╝

Environment: staging

Step 1: Creating staging directories...
✓ Created: C:\dev\projects\agent-studio\.claude\staging\knowledge
✓ Created: C:\dev\projects\agent-studio\.claude\staging\metrics
✓ Created: C:\dev\projects\agent-studio\.claude\staging\memory
✓ Created: C:\dev\projects\agent-studio\.claude\staging\agents
✓ Created: C:\dev\projects\agent-studio\.claude\staging\sessions
✓ Created: C:\dev\projects\agent-studio\.claude\staging\context

Step 2: Seeding test data...

✓ Copied KB index (XXX bytes)
✓ Created: learnings.md
✓ Created: decisions.md
✓ Created: issues.md
✓ Created: hooks.jsonl
✓ Created: agents.jsonl
✓ Created: errors.jsonl
✓ Created: llm-usage.log
✓ Created: session-log.jsonl
✓ Created: evolution-state.json

╔════════════════════════════════════════════════════════════════╗
║                   Staging Environment Ready!                    ║
╚════════════════════════════════════════════════════════════════╝

✓ Directory structure created
✓ Test data seeded
✓ Log files initialized

Next steps:
  1. Run smoke tests: npm run test:staging:smoke
  2. Run full test suite: AGENT_STUDIO_ENV=staging npm test
  3. Check monitoring: node .claude/tools/cli/monitor-dashboard.js --env staging
```

### Step 3: Run Smoke Tests

```bash
AGENT_STUDIO_ENV=staging node --test tests/staging-smoke.test.mjs
```

**Expected Output**: All 12 smoke tests passing in <2 seconds.

### Step 4: Run Full Test Suite

```bash
AGENT_STUDIO_ENV=staging npm test
```

**Expected Output**: All existing tests (29+) passing, no regressions.

## Environment Differences

| Feature | Development | Staging | Production |
|---------|-------------|---------|------------|
| **Feature Flags** | Selective | All enabled | Selective |
| **Test Data** | Minimal | Full seed data | Real data |
| **Logging** | Standard | Verbose | Standard |
| **Alerts** | Disabled | Relaxed thresholds | Strict thresholds |
| **Data Paths** | `.claude/` | `.claude/staging/` | `.claude/` |
| **Hook Execution Time** | Unlimited | 20ms | 10ms |
| **Agent Failure Rate** | Unlimited | 6% | 3% |
| **Error Rate/Hour** | Unlimited | 20 | 10 |

## Directory Structure

```
.claude/staging/
├── knowledge/
│   └── knowledge-base-index.csv  # Copy of production KB index
├── metrics/
│   ├── hooks.jsonl               # Hook execution metrics
│   ├── agents.jsonl              # Agent performance metrics
│   ├── errors.jsonl              # Error tracking
│   └── llm-usage.log             # Cost tracking log
├── memory/
│   ├── learnings.md              # Test learnings
│   ├── decisions.md              # Test decisions (ADRs)
│   └── issues.md                 # Test issues
├── agents/
│   └── (agent-specific history)
├── sessions/
│   └── session-log.jsonl         # Session history
└── context/
    ├── artifacts/                # Test artifacts
    └── evolution-state.json      # Evolution workflow state
```

## Configuration

Staging uses `.claude/config.staging.yaml`:

### Key Differences from Production

1. **All Features Enabled**:
   - `partyMode.enabled: true`
   - `advancedElicitation.enabled: true`
   - `knowledgeBase.enabled: true`
   - `costTracking.enabled: true`
   - `sidecarMemory.enabled: true`

2. **Relaxed Monitoring Thresholds**:
   - Hook execution: 20ms (prod: 10ms)
   - Agent failure rate: 6% (prod: 3%)
   - Error rate: 20/hour (prod: 10/hour)

3. **Verbose Logging**:
   - `monitoring.verboseLogging: true`
   - Dashboard refresh: 5s (prod: 10s)

4. **Test Data**:
   - `testData.enabled: true`
   - `testData.seedData: true`
   - `testData.artifactsCount: 1133`

## Testing Procedures

### Smoke Tests (2 minutes)

Quick validation that staging environment is operational:

```bash
AGENT_STUDIO_ENV=staging node --test tests/staging-smoke.test.mjs
```

**Tests**:
1. Environment detection (AGENT_STUDIO_ENV=staging)
2. Staging configuration exists
3. Staging directories exist
4. Log files initialized
5. Memory files exist
6. Evolution state exists
7. Environment path resolution
8. Config loader uses staging config
9. Feature flags enabled
10. Relaxed monitoring thresholds

### Full Test Suite (10 minutes)

Run all existing tests in staging mode:

```bash
AGENT_STUDIO_ENV=staging npm test
```

**Expected**: All 29+ tests passing, zero regressions.

### Manual Testing

1. **Knowledge Base Search**:
   ```bash
   AGENT_STUDIO_ENV=staging node .claude/tools/cli/kb-search.cjs --query "testing"
   ```

2. **Cost Tracking**:
   ```bash
   # Check that staging log file is used
   cat .claude/staging/metrics/llm-usage.log
   ```

3. **Monitoring Dashboard**:
   ```bash
   AGENT_STUDIO_ENV=staging node .claude/tools/cli/monitor-dashboard.js
   ```

## Deployment Checklist

### Pre-Deployment
- [ ] All tests passing (unit, integration, E2E)
- [ ] Performance benchmarks passing
- [ ] No open CRITICAL/HIGH issues
- [ ] Security review complete
- [ ] Documentation updated

### Deployment
- [ ] Set AGENT_STUDIO_ENV=staging
- [ ] Run `node .claude/tools/cli/init-staging.cjs`
- [ ] Verify `config.staging.yaml` loaded
- [ ] Run smoke tests
- [ ] Run full test suite

### Post-Deployment
- [ ] All features working
- [ ] Check monitoring dashboard
- [ ] Review error logs (should be empty)
- [ ] Run manual testing procedures
- [ ] Sign-off by QA + Security

### Promotion to Production
- [ ] Staging validation complete (24h minimum)
- [ ] No critical issues in staging
- [ ] User acceptance testing complete
- [ ] Rollback plan documented
- [ ] Production deployment checklist ready

## Rollback Procedures

### Level 1: Restart

```bash
# Stop all staging processes
# Delete staging directory
rm -rf .claude/staging

# Re-initialize
AGENT_STUDIO_ENV=staging node .claude/tools/cli/init-staging.cjs

# Re-run smoke tests
AGENT_STUDIO_ENV=staging node --test tests/staging-smoke.test.mjs
```

### Level 2: Revert Code

```bash
# Git revert to last known good commit
git revert HEAD

# Run Level 1 rollback
# Verify tests passing
```

### Level 3: Nuclear Option

```bash
# Delete staging directory
rm -rf .claude/staging

# Restore from backup (if exists)
# OR switch to development environment
export AGENT_STUDIO_ENV=development

# Investigate root cause before retry
```

## Troubleshooting

### Environment Not Detected

**Symptom**: Scripts/tests don't recognize staging environment

**Check**:
```bash
echo $AGENT_STUDIO_ENV  # Should output: staging
```

**Fix**:
```bash
export AGENT_STUDIO_ENV=staging  # Linux/macOS
$env:AGENT_STUDIO_ENV = "staging"  # Windows PowerShell
```

### Config Not Loaded

**Symptom**: Application uses default config instead of staging config

**Check**:
```bash
ls -la .claude/config.staging.yaml  # Should exist
```

**Fix**:
```bash
# Copy default config as template
cp .claude/config.yaml .claude/config.staging.yaml

# Modify for staging (relaxed thresholds, all features enabled)
```

### Staging Directories Missing

**Symptom**: `ENOENT` errors when accessing staging files

**Check**:
```bash
ls -la .claude/staging/  # Should exist with subdirectories
```

**Fix**:
```bash
AGENT_STUDIO_ENV=staging node .claude/tools/cli/init-staging.cjs
```

### Tests Failing in Staging

**Symptom**: Tests pass in development but fail in staging

**Check**:
```bash
# Verify environment variable is set
echo $AGENT_STUDIO_ENV

# Run tests with explicit environment
AGENT_STUDIO_ENV=staging npm test
```

**Fix**:
- Verify test data seeded correctly
- Check staging paths are used (not development paths)
- Review error logs: `.claude/staging/metrics/errors.jsonl`

### Feature Not Working in Staging

**Symptom**: Feature works in development but not in staging

**Check**:
```bash
# Verify feature flag enabled in staging config
grep "partyMode:" .claude/config.staging.yaml
```

**Fix**:
- Check `.claude/config.staging.yaml` has feature enabled
- Verify environment-specific paths correct
- Review verbose logs for clues

## Performance Expectations

| Metric | Development | Staging | Production |
|--------|-------------|---------|------------|
| **KB Search** | <50ms | <50ms | <50ms |
| **Cost Tracking Overhead** | <5ms | <5ms | <2ms |
| **Hook Execution** | Unlimited | <20ms | <10ms |
| **Test Suite Execution** | <5s | <5s | <5s |
| **Staging Initialization** | N/A | <10s | N/A |

## Security Considerations

- **Data Isolation**: Staging data stored separately (`.claude/staging/`)
- **No Production Data**: Staging never accesses production files
- **Test Secrets**: Use dummy/test credentials, never production secrets
- **Environment Validation**: Scripts verify `AGENT_STUDIO_ENV=staging` before proceeding

## Next Steps

After successful staging validation:

1. **24-Hour Burn-In**: Run staging for 24 hours, monitor for issues
2. **User Acceptance Testing**: Have QA/stakeholders test features in staging
3. **Performance Validation**: Compare staging metrics vs production targets
4. **Security Sign-Off**: Get security team approval
5. **Production Deployment**: Create production deployment plan

## Resources

- **Configuration**: `.claude/config.staging.yaml`
- **Initialization Script**: `.claude/tools/cli/init-staging.cjs`
- **Smoke Tests**: `tests/staging-smoke.test.mjs`
- **Environment Utils**: `.claude/lib/utils/environment.cjs`
- **Config Loader**: `.claude/lib/utils/config-loader.cjs`

## Support

For issues or questions:

1. Check troubleshooting section above
2. Review error logs: `.claude/staging/metrics/errors.jsonl`
3. Run smoke tests for quick diagnosis
4. Consult production hardening plan: `.claude/context/plans/production-hardening-plan-20260128.md`
