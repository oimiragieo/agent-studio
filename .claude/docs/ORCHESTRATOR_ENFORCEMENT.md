# Orchestrator Enforcement System

## Overview

The Orchestrator Enforcement System is a **4-layer defense-in-depth** architecture that ensures orchestrators delegate work to specialized subagents instead of implementing directly. This system combines:

1. **PreToolUse Hooks** (Hard blocking)
2. **Agent Prompt Self-Checks** (Proactive prevention)
3. **PostToolUse Audit** (Detection and logging)
4. **Session Summary Reports** (Compliance scoring)

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ORCHESTRATOR ENFORCEMENT SYSTEM                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────┐    ┌─────────────────────┐    ┌────────────────┐  │
│  │  LAYER 1            │    │  LAYER 2            │    │  LAYER 3       │  │
│  │  PreToolUse Hook    │───▶│  Agent Prompt       │───▶│  PostToolUse   │  │
│  │  (HARD BLOCK)       │    │  Self-Check         │    │  Audit         │  │
│  └─────────────────────┘    │  (SOFT ENFORCE)     │    │  (DETECTION)   │  │
│           │                 └─────────────────────┘    └────────────────┘  │
│           │                                                     │           │
│           │                 ┌─────────────────────┐             │           │
│           │                 │  LAYER 4            │◀────────────┘           │
│           │                 │  Session Report     │                         │
│           │                 │  (COMPLIANCE SCORE) │                         │
│           │                 └─────────────────────┘                         │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      SESSION STATE STORE                             │   │
│  │  .claude/context/tmp/orchestrator-session-state.json                │   │
│  │  - agent_role: "orchestrator" | "subagent"                          │   │
│  │  - read_count: number                                               │   │
│  │  - violations: { tool, timestamp, blocked }[]                       │   │
│  │  - session_id: string                                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Components

### 1. PreToolUse Hook (Layer 1)

**File**: `.claude/hooks/orchestrator-enforcement-pre-tool.mjs`

**Purpose**: Block orchestrator violations BEFORE tool executes

**Detection Method** (Priority Order):

1. **Environment Variable** (HIGHEST PRIORITY): `CLAUDE_AGENT_ROLE=orchestrator`
   - Explicitly set by Task tool when spawning subagents
   - If set to anything other than 'orchestrator', agent is treated as subagent
   - Allows tests to override role by setting `CLAUDE_AGENT_ROLE=developer`
2. **Agent Name Variable**: `CLAUDE_AGENT_NAME` (checks for 'orchestrator' or 'master-orchestrator')
   - If set to any other name (developer, analyst, etc.), agent is treated as subagent
3. **Session State File**: `.claude/context/tmp/orchestrator-session-state.json`
   - Used for persistence across multiple tool calls
   - **Updated dynamically** when env variable indicates role change
4. **No CLAUDE.md parsing**:
   - The hook intentionally does **not** infer orchestrator role from `CLAUDE.md`
   - Prevents false positives that can block subagents in shared repos
   - If env vars and session state are missing, the hook defaults to **subagent** (fail-safe)

**Key Fix (2026-01-11)**: The hook now **prioritizes environment variables** over cached session state. This prevents the hook from incorrectly blocking developer operations when an old orchestrator session state file exists. The `loadSessionState()` function always calls `detectAgentRole()` first and updates the cached role if the environment has changed.

**Enforcement Rules**:

| Tool  | Action | Condition                                       | Delegate To     |
| ----- | ------ | ----------------------------------------------- | --------------- |
| Write | BLOCK  | Always                                          | developer       |
| Edit  | BLOCK  | Always                                          | developer       |
| Grep  | BLOCK  | Always                                          | analyst         |
| Glob  | BLOCK  | Always                                          | analyst         |
| Bash  | BLOCK  | Contains: rm, git, npm run, node .claude/tools/ | developer/qa    |
| Read  | BLOCK  | 3rd+ call (unless coordination file)            | analyst/Explore |

**Coordination File Exceptions** (allowed even after 2-read limit):

- `plan*.json`
- `dashboard.md`
- `project-db.json`
- `workflow*.yaml`
- `artifact-registry.json`
- `.claude/CLAUDE.md`
- `.claude/agents/`
- `.claude/context/runtime/runs/`

### 2. Agent Prompt Self-Check (Layer 2)

**Location**: CLAUDE.md + Agent definition files

**5-Question Protocol**:

1. **Role Check**: Am I an orchestrator?
2. **Tool Whitelist Check**: Is this tool allowed? (Task, TodoWrite, AskUserQuestion, Read≤2)
3. **Read Count Check**: Is this my 3rd+ Read?
4. **Bash Command Check**: Does command contain dangerous keywords?
5. **Analysis Intent Check**: Am I about to analyze code?

**Stop and Delegate** if ANY check fails.

