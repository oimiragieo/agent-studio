# QA Testing Guide

Complete guide for QA agents to execute orchestrator enforcement tests.

---

## Overview

This guide covers **3 test scripts** that validate the orchestrator enforcement system:

1. **test-hook-execution.mjs** - Hook execution without errors
2. **test-orchestrator-blocking.mjs** - Orchestrator violation blocking with delegation
3. **test-violation-logging.mjs** - Violation logging to audit log and session state

All tests output JSON results conforming to `.claude/schemas/qa-test-results.schema.json`.

---

## Test Scripts

### 1. Hook Execution Tests (`test-hook-execution.mjs`)

**Purpose**: Validate that orchestrator enforcement hooks execute without errors and correctly allow/block tools based on role.

**Test Scenarios** (13 total):

| Scenario                               | Role         | Tool            | Expected |
| -------------------------------------- | ------------ | --------------- | -------- |
| Orchestrator uses Task tool            | orchestrator | Task            | allow    |
| Orchestrator uses TodoWrite tool       | orchestrator | TodoWrite       | allow    |
| Orchestrator uses AskUserQuestion tool | orchestrator | AskUserQuestion | allow    |
| Orchestrator uses Read tool (1st call) | orchestrator | Read            | allow    |
| Orchestrator uses Write tool           | orchestrator | Write           | block    |
| Orchestrator uses Edit tool            | orchestrator | Edit            | block    |
| Orchestrator uses Grep tool            | orchestrator | Grep            | block    |
| Orchestrator uses Glob tool            | orchestrator | Glob            | block    |
| Orchestrator uses Bash with git add    | orchestrator | Bash            | block    |
| Orchestrator uses Bash with npm run    | orchestrator | Bash            | block    |
| Developer uses Write tool              | developer    | Write           | allow    |
| Developer uses Edit tool               | developer    | Edit            | allow    |
| Analyst uses Grep tool                 | analyst      | Grep            | allow    |

**Usage**:

```bash
# Run tests
node .claude/tools/qa-test-scripts/test-hook-execution.mjs

# Output: JSON results saved to .claude/context/reports/test-hook-execution-<timestamp>.json
```

**Exit Codes**:

- `0` - All tests passed (100% success rate)
- `1` - Some tests failed (70-99% success rate)
- `2` - Critical failure (hook not working, <70% success rate)

**Example Output**:

```
Starting hook execution tests...

Testing: Orchestrator uses Task tool...
  ✓ PASS: allow (actual: allow)

Testing: Orchestrator uses Write tool...
  ✓ PASS: block (actual: block)

============================================================
TEST RESULTS SUMMARY
============================================================
Test Suite: Hook Execution Tests
Timestamp: 2025-01-15T10:30:00.000Z
Total Tests: 13
Passed: 13
Failed: 0
Success Rate: 100%
Duration: 1523ms
Results saved to: .claude/context/reports/test-hook-execution-1736942400000.json
============================================================

✓ All 13 tests passed!
```

---

### 2. Orchestrator Blocking Tests (`test-orchestrator-blocking.mjs`)

**Purpose**: Validate that orchestrator violations are correctly blocked and provide proper delegation messages.

**Test Scenarios** (12 total):

| Scenario                                                  | Tool      | Expected Blocked | Expected Agent |
| --------------------------------------------------------- | --------- | ---------------- | -------------- |
| Write tool blocked with developer delegation              | Write     | true             | developer      |
| Edit tool blocked with developer delegation               | Edit      | true             | developer      |
| Grep tool blocked with analyst delegation                 | Grep      | true             | analyst        |
| Glob tool blocked with analyst delegation                 | Glob      | true             | analyst        |
| Bash git add blocked with developer delegation            | Bash      | true             | developer      |
| Bash git commit blocked with developer delegation         | Bash      | true             | developer      |
| Bash npm run blocked with qa delegation                   | Bash      | true             | qa             |
| Bash node .claude/tools blocked with developer delegation | Bash      | true             | developer      |
| Task tool allowed                                         | Task      | false            | null           |
| TodoWrite tool allowed                                    | TodoWrite | false            | null           |
| Read tool allowed                                         | Read      | false            | null           |
| Bash safe command allowed                                 | Bash      | false            | null           |

