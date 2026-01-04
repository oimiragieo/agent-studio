# PR Descriptions for Orchestration Enforcement Rollout

## Phase 1: Foundation (LOW RISK)

### PR Title
```
feat: Add orchestration enforcement foundation (Phase 1/4)
```

### PR Description

#### Summary
This PR adds the foundational infrastructure for orchestration enforcement without changing any existing behavior. It introduces task classification, impact analysis, and code simplification capabilities that will be integrated in subsequent phases.

**Phase**: 1 of 4 (Foundation - LOW RISK)
**Breaking Changes**: None
**Rollback Time**: <1 minute

#### Changes Included

**Tools (4 files)**:
- `task-classifier.mjs` - Classifies tasks by complexity (trivial/simple/moderate/complex/critical)
- `task-classifier.test.mjs` - Comprehensive unit tests
- `task-classifier.test.md` - Test documentation and examples
- `task-classifier-optimizations.md` - Performance optimization notes

**Agents (2 files)**:
- `impact-analyzer.md` - Agent for analyzing change impact before implementation
- `code-simplifier.md` - Agent for reducing code complexity and improving readability

**Schemas (2 files)**:
- `impact_analysis.schema.json` - Validation schema for impact analysis outputs
- `simplification-report.schema.json` - Validation schema for code simplification reports

**Documentation (1 file)**:
- `CUJ-051.md` - Critical User Journey for artifact publishing validation

#### What This Enables

1. **Task Classification**: Automatic detection of task complexity to determine required gates
2. **Impact Analysis**: Pre-implementation analysis of change dependencies and risks
3. **Code Simplification**: Systematic reduction of code complexity
4. **Validation Infrastructure**: Schemas for validating new agent outputs

#### Testing Instructions

```bash
# Run unit tests (should pass)
node .claude/tools/task-classifier.test.mjs

# Test task classification
node .claude/tools/task-classifier.mjs --task "Fix typo in README"
# Expected: complexity="trivial", no gates required

node .claude/tools/task-classifier.mjs --task "Refactor all API endpoints"
# Expected: complexity="complex", gates=["plan", "review", "impact"]

# Validate schemas
node -e "require('./.claude/schemas/impact_analysis.schema.json')"
node -e "require('./.claude/schemas/simplification-report.schema.json')"

# Verify agent files
cat .claude/agents/impact-analyzer.md | head -20
cat .claude/agents/code-simplifier.md | head -20
```

#### Validation Checklist

- [ ] All tests pass: `node .claude/tools/task-classifier.test.mjs`
- [ ] Schema files are valid JSON
- [ ] Agent files have valid frontmatter (YAML)
- [ ] No runtime errors when loading new files
- [ ] Existing workflows still work (no regressions)

#### Rollback Procedure

```bash
# Revert the merge commit
git revert -m 1 <merge-commit-sha>

# Or reset to previous commit (if not merged)
git reset --hard HEAD~1
```

#### Related Issues
- Closes #XXX (Orchestration enforcement epic)
- Related to #YYY (Plan quality improvements)

#### Dependencies
None - This is the first phase

#### Next Steps
After this PR merges:
- Phase 2: Integrate review gates into workflows
- Phase 3: Activate enforcement rules
- Phase 4: Update documentation

---

## Phase 2: Workflow Integration (MEDIUM RISK)

### PR Title
```
feat: Add review gates to workflows (Phase 2/4)
```

### PR Description

#### Summary
This PR integrates the foundation from Phase 1 into existing workflows by adding review steps and validation gates. Gates are added but not enforced - existing workflows continue to work as before.

**Phase**: 2 of 4 (Workflow Integration - MEDIUM RISK)
**Breaking Changes**: None (gates added but optional)
**Rollback Time**: <5 minutes

#### Changes Included

**Workflows (11 files)**:
- `ai-system-flow.yaml` - Add impact-analyzer and code-simplifier review steps
- `bmad-greenfield-standard.yaml` - Add review gates before deployment
- `brownfield-fullstack.yaml` - Add review gates for legacy changes
- `code-quality-flow.yaml` - Add comprehensive review pipeline
- `enterprise-track.yaml` - Add security and compliance gates
- `greenfield-fullstack.yaml` - Add review gates for new projects
- `incident-flow.yaml` - Add impact analysis for incident fixes
- `mobile-flow.yaml` - Add mobile-specific review gates
- `performance-flow.yaml` - Add performance impact analysis
- `quick-flow.yaml` - Add lightweight review gates
- `ui-perfection-loop.yaml` - Add UI/UX review gates

**Configuration (1 file)**:
- `config.yaml` - Register impact-analyzer and code-simplifier agents

#### What This Changes

