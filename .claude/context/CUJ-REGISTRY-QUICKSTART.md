# CUJ Registry Quick Start

**Fast reference for using the CUJ Registry**

## What is it?

Single JSON file containing metadata for all 52+ Customer User Journeys (CUJs).

**Location**: `.claude/context/cuj-registry.json`

## Quick Commands

```bash
# Generate/update registry
pnpm sync-cuj-registry

# Validate only (no file write)
pnpm sync-cuj-registry:validate

# Custom output
node .claude/tools/sync-cuj-registry.mjs --output custom.json
```

## Common Queries

### 1. Find CUJ by ID

```javascript
import registry from './.claude/context/cuj-registry.json' assert { type: 'json' };

const cuj = registry.cujs.find(c => c.id === 'CUJ-002');
console.log(cuj.name, '→', cuj.primary_skill);
// Output: "Rule Configuration → rule-selector"
```

### 2. Get All Skill-Only CUJs

```javascript
const skillOnlyCUJs = registry.cujs.filter(c => c.execution_mode === 'skill-only');
console.log(`${skillOnlyCUJs.length} skill-only CUJs`);
// Output: "36 skill-only CUJs"
```

### 3. Find CUJs by Category

```javascript
const developmentCUJs = registry.cujs.filter(c => c.category === 'Development');
developmentCUJs.forEach(c => console.log(`${c.id}: ${c.name}`));
```

### 4. Find CUJs Using a Specific Skill

```javascript
const scaffolderCUJs = registry.cujs.filter(c => c.skills.includes('scaffolder'));
console.log(`${scaffolderCUJs.length} CUJs use scaffolder`);
```

### 5. Find CUJs by Trigger

```javascript
function findCUJByTrigger(userInput) {
  return registry.cujs.find(cuj =>
    cuj.triggers.some(trigger => userInput.toLowerCase().includes(trigger.toLowerCase()))
  );
}

const cuj = findCUJByTrigger('/select-rules');
console.log(cuj.id, '→', cuj.primary_skill);
// Output: "CUJ-002 → rule-selector"
```

### 6. Get Platform-Specific CUJs

```javascript
// Claude-only CUJs
const claudeOnly = registry.cujs.filter(
  c => c.platform_compatibility.claude && !c.platform_compatibility.cursor
);

// Cursor-compatible CUJs
const cursorCompatible = registry.cujs.filter(c => c.platform_compatibility.cursor);
```

### 7. Group CUJs by Execution Mode

```javascript
const byMode = registry.cujs.reduce((acc, cuj) => {
  if (!acc[cuj.execution_mode]) acc[cuj.execution_mode] = [];
  acc[cuj.execution_mode].push(cuj);
  return acc;
}, {});

console.log('Workflow CUJs:', byMode.workflow.length);
console.log('Skill-only CUJs:', byMode['skill-only'].length);
```

### 8. Find Fast CUJs (< 60 seconds)

```javascript
const fastCUJs = registry.cujs.filter(
  c => c.execution_mode === 'skill-only' || c.execution_mode === 'delegated-skill'
);
console.log(`${fastCUJs.length} CUJs execute in < 60 seconds`);
```

## Node.js Examples

### Simple Query

```bash
node -e "
const r = require('./.claude/context/cuj-registry.json');
const cuj = r.cujs.find(c => c.id === 'CUJ-002');
console.log(cuj.name, '→', cuj.primary_skill);
"
```

### Filter and Map

```bash
node -e "
const r = require('./.claude/context/cuj-registry.json');
const skillOnly = r.cujs
  .filter(c => c.execution_mode === 'skill-only')
  .map(c => ({ id: c.id, name: c.name, skill: c.primary_skill }));
console.log(JSON.stringify(skillOnly.slice(0, 3), null, 2));
"
```

## Registry Structure

```javascript
{
  "$schema": "../schemas/cuj-registry.schema.json",
  "version": "1.0.0",
  "generated": "2026-01-05T00:00:00Z",
  "total_cujs": 52,
  "cujs": [
    {
      "id": "CUJ-###",                    // Unique ID
      "name": "...",                      // Human-readable name
      "description": "...",               // User goal
      "category": "...",                  // Category
      "execution_mode": "...",            // workflow | skill-only | delegated-skill | manual-setup
      "workflow": "...",                  // Workflow file path (or null)
      "agents": [...],                    // Agents used
      "skills": [...],                    // Skills used
      "primary_skill": "...",             // Primary skill (skill-only CUJs)
      "schemas": [...],                   // Validation schemas
      "triggers": [...],                  // User triggers
      "platform_compatibility": {
        "claude": true,
        "cursor": true,
        "factory": false
      },
      "expected_outputs": [...],          // Expected results
      "estimated_duration": "...",        // Execution time
      "file_path": "..."                  // CUJ documentation
    }
  ]
}
```

