# LLM-RULES Documentation

Core documentation for deploying and using LLM-RULES. Main reference is `CLAUDE.md` in project root.

## Conductor Features

New Conductor system provides intelligent workflow orchestration:

- **[Conductor Features Overview](CONDUCTOR_FEATURES.md)** - Complete Conductor feature guide
- **[Project Analyzer Guide](PROJECT_ANALYZER_GUIDE.md)** - Automated brownfield analysis
- **[Suggestions Guide](SUGGESTIONS_GUIDE.md)** - Proactive workflow guidance
- **[Smart Revert Guide](SMART_REVERT_GUIDE.md)** - Snapshot-based recovery
- **[Tracks Guide](TRACKS_GUIDE.md)** - Work organization and lifecycle

## Phase 2.1.2 Highlights

Claude Code 2.1.2 introduces three major enhancements:

1. **context:fork Feature** - Skills can now be automatically forked into subagent contexts (80% token savings)
2. **Skill Auto-Injection** - skill-injection-hook.js automatically enhances subagent prompts with required skills
3. **Hook Execution Order** - Predictable hook sequence with <100ms total overhead

**Windows Users**: Managed settings path changed from `C:\ProgramData\ClaudeCode\` to `C:\Program Files\ClaudeCode\`. See GETTING_STARTED.md for migration steps.

**Developers**: Zod 4.0+ now required. Update package.json accordingly.

## Setup Guides

- **[Claude Code Setup](setup-guides/CLAUDE_SETUP_GUIDE.md)** - Configure LLM-RULES in Claude Code
- **[Cursor IDE Setup](setup-guides/CURSOR_SETUP_GUIDE.md)** - Configure LLM-RULES in Cursor IDE

## Core Concepts

| Document                                        | Purpose                                          |
| ----------------------------------------------- | ------------------------------------------------ |
| [Context Optimization](CONTEXT_OPTIMIZATION.md) | Token efficiency and context management          |
| [Memory Patterns](./memory/MEMORY_PATTERNS.md)  | Dual persistence (CLAUDE.md + memory skills)     |
| [Everlasting Agents](EVERLASTING_AGENTS.md)     | Unlimited project duration via context recycling |
| [Phase-Based Projects](PHASE_BASED_PROJECTS.md) | Organizing projects into manageable phases       |
| [Evaluation Guide](EVALUATION_GUIDE.md)         | Agent performance and rule compliance grading    |
| [Rule Index Migration](RULE_INDEX_MIGRATION.md) | Dynamic rule discovery system                    |

## Deployment

- **[Deployment Checklist](deployment/DEPLOYMENT_CHECKLIST.md)** - Production deployment checklist

## Upgrade Guides

| Document                                      | Purpose                                         |
| --------------------------------------------- | ----------------------------------------------- |
| [Phase 2.1.2 Upgrade](PHASE_2.1.2_UPGRADE.md) | Breaking changes, new features, migration steps |

## Test Specifications

- **[CUJs](cujs/)** - Customer User Journey specifications (55 CUJs)
