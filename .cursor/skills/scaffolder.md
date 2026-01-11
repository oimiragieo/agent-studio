# Scaffolder Skill

Generates boilerplate code that automatically follows your project's coding standards.

## When to Use

- Creating new React/Vue/Angular components
- Adding new API endpoints or routes
- Setting up new modules or packages
- Generating test files
- Creating data models

## Invocation

```
Use @scaffolder to create a UserProfile component
Use @scaffolder to generate an API route for /api/users
Use @scaffolder to create tests for UserAuth
Use @scaffolder to scaffold a FastAPI endpoint for orders
```

## Process

1. **Identify Framework**: Detect which rules apply (nextjs.mdc, fastapi.mdc, etc.)
2. **Extract Patterns**: Parse rules for naming, structure, imports
3. **Generate Code**: Apply patterns to create compliant boilerplate
4. **Validate**: Run rule-auditor to verify compliance

## Templates Available

| Template           | Framework          | Files Generated                   |
| ------------------ | ------------------ | --------------------------------- |
| `component`        | Next.js/React      | index.tsx, types.ts, skeleton.tsx |
| `client-component` | Next.js            | index.tsx with 'use client'       |
| `page`             | Next.js App Router | page.tsx, loading.tsx, error.tsx  |
| `api`              | Next.js App Router | route.ts with handlers            |
| `fastapi-route`    | FastAPI            | router file with endpoints        |
| `hook`             | React              | Custom hook with types            |
| `test`             | Jest/Vitest        | Test file for component           |
| `e2e-test`         | Cypress/Playwright | E2E test spec                     |

## Example Output

**Command**: `Use @scaffolder to create a SearchBar client component`

**Generated**: `components/search-bar/index.tsx`

```tsx
'use client'; // Required per nextjs.mdc

import { useState, useCallback } from 'react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
}

export function SearchBar({ onSearch, placeholder = 'Search...' }: SearchBarProps) {
  const [query, setQuery] = useState('');

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value);
      onSearch(e.target.value);
    },
    [onSearch]
  );

  return (
    <input
      type="search"
      value={query}
      onChange={handleChange}
      placeholder={placeholder}
      className="w-full px-4 py-2 border rounded-lg"
    />
  );
}

export default SearchBar;
```

## Integration with Cursor

- Use in Composer for rapid component creation
- Combine with Plan Mode for feature scaffolding
- Cloud Agents can scaffold entire feature modules

## Related Skills

- `rule-selector` - Configure rules before scaffolding
- `rule-auditor` - Validate scaffolded code
