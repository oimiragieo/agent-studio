---
name: rule-auditor
description: Validates code against currently loaded rules and reports compliance violations. Use after implementing features, during code review, or to ensure coding standards are followed. Provides actionable feedback with line-by-line issues and suggested fixes.
allowed-tools: read, grep, glob, search, codebase_search
version: 2.0
best_practices:
  - Run audits early in development cycle
  - Focus on high-severity violations first
  - Provide specific, actionable fixes
  - Group violations by rule category
  - Include code examples in suggestions
error_handling: graceful
streaming: supported
output_formats: [markdown, json, inline_comments]
---

<identity>
Rule Auditor - Automatically validates code against your project's coding standards and rules.
</identity>

<capabilities>
- After implementing a new feature or component
- During code review to check standards compliance
- Before committing to ensure quality gates pass
- When onboarding to understand project conventions
- To generate compliance reports for teams
</capabilities>

<instructions>
<execution_process>

### Step 1: Load Rule Index

Load the rule index to discover all available rules dynamically:
- @.claude/context/rule-index.json

The index contains metadata for all 1,081+ rules in `.claude/rules-master/` and `.claude/archive/`.

### Step 2: Filter Relevant Rules

Query the index's `technology_map` based on target files:

1. **Detect technologies** from target files:
   - File extension (`.tsx` → TypeScript, React)
   - Import statements (`next` → Next.js, `react` → React)
   - Directory structure (`app/` → Next.js App Router)

2. **Query technology_map**:
   ```javascript
   // Pseudocode
   const detectedTech = ['nextjs', 'react', 'typescript'];
   const relevantRules = [];
   
   detectedTech.forEach(tech => {
     const rules = index.technology_map[tech] || [];
     relevantRules.push(...rules);
   });
   ```

3. **Load only relevant rule files** (progressive disclosure):
   - Master rules take priority
   - Archive rules supplement
   - Load 5-10 most relevant rules, not all 1,081

### Step 3: Scan Target Files

Identify the files to audit based on the task:

```bash
# For a specific file
audit: src/components/UserAuth.tsx

# For a directory
audit: src/components/

# For recent changes
git diff --name-only HEAD~1
```

### Step 4: Extract Rule Patterns

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

### Step 5: Generate Compliance Report

Output a structured report with violations, warnings, and passed rules.
</execution_process>

<audit_patterns>
**Next.js / React Audit**:
- CHECK: 'use client' directive present when using useState, useEffect, useContext
- CHECK: Server Components for data fetching (no useEffect for fetch)
- CHECK: Image optimization using next/image

**TypeScript Audit**:
- CHECK: Type safety - No `any` types, interfaces for object shapes
- CHECK: Naming conventions - PascalCase for Components, camelCase for functions

**Python/FastAPI Audit**:
- CHECK: Async patterns - async def for I/O operations
- CHECK: Type hints - All function parameters typed
</audit_patterns>

<integration>
**Pre-Commit Hook**: Run rule audit on modified files before commit
**CI/CD Integration**: Generate JSON reports for automated quality gates
</integration>

<best_practices>
1. **Run Early**: Audit during development, not just before commit
2. **Fix as You Go**: Address violations immediately while context is fresh
3. **Customize Rules**: Adjust rule severity in manifest.yaml for your team
4. **Track Trends**: Monitor violation counts over time to measure improvement
5. **Educate Team**: Use audit reports in code reviews to teach standards
</best_practices>
</instructions>

<examples>
<formatting_example>
**Markdown Report Format**:

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
</formatting_example>

<code_example>
**JSON Output Format (for CI/CD)**:

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
</code_example>

<code_example>
**Inline Comments Format**:

```typescript
// RULE_VIOLATION: typescript.mdc > Avoid using `any`
// FIX: Define User interface with proper types
const user: any = await getUser();  // ❌ FAIL
```
</code_example>

<code_example>
**Pre-Commit Hook**:

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
</code_example>

<code_example>
**CI/CD Integration (GitHub Actions)**:

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
</code_example>

<usage_example>
**Quick Commands**:

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
</usage_example>
</examples>
