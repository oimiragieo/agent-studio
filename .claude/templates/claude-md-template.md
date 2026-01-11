<template_structure>

# [Module/Feature/Component Name]

## Purpose

[Clear description of what this module/feature/component does and why it exists]

## Key Patterns

[Important patterns and conventions used in this module]

- [Pattern 1]: [Description]
- [Pattern 2]: [Description]
- [Pattern 3]: [Description]

## Rules & Guidelines

[Module-specific rules and guidelines that should be followed]

### Code Style

- [Rule 1]
- [Rule 2]
- [Rule 3]

### Architecture

- [Architectural guideline 1]
- [Architectural guideline 2]

### Best Practices

- [Best practice 1]
- [Best practice 2]

## Dependencies

[Key dependencies and relationships]

### Internal Dependencies

- `@/lib/[module]` - [Purpose]
- `@/components/[component]` - [Purpose]
- `@/hooks/[hook]` - [Purpose]

### External Dependencies

- `[package]` - [Purpose]
- `[package]` - [Purpose]

### Related Modules

- `[related-module]` - [Relationship description]

## Usage Examples

### Basic Usage

```typescript
// Example of basic usage
import { [Component/Function] } from '[path]'

// Usage example
```

### Advanced Usage

```typescript
// Example of advanced usage
```

### Common Patterns

```typescript
// Example of common patterns
```

## API Reference

[If applicable, document the API]

### Functions/Components

- `[Function/Component Name]`: [Description]
  - Parameters: [List parameters]
  - Returns: [Return type/description]
  - Example: [Code example]

## Testing

[Testing guidelines and examples]

### Unit Tests

- [Testing approach]
- [Example test]

### Integration Tests

- [Testing approach]
- [Example test]

## Troubleshooting

[Common issues and solutions]

### Issue 1

**Problem**: [Description]
**Solution**: [Solution]

### Issue 2

**Problem**: [Description]
**Solution**: [Solution]

## Related Documentation

- [Link to related docs]
- [Link to parent claude.md if applicable]
- [Link to architecture docs]

## Notes

[Any additional notes or considerations]
</template_structure>

<usage_instructions>
**When to Use**: When creating claude.md files for new modules, features, or components to help Claude Code understand module-specific rules and patterns.

**Required Sections**: Purpose, Key Patterns, Rules & Guidelines, Dependencies, Usage Examples.

**Template Variables**: All `[variable]` placeholders should be replaced with actual values when using this template.

**Integration**: This template is used by the claude-md-generator skill to automatically generate claude.md files for new modules.
</usage_instructions>
