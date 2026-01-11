# Hook Testing Framework

## Overview

This testing framework was created to safely validate ALL hooks before re-enabling them after critical memory crashes caused by synchronous file I/O operations in hook execution.

## Quick Start

### Run All Tests

\HOOK TESTING FRAMEWORK - 2026-01-11T06:55:20.622Z
ISOLATION TESTS
Testing: security-pre-tool.mjs
.......... Summary: 10/10 (211.9ms avg)
Testing: orchestrator-enforcement-pre-tool.mjs
... Summary: 3/3 (209.6ms avg)
Testing: file-path-validator.js
...... Summary: 6/6 (215.4ms avg)
Testing: audit-post-tool.mjs
... Summary: 3/3 (210.1ms avg)
Testing: post-session-cleanup.js
.. Summary: 2/2 (205.9ms avg)
SUMMARY: 24/24 passed
HOOK SAFETY:
[REVIEW] security-pre-tool.mjs
[REVIEW] orchestrator-enforcement-pre-tool.mjs
[REVIEW] file-path-validator.js
[REVIEW] audit-post-tool.mjs
[REVIEW] post-session-cleanup.js
Saved: C:devprojectsLLM-RULES.claudecontext est-results
esults-1768114525713.json
HOOK TESTING FRAMEWORK - 2026-01-11T06:55:25.966Z
ISOLATION TESTS
Testing: security-pre-tool.mjs
.......... Summary: 10/10 (215.6ms avg)
Testing: orchestrator-enforcement-pre-tool.mjs
... Summary: 3/3 (226.2ms avg)
Testing: file-path-validator.js
...... Summary: 6/6 (224.4ms avg)
Testing: audit-post-tool.mjs
... Summary: 3/3 (217.6ms avg)
Testing: post-session-cleanup.js
.. Summary: 2/2 (222.4ms avg)
SUMMARY: 24/24 passed
HOOK SAFETY:
[REVIEW] security-pre-tool.mjs
[REVIEW] orchestrator-enforcement-pre-tool.mjs
[REVIEW] file-path-validator.js
[REVIEW] audit-post-tool.mjs
[REVIEW] post-session-cleanup.js
Saved: C:devprojectsLLM-RULES.claudecontext est-results
esults-1768114531253.json
HOOK TESTING FRAMEWORK - 2026-01-11T06:55:31.500Z
SUMMARY: 0/0 passed
HOOK SAFETY:
Saved: C:devprojectsLLM-RULES.claudecontext est-results
esults-1768114531503.json

### Memory Profiling

\HOOK MEMORY PROFILING - 2026-01-11T06:55:31.868Z
Iterations: 100, Threshold: 20.00 MB

Testing: security-pre-tool.mjs
Iterations: 100
..........
Growth: 538.5 KB (5.4 KB/call)
Perf: p50=215.3ms p95=227.2ms p99=230.9ms
Status: OK

Testing: orchestrator-enforcement-pre-tool.mjs
Iterations: 100
..........
Growth: 29.5 KB (302.32 B/call)
Perf: p50=209.6ms p95=221.4ms p99=227.7ms
Status: OK

Testing: file-path-validator.js
Iterations: 100
..........
Growth: 503.4 KB (5.0 KB/call)
Perf: p50=209.3ms p95=224.7ms p99=234.5ms
Status: OK

Testing: audit-post-tool.mjs
Iterations: 100
..........
Growth: 931.5 KB (9.3 KB/call)
Perf: p50=213.5ms p95=224.2ms p99=243.8ms
Status: OK

Testing: post-session-cleanup.js
Iterations: 100
..........
Growth: 1.14 MB (11.7 KB/call)
Perf: p50=208.8ms p95=224.7ms p99=232.9ms
Status: OK

SUMMARY: 5 hooks, 0 leaks, 0 warnings
[OK] security-pre-tool.mjs
[OK] orchestrator-enforcement-pre-tool.mjs
[OK] file-path-validator.js
[OK] audit-post-tool.mjs
[OK] post-session-cleanup.js
Results: C:devprojectsLLM-RULES.claudecontext est-resultsmemory-1768114638706.json
HOOK MEMORY PROFILING - 2026-01-11T06:57:18.944Z
Iterations: 500, Threshold: 20.00 MB

Testing: security-pre-tool.mjs
Iterations: 500
..................................................
Growth: 1.93 MB (3.9 KB/call)
Perf: p50=208.8ms p95=222.0ms p99=229.2ms
Status: OK

Testing: orchestrator-enforcement-pre-tool.mjs
Iterations: 500
..................................................
Growth: 2.42 MB (5.0 KB/call)
Perf: p50=208.8ms p95=222.5ms p99=239.6ms
Status: WARN

Testing: file-path-validator.js
Iterations: 500
..................................................
Growth: 2.14 MB (4.4 KB/call)
Perf: p50=208.6ms p95=223.1ms p99=236.7ms
Status: WARN

Testing: audit-post-tool.mjs
Iterations: 500
..................................................
Growth: -5864232 B (-11728.464 B/call)
Perf: p50=208.2ms p95=216.1ms p99=221.9ms
Status: OK

Testing: post-session-cleanup.js
Iterations: 500
..................................................
Growth: 1.97 MB (4.0 KB/call)
Perf: p50=203.8ms p95=211.3ms p99=216.6ms
Status: OK

