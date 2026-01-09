# LLM Rules Production Pack

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Platform](https://img.shields.io/badge/Platform-Claude%20Code%20%7C%20Cursor%20%7C%20Factory-purple.svg)]()
[![Agents](https://img.shields.io/badge/Agents-34-green.svg)]()
[![Skills](https://img.shields.io/badge/Skills-107-orange.svg)]()

**Enterprise-grade AI agent orchestration system** for Claude Code, Cursor IDE, and Factory Droid with comprehensive enforcement gates, security validation, and workflow automation.

## What This Is

A production-ready, drop-in configuration bundle providing:

- **34 specialized AI agents** with defined roles (core development, enterprise, code quality, specialized)
- **107 utility skills** for code generation, validation, planning, and recovery
- **14 workflow definitions** with enforcement gates and security validation
- **62 Customer User Journeys (CUJs)** documenting complete workflows
- **93 JSON schemas** for artifact validation
- **1,081+ technology rule packs** with dynamic discovery (8 master + 1,073 library rules)
- **Enforcement system** with plan rating, signoffs, and security triggers
- **Error recovery** with checkpoints and fallback routing

## What This Is NOT

- **NOT an SDK** - No library to import
- **NOT an MCP server** - No server to run
- **NOT a CLI tool** - Just configuration files
- **NOT a framework** - Works with existing tools

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

```bash
# Copy into your project
cp -r .claude/ your-project/
cp -r .cursor/ your-project/   # Optional: Cursor support
cp -r .factory/ your-project/  # Optional: Factory support

# Install dependencies (optional, for validation)
pnpm install

# Configure for your stack
# In Claude Code, run:
# 1. "Select rules for this project" (auto-detects tech stack)
# 2. "Audit the codebase against our rules"
# 3. Start building!
```

## Directory Structure

```
.claude/
├── agents/           # 34 specialized agent definitions
├── skills/           # 107 utility skills
├── workflows/        # 14 workflow definitions
├── templates/        # 30 artifact templates
├── schemas/          # 93 JSON validation schemas
├── rules-master/     # 8 master rules (core protocols)
├── rules-library/    # 1,073+ library rules (tech-specific)
├── context/          # Enforcement matrices, security triggers
├── tools/            # Enforcement gates, run manager, validation
├── hooks/            # Security validation, audit logging
├── system/           # Guardrails, permissions
├── config.yaml       # Agent routing configuration
└── CLAUDE.md         # Core instructions (authoritative)
```

## Agents (34 Specialized Roles)

| Category | Agents |
|----------|--------|
| **Core Development** | orchestrator, model-orchestrator, analyst, pm, architect, database-architect, developer, qa, ux-expert |
| **Enterprise** | security-architect, devops, technical-writer |
| **Code Quality** | code-reviewer, code-simplifier, refactoring-specialist, performance-engineer |
| **Specialized** | llm-architect, api-designer, legacy-modernizer, mobile-developer, accessibility-expert, compliance-auditor, incident-responder |
| **Extended (Phase 1+)** | planner, impact-analyzer, cloud-integrator, react-component-developer, router, gcp-cloud-agent, ai-council, codex-validator, cursor-validator, gemini-validator, master-orchestrator |

See `.claude/agents/` for detailed agent documentation.

## Skills (43 Utilities)

Skills provide 90%+ context savings vs MCP servers. Invoke with natural language or the Skill tool.

| Category | Skills |
|----------|--------|
| **Core** | repo-rag, artifact-publisher, context-bridge, rule-auditor, rule-selector, scaffolder |
| **Memory** | memory-manager, memory |
| **Documents** | excel-generator, powerpoint-generator, pdf-generator |
| **Analysis** | evaluator, classifier, summarizer, text-to-sql |
| **Tools** | tool-search, mcp-converter, skill-manager |
| **Code Gen** | claude-md-generator, plan-generator, diagram-generator, test-generator, api-contract-generator, dependency-analyzer, doc-generator |
| **Validation** | code-style-validator, commit-validator, response-rater |
| **Recovery** | recovery, conflict-resolution, optional-artifact-handler |
| **Enforcement** | migrating-rules, explaining-rules, fixing-rule-violations |

See `.claude/skills/` for detailed skill documentation.

## Codex Skills Integration

**NEW in Phase 2.1.2**: This project includes integration with OpenAI Codex CLI and multi-AI validation tools.

### What are Codex Skills?

Codex skills are specialized skills that invoke external AI CLI tools (Claude Code, Gemini CLI, OpenAI Codex, Cursor Agent, GitHub Copilot) for multi-model validation and consensus.

**Two Types of Skills**:
- **Agent Studio Skills** (`.claude/skills/`): Native Claude Code skills (108 total)
- **Codex Skills** (`codex-skills/`): CLI-based multi-AI tools (2 total: multi-ai-code-review, response-rater)

See `.claude/docs/SKILLS_TAXONOMY.md` for detailed comparison and decision criteria.

### Available Codex Skills

| Skill | Purpose | Providers | Use Case |
|-------|---------|-----------|----------|
| **multi-ai-code-review** | Multi-AI code review | Claude, Gemini, Codex, Cursor, Copilot | High-stakes code changes, production fixes |
| **response-rater** | Multi-AI plan rating | Claude, Gemini, Codex | Critical plans requiring consensus |

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
  name: "Multi-AI Code Review"
  agent: qa
  skill: multi-ai-code-review
  inputs:
    - code_changes (from step 1)
  outputs:
    - multi-ai-review-report.json
  condition: "user_requested_multi_ai_review OR critical_security_changes"
```

See `.claude/workflows/code-review-flow.yaml` for complete example.

## Workflows

14 workflow definitions for complex multi-agent orchestration:

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

- **enforcement-gate.mjs**: Hard validation gates (plan ratings, signoffs, security)
- **run-manager.mjs**: Canonical run state management
- **fallback-router.mjs**: Error recovery and workflow fallback
- **security-enforcement.mjs**: Security trigger integration
- **workflow_runner.js**: Workflow execution with validation

## Rule Index System

Dynamic rule discovery system enabling Skills to find relevant rules without hard-coding:

1. **Index Generation**: `pnpm index-rules` scans all rules and generates `.claude/context/rule-index.json`
2. **Rule Discovery**: Skills load index and query `technology_map`
3. **Progressive Disclosure**: Only 5-10 relevant rules loaded (not all 1,081)
4. **Self-Healing**: Regenerate index if rule not found

Skills using the index: rule-auditor, rule-selector, scaffolder, explaining-rules, fixing-rule-violations, migrating-rules, recommending-rules

## Slash Commands

| Category | Commands |
|----------|----------|
| **Core** | `/review`, `/fix-issue <n>`, `/quick-ship`, `/run-workflow`, `/validate-gates` |
| **Skill** | `/select-rules`, `/audit`, `/scaffold`, `/rate-plan` |
| **Workflow** | `/code-quality`, `/performance`, `/ai-system`, `/mobile`, `/incident`, `/legacy-modernize` |
| **Enforcement** | `/check-security`, `/enforce-security`, `/approve-security`, `/validate-plan-rating`, `/validate-signoffs` |

## Security

### Security Hooks

Native hooks provide security validation and audit logging:

- **security-pre-tool.sh**: Blocks dangerous commands, validates file access
- **audit-post-tool.sh**: Logs all tool executions with timestamps

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
- **CUJ Index**: `.claude/docs/cujs/CUJ-INDEX.md` (56 user journeys)
- **First-Time User Guide**: `FIRST_TIME_USER.md`

## New Features in Phase 2.1.2

| Feature | Purpose | Documentation |
|---------|---------|---------------|
| **Codex Skills Integration** | Multi-AI validation via CLI tools | `.claude/docs/SKILLS_TAXONOMY.md` |
| **Comprehensive CUJ Fixes** | 15 integration fixes for Codex skills | `.claude/docs/PHASE1_CODEX_FIXES_SUMMARY.md` |

## Validation (Optional)

Requires Node.js 18+ and pnpm:

```bash
# Install dependencies
pnpm install

# Validate configuration
pnpm validate              # Fast validation (config, models)
pnpm validate:all          # Full validation (includes workflows, CUJs, rule index)
pnpm validate:verbose      # Detailed output
pnpm validate:sync         # Cross-platform agent/skill parity

# Validate specific workflow step
node .claude/tools/workflow_runner.js --workflow .claude/workflows/greenfield-fullstack.yaml --step 1

# Validate Codex skills integration (optional)
pnpm test:codex-integration  # Run integration tests
```

## Requirements

**Required**:
- Claude Code, Cursor IDE, or Factory Droid

**Optional** (for validation and enforcement):
- Node.js 18+
- pnpm (for dependency management)
- Dependencies: `ajv`, `js-yaml` (installed via `pnpm install`)

## License

MIT - Use freely for personal and commercial projects.
