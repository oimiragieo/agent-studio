# Response-Rater Skill Integration Gaps Report

**Date**: 2025-01-06
**Issue**: Critical Issue #2 - Response-Rater Skill Integration Gaps
**Status**: Documented ✅ | Implementation Required ⚠️

## Executive Summary

The response-rater skill is **documented** in workflows but **not fully implemented** in execution paths. All 14 workflows include Step 0.1 (Plan Rating Gate) with `skill: response-rater`, but the orchestrator and workflow runner do not currently invoke this skill during execution.

**Impact**: Plans are not being rated before execution, violating the mandatory "never execute an unrated plan" rule from CLAUDE.md.

## Current State

### ✅ What's Working

1. **Skill Implementation**: `response-rater` skill is fully implemented
   - Script: `.claude/skills/response-rater/scripts/rate.cjs`
   - Documentation: `.claude/skills/response-rater/SKILL.md`
   - Supports 5 providers: Claude, Gemini, Codex, Cursor, Copilot
   - Handles provider failures gracefully
   - Timeout handling (180s per provider)

2. **Workflow Documentation**: All 14 workflows include Step 0.1
   - `quick-flow.yaml`
   - `greenfield-fullstack.yaml`
   - `brownfield-fullstack.yaml`
   - `enterprise-track.yaml`
   - `code-quality-flow.yaml`
   - `performance-flow.yaml`
   - `ai-system-flow.yaml`
   - `mobile-flow.yaml`
   - `legacy-modernization-flow.yaml`
   - `incident-flow.yaml`
   - `browser-testing-flow.yaml`
   - `automated-enterprise-flow.yaml`
   - `ui-perfection-loop.yaml`
   - `bmad-greenfield-standard.yaml`

3. **Skill Registry**: Skill loading infrastructure exists
   - `.claude/skills/sdk/skill-registry.mjs`
   - `invokeSkill()` function defined
   - Skill metadata parsing implemented

### ❌ What's Missing

1. **Orchestrator Integration**: `orchestrator-entry.mjs` does NOT invoke response-rater
   - Executes Step 0 (Planner) ✅
   - Does NOT execute Step 0.1 (Plan Rating) ❌
   - Jumps directly to step progression without rating

2. **Workflow Runner Integration**: `workflow_runner.js` does NOT support skill-based steps
   - Only supports agent-based steps
   - No logic to invoke skills when `step.skill` is defined
   - Cannot read response-rater output for validation

3. **Skill Execution Function**: No unified skill executor
   - `invokeSkill()` is defined in SDK but not used in orchestration
   - No adapter for CLI execution of skills
   - No artifact saving logic for skill outputs

4. **Retry Logic**: No plan improvement loop
   - If plan scores < 7, should return to Planner with feedback
   - No mechanism to extract feedback from rating results
   - No loop to re-rate improved plans

5. **Provider Failure Handling**: Not implemented in orchestration
   - Skill handles failures, but orchestrator doesn't check
   - No enforcement of "require 1+ successful provider"

## Required Implementation Changes

### 1. Orchestrator Entry Point

**File**: `.claude/tools/orchestrator-entry.mjs`

**Location**: After `executeStep0()` completes (line ~417)

**Changes**:

```javascript
// After Step 0 completes
const step0Result = await executeStep0(runId, selectedWorkflow);

// NEW: Execute Step 0.1 (Plan Rating Gate)
console.log(`[Orchestrator Entry] Executing Step 0.1: Plan Rating`);
try {
  const planRatingResult = await executePlanRatingStep(runId, selectedWorkflow);

  if (planRatingResult.status === 'retry') {
    // Plan failed rating - return to Planner with feedback
    console.log(`[Orchestrator Entry] Plan rating failed. Returning to Planner.`);
    await updateRun(runId, {
      current_step: 0,
      metadata: {
        plan_rating_feedback: planRatingResult.feedback,
      },
    });

    // Re-execute Planner with feedback
    await executeStep0WithFeedback(runId, selectedWorkflow, planRatingResult.feedback);

    // Retry rating (up to 3 times)
    // ... retry logic ...
  }

  if (planRatingResult.status !== 'passed') {
    // Escalate to human or fail
    await updateRunSummary(runId);
    return {
      runId,
      routing: routingResult,
      step0Result,
      planRatingResult,
      status: planRatingResult.status,
    };
  }

  console.log(`[Orchestrator Entry] Plan rating passed (score: ${planRatingResult.score}/10)`);
} catch (error) {
  console.error(`[Orchestrator Entry] Plan rating failed: ${error.message}`);
  await updateRun(runId, {
    status: 'failed',
    metadata: {
      error: error.message,
      failed_at_step: 0.1,
    },
  });
  throw error;
}

// Continue to Step 1 only if plan rating passed
```

