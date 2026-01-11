# CUJ E2E Validation System - Deliverable Summary

## Overview

The CUJ E2E Validation System provides **comprehensive smoke testing** for the entire Customer User Journey (CUJ) system across all platforms (Claude, Cursor, Factory) with a **single command**.

## Deliverables

### 1. Main Validation Script

**File**: `.claude/tools/validate-cuj-e2e.mjs`

**Purpose**: Single command to validate entire CUJ system health

**Features**:

- ✅ Runs 6 validation test suites
- ✅ Platform compatibility checks (Claude, Cursor, Factory)
- ✅ JSON output for CI/CD integration
- ✅ Actionable fix recommendations
- ✅ Verbose mode for debugging
- ✅ Exit codes for automation

**Usage**:

```bash
# Basic validation
node .claude/tools/validate-cuj-e2e.mjs

# With fix suggestions
node .claude/tools/validate-cuj-e2e.mjs --fix-suggestions

# JSON output for CI/CD
node .claude/tools/validate-cuj-e2e.mjs --json
```

### 2. Comprehensive Documentation

**File**: `.claude/tools/README-CUJ-VALIDATION.md`

**Content**:

- Quick start guide
- Test suite descriptions
- Output format examples (text and JSON)
- CLI options reference
- CI/CD integration examples (GitHub Actions, GitLab CI)
- Common issues and fixes
- Platform compatibility matrix
- Troubleshooting guide
- Best practices

### 3. Quick Reference Card

**File**: `.claude/docs/CUJ-VALIDATION-QUICKREF.md`

**Content**:

- One-liner commands
- Validation checklist
- Status codes
- Platform compatibility summary
- Quick fix commands
- JSON output schema
- Related commands
- Help reference

## Validation Test Suites

### Suite 1: Config Validation

**Command**: `node scripts/validate-config.mjs`

**Checks**:

- Agent files referenced in `config.yaml`
- Template files referenced in agents/workflows
- Schema files integrity
- Hook files structure
- MCP server configuration
- SDK settings validation

### Suite 2: CUJ File Validation

**Command**: `node scripts/validate-cujs.mjs`

**Checks**:

- Required sections present
- Valid links and references
- Agent, skill, workflow references exist
- Execution mode matches CUJ-INDEX.md
- Success criteria format
- Encoding issues detection

### Suite 3: Reference Integrity

**Command**: `node scripts/validate-all-references.mjs`

**Checks**:

- Cross-file reference validation
- Template references
- Schema references
- Agent references
- Workflow references

### Suite 4: Workflow Dry-Run

**Method**: Calls `workflow_runner.js --dry-run` for each workflow

**Checks**:

- Workflow YAML structure
- Step definitions
- Agent references
- Validation gates
- **Note**: Does NOT execute workflows

### Suite 5: Skill Availability

**Method**: Checks `.claude/skills/<name>/SKILL.md` existence

**Checks**:

- Skill exists
- Skill frontmatter validity
- Allowed-tools configuration

### Suite 6: Platform Compatibility

**Method**: Analyzes execution mode and dependencies

**Checks**:

- Claude compatibility (all CUJs)
- Cursor compatibility (excludes Claude-only skills)
- Factory compatibility (similar to Cursor)
- Platform-specific blockers

## Output Formats

### Text Output (Human-Readable)

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

💡 Recommendations (3):
  CUJ-010:
    Issue: Workflow not found: feature-development.yaml
    Fix: Create missing workflow
    Command: touch .claude/workflows/feature-development.yaml

