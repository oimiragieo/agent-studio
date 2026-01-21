# A2A Test Framework: Comprehensive Test Plan

## Document metadata

| Field           | Value                     |
| --------------- | ------------------------- |
| Version         | 1.0.0                     |
| Status          | Active                    |
| Author          | Winston (Architect Agent) |
| Created         | 2026-01-16                |
| Test Categories | 6                         |
| Total Scenarios | 22                        |
| P0 Scenarios    | 10                        |
| P1 Scenarios    | 12                        |

---

## Overview

This test plan defines all test scenarios for validating Agent-to-Agent (A2A) communication patterns across the orchestration system. Scenarios are organized by category and priority.

### Priority definitions

| Priority | Description                           | Execution  | Blocking   |
| -------- | ------------------------------------- | ---------- | ---------- |
| P0       | Critical path - must pass for release | Every PR   | Yes        |
| P1       | Important - should pass for release   | Daily + PR | Soft block |
| P2       | Nice to have - informational          | Weekly     | No         |

### Category summary

| Category              | P0  | P1  | Total | Description                                |
| --------------------- | --- | --- | ----- | ------------------------------------------ |
| Agent Chain           | 2   | 2   | 4     | Sequential agent delegation patterns       |
| Template Enforcement  | 3   | 2   | 5     | Task template validation and blocking      |
| Security Trigger      | 2   | 2   | 4     | Security keyword detection and suggestions |
| Verification Protocol | 2   | 2   | 4     | Post-delegation verification steps         |
| Workflow Execution    | 1   | 2   | 3     | Full workflow integration                  |
| Complex Graph         | 0   | 2   | 2     | Multi-agent parallel patterns              |

---

## Category 1: Agent chain scenarios

### a2a-chain-001: Simple 2-agent chain (P0)

**Objective**: Validate that a simple developer to code-reviewer chain passes artifacts correctly.

**Preconditions**:

- No existing run state
- Hooks enabled

**Steps**:

1. Simulate Task delegation to developer agent with valid task template
2. Inject mock developer response with deliverable artifact
3. Simulate Task delegation to code-reviewer with developer output
4. Verify code-reviewer receives correct input

**Expected Results**:

- Both delegations pass template validation
- Developer output is available to code-reviewer
- No hook blocks occur
- Verification passes with PASS verdict

**Success Criteria**:

- Hook decision = "approve" for both delegations
- Artifact path exists after developer step
- code-reviewer input contains developer deliverable path

**Test Data**:

```json
{
  "developer_task": {
    "task_id": "test-chain-001-dev",
    "objective": "Create a simple utility function",
    "context": {
      "problem": "Need a string formatting utility",
      "why_now": "Required for feature development"
    },
    "deliverables": [
      {
        "type": "file",
        "path": ".claude/context/tmp/test-chain-001/utility.mjs",
        "description": "Utility function implementation",
        "format": "javascript"
      }
    ],
    "constraints": { "max_time_minutes": 10 },
    "success_criteria": ["Function implemented", "No syntax errors"],
    "verification": {
      "verification_type": "static",
      "required_tests": [
        { "test_name": "lint", "command_or_action": "eslint", "expected_outcome": "No errors" }
      ],
      "passing_criteria": { "errors_allowed": 0, "tests_passed_minimum": "100%" },
      "evidence_required": true
    },
    "assigned_agent": "developer"
  }
}
```

---

### a2a-chain-002: 3-agent chain with architect (P0)

**Objective**: Validate architect to developer to qa chain with proper artifact flow.

**Preconditions**:

- Clean test environment
- All three agents available

**Steps**:

1. Architect creates design document
2. Developer implements based on design
3. QA validates implementation
4. Verify each agent receives correct predecessor output

**Expected Results**:

- All three delegations pass
- Design artifact flows to developer
- Implementation artifact flows to QA
- QA produces validation report

**Success Criteria**:

- 3 successful delegations
- Artifact chain maintained: design.md -> implementation.mjs -> qa-report.json
- No verification failures

---

### a2a-chain-003: Chain with rejection and retry (P1)