## Execution Modes

| Mode              | Description             | Example                      | Duration |
| ----------------- | ----------------------- | ---------------------------- | -------- |
| `workflow`        | Multi-agent workflow    | CUJ-005 (Greenfield Project) | 2-10 min |
| `skill-only`      | Direct skill invocation | CUJ-002 (Rule Configuration) | 2-60 sec |
| `delegated-skill` | Agent-managed skill     | Custom skills                | 2-60 sec |
| `manual-setup`    | Manual user steps       | CUJ-001 (Installation)       | varies   |

## Categories

1. **Onboarding & Setup**: Installation, configuration
2. **Planning & Architecture**: Feature planning, system design
3. **Development**: Component scaffolding, API development
4. **Quality Assurance**: Code review, testing
5. **Documentation**: API docs, module docs
6. **Specialized Workflows**: Performance, security, mobile, AI
7. **Maintenance & Operations**: Dependencies, incidents
8. **Advanced Workflows**: Large documents, multi-phase projects
9. **Testing & Validation**: Validation, recovery, edge cases

## Common Use Cases

### 1. Route User Request to CUJ

```javascript
function routeUserRequest(input) {
  // Find matching CUJ by trigger
  const cuj = registry.cujs.find(c =>
    c.triggers.some(t => input.toLowerCase().includes(t.toLowerCase()))
  );

  if (!cuj) {
    return { error: 'No matching CUJ found' };
  }

  return {
    cuj_id: cuj.id,
    execution_mode: cuj.execution_mode,
    workflow: cuj.workflow,
    skill: cuj.primary_skill,
    agents: cuj.agents,
  };
}

// Example
const result = routeUserRequest('Please select rules for this project');
console.log(result);
// { cuj_id: 'CUJ-002', execution_mode: 'skill-only', skill: 'rule-selector', ... }
```

### 2. Build CUJ Menu

```javascript
function buildCUJMenu(category) {
  return registry.cujs
    .filter(c => c.category === category)
    .map(c => ({
      id: c.id,
      name: c.name,
      trigger: c.triggers[0] || 'N/A',
      duration: c.estimated_duration,
    }));
}

const menu = buildCUJMenu('Development');
console.log(menu);
```

### 3. Validate CUJ Availability

```javascript
function isCUJAvailableOnPlatform(cujId, platform) {
  const cuj = registry.cujs.find(c => c.id === cujId);
  return cuj ? cuj.platform_compatibility[platform] : false;
}

console.log(isCUJAvailableOnPlatform('CUJ-002', 'cursor')); // true
console.log(isCUJAvailableOnPlatform('CUJ-027', 'cursor')); // false (recovery skill Claude-only)
```

## Statistics

```bash
# Quick stats
node -e "
const r = require('./.claude/context/cuj-registry.json');
console.log('Total CUJs:', r.total_cujs);
console.log('Skill-only:', r.cujs.filter(c => c.execution_mode === 'skill-only').length);
console.log('Workflows:', r.cujs.filter(c => c.execution_mode === 'workflow').length);
console.log('Claude-compatible:', r.cujs.filter(c => c.platform_compatibility.claude).length);
console.log('Cursor-compatible:', r.cujs.filter(c => c.platform_compatibility.cursor).length);
"
```

## When to Sync

Sync the registry after:

- ✅ Adding new CUJs
- ✅ Modifying CUJ metadata
- ✅ Changing execution modes
- ✅ Updating skills or agents
- ✅ Renaming workflow files

```bash
pnpm sync-cuj-registry
```

## Troubleshooting

### Registry not found?

```bash
pnpm sync-cuj-registry
```

### Validation errors?

```bash
node .claude/tools/sync-cuj-registry.mjs --validate-only
```

### Missing metadata?

- Check CUJ markdown has proper formatting
- Ensure `## Agents Used` section exists
- Verify `**Execution Mode**: \`mode\`` is present

## Links

- **Full Documentation**: `.claude/context/CUJ-REGISTRY-README.md`
- **Schema**: `.claude/schemas/cuj-registry.schema.json`
- **Sync Tool**: `.claude/tools/sync-cuj-registry.mjs`
- **CUJ Documentation**: `.claude/docs/cujs/`
