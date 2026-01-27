# Skill Structure Standard

This document defines the standardized structure for skills in the Claude Code framework.

## Required Directory Structure

```
.claude/skills/<skill-name>/
├── SKILL.md              # REQUIRED: Skill definition with YAML frontmatter
├── scripts/              # RECOMMENDED: Executable scripts
│   ├── main.cjs          # Primary script (CommonJS for Node compatibility)
│   ├── executor.cjs      # MCP executor (for converted MCP servers)
│   └── *.mjs             # ES modules if needed
├── hooks/                # OPTIONAL: Skill-specific hooks
│   ├── pre-execute.cjs   # Runs before skill execution
│   └── post-execute.cjs  # Runs after skill execution
├── schemas/              # OPTIONAL: Validation schemas
│   ├── input.schema.json # Input validation schema
│   └── output.schema.json# Output validation schema
├── references/           # OPTIONAL: Reference materials
│   ├── examples/         # Example files
│   └── docs/             # Additional documentation
├── templates/            # OPTIONAL: Template files the skill generates
│   └── *.template.md     # Template files
└── tests/                # OPTIONAL: Skill tests
    └── *.test.mjs        # Test files
```

## Hooks Structure

Skills can include hooks that run before and/or after skill execution.

### Hooks Directory

```
hooks/
├── pre-execute.cjs   # Runs before skill execution (validation, setup)
└── post-execute.cjs  # Runs after skill execution (cleanup, logging)
```

### Pre-Execute Hook Template

```javascript
#!/usr/bin/env node

/**
 * Pre-Execute Hook - Validates input before skill runs
 * Receives skill invocation context as JSON in process.argv[2]
 */

const input = JSON.parse(process.argv[2] || '{}');

console.log('[SKILL-NAME] Pre-execute validation...');

function validateInput(input) {
  const errors = [];
  // Add validation logic here
  return errors;
}

const errors = validateInput(input);
if (errors.length > 0) {
  console.error('Validation failed:', errors);
  process.exit(1);
}

console.log('[SKILL-NAME] Validation passed');
process.exit(0);
```

### Post-Execute Hook Template

```javascript
#!/usr/bin/env node

/**
 * Post-Execute Hook - Runs after skill completes
 * Receives skill execution result as JSON in process.argv[2]
 */

const result = JSON.parse(process.argv[2] || '{}');

console.log('[SKILL-NAME] Post-execute processing...');

// Add post-processing logic: logging, notifications, memory updates, etc.

process.exit(0);
```

### Hooks Registration

Register hooks in `.claude/settings.json` to enable them:

```bash
# Register hooks for an existing skill
node .claude/skills/skill-creator/scripts/create.cjs --register-hooks "skill-name"
```

Or create skill with hooks and register in one command:

```bash
node .claude/skills/skill-creator/scripts/create.cjs \
  --name "my-skill" \
  --description "My skill description here" \
  --hooks --register-hooks
```

Manual registration in `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/skills/<skill-name>/hooks/pre-execute.cjs"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/skills/<skill-name>/hooks/post-execute.cjs"
          }
        ]
      }
    ]
  }
}
```

## Schemas Structure

Skills can include JSON schemas for input/output validation.

### Schemas Directory

```
schemas/
├── input.schema.json   # Validates skill input parameters
└── output.schema.json  # Validates skill output format
```

### Input Schema Template

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "skill-name Input Schema",
  "description": "Input validation schema for skill-name",
  "type": "object",
  "required": ["requiredField"],
  "properties": {
    "requiredField": {
      "type": "string",
      "description": "A required input field"
    },
    "optionalField": {
      "type": "number",
      "description": "An optional input field"
    }
  },
  "additionalProperties": true
}
```

### Output Schema Template

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "skill-name Output Schema",
  "description": "Output validation schema for skill-name",
  "type": "object",
  "required": ["success"],
  "properties": {
    "success": {
      "type": "boolean",
      "description": "Whether the skill executed successfully"
    },
    "result": {
      "type": "object",
      "description": "The skill execution result"
    },
    "error": {
      "type": "string",
      "description": "Error message if execution failed"
    }
  },
  "additionalProperties": true
}
```

### Schema Registration

Register schemas globally in `.claude/schemas/` for cross-skill validation:

```bash
# Register schemas for an existing skill
node .claude/skills/skill-creator/scripts/create.cjs --register-schemas "skill-name"
```

Or create skill with schemas and register in one command:

```bash
node .claude/skills/skill-creator/scripts/create.cjs \
  --name "my-skill" \
  --description "My skill description here" \
  --schemas --register-schemas
```

Manual registration (copy to global schemas):

```bash
# Copy skill schemas to global schemas directory
cp .claude/skills/<skill-name>/schemas/input.schema.json \
   .claude/schemas/skill-<skill-name>-input.schema.json

cp .claude/skills/<skill-name>/schemas/output.schema.json \
   .claude/schemas/skill-<skill-name>-output.schema.json
```

## CLI Commands Summary

```bash
# Create skill with all optional components
node .claude/skills/skill-creator/scripts/create.cjs \
  --name "my-skill" \
  --description "Description of what this skill does" \
  --tools "Read,Write,Bash" \
  --refs                    # Create references/ directory
  --hooks                   # Create hooks/ directory
  --schemas                 # Create schemas/ directory
  --register-hooks          # Register hooks in settings.json
  --register-schemas        # Register schemas globally

# Register hooks for existing skill
node .claude/skills/skill-creator/scripts/create.cjs --register-hooks "skill-name"

# Register schemas for existing skill
node .claude/skills/skill-creator/scripts/create.cjs --register-schemas "skill-name"

# Validate skill structure
node .claude/skills/skill-creator/scripts/create.cjs --validate ".claude/skills/skill-name"

# Show this structure documentation
node .claude/skills/skill-creator/scripts/create.cjs --show-structure
```

