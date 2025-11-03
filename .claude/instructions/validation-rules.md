# BMAD-Spec Orchestrator Validation Rules

## Workflow Validation

### Before Starting Any Workflow:
- [ ] User request matches available workflow types
- [ ] Required inputs are provided or can be gathered
- [ ] No conflicting workflows are already in progress
- [ ] Session context is properly initialized

### During Workflow Execution:
- [ ] Each step completion is validated before proceeding
- [ ] Agent outputs match expected deliverable formats
- [ ] All template variables are properly populated
- [ ] Quality gates pass before advancing to next phase

### Workflow Completion:
- [ ] All required artifacts have been generated
- [ ] User acceptance criteria are met
- [ ] Documentation is complete and accurate
- [ ] Session state reflects successful completion

## Agent Validation

### Agent Activation:
- [ ] Correct agent prompt is loaded from `.claude/agents/[name]/prompt.md`
- [ ] Agent capabilities match the requested task
- [ ] Required context and inputs are available
- [ ] Previous agent outputs are accessible if needed

### Agent Output Validation:
- [ ] Output format matches template requirements
- [ ] All required sections are completed
- [ ] Technical specifications are accurate and complete
- [ ] Consistency with previous agent outputs is maintained

### Agent Handoffs:
- [ ] Handoff instructions are clear and complete
- [ ] Required artifacts are saved to context
- [ ] Next agent has all necessary inputs
- [ ] Session state is updated correctly

## Template and Task Validation

### Template Usage:
- [ ] Correct template is selected for the task
- [ ] All placeholder variables are identified
- [ ] User input is gathered for all required variables
- [ ] Template is populated correctly without syntax errors

### Task Execution:
- [ ] Task prerequisites are met
- [ ] Step-by-step instructions are followed
- [ ] Required files and resources are accessible
- [ ] Output meets task success criteria

## Quality Assurance

### Code Quality:
- [ ] Code follows established standards and patterns
- [ ] All functions have appropriate tests
- [ ] Error handling is properly implemented
- [ ] Security best practices are followed

### Documentation Quality:
- [ ] All sections are complete and accurate
- [ ] Technical details are sufficient for implementation
- [ ] Formatting is consistent with established standards
- [ ] References and sources are properly cited

### Process Quality:
- [ ] All required approval gates are passed
- [ ] User feedback is incorporated appropriately
- [ ] Changes are tracked and documented
- [ ] Rollback procedures are available if needed

## Error Conditions

### Validation Failures:
- **Missing Required Input**: Stop execution and request missing information
- **Invalid Template Variables**: Report specific errors and request corrections
- **Agent Capability Mismatch**: Suggest appropriate agent or task modification
- **Quality Gate Failure**: Provide specific feedback and remediation steps

### Recovery Procedures:
- **Partial Completion**: Save progress and allow resumption from last valid state
- **Context Loss**: Attempt recovery from artifacts and session files
- **Agent Errors**: Reset agent state and retry with corrected inputs
- **User Cancellation**: Clean up partial artifacts and reset session

## Success Criteria

### Workflow Success:
- All planned deliverables are created and validated
- User requirements are fully satisfied
- Quality standards are met or exceeded
- Documentation is complete and accurate

### System Success:
- No validation failures occur during execution
- All agent interactions proceed smoothly
- Context is maintained throughout the process
- User experience is positive and efficient

### Continuous Improvement:
- Validation failures are analyzed and addressed
- Process improvements are identified and implemented
- User feedback drives system enhancements
- Success patterns are documented and replicated