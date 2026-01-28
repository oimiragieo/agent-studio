# LLM-RULES (Agent Studio)

This repository is a **drop-in Claude Code agent ecosystem**: agents, hooks, workflows, schemas, prompts, and headless test harnesses.

The goal is simple: copy `.claude/` into another repo and get consistent routing, guardrails, and auditable diagnostics.

## What You Get

- **46 Specialized Agents**: Core, domain, specialized, and orchestrator agents (`.claude/agents/`)
- **427+ Reusable Skills**: Development, security, DevOps, scientific research, and more (`.claude/skills/`)
- **Agent-Skill Discovery System**: Central mapping of agents to skills with contextual loading (`.claude/context/config/agent-skill-matrix.json`)
- **Consolidated Hooks/Guards**: Unified routing and evolution guards with 75-80% latency reduction (`.claude/hooks/`)
- **Workflows + Runners**: 16+ enterprise workflows including security audit, consensus voting, swarm coordination (`.claude/workflows/`, `.claude/tools/`)
- **Schemas**: Structured artifact validation (`.claude/schemas/`)
- **Prompts**: Copy/paste prompts for UI (`.claude/prompts/`)
- **Headless Verification**: CI-friendly testing (`pnpm ship-readiness:headless:json`, `pnpm integration:headless:json`)
- **Memory System**: Persistent learnings, decisions, and issues across sessions (`.claude/context/memory/`)
- **Spec-Kit Integration**: Complete feature set for requirements management with templates, skills, and automated quality validation

Notes:

- `.tmp/` contains experimental/vendor comparisons and is **not shipped** (gitignored).
- `.opencode*` / `.factory*` are **not part of the release** (gitignored/removed from tracked files).

## Quick Start (Copy Into Another Repo)

1. Copy `.claude/` into your target project.
2. (Optional) Copy `.cursor/` if you also support Cursor IDE.
3. Open the project in Claude Code and run a normal request; routing + hooks + workflows apply automatically.

**What happens automatically:**

- Router analyzes your request and spawns appropriate specialized agents
- Agents discover and invoke relevant skills based on project type
- Contextual skills load automatically (e.g., Python skills when `.py` files detected)
- Enforcement hooks ensure quality gates and routing protocols

If you also want the repo’s CLI validation utilities (recommended), install deps:

```bash
pnpm install
```

## Production Validation (Headless, Auditable)

These are the recommended “ship it” checks. They write reports/results under `.claude/context/` (which is gitignored).

```bash
# Runs baseline suites + denial + observability bundle, writes report/results JSON.
pnpm ship-readiness:headless:json

# Exercises the agent framework headlessly (core agents) and writes report/results JSON.
pnpm integration:headless:json
```

Important:

- Treat the `workflow_id` printed by each headless command as the source of truth for follow-on verification.
- Use the corresponding verify tool with that exact id:

```bash
node .claude/tools/verify-ship-readiness.mjs --workflow-id <workflow_id> --json
node .claude/tools/verify-agent-integration.mjs --workflow-id <workflow_id> --expected-agents core --json
```

## Prompts (Claude Code UI)

Use these when you want a user-like UI run (not CI):

- `.claude/prompts/ship-readiness.md`
- `.claude/prompts/ship-readiness-validation-headless.md` (headless-first prompt)
- `.claude/prompts/agent-framework-integration.md`

For stability, prefer the **headless harnesses** above. UI multi-agent orchestration can hit platform memory limits depending on model/context.

## Documentation

**Key Guides:**

- **Getting Started**: `.claude/docs/GETTING_STARTED.md`
- **Agents System**: `.claude/docs/AGENTS.md` (45 agents, roles, and usage)
- **Agent-Skill Discovery**: `.claude/docs/AGENT-SKILL-DISCOVERY.md` (how agents find and use skills)
- **Skills System**: `.claude/docs/SKILLS.md` (426+ skills organized by category)
- **Router Protocol**: `.claude/docs/ROUTER_PROTOCOL.md` (routing and enforcement)
- **Memory System**: `.claude/docs/MEMORY_SYSTEM.md` (persistence across sessions)
- **Self-Evolution**: `.claude/docs/SELF_EVOLUTION.md` (creating agents and skills)

**Quick References:**

- **Agent-Skill Matrix**: `.claude/context/config/agent-skill-matrix.json` (central mapping)
- **Skill Catalog**: `.claude/context/artifacts/skill-catalog.md` (complete skill list)
- **Router Keywords**: `.claude/docs/ROUTER_KEYWORD_GUIDE.md` (intent routing)

## Observability / Debugging

Headless runs write artifacts under:

- `.claude/context/reports/` (human-readable)
- `.claude/context/artifacts/` (structured JSON/logs)
- `.claude/context/runtime/` (run state; ephemeral)

If you launch Claude Code in debug mode (`claude -d`), you’ll also get a platform debug log path. Many tools support passing it through where applicable.

Optional env flags (for deeper local debugging):

```powershell
$env:CLAUDE_OBS_STORE_PAYLOADS='1'
$env:CLAUDE_OBS_FAILURE_BUNDLES='1'
```

## Repo Hygiene (Do Not Commit Run Artifacts)

This repo intentionally ignores `.claude/context/**` runtime output. You can sanity-check:

```bash
git ls-files -- .claude/context/artifacts/testing .claude/context/reports
```

Expected output: empty.

## Contributing / Development

Useful commands:

```bash
pnpm format
pnpm test
pnpm validate
pnpm validate:docs-links
node .claude/tools/workflow-dryrun-suite.mjs
```

See also: `GETTING_STARTED.md` and `CHANGELOG.md`.

## Recent Updates (v2.3.0 - Spec-Kit Integration)

- **Specification Management**: IEEE 830-compliant template with token replacement and validation
- **Implementation Planning**: Phase 0 research-first workflow with 4-gate constitution checkpoint
- **Task Organization**: Epic → Story → Task hierarchy with Enabler-first pattern (SAFe)
- **Quality Validation**: Automated checklists combining IEEE 1028 + contextual items
- **Performance**: 88% faster specification creation, 90% faster task organization, 100% consistency
- **Security**: Comprehensive review with 5 findings addressed, token whitelist enforcement, path validation

### Previous Updates (v2.1.0)

- **Security Hardening**: SEC-007 safe JSON parsing, SEC-008 fail-closed patterns
- **Performance**: Unified `routing-guard.cjs` (80% spawn reduction), `unified-evolution-guard.cjs` (75% spawn reduction)
- **Code Quality**: Shared `hook-input.cjs` utility eliminates 2000+ lines of duplication
- **Documentation**: CLAUDE.md synchronized with codebase (zero drift)
