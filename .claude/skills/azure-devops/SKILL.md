---
name: azure-devops
description: Azure DevOps work items, repos, and pipelines
version: 1.0.0
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

- **devops** (primary): CI/CD pipelines, Azure Pipelines, Azure Repos
- **pm** (secondary): Work item tracking, WIQL queries, work item management

## Environment Validation

Before using this skill, verify:

- `AZURE_DEVOPS_ORG_URL` is set (e.g., `https://dev.azure.com/your-org`)
- `AZURE_DEVOPS_PAT` has required permissions:
  - Work Items: Read & Write
  - Code: Read (for repos)
  - Build: Read & Execute (for pipelines)
- Organization URL is accessible

## Usage Examples

### Creating Work Items

```
Use azure-devops skill to create a work item:
- Type: Bug
- Title: "Login form validation error"
- Description: "User reports validation error on login form"
```

### Querying Work Items

```
Use azure-devops skill to query work items:
- WIQL: "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'"
```

### Triggering Pipelines

```
Use azure-devops skill to trigger pipeline:
- Pipeline: "production-deploy"
- Branch: "main"
```
