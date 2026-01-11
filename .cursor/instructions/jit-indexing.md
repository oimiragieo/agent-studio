# JIT Indexing Guide

Just-In-Time (JIT) indexing provides agents with quick navigation commands instead of loading entire codebases into context. This aligns with token efficiency principles from the hierarchical AGENTS.md system.

## Core Principles

1. **Provide paths/globs/commands, NOT full content** - Reference files, don't paste them
2. **Token efficiency** - Small, actionable guidance over encyclopedic documentation
3. **Nearest-wins hierarchy** - Agents read the closest guidance to the file being edited
4. **Quick find commands** - Use ripgrep, find, and glob patterns for discovery

## Quick Find Commands

### Code Discovery

**Find Functions:**

```bash
# TypeScript/JavaScript functions
rg -n "function\s+\w+" --type ts --type js --type tsx

# Arrow functions
rg -n "const\s+\w+\s*=\s*(\([^)]*\)\s*)?=>" --type ts --type tsx

# Class methods
rg -n "^\s*(public|private|protected)?\s*\w+\s*\(" --type ts --type java
```

**Find Components:**

```bash
# React components
rg -n "export\s+(function|const|class)\s+\w+.*Component" --type tsx --type jsx

# Vue components
find . -name "*.vue" | head -20

# Angular components
rg -n "@Component" --type ts | grep -v node_modules
```

**Find API Routes:**

```bash
# Next.js API routes
rg -n "export\s+(async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH)" --type ts --type js

# Express routes
rg -n "\.(get|post|put|delete|patch)\s*\(" --type ts --type js

# FastAPI routes
rg -n "@.*\.(get|post|put|delete|patch)\s*\(" --type py
```

### File Discovery

**Configuration Files:**

```bash
# Package files
find . -maxdepth 3 -name "package.json" -o -name "package.yaml" -o -name "Cargo.toml"

# Config files
find . -name "*.config.*" -o -name ".env*" | grep -v node_modules | head -20

# Type definitions
find . -name "tsconfig.json" -o -name "pyproject.toml" -o -name "go.mod"
```

**Test Files:**

```bash
# All test files
find . -name "*.test.*" -o -name "*.spec.*" | grep -v node_modules

# Test directories
find . -type d -name "test" -o -name "tests" -o -name "__tests__" | grep -v node_modules
```

### Pattern Discovery

**Find Imports:**

```bash
# Find all imports of a module
rg -n "import.*from ['\"]module-name['\"]" --type ts --type tsx

# Find re-exports
rg -n "export\s+\*.*from" --type ts --type tsx
```

**Find Usage:**

```bash
# Find where a function is called
rg -n "functionName\s*\(" --type ts --type js

# Find where a constant is used
rg -n "CONSTANT_NAME" --type ts --type js
```

## Directory Mapping

When working with monorepos or multi-package projects:

```bash
# List workspace packages
find . -maxdepth 2 -name "package.json" -exec dirname {} \;

# Find package boundaries
rg -n "workspace:" package.json
rg -n "name.*:" package.json | head -10
```

## Agent Usage

### In Developer Agent Prompts

- Reference specific file paths: "See `src/components/Button.tsx` for pattern"
- Use JIT commands to discover patterns: "Search for similar implementations with `rg -n 'pattern'`"
- Point to examples: "Follow pattern from `apps/web/src/hooks/useAuth.ts`"

### In Architect Agent Prompts

- Map package structure: "List packages: `find . -maxdepth 2 -name package.json`"
- Find architectural patterns: "Search for service definitions: `rg -n 'class.*Service'`"

### In QA Agent Prompts

- Find test patterns: "Locate test files: `find . -name '*.test.ts'`"
- Discover test utilities: "Search test helpers: `rg -n 'testUtils'`"

## Best Practices

1. **Be Specific**: Use exact file paths in examples, not vague references
2. **Use Real Commands**: Provide copy-paste ready commands, not placeholders
3. **Reference Examples**: Always point to actual files: "Copy pattern from `path/to/file.ts`"
4. **Avoid Paste**: Reference file paths, don't paste entire files
5. **Context-Aware**: Provide commands relevant to the specific package/directory

## Integration with Cursor Features

### Symbols Navigation

- Use language server symbols for precise navigation
- Combine with JIT commands for discovery
- Reference symbol names in prompts

### Codebase Search

- Use Cursor's built-in search for quick queries
- Combine with terminal commands for complex patterns
- Leverage search results in agent context

### Plan Mode

- Include JIT commands in plans for context discovery
- Reference discovered files in plan artifacts
- Update plans with findings from JIT commands
