# Classification Patterns Guide

## Overview

Guide to classification patterns for code, documents, and data. Includes text-to-SQL patterns for database queries.

## Classification

### Code Classification

**Purpose**: Organize codebase by functionality, type, or pattern.

**Categories**:
- **Component Types**: React components, API routes, utilities
- **Architectural Layers**: Presentation, business logic, data access
- **Functionality**: Authentication, payment, reporting
- **Patterns**: MVC, Repository, Factory

**Process**:
1. Analyze code files
2. Extract patterns and features
3. Assign categories
4. Validate classifications
5. Organize by category

### Document Classification

**Purpose**: Organize documentation by topic, type, or purpose.

**Categories**:
- **Topics**: Technical, business, user-facing
- **Types**: API docs, guides, tutorials
- **Purposes**: Reference, how-to, explanation

**Process**:
1. Analyze document content
2. Extract topics and themes
3. Assign categories
4. Validate classifications
5. Organize by category

## Text-to-SQL

### Overview

Convert natural language queries to SQL using database schema context.

### Process

1. **Analyze Query**: Parse natural language query
2. **Load Schema**: Reference database schema
3. **Generate SQL**: Create SQL query
4. **Validate**: Check syntax and safety
5. **Optimize**: Optimize query performance
6. **Return**: Return parameterized query

### Schema Integration

**Schema Context**:
- Table definitions
- Column types and constraints
- Relationships and foreign keys
- Indexes and constraints

**Query Generation**:
- Uses schema for accurate queries
- Handles joins and relationships
- Applies constraints
- Uses appropriate data types

### Safety

**Parameterized Queries**:
- Prevents SQL injection
- Uses placeholders for values
- Validates input types
- Safe execution

**Query Validation**:
- Syntax checking
- Schema validation
- Type checking
- Constraint validation

### Best Practices

1. **Complete Schema**: Provide full database schema
2. **Query Validation**: Validate before execution
3. **Parameterization**: Always use parameters
4. **Testing**: Test on sample data
5. **Optimization**: Review query performance

## Integration

### With Database Architect

- Uses schema from database-architect
- Generates queries based on schema
- Optimizes for schema structure

### With Developer

- Generates query code
- Provides query templates
- Handles error cases

## Examples

### Code Classification Example

```
Input: src/components/UserProfile.tsx

Classification:
- Type: React Component
- Layer: Presentation
- Functionality: User Management
- Pattern: Functional Component
```

### Text-to-SQL Example

```
Natural Language: "Find all users who signed up in the last month"

Generated SQL:
SELECT * FROM users 
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)
```

## Related Skills

- **classifier**: Code and document classification
- **text-to-sql**: SQL query generation
- **database-architect**: Schema design

## Related Documentation

- [Evaluation Guide](EVALUATION_GUIDE.md) - Evaluation patterns
- [RAG Evaluation](RAG_EVALUATION.md) - RAG quality assessment

