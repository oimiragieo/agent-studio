# Workflow Path Validator

A comprehensive validation tool to prevent workflow path inconsistencies across the LLM-RULES project.

---

## Quick Start

### Basic Validation
```bash
node .claude/tools/validate-workflow-paths.mjs
```

### Auto-Fix Mode
```bash
node .claude/tools/validate-workflow-paths.mjs --fix
```

---

## What It Validates

### 1. Double-Prefix Detection
Detects malformed paths with duplicate prefixes:
- ❌ `.claude/workflows/.claude/workflows/file.yaml`
- ❌ `workflows/.claude/workflows/file.yaml`
- ❌ `.claude/workflows/workflows/file.yaml`
- ✅ `.claude/workflows/file.yaml` (correct format)

### 2. File Existence
Checks if referenced workflow files actually exist:
- Scans `.claude/workflows/` directory
- Verifies all references in `cuj-registry.json`
- Checks links in CUJ documentation files

### 3. Path Normalization
Ensures consistent path format:
- All paths use `.claude/workflows/` prefix
- No relative paths like `../../workflows/`
- `null` for skill-only CUJs

---

## Usage Examples

### Check for Issues
```bash
$ node .claude/tools/validate-workflow-paths.mjs

🔍 Validating workflow paths across LLM-RULES project...

╔════════════════════════════════════════════════════════╗
║          Workflow Path Validation Report              ║
╚════════════════════════════════════════════════════════╝

📊 Summary:
  • CUJs in registry: 59
  • CUJs with workflows: 13
  • CUJ docs checked: 61
  • Total issues found: 0

✅ All workflow paths are valid!
```

### Auto-Fix Issues
```bash
$ node .claude/tools/validate-workflow-paths.mjs --fix

🔧 Fix mode enabled - will attempt to auto-correct issues

  ✓ Fixed CUJ-005: .claude/workflows/.claude/workflows/greenfield.yaml → .claude/workflows/greenfield.yaml

✅ Fixed 1 double-prefix issues in cuj-registry.json
```

---

## Output Explanation

### Summary Section
```
📊 Summary:
  • CUJs in registry: 59          # Total CUJs in registry
  • CUJs with workflows: 13       # CUJs that reference workflow files
  • CUJ docs checked: 61          # CUJ documentation files checked
  • Total issues found: 0         # Issues detected (0 = success)
```

### Issue Types

#### 1. Double-Prefix Issues
```
🔴 Double-Prefix Issues (1):
  • CUJ-005 (line ~133):
    Current:    .claude/workflows/.claude/workflows/greenfield-fullstack.yaml
    Should be:  .claude/workflows/greenfield-fullstack.yaml
```

#### 2. Missing Workflow Files
```
🔴 Missing Workflow Files (1):
  • CUJ-022 (line ~712): .claude/workflows/ai-system-flow.yaml

💡 Suggestions:
  • For "ai-system-flow.yaml":
    Did you mean: .claude/workflows/ai-systems-flow.yaml
```

#### 3. Broken Links
```
🔴 Broken Workflow Links (1):
  • CUJ-019.md (line 151):
    Link: ../../workflows/performance-flow.yaml
    Resolved to: .claude/workflows/performance-flow.yaml
```

---

## Exit Codes

- **0**: All validations passed
- **1**: Issues found (use in CI/CD pipelines)

```bash
node .claude/tools/validate-workflow-paths.mjs
if [ $? -eq 0 ]; then
  echo "✅ Workflow paths are valid"
else
  echo "❌ Workflow path issues detected"
  exit 1
fi
```

---

## Integration

### Pre-Commit Hook
Add to `.git/hooks/pre-commit`:
```bash
#!/bin/bash
node .claude/tools/validate-workflow-paths.mjs
if [ $? -ne 0 ]; then
  echo "❌ Workflow path validation failed"
  echo "Run 'node .claude/tools/validate-workflow-paths.mjs --fix' to auto-correct issues"
  exit 1
fi
```

### CI/CD Pipeline (GitHub Actions)
```yaml
- name: Validate Workflow Paths
  run: node .claude/tools/validate-workflow-paths.mjs
```

### CI/CD Pipeline (GitLab CI)
```yaml
validate-workflows:
  script:
    - node .claude/tools/validate-workflow-paths.mjs
```

### NPM Script
Add to `package.json`:
```json
{
  "scripts": {
    "validate:workflows": "node .claude/tools/validate-workflow-paths.mjs",
    "fix:workflows": "node .claude/tools/validate-workflow-paths.mjs --fix"
  }
}
```

Then run:
```bash
npm run validate:workflows
npm run fix:workflows
```

---

## When to Run

### During Development
- ✅ Before committing changes to CUJ files
- ✅ After adding new CUJs
- ✅ After renaming workflow files
- ✅ After updating workflow references

### In CI/CD
- ✅ On every pull request
- ✅ Before merging to main branch
- ✅ As part of validation suite