**Before** (example from code-quality-flow.yaml):
```yaml
steps:
  - agent: developer
    description: Implement fixes
  - agent: qa
    description: Validate fixes
```

**After**:
```yaml
steps:
  - agent: developer
    description: Implement fixes
  - agent: code-simplifier
    description: Review and simplify code
    validation:
      schema: .claude/schemas/simplification-report.schema.json
  - agent: code-reviewer
    description: Final review
  - agent: qa
    description: Validate fixes
```

#### Review Gate Details

**Impact Analysis** (added to complex workflows):
- Analyzes dependencies before implementation
- Identifies breaking changes
- Quantifies risk across system boundaries
- Outputs: `impact_analysis.json`

**Code Simplification** (added to quality workflows):
- Detects unnecessary complexity
- Suggests simplification strategies
- Scores readability (1-10 scale)
- Outputs: `simplification-report.json`

**Code Review** (added to all workflows):
- Systematic code review
- PR analysis and feedback
- Outputs: `code-review-report.json`

#### Testing Instructions

```bash
# Validate all workflow YAML files
for f in .claude/workflows/*.yaml; do
  node -e "const yaml = require('js-yaml'); const fs = require('fs'); yaml.load(fs.readFileSync('$f', 'utf8'));" && echo "✓ $f"
done

# Validate config.yaml
node -e "require('js-yaml').load(require('fs').readFileSync('.claude/config.yaml', 'utf8'))"

# Test workflow execution (dry run)
node .claude/tools/workflow_runner.js \
  --workflow .claude/workflows/code-quality-flow.yaml \
  --step 1 \
  --id test-phase2-001 \
  --dry-run

# Run a full workflow (optional, for smoke testing)
node .claude/tools/run-manager.mjs create \
  --run-id phase2-test \
  --workflow .claude/workflows/quick-flow.yaml
```

#### Validation Checklist

- [ ] All workflow YAML files have valid syntax
- [ ] config.yaml loads without errors
- [ ] New agents registered: impact-analyzer, code-simplifier
- [ ] Workflow runner validates all updated workflows
- [ ] Existing workflow executions still work (backward compatible)
- [ ] No new validation errors in gate files

#### Impact Analysis

**Files Changed**: 12
**Lines Added**: ~547
**Lines Removed**: ~44
**Net Change**: +503 lines

**Risk Assessment**:
- **Low Risk**: Workflows are additive (new steps appended)
- **Backward Compatible**: Old workflows still execute
- **No Behavior Changes**: Gates in place but not enforced

#### Rollback Procedure

```bash
# Option 1: Revert specific files
git checkout HEAD~1 -- .claude/workflows/
git checkout HEAD~1 -- .claude/config.yaml
git commit -m "revert: Rollback workflow integration (Phase 2)"

# Option 2: Revert the merge commit
git revert -m 1 <merge-commit-sha>
```

#### Related Issues
- Part of #XXX (Orchestration enforcement epic)
- Depends on Phase 1: #YYY

#### Dependencies
- **Required**: Phase 1 must be merged first
- **Blocks**: Phase 3 (enforcement activation)

#### Next Steps
After this PR merges:
- Phase 3: Activate orchestration enforcement rules
- Phase 4: Update documentation

---

## Phase 3: Enforcement Activation (HIGH RISK)

### PR Title
```
feat: Activate orchestration enforcement (Phase 3/4) ⚠️
```

### PR Description

#### ⚠️ HIGH RISK DEPLOYMENT - READ CAREFULLY

This PR activates behavioral enforcement for orchestrators. **This changes how orchestrators work** by requiring delegation instead of direct implementation.

**Phase**: 3 of 4 (Enforcement Activation - HIGH RISK)
**Breaking Changes**: YES - Orchestrator behavior changes
**Rollback Time**: <5 minutes (emergency rollback available)
**Approval Required**: Tech Lead + DevOps

#### Changes Included

**Core Configuration (1 file)**:
- `.claude/CLAUDE.md` - Add CRITICAL orchestration enforcement section at top

**Agent Updates (2 files)**:
- `.claude/agents/orchestrator.md` - Add enforcement reminders
- `.claude/agents/model-orchestrator.md` - Add enforcement reminders

#### What This Enforces

**NEW RULES** (non-negotiable):

1. **Orchestrator Must Delegate**:
   - ❌ NEVER read files directly for analysis
   - ❌ NEVER write or edit code
   - ❌ NEVER run validation scripts
   - ✅ MUST use Task tool to spawn subagents

2. **Plan Rating Required**:
   - ALL plans MUST be rated before execution
   - Minimum passing score: 7/10
   - Use response-rater skill for evaluation
   - ❌ NEVER execute an unrated plan

