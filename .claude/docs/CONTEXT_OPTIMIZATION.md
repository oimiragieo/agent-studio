# Context Optimization Guide

Best practices for managing context usage and token efficiency in Claude Code.

## Understanding Context Usage

### Context Components

Context usage consists of:

- **System Prompt**: Base instructions (typically 3-5k tokens)
- **System Tools**: Tool definitions (MCP tools, custom tools)
- **MCP Tools**: Model Context Protocol tool schemas
- **Custom Agents**: Agent definitions and prompts
- **Memory Files**: Loaded rule files, documentation
- **Messages**: Conversation history
- **Autocompact Buffer**: Compressed conversation history

### Target Usage

- **Optimal**: 60-70% of max context (120k-140k tokens)
- **Warning**: 80%+ (160k+ tokens) - consider optimization
- **Critical**: 90%+ (180k+ tokens) - immediate action needed

## Optimization Strategies

### 1. Subagent Context Loading (Specialist Pattern)

**Problem**: Loading all rules for all agents wastes context.

**Solution**: Load rules ONLY when specific agents activate.

**Implementation**:

- Configure `context_files` in `.claude/config.yaml`
- Use `lazy_load` strategy
- Rules load on agent activation, unload on deactivation

**Benefits**:

- Main context stays clean (0 cost for unused rules)
- Specialist agents get deep knowledge when needed
- Reduces context usage by 40-50%

### 2. Rule Consolidation

**Problem**: 100+ duplicate rule files describing the same stack.

**Solution**: Consolidate into master files.

**Master Files Created**:

- `TECH_STACK_NEXTJS.md` - Replaces 30+ Next.js/React variants
- `PROTOCOL_ENGINEERING.md` - Replaces 10+ code quality files
- `TOOL_CYPRESS_MASTER.md` - Replaces 5 Cypress files
- `TOOL_PLAYWRIGHT_MASTER.md` - Replaces 5 Playwright files
- And more...

**Benefits**:

- Single source of truth
- Eliminates duplicate content
- Easier to maintain and update

### 3. Archive Niche Rules

**Problem**: Rarely-used rules consume context unnecessarily.

**Solution**: Move to archive for on-demand lookup.

**Archive Location**: `.claude/archive/`

**Rules to Archive**:

- Niche languages (DragonRuby, Elixir, Go, Unity, etc.)
- Unused frameworks (Laravel, Drupal, WordPress, etc.)
- Older versions (Next.js 14, etc.)
- Mobile frameworks (unless mobile project)

**Benefits**:

- Immediate space savings
- Rules still accessible when needed
- Cleaner active rules directory

### 4. Use Skills Instead of Rule Files

**Problem**: Text files that describe rules consume context when loaded.

**Solution**: Create programmatic validators (skills).

**Examples**:

- `commit-validator` skill - Validates commit messages (replaces text file)
- `code-style-validator` skill - Validates code style (complements rules)

**Benefits**:

- Instant feedback
- No context cost (tool, not loaded file)
- More actionable than reading text

### 5. Optimize Agent Definitions

**Best Practices**:

- Keep agent prompts concise
- Reference external files instead of inline content
- Use clear, focused instructions
- Avoid duplication across agents

### 6. Monitor and Track

**Tools**:

- Context monitor: `node .claude/tools/context-monitor.mjs report`
- Check usage: `/context` command in Claude Code
- Historical tracking: Review usage over time

### 7. Context Editing (Automatic Context Compaction)

**Problem**: Long-running conversations accumulate tool results and thinking blocks, consuming context.

**Solution**: Use Anthropic's context editing features to automatically clear old content.

**Features**:

- **Tool Use Clearing** (`clear_tool_uses_20250919`): Clears old tool results when context grows large
- **Thinking Management** (`clear_thinking_20251015`): Manages extended thinking blocks
- **Configurable Triggers**: Token-based triggers (30-40k tokens recommended)
- **Retention Policies**: Keep recent content, clear old content

**Configuration** (in `.claude/config.yaml`):

