<workflow_overview>
Workflow Guide - Explains how to use workflows to coordinate multiple agents for complex tasks.
</workflow_overview>

<instructions>
<workflow_selection>
## Available Workflows

**Note**: All workflows now start with the **Planner agent** (Step 0) to create comprehensive plans before execution. The Planner coordinates with specialists and generates validated plans that guide subsequent steps.

### Implementation Status

Below are all available workflows with their implementation status:

| Workflow                  | Status         | File                             | Purpose                                        |
| ------------------------- | -------------- | -------------------------------- | ---------------------------------------------- |
| Quick Flow                | ✅ Implemented | `quick-flow.yaml`                | Bugfix/hotfix/small change                     |
| Full Stack Flow           | ✅ Implemented | `greenfield-fullstack.yaml`      | New features/greenfield projects               |
| Code Quality Flow         | ✅ Implemented | `code-quality-flow.yaml`         | Code health/review/refactor                    |
| Performance Flow          | ✅ Implemented | `performance-flow.yaml`          | Perf tuning/SLI/SLO                            |
| AI System Flow            | ✅ Implemented | `ai-system-flow.yaml`            | LLM/AI feature development                     |
| Mobile Flow               | ✅ Implemented | `mobile-flow.yaml`               | Mobile feature work                            |
| Incident Flow             | ✅ Implemented | `incident-flow.yaml`             | Reliability/incident response                  |
| UI Perfection Loop        | ✅ Implemented | `ui-perfection-loop.yaml`        | Iterative UI quality improvement (95%+ target) |
| Browser Testing Flow      | ✅ Implemented | `browser-testing-flow.yaml`      | Browser-based UI testing with Chrome DevTools  |
| Legacy Modernization Flow | ✅ Implemented | `legacy-modernization-flow.yaml` | Modernize legacy systems                       |
| Brownfield Full Stack     | ✅ Implemented | `brownfield-fullstack.yaml`      | Add features to existing projects              |
| Enterprise Track          | ✅ Implemented | `enterprise-track.yaml`          | Enterprise-grade deployments                   |
| Automated Enterprise Flow | ✅ Implemented | `automated-enterprise-flow.yaml` | Full automation for enterprise projects        |
| BMAD Greenfield           | ✅ Implemented | `bmad-greenfield-standard.yaml`  | Greenfield with BMAD patterns                  |

### Workflow Details

- **Quick Flow**: Bugfix/hotfix/small change. Agents: **planner** → developer → qa. Outputs: plan + dev change + basic validation. **Templates**: Uses plan template from `.claude/templates/plan-template.md` for planning phase.
- **Full Stack Flow**: New features/greenfield. Agents: **planner** → analyst → pm → ux → architect → developer → qa. Outputs: plan + brief/PRD/UX/arch/test plan. **Templates**:
  - Planning: `.claude/templates/plan-template.md`
  - Project Brief: `.claude/templates/project-brief.md`
  - PRD: `.claude/templates/prd.md`
  - UX Spec: `.claude/templates/ui-spec.md`
  - Architecture: `.claude/templates/architecture.md`
  - Test Plan: `.claude/templates/test-plan.md`
- **Code Quality Flow**: Code health/review/refactor. Agents: **planner** → code-reviewer → refactoring-specialist → compliance-auditor → qa. **Templates**:
  - Planning: `.claude/templates/plan-template.md`
  - Code Review: `.claude/templates/code-review-report.md`
  - Refactoring: `.claude/templates/refactor-plan.md`
  - Compliance: `.claude/templates/compliance-report.md`
- **Performance Flow**: Perf tuning/SLI/SLO. Agents: **planner** → performance-engineer → architect → developer → qa. **Templates**:
  - Planning: `.claude/templates/plan-template.md`
  - Performance Plan: `.claude/templates/performance-plan.md`
- **AI System Flow**: LLM/AI features. Agents: **planner** → model-orchestrator → llm-architect → api-designer → developer → qa. **Templates**:
  - Planning: `.claude/templates/plan-template.md`
  - LLM Architecture: `.claude/templates/llm-architecture.md`
- **Mobile Flow**: Mobile feature work. Agents: **planner** → mobile-developer → ux-expert → developer → qa. **Templates**:
  - Planning: `.claude/templates/plan-template.md`
  - UI Spec: `.claude/templates/ui-spec.md` (reused from Full Stack Flow)
- **UI Perfection Loop**: Iterative UI quality improvement (95%+ target). Agents: **planner** → ux-expert + accessibility-expert (parallel) → model-orchestrator (Gemini validation) → developer + mobile-developer → qa → orchestrator (iteration check). Iterates until score >= 95 or max iterations (5). Outputs: plan + `ui-audit-report.json`, `grading-score.json`, `implementation-manifest.json`, `verification-report.json`, `final-score.json`. **Templates**: Uses plan template and UI spec templates. See `.claude/docs/UI_PERFECTION_TOOLS.md` for tool integration.
- **Incident Flow**: Reliability/incident response. Agents: **planner** → incident-responder → devops → security-architect → qa. **Templates**:
  - Planning: `.claude/templates/plan-template.md`
  - Incident Report: `.claude/templates/incident-report.md`

## Planner Integration

All workflows now follow a **plan-first** approach with mandatory quality gates:

### Step 0: Planning Phase (NEW)

- **Agent**: planner
- **Purpose**: Create comprehensive plan before execution
- **Process**:
  1. Planner analyzes requirements
  2. Coordinates with relevant specialists (Analyst, PM, Architect, etc.)
  3. Generates structured plan with steps, dependencies, risks
  4. Validates plan completeness and feasibility
- **Outputs**:
  - `plan-<id>.md` - Plan markdown document
  - `plan-<id>.json` - Structured plan data
  - Plan summary

### Step 0.1: Plan Rating Gate (NEW - MANDATORY)

**CRITICAL**: All plans MUST be rated before workflow execution proceeds.

#### Purpose

The Plan Rating Gate ensures plan quality through automated scoring using the response-rater skill. This gate validates that plans meet minimum quality standards before agents begin implementation work, preventing rework and scope creep.

#### Process Flow

```
Step 0 (Planning)
    ↓
Step 0.1 (Rating Gate) ← response-rater skill
    ↓
Score >= 7/10?
    ├─→ YES → Proceed to Step 1
    └─→ NO  → Return to Planner with feedback
              Planner revises plan
              Re-run Step 0.1 until score >= 7/10
              (Max 3 attempts, then escalate to human review)
```

#### Rating Rubric

The response-rater skill uses a **5-dimensional rubric** to evaluate plans:

| Dimension           | Description                                              | Evaluation Criteria                                                   |
| ------------------- | -------------------------------------------------------- | --------------------------------------------------------------------- |
| **Completeness**    | Does the plan cover all required aspects?                | All steps defined, dependencies identified, success criteria stated   |
| **Feasibility**     | Is the plan realistic and achievable?                    | Resources identified, timeline reasonable, risks acknowledged         |
| **Risk Mitigation** | Are potential risks identified and addressed?            | Risks documented, mitigation strategies provided, fallbacks defined   |
| **Agent Coverage**  | Are the right agents assigned to each step?              | Specialized agents selected, supporting agents included, no gaps      |
| **Integration**     | Does the plan integrate with existing systems/workflows? | Dependencies on existing systems documented, integration points clear |

**Scoring**: Each dimension scored 1-10, average becomes overall score (minimum: 7/10 to pass)

#### Rating Artifacts

**Location**: `.claude/context/runs/<run_id>/plans/<plan_id>-rating.json`

**Structure**:

```json
{
  "plan_id": "plan-web-app-2025-01-17",
  "workflow_id": "workflow-web-app-2025-01-17",
  "rating_timestamp": "2025-01-17T10:30:00Z",
  "overall_score": 8.2,
  "rubric_scores": {
    "completeness": 8,
    "feasibility": 8,
    "risk_mitigation": 7,
    "agent_coverage": 9,
    "integration": 8
  },
  "feedback": "Strong plan with clear steps and appropriate agent assignments. Consider more detail on risk mitigation strategies for deployment phase.",
  "passed": true,
  "status": "pass",
  "attempt": 1,
  "max_attempts": 3,
  "rewritten_plan": null,
  "rating_agent": "response-rater",
  "skill_version": "1.0"
}
```

**Key Fields**:

- `overall_score`: Average of all rubric scores (0-10)
- `rubric_scores`: Individual dimension scores
- `feedback`: Constructive feedback from response-rater
- `passed`: Boolean indicating if score >= 7/10
- `attempt`: Which attempt number this is (1-3)
- `rewritten_plan`: If planner revises, this contains the updated plan (optional)

#### Execution Steps

**Step 1: Plan Rating**

```bash
# Invoke response-rater skill on the plan
# Input: plan-<id>.md and plan-<id>.json
# Output: <plan_id>-rating.json
node .claude/tools/enforcement-gate.mjs validate-plan \
  --run-id <id> \
  --plan-id <plan_id>
```

**Step 2: Evaluate Result**

- If score >= 7/10: Rating passes, proceed to workflow step 1
- If score < 7/10: Rating fails, return to Planner

**Step 3: Handle Failures**

- **Attempt 1-2**: Planner revises plan based on feedback, resubmit for rating
- **Attempt 3+**: Escalate to human review (orchestrator/PM) for approval

