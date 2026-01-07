# Response-Rater Skill Integration Guide

## Overview

This document describes how the `response-rater` skill integrates into workflow execution to enforce plan quality gates. The response-rater skill provides independent plan quality evaluation using multiple AI providers (Claude, Gemini, Codex, Cursor, Copilot) to ensure plans meet minimum quality standards before workflow execution.

## Integration Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Workflow Execution Flow with Response-Rater                    │
│                                                                 │
│  Step 0: Planner → plan.json                                    │
│           │                                                     │
│           ▼                                                     │
│  Step 0.1: response-rater → plan-rating.json                    │
│           │                                                     │
│           ├─ If score >= 7 → Proceed to Step 1                  │
│           └─ If score < 7 → Return to Planner with feedback     │
└─────────────────────────────────────────────────────────────────┘
```

## Integration Points

### 1. Workflow YAML Configuration (Step 0.1)

**Location**: All workflows must include a Step 0.1 plan rating gate.

**Example YAML**:
```yaml
- step: 0.1
  name: "Plan Rating Gate"
  agent: orchestrator
  type: validation
  skill: response-rater
  inputs:
    - plan-{{workflow_id}}.json (from step 0)
  outputs:
    - plan-rating-{{workflow_id}}.json
    - reasoning: .claude/context/history/reasoning/{{workflow_id}}/00.1-orchestrator.json
  validation:
    minimum_score: 7
    rubric_file: .claude/context/artifacts/standard-plan-rubric.json
    gate: .claude/context/history/gates/{{workflow_id}}/00.1-orchestrator.json
    providers: ["claude", "gemini"]  # Optional: defaults to ["claude", "gemini"]
    timeout: 180  # Optional: 180 seconds per provider
  retry:
    max_attempts: 3
    on_failure: escalate_to_human
  description: |
    Rate plan quality using response-rater skill.
    - Rubric: completeness, feasibility, risk mitigation, agent coverage, integration
    - Minimum passing score: 7/10
    - If score < 7: Return to Planner with feedback, request improvements, re-rate
    - If score >= 7: Proceed with workflow execution
```

**Required Fields**:
- `skill: response-rater` - Invokes the response-rater skill
- `validation.minimum_score` - Minimum passing score (default: 7)
- `validation.rubric_file` - Path to rubric JSON (default: `.claude/context/artifacts/standard-plan-rubric.json`)
- `retry.max_attempts` - Maximum retry attempts (recommended: 3)

**Optional Fields**:
- `validation.providers` - AI providers to use (default: `["claude", "gemini"]`)
- `validation.timeout` - Timeout per provider in seconds (default: 180)
- `retry.on_failure` - Escalation strategy (default: `escalate_to_human`)

### 2. Orchestrator Integration

**File**: `.claude/tools/orchestrator-entry.mjs` (or orchestrator execution logic)

**Required Integration**: After Step 0 (Planner) completes, orchestrator MUST invoke response-rater before proceeding to Step 1.

**Pseudo-code**:
```javascript
// After Step 0 completes
async function executePlanRatingStep(runId, workflowConfig, planArtifact) {
  const step = 0.1;
  const stepConfig = workflowConfig.steps.find(s => s.step === 0.1);

  // Load plan artifact
  const planPath = resolveArtifactPath(runId, planArtifact);
  const planContent = await readFile(planPath, 'utf-8');

  // Load rubric
  const rubricPath = stepConfig.validation?.rubric_file ||
    '.claude/context/artifacts/standard-plan-rubric.json';
  const rubricContent = await readFile(rubricPath, 'utf-8');

  // Invoke response-rater skill
  const ratingResult = await invokeSkill('response-rater', {
    content: planContent,
    rubric: rubricContent,
    providers: stepConfig.validation?.providers || ['claude', 'gemini'],
    timeout: stepConfig.validation?.timeout || 180
  });

  // Parse rating results
  const overallScore = calculateOverallScore(ratingResult);
  const minimumScore = stepConfig.validation?.minimum_score || 7;

  // Save rating artifact
  const ratingPath = resolveArtifactPath(runId, `plan-rating-${runId}.json`);
  await writeFile(ratingPath, JSON.stringify({
    plan_artifact: planArtifact,
    overall_score: overallScore,
    provider_results: ratingResult.providers,
    minimum_score: minimumScore,
    passed: overallScore >= minimumScore,
    timestamp: new Date().toISOString()
  }, null, 2));

  // Register artifact
  await registerArtifact(runId, {
    name: `plan-rating-${runId}.json`,
    step: 0.1,
    agent: 'orchestrator',
    path: ratingPath,
    validationStatus: overallScore >= minimumScore ? 'pass' : 'fail'
  });

  // Handle pass/fail
  if (overallScore < minimumScore) {
    // Extract feedback from provider results
    const feedback = extractFeedback(ratingResult);

    // Return to Planner with feedback
    return {
      status: 'retry',
      step: 0, // Return to planning step
      feedback: feedback,
      rating: ratingResult
    };
  }

  // Passed - proceed to next step
  return {
    status: 'passed',
    rating: ratingResult
  };
}
```

**Key Functions**:

```javascript
/**
 * Invoke response-rater skill
 * @param {string} skillName - "response-rater"
 * @param {object} params - Skill parameters
 * @returns {Promise<object>} Rating result
 */
