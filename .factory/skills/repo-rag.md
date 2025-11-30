# Repo RAG Skill

Performs high-recall codebase retrieval using semantic search and symbol indexing.

## When to Use

- Finding specific code patterns
- Understanding project structure
- Researching how features are implemented
- Verifying architectural patterns before changes

## Invocation

```
Run Task tool with skill repo-rag to find authentication patterns
Run Task tool with skill repo-rag to search for API endpoints
Run Task tool with skill repo-rag to understand the data model
```

## Process

1. **Index Codebase**: Build symbol index and semantic embeddings
2. **Parse Query**: Understand search intent
3. **Retrieve**: Find relevant files and code blocks
4. **Rank**: Order by relevance and recency
5. **Present**: Return results with context for droids

## Search Modes

| Mode | Use Case | Example |
|------|----------|---------|
| Symbol | Find definitions | "find UserService class" |
| Semantic | Conceptual search | "how does auth work" |
| Pattern | Code patterns | "find all async functions" |
| Reference | Usage tracking | "where is validateUser called" |

## Output Format

```markdown
## Search Results: "authentication patterns"

### 1. src/auth/providers/oauth.ts (95% match)
- Lines 45-78: OAuth2 provider implementation
- Handles Google, GitHub, Discord auth

### 2. src/middleware/auth.ts (89% match)
- Lines 12-34: JWT verification middleware
- Used in all protected routes

### 3. src/api/auth/route.ts (85% match)
- Lines 1-56: Auth API configuration
- Session handling and callbacks
```

## Integration with Factory

- Use with analyst droid for research
- Combine with architect droid for design decisions
- Support developer droid implementation

## Related Skills

- `context-router` - Route search results appropriately
- `rule-auditor` - Find violations in search results
- `scaffolder` - Generate based on found patterns