```yaml
context_editing:
  enabled: true
  clear_tool_uses:
    enabled: true
    tool_id: 'clear_tool_uses_20250919'
    trigger_tokens: 40000
    retention_policy: 'keep_recent'
    keep_recent_count: 10 # Keep last 10 tool results
  clear_thinking:
    enabled: true
    tool_id: 'clear_thinking_20251015'
    trigger_tokens: 50000
    retention_policy: 'keep_recent'
    keep_recent_count: 5 # Keep last 5 thinking blocks
  apply_to_all_agents: true
```

**Benefits**:

- Automatic context management for long-running sessions
- Keeps recent context while clearing old content
- Reduces context usage by 20-30% in long conversations
- Prevents context overflow in extended sessions

**When to Use**:

- Long-running orchestrator sessions
- Extended development tasks
- Multi-step workflows
- Any session expected to exceed 50k tokens

**Best Practices**:

- Set triggers at 30-40k tokens (before context gets too full)
- Keep recent content (last 10 tool results, last 5 thinking blocks)
- Monitor context usage to tune triggers
- Use with phase-based project structure for maximum benefit

### 8. Phase-Based Project Structure

**Problem**: Project files grow to 50k+ lines, exceeding AI context limits.

**Solution**: Organize projects into phases, each capped at 1-3k lines.

**Structure**:

```
.claude/projects/{project-name}/
├── phase-01-planning/ (1-3k lines)
├── phase-02-architecture/ (1-3k lines)
├── phase-03-implementation/ (1-3k lines)
└── orchestrator-state.json
```

**Benefits**:

- Each phase file: 1-3k lines (easily digestible)
- Orchestrator only loads current phase
- Previous phases referenced on-demand
- Enables unlimited project duration

See `.claude/docs/PHASE_BASED_PROJECTS.md` for detailed guide.

### 9. Token Monitoring and Orchestrator Handoff

**Problem**: Orchestrator accumulates context until it hits 200k token limit.

**Solution**: Monitor context usage and perform seamless handoff at 90% threshold.

**Process**:

1. Monitor context usage continuously
2. At 90% (180k tokens), trigger handoff
3. Update all state via subagents
4. Create handoff package
5. Initialize new orchestrator with fresh context
6. New orchestrator continues seamlessly

**Benefits**:

- Unlimited project duration
- Seamless continuity between orchestrator instances
- No information loss
- Fresh context for each orchestrator

See `.claude/docs/EVERLASTING_AGENTS.md` for detailed guide.

### 10. Tool Search Tool (Anthropic Beta Feature)

**Problem**: MCP tools consume 40%+ of context (80k+ tokens) when all tools are loaded upfront.

**Solution**: Use Anthropic's Tool Search Tool beta feature to defer tool loading.

**Implementation**:

- Enable beta feature: `advanced-tool-use-2025-11-20`
- Configure `deferLoading: true` for MCP servers in `.claude/.mcp.json`
- Specify `alwaysLoadTools` for critical tools that must be available immediately

**Benefits**:

- **85% reduction** in MCP tool token usage (80k → 12k tokens)
- Tools load on-demand when searched/needed
- Improved accuracy: Opus 4.5 accuracy increases from 79.5% → 88.1%
- Total context usage drops from 87% → ~60-65%

**Configuration Example**:

```json
{
  "betaFeatures": ["advanced-tool-use-2025-11-20"],
  "toolSearch": {
    "enabled": true,
    "autoEnableThreshold": 20,
    "defaultDeferLoading": true
  },
  "mcpServers": {
    "repo": {
      "deferLoading": true,
      "alwaysLoadTools": ["search_code", "read_file"]
    }
  }
}
```

**When to Use**:

- MCP tool count exceeds 20 tools (auto-enable threshold)
- MCP tools consume >30% of context
- You want improved tool selection accuracy

**Critical Tools to Always Load**:

- Core file operations: `read_file`, `write_file`, `search_code`
- Essential integrations: `create_pull_request`, `get_issue`
- Frequently used: `take_screenshot`, `navigate_page`

**Additional Features**:

- **Programmatic Tool Calling**: For workflows processing large datasets (37% token reduction)
- **Tool Use Examples**: For complex tools with nested structures (72% → 90% accuracy)

See `.claude/docs/ADVANCED_TOOL_USE.md` for comprehensive guide on all three beta features.