**Usage**:

```bash
# Run tests
node .claude/tools/qa-test-scripts/test-orchestrator-blocking.mjs

# Output: JSON results saved to .claude/context/reports/test-orchestrator-blocking-<timestamp>.json
```

**Exit Codes**:

- `0` - All tests passed (100% success rate)
- `1` - Some tests failed (70-99% success rate)
- `2` - Critical failure (hook not working, <70% success rate)

**Example Output**:

```
Starting orchestrator blocking tests...

Testing: Write tool blocked with developer delegation...
  ✓ PASS: Blocked=true, Agent=developer
    Block message: ORCHESTRATOR VIOLATION - HARD BLOCK

Testing: Task tool allowed...
  ✓ PASS: Blocked=false, Agent=N/A

============================================================
BLOCKING TEST RESULTS SUMMARY
============================================================
Test Suite: Orchestrator Blocking Tests
Timestamp: 2025-01-15T10:35:00.000Z
Total Tests: 12
Passed: 12
Failed: 0
Success Rate: 100%
Duration: 2103ms
Results saved to: .claude/context/reports/test-orchestrator-blocking-1736942700000.json
============================================================

✓ All 12 tests passed!
```

---

### 3. Violation Logging Tests (`test-violation-logging.mjs`)

**Purpose**: Validate that violations are properly logged to audit log and session state.

**Test Scenarios** (4 total):

| Scenario                                | Tool  | Should Log to File | Should Log to State |
| --------------------------------------- | ----- | ------------------ | ------------------- |
| Write tool violation logged             | Write | true               | true                |
| Edit tool violation logged              | Edit  | true               | true                |
| Grep tool violation logged              | Grep  | true               | true                |
| Bash dangerous command violation logged | Bash  | true               | true                |

**Validates**:

1. Violations written to `.claude/context/logs/orchestrator-violations.log`
2. Violations added to `.claude/context/tmp/orchestrator-session-state.json`
3. Log entries contain timestamp, tool, reason, command (if applicable)

**Usage**:

```bash
# Run tests
node .claude/tools/qa-test-scripts/test-violation-logging.mjs

# Output: JSON results saved to .claude/context/reports/test-violation-logging-<timestamp>.json
```

**Exit Codes**:

- `0` - All tests passed (100% success rate)
- `1` - Some tests failed (70-99% success rate)
- `2` - Critical failure (logging not working, <70% success rate)

**Auto-Cleanup**: Removes test artifacts after execution (test session state and log entries).

**Example Output**:

```
Starting violation logging tests...

Testing: Write tool violation logged...
  ✓ PASS: Logged to file=true, state=true
    Log entry: [2025-01-15T10:40:00.000Z] VIOLATION: Tool=Write, Reason=Orchestrator...

============================================================
LOGGING TEST RESULTS SUMMARY
============================================================
Test Suite: Violation Logging Tests
Timestamp: 2025-01-15T10:40:00.000Z
Total Tests: 4
Passed: 4
Failed: 0
Success Rate: 100%
Duration: 987ms
Results saved to: .claude/context/reports/test-violation-logging-1736943000000.json
============================================================

Cleaning up test artifacts...
  ✓ Session state cleaned
  ✓ Violation log cleaned

✓ All 4 tests passed!
```

---

## JSON Output Format

All test scripts output JSON conforming to `.claude/schemas/qa-test-results.schema.json`:

```json
{
  "test_suite": "Hook Execution Tests",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "total_tests": 13,
  "passed": 13,
  "failed": 0,
  "success_rate": 100,
  "results": [
    {
      "name": "Orchestrator uses Task tool",
      "role": "orchestrator",
      "tool": "Task",
      "expected": "allow",
      "actual": "allow",
      "passed": true
    }
  ],
  "duration_ms": 1523,
  "environment": {
    "node_version": "v20.10.0",
    "platform": "win32",
    "project_root": "C:/dev/projects/LLM-RULES"
  }
}
```