#### Retry Logic

**Max Attempts**: 3 attempts per plan

**Retry Conditions**:

1. **After Attempt 1**: If score < 7, return plan to Planner with feedback
   - Planner must address feedback in rubric dimensions where score was low
   - Example: If "completeness" scored 5, planner adds missing steps

2. **After Attempt 2**: If still < 7, return again with additional context
   - Provide comparison to successful plans
   - Highlight specific areas needing improvement

3. **After Attempt 3**: If still < 7, escalate to human review
   - Orchestrator or PM reviews plan manually
   - Human decision: approve plan as-is OR request major revisions
   - Document justification for override

#### Rubric Location

The standardized plan rating rubric is defined in:

- **File**: `.claude/context/artifacts/standard-plan-rubric.json`
- **Contains**: Rating dimensions, scoring scales, evaluation criteria, examples
- **Updated**: When plan evaluation standards change (rare)

#### Distinguishing Plan Review from Plan Rating

**Plan Review Gate** (parallel review by multiple agents):

- When: Some workflows include architectural review by specialist agents
- Who: Architect, security-architect, or other specialists review in parallel
- Output: Approval/rejection from each reviewer
- Purpose: Specialized domain validation

**Plan Rating Gate** (automated scoring):

- When: Every workflow, mandatory, before step 1
- Who: response-rater skill (automated)
- Output: Numeric score (0-10) with dimensional feedback
- Purpose: Quality assurance and completeness validation

**Both are used together**:

1. Plan Rating Gate: Ensures minimum quality (7/10)
2. Plan Review Gate (optional): Gets specialist approval on design decisions

#### Integration with Orchestrator

The Orchestrator is responsible for:

1. After Planner produces plan → Invoke Step 0.1 (Plan Rating Gate)
2. Rate plan using response-rater skill
3. Record rating in artifact registry
4. If score >= 7: Proceed to workflow step 1
5. If score < 7: Return to Planner with feedback (max 3 times)
6. Log all rating attempts in reasoning file

### Subsequent Steps

All workflow steps (1-N) now execute according to the plan created in Step 0:

- Steps reference the plan for context
- Agents follow plan steps
- Progress is tracked against plan
- Plan is updated as work progresses
- **Note**: Execution only begins AFTER plan passes Step 0.1 rating gate

## Automatic Workflow Selection

Workflows are automatically selected based on user prompt keywords. The system:

1. **Extract Keywords**: System extracts keywords from user prompt
2. **Match Workflows**: Keywords matched against `workflow_selection` in `config.yaml`
3. **Count Matches**: Count how many keywords match each workflow
4. **Priority Selection**: Among matching workflows, select the one with **lowest priority number** (0 = highest priority)
5. **Default Fallback**: If no matches, use `default_workflow` from `intelligent_routing` (typically `fullstack`)
6. **Execute**: Load workflow YAML and execute steps sequentially

**Example**: "Build a new authentication feature from scratch"

- Keywords detected: "new", "from scratch"
- Matches: `fullstack` workflow (keywords: "new project", "from scratch", "greenfield")
- Priority: 2 (medium priority)
- Selected: `fullstack` workflow
- Executes: Planner (Step 0) → Full Stack Flow with all agents (Steps 1-N)

**See Also**: For a detailed visual flow diagram, see `.claude/CLAUDE.md` section "Workflow Execution Flow"

## Running Customer User Journeys (CUJs)

Customer User Journeys (CUJs) represent complete user workflows from initial request to successful completion. They provide a fast, deterministic way to execute common tasks without relying on semantic routing.

### How to Reference a CUJ

CUJs can be referenced in prompts using any of these syntax styles:

**Slash Command Format**:

```
/cuj-005
/cuj-013
```

**Natural Language Format**:

```
"Run CUJ-005"
"Execute CUJ-013"
"Test CUJ-027 for recovery"
```

**Standalone Reference**:

```
CUJ-005
CUJ-022
```

### How the Orchestrator Uses CUJ-INDEX.md

When the orchestrator detects a CUJ reference in your prompt, it follows this process:

1. **CUJ Detection**: Identifies CUJ pattern (e.g., `CUJ-005`) in the user prompt
2. **Mapping Lookup**: Looks up the CUJ in the Run CUJ Mapping table in `.claude/docs/cujs/CUJ-INDEX.md`
3. **Determine Execution Mode**: Checks the execution mode for that CUJ:
   - `workflow`: Load and execute specified workflow file
   - `skill`: Invoke the primary skill directly
   - `manual`: Use semantic routing (for CUJs without automated execution)
4. **Route & Execute**: Routes to the appropriate workflow file or skill
5. **Fallback**: If CUJ not found, falls back to semantic routing

**Example Mapping Lookup**:

- CUJ-005 → Execution Mode: `workflow` → File: `.claude/workflows/greenfield-fullstack.yaml`
- CUJ-013 → Execution Mode: `skill` → Skill: `code-reviewer`
- CUJ-042 → Execution Mode: `manual` → Use semantic routing

### Workflow-Based vs. Skill-Only CUJs

CUJs are executed in two different modes:

#### Workflow-Based CUJs

These CUJs use a full workflow with multiple agents coordinating across steps:

```
CUJ-005: Greenfield Project Planning
├── Step 0: Planner (plan creation)
├── Step 1: Analyst (project brief)
├── Step 2: PM (product requirements)
├── Step 3: UX Expert (interface spec)
├── Step 4: Architect (system architecture)
├── Step 5: Database Architect (schema design)
├── Step 6: QA (test plan)
└── Step 7: Developer (implementation)

Execution: Load greenfield-fullstack.yaml workflow and execute all steps
```

**Common Workflow-Based CUJs**:

- CUJ-004: New Feature Planning
- CUJ-005: Greenfield Project Planning
- CUJ-007: Technical Debt Planning
- CUJ-011: Bug Fix Workflow
- CUJ-019: Performance Optimization
- CUJ-022: AI System Development
- CUJ-024: Incident Response

#### Skill-Only CUJs

These CUJs invoke a single skill directly without a full workflow:

```
CUJ-013: Code Review
├── Input: Code files to review
├── Skill: code-reviewer
└── Output: Code review report

Execution: Invoke code-reviewer skill directly
```

**Common Skill-Only CUJs**:

- CUJ-002: Rule Configuration (rule-selector skill)
- CUJ-009: Component Scaffolding (scaffolder skill)
- CUJ-013: Code Review (code-reviewer skill)
- CUJ-014: Rule Compliance Audit (rule-auditor skill)
- CUJ-015: Test Generation (test-generator skill)
- CUJ-016: API Documentation (doc-generator skill)
- CUJ-017: Module Documentation (claude-md-generator skill)
- CUJ-027: Workflow Recovery (recovery skill)

### Validating a CUJ Without Execution (Dry-Run)

You can validate a CUJ's workflow without executing it using the `--cuj-simulation` flag:

```bash
# Validate CUJ-005 workflow without executing
node .claude/tools/workflow_runner.js \
  --cuj CUJ-005 \
  --cuj-simulation

# Validates:
# ✓ CUJ mapping exists in CUJ-INDEX.md
# ✓ Workflow file exists at specified path
# ✓ All workflow steps have required agents
# ✓ All artifact dependencies are valid
# ✓ Validation schemas exist
# Outputs: CUJ simulation report (no workflow execution)
```

**What Dry-Run Validates**:

- CUJ exists in CUJ-INDEX.md
- Execution mode is correctly specified
- For workflows: All steps, agents, and schemas exist
- For skills: Skill is available and properly configured
- All artifact dependencies are resolvable
- No execution of steps or skill invocation

**Use Cases**:

- Verify CUJ configuration before running
- Check for missing workflows or skills
- Validate artifact dependency chains
- Ensure all agents exist for workflow-based CUJs

### Examples

#### Example 1: Run CUJ-005 (Greenfield Project)

**User Prompt**:

```
"Run CUJ-005 to plan the new mobile platform"
```

**Orchestrator Processing**:

1. Detects CUJ-005 in prompt
2. Looks up CUJ-005 in CUJ-INDEX.md
3. Finds: Execution Mode = `workflow`, File = `.claude/workflows/greenfield-fullstack.yaml`
4. Loads greenfield-fullstack.yaml
5. Executes all workflow steps (Planner → Analyst → PM → UX → Architect → DB → QA → Developer)

**Output**:

- plan-{id}.md and plan-{id}.json
- project-brief.json
- prd.json
- ui-spec.json
- system-architecture.json
- schema-design.json
- test-plan.json
- Implementation artifacts

#### Example 2: Run CUJ-013 (Code Review)

**User Prompt**:

```
"/cuj-013"
```

**Orchestrator Processing**:

1. Detects CUJ-013 from slash command
2. Looks up CUJ-013 in CUJ-INDEX.md
3. Finds: Execution Mode = `skill`, Skill = `code-reviewer`
4. Invokes code-reviewer skill directly
5. Skill analyzes code and generates review

**Output**:

- Code review report with findings

#### Example 3: Dry-Run Validation

**User Prompt**:

```
"Validate CUJ-022 without running it"
```

**Command**:

```bash
node .claude/tools/workflow_runner.js \
  --cuj CUJ-022 \
  --cuj-simulation
```

**Output**:

```
CUJ-022 Simulation Report:
✓ CUJ found in CUJ-INDEX.md
✓ Execution mode: workflow
✓ Workflow file: .claude/workflows/ai-system-flow.yaml
✓ File exists at path
✓ All steps present (0-6)
✓ All agents configured
✓ All schemas valid
✓ Artifact dependencies valid

Ready to execute: "Run CUJ-022"
```

### Benefits of Using CUJs

- **Fast**: Direct routing without semantic analysis overhead
- **Deterministic**: Pre-validated workflows ensure consistent execution
- **Traceable**: CUJ ID tracked throughout execution for debugging
- **User-Friendly**: Multiple syntax options (slash commands, natural language, references)
- **Discoverable**: See `.claude/docs/cujs/CUJ-INDEX.md` for all available CUJs

### Complete CUJ Reference

See `.claude/docs/cujs/CUJ-INDEX.md` for:

- Complete list of all 51+ CUJs
- Quick reference table with triggers and agents
- Run CUJ Mapping showing execution modes
- Detailed documentation for each CUJ

### Finding the Right CUJ for Your Task

| Task                  | CUJ     | Trigger        |
| --------------------- | ------- | -------------- |
| Start new project     | CUJ-005 | "Run CUJ-005"  |
| Add new feature       | CUJ-004 | "Run CUJ-004"  |
| Fix bugs quickly      | CUJ-011 | "/cuj-011"     |
| Review code           | CUJ-013 | "/cuj-013"     |
| Audit rule compliance | CUJ-014 | "/cuj-014"     |
| Generate tests        | CUJ-015 | "Run CUJ-015"  |
| Document API          | CUJ-016 | "Run CUJ-016"  |
| Optimize performance  | CUJ-019 | "/performance" |
| Handle incidents      | CUJ-024 | "/incident"    |
| Plan large project    | CUJ-026 | "Run CUJ-026"  |
| Recover from error    | CUJ-027 | "Run CUJ-027"  |
| Mobile development    | CUJ-021 | "/mobile"      |
| AI system development | CUJ-022 | "/ai-system"   |

See `.claude/docs/cujs/CUJ-INDEX.md` for the complete list of 51+ CUJs.

## Executing Skill-Only CUJs

Skill-only CUJs invoke a single skill directly without a full workflow. These CUJs are faster than workflow-based CUJs because they skip the planning phase and multi-agent coordination.

### How Skill-Only CUJs Work

**Execution Flow**:

1. **CUJ Detection**: Orchestrator detects CUJ reference in prompt
2. **Mapping Lookup**: Looks up execution mode in CUJ-INDEX.md
3. **Skill Invocation**: Directly invokes the skill without workflow
4. **Output**: Skill produces result directly

**Comparison to Workflow-Based CUJs**:

| Aspect             | Skill-Only CUJs         | Workflow-Based CUJs             |
| ------------------ | ----------------------- | ------------------------------- |
| Execution          | Direct skill invocation | Multi-step workflow with agents |
| Speed              | Fast (seconds)          | Moderate (minutes)              |
| Planning           | No planning phase       | Includes Planner step           |
| Agent Coordination | Single skill, no agents | Multiple agents coordinating    |
| Use Case           | Simple, focused tasks   | Complex, multi-faceted projects |
| Complexity         | Low                     | High                            |

### Common Skill-Only CUJs

| CUJ     | Skill               | Trigger                           | Input                                       | Output                                    |
| ------- | ------------------- | --------------------------------- | ------------------------------------------- | ----------------------------------------- |
| CUJ-002 | rule-selector       | `/select-rules`                   | Project directory or tech stack description | Updated manifest.yaml, rule config report |
| CUJ-009 | scaffolder          | `/scaffold ComponentName`         | Component name, type                        | Generated component boilerplate           |
| CUJ-013 | code-reviewer       | `/review` or `/review src/`       | File/directory path                         | Code review report with issues            |
| CUJ-014 | rule-auditor        | `/audit`                          | File/directory path                         | Compliance report, rule violations        |
| CUJ-015 | test-generator      | `Generate tests for X`            | Code/feature to test                        | Generated test files/test plan            |
| CUJ-016 | doc-generator       | `Document API X`                  | Code/API to document                        | API documentation                         |
| CUJ-017 | claude-md-generator | `Generate claude.md for module X` | Module path                                 | Generated claude.md file                  |
| CUJ-023 | dependency-analyzer | `Check dependencies`              | Project directory                           | Dependency audit report                   |
| CUJ-027 | recovery            | `Recover workflow`                | Workflow context                            | Recovery plan and state restoration       |

### Skill-Only CUJ Execution Examples

#### Example 1: CUJ-002 - Rule Configuration

**When to Use**: Starting a new project or when tech stack changes.

**User Prompt**:

```
/select-rules
```

**What Happens**:

1. Orchestrator detects CUJ-002
2. Looks up in CUJ-INDEX.md: execution mode = `skill`, skill = `rule-selector`
3. Invokes `rule-selector` skill directly
4. Skill scans project for `package.json`, `requirements.txt`, etc.
5. Detects: Next.js, TypeScript, React, Node.js
6. Loads rule index and finds matching rules
7. Generates/updates `manifest.yaml`

**Expected Output**:

```
Rule Configuration Complete:
✅ Detected technologies: Next.js, React, TypeScript, Node.js
✅ Selected 15 relevant rules from rule-library
✅ Excluded 8 irrelevant rules (Python, Rust, etc.)
✅ Updated manifest.yaml with new rules
✅ Rule hierarchy configured

Active Rules:
- TECH_STACK_NEXTJS.md
- LANG_TYPESCRIPT_GENERAL.md
- TOOL_JEST_MASTER.md
- PROTOCOL_ENGINEERING.md
```

**Execution Time**: ~2-5 seconds

---

#### Example 2: CUJ-013 - Code Review

**When to Use**: Before merging code, after implementing a feature, or for security reviews.

**User Prompt**:

```
/review src/components/auth
```

**What Happens**:

1. Orchestrator detects CUJ-013
2. Looks up in CUJ-INDEX.md: execution mode = `skill`, skill = `code-reviewer`
3. Invokes `code-reviewer` skill directly
4. Skill analyzes all files in `src/components/auth/`
5. Checks against active rules
6. Identifies issues: naming conventions, security concerns, performance problems
7. Generates comprehensive review report

**Expected Output**:

```json
{
  "summary": "Code review completed: 3 critical issues, 7 high-priority issues",
  "files_reviewed": ["Login.tsx", "Logout.tsx", "useAuth.ts"],
  "issues": [
    {
      "file": "Login.tsx",
      "line": 45,
      "severity": "critical",
      "issue": "Unencrypted password logging to console",
      "rule_violated": "SECURITY_SECRETS_MANAGEMENT",
      "suggested_fix": "Remove console.log(password) before production"
    },
    {
      "file": "useAuth.ts",
      "line": 12,
      "severity": "high",
      "issue": "Missing error handling for failed auth",
      "rule_violated": "ERROR_HANDLING_PROTOCOL",
      "suggested_fix": "Add try-catch block with error state management"
    }
  ],
  "security_issues": 2,
  "performance_issues": 1,
  "recommendations": ["Add unit tests", "Document auth flow", "Use secrets manager"]
}
```

**Execution Time**: ~10-30 seconds (depends on code size)

---

#### Example 3: CUJ-017 - Module Documentation

**When to Use**: Creating documentation for a new module or updating claude.md files.

**User Prompt**:

```
Generate claude.md for src/services/StorageService
```

**What Happens**:

1. Orchestrator detects CUJ-017
2. Looks up in CUJ-INDEX.md: execution mode = `skill`, skill = `claude-md-generator`
3. Invokes `claude-md-generator` skill directly
4. Skill reads `src/services/StorageService/` directory
5. Extracts patterns: exports, key functions, dependencies
6. Reads parent `claude.md` (if exists) for context
7. Generates `claude.md` with:
   - Purpose/overview
   - Key functions and classes
   - Dependencies
   - Usage examples
   - Patterns and conventions

**Expected Output** (generates `src/services/StorageService/claude.md`):

````markdown
# StorageService

## Purpose

Handles cloud storage operations for file uploads/downloads with encryption and CDN integration.

## Key Functions

### uploadFile(bucket, file)

Uploads file to cloud storage with automatic encryption.

- Returns: Promise<string> - CDN URL of uploaded file
- Throws: StorageError if upload fails

### downloadFile(url)

Downloads file from CDN with decryption.

- Returns: Promise<Buffer> - Decrypted file content
- Caches locally for performance

## Dependencies

- @google-cloud/storage (cloud operations)
- crypto (file encryption)
- axios (HTTP requests)

## Usage Examples

```typescript
const service = new StorageService();
const url = await service.uploadFile('my-bucket', file);
```
````

## Patterns

- Uses dependency injection for cloud client
- Implements retry logic with exponential backoff
- Caches frequently accessed files

## Testing

- Unit tests in **tests**/StorageService.test.ts
- Mocks cloud storage for local testing

```

**Execution Time**: ~5-10 seconds

---

#### Example 4: CUJ-015 - Test Generation

**When to Use**: Generating comprehensive test coverage for new code.

**User Prompt**:
```

Generate tests for src/utils/validation.ts

````

