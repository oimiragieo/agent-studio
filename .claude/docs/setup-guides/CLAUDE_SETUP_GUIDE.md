# Claude Code Setup & Usage Guide

## How Claude Code Discovers Your Configuration

Claude Code automatically discovers and loads configuration from the `.claude/` directory in your **project root** and reads `CLAUDE.md` files hierarchically. When you start Claude Code, it scans for:

1. **`CLAUDE.md`** - Root rules file (in project root, NOT inside `.claude/`)
2. **`.claude/agents/`** - Agent definitions (23 agents with YAML frontmatter)
3. **`.claude/rules/`** - Framework-specific rules (hierarchical loading)
4. **`.claude/hooks/`** - Lifecycle hooks (PreToolUse, PostToolUse, UserPromptSubmit)
5. **`.claude/commands/`** - Custom slash commands
6. **`.claude/skills/`** - MCP skill definitions
7. **`.claude/config.yaml`** - Orchestrator configuration
8. **`.claude/settings.json`** - Tool permissions and MCP settings

## Subagent Context Loading (Optimized Configuration)

### Overview

The optimized configuration uses **subagent context loading** to reduce context usage. Rules load ONLY when specific agents activate, keeping the main context clean.

### How It Works

1. **Global Rules**: `PROTOCOL_ENGINEERING.md` loads for all agents (universal standards)
2. **Agent-Specific Rules**: Each agent loads only its relevant rules when activated
3. **Lazy Loading**: Rules load on-demand, not upfront
4. **Archive**: Niche rules stored in `.claude/archive/` for on-demand lookup

### Configuration

Agent context files are configured in `.claude/config.yaml`:

```yaml
agent_routing:
  developer:
    context_files:
      - .claude/rules-master/TECH_STACK_NEXTJS.md
      - .claude/rules-master/PROTOCOL_ENGINEERING.md
    context_strategy: "lazy_load"
  
  qa:
    context_files:
      - .claude/rules-master/TOOL_CYPRESS_MASTER.md
      - .claude/rules-master/TOOL_PLAYWRIGHT_MASTER.md
      - .claude/rules-master/PROTOCOL_ENGINEERING.md
    context_strategy: "lazy_load"
```

### Master Rules Files

Master rules are in `.claude/rules-master/` (outside `.claude/rules/` to prevent auto-loading):

- **TECH_STACK_NEXTJS.md**: Next.js/React/TypeScript/Tailwind (for developer agent)
- **PROTOCOL_ENGINEERING.md**: Universal engineering standards (all agents)
- **TOOL_CYPRESS_MASTER.md**: Cypress testing (for QA agent)
- **TOOL_PLAYWRIGHT_MASTER.md**: Playwright testing (for QA agent)
- **LANG_PYTHON_GENERAL.md**: General Python (for Python projects)
- **FRAMEWORK_FASTAPI.md**: FastAPI-specific (for FastAPI projects)
- **LANG_SOLIDITY.md**: Solidity smart contracts (for security-architect agent)

### Benefits

- **Reduced Context Usage**: From 141% to ~60-70%
- **Faster Agent Activation**: Clean main context, specialized context on-demand
- **Lower Token Costs**: Only load what's needed
- **Better Organization**: Single source of truth for each rule category

### Customization

To add context files for a custom agent:

1. Edit `.claude/config.yaml`
2. Add `context_files` section to the agent
3. Specify master rule files (or custom rules)
4. Set `context_strategy: "lazy_load"`

Example:
```yaml
my-custom-agent:
  trigger_words:
    - "custom task"
  context_files:
    - .claude/rules-master/PROTOCOL_ENGINEERING.md
    - .claude/rules/my-custom-rules.md
  context_strategy: "lazy_load"
```

### Monitoring Context Usage

Use the context monitor tool:

```bash
# View usage report
node .claude/tools/context-monitor.mjs report

# View stats for specific agent
node .claude/tools/context-monitor.mjs stats developer
```

### Best Practices

1. **Use Master Files**: Reference master files in `_core/` directory
2. **Archive Niche Rules**: Move rarely-used rules to `archive/`
3. **Monitor Usage**: Track context usage per agent
4. **Keep Global Rules Minimal**: Only PROTOCOL_ENGINEERING.md loads globally
5. **Test Agent Activation**: Verify rules load correctly when agents activate

