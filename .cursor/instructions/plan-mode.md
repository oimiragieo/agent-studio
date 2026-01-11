# Plan Mode Operating Procedure

Plan Mode gives Cursor agents a structured planning canvas that auto-researches the repo before coding [4]. This is essential for multi-file changes and complex features.

## Activation

1. **Automatic**: Hooks trigger Plan Mode when ≥2 files are affected (see `hooks/preflight-plan.json`)
2. **Manual**: Press `Shift+Tab` or run `/plan` command
3. **Agent Prompt**: Request Plan Mode explicitly in agent conversation

## Workflow

1. **Research Phase**: Cursor automatically researches the repository to understand dependencies
2. **Question Phase**: Answer clarifying questions to help agent resolve dependencies and understand requirements
3. **Plan Generation**: Review the generated markdown plan including:
   - File paths to be modified
   - Code diffs showing proposed changes
   - Test files and test scenarios
   - Dependencies and potential conflicts
4. **Edit Phase**: Edit the plan inline if needed before approval
5. **Approval**: Approve the plan to generate code
6. **Storage**: Plan is saved to `.cursor/plans/` and linked to chat transcript

## Best Practices

### Planning Structure

- Keep plan tasks ≤ 7 steps; split large efforts into multiple plans
- Order tasks by dependencies (implement base, then features)
- Include test scenarios alongside implementation steps
- Mark high-risk areas for extra validation

### Security Considerations

- Tag risk areas (security-critical code, authentication, data handling)
- Request validation passes for security-sensitive changes
- Review security implications in plan before approval

### Integration

- Attach plan links to Claude Artifacts for traceability
- Reference plans in Factory logs
- Use plans as handoff artifacts between agents
- Link plans to GitHub issues or Linear tasks

### Multi-Agent Workflows

- Use plans as single source of truth for Claude and Droid follow-up agents
- Store plan artifacts for context preservation
- Update plans as work progresses (create v2 if major changes)

## Planner Agent Integration

**Important Distinction**:

- **Plan Mode** (this document): Cursor's built-in UI feature for implementation-level planning. Activated with `Shift+Tab` or automatically via hooks.
- **Planner Agent** (`.cursor/subagents/planner.mdc`): A strategic planning persona that creates comprehensive plans, coordinates specialists, and validates execution.

**How They Work Together**:

- **Planner Agent** creates strategic, multi-agent coordination plans (saved to `.claude/context/artifacts/`)
- **Plan Mode** handles implementation-level planning for multi-file code changes (saved to `.cursor/plans/`)
- Strategic plans from Planner Agent can be referenced in Plan Mode for detailed implementation
- Use Planner Agent for complex workflows requiring multiple specialist agents
- Use Plan Mode for direct code implementation planning

**Example Workflow**:

1. Planner Agent creates strategic plan with Analyst → PM → Architect coordination
2. Plan Mode references the strategic plan for implementation details
3. Developer uses Plan Mode to plan specific file changes
4. Plans are linked for full traceability

## Agent Integration

### Developer Agent

- Always use Plan Mode before modifying multiple files
- Create implementation plans for complex features
- Include test plans alongside code changes
- Reference existing architecture in plans

### Architect Agent

- Use Plan Mode for architectural refactoring
- Document architectural decisions in plan
- Include migration steps in plan

### QA Agent

- Review plans for test coverage
- Validate plan includes all necessary test scenarios
- Check requirements traceability in plans

### Planner Agent

- Creates strategic plans that can be referenced in Plan Mode
- Coordinates with specialists before implementation planning
- Validates plan completeness and feasibility
- Links strategic plans to Plan Mode artifacts for implementation

[4] Cursor, "Introducing Plan Mode" (Oct 7, 2025).
