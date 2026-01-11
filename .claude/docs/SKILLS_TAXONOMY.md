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

### Model Affinity (2.1.2+)

Skills can specify their preferred model for optimal performance and cost:

```yaml
---
name: rule-auditor
model: haiku  # Fast, cheap validation
---
```

**Model Selection Guidelines**:
- **haiku**: Simple validation, fast execution, low cost (3 skills)
- **sonnet**: Balanced implementation, moderate complexity (7 skills)
- **opus**: Critical thinking, complex planning, high quality (2 skills)

**12 skills currently have model affinity assigned:**
- **Haiku** (3): rule-auditor, code-style-validator, commit-validator
- **Sonnet** (7): scaffolder, test-generator, doc-generator, api-contract-generator, dependency-analyzer, diagram-generator, pdf-generator
- **Opus** (2): plan-generator, response-rater

**Benefits**:
- Faster execution for lightweight validation tasks (haiku)
- Better quality and reasoning for complex generation (opus)
- Optimized cost per skill type
- Router can select appropriate model based on skill needs

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

## When to Use Codex vs Agent Studio Skills

### Decision Tree

```
Need multi-model consensus?
├─ YES → Use Codex version (multi-ai-code-review, response-rater)
└─ NO
   ├─ Need fast iteration? → Use Agent Studio version
   ├─ High-stakes plan? → Use Codex multi-model
   ├─ Routine code review? → Use Agent Studio single-model
   └─ Want to use other CLI tools? → Use Codex version
```

### Comparison Matrix

| Criterion | Agent Studio Skills | Codex Skills |
|-----------|---------------------|--------------|
| **Speed** | Faster (single API call) | Slower (multiple CLI calls) |
| **Consensus** | Single model | Multi-model validation |
| **Cost** | Lower (1 API call) | Higher (2-5 API calls) |
| **Setup** | No setup required | Requires CLI installation |
| **Integration** | Native in Claude Code | Via OpenAI Codex CLI |
| **Use Case** | Routine work, fast iteration | High-stakes, critical decisions |

### Examples

#### Example 1: Plan Rating for Standard Feature

**Scenario**: You're planning a standard feature addition (CRUD operations for user profiles)

**Decision**: Use Agent Studio `response-rater`
- **Why**: Standard work doesn't need multi-model consensus
- **Benefit**: Faster feedback (5-10s vs 30-45s)
- **Cost**: Single Claude API call (~$0.01 cost)

**Command**:
```
Invoke skill: response-rater
Plan: .claude/context/artifacts/plan-crud-feature.md
```

#### Example 2: Plan Rating for Security Audit

**Scenario**: You're planning a comprehensive security audit involving authentication redesign

**Decision**: Use Codex `response-rater` with multi-model consensus
- **Why**: Security-critical work benefits from multiple AI perspectives
- **Benefit**: Catch edge cases that one model might miss; higher confidence
- **Cost**: Multiple model calls (~$0.10-$0.25 per rating)

**Command**:
```bash
codex run response-rater --plan .claude/context/artifacts/plan-security-audit.md --models claude,gpt-4,gemini
```

#### Example 3: Code Review for Refactoring

**Scenario**: You're reviewing a refactoring PR that reorganizes module structure (no logic changes)

**Decision**: Use Agent Studio `code-review` skill or `rule-auditor`
- **Why**: Routine refactoring review, fast turnaround needed
- **Benefit**: Quick feedback loop for iterative changes (10-20s)
- **Cost**: Minimal (single API call)

**Command**:
```
Skill: code-review
Path: src/modules/auth/refactor-branch
```

#### Example 4: Code Review for Production Hotfix

**Scenario**: You're reviewing an emergency hotfix for a critical production incident (database connection pooling)

**Decision**: Use Codex `multi-ai-code-review` for multi-model validation
- **Why**: Production fixes need multiple validators to catch subtle bugs
- **Benefit**: Multiple models review from different angles; reduces risk
- **Cost**: Higher (~$0.15-$0.25 per review) but justified for production

