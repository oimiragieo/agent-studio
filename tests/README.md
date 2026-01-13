# Test Suite Documentation

## Overview

This directory contains the comprehensive test suite for the LLM-RULES validation infrastructure.

## Test Categories

### Unit Tests (`tests/*.test.mjs`)

| Test File                    | Purpose                                    | Tests |
| ---------------------------- | ------------------------------------------ | ----- |
| `validate-cujs.test.mjs`     | CUJ-INDEX table parsing, separator formats | 12    |
| `validate-skills.test.mjs`   | Skill frontmatter validation               | 24    |
| `run-cuj.test.mjs`           | CLI flags, error handling, exit codes      | 6     |
| `cuj-measurability.test.mjs` | Measurability criteria validation          | 9     |

### Integration Tests (`tests/integration/*.test.mjs`)

| Test File                      | Purpose                    | Tests |
| ------------------------------ | -------------------------- | ----- |
| `validation-pipeline.test.mjs` | End-to-end validation flow | 8     |

### Tools Tests (`.claude/tools/**/*.test.mjs`)

| Test File                        | Purpose                        | Tests |
| -------------------------------- | ------------------------------ | ----- |
| `cuj-parser.test.mjs`            | CUJ parsing module             | 27    |
| `task-classifier.test.mjs`       | Task classification            | 16    |
| `sync-cuj-registry.test.mjs`     | Agent/skill detection patterns | 15    |
| `lifecycle-correctness.test.mjs` | CUJ lifecycle, cleanup         | 3     |

## Running Tests

```bash
# Run all unit tests
pnpm test:unit

# Run integration tests
pnpm test:integration

# Run tools tests
pnpm test:tools

# Run everything
pnpm test:all

# Run with coverage
pnpm test:coverage

# Run in CI mode
pnpm test:ci
```

## Test Scripts in package.json

| Script             | Description              |
| ------------------ | ------------------------ |
| `test`             | Run main test suite      |
| `test:unit`        | Run unit tests only      |
| `test:integration` | Run integration tests    |
| `test:tools`       | Run tools tests          |
| `test:all`         | Run complete test suite  |
| `test:ci`          | CI-friendly test run     |
| `test:coverage`    | Run with coverage report |

## Test Coverage Summary

- **Total Tests**: 130+
- **Pass Rate**: 100%
- **Coverage Target**: 90%+ on validation scripts

## Key Test Areas

### 1. CUJ Validation

- Table parsing with various separator formats
- Execution mode normalization
- Agent/skill detection patterns
- Registry synchronization

### 2. Config Validation

- MCP configuration parsing
- Skill frontmatter validation
- Required vs optional fields
- Phase 2.1.2 field validation

### 3. CLI Tools

- Flag parsing (--ci, --no-analytics, --no-side-effects)
- Exit codes
- Error handling
- Cache control

### 4. Integration

- Full validation pipeline
- CUJ-064 execution
- Template workflow handling
- Registry file structure

## Contributing

When adding new tests:

1. Use Node.js built-in test runner (`node:test`)
2. Follow existing naming conventions
3. Add tests to appropriate category
4. Update this README

## Test Framework

Uses Node.js built-in test runner with:

- `describe()` for test suites
- `it()` for individual tests
- `assert` from `node:assert` for assertions

Example:

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Feature', () => {
  it('should work correctly', () => {
    assert.strictEqual(1 + 1, 2);
  });
});
```
