# Plan: Agent Error Pattern Fixes

## Overview

This plan addresses 6 error patterns affecting agent operations, identified through systematic investigation. The plan prioritizes safety (no breaking changes) and includes validation steps for each fix.

## Executive Summary

| Error                                | Root Cause                                 | Fix Type                | Risk   | Priority |
| ------------------------------------ | ------------------------------------------ | ----------------------- | ------ | -------- |
| Error 1: Sequential Thinking Tool    | MCP tool naming mismatch                   | Template update         | LOW    | P1       |
| Error 2: File Size (41350 tokens)    | Agent tried to WRITE large content         | Prevention hook         | MEDIUM | P2       |
| Error 3: decisions.md (29184 tokens) | File growth without rotation               | Archival process        | LOW    | P1       |
| Error 4: issues.md (30002 tokens)    | File growth without rotation               | Archival process        | LOW    | P1       |
| Error 5: Bash unavailable            | Tool not in reflection-agent allowed_tools | Agent definition update | LOW    | P1       |
| Error 6: Test Failures               | Staging environment tests running in dev   | Test isolation fix      | LOW    | P3       |

---

## Root Cause Analysis

### Error 1: Sequential Thinking Tool Not Available

**Error Message:**

```
"No such tool available: mcp__sequential-thinking__sequentialthinking"
```

**Investigation Findings:**

1. The planner agent definition (`.claude/agents/core/planner.md` line 12) lists `mcp__sequential-thinking__*` in tools
2. The CLAUDE.md Section 2 spawn template (line 272) includes `mcp__sequential-thinking__sequentialthinking` in allowed_tools
3. However, `settings.json` has `"mcpServers": {}` (line 6) - meaning NO MCP servers are configured

**Root Cause:** The MCP sequential-thinking server is not configured in settings.json. The tool is referenced in spawn templates but the server isn't running/registered.

**Fix Options:**

- **Option A (RECOMMENDED):** Configure the MCP server in settings.json
- **Option B:** Remove MCP tool references from spawn templates (use Skill instead)
- **Option C:** Make MCP tools optional with fallback

---

### Error 2: File Size - Environment Utils (41350 tokens)

**Error Message:**

```
"File content (41350 tokens) exceeds maximum allowed tokens (25000)"
File: .claude\lib\utils\environment.cjs
```

**Investigation Findings:**

1. The actual `environment.cjs` file is only 93 lines (~500 tokens)
2. The error occurred during a WRITE operation, not READ
3. The devops agent was likely trying to write NEW content that would be 41350 tokens
4. This indicates an agent tried to generate/write massive content to a small utility file

**Root Cause:** An agent attempted to write oversized content. The token limit is a safeguard that correctly blocked the operation. This is a SYMPTOM of agent misbehavior, not a file size issue.

**Fix:** Add file size pre-validation hook before Write operations to warn agents earlier, and add guidance in agent definitions about file size limits.

---

### Error 3 & 4: Memory Files Too Large

**Error Messages:**

```
"File content (29184 tokens) exceeds maximum allowed tokens (25000)" - decisions.md
"File content (30002 tokens) exceeds maximum allowed tokens (25000)" - issues.md
```

**Investigation Findings:**

1. `decisions.md` is 3096 lines (large, near limit)
2. `issues.md` is 1973 lines (smaller but still significant)
3. Token count > line count because ADR entries have code blocks and detailed content
4. Both files lack automatic rotation/archival

**Root Cause:** Memory files grow unbounded. The existing archival system exists (`issues-archive.md` mentioned in issues.md summary) but is not automatically triggered.

**Fix:** Implement automatic memory file rotation when approaching token limits.

---

### Error 5: Bash Tool Not Available to Reflection-Agent

**Error Message:**

```
"No such tool available: Bash"
Trying to run: validate-integration.cjs
```

**Investigation Findings:**

1. `reflection-agent.md` line 9 lists tools: `[Read, Write, Edit, Grep, Glob, TaskUpdate, TaskList, TaskCreate, TaskGet, Skill]`
2. **Bash is NOT included** in the reflection-agent's tool list
3. The agent tried to run `validate-integration.cjs` which requires Bash
4. This is by design - reflection-agent is meant to be read-only + memory updates

**Root Cause:** Design decision - reflection-agent intentionally lacks Bash to prevent code execution. However, the agent was assigned a task that required Bash.

**Fix Options:**

- **Option A (RECOMMENDED):** Do NOT add Bash to reflection-agent. Instead, ensure tasks requiring Bash are routed to agents with Bash access (developer, devops)
- **Option B:** Add limited Bash for validation scripts only (security risk)
- **Option C:** Create a separate validation-agent with Bash access

