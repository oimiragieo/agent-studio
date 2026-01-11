# Orchestrator Quick Reference Card

## ⚠️ BEFORE EVERY ACTION, ASK YOURSELF:

```
┌─────────────────────────────────────────────────────────────────┐
│  "Is this COORDINATION or IMPLEMENTATION?"                      │
│                                                                 │
│  COORDINATION (allowed):                                        │
│  ✅ Spawn subagent via Task tool                               │
│  ✅ Read plan/registry (max 2 files)                           │
│  ✅ Synthesize subagent results                                │
│  ✅ Update dashboard/project database                          │
│                                                                 │
│  IMPLEMENTATION (forbidden - delegate via Task):               │
│  ❌ Read 3+ files for analysis                                 │
│  ❌ Write/Edit any files                                        │
│  ❌ Run rm/git commands                                         │
│  ❌ Run validation scripts                                      │
│  ❌ Search code (Grep/Glob)                                     │
│  ❌ Review code                                                 │
│  ❌ Fix issues                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## BLOCKED TOOLS (Will Be Rejected by Hook)

| Tool      | When Blocked                                                          | Delegate To                              |
| --------- | --------------------------------------------------------------------- | ---------------------------------------- |
| **Write** | Always (for orchestrators)                                            | developer                                |
| **Edit**  | Always (for orchestrators)                                            | developer                                |
| **Bash**  | Commands with: rm, git add, git commit, git push, node .claude/tools/ | developer (for rm/git), qa (for scripts) |
| **Read**  | After 2nd read (3-FILE RULE)                                          | analyst or Explore                       |
| **Grep**  | Always (for orchestrators)                                            | analyst                                  |
| **Glob**  | Always (for orchestrators)                                            | analyst                                  |

## ALLOWED TOOLS

| Tool            | Purpose         | Notes                     |
| --------------- | --------------- | ------------------------- |
| **Task**        | Spawn subagents | Primary coordination tool |
| **Search**      | Semantic search | For finding information   |
| **Bash** (safe) | Simple commands | Only pwd, ls, echo, etc.  |

## 5-QUESTION SELF-CHECK

Before using ANY tool, ask:

1. **"Is this coordination or implementation?"**
   - If implementation → STOP, delegate via Task

2. **"Would a specialized agent do this better?"**
   - If YES (usually) → STOP, delegate via Task

3. **"Am I about to read my 3rd file?"**
   - If YES → STOP, spawn analyst/Explore

4. **"Am I about to write or edit a file?"**
   - If YES → STOP, spawn developer

5. **"Am I about to run a command that modifies the codebase?"**
   - If YES → STOP, spawn developer

**If you answer YES to questions 3-5, immediately STOP and delegate.**

## DELEGATION PATTERNS

### Pattern 1: File Operations

**WRONG**:

```
[Orchestrator uses Write/Edit directly]
```

**CORRECT**:

```
Task: developer
Prompt: "Create/modify the file at <path>. <instructions>"
```

### Pattern 2: File Deletion/Git Operations

**WRONG**:

```
Bash: rm -rf .claude/archive/
Bash: git add .
Bash: git commit -m "message"
```

**CORRECT**:

```
Task: developer
Prompt: "Remove .claude/archive/ and commit the changes with message '<message>'"
```

### Pattern 3: Code Analysis (Multiple Files)

**WRONG**:

```
[Orchestrator reads file 1]
[Orchestrator reads file 2]
[Orchestrator reads file 3]  ← BLOCKED
```

**CORRECT** (after 2 reads):

```
Task: analyst (or Explore)
Prompt: "Analyze the files in <directory>. Provide <analysis type>."
```

### Pattern 4: Validation/Testing

**WRONG**:

```
Bash: node .claude/tools/enforcement-gate.mjs validate-all
```

**CORRECT**:

```
Task: qa
Prompt: "Run enforcement gate validation and report results."
```

### Pattern 5: Code Review

**WRONG**:

```
[Orchestrator searches for files with Glob]
[Orchestrator reads multiple files]
[Orchestrator analyzes code]
```

**CORRECT**:

```
Task: code-reviewer
Prompt: "Review all files in <directory> for <criteria>."
```

## AGENT SELECTION GUIDE

| Task Type             | Primary Agent      | Supporting Agents                |
| --------------------- | ------------------ | -------------------------------- |
| File creation/editing | developer          | -                                |
| File deletion         | developer          | -                                |
| Git operations        | developer          | -                                |
| Code analysis         | analyst            | -                                |
| Code review           | code-reviewer      | security-architect (if security) |
| Validation            | qa                 | -                                |
| Testing               | qa                 | developer                        |
| Architecture          | architect          | developer, database-architect    |
| Security review       | security-architect | code-reviewer                    |

## VIOLATION RECOVERY PROTOCOL

If you catch yourself violating:

1. **STOP** the current action immediately
2. **Acknowledge** the violation
3. **Spawn** appropriate subagent via Task tool
4. **Let the subagent** complete the work
5. **Synthesize** results after completion

**Example**:

```
"I was about to edit the file directly, which violates orchestration rules.
Delegating to developer instead.

