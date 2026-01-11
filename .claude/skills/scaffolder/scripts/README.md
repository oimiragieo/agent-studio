# Scaffolder Scripts

This directory contains executable scripts for the scaffolder skill, enabling programmatic code generation with rule compliance.

## Files

- **scaffold.mjs** - Main scaffolder executable
- **test-scaffold.mjs** - Test suite for scaffolder
- **README.md** - This file

## Installation

No installation required. Uses Node.js built-ins only.

## Usage

### Basic Usage

```bash
# Scaffold a component
node scaffold.mjs component UserProfile

# Scaffold with custom path
node scaffold.mjs component UserProfile --path src/features/auth

# List available templates
node scaffold.mjs --list

# Show help
node scaffold.mjs --help
```

### Available Templates

| Template           | Description                      | Technologies                    |
| ------------------ | -------------------------------- | ------------------------------- |
| `component`        | Next.js Server Component         | nextjs, react, typescript       |
| `client-component` | Next.js Client Component         | nextjs, react, typescript       |
| `api`              | Next.js API Route (App Router)   | nextjs, typescript              |
| `test`             | Test file for existing component | jest, vitest, react, typescript |
| `feature`          | Complete feature module          | nextjs, react, typescript       |
| `hook`             | Custom React hook                | react, typescript               |
| `context`          | React Context provider           | react, typescript               |
| `fastapi-route`    | FastAPI router                   | fastapi, python, pydantic       |

### Examples

**Server Component**:

```bash
node scaffold.mjs component UserProfile
# Generates:
# - components/user-profile/index.tsx
# - components/user-profile/content.tsx
# - components/user-profile/skeleton.tsx
# - components/user-profile/types.ts
```

**Client Component**:

```bash
node scaffold.mjs client-component SearchBar
# Generates:
# - components/search-bar/index.tsx (with 'use client')
# - components/search-bar/types.ts
```

**API Route**:

```bash
node scaffold.mjs api users
# Generates:
# - app/api/users/route.ts (with GET and POST handlers)
```

**Feature Module**:

```bash
node scaffold.mjs feature user-management
# Generates:
# - app/(dashboard)/user-management/page.tsx
# - app/(dashboard)/user-management/components/user-management-list.tsx
# - lib/user-management/types.ts
# - lib/user-management/api.ts
```

**Test File**:

```bash
node scaffold.mjs test src/components/Button.tsx
# Generates:
# - src/components/__tests__/Button.test.tsx
```

**Custom Hook**:

```bash
node scaffold.mjs hook useCounter
# Generates:
# - hooks/use-counter.ts
```

**Context Provider**:

```bash
node scaffold.mjs context Theme
# Generates:
# - contexts/theme/index.tsx (with ThemeProvider and useTheme)
```

**FastAPI Route**:

```bash
node scaffold.mjs fastapi-route products
# Generates:
# - app/routers/products.py
```

## Output Format

All commands output JSON conforming to `.claude/schemas/skill-scaffolder-output.schema.json`:

```json
{
  "skill_name": "scaffolder",
  "template_type": "component",
  "component_type": "UserProfile",
  "files_generated": [
    {
      "path": "/absolute/path/to/components/user-profile/index.tsx",
      "type": "component",
      "lines_of_code": 25
    }
  ],
  "patterns_applied": ["Server Component pattern", "Suspense boundary pattern"],
  "rules_loaded": ["TECH_STACK_NEXTJS", "LANG_TYPESCRIPT"],
  "rule_index_consulted": true,
  "technology_stack": ["nextjs", "react", "typescript"],
  "template_used": "component",
  "supporting_files": [
    "/absolute/path/to/components/user-profile/content.tsx",
    "/absolute/path/to/components/user-profile/skeleton.tsx",
    "/absolute/path/to/components/user-profile/types.ts"
  ],
  "timestamp": "2026-01-04T12:00:00.000Z"
}
```

## How It Works

1. **Load Rule Index**: Reads `.claude/context/rule-index.json` for rule discovery
2. **Detect Technology Stack**: Analyzes `package.json` to detect technologies
3. **Query Relevant Rules**: Uses rule index to find applicable rules (progressive disclosure)
4. **Extract Patterns**: Parses rule files for templates, code examples, and conventions
5. **Generate Code**: Applies patterns to templates for rule-compliant output
6. **Write Files**: Creates files with proper directory structure
7. **Validate Output**: Ensures output conforms to schema
8. **Return JSON**: Outputs verification data for automation

