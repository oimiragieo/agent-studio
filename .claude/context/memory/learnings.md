### Memory File Rotation Implementation (2026-01-28)

**Pattern:** Automatic Archival for Memory Files Approaching Size Limits

**Implementation:** Created `.claude/lib/memory/memory-rotator.cjs` utility for automatic rotation of decisions.md and issues.md when they approach token limits.

**Key Features:**

1. **Smart Rotation Policies:**
   - `decisions.md`: Archives ADRs older than 60 days when file > 1500 lines
   - `issues.md`: Archives RESOLVED issues older than 7 days when file > 1500 lines
   - Target: Keep active files under 1500 lines (80% of 2000 line soft limit)

2. **Archive Format:**
   - Location: `.claude/context/memory/archive/YYYY-MM/`
   - Files: `decisions-YYYY-MM.md`, `issues-YYYY-MM.md`
   - Preserves full content with metadata headers

3. **CLI Commands:**

   ```bash
   # Check status
   node .claude/lib/memory/memory-rotator.cjs check

   # Preview rotation
   node .claude/lib/memory/memory-rotator.cjs rotate --dry-run

   # Execute rotation
   node .claude/lib/memory/memory-rotator.cjs rotate
   ```

4. **Test Coverage:** 15 unit tests covering parsing, selection, rotation operations (all passing)

**Date Parsing Fix:** Prioritize Resolved date over Date field for issues - use resolved date for age calculation.

**Security:** Validates PROJECT_ROOT with path traversal prevention, allows test directories for unit testing.

**Documentation:** Added to `.claude/docs/MONITORING.md` under Memory File Rotation section.

**Files Created:**

- `.claude/lib/memory/memory-rotator.cjs` - Rotation utility (680 lines)
- `.claude/lib/memory/memory-rotator.test.cjs` - Test suite (530 lines, 15 tests)

**Integration:** Can be invoked manually or integrated into memory-scheduler.cjs for automated monthly rotation.

---

### Write Size Validation Pattern (PREVENTION)

**Date**: 2026-01-28
**Source**: Agent Error Fixes Plan Phase 3

**Problem**: Agents can generate content exceeding Write tool token limits (25,000 tokens), causing runtime failures AFTER content generation (wasted compute).

**Solution Pattern**: Pre-Write validation hook

**Implementation**:

1. **Hook**: `.claude/hooks/safety/write-size-validator.cjs`
2. **Triggers**: PreToolUse(Write|Edit|NotebookEdit)
3. **Token Estimation**: `Math.ceil(content.length / 4)` (~4 chars/token)
4. **Thresholds**:
   - WARNING_THRESHOLD: 20,000 tokens (warns but allows)
   - MAX_TOKENS: 25,000 tokens (blocks if `estimatedTokens > MAX_TOKENS`)
5. **Exit Codes**:
   - 0 = Allow (small content, warnings, or fail-open on error)
   - 2 = Block (content > 25K tokens)

**Key Design Decisions**:

- **Fail Open**: On error, exit 0 (allow) per SEC-008 security guideline
- **Early Warning**: Warns at 80% threshold (20K) to give agents time to adjust approach
- **Actionable Messages**: Suggests "Split content into multiple smaller files"
- **Tool Coverage**: Validates Write, Edit (checks `new_string`), NotebookEdit

**Test Coverage**: 13 unit tests covering:

- Small content (< 20K) → allow
- Large content (20K-25K) → warn + allow
- Oversized (> 25K) → block
- Edge cases (exactly 20K warns, exactly 25K warns+allows, 25K+1 blocks)
- Empty/undefined content → allow
- Non-write tools → skip validation
- Malformed input → fail open

**Prevention vs. Detection**: This hook prevents failures (blocks before write), whereas error logs only detect failures after they occur.

**Cost**: Minimal - string length check on every write operation.

**Files Created**:

- `.claude/hooks/safety/write-size-validator.cjs` - Main hook (220 lines)
- `.claude/hooks/safety/write-size-validator.test.cjs` - Test suite (315 lines, 13 tests)

---

### Agent Error Pattern Investigation (2026-01-28)

**Pattern:** Tool Availability Mismatch Between Spawn Template and Runtime

**Context**: Agents receive "No such tool available" errors when spawn templates reference tools that aren't actually available (MCP tools not configured, tools not in agent's allowed_tools).

**Root Causes Identified:**

1. **MCP Server Not Configured**: `settings.json` has `"mcpServers": {}` but spawn templates reference `mcp__sequential-thinking__*`
2. **Agent Tool Limits Intentional**: reflection-agent lacks Bash BY DESIGN (security boundary)
3. **Token Limits Are Safeguards**: 25000 token file limit correctly blocks oversized writes