3. **The 3-File Rule**:
   - If about to read a 3rd file → STOP and spawn subagent
   - Orchestrators limited to 2 file reads max

4. **Task Classification**:
   - Complex tasks (5+ files) → MUST spawn subagents
   - Skills requiring validation → MUST delegate to QA
   - Implementation tasks → MUST delegate to developer

#### Before/After Examples

**BEFORE** (Phase 2):
```
User: "Review all skills and fix issues"

Orchestrator:
[Reads skill files directly]
[Analyzes content]
[Makes edits]
✅ This was allowed
```

**AFTER** (Phase 3):
```
User: "Review all skills and fix issues"

Orchestrator:
"I'll spawn specialized agents to handle this."
[Spawns developer subagent for fixes]
[Spawns qa subagent for validation]
❌ Direct file reading BLOCKED
```

#### Testing Protocol (REQUIRED)

**Manual Testing Checklist**:

- [ ] **Test 1: Orchestrator Delegation**
  ```
  Prompt: "Review all skills and fix issues"
  Expected: Spawns subagents
  Failure: Reads files directly → ROLLBACK
  ```

- [ ] **Test 2: Plan Rating**
  ```
  Prompt: "Build a new feature with authentication"
  Expected: Planner creates plan → Orchestrator rates → Execute if ≥7
  Failure: Plan executed without rating → ROLLBACK
  ```

- [ ] **Test 3: 3-File Rule**
  ```
  Prompt: "Analyze these 5 files for patterns"
  Expected: Spawns analyst subagent
  Failure: Reads all 5 files → ROLLBACK
  ```

- [ ] **Test 4: Self-Correction**
  ```
  Prompt: Complex task requiring multiple files
  Expected: Orchestrator stops itself and delegates
  Failure: Continues with violation → ROLLBACK
  ```

#### Validation Commands

```bash
# Verify enforcement section present
grep -q "ORCHESTRATION ENFORCEMENT" .claude/CLAUDE.md && echo "✓ Enforcement active"

# Check critical markers
grep -q "NON-NEGOTIABLE" .claude/CLAUDE.md && echo "✓ Critical rules present"

# Validate agent frontmatter
node -e "
const fs = require('fs');
const yaml = require('js-yaml');
const content = fs.readFileSync('.claude/agents/orchestrator.md', 'utf8');
const match = content.match(/^---\n([\s\S]*?)\n---/);
if (match) yaml.load(match[1]);
console.log('✓ Orchestrator agent valid');
"
```

#### Rollback Procedure (EMERGENCY)

**If ANY issue occurs, rollback immediately:**

```bash
# Step 1: Revert CLAUDE.md (most critical)
git checkout HEAD~1 -- .claude/CLAUDE.md

# Step 2: Revert agent files
git checkout HEAD~1 -- .claude/agents/orchestrator.md
git checkout HEAD~1 -- .claude/agents/model-orchestrator.md

# Step 3: Commit and push ASAP
git commit -m "revert: EMERGENCY rollback orchestration enforcement (Phase 3)"
git push origin main --force-with-lease

# Step 4: Notify team
echo "⚠️ ORCHESTRATION ENFORCEMENT ROLLED BACK"
```

#### Monitoring Plan

**First 24 Hours**:
- Monitor all workflow executions
- Track orchestrator behavior (delegation rate)
- Watch for infinite loops or deadlocks
- Check plan rating compliance

**Metrics to Track**:
| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Orchestrator delegation | >90% | <75% |
| Plan rating compliance | 100% | <95% |
| Workflow success rate | >95% | <90% |
| Subagent spawn failures | 0% | >5% |

#### Success Criteria

- [ ] Orchestrators delegate 90%+ of complex tasks
- [ ] All plans rated before execution (100%)
- [ ] 3-file rule enforced (100%)
- [ ] No infinite loops or deadlocks
- [ ] Workflow success rate maintained (>95%)
- [ ] No emergency rollbacks required

#### Known Risks

1. **Orchestrator Infinite Loop**: Orchestrator spawns itself recursively
   - **Mitigation**: Added self-check in orchestrator agent
   - **Rollback Trigger**: Any infinite loop detected

2. **Plan Rating Deadlock**: Plans never reach 7/10
   - **Mitigation**: Response-rater trained on diverse plans
   - **Rollback Trigger**: 3+ plans blocked in sequence

3. **3-File Rule Too Restrictive**: Legitimate tasks blocked
   - **Mitigation**: Rule only applies to orchestrators, not workers
   - **Rollback Trigger**: Multiple false positives (>10% of tasks)

#### Related Issues
- Part of #XXX (Orchestration enforcement epic)
- Depends on Phase 2: #YYY
- Closes #ZZZ (Orchestrator delegation issue)

