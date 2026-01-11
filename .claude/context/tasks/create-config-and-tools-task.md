# Task: Create Configuration Files and Tools

**Task ID**: create-config-and-tools-2026-01-06
**Created**: 2026-01-06
**Assigned To**: developer
**Priority**: High
**Status**: Pending

## Objective

Create the missing configuration files and tools needed for Issues #2, #5, #8, and #10 based on the requirements provided by the user.

## Context

The project already has several of the requested files:

- ✅ `.claude/config/response-rater.yaml` (exists)
- ✅ `.claude/config/fallback-agents.json` (exists)
- ✅ `.claude/schemas/checkpoint.schema.json` (exists)
- ✅ `.claude/tools/fallback-router.mjs` (exists)

Several validation and CUJ tools already exist:

- `validate-cuj.mjs`
- `validate-cuj-e2e.mjs`
- `run-cuj.mjs`
- `validate-response-rater-dependencies.mjs`

## Files to Create

### 1. Gate Result Schema (Issue #8)

**Path**: `.claude/schemas/gate-result.schema.json`

Create a JSON schema for validation gate results with:

- Required fields: `status`, `validation_timestamp`, `step`, `agent`
- Status enum: `["pass", "fail", "warning", "skip"]`
- Optional arrays: `validation_errors`, `warnings`, `artifacts_validated`
- Performance tracking: `duration_ms`

**Reference Existing Schema**: Use `.claude/schemas/checkpoint.schema.json` as a structural reference.

### 2. Schema Validation Script (Issue #8)

**Path**: `.claude/tools/validate-schemas.mjs`

Create a script that:

- Scans all workflow YAML files in `.claude/workflows/`
- Extracts schema references from workflow steps
- Validates that each referenced schema exists in `.claude/schemas/`
- Outputs a report of missing schemas
- Exit code 0 if all schemas valid, exit code 1 if missing schemas found

**Reference Existing Tools**: Check `.claude/tools/validate-workflow-paths.mjs` for similar workflow scanning patterns.

### 3. CUJ Test Runner (Issue #10)

**Path**: `.claude/tools/cuj-test-runner.mjs`

Create a script that:

- Accepts `--cuj CUJ-XXX` option to test a specific CUJ
- Loads CUJ from `.claude/docs/cujs/`
- Parses success criteria from CUJ document
- Executes the referenced workflow
- Validates results against success criteria
- Outputs test results (pass/fail with details)

**Reference Existing Tools**: Use `.claude/tools/run-cuj.mjs` as a starting point.

### 4. CUJ Validation Script (Issue #10)

**Path**: `.claude/tools/validate-cuj-docs.mjs`

Create a script that:

- Validates CUJ documentation meets standards
- Checks for required sections (Overview, Success Criteria, Workflow)
- Validates workflow references exist
- Validates skill references are valid
- Outputs validation report

**Reference Existing Tools**: Check `.claude/tools/validate-cuj.mjs` for existing CUJ validation patterns.

### 5. Rating Cache (Issue #6)

**Path**: `.claude/tools/rating-cache.mjs`

Create a module that:

- Caches plan ratings to avoid redundant API calls
- Hash function for plan content
- `getCache(planHash)` - retrieve cached rating
- `setCache(planHash, rating, ttl)` - store rating with TTL
- `clearCache()` - clear all cached ratings
- `getCacheStats()` - return cache statistics

**Storage**: Use `.claude/context/cache/rating-cache.json`

### 6. Workflow Monitor (Issue #6)

**Path**: `.claude/tools/workflow-monitor.mjs`

Create a module that:

- Tracks step execution times
- Identifies bottlenecks
- `recordStepStart(runId, step, agent)` - mark step start
- `recordStepEnd(runId, step, status)` - mark step end
- `getPerformanceReport(runId)` - return performance analysis
- `alertSlowSteps(runId, threshold)` - alert on slow steps

**Storage**: Use `.claude/context/runs/<run_id>/performance.json`

## Requirements

1. **Path Validation**: All file paths must follow subagent file rules (`.claude/rules/subagent-file-rules.md`)
2. **Windows Compatibility**: Use proper path separators (forward slashes or `path.join()`)
3. **Error Handling**: Include comprehensive error handling
4. **Documentation**: Add JSDoc comments to all functions
5. **Testing**: Ensure all tools can be run standalone with `--help` option

## Deliverables

1. All missing files created with proper structure
2. Summary report at `.claude/context/reports/config-and-tools-report.md`
3. Verification that all tools execute without errors

## Success Criteria

- [ ] All 6 missing files created
- [ ] All tools executable with proper error handling
- [ ] All files follow subagent file location rules
- [ ] Summary report generated
- [ ] No path validation errors on Windows

## Notes

- Reference existing tools for consistent patterns
- Use existing schemas as structural templates
- Ensure integration with existing validation infrastructure
