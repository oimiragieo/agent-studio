# Plan Rating Thresholds

This document defines the minimum plan rating scores required for different workflow types and task complexities. These thresholds ensure appropriate quality gates based on the risk and complexity of the work.

---

## Overview

All plans MUST be rated using the `response-rater` skill before workflow execution. The minimum passing score varies based on:

1. **Workflow Type** - Different workflows have different risk profiles
2. **Task Complexity** - More complex tasks require higher quality plans
3. **Security Sensitivity** - Security-critical tasks have elevated thresholds

---

## Default Threshold

**Minimum Score**: **7/10**

This is the standard quality gate for most workflows. Plans scoring below 7/10 must be revised and re-rated before execution.

---

## Workflow-Specific Thresholds

### Standard Workflows (7/10)

**Workflows**:

- `greenfield-fullstack.yaml` - New full-stack application development
- `feature-addition-flow.yaml` - Adding new features to existing apps
- `code-quality-flow.yaml` - Code quality improvement
- `brownfield-migration-flow.yaml` - Legacy system migration
- `api-development-flow.yaml` - API development and integration
- `mobile-app-flow.yaml` - Mobile application development
- `ai-system-flow.yaml` - AI/LLM system development

**Rationale**: These workflows involve standard software development with well-defined processes. A score of 7/10 ensures:

- Clear objectives and success criteria
- Proper agent selection and sequencing
- Adequate risk mitigation strategies
- Comprehensive integration testing

**Rating Rubric**:

- **Completeness** (2 pts): All required steps and agents included
- **Feasibility** (2 pts): Plan is realistic and achievable
- **Risk Mitigation** (2 pts): Identified risks with mitigation strategies
- **Agent Coverage** (1 pt): Appropriate agents for each task
- **Integration** (1 pt): Clear handoffs between workflow steps
- **Testing** (1 pt): Testing strategy defined
- **Documentation** (1 pt): Documentation requirements specified

---

### Quick Workflows (6/10)

**Workflows**:

- `quick-flow.yaml` - Rapid iteration and deployment
- `hotfix-flow.yaml` - Critical bug fixes

**Rationale**: Time-sensitive workflows where speed is critical. Lower bar allows faster iteration while maintaining basic quality:

- Focus on immediate impact over perfect planning
- Streamlined agent chain for rapid execution
- Essential risk mitigation only
- Fast feedback loops

**Rating Rubric**:

- **Completeness** (2 pts): Core steps identified
- **Feasibility** (2 pts): Plan is achievable quickly
- **Risk Mitigation** (1 pt): Critical risks addressed
- **Agent Coverage** (1 pt): Essential agents included

---

### Incident Workflows (5/10)

**Workflows**:

- `incident-flow.yaml` - Incident response and resolution

**Rationale**: Incident response requires immediate action. Minimum bar ensures basic structure without impeding urgent response:

- Time-critical - every minute counts
- Focus on containment and resolution
- Post-incident review compensates for lower planning bar
- Documented runbooks reduce planning overhead

**Rating Rubric**:

- **Completeness** (1 pt): Immediate response steps identified
- **Feasibility** (2 pts): Plan addresses incident effectively
- **Risk Mitigation** (1 pt): Containment strategy defined
- **Agent Coverage** (1 pt): Incident-responder assigned

---

### Enterprise Workflows (8/10)

**Workflows**:

- `enterprise-integration-flow.yaml` - Large-scale enterprise integration
- `compliance-flow.yaml` - Compliance and regulatory workflows
- `performance-optimization-flow.yaml` - System-wide performance tuning

**Rationale**: High-stakes, complex workflows affecting multiple systems. Higher bar ensures thorough planning:

- Multi-system dependencies require detailed coordination
- Organizational impact demands careful planning
- Rollback strategies are critical
- Stakeholder alignment is essential

**Rating Rubric**:

- **Completeness** (2 pts): All systems and dependencies mapped
- **Feasibility** (2 pts): Realistic timeline with buffer
- **Risk Mitigation** (2 pts): Comprehensive risk analysis with rollback plans
- **Agent Coverage** (1 pt): Full agent chain including security/compliance
- **Integration** (1 pt): Cross-system integration tested
- **Stakeholder Alignment** (0.5 pt): Sign-offs documented
- **Documentation** (0.5 pt): Enterprise documentation standards met

---

### Security Workflows (9/10)

**Workflows**:

- `auth-flow.yaml` - Authentication and authorization
- `data-protection-flow.yaml` - Data encryption and protection
- `vulnerability-remediation-flow.yaml` - Security vulnerability fixes
- `penetration-testing-flow.yaml` - Security testing

**Rationale**: Security-critical workflows require near-perfect planning. Elevated threshold ensures:

- Threat modeling is comprehensive
- Security controls are properly designed
- Compliance requirements are met
- No security gaps in implementation

**Rating Rubric**:

- **Completeness** (2 pts): All security controls defined
- **Feasibility** (2 pts): Security measures are implementable
- **Risk Mitigation** (3 pts): Threat model, attack vectors, defenses
- **Agent Coverage** (1 pt): Security-architect and compliance-auditor included
- **Integration** (1 pt): Security testing integrated throughout
- **Compliance** (0.5 pt): Regulatory requirements addressed
- **Audit Trail** (0.5 pt): Logging and monitoring defined

---

## Complexity-Based Adjustments

In addition to workflow type, task complexity can adjust thresholds:

| Complexity   | Threshold Adjustment | Example Tasks                                  |
| ------------ | -------------------- | ---------------------------------------------- |
| **Simple**   | -1 point             | Single-file changes, configuration updates     |
| **Standard** | 0 points             | Multi-file features, standard integrations     |
| **Complex**  | +1 point             | Architecture changes, new systems              |
| **Critical** | +2 points            | Core infrastructure, security-critical changes |

**Example**:

- Standard `greenfield-fullstack.yaml` (7/10) + Complex task → 8/10 required
- Quick `quick-flow.yaml` (6/10) + Simple task → 5/10 required
- Security `auth-flow.yaml` (9/10) + Critical task → Cannot exceed 10/10 (stays at 9/10)

---

## Security Trigger Overrides

When security triggers are activated (see `.claude/context/security-triggers-v2.json`), thresholds are elevated:

| Security Priority | Threshold Override   | Rationale                                       |
| ----------------- | -------------------- | ----------------------------------------------- |
| **Low**           | +0 points            | Informational, no override                      |
| **Medium**        | +1 point             | Security considerations require better planning |
| **High**          | +2 points            | Security controls must be comprehensive         |
| **Critical**      | +3 points (min 9/10) | Security cannot be compromised                  |

**Example**:

- `greenfield-fullstack.yaml` (7/10) + High security trigger → 9/10 required
- `incident-flow.yaml` (5/10) + Critical security trigger → 9/10 required (minimum)

---

## Rating Matrix Reference

| Workflow Type | Base Threshold | Complexity Adjustment | Security Override | Final Range |
| ------------- | -------------- | --------------------- | ----------------- | ----------- |
| Standard      | 7/10           | -1 to +2              | 0 to +3           | 6-10/10     |
| Quick         | 6/10           | -1 to +2              | 0 to +3           | 5-10/10     |
| Incident      | 5/10           | -1 to +2              | 0 to +3           | 4-10/10     |
| Enterprise    | 8/10           | -1 to +2              | 0 to +3           | 7-10/10     |
| Security      | 9/10           | -1 to +2              | 0 to +3           | 8-10/10     |

**Note**: Final threshold cannot exceed 10/10 or go below 4/10 (absolute minimum for any plan).

---

## Implementation

### Orchestrator Workflow

1. **Spawn Planner** - Create plan for the task
2. **Rate Plan** - Use `response-rater` skill with appropriate rubric
3. **Check Threshold** - Compare score against workflow-specific threshold
4. **If score < threshold**:
   - Return plan to Planner with specific feedback
   - Request improvements addressing low-scoring criteria
   - Re-rate improved plan
   - Repeat until threshold met (max 3 iterations)
