<command_description>
Command: /code-quality - Launch a systematic code quality improvement workflow.
</command_description>

<instructions>
<execution_steps>

```
/code-quality                    # Start code quality workflow
/code-quality src/components/    # Target specific directory
```

## What This Command Does

Invokes the **code-quality-flow** workflow with this agent sequence:

1. **Code Reviewer** - Systematic code analysis
   - Adherence to coding standards
   - Design pattern usage
   - Code complexity metrics
   - Security considerations

2. **Refactoring Specialist** - Transformation planning
   - Prioritized refactoring tasks
   - Dependency impact analysis
   - Safe migration paths
   - Risk mitigation strategies

3. **Compliance Auditor** - Standards validation
   - Industry standards (OWASP, etc.)
   - Coding guidelines compliance
   - Security best practices
   - Documentation requirements

4. **QA** - Final quality validation
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

## Outputs

- `code-review.json` - Detailed code analysis
- `refactoring-plan.json` - Prioritized improvement plan
- `compliance-report.json` - Standards compliance status
- `quality-report.json` - Final quality assessment

</execution_steps>

<output_format>
**Outputs**:
- `code-review.json` - Detailed code analysis
- `refactoring-plan.json` - Prioritized improvement plan
- `compliance-report.json` - Standards compliance status
- `quality-report.json` - Final quality assessment
</output_format>
</instructions>
