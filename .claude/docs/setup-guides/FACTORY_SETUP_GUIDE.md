# Factory Droid Setup Guide

Complete setup instructions for Factory Droid configuration in your project.

## Overview

This guide walks you through setting up Factory Droid with custom droids, hooks, instructions, and skills for enterprise-grade AI-assisted development.

## Prerequisites

- Factory Droid CLI installed and configured
- Project repository cloned locally
- Basic familiarity with Factory Droid commands

## Step 1: Copy Configuration

### Option A: Fresh Setup

Copy the entire `.factory/` folder to your project root:

**Windows (PowerShell):**
```powershell
Copy-Item -Path "production-dropin\.factory" -Destination "." -Recurse
```

**Mac/Linux:**
```bash
cp -r production-dropin/.factory .
```

### Option B: Merge with Existing

If you already have a `.factory/` directory:

1. Copy droids: `cp production-dropin/.factory/droids/* .factory/droids/`
2. Copy hooks: `cp production-dropin/.factory/hooks/* .factory/hooks/`
3. Copy instructions: `cp -r production-dropin/.factory/instructions .factory/`
4. Copy skills: `cp -r production-dropin/.factory/skills .factory/`
5. Merge AGENTS.md if exists, or copy: `cp production-dropin/.factory/AGENTS.md .factory/`

## Step 2: Enable Custom Droids

1. Start Factory Droid:
   ```bash
   droid
   ```

2. Open settings:
   ```
   /settings
   ```

3. Enable Custom Droids:
   - Navigate to Experimental section
   - Set `enableCustomDroids: true`
   - Save and exit

4. Restart droid:
   - Exit with `Ctrl+C`
   - Run `droid` again

## Step 3: Verify Setup

### Check Available Droids

1. Start droid: `droid`
2. Use Task tool with subagent:
   ```
   Run the Task tool with subagent analyst to verify setup.
   ```

### Verify Custom Droids List

You should see 22 specialized agents matching `.claude/agents/`:
- analyst, pm, architect, developer, qa, ux-expert
- devops, security-architect, technical-writer, orchestrator, model-orchestrator
- database-architect, llm-architect, code-reviewer, performance-engineer
- api-designer, legacy-modernizer, accessibility-expert, compliance-auditor
- refactoring-specialist, mobile-developer, incident-responder

### Test Hooks

1. Make a code change
2. Hooks should execute:
   - Pre-run: Lint and test validation
   - Post-run: Coverage report and artifact publishing

## Step 4: Configure Integrations (Optional)

### GitHub Integration

1. Open Factory dashboard
2. Navigate to Integrations → GitHub
3. Connect repository
4. Configure webhook if needed

### Linear Integration

1. Open Factory dashboard
2. Navigate to Integrations → Linear
3. Connect workspace
4. Configure project mappings

### Slack Integration

1. Open Factory dashboard
2. Navigate to Integrations → Slack
3. Add webhook URL
4. Configure notification channels

## Step 5: Review AGENTS.md

The root `AGENTS.md` file documents project conventions:

- Build and test commands
- Architecture overview
- Security guidelines
- Git workflows
- Code conventions

**Important**: Update `AGENTS.md` with your project-specific:
- Build commands (if different from `pnpm`)
- Test frameworks and patterns
- Security requirements
- Git branching strategy

## Directory Structure

After setup, your `.factory/` directory should contain:

```
.factory/
├── droids/              # 22 custom droid definitions
│   ├── analyst.md
│   ├── pm.md
│   ├── architect.md
│   ├── developer.md
│   ├── qa.md
│   ├── ux-expert.md
│   └── ... (22 total, matching .claude/agents/)
├── hooks/               # Pre/post run hooks
│   ├── pre-run.yaml
│   └── post-run.yaml
├── instructions/        # Usage guides
│   ├── cli.md
│   ├── specification-mode.md
│   ├── auto-run.md
│   ├── context-layers.md
│   └── integrations.md
├── skills/              # Context router and incident response
│   ├── context-router.md
│   └── incident-response.md
├── AGENTS.md            # Factory-specific instructions
└── README.md            # Overview and quick start
```

## Key Features

### 1. Custom Droids

Access specialized agents via Task tool:
```
Run the Task tool with subagent architect to design the auth system.
```

