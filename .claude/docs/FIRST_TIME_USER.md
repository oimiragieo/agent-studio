# First-Time User Guide

Welcome to Agent Studio! This guide will help you get started in 5 minutes.

## What is Agent Studio?

Agent Studio is a drop-in configuration bundle that gives you:

- **22 specialized AI agents** for different tasks
- **13 utility skills** for code generation, validation, and more
- **1,081+ technology rules** that auto-apply to your code
- **10 workflows** for common development tasks
- **Cross-platform support** for Claude Code, Cursor IDE, and Factory Droid

## Quick Start (5 Minutes)

### Step 1: Copy Configuration

Copy the `.claude/` folder and `CLAUDE.md` to your project root:

```bash
# From the Agent Studio directory
cp -r .claude/ /path/to/your/project/
cp CLAUDE.md /path/to/your/project/
```

**Windows PowerShell:**

```powershell
Copy-Item -Path ".claude" -Destination "C:\path\to\your\project\.claude" -Recurse
Copy-Item -Path "CLAUDE.md" -Destination "C:\path\to\your\project\CLAUDE.md"
```

### Step 2: Verify Structure

Your project should now have:

```
your-project/
├── CLAUDE.md           # Root instructions
├── .claude/            # Configuration directory
│   ├── agents/         # 23 agent definitions (including new Planner)
│   ├── skills/         # 13 utility skills
│   ├── workflows/      # 10 workflow definitions
│   └── ...
└── [your source code]
```

### Step 3: Install Dependencies (Optional)

For validation scripts:

```bash
cd /path/to/your/project
pnpm install
pnpm validate
```

### Step 4: Configure Rules

Run the rule selector to auto-detect your stack:

```
"Select rules for this project"
```

Or use the command:

```
/select-rules
```

### Step 5: Test It Works

Try a simple command:

```
/review
```

Or ask a question:

```
"Help me understand how to use this tool"
```

## What to Read Next

### Essential Reading (Start Here)

1. **README.md** - Overview of all features
2. **GETTING_STARTED.md** - Detailed setup instructions
3. **CUJ Index** (`.claude/docs/cujs/CUJ-INDEX.md`) - All 47 user journeys

### Key Concepts

**Agents**: Specialized AI assistants for different tasks

- **Planner** - Creates comprehensive plans (NEW!)
- **Analyst** - Business analysis and research
- **Developer** - Code implementation
- **Architect** - System design
- And 20 more...

**Skills**: Utility tools that work with your rules

- **scaffolder** - Generate rule-compliant code
- **rule-auditor** - Validate code compliance
- **claude-md-generator** - Auto-generate claude.md files (NEW!)
- **plan-generator** - Create structured plans (NEW!)
- And 9 more...

**Workflows**: Pre-defined agent sequences

- **quick-flow** - Bug fixes and small changes
- **greenfield-fullstack** - New projects from scratch
- **code-quality-flow** - Code review and refactoring
- And 7 more...

## Common First Tasks

### 1. Configure Rules for Your Stack

```
/select-rules
```

Auto-detects your tech stack and configures appropriate rules.

### 2. Generate a Component

```
"Scaffold a UserProfile component"
```

Creates rule-compliant component boilerplate.

### 3. Plan a New Feature

```
"I want to build a user dashboard"
```

Planner creates comprehensive plan with all steps.

### 4. Review Your Code

```
/review
```

Comprehensive code review with recommendations.

### 5. Audit Code Compliance

```
/audit src/components/
```

Validates code against your project rules.

## Understanding CUJs (Customer User Journeys)

CUJs are complete workflows from start to finish. We have 48 documented CUJs (CUJ-031/032/033 are reserved/removed):

- **Onboarding & Setup** (CUJ-001 to CUJ-003)
- **Planning & Architecture** (CUJ-004 to CUJ-008)
- **Development** (CUJ-009 to CUJ-012)
- **Quality Assurance** (CUJ-013 to CUJ-015)
- **Documentation** (CUJ-016 to CUJ-018)
- **Specialized Workflows** (CUJ-019 to CUJ-022)
- **Maintenance & Operations** (CUJ-023 to CUJ-024)

See `.claude/docs/cujs/CUJ-INDEX.md` for the complete list.

## New Features in This Version

### Planner Agent

A new dedicated agent for comprehensive planning:

- Creates structured plans before execution
- Coordinates with specialists (Analyst, PM, Architect)
- Validates plan completeness
- Tracks execution progress

### claude.md File Generation

Automatic generation of claude.md files:

- Developer agent creates claude.md for new modules
- Technical Writer can generate claude.md on demand
- claude-md-generator skill automates the process

### New Skills

Five new utility skills:

- **plan-generator** - Creates structured plans
- **diagram-generator** - Generates architecture/database diagrams
- **test-generator** - Generates test code
- **dependency-analyzer** - Analyzes and updates dependencies
- **doc-generator** - Generates comprehensive documentation

## Troubleshooting

### Agents Not Activating

1. Check `CLAUDE.md` is in project root (not inside `.claude/`)
2. Verify `.claude/config.yaml` exists
3. Restart Claude Code after copying files

### Rules Not Loading

1. Run `/select-rules` to configure rules
2. Check `manifest.yaml` exists in `.claude/context/`
3. Verify rule files exist in `.claude/rules/`

### Skills Not Working

1. Check skill files exist in `.claude/skills/`
2. Verify skill syntax is correct
3. Check skill is referenced in documentation

## Next Steps

1. **Explore CUJs**: Read `.claude/docs/cujs/CUJ-INDEX.md` to see all workflows
2. **Try a Workflow**: Start with `/quick-ship` for a simple task
3. **Customize Agents**: Edit `.claude/agents/` to match your team's style
4. **Add Rules**: Create technology-specific rules in `.claude/rules/`
5. **Enable Hooks**: Set up security and audit hooks (see GETTING_STARTED.md)

## Getting Help

- **Documentation**: `.claude/docs/` directory
- **CUJ Examples**: `.claude/docs/cujs/` directory
- **Agent Details**: `.claude/agents/` directory
- **Workflow Guide**: `.claude/workflows/WORKFLOW-GUIDE.md`

## Common Pitfalls

1. **Wrong File Location**: `CLAUDE.md` must be in project root, not inside `.claude/`
2. **Missing Validation**: Run `pnpm validate` to check configuration
3. **Rules Not Configured**: Run `/select-rules` before using scaffolder
4. **Hooks Not Enabled**: Hooks are optional but recommended for security

## Success Checklist

After setup, you should be able to:

- [ ] Run `/select-rules` and see rules configured
- [ ] Run `/review` and get code review
- [ ] Scaffold a component with `/scaffold component Test`
- [ ] Create a plan with "Plan feature X"
- [ ] Generate claude.md for a module

## What Makes This Different?

Unlike other tools, Agent Studio:

- ✅ **No installation** - Just copy files
- ✅ **No build step** - Works immediately
- ✅ **No dependencies** - Core features work without Node.js
- ✅ **Cross-platform** - Works with Claude Code, Cursor, Factory
- ✅ **Rule-aware** - Code generation follows your standards
- ✅ **Plan-first** - Comprehensive planning before execution (NEW!)

Happy coding with your AI agent team!
