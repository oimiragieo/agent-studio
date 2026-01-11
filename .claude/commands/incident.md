<command_description>
Command: /incident - Launch an incident response workflow for production issues.
</command_description>

<instructions>
<execution_steps>

```
/incident                        # Start incident workflow
/incident --severity critical    # Specify severity
/incident "API is down"          # With incident description
```

## What This Command Does

Invokes the **incident-flow** workflow with this agent sequence:

1. **Planner** (Step 0) - Incident response planning
   - Assess incident severity and scope
   - Create structured response plan
   - Coordinate response team activation
   - Generate plan artifacts

2. **Incident Responder** (Step 1) - Rapid triage
   - Severity classification
   - Impact assessment
   - Affected users/services
   - Initial hypothesis
   - Communication plan
   - Immediate mitigation steps

3. **DevOps** (Step 2) - Infrastructure analysis
   - Log analysis
   - Metric correlation
   - Resource utilization
   - Deployment history
   - Configuration drift detection
   - Rollback assessment

4. **Security Architect** (Step 3) - Security assessment
   - Breach indicators
   - Vulnerability assessment
   - Attack vector analysis
   - Data exposure evaluation
   - Compliance impact
   - Forensic preservation

5. **QA** (Step 4) - Resolution validation
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

</execution_steps>

<output_format>
**Outputs**:

- `triage-assessment.json` - Initial assessment
- `immediate-actions.json` - Quick fixes
- `infrastructure-analysis.json` - Root cause
- `security-assessment.json` - Security evaluation
- `post-mortem.json` - Lessons learned
  </output_format>
  </instructions>
