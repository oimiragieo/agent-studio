---
name: rule-selector
description: Analyzes project tech stack and recommends optimal rule configuration. Detects frameworks from package.json, requirements.txt, go.mod, and other config files.
allowed-tools: read, glob, grep
---

# Rule Selector

Intelligently detects your tech stack and configures optimal coding rules.

## When to Use

- Setting up rules for a new project
- Onboarding to an existing codebase
- Updating rules after adding new dependencies
- Auditing rule configuration for optimization

## Instructions

### Step 1: Detect Project Type

Scan for configuration files to identify the tech stack:

```bash
# Check for package managers and configs
ls package.json requirements.txt go.mod Cargo.toml pom.xml

# Check for framework-specific files
ls next.config.* nuxt.config.* angular.json svelte.config.*
```

### Step 2: Parse Dependencies

**Node.js/JavaScript Projects:**
- Parse package.json for key dependencies
- Look for react, next, vue, angular, svelte

**Python Projects:**
- Parse requirements.txt or pyproject.toml
- Look for fastapi, django, flask, pytorch, tensorflow

**Go Projects:**
- Parse go.mod
- Look for gin, echo, fiber, chi

### Step 3: Map to Rule Packs

| Detection Signal | Rule Pack(s) to Include |
|------------------|-------------------------|
| `next` in package.json | Next.js, React, TypeScript |
| `react` + `typescript` | React, TypeScript |
| `tailwindcss` | Tailwind CSS conventions |
| `fastapi` in requirements | FastAPI, Python |
| `django` in requirements | Django, Python |
| `vue` in package.json | Vue.js conventions |

### Step 4: Generate Stack Profile

Create a configuration that:
- Includes relevant framework rules
- Excludes irrelevant rules
- Sets priority order
- Documents detected stack

## Detection Patterns

### Frontend Detection
- React: package.json contains "react"
- Next.js: package.json contains "next"
- Vue: package.json contains "vue"
- Angular: angular.json exists
- Svelte: svelte.config.* exists

### Backend Detection
- Python/FastAPI: requirements.txt contains "fastapi"
- Python/Django: requirements.txt contains "django"
- Node/Express: package.json contains "express"
- Go: go.mod exists

### Testing Detection
- Cypress: devDependencies contains "cypress"
- Playwright: devDependencies contains "playwright"
- Jest: devDependencies contains "jest"
- Vitest: devDependencies contains "vitest"

## Output

Provides:
1. Detected technology stack
2. Recommended rules to apply
3. Rules to exclude
4. Configuration suggestions
