# Cursor Agent Coordination Guide

Adapted from BMAD-Spec Orchestrator coordination patterns for Cursor's multi-agent workflows.

## Multi-Agent Workflows in Cursor

Cursor 2.0 supports multiple agents working together through:
- Plan Mode artifacts (shared context)
- Cloud Agents (asynchronous execution)
- Handoff protocols (context transfer)

## Coordination Patterns

### 1. Sequential Agent Flow
```
Analyst → PM → Architect → Developer → QA
```
- Each agent builds on previous output
- Use Plan Mode to document handoffs
- Store artifacts for context sharing

### 2. Parallel Agent Execution
- Use Cloud Agents for independent tasks
- Sync results via Plan Mode artifacts
- Merge outputs in final integration step

### 3. Validation Workflow
```
Primary Agent → Validator Agent → Final Agent
```
- QA validates Developer output
- Architect validates PM requirements
- Cross-agent quality checks

## Handoff Protocol

When transferring work between agents:

1. **Save Current State**: Store plan artifacts and context
2. **Document Handoff**: Clear description of completed work
3. **Specify Next Steps**: What the receiving agent should do
4. **Provide Context**: Link to relevant files, plans, and artifacts
5. **Update Status**: Mark progress in session tracking

## Conflict Resolution

### When Agents Disagree
1. Document both perspectives
2. Reference project constitution or standards
3. Escalate to user if technical conflict
4. Use Architect for technical decisions
5. Use PM for product/requirement decisions

### Quality Gate Decisions
- QA agent has final authority on quality gates
- Architect has final authority on technical decisions
- PM has final authority on product decisions
- Document all resolution decisions

## Best Practices

- **Use Plan Mode**: Always create plans for multi-agent workflows
- **Document Handoffs**: Clear communication between agents
- **Preserve Context**: Use artifacts to maintain context
- **Track Progress**: Update session state after each agent completes work
- **Validate Outputs**: Cross-agent validation before proceeding

## Integration with Cursor Features

### Plan Mode
- Store workflow plans in `.cursor/plans/`
- Reference plans in agent prompts
- Update plans as work progresses

### Cloud Agents
- Offload long-running tasks to Cloud Agents
- Monitor progress via integrations (Slack, Linear, GitHub)
- Sync results back to local Cursor session

### Composer
- Use Composer for iterative, multi-step edits
- Escalate complex reasoning to Claude agents
- Combine Composer speed with Claude depth

