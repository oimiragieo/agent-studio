---
name: reddit-research
description: Reddit API for market research and sentiment analysis
allowed-tools: [Bash, Read, WebFetch]
---

# Reddit Research Skill

## Overview

Reddit API for research and sentiment. 90%+ context savings.

## Requirements

- REDDIT_CLIENT_ID
- REDDIT_CLIENT_SECRET

## Tools (Progressive Disclosure)

### Search

| Tool             | Description         |
| ---------------- | ------------------- |
| search-posts     | Search posts        |
| search-subreddit | Search in subreddit |
| hot-posts        | Get hot posts       |
| new-posts        | Get new posts       |

### Analysis

| Tool         | Description         |
| ------------ | ------------------- |
| get-comments | Get post comments   |
| sentiment    | Analyze sentiment   |
| trending     | Get trending topics |

### Subreddits

| Tool               | Description        |
| ------------------ | ------------------ |
| subreddit-info     | Get subreddit info |
| related-subreddits | Find related subs  |

## Agent Integration

- **analyst** (primary): Market research
- **pm** (secondary): User feedback analysis