**Decision:** The reflection-agent's limited tools are a SECURITY FEATURE. The fix should be routing-level, not agent modification.

---

### Error 6: Test Failures (staging-smoke.test.mjs)

**Investigation Findings:**

1. 8 tests fail in `staging-smoke.test.mjs`
2. All failures relate to environment detection - tests expect `staging` but get `development`
3. Tests check for staging-specific files and configurations that don't exist in dev
4. Example: "Expected staging environment, got: development"

**Root Cause:** The staging smoke tests are designed to run IN a staging environment but are being run in development. These tests SHOULD fail in dev - they validate staging setup.

**Fix Options:**

- **Option A (RECOMMENDED):** Skip staging tests in non-staging environments
- **Option B:** Mark tests as integration tests requiring specific setup
- **Option C:** Create a staging environment for testing

---

## Phase 0: Research & Planning (FOUNDATION)

**Purpose:** Validate fixes before implementation
**Duration:** 1-2 hours
**Parallel OK:** No (blocking)

### Research Requirements

- [x] Investigated all 6 error patterns
- [x] Identified root causes
- [x] Documented in this plan
- [x] ADR decisions documented below

### Constitution Checkpoint

1. **Research Completeness**
   - [x] All 6 errors analyzed with root causes
   - [x] Fix options evaluated
   - [x] No external research needed (internal framework issues)

2. **Technical Feasibility**
   - [x] All fixes are within existing framework patterns
   - [x] No new dependencies required
   - [x] Backward compatible approaches identified

3. **Security Review**
   - [x] Error 5 fix maintains security boundary (no Bash for reflection-agent)
   - [x] Memory rotation doesn't expose sensitive data
   - [x] MCP configuration is opt-in

4. **Specification Quality**
   - [x] Success criteria defined per fix
   - [x] Rollback procedures identified
   - [x] Edge cases considered

**SUCCESS:** Constitution checkpoint passed - proceed to Phase 1

---

## Phase 1: Immediate Fixes (LOW RISK)

**Purpose:** Fix low-risk issues that don't change behavior
**Duration:** 2-3 hours
**Dependencies:** Phase 0 complete
**Parallel OK:** Yes

### Task 1.1: Memory File Archival (~30 min)

**Problem:** decisions.md and issues.md exceed token limits

**Fix:**

1. Archive resolved issues from issues.md older than 7 days to issues-archive.md
2. Archive ADRs older than 60 days to decisions-archive.md
3. Update summary tables in both files

**Commands:**

```bash
# Verify current sizes
wc -l .claude/context/memory/decisions.md
wc -l .claude/context/memory/issues.md
```

**Success Criteria:**

- decisions.md < 1500 lines (~15000 tokens)
- issues.md < 1000 lines (~10000 tokens)
- Archive files contain moved content with timestamps

**Rollback:** Archives can be merged back into main files

---

### Task 1.2: Fix Test Environment Detection (~15 min)

**Problem:** Staging tests fail in development environment

**Fix:** Add environment check at top of staging-smoke.test.mjs:

```javascript
import { describe, it, before } from 'node:test';

describe('Staging Environment Smoke Tests', () => {
  before(() => {
    if (process.env.AGENT_STUDIO_ENV !== 'staging') {
      console.log('SKIPPING: Staging tests require AGENT_STUDIO_ENV=staging');
      process.exit(0); // Skip tests gracefully
    }
  });
  // ... existing tests
});
```

**Success Criteria:**

- `npm test` passes with 0 failures in development
- Tests run when `AGENT_STUDIO_ENV=staging`

**Rollback:** Revert to original test file

---

### Task 1.3: Document Reflection-Agent Tool Limitations (~15 min)

**Problem:** Tasks requiring Bash routed to reflection-agent

**Fix:** Add warning to `.claude/agents/core/reflection-agent.md`:

```markdown
## Tool Limitations (IMPORTANT)

**The reflection-agent intentionally LACKS these tools:**

- `Bash` - Cannot execute shell commands (security boundary)
- `mcp__*` - No MCP tool access

**Tasks requiring these tools should be routed to:**

- `developer` - for validation scripts, build commands
- `devops` - for infrastructure validation
- `qa` - for test execution

If you need to run `validate-integration.cjs` or similar scripts, spawn a developer agent.
```

**Success Criteria:**

- Documentation updated
- Router training examples updated

**Rollback:** Remove added documentation

---

## Phase 2: MCP Tool Configuration (MEDIUM RISK)

**Purpose:** Properly configure or remove MCP tool references
**Duration:** 1-2 hours
**Dependencies:** Phase 1 complete
**Parallel OK:** No

### Task 2.1: Audit MCP Tool Usage (~30 min)