**Objective**: Validate that when code-reviewer rejects, developer receives feedback and retries.

**Preconditions**:

- Developer task with minor issue
- code-reviewer configured to reject first attempt

**Steps**:

1. Developer creates implementation with intentional issue
2. code-reviewer rejects with specific feedback
3. Verification hook detects CONCERNS verdict
4. Developer receives feedback and fixes
5. code-reviewer approves on second attempt

**Expected Results**:

- First code-review returns CONCERNS
- Feedback is propagated to developer
- Second attempt passes
- Full chain completes successfully

**Success Criteria**:

- Verification hook correctly identifies rejection
- Retry mechanism triggers
- Final verdict is PASS

---

### a2a-chain-004: Chain with security agent injection (P1)

**Objective**: Validate that security-architect is automatically suggested when security keywords detected.

**Preconditions**:

- Task contains "authentication" keyword
- security-trigger hook enabled

**Steps**:

1. Submit developer task with authentication objective
2. Verify security trigger hook provides suggestion
3. Add security-architect to chain
4. Complete full security-aware chain

**Expected Results**:

- Security trigger hook detects "authentication"
- Suggestion includes security-architect
- Full chain completes with security review

**Success Criteria**:

- Hook metadata includes `security_triggers_detected: 1`
- Recommended agents includes "security-architect"
- Security review artifact produced

---

## Category 2: Template enforcement scenarios

### a2a-template-001: Block freeform text prompt (P0)

**Objective**: Verify that freeform text prompts are blocked by template enforcer.

**Preconditions**:

- Template enforcer hook enabled
- No previous task state

**Steps**:

1. Attempt Task delegation with freeform prompt: "implement the login feature"
2. Capture hook response

**Expected Results**:

- Hook returns decision: "block"
- Reason contains "AGENT TASK TEMPLATE VIOLATION"
- Missing fields listed in error message

**Success Criteria**:

- decision = "block"
- reason contains all required fields: task_id, objective, context, deliverables, constraints, success_criteria, verification, assigned_agent

**Test Data**:

```json
{
  "tool_name": "Task",
  "tool_input": {
    "prompt": "implement the login feature"
  }
}
```

---

### a2a-template-002: Block partial JSON (missing verification) (P0)

**Objective**: Verify that partial JSON missing verification field is blocked.

**Preconditions**:

- Template enforcer hook enabled

**Steps**:

1. Submit task with all fields except verification
2. Capture hook response

**Expected Results**:

- Hook returns decision: "block"
- Missing field: verification
- Error message guides to correct format

**Success Criteria**:

- decision = "block"
- missingFields includes "verification"

**Test Data**:

```json
{
  "task_id": "test-partial-001",
  "objective": "Create a test file",
  "context": {
    "problem": "Need test coverage",
    "why_now": "PR requirement"
  },
  "deliverables": [
    {
      "type": "file",
      "path": ".claude/context/tmp/test.mjs",
      "description": "Test file"
    }
  ],
  "constraints": { "max_time_minutes": 10 },
  "success_criteria": ["Tests created"],
  "assigned_agent": "developer"
}
```

---

### a2a-template-003: Block invalid JSON syntax (P0)

**Objective**: Verify that malformed JSON is blocked with helpful error.

**Preconditions**:

- Template enforcer hook enabled

**Steps**:

1. Submit task with invalid JSON (trailing comma, missing quotes)
2. Capture hook response

**Expected Results**:

- Hook returns decision: "block"
- Reason indicates JSON parsing error
- Helpful guidance provided

**Success Criteria**:

- decision = "block"
- error contains JSON parse error message

**Test Data**:

```
{
  "task_id": "test-invalid-001",
  "objective": "Create something",
}
```

---

### a2a-template-004: Allow valid complete template (P1)

**Objective**: Verify that valid complete template is allowed.

**Preconditions**:

- Template enforcer hook enabled

**Steps**:

1. Submit fully valid task template
2. Capture hook response

**Expected Results**:

- Hook returns decision: "approve"
- No missing fields warning
- Optimization fields check passes (if all present)

**Success Criteria**:

- decision = "approve"
- hasOptimizations = true (if all optional fields present)