**What Happens**:
1. Orchestrator detects CUJ-015
2. Looks up in CUJ-INDEX.md: execution mode = `skill`, skill = `test-generator`
3. Invokes `test-generator` skill directly
4. Skill analyzes `src/utils/validation.ts`
5. Identifies functions: `validateEmail`, `validatePhone`, `validatePassword`
6. Generates tests covering:
   - Happy paths (valid inputs)
   - Edge cases (boundary values)
   - Error cases (invalid inputs)
   - Security considerations
7. Creates test file with 100%+ coverage

**Expected Output** (generates `src/utils/__tests__/validation.test.ts`):
```typescript
describe('validation', () => {
  describe('validateEmail', () => {
    it('should accept valid email addresses', () => {
      expect(validateEmail('user@example.com')).toBe(true);
      expect(validateEmail('user.name+tag@example.co.uk')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(validateEmail('invalid.email')).toBe(false);
      expect(validateEmail('user@')).toBe(false);
      expect(validateEmail('')).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(validateEmail('User@Example.COM')).toBe(true);
    });
  });

  describe('validatePassword', () => {
    it('should require minimum 8 characters', () => {
      expect(validatePassword('short')).toBe(false);
      expect(validatePassword('12345678')).toBe(true);
    });

    it('should require at least one uppercase letter', () => {
      expect(validatePassword('lowercase123')).toBe(false);
      expect(validatePassword('ValidPass123')).toBe(true);
    });
  });
});
````

**Execution Time**: ~15-30 seconds (depends on code complexity)

---

### When to Use Skill-Only vs. Workflow-Based CUJs

**Use Skill-Only CUJs When**:

- Task is focused and single-purpose (review, scaffold, generate docs)
- You need fast results (seconds to minutes)
- No planning or multi-agent coordination needed
- You want direct, deterministic output

**Use Workflow-Based CUJs When**:

- Task is complex and multi-faceted (new feature, architecture)
- You need planning, design, and validation
- Multiple agents need to collaborate
- You want comprehensive documentation and oversight

### Combining Skill-Only and Workflow-Based CUJs

You can combine them in a workflow:

1. **Use CUJ-004** (workflow) to plan a new feature
2. **Use CUJ-009** (skill) to scaffold components
3. **Use CUJ-015** (skill) to generate tests
4. **Use CUJ-013** (skill) to review code
5. **Use CUJ-011** (workflow) to finalize and validate

This hybrid approach gives you the benefits of both: planning + speed for specific tasks.

## Semantic Routing (NEW)

The system now uses **semantic routing** to intelligently classify user intent before selecting workflows, replacing brittle keyword matching.

### How It Works

1. **Router Agent Classification**: Lightweight router agent analyzes user prompt
2. **Intent Detection**: Classifies intent (web_app, script, analysis, infrastructure, mobile, ai_system)
3. **Complexity Assessment**: Determines complexity (high, medium, low)
4. **Cloud Provider Detection**: Identifies cloud provider (gcp, aws, azure, null)
5. **Workflow Mapping**: Maps classification to appropriate workflow file
6. **Fallback**: Falls back to keyword matching if confidence < 0.8

### Benefits

- **Prevents False Positives**: "enterprise python script" correctly routes to script workflow, not fullstack
- **Context-Aware**: Understands intent beyond simple keywords
- **Cloud-Aware**: Detects cloud provider requirements automatically

### Example

**Input**: "Write an enterprise-grade python script to backup my laptop"

**Router Classification**:

```json
{
  "intent": "script",
  "complexity": "low",
  "cloud_provider": null,
  "workflow_selection": ".claude/workflows/script-flow.yaml",
  "confidence": 0.9,
  "reasoning": "Despite 'enterprise-grade', this is a script task, not a full application"
}
```

**Result**: Routes to script workflow, not fullstack workflow (which would be incorrect)

## Infrastructure-First Approach (NEW)

**CRITICAL**: Infrastructure resources are now defined **before** implementation to prevent the "Infrastructure Paradox."

### The Problem

Previously, developers wrote code before infrastructure resources were defined, leading to:

- Coding against hypothetical resources
- Rework when actual resource names are determined
- Missing connection strings and environment variables

### The Solution

**Step 4.5: Infrastructure Resource Definition** (NEW)

Immediately after System Architecture (Step 4), the DevOps agent:

1. Converts logical architecture to concrete resources
2. Generates resource names following naming conventions
3. Creates connection strings and environment variables
4. Outputs `infrastructure-config.json` with all concrete details

**Benefits**:

- Developers receive concrete resource names in Step 7
- No rework needed when infrastructure is provisioned
- Environment variables are defined upfront
- Connection strings use actual resource names

### Workflow Integration

**Step 4.5** outputs `infrastructure-config.json` which is used by:

- **Step 5** (Database Architecture): Knows actual database connection details
- **Step 6** (Test Planning): Can plan tests with concrete resource names
- **Step 7** (Implementation): Developer uses actual resource names
- **Step 7.5** (Cloud Integration): Cloud-integrator uses concrete resource names
- **Step 10** (QA): Tests use actual resource configurations
- **Step 11** (Infrastructure Provisioning): Provisions resources defined in Step 4.5

## Emulator-First Development (NEW)

**CRITICAL**: All cloud-connected applications use emulators for local development and testing.

### Why Emulator-First?

1. **No Cloud Costs**: Develop and test without incurring cloud charges
2. **No Credentials Required**: Work without active cloud credentials
3. **Faster Feedback**: Local emulators are faster than cloud API calls
4. **Offline Development**: Work without internet connectivity
5. **Consistent Environment**: Same behavior across all developers

### Implementation

**Developer Agent** (Step 7):

- Uses emulators for local development
- Configures environment variables for emulator endpoints
- Writes code that works with both emulators and production

**Cloud-Integrator Agent** (Step 7.5):

- Implements cloud clients that automatically detect emulators
- Uses `PUBSUB_EMULATOR_HOST`, `DATASTORE_EMULATOR_HOST`, etc.
- Supports both emulator and production modes

**QA Agent** (Step 6, Step 10):

- Creates test plans with emulator strategy
- Tests run against emulators, not live cloud
- Includes emulator setup instructions

### GCP Emulator Setup

```bash
# Pub/Sub Emulator
gcloud components install pubsub-emulator
gcloud beta emulators pubsub start --project=test-project
export PUBSUB_EMULATOR_HOST=localhost:8085

# Datastore Emulator
gcloud components install cloud-datastore-emulator
gcloud beta emulators datastore start --project=test-project
export DATASTORE_EMULATOR_HOST=localhost:8081

# Storage Emulator
# Use fake-gcs-server or gcs-emulator
export STORAGE_EMULATOR_HOST=http://localhost:9023
```

### Docker Compose

Include `docker-compose.dev.yml` for local emulator stack:

```yaml
version: '3.8'
services:
  pubsub-emulator:
    image: gcr.io/google.com/cloudsdktool/cloud-sdk:emulators
    command: gcloud beta emulators pubsub start --host-port=0.0.0.0:8085
    ports:
      - '8085:8085'
```

## Cloud Integrator Agent (NEW)

**Purpose**: Separates cloud integration from business logic implementation.

### The Problem

Previously, the Developer agent handled both:

- Business logic (UI, API routes, features)
- Cloud integration (GCP clients, IAM, authentication)

This caused overload and mixed concerns.

### The Solution

**Step 7: Implementation** (Developer Agent):

- Focuses on business logic, UI, API routes
- Creates interfaces/stubs for cloud services
- Uses cloud services via interfaces

**Step 7.5: Cloud Integration** (Cloud-Integrator Agent):

- Implements GCP/AWS/Azure client libraries
- Configures authentication (ADC, service accounts, IAM)
- Creates cloud service modules (storage, pubsub, database)
- Implements error handling and retry logic

### Workflow Pattern

1. **Developer** (Step 7): Creates business logic and identifies cloud service needs
2. **Developer** (Step 7): Creates interfaces for cloud services (e.g., `interface StorageService`)
3. **Cloud-Integrator** (Step 7.5): Implements actual cloud service clients
4. **Developer**: Uses cloud services in business logic via interfaces

### Example

```typescript
// Developer creates interface (Step 7)
interface StorageService {
  uploadFile(bucket: string, file: File): Promise<string>;
}

// Cloud-Integrator implements (Step 7.5)
// services/gcp-storage.ts
export class GCPStorageService implements StorageService {
  // Implementation using @google-cloud/storage
}

// Developer uses in API route (Step 7)
app.post('/upload', async (req, res) => {
  const storage = new GCPStorageService(); // From cloud-integrator
  const url = await storage.uploadFile('my-bucket', req.file);
  res.json({ url });
});
```

## Workflow ID Resolution

Workflow IDs are used throughout the system to uniquely identify workflow executions and organize artifacts, gates, and reasoning files.

### Template Variable Syntax

Workflow YAML files use `{{workflow_id}}` as a template variable that gets replaced during execution:

```yaml
outputs:
  - plan-{{workflow_id}}.md
  - plan-{{workflow_id}}.json
