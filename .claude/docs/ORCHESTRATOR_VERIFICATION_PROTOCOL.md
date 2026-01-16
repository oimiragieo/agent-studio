# Orchestrator Verification Protocol

**Post-delegation verification guide for orchestrators to validate agent outputs.**

---

## Overview

The **5-step verification protocol** ensures that delegated agents complete their tasks successfully before the orchestrator proceeds to the next workflow step.

**CRITICAL**: Execute verification **after EVERY agent completes, before spawning next agent**.

---

## When to Use Verification

| Trigger                    | Verification Required |
| -------------------------- | --------------------- |
| Agent completes task       | ✅ Always verify      |
| Agent reports output       | ✅ Always verify      |
| Before spawning next agent | ✅ Always verify      |
| Multi-step workflow        | ✅ Verify each step   |
| Agent returns early        | ✅ Verify anyway      |

**Rule**: Never skip verification. Always verify agent output before proceeding.

---

## 5-Step Verification Checklist

### STEP 1: CHECK FOR ERRORS

**Keywords to scan for**:

- `error`
- `failed`
- `exception`
- `crash`
- `fatal`
- `failure`

**Action**: Scan agent output for error keywords.

**Result**:

- **Errors found** → STOP and investigate. Do not proceed.
- **No errors** → Continue to Step 2.

**Example**:

```
Agent output contains:
"Error: Failed to compile TypeScript code"

→ VERDICT: FAIL
→ ACTION: Stop workflow, investigate compilation error
```

---

### STEP 2: CHECK FOR WARNINGS

**Keywords to scan for**:

- `warning`
- `concern`
- `issue`
- `problem`
- `caution`

**Action**: Scan agent output for warning keywords.

**Result**:

- **Warnings found** → Evaluate severity. May need attention.
- **No warnings** → Continue to Step 3.

**Example**:

```
Agent output contains:
"Warning: 3 tests skipped due to missing dependencies"

→ VERDICT: CONCERNS
→ ACTION: Evaluate if skipped tests are blocking
```

---

### STEP 3: VERIFY DELIVERABLES EXIST

**Action**: Check all expected deliverables exist at specified paths.

**Tool**: Use `verification-gate.mjs`:

```bash
node .claude/tools/verification-gate.mjs --output <agent_output_path>
```

**Result**:

- **All deliverables exist** → Continue to Step 4.
- **Missing deliverables** → STOP and request agent re-run.

**Example**:

```
Expected deliverables:
- .claude/context/reports/security-audit.md (exists: ✓)
- .claude/context/artifacts/vulnerabilities.json (exists: ✗)

→ VERDICT: FAIL
→ ACTION: Stop workflow, request agent to generate missing file
```

---

### STEP 4: VALIDATE SUCCESS CRITERIA

**Action**: Verify agent met all success criteria from task template.

**Check**:

1. Read task template success criteria
2. Compare with agent output
3. Verify evidence provided (logs, test output, metrics)

**Result**:

- **All criteria met** → Continue to Step 5.
- **Criteria not met** → STOP and request agent re-run.

**Example**:

```
Success criteria:
1. All tests passing → Agent reports: "15/15 tests passed" ✓
2. No security vulnerabilities → Agent reports: "0 critical, 2 low" ✓
3. Code coverage >80% → Agent reports: "Coverage: 85%" ✓

→ VERDICT: PASS
→ ACTION: Continue to Step 5
```

---

### STEP 5: CHECK VERDICT

**Action**: If agent provided verdict (PASS/CONCERNS/FAIL), respect it.

**Verdicts**:

- **PASS** → Proceed to next step.
- **CONCERNS** → Evaluate if issues are blocking.
- **FAIL** → STOP and address issues before proceeding.

**Example**:

```
Agent output:
"Verdict: CONCERNS - 2 low-priority security issues found"

→ VERDICT: CONCERNS
→ ACTION: Evaluate if low-priority issues block PR creation
```

---

## Using the Verification Gate Tool

### Basic Usage

```bash
# Standard mode (exit 0 = pass, 1 = concerns)
node .claude/tools/verification-gate.mjs --output .claude/context/reports/agent-output.md

# Strict mode (exit 0 = pass, 2 = fail on any concerns)
node .claude/tools/verification-gate.mjs --output agent-output.md --strict

# Verbose mode (show all verification steps)
node .claude/tools/verification-gate.mjs --output agent-output.md --verbose
```

### Exit Codes

| Exit Code | Meaning  | Action                                         |
| --------- | -------- | ---------------------------------------------- |
| 0         | PASS     | Proceed to next workflow step                  |
| 1         | CONCERNS | Evaluate severity, may proceed (standard mode) |
| 2         | FAIL     | Stop workflow, address critical issues         |