**Test Data**: Full agent-task.schema.json compliant task with all fields.

---

### a2a-template-005: Allow with missing optimization fields (warn) (P1)

**Objective**: Verify that missing optimization fields produce warning but approve.

**Preconditions**:

- Template enforcer hook enabled

**Steps**:

1. Submit valid task with required fields but missing optimization fields (examples, reasoning_style)
2. Capture hook response and stderr

**Expected Results**:

- Hook returns decision: "approve"
- Warning logged about missing optimization fields
- stderr contains optimization guidance

**Success Criteria**:

- decision = "approve"
- missingOptimizations includes "examples", "reasoning_style"
- stderr contains warning message

---

## Category 3: Security trigger scenarios

### a2a-security-001: Detect authentication keywords (P0)

**Objective**: Verify that authentication-related keywords trigger security suggestions.

**Preconditions**:

- Security trigger hook enabled
- security-triggers-v2.json loaded

**Steps**:

1. Submit task with "implement user authentication" objective
2. Capture hook response

**Expected Results**:

- Hook returns decision: "approve" (non-blocking)
- Suggestion includes security-architect recommendation
- Triggered categories include "authentication"
- Priority level appropriate

**Success Criteria**:

- decision = "approve"
- metadata.security_triggers_detected >= 1
- metadata.recommended_agents includes "security-architect"

**Test Data**:

```json
{
  "task_id": "test-auth-001",
  "objective": "Implement user authentication with JWT tokens",
  "context": {
    "problem": "Need secure authentication",
    "why_now": "Security requirement"
  },
  "deliverables": [...],
  "assigned_agent": "developer"
}
```

---

### a2a-security-002: Detect multiple security categories (P0)

**Objective**: Verify that multiple security keywords in different categories are detected.

**Preconditions**:

- Security trigger hook enabled

**Steps**:

1. Submit task mentioning "authentication", "encryption", and "API keys"
2. Capture hook response

**Expected Results**:

- Multiple categories triggered
- Combined priority escalation (if applicable)
- All required agents listed

**Success Criteria**:

- metadata.categories.length >= 2
- highest_priority reflects escalation rules
- All category-specific agents recommended

---

### a2a-security-003: No trigger on non-security task (P1)

**Objective**: Verify that non-security tasks do not trigger security suggestions.

**Preconditions**:

- Security trigger hook enabled

**Steps**:

1. Submit task about "create button component" (no security keywords)
2. Capture hook response

**Expected Results**:

- Hook returns decision: "approve"
- No security suggestions
- metadata.security_triggers_detected = 0

**Success Criteria**:

- decision = "approve"
- No suggestion field in response
- metadata.security_triggers_detected = 0 or undefined

---

### a2a-security-004: Security-architect already included (P1)

**Objective**: Verify that no suggestion appears when security-architect already assigned.

**Preconditions**:

- Security trigger hook enabled

**Steps**:

1. Submit task with "authentication" keyword
2. Include "security-architect" in assigned_agent or required_agents
3. Capture hook response

**Expected Results**:

- Hook returns decision: "approve"
- No suggestion (security already covered)
- Clean response without redundant recommendations

**Success Criteria**:

- decision = "approve"
- No suggestion field (security covered)

---

## Category 4: Verification protocol scenarios

### a2a-verify-001: Detect errors in agent output (P0)

**Objective**: Verify that post-delegation hook detects error keywords in output.

**Preconditions**:

- Post-delegation verifier hook enabled

**Steps**:

1. Simulate Task completion with output containing "error: failed to compile"
2. Run post-delegation verifier

**Expected Results**:

- Hook identifies error keywords
- Verification result includes errors
- Verdict is FAIL or CONCERNS

**Success Criteria**:

- verification_steps.step1_errors.found.length > 0
- verification_verdict = "FAIL" or "CONCERNS"
- errors array contains error details

**Test Data**:

```json
{
  "tool_name": "Task",
  "tool_input": {...},
  "tool_result": {
    "content": "Attempted to create file but error: failed to compile the TypeScript."
  }
}
```

---