async function invokeSkill(skillName, params) {
  const { content, rubric, providers, timeout } = params;

  // Create temp file for plan content
  const tempPlanFile = `.claude/context/tmp/tmp-plan-${Date.now()}.json`;
  await writeFile(tempPlanFile, content);

  // Build command
  const skillScript = '.claude/skills/response-rater/scripts/rate.cjs';
  const providersArg = providers.join(',');

  const command = `node ${skillScript} --response-file ${tempPlanFile} --providers ${providersArg} --template response-review`;

  // Execute skill
  const result = await execAsync(command, {
    timeout: timeout * 1000 * providers.length, // Total timeout
    maxBuffer: 10 * 1024 * 1024
  });

  // Clean up temp file
  await unlink(tempPlanFile);

  // Parse result
  return JSON.parse(result.stdout);
}

/**
 * Calculate overall score from provider results
 * @param {object} ratingResult - Response-rater output
 * @returns {number} Overall score (0-10)
 */
function calculateOverallScore(ratingResult) {
  const providers = Object.entries(ratingResult.providers)
    .filter(([_, p]) => p.ok && p.parsed?.scores);

  if (providers.length === 0) {
    throw new Error('No successful provider responses for plan rating');
  }

  // Calculate average score across all providers
  const allScores = providers.flatMap(([_, p]) =>
    Object.values(p.parsed.scores)
  );

  return Math.round(
    allScores.reduce((sum, score) => sum + score, 0) / allScores.length
  );
}

/**
 * Extract actionable feedback from provider results
 * @param {object} ratingResult - Response-rater output
 * @returns {string[]} Feedback items
 */
function extractFeedback(ratingResult) {
  const providers = Object.entries(ratingResult.providers)
    .filter(([_, p]) => p.ok && p.parsed);

  const feedbackItems = [];

  for (const [providerName, result] of providers) {
    if (result.parsed.summary) {
      feedbackItems.push(`[${providerName}] ${result.parsed.summary}`);
    }
    if (result.parsed.improvements) {
      feedbackItems.push(...result.parsed.improvements.map(
        item => `[${providerName}] ${item}`
      ));
    }
  }

  return feedbackItems;
}
```

### 3. Provider Failure Handling

**Graceful Degradation**: The response-rater skill is designed to continue even if some providers fail.

**Minimum Requirement**: At least 1 successful provider response is required.

**Failure Scenarios**:

```javascript
/**
 * Handle provider failures gracefully
 */
function handleProviderFailures(ratingResult) {
  const successfulProviders = Object.entries(ratingResult.providers)
    .filter(([_, p]) => p.ok);

  const failedProviders = Object.entries(ratingResult.providers)
    .filter(([_, p]) => !p.ok);

  // Log failures for debugging
  for (const [name, result] of failedProviders) {
    console.warn(`[response-rater] Provider ${name} failed:`, result.error || result.hint);
  }

  // Require at least 1 successful provider
  if (successfulProviders.length === 0) {
    throw new Error(
      `All providers failed for plan rating. ` +
      `Failed providers: ${failedProviders.map(([n]) => n).join(', ')}`
    );
  }

  // Continue with successful providers
  console.log(
    `[response-rater] Using ${successfulProviders.length} successful providers: ` +
    successfulProviders.map(([n]) => n).join(', ')
  );
}
```

**Provider-Specific Failures**:

| Provider | Common Failures | Resolution |
|----------|----------------|------------|
| Claude | Missing `ANTHROPIC_API_KEY` or session | Run `claude` interactively once to authenticate |
| Gemini | Missing `GEMINI_API_KEY`/`GOOGLE_API_KEY` | Set environment variable or run `gemini` interactively |
| Codex | Missing `OPENAI_API_KEY`/`CODEX_API_KEY` | Set environment variable |
| Cursor | Missing Cursor CLI in WSL | Install via `curl https://cursor.com/install -fsS \| bash` |
| Copilot | Missing GitHub auth | Run `gh auth login` or `copilot` interactively |