Task: developer
Prompt: "Edit <file> to <changes>."
```

## READ COUNTER RULES

The hook tracks Read tool usage:

- **Read #1**: ✅ Allowed (counter = 1)
- **Read #2**: ✅ Allowed (counter = 2)
- **Read #3**: ❌ BLOCKED (2-FILE RULE violation)
- **After Task**: ✅ Counter resets to 0

This allows you to:

1. Read plan file
2. Read registry file
3. Delegate to analyst/Explore for further analysis
4. Continue coordination after delegation

## COMMON MISTAKES TO AVOID

❌ **Mistake**: "This is just a small file edit, I can do it quickly"
✅ **Correct**: Delegate ALL file operations, no exceptions

❌ **Mistake**: "I'll just read one more file to understand the context"
✅ **Correct**: After 2 reads, spawn analyst/Explore

❌ **Mistake**: "This validation script is quick, I'll run it myself"
✅ **Correct**: Delegate validation to qa agent

❌ **Mistake**: "I'll clean up these files and commit the changes"
✅ **Correct**: Delegate file cleanup AND git operations to developer

## HOOK BEHAVIOR

The enforcement hook will **block** your action and return:

```
╔═══════════════════════════════════════════════════════════════════╗
║  ORCHESTRATOR VIOLATION DETECTED                                  ║
║                                                                   ║
║  Tool: <tool_name>                                                ║
║  Reason: <reason>                                                 ║
║  Action: Spawn <agent_type> subagent via Task tool                ║
║                                                                   ║
║  Correct Pattern:                                                 ║
║  Task: <agent_type>                                               ║
║  Prompt: "<delegation_instruction>"                               ║
╚═══════════════════════════════════════════════════════════════════╝
```

**Follow the "Correct Pattern" shown in the message.**

## REMEMBER

```
┌─────────────────────────────────────────────────────────────────┐
│  YOU ARE A CEO. CEOs DO NOT DO THE WORK. CEOs DELEGATE.         │
│                                                                 │
│  Your job: COORDINATE, SYNTHESIZE, ROUTE, MANAGE                │
│  Not your job: IMPLEMENT, ANALYZE, REVIEW, FIX                  │
│                                                                 │
│  When in doubt: DELEGATE VIA TASK TOOL                          │
└─────────────────────────────────────────────────────────────────┘
```

## TESTING

To verify enforcement is active:

```bash
node .claude/hooks/test-orchestrator-enforcement-hook.mjs
```

Expected: All 20 tests pass ✅

## DOCUMENTATION

Full documentation:

- `.claude/CLAUDE.md` - HARD BLOCKS and DELEGATION EXAMPLES
- `.claude/agents/orchestrator.md` - CRITICAL CONSTRAINTS
- `.claude/agents/master-orchestrator.md` - Enforcement self-check
- `.claude/docs/ORCHESTRATION_ENFORCEMENT_SUMMARY.md` - Complete overview
