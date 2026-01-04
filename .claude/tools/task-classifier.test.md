# Task Classifier Test Suite

## Overview

Comprehensive test suite for `task-classifier.mjs` with **69 tests** covering all complexity levels, edge cases, file patterns, batch processing, and real-world scenarios.

## Test Results

```
✅ All 69 tests passing
```

## Test Coverage

### 1. Complexity Classification (19 tests)

Tests all 5 complexity levels with various task descriptions:

- **Trivial** (4 tests): typos, documentation, spelling, formatting
- **Simple** (3 tests): bug fixes, single-file updates
- **Moderate** (3 tests): feature additions, component creation
- **Complex** (4 tests): cross-module refactoring, system-wide changes
- **Critical** (5 tests): database migrations, breaking changes, architecture redesigns

### 2. Edge Cases (10 tests)

- Empty/null/undefined task descriptions (throw errors)
- Very long task descriptions
- Special characters and unicode
- Line breaks in tasks
- Whitespace-only tasks
- Glob package fallback

### 3. File Pattern Tests (10 tests)

- Single file patterns (trivial and simple)
- Multiple files (2-5, moderate complexity)
- Many files (5+, complex)
- Wildcard patterns (`*.ts`)
- Recursive wildcards (`**/*.ts`)
- Glob braces (`{a,b,c}`)
- Cross-module detection
- File scope hints

### 4. Batch Processing (5 tests)

- Process multiple tasks
- Mixed complexity levels
- Preserve task information
- Empty task arrays
- Options passing

### 5. Verbose Mode (3 tests)

- Detailed analysis included
- File patterns included
- Non-verbose excludes details

### 6. Utility Functions (4 tests)

- `getComplexityLevel()` returns config or null
- `getAllComplexityLevels()` returns all levels
- Returns deep copies

### 7. Reasoning (4 tests)

- Keyword matches included
- File count included
- Cross-module detection
- Default reasoning

### 8. Gate Requirements (5 tests)

- Trivial: no gates
- Simple: review only
- Moderate: planner + review
- Complex: all gates
- Critical: all gates

### 9. Real-World Scenarios (7 tests)

- Hotfix for production bug
- New feature with multiple components
- Refactoring for tech debt
- API version upgrade
- Documentation update
- Security vulnerability fix
- Full-stack feature implementation

### 10. Performance (2 tests)

- Single classification < 1 second
- Batch processing (50 tasks) < 5 seconds

## Running Tests

```bash
# Run all tests
node --test .claude/tools/task-classifier.test.mjs

# Run with coverage (if available)
npm test -- --coverage .claude/tools/task-classifier.test.mjs
```

## Bug Fixes Applied

During test development, fixed a bug in `task-classifier.mjs`:

```javascript
// Before (line 569)
resolvedFiles: fileAnalysis.resolvedFiles.slice(0, 20)

// After
resolvedFiles: (fileAnalysis.resolvedFiles || []).slice(0, 20)
```

This prevents `TypeError: Cannot read properties of undefined` when `resolvedFiles` is undefined.

## Test Output

```
# tests 69
# suites 10
# pass 69
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms ~340ms
```

## Maintainability

- Uses Node.js built-in test runner (no external dependencies)
- Clear test descriptions
- Comprehensive assertions
- Real-world scenario coverage
- Performance benchmarks included

## Future Enhancements

Potential additional tests:

1. Integration with actual file system (create temp files)
2. Mocking glob package to test both paths
3. Stress testing with very large task arrays (1000+)
4. Concurrent batch processing tests
5. Memory usage profiling
