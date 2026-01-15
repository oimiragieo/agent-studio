---
name: nextjs-devtools
description: Next.js development tools for route analysis, component inspection, and build optimization
version: 1.0.0
allowed-tools: [Bash, Read, Grep, Glob]
---

# Next.js DevTools Skill

## Overview

This skill provides Next.js-specific development tools for analyzing routes, inspecting components, and optimizing builds. It achieves 90%+ context savings compared to raw MCP by providing focused, structured outputs specific to Next.js App Router and Pages Router architectures.

**Context Savings**: Instead of loading full Next.js build outputs (50k+ tokens), this skill provides targeted analysis (2-5k tokens) with actionable insights.

**Use Cases**:

- Route structure analysis and debugging
- Server vs Client component detection
- Bundle size optimization
- Middleware configuration validation
- Environment variable verification

## Requirements

- Next.js project (13+ with App Router recommended, Pages Router supported)
- Node.js 18+
- Project root with `next.config.js` or `next.config.mjs`

## Tools (Progressive Disclosure)

### Route Analysis

| Tool             | Description                                                       | Output                                  |
| ---------------- | ----------------------------------------------------------------- | --------------------------------------- |
| list-routes      | List all routes in the project (App Router & Pages Router)        | JSON array of route paths with metadata |
| analyze-route    | Analyze a specific route handler (params, layout, loading states) | Route structure with dependencies       |
| check-middleware | Analyze middleware configuration and matcher patterns             | Middleware config with route matches    |

### Component Analysis

| Tool            | Description                                               | Output                                       |
| --------------- | --------------------------------------------------------- | -------------------------------------------- |
| list-components | List server/client components with 'use client' detection | Component inventory with type classification |
| component-tree  | Show component hierarchy and parent-child relationships   | Tree structure with import paths             |
| check-hydration | Identify potential hydration issues                       | List of components with hydration warnings   |

### Build Analysis

| Tool              | Description                                           | Output                                     |
| ----------------- | ----------------------------------------------------- | ------------------------------------------ |
| analyze-bundle    | Analyze bundle size by route and component            | Bundle sizes with optimization suggestions |
| check-build       | Validate build output and identify issues             | Build validation report                    |
| list-static-paths | Show statically generated paths from `getStaticPaths` | Static path inventory                      |

### Configuration

| Tool              | Description                                  | Output                              |
| ----------------- | -------------------------------------------- | ----------------------------------- |
| validate-config   | Validate next.config.js syntax and options   | Config validation report            |
| check-env         | Check environment variables (.env files)     | Env var inventory with missing vars |
| analyze-redirects | Analyze redirects and rewrites configuration | Redirect/rewrite rules              |

## Quick Reference

### List All Routes (App Router)

```bash
# Find all app directory routes
find app -type f \( -name "page.tsx" -o -name "page.js" -o -name "route.ts" -o -name "route.js" \) | sed 's|app||; s|/page\.[jt]sx\?||; s|/route\.[jt]s||' | sort
```

### List All Routes (Pages Router)

```bash
# Find all pages directory routes
find pages -type f \( -name "*.tsx" -o -name "*.js" \) ! -name "_*.tsx" ! -name "_*.js" | sed 's|pages||; s|\.[jt]sx\?||' | sort
```

### Detect Client Components

```bash
# Find all 'use client' components
grep -r "use client" app/ src/ --include="*.tsx" --include="*.js" --include="*.jsx" -l
```

### Analyze Bundle Size

```bash
# Build and analyze bundle
ANALYZE=true npm run build
# Or with next-bundle-analyzer
npx @next/bundle-analyzer
```

### Check Middleware

```bash
# Find middleware files
find . -name "middleware.ts" -o -name "middleware.js" | head -5
```

### Validate Environment Variables

```bash
# List all .env files
ls -la .env* 2>/dev/null || echo "No .env files found"
```

### Check Static Export Configuration

```bash
# Verify output: 'export' in next.config.js
grep -E "output:\s*['\"]export['\"]" next.config.js next.config.mjs 2>/dev/null
```

## Configuration

**Working Directory**: Project root containing `next.config.js`/`next.config.mjs` and `package.json`

**Environment Variables**:

- `NODE_ENV`: `development` or `production`
- `ANALYZE`: Set to `true` for bundle analysis

**Next.js Versions**:

- **App Router** (Next.js 13+): Primary support with `app/` directory
- **Pages Router** (Next.js 12+): Full support with `pages/` directory
- **Hybrid**: Both routers can coexist

## Agent Integration

### Primary Agents

- **developer**: General Next.js development and debugging
- **react-component-developer**: Component-specific analysis and creation
- **performance-engineer**: Bundle optimization and performance tuning

### Secondary Agents

- **architect**: Route architecture and App Router design
- **devops**: Build configuration and deployment optimization
- **qa**: Testing route handlers and API routes

### Skill Triggers

- Keywords: "next.js", "app router", "pages router", "route handler", "server component", "client component"
- File patterns: `app/**/*.tsx`, `pages/**/*.tsx`, `next.config.js`, `middleware.ts`

## Examples

### Example 1: Route Analysis

**Task**: "List all routes in the Next.js app"

**Skill Invocation**:

```bash
# App Router
find app -type f \( -name "page.tsx" -o -name "page.js" \) | sed 's|app||; s|/page\.[jt]sx\?||' | sort

# Output:
# /
# /dashboard
# /dashboard/settings
# /api/users
```

**Agent**: `developer` or `architect`

### Example 2: Component Inspection

**Task**: "Identify all client components"

**Skill Invocation**:

```bash
# Find 'use client' directives
grep -r "use client" app/ --include="*.tsx" -l | sort

# Output:
# app/components/Button.tsx
# app/components/Modal.tsx
# app/dashboard/ClientWrapper.tsx
```

**Agent**: `react-component-developer`

### Example 3: Bundle Optimization

**Task**: "Analyze bundle size and identify large dependencies"

**Skill Invocation**:

```bash
# Build with analysis
npm run build 2>&1 | grep -A 20 "Route (app)"

# Output shows route sizes:
# ┌ ○ /                    1.2 kB
# ├ ○ /dashboard          45.3 kB  ← Large bundle
# └ ○ /api/users         890 B
```

**Agent**: `performance-engineer`

### Example 4: Middleware Validation

**Task**: "Check middleware configuration"

**Skill Invocation**:

```bash
# Find and read middleware
find . -name "middleware.ts" -exec cat {} \;

# Look for matcher config
grep -A 5 "export const config" middleware.ts
```

**Agent**: `developer` or `security-architect`

### Example 5: Environment Variable Check

**Task**: "Verify all required environment variables are set"

**Skill Invocation**:

```bash
# List .env files
ls -la .env*

# Check for specific vars
grep -h "^[A-Z_]*=" .env.local .env 2>/dev/null | cut -d= -f1 | sort -u
```

**Agent**: `devops`

### Example 6: Static Path Generation

**Task**: "List all statically generated paths"

**Skill Invocation**:

```bash
# Find generateStaticParams functions
grep -r "generateStaticParams" app/ --include="*.tsx" --include="*.ts" -B 2 -A 10
```

**Agent**: `developer`

## Troubleshooting

### Issue: Routes not found

**Symptom**: `find` command returns no results

**Solution**:

```bash
# Verify project structure
ls -la app/ pages/ 2>/dev/null

# Check for TypeScript vs JavaScript
find app pages -type f -name "*.tsx" -o -name "*.jsx" -o -name "*.ts" -o -name "*.js" | head -10
```

### Issue: Build analysis not working

**Symptom**: `ANALYZE=true npm run build` doesn't show bundle analyzer

**Solution**:

```bash
# Install @next/bundle-analyzer
npm install --save-dev @next/bundle-analyzer

# Update next.config.js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})
module.exports = withBundleAnalyzer(nextConfig)
```

### Issue: Middleware not applying to routes

**Symptom**: Middleware doesn't execute on expected routes

**Solution**:

```bash
# Check matcher configuration
cat middleware.ts | grep -A 10 "config"

# Verify matcher patterns
# Correct: matcher: ['/dashboard/:path*']
# Wrong: matcher: ['/dashboard/*']  (invalid glob syntax)
```

### Issue: Client component hydration errors

**Symptom**: Hydration mismatch warnings in browser console

**Solution**:

```bash
# Find components with 'use client'
grep -r "use client" app/ --include="*.tsx" -l

# Check for server-only imports in client components
# Look for 'fs', 'path', 'next/headers' in client components
```

### Issue: Environment variables not loading

**Symptom**: `process.env.VARIABLE` is undefined

**Solution**:

```bash
# Check .env file exists and has correct prefix
cat .env.local | grep "NEXT_PUBLIC_"

# Public vars MUST start with NEXT_PUBLIC_
# Server-only vars don't need prefix
```

### Issue: Dynamic route params not typed

**Symptom**: TypeScript errors on `params` in route handlers

**Solution**:

```typescript
// Add proper types to route handlers
type Params = { params: { id: string } };

export async function GET(request: Request, { params }: Params) {
  // params.id is now typed
}
```

## Performance Tips

1. **Lazy Load Client Components**: Use `React.lazy()` and `Suspense` for client components
2. **Optimize Images**: Use `next/image` with proper `sizes` prop
3. **Route Segment Config**: Add `export const dynamic = 'force-static'` where possible
4. **Minimize Client JS**: Keep client boundaries minimal; prefer server components
5. **Parallel Routes**: Use parallel routes (`@slot`) for simultaneous data fetching

## Related Skills

- **repo-rag**: Search codebase for Next.js patterns
- **scaffolder**: Generate Next.js route boilerplate
- **rule-auditor**: Validate Next.js coding standards
- **test-generator**: Generate route handler tests
- **performance-engineer**: Advanced bundle optimization

## Version Support

| Next.js Version | Support Level | Notes                        |
| --------------- | ------------- | ---------------------------- |
| 15.x            | Full          | Latest App Router features   |
| 14.x            | Full          | Stable App Router, Turbopack |
| 13.x            | Full          | App Router introduced        |
| 12.x            | Partial       | Pages Router only            |
| <12.x           | Limited       | Legacy features only         |

## Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [App Router Migration Guide](https://nextjs.org/docs/app/building-your-application/upgrading/app-router-migration)
- [Bundle Analyzer Plugin](https://www.npmjs.com/package/@next/bundle-analyzer)
- [Next.js Performance Patterns](https://nextjs.org/docs/app/building-your-application/optimizing)
