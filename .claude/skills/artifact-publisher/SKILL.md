---
name: artifact-publisher
description: Publish and share Claude Artifacts with Projects, Cursor, and downstream agents. Use when a user wants to "save", "share", or "finalize" a generated artifact.
allowed-tools: create_artifact, share_artifact
---

# Artifact Publisher

This skill handles the lifecycle of Claude Artifacts, ensuring they are properly versioned and distributed.

## Instructions

1. **Creation**: Use `create_artifact` to finalize a code block or document into a persistent artifact.
2. **Distribution**: Use `share_artifact` to push the artifact to the Claude Project feed or external integrations.
3. **Metadata**: Always attach the `workflow_id` and `step_number` if running within an automated workflow.

## Workflow Integration

- **Post-Tool Trigger**: This skill is often invoked automatically after a `PostToolUse` hook to snapshot the results of a tool execution.
- **Factory Droid**: Published artifacts are the primary way Factory Droids consume instructions from Claude.

## Examples

**Publishing a Design Doc:**
```
create_artifact --title "System Architecture" --type "markdown" --content "..."
share_artifact --id <artifact_id> --target "project_feed"
```
