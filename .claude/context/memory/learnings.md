1. Create unified hook
2. Write comprehensive tests
3. Register in settings.json immediately
4. Verify with test operation
5. THEN mark complete

---

## 2026-01-27: Router Hook Architecture Verification

**Context**: Investigated reported router-self-check.cjs errors with corrupted shell command fragments.

**Analysis Results**:

1. **router-self-check.cjs is NOT registered in settings.json** - only routing-guard.cjs is used as the unified routing hook
2. **routing-guard.cjs consolidates 5 hooks**: router-self-check, planner-first-guard, task-create-guard, security-review-guard, router-write-guard
3. **All hooks correctly handle corrupted input** - parseHookInputAsync() from hook-input.cjs sanitizes input and returns null for invalid JSON

**Test Coverage Verified**:

- router-self-check.test.cjs: 34 tests passing
- routing-guard.test.cjs: 42 tests passing
- All 213 routing hook tests passing

**ALWAYS_ALLOWED_WRITE_PATTERNS Working Correctly**:

```javascript
const ALWAYS_ALLOWED_WRITE_PATTERNS = [
  /\.claude[\/\\]context[\/\\]runtime[\/\\]/, // Runtime state files
  /\.claude[\/\\]context[\/\\]memory[\/\\]/, // Memory files
  /\.gitkeep$/, // Git keep files
];
```

These patterns allow memory file writes regardless of router state, fixing the reflection-agent blocking issue (2026-01-27 learnings entry above).

**State File Location**: `.claude/context/runtime/router-state.json`

**Key Functions**:

- `enterAgentMode(taskDescription)` - Sets mode='agent' and taskSpawned=true
- `isAlwaysAllowedWrite(filePath)` - Checks if write should bypass router check
- `checkWriteAllowed()` - Main write permission check

**If Corrupted Error Messages Appear**:

1. Check if old hooks are cached in process memory (restart Claude session)
2. Verify settings.json only has routing-guard.cjs for routing checks
3. Use `DEBUG_HOOKS=true` to see detailed hook logging

---

## 2026-01-27: Bash Tool Uses Git Bash on Windows

**Context**: Encountered "syntax error: unexpected end of file" when using Windows CMD syntax in Bash tool.

**Root Cause**: The Bash tool runs through Git Bash (`/usr/bin/bash`), NOT Windows CMD or PowerShell.

**Key Rules**:
1. **Always use bash/POSIX syntax** for shell commands
2. **Never use** Windows CMD syntax (`if not exist`, `copy`, `del`, `type`)
3. **Never use** PowerShell syntax (`Remove-Item`, `New-Item`, `Test-Path`)

**Common Patterns**:
| Task | ✅ Correct | ❌ Wrong |
|------|-----------|---------|
| Create dir | `mkdir -p path` | `if not exist path mkdir path` |
| Create file | `echo "" > file` | `echo. > file` |
| Check exists | `[ -d "path" ]` | `if exist path` |

**Updated Skill**: `.claude/skills/windows-compatibility/SKILL.md` (v2.0.0)

**Action**: Always reference this skill when writing Bash commands on Windows environments.