### a2a-verify-002: Verify deliverables exist (P0)

**Objective**: Verify that post-delegation hook checks deliverable existence.

**Preconditions**:

- Post-delegation verifier hook enabled
- Test fixtures in place

**Steps**:

1. Create task with deliverable path: ".claude/context/tmp/test-verify/output.json"
2. Do NOT create the file
3. Run post-delegation verifier

**Expected Results**:

- Hook detects missing deliverable
- verification_steps.step3_deliverables.missing includes path
- Verdict reflects missing deliverable

**Success Criteria**:

- deliverables_status includes entry with exists: false
- verification_verdict = "FAIL"
- errors includes "Deliverable not found"

---

### a2a-verify-003: Extract agent verdict from output (P1)

**Objective**: Verify that post-delegation hook extracts explicit verdict from agent output.

**Preconditions**:

- Post-delegation verifier hook enabled

**Steps**:

1. Simulate Task completion with output containing "Verdict: PASS"
2. Run post-delegation verifier

**Expected Results**:

- Hook extracts verdict
- verification_steps.step5_verdict.agent_verdict = "PASS"
- Final verdict aligns with agent verdict

**Success Criteria**:

- step5_verdict.checked = true
- step5_verdict.agent_verdict = "PASS"
- verification_verdict = "PASS"

---

### a2a-verify-004: Handle clean output (no errors/warnings) (P1)

**Objective**: Verify that clean agent output produces PASS verdict.

**Preconditions**:

- Post-delegation verifier hook enabled
- Deliverable exists

**Steps**:

1. Create task with deliverable path
2. Create the deliverable file with content
3. Simulate Task completion with clean output
4. Run post-delegation verifier

**Expected Results**:

- No errors detected
- No warnings detected
- Deliverables verified
- Verdict is PASS

**Success Criteria**:

- errors.length = 0
- warnings.length = 0
- verification_verdict = "PASS"
- verification_passed = true

---

## Category 5: Workflow execution scenarios

### a2a-workflow-001: Execute code-review workflow (P0)

**Objective**: Validate full code-review workflow execution with all steps.

**Preconditions**:

- code-review-flow.yaml loaded
- Mock agents configured
- Run manager initialized

**Steps**:

1. Create workflow run with run-manager
2. Execute step 0: Planner creates plan
3. Validate plan rating (mock score 8/10)
4. Execute step 1: Code-reviewer analyzes
5. Execute step 2: Generate review report
6. Execute step 3: Developer fix suggestions
7. Execute step 4: QA validation
8. Verify all artifacts created

**Expected Results**:

- All 5 agent steps complete
- Plan rating passes (score >= 7)
- Artifacts exist at expected paths
- Workflow completion criteria met

**Success Criteria**:

- run.status = "completed"
- 5 gate files created
- plan-rating.json shows score >= 7
- All completion_criteria satisfied

---

### a2a-workflow-002: Workflow with conditional security step (P1)

**Objective**: Validate that conditional security step executes when triggered.

**Preconditions**:

- code-review-flow.yaml loaded
- security_focus = true in workflow inputs

**Steps**:

1. Create workflow run with security_focus: true
2. Execute through step 3
3. Verify step 3.5 (security review) executes
4. Continue to completion

**Expected Results**:

- Step 3.5 condition evaluates to true
- security-architect agent activated
- Security review artifact created
- Total steps = 6 (including conditional)

**Success Criteria**:

- step_3.5_executed = true
- security-review-{workflow_id}.json exists
- gate file for step 3.5 exists

---

### a2a-workflow-003: Workflow step failure and retry (P1)

**Objective**: Validate workflow retry mechanism on step failure.

**Preconditions**:

- Workflow with retry_config enabled
- Mock agent configured to fail first attempt

**Steps**:

1. Create workflow run
2. Execute step that fails on first attempt
3. Verify retry triggers
4. Second attempt succeeds
5. Workflow continues

**Expected Results**:

- First attempt fails
- Retry logged with backoff
- Second attempt succeeds
- Workflow completes

**Success Criteria**:

- attempt_count = 2 for failed step
- backoff_applied = true
- final_status = "completed"

