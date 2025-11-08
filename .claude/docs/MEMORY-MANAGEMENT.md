# Memory and Context Management Guide

## Overview

This system implements **hierarchical memory management** following 2025 best practices for AI agent context optimization.

## Memory Hierarchy

```
┌─────────────────────────────────────────────────────┐
│ Layer 1: CLAUDE.md Files (Hierarchical Discovery)  │
├─────────────────────────────────────────────────────┤
│ Layer 2: Session Context (Current Workflow)        │
├─────────────────────────────────────────────────────┤
│ Layer 3: Blackboard (Shared Agent State)           │
├─────────────────────────────────────────────────────┤
│ Layer 4: Artifact Storage (JSON Outputs)           │
├─────────────────────────────────────────────────────┤
│ Layer 5: Reasoning History (Extended Thinking)     │
└─────────────────────────────────────────────────────┘
```

## Best Practices

### 1. Keep CLAUDE.md Minimal

**Why**: Large CLAUDE.md files reduce signal-to-noise ratio and waste tokens.

**Do**:
```markdown
# Core Project Rules

- Use TypeScript strict mode
- Follow Next.js App Router patterns
- Test coverage minimum 80%
```

**Don't**:
```markdown
# Comprehensive Development Encyclopedia

This document contains every possible development guideline...
[10,000 lines of documentation]
```

**Recommendation**: Keep root CLAUDE.md under 500 lines. Use `@import` for specialized context.

### 2. Use Hierarchical Discovery

Claude Code reads CLAUDE.md files recursively:

```
/project-root/CLAUDE.md              # Universal rules
/project-root/backend/CLAUDE.md      # Backend-specific context
/project-root/frontend/CLAUDE.md     # Frontend-specific context
```

**When Claude reads a file in `/project-root/backend/src/api.ts`**:
- Loads: `/project-root/CLAUDE.md` (root)
- Loads: `/project-root/backend/CLAUDE.md` (subdirectory)
- Combines both contexts

### 3. Sliding Window Context Management

Workflows use **sliding window** to maintain fixed context:

```
Session Start:
  Context Window: [CLAUDE.md, User Request]

After Analyst:
  Context Window: [CLAUDE.md, User Request, Analyst Output (summary)]

After PM:
  Context Window: [CLAUDE.md, User Request, Analyst Summary, PM Output]
```

**Old outputs are summarized**, not discarded, to preserve key decisions.

### 4. Blackboard Pattern (Shared State)

Location: `.claude/context/blackboard/`

**Purpose**: Async agent collaboration through shared state.

```
.claude/context/blackboard/
├── current-context.json          # Shared workflow state
├── requirements.json              # From Analyst/PM
├── architecture-decisions.json    # From Architect
├── ux-guidelines.json            # From UX Expert
├── security-controls.json        # From Security Architect
└── quality-metrics.json          # From QA
```

**Usage**:
1. Agent writes to blackboard: `current-context.json`
2. Subsequent agents read from blackboard
3. Orchestrator synthesizes final state

### 5. Intelligent Filtering and Forgetting

**Not all information deserves persistence.**

```yaml
# .claude/context/session.json
memory_policy:
  retain:
    - final_decisions: 90 days
    - architecture_patterns: 180 days
    - quality_gates: 30 days

  discard:
    - intermediate_reasoning: after workflow
    - error_logs: after resolution
    - debug_outputs: after session
```

### 6. Context Compression Techniques

**Summarization**:
```json
{
  "analyst_output_full": "... 5000 tokens ...",
  "analyst_output_summary": "Key findings: Market validated, 3 competitors identified, target SMB users"
}
```

**Token Savings**: 90%+ through selective summarization

## Memory Tools and APIs

### Use `#` for Organic Memory Addition

During sessions:
```
User: # Remember to use 2-space indentation for this project
Claude: [Adds to CLAUDE.md or prompts for location selection]
```

### Use `/memory` to Inspect

```bash
/memory
# Shows all loaded CLAUDE.md files and allows editing
```

### Use `/init` for Project Bootstrap

```bash
/init
# Creates starter CLAUDE.md with project conventions
```

## Context Window Optimization

