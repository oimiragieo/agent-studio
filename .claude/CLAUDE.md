# LLM Rules Production Pack

## Overview
- **Type**: Multi-platform agent configuration bundle
- **Stack**: Claude Code, Cursor 2.0, Factory Droid with shared rule base
- **Architecture**: Claude Projects as source of truth, mirrored role prompts for Cursor/Droid, technology-specific rule packs
- **Primary Model**: Claude 3.5 Sonnet for reasoning + vision, fallback Sonnet API [1]

This CLAUDE.md is authoritative. Subdirectories extend these rules within the Claude Projects hierarchy.

## Critical Context: Claude Code Unique Capabilities

Claude Code has unique capabilities that set it apart from generic agent configurations:

1. **Strict Instruction Hierarchy**: CLAUDE.md content is treated as **immutable system rules** with strict priority over user prompts
2. **Hierarchical Memory System**: Reads CLAUDE.md files recursively UP from CWD to root, AND discovers them in subdirectories
3. **Hooks System**: Lifecycle hooks (PreToolUse, PostToolUse, UserPromptSubmit, Notification, Stop) for deterministic automation
4. **Model Context Protocol (MCP)**: Native integration with external tools, databases, and APIs
5. **Custom Slash Commands**: Repeatable workflows stored in `.claude/commands/`
6. **Subagents**: Specialized agents with isolated context windows and tool permissions
7. **Extended Thinking**: Can use long-form reasoning with extended context windows (1M+ tokens)

### Core Principles for CLAUDE.md

1. **CLAUDE.md is AUTHORITATIVE** - Treated as system rules, not suggestions
2. **Modular Sections** - Use clear markdown headers to prevent instruction bleeding
3. **Front-load Critical Context** - Large CLAUDE.md files provide better instruction adherence
4. **Hierarchical Strategy**: Root = universal rules; Subdirs = specific context
5. **Token Efficiency Through Structure** - Use sections to keep related instructions together
6. **Living Documentation** - Use `#` key during sessions to add memories organically

## Universal Development Rules

### Code Quality (MUST)
- **MUST** create a Plan Mode artifact before modifying more than one file; summarize dependencies and tests impacted.
- **MUST** generate or update automated tests covering critical paths before requesting merge.
- **MUST** keep security controls (authz, secrets, PII) unchanged unless explicitly tasked.
- **MUST** document decisions in Artifacts or repo ADRs when deviating from defaults.

### Collaboration (SHOULD)
- **SHOULD** use Claude Projects instructions for shared vocabulary, business context, and tone [2].
- **SHOULD** sync Cursor and Droid executions back into the Claude Project activity feed after major milestones.
- **SHOULD** promote Artifacts to versioned documents for UI/UX deliverables.
- **SHOULD** prefer Claude's built-in repo search and diff MCP skills over manual file browsing.

### Safeguards (MUST NOT)
- **MUST NOT** delete secrets, env files, or production infrastructure manifests.
- **MUST NOT** bypass lint/test hooks; rerun failed commands with context.
- **MUST NOT** push directly to protected branches; use reviewed pull requests.
- **MUST NOT** rely on hallucinated APIs—verify via docs or code search MCP.

## Platforms & Interfaces

### Claude Code (Primary)
- Launch tasks within the configured Claude Project; inherit root + path-specific CLAUDE.md instructions.
- Use Artifacts for live previews of code, docs, or UI prototypes and hand them off to collaborators [1].
- Apply Hooks under `.claude/hooks` to auto-run plan validation, linting, and artifact publication to Projects.

### Cursor IDE
- Composer provides low-latency multi-step coding; prefer Composer for iterative edits, and escalate to Claude for deep reasoning [3].
- Trigger Plan Mode (`Shift+Tab`) before large changes—Cursor researches the repo and stores a markdown plan under `.cursor/plans/` [4].
- Offload long-running refactors to Cloud Agents so work continues after the IDE closes [5].

### Factory Droid
- Invoke specialized Droids from CLI or IDE panes; layer repo context, design docs, and telemetry streams as contextual sources [6].
- Use checkpoint hooks (`hooks/`) to gate commits on test green, static analysis, and QA review.
- Share outputs back into Claude Projects to keep a single source of decision history.

## Hooks Policy
- **PreToolUse**: enforce plan creation, dependency diffing, and risk assessment before code generation.
- **UserPromptSubmit**: normalize prompts (role, tone, goal) and tag them for project analytics.
- **PostToolUse**: summarize changes, collect lint/test logs, publish Artifacts, and notify Factory Cloud agents when further work is required.