gate: .claude/context/history/gates/{{workflow_id}}/00-planner.json
```

### Resolution Process

The workflow runner (`workflow_runner.js`) automatically resolves `{{workflow_id}}` placeholders:

1. **Workflow ID Source**:
   - Provided via `--id <workflow-id>` command line argument
   - **Auto-generated** if not provided (format: `workflow-{timestamp}-{random}`)
   - Auto-generated IDs are logged for reference in future steps
   - Always valid format and safe for file paths

2. **Interpolation**:
   - All `{{workflow_id}}` occurrences in output paths are replaced
   - All `{{workflow_id}}` occurrences in gate paths are replaced
   - All `{{workflow_id}}` occurrences in reasoning paths are replaced
   - Validation ensures required variables are resolved before execution

3. **Validation**:
   - If `{{workflow_id}}` is present but not provided, workflow fails with clear error
   - Un-interpolated variables trigger warnings
   - Template variable syntax is validated before execution

### Workflow ID Format

Workflow IDs should follow these conventions:

- Use alphanumeric characters, hyphens, and underscores
- Examples: `web-app-2025-01-17`, `feature-auth-001`, `bugfix-login-123`
- Avoid special characters that might cause path issues

### Usage Examples

**Command Line**:

```bash
# Provide workflow ID explicitly (recommended for production)
node .claude/tools/workflow_runner.js \
  --workflow .claude/workflows/greenfield-fullstack.yaml \
  --step 0 \
  --id web-app-2025-01-17

# Without ID (auto-generates unique ID)
node .claude/tools/workflow_runner.js \
  --workflow .claude/workflows/greenfield-fullstack.yaml \
  --step 0
# Output: 📋 Generated workflow ID: workflow-1705507200000-abc123
#         Use --id workflow-1705507200000-abc123 to reference this workflow in future steps
```

**Generated Paths**:

- With `--id web-app-2025-01-17`:
  - Output: `plan-web-app-2025-01-17.md`
  - Gate: `.claude/context/history/gates/web-app-2025-01-17/00-planner.json`
  - Reasoning: `.claude/context/history/reasoning/web-app-2025-01-17/00-planner.json`

**Error Handling**:

- Workflow IDs are now auto-generated if not provided, so this error should rarely occur
- If it does occur, it indicates an internal error in the workflow runner
- The system will always generate a valid workflow ID before processing steps

### Integration with Shift-Work System

In shift-work orchestration, workflow IDs are preserved across handoffs:

- Handoff packages include workflow ID
- New orchestrator instances continue with same workflow ID
- Artifacts remain accessible using original workflow ID
- Context recovery uses workflow ID to locate plan files

See `.claude/docs/ENTERPRISE_AUTOMATION.md` for shift-work details.
</workflow_selection>

<execution_process>

## Manual Workflow Execution

You can also manually execute workflows using slash commands or by following the execution process.

### Using Slash Commands

```bash
/code-quality    # Execute code quality workflow
/performance     # Execute performance optimization workflow
/ai-system       # Execute AI system development workflow
/mobile          # Execute mobile application workflow
/incident        # Execute incident response workflow
```

### Manual Execution Process

**Step 1: Initialize Workflow Session**

Generate a unique workflow ID and create session directory:

```bash
WORKFLOW_ID=$(date +%s)-$(uuidgen | cut -d'-' -f1)
mkdir -p .claude/context/history/gates/$WORKFLOW_ID
```

**Step 2: Read Workflow YAML**

Load the workflow file to understand the steps:

```bash
# Example: Load fullstack workflow
cat .claude/workflows/greenfield-fullstack.yaml
```

**Step 3: Execute Steps Sequentially**

For each step in the workflow:

1. **Activate Agent**: Load agent definition from `.claude/agents/<agent>.md`
2. **Load Context**: Load agent's context files from `config.yaml`
3. **Prepare Inputs**: Read artifacts from previous steps
4. **Execute Task**: Agent performs work using available tools
5. **Collect Outputs**: Save artifacts to `.claude/context/artifacts/`
6. **Validate**: Run validation if schema is specified

**Example Step Execution**:

```bash
# Step 1: Analyst
# - Loads: .claude/agents/analyst.md
# - Executes: Creates project brief
# - Saves: .claude/context/artifacts/project-brief.json
# - Validates: node .claude/tools/workflow_runner.js --workflow .claude/workflows/greenfield-fullstack.yaml --step 1 --id $WORKFLOW_ID

# Step 2: PM (uses output from Step 1)
# - Loads: .claude/agents/pm.md
# - Inputs: Reads project-brief.json from Step 1
# - Executes: Creates PRD
# - Saves: .claude/context/artifacts/prd.json
# - Validates: node .claude/tools/workflow_runner.js --workflow .claude/workflows/greenfield-fullstack.yaml --step 2 --id $WORKFLOW_ID
```

**Step 4: Validate Each Step**

After each step, validate the output:

```bash
node .claude/tools/workflow_runner.js \
  --workflow .claude/workflows/<workflow-name>.yaml \
  --step <step-number> \
  --id <workflow-id> \
  [--story-id <story-id>] \
  [--epic-id <epic-id>]
```

The validator:

- Loads the step's validation schema
- Validates the output artifact against the schema
- Creates a gate file with validation results
- Returns exit code 0 (success) or 1 (failure)

**Step 5: Handle Failures**

If validation fails:

1. Read the gate file to understand errors
2. Provide feedback to the agent
3. Agent corrects the output
4. Re-validate until passing or max retries (3)

## Workflow Execution Details

</execution_process>

<template_usage>

### Context Passing Between Steps

Each agent's outputs become inputs for subsequent agents:

- **Artifact Storage**: Outputs saved to `.claude/context/artifacts/<artifact-name>.json`
- **Input References**: Steps reference previous outputs: `project_brief.json (from step 1)`
- **Context Loading**: Next agent reads artifacts as context before executing

### Workflow-Level Context Inputs

Some workflows accept context inputs that are provided at workflow start (not as artifact files). These are passed directly to agents as context when the workflow initializes.

**Common Workflow-Level Inputs:**

- `target_files`: List of files/directories to analyze (e.g., `["src/", "lib/", "app/components/"]`)
- `coding_standards`: Coding standards to apply (e.g., `"PEP 8"`, `"Airbnb JavaScript Style Guide"`, `"Google Java Style"`)

**How They Work:**

1. These inputs are specified in the workflow YAML `inputs` section with comments indicating they are "workflow-level context inputs"
2. They are declared in the workflow YAML `workflow_inputs` section (if present) for validation
3. They are provided when the workflow is initialized (by the orchestrator or user)
4. They are passed directly to agents as context, not loaded from artifact files
5. Multiple steps can reference the same workflow-level input

**Example from Code Quality Flow:**

```yaml
# Workflow-level inputs declaration (for validation)
workflow_inputs:
  required:
    - target_files
    - coding_standards
  optional: []

steps:
  - step: 0
    agent: planner
    inputs:
      # Workflow-level context inputs (provided at workflow start, not artifact files)
      - target_files # List of files/directories to analyze
      - coding_standards # Coding standards to apply
```

**Providing Workflow-Level Inputs:**
When executing a workflow, these inputs are typically provided:

- Via the orchestrator's context initialization
- As part of the user's initial request (extracted by the orchestrator)
- Through workflow configuration or environment variables
- As explicit parameters when manually executing workflows

**Input Format:**

- `target_files`: Array of strings, e.g., `["src/", "lib/", "app/components/"]`
- `coding_standards`: String or array of strings, e.g., `"PEP 8"` or `["Airbnb JavaScript Style Guide", "Google Java Style"]`

**Validation:**

- Required workflow-level inputs are validated by the orchestrator before workflow execution
- If required inputs are missing, the workflow will fail with a clear error message
- The orchestrator should check the `workflow_inputs.required` section in the workflow YAML

**Agent Access:**
Agents receive workflow-level inputs as part of their execution context, alongside artifact inputs from previous steps. Agents should:

- Check for workflow-level inputs in their context
- Use them to guide their work (e.g., which files to analyze, which standards to apply)
- Document their usage in reasoning files

### Optional Artifact References

Some workflows have conditional steps that may or may not execute. When referencing artifacts from optional steps:

**Pattern Supported**:

- `artifact-name.json (from step X, optional)` - Standard pattern (use this for all optional artifacts)

**Handling**:

- The workflow runner will check if optional artifacts exist but will not fail if they are missing
- Agents receiving optional inputs must check if the artifact exists before using it
- If artifact is missing, agent should proceed without it or use default values
- Optional artifacts are marked with `optional` keyword in the input reference

**Example**:

```yaml
inputs:
  - required-artifact.json (from step 1)
  - optional-artifact.json (from step 2, optional)
  - another-optional.json (from step 3, optional)
