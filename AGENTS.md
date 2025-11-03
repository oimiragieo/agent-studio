# LLM-RULES Project - Agent Configuration

This is a multi-platform agent configuration bundle supporting Claude Code, Cursor IDE, and Factory Droid with shared rule base.

## Core Principles

This AGENTS.md follows a **hierarchical, token-efficient approach**:

1. **Root AGENTS.md is LIGHTWEIGHT** - Only universal guidance, links to sub-files (~100-200 lines max)
2. **Nearest-wins hierarchy** - Agents read the closest AGENTS.md to the file being edited
3. **JIT (Just-In-Time) indexing** - Provide paths/globs/commands, NOT full content
4. **Token efficiency** - Small, actionable guidance over encyclopedic documentation
5. **Sub-folder AGENTS.md files have MORE detail** - Specific patterns, examples, commands

## Build & Test

### Core Commands
- **Type-check and lint**: `pnpm check`
- **Auto-fix style**: `pnpm check:fix`
- **Run full test suite**: `pnpm test --run --no-color`
- **Run a single test file**: `pnpm test --run <path>.test.ts`
- **Build project**: `pnpm run build`
- **Install dependencies**: `pnpm install`

### Development Workflow
- `pnpm run typecheck`: Run TypeScript type checking
- `pnpm run lint`: Run linter
- `pnpm test --watch`: Run tests in watch mode
- `pnpm coverage`: Generate test coverage report

### Quality Gates
- Run lint before committing changes
- All tests must pass before merging PRs
- Type checking must pass without errors
- Coverage should maintain or improve current levels

## JIT Index (Directory Map)

**What to open, not what to paste** - Use these to discover patterns, don't load full files into context.

### Package Structure

- **Claude Code**: `.claude/` → [see .claude/CLAUDE.md](.claude/CLAUDE.md)
- **Cursor IDE**: `.cursor/` → [see .cursor/AGENTS.md](.cursor/AGENTS.md) (if exists) or [.cursorrules](.cursor/.cursorrules)
- **Factory Droid**: `.factory/` → [see .factory/AGENTS.md](.factory/AGENTS.md)

### Quick Find Commands

**Code Discovery:**
```bash
# Find function definitions
rg -n "function\s+\w+" --type ts --type js --type tsx

# Find React components
rg -n "export\s+(function|const)\s+\w+.*Component" --type tsx --type jsx

# Find API routes/handlers
rg -n "export\s+(async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH)" --type ts --type js

# Find test files
find . -name "*.test.*" -o -name "*.spec.*" | grep -v node_modules

# Find configuration files
find . -name "*.config.*" -o -name "*.json" -o -name "*.yaml" | grep -v node_modules | head -20

# Search for specific patterns
rg -n "pattern-to-find" --type ts --type tsx --type js
```

**Agent Configuration Discovery:**
```bash
# Find agent definitions
find . -name "*.mdc" -o -name "*agent*.md" | grep -E "(cursor|factory|claude)"

# Find rule files
find . -path "*/.cursor/rules/*" -o -path "*/.claude/rules/*" | head -20

# Find hook files
find . -path "*/hooks/*" -name "*.yaml" -o -name "*.json" | head -20
```

**Pattern Discovery:**
```bash
# Find imports of a module
rg -n "import.*from ['\"]module-name['\"]" --type ts --type tsx

# Find where a function is called
rg -n "functionName\s*\(" --type ts --type js

# Find component usage
rg -n "<ComponentName" --type tsx --type jsx
```

## Architecture Overview

This project provides drop-in agent configurations for three platforms:

1. **Claude Code**: Hierarchical `CLAUDE.md` files, subagents, hooks, and artifacts system
2. **Cursor IDE**: Custom agents (`.mdc` files), Plan Mode, and Composer integration
3. **Factory Droid**: Custom droids, context layering, and enterprise integrations

### Directory Structure

```
production-dropin/
├── .claude/          # Claude Code configuration
│   ├── subagents/    # Specialized agent prompts
│   ├── hooks/        # Lifecycle hooks
│   ├── rules/        # Framework-specific rules
│   └── schemas/      # JSON schemas for validation
├── .cursor/          # Cursor IDE configuration
│   ├── subagents/    # Agent definitions (.mdc)
│   ├── hooks/        # Pre/post execution hooks
│   ├── instructions/ # Platform-specific guides
│   └── rules/        # Technology-specific rules
└── .factory/         # Factory Droid configuration
    ├── droids/       # Custom droid definitions
    ├── hooks/        # Pre/post run hooks
    ├── instructions/ # Droid usage guides
    └── skills/       # Context router and incident response
```

## Security

### Secrets Management
- **MUST NOT** commit secrets, tokens, or credentials
- Use environment variables for sensitive configuration
- Never hardcode API keys or authentication tokens
- Review `.gitignore` to ensure sensitive files are excluded

### Protected Operations
- Block dangerous commands (`rm -rf`, `sudo rm`, `format`, `dd`, `mkfs`)
- Require confirmation for destructive operations
- Validate changes to security-critical files
- Review authentication and authorization logic changes

