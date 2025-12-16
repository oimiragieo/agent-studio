<command_description>
Command: /audit - Validate code against your project's coding rules and standards.
</command_description>

<instructions>
<execution_steps>

```
/audit                     # Audit recent changes
/audit src/components/     # Audit specific directory
/audit this file           # Audit current file
/audit --format json       # Output as JSON for CI/CD
/audit --severity fail     # Show only failures
```

## What This Command Does

Invokes the **rule-auditor** skill to:

1. **Identify Active Rules**
   - Reads stack profile from `.claude/rules/manifest.yaml`
   - Loads relevant `.mdc` rule files
   - Extracts checkable patterns

2. **Scan Target Files**
   - Analyzes code against rule patterns
   - Checks naming conventions, structure, imports
   - Validates framework-specific patterns

3. **Generate Compliance Report**
   - Summarizes pass/warn/fail counts
   - Lists specific violations with line numbers
   - Provides actionable fix suggestions

## Output Format

### Markdown Report (default)

```markdown
## Rule Audit Report

**Target**: src/components/UserAuth.tsx
**Rules Applied**: nextjs.mdc, typescript.mdc, react.mdc

### Summary
- **Pass**: 12 rules
- **Warn**: 3 rules
- **Fail**: 2 rules

### Violations

#### FAIL: Avoid using `any`
- **File**: src/components/UserAuth.tsx:45
- **Issue**: `const user: any = await getUser()`
- **Rule**: typescript.mdc > Type System
- **Fix**: Define proper User interface

#### WARN: Minimize use of 'useEffect'
- **File**: src/components/UserAuth.tsx:23
- **Issue**: useEffect for data fetching
- **Suggestion**: Consider Server Component with async/await
```

### JSON Format (with --format json)

```json
{
  "target": "src/components/",
  "summary": {"pass": 12, "warn": 3, "fail": 2},
  "violations": [...]
}
```

## When to Use

- After implementing a new feature
- During code review
- Before committing changes
- To generate compliance reports

</execution_steps>

<output_format>
**Output Format**:
