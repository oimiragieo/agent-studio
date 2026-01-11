# Repo RAG Skill

Performs high-recall codebase retrieval using semantic search and symbol indexing.

## When to Use

- Finding specific code patterns
- Understanding project structure
- Verifying architectural patterns
- Researching how features are implemented

## Invocation

```
Use @repo-rag to find authentication patterns
Use @repo-rag to search for API endpoints
Use @repo-rag to understand the data model
Use @repo-rag to find all error handlers
```

## Process

1. **Index Codebase**: Build symbol index and semantic embeddings
2. **Parse Query**: Understand search intent
3. **Retrieve**: Find relevant files and code blocks
4. **Rank**: Order by relevance and recency
5. **Present**: Return results with context

## Search Modes

| Mode      | Use Case          | Example                        |
| --------- | ----------------- | ------------------------------ |
| Symbol    | Find definitions  | "find UserService class"       |
| Semantic  | Conceptual search | "how does auth work"           |
| Pattern   | Code patterns     | "find all async functions"     |
| Reference | Usage tracking    | "where is validateUser called" |

## Output Format

```markdown
## Search Results: "authentication patterns"

### 1. src/auth/providers/oauth.ts (95% match)

- Lines 45-78: OAuth2 provider implementation
- Handles Google, GitHub, Discord auth

### 2. src/middleware/auth.ts (89% match)

- Lines 12-34: JWT verification middleware
- Used in all protected routes

### 3. src/api/auth/[...nextauth]/route.ts (85% match)

- Lines 1-56: NextAuth configuration
- Session handling and callbacks
```

## Integration with Cursor

- Powers Cursor's native @ symbol search
- Enhances Composer context awareness
- Supports Plan Mode research phase

## Related Skills

- `rule-auditor` - Find violations in search results
- `scaffolder` - Generate based on found patterns
