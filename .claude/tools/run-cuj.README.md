# CUJ Command Wrapper

User-facing command-line tool for executing Customer User Journeys (CUJs).

## Installation

The tool is available via npm scripts:

```bash
pnpm cuj <CUJ-ID>           # Run a CUJ workflow
pnpm cuj:list               # List all available CUJs
pnpm cuj:simulate <CUJ-ID>  # Simulate CUJ execution (dry run)
pnpm cuj:validate <CUJ-ID>  # Validate CUJ structure
```

## Usage

### List All CUJs

```bash
pnpm cuj:list
```

Output:

```
| ID      | Name                          | Mode         | Workflow |
|---------|-------------------------------|--------------|----------|
| CUJ-001 | First-Time Installation       | manual-setup | -        |
| CUJ-002 | Rule Configuration            | skill-only   | -        |
| CUJ-005 | Greenfield Project Planning   | workflow     | -        |
...
```

### Run a CUJ

```bash
pnpm cuj CUJ-005
```

For CUJs with workflows, this executes the associated workflow. For skill-only or manual CUJs, it displays guidance.

### Simulate a CUJ (Dry Run)

```bash
pnpm cuj:simulate CUJ-034
```

Simulates CUJ execution without actually running the workflow. Useful for testing and debugging.

### Validate a CUJ

```bash
pnpm cuj:validate CUJ-005
```

Validates CUJ structure and configuration using the `validate-cuj-e2e.mjs` tool.

## Direct Execution

You can also run the tool directly:

```bash
node .claude/tools/run-cuj.mjs --list
node .claude/tools/run-cuj.mjs CUJ-005
node .claude/tools/run-cuj.mjs --simulate CUJ-034
node .claude/tools/run-cuj.mjs --validate CUJ-005
```

## CUJ Execution Modes

The tool handles different CUJ execution modes:

1. **workflow**: Executes the associated workflow YAML file
2. **skill-only**: Displays message to invoke the skill directly
3. **manual-setup**: Displays message to follow manual setup steps

## Integration

The tool integrates with:

- **CUJ Registry**: Reads from `.claude/context/cuj-registry.json`
- **Workflow Runner**: Delegates to `workflow_runner.js` for workflow execution
- **CUJ Validator**: Delegates to `validate-cuj-e2e.mjs` for validation

## Examples

### Example 1: Run Greenfield Project Planning

```bash
pnpm cuj CUJ-005
```

Output:

```
Running CUJ-005: Greenfield Project Planning
Workflow: greenfield-fullstack.yaml
```

### Example 2: List All CUJs

```bash
pnpm cuj:list
```

Shows a table of all 60 available CUJs with their IDs, names, execution modes, and workflows.

### Example 3: Simulate Browser Testing

```bash
pnpm cuj:simulate CUJ-034
```

Simulates the browser-based UI testing workflow without actually running it.

### Example 4: Validate a CUJ

```bash
pnpm cuj:validate CUJ-005
```

Validates the structure and configuration of CUJ-005 (Greenfield Project Planning).

## Developer Experience Benefits

1. **Simplified Commands**: Short, memorable commands (e.g., `pnpm cuj CUJ-005`)
2. **Discoverability**: `pnpm cuj:list` shows all available CUJs
3. **Safety**: `--simulate` allows dry runs before actual execution
4. **Validation**: `--validate` checks CUJ structure before running
5. **Helpful Messages**: Clear guidance for skill-only and manual CUJs

## Related Documentation

- [GETTING_STARTED.md](../docs/setup-guides/GETTING_STARTED.md) - Getting started guide with CUJ examples
- [CUJ Documentation](../docs/cujs/) - Detailed documentation for each CUJ
- [Workflow Guide](../workflows/WORKFLOW-GUIDE.md) - Workflow execution documentation
- [CUJ Registry Schema](../schemas/cuj-registry.schema.json) - CUJ registry structure

## Implementation Details

- **File**: `.claude/tools/run-cuj.mjs`
- **Dependencies**: Node.js 18+, child_process, fs, path
- **Registry**: `.claude/context/cuj-registry.json`
- **Workflows**: `.claude/workflows/*.yaml`
- **Validator**: `.claude/tools/validate-cuj-e2e.mjs`
