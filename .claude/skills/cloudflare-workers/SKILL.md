---
name: cloudflare-workers
description: Cloudflare Workers and edge functions
allowed-tools: [Bash, Read, WebFetch]
---

# Cloudflare Workers Skill

## Overview
Cloudflare edge computing. 90%+ context savings.

## Requirements
- CLOUDFLARE_API_TOKEN
- CLOUDFLARE_ACCOUNT_ID

## Tools (Progressive Disclosure)

### Workers
| Tool | Description | Confirmation |
|------|-------------|--------------|
| list-workers | List workers | No |
| get-worker | Get worker code | No |
| deploy-worker | Deploy worker | Yes |
| delete-worker | Delete worker | **REQUIRED** |

### KV Storage
| Tool | Description | Confirmation |
|------|-------------|--------------|
| list-namespaces | List KV namespaces | No |
| get-key | Get KV value | No |
| put-key | Set KV value | Yes |
| delete-key | Delete KV key | Yes |

### Logs
| Tool | Description |
|------|-------------|
| tail-logs | Tail worker logs |
| get-analytics | Get analytics |

## Agent Integration
- **devops** (primary): Edge deployment
- **developer** (secondary): Worker development