## Skills Inventory
- `skills/repo-rag.yaml`: registers repo/knowledge-base retrieval MCP endpoints.
- `skills/artifact-publisher.yaml`: pushes generated artifacts to the Claude Project activity feed.
- `skills/context-bridge.yaml`: syncs metadata across Claude, Cursor, and Droid sessions.

## Rule Packs
- Framework-specific `.md` and `.yaml` files in `rules/` enforce language conventions, testing standards, and deployment steps.
- Rules share identifiers across platforms so Cursor `.cursorrules` and Droid guidelines match the Claude truth source.

## Common Bash Commands

### Development Workflow
- `pnpm install`: Install project dependencies
- `pnpm run build`: Build the project
- `pnpm run typecheck`: Run TypeScript type checking
- `pnpm run lint`: Run linter
- `pnpm test`: Run test suite
- `pnpm test --watch`: Run tests in watch mode
- `pnpm test <file>`: Run specific test file

### Git Workflow
- `git status`: Check working directory status
- `git diff`: View unstaged changes
- `git log --oneline`: View commit history
- `gh issue view <number>`: View GitHub issue details
- `gh pr create`: Create pull request

### Code Quality
- Prefer running single test files for performance
- Always typecheck before committing
- Run linting before pushing changes

## Quick Find Commands (JIT Index)

### Code Navigation
```bash
# Find agent prompt files
rg -n "## <identity>|## <task>" .claude/subagents

# Find workflow definitions
rg -n "name:|agent:" .claude/workflows

# Find template references
rg -n "\.claude/templates/" .claude/subagents

# Find schema references
rg -n "\.claude/schemas/" .claude/subagents

# Find hook definitions
find .claude/hooks -name "*.yaml"
```

### Configuration Analysis
```bash
# Check agent routing configuration
cat .claude/config.yaml | grep -A 5 "trigger_words"

# Verify MCP server configuration
cat .claude/.mcp.json | jq '.mcpServers | keys'

# Check tool permissions
cat .claude/settings.json | jq '.tool_permissions'
```

### Dependency Analysis
```bash
# Check package dependencies (if applicable)
pnpm why <package-name>

# Find unused dependencies
npx depcheck
```

## Core Files and Utility Functions

### Configuration Files
- `.claude/config.yaml`: Agent routing and workflow configuration
- `.claude/settings.json`: Tool permissions and MCP server config
- `.claude/.mcp.json`: MCP server definitions
- `CLAUDE.md`: This file (root instructions)

### Agent System
- `.claude/subagents/`: Individual agent prompts, capabilities, and context
- `.claude/workflows/`: Workflow definitions (greenfield, brownfield)
- `.claude/templates/`: Reusable template files for artifacts
- `.claude/schemas/`: JSON schemas for artifact validation

### Workflow Artifacts
- `.claude/context/artifacts/`: Generated JSON artifacts from agents
- `.claude/context/history/reasoning/`: Extended thinking and reasoning outputs
- `.claude/context/history/gates/`: Quality gate validation results
- `.claude/context/session.json`: Current workflow session state

## Developer Environment Setup

### Prerequisites
- Node.js 18+ and pnpm installed
- Python 3.9+ (if using Python tools)
- GitHub CLI (`gh`) installed for GitHub integration
- Claude Code CLI installed and configured

### Initial Setup
1. Copy this folder structure into your project root
2. Configure MCP servers in `.claude/.mcp.json` (set API keys in environment)
3. Enable hooks in Claude Code: `Preferences → Claude Code → Hooks`
4. Verify agent routing in `.claude/config.yaml` matches your workflow

### Environment Variables
- `GITHUB_TOKEN`: For GitHub MCP integration (optional)
- `LINEAR_API_KEY`: For Linear integration (optional)
- `SLACK_BOT_TOKEN`: For Slack integration (optional)

### Repository Etiquette
- **Branch naming**: `feature/<short-description>`, `fix/<issue-number>`
- **Commits**: Use conventional commits (feat:, fix:, docs:, etc.)
- **Pull requests**: Reference issues, include testing notes
- **Merges**: Prefer squash and merge for cleaner history

## Security & Secrets Management

### Secrets Management
- **NEVER** commit tokens, API keys, or credentials to version control
- Use `.env.local` for local secrets (already in .gitignore)
- Use environment variables for CI/CD secrets
- PII must be redacted in logs and artifacts
- **MUST NOT** edit `.env`, `.env.production`, or secret configuration files

### Protected Files
- **BLOCKED**: `.env*` files, `secrets/` directory, production configs
- **REQUIRE APPROVAL**: Database migrations, infrastructure changes, auth configs
- **REVIEW BEFORE**: Git force push, destructive database operations, production deploys