### Droid Shield
- Enabled by default (`enableDroidShield: true`)
- Secret scanning before commits
- Git guardrails (no force push to main)
- Dangerous command blocking

## Git Workflows

### Branching Strategy
- Use feature branches for new work
- Create branches from `main` or `develop`
- Use descriptive branch names: `feature/add-auth`, `fix/login-bug`

### Commit Conventions
- Write clear, descriptive commit messages
- Include co-author trailer when Droid assists: `Co-authored-by: Droid <droid@factory.ai>`
- Group related changes in single commits
- Reference issue numbers: `fix: Resolve login issue (#123)`

### Pull Request Requirements
- All tests must pass
- Linting must pass without errors
- Type checking must succeed
- Code review required for main branch
- Update documentation for API changes

## Conventions & Patterns

### Code Style
- Follow framework-specific conventions (see `.cursor/rules/` and `.claude/rules/`)
- Use TypeScript for type safety
- Write clean, maintainable, and well-tested code
- Include comprehensive error handling
- Document complex logic and business rules

### Testing
- Write tests alongside implementation
- Achieve meaningful test coverage for business logic
- Use descriptive test names that explain behavior
- Focus on user behavior over implementation details
- Use Gherkin format (Given-When-Then) for integration tests

### Agent Configuration
- Agent definitions in `.cursor/subagents/*.mdc` and `.factory/droids/*.md`
- Rules in `.cursor/rules/` and `.claude/rules/`
- Hooks in `.cursor/hooks/`, `.claude/hooks/`, and `.factory/hooks/`
- Instructions in `.cursor/instructions/` and `.factory/instructions/`

### Data Format
- **TOON format** for token-efficient LLM prompts - Use for uniform tabular data
  - Claude: `.claude/rules/toon-format.md`
  - Cursor: `.cursor/rules/toon-format.md`
  - Factory: `.factory/instructions/toon-format.md`
- **JSON** for APIs, storage, and non-uniform structures

### File Naming
- Agent definitions: `agent-name.mdc` (Cursor) or `agent-name.md` (Droid)
- Hook files: `hook-name.yaml` or `hook-name.json`
- Rule files: Framework-specific naming in rules directories
- Instruction files: Descriptive names like `plan-mode.md`, `specification-mode.md`

## Cross-Platform Integration

### Context Management
- Use `AGENTS.md` files to document conventions (this file and subdirectory variants)
- Reference artifacts across platforms: `.cursor/plans/`, `.claude/context/artifacts/`, `.factory/docs/`
- Sync context between platforms using hooks and skills

### Artifact Publishing
- Publish specifications to Claude Projects
- Sync artifacts to Cursor and Droid contexts
- Maintain decision history across platforms
- Link artifacts to GitHub issues or Linear tasks

### Quality Gates
- Run linting and tests before committing
- Validate changes against schemas when available
- Review security implications of all changes
- Ensure cross-platform compatibility

## External Resources

### Documentation
- Claude Code: https://docs.claude.com/
- Cursor IDE: https://cursor.com/docs
- Factory Droid: https://docs.factory.ai/
- TOON Format: https://github.com/toon-format/toon (Spec: [SPEC.md](https://github.com/toon-format/toon/blob/main/SPEC.md))

### Integration Platforms
- GitHub: Issues, PRs, and repository context
- Linear: Tasks, projects, and team workflows
- Confluence: Architecture and design documentation
- Slack: Team notifications and alerts

## Definition of Done

Before marking work as complete or creating a PR, verify:

- [ ] Code follows project coding standards (check `.cursor/rules/` or `.claude/rules/`)
- [ ] Tests written and passing (unit, integration as applicable)
- [ ] No linting errors (`pnpm lint` or equivalent)
- [ ] Type checking passes (`pnpm typecheck` or equivalent)
- [ ] Security review completed (no secrets, proper validation)
- [ ] Documentation updated (README, inline comments, JSDoc)
- [ ] Plan Mode plan reviewed and approved (for multi-file changes in Cursor)
- [ ] Specification reviewed and approved (for complex features in Droid)
- [ ] Agent prompt references checked (if modifying agent behavior)
- [ ] Cross-platform compatibility verified (if relevant)

## Best Practices

1. **Document conventions once**: Use `AGENTS.md` files instead of repeating in prompts
2. **Use JIT indexing**: Reference file paths and use quick find commands, don't paste full files
3. **Reference existing patterns**: Mention similar code when requesting changes (e.g., "Follow pattern from `src/components/Button.tsx`")
4. **Set clear boundaries**: Specify scope of changes in prompts (e.g., "Only modify files in the auth directory")
5. **Verify with tests**: Always include test requirements in feature requests
6. **Review before committing**: Check changes even in Auto-Run mode
7. **Preserve context**: Save artifacts and sync across platforms
8. **Use appropriate agents**: Choose specialized agents for domain-specific tasks
9. **Token efficiency**: Keep prompts focused; use JIT commands to discover patterns
10. **Nearest-wins**: Create subdirectory `AGENTS.md` files for area-specific detailed guidance

