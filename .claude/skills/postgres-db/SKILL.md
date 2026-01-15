---
name: postgres-db
description: PostgreSQL database operations and management
version: 1.0.0
allowed-tools: [Bash, Read]
---

# PostgreSQL Database Skill

## Overview

PostgreSQL database operations. 90%+ context savings.

## Requirements

- DATABASE_URL or PGHOST/PGUSER/PGPASSWORD
- psql CLI installed

## Tools (Progressive Disclosure)

### Queries

| Tool    | Description                  | Confirmation |
| ------- | ---------------------------- | ------------ |
| query   | Execute SELECT               | No           |
| execute | Execute INSERT/UPDATE/DELETE | Yes          |
| explain | Query plan analysis          | No           |

### Schema

| Tool         | Description    | Confirmation |
| ------------ | -------------- | ------------ |
| list-tables  | List tables    | No           |
| describe     | Describe table | No           |
| create-table | Create table   | Yes          |
| drop-table   | Drop table     | **REQUIRED** |

### Admin

| Tool        | Description        |
| ----------- | ------------------ |
| connections | Active connections |
| locks       | View locks         |
| vacuum      | Run VACUUM         |

### BLOCKED

| Tool             | Status      |
| ---------------- | ----------- |
| DROP DATABASE    | **BLOCKED** |
| TRUNCATE CASCADE | **BLOCKED** |

## Agent Integration

- **database-architect** (primary): Schema design
- **developer** (primary): Data operations
- **performance-engineer** (secondary): Query optimization