---

## Parsing JSON Results

### JavaScript/Node.js

```javascript
import { readFileSync } from 'fs';

// Load test results
const results = JSON.parse(readFileSync('test-results.json', 'utf-8'));

// Check success rate
if (results.success_rate >= 70) {
  console.log(`Tests passed with ${results.success_rate}% success rate`);
} else {
  console.error(`Tests failed with ${results.success_rate}% success rate`);
}

// Find failed tests
const failedTests = results.results.filter(r => !r.passed);
console.log(`Failed tests: ${failedTests.length}`);
failedTests.forEach(test => {
  console.log(`  - ${test.name}`);
  console.log(`    Expected: ${test.expected}, Got: ${test.actual}`);
});
```

### Python

```python
import json

# Load test results
with open('test-results.json') as f:
    results = json.load(f)

# Check success rate
if results['success_rate'] >= 70:
    print(f"Tests passed with {results['success_rate']}% success rate")
else:
    print(f"Tests failed with {results['success_rate']}% success rate")

# Find failed tests
failed_tests = [r for r in results['results'] if not r['passed']]
print(f"Failed tests: {len(failed_tests)}")
for test in failed_tests:
    print(f"  - {test['name']}")
    print(f"    Expected: {test['expected']}, Got: {test['actual']}")
```

---

## Common Failure Scenarios

### 1. Hook Not Found (Exit Code 2)

**Symptom**: Test exits immediately with error message "CRITICAL: Hook not found"

**Cause**: Orchestrator enforcement hook missing at `.claude/hooks/orchestrator-enforcement-hook.mjs`

**Fix**:

1. Verify hook file exists: `ls .claude/hooks/orchestrator-enforcement-hook.mjs`
2. If missing, restore from repository or create new hook
3. Re-run tests

### 2. Tool Incorrectly Allowed (Exit Code 1)

**Symptom**: Test expects "block" but got "allow"

**Cause**: Hook not properly blocking orchestrator violations

**Fix**:

1. Check hook implementation for tool whitelist/blacklist logic
2. Verify environment variable `CLAUDE_AGENT_ROLE=orchestrator` is set
3. Check session state file `.claude/context/tmp/orchestrator-session-state.json` has correct role

### 3. Tool Incorrectly Blocked (Exit Code 1)

**Symptom**: Test expects "allow" but got "block"

**Cause**: Hook blocking tools for subagent roles

**Fix**:

1. Verify role detection logic in hook
2. Check that subagent roles (developer, analyst, qa) are not treated as orchestrators
3. Verify session state has correct `agent_role` field

### 4. Violation Not Logged (Exit Code 1)

**Symptom**: Violation logging test shows "Logged to file=false" or "Logged to state=false"

**Cause**: Hook not writing to violation log or session state

**Fix**:

1. Check file permissions on `.claude/context/logs/` and `.claude/context/tmp/`
2. Verify hook has write access to these directories
3. Check hook implementation for logging logic

### 5. Missing Delegation Message (Exit Code 1)

**Symptom**: Blocking test shows "Agent=null" when agent delegation expected

**Cause**: Block message doesn't contain delegation pattern

**Fix**:

1. Check hook block message format
2. Ensure message contains patterns like "spawn developer", "delegate to analyst"
3. Update hook to include delegation instructions in block message

---

## Integration with Workflow Step 06 (Verify Tests)

These test scripts integrate with PR creation workflow step 06:

**Workflow Step** (`.claude/workflows/pr-creation-workflow.yaml`):

```yaml
- id: '06'
  name: 'Verify Tests'
  agent: 'qa'
  description: 'Execute orchestrator enforcement tests and validate results'
  tasks:
    - 'Run test-hook-execution.mjs and verify 100% pass rate'
    - 'Run test-orchestrator-blocking.mjs and verify all delegation messages correct'
    - 'Run test-violation-logging.mjs and verify logging works'
    - 'Parse JSON results and report any failures'
  artifacts:
    - 'test-hook-execution-<timestamp>.json'
    - 'test-orchestrator-blocking-<timestamp>.json'
    - 'test-violation-logging-<timestamp>.json'
  validation:
    - 'All test suites pass with 100% success rate'
    - 'No critical failures (exit code 2)'
```