**Prevention (IMPLEMENTED 2026-01-28):**

1. **Phase 1 (Remediation)**: Removed unavailable tool references from 11 agent definitions + 1 skill
2. **Phase 2 (Prevention)**: Created `tool-availability-validator.cjs` hook that validates tools before spawning
   - Blocks spawn if required tools (core tools) unavailable
   - Warns but allows spawn if optional tools (MCP tools) missing
   - Provides actionable suggestions (use Skill() instead, or configure MCP)
3. **Phase 3 (Registration)**: Registered hook in settings.json PreToolUse(Task) hooks (runs before pre-task-unified.cjs)
4. **Before using MCP tools**: Verify server is configured in settings.json
5. **Use Skill() as fallback**: `Skill({ skill: 'sequential-thinking' })` works without MCP config
6. **Route by capability**: Don't send Bash-requiring tasks to agents without Bash
7. **Check agent definitions**: The `.md` file is authoritative for tool access, not spawn template

**Key Files:**

- Agent tools defined in: `.claude/agents/<category>/<agent>.md` (tools: line)
- MCP config: `.claude/settings.json` (mcpServers section)
- Spawn templates: `.claude/CLAUDE.md` Section 2
- **Validation hook**: `.claude/hooks/routing/tool-availability-validator.cjs` (NEW - Phase 2)

**Hook Implementation Details:**

- Validates `allowed_tools` in Task spawn requests
- Core tools list: Read, Write, Edit, Bash, Grep, Glob, TaskUpdate, TaskList, TaskCreate, TaskGet, Skill, AskUserQuestion, NotebookEdit, WebSearch, WebFetch
- MCP tool detection: Parses `mcp__<server>__<tool>` format, checks settings.json for server config
- Exit codes: 0 (allow), 2 (block)
- Test coverage: 14 unit tests (all passing)
- **Registered**: settings.json PreToolUse(Task) - runs before pre-task-unified.cjs (2026-01-28)

**Hook Registration Pattern:**

```json
{
  "matcher": "Task",
  "hooks": [
    {
      "type": "command",
      "command": "node .claude/hooks/routing/tool-availability-validator.cjs"
    },
    {
      "type": "command",
      "command": "node .claude/hooks/routing/pre-task-unified.cjs"
    }
  ]
}
```

**Order matters**: tool-availability-validator runs FIRST to catch tool mismatches before unified pre-task processing.

**Cost of Violation**: Task fails, agent outputs error, requires rerouting or spawn template fix. **Now prevented by hook (Phase 2) and enforced at spawn time (Phase 3).**

---

**Context**: Phase 5 QA tests had 48% failure rate because tests were written against implementation PLAN, not actual module exports.

**What It Is**: Writing tests based on planning documents rather than actual implementation.

**Signs You're Doing It**:

- Referencing implementation plan instead of actual code
- Writing all tests before running any
- Import errors when executing tests
- Function signatures don't match actual exports

**Why It's Dangerous**:

- High test failure rate (48% in Party Mode Phase 5)
- Wasted effort (6-8 hours writing wrong tests)
- Tests don't validate actual code
- False confidence in planning documents

**Prevention**:

1. **MANDATORY**: Check actual module exports before writing tests
   ```bash
   node -e "console.log(Object.keys(require('./module.cjs')).join(', '))"
   ```
2. Write ONE passing test first to verify imports work
3. Update implementation plan when scope changes during development
4. Generate API reference doc after implementation, before testing

**Example**: `buildConsensus()` in plan, `aggregateResponses()` actually implemented.

**Cost of Violation**: 3+ hours rework, 50% test failure rate, delayed QA.

---

### Post-Creation Integration Checklist (MANDATORY)

After creating ANY artifact (agent, skill, hook, workflow):

- [ ] **CLAUDE.md Updated**: Routing table entry added (Section 3)
- [ ] **Catalog Updated**: Skill-catalog.md or equivalent registry
- [ ] **Settings Registered**: Hook registered in settings.json (if applicable)
- [ ] **Agent Assignment**: At least one agent has skill/hook assigned
- [ ] **Validation Passed**: Schema/structure validation
- [ ] **Router Test**: Verify router routes to artifact via natural language
- [ ] **Memory Updated**: Learnings/decisions recorded
- [ ] **Documentation**: User-facing docs created/updated

**Rule**: If you skip any step, the artifact is "invisible" and the creation is incomplete.

---

### Recursive Improvement Stopping Criteria (META-PATTERN)

**Date**: 2026-01-28
**Source**: Task #30 Meta-Reflection

