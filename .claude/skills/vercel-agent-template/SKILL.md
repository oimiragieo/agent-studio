---
name: vercel-agent-template
description: Agent scaffolding and template generation for Vercel deployments
version: 1.0.0
allowed-tools: [Bash, Read, Glob, Write]
---

# Vercel Agent Template Skill

## Overview

Agent scaffolding and template generation. 90%+ context savings via progressive disclosure.

## Tools (Progressive Disclosure)

### Template Operations

| Tool            | Description                      | Confirmation |
| --------------- | -------------------------------- | ------------ |
| list-templates  | List available agent templates   | No           |
| create-agent    | Scaffold new agent from template | Yes          |
| configure-agent | Configure agent settings         | Yes          |

### Deployment

| Tool    | Description               | Confirmation |
| ------- | ------------------------- | ------------ |
| deploy  | Deploy agent to Vercel    | Yes          |
| preview | Create preview deployment | No           |
| logs    | View deployment logs      | No           |

## Agent Integration

- **orchestrator** (primary): Agent design and scaffolding
- **developer** (secondary): Implementation

## Security

⚠️ Deployment requires confirmation
