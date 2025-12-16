# Context Artifacts

This folder contains generated artifacts from agent workflows.

## Structure

```
artifacts/
├── requirements/     # PRDs, user stories, requirements docs
├── architecture/     # Architecture documents, diagrams
├── specs/           # Technical specifications
└── reviews/         # Review feedback, audit reports
```

## Usage

Artifacts are created and managed by agents during workflows. 
Reference artifacts by path in handoffs between agents.

## Retention

- Active artifacts: Keep in main folders
- Completed projects: Archive to `archive/` subfolder
- Draft versions: Clean up after approval
