# Task: Implement Phase 3 Performance Optimizations

**Created**: 2026-01-09
**Priority**: HIGH
**Assigned To**: developer agent
**Estimated Time**: 5-6 hours
**Dependencies**: Phase 1 and 2 complete

## Objective

Implement 6 performance optimizations to reduce CUJ execution time by 30-50%.

## Implementation Checklist

### High Priority (Do First)

- [ ] Create `.claude/tools/skill-cache.mjs` with TTL-based caching
  - getCachedResult(skillName, params, ttl)
  - setCachedResult(skillName, params, result)
  - clearCache(skillName)
  - getCacheStats()
  - pruneExpiredCache(ttl)

- [ ] Create `.claude/tools/workflow/parallel-executor.mjs`
  - groupStepsByParallelGroup(steps)
  - executeWorkflowSteps(steps, context)
  - validateParallelGroups(steps)

- [ ] Integrate parallel executor into `.claude/tools/workflow_runner.js`
  - Import executeWorkflowSteps
  - Replace sequential execution with parallel-aware execution
  - Add validation for parallel groups

- [ ] Integrate skill caching into `.claude/tools/run-cuj.mjs`
  - Wrap skill invocations with caching layer
  - Add cache stats logging

### Medium Priority

- [ ] Add O(1) indexing to `.claude/tools/run-manager.mjs`
  - Create ArtifactRegistry class with Map indexes
  - Implement getById(), getByType(), getByStep()
  - Maintain backward compatibility

- [ ] Update `.claude/workflows/greenfield-fullstack.yaml`
  - Add parallel: true to steps 2, 3, 4
  - Add parallel_group: 1 to steps 2, 3, 4

### Low Priority

- [ ] Add lazy schema loading to `.claude/tools/artifact-validator.mjs`
  - Implement on-demand schema loading
  - Cache compiled validators

- [ ] Add rule index caching to skills
  - Modify rule-selector skill
  - Add file mtime invalidation

- [ ] Create `.claude/tools/git-cache.mjs`
  - Cache git diff by commit hash
  - Implement TTL-based invalidation

## Validation

- [ ] Run benchmarks before/after each optimization
- [ ] Verify no test regressions
- [ ] Measure CUJ-005 execution time improvement
- [ ] Document performance improvements

## Conventional Commits

Use these commit messages for each implementation:

perf: add skill result caching with TTL (Cursor #8)
perf: implement parallel workflow execution (Cursor #7)  
perf: add O(1) artifact registry indexing (Cursor #9)
perf: add lazy schema loading (Cursor #10)
perf: add rule index caching (Cursor #11)
perf: implement git diff caching (Cursor #12)

## Success Criteria

- [ ] 30-50% reduction in CUJ execution time
- [ ] All tests pass
- [ ] Benchmarks show improvements
- [ ] 6 conventional commits created
