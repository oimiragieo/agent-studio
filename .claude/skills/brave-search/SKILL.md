---
name: brave-search
description: Brave Search API for web and news search
version: 1.0.0
allowed-tools: [Bash, Read, WebFetch]
---

# Brave Search Skill

## Overview

Web search via Brave Search API. 90%+ context savings.

## Requirements

- BRAVE_API_KEY environment variable

## Tools (Progressive Disclosure)

### Web Search

| Tool          | Description      |
| ------------- | ---------------- |
| search        | Web search query |
| search-news   | News search      |
| search-images | Image search     |

### Results

| Tool        | Description         |
| ----------- | ------------------- |
| get-snippet | Get result snippets |
| get-urls    | Get result URLs     |
| summarize   | Summarize results   |

## Agent Integration

- **analyst** (primary): Research
- **developer** (secondary): Documentation lookup
