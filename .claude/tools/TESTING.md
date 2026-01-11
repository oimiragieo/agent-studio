# Testing Guide - Priority 2 Performance Fixes

This directory contains unit tests for the Priority 2 High-Impact Performance Fixes.

## Test Files

### 1. test-streaming-json-parser.mjs

Tests the streaming JSON parser implementation.

**Tests**:

- Small file parsing (validates correct object reconstruction)
- Large file parsing (5MB JSON file with 10,000 items)
- Size limit enforcement (rejects files exceeding maxSize)
- shouldUseStreaming threshold (1MB default)
- Malformed JSON handling (proper error detection)

**Run**:

```bash
node .claude/tools/test-streaming-json-parser.mjs
```

**Expected Output**:

```
🧪 Running Streaming JSON Parser Tests

✓ Test 1 passed: Small file parsed correctly
✓ Test 2 passed: Large file (5MB) parsed in XXXms
✓ Test 3 passed: Size limit enforced correctly
✓ Test 4 passed: shouldUseStreaming threshold works
✓ Test 5 passed: Malformed JSON detected

📊 Test Results: 5/5 passed
✅ All tests passed!
```

---

### 2. test-spawn-limiting.mjs

Tests the concurrent subagent spawn limiting.

**Tests**:

- Concurrency limit enforcement (max 3 concurrent)
- Timeout handling (30s timeout)
- Sequential execution when at limit

**Note**: This test requires spawning actual child processes and is designed for manual testing.

**Run**:

```bash
node .claude/tools/test-spawn-limiting.mjs
```

**Manual Testing**:
For thorough validation, test manually:

1. Spawn 5 subagents - verify only 3 run concurrently
2. Fill all slots with long-running processes - verify timeout works
3. Spawn 6 subagents with 500ms each - verify ~1000ms total (2 batches)

---

### 3. test-cache-estimation.mjs

Tests the cache size estimation algorithm.

**Tests**:

- Accuracy comparison with JSON.stringify (within 30%)
- Performance comparison (should be 2-5x faster)
- Memory usage comparison (should use less or equal memory)
- Edge cases (empty, nested, unicode strings)

**Run**:

```bash
node .claude/tools/test-cache-estimation.mjs
```

**Expected Output**:

```
🧪 Running Cache Size Estimation Tests

🧪 Test 1: Size estimation accuracy
  null: estimated=0, actual=4, error=...
  string: estimated=26, actual=15, error=...
  ...
  Average error: XX bytes
✓ Test 1 passed: Accuracy within acceptable range

🧪 Test 2: Performance comparison
  New method: XXms (100 iterations)
  Old method: XXms (100 iterations)
  Improvement: XX.X%
✓ Test 2 passed: New method is faster

🧪 Test 3: Memory usage comparison
  New method memory: X.XXmb
  Old method memory: X.XXmb
✓ Test 3 passed: New method uses less or equal memory

🧪 Test 4: Edge cases
  empty string: X bytes
  empty array: X bytes
  ...
✓ Test 4 passed: All edge cases handled

📊 Test Results: 4/4 passed
✅ All tests passed!
```

---

## Running All Tests

```bash
# Install dependencies first
pnpm install

# Run all tests
node .claude/tools/test-streaming-json-parser.mjs && \
node .claude/tools/test-cache-estimation.mjs && \
node .claude/tools/test-spawn-limiting.mjs
```

---

## Test Coverage

| Fix                   | Test Coverage | Notes                      |
| --------------------- | ------------- | -------------------------- |
| Streaming JSON Parser | 5/5 tests     | Full coverage              |
| Spawn Limiting        | 3/3 tests     | Manual testing recommended |
| Cache Estimation      | 4/4 tests     | Full coverage              |

---

## Continuous Integration

Add these tests to your CI pipeline:

```yaml
# .github/workflows/test.yml
- name: Run Priority 2 Tests
  run: |
    node .claude/tools/test-streaming-json-parser.mjs
    node .claude/tools/test-cache-estimation.mjs
```

---

## Troubleshooting

### Test Failures

**Streaming JSON Parser Tests**:

- Ensure `stream-json` is installed: `pnpm install`
- Check Node.js version (requires 18+)

**Spawn Limiting Tests**:

- These tests spawn actual processes - may fail on restricted environments
- Run manually for validation

**Cache Estimation Tests**:

- Accuracy tests allow up to 30% error (rough estimation is expected)
- Performance tests require stable CPU (close other applications)
- Memory tests require `--expose-gc` flag for accurate results: `node --expose-gc .claude/tools/test-cache-estimation.mjs`

---

## Performance Benchmarking

To measure actual performance improvements:

```bash
# Before fixes (checkout previous commit)
time node .claude/tools/run-cuj.mjs CUJ-005

# After fixes
time node .claude/tools/run-cuj.mjs CUJ-005

# Compare results
```

Expected improvements:

- Memory usage: -30-50%
- CPU usage: -20-40%
- Total execution time: -10-20%

---

_Last Updated: 2026-01-09_