### 4. Timeout Handling

**Per-Provider Timeout**: 180 seconds (3 minutes) per provider.

**Total Timeout Calculation**: `timeout_per_provider * number_of_providers`

**Example**:
- 2 providers (claude, gemini): 360 seconds (6 minutes)
- 3 providers (claude, gemini, codex): 540 seconds (9 minutes)

**Timeout Behavior**:
```javascript
/**
 * Handle timeout for response-rater invocation
 */
async function invokeSkillWithTimeout(skillName, params) {
  const { timeout, providers } = params;
  const totalTimeout = (timeout || 180) * 1000 * providers.length;

  try {
    return await Promise.race([
      invokeSkill(skillName, params),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Skill timeout')), totalTimeout)
      )
    ]);
  } catch (error) {
    if (error.message === 'Skill timeout') {
      throw new Error(
        `response-rater timed out after ${totalTimeout / 1000}s ` +
        `(${timeout}s per provider × ${providers.length} providers)`
      );
    }
    throw error;
  }
}
```

### 5. Retry Logic

**Retry Configuration** (from workflow YAML):
```yaml
retry:
  max_attempts: 3
  on_failure: escalate_to_human
```

**Retry Behavior**:

```javascript
/**
 * Execute plan rating with retry logic
 */
async function executePlanRatingWithRetry(runId, workflowConfig, planArtifact) {
  const stepConfig = workflowConfig.steps.find(s => s.step === 0.1);
  const maxAttempts = stepConfig.retry?.max_attempts || 3;
  const onFailure = stepConfig.retry?.on_failure || 'escalate_to_human';

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[Plan Rating] Attempt ${attempt}/${maxAttempts}`);

      const result = await executePlanRatingStep(runId, workflowConfig, planArtifact);

      if (result.status === 'passed') {
        return result;
      }

      // Rating failed (score < minimum)
      if (attempt < maxAttempts) {
        // Return to Planner with feedback
        console.log(`[Plan Rating] Score below minimum. Returning to Planner.`);
        await updateRun(runId, {
          current_step: 0, // Return to planning
          metadata: {
            plan_rating_attempt: attempt,
            feedback: result.feedback
          }
        });

        // Re-execute Planner with feedback
        await executePlannerWithFeedback(runId, result.feedback);

        // Get updated plan artifact
        planArtifact = `plan-${runId}.json`;
        continue;
      }

      // Max attempts exhausted
      throw new Error(`Plan rating failed after ${maxAttempts} attempts`);

    } catch (error) {
      if (attempt === maxAttempts) {
        // Final attempt failed
        if (onFailure === 'escalate_to_human') {
          await requestApproval(runId, 0.1, {
            reason: `Plan rating failed: ${error.message}`,
            artifact: planArtifact
          });
          return { status: 'awaiting_approval' };
        }
        throw error;
      }

      console.warn(`[Plan Rating] Attempt ${attempt} failed: ${error.message}`);
    }
  }
}
```

### 6. Standard Plan Rubric

**Location**: `.claude/context/artifacts/standard-plan-rubric.json`

**Rubric Structure**:
```json
{
  "rubric_version": "1.0",
  "criteria": {
    "correctness": {
      "weight": 0.20,
      "description": "Plan addresses the user's requirements accurately"
    },
    "completeness": {
      "weight": 0.20,
      "description": "All necessary steps and components are included"
    },
    "clarity": {
      "weight": 0.15,
      "description": "Plan is clear, well-structured, and easy to follow"
    },
    "actionability": {
      "weight": 0.15,
      "description": "Each step has clear, actionable instructions"
    },
    "risk_management": {
      "weight": 0.15,
      "description": "Potential risks and mitigation strategies are identified"
    },
    "constraint_alignment": {
      "weight": 0.10,
      "description": "Plan adheres to project constraints and standards"
    },
    "brevity": {
      "weight": 0.05,
      "description": "Plan is concise without unnecessary complexity"
    }
  },
  "scoring": {
    "1-3": "Poor: Major gaps or errors",
    "4-6": "Fair: Significant improvements needed",
    "7-8": "Good: Minor improvements possible",
    "9-10": "Excellent: High quality, ready to execute"
  },
  "minimum_passing_score": 7
}
```

## Skill Invocation Examples

### Natural Language (Recommended)

```
"Rate the plan against the rubric"
"Evaluate plan quality using response-rater"
"Get feedback from Claude and Gemini on this plan"
```

### Direct CLI

```bash
# Basic usage
node .claude/skills/response-rater/scripts/rate.cjs \
  --response-file plan-001.json \
  --providers claude,gemini

