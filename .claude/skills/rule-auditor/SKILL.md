---
name: rule-auditor
description: Validates code against currently loaded rules and reports compliance violations. Use after implementing features, during code review, or to ensure coding standards are followed. Provides actionable feedback with line-by-line issues and suggested fixes.
allowed-tools: read, grep, glob, search
---

# Rule Auditor

Automatically validates code against your project's coding standards and rules.

## When to Use

- After implementing a new feature or component
- During code review to check standards compliance
- Before committing to ensure quality gates pass
- When onboarding to understand project conventions
- To generate compliance reports for teams

## Instructions

### Step 1: Identify Active Rules

First, determine which rules apply to the current project:

```bash
# Check manifest for stack profile
cat .claude/rules/manifest.yaml

# List all loaded rule files
find .claude/rules -name "*.mdc" -type f | head -20
```

### Step 2: Scan Target Files

Identify the files to audit based on the task:

```bash
# For a specific file
audit: src/components/UserAuth.tsx

# For a directory
audit: src/components/

# For recent changes
git diff --name-only HEAD~1
```

### Step 3: Extract Rule Patterns

Parse the relevant .mdc files to extract checkable patterns:

**Pattern Categories to Check:**

| Category | Example Rule | Check Method |
|----------|--------------|--------------|
| Naming | "Use camelCase for functions" | Regex scan |
| Structure | "Place components in `components/` dir" | Path check |
| Imports | "Use ES modules, not CommonJS" | Pattern match |
| Types | "Avoid `any`, prefer `unknown`" | AST-level grep |
| Performance | "Use Server Components by default" | Directive scan |
| Security | "Never hardcode secrets" | Pattern detection |

### Step 4: Generate Compliance Report

Output a structured report:

```markdown
## Rule Audit Report

**Target**: src/components/UserAuth.tsx
**Rules Applied**: nextjs.mdc, typescript.mdc, react.mdc
**Scan Date**: {{timestamp}}

### Summary
- **Pass**: 12 rules
- **Warn**: 3 rules
- **Fail**: 2 rules

### Violations

#### FAIL: Use Server Components by default
- **File**: src/components/UserAuth.tsx:1
- **Issue**: Missing 'use client' directive but uses useState
- **Rule**: nextjs.mdc > Components
- **Fix**: Add 'use client' at file top, or refactor to Server Component

#### FAIL: Avoid using `any`
- **File**: src/components/UserAuth.tsx:45
- **Issue**: `const user: any = await getUser()`
- **Rule**: typescript.mdc > Type System
- **Fix**: Define proper User interface

#### WARN: Minimize use of 'useEffect'
- **File**: src/components/UserAuth.tsx:23
- **Issue**: useEffect for data fetching
- **Rule**: nextjs.mdc > Performance
- **Suggestion**: Consider Server Component with async/await

### Passed Rules
- ✅ Use TypeScript strict mode
- ✅ Use lowercase with dashes for directories
- ✅ Implement proper error boundaries
... (12 more)
```

## Audit Patterns by Framework

### Next.js / React Audit

```
CHECK: 'use client' directive present when using:
  - useState, useEffect, useContext
  - onClick, onChange handlers
  - Browser APIs (window, document)

CHECK: Server Components for:
  - Data fetching (no useEffect for fetch)
  - Static content rendering
  - Database queries

CHECK: Image optimization:
  - Using next/image, not <img>
  - Width/height or fill specified
  - Priority on above-fold images
```

### TypeScript Audit

```
CHECK: Type safety:
  - No `any` types (use `unknown`)
  - Interfaces for object shapes
  - Proper function return types
  - Strict null checks

CHECK: Naming conventions:
  - PascalCase: Components, Types, Interfaces
  - camelCase: functions, variables
  - SCREAMING_SNAKE_CASE: constants
```

### Python/FastAPI Audit

```
CHECK: Async patterns:
  - async def for I/O operations
  - Proper await usage
  - No blocking calls in async functions

CHECK: Type hints:
  - All function parameters typed
  - Return types specified
  - Pydantic models for validation
```

## Output Formats

### Format 1: Markdown Report (default)
Full compliance report with context and suggestions.

### Format 2: JSON (for CI/CD)
```json
{
  "target": "src/components/",
  "timestamp": "2025-11-29T10:00:00Z",
  "rules_applied": ["nextjs.mdc", "typescript.mdc"],
  "summary": {
    "pass": 12,
    "warn": 3,
    "fail": 2
  },
  "violations": [
    {
      "severity": "fail",
      "rule": "typescript.mdc",
      "pattern": "Avoid using any",
      "file": "src/components/UserAuth.tsx",
      "line": 45,
      "code": "const user: any = await getUser()",
      "fix": "Define User interface"
    }
  ]
}
```

### Format 3: Inline Comments
For direct code annotation:
```typescript
// RULE_VIOLATION: typescript.mdc > Avoid using `any`
// FIX: Define User interface with proper types
const user: any = await getUser();  // ❌ FAIL
```

## Integration with Workflows

### Pre-Commit Hook
```bash
#!/bin/bash
# .claude/hooks/pre-commit-audit.sh
# Hook: PreToolUse (for Edit, Write tools)

# Run rule audit on modified files
modified=$(git diff --cached --name-only)
for file in $modified; do
  audit_result=$(claude skill rule-auditor --target "$file" --format json)
  if echo "$audit_result" | jq -e '.summary.fail > 0' > /dev/null; then
    echo "Rule violations found in $file"
    exit 1
  fi
done
```

### CI/CD Integration
```yaml
# GitHub Actions example
- name: Rule Audit
  run: |
    claude skill rule-auditor --target src/ --format json > audit-report.json
    if [ $(jq '.summary.fail' audit-report.json) -gt 0 ]; then
      echo "::error::Rule violations detected"
      exit 1
    fi
```

## Quick Commands

```
# Audit current file
/audit this file

# Audit a specific directory
/audit src/components/

# Audit with specific rules only
/audit src/ --rules nextjs,typescript

# Generate CI-friendly output
/audit src/ --format json --strict

# Show only failures
/audit src/ --severity fail
```

## Best Practices

1. **Run Early**: Audit during development, not just before commit
2. **Fix as You Go**: Address violations immediately while context is fresh
3. **Customize Rules**: Adjust rule severity in manifest.yaml for your team
4. **Track Trends**: Monitor violation counts over time to measure improvement
5. **Educate Team**: Use audit reports in code reviews to teach standards