============================================================
✅ CUJ system health check PASSED
============================================================
```

### JSON Output (Machine-Readable)

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

| Option              | Description                                      |
| ------------------- | ------------------------------------------------ |
| `--verbose`         | Show detailed progress from each validation step |
| `--json`            | Output results as JSON (CI/CD friendly)          |
| `--fix-suggestions` | Generate actionable fix commands                 |
| `--help`            | Show help message                                |

## Exit Codes

| Code | Meaning                            |
| ---- | ---------------------------------- |
| `0`  | All validations passed             |
| `1`  | One or more validations failed     |
| `2`  | Fatal error (missing dependencies) |

## Platform Compatibility

### Claude-Only Skills

These skills are not available in Cursor or Factory:

- `recovery` - Workflow recovery protocol
- `optional-artifact-handler` - Optional artifact handling
- `conflict-resolution` - Multi-agent conflict resolution
- `api-contract-generator` - OpenAPI/Swagger generation

### Platform Coverage Summary

| Platform | Typical Coverage | Notes                           |
| -------- | ---------------- | ------------------------------- |
| Claude   | 80-90%           | Full skill and workflow support |
| Cursor   | 70-80%           | Excludes Claude-only skills     |
| Factory  | 70-80%           | Similar to Cursor               |

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

## Key Features

1. **Comprehensive Coverage**: 6 test suites covering all aspects of CUJ system
2. **Platform Awareness**: Checks compatibility across Claude, Cursor, Factory
3. **Actionable Recommendations**: Provides fix commands for identified issues
4. **CI/CD Ready**: JSON output and exit codes for automation
5. **Fast Execution**: Dry-run mode prevents actual workflow execution
6. **Developer Friendly**: Clear text output with status symbols
7. **Production Ready**: Robust error handling and graceful degradation

## Benefits

1. **Single Command**: No need to run multiple validation scripts manually
2. **Clear Status**: Instantly see CUJ system health at a glance
3. **Fix Guidance**: Get actionable commands to fix issues
4. **Platform Insights**: Understand cross-platform compatibility gaps
5. **CI/CD Integration**: Automate CUJ health checks in pipelines
6. **Comprehensive**: Validates all aspects of CUJ system integrity

## Example Workflow

### Development Workflow

```bash
# 1. Make changes to CUJ files or workflows
vim .claude/docs/cujs/CUJ-010.md

# 2. Run validation
node .claude/tools/validate-cuj-e2e.mjs

# 3. Fix any issues
node .claude/tools/validate-cuj-e2e.mjs --fix-suggestions

# 4. Verify fixes
node .claude/tools/validate-cuj-e2e.mjs

# 5. Commit changes
git add .
git commit -m "Update CUJ-010 documentation"
```

### CI/CD Workflow

```yaml
# .github/workflows/cuj-validation.yml
name: CUJ Validation
on: [push, pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: pnpm install
      - run: node .claude/tools/validate-cuj-e2e.mjs --json > report.json
      - uses: actions/upload-artifact@v3
        with:
          name: cuj-report
          path: report.json
```

## Future Enhancements

Potential additions to the validation system:

1. **Performance Metrics**: Track validation time and optimize slow steps
2. **Trend Analysis**: Compare validation results over time
3. **Auto-Fix Mode**: Automatically fix common issues
4. **Custom Validators**: Plugin system for project-specific validations
5. **Parallel Execution**: Run validation suites in parallel
6. **Incremental Validation**: Only validate changed CUJs
7. **Web Dashboard**: Visual dashboard for validation results

## Support

For issues or questions:

1. Check [Common Issues](../tools/README-CUJ-VALIDATION.md#common-issues-and-fixes) section
2. Review [Troubleshooting](../tools/README-CUJ-VALIDATION.md#troubleshooting) guide
3. Run with `--verbose --fix-suggestions` for detailed diagnostics
4. Open an issue with validation report JSON attached

## Related Documentation

- [CUJ Index](./CUJ-INDEX.md) - Complete CUJ catalog
- [Workflow Guide](../../workflows/WORKFLOW-GUIDE.md) - Workflow execution guide
- [Validation README](../../tools/README-CUJ-VALIDATION.md) - Detailed validation guide
- [Quick Reference](../CUJ-VALIDATION-QUICKREF.md) - Quick reference card
