---
name: rule-auditor
description: Validates code against project coding standards. Checks for pattern compliance, identifies violations, and suggests fixes.
allowed-tools: read, glob, grep
---

# Rule Auditor

Validates code against established coding standards and patterns.

## When to Use

- After implementing new features
- During code review preparation
- Before merging pull requests
- When onboarding to understand conventions
- Periodic codebase health checks

## Instructions

### Step 1: Identify Applicable Rules

Based on file type and location:

- `.tsx` files → React + TypeScript rules
- `.ts` files → TypeScript rules
- `api/` directory → API design rules
- `components/` → Component structure rules
- Test files → Testing patterns

### Step 2: Load Rule Definitions

Extract patterns to check:

- Naming conventions
- File structure requirements
- Import order rules
- Error handling patterns
- Documentation requirements

### Step 3: Scan and Validate

Check code against rules:

```javascript
const violations = [];

// Check naming conventions
if (!isPascalCase(componentName)) {
  violations.push({
    type: 'naming',
    message: 'Component names should be PascalCase',
    severity: 'error',
  });
}

// Check file structure
if (!hasDefaultExport(file)) {
  violations.push({
    type: 'structure',
    message: 'Components should have default export',
    severity: 'warning',
  });
}
```

### Step 4: Generate Report

Output structured audit report:

```markdown
## Audit Report: UserProfile.tsx

### Summary

- ✅ 15 rules passed
- ⚠️ 2 warnings
- ❌ 1 error

### Violations

#### Error: Missing TypeScript types

Line 23: Function parameter lacks type annotation
**Fix**: Add explicit type annotation

#### Warning: Import order

Lines 1-5: Imports not in standard order
**Fix**: Group by external → internal → relative
```

## Audit Categories

### Code Style

- Naming conventions
- Formatting consistency
- Import organization
- Comment quality

### Type Safety

- Explicit type annotations
- No `any` types
- Proper null handling
- Generic usage

### Architecture

- File placement
- Module boundaries
- Dependency direction
- Separation of concerns

### Testing

- Test coverage
- Test naming
- Assertion patterns
- Mock usage

## Severity Levels

| Level   | Description           | Action |
| ------- | --------------------- | ------ |
| Error   | Must fix before merge | Block  |
| Warning | Should fix            | Review |
| Info    | Nice to have          | Log    |

## Output Formats

### Console Report

Quick terminal-friendly output

### Markdown Report

Detailed report for documentation

### JSON Report

Machine-readable for CI/CD integration

## Integration

### Pre-commit Hook

```bash
# Run audit before commit
opencode audit --staged
```

### CI Pipeline

```yaml
- name: Code Audit
  run: opencode audit --format json > audit-report.json
```
