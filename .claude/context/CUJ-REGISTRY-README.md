# CUJ Registry

**Single source of truth for all Customer User Journeys (CUJs)**

## Overview

The CUJ Registry (`cuj-registry.json`) is a comprehensive, machine-readable catalog of all 52+ Customer User Journeys in the LLM-RULES system. It provides a centralized data source for:

- **Orchestration**: Route user requests to the correct workflow or skill
- **Documentation**: Query CUJs by category, execution mode, or platform
- **Validation**: Ensure CUJs are properly defined and up-to-date
- **Analytics**: Track CUJ usage patterns and coverage

## Registry Location

```
.claude/context/cuj-registry.json
```

## Schema

The registry conforms to the JSON schema at:

```
.claude/schemas/cuj-registry.schema.json
```

## Registry Structure

```json
{
  "$schema": "../schemas/cuj-registry.schema.json",
  "version": "1.0.0",
  "generated": "2026-01-05T00:00:00Z",
  "total_cujs": 52,
  "cujs": [
    {
      "id": "CUJ-001",
      "name": "First-Time Installation",
      "description": "Successfully install and configure LLM-RULES...",
      "category": "Onboarding & Setup",
      "execution_mode": "manual-setup",
      "workflow": null,
      "agents": [],
      "skills": [],
      "primary_skill": null,
      "schemas": [],
      "triggers": ["Copy `.claude/` folder"],
      "platform_compatibility": {
        "claude": true,
        "cursor": true,
        "factory": false
      },
      "expected_outputs": [...],
      "estimated_duration": "varies",
      "file_path": ".claude/docs/cujs/CUJ-001.md"
    }
  ]
}
```

## CUJ Metadata

Each CUJ entry contains:

| Field                    | Type         | Description                                                 |
| ------------------------ | ------------ | ----------------------------------------------------------- |
| `id`                     | string       | Unique identifier (e.g., `CUJ-001`)                         |
| `name`                   | string       | Human-readable name                                         |
| `description`            | string       | Brief description of the user goal                          |
| `category`               | string       | Category (Onboarding, Development, etc.)                    |
| `execution_mode`         | enum         | `workflow`, `skill-only`, `delegated-skill`, `manual-setup` |
| `workflow`               | string\|null | Path to workflow YAML file (if applicable)                  |
| `agents`                 | array        | List of agents used                                         |
| `skills`                 | array        | List of skills used                                         |
| `primary_skill`          | string\|null | Primary skill (for skill-only CUJs)                         |
| `schemas`                | array        | Validation schemas used                                     |
| `triggers`               | array        | User triggers (commands, phrases)                           |
| `platform_compatibility` | object       | Compatibility flags (claude, cursor, factory)               |
| `expected_outputs`       | array        | Expected artifacts and results                              |
| `estimated_duration`     | string       | Estimated execution time                                    |
| `file_path`              | string       | Path to CUJ documentation file                              |

## Execution Modes

### 1. `workflow`

Multi-step workflows with agent coordination.

**Example**: CUJ-005 (Greenfield Project Planning)

- Uses `.claude/workflows/greenfield-fullstack.yaml`
- Coordinates multiple agents (Planner, Analyst, PM, Architect, etc.)
- Duration: 2-10 minutes

### 2. `skill-only`

Direct skill invocation without workflow coordination.

**Example**: CUJ-002 (Rule Configuration)

- Invokes `rule-selector` skill directly
- No workflow file needed
- Duration: 2-60 seconds

### 3. `delegated-skill`

Skill invocation coordinated by an agent.

**Example**: Custom skills that require agent delegation

- Agent spawns and manages skill execution
- Duration: 2-60 seconds

### 4. `manual-setup`

Requires manual user steps (installation, configuration).

**Example**: CUJ-001 (First-Time Installation)

- User manually copies files and runs setup
- Duration: varies

## Categories

1. **Onboarding & Setup** (3 CUJs)
2. **Planning & Architecture** (5 CUJs)
3. **Development** (4 CUJs)
4. **Quality Assurance** (4 CUJs)
5. **Documentation** (3 CUJs)
6. **Specialized Workflows** (4 CUJs)
7. **Maintenance & Operations** (2 CUJs)
8. **Advanced Workflows** (6 CUJs)
9. **Testing & Validation** (21 CUJs)

## Syncing the Registry

The registry is automatically generated from CUJ markdown files.

### Generate/Update Registry

```bash
pnpm sync-cuj-registry
```

Or directly:

```bash
node .claude/tools/sync-cuj-registry.mjs
```

### Validate Only (No File Write)

```bash
pnpm sync-cuj-registry:validate
```

Or:

```bash
node .claude/tools/sync-cuj-registry.mjs --validate-only
```

