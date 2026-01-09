# Custom Plan Rubrics

This directory contains specialized rubrics for plan rating that override the standard rubric for specific task types.

---

## Available Custom Rubrics

### 1. Security Plan Rubric

**File**: `security-plan-rubric.json`
**Minimum Score**: 9/10
**Use Cases**: Security audits, compliance audits, authentication/authorization, data protection

**Dimensions**:
- **completeness** (15%): All security information present, threat model, compliance mapping
- **feasibility** (10%): Security controls are realistic and achievable
- **risk_mitigation** (30%): Comprehensive security risk management and incident response
- **security_coverage** (25%): Full security coverage across authentication, authorization, encryption, monitoring
- **compliance** (20%): Meets all compliance requirements with audit trail

**Key Differences from Standard**:
- Higher minimum score (9 vs 7)
- Greater emphasis on risk mitigation (30% vs 20%)
- New dimension: security_coverage (25%)
- New dimension: compliance (20%)
- Reduced emphasis on completeness (15% vs 20%) and feasibility (10% vs 20%)

---

## Creating Custom Rubrics

### Steps

1. **Copy Template**: Use `standard-plan-rubric.json` or an existing custom rubric as a template
2. **Modify Dimensions**: Add, remove, or adjust dimensions and weights
3. **Update Scoring**: Define scoring criteria for each dimension
4. **Set Thresholds**: Define minimum scores for different task types
5. **Validate**: Ensure dimension weights sum to 1.0 and validate against schema
6. **Document**: Add metadata explaining use cases and rationale

### Validation Command

```bash
node -e "
const fs = require('fs');
const rubric = JSON.parse(fs.readFileSync('<rubric-file>.json', 'utf8'));
const totalWeight = rubric.dimensions.reduce((sum, d) => sum + d.weight, 0);
if (Math.abs(totalWeight - 1.0) > 0.001) {
  console.error('❌ Dimension weights sum to', totalWeight, ', must be 1.0');
  process.exit(1);
} else {
  console.log('✅ Validation passed! Weights sum to 1.0');
}
"
```

### Schema Validation

```bash
# TODO: Add schema validation command when implemented
node .claude/tools/enforcement-gate.mjs validate-rubric --rubric-file <rubric-file>.json
```

---

## Using Custom Rubrics

### In Workflows

```yaml
- step: 0.1
  name: "Plan Rating Gate"
  agent: orchestrator
  type: validation
  skill: response-rater
  validation:
    minimum_score: 9
    rubric_file: .claude/context/artifacts/custom-rubrics/security-plan-rubric.json
```

### In CLI

```bash
node .claude/skills/response-rater/scripts/rate.cjs \
  --response-file plan.json \
  --rubric-file .claude/context/artifacts/custom-rubrics/security-plan-rubric.json \
  --template plan-review
```

---

## Rubric Design Guidelines

### 1. Dimension Weights Must Sum to 1.0

All dimension weights must add up to exactly 1.0. This ensures consistent scoring across rubrics.

**Example**:
```json
{
  "dimensions": [
    { "name": "completeness", "weight": 0.15 },
    { "name": "feasibility", "weight": 0.10 },
    { "name": "risk_mitigation", "weight": 0.30 },
    { "name": "security_coverage", "weight": 0.25 },
    { "name": "compliance", "weight": 0.20 }
  ]
}
```
**Total**: 0.15 + 0.10 + 0.30 + 0.25 + 0.20 = 1.0 ✅

### 2. Use Consistent Scoring Ranges

Use the standard scoring ranges for consistency:
- **1-3**: Poor/inadequate
- **4-6**: Basic/acceptable
- **7-8**: Good/strong
- **9-10**: Excellent/comprehensive

### 3. Clear, Actionable Descriptions

Each dimension should have:
- Clear name (lowercase with underscores)
- Concise description (1-2 sentences)
- Specific scoring criteria for each range
- Actionable guidance for improvement

### 4. Document Rationale

Include metadata explaining:
- Why this custom rubric is needed
- What task types it applies to
- How it differs from the standard rubric
- Use cases and examples

### 5. Validate Before Use

Always validate custom rubrics:
1. Dimension weights sum to 1.0
2. All required fields present
3. Version format correct (semantic versioning)
4. JSON structure valid

---

## When to Create Custom Rubrics

### Security/Compliance Tasks

**Emphasis**: Risk mitigation (30-40%), security coverage (25-30%), compliance (20%)
**Minimum Score**: 9-10
**Use Cases**: Security audits, GDPR compliance, PCI-DSS, HIPAA, SOC2

### Performance-Critical Tasks

**Emphasis**: Performance (30%), scalability (25%), efficiency (20%)
**Minimum Score**: 8
**Use Cases**: Performance optimization, load testing, caching strategies

### UI/UX Tasks

**Emphasis**: Usability (30%), accessibility (25%), visual design (20%)
**Minimum Score**: 7-8
**Use Cases**: UI design, UX research, accessibility audits

### AI/LLM Tasks

**Emphasis**: Model quality (30%), prompt engineering (25%), evaluation (20%)
**Minimum Score**: 8
**Use Cases**: AI/LLM system design, RAG implementations, model fine-tuning

### Infrastructure Tasks

**Emphasis**: Scalability (30%), reliability (25%), cost-efficiency (20%)
**Minimum Score**: 8
**Use Cases**: Infrastructure design, cloud migrations, DevOps automation

---

## Rubric Naming Convention

**Pattern**: `<task-type>-plan-rubric.json`

**Examples**:
- `security-plan-rubric.json` - Security/compliance tasks
- `performance-plan-rubric.json` - Performance optimization
- `ui-ux-plan-rubric.json` - UI/UX design
- `ai-llm-plan-rubric.json` - AI/LLM systems
- `infrastructure-plan-rubric.json` - Infrastructure/DevOps

---

## References

- **Standard Rubric**: `.claude/context/artifacts/standard-plan-rubric.json`
- **Rubric Schema**: `.claude/schemas/plan-rubric.schema.json`
- **Documentation**: `.claude/docs/PLAN_RATING_GUIDE.md`
- **Workflow Guide**: `.claude/workflows/WORKFLOW-GUIDE.md`
