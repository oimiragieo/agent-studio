# AGENTS.md - Agent Studio

Multi-platform agent configuration bundle for Claude Code, Cursor IDE, and Factory Droid.

## Commands
```bash
pnpm validate            # Validate all agent configuration files
pnpm validate:verbose    # Verbose validation output
pnpm validate:sync       # Validate cross-platform sync (bash scripts/validate-sync.sh)
```

## Code Style
- **File types**: Markdown (`.md`), YAML (`.yaml`), JSON Schema (`.schema.json`), JavaScript ESM (`.mjs`)
- **Naming**: kebab-case for files and directories (e.g., `code-reviewer.md`, `rule-auditor/`)
- **YAML frontmatter**: Required in `.mdc` files with `description`, `alwaysApply` fields
- **Imports**: ES modules only (`import`/`export`), no CommonJS
- **Error handling**: Always validate inputs; use descriptive error messages

## Key Directories
- `.claude/agents/` - Agent prompts (23 roles, including new Planner agent)
- `.claude/rules/` - Framework-specific rules (200+)
- `.claude/skills/` - Utility skills (13 skills, including 5 new ones)
- `.claude/docs/cujs/` - Customer User Journeys (24 CUJs documented)
- `.cursor/rules/` - Cursor rules (auto-loaded by file pattern)
- `scripts/` - Validation and migration scripts

## New Features

### Planner Agent (NEW!)
- Creates comprehensive plans before execution
- Coordinates with specialists (Analyst, PM, Architect)
- Validates plan completeness and feasibility
- Tracks execution progress
- See `.claude/agents/planner.md` for Claude version
- See `.cursor/subagents/planner.mdc` for Cursor version

**Important: Planner Agent vs Plan Mode**
- **Planner Agent** (Persona): A strategic planning agent that creates comprehensive plans, coordinates specialists, and validates execution. Available in both Claude (`.claude/agents/planner.md`) and Cursor (`.cursor/subagents/planner.mdc`).
- **Plan Mode** (Cursor UI Feature): Cursor's built-in structured planning canvas that auto-researches the repo before coding. Activated with `Shift+Tab` or automatically via hooks.
- **When to Use**: Use Planner Agent for strategic, multi-agent coordination planning. Use Plan Mode for implementation-level planning of multi-file changes. They work together: Planner Agent creates strategic plans that can be referenced in Plan Mode for detailed implementation.

### New Skills (5 Added)
- **claude-md-generator**: Auto-generates claude.md files for modules
- **plan-generator**: Creates structured plans from requirements
- **diagram-generator**: Generates architecture/database diagrams
- **test-generator**: Generates test code from specifications
- **dependency-analyzer**: Analyzes and updates dependencies
- **doc-generator**: Generates comprehensive documentation

### Customer User Journeys (CUJs)
- 24 complete workflows documented
- See `.claude/docs/cujs/CUJ-INDEX.md` for complete list
- Each CUJ includes: trigger, workflow, agents, skills, outputs, success criteria

### Plan-First Workflows
- All workflows now start with Planner agent (Step 0)
- Comprehensive planning before execution
- Plan validation and tracking
- See `.claude/workflows/WORKFLOW-GUIDE.md` for details

## Security
- Never commit secrets or `.env*` files
- Blocked: `rm -rf`, force push to main/master, editing credentials
