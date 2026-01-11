# CUJ E2E Validation System

## Overview

The CUJ E2E validation system provides comprehensive smoke testing for the entire Customer User Journey (CUJ) system across all platforms (Claude, Cursor, Factory).

## Quick Start

```bash
# Run basic validation
node .claude/tools/validate-cuj-e2e.mjs

# Get actionable fix recommendations
node .claude/tools/validate-cuj-e2e.mjs --fix-suggestions

# Generate JSON report for CI/CD
node .claude/tools/validate-cuj-e2e.mjs --json > cuj-health-report.json
```

## What It Tests

The E2E validation runs **6 comprehensive test suites**:

### 1. Config Validation (`validate-config.mjs`)

- Agent files referenced in `config.yaml`
- Template files referenced in agents/workflows
- Schema files integrity
- Hook files structure
- MCP server configuration
- SDK settings validation

### 2. CUJ File Validation (`validate-cujs.mjs`)

- Required sections present
- Valid links and references
- Agent, skill, workflow references exist
- Execution mode matches CUJ-INDEX.md mapping
- Success criteria format
- Encoding issues detection

### 3. Reference Integrity (`validate-all-references.mjs`)

- Cross-file reference validation
- Template references
- Schema references
- Agent references
- Workflow references

### 4. Workflow Dry-Run

- For each workflow-based CUJ:
  - Validates workflow YAML structure
  - Checks step definitions
  - Verifies agent references
  - Tests validation gates
  - **Does NOT execute workflows** (dry-run mode only)

### 5. Skill Availability

- For each skill-only CUJ:
  - Verifies skill exists (`.claude/skills/<name>/SKILL.md`)
  - Checks skill frontmatter validity
  - Validates allowed-tools configuration

### 6. Platform Compatibility

- Claude compatibility (all CUJs)
- Cursor compatibility (excludes Claude-only skills)
- Factory compatibility (similar to Cursor)
- Identifies platform-specific blockers

## Output Format

### Text Output (Default)

```
🔍 Comprehensive E2E CUJ Smoke Test
============================================================
  ✓ Config validation
  ✓ CUJ file validation
  ✓ Reference integrity validation

============================================================
📊 CUJ System Analysis

Found 55 CUJs in mapping table

============================================================
📈 Validation Summary
============================================================

Total CUJs: 55
  ✅ Runnable (Claude): 45
  ✅ Runnable (Cursor): 40
  ✅ Runnable (Factory): 38
  ⚠️  Manual Only: 3
  ❌ Blocked: 7

❌ Errors (2):
  - Parse CUJ-INDEX.md: Missing schema reference

⚠️  Warnings (5):
  - CUJ-010: Skill may not exist: api-contract-generator

💡 Recommendations (3):
  CUJ-010:
    Issue: Workflow not found: feature-development.yaml
    Fix: Create missing workflow: .claude/workflows/feature-development.yaml
    Command: touch .claude/workflows/feature-development.yaml

============================================================
✅ CUJ system health check PASSED
============================================================
```

### JSON Output

```json
{
  "timestamp": "2026-01-05T10:30:00.000Z",
  "summary": {
    "total_cujs": 55,
    "runnable_claude": 45,
    "runnable_cursor": 40,
    "runnable_factory": 38,
    "manual_only": 3,
    "blocked": 7
  },
  "details": {
    "CUJ-001": {
      "status": "runnable",
      "platforms": ["claude", "cursor", "factory"],
      "execution_mode": "skill-only",
      "skill": "scaffolder"
    },
    "CUJ-010": {
      "status": "blocked",
      "platforms": [],
      "execution_mode": "feature-development.yaml",
      "issues": ["Workflow not found: feature-development.yaml"]
    }
  },
  "recommendations": [
    {
      "cujId": "CUJ-010",
      "issue": "Workflow not found: feature-development.yaml",
      "fix": "Create missing workflow",
      "command": "touch .claude/workflows/feature-development.yaml"
    }
  ],
  "errors": [],
  "warnings": []
}
```

## CLI Options

| Option              | Description                                      | Example             |
| ------------------- | ------------------------------------------------ | ------------------- |
| `--verbose`         | Show detailed progress from each validation step | `--verbose`         |
| `--json`            | Output results as JSON (CI/CD friendly)          | `--json`            |
| `--fix-suggestions` | Generate actionable fix commands                 | `--fix-suggestions` |
| `--help`            | Show help message                                | `--help`            |

## Exit Codes

| Code | Meaning                            | Action                       |
| ---- | ---------------------------------- | ---------------------------- |
| `0`  | All validations passed             | Proceed with confidence      |
| `1`  | One or more validations failed     | Review errors and fix issues |
| `2`  | Fatal error (missing dependencies) | Install dependencies         |