```

**Agent Implementation Example**:

```javascript
// Agent should check for optional artifacts
const optionalArtifact = await loadArtifact('optional-artifact.json').catch(() => null);
if (optionalArtifact) {
  // Use optional artifact data
  processWithOptionalData(optionalArtifact);
} else {
  // Proceed without optional data
  processWithDefaults();
}
```

### Artifact Publishing Policy

**When to Publish Artifacts**:

Critical artifacts should be published using the `artifact-publisher` skill after validation:

1. **Always Publish**:
   - Plans (Step 0): `plan-{{workflow_id}}.md` and `plan-{{workflow_id}}.json`
   - Architecture (Step 4): `system-architecture.json` (critical for Factory Droids)
   - Final implementations: Complete feature artifacts for handoff

2. **Optional Publish**:
   - Test results: `test-results.json`, `quality-report.json`
   - Documentation: API docs, user guides
   - Intermediate artifacts: Project briefs, PRDs (if needed for sharing)

3. **Never Publish**:
   - Reasoning files: Internal decision-making documents
   - Gate files: Validation results (internal only)
   - Temporary artifacts: Intermediate processing files

**How to Publish**:

After artifact validation passes, invoke the `artifact-publisher` skill:

**Publishing Policy Configuration**:

The `artifact-publisher` skill supports three publishing policies:

1. **Manual Publishing** (`publish_policy: manual`):
   - Artifacts are only published when explicitly requested
   - Use when: User wants to review artifacts before publishing
   - Example: "Publish this plan" or `publish_artifact` tool call
   - Configuration:

   ```yaml
   # In workflow YAML
   publish_policy: manual
   ```

2. **Auto-on-Pass** (`publish_policy: auto-on-pass`):
   - Artifacts are automatically published when validation status is 'pass'
   - Use when: You want to publish all validated artifacts automatically
   - Example: After gate file validation passes, artifact is automatically published
   - Configuration:

   ```yaml
   # In workflow YAML
   publish_policy: auto-on-pass
   ```

   - Implementation: Skill checks `validation_status: 'pass'` and publishes automatically

3. **Auto-on-Complete** (`publish_policy: auto-on-complete`):
   - Artifacts are automatically published when workflow completes
   - Use when: You want to publish all artifacts at workflow end
   - Example: At workflow completion, all artifacts with `publishable: true` are published
   - Configuration:
   ```yaml
   # In workflow YAML
   publish_policy: auto-on-complete
   ```

   - Implementation: Skill publishes all `publishable: true` artifacts at workflow completion

**Configuring Publish Targets Per Artifact**:

When registering artifacts, specify publish targets:

```javascript
// In workflow step or agent code
await registerArtifact(runId, {
  name: 'plan-123.json',
  step: 0,
  agent: 'planner',
  publishable: true,
  publish_targets: ['project_feed', 'cursor'], // Multiple targets
  // ... other fields
});
```

**Handling Publishing Failures in Workflows**:

- Publishing failures are non-blocking (workflow continues)
- Errors are logged in registry: `publish_error` and `publish_status: 'failed'`
- Failed artifacts can be retried manually or in next workflow run
- Gate files include publishing status for visibility
- Retry logic: Up to 3 attempts with exponential backoff (1s, 2s, 4s)
- Use `create_artifact` to finalize the artifact
- Use `share_artifact` to push to project feed
- Include `workflow_id` and `step_number` in metadata
- Publish to targets: `["project_feed", "cursor"]` for cross-platform access

**Integration Pattern**:

```yaml
# In workflow step description:
description: |
  Create system architecture:
  - Design components and interactions
  - **Publishing**: After validation, use `artifact-publisher` skill to publish system-architecture.json
```

### Output Types

Workflow outputs can be of different types:

**JSON Artifacts** (Structured Data):

- Standard JSON files that can be validated against schemas
- Examples: `project-brief.json`, `prd.json`, `system-architecture.json`
- These are validated using the schema specified in `validation.schema`

**Code Artifacts** (Special Output Type):

- Reference to actual code files/directories created during implementation
- Not a JSON file, but a directory or file collection reference
- Examples: `code-artifacts` (references all code files created in a step)
- These are NOT validated against schemas, but their manifest (if provided) can be validated
- When `code-artifacts` is specified, agents should also create a `dev-manifest.json` that lists all code files created

**Reasoning Files** (Special Output Type):

- JSON files documenting agent decision-making process
- Format: `reasoning: .claude/context/history/reasoning/{{workflow_id}}/{{step_number}}-{{agent_name}}.json`
- Schema: `.claude/schemas/reasoning.schema.json` (recommended structure)
- These files document decisions, rationale, assumptions, and tradeoffs
- While not strictly validated, following the schema ensures consistency and traceability

**Example Output Declaration:**

```yaml
outputs:
  - dev-manifest.json # JSON artifact (validated)
  - code-artifacts # Special: code files/directories (not validated)
  - reasoning: .claude/context/history/reasoning/{{workflow_id}}/01-developer.json # Special: reasoning file
```

### Template Variables

Template workflows support `{{placeholder}}` substitution at runtime. Common placeholders:

| Placeholder          | Type    | Example Value                 | Purpose                           |
| -------------------- | ------- | ----------------------------- | --------------------------------- |
| `{{workflow_id}}`    | String  | `workflow-web-app-2025-01-17` | Unique workflow identifier        |
| `{{run_id}}`         | String  | `run-2025-01-17-001`          | Execution run identifier          |
| `{{primary_agent}}`  | String  | `developer`                   | Primary agent for this execution  |
| `{{fallback_agent}}` | String  | `architect`                   | Fallback agent if primary fails   |
| `{{step_number}}`    | Number  | `1`, `2`, `3`                 | Current workflow step number      |
| `{{timestamp}}`      | ISO     | `2025-01-17T10:30:00Z`        | Workflow start timestamp          |

**Usage in Workflows**:

```yaml
# templates/fallback-routing-template.yaml
steps:
  - step: 1
    agent: "{{primary_agent}}"
    inputs:
      - workflow_id: "{{workflow_id}}"
      - run_id: "{{run_id}}"
    fallback:
      agent: "{{fallback_agent}}"
```

**How Substitution Works**:

1. Template workflow loaded with `{{placeholder}}` values as strings
2. Workflow engine substitutes actual values before execution
3. Dry-run mode validates templates without breaking on placeholder values
4. Each placeholder can be used multiple times in the same workflow

**Creating Template Workflows**:

Template workflows allow generic, reusable patterns. Use when:
- The same workflow structure is used with different agents
- You want to support fallback agent routing without duplicating files
- Runtime values determine which agents execute

See `.claude/templates/fallback-routing-template.yaml` for a complete example.

### Template Workflows (Runtime Substitution)

**NEW**: Workflows can now use runtime placeholders for dynamic execution.

#### What are Template Workflows?

Template workflows use `{{placeholder}}` syntax for values that are substituted at runtime. This eliminates the need for duplicate workflow files and enables dynamic agent routing.

**Before** (without templates - high duplication):
```
fallback-routing-developer-qa.yaml       (explicit file)
fallback-routing-architect-developer.yaml (explicit file)
fallback-routing-security-architect.yaml  (explicit file)
...many duplicates with slightly different agents...
```

**After** (with templates - single reusable file):
```
templates/fallback-routing-template.yaml  (one template)
  └── Used at runtime with {{primary_agent}}, {{fallback_agent}} substitution
```

#### Using Template Workflows

Template workflows are invoked with agent parameters:

```bash
# Invoke template workflow with specific agents
node .claude/tools/workflow-template-engine.mjs \
  --template .claude/templates/fallback-routing-template.yaml \
  --primary-agent developer \
  --fallback-agent architect \
  --workflow-id my-workflow-123
```

#### Placeholder Values

Placeholders are replaced with actual values before execution:

```yaml
# Template workflow (before substitution)
steps:
  - agent: "{{primary_agent}}"    # Placeholder
    fallback: "{{fallback_agent}}" # Placeholder

# Concrete workflow (after substitution)
steps:
  - agent: "developer"             # Actual agent
    fallback: "architect"          # Actual agent
```

#### Dry-Run Validation of Templates

Template workflows can be validated without executing:

```bash
# Validate template without substituting placeholders
node .claude/tools/workflow_runner.js \
  --workflow .claude/templates/fallback-routing-template.yaml \
  --dry-run

# Output: Template validation passes ({{primary_agent}} recognized as placeholder)
# Does NOT fail if agent "{{primary_agent}}" doesn't exist
```

**Template Validation**:
- Checks for valid placeholder syntax: `{{placeholder}}`
- Verifies workflow structure (steps, fields, references)
- Skips literal agent file existence checks for placeholders
- Validates substituted values after replacement

#### Example: Fallback Routing Template

The `fallback-routing-template.yaml` is used when you want automatic fallback to a different agent if the primary fails:

```yaml
# .claude/templates/fallback-routing-template.yaml
metadata:
  name: Fallback Routing
  type: template
  placeholders:
    - primary_agent
    - fallback_agent

steps:
  - step: 1
    agent: "{{primary_agent}}"
    task: Execute primary task
    fallback:
      agent: "{{fallback_agent}}"
      task: Execute alternative approach
```

**Invocation**:

```bash
# At runtime, substitute actual agent names
node .claude/tools/workflow-template-engine.mjs \
  --template fallback-routing-template.yaml \
  --primary-agent developer \
  --fallback-agent architect
```

#### When to Use Templates

Use template workflows when:
- ✓ Multiple similar workflows with different agent assignments
- ✓ Dynamic fallback routing based on runtime conditions
- ✓ Generic patterns that vary by agent but not structure
- ✗ Different workflow structures (use separate workflows instead)
- ✗ Different step sequences (use separate workflows instead)

#### Common Template Patterns

**Parallel Agent Execution**:
```yaml
# Two agents working in parallel
- step: 1a
  agent: "{{agent_1}}"
- step: 1b
  agent: "{{agent_2}}"
  depends_on: null  # Parallel with 1a
```

**Sequential with Fallback**:
```yaml
- step: 1
  agent: "{{primary_agent}}"
  fallback:
    agent: "{{fallback_agent}}"
- step: 2
  agent: "{{secondary_agent}}"
  depends_on: 1
