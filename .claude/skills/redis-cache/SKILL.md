---
name: redis-cache
description: Redis caching operations and data structures
allowed-tools: [Bash, Read]
---

# Redis Cache Skill

## Overview

Redis caching and data structure operations. 90%+ context savings.

## Requirements

- Redis CLI or client library
- REDIS_URL environment variable

## Tools (Progressive Disclosure)

### Key Operations

| Tool | Description          | Confirmation |
| ---- | -------------------- | ------------ |
| get  | Get key value        | No           |
| set  | Set key value        | Yes          |
| del  | Delete key           | Yes          |
| keys | List keys by pattern | No           |
| ttl  | Get key TTL          | No           |

### Data Structures

| Tool          | Description           |
| ------------- | --------------------- |
| hget/hset     | Hash operations       |
| lpush/rpush   | List operations       |
| sadd/smembers | Set operations        |
| zadd/zrange   | Sorted set operations |

### Server

| Tool   | Description     |
| ------ | --------------- |
| ping   | Test connection |
| info   | Server info     |
| dbsize | Key count       |

### BLOCKED

| Tool     | Status      |
| -------- | ----------- |
| flushall | **BLOCKED** |
| flushdb  | **BLOCKED** |

## Agent Integration

- **developer** (primary): Caching implementation
- **performance-engineer** (secondary): Cache optimization

## Security

⚠️ Never expose REDIS_URL
⚠️ flushall/flushdb BLOCKED