**Problem:** MCP tools referenced but server not configured

**Investigation:**

1. Count references to `mcp__sequential-thinking` in codebase
2. Determine if MCP server was ever configured
3. Check if `Skill({ skill: 'sequential-thinking' })` works as alternative

**Commands:**

```bash
# Find all MCP references
grep -r "mcp__sequential" .claude/ --include="*.md" --include="*.cjs" | wc -l
```

**Decision Point:**

- If < 5 references: Remove and use Skill() instead
- If >= 5 references: Configure MCP server

---

### Task 2.2: Fix MCP Configuration (IF NEEDED)

**Option A: Configure MCP Server**

Add to settings.json:

```json
{
  "mcpServers": {
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
    }
  }
}
```

**Option B: Replace with Skill (RECOMMENDED)**

Update CLAUDE.md Section 2 spawn templates to use:

```javascript
allowed_tools: [
  'Read','Write','Edit','Bash',
  'TaskUpdate','TaskList','TaskCreate','TaskGet',
  'Skill',
  // REMOVED: 'mcp__sequential-thinking__sequentialthinking',
  // USE: Skill({ skill: 'sequential-thinking' }) instead
],
```

**Success Criteria:**

- No "tool not available" errors for sequential thinking
- Either MCP server configured OR all references use Skill()

**Rollback:** Restore original settings.json/CLAUDE.md

---

## Phase 3: Write Size Validation (MEDIUM RISK)

**Purpose:** Prevent agents from writing oversized content
**Duration:** 1-2 hours
**Dependencies:** Phase 2 complete
**Parallel OK:** No

### Task 3.1: Create Write Size Validator Hook (~1 hour)

**Problem:** Agents can attempt to write content exceeding token limits

**Implementation:**
Create `.claude/hooks/safety/write-size-validator.cjs`:

```javascript
/**
 * Pre-Write validation hook
 * Warns when content approaches or exceeds token limits
 */
const fs = require('fs');
const path = require('path');

const MAX_TOKENS = 25000;
const WARNING_THRESHOLD = 20000;

// Rough token estimate: ~4 chars per token
function estimateTokens(content) {
  return Math.ceil((content || '').length / 4);
}

async function main() {
  const input = JSON.parse(process.argv[2] || '{}');
  const { tool_input } = input;

  if (!tool_input || !tool_input.content) {
    process.exit(0); // Allow
  }

  const estimatedTokens = estimateTokens(tool_input.content);
  const filePath = tool_input.file_path || 'unknown';

  if (estimatedTokens > MAX_TOKENS) {
    console.error(
      JSON.stringify({
        decision: 'block',
        reason: `Content too large: ~${estimatedTokens} tokens (max: ${MAX_TOKENS})`,
        file: filePath,
        suggestion: 'Split content into multiple smaller files',
      })
    );
    process.exit(2); // Block
  }

  if (estimatedTokens > WARNING_THRESHOLD) {
    console.error(
      JSON.stringify({
        decision: 'warn',
        reason: `Large content: ~${estimatedTokens} tokens (warning: ${WARNING_THRESHOLD})`,
        file: filePath,
      })
    );
  }

  process.exit(0); // Allow
}

main().catch(e => {
  console.error('write-size-validator error:', e.message);
  process.exit(0); // Fail open
});

module.exports = { main, estimateTokens };
```

**Registration in settings.json:**

```json
{
  "matcher": "Edit|Write",
  "hooks": [
    // ... existing hooks ...
    {
      "type": "command",
      "command": "node .claude/hooks/safety/write-size-validator.cjs"
    }
  ]
}
```

**Success Criteria:**

- Hook blocks writes > 25000 tokens
- Hook warns at 20000 tokens
- Existing tests pass

**Rollback:** Remove hook from settings.json

---

## Phase 4: Memory Management Automation (LOW RISK)

**Purpose:** Automate memory file rotation
**Duration:** 2-3 hours
**Dependencies:** Phase 3 complete
**Parallel OK:** Yes

### Task 4.1: Create Memory Rotation Utility (~1.5 hours)

**Implementation:**
Create `.claude/lib/memory/memory-rotation.cjs`:

```javascript
/**
 * Memory File Rotation Utility
 * Moves old entries to archive when files exceed token limits
 */

const fs = require('fs');
const path = require('path');

const MEMORY_DIR = '.claude/context/memory';
const MAX_LINES = 1000; // ~10000 tokens

// Files and their archives
const ROTATION_CONFIG = {
  'issues.md': { archive: 'archive/issues-archive.md', keepDays: 7 },
  'decisions.md': { archive: 'archive/decisions-archive.md', keepDays: 60 },
  'learnings.md': { archive: 'archive/learnings-archive.md', keepDays: 30 },
};

function needsRotation(filePath, maxLines) {
  if (!fs.existsSync(filePath)) return false;
  const content = fs.readFileSync(filePath, 'utf-8');
  return content.split('\n').length > maxLines;
}

function rotateFile(filePath, archivePath, keepDays) {
  // Implementation: split by date markers, archive older entries
  // ... (detailed implementation)
}

module.exports = { needsRotation, rotateFile, ROTATION_CONFIG };
```

