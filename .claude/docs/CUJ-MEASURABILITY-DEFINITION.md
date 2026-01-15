# CUJ Measurability Definition

## Purpose

This document defines the **authoritative** criteria for what constitutes "measurable" success criteria in Customer User Journeys (CUJs). This ensures consistency between validation tools and clear expectations for CUJ authors.

---

## Definition of Measurability

A success criterion is **measurable** if it can be **objectively verified** through:

1. **File Existence Checks**: Artifacts, schemas, workflows exist at specified paths
2. **Data Structure Validation**: JSON schemas validate, fields are populated with expected types
3. **Numeric Thresholds**: Scores, percentages, counts meet or exceed specified values
4. **Status Codes**: Exit codes, HTTP status codes, validation results
5. **Content Verification**: Files contain specific text, patterns, or data structures
6. **Boolean Checks**: Conditions that can be evaluated as true/false programmatically

**Key Principle**: If a machine can verify it without human interpretation, it's measurable.

---

## Measurable Patterns (Allowed)

### File-Based Patterns

```
✅ ".claude/context/artifacts/generated/plan-*.json exists"
✅ "dev-manifest.json validated against schema"
✅ "Artifact saved to .claude/context/artifacts/generated/"
✅ "Schema file present at .claude/schemas/workflow.schema.json"
✅ "Workflow file .claude/workflows/example.yaml created"
```

### Data Validation Patterns

```
✅ "plan-*.json conforms to plan.schema.json"
✅ "Artifact validated by gate function"
✅ "expected_outputs array populated with >= 3 items"
✅ "reasoning.json contains 'assumptions' field"
✅ "Gate result JSON includes 'allowed: true'"
```

### Numeric/Threshold Patterns

```
✅ "Plan rating score >= 7/10"
✅ "Test coverage >= 80%"
✅ "Response time < 500ms"
✅ "Exit code 0 (success)"
✅ "Non-measurable percentage <= 30%"
✅ "Task completes in less than 2 hours"
✅ "Database query time under 100 milliseconds"
```

### Boolean/Status Patterns

```
✅ "Validation passes (exit code 0)"
✅ "All required fields present"
✅ "Workflow execution completes successfully"
✅ "Security gate returns allowed: true"
✅ "File contains 'Co-Authored-By: Claude'"
```

---

## Non-Measurable Patterns (Prohibited)

### Vague Qualifiers

```
❌ "Code is improved"
❌ "System runs faster"
❌ "Better architecture"
❌ "Working correctly"
❌ "Functional implementation"
```

### Subjective Assessments

```
❌ "Standards met"
❌ "Accurate results"
❌ "Successful integration"
❌ "Ensured quality"
❌ "Correct behavior"
```

### Unmeasurable Outcomes

```
❌ "User satisfaction improved"
❌ "Developer experience enhanced"
❌ "Code is cleaner"
❌ "Better maintainability"
❌ "More reliable"
```

---

## Partially Measurable (Warning)

Criteria that mix measurable and non-measurable elements:

```
⚠️ "Code improved and test coverage >= 80%"
   → Fix: Split into two criteria

⚠️ "Faster validation with exit code 0"
   → Fix: Remove "faster", keep "exit code 0"

⚠️ "Better architecture validated by architect agent"
   → Fix: Remove "better", specify validation criteria
```

---

## Validation Sources (Dual Check)

Both sources must be measurable and aligned:

### 1. CUJ Registry (`cuj-registry.json`)

- **Field**: `expected_outputs` (array of strings)
- **Checked By**: `cuj-validator-unified.mjs` line 660
- **Purpose**: Canonical list of measurable outputs

### 2. CUJ Markdown (`CUJ-*.md`)

- **Section**: `## Success Criteria`
- **Checked By**: `scripts/cuj-measurability.mjs`
- **Purpose**: Human-readable criteria documentation

### Alignment Requirement

- Registry `expected_outputs` and markdown `## Success Criteria` should describe the same outcomes
- Both must use measurable patterns
- Discrepancies should be flagged as warnings

---

## Measurable Keywords Reference

### Strong Indicators (High Confidence)

```javascript
const strongMeasurableKeywords = [
  // File references
  '.json',
  '.md',
  '.yaml',
  'schema',
  'artifact',
  'manifest',

  // Validation terms
  'validated',
  'validation',
  'passes',
  'fails',
  'gate',
  'schema',

  // Numeric/threshold
  'time',
  'seconds',
  'minutes',
  'count',
  'number',
  'total',
  'size',
  'percentage',
  '%',
  'ratio',
  'score',
  'rating',
  '>=',
  '<=',
  '>',

  // Status/boolean
  'exists',
  'present',
  'contains',
  'includes',
  'true',
  'false',
  'exit code',
  'status code',
  'response code',

  // Data structure
  'array',
  'field',
  'populated',
  'empty',
  'null',
  'undefined',
];
```

