# Rule Selector Skill

Auto-detects your tech stack and configures optimal rule loading.

## When to Use

- Setting up rules for a new project
- Onboarding to an existing codebase
- After adding new dependencies
- Optimizing rule configuration for droids

## Invocation

```
Run Task tool with skill rule-selector to configure rules
Run Task tool with skill rule-selector to detect tech stack
```

Or in Specification Mode:

```
[Shift+Tab] Configure the optimal rules for this Next.js project
```

## Process

1. **Detect Project Type**: Scan for package.json, requirements.txt, go.mod
2. **Parse Dependencies**: Extract framework and library versions
3. **Map to Rule Packs**: Select relevant rules, exclude irrelevant ones
4. **Generate Profile**: Create/update stack profile in manifest.yaml

## Detection Matrix

| Signal                    | Rule Packs                       |
| ------------------------- | -------------------------------- |
| `next` in package.json    | nextjs.mdc, nextjs-app-router-\* |
| `react` + `typescript`    | react.mdc, typescript.mdc        |
| `fastapi` in requirements | fastapi.mdc, python-fastapi-\*   |
| `go.mod` present          | go-_, backend-scalability-_      |

## Output

Updates `.factory/rules/manifest.yaml`:

```yaml
stack_profiles:
  my-project:
    include:
      - 'nextjs.mdc'
      - 'typescript.mdc'
    exclude:
      - 'angular-*'
      - 'python-*'
    priority:
      - nextjs-app-router
      - typescript
```

## Integration with Factory

- Run on project initialization
- Use with architect droid for technology decisions
- Sync with Claude/Cursor via context-bridge

## Related Skills

- `rule-auditor` - Validate against configured rules
- `scaffolder` - Generate code following configured rules
- `context-router` - Route rule context to appropriate droids
