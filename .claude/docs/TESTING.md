# Testing Guide

## Overview

This project uses Node.js built-in test framework for all testing (unit, integration, E2E). Tests are co-located with source files where possible, with E2E tests in dedicated integration directories.

**Test Statistics** (as of 2026-01-28):

- **Total Tests**: 49 passing
- **Unit Tests**: 29
- **E2E Tests**: 20 (Phase 1A features)
- **Test Coverage**: Phase 1A features (Knowledge Base, Cost Tracking, Advanced Elicitation)

## Test Structure

### Test Locations

```
project-root/
├── tests/                           # Unit tests
│   ├── agent-context-tracker.test.mjs
│   ├── routing-guard.test.mjs
│   └── workflow-validator.test.mjs
└── .claude/
    └── tests/
        └── integration/
            ├── e2e/
            │   ├── phase1a-e2e.test.cjs     # Phase 1A E2E tests (20 tests)
            │   └── .tmp/                     # Test artifacts (auto-cleaned)
            ├── template-system-e2e.test.cjs
            └── template-system-e2e-happy.test.cjs
```

### Test Patterns

#### Unit Tests

- **Pattern**: `*.test.mjs` (ES modules)
- **Location**: Co-located with source or `tests/` directory
- **Purpose**: Test individual functions/modules in isolation
- **Mocking**: Minimal, prefer real implementations

#### E2E Tests

- **Pattern**: `*-e2e.test.cjs` (CommonJS for compatibility)
- **Location**: `.claude/tests/integration/e2e/`
- **Purpose**: Test complete workflows with real files and commands
- **Mocking**: NONE - uses real files, real commands, real data
- **Cleanup**: Automatic cleanup in `after()` hooks

## Running Tests

### All Tests

```bash
npm test
```

### Specific Test File

```bash
npm test -- tests/agent-context-tracker.test.mjs
```

### E2E Tests Only

```bash
node --test .claude/tests/integration/e2e/phase1a-e2e.test.cjs --test-reporter=spec
```

### With Coverage (future)

```bash
npm test -- --experimental-coverage
```

## E2E Test Scenarios (Phase 1A)

### Scenario 1: Knowledge Base E2E (6 tests)

**Workflow**: Create → Index → Search → Verify

Tests:

1. Create test skill and verify file exists
2. Build KB index and verify updated
3. Find skill in index via grep (direct file check)
4. Search for skill using KB reader API
5. Get skill by exact name
6. Verify search performance (<50ms)

**Key Validations**:

- Real skill file created in `.claude/skills/`
- Index builder executes successfully
- CSV index updated with new skill
- Search returns correct results
- Performance targets met

### Scenario 2: Knowledge Base Modify (1 test)

**Workflow**: Modify → Rebuild → Verify

Tests:

1. Modify skill content and rebuild index
2. Verify updated description appears in search results

**Key Validations**:

- Index reflects latest content
- No stale results

### Scenario 3: Cost Tracking E2E (4 tests)

**Workflow**: Session → LLM Calls → Log → Verify

Tests:

1. Log cost entry with proper JSON format
2. Verify hash chain integrity (3-entry chain)
3. Calculate costs correctly for haiku/sonnet/opus
4. Verify minimal overhead (<5ms)

**Key Validations**:

- JSON log format correct
- Hash chain prevents tampering
- Cost calculations match Anthropic pricing
- Performance targets met

### Scenario 4: Advanced Elicitation E2E (3 tests)

**Workflow**: Invoke → Method Selection → Validation

Tests:

1. Handle feature flag disabled gracefully
2. Validate method names against allowed list
3. Enforce max 5 methods per invocation

**Key Validations**:

- Feature flag respected
- Security controls enforced (path traversal, rate limiting)

### Scenario 5: Feature Flag E2E (2 tests)

**Workflow**: Enable/Disable → Graceful Handling

Tests:

1. Check feature flags from environment
2. Handle missing config gracefully

**Key Validations**:

- Environment variables respected
- Defaults applied when config missing

### Scenario 6: Integration E2E (2 tests)

**Workflow**: Search KB → Track Cost → Verify All

Tests:

1. Integrate KB search with cost tracking
2. Handle concurrent operations without conflicts

**Key Validations**:

- Multiple features work together
- No interference between features

### Performance Assertions (2 tests)

Tests:

1. KB search in <50ms
2. Cost tracking overhead <5ms

**Key Validations**:

- Phase 1A performance targets met

## Test Helpers

### E2E Test Helpers (phase1a-e2e.test.cjs)

