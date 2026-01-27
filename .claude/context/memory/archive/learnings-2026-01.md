# Project Learnings and Context

> **NOTICE: Legacy Archive File**
>
> This file is now a **read-only archive**. New learnings should be recorded using the session-based memory system:
>
> ```bash
> # Record a gotcha
> node .claude/lib/memory/memory-manager.cjs record-gotcha "description"
>
> # Record a pattern
> node .claude/lib/memory/memory-manager.cjs record-pattern "description"
>
> # Record a discovery
> node .claude/lib/memory/memory-manager.cjs record-discovery "path" "description"
>
> # Load all memory (truncated for context efficiency)
> node .claude/lib/memory/memory-manager.cjs load
> ```
>
> **New Storage Locations:**
>
> - `.claude/context/memory/gotchas.json` - Pitfalls to avoid
> - `.claude/context/memory/patterns.json` - Reusable solutions
> - `.claude/context/memory/codebase_map.json` - File discoveries
> - `.claude/context/memory/sessions/` - Per-session JSON files
>
> This file is kept for historical reference and backward compatibility.
>
> **ARCHIVAL GUIDANCE**: When this file exceeds 5000 lines, archive older sections to `.claude/context/memory/archive/learnings-YYYY-MM.md`
>
> **ARCHIVED CONTENT**: Detailed integration logs from 2026-01-24 moved to `.claude/context/memory/archive/learnings-archive-2026-01.md`

---

## [2026-01-25] Phase 4: Memory Monitoring and Automation Completed

**Implementation Summary**:
Implemented unified memory dashboard and automated maintenance scheduler.

**Files Created**:

- `.claude/lib/memory/memory-dashboard.cjs` - Unified metrics collection, health scoring, recommendations
- `.claude/lib/memory/memory-scheduler.cjs` - Automated daily/weekly maintenance tasks
- `.claude/lib/memory-dashboard.test.cjs` - 14 tests for dashboard
- `.claude/lib/memory-scheduler.test.cjs` - 12 tests for scheduler
- `.claude/context/memory/metrics/` - Directory for historical metrics

**Key Features**:

### Memory Dashboard

- **collectMetrics()**: Gathers metrics from all memory sources (files, tiers, sessions)
- **calculateHealthScore()**: 0-1 composite score based on weighted metrics
- **generateRecommendations()**: Auto-suggest actions based on thresholds
- **saveMetrics()/getMetricsHistory()**: Track trends over 30 days

**Health Score Weights**:
| Metric | Weight |
|--------|--------|
| learnings.md size | 0.20 |
| patterns count | 0.15 |
| gotchas count | 0.15 |
| codebase_map entries | 0.25 |
| MTM session count | 0.25 |

### Memory Scheduler

**Daily Tasks**:

- `consolidation` - Move STM to MTM
- `healthCheck` - Check tier health and log metrics
- `metricsLog` - Save daily snapshot to metrics/

**Weekly Tasks** (includes daily):

- `summarization` - Compress old MTM sessions to LTM
- `deduplication` - Remove duplicate patterns/gotchas
- `pruning` - Archive learnings, prune codebase_map
- `weeklyReport` - Generate trend report

**CLI Commands**:

```bash
# Dashboard
node .claude/lib/memory/memory-dashboard.cjs health    # Full dashboard
node .claude/lib/memory/memory-dashboard.cjs json      # JSON output
node .claude/lib/memory/memory-dashboard.cjs history 7 # Last 7 days

# Scheduler
node .claude/lib/memory/memory-scheduler.cjs daily     # Run daily tasks
node .claude/lib/memory/memory-scheduler.cjs weekly    # Run weekly tasks
node .claude/lib/memory/memory-scheduler.cjs status    # Check maintenance status

# Via memory-manager
node .claude/lib/memory/memory-manager.cjs dashboard   # Unified dashboard
node .claude/lib/memory/memory-manager.cjs maintenance daily  # Run maintenance
```

**Integration Points**:

- `memory-health-check.cjs` hook now saves metrics on each run
- `memory-manager.cjs` CLI has `dashboard` and `maintenance` commands

**Test Coverage**: 26 new tests (14 dashboard + 12 scheduler)

**Total Memory System Tests**: 83 tests across 5 modules

---

## [2026-01-25] Phase 3: Smart Pruning Completed

**Implementation Summary**:
Implemented utility-based scoring and semantic deduplication based on research findings.

**Utility Scoring Formula**:

```
Score = 0.3 * recency + 0.3 * frequency + 0.4 * importance
```

**Components**:
| Component | Calculation |
|-----------|-------------|
| Recency | Exponential decay with 30-day half-life |
| Frequency | Logarithmic scaling (caps at 20 accesses) |
| Importance | Pattern-based markers (CRITICAL=1.0, IMPORTANT=0.8, etc.) |

**Files Created**:

- `.claude/lib/memory/smart-pruner.cjs` - Core pruning module with utility scoring, Jaccard similarity, deduplication
- `.claude/lib/smart-pruner.test.cjs` - 29 tests covering all functionality

**Key Functions**:

- `calculateUtility(entry)` - Combined score for pruning decisions
- `jaccardSimilarity(s1, s2)` - Word-overlap similarity (0-1)
- `findSimilarEntries(entries)` - Group duplicates by similarity
- `mergeEntries(group)` - Combine duplicates preserving best info (prioritizes importance markers)
- `pruneByUtility(entries, target)` - Remove lowest utility entries
- `deduplicateAndPrune(entries, options)` - Full cleanup pipeline

**Importance Markers** (highest wins):
| Marker | Weight |
|--------|--------|
| CRITICAL | 1.0 |
| Iron Law | 1.0 |
| NEVER/ALWAYS | 0.9 |
| IMPORTANT | 0.8 |
| decision: | 0.8 |
| pattern: | 0.7 |
| WARNING | 0.7 |
| NOTE: | 0.5 |
| (unmarked) | 0.2 |

**Integration with memory-health-check.cjs**:

- Now monitors patterns.json and gotchas.json counts
- Auto-prunes when over threshold (50 entries)
- Reports patterns/gotchas counts in health metrics

**CLI Commands**:

```bash
node .claude/lib/memory/smart-pruner.cjs analyze <file.json>  # Show top/bottom by utility
node .claude/lib/memory/smart-pruner.cjs prune <file.json> N  # Prune to N entries
node .claude/lib/memory/smart-pruner.cjs prune <file.json> N --write  # Prune and save
node .claude/lib/memory/smart-pruner.cjs similarity "text1" "text2"  # Check similarity
```

