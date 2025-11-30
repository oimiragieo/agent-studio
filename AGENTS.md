# LLM-RULES Project - Agent Configuration

Multi-platform agent configuration bundle for Claude Code, Cursor IDE, and Factory Droid.

## Core Principles

1. **Nearest-wins hierarchy** - Agents read the closest AGENTS.md to the file being edited
2. **JIT (Just-In-Time) indexing** - Provide paths/globs/commands, NOT full content
3. **Token efficiency** - Small, actionable guidance over encyclopedic documentation
4. **Cross-platform skills** - Skills work across Claude, Cursor, and Factory

## Quick Commands

### Validation
```bash
pnpm validate          # Validate agent configuration files
pnpm validate:verbose  # Verbose validation output
bash scripts/validate-sync.sh  # Validate cross-platform sync
```

### Code Discovery
```bash
# Find agent definitions
find .claude/agents -name "*.md"
find .cursor/subagents -name "*.mdc"
find .factory/droids -name "*.md"

# Find skill definitions
find .claude/skills -name "SKILL.md"
find .cursor/skills -name "*.md"
find .factory/skills -name "*.md"

# Find rule files
find .claude/rules -type d | head -20

# Find hook files
find .claude/hooks -name "*.sh"
```

## Directory Structure

```
LLM-RULES/
├── .claude/              # Claude Code configuration (primary)
│   ├── agents/          # 22 specialized agent prompts
│   ├── skills/          # 6 utility skills
│   ├── workflows/       # Orchestration workflows
│   ├── commands/        # Custom slash commands
│   ├── hooks/           # Native Claude Code hooks
│   ├── templates/       # Reusable artifact templates
│   ├── schemas/         # JSON schemas for validation
│   ├── rules/           # Framework-specific rules (200+)
│   ├── context/         # Runtime artifacts (gitignored)
│   ├── instructions/    # Operational playbooks
│   └── CLAUDE.md        # Core configuration
├── .cursor/             # Cursor IDE configuration
│   ├── subagents/       # Agent definitions (.mdc)
│   ├── skills/          # Utility skills (mirrored from Claude)
│   ├── rules/           # Technology rules
│   └── hooks/           # Lifecycle hooks
├── .factory/            # Factory Droid configuration
│   ├── droids/          # Droid definitions
│   ├── skills/          # Utility skills (mirrored from Claude)
│   ├── rules/           # Technology rules
│   └── hooks/           # Lifecycle hooks
├── AGENTS.md            # This file
└── README.md            # Project overview
```

## Agents (22 Roles)

| Agent | Purpose | Model |
|-------|---------|-------|
| **Core Development** | | |
| orchestrator | Task routing and coordination | opus |
| model-orchestrator | Multi-model routing (Gemini, Cursor, etc.) | sonnet |
| analyst | Research and discovery | sonnet |
| pm | Product requirements and roadmaps | sonnet |
| architect | System design and API design | opus |
| database-architect | Schema design, query optimization, migrations | opus |
| developer | Code implementation | sonnet |
| qa | Quality assurance and testing | opus |
| ux-expert | Interface design and UX | sonnet |
| **Enterprise** | | |
| security-architect | Security and compliance | opus |
| devops | Infrastructure and deployment | sonnet |
| technical-writer | Documentation | haiku |
| **Code Quality** | | |
| code-reviewer | Systematic code review | opus |
| refactoring-specialist | Code transformation and debt reduction | opus |
| performance-engineer | Performance optimization and profiling | opus |
| **Specialized** | | |
| llm-architect | AI/LLM system design, RAG, prompt engineering | opus |
| api-designer | REST/GraphQL/gRPC API design | opus |
| legacy-modernizer | Legacy system modernization | opus |
| mobile-developer | iOS/Android/React Native/Flutter | sonnet |
| accessibility-expert | WCAG compliance, a11y testing | sonnet |
| compliance-auditor | GDPR/HIPAA/SOC2/PCI-DSS | opus |
| incident-responder | Crisis management and post-mortems | sonnet |

## Skills (6 Utilities)

Skills work across all three platforms with platform-specific implementations.

| Skill | Purpose | Claude | Cursor | Factory |
|-------|---------|--------|--------|---------|
| repo-rag | Codebase retrieval and indexing | `.claude/skills/repo-rag/` | `.cursor/skills/repo-rag.md` | `.factory/skills/repo-rag.md` |
| artifact-publisher | Publish artifacts to project feed | `.claude/skills/artifact-publisher/` | `.cursor/skills/artifact-publisher.md` | `.factory/skills/artifact-publisher.md` |
| context-bridge | Sync state across platforms | `.claude/skills/context-bridge/` | `.cursor/skills/context-bridge.md` | `.factory/skills/context-bridge.md` |
| rule-auditor | Validate code against rules | `.claude/skills/rule-auditor/` | `.cursor/skills/rule-auditor.md` | `.factory/skills/rule-auditor.md` |
| rule-selector | Auto-configure rules for stack | `.claude/skills/rule-selector/` | `.cursor/skills/rule-selector.md` | `.factory/skills/rule-selector.md` |
| scaffolder | Generate rule-compliant code | `.claude/skills/scaffolder/` | `.cursor/skills/scaffolder.md` | `.factory/skills/scaffolder.md` |

### Skill Invocation by Platform

**Claude Code:**
```
"Audit this file against our rules"
"Scaffold a UserProfile component"
"Select rules for this project"
```

**Cursor IDE:**
```
Use @rule-auditor to check this code
Use @scaffolder to create a new component
Use @rule-selector to configure rules
```

**Factory Droid:**
```
Run Task tool with skill rule-auditor
Run Task tool with skill scaffolder
Run Task tool with skill rule-selector
```

## Security

### Blocked Operations
- `rm -rf`, `sudo rm`, `format`, `dd`, `mkfs`
- Force push to main/master
- Editing `.env*` files or secrets

### Tool Permissions
- **Read-only agents**: analyst, pm, ux-expert, technical-writer
- **Edit agents**: architect (docs only), developer (code), devops (infra)
- **Bash agents**: developer (safe), devops (safe), qa (test commands)

## Git Conventions

### Branching
- Feature branches: `feature/add-auth`, `fix/login-bug`
- Create from `main` or `develop`

### Commits
- Clear, descriptive messages
- Reference issues: `fix: Resolve login issue (#123)`
- Co-author trailer when AI assists

## Definition of Done

- [ ] Code follows project standards (check `.claude/rules/`)
- [ ] Tests written and passing
- [ ] No linting errors
- [ ] Security review completed
- [ ] Documentation updated
