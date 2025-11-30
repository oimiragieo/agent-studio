# Command: /incident

Launch an incident response workflow for production issues.

## Usage

```
/incident                        # Start incident workflow
/incident --severity critical    # Specify severity
/incident "API is down"          # With incident description
```

## What This Command Does

Invokes the **incident-flow** workflow with this agent sequence:

1. **Incident Responder** - Rapid triage
   - Severity classification
   - Impact assessment
   - Affected users/services
   - Initial hypothesis
   - Communication plan
   - Immediate mitigation steps

2. **DevOps** - Infrastructure analysis
   - Log analysis
   - Metric correlation
   - Resource utilization
   - Deployment history
   - Configuration drift detection
   - Rollback assessment

3. **Security Architect** - Security assessment
   - Breach indicators
   - Vulnerability assessment
   - Attack vector analysis
   - Data exposure evaluation
   - Compliance impact
   - Forensic preservation

4. **QA** - Resolution validation
   - Fix verification
   - Regression testing
   - Service restoration confirmation
   - Root cause documentation
   - Prevention recommendations

## When to Use

- Production outages
- Security incidents
- Performance degradation
- Data issues
- Service disruptions
- Post-incident analysis

## Outputs

- `triage-assessment.json` - Initial assessment
- `immediate-actions.json` - Quick fixes
- `infrastructure-analysis.json` - Root cause
- `security-assessment.json` - Security evaluation
- `post-mortem.json` - Lessons learned

## Priority

This workflow is marked as **critical** and will be prioritized over other tasks.

## See Also

- `/review` - Post-incident code review
- `/code-quality` - Prevent future incidents