### Current Limits (2025)
- Claude Sonnet 4: 200K tokens (~150K words)
- Claude Opus 4: 200K tokens with extended thinking
- Effective working memory: 100K tokens (50% reserved for generation)

### Optimization Strategies

**1. Lazy Loading**:
```markdown
# Don't load all tech rules at once
@import .claude/rules/nextjs-rules.md    # Only when needed
```

**2. Agent-Specific Context**:
```yaml
# Each agent gets only what it needs
analyst:
  context: [CLAUDE.md, project_brief_template]
developer:
  context: [CLAUDE.md, code_rules, architecture_doc]
```

**3. Progressive Disclosure**:
```
Initial: High-level requirements
Agent Request: Detailed spec for specific module
Just-in-Time: Load module-specific rules
```

## MCP Memory Integration

### Persistent Knowledge Base

Store frequently accessed patterns in MCP servers:

```bash
curl -X POST http://localhost:8000/api/mcp/execute \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "add_agent_output",
    "arguments": {
      "content": "[Reusable architectural pattern]",
      "tags": ["architecture", "nextjs", "scalability"]
    }
  }'
```

**Benefits**:
- Cross-project knowledge sharing
- Semantic search for similar problems
- Pattern library growth over time

### Context Retrieval

Before starting work, search for relevant context:

```bash
curl -X POST http://localhost:8000/api/mcp/execute \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "search_agent_context",
    "arguments": {
      "query": "nextjs authentication patterns",
      "agent_type": "ARCHITECT",
      "limit": 5
    }
  }'
```

## Workflow-Specific Memory

### Session State

`.claude/context/session.json`:
```json
{
  "workflow_id": "greenfield-001",
  "current_step": 4,
  "agents_completed": ["analyst", "pm", "ux-expert"],
  "context_summary": "Building task management SaaS for SMBs",
  "key_decisions": [
    "Tech stack: Next.js 14, PostgreSQL, Prisma",
    "Auth: NextAuth.js with Google OAuth",
    "Hosting: Vercel + Supabase"
  ]
}
```

### Artifact Storage

`.claude/context/artifacts/`:
- `project-brief.json` - Analyst output
- `prd.json` - PM output
- `system-architecture.json` - Architect output
- `ux-spec.json` - UX Expert output
- `test-plan.json` - QA output

**Retention**: 90 days, then archive to MCP knowledge base

### Reasoning History

`.claude/context/history/reasoning/<workflow>/`:
- `01-analyst.json` - Analyst's decision rationale
- `05-architect.json` - Architect's extended thinking
- `08-qa.json` - QA's quality gate reasoning

**Purpose**: Auditability and learning from past decisions

## Performance Metrics

Track memory efficiency:

```yaml
metrics:
  context_window_utilization: 65%  # Target: <70%
  token_cost_per_workflow: $2.50
  cache_hit_rate: 45%
  memory_retrieval_latency: 120ms
```

## Common Anti-Patterns

❌ **Monolithic CLAUDE.md**:
```markdown
# CLAUDE.md (15,000 lines)
Every possible rule and guideline...
```

✅ **Modular CLAUDE.md**:
```markdown
# CLAUDE.md (300 lines)
Core principles and imports:
@import .claude/rules/_core/code-quality.md
@import .claude/rules/_core/security.md
```

❌ **Repeating Context**:
```
Agent 1: Here's the full requirements (5000 tokens)
Agent 2: Here's the full requirements again (5000 tokens)
```

✅ **Context References**:
```
Agent 1: Requirements in .claude/context/artifacts/prd.json
Agent 2: Referencing PRD from previous step
```

❌ **No Memory Consolidation**:
```
Session grows indefinitely until context limit hit
```

✅ **Periodic Consolidation**:
```
Every 5 agents: Summarize and compress context
Every workflow: Archive to MCP knowledge base
```

## Further Reading

- [Claude Code Memory Docs](https://code.claude.com/docs/en/memory)
- [Context Engineering (2025)](https://www.decodingai.com/p/context-engineering-2025s-1-skill)
- [MemoRAG Paper](https://arxiv.org/abs/2409.05591)