**QA Agent Execution**:

1. Run all 3 test scripts sequentially
2. Parse JSON output from each script
3. Aggregate results into single report
4. Block PR if any test suite has <70% success rate
5. Warn if any test suite has <100% success rate

---

## Running Tests in CI/CD

### GitHub Actions Example

```yaml
name: QA Orchestrator Tests

on: [push, pull_request]

jobs:
  qa-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Run Hook Execution Tests
        run: node .claude/tools/qa-test-scripts/test-hook-execution.mjs

      - name: Run Orchestrator Blocking Tests
        run: node .claude/tools/qa-test-scripts/test-orchestrator-blocking.mjs

      - name: Run Violation Logging Tests
        run: node .claude/tools/qa-test-scripts/test-violation-logging.mjs

      - name: Upload Test Results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: qa-test-results
          path: .claude/context/reports/test-*.json
```

### GitLab CI Example

```yaml
qa-tests:
  stage: test
  script:
    - node .claude/tools/qa-test-scripts/test-hook-execution.mjs
    - node .claude/tools/qa-test-scripts/test-orchestrator-blocking.mjs
    - node .claude/tools/qa-test-scripts/test-violation-logging.mjs
  artifacts:
    when: always
    paths:
      - .claude/context/reports/test-*.json
```

---

## Troubleshooting

### Tests Run But All Fail

**Possible Causes**:

1. Hook not loaded correctly (check import paths)
2. Session state not initialized (check `.claude/context/tmp/`)
3. Environment variable not set (check `CLAUDE_AGENT_ROLE`)

**Debug Steps**:

1. Run tests with verbose Node.js: `NODE_DEBUG=* node test-hook-execution.mjs`
2. Check session state: `cat .claude/context/tmp/orchestrator-session-state.json`
3. Verify hook exists: `ls -la .claude/hooks/orchestrator-enforcement-hook.mjs`

### Tests Hang Indefinitely

**Possible Causes**:

1. Hook execution stuck in infinite loop
2. File I/O blocking (permissions issue)

**Debug Steps**:

1. Kill process: `Ctrl+C`
2. Check file permissions: `ls -la .claude/context/`
3. Run with timeout: `timeout 30 node test-hook-execution.mjs`

### Permission Errors

**Symptom**: "EACCES: permission denied" errors

**Fix**:

```bash
# Fix directory permissions
chmod -R 755 .claude/context/logs
chmod -R 755 .claude/context/tmp
chmod -R 755 .claude/context/reports

# Fix file permissions
chmod 644 .claude/context/tmp/orchestrator-session-state.json
```

---

## 4. Runtime Hook Validation Testing

### Purpose

Runtime validation tests verify that hooks execute correctly with proper performance, error handling, cleanup, and state management. These tests validate the **execution behavior** of hooks, not just their configuration.

### What Runtime Validation Tests

The `test-hook-runtime.mjs` script validates 8 critical runtime behaviors:

1. **Execution Time** - Hook executes within 5 second threshold
2. **Error Handling** - Hook handles errors gracefully without crashing
3. **Cleanup Operations** - Hook cleans up temporary files after execution
4. **State Management Consistency** - Hook maintains consistent session state
5. **Concurrent Execution Handling** - Hook handles concurrent calls safely
6. **Memory Usage** - Hook memory usage stays within 100MB threshold
7. **File I/O Operations** - Hook performs file operations correctly
8. **Exit Code Propagation** - Hook propagates exit codes correctly

### Performance Thresholds

| Metric         | Threshold     | Why It Matters                  |
| -------------- | ------------- | ------------------------------- |
| Execution Time | 5 seconds max | Prevents workflow delays        |
| Memory Usage   | 100MB max     | Prevents memory leaks           |
| File Cleanup   | 100% success  | Prevents temp file accumulation |

