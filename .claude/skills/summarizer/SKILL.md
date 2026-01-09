---
name: summarizer
description: Generate summaries of documents, code, and conversations. Use for documentation, reports, and content condensation.
context:fork: true
allowed-tools: read, write, grep, glob
version: 1.0
best_practices:
  - Specify summary length
  - Focus on key points
  - Maintain context
  - Preserve important details
error_handling: graceful
streaming: supported
---

# Summarizer Skill

## Identity

Summarizer - Generates concise summaries of documents, code, conversations, and other content.

## Capabilities

- **Document Summarization**: Summarize long documents
- **Code Summarization**: Summarize code files and functions
- **Conversation Summarization**: Summarize conversation threads
- **Multi-Document Summarization**: Summarize multiple documents

## Usage

### Document Summarization

**When to Use**:
- Long documents need condensation
- Executive summaries needed
- Quick content overview
- Documentation summaries

**How to Invoke**:
```
"Summarize the project requirements document"
"Create an executive summary of the technical spec"
"Generate a summary of the meeting notes"
```

**What It Does**:
- Analyzes document content
- Extracts key points
- Generates concise summary
- Preserves important details

### Code Summarization

**When to Use**:
- Large codebases need overview
- Function documentation
- Code review summaries
- Architecture summaries

**How to Invoke**:
```
"Summarize the authentication module"
"Create a summary of the API routes"
"Generate an overview of the codebase structure"
```

## Best Practices

1. **Specify Length**: Request specific summary length
2. **Key Points**: Focus on important information
3. **Context Preservation**: Maintain relevant context
4. **Detail Balance**: Preserve critical details
5. **Structure**: Use clear structure and formatting

## Integration

### With Technical Writer

Summarizer helps technical writer:
- Create executive summaries
- Condense documentation
- Generate overviews
- Create abstracts

### With Artifact Publisher

Summaries can be published as artifacts:
- Save to `.claude/context/runs/{run-id}/artifacts/` (use `path-resolver.mjs` to resolve paths)
- Register in artifact registry via `run-manager.mjs`
- Reference in workflow outputs

## Examples

### Example 1: Document Summary

```
User: "Summarize the project requirements document"

Summarizer:
1. Analyzes document
2. Extracts key points:
   - Project goals
   - Key features
   - Technical requirements
   - Timeline
3. Generates concise summary
4. Preserves critical details
```

### Example 2: Code Summary

```
User: "Summarize the authentication module"

Summarizer:
1. Analyzes code files
2. Extracts:
   - Main components
   - Key functions
   - Authentication flow
   - Security features
3. Generates overview
```

## Related Skills

- **technical-writer**: Use summaries in documentation
- **artifact-publisher**: Publish summaries as artifacts

## Related Documentation

- [Summarization Patterns](../docs/SUMMARIZATION_PATTERNS.md) - Comprehensive guide

