---
name: git
description: Git repository operations - status, diff, commit, branch, log. Converted from MCP server for 90%+ context savings.
context:fork: true
allowed-tools: read, write, bash
version: 1.0
best_practices:
  - Check status before committing to see what will be committed
  - Use git_diff_staged to review changes before committing
  - Write clear, descriptive commit messages
  - Create branches for new features or fixes
  - Use git_log to understand commit history
error_handling: graceful
streaming: supported
---

# Git Skill

## Overview

This skill provides comprehensive Git operations through a local MCP server. It enables version control management including status checking, staging, committing, branching, diffing, and history viewing.

**Context Savings**: ~98% reduction
- **MCP Mode**: ~25,000 tokens always loaded
- **Skill Mode**: ~500 tokens metadata + on-demand loading

## When to Use

- Check repository status and see what files have changed
- Stage files for commit
- Create commits with messages
- View differences between commits, branches, or working tree
- Create and switch between branches
- View commit history with flexible filtering
- Inspect specific commits
- Reset staged changes

## Quick Reference

```bash
# List available tools
python executor.py --list

# Check repository status
python executor.py --tool git_status --args '{"repo_path": "."}'

# View unstaged changes
python executor.py --tool git_diff_unstaged --args '{"repo_path": "."}'

# View staged changes
python executor.py --tool git_diff_staged --args '{"repo_path": "."}'

# Stage files
python executor.py --tool git_add --args '{"repo_path": ".", "files": ["file1.ts", "file2.ts"]}'

# Commit changes
python executor.py --tool git_commit --args '{"repo_path": ".", "message": "feat: add new feature"}'

# View commit log
python executor.py --tool git_log --args '{"repo_path": ".", "max_count": 10}'

# Create branch
python executor.py --tool git_create_branch --args '{"repo_path": ".", "branch_name": "feature/new-feature"}'

# Switch branch
python executor.py --tool git_checkout --args '{"repo_path": ".", "branch_name": "main"}'
```

## Tools

### git_status

Shows the working tree status - which files are modified, staged, or untracked.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `repo_path` | string | Yes | Path to the git repository |

**Example:**
```bash
python executor.py --tool git_status --args '{"repo_path": "."}'
```

**Returns:**
```
On branch main
Changes not staged for commit:
  modified:   src/index.ts

Untracked files:
  src/new-file.ts
```

---

### git_diff_unstaged

Shows changes in the working directory that are not yet staged.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `repo_path` | string | Yes | - | Path to the git repository |
| `context_lines` | integer | No | 3 | Number of context lines around changes |

**Example:**
```bash
python executor.py --tool git_diff_unstaged --args '{"repo_path": ".", "context_lines": 5}'
```

**Returns:**
Unified diff format showing line-by-line changes in unstaged files.

---

### git_diff_staged

Shows changes that are staged for commit.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `repo_path` | string | Yes | - | Path to the git repository |
| `context_lines` | integer | No | 3 | Number of context lines around changes |

**Example:**
```bash
python executor.py --tool git_diff_staged --args '{"repo_path": "."}'
```

**Returns:**
Unified diff format showing line-by-line changes in staged files.

---

### git_diff

Shows differences between branches, commits, or other targets.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `repo_path` | string | Yes | - | Path to the git repository |
| `target` | string | Yes | - | Branch name, commit SHA, or diff target (e.g., "main", "HEAD~1") |
| `context_lines` | integer | No | 3 | Number of context lines around changes |

**Example:**
```bash
# Compare current branch to main
python executor.py --tool git_diff --args '{"repo_path": ".", "target": "main"}'

# Compare to previous commit
python executor.py --tool git_diff --args '{"repo_path": ".", "target": "HEAD~1"}'

# Compare two commits
python executor.py --tool git_diff --args '{"repo_path": ".", "target": "abc123..def456"}'
```

**Returns:**
Unified diff format showing differences between current state and target.

---

### git_add

Adds file contents to the staging area.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `repo_path` | string | Yes | Path to the git repository |
| `files` | array | Yes | List of file paths to stage (relative to repo root) |

**Example:**
```bash
# Stage specific files
python executor.py --tool git_add --args '{"repo_path": ".", "files": ["src/index.ts", "README.md"]}'

# Stage all files (use "." in files array)
python executor.py --tool git_add --args '{"repo_path": ".", "files": ["."]}'
```

---

### git_commit

Records changes to the repository with a commit message.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `repo_path` | string | Yes | Path to the git repository |
| `message` | string | Yes | Commit message |

