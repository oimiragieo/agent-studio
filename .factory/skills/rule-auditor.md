# Rule Auditor Skill

Validates code against loaded rules and reports compliance violations.

## When to Use

- After implementing features or components
- During code review with Factory droids
- Before deployment via Auto-Run
- To validate compliance gates

## Invocation

```
Run Task tool with skill rule-auditor to validate this file
Run Task tool with skill rule-auditor to check src/components/
```

Or in Specification Mode:
```
[Shift+Tab] Audit the authentication module against our coding standards
```

## Process

1. **Identify Active Rules**: Check `.factory/rules/manifest.yaml` for stack profile
2. **Scan Target Files**: Parse files in scope using droid context
3. **Extract Patterns**: Load checkable patterns from rules
4. **Generate Report**: Output violations with line numbers and fixes

## Output Format

```markdown
## Rule Audit Report

**Target**: src/components/UserAuth.tsx
**Rules Applied**: nextjs.mdc, typescript.mdc
**Droid**: qa

### Summary
- Pass: 12 rules
- Warn: 3 rules
- Fail: 2 rules

### Violations

#### FAIL: Avoid using `any`
- **File**: src/components/UserAuth.tsx:45
- **Issue**: `const user: any = await getUser()`
- **Rule**: typescript.mdc > Type System
- **Fix**: Define proper User interface
```

## Integration with Factory

- Use with qa droid for quality gates
- Run in Auto-Run mode for CI/CD validation
- Combine with pre-run hooks for automatic validation

## Related Skills

- `rule-selector` - Configure which rules to audit against
- `scaffolder` - Generate code that passes audit
- `context-router` - Route audit context appropriately
