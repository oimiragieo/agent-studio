# Composer Usage Guide

Composer is Cursor 2.0's frontier coding model optimized for fast, multi-step turns [3]. It's ideal for iterative, file-by-file coding with low latency.

## Characteristics

- **Latency**: Most responses finish < 30s; ideal for tight debug loops
- **Scope**: Great for iterative refactors, test writing, and API integration glue
- **Context**: Optimized for focused, single-turn edits
- **Speed**: 4× faster than standard Claude agents for coding tasks

## When to Use Composer

✅ **Good for:**
- Quick bug fixes and iterations
- Writing tests alongside implementation
- Refactoring single components or files
- API integration glue code
- Simple feature additions (< 100 lines)

❌ **Not ideal for:**
- Complex architectural decisions (use Architect agent)
- Multi-file coordination (use Plan Mode first)
- Deep reasoning about system design (use Claude agents)
- Cross-repo coordination (use Claude agents)

## Workflow

### Standard Workflow
1. **Plan First**: Start with Plan Mode when touching multiple files
2. **Switch to Composer**: Select Composer agent in Cursor
3. **Provide Context**: Include plan summary and relevant open files
4. **Iterate**: Let Composer apply edits; preview diff before accepting
5. **Review**: Check changes match intent
6. **Escalate**: If tasks exceed Composer's context, promote to Claude via subagent commands

### Composer Optimization Tips

**Keep Prompts Focused:**
- Request one change at a time
- Be specific about what to modify
- Provide file context upfront
- Reference existing patterns

**Leverage Speed:**
- Use for rapid iteration cycles
- Make small, incremental changes
- Build features step-by-step
- Test frequently between iterations

**Know When to Escalate:**
- Complex architectural questions → Architect agent
- Multi-file coordination → Plan Mode + Claude agents
- Deep debugging → Full Claude agent with extended context
- Security reviews → QA agent with security focus

## Agent Integration

### Developer Agent + Composer
- Use Composer for implementation after architecture is defined
- Break down features into Composer-sized chunks
- Use Plan Mode to coordinate multi-file changes
- Escalate design questions back to Architect

### QA Agent + Composer
- Use Composer for writing test files quickly
- Keep test structure simple and focused
- Escalate complex test scenarios to full QA agent
- Use Composer for quick test fixes

### Best Practices
- Start complex tasks with Plan Mode, execute with Composer
- Use Composer for speed, Claude agents for depth
- Preview all diffs before accepting
- Don't force Composer beyond its scope

[3] Cursor, "Introducing Cursor 2.0 and Composer" (Oct 29, 2025).
