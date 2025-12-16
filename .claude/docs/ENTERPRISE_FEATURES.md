# Enterprise Features Reference

Quick reference guide for all enterprise-ready features in LLM-RULES.

## Quick Start

### Cost Tracking
```bash
# View cost report
node .claude/tools/cost-tracker.mjs report

# Get cost stats for specific agent
node .claude/tools/cost-tracker.mjs stats developer 30

# Get cost forecast
node .claude/tools/cost-tracker.mjs forecast 30
```

### Session Management
```bash
# Create new session
node .claude/tools/session-manager.mjs create developer

# List active sessions
node .claude/tools/session-manager.mjs list

# Get session details
node .claude/tools/session-manager.mjs get <session-id>

# Close session
node .claude/tools/session-manager.mjs close <session-id> "completed"
```

### Guardrails
```bash
# Check prompt for issues
node .claude/tools/guardrails-enforcer.mjs check "<prompt>"

# Check for jailbreak attempts
node .claude/tools/guardrails-enforcer.mjs jailbreak "<prompt>"

# Check command latency
node .claude/tools/guardrails-enforcer.mjs latency "<command>"
```

### Testing & Evaluation
```bash
# Define evaluation criteria
node .claude/tools/eval-framework.mjs define "code-quality" '<criteria-json>'

# Run evaluation
node .claude/tools/eval-framework.mjs run "code-quality" '<test-case-json>'

# Generate report
node .claude/tools/eval-framework.mjs report "code-quality" 7
```

### Analytics
```bash
# Track event
node .claude/tools/analytics-api.mjs track "agent_activation" '{"agent":"developer"}'

# Get usage stats
node .claude/tools/analytics-api.mjs stats 7d developer

# Get agent metrics
node .claude/tools/analytics-api.mjs metrics developer 7d

# Generate report
node .claude/tools/analytics-api.mjs report 7d
```

### Commit Validation
```bash
# Validate commit message
echo "feat(auth): add OAuth2 support" | node .claude/tools/validate-commit.mjs

# Or directly
node .claude/tools/validate-commit.mjs "feat(auth): add OAuth2 support"
```

### Context Monitoring
```bash
# Generate context usage report
node .claude/tools/context-monitor.mjs report

# Get stats for agent
node .claude/tools/context-monitor.mjs stats developer 7
```

### Subagent Context Loading
```bash
# Load agent context
node .claude/tools/subagent-context-loader.mjs load developer

# Unload agent context
node .claude/tools/subagent-context-loader.mjs unload developer

# List agents with context
node .claude/tools/subagent-context-loader.mjs list
```

## Integration Examples

### Pre-Commit Hook
```bash
#!/bin/bash
# .git/hooks/pre-commit

commit_msg=$(git log -1 --pretty=%B)
if ! echo "$commit_msg" | node .claude/tools/validate-commit.mjs; then
  echo "❌ Commit message validation failed"
  exit 1
fi
```

### CI/CD Integration
```yaml
# .github/workflows/validate.yml
name: Validate Commits
on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Validate commit messages
        run: |
          git log origin/main..HEAD --pretty=%B | while read msg; do
            echo "$msg" | node .claude/tools/validate-commit.mjs || exit 1
          done
```

### Cost Monitoring Alert
```javascript
// Example: Alert when daily cost exceeds threshold
import { getCostStats } from './.claude/tools/cost-tracker.mjs';

const stats = getCostStats(null, null, 1); // Last 24 hours
if (stats.totalCost > 50) {
  console.error('⚠️ Daily cost exceeds $50 threshold');
  // Send alert via email/Slack/etc.
}
```

### Session Cleanup Cron Job
```bash
#!/bin/bash
# Run daily to clean up old sessions

node .claude/tools/session-manager.mjs cleanup
```

## Configuration

### Enable Cost Tracking
```yaml
# .claude/config.yaml
cost_tracking:
  enabled: true
  record_interval: 100  # Record every 100 tool calls
  alert_threshold: 0.8  # Alert at 80% of budget
```

### Configure Guardrails
```yaml
# .claude/config.yaml
guardrails:
  latency:
    max_tool_execution_time: 30000
    blocked_commands:
      - "npm run dev"
      - "docker build"
  
  hallucinations:
    require_source_citation: true
  
  jailbreaks:
    enabled: true
    strict_mode: true
```

### Analytics Configuration
```yaml
# .claude/config.yaml
analytics:
  enabled: true
  events:
    - agent_activation
    - tool_use
    - session_start
    - session_end
  retention_days: 90
```

## Best Practices

### Cost Optimization
1. Monitor costs daily
2. Use haiku for simple tasks
3. Optimize context usage
4. Cache frequently used rules
5. Review cost forecasts weekly

### Session Management
1. Close sessions when done
2. Clean up old sessions regularly
3. Track session metrics
4. Monitor session duration
5. Archive important sessions

### Guardrails
1. Enable all guardrails in production
2. Review guardrail alerts regularly
3. Update patterns as needed
4. Test guardrails in staging
5. Document exceptions

### Testing
1. Define clear success criteria
2. Run evaluations regularly
3. Track trends over time
4. Act on recommendations
5. Update criteria as project evolves

## Troubleshooting

### Cost Tracking Not Working
- Check file permissions on `.claude/context/history/`
- Verify cost tracking is enabled in config
- Check for errors in console

### Sessions Not Persisting
- Verify `.claude/context/sessions/` directory exists
- Check file permissions
- Review session manager logs

### Guardrails Blocking Valid Commands
- Review guardrail patterns
- Add exceptions in config
- Test in staging first

### Analytics Not Recording
- Verify analytics is enabled
- Check `.claude/context/analytics/` directory
- Review event tracking code

## Support

For issues or questions:
1. Check documentation in `.claude/docs/`
2. Review implementation summary: `IMPLEMENTATION_SUMMARY.md`
3. Check enterprise deployment guide: `ENTERPRISE_DEPLOYMENT.md`
4. Review context optimization guide: `CONTEXT_OPTIMIZATION.md`

