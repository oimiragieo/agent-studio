---
description: Run tests with optional coverage and specific file targeting
agent: qa
---

# Run Tests

## Quick Test Commands

**Run all tests:**
!`npm test`

**Run specific file:**
```bash
npm test -- $ARGUMENTS
```

**Run with coverage:**
!`npm run test:coverage`

## Test Types

### Unit Tests
```bash
npm test -- tests/unit/
```

### Integration Tests
```bash
npm run test:integration
```

### E2E Tests (Cypress)
```bash
npm run test:e2e        # Headless
npm run test:e2e:open   # Interactive
npm run test:e2e:headed # With browser
```

## Analyzing Results

After tests complete, analyze:
1. Number of tests passed/failed
2. Test coverage percentage
3. Specific failure messages
4. Stack traces for debugging

## Common Test Patterns

### Test a specific function
```bash
npm test -- --testNamePattern="should handle error"
```

### Test a specific file
```bash
npm test -- tests/unit/llmService.test.js
```

### Watch mode for development
```bash
npm run test:watch
```

## Test File Locations
- Unit tests: `tests/unit/`
- Integration tests: `tests/integration/`
- E2E tests: `cypress/e2e/`
- Fixtures: `tests/fixtures/`