## Rule Integration

The scaffolder automatically discovers and applies rules from the rule index:

- Queries `technology_map` for relevant rules (e.g., `nextjs`, `react`, `typescript`)
- Prioritizes master rules over library rules
- Extracts patterns from `<template>` blocks and code examples
- Applies conventions mentioned in rule text
- Validates generated code can pass `rule-auditor`

Example patterns extracted:

- "Server Component pattern" - Use async Server Components by default
- "Client Component pattern" - Add 'use client' for interactive components
- "Suspense boundary pattern" - Wrap async components in Suspense

## Testing

Run the test suite:

```bash
node test-scaffold.mjs
```

Tests verify:

- All templates generate correct files
- Output conforms to schema
- Rule index is consulted
- Files contain expected patterns
- Name case conversions work correctly
- Custom paths are respected
- Help and list flags work

## Integration with Agents

Agents can invoke the scaffolder programmatically:

```javascript
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

async function scaffoldComponent(name, options = {}) {
  const args = ['component', name];
  if (options.path) {
    args.push('--path', options.path);
  }

  const { stdout } = await execFileAsync('node', [
    '.claude/skills/scaffolder/scripts/scaffold.mjs',
    ...args,
  ]);

  // Parse JSON output
  const jsonMatch = stdout.match(/\{[\s\S]*\}/);
  return JSON.parse(jsonMatch[0]);
}

// Usage
const result = await scaffoldComponent('UserProfile', { path: 'src/features/auth' });
console.log(`Generated ${result.files_generated.length} files`);
```

## Error Handling

The script provides clear error messages:

- **Missing rule index**: "Failed to load rule index. Run: pnpm index-rules"
- **Unknown template**: Lists available templates with `--list`
- **Missing arguments**: Shows help message
- **File write errors**: Reports which files failed to write
- **Schema validation warnings**: Non-blocking warnings for schema issues

## Requirements

- Node.js >= 18.0.0
- Rule index must be generated (`pnpm index-rules`)
- No external dependencies (uses Node.js built-ins)

## Advanced Usage

### Custom Template Creation

To add a new template, edit `scaffold.mjs`:

1. Add template to `TEMPLATES` registry:

```javascript
const TEMPLATES = {
  'my-template': {
    description: 'My custom template',
    technologies: ['nextjs', 'react'],
    handler: scaffoldMyTemplate,
  },
};
```

2. Implement handler function:

```javascript
async function scaffoldMyTemplate(name, patterns, options) {
  const pascalName = toPascalCase(name);
  const basePath = options.path || `my-components/${toKebabCase(name)}`;

  const files = [
    {
      path: `${basePath}/index.tsx`,
      type: 'component',
      content: `// Template content here`,
    },
  ];

  return { files, basePath, componentName: pascalName };
}
```

3. Add tests in `test-scaffold.mjs`

### Integration with CI/CD

Use in CI/CD pipelines for automated code generation:

```yaml
# .github/workflows/scaffold.yml
name: Generate Boilerplate
on:
  workflow_dispatch:
    inputs:
      template:
        description: 'Template type'
        required: true
      name:
        description: 'Component name'
        required: true

jobs:
  scaffold:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - name: Generate code
        run: |
          node .claude/skills/scaffolder/scripts/scaffold.mjs \
            ${{ github.event.inputs.template }} \
            ${{ github.event.inputs.name }}
      - name: Commit changes
        run: |
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          git add .
          git commit -m "Generate ${{ github.event.inputs.name }}"
          git push
```

## Troubleshooting

**"Failed to load rule index"**:

- Run `pnpm index-rules` to generate the index
- Ensure `.claude/context/rule-index.json` exists

**"No patterns applied"**:

- Check that rules exist for your technology stack
- Verify rules contain `<template>` blocks or code examples
- Run `pnpm index-rules` to refresh the index

**"File write failed"**:

- Check directory permissions
- Ensure parent directories exist (script creates them automatically)
- Verify disk space

**"Schema validation failed"**:

- This is usually a warning, not an error
- Ensure output includes all required fields
- Check that `files_generated` is not empty

## Contributing

To contribute new templates or improvements:

1. Add template handler to `scaffold.mjs`
2. Add tests to `test-scaffold.mjs`
3. Update this README with examples
4. Update main SKILL.md with usage notes
5. Run tests to ensure compatibility

## License

MIT
