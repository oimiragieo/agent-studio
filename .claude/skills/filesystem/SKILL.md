---
name: filesystem
description: File system operations - read, write, list directories. Converted from MCP server for 90%+ context savings.
context:fork: true
allowed-tools: read, write, bash
version: 1.0
best_practices:
  - Verify allowed directories with list_allowed_directories first
  - Use read_multiple_files for batch operations
  - Use edit_file for surgical changes instead of read-modify-write
  - Always specify paths relative to allowed directories
error_handling: graceful
---

# Filesystem Skill

## Overview

This skill provides comprehensive file system operations for AI agents. It offers 14 tools for reading, writing, editing, searching, and managing files and directories.

**Context Savings**: ~97% reduction

- **MCP Mode**: ~18,000 tokens always loaded
- **Skill Mode**: ~500 tokens metadata + on-demand loading

## When to Use

- Reading single or multiple files
- Creating or modifying files and directories
- Searching for files by pattern
- Listing directory contents
- Moving/renaming files
- Getting file metadata and statistics
- Verifying allowed directory access

## Quick Reference

```bash
# List available tools
python executor.py --list

# Read a file
python executor.py --tool read_text_file --args '{"path": "/path/to/file.txt"}'

# Write a file
python executor.py --tool write_file --args '{"path": "/path/to/file.txt", "content": "Hello World"}'

# List directory
python executor.py --tool list_directory --args '{"path": "/path/to/dir"}'

# Search for files
python executor.py --tool search_files --args '{"path": "/project", "pattern": "**/*.ts"}'

# Check allowed directories
python executor.py --tool list_allowed_directories --args '{}'
```

## Tools

### Reading Files (4 tools)

#### read_text_file

Read complete contents of a text file. Handles various encodings with detailed error messages.

| Parameter | Type   | Required | Description             |
| --------- | ------ | -------- | ----------------------- |
| `path`    | string | Yes      | File path to read       |
| `tail`    | number | No       | Read only last N lines  |
| `head`    | number | No       | Read only first N lines |

```bash
# Read entire file
python executor.py --tool read_text_file --args '{"path": "/project/README.md"}'

# Read first 10 lines
python executor.py --tool read_text_file --args '{"path": "/logs/app.log", "head": 10}'

# Read last 50 lines
python executor.py --tool read_text_file --args '{"path": "/logs/app.log", "tail": 50}'
```

#### read_file

**DEPRECATED**: Use `read_text_file` instead. Same parameters and functionality.

```bash
python executor.py --tool read_file --args '{"path": "/path/to/file.txt"}'
```

#### read_media_file

Read image or audio files. Returns base64-encoded data with MIME type.

| Parameter | Type   | Required | Description        |
| --------- | ------ | -------- | ------------------ |
| `path`    | string | Yes      | Path to media file |

```bash
# Read an image
python executor.py --tool read_media_file --args '{"path": "/images/logo.png"}'

# Read an audio file
python executor.py --tool read_media_file --args '{"path": "/audio/sound.mp3"}'
```

#### read_multiple_files

Read multiple files simultaneously - more efficient than one-by-one reads.

| Parameter | Type  | Required | Description                 |
| --------- | ----- | -------- | --------------------------- |
| `paths`   | array | Yes      | Array of file paths to read |

```bash
# Read multiple files at once
python executor.py --tool read_multiple_files --args '{"paths": ["/src/app.ts", "/src/config.ts", "/src/utils.ts"]}'
```

### Writing Files (2 tools)

#### write_file

Create new file or completely overwrite existing file. **Use with caution** - overwrites without warning.

| Parameter | Type   | Required | Description        |
| --------- | ------ | -------- | ------------------ |
| `path`    | string | Yes      | File path to write |
| `content` | string | Yes      | File content       |

```bash
# Create new file
python executor.py --tool write_file --args '{"path": "/project/config.json", "content": "{\"env\": \"prod\"}"}'

# Overwrite existing file
python executor.py --tool write_file --args '{"path": "/project/README.md", "content": "# New README"}'
```

#### edit_file

Make line-based edits to text files. Replaces exact line sequences with new content. Returns git-style diff.

| Parameter | Type    | Required | Description                      |
| --------- | ------- | -------- | -------------------------------- |
| `path`    | string  | Yes      | File path to edit                |
| `edits`   | array   | Yes      | Array of edit objects            |
| `dryRun`  | boolean | No       | Preview changes without applying |

