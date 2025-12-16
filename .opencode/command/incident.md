# /incident

Launch an incident response workflow for production issues.

## Usage

```
/incident                        # Start incident workflow
/incident "API is down"          # With incident description
```

## Workflow

This command coordinates multiple agents for incident response:

### 1. Incident Responder
- Severity classification
- Impact assessment
- Affected users/services
- Initial hypothesis
- Communication plan
- Immediate mitigation steps

### 2. DevOps
- Log analysis
- Metric correlation
- Resource utilization
- Deployment history
- Configuration drift detection
- Rollback assessment

### 3. Security Architect
- Breach indicators
- Vulnerability assessment
- Attack vector analysis
- Data exposure evaluation
- Compliance impact

### 4. QA
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

## Priority

This workflow is marked as **critical** and will be prioritized over other tasks.

## Expected Outputs

- Initial triage assessment
- Immediate action items
- Root cause analysis
- Security evaluation
- Post-mortem / lessons learned

## See Also

- `/review` - Post-incident code review
- `/code-quality` - Prevent future incidents
