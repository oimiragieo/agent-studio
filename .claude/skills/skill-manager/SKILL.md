---
name: skill-manager
description: Create, validate, install, convert, port, and manage Claude Code skills. Use when users want to create a new skill, validate existing skills, install from GitHub, list skills, convert MCP servers to skills, or port skills between Claude and Gemini platforms. Covers the full skill lifecycle from creation to cross-platform distribution.
---

# Skill Manager

## ⚠️ ORCHESTRATION NOTICE

**If you are an orchestrator invoking this skill for bulk operations (e.g., "validate all skills", "review all skills", "fix all skills"), you MUST:**

1. **Spawn a subagent** using the Task tool with `subagent_type="developer"` or `subagent_type="qa"`
2. **Pass the task** to the subagent with clear instructions
3. **DO NOT** read skill files directly yourself

**Example proper delegation:**
```
Task: developer
Prompt: "Use the skill-manager skill to validate all skills in .claude/skills/.
Run: node .claude/skills/skill-manager/scripts/list.cjs --format json
Then validate each skill with: node .claude/skills/skill-manager/scripts/validate.cjs <path>
Fix any issues found in the SKILL.md frontmatter."
```

---

Unified skill for managing Claude Code skills: create, validate, install, list, convert MCP servers, and port between Claude/Gemini platforms.

## Quick Reference

| Operation | Command |
|-----------|---------|
| Create new skill | `node scripts/create.cjs <name> [--resources scripts,references,assets] [--no-test]` |
| Validate skill | `node scripts/validate.cjs <path>` |
| Install from GitHub | `node scripts/install.cjs --repo owner/repo --path path/to/skill` |
| List installed | `node scripts/list.cjs` |
| List from repo | `node scripts/list.cjs --repo owner/repo --path skills/` |
| Convert MCP to skill | `node scripts/convert.cjs --server <name>` |
| Convert from URL/name | `node scripts/convert.cjs <name-or-url>` |
| List known servers | `node scripts/convert.cjs --known` |
| List MCP servers | `node scripts/convert.cjs --list` |
| Show MCP catalog | `node scripts/convert.cjs --catalog` |
| Test a skill | `node scripts/test.cjs <path>` |
| Port to Gemini | `node scripts/port.cjs <path> --to gemini` |
| Port to Claude | `node scripts/port.cjs <path> --to claude` |
| Make universal | `node scripts/port.cjs <path> --universal` |
| Analyze platform | `node scripts/port.cjs <path> --analyze` |

## Creating Skills

### Skill Structure

```
skill-name/
├── SKILL.md              # Required: Frontmatter + instructions
├── scripts/              # Optional: Executable code
├── references/           # Optional: Documentation to load as needed
└── assets/               # Optional: Templates, images, fonts
```

### SKILL.md Format

```yaml
---
name: skill-name
description: What the skill does and WHEN to use it. Include triggers.
---

# Skill Title

Instructions for using the skill...
```

### Create Command

```bash
# Basic skill (auto-tests after creation)
node scripts/create.cjs my-skill

# With resource directories
node scripts/create.cjs my-skill --resources scripts,references

# With example files
node scripts/create.cjs my-skill --resources scripts,references,assets --examples

# Custom location
node scripts/create.cjs my-skill --path /custom/path

# Skip auto-testing
node scripts/create.cjs my-skill --no-test
```

**Note**: Skills are automatically validated after creation. New skills will show TODO warnings - this is expected until you complete the SKILL.md template.

### Core Principles

**Concise is Key**: The context window is shared. Only add what Claude doesn't already know.

**Progressive Disclosure**:
1. Metadata (name + description) - Always loaded (~100 words)
2. SKILL.md body - When skill triggers (<500 lines)
3. Bundled resources - As needed (unlimited)

**Degrees of Freedom**:
- High freedom (text instructions): Multiple valid approaches
- Medium freedom (pseudocode/parameters): Preferred pattern with variation
- Low freedom (specific scripts): Fragile operations requiring consistency

## Validating Skills

```bash
node scripts/validate.cjs .claude/skills/my-skill
```

Checks:
- SKILL.md exists with valid YAML frontmatter
- Required fields: `name`, `description`
- Name format: lowercase, hyphens, digits only
- Description: No angle brackets, max 1024 chars
- No TODO placeholders in production skills

## Installing Skills

### From GitHub Repository

```bash
# Using repo + path
node scripts/install.cjs --repo owner/repo --path path/to/skill

# Using full URL
node scripts/install.cjs --url https://github.com/owner/repo/tree/main/skills/my-skill

# Multiple skills
node scripts/install.cjs --repo owner/repo --path skills/skill-1 skills/skill-2

# Specific branch/tag
node scripts/install.cjs --repo owner/repo --path skills/my-skill --ref v1.0.0

# Custom destination
node scripts/install.cjs --repo owner/repo --path skills/my-skill --dest ./custom/skills
```

