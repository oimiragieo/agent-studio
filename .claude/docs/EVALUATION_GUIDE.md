# Evaluation Guide

## Overview

Comprehensive guide to evaluating agent performance, rule compliance, and workflow quality in LLM-RULES. Based on Promptfoo evaluation patterns from Claude Cookbooks.

## Why Evaluation Matters

- **Quality Assurance**: Ensure agents meet quality standards
- **Continuous Improvement**: Track improvements over time
- **Rule Validation**: Verify code follows project rules
- **Workflow Reliability**: Ensure workflows produce consistent results

## Evaluation Methods

### 1. Code-Based Grading

**Best for**: Exact matches, structured outputs, rule compliance

**Characteristics**:

- Fast and reliable
- No API costs
- Deterministic results
- Best for structured data

**Examples**:

- JSON schema validation
- Rule violation detection
- Test pass/fail counts
- File creation verification

**Implementation**:

```python
def code_based_grade(output, expected):
    score = 0.0
    max_score = 0.0

    # Check required files
    if "files_created" in expected:
        max_score += 1.0
        if set(expected["files_created"]).issubset(set(output.get("files_created", []))):
            score += 1.0

    return score / max_score if max_score > 0 else 0.0
```

### 2. Model-Based Grading

**Best for**: Subjective quality, complex analysis, free-form outputs

**Characteristics**:

- Handles complex evaluation
- Can evaluate subjective quality
- More flexible than code-based
- Requires API calls

**Examples**:

- Code quality assessment
- Architecture evaluation
- Documentation quality
- User experience evaluation

**Implementation**:

```python
def model_based_grade(output, criteria):
    prompt = f"""Evaluate the following output against these criteria:

Criteria:
{criteria}

Output:
{output}

Provide score (0-1) and feedback.
"""
    response = client.messages.create(
        model="claude-sonnet-4-5",
        messages=[{"role": "user", "content": prompt}]
    )
    return parse_grade(response)
```

### 3. Human Grading

**Best for**: Final validation, critical decisions, complex scenarios

**Characteristics**:

- Most capable evaluation method
- Handles edge cases
- Final authority
- Time-consuming

**Examples**:

- Production readiness assessment
- Security review
- Architecture approval
- User acceptance testing

## Evaluation Framework

### Structure

```
.claude/evaluation/
├── README.md
├── promptfooconfig.yaml
├── agent-eval.py
├── rule-compliance-eval.py
├── datasets/
│   ├── agent-tasks.jsonl
│   ├── rule-test-cases.jsonl
│   └── workflow-scenarios.jsonl
└── results/
    ├── agent-performance.json
    ├── rule-compliance.json
    └── workflow-quality.json
```

### Agent Performance Evaluation

**Purpose**: Evaluate how well agents perform their tasks

**Process**:

1. Load evaluation dataset
2. Run agent on each task
3. Grade outputs (code-based + model-based)
4. Generate performance report

**Usage**:

```bash
python .claude/evaluation/agent-eval.py \
  --agent developer \
  --dataset .claude/evaluation/datasets/agent-tasks.jsonl \
  --output .claude/evaluation/results/developer-performance.json
```

**Metrics**:

- Average score
- Task completion rate
- Code-based grade
- Model-based grade
- Error rate

### Rule Compliance Evaluation

**Purpose**: Test code against loaded rules

**Process**:

1. Load rule files
2. Scan code files
3. Detect violations
4. Calculate compliance rate

**Usage**:

```bash
python .claude/evaluation/rule-compliance-eval.py \
  --files "src/**/*.ts" "src/**/*.tsx" \
  --rules .claude/rules-master/TECH_STACK_NEXTJS.md \
  --output .claude/evaluation/results/rule-compliance.json
```

**Metrics**:

- Compliance rate
- Violation count
- Warning count
- Files checked
- Rules tested

### Workflow Quality Evaluation

**Purpose**: Validate workflow execution and outputs

**Process**:

1. Execute workflow on test scenarios
2. Validate step outputs
3. Check artifact completeness
4. Measure execution time

**Usage**:

```bash
python .claude/evaluation/workflow-eval.py \
  --workflow greenfield-fullstack \
  --scenarios .claude/evaluation/datasets/workflow-scenarios.jsonl \
  --output .claude/evaluation/results/workflow-quality.json
```

**Metrics**:

- Step success rate
- Artifact completeness
- Execution time
- Quality gate pass rate

## Creating Evaluation Datasets

### Agent Tasks Dataset

Format: `.claude/evaluation/datasets/agent-tasks.jsonl`

```json
{
  "input": "Implement a user authentication API endpoint",
  "expected_output": {
    "files_created": ["api/auth/route.ts", "api/auth/types.ts"],
    "tests_created": ["api/auth/route.test.ts"],
    "validation": "pass"
  },
  "agent": "developer",
  "category": "api_implementation",
  "difficulty": "medium"
}
```

### Rule Test Cases Dataset

Format: `.claude/evaluation/datasets/rule-test-cases.jsonl`

```json
{
  "file": "src/components/Button.tsx",
  "rule": "TECH_STACK_NEXTJS.md",
  "expected_violations": [],
  "category": "component_structure",
  "description": "Server component with proper TypeScript types"
}
```

### Workflow Scenarios Dataset

Format: `.claude/evaluation/datasets/workflow-scenarios.jsonl`

```json
{
  "scenario": "greenfield-fullstack",
  "input": "Build a task management application",
  "expected_steps": ["analyst", "pm", "architect", "developer", "qa"],
  "expected_artifacts": [
    "project-brief.json",
    "prd.json",
    "system-architecture.json",
    "dev-manifest.json"
  ],
  "success_criteria": {
    "all_steps_complete": true,
    "all_artifacts_present": true,
    "validation_passed": true
  }
}
```

## Promptfoo Integration

### Configuration

Base configuration: `.claude/evaluation/promptfooconfig.yaml`

Specialized configurations available:

- `.claude/evaluation/promptfoo_configs/rag_config.yaml` - RAG evaluation
- `.claude/evaluation/promptfoo_configs/classification_config.yaml` - Classification evaluation
- `.claude/evaluation/promptfoo_configs/text_to_sql_config.yaml` - SQL generation evaluation

### RAG Evaluation Configuration

The RAG config includes:

- Custom Python providers for retrieval methods
- Retrieval metrics (Precision, Recall, F1, MRR)
- End-to-end evaluation with LLM-as-judge

```yaml
# Example from rag_config.yaml
providers:
  - python:provider_retrieval.py:retrieve_base
  - python:provider_retrieval.py:retrieve_level_two

assert:
  - type: python
    value: |
      from retrieval_metrics import evaluate_retrieval
      metrics = evaluate_retrieval(retrieved, correct)
      return {"pass": metrics['f1'] >= 0.3, "score": metrics['f1']}
```

### Running Evaluations

```bash
# Install Promptfoo
npm install -g promptfoo

# Run base evaluation
npx promptfoo@latest eval -c .claude/evaluation/promptfooconfig.yaml

# Run RAG evaluation
npx promptfoo@latest eval -c .claude/evaluation/promptfoo_configs/rag_config.yaml

# Run classification evaluation
npx promptfoo@latest eval -c .claude/evaluation/promptfoo_configs/classification_config.yaml

# Run text-to-SQL evaluation
npx promptfoo@latest eval -c .claude/evaluation/promptfoo_configs/text_to_sql_config.yaml
```

## Integration with CI/CD

### GitHub Actions

```yaml
name: Evaluate Agents

on: [push, pull_request]

jobs:
  evaluate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
      - run: |
          python .claude/evaluation/agent-eval.py \
            --agent developer \
            --output results.json
      - uses: actions/upload-artifact@v3
        with:
          name: evaluation-results
          path: results.json
```

## Best Practices

### 1. Create Comprehensive Datasets

- Cover common use cases
- Include edge cases
- Test different difficulty levels
- Update datasets regularly

### 2. Run Evaluations Regularly

- After agent updates
- After rule changes
- Before major releases
- In CI/CD pipeline

### 3. Track Metrics Over Time

- Average scores
- Compliance rates
- Error rates
- Improvement trends

