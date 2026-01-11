# Platform Adapter Layer Implementation Report

**Issue**: #7 - Cross-platform compatibility with adapter layer
**Date**: 2026-01-06
**Status**: Complete

---

## Summary

Implemented a comprehensive platform adapter layer that enables workflow translation between Claude Code, Cursor, and Factory Droid platforms. The adapter layer provides programmatic APIs and CLI tools for platform detection, capability comparison, and workflow translation.

---

## Files Created

### Platform Adapters (`.claude/platform-adapters/`)

| File                    | Lines | Description                                 |
| ----------------------- | ----- | ------------------------------------------- |
| `base-adapter.mjs`      | 97    | Abstract base class with common interface   |
| `claude-adapter.mjs`    | 99    | Native Claude Code adapter (full support)   |
| `cursor-adapter.mjs`    | 197   | Cursor IDE adapter (Plan Mode translation)  |
| `factory-adapter.mjs`   | 207   | Factory Droid adapter (manual coordination) |
| `adapter-registry.json` | 131   | Adapter configuration and capabilities      |
| `README.md`             | 159   | Adapter layer documentation                 |

**Total**: 6 files, 890 lines

### Tools (`.claude/tools/`)

| File                  | Lines | Description                                |
| --------------------- | ----- | ------------------------------------------ |
| `detect-platform.mjs` | 343   | Platform detection and translation utility |

### Documentation (`.claude/docs/`)

| File                    | Lines | Description                   |
| ----------------------- | ----- | ----------------------------- |
| `PLATFORM_MIGRATION.md` | 365   | Comprehensive migration guide |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Platform Adapter Layer                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  ClaudeAdapter  │  │  CursorAdapter  │  │ FactoryAdapter  │  │
│  │   (Native)      │  │  (Translated)   │  │   (Manual)      │  │
│  │   Full Support  │  │   Plan Mode     │  │   Task Tool     │  │
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

---

## Capabilities Matrix

| Feature            | Claude | Cursor     | Factory   |
| ------------------ | ------ | ---------- | --------- |
| Native Workflows   | Full   | Translated | Manual    |
| Skills             | Full   | Converted  | Converted |
| Subagents          | Full   | Partial    | None      |
| Plan Mode          | Full   | Full       | None      |
| Task Tool          | Full   | None       | Full      |
| Validation Gates   | Full   | Manual     | Manual    |
| Parallel Execution | Full   | None       | None      |
| CUJ Support        | 62/62  | 45/62      | 30/62     |

---

## Key Features

### 1. Platform Detection

Automatic detection based on:

- Environment variables (`CLAUDE_CODE`, `CURSOR_SESSION`, `FACTORY_DROID`)
- Configuration files (`.claude/`, `.cursor/`, `.factory/`)
- Priority-based fallback (Claude > Cursor > Factory)

### 2. Workflow Translation

Each adapter implements:

- `translateStep(step)` - Convert individual step
- `translateWorkflow(workflow)` - Convert entire workflow
- `getAgentInvocation(agent, context)` - Platform-specific agent call
- `checkCompatibility(workflow)` - Identify compatibility issues

### 3. Skill Conversion

Skills converted to natural language prompts for non-Claude platforms:

- 14 core skills with prompt mappings
- Automatic conversion during workflow translation
- `_skill_converted` markers for tracking

### 4. Agent Prompt Mapping

11 agent types with platform-specific system prompts:

- architect, developer, qa, security-architect
- code-reviewer, planner, analyst, pm
- ux-expert, devops, technical-writer

---

## CLI Usage

### Detect Platform

```bash
node .claude/tools/detect-platform.mjs
# Output: Detected platform: claude
```

### List Platforms

```bash
node .claude/tools/detect-platform.mjs --list
```

### Compare Platforms

```bash
node .claude/tools/detect-platform.mjs --compare claude cursor
```

### Translate Workflow

```bash
node .claude/tools/detect-platform.mjs \
  --translate .claude/workflows/greenfield-fullstack.yaml \
  --platform cursor
```

### Show Capabilities

```bash
node .claude/tools/detect-platform.mjs --capabilities --json
```

---

## Programmatic API

```javascript
import {
  detectPlatform,
  loadAdapter,
  compareCapabilities,
} from '.claude/tools/detect-platform.mjs';

// Detect current platform
const platform = detectPlatform(); // 'claude'

// Load adapter
const adapter = await loadAdapter(platform);

// Translate workflow
const translated = adapter.translateWorkflow(workflow);

// Compare platforms
const comparison = compareCapabilities('claude', 'cursor');
```

---

## Translation Examples

### Claude to Cursor

**Input (Claude)**:

```yaml
- step: 1
  agent: developer
  skill: scaffolder
  outputs:
    - implementation/
```

**Output (Cursor)**:

```json
{
  "_platform": "cursor",
  "_original_step": 1,
  "name": "Developer Step",
  "agent": "developer",
  "prompt": "Generate rule-compliant boilerplate code...",
  "_skill_converted": true,
  "_original_skill": "scaffolder"
}
```

### Claude to Factory

**Input (Claude)**:

```yaml
- step: 1
  agent: developer
  skill: scaffolder
```

**Output (Factory)**:

```json
{
  "_platform": "factory",
  "task": {
    "name": "Developer Step",
    "agent_prompt": "You are a software developer...",
    "description": "Generate implementation"
  },
  "execution": {
    "mode": "sequential",
    "requires_manual_setup": true
  },
  "_limitations": ["Skill \"scaffolder\" must be executed manually"]
}
```

---

## Testing Recommendations

### Unit Tests

- [ ] Test each adapter's `translateStep()` method
- [ ] Test `translateWorkflow()` with sample workflows
- [ ] Test `checkCompatibility()` with edge cases
- [ ] Test platform detection with various configurations

### Integration Tests

- [ ] Translate real workflow and verify output structure
- [ ] Execute translated workflow on target platform
- [ ] Verify skill conversion accuracy

### Manual Verification

- [ ] Run detect-platform CLI on each platform
- [ ] Translate sample workflow to each platform
- [ ] Execute translated workflow manually

---

## Future Enhancements

1. **Additional Platforms**
   - Windsurf IDE adapter
   - Continue.dev adapter
   - Aider adapter

2. **Bidirectional Translation**
   - Cursor to Claude workflow import
   - Factory to Claude task import

3. **Skill Fidelity Improvements**
   - More detailed prompt templates
   - Skill-specific parameter handling
   - Context preservation across platforms

4. **Validation Integration**
   - Pre-translation compatibility checks
   - Post-translation validation
   - Automated testing of translated workflows

---

## Related Documentation

- `.claude/platform-adapters/README.md` - Detailed adapter documentation
- `.claude/docs/PLATFORM_MIGRATION.md` - Migration guide
- `.claude/workflows/WORKFLOW-GUIDE.md` - Workflow execution guide

---

## Conclusion

The platform adapter layer provides a solid foundation for cross-platform workflow compatibility. Claude Code retains full native support, while Cursor and Factory Droid receive translated workflows with appropriate capability degradation documented.

The implementation follows the issue specification exactly and includes additional features like:

- Execution checklist generation for Factory Droid
- Phase grouping for Cursor Plan Mode
- Manual effort estimation
- Comprehensive CLI interface
