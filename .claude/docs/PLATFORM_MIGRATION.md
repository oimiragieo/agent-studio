# Platform Migration Guide

Guide for porting workflows between Claude Code, Cursor, and Factory Droid.

## Overview

The LLM Rules Production Pack supports three AI development platforms. This guide explains how to migrate workflows, agents, and skills between platforms while maintaining functionality.

## Platform Capabilities Matrix

| Feature                | Claude Code | Cursor                 | Factory Droid        |
| ---------------------- | ----------- | ---------------------- | -------------------- |
| Native Workflows       | Full        | Translated             | Manual               |
| Skills (43)            | Full        | Converted to prompts   | Converted to prompts |
| Subagents (34)         | Full        | Partial (single agent) | None                 |
| Plan Mode              | Full        | Full                   | None                 |
| Task Tool              | Full        | None                   | Full                 |
| Validation Gates       | Full        | Manual                 | Manual               |
| Parallel Execution     | Full        | None                   | None                 |
| CUJ Support            | 62/62       | 45/62                  | 30/62                |
| Checkpoint Restoration | Full        | Partial                | None                 |

## Quick Reference

### When to Use Each Platform

| Platform          | Best For                                                                |
| ----------------- | ----------------------------------------------------------------------- |
| **Claude Code**   | Complex multi-agent workflows, enterprise projects, automated pipelines |
| **Cursor**        | IDE-integrated development, single-agent tasks, quick iterations        |
| **Factory Droid** | Simple sequential tasks, prototyping, learning                          |

### CUJ Availability by Platform

| Category         | Claude | Cursor | Factory |
| ---------------- | ------ | ------ | ------- |
| Core Development | 20/20  | 15/20  | 10/20   |
| Code Quality     | 12/12  | 10/12  | 6/12    |
| Enterprise       | 10/10  | 8/10   | 4/10    |
| Specialized      | 20/20  | 12/20  | 10/20   |

---

## Migration: Claude Code to Cursor

### Step 1: Translate workflow

```bash
node .claude/tools/detect-platform.mjs \
  --translate .claude/workflows/greenfield-fullstack.yaml \
  --platform cursor \
  > .cursor/workflows/greenfield-fullstack.json
```

### Step 2: Understand translations

Skills are converted to natural language prompts:

| Skill               | Cursor Prompt                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------ |
| `response-rater`    | "Rate this plan on a scale of 1-10 based on completeness, feasibility, risk mitigation..." |
| `repo-rag`          | "Search the codebase for relevant patterns and implementations..."                         |
| `scaffolder`        | "Generate rule-compliant boilerplate code following project conventions..."                |
| `diagram-generator` | "Create architecture and flow diagrams using Mermaid syntax..."                            |

### Step 3: Set up Plan Mode

Cursor workflows use Plan Mode for multi-step execution:

1. Open Cursor Composer (Cmd/Ctrl + K)
2. Enable Plan Mode
3. Paste the generated plan from translation
4. Execute phases sequentially

### Step 4: Handle parallel steps

Cursor executes parallel steps sequentially. Review the translated workflow for `_skill_converted` markers and adjust timing expectations.

### Step 5: Manual validation gates

Validation gates require manual verification in Cursor:

```markdown
## Validation Checklist for Step 3

- [ ] Code compiles without errors
- [ ] All tests pass
- [ ] No security vulnerabilities introduced
- [ ] Documentation updated
```

### Cursor-Specific Configuration

Create `.cursorrules` from Claude agent:

```bash
# Extract agent prompt for Cursor
cat .claude/agents/developer.md | head -100 > .cursorrules
```

---

## Migration: Claude Code to Factory Droid

### Step 1: Translate workflow

```bash
node .claude/tools/detect-platform.mjs \
  --translate .claude/workflows/greenfield-fullstack.yaml \
  --platform factory \
  > (Factory integration not shipped in this release)
```

### Step 2: Create manual execution checklist

Factory Droid requires manual task creation. Use the FactoryAdapter's checklist generator:

```javascript
import { FactoryAdapter } from '.claude/platform-adapters/factory-adapter.mjs';
import workflow from '.claude/workflows/greenfield-fullstack.yaml';

const adapter = new FactoryAdapter();
const checklist = adapter.generateExecutionChecklist(workflow);
console.log(checklist);
```

### Step 3: Execute tasks sequentially

For each workflow step:

1. Create new task in Factory Droid
2. Set agent context from translated prompt
3. Provide inputs from previous step outputs
4. Execute and verify outputs
5. Save checkpoint before next step

### Step 4: Handle limitations

| Limitation            | Workaround                                  |
| --------------------- | ------------------------------------------- |
| No subagents          | Execute each agent's work in separate tasks |
| No skills             | Convert skill calls to detailed prompts     |
| No validation gates   | Create manual checklist after each step     |
| No parallel execution | Execute in dependency order                 |
| No auto-retry         | Manually re-run failed steps                |

### Example: Developer Step

**Claude Code (Original)**:

```yaml
- step: 5
  agent: developer
  skill: scaffolder
  inputs:
    - architecture.json
  outputs:
    - implementation/
```

**Factory Droid (Translated)**:

```
Task: Implement Feature
Agent Context: You are a software developer. Write clean, tested, production-ready code...

Instructions:
1. Read architecture.json for structure
2. Generate implementation following scaffolder patterns
3. Create files in implementation/ directory
4. Verify code compiles and passes lint

Expected Output: implementation/ directory with source files
```