**Trigger:** Add to SessionEnd hooks for automatic rotation check

**Success Criteria:**

- Memory files stay under 1000 lines
- Archives contain older content with timestamps
- No data loss during rotation

**Rollback:** Archives can be merged back

---

## Phase 5: Validation & Testing

**Purpose:** Verify all fixes work correctly
**Duration:** 1 hour
**Dependencies:** Phases 1-4 complete
**Parallel OK:** Yes

### Task 5.1: Verify Error Resolution

**Validation Commands:**

```bash
# Test 1: Memory files readable
node -e "require('fs').readFileSync('.claude/context/memory/decisions.md')"
node -e "require('fs').readFileSync('.claude/context/memory/issues.md')"

# Test 2: Tests pass
npm test

# Test 3: Write size validator works
echo '{"tool_input":{"content":"x".repeat(100000)}}' | node .claude/hooks/safety/write-size-validator.cjs -
# Should exit with code 2 (block)

# Test 4: MCP or Skill works
# Manual test: spawn planner agent and verify no tool errors
```

### Task 5.2: Update Documentation

Files to update:

- [ ] CLAUDE.md - MCP tool notes (if changed)
- [ ] MEMORY_SYSTEM.md - rotation documentation
- [ ] HOOK_DEVELOPMENT_GUIDE.md - write-size-validator

---

## Phase FINAL: Evolution & Reflection Check

**Purpose:** Quality assessment and learning extraction

**Tasks:**

1. Spawn reflection-agent to analyze completed work
2. Extract learnings and update memory files
3. Check for evolution opportunities

**Success Criteria:**

- Reflection completed
- Learnings documented
- No new issues introduced

---

## Risk Assessment

| Risk                                     | Likelihood | Impact | Mitigation                                         |
| ---------------------------------------- | ---------- | ------ | -------------------------------------------------- |
| Memory rotation loses data               | Low        | High   | Test with copies first, maintain archives          |
| Write validator blocks legitimate writes | Medium     | Medium | Set threshold at 25k (not 20k), fail-open on error |
| MCP removal breaks workflows             | Low        | Medium | Keep Skill() as fallback                           |
| Test changes mask real failures          | Low        | Low    | Environment check is explicit, not silent          |

---

## Implementation Order (RECOMMENDED)

1. **Phase 1.1-1.3** (Immediate, parallel): Memory archival, test fix, documentation
2. **Phase 2** (After Phase 1): MCP tool decision
3. **Phase 3** (After Phase 2): Write size validator
4. **Phase 4** (Optional, can defer): Memory automation

**Total Estimated Time:** 6-8 hours

---

## ADR: Agent Tool Availability Strategy

**Date:** 2026-01-28
**Status:** Proposed
**Context:** Agents encounter "tool not available" errors when spawn templates include tools the agent doesn't have access to.

**Decision:**

1. **Tool lists in spawn templates are SUGGESTIONS, not guarantees** - Claude runtime determines actual availability
2. **Agent definitions (.md files) are authoritative** for agent capabilities
3. **MCP tools require explicit server configuration** - prefer Skill() when possible
4. **Security-limited agents (reflection-agent) intentionally lack tools** - route tasks appropriately

**Consequences:**

- Spawn templates should match agent definition tools
- MCP tools should have Skill() fallbacks documented
- Router must consider tool availability when routing

---

## Summary of Fixes

| Error                  | Fix                               | Files Changed                | Risk |
| ---------------------- | --------------------------------- | ---------------------------- | ---- |
| 1: Sequential Thinking | Use Skill() or configure MCP      | CLAUDE.md, settings.json     | LOW  |
| 2: Write size 41k      | Add write-size-validator.cjs hook | hooks/safety/, settings.json | LOW  |
| 3: decisions.md large  | Archive old ADRs                  | context/memory/              | LOW  |
| 4: issues.md large     | Archive resolved issues           | context/memory/              | LOW  |
| 5: Bash unavailable    | Document + routing guidance       | reflection-agent.md          | NONE |
| 6: Test failures       | Environment check in tests        | tests/staging-smoke.test.mjs | LOW  |

---

**Plan Status:** READY FOR IMPLEMENTATION
**Created:** 2026-01-28
**Author:** Planner Agent