```

**Conditional Routing**:
```yaml
- step: 1
  agent: "{{router_agent}}"
  outputs:
    - routing_decision.json
- step: 2
  agent: "{{primary_agent}}"
  condition: "routing_decision.json:primary == true"
```

</template_usage>

<examples>
<workflow_example>
**Example Workflow Execution**:

```bash
# Step 1: Analyst
# - Loads: .claude/agents/analyst.md
# - Executes: Creates project brief
# - Saves: .claude/context/artifacts/project-brief.json
# - Validates: node .claude/tools/workflow_runner.js --workflow .claude/workflows/greenfield-fullstack.yaml --step 1 --id $WORKFLOW_ID

# Step 2: PM (uses output from Step 1)
# - Loads: .claude/agents/pm.md
# - Inputs: Reads project-brief.json from Step 1
# - Executes: Creates PRD
# - Saves: .claude/context/artifacts/prd.json
# - Validates: node .claude/tools/workflow_runner.js --workflow .claude/workflows/greenfield-fullstack.yaml --step 2 --id $WORKFLOW_ID
```

</workflow_example>

<code_example>
**Template Variables**

Workflow artifacts and paths support dynamic template variables that are interpolated at runtime:

**Supported Variables:**

- `{{workflow_id}}`: Unique identifier for the workflow run (required)
- `{{story_id}}`: Story identifier for story loop iterations (optional)
- `{{epic_id}}`: Epic identifier for epic loop iterations (optional)

**Variable Resolution Process:**

1. Variables are extracted from artifact names and paths at workflow execution time
2. Values are provided via command-line arguments to `workflow_runner.js` or set by the orchestrator
3. Variables are replaced with actual values using string substitution
4. If a variable is not provided, it remains as-is in the artifact name (e.g., `story-{{story_id}}.json` without `--story-id` becomes `story-{{story_id}}.json`)
5. Missing required variables (like `{{workflow_id}}`) will cause workflow execution to fail

**Usage Examples:**

In artifact names:

```yaml
outputs:
  - plan-{{workflow_id}}.json
  - story-{{story_id}}-implementation.json
  - epic-{{epic_id}}-summary.json
```

In gate paths:

```yaml
validation:
  gate: .claude/context/history/gates/{{workflow_id}}/01-analyst.json
```

**Passing Variables to workflow_runner.js:**

```bash
# Basic usage (workflow_id only)
node .claude/tools/workflow_runner.js \
  --workflow .claude/workflows/greenfield-fullstack.yaml \
  --step 1 \
  --id my-workflow-123

# With story_id for story loops
node .claude/tools/workflow_runner.js \
  --workflow .claude/workflows/greenfield-fullstack.yaml \
  --step 2 \
  --id my-workflow-123 \
  --story-id story-456

# With epic_id for epic loops
node .claude/tools/workflow_runner.js \
  --workflow .claude/workflows/greenfield-fullstack.yaml \
  --step 3 \
  --id my-workflow-123 \
  --epic-id epic-789 \
  --story-id story-456
```

**Interpolation Rules:**

- Variables are replaced with actual values when artifacts are created
- **Required Variables**: `{{workflow_id}}` is REQUIRED and will cause execution failure if missing
- **Optional Variables**: `{{story_id}}` and `{{epic_id}}` are OPTIONAL
  - If not provided, they remain as-is in the artifact name (e.g., `story-{{story_id}}.json` without `--story-id` becomes `story-{{story_id}}.json`)
  - Missing optional variables will generate warnings but won't block execution
  - However, un-interpolated variables may cause path resolution issues
- Template variables are case-sensitive: `{{workflow_id}}` ≠ `{{WORKFLOW_ID}}`
- Use double curly braces: `{{variable_name}}`
- Variables must be valid identifiers (alphanumeric and underscores only)

**Error Handling:**

- **Missing Required Variables**: If `{{workflow_id}}` is not provided via `--id` argument, `workflow_runner.js` will fail with an error message and exit code 1
- **Missing Optional Variables**: If `{{story_id}}` or `{{epic_id}}` are not provided, `workflow_runner.js` will generate warnings but continue execution. The un-interpolated variable will remain in artifact names, which may cause path resolution issues
- **Invalid Variable Names**: Variables must use alphanumeric characters and underscores only. Invalid names will cause parsing errors
- **Case Sensitivity Errors**: Using `{{WORKFLOW_ID}}` instead of `{{workflow_id}}` will result in the variable not being replaced, leaving the literal string in artifact names
- **Troubleshooting**:
  - If artifacts contain literal `{{workflow_id}}` strings, check that `--id` was provided
  - If gate paths fail, verify the workflow_id was correctly interpolated
  - Warnings about un-interpolated variables indicate optional variables were not provided - this is expected if you're not using story/epic loops
  - Check workflow_runner.js error output for specific variable resolution failures
    </code_example>

<code_example>
**Optional Artifact Handling Example** (from `ui-perfection-loop.yaml`):

```yaml
inputs:
  - mobile-optimization.json (from step 5, optional) # Step 5 may be skipped
```

**Agent Implementation**:

```javascript
// Agent should check:
const mobileOpt = await loadArtifact('mobile-optimization.json').catch(() => null);
if (mobileOpt) {
  // Use mobile optimization data
} else {
  // Proceed without mobile-specific optimizations
}
```

</code_example>

<code_example>
**Plan Rating Gate Example**

When Orchestrator invokes the Plan Rating Gate:

```bash
# Step 1: Planner creates plan
# Output: plan-web-app-001.md and plan-web-app-001.json

# Step 2: Orchestrator rates the plan
node .claude/tools/enforcement-gate.mjs validate-plan \
  --run-id workflow-web-app-2025 \
  --plan-id plan-web-app-001

# Step 3a: If score >= 7/10 (PASS)
# Output:
{
  "plan_id": "plan-web-app-001",
  "overall_score": 8.4,
  "passed": true,
  "status": "pass",
  "attempt": 1,
  "feedback": "Excellent plan with clear steps, realistic timeline, and appropriate agent assignments."
}

# Result: Proceed to workflow Step 1 (analyst phase)

# Step 3b: If score < 7/10 (FAIL - Attempt 1)
# Output:
{
  "plan_id": "plan-web-app-001",
  "overall_score": 6.2,
  "passed": false,
  "status": "fail",
  "attempt": 1,
  "rubric_scores": {
    "completeness": 7,
    "feasibility": 8,
    "risk_mitigation": 4,    // LOW SCORE - needs improvement
    "agent_coverage": 7,
    "integration": 6
  },
  "feedback": "Plan needs stronger risk mitigation. Identify potential blockers (external dependencies, data migration, compliance). Add fallback strategies for high-risk areas like database migration phase."
}

# Result: Return to Planner with feedback to improve risk_mitigation dimension
# Planner revises plan to add:
# - Identification of database migration risks
# - Rollback strategy if migration fails
# - Data validation checkpoints
# - Team availability contingencies

# Step 4: Planner resubmits revised plan (Attempt 2)
# Output: plan-web-app-001-v2.md and plan-web-app-001-v2.json
# Run Step 0.1 again with revised plan

# Attempt 2 rating:
{
  "plan_id": "plan-web-app-001-v2",
  "overall_score": 7.8,
  "passed": true,
  "status": "pass",
  "attempt": 2,
  "rubric_scores": {
    "completeness": 8,
    "feasibility": 8,
    "risk_mitigation": 8,    // IMPROVED
    "agent_coverage": 7,
    "integration": 8
  }
}

# Result: Plan passes, proceed to Step 1
```

**Key Learnings**:

- First attempt often identifies missing risk considerations
- Planner learns which dimensions need attention
- By attempt 2, most plans achieve 7/10+ threshold
- Only rare plans require escalation to human review after attempt 3
  </code_example>

<code_example>
**Reasoning Files**

Each workflow step can produce a reasoning file documenting the agent's decision-making process:

```yaml
outputs:
  - reasoning: .claude/context/history/reasoning/{{workflow_id}}/00-planner.json
```

**Reasoning File Structure:**

- Path pattern: `.claude/context/history/reasoning/{{workflow_id}}/{{step_number}}-{{agent_name}}.json`
- Contains: assumptions, decision criteria, tradeoffs, open questions, final decisions
- Purpose: Audit trail, debugging, understanding agent rationale
- Format: JSON with structured reasoning data

**Note**: The reasoning path is explicit in workflows to ensure proper traceability. The workflow runner resolves `{{workflow_id}}` and `{{step_number}}` at runtime.
</code_example>

<code_example>
**Quality Gates**

Each workflow step can specify validation:

```yaml
validation:
  schema: .claude/schemas/project_brief.schema.json # Optional: for structured artifacts
  gate: .claude/context/history/gates/{{workflow_id}}/01-analyst.json # Required: validation results