## Monitoring Context Usage

### Real-Time Monitoring

In Claude Code, use `/context` command to see:

- Total token usage
- Breakdown by component
- Percentage of max context

### Historical Tracking

Use the context monitor tool:

```bash
# Generate report
node .claude/tools/context-monitor.mjs report

# Get stats for specific agent
node .claude/tools/context-monitor.mjs stats developer

# View last 7 days
node .claude/tools/context-monitor.mjs stats developer 7
```

### Alert Thresholds

Set up alerts when context usage exceeds:

- **80%**: Warning - consider optimization
- **90%**: Critical - immediate action needed

## Optimization Checklist

### Initial Setup

- [ ] Verify master files exist in `.claude/rules-master/`
- [ ] Check archive directory has niche rules
- [ ] Verify `config.yaml` has `context_files` for agents
- [ ] Test agent activation loads correct rules

### Ongoing Maintenance

- [ ] Monitor context usage weekly
- [ ] Review and update master files quarterly
- [ ] Archive new niche rules as they're added
- [ ] Update agent context files when stack changes

### Performance Optimization

- [ ] Use lazy loading for all agents
- [ ] Keep global rules minimal (PROTOCOL_ENGINEERING.md only)
- [ ] Archive rules not actively used
- [ ] Create skills for programmatic validation

## Common Issues and Solutions

### Issue: Context usage still high after migration

**Solutions**:

1. Check if old rule files are still being loaded
2. Verify archive is excluded from loading
3. Review MCP tools - disable unused ones
4. Check for large memory files

### Issue: Agent not loading context files

**Solutions**:

1. Verify `context_files` in `config.yaml`
2. Check file paths are correct
3. Restart Claude Code
4. Check file permissions

### Issue: Missing rules after consolidation

**Solutions**:

1. Check archive directory
2. Restore from archive if needed
3. Reference archive file directly when needed
4. Create new master file if rule is frequently used

## Best Practices Summary

1. **Use Subagent Context Loading**: Load rules only when agents activate
2. **Consolidate Rules**: Use master files instead of duplicates
3. **Archive Niche Rules**: Move rarely-used rules to archive
4. **Create Validator Skills**: Use tools instead of loaded text files
5. **Enable Context Editing**: Automatic compaction for long-running sessions
6. **Use Phase-Based Structure**: Organize projects into manageable phases
7. **Monitor Token Usage**: Track context and trigger handoff at 90%
8. **Monitor Usage**: Track context usage regularly
9. **Optimize Agent Definitions**: Keep prompts concise
10. **Review Regularly**: Update rules and configuration quarterly

## Expected Results

After optimization:

- **Context Usage**: 60-70% (down from 141%)
- **Rule Files**: ~50 active (down from 1084)
- **Agent Activation**: Faster, cleaner
- **Token Costs**: Reduced by 40-50%

## Tools Reference

- **Context Monitor**: `.claude/tools/context-monitor.mjs`
- **Token Monitor**: `.claude/tools/token-monitor.mjs` - Monitor orchestrator context usage
- **Orchestrator Handoff**: `.claude/tools/orchestrator-handoff.mjs` - Seamless orchestrator transitions
- **Memory Sync**: `.claude/tools/memory-sync.mjs` - Sync memory tool with CLAUDE.md
- **Rule Validator**: `scripts/validate-rules.mjs`
- **Migration Script**: `scripts/migrate-rules.mjs`
- **Subagent Loader**: `.claude/tools/subagent-context-loader.mjs`

## Additional Resources

- **Migration Guide**: `.claude/docs/MIGRATION_GUIDE.md`
- **Setup Guide**: `.claude/docs/setup-guides/CLAUDE_SETUP_GUIDE.md`
- **Archive README**: `.claude/archive/README.md`
- **Everlasting Agents**: `.claude/docs/EVERLASTING_AGENTS.md` - Orchestrator handoff system
- **Phase-Based Projects**: `.claude/docs/PHASE_BASED_PROJECTS.md` - Project structure guide
- **Memory Patterns**: `.claude/docs/MEMORY_PATTERNS.md` - Dual persistence guide
