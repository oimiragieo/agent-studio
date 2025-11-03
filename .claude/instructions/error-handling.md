# BMAD-Spec Orchestrator Error Handling Guide

## Error Classification

### Critical Errors (Stop Execution)
- **Missing Core Files**: Required agent prompts, templates, or workflows not found
- **Invalid Configuration**: Core configuration files are corrupted or missing required fields
- **Security Violations**: Attempts to access unauthorized resources or execute dangerous operations
- **Data Corruption**: Session state or artifact corruption that prevents safe continuation

### Warning Errors (Continue with Caution)
- **Missing Optional Files**: Non-essential templates or tasks are unavailable
- **Partial Data**: Some context information is missing but workflow can continue
- **Version Mismatches**: Compatible but non-optimal versions of dependencies
- **Performance Issues**: Operations are slow but functional

### Recoverable Errors (Retry/Fix)
- **User Input Errors**: Invalid or incomplete user responses
- **Template Variable Errors**: Missing or incorrect template placeholder values
- **Agent Output Errors**: Malformed or incomplete agent responses
- **File Access Errors**: Temporary issues accessing files or resources

## Error Response Procedures

### For Critical Errors:
1. **Immediate Stop**: Halt all execution immediately
2. **Clear Error Message**: Explain exactly what went wrong and why it's critical
3. **Recovery Instructions**: Provide specific steps to fix the issue
4. **Safe State**: Ensure system is in a safe, recoverable state
5. **User Notification**: Inform user of the issue and required actions

### For Warning Errors:
1. **Continue Operation**: Allow workflow to proceed with limitations
2. **Log Warning**: Record the issue for later review
3. **User Notification**: Inform user of the limitation and potential impacts
4. **Workaround Suggestion**: Provide alternative approaches if available
5. **Monitor Progress**: Watch for related issues as workflow continues

### For Recoverable Errors:
1. **Identify Cause**: Determine the specific reason for the failure
2. **Suggest Fix**: Provide clear instructions for correction
3. **Allow Retry**: Enable user to retry after making corrections
4. **Track Attempts**: Monitor retry attempts to prevent infinite loops
5. **Escalate if Needed**: Convert to warning or critical if retries fail

## Specific Error Scenarios

### Agent Activation Failures
```
ERROR: Cannot load agent prompt for 'analyst'
CAUSE: File '.claude/agents/analyst/prompt.md' not found
RECOVERY: 
1. Check if the file exists in the correct location
2. Verify file permissions allow reading
3. Ensure the agent name is spelled correctly
4. Create missing agent files if necessary
```

### Template Processing Errors
```
ERROR: Missing template variable '{{project_name}}'
CAUSE: Required variable not provided by user or previous agent
RECOVERY:
1. Request missing variable from user
2. Check if variable should come from previous step
3. Verify template syntax is correct
4. Provide default value if appropriate
```

### Workflow State Errors
```
ERROR: Cannot proceed to step 3, step 2 not completed
CAUSE: Previous workflow step did not complete successfully
RECOVERY:
1. Review step 2 completion status
2. Complete any missing requirements from step 2
3. Validate step 2 outputs meet requirements
4. Update workflow state accordingly
```

### File System Errors
```
ERROR: Cannot write to '.claude/context/artifacts/prd.md'
CAUSE: File system permissions or disk space issues
RECOVERY:
1. Check available disk space
2. Verify write permissions for the directory
3. Ensure no file locks are preventing writes
4. Try alternative file location if needed
```

## Error Logging and Reporting

### Log Entry Format:
```
TIMESTAMP: 2024-01-01 12:34:56
LEVEL: ERROR|WARNING|INFO
COMPONENT: Agent|Workflow|Template|System
ERROR_CODE: BMAD_001
MESSAGE: Detailed error description
CONTEXT: Relevant system state information
USER_ACTION: Required user action (if any)
RESOLUTION: How the error was resolved
```

### Error Codes:
- **BMAD_001-099**: Agent-related errors
- **BMAD_100-199**: Workflow execution errors
- **BMAD_200-299**: Template processing errors
- **BMAD_300-399**: File system and I/O errors
- **BMAD_400-499**: User input and validation errors
- **BMAD_500-599**: System and configuration errors

## Recovery Strategies

### State Recovery:
- Maintain regular checkpoints at each workflow step
- Store partial results in recoverable format
- Enable resumption from any valid checkpoint
- Validate state integrity before continuing

### Data Recovery:
- Backup critical artifacts before modifications
- Maintain version history for all documents
- Enable rollback to previous valid state
- Verify data integrity after recovery

### User Communication:
- Provide clear, non-technical error explanations
- Offer specific actionable steps for resolution
- Indicate estimated time for fixes when possible
- Keep users informed of progress during recovery

## Prevention Strategies

### Input Validation:
- Validate all user inputs before processing
- Check file existence before attempting access
- Verify template completeness before rendering
- Confirm agent availability before activation

### Defensive Programming:
- Assume external resources may be unavailable
- Implement graceful degradation for non-critical features
- Use timeouts for potentially long-running operations
- Provide meaningful defaults where appropriate

### Testing and Monitoring:
- Test error conditions during development
- Monitor system health and performance
- Track error patterns and frequencies
- Implement automated recovery where possible

This error handling framework ensures robust, user-friendly operation of the BMAD-Spec Orchestrator System.