# LLM Rules Production Pack for OpenCode

## Overview
- **Type**: Multi-platform agent configuration bundle
- **Stack**: OpenCode, Cursor, Factory Droid with shared rule base
- **Agents**: 22 specialized agents with defined roles
- **Skills**: 6 utility skills for rule management and code generation
- **Rules**: 200+ technology-specific rule packs

This OPENCODE.md is authoritative. Subdirectories extend these rules.

OpenCode has unique capabilities that set it apart from generic agent configurations:

1. **Strict Instruction Hierarchy**: OPENCODE.md content is treated as **immutable system rules** with strict priority over user prompts
2. **Hierarchical Memory System**: Reads OPENCODE.md files recursively UP from CWD to root, AND discovers them in subdirectories
3. **Hooks System**: Lifecycle hooks (PreToolUse, PostToolUse, UserPromptSubmit, Notification, Stop) for deterministic automation
4. **Model Context Protocol (MCP)**: Native integration with external tools, databases, and APIs
5. **Custom Slash Commands**: Repeatable workflows stored in `.opencode/command/`
6. **Subagents**: Specialized agents with isolated context windows and tool permissions
7. **Extended Thinking**: Can use long-form reasoning with extended context windows (1M+ tokens)

### Core Principles for OPENCODE.md

1. **OPENCODE.md is AUTHORITATIVE** - Treated as system rules, not suggestions
2. **Modular Sections** - Use clear markdown headers to prevent instruction bleeding
3. **Front-load Critical Context** - Large OPENCODE.md files provide better instruction adherence
4. **Hierarchical Strategy**: Root = universal rules; Subdirs = specific context
5. **Token Efficiency Through Structure** - Use sections to keep related instructions together
6. **Living Documentation** - Use `#` key during sessions to add memories organically

## Agents (22 Roles)

| Agent | Purpose | Model |
|-------|---------|-------|
| **Core Development** | | |
| orchestrator | Task routing and coordination | opus |
| model-orchestrator | Multi-model routing (Gemini, Cursor, etc.) | sonnet |
| analyst | Research and discovery | sonnet |
| pm | Product requirements, backlog, agile facilitation | sonnet |
| architect | System design, API design | opus |
| database-architect | Schema design, query optimization, migrations | opus |
| developer | Code implementation | sonnet |
| qa | Quality assurance and testing | opus |
| ux-expert | Interface design and UX | sonnet |
| **Enterprise** | | |
| security-architect | Security and compliance | opus |
| devops | Infrastructure, SRE, release management | sonnet |
| technical-writer | Documentation | haiku |
| **Code Quality** | | |
| code-reviewer | Systematic code review, PR analysis | opus |
| refactoring-specialist | Code transformation, tech debt reduction | opus |
| performance-engineer | Performance optimization, profiling | opus |
| **Specialized** | | |
| llm-architect | AI/LLM system design, RAG, prompt engineering | opus |
| api-designer | REST/GraphQL/gRPC API design | opus |
| legacy-modernizer | Legacy system modernization | opus |
| mobile-developer | iOS/Android/React Native/Flutter | sonnet |
| accessibility-expert | WCAG compliance, a11y testing | sonnet |
| compliance-auditor | GDPR/HIPAA/SOC2/PCI-DSS | opus |
| incident-responder | Crisis management, post-mortems | sonnet |

## Skills (6 Utilities)

Skills extend agent capabilities. Invoke with natural language or the Skill tool.

| Skill | Purpose | Location |
|-------|---------|----------|
| repo-rag | Codebase retrieval and symbol indexing | `.opencode/skill/repo-rag/` |
| artifact-publisher | Publish artifacts to project feed | `.opencode/skill/artifact-publisher/` |
| context-bridge | Sync state across OpenCode, Cursor, Factory | `.opencode/skill/context-bridge/` |
| rule-auditor | Validate code against loaded rules | `.opencode/skill/rule-auditor/` |
| rule-selector | Auto-detect stack and configure rules | `.opencode/skill/rule-selector/` |
| scaffolder | Generate rule-compliant boilerplate | `.opencode/skill/scaffolder/` |

### Skill Invocation

**Natural Language** (recommended):
```
"Audit src/components/ for rule violations"
"Scaffold a new UserProfile component"
"Select the right rules for this project"
"Search for authentication patterns"
```

**Skill Tool** (programmatic):
```
Skill: rule-auditor
Skill: scaffolder
Skill: rule-selector
```

### Skill Integration Points

| Workflow Stage | Skill | Purpose |
|----------------|-------|---------|
| Project Setup | rule-selector | Configure optimal rules for tech stack |
| Code Generation | scaffolder | Generate rule-compliant boilerplate |
| Implementation | repo-rag | Search codebase for patterns |
| Code Review | rule-auditor | Validate compliance before commit |
| Cross-Platform | context-bridge | Sync state to Cursor/Factory |
| Documentation | artifact-publisher | Publish to project feed |

### Recommended Skill Workflows