**New Functions Needed**:

```javascript
async function executePlanRatingStep(runId, workflowPath) {
  /* ... */
}
async function executeStep0WithFeedback(runId, workflowPath, feedback) {
  /* ... */
}
```

### 2. Workflow Runner

**File**: `.claude/tools/workflow_runner.js`

**Location**: In step execution logic (needs analysis - file too large to read)

**Changes**:

```javascript
// Add skill-based step detection
if (stepConfig.skill) {
  console.log(`[Workflow Runner] Executing skill-based step: ${stepConfig.skill}`);

  const skillResult = await executeSkillStep(stepConfig.skill, runId, stepConfig);

  // Validate skill output
  if (stepConfig.validation) {
    await validateSkillOutput(skillResult, stepConfig.validation);
  }

  return {
    status: 'completed',
    step: stepConfig.step,
    skill: stepConfig.skill,
    result: skillResult,
  };
}

// Existing agent-based logic continues...
```

### 3. Skill Executor (NEW FILE)

**File**: `.claude/tools/skill-executor.mjs` (NEW)

**Purpose**: Unified skill execution adapter

**Implementation**:

```javascript
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, writeFile } from 'fs/promises';
import { resolveArtifactPath } from './path-resolver.mjs';
import { registerArtifact } from './run-manager.mjs';

const execAsync = promisify(exec);

/**
 * Execute a skill-based workflow step
 * @param {string} skillName - Name of skill (e.g., "response-rater")
 * @param {string} runId - Run ID
 * @param {object} stepConfig - Step configuration from workflow YAML
 * @returns {Promise<object>} Skill execution result
 */
export async function executeSkillStep(skillName, runId, stepConfig) {
  const { inputs, outputs, validation } = stepConfig;

  // Load input artifacts
  const inputContent = await loadInputArtifacts(runId, inputs);

  // Build skill parameters based on skill type
  const params = buildSkillParams(skillName, stepConfig, inputContent);

  // Invoke skill
  const result = await invokeSkillCLI(skillName, params);

  // Save output artifacts
  await saveOutputArtifacts(runId, outputs, result);

  // Validate output
  if (validation) {
    await validateSkillOutput(result, validation);
  }

  return result;
}

/**
 * Invoke skill via CLI
 */
async function invokeSkillCLI(skillName, params) {
  const skillScript = `.claude/skills/${skillName}/scripts/rate.cjs`;

  // Create temp file for input
  const tempInputFile = `.claude/context/tmp/tmp-${skillName}-input-${Date.now()}.json`;
  await writeFile(tempInputFile, params.content);

  // Build command
  const providersArg = (params.providers || ['claude', 'gemini']).join(',');
  const command = `node ${skillScript} --response-file ${tempInputFile} --providers ${providersArg}`;

  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout: (params.timeout || 180) * 1000 * (params.providers || ['claude', 'gemini']).length,
      maxBuffer: 10 * 1024 * 1024,
    });

    // Parse result
    const result = JSON.parse(stdout);

    // Clean up temp file
    await unlink(tempInputFile);

    return result;
  } catch (error) {
    // Clean up temp file
    try {
      await unlink(tempInputFile);
    } catch {}
    throw new Error(`Skill ${skillName} execution failed: ${error.message}`);
  }
}

/**
 * Build skill parameters from step config
 */
function buildSkillParams(skillName, stepConfig, inputContent) {
  if (skillName === 'response-rater') {
    return {
      content: inputContent,
      providers: stepConfig.validation?.providers || ['claude', 'gemini'],
      timeout: stepConfig.validation?.timeout || 180,
      rubric: stepConfig.validation?.rubric_file,
    };
  }

  // Default params
  return { content: inputContent };
}

/**
 * Load input artifacts
 */
async function loadInputArtifacts(runId, inputs) {
  // Parse inputs array (e.g., ["plan-{{workflow_id}}.json (from step 0)"])
  const inputFile = inputs[0].split(' ')[0].replace('{{workflow_id}}', runId);
  const inputPath = resolveArtifactPath(runId, inputFile);

  return await readFile(inputPath, 'utf-8');
}

/**
 * Save output artifacts
 */
async function saveOutputArtifacts(runId, outputs, result) {
  // Parse outputs array (e.g., ["plan-rating-{{workflow_id}}.json"])
  const outputFile = outputs[0].replace('{{workflow_id}}', runId);
  const outputPath = resolveArtifactPath(runId, outputFile);

  await writeFile(outputPath, JSON.stringify(result, null, 2));

  await registerArtifact(runId, {
    name: outputFile,
    step: 0.1,
    agent: 'orchestrator',
    path: outputPath,
    validationStatus: 'pending',
  });
}

/**
 * Validate skill output
 */
async function validateSkillOutput(result, validation) {
  // Calculate overall score
  const overallScore = calculateOverallScore(result);
  const minimumScore = validation.minimum_score || 7;

  if (overallScore < minimumScore) {
    throw new ValidationError({
      message: `Plan rating failed: score ${overallScore} < minimum ${minimumScore}`,
      score: overallScore,
      minimumScore,
      feedback: extractFeedback(result),
    });
  }
}
```

### 4. Helper Functions

**File**: `.claude/tools/plan-rating-helpers.mjs` (NEW)

**Implementation**:

```javascript
/**
 * Calculate overall score from provider results
 */
export function calculateOverallScore(ratingResult) {
  const providers = Object.entries(ratingResult.providers || {}).filter(
    ([_, p]) => p.ok && p.parsed?.scores
  );

  if (providers.length === 0) {
    throw new Error('No successful provider responses for plan rating');
  }

  // Calculate average score across all providers
  const allScores = providers.flatMap(([_, p]) => Object.values(p.parsed.scores));

  return Math.round(allScores.reduce((sum, score) => sum + score, 0) / allScores.length);
}

/**
 * Extract actionable feedback from provider results
 */
export function extractFeedback(ratingResult) {
  const providers = Object.entries(ratingResult.providers || {}).filter(
    ([_, p]) => p.ok && p.parsed
  );

  const feedbackItems = [];

  for (const [providerName, result] of providers) {
    if (result.parsed.summary) {
      feedbackItems.push(`[${providerName}] ${result.parsed.summary}`);
    }
    if (result.parsed.improvements) {
      feedbackItems.push(...result.parsed.improvements.map(item => `[${providerName}] ${item}`));
    }
  }

  return feedbackItems;
}
```

### 5. Validation Error Class

**File**: `.claude/tools/errors.mjs` (NEW or add to existing)

**Implementation**:

```javascript
export class ValidationError extends Error {
  constructor({ message, score, minimumScore, feedback }) {
    super(message);
    this.name = 'ValidationError';
    this.score = score;
    this.minimumScore = minimumScore;
    this.feedback = feedback;
  }
}
```

## Implementation Priority

### Phase 1: Critical Path (Week 1)

1. **Create skill-executor.mjs** (NEW FILE)
   - Implement `executeSkillStep()`
   - Implement `invokeSkillCLI()`
   - Implement artifact loading/saving
   - Priority: **CRITICAL** - Blocks all plan rating

2. **Update orchestrator-entry.mjs**
   - Add Step 0.1 execution after Step 0
   - Implement retry logic (3 attempts)
   - Add escalation to human on failure
   - Priority: **CRITICAL** - Enables plan rating

3. **Create plan-rating-helpers.mjs** (NEW FILE)
   - Implement `calculateOverallScore()`
   - Implement `extractFeedback()`
   - Priority: **HIGH** - Required for validation

### Phase 2: Workflow Runner Integration (Week 2)

4. **Update workflow_runner.js**
   - Add skill-based step detection
   - Call `executeSkillStep()` for skill steps
   - Priority: **HIGH** - Enables general skill support

5. **Create errors.mjs** (NEW FILE)
   - Implement `ValidationError` class
   - Add error metadata (score, feedback)
   - Priority: **MEDIUM** - Improves error handling

### Phase 3: Testing & Validation (Week 3)

6. **Unit tests for skill-executor.mjs**
   - Test skill invocation
   - Test provider failures
   - Test timeout handling

7. **Integration tests for orchestrator**
   - Test full plan rating flow
   - Test retry logic
   - Test escalation

