# Context Management Guide

## Overview

This document describes how to manage context across agent sessions, maintain state, and ensure information continuity throughout the development workflow.

## Context Types

### Session Context

- Current conversation state
- Active agent and workflow
- User preferences and settings
- Temporary working data

### Project Context

- Project configuration
- Technology stack
- Architectural decisions
- Team conventions

### Artifact Context

- Generated documents
- Code files
- Test results
- Review comments

## Context Storage Structure

```
.opencode/context/
├── artifacts/           # Generated documents and outputs
│   ├── prd/            # Product requirements
│   ├── architecture/   # Architecture documents
│   ├── specs/          # Technical specifications
│   └── reviews/        # Review feedback
├── audit/              # Audit logs and history
│   ├── decisions/      # Decision records
│   ├── changes/        # Change logs
│   └── reviews/        # Review history
└── sessions/           # Session state (if persisted)
```

## Context Loading

### Priority Order

1. **Immediate Context**: Current file, current task
2. **Session Context**: Current session state
3. **Project Context**: Project-wide configuration
4. **Historical Context**: Previous decisions, patterns

### Lazy Loading

- Load context on-demand, not upfront
- Cache frequently accessed context
- Evict stale context periodically

### Context Size Management

```yaml
context_limits:
  max_files: 10
  max_tokens: 50000
  priority:
    - current_file
    - related_files
    - project_config
    - recent_history
```

## Context Preservation

### Between Agents

When handing off between agents:

1. Summarize key decisions
2. List active requirements
3. Document open questions
4. Provide artifact references

### Between Sessions

For long-running projects:

1. Persist critical state
2. Document stopping point
3. Create resumption summary
4. Archive completed work

### Checkpoint Format

```yaml
checkpoint:
  timestamp: '2025-01-01T10:00:00Z'
  agent: architect
  workflow_step: 3
  completed:
    - project_brief
    - prd_v1
  in_progress:
    - system_architecture
  pending:
    - implementation_plan
  notes: 'Waiting for user decision on database choice'
```

## Context Refresh

### When to Refresh

- User provides new information
- External dependencies change
- Project configuration updates
- Time-sensitive data expires

### Refresh Strategy

```javascript
async function refreshContext(trigger) {
  switch (trigger) {
    case 'user_input':
      return mergeUserContext(currentContext, newInput);
    case 'file_change':
      return reloadFileContext(changedFiles);
    case 'periodic':
      return validateAndRefresh(currentContext);
    default:
      return currentContext;
  }
}
```

## Context Sharing

### Cross-Agent Sharing

- Use structured handoff documents
- Reference artifacts by ID
- Avoid duplicating large content
- Maintain single source of truth

### User Visibility

- Provide context summary on request
- Show relevant context in outputs
- Allow user to modify context
- Support context export

## Best Practices

### Do

- Keep context focused and relevant
- Use references instead of copies
- Version control context changes
- Document context decisions

### Don't

- Load entire codebase into context
- Duplicate information across agents
- Ignore context size limits
- Skip context validation

## Troubleshooting

### Missing Context

```
Issue: Required context not found
Check:
1. Verify artifact exists in expected location
2. Check file permissions
3. Validate reference syntax
4. Ensure previous step completed
```

### Stale Context

```
Issue: Context data is outdated
Resolution:
1. Trigger context refresh
2. Reload from source files
3. Clear cached data
4. Re-run previous step if needed
```

### Context Conflicts

```
Issue: Conflicting information from multiple sources
Resolution:
1. Identify conflict sources
2. Determine authoritative source
3. Reconcile differences
4. Update non-authoritative sources
```
