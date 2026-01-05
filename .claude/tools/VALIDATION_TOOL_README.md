# Configuration Validation Tool

## Overview

The `validate-configuration.mjs` tool provides comprehensive validation of the LLM-RULES project configuration for CI/CD integration. It catches configuration drift and mismatches across agents, workflows, skills, schemas, and tool permissions.

## Usage

```bash
# Run all validations
node .claude/tools/validate-configuration.mjs

# Run specific validation
node .claude/tools/validate-configuration.mjs --check agents
node .claude/tools/validate-configuration.mjs --check skills
node .claude/tools/validate-configuration.mjs --check schemas
node .claude/tools/validate-configuration.mjs --check workflows
node .claude/tools/validate-configuration.mjs --check permissions

# Output as JSON (for CI/CD integration)
node .claude/tools/validate-configuration.mjs --format json

# Show help
node .claude/tools/validate-configuration.mjs --help
```

## Exit Codes

- **0**: All validations passed
- **1**: One or more validations failed

This makes it suitable for use in CI/CD pipelines.

## Validation Categories

### 1. Agent Consistency

Validates that agents are consistently defined across:
- `config.yaml` (agent_routing section)
- `.claude/agents/*.md` (agent definition files)
- `.claude/tools/agent-routing-matrix.json` (routing matrix)
- `.claude/workflows/*.yaml` (workflow files)

**Checks**:
- All workflow agents exist in config.yaml
- All routing matrix agents exist in config.yaml
- All config agents have corresponding .md files
- All workflow agents are in routing matrix (except planner)
- No orphaned agents in config

**Sample Output**:
```
Agent Consistency: ✗ FAIL

missingInConfig:
  - agent: gcp-cloud-agent
    source: workflows

missingInMatrix:
  - orchestrator
  - gcp-cloud-agent

extraInConfig:
  - master-orchestrator

Statistics:
  totalInConfig: 29
  totalFiles: 34
  totalInMatrix: 25
  totalInWorkflows: 26
```

### 2. Skill Existence

Validates that all skills referenced in documentation exist with proper SKILL.md files.

**Checks**:
- All skills referenced in CLAUDE.md exist as directories
- All skill directories have SKILL.md documentation

**Sample Output**:
```
Skill Existence: ✓ PASS
All checks passed
  totalReferenced: 7
  totalSkills: 44
```

### 3. Schema Existence

Validates that all schemas referenced in workflows exist in `.claude/schemas/`.

**Checks**:
- All workflow validation schemas exist
- Reports which workflows are affected by missing schemas

**Sample Output**:
```
Schema Existence: ✗ FAIL

missingSchemas:
  - security-review.schema.json
  - qa-signoff.schema.json

workflowsAffected:
  - workflow: quick-flow
    step: 1.5
    schema: security-review.schema.json
  - workflow: quick-flow
    step: 4
    schema: qa-signoff.schema.json

Statistics:
  totalSchemas: 47
  totalMissing: 2
```

### 4. Workflow Completeness

Validates workflow structure and completeness.

**Checks**:
- All workflows have planner at step 0
- All steps have agents assigned
- All steps with outputs have validation schemas (unless only reasoning outputs)

**Sample Output**:
```
Workflow Completeness: ✗ FAIL

incompleteWorkflows:
  - workflow: bmad-greenfield-standard
    issue: No steps defined
  - workflow: browser-testing-flow
    issue: Missing planner at step 0

Statistics:
  totalWorkflows: 14
  totalIssues: 2
```

### 5. Tool Permissions

Validates that orchestrator agents only have delegation tools.

**Checks**:
- Orchestrators (orchestrator, master-orchestrator, model-orchestrator) only have allowed tools: Task, Read, Search, Grep, Glob
- Orchestrators do NOT have: Edit, Write, Bash (implementation tools)
- All orchestrators have tool restrictions defined

**Sample Output**:
```
Tool Permissions: ✗ FAIL

violations:
  - agent: orchestrator
    issue: Orchestrator should not have access to Write
    severity: critical
    tool: Write
  - agent: model-orchestrator
    issue: Orchestrator has disallowed tools: Bash, Sequential Thinking
    severity: critical
    tools: [Bash, Sequential Thinking]

Statistics:
  totalAgents: 3
  totalViolations: 2
```

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Validate Configuration

