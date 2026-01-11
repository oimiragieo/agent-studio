# Factory Droid Drop-In

Factory's Droid platform layers specialized agents across CLI, IDE, and web interfaces with deep context management and enterprise integrations.

## Quick Start

1. **Copy this folder** as `.factory/` to your project root (or merge with existing Factory workspace)
2. **Enable Custom Droids**: Open Factory settings (`/settings`) and enable "Custom Droids" under Experimental section
3. **Sync configuration**: Run `droid pull` to sync new configurations
4. **Verify setup**: Run `droid` and use Task tool with subagent names to access specialized agents

## What's Included

### Custom Droids (22 Specialized Agents)

Role-aligned droids matching the Claude/Cursor agents:

**Core Development:**

- **analyst** 📊: Market research, requirements gathering, competitive analysis
- **pm** 📋: Product requirements, epic definition, business validation
- **architect** 🏗️: System design, technology selection, security planning
- **database-architect** 🗄️: Schema design, query optimization, migrations
- **developer** 💻: Implementation, code quality, testing execution
- **qa** 🧪: Test planning, quality validation, compliance verification
- **ux-expert** 🎨: User experience design, accessibility, interface specification

**Enterprise:**

- **security-architect** 🔒: Security and compliance architecture
- **devops** ⚙️: Infrastructure, CI/CD, deployment automation
- **technical-writer** 📝: Documentation and API references

**Coordination:**

- **orchestrator** 🎯: Task routing and multi-agent coordination
- **model-orchestrator** 🔀: Multi-model routing (Gemini, Cursor, etc.)

**Code Quality:**

- **code-reviewer** 👁️: Systematic code review, PR analysis
- **refactoring-specialist** 🔧: Code transformation, tech debt reduction
- **performance-engineer** ⚡: Performance optimization, profiling

**Specialized:**

- **llm-architect** 🤖: AI/LLM system design, RAG, prompt engineering
- **api-designer** 🔌: REST/GraphQL/gRPC API design
- **legacy-modernizer** 🏚️: Legacy system modernization
- **mobile-developer** 📱: iOS/Android/React Native/Flutter
- **accessibility-expert** ♿: WCAG compliance, a11y testing
- **compliance-auditor** 📜: GDPR/HIPAA/SOC2/PCI-DSS
- **incident-responder** 🚨: Crisis management, post-mortems

### Context Layer Instructions

Instructions that mirror Factory's knowledge graph approach:

- **Context router**: Intelligently combines repo context, product docs, and runtime telemetry
- **Context layering**: Multiple knowledge sources for better decision-making
- **Integration patterns**: GitHub, Linear, Confluence, Slack connectivity

### Lifecycle Hooks

- **Pre-run hook** (`hooks/pre-run.yaml`): Validates code quality, runs tests, attaches context
- **Post-run hook** (`hooks/post-run.yaml`): Generates reports, publishes artifacts, notifies teams

### Skills Modules (8 Utilities)

6 cross-platform skills synced with Claude and Cursor, plus 2 Factory-specific utilities:

| Skill                | Invocation | Purpose                             |
| -------------------- | ---------- | ----------------------------------- |
| `rule-auditor`       | Task tool  | Validate code against loaded rules  |
| `rule-selector`      | Task tool  | Auto-detect stack, configure rules  |
| `scaffolder`         | Task tool  | Generate rule-compliant boilerplate |
| `repo-rag`           | Task tool  | Semantic codebase search            |
| `artifact-publisher` | Task tool  | Publish to project feed             |
| `context-bridge`     | Task tool  | Sync with Claude/Cursor             |
| `context-router`     | Task tool  | Intelligent context prioritization  |
| `incident-response`  | Task tool  | Automated incident response         |

**Example Usage:**

```
Run Task tool with skill rule-selector to configure rules
Run Task tool with skill scaffolder to create a UserProfile component
Run Task tool with skill rule-auditor to validate src/components/
Run Task tool with skill context-bridge to sync to Claude
```

### Instruction Guides

Comprehensive guides in `instructions/`:

- **cli.md**: How to talk to a droid, effective prompts, common workflows
- **specification-mode.md**: Turn plain-English specs into production-ready code
- **auto-run.md**: Configurable autonomy levels for efficient execution
- **context-layers.md**: Context layering and knowledge graph integration
- **integrations.md**: Cross-platform integration with Claude, Cursor, GitHub, Linear

### AGENTS.md Files

