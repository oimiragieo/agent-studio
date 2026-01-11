---
name: prometheus-metrics
description: Prometheus metrics querying and alerting
allowed-tools: [Bash, Read, WebFetch]
---

# Prometheus Metrics Skill

## Overview

Prometheus metrics and alerting. 90%+ context savings.

## Requirements

- PROMETHEUS_URL environment variable

## Tools (Progressive Disclosure)

### Queries

| Tool        | Description                  |
| ----------- | ---------------------------- |
| query       | Execute PromQL query         |
| query-range | Range query with time window |
| instant     | Instant query                |

### Targets

| Tool          | Description         |
| ------------- | ------------------- |
| targets       | List scrape targets |
| target-health | Check target health |

### Alerts

| Tool   | Description         |
| ------ | ------------------- |
| alerts | List active alerts  |
| rules  | List alerting rules |

### Metadata

| Tool    | Description       |
| ------- | ----------------- |
| metrics | List all metrics  |
| labels  | List label values |

## Agent Integration

- **devops** (primary): Monitoring setup
- **incident-responder** (primary): Alert investigation
- **performance-engineer** (secondary): Performance analysis