### Weak Indicators (Contextual)

```javascript
const weakMeasurableKeywords = [
  'greater',
  'less',
  'equal',
  'than',
  'valid',
  'invalid',
  'deployed',
  'running',
  'coverage',
  'response',
];
```

### Non-Measurable Keywords (Blockers)

```javascript
const nonMeasurableKeywords = [
  'improved',
  'faster',
  'better',
  'working',
  'ensured',
  'correct',
  'functional',
  'successful',
  'accurate',
  'met',
  'standards',
  'quality',
  'clean',
  'maintainable',
  'reliable',
];
```

---

## Tool Behavior

### cuj-validator-unified.mjs

**Function**: `checkSuccessCriteria()` (line 660)
**Source**: `cuj-registry.json` → `expected_outputs`
**Logic**:

```javascript
for (const output of cuj.expected_outputs) {
  const lowerOutput = output.toLowerCase();
  const isMeasurable = measurableKeywords.some(keyword => lowerOutput.includes(keyword));

  if (isMeasurable) {
    measurableCriteria++;
  } else {
    nonMeasurableIssues.push(`${cuj.id}: Non-measurable output: "${output}"`);
  }
}
```

### scripts/cuj-measurability.mjs

**Source**: `CUJ-*.md` → `## Success Criteria` section
**Logic**:

```javascript
criteria.forEach(c => {
  const hasMeasurable = measurablePatterns.some(p => p.test(c.text));
  const hasNonMeasurable = nonMeasurablePatterns.some(p => p.test(c.text));

  if (hasMeasurable && !hasNonMeasurable) {
    c.category = 'measurable';
  } else if (hasMeasurable && hasNonMeasurable) {
    c.category = 'partially_measurable';
  } else {
    c.category = 'non_measurable';
  }
});
```

---

## Alignment Validation

### Cross-Check Procedure

1. **Parse Both Sources**: Extract criteria from registry and markdown
2. **Check Measurability**: Apply same keywords to both
3. **Compare Results**: Flag discrepancies
4. **Report Alignment**: Pass/warn/fail based on agreement

### Example Alignment Check

```javascript
// Registry (expected_outputs)
["plan-*.json validated against schema", "Exit code 0"]

// Markdown (## Success Criteria)
- ✅ plan-*.json validated against schema
- ✅ Workflow completes with exit code 0

// Result: ALIGNED (both measurable, semantically equivalent)
```

### Misalignment Example

```javascript
// Registry (expected_outputs)
["Improved code quality", "Tests pass"]

// Markdown (## Success Criteria)
- ❌ Code quality improved (non-measurable)
- ✅ Test suite passes with 100% pass rate (measurable)

// Result: MISALIGNED (registry has non-measurable criteria)
```

---

## Thresholds

### CUJ-Level Thresholds

- **Fully Measurable**: 100% of criteria are measurable
- **Acceptable**: >= 70% measurable (warnings only)
- **Needs Improvement**: < 70% measurable (errors)

### System-Level Thresholds

- **Target**: <= 30% non-measurable criteria across all CUJs
- **Warning**: 31-50% non-measurable
- **Failure**: > 50% non-measurable

---

## Fixing Non-Measurable Criteria

### Pattern: Vague → Specific

**Before**:

```
❌ "Code is improved"
```

**After**:

```
✅ "Code passes linter with 0 errors (exit code 0)"
✅ "Cyclomatic complexity reduced from X to Y"
✅ "Test coverage increased from A% to B%"
```

### Pattern: Subjective → Objective

**Before**:

```
❌ "Better architecture"
```

**After**:

```
✅ "Architecture validated by architect agent (signoff in .claude/context/signoffs/)"
✅ "System architecture diagram present at .claude/docs/architecture.svg"
✅ "All components documented in architecture.md"
```

### Pattern: Ambiguous → Testable

**Before**:

```
❌ "Successful integration"
```

**After**:

```
✅ "Integration tests pass (exit code 0)"
✅ "API responds with 200 status code"
✅ "Integration manifest validated against schema"
```

---

## Version History

| Version | Date       | Changes                              |
| ------- | ---------- | ------------------------------------ |
| 1.0.0   | 2025-01-12 | Initial definition and keyword lists |
