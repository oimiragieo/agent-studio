# Repository Cleanup Script

## Overview

The repository cleanup script (`.claude/tools/cleanup-repo.mjs`) is a comprehensive tool for removing temporary files, SLOP (files in wrong locations), and other artifacts that should never be committed to the repository.

## Purpose

This script prevents repository pollution by automatically detecting and removing:

- **tmpclaude-* files and directories**: Temporary working directories created by Claude Code
- **Malformed Windows path files**: Files with UTF-8 encoded paths or concatenated segments
- **Temporary files**: Files in `.claude/context/tmp/` and files with `tmp-` prefix
- **Old log files**: Log files older than 7 days
- **Test artifacts**: Validation files in root directory
- **External dependencies**: Third-party code that shouldn't be in the repository

## Usage

### NPM Scripts (Recommended)

```bash
# Check what would be deleted (dry-run)
pnpm cleanup:check

# Execute cleanup (with auto-confirmation)
pnpm cleanup
```

### Direct Invocation

```bash
# Dry-run mode - Preview deletions without actually deleting
node .claude/tools/cleanup-repo.mjs --dry-run

# Execute mode - Actually delete files (with confirmation prompt)
node .claude/tools/cleanup-repo.mjs --execute

# Execute mode - Skip confirmation prompt
node .claude/tools/cleanup-repo.mjs --execute --yes
```

## What Gets Deleted

### 1. tmpclaude-* Files and Directories

**Pattern**: `tmpclaude-*`, `.claude/tools/tmpclaude-*`

**Reason**: These are temporary working directories created by Claude Code. They contain intermediate state and should never be committed.

**Example**:
```
tmpclaude-01ae-cwd
tmpclaude-ff81-cwd
.claude/tools/tmpclaude-65c1-cwd
```

### 2. Malformed Windows Path Files

**Patterns**:
- Files starting with `C:` without proper separators (e.g., `C:devprojects`)
- Files with UTF-8 encoded path markers (e.g., `C\357\200\272devprojects`)
- Windows reserved names: `nul`, `con`, `prn`, `aux`, `com1-9`, `lpt1-9`
- Files with concatenated path segments (no separators)

**Reason**: These files have malformed paths due to Windows path handling issues and are unreadable/corrupt.

**Example**:
```
nul
CdevprojectsLLM-RULES.claudecontexttmptmp-step-1-2-complete.txt
```

### 3. Temporary Files

**Patterns**:
- `.claude/context/tmp/*.txt`
- `**/tmp-*` (older than 24 hours)

**Reason**: Temporary scratch files used during agent execution. Safe to delete after task completion.

**Example**:
```
.claude/context/tmp/tmp-heap-research-query.txt
.claude/context/tmp/gemini-heap-solutions.txt
```

### 4. Old Log Files

**Patterns**:
- `*.log` (in root, older than 7 days)
- `.claude/context/logs/*.log` (older than 7 days)
- `.claude/context/logs/*.txt` (older than 7 days)

**Reason**: Log files accumulate over time. Old logs are rotated out to save space.

### 5. Test Artifacts in Root

**Pattern**: `validation-*.json` (in root directory)

**Reason**: Test artifacts should be in `.claude/context/reports/` or test directories, not in root.

### 6. External Dependencies

**Pattern**: `crewAI-main/`

**Reason**: Third-party code downloaded for reference should not be committed. Use npm/pnpm dependencies instead.

## What Gets Protected

The script NEVER deletes these paths:

- `.git/` - Git repository
- `node_modules/` - Node.js dependencies (handled by .gitignore)
- `.claude/rules-library/` - Rule library files
- `.claude/rules-master/` - Master rule files
- `.claude/agents/` - Agent definitions
- `.claude/skills/` - Skill definitions
- `.claude/workflows/` - Workflow definitions
- `.claude/schemas/` - JSON schemas
- `.claude/templates/` - Template files
- `.claude/docs/` - Documentation
- `.claude/system/` - System files
- `scripts/` - Build/utility scripts
- `src/` - Source code
- `tests/` - Test files

### Root Directory Allowlist

Only these files are permitted in the project root:

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

Any other file in root is flagged for potential deletion.

## Output Format

### Dry-Run Mode

