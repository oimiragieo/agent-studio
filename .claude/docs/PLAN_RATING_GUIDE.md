# Plan Rating Guide

## Overview

Plan rating is a **mandatory** quality gate for all workflow executions in the LLM Rules Production Pack. Before any plan is executed, it must be rated using the `response-rater` skill and achieve a minimum score of **7/10** (or higher for enterprise/critical tasks).

### Why Plan Rating Matters

- **Quality Assurance**: Ensures plans are complete, feasible, and well-thought-out before execution
- **Risk Mitigation**: Identifies potential issues, gaps, and risks before implementation begins
- **Resource Optimization**: Prevents wasted effort on incomplete or infeasible plans
- **Agent Coverage**: Validates that appropriate agents are assigned to tasks
- **Integration Validation**: Ensures plan integrates properly with existing systems and workflows

### Response-Rater Integration

The `response-rater` skill provides independent, multi-AI validation of plan quality using:

- **Claude Code**: Primary validator with deep context understanding
- **Gemini CLI**: Secondary validator with different perspective
- **OpenAI Codex**: Optional tertiary validator for critical tasks

See `.claude/skills/response-rater/SKILL.md` for full skill documentation.

### Minimum Score Requirement

**Standard minimum**: **7/10** for all workflows

Higher thresholds apply for specific task types (see [Score Thresholds](#score-thresholds) below).

**Hard Requirement**: Plans scoring below minimum MUST NOT be executed without explicit human approval.

---

## Retry Logic

Plan rating follows a **3-attempt retry flow with escalation**:

### Attempt 1: Initial Rating

1. **Planner creates plan** → Saves `plan-{{workflow_id}}.json`
2. **Orchestrator invokes response-rater skill** → Rates plan using rubric
3. **Response-rater returns rating** → Includes rubric scores, summary, improvements, rewrite

**Decision Point**:

- **If score >= 7**: Proceed to workflow execution ✅
- **If score < 7**: Return to Planner with detailed feedback ⚠️

### Attempt 2: Planner Revision

1. **Orchestrator sends feedback to Planner** → Includes rubric scores, identified gaps, improvement suggestions
2. **Planner revises plan** → Addresses specific feedback, fills gaps, improves weak areas
3. **Orchestrator re-rates revised plan** → Response-rater evaluates improvements

**Decision Point**:

- **If score >= 7**: Proceed to workflow execution ✅
- **If score < 7**: Return to Planner for final revision ⚠️

### Attempt 3: Final Revision

1. **Orchestrator sends updated feedback to Planner** → Includes comparison with previous attempt
2. **Planner performs final revision** → Last chance to meet minimum score
3. **Orchestrator re-rates final plan** → Response-rater evaluates final version

**Decision Point**:

- **If score >= 7**: Proceed to workflow execution ✅
- **If score < 7**: Escalate to user for manual review 🚨

### Escalation to User

When all 3 attempts fail to achieve minimum score:

1. **Orchestrator presents options to user**:
   - **Option A**: Modify plan manually and re-submit for rating
   - **Option B**: Force-proceed with risk acknowledgment (requires explicit approval)
   - **Option C**: Cancel workflow execution

2. **If user chooses force-proceed**:
   - **Document risk**: Record in workflow reasoning file
   - **Log decision**: Save to `.claude/context/runs/<run_id>/force-proceed-{{workflow_id}}.json`
   - **Require acknowledgment**: User must explicitly acknowledge risks
   - **Heightened monitoring**: Flag workflow for close monitoring during execution

3. **If user chooses manual modification**:
   - User edits plan directly
   - Re-submit to orchestrator for rating (resets retry counter)

---

## Feedback Loop

### JSON Feedback Format

Response-rater returns structured feedback in this format:

```json
{
  "promptVersion": 3,
  "template": "plan-review",
  "authMode": "session-first",
  "providers": {
    "claude": {
      "ok": true,
      "authUsed": "session",
      "parsed": {
        "scores": {
          "completeness": 8,
          "feasibility": 7,
          "risk_mitigation": 6,
          "agent_coverage": 9,
          "integration": 7
        },
        "overall_score": 7.4,
        "summary": "Plan is generally solid with strong agent coverage and feasibility. Risk mitigation needs improvement, particularly around error handling and fallback strategies.",
        "improvements": [
          "Add explicit error handling strategy for each phase",
          "Define fallback agents for critical steps",
          "Include rollback procedures for failed steps",
          "Add monitoring and alerting requirements"
        ],
        "rewrite": "Improved plan with enhanced risk mitigation..."
      }
    },
    "gemini": { "ok": true, "..." }
  }
}
```

### Rubric Dimensions

Plans are evaluated on 5 key dimensions using the **Standard Plan Rating Rubric** (`.claude/context/artifacts/standard-plan-rubric.json`):

| Dimension           | Description                                        | Weight |
| ------------------- | -------------------------------------------------- | ------ |
| **completeness**    | All required information present, no gaps          | 20%    |
| **feasibility**     | Plan is realistic and achievable                   | 20%    |
| **risk_mitigation** | Risks identified and mitigation strategies defined | 20%    |
| **agent_coverage**  | Appropriate agents assigned to each task           | 20%    |
| **integration**     | Plan integrates properly with existing systems     | 20%    |

**Overall Score Calculation**: Weighted average of all 5 dimensions (equal weight).

**Rubric Location**: `.claude/context/artifacts/standard-plan-rubric.json`

**Schema Validation**: `.claude/schemas/plan-rubric.schema.json`

### How Planner Interprets Scores

**Completeness (8/10 or higher = good)**:

- All phases defined with clear inputs/outputs
- Dependencies mapped correctly
- Success criteria specified
- Timeline and milestones included

**Feasibility (7/10 or higher = good)**:

- Tasks are achievable with available resources
- Time estimates are realistic
- No impossible requirements
- Dependencies are manageable

**Risk Mitigation (6/10 or higher = acceptable, 8/10 = good)**:

- Risks identified for each phase
- Mitigation strategies defined
- Fallback plans exist
- Error handling considered

**Agent Coverage (8/10 or higher = good)**:

- Right agents assigned to right tasks
- No missing agent expertise
- Agent workload is balanced
- Handoffs are clear

**Integration (7/10 or higher = good)**:

- Plan fits with existing workflows
- No conflicts with other systems
- APIs and data flows defined
- Cross-team dependencies addressed

### Improvement Interpretation

Planner focuses on the `improvements` array to:

1. **Identify specific gaps**: What's missing or incomplete
2. **Prioritize fixes**: Which improvements have highest impact
3. **Revise plan**: Update plan to address each improvement
4. **Document changes**: Track what was changed and why

---

## Score Thresholds

Different task types require different minimum scores:

| Task Type      | Minimum Score | Rationale                                                   |
| -------------- | ------------- | ----------------------------------------------------------- |
| **Emergency**  | 5/10          | Speed over perfection; quick fixes, hotfixes                |
| **Standard**   | 7/10          | Balanced quality; features, enhancements, bug fixes         |
| **Enterprise** | 8/10          | High quality; enterprise features, integrations, migrations |
| **Critical**   | 9/10          | Mission critical; security, compliance, data protection     |

### Emergency Threshold (5/10)

**When to Use**: Incidents, production outages, critical hotfixes

**Justification**: Speed is paramount; plan can be refined during execution

**Requirements**:

- Document why emergency threshold is needed
- Post-mortem review after execution
- Retrospective plan improvement

**Example**: "Production down, need immediate fix"

### Standard Threshold (7/10)

**When to Use**: Regular development workflows (default)

**Justification**: Balance between quality and velocity

**Requirements**:

- All rubric dimensions >= 6/10
- No dimension below 5/10
- Overall score >= 7/10

**Example**: "Add new user profile feature"

### Enterprise Threshold (8/10)

**When to Use**: Enterprise integrations, multi-team projects, platform features

**Justification**: High-stakes work requiring strong planning

**Requirements**:

- All rubric dimensions >= 7/10
- Risk mitigation >= 8/10
- Agent coverage >= 8/10

**Example**: "Migrate authentication to SSO"

### Critical Threshold (9/10)

**When to Use**: Security, compliance, data protection, regulatory work

**Justification**: No room for error; plan must be near-perfect

**Requirements**:

- All rubric dimensions >= 8/10
- Risk mitigation = 10/10
- Agent coverage includes security-architect and compliance-auditor

**Example**: "Implement GDPR compliance"

---

## Provider Configuration

### Default Providers

By default, plan rating uses **2 providers** for consensus:

```javascript
--providers claude,gemini
```

- **Claude Code**: Primary validator (session-first auth)
- **Gemini CLI**: Secondary validator for different perspective

### Timeout Configuration

**Default timeout**: **180 seconds per provider** (3 minutes)

**Rationale**: Plan rating requires deep analysis; allow sufficient time

**Customization**: Increase for complex plans:

```bash
# For large, complex plans (e.g., enterprise migrations)
node .claude/skills/response-rater/scripts/rate.cjs \
  --response-file plan.json \
  --providers claude,gemini,codex \
  --timeout 300000  # 5 minutes per provider
```

### Failure Handling

**Scenario 1: One provider fails**

- **Action**: Continue with successful providers
- **Minimum**: Require at least 1 successful provider
- **Log**: Record failure in reasoning file

**Scenario 2: All providers fail**

- **Action**: Retry with exponential backoff (3 attempts)
- **If still failing**: Escalate to user
- **Options**: Manual review, skip rating (force-proceed), cancel workflow

**Scenario 3: Provider timeout**

- **Action**: Retry provider once
- **If timeout persists**: Skip provider, continue with others
- **Log**: Record timeout in reasoning file

**Scenario 4: Authentication failure**

- **Action**: Retry with environment-based auth (if available)
- **If auth still fails**: Skip provider, log error
- **Minimum**: Require at least 1 authenticated provider

---

## Workflow Integration for Plan Rating

### Step 0.1: Plan Rating Gate (Standard Pattern)

All workflows include a plan rating gate after planning:

```yaml
steps:
  - step: 0
    name: 'Planning Phase'
    agent: planner
    outputs:
      - plan-{{workflow_id}}.json

  - step: 0.1
    name: 'Plan Rating Gate'
    agent: orchestrator
    type: validation
    skill: response-rater
    inputs:
      - plan-{{workflow_id}}.json (from step 0)
    outputs:
      - .claude/context/runs/<run_id>/plans/<plan_id>-rating.json
      - reasoning: .claude/context/history/reasoning/{{workflow_id}}/00.1-orchestrator.json
    validation:
      minimum_score: 7
      rubric_file: .claude/context/artifacts/standard-plan-rubric.json
      gate: .claude/context/history/gates/{{workflow_id}}/00.1-orchestrator.json
    retry:
      max_attempts: 3
      on_failure: escalate_to_human
    description: |
      Rate plan quality using response-rater skill.
      - Rubric: completeness, feasibility, risk mitigation, agent coverage, integration
      - Minimum passing score: 7/10
      - If score < 7: Return to Planner with feedback, request improvements, re-rate
      - If score >= 7: Proceed with workflow execution
```

### Orchestrator Responsibilities

1. **After Planner completes**:
   - Read `plan-{{workflow_id}}.json` from artifacts
   - Invoke `response-rater` skill with plan content
   - Wait for rating results (up to 180s per provider)

2. **Process rating results**:
   - Extract overall score and rubric scores
   - Save rating to `.claude/context/runs/<run_id>/plans/<plan_id>-rating.json`
   - Document rating in reasoning file

3. **Decision logic**:

   ```javascript
   if (overall_score >= minimum_score) {
     // Proceed to next step
     log('Plan rating passed', overall_score);
     saveRating(ratingPath, rating);
     return { allowed: true };
   } else {
     // Return to Planner with feedback
     log('Plan rating failed', overall_score, '< minimum', minimum_score);
     sendFeedbackToPlanner(rating.improvements);
     incrementRetryCounter();
     if (retryCounter >= 3) {
       escalateToUser(rating);
     }
     return { allowed: false, feedback: rating.improvements };
   }
   ```

4. **Retry handling**:
   - Track retry counter in run state (`.claude/context/runs/<run_id>/state.json`)
   - Increment counter after each failed rating
   - Reset counter after successful rating
   - Escalate to user after 3 failed attempts

### Rating File Location

**Standard path**: `.claude/context/runs/<run_id>/plans/<plan_id>-rating.json`

**Example**: `.claude/context/runs/run-001/plans/plan-greenfield-2025-01-06-rating.json`

**Format**:

```json
{
  "plan_id": "plan-greenfield-2025-01-06",
  "run_id": "run-001",
  "workflow_id": "workflow-123",
  "timestamp": "2025-01-06T10:30:00Z",
  "overall_score": 7.4,
  "rubric_scores": {
    "completeness": 8,
    "feasibility": 7,
    "risk_mitigation": 6,
    "agent_coverage": 9,
    "integration": 7
  },
  "summary": "Plan is generally solid...",
  "improvements": ["Add error handling", "..."],
  "providers_used": ["claude", "gemini"],
  "retry_attempt": 1,
  "passed": true
}
```

---

## CLI Usage Examples

### Rate a Plan (Orchestrator)

```bash
# Standard plan rating
node .claude/skills/response-rater/scripts/rate.cjs \
  --response-file .claude/context/artifacts/plan-greenfield-2025-01-06.json \
  --providers claude,gemini \
  --template plan-review

# Enterprise plan rating (3 providers, higher timeout)
node .claude/skills/response-rater/scripts/rate.cjs \
  --response-file .claude/context/artifacts/plan-enterprise-migration.json \
  --providers claude,gemini,codex \
  --template plan-review \
  --timeout 300000

# Critical plan rating (all providers, maximum timeout)
node .claude/skills/response-rater/scripts/rate.cjs \
  --response-file .claude/context/artifacts/plan-security-audit.json \
  --providers claude,gemini,codex,cursor,copilot \
  --template plan-review \
  --timeout 600000
```

### Validate Plan Rating

```bash
# Check if plan meets minimum score
node .claude/tools/enforcement-gate.mjs validate-plan \
  --run-id run-001 \
  --plan-id plan-greenfield-2025-01-06 \
  --minimum-score 7

# Output: { allowed: true, score: 7.4, passed: true }
```

---

## Troubleshooting

### Plan Consistently Scores Below Threshold

**Problem**: Plan fails rating 3 times in a row

**Root Causes**:

1. Incomplete requirements (missing inputs)
2. Unrealistic scope (too ambitious)
3. Missing risk mitigation (no error handling)
4. Wrong agents assigned (skill mismatch)
5. Poor integration planning (conflicts with existing systems)

**Solutions**:

- Review `improvements` array from rating feedback
- Break plan into smaller, more focused phases
- Add explicit error handling and fallback strategies
- Reassign agents to better match task requirements
- Define clearer integration points and APIs

### Provider Timeout

**Problem**: Response-rater times out waiting for provider

**Root Causes**:

1. Plan file too large (> 10,000 lines)
2. Network connectivity issues
3. Provider service unavailable
4. Authentication expired

**Solutions**:

- Increase timeout: `--timeout 300000` (5 minutes)
- Split large plans into smaller sections
- Retry with different provider: `--providers gemini` (skip Claude)
- Check authentication: `claude --version` (verify login)

### Authentication Failure

**Problem**: All providers fail authentication

**Root Causes**:

1. No active session (not logged in)
2. No environment variables set
3. API keys expired

**Solutions**:

- Login to Claude Code: `claude login`
- Set environment variables: `export ANTHROPIC_API_KEY=...`
- Verify auth: `claude --auth-status`

---

## Best Practices

### For Orchestrators

1. **Always rate plans** - Never skip plan rating (hard requirement)
2. **Use 2+ providers** - Get consensus from multiple AIs
3. **Save ratings** - Persist to standard path for audit trail
4. **Log decisions** - Document rating results in reasoning file
5. **Escalate failures** - Don't force-proceed without user approval

### For Planners

1. **Anticipate rating criteria** - Design plans to score well on rubric
2. **Address feedback** - Carefully review `improvements` array
3. **Iterate quickly** - 3 attempts to reach minimum score
4. **Document changes** - Track what was improved and why
5. **Learn from ratings** - Use feedback to improve future plans

### For Workflows

1. **Include rating gate** - All workflows need Step 0.1
2. **Set appropriate threshold** - Match threshold to task type
3. **Configure retry logic** - 3 attempts, escalate to human
4. **Document requirements** - Specify rubric file and minimum score

---

## Custom Rubrics

The Standard Plan Rating Rubric can be customized for specialized workflows or task types.

### Creating Custom Rubrics

**Location**: `.claude/context/artifacts/custom-rubrics/`

**Steps**:

1. Copy `standard-plan-rubric.json` as a template
2. Modify dimensions, weights, or scoring criteria
3. Validate against schema: `node .claude/tools/enforcement-gate.mjs validate-rubric --rubric-file <custom-rubric.json>`
4. Reference in workflow or rating invocation

**Example Custom Rubric** (`.claude/context/artifacts/custom-rubrics/security-plan-rubric.json`):

```json
{
  "version": "1.0.0",
  "name": "Security Plan Rating Rubric",
  "description": "Specialized rubric for security-critical plans",
  "minimum_score": 9,
  "dimensions": [
    {
      "name": "completeness",
      "weight": 0.15,
      "description": "All required information present, no gaps",
      "scoring": { "..." }
    },
    {
      "name": "feasibility",
      "weight": 0.15,
      "description": "Plan is realistic and achievable",
      "scoring": { "..." }
    },
    {
      "name": "risk_mitigation",
      "weight": 0.30,
      "description": "Risks identified and mitigation strategies defined",
      "scoring": { "..." }
    },
    {
      "name": "security_coverage",
      "weight": 0.25,
      "description": "Security requirements fully addressed",
      "scoring": { "..." }
    },
    {
      "name": "compliance",
      "weight": 0.15,
      "description": "Plan meets compliance requirements",
      "scoring": { "..." }
    }
  ],
  "thresholds": {
    "emergency": 7,
    "standard": 9,
    "enterprise": 9,
    "critical": 10
  }
}
```

### Using Custom Rubrics

**In Workflows**:

```yaml
- step: 0.1
  name: 'Plan Rating Gate'
  agent: orchestrator
  type: validation
  skill: response-rater
  validation:
    minimum_score: 9
    rubric_file: .claude/context/artifacts/custom-rubrics/security-plan-rubric.json
```

**In CLI**:

```bash
node .claude/skills/response-rater/scripts/rate.cjs \
  --response-file plan.json \
  --rubric-file .claude/context/artifacts/custom-rubrics/security-plan-rubric.json \
  --template plan-review
```

### Custom Rubric Guidelines

1. **Dimension Weights Must Sum to 1.0**: All dimension weights must add up to exactly 1.0
2. **Scoring Ranges**: Use consistent scoring ranges (e.g., 1-3, 4-6, 7-8, 9-10)
3. **Clear Descriptions**: Each dimension and scoring range should have clear, actionable descriptions
4. **Validate Against Schema**: Always validate custom rubrics against `.claude/schemas/plan-rubric.schema.json`
5. **Document Rationale**: Include metadata explaining why custom rubric is needed

### When to Use Custom Rubrics

- **Security/Compliance Tasks**: Emphasize risk mitigation and security coverage
- **Performance-Critical Tasks**: Add performance dimension with higher weight
- **UI/UX Tasks**: Add usability dimension with higher weight
- **AI/LLM Tasks**: Add model quality and prompt engineering dimensions
- **Infrastructure Tasks**: Add scalability and reliability dimensions

---

## References

- **Response-Rater Skill**: `.claude/skills/response-rater/SKILL.md`
- **Enforcement Gate**: `.claude/tools/enforcement-gate.mjs`
- **Plan Review Matrix**: `.claude/context/plan-review-matrix.json`
- **Standard Plan Rubric**: `.claude/context/artifacts/standard-plan-rubric.json`
- **Plan Rubric Schema**: `.claude/schemas/plan-rubric.schema.json`
- **Workflow Guide**: `.claude/workflows/WORKFLOW-GUIDE.md`
- **CLAUDE.md**: `.claude/CLAUDE.md` (Plan Rating Enforcement section)
