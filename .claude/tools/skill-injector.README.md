# Skill Injector

**Core infrastructure tool for Phase 2 skill orchestration.**

Reads `skill-integration-matrix.json` and injects required skills into agent prompts at spawn time. Provides dynamic skill discovery, trigger detection, and prompt generation for agent spawning.

## Purpose

The skill injector is the foundational tool that enables:

- **Dynamic skill loading**: Load only the skills an agent needs
- **Trigger detection**: Automatically detect which skills to activate based on task description
- **Prompt generation**: Generate skill injection prompts for agent spawning
- **Context savings**: Load 3-7 skills instead of all 45, saving 90%+ context

## Usage

### CLI Interface

```bash
# Basic injection (required skills only)
node .claude/tools/skill-injector.mjs --agent developer --task "Create new UserProfile component"

# Include recommended skills
node .claude/tools/skill-injector.mjs --agent developer --task "New component" --recommended

# List all available agents
node .claude/tools/skill-injector.mjs --list-agents

# List all skill categories
node .claude/tools/skill-injector.mjs --list-categories

# JSON output for programmatic use
node .claude/tools/skill-injector.mjs --agent orchestrator --json
```

### Programmatic API

```javascript
import { injectSkillsForAgent } from '.claude/tools/skill-injector.mjs';

// Inject skills for agent with task
const result = await injectSkillsForAgent('developer', 'Create new UserProfile component');

console.log(result.requiredSkills); // ['scaffolder', 'rule-auditor', 'repo-rag']
console.log(result.triggeredSkills); // ['scaffolder']
console.log(result.skillPrompt); // Full skill injection markdown
```

## Input/Output

### Input Parameters

| Parameter                    | Type    | Required | Description                                    |
| ---------------------------- | ------- | -------- | ---------------------------------------------- |
| `agentType`                  | string  | Yes      | Agent type (e.g., 'developer', 'orchestrator') |
| `taskDescription`            | string  | No       | Task description for trigger detection         |
| `options.includeRecommended` | boolean | No       | Include recommended skills (default: false)    |

### Output Object

```javascript
{
  success: true,
  agentType: "developer",
  taskDescription: "Create new UserProfile component",
  requiredSkills: ["scaffolder", "rule-auditor", "repo-rag"],
  recommendedSkills: ["test-generator", "claude-md-generator", "code-style-validator"],
  triggeredSkills: ["scaffolder"],
  loadedSkills: ["scaffolder", "rule-auditor", "repo-rag"],
  failedSkills: [],
  skillPrompt: "# Injected Skills\n\n...",
  metadata: {
    totalSkills: 3,
    loadedAt: "2026-01-04T21:40:00.000Z",
    loadTimeMs: 47,
    includeRecommended: false
  },
  agentConfig: {
    description: "Developer implements features...",
    usageNotes: "MUST use scaffolder for new components..."
  }
}
```

## How It Works

### 1. Load Skill Matrix

```javascript
const matrix = await loadSkillMatrix();
// Reads .claude/context/skill-integration-matrix.json
// Contains 24 agents × 45 skills mapping
```

### 2. Get Agent Configuration

```javascript
const agentSkills = await getSkillsForAgent('developer');
// Returns:
// - requiredSkills: ['scaffolder', 'rule-auditor', 'repo-rag']
// - recommendedSkills: ['test-generator', 'claude-md-generator', ...]
// - skillTriggers: { 'new_component': 'scaffolder', ... }
```

### 3. Detect Triggered Skills

```javascript
const triggeredSkills = detectTriggeredSkills(skillTriggers, taskDescription);
// Analyzes task description for trigger keywords
// Example: "Create new component" triggers 'scaffolder'
```

### 4. Load SKILL.md Content

```javascript
const content = await loadSkillContent('scaffolder');
// Reads .claude/skills/scaffolder/SKILL.md
// Returns full skill documentation
```

### 5. Generate Skill Prompt

