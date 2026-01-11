# LLM Rules Production Pack

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Platform](https://img.shields.io/badge/Platform-Claude%20Code%20%7C%20Cursor%20%7C%20Factory-purple.svg)]()
[![Agents](https://img.shields.io/badge/Agents-35-green.svg)]()
[![Skills](https://img.shields.io/badge/Skills-110-orange.svg)]()

**Enterprise-grade AI agent orchestration system** for Claude Code, Cursor IDE, and Factory Droid with comprehensive enforcement gates, security validation, and workflow automation.

> **Configuration-First Architecture**: This is a **configuration bundle**, not a runtime system. All functionality comes from configuration files (markdown, YAML, JSON) that are read directly by the IDE/platform. No build step, no server process, no library imports required for core functionality.

## What This Is

A **production-ready, drop-in configuration bundle** for AI agent orchestration. This is a **configuration-first** system - you copy configuration files into your project, and they work immediately with Claude Code, Cursor IDE, or Factory Droid.

### Core Components

- **35 specialized AI agents** with defined roles (core development, enterprise, code quality, specialized)
  - Each agent is a markdown file (`.claude/agents/<name>.md`) with instructions, capabilities, and tool permissions
  - Agents are activated automatically based on keywords, task analysis, or explicit workflow steps

- **110 utility skills** for code generation, validation, planning, and recovery (108 Agent Studio + 2 Codex)
  - Skills are markdown files (`.claude/skills/<name>/SKILL.md`) that provide reusable capabilities
  - Skills can be invoked directly or automatically injected into agent contexts
  - Two types: **Agent Studio Skills** (108 native) and **Codex Skills** (2 CLI-based multi-AI)

- **20 workflow definitions** with enforcement gates and security validation
  - YAML files (`.claude/workflows/<name>.yaml`) defining multi-step, multi-agent processes
  - Workflows include plan rating gates, signoff validation, and error recovery

- **61 Customer User Journeys (CUJs)** documenting complete workflows (2 reserved IDs: CUJ-031, CUJ-032, CUJ-033)
  - Markdown files (`.claude/docs/cujs/CUJ-XXX.md`) documenting end-to-end user scenarios
  - CUJs map to workflows or skills, providing executable documentation
  - Machine-readable registry (`.claude/context/cuj-registry.json`) for programmatic access
  - 54 workflow-based, 5 skill-only, 2 manual setup

- **124 JSON schemas** for artifact validation
  - Schema files (`.claude/schemas/<name>.schema.json`) for validating workflow artifacts
  - Ensures consistency and correctness of generated outputs

- **151 technology rule packs** with dynamic discovery
  - 8 master rules (core protocols) in `.claude/rules-master/`
  - 143 library rules (tech-specific) in `.claude/rules-library/`
  - Dynamic rule index (`.claude/context/rule-index.json`) enables progressive disclosure
  - Only 5-10 relevant rules loaded per task (not all 151)

- **Enforcement system** with plan rating, signoffs, and security triggers
  - Plan rating: All plans must score ≥7/10 via `response-rater` skill
  - Signoff validation: Workflow steps require agent signoffs
  - Security triggers: 12 categories, 136+ keywords automatically route to security agents

- **Error recovery** with checkpoints and fallback routing
  - Checkpoint system saves workflow state after each step
  - Fallback routing handles agent failures gracefully
  - Cross-platform recovery tools (Claude and Cursor compatible)

### Architecture

This is a **configuration-driven system**:

1. **No Runtime Required**: Configuration files are read directly by Claude Code/Cursor/Factory
2. **No Build Step**: Markdown and YAML files work as-is
3. **No Server Process**: All execution happens within the IDE/platform
4. **Optional CLI Tools**: Validation and utility scripts are separate, optional tools
5. **MCP Client Config**: `.mcp.json` configures connections to external MCP servers (launched by IDE)

### How It Works

1. **Copy Configuration**: Copy `.claude/` directory to your project
2. **Platform Reads Config**: Claude Code/Cursor reads agent, skill, and workflow files
3. **Automatic Routing**: User requests are analyzed and routed to appropriate agents
4. **Workflow Execution**: Multi-step workflows coordinate agents, validate outputs, handle errors
5. **Enforcement Gates**: Plan ratings, signoffs, and security checks ensure quality

The system is **declarative** - you define what should happen (agents, workflows, rules), and the platform executes it. No code compilation, no server startup, no library imports.

## What This Is NOT

- **NOT an SDK** - No library to import (dependencies in `package.json` are for optional validation scripts and utilities, not a distributable library)
- **NOT an MCP server** - No server to run (`.claude/.mcp.json` is client configuration for connecting to external MCP servers like `@modelcontextprotocol/server-repo`, `@modelcontextprotocol/server-github`, etc.)
- **NOT primarily a CLI tool** - Core functionality is configuration files that work without any CLI; CLI tools are optional utilities for validation, testing, and management
- **NOT a framework** - Works with existing tools (Claude Code, Cursor IDE, Factory Droid) without requiring framework integration

## Key Features

### Orchestration Enforcement (Phase 1)

- **Plan Rating**: All plans rated by `response-rater` skill (minimum 7/10 score required)
- **Security Triggers**: 12 security categories with 136+ keywords, automatic agent routing
- **Signoff Validation**: Workflow steps require signoffs from specific agents
- **Master Gate Function**: Unified validation combining plans, signoffs, security
- **Error Recovery**: Checkpoint system and fallback routing for failed workflows

### Core Capabilities

- **Master Orchestrator**: Single entry point routing all requests
- **Rule Index System**: Dynamic rule discovery (progressive disclosure)
- **Cross-Platform**: Claude Code, Cursor IDE, Factory Droid support
- **Security Hooks**: Command validation, audit logging, file protection
- **Knowledge Base-Aware Orchestration**: Dynamic agent routing based on agent expertise
- **Agent-as-a-Graph Retrieval**: 14.9% improvement in tool matching accuracy

## Quick Start

### Minimal Setup (No CLI Required)

```bash
# Copy into your project
cp -r .claude/ your-project/
cp -r .cursor/ your-project/   # Optional: Cursor support
cp -r .factory/ your-project/  # Optional: Factory support
cp CLAUDE.md your-project/     # Required: Root instructions file

# That's it! The configuration works immediately.
# In Claude Code, run:
# 1. "Select rules for this project" (auto-detects tech stack)
# 2. "Audit the codebase against our rules"
# 3. Start building!
```

### With CLI Tools (Optional)

If you want to use validation scripts and CLI tools:

```bash
# Copy configuration (same as above)
cp -r .claude/ your-project/
cp -r .cursor/ your-project/
cp -r .factory/ your-project/
cp CLAUDE.md your-project/

# Install dependencies for CLI tools
cd your-project
pnpm install

# Validate configuration
pnpm validate              # Quick validation
pnpm validate:all          # Full validation

# List available CUJs
pnpm cuj:list

# Run a CUJ workflow
pnpm cuj CUJ-002          # Rule configuration
pnpm cuj CUJ-005          # Greenfield project planning
```

**Important**: CLI tools are **completely optional**. The configuration files work without any Node.js installation or dependencies.

## Directory Structure

```
.claude/
├── agents/           # 35 specialized agent definitions (.md files)
├── skills/           # 108 Agent Studio skills (each in own directory with SKILL.md)
│   └── <skill-name>/
│       └── SKILL.md  # Skill documentation and instructions
├── workflows/        # 20 workflow definitions (.yaml files)
├── templates/        # 24 artifact templates (.md files)
├── schemas/          # 124 JSON validation schemas (.schema.json files)
├── rules-master/     # 8 master rules (core protocols)
├── rules-library/    # 143 library rules (tech-specific)
├── context/          # Enforcement matrices, security triggers, CUJ registry
│   ├── cuj-registry.json      # Machine-readable CUJ catalog
│   ├── skill-integration-matrix.json  # Agent-to-skill mappings
│   ├── security-triggers-v2.json     # Security keyword triggers
│   └── rule-index.json        # Dynamic rule discovery index
├── tools/            # 200+ utility tools (.mjs, .js files)
│   ├── run-cuj.mjs           # CUJ execution CLI
│   ├── workflow_runner.js   # Workflow execution engine
│   ├── enforcement-gate.mjs # Validation gates
│   ├── skill-injector.mjs   # Skill injection system
│   └── ...                  # 195+ more tools
├── hooks/            # 6 production hooks (security, audit, enforcement)
│   ├── security-pre-tool.mjs              # Pre-execution security (blocks dangerous commands)
│   ├── file-path-validator.js             # File path validation (prevents SLOP)
│   ├── orchestrator-enforcement-hook.mjs  # Orchestrator delegation rules
│   ├── skill-injection-hook.js            # Automatic skill injection
│   ├── audit-post-tool.mjs                # Post-execution audit logging
│   └── post-session-cleanup.js            # Session cleanup
├── system/           # Guardrails, permissions, system config
├── docs/             # Comprehensive documentation
│   ├── cujs/         # 61 Customer User Journey docs (2 reserved IDs)
│   ├── setup-guides/ # Setup and installation guides
│   └── ...           # Additional documentation
├── .mcp.json         # MCP client configuration (connects to external servers)
├── config.yaml       # Agent routing and workflow configuration
└── CLAUDE.md         # Core instructions (authoritative, referenced by agents)

scripts/              # Utility scripts (validation, generation, migration)
├── validate-config.mjs       # Configuration validation
├── validate-cujs.mjs         # CUJ file validation
├── generate-rule-index.mjs  # Rule index generation
└── ...                      # 20+ more scripts

codex-skills/         # CLI-based multi-AI skills (optional)
├── multi-ai-code-review/    # Multi-AI code review skill
└── response-rater/          # Multi-AI plan rating skill
```

## Agents (35 Specialized Roles)

| Category                | Agents                                                                                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Core Development**    | orchestrator, model-orchestrator, analyst, pm, architect, database-architect, developer, qa, ux-expert                                                                               |
| **Enterprise**          | security-architect, devops, technical-writer                                                                                                                                         |
| **Code Quality**        | code-reviewer, code-simplifier, refactoring-specialist, performance-engineer                                                                                                         |
| **Specialized**         | llm-architect, api-designer, legacy-modernizer, mobile-developer, accessibility-expert, compliance-auditor, incident-responder                                                       |
| **Extended (Phase 1+)** | planner, impact-analyzer, cloud-integrator, react-component-developer, router, gcp-cloud-agent, ai-council, codex-validator, cursor-validator, gemini-validator, master-orchestrator |

See `.claude/agents/` for detailed agent documentation.

## Skills (110 Total: 108 Agent Studio + 2 Codex)

Skills provide 90%+ context savings vs MCP servers. Invoke with natural language or the Skill tool.

| Category        | Skills                                                                                                                             |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Core**        | repo-rag, artifact-publisher, context-bridge, rule-auditor, rule-selector, scaffolder                                              |
| **Memory**      | memory-manager, memory                                                                                                             |
| **Documents**   | excel-generator, powerpoint-generator, pdf-generator                                                                               |
| **Analysis**    | evaluator, classifier, summarizer, text-to-sql                                                                                     |
| **Tools**       | tool-search, mcp-converter, skill-manager                                                                                          |
| **Code Gen**    | claude-md-generator, plan-generator, diagram-generator, test-generator, api-contract-generator, dependency-analyzer, doc-generator |
| **Validation**  | code-style-validator, commit-validator, response-rater                                                                             |
| **Recovery**    | recovery, conflict-resolution, optional-artifact-handler                                                                           |
| **Enforcement** | migrating-rules, explaining-rules, fixing-rule-violations                                                                          |

See `.claude/skills/` for detailed skill documentation.

## Codex Skills Integration

**NEW in Phase 2.1.2**: This project includes integration with OpenAI Codex CLI and multi-AI validation tools.

### What are Codex Skills?

Codex skills are specialized skills that invoke **external AI CLI tools** (Claude Code CLI, Gemini CLI, OpenAI Codex CLI, Cursor Agent CLI, GitHub Copilot CLI) for multi-model validation and consensus. Unlike Agent Studio skills (which are pure configuration), Codex skills require CLI tools to be installed.

**Two Types of Skills**:

- **Agent Studio Skills** (`.claude/skills/`): Native Claude Code skills (108 total) - Pure configuration, no CLI required
- **Codex Skills** (`codex-skills/`): CLI-based multi-AI tools (2 total: `multi-ai-code-review`, `response-rater`) - Require CLI installation

### Codex Skills Directory

The `codex-skills/` directory contains CLI-based skills that invoke external AI tools:

```
codex-skills/
├── multi-ai-code-review/
│   ├── SKILL.md              # Skill documentation
│   └── scripts/
│       └── review.js         # CLI invocation script
└── response-rater/
    ├── SKILL.md              # Skill documentation
    └── scripts/
        └── rate.js           # CLI invocation script
```

These skills are **optional** - the system works without them. They provide multi-model consensus for high-stakes decisions but require:
- Node.js 18+
- CLI tools installed (`claude`, `gemini`, `codex`, etc.)
- API keys or authentication configured

**Note**: Codex skills are invoked via CLI tools, but the skill definitions themselves are still configuration files (SKILL.md). The actual execution happens through external CLI processes.

See `.claude/docs/SKILLS_TAXONOMY.md` for detailed comparison and decision criteria.

### Available Codex Skills

| Skill                    | Purpose              | Providers                              | Use Case                                   |
| ------------------------ | -------------------- | -------------------------------------- | ------------------------------------------ |
| **multi-ai-code-review** | Multi-AI code review | Claude, Gemini, Codex, Cursor, Copilot | High-stakes code changes, production fixes |
| **response-rater**       | Multi-AI plan rating | Claude, Gemini, Codex                  | Critical plans requiring consensus         |

### Key Features (Phase 2.1.2)

1. **Dual-Location Skill Resolution**: Skills found in both `.claude/skills/` and `codex-skills/` directories
2. **CLI Availability Validation**: Preflight checks warn if CLI tools unavailable
3. **Automatic Retry Logic**: Transient failures retried with exponential backoff
4. **Parallel Execution**: Multiple providers called in parallel (66% faster)
5. **Agent Studio Adapter**: Unified interface for invoking Codex skills
6. **Output Validation**: JSON schema validation for all Codex skill outputs
7. **API Key Sanitization**: Error messages automatically redact credentials

### Performance

**Before Optimization** (Sequential):

- 3 providers × 15s each = 45s total

**After Optimization** (Parallel):

- 3 providers in parallel = ~15s total
- **66% reduction** in execution time

### When to Use Codex Skills

**Use Codex Skills (multi-model) for**:

- Security-critical changes (auth, encryption, data protection)
- Production incident fixes
- Legacy modernization plans
- Compliance-related work
- High-stakes architectural decisions

**Use Agent Studio Skills (single-model) for**:

- Routine code reviews
- Standard feature development
- Documentation updates
- Quick iterations
- Cost-sensitive workflows

See `.claude/docs/SKILLS_TAXONOMY.md` for complete decision tree.

### Integration with Workflows

Codex skills integrate seamlessly with the workflow system:

```yaml
# Example workflow step
- step: 1.5
  name: 'Multi-AI Code Review'
  agent: qa
  skill: multi-ai-code-review
  inputs:
    - code_changes (from step 1)
  outputs:
    - multi-ai-review-report.json
  condition: 'user_requested_multi_ai_review OR critical_security_changes'
```

See `.claude/workflows/code-review-flow.yaml` for complete example.

## Workflows

20 workflow definitions for complex multi-agent orchestration:

### Automatic PR Workflow

**NEW in 2026-01**: Orchestrators now automatically trigger PR workflow after completing significant work:

- **Auto-Triggered When:**
  - All todos completed
  - 3+ files modified
  - Major feature/fix implemented
  - Test framework created

- **Workflow Steps:**
  1. Lint & format all code (Prettier/ESLint)
  2. Update CHANGELOG.md
  3. Update README.md (if needed)
  4. Run all tests (ensure 100% pass)
  5. Security review
  6. Create PR with comprehensive description

- **Quality Gates** (BLOCKING):
  - Critical security vulnerabilities → BLOCK
  - Test failures → BLOCK
  - Missing documentation → WARN

- **See:** `.claude/workflows/README-PR-WORKFLOW.md` for full documentation

### Available Workflows

- **PR Creation Flow**: Complete pull request workflow with quality gates (DevOps → Security → QA → Technical Writer)
- **Quick Flow**: Bug fixes, hotfixes, small features (Planner → Developer → QA)
- **Full Stack Flow**: New features, greenfield projects (Planner → Analyst → PM → UX → Architect → Developer → QA)
- **Code Quality Flow**: Code review, refactoring, optimization
- **Performance Flow**: Performance profiling, optimization
- **AI System Flow**: AI/LLM system development
- **Mobile Flow**: Mobile application development
- **Incident Flow**: Crisis management, post-mortems
- **Legacy Modernization Flow**: System modernization, tech debt reduction

See `.claude/workflows/WORKFLOW-GUIDE.md` for detailed documentation.

## Enforcement System

### Plan Rating Enforcement

All plans MUST be rated before execution:

```bash
node .claude/tools/enforcement-gate.mjs validate-plan --run-id <id> --plan-id <id>
```

- Minimum score: **7/10** (via `response-rater` skill)
- If score < 7: Return to Planner with feedback
- If score >= 7: Proceed with execution

### Security Trigger Enforcement

12 security categories with 136+ keywords automatically enforce security requirements:

```bash
node .claude/tools/enforcement-gate.mjs validate-security --task "<description>" --agents <agents>
```

- **Critical priority**: BLOCKS execution if required agents missing
- **High/Medium/Low priority**: WARNING only, execution proceeds

### Signoff Validation

Workflow steps require signoffs from specific agents:

```bash
node .claude/tools/enforcement-gate.mjs validate-signoffs --run-id <id> --workflow <name> --step <n>
```

### Master Gate Function

Combine all validations:

```bash
node .claude/tools/enforcement-gate.mjs validate-all \
  --run-id <id> \
  --workflow <name> \
  --step <n> \
  --plan-id <id> \
  --task "<description>" \
  --agents <agent1,agent2>
```

## Key Tools

The project includes **200+ utility tools** in `.claude/tools/`. Key tools include:

### Core Execution Tools

- **workflow_runner.js**: Workflow execution engine with step validation
- **run-cuj.mjs**: User-facing CLI for executing Customer User Journeys
- **step-executor.mjs**: Individual workflow step execution
- **orchestrator-entry.mjs**: Main orchestrator entry point for request routing

### Enforcement & Validation

- **enforcement-gate.mjs**: Hard validation gates (plan ratings, signoffs, security)
- **plan-rating-gate.mjs**: Plan quality validation (minimum 7/10 score)
- **signoff-validator.mjs**: Agent signoff requirement validation
- **security-enforcement.mjs**: Security trigger integration
- **validate-cuj-e2e.mjs**: End-to-end CUJ validation
- **cuj-doctor.mjs**: Comprehensive CUJ health diagnostics

### State & Recovery

- **run-manager.mjs**: Canonical run state management
- **state-manager.mjs**: Agent and workflow state tracking
- **checkpoint-manager.mjs**: Workflow checkpoint creation and restoration
- **fallback-router.mjs**: Error recovery and workflow fallback
- **error-recovery.mjs**: Error categorization and recovery strategies
- **recovery-cursor.mjs**: Cross-platform recovery (Cursor-compatible)

### Skills & Agents

- **skill-injector.mjs**: Dynamic skill injection into agent contexts
- **skill-trigger-detector.mjs**: Automatic skill trigger detection
- **skill-validator.mjs**: Post-execution skill usage validation
- **agent-router.mjs**: Intelligent agent routing based on task analysis
- **task-classifier.mjs**: Task classification for routing decisions

### Caching & Performance

- **artifact-cache.mjs**: Dual file/workflow artifact caching (1000x speedup)
- **skill-cache.mjs**: Skill content caching with LRU eviction
- **shared-cache-manager.mjs**: Cross-process cache synchronization
- **performance-benchmarker.mjs**: CUJ execution time and resource tracking
- **memory-monitor.mjs**: Memory usage monitoring and leak detection

### Artifacts & Registry

- **artifact-registry.mjs**: Centralized artifact tracking and discovery
- **artifact-validator.mjs**: Artifact schema validation
- **artifact-path-resolver.mjs**: Path resolution with compression support
- **sync-cuj-registry.mjs**: CUJ registry synchronization from documentation

### Monitoring & Analytics

- **metrics-tracker.mjs**: Performance metrics collection
- **cost-tracker.mjs**: Token usage and cost tracking
- **context-monitor.mjs**: Context usage tracking
- **analytics-api.mjs**: Usage analytics and reporting
- **session-manager.mjs**: Agent session lifecycle management

See `.claude/tools/` directory for complete list of 200+ tools.

## Rule Index System

Dynamic rule discovery system enabling Skills to find relevant rules without hard-coding:

1. **Index Generation**: `pnpm index-rules` scans all rules and generates `.claude/context/rule-index.json`
2. **Rule Discovery**: Skills load index and query `technology_map`
3. **Progressive Disclosure**: Only 5-10 relevant rules loaded (not all 1,081)
4. **Self-Healing**: Regenerate index if rule not found

Skills using the index: rule-auditor, rule-selector, scaffolder, explaining-rules, fixing-rule-violations, migrating-rules, recommending-rules

## Slash Commands

| Category        | Commands                                                                                                   |
| --------------- | ---------------------------------------------------------------------------------------------------------- |
| **Core**        | `/review`, `/fix-issue <n>`, `/quick-ship`, `/run-workflow`, `/validate-gates`                             |
| **Skill**       | `/select-rules`, `/audit`, `/scaffold`, `/rate-plan`                                                       |
| **Workflow**    | `/code-quality`, `/performance`, `/ai-system`, `/mobile`, `/incident`, `/legacy-modernize`                 |
| **Enforcement** | `/check-security`, `/enforce-security`, `/approve-security`, `/validate-plan-rating`, `/validate-signoffs` |

## Security

### Security & Enforcement Hooks

6 production hooks provide security validation, audit logging, and orchestrator enforcement:

**PreToolUse Hooks (4 hooks):**

- **security-pre-tool.mjs**: Blocks dangerous commands and sensitive file operations
- **file-path-validator.js**: Validates file paths to prevent SLOP (files in wrong locations)
- **orchestrator-enforcement-hook.mjs**: Enforces orchestrator delegation rules (2-file Read limit, no Write/Edit/Grep/Glob)
- **skill-injection-hook.js**: Automatically injects skills into Task tool calls

**PostToolUse Hooks (2 hooks):**

- **audit-post-tool.mjs**: Logs tool usage with performance metrics
- **post-session-cleanup.js**: Automatic session cleanup for temporary files

**Testing & Validation:**

- Comprehensive testing framework with 44 automated tests (100% pass rate)
- Memory profiling and stress testing (0 memory leaks, p99 <250ms)
- See `.claude/docs/HOOK_TESTING_FRAMEWORK.md` for testing guide
- See `.claude/docs/HOOK_RECOVERY_COMPLETE.md` for troubleshooting

**Hook Documentation:** See `.claude/hooks/README.md` for complete hook documentation

### Protected Operations

- **BLOCKED**: `.env*` files, `secrets/` directory, credential files
- **BLOCKED**: Dangerous commands (`rm -rf`, `sudo rm`, `mkfs`, `dd`)
- **BLOCKED**: Force push to main/master

### Tool Permissions

- **Always Allowed**: Read, Search
- **Require Confirmation**: Edit, Bash
- **Always Blocked**: Destructive operations

## Documentation

- **Setup Guide**: `.claude/docs/setup-guides/CLAUDE_SETUP_GUIDE.md`
- **Workflow Guide**: `.claude/workflows/WORKFLOW-GUIDE.md`
- **Agent-Skill Matrix**: `.claude/docs/AGENT_SKILL_MATRIX.md`
- **Enforcement Examples**: `.claude/docs/ENFORCEMENT_EXAMPLES.md`
- **Security Triggers**: `.claude/docs/SECURITY_TRIGGERS.md`
- **CUJ Index**: `.claude/docs/cujs/CUJ-INDEX.md` (61 user journeys)
- **First-Time User Guide**: `FIRST_TIME_USER.md`

## New Features in Phase 2.1.2

| Feature                               | Purpose                                                 | Documentation                                |
| ------------------------------------- | ------------------------------------------------------- | -------------------------------------------- |
| **Codex Skills Integration**          | Multi-AI validation via CLI tools                       | `.claude/docs/SKILLS_TAXONOMY.md`            |
| **Comprehensive CUJ Fixes**           | 15 integration fixes for Codex skills                   | `.claude/docs/PHASE1_CODEX_FIXES_SUMMARY.md` |
| **Hook Recovery & Testing Framework** | Comprehensive hook testing, bug fixes, auto PR workflow | `.claude/docs/HOOK_RECOVERY_COMPLETE.md`     |

## CLI Tools & Scripts (Optional)

The project includes optional CLI tools and validation scripts for development, testing, and maintenance. These are **not required** for core functionality - the configuration files work without them.

### Prerequisites for CLI Tools

Requires Node.js 18+ and pnpm:

```bash
# Install dependencies
pnpm install
```

### Available CLI Commands

#### Validation & Testing

```bash
# Configuration validation
pnpm validate              # Fast validation (config, models)
pnpm validate:all          # Full validation (includes workflows, CUJs, rule index)
pnpm validate:verbose      # Detailed output
pnpm validate:sync         # Cross-platform agent/skill parity
pnpm validate:cujs         # Validate all CUJ files
pnpm validate:cujs:e2e     # End-to-end CUJ validation
pnpm validate:cujs:dry-run # Dry-run CUJ validation (no mutations)
pnpm validate:workflow     # Validate workflow YAML files
pnpm validate:references   # Validate cross-file references
pnpm validate:index        # Validate rule index
pnpm validate:workflow-gates # Validate workflow rating gates

# CUJ management
pnpm cuj <CUJ-ID>          # Execute a CUJ workflow
pnpm cuj:list              # List all available CUJs
pnpm cuj:simulate <CUJ-ID> # Simulate CUJ execution (dry run)
pnpm cuj:validate <CUJ-ID> # Validate CUJ structure
pnpm cuj:doctor            # Comprehensive CUJ health check
pnpm cuj:doctor:json       # CUJ health check (JSON output)
```

#### Rule Management

```bash
# Rule indexing
pnpm index-rules           # Generate rule index from rules directory
pnpm index-rules:prebuilt  # Generate prebuilt rule index
pnpm sync-cuj-registry     # Sync CUJ registry from documentation
pnpm sync-cuj-registry:validate # Validate CUJ registry sync
```

#### Code Quality

```bash
# Formatting
pnpm format                # Format tracked files
pnpm format:check          # Check formatting without changes

# Testing
pnpm test:codex-integration      # Test Codex skills integration
pnpm test:codex-integration:mock # Test Codex skills (mock mode)
pnpm test:version-validation     # Test version validation
```

#### Installation & Setup

```bash
pnpm install-agents       # Install agent configurations
```

### Direct Tool Execution

You can also run tools directly without npm scripts:

```bash
# CUJ execution
node .claude/tools/run-cuj.mjs CUJ-005
node .claude/tools/run-cuj.mjs --list
node .claude/tools/run-cuj.mjs --simulate CUJ-034

# Validation tools
node scripts/validate-config.mjs
node scripts/validate-cujs.mjs
node .claude/tools/validate-cuj-e2e.mjs

# Enforcement gates
node .claude/tools/enforcement-gate.mjs validate-plan --run-id <id> --plan-id <id>
node .claude/tools/enforcement-gate.mjs validate-security --task "<description>"

# Workflow execution
node .claude/tools/workflow_runner.js --workflow .claude/workflows/greenfield-fullstack.yaml --step 1

# Skill injection
node .claude/tools/skill-injector.mjs --agent developer --task "Create component"

# CUJ registry sync
node .claude/tools/sync-cuj-registry.mjs
```

### Tool Categories

The project includes **200+ utility tools** in `.claude/tools/` organized by function:

- **Orchestration**: `orchestrator-entry.mjs`, `orchestrator-coordinator.mjs`, `agent-router.mjs`
- **Validation**: `validate-cuj-e2e.mjs`, `validate-workflow-rating-gates.mjs`, `cuj-doctor.mjs`
- **Execution**: `workflow_runner.js`, `run-cuj.mjs`, `step-executor.mjs`
- **Enforcement**: `enforcement-gate.mjs`, `plan-rating-gate.mjs`, `signoff-validator.mjs`
- **Recovery**: `error-recovery.mjs`, `recovery-cursor.mjs`, `checkpoint-manager.mjs`
- **Caching**: `artifact-cache.mjs`, `skill-cache.mjs`, `shared-cache-manager.mjs`
- **Monitoring**: `memory-monitor.mjs`, `performance-benchmarker.mjs`, `metrics-tracker.mjs`
- **State Management**: `state-manager.mjs`, `run-manager.mjs`, `session-manager.mjs`
- **Skills**: `skill-injector.mjs`, `skill-trigger-detector.mjs`, `skill-validator.mjs`
- **Artifacts**: `artifact-registry.mjs`, `artifact-validator.mjs`, `artifact-path-resolver.mjs`

See `.claude/tools/` directory for complete list.

### Scripts Directory

Additional utility scripts in `scripts/`:

- **Validation**: `validate-config.mjs`, `validate-cujs.mjs`, `validate-workflow.mjs`, `validate-all-references.mjs`
- **Generation**: `generate-rule-index.mjs`, `generate-prebuilt-rule-index.mjs`
- **Migration**: `migrate-rules.mjs`, `add-context-fork-to-skills.mjs`
- **Formatting**: `format-tracked.mjs`, `fix-encoding.mjs`
- **Installation**: `install.mjs`, `cli-installer.mjs`
- **Testing**: `test-version-validation.mjs`, `cuj-measurability.mjs`

## MCP Configuration

The project includes MCP (Model Context Protocol) **client configuration** in `.claude/.mcp.json`. This configures Claude Code to connect to external MCP servers - it does **not** run an MCP server itself.

### Configured MCP Servers

- **repo**: Repository search and codebase RAG (`@modelcontextprotocol/server-repo`)
- **artifacts**: Artifact publishing and management (`@modelcontextprotocol/server-artifacts`)
- **github**: GitHub integration for issues, PRs, and repository management (`@modelcontextprotocol/server-github`)
- **linear**: Linear integration for issue tracking (`@modelcontextprotocol/server-linear`)
- **slack**: Slack integration for notifications (`@modelcontextprotocol/server-slack`)
- **chrome-devtools**: Chrome DevTools Protocol integration (`chrome-devtools-mcp`)
- **sequential-thinking**: Structured problem solving (`@modelcontextprotocol/server-sequential-thinking`)

These servers are launched by Claude Code when needed - you don't need to run them manually. The configuration is optional and can be customized or removed if not needed.

## Requirements

### Core Requirements (Required)

- **Claude Code**, **Cursor IDE**, or **Factory Droid** - One of these platforms is required for the configuration to work
- **Git 2.30+** - For version control (if using git-based workflows)

### Optional Requirements (For CLI Tools & Validation)

If you want to use the optional CLI tools, validation scripts, or development utilities:

- **Node.js 18+** - Required for running validation scripts and CLI tools
- **pnpm** - Package manager (or npm) for installing dependencies
- **Dependencies** (installed via `pnpm install`):
  - `ajv` - JSON schema validation
  - `js-yaml` - YAML parsing
  - `@anthropic-ai/sdk` - Anthropic SDK (for some tools)
  - `zod` - Schema validation
  - `glob` - File pattern matching
  - `prettier` - Code formatting
  - `stream-chain`, `stream-json` - Streaming JSON parsing

**Note**: The core configuration files (agents, skills, workflows, rules) work **without** Node.js or any dependencies. CLI tools are purely optional utilities for development and maintenance.

## License

MIT - Use freely for personal and commercial projects.
