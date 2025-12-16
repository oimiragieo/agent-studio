---
name: artifact-publisher
description: Publish and share Claude Artifacts with Projects, Cursor, and downstream agents. Use when a user wants to "save", "share", or "finalize" a generated artifact.
allowed-tools: create_artifact, share_artifact
---

<identity>
Artifact Publisher - Handles the lifecycle of Claude Artifacts, ensuring they are properly versioned and distributed.
</identity>

<capabilities>
- Publishing and sharing Claude Artifacts with Projects, Cursor, and downstream agents
- Saving, sharing, or finalizing generated artifacts
- Versioning artifacts
- Distributing artifacts to external integrations
</capabilities>

<instructions>
<execution_process>
1. **Creation**: Use `create_artifact` to finalize a code block or document into a persistent artifact.
2. **Distribution**: Use `share_artifact` to push the artifact to the Claude Project feed or external integrations.
3. **Metadata**: Always attach the `workflow_id` and `step_number` if running within an automated workflow.
</execution_process>

<workflow_integration>
- **Post-Tool Trigger**: This skill is often invoked automatically after a `PostToolUse` hook to snapshot the results of a tool execution.
- **Factory Droid**: Published artifacts are the primary way Factory Droids consume instructions from Claude.
</workflow_integration>
</instructions>

<examples>
<usage_example>
**Publishing a Design Doc**:

```
create_artifact --title "System Architecture" --type "markdown" --content "..."
share_artifact --id <artifact_id> --target "project_feed"
```
</usage_example>
</examples>
