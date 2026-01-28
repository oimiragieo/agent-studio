# Production Hardening Plan: Phase 1B

**Date**: 2026-01-28
**Version**: 1.0.0
**Duration**: 5 days (estimated)
**Goal**: Production-ready foundation for Party Mode implementation

---

## Executive Summary

Phase 1A delivered 3 production-ready features with 42 passing unit tests. However, gaps remain in production readiness:

- **No integration tests** - Only unit tests, no orchestrator-level validation
- **No staging environment** - Testing on development only
- **No monitoring** - No metrics, observability, or alerting
- **Performance unknowns** - No profiling or benchmarks established
- **Missing hook registration** - Index invalidation hook designed but not active

This plan addresses these gaps through 5 production hardening tasks spanning integration testing, end-to-end validation, monitoring infrastructure, performance optimization, and staging environment setup.

**Success Criteria**:
- 10+ integration tests passing
- 5+ E2E tests passing
- Monitoring dashboard functional
- Performance baselines documented
- Staging environment operational
- Zero regressions in existing tests (42)
- All Phase 1A features validated in staging

---

## Background Context

### What We Built (Phase 1A)

1. **Knowledge Base Indexing** - 1,133 artifacts indexed, <50ms search
2. **Cost Tracking Hook** - Hash-chain integrity, <2ms overhead
3. **Advanced Elicitation** - 15 meta-cognitive methods, +30% quality

### What's Missing

| Gap | Risk | Impact on Party Mode |
|-----|------|---------------------|
| No integration tests | MEDIUM-HIGH | Multi-agent coordination untested |
| No monitoring | MEDIUM | Cannot detect performance degradation |
| No performance baselines | MEDIUM | Unknown scalability limits |
| No staging environment | HIGH | Cannot validate before production |
| Index invalidation hook | LOW | Stale KB index after skill changes |

### Risks Without Hardening

- **Party Mode complexity** (42 hours, 6 CRITICAL security controls) deployed on untested infrastructure
- **Context isolation architecture** untested at orchestrator level
- **No production deployment validation** - Cannot verify features work in production-like environment

---

## Task Breakdown

---

## Task #16: Integration Tests for Orchestrators

**Owner**: QA agent
**Duration**: 3 days (24 hours)
**Dependencies**: None
**Priority**: P1 (CRITICAL for Party Mode)

### Overview

Test multi-agent coordination at system level. Current unit tests validate individual components, but orchestrators (master-orchestrator, swarm-coordinator, evolution-orchestrator) coordinate multiple agents and require integration testing.

### Problem Statement

- **Current**: 42 unit tests for Phase 1A features
- **Missing**: No tests for orchestrator-level coordination
- **Risk**: Party Mode orchestrator untested before deployment
- **Impact**: Cannot verify multi-agent workflows function correctly

### Test Scenarios (Minimum 10 Required)

#### 1. master-orchestrator spawns 3 agents in parallel
**Given**: User request requires architect, developer, qa
**When**: master-orchestrator receives request
**Then**: 3 agents spawn with proper task IDs, all complete, TaskList shows success

**Test Setup**:
```javascript
// Mock Task tool to capture spawned agents
const spawnedAgents = [];
const mockTask = (config) => {
  spawnedAgents.push(config);
  return { taskId: `task-${spawnedAgents.length}` };
};

// Run orchestrator with mocked Task
const result = await masterOrchestrator({
  request: "Design and implement user authentication",
  taskTool: mockTask
});

// Verify 3 agents spawned
assert.equal(spawnedAgents.length, 3);
assert.equal(spawnedAgents[0].subagent_type, 'architect');
assert.equal(spawnedAgents[1].subagent_type, 'developer');
assert.equal(spawnedAgents[2].subagent_type, 'qa');
```

#### 2. swarm-coordinator distributes work to worker agents
**Given**: Large task requiring parallelization
**When**: swarm-coordinator receives task
**Then**: Work split across N workers, all complete, results aggregated

**Test Setup**:
- Mock 5-file codebase refactoring task
- Verify swarm-coordinator spawns 5 workers (1 per file)
- Verify each worker receives unique file
- Verify aggregation of results

#### 3. evolution-orchestrator executes EVOLVE workflow
**Given**: Request to create new skill (requires research → creation)
**When**: evolution-orchestrator invoked
**Then**: Phase transitions E→V→O→L→V→E, all checkpoints pass

**Test Setup**:
- Mock research-synthesis skill (returns 3 sources)
- Mock skill-creator skill (creates artifact)
- Verify state transitions in evolution-state.json
- Verify artifact created at expected path

#### 4. Orchestrator error handling (agent failure)
**Given**: Orchestrator spawns 3 agents, Agent 2 fails
**When**: Agent 2 returns error
**Then**: Orchestrator detects failure, logs error, continues with Agents 1 and 3

**Test Setup**:
```javascript
// Mock Agent 2 failure
const mockTask = (config) => {
  if (config.subagent_type === 'developer') {
    throw new Error('Agent 2 failed: syntax error');
  }
  return { taskId: `task-${Math.random()}` };
};

// Verify orchestrator handles gracefully
const result = await masterOrchestrator({ taskTool: mockTask });
assert.equal(result.errors.length, 1);
assert.equal(result.completedAgents, 2); // Agents 1 and 3
```

#### 5. Orchestrator timeout handling
**Given**: Agent exceeds 10-minute timeout
**When**: Agent does not complete
**Then**: Orchestrator terminates agent, logs timeout, continues

**Test Setup**:
- Mock slow agent (never completes)
- Verify timeout after 10 minutes
- Verify TaskUpdate({ status: 'timeout' })

#### 6. Task dependency resolution across agents
**Given**: Task B depends on Task A (addBlockedBy: ['A'])
**When**: Orchestrator schedules tasks
**Then**: Task A completes before Task B starts

**Test Setup**:
```javascript
TaskCreate({ subject: 'Task A', taskId: 'A' });
TaskCreate({ subject: 'Task B', taskId: 'B' });
TaskUpdate({ taskId: 'B', addBlockedBy: ['A'] });

// Verify Task B does not start until Task A completes
const taskList = await TaskList();
assert.equal(taskList.find(t => t.id === 'B').status, 'pending');

await TaskUpdate({ taskId: 'A', status: 'completed' });
// Now Task B can start
```

#### 7. Context sharing between coordinated agents
**Given**: Agent 2 needs Agent 1's output
**When**: Orchestrator passes context
**Then**: Agent 2 receives Agent 1's response in prompt

**Test Setup**:
- Agent 1 outputs: "Database schema designed"
- Verify Agent 2 prompt includes: "Agent 1 said: Database schema designed"

#### 8. Orchestrator with blocking dependencies
**Given**: 3 tasks with chain dependency (A → B → C)
**When**: Orchestrator schedules tasks
**Then**: Sequential execution in correct order

**Test Setup**:
```javascript
// A → B → C chain
TaskCreate({ taskId: 'A' });
TaskCreate({ taskId: 'B' });
TaskUpdate({ taskId: 'B', addBlockedBy: ['A'] });
TaskCreate({ taskId: 'C' });
TaskUpdate({ taskId: 'C', addBlockedBy: ['B'] });

// Verify execution order
const executionOrder = [];
// Mock TaskUpdate to track completion order
// Assert: executionOrder === ['A', 'B', 'C']
```

#### 9. Concurrent orchestrator execution
**Given**: 2 orchestrators running simultaneously
**When**: Both create tasks
**Then**: No task ID collisions, both complete successfully

**Test Setup**:
- Spawn orchestrator 1 (creates tasks T1, T2, T3)
- Spawn orchestrator 2 (creates tasks T4, T5, T6)
- Verify 6 unique task IDs
- Verify no interference between orchestrators

#### 10. Orchestrator rollback on failure
**Given**: Multi-step workflow, step 3 fails
**When**: Orchestrator detects failure
**Then**: Rollback steps 2 and 1 in reverse order

**Test Setup**:
```javascript
// 3-step workflow: CreateSchema → SeedData → VerifyData
// Mock SeedData failure
// Verify rollback:
// 1. DropData (no-op, nothing seeded)
// 2. DropSchema (reverses CreateSchema)
```

### Test Structure

**Location**: `.claude/agents/orchestrators/__tests__/integration/`

**File Organization**:
```
__tests__/
  integration/
    master-orchestrator.test.cjs
    swarm-coordinator.test.cjs
    evolution-orchestrator.test.cjs
    error-handling.test.cjs
    dependency-resolution.test.cjs
```

**Test Framework**: Node.js native test API (existing pattern from Phase 1A)

**Mock Strategy**:
- Mock `Task` tool to capture spawned agents (no actual agent execution)
- Mock `TaskList`, `TaskUpdate`, `TaskGet` to simulate task system
- Mock agent responses (predefined outputs)

**Assertions**:
- Task state transitions (pending → in_progress → completed)
- Agent spawn parameters (subagent_type, allowed_tools, prompt)
- Context passed between agents
- Error handling paths
- Timeout enforcement

### Implementation Steps

1. **Setup test infrastructure** (~4 hours)
   - Create test directory structure
   - Implement mock Task tool
   - Implement mock TaskList/TaskUpdate/TaskGet
   - Create test fixtures (sample requests)

2. **Implement 10 integration tests** (~16 hours)
   - 3 orchestrator-specific tests (master, swarm, evolution)
   - 3 error handling tests (failure, timeout, rollback)
   - 2 dependency tests (sequential, concurrent)
   - 2 context sharing tests (cross-agent, isolation)

3. **Validation and debugging** (~4 hours)
   - Run all tests, fix failures
   - Add edge case tests
   - Document test patterns in learnings.md

### Success Criteria

- [ ] 10+ integration tests implemented
- [ ] All tests passing (100% pass rate)
- [ ] Test coverage report shows orchestrator code paths tested
- [ ] Tests execute in <30 seconds (fast feedback)
- [ ] Clear test output (what passed/failed)
- [ ] Documentation: TESTING.md includes integration test guide

### Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Tests too slow | Mock all external calls, no real agent spawns |
| Flaky tests | Deterministic mocks, no timeouts in tests |
| Hard to debug | Clear assertions, helpful error messages |
| Coupling to implementation | Test orchestrator contract, not internals |

---

## Task #17: End-to-End Feature Tests