**New Project Setup:**
1. `rule-selector` → Detect stack, configure manifest.yaml
2. `scaffolder` → Generate initial components
3. `rule-auditor` → Verify compliance

**Feature Development:**
1. `repo-rag` → Research existing patterns
2. `scaffolder` → Generate new code
3. Developer implements logic
4. `rule-auditor` → Pre-commit validation

**Code Review:**
1. `rule-auditor` → Automated compliance check
2. QA agent validates quality gates
3. `artifact-publisher` → Document results

## Universal Development Rules

### Code Quality (MUST)
- **MUST** create a Plan Mode artifact before modifying more than one file
- **MUST** generate or update automated tests covering critical paths before requesting merge
- **MUST** keep security controls (authz, secrets, PII) unchanged unless explicitly tasked
- **MUST** document decisions in Artifacts or repo ADRs when deviating from defaults

### Collaboration (SHOULD)
- **SHOULD** use OpenCode Projects instructions for shared vocabulary, business context, and tone
- **SHOULD** sync Cursor and Droid executions back into the OpenCode Project activity feed after major milestones
- **SHOULD** promote Artifacts to versioned documents for UI/UX deliverables
- **SHOULD** prefer OpenCode's built-in repo search and diff MCP skills over manual file browsing

### Safeguards (MUST NOT)
- **MUST NOT** delete secrets, env files, or production infrastructure manifests
- **MUST NOT** bypass lint/test hooks; rerun failed commands with context
- **MUST NOT** push directly to protected branches; use reviewed pull requests
- **MUST NOT** rely on hallucinated APIs—verify via docs or code search MCP

## Slash Commands

### Core Commands
| Command | Purpose |
|---------|---------|
| `/review` | Comprehensive code review |
| `/fix-issue <n>` | Fix GitHub issue by number |
| `/quick-ship` | Fast iteration for small changes |
| `/run-workflow` | Execute a workflow step with validation |

### Skill Commands
| Command | Purpose |
|---------|---------|
| `/select-rules` | Auto-detect tech stack and configure rules |
| `/audit` | Validate code against loaded rules |
| `/scaffold` | Generate rule-compliant boilerplate |

### Workflow Commands
| Command | Purpose |
|---------|---------|
| `/code-quality` | Code quality improvement workflow |
| `/performance` | Performance optimization workflow |
| `/ai-system` | AI/LLM system development workflow |
| `/mobile` | Mobile application workflow |
| `/incident` | Incident response workflow |

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

## Quick Find Commands

```bash
# Find agent definitions
find .opencode/agent -name "*.md"

# Find rule packs
ls .opencode/rules/

# Find templates
ls .opencode/template/

# Find schemas
ls .opencode/schema/
```

### Configuration Analysis
```bash
# Check agent routing configuration
cat .opencode/config.yaml | grep -A 5 "trigger_words"

# Verify MCP server configuration
cat .opencode/.mcp.json | jq '.mcpServers | keys'

# Check tool permissions
cat .opencode/settings.json | jq '.tool_permissions'
```

### Dependency Analysis
```bash
# Check package dependencies (if applicable)
pnpm why <package-name>

# Find unused dependencies
npx depcheck
```

## Core Files

### Configuration
- `.opencode/config.yaml`: Agent routing and workflow configuration
- `.opencode/settings.json`: Tool permissions
- `OPENCODE.md`: This file (root instructions)

### Agent System
- `.opencode/agent/`: 22 agent prompts
- `.opencode/skill/`: 6 utility skills
- `.opencode/workflow/`: 9 workflow definitions (see `WORKFLOW-GUIDE.md`)
- `.opencode/template/`: 14 artifact templates
- `.opencode/schema/`: JSON validation schemas

### Templates (14 Artifacts)

| Template | Agent | Purpose |
|----------|-------|---------|
| project-brief.md | analyst | Project discovery and brief |
| prd.md | pm | Product requirements |
| architecture.md | architect | System architecture |
| ui-spec.md | ux-expert | Interface specifications |
| test-plan.md | qa | Test strategy |
| implementation-plan.md | developer | Implementation plan |
| code-review-report.md | code-reviewer | Code review findings |
| performance-plan.md | performance-engineer | Performance optimization |
| llm-architecture.md | llm-architect | AI/LLM system design |
| incident-report.md | incident-responder | Incident post-mortem |
| refactor-plan.md | refactoring-specialist | Refactoring strategy |

### Security
- `.opencode/hook/security-pre-tool.sh`: Security validation hook
- `.opencode/hook/audit-post-tool.sh`: Audit logging hook
- `.opencode/system/guardrails.md`: Command safety and PII policies
- `.opencode/system/permissions.md`: Tool permission policies

## Security & Secrets Management

### Protected Operations
- **BLOCKED**: `.env*` files, `secrets/` directory, credential files
- **BLOCKED**: Dangerous commands (`rm -rf`, `sudo rm`, `mkfs`, `dd`)
- **BLOCKED**: Force push to main/master

### Tool Permissions
- **Always Allowed**: Read, Search
- **Require Confirmation**: Edit, Bash
- **Always Blocked**: Destructive operations

