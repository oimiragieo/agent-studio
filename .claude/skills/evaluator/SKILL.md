---
name: evaluator
description: Evaluates agent performance, rule compliance, and workflow quality. Provides systematic evaluation using code-based, model-based, and human grading methods.
allowed-tools: read, write, grep, glob, bash
version: 1.0
best_practices:
  - Use code-based grading for structured outputs
  - Use model-based grading for quality assessment
  - Create comprehensive test datasets
  - Run evaluations regularly
error_handling: graceful
streaming: supported
---

# Evaluator Skill

## Identity

Evaluator - Provides systematic evaluation of agent performance, rule compliance, and workflow quality.

## Capabilities

- **Agent Performance Evaluation**: Test agents on task datasets
- **Rule Compliance Testing**: Validate code against loaded rules
- **Workflow Quality Assessment**: Evaluate workflow execution and outputs
- **Continuous Improvement**: Track metrics over time

## Evaluation Methods

### 1. Code-Based Grading

**Best for**: Exact matches, structured outputs, rule compliance

**Examples**:
- JSON schema validation
- Rule violation detection
- Test pass/fail counts
- File creation verification

**Usage**:
```
Evaluate agent output against expected structure
Check for required files and validation status
```

### 2. Model-Based Grading

**Best for**: Subjective quality, complex analysis, free-form outputs

**Examples**:
- Code quality assessment
- Architecture evaluation
- Documentation quality
- User experience evaluation

**Usage**:
```
Evaluate code quality on scale of 0-1
Assess architecture decisions
Review documentation completeness
```

### 3. Human Grading

**Best for**: Final validation, critical decisions, complex scenarios

**Examples**:
- Production readiness
- Security review
- Architecture approval
- User acceptance

**Usage**:
```
Request human review for critical decisions
Validate production readiness
Assess security implications
```

## Usage Patterns

### Evaluate Agent Performance

**When to Use**:
- After agent updates
- Testing new agent capabilities
- Validating agent improvements
- Benchmarking performance

**How to Invoke**:
```
"Evaluate developer agent performance"
"Run evaluation on architect agent"
"Test QA agent on test dataset"
```

**What It Does**:
- Loads evaluation dataset
- Runs agent on test tasks
- Grades outputs (code-based + model-based)
- Generates performance report

### Evaluate Rule Compliance

**When to Use**:
- Before committing code
- After rule updates
- Validating codebase compliance
- Testing new rules

**How to Invoke**:
```
"Evaluate rule compliance for src/components"
"Check if code follows TECH_STACK_NEXTJS rules"
"Audit codebase against loaded rules"
```

**What It Does**:
- Loads applicable rules
- Scans code files for violations
- Reports violations with line numbers
- Calculates compliance rate

### Evaluate Workflow Quality

**When to Use**:
- Testing workflow execution
- Validating workflow outputs
- Improving workflow efficiency
- Benchmarking workflows

**How to Invoke**:
```
"Evaluate greenfield-fullstack workflow"
"Test workflow execution quality"
"Assess workflow outputs"
```

**What It Does**:
- Executes workflow on test scenarios
- Validates step outputs
- Checks artifact completeness
- Measures workflow efficiency

## Evaluation Datasets

### Creating Test Datasets

**Agent Tasks Dataset** (`.claude/evaluation/datasets/agent-tasks.jsonl`):
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

**Rule Test Cases Dataset** (`.claude/evaluation/datasets/rule-test-cases.jsonl`):
```json
{
  "file": "src/components/Button.tsx",
  "rule": "TECH_STACK_NEXTJS.md",
  "expected_violations": [],
  "category": "component_structure"
}
```

## Integration

### With Rule Auditor

The evaluator works with the rule-auditor skill:
- Rule-auditor finds violations
- Evaluator measures compliance rate
- Both provide actionable feedback

### With Workflow Runner

The evaluator validates workflow execution:
- Workflow runner executes steps
- Evaluator validates outputs
- Both ensure quality gates

## Best Practices

1. **Create Comprehensive Datasets**: Cover common and edge cases
2. **Run Regularly**: Evaluate after major changes
3. **Track Metrics**: Monitor performance over time
4. **Iterate**: Use results to improve agents and rules
5. **Automate**: Integrate into CI/CD pipeline

## Examples

### Example 1: Agent Performance

```
User: "Evaluate developer agent performance"

Evaluator:
1. Loads agent-tasks.jsonl dataset
2. Runs developer agent on each task
3. Grades outputs (code-based + model-based)
4. Generates performance report
5. Saves to .claude/evaluation/results/developer-performance.json
```

### Example 2: Rule Compliance

```
User: "Evaluate rule compliance for src/components"

Evaluator:
1. Loads TECH_STACK_NEXTJS.md rules
2. Scans src/components/**/*.tsx files
3. Detects rule violations
4. Calculates compliance rate
5. Reports violations with fixes
```

### Example 3: Workflow Quality

```
User: "Evaluate greenfield-fullstack workflow"

Evaluator:
1. Executes workflow on test scenario
2. Validates each step output
3. Checks artifact completeness
4. Measures execution time
5. Generates quality report
```

## Related Skills

- **rule-auditor**: Finds rule violations
- **code-style-validator**: Validates code style
- **commit-validator**: Validates commit messages

## Related Documentation

- [Evaluation Guide](../docs/EVALUATION_GUIDE.md) - Comprehensive evaluation guide
- [Evaluation Framework](../evaluation/README.md) - Framework overview