**Edit Object Structure**:

```json
{
  "oldText": "exact text to replace",
  "newText": "replacement text"
}
```

```bash
# Edit a file (dry run)
python executor.py --tool edit_file --args '{"path": "/src/app.ts", "edits": [{"oldText": "const port = 3000;", "newText": "const port = 8080;"}], "dryRun": true}'

# Apply the edit
python executor.py --tool edit_file --args '{"path": "/src/app.ts", "edits": [{"oldText": "const port = 3000;", "newText": "const port = 8080;"}]}'
```

### Directory Operations (4 tools)

#### create_directory

Create directory or ensure it exists. Creates nested directories in one operation. Succeeds silently if directory exists.

| Parameter | Type   | Required | Description              |
| --------- | ------ | -------- | ------------------------ |
| `path`    | string | Yes      | Directory path to create |

```bash
# Create single directory
python executor.py --tool create_directory --args '{"path": "/project/dist"}'

# Create nested directories
python executor.py --tool create_directory --args '{"path": "/project/src/components/auth"}'
```

#### list_directory

Get detailed listing of files and directories. Results prefixed with `[FILE]` or `[DIR]`.

| Parameter | Type   | Required | Description            |
| --------- | ------ | -------- | ---------------------- |
| `path`    | string | Yes      | Directory path to list |

```bash
# List directory contents
python executor.py --tool list_directory --args '{"path": "/project/src"}'
```

#### list_directory_with_sizes

List directory contents with file sizes. Can sort by name or size.

| Parameter | Type   | Required | Description                                |
| --------- | ------ | -------- | ------------------------------------------ |
| `path`    | string | Yes      | Directory path to list                     |
| `sortBy`  | string | No       | Sort by "name" or "size" (default: "name") |

```bash
# List with sizes (sorted by name)
python executor.py --tool list_directory_with_sizes --args '{"path": "/project/dist"}'

# List with sizes (sorted by size)
python executor.py --tool list_directory_with_sizes --args '{"path": "/project/dist", "sortBy": "size"}'
```

#### directory_tree

Get recursive tree view as JSON. Each entry includes name, type (file/directory), and children array.

| Parameter         | Type   | Required | Description              |
| ----------------- | ------ | -------- | ------------------------ |
| `path`            | string | Yes      | Root directory path      |
| `excludePatterns` | array  | No       | Glob patterns to exclude |

```bash
# Get full tree
python executor.py --tool directory_tree --args '{"path": "/project/src"}'

# Exclude node_modules and build directories
python executor.py --tool directory_tree --args '{"path": "/project", "excludePatterns": ["node_modules", "dist", "build"]}'
```

### File Management (2 tools)

#### move_file

Move or rename files and directories. **Fails if destination exists**. Works across directories.

| Parameter     | Type   | Required | Description      |
| ------------- | ------ | -------- | ---------------- |
| `source`      | string | Yes      | Source path      |
| `destination` | string | Yes      | Destination path |

```bash
# Rename a file
python executor.py --tool move_file --args '{"source": "/project/old.txt", "destination": "/project/new.txt"}'

# Move to different directory
python executor.py --tool move_file --args '{"source": "/project/file.txt", "destination": "/archive/file.txt"}'
```

#### search_files

Recursively search for files matching glob patterns. Patterns are relative to working directory.

| Parameter         | Type   | Required | Description           |
| ----------------- | ------ | -------- | --------------------- |
| `path`            | string | Yes      | Root path to search   |
| `pattern`         | string | Yes      | Glob pattern to match |
| `excludePatterns` | array  | No       | Patterns to exclude   |

**Pattern Examples**:

- `*.ext` - Files in current directory
- `**/*.ext` - Files in all subdirectories
- `**/test-*.ts` - Test files in all subdirectories

```bash
# Find all TypeScript files
python executor.py --tool search_files --args '{"path": "/project/src", "pattern": "**/*.ts"}'

# Find test files, exclude node_modules
python executor.py --tool search_files --args '{"path": "/project", "pattern": "**/*.test.ts", "excludePatterns": ["node_modules"]}'

# Find all JSON configs
python executor.py --tool search_files --args '{"path": "/project", "pattern": "**/*.json"}'
```