```

**Schema Validation** (optional):

- Used for structured artifacts (PRD, architecture, test plans, etc.)
- Ensures outputs match expected JSON structure
- Required fields are present
- Data types are correct
- Business rules are satisfied

**Gate Validation** (required):

- Always creates a gate file with validation results
- Can validate without schema (for flexible outputs)
- Documents validation status, errors, and warnings
- Used for audit trails and debugging

**When to use schemas:**

- Structured artifacts with well-defined schemas (project_brief, prd, system_architecture, test_plan, artifact_manifest)
- When strict validation is needed

**When schemas are optional:**

- Flexible outputs (reasoning files, documentation, reports)
- Steps that produce multiple artifact types
- Early planning phases where structure may evolve
  </code_example>

<code_example>
**Workflow State Management**

Session state is maintained in `.claude/context/session.json`:

```json
{
  "workflow_id": "uuid-here",
  "workflow_name": "greenfield-fullstack",
  "current_step": 3,
  "status": "in_progress",
  "artifacts": {
    "project_brief": ".claude/context/artifacts/project-brief.json",
    "prd": ".claude/context/artifacts/prd.json"
  }
}
```

**Resuming Workflows**:

- Load session state to identify current step
- Continue from where workflow paused
- Re-validate previous steps if needed
  </code_example>
  </examples>

<instructions>
<execution_process>
## Validation

### Using workflow_runner.js

Validate a workflow step against its schema:

```bash
node .claude/tools/workflow_runner.js \
  --workflow .claude/workflows/<flow>.yaml \
  --step <n> \
  --id <workflow-id>
```

**What It Does**:

1. Loads workflow YAML and finds the specified step
2. Reads validation schema (if specified)
3. Loads output artifact from `.claude/context/artifacts/`
4. Validates JSON structure against schema
5. Creates gate file with validation results
6. Returns exit code 0 (success) or 1 (failure)

### Gate Files

Gate files contain validation results:

- **Location**: Path specified in `validation.gate` (e.g., `.claude/context/history/gates/<workflow_id>/01-analyst.json`)
- **Content**: Validation status, errors, warnings, metadata
- **Format**: JSON with validation results and feedback

**Enhanced Error Feedback** (NEW):
Gate files now provide actionable feedback:

- **Field-Level Errors**: Exact field path and correction instructions
- **Type Mismatch Details**: Current value, expected type, example of correct format
- **Schema Path**: JSON path to the violating field
- **Correction Examples**: Example of correct value format

### Artifact Registry (MANDATORY)

**CRITICAL**: Artifact registry is now mandatory for all workflows.

**Purpose**: Track all artifacts created during workflow execution for dependency management and context passing.

**Registry Location**: `.claude/context/artifacts/registry-{workflow_id}.json`

**Mandatory Requirements**:

- **MUST initialize registry** at workflow start (before any step execution)
- **MUST register every artifact** after creation (no exceptions)
- **MUST check registry** before delegating to subagents (never assume artifacts exist)
- **MUST verify validation status** before passing artifacts (only pass artifacts with status "pass")

**Registry Structure**:

```json
{
  "workflow_id": "workflow-123",
  "artifacts": {
    "project-brief.json": {
      "name": "project-brief.json",
      "step": 1,
      "agent": "analyst",
      "created_at": "2025-01-17T10:00:00Z",
      "path": ".claude/context/artifacts/project-brief.json",
      "dependencies": [],
      "version": 1,
      "metadata": {
        "size": 8234,
        "type": "project_brief",
        "validation_status": "pass"
      }
    }
  }
}
```

**Usage**:

- Before delegating to subagent, check artifact registry for required inputs
- After subagent completes, register new artifacts in registry
- When passing artifacts between steps, verify they exist in registry
- Use registry to identify missing dependencies

### Checkpoint Protocol (For Long-Running Tasks)

**Purpose**: Enable recovery from mid-workflow interruption for long-running tasks.

**When to Use**: Tasks expected to take >10 minutes should use checkpoint protocol.

**Checkpoint Creation**:

- **Interval**: Create checkpoints every 5 minutes for long-running tasks
- **Location**: `.claude/context/checkpoints/{{workflow_id}}/step-{{n}}-checkpoint.json`
- **Content**: Current task state, completed work, remaining work, file modifications

**Checkpoint Structure**:

```json
{
  "workflow_id": "workflow-123",
  "step": 3,
  "agent": "developer",
  "checkpoint_timestamp": "2025-01-17T10:30:00Z",
  "task_status": "in_progress",
  "completed_work": {
    "files_created": ["src/components/Button.tsx"],
    "tests_written": 2,
    "lines_of_code": 150
  },
  "remaining_work": {
    "files_to_create": ["src/components/Modal.tsx"],
    "tests_to_write": 1
  }
}
```

**Resume from Checkpoint**:

1. Load checkpoint state if interruption detected
2. Verify completed work matches checkpoint
3. Continue from checkpoint state
4. Complete remaining work

**Benefits**:

- No work lost on interruption
- Seamless recovery from mid-task interruption
- Support for very long-running tasks
  </execution_process>

<examples>
<code_example>
**Debugging Workflow Failures**

**Common Issues**:

1. **Schema Validation Failures**:
   - Check gate file for specific field errors (now includes field-level details)
   - Verify artifact structure matches schema
   - Review agent output for missing required fields
   - **Enhanced Recovery**: Gate files now provide:
     - Field-level errors with exact paths
     - Type mismatch details with correction examples
     - Schema path to violating fields
   - **Recovery**: Provide enhanced feedback to agent with specific field errors and correction examples, agent corrects and re-validates

2. **Agent Output Issues**:
   - Review agent's reasoning/logs
   - Check if agent understood the task
   - Verify inputs were correctly passed
   - **Recovery**: Re-read agent prompt, clarify requirements, re-execute step

3. **Context Passing Problems**:
   - **Check Artifact Registry**: Verify artifacts exist in artifact registry (MANDATORY)
   - Verify artifacts exist in `.claude/context/artifacts/`
   - Check artifact file names match references (including template variable resolution)
   - Ensure JSON structure is valid
   - Verify artifact validation status is "pass" before passing to next step
   - **Recovery**:
     - If artifact missing: Follow missing artifact recovery protocol (see Orchestrator agent)
     - If artifact invalid: Request artifact recreation with validation
     - If artifact corrupted: Request artifact recreation

4. **Workflow Execution Errors**:
   - Check session state for current step
   - Review workflow YAML for syntax errors
   - Verify agent definitions exist
   - **Recovery**: Fix YAML syntax, ensure agents exist, resume from last successful step

5. **Missing Optional Artifacts**:
   - Optional artifacts may be missing if conditional steps didn't execute
   - Agents should handle this gracefully
   - **Recovery**: Verify agent handles optional inputs correctly, proceed without optional artifact

6. **Template Variable Resolution Errors**:
   - Variables not replaced (e.g., `{{workflow_id}}` remains in artifact name)
   - Missing required variables cause execution failure
   - **Recovery**: Ensure workflow_id is provided, check variable names are correct (case-sensitive)

7. **Missing Required Artifacts**:
   - Required artifact not found in artifact registry
   - Previous step failed to create artifact
   - Artifact deleted or corrupted
   - **Recovery**: Follow missing artifact recovery protocol (see Orchestrator agent):
     - Check if previous step completed successfully
     - Re-run previous step if incomplete
     - Request artifact recreation if step complete but artifact missing
     - Request artifact recreation with validation if corrupted

8. **Workflow Interruption**:
   - Workflow interrupted mid-step
   - Long-running task partially complete
   - **Recovery**:
     - Check for checkpoint artifacts in `.claude/context/checkpoints/{{workflow_id}}/`
     - Load checkpoint state if available
     - Resume from checkpoint
     - Complete remaining work

**Error Recovery Process**:

1. **Identify Error Type**: Check gate files and logs to determine error category
2. **Check Error Context**: Review reasoning files and artifact contents
3. **Apply Recovery Strategy**: Use appropriate recovery method from above
4. **Re-validate**: Run validation again after recovery
5. **Document**: Update reasoning files with recovery actions taken
   </code_example>
   </examples>

<instructions>
<validation>
## Additional Validation

- **Fast Validation**: `pnpm validate` - Validates core configuration files (config.yaml, model names) - fast
- **Full Validation**: `pnpm validate:all` - Validates all files including workflows, references, CUJs, and generates rule index - comprehensive
- **Sync Validation**: `pnpm validate:sync` - Validates cross-platform agent/skill parity

### Plan Rating Gate Validation (Step 0.1)

**Mandatory for all workflows**:

```bash
# Rate a plan after planner completes Step 0
node .claude/tools/enforcement-gate.mjs validate-plan \
  --run-id <workflow_id> \
  --plan-id <plan_id>

# Exit codes:
# 0 = Plan passed rating (score >= 7/10)
# 1 = Plan failed rating (score < 7/10)
```

**What Gets Validated**:

- Plan completeness (all steps defined)
- Feasibility (realistic timeline and resources)
- Risk mitigation (identified risks with fallbacks)
- Agent coverage (correct agents assigned)
- Integration (dependencies documented)

**Output**: Rating artifact saved to `.claude/context/runs/<run_id>/plans/<plan_id>-rating.json`

**Failure Handling**:

- Score < 7/10 on first attempt → Planner revises and resubmits
- Score < 7/10 on second attempt → Provide targeted feedback on low-scoring dimensions
- Score < 7/10 on third attempt → Escalate to human review (orchestrator/PM approval required)
- Max 3 attempts per plan, then must switch to manual approval process

**Integration with Workflow Execution**:

- Step 0.1 must complete successfully before Step 1 can execute
- If plan rating fails all 3 attempts, workflow cannot proceed without human override
- All rating attempts are logged in reasoning files for audit trail
  </validation>
  </instructions>
