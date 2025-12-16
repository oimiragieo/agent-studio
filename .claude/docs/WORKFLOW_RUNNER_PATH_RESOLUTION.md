# Workflow Runner Path Resolution

This document explains how the workflow runner resolves file paths and the recommended usage patterns.

## Path Resolution Strategy

The workflow runner (`workflow_runner.js`) uses a multi-strategy approach to find workflow files and resolve paths:

### Strategy Order

1. **Absolute Paths**: If a path is absolute (starts with `/` on Unix or `C:` on Windows), it's used as-is
2. **Project Root** (Primary): Resolves from project root (parent of `.claude` directory)
   - This is the **recommended** and most reliable strategy
   - Works when called from project root or any subdirectory
3. **Current Working Directory**: Fallback if project root resolution fails
   - Useful when called from subdirectories
4. **Script Location**: Final fallback relative to script's directory
   - Used as last resort

## Expected Working Directory

### Best Practice: Run from Project Root

The workflow runner is designed to work best when called from the project root directory:

```bash
# From project root (recommended)
node .claude/tools/workflow_runner.js --workflow .claude/workflows/quick-flow.yaml --step 0 --id my-workflow-123
```

### Why Project Root?

- **Consistency**: All paths in `config.yaml` are relative to project root
- **Reliability**: Primary resolution strategy works from project root
- **Clarity**: Makes it clear where files are located
- **Documentation**: Matches how workflows are documented

## Path Resolution Examples

### Example 1: Workflow File Path

```yaml
# In config.yaml
workflow_file: .claude/workflows/quick-flow.yaml
```

**Resolution:**
- From project root: `./.claude/workflows/quick-flow.yaml` ✅
- From `.claude/` directory: `../.claude/workflows/quick-flow.yaml` (fallback)
- From any directory: Resolves to project root first

### Example 2: Schema File Path

```yaml
# In workflow YAML
validation:
  schema: .claude/schemas/plan.schema.json
```

**Resolution:**
- Always resolved relative to project root
- Works regardless of current working directory

### Example 3: Artifact Paths

```yaml
# In workflow YAML
outputs:
  - plan-{{workflow_id}}.json
```

**Resolution:**
- Artifacts are saved to `.claude/context/artifacts/`
- Path is always relative to project root

## Usage Patterns

### Pattern 1: Direct Execution (Recommended)

```bash
# From project root
cd /path/to/project
node .claude/tools/workflow_runner.js \
  --workflow .claude/workflows/quick-flow.yaml \
  --step 0 \
  --id workflow-$(date +%s)
```

### Pattern 2: From Subdirectory

```bash
# From a subdirectory (works but not recommended)
cd /path/to/project/src
node ../.claude/tools/workflow_runner.js \
  --workflow ../.claude/workflows/quick-flow.yaml \
  --step 0 \
  --id workflow-$(date +%s)
```

**Note**: While this works due to fallback strategies, using project root is more reliable.

### Pattern 3: Absolute Paths

```bash
# Using absolute path (works but not recommended)
node /path/to/project/.claude/tools/workflow_runner.js \
  --workflow /path/to/project/.claude/workflows/quick-flow.yaml \
  --step 0 \
  --id workflow-$(date +%s)
```

**Note**: Absolute paths work but reduce portability.

## Troubleshooting

### Issue: "Workflow file not found"

**Solution**: Ensure you're running from project root or use absolute paths.

```bash
# Check current directory
pwd

# Should show project root (parent of .claude/)
# If not, change to project root:
cd /path/to/project
```

### Issue: "Schema file not found"

**Solution**: Schema paths in workflows are relative to project root. Ensure you're running from project root.

### Issue: "Artifact directory not found"

**Solution**: The runner creates artifact directories automatically. If this fails, check:
1. You have write permissions in `.claude/context/`
2. You're running from project root
3. The workflow ID is valid

## Implementation Details

The path resolution logic is in `workflow_runner.js`:

```javascript
function resolveWorkflowPath(relativePath) {
  // Strategy 1: Absolute path
  if (relativePath.startsWith('/') || /^[A-Z]:/.test(relativePath)) {
    return relativePath;
  }
  
  // Strategy 2: Project root (primary)
  const projectRoot = resolve(__dirname, '../..');
  const projectRootPath = resolve(projectRoot, relativePath);
  if (existsSync(projectRootPath)) {
    return projectRootPath;
  }
  
  // Strategy 3: Current working directory
  const cwdPath = resolve(process.cwd(), relativePath);
  if (existsSync(cwdPath)) {
    return cwdPath;
  }
  
  // Strategy 4: Script location
  const scriptPath = resolve(__dirname, relativePath);
  if (existsSync(scriptPath)) {
    return scriptPath;
  }
  
  // Return project root path (will fail with clear error)
  return projectRootPath;
}
```

## Best Practices

1. **Always run from project root**: Most reliable and consistent
2. **Use relative paths**: Paths in `config.yaml` and workflows should be relative to project root
3. **Test path resolution**: If you encounter issues, verify paths exist from project root
4. **Document custom paths**: If using absolute paths, document why

## Related Documentation

- `.claude/workflows/WORKFLOW-GUIDE.md` - Workflow execution guide
- `.claude/CLAUDE.md` - Workflow routing system documentation
- `.claude/config.yaml` - Workflow configuration and paths