SUMMARY: 5 hooks, 0 leaks, 2 warnings
[OK] security-pre-tool.mjs
[WARN] orchestrator-enforcement-pre-tool.mjs
[WARN] file-path-validator.js
[OK] audit-post-tool.mjs
[OK] post-session-cleanup.js
Results: C:devprojectsLLM-RULES.claudecontext est-resultsmemory-1768115163864.json
HOOK MEMORY PROFILING - 2026-01-11T07:06:04.096Z
Iterations: 100, Threshold: 20.00 MB

Testing: security-pre-tool.mjs
Iterations: 100
..........
Growth: 427.2 KB (4.3 KB/call)
Perf: p50=203.9ms p95=209.0ms p99=215.9ms
Status: OK

SUMMARY: 1 hooks, 0 leaks, 0 warnings
[OK] security-pre-tool.mjs
Results: C:devprojectsLLM-RULES.claudecontext est-resultsmemory-1768115184579.json

### Stress Testing

\HOOK STRESS TESTING - 2026-01-11T07:06:24.924Z
Rapid: 100, Concurrent: 10

Rapid: security-pre-tool.mjs (100 calls)
..... [PASS] 4.9 calls/sec

Concurrent: security-pre-tool.mjs (10 parallel)
[PASS] 881.9ms avg

Rapid: file-path-validator.js (100 calls)
..... [PASS] 4.8 calls/sec

Concurrent: file-path-validator.js (10 parallel)
[PASS] 876.8ms avg

Rapid: audit-post-tool.mjs (100 calls)
..... [PASS] 4.8 calls/sec

Concurrent: audit-post-tool.mjs (10 parallel)
[PASS] 919.9ms avg

SUMMARY: 0 tests failed
Results: C:devprojectsLLM-RULES.claudecontext est-resultsstress-1768115251929.json
HOOK STRESS TESTING - 2026-01-11T07:07:32.169Z
Rapid: 200, Concurrent: 20

Rapid: security-pre-tool.mjs (200 calls)
.......... [PASS] 4.9 calls/sec

Concurrent: security-pre-tool.mjs (20 parallel)
[PASS] 1684.4ms avg

Rapid: file-path-validator.js (200 calls)
.......... [PASS] 4.9 calls/sec

Concurrent: file-path-validator.js (20 parallel)
[PASS] 1677.2ms avg

Rapid: audit-post-tool.mjs (200 calls)
.......... [PASS] 4.8 calls/sec

Concurrent: audit-post-tool.mjs (20 parallel)
[FAIL] 1686.5ms avg

SUMMARY: 1 tests failed
Results: C:devprojectsLLM-RULES.claudecontext est-resultsstress-1768115385828.json

## Test Types

### 1. Isolation Tests

Tests each hook individually with various inputs:

- Security patterns (rm -rf, sudo, curl|bash, etc.)
- File path validation (root files, .claude paths, etc.)
- Orchestrator rules (role-based access)
- Edge cases (empty input, missing fields)

### 2. Integration Tests

Tests hooks together as they run in production:

- PreToolUse chain (security -> file-path -> orchestrator)
- PostToolUse chain (audit -> cleanup)
- Full pipeline simulation

### 3. Memory Profiling

Detects memory leaks by running hooks repeatedly:

- 100+ consecutive calls per hook
- Heap snapshot comparison
- Per-call memory growth calculation
- Thresholds: <5MB growth per 100 calls

### 4. Stress Testing

Validates hook stability under load:

- Rapid-fire: 100+ calls in sequence
- Concurrent: 10+ parallel calls
- Measures throughput, latency (p50/p95/p99)
- Thresholds: <200ms p99, <1% failure rate

## Success Criteria

Hooks are marked **SAFE** to re-enable when:

- All isolation tests pass (100%)
- Average execution time <100ms
- Memory growth <5MB per 100 calls
- No timeouts in stress tests
- <1% failure rate under load

Hooks marked **REVIEW** need investigation:

- Any test failures
- Memory growth >2MB per 100 calls
- p99 latency >200ms
- Timeout occurrences

## Test Results

Results are saved to:
\

## Hooks Under Test

### PreToolUse Hooks

| Hook                                  | Matchers                       | Purpose                       |
| ------------------------------------- | ------------------------------ | ----------------------------- |
| security-pre-tool.mjs                 | Bash,Write,Edit                | Blocks dangerous commands     |
| orchestrator-enforcement-pre-tool.mjs | Read,Write,Edit,Bash,Grep,Glob | Enforces delegation rules     |
| file-path-validator.js                | \*                             | Validates file paths          |
| skill-injection-hook.js               | Task                           | Injects skills into subagents |

### PostToolUse Hooks

| Hook                             | Matchers                              | Purpose                 |
| -------------------------------- | ------------------------------------- | ----------------------- |
| audit-post-tool.mjs              | Bash,Read,Write,Edit,Grep,Glob,Search | Audit logging           |
| orchestrator-audit-post-tool.mjs | Read,Write,Edit,Bash,Grep,Glob,Task   | Orchestrator compliance |
| post-session-cleanup.js          | Write,Edit                            | SLOP file cleanup       |

## Re-enabling Hooks

After all tests pass, update .claude/settings.json:

\

## Background

See .claude/docs/HOOK_CRASH_FIX.md for details on the memory crash issue that necessitated this testing framework.

### Root Causes Addressed

1. Synchronous file I/O at module load
2. Missing recursion protection
3. Missing timeout protection
4. Unbounded log file growth
5. Session state accumulation

### Mitigations Tested

- Recursion guards (env vars)
- Timeout protection (1-5s)
- Lazy loading patterns
- Proper cleanup in finally blocks
- Log rotation