**Test Coverage**: 29 tests, all passing

---

## [2026-01-25] Phase 2: Memory Hierarchy (STM/MTM/LTM) Completed

**Implementation Summary**:
Implemented three-tier memory hierarchy based on research findings (MemoryOS, H-MEM patterns).

**Memory Tiers**:
| Tier | Name | Purpose | Retention | Max Sessions |
|------|------|---------|-----------|--------------|
| STM | Short-Term Memory | Current session context | Session-bound | 1 |
| MTM | Mid-Term Memory | Recent sessions (detailed) | 10 sessions | 10 |
| LTM | Long-Term Memory | Permanent knowledge (summaries) | Permanent | Unlimited |

**Files Created**:

- `.claude/lib/memory/memory-tiers.cjs` - Core tier logic (consolidation, promotion, summarization)
- `.claude/lib/memory-tiers.test.cjs` - 14 tests, all passing

**Directories Created**:

- `.claude/context/memory/stm/` - Short-Term Memory storage
- `.claude/context/memory/mtm/` - Mid-Term Memory storage
- `.claude/context/memory/ltm/` - Long-Term Memory storage (summaries)

**Hooks Updated**:

- `session-end-recorder.cjs` - Now writes to STM then consolidates to MTM
- `memory-health-check.cjs` - Now monitors all three tiers

**Key Functions**:

- `writeSTMEntry()` - Write current session to STM
- `consolidateSession()` - Move STM to MTM after session ends
- `promoteToLTM()` - Manually promote high-value sessions
- `summarizeOldSessions()` - Compress old MTM sessions to LTM summaries
- `generateSessionSummary()` - Create structured summary from session group
- `getTierHealth()` - Health check for all memory tiers

**LTM Summary Format**:

```json
{
  "type": "session_summary",
  "date_range": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" },
  "session_count": N,
  "key_learnings": [...],
  "major_decisions": [...],
  "important_patterns": [...],
  "files_frequently_touched": [...]
}
```

**CLI Commands**:

```bash
node .claude/lib/memory/memory-tiers.cjs health          # Check tier health
node .claude/lib/memory/memory-tiers.cjs consolidate     # Consolidate STM -> MTM
node .claude/lib/memory/memory-tiers.cjs summarize       # Summarize old MTM -> LTM
node .claude/lib/memory/memory-tiers.cjs promote <id>    # Promote to LTM
node .claude/lib/memory/memory-tiers.cjs mtm-list        # List MTM sessions
```

**Test Coverage**: 14 tests covering all tier operations

---

## [2026-01-25] Phase 1 Critical Memory Fixes Completed

**Issue 1: Auto-archival for learnings.md** (40KB threshold)

- Added `checkAndArchiveLearnings()` function to memory-manager.cjs
- Archives content when file exceeds 40KB
- Keeps last 50 lines for continuity
- Archive format: `learnings-YYYY-MM.md` in archive/ directory

**Issue 2: TTL/size-based pruning for codebase_map.json**

- Added `pruneCodebaseMap()` function to memory-manager.cjs
- Removes entries older than 90 days (TTL)
- If still over 500 entries after TTL, removes oldest
- Added `last_accessed` field to all discovery entries
- Auto-migrates legacy entries without last_accessed

**Issue 3: Memory Health Check Hook**

- Created `memory-health-check.cjs` hook in `.claude/hooks/memory/`
- Warns when learnings.md > 35KB (archival at 40KB)
- Warns when codebase_map > 400 entries (prune at 500)
- Reports session count
- Auto-triggers archival/pruning when hard thresholds exceeded

**CLI Commands Added**:

```bash
node .claude/lib/memory/memory-manager.cjs health          # Check memory health
node .claude/lib/memory/memory-manager.cjs archive-learnings  # Manually archive
node .claude/lib/memory/memory-manager.cjs prune-codebase     # Manually prune
```

**Test Coverage**: 14 tests, all passing

- File: `.claude/lib/memory/memory-manager.test.cjs`

**Hook Registration**: Added to UserPromptSubmit in settings.json

---

## [2026-01-25] EVOLVE Enforcement Hooks Completed (100%)

**Hooks Created**:

- `quality-gate-validator.cjs` - Enforces quality checks during VERIFY phase (placeholders, missing sections, content length)
- `evolution-trigger-detector.cjs` - Auto-detects evolution keywords in user prompts, writes suggestions to evolution-state.json

**Test Coverage**:

- `quality-gate-validator.test.cjs` - 25 tests, all passing
- `evolution-trigger-detector.test.cjs` - 23 tests, all passing

**Registration**:

- `quality-gate-validator.cjs` added to PreToolUse(Edit|Write|NotebookEdit)
- `evolution-trigger-detector.cjs` added to UserPromptSubmit

**Complete Enforcement Hook List (6/6)**:
| Hook | Phase | Status | Tests |
|------|-------|--------|-------|
| `research-enforcement.cjs` | OBTAIN→LOCK | ✅ | ✅ |
| `evolution-state-guard.cjs` | ALL | ✅ | ✅ |
| `conflict-detector.cjs` | VALIDATE | ✅ | ✅ |
| `evolution-audit.cjs` | ENABLE | ✅ | ✅ |
| `quality-gate-validator.cjs` | VERIFY | ✅ | ✅ |
| `evolution-trigger-detector.cjs` | IDLE→EVALUATE | ✅ | ✅ |

**EVOLVE System Status**: 100% Complete

---

## [2026-01-25] EVOLVE Workflow Created

**Workflow Created**: `evolution-workflow` at `.claude/workflows/core/evolution-workflow.md`

**Purpose**: Locked-in workflow for self-evolution. Defines the MANDATORY state machine that all ecosystem evolution must follow.

**Key Features**:

- 6-Phase State Machine: E(valuate)->V(alidate)->O(btain)->L(ock)->V(erify)->E(nable)
- MANDATORY Research Phase (OBTAIN) - Cannot be skipped, requires 3+ queries, 3+ sources
- Gate-based progression with explicit exit conditions for each phase
- State persistence in `evolution-state.json` for recovery and audit
- 6 enforcement hooks defined: evolution-trigger-detector, conflict-detector, research-enforcement, evolution-state-guard, quality-gate-validator, evolution-audit
- 6 Iron Laws including "NO ARTIFACT WITHOUT RESEARCH" and "NO ARTIFACT WITHOUT ROUTING"

**Integration Points**:

- Added to CLAUDE.md Section 8.6 (Enterprise Workflows)
- References evolution-orchestrator agent at `.claude/agents/orchestrators/evolution-orchestrator.md`
- Uses research-synthesis skill in OBTAIN phase
- Uses all creator skills (agent-creator, skill-creator, etc.) in LOCK phase

**Usage Pattern**:

```javascript
// Router detects evolution need, spawns evolution-orchestrator
Task({
  subagent_type: 'evolution-orchestrator',
  description: 'Creating new artifact via EVOLVE workflow',
  prompt: `Follow EVOLVE workflow at .claude/workflows/core/evolution-workflow.md`,
});
```

**ADR**: ADR-011 in `.claude/context/memory/decisions.md`

---

## [2026-01-25] Research-Synthesis Skill Created

**Skill Created**: `research-synthesis` at `.claude/skills/research-synthesis/SKILL.md`

**Purpose**: Synthesize research from Exa/WebSearch into actionable design decisions BEFORE any creator skill invocation.

**Key Features**:

- Mandatory 3-query minimum research protocol
- Integration with Exa MCP tools and WebSearch/WebFetch
- Structured research report output format
- Quality gate checklist before proceeding to artifact creation
- Risk assessment with mitigations

**Integration Points**:

- Added to CLAUDE.md Section 3 (Creator Skills) as first entry
- Added to CLAUDE.md Section 4.1 (Creator Ecosystem) table
- Added to Skill Catalog under Creator Tools (now 10 skills, total 427)

**Usage Pattern**:

```javascript
// BEFORE creating any artifact
Skill({ skill: 'research-synthesis' });
// Execute research protocol...
// THEN invoke creator
Skill({ skill: 'skill-creator' });
```

---

## [2026-01-25] Task Synchronization Protocol Enforcement

**Problem**: Agents complete work but never call `TaskUpdate({ status: "completed" })`, breaking task tracking.

**Fix Applied**:

1. Added "Task Progress Protocol (MANDATORY)" section to all 7 core agents
2. Enhanced CLAUDE.md spawn template with Iron Laws emphasis

**The Three Iron Laws (Agents MUST Follow)**:

1. **LAW 1**: ALWAYS call TaskUpdate({ status: "in_progress" }) when starting
2. **LAW 2**: ALWAYS call TaskUpdate({ status: "completed", metadata: {...} }) when done
3. **LAW 3**: ALWAYS call TaskList() after completion to find next work

---

## Key Decisions

- [2026-01-23] Adopted Router-First Protocol for all interactions
- [2026-01-23] Standardized on Anthropic Tool Use (Parallel, Bash, Code Execution)
- [2026-01-24] **CRITICAL**: ALWAYS update CLAUDE.md after creating skills/agents/workflows
- [2026-01-24] Standardized `context_strategy` field in agent YAML frontmatter (minimal, lazy_load, full)
- [2026-01-24] Created comprehensive Skill Catalog at `.claude/context/artifacts/skill-catalog.md`
- [2026-01-24] Integrated K-Dense Scientific Skills (139 sub-skills) at `.claude/skills/scientific-skills/`
- [2026-01-25] Comprehensive Documentation Update for Audit Fixes (see `.claude/docs/`)

---

## Patterns Identified

- Agents must explicitly reference tools to use them effectively
- Parallel tool use significantly speeds up exploration

### Cross-Platform Shell Commands (CRITICAL)

**Problem**: Using `/dev/null` in shell commands creates a literal `nul` file on Windows.

**Solution**: Use platform-aware null device:

```javascript
const { NULL_DEVICE } = require('../lib/platform.cjs');
execSync(`command 2>${NULL_DEVICE}`);
```

**Library Location**: `.claude/lib/platform.cjs` and `.claude/lib/platform.mjs`

**Hook-Based Fix**: `windows-null-sanitizer.cjs` PreToolUse hook intercepts ALL Bash commands on Windows and replaces `/dev/null` with `NUL`.

---

## User Preferences

- Prefer concise plans
- Strict adherence to TDD

---

## Critical Hooks

| Hook                        | Location                 | Purpose                                  |
| --------------------------- | ------------------------ | ---------------------------------------- |
| `windows-null-sanitizer`    | `.claude/hooks/safety/`  | Prevents literal "nul" files on Windows  |
| `validate-skill-invocation` | `.claude/hooks/safety/`  | Validates Skill() tool usage             |
| `bash-command-validator`    | `.claude/hooks/safety/`  | Security validation (fail-closed)        |
| `router-write-guard`        | `.claude/hooks/safety/`  | Prevents router from using Edit/Write    |
| `task-create-guard`         | `.claude/hooks/routing/` | Enforces PLANNER-first for complex tasks |
| `enforce-claude-md-update`  | `.claude/hooks/safety/`  | Reminds to update CLAUDE.md              |
| `memory-reminder`           | `.claude/hooks/session/` | Reminds to read memory files             |
| `security-review-guard`     | `.claude/hooks/routing/` | Blocks dev spawns without security review|
| `file-placement-guard`      | `.claude/hooks/safety/`  | Enforces file placement rules            |

---

## Security Patterns (2026-01-25)

### Pattern: Use validatePath() Before File Operations

**Always validate paths before file operations in framework code:**

```javascript
const { validatePath } = require('./validator.cjs');

// BEFORE any fs.readFileSync, fs.writeFileSync, fs.rmSync
const validation = validatePath(filePath);
if (!validation.valid) {
  throw new Error(`Invalid path: ${validation.reason}`);
}
```

**Location**: `.claude/lib/self-healing/validator.cjs`

### Pattern: Fail-Closed for Security Hooks

**Security hooks must fail-closed, not fail-open:**

```javascript
// WRONG - Fail open allows bypass via induced errors
} catch (err) {
  process.exit(0);  // DANGEROUS: Allows action on error
}

// CORRECT - Fail closed, deny by default
} catch (err) {
  console.error('[security-hook] Error, denying by default:', err.message);
  process.exit(2);  // SAFE: Blocks action on error
}
```

### Anti-Pattern: Avoid new Function() / eval()

**Never use `new Function()` or `eval()` with external input:**

```javascript
// DANGEROUS - Allows code injection
const evaluator = new Function('context', `return ${userInput};`);

// SAFE - Use a restricted expression parser
const exprEval = require('expr-eval');
const parser = new exprEval.Parser();
const result = parser.evaluate(expression, context);
```

### Pattern: Validate State Files After JSON.parse()

**Always validate parsed JSON against schema:**

```javascript
const { validateOutput } = require('./validator.cjs');

const content = fs.readFileSync(stateFile, 'utf-8');
const data = JSON.parse(content);

// Validate against schema
const validation = validateOutput(data, STATE_SCHEMA);
if (!validation.valid) {
  throw new Error(`Invalid state: ${validation.errors.join(', ')}`);
}
```