### Interpreting Results

The verification gate tool outputs JSON results conforming to `.claude/schemas/agent-output-verification.schema.json`.

**Example Output**:

```json
{
  "verdict": "PASS",
  "agent_type": "developer",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "errors": [],
  "warnings": [],
  "deliverables_status": [
    {
      "path": ".claude/context/reports/implementation-complete.md",
      "exists": true,
      "validated": true,
      "message": null
    }
  ],
  "success_criteria_status": [
    {
      "criterion": "All tests passing",
      "met": true,
      "evidence": "Test suite: 15/15 passed"
    }
  ],
  "verification_steps": {
    "step1_errors": { "checked": true, "found": [] },
    "step2_warnings": { "checked": true, "found": [] },
    "step3_deliverables": { "checked": true, "missing": [] },
    "step4_criteria": { "checked": true, "unmet": [] },
    "step5_verdict": { "checked": true, "agent_verdict": "PASS" }
  }
}
```

---

## Verification Examples by Agent Type

### Developer Agent

**Expected Deliverables**:

- Code files (`.ts`, `.tsx`, `.js`, etc.)
- Test files (`.test.ts`, `.spec.ts`)
- `dev-manifest.json` listing all files created/modified

**Success Criteria**:

- All tests passing
- Code compiles without errors
- No linting errors
- Dependencies available

**Verification Steps**:

```bash
# 1. Check developer output for errors
grep -i "error\|failed\|exception" .claude/context/reports/developer-output.md

# 2. Verify deliverables exist
node .claude/tools/verification-gate.mjs --output .claude/context/reports/developer-output.md

# 3. Validate success criteria
# - Check dev-manifest.json for files_created
# - Verify tests ran successfully
# - Confirm no compilation errors
```

---

### Code-Reviewer Agent

**Expected Deliverables**:

- `code-review-checkpoint.json` with review results
- List of syntax errors (if any)
- List of path issues (if any)
- List of dependency issues (if any)

**Success Criteria**:

- No syntax errors
- Paths valid for cross-platform
- Dependencies available
- No obvious logic errors

**Verification Steps**:

```bash
# 1. Check for critical issues
node .claude/tools/verification-gate.mjs --output .claude/context/artifacts/code-review-checkpoint.json --strict

# 2. Parse code-review-checkpoint.json
cat .claude/context/artifacts/code-review-checkpoint.json | jq '.blocking_issues'

# 3. If blocking issues found, STOP workflow
```

---

### QA Agent

**Expected Deliverables**:

- Test results JSON (e.g., `test-results.json`)
- Test coverage report
- List of test failures (if any)

**Success Criteria**:

- All tests passing (100% pass rate)
- Test coverage >70%
- No critical test failures

**Verification Steps**:

```bash
# 1. Verify test results exist
node .claude/tools/verification-gate.mjs --output .claude/context/reports/test-results.json

# 2. Parse test results
cat .claude/context/reports/test-results.json | jq '.success_rate'

# 3. If success_rate < 100%, check for blocking failures
cat .claude/context/reports/test-results.json | jq '.results[] | select(.passed == false)'
```

---

### Security-Architect Agent

**Expected Deliverables**:

- Security audit report (`.md` or `.json`)
- List of vulnerabilities (categorized by severity)
- Recommendations for fixes

**Success Criteria**:

- No critical vulnerabilities
- High vulnerabilities have mitigation plans
- Security policies followed

**Verification Steps**:

```bash
# 1. Check for critical vulnerabilities
node .claude/tools/verification-gate.mjs --output .claude/context/reports/security-audit.json --strict

# 2. Parse vulnerabilities
cat .claude/context/reports/security-audit.json | jq '.vulnerabilities[] | select(.severity == "critical")'

# 3. If critical vulnerabilities found, BLOCK workflow
```

---

## Integration with Workflow Orchestration

### Before Spawning Next Agent

**Pattern**:

```
1. Agent completes task
2. Orchestrator receives output
3. Orchestrator runs verification-gate.mjs
4. If PASS → Spawn next agent
5. If CONCERNS → Evaluate severity → May proceed
6. If FAIL → STOP workflow → Address issues
```

**Example Workflow**:

```yaml
# Step 1: Developer implements feature
- id: '01'
  agent: 'developer'
  tasks: ['Implement user authentication']

# Verification checkpoint (orchestrator executes)
- verification:
    tool: 'verification-gate.mjs'
    output: '.claude/context/reports/developer-output.md'
    mode: 'standard'
    action_on_fail: 'stop_workflow'

# Step 2: Code reviewer validates (only if Step 1 passed verification)
- id: '02'
  agent: 'code-reviewer'
  tasks: ['Review authentication implementation']
```

