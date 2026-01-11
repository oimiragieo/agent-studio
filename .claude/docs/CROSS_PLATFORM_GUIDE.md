# Cross-Platform Compatibility Guide

## Overview

This guide documents cross-platform utilities and best practices for ensuring code works consistently across Windows, macOS, and Linux.

## Utilities Created

### 1. cross-platform-cli.mjs - CLI Command Wrapper

- Automatic .cmd extension on Windows for npm scripts
- Promise-based command execution
- Command availability detection
- Platform-aware shell mode

### 2. line-endings.mjs - Line Ending Normalization

- Normalize to LF/CRLF/System
- Automatic conversion on read/write
- Line ending detection
- Format conversion utilities

### 3. file-permissions.mjs - Permission Handling

- Make files executable (Unix)
- Set Unix permissions with no-op on Windows
- Extension-based executable detection (Windows)
- Permission string formatting

### 4. test-cross-platform.mjs - Test Suite

- 14 comprehensive tests
- Platform-aware test skipping
- CLI, line endings, permissions, and path tests

## Quick Start

```javascript
// Path construction
import path from 'path';
const filePath = path.join('folder', 'file.txt');

// CLI commands
import { spawnCli } from './.claude/tools/cross-platform-cli.mjs';
const proc = spawnCli('claude', ['--version']);

// Line endings
import { readTextFile, writeTextFile } from './.claude/tools/line-endings.mjs';
const content = readTextFile('./file.txt'); // Always LF
writeTextFile('./output.txt', content); // System-specific

// File permissions
import { makeExecutable } from './.claude/tools/file-permissions.mjs';
makeExecutable('./script.sh'); // Unix: chmod 755, Windows: no-op
```

## Migration Checklist

- [ ] Replace path string concatenation with path.join()
- [ ] Use spawnCli() for CLI commands
- [ ] Normalize line endings when reading text
- [ ] Use system line endings when writing
- [ ] Make scripts executable with makeExecutable()
- [ ] Test on all platforms

## Testing

Run the test suite:

```bash
node .claude/tools/test-cross-platform.mjs
```

Expected output: 13 passed, 1 skipped (platform-specific)

---

**Status**: Complete (Phase 6 - Cursor 47)
**Last Updated**: 2026-01-09