### Install Behavior

- Downloads via GitHub API (public repos) or git sparse checkout (private repos)
- Validates SKILL.md exists before installing
- Installs to `.claude/skills/<skill-name>/` by default
- Aborts if destination already exists
- Supports `GITHUB_TOKEN` or `GH_TOKEN` for private repos

## Listing Skills

```bash
# List installed skills
node scripts/list.cjs

# List skills from a GitHub repo
node scripts/list.cjs --repo owner/repo --path skills/

# JSON output
node scripts/list.cjs --format json
```

## Converting MCP Servers to Skills

Convert MCP servers to skills for 90%+ context savings. Instead of loading all MCP tools into context at startup, skills use progressive disclosure.

### Why Convert?

| Mode | Context Usage | When Loaded |
|------|---------------|-------------|
| MCP Server | ~30k tokens | Always (startup) |
| Skill | ~500 tokens | On-demand |

### Convert Without .mcp.json (Recommended)

For official MCP servers, you can convert directly without adding to .mcp.json first:

```bash
# Convert by name (known servers - npm)
node scripts/convert.cjs filesystem
node scripts/convert.cjs puppeteer
node scripts/convert.cjs slack

# Convert by name (known servers - PyPI)
node scripts/convert.cjs git
node scripts/convert.cjs time
node scripts/convert.cjs sentry

# Convert from GitHub URL
node scripts/convert.cjs https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem
node scripts/convert.cjs https://github.com/modelcontextprotocol/servers/tree/main/src/git

# List all known servers (npm + PyPI)
node scripts/convert.cjs --known
```

**Known servers** are built-in with correct package names and environment variables. The converter supports both:
- **npm servers**: Node.js packages (14 servers: filesystem, memory, github, slack, etc.)
- **PyPI servers**: Python packages (9 servers: git, time, sentry, aws-kb-retrieval, etc.)

Run `--known` to see the full list.

### Convert from .mcp.json

For servers already in your `.mcp.json`, or third-party servers:

```bash
# List configured MCP servers with conversion eligibility
node scripts/convert.cjs --list

# Convert specific server from .mcp.json
node scripts/convert.cjs --server slack

# Show catalog with tool counts and token estimates
node scripts/convert.cjs --catalog
```

### Convert Options

```bash
# Dry run (show what would happen)
node scripts/convert.cjs filesystem --dry-run

# Overwrite existing skill
node scripts/convert.cjs filesystem --force

# Skip automatic testing
node scripts/convert.cjs filesystem --no-test

# Convert all eligible servers from .mcp.json
node scripts/convert.cjs --all
```

### Generated Files

Converted skills include:
- `SKILL.md`: Progressive disclosure documentation
- `executor.py`: Python wrapper for MCP tool calls (with path auto-detection for servers like git)
- `config.json`: MCP server configuration

**Python servers** (PyPI) generate executors with special path handling:
- `git`: Auto-detects git repository root
- Future: Other servers may auto-detect project roots, working directories, etc.

### Catalog Integration

The converter uses `.claude/skills/mcp-converter/mcp-catalog.yaml` for:
- Tool count estimates
- Token usage estimates
- Conversion priority
- Keep-as-MCP exceptions (github, filesystem, memory)

### When to Keep as MCP

Some servers work better as MCP (always loaded):
- **github**: Frequently used for PRs/issues
- **filesystem**: Core file operations
- **memory**: Always needed for context

The catalog marks these with `keep_as_mcp: true`.

## Testing Skills

Skills are automatically tested after conversion. You can also run tests manually:

```bash
# Test a skill (validation + introspection if executor exists)
node scripts/test.cjs .claude/skills/my-skill

# Test with specific tool call
node scripts/test.cjs .claude/skills/sequential-thinking --call sequentialthinking --args '{"thought": "test", "thoughtNumber": 1, "totalThoughts": 1, "nextThoughtNeeded": false}'

# Skip introspection
node scripts/test.cjs .claude/skills/my-skill --no-validate

# JSON output
node scripts/test.cjs .claude/skills/my-skill --json
```

### What Gets Tested

1. **Validation**: Checks SKILL.md structure and frontmatter
2. **Introspection**: Runs `executor.py --list` to verify MCP connection
3. **Tool Call** (optional): Calls a specific tool with test arguments

### Automatic Testing on Convert

When using `convert.cjs`, tests run automatically after conversion:

```bash
# Converts and tests
node scripts/convert.cjs --server slack

# Skip testing
node scripts/convert.cjs --server slack --no-test
```

## Skill Design Patterns

### Pattern 1: Workflow-Based (Sequential Processes)

```markdown
## Workflow Decision Tree
1. If creating new → Section A
2. If editing existing → Section B

## Section A: Creating
Step-by-step instructions...
```

### Pattern 2: Task-Based (Tool Collections)

```markdown
## Quick Start
Basic usage example...

## Merge PDFs
Instructions for merging...

## Extract Text
Instructions for extraction...
```

### Pattern 3: Reference-Based (Standards/Specs)

```markdown
## Guidelines
Core principles...

## Specifications
Detailed specs...
```

### Pattern 4: Progressive Disclosure

```markdown
## Quick Start
Basic example here...

## Advanced Features
- **Form filling**: See [references/forms.md](references/forms.md)
- **API reference**: See [references/api.md](references/api.md)
```

## Resource Guidelines

### scripts/
Executable code for deterministic operations.
- When: Same code rewritten repeatedly, needs reliability
- Example: `rotate_pdf.py`, `convert_image.py`

### references/
Documentation loaded into context as needed.
- When: Detailed info needed only for specific tasks
- Example: `api_reference.md`, `schema.md`

### assets/
Files used in output, not loaded into context.
- When: Templates, images, fonts for final output
- Example: `template.pptx`, `logo.png`

## What NOT to Include

- README.md, CHANGELOG.md, INSTALLATION_GUIDE.md
- User-facing documentation
- Setup/testing procedures
- Process documentation

The skill should only contain what Claude needs to do the job.

## Porting Skills (Cross-Platform Conversion)

Convert skills between Claude Code and Gemini CLI platforms. Based on [skill-porter](https://github.com/jduncan-rva/skill-porter).

### Why Port?

- **Write once, deploy to both**: Create a skill for Claude, port it to Gemini (or vice versa)
- **~85% code reuse**: MCP server configurations are 100% reusable across platforms
- **Automatic translation**: Tool restrictions (allowlist ↔ denylist), paths, and metadata transform automatically

### Platform Detection

```bash
# Analyze a skill/extension to detect its platform
node scripts/port.cjs ./my-skill --analyze
```

Output shows:
- Detected platform (claude, gemini, universal, unknown)
- Platform-specific files found
- Metadata from config files
- Conversion recommendations

### Convert to Gemini

```bash
# Convert Claude skill to Gemini extension
node scripts/port.cjs .claude/skills/my-skill --to gemini

# Custom output path
node scripts/port.cjs .claude/skills/my-skill --to gemini --output ./gemini-extensions/my-skill

# Force overwrite
node scripts/port.cjs .claude/skills/my-skill --to gemini --force
```

**What gets converted:**
- `SKILL.md` → `gemini-extension.json` + `GEMINI.md`
- `config.json` → MCP server entries in manifest
- `allowed-tools` (allowlist) → `excludeTools` (denylist)
- `scripts/` → `servers/`
- Environment variables → Settings schema

### Convert to Claude

```bash
# Convert Gemini extension to Claude skill
node scripts/port.cjs ./gemini-ext --to claude

# Custom output path
node scripts/port.cjs ./gemini-ext --to claude --output .claude/skills/converted
```

**What gets converted:**
- `gemini-extension.json` → `SKILL.md` frontmatter
- `GEMINI.md` → `SKILL.md` body
- `excludeTools` (denylist) → `allowed-tools` (allowlist)
- `servers/` → `scripts/`
- Settings → Environment variables in `config.json`

### Make Universal

```bash
# Add support for both platforms
node scripts/port.cjs .claude/skills/my-skill --universal

# Custom output (creates new directory with both formats)
node scripts/port.cjs .claude/skills/my-skill --universal --output ./universal-skill
```

This creates a skill that works on both Claude Code and Gemini CLI by including:
- `SKILL.md` (Claude)
- `gemini-extension.json` + `GEMINI.md` (Gemini)
- Shared resources in `shared/`

### Tool Restriction Mapping

| Claude (allowlist) | Gemini (denylist) |
|--------------------|-------------------|
| `allowed-tools: [Read, Write]` | `excludeTools: [Edit, Bash, Glob, Grep, WebFetch, ...]` |
| `allowed-tools: []` (all allowed) | `excludeTools: []` (none excluded) |

### Path Variable Mapping

| Claude | Gemini |
|--------|--------|
| `${skillPath}` | `${extensionPath}` |

### Limitations

- Slash commands (Claude) ↔ TOML commands (Gemini) require manual adjustment
- Complex subagent configurations may need review
- Platform-specific tool names should be verified after conversion
