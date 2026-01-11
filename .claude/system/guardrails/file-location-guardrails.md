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
# Windows drive without separator (negative lookahead excludes proper paths)
^[A-Z]:(?![/\\])

# Duplicate drive letters
^[A-Z]:[A-Z]:

# Windows path with concatenated segments after drive letter
^[A-Z]:[a-zA-Z]+[A-Z][a-zA-Z]+

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

| Pattern                        | Required Location            |
| ------------------------------ | ---------------------------- |
| `*-report.md`, `*-report.json` | `.claude/context/reports/`   |
| `*-task.md`, `*-task.json`     | `.claude/context/tasks/`     |
| `plan-*.md`, `plan-*.json`     | `.claude/context/artifacts/` |
| `tmp-*`                        | `.claude/context/tmp/`       |
| `*.schema.json`                | `.claude/schemas/`           |

**Error Message**: `BLOCKED: File "{filename}" must be in "{required_location}", not "{current_location}".`

---

### Rule 5: Block Windows Reserved Names

**Trigger**: File write with reserved Windows device name
**Check**: Filename is not a Windows reserved device name
**Block if**: Filename (case-insensitive, with or without extension) matches:

```
CON, PRN, AUX, NUL
COM1, COM2, COM3, COM4, COM5, COM6, COM7, COM8, COM9
LPT1, LPT2, LPT3, LPT4, LPT5, LPT6, LPT7, LPT8, LPT9
```

Note: These names are reserved with any extension (e.g., `CON.txt`, `COM5.json`, `LPT7.md`)

**Error Message**: `BLOCKED: Filename "{filename}" is a Windows reserved device name and cannot be used.`

---

### Rule 6: Warn on Non-Standard Locations

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

    # Check for malformed Windows paths (improved detection)
    if [[ "$file_path" =~ ^[A-Z]:([a-zA-Z]|[^/\\]) ]] && [[ ! "$file_path" =~ ^[A-Z]:[/\\] ]]; then
        echo "BLOCKED: Malformed Windows path - missing separator after drive letter"
        return 1
    fi

    # Check for Windows path with concatenated segments after drive letter
    if [[ "$file_path" =~ ^[A-Z]:[a-zA-Z]+[A-Z][a-zA-Z]+ ]]; then
        echo "BLOCKED: Windows path with concatenated segments after drive letter"
        return 1
    fi

    # Check for concatenated segments (general case)
    if [[ "$file_path" =~ [a-z]{4,}[A-Z][a-z].*[a-z]{4,}[A-Z] ]] && [[ ! "$file_path" =~ [/\\] ]]; then
        echo "BLOCKED: Path appears to have concatenated segments without separators"
        return 1
    fi

    # Check for Windows reserved device names
    local basename=$(basename "$file_path")
    local basename_upper=$(echo "$basename" | tr '[:lower:]' '[:upper:]')
    local basename_no_ext="${basename_upper%.*}"

    case "$basename_no_ext" in
      CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])
        echo "BLOCKED: Filename uses Windows reserved device name: $basename"
        return 1
        ;;
    esac

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

**IMPORTANT: The authoritative implementation is in `.claude/tools/enforcement-gate.mjs`**

All validation constants are sourced from `.claude/schemas/file-location.schema.json` to ensure a single source of truth.

The `validateFileLocation()` function:

- Loads constants dynamically from the schema
- Implements correct Windows path detection (fixed `isInProjectRoot` logic)
- Returns `{ allowed: boolean, blockers: string[], warnings: string[], suggestedPath: string }`
- Integrated with CLI via `node .claude/tools/enforcement-gate.mjs validate-file-location`

**Key Fix**: The `isInProjectRoot` check now correctly compares the file's directory to the project root, not path segment count. This fixes the Windows edge case where paths like `C:\dev\projects\LLM-RULES\file.md` were incorrectly identified.

**Usage**:

```javascript
import { validateFileLocation } from './.claude/tools/enforcement-gate.mjs';

const result = await validateFileLocation(filePath, fileType, projectRoot);
if (!result.allowed) {
  console.error('Blocked:', result.blockers.join('; '));
  if (result.suggestedPath) {
    console.log('Suggested path:', result.suggestedPath);
  }
}
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

| Version | Date       | Changes                                                                                                         |
| ------- | ---------- | --------------------------------------------------------------------------------------------------------------- |
| 1.2.0   | 2025-01-08 | Extracted shared constants to schema; Implemented in enforcement-gate.mjs; Fixed Windows root path detection    |
| 1.1.0   | 2025-01-08 | Improved malformed path detection with negative lookahead; Added Windows reserved names COM5-COM9 and LPT5-LPT9 |
| 1.0.0   | 2025-01-05 | Initial release                                                                                                 |
