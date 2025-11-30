# LLM Rules Production Pack

## Overview
- **Type**: Multi-platform agent configuration bundle
- **Stack**: Claude Code, Cursor, Factory Droid with shared rule base
- **Agents**: 22 specialized agents with defined roles
- **Skills**: 6 utility skills for rule management and code generation
- **Rules**: 200+ technology-specific rule packs

This CLAUDE.md is authoritative. Subdirectories extend these rules.

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
| repo-rag | Codebase retrieval and symbol indexing | `.claude/skills/repo-rag/` |
| artifact-publisher | Publish artifacts to project feed | `.claude/skills/artifact-publisher/` |
| context-bridge | Sync state across Claude, Cursor, Factory | `.claude/skills/context-bridge/` |
| rule-auditor | Validate code against loaded rules | `.claude/skills/rule-auditor/` |
| rule-selector | Auto-detect stack and configure rules | `.claude/skills/rule-selector/` |
| scaffolder | Generate rule-compliant boilerplate | `.claude/skills/scaffolder/` |

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

### Safeguards (MUST NOT)
- **MUST NOT** delete secrets, env files, or production infrastructure manifests
- **MUST NOT** bypass lint/test hooks; rerun failed commands with context
- **MUST NOT** push directly to protected branches; use reviewed pull requests

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

### Git Workflow
- `git status`: Check working directory status
- `git diff`: View unstaged changes
- `git log --oneline`: View commit history

## Quick Find Commands

```bash
# Find agent definitions
find .claude/agents -name "*.md"

# Find rule packs
ls .claude/rules/

# Find templates
ls .claude/templates/

# Find schemas
ls .claude/schemas/
```

## Core Files

### Configuration
- `.claude/config.yaml`: Agent routing and workflow configuration
- `.claude/settings.json`: Tool permissions
- `CLAUDE.md`: This file (root instructions)

### Agent System
- `.claude/agents/`: 22 agent prompts
- `.claude/skills/`: 6 utility skills
- `.claude/workflows/`: 9 workflow definitions (see `WORKFLOW-GUIDE.md`)
- `.claude/templates/`: 14 artifact templates
- `.claude/schemas/`: JSON validation schemas

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
- `.claude/hooks/security-pre-tool.sh`: Security validation hook
- `.claude/hooks/audit-post-tool.sh`: Audit logging hook
- `.claude/system/guardrails/guardrails.md`: Command safety and PII policies
- `.claude/system/permissions/permissions.md`: Tool permission policies

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
.claude/
├── agents/        # 22 agent definitions
├── skills/        # 6 utility skills
├── commands/      # 12 slash commands
├── workflows/     # 9 workflow definitions
├── templates/     # Artifact templates
├── schemas/       # JSON schemas
├── rules/         # 200+ technology rule packs
├── hooks/         # Security hooks (shell scripts)
├── context/       # Runtime artifacts (gitignored)
├── config.yaml    # Agent routing
├── settings.json  # Tool permissions
└── CLAUDE.md      # This file

.cursor/           # Cursor IDE configuration
.factory/          # Factory Droid configuration
```

## Setup

1. Copy `.claude/`, `.cursor/`, `.factory/` into your project
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

# Check platform sync (Claude/Cursor/Factory parity)
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

- **Setup Guide**: `.claude/docs/setup-guides/CLAUDE_SETUP_GUIDE.md`
- **Workflow Guide**: `.claude/workflows/WORKFLOW-GUIDE.md`
- **Enterprise Guardrails**: `.claude/system/guardrails/` and `.claude/system/permissions/`
- **Agent Details**: `.claude/agents/` (each agent has full documentation)
- **Skill Details**: `.claude/skills/` (each skill has SKILL.md documentation)
- **Instructions**: `.claude/instructions/` (operational playbooks)

## MCP Integration (Optional)

The `.claude/.mcp.json` file contains optional MCP server configurations. This project does NOT ship an MCP server - these are configs consumed by Claude Code when you set the required environment variables:

| Server | Purpose | Environment Variable |
|--------|---------|---------------------|
| repo | Codebase search | None (auto-configured) |
| github | GitHub integration | `GITHUB_TOKEN` |
| linear | Linear issues | `LINEAR_API_KEY` |
| slack | Notifications | `SLACK_BOT_TOKEN` |
