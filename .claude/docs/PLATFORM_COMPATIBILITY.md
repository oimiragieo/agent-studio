# Platform Compatibility Guide

## Overview

This document describes the platform compatibility system for Customer User Journeys (CUJs). Each CUJ is validated against supported platforms to determine which environments can execute it successfully.

## Supported Platforms

### Claude Code (Reference Implementation)

**Platform ID**: `claude-code`

**Capabilities**:
| Feature | Support Level | Notes |
|---------|---------------|-------|
| Skills | Full | All 108 skills supported |
| Workflows | Full | Native .yaml execution |
| MCP | Full | All MCP servers supported |
| Hooks | Full | Pre/post tool hooks |
| Agents | Full | All 34 agents available |
| Schemas | Full | JSON schema validation |
| Rules | Full | All 1,081+ rules |

**Version Tested**: 1.0.0+

**Notes**: Claude Code is the reference implementation. All features work as documented.

---

### Cursor IDE

**Platform ID**: `cursor`

**Capabilities**:
| Feature | Support Level | Notes |
|---------|---------------|-------|
| Skills | Full (104) | 4 skills excluded |
| Workflows | Via Extension | Requires workflow adapter |
| MCP | Limited | Only configured servers |
| Hooks | Not Supported | No hook system |
| Agents | Not Supported | Uses .cursorrules routing |
| Schemas | Full | JSON schema validation |
| Rules | Full | All rules supported |

**Version Tested**: 0.40+

**Excluded Skills**:

- `recovery` - Claude Code specific orchestration recovery
- `optional-artifact-handler` - Requires hook system
- `conflict-resolution` - Requires agent system
- `api-contract-generator` - Requires specific MCP integration

**Notes**: Agent routing is handled through `.cursorrules` file rather than the `.claude/agents/` system.

---

### Factory Droid

**Platform ID**: `factory`

**Capabilities**:
| Feature | Support Level | Notes |
|---------|---------------|-------|
| Skills | Limited (8) | Only core skills |
| Workflows | Not Supported | Uses task-tool pattern |
| MCP | Not Supported | No MCP integration |
| Hooks | Not Supported | No hook system |
| Agents | Limited (22) | Subset of agents |
| Schemas | Full | JSON schema validation |
| Rules | Full | All rules supported |

**Version Tested**: 2024.12+

**Supported Skills**:

- `rule-auditor` - Rule compliance checking
- `rule-selector` - Technology stack rule selection
- `scaffolder` - Boilerplate generation
- `repo-rag` - Codebase search
- `artifact-publisher` - Artifact publishing
- `context-bridge` - Cross-platform state sync
- `context-router` - Context routing
- `incident-response` - Incident handling

**Supported Agents**: 22 of 34 agents (see platform-compatibility.json for full list)

**Workflow Execution**: Factory uses the "Task tool with subagent" pattern instead of direct workflow YAML execution. Workflow-based CUJs require adaptation to this pattern.

---

### OpenAI Codex CLI

**Platform ID**: `codex-cli`

**Capabilities**:
| Feature | Support Level | Notes |
|---------|---------------|-------|
| Skills | Codex-only (2) | Only codex-skills/ |
| Workflows | Not Supported | - |
| MCP | Not Supported | - |
| Hooks | Not Supported | - |
| Agents | Not Supported | - |
| Schemas | Not Supported | - |
| Rules | Not Supported | - |

**Version Tested**: 2024.12+

**Supported Skills** (from `codex-skills/` directory):

- `multi-ai-code-review` - Multi-model code review
- `response-rater` - Plan and response quality rating

**Notes**: Used primarily for multi-AI validation workflows where multiple LLM providers collaborate.

---

### Untested Platforms

The following platforms have not been validated:

- **Google Gemini CLI** (`gemini-cli`)
- **Aider** (`aider`)

All capabilities are marked as `untested` for these platforms. CUJs will not be marked as compatible with untested platforms.

## Capability Levels

| Level               | Description                                     |
| ------------------- | ----------------------------------------------- |
| `true`              | Fully supported - feature works as documented   |
| `false`             | Not supported - feature unavailable             |
| `limited`           | Partially supported - check supported\_\* lists |
| `platform-specific` | Requires platform-specific implementation       |
| `codex-only`        | Only codex-specific skills work                 |
| `untested`          | Support unknown - needs validation              |

