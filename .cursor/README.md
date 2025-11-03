# Cursor 2.0 Drop-In

This bundle targets Cursor 2.0's multi-agent UI with Composer, Plan Mode, and Cloud Agents announced in October 2025 [3][4]. Copy the folder into your project root as `.cursor/` (or merge with existing settings) and restart Cursor.

## Highlights

- **Composer-optimized subagents** tuned for low-latency, multi-step coding turns with the 4× faster Composer model [3].
- **Plan Mode hooks and instructions** to auto-generate editable implementation plans before large code changes, leveraging Cursor's repo research pipeline [4].
- **Cloud Agent workflows** so longer-running tasks continue in Cursor Web, Slack, Linear, or GitHub without keeping the IDE open [5].
- **Shared rules** synchronized with Claude and Droid packs to keep linting, testing, and framework patterns consistent.
- **JIT Indexing** with quick find commands for efficient codebase navigation without loading full context.
- **Definition of Done** checklists for quality gates and pre-PR verification.

## Quick Start

### Copy Instructions

**Copy the `.cursor` folder to your project root:**

**Windows (PowerShell):**
```powershell
Copy-Item -Path "C:\dev\projects\LLM-RULES\production-dropin\.cursor" -Destination "C:\path\to\your\project\.cursor" -Recurse
```

**Mac/Linux:**
```bash
cp -r /path/to/production-dropin/.cursor /path/to/your/project/.cursor
```

**Manual:**
1. Copy the `.cursor` folder from `production-dropin/.cursor/`
2. Paste into your project root
3. Ensure it's named `.cursor` (with the dot)

### Activation Steps

1. **Copy folder**: Copy `.cursor` to your project root (see above)
2. **Restart Cursor**: Close completely, then reopen in your project
3. **Auto-discovery**: Cursor automatically finds agents, rules, and hooks
4. **Verify**: Check Settings → Workspace → Agents should appear
5. **Test Plan Mode**: Press `Shift+Tab` in agent input → Plan Mode activates

**That's it! No configuration needed - just copy and restart.**

## Directory Structure

```
your-project/
├── .cursor/                    # ← Copy this entire folder to your project root
│   ├── subagents/             # 10 agent files (.mdc) - auto-discovered
│   │   ├── analyst.mdc
│   │   ├── architect.mdc
│   │   ├── developer.mdc
│   │   └── ...
│   ├── rules/                 # Framework rules - auto-loaded by file pattern
│   ├── hooks/                 # Lifecycle hooks (auto-triggers Plan Mode!)
│   │   ├── preflight-plan.json  # ← Auto-triggers Plan Mode for ≥2 files
│   │   └── ...
│   ├── instructions/          # Usage guides (Plan Mode, Composer, etc.)
│   └── skills/                # Reusable capabilities
└── .cursorrules               # Optional: root rules (copy to project root if exists)
```

**Important Notes:**
- ✅ `.cursor/` goes in your **project root** (same level as `package.json`, `src/`, etc.)
- ✅ `.cursorrules` goes in **project root**, NOT inside `.cursor/`
- ✅ Cursor auto-discovers everything - no manual config needed
- ✅ `.cursor/plans/` will be auto-created when you use Plan Mode

## Key Features

### Agents
10 specialized agents optimized for Cursor 2.0:
- Analyst 📊, PM 📋, Architect 🏗️, Developer 💻, QA 🧪, UX Expert 🎨
- Product Owner 👤, Scrum Master 🔄, BMAD Orchestrator 🎭, BMAD Master 🌟

### Rules
- Hierarchical rule system with automatic loading based on file patterns
- 1000+ framework-specific rules in `.cursor/rules/`
- Stack profiles defined in `manifest.yaml`

### Workflows
- **Plan Mode**: **Auto-triggers** for multi-file changes (≥2 files) via `preflight-plan.json` hook
  - Press `Shift+Tab` to manually trigger
  - Cursor researches repo, creates structured plan
  - Plans saved to `.cursor/plans/` automatically
  - **This is the smart way to build - always use it!**
- **Composer**: Optimized for fast, iterative coding (use after Plan Mode)
- **Cloud Agents**: Long-running tasks in background
- **Multi-Agent Coordination**: Handoff protocols and context sharing via Plan Mode artifacts

### Quality Gates
- Definition of Done checklists
- Pre-PR verification commands
- Security boundaries and protected files
- Automatic linting and type checking

## Documentation

- **Root Rules**: `.cursorrules` - Universal principles and quick find commands
- **Instructions**: `.cursor/instructions/` - Guides for all Cursor features
- **Agent Coordination**: `.cursor/instructions/agent-coordination.md`
- **Definition of Done**: `.cursor/instructions/definition-of-done.md`
- **JIT Indexing**: `.cursor/instructions/jit-indexing.md`

After copying, open `Cursor → Settings → Workspace` to confirm the new agents and rules are indexed. Trigger Plan Mode with `Shift+Tab` from the agent input.

[3] Cursor, "Introducing Cursor 2.0 and Composer" (Oct 29, 2025).  
[4] Cursor, "Introducing Plan Mode" (Oct 7, 2025).  
[5] Cursor, "Cloud Agents" (Oct 30, 2025).
