---
name: algolia-search
description: Algolia search indexing and querying
version: 1.0.0
allowed-tools: [Bash, Read, WebFetch]
---

# Algolia Search Skill

## Overview

Full-text search via Algolia. 90%+ context savings.

## Requirements

- ALGOLIA_APP_ID
- ALGOLIA_API_KEY

## Tools (Progressive Disclosure)

### Search

| Tool         | Description             |
| ------------ | ----------------------- |
| search       | Search index            |
| browse       | Browse all records      |
| multi-search | Search multiple indices |

### Index

| Tool          | Description       | Confirmation |
| ------------- | ----------------- | ------------ |
| list-indices  | List indices      | No           |
| save-object   | Add/update object | Yes          |
| delete-object | Delete object     | Yes          |
| clear-index   | Clear index       | **REQUIRED** |

### Settings

| Tool         | Description        |
| ------------ | ------------------ |
| get-settings | Get index settings |
| set-settings | Update settings    |

## Agent Integration

- **developer** (primary): Search implementation
- **performance-engineer** (secondary): Search optimization