# With specific models
node .claude/skills/response-rater/scripts/rate.cjs \
  --response-file plan-001.json \
  --providers claude,gemini,codex \
  --gemini-model gemini-3-pro-preview \
  --codex-model gpt-5.1-codex-max

# Via stdin (PowerShell)
Get-Content plan-001.json | node .claude/skills/response-rater/scripts/rate.cjs --providers claude,gemini
```

### Programmatic Invocation

```javascript
import { invokeSkill } from '.claude/skills/sdk/skill-registry.mjs';

const rating = await invokeSkill('response-rater', {
  content: planContent,
  rubric: rubricContent,
  providers: ['claude', 'gemini'],
  timeout: 180
});
```

## Output Schema

**File**: `plan-rating-{{workflow_id}}.json`

**Schema**:
```json
{
  "plan_artifact": "plan-001.json",
  "overall_score": 8,
  "minimum_score": 7,
  "passed": true,
  "timestamp": "2025-01-06T10:30:00Z",
  "provider_results": {
    "claude": {
      "ok": true,
      "authUsed": "session",
      "parsed": {
        "scores": {
          "correctness": 8,
          "completeness": 8,
          "clarity": 9,
          "actionability": 8,
          "risk_management": 7,
          "constraint_alignment": 8,
          "brevity": 7
        },
        "summary": "The plan is well-structured and addresses all requirements...",
        "improvements": [
          "Add error handling for edge cases",
          "Include performance benchmarks"
        ],
        "rewrite": "Improved plan..."
      }
    },
    "gemini": {
      "ok": true,
      "authUsed": "env",
      "parsed": {
        "scores": { "..." },
        "summary": "...",
        "improvements": ["..."]
      }
    }
  }
}
```

## Implementation Checklist

When integrating response-rater into a new workflow:

- [ ] Add Step 0.1 to workflow YAML with `skill: response-rater`
- [ ] Configure `validation.minimum_score` (default: 7)
- [ ] Configure `validation.providers` (default: `["claude", "gemini"]`)
- [ ] Configure `validation.rubric_file` (default: standard rubric)
- [ ] Configure `retry.max_attempts` (recommended: 3)
- [ ] Configure `retry.on_failure` (recommended: `escalate_to_human`)
- [ ] Update orchestrator to invoke skill after Step 0
- [ ] Implement retry logic for plan improvements
- [ ] Implement provider failure handling (require 1+ success)
- [ ] Implement timeout handling (180s per provider)
- [ ] Test with all configured providers
- [ ] Document workflow-specific rubric criteria (if customized)

## Required Code Changes

### 1. Orchestrator Entry Point

**File**: `.claude/tools/orchestrator-entry.mjs`

**Changes Needed**:
```javascript
// After executeStep0() completes
const step0Result = await executeStep0(runId, selectedWorkflow);

// NEW: Execute Step 0.1 (Plan Rating)
try {
  const planRatingResult = await executePlanRatingWithRetry(
    runId,
    workflowConfig,
    'plan-{{workflow_id}}.json'
  );

  if (planRatingResult.status !== 'passed') {
    // Handle failure or awaiting approval
    await updateRunSummary(runId);
    return {
      runId,
      routing: routingResult,
      step0Result,
      planRatingResult,
      status: planRatingResult.status
    };
  }
} catch (error) {
  console.error(`[Orchestrator Entry] Plan rating failed: ${error.message}`);
  await updateRun(runId, {
    status: 'failed',
    metadata: {
      error: error.message,
      failed_at_step: 0.1
    }
  });
  throw error;
}

