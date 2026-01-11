# Subagent File Location Rules

## Purpose

This document defines MANDATORY file location rules for all subagents to prevent SLOP (files in wrong locations). These rules are enforced at validation gates and apply to ALL agents spawned by the orchestrator.

---

## Critical Path Handling (Windows Compatibility)

### MANDATORY: Path Construction Rules

```
┌─────────────────────────────────────────────────────────────────┐
│  PATH RULES - HARD REQUIREMENTS                                  │
│                                                                 │
│  1. ALWAYS use forward slashes (/) in file paths                │
│  2. NEVER concatenate path segments without separators          │
│  3. NEVER strip backslashes from Windows paths                  │
│  4. Use path.join() or equivalent for programmatic paths        │
│  5. Validate paths before writing - check for malformed patterns│
└─────────────────────────────────────────────────────────────────┘
```

### Malformed Path Detection

**BLOCKED PATTERNS** - If you see these, STOP and fix:

| Pattern | Problem | Example |
|---------|---------|---------|
| `C:dev` | Missing backslash after drive | `C:devprojects` |
| `C:projects` | Missing segments | `C:projectsLLM-RULES` |
| Path without separators | Concatenated segments | `Cdevprojects` |
| Double drive letters | Path corruption | `C:C:dev` |
| Mixed slash/no-slash | Inconsistent separators | `C:/dev/projectsLLM-RULES` |

**Self-Check Before Any File Write**:
```
Before writing to a path, verify:
1. Does the path contain proper separators between ALL segments?
2. If Windows: Does drive letter have colon AND backslash (C:\)?
3. Can you read back each path segment individually?
4. Does the path match an expected pattern from the table below?
```

---

## File Location Matrix

### MANDATORY Locations by File Type

| File Type | Required Location | Pattern |
|-----------|-------------------|---------|
| **Reports** | `.claude/context/reports/` | `*-report.md`, `*-report.json` |
| **Task Briefs** | `.claude/context/tasks/` | `*-task.md`, `*-task.json` |
| **Artifacts** | `.claude/context/artifacts/` | `*.json`, `*.md` (workflow outputs) |
| **Plans** | `.claude/context/artifacts/` | `plan-*.md`, `plan-*.json` |
| **Reasoning** | `.claude/context/history/reasoning/<workflow>/` | `<agent>.json` |
| **Gate Results** | `.claude/context/history/gates/<workflow>/` | `<step>-<agent>.json` |
| **Documentation** | `.claude/docs/` | `*.md` |
| **Agent Definitions** | `.claude/agents/` | `<agent-name>.md` |
| **Skills** | `.claude/skills/<skill-name>/` | `SKILL.md` |
| **Schemas** | `.claude/schemas/` | `*.schema.json` |
| **Templates** | `.claude/templates/` | `*.md`, `*.json` |
| **Workflows** | `.claude/workflows/` | `*.yaml` |
| **Guardrails** | `.claude/system/guardrails/` | `*.md` |
| **Permissions** | `.claude/system/permissions/` | `*.md` |
| **Temporary Files** | `.claude/context/tmp/` | `tmp-*.md`, `tmp-*.json` |
| **Logs** | `.claude/context/logs/` | `*.log`, `*.txt` |
| **Run State** | `.claude/context/runs/<run_id>/` | Various |

### PROHIBITED Locations

```
┌─────────────────────────────────────────────────────────────────┐
│  NEVER CREATE FILES IN THESE LOCATIONS                          │
│                                                                 │
│  ❌ Project root (/) - except allowlisted files                 │
│  ❌ node_modules/                                               │
│  ❌ .git/                                                       │
│  ❌ dist/, build/, out/                                         │
│  ❌ Any path outside project directory                          │
│  ❌ Any path with malformed Windows segments                    │
└─────────────────────────────────────────────────────────────────┘
```

### Root Directory Allowlist

**ONLY these files are permitted in project root**:

```
package.json
package-lock.json
pnpm-lock.yaml
yarn.lock
README.md
GETTING_STARTED.md
LICENSE
.gitignore
.npmrc
.nvmrc
.editorconfig
tsconfig.json
eslint.config.js
.eslintrc.json
prettier.config.js
.prettierrc
CHANGELOG.md
CONTRIBUTING.md
CODE_OF_CONDUCT.md
SECURITY.md
```

**Any file NOT on this list MUST go in `.claude/` hierarchy.**

### Windows-Specific Patterns

**BLOCKED Patterns** (detected and blocked by file-path-validator hook):
- `CdevprojectsLLM-RULES.claude...` → Malformed Windows path (missing separator)
- `nul`, `con`, `prn`, `aux` → Windows reserved names
- `ReportAnalysis.md` → Concatenated path segments (missing separators)

**CORRECT Patterns**:
- `.claude/context/reports/report-analysis.md` → Proper path with separators
- `.claude/context/tasks/analysis-task.md` → Correct hierarchy

---

## Correct vs Incorrect Patterns

### Reports

**CORRECT**:
```
.claude/context/reports/security-audit-report.md
.claude/context/reports/code-review-2025-01-05.json
.claude/context/artifacts/quality-report.json
```

**INCORRECT**:
```
security-audit-report.md                    ← Root directory!
C:devprojectsLLM-RULES.claudereports.md     ← Mangled path!
./reports/audit.md                          ← Wrong hierarchy!
```

### Task Files

**CORRECT**:
```
.claude/context/tasks/cuj-validation-task.md
.claude/context/tasks/refactoring-task.json
.claude/context/tmp/tmp-analysis-task.md
```

**INCORRECT**:
```
cuj-validation-task.md                      ← Root directory!
.claude/context/cuj-validation-task.md      ← Missing /tasks/ subdirectory!
task.md                                     ← Root + ambiguous name!
```