### File Information (2 tools)

#### get_file_info

Retrieve detailed metadata about a file or directory. Returns size, timestamps, permissions, and type.

| Parameter | Type   | Required | Description            |
| --------- | ------ | -------- | ---------------------- |
| `path`    | string | Yes      | File or directory path |

```bash
# Get file info
python executor.py --tool get_file_info --args '{"path": "/project/package.json"}'

# Get directory info
python executor.py --tool get_file_info --args '{"path": "/project/src"}'
```

#### list_allowed_directories

Returns list of directories accessible to the server. Subdirectories within these are also accessible.

```bash
# Check allowed directories
python executor.py --tool list_allowed_directories --args '{}'
```

## Common Workflows

### Reading Files

```bash
# 1. Check allowed directories
python executor.py --tool list_allowed_directories --args '{}'

# 2. List directory to find files
python executor.py --tool list_directory --args '{"path": "/project/src"}'

# 3. Read single file
python executor.py --tool read_text_file --args '{"path": "/project/src/app.ts"}'

# 4. Read multiple files at once (more efficient)
python executor.py --tool read_multiple_files --args '{"paths": ["/project/src/app.ts", "/project/src/config.ts", "/project/src/utils.ts"]}'
```

### Searching and Analyzing

```bash
# 1. Search for files by pattern
python executor.py --tool search_files --args '{"path": "/project", "pattern": "**/*.test.ts"}'

# 2. Get directory tree structure
python executor.py --tool directory_tree --args '{"path": "/project/src", "excludePatterns": ["node_modules"]}'

# 3. Get file sizes
python executor.py --tool list_directory_with_sizes --args '{"path": "/project/dist", "sortBy": "size"}'

# 4. Get specific file metadata
python executor.py --tool get_file_info --args '{"path": "/project/package.json"}'
```

### Creating and Modifying Files

```bash
# 1. Create directory structure
python executor.py --tool create_directory --args '{"path": "/project/src/components/auth"}'

# 2. Write new file
python executor.py --tool write_file --args '{"path": "/project/src/components/auth/Login.tsx", "content": "export const Login = () => {};"}'

# 3. Edit existing file (dry run first)
python executor.py --tool edit_file --args '{"path": "/project/src/config.ts", "edits": [{"oldText": "DEBUG = false", "newText": "DEBUG = true"}], "dryRun": true}'

# 4. Apply edit
python executor.py --tool edit_file --args '{"path": "/project/src/config.ts", "edits": [{"oldText": "DEBUG = false", "newText": "DEBUG = true"}]}'
```

### File Organization

```bash
# 1. Search for files to organize
python executor.py --tool search_files --args '{"path": "/project", "pattern": "**/*.log"}'

# 2. Create archive directory
python executor.py --tool create_directory --args '{"path": "/project/archive/logs"}'

# 3. Move files
python executor.py --tool move_file --args '{"source": "/project/old.log", "destination": "/project/archive/logs/old.log"}'
```

## Configuration

MCP server configuration stored in `config.json`:

- **Command**: `npx`
- **Args**: `["-y", "@modelcontextprotocol/server-filesystem"]`
- **Allowed Directories**: Specified via command-line args or MCP roots protocol

### Allowed Directories

The server restricts access to explicitly allowed directories:

1. **Command-line**: `npx @modelcontextprotocol/server-filesystem /allowed/dir1 /allowed/dir2`
2. **MCP Roots Protocol**: Client provides roots dynamically

**Important**: At least one directory must be allowed for server to operate.

## Error Handling

**Common Issues**:

- Path not allowed: Check allowed directories with `list_allowed_directories`
- File not found: Verify path exists with `get_file_info`
- Permission denied: Check file permissions
- Destination exists: Use different path for `move_file`
- Edit failed: Verify `oldText` matches exactly

**Recovery**:

- Always check allowed directories first
- Use `get_file_info` to verify file existence
- Use `list_directory` to verify parent directory
- Use `edit_file` with `dryRun: true` to preview changes
- Handle errors gracefully - failed file reads don't stop batch operations

## Related

- Original MCP: `@modelcontextprotocol/server-filesystem`
- Git Skill: `.claude/skills/git/`
- MCP Converter: `.claude/skills/mcp-converter/`
- Skill Manager: `.claude/skills/skill-manager/`
