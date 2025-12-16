# Command: /select-rules

Auto-detect your project's tech stack and configure optimal coding rules.

## Usage

```
/select-rules              # Detect stack and show recommendations
/select-rules --apply      # Detect and update configuration automatically
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
   - Finds styling approaches (Tailwind, CSS Modules)

3. **Map to Rule Packs**
   - Selects relevant coding standards
   - Excludes irrelevant frameworks
   - Sets priority order

4. **Generate Stack Profile**
   - Documents detected stack with confidence scores
   - Lists included and excluded patterns

## Output Format

### Recommendation Report (default)

```markdown
## Rule Selection Report

**Project**: /path/to/my-app
**Detected Stack**: Next.js 14 + TypeScript + Tailwind

### Recommended Rules
1. Next.js patterns (primary)
2. TypeScript conventions (language)
3. React patterns (framework)
4. Tailwind conventions (styling)

### Excluded (not relevant)
- Angular patterns (No Angular detected)
- Vue patterns (No Vue detected)
- Python patterns (No Python detected)
```

## When to Use

- Setting up a new project
- Onboarding to an existing codebase
- After adding major new dependencies
- Auditing configuration for optimization

## See Also

- `/audit` - Validate code against configured rules
- `/scaffold` - Generate compliant boilerplate