---

## Troubleshooting Common Verification Failures

### Failure: Missing Deliverables

**Symptom**: Verification shows "exists: false" for expected deliverable.

**Cause**: Agent did not create the file or created it at wrong path.

**Fix**:

1. Check agent output for file creation confirmation
2. Verify file path is correct (check for malformed paths)
3. Re-run agent with explicit deliverable path instruction

---

### Failure: Errors Found in Output

**Symptom**: Verification shows errors detected via keyword scan.

**Cause**: Agent encountered errors during execution.

**Fix**:

1. Read full agent output to identify error context
2. Address root cause (missing dependency, syntax error, etc.)
3. Re-run agent after fixing issue

---

### Failure: Unmet Success Criteria

**Symptom**: Verification shows success criteria not met.

**Cause**: Agent did not fully complete task or requirements changed.

**Fix**:

1. Compare agent output with task template success criteria
2. Identify which criteria are unmet
3. Re-run agent with emphasis on unmet criteria

---

### Failure: Agent Reported FAIL Verdict

**Symptom**: Verification shows agent verdict = "FAIL".

**Cause**: Agent explicitly reported failure (e.g., tests failed, security issue).

**Fix**:

1. Read agent verdict explanation
2. Address reported issues
3. Re-run agent after fixes

---

## Verification Protocol Flowchart

```
┌─────────────────────────────────────────────────────────┐
│  Agent Completes Task                                   │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 1: Check for Errors                               │
│  Keywords: error, failed, exception, crash, fatal       │
└─────────────────────────────────────────────────────────┘
        │                                   │
        │ Errors Found                      │ No Errors
        ▼                                   ▼
┌──────────────────┐              ┌─────────────────────────┐
│  STOP            │              │  STEP 2: Check Warnings │
│  VERDICT: FAIL   │              │  Keywords: warning, ...  │
└──────────────────┘              └─────────────────────────┘
                                           │
                                  Warnings Found │ No Warnings
                                           ▼            ▼
                                  ┌──────────────────────────┐
                                  │  STEP 3: Verify          │
                                  │  Deliverables Exist      │
                                  └──────────────────────────┘
                                           │
                            Missing        │         All Exist
                                ▼          │              ▼
                        ┌──────────────┐  │  ┌────────────────────┐
                        │  STOP        │  │  │  STEP 4: Validate  │
                        │  VERDICT:    │  │  │  Success Criteria  │
                        │  FAIL        │  │  └────────────────────┘
                        └──────────────┘  │              │
                                          │    Unmet     │    All Met
                                          │       ▼      │       ▼
                                          │  ┌──────────────────────┐
                                          │  │  STOP                │
                                          │  │  VERDICT: FAIL       │
                                          │  └──────────────────────┘
                                          │              │
                                          │              ▼
                                  ┌───────────────────────────────┐
                                  │  STEP 5: Check Verdict        │
                                  │  Agent verdict: PASS/         │
                                  │  CONCERNS/FAIL                │
                                  └───────────────────────────────┘
                                           │
                PASS                       │       CONCERNS      │       FAIL
                  ▼                        ▼                     ▼
      ┌──────────────────┐    ┌────────────────────┐    ┌──────────────────┐
      │  Proceed to Next │    │  Evaluate Severity │    │  STOP            │
      │  Workflow Step   │    │  May Proceed       │    │  Address Issues  │
      └──────────────────┘    └────────────────────┘    └──────────────────┘
```

---

## Best Practices

1. **Always verify** - Never skip verification, even for "simple" tasks
2. **Use strict mode for critical workflows** - Block on any concerns for production deployments
3. **Document verification results** - Save verification JSON for audit trail
4. **Re-run failed agents** - Don't try to fix issues manually; let agent re-execute
5. **Evaluate CONCERNS carefully** - Not all warnings are blocking; use judgment

---

## Version History

| Version | Date       | Changes                                        |
| ------- | ---------- | ---------------------------------------------- |
| 1.0.0   | 2025-01-15 | Initial release - 5-step verification protocol |

---

## See Also

- **Verification Tool**: `.claude/tools/verification-gate.mjs`
- **JSON Schema**: `.claude/schemas/agent-output-verification.schema.json`
- **Workflow Integration**: `.claude/workflows/pr-creation-workflow.yaml`
- **Agent Task Template**: `.claude/templates/agent-task-template.json`
