# TOON Format Rules for Cursor IDE

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

## Using TOON in Cursor IDE

### For Composer Contexts

When using Cursor's Composer:

1. **Wrap in fenced code block** - Use ` ```toon` label
2. **Show format in context** - Include TOON examples in Composer instructions
3. **Reference this rule** - Link to `.cursor/rules/toon-format.md` in prompts

**Example Composer prompt:**
```
Analyze this user data and identify admin users:

```toon
users[3]{id,name,role}:
  1,Alice,admin
  2,Bob,user
  3,Charlie,user
```
```

### For Plan Mode

When creating plans in Cursor Plan Mode:

1. **Use TOON for structured plan data** - When plans include tabular specifications
2. **Include TOON format in plan artifacts** - Save structured data as TOON
3. **Reference TOON in plan comments** - Document when TOON is used vs JSON

**Example Plan Mode usage:**
- Include TOON-formatted test cases or data tables in plan specifications
- Use TOON for feature requirements when describing uniform data structures

### In Agent Definitions (.mdc files)

When creating custom agents in `.cursor/subagents/*.mdc`:

1. **Reference TOON rules** - Link to this file in agent instructions
2. **Show format examples** - Include TOON examples in agent prompts
3. **Specify when to use** - Add decision criteria to agent guidance

**Example agent instruction:**
```markdown
When processing uniform tabular data, use TOON format instead of JSON for token efficiency. See `.cursor/rules/toon-format.md` for guidelines.
```

### For Output (Cursor Generating Code)

When requesting code that generates or consumes TOON:

1. **Show expected format** - Provide TOON header template
2. **Include format rules** - State indentation and syntax requirements
3. **Use in code examples** - Show TOON parsing/generation in code

**Example request:**
```
Generate a function that outputs user data in TOON format:

```toon
users[N]{id,name,role}:
  [rows here]
```

Rules: 2-space indent, [N] matches row count.
```

## Integration with Cursor Features

### Codebase Indexing

- TOON files (`.toon` extension) should be indexed for search
- Consider adding `.toon` to codebase if storing TOON examples

### Chat Context

- Include TOON examples in chat context when discussing data formats
- Reference TOON rules when suggesting format changes

### Multi-file Edits

- Use TOON format when editing files with uniform tabular data
- Consider converting JSON to TOON when appropriate for LLM interactions

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
