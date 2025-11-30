---
name: rule-selector
description: Analyzes project tech stack and recommends optimal rule configuration. Detects frameworks from package.json, requirements.txt, go.mod, and other config files. Generates custom manifest.yaml profiles for your specific stack.
allowed-tools: read, glob, grep, search
---

# Rule Selector

Intelligently detects your tech stack and configures optimal coding rules.

## When to Use

- Setting up rules for a new project
- Onboarding to an existing codebase
- Updating rules after adding new dependencies
- Auditing rule configuration for optimization
- Generating team-specific rule profiles

## Instructions

### Step 1: Detect Project Type

Scan for configuration files to identify the tech stack:

```bash
# Check for package managers and configs
ls -la package.json requirements.txt go.mod Cargo.toml pom.xml build.gradle composer.json Gemfile

# Check for framework-specific files
ls -la next.config.* nuxt.config.* angular.json svelte.config.* astro.config.*
```

### Step 2: Parse Dependencies

Extract framework and library information:

**Node.js/JavaScript Projects:**
```bash
# Parse package.json for key dependencies
cat package.json | jq '.dependencies + .devDependencies | keys[]' | grep -E "react|next|vue|angular|svelte"
```

**Python Projects:**
```bash
# Parse requirements.txt or pyproject.toml
cat requirements.txt | grep -E "fastapi|django|flask|pytorch|tensorflow"
```

**Go Projects:**
```bash
# Parse go.mod
cat go.mod | grep -E "gin|echo|fiber|chi"
```

### Step 3: Map to Rule Packs

Use this detection matrix to select rules:

| Detection Signal | Rule Pack(s) to Include |
|------------------|-------------------------|
| `next` in package.json | `nextjs.mdc`, `nextjs-app-router-*` |
| `react` + `typescript` | `react.mdc`, `typescript.mdc` |
| `tailwindcss` | `tailwind.mdc`, `tailwind-*` |
| `fastapi` in requirements | `fastapi.mdc`, `python-fastapi-*` |
| `django` in requirements | `python.mdc`, `django-*` |
| `vue` in package.json | `vue.mdc`, `vue3-*` |
| `@angular/core` | `angular-*.mdc` |
| `svelte` | `svelte.mdc`, `sveltekit-*` |
| `cypress` in devDependencies | `cypress-*` |
| `playwright` | `playwright-*` |
| `jest` or `vitest` | `jest-*`, `vitest-*` |
| `.go` files present | `go-*`, `backend-scalability-*` |
| `Cargo.toml` present | `rust.mdc` |

### Step 4: Generate Stack Profile

Create a custom profile in manifest.yaml:

```yaml
# Generated stack profile for: my-nextjs-app
stack_profiles:
  my-nextjs-app:
    # Auto-detected: Next.js 14 + TypeScript + Tailwind + Prisma
    include:
      # Core framework rules
      - ".claude/rules/nextjs.mdc"
      - ".claude/rules/nextjs-app-router-cursorrules-prompt-file/**/*.mdc"
      - ".claude/rules/nextjs-typescript-tailwind-cursorrules-prompt-file/**/*.mdc"

      # Language rules
      - ".claude/rules/typescript.mdc"
      - ".claude/rules/react.mdc"

      # Styling rules
      - ".claude/rules/tailwind.mdc"

      # Testing rules (detected: vitest)
      - ".claude/rules/vitest-unit-testing-cursorrules-prompt-file/**/*.mdc"

      # Code quality
      - ".claude/rules/clean-code.mdc"
      - ".claude/rules/javascript-typescript-code-quality-*/**/*.mdc"

    exclude:
      # Exclude irrelevant frameworks
      - ".claude/rules/angular-*/**"
      - ".claude/rules/vue-*/**"
      - ".claude/rules/python-*/**"
      - ".claude/rules/go-*/**"
      - ".claude/rules/swift-*/**"
      - ".claude/rules/android-*/**"

    # Priority order (first = highest priority)
    priority:
      - nextjs-app-router  # Framework-specific first
      - typescript         # Language second
      - clean-code         # Universal last

    metadata:
      generated: "2025-11-29"
      detected_stack:
        - "next@14.0.0"
        - "react@18.2.0"
        - "typescript@5.3.0"
        - "tailwindcss@3.4.0"
        - "@prisma/client@5.7.0"
```

## Detection Patterns

### Frontend Detection

```yaml
# React Ecosystem
react_detection:
  signals:
    - package.json: "react", "react-dom"
  variants:
    next: "next" in dependencies
    gatsby: "gatsby" in dependencies
    remix: "@remix-run" in dependencies
    vite_react: "vite" + "@vitejs/plugin-react"
  rules:
    base: ["react.mdc"]
    next: ["nextjs.mdc", "nextjs-app-router-*"]
    gatsby: ["gatsby-*"]

# Vue Ecosystem
vue_detection:
  signals:
    - package.json: "vue"
  variants:
    nuxt: "nuxt" in dependencies
    vue3: version >= 3.0
  rules:
    base: ["vue.mdc"]
    nuxt: ["vue3-nuxt-3-*"]
    vue3: ["vue3-composition-api-*"]

# Angular Ecosystem
angular_detection:
  signals:
    - package.json: "@angular/core"
    - angular.json exists
  rules: ["angular-typescript-*"]

# Svelte Ecosystem
svelte_detection:
  signals:
    - package.json: "svelte"
  variants:
    sveltekit: "@sveltejs/kit" in dependencies
  rules:
    base: ["svelte.mdc"]
    sveltekit: ["sveltekit-*"]
```

### Backend Detection

