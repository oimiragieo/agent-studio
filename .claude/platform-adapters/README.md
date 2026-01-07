# Platform Adapters

Cross-platform compatibility layer for translating workflows between Claude Code, Cursor, and Factory Droid.

## Overview

The platform adapter layer enables workflows designed for Claude Code to be executed on other platforms with appropriate translations. Each adapter handles platform-specific differences in capabilities, skill support, and execution models.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Platform Adapter Layer                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  ClaudeAdapter  │  │  CursorAdapter  │  │ FactoryAdapter  │  │
│  │   (Native)      │  │  (Translated)   │  │   (Manual)      │  │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  │
│           │                    │                    │           │
│           └────────────────────┼────────────────────┘           │
│                                │                                 │
│                    ┌───────────┴───────────┐                    │
│                    │   BasePlatformAdapter │                    │
│                    │   (Abstract Class)    │                    │
│                    └───────────────────────┘                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Files

| File | Description |
|------|-------------|
| `base-adapter.mjs` | Abstract base class with common interface |
| `claude-adapter.mjs` | Native Claude Code adapter (full support) |
| `cursor-adapter.mjs` | Cursor IDE adapter (Plan Mode translation) |
| `factory-adapter.mjs` | Factory Droid adapter (manual coordination) |
| `adapter-registry.json` | Adapter configuration and capabilities |

## Usage

### Detect Platform

```javascript
import { detectPlatform, loadAdapter } from '.claude/tools/detect-platform.mjs';

const platform = detectPlatform();
const adapter = await loadAdapter(platform);
```

### Translate Workflow

```javascript
import { CursorAdapter } from '.claude/platform-adapters/cursor-adapter.mjs';

const adapter = new CursorAdapter();
const translatedWorkflow = adapter.translateWorkflow(claudeWorkflow);
```

### Check Compatibility

```javascript
const compatibility = adapter.checkCompatibility(workflow);
if (!compatibility.compatible) {
  console.log('Issues:', compatibility.issues);
}
```

### Get Agent Invocation

```javascript
const invocation = adapter.getAgentInvocation('developer', {
  prompt: 'Implement the user authentication module',
  description: 'Create secure login functionality'
});
```

## Platform Capabilities

| Feature | Claude Code | Cursor | Factory Droid |
|---------|-------------|--------|---------------|
| Native Workflows | Full | Translated | Manual |
| Skills | Full | Converted | Converted |
| Subagents | Full | Partial | None |
| Plan Mode | Full | Full | None |
| Validation Gates | Full | Manual | Manual |
| Parallel Execution | Full | None | None |
| CUJ Support | 62/62 | 45/62 | 30/62 |

## Adapter Details

### ClaudeAdapter (Native)

- Full native support for all workflow features
- No translation needed
- Supports all 43 skills
- Supports all 34 agents
- Supports parallel execution and validation gates

### CursorAdapter (Translated)

- Workflows translated to Plan Mode structure
- Skills converted to natural language prompts
- Parallel steps executed sequentially
- Validation gates require manual verification
- Composer mode for multi-file changes

### FactoryAdapter (Manual)

- Workflows converted to manual task sequences
- Requires manual task creation for each step
- No subagent orchestration
- Provides execution checklists
- Estimates manual effort overhead

## Translation Process

### Claude to Cursor

1. Group steps into phases for Plan Mode
2. Convert skill invocations to prompts
3. Mark validation gates for manual checks
4. Generate Composer-compatible instructions

### Claude to Factory

1. Convert each step to standalone task
2. Generate agent prompts
3. Create execution checklist
4. Identify and document limitations
5. Estimate manual effort

## Extending

To add a new platform adapter:

1. Create `new-platform-adapter.mjs` extending `BasePlatformAdapter`
2. Implement required methods:
   - `translateStep(step)`
   - `translateWorkflow(workflow)`
   - `getAgentInvocation(agent, context)`
3. Define capabilities in constructor
4. Add entry to `adapter-registry.json`
5. Update detection rules if needed

## Related Files

- `.claude/tools/detect-platform.mjs` - Platform detection utility
- `.claude/tools/translate-workflow.mjs` - Workflow translation CLI
- `.claude/docs/PLATFORM_MIGRATION.md` - Migration guide
- `.claude/schemas/adapter-registry.schema.json` - Registry schema

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-06 | Initial release with Claude, Cursor, Factory adapters |