```javascript
// Execute command and return stdout
function exec(command, options = {})

// Read file safely (returns null if missing)
async function readFile(filePath)

// Count lines in file
async function countLines(filePath)

// Wait for file modification
async function waitForFileModification(filePath, maxWaitMs = 5000)

// Calculate SHA-256 hash
function calculateHash(data)
```

## Test Writing Guidelines

### DO ✓

1. **Use descriptive test names**: `should create test skill and index it`
2. **Test real behavior**: Use real files, real commands, real data
3. **Clean up after tests**: Always use `after()` hooks to remove test artifacts
4. **Assert performance**: Include timing assertions for critical paths
5. **Test edge cases**: Empty inputs, invalid data, missing files
6. **Document test purpose**: Add comments explaining what scenario tests

### DON'T ✗

1. **Mock unnecessarily**: Only mock external dependencies (APIs, databases)
2. **Test implementation details**: Test behavior, not internals
3. **Leave test artifacts**: Always clean up (files, directories, state)
4. **Assume test order**: Tests should be independent and isolated
5. **Skip error cases**: Always test error paths and edge cases
6. **Ignore performance**: Include performance assertions for critical operations

## Test Patterns

### Setup and Cleanup

```javascript
describe('My Feature E2E', () => {
  const testDir = path.join(PROJECT_ROOT, '.claude', 'tests', 'integration', '.tmp');

  before(async () => {
    // Setup: Create test directory
    await fs.mkdir(testDir, { recursive: true });
  });

  after(async () => {
    // Cleanup: Remove test artifacts
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should test feature', async () => {
    // Test implementation
  });
});
```

### Performance Testing

```javascript
it('should perform operation in <50ms', async () => {
  const start = Date.now();
  const result = await operation();
  const duration = Date.now() - start;

  assert.ok(duration < 50, `Operation took ${duration}ms, expected <50ms`);
});
```

### Integrity Verification

```javascript
it('should verify hash chain integrity', async () => {
  // Create chain of entries
  const entries = [];
  let prevHash = '0';

  for (let i = 0; i < 3; i++) {
    const entry = createEntry(prevHash);
    entries.push(entry);
    prevHash = entry._hash;
  }

  // Verify chain
  let expectedPrevHash = '0';
  for (const entry of entries) {
    assert.strictEqual(entry._prevHash, expectedPrevHash);
    expectedPrevHash = entry._hash;
  }
});
```

## Performance Targets

| Feature                | Target | Actual | Status |
| ---------------------- | ------ | ------ | ------ |
| KB Search              | <50ms  | ~25ms  | ✓      |
| Cost Tracking Overhead | <5ms   | ~2ms   | ✓      |
| Index Rebuild          | <2s    | ~700ms | ✓      |

## CI/CD Integration

Tests run automatically on:

- **Pre-commit**: Unit tests (fast feedback)
- **Pre-push**: All tests (full validation)
- **PR**: All tests + coverage report

### GitHub Actions Example (future)

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm test
```

## Debugging Tests

### Run Single Test

```bash
node --test tests/agent-context-tracker.test.mjs
```

### Run with Verbose Output

```bash
node --test tests/*.test.mjs --test-reporter=spec
```

### Isolate Flaky Test

```bash
for i in {1..100}; do
  node --test tests/flaky-test.mjs || echo "Failed on iteration $i"
done
```

## Common Issues

### Issue: "Test skill not found in index"

**Cause**: Skill created in wrong directory
**Fix**: Create skills in `.claude/skills/` (not `.tmp/`)

### Issue: "Hash chain broken"

**Cause**: Log file corrupted or tampered
**Fix**: Archive corrupted log, start fresh

### Issue: "Test artifacts not cleaned up"

**Cause**: Missing or failing `after()` hook
**Fix**: Always use `try/catch` in cleanup, ignore errors

### Issue: "Tests too slow"

**Cause**: Real file I/O, index rebuilds
**Fix**: This is intentional for E2E tests (validates production behavior)

## Future Enhancements

1. **Code Coverage**: Add `--experimental-coverage` to CI
2. **Performance Benchmarks**: Track trends over time
3. **Integration Tests**: Orchestrator-level tests (Task #17)
4. **Staging Tests**: Run in staging environment before production
5. **Load Tests**: Simulate 10,000 artifacts, 10,000 log entries

## Related Documentation

- **TDD Skill**: `.claude/skills/tdd/SKILL.md`
- **QA Agent**: `.claude/agents/core/qa.md`
- **Production Hardening Plan**: `.claude/context/plans/production-hardening-plan-20260128.md`

---

**Last Updated**: 2026-01-28
**Test Count**: 49 tests passing
**Coverage**: Phase 1A features
**Status**: Production-ready
