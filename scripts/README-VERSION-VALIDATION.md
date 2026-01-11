# Rule Index Version Validation

## Overview

The rule index version validation system ensures that the `.claude/context/rule-index.json` file is up-to-date with the expected version. This prevents Skills from consuming outdated index structures that may be missing new metadata or have incompatible formats.

## Features

- **Version Compatibility Check**: Validates that the rule index version matches the expected version
- **CI-Friendly Exit Codes**: Returns specific exit codes for automation
- **Self-Healing Guidance**: Provides clear instructions on how to fix version mismatches
- **Flexible Validation**: Can check version only, paths only, or both

## Exit Codes

| Exit Code | Meaning                                          | Action Required                            |
| --------- | ------------------------------------------------ | ------------------------------------------ |
| `0`       | All validations passed                           | None                                       |
| `1`       | Version mismatch (warning) or broken paths found | Run `pnpm index-rules` to regenerate index |
| `2`       | Version file missing (error)                     | Run `pnpm index-rules` to create index     |

## Usage

### Check Version Only

Validates only the version field without checking file paths:

```bash
# Using npm script (recommended)
pnpm validate:index-version

# Direct script execution
node scripts/validate-rule-index-paths.mjs --check-version
```

**Output Example (Success)**:

```
📋 Rule Index Version Check:
   Current:  1.1.0
   Expected: 1.1.0
   Status:   ✅ UP-TO-DATE
```

**Output Example (Mismatch)**:

```
📋 Rule Index Version Check:
   Current:  1.0.0
   Expected: 1.1.0
   Status:   ⚠️ VERSION MISMATCH (RUN 'PNPM INDEX-RULES' TO UPDATE)
```

### Check Paths Only

Validates paths without checking version:

```bash
node scripts/validate-rule-index-paths.mjs --skip-version
```

### Full Validation

Validates both version and paths (default behavior):

```bash
# Using npm script (recommended)
pnpm validate:index-paths

# Direct script execution
node scripts/validate-rule-index-paths.mjs
```

**Output Example**:

```
🔍 Validating rule index paths...

📋 Rule Index Version Check:
   Current:  1.1.0
   Expected: 1.1.0
   Status:   ✅ UP-TO-DATE

Found 1089 rules in index

============================================================
Summary:
  ✅ Valid paths: 1089/1089
  ❌ Broken paths: 0/1089
============================================================

✅ All rule index paths are valid!
```

### Help

Display usage instructions:

```bash
node scripts/validate-rule-index-paths.mjs --help
```

## Version Numbering

The rule index follows semantic versioning:

- **Major** (`X.0.0`): Breaking changes to index structure (e.g., renamed fields, removed properties)
- **Minor** (`1.X.0`): New rules added, rule paths changed, or new metadata fields added
- **Patch** (`1.1.X`): Bug fixes, metadata corrections, or re-indexing without content changes

### Updating Expected Version

When the index structure changes, update the expected version in `scripts/validate-rule-index-paths.mjs`:

```javascript
// Expected rule index version (increment when index structure changes)
const EXPECTED_INDEX_VERSION = '1.2.0'; // Update this
```

## Automation and CI Integration

### Pre-commit Hook

Add to `.git/hooks/pre-commit` to prevent commits with outdated indexes:

```bash
#!/bin/bash
pnpm validate:index-version
if [ $? -ne 0 ]; then
  echo "❌ Rule index version mismatch. Run 'pnpm index-rules' to update."
  exit 1
fi
```

### CI Pipeline

Add to GitHub Actions workflow:

```yaml
- name: Validate Rule Index Version
  run: pnpm validate:index-version
```

### NPM Scripts

Available in `package.json`:

```json
{
  "scripts": {
    "validate:index-version": "node scripts/validate-rule-index-paths.mjs --check-version",
    "validate:index-paths": "node scripts/validate-rule-index-paths.mjs",
    "test:version-validation": "node scripts/test-version-validation.mjs"
  }
}
```

## Testing

Run comprehensive test suite to verify all version validation scenarios:

```bash
pnpm test:version-validation
```

**Test Coverage**:

1. ✅ Version matches expected version
2. ⚠️ Version mismatch detected
3. ⚠️ Missing version field
4. ✅ Full validation (version + paths)

## Troubleshooting

### Version Mismatch Error

**Symptom**: Exit code 1 with "VERSION MISMATCH" message

**Solution**:

```bash
pnpm index-rules
```

This regenerates the rule index with the current expected version.

### Missing Version Field

**Symptom**: Exit code 1 with "VERSION FIELD MISSING" message

**Solution**:

```bash
pnpm index-rules
```

This regenerates the rule index with proper version metadata.

### File Not Found Error

**Symptom**: Exit code 2 with "Rule index file not found" message

**Solution**:

```bash
pnpm index-rules
```

This creates a new rule index file.

## How It Works

1. **Read Index**: Load `.claude/context/rule-index.json`
2. **Extract Version**: Parse the `version` field from the index
3. **Compare**: Check if current version matches expected version
4. **Report**: Display formatted results with actionable guidance
5. **Exit**: Return appropriate exit code for automation

## Version History

| Version | Date       | Changes                                                     |
| ------- | ---------- | ----------------------------------------------------------- |
| 1.1.0   | 2026-01-04 | Added versioning metadata for skills compatibility tracking |
| 1.0.0   | 2025-12-XX | Initial rule index structure                                |

## Related Documentation

- **Rule Index System**: `.claude/CLAUDE.md` (Rule Index System section)
- **Rule Index Migration**: `.claude/docs/RULE_INDEX_MIGRATION.md`
- **Skill Development**: `.claude/skills/README.md`

## API Reference

### `validateVersion()`

Returns a promise that resolves to a version validation result:

```javascript
{
  valid: boolean,
  current: string,  // Current version or 'missing'/'file-not-found'
  expected: string, // Expected version constant
  message: string   // Human-readable status message
}
```

### `displayVersionCheck(result, exitOnMismatch)`

Displays version check results and returns exit code:

- `result`: Version validation result object
- `exitOnMismatch`: Whether to treat mismatch as error (default: true)
- Returns: Exit code (0, 1, or 2)

### `validateRuleIndexPaths(fix, skipVersionCheck)`

Main validation function:

- `fix`: Attempt to fix broken paths (not yet implemented)
- `skipVersionCheck`: Skip version validation and only check paths
