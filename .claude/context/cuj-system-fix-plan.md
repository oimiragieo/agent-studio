# CUJ System Comprehensive Fix Plan

**Plan ID**: cuj-system-fix-2026-01-05
**Status**: Draft
**Owner**: Atlas (Planner)
**Created**: 2026-01-05
**Priority**: Critical

---

## Executive Summary

This plan addresses 27 critical issues identified by three AI reviewers (Gemini, Codex, Cursor) in the CUJ (Customer User Journey) system. Issues span validation logic, missing files, registry consistency, execution mode standardization, workflow YAML updates, and tooling improvements.

**Key Metrics**:
- CUJ docs: 58 files found
- CUJ-INDEX rows: 59 entries (CUJ-031, 032, 033 reserved, CUJ-056 referenced but missing)
- Registry entries: 52 CUJs
- Execution mode mismatches: 21-33 detected
- Workflow CUJs with null workflow field: 14

---

## Phase 1: Critical Fixes (Blocking Issues)

**Timeline**: 1-2 hours
**Priority**: P0 - Must fix immediately

### Task 1.1: Create Missing CUJ-056.md

**Issue**: CUJ-056 is referenced in CUJ-INDEX.md (line 290) but the file does not exist.

**Steps**:
1. Create `.claude/docs/cujs/CUJ-056.md` with proper structure
2. Copy template from existing CUJ (e.g., CUJ-055.md for consistency)
3. Fill in content based on CUJ-INDEX entry: "Publishing Retry Logic Test"
4. Ensure execution_mode, skills, triggers match INDEX

**Expected Content**:
```markdown
# CUJ-056: Publishing Retry Logic Test

## User Goal
Test publishing retry logic with recovery skill integration.

## Execution Mode
**Execution Mode**: `skill-only`

## Trigger
- "Test publishing retry"
- "Validate retry with backoff"

## Skills Used
- `recovery`

## Expected Outputs
- Retry test plan
- Recovery validation report

## Success Criteria
- Retry logic works as documented
- Backoff delays measured correctly
```

**Validation**: `node .claude/tools/sync-cuj-registry.mjs --validate-only`

---

### Task 1.2: Populate Registry Workflow Fields

**Issue**: All 14 workflow CUJs in `cuj-registry.json` have `"workflow": null` despite having workflow paths in CUJ-INDEX.md.

**Root Cause**: `sync-cuj-registry.mjs` lines 156-161 only extract workflow if the CUJ doc contains the pattern `workflow: .claude/workflows/*.yaml`. Many CUJ docs specify workflow differently or in "Execution Mode" section.

**Fix Required in `sync-cuj-registry.mjs`**:

```javascript
// Enhanced workflow extraction (around line 155)
// Method 1: Direct workflow reference
const workflowMatch = content.match(/workflow:\s*`?\.claude\/workflows\/([^`\s]+\.yaml)`?/i);
if (workflowMatch) {
  metadata.workflow = `.claude/workflows/${workflowMatch[1]}`;
}

// Method 2: Execution Mode section with .yaml reference
if (!metadata.workflow) {
  const execModeMatch = content.match(/\*\*Execution Mode\*\*:\s*`([^`]+\.yaml)`/);
  if (execModeMatch) {
    metadata.workflow = `.claude/workflows/${execModeMatch[1]}`;
  }
}

// Method 3: Cross-reference with CUJ-INDEX.md mapping table
// (Load CUJ-INDEX mapping and use as fallback)
```

**Affected CUJs** (workflow = null in registry but have workflow in INDEX):
- CUJ-004: greenfield-fullstack.yaml
- CUJ-005: greenfield-fullstack.yaml
- CUJ-010: brownfield-fullstack.yaml
- CUJ-011: quick-flow.yaml
- CUJ-012: greenfield-fullstack.yaml
- CUJ-019: performance-flow.yaml
- CUJ-021: mobile-flow.yaml
- CUJ-022: ai-system-flow.yaml
- CUJ-024: incident-flow.yaml
- CUJ-026: enterprise-track.yaml
- CUJ-034: browser-testing-flow.yaml
- CUJ-037: enterprise-track.yaml
- CUJ-048: automated-enterprise-flow.yaml
- CUJ-050: enterprise-track.yaml

**Validation**: After fix, re-run `node .claude/tools/sync-cuj-registry.mjs` and verify workflow fields populated.

---

### Task 1.3: Fix Validation Logic - Plan Rating Check

**Issue**: In `validate-cuj-dry-run.mjs` (if it exists) or validation tools, the check for "Step 0.1 (Plan Rating Gate)" emits Warning instead of Critical Error for workflow CUJs with Step 0.

**Current Behavior** (from validate-cuj-e2e.mjs lines 378-384):
```javascript
function checkPlanRatingStep(cujId, executionMode, hasStep0, hasStep0_1) {
  const warnings = [];  // <-- Should be errors for workflow CUJs
  if (executionMode === 'workflow' && hasStep0 && !hasStep0_1) {
    warnings.push(`CUJ ${cujId}: Has Step 0 but missing Step 0.1 (Plan Rating Gate)`);
  }
  return warnings;
}
```

**Required Fix**:
```javascript
function checkPlanRatingStep(cujId, executionMode, hasStep0, hasStep0_1) {
  const errors = [];
  if (executionMode === 'workflow' && hasStep0 && !hasStep0_1) {
    errors.push({
      severity: 'critical',
      message: `CUJ ${cujId}: Has Step 0 but missing Step 0.1 (Plan Rating Gate) - MANDATORY for workflow CUJs`,
      fix: 'Add Step 0.1 with response-rater skill invocation'
    });
  }
  return errors;
}
```

**Additional Enhancement**: Verify Step 0.1 content contains "Skill: response-rater" not just string match.

```javascript
function validatePlanRatingContent(cujContent) {
  const hasStep0_1 = cujContent.includes('Step 0.1') || cujContent.includes('Plan Rating');
  const hasResponseRater = cujContent.includes('response-rater') || cujContent.includes('Skill: response-rater');

  if (hasStep0_1 && !hasResponseRater) {
    return {
      valid: false,
      error: 'Step 0.1 exists but does not invoke response-rater skill'
    };
  }
  return { valid: hasStep0_1 && hasResponseRater };
}
```

---

### Task 1.4: Add CUJ Doc Existence Check to validate-cuj-e2e.mjs

**Issue**: validate-cuj-e2e.mjs gives false green - it validates mapping table entries but doesn't verify the actual CUJ doc files exist.

**Current Problem**: CUJ-056 appears in INDEX, registry says it exists, but file is missing.

**Required Fix** (add to `validateCUJ` function around line 389):

```javascript
function validateCUJ(cujId, cujEntry) {
  // ... existing code ...

  // NEW: Verify CUJ doc file exists
  const cujDocPath = resolve(ROOT, `.claude/docs/cujs/${cujId}.md`);
  if (!existsSync(cujDocPath)) {
    status.status = 'blocked';
    status.issues.push(`CUJ doc file not found: ${cujId}.md`);
    validationResults.summary.blocked++;
    return status;
  }

  // ... rest of existing code ...
}
```

---

### Task 1.5: Eliminate CUJ Count Drift

**Issue**: Three sources have different counts:
- CUJ docs: 58 files
- CUJ-INDEX.md: 59 rows (includes CUJ-056 reference)
- cuj-registry.json: 52 entries

**Root Cause Analysis**:
- CUJ-031, 032, 033 are reserved (not implemented) - explains 3 gap
- CUJ-056 referenced but not created - explains 1 gap
- Registry missing CUJ-057 through CUJ-062 (6 entries)

**Required CI Gate**: Create `.github/workflows/cuj-validation.yml`:

```yaml
name: CUJ System Validation

on:
  push:
    paths:
      - '.claude/docs/cujs/**'
      - '.claude/context/cuj-registry.json'
  pull_request:
    paths:
      - '.claude/docs/cujs/**'
      - '.claude/context/cuj-registry.json'

jobs:
  validate-cuj-counts:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Validate CUJ count consistency
        run: |
          DOCS_COUNT=$(ls -1 .claude/docs/cujs/CUJ-*.md 2>/dev/null | grep -E 'CUJ-[0-9]{3}\.md$' | wc -l)
          INDEX_COUNT=$(grep -E '^\| CUJ-[0-9]{3}' .claude/docs/cujs/CUJ-INDEX.md | wc -l)
          REGISTRY_COUNT=$(jq '.total_cujs' .claude/context/cuj-registry.json)

          echo "Docs: $DOCS_COUNT, Index: $INDEX_COUNT, Registry: $REGISTRY_COUNT"

          if [ "$DOCS_COUNT" -ne "$REGISTRY_COUNT" ]; then
            echo "::error::CUJ count drift detected! Docs=$DOCS_COUNT, Registry=$REGISTRY_COUNT"
            exit 1
          fi

      - name: Run CUJ E2E validation
        run: node .claude/tools/validate-cuj-e2e.mjs --json
```

---

## Phase 2: Standardization

**Timeline**: 2-3 hours
**Priority**: P1 - High importance

### Task 2.1: Normalize Execution Modes

**Issue**: CUJs use mixed execution mode values:
- `workflow` (correct)
- `skill-only` (correct)
- `manual-setup` (correct)
- `delegated-skill` (non-standard, should be skill-only)
- `automated-workflow` (non-standard, should be workflow)
- Raw YAML filenames like `greenfield-fullstack.yaml` (should be `workflow`)

**Schema-Allowed Values** (from cuj-registry.schema.json):
```json
{
  "execution_mode": {
    "type": "string",
    "enum": ["workflow", "skill-only", "delegated-skill", "manual-setup"]
  }
}
```

**Normalization Script** (add to sync-cuj-registry.mjs):

```javascript
function normalizeExecutionMode(rawMode) {
  const mode = rawMode.toLowerCase().trim();

  // Map non-standard values to schema-allowed values
  const modeMap = {
    'skill': 'skill-only',
    'skill-only': 'skill-only',
    'delegated-skill': 'delegated-skill',
    'delegated': 'delegated-skill',
    'manual': 'manual-setup',
    'manual-setup': 'manual-setup',
    'workflow': 'workflow',
    'automated-workflow': 'workflow'
  };

  // If mode ends with .yaml, it's a workflow
  if (mode.endsWith('.yaml')) {
    return 'workflow';
  }

  return modeMap[mode] || 'workflow'; // Default to workflow if unknown
}
```

**Affected CUJs**: Update all 21 CUJs with execution-mode mismatches.

---

### Task 2.2: Centralize Rating Rubric

**Issue**: Rating rubric (completeness, feasibility, risk mitigation, agent coverage, integration) is scattered across docs.

**Solution**: Create `.claude/context/artifacts/standard-plan-rubric.json`:

```json
{
  "$schema": "../schemas/plan-rubric.schema.json",
  "version": "1.0.0",
  "rubric_name": "Standard Plan Quality Rubric",
  "minimum_passing_score": 7,
  "max_score": 10,
  "criteria": [
    {
      "name": "completeness",
      "weight": 0.25,
      "description": "Plan addresses all requirements from user request",
      "scoring": {
        "10": "All requirements addressed with detailed steps",
        "7": "Most requirements addressed, minor gaps",
        "5": "Some requirements missing, partial coverage",
        "3": "Major requirements missing",
        "1": "Plan incomplete or missing critical elements"
      }
    },
    {
      "name": "feasibility",
      "weight": 0.20,
      "description": "Plan is technically achievable with available resources",
      "scoring": {
        "10": "Fully feasible, resources identified, timeline realistic",
        "7": "Feasible with minor constraints",
        "5": "Partially feasible, some unknowns",
        "3": "Significant feasibility concerns",
        "1": "Not feasible as planned"
      }
    },
    {
      "name": "risk_mitigation",
      "weight": 0.20,
      "description": "Risks identified with mitigation strategies",
      "scoring": {
        "10": "Comprehensive risk analysis with mitigations",
        "7": "Key risks identified with basic mitigations",
        "5": "Some risks identified, mitigations incomplete",
        "3": "Few risks identified, no mitigations",
        "1": "No risk analysis"
      }
    },
    {
      "name": "agent_coverage",
      "weight": 0.20,
      "description": "Appropriate agents assigned to each step",
      "scoring": {
        "10": "Optimal agent assignments, clear responsibilities",
        "7": "Good agent coverage, minor gaps",
        "5": "Adequate coverage, some misalignments",
        "3": "Poor agent assignments",
        "1": "No agent assignments or inappropriate"
      }
    },
    {
      "name": "integration",
      "weight": 0.15,
      "description": "Plan integrates with existing workflows and systems",
      "scoring": {
        "10": "Seamless integration, dependencies mapped",
        "7": "Good integration, minor issues",
        "5": "Partial integration",
        "3": "Integration concerns",
        "1": "No integration consideration"
      }
    }
  ],
  "usage": {
    "skill": "response-rater",
    "invocation": "Skill: response-rater --rubric standard-plan-rubric.json",
    "minimum_score": 7,
    "action_on_fail": "Return plan to Planner with specific feedback"
  }
}
```

**Create Schema**: `.claude/schemas/plan-rubric.schema.json`

---

### Task 2.3: Close Doc-Index Mismatches

**Issue**: 21 CUJs have execution-mode mismatches between CUJ docs and CUJ-INDEX.md.

**Resolution Strategy**:
1. CUJ-INDEX.md is the source of truth for execution_mode
2. Update CUJ docs to match INDEX
3. Re-run sync-cuj-registry.mjs

**Batch Update Script**:

```bash
#!/bin/bash
# fix-cuj-execution-modes.sh

# List of CUJs to fix with correct execution modes from INDEX
declare -A CUJ_MODES=(
  ["CUJ-006"]="skill-only"
  ["CUJ-007"]="skill-only"
  ["CUJ-008"]="skill-only"
  # ... add all 21 mismatches
)

for cuj in "${!CUJ_MODES[@]}"; do
  mode="${CUJ_MODES[$cuj]}"
  file=".claude/docs/cujs/${cuj}.md"

  if [ -f "$file" ]; then
    # Update execution mode line
    sed -i "s/\*\*Execution Mode\*\*:.*$/\*\*Execution Mode\*\*: \`${mode}\`/" "$file"
    echo "Updated $cuj to $mode"
  fi
done
```

---

### Task 2.4: Repair Broken Links

**Issue**: Broken links in CUJ docs:
- CUJ-014:86 - broken link
- CUJ-057:114 - broken link
- CUJ-061:262 - broken link

**Verification Script**:

```javascript
// Add to validate-cuj-e2e.mjs or create validate-cuj-links.mjs
function validateCUJLinks(cujId, content) {
  const brokenLinks = [];

  // Match markdown links: [text](url) and reference links
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const refLinkRegex = /\[([^\]]+)\]:\s*(.+)/g;

  let match;
  while ((match = linkRegex.exec(content)) !== null) {
    const url = match[2];

    // Check relative file links
    if (!url.startsWith('http') && !url.startsWith('#')) {
      const absolutePath = resolve(ROOT, '.claude/docs/cujs', url);
      if (!existsSync(absolutePath)) {
        brokenLinks.push({
          text: match[1],
          url: url,
          line: content.substring(0, match.index).split('\n').length
        });
      }
    }
  }

  return brokenLinks;
}
```

---

## Phase 3: Workflow YAML Updates

**Timeline**: 3-4 hours
**Priority**: P1 - Critical for plan rating enforcement

### Task 3.1: Add Step 0.1 (Plan Rating Gate) to All Workflow YAMLs

**Issue**: CUJs document Step 0.1 but workflow YAMLs don't implement it.

**Clarification**:
- Step 0.1 is **Plan Rating Gate** using `response-rater` skill
- Different from "Plan Review Gate" which is parallel multi-reviewer gate

**Template for Step 0.1**:

```yaml
steps:
  - step: 0
    name: Planning
    agent: planner
    description: Create comprehensive implementation plan
    inputs:
      - user_requirements
    outputs:
      - plan-{{workflow_id}}.json
      - plan-{{workflow_id}}.md

  - step: 0.1
    name: Plan Rating Gate
    agent: orchestrator
    description: Rate plan quality using response-rater skill (min score 7/10)
    skill: response-rater
    inputs:
      - plan-{{workflow_id}}.json
    outputs:
      - plan-rating-{{workflow_id}}.json
    gate:
      type: rating
      minimum_score: 7
      rubric: standard-plan-rubric.json
      on_fail:
        action: return_to_step_0
        feedback: true
        max_iterations: 3
```

**Workflows Requiring Update**:
1. `greenfield-fullstack.yaml`
2. `brownfield-fullstack.yaml`
3. `enterprise-track.yaml`
4. `quick-flow.yaml`
5. `performance-flow.yaml`
6. `mobile-flow.yaml`
7. `ai-system-flow.yaml`
8. `incident-flow.yaml`
9. `browser-testing-flow.yaml`
10. `code-quality-flow.yaml`
11. `legacy-modernization-flow.yaml`
12. `automated-enterprise-flow.yaml`
13. `ui-perfection-loop.yaml`
14. `bmad-greenfield-standard.yaml`

---

### Task 3.2: Implement Plan Iteration Logic

**Issue**: No retry mechanism when plan score < 7.

**Implementation in workflow_runner.js**:

```javascript
async function executeStep(workflow, stepConfig, context) {
  // ... existing code ...

  // Handle Plan Rating Gate (Step 0.1)
  if (stepConfig.name === 'Plan Rating Gate') {
    const rating = await invokeSkill('response-rater', {
      plan: context.artifacts['plan'],
      rubric: stepConfig.gate.rubric
    });

    if (rating.score < stepConfig.gate.minimum_score) {
      const iteration = context.plan_iterations || 0;

      if (iteration >= stepConfig.gate.on_fail.max_iterations) {
        throw new Error(`Plan failed rating after ${iteration} iterations. Score: ${rating.score}/10`);
      }

      // Return to Step 0 with feedback
      context.plan_feedback = rating.feedback;
      context.plan_iterations = iteration + 1;

      console.log(`Plan scored ${rating.score}/10 (min: ${stepConfig.gate.minimum_score}). Returning to Step 0 for iteration ${context.plan_iterations}`);

      // Re-execute Step 0 with feedback
      return executeStep(workflow, workflow.steps.find(s => s.step === 0), context);
    }

    // Plan passed, save rating
    context.artifacts['plan-rating'] = rating;
  }

  // ... rest of existing code ...
}
```

---

### Task 3.3: Clarify Plan Review vs Plan Rating

**Issue**: `greenfield-fullstack.yaml` Step 0.1 is "Plan Review Gate" (parallel review) not response-rater.

**Distinction**:
- **Plan Review Gate**: Multi-agent parallel review (architect, security-architect, qa)
- **Plan Rating Gate**: Single skill invocation (response-rater) with rubric scoring

**Resolution**: Both gates should exist sequentially:
- Step 0: Planner creates plan
- Step 0.1: Plan Rating Gate (response-rater, must pass 7/10)
- Step 0.2: Plan Review Gate (parallel multi-reviewer, optional but recommended)

**Updated greenfield-fullstack.yaml Structure**:

```yaml
steps:
  - step: 0
    name: Planning
    agent: planner
    # ...

  - step: 0.1
    name: Plan Rating Gate
    agent: orchestrator
    skill: response-rater
    gate:
      type: rating
      minimum_score: 7

  - step: 0.2
    name: Plan Review Gate
    parallel_reviewers:
      - architect
      - security-architect
      - qa
    gate:
      type: consensus
      min_approve: 2
```

---

### Task 3.4: Create Missing Workflow Files

**Issue**: Referenced workflows don't exist:
- `feature-development.yaml` (not referenced in CUJ-INDEX but may be expected)
- `architecture-review.yaml`
- `refactoring.yaml`
- `multi-phase.yaml`
- `database-design.yaml`

**Verification**: Check if these are actually referenced in CUJ docs:

```bash
grep -r "feature-development.yaml\|architecture-review.yaml\|refactoring.yaml\|multi-phase.yaml\|database-design.yaml" .claude/docs/cujs/
```

**If Referenced**: Create workflow files following template structure.

**If Not Referenced**: Update CUJ docs to use existing workflows or mark as manual-setup.

---

## Phase 4: Tooling Improvements

**Timeline**: 2-3 hours
**Priority**: P2 - Important for maintenance

### Task 4.1: Create cuj-doctor CLI Command

**Issue**: No single CLI reporting all issues.

**Create `.claude/tools/cuj-doctor.mjs`**:

```javascript
#!/usr/bin/env node
/**
 * CUJ Doctor - Comprehensive CUJ system health check
 *
 * Usage:
 *   node .claude/tools/cuj-doctor.mjs [--fix] [--json]
 *
 * Checks:
 *   1. CUJ doc file existence
 *   2. Registry sync status
 *   3. Execution mode consistency
 *   4. Workflow file existence
 *   5. Skill file existence
 *   6. Plan rating step presence
 *   7. Link integrity
 *   8. Schema validation
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

const args = process.argv.slice(2);
const FIX_MODE = args.includes('--fix');
const JSON_OUTPUT = args.includes('--json');

const issues = {
  critical: [],
  warning: [],
  info: [],
  fixed: []
};

async function checkCUJDocExistence() {
  console.log('Checking CUJ doc file existence...');

  const indexContent = await fs.readFile(path.join(ROOT, '.claude/docs/cujs/CUJ-INDEX.md'), 'utf-8');
  const indexCUJs = [...indexContent.matchAll(/\| (CUJ-\d{3}) \|/g)].map(m => m[1]);

  for (const cujId of indexCUJs) {
    const docPath = path.join(ROOT, `.claude/docs/cujs/${cujId}.md`);
    try {
      await fs.access(docPath);
    } catch {
      issues.critical.push({
        type: 'missing_doc',
        cujId,
        message: `CUJ doc file not found: ${cujId}.md`,
        fix: `Create .claude/docs/cujs/${cujId}.md`
      });
    }
  }
}

async function checkRegistrySync() {
  console.log('Checking registry sync status...');

  const registry = JSON.parse(await fs.readFile(path.join(ROOT, '.claude/context/cuj-registry.json'), 'utf-8'));
  const docDir = path.join(ROOT, '.claude/docs/cujs');
  const docFiles = (await fs.readdir(docDir)).filter(f => /^CUJ-\d{3}\.md$/.test(f));

  const registryIds = new Set(registry.cujs.map(c => c.id));
  const docIds = new Set(docFiles.map(f => f.replace('.md', '')));

  // CUJs in docs but not in registry
  for (const docId of docIds) {
    if (!registryIds.has(docId)) {
      issues.warning.push({
        type: 'registry_missing_entry',
        cujId: docId,
        message: `CUJ ${docId} exists in docs but not in registry`,
        fix: 'Run: node .claude/tools/sync-cuj-registry.mjs'
      });
    }
  }

  // CUJs in registry but not in docs
  for (const regId of registryIds) {
    if (!docIds.has(regId)) {
      issues.critical.push({
        type: 'doc_missing_for_registry',
        cujId: regId,
        message: `CUJ ${regId} in registry but doc file missing`,
        fix: `Create .claude/docs/cujs/${regId}.md`
      });
    }
  }
}

async function checkExecutionModeConsistency() {
  console.log('Checking execution mode consistency...');

  const registry = JSON.parse(await fs.readFile(path.join(ROOT, '.claude/context/cuj-registry.json'), 'utf-8'));
  const indexContent = await fs.readFile(path.join(ROOT, '.claude/docs/cujs/CUJ-INDEX.md'), 'utf-8');

  // Parse INDEX mapping table
  const indexMapping = new Map();
  const tableLines = indexContent.split('\n').filter(l => l.startsWith('| CUJ-'));
  for (const line of tableLines) {
    const cols = line.split('|').map(c => c.trim()).filter(c => c);
    if (cols[0].match(/^CUJ-\d{3}$/)) {
      indexMapping.set(cols[0], cols[1]); // execution mode from INDEX
    }
  }

  for (const cuj of registry.cujs) {
    const indexMode = indexMapping.get(cuj.id);
    if (indexMode && indexMode !== cuj.execution_mode) {
      issues.warning.push({
        type: 'execution_mode_mismatch',
        cujId: cuj.id,
        message: `Execution mode mismatch: Registry="${cuj.execution_mode}", Index="${indexMode}"`,
        fix: `Update CUJ doc to use "${indexMode}" execution mode`
      });
    }
  }
}

async function checkWorkflowFiles() {
  console.log('Checking workflow file existence...');

  const registry = JSON.parse(await fs.readFile(path.join(ROOT, '.claude/context/cuj-registry.json'), 'utf-8'));

  for (const cuj of registry.cujs) {
    if (cuj.execution_mode === 'workflow') {
      if (!cuj.workflow) {
        issues.critical.push({
          type: 'missing_workflow_reference',
          cujId: cuj.id,
          message: `Workflow CUJ ${cuj.id} has null workflow field`,
          fix: 'Update sync-cuj-registry.mjs to extract workflow path'
        });
      } else {
        const workflowPath = path.join(ROOT, cuj.workflow);
        try {
          await fs.access(workflowPath);
        } catch {
          issues.critical.push({
            type: 'missing_workflow_file',
            cujId: cuj.id,
            message: `Workflow file not found: ${cuj.workflow}`,
            fix: `Create ${cuj.workflow}`
          });
        }
      }
    }
  }
}

async function checkSkillFiles() {
  console.log('Checking skill file existence...');

  const registry = JSON.parse(await fs.readFile(path.join(ROOT, '.claude/context/cuj-registry.json'), 'utf-8'));
  const checkedSkills = new Set();

  for (const cuj of registry.cujs) {
    for (const skill of cuj.skills || []) {
      if (checkedSkills.has(skill)) continue;
      checkedSkills.add(skill);

      const skillPath = path.join(ROOT, `.claude/skills/${skill}/SKILL.md`);
      try {
        await fs.access(skillPath);

        // Check skill metadata
        const skillContent = await fs.readFile(skillPath, 'utf-8');
        if (!skillContent.trim()) {
          issues.warning.push({
            type: 'empty_skill',
            skill,
            message: `Skill ${skill} has empty SKILL.md`,
            fix: `Add content to .claude/skills/${skill}/SKILL.md`
          });
        }
      } catch {
        issues.warning.push({
          type: 'missing_skill',
          skill,
          message: `Skill not found: ${skill}`,
          fix: `Create .claude/skills/${skill}/SKILL.md`
        });
      }
    }
  }
}

async function checkPlanRatingSteps() {
  console.log('Checking plan rating step presence...');

  const registry = JSON.parse(await fs.readFile(path.join(ROOT, '.claude/context/cuj-registry.json'), 'utf-8'));

  for (const cuj of registry.cujs) {
    if (cuj.execution_mode === 'workflow') {
      const docPath = path.join(ROOT, `.claude/docs/cujs/${cuj.id}.md`);
      try {
        const content = await fs.readFile(docPath, 'utf-8');
        const hasStep0 = content.includes('Step 0') || content.includes('Planning');
        const hasStep0_1 = content.includes('Step 0.1') || content.includes('Plan Rating');
        const hasResponseRater = content.includes('response-rater');

        if (hasStep0 && !hasStep0_1) {
          issues.critical.push({
            type: 'missing_plan_rating_step',
            cujId: cuj.id,
            message: `Workflow CUJ ${cuj.id} has Step 0 but missing Step 0.1 (Plan Rating Gate)`,
            fix: 'Add Step 0.1 with response-rater skill invocation'
          });
        }

        if (hasStep0_1 && !hasResponseRater) {
          issues.warning.push({
            type: 'plan_rating_missing_skill',
            cujId: cuj.id,
            message: `CUJ ${cuj.id} has Step 0.1 but doesn't reference response-rater skill`,
            fix: 'Add "Skill: response-rater" to Step 0.1'
          });
        }
      } catch {
        // Doc missing - handled by other check
      }
    }
  }
}

