---
name: grafana-dashboards
description: Grafana dashboard management, visualization, and alerting
allowed-tools: [Bash, Read, WebFetch]
---

# Grafana Dashboards Skill

## Overview

Provides 90%+ context savings vs raw Grafana API calls. Comprehensive dashboard, datasource, and alerting operations with progressive disclosure by feature category.

## Requirements

- Grafana instance accessible via URL
- API key with appropriate permissions
- Environment variables configured

## Environment Variables

- **GRAFANA_URL** (required): Base URL of Grafana instance (e.g., https://grafana.example.com)
- **GRAFANA_API_KEY** (required): API key for authentication
- **GRAFANA_ORG_ID** (optional): Organization ID (defaults to 1)

## Tools (Progressive Disclosure)

### Dashboard Operations

| Tool              | Description                    | Confirmation    |
| ----------------- | ------------------------------ | --------------- |
| list-dashboards   | List all dashboards            | No              |
| get-dashboard     | Get dashboard JSON by UID      | No              |
| search-dashboards | Search dashboards by tag/query | No              |
| create-dashboard  | Create new dashboard from JSON | Yes             |
| update-dashboard  | Update existing dashboard      | Yes             |
| delete-dashboard  | Delete dashboard by UID        | Yes (DANGEROUS) |

### Folder Management

| Tool          | Description               | Confirmation |
| ------------- | ------------------------- | ------------ |
| list-folders  | List dashboard folders    | No           |
| get-folder    | Get folder details by UID | No           |
| create-folder | Create new folder         | Yes          |

### Data Sources

| Tool              | Description                      | Confirmation    |
| ----------------- | -------------------------------- | --------------- |
| list-datasources  | List all data sources            | No              |
| get-datasource    | Get datasource config by ID/name | No              |
| test-datasource   | Test datasource connection       | No              |
| create-datasource | Add new datasource               | Yes             |
| update-datasource | Update datasource config         | Yes             |
| delete-datasource | Delete datasource                | Yes (DANGEROUS) |

### Alerting

| Tool         | Description             | Confirmation |
| ------------ | ----------------------- | ------------ |
| list-alerts  | List alert rules        | No           |
| get-alert    | Get alert rule by UID   | No           |
| alert-state  | Get current alert state | No           |
| pause-alert  | Pause alert rule        | Yes          |
| resume-alert | Resume paused alert     | Yes          |
| test-alert   | Test alert rule         | No           |

### Panels & Queries

| Tool             | Description                      | Confirmation |
| ---------------- | -------------------------------- | ------------ |
| query-datasource | Execute query against datasource | No           |
| render-panel     | Render panel as PNG image        | No           |
| export-dashboard | Export dashboard to JSON file    | No           |

## Quick Reference

### Dashboard Operations

```bash
# List all dashboards
curl -H "Authorization: Bearer $GRAFANA_API_KEY" \
  "$GRAFANA_URL/api/search?type=dash-db"

# Get dashboard by UID
curl -H "Authorization: Bearer $GRAFANA_API_KEY" \
  "$GRAFANA_URL/api/dashboards/uid/<dashboard-uid>"

# Search dashboards by tag
curl -H "Authorization: Bearer $GRAFANA_API_KEY" \
  "$GRAFANA_URL/api/search?tag=production"

# Delete dashboard (DANGEROUS)
curl -X DELETE \
  -H "Authorization: Bearer $GRAFANA_API_KEY" \
  "$GRAFANA_URL/api/dashboards/uid/<dashboard-uid>"
```

### Data Source Operations

```bash
# List all datasources
curl -H "Authorization: Bearer $GRAFANA_API_KEY" \
  "$GRAFANA_URL/api/datasources"

# Test datasource connection
curl -X POST \
  -H "Authorization: Bearer $GRAFANA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"datasource": {"uid": "<datasource-uid>"}}' \
  "$GRAFANA_URL/api/datasources/proxy/<datasource-id>/test"
```

### Alert Operations

```bash
# List alert rules
curl -H "Authorization: Bearer $GRAFANA_API_KEY" \
  "$GRAFANA_URL/api/v1/provisioning/alert-rules"

# Get alert state
curl -H "Authorization: Bearer $GRAFANA_API_KEY" \
  "$GRAFANA_URL/api/v1/provisioning/alert-rules/<alert-uid>"

# Pause alert
curl -X POST \
  -H "Authorization: Bearer $GRAFANA_API_KEY" \
  "$GRAFANA_URL/api/v1/provisioning/alert-rules/<alert-uid>/pause"
```

### Panel Rendering

```bash
# Render panel as PNG
curl -H "Authorization: Bearer $GRAFANA_API_KEY" \
  "$GRAFANA_URL/render/d-solo/<dashboard-uid>/<panel-name>?panelId=<panel-id>&width=1000&height=500" \
  -o panel.png
```

## Configuration

### API Key Permissions

Ensure your API key has appropriate permissions:

- **Viewer**: Read-only access to dashboards and datasources
- **Editor**: Create and modify dashboards
- **Admin**: Full access including datasource and alert management

### Organization Context

If using multiple organizations, set `GRAFANA_ORG_ID` or include `X-Grafana-Org-Id` header:

```bash
curl -H "Authorization: Bearer $GRAFANA_API_KEY" \
  -H "X-Grafana-Org-Id: 2" \
  "$GRAFANA_URL/api/dashboards/home"
```

## Security

⚠️ **CRITICAL: Never expose API keys in logs or responses**
⚠️ **Dashboard deletion is DANGEROUS - requires extra confirmation**
⚠️ **Datasource credentials must be masked in all outputs**
⚠️ **Use viewer-level keys when read-only access is sufficient**

### Security Best Practices

1. Store API keys in environment variables, never hardcode
2. Use least-privilege API keys (viewer > editor > admin)
3. Mask sensitive datasource connection strings
4. Require confirmation for all destructive operations
5. Audit all dashboard modifications
6. Rotate API keys regularly

## Agent Integration

- **devops** (primary): Dashboard provisioning, monitoring setup
- **performance-engineer** (primary): Performance metrics visualization
- **incident-responder** (secondary): Real-time incident dashboards
- **analyst** (secondary): Data analysis and reporting
- **qa** (secondary): Test metrics visualization

## Common Workflows

### Dashboard Provisioning

1. Export dashboard from Grafana UI or create JSON template
2. Use `create-dashboard` to provision to target instance
3. Verify with `get-dashboard`
4. Configure alerts with `create-alert`

### Performance Monitoring

1. List existing datasources with `list-datasources`
2. Test datasource connectivity with `test-datasource`
3. Query metrics with `query-datasource`
4. Create performance dashboards with `create-dashboard`
5. Set up alerts with appropriate thresholds

### Incident Response

1. Search for relevant dashboards with `search-dashboards`
2. Render critical panels with `render-panel`
3. Check alert states with `alert-state`
4. Query datasources for incident timeline

## Troubleshooting

| Issue                     | Solution                                                 |
| ------------------------- | -------------------------------------------------------- |
| 401 Unauthorized          | Check GRAFANA_API_KEY is valid and not expired           |
| 403 Forbidden             | Verify API key has required permissions                  |
| 404 Dashboard not found   | Confirm dashboard UID is correct                         |
| 500 Internal Server Error | Check Grafana logs, verify datasource connectivity       |
| Connection timeout        | Verify GRAFANA_URL is accessible, check network/firewall |
| Invalid JSON              | Validate dashboard JSON schema before upload             |

## API Version Compatibility

- Supports Grafana v8.x, v9.x, v10.x, v11.x
- Alert API uses v1 provisioning endpoints
- Legacy alerting (pre-v8) not supported

## Examples

### Create Dashboard from Template

```bash
# Read dashboard template
DASHBOARD_JSON=$(cat dashboard-template.json)

# Create dashboard
curl -X POST \
  -H "Authorization: Bearer $GRAFANA_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"dashboard\": $DASHBOARD_JSON, \"folderId\": 0, \"overwrite\": false}" \
  "$GRAFANA_URL/api/dashboards/db"
```

### Search and Export Dashboards

```bash
# Search by tag
DASHBOARDS=$(curl -H "Authorization: Bearer $GRAFANA_API_KEY" \
  "$GRAFANA_URL/api/search?tag=kubernetes")

# Export each dashboard
for uid in $(echo $DASHBOARDS | jq -r '.[].uid'); do
  curl -H "Authorization: Bearer $GRAFANA_API_KEY" \
    "$GRAFANA_URL/api/dashboards/uid/$uid" > "dashboard-$uid.json"
done
```

### Monitor Alert States

```bash
# Get all alerts
ALERTS=$(curl -H "Authorization: Bearer $GRAFANA_API_KEY" \
  "$GRAFANA_URL/api/v1/provisioning/alert-rules")

# Filter firing alerts
echo $ALERTS | jq '.[] | select(.state == "firing")'
```
