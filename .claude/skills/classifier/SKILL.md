---
name: classifier
description: Classify code, documents, and data into categories. Use for code categorization, content classification, and data organization.
allowed-tools: read, write, grep, glob
version: 1.0
best_practices:
  - Use clear category definitions
  - Provide training examples
  - Validate classifications
  - Track classification accuracy
error_handling: graceful
streaming: supported
---

# Classifier Skill

## Identity

Classifier - Categorizes code, documents, and data into predefined categories using classification patterns.

## Capabilities

- **Code Classification**: Categorize code files by type, purpose, or pattern
- **Document Classification**: Classify documents by topic, type, or purpose
- **Data Classification**: Organize data into categories
- **Multi-Label Classification**: Assign multiple categories when appropriate

## Usage

### Code Classification

**When to Use**:
- Organizing codebase by functionality
- Identifying code patterns
- Categorizing components
- Code review organization

**How to Invoke**:
```
"Classify all files in src/components by functionality"
"Categorize API routes by resource type"
"Organize code files by architectural layer"
```

**What It Does**:
- Analyzes code files
- Assigns categories based on patterns
- Returns classification results
- Validates classifications

### Document Classification

**When to Use**:
- Organizing documentation
- Categorizing content
- Topic classification
- Content management

**How to Invoke**:
```
"Classify documentation files by topic"
"Categorize markdown files by purpose"
"Organize documents by category"
```

## Classification Patterns

### Code Categories

- **Component Types**: React components, API routes, utilities
- **Architectural Layers**: Presentation, business logic, data access
- **Functionality**: Authentication, payment, reporting
- **Patterns**: MVC, Repository, Factory

### Document Categories

- **Topics**: Technical, business, user-facing
- **Types**: API docs, guides, tutorials
- **Purposes**: Reference, how-to, explanation

## Best Practices

1. **Clear Categories**: Define categories explicitly
2. **Training Examples**: Provide examples for each category
3. **Validation**: Review and validate classifications
4. **Accuracy Tracking**: Monitor classification accuracy
5. **Iteration**: Refine categories based on results

## Integration

### With Database Architect

Classifier can categorize database schemas:
- Table types (entities, relationships, lookup)
- Schema patterns (normalized, denormalized)
- Data domains (user, product, order)

### With Code Reviewer

Classifier helps organize code reviews:
- Review categories
- Priority classification
- Pattern identification

## Examples

### Example 1: Code Classification

```
User: "Classify all files in src/ by functionality"

Classifier:
1. Analyzes all files in src/
2. Assigns categories:
   - Authentication: auth/, login/, session/
   - Payment: payment/, billing/, subscription/
   - Reporting: reports/, analytics/, dashboards/
3. Returns classification results
```

### Example 2: Document Classification

```
User: "Classify documentation by topic"

Classifier:
1. Analyzes documentation files
2. Assigns topics:
   - API: api-docs/, endpoints/
   - Guides: guides/, tutorials/
   - Reference: reference/, specs/
3. Returns classification
```

## Related Skills

- **text-to-sql**: Convert natural language to SQL queries
- **code-reviewer**: Review classified code
- **database-architect**: Use classifications for schema design

## Related Documentation

- [Classification Patterns](../docs/CLASSIFICATION_PATTERNS.md) - Comprehensive guide

