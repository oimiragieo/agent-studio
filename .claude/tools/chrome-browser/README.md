# Chrome Browser Tool

Browser automation using Claude in Chrome extension. Enables web testing, debugging, form filling, data extraction, and authenticated web app interaction.

## Overview

This is a standalone CLI tool wrapper for the `chrome-browser` skill. It provides a command-line interface for running the skill with various options.

## Usage

```bash
# Basic usage
node chrome-browser.cjs run

# With options
node chrome-browser.cjs run --input data.json --output result.json --verbose

# Validate inputs only
node chrome-browser.cjs validate --input data.json

# Show help
node chrome-browser.cjs help
```

## Commands

| Command    | Description                      |
| ---------- | -------------------------------- |
| `run`      | Execute the skill (default)      |
| `validate` | Validate inputs before execution |
| `help`     | Show help message                |

## Options

| Option            | Description               |
| ----------------- | ------------------------- |
| `--input <file>`  | Input file path           |
| `--output <file>` | Output file path          |
| `--config <file>` | Configuration file (JSON) |
| `--json`          | Output results as JSON    |
| `--verbose`       | Verbose output            |
| `--help`          | Show help message         |

## Integration

### With Other Tools

```javascript
const { spawnSync } = require('child_process');

// Run the tool (SEC-009: Use spawnSync with shell:false for security)
const result = spawnSync(
  'node',
  ['.claude/tools/chrome-browser/chrome-browser.cjs', 'run', '--json'],
  {
    encoding: 'utf-8',
    shell: false,
  }
);
const data = JSON.parse(result.stdout);
```

### With Claude Agents

Agents can invoke this tool via Bash:

```bash
node .claude/tools/chrome-browser/chrome-browser.cjs run --verbose
```

## Related

- **Skill Definition**: `.claude/skills/chrome-browser/SKILL.md`
- **Skill Script**: `.claude/skills/chrome-browser/scripts/main.cjs`
- **Workflow**: `.claude/workflows/chrome-browser-skill-workflow.md`
