---
name: mongodb-atlas
description: MongoDB Atlas cloud database operations
allowed-tools: [Bash, Read, WebFetch]
---

# MongoDB Atlas Skill

## Overview

MongoDB Atlas cloud database management. 90%+ context savings.

## Requirements

- MONGODB_URI connection string
- Atlas API key (optional)

## Tools (Progressive Disclosure)

### Collections

| Tool             | Description      | Confirmation |
| ---------------- | ---------------- | ------------ |
| list-collections | List collections | No           |
| find             | Query documents  | No           |
| insert           | Insert document  | Yes          |
| update           | Update documents | Yes          |
| delete           | Delete documents | **REQUIRED** |

### Indexes

| Tool         | Description  | Confirmation |
| ------------ | ------------ | ------------ |
| list-indexes | List indexes | No           |
| create-index | Create index | Yes          |
| drop-index   | Drop index   | Yes          |

### Aggregation

| Tool      | Description              |
| --------- | ------------------------ |
| aggregate | Run aggregation pipeline |
| explain   | Explain query plan       |

### BLOCKED

| Tool         | Status      |
| ------------ | ----------- |
| dropDatabase | **BLOCKED** |

## Agent Integration

- **database-architect** (primary): Schema design
- **developer** (secondary): Data operations
