# Artifacts Playbook

Claude 3.5 Sonnet introduces Artifacts as a live workspace for code, docs, and designs [1]. Use this guide to standardize how we create, review, and publish artifacts across agents.

## When to Create an Artifact
- Multi-file code changes or RFC drafts.
- UI proposals that benefit from live preview.
- Data analysis notebooks requiring iteration.

## Workflow
1. Generate a Plan Mode summary (Cursor) or Claude plan artifact.
2. Produce implementation output inside the Artifact window; keep chat responses concise.
3. Tag the artifact with feature ID and owner.
4. Publish via `artifact-publisher` skill; share to Cursor Cloud Agents for continued execution [5].

## Review Checklist
- ✅ Linked to Jira/Linear ticket.
- ✅ Includes test coverage notes.
- ✅ Contains rollback strategy when relevant.

[1] Anthropic, "Claude 3.5 Sonnet" (Jun 2024).  
[5] Cursor, "Cloud Agents" (Oct 30, 2025).
