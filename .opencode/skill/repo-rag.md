---
name: repo-rag
description: Repository-aware retrieval augmented generation. Searches codebase for relevant context to answer questions and inform implementations.
allowed-tools: read, glob, grep, bash
---

# Repository RAG (Retrieval Augmented Generation)

Searches and retrieves relevant code context for informed responses.

## When to Use

- Understanding existing codebase patterns
- Finding similar implementations
- Locating relevant documentation
- Identifying dependencies
- Understanding code architecture

## Instructions

### Step 1: Parse the Query

Identify what information is needed:

- **Code Pattern**: How is X implemented?
- **Location**: Where is X defined?
- **Usage**: How is X used?
- **Architecture**: How do X and Y relate?

### Step 2: Search Strategy

Select appropriate search method:

**For Definitions**

```bash
# Find function/class definitions
grep -r "function functionName" --include="*.ts"
grep -r "class ClassName" --include="*.tsx"
```

**For Usage Patterns**

```bash
# Find imports and usage
grep -r "import.*ComponentName" --include="*.tsx"
grep -r "ComponentName" --include="*.tsx"
```

**For File Discovery**

```bash
# Find files by pattern
find . -name "*.test.ts" -type f
find . -path "*/components/*" -name "*.tsx"
```

### Step 3: Retrieve Context

Gather relevant files and snippets:

```javascript
const context = {
  definitions: [{ file: 'src/utils/auth.ts', lines: [10, 50] }],
  usages: [{ file: 'src/pages/login.tsx', lines: [15, 20] }],
  related: [{ file: 'src/types/auth.ts', lines: [1, 30] }],
};
```

### Step 4: Synthesize Response

Use retrieved context to:

- Answer the question directly
- Show relevant code examples
- Explain patterns and conventions
- Identify potential issues

## Search Patterns

### Finding Implementations

```bash
# React components
grep -r "export.*function.*ComponentName" src/

# API routes
grep -r "router\.(get|post|put|delete)" server/

# Database models
grep -r "model.*ModelName" prisma/
```

### Finding Configurations

```bash
# Environment variables
grep -r "process\.env\." src/

# Feature flags
grep -r "FEATURE_" src/

# API endpoints
grep -r "fetch\|axios" src/
```

### Finding Tests

```bash
# Test files
find . -name "*.test.ts" -o -name "*.spec.ts"

# Test cases for specific function
grep -r "describe.*functionName" tests/
```

## Context Quality

### Relevance Scoring

Prioritize results by:

1. Direct matches (definition, usage)
2. Related types/interfaces
3. Similar patterns
4. Documentation

### Context Limits

- Limit file reads to relevant portions
- Summarize large files
- Focus on most recent versions
- Exclude generated code

## Output Format

### For Code Questions

````markdown
## Found: UserAuth Implementation

### Definition

`src/services/auth.ts:45`

```typescript
export async function authenticateUser(credentials: Credentials): Promise<User> {
  // Implementation
}
```
````

### Usage Examples

1. `src/pages/login.tsx:23` - Login form submission
2. `src/middleware/auth.ts:15` - Route protection

### Related Types

- `Credentials` defined in `src/types/auth.ts:12`
- `User` defined in `src/types/user.ts:5`

````

### For Architecture Questions
```markdown
## Architecture: Authentication Flow

### Components
1. **LoginForm** - User input
2. **AuthService** - Credential validation
3. **UserStore** - Session management

### Data Flow
LoginForm → AuthService → API → Database
         ← Response ← UserStore

### Files Involved
- `src/pages/login.tsx`
- `src/services/auth.ts`
- `src/stores/user.ts`
- `server/routes/auth.ts`
````

## Best Practices

1. **Search Broad, Read Narrow**: Cast wide net, focus on relevant results
2. **Follow the Imports**: Trace dependencies for full context
3. **Check Tests**: Tests often explain intended behavior
4. **Read Comments**: Inline documentation is valuable
5. **Version Aware**: Consider git history for evolution