### Periodic Maintenance
- ✅ Weekly validation run
- ✅ After bulk CUJ updates
- ✅ After workflow refactoring

---

## Common Issues

### Issue: Double-Prefix Path
**Problem**: Path has duplicate prefix
```
.claude/workflows/.claude/workflows/greenfield-fullstack.yaml
```

**Solution**: Run with `--fix` flag
```bash
node .claude/tools/validate-workflow-paths.mjs --fix
```

**Manual Fix**: Edit `cuj-registry.json` and remove duplicate prefix

---

### Issue: Missing Workflow File
**Problem**: CUJ references non-existent workflow
```
CUJ-022 references: .claude/workflows/ai-system-flow.yaml
File does not exist
```

**Solution**: Either create the workflow file OR change CUJ to `skill-only`:
```json
{
  "execution_mode": "skill-only",
  "workflow": null
}
```

---

### Issue: Broken Link in Documentation
**Problem**: CUJ doc has broken workflow link
```
CUJ-019.md (line 151):
  Link: ../../workflows/performance-flow.yaml
  Resolved to: .claude/workflows/performance-flow.yaml
```

**Solution**: Update the link to use correct path or verify file exists

---

## Validation Rules

### Path Format Rules
1. **Always** use `.claude/workflows/` prefix
2. **Never** use relative paths like `../../workflows/`
3. **Never** use double prefixes
4. **Use** `null` for skill-only CUJs

### Workflow Reference Rules
1. **workflow-based CUJs**: Must have `workflow` field with valid path
2. **skill-only CUJs**: Must have `workflow: null`
3. **All paths**: Must point to existing files

### Documentation Rules
1. **Workflow links**: Use relative paths from CUJ docs directory
2. **Inline references**: Use canonical `.claude/workflows/` format
3. **Broken links**: Must be fixed or updated

---

## Technical Details

### Files Scanned
- `.claude/context/cuj-registry.json` - CUJ registry with workflow mappings
- `.claude/docs/cujs/CUJ-*.md` - Individual CUJ documentation files
- `.claude/workflows/*.yaml` - Available workflow files

### Detection Patterns
```javascript
// Double-prefix patterns detected
/\.claude\/workflows\/\.claude\/workflows\//
/workflows\/\.claude\/workflows\//
/\.claude\/workflows\/workflows\//
```

### Path Normalization
```javascript
// Input:  .claude/workflows/.claude/workflows/greenfield-fullstack.yaml
// Output: .claude/workflows/greenfield-fullstack.yaml
```

---

## Troubleshooting

### Validation Script Won't Run
**Problem**: Permission denied or syntax error

**Solution**:
```bash
# Make executable (Unix/Mac)
chmod +x .claude/tools/validate-workflow-paths.mjs

# Run with node explicitly
node .claude/tools/validate-workflow-paths.mjs
```

---

### False Positives
**Problem**: Tool reports issues that don't exist

**Solution**: Check file paths and ensure:
- Workflow files exist in `.claude/workflows/`
- CUJ registry is valid JSON
- Paths use forward slashes (/)

---

### Auto-Fix Not Working
**Problem**: `--fix` flag doesn't correct issues

**Solution**: Auto-fix only corrects double-prefix issues. Other issues require manual intervention:
- **Missing files**: Create the file or change CUJ to skill-only
- **Broken links**: Update documentation to fix links

---

## Advanced Usage

### Custom Validation
Modify the script to add custom validations:
```javascript
// Add custom pattern
function hasCustomPattern(workflowPath) {
  return /your-pattern-here/.test(workflowPath);
}
```

### Extend Detection
Add new issue types:
```javascript
const issues = [];
if (myCustomCheck(cuj.workflow)) {
  issues.push({
    type: 'custom_issue',
    cuj_id: cuj.id,
    workflow: cuj.workflow,
    // ... other details
  });
}
```

---

## Color-Coded Output

- 🔵 **Blue**: Informational messages
- 🟢 **Green**: Success, valid paths
- 🟡 **Yellow**: Warnings, suggestions
- 🔴 **Red**: Errors, issues found
- 🟣 **Magenta**: Recommendations

---

## Related Documentation

- [CUJ Index](../docs/cujs/CUJ-INDEX.md) - Customer User Journey index
- [Workflow Guide](../workflows/WORKFLOW-GUIDE.md) - Workflow execution guide
- [CUJ Registry Schema](../schemas/cuj-registry.schema.json) - Registry validation schema

---

## Version History

### v1.0.0 (2026-01-06)
- ✅ Initial release
- ✅ Double-prefix detection
- ✅ Missing file detection
- ✅ Broken link detection
- ✅ Auto-fix capability
- ✅ Fuzzy matching for suggestions
- ✅ Color-coded output

---

## License

MIT License - Part of LLM-RULES project

---

## Support

For issues or questions:
1. Check this README
2. Review [CUJ Index](../docs/cujs/CUJ-INDEX.md)
3. Check [Workflow Guide](../workflows/WORKFLOW-GUIDE.md)
4. File an issue in project repository