### Pattern: Array-Form for Child Process Execution

**Avoid string interpolation with execSync:**

```javascript
// DANGEROUS - Command injection risk
execSync(`node "${scriptPath}" ${args.join(' ')}`);

// SAFE - Array form prevents injection
const { spawnSync } = require('child_process');
spawnSync('node', [scriptPath, ...args], { shell: false });
```

---

## Creator Ecosystem Summary

| Creator            | Creates      | Output Location      |
| ------------------ | ------------ | -------------------- |
| `agent-creator`    | Agents       | `.claude/agents/`    |
| `skill-creator`    | Skills       | `.claude/skills/`    |
| `hook-creator`     | Hooks        | `.claude/hooks/`     |
| `workflow-creator` | Workflows    | `.claude/workflows/` |
| `template-creator` | Templates    | `.claude/templates/` |
| `schema-creator`   | JSON Schemas | `.claude/schemas/`   |

**Iron Law**: NO CREATION WITHOUT CLAUDE.MD UPDATE

---

## Integrated Components Summary (2026-01-24)

> **Full details**: `.claude/context/memory/archive/learnings-archive-2026-01.md`

### Auto-Claude Integration

- **Security Validators**: 6 CJS hooks in `.claude/hooks/safety/validators/`
- **Skills Created**: spec-gathering, spec-writing, spec-critique, complexity-assessment, insight-extraction, qa-workflow
- **Analysis Patterns**: 4 reference files in `.claude/skills/project-analyzer/references/`
- **Recovery Patterns**: 3 reference files in `.claude/skills/recovery/references/`

### Superpowers Integration

- **Foundation Skills**: tdd (enhanced), debugging (4-phase), verification-before-completion
- **Workflow Skills**: brainstorming, writing-plans, executing-plans, subagent-driven-development
- **Git Workflow**: using-git-worktrees, finishing-a-development-branch
- **Advanced**: dispatching-parallel-agents, writing-skills, skill-discovery
- **Code Review**: code-reviewer agent + requesting/receiving skills
- **Key Patterns**: Iron Laws, Rationalization Tables, Red Flags, Gate Functions

### Language Pro Agents

- python-pro, rust-pro, golang-pro, typescript-pro, fastapi-pro (all with Memory Protocol)

### Conductor Integration

- **Skills**: context-driven-development, track-management, workflow-patterns
- **Agent**: conductor-validator
- **Workflow**: conductor-setup-workflow

### C4 Architecture

- **Agents**: c4-code, c4-component, c4-container, c4-context
- **Workflow**: c4-architecture-workflow

### Kubernetes Operations

- **Skills**: k8s-manifest-generator, helm-chart-scaffolding, gitops-workflow, k8s-security-policies

### Reverse Engineering (AUTHORIZED USE ONLY)

- **Skills**: binary-analysis-patterns, memory-forensics, protocol-reverse-engineering
- **Agent**: reverse-engineer

### Serena Integration

- **Skills**: project-onboarding, thinking-tools, summarize-changes, operational-modes, session-handoff
- **Patterns**: Mode-based tool exclusion, memory persistence, thinking checkpoints

---

## Security Validators Architecture

**Central Registry**: `.claude/hooks/safety/validators/registry.cjs`

**Validation Function Signature**:

```javascript
function validateCommand(commandString) {
  return { valid: boolean, error: string };
}
```

**Validators** (all fail-closed after SEC-001/002/003 fixes):

- `shell-validators.cjs` - Bash/sh/zsh (blocks eval, nested shells)
- `database-validators.cjs` - PostgreSQL/MySQL/Redis/MongoDB
- `filesystem-validators.cjs` - chmod/rm operations
- `git-validators.cjs` - config/push protection
- `process-validators.cjs` - kill/pkill/killall
- `network-validators.cjs` - curl/wget pipe protection

---

## Router Decision Workflow

**Location**: `.claude/workflows/core/router-decision.md`

**9-Step Process**:

1. Duplication Check
2. Task List Check
3. Request Classification (Intent, Complexity, Domain, Risk)
4. External Repo Detection
5. Self-Check Protocol (4 mandatory questions)
6. Valid Router Actions (whitelist/blacklist)
7. Agent Selection
8. Spawn Decision (single, parallel, phased)
9. Model Selection (haiku/sonnet/opus)

**Router Tool Restrictions**:

- **Whitelist**: TaskList, TaskCreate, TaskUpdate, TaskGet, Task, Read (routing files), AskUserQuestion
- **Blacklist**: Edit, Write, Bash (implementation), Glob, Grep, WebSearch, mcp\_\_\*

---

## Framework Statistics (2026-01-25)

- **Agents**: 39 (8 core, 17 domain, 2 orchestrators, 12 specialized)
- **Skills**: 426 (284 directories + 139 scientific sub-skills)
- **Hooks**: 23 (organized into safety, routing, memory, session)
- **Workflows**: 10+ (enterprise, operations, core)
- **Schemas**: 77 (11 core + 66 skill schemas)
- **Templates**: 4 (agent, skill, workflow, README)

---

## Skill Invocation Protocol

**CORRECT**: Use Skill tool to invoke

```javascript
Skill({ skill: 'tdd' });
Skill({ skill: 'debugging' });
```

**WRONG**: Just reading the file doesn't apply the skill

```javascript
Read('.claude/skills/tdd/SKILL.md'); // Reading is NOT invoking
```

**Scientific Skills**: Use full path format

```javascript
Skill({ skill: 'scientific-skills/rdkit' }); // NOT just 'rdkit'
```

---

## Audit Findings Summary (2026-01-25)

### CLAUDE.md Audit

- **Routing Table**: 100% accurate (39 agents)
- **Workflow Table**: 100% accurate (7 workflows)
- **Creator Skills**: 100% accurate (6 creators)
- **One Path Issue**: task-create-guard.cjs location corrected to `.claude/hooks/routing/`

### Hooks and Safety Audit

- **23 hooks** organized into 4 categories
- **Security validators**: All fail-closed (SEC-001/002/003 fixes verified)
- **Pass rate**: 16/16 audited hooks pass

### Schema Audit

- **77 schemas**: 100% valid
- **Standards**: Consistent JSON Schema draft-07 and draft-2020-12

---

## Key Learning: Router Update After Integration

**Issue**: After integration work, new skills/agents/workflows were NOT added to CLAUDE.md.