**Why These Thresholds?**

- **5 seconds**: Workflows should feel responsive, not sluggish
- **100MB**: Reasonable memory footprint for hook operations
- **Cleanup**: Temp files accumulate over time, causing disk bloat

### Running Runtime Tests

```bash
# Run runtime validation tests
node .claude/tools/qa-test-scripts/test-hook-runtime.mjs

# Output saved to:
# .claude/context/reports/test-hook-runtime-<timestamp>.json
```

### Interpreting Runtime Test Results

**Example Output**:

```
Starting hook runtime validation tests...

Testing: Hook executes within 5 second threshold...
  ✓ PASS: Execution time 234ms < 5000ms

Testing: Hook handles errors gracefully...
  ✓ PASS: Hook handles invalid state without crashing

Testing: Hook cleans up temporary files...
  ✓ PASS: Temporary files cleaned successfully

Testing: Hook maintains consistent session state...
  ✓ PASS: Session state updated consistently

Testing: Hook handles concurrent calls safely...
  ✓ PASS: Concurrent reads return consistent data

Testing: Hook memory usage within threshold...
  ✓ PASS: Memory usage 45.23MB < 100MB

Testing: Hook performs file I/O operations correctly...
  ✓ PASS: File I/O operations successful

Testing: Hook propagates exit codes correctly...
  ✓ PASS: Exit code propagation verified

============================================================
RUNTIME TEST RESULTS SUMMARY
============================================================
Test Suite: Hook Runtime Validation Tests
Timestamp: 2025-01-15T10:45:00.000Z
Total Tests: 8
Passed: 8
Failed: 0
Success Rate: 100%
Duration: 987ms
============================================================

✓ All 8 tests passed!
```

### Troubleshooting Runtime Failures

#### Execution Time Exceeds Threshold

**Symptom**: Test fails with "Execution time 6543ms exceeds threshold 5000ms"

**Cause**: Hook is slow due to blocking I/O, complex logic, or resource contention

**Fix**:

1. Profile hook execution to identify bottleneck
2. Optimize file I/O operations (use async where possible)
3. Reduce complexity of blocking operations
4. Consider caching frequently accessed data

#### Memory Usage Exceeds Threshold

**Symptom**: Test fails with "Memory usage 125.45MB exceeds threshold 100MB"

**Cause**: Memory leak or inefficient data structures

**Fix**:

1. Check for unclosed file handles
2. Review large object allocations
3. Use streaming for large file operations
4. Profile with Node.js heap snapshot tools

#### Cleanup Failure

**Symptom**: Test fails with "Temporary files not cleaned"

**Cause**: Hook doesn't clean up temp files after execution

**Fix**:

1. Add cleanup logic to hook's exit handler
2. Use `try...finally` blocks to ensure cleanup
3. Implement graceful shutdown handlers
4. Verify file permissions for deletion

#### State Management Inconsistency

**Symptom**: Test fails with "State update inconsistency detected"

**Cause**: Race conditions or improper state synchronization

**Fix**:

1. Add file locking for concurrent access
2. Use atomic write operations (write to temp, then rename)
3. Implement state validation checks
4. Add retry logic for transient failures

---

## 5. JSON Validation Testing

### Purpose

JSON validation tests verify that hook outputs conform to expected JSON schema structure. These tests validate **output format consistency**, ensuring all hooks return properly structured data.

### What JSON Validation Tests

The `test-hook-json-validation.mjs` script validates 10 JSON structure requirements:

1. **Valid JSON Format** - Output can be parsed as JSON
2. **Object Structure** - Output is an object (not array, string, etc.)
3. **Required Fields Present** - All required fields exist (decision, reason, metadata)
4. **Field Value Validation** - Decision field has valid value (allow/block/warn)
5. **Field Type Validation** - All fields have correct types
6. **Missing Field Detection** - Detects missing required fields
7. **Enum Validation** - Enforces enum values (decision: allow/block/warn)
8. **Nested Object Validation** - Metadata object has required fields
9. **Missing Nested Field Detection** - Detects missing nested fields
10. **Type Mismatch Detection** - Detects incorrect field types

