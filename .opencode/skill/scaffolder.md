---
name: scaffolder
description: Generates boilerplate code following project patterns. Creates new components, modules, APIs, and features that automatically comply with coding standards.
allowed-tools: read, write, glob
---

# Rule-Aware Scaffolder

Creates new code that automatically adheres to your project's coding standards.

## When to Use

- Creating new React/Vue/Angular components
- Adding new API endpoints or routes
- Setting up new modules or packages
- Generating test files for existing code
- Creating data models or database schemas
- Bootstrapping feature directories

## Instructions

### Step 1: Identify Target Framework

Determine which patterns apply based on what you're scaffolding:

```
Component → React patterns, TypeScript conventions
API Route → Express/Next.js API patterns
Test File → Jest/Vitest patterns
Database Model → Prisma/SQL patterns
```

### Step 2: Extract Patterns from Codebase

Analyze existing code to understand:

- File naming conventions
- Directory structure
- Import patterns
- Component structure
- Error handling patterns
- Testing patterns

### Step 3: Generate Compliant Code

Apply extracted patterns to generate code that matches project conventions.

## Scaffold Templates

### React Component

**Command**: `scaffold component UserProfile`

**Generated Structure**:

```
components/user-profile/
├── index.tsx          # Main component
├── types.ts           # Type definitions
├── styles.module.css  # Component styles
└── index.test.tsx     # Component tests
```

### API Route

**Command**: `scaffold api users`

**Generated Structure**:

```
routes/users/
├── index.ts           # Route handlers
├── schema.ts          # Validation schemas
├── service.ts         # Business logic
└── index.test.ts      # Route tests
```

### Feature Module

**Command**: `scaffold feature user-management`

**Generated Structure**:

```
features/user-management/
├── components/
├── hooks/
├── services/
├── types/
└── index.ts
```

## Available Templates

| Template    | Files Generated                  |
| ----------- | -------------------------------- |
| `component` | index.tsx, types.ts, tests       |
| `page`      | page.tsx, loading.tsx, error.tsx |
| `api`       | route.ts, schema.ts, service.ts  |
| `hook`      | useHookName.ts, tests            |
| `context`   | Context provider + hook          |
| `test`      | Test file for component          |
| `model`     | Database model                   |

## Best Practices

1. **Always Audit After**: Review generated code
2. **Customize Templates**: Adapt to project patterns
3. **Use for Consistency**: Scaffold even simple files
4. **Review Generated Code**: Starting point, not final
