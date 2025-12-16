# OpenCode Configuration

Drop the contents of this folder into your project's root. Assets are organized for OpenCode's hierarchical loader, hook lifecycle, and MCP tooling.

## Key Capabilities

- **Artifacts-first workflows** so code, docs, and UI previews render side-by-side for iterative editing.
- **Projects-aware instructions** that preload shared knowledge, role guidance, and memory-safe defaults scoped per directory.
- **Lifecycle hooks** (`PreToolUse`, `PostToolUse`, `UserPromptSubmit`) to enforce plan reviews, test execution, and artifact publishing.
- **Skills modules** that wrap MCP calls for repo search, context diffing, and artifact management.

## Folder Structure

```
.opencode/
├── agent/           # 31 specialized agent prompts
├── command/         # 13 slash commands
├── context/         # Session context and artifacts
│   ├── artifacts/   # Generated artifacts storage
│   ├── audit/       # Audit logs
│   └── history/     # Execution history
│       ├── gates/   # Quality gate results
│       └── reasoning/ # Agent reasoning traces
├── hook/            # Pre/Post tool execution hooks
├── instruction/     # Context-specific instructions
├── plan/            # Execution plans
├── schema/          # JSON validation schemas
├── skill/           # Reusable skill modules
├── system/          # Guardrails and permissions
├── template/        # Document templates
├── tool/            # Custom tools
├── workflow/        # Multi-step workflow definitions
├── config.yaml      # Agent routing and model config
├── opencode.json    # Main configuration
├── README.md        # This file
└── settings.json    # Tool permissions
```

## Activation

1. Copy `.opencode` contents into your repo root.
2. In OpenCode, open the workspace and confirm the hierarchy.
3. Enable hooks via settings and point to `.opencode/hook`.
4. (Optional) Configure MCP servers in `opencode.json` (set required env vars).

## Agent Routing

The `config.yaml` file defines intelligent agent routing based on:
- **Trigger words**: Keywords that activate specific agents
- **Complexity**: Low/medium/high complexity determines model selection
- **Extended thinking**: High-complexity agents use extended thinking mode

## Workflow Selection

Workflows are automatically selected based on project keywords:
- `quick_flow`: Bug fixes, hotfixes, documentation
- `fullstack`: New projects, greenfield development
- `code_quality`: Code review, refactoring, tech debt
- `performance`: Optimization, profiling, benchmarking
- `ai_system`: LLM features, RAG, embeddings
- `mobile`: iOS, Android, React Native, Flutter
- `incident`: Outages, production issues, post-mortems

## Available Agents

| Agent | Role | Complexity |
|-------|------|------------|
| analyst | Market research, requirements | Medium |
| pm | Product requirements, backlog | Medium |
| architect | System design, infrastructure | High |
| database-architect | Data modeling, queries | High |
| developer | Implementation, debugging | Medium |
| qa | Testing, quality gates | High |
| ux-expert | UI/UX design, accessibility | Medium |
| orchestrator | Multi-agent coordination | High |
| security-architect | Security, compliance | High |
| devops | CI/CD, monitoring | Medium |
| technical-writer | Documentation | Low |
| llm-architect | AI systems, prompts | High |
| code-reviewer | Code review, auditing | High |
| performance-engineer | Optimization, profiling | High |
| api-designer | API design, contracts | High |
| legacy-modernizer | Migration, upgrades | High |
| accessibility-expert | WCAG, a11y | Medium |
| compliance-auditor | GDPR, HIPAA, SOC2 | High |
| incident-responder | Outages, post-mortems | Medium |
| refactoring-specialist | Clean code, patterns | High |
| mobile-developer | iOS, Android, Flutter | Medium |

## Quality Gates

Quality gates are enabled by default and validate:
- Artifact completeness
- Schema conformance
- Cross-agent consistency
- Output quality scores

See `schema/` for validation schemas.
