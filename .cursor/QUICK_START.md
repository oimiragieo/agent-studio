# Quick Start: Using the Cursor Agent Pack

## ✅ Step 1: Copy to Your Project

Copy the entire `.cursor` folder from `production-dropin/.cursor/` to your project root:

**Windows (PowerShell):**
```powershell
Copy-Item -Path "C:\dev\projects\LLM-RULES\production-dropin\.cursor" -Destination "C:\path\to\your\project\.cursor" -Recurse
```

**Mac/Linux:**
```bash
cp -r /path/to/production-dropin/.cursor /path/to/your/project/.cursor
```

**Manual:**
1. Copy the `.cursor` folder
2. Paste it into your project root directory
3. Ensure it's named `.cursor` (with the dot)

## ✅ Step 2: Verify Structure

Your project should look like:
```
your-project/
├── .cursor/                    # ← The folder you just copied
│   ├── subagents/             # 10 agent files (.mdc)
│   ├── rules/                 # Framework rules
│   ├── hooks/                 # Auto-triggers (Plan Mode!)
│   ├── instructions/          # Usage guides
│   └── skills/                # Reusable capabilities
├── .cursorrules               # ← Copy this from production-dropin root (if exists)
└── [your code files]
```

## ✅ Step 3: Restart Cursor

1. **Close Cursor completely** (don't just reload)
2. **Reopen Cursor** in your project directory
3. **Wait 10-15 seconds** for auto-discovery

## ✅ Step 4: Verify It Worked

1. **Check Agents**: Open Cursor Settings → Workspace → look for agent panel
2. **Check Rules**: Settings → Rules → should see rules loaded
3. **Test Plan Mode**: Press `Shift+Tab` in agent input → Plan Mode should activate

## 🎯 How Cursor Auto-Discovers

Cursor automatically finds:
- ✅ **Agents** from `.cursor/subagents/*.mdc`
- ✅ **Rules** from `.cursor/rules/` (based on file patterns)
- ✅ **Hooks** from `.cursor/hooks/*.json` (triggers Plan Mode!)
- ✅ **Root rules** from `.cursorrules` (in project root)

**No configuration needed!** Just copy and restart.

## 🚀 Using Plan Mode (The Smart Way)

### Auto-Trigger
The `preflight-plan.json` hook automatically triggers Plan Mode when you're about to modify ≥2 files. No action needed!

### Manual Trigger
Press `Shift+Tab` in the agent input field, or type `/plan`

### Why Plan Mode is Essential

1. **Repo Research**: Cursor scans your codebase before planning
2. **Dependency Detection**: Finds conflicts and dependencies automatically
3. **Structured Execution**: Breaks tasks into manageable steps
4. **Multi-File Safety**: Essential for coordinated changes
5. **Artifact Storage**: Plans saved to `.cursor/plans/` for handoffs

### Workflow Example

```
1. You: "Create a login page with authentication"
2. Press Shift+Tab → Plan Mode activates
3. Cursor researches repo, asks clarifying questions
4. Plan generated showing:
   - Files to create/modify
   - Code diffs preview
   - Test files needed
5. You review and approve plan
6. Plan saved to .cursor/plans/
7. Developer agent uses plan as context
8. Implementation proceeds step-by-step
```

## 📋 Agent Usage with Plan Mode

### Best Practice Workflow

1. **Start with Plan Mode** (`Shift+Tab`)
   - Describe your goal
   - Let Cursor research and create plan
   - Review generated plan

2. **Select Agent**
   - Reference the plan: "Use the plan I just created to..."
   - Agent uses plan as context

3. **Execute**
   - Developer implements from plan
   - Plan updates as work progresses
   - Plans stored for traceability

### When to Use Which Agent

| Agent | Use Plan Mode? | Best For |
|-------|---------------|----------|
| Architect 🏗️ | **ALWAYS** | System design, tech selection |
| Developer 💻 | **ALWAYS** | Multi-file changes, features |
| QA 🧪 | Recommended | Comprehensive test plans |
| Analyst 📊 | For complex analysis | Full project briefs |
| PM 📋 | Recommended | Complete PRDs, roadmaps |

## ⚠️ About the Nested .cursor Folder

If you see an empty `.cursor/.cursor/` folder inside:
- **It's harmless** - Cursor won't use it
- **You can delete it** - it's not needed
- **Not a problem** - main `.cursor/` folder is what matters

The structure Cursor uses:
```
.cursor/              ← Main folder (what Cursor reads)
├── subagents/
├── hooks/
└── ...
```

NOT:
```
.cursor/
└── .cursor/          ← This nested one doesn't matter
```

## 🔍 Troubleshooting

### Agents Not Showing
- ✅ Files must be in `.cursor/subagents/*.mdc` (not `.cursor/agents/`)
- ✅ Restart Cursor completely (not just reload)
- ✅ Check Cursor version (needs 2.0+)

### Plan Mode Not Working
- ✅ Hook file exists: `.cursor/hooks/preflight-plan.json`
- ✅ Try manual: Press `Shift+Tab`
- ✅ Check Cursor version (Plan Mode is Cursor 2.0 feature)

### Rules Not Loading
- ✅ Check `.cursor/rules/manifest.yaml` exists
- ✅ Rules load based on file patterns (globs)
- ✅ Check Cursor Settings → Rules

## 📚 Next Steps

1. ✅ Copy `.cursor/` to your project
2. ✅ Restart Cursor
3. ✅ Test Plan Mode (`Shift+Tab`)
4. ✅ Try an agent with a plan
5. ✅ Read `instructions/plan-mode.md` for advanced usage

**Remember: Plan Mode is the smart way to build. Use it!** 🎯

