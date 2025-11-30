# LLM-RULES Production Pack

**Copy-paste agent configurations** for Claude Code, Cursor, and Factory Droids.

## What This Is

**A drop-in configuration bundle** - NOT an SDK or MCP server.

Copy these folders into your project and immediately gain access to:
- **22 specialized AI agents** with defined roles and responsibilities
- **6 utility skills** for rule management and code generation
- **200+ technology rule packs** for framework-specific best practices
- **12 slash commands** for common workflows
- **9 workflow definitions** for project orchestration
- **Cross-platform support** for Claude Code, Cursor IDE, and Factory Droid

## What This Is NOT

- **NOT an SDK** - No TypeScript/JavaScript library to import
- **NOT an MCP server** - No server to run (though configs integrate WITH Claude's MCP)
- **NOT a CLI tool** - Just configuration files you copy
- **NOT a framework** - Works with your existing tools and workflows

Simply copy the `.claude/`, `.cursor/`, or `.factory/` folders into your project root and start using the agents immediately.

## Quick Start

```bash
# Copy into your project
cp -r .claude/ your-project/
cp -r .cursor/ your-project/   # Optional: Cursor support
cp -r .factory/ your-project/  # Optional: Factory support

# Start using immediately
# Agents activate based on task keywords
```

### First-Time Setup (Recommended)

After copying, run these commands in Claude Code to configure for your stack:

```
Step 1: "Select rules for this project"
        → Auto-detects your tech stack
        → Configures optimal rules in manifest.yaml

Step 2: "Audit the codebase against our rules"
        → Validates existing code
        → Shows what needs attention

Step 3: Start building!
        → "Scaffold a new UserProfile component"
        → "Implement the login feature"
        → "Audit my changes before commit"
```

## Agents (22 Specialized Roles)

```
Orchestrator - Routes tasks to specialists
  ├── Core Development:
  │   ├── Analyst - Research and discovery
  │   ├── PM - Product requirements and roadmaps
  │   ├── Architect - System design
  │   ├── Database Architect - Database design and optimization
  │   ├── Developer - Implementation
  │   ├── QA - Quality assurance
  │   └── UX Expert - Interface design
  ├── Enterprise:
  │   ├── Security Architect - Security and compliance
  │   ├── DevOps - Infrastructure and deployment
  │   ├── Model Orchestrator - Multi-model routing
  │   └── Technical Writer - Documentation
  ├── Code Quality:
  │   ├── Code Reviewer - Systematic code review
  │   ├── Refactoring Specialist - Code transformation
  │   └── Performance Engineer - Optimization
  ├── Specialized:
  │   ├── LLM Architect - AI/LLM system design
  │   ├── API Designer - API design patterns
  │   ├── Legacy Modernizer - System modernization
  │   ├── Mobile Developer - iOS/Android/cross-platform
  │   ├── Accessibility Expert - WCAG compliance
  │   ├── Compliance Auditor - GDPR/HIPAA/SOC2
  │   └── Incident Responder - Crisis management
```

## Skills (6 Utilities)

Skills are invoked with natural language or the Skill tool. They work WITH your rules.

| Skill | Purpose | Invocation |
|-------|---------|------------|
| `repo-rag` | Codebase retrieval and symbol indexing | "search for auth patterns" |
| `artifact-publisher` | Publish artifacts to project feed | "publish this artifact" |
| `context-bridge` | Sync state across Claude, Cursor, Factory | "sync to Cursor" |
| `rule-auditor` | Validate code against loaded rules | "audit this file" |
| `rule-selector` | Auto-detect stack and configure rules | "select rules for this project" |
| `scaffolder` | Generate rule-compliant boilerplate | "scaffold a component" |

### Skill Usage Examples

```bash
# Project Setup - Auto-detect your stack and configure rules
"Select the right rules for this project"
→ Scans package.json, requirements.txt, go.mod
→ Generates optimized manifest.yaml
→ Excludes irrelevant rule packs

# Code Generation - Create rule-compliant code
"Scaffold a UserProfile component"
→ Reads nextjs.mdc, typescript.mdc, react.mdc
→ Generates Server Component with Suspense
→ Creates types.ts, skeleton.tsx, index.tsx

# Code Validation - Check compliance
"Audit src/components/ against our rules"
→ Scans files against active rules
→ Reports violations with line numbers
→ Suggests fixes for each issue

# Cross-Platform Sync
"Bridge this context to Cursor"
→ Exports session state
→ Syncs with .cursor/ configuration
```

## Slash Commands

| Command | Purpose |
|---------|---------|
| `/review` | Comprehensive code review |
| `/fix-issue <n>` | Fix GitHub issue by number |
| `/quick-ship` | Fast iteration for small changes |
| `/select-rules` | Run rule-selector skill |
| `/audit` | Run rule-auditor skill |
| `/scaffold` | Run scaffolder skill |
| `/code-quality` | Invoke code-quality workflow |
| `/performance` | Invoke performance workflow |
| `/mobile` | Invoke mobile workflow |
| `/ai-system` | Invoke AI system workflow |
| `/incident` | Invoke incident workflow |
| `/run-workflow` | Execute a workflow step with validation |

## Workflows

### Quick Flow
**For**: Bug fixes, hotfixes, small features
**Agents**: Developer → QA
**Trigger**: `/quick-ship` or keywords like "bug fix", "hotfix"

### Full Stack Flow
**For**: New features, greenfield projects
**Agents**: Analyst → PM → UX → Architect → Developer → QA
**Trigger**: "new project", "greenfield", "full stack"

## Directory Structure

```
.claude/
├── agents/        # 22 agent definitions
├── skills/        # 6 utility skills
├── commands/      # 12 slash commands
├── workflows/     # 9 workflow definitions
├── templates/     # 9 artifact templates
├── schemas/       # 10 validation schemas
├── rules/         # 200+ technology rule packs
├── hooks/         # Native Claude Code hooks
├── config.yaml    # Agent routing configuration
└── CLAUDE.md      # Core instructions

.cursor/           # Cursor IDE configuration (mirrored)
.factory/          # Factory Droid configuration (mirrored)
```

## Skills Architecture

Skills are located in `.claude/skills/` with a consistent structure:

```
.claude/skills/
├── rule-auditor/
│   └── SKILL.md          # Validates code against rules
├── rule-selector/
│   └── SKILL.md          # Auto-configures rules for your stack
├── scaffolder/
│   └── SKILL.md          # Generates compliant boilerplate
├── repo-rag/
│   └── SKILL.md          # Semantic code search
├── artifact-publisher/
│   └── SKILL.md          # Publishes to project feed
└── context-bridge/
    └── SKILL.md          # Cross-platform sync
```

### Skill File Format

Each SKILL.md contains:
```yaml
---
name: skill-name
description: What the skill does
allowed-tools: read, write, glob, search
---

# Instructions and templates follow...
```

### Customizing Skills

1. Edit the SKILL.md file to add your patterns
2. Add project-specific templates
3. Skills automatically inherit from rules in `manifest.yaml`

## Rules Library (200+ Packs)

Technology-specific rules for:
- **Frontend**: React, Next.js, Vue, Angular, Svelte
- **Backend**: Node.js, Python, Go, Rust, Java
- **Testing**: Jest, Cypress, Playwright, pytest
- **Infrastructure**: Docker, Kubernetes, Terraform
- **And more...**

Rules auto-apply based on your project's tech stack. Use `rule-selector` to configure.

## Security

### Native Hooks
Security validation hooks run automatically:
- Dangerous command blocking (`rm -rf`, `sudo`, etc.)
- Secret detection in commits
- Protected file validation

### Tool Permissions
Agents have scoped permissions:
- Analysts: Read-only
- Developers: Read/Write/Bash (safe commands)
- Architects: Read/Write (documentation)

## Documentation

- **Setup Guide**: `.claude/docs/setup-guides/CLAUDE_SETUP_GUIDE.md`
- **Agent Details**: `.claude/agents/` (each agent has full documentation)
- **Instructions**: `.claude/instructions/` (operational playbooks)

## Usage Examples

### Agent Workflows
```
User: Fix the login button alignment
→ [Quick Flow] Developer fixes → QA validates

User: Build a task management dashboard
→ [Full Stack] Analyst → PM → UX → Architect → Developer → QA

User: /review
→ Comprehensive 5-step code review
```

### Skill Workflows
```
User: Set up this Next.js project with proper rules
→ [rule-selector] Detects Next.js + TypeScript + Tailwind
→ Generates stack profile in manifest.yaml
→ Configures 5 primary rules, excludes 180+ irrelevant ones

User: Create a new API endpoint for users
→ [scaffolder] Reads nextjs.mdc patterns
→ Generates app/api/users/route.ts
→ Includes Zod validation, error handling, TypeScript types

User: Check if my code follows our standards
→ [rule-auditor] Loads active rules from manifest
→ Scans target files for violations
→ Outputs: 12 pass, 3 warn, 2 fail with fixes

User: I need to search for how auth is implemented
→ [repo-rag] Indexes codebase symbols
→ Returns relevant files with context
→ Shows auth patterns across the project
```

### Combined Agent + Skill Flow
```
User: Build a user management feature for our Next.js app

Step 1: [rule-selector] Configures rules for Next.js stack
Step 2: [analyst] Researches existing user patterns
Step 3: [architect] Designs feature architecture
Step 4: [scaffolder] Generates compliant components
Step 5: [developer] Implements business logic
Step 6: [rule-auditor] Validates against standards
Step 7: [qa] Tests and validates quality gates
```

## Templates & Safety

- Templates: code-review-report, performance-plan, llm-architecture, incident-report, refactor-plan (see `.claude/templates/`).
- Guardrails/permissions: documented in `.claude/system/guardrails/guardrails.md` and `.claude/system/permissions/permissions.md`.
- Hooks: native shell hooks in `.claude/hooks/` (`security-pre-tool.sh`, `audit-post-tool.sh`) for command safety and audit logging.
- Optional MCP: `.claude/.mcp.json` lists optional endpoints for Claude Code; no server is shipped.

## Requirements

**Required**:
- Claude Code, Cursor IDE, or Factory Droid

**Optional** (for validation and workflow gates):
- Node.js 18+
- pnpm (for dependency management)
- Dependencies: `ajv`, `js-yaml` (installed via `pnpm install`)

The core agent configuration works without Node.js. Validation scripts and workflow gating require the optional dependencies.

## Validation (Optional)

```bash
# Install dependencies first
pnpm install

# Validate configuration files
pnpm validate
pnpm validate:verbose  # detailed output

# Cross-platform agent/skill parity
pnpm validate:sync

# Validate a specific workflow step
node .claude/tools/workflow_runner.js --workflow .claude/workflows/greenfield-fullstack.yaml --step 1
```

These scripts are optional; the configuration works without running them.

## MCP Servers (Optional)

The configuration includes optional MCP server integrations in `.claude/.mcp.json`:

| Server | Purpose | Required Environment Variable |
|--------|---------|------------------------------|
| `repo` | Codebase search (repo-rag skill) | None (auto-configured) |
| `artifacts` | Artifact publishing | None (auto-configured) |
| `github` | GitHub integration | `GITHUB_TOKEN` |
| `linear` | Linear issue tracking | `LINEAR_API_KEY` |
| `slack` | Slack notifications | `SLACK_BOT_TOKEN` |

**To enable optional servers**:
1. Set the required environment variable
2. MCP servers auto-launch via `npx` when needed

**Note**: This project is NOT an MCP server itself. It integrates WITH Claude's MCP protocol for extended capabilities.

## License

MIT - Use freely for personal and commercial projects.
