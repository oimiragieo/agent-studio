# /code-quality

Launch a systematic code quality improvement workflow.

## Usage

```
/code-quality                    # Start code quality workflow
/code-quality src/components/    # Target specific directory
```

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
