# File Location Guardrails

## Purpose

This guardrail prevents SLOP (files in wrong locations) by validating file paths before write operations. It integrates with the pre-tool hook to block invalid file locations.

---

## Enforcement Level: HARD BLOCK

File location violations result in immediate operation failure. The agent must correct the path before proceeding.

---

## Pre-Tool Validation Rules

### Rule 1: Block Malformed Paths

**Trigger**: Any file write operation
**Check**: Path does not match malformed patterns
**Block if**: Path contains any of these patterns:

```regex
# Windows drive without separator
^C:[a-zA-Z]

# Duplicate drive letters  
^[A-Z]:[A-Z]:

# Concatenated path segments (missing separators)
[a-z]{4,}[A-Z][a-z].*[a-z]{4,}[A-Z]

# Path to .claude without separator
^[^/\\]+[a-z]{3,}\.claude
```

**Error Message**: `BLOCKED: Malformed file path detected. Path appears to have missing separators or corrupted Windows path format. Reconstruct path using proper separators.`

---

### Rule 2: Block Root Directory Writes (Except Allowlist)

**Trigger**: File write to project root
**Check**: Filename is in allowlist
**Block if**: File is NOT one of:

```
package.json, package-lock.json, pnpm-lock.yaml, yarn.lock
README.md, GETTING_STARTED.md, LICENSE, .gitignore
.npmrc, .nvmrc, .editorconfig, tsconfig.json
eslint.config.js, .eslintrc.json, prettier.config.js, .prettierrc
CHANGELOG.md, CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md
```

**Error Message**: `BLOCKED: File "{filename}" not allowed in project root. Use appropriate .claude/ subdirectory. See .claude/rules/subagent-file-rules.md for correct locations.`

---

### Rule 3: Block Prohibited Directories

**Trigger**: File write to prohibited location
**Check**: Path is not in prohibited directories
**Block if**: Path starts with:

```
node_modules/
.git/
dist/
build/
out/
.next/
.nuxt/
coverage/
```

**Error Message**: `BLOCKED: Cannot write to prohibited directory "{directory}". This location is reserved for build outputs or version control.`

---

### Rule 4: Enforce File Type Locations

**Trigger**: File write matching known patterns
**Check**: File is in correct location for its type

| Pattern | Required Location |
|---------|-------------------|
| `*-report.md`, `*-report.json` | `.claude/context/reports/` |
| `*-task.md`, `*-task.json` | `.claude/context/tasks/` |
| `plan-*.md`, `plan-*.json` | `.claude/context/artifacts/` |
| `tmp-*` | `.claude/context/tmp/` |
| `*.schema.json` | `.claude/schemas/` |

**Error Message**: `BLOCKED: File "{filename}" must be in "{required_location}", not "{current_location}".`

---

### Rule 5: Warn on Non-Standard Locations

**Trigger**: File write to `.claude/context/` but not standard subdirectory
**Check**: Path uses standard subdirectory
**Warn if**: File is in `.claude/context/` but not in:
- `artifacts/`
- `reports/`
- `tasks/`
- `tmp/`
- `logs/`
- `history/`
- `runs/`
- `audit/`

**Warning Message**: `WARNING: File "{filename}" is in non-standard location. Consider using a standard subdirectory for better organization.`

---

## Hook Integration

### security-pre-tool.sh Extension

Add to `.claude/hooks/security-pre-tool.sh`:

```bash
#!/bin/bash
# File location validation (add to existing hook)

validate_file_location() {
    local file_path="$1"
    
    # Check for malformed Windows paths
    if [[ "$file_path" =~ ^C:[a-zA-Z] ]] && [[ ! "$file_path" =~ ^C:[/\\] ]]; then
        echo "BLOCKED: Malformed Windows path - missing separator after drive letter"
        return 1
    fi
    
    # Check for concatenated segments
    if [[ "$file_path" =~ [a-z]{4,}[A-Z][a-z].*[a-z]{4,}[A-Z] ]] && [[ ! "$file_path" =~ [/\\] ]]; then
        echo "BLOCKED: Path appears to have concatenated segments without separators"
        return 1
    fi
    
    # Check for root directory writes
    local basename=$(basename "$file_path")
    local dirname=$(dirname "$file_path")
    
    if [[ "$dirname" == "." ]] || [[ "$dirname" == "/" ]] || [[ "$dirname" =~ ^[A-Z]:$ ]]; then
        local allowed_root="package.json|package-lock.json|pnpm-lock.yaml|yarn.lock"
        allowed_root+="|README.md|GETTING_STARTED.md|LICENSE|\.gitignore"
        allowed_root+="|\.npmrc|\.nvmrc|\.editorconfig|tsconfig.json"
        allowed_root+="|eslint.config.js|\.eslintrc.json|prettier.config.js|\.prettierrc"
        allowed_root+="|CHANGELOG.md|CONTRIBUTING.md|CODE_OF_CONDUCT.md|SECURITY.md"
        
        if [[ ! "$basename" =~ ^($allowed_root)$ ]]; then
            echo "BLOCKED: File '$basename' not allowed in project root"
            return 1
        fi
    fi
    
    return 0
}

# Call for write operations
if [[ "$TOOL_NAME" == "Write" ]] || [[ "$TOOL_NAME" == "Edit" ]]; then
    validate_file_location "$FILE_PATH"
    if [[ $? -ne 0 ]]; then
        exit 1
    fi
fi
```