## Step-by-Step Setup

### Step 1: Copy the Folder Structure

**Option A: Copy Entire `.claude/` Folder + `CLAUDE.md`**
```bash
# From production-dropin directory
cp -r production-dropin/.claude /path/to/your/project/.claude
cp production-dropin/.claude/CLAUDE.md /path/to/your/project/CLAUDE.md
```

**Option B: On Windows (PowerShell)**
```powershell
# From production-dropin directory
Copy-Item -Path "C:\dev\projects\LLM-RULES\production-dropin\.claude" -Destination "C:\path\to\your\project\.claude" -Recurse
Copy-Item -Path "C:\dev\projects\LLM-RULES\production-dropin\.claude\CLAUDE.md" -Destination "C:\path\to\your\project\CLAUDE.md"
```

**Option C: Manual Copy**
1. Copy the `production-dropin/.claude/` folder (note: it's already named `.claude`)
2. Copy `production-dropin/.claude/CLAUDE.md` to your project root as `CLAUDE.md`
3. Place `.claude/` in your project root directory
4. Ensure `CLAUDE.md` is in project root (same level as `.claude/`)

### Step 2: Verify Structure

Your project root should look like this:
```
your-project/
├── CLAUDE.md                  # ← Root rules (MUST be in project root)
├── .claude/                   # ← Claude configuration directory
│   ├── agents/                 # Agent definitions (23 agents)
│   │   ├── analyst.md
│   │   ├── architect.md
│   │   ├── developer.md
│   │   ├── devops.md
│   │   ├── security-architect.md
│   │   ├── database-architect.md
│   │   └── ... (22 total agents)
│   ├── rules/                 # Framework rules (hierarchical)
│   ├── hooks/                 # Lifecycle hooks (shell scripts)
│   │   ├── security-pre-tool.sh      # PreToolUse hook
│   │   ├── audit-post-tool.sh         # PostToolUse hook
│   │   └── user-prompt-submit.sh      # UserPromptSubmit hook
│   ├── commands/              # Custom slash commands
│   ├── skills/                # MCP skill definitions
│   ├── templates/             # Reusable templates
│   ├── schemas/               # JSON schemas for validation
│   ├── workflows/             # Workflow definitions
│   ├── instructions/          # Usage guides
│   ├── config.yaml            # Orchestrator configuration
│   └── settings.json          # Tool permissions
└── [your source code]
```

**IMPORTANT:** 
- `CLAUDE.md` goes in the **project root**, NOT inside `.claude/`
- `.claude/` goes in your **project root** (same level as `package.json`, `src/`, etc.)
- Claude Code reads `CLAUDE.md` files hierarchically (root → subdirectories)

### Step 3: Enable Hooks in Claude Code

Hooks are shell scripts that execute at lifecycle events to provide security validation and audit logging. They are essential for production use.

**What Hooks Do**:

- **PreToolUse Hook** (`security-pre-tool.sh`): Validates tool usage before execution
  - Blocks dangerous bash commands (`rm -rf`, `sudo rm`, `mkfs`, `dd`, etc.)
  - Prevents force push to main/master branches
  - Protects `.env` files and credential files from editing
  - Blocks potentially malicious curl/wget piped to bash
  - Returns JSON: `{"decision": "allow"}` or `{"decision": "block", "reason": "..."}`

- **PostToolUse Hook** (`audit-post-tool.sh`): Logs tool executions for audit trail
  - Records timestamp, tool name, and summary
  - Stores logs in `~/.claude/audit/tool-usage.log`
  - Auto-rotates logs to prevent disk bloat
  - Provides compliance audit trail

**Registration Steps**:

1. Open **Claude Code** in your project directory
2. Navigate to **Preferences → Claude Code → Hooks** (or **Settings → Hooks**)
3. Set hooks directory to `.claude/hooks` (absolute or relative path)
4. Enable the hooks:
   - **PreToolUse**: `.claude/hooks/security-pre-tool.sh`
   - **PostToolUse**: `.claude/hooks/audit-post-tool.sh`
5. Save preferences

**Manual Registration** (if UI not available):

Add to your Claude Code configuration file (location varies by platform):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "command": "bash .claude/hooks/security-pre-tool.sh"
      }
    ],
    "PostToolUse": [
      {
        "command": "bash .claude/hooks/audit-post-tool.sh"
      }
    ]
  }
}
```

**Verify Hooks Are Working**:

1. **Test Security Hook**:
   - Try a safe command: `ls -la` (should be allowed)
   - Try a dangerous command: `rm -rf /` (should be blocked)
   - Check for error message explaining why it was blocked

2. **Test Audit Hook**:
   - Execute any tool (e.g., read a file)
   - Check audit log: `cat ~/.claude/audit/tool-usage.log`
   - Should see entry with timestamp, tool name, and summary

3. **Check Hook Execution**:
   - Look for hook execution in Claude Code's activity log
   - Verify hooks directory path is correct
   - Ensure hook scripts have execute permissions: `chmod +x .claude/hooks/*.sh`

**Troubleshooting**:

- **Hooks not executing**: 
  - Verify hooks directory path in preferences
  - Check that hook scripts exist and are executable
  - Ensure bash is available in PATH

- **Commands being blocked unexpectedly**:
  - Review `security-pre-tool.sh` to understand blocked patterns
  - Check if command matches dangerous pattern
  - Modify hook script if pattern is too aggressive (but be cautious)

- **No audit logs appearing**:
  - Verify `audit-post-tool.sh` has execute permissions
  - Check that `~/.claude/audit/` directory exists and is writable
  - Review hook script for errors in log file path

- **Permission errors**:
  - Ensure hook scripts are executable: `chmod +x .claude/hooks/*.sh`
  - Check file paths are correct (absolute vs relative)
  - Verify bash interpreter path if using absolute paths

**What Each Hook Does in Detail**:

**security-pre-tool.sh**:
- Reads JSON input from stdin with tool name and input
- For Bash tool, extracts command and validates against dangerous patterns
- Blocks file system destruction, remote code execution, SQL injection, etc.
- Protects sensitive files (`.env*`, `secrets/`, `credentials.json`, etc.)
- Returns JSON decision to Claude Code

**audit-post-tool.sh**:
- Reads JSON input with tool execution details
- Formats log entry with timestamp, tool name, and summary
- Appends to audit log file
- Handles log rotation to prevent disk bloat
- Provides compliance audit trail

For detailed hook documentation and customization, see `.claude/hooks/README.md`.

### Step 4: Verify It Worked

1. **Check CLAUDE.md is loaded**: 
   - Claude Code reads `CLAUDE.md` from project root
   - Check right-side navigator for hierarchy
2. **Check agents are available**:
   - Agents load from `.claude/agents/[agent].md`
   - Claude Code automatically discovers all 20 agents
3. **Test a slash command**:
   - Try `/review` or `/fix-issue` (from `.claude/commands/`)
4. **Verify hooks**:
   - Hooks should execute on tool use (check Preferences)
   - Test with a safe command (should be allowed)
   - Test with dangerous command like `rm -rf /` (should be blocked)
   - Check audit log at `~/.claude/audit/tool-usage.log` for entries

## About the Folder Structure

The folder is already correctly named `.claude/` in `production-dropin/.claude/`. When you copy it:

```
production-dropin/
├── .claude/              # ← Copy this entire folder
│   ├── agents/          # 23 agents (flat markdown files with YAML frontmatter)
│   │   ├── analyst.md
│   │   ├── architect.md
│   │   ├── database-architect.md
│   │   ├── developer.md
│   │   ├── devops.md
│   │   ├── model-orchestrator.md
│   │   ├── orchestrator.md
│   │   ├── pm.md
│   │   ├── qa.md
│   │   ├── security-architect.md
│   │   ├── technical-writer.md
│   │   └── ... (22 total agents)
│   ├── hooks/           # 2 lifecycle hooks (shell scripts)
│   ├── commands/        # 12 custom slash commands
│   ├── skills/          # 6 utility skills
│   ├── templates/       # 9 reusable templates
│   ├── schemas/         # 10 JSON schemas for validation
│   ├── workflows/       # 9 workflow definitions
│   ├── instructions/    # 12 comprehensive guides
│   ├── config.yaml      # Orchestrator routing config
│   ├── settings.json    # Tool permissions
│   └── .mcp.json        # MCP server config
└── CLAUDE.md            # ← Copy this to project root
```

**Important Notes:**
- `.claude/` goes in your **project root** (same level as `package.json`, `src/`, etc.)
- `CLAUDE.md` goes in **project root**, NOT inside `.claude/`
- Claude Code reads `CLAUDE.md` hierarchically (root → subdirectories)
- Agents use flat markdown files with YAML frontmatter (`.claude/agents/[agent].md`)

## Leveraging Claude Code's Unique Capabilities

Claude Code has unique capabilities that set it apart from other platforms:

### 1. Hierarchical CLAUDE.md System

Claude Code reads `CLAUDE.md` files recursively:
- **Root `CLAUDE.md`**: Universal rules for entire project
- **Subdirectory `CLAUDE.md`**: Specific rules for that area
- **Nearest wins**: Closest `CLAUDE.md` to current working directory takes precedence

**How to Use:**
```
your-project/
├── CLAUDE.md              # Universal rules
├── apps/
│   ├── web/
│   │   └── CLAUDE.md      # Web-specific rules
│   └── api/
│       └── CLAUDE.md      # API-specific rules
└── packages/
    └── ui/
        └── CLAUDE.md      # UI-specific rules
```

### 2. Lifecycle Hooks (Deterministic Automation)

Hooks execute at specific lifecycle events:

- **`PreToolUse`**: Before any tool execution
  - Validates plans exist for multi-file changes
  - Checks dependencies and conflicts
  - Enforces security boundaries
  
- **`PostToolUse`**: After tool execution
  - Publishes artifacts to Claude Projects
  - Collects lint/test logs
  - Syncs with Cursor/Droid sessions
  
- **`UserPromptSubmit`**: On user prompt
  - Normalizes prompts (role, tone, goal)
  - Tags for project analytics
  - Routes to appropriate subagent

**Hook Configuration:**
- Hooks are YAML files in `.claude/hooks/`
- Enable in Preferences → Claude Code → Hooks
- Point to `.claude/hooks` directory

### 3. Custom Slash Commands

Repeatable workflows stored in `.claude/commands/`:

- **`/review`**: Code review workflow
- **`/fix-issue`**: Issue resolution workflow

**Create Custom Commands:**
1. Create `.md` file in `.claude/commands/`
2. Define workflow steps
3. Use `$ARGUMENTS` for parameters
4. Command auto-discovers on restart

### 4. Agents (Isolated Context Windows)

Agents have:
- **Isolated context**: Each agent has its own context window
- **Tool permissions**: Defined in YAML frontmatter
- **Specialized prompts**: Located in `.claude/agents/[agent].md`
- **YAML frontmatter**: Name, description, tools, model, temperature, priority

**Available Agents (12 Total):**

**Core Development Agents:**
- Analyst - Market research and business analysis
- Architect - System architecture and technical design
- Database Architect - Database design and optimization
- Developer - Code implementation and testing
- PM (Product Manager) - Product requirements and roadmaps
- QA - Quality assurance and validation
- UX Expert - Interface design and user experience

**Enterprise Agents:**
- DevOps - Infrastructure, CI/CD, and deployments
- Security Architect - Security design and threat modeling
- Technical Writer - Documentation and knowledge management

**Routing Agents:**
- Model Orchestrator - Multi-model routing (Claude, Gemini, Cursor, OpenCode)
- Orchestrator - Task routing and multi-agent coordination

### 5. Extended Thinking (1M+ Tokens)

**Extended Thinking** is Claude Code's capability for long-form reasoning with extended context windows (1M+ tokens). 

**Agents Configured for Extended Thinking:**
- **Architect**: Complex architectural decisions, technology evaluations
- **QA**: Critical quality gate decisions, complex test strategy design
- **Security Architect**: Threat modeling, compliance evaluation, security trade-offs
- **Database Architect**: Database technology selection, sharding strategies, migration planning
- **Orchestrator**: Complex routing decisions, workflow selection, conflict resolution

**When Extended Thinking Activates:**
- Complex architectural problems requiring deep analysis
- Multi-technology stack evaluations
- Security vulnerability assessments
- Risk-based testing strategy design
- Conflict resolution between requirements and constraints

**How It Works:**
- Agent explicitly invokes extended thinking mode
- Reasoning process is deeper and more thorough
- Outputs are more comprehensive and well-justified
- Better for critical decisions requiring extensive analysis

### 6. Model Context Protocol (MCP) Integration

MCP servers configured in `.claude/.mcp.json`:

#### Advanced Tool Use (Beta Features)

Anthropic's advanced tool use features (released November 24, 2025) dramatically reduce MCP tool token usage:

**Tool Search Tool**:
- Reduces MCP tool tokens by 85% (80k → 12k tokens)
- Tools load on-demand instead of upfront
- Improves tool selection accuracy (79.5% → 88.1%)

**Configuration**:
```json
{
  "betaFeatures": ["advanced-tool-use-2025-11-20"],
  "toolSearch": {
    "enabled": true,
    "defaultDeferLoading": true
  },
  "mcpServers": {
    "github": {
      "deferLoading": true,
      "alwaysLoadTools": ["create_pull_request"]
    }
  }
}
```

**When to Enable**:
- MCP tool count > 20 tools
- MCP tools consume >30% of context
- Want improved tool selection accuracy

See `.claude/docs/ADVANCED_TOOL_USE.md` for comprehensive guide on Tool Search Tool, Programmatic Tool Calling, and Tool Use Examples.
- **Repository RAG**: Codebase search and knowledge retrieval
- **Artifact Publisher**: Push artifacts to Claude Projects
- **Context Bridge**: Sync across Claude, Cursor, Droid
- **GitHub Integration**: Issues, PRs, repository management
- **Linear Integration**: Issue tracking (optional)

### 7. Artifacts System

Claude Code's **Artifacts** provide live, interactive previews of code, docs, and UI prototypes. This is one of Claude Code's most powerful features.

**Artifact Capabilities:**
- **Live previews**: Code, docs, UI prototypes render side-by-side with chat
- **Iterative editing**: Edit artifacts directly - changes sync back to codebase
- **Handoff capability**: Share artifacts with collaborators via Claude Projects
- **Versioning**: Promote artifacts to versioned documents for documentation
- **Multi-format**: Supports HTML, Markdown, Mermaid diagrams, code previews

**How to Use:**
1. **Request artifact**: "Create an architecture diagram as an artifact"
2. **Agent generates**: Artifact renders in artifact pane (right side)
3. **Edit directly**: Click artifact to edit inline
4. **Iterate**: Make changes, see updates in real-time
5. **Publish**: Use `artifact-publisher` skill to push to Claude Projects
6. **Share**: Collaborators can view and edit artifacts

**Artifact Workflow:**
```
Agent generates → Artifact renders → Edit inline → 
Changes sync → Publish to Projects → Share with team
```

**Best Practices:**
- Use artifacts for UI/UX deliverables (visual preview)
- Use artifacts for architecture diagrams (Mermaid)
- Use artifacts for documentation (Markdown with live preview)
- Publish artifacts to Claude Projects for team visibility

## Working with Agents

### Agent Structure

Each agent in `.claude/agents/[agent].md` contains:

- **YAML frontmatter**: Name, description, tools, model, temperature, priority
- **Identity section**: Agent persona and core identity
- **Core capabilities**: Specialized skills and expertise
- **Execution process**: Step-by-step workflow when activated
- **MCP integration**: Knowledge federation patterns
- **Output requirements**: Expected deliverables and formats

### Invoking Agents

**Method 1: Trigger Words**
Agent routing configured in `config.yaml`:
```yaml
analyst:
  trigger_words:
    - "market research"
    - "competitive analysis"
    - "project brief"
```

**Method 2: Explicit Invocation**
```
Use the Analyst agent to create a project brief for [feature]
```

**Method 3: Slash Commands**
Some commands automatically route to specific agents.

### Agent Routing Flow

1. User prompt submitted
2. Security hook validates request (`.claude/hooks/security-pre-tool.sh`)
3. `config.yaml` matches trigger words to agent
4. Agent loaded from `.claude/agents/[agent].md` with YAML frontmatter
5. Agent executes with isolated context window

## Workflow Execution

### Greenfield Fullstack Workflow

Defined in `.claude/workflows/greenfield-fullstack.yaml`:

1. **Analyst**: Creates project brief
2. **PM**: Creates PRD and user stories
3. **UX Expert**: Creates UI specs
4. **Architect**: Creates system architecture
5. **Developer**: Implements features
6. **QA**: Creates test plan and validates

**How to Start:**
```
Start greenfield fullstack workflow for [project description]
```

### Brownfield Fullstack Workflow

Defined in `.claude/workflows/brownfield-fullstack.yaml`:

Similar to greenfield but optimized for existing codebases.

## JSON Schemas for Validation

Schemas in `.claude/schemas/` validate agent outputs:
- `project_brief.schema.json`
- `product_requirements.schema.json`
- `system_architecture.schema.json`
- `test_plan.schema.json`
- `user_story.schema.json`
- `epic.schema.json`
- `backlog.schema.json`
- `ux_spec.schema.json`
- `artifact_manifest.schema.json`
- `route_decision.schema.json`

**Validation Process:**
1. Agent generates JSON output
2. Validated against schema
3. Auto-fixed if validation fails
4. Rendered to Markdown for humans

## Common Questions

### Q: Will Claude Code auto-discover everything?

**A:** Yes! After copying `.claude/` and `CLAUDE.md` to your project root:
- ✅ `CLAUDE.md` automatically loaded (hierarchical)
- ✅ Agents auto-discover from `.claude/agents/[agent].md`
- ✅ Rules auto-load from `.claude/rules/` (hierarchical)
- ✅ Hooks load from `.claude/hooks/*.sh` (shell scripts)
- ✅ Commands load from `.claude/commands/*.md`
- ✅ Skills load from `.claude/skills/*/SKILL.md`

### Q: Do I need to configure anything?

**A:** Initial setup requires:
1. Enable hooks in Preferences → Claude Code → Hooks
2. Point to `.claude/hooks` directory
3. (Optional) Register MCP servers from `.claude/.mcp.json`

You can also customize:
- Edit agent prompts in `.claude/agents/[agent].md`
- Adjust agent routing in `.claude/config.yaml`
- Modify tool permissions in `.claude/settings.json`
- Add custom rules to `.claude/rules/`
- Create custom commands in `.claude/commands/`

### Q: How do hooks work?

**A:** Hooks are shell commands that execute at lifecycle events:
- **PreToolUse**: Before Claude uses any tool
- **PostToolUse**: After tool execution
- **UserPromptSubmit**: When user submits prompt

Hooks defined in YAML format in `.claude/hooks/`. Enable in Preferences.

### Q: What's the difference between Cursor and Claude Code?

**A:** Key differences:

| Feature | Claude Code | Cursor |
|---------|-------------|--------|
| Agent Structure | Flat files with YAML frontmatter (`.claude/agents/[agent].md`) | Flat files (`.mdc` files) |
| Hooks Format | YAML files | JSON files |
| Rules Location | `CLAUDE.md` + `.claude/rules/` | `.cursorrules` + `.cursor/rules/` |
| Commands | `.claude/commands/*.md` | Built-in slash commands |
| Skills | MCP skills (YAML) | MCP via settings.json |
| Artifacts | Native Artifacts system | Plan Mode artifacts |
| Extended Thinking | ✅ Available (1M+ tokens) | ❌ Not available |

### Q: Can I use this in a monorepo?

**A:** Yes! Claude Code's hierarchical system is perfect for monorepos:

```
monorepo/
├── CLAUDE.md              # Root rules
├── .claude/               # Shared config
├── apps/
│   ├── web/
│   │   └── CLAUDE.md      # Web-specific rules
│   └── api/
│       └── CLAUDE.md       # API-specific rules
└── packages/
    └── ui/
        └── CLAUDE.md      # Package-specific rules
```

Each directory can have its own `CLAUDE.md` that extends root rules.

### Q: How do agents work with hooks?

**A:** Agents automatically respect hooks:
- `PreToolUse` hook validates before agent uses tools
- `PostToolUse` hook publishes agent artifacts
- `UserPromptSubmit` routes to appropriate agent

Hooks apply to all agents unless specifically excluded.

## Troubleshooting

### Agents Not Loading

1. **Check file structure**: Must be `.claude/agents/[agent].md`
2. **Check agent name**: Must match filename (without .md extension)
3. **Check `config.yaml`**: Agent must be defined in routing config
4. **Check YAML frontmatter**: Must have valid YAML frontmatter with name field
5. **Restart Claude Code**: Full restart required after changes

### Hooks Not Executing

1. **Check Preferences**: Hooks must be enabled in Preferences → Claude Code → Hooks
2. **Check path**: Point to `.claude/hooks` directory
3. **Check file format**: Hooks are shell scripts (`.sh` extension)
4. **Check permissions**: Hook files must be executable (`chmod +x`)

### CLAUDE.md Not Loading

1. **Check location**: Must be in project root, NOT inside `.claude/`
2. **Check name**: Must be exactly `CLAUDE.md` (case-sensitive)
3. **Check hierarchy**: Subdirectory `CLAUDE.md` files extend root
4. **Check syntax**: Must be valid Markdown

### Rules Not Loading

1. **Check manifest**: `.claude/rules/manifest.yaml` should exist
2. **Check stack profile**: Manifest defines which rules load for which stack
3. **Check file patterns**: Rules load based on glob patterns
4. **Check hierarchy**: Rules inherit from parent directories

### MCP Skills Not Working

1. **Check `.mcp.json`**: MCP servers must be configured
2. **Check MCP servers**: Ensure MCP servers are running
3. **Check permissions**: Tool permissions in `settings.json`
4. **Check skill files**: Skills must be valid YAML in `.claude/skills/`

## Artifacts vs. Plan Mode Comparison

Claude Code uses **Artifacts** where Cursor uses **Plan Mode**:

| Feature | Claude Code (Artifacts) | Cursor (Plan Mode) |
|---------|------------------------|-------------------|
| Purpose | Live preview & iterative editing | Structured planning before execution |
| Format | Interactive preview (HTML, MD, diagrams) | Markdown plan with file paths & diffs |
| Editing | Edit artifact directly | Edit plan inline before approval |
| Storage | Claude Projects (shareable) | `.cursor/plans/` (local) |
| Use Case | UI previews, documentation, diagrams | Multi-file change planning |

**Best Practice:** Use both!
- **Claude Artifacts**: For deliverables (UI specs, architecture diagrams, docs)
- **Cursor Plan Mode**: For execution planning (file changes, dependencies, tests)
- **Sync them**: Reference artifact in Plan Mode, or publish plan as artifact

## Next Steps

1. ✅ Copy `.claude/` folder to your project root
2. ✅ Copy `CLAUDE.md` to project root
3. ✅ Enable hooks in Preferences → Claude Code → Hooks
4. ✅ Point hooks to `.claude/hooks` directory
5. ✅ (Optional) Configure MCP servers from `.claude/.mcp.json`
6. ✅ Verify `CLAUDE.md` is loaded (check navigator)
7. ✅ Test a subagent: "Use Analyst to create a project brief for..."
8. ✅ Test a command: Try `/review` or `/fix-issue`
9. ✅ Create an artifact: "Generate a UI spec as an artifact"
10. ✅ Review `instructions/` directory for detailed guides

**Important Files in `.claude/`:**
- `CLAUDE.md` - Root rules (must be in project root)
- `README.md` - Overview and activation
- `config.yaml` - Agent routing configuration
- `settings.json` - Tool permissions
- `instructions/` - 12 comprehensive guides
- `hooks/` - 2 lifecycle hooks (shell scripts)
- `commands/` - 12 custom slash commands
- `workflows/` - 9 workflow definitions

Remember: **Claude Code's hierarchical system and Artifacts make it ideal for complex projects!** 🚀

