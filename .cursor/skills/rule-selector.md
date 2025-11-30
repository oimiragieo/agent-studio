# Rule Selector Skill

Auto-detects your tech stack and configures optimal rule loading.

## When to Use

- Setting up rules for a new project
- Onboarding to an existing codebase
- After adding new dependencies
- Optimizing rule configuration

## Invocation

```
Use @rule-selector to configure rules for this project
Use @rule-selector to detect my tech stack
Use @rule-selector to update manifest.yaml
```

## Process

1. **Detect Project Type**: Scan for package.json, requirements.txt, go.mod, etc.
2. **Parse Dependencies**: Extract framework and library versions
3. **Map to Rule Packs**: Select relevant rules, exclude irrelevant ones
4. **Generate Profile**: Create/update stack profile in manifest.yaml

## Detection Matrix

| Signal | Rule Packs |
|--------|------------|
| `next` in package.json | nextjs.mdc, nextjs-app-router-* |
| `react` + `typescript` | react.mdc, typescript.mdc |
| `tailwindcss` | tailwind.mdc, tailwind-* |
| `fastapi` in requirements | fastapi.mdc, python-fastapi-* |
| `vue` in package.json | vue.mdc, vue3-* |
| `cypress` in devDeps | cypress-* |
| `playwright` | playwright-* |

## Output

Updates `.cursor/rules/manifest.yaml`:

```yaml
stack_profiles:
  my-project:
    include:
      - "nextjs.mdc"
      - "typescript.mdc"
      - "react.mdc"
    exclude:
      - "angular-*"
      - "vue-*"
      - "python-*"
```

## Integration with Cursor

- Run on project open for auto-configuration
- Use in Plan Mode before major changes
- Sync with Claude/Factory via context-bridge

## Related Skills

- `rule-auditor` - Validate against configured rules
- `scaffolder` - Generate code following configured rules
