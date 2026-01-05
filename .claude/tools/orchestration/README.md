# Orchestration Tools

This directory contains orchestration tools for the agent integration fix (Phases 3 and 6).

## Tools

### 1. plan-review-gate.mjs

**Purpose**: Coordinates multi-agent plan reviews based on task type and complexity.

**Location**: `.claude/tools/plan-review-gate.mjs`

**Features**:
- Determines required and optional plan reviewers
- Applies complexity and workflow modifiers
- Aggregates reviewer scores using weighted averages
- Detects blocking issues that prevent plan approval

**Usage**:

```javascript
import { runPlanReviewGate, aggregateResults } from '../plan-review-gate.mjs';

// Step 1: Determine reviewers
const gateResult = await runPlanReviewGate(
  '.claude/context/artifacts/plan.json',
  'wf-123',
  ['authentication', 'security']
);

console.log('Required reviewers:', gateResult.reviewers.required);
console.log('Optional reviewers:', gateResult.reviewers.optional);
console.log('Minimum score:', gateResult.reviewers.minimum_score);

// Step 2: Spawn reviewer agents and collect reviews
const reviews = [
  { reviewer: 'architect', score: 8, required: true, issues: [] },
  { reviewer: 'qa', score: 7, required: true, issues: [] }
];

// Step 3: Aggregate results
const aggregated = aggregateResults(reviews, {
  score_range: [0, 10],
  aggregation: 'weighted_average',
  weights: { required: 0.7, optional: 0.3 },
  blocking_behavior: 'any_reviewer_below_threshold_blocks',
  minimum_score: 7,
  blocking_threshold: 5
});

console.log('Overall score:', aggregated.overall_score);
console.log('Passed:', aggregated.passed);
```

**CLI Usage**:
```bash
node .claude/tools/plan-review-gate.mjs \
  --plan .claude/context/artifacts/plan.json \
  --workflow-id wf-123 \
  --keywords "auth,security"
```

### 2. signoff-validator.mjs

**Purpose**: Validates that required signoff artifacts exist and meet quality criteria.

**Location**: `.claude/tools/signoff-validator.mjs`

**Features**:
- Validates signoff artifacts against JSON schemas using Ajv
- Checks quality conditions (test coverage, scores, etc.)
- Handles conditional signoffs triggered by task keywords
- Supports both required and conditional signoffs

**Usage**:

```javascript
import { validateWorkflowSignoffs } from '../signoff-validator.mjs';

const result = await validateWorkflowSignoffs(
  'wf-123',
  'fullstack',
  'Add authentication with JWT'
);

if (result.valid) {
  console.log('✅ All signoffs passed!');
  console.log('Summary:', result.summary);
} else {
  console.log('❌ Signoff validation failed');
  result.signoffs.filter(s => !s.valid).forEach(signoff => {
    console.log(`\n${signoff.type}:`);
    console.log(`  Artifact: ${signoff.artifact}`);
    console.log(`  Schema valid: ${signoff.schema_valid}`);
    console.log(`  Conditions passed: ${signoff.conditions_passed}`);

    if (signoff.condition_failures) {
      console.log('  Failures:');
      signoff.condition_failures.forEach(f => {
        console.log(`    - ${f.condition}: ${f.reason}`);
      });
    }
  });
}
```

**CLI Usage**:
```bash
node .claude/tools/signoff-validator.mjs \
  --workflow-id wf-123 \
  --workflow fullstack \
  --task "Add authentication"
```

## Configuration Files

### plan-review-matrix.json

**Location**: `.claude/context/plan-review-matrix.json`

Defines which agents review plans based on task type and complexity.

**Structure**:
```json
{
  "taskTypes": {
    "SECURITY": {
      "required": ["security-architect", "compliance-auditor"],
      "optional": ["code-reviewer", "architect"],
      "minimum_score": 9,
      "blocking_threshold": 6
    }
  },
  "complexityModifiers": {
    "critical": {
      "score_modifier": 2,
      "reduce_required_reviewers": 0
    }
  },
  "workflowModifiers": {
    "incident": {
      "reduce_required_reviewers": 0,
      "skip_optional": true,
      "minimum_score_override": 9
    }
  }
}
```

### signoff-matrix.json

**Location**: `.claude/context/signoff-matrix.json`

Defines signoff requirements for each workflow.

**Structure**:
```json
{
  "workflows": {
    "fullstack": {
      "required_signoffs": [
        {
          "type": "quality_signoff",
          "artifact": "test-results.json",
          "schema": ".claude/schemas/test_results.schema.json",
          "agents": ["qa"],
          "conditions": {
            "test_coverage": ">=80%",
            "passing_tests": "100%",
            "critical_bugs": 0
          }
        }
      ],
      "conditional_signoffs": [
        {
          "type": "security_signoff",
          "artifact": "security-review.json",
          "schema": ".claude/schemas/security_review.schema.json",
          "agents": ["security-architect"],
          "trigger_keywords": ["auth", "encryption", "security"],
          "conditions": {
            "security_score": ">=8",
            "vulnerabilities": 0
          }
        }
      ]
    }
  }
}
```

### security-triggers-v2.json

**Location**: `.claude/context/security-triggers-v2.json`

Enhanced security trigger categorization with priority escalation.