---

## Category 6: Complex graph scenarios

### a2a-graph-001: Parallel agent execution (P1)

**Objective**: Validate that independent agents can execute in parallel (max 2).

**Preconditions**:

- Two independent tasks
- No shared dependencies

**Steps**:

1. Submit analyst task (analyze codebase)
2. Submit developer task (implement unrelated feature)
3. Both execute in parallel
4. Both complete independently
5. Results aggregated

**Expected Results**:

- Both tasks start concurrently
- No blocking between tasks
- Both complete successfully
- Aggregated results available

**Success Criteria**:

- parallel_execution = true
- task_1.start_time ~= task_2.start_time (within 1 second)
- Both tasks.status = "completed"

---

### a2a-graph-002: Fan-out and fan-in pattern (P1)

**Objective**: Validate fan-out to multiple agents and fan-in aggregation.

**Preconditions**:

- Architect designs three components
- Three developers implement in parallel (batched)
- QA validates aggregated result

**Steps**:

1. Architect creates 3-component design
2. Fan-out: Developer A, B, C implement components (2 parallel, then 1)
3. All developers complete
4. Fan-in: QA receives all three implementations
5. QA produces unified validation

**Expected Results**:

- 3 parallel implementations (batched per limits)
- All outputs available for fan-in
- QA receives complete input set
- Final validation covers all components

**Success Criteria**:

- developer_tasks = 3
- all_developers_completed before qa_starts
- qa_input includes all 3 component paths
- unified_validation.components.length = 3

---

## Test data requirements

### Required fixtures

| Fixture                            | Location                        | Description                                  |
| ---------------------------------- | ------------------------------- | -------------------------------------------- |
| valid-task-template.json           | fixtures/sample-task-inputs/    | Complete valid agent-task template           |
| partial-task-no-verification.json  | fixtures/sample-task-inputs/    | Template missing verification field          |
| invalid-json-task.txt              | fixtures/sample-task-inputs/    | Malformed JSON for error testing             |
| mock-developer-response.json       | fixtures/mock-agent-responses/  | Mock developer agent output                  |
| mock-code-reviewer-response.json   | fixtures/mock-agent-responses/  | Mock code-reviewer output with PASS/CONCERNS |
| mock-qa-response.json              | fixtures/mock-agent-responses/  | Mock QA validation output                    |
| mock-security-response.json        | fixtures/mock-agent-responses/  | Mock security-architect output               |
| security-triggers-test.json        | fixtures/security-trigger-data/ | Subset of triggers for testing               |
| workflow-snapshot-code-review.json | fixtures/workflow-snapshots/    | Code review workflow state snapshot          |

### Mock agent response format

```json
{
  "agent_type": "developer",
  "task_id": "mock-task-001",
  "output": {
    "content": "Task completed successfully.",
    "deliverables": [
      {
        "path": ".claude/context/tmp/test/output.mjs",
        "status": "created"
      }
    ],
    "verdict": "PASS"
  },
  "metadata": {
    "duration_ms": 1500,
    "tokens_used": 2500
  }
}
```

---

## Execution matrix

### CI/CD execution

| Trigger          | P0  | P1     | P2     | Timeout |
| ---------------- | --- | ------ | ------ | ------- |
| PR to main       | All | All    | None   | 10 min  |
| Push to feat/\*  | All | Sample | None   | 5 min   |
| Daily scheduled  | All | All    | Sample | 30 min  |
| Weekly scheduled | All | All    | All    | 60 min  |

### Local execution

```bash
# Run P0 only (fast feedback)
node runner.mjs --priority P0

# Run specific category
node runner.mjs --category template-enforcement

# Run single scenario
node runner.mjs --scenario a2a-template-001

# Run all with verbose
node runner.mjs --verbose --all
```

---

## Success metrics

### Test suite health

| Metric                 | Target                | Current |
| ---------------------- | --------------------- | ------- |
| P0 pass rate           | 100%                  | -       |
| P1 pass rate           | >= 95%                | -       |
| Total pass rate        | >= 90%                | -       |
| Average execution time | < 500ms/scenario      | -       |
| Hook coverage          | 100% (3/3 hooks)      | -       |
| Category coverage      | 100% (6/6 categories) | -       |

