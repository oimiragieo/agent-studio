# Skill Trigger Detection Test Suite

## Overview

This test suite validates that skill trigger detection works correctly for all agents and task types.

## Test File

**Location**: `.claude/tools/test-skill-triggers.mjs`

## Running Tests

```bash
# Run all tests
node .claude/tools/test-skill-triggers.mjs

# Or from project root
node .claude/tools/test-skill-triggers.mjs
```

## Test Cases

### 1. Developer: Create Component

- **Task**: "Create a new UserProfile component with TypeScript"
- **Expected Trigger**: `new_component`
- **Expected Skill**: `scaffolder`

### 2. Developer: Modify Code

- **Task**: "Modify the authentication logic to support OAuth2"
- **Expected Trigger**: `code_changes`
- **Expected Skill**: `rule-auditor`

### 3. Code Reviewer: Review Code

- **Task**: "Review the security changes in the authentication module"
- **Expected Trigger**: `review_code`
- **Expected Skill**: `rule-auditor`

### 4. Orchestrator: Validate Plan

- **Task**: "Review and rate the implementation plan for quality"
- **Expected Trigger**: `plan_validation`
- **Expected Skill**: `response-rater`

### 5. QA: Create Tests

- **Task**: "Write unit tests for the UserProfile component"
- **Expected Trigger**: `test_creation`
- **Expected Skill**: `test-generator`

### 6. Architect: Create Diagram

- **Task**: "Create an architecture diagram for the authentication system"
- **Expected Trigger**: `architecture_diagram`
- **Expected Skill**: `diagram-generator`

### 7. Developer: Multiple Triggers

- **Task**: "Create a new API module with tests and documentation"
- **Expected Triggers**: `new_component`, `new_module`, `test_creation`
- **Expected Skills**: `scaffolder`, `test-generator`

### 8. Security Architect: Security Audit

- **Task**: "Audit the codebase for security vulnerabilities"
- **Expected Trigger**: `security_audit`
- **Expected Skill**: `rule-auditor`

## Expected Output

```
🧪 Testing Skill Trigger Detection

📋 Test: Developer: Create component
   Agent: developer
   Task: "Create a new UserProfile component with TypeScript"
   ✓ Required skills: scaffolder, rule-auditor, repo-rag
   ✓ Triggered skills: scaffolder
   ✓ Matched triggers: new_component
   ✅ PASS

...

📊 Test Results:
   Passed: 8/8
   Failed: 0/8

✅ All tests passed!
```

## Test Logic

Each test validates:

1. **Triggered Skills**: Expected skills are present in `result.triggered` or `result.required`
2. **Matched Triggers**: At least one expected trigger matches `result.matchedTriggers`
3. **Error Handling**: No exceptions during skill detection

## Adding New Tests

To add a new test case:

```javascript
{
  name: 'Agent Name: Test Description',
  agent: 'agent-type',
  task: 'Task description with trigger keywords',
  expectedTriggered: ['skill-name'],
  expectedTriggers: ['trigger_keyword']
}
```

## Integration with CI/CD

Add to your CI pipeline:

```yaml
# .github/workflows/test.yml
- name: Test Skill Trigger Detection
  run: node .claude/tools/test-skill-triggers.mjs
```

## Debugging Failed Tests

If a test fails:

1. **Check trigger patterns**: Review `.claude/tools/skill-trigger-detector.mjs`
2. **Check skill mappings**: Review `.claude/context/skill-integration-matrix.json`
3. **Run manual test**:
   ```bash
   node .claude/tools/skill-trigger-detector.mjs \
     --agent developer \
     --task "Your test task description"
   ```

## Related Files

- **Trigger Detector**: `.claude/tools/skill-trigger-detector.mjs`
- **Skill Matrix**: `.claude/context/skill-integration-matrix.json`
- **Orchestrator Integration**: `.claude/tools/orchestrator-entry.mjs`
- **Documentation**: `.claude/docs/SKILL_TRIGGER_AUTO_INVOCATION.md`

## Exit Codes

- `0`: All tests passed
- `1`: One or more tests failed or error occurred