### 4. Use Results to Improve

- Identify weak areas
- Update agent prompts
- Refine rules
- Improve workflows

### 5. Automate Where Possible

- Integrate into CI/CD
- Schedule regular evaluations
- Generate reports automatically
- Alert on regressions

## Metrics and Reporting

### Retrieval Metrics (RAG Systems)

Based on Claude Cookbooks patterns, these metrics evaluate retrieval-augmented generation systems:

#### Precision

Proportion of retrieved items that are actually relevant.

**Formula**: `Precision = True Positives / Total Retrieved`

**Interpretation**:

- High precision (0.8-1.0): System retrieves mostly relevant items
- Low precision (<0.5): Many irrelevant items retrieved
- Measures efficiency and accuracy of retrieval

**Usage**: Use when you want to minimize false positives (irrelevant results)

#### Recall

Completeness of retrieval system - how many relevant items were found.

**Formula**: `Recall = True Positives / Total Correct`

**Interpretation**:

- High recall (0.8-1.0): System finds most relevant items
- Low recall (<0.5): Missing important information
- Measures coverage and completeness

**Usage**: Use when you want to ensure all relevant information is retrieved

#### F1 Score

Harmonic mean of precision and recall, providing balanced measure.

**Formula**: `F1 = 2 × (Precision × Recall) / (Precision + Recall)`

**Interpretation**:

- F1 = 1.0: Perfect precision and recall
- F1 = 0.0: Worst performance
- Balances precision and recall trade-offs

**Usage**: Use as single metric when both precision and recall matter

#### Mean Reciprocal Rank (MRR)

Measures ranking quality - how well relevant items are ranked.

**Formula**: `MRR = 1 / rank of first correct item`

**Interpretation**:

- MRR = 1.0: Correct item always ranked first
- MRR = 0.5: Correct item typically ranked second
- MRR = 0.0: Correct item never found or ranked very low

**Usage**: Use when ranking order matters (e.g., search results)

**Implementation**: See `.claude/evaluation/retrieval_metrics.py`

### End-to-End Metrics

#### Accuracy (LLM-as-Judge)

Overall correctness of generated answers using LLM evaluation.

**Method**: LLM compares generated answer to correct answer, considering:

- Substance and meaning (not exact wording)
- Completeness of information
- Absence of contradictions

**Implementation**: See `.claude/evaluation/end_to_end_eval.py`

### Agent Performance Metrics

- **Average Score**: Overall performance across tasks
- **Task Completion Rate**: Percentage of tasks completed successfully
- **Code-Based Grade**: Structured output accuracy
- **Model-Based Grade**: Quality assessment
- **Error Rate**: Percentage of tasks with errors

### Rule Compliance Metrics

- **Compliance Rate**: Percentage of files compliant
- **Violation Count**: Total number of violations
- **Warning Count**: Total number of warnings
- **Files Checked**: Number of files evaluated
- **Rules Tested**: Number of rules applied

### Workflow Quality Metrics

- **Step Success Rate**: Percentage of steps completed successfully
- **Artifact Completeness**: Percentage of required artifacts created
- **Execution Time**: Average time to complete workflow
- **Quality Gate Pass Rate**: Percentage of gates passed

## Troubleshooting

### Evaluation Fails

- Check dataset format (valid JSONL)
- Verify agent files exist
- Ensure API keys are set
- Check file permissions

### Low Scores

- Review evaluation criteria
- Check if tasks are appropriate
- Verify expected outputs are correct
- Consider adjusting difficulty

### Missing Results

- Check output directory exists
- Verify write permissions
- Review error logs
- Check script execution

## Related Documentation

- [Evaluation Framework](../evaluation/README.md) - Framework overview
- [Rule Auditor](../skills/rule-auditor/SKILL.md) - Rule compliance
- [Agent Performance](./AGENT_PERFORMANCE.md) - Performance metrics

## References

- [Promptfoo Documentation](https://promptfoo.dev/docs/)
- [Claude Cookbooks - Building Evals](https://github.com/anthropics/anthropic-cookbook/tree/main/misc/building_evals.ipynb)
