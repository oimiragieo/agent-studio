# Agent Studio (LLM-RULES)

**Agent Studio** is a multi-platform configuration bundle designed to empower AI agents like Claude Code, Cursor IDE, and Factory Droids. It provides a comprehensive set of specialized agents, skills, tools, and rule packs to orchestrate complex software engineering tasks.

## Project Overview

- **Purpose:** To provide a drop-in, "batteries-included" configuration for AI coding assistants.
- **Core Components:**
  - **23 Specialized Agents:** Roles like Architect, Developer, QA, Security Architect, Planner, etc.
  - **13 Utility Skills:** Capabilities like `repo-rag` (search), `scaffolder` (code gen), `rule-auditor` (validation).
  - **1,081+ Rule Packs:** Technology-specific rules (React, Node, Python, etc.) that are auto-applied.
  - **Workflows:** Pre-defined orchestrations for tasks like "Quick Ship" or "Full Stack Feature".
  - **Hooks:** Security and audit hooks for tool execution.

## Directory Structure

The project is organized into platform-specific configuration folders and shared utilities:

- **`.claude/`**: Main configuration for Claude Code.
  - `agents/`: Definitions for the 23 agents.
  - `skills/`: Implementation of utility skills.
  - `rules/`: The vast library of technology-specific rule packs.
  - `workflows/`: YAML definitions for agent orchestration.
  - `hooks/`: Shell scripts for pre/post-tool execution logic (security & audit).
- **`.cursor/`**: Configuration mirrored for Cursor IDE (rules, context).
- **`.factory/`**: Configuration for Factory Droids.
- **`scripts/`**: Maintenance and validation scripts (Node.js).
- **`codex-skills/`**: Skills specific to Codex/OpenAI models (e.g., `multi-ai-code-review`).
- **`.opencode/`**: Configuration for OpenCode.

## Key Files

- **`README.md`**: The primary documentation and entry point.
- **`GETTING_STARTED.md`**: Guide for running workflows and first steps.
- **`FIRST_TIME_USER.md`**: Introduction for new users.
- **`AGENTS.md`**: Detailed documentation of all available agents.
- **`package.json`**: Node.js dependencies and script definitions.
- **`scripts/install.mjs`**: The installer script to copy configurations to a target project.
- **`.claude/CLAUDE.md`**: Core instructions and context for Claude.

## usage

This project is a **configuration source**. You typically "install" it into a target software project.

### Installation

To use these agents in another project:

```bash
# Copy the relevant folders to your project root
node scripts/install.mjs [target-directory]
```

### Common Commands (Maintenance)

If you are contributing to or maintaining this repository:

- **Install Dependencies:**

  ```bash
  pnpm install
  ```

- **Validate Configuration:**

  ```bash
  pnpm validate          # Basic check
  pnpm validate:full     # Comprehensive check (workflows, references, models)
  pnpm validate:sync     # Check parity between platforms
  ```

- **Generate Rule Index:**
  ```bash
  pnpm index-rules       # Rebuilds the rule index from the rules library
  ```

## Development Conventions

- **Configuration as Code:** Agents and workflows are defined in Markdown and YAML.
- **Rule Packs:** Rules are modular and stored in `.claude/rules-library`.
- **Validation:** Always run `pnpm validate:full` before committing changes to ensure configurations are valid and cross-referenced correctly.
- **Scripts:** Maintenance scripts are written in standard ES modules (`.mjs`).