async function generateReport() {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      critical: issues.critical.length,
      warning: issues.warning.length,
      info: issues.info.length,
      fixed: issues.fixed.length
    },
    issues
  };

  if (JSON_OUTPUT) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('\n' + '='.repeat(60));
    console.log('CUJ Doctor Report');
    console.log('='.repeat(60));

    console.log(`\nCritical Issues: ${issues.critical.length}`);
    for (const issue of issues.critical) {
      console.log(`  [CRITICAL] ${issue.cujId || issue.skill}: ${issue.message}`);
      console.log(`    Fix: ${issue.fix}`);
    }

    console.log(`\nWarnings: ${issues.warning.length}`);
    for (const issue of issues.warning) {
      console.log(`  [WARNING] ${issue.cujId || issue.skill}: ${issue.message}`);
      console.log(`    Fix: ${issue.fix}`);
    }

    console.log(`\nInfo: ${issues.info.length}`);

    if (issues.fixed.length > 0) {
      console.log(`\nFixed: ${issues.fixed.length}`);
      for (const fix of issues.fixed) {
        console.log(`  [FIXED] ${fix}`);
      }
    }

    console.log('\n' + '='.repeat(60));
    const status = issues.critical.length === 0 ? 'HEALTHY' : 'NEEDS ATTENTION';
    console.log(`CUJ System Status: ${status}`);
    console.log('='.repeat(60) + '\n');
  }

  return issues.critical.length === 0;
}

