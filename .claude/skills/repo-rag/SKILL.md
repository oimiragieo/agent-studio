---
name: repo-rag
description: Perform high-recall codebase retrieval using semantic search and symbol indexing. Use when you need to find specific code, understand project structure, or verify architectural patterns before editing.
allowed-tools: search, symbols
---

# Repo RAG (Retrieval Augmented Generation)

This skill provides advanced codebase search capabilities beyond simple grep.

## Instructions

1. **Symbol Search First**: Use `symbols` to find classes, functions, and types. This is more accurate than text search for code structures.
   ```
   symbols "UserAuthentication"
   ```

2. **Semantic Search**: Use `search` for concepts, comments, or broader patterns.
   ```
   search "authentication middleware logic"
   ```

3. **Verification**: Always verify the file path and context returned before proposing edits.

## Usage Patterns

- **Architecture Review**: Run symbol searches on key interfaces to understand the dependency graph.
- **Plan Mode**: Use this skill to populate the "Context" section of a Plan Mode artifact.
- **Refactoring**: Identify all usages of a symbol before renaming or modifying it.