## CI/CD Integration

### GitHub Actions Example

```yaml
name: CUJ System Health Check

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  validate-cujs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: pnpm install
      - name: Run CUJ E2E Validation
        run: node .claude/tools/validate-cuj-e2e.mjs --json > cuj-report.json
      - name: Upload Report
        uses: actions/upload-artifact@v3
        with:
          name: cuj-validation-report
          path: cuj-report.json
```

### GitLab CI Example

```yaml
cuj-validation:
  stage: test
  script:
    - pnpm install
    - node .claude/tools/validate-cuj-e2e.mjs --json > cuj-report.json
  artifacts:
    reports:
      junit: cuj-report.json
```

## Common Issues and Fixes

### Issue: "Workflow not found"

**Problem**: CUJ references a workflow that doesn't exist.

**Fix**:

```bash
# Create the workflow file
touch .claude/workflows/<workflow-name>.yaml

# Or copy from a template
cp .claude/workflows/greenfield-fullstack.yaml .claude/workflows/<workflow-name>.yaml
```

### Issue: "Skill not found"

**Problem**: CUJ references a skill that doesn't exist.

**Fix**:

```bash
# Create the skill directory and SKILL.md
mkdir -p .claude/skills/<skill-name>
touch .claude/skills/<skill-name>/SKILL.md

# Or use the scaffolder skill
node .claude/tools/skill-scaffolder.mjs --name <skill-name>
```

### Issue: "Schema not found"

**Problem**: Workflow step references a schema that doesn't exist.

**Fix**:

```bash
# Create the schema file
touch .claude/schemas/<schema-name>.schema.json

# Or copy from a template
cp .claude/schemas/artifact_manifest.schema.json .claude/schemas/<schema-name>.schema.json
```

### Issue: "Execution mode mismatch"

**Problem**: CUJ file declares one execution mode, but CUJ-INDEX.md maps to another.

**Fix**:

1. Decide which is correct (CUJ file or CUJ-INDEX.md)
2. Update the incorrect one to match

**Example** (CUJ file):

```markdown
**Execution Mode**: `greenfield-fullstack.yaml`
```

**Example** (CUJ-INDEX.md):

```markdown
| CUJ-004 | greenfield-fullstack.yaml | `.claude/workflows/greenfield-fullstack.yaml` | null |
```

## Platform Compatibility

### Claude-Only Skills

These skills are not available in Cursor or Factory:

- `recovery` - Workflow recovery protocol
- `optional-artifact-handler` - Optional artifact handling
- `conflict-resolution` - Multi-agent conflict resolution
- `api-contract-generator` - OpenAPI/Swagger generation

**Recommendation**: Port these skills to Cursor for broader compatibility, or provide manual alternatives in CUJ documentation.

### Platform Coverage Summary

| Platform | Typical Coverage | Notes                           |
| -------- | ---------------- | ------------------------------- |
| Claude   | 80-90%           | Full skill and workflow support |
| Cursor   | 70-80%           | Excludes Claude-only skills     |
| Factory  | 70-80%           | Similar to Cursor               |

## Troubleshooting

### Validation Takes Too Long

**Problem**: E2E validation runs for >5 minutes.

**Solution**:

1. Use `--json` flag to skip verbose output
2. Check if workflows have circular dependencies
3. Ensure workflow dry-run doesn't attempt actual execution

### Missing Dependencies

**Problem**: `js-yaml` not installed.

**Solution**:

```bash
pnpm install js-yaml
```

### False Positives

**Problem**: Validation reports issues that don't actually exist.

**Solution**:

1. Check file paths are correct (case-sensitive)
2. Regenerate rule index: `pnpm index-rules`
3. Clear validation cache: `rm -rf .claude/context/cache`

## Best Practices

1. **Run before commits**: Ensure CUJ system is healthy before pushing changes
2. **Use in CI/CD**: Automate CUJ health checks in your pipeline
3. **Track trends**: Monitor blocked/runnable CUJ counts over time
4. **Fix blockers first**: Prioritize fixing blocked CUJs before adding new ones
5. **Platform parity**: Aim for 80%+ compatibility across all platforms

## Related Documentation

- [CUJ Index](../docs/cujs/CUJ-INDEX.md) - Complete CUJ catalog
- [Workflow Guide](../workflows/WORKFLOW-GUIDE.md) - Workflow execution guide
- [Skill Documentation](../skills/) - Individual skill docs
- [Validation Scripts](../../scripts/) - Other validation tools

## Support

For issues or questions:

1. Check [Common Issues](#common-issues-and-fixes) section
2. Review [Troubleshooting](#troubleshooting) guide
3. Run with `--verbose --fix-suggestions` for detailed diagnostics
4. Open an issue with validation report JSON attached