**Structure**:
```json
{
  "categories": {
    "authentication": {
      "keywords": ["login", "signup", "password", "auth", "oauth", "jwt"],
      "priority": "critical",
      "required_agents": ["security-architect"],
      "recommended_agents": ["compliance-auditor"]
    }
  },
  "escalationRules": {
    "critical": {
      "blocking": true,
      "require_signoff": true,
      "notify": ["security-architect", "compliance-auditor"],
      "max_response_time_hours": 4
    }
  }
}
```

## Integration with agent-router.mjs

The `agent-router.mjs` module has been updated to include:

1. **`determinePlanReviewers(task, taskType, workflow, reviewMatrix)`**
   - Determines which agents should review a plan
   - Returns reviewer requirements

2. **`determineSignoffRequirements(workflow, task, signoffMatrix)`**
   - Determines required and conditional signoffs
   - Returns signoff requirements

3. **`detectEnhancedSecurityTriggers(task, securityTriggersV2)`**
   - Detects security triggers with categorization
   - Returns security trigger information

**Updated `selectAgents()` result**:
```javascript
{
  taskType: "SECURITY",
  complexity: "complex",
  primary: "security-architect",
  // ... existing fields ...

  // NEW FIELDS:
  planReviewers: {
    required: ["security-architect", "compliance-auditor"],
    optional: ["code-reviewer", "architect"],
    minimum_score: 9,
    blocking_threshold: 6
  },
  signoffRequirements: {
    required: ["quality_signoff", "code_review_signoff"],
    conditional: ["security_signoff"],
    agents: ["qa", "code-reviewer", "security-architect"]
  },
  securityTriggers: {
    categories: ["authentication", "secrets_management"],
    agents: ["security-architect"],
    recommended_agents: ["compliance-auditor", "devops"],
    priority: "critical",
    triggered: true
  }
}
```

## Example Workflow

Here's a complete example of using these tools in a workflow:

```javascript
import { selectAgents } from '.claude/tools/agent-router.mjs';
import { runPlanReviewGate, aggregateResults } from '.claude/tools/plan-review-gate.mjs';
import { validateWorkflowSignoffs } from '.claude/tools/signoff-validator.mjs';

// Step 1: Route task and get requirements
const routing = await selectAgents("Add JWT authentication");

console.log('Task Type:', routing.taskType);
console.log('Workflow:', routing.workflow);

// Step 2: Check security triggers
if (routing.securityTriggers.triggered) {
  console.log('⚠️  Security categories:', routing.securityTriggers.categories);
  console.log('⚠️  Priority:', routing.securityTriggers.priority);
}

// Step 3: Plan review gate
const planGate = await runPlanReviewGate(
  '.claude/context/artifacts/plan.json',
  'wf-123',
  routing.securityTriggers.categories
);

console.log('Plan reviewers:', planGate.reviewers.required);

// Step 4: Aggregate plan review results
const planReviews = [
  { reviewer: 'security-architect', score: 9, required: true, issues: [] },
  { reviewer: 'compliance-auditor', score: 8, required: true, issues: [] }
];

const planResult = aggregateResults(planReviews, {
  score_range: [0, 10],
  aggregation: 'weighted_average',
  weights: { required: 0.7, optional: 0.3 },
  blocking_behavior: 'any_reviewer_below_threshold_blocks'
});

if (!planResult.passed) {
  console.log('❌ Plan review failed:', planResult.summary);
  process.exit(1);
}

console.log('✅ Plan review passed with score:', planResult.overall_score);

// Step 5: Validate signoffs after workflow completion
const signoffResult = await validateWorkflowSignoffs(
  'wf-123',
  routing.workflow,
  "Add JWT authentication"
);

if (!signoffResult.valid) {
  console.log('❌ Signoff validation failed');
  signoffResult.signoffs.filter(s => !s.valid).forEach(s => {
    console.log(`  - ${s.type}: ${s.error || 'Conditions not met'}`);
  });
  process.exit(1);
}

console.log('✅ All signoffs passed!');
```

## Testing

Run the test suite for these tools:

```bash
# Test agent-router with enhanced features
node .claude/tools/agent-router.mjs \
  --task "Add user authentication with JWT tokens" \
  --json

# Test plan review gate
node .claude/tools/plan-review-gate.mjs \
  --plan .claude/context/artifacts/plan.json \
  --workflow-id test-wf-123 \
  --keywords "auth,security"

# Test signoff validator
node .claude/tools/signoff-validator.mjs \
  --workflow-id test-wf-123 \
  --workflow fullstack \
  --task "Add authentication"
```

## Dependencies

The signoff-validator requires `ajv` for JSON schema validation:

```bash
npm install ajv
# or
pnpm add ajv
```

All other tools use only Node.js built-in modules.

## Next Steps

To complete the full agent integration fix:

1. **Phase 1**: Create master-orchestrator.md agent definition
2. **Phase 2**: Update task-classifier.mjs with enhanced classification
3. **Phase 4**: Create agent-spawner.mjs for Task tool coordination
4. **Phase 5**: Create plan-rater.mjs using response-rater skill
5. **Phase 7**: Update Master Orchestrator to use all new tools

See `.claude/docs/PHASE-3-6-IMPLEMENTATION.md` for detailed implementation notes.