**Command**:
```bash
codex run multi-ai-code-review --file src/lib/db-pool.ts --models claude,gpt-4,gemini
```

#### Example 5: Test Coverage Generation

**Scenario**: You're generating test coverage for a new authentication module

**Decision**: Use Agent Studio `test-generator` skill
- **Why**: Test generation is deterministic; doesn't need consensus
- **Benefit**: Fast execution (10-15s); project-aware context
- **Cost**: Single API call

**Command**:
```
Skill: test-generator
Path: src/modules/auth
Framework: vitest
```

### Cost Considerations

**Agent Studio Skills**:
- 1 API call per invocation
- Cost: ~$0.01 - $0.05 per invocation (Claude API)
- Model: Claude Sonnet or Opus depending on skill

**Codex Skills (multi-model)**:
- 2-5 API calls per invocation (depending on providers configured)
- Cost: ~$0.02 - $0.25 per invocation (multi-provider pricing)
- Models: Claude Opus, GPT-4, Gemini 1.5 Pro (configurable)

**Cost Matrix**:

| Task Type | Agent Studio Cost | Codex Cost | Cost Ratio | Recommended |
|-----------|------------------|-----------|-----------|------------|
| Standard feature plan | $0.01-0.03 | $0.10-0.25 | 10x higher | Agent Studio |
| Security audit plan | $0.01-0.03 | $0.10-0.25 | 10x higher | Codex |
| Routine refactoring review | $0.02-0.05 | $0.15-0.30 | 6x higher | Agent Studio |
| Production hotfix review | $0.02-0.05 | $0.15-0.30 | 6x higher | Codex |
| Test generation | $0.02-0.05 | N/A | N/A | Agent Studio |

**Recommendation**: Use Codex skills for ~10-20% of work (high-stakes only). The consensus value justifies the cost for critical decisions.

### Performance Benchmarks

Based on Phase 2.1.2 optimization (parallel execution when available):

| Operation | Agent Studio | Codex (Sequential) | Codex (Parallel) | Speed Ratio |
|-----------|--------------|--------------------| ------------------|------------|
| Plan Rating | 5-10s | 30-45s | 10-15s | 1.5-3x slower |
| Code Review | 10-20s | 60-90s | 20-30s | 2-3x slower |
| Test Generation | 10-15s | N/A | N/A | N/A |

**Key Insights**:
- **Sequential execution**: Codex skills are 3-4x slower (calling APIs serially)
- **Parallel execution** (when available): Codex overhead reduced to ~1.5-2x
- **Total time includes**: API calls + response aggregation + consensus analysis
- **Tradeoff**: Speed vs. quality - accept slower execution for critical decisions

### When Cost/Speed Doesn't Matter

**Use Codex even if expensive/slow when**:
- Making high-stakes architectural decisions
- Reviewing security-critical code
- Planning major infrastructure changes
- Multi-team consensus required
- Production incident response
- Regulatory or compliance work

**The consensus value exceeds the cost premium** in these scenarios.

### Adapter Pattern (Phase 3)

As of Phase 3, you can invoke Codex skills through a unified Agent Studio adapter:

```javascript
// Invoke Codex skill via Agent Studio adapter
const review = await invoke({
  skill: "multi-ai-code-review",  // Adapter delegates to codex-skills/
  params: {
    providers: ["claude", "gemini"],  // Can mix providers
    range: "origin/main...HEAD"       // Git range for review
  }
});
```

**Benefits**:
- Single interface for both skill types
- Automatic provider delegation
- Consistent error handling
- Easier testing and mocking

**Limitations**:
- Requires adapter to be installed
- Some CLI-only Codex features not available
- Async/await pattern vs CLI shell commands

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
| 1.1.0 | 2026-01-09 | Add "When to Use Codex vs Agent Studio Skills" section with decision tree, comparison matrix, examples, cost analysis, and performance benchmarks |
| 1.0.0 | 2026-01-08 | Initial taxonomy documentation |
