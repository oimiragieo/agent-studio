# Archived Learnings - 2026-01-26

Archived by semantic-archival (importance-based preservation)

---

## [UNKNOWN] Untitled

**Importance**: LOW
**Archived**: 2026-01-26

_Last updated: 2026-01-26_
_Archived content: `.claude/context/memory/archive/learnings-archive-2026-01.md`_

---

## [NOTE] Framework Deep Dive Complete

**Date**: 2026-01-26
**Importance**: LOW
**Archived**: 2026-01-26

**7-Phase Deep Dive Summary**:

A comprehensive 7-phase deep dive of the .claude framework infrastructure was completed, covering security, code quality, architecture, performance, and process maturity.

**Phases Completed**:

1. **Security Deep Dive** (Task #5) - 10/11 SEC-AUDIT issues fixed (91%)
2. **Hook Code Quality Audit** (Task #3) - 80 hooks reviewed, 95% security compliant
3. **Library Code Quality Audit** (Task #2) - 3 CRITICAL, 8 IMPORTANT issues identified
4. **Pointer Gap Analysis** (Task #4) - ARCH-001 resolved, 1 deprecated reference
5. **Performance Optimization** (Task #6) - 9 PERF findings, 60-90% improvement potential
6. **Process Enhancement** (Task #7) - 10 PROC findings for workflow improvements
7. **Final Consolidation** (Task #8) - FRAMEWORK-DEEP-DIVE-REPORT.md created

**Key Statistics**:

- **Total Findings**: 87
- **Resolved**: 37 (43%)
- **Open**: 50 (57%)
- **Framework Health Score**: 78/100

**Top Risks Identified**:

1. Performance bottleneck (80 hooks, 500-1000ms overhead)
2. Code duplication (~2300 lines across 40+ files)
3. Incomplete security automation

**Top Strengths Confirmed**:

1. Security hardening (91% SEC-AUDIT resolved)
2. Comprehensive agent coverage (46 agents, 85+ skills)
3. Self-evolution system (EVOLVE workflow)

**Recommended Priority Actions**:

1. Create hook-input.cjs shared utility (PERF-006)
2. Integrate state-cache for evolution hooks (PERF-004)
3. Consolidate routing guard hooks (PERF-001)
4. Implement automated security triggers (PROC-003)

**Full Report**: `.claude/context/artifacts/FRAMEWORK-DEEP-DIVE-REPORT.md`

---

## [PATTERN] Hook Pattern

**Importance**: MEDIUM
**Archived**: 2026-01-26

- `.claude/hooks/reflection/task-completion-reflection.test.cjs` - 15 tests
- `.claude/hooks/reflection/error-recovery-reflection.cjs` - PostToolUse after errors (Bash exit!=0, tool errors)
- `.claude/hooks/reflection/error-recovery-reflection.test.cjs` - 14 tests
- `.claude/hooks/reflection/session-end-reflection.cjs` - SessionEnd event (Stop, SessionEnd)
- `.claude/hooks/reflection/session-end-reflection.test.cjs` - 15 tests

**Key Features**:

All hooks follow a consistent pattern:

- `isEnabled()` - Check REFLECTION_ENABLED and REFLECTION_HOOK_MODE env vars
- `shouldTriggerReflection(input)` - Check if hook should fire for this input
- `createReflectionEntry(input)` - Create queue entry from hook context
- `queueReflection(entry, queueFile)` - Write to JSONL queue file

**File**: `.claude/context/reflection-queue.jsonl` (append-only JSONL)

```jsonl
{"taskId":"42","trigger":"task_completion","timestamp":"...","priority":"high"}
{"context":"error_recovery","trigger":"error","tool":"Bash","error":"...","priority":"medium"}
{"context":"session_end","trigger":"session_end","sessionId":"...","priority":"low"}
```

| Variable             | Default | Description                      |
| -------------------- | ------- | -------------------------------- |
| REFLECTION_ENABLED   | true    | Master switch for all reflection |
| REFLECTION_HOOK_MODE | block   | Hook mode: block/warn/off        |

| Hook                       | Trigger                      | Priority | Purpose                      |
| -------------------------- | ---------------------------- | -------- | ---------------------------- |
| task-completion-reflection | TaskUpdate(status=completed) | high     | Queue completed tasks        |
| error-recovery-reflection  | Bash exit!=0 or tool error   | medium   | Queue errors for analysis    |
| session-end-reflection     | Stop/SessionEnd event        | low      | Batch reflection for session |

**Test Coverage**: 44 tests total, all passing

**Pattern Learned**: Hook modules should export a QUEUE_FILE property that can be overridden for testing. Using getter/setter syntax allows test files to redirect queue writes to test-specific files.

**Pattern Learned**: Hooks that write to project directories MUST use `findProjectRoot()` instead of `process.cwd()`.

**Root Cause**: When CWD differs from project root (e.g., agent running from different directory), using `process.cwd()` as the base path creates nested `.claude` folders in wrong locations.

**Fix Pattern**:

```javascript
function findProjectRoot() {
  let dir = __dirname;
  while (dir !== path.parse(dir).root) {
    if (fs.existsSync(path.join(dir, '.claude', 'CLAUDE.md'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return process.cwd();
}

const PROJECT_ROOT = findProjectRoot();
// Then pass PROJECT_ROOT to all path-dependent functions
```

**Files Fixed**:

- `.claude/hooks/memory/session-memory-extractor.cjs` - Now passes PROJECT_ROOT to memory manager calls
- `.claude/lib/utils/project-root.cjs` - Shared utility (BUG-001 fix)
- `.claude/lib/memory/memory-manager.cjs` - 11 function defaults fixed
- `.claude/lib/memory/memory-scheduler.cjs` - 9 function defaults fixed
- `.claude/lib/memory/memory-tiers.cjs` - 11 function defaults fixed
- `.claude/lib/memory/memory-dashboard.cjs` - 7 function defaults fixed

**Total**: 38 `process.cwd()` defaults replaced with `PROJECT_ROOT`

**Pattern Learned**: To enforce the EVOLVE workflow for new artifact creation, add checks to `file-placement-guard.cjs` that:

1. Read evolution state from `.claude/context/evolution-state.json`
2. Detect if the write operation is creating a NEW artifact (vs editing existing)
3. Block creation if state is not in a creation-allowed phase (lock/verify/enable)

**Key Components**:

- `ARTIFACT_DIRECTORIES` - Array of paths requiring EVOLVE (`agents/`, `skills/`, `hooks/`, etc.)
- `CREATION_ALLOWED_STATES` - States where artifact creation is permitted (`lock`, `verify`, `enable`)
- `getEvolutionState(projectRoot)` - Reads evolution state, defaults to `{state: 'idle'}`
- `isNewArtifactCreation(filePath, projectRoot)` - Checks if file is new AND in artifact dir
- `checkEvolveEnforcement(filePath, projectRoot)` - Returns `{blocked: true/false, reason?, suggestion?}`

**Exemptions**:

- Test files (`.test.`, `.spec.`) are always exempt from EVOLVE enforcement
- Edits to existing files are always allowed
- Files outside artifact directories are always allowed
- Override with `EVOLVE_ENFORCEMENT_OVERRIDE=true`

**Test Coverage**: 33 tests in `.claude/hooks/safety/file-placement-guard.test.cjs`

---

## [2026-01-26] Auto-Extracted: Test Workflow Run

**Date**: 2026-01-26
**Importance**: MEDIUM
**Archived**: 2026-01-26

**Pattern Learned**: Hook execution overhead is the primary performance bottleneck in the .claude framework.

**Key Findings**:

1. **Hook Execution Overhead**
   - 73 hook files exist, 34 hooks registered in settings.json
   - Each Edit/Write triggers 8 PreToolUse + 3 PostToolUse hooks = 11 process spawns
   - Estimated 500-1000ms overhead per Edit/Write operation

2. **State File I/O Anti-pattern**
   - `router-state.json` is read by 5+ hooks independently
   - Each hook spawns a new Node process, re-reads state, re-parses JSON
   - Results in 10-15 redundant fs.existsSync() and fs.readFileSync() calls per Edit/Write

3. **No Caching Layer**
   - Every hook re-reads state files independently
   - No TTL-based caching for frequently accessed state
   - No shared memory between hooks (separate processes)

**Optimization Opportunities**:

| Priority | Optimization             | Expected Impact          |
| -------- | ------------------------ | ------------------------ |
| CRITICAL | State file caching (TTL) | 60% I/O reduction        |
| CRITICAL | Hook consolidation       | 40% fewer process spawns |
| HIGH     | Shared parseHookInput()  | Code deduplication       |
| HIGH     | Batch memory writes      | 25% reduction            |

**Quick Win Pattern**: Create `.claude/lib/utils/state-cache.cjs` with 1-second TTL cache.

**Hook Consolidation Strategy**:

- Combine router-write-guard, router-self-check, file-placement-guard into single `edit-write-guard.cjs`
- Combine evolution hooks into single `evolution-guard.cjs`
- Reduces Edit/Write hooks from 8 to 3

**Full Report**: `.claude/context/artifacts/performance-analysis-2026-01-26.md`

**Pattern Learned**: Node.js native test runner file discovery uses glob patterns that must match actual file locations.

**Common Issues**:

1. Flat patterns like `*.test.mjs` don't find tests in subdirectories
2. Need recursive globs: `**/*.test.mjs`
3. On Windows, glob patterns should be quoted: `".claude/tools/**/*.test.mjs"`

**Test Runner Compatibility**:

- `.test.cjs` - Use Node.js native `node --test` (CommonJS)
- `.test.mjs` - Use Node.js native `node --test` (ESM)
- `.test.js` - May use Jest (check imports for `@jest/globals`)

**Gotcha**: Don't mix Jest test files with Node native test runner - they use different syntax:

- Jest: `describe()`, `it()`, `expect()`, `jest.fn()`
- Node: `describe()`, `test()`, `assert.equal()`, `mock.fn()`

**Best Practice for package.json**:

```json
{
  "test:framework": "node --test --test-concurrency=1 .claude/hooks/**/*.test.cjs .claude/lib/**/*.test.cjs",
  "test:tools": "node --test --test-concurrency=1 \".claude/tools/**/*.test.mjs\" \".claude/tools/**/*.test.cjs\""
}
```

**Test Count Verification Command**:

```bash
find .claude -name "*.test.cjs" -o -name "*.test.mjs" | wc -l
```

- Always validate input before processing.
- Use early returns for error handling.

**Pattern Learned**: When blocking artifact creation due to EVOLVE enforcement, output structured JSON trigger data that enables automatic spawning of the evolution-orchestrator.

**Key Components**:

1. **buildEvolveTriggerData(filePath, projectRoot)** - Builds structured JSON with:
   - `blocked: true` - Indicates the operation was blocked
   - `artifact: { type, path, directory, name }` - Detected artifact info
   - `evolve: { autoStart, currentState, circuitBreaker }` - Evolution context
   - `spawnInstructions` - Ready-to-use Task() call (when autoStart enabled)

2. **checkCircuitBreaker(projectRoot)** - Rate limiting:
   - Default: 3 evolutions per hour
   - Configurable via `EVOLVE_RATE_LIMIT` env var
   - Counts evolutions with `completedAt` in last hour from `evolution-state.json`
   - Returns `{ allowed, remaining, recentCount }`

3. **generateSpawnInstructions(triggerData)** - Generates Task() call:
   - Only returns instructions if `autoStart=true` AND `circuitBreaker.allowed=true`
   - Includes artifact type and name in prompt

**Environment Variables**:

| Variable          | Default | Description                   |
| ----------------- | ------- | ----------------------------- |
| EVOLVE_AUTO_START | false   | Enable auto-spawn on blocking |
| EVOLVE_RATE_LIMIT | 3       | Max evolutions per hour       |

**Security Considerations**:

- Gated behind explicit opt-in (EVOLVE_AUTO_START=true)
- Circuit breaker prevents runaway evolution
- Test files exempt from EVOLVE enforcement
- Audit trail maintained in evolution-state.json evolutions array

**Usage Example** (output when blocking):

```json
{
  "blocked": true,
  "reason": "EVOLVE REQUIRED: Cannot create new artifact...",
  "artifact": {
    "type": "agent",
    "path": ".claude/agents/domain/new-agent.md",
    "directory": ".claude/agents/domain/",
    "name": "new-agent"
  },
  "evolve": {
    "autoStart": true,
    "currentState": "idle",
    "circuitBreaker": { "allowed": true, "remaining": 3, "recentCount": 0 }
  },
  "spawnInstructions": "Task({ subagent_type: 'evolution-orchestrator', ... })"
}
```

**Test Coverage**: 62 tests in `.claude/hooks/safety/file-placement-guard.test.cjs`

---

## [PATTERN] Documentation Audit Pattern

**Date**: 2026-01-26
**Importance**: MEDIUM
**Archived**: 2026-01-26

**Pattern Learned**: Documentation audits should categorize files by purpose (getting started, reference, guide, architecture) and identify duplication, gaps, and quality issues.

**Audit Categories**:

1. **GETTING_STARTED** - User onboarding content
2. **REFERENCE** - API references, catalogs, technical specs
3. **GUIDE** - How-to guides, workflows, tutorials
4. **ARCHITECTURE** - Technical architecture, system design
5. **SPECIALIZED** - Domain-specific or advanced topics
6. **META** - Changelogs, migration guides, release notes

**Key Metrics**:

- File count by category
- Content duplication percentage
- Missing critical documentation
- Outdated file references
- Cross-reference completeness

**Audit Deliverables**:

- File categorization table with recommendations (KEEP/MERGE/DELETE/CREATE)
- Proposed structure with reduced file count
- Missing documentation identified by priority
- Implementation plan with phases and effort estimates

**Example**: Documentation audit of `.claude/docs/` identified:

- 24 files with ~30% duplication
- 5 merge operations to eliminate redundancy
- 3 high-priority missing docs
- Recommended target: 16-20 well-organized files

**Output Location**: `.claude/context/artifacts/reports/docs-audit-report.md`

**Tools Used**:

- `Glob` to enumerate files
- `Read` to analyze content and structure
- Manual categorization by content type
- Overlap analysis for duplication detection

**Next Steps After Audit**:

1. Execute merge operations (Phase 1)
2. Create missing documentation (Phase 2)
3. Fix quality issues - paths, terminology, formatting (Phase 3)
4. Polish and add missing features (Phase 4)

**Pattern Learned**: Documentation consolidation should follow Divio 4-quadrant system (Tutorials, How-to Guides, Reference, Explanation) with priority on:

1. **30-second hook** at document start (blockquote format recommended)
2. **Scannable structure** (bullet lists, tables, short paragraphs)
3. **Single source of truth** (eliminate duplication, consolidate overlapping docs)
4. **Progressive disclosure** (80% case first, advanced content later)

**Phase 1 Execution** (2026-01-26):

**Files Created**:

1. `.claude/docs/CONFIGURATION.md` - Centralized env var catalog
   - 20+ environment variables documented
   - Configuration profiles (Production, Development, Rapid Prototyping, Emergency)
   - Organized by category (Router, EVOLVE, Hooks, Memory, Safety, Performance)

**Files Updated**:

1. `.claude/docs/SELF_EVOLUTION.md` - Added EVOLVE_AUTO_START documentation
   - Section 9: EVOLVE Auto-Start (Opt-Out Mode)
   - Circuit breaker rate limiting (default: 3/hour)
   - Security protections (sensitive paths, spawn depth, path sanitization, fail-closed)
   - Version 1.0.0 → 1.1.0

2. `.claude/docs/GETTING_STARTED.md` - Improved scanability
   - Added 30-second hook (blockquote: "What is Agent Studio?")
   - Overview section with bullet points
   - Expanded EVOLVE workflow section with visual
   - Cross-references to SELF_EVOLUTION.md and CONFIGURATION.md

**Phase 2 Roadmap**:

- Merge router docs (3 → 1): ROUTER_PROTOCOL + ROUTER_ENFORCEMENT + ROUTER_KEYWORD_GUIDE → ROUTER_GUIDE.md
- Merge hooks docs (2 → 1): HOOKS_AND_SAFETY + HOOKS_REFERENCE → HOOKS_GUIDE.md
- Delete memory/ subfolder (content fully covered in MEMORY_SYSTEM.md)
- Review USER_GUIDE.md for merge/archive
- Target: 16-18 files (from 24), <10% duplication

**Key Takeaway**: Configuration documentation should be centralized early. Env vars scattered across docs create discoverability problems.

---

## [DOCUMENTATION] Documentation Best Practices

**Date**: 2026-01-26
**Importance**: MEDIUM
**Archived**: 2026-01-26

**Pattern Learned**: Applied Divio 4-quadrant documentation system to reduce cognitive overload.

**Key Principles**:

1. **Divio 4-Quadrant System**
   - Tutorials: Learning-oriented (help newcomers)
   - How-to Guides: Problem-oriented (solve specific tasks)
   - Reference: Information-oriented (API, config)
   - Explanation: Understanding-oriented (background, why)

2. **Progressive Disclosure**
   - Lead with 80% case
   - Hide edge cases in expandable sections
   - README first paragraph must hook in 30 seconds

3. **ARID Principle**
   - Avoid Repetition In Documentation
   - Single source of truth per topic
   - Cross-reference instead of duplicating

4. **Scanability**
   - Headers, bullets, tables, code blocks
   - Max 3-5 sentences per paragraph
   - Bold key terms

**Results**:

- Reduced `.claude/docs/` from 25 files to 15 files
- Eliminated ~40% duplication
- Created centralized CONFIGURATION.md for all env vars
- Documented EVOLVE_AUTO_START in SELF_EVOLUTION.md

**Essential Files (Keep)**:

- GETTING_STARTED.md (Quick start)
- USER_GUIDE.md (Complete guide)
- CONFIGURATION.md (All settings)
- ARCHITECTURE.md (System design)
- AGENTS.md, SKILLS.md, HOOKS_REFERENCE.md (References)

**Anti-patterns Avoided**:

- Wall-of-text syndrome
- Over-documentation (25 → 15 files)
- Copy-paste duplication (merged duplicates)
- Hidden/undiscoverable docs (centralized config)

---