### Safe Operations
- Review generated bash commands before execution
- Confirm before: `git push --force`, `rm -rf`, database drops, `dd` commands
- Use staging environment for risky operations
- Validate file paths before batch operations

## Available Tools & Permissions

### Standard Tools Available
- **Read**: Any file in the repository
- **Write**: Code files, documentation, configuration (except protected files)
- **Bash**: Safe commands (build, test, lint, typecheck, git status/diff/log)
- **MCP Tools**: Repo search, artifact publishing, context bridging (see `.claude/.mcp.json`)

### Tool Permission Rules
- ✅ **Always Allowed**: Read, Search, Git status/diff/log
- ⚠️ **Require Confirmation**: Edit, Bash (git commit/push), MCP tool execution
- ❌ **Always Blocked**: 
  - Edit `.env*` files or secrets
  - Bash: `rm -rf`, `format *`, `dd *`, `mkfs *`, force push
  - Dangerous Git operations without approval

### MCP Server Access
Configured MCP servers (see `.claude/.mcp.json`):
- **repo**: Repository search and codebase RAG
- **artifacts**: Artifact publishing to Claude Projects
- **github**: GitHub integration (requires `GITHUB_TOKEN`)
- **linear**: Linear integration (optional, requires `LINEAR_API_KEY`)
- **slack**: Slack notifications (optional, requires `SLACK_BOT_TOKEN`)

## Code Style Guidelines

### TypeScript/JavaScript
- Use ES modules (`import/export`) syntax, not CommonJS (`require`)
- Destructure imports when possible: `import { foo } from 'bar'`
- Prefer `const` over `let`, avoid `var`
- Use TypeScript strict mode

### File Organization
- Keep related files together
- Use descriptive, explicit names over short abbreviations
- Follow framework conventions (Next.js App Router, React component structure)

### Testing
- Write tests alongside implementation
- Use descriptive test names that explain expected behavior
- Focus on critical paths in E2E tests
- Maintain 80%+ coverage for business logic

## Examples & Workflows

### Example: Running Agent Workflow
```
1. User: "I need a new full-stack web app for task management"
2. Orchestrator detects greenfield_fullstack workflow
3. Analyst creates project brief
4. PM creates PRD with user stories
5. UX Expert designs interface
6. Architect designs system architecture
7. QA creates test plan
8. Developer implements features
9. QA validates quality gates
```

### Example: Using Slash Commands
- `/review`: Comprehensive code review
- `/fix-issue <number>`: Automatically fix GitHub issue
- Custom commands available in `.claude/commands/`

### Example: Multi-File Changes
1. Generate Plan Mode artifact first
2. Review impacted files and dependencies
3. Implement changes systematically
4. Run tests to verify
5. Create artifact summary

## Claude Code Context Management

### Memory System Best Practices
- **Use `#` key during sessions** to add memories organically to CLAUDE.md
- Review and refactor CLAUDE.md monthly to remove stale instructions
- Keep sections modular to prevent instruction bleeding between contexts
- Use hierarchical CLAUDE.md files: root for universal rules, subdirectories for specific contexts

### Session Management
- **Use `/clear`** between unrelated tasks to reset context window
- **Use `/compact`** for long sessions to optimize token usage
- **Reference specific files** with `@filename` rather than reading entire directories
- **Use artifacts** for multi-file outputs instead of large inline responses

### Custom Commands Strategy
- Start with 3-5 most common workflows
- Use descriptive names (e.g., `/review`, `/fix-issue`, not `/r`, `/fi`)
- Include validation steps in commands
- Use `$ARGUMENTS` for parameterized commands
- See `.claude/commands/` for available slash commands

## Escalation Playbook
1. Flag blockers in the Claude Project feed; attach the current artifact or plan.
2. Page the appropriate subagent (Architect vs. QA vs. PM) via Claude subagent commands.
3. If automation fails, fall back to manual CLI with the same rules and document the resolution artifact.

## References

[1] Anthropic, "Claude 3.5 Sonnet" (Jun 2024).  
[2] Anthropic, "Projects" (Jun 2024).  
[3] Cursor, "Introducing Cursor 2.0 and Composer" (Oct 29, 2025).  
[4] Cursor, "Introducing Plan Mode" (Oct 7, 2025).  
[5] Cursor, "Cloud Agents" (Oct 30, 2025).  
[6] Sid Bharath, "Factory.ai: A Guide To Building A Software Development Droid Army" (Sep 30, 2025).