// Continue to Step 1 only if plan rating passed
```

### 2. Workflow Runner

**File**: `.claude/tools/workflow_runner.js`

**Changes Needed**:
```javascript
// Add support for skill-based steps
if (stepConfig.skill) {
  // Invoke skill instead of spawning agent
  const skillResult = await executeSkillStep(
    stepConfig.skill,
    runId,
    stepConfig
  );

  // Validate skill output
  if (stepConfig.validation) {
    await validateSkillOutput(skillResult, stepConfig.validation);
  }

  return skillResult;
}
```

### 3. Skill Execution Function

**File**: `.claude/tools/skill-executor.mjs` (NEW FILE)

**Implementation**:
```javascript
/**
 * Execute a skill-based workflow step
 */
export async function executeSkillStep(skillName, runId, stepConfig) {
  const { inputs, outputs, validation } = stepConfig;

  // Load input artifacts
  const inputContent = await loadInputArtifacts(runId, inputs);

  // Build skill parameters
  const params = {
    content: inputContent,
    rubric: validation?.rubric_file ?
      await readFile(validation.rubric_file, 'utf-8') : undefined,
    providers: validation?.providers || ['claude', 'gemini'],
    timeout: validation?.timeout || 180
  };

  // Invoke skill
  const result = await invokeSkill(skillName, params);

  // Save output artifacts
  await saveOutputArtifacts(runId, outputs, result);

  return result;
}
```

## Testing

### Unit Tests

```javascript
describe('response-rater integration', () => {
  it('should rate plan with multiple providers', async () => {
    const result = await invokeSkill('response-rater', {
      content: samplePlan,
      rubric: standardRubric,
      providers: ['claude', 'gemini']
    });

    expect(result.providers.claude.ok).toBe(true);
    expect(result.providers.gemini.ok).toBe(true);
  });

  it('should handle provider failures gracefully', async () => {
    // Test with 1 provider failing
    const result = await invokeSkill('response-rater', {
      content: samplePlan,
      rubric: standardRubric,
      providers: ['claude', 'invalid-provider']
    });

    expect(result.providers.claude.ok).toBe(true);
    expect(result.providers['invalid-provider'].ok).toBe(false);
  });

  it('should enforce minimum score threshold', async () => {
    const result = await executePlanRatingStep(
      'test-run-001',
      workflowConfig,
      'plan-test.json'
    );

    if (result.status === 'retry') {
      expect(result.feedback).toBeDefined();
      expect(result.step).toBe(0); // Return to planning
    } else {
      expect(result.status).toBe('passed');
    }
  });
});
```

### Integration Tests

```bash
# Test full workflow with plan rating
node .claude/tools/orchestrator-entry.mjs \
  --prompt "Create a simple authentication system" \
  --run-id test-rating-001

# Verify rating artifact created
cat .claude/context/runs/test-rating-001/artifacts/plan-rating-test-rating-001.json
```

## Troubleshooting

### Issue: All providers fail

**Symptoms**: Error "All providers failed for plan rating"

**Resolution**:
1. Check provider authentication (run `claude`, `gemini`, etc. interactively)
2. Set environment variables (`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, etc.)
3. Verify network connectivity

### Issue: Timeout exceeded

**Symptoms**: Error "response-rater timed out after Xs"

**Resolution**:
1. Increase `validation.timeout` in workflow YAML
2. Reduce number of providers
3. Check plan size (large plans take longer to rate)

### Issue: Plan never passes rating

**Symptoms**: Max retry attempts exhausted

**Resolution**:
1. Review feedback from rating results
2. Improve plan quality based on feedback
3. Consider lowering `validation.minimum_score` (not recommended)
4. Escalate to human review

## References

- **Response-Rater Skill**: `.claude/skills/response-rater/SKILL.md`
- **Skill SDK**: `.claude/skills/sdk/SKILL.md`
- **Workflow Guide**: `.claude/workflows/WORKFLOW-GUIDE.md`
- **Enforcement Gates**: `.claude/tools/enforcement-gate.mjs`
- **Standard Rubric**: `.claude/context/artifacts/standard-plan-rubric.json`
