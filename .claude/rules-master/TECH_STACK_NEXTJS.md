---
description: Master ruleset for Next.js 15 + React 19 + TypeScript + Tailwind CSS + Shadcn UI
globs: **/*.{ts,tsx,js,jsx}, app/**/*, components/**/*, src/**/*
priority: high
validation:
  # Note: Regex patterns use [\s\S]*? for multi-line matching. For very complex
  # patterns, use repo-rag skill or a proper linter (ESLint with eslint-plugin-react-hooks).
  forbidden_patterns:
    - pattern: "useEffect[\\s\\S]*?fetch"
      message: "Do not use useEffect for data fetching; use Server Components."
      severity: "error"
    - pattern: "console\\.log"
      message: "Remove console.log statements before commit."
      severity: "warning"
    - pattern: ":\\s*any\\b"
      message: "Avoid 'any' type; use 'unknown' or proper types."
      severity: "error"
    - pattern: "require\\("
      message: "Use ES modules (import) instead of CommonJS (require)."
      severity: "error"
---

<template name="component">
```typescript
import { Suspense } from 'react'

export default function {{Name}}() {
return (
<Suspense fallback={<{{Name}}Skeleton />}>
<{{Name}}Content />
</Suspense>
)
}

````
</template>

<template name="api-route">
```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function {{Method}}(request: NextRequest) {
  try {
    // Implementation
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
````

</template>

# Next.js 15 + React 19 + TypeScript + Tailwind CSS Master Rules

**Consolidated from**: typescript-nextjs-react-tailwind-supabase, nextjs15-react19-vercelai-tailwind, nextjs-react-typescript, nextjs-tailwind-typescript-apps, cursor-ai-react-typescript-shadcn-ui, tailwind-css-nextjs-guide, and related variants.

## Core Stack Versions

- **Next.js**: 15.x (App Router)
- **React**: 19.x
- **TypeScript**: 5.x (strict mode)
- **Tailwind CSS**: 3.x
- **Shadcn UI**: Latest
- **Node.js**: 18+ (ES Modules)

## Project Structure

### Directory Organization

- Use the **App Router** directory structure (`app/` directory)
- Place route-specific components in `app/` directory
- Place shared components in `components/` directory
- Place utilities and helpers in `lib/` directory
- Use **lowercase with dashes** for directories (e.g., `components/auth-wizard`)
- Place static content and interfaces at file end
- Structure components logically: exports, subcomponents, helpers, types

### File Naming

- Use PascalCase for component files: `UserProfile.tsx`
- Use camelCase for utility files: `formatDate.ts`
- Use kebab-case for directories: `user-profile/`
- Co-locate component props with their components

## TypeScript Rules

### Type System

- **Prefer interfaces over types** for object definitions
- Use `type` for unions, intersections, and mapped types
- **Avoid `any`**, prefer `unknown` for unknown types
- Use **strict TypeScript configuration**
- Leverage TypeScript's built-in utility types (`Pick`, `Omit`, `Partial`, etc.)
- Use generics for reusable type patterns
- Use `satisfies` operator for type validation
- **Avoid enums**; use const maps instead

### Naming Conventions

- Use **PascalCase** for type names and interfaces
- Use **camelCase** for variables and functions
- Use **UPPER_CASE** for constants
- Use **descriptive names with auxiliary verbs** (e.g., `isLoading`, `hasError`)
- Prefix interfaces for React props with 'Props' (e.g., `ButtonProps`)
- Prefix event handlers with 'handle' (e.g., `handleClick`, `handleSubmit`)

### Code Organization

- Keep type definitions close to where they're used
- Export types and interfaces from dedicated type files when shared
- Use barrel exports (`index.ts`) for organizing exports
- Place shared types in a `types` directory

### Functions

- Use explicit return types for public functions
- Use arrow functions for callbacks and methods
- Implement proper error handling with custom error types
- Use function overloads for complex type scenarios
- Prefer `async/await` over Promises

### Best Practices

- Enable strict mode in `tsconfig.json`
- Use `readonly` for immutable properties
- Leverage discriminated unions for type safety
- Use type guards for runtime type checking
- Implement proper null checking
- Avoid type assertions unless necessary

## React Rules

### Component Architecture

- **Use functional components** over class components
- **Favor React Server Components (RSC)** where possible
- **Minimize 'use client' directives**
- Mark client components explicitly with `'use client'`
- Keep components small and focused
- Extract reusable logic into custom hooks
- Use composition over inheritance
- Implement proper prop types with TypeScript
- Split large components into smaller, focused ones
- Wrap client components in Suspense with fallback
- Use dynamic loading for non-critical components
- Implement proper error boundaries

### React 19 Specific Features

- Use `use` hook for consuming Promises and Context directly in components
- Leverage new `useFormStatus` hook for form state management
- Use `useActionState` for form actions and state management
- Implement Document Metadata API for better SEO and social sharing
- Use Actions for client-side mutations with automatic loading states
- Leverage compiler optimizations like automatic memoization
- Use `ref` as a prop directly without needing `forwardRef`
- Implement proper error boundaries with new error handling patterns
- Use `useOptimistic` hook for optimistic UI updates
- Leverage new React Compiler for automatic memoization and performance
- Use `startTransition` for non-urgent state updates
- Use `useDeferredValue` for deferring UI updates
- Use `useId` for generating unique IDs in server components
- Use `useSyncExternalStore` for subscribing to external stores

### Hooks

- Follow the Rules of Hooks
- Use custom hooks for reusable logic
- Keep hooks focused and simple
- Use appropriate dependency arrays in `useEffect`
- Implement cleanup in `useEffect` when needed
- Avoid nested hooks
- **Minimize use of 'useEffect' and 'setState'**

### State Management

- Use `useState` for local component state
- Implement `useReducer` for complex state logic
- Use Context API for shared state (sparingly)
- Keep state as close to where it's used as possible
- Avoid prop drilling through proper state management
- Use state management libraries only when necessary
- **Minimize client-side state**
- **Prefer server state when possible**
- Implement proper loading states

### Performance

- Implement proper memoization (`useMemo`, `useCallback`)
- Use `React.memo` for expensive components
- Avoid unnecessary re-renders
- Implement proper lazy loading
- Use proper key props in lists
- Profile and optimize render performance
- Optimize for Web Vitals (LCP, CLS, FID)

## Next.js 15 Rules

### App Router

- Use the **App Router** conventions (not Pages Router)
- Implement proper loading and error states for routes
- Use dynamic routes appropriately
- Handle parallel routes when needed
- Use route groups for organization without affecting URL structure

### Server Components (Default)

- Use Server Components by default
- Fetch data directly in Server Components
- Use Server Actions for mutations
- Implement proper caching strategies
- Handle loading and error states appropriately

### Data Fetching

- Use Server Components for data fetching when possible
- Implement proper error handling for data fetching
- Use appropriate caching strategies (`cache`, `revalidate`)
- Handle loading and error states appropriately
- Use `fetch` with proper caching options

### Routing

- Use the App Router conventions
- Implement proper loading and error states for routes
- Use dynamic routes appropriately
- Handle parallel routes when needed
- Use route handlers for API endpoints

### Forms and Validation

- **Use Zod for form validation**
- Implement proper server-side validation
- Handle form errors appropriately
- Show loading states during form submission
- Use Server Actions for form submissions

### Performance Optimization

- Optimize images: Use WebP format, size data, lazy loading
- Use dynamic loading for non-critical components
- Implement proper caching strategies
- Minimize JavaScript bundle size
- Use code splitting effectively
- Optimize fonts and assets

## Tailwind CSS Rules

### Setup

- Use proper Tailwind configuration
- Configure theme extension properly
- Set up proper purge/content configuration
- Use proper plugin integration
- Configure custom spacing and breakpoints
- Set up proper color palette

### Styling Approach

- **Use utility classes over custom CSS**
- Group related utilities with `@apply` when needed
- Use proper responsive design utilities
- Implement dark mode properly using `dark:` variant
- Use proper state variants (`hover:`, `focus:`, `active:`)
- Keep component styles consistent

### Layout

- Use Flexbox and Grid utilities effectively
- Implement proper spacing system
- Use container queries when needed
- Implement proper responsive breakpoints
- Use proper padding and margin utilities
- Implement proper alignment utilities

### Responsive Design

- **Use mobile-first approach**
- Leverage Tailwind's responsive prefixes (`sm:`, `md:`, `lg:`, `xl:`, `2xl:`)
- Use `container` class for responsive containers
- Handle different screen sizes properly
- Implement proper responsive typography
- Use proper responsive spacing

### Components

- **Use shadcn/ui components when available**
- Extend components properly
- Keep component variants consistent
- Implement proper animations
- Use proper transition utilities
- Keep accessibility in mind

### Best Practices

- Use `@apply` directive sparingly; prefer utility classes directly in HTML/JSX
- Create custom components with `@layer components` for repeated patterns
- Use Tailwind's built-in design tokens for spacing, colors, and typography
- Use `group` and `peer` variants for interactive states
- Create custom utilities with `@layer utilities` for project-specific needs
- Avoid arbitrary values (`w-[532px]`) when possible; define custom values in `tailwind.config.js`
- Implement proper focus styles for accessibility using `focus:` and `focus-within:` variants
- Use `sr-only` for screen reader-only content
- Optimize for production by purging unused styles

## Code Quality

### General Principles

- Write concise, readable TypeScript code
- Use functional and declarative programming patterns
- Follow **DRY (Don't Repeat Yourself)** principle
- Implement early returns for better readability
- Use descriptive, explicit variable names over short, ambiguous ones
- Prefer modular design for maintainability and reusability
- Replace hardcoded values with named constants
- Handle edge cases and include assertions to catch errors early

### Error Handling

- Create custom error types for domain-specific errors
- Use Result types for operations that can fail
- Implement proper error boundaries
- Use try-catch blocks with typed catch clauses
- Handle Promise rejections properly
- Show user-friendly error messages
- Implement proper fallback UI
- Log errors appropriately

### Testing

- Write unit tests for components
- Implement integration tests for complex flows
- Use React Testing Library
- Test user interactions
- Test error scenarios
- Implement proper mock data
- Achieve high test coverage with meaningful assertions

### Accessibility

- Use semantic HTML elements
- Implement proper ARIA attributes
- Ensure keyboard navigation
- Test with screen readers
- Handle focus management
- Provide proper alt text for images
- Follow WCAG guidelines

## Performance Best Practices

### Optimization Strategies

- Minimize use of `useEffect` and `setState`
- Favor Server Components (RSC) where possible
- Use dynamic loading for non-critical components
- Implement proper caching strategies
- Optimize images: Use WebP format, size data, lazy loading
- Minimize JavaScript bundle size
- Use code splitting effectively
- Optimize fonts and assets
- Monitor bundle size

### Web Vitals

- Optimize for Largest Contentful Paint (LCP)
- Minimize Cumulative Layout Shift (CLS)
- Optimize First Input Delay (FID)
- Monitor Core Web Vitals

## Security

### Best Practices

- Always consider security implications when writing code
- Implement proper authentication and authorization
- Validate and sanitize user inputs
- Use environment variables for sensitive configuration
- Implement proper CORS policies
- Use HTTPS in production
- Keep dependencies up to date

## Supabase Integration (When Used)

- Use Supabase for data fetching and schema management
- Implement proper Row Level Security (RLS) policies
- Use Supabase client libraries properly
- Handle authentication with Supabase Auth
- Implement proper error handling for Supabase operations

## Vercel AI SDK (When Used)

- Use Vercel AI SDK for AI-powered features
- Implement proper streaming for chat interfaces
- Handle AI responses appropriately
- Use proper error handling for AI operations
- Optimize AI API calls

## Strict Rules (MUST Follow)

1. **NO `useEffect` where Server Actions work**
2. **Use Zod for validation** (forms, API inputs)
3. **Server Components by default** - only use `'use client'` when necessary
4. **Prefer interfaces over types** for object definitions
5. **Avoid enums** - use const maps instead
6. **Use functional components** - no class components
7. **Mobile-first responsive design** with Tailwind
8. **TypeScript strict mode** enabled
9. **Proper error boundaries** for all routes
10. **Accessibility first** - WCAG compliance

## Migration Notes

This master file consolidates rules from:

- `typescript-nextjs-react-tailwind-supabase-cursorrules`
- `nextjs15-react19-vercelai-tailwind-cursorrules-prompt-file`
- `nextjs-react-typescript-cursorrules-prompt-file`
- `nextjs-tailwind-typescript-apps-cursorrules-prompt`
- `cursor-ai-react-typescript-shadcn-ui-cursorrules-p`
- `tailwind-css-nextjs-guide-cursorrules-prompt-file`
- `typescript-nextjs-react-cursorrules-prompt-file`
- `typescript-shadcn-ui-nextjs-cursorrules-prompt-file`
- And related Next.js/React/TypeScript/Tailwind variants

**Old rule files can be archived** - this master file is the single source of truth.