async function main() {
  console.log('CUJ Doctor - Comprehensive Health Check\n');

  await checkCUJDocExistence();
  await checkRegistrySync();
  await checkExecutionModeConsistency();
  await checkWorkflowFiles();
  await checkSkillFiles();
  await checkPlanRatingSteps();

  const healthy = await generateReport();
  process.exit(healthy ? 0 : 1);
}

main().catch(err => {
  console.error('CUJ Doctor failed:', err);
  process.exit(2);
});
```

---

### Task 4.2: Add Skill Validation Gate

**Issue**: 18 skills have empty descriptions, 2 skills missing frontmatter.

**Create `.claude/tools/validate-skills.mjs`**:

```javascript
#!/usr/bin/env node
/**
 * Skill Validation Tool
 *
 * Validates all skill SKILL.md files for:
 * - Required frontmatter fields
 * - Non-empty description
 * - Required sections
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');
const SKILLS_DIR = path.join(ROOT, '.claude/skills');

const REQUIRED_SECTIONS = ['Description', 'Usage', 'Inputs', 'Outputs'];
const REQUIRED_FRONTMATTER = ['name', 'version', 'description'];

async function validateSkill(skillName) {
  const skillPath = path.join(SKILLS_DIR, skillName, 'SKILL.md');
  const issues = [];

  try {
    const content = await fs.readFile(skillPath, 'utf-8');

    // Check for empty file
    if (!content.trim()) {
      issues.push({ type: 'empty', message: 'SKILL.md is empty' });
      return { skillName, valid: false, issues };
    }

    // Check frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
      issues.push({ type: 'missing_frontmatter', message: 'Missing YAML frontmatter' });
    } else {
      const frontmatter = frontmatterMatch[1];
      for (const field of REQUIRED_FRONTMATTER) {
        if (!frontmatter.includes(`${field}:`)) {
          issues.push({ type: 'missing_field', message: `Missing required field: ${field}` });
        }
      }

      // Check for empty description
      const descMatch = frontmatter.match(/description:\s*(.+)/);
      if (descMatch && !descMatch[1].trim()) {
        issues.push({ type: 'empty_description', message: 'Description field is empty' });
      }
    }

    // Check required sections
    for (const section of REQUIRED_SECTIONS) {
      if (!content.includes(`## ${section}`)) {
        issues.push({ type: 'missing_section', message: `Missing required section: ## ${section}` });
      }
    }

    return { skillName, valid: issues.length === 0, issues };
  } catch (err) {
    return { skillName, valid: false, issues: [{ type: 'error', message: err.message }] };
  }
}

async function main() {
  console.log('Skill Validation Tool\n');

  const skillDirs = await fs.readdir(SKILLS_DIR);
  const results = [];

  for (const dir of skillDirs) {
    const stat = await fs.stat(path.join(SKILLS_DIR, dir));
    if (stat.isDirectory()) {
      const result = await validateSkill(dir);
      results.push(result);
    }
  }

  const invalid = results.filter(r => !r.valid);

  console.log(`Validated ${results.length} skills`);
  console.log(`Valid: ${results.length - invalid.length}`);
  console.log(`Invalid: ${invalid.length}\n`);

  if (invalid.length > 0) {
    console.log('Issues found:');
    for (const result of invalid) {
      console.log(`\n${result.skillName}:`);
      for (const issue of result.issues) {
        console.log(`  - [${issue.type}] ${issue.message}`);
      }
    }
  }

  process.exit(invalid.length > 0 ? 1 : 0);
}

main();
```

---

### Task 4.3: Enhance Distillation CUJ Context

**Issue**: For CUJ-025 and similar distillation CUJs, include Distillation Report in response-rater input.

**Update response-rater skill** to accept additional context:

```markdown
## Enhanced Inputs for Distillation CUJs

When rating plans for distillation CUJs (CUJ-025, CUJ-046):

1. Include `features-distilled.json` as additional context
2. Validate plan completeness against distilled feature list
3. Check that all high-priority features are addressed in plan
4. Verify dependency ordering matches distilled dependencies

### Example Invocation

```
Skill: response-rater
Plan: plan-workflow-123.json
Rubric: standard-plan-rubric.json
Context:
  - features-distilled.json
  - user_requirements.md (original)
Distillation-Aware: true
```
```

---

### Task 4.4: Optimize Passing Plans with Rewrites

**Issue**: If Rewritten Score - Original Score > 2, prompt to adopt rewritten plan even if original passes.

**Add to response-rater skill logic**:

```javascript
async function ratePlan(plan, rubric, options = {}) {
  const originalScore = await calculateScore(plan, rubric);

  // If original passes, still check if rewrite would be significantly better
  if (originalScore >= rubric.minimum_passing_score && options.checkRewrite !== false) {
    const rewrittenPlan = await generateImprovedPlan(plan, rubric);
    const rewrittenScore = await calculateScore(rewrittenPlan, rubric);

    const improvement = rewrittenScore - originalScore;

    if (improvement > 2) {
      return {
        status: 'pass_with_recommendation',
        originalScore,
        rewrittenScore,
        improvement,
        recommendation: 'Consider adopting rewritten plan for significant quality improvement',
        rewrittenPlan
      };
    }
  }

  return {
    status: originalScore >= rubric.minimum_passing_score ? 'pass' : 'fail',
    score: originalScore
  };
}
```

---

## Phase 5: Documentation Updates

**Timeline**: 1-2 hours
**Priority**: P2 - Important for clarity

### Task 5.1: Update CUJ-INDEX.md

**Actions**:
1. Remove CUJ-056 row (or create the file - see Phase 1)
2. Ensure all execution modes use schema-allowed values
3. Add count verification comment at top
4. Add last-updated timestamp

**Header Update**:
```markdown
# Customer User Journey (CUJ) Index

**Last Updated**: 2026-01-05
**Total CUJs**: 57 (excludes reserved CUJ-031, 032, 033)
**Validation**: Run `node .claude/tools/cuj-doctor.mjs` to verify consistency

This index maps all Customer User Journeys (CUJs) to agents, skills, workflows, and expected outcomes.
```

---

### Task 5.2: Document Plan Rating vs Plan Review

**Create**: `.claude/docs/PLAN_GATES.md`

```markdown
# Plan Gates Documentation

## Overview

The planning workflow includes two distinct gates:

### 1. Plan Rating Gate (Step 0.1) - MANDATORY

- **Skill**: `response-rater`
- **Minimum Score**: 7/10
- **Rubric**: `standard-plan-rubric.json`
- **Purpose**: Automated quality scoring
- **On Fail**: Return to Step 0, re-plan with feedback

### 2. Plan Review Gate (Step 0.2) - RECOMMENDED

- **Reviewers**: architect, security-architect, qa (parallel)
- **Minimum Approvals**: 2 of 3
- **Purpose**: Multi-perspective validation
- **On Fail**: Collect feedback, return to Step 0

## Execution Order

```
Step 0: Planner creates plan
    ↓
Step 0.1: Plan Rating Gate (MUST PASS 7/10)
    ↓
Step 0.2: Plan Review Gate (recommended)
    ↓
Step 1: First implementation step
```

## Key Differences

| Aspect | Plan Rating Gate | Plan Review Gate |
|--------|-----------------|------------------|
| Type | Automated scoring | Multi-agent review |
| Skill | response-rater | N/A (agent coordination) |
| Criteria | Rubric-based (5 dimensions) | Reviewer judgment |
| Speed | Fast (seconds) | Slower (parallel agents) |
| Required | YES (mandatory) | Recommended |
```

---

### Task 5.3: Update Skill Documentation

**Fix 18 skills with empty descriptions**:

Run skill validation, then update each skill's SKILL.md frontmatter:

```bash
node .claude/tools/validate-skills.mjs 2>&1 | grep "empty_description" | while read line; do
  skill=$(echo "$line" | cut -d: -f1)
  echo "Fixing $skill..."
  # Add description based on skill name
done
```

---

## Validation Checklist

### Phase 1 Validation
- [ ] CUJ-056.md exists and validates
- [ ] Registry workflow fields populated for all 14 workflow CUJs
- [ ] validate-cuj-e2e.mjs checks doc existence
- [ ] CI gate fails on count drift

### Phase 2 Validation
- [ ] All execution modes use schema-allowed values
- [ ] standard-plan-rubric.json exists and validates
- [ ] No doc-index mismatches
- [ ] No broken links

### Phase 3 Validation
- [ ] All workflow YAMLs have Step 0.1
- [ ] Plan iteration logic works (score < 7 retries)
- [ ] greenfield-fullstack.yaml has both 0.1 and 0.2 gates
- [ ] All referenced workflows exist

### Phase 4 Validation
- [ ] cuj-doctor.mjs reports healthy
- [ ] validate-skills.mjs passes
- [ ] response-rater handles distillation context
- [ ] Rewrite optimization prompts when improvement > 2

### Phase 5 Validation
- [ ] CUJ-INDEX.md counts match registry
- [ ] PLAN_GATES.md exists and is linked
- [ ] All skills have non-empty descriptions

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Breaking existing CUJ execution | High | Test each fix in isolation, maintain backward compatibility |
| Workflow YAML changes break runs | High | Dry-run validation before deployment |
| Registry sync loses data | Medium | Backup registry before running sync |
| CI gate too strict | Medium | Start with warning, promote to error after stabilization |
| Skill fixes break agent invocations | Medium | Validate skill syntax after each change |

---

## Dependencies

```
Phase 1 ─────────────────────────────────────────────────────────┐
   ├── Task 1.1: Create CUJ-056.md                               │
   ├── Task 1.2: Fix sync-cuj-registry.mjs                       │
   ├── Task 1.3: Fix validation logic                            │
   ├── Task 1.4: Add doc existence check                         │
   └── Task 1.5: Create CI gate                                  │
                                                                 │
Phase 2 ◄────────────────────────────────────────────────────────┤
   ├── Task 2.1: Normalize execution modes (depends on 1.2)      │
   ├── Task 2.2: Create rubric JSON                              │
   ├── Task 2.3: Close doc-index mismatches (depends on 2.1)     │
   └── Task 2.4: Repair broken links                             │
                                                                 │
Phase 3 ◄────────────────────────────────────────────────────────┤
   ├── Task 3.1: Add Step 0.1 to YAMLs (depends on 2.2)          │
   ├── Task 3.2: Implement iteration logic (depends on 3.1)      │
   ├── Task 3.3: Clarify review vs rating                        │
   └── Task 3.4: Create missing workflows                        │
                                                                 │
Phase 4 ◄────────────────────────────────────────────────────────┤
   ├── Task 4.1: Create cuj-doctor (depends on 1.*, 2.*, 3.*)    │
   ├── Task 4.2: Add skill validation gate                       │
   ├── Task 4.3: Enhance distillation context                    │
   └── Task 4.4: Optimize rewrite logic                          │
                                                                 │
Phase 5 ◄────────────────────────────────────────────────────────┘
   ├── Task 5.1: Update CUJ-INDEX.md (depends on all above)
   ├── Task 5.2: Document plan gates
   └── Task 5.3: Update skill docs
```

---

## Execution Timeline

| Phase | Tasks | Est. Time | Dependencies |
|-------|-------|-----------|--------------|
| Phase 1 | 5 tasks | 1-2 hours | None |
| Phase 2 | 4 tasks | 2-3 hours | Phase 1 |
| Phase 3 | 4 tasks | 3-4 hours | Phase 2 |
| Phase 4 | 4 tasks | 2-3 hours | Phase 3 |
| Phase 5 | 3 tasks | 1-2 hours | Phase 4 |
| **Total** | 20 tasks | **9-14 hours** | |

---

## Success Criteria

1. **CUJ Doctor reports 0 critical issues**
2. **Registry sync produces consistent counts** (docs = index = registry)
3. **All workflow CUJs have Step 0.1 with response-rater**
4. **CI gate passes on PR**
5. **Plan iteration works** (score < 7 triggers retry)
6. **All skills have valid metadata**

---

## Appendix: Quick Reference

### File Locations
- CUJ docs: `.claude/docs/cujs/CUJ-*.md`
- CUJ INDEX: `.claude/docs/cujs/CUJ-INDEX.md`
- CUJ registry: `.claude/context/cuj-registry.json`
- Registry schema: `.claude/schemas/cuj-registry.schema.json`
- Sync tool: `.claude/tools/sync-cuj-registry.mjs`
- E2E validation: `.claude/tools/validate-cuj-e2e.mjs`
- Workflows: `.claude/workflows/*.yaml`
- Skills: `.claude/skills/*/SKILL.md`

### Commands
```bash
# Sync registry
node .claude/tools/sync-cuj-registry.mjs

# Validate only
node .claude/tools/sync-cuj-registry.mjs --validate-only

# E2E validation
node .claude/tools/validate-cuj-e2e.mjs --verbose --fix-suggestions

# CUJ Doctor (new)
node .claude/tools/cuj-doctor.mjs

# Skill validation (new)
node .claude/tools/validate-skills.mjs
```
