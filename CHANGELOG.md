# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - 2026-01-11

### Fixed

- **CRITICAL**: Resolved platform crashes caused by hook functional failures (NOT memory leaks)
- **orchestrator-enforcement-pre-tool.mjs**: Fixed context detection - uses `CLAUDE_AGENT_ROLE`/`CLAUDE_AGENT_NAME` and session state (no CLAUDE.md parsing)
- **audit-post-tool.mjs**: Fixed 30% concurrent failure rate - added retry logic (3 retries, exponential backoff) and increased timeout (1s → 2s)
- Validated zero memory leaks across all 7 hooks (3.9-9.1 KB growth per call, well under 20 MB threshold)

### Added

- Comprehensive hook testing framework with 44 automated tests (100% pass rate)
  - `test-all-hooks.mjs` - Main test runner with isolation tests (24 tests)
  - `test-hook-memory.mjs` - Memory profiling and leak detection (7 hooks tested)
  - `test-hook-stress.mjs` - Stress/load testing (100 rapid + 10 concurrent operations)
  - `hook-test-cases.mjs` - Test case definitions and fixtures
- Hook testing documentation (`HOOK_TESTING_FRAMEWORK.md`)
- Hook recovery documentation (`HOOK_RECOVERY_COMPLETE.md`, `hook-recovery-final-report.md`)
- Test results JSON schema (`hook-test-results.schema.json`) for validation
- Automatic PR workflow rules for orchestrator (auto-triggers after significant work)

### Changed

- **BREAKING**: Orchestrator now automatically triggers PR workflow after completing significant work (3+ files modified, todos complete, test framework created)
- All 7 hooks re-enabled in production configuration after comprehensive validation
- Hook performance validated: p99 latency <250ms, memory growth <10KB per call
- Orchestrator delegation rules updated to enforce automatic PR creation workflow

### Performance Metrics

- **Test Pass Rate**: 100% (24/24 isolation tests, 0 failures in stress tests)
- **Memory**: 3.9-9.1 KB per call (under 20 MB threshold)
- **Latency**: p50 210ms, p95 226ms, p99 240ms (under 500ms threshold)
- **Concurrent Operations**: 0% failure rate (down from 30%)
- **Throughput**: 4.4-4.8 calls/sec under rapid stress

### Files Created (17 total)

- 4 test framework files (.claude/tests/)
- 3 documentation files (.claude/docs/)
- 1 test schema (.claude/schemas/)
- 9 reports and verification files (.claude/context/reports/)