### Custom Output Path

```bash
node .claude/tools/sync-cuj-registry.mjs --output path/to/registry.json
```

## What the Sync Tool Does

1. **Scans** all CUJ markdown files in `.claude/docs/cujs/`
2. **Extracts** metadata from each CUJ:
   - Execution mode
   - Agents and skills used
   - Triggers and expected outputs
   - Platform compatibility
3. **Generates** comprehensive `cuj-registry.json`
4. **Validates** against `cuj-registry.schema.json`
5. **Reports** statistics and validation results

## Using the Registry

### Query CUJs by Execution Mode

```javascript
import registry from './.claude/context/cuj-registry.json' assert { type: 'json' };

const skillOnlyCUJs = registry.cujs.filter(cuj => cuj.execution_mode === 'skill-only');
console.log(`${skillOnlyCUJs.length} skill-only CUJs`);
```

### Find CUJs by Category

```javascript
const developmentCUJs = registry.cujs.filter(cuj => cuj.category === 'Development');
developmentCUJs.forEach(cuj => {
  console.log(`${cuj.id}: ${cuj.name}`);
});
```

### Find CUJs by Skill

```javascript
const scaffolderCUJs = registry.cujs.filter(cuj => cuj.skills.includes('scaffolder'));
```

### Find CUJs by Platform

```javascript
const claudeOnlyCUJs = registry.cujs.filter(
  cuj => cuj.platform_compatibility.claude && !cuj.platform_compatibility.cursor
);
```

### Lookup CUJ by ID

```javascript
const cuj = registry.cujs.find(c => c.id === 'CUJ-001');
console.log(cuj.name, cuj.description);
```

## Registry Statistics

Run the sync tool to see comprehensive statistics:

```bash
pnpm sync-cuj-registry
```

**Example Output**:

```
📊 Registry Statistics

Total CUJs: 52

By Execution Mode:
  manual-setup: 2
  skill-only: 36
  workflow: 14

By Category:
  Onboarding & Setup: 3
  Planning & Architecture: 5
  Development: 4
  Quality Assurance: 4
  Documentation: 3
  Specialized Workflows: 4
  Maintenance & Operations: 2
  Advanced Workflows: 6
  Testing & Validation: 21

Platform Compatibility:
  Claude: 50
  Cursor: 42
  Factory: 0

Unique Agents: 28
Unique Skills: 25
```

## Validation

The registry is validated against a JSON schema to ensure:

- All required fields are present
- Field types match schema expectations
- Execution modes are valid
- Platform compatibility is defined
- CUJ IDs follow the pattern `CUJ-###`

### Schema Validation

```bash
node .claude/tools/sync-cuj-registry.mjs --validate-only
```

**Validation Checks**:

- ✅ Schema compliance
- ✅ Field type validation
- ✅ Required field presence
- ✅ Enum value validation
- ✅ Date-time format validation

## Maintenance

### When to Sync

Sync the registry whenever:

- New CUJs are added
- Existing CUJs are modified
- Execution modes change
- Skills or agents are updated
- Workflow files are renamed/moved

### Automated Syncing

Add to CI/CD pipeline:

```yaml
- name: Sync CUJ Registry
  run: pnpm sync-cuj-registry

- name: Validate Registry
  run: pnpm sync-cuj-registry:validate
```

### Troubleshooting

**Issue**: Registry not found

```bash
# Regenerate the registry
pnpm sync-cuj-registry
```

**Issue**: Validation errors

```bash
# Check error details
node .claude/tools/sync-cuj-registry.mjs --validate-only
```

**Issue**: Missing CUJ metadata

- Check CUJ markdown file has proper formatting
- Ensure `## Agents Used` and `## Skills Used` sections exist
- Verify `**Execution Mode**: \`mode\`` is present

## Benefits

### 1. **Performance**

- Fast CUJ lookups (O(1) by ID, O(n) by filter)
- No need to parse 52+ markdown files on every request

### 2. **Consistency**

- Single source of truth for CUJ metadata
- Schema validation ensures data integrity

### 3. **Discoverability**

- Query CUJs by any metadata field
- Build tools and dashboards on top of registry

### 4. **Maintainability**

- Automated sync from markdown files
- Validation catches errors early

## Related Documentation

- [CUJ Index](../docs/cujs/CUJ-INDEX.md) - Overview of all CUJs
- [Workflow Guide](../workflows/WORKFLOW-GUIDE.md) - Workflow execution
- [Agent Documentation](../agents/) - Agent definitions
- [Skills Documentation](../skills/) - Skill definitions

## Version History

- **1.0.0** (2026-01-05): Initial registry implementation with 52 CUJs
