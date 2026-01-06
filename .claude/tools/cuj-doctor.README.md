# CUJ Doctor - Comprehensive CUJ Health Check

## Purpose

`cuj-doctor` is a unified CLI tool that performs comprehensive health checks on the CUJ (Customer User Journey) system, reporting all issues in a single command.

## Features

The doctor performs 7 comprehensive health checks:

1. **CUJ Count Drift** - Compares doc count vs index vs registry
2. **Missing Workflows** - Verifies all referenced workflows exist
3. **Missing Skills** - Verifies all referenced skills exist
4. **Broken Links** - Scans for broken links in CUJ documentation
5. **Platform Compatibility** - Checks platform matrix consistency
6. **Success Criteria Measurability** - Identifies non-measurable criteria
7. **Execution Mode Consistency** - Detects mode mismatches

## Usage

### Basic Health Check

```bash
pnpm cuj:doctor
```

This runs all checks and outputs a formatted report with:
- ❌ Critical issues (blocking)
- ⚠️ Warnings
- ✅ Passing checks
- Summary statistics

### JSON Output

```bash
pnpm cuj:doctor:json
```

Outputs results as JSON for programmatic processing.

## Exit Codes

- `0` - All checks passed
- `1` - Critical issues found (blocks CI/CD)

## Integration with CI/CD

Add to your CI/CD pipeline to enforce CUJ quality:

```yaml
# .github/workflows/validate-cujs.yml
name: Validate CUJs

on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: pnpm install
      - run: pnpm cuj:doctor
```

## What It Reports

### Critical Issues (Blocking)

- CUJ count drift between docs, index, and registry
- Orphaned CUJ docs (in docs but not in registry)
- Missing CUJ docs (in registry but no file)
- Missing workflow references

### Warnings (Non-blocking)

- Broken links in documentation
- Missing or invalid platform arrays
- Non-measurable success criteria
- Invalid execution modes
- Missing skill references

### Statistics

- Total CUJ count (docs, registry, index)
- Total links and broken link count
- Measurability metrics for success criteria

## Example Output

```
🏥 CUJ Doctor - Health Check
Analyzing CUJ system...

======================================================================
CUJ DOCTOR REPORT
======================================================================

📊 Statistics:
  docCount: 59
  registryCount: 52
  indexCount: 0
  totalLinks: 146
  brokenLinks: 2

❌ Critical Issues (2):
  • CUJ count drift detected: Docs (59) ≠ Registry (52)
  • Orphaned CUJ docs: CUJ-056.md, CUJ-057.md

⚠️ Warnings (5):
  • CUJ-056: Broken link to "../STATELESS_RECOVERY.md"
  • CUJ-001: Missing platforms array

✅ Passed Checks (2):
  • All workflow references valid
  • All skill references valid

======================================================================
Status: FAILED
Critical: 2 | Warnings: 5 | Passed: 2
======================================================================
```

## Related Commands

- `pnpm sync-cuj-registry` - Sync registry with CUJ docs
- `pnpm cuj:validate` - Validate individual CUJ
- `pnpm validate:cujs:e2e` - End-to-end CUJ validation

## Troubleshooting

### "CUJ count drift detected"

Run `pnpm sync-cuj-registry` to synchronize the registry with CUJ documentation files.

### "Orphaned CUJ docs"

Either:
1. Add the CUJ to the registry using `sync-cuj-registry`
2. Remove the orphaned CUJ doc if it's no longer needed

### "Missing workflow"

Create the missing workflow file in `.claude/workflows/` or update the CUJ to reference an existing workflow.

### "Broken link"

Update the CUJ documentation to fix the broken link path.