**Problem**: Recursive improvement (reflecting on reflection) can lead to infinite loops with diminishing returns.

**Stopping Criteria** (apply in order):

1. **Severity Threshold**: STOP when no HIGH/CRITICAL issues remain
2. **Diminishing Returns**: STOP when improvement potential < 0.5 (on 10-point scale)
3. **Time Budget**: Max 10% of original work time allocated to reflection
4. **Recursion Depth**: Max 2 levels without human approval

**Decision Tree**:

```
Is there a HIGH/CRITICAL issue?
├── YES → Continue reflection/evolution
└── NO → Is improvement potential > 0.5?
    ├── YES → Continue if within time budget
    └── NO → STOP
```

**Example**: 58-hour BMAD session = max 5.8 hours total reflection time

---

### Parallel Agent Spawning for Time Reduction (50% PATTERN)

**Date**: 2026-01-28
**Source**: BMAD-METHOD Integration Session

**When to Use**: Multiple independent tasks without shared outputs.

**Pattern**:

```javascript
TaskList();
Task({ subagent_type: 'developer', prompt: 'Task A' });
Task({ subagent_type: 'architect', prompt: 'Task B' });
// Both execute simultaneously
```

**Impact**: 50% time reduction (58h actual vs 116h sequential estimate)

**Requirements**:

- Tasks must be independent (no shared state)
- Tasks must have different output files
- Review agents can run parallel with implementation agents

**Example**: BMAD Phase 1B spawned developer + security-architect + architect simultaneously for different aspects of the same feature.

---

### The Ironic Invisible Artifact Pattern (META-ANTI-PATTERN)

**Date**: 2026-01-28
**Source**: evolution-workflow.md refinements

**What It Is**: Creating the "unified-creator-guard.cjs" hook to prevent invisible artifacts, but doing so WITHOUT using the hook-creator skill (making it invisible).

**Irony**: Creating an anti-pattern guard while committing the anti-pattern.

**Root Cause**: Missing enforcement at workflow/skill level.

**Fix Applied**:

- Added CRITICAL reminder to workflow-creator.md
- Added blocking assertion to workflow execution
- Added audit trail in evolution-state.json

**Prevention**: Workflows MUST enforce their own rules at invocation time.

---

### Phase 1 Tool Availability Fix (2026-01-28)

**Context**: Documentation drift where 12 agent/skill definitions referenced non-existent MCP tool `mcp__sequential-thinking__*`.

**Root Cause**: Tool added speculatively before MCP server configured, then removed from spawn templates but NOT from agent definitions.

**Files Fixed (14 total)**:

- 11 agents: planner, pm, database-architect, sveltekit-expert, php-pro, nodejs-pro, nextjs-pro, java-pro, ios-pro, frontend-pro, evolution-orchestrator
- 1 skill: advanced-elicitation
- 1 test: staging-smoke.test.mjs (added environment check)

**Pattern Learned**:

- Agent definitions are authoritative for tool access (not spawn templates)
- MCP tools should only be listed when MCP server is configured in settings.json
- Test failures in wrong environment should exit gracefully with explanation

**Prevention**:

- Check `settings.json` mcpServers before adding MCP tools to agents
- Use `Skill()` invocation as fallback (doesn't require MCP server)
- Add environment checks to deployment-specific test suites

**Impact**: Eliminated 12 "No such tool available" errors, prevented false test failures in development.

---

### Phase 2 Spawn Template Updates (2026-01-28)

**Context**: After Phase 1 removed MCP tool from agent definitions, spawn templates in CLAUDE.md still referenced the tool, creating inconsistency between templates and reality.

**Changes Applied**:

1. **Universal Spawn Template** (Section 2): Removed `mcp__sequential-thinking__sequentialthinking`, added comment directing to Skill() fallback
2. **Orchestrator Spawn Template** (Section 2): Removed `mcp__sequential-thinking__sequentialthinking`, added comment directing to Skill() fallback
3. **Tool Selection Notes** (Section 2): New section explaining MCP vs core tool distinction

**Pattern Learned**:

- Spawn templates are documentation, not enforcement - agents can't use tools not in their definition
- Comments in templates guide spawning agents to correct tool usage
- Centralized Tool Selection Notes reduces duplication of guidance
- MCP tool fallback pattern: Use `Skill({ skill: 'sequential-thinking' })` when MCP not configured

**Prevention**:

- When removing tools from agent definitions, search and update all spawn templates
- Add guidance comments explaining WHY tools were removed and WHAT to use instead
- Document MCP tool requirements in centralized location (Tool Selection Notes)

**Impact**: Spawn templates now consistent with agent definitions, Router has clear guidance for MCP vs core tool selection.

---