**Example:**
```bash
python executor.py --tool git_commit --args '{"repo_path": ".", "message": "feat: add user authentication"}'
```

**Best Practices:**
- Use conventional commit format: `type: description`
- Common types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`
- Keep first line under 72 characters
- Add detailed description in multi-line messages

---

### git_reset

Unstages all staged changes (does not modify working directory).

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `repo_path` | string | Yes | Path to the git repository |

**Example:**
```bash
python executor.py --tool git_reset --args '{"repo_path": "."}'
```

**Note:** This is equivalent to `git reset HEAD` - it unstages files but preserves working directory changes.

---

### git_log

Shows the commit logs with flexible filtering options.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `repo_path` | string | Yes | - | Path to the git repository |
| `max_count` | integer | No | 10 | Maximum number of commits to show |
| `start_timestamp` | string | No | null | Start timestamp for filtering commits |
| `end_timestamp` | string | No | null | End timestamp for filtering commits |

**Timestamp Formats:**
- ISO 8601: `"2024-01-15T14:30:25"`
- Relative: `"2 weeks ago"`, `"yesterday"`
- Absolute: `"2024-01-15"`, `"Jan 15 2024"`

**Example:**
```bash
# Last 10 commits
python executor.py --tool git_log --args '{"repo_path": ".", "max_count": 10}'

# Last 20 commits
python executor.py --tool git_log --args '{"repo_path": ".", "max_count": 20}'

# Commits from last week
python executor.py --tool git_log --args '{"repo_path": ".", "start_timestamp": "1 week ago"}'

# Commits in date range
python executor.py --tool git_log --args '{"repo_path": ".", "start_timestamp": "2024-01-01", "end_timestamp": "2024-01-31"}'
```

**Returns:**
```
commit abc123def456...
Author: Name <email@example.com>
Date: Mon Jan 15 14:30:25 2024

    feat: add new feature
```

---

### git_create_branch

Creates a new branch from an optional base branch.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `repo_path` | string | Yes | - | Path to the git repository |
| `branch_name` | string | Yes | - | Name for the new branch |
| `base_branch` | string | No | null | Branch to create from (defaults to current branch) |

**Example:**
```bash
# Create branch from current branch
python executor.py --tool git_create_branch --args '{"repo_path": ".", "branch_name": "feature/new-feature"}'

# Create branch from specific base
python executor.py --tool git_create_branch --args '{"repo_path": ".", "branch_name": "feature/new-feature", "base_branch": "main"}'
```

---

### git_checkout

Switches branches.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `repo_path` | string | Yes | Path to the git repository |
| `branch_name` | string | Yes | Name of branch to switch to |

**Example:**
```bash
python executor.py --tool git_checkout --args '{"repo_path": ".", "branch_name": "main"}'
```

**Note:** Branch must already exist. Use `git_create_branch` to create a new branch.

---

### git_show

Shows the contents of a specific commit.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `repo_path` | string | Yes | Path to the git repository |
| `revision` | string | Yes | Commit SHA, branch name, or revision (e.g., "HEAD", "HEAD~1", "abc123") |

**Example:**
```bash
# Show latest commit
python executor.py --tool git_show --args '{"repo_path": ".", "revision": "HEAD"}'

# Show specific commit
python executor.py --tool git_show --args '{"repo_path": ".", "revision": "abc123def456"}'

# Show commit 2 commits ago
python executor.py --tool git_show --args '{"repo_path": ".", "revision": "HEAD~2"}'
```

**Returns:**
Commit metadata (author, date, message) and full diff of changes.

---

### git_branch

List Git branches with filtering options.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `repo_path` | string | Yes | Path to the git repository |
| `branch_type` | string | Yes | Type of branches to list: `"local"`, `"remote"`, or `"all"` |
| `contains` | string | No | Only list branches containing this commit SHA |
| `not_contains` | string | No | Only list branches NOT containing this commit SHA |

**Example:**
```bash
# List local branches
python executor.py --tool git_branch --args '{"repo_path": ".", "branch_type": "local"}'

# List remote branches
python executor.py --tool git_branch --args '{"repo_path": ".", "branch_type": "remote"}'

# List all branches
python executor.py --tool git_branch --args '{"repo_path": ".", "branch_type": "all"}'

# List branches containing a commit
python executor.py --tool git_branch --args '{"repo_path": ".", "branch_type": "local", "contains": "abc123"}'

