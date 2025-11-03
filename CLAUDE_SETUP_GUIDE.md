# Claude Code Setup & Usage Guide

## How Claude Code Discovers Your Configuration

Claude Code automatically discovers and loads configuration from the `.claude/` directory in your **project root** and reads `CLAUDE.md` files hierarchically. When you start Claude Code, it scans for:

1. **`CLAUDE.md`** - Root rules file (in project root, NOT inside `.claude/`)
2. **`.claude/subagents/`** - Agent definitions (directory-based structure)
3. **`.claude/rules/`** - Framework-specific rules (hierarchical loading)
4. **`.claude/hooks/`** - Lifecycle hooks (PreToolUse, PostToolUse, UserPromptSubmit)
5. **`.claude/commands/`** - Custom slash commands
6. **`.claude/skills/`** - MCP skill definitions
7. **`.claude/config.yaml`** - Orchestrator configuration
8. **`.claude/settings.json`** - Tool permissions and MCP settings

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
│   ├── subagents/             # Agent definitions (directory-based)
│   │   ├── analyst/
│   │   │   ├── prompt.md
│   │   │   ├── capabilities.yaml
│   │   │   └── context.md
│   │   ├── architect/
│   │   ├── developer/
│   │   └── ...
│   ├── rules/                 # Framework rules (hierarchical)
│   ├── hooks/                 # Lifecycle hooks (YAML files)
│   │   ├── pre_tool_use.yaml
│   │   ├── post_tool_use.yaml
│   │   └── user_prompt_submit.yaml
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

1. Open **Claude Code** in your project directory
2. Go to **Preferences → Claude Code → Hooks**
3. Point hooks directory to `.claude/hooks`
4. Enable the hooks you want:
   - `pre_tool_use.yaml` - Validates plans before tool use
   - `post_tool_use.yaml` - Publishes artifacts and logs
   - `user_prompt_submit.yaml` - Normalizes prompts

### Step 4: Verify It Worked

1. **Check CLAUDE.md is loaded**: 
   - Claude Code reads `CLAUDE.md` from project root
   - Check right-side navigator for hierarchy
2. **Check subagents are available**:
   - Subagents load from `.claude/subagents/[agent]/prompt.md`
   - Claude Code automatically discovers them
3. **Test a slash command**:
   - Try `/review` or `/fix-issue` (from `.claude/commands/`)
4. **Verify hooks**:
   - Hooks should execute on tool use (check Preferences)

## About the Folder Structure

The folder is already correctly named `.claude/` in `production-dropin/.claude/`. When you copy it:

```
production-dropin/
├── .claude/              # ← Copy this entire folder
│   ├── subagents/       # 10 agents (directory-based structure)
│   │   ├── analyst/     # Each agent has prompt.md, capabilities.yaml, context.md
│   │   ├── architect/
│   │   └── ...
│   ├── hooks/           # 3 lifecycle hooks (YAML format)
│   ├── commands/        # 2 custom slash commands
│   ├── skills/          # 3 MCP skills (YAML)
│   ├── templates/       # 9 reusable templates
│   ├── schemas/         # 10 JSON schemas for validation
│   ├── workflows/       # 2 workflow definitions
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
- Subagents use directory structure, not flat files like Cursor

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

### 4. Subagents (Isolated Context Windows)

Subagents have:
- **Isolated context**: Each agent has its own context window
- **Tool permissions**: Defined in `capabilities.yaml`
- **Specialized prompts**: Located in `prompt.md`
- **Context files**: Agent-specific context in `context.md`

**Available Subagents (10 Total):**
- Analyst (with capabilities.yaml, context.md)
- Architect (with capabilities.yaml, context.md)
- Developer (with capabilities.yaml, context.md)
- PM (with capabilities.yaml, context.md)
- QA (with capabilities.yaml, context.md)
- UX Expert (with capabilities.yaml, context.md)
- Product Owner (prompt.md only)
- Scrum Master (prompt.md only)
- BMAD Orchestrator (prompt.md only)
- BMAD Master (prompt.md only)

### 5. Extended Thinking (1M+ Tokens)

**Extended Thinking** is Claude Code's capability for long-form reasoning with extended context windows (1M+ tokens). 

**Agents Configured for Extended Thinking:**
- **Architect**: Uses extended thinking for complex architectural decisions, technology evaluations, security architecture
- **QA**: Uses extended thinking for critical quality gate decisions, complex test strategy design, risk evaluation

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

## Working with Subagents

### Agent Structure

Each subagent in `.claude/subagents/[agent]/` contains:

- **`prompt.md`**: Agent's system prompt and instructions
- **`capabilities.yaml`** (if present): Tool permissions and capabilities
- **`context.md`** (if present): Agent-specific context and examples

### Invoking Subagents

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
Use the Analyst subagent to create a project brief for [feature]
```

**Method 3: Slash Commands**
Some commands automatically route to specific agents.

### Agent Routing Flow

1. User prompt submitted
2. `user_prompt_submit.yaml` hook normalizes prompt
3. `config.yaml` matches trigger words to agent
4. Subagent loaded with its prompt, capabilities, and context
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
- ✅ Subagents auto-discover from `.claude/subagents/[agent]/prompt.md`
- ✅ Rules auto-load from `.claude/rules/` (hierarchical)
- ✅ Hooks load from `.claude/hooks/*.yaml`
- ✅ Commands load from `.claude/commands/*.md`
- ✅ Skills load from `.claude/skills/*.yaml`

### Q: Do I need to configure anything?

**A:** Initial setup requires:
1. Enable hooks in Preferences → Claude Code → Hooks
2. Point to `.claude/hooks` directory
3. (Optional) Register MCP servers from `.claude/.mcp.json`

You can also customize:
- Edit agent prompts in `.claude/subagents/[agent]/prompt.md`
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
| Agent Structure | Directory-based (`subagents/[agent]/`) | Flat files (`.mdc` files) |
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

### Q: How do subagents work with hooks?

**A:** Subagents automatically respect hooks:
- `PreToolUse` hook validates before agent uses tools
- `PostToolUse` hook publishes agent artifacts
- `UserPromptSubmit` routes to appropriate agent

Hooks apply to all agents unless specifically excluded.

## Troubleshooting

### Subagents Not Loading

1. **Check file structure**: Must be `.claude/subagents/[agent]/prompt.md`
2. **Check agent name**: Must match directory name
3. **Check `config.yaml`**: Agent must be defined in routing config
4. **Restart Claude Code**: Full restart required after changes

### Hooks Not Executing

1. **Check Preferences**: Hooks must be enabled in Preferences → Claude Code → Hooks
2. **Check path**: Point to `.claude/hooks` directory
3. **Check file format**: Hooks must be YAML (`.yaml` extension)
4. **Check permissions**: Hook files must be executable (if shell commands)

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
- `hooks/` - 3 lifecycle hooks (YAML)
- `commands/` - 2 custom slash commands
- `workflows/` - 2 workflow definitions

Remember: **Claude Code's hierarchical system and Artifacts make it ideal for complex projects!** 🚀

