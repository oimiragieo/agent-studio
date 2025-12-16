# Evaluation Framework

## Overview

Systematic evaluation framework for agent performance, rule compliance, and workflow quality. Based on Promptfoo evaluation patterns from Claude Cookbooks.

## Purpose

- **Agent Performance**: Evaluate how well agents perform their tasks
- **Rule Compliance**: Test code against loaded rules
- **Workflow Quality**: Validate workflow execution and outputs
- **Continuous Improvement**: Track improvements over time

## Evaluation Methods

### 1. Code-Based Grading

**Best for**: Exact matches, structured outputs, rule compliance

**Examples**:
- Exact JSON schema validation
- Rule violation detection
- Test pass/fail counts
- Code coverage metrics

**Benefits**:
- Fast and reliable
- No API costs
- Deterministic results

### 2. Model-Based Grading

**Best for**: Subjective quality, complex analysis, free-form outputs

**Examples**:
- Code quality assessment
- Architecture evaluation
- Documentation quality
- User experience evaluation

**Benefits**:
- Handles complex evaluation
- Can evaluate subjective quality
- More flexible than code-based

### 3. Human Grading

**Best for**: Final validation, critical decisions, complex scenarios

**Examples**:
- Production readiness assessment
- Security review
- Architecture approval
- User acceptance testing

**Benefits**:
- Most capable evaluation method
- Handles edge cases
- Final authority

## Structure

```
.claude/evaluation/
├── README.md (this file)
├── promptfooconfig.yaml (base Promptfoo configuration)
├── agent-eval.py (agent performance evaluation)
├── rule-compliance-eval.py (rule compliance testing)
├── datasets/
│   ├── agent-tasks.jsonl
│   ├── rule-test-cases.jsonl
│   └── workflow-scenarios.jsonl
└── results/
    ├── agent-performance.json
    ├── rule-compliance.json
    └── workflow-quality.json
```

## Quick Start

### Evaluate Agent Performance

```bash
python .claude/evaluation/agent-eval.py \
  --agent developer \
  --dataset .claude/evaluation/datasets/agent-tasks.jsonl \
  --output .claude/evaluation/results/developer-performance.json
```

### Evaluate Rule Compliance

```bash
python .claude/evaluation/rule-compliance-eval.py \
  --files src/**/*.ts \
  --rules .claude/rules-master/TECH_STACK_NEXTJS.md \
  --output .claude/evaluation/results/rule-compliance.json
```

### Run Promptfoo Evaluation

```bash
npx promptfoo@latest eval -c .claude/evaluation/promptfooconfig.yaml
```

## Evaluation Datasets

### Agent Tasks Dataset

Format: `agent-tasks.jsonl`
```json
{
  "input": "Implement a user authentication API",
  "expected_output": {
    "files_created": ["api/auth/route.ts"],
    "tests_created": ["api/auth/route.test.ts"],
    "validation": "pass"
  },
  "agent": "developer",
  "category": "api_implementation"
}
```

### Rule Test Cases Dataset

Format: `rule-test-cases.jsonl`
```json
{
  "file": "src/components/Button.tsx",
  "rule": "TECH_STACK_NEXTJS.md",
  "expected_violations": [],
  "category": "component_structure"
}
```

### Workflow Scenarios Dataset

Format: `workflow-scenarios.jsonl`
```json
{
  "scenario": "greenfield-fullstack",
  "input": "Build a task management app",
  "expected_steps": ["analyst", "pm", "architect", "developer", "qa"],
  "expected_artifacts": ["project-brief.json", "prd.json", "architecture.json"]
}
```

## Integration with CI/CD

### GitHub Actions Example

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
      - run: |
          python .claude/evaluation/rule-compliance-eval.py \
            --files "src/**/*.ts" \
            --output compliance.json
```

## Best Practices

1. **Create Test Cases**: Build comprehensive test datasets
2. **Run Regularly**: Evaluate after major changes
3. **Track Metrics**: Monitor performance over time
4. **Iterate**: Use results to improve agents and rules
5. **Automate**: Integrate into CI/CD pipeline

## Related Documentation

- [Evaluation Guide](../docs/EVALUATION_GUIDE.md) - Comprehensive evaluation guide
- [Rule Compliance](../skills/rule-auditor/SKILL.md) - Rule auditing
- [Agent Performance](../docs/AGENT_PERFORMANCE.md) - Agent metrics