```javascript
const skillPrompt = generateSkillPrompt(agentType, requiredSkills, triggeredSkills, skillContents);
// Generates markdown prompt with all skill documentation
// Formatted as:
// ## Required Skills
// ### Skill: scaffolder
// [SKILL.md content]
// ## Triggered Skills
// ### Skill: test-generator
// [SKILL.md content]
```

## Trigger Detection

Triggers are patterns in the task description that activate specific skills.

### How Triggers Work

1. **Trigger keywords** are defined in `skill-integration-matrix.json`:

   ```json
   "skill_triggers": {
     "new_component": "scaffolder",
     "code_changes": "rule-auditor",
     "codebase_search": "repo-rag"
   }
   ```

2. **Pattern matching**: Triggers use underscore-separated keywords
   - `new_component` → matches tasks with "new" AND "component"
   - `test_creation` → matches tasks with "test" AND "creation"

3. **Triggered skills** are automatically loaded in addition to required skills

### Examples

| Task Description                   | Triggered Skills | Reason                        |
| ---------------------------------- | ---------------- | ----------------------------- |
| "Create new UserProfile component" | scaffolder       | "new" + "component" matches   |
| "Audit code for violations"        | rule-auditor     | "code" matches                |
| "Search codebase for patterns"     | repo-rag         | "codebase" + "search" matches |
| "Test authentication flow"         | test-generator   | "test" matches                |

## Integration Points

### Workflow Runner

```javascript
// In workflow_runner.js before spawning agent
import { injectSkillsForAgent } from '.claude/tools/skill-injector.mjs';

const injection = await injectSkillsForAgent(agentType, stepTask);

// Add injection.skillPrompt to agent spawn prompt
const agentPrompt = `
${agentDefinition}

${injection.skillPrompt}

${stepTask}
`;
```

### Orchestrator

```javascript
// In orchestrator when delegating tasks
const injection = await injectSkillsForAgent('developer', taskDescription);

// Use Task tool with injected skill prompt
await spawnTask({
  subagent_type: 'developer',
  task: taskDescription,
  additional_context: injection.skillPrompt,
});
```

### Skill Trigger Detector

```javascript
// Shared trigger detection logic
import { injectSkillsForAgent } from '.claude/tools/skill-injector.mjs';

const result = await injectSkillsForAgent(agentType, taskDescription);
console.log(result.triggeredSkills); // Skills activated by task
```

## CLI Options

```
Usage:
  node skill-injector.mjs --agent <type> [--task "<description>"] [--recommended]
  node skill-injector.mjs --list-agents
  node skill-injector.mjs --list-categories
  node skill-injector.mjs --help

Options:
  --agent <type>          Agent type (e.g., developer, orchestrator)
  --task "<description>"  Task description for trigger detection (optional)
  --recommended           Include recommended skills in addition to required
  --list-agents           List all available agent types
  --list-categories       List all skill categories
  --json                  Output results as JSON
  --help, -h              Show this help message

Examples:
  # Inject skills for developer with task
  node skill-injector.mjs --agent developer --task "Create new UserProfile component"

  # Inject skills for orchestrator (required only)
  node skill-injector.mjs --agent orchestrator

  # List all available agents
  node skill-injector.mjs --list-agents

  # Get JSON output
  node skill-injector.mjs --agent qa --task "Test authentication flow" --json
```

## Error Handling

### Missing Agent Type

```javascript
const result = await injectSkillsForAgent('nonexistent-agent');
// Returns:
// {
//   success: false,
//   error: "Agent type 'nonexistent-agent' not found in skill matrix. Available agents: ..."
// }
```

### Missing SKILL.md Files

```javascript
// If SKILL.md is missing, skill is included in failedSkills
const result = await injectSkillsForAgent('developer');
console.log(result.failedSkills); // ['missing-skill']
console.log(result.skillPrompt); // Includes warning for missing skills
```

### Invalid Matrix Format

```javascript
// If skill-integration-matrix.json is invalid, throws error
try {
  await loadSkillMatrix();
} catch (error) {
  console.error('Invalid skill matrix:', error.message);
}
```

