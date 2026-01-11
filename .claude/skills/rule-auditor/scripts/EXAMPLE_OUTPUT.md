# Rule Auditor - Example Output

This document shows example outputs from the rule-auditor executable script.

## Example 1: Clean Code (No Violations)

**Command**:

```bash
node .claude/skills/rule-auditor/scripts/audit.mjs src/components/CleanComponent.tsx --format json
```

**Input File** (`src/components/CleanComponent.tsx`):

```typescript
import React from 'react';

interface UserProps {
  name: string;
  email: string;
}

export const CleanComponent: React.FC<UserProps> = ({ name, email }) => {
  return (
    <div>
      <h1>{name}</h1>
      <p>{email}</p>
    </div>
  );
};
```

**Output**:

```json
{
  "skill_name": "rule-auditor",
  "files_audited": [
    {
      "path": "src/components/CleanComponent.tsx",
      "lines_analyzed": 15,
      "violations_count": 0
    }
  ],
  "rules_applied": [
    {
      "rule_path": ".claude/rules-master/TECH_STACK_NEXTJS.md",
      "rule_name": "TECH_STACK_NEXTJS",
      "violations_found": 0
    }
  ],
  "compliance_score": 100.0,
  "violations_found": [],
  "rule_index_consulted": true,
  "technologies_detected": ["typescript", "react"],
  "audit_summary": {
    "total_files": 1,
    "total_lines": 15,
    "total_violations": 0,
    "errors": 0,
    "warnings": 0,
    "info": 0
  },
  "timestamp": "2026-01-04T12:00:00.000Z"
}
```

**Exit Code**: `0` (success)

---

## Example 2: Code with Violations

**Command**:

```bash
node .claude/skills/rule-auditor/scripts/audit.mjs src/components/UserAuth.tsx --format json
```

**Input File** (`src/components/UserAuth.tsx`):

```typescript
import React from 'react';

export function UserAuth() {
  const user: any = getUser(); // ❌ Avoid 'any' type
  console.log('User authenticated:', user); // ❌ Remove console.log
  var isAuthenticated = true; // ⚠️ Use 'const' or 'let'

  return <div>Welcome {user.name}</div>;
}
```

**Output**:

```json
{
  "skill_name": "rule-auditor",
  "files_audited": [
    {
      "path": "src/components/UserAuth.tsx",
      "lines_analyzed": 9,
      "violations_count": 3
    }
  ],
  "rules_applied": [
    {
      "rule_path": ".claude/rules-master/TECH_STACK_NEXTJS.md",
      "rule_name": "TECH_STACK_NEXTJS",
      "violations_found": 3
    }
  ],
  "compliance_score": 33.3,
  "violations_found": [
    {
      "file": "src/components/UserAuth.tsx",
      "line": 4,
      "column": 9,
      "rule": "TECH_STACK_NEXTJS",
      "severity": "error",
      "message": "Avoid using 'any' type",
      "code_snippet": "const user: any = getUser();",
      "fix_instruction": "const user: unknown = getUser();"
    },
    {
      "file": "src/components/UserAuth.tsx",
      "line": 5,
      "column": 3,
      "rule": "TECH_STACK_NEXTJS",
      "severity": "warning",
      "message": "Remove console.log statements before commit",
      "code_snippet": "console.log('User authenticated:', user);",
      "fix_instruction": ""
    },
    {
      "file": "src/components/UserAuth.tsx",
      "line": 6,
      "column": 3,
      "rule": "TECH_STACK_NEXTJS",
      "severity": "warning",
      "message": "Use 'const' or 'let' instead of 'var'",
      "code_snippet": "var isAuthenticated = true;",
      "fix_instruction": "const isAuthenticated = true;"
    }
  ],
  "rule_index_consulted": true,
  "technologies_detected": ["typescript", "react"],
  "audit_summary": {
    "total_files": 1,
    "total_lines": 9,
    "total_violations": 3,
    "errors": 1,
    "warnings": 2,
    "info": 0
  },
  "timestamp": "2026-01-04T12:00:00.000Z"
}
```

