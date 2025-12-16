# Migration Guide: Context Optimization & Rule Consolidation

This guide helps you migrate existing projects to the new optimized rule structure with subagent context loading.

## Overview

The migration involves:
1. **Rule Consolidation**: 100+ duplicate files → 8 master files
2. **Subagent Context Loading**: Rules load only when agents activate
3. **Archive Niche Rules**: Move rarely-used rules to archive
4. **Update Configuration**: Configure agents with context files

## Pre-Migration Checklist

- [ ] Backup your current `.claude/` directory
- [ ] Review current context usage (`/context` command in Claude Code)
- [ ] Identify which agents you use most frequently
- [ ] Note any custom rules you've added

## Step-by-Step Migration

### Step 1: Verify Master Files

Master files should already be created in `.claude/rules-master/`:

- [ ] `TECH_STACK_NEXTJS.md` (if using Next.js/React)
- [ ] `PROTOCOL_ENGINEERING.md` (always present)
- [ ] `TOOL_CYPRESS_MASTER.md` (if using Cypress)
- [ ] `TOOL_PLAYWRIGHT_MASTER.md` (if using Playwright)
- [ ] `LANG_PYTHON_GENERAL.md` (if using Python)
- [ ] `FRAMEWORK_FASTAPI.md` (if using FastAPI)
- [ ] `LANG_SOLIDITY.md` (if using Solidity)

### Step 2: Verify Archive

Check that niche rules are archived:

```bash
ls .claude/archive/
```

You should see directories like:
- `dragonruby-*`, `elixir-*`, `go-*`, `unity-*`
- `laravel-*`, `drupal-*`, `wordpress-*`
- `android-*`, `flutter-*`, `react-native-*`
- `svelte*`, `vue-*`, `rails-*`

### Step 3: Verify Configuration

Check `.claude/config.yaml` has `context_files` for your agents:

```yaml
developer:
  context_files:
      - .claude/rules-master/TECH_STACK_NEXTJS.md
      - .claude/rules-master/PROTOCOL_ENGINEERING.md
  context_strategy: "lazy_load"
```

### Step 4: Test Agent Activation

1. Open Claude Code in your project
2. Trigger the developer agent: "Implement a new feature"
3. Check context usage: `/context`
4. Verify rules are loading correctly

### Step 5: Monitor Context Usage

Use the context monitor tool:

```bash
node .claude/tools/context-monitor.mjs report
```

Compare before/after context usage.

## Validation

### Validate Master Files

```bash
node scripts/validate-rules.mjs
```

This checks for:
- Duplicate content
- Missing sections
- Markdown structure issues

### Validate Migration

```bash
node scripts/migrate-rules.mjs validate
```

This verifies:
- All master files exist
- Archive directory exists
- Config has context_files

## Troubleshooting

### Issue: Agent not loading context files

**Solution**: 
1. Check `.claude/config.yaml` has `context_files` for the agent
2. Verify file paths are correct
3. Restart Claude Code

### Issue: Context usage still high

**Solution**:
1. Check if old rule files are still being loaded
2. Verify archive directory excludes old files
3. Check `manifest.yaml` excludes archive

### Issue: Missing rules after migration

**Solution**:
1. Check archive directory for the rule
2. Restore from archive if needed: `cp -r .claude/archive/[rule] .claude/rules/`
3. Or reference archive file directly when needed

## Rollback

If you need to rollback:

1. Restore backup: `cp -r backup/.claude .claude`
2. Or restore specific files from archive
3. Revert config.yaml changes

## Post-Migration

### Monitor Context Usage

Track context usage over time:

```bash
# Daily report
node .claude/tools/context-monitor.mjs report

# Agent-specific stats
node .claude/tools/context-monitor.mjs stats developer
```

### Update Team Documentation

- Document which master files apply to your project
- Update onboarding docs with new structure
- Train team on subagent context loading

## Expected Results

After migration:
- **Context Usage**: Reduced from 141% to ~60-70%
- **Rule Files**: Reduced from 1084 to ~50 active + archive
- **Agent Activation**: Faster, cleaner context
- **Token Costs**: Reduced due to lower context usage

## Support

For issues or questions:
1. Check `.claude/docs/CONTEXT_OPTIMIZATION.md`
2. Review `.claude/archive/README.md`
3. Validate configuration: `node scripts/validate-rules.mjs`

