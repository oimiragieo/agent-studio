# TOON Format Rules for Factory Droid

## Overview

**Token-Oriented Object Notation (TOON)** is a compact, human-readable serialization format designed for LLM prompts. TOON provides approximately **50% token savings** compared to JSON for uniform tabular data.

**Reference**: [TOON GitHub](https://github.com/toon-format/toon) | [TOON Spec v1.3](https://github.com/toon-format/toon/blob/main/SPEC.md)

## When to Use TOON

Use TOON format when:

- **Uniform arrays of objects** - Same fields, primitive values only
- **Large datasets** with consistent structure
- **Token efficiency** is a priority (LLM input/output)
- **Data is consumed by LLMs** (not APIs or storage)

### Example: Good TOON Use Case

```toon
users[3]{id,name,role,lastLogin}:
  1,Alice,admin,2025-01-15T10:30:00Z
  2,Bob,user,2025-01-14T15:22:00Z
  3,Charlie,user,2025-01-13T09:45:00Z
```

**Token savings**: ~50% vs equivalent JSON

## When NOT to Use TOON

Do NOT use TOON when:

- **Non-uniform data structures** - Mixed types, varying fields
- **Deeply nested objects** - Complex hierarchies
- **API responses** - Standard JSON expected
- **Storage formats** - JSON compatibility required
- **Objects with varying field sets** - Each object has different keys

### Example: JSON is Better Here

```json
{
  "user": {
    "profile": {
      "settings": { "theme": "dark" }
    }
  },
  "items": [1, { "a": 1 }, "x"]
}
```

This mixed structure should use JSON, not TOON.

## Syntax Guidelines

### Basic Rules

1. **2-space indentation** - Standard for nested structures
2. **Tabular format** - For uniform object arrays (use when possible)
3. **List format** - For mixed/non-uniform data
4. **Length markers** - Array headers show count: `items[2]`
5. **Field headers** - Tabular arrays include field names: `items[2]{id,qty,price}:`

### Format Examples

**Object:**
```
id: 1
name: Ada
```

**Primitive array (inline):**
```
tags[2]: reading,gaming
```

**Tabular array (uniform objects):**
```
items[2]{sku,qty,price}:
  A1,2,9.99
  B2,1,14.50
```

**List format (non-uniform):**
```
items[3]:
  - 1
  - a: 1
  - x
```

## Using TOON in Factory Droid

### For Droid Skills

When creating or using Droid skills:

1. **Use TOON for skill input/output** - When skills process uniform tabular data
2. **Reference TOON in skill definitions** - Document format expectations
3. **Include TOON examples** - Show format in skill documentation

**Example skill usage:**
```yaml
# Skill definition
name: process-user-data
description: Processes user data in TOON format
input_format: toon
example: |
  ```toon
  users[N]{id,name,role}:
    [rows here]
  ```
```

### For Context Layers

When using Factory's context layering system:

1. **Use TOON in context specifications** - When context includes structured data
2. **Layer format documentation** - Include TOON rules in context documentation
3. **Token-efficient contexts** - Use TOON for large data tables in context layers

**Example context layer:**
- Include TOON-formatted reference data in context layers
- Use TOON for specification documents when describing uniform structures

### For Droid Specifications

When creating Droid specifications:

1. **Use TOON for test data** - Include TOON examples in specifications
2. **Format requirements in specs** - Specify TOON format when appropriate
3. **Reference TOON rules** - Link to this file in specification documents

**Example specification:**
```
Feature: User Management

Test Data (TOON format):
```toon
users[2]{id,name,role}:
  1,Alice,admin
  2,Bob,user
```
```

### Integration with Factory Artifacts

- **Artifact specifications** - Use TOON in artifact definitions when structured data is involved
- **Decision records** - Include TOON examples in decision artifacts
- **Context artifacts** - Store uniform tabular data as TOON in artifacts

### For Enterprise Integrations

When integrating with external systems:

1. **Convert JSON to TOON** - When passing data to LLM endpoints
2. **Keep JSON for APIs** - Maintain JSON format for non-LLM integrations
3. **Document conversions** - Specify when format conversion occurs

## Advanced Options

### Custom Delimiters

For large uniform tables, consider tab delimiters:

```
items[2|]{sku|name|qty}:
  A1|Widget|2
  B2|Gadget|1
```

Tabs (`\t`) can provide additional token savings but may have display issues in some editors.

### Length Marker

Optional hash prefix for clarity:

```
tags[#3]: reading,gaming,coding
items[#2]{sku,qty}: A1,2 B2,1
```

## Decision Tree

1. **Is the data uniform arrays of objects with same fields?**
   - ✅ YES → Use TOON tabular format
   - ❌ NO → Continue

2. **Is the data mixed types or varying structures?**
   - ✅ YES → Use JSON
   - ❌ NO → Continue

3. **Is token efficiency important?**
   - ✅ YES → Use TOON list format for simple arrays
   - ❌ NO → Use JSON

4. **Is this for API or storage?**
   - ✅ YES → Use JSON
   - ❌ NO → Consider TOON if uniform

## Implementation Notes

- **Show format, don't describe** - The TOON structure is self-documenting
- **Link to spec** - Reference TOON spec for edge cases and full syntax
- **Token counts vary** - Benchmarks use GPT-style tokenizers; actual savings may differ
- **Not a drop-in replacement** - TOON is for LLM prompts, not general-purpose JSON replacement
- **Droid Shield compatibility** - TOON format works with Factory's security and validation systems