# List branches NOT containing a commit
python executor.py --tool git_branch --args '{"repo_path": ".", "branch_type": "local", "not_contains": "abc123"}'
```

**Returns:**
```
* main
  feature/new-feature
  develop
```

---

## Common Workflows

### Check Status and Commit Changes

```bash
# 1. Check what files have changed
python executor.py --tool git_status --args '{"repo_path": "."}'

# 2. View unstaged changes
python executor.py --tool git_diff_unstaged --args '{"repo_path": "."}'

# 3. Stage specific files
python executor.py --tool git_add --args '{"repo_path": ".", "files": ["src/index.ts", "README.md"]}'

# 4. View staged changes
python executor.py --tool git_diff_staged --args '{"repo_path": "."}'

# 5. Commit with message
python executor.py --tool git_commit --args '{"repo_path": ".", "message": "feat: add new feature"}'
```

### Create Feature Branch

```bash
# 1. Check current branch
python executor.py --tool git_status --args '{"repo_path": "."}'

# 2. Create new branch from main
python executor.py --tool git_create_branch --args '{"repo_path": ".", "branch_name": "feature/new-feature", "base_branch": "main"}'

# 3. Switch to new branch
python executor.py --tool git_checkout --args '{"repo_path": ".", "branch_name": "feature/new-feature"}'

# 4. Make changes and commit
# ... (stage and commit as above)
```

### View History

```bash
# 1. View recent commits
python executor.py --tool git_log --args '{"repo_path": ".", "max_count": 10}'

# 2. Inspect specific commit
python executor.py --tool git_show --args '{"repo_path": ".", "revision": "abc123"}'

# 3. Compare to another branch
python executor.py --tool git_diff --args '{"repo_path": ".", "target": "main"}'
```

### Branch Management

```bash
# 1. List all branches
python executor.py --tool git_branch --args '{"repo_path": ".", "branch_type": "all"}'

# 2. Check which branches contain a commit
python executor.py --tool git_branch --args '{"repo_path": ".", "branch_type": "local", "contains": "abc123"}'

# 3. Switch to different branch
python executor.py --tool git_checkout --args '{"repo_path": ".", "branch_name": "develop"}'
```

### Reset Staged Changes

```bash
# 1. Check what's staged
python executor.py --tool git_diff_staged --args '{"repo_path": "."}'

# 2. Unstage all files
python executor.py --tool git_reset --args '{"repo_path": "."}'

# 3. Verify reset
python executor.py --tool git_status --args '{"repo_path": "."}'
```

## Best Practices

### Commit Messages

- **Use Conventional Commits**: `type: description`
  - `feat`: New feature
  - `fix`: Bug fix
  - `docs`: Documentation changes
  - `refactor`: Code refactoring
  - `test`: Adding/updating tests
  - `chore`: Maintenance tasks

- **Keep it concise**: First line under 72 characters
- **Be descriptive**: Explain what and why, not how

### Workflow

1. **Always check status first**: Know what you're committing
2. **Review diffs before committing**: Use `git_diff_staged`
3. **Stage selectively**: Don't use `git add .` blindly
4. **Commit frequently**: Small, focused commits are better
5. **Use branches**: Create feature branches for new work

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `refactor/description` - Code refactoring
- `docs/description` - Documentation updates

## Configuration

MCP server configuration stored in `config.json`:
- **Command**: `python`
- **Args**: `["-m", "mcp_server_git"]`

### Requirements

- Python with `mcp_server_git` package installed
- Valid git repository at `repo_path`

## Error Handling

**Common Issues:**
- **Not a git repository**: Ensure `repo_path` points to a valid git repo
- **Nothing to commit**: Check status first, stage files before committing
- **Merge conflicts**: Resolve conflicts before committing
- **Branch already exists**: Use unique branch names or checkout existing branch

**Recovery:**
- Check repository status with `git_status`
- Use `git_reset` to unstage if needed
- Review logs with `git_log` to understand repository state
- Verify branch exists with `git_branch` before checkout

## Integration

### With GitHub Skill

This skill works alongside the `github` skill:
- **git**: Local repository operations
- **github**: Remote GitHub operations (PRs, issues, etc.)

### With Workflows

Common workflow integration:
1. Use `git_status` to check changes
2. Use `git_diff_staged` to review before commit
3. Use `git_commit` to commit changes
4. Use `github` skill to create PR

## Related

- Original MCP server: `python -m mcp_server_git`
- GitHub Skill: `.claude/skills/github/`
- MCP Converter Skill: `.claude/skills/mcp-converter/`
- Skill Manager: `.claude/skills/skill-manager/`