Each droid has:
- Specialized domain expertise
- Appropriate model selection (Opus for complex, Haiku for simple)
- Tool restrictions for safety
- Integration with project conventions

### 2. Specification Mode

For complex features:
1. Press `Shift+Tab` to activate
2. Describe feature in 4-6 sentences
3. Review generated specification
4. Approve to begin implementation

**Best for**: Multi-file changes, architectural decisions, coordination needs

### 3. Auto-Run Mode

Choose autonomy level:
- **Auto (Low)**: File edits and read-only commands
- **Auto (Medium)**: Reversible workspace changes
- **Auto (High)**: All commands except safety blocks

Cycle through modes: `Shift+Tab` (or `Ctrl+T` on Windows)

### 4. Context Layers

Droid automatically combines:
- Repository code and documentation
- Cursor plans (`.cursor/plans/latest.md`)
- Claude artifacts (`.claude/context/artifacts/*`)
- Knowledge base docs (tagged)

### 5. Hooks

**Pre-run hook**:
- Validates code quality (lint, test)
- Attaches context artifacts
- Checks for merge conflicts
- Blocks dangerous commands

**Post-run hook**:
- Generates coverage reports
- Publishes artifacts to Claude Projects
- Syncs context to Cursor and Claude
- Notifies team via Slack

## Usage Examples

### Understanding Code

```
Explain how user authentication flows through this system.
```

### Implementing Features

```
Add a PATCH /users/:id endpoint with email uniqueness validation. Update the OpenAPI spec and add integration tests.
```

### Using Specification Mode

```
[Shift+Tab] Add user data export functionality that works for accounts up to 5GB. Must comply with GDPR and include audit logging. Should complete within 10 minutes.
```

### Code Review

```
Review my uncommitted changes with git diff and suggest improvements before I commit.
```

## Best Practices

1. **Document conventions in AGENTS.md**: Droid reads these automatically
2. **Use Specification Mode for complex features**: Ensures thorough planning
3. **Start with Auto (Low)**: Increase autonomy as you build trust
4. **Reference existing patterns**: Mention similar code when requesting changes
5. **Set clear boundaries**: Specify scope to contain changes
6. **Verify with tests**: Always include test requirements
7. **Review changes**: Check diffs even in Auto-Run mode
8. **Publish artifacts**: Maintain context across platforms

## Troubleshooting

### Custom Droids not appearing

**Problem**: Droids don't show up after enabling

**Solution**:
1. Verify Custom Droids enabled: `/settings` → `enableCustomDroids: true`
2. Restart droid completely (exit and restart)
3. Check droid files exist in `.factory/droids/`
4. Verify file permissions are correct

### Hooks not executing

**Problem**: Pre/post run hooks don't run

**Solution**:
1. Verify hook files are valid YAML syntax
2. Check trigger names match: `before_run`, `after_run`
3. Review Factory logs for hook errors
4. Test hooks manually: `droid --hook pre-run`

### Context not syncing

**Problem**: Artifacts don't sync to Cursor/Claude

**Solution**:
1. Verify directories exist: `.cursor/context/`, `.claude/context/artifacts/`
2. Check hook configuration in `hooks/post-run.yaml`
3. Review file permissions
4. Test sync manually: Copy artifacts and verify paths

### Too many prompts in Auto-Run

**Problem**: Still getting prompts even in Auto (High)

**Solution**:
1. Check autonomy level in status banner
2. Verify commands aren't in denylist: `/settings` → `commandDenylist`
3. Add safe commands to allowlist: `/settings` → `commandAllowlist`
4. Review command risk classification

## Next Steps

1. **Read instruction guides**: See `instructions/` directory for detailed guides
2. **Configure integrations**: Set up GitHub, Linear, Slack as needed
3. **Customize AGENTS.md**: Add project-specific conventions
4. **Test workflows**: Try Specification Mode and Auto-Run with simple tasks
5. **Review skills**: Understand context routing and incident response

## Additional Resources

- **Factory Documentation**: https://docs.factory.ai/
- **Instruction Guides**: `.factory/instructions/` directory
- **Skills Documentation**: `.factory/skills/` directory
- **README**: `.factory/README.md` for quick reference

## Support

For issues or questions:
- Review instruction guides in `instructions/`
- Check Factory documentation: https://docs.factory.ai/
- Review hook and skill configurations
- Verify AGENTS.md is up-to-date with project conventions

