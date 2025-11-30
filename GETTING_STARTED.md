# Getting Started with LLM-RULES

Get up and running in 5 minutes.

> **Note**: This is a **drop-in configuration bundle**, not an SDK or MCP server. Simply copy the folders into your project - no installation, no dependencies, no build step required.

## Prerequisites

Before you begin, ensure you have:

| Requirement | Version | Required For | Verify Command |
|-------------|---------|--------------|----------------|
| Claude Code | Latest | Core functionality | `claude --version` |
| Git | 2.30+ | Version control | `git --version` |
| Node.js | 18+ | Validation scripts (optional) | `node --version` |
| pnpm | Latest | Validation dependencies (optional) | `pnpm --version` |

**Note**: Node.js and pnpm are only required if you want to run validation scripts or workflow gates. The core agent configuration works without them.

## Quick Install

### Step 1: Copy Configuration

```bash
# Clone or download this repo, then copy to your project:
cp -r .claude/ /path/to/your/project/
cp CLAUDE.md /path/to/your/project/
```

**Windows PowerShell:**
```powershell
Copy-Item -Path ".claude" -Destination "C:\path\to\your\project\.claude" -Recurse
Copy-Item -Path "CLAUDE.md" -Destination "C:\path\to\your\project\CLAUDE.md"
```

### Step 2: Verify Structure

Your project should look like this:

```
your-project/
├── CLAUDE.md           # Root instructions (required)
├── .claude/            # Configuration directory
│   ├── agents/         # 22 specialized agents
│   ├── skills/         # 6 utility skills
│   ├── workflows/      # 9 workflow definitions
│   ├── hooks/          # Security hooks
│   ├── commands/       # Slash commands
│   └── config.yaml     # Agent routing
└── [your source code]
```

### Step 3: Enable Hooks (Recommended)

1. Open Claude Code in your project
2. Go to **Preferences > Claude Code > Hooks**
3. Point to `.claude/hooks` directory
4. Enable security hooks

### Step 4: Test It Works

```
# Try a simple command
/review

# Or trigger an agent with keywords
"I need to design a database schema for user management"
→ [Routes to database-architect agent]
```

## Validation (Optional)

Validate your configuration after copying:

```bash
# Install validation dependencies
pnpm install

# Run validation
pnpm validate
```

**What it checks**:
- All referenced agent files exist
- All workflow YAML files are valid
- All schema files exist
- Hook configurations are valid

## Configuration Files

| File | Purpose |
|------|---------|
| `.claude/settings.json` | Default tool permissions and settings |
| `.claude/settings.local.json` | Local overrides (not committed) |
| `.claude/config.yaml` | Agent routing and trigger words |
| `.claude/.mcp.json` | MCP server configuration |

**Local Overrides**: Create `.claude/settings.local.json` to override settings without modifying the committed config. This file is gitignored.

## What You Get

### 22 Specialized Agents

| Agent | Purpose | Trigger Keywords |
|-------|---------|------------------|
| **Core Development** | | |
| analyst | Research & discovery | "market research", "competitive analysis" |
| pm | Product requirements | "prd", "user stories", "backlog" |
| architect | System design | "architecture", "api design" |
| database-architect | Database design | "database", "schema", "migration" |
| developer | Implementation | "implement", "code", "debug" |
| qa | Quality assurance | "test", "qa", "quality gate" |
| ux-expert | Interface design | "ux", "ui", "wireframe" |
| **Enterprise** | | |
| security-architect | Security & compliance | "security", "authentication" |
| devops | Infrastructure | "deployment", "ci/cd", "kubernetes" |
| technical-writer | Documentation | "documentation", "api docs" |
| orchestrator | Task routing | "coordinate", "workflow" |
| model-orchestrator | Multi-model routing | "use gemini", "call opus" |
| **Code Quality** | | |
| code-reviewer | Systematic code review | "code review", "pr review" |
| refactoring-specialist | Code transformation | "refactor", "code smell" |
| performance-engineer | Optimization | "performance", "optimize", "profiling" |
| **Specialized** | | |
| llm-architect | AI/LLM system design | "ai system", "llm", "rag" |
| api-designer | API design patterns | "api design", "rest api", "graphql" |
| legacy-modernizer | System modernization | "legacy", "modernize", "migration" |
| mobile-developer | Mobile development | "mobile", "ios", "android", "react native" |
| accessibility-expert | WCAG compliance | "accessibility", "wcag", "a11y" |
| compliance-auditor | Regulatory compliance | "gdpr", "hipaa", "soc2" |
| incident-responder | Crisis management | "incident", "outage", "post-mortem" |

### 9 Workflows

| Workflow | Use Case | Steps |
|----------|----------|-------|
| **quick-flow** | Bug fixes, small features | Developer → QA |
| **greenfield-fullstack** | New projects | Analyst → PM → UX → Architect → DB → QA → Dev → Docs → QA |
| **brownfield-fullstack** | Existing codebases | Impact analysis → Requirements → Architecture → Migration → Test → Implement |
| **enterprise-track** | Compliance-heavy projects | Full security review, compliance mapping, audit documentation |
| **code-quality-flow** | Code review & refactoring | Code-reviewer → Refactoring-specialist → Compliance-auditor → QA |
| **performance-flow** | Performance optimization | Performance-engineer → Architect → Developer → QA |
| **ai-system-flow** | AI/LLM features | Model-orchestrator → LLM-architect → API-designer → Developer → QA |
| **mobile-flow** | Mobile development | Mobile-developer → UX-expert → Developer → QA |
| **incident-flow** | Production incidents | Incident-responder → DevOps → Security-architect → QA |