#### Dependencies
- **Required**: Phase 1 and Phase 2 must be merged
- **Blocks**: Phase 4 (documentation)

#### Approval Requirements
- [ ] Tech Lead approval
- [ ] DevOps approval
- [ ] QA sign-off on manual testing
- [ ] Rollback procedure validated

#### Next Steps
After this PR merges:
- Monitor for 24 hours
- Phase 4: Update documentation with enforcement examples
- Team training on new enforcement rules

---

## Phase 4: Documentation (NO RISK)

### PR Title
```
docs: Update documentation for orchestration enforcement (Phase 4/4)
```

### PR Description

#### Summary
This PR updates all documentation to reflect the orchestration enforcement rules activated in Phase 3. This is a documentation-only change with no behavioral impact.

**Phase**: 4 of 4 (Documentation - NO RISK)
**Breaking Changes**: None
**Rollback Time**: <1 minute (optional)

#### Changes Included

**Documentation Updates** (~5-10 files):
- `ORCHESTRATION_PATTERNS.md` - Add enforcement examples and best practices
- `WORKFLOW-GUIDE.md` - Document review gates and validation steps
- `ADVANCED_TOOL_USE.md` - Update delegation patterns and subagent usage
- `CLAUDE_SETUP_GUIDE.md` - Add enforcement validation steps
- Additional docs as needed for enforcement references

#### What This Updates

**New Documentation Sections**:

1. **Enforcement Examples**:
   - Correct delegation patterns
   - Common violations and fixes
   - Before/after code examples

2. **Review Gate Guide**:
   - When gates are triggered
   - How to configure gate thresholds
   - Bypassing gates (emergency only)

3. **Delegation Patterns**:
   - Task-to-subagent mapping
   - Subagent selection criteria
   - Coordination strategies

4. **Validation Steps**:
   - How to verify enforcement is active
   - Testing orchestrator delegation
   - Monitoring plan ratings

#### Testing Instructions

```bash
# Check for broken links
find .claude/docs -name "*.md" -type f -exec grep -H "\.md)" {} \; | while read line; do
  file=$(echo "$line" | cut -d: -f1)
  link=$(echo "$line" | grep -oP '\[.*?\]\(\K[^)]+')
  if [[ ! -f "$link" && ! -f ".claude/docs/$link" ]]; then
    echo "⚠️ Broken link in $file: $link"
  fi
done

# Validate markdown syntax
for f in .claude/docs/*.md .claude/workflows/*.md; do
  if [[ -f "$f" ]]; then
    node -e "require('fs').readFileSync('$f', 'utf8');" && echo "✓ $f"
  fi
done

# Check for enforcement keywords
grep -r "orchestration enforcement" .claude/docs/ | wc -l
# Should be >0
```

#### Validation Checklist

- [ ] All documentation files updated
- [ ] No broken links
- [ ] Examples show correct delegation patterns
- [ ] Setup guide includes enforcement validation
- [ ] Workflow guide documents review gates
- [ ] Troubleshooting section added for common issues

#### Related Issues
- Part of #XXX (Orchestration enforcement epic)
- Depends on Phase 3: #YYY

#### Dependencies
- **Required**: Phase 3 must be merged and stable
- **Blocks**: None (final phase)

#### Next Steps
After this PR merges:
- Orchestration enforcement rollout **COMPLETE**
- Team training on new documentation
- Retrospective on rollout process

---

## Cross-Phase Considerations

### Dependency Chain
```
Phase 1 (Foundation)
    ↓
Phase 2 (Workflow Integration)
    ↓
Phase 3 (Enforcement Activation) ⚠️ HIGH RISK
    ↓
Phase 4 (Documentation)
```

### Total Impact
- **Files Changed**: ~30
- **Lines Added**: ~800
- **Lines Removed**: ~50
- **Net Change**: +750 lines

### Rollout Timeline (Recommended)

| Phase | Duration | Wait Period | Total |
|-------|----------|-------------|-------|
| Phase 1 | 1 day | 2 days monitoring | 3 days |
| Phase 2 | 1 day | 3 days monitoring | 4 days |
| Phase 3 | 1 day | 7 days monitoring | 8 days |
| Phase 4 | 1 day | 1 day monitoring | 2 days |
| **Total** | **4 days** | **13 days** | **17 days** |

### Communication Plan

**Before Each Phase**:
- Announce phase start 24 hours in advance
- Share PR description with team
- Review rollback procedures

**During Deployment**:
- Live updates in team chat
- Monitor metrics dashboard
- On-call engineer available

**After Deployment**:
- Share success metrics
- Document any issues encountered
- Update rollout plan based on learnings

---

**Document Version**: 1.0
**Last Updated**: 2026-01-04
**Maintained By**: DevOps Team
