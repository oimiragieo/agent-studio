# Specification Mode Guide

Specification Mode transforms simple feature descriptions into production-ready code with automatic planning and safety checks.

## How It Works

1. **Simple Input**: Describe what you want in 4-6 sentences
2. **Automatic Planning**: Droid creates detailed specs and implementation plans
3. **Review & Approval**: Review the complete plan before any code changes
4. **Safe Execution**: Implementation only begins after approval

## Activation

**Manual activation only:**
- Press `Shift+Tab` while in the CLI to enter Specification Mode
- The status banner shows "Spec Mode" when active
- Does not automatically activate

## What Happens During Planning

### Analysis Phase (Read-Only)

Droid performs comprehensive analysis:
- Examines existing codebase and patterns
- Reviews related files and dependencies
- Studies your `AGENTS.md` conventions
- Gathers context from external sources

**Safety guarantee**: Cannot edit files, run modifying commands, or create/delete files during analysis.

### Planning Phase

Droid generates:
- Complete specification with acceptance criteria
- Technical implementation plan
- File-by-file breakdown of changes needed
- Testing strategy and verification steps
- Security and compliance considerations
- Dependencies and potential conflicts

## Writing Effective Requests

### Focus on Outcomes

Describe what the software should accomplish, not how to build it:

```
Users need to be able to reset their passwords using email verification. The reset link should expire after 24 hours for security. Include rate limiting to prevent abuse.
```

### Include Important Constraints

```
Add user data export functionality that works for accounts up to 5GB. Must comply with GDPR and include audit logging. Should complete within 10 minutes and not impact application performance.
```

### Reference Existing Patterns

```
Add a notification system similar to how we handle email confirmations. Use the same background job pattern as our existing report generation. Follow the authentication patterns we use for other sensitive operations.
```

### Be Specific About Verification

Tell droid how to confirm implementation works:
- Run specific tests
- Check service startup
- Verify UI matches mockups
- Validate API responses

### Consider Full User Journey

Describe the complete experience:
- Happy path through the feature
- Error scenarios and edge cases
- Loading and empty states
- Accessibility requirements

## Breaking Down Large Features

Specification Mode works best for features that:
- Touch multiple files
- Require architectural decisions
- Need coordination across components
- Have significant business logic

For smaller changes, direct execution is more efficient.

## Specification Approval Options

When reviewing a specification:

1. **Approve as-is**: Droid proceeds with implementation
2. **Request changes**: Ask for modifications to the plan
3. **Enable Auto-Run**: Choose autonomy level (Low/Medium/High) for implementation
4. **Cancel**: Abandon the specification

## Saving Specifications

Enable `specSaveEnabled: true` in settings to persist specs:
- Saved to `.factory/docs/` by default
- Customizable via `specSaveDir` setting
- Markdown format for easy review and sharing
- Links to implementation artifacts

## What Happens After Approval

After approving a specification:

1. Droid switches to implementation mode
2. Changes are made file-by-file
3. Each change is shown for review (unless Auto-Run is enabled)
4. Tests are run to verify implementation
5. Artifacts are published to Claude Projects

## AGENTS.md Integration

Specification Mode automatically reads your `AGENTS.md` files:
- Coding standards and conventions
- Testing requirements and frameworks
- Architecture patterns and principles
- Tooling and build processes

Ensure `AGENTS.md` files are up-to-date for best results.

## Enterprise Integration

### Security and Compliance

Specification Mode considers:
- Security requirements from `AGENTS.md`
- Compliance standards (GDPR, HIPAA, etc.)
- Access control and authorization patterns
- Audit logging and monitoring

### Team Standards

Plans align with:
- Project conventions from root `AGENTS.md`
- Framework-specific rules from subdirectory `AGENTS.md` files
- Quality gates and validation procedures
- Testing and deployment requirements

### Cross-Platform Handoff

- Specifications stored in `.factory/docs/` for traceability
- Artifacts published to Claude Projects
- Context synced with Cursor IDE sessions
- Links to GitHub issues or Linear tasks

## Best Practices

1. **Start broad, refine narrow**: Begin with outcome-focused descriptions, then request specific changes during review
2. **Reference existing code**: Mention similar implementations to guide patterns
3. **Include constraints early**: State performance, security, and compliance requirements upfront
4. **Think about testing**: Specify how to verify the feature works correctly
5. **Review carefully**: Take time to review the plan before approval
6. **Request changes freely**: Don't hesitate to ask for modifications to the specification

## Troubleshooting

### Specification is too vague

- Request more detail: "Expand the testing strategy section"
- Provide examples: "Use the same pattern as the user authentication feature"
- Add constraints: "Must use our existing database connection pool"

### Specification misses requirements

- Request additions: "Add rate limiting considerations to the specification"
- Reference external docs: "Include requirements from the PRD linked in the ticket"
- Specify integrations: "Add API integration details for the payment gateway"

### Implementation diverges from spec

- Return to spec review and request clarification
- Use direct mode for fine-tuning: "Update the error handling to match the spec"
- Check that `AGENTS.md` files are accurately reflecting conventions

