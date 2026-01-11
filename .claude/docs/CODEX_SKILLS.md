# Codex Skills Integration

## Overview

This document clarifies the canonical locations for Codex skills and their integration with both Claude Code (Agent Studio) and OpenAI Codex CLI platforms.

## Canonical Locations

### Claude Code / Agent Studio

**Location**: `.claude/skills/<skill-name>/`

Skills in this location are automatically discovered and loaded by Claude Code's skill system. These skills follow the Agent Studio skill format with `SKILL.md` as the entry point.

### OpenAI Codex CLI

**Location**: `codex-skills/<skill-name>/`

Skills in this location are used by the OpenAI Codex CLI for multi-AI validation and code review workflows. These skills follow the Codex skill format.

## Skills Available

| Skill                    | Claude Code | Codex CLI | Purpose                                  | Documentation                                         |
| ------------------------ | ----------- | --------- | ---------------------------------------- | ----------------------------------------------------- |
| **multi-ai-code-review** | ✅          | ✅        | Multi-provider code review orchestration | [SKILL.md](./../skills/multi-ai-code-review/SKILL.md) |
| **response-rater**       | ✅          | ✅        | Response quality rating (0-10 scale)     | [SKILL.md](./../skills/response-rater/SKILL.md)       |

## Skill Synchronization

### From Claude Code to Codex CLI

When a skill is developed or updated in `.claude/skills/`, synchronize it to `codex-skills/` for Codex CLI usage:

```bash
# Copy entire skill directory
cp -r .claude/skills/multi-ai-code-review codex-skills/

# Or create symlink (Linux/Mac)
ln -s ../.claude/skills/multi-ai-code-review codex-skills/multi-ai-code-review

# Or create junction (Windows)
mklink /J codex-skills\multi-ai-code-review .claude\skills\multi-ai-code-review
```

### From Codex CLI to Claude Code

When a skill is developed in `codex-skills/`, synchronize it to `.claude/skills/` for Claude Code usage:

```bash
# Copy entire skill directory
cp -r codex-skills/multi-ai-code-review .claude/skills/

# Verify skill structure
ls -la .claude/skills/multi-ai-code-review/
```

## Usage Patterns

### Claude Code (Agent Studio)

**Automatic Discovery**: Skills are automatically discovered from `.claude/skills/` when Claude Code starts.

**Invocation**:

```
# Natural language
"Use multi-ai-code-review to review this code"

# Skill tool
Skill: multi-ai-code-review
Input: src/components/Button.tsx
```

**Context Loading**: Skills are lazy-loaded to minimize context usage (90%+ savings vs MCP servers).

### Codex CLI

**Manual Invocation**: Skills must be explicitly invoked via Codex CLI commands.

**Example**:

```bash
# Multi-AI code review
codex run-skill multi-ai-code-review --input src/components/Button.tsx

# Response rating
codex run-skill response-rater --input plan-001.json --rubric completeness,feasibility
```

**Integration with Workflows**: Codex skills can be integrated into CI/CD pipelines for automated validation.

## Skill Format Differences

### Claude Code Format (`.claude/skills/`)

```
.claude/skills/multi-ai-code-review/
├── SKILL.md                 # Entry point (skill documentation)
├── scripts/
│   ├── orchestrator.mjs     # Main orchestration logic
│   ├── claude-reviewer.mjs  # Claude-specific reviewer
│   └── gemini-reviewer.mjs  # Gemini-specific reviewer
└── config.json              # Skill configuration
```

**Key Characteristics**:

- `SKILL.md` is the primary entry point
- Scripts use `.mjs` extension (ES modules)
- Configuration in `config.json`
- Follows Agent Studio conventions

### Codex CLI Format (`codex-skills/`)

```
codex-skills/multi-ai-code-review/
├── SKILL.md                 # Skill documentation
├── scripts/
│   ├── orchestrator.mjs     # Main orchestration logic
│   ├── claude-reviewer.mjs  # Claude-specific reviewer
│   └── gemini-reviewer.mjs  # Gemini-specific reviewer
└── manifest.json            # Codex manifest
```

**Key Characteristics**:

- `SKILL.md` documents the skill
- Scripts use `.mjs` or `.js` extension
- Configuration in `manifest.json`
- Follows Codex CLI conventions