### 12 Slash Commands

| Command | Purpose |
|---------|---------|
| **Core** | |
| `/review` | Comprehensive code review |
| `/fix-issue <n>` | Fix GitHub issue by number |
| `/quick-ship` | Fast iteration workflow |
| `/run-workflow` | Execute a specific workflow |
| **Skills** | |
| `/select-rules` | Auto-detect stack and configure rules |
| `/audit` | Validate code against loaded rules |
| `/scaffold` | Generate rule-compliant boilerplate |
| **Workflows** | |
| `/code-quality` | Code quality improvement workflow |
| `/performance` | Performance optimization workflow |
| `/ai-system` | AI/LLM system development workflow |
| `/mobile` | Mobile application workflow |
| `/incident` | Incident response workflow |

### 6 Utility Skills (Cross-Platform)

Skills work across all three platforms with consistent functionality.

| Skill | Purpose | Claude | Cursor | Factory |
|-------|---------|--------|--------|---------|
| `repo-rag` | Codebase retrieval | Natural language | `@repo-rag` | Task tool |
| `artifact-publisher` | Publish artifacts | Natural language | `@artifact-publisher` | Task tool |
| `context-bridge` | Cross-platform sync | Natural language | `@context-bridge` | Task tool |
| `rule-auditor` | Validate against rules | Natural language | `@rule-auditor` | Task tool |
| `rule-selector` | Auto-configure rules | Natural language | `@rule-selector` | Task tool |
| `scaffolder` | Generate compliant code | Natural language | `@scaffolder` | Task tool |

**Skill Locations:**
- Claude: `.claude/skills/*/SKILL.md`
- Cursor: `.cursor/skills/*.md`
- Factory: `.factory/skills/*.md`

## First Workflow Example

**Building a New Feature:**

```
User: "I need a task management dashboard with user authentication"

→ Orchestrator detects "greenfield fullstack" workflow

Step 1: Analyst creates project brief
Step 2: PM creates PRD with user stories
Step 3: UX Expert designs interface
Step 4: Architect designs system
Step 5: Database Architect designs schema
Step 6: QA creates test plan
Step 7: Developer implements
Step 8: Technical Writer documents
Step 9: QA validates quality gates
```

**Quick Bug Fix:**

```
User: "/quick-ship Fix the login button alignment"

→ Quick flow workflow

Step 1: Developer fixes the issue
Step 2: QA validates the fix
```

## Troubleshooting

### Agents Not Activating

1. Check `CLAUDE.md` is in project root (not inside `.claude/`)
2. Verify `.claude/config.yaml` exists
3. Restart Claude Code after copying files

### Hooks Not Running

1. Enable hooks in Preferences > Claude Code > Hooks
2. Point to `.claude/hooks` directory
3. Check hook files are executable (Linux/Mac)

### Slash Commands Not Found

1. Commands load from `.claude/commands/*.md`
2. Restart Claude Code after adding commands
3. Check file extension is `.md`

## Security Features

The configuration includes security hooks that block:

- Dangerous shell commands (`rm -rf /`, `sudo rm`, etc.)
- Code injection patterns (`eval`, `python -c`, etc.)
- SQL injection attempts (`DROP DATABASE`, etc.)
- Credential file modifications (`.env`, `.pem`, etc.)

**To bypass security hooks (use with caution):**
```bash
# Only for trusted operations
.claude/tools/model-router.sh -m opus -p "prompt" --bypass-permissions
```

## Cross-Platform Skill Usage

### Claude Code
```
# Natural language invocation
"Select rules for this project"
"Scaffold a UserProfile component"
"Audit src/components/ against our rules"
```

### Cursor IDE
```
# @ symbol invocation
Use @rule-selector to configure rules
Use @scaffolder to create a new component
Use @rule-auditor to check this code
```

### Factory Droid
```
# Task tool invocation
Run Task tool with skill rule-selector
Run Task tool with skill scaffolder
Run Task tool with skill rule-auditor
```

### Cross-Platform Handoff
```
# Claude to Cursor
"Sync this context to Cursor for implementation"

# Cursor to Factory
Use @context-bridge to hand off to Factory

# Factory to Claude
Run Task tool with skill context-bridge to sync to Claude
```

## Next Steps

1. **Customize agents**: Edit files in `.claude/agents/` to match your team's style
2. **Customize skills**: Edit skill files in `.claude/skills/` for your patterns
3. **Add rules**: Create technology-specific rules in `.claude/rules/`
4. **Create commands**: Add custom workflows in `.claude/commands/`
5. **Configure MCP**: Set up integrations in `.claude/.mcp.json`

## Documentation

- **Full Setup Guide**: `.claude/docs/setup-guides/CLAUDE_SETUP_GUIDE.md`
- **Agent Details**: `.claude/agents/` (each agent has full documentation)
- **Security Features**: `.claude/docs/ENTERPRISE-FEATURES.md`

## Support

- Issues: https://github.com/anthropics/claude-code/issues
- Documentation: `.claude/docs/`

---

**Happy coding with your AI agent team!**
