# Skills Taxonomy

This document clarifies the distinction between the two types of skills in this project and provides guidance on when to use each.

---

## Overview

This project contains **two distinct types of skills**:

1. **Agent Studio Skills** (`.claude/skills/`) - Skills for Claude Code/Agent Studio platform
2. **Codex Skills** (`codex-skills/`) - Skills for OpenAI Codex CLI and multi-AI validation

---

## Agent Studio Skills (`.claude/skills/`)

### Purpose

Skills designed for the **Claude Code** and **Agent Studio** platforms. These are the primary skills used throughout the LLM Rules Production Pack.

### Structure

Each skill follows this directory structure:

```
.claude/skills/<skill-name>/
├── SKILL.md           # Skill definition and documentation
├── scripts/           # Optional: Executable scripts
│   └── *.sh, *.mjs    # Shell scripts or Node.js modules
└── README.md          # Optional: Additional documentation
```

### Skill Frontmatter (2.1.2+)

Each SKILL.md file starts with YAML frontmatter defining metadata:

```yaml
---
name: skill-name
description: Brief description of what the skill does
context:fork: true              # (NEW 2.1.2) Allow forking into subagent contexts
model: sonnet                    # (NEW 2.1.2) Model affinity (haiku/sonnet/opus)
version: 1.0.0
author: Anthropic
tags:
  - category
  - use-case
---
```

**New Fields (2.1.2)**:
- `context:fork` (boolean): If true, skill can be automatically injected into subagent contexts via skill-injection-hook.js. Reduces subagent context by 80% while maintaining functionality.
- `model` (string): Optimal model for this skill (haiku for lightweight tasks, sonnet for general, opus for complex reasoning). Helps router select appropriate agents.

### Count

**108 Agent Studio Skills** covering:
- **Core**: repo-rag, artifact-publisher, context-bridge, rule-auditor, rule-selector, scaffolder
- **Memory**: memory-manager, memory
- **Documents**: excel-generator, powerpoint-generator, pdf-generator
- **Analysis**: evaluator, classifier, summarizer, text-to-sql
- **Tools**: tool-search, mcp-converter, skill-manager
- **Code Gen**: claude-md-generator, plan-generator, diagram-generator, test-generator, api-contract-generator, dependency-analyzer, doc-generator
- **Validation**: code-style-validator, commit-validator, response-rater
- **Recovery**: recovery, conflict-resolution, optional-artifact-handler
- **Enforcement**: migrating-rules, explaining-rules, fixing-rule-violations

### Invocation

**Natural Language**:
```
"Audit this code for rule violations"
"Scaffold a UserProfile component"
"Generate claude.md for src/modules/auth"
```

**Skill Tool** (explicit):
```
Skill: rule-auditor
Path: src/components/UserAuth.tsx
```

### Token Optimization with context:fork

Skills with `context:fork: true` are automatically optimized for subagent contexts:

**Without context:fork** (subagent receives full skill):
- Full skill documentation (~500-2000 tokens)
- All examples and edge cases
- Complete implementation details
- Total context increase: ~500 tokens per skill × 5-10 skills = 2500-5000 tokens

**With context:fork** (subagent receives forked skill):
- Summary only (~50-100 tokens)
- Quick reference guide
- Key usage patterns
- Total context increase: ~100 tokens per skill × 5-10 skills = 500-1000 tokens
- **Savings: 80% reduction in skill context bloat**

This is automatically handled by `skill-injection-hook.js` without orchestrator involvement.

### Examples

| Skill | Purpose | Category | context:fork |
|-------|---------|----------|--------------|
| `repo-rag` | Semantic codebase search | Core | true |
| `scaffolder` | Generate rule-compliant boilerplate | Core | true |
| `rule-auditor` | Validate code against loaded rules | Core | true |
| `response-rater` | Rate plans (min score 7/10) | Validation | true |
| `claude-md-generator` | Generate module documentation | Code Gen | true |
| `test-generator` | Generate test suites from specs | Code Gen | true |
| `recovery` | Handle orchestration failures | Recovery | false |

---

## Codex Skills (`codex-skills/`)

### Purpose

Skills designed for the **OpenAI Codex CLI** and **multi-AI validation workflows**. These skills enable cross-model validation and consensus-based code review.

### Structure

Each skill follows this structure:

```
codex-skills/<skill-name>/
├── README.md          # Skill documentation
├── config.json        # Skill configuration
└── prompts/           # AI-specific prompts
    ├── claude.txt
    ├── openai.txt
    └── gemini.txt
```

### Count

**2 Codex Skills**:
1. `multi-ai-code-review` - Multi-AI consensus code review
2. `response-rater` - Cross-model plan rating

### Invocation

**CLI**:
```bash
# Multi-AI code review
codex run multi-ai-code-review --file src/components/UserAuth.tsx

# Cross-model plan rating
codex run response-rater --plan .claude/context/artifacts/plan-greenfield-001.md
```

**From Workflow**:
```yaml
- step: 7
  agent: ai-council
  skill: multi-ai-code-review
  input: code-artifacts
```

### Examples

| Skill | Purpose | Models Used |
|-------|---------|-------------|
| `multi-ai-code-review` | Consensus-based code review | Claude Opus 4.5, GPT-4, Gemini 1.5 Pro |
| `response-rater` | Cross-model plan rating | Claude Sonnet 4.5, GPT-4, Gemini 1.5 Pro |

---

## How to Choose

### Use Agent Studio Skills (`.claude/skills/`) When:

- ✅ Working within Claude Code or Agent Studio
- ✅ Need fast, lightweight skill invocation
- ✅ Building workflows for single-agent execution
- ✅ Using skills in CUJ (Customer User Journey) flows
- ✅ Leveraging project-specific rules and context
- ✅ Need 90%+ context savings vs MCP servers

**Example Use Cases**:
- Scaffolding new components with `scaffolder`
- Auditing code compliance with `rule-auditor`
- Generating module documentation with `claude-md-generator`
- Searching codebase patterns with `repo-rag`
- Rating plans with `response-rater` (Agent Studio version)

### Use Codex Skills (`codex-skills/`) When:

- ✅ Need multi-AI validation and consensus
- ✅ Running code reviews across multiple models
- ✅ Using OpenAI Codex CLI for automation
- ✅ Comparing responses from different AI models
- ✅ Building CI/CD pipelines with cross-model validation
- ✅ Ensuring plan quality with multi-model rating

**Example Use Cases**:
- Multi-AI code review before production deployment
- Cross-model plan rating for high-stakes projects
- Consensus-based validation for critical security changes
- Comparing AI responses for quality assurance

---

## Integration Points

### Agent Studio Skills → Codex Skills

Some skills exist in **both** locations with different implementations:

| Skill | Agent Studio Version | Codex Version | Difference |
|-------|---------------------|---------------|------------|
| `response-rater` | `.claude/skills/response-rater/` | `codex-skills/response-rater/` | Agent Studio: Single-model; Codex: Multi-model |

**When to use which**:
- **Agent Studio `response-rater`**: Fast iteration, single-model rating (Claude Opus 4.5)
- **Codex `response-rater`**: High-stakes plans requiring consensus (Claude + GPT-4 + Gemini)

### Workflow Integration

**Agent Studio Skills** are referenced in `.claude/workflows/*.yaml`:

```yaml
- step: 0.1
  agent: planner
  skill: response-rater  # Agent Studio version
  min_score: 7
```

**Codex Skills** are invoked via `ai-council` agent for multi-model validation:

```yaml
- step: 7
  agent: ai-council
  skill: multi-ai-code-review  # Codex version
  input: code-artifacts
```

---

## File Locations

### Agent Studio Skills

```
.claude/skills/
├── repo-rag/
│   ├── SKILL.md
│   └── scripts/
├── scaffolder/
│   ├── SKILL.md
│   └── scripts/
├── rule-auditor/
│   ├── SKILL.md
│   └── scripts/
└── ...107 other skills
```

### Codex Skills

```
codex-skills/
├── multi-ai-code-review/
│   ├── README.md
│   ├── config.json
│   └── prompts/
│       ├── claude.txt
│       ├── openai.txt
│       └── gemini.txt
└── response-rater/
    ├── README.md
    ├── config.json
    └── prompts/
```

---

## Migration Path

If you need to **port an Agent Studio skill to Codex**:

1. Create `codex-skills/<skill-name>/` directory
2. Add `README.md` with skill documentation
3. Add `config.json` with skill configuration
4. Create `prompts/` directory with model-specific prompts
5. Test with `codex run <skill-name>`

If you need to **port a Codex skill to Agent Studio**:

1. Create `.claude/skills/<skill-name>/` directory
2. Add `SKILL.md` following the Agent Studio template
3. Add `scripts/` directory with executable logic
4. Test with natural language invocation in Claude Code

---

## Quick Reference

| Question | Answer |
|----------|--------|
| "Where are the skills?" | `.claude/skills/` (Agent Studio) + `codex-skills/` (Codex CLI) |
| "How many skills are there?" | 108 Agent Studio + 2 Codex = 110 total |
| "Which should I use?" | Agent Studio for single-agent, Codex for multi-AI |
| "Can I invoke both?" | Yes - Agent Studio via natural language, Codex via CLI |
| "Do they overlap?" | Yes - `response-rater` exists in both with different implementations |
| "Are they compatible?" | Conceptually yes, but invocation methods differ |

---

## Related Documentation

- **Agent-Skill Matrix**: `.claude/docs/AGENT_SKILL_MATRIX.md` - Comprehensive mapping of 34 agents to 108 skills
- **Codex Skills Integration**: `.claude/docs/CODEX_SKILLS.md` - Canonical locations and synchronization guide
- **Skill Enforcement**: `.claude/context/skill-integration-matrix.json` - Skill usage validation
- **Multi-AI Review**: `codex-skills/multi-ai-code-review/README.md` - Multi-AI code review documentation
- **Response Rater**: `codex-skills/response-rater/README.md` - Cross-model plan rating

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-08 | Initial taxonomy documentation |
