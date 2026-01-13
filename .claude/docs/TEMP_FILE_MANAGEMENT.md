# Temp File Management

## Overview

Centralized temp file management system that ensures all temporary files are created in `.claude/context/tmp/` and never in the project root.

## Usage

### Creating Temp Directories

Always use TempFileManager for temp directories:

```javascript
import { TempFileManager } from './.claude/tools/temp-file-manager.mjs';

// Create temp directory with default prefix
const tmpDir = TempFileManager.createTempDir();
// → Creates: .claude/context/tmp/tmpclaude-abc123/

// Create temp directory with custom prefix
const tmpDir = TempFileManager.createTempDir('myprefix-');
// → Creates: .claude/context/tmp/myprefix-xyz789/
```

### Creating Temp Files

```javascript
import { TempFileManager } from './.claude/tools/temp-file-manager.mjs';

// Create temp file
const tmpFile = TempFileManager.createTempFile('myfile.json');
// → Creates: .claude/context/tmp/myfile.json

// Use the temp file
import fs from 'fs';
fs.writeFileSync(tmpFile, JSON.stringify({ data: 'example' }));
```

### Manual Cleanup

```javascript
import { TempFileManager } from './.claude/tools/temp-file-manager.mjs';

// Clean temp files older than 24 hours (default)
const cleaned = TempFileManager.cleanup();
console.log(`Cleaned ${cleaned} temp files`);

// Clean temp files older than 1 hour
const cleaned = TempFileManager.cleanup(1);
console.log(`Cleaned ${cleaned} temp files`);
```

## Automatic Cleanup

### Pre-commit Hook

The pre-commit hook automatically:

1. Cleans temp files older than 24 hours
2. Checks for temp files in project root
3. Blocks commit if temp files found in root

**Run manually**:

```bash
pnpm precommit
```

**Automatic execution**:

- Runs before every commit
- Integrated into PR workflow
- No manual intervention required

### Cleanup Schedule

| Trigger         | Age Threshold | Action                |
| --------------- | ------------- | --------------------- |
| Pre-commit hook | 24 hours      | Auto-clean            |
| PR workflow     | 24 hours      | Auto-clean + validate |
| Manual cleanup  | Configurable  | Clean on demand       |

## Never Do This

### ❌ WRONG - Creates in Root

```javascript
// ❌ Creates temp directory in project root
const tmpDir = fs.mkdtempSync('tmpclaude-');

// ❌ Creates temp file in project root
const tmpFile = path.join(process.cwd(), 'tmp-file.json');
```

### ✅ CORRECT - Uses TempFileManager

```javascript
// ✅ Creates temp directory in .claude/context/tmp/
const tmpDir = TempFileManager.createTempDir();

// ✅ Creates temp file in .claude/context/tmp/
const tmpFile = TempFileManager.createTempFile('tmp-file.json');
```

## Integration with Workflows

### PR Creation Workflow

The PR creation workflow includes automatic temp file cleanup as Step 0.0:

```yaml
- step: 0.0
  name: Automatic Temp File Cleanup
  agent: devops
  description: Run automatic cleanup before PR creation
  task: |
    1. Run: pnpm precommit
    2. Verify no temp files in root
    3. Block if temp files found
```

### Custom Workflows

Add temp file cleanup to custom workflows:

```yaml
steps:
  - step: 0.0
    name: Pre-workflow Cleanup
    agent: devops
    tools:
      - Bash
    task: |
      pnpm precommit
```

## Troubleshooting

### Temp Files Found in Root

**Error message**:

```
❌ ERROR: Temp files found in root:
   ?? tmpclaude-abc123/
   ?? nul

   Run: pnpm cleanup
```

**Solution**:

1. Run `pnpm cleanup` to clean all temp files
2. Verify cleanup: `git status --short`
3. Retry commit

### Pre-commit Hook Not Running

**Check hook is executable**:

```bash
# Unix/Linux/Mac
chmod +x .claude/hooks/pre-commit-cleanup.mjs

# Windows (Git Bash)
git update-index --chmod=+x .claude/hooks/pre-commit-cleanup.mjs
```

**Verify package.json script**:

```json
{
  "scripts": {
    "precommit": "node .claude/hooks/pre-commit-cleanup.mjs"
  }
}
```

## Best Practices

### 1. Always Use TempFileManager

```javascript
// ✅ CORRECT
import { TempFileManager } from './.claude/tools/temp-file-manager.mjs';
const tmpDir = TempFileManager.createTempDir();

// ❌ WRONG
const tmpDir = fs.mkdtempSync('tmpclaude-');
```

### 2. Clean Up After Task Completion

```javascript
// Create temp directory
const tmpDir = TempFileManager.createTempDir();

try {
  // Use temp directory
  fs.writeFileSync(path.join(tmpDir, 'data.json'), data);
  // Process data...
} finally {
  // Clean up
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
```

### 3. Use Descriptive Prefixes

```javascript
// ✅ GOOD - Clear purpose
const tmpDir = TempFileManager.createTempDir('workflow-run-');
const tmpFile = TempFileManager.createTempFile('analysis-results.json');

// ❌ BAD - Generic names
const tmpDir = TempFileManager.createTempDir('tmp-');
const tmpFile = TempFileManager.createTempFile('file.json');
```

### 4. Document Temp File Usage

```javascript
/**
 * Analyze code patterns and write results to temp file
 * Temp file is automatically cleaned after 24 hours
 */
function analyzePatterns() {
  const resultsFile = TempFileManager.createTempFile('pattern-analysis.json');
  // ... analysis logic
  return resultsFile;
}
```

## API Reference

### TempFileManager.ensureTempDir()

Ensures `.claude/context/tmp/` directory exists.

**Returns**: void

**Example**:

```javascript
TempFileManager.ensureTempDir();
```

### TempFileManager.createTempDir(prefix)

Creates a temporary directory in `.claude/context/tmp/`.

**Parameters**:

- `prefix` (string, optional): Directory name prefix. Default: `'tmpclaude-'`

**Returns**: string - Absolute path to created directory

**Example**:

```javascript
const tmpDir = TempFileManager.createTempDir('analysis-');
// → C:\dev\projects\LLM-RULES\.claude\context\tmp\analysis-abc123
```

### TempFileManager.createTempFile(name)

Creates path for a temporary file in `.claude/context/tmp/`.

**Parameters**:

- `name` (string): File name

**Returns**: string - Absolute path to temp file

**Example**:

```javascript
const tmpFile = TempFileManager.createTempFile('results.json');
// → C:\dev\projects\LLM-RULES\.claude\context\tmp\results.json
```

### TempFileManager.cleanup(olderThanHours)

Removes temp files older than specified hours.

**Parameters**:

- `olderThanHours` (number, optional): Age threshold in hours. Default: 24

**Returns**: number - Count of cleaned files/directories

**Example**:

```javascript
const cleaned = TempFileManager.cleanup(1); // Clean files older than 1 hour
console.log(`Cleaned ${cleaned} temp files`);
```

## File Location Rules

### Allowed Locations

| File Type        | Location                          | Example                                   |
| ---------------- | --------------------------------- | ----------------------------------------- |
| Temp directories | `.claude/context/tmp/tmpclaude-*` | `.claude/context/tmp/tmpclaude-abc123/`   |
| Temp files       | `.claude/context/tmp/tmp-*`       | `.claude/context/tmp/tmp-analysis.json`   |
| Named temp files | `.claude/context/tmp/<name>`      | `.claude/context/tmp/workflow-state.json` |

### Prohibited Locations

| Location                 | Status     | Action                 |
| ------------------------ | ---------- | ---------------------- |
| Project root             | ❌ BLOCKED | Pre-commit hook blocks |
| `node_modules/`          | ❌ BLOCKED | Pre-commit hook blocks |
| `.git/`                  | ❌ BLOCKED | Pre-commit hook blocks |
| Any path outside project | ❌ BLOCKED | Pre-commit hook blocks |

## Version History

| Version | Date       | Changes                                                       |
| ------- | ---------- | ------------------------------------------------------------- |
| 1.0.0   | 2026-01-12 | Initial release - TempFileManager utility and pre-commit hook |
