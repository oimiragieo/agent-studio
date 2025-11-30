# Command: /select-rules

Auto-detect your project's tech stack and configure optimal coding rules.

## Usage

```
/select-rules              # Detect stack and show recommendations
/select-rules --apply      # Detect and update manifest.yaml automatically
/select-rules --format json # Output as JSON for automation
```

## What This Command Does

Invokes the **rule-selector** skill to:

1. **Scan Configuration Files**
   - package.json, requirements.txt, go.mod, Cargo.toml
   - next.config.*, nuxt.config.*, angular.json, svelte.config.*
   - tsconfig.json, pyproject.toml, composer.json

2. **Detect Tech Stack**
   - Identifies frameworks (Next.js, React, Vue, FastAPI, etc.)
   - Detects testing tools (Jest, Vitest, Cypress, Playwright)
   - Finds styling approaches (Tailwind, CSS Modules, Styled Components)

3. **Map to Rule Packs**
   - Selects relevant rules from `.claude/rules/`
   - Excludes irrelevant frameworks (no Vue rules for React projects)
   - Sets priority order (framework-specific > language > universal)

4. **Generate Stack Profile**
   - Creates or updates `.claude/rules/manifest.yaml`
   - Documents detected stack with confidence scores
   - Lists included and excluded rule patterns

## Output Format

### Recommendation Report (default)

```markdown
## Rule Selection Report

**Project**: /path/to/my-app
**Detected Stack**: Next.js 14 + TypeScript + Tailwind

### Recommended Rules
1. nextjs.mdc (primary)
2. typescript.mdc (language)
3. react.mdc (framework patterns)
4. tailwind.mdc (styling)
5. clean-code.mdc (universal)

### Excluded (not relevant)
- angular-* (No Angular detected)
- vue-* (No Vue detected)
- python-* (No Python detected)
```

### JSON Format (with --format json)

```json
{
  "detected_stack": {...},
  "recommended_rules": [...],
  "excluded_rules": [...],
  "manifest_updates": {...}
}
```

## When to Use

- Setting up a new project
- Onboarding to an existing codebase
- After adding major new dependencies
- Auditing rule configuration for optimization

## See Also

- `/audit` - Validate code against configured rules
- `/scaffold` - Generate rule-compliant boilerplate
