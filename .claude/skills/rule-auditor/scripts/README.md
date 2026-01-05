# Rule Auditor - Executable Scripts

This directory contains executable scripts for the rule-auditor skill, enabling CLI usage and programmatic validation.

## Scripts

### `audit.mjs`

Main executable for validating code against project rules.

**Features**:
- Loads rule index dynamically (no hard-coded rules)
- Detects technologies from file extensions and imports
- Extracts validation patterns from `<validation>` blocks in rules
- Supports auto-fix mode with backups
- Outputs JSON conforming to `skill-rule-auditor-output.schema.json`

**Usage**:
```bash
# Audit a directory
node audit.mjs src/components/

# Audit specific file with JSON output
node audit.mjs src/App.tsx --format json

# Preview fixes (dry run)
node audit.mjs src/ --fix-dry-run

# Apply fixes (creates .bak backups)
node audit.mjs src/ --fix

# Audit with specific rules only
node audit.mjs src/ --rules nextjs,typescript

# Strict mode (fail on any violation)
node audit.mjs src/ --strict

# Filter by severity
node audit.mjs src/ --severity error
```

**CLI Options**:
- `--format <type>`: Output format (json, markdown) - default: json
- `--fix`: Apply fixes with confirmation (creates .bak backups)
- `--fix-dry-run`: Preview fixes without modifying files
- `--rules <list>`: Comma-separated list of rules to apply
- `--strict`: Exit with error code if any violations found
- `--severity <level>`: Filter violations by severity (error, warning, info)

**Exit Codes**:
- `0`: No errors found (or only warnings in non-strict mode)
- `1`: Errors found, or any violations in strict mode

**Output Schema**:

All JSON output conforms to `.claude/schemas/skill-rule-auditor-output.schema.json`:

```json
{
  "skill_name": "rule-auditor",
  "files_audited": [
    {
      "path": "src/components/App.tsx",
      "lines_analyzed": 150,
      "violations_count": 2
    }
  ],
  "rules_applied": [
    {
      "rule_path": ".claude/rules-master/TECH_STACK_NEXTJS.md",
      "rule_name": "TECH_STACK_NEXTJS",
      "violations_found": 2
    }
  ],
  "compliance_score": 87.5,
  "violations_found": [
    {
      "file": "src/components/App.tsx",
      "line": 23,
      "column": 5,
      "rule": "TECH_STACK_NEXTJS",
      "severity": "error",
      "message": "Avoid using 'any' type",
      "code_snippet": "const user: any = getUser();",
      "fix_instruction": "const user: unknown = getUser();"
    }
  ],
  "fixes_applied": [],
  "rule_index_consulted": true,
  "technologies_detected": ["typescript", "react", "nextjs"],
  "audit_summary": {
    "total_files": 1,
    "total_lines": 150,
    "total_violations": 2,
    "errors": 1,
    "warnings": 1,
    "info": 0
  },
  "timestamp": "2026-01-04T12:00:00.000Z"
}
```

### `test-audit.mjs`

Test suite for the audit script.

**Usage**:
```bash
node test-audit.mjs
```

**Tests**:
- ✅ Basic audit functionality
- ✅ Technology detection (TypeScript, React, etc.)
- ✅ Dry-run fix mode (preview without changes)
- ✅ Fix mode with backups (.bak files created)
- ✅ Compliance score calculation (0-100 range)
- ✅ Audit summary statistics
- ✅ Exit codes (0 for success, 1 for errors)

## How It Works

1. **Load Rule Index**: Reads `.claude/context/rule-index.json` to discover all 1,081+ rules
2. **Detect Technologies**: Analyzes file extensions, imports, and content to detect technologies
3. **Query Technology Map**: Finds relevant rules from `technology_map` based on detected technologies
4. **Extract Validation Patterns**: Parses `<validation>` blocks in rule files for forbidden patterns
5. **Run Validation**: Executes regex patterns against target files
6. **Apply Fixes** (optional): Applies fixes with backups if `--fix` or `--fix-dry-run` is used
7. **Output Results**: Generates JSON conforming to schema

## Validation Pattern Format

Rules can include `<validation>` blocks with forbidden patterns:

```markdown
<validation>
forbidden_patterns:
  - pattern: "console\\.log\\((.*)\\)"
    message: "Remove console.log statements before commit"
    severity: "warning"
    fix: ""

  - pattern: "const (\\w+): any"
    message: "Avoid using 'any' type"
    severity: "error"
    fix: "const $1: unknown"
</validation>
```

**Fix Syntax**:
- `""` (empty string): Delete entire match
- `"const $1"`: Use capture groups ($1, $2, etc.)
- `"// Removed"`: Replace with comment
- Fixed string: Replace with literal text

## Integration Examples

### Pre-commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit

# Get staged files
staged_files=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx|js|jsx)$')

if [ -z "$staged_files" ]; then
  exit 0
fi

# Run audit
node .claude/skills/rule-auditor/scripts/audit.mjs "$staged_files" --strict

if [ $? -ne 0 ]; then
  echo "❌ Rule violations detected. Commit aborted."
  exit 1
fi
```

### GitHub Actions

```yaml
name: Code Quality

on: [pull_request]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run Rule Audit
        run: |
          node .claude/skills/rule-auditor/scripts/audit.mjs src/ --format json > audit-report.json

      - name: Check for Violations
        run: |
          errors=$(jq '.audit_summary.errors' audit-report.json)
          if [ "$errors" -gt 0 ]; then
            echo "::error::$errors rule violations detected"
            exit 1
          fi
```

### NPM Script

Add to `package.json`:

```json
{
  "scripts": {
    "audit": "node .claude/skills/rule-auditor/scripts/audit.mjs src/",
    "audit:fix": "node .claude/skills/rule-auditor/scripts/audit.mjs src/ --fix",
    "audit:dry-run": "node .claude/skills/rule-auditor/scripts/audit.mjs src/ --fix-dry-run"
  }
}
```

## Troubleshooting

### "Failed to load rule index"

**Solution**: Run `pnpm index-rules` to generate the rule index:

```bash
pnpm index-rules
```

### "No files found to audit"

**Solution**: Ensure the target path contains code files (.ts, .tsx, .js, .jsx, .py, etc.)

### "Invalid regex pattern"

**Solution**: The rule file contains an invalid regex pattern. Check the `<validation>` block in the rule file and fix the regex pattern.

### Regex patterns not matching

**Solution**: Remember to escape regex special characters in `<validation>` blocks:
- Use `\\.` for literal dot
- Use `\\(` and `\\)` for literal parentheses
- Use `\\[` and `\\]` for literal brackets

## Performance

- **Incremental Indexing**: Rule index uses file mtimes to skip unchanged rules
- **Progressive Disclosure**: Only loads 5-10 relevant rules, not all 1,081
- **Parallel File Processing**: Files are read in parallel for faster audits
- **Caching**: Rule index metadata is cached between runs

## Contributing

When adding new validation patterns to rules:

1. Use `<validation>` blocks (preferred over frontmatter)
2. Test regex patterns before committing
3. Add `fix` field for auto-fixable patterns
4. Use capture groups ($1, $2) to preserve variable names
5. Set appropriate severity (error, warning, info)

Example:

```markdown
<validation>
forbidden_patterns:
  - pattern: "var (\\w+) ="
    message: "Use 'const' or 'let' instead of 'var'"
    severity: "warning"
    fix: "const $1 ="
</validation>
```