---

## Node.js Validation Function

For use in `enforcement-gate.mjs`:

```javascript
/**
 * Validate file location for subagent writes
 * @param {string} filePath - Path to validate
 * @param {string} [fileType] - Optional file type for stricter validation
 * @returns {{ allowed: boolean, blockers: string[], warnings: string[] }}
 */
function validateFileLocation(filePath, fileType = null) {
  const blockers = [];
  const warnings = [];
  
  // Normalize path for comparison
  const normalizedPath = filePath.replace(/\\/g, '/');
  const basename = normalizedPath.split('/').pop();
  const pathParts = normalizedPath.split('/').filter(Boolean);
  
  // Rule 1: Check for malformed paths
  const malformedPatterns = [
    { regex: /^C:[a-zA-Z]/, msg: 'Windows path missing separator after drive letter' },
    { regex: /^[A-Z]:[A-Z]:/, msg: 'Duplicate drive letters detected' },
    { regex: /[a-z]{4,}[A-Z][a-z].*[a-z]{4,}[A-Z]/, msg: 'Path segments appear concatenated without separators' },
    { regex: /^[^/\\]+[a-z]{3,}\.claude/, msg: 'Path to .claude missing separator' }
  ];
  
  for (const { regex, msg } of malformedPatterns) {
    if (regex.test(filePath)) {
      blockers.push(`Malformed path: ${msg}`);
    }
  }
  
  // Rule 2: Check for prohibited directories
  const prohibitedDirs = ['node_modules', '.git', 'dist', 'build', 'out', '.next', '.nuxt', 'coverage'];
  for (const dir of prohibitedDirs) {
    if (normalizedPath.includes(`/${dir}/`) || normalizedPath.startsWith(`${dir}/`)) {
      blockers.push(`Cannot write to prohibited directory: ${dir}/`);
    }
  }
  
  // Rule 3: Check root directory writes
  const allowedRootFiles = new Set([
    'package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock',
    'README.md', 'GETTING_STARTED.md', 'LICENSE', '.gitignore',
    '.npmrc', '.nvmrc', '.editorconfig', 'tsconfig.json',
    'eslint.config.js', '.eslintrc.json', 'prettier.config.js', '.prettierrc',
    'CHANGELOG.md', 'CONTRIBUTING.md', 'CODE_OF_CONDUCT.md', 'SECURITY.md'
  ]);
  
  const isRootFile = pathParts.length === 1 || 
    (pathParts.length === 2 && /^[A-Z]:$/.test(pathParts[0]));
  
  if (isRootFile && !allowedRootFiles.has(basename)) {
    blockers.push(`File "${basename}" not allowed in project root. Use .claude/ hierarchy.`);
  }
  
  // Rule 4: Check file type locations
  if (fileType || basename.match(/-report\.(md|json)$/)) {
    if (!normalizedPath.includes('.claude/context/reports/') && 
        !normalizedPath.includes('.claude/context/artifacts/')) {
      blockers.push('Report files must be in .claude/context/reports/ or .claude/context/artifacts/');
    }
  }
  
  if (fileType === 'task' || basename.match(/-task\.(md|json)$/)) {
    if (!normalizedPath.includes('.claude/context/tasks/') &&
        !normalizedPath.includes('.claude/context/')) {
      blockers.push('Task files must be in .claude/context/tasks/');
    }
  }
  
  if (basename.startsWith('tmp-') && !normalizedPath.includes('.claude/context/tmp/')) {
    warnings.push('Temporary files should be in .claude/context/tmp/');
  }
  
  return {
    allowed: blockers.length === 0,
    blockers,
    warnings
  };
}

module.exports = { validateFileLocation };
```

---

## CLI Usage

```bash
# Validate a single file location
node .claude/tools/enforcement-gate.mjs validate-file-location --path ".claude/context/reports/audit.md"

# Validate with file type
node .claude/tools/enforcement-gate.mjs validate-file-location --path "report.md" --type report

# Batch validate (check all files in manifest)
node .claude/tools/enforcement-gate.mjs validate-file-locations --manifest ".claude/context/artifacts/dev-manifest.json"
```

---

## Recovery: Cleaning Up SLOP

When SLOP is detected, use this procedure:

```bash
# 1. Find misplaced files
find . -maxdepth 1 -name "*-report.md" -o -name "*-task.md" -o -name "plan-*.md" 2>/dev/null

# 2. Move to correct locations
mkdir -p .claude/context/reports .claude/context/tasks
mv *-report.md .claude/context/reports/ 2>/dev/null
mv *-task.md .claude/context/tasks/ 2>/dev/null  
mv plan-*.md .claude/context/artifacts/ 2>/dev/null

# 3. Find and remove mangled path files
find . -maxdepth 1 -name "C*" -type f 2>/dev/null | xargs rm -f

# 4. Verify cleanup
ls -la . | grep -E "\.(md|json)$"
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-01-05 | Initial release |
