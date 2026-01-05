# Rule Auditor - Quick Start Guide

Get started with the rule-auditor executable in 5 minutes.

## Prerequisites

- Node.js 18+ installed
- Rule index generated (run `pnpm index-rules` if not already done)

## Quick Test

1. **Audit a directory**:
   ```bash
   node .claude/skills/rule-auditor/scripts/audit.mjs src/
   ```

2. **Preview fixes**:
   ```bash
   node .claude/skills/rule-auditor/scripts/audit.mjs src/ --fix-dry-run
   ```

3. **Apply fixes**:
   ```bash
   node .claude/skills/rule-auditor/scripts/audit.mjs src/ --fix
   ```

## Common Commands

### Development Workflow

```bash
# Audit before commit
node .claude/skills/rule-auditor/scripts/audit.mjs src/ --strict

# Preview auto-fixes
node .claude/skills/rule-auditor/scripts/audit.mjs src/ --fix-dry-run

# Apply auto-fixes
node .claude/skills/rule-auditor/scripts/audit.mjs src/ --fix

# Review changes
git diff

# Run tests
npm test

# If all good, commit
git add -A
git commit -m "fix: auto-fix rule violations"

# Clean up backups
rm **/*.bak
```

### CI/CD Integration

```bash
# Generate JSON report
node .claude/skills/rule-auditor/scripts/audit.mjs src/ --format json > audit-report.json

# Check for errors
jq '.audit_summary.errors' audit-report.json
```

### Focused Audits

```bash
# Only errors
node .claude/skills/rule-auditor/scripts/audit.mjs src/ --severity error

# Specific rules only
node .claude/skills/rule-auditor/scripts/audit.mjs src/ --rules nextjs,typescript

# Single file
node .claude/skills/rule-auditor/scripts/audit.mjs src/components/App.tsx
```

## NPM Integration

Add to `package.json`:

```json
{
  "scripts": {
    "audit": "node .claude/skills/rule-auditor/scripts/audit.mjs src/",
    "audit:fix": "node .claude/skills/rule-auditor/scripts/audit.mjs src/ --fix",
    "audit:dry-run": "node .claude/skills/rule-auditor/scripts/audit.mjs src/ --fix-dry-run",
    "test:rules": "node .claude/skills/rule-auditor/scripts/test-audit.mjs"
  }
}
```

Usage:
```bash
npm run audit
npm run audit:fix
npm run test:rules
```

## Pre-commit Hook

Create `.git/hooks/pre-commit`:

```bash
#!/bin/bash
# Auto-audit before commit

staged_files=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx|js|jsx)$')

if [ -z "$staged_files" ]; then
  exit 0
fi

echo "Running rule audit on staged files..."
node .claude/skills/rule-auditor/scripts/audit.mjs $staged_files --strict

if [ $? -ne 0 ]; then
  echo "❌ Rule violations detected. Commit aborted."
  echo "Run 'npm run audit:fix' to auto-fix violations."
  exit 1
fi

echo "✅ Rule audit passed"
```

Make executable:
```bash
chmod +x .git/hooks/pre-commit
```

## GitHub Actions

Create `.github/workflows/code-quality.yml`:

```yaml
name: Code Quality

on: [pull_request]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18

      - name: Generate Rule Index
        run: pnpm index-rules

      - name: Run Rule Audit
        run: |
          node .claude/skills/rule-auditor/scripts/audit.mjs src/ --format json > audit-report.json

      - name: Check for Violations
        run: |
          errors=$(jq '.audit_summary.errors' audit-report.json)
          if [ "$errors" -gt 0 ]; then
            echo "::error::$errors rule violations detected"
            jq '.violations_found[] | select(.severity == "error")' audit-report.json
            exit 1
          fi

      - name: Upload Audit Report
        uses: actions/upload-artifact@v3
        with:
          name: audit-report
          path: audit-report.json
```

## Troubleshooting

### "Failed to load rule index"

**Solution**: Generate the rule index:
```bash
pnpm index-rules
```

### "No files found to audit"

**Solution**: Ensure the target path contains code files (.ts, .tsx, .js, .jsx, .py, etc.)

### "Invalid regex pattern"

**Solution**: Some rules have invalid regex patterns. The script handles these gracefully with warnings. To fix, update the rule file's `<validation>` block.

### Regex patterns not matching

**Solution**: Escape regex special characters in `<validation>` blocks:
```markdown
<validation>
forbidden_patterns:
  - pattern: "console\\.log\\((.*)\\)"  # ✅ Escaped
    message: "Remove console.log"
    severity: "warning"
    fix: ""
</validation>
```

## Next Steps

- Read the [README](./README.md) for detailed documentation
- View [example outputs](./EXAMPLE_OUTPUT.md) for reference
- Check the [implementation summary](./IMPLEMENTATION_SUMMARY.md) for technical details

## Support

For issues or questions:
1. Check the [README](./README.md) troubleshooting section
2. Review [example outputs](./EXAMPLE_OUTPUT.md)
3. Run the test suite: `node .claude/skills/rule-auditor/scripts/test-audit.mjs`