**Exit Code**: `1` (errors found)

---

## Example 3: Dry-Run Fix Mode

**Command**:

```bash
node .claude/skills/rule-auditor/scripts/audit.mjs src/components/UserAuth.tsx --fix-dry-run --format json
```

**Output**:

```json
{
  "skill_name": "rule-auditor",
  "files_audited": [
    {
      "path": "src/components/UserAuth.tsx",
      "lines_analyzed": 9,
      "violations_count": 3
    }
  ],
  "rules_applied": [
    {
      "rule_path": ".claude/rules-master/TECH_STACK_NEXTJS.md",
      "rule_name": "TECH_STACK_NEXTJS",
      "violations_found": 3
    }
  ],
  "compliance_score": 33.3,
  "violations_found": [
    {
      "file": "src/components/UserAuth.tsx",
      "line": 4,
      "column": 9,
      "rule": "TECH_STACK_NEXTJS",
      "severity": "error",
      "message": "Avoid using 'any' type",
      "code_snippet": "const user: any = getUser();",
      "fix_instruction": "const user: unknown = getUser();"
    },
    {
      "file": "src/components/UserAuth.tsx",
      "line": 5,
      "column": 3,
      "rule": "TECH_STACK_NEXTJS",
      "severity": "warning",
      "message": "Remove console.log statements before commit",
      "code_snippet": "console.log('User authenticated:', user);",
      "fix_instruction": ""
    },
    {
      "file": "src/components/UserAuth.tsx",
      "line": 6,
      "column": 3,
      "rule": "TECH_STACK_NEXTJS",
      "severity": "warning",
      "message": "Use 'const' or 'let' instead of 'var'",
      "code_snippet": "var isAuthenticated = true;",
      "fix_instruction": "const isAuthenticated = true;"
    }
  ],
  "fixes_applied": [
    {
      "file": "src/components/UserAuth.tsx",
      "line": 6,
      "fix_type": "regex_replace",
      "before": "  var isAuthenticated = true;",
      "after": "  const isAuthenticated = true;"
    },
    {
      "file": "src/components/UserAuth.tsx",
      "line": 5,
      "fix_type": "regex_replace",
      "before": "  console.log('User authenticated:', user);",
      "after": "  "
    },
    {
      "file": "src/components/UserAuth.tsx",
      "line": 4,
      "fix_type": "regex_replace",
      "before": "  const user: any = getUser();",
      "after": "  const user: unknown = getUser();"
    }
  ],
  "rule_index_consulted": true,
  "technologies_detected": ["typescript", "react"],
  "audit_summary": {
    "total_files": 1,
    "total_lines": 9,
    "total_violations": 3,
    "errors": 1,
    "warnings": 2,
    "info": 0
  },
  "timestamp": "2026-01-04T12:00:00.000Z"
}
```

**File Changes**: None (dry-run mode)

---

## Example 4: Fix Mode with Backups

**Command**:

```bash
node .claude/skills/rule-auditor/scripts/audit.mjs src/components/UserAuth.tsx --fix --format json
```

**Before** (`src/components/UserAuth.tsx`):

```typescript
import React from 'react';

export function UserAuth() {
  const user: any = getUser();
  console.log('User authenticated:', user);
  var isAuthenticated = true;

  return <div>Welcome {user.name}</div>;
}
```

**After** (`src/components/UserAuth.tsx`):

```typescript
import React from 'react';

export function UserAuth() {
  const user: unknown = getUser();

  const isAuthenticated = true;

  return <div>Welcome {user.name}</div>;
}
```

**Backup Created**: `src/components/UserAuth.tsx.bak` (contains original content)

**Output**: Same as dry-run, but with actual file modifications

---

## Example 5: Strict Mode

**Command**:

```bash
node .claude/skills/rule-auditor/scripts/audit.mjs src/ --strict --format json
```

**Behavior**:

- Exit code `1` if **any** violations found (even warnings)
- Useful for CI/CD pipelines requiring zero violations

---

## Example 6: Severity Filtering

**Command**:

```bash
node .claude/skills/rule-auditor/scripts/audit.mjs src/ --severity error --format json
```

**Output**: Only violations with `severity: "error"` are included

---

## Example 7: Rule Filtering

**Command**:

```bash
node .claude/skills/rule-auditor/scripts/audit.mjs src/ --rules nextjs,typescript --format json
```

**Behavior**: Only applies rules named "NEXTJS" or "TYPESCRIPT"

---

## Example 8: Markdown Output

**Command**:

```bash
node .claude/skills/rule-auditor/scripts/audit.mjs src/components/UserAuth.tsx --format markdown
```

**Output**:

```markdown
## Rule Audit Report

**Files Audited**: 1
**Compliance Score**: 33.3/100
**Violations**: 3 (1 errors, 2 warnings)

### ERROR: Avoid using 'any' type

- **File**: src/components/UserAuth.tsx:4:9
- **Rule**: TECH_STACK_NEXTJS
- **Code**: `const user: any = getUser();`
- **Fix**: const user: unknown = getUser();

### WARNING: Remove console.log statements before commit

- **File**: src/components/UserAuth.tsx:5:3
- **Rule**: TECH_STACK_NEXTJS
- **Code**: `console.log('User authenticated:', user);`
- **Fix**:

### WARNING: Use 'const' or 'let' instead of 'var'

- **File**: src/components/UserAuth.tsx:6:3
- **Rule**: TECH_STACK_NEXTJS
- **Code**: `var isAuthenticated = true;`
- **Fix**: const isAuthenticated = true;
```

---

## Example 9: Multiple Files

**Command**:

```bash
node .claude/skills/rule-auditor/scripts/audit.mjs src/components/ --format json
```

**Output**:

```json
{
  "skill_name": "rule-auditor",
  "files_audited": [
    {
      "path": "src/components/UserAuth.tsx",
      "lines_analyzed": 9,
      "violations_count": 3
    },
    {
      "path": "src/components/Profile.tsx",
      "lines_analyzed": 15,
      "violations_count": 0
    },
    {
      "path": "src/components/Dashboard.tsx",
      "lines_analyzed": 42,
      "violations_count": 1
    }
  ],
  "rules_applied": [
    {
      "rule_path": ".claude/rules-master/TECH_STACK_NEXTJS.md",
      "rule_name": "TECH_STACK_NEXTJS",
      "violations_found": 4
    }
  ],
  "compliance_score": 87.9,
  "violations_found": [
    /* ... violations from all files ... */
  ],
  "rule_index_consulted": true,
  "technologies_detected": ["typescript", "react", "nextjs"],
  "audit_summary": {
    "total_files": 3,
    "total_lines": 66,
    "total_violations": 4,
    "errors": 2,
    "warnings": 2,
    "info": 0
  },
  "timestamp": "2026-01-04T12:00:00.000Z"
}
```

---

## Schema Compliance

All outputs strictly conform to `.claude/schemas/skill-rule-auditor-output.schema.json`:

**Required Fields** (always present):

- ✅ `skill_name`: "rule-auditor"
- ✅ `files_audited`: Array with path, lines_analyzed, violations_count
- ✅ `rules_applied`: Array with rule_path, rule_name, violations_found
- ✅ `compliance_score`: Number 0-100
- ✅ `violations_found`: Array with violation details
- ✅ `timestamp`: ISO 8601 timestamp

**Optional Fields** (context-dependent):

- ✅ `fixes_applied`: Present when `--fix` or `--fix-dry-run` used
- ✅ `rule_index_consulted`: Boolean (always true for this implementation)
- ✅ `technologies_detected`: Array of detected technologies
- ✅ `audit_summary`: Summary statistics object