- **Root AGENTS.md**: Universal project conventions and build/test commands
- **Subdirectory AGENTS.md**: Area-specific rules and patterns

## Directory Structure

```
.factory/
├── droids/           # Custom droid definitions (22 agents)
├── hooks/            # Pre/post run hooks (YAML)
├── instructions/     # Usage guides and best practices
├── skills/           # 8 utility skills (synced with Claude/Cursor)
│   ├── rule-auditor.md
│   ├── rule-selector.md
│   ├── scaffolder.md
│   ├── repo-rag.md
│   ├── artifact-publisher.md
│   ├── context-bridge.md
│   ├── context-router.md
│   └── incident-response.md
├── rules/            # Framework-specific rules (shared with Cursor/Claude)
├── AGENTS.md         # Factory-specific agent instructions
└── README.md         # This file
```

## Key Features

### Specification Mode

For complex features requiring planning:

1. Press `Shift+Tab` to activate Specification Mode
2. Describe feature in 4-6 sentences
3. Review generated specification and implementation plan
4. Approve to begin safe execution

### Auto-Run Mode

Choose autonomy level based on risk tolerance:

- **Auto (Low)**: File edits and read-only commands
- **Auto (Medium)**: Reversible workspace changes
- **Auto (High)**: All commands except safety blocks

Cycle through modes with `Shift+Tab` (or `Ctrl+T` on Windows).

### Context Routing

Intelligently combines context sources:

1. Repository code (primary)
2. Cursor plans (`.cursor/plans/latest.md`)
3. Claude artifacts (`.claude/context/artifacts/*`)
4. Knowledge base docs (tagged with feature ID)

### Cross-Platform Integration

- **Claude Projects**: Publish artifacts for traceability
- **Cursor IDE**: Sync plans and context
- **GitHub**: Reference issues and PRs
- **Linear**: Link tasks and update status
- **Slack**: Notify teams on completion

## Usage Examples

### Invoking Custom Droids

```
Run the Task tool with subagent analyst to perform a competitive analysis.
```

```
Run the Task tool with subagent architect to design the authentication system.
```

### Specification Mode

```
[Shift+Tab] Add user data export functionality that works for accounts up to 5GB. Must comply with GDPR and include audit logging.
```

### Auto-Run Workflow

```
[Shift+Tab to Auto (Low)] Update documentation with new API endpoints
[Shift+Tab to Auto (Medium)] Add new React component with tests
[Shift+Tab to Auto (High)] Deploy database migrations
```

## Configuration

### Enable Custom Droids

1. Run `droid`
2. Enter `/settings`
3. Set `enableCustomDroids: true`
4. Restart droid

### Adjust Autonomy Level

1. Press `Shift+Tab` to cycle through modes
2. Or set default in `/settings` → `autonomyLevel`

### Configure Hooks

Edit hook files in `.factory/hooks/`:

- `pre-run.yaml`: Pre-execution validation
- `post-run.yaml`: Post-execution publishing

## Best Practices

1. **Start with Specification Mode** for complex features
2. **Use AGENTS.md files** to document conventions once
3. **Reference existing patterns** instead of describing from scratch
4. **Set clear boundaries** to contain change scope
5. **Verify with tests** - always include test requirements
6. **Review changes** before committing (even in Auto-Run)
7. **Publish artifacts** for cross-platform context preservation
8. **Use Custom Droids** for specialized domain expertise

## Troubleshooting

### Custom Droids not available

- Verify Custom Droids enabled: `/settings` → `enableCustomDroids: true`
- Restart droid after enabling
- Check droid files in `.factory/droids/` or `~/.factory/droids/`

### Context not syncing

- Verify directories exist (`.cursor/context/`, `.claude/context/artifacts/`)
- Check hook configurations in `hooks/`
- Review file permissions

### Too many prompts in Auto-Run

- Check autonomy level in status banner
- Verify commands aren't in denylist (`/settings`)
- Add safe commands to allowlist

### Hooks not executing

- Verify hook files are valid YAML
- Check trigger names match Factory format
- Review Factory logs for hook errors

## Additional Resources

- **Factory Documentation**: https://docs.factory.ai/
- **Setup Guide**: See `FACTORY_SETUP_GUIDE.md` in project root
- **Instructions**: See `instructions/` directory for detailed guides
- **Skills**: See `skills/` directory for context routing and incident response

## References

[6] Sid Bharath, "Factory.ai: A Guide To Building A Software Development Droid Army" (Sep 30, 2025).