```
Repository Cleanup Script
========================

[DRY RUN MODE] - No files will be deleted

Scanning for temporary files...

Found:

- 247 tmpclaude-* files and directories (6.3 KB)
- 2 Malformed Windows path files (801 Bytes)
- 2 Temporary files in .claude/context/tmp/ (8.28 KB)
- 0 Log files older than 7 days (0 Bytes)
- 0 Files with tmp- prefix older than 24 hours (0 Bytes)
- 0 Test artifacts in root directory (0 Bytes)
- 1 External dependencies in root directory (169.87 MB)

Total: 252 files/directories
Total space to reclaim: 169.89 MB

[DRY RUN] Would delete the following files:

tmpclaude-* files and directories:
  - tmpclaude-fff7-cwd
  - tmpclaude-ffc5-cwd
  ...

Run with --execute to perform cleanup
```

### Execute Mode

```
Repository Cleanup Script
========================

[EXECUTE MODE] - Files will be permanently deleted

Scanning for temporary files...

Found:

- 247 tmpclaude-* files and directories (6.3 KB)
- 2 Malformed Windows path files (801 Bytes)
...

You are about to delete 252 files/directories. Continue? (y/N): y

Deleting files...

✓ Deleted: tmpclaude-fff7-cwd
✓ Deleted: tmpclaude-ffc5-cwd
✓ Deleted: nul
...

Cleanup complete!
- Successfully deleted: 252 files/directories
- Failed: 0 files/directories
- Space reclaimed: 169.89 MB
```

## Safety Features

### 1. Protected Paths

The script will NEVER delete files in protected paths, even if they match cleanup patterns.

### 2. Confirmation Prompt

When deleting >100 files, the script prompts for confirmation (unless `--yes` flag is used).

### 3. Error Handling

If a file cannot be deleted, the script logs the error and continues with remaining files.

### 4. Dry-Run Mode

Always run in dry-run mode first to preview what would be deleted.

### 5. File Statistics

The script shows total files and space to be reclaimed before deletion.

## Integration with Workflow

### Pre-Commit Hook (Recommended)

Add to `.git/hooks/pre-commit`:

```bash
#!/bin/bash

# Run cleanup before commit
echo "Running repository cleanup..."
node .claude/tools/cleanup-repo.mjs --execute --yes

# Stage changes
git add -A

exit 0
```

### CI/CD Integration

Add to GitHub Actions workflow:

```yaml
- name: Check for SLOP
  run: |
    pnpm cleanup:check
    if [ $? -ne 0 ]; then
      echo "::error::Temporary files detected. Run 'pnpm cleanup' to remove them."
      exit 1
    fi
```

## Troubleshooting

### Issue: Script finds no files to delete

**Cause**: Repository is already clean, or files are in protected paths.

**Solution**: Run `git status` to verify there are no untracked files.

### Issue: Script fails with "Cannot read properties of undefined"

**Cause**: Glob pattern failed to match any files.

**Solution**: Check that the `glob` package is installed (`pnpm install`).

### Issue: Script deletes files I want to keep

**Cause**: Files match cleanup patterns but are intentional.

**Solution**: Move files to appropriate locations (see File Location Matrix in `.claude/rules/subagent-file-rules.md`).

### Issue: Malformed Windows paths not detected

**Cause**: UTF-8 encoding issues or unusual path format.

**Solution**: Manually delete the file or report the pattern to extend detection.

## Performance

- **Scanning**: Uses streaming glob for large directories (memory-efficient)
- **Deletion**: Batch operations with error handling
- **Memory**: < 100MB for most repositories
- **Time**: Typically < 1 minute for 200+ files

## Exit Codes

- `0`: Success (all files deleted or no files to delete)
- `1`: Failure (some files could not be deleted, or user cancelled)

## Version History

| Version | Date       | Changes                                      |
| ------- | ---------- | -------------------------------------------- |
| 1.0.0   | 2026-01-12 | Initial release - comprehensive cleanup tool |

## See Also

- `.claude/rules/subagent-file-rules.md` - File location rules for subagents
- `.claude/docs/ORCHESTRATOR_ENFORCEMENT.md` - Orchestrator file enforcement
- `.gitignore` - Files ignored by git (never committed)