## Directory Structure

```
.opencode/
├── agent/         # 22 agent definitions
├── skill/         # 6 utility skills
├── command/       # 12 slash commands
├── workflow/      # 9 workflow definitions
├── template/      # Artifact templates
├── schema/        # JSON schemas
├── rules/         # 200+ technology rule packs
├── hook/          # Security hooks (shell scripts)
├── context/       # Runtime artifacts (gitignored)
├── config.yaml    # Agent routing
├── settings.json  # Tool permissions
└── OPENCODE.md    # This file

.cursor/           # Cursor IDE configuration
.factory/          # Factory Droid configuration
```

## Setup

1. Copy `.opencode/`, `.cursor/`, `.factory/` into your project
2. Agents activate based on task keywords
3. Use slash commands for quick workflows

### Validation (Optional)

After copying, validate your configuration:

```bash
# Install dependencies (optional - only for validation)
pnpm install

# Validate configuration files
pnpm validate

# Verbose output
pnpm validate:verbose

# Check platform sync (OpenCode/Cursor/Factory parity)
bash scripts/validate-sync.sh
```

**Note**: Validation requires Node.js 18+ and pnpm. The core configuration works without running validation.

## Quick Reference

### Skill Commands
```bash
# Setup - Configure rules for your stack
"Select rules for this project"
"What rules should I use for Next.js + TypeScript?"

# Generate - Create compliant code
"Scaffold a UserProfile component"
"Scaffold an API route for /api/users"
"Scaffold a FastAPI endpoint for orders"

# Validate - Check compliance
"Audit this file"
"Audit src/components/ against our rules"
"Check if this code follows our standards"

# Search - Find patterns
"Search for authentication patterns"
"How is error handling done in this codebase?"

# Sync - Cross-platform
"Sync this context to Cursor"
"Bridge session state to Factory"
```

### Agent Triggers
```bash
# Core Development
"Research the market for..." → analyst
"Create a PRD for..." → pm
"Design the architecture for..." → architect
"Design the database for..." → database-architect
"Implement the feature..." → developer
"Test this code..." → qa
"Design the UI for..." → ux-expert

# Enterprise
"Review security of..." → security-architect
"Deploy to production..." → devops
"Document this feature..." → technical-writer

# Code Quality
"Review this code..." → code-reviewer
"Refactor this function..." → refactoring-specialist
"Optimize performance..." → performance-engineer

# Specialized
"Design an AI system for..." → llm-architect
"Design the API for..." → api-designer
"Modernize this legacy code..." → legacy-modernizer
"Build a mobile app for..." → mobile-developer
"Check accessibility of..." → accessibility-expert
"Audit for GDPR compliance..." → compliance-auditor
"Handle this incident..." → incident-responder
```

## Documentation

- **Setup Guide**: `.opencode/docs/setup-guides/OPENCODE_SETUP_GUIDE.md`
- **Workflow Guide**: `.opencode/workflow/WORKFLOW-GUIDE.md`
- **Enterprise Guardrails**: `.opencode/system/` 
- **Agent Details**: `.opencode/agent/` (each agent has full documentation)
- **Skill Details**: `.opencode/skill/` (each skill has SKILL.md documentation)
- **Instructions**: `.opencode/instruction/` (operational playbooks)

## MCP Integration (Optional)

The `.opencode/.mcp.json` file contains optional MCP server configurations. This project does NOT ship an MCP server - these are configs consumed by OpenCode when you set the required environment variables:

| Server | Purpose | Environment Variable |
|--------|---------|---------------------|
| repo | Codebase search | None (auto-configured) |
| github | GitHub integration | `GITHUB_TOKEN` |
| linear | Linear issues | `LINEAR_API_KEY` |
| slack | Notifications | `SLACK_BOT_TOKEN` |

## OpenCode Context Management

### Memory System Best Practices
- **Use `#` key during sessions** to add memories organically to OPENCODE.md
- Review and refactor OPENCODE.md monthly to remove stale instructions
- Keep sections modular to prevent instruction bleeding between contexts
- Use hierarchical OPENCODE.md files: root for universal rules, subdirectories for specific contexts

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
- See `.opencode/command/` for available slash commands

## Escalation Playbook
1. Flag blockers in the OpenCode Project feed; attach the current artifact or plan.
2. Page the appropriate subagent (Architect vs. QA vs. PM) via OpenCode subagent commands.
3. If automation fails, fall back to manual CLI with the same rules and document the resolution artifact.

## References

[1] Anthropic, "Claude 3.5 Sonnet" (Jun 2024).  
[2] Anthropic, "Projects" (Jun 2024).  
[3] Cursor, "Introducing Cursor 2.0 and Composer" (Oct 29, 2025).  
[4] Cursor, "Introducing Plan Mode" (Oct 7, 2025).  
[5] Cursor, "Cloud Agents" (Oct 30, 2025).  
[6] Sid Bharath, "Factory.ai: A Guide To Building A Software Development Droid Army" (Sep 30, 2025).