### Artifacts

**CORRECT**:
```
.claude/context/artifacts/plan-greenfield-2025-01-05.md
.claude/context/artifacts/dev-manifest.json
.claude/context/runs/run-001/artifacts/system-architecture.json
```

**INCORRECT**:
```
plan-greenfield.md                          ← Root directory!
.claude/artifacts/plan.md                   ← Missing /context/!
CdevprojectsLLM-RULES.claudecontextartifactsplan.md  ← Mangled!
```

---

## Path Validation Functions

### JavaScript/Node.js

```javascript
/**
 * Validate file path before writing
 * @param {string} filePath - The path to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateFilePath(filePath) {
  const errors = [];
  
  // Check for malformed Windows paths
  if (/C:[a-zA-Z]/.test(filePath) && !/C:\\/.test(filePath) && !/C:\//.test(filePath)) {
    errors.push('Malformed Windows path: missing separator after drive letter');
  }
  
  // Check for concatenated segments (no separators)
  if (/[a-z]{3,}[A-Z][a-z]/.test(filePath) && !/[\/\\]/.test(filePath)) {
    errors.push('Path appears to have concatenated segments without separators');
  }
  
  // Check if in root (not in .claude, src, scripts, etc.)
  const allowedRootFiles = [
    'package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock',
    'README.md', 'GETTING_STARTED.md', 'LICENSE', '.gitignore', '.npmrc',
    '.nvmrc', '.editorconfig', 'tsconfig.json', 'eslint.config.js',
    '.eslintrc.json', 'prettier.config.js', '.prettierrc', 'CHANGELOG.md',
    'CONTRIBUTING.md', 'CODE_OF_CONDUCT.md', 'SECURITY.md'
  ];
  
  const basename = filePath.split(/[\/\\]/).pop();
  const isInSubdir = /[\/\\]/.test(filePath.replace(/^[A-Z]:[\/\\]/, ''));
  
  if (!isInSubdir && !allowedRootFiles.includes(basename)) {
    errors.push(`File "${basename}" not allowed in project root`);
  }
  
  return { valid: errors.length === 0, errors };
}
```

### Python

```python
import re
from pathlib import Path

def validate_file_path(file_path: str) -> tuple[bool, list[str]]:
    """Validate file path before writing."""
    errors = []
    
    # Check for malformed Windows paths
    if re.search(r'C:[a-zA-Z]', file_path) and not re.search(r'C:[\\\/]', file_path):
        errors.append('Malformed Windows path: missing separator after drive letter')
    
    # Check for concatenated segments
    if re.search(r'[a-z]{3,}[A-Z][a-z]', file_path) and not re.search(r'[\/\\]', file_path):
        errors.append('Path appears to have concatenated segments without separators')
    
    # Check if in root
    allowed_root_files = {
        'package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock',
        'README.md', 'GETTING_STARTED.md', 'LICENSE', '.gitignore', '.npmrc',
        '.nvmrc', '.editorconfig', 'tsconfig.json', 'eslint.config.js',
        '.eslintrc.json', 'prettier.config.js', '.prettierrc', 'CHANGELOG.md',
        'CONTRIBUTING.md', 'CODE_OF_CONDUCT.md', 'SECURITY.md'
    }
    
    path = Path(file_path)
    if len(path.parts) <= 2 and path.name not in allowed_root_files:  # Drive + filename only
        errors.append(f'File "{path.name}" not allowed in project root')
    
    return len(errors) == 0, errors
```

---

## Enforcement Levels

### HARD BLOCK (Validation Fails)

1. **Mangled paths** - Any path matching malformed patterns
2. **Root directory reports** - `*-report.md`, `*-report.json` in root
3. **Root directory tasks** - `*-task.md`, `*-task.json` in root
4. **Root directory artifacts** - Workflow outputs in root
5. **Paths outside project** - Any absolute path not under project root

### WARNING (Logged, May Proceed)

1. **Temporary files not cleaned** - `tmp-*` files older than 1 hour
2. **Files in wrong subdirectory** - e.g., reports in `/artifacts/` instead of `/reports/`
3. **Non-standard naming** - Files without conventional prefixes

---

## Subagent Checklist

**Before EVERY file write operation, verify:**

- [ ] Path uses forward slashes OR proper Windows backslashes
- [ ] Path does NOT match any malformed pattern
- [ ] File type matches required location from matrix
- [ ] If root directory: file is on allowlist
- [ ] If temporary: filename starts with `tmp-`
- [ ] Parent directories exist (or will be created)

**After task completion:**

- [ ] Remove all `tmp-*` files created during task
- [ ] Verify all artifacts are in `.claude/context/artifacts/`
- [ ] Verify all reports are in `.claude/context/reports/`

---

## Recovery Procedures

### If Mangled Path Detected

1. **STOP** - Do not attempt to write
2. **Log error** - Record the malformed path
3. **Reconstruct** - Build path using proper separators
4. **Validate** - Run validation function before retry
5. **Report** - Include path issue in task summary

### If File in Wrong Location

1. **Move file** - Use proper location from matrix
2. **Update references** - Fix any links to old location
3. **Delete original** - Remove file from wrong location
4. **Document** - Note correction in manifest

---

## Integration with Validation Gates

This document integrates with:

- `.claude/schemas/file-location.schema.json` - JSON schema validation
- `.claude/system/guardrails/file-location-guardrails.md` - Pre-tool hook validation
- `.claude/tools/enforcement-gate.mjs` - Gate validation function

**Validation Command**:
```bash
node .claude/tools/enforcement-gate.mjs validate-file-location --path "<file_path>"
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-01-05 | Initial release - address SLOP issues |
