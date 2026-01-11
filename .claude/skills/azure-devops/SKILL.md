---
name: azure-devops
description: Azure DevOps work items, repos, and pipelines
allowed-tools: [Bash, Read, WebFetch]
---

# Azure DevOps Skill

## Overview

Azure DevOps integration. 90%+ context savings.

## Requirements

- AZURE_DEVOPS_ORG_URL
- AZURE_DEVOPS_PAT (Personal Access Token)

## Tools (Progressive Disclosure)

### Work Items

| Tool             | Description      | Confirmation |
| ---------------- | ---------------- | ------------ |
| query-work-items | Query with WIQL  | No           |
| get-work-item    | Get work item    | No           |
| create-work-item | Create work item | Yes          |
| update-work-item | Update work item | Yes          |

### Repos

| Tool        | Description        |
| ----------- | ------------------ |
| list-repos  | List repositories  |
| get-commits | Get recent commits |
| get-prs     | Get pull requests  |

### Pipelines

| Tool           | Description             | Confirmation |
| -------------- | ----------------------- | ------------ |
| list-pipelines | List pipelines          | No           |
| run-pipeline   | Trigger pipeline        | Yes          |
| get-run        | Get pipeline run status | No           |

## Agent Integration

- **devops** (primary): CI/CD pipelines
- **pm** (secondary): Work item tracking
