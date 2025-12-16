---
description: Run a workflow step validation
---

# Run Workflow Step

Use this command to validate the output of a workflow step against its defined schema/gate.

## Usage

```bash
/run-workflow <workflow-name> <step-number> [workflow-id]
```

## Arguments

- `workflow-name`: The name of the workflow file (e.g., `greenfield-fullstack`, `brownfield`).
- `step-number`: The step number to validate (e.g., `1`, `2`).
- `workflow-id`: (Optional) A unique ID for this run (defaults to `default-run`).

## Examples

```bash
# Validate Step 1 of the greenfield workflow
/run-workflow greenfield-fullstack 1

# Validate Step 3 with a custom ID
/run-workflow greenfield-fullstack 3 feature-login-01
```

## Implementation Details

This command:
1. Parses the YAML workflow definition
2. Locates the specified step
3. Identifies the expected output artifact, schema, and gate path
4. Executes validation against the schema
