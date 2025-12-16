# Summarization Patterns Guide

## Overview

Guide to summarization patterns for documents, code, conversations, and other content. Based on patterns from Claude Cookbooks.

## Summarization Types

### Document Summarization

**Purpose**: Condense long documents into concise summaries.

**Process**:
1. Analyze document structure
2. Extract key points and themes
3. Identify important details
4. Generate concise summary
5. Preserve critical information

**Best Practices**:
- Specify summary length
- Focus on key points
- Maintain context
- Preserve important details

### Code Summarization

**Purpose**: Create overviews of codebases, modules, and functions.

**Process**:
1. Analyze code structure
2. Extract main components
3. Identify key functions
4. Summarize functionality
5. Document patterns

**Best Practices**:
- Focus on functionality
- Document patterns
- Include key functions
- Preserve architecture insights

### Conversation Summarization

**Purpose**: Summarize conversation threads and discussions.

**Process**:
1. Analyze conversation flow
2. Extract key decisions
3. Identify action items
4. Summarize outcomes
5. Document next steps

**Best Practices**:
- Capture decisions
- Document action items
- Preserve context
- Note outcomes

### Multi-Document Summarization

**Purpose**: Summarize multiple related documents.

**Process**:
1. Analyze all documents
2. Identify common themes
3. Extract key points
4. Generate unified summary
5. Preserve unique insights

**Best Practices**:
- Identify common themes
- Preserve unique insights
- Maintain document context
- Create coherent summary

## Evaluation Metrics

### Quality Metrics

- **Relevance**: How relevant is the summary?
- **Completeness**: How complete is the summary?
- **Conciseness**: How concise is the summary?
- **Accuracy**: How accurate is the information?

### Evaluation Methods

- **BLEU Score**: Measures n-gram overlap
- **ROUGE Score**: Measures recall and precision
- **LLM-Based Grading**: Subjective quality assessment
- **Human Evaluation**: Final validation

## Integration

### With Technical Writer

Summarizer helps technical writer:
- Create executive summaries
- Condense documentation
- Generate overviews
- Create abstracts

### With Artifact Publisher

Summaries can be published as artifacts:
- Save to `.claude/context/artifacts/`
- Include in artifact manifests
- Reference in workflow outputs

## Best Practices

1. **Specify Length**: Request specific summary length
2. **Key Points**: Focus on important information
3. **Context Preservation**: Maintain relevant context
4. **Detail Balance**: Preserve critical details
5. **Structure**: Use clear structure and formatting
6. **Iteration**: Refine summaries based on feedback

## Examples

### Example 1: Document Summary

```
Input: 50-page project requirements document

Summary:
- Project Goals: Build task management app
- Key Features: Task creation, assignment, tracking
- Technical Requirements: React, Node.js, PostgreSQL
- Timeline: 3 months
- Team: 2 developers
```

### Example 2: Code Summary

```
Input: Authentication module (10 files, 2000 lines)

Summary:
- Components: Login, Register, Session Management
- Key Functions: authenticate(), authorize(), refreshToken()
- Flow: JWT-based authentication with refresh tokens
- Security: Password hashing, token validation, CSRF protection
```

## Related Skills

- **summarizer**: Summarization implementation
- **technical-writer**: Use summaries in documentation

## Related Documentation

- [Evaluation Guide](EVALUATION_GUIDE.md) - Evaluation patterns
- [Document Generation](DOCUMENT_GENERATION.md) - Document creation

## References

- [Summarization Cookbook](https://github.com/anthropics/anthropic-cookbook/tree/main/capabilities/summarization)