**Root Cause**: Manual integration bypassed creator skills that enforce this.

**Fix**: Created `codebase-integration` skill with 8-phase workflow including mandatory router update step.

**Rule**:

```
IRON LAW: NO INTEGRATION WITHOUT CLAUDE.MD UPDATE

After creating ANY skill, agent, or workflow:
1. Update CLAUDE.md Section 3 (agents) or Section 8.5 (skills) or Section 8.6 (workflows)
2. Run: grep "<item-name>" .claude/CLAUDE.md || echo "ERROR!"
3. Update learnings.md with integration summary

WHY: Items not in CLAUDE.md are INVISIBLE to the Router.
```

---

## Memory Protocol (All Agents/Skills Must Follow)

**Before starting:**

```bash
cat .claude/context/memory/learnings.md
```

**After completing:**

- New pattern -> `.claude/context/memory/learnings.md`
- Issue found -> `.claude/context/memory/issues.md`
- Decision made -> `.claude/context/memory/decisions.md`

> **ASSUME INTERRUPTION**: If it's not in memory, it didn't happen.

---

## [2026-01-25] Agent Context Race Condition Fix

**Problem**: Race condition in agent context tracking caused spawned agents to be blocked from using Write/Edit.

**Root Cause**:

1. Router calls `Task()` to spawn agent
2. Agent starts - its `UserPromptSubmit` fires
3. `router-mode-reset.cjs` checks if mode='agent' - but it's STILL 'router' because...
4. Router's `PostToolUse(Task)` hasn't completed yet to call `enterAgentMode()`

**Timeline BEFORE fix**:

```
Router Task() -> Agent starts -> UserPromptSubmit resets to 'router' -> PostToolUse sets 'agent' (TOO LATE)
```

**Fix Applied**: Created `agent-context-pre-tracker.cjs` hook that sets `mode='agent'` in `PreToolUse(Task)` BEFORE the task runs.

**Timeline AFTER fix**:

```
Router Task() -> PreToolUse sets 'agent' -> Agent starts -> UserPromptSubmit sees 'agent', skips reset
```

**Files Created**:

- `.claude/hooks/routing/agent-context-pre-tracker.cjs` - PreToolUse hook for Task

**Files Modified**:

- `.claude/settings.json` - Added hook to PreToolUse Task matcher (first position)

**Hook Order in PreToolUse(Task)**:

1. `agent-context-pre-tracker.cjs` (sets mode=agent FIRST)
2. `planner-first-guard.cjs`
3. `security-review-guard.cjs`

## [2026-01-25] Router Discipline - Documentation Routing Fixes

**Problem**: Documentation requests being routed to developer instead of technical-writer.

**Fixes Implemented**:

1. Added documentation intent keywords to router-enforcer.cjs
2. Added +5 scoring boost for technical-writer on documentation intent
3. Created ROUTING_TABLE constant mirroring CLAUDE.md Section 3
4. Changed technical-writer priority from medium to high
5. Added Routing Exclusions section to developer.md
6. Created documentation-routing-guard.cjs hook (PreToolUse Task)
7. Added 30 new tests (18 router-enforcer + 18 doc-routing-guard, all pass)

**Files Modified**:

- .claude/hooks/routing/router-enforcer.cjs
- .claude/agents/core/technical-writer.md
- .claude/agents/core/developer.md
- .claude/hooks/routing/documentation-routing-guard.cjs (new)
- .claude/hooks/routing/documentation-routing-guard.test.cjs (new)
- .claude/hooks/routing/router-enforcer.test.cjs
- .claude/settings.json

**Hook Order in PreToolUse(Task)** (updated):

1. agent-context-pre-tracker.cjs
2. planner-first-guard.cjs
3. security-review-guard.cjs
4. documentation-routing-guard.cjs (NEW)

---

## [2026-01-25] Router-Enforcer Comprehensive Agent Keywords Update

**Problem**: Router-enforcer.cjs only had keywords for ~15 agents. Needed comprehensive coverage for all 41 agents.

**Research Conducted**: Created 5 research reports with keywords for all agents:

- `agent-keywords-core.md` - 8 core agents (architect, context-compressor, developer, planner, pm, qa, router, technical-writer)
- `agent-keywords-domain-languages.md` - 6 language agents (python-pro, rust-pro, golang-pro, typescript-pro, java-pro, php-pro)
- `agent-keywords-domain-frameworks.md` - 8 framework agents (fastapi-pro, nextjs-pro, sveltekit-expert, nodejs-pro, expo-mobile-developer, tauri-desktop-developer, ios-pro, graphql-pro)
- `agent-keywords-domain-other.md` - 3 other domain agents (frontend-pro, data-engineer, mobile-ux-reviewer)
- `agent-keywords-specialized.md` - 12 specialized agents (c4-\*, code-reviewer, conductor-validator, database-architect, devops, devops-troubleshooter, incident-responder, reverse-engineer, security-architect)
- Plus 3 orchestrators (master-orchestrator, swarm-coordinator, evolution-orchestrator)

**Files Modified**:

- `.claude/hooks/routing/router-enforcer.cjs`

**Key Changes**:

1. **intentKeywords Object**: Expanded from ~15 to 41 agent categories with comprehensive keyword lists (~260 lines)

2. **INTENT_TO_AGENT Mapping**: New constant that maps intent keys to actual agent names

```javascript
const INTENT_TO_AGENT = {
  architect: 'architect',
  documentation: 'technical-writer',
  python: 'python-pro',
  // ... all 41 mappings
};
```

3. **DISAMBIGUATION_RULES**: New constant with 10 disambiguation categories for overlapping keywords

```javascript
const DISAMBIGUATION_RULES = {
  design: [
    { condition: ['system', 'architecture'], prefer: 'architect', deprioritize: 'planner' },
    { condition: ['plan', 'breakdown'], prefer: 'planner', deprioritize: 'architect' },
  ],
  // ... 9 more categories (test, refactor, async, api, migration, mobile, component, debug, review, database)
};
```

4. **Updated scoreAgents()**: Now uses INTENT_TO_AGENT for domain-specific boosts

5. **New applyDisambiguation()**: Resolves ambiguous prompts using context rules

**Test Results**: All 18 tests pass after updating assertions to check for INTENT_TO_AGENT instead of old scoring patterns.

**Research Reports Location**: `.claude/context/artifacts/research-reports/`

**Pattern**: When extending router capabilities, create research reports first documenting keyword sources.

---

## [2026-01-25] Workflow Engine Core Module Created

**Files Created**:

- `.claude/lib/workflow/workflow-engine.cjs` - Production-grade workflow engine for EVOLVE system
- `.claude/lib/workflow-engine.test.cjs` - 55 comprehensive tests
- `.claude/workflows/creators/` - Directory for creator workflow YAML files

**Key Features Implemented**:

1. **EVOLVE State Machine**: 6 phases (EVALUATE, VALIDATE, OBTAIN, LOCK, VERIFY, ENABLE)
2. **TRANSITIONS Constant**: Defines valid phase transitions including retry (verify->lock)
3. **YAML Parser**: Custom parser without external dependencies for workflow definitions
4. **Step Executor**: With before/after hooks, handler registration, result storage
5. **Gate Validation**: JavaScript condition evaluation for phase transitions
6. **Checkpoint/Resume**: File-based checkpoints for workflow durability
7. **Rollback**: Compensating actions executed in reverse order
8. **Event System**: phase:start/end/error, step:start/end/error, gate:pass/fail, checkpoint:save/restore

**YAML Parser Learning**:

- Custom YAML parser handles basic structures (objects, arrays, strings, numbers, booleans)
- Key insight: When parsing array items like `- id: step1`, nested properties under the item must be collected separately
- The parser correctly handles the indentation-based structure common in workflow definitions

**Test Framework Pattern**:

- Simple test framework with `describe`/`it` that collects tests into a queue
- Sequential execution via `await runTestQueue()` prevents race conditions with shared resources
- Important: Async tests must be awaited, not just returned as promises

**Handler Registration Pattern**:

- Handlers registered by name, executed during step execution
- Results stored in `state.stepResults[stepId]`
- Gate conditions access results via `steps.<stepId>.output.<field>`
- Handlers should return objects with `output` field for gate compatibility

**CLI Commands**:

```bash
node .claude/lib/workflow-engine.test.cjs  # Run 55 tests
```

**Exports**:

```javascript
const {
  WorkflowEngine,
  PHASES,
  TRANSITIONS,
  parseWorkflow,
  validateWorkflow,
} = require('./workflow-engine.cjs');
```

---

## [2026-01-25] Agent Creator Workflow YAML Created

**Files Created**:

- `.claude/workflows/creators/agent-creator-workflow.yaml` - Executable workflow for creating new agents
- `.claude/workflows/creators/agent-creator-workflow.test.cjs` - 37 comprehensive tests

**Key Features**:

1. **6 EVOLVE Phases**: evaluate, validate, obtain, lock, verify, enable
2. **18 Total Steps** with unique IDs across all phases
3. **Gates per Phase** with assertion and type-specific validation
4. **Saga-Based Rollback** with compensation definitions
5. **Iron Laws in Metadata** enforcing best practices

**YAML Structure Pattern**:

```yaml
name: <workflow-name>
version: 1.0.0
description: <description>
triggers:
  - pattern: <regex-pattern>

phases:
  <phase-name>:
    description: <phase-description>
    steps:
      - id: <unique-step-id>
        action: <action-type> # search, prompt, write, validate, edit, etc.
        handler: <handler-name>
        description: <what-it-does>
        compensate: # Optional rollback config
          type: <compensation-type>
    gates:
      - type: <gate-type> # assertion, research, file_exists, registration
        condition: <js-condition> # For assertions
        message: <failure-message>

rollback:
  strategy: saga
  compensations:
    - <type>: <action>

metadata:
  iron_laws:
    - <law-1>
```

**Gate Types**:

- `assertion` - JavaScript condition evaluation
- `research` - Requires minQueries, minSources, reportRequired
- `file_exists` - Check path exists
- `registration` - Check targets array for multiple registrations

**Step Action Types**:

- `search` - Search existing artifacts
- `prompt` - Interactive confirmation
- `write` - Create new file
- `validate` - Check rules/patterns
- `edit` - Modify existing file
- `mkdir` - Create directory
- `append` - Append to file
- `command` - Run shell command
- `classify` - Categorize artifact
- `exa_search` / `web_search` - External research

**Test Coverage**: 37 tests covering all phases, gates, rollback, and iron laws

---

## [2026-01-25] Integration Layer for Executable Workflows Created

**Files Created**:

- `.claude/lib/cross-workflow-trigger.cjs` - Cross-workflow triggering with circular detection
- `.claude/lib/cross-workflow-trigger.test.cjs` - 14 tests
- `.claude/lib/system-registration-handler.cjs` - Automated registration in system files
- `.claude/lib/system-registration-handler.test.cjs` - 13 tests
- `.claude/lib/evolution-state-sync.cjs` - Evolution state synchronization
- `.claude/lib/evolution-state-sync.test.cjs` - 22 tests

**Key Features**:

### CrossWorkflowTrigger

- Sync triggers (wait for result) and async triggers (fire-and-forget)
- Circular trigger detection to prevent infinite loops
- Trigger history tracking for debugging
- Multiple workflow triggering in parallel
- Max chain depth limit (default: 10)

### SystemRegistrationHandler

- Registers agents, skills, hooks, workflows in system files
- Creates backups before modification
- Supports CLAUDE.md, settings.json, skill-catalog.md
- Deregistration and update capabilities
- Verification of registration status

### EvolutionStateSync

- Reads/writes `.claude/context/evolution-state.json`
- Locking mechanism with timeout for exclusive access
- Suggestion queue management (add/pop)
- History recording for evolutions
- Current evolution tracking with phase updates
- State caching for performance

**Integration Points**:

- Works with `workflow-engine.cjs` phase transitions
- Integrates with `saga-coordinator.cjs` for rollback
- Uses `checkpoint-manager.cjs` patterns for state persistence

**Test Coverage**: 49 tests across 3 modules, all passing

---

## [2026-01-25] Phase 4: CLI and Comprehensive Tests Created

**Files Created**:

- `.claude/lib/workflow-cli.cjs` - Command-line interface for workflow execution
- `.claude/lib/workflow-cli.test.cjs` - 26 tests for CLI
- `.claude/lib/workflow-validator.cjs` - EVOLVE workflow YAML validator
- `.claude/lib/workflow-validator.test.cjs` - 19 tests for validator
- `.claude/lib/workflow-integration.test.cjs` - 24 comprehensive integration tests
- `.claude/scripts/run-workflow-tests.cjs` - Test runner script

**Key Features**:

### Workflow CLI

- Commands: create, update, resume, list, status, rollback
- Flags: --dry-run, --verbose, --help
- Workflow path resolution for creator/updater workflows
- Exports: `WorkflowCLI`, `parseArgs`, `COMMANDS`, `WORKFLOW_TYPES`