## Development Workflow

### Creating a New Codex Skill

1. **Develop in Claude Code**: Create skill in `.claude/skills/<skill-name>/`
2. **Test with Claude Code**: Verify skill works correctly in Agent Studio
3. **Synchronize to Codex**: Copy to `codex-skills/<skill-name>/`
4. **Adapt for Codex**: Adjust manifest and configuration for Codex CLI
5. **Test with Codex CLI**: Verify skill works correctly with Codex

### Updating an Existing Codex Skill

1. **Update primary location**: Modify `.claude/skills/<skill-name>/`
2. **Test changes**: Verify in Claude Code
3. **Synchronize**: Copy changes to `codex-skills/<skill-name>/`
4. **Test synchronization**: Verify in Codex CLI

## Best Practices

### Skill Location Strategy

- **Prefer `.claude/skills/` as primary location**: Develop and maintain skills in Claude Code location
- **Synchronize to `codex-skills/` for Codex CLI usage**: Copy or symlink to Codex location
- **Use version control to track both locations**: Commit both locations to git

### Naming Conventions

- **Use kebab-case**: `multi-ai-code-review`, not `multiAiCodeReview`
- **Be descriptive**: Skill name should clearly indicate purpose
- **Avoid abbreviations**: `response-rater` not `resp-rate`

### Documentation Requirements

- **SKILL.md must be comprehensive**: Include usage, inputs, outputs, examples
- **Document platform-specific differences**: Note any differences between Claude Code and Codex CLI usage
- **Provide clear examples**: Include real-world usage examples

## Integration with Agent-Skill Matrix

Codex skills are integrated into the Agent-Skill Matrix (`.claude/context/skill-integration-matrix.json`) for orchestration:

```json
{
  "agents": {
    "orchestrator": {
      "required_skills": ["response-rater"],
      "recommended_skills": ["multi-ai-code-review"],
      "triggers": ["plan rating", "multi-AI validation"]
    }
  }
}
```

See [AGENT_SKILL_MATRIX.md](./AGENT_SKILL_MATRIX.md) for complete mapping.

## Troubleshooting

### Skill Not Found in Claude Code

**Problem**: Claude Code cannot find skill in `.claude/skills/`

**Solution**:

1. Verify skill exists: `ls -la .claude/skills/<skill-name>/`
2. Check SKILL.md exists: `cat .claude/skills/<skill-name>/SKILL.md`
3. Verify skill is in rule index: `grep <skill-name> .claude/context/rule-index.json`
4. Regenerate index: `pnpm index-rules`

### Skill Not Found in Codex CLI

**Problem**: Codex CLI cannot find skill in `codex-skills/`

**Solution**:

1. Verify skill exists: `ls -la codex-skills/<skill-name>/`
2. Check manifest.json exists: `cat codex-skills/<skill-name>/manifest.json`
3. Verify Codex CLI path: `codex config get skills-path`
4. Update Codex CLI: `codex update`

### Skill Synchronization Issues

**Problem**: Skill in `.claude/skills/` differs from `codex-skills/`

**Solution**:

1. Compare directories: `diff -r .claude/skills/<skill-name>/ codex-skills/<skill-name>/`
2. Synchronize from primary: `cp -r .claude/skills/<skill-name> codex-skills/`
3. Verify synchronization: `diff -r .claude/skills/<skill-name>/ codex-skills/<skill-name>/`

## Related Documentation

- [Skills Taxonomy](./SKILLS_TAXONOMY.md) - Complete taxonomy of all 108 skills
- [Agent-Skill Matrix](./AGENT_SKILL_MATRIX.md) - Mapping of agents to skills
- [Rule Index Migration](./RULE_INDEX_MIGRATION.md) - Rule index system documentation
- [Multi-AI Code Review Skill](./../skills/multi-ai-code-review/SKILL.md) - Detailed skill documentation
- [Response Rater Skill](./../skills/response-rater/SKILL.md) - Detailed skill documentation

## Version History

| Version | Date       | Changes                                                   |
| ------- | ---------- | --------------------------------------------------------- |
| 1.0.0   | 2026-01-08 | Initial documentation of Codex skills canonical locations |