```yaml
# Python Ecosystem
python_detection:
  signals:
    - requirements.txt exists
    - pyproject.toml exists
    - "*.py" files present
  variants:
    fastapi: "fastapi" in requirements
    django: "django" in requirements
    flask: "flask" in requirements
    ml: "pytorch" or "tensorflow" in requirements
  rules:
    base: ["python.mdc"]
    fastapi: ["fastapi.mdc", "python-fastapi-*"]
    django: ["python-django-*"]
    ml: ["python-llm-ml-workflow-*"]

# Node.js Backend
node_backend_detection:
  signals:
    - package.json: "express" or "fastify" or "nestjs"
  rules: ["node-express.mdc", "javascript-*"]

# Go Backend
go_detection:
  signals:
    - go.mod exists
    - "*.go" files present
  rules: ["go-*", "backend-scalability-*"]
```

### Testing Detection

```yaml
testing_detection:
  e2e:
    cypress: ["cypress-e2e-testing-*", "cypress-api-testing-*"]
    playwright: ["playwright-e2e-testing-*", "playwright-api-testing-*"]
  unit:
    jest: ["jest-unit-testing-*"]
    vitest: ["vitest-unit-testing-*"]
    pytest: ["python-*"]  # Python testing included in python rules
  bdd:
    cucumber: ["gherkin-*"]
```

## Output Formats

### Format 1: Manifest Update (default)

Generates updated `.claude/rules/manifest.yaml`:

```yaml
# AUTO-GENERATED by rule-selector skill
# Project: my-nextjs-app
# Generated: 2025-11-29T10:00:00Z

stack_profiles:
  # ... generated profile ...

loading_policy:
  max_rules_files: 5  # Increased for comprehensive stack
  selection: "most_relevant"
  auto_detect: true
```

### Format 2: Recommendation Report

```markdown
## Rule Selection Report

**Project**: /path/to/my-nextjs-app
**Scan Date**: 2025-11-29

### Detected Stack

| Category | Technology | Version | Confidence |
|----------|------------|---------|------------|
| Framework | Next.js | 14.0.0 | High |
| Language | TypeScript | 5.3.0 | High |
| Styling | Tailwind CSS | 3.4.0 | High |
| Database | Prisma | 5.7.0 | High |
| Testing | Vitest | 1.0.0 | High |

### Recommended Rules

**Primary Rules** (always load):
1. `nextjs.mdc` - Next.js App Router best practices
2. `typescript.mdc` - TypeScript coding standards
3. `react.mdc` - React component patterns

**Secondary Rules** (load when relevant):
4. `tailwind.mdc` - Tailwind CSS conventions
5. `clean-code.mdc` - Universal code quality

**Testing Rules** (load during test tasks):
6. `vitest-unit-testing-*` - Unit testing patterns

### Rules NOT Recommended

These rules are excluded as irrelevant to your stack:
- `angular-*` (No Angular detected)
- `vue-*` (No Vue detected)
- `python-*` (No Python detected)
- `cypress-*` (Playwright detected instead)

### Optimization Suggestions

1. **Context Budget**: Your stack needs ~5 rule files. Current limit is 3.
   → Recommend increasing `max_rules_files` to 5

2. **Missing Coverage**: No accessibility rules detected.
   → Consider adding `accessibility-guidelines.mdc`

3. **Duplicate Coverage**: Both `nextjs.mdc` and `react.mdc` cover components.
   → `nextjs.mdc` takes priority for Next.js projects
```

### Format 3: JSON (for automation)

```json
{
  "project_path": "/path/to/my-nextjs-app",
  "scan_timestamp": "2025-11-29T10:00:00Z",
  "detected_stack": {
    "framework": {"name": "nextjs", "version": "14.0.0", "confidence": 0.95},
    "language": {"name": "typescript", "version": "5.3.0", "confidence": 1.0},
    "styling": {"name": "tailwindcss", "version": "3.4.0", "confidence": 0.9},
    "testing": {"name": "vitest", "version": "1.0.0", "confidence": 0.85}
  },
  "recommended_rules": {
    "primary": ["nextjs.mdc", "typescript.mdc", "react.mdc"],
    "secondary": ["tailwind.mdc", "clean-code.mdc"],
    "testing": ["vitest-unit-testing-cursorrules-prompt-file"]
  },
  "excluded_rules": ["angular-*", "vue-*", "python-*"],
  "manifest_updates": {
    "stack_profile_name": "my-nextjs-app",
    "include_patterns": ["..."],
    "exclude_patterns": ["..."]
  }
}
```

## Quick Commands

```
# Auto-detect and show recommendations
/select-rules

# Auto-detect and update manifest.yaml
/select-rules --apply

# Detect for specific directory
/select-rules --path ./packages/web

# Generate JSON output
/select-rules --format json

# Show what rules would be excluded
/select-rules --show-excluded

# Force re-detection (ignore cached)
/select-rules --fresh
```

## Integration with Project Setup

### New Project Workflow

```
1. User creates new project
2. Run: /select-rules --apply
3. Skill detects stack from package.json
4. Generates optimized manifest.yaml
5. Rules auto-load on next Claude session
```

### Monorepo Support

For monorepos with multiple packages:

```yaml
stack_profiles:
  monorepo_web:
    root: "packages/web"
    include: ["nextjs-*", "react-*"]

  monorepo_api:
    root: "packages/api"
    include: ["fastapi-*", "python-*"]

  monorepo_shared:
    root: "packages/shared"
    include: ["typescript.mdc", "clean-code.mdc"]
```

## Best Practices

1. **Run on Setup**: Always run rule-selector when starting a new project
2. **Update Periodically**: Re-run after major dependency changes
3. **Review Exclusions**: Check excluded rules to ensure nothing important is missed
4. **Customize Priorities**: Adjust rule priority based on team preferences
5. **Document Decisions**: Keep notes on why certain rules were included/excluded