8. **End-to-end tests**
   - Run full workflow with plan rating
   - Verify rating artifacts created
   - Verify retry on low scores

## Testing Plan

### Manual Testing

```bash
# 1. Test skill invocation directly
node .claude/skills/response-rater/scripts/rate.cjs \
  --response-file .claude/context/artifacts/test-plan.json \
  --providers claude,gemini

# 2. Test orchestrator with plan rating
node .claude/tools/orchestrator-entry.mjs \
  --prompt "Create a simple REST API" \
  --run-id test-rating-001

# 3. Verify rating artifact created
cat .claude/context/runs/test-rating-001/artifacts/plan-rating-test-rating-001.json

# 4. Test plan improvement loop (intentionally create bad plan)
# Manually edit plan to be incomplete, verify it returns to Planner
```

### Automated Testing

```javascript
// tests/response-rater-integration.test.js
describe('Response-Rater Integration', () => {
  test('should execute plan rating after planning', async () => {
    const runId = 'test-run-001';
    const result = await processUserPrompt('Create a simple API', { runId });

    expect(result.planRatingResult).toBeDefined();
    expect(result.planRatingResult.status).toBe('passed');
  });

  test('should retry plan on low score', async () => {
    // Mock rating to return score < 7
    const runId = 'test-run-002';
    const result = await processUserPrompt('Incomplete request', { runId });

    // Should have retried
    const runRecord = await readRun(runId);
    expect(runRecord.metadata.plan_rating_attempt).toBeGreaterThan(1);
  });

  test('should handle provider failures gracefully', async () => {
    // Mock 1 provider failure
    const runId = 'test-run-003';
    const result = await processUserPrompt('Create API', { runId });

    // Should still pass with 1+ successful provider
    expect(result.planRatingResult.status).toBe('passed');
  });
});
```

## Success Criteria

### Functional Requirements

- [ ] Orchestrator executes Step 0.1 after Step 0
- [ ] response-rater skill is invoked via CLI
- [ ] Rating results are saved to artifacts
- [ ] Plans with score >= 7 proceed to Step 1
- [ ] Plans with score < 7 return to Planner with feedback
- [ ] Max 3 retry attempts before escalation
- [ ] At least 1 successful provider required
- [ ] Provider failures are handled gracefully
- [ ] Timeouts are handled correctly (180s per provider)

### Non-Functional Requirements

- [ ] Execution time: < 10 minutes for 2 providers
- [ ] Error messages are actionable
- [ ] All artifacts are logged to run registry
- [ ] Reasoning files are created
- [ ] Dashboard reflects rating status
- [ ] Documentation is complete and accurate

## Risks & Mitigation

### Risk 1: Provider Failures

**Risk**: All providers fail, blocking workflow execution.

**Mitigation**:

- Require only 1+ successful provider (not all)
- Provide clear auth setup instructions
- Fall back to manual approval on total failure

### Risk 2: Infinite Retry Loop

**Risk**: Plan never passes rating, retries forever.

**Mitigation**:

- Hard limit of 3 retry attempts
- Escalate to human after max retries
- Provide detailed feedback for improvement

### Risk 3: Performance Impact

**Risk**: Plan rating adds 3-10 minutes to workflow.

**Mitigation**:

- Use only 2 providers by default (Claude, Gemini)
- Run providers in parallel when possible
- Consider async rating for non-critical workflows

## Next Steps

1. **Developer Assignment**: Assign implementation to developer agent
2. **Create Implementation Task**: Break down into subtasks
3. **Set Timeline**: Target completion in 3 weeks
4. **Code Review**: Require review from orchestrator and qa agents
5. **Documentation Update**: Update WORKFLOW-GUIDE.md with new flow
6. **CUJ Validation**: Ensure all CUJs still pass with new flow

## Conclusion

The response-rater skill is **well-documented** but **not integrated** into execution paths. Implementation requires:

1. **3 new files**: skill-executor.mjs, plan-rating-helpers.mjs, errors.mjs
2. **2 file updates**: orchestrator-entry.mjs, workflow_runner.js
3. **~500 lines of code**: Skill invocation, retry logic, validation
4. **Estimated effort**: 3 weeks (1 developer)

**Priority**: **CRITICAL** - This is a hard requirement from CLAUDE.md: "Never execute an unrated plan."

**Recommendation**: Begin Phase 1 implementation immediately.
