# Rule Index Version Validation - Quick Reference

## Quick Commands

```bash
# Check version only
pnpm validate:index-version

# Check paths only (skip version)
node scripts/validate-rule-index-paths.mjs --skip-version

# Full validation (version + paths)
pnpm validate:index-paths

# Run test suite
pnpm test:version-validation

# Fix version mismatch
pnpm index-rules
```

## Exit Codes

| Code | Meaning | Action |
|------|---------|--------|
| `0` | ✅ All passed | None |
| `1` | ⚠️ Mismatch/broken | `pnpm index-rules` |
| `2` | ❌ File missing | `pnpm index-rules` |

## Output Examples

### ✅ Success
```
📋 Rule Index Version Check:
   Current:  1.1.0
   Expected: 1.1.0
   Status:   ✅ UP-TO-DATE
```

### ⚠️ Version Mismatch
```
📋 Rule Index Version Check:
   Current:  1.0.0
   Expected: 1.1.0
   Status:   ⚠️ VERSION MISMATCH (RUN 'PNPM INDEX-RULES' TO UPDATE)
```

### ⚠️ Missing Version
```
📋 Rule Index Version Check:
   Current:  missing
   Expected: 1.1.0
   Status:   ⚠️ VERSION FIELD MISSING IN RULE-INDEX.JSON
```

### ❌ File Not Found
```
📋 Rule Index Version Check:
   Current:  file-not-found
   Expected: 1.1.0
   Status:   ❌ RULE INDEX FILE NOT FOUND
```

## CI Integration

### GitHub Actions
```yaml
- name: Validate Rule Index Version
  run: pnpm validate:index-version
```

### Pre-commit Hook
```bash
#!/bin/bash
pnpm validate:index-version || {
  echo "Run 'pnpm index-rules' to update"
  exit 1
}
```

## Troubleshooting

**Problem**: Version mismatch or missing
**Solution**: `pnpm index-rules`

**Problem**: File not found
**Solution**: `pnpm index-rules`

**Problem**: Broken paths
**Solution**: Ensure all rule files exist, then `pnpm index-rules`

## Version Semantics

- **Major** (X.0.0): Breaking index structure changes
- **Minor** (1.X.0): New rules, paths changed, new metadata
- **Patch** (1.1.X): Bug fixes, metadata corrections

Current: `1.1.0`

See `scripts/README-VERSION-VALIDATION.md` for full documentation.