**Owner**: QA agent
**Duration**: 2 days (16 hours)
**Dependencies**: None (can run parallel with Task #16)
**Priority**: P1 (CRITICAL for Phase 1A validation)

### Overview

Verify Phase 1A features work end-to-end in realistic scenarios. Current unit tests validate isolated components; E2E tests validate full workflows from user input to final output.

### Problem Statement

- **Current**: 42 unit tests with mocked dependencies
- **Missing**: No E2E tests with real files, real workflows
- **Risk**: Features may fail in production despite passing unit tests
- **Impact**: Cannot confidently deploy Phase 1A features

### Test Scenarios (Minimum 5 Required)

#### 1. Knowledge Base E2E: Create → Index → Search → Verify

**Scenario**: User creates new skill, verifies it appears in search results

**Steps**:
1. Create test skill: `.claude/skills/test-skill-${timestamp}/SKILL.md`
2. Run index builder: `node .claude/lib/workflow/build-knowledge-base-index.cjs`
3. Verify index updated: `grep "test-skill" .claude/knowledge/knowledge-base-index.csv`
4. Search for skill: `node .claude/tools/cli/kb-search.cjs --query "test skill"`
5. Verify result includes test skill

**Expected Output**:
```
Found 1 result:
- test-skill-20260128 | Test skill for E2E testing | .claude/skills/test-skill-20260128
```

**Test Code**:
```javascript
import { test } from 'node:test';
import { exec } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

test('Knowledge Base E2E: Create → Index → Search', async () => {
  const timestamp = Date.now();
  const skillPath = `.claude/skills/test-skill-${timestamp}`;
  const skillFile = path.join(skillPath, 'SKILL.md');

  // Step 1: Create skill
  await fs.mkdir(skillPath, { recursive: true });
  await fs.writeFile(skillFile, `
# Test Skill ${timestamp}

<identity>Test skill for E2E testing</identity>
<capabilities>Testing knowledge base indexing</capabilities>
  `);

  // Step 2: Build index
  await exec('node .claude/lib/workflow/build-knowledge-base-index.cjs');

  // Step 3: Verify index
  const indexContent = await fs.readFile('.claude/knowledge/knowledge-base-index.csv', 'utf8');
  assert(indexContent.includes(`test-skill-${timestamp}`), 'Skill not found in index');

  // Step 4: Search
  const searchResults = await exec(`node .claude/tools/cli/kb-search.cjs --query "test skill"`);
  assert(searchResults.includes(`test-skill-${timestamp}`), 'Skill not found in search');

  // Cleanup
  await fs.rm(skillPath, { recursive: true });
});
```

#### 2. Knowledge Base E2E: Modify → Invalidate → Rebuild → Verify

**Scenario**: User modifies skill, index automatically rebuilds, search reflects changes

**Steps**:
1. Create skill with description "Old description"
2. Build index
3. Verify search returns "Old description"
4. Modify skill to "New description"
5. Trigger index invalidation (hook or manual)
6. Rebuild index
7. Verify search returns "New description"

**Validation**:
- Index reflects latest content
- <5 second rebuild time (1,133 artifacts)
- No stale results

#### 3. Cost Tracking E2E: Session → LLM Calls → Log → Verify Integrity

**Scenario**: Full session lifecycle with cost tracking and integrity verification

**Steps**:
1. Start session: `cost-tracker.start()`
2. Mock LLM calls:
   - Call 1: haiku, 100 tokens in, 200 tokens out
   - Call 2: sonnet, 500 tokens in, 1000 tokens out
   - Call 3: opus, 200 tokens in, 400 tokens out
3. End session: `cost-tracker.end()`
4. Verify log entry created in `llm-usage.log`
5. Verify hash chain: `node .claude/tools/cli/cost-report.js --verify`
6. Calculate expected cost:
   - Haiku: $0.00125 (300 tokens)
   - Sonnet: $0.01875 (1500 tokens)
   - Opus: $0.090 (600 tokens)
   - Total: $0.11
7. Verify report matches: `node .claude/tools/cli/cost-report.js --today`

**Validation**:
- Log entry has all fields (timestamp, model, tokens, cost, hash)
- Hash chain integrity passes
- Cost calculation accurate to $0.01
- <2ms overhead per call

#### 4. Advanced Elicitation E2E: Invoke → Method Selection → Output Improvement

**Scenario**: User invokes elicitation, verifies quality improvement

**Steps**:
1. Create baseline response: "User authentication should use JWT"
2. Invoke elicitation: `Skill({ skill: 'advanced-elicitation', args: 'auto' })`
3. Verify method selection (e.g., "First Principles" for architectural decision)
4. Verify elicited response includes:
   - Reasoning trail (why JWT?)
   - Alternatives considered (sessions, OAuth)
   - Trade-offs analyzed
   - Confidence score
5. Compare baseline vs elicited response (word count, depth, specificity)
6. Verify +30% quality improvement (measurable via word count, specificity score)

**Validation**:
- Method auto-selection works
- Elicited response is longer and more detailed
- Reasoning trail is coherent
- Quality improvement measurable

#### 5. Feature Flag E2E: Disable → Invoke → Verify Graceful Skip

**Scenario**: Feature flag disabled, feature gracefully skips

**Steps**:
1. Disable Advanced Elicitation: `ELICITATION_ENABLED=false`
2. Invoke elicitation: `Skill({ skill: 'advanced-elicitation' })`
3. Verify graceful skip (no error, returns original content)
4. Verify log message: "Advanced Elicitation disabled by feature flag"
5. Enable feature: `ELICITATION_ENABLED=true`
6. Invoke again
7. Verify elicitation runs

**Validation**:
- No errors when feature disabled
- Clear log message about skip reason
- Re-enabling works without restart

#### 6. Integration E2E: Search KB → Invoke Skill → Track Cost → Verify All Systems

**Scenario**: Multi-feature integration test (KB + Cost + Skill)

**Steps**:
1. Start cost tracking session
2. Search KB for "debugging" skill
3. Invoke debugging skill (track LLM calls)
4. End session
5. Verify:
   - Search returned debugging skill (<50ms)
   - Skill invoked successfully
   - Cost tracked for skill invocation
   - Integrity hash valid

**Validation**:
- All 3 features working together
- No interference between features
- Performance targets met

### Test Structure

**Location**: `.claude/tests/integration/`

**File Organization**:
```
tests/
  integration/
    knowledge-base-e2e.test.cjs
    cost-tracking-e2e.test.cjs
    advanced-elicitation-e2e.test.cjs
    feature-flags-e2e.test.cjs
    multi-feature-e2e.test.cjs
```

**Test Environment**:
- Use real files (not mocked) in test environment
- Test directory: `.claude/tests/fixtures/`
- Cleanup after tests (delete test artifacts)

**Assertions**:
- File existence checks
- Content validation (grep, file reads)
- Performance assertions (<50ms search, <5ms overhead)
- Integrity checks (hash verification)

### Implementation Steps

1. **Setup E2E test environment** (~4 hours)
   - Create test fixtures directory
   - Implement test cleanup utilities
   - Mock LLM calls for cost tracking tests
   - Create baseline test data

2. **Implement 5 E2E tests** (~8 hours)
   - 2 Knowledge Base tests (create/search, modify/rebuild)
   - 1 Cost Tracking test (full session)
   - 1 Advanced Elicitation test (auto-selection)
   - 1 Integration test (multi-feature)

3. **Performance validation** (~2 hours)
   - Add performance assertions
   - Profile slow tests
   - Optimize if needed

4. **Documentation** (~2 hours)
   - Document E2E test patterns
   - Create TESTING.md guide
   - Add troubleshooting section

### Success Criteria

- [ ] 5+ E2E tests implemented
- [ ] All tests passing (100% pass rate)
- [ ] Tests use real files (no mocks)
- [ ] Performance assertions met (<50ms search, <5ms overhead)
- [ ] Cleanup working (no leftover test files)
- [ ] Documentation: TESTING.md includes E2E test guide

### Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Tests leave artifacts | Automated cleanup in afterEach() |
| Tests too slow | Run in parallel, optimize file I/O |
| Flaky tests | Deterministic timestamps, unique IDs |
| Hard to debug | Verbose logging, helpful error messages |

---

## Task #18: Monitoring and Observability

**Owner**: DevOps agent
**Duration**: 2 days (16 hours)
**Dependencies**: Tasks #16, #17 (needs test results for baseline)
**Priority**: P2 (IMPORTANT for production readiness)

### Overview

Implement production-grade metrics collection and monitoring infrastructure. Current state has zero observability - no metrics, no performance tracking, no alerting. This is critical for detecting issues in production before users report them.

### Problem Statement

- **Current**: No metrics collection, no monitoring
- **Missing**: Cannot detect performance degradation, errors, or anomalies
- **Risk**: Production issues invisible until user reports
- **Impact**: Slow incident response, poor user experience

### Monitoring Components

#### 1. Hook Execution Metrics

**What to Track**:
- Execution time per hook (PreToolUse, PostToolUse, SessionStart, SessionEnd)
- Success/failure rates per hook
- Hook chain performance (total time through all hooks)
- Bottleneck detection (which hooks are slow)

**Data Structure**:
```json
{
  "timestamp": "2026-01-28T10:00:00Z",
  "hook": "routing-guard.cjs",
  "event": "PreToolUse",
  "executionTimeMs": 2.3,
  "status": "success",
  "tool": "Task",
  "metadata": { "complexity": "HIGH" }
}
```

**Collection Point**:
- Wrap hook execution in `.claude/lib/workflow/hook-executor.cjs`
- Log to `.claude/context/metrics/hooks.jsonl`

**Implementation**:
```javascript
// In hook-executor.cjs
async function executeHook(hookPath, event, input) {
  const startTime = Date.now();
  let status = 'success';
  let error = null;

  try {
    const result = await require(hookPath)(event, input);
    return result;
  } catch (err) {
    status = 'failure';
    error = err.message;
    throw err;
  } finally {
    const executionTimeMs = Date.now() - startTime;

    // Log metric
    await logMetric({
      timestamp: new Date().toISOString(),
      hook: path.basename(hookPath),
      event,
      executionTimeMs,
      status,
      error,
      tool: input.tool,
      metadata: input.metadata
    });
  }
}
```

**Metrics to Calculate**:
- Average execution time per hook
- 95th percentile (p95) execution time
- Error rate (failures / total executions)
- Slowest hooks (top 5)

#### 2. Agent Performance Tracking

**What to Track**:
- Agent spawn time (router → agent ready)
- Task completion time (agent start → TaskUpdate completed)
- Token usage per agent (from cost tracking)
- Agent failure rate (errors / total spawns)

**Data Structure**:
```json
{
  "timestamp": "2026-01-28T10:00:00Z",
  "agent": "developer",
  "taskId": "task-123",
  "spawnTimeMs": 150,
  "completionTimeMs": 45000,
  "tokensUsed": 12500,
  "status": "completed",
  "errorMessage": null
}
```

**Collection Point**:
- Hook into Task tool spawning (capture spawn time)
- Hook into TaskUpdate (capture completion time)
- Integrate with cost tracking (token usage)

**Metrics to Calculate**:
- Average spawn time (target: <200ms)
- Average completion time per agent type
- Token usage per agent (haiku vs sonnet vs opus)
- Agent failure rate (target: <5%)

#### 3. Error Rate Monitoring

**What to Track**:
- Hook failures (which hooks, why)
- Validation errors (routing-guard, security-guard, etc.)
- Security control violations (SEC-* controls)
- System errors (file I/O, parsing, etc.)

**Data Structure**:
```json
{
  "timestamp": "2026-01-28T10:00:00Z",
  "errorType": "ValidationError",
  "source": "routing-guard.cjs",
  "message": "Complexity gate triggered: multi-step task without PLANNER",
  "severity": "HIGH",
  "tool": "TaskCreate",
  "metadata": { "gate": "complexity", "triggered": true }
}
```

**Collection Point**:
- Wrap all hook executions (capture exceptions)
- Add error tracking to validation guards
- Log security control violations

**Metrics to Calculate**:
- Error rate by type (validation, security, system)
- Most frequent errors (top 5)
- Error rate trend (increasing/decreasing)
- Errors by severity (CRITICAL, HIGH, MEDIUM, LOW)

#### 4. Monitoring Dashboard (CLI-Based)

**Dashboard Features**:
- Real-time metrics display
- Historical trends (last 24 hours, last 7 days)
- Alert thresholds (configurable)
- Performance graphs (ASCII charts)

**Dashboard Output**:
```
╔════════════════════════════════════════════════════════════════╗
║            Agent-Studio Monitoring Dashboard                   ║
║                  Last 24 Hours                                 ║
╚════════════════════════════════════════════════════════════════╝

HOOK PERFORMANCE:
  Average execution time:     3.2ms
  P95 execution time:         8.7ms
  Total hooks executed:       1,245
  Failure rate:               0.8%

  Slowest hooks:
    1. research-enforcement.cjs    12.3ms
    2. evolution-state-guard.cjs    8.9ms
    3. routing-guard.cjs            7.2ms

AGENT PERFORMANCE:
  Average spawn time:         145ms
  Average completion time:    32.5s
  Total agents spawned:       87
  Failure rate:               2.3%

  Agent breakdown:
    developer:      45 spawns, 1.2% failure
    planner:        12 spawns, 0.0% failure
    qa:             10 spawns, 5.0% failure

ERROR RATES:
  Total errors:               23
  Validation errors:          15 (65%)
  Security violations:        5 (22%)
  System errors:              3 (13%)

  Top errors:
    1. Complexity gate triggered (8 occurrences)
    2. Path validation failed (4 occurrences)
    3. CSV injection detected (3 occurrences)

ALERTS:
  [HIGH] QA agent failure rate > 5% threshold
  [MEDIUM] research-enforcement.cjs exceeding 10ms target
```

**Implementation**:
```javascript
// .claude/tools/cli/monitor-dashboard.js
import { readMetrics } from '.claude/lib/monitoring/metrics-reader.cjs';
import { renderDashboard } from '.claude/lib/monitoring/dashboard-renderer.cjs';

const metrics = await readMetrics({ since: '24h' });
const dashboard = renderDashboard(metrics);
console.log(dashboard);
```

### Metrics Storage

**Storage Format**: JSONL (JSON Lines) for append-only, efficient parsing

**File Structure**:
```
.claude/context/metrics/
  hooks.jsonl          # Hook execution metrics
  agents.jsonl         # Agent performance metrics
  errors.jsonl         # Error tracking
  alerts.jsonl         # Alert history
```

**Retention Policy**:
- Keep last 30 days of metrics
- Archive older metrics to `.claude/context/metrics/archive/`
- Rotate monthly

### Alert Thresholds (Configurable)

| Metric | Threshold | Severity | Action |
|--------|-----------|----------|--------|
| Hook execution time > 10ms | Average over 1 hour | MEDIUM | Log warning |
| Agent failure rate > 5% | Any agent type | HIGH | Log alert |
| Error rate > 10/hour | System-wide | HIGH | Log alert |
| Security violation | Any SEC-* control | CRITICAL | Log alert + notify |

**Alert Configuration**: `.claude/config.yaml`
```yaml
monitoring:
  alerts:
    hookExecutionTimeMs: 10
    agentFailureRatePercent: 5
    errorRatePerHour: 10
    securityViolationSeverity: CRITICAL
```

### Implementation Steps

1. **Implement metrics collection** (~6 hours)
   - Hook execution tracking in hook-executor.cjs
   - Agent performance tracking (integrate with Task tool)
   - Error tracking (wrap exception handlers)
   - Write metrics to JSONL files

2. **Implement metrics reader** (~2 hours)
   - Parse JSONL files
   - Calculate aggregates (average, p95, error rate)
   - Filter by time range (24h, 7d, 30d)

3. **Implement monitoring dashboard** (~4 hours)
   - CLI tool: monitor-dashboard.js
   - ASCII chart rendering (performance over time)
   - Alert threshold checking
   - Real-time updates (watch mode)

4. **Implement alerting** (~2 hours)
   - Alert threshold evaluation
   - Alert history logging
   - Console warnings for alerts

5. **Documentation** (~2 hours)
   - MONITORING.md guide
   - Dashboard usage examples
   - Alert configuration guide

### Success Criteria

- [ ] Hook execution metrics collected
- [ ] Agent performance metrics collected
- [ ] Error tracking implemented
- [ ] Monitoring dashboard functional
- [ ] Alerts trigger on threshold breach
- [ ] Metrics stored in JSONL format
- [ ] 30-day retention policy enforced
- [ ] Documentation: MONITORING.md complete

### Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Metrics overhead | Async logging, <1ms per metric |
| Disk space usage | 30-day retention, monthly rotation |
| Privacy concerns | No user data in metrics (only system data) |
| Alert fatigue | Configurable thresholds, rate limiting |

---

## Task #19: Performance Optimization

**Owner**: Developer agent
**Duration**: 1 day (8 hours)
**Dependencies**: Tasks #16, #17, #18 (needs test results + monitoring data)
**Priority**: P2 (IMPORTANT for scalability)

### Overview

Profile and optimize critical paths to establish performance baselines before Party Mode. Current performance targets met (KB search <50ms, cost overhead <2ms), but scalability unknowns exist (10,000 artifacts? 10,000 log entries?).

### Problem Statement

- **Current**: Performance targets met for Phase 1A features
- **Missing**: No profiling, no scale testing, no baselines documented
- **Risk**: Party Mode may degrade performance due to multi-agent overhead
- **Impact**: Unknown scalability limits, potential production slowdowns

### Profiling Targets

#### 1. Knowledge Base Search

**Current Performance**: <50ms for 1,133 artifacts

**Profiling Goals**:
- Measure performance at 10,000 artifacts (scale test)
- Identify bottlenecks (CSV parsing? File I/O? String matching?)
- Measure memory footprint
- Test concurrent searches (10 simultaneous searches)

**Profiling Approach**:
```javascript
// Profile KB search
import { performance } from 'node:perf_hooks';
import { searchKnowledgeBase } from '.claude/lib/workflow/knowledge-base-reader.cjs';

// Test 1: Single search (current scale)
const start1 = performance.now();
const results1 = await searchKnowledgeBase({ query: 'testing' });
const duration1 = performance.now() - start1;
console.log(`Single search (1,133 artifacts): ${duration1.toFixed(2)}ms`);

// Test 2: Single search (10,000 artifacts)
// Generate test index with 10,000 entries
await generateTestIndex(10000);
const start2 = performance.now();
const results2 = await searchKnowledgeBase({ query: 'testing' });
const duration2 = performance.now() - start2;
console.log(`Single search (10,000 artifacts): ${duration2.toFixed(2)}ms`);

// Test 3: Memory footprint
const memBefore = process.memoryUsage().heapUsed / 1024 / 1024;
await searchKnowledgeBase({ query: 'testing' });
const memAfter = process.memoryUsage().heapUsed / 1024 / 1024;
console.log(`Memory increase: ${(memAfter - memBefore).toFixed(2)}MB`);

// Test 4: Concurrent searches
const concurrentSearches = 10;
const startConcurrent = performance.now();
await Promise.all(
  Array(concurrentSearches).fill().map(() => searchKnowledgeBase({ query: 'testing' }))
);
const durationConcurrent = performance.now() - startConcurrent;
console.log(`${concurrentSearches} concurrent searches: ${durationConcurrent.toFixed(2)}ms`);
```

**Optimization Opportunities**:
- Cache parsed CSV in memory (avoid re-parsing)
- Index-based search (skip linear scan)
- Lazy loading (load only needed fields)
- Fuzzy matching optimization (faster algorithm)

**Performance Targets**:
- <50ms for 1,133 artifacts (current, maintain)
- <100ms for 10,000 artifacts (scale target)
- <50MB memory footprint
- <200ms for 10 concurrent searches

#### 2. Cost Tracking Overhead

**Current Performance**: <2ms overhead per call

**Profiling Goals**:
- Measure overhead at 10,000 log entries
- Identify bottlenecks (hash calculation? File append? JSON stringify?)
- Test concurrent writes (10 agents writing simultaneously)
- Measure file I/O impact

**Profiling Approach**:
```javascript
// Profile cost tracking
import { LLMUsageTracker } from '.claude/lib/cost-tracking/llm-usage-tracker.cjs';

// Test 1: Single write (current scale)
const tracker = new LLMUsageTracker();
const start1 = performance.now();
await tracker.logUsage({ model: 'sonnet', tokensIn: 500, tokensOut: 1000 });
const duration1 = performance.now() - start1;
console.log(`Single write: ${duration1.toFixed(2)}ms`);

// Test 2: Single write (10,000 entries in log)
// Generate test log with 10,000 entries
await generateTestLog(10000);
const start2 = performance.now();
await tracker.logUsage({ model: 'sonnet', tokensIn: 500, tokensOut: 1000 });
const duration2 = performance.now() - start2;
console.log(`Single write (10,000 entries): ${duration2.toFixed(2)}ms`);

// Test 3: Hash calculation overhead
const start3 = performance.now();
const hash = await tracker.calculateHash('test data');
const duration3 = performance.now() - start3;
console.log(`Hash calculation: ${duration3.toFixed(2)}ms`);

// Test 4: Concurrent writes
const concurrentWrites = 10;
const startConcurrent = performance.now();
await Promise.all(
  Array(concurrentWrites).fill().map(() =>
    tracker.logUsage({ model: 'sonnet', tokensIn: 500, tokensOut: 1000 })
  )
);
const durationConcurrent = performance.now() - startConcurrent;
console.log(`${concurrentWrites} concurrent writes: ${durationConcurrent.toFixed(2)}ms`);
```

**Optimization Opportunities**:
- Batch writes (append multiple entries at once)
- Async file I/O (non-blocking writes)
- Hash caching (reuse previous hash for chain)
- Write buffering (flush every N entries)

**Performance Targets**:
- <5ms overhead per call (current: <2ms, maintain)
- <10ms with 10,000 log entries
- <50ms for 10 concurrent writes
- <100MB file size for 10,000 entries

#### 3. Memory Usage Analysis

**Profiling Goals**:
- Profile agent memory usage (baseline, peak)
- Identify memory leaks (long-running sessions)
- Test Party Mode memory overhead (4 agents simultaneously)
- Optimize context caching

**Profiling Approach**:
```javascript
// Profile memory usage
import { spawnAgent } from '.claude/lib/agent-spawner.cjs';

// Test 1: Single agent memory
const memBefore = process.memoryUsage().heapUsed / 1024 / 1024;
await spawnAgent({ type: 'developer', task: 'simple task' });
const memAfter = process.memoryUsage().heapUsed / 1024 / 1024;
console.log(`Single agent memory: ${(memAfter - memBefore).toFixed(2)}MB`);

// Test 2: Party Mode memory (4 agents)
const memBeforeParty = process.memoryUsage().heapUsed / 1024 / 1024;
await Promise.all([
  spawnAgent({ type: 'developer' }),
  spawnAgent({ type: 'architect' }),
  spawnAgent({ type: 'qa' }),
  spawnAgent({ type: 'security-architect' })
]);
const memAfterParty = process.memoryUsage().heapUsed / 1024 / 1024;
console.log(`Party Mode (4 agents): ${(memAfterParty - memBeforeParty).toFixed(2)}MB`);

// Test 3: Memory leak detection (long-running session)
const memStart = process.memoryUsage().heapUsed / 1024 / 1024;
for (let i = 0; i < 100; i++) {
  await spawnAgent({ type: 'developer', task: `task ${i}` });
}
const memEnd = process.memoryUsage().heapUsed / 1024 / 1024;
console.log(`Memory after 100 spawns: ${(memEnd - memStart).toFixed(2)}MB`);
console.log(`Memory per spawn: ${((memEnd - memStart) / 100).toFixed(2)}MB`);
```

**Optimization Opportunities**:
- Garbage collection tuning (force GC after agent completion)
- Context caching limits (LRU eviction)
- Memory pooling (reuse agent contexts)
- Leak detection (heap snapshots)

**Performance Targets**:
- <100MB baseline memory
- <500MB for Party Mode (4 agents)
- <1GB for long-running sessions (100+ spawns)
- No memory leaks (flat memory usage over time)

### Benchmarks to Create

**Benchmark Suite**: `.claude/tests/benchmarks/`

**File Organization**:
```
benchmarks/
  knowledge-base-search.bench.cjs
  cost-tracking-overhead.bench.cjs
  memory-usage.bench.cjs
  party-mode-simulation.bench.cjs
```

**Benchmark Runner**:
```bash
# Run all benchmarks
node .claude/tests/benchmarks/run-all.cjs

# Output:
# ╔════════════════════════════════════════════════════════════════╗
# ║            Performance Benchmark Results                       ║
# ╚════════════════════════════════════════════════════════════════╝
#
# Knowledge Base Search:
#   1,133 artifacts:     48ms (target: <50ms)  ✓ PASS
#   10,000 artifacts:    92ms (target: <100ms) ✓ PASS
#   Memory footprint:    42MB (target: <50MB)  ✓ PASS
#   10 concurrent:      185ms (target: <200ms) ✓ PASS
#
# Cost Tracking:
#   Single write:        1.8ms (target: <5ms)  ✓ PASS
#   10,000 entries:      4.2ms (target: <10ms) ✓ PASS
#   10 concurrent:       38ms (target: <50ms)  ✓ PASS
#
# Memory Usage:
#   Single agent:        85MB (target: <100MB) ✓ PASS
#   Party Mode (4):     380MB (target: <500MB) ✓ PASS
#   100 spawns:         720MB (target: <1GB)   ✓ PASS
```

### Optimization Report

**Report Location**: `.claude/context/artifacts/performance-baseline-20260128.md`

**Report Structure**:
```markdown
# Performance Baseline Report

**Date**: 2026-01-28
**Framework Version**: v2.2.1
**Test Environment**: [OS, CPU, RAM details]

## Executive Summary

All performance targets met. Recommended optimizations identified for 10x scale.

## Knowledge Base Search

### Current Performance
- 1,133 artifacts: 48ms (target: <50ms) ✓
- 10,000 artifacts: 92ms (target: <100ms) ✓

### Bottleneck Analysis
1. CSV parsing: 60% of time
2. String matching: 30% of time
3. File I/O: 10% of time

### Optimizations Applied
- Cached parsed CSV (25ms → 12ms)
- Indexed search (92ms → 45ms at 10K scale)

### Before/After
| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| 1,133 artifacts | 48ms | 25ms | 48% faster |
| 10,000 artifacts | 92ms | 45ms | 51% faster |

[... same structure for Cost Tracking, Memory Usage ...]

## Regression Tests

All optimizations validated with regression tests (no functionality changes).

## Recommendations

1. Enable CSV caching by default (significant speedup)
2. Consider SQLite for >10,000 artifacts (future)
3. Monitor memory usage in Party Mode (close to 500MB limit)
```

### Implementation Steps

1. **Create profiling scripts** (~2 hours)
   - KB search profiling
   - Cost tracking profiling
   - Memory usage profiling
   - Generate test data (10,000 artifacts, 10,000 log entries)

2. **Run profiling and identify bottlenecks** (~2 hours)
   - Execute profiling scripts
   - Analyze results (flame graphs, heap snapshots)
   - Document bottlenecks

3. **Apply optimizations** (~2 hours)
   - Implement CSV caching
   - Implement async file I/O
   - Add garbage collection hints
   - Test optimizations

4. **Create benchmark suite** (~1 hour)
   - Automated benchmark runner
   - Before/after comparison
   - Pass/fail thresholds

5. **Write performance baseline report** (~1 hour)
   - Document before/after metrics
   - Include optimization strategies
   - Add regression test results

### Success Criteria

- [ ] Profiling scripts created for 3 targets (KB, cost, memory)
- [ ] Bottlenecks identified and documented
- [ ] Optimizations applied (at least 2 per target)
- [ ] Benchmark suite automated
- [ ] Performance baseline report complete
- [ ] All performance targets met:
  - KB search: <50ms (1,133), <100ms (10,000)
  - Cost overhead: <5ms
  - Memory: <100MB baseline, <500MB Party Mode

### Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Optimizations break functionality | Regression tests, unit tests |
| Premature optimization | Profile first, optimize second |
| Optimization complexity | Measure impact, revert if <10% gain |
| Performance degradation over time | Benchmark suite in CI/CD |

---

## Task #20: Staging Environment Setup

**Owner**: DevOps agent
**Duration**: 1 day (8 hours)
**Dependencies**: Tasks #16-19 (needs all tests passing + monitoring + performance validated)
**Priority**: P1 (CRITICAL for production deployment)

### Overview

Create separate staging environment for production-like testing before deploying to production. Current state has only development environment - no way to validate features in production-like conditions without affecting production users.

### Problem Statement

- **Current**: Development environment only
- **Missing**: Staging environment for pre-production validation
- **Risk**: Production issues not caught until users affected
- **Impact**: Slow incident response, poor deployment confidence

### Staging Environment Requirements

#### 1. Environment Detection

**Detection Mechanism**:
```javascript
// .claude/lib/utils/environment.cjs
export function getEnvironment() {
  const nodeEnv = process.env.NODE_ENV;
  const agentEnv = process.env.AGENT_STUDIO_ENV;

  // Priority: AGENT_STUDIO_ENV > NODE_ENV > default
  if (agentEnv) {
    return agentEnv; // 'development' | 'staging' | 'production'
  }
  if (nodeEnv) {
    return nodeEnv === 'production' ? 'production' : 'development';
  }
  return 'development'; // Default
}

export function isStaging() {
  return getEnvironment() === 'staging';
}

export function isProduction() {
  return getEnvironment() === 'production';
}

export function isDevelopment() {
  return getEnvironment() === 'development';
}
```

**Environment Variables**:
```bash
# Development (default)
AGENT_STUDIO_ENV=development

# Staging
AGENT_STUDIO_ENV=staging

# Production
AGENT_STUDIO_ENV=production
```

#### 2. Staging-Specific Settings

**Configuration File**: `.claude/config.staging.yaml`

```yaml
version: "2.2.1"
environment: staging

# Feature flags (all enabled in staging for testing)
features:
  knowledgeBase: true
  costTracking: true
  advancedElicitation: true
  partyMode: true          # Enable for staging testing
  sidecarMemory: true      # Enable for staging testing

# Staging-specific paths
paths:
  knowledge: ".claude/staging/knowledge"
  metrics: ".claude/staging/metrics"
  memory: ".claude/staging/memory"
  agents: ".claude/staging/agents"

# Staging database/logs (separate from dev/prod)
storage:
  costLog: ".claude/staging/metrics/llm-usage.log"
  sessionLog: ".claude/staging/sessions/session-log.jsonl"
  evolutionState: ".claude/staging/context/evolution-state.json"

# Test data isolation
testData:
  enabled: true
  seedData: true  # Auto-populate with test data

# Monitoring (verbose in staging)
monitoring:
  enabled: true
  verboseLogging: true
  dashboardRefreshMs: 5000

# Alerts (relaxed thresholds in staging)
alerts:
  hookExecutionTimeMs: 20       # More lenient than prod (10ms)
  agentFailureRatePercent: 10   # More lenient than prod (5%)
  errorRatePerHour: 20          # More lenient than prod (10%)
```

**Configuration Loader**:
```javascript
// .claude/lib/utils/config-loader.cjs
import { getEnvironment } from './environment.cjs';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

export function loadConfig() {
  const env = getEnvironment();
  const configFile = env === 'staging'
    ? '.claude/config.staging.yaml'
    : '.claude/config.yaml';

  const configContent = readFileSync(configFile, 'utf8');
  return parse(configContent);
}
```

#### 3. Staging-Specific Directories

**Directory Structure**:
```
.claude/staging/
  knowledge/
    knowledge-base-index.csv  # Staging KB index
  metrics/
    hooks.jsonl
    agents.jsonl
    errors.jsonl
    llm-usage.log
  memory/
    learnings.md
    decisions.md
    issues.md
  agents/
    developer/
      standards.md
      patterns.md
      history.jsonl
  sessions/
    session-log.jsonl
  context/
    evolution-state.json
```

**Directory Initialization**:
```bash
# Initialize staging directories
node .claude/tools/cli/init-staging.cjs

# Output:
# Creating staging directories...
# ✓ .claude/staging/knowledge/
# ✓ .claude/staging/metrics/
# ✓ .claude/staging/memory/
# ✓ .claude/staging/agents/
# ✓ .claude/staging/sessions/
# ✓ .claude/staging/context/
#
# Seeding test data...
# ✓ Copied 1,133 artifacts to staging KB
# ✓ Created test learnings.md
# ✓ Created test decisions.md
#
# Staging environment ready!
```

#### 4. Deployment Procedures

**Deployment Checklist**:
```markdown
# Staging Deployment Checklist

## Pre-Deployment
- [ ] All tests passing (unit, integration, E2E)
- [ ] Performance benchmarks passing
- [ ] No open CRITICAL/HIGH issues
- [ ] Security review complete
- [ ] Documentation updated

## Deployment
- [ ] Set AGENT_STUDIO_ENV=staging
- [ ] Initialize staging directories
- [ ] Seed test data
- [ ] Verify config.staging.yaml loaded
- [ ] Run smoke tests

## Post-Deployment
- [ ] Verify all features working
- [ ] Check monitoring dashboard
- [ ] Review error logs (should be empty)
- [ ] Run full test suite in staging
- [ ] Sign-off by QA + Security

## Promotion to Production
- [ ] Staging validation complete (24h minimum)
- [ ] No critical issues in staging
- [ ] User acceptance testing complete
- [ ] Rollback plan documented
- [ ] Create production deployment checklist
```

**Smoke Tests** (Quick validation after deployment):
```bash
# Smoke test script: .claude/tests/smoke/staging-smoke-test.sh

#!/bin/bash
set -e

echo "Running staging smoke tests..."

# Test 1: Environment detection
ENV=$(node -e "console.log(require('./.claude/lib/utils/environment.cjs').getEnvironment())")
if [ "$ENV" != "staging" ]; then
  echo "❌ Environment detection failed (expected: staging, got: $ENV)"
  exit 1
fi
echo "✓ Environment: staging"

# Test 2: Knowledge Base search
KB_RESULTS=$(node .claude/tools/cli/kb-search.cjs --query "testing" | wc -l)
if [ "$KB_RESULTS" -lt 10 ]; then
  echo "❌ Knowledge Base search failed"
  exit 1
fi
echo "✓ Knowledge Base: $KB_RESULTS results"

# Test 3: Cost tracking
touch .claude/staging/metrics/llm-usage.log
LOG_SIZE=$(stat -f%z .claude/staging/metrics/llm-usage.log)
echo "✓ Cost tracking: log file exists ($LOG_SIZE bytes)"

# Test 4: Monitoring dashboard
node .claude/tools/cli/monitor-dashboard.js --env staging > /dev/null
echo "✓ Monitoring: dashboard accessible"

echo ""
echo "✓ All smoke tests passed!"
```

**Rollback Procedures** (If staging deployment fails):
```markdown
# Staging Rollback Procedure

## Level 1: Restart
1. Stop all staging processes
2. Delete .claude/staging/ directory
3. Re-run init-staging.cjs
4. Re-run smoke tests

## Level 2: Revert Code
1. Git revert to last known good commit
2. Run Level 1 rollback
3. Verify tests passing

## Level 3: Nuclear Option
1. Delete .claude/staging/ directory
2. Restore from backup (if exists)
3. Switch to development environment
4. Investigate root cause before retry
```

#### 5. Documentation

**Documentation File**: `.claude/docs/STAGING_ENVIRONMENT.md`

```markdown
# Staging Environment Guide

## Overview

The staging environment is a production-like environment for pre-production validation.

## Setup

```bash
# Set environment variable
export AGENT_STUDIO_ENV=staging

# Initialize staging directories
node .claude/tools/cli/init-staging.cjs

# Verify setup
node .claude/tests/smoke/staging-smoke-test.sh
```

## Environment Differences

| Feature | Development | Staging | Production |
|---------|-------------|---------|------------|
| Feature flags | Some enabled | All enabled | Selective |
| Test data | Minimal | Full seed data | Real data |
| Logging | Standard | Verbose | Standard |
| Alerts | Disabled | Relaxed thresholds | Strict thresholds |
| Data paths | `.claude/` | `.claude/staging/` | `.claude/` |

## Testing Procedures

### Smoke Tests (2 minutes)
```bash
bash .claude/tests/smoke/staging-smoke-test.sh
```

### Full Test Suite (10 minutes)
```bash
AGENT_STUDIO_ENV=staging npm test
```

### Manual Testing
1. Search Knowledge Base (KB search)
2. Track costs (session lifecycle)
3. Invoke Advanced Elicitation
4. Check monitoring dashboard

## Promotion to Production

**Criteria**:
- All tests passing in staging
- 24 hours minimum in staging
- No critical issues
- QA + Security sign-off

**Process**:
1. Deploy to staging (this guide)
2. Validate for 24 hours
3. Create production deployment plan
4. Deploy to production (separate guide)

## Troubleshooting

### Environment not detected
- Check: `echo $AGENT_STUDIO_ENV` (should be "staging")
- Fix: `export AGENT_STUDIO_ENV=staging`

### Config not loaded
- Check: `.claude/config.staging.yaml` exists
- Fix: Copy `.claude/config.yaml` and modify for staging

### Staging directories missing
- Check: `.claude/staging/` exists
- Fix: Run `node .claude/tools/cli/init-staging.cjs`

### Tests failing in staging
- Check: Run tests with `AGENT_STUDIO_ENV=staging npm test`
- Fix: Verify test data seeded correctly
```

### Implementation Steps

1. **Implement environment detection** (~2 hours)
   - Create environment.cjs utility
   - Add environment detection to config loader
   - Test environment switching

2. **Create staging configuration** (~2 hours)
   - Create config.staging.yaml
   - Define staging-specific paths
   - Set feature flags (all enabled)
   - Configure alert thresholds (relaxed)

3. **Initialize staging directories** (~1 hour)
   - Create init-staging.cjs script
   - Seed test data
   - Create directory structure

4. **Create deployment procedures** (~2 hours)
   - Deployment checklist
   - Smoke test script
   - Rollback procedures

5. **Write documentation** (~1 hour)
   - STAGING_ENVIRONMENT.md guide
   - Setup instructions
   - Testing procedures
   - Troubleshooting

### Success Criteria

- [ ] Environment detection working (dev, staging, prod)
- [ ] Staging configuration file created
- [ ] Staging directories initialized
- [ ] Test data seeded
- [ ] Smoke tests passing
- [ ] Full test suite passing in staging
- [ ] Deployment checklist documented
- [ ] Rollback procedures documented
- [ ] Documentation: STAGING_ENVIRONMENT.md complete

### Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Staging data leaks to prod | Separate directories, env checks |
| Config conflicts | Explicit env precedence (AGENT_STUDIO_ENV > NODE_ENV) |
| Deployment errors | Smoke tests, rollback procedures |
| Staging diverges from prod | Periodic sync, same codebase |

---

## Dependencies Graph

```
Task #16 (Integration Tests) ─┐
Task #17 (E2E Tests)          ├─> Task #19 (Performance) ─> Task #20 (Staging)
Task #18 (Monitoring)        ─┘
```

**Critical Path**: Tasks #16/17/18 → #19 → #20

**Parallel Execution**: #16, #17, #18 can run simultaneously

**Sequential**: #19 needs test results + monitoring data; #20 needs all above complete

---

## Risk Assessment

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Integration tests reveal bugs | MEDIUM | HIGH | Fix before Party Mode (blocking) |
| Performance regressions | LOW | MEDIUM | Benchmarks detect, rollback + optimize |
| Monitoring overhead | LOW | LOW | Profile monitoring code, <1ms target |
| Staging setup complexity | LOW | MEDIUM | Simplify config, automate initialization |
| Test environment inconsistencies | MEDIUM | MEDIUM | Deterministic test data, cleanup |

### Schedule Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Integration tests take longer (>3 days) | LOW | LOW | Parallelize, simplify tests |
| Optimization uncovers major bottlenecks | LOW | MEDIUM | Document, defer to Phase 2+ if <10% impact |
| Staging environment setup issues | LOW | LOW | Use development as fallback |

### Quality Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Tests don't catch real issues | MEDIUM | HIGH | E2E tests with real files, staging validation |
| Monitoring misses important metrics | LOW | MEDIUM | Dashboard review, iterate on metrics |
| Performance targets too lenient | LOW | MEDIUM | Tighten targets based on Party Mode needs |

---

## Timeline

### Week 5 (5 days)

**Days 1-3**: Integration Tests + E2E Tests + Monitoring (Parallel)
- Day 1: Integration test infrastructure + E2E test environment + Monitoring metrics collection
- Day 2: Implement 10 integration tests + Implement 5 E2E tests + Monitoring dashboard
- Day 3: Test validation + E2E validation + Alerting implementation

**Day 4**: Performance Optimization (Sequential, needs Day 1-3 data)
- Morning: Profiling scripts + Bottleneck analysis
- Afternoon: Apply optimizations + Benchmark suite + Performance report

**Day 5**: Staging Environment (Sequential, needs Day 1-4 complete)
- Morning: Environment detection + Staging config + Directory initialization
- Afternoon: Deployment procedures + Smoke tests + Documentation

### Milestones

- **Day 3**: All tests passing (52 total: 42 existing + 10 integration)
- **Day 4**: Performance baseline documented
- **Day 5**: Staging operational

---

## Resource Allocation

| Agent | Tasks | Estimated Hours | Notes |
|-------|-------|-----------------|-------|
| **QA Agent** | #16, #17 | 40h (24h + 16h) | Integration + E2E tests |
| **DevOps Agent** | #18, #20 | 24h (16h + 8h) | Monitoring + Staging |
| **Developer Agent** | #19 | 8h | Performance optimization |

**Total Effort**: 72 hours (5 days with parallelization)

**Parallel Execution** (Days 1-3):
- QA Agent: Integration + E2E tests (40h)
- DevOps Agent: Monitoring (16h)

**Sequential Execution** (Days 4-5):
- Developer Agent: Performance (8h) - Day 4
- DevOps Agent: Staging (8h) - Day 5

---

## Success Criteria (Overall)

### Functional Requirements
- [ ] 10+ integration tests passing (orchestrator-level)
- [ ] 5+ E2E tests passing (real files, full workflows)
- [ ] Monitoring dashboard functional (real-time metrics)
- [ ] Performance baselines documented (KB, cost, memory)
- [ ] Staging environment operational (deployable)

### Non-Functional Requirements
- [ ] Zero regressions (42 existing tests still passing)
- [ ] All Phase 1A features validated in staging
- [ ] Performance targets met (KB <50ms, cost <5ms, memory <500MB)
- [ ] Documentation complete (5 new guides)

### Quality Requirements
- [ ] Test coverage: 80%+ for new code
- [ ] Performance: No degradation vs Phase 1A
- [ ] Security: All controls still enforced
- [ ] Reliability: No flaky tests

---

## Next Steps After Hardening

### Week 6: Agent Sidecar Memory (2 days)
**Estimated**: 14 hours
- Lower complexity than Party Mode
- Foundation for Party Mode
- Independent value delivery

### Week 7-8: Party Mode (5-6 days)
**Estimated**: 42 hours (24h implementation + 18h security)
- Full security implementation (6 CRITICAL controls)
- Staging validation complete
- Integration tests passing
- Monitoring baseline established

### Production Deployment
- Gradual rollout with monitoring
- Canary deployment (10% → 50% → 100%)
- Real-time monitoring dashboard
- Rollback procedures tested

---

## Approval

**Plan Status**: DRAFT
**Approval Required**: User
**Implementation**: Spawn QA, DevOps, Developer agents per task after approval

**Estimated Total Duration**: 5 days (72 hours with parallelization)

**Recommendation**: Approve and proceed with hardening before Party Mode implementation.

---

**Plan Version**: 1.0.0
**Created By**: Planner Agent (Task #16)
**Date**: 2026-01-28
**Location**: `.claude/context/plans/production-hardening-plan-20260128.md`