## Exported Functions

| Function                                                    | Purpose                       | Returns                 |
| ----------------------------------------------------------- | ----------------------------- | ----------------------- |
| `loadSkillMatrix()`                                         | Load skill integration matrix | Promise\<Object\>       |
| `getSkillsForAgent(agentType)`                              | Get skills for agent          | Promise\<Object\>       |
| `loadSkillContent(skillName)`                               | Load SKILL.md content         | Promise\<string\|null\> |
| `injectSkillsForAgent(agentType, taskDescription, options)` | Main injection function       | Promise\<Object\>       |
| `listAvailableAgents()`                                     | List all agent types          | Promise\<string[]\>     |
| `getSkillCategories()`                                      | Get skill categories          | Promise\<Object\>       |

## Testing

Run the test suite to validate all functionality:

```bash
node .claude/tools/test-skill-injector.mjs
```

Expected output:

```
🧪 Testing Skill Injector Programmatic API

Test 1: List available agents
✓ Found 24 agents

Test 2: List skill categories
✓ Found 12 categories

Test 3: Inject skills for developer with "new component" task
✓ Success: true
  Triggered: scaffolder

...

✅ All tests completed!
Summary:
  Total agents: 24
  Total categories: 12
  Tests passed: 7/7
```

## Performance

- **Load time**: 30-50ms for 3-7 skills
- **Context savings**: 90%+ vs loading all 45 skills
- **Prompt size**: 50-100KB for typical agent (vs 500KB+ for all skills)

## File Structure

```
.claude/
├── tools/
│   ├── skill-injector.mjs          # Main implementation
│   ├── skill-injector.README.md    # This file
│   └── test-skill-injector.mjs     # Test suite
├── context/
│   └── skill-integration-matrix.json  # Agent-skill mapping
└── skills/
    ├── scaffolder/
    │   └── SKILL.md
    ├── rule-auditor/
    │   └── SKILL.md
    └── ... (45 skills total)
```

## Phase 2 Roadmap

The skill injector is part of Phase 2 orchestration enforcement:

1. ✅ **Phase 1**: Skill integration matrix created
2. ✅ **Current**: Skill injector implemented
3. 🚧 **Next**: Integration with workflow_runner.js
4. 🚧 **Future**: Skill trigger detector CLI
5. 🚧 **Future**: Agent spawn wrapper with auto-injection

## Related Files

- `.claude/context/skill-integration-matrix.json` - Agent-skill mapping (24 agents × 45 skills)
- `.claude/skills/*/SKILL.md` - Individual skill documentation (45 skills)
- `.claude/tools/enforcement-gate.mjs` - Plan rating and security enforcement
- `.claude/tools/workflow_runner.js` - Workflow execution (will integrate skill injection)

## Troubleshooting

### "Skill matrix not found"

Ensure `.claude/context/skill-integration-matrix.json` exists:

```bash
ls .claude/context/skill-integration-matrix.json
```

### "SKILL.md not found"

Check if skill directory exists:

```bash
ls .claude/skills/scaffolder/SKILL.md
```

### "Agent type not found"

List available agents:

```bash
node .claude/tools/skill-injector.mjs --list-agents
```

### Trigger not detected

Check trigger keywords in skill-integration-matrix.json:

```bash
cat .claude/context/skill-integration-matrix.json | grep -A 10 "skill_triggers"
```

## Contributing

When adding new skills or agents:

1. **Update skill-integration-matrix.json**:
   - Add skill to agent's `required_skills` or `recommended_skills`
   - Add trigger pattern to `skill_triggers`
   - Update `skill_categories` if new category

2. **Create SKILL.md**:
   - Place in `.claude/skills/<skill-name>/SKILL.md`
   - Follow existing SKILL.md format
   - Include frontmatter metadata

3. **Test injection**:
   ```bash
   node .claude/tools/skill-injector.mjs --agent <agent> --task "<trigger task>"
   ```

## License

Part of LLM-RULES Production Pack. See root LICENSE.
