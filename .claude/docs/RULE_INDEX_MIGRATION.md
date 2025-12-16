# Rule Index System Migration Guide

## Overview

The rule index system transforms rule discovery from static context loading to dynamic, index-based discovery. This enables Skills to discover all 1,081+ rules without hard-coding, using progressive disclosure to minimize context usage.

## Why We Moved to Index System

### Previous System (Static)
- Rules hard-coded in skill instructions
- Manual updates required when rules change
- Limited to known rules at skill creation time
- No systematic discovery of all available rules

### New System (Index-Based)
- Rules discovered dynamically from index
- Automatic discovery of new rules
- Systematic coverage of all 1,081+ rules
- Technology-based queries for efficient lookup

## Architecture

### Index Generator

**File**: `scripts/generate-rule-index.mjs`

Scans all rule files and generates compressed JSON index:
- Scans `.claude/rules-master/` (8 master rules)
- Scans `.claude/archive/` recursively (1,073 archive rules)
- Extracts YAML frontmatter metadata
- Identifies technologies from filename and content
- Generates technology map for fast lookup

**Output**: `.claude/context/rule-index.json` (~10-15k tokens)

### Index Structure

```json
{
  "version": "1.0.0",
  "generated_at": "2025-01-XX...",
  "total_rules": 1081,
  "master_rules": 8,
  "archive_rules": 1073,
  "rules": [
    {
      "path": ".claude/rules-master/TECH_STACK_NEXTJS.md",
      "name": "TECH_STACK_NEXTJS",
      "description": "Master ruleset for Next.js 15...",
      "tech": ["nextjs", "react", "typescript", "tailwind"],
      "type": "master",
      "size": 8000,
      "line_count": 350
    }
  ],
  "technology_map": {
    "nextjs": [".claude/rules-master/TECH_STACK_NEXTJS.md", ...],
    "python": [".claude/rules-master/LANG_PYTHON_GENERAL.md", ...]
  }
}
```

## How Skills Use the Index

### Discovery Pattern

1. **Load Index**: Skill loads `.claude/context/rule-index.json`
2. **Detect Technologies**: Analyze target (file, codebase, query)
3. **Query Technology Map**: `index.technology_map[tech]` returns relevant rule paths
4. **Load Rules**: Progressive disclosure - load only relevant rules (5-10), not all 1,081
5. **Process**: Use loaded rules for the skill's purpose

### Example: Explaining Rules

```markdown
User: "What rules apply to src/components/UserAuth.tsx?"

1. Load rule index
2. Detect: .tsx → TypeScript, React
3. Query: index.technology_map['nextjs'], ['react'], ['typescript']
4. Get: 5-10 relevant rule paths
5. Load only those rules
6. Explain applicable rules
```

## Updated Skills

### Existing Skills (Updated)

**rule-auditor**:
- **Before**: Scanned filesystem with `find .claude/rules`
- **After**: Loads index, queries `technology_map`, loads relevant rules

**rule-selector**:
- **Before**: Hard-coded rule mapping table
- **After**: Queries index by detected technologies

**scaffolder**:
- **Before**: Hard-coded rule list per scaffold type
- **After**: Queries index based on what's being scaffolded

### New Skills (Index-Based)

**explaining-rules**:
- Explains which rules apply to files
- Uses index to discover all applicable rules

**fixing-rule-violations**:
- Provides fix instructions for violations
- Uses index to locate violated rules

**recommending-rules**:
- Analyzes codebase for rule coverage gaps
- Compares against all indexed rules

**migrating-rules**:
- Helps migrate code when rules are updated
- Compares rule versions from index

## Adding New Rules

### Process

1. **Add Rule File**: Place in `.claude/rules-master/` or `.claude/archive/`
2. **Regenerate Index**: Run `pnpm index-rules`
3. **Automatic Discovery**: All Skills automatically discover the new rule
4. **No Skill Changes**: No need to update skill code

### Example

```bash
# Add new rule
echo "---\ndescription: New framework rules\n---\n# Rules..." > .claude/archive/new-framework.mdc

# Regenerate index
pnpm index-rules

# All skills now discover new-framework.mdc automatically
```

## Best Practices for Skill Authors

### Use Index for Discovery

**Good**:
```markdown
### Step 1: Load Rule Index
Load @.claude/context/rule-index.json

### Step 2: Query by Technology
Query index.technology_map['nextjs'] for Next.js rules
```

**Avoid**:
```markdown
### Step 1: Hard-Coded Rules
Use these specific rules:
- .claude/rules-master/TECH_STACK_NEXTJS.md
- .claude/archive/nextjs.mdc
```

### Progressive Disclosure

**Good**: Load only relevant rules (5-10)
**Avoid**: Loading all 1,081 rules

### Technology Detection

**Good**: Detect technologies from files/imports, then query index
**Avoid**: Assuming specific technologies

## Context Usage

### Index Load (One-Time)
- **Size**: ~10-15k tokens (compressed)
- **When**: First skill invocation
- **Caching**: Index may be cached in Claude's memory

### Rule Loading (Per Query)
- **Size**: ~18k tokens (5-10 relevant rules)
- **When**: Each skill invocation
- **Optimization**: Only loads rules matching detected technologies

### Total Context Usage
- **Cold Start**: ~50k tokens (index + rules + skill)
- **Warm**: ~20k tokens (rules + skill, index cached)
- **Hot**: ~2k tokens (skill only, everything cached)

## Migration Checklist

- [x] Index generator script created
- [x] Package.json script added (`pnpm index-rules`)
- [x] Existing skills updated to use index
- [x] New skills created with index-based discovery
- [x] Documentation updated
- [ ] Index generated and tested (run `pnpm index-rules`)
- [ ] Skills tested with real scenarios
- [ ] Context usage validated

## Troubleshooting

### Index Not Found

**Error**: `@.claude/context/rule-index.json` not found

**Solution**: Run `pnpm index-rules` to generate the index

### Rules Not Discovered

**Issue**: Skill doesn't find relevant rules

**Check**:
1. Index is up to date (regenerate if needed)
2. Technology detection is correct
3. Technology name matches index keys (e.g., `nextjs` not `next.js`)

### Context Usage Too High

**Issue**: Context usage exceeds limits

**Solutions**:
1. Ensure progressive disclosure (only load relevant rules)
2. Compress index further (remove unnecessary metadata)
3. Cache index between invocations

## Future Enhancements

- **Incremental Updates**: Only regenerate changed rules
- **Rule Versioning**: Track rule versions in index
- **Usage Analytics**: Track which rules are used most
- **Smart Caching**: Cache frequently used rules

## References

- **Index Generator**: `scripts/generate-rule-index.mjs`
- **Index Location**: `.claude/context/rule-index.json`
- **Skills Directory**: `.claude/skills/`
- **Master Rules**: `.claude/rules-master/`
- **Archive Rules**: `.claude/archive/`

