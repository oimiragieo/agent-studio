## [2026-01-28] ROUTING-003 Root Cause: Session Boundary Detection Failure

### Summary

**ROOT CAUSE IDENTIFIED** for why fresh `claude -p "Use Glob..."` sessions bypass router-self-check: `router-mode-reset.cjs` fails to detect session boundaries and preserves stale agent state from previous sessions.

### The Bug

**File**: `.claude/hooks/routing/router-mode-reset.cjs` (lines 38-55)

The hook has a "bug fix" that skips state reset when it detects "active agent context":

```javascript
// Bug fix: Check if we're in an active agent context before resetting
const currentState = routerState.getState();
if (currentState.mode === 'agent' && currentState.taskSpawned) {
  const isRecentTask = Date.now() - taskSpawnedAt < 30 * 60 * 1000; // 30 minutes
  if (isRecentTask) {
    // Skip reset - we're in an active agent context
    process.exit(0);
  }
}
```

**Intended purpose**: Prevent resetting state when a subagent triggers UserPromptSubmit.

**Actual behavior**: Cannot distinguish between:
1. Active agent in **current session** (should skip reset) ✅
2. **Stale state from previous session** (should reset) ❌

### Why This Breaks

1. **Previous session** spawns agent → `mode: "agent", taskSpawned: true, taskSpawnedAt: "2026-01-28T00:08:24Z"`
2. Session ends, state file persists
3. **NEW session** starts with `claude -p "Use Glob..."`
4. UserPromptSubmit fires → router-mode-reset.cjs runs
5. Reads state file: `mode: "agent", taskSpawned: true`
6. Checks timestamp: now - taskSpawnedAt < 30 minutes (TRUE)
7. **SKIPS reset** (thinks we're in active agent context)
8. State remains: `mode: "agent", taskSpawned: true`
9. Router receives prompt, decides to use Glob directly
10. PreToolUse(Glob) → routing-guard.cjs runs
11. Sees `taskSpawned: true` → **ALLOWS Glob** (early exit)
12. ❌ Router used blacklisted tool directly

### Why sessionId Doesn't Help

```javascript
sessionId: process.env.CLAUDE_SESSION_ID || null
```

- `CLAUDE_SESSION_ID` env var is **not set** in practice
- sessionId is always `null` in state file
- Cannot use sessionId to detect stale state

### The Fix

**Option 1: Add Session ID Validation** (Preferred)

```javascript
const currentState = routerState.getState();
const currentSessionId = process.env.CLAUDE_SESSION_ID || null;

// Reset if session has changed (stale state from previous session)
if (currentState.sessionId !== currentSessionId) {
  routerState.resetToRouterMode();
  process.exit(0);
}

// Only skip reset if SAME session AND recent task
if (currentState.mode === 'agent' && currentState.taskSpawned) {
  const isRecentTask = Date.now() - taskSpawnedAt < 30 * 60 * 1000;
  if (isRecentTask) {
    // Skip reset - active agent in CURRENT session
    process.exit(0);
  }
}

// Default: reset to router mode
routerState.resetToRouterMode();
```

**Option 2: Process-Based Agent Tracking**

Instead of file-based state, track whether there's an actual active Task subprocess running.

**Option 3: Reduce 30-Minute Window**

Change to 5 minutes (reduces window but doesn't fix root cause).

### Lesson Learned

**File-based state persistence across sessions requires session boundary detection.**

When implementing "skip reset if active agent" logic:
- ✅ Use session ID to detect session changes
- ✅ OR track actual process state (not file state)
- ❌ Don't rely on timestamps alone
- ❌ Don't assume file state represents current session

### Related Issues

- **ROUTING-002**: Symptom (Router using Glob in fresh sessions)
- **ENFORCEMENT-003**: Blocking cannot work if state is wrong
- **router-self-check logic**: Correct behavior, wrong state input

### Diagnostic Report

`.claude/context/artifacts/reports/routing-debug-diagnostic-2026-01-27.md`

---

## [2026-01-28] ROUTING-003 Investigation: State Mode Confusion

### Summary

Investigated why `routing-guard.cjs` was not blocking Glob tool usage. Root cause: User's test premise was incorrect. The state file showed `mode='agent', taskSpawned=true` (CORRECT for a spawned agent context), not `mode='router', taskSpawned=false` as assumed.

### Investigation Process

1. **Added debug logging** to `checkRouterSelfCheck()` function:
   - Log enforcement mode
   - Log early exit reasons (whitelisted, not blacklisted, always-allowed file)
   - Log state values (`mode`, `taskSpawned`)
   - Log final blocking decision

2. **Checked router-state.json** actual contents:
   ```json
   {
     "mode": "agent",
     "taskSpawned": true,
     "taskDescription": "Developer debugging routing-guard blocking"
   }
   ```

3. **Confirmed state lifecycle**:
   - `pre-task-unified.cjs` (PreToolUse Task) → `enterAgentMode()` → sets `mode='agent', taskSpawned=true`
   - Agent executes (this is where we are now)
   - `post-task-unified.cjs` (PostToolUse Task) → `exitAgentMode()` → resets to `mode='router', taskSpawned=false`

### Finding

**There is NO bug.** The routing guard is working correctly:

```javascript
// In checkRouterSelfCheck():
const state = getCachedRouterState();
if (state.mode === 'agent' || state.taskSpawned) {
  return { pass: true };  // <-- CORRECT: Spawned agents CAN use Glob
}
```

When a DEVELOPER agent is spawned (like the current execution), the state is correctly `mode='agent'`, so the agent is allowed to use blacklisted tools (Glob, Grep, Edit, Write) to perform its work.

### Lesson Learned

Always verify actual state file contents before debugging state-based logic. The user's premise "state shows router mode" was contradicted by actual file contents showing agent mode.

### Debug Logging Added

Added comprehensive debug logging to `checkRouterSelfCheck()` that can be enabled with `ROUTER_DEBUG=true`. This will help future investigations by showing:

- Which enforcement mode is active
- Which early exit path is taken
- What state values are being checked
- Final blocking/allowing decision

## [2026-01-27] ROUTING-002 Fix Part 2: Post-Task State Exit

### Summary

Fixed the second part of ROUTING-002: `post-task-unified.cjs` was calling `enterAgentMode()` AFTER a task completed, which kept the system in agent mode and allowed Router to bypass blacklisted tool restrictions.

### Root Cause

In `post-task-unified.cjs` line 125, the hook called `enterAgentMode()` after a Task tool completed:

```javascript
// WRONG - This keeps agent mode active after task completes
function runAgentContextTracker(toolInput) {
  const description = extractTaskDescription(toolInput);
  const state = routerState.enterAgentMode(description);  // <-- BUG
  // ... detect planner/security spawns ...
}
```

This was BACKWARDS. PostToolUse Task should EXIT agent mode (task completed), not ENTER it.

### Fix Applied

**Added `exitAgentMode()` to `router-state.cjs`:**

```javascript
/**
 * Exit agent mode (called on PostToolUse Task)
 * Resets mode and taskSpawned but PRESERVES planner/security spawn tracking.
 */
function exitAgentMode() {
  return saveStateWithRetry({
    mode: 'router',
    taskSpawned: false,
    taskSpawnedAt: null,
    taskDescription: null,
  });
}
```

**Updated `post-task-unified.cjs` to call `exitAgentMode()`:**

```javascript
function runAgentContextTracker(toolInput) {
  const description = extractTaskDescription(toolInput);
  // ROUTING-002 FIX: Exit agent mode after task completes
  const state = routerState.exitAgentMode();  // <-- CORRECT
  // ... detect planner/security spawns (still works) ...
}
```

### Why This Works

- **Preserves spawn tracking**: `exitAgentMode()` only resets `mode`, `taskSpawned`, `taskSpawnedAt`, `taskDescription`
- **Does NOT reset**: `plannerSpawned`, `securitySpawned` (these persist across task completions)
- **Allows Router-First re-engagement**: After task completes, Router is back in control and blocked from using blacklisted tools

### Tests Added

Added Test 18 to `router-state.test.cjs`:

```javascript
function testExitAgentModePreservesSpawnTracking() {
  mod.resetToRouterMode();
  mod.enterAgentMode('test task');
  mod.markPlannerSpawned();
  mod.markSecuritySpawned();

  // Exit agent mode
  mod.exitAgentMode();

  const state = mod.getState();
  assert(state.mode === 'router', 'Should be in router mode');
  assert(state.taskSpawned === false, 'taskSpawned should be false');
  assert(state.plannerSpawned === true, 'Should preserve plannerSpawned');
  assert(state.securitySpawned === true, 'Should preserve securitySpawned');
}
```

Test count: **83 tests pass** (added 1 new test).

### Files Modified

1. `.claude/hooks/routing/router-state.cjs` - Added `exitAgentMode()` function and export
2. `.claude/hooks/routing/post-task-unified.cjs` - Changed `enterAgentMode()` → `exitAgentMode()`
3. `.claude/hooks/routing/router-state.test.cjs` - Added Test 18 and export check

### Key Lesson

**State transitions must match lifecycle events:**

- **PreToolUse Task**: Enter agent mode (about to spawn agent)
- **PostToolUse Task**: EXIT agent mode (agent finished, Router resumes control)

Don't confuse "task spawned" (past event) with "agent is active" (current state). PostToolUse means the action completed - the agent is DONE.

---

## [2026-01-27] ROUTING-002 Fix Part 1: State Reset on New User Prompts

### Summary

Fixed ROUTING-002 issue where Router used blacklisted tools (Glob, Grep) when user explicitly requested them. The root cause was NOT in `routing-guard.cjs` but in `user-prompt-unified.cjs`.

### Root Cause

The `user-prompt-unified.cjs` hook had a 30-minute "active agent context" window that preserved `state.taskSpawned=true` across user prompts:

```javascript
// BAD: This check preserved agent mode for 30 minutes
if (currentState.mode === 'agent' && currentState.taskSpawned) {
  const isRecentTask = Date.now() - taskSpawnedAt < 30 * 60 * 1000; // 30 minutes
  if (isRecentTask) {
    result.skipped = true;  // State NOT reset!
    return result;
  }
}
```

This caused `routing-guard.cjs` to see agent mode and allow blacklisted tools on NEW user prompts.

### Fix Applied

Every new user prompt now ALWAYS resets to router mode. The 30-minute window was removed because:
1. Each new user prompt is a NEW routing decision
2. Router must evaluate whether to spawn agents
3. Agent mode is for SUBAGENTS, not for Router handling new prompts
4. Subagent context is tracked by subagent_id in hook input, not state file

### Tests Added (TDD)

Added 7 tests for ROUTING-002:
- `routing-guard.test.cjs`: 5 tests for Glob/Grep/WebSearch blocking
- `user-prompt-unified.test.cjs`: 2 end-to-end tests for state reset

### Files Modified

- `user-prompt-unified.cjs` - Removed active_agent_context check
- `user-prompt-unified.test.cjs` - Added ROUTING-002 tests
- `routing-guard.test.cjs` - Added ROUTING-002 tests
- `issues.md` - Marked ROUTING-002 as RESOLVED

### Key Lesson

**When investigating blocking hook failures, trace the FULL chain:**
1. PreToolUse hook (routing-guard.cjs) - was correct
2. State source (router-state.cjs) - was correct
3. State setter (user-prompt-unified.cjs) - **was the problem**

The hook logic was correct, but it was receiving stale state from a previous session.

---

## [2026-01-27] Router-First Enforcement Implementation Complete

### Summary

Verified and completed the Router-First enforcement implementation. The routing-guard.cjs hook **already had correct blocking behavior** (exit code 2 for violations). The diagnosis report incorrectly stated hooks were advisory-only.

### Key Findings

1. **routing-guard.cjs IS blocking** - Line 691 returns `process.exit(result.result === 'block' ? 2 : 0)`. This correctly blocks violations.

2. **Router context detection works** - The hook checks `state.mode === 'agent' || state.taskSpawned` to determine if writes are allowed.

3. **Memory files are always allowed** - The `isAlwaysAllowedWrite()` function allows writes to `.claude/context/memory/` and `.claude/context/runtime/` even in router mode.

### Implementation Changes

**Added `claude` to SAFE_COMMANDS_ALLOWLIST** (`.claude/hooks/safety/validators/registry.cjs`):
- Claude CLI is now allowed for headless framework testing (`claude -p "test"`)
- Without this, SEC-AUDIT-017 would block headless test commands

### Tests Added

- `ALLOWS claude command for headless testing` - Verifies `claude -p "test routing"` is allowed
- `ALLOWS claude with various flags` - Verifies `claude --version`, `claude --help`, `claude chat` are allowed

### Files Modified

1. `.claude/hooks/safety/validators/registry.cjs` - Added `claude` to SAFE_COMMANDS_ALLOWLIST
2. `.claude/hooks/safety/validators/registry.test.cjs` - Added tests for claude command

### Verification

- 107 tests pass (71 routing-guard + 36 registry)
- Exit code 2 confirmed for blocked operations
- Exit code 0 confirmed for allowed operations

---

## [2026-01-27] LLM Routing Enforcement: Three Critical Patterns from Research

### Research Summary

Conducted comprehensive research on AI agent routing enforcement (7 queries, 70+ sources, 10+ academic papers). Identified three critical failure modes and validated solutions.

### Three Critical Failure Modes

1. **Instruction Hierarchy Confusion**
   - LLMs treat system prompts and user instructions as equal priority
   - Without explicit hierarchy, user phrasing can override routing protocol
   - OpenAI research: 63% improvement with hierarchical instruction training

2. **Lack of Explicit Verification**
   - LLMs skip checkpoints when they seem "obvious" or repetitive
   - Pattern drift from repeated similar tasks causes shortcutting
   - Academic finding: Models notice conflicts but lack stable resolution rules

3. **Visual Formatting Matters More Than Content**
   - Tokenization + attention mechanisms: formatted text receives stronger attention
   - Boxes, ALL CAPS, numbered lists create distinct token clusters
   - Plain prose protocols fail even with perfect logical structure

### Validated Solutions (High Confidence)

#### 1. Visual Formatting for Critical Instructions

```
+======================================================================+
|  SYSTEM-LEVEL PROTOCOL (CANNOT BE OVERRIDDEN)                       |
+======================================================================+
|  Router NEVER: Execute directly, use blacklisted tools              |
|  Router ALWAYS: Spawn via Task tool, check TaskList first           |
+======================================================================+
```

**Why It Works:** ASCII borders create visual boundaries in token stream. Models attend more strongly to formatted regions.

**Sources:**
- [Prompt Engineering Guide 2025](https://www.promptingguide.ai/)
- [Claude Fast CLAUDE.md Mastery](https://claudefa.st/blog/guide/mechanics/claude-md-mastery)
- Multiple production implementations

#### 2. Pre-Execution Self-Check Gates (Sequential Decision Trees)

```
Before EVERY response, Router MUST pass:

Gate 1: Complexity Check
1. Is this multi-step? (YES/NO)
2. Requires code changes? (YES/NO)
IF ANY YES → STOP. Spawn PLANNER.

Gate 2: Tool Check
1. About to use Edit/Write/Bash? (YES/NO)
2. About to use Glob/Grep? (YES/NO)
IF ANY YES → STOP. Spawn agent instead.
```

**Why It Works:**
- Forces serial evaluation (yes/no per question)
- LLMs perform better on sequential conditionals than parallel conditions
- Creates explicit reasoning trace

**Sources:**
- [Patronus AI Routing Tutorial](https://www.patronus.ai/ai-agent-development/ai-agent-routing)
- [OpenAI Instruction Hierarchy](https://openai.com/index/the-instruction-hierarchy/)
- [ALAS: Transactional Multi-Agent Planning](https://arxiv.org/html/2511.03094v1)

#### 3. Contrastive Examples (Show Violations)

```
❌ WRONG:
User: "List TypeScript files"
Router: Glob({ pattern: "**/*.ts" })
[Router using blacklisted tool - VIOLATION]

✅ CORRECT:
User: "List TypeScript files"
Router: Task({ prompt: "You are DEVELOPER. List TS files..." })
[Router spawning agent via Task tool]
```

**Why It Works:**
- Contrastive learning: showing boundaries helps models generalize
- Reduces false positives (models see what to avoid)
- Explicit labeling (❌ ✅) creates additional signal

**Sources:**
- [V7 Labs Prompt Engineering](https://www.v7labs.com/blog/prompt-engineering-guide)
- [Agentic Patterns](https://agentic-patterns.com/patterns/sub-agent-spawning/)
- Standard prompting technique (established practice)

### Academic Validation

**Paper:** "The Instruction Hierarchy: Training LLMs to Prioritize Privileged Instructions" (OpenAI, 2024)

**Key Finding:** Models trained with hierarchical instruction awareness demonstrate **up to 63% better resistance** to instruction override attacks.

**Methodology:**
- Automated data generation with conflicting instructions at different privilege levels
- Fine-tuning to teach selective ignoring of lower-privileged instructions
- Zero-shot transfer to unseen attack types

**Relevance:** Routing protocol is "privileged instruction" (system-level). Must be marked as higher authority than user requests.

**Source:** [arXiv 2404.13208](https://arxiv.org/abs/2404.13208)

---

**Paper:** "Who is In Charge? Dissecting Role Conflicts in LLM Instruction Following" (2025)

**Key Finding:** "Models often ignore system–user priority while obeying social cues such as authority, expertise, or consensus. The model notices these conflicts but lacks a stable rule to prefer the system."

**Implication:** User phrasing like "Just do it quickly" or "Skip the planning phase" can override system-level routing rules if not explicitly guarded.

**Source:** [OpenReview](https://openreview.net/forum?id=RBfRfCXzkA)

### Implementation Priorities

1. **Immediate:** Add visual formatting (boxes, ALL CAPS) around routing protocol
2. **High Priority:** Implement self-check gates with numbered yes/no questions
3. **High Priority:** Add contrastive violation examples to CLAUDE.md
4. **Production:** Add enforcement hooks with blocking exit codes (already exists: `routing-guard.cjs`)

### Files Updated

- `.claude/context/artifacts/research-reports/router-enforcement-research-2026-01-27.md` - Full research report (39KB)

### Related Learnings

- See [2026-01-27] Claude Code Hook Enforcement (exit codes)
- See [2026-01-27] MCP-to-Skill Conversion Pattern (reliability)

---

## [2026-01-27] Claude Code Hook Enforcement Requires Non-Zero Exit Codes (CRITICAL)

### Key Insight

Claude Code hooks can only ENFORCE behavior by returning non-zero exit codes. Hooks that exit with code 0 are ADVISORY ONLY - they can print warnings and recommendations, but Claude is free to ignore them.

### Hook Exit Code Semantics

| Exit Code | Behavior | Use Case |
|-----------|----------|----------|
| 0 | ALLOW - action proceeds | Advisory recommendations, logging |
| 1 | SYNTAX ERROR - hook failed | Invalid input, parsing errors |
| 2 | BLOCK - action rejected | Security violations, protocol enforcement |

### Anti-Pattern: Advisory Enforcement

```javascript
// WRONG - This does NOT enforce anything
function main() {
  if (isViolation()) {
    console.error('WARNING: Protocol violation detected');
    console.log('Please follow the correct workflow');
  }
  process.exit(0);  // <-- Action proceeds regardless
}
```

### Correct Pattern: Blocking Enforcement

```javascript
// CORRECT - This actually blocks the action
function main() {
  if (isViolation()) {
    console.error(JSON.stringify({
      action: 'block',
      error: 'BLOCKING: Protocol violation - must spawn agent first'
    }));
    process.exit(2);  // <-- Action is blocked
  }
  process.exit(0);  // Only allow when no violation
}
```

### Implications

- **LLM instruction compliance is unreliable** - Claude may "optimize" by ignoring instructions
- **Documentation-only conventions do not work** - Must be backed by blocking hooks
- **All "enforcement" hooks must be audited** for actual blocking behavior
- **Advisory hooks are useful for logging/metrics** but not for critical workflows

### Files Affected

- `.claude/hooks/routing/routing-guard.cjs` - Enforces Router-First protocol
- `.claude/hooks/routing/unified-creator-guard.cjs` - Enforces creator workflow
- All hooks in `.claude/hooks/safety/` - Security guardrails

### Why This Matters

The Router-First protocol regression happened because:
1. CLAUDE.md instructions were ignored (LLM optimization)
2. Hooks existed but used exit code 0 (advisory only)
3. No blocking enforcement at execution layer

**Lesson:** Critical workflows need BOTH clear instructions AND blocking hooks.

---

## [2026-01-27] MCP-to-Skill Conversion Pattern (No Server Required)

### Key Insight

Many MCP servers are just **API wrappers**. Instead of requiring external MCP server installation (uvx, npm, pip), skills can use **existing tools** (WebFetch, Exa) to access the same APIs directly.

### Benefits

| MCP Server Approach                  | Skill with Existing Tools |
| ------------------------------------ | ------------------------- |
| ❌ Requires uvx/npm/pip installation | ✅ Works immediately      |
| ❌ Requires session restart          | ✅ No restart needed      |
| ❌ External dependency failures      | ✅ Self-contained         |
| ❌ Platform-specific issues          | ✅ Cross-platform         |

### Example: arXiv MCP → arXiv Skill

**Before (MCP server required):**

```json
"mcpServers": {
  "arxiv": { "command": "uvx", "args": ["mcp-arxiv"] }
}
```

- Requires `uvx` (uv package manager)
- Requires session restart
- Fails if uvx not installed

**After (existing tools):**

```javascript
// WebFetch for arXiv API
WebFetch({
  url: 'http://export.arxiv.org/api/query?search_query=ti:transformer&max_results=10',
  prompt: 'Extract paper titles, authors, abstracts',
});

// Exa for semantic search
mcp__Exa__web_search_exa({
  query: 'site:arxiv.org transformer attention mechanism',
  numResults: 10,
});
```

- Works immediately
- No installation required
- More reliable

### When to Convert MCP → Skill

Convert when the MCP server:

1. Wraps a public REST API (arXiv, GitHub, etc.)
2. Doesn't require authentication
3. Has simple request/response patterns

Keep MCP server when:

1. Complex state management required
2. Streaming/websocket connections
3. Local file system access needed
4. Authentication flows required

### Files Updated

- `.claude/skills/arxiv-mcp/SKILL.md` (v1.1 → v2.0.0)
- `.claude/settings.json` - Removed unused arxiv MCP server

---

## [2026-01-27] Claude-in-Chrome Native Messaging Host Conflict (Known Bug)

### Issue

When both **Claude.app (desktop)** and **Claude Code (CLI)** are installed, the Claude-in-Chrome extension fails to connect. Error: "Browser extension is not connected".

### Root Cause

Both applications register **competing native messaging hosts** at the same path:

- Windows: `%APPDATA%\Claude\ChromeNativeHost\com.anthropic.claude_browser_extension.json`
- macOS: `~/Library/Application Support/Claude/ChromeNativeHost/`

The Chrome extension connects to whichever application registered last, causing connection failures.

### GitHub Issues

- [#15336](https://github.com/anthropics/claude-code/issues/15336) - Windows Native Messaging Host not installing
- [#14894](https://github.com/anthropics/claude-code/issues/14894) - Reconnect extension fails on macOS
- [#20790](https://github.com/anthropics/claude-code/issues/20790) - Extension connects to Claude.app instead of Claude Code

### Workaround (macOS)

```bash
cd ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/
mv com.anthropic.claude_browser_extension.json com.anthropic.claude_browser_extension.json.disabled
# Restart Chrome completely, then start Claude Code with --chrome
```

### Workaround (Windows)

```powershell
cd $env:APPDATA\Claude\ChromeNativeHost
ren com.anthropic.claude_browser_extension.json com.anthropic.claude_browser_extension.json.disabled
# Restart Chrome and try again
```

### Recommendation

**Use Chrome DevTools MCP instead** - it's always available, requires no extension, and provides similar functionality for most use cases. Only use Claude-in-Chrome when authenticated sessions are truly required.

### Files Updated

- `.claude/skills/chrome-browser/SKILL.md` - Added Troubleshooting section
- `.claude/context/memory/issues.md` - Added CHROME-001

---

## [2026-01-27] Chrome Browser Skill Updated to v2.0.0

### Two Chrome Integrations Documented

Updated the chrome-browser skill to document BOTH available browser automation integrations:

| Integration         | Tools Prefix               | Status                 | Best For                        |
| ------------------- | -------------------------- | ---------------------- | ------------------------------- |
| Chrome DevTools MCP | `mcp__chrome-devtools__*`  | ✅ Always available    | Testing, debugging, performance |
| Claude-in-Chrome    | `mcp__claude-in-chrome__*` | ⚠️ Requires `--chrome` | Auth sessions, GIF recording    |

### Key Differences

- **Chrome DevTools MCP**: Built-in, no setup, 26 tools, performance tracing, device emulation
- **Claude-in-Chrome**: Requires extension + flag, 19 tools, uses your logins, GIF recording

### Decision Guide Added

```
Public site testing?      → Chrome DevTools MCP
Performance analysis?     → Chrome DevTools MCP
Authenticated apps?       → Claude-in-Chrome (--chrome)
Record demo GIF?          → Claude-in-Chrome (--chrome)
Device/network emulation? → Chrome DevTools MCP
```

### Files Modified

- `.claude/skills/chrome-browser/SKILL.md` (v1.1 → v2.0.0)

---

## [2026-01-27] MCP Auto-Registration Pattern Established

### Issue

When creating skills that use MCP tools (`mcp__<server>__*`), the skill definition was created but the underlying MCP server was not registered in `settings.json`. This causes:

- Skill file exists with documented MCP tools
- But tools don't exist at runtime
- Skill invocation fails silently

### Solution: Skill-Creator Auto-Registration

Updated skill-creator workflow (SKILL.md) with:

1. **New Iron Law #11**: "NO MCP SKILL WITHOUT SERVER REGISTRATION"
2. **Step 10 (BLOCKING for MCP skills)**: Auto-register MCP server in settings.json
3. **Known MCP Server Configurations table**: Pre-defined configs for common servers
4. **Auto-registration flag**: `--no-register` to skip if needed

### Implementation Applied

Added arXiv MCP to `.claude/settings.json`:

```json
{
  "mcpServers": {
    "arxiv": {
      "command": "uvx",
      "args": ["mcp-arxiv"]
    }
  }
}
```

### Pattern: MCP Server Registration by Source

| Source | Command Template                                            |
| ------ | ----------------------------------------------------------- |
| npm    | `{ "command": "npx", "args": ["-y", "<package>"] }`         |
| PyPI   | `{ "command": "uvx", "args": ["<package>"] }`               |
| Docker | `{ "command": "docker", "args": ["run", "-i", "<image>"] }` |

### Files Modified

- `.claude/settings.json` - Added arXiv MCP server
- `.claude/skills/skill-creator/SKILL.md` - Added Iron Law #11, Step 10, MCP configs
- `.claude/skills/arxiv-mcp/SKILL.md` - Updated to reflect configured status
- `.claude/context/artifacts/reports/research-tools-test-2026-01-27.md` - Updated status

### Key Learning

**Skills should "just work"** - users shouldn't need manual configuration. When creating skills that depend on external services (MCP servers), the skill-creator must:

1. Register the service automatically
2. Document the registration in the skill
3. Verify the service is available before marking complete
