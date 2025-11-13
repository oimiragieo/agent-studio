# Update-Safe Customizations (_cfg/)

This directory contains **update-safe customizations** that persist through framework upgrades, following the BMAD-METHOD pattern for configuration management.

## Directory Structure

```
.claude/_cfg/
├── README.md                    # This file
├── agents/                      # Custom or overridden agent definitions
│   ├── my-custom-agent.md      # Team-specific custom agents
│   └── architect.md            # Override core architect agent (optional)
├── workflows/                   # Custom workflow definitions
│   └── my-team-workflow.yaml   # Team-specific workflows
├── hooks/                       # Team-specific lifecycle hooks
│   └── pre_commit_check.yaml   # Custom pre-commit validation
├── templates/                   # Custom artifact templates
│   └── custom-prd.md          # Team-specific PRD template
└── settings.local.yaml         # Local configuration (gitignored)
```

## Precedence Rules

**Agent Precedence** (Highest to Lowest):
1. `.claude/_cfg/agents/` - Team/user overrides (highest priority)
2. `.claude/agents/` - Core framework agents (lowest priority)

**Workflow Precedence** (Highest to Lowest):
1. `.claude/_cfg/workflows/` - Custom workflows
2. `.claude/workflows/` - Core workflows

**Configuration Precedence** (Highest to Lowest):
1. `.claude/_cfg/settings.local.yaml` - Local overrides (gitignored)
2. `.claude/settings.json` - Project settings
3. `~/.claude/settings.json` - User global settings

## Use Cases

### 1. Override Agent Personality

Create `.claude/_cfg/agents/architect.md` to customize Winston's personality:

```markdown
---
name: architect
description: Custom architect with different personality
tools: Read, Search, Edit, MCP_search_code
model: opus
temperature: 0.6
---

# Custom Architect

You are Ada, a pragmatic architect focused on startup velocity...
```

### 2. Create Team-Specific Agents

Add custom agents for your team's unique workflows:

```markdown
---
name: data-scientist
description: ML model development and data analysis specialist
tools: Read, Write, Edit, Bash, MCP_search_code
model: opus
---

# Data Scientist Agent

You are Dr. Neural, specializing in ML pipeline development...
```

### 3. Custom Workflows

Create `.claude/_cfg/workflows/ml-pipeline.yaml` for specialized workflows:

```yaml
name: ML Pipeline Development Workflow
description: Machine learning model development workflow
type: custom
project_type: ml

steps:
  - step: 1
    name: "Data Analysis"
    agent: data-scientist
    outputs:
      - data-analysis.json
```

### 4. Team Hooks

Add custom validation in `.claude/_cfg/hooks/security-scan.yaml`:

```yaml
name: security-scan
trigger: PreToolUse
priority: high
conditions:
  - applies_to_tools: ['Edit', 'Write']
steps:
  - action: run_security_scan
    options:
      tools: ['npm audit', 'snyk test']
```

## Git Strategy

### What to Commit

**DO commit** to version control:
- `.claude/_cfg/agents/` - Team-shared custom agents
- `.claude/_cfg/workflows/` - Team workflows
- `.claude/_cfg/templates/` - Team templates
- `.claude/_cfg/hooks/` - Team lifecycle hooks
- `.claude/_cfg/README.md` - This documentation

**DO NOT commit** (add to `.gitignore`):
- `.claude/_cfg/settings.local.yaml` - Personal local settings
- `.claude/_cfg/agents/*-local.md` - Personal agent overrides
- `.claude/_cfg/.env` - Local environment variables

## Migration from Core

If you want to customize a core agent:

1. Copy from `.claude/agents/architect.md` to `.claude/_cfg/agents/architect.md`
2. Edit `.claude/_cfg/agents/architect.md` with your changes
3. Your version will take precedence

## Best Practices

1. **Minimal Overrides**: Only override what you need to change
2. **Document Changes**: Add comments explaining why you're overriding
3. **Test Thoroughly**: Test custom agents before committing
4. **Version Control**: Commit team customizations, not personal ones
5. **Sync Regularly**: Pull updates to stay current with core framework
6. **Namespace Custom**: Prefix custom agents with team name (e.g., `acme-specialist.md`)

## Updating the Framework

When upgrading the core framework:

1. Pull latest changes to `.claude/agents/`, `.claude/workflows/`, etc.
2. Your `.claude/_cfg/` customizations are preserved
3. Review changelog for breaking changes
4. Test workflows to ensure compatibility
5. Update overrides if core agent interfaces changed

## Examples

### Example: Custom Security Architect

`.claude/_cfg/agents/security-architect.md`:

```markdown
---
name: security-architect
description: Security architecture, threat modeling, and compliance validation
tools: Read, Search, Grep, Edit, MCP_security_scan
model: opus
temperature: 0.4
---

# Security Architect

You are Nova, a security-first architect specializing in zero-trust design...
```

### Example: Quick PR Workflow

`.claude/_cfg/workflows/quick-pr.yaml`:

```yaml
name: Quick PR Review Workflow
type: review
steps:
  - step: 1
    agent: qa
    outputs: [quality-report.json]
  - step: 2
    agent: security-architect
    outputs: [security-assessment.json]
```

## Troubleshooting

**Agent not being invoked?**
- Check agent `name` matches exactly (lowercase, hyphens only)
- Verify YAML frontmatter is valid
- Ensure file is in `.claude/_cfg/agents/` directory

**Workflow not found?**
- Confirm workflow file exists in `.claude/_cfg/workflows/`
- Check workflow `name` field matches invocation
- Validate YAML syntax

**Override not working?**
- Verify precedence: `_cfg/` should override core
- Check file naming (must match core agent name exactly)
- Ensure no syntax errors in frontmatter

## Resources

- Core Agent Directory: `.claude/agents/`
- Core Workflows: `.claude/workflows/`
- Config Reference: `.claude/config.yaml`
- Documentation: `.claude/README.md`
