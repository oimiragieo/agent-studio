# Rule Auditor Skill

Validates code against loaded rules and reports compliance violations.

## When to Use

- After implementing features or components
- During code review
- Before committing changes
- To check standards compliance

## Invocation

```
Use @rule-auditor to validate this file
Use @rule-auditor to check src/components/
Use @rule-auditor to audit against nextjs rules
```

## Process

1. **Identify Active Rules**: Check `.cursor/rules/manifest.yaml` for stack profile
2. **Scan Target Files**: Parse files in scope
3. **Extract Patterns**: Load checkable patterns from .mdc rules
4. **Generate Report**: Output violations with line numbers and fixes

## Output Format

```markdown
## Rule Audit Report

**Target**: src/components/UserAuth.tsx
**Rules Applied**: nextjs.mdc, typescript.mdc

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

## Integration with Cursor

- Run after Composer edits complete
- Use in Plan Mode for pre-implementation validation
- Integrate with Cloud Agents for CI/CD validation

## Related Skills

- `rule-selector` - Configure which rules to audit against
- `scaffolder` - Generate code that passes audit