### Workflow Validator

- EVOLVE phase validation (all 6 phases required)
- Gate validation (assertion, research, file_exists, registration)
- Rollback configuration validation
- Iron laws checking in metadata
- Duplicate step ID detection
- Exports: `WorkflowValidator`, `validateEvolvePhases`, `EVOLVE_PHASES`

### Integration Tests

- Full workflow execution end-to-end
- Cross-workflow triggering
- Checkpoint and resume
- Rollback scenarios (saga coordinator)
- System registration
- Evolution state sync
- Error handling and recovery
- Workflow validation integration

**Test Coverage Summary**:

- CLI tests: 26 passed
- Validator tests: 19 passed
- Integration tests: 24 passed
- **Total: 69 tests, all passing**

**Bug Fix Applied**: Checkpoint test used incompatible checkpoint managers. `WorkflowEngine.checkpoint()` saves to plain JSON files, while `CheckpointManager` expects gzipped files with different structure. Fixed by using consistent `WorkflowEngine.checkpoint()/resume()` methods in the test.

**CLI Commands**:

```bash
# Run all tests
node .claude/scripts/run-workflow-tests.cjs

# Run specific suite
node .claude/scripts/run-workflow-tests.cjs --cli
node .claude/scripts/run-workflow-tests.cjs --validator
node .claude/scripts/run-workflow-tests.cjs --integration

# Show help
node .claude/scripts/run-workflow-tests.cjs --help
```

**Executable Workflow Ecosystem Complete**:

- Core engine: `workflow-engine.cjs` (55 tests)
- Checkpoint manager: `checkpoint-manager.cjs`
- Saga coordinator: `saga-coordinator.cjs`
- Step validators: `step-validators.cjs`
- Cross-workflow trigger: `cross-workflow-trigger.cjs` (14 tests)
- System registration: `system-registration-handler.cjs` (13 tests)
- Evolution state sync: `evolution-state-sync.cjs` (22 tests)
- CLI: `workflow-cli.cjs` (26 tests)
- Validator: `workflow-validator.cjs` (19 tests)
- Integration tests: `workflow-integration.test.cjs` (24 tests)
- Creator workflows: 6 YAML files in `.claude/workflows/creators/`
- Updater workflows: 6 YAML files in `.claude/workflows/updaters/`

---

## [2026-01-25] Scientific-Skills Router Registration Completed

**Problem**: Scientific-skills (139 sub-skills) were in skill-catalog but NOT detectable by router-enforcer.cjs.

**Root Cause**: Missing `scientific` intent in:

1. `intentKeywords` object (keyword arrays)
2. `INTENT_TO_AGENT` mapping
3. `domainBoosts` for python-pro

**Fix Applied**:

1. **Added scientific intent keywords** (40+ keywords):
   - Core: scientific, science, research, laboratory, lab
   - Chemistry: chemistry, chemical, molecule, compound, rdkit, cheminformatics
   - Biology: biology, bioinformatics, genomics, gene, protein, dna, rna
   - Tools: scanpy, biopython, chembl, uniprot, pubchem
   - Medical: drug discovery, pharma, clinical, medical, clinical trials
   - Analysis: statistics, visualization, matplotlib, seaborn, plotly

2. **Added INTENT_TO_AGENT mapping**:

   ```javascript
   scientific: 'python-pro',
   ```

3. **Enhanced python-pro domainBoosts** with scientific keywords for high-confidence routing.

**Files Modified**:

- `.claude/hooks/routing/router-enforcer.cjs`

**Verification**:

- Syntax check: PASSED
- Keyword presence: CONFIRMED
- Mapping presence: CONFIRMED
- Domain boosts: CONFIRMED

**Router Detection Examples** (now working):

- "analyze this RNA-seq data" -> scientific intent -> python-pro + scientific-skills
- "review the chemistry literature" -> scientific intent
- "use rdkit to compute molecular properties" -> scientific intent

---

## [2026-01-25] Agent-Skill Discovery Gap Remediation

**Problem**: 85% of agents (34/40) had NO skill guidance whatsoever. Agents could not discover or use skills effectively, leading to underutilization of the skill ecosystem.

**Solution Architecture** (5 Phases):

### Phase 1: Agent-Skill Matrix (Centralized Discovery)

- Created `.claude/context/config/agent-skill-matrix.json`
- Maps all 45 agents to their skills (primary, secondary, contextual)
- Single source of truth for agent-to-skill relationships
- Agents can query matrix to discover relevant skills

**Pattern**: Central matrix pattern for M:N mappings

```json
{
  "agents": {
    "developer": {
      "primary_skills": ["tdd", "debugging", "git-expert"],
      "secondary_skills": ["code-analyzer", "test-generator"],
      "contextual_skills": { "security_changes": ["security-architect"] }
    }
  }
}
```

### Phase 2: Skill Invocation Protocol Template

- Created `.claude/templates/agent-skill-invocation-section.md`
- Standardized template embedded in ALL 45 agent definitions
- Includes examples, contextual triggers, and lookup guidance
- Prevents inconsistent skill guidance across agents

**Pattern**: Template injection for consistent documentation

```markdown
## Skill Invocation Protocol

### Primary Skills (Always Load)

- Skill({ skill: "tdd" }) - Test-driven development
  ...

### Contextual Skills (Load When Relevant)

| Trigger          | Skill              | Reason             |
| ---------------- | ------------------ | ------------------ |
| Security changes | security-architect | Review auth/crypto |
```

### Phase 3: Skill Consolidation with Aliases

- Merged testing-expert -> tdd (alias added)
- Merged writing -> writing-skills (alias added)
- Added cross-references between 6 related skill pairs

**Pattern**: Alias-based deprecation preserves backward compatibility

```markdown
**Aliases**: `testing-expert` (deprecated, use this skill)
```

### Phase 4: New Domain Agents (via EVOLVE)

- scientific-research-expert (139 scientific sub-skills)
- ai-ml-specialist (ML/AI frameworks)
- android-pro (native Android, parity with ios-pro)
- gamedev-pro (Unity/Unreal/Godot)
- web3-blockchain-expert (Solidity/DeFi)

### Phase 5: Validation

- 45/45 agents validated for skill protocol presence
- 204/204 validation tests passed
- All registries updated (CLAUDE.md, router-enforcer.cjs, skill-catalog.md)

**Key Learnings**:

1. **Discoverability gap is invisible**: Agents worked but underperformed silently
2. **Central matrix enables programmatic lookup**: Better than scattered documentation
3. **Templates ensure consistency**: All 45 agents now have identical skill guidance structure
4. **Aliases prevent breaking changes**: Deprecate via alias, not deletion

