<command_description>
Command: /scaffold - Generate rule-compliant boilerplate code for your project.
</command_description>

<instructions>
<execution_steps>

```
/scaffold component UserProfile      # Server Component (Next.js)
/scaffold client-component SearchBar # Client Component
/scaffold api users                  # API route
/scaffold test path/to/component     # Test file
/scaffold e2e-test user-flow         # E2E test
/scaffold --list                     # List available templates
```

## What This Command Does

Invokes the **scaffolder** skill to:

1. **Identify Target Framework**
   - Reads your stack profile from manifest.yaml
   - Loads relevant rules (nextjs.mdc, typescript.mdc, etc.)
   - Extracts coding patterns and conventions

2. **Generate Compliant Code**
   - Creates files following your project's standards
   - Applies naming conventions automatically
   - Includes proper types, imports, and structure

3. **Create Supporting Files**
   - Types definitions (types.ts)
   - Loading states (skeleton.tsx, loading.tsx)
   - Test files (__tests__/*.test.tsx)

## Available Templates

| Template | Framework | Files Generated |
|----------|-----------|-----------------|
| `component` | Next.js/React | index.tsx, types.ts, skeleton.tsx |
| `client-component` | Next.js | index.tsx with 'use client' |
| `page` | Next.js App Router | page.tsx, loading.tsx, error.tsx |
| `api` | Next.js App Router | route.ts with handlers |
| `fastapi-route` | FastAPI | router file with endpoints |
| `hook` | React | Custom hook with types |
| `context` | React | Context provider + hook |
| `test` | Jest/Vitest | Test file for component |
| `e2e-test` | Cypress/Playwright | E2E test spec |
| `feature` | Full-stack | Complete feature module |

## Examples

### Create a Server Component

```
/scaffold component UserProfile
```

Generates:
```
components/user-profile/
  index.tsx      # Server Component with Suspense
  content.tsx    # Async content component
  skeleton.tsx   # Loading skeleton
  types.ts       # TypeScript interfaces
```

### Create an API Route

```
/scaffold api users
```

Generates:
```
app/api/users/route.ts
  - GET handler with pagination
  - POST handler with Zod validation
  - Proper error handling
  - TypeScript types
```

### Create a Test File

```
/scaffold test components/user-profile
```

Generates:
```
components/user-profile/__tests__/index.test.tsx
  - Import statements
  - Mock setup
  - Test cases for happy path
  - Error handling tests
```

## Options

```
--path <dir>     # Generate in specific location
--rules <list>   # Use specific rules (comma-separated)
--list           # Show available templates
```

## When to Use

- Creating new components, APIs, or features
- Adding tests for existing code
- Bootstrapping feature modules
- Ensuring new code follows team standards

</execution_steps>
</instructions>

<examples>
<usage_example>
**Usage Examples**:
