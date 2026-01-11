# PR Branch Creation Task

## Objective

Create and push 5 feature branches with detailed commits for all CUJ Analysis fixes.

## Context

- **Base Branch**: `feat/comprehensive-cuj-fixes-and-multi-ai-review`
- **All code is implemented, tested, and code-reviewed** (APPROVED)
- **Files are untracked** in working directory
- **No merge conflicts** - clean working state

## Branches to Create

### PR #1: feat/foundation-fixes (Priority 1)

**Files**:

- `.claude/config/memory-thresholds.json` (new)
- `.claude/tools/artifact-path-resolver.mjs` (new)
- `.claude/hooks/skill-injection-hook.js` (check if modified)
- `codex-skills/multi-ai-code-review/scripts/review.js` (check if modified)
- `.claude/tools/run-manager.mjs` (check if modified)
- `.claude/tools/workflow_runner.js` (check if modified)

**Commits**:

1. Memory thresholds centralization (Issue 1.3)
2. Cache optimization with incremental sizing (Issue 1.2)
3. Artifact path resolver centralization (Issue 3.2)
4. UUID workflow IDs (Issue 4.1)

### PR #2: feat/hook-performance (Priority 2)

**Files**:

- `.claude/tools/shared-cache-manager.mjs` (new)
- `.claude/tests/hook-performance-benchmark.mjs` (new)
- `.claude/context/reports/hook-performance-report.md` (new)
- `.claude/hooks/skill-injection-hook.js` (if not already committed)
- `.claude/tools/skill-injector.mjs` (if not already committed)
- `.claude/tools/artifact-path-resolver.mjs` (compression features)

**Commits**:

1. Hook optimization <100ms (Issue 1.1)
2. Shared cache manager (Issue 5.3)
3. Artifact compression (Issue 5.2)

### PR #3: feat/resilience (Priority 3)

**Files**:

- `.claude/context/circuit-breaker-state.json` (new)
- `.claude/docs/ERROR_RECOVERY_GUIDE.md` (new)
- `.claude/tools/error-recovery.mjs` (new)
- `.claude/hooks/skill-injection-hook.js` (circuit breaker config)
- `codex-skills/multi-ai-code-review/scripts/review.js` (timeout handling)
- `codex-skills/multi-ai-code-review/SKILL.md` (documentation)

**Commits**:

1. Circuit breaker persistence (Issue 1.4)
2. Plan rating timeout (Issue 2.1)
3. Multi-AI overall timeout (Issue 3.1)
4. Error recovery system (Issue 6.1)

### PR #4: feat/validation-optimization (Priority 4-6)

**Files**:

- `.claude/context/skill-dependencies.json` (new)
- `.claude/templates/default-plan-rubric.md` (new)
- `.claude/tools/skill-injector.mjs` (dependency validation)
- `.claude/hooks/skill-injection-hook.js` (dependency integration)
- `.claude/tools/workflow_runner.js` (artifact validation, context monitoring, plan caching)
- `codex-skills/multi-ai-code-review/SKILL.md` (consensus docs)

**Commits**:

1. Skill dependency validation (Issue 1.5)
2. Artifact completeness validation (Issue 2.2)
3. Consensus documentation (Issue 3.3)
4. Default rubric + rating cache (Issues 3.4, 3.5)
5. Context monitoring (Issue 5.1)

### PR #5: feat/docs-optimization (CLAUDE.md)

**Files**:

- `.claude/CLAUDE.md` (modified - backup exists)

**Commits**:

1. Optimize CLAUDE.md (30% token reduction)

## Implementation Notes

1. **Check file modifications**: Some files may already be modified in branch history vs untracked
2. **Organize commits logically**: Group related changes together
3. **Follow commit message format**: See original PR plan for exact messages with "Co-Authored-By" line
4. **Push all branches**: `git push -u origin <branch-name>` for each
5. **Create PR summary**: Document all branches pushed

## Success Criteria

- [ ] 5 branches created and pushed
- [ ] 17 commits total with detailed messages
- [ ] All files organized correctly
- [ ] PR creation summary report generated
- [ ] No merge conflicts
- [ ] All branches pushed to origin