### Required JSON Fields for Hook Outputs

All hook outputs must conform to this structure:

```json
{
  "decision": "approve" | "block" | "warn",
  "reason": "string explaining decision",
  "metadata": {
    "tool": "string - tool name",
    "role": "string - agent role",
    "timestamp": "ISO 8601 timestamp"
  }
}
```

**Optional Fields**:

- `metadata.delegation_target` - Agent to delegate to (for block decisions)
- `metadata.read_count` - Current read count (for Read tool)

### Schema Validation Examples

**Valid Output (Allow Decision)**:

```json
{
  "decision": "approve",
  "reason": "Task tool is whitelisted for orchestrator",
  "metadata": {
    "tool": "Task",
    "role": "orchestrator",
    "timestamp": "2025-01-15T10:30:00.000Z"
  }
}
```

**Valid Output (Block Decision with Delegation)**:

```json
{
  "decision": "block",
  "reason": "Write tool is blacklisted for orchestrator",
  "metadata": {
    "tool": "Write",
    "role": "orchestrator",
    "timestamp": "2025-01-15T10:30:00.000Z",
    "delegation_target": "developer"
  }
}
```

**Invalid Output (Missing Required Field)**:

```json
{
  "reason": "Missing decision field",
  "metadata": {
    "tool": "Write",
    "role": "orchestrator",
    "timestamp": "2025-01-15T10:30:00.000Z"
  }
}
```

**Error**: Missing required field "decision"

**Invalid Output (Wrong Enum Value)**:

```json
{
  "decision": "reject", // Should be: allow, block, or warn
  "reason": "Invalid decision value",
  "metadata": {
    "tool": "Write",
    "role": "orchestrator",
    "timestamp": "2025-01-15T10:30:00.000Z"
  }
}
```

**Error**: Invalid enum value "reject" for field "decision"

### Running JSON Validation Tests

```bash
# Run JSON validation tests
node .claude/tools/qa-test-scripts/test-hook-json-validation.mjs

# Output saved to:
# .claude/context/reports/test-hook-json-validation-<timestamp>.json
```

### Common JSON Validation Failures

#### Missing Required Field

**Symptom**: Test detects missing "decision" field

**Cause**: Hook doesn't return decision field in output

**Fix**:

1. Ensure hook always returns decision field
2. Add validation before returning output
3. Use schema validation in hook implementation

#### Invalid Enum Value

**Symptom**: Test detects decision value not in enum (allow/block/warn)

**Cause**: Hook returns invalid decision value like "reject" or "deny"

**Fix**:

1. Use constants for decision values
2. Add validation to ensure only valid values are used
3. Review hook logic for decision assignment

#### Type Mismatch

**Symptom**: Test detects decision field is number instead of string

**Cause**: Incorrect type assignment in hook

**Fix**:

1. Ensure all fields match expected types
2. Use TypeScript or JSDoc for type checking
3. Add runtime type validation

#### Missing Nested Field

**Symptom**: Test detects missing metadata.tool field

**Cause**: Metadata object incomplete

**Fix**:

1. Ensure metadata object includes all required fields
2. Validate metadata structure before returning
3. Use object destructuring with defaults

---

## Version History

| Version | Date       | Changes                                               |
| ------- | ---------- | ----------------------------------------------------- |
| 1.1.0   | 2025-01-15 | Added sections 4-5: Runtime and JSON validation tests |
| 1.0.0   | 2025-01-15 | Initial release - 3 test scripts with JSON output     |

---

## See Also

- **Test Scripts**: `.claude/tools/qa-test-scripts/`
- **JSON Schema**: `.claude/schemas/qa-test-results.schema.json`
- **Hook Implementation**: `.claude/hooks/orchestrator-enforcement-hook.mjs`
- **Workflow Integration**: `.claude/workflows/pr-creation-workflow.yaml`
- **Schema Validation**: `.claude/docs/SCHEMA_VALIDATION_GUIDE.md`
