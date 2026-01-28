# Knowledge Base Indexing

CSV-based knowledge base indexing system for 10x faster skill/agent/workflow discovery.

## Overview

The knowledge base index provides fast, cached access to all artifacts (skills, agents, workflows) in the `.claude/` directory. Index is CSV-based for simplicity, human-readability, and tool compatibility.

**Performance**: <50ms search queries (vs 2s+ directory scanning)

## Architecture

### Components

1. **Index Builder** (`.claude/lib/utils/build-knowledge-base-index.cjs`)
   - Scans `.claude/skills/`, `.claude/agents/`, `.claude/workflows/`
   - Parses YAML frontmatter + Markdown content
   - Generates CSV index with 11 fields
   - Atomic write (`.tmp` + rename)

2. **Index Reader** (`.claude/lib/utils/knowledge-base-reader.cjs`)
   - In-memory CSV parsing
   - Timestamp-based cache invalidation
   - Search, filter, get, stats functions

3. **CLI Tool** (`.claude/tools/cli/kb-search.cjs`)
   - Interactive search
   - Domain filtering
   - Tag-based discovery
   - Statistics reporting

## CSV Schema

**Location**: `.claude/context/artifacts/knowledge-base-index.csv`

**Fields** (11 columns):

| Field        | Type    | Description                                 | Example                           |
| ------------ | ------- | ------------------------------------------- | --------------------------------- |
| name         | string  | Artifact identifier (kebab-case)            | `tdd`                             |
| path         | string  | Relative path from PROJECT_ROOT             | `.claude/skills/tdd/SKILL.md`     |
| description  | string  | Brief description (max 200 chars)           | `Test-Driven Development...`      |
| domain       | enum    | `skill`, `agent`, `workflow`                | `skill`                           |
| complexity   | enum    | `LOW`, `MEDIUM`, `HIGH`, `EPIC`             | `HIGH`                            |
| use_cases    | string  | Comma-separated tags                        | `testing,quality,development`     |
| tools        | string  | Comma-separated tool names                  | `Read,Write,Edit,Bash`            |
| deprecated   | boolean | Is artifact deprecated                      | `false`                           |
| alias        | string  | Replacement artifact if deprecated          | `writing-skills`                  |
| usage_count  | integer | Invocation count                            | `0`                               |
| last_used    | date    | ISO timestamp of last use                   | `2026-01-28T10:00:00Z` (or empty) |

**Example Row**:

```csv
tdd,.claude/skills/tdd/SKILL.md,Test-Driven Development - RED GREEN REFACTOR,skill,LOW,"testing,quality","Read,Write,Bash",false,,42,2026-01-28
```

## Usage

### Build Index

```bash
# Initial build
node .claude/lib/utils/build-knowledge-base-index.cjs

# Output: Knowledge base index built: 1133 artifacts indexed
```

### CLI Search

```bash
# Search by keyword
node .claude/tools/cli/kb-search.cjs "testing"

# Filter by domain
node .claude/tools/cli/kb-search.cjs --domain skill

# Filter by tags (AND logic)
node .claude/tools/cli/kb-search.cjs --tags "testing,quality"

# Get artifact by name
node .claude/tools/cli/kb-search.cjs --get tdd

# Show statistics
node .claude/tools/cli/kb-search.cjs --stats
```

### Programmatic API

```javascript
const kb = require('.claude/lib/utils/knowledge-base-reader.cjs');

// Search by keyword
const results = kb.search('testing');
// Returns: Array of matching artifacts

// Filter by domain
const skills = kb.filterByDomain('skill');

// Filter by tags (AND logic)
const securitySkills = kb.filterByTags(['security', 'testing']);

// Get by exact name
const tdd = kb.get('tdd');

// Get statistics
const stats = kb.stats();
// Returns: { total: 1133, byDomain: {...}, byComplexity: {...} }

// List all
const all = kb.listAll();
```

## Security Controls

### SEC-KB-001: CSV Formula Injection Prevention

Formula characters (`=`, `+`, `-`, `@`) are prefixed with single quote to prevent execution in Excel/Google Sheets.

**Implementation**: `build-knowledge-base-index.cjs::escapeCSV()`

### SEC-KB-002: Path Validation

All paths validated against dangerous patterns before indexing:

- Path traversal (`../`)
- Absolute paths (`/`, `C:\`)
- Template injection (`${...}`)
- URL encoding (`%2e%2e%2f`)
- Null bytes (`\0`)

**Implementation**: `path-validator.cjs::validatePathSafety()`

### SEC-KB-003: Path Traversal Prevention

Indexed paths restricted to `.claude/` prefixes:

- `.claude/skills/`
- `.claude/agents/`
- `.claude/workflows/`
- `.claude/hooks/`
- `.claude/templates/`

**Implementation**: `path-validator.cjs::validatePathContext()`

### SEC-KB-004: Query Logging (Optional)

Index queries can be logged for auditing:

```javascript
const agentContext = getAgentContext();
logIndexQuery(query, agentContext, resultCount);
```

## Performance Benchmarks

| Operation                 | Index (CSV)   | Directory Scan |
| ------------------------- | ------------- | -------------- |
| Search by keyword         | <50ms         | ~2s            |
| Filter by domain          | <30ms         | ~2s            |
| Get by name               | <20ms         | ~1s            |
| Statistics                | <10ms         | ~3s            |
| **Performance Gain**      | **10x+**      | -              |

**Cache Strategy**: In-memory with timestamp-based invalidation (reload only if file modified).

## Index Maintenance

### Automatic Rebuild

Index is automatically rebuilt when artifact files are modified (via hook system).

**Hook**: `.claude/hooks/knowledge-base/index-invalidation.cjs`

**Trigger**: PostToolUse on Write/Edit to artifact files

### Manual Rebuild

```bash
node .claude/lib/utils/build-knowledge-base-index.cjs
```

### Validation

```bash
# Verify index exists
ls -la .claude/context/artifacts/knowledge-base-index.csv

# Check row count (should be 1000+)
wc -l .claude/context/artifacts/knowledge-base-index.csv

# Validate schema (11 columns)
head -1 .claude/context/artifacts/knowledge-base-index.csv
```

## Integration

### Skill Discovery

Skills now reference the knowledge base for discovery:

```markdown
## Skill Discovery Protocol

Before invoking a skill, use the knowledge index for discovery:

1. **Search by use case**: `searchSkills({ useCase: "testing" })`
2. **Filter by domain**: `searchSkills({ domain: "security" })`
3. **Fuzzy name search**: `searchSkills({ name: "tdd" })`

Do NOT assume skill names exist. Always verify against the index.
```

### Agent Assignment

The following agents use the knowledge base:

- `developer` - Skill discovery before coding
- `planner` - Workflow discovery for planning
- `qa` - Test skill discovery
- `security-architect` - Security skill discovery
- `router` - Agent/skill routing

## Troubleshooting

### Index File Missing

**Symptom**: `[kb-reader] Index file not found`

**Solution**: Run initial build:

```bash
node .claude/lib/utils/build-knowledge-base-index.cjs
```

### Stale Index

**Symptom**: New skills/agents not appearing in search

**Solution**: Rebuild index manually or verify hook is registered

### Malformed CSV Line

**Symptom**: `[kb-reader] Skipping malformed line 821`

**Cause**: CSV parsing error (likely embedded comma/quote in description)

**Solution**: Check line 821 in CSV, fix escaping, rebuild index

### Performance Issues

**Symptom**: Search queries taking >100ms

**Cause**: Cache invalidated on every query (file timestamp changing)

**Solution**: Verify file is not being modified during searches

## Backward Compatibility

The knowledge base index is **backward compatible**:

- Existing skill invocations (`Skill({ skill: "tdd" })`) continue to work
- Directory scanning is automatic fallback if index missing
- No breaking changes to agent prompts or workflows

## Future Enhancements

1. **Vector Embeddings**: Semantic search via embeddings
2. **Recommendation Engine**: Suggest skills based on context
3. **Skill Relationships**: Track skill dependencies and combinations
4. **Auto-Discovery**: Scan for new skills and auto-add to index
5. **Usage Tracking**: Increment `usage_count` on skill invocation
6. **Fuzzy Search**: Levenshtein distance for typo tolerance

## ADRs

- **ADR-050**: Knowledge Base CSV Schema Design
- **ADR-051**: Index Invalidation Strategy

## Files

- **Index Builder**: `.claude/lib/utils/build-knowledge-base-index.cjs`
- **Index Reader**: `.claude/lib/utils/knowledge-base-reader.cjs`
- **Path Validator**: `.claude/lib/utils/path-validator.cjs`
- **CLI Tool**: `.claude/tools/cli/kb-search.cjs`
- **Tests**: `.claude/lib/utils/__tests__/knowledge-base-index.test.cjs`
- **Index Output**: `.claude/context/artifacts/knowledge-base-index.csv`
- **Documentation**: `.claude/docs/KNOWLEDGE_BASE.md`

## Related Documentation

- **Feature Spec**: `.claude/context/artifacts/specs/knowledge-base-indexing-spec.md`
- **Security Design**: `.claude/context/artifacts/security-mitigation-design-20260128.md`
- **FILE_PLACEMENT_RULES.md**: Artifact directory structure