## SKILL.md Structure

### Required YAML Frontmatter

```yaml
---
name: skill-name                    # REQUIRED: lowercase-with-hyphens
description: What this skill does   # REQUIRED: min 20 chars
version: 1.0                        # RECOMMENDED
model: sonnet                       # OPTIONAL: sonnet|opus|haiku|inherit
invoked_by: both                    # OPTIONAL: user|agent|both
user_invocable: true                # OPTIONAL: boolean
tools: [Read, Write, Bash]          # RECOMMENDED: tools used
args: "<required> [optional]"       # OPTIONAL: argument format
best_practices:                     # OPTIONAL
  - Practice 1
  - Practice 2
error_handling: graceful            # OPTIONAL: graceful|strict|warn
streaming: supported                # OPTIONAL: supported|required|disabled
---
```

### Required Sections

```markdown
# Skill Name

<identity>
One-line description of this skill's purpose.
</identity>

<capabilities>
- Capability 1
- Capability 2
- Capability 3
</capabilities>

<instructions>
<execution_process>
### Step 1: [First Step]
Description of what to do.

### Step 2: [Second Step]
Description of what to do.

### Step 3: [Final Step]
Description of what to do.
</execution_process>

<best_practices>
1. **Practice Name**: Description
2. **Practice Name**: Description
</best_practices>
</instructions>

<examples>
<code_example>
**Example Title**

\`\`\`language
// code example
\`\`\`
</code_example>

<usage_example>
**Example Commands**:

\`\`\`bash
# Example command
node .claude/skills/<skill-name>/scripts/main.cjs --option value
\`\`\`
</usage_example>
</examples>

## Memory Protocol (MANDATORY)

**Before starting:**
\`\`\`bash
cat .claude/context/memory/learnings.md
\`\`\`

**After completing:**
- New pattern -> `.claude/context/memory/learnings.md`
- Issue found -> `.claude/context/memory/issues.md`
- Decision made -> `.claude/context/memory/decisions.md`

> ASSUME INTERRUPTION: If it's not in memory, it didn't happen.
```

## Script Standards

### CommonJS Script (main.cjs)

```javascript
#!/usr/bin/env node

/**
 * <Skill Name> - Main Script
 *
 * Usage:
 *   node main.cjs [options]
 *
 * Options:
 *   --help     Show help
 *   --option   Description
 */

const fs = require('fs');
const path = require('path');

// Find project root
function findProjectRoot() {
  let dir = __dirname;
  while (dir !== path.parse(dir).root) {
    if (fs.existsSync(path.join(dir, '.claude'))) {
      return dir;
    }
    if (path.basename(dir) === '.claude') {
      return path.dirname(dir);
    }
    dir = path.dirname(dir);
  }
  return process.cwd();
}

const PROJECT_ROOT = findProjectRoot();
const CLAUDE_DIR = path.join(PROJECT_ROOT, '.claude');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {};
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) {
    const key = args[i].slice(2);
    const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
    options[key] = value;
  }
}

// Main logic
function main() {
  if (options.help) {
    console.log('Usage: node main.cjs [options]');
    process.exit(0);
  }

  // Skill logic here
  console.log('Skill executed successfully');
}

main();
```

### ES Module Script (main.mjs)

```javascript
#!/usr/bin/env node

/**
 * <Skill Name> - Main Script (ES Module)
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Find project root
function findProjectRoot() {
  let dir = __dirname;
  while (dir !== path.parse(dir).root) {
    if (existsSync(join(dir, '.claude'))) {
      return dir;
    }
    dir = dirname(dir);
  }
  return process.cwd();
}

// Main logic
async function main() {
  // Skill logic here
}

main().catch(console.error);
```

## Conversion Standards

When converting external codebases to skills:

1. **Analyze the source code** to understand capabilities
2. **Map to standardized structure** using this template
3. **Extract core logic** into scripts/
4. **Document capabilities** in SKILL.md sections
5. **Add examples** from source code
6. **Include Memory Protocol** section
7. **Run pnpm format** on all created files

## Validation Checklist

### Required
- [ ] SKILL.md exists with valid YAML frontmatter
- [ ] `name` field is lowercase-with-hyphens
- [ ] `description` is at least 20 characters
- [ ] Has `<identity>` section
- [ ] Has `<capabilities>` section
- [ ] Has `<instructions>` section
- [ ] Has `<examples>` section
- [ ] Has Memory Protocol section

### Scripts
- [ ] Scripts have proper shebang (#!/usr/bin/env node)
- [ ] Scripts use CommonJS (.cjs) or ES Modules (.mjs) extension
- [ ] Main script handles --help flag

### Hooks (if present)
- [ ] Hooks directory contains pre-execute.cjs and/or post-execute.cjs
- [ ] Hook scripts have proper shebang
- [ ] Hook scripts exit with code 0 on success, 1 on failure
- [ ] Hooks registered in settings.json (if needed)

### Schemas (if present)
- [ ] Schemas directory contains input.schema.json and/or output.schema.json
- [ ] Schemas follow JSON Schema draft 2020-12
- [ ] Schemas have title and description
- [ ] Schemas registered globally (if needed)

### Quality
- [ ] All files pass `pnpm format`
- [ ] No hardcoded paths (use findProjectRoot())
- [ ] Error handling is graceful
