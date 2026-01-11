# Cursor Setup & Usage Guide

## How Cursor Discovers Your Configuration

Cursor automatically discovers and loads configuration from the `.cursor/` directory in your **project root**. When you start Cursor, it scans for:

1. **`.cursor/agents/`** or **`.cursor/subagents/`** - Agent definitions (`.mdc` files)
2. **`.cursor/rules/`** - Framework-specific rules
3. **`.cursorrules`** - Root rules file (in project root, not inside `.cursor/`)
4. **`.cursor/plans/`** - Plan Mode plans (auto-created when you use Plan Mode)
5. **`.cursorignore`** - Files to exclude from codebase indexing

## Step-by-Step Setup

### Step 1: Copy the Folder Structure

**Option A: Copy Entire `.cursor/` Folder**

```bash
# From production-dropin directory
cp -r production-dropin/.cursor /path/to/your/project/.cursor
```

**Option B: On Windows (PowerShell)**

```powershell
# From production-dropin directory
Copy-Item -Path "C:\dev\projects\LLM-RULES\production-dropin\.cursor" -Destination "C:\path\to\your\project\.cursor" -Recurse
```

**Option C: Manual Copy**

1. Copy the `production-dropin/.cursor/` folder (note: it's already named `.cursor`)
2. Place it in your project root directory
3. Ensure it stays named `.cursor` (with the dot)

### Step 2: Verify Structure

Your project root should look like this:

```
your-project/
├── .cursor/                    # ← Cursor configuration directory
│   ├── subagents/             # Agent definitions (.mdc files)
│   │   ├── analyst.mdc
│   │   ├── architect.mdc
│   │   ├── developer.mdc
│   │   └── ...
│   ├── rules/                 # Framework rules
│   ├── hooks/                 # Lifecycle hooks
│   ├── instructions/          # Usage guides
│   └── skills/                # Reusable skills
├── .cursorrules               # ← Root rules (MUST be in project root)
├── .cursorignore              # ← Indexing exclusions (optional)
└── [your source code]
```

**IMPORTANT:**

- `.cursorrules` goes in the **project root**, NOT inside `.cursor/`
- `.cursorignore` goes in the **project root**, NOT inside `.cursor/`
- `.cursor/plans/` will be created automatically by Cursor when you use Plan Mode

### Step 3: Restart Cursor

1. **Close Cursor completely**
2. **Reopen Cursor** in your project directory
3. **Wait for indexing** (Cursor will scan and load your agents and rules)

### Step 4: Verify It Worked

1. Open **Cursor Settings** → **Workspace** → **Rules**
   - You should see your rules listed
2. Open the **Agent Panel** (usually in sidebar)
   - You should see all 10 agents: Analyst 📊, Architect 🏗️, Developer 💻, etc.
3. Try Plan Mode: Press `Shift+Tab` in the agent input
   - Plan Mode should activate

## About the Folder Structure

The folder is already correctly named `.cursor/` in `production-dropin/.cursor/`. When you copy it:

```
production-dropin/
└── .cursor/              # ← Copy this entire folder
    ├── subagents/        # 10 agent files (.mdc)
    ├── rules/           # Framework rules
    ├── hooks/           # Lifecycle hooks (3 files)
    ├── instructions/    # Usage guides (12 files)
    ├── skills/          # Reusable skills (2 files)
    ├── README.md        # Overview
    ├── QUICK_START.md   # Quick setup guide
    └── USAGE.md         # Complete usage guide
```

**Note:** If you see an empty nested `.cursor/.cursor/` folder (unlikely), you can safely delete it. The main `.cursor/` folder is what Cursor uses.

## Leveraging Plan Mode (The Smart Way)

Plan Mode is **essential** for working effectively with Cursor. It's not just a feature—it's the recommended way to handle complex tasks.

### Why Plan Mode is Critical

1. **Repo Research**: Cursor automatically researches your codebase before creating a plan
2. **Dependency Resolution**: Identifies dependencies and potential conflicts
3. **Structured Execution**: Breaks complex tasks into manageable steps
4. **Multi-File Coordination**: Essential for changes affecting multiple files
5. **Artifact Storage**: Plans are saved for handoffs between agents

### How to Use Plan Mode

#### Basic Workflow

1. **Activate Plan Mode**
   - Press `Shift+Tab` from the agent input field
   - Or use `/plan` command
   - Or trigger automatically (hook fires when ≥2 files affected)

2. **Describe Your Goal**

   ```
   "Create a user authentication system with JWT tokens, login page,
   and protected routes"
   ```

3. **Review Generated Plan**
   - Cursor shows you:
     - Files to be modified/created
     - Code diffs preview
     - Test files and scenarios
     - Dependencies and conflicts
   - **Edit the plan inline** if needed

4. **Approve & Execute**
   - Review carefully
   - Approve when satisfied
   - Cursor executes step-by-step
   - Plan saved to `.cursor/plans/` automatically

#### Advanced: Using Plans with Agents

**Scenario: Multi-Agent Workflow**

1. **Analyst** creates project brief → stored as artifact
2. **Activate Plan Mode** → reference the brief
3. **Architect** creates architecture → plan includes architecture decisions
4. **Approve plan** → plan now includes both brief and architecture
5. **Developer** implements → uses plan as context
6. **QA** reviews → references plan for test coverage

**The Plan becomes the single source of truth!**

### Plan Mode Best Practices

1. **Always Use Plan Mode for:**
   - Multi-file changes (≥2 files)
   - New features affecting multiple components
   - Refactoring across modules
   - Architecture changes

2. **Keep Plans Focused:**
   - ≤7 steps per plan
   - Split large efforts into multiple plans
   - Order steps by dependencies

3. **Review Before Approving:**
   - Check file paths are correct
   - Verify diffs match intent
   - Ensure test coverage included
   - Tag security-critical areas

4. **Update Plans:**
   - Create plan v2 if requirements change
   - Link plans to GitHub/Linear issues
   - Reference plans in agent conversations

### Hooks Integration

Our hooks automatically trigger Plan Mode:

- **`preflight-plan.json`**: Auto-triggers Plan Mode when ≥2 files affected
- Plan stored in `.cursor/plans/` with timestamp
- Linked to chat transcript automatically

## Working with Agents

### Available Agents (10 Total)

| Agent                | Icon                  | Best For                              | Plan Mode Required?               |
| -------------------- | --------------------- | ------------------------------------- | --------------------------------- |
| Analyst 📊           | Analysis              | Market research, requirements         | For multi-step analysis           |
| PM 📋                | Product Management    | PRDs, user stories, roadmaps          | For full product specs            |
| Architect 🏗️         | Architecture          | System design, tech selection         | **Always** for architecture       |
| Developer 💻         | Development           | Code implementation, debugging        | **Always** for multi-file changes |
| QA 🧪                | Quality Assurance     | Test plans, quality gates             | For comprehensive test plans      |
| UX Expert 🎨         | UX Design             | UI/UX specs, accessibility            | For full design systems           |
| Product Owner 👤     | Product Ownership     | Story refinement, acceptance criteria | Recommended                       |
| Scrum Master 🔄      | Process Management    | Story preparation, agile facilitation | Recommended                       |
| BMAD Orchestrator 🎭 | Workflow Coordination | Multi-agent orchestration             | Recommended                       |
| BMAD Master 🌟       | Universal Executor    | Any task execution                    | Recommended                       |

### Agent Selection Strategy

1. **Start with Plan Mode** (`Shift+Tab`)
   - Describe your goal comprehensively
   - Let Cursor research the repo
   - Review the generated plan

2. **Choose Appropriate Agent**
   - Select agent from panel
   - Reference the plan in your prompt: "Use the plan I just created..."

3. **Execute with Composer** (for fast iterations)
   - After plan approval
   - Switch to Composer for implementation
   - Use plan as context

4. **Handoff to Next Agent**
   - Use Plan Mode artifacts for handoffs
   - Reference plan in next agent conversation
   - Update plan as work progresses

## Common Questions

### Q: Will Cursor auto-discover everything?

**A:** Yes! After copying `.cursor/` to your project root and restarting Cursor:

- ✅ Agents auto-discover from `.cursor/subagents/*.mdc`
- ✅ Rules auto-load from `.cursor/rules/`
- ✅ Hooks auto-register from `.cursor/hooks/*.json`
- ✅ Root rules load from `.cursorrules` (project root)

### Q: Do I need to configure anything?

**A:** No initial configuration needed, but you can:

- Edit agent prompts in `.cursor/subagents/*.mdc`
- Add custom rules to `.cursor/rules/`
- Adjust hooks in `.cursor/hooks/` (3 hooks currently: preflight-plan, post-run, security)
- Add `.cursorrules` to project root if you want universal rules

### Q: What if Plan Mode doesn't activate?

**A:** Check:

1. Hook file exists: `.cursor/hooks/preflight-plan.json`
2. Hooks enabled in settings: Cursor Settings → Workspace → Hooks
3. Try manual activation: `Shift+Tab` or `/plan` command

### Q: Can I use this in a monorepo?

**A:** Yes! Structure for monorepos:

```
monorepo/
├── .cursor/              # Shared config
├── apps/
│   └── web/
│       └── .cursorrules  # App-specific rules
└── packages/
    └── ui/
        └── .cursorrules  # Package-specific rules
```

### Q: How do agents work with Plan Mode?

**A:** Agents automatically:

- Reference plans when you mention them
- Use plan context for decisions
- Update plans as work progresses
- Store plans in `.cursor/plans/` for traceability

## Troubleshooting

### Agents Not Showing Up

1. **Check file location**: Must be in `.cursor/subagents/*.mdc` (not `.cursor/agents/`)
2. **Check file format**: Must have valid YAML frontmatter
3. **Restart Cursor**: Full restart required (not just reload)
4. **Check Cursor version**: Requires Cursor 2.0 or later

### Rules Not Loading

1. **Check manifest**: `.cursor/rules/manifest.yaml` should exist
2. **Check file patterns**: Rules load based on glob patterns
3. **Verify stack profile**: Manifest defines which rules load for which stack

### Plan Mode Not Working

1. **Check hooks**: `.cursor/hooks/preflight-plan.json` must exist
2. **Try manual**: Press `Shift+Tab` to test
3. **Check Cursor version**: Plan Mode requires Cursor 2.0 (Oct 2025)

## Next Steps

1. ✅ Copy `.cursor/` folder from `production-dropin/.cursor/` to your project root
2. ✅ Restart Cursor completely (not just reload)
3. ✅ Verify agents appear (should see 10 agents)
4. ✅ Verify hooks loaded (3 hooks: preflight-plan, post-run, security)
5. ✅ Test Plan Mode (`Shift+Tab` in agent input)
6. ✅ Review `QUICK_START.md` and `USAGE.md` in `.cursor/` folder
7. ✅ Start using agents with Plan Mode!

**Important Files in `.cursor/`:**

- `README.md` - Overview and features
- `QUICK_START.md` - Fast setup steps
- `USAGE.md` - Complete usage workflows
- `instructions/plan-mode.md` - Detailed Plan Mode guide
- `instructions/` - 12 comprehensive guides

Remember: **Plan Mode is the smart way to build**. Always use it for complex tasks!