### Performance benchmarks

| Operation                    | Target   | P90 |
| ---------------------------- | -------- | --- |
| Hook execution (PreToolUse)  | < 100ms  | -   |
| Hook execution (PostToolUse) | < 200ms  | -   |
| Scenario execution           | < 2000ms | -   |
| Full P0 suite                | < 60s    | -   |

---

## Risk assessment

### Known risks

| Risk                        | Likelihood | Impact | Mitigation                               |
| --------------------------- | ---------- | ------ | ---------------------------------------- |
| Hook timeout in CI          | Medium     | High   | Increased timeouts, retry logic          |
| File system race conditions | Low        | Medium | Sequential execution by default          |
| Mock response drift         | Medium     | Medium | Version fixtures, regular updates        |
| Windows path issues         | High       | High   | Path normalization, cross-platform tests |

### Test maintenance

- **Fixture updates**: Review monthly or when schema changes
- **Scenario updates**: Review when hooks modified
- **Coverage checks**: Weekly automated report

---

## Appendix: Scenario JSON templates

### Template: PreToolUse hook test

```json
{
  "scenario_id": "a2a-{category}-{number}",
  "name": "Descriptive scenario name",
  "description": "Detailed description of what this tests",
  "category": "{category}",
  "priority": "P0",
  "tags": ["hook", "pretooluse"],

  "preconditions": {
    "fixtures": [],
    "state": {},
    "environment": {}
  },

  "steps": [
    {
      "step_id": "invoke-hook",
      "action": "invoke_pretooluse_hook",
      "input": {
        "hook": "{hook-filename}.mjs",
        "tool_name": "Task",
        "tool_input": {
          "prompt": "..."
        }
      },
      "expected": {
        "decision": "approve|block"
      },
      "timeout_ms": 5000
    }
  ],

  "assertions": [
    {
      "type": "hook_decision",
      "target": "steps.invoke-hook.result.decision",
      "operator": "equals",
      "expected": "approve|block"
    }
  ],

  "cleanup": {
    "remove_files": [],
    "restore_state": true
  },

  "metadata": {
    "created_at": "2026-01-16T00:00:00Z",
    "author": "architect",
    "related_hooks": ["{hook-filename}.mjs"]
  }
}
```

### Template: Agent chain test

```json
{
  "scenario_id": "a2a-chain-{number}",
  "name": "N-agent chain: agent1 -> agent2 -> ...",
  "description": "Validates artifact flow through agent chain",
  "category": "agent-chain",
  "priority": "P0|P1",
  "tags": ["chain", "artifact-flow"],

  "preconditions": {
    "fixtures": ["mock-agent-responses/*.json"],
    "state": {},
    "environment": {}
  },

  "steps": [
    {
      "step_id": "delegate-agent1",
      "action": "simulate_task_delegation",
      "input": {
        "task_template": "...(full agent-task schema)..."
      },
      "expected": {
        "decision": "approve",
        "outputs": [".claude/context/tmp/test/agent1-output.json"]
      }
    },
    {
      "step_id": "inject-response-agent1",
      "action": "inject_mock_response",
      "input": {
        "agent": "agent1",
        "response_fixture": "mock-agent1-response.json"
      }
    },
    {
      "step_id": "delegate-agent2",
      "action": "simulate_task_delegation",
      "input": {
        "task_template": "...(references agent1 output)..."
      },
      "expected": {
        "decision": "approve"
      }
    }
  ],

  "assertions": [
    {
      "type": "artifact_exists",
      "target": ".claude/context/tmp/test/agent1-output.json",
      "operator": "exists",
      "expected": true
    },
    {
      "type": "chain_complete",
      "target": "steps",
      "operator": "count_equals",
      "expected": 3
    }
  ]
}
```

---

## Revision history

| Version | Date       | Author    | Changes                             |
| ------- | ---------- | --------- | ----------------------------------- |
| 1.0.0   | 2026-01-16 | architect | Initial test plan with 22 scenarios |