## Execution Mode Requirements

### Workflow CUJs

**Required Capabilities**: `workflows`, `agents`

**Compatible Platforms**:

- Claude Code (native)
- Cursor (via extension)

**Incompatible Platforms**:

- Factory (uses task-tool pattern instead)
- Codex CLI (no workflow support)

**Migration for Factory**: Workflow CUJs must be adapted to use the Task tool with subagent pattern. This is NOT automatic - each workflow CUJ needs manual adaptation.

### Skill-Only CUJs

**Required Capabilities**: `skills` (and the specific skill must be available)

**Compatible Platforms**:

- Claude Code (all skills)
- Cursor (104 skills, excludes 4)
- Factory (8 core skills only)
- Codex CLI (2 codex-skills only)

### Manual CUJs

**Required Capabilities**: None

**Compatible Platforms**: All (user-driven, no automation required)

## Validation Process

The CUJ validation system checks platform compatibility using these steps:

1. **Load Platform Matrix**: Read `.claude/context/platform-compatibility.json`
2. **Determine Execution Mode**: Workflow, skill-only, or manual
3. **Check Capability Requirements**: Verify platform supports required capabilities
4. **Check Resource Availability**:
   - For skills: Is the specific skill available on the platform?
   - For workflows: Is the workflow file present?
5. **Generate Compatibility Report**: List compatible platforms with any warnings

## Adding New Platforms

To add support for a new platform:

1. **Edit Platform Matrix**: Add entry to `.claude/context/platform-compatibility.json`
2. **Define Capabilities**: Set each capability to appropriate level
3. **List Supported Resources**: Add `supported_skills`, `supported_agents` if limited
4. **Test**: Run CUJ validation to verify
5. **Document**: Update this file with platform details

Example entry:

```json
{
  "new-platform": {
    "display_name": "New Platform",
    "description": "Description of the platform",
    "version_tested": "1.0.0",
    "capabilities": {
      "skills": "limited",
      "workflows": false,
      "mcp": false,
      "hooks": false,
      "agents": false,
      "schemas": true,
      "rules": true
    },
    "supported_skills": ["skill-1", "skill-2"],
    "notes": "Notes about platform limitations"
  }
}
```

## Platform Migration Guides

### Migrating from Claude Code to Cursor

1. **Skills**: Most skills work. Check if CUJ uses excluded skills.
2. **Workflows**: Use workflow adapter extension.
3. **Agents**: Replace with `.cursorrules` routing.
4. **Hooks**: Remove hook dependencies or implement alternatives.

### Migrating from Claude Code to Factory

1. **Skills**: Only 8 skills available. Check CUJ skill requirements.
2. **Workflows**: Rewrite using Task tool with subagent pattern.
3. **Agents**: 22 agents available. Verify required agents.
4. **MCP/Hooks**: Not available - remove dependencies.

### Adapting Workflow CUJs for Factory

Factory does not execute `.yaml` workflows directly. To adapt:

1. **Identify workflow steps**: Extract agent sequence from workflow
2. **Create task prompts**: Write Task tool invocations for each step
3. **Define subagent types**: Map workflow agents to Factory-supported agents
4. **Handle artifacts**: Use artifact-publisher skill for state passing

Example adaptation:

```
// Workflow CUJ (Claude Code)
workflow: greenfield-fullstack.yaml
steps: analyst -> architect -> developer -> qa

// Factory Adaptation
Task 1: "Spawn analyst to gather requirements"
Task 2: "Spawn architect to design system"
Task 3: "Spawn developer to implement"
Task 4: "Spawn qa to validate"
```

## Validation Commands

Check CUJ platform compatibility:

```bash
node .claude/tools/validate-cuj-e2e.mjs --verbose
```

View platform compatibility matrix:

```bash
cat .claude/context/platform-compatibility.json | jq '.platforms'
```

## Related Files

- **Platform Matrix**: `.claude/context/platform-compatibility.json`
- **CUJ Validator**: `.claude/tools/validate-cuj-e2e.mjs`
- **CUJ Index**: `.claude/docs/cujs/CUJ-INDEX.md`

## Version History

| Version | Date       | Changes                                                     |
| ------- | ---------- | ----------------------------------------------------------- |
| 1.0.0   | 2025-01-10 | Initial release - replace hardcoded assumptions with matrix |