---

## Migration: Cursor to Claude Code

### Step 1: Import workflow

Cursor workflows translate cleanly to Claude:

```bash
node .claude/tools/detect-platform.mjs \
  --translate .cursor/workflows/feature.json \
  --platform claude \
  > .claude/workflows/feature.yaml
```

### Step 2: Enable full capabilities

Restore capabilities that were degraded:

- **Skills**: Replace prompt-based skill calls with native skill invocations
- **Subagents**: Add parallel execution where beneficial
- **Validation Gates**: Enable automated validation

### Step 3: Validate upgrade

```bash
node .claude/tools/workflow_runner.js \
  --workflow .claude/workflows/feature.yaml \
  --validate-only
```

---

## Migration: Factory Droid to Claude Code

### Step 1: Create workflow from tasks

Factory Droid tasks need to be structured into a workflow:

```yaml
name: migrated-workflow
description: Migrated from Factory Droid
steps:
  - step: 1
    name: Task 1 Name
    agent: developer
    description: Task 1 description from Factory
    outputs:
      - artifact-1.json
```

### Step 2: Add automation

Enhance with Claude capabilities:

- Add skill invocations
- Enable parallel execution for independent steps
- Add validation gates
- Configure retry policies

### Step 3: Test migration

```bash
node .claude/tools/workflow_runner.js \
  --workflow .claude/workflows/migrated.yaml \
  --step 1 \
  --dry-run
```

---

## Skill Conversion Reference

### Full skill to prompt conversion table

| Skill                  | Prompt Conversion                                                                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `response-rater`       | Rate this plan on a scale of 1-10 based on completeness, feasibility, risk mitigation, agent coverage, and integration. Provide specific feedback for improvement. |
| `artifact-publisher`   | Publish the generated artifacts to the project feed with proper versioning and metadata.                                                                           |
| `rule-auditor`         | Audit the code for rule compliance against the loaded rule set. Check for violations and suggest fixes.                                                            |
| `repo-rag`             | Search the codebase for relevant patterns and implementations. Use semantic search to find similar code.                                                           |
| `scaffolder`           | Generate rule-compliant boilerplate code following project conventions and best practices.                                                                         |
| `diagram-generator`    | Create architecture and flow diagrams using Mermaid syntax. Include component relationships.                                                                       |
| `test-generator`       | Generate comprehensive test cases for the implementation. Cover edge cases and error paths.                                                                        |
| `doc-generator`        | Generate technical documentation for the component. Include API references and examples.                                                                           |
| `dependency-analyzer`  | Analyze project dependencies for compatibility and security vulnerabilities. Suggest updates.                                                                      |
| `sequential-thinking`  | Break down this complex problem step-by-step with explicit reasoning. Show your work.                                                                              |
| `context-bridge`       | Sync the current context state to the target platform. Include artifacts and progress.                                                                             |
| `memory-manager`       | Store or retrieve information from the knowledge graph for future sessions.                                                                                        |
| `code-style-validator` | Validate code style against project conventions. Report violations with line numbers.                                                                              |
| `commit-validator`     | Validate commit message format and content. Ensure conventional commit compliance.                                                                                 |

---

## Troubleshooting

### Common Migration Issues

**Issue**: Skills not executing correctly after conversion

**Solution**: Review the skill prompt conversion. Add more context about expected inputs/outputs.

---

**Issue**: Parallel steps causing race conditions in Cursor

**Solution**: Execute parallel steps sequentially with explicit dependency management.

---

**Issue**: Validation gates not working in Factory Droid

**Solution**: Create manual checklist and verify each criterion before proceeding.

---

**Issue**: Context loss between sessions

**Solution**: Use `context-bridge` skill (Claude) or save state to files between sessions.

---

## Verification Commands

### Check platform compatibility

```bash
node .claude/tools/detect-platform.mjs --compare claude cursor
```

### List available platforms

```bash
node .claude/tools/detect-platform.mjs --list
```

### Show platform capabilities

```bash
node .claude/tools/detect-platform.mjs --capabilities
```

### Validate translated workflow

```bash
node .claude/tools/workflow_runner.js \
  --workflow <translated-workflow> \
  --validate-only
```

---

## Best Practices

### Before Migration

1. Document current workflow performance metrics
2. Identify critical skills and agents used
3. Review CUJ compatibility for target platform
4. Plan for manual steps where automation not available

### During Migration

1. Translate workflows using the adapter tools
2. Review all `_skill_converted` markers
3. Test each step in isolation
4. Document any workarounds needed

### After Migration

1. Validate all outputs match original workflow
2. Update documentation for target platform
3. Train team on platform-specific differences
4. Monitor for degraded functionality

---

## Related Documentation

- `.claude/platform-adapters/README.md` - Adapter layer documentation
- `.claude/tools/detect-platform.mjs` - Platform detection utility
- `.claude/workflows/WORKFLOW-GUIDE.md` - Workflow execution guide
- `.claude/docs/AGENT_SKILL_MATRIX.md` - Agent and skill mappings

---

## Version History

| Version | Date       | Changes                 |
| ------- | ---------- | ----------------------- |
| 1.0.0   | 2026-01-06 | Initial migration guide |