### 3. PostToolUse Audit (Layer 3)

**File**: `.claude/hooks/orchestrator-audit-post-tool.mjs`

**Purpose**: Log all orchestrator tool calls for compliance reporting

**Audit Log Format**:

```json
{
  "session_id": "sess_abc123",
  "timestamp": "2026-01-10T10:30:00Z",
  "agent_role": "orchestrator",
  "tool": "Read",
  "tool_input": { "file_path": "/path/to/file.ts" },
  "outcome": "allowed",
  "read_count_after": 2,
  "violation": null
}
```

**Location**: `.claude/context/logs/orchestrator-audit.log`

### 4. Session Summary Report (Layer 4)

**Generated**: At session end or context recycling

**Report Location**: `.claude/context/reports/orchestrator-compliance-{session_id}.json`

**Report Format**:

```json
{
  "session_id": "sess_abc123",
  "session_start": "2026-01-10T10:00:00Z",
  "session_end": "2026-01-10T11:30:00Z",
  "agent_role": "orchestrator",
  "compliance_score": 85,
  "total_tool_calls": 47,
  "violations": {
    "blocked": 3,
    "warned": 5,
    "allowed": 39
  },
  "violation_breakdown": [
    { "type": "READ_LIMIT_EXCEEDED", "count": 2, "blocked": true },
    { "type": "DIRECT_GREP", "count": 1, "blocked": true },
    { "type": "BASH_DANGEROUS_COMMAND", "count": 2, "warned": true }
  ],
  "recommendations": [
    "Consider spawning analyst for file analysis tasks",
    "Use Task tool to delegate git operations to developer"
  ]
}
```

**Passing Score**: 80% compliance required

## Session State Management

### State File Location

`.claude/context/tmp/orchestrator-session-state.json`

### State Structure

```json
{
  "session_id": "sess_1736518800000",
  "agent_role": "orchestrator",
  "read_count": 0,
  "violations": [],
  "files_read": [],
  "created_at": "2026-01-10T10:00:00Z"
}
```

### State Lifecycle

1. **Created**: First tool call when `CLAUDE_AGENT_ROLE=orchestrator`
2. **Updated**: Hook increments `read_count` and logs violations
3. **Reset**: `read_count` resets to 0 after spawning Task tool
4. **Archived**: Moved to reports directory at session end

### Session State Manager

**File**: `.claude/tools/session-state.mjs`

**CLI Usage**:

```bash
# Initialize session
node .claude/tools/session-state.mjs init orchestrator

# Reset read counter
node .claude/tools/session-state.mjs reset

# Get compliance summary
node .claude/tools/session-state.mjs summary

# Clear session
node .claude/tools/session-state.mjs clear
```

## Block Message Examples

### Write Tool Blocked

```
╔═══════════════════════════════════════════════════════════════════╗
║  ORCHESTRATOR VIOLATION - HARD BLOCK                              ║
╠═══════════════════════════════════════════════════════════════════╣
║  Tool: Write                                                      ║
║  Reason: Orchestrators MUST NOT write files directly              ║
║  Action: Spawn developer subagent via Task tool                   ║
╠═══════════════════════════════════════════════════════════════════╣
║  CORRECT PATTERN:                                                 ║
║  Task: developer                                                  ║
║  Prompt: "[Describe what you want done]"                          ║
╚═══════════════════════════════════════════════════════════════════╝
```

### Read Limit Exceeded

```
╔═══════════════════════════════════════════════════════════════════╗
║  ORCHESTRATOR VIOLATION - 2-FILE RULE EXCEEDED                    ║
╠═══════════════════════════════════════════════════════════════════╣
║  Tool: Read (attempt #3)                                          ║
║  Reason: Orchestrators limited to 2 Read calls (coordination only)║
║  Action: Spawn analyst or Explore subagent via Task tool          ║
╠═══════════════════════════════════════════════════════════════════╣
║  You have already read 2 file(s). Orchestrators are limited       ║
║  to 2 Read calls for coordination purposes only.                  ║
║                                                                   ║
║  For file analysis, spawn analyst or Explore subagent.            ║
╚═══════════════════════════════════════════════════════════════════╝
```

### Dangerous Bash Command

```
╔═══════════════════════════════════════════════════════════════════╗
║  ORCHESTRATOR VIOLATION - DANGEROUS COMMAND BLOCKED               ║
╠═══════════════════════════════════════════════════════════════════╣
║  Command: git add . && git commit -m "changes"                    ║
║  Reason: Orchestrators MUST NOT run git/rm/validation commands    ║
║  Action: Spawn developer or qa subagent via Task tool             ║
╚═══════════════════════════════════════════════════════════════════╝
```

## Testing

### Test Suite

**File**: `.claude/tests/test-orchestrator-enforcement.mjs`

**Run Tests**:

```bash
node .claude/tests/test-orchestrator-enforcement.mjs
```

### Test Coverage

- ✓ Block Write tool for orchestrator
- ✓ Block Edit tool for orchestrator
- ✓ Block Grep tool for orchestrator
- ✓ Block Glob tool for orchestrator
- ✓ Allow first 2 Read calls
- ✓ Block 3rd Read call
- ✓ Allow coordination files after limit
- ✓ Block git commands in Bash
- ✓ Block rm commands in Bash
- ✓ Allow safe Bash commands
- ✓ Allow all tools for subagent
- ✓ Allow Task tool for orchestrator
- ✓ Allow TodoWrite for orchestrator
- ✓ Allow AskUserQuestion for orchestrator

## Integration with Existing Systems

### Settings.json Hook Configuration

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Read|Write|Edit|Bash|Grep|Glob",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/orchestrator-enforcement-pre-tool.mjs",
            "timeout": 5000
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Read|Write|Edit|Bash|Grep|Glob|Task",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/orchestrator-audit-post-tool.mjs"
          }
        ]
      }
    ]
  }
}
```

### Enforcement Gate Integration

**File**: `.claude/tools/enforcement-gate.mjs`

**Validation Function**:

```javascript
export async function validateOrchestratorCompliance(sessionId) {
  // Load session state
  // Calculate compliance score
  // Return validation result
}
```

**Usage**:

```bash
node .claude/tools/enforcement-gate.mjs validate-orchestrator --session-id sess_123
```

## Best Practices

### For Orchestrators

1. **Always spawn subagents** for implementation work
2. **Use Task tool** as primary delegation mechanism
3. **Limit Read calls** to coordination files only (max 2)
4. **Never use Write/Edit/Grep/Glob** - these are HARD BLOCKED
5. **Check session state** before attempting risky operations

### For Developers

1. **Test hooks locally** before committing
2. **Review audit logs** regularly for violations
3. **Monitor compliance scores** in session reports
4. **Update coordination file patterns** as needed
5. **Document hook behavior** in architecture docs

## Troubleshooting

### Hook Not Blocking

**Symptoms**: Orchestrator can use blocked tools

**Diagnosis**:

1. Check if `CLAUDE_AGENT_ROLE=orchestrator` is set
2. Verify session state file exists
3. Review hook execution logs

**Fix**:

```bash
# Reinitialize session
node .claude/tools/session-state.mjs init orchestrator

# Verify hook is registered
cat .claude/settings.json | grep orchestrator-enforcement
```

### False Positives (Blocking Subagents)

**Symptoms**: Subagents cannot use Write/Edit

**Diagnosis**:

1. Check session state `agent_role` field
2. Verify subagent doesn't inherit orchestrator env var

**Fix**:

```bash
# Clear orchestrator session
node .claude/tools/session-state.mjs clear

# Subagent should create new session with role=subagent
```

### Session State Corruption

**Symptoms**: Hook errors, invalid JSON

**Diagnosis**:

1. Read session state file
2. Check for JSON syntax errors

**Fix**:

```bash
# Clear corrupted state
node .claude/tools/session-state.mjs clear

# Reinitialize
node .claude/tools/session-state.mjs init orchestrator
```

## Performance

### Hook Overhead

- **PreToolUse Hook**: ~5ms per tool call
- **PostToolUse Audit**: ~2ms per tool call
- **Session State I/O**: ~3ms per read/write

**Total Overhead**: <10ms per tool call (negligible)

### Scalability

- Session state file: <10KB typical size
- Audit log: ~1KB per tool call (50KB/hour for active sessions)
- Compliance reports: ~5KB per session

**Storage**: <1MB per day for typical usage

## Security Considerations

### Bypass Prevention

**Cannot Prevent**:

- Direct API calls (Claude Code limitation)
- Manual file editing outside Claude
- Environment variable manipulation

**Can Prevent**:

- Tool calls via Claude Code hooks
- Session state tampering (validated on each call)
- Coordination file abuse (pattern matching)

### Audit Trail

All violations logged with:

- Timestamp
- Tool name and input
- Session ID
- Agent role
- Violation type
- Corrective action

**Immutable Logs**: Append-only audit files for forensic analysis

## Version History

| Version | Date       | Changes                             |
| ------- | ---------- | ----------------------------------- |
| 2.0.0   | 2026-01-10 | Complete 4-layer enforcement system |
| 1.0.0   | 2025-01-05 | Initial prompt-based enforcement    |

## Related Documents

- `.claude/CLAUDE.md` - Root orchestration rules
- `.claude/context/artifacts/orchestrator-enforcement-architecture.md` - System architecture
- `.claude/hooks/README.md` - Hook system documentation
- `.claude/docs/AGENT_SELECTION_GUIDE.md` - Agent delegation guide
