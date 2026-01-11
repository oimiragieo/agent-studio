# Symbols Integration Guide

Cursor integrates with language servers to provide symbol navigation and code intelligence across your codebase.

## Symbol Indexing

Cursor automatically indexes:

- Classes, functions, and methods
- Interfaces and types (TypeScript)
- Constants and variables
- Import/export relationships

## Usage in Agents

Agents can leverage symbol information to:

- Find all usages of a function or class
- Navigate to symbol definitions
- Understand code relationships
- Refactor safely with symbol awareness

## Configuration

Symbol indexing is automatically enabled for supported languages:

- TypeScript/JavaScript
- Python
- Go
- Java
- And other LSP-supported languages

## Best Practices

- Keep language servers up to date
- Ensure project has proper type definitions
- Use explicit exports for better symbol tracking
- Reference symbols in agent prompts for precise navigation
