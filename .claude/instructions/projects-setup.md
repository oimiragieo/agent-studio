# Projects Configuration Guide

Claude Projects let us preload knowledge, style, and guardrails for each workspace [2]. Follow these steps when standing up a new repository.

1. **Create a Project** and upload baseline context: README, architecture docs, API schemas.
2. **Define instruction sets** – map root `CLAUDE.md`, directory-specific files, and agent prompts.
3. **Enable team memory** cautiously; ensure no regulated data persists longer than policy allows.
4. **Register Integrations** (Linear, GitHub, Slack) so hooks can tag activity feed items automatically.
5. **Assign subagents** (Architect, QA, PM, etc.) with tool permissions aligned to their role.
6. **Link Cursor/Droid** by storing plan artifacts and transcripts in the Project so other platforms can pull context.

Keep the Project knowledge base under 200 documents to avoid noisy retrieval; archive stale assets quarterly.

[2] Anthropic, "Projects" (Jun 2024).
