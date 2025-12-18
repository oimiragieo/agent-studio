# /code-quality

Launch a systematic code quality improvement workflow.

## Usage

```
/code-quality                    # Start code quality workflow
/code-quality src/components/    # Target specific directory
```

## Required Inputs

This workflow requires the following inputs to be provided when initializing:

### target_files
- **Type**: Array of strings
- **Description**: List of file or directory paths to analyze
- **Example**: `["src/", "lib/", "app/components/"]`
- **Required**: Yes

### coding_standards
- **Type**: String or array of strings
- **Description**: Coding standards to apply during analysis
- **Examples**: 
  - `"PEP 8"` (Python)
  - `"Airbnb JavaScript Style Guide"` (JavaScript)
  - `["Google Java Style", "Checkstyle"]` (Java)
- **Required**: Yes

## Providing Inputs

### Via Command Line (when using workflow runner directly)
```bash
node .opencode/tool/workflow_runner.js \
  --workflow .opencode/workflow/code-quality-flow.yaml \
  --step 0 \
  --id my-workflow-123 \
  --inputs '{"target_files": ["src/"], "coding_standards": "PEP 8"}'
```

### Via Orchestrator
The orchestrator should extract these inputs from the user's request:
- **target_files**: Extract from user request (e.g., "review src/components/")
- **coding_standards**: Extract from user request or use project defaults

### Via Environment Variables
```bash
export TARGET_FILES='["src/", "lib/"]'
export CODING_STANDARDS="PEP 8"
```

### Input Validation
- Inputs are validated before workflow execution (step 0)
- Missing required inputs will cause the workflow to fail with clear error messages
- All agents in the workflow receive these inputs as context variables

## Workflow

This command coordinates multiple agents for code quality improvement:

### 1. Code Reviewer
- Adherence to coding standards
- Design pattern usage
- Code complexity metrics
- Security considerations

### 2. Refactoring Specialist
- Prioritized refactoring tasks
- Dependency impact analysis
- Safe migration paths
- Risk mitigation strategies

### 3. QA
- Test coverage verification
- Regression testing
- Quality gate assessment
- Sign-off recommendation

## When to Use

- Addressing technical debt
- Pre-release code quality review
- Onboarding new team members
- Preparing for audits
- Code smell remediation

## Expected Outputs

- Detailed code analysis
- Prioritized refactoring plan
- Standards compliance status
- Final quality assessment

## See Also

- `/review` - Quick code review (single agent)
- `/audit` - Rule compliance check