on:
  push:
    paths:
      - '.claude/config.yaml'
      - '.claude/agents/**'
      - '.claude/workflows/**'
      - '.claude/schemas/**'
  pull_request:
    paths:
      - '.claude/config.yaml'
      - '.claude/agents/**'
      - '.claude/workflows/**'
      - '.claude/schemas/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - name: Validate Configuration
        run: node .claude/tools/validate-configuration.mjs --format json
```

### Package.json Script

Add to `package.json`:

```json
{
  "scripts": {
    "validate:config": "node .claude/tools/validate-configuration.mjs",
    "validate:config:json": "node .claude/tools/validate-configuration.mjs --format json",
    "validate:agents": "node .claude/tools/validate-configuration.mjs --check agents",
    "validate:workflows": "node .claude/tools/validate-configuration.mjs --check workflows"
  }
}
```

Then run:

```bash
npm run validate:config
npm run validate:agents
```

## JSON Output Format

When using `--format json`, the output is structured for programmatic consumption:

```json
{
  "results": [
    {
      "valid": false,
      "category": "Agent Consistency",
      "missingInConfig": [...],
      "missingFiles": [...],
      "missingInMatrix": [...],
      "extraInConfig": [...],
      "stats": {
        "totalInConfig": 29,
        "totalFiles": 34,
        "totalInMatrix": 25,
        "totalInWorkflows": 26
      }
    },
    ...
  ],
  "allValid": false
}
```

## Fixing Issues

### Agent Consistency Issues

**Missing in config.yaml**:
1. Add agent definition to `.claude/config.yaml` under `agent_routing`
2. Define trigger words, model, complexity, etc.

**Missing .md files**:
1. Create agent definition file in `.claude/agents/<agent-name>.md`
2. Use existing agent files as templates

**Missing in routing matrix**:
1. Add agent to `.claude/tools/agent-routing-matrix.json`
2. Define primary, supporting, review, approval roles

**Extra in config**:
1. Either use the agent in workflows/matrix, or remove it from config.yaml

### Schema Issues

**Missing schemas**:
1. Create schema file in `.claude/schemas/<schema-name>.json`
2. Use JSON Schema format to define structure
3. Reference existing schemas as templates

### Workflow Issues

**Missing planner**:
1. Add step 0 with agent: planner to workflow
2. Follow pattern from `quick-flow.yaml` or `greenfield-fullstack.yaml`

**Missing validation**:
1. Add validation section to workflow step
2. Reference appropriate schema file

### Tool Permission Issues

**Orchestrator has implementation tools**:
1. Remove Edit, Write, Bash from orchestrator's allowed_tools
2. Add them to restricted_tools
3. Ensure only Task, Read, Search, Grep, Glob are allowed

## Development

The validator is written in ES modules and requires Node.js 18+.

**Dependencies**:
- `js-yaml`: For parsing YAML files
- Node.js built-in modules: fs, path, url

**Testing locally**:
```bash
# Test specific validation
node .claude/tools/validate-configuration.mjs --check agents

# Test all validations
node .claude/tools/validate-configuration.mjs

# Test JSON output
node .claude/tools/validate-configuration.mjs --format json
```

## Architecture

The validator is organized into modular validation functions:

1. **validateAgentConsistency()**: Checks agent definitions across all sources
2. **validateSkillExistence()**: Ensures skills have proper documentation
3. **validateSchemaExistence()**: Verifies workflow schemas exist
4. **validateWorkflowCompleteness()**: Validates workflow structure
5. **validateToolPermissions()**: Enforces orchestrator tool restrictions

Each function returns a validation result object with:
- `valid`: boolean
- `category`: string
- Issue arrays (e.g., `missingInConfig`, `violations`)
- `stats`: object with counts

## Future Enhancements

Potential improvements:
- Validate skill references in agent definitions
- Check for circular dependencies in agent chains
- Validate template variable usage in workflows
- Check for orphaned schema files
- Validate workflow triggers match config.yaml keywords
- Performance benchmarks for large configurations