---

## [2026-01-25] GameDev-Pro Agent Created via EVOLVE Workflow

**Agent Created**: `gamedev-pro` at `.claude/agents/domain/gamedev-pro.md`

**Purpose**: Multi-engine game development expert for Unity, Unreal Engine, and Godot with expertise in ECS architecture, game loops, shaders, physics, game AI, and cross-platform optimization.

**EVOLVE Phases Completed**:

- **EVALUATE**: Confirmed need - existing `gamedev-expert` skill only covers DragonRuby patterns
- **VALIDATE**: No naming conflicts, follows kebab-case convention
- **OBTAIN**: 3 Exa queries executed, 7+ sources consulted
- **LOCK**: Agent created with 378 lines, 12 capability subsections
- **VERIFY**: All 7 assigned skills verified to exist
- **ENABLE**: Routing table and router-enforcer.cjs updated

**Skills Assigned**:

- task-management-protocol, tdd, debugging, git-expert, verification-before-completion, gamedev-expert, cpp

**Registrations**:

- CLAUDE.md routing table: `| Game development | gamedev-pro | .claude/agents/domain/gamedev-pro.md |`
- router-enforcer.cjs: `INTENT_TO_AGENT.gamedev = 'gamedev-pro'`
- router-enforcer.cjs: `domainBoosts['gamedev-pro']` with 30+ keywords

**Research Report**: `.claude/context/artifacts/research-reports/gamedev-pro-research.md`

**Domains Covered**: Unity (C#), Unreal Engine 5 (C++/Blueprints), Godot 4 (GDScript/C#), ECS, Game Physics, Shaders (HLSL/GLSL), Game AI (Behavior Trees, FSM, GOAP), Cross-platform

**Routing Keywords Added**:

- game, game development, gamedev, game engine, unity, unreal, godot
- ecs, entity component system, game loop, game physics, shader
- sprite, collision, physics engine, multiplayer, netcode
- game ai, pathfinding, behavior tree, game state, level design
- procedural generation, fps, frame rate, gpu, rendering

---

## [2026-01-25] Agent-Creator Skill v2.1.0 - Template Gap Prevention

**Problem**: Audit found 52 gaps across 5 newly created agents - missing Response Approach, Behavioral Traits, Example Interactions sections.

**Root Cause**: Agent-creator template lacked these sections and had no validation requiring them.

**Fix Applied to `.claude/skills/agent-creator/SKILL.md`**:

1. **Added to Template (Step 5)**:
   - Response Approach section with 8 numbered steps
   - Behavioral Traits section with 10+ placeholder traits
   - Example Interactions section with 8+ placeholder examples

2. **Added Validation Rules (Step 6)**:
   - Model Validation: base name only (haiku/sonnet/opus), NO dated versions
   - Extended Thinking warning: NOT standard, requires justification
   - MCP Tools warning: causes router enforcement failures

3. **Added Reference Agent Section**:
   - python-pro.md designated as canonical reference
   - Comparison checklist before finalizing any agent

4. **Added Iron Law #10**:

   ```
   10. NO AGENT WITHOUT RESPONSE APPROACH
       - Every agent MUST have Response Approach section with 8 numbered steps
       - Every agent MUST have Behavioral Traits section with 10+ domain-specific traits
       - Every agent MUST have Example Interactions section with 8+ examples
       - Without these sections, execution strategy is undefined
       - Reference python-pro.md for canonical structure
   ```

5. **Updated Completion Checklist** with new requirements

**Version**: Bumped to 2.1.0

**Pattern**: Template-based enforcement prevents systematic gaps. Reference agent ensures consistency.

---

## [2026-01-25] Self-Healing System Security Review Completed

**Security Review Report**: `.claude/context/artifacts/reports/security-review-self-healing.md`

**Key Security Patterns Identified**:

### 1. Immutable Security Core Pattern
When implementing self-modifying systems, define a set of PROTECTED_PATHS that cannot be modified without explicit human approval:
- Security hooks (`.claude/hooks/safety/*`)
- State management files (`router-state.cjs`)
- Enforcement hooks (`task-create-guard.cjs`, `router-write-guard.cjs`)
- Core instructions (CLAUDE.md Sections 1.1-1.3, 6)

**Implementation**: Use a PreToolUse hook that blocks Edit/Write to protected paths unless a one-time environment token is provided.

### 2. Circuit Breaker Pattern for Self-Healing
Prevent runaway self-healing loops with:
- **Failure threshold**: 5 consecutive failures triggers OPEN state
- **Hourly limit**: Max 10 self-heal attempts per hour
- **Cooldown period**: 30 minutes before retry allowed
- **State machine**: CLOSED -> OPEN -> HALF-OPEN -> (test) -> CLOSED/OPEN

**State File**: `.claude/context/runtime/self-healing-state.json`

### 3. Tamper-Evident Audit Trail Pattern
For self-modifying systems, use append-only logs with integrity chains:
- Each entry includes SHA-256 hash of previous entry
- Verify chain integrity on session start
- Use JSONL format for easy parsing
- Archive after 1000 entries

**Log Location**: `.claude/context/audit/self-modification-log.jsonl`

### 4. Reflection Agent Sandbox Pattern
Reflection/metacognition agents should have constrained capabilities:
- **ALLOWED**: Read, analyze, propose, update memory files
- **PROHIBITED**: Direct modification of hooks, CLAUDE.md, router state
- Proposals must go through EVOLVE workflow with human gates

### 5. Human-in-the-Loop Gate Pattern
Critical operations require mandatory human approval:
- Elevated permissions (Bash, Edit, Write tools in agents)
- Hook modifications
- CLAUDE.md routing changes
- Self-healing after repeated failures

**Timeout**: 5 minutes (abort if no response)

### Risk Assessment Findings

| Risk Category | Highest Risk | Recommended Control |
|---------------|--------------|---------------------|
| Self-modification | Security hook tampering | Protected paths guard |
| Infinite loops | Runaway self-healing | Circuit breaker |
| Privilege escalation | Agent with elevated perms | Human approval gates |
| Data integrity | Audit log tampering | Integrity chain |
| Bypass attempts | Reflection disabling guards | Sandbox constraints |

**ADR**: ADR-016 in `.claude/context/memory/decisions.md`

---

## [2026-01-25] Reflection Trigger Hooks Created

**Files Created**:

- `.claude/hooks/reflection/task-completion-reflection.cjs` - PostToolUse(TaskUpdate) when status=completed

