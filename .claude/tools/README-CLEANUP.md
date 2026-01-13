# Repository Cleanup Script - Quick Reference

## TL;DR

```bash
# Check what would be deleted (SAFE - no changes)
pnpm cleanup:check

# Execute cleanup (DELETES FILES - use with caution)
pnpm cleanup
```

## What It Does

Removes temporary files that should NEVER be committed:

- ✅ 247 tmpclaude-* files/directories
- ✅ 2 malformed Windows path files (`C:devprojects...`, `nul`)
- ✅ 2 temporary files in `.claude/context/tmp/`
- ✅ 1 external dependency (`crewAI-main/`)
- ✅ Total: 252 files, 169.89 MB

## Usage

### Before Every Commit

```bash
# Step 1: Check what would be deleted
pnpm cleanup:check

# Step 2: Review the list of files
# Make sure no important files are listed

# Step 3: Execute cleanup
pnpm cleanup

# Step 4: Verify git status
git status
```

### Direct Invocation

```bash
# Dry-run (preview)
node .claude/tools/cleanup-repo.mjs --dry-run

# Execute (with confirmation prompt)
node .claude/tools/cleanup-repo.mjs --execute

# Execute (skip confirmation)
node .claude/tools/cleanup-repo.mjs --execute --yes
```

## What Gets Protected

**NEVER DELETED**:
- `.git/` - Git repository
- `node_modules/` - Dependencies
- `.claude/rules-*` - Rule files
- `.claude/agents/` - Agent definitions
- `.claude/docs/` - Documentation
- `src/`, `scripts/`, `tests/` - Source code

## What Gets Deleted

### 1. tmpclaude-* Files

```
tmpclaude-01ae-cwd
tmpclaude-ff81-cwd
.claude/tools/tmpclaude-65c1-cwd
```

### 2. Malformed Windows Paths

```
nul
CdevprojectsLLM-RULES.claudecontexttmptmp-step-1-2-complete.txt
```

### 3. Temporary Files

```
.claude/context/tmp/tmp-heap-research-query.txt
.claude/context/tmp/gemini-heap-solutions.txt
```

### 4. External Dependencies

```
crewAI-main/
```

## Output Example

```
Repository Cleanup Script
========================

[DRY RUN MODE] - No files will be deleted

Scanning for temporary files...

Found:

- 247 tmpclaude-* files and directories (6.3 KB)
- 2 Malformed Windows path files (801 Bytes)
- 2 Temporary files in .claude/context/tmp/ (8.28 KB)
- 1 External dependencies in root directory (169.87 MB)

Total: 252 files/directories
Total space to reclaim: 169.89 MB
```

## Safety Features

1. ✅ **Dry-run mode** - Preview before deleting
2. ✅ **Protected paths** - Never deletes critical files
3. ✅ **Confirmation prompt** - Asks before deleting >100 files
4. ✅ **Error handling** - Continues on failure
5. ✅ **Detailed logging** - Shows what's deleted
6. ✅ **Root allowlist** - Only specific files allowed in root

## Troubleshooting

### No Files Found

**Cause**: Repository is already clean

**Solution**: Run `git status` to verify

### Script Fails

**Cause**: Missing dependencies

**Solution**: Run `pnpm install`

### Files I Want to Keep Get Deleted

**Cause**: Files match cleanup patterns

**Solution**: Move files to correct locations (see `.claude/rules/subagent-file-rules.md`)

## Documentation

- **Complete Guide**: `.claude/docs/CLEANUP_SCRIPT.md`
- **Implementation Report**: `.claude/context/reports/cleanup-script-implementation-report.md`
- **File Location Rules**: `.claude/rules/subagent-file-rules.md`

## Exit Codes

- `0` - Success (all files deleted or no files to delete)
- `1` - Failure (some files could not be deleted or user cancelled)

## Version

**Version**: 1.0.0
**Date**: 2026-01-12
**Status**: Production-ready