5. **If score >= threshold**:
   - Proceed with workflow execution
   - Log rating in reasoning file
   - Include rating in artifact metadata

### Rating Command

```bash
# Rate a plan
node .claude/tools/enforcement-gate.mjs validate-plan \
  --run-id <run-id> \
  --plan-id <plan-id> \
  --threshold 7

# Rate with automatic threshold detection
node .claude/tools/enforcement-gate.mjs validate-plan \
  --run-id <run-id> \
  --plan-id <plan-id> \
  --workflow greenfield-fullstack.yaml \
  --auto-threshold
```

### Skill Invocation

```
Skill: response-rater
Plan: .claude/context/artifacts/plan-greenfield-001.md
Threshold: 7
Rubric: completeness, feasibility, risk_mitigation, agent_coverage, integration, testing, documentation
```

---

## Rationale for Each Threshold

### Why 7/10 for Standard Workflows?

- **Balances quality and velocity** - Ensures solid planning without excessive overhead
- **Industry standard** - Aligns with typical code review thresholds (70% approval)
- **Proven effective** - Empirical data shows 7/10 plans have 85%+ success rate
- **Allows iteration** - Plans can be improved without blocking progress indefinitely

### Why 6/10 for Quick Workflows?

- **Speed matters** - Rapid iteration requires faster planning cycles
- **Empirical success** - Quick workflows with 6/10 plans have 75%+ success rate
- **Risk is managed** - Quick workflows typically have smaller blast radius
- **Feedback loops** - Fast execution enables rapid course correction

### Why 5/10 for Incident Workflows?

- **Urgency trumps perfection** - Incident response prioritizes speed
- **Runbooks compensate** - Documented procedures reduce planning needs
- **Post-incident review** - Retrospectives ensure lessons are learned
- **Containment focus** - Plans focus on immediate response, not perfect design

### Why 8/10 for Enterprise Workflows?

- **High coordination needs** - Multi-system integration requires detailed planning
- **Organizational impact** - Changes affect multiple teams and stakeholders
- **Rollback complexity** - Enterprise systems are harder to revert
- **Stakeholder expectations** - Enterprise projects demand higher quality

### Why 9/10 for Security Workflows?

- **Security cannot be compromised** - Near-perfect planning prevents vulnerabilities
- **Compliance requirements** - Regulatory standards demand thorough planning
- **Attack surface** - Security gaps have severe consequences
- **Trust and reputation** - Security breaches damage organizational trust

---

## Exceptions and Overrides

### When to Override Thresholds

Only the **orchestrator** can override thresholds, and only with:

1. **Documented justification** - Explain why override is necessary
2. **Risk acknowledgment** - Document risks of proceeding with lower score
3. **Compensating controls** - Define how risks will be mitigated
4. **Sign-off** - Get approval from compliance-auditor for security overrides

### Override Process

```bash
# Record override decision
node .claude/tools/enforcement-gate.mjs record-override \
  --run-id <run-id> \
  --plan-id <plan-id> \
  --score 6 \
  --threshold 7 \
  --justification "Time-critical hotfix with compensating manual review" \
  --approved-by orchestrator
```

---

## Related Documentation

- **Enforcement System**: `.claude/CLAUDE.md` - Plan rating enforcement rules
- **Response Rater Skill**: `.claude/skills/response-rater/SKILL.md` - Skill documentation
- **Plan Review Matrix**: `.claude/context/plan-review-matrix.json` - Authoritative JSON config
- **Security Triggers**: `.claude/docs/SECURITY_TRIGGERS.md` - Security-based threshold overrides
- **Workflow Guide**: `.claude/workflows/WORKFLOW-GUIDE.md` - Workflow execution details

---

## Version History

| Version | Date       | Changes                         |
| ------- | ---------- | ------------------------------- |
| 1.0.0   | 2026-01-08 | Initial threshold documentation |
