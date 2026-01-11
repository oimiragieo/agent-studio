# Incident Response Skill

Automated incident response workflow with runbooks, telemetry collection, and cross-platform handoff.

## Automatic Runbook Loading

Droid automatically loads runbooks from `docs/incidents/`:

- Matches incident type to appropriate runbook
- Loads step-by-step remediation procedures
- References related documentation and playbooks
- Applies context from current system state

**Runbook Structure:**

```
docs/incidents/
  - database-connection.md
  - api-timeout.md
  - authentication-failure.md
  - performance-degradation.md
```

## Notification Workflow

### Slack Integration

Automatically pages relevant Slack channel via webhook:

- Posts incident summary and severity
- Links to runbook and telemetry
- Updates channel with remediation progress
- Notifies on resolution

**Configuration:**
Set up webhook in Factory dashboard → Integrations → Slack

### Escalation Path

1. **Initial alert**: Posted to team channel
2. **Severity assessment**: High-severity incidents escalate to on-call
3. **Progress updates**: Status updates posted automatically
4. **Resolution notification**: Final summary posted with root cause

## Telemetry Collection

### Pre-Fix Snapshots

Collects telemetry snapshots before executing fixes:

- **Grafana dashboards**: Application metrics, error rates, latency
- **Datadog traces**: Request flows, database queries, service calls
- **Log aggregations**: Error logs, access logs, application logs
- **System metrics**: CPU, memory, disk, network utilization

**Purpose:**

- Capture system state before changes
- Provide baseline for validation
- Enable rollback if needed
- Document incident timeline

### Post-Fix Validation

After remediation:

- Compare current metrics to pre-fix baseline
- Verify error rates decreased
- Confirm system health restored
- Document improvement metrics

## Cross-Platform Handoff

### Claude Projects Integration

Syncs final summary to Claude Projects:

- Incident timeline and resolution steps
- Root cause analysis
- Remediation procedures applied
- Lessons learned and improvements

**Workflow:**

1. Droid resolves incident using runbook
2. Summary artifact created in `.factory/docs/incidents/`
3. Artifact published to Claude Project
4. Linked to retrospective task

### Linear Integration

Automatically opens retrospective task in Linear:

- Task includes incident summary and root cause
- Links to Claude Project artifact
- Assigns to incident owner or team lead
- Sets appropriate priority and labels

**Task Details:**

- Incident ID and timestamp
- Root cause analysis
- Remediation steps taken
- Preventive actions needed
- Follow-up items

## Usage Example

### Incident Detection

User reports: "API returning 500 errors"

Droid automatically:

1. Loads `docs/incidents/api-error.md` runbook
2. Collects Grafana metrics snapshot
3. Pages `#platform-alerts` Slack channel
4. Analyzes error logs and traces

### Remediation

Droid follows runbook:

1. Identifies root cause (database connection pool exhaustion)
2. Applies fix (increase pool size, add connection retry logic)
3. Validates fix with test requests
4. Monitors metrics for improvement

### Post-Incident

Droid automatically:

1. Generates summary artifact
2. Publishes to Claude Project
3. Opens Linear retrospective task
4. Updates Slack channel with resolution

## Best Practices

### Runbook Maintenance

- Keep runbooks up-to-date with current procedures
- Test runbooks in staging environments
- Document all remediation steps clearly
- Include rollback procedures for each step

### Telemetry Setup

- Ensure Grafana/Datadog integrations are configured
- Set up dashboards for common incident types
- Configure alerts for automatic incident detection
- Document metric interpretation in runbooks

### Incident Documentation

- Document all incidents, even minor ones
- Include root cause analysis and timeline
- Track patterns across incidents
- Update runbooks based on lessons learned

### Team Coordination

- Define on-call rotation and escalation paths
- Configure Slack channels for different severity levels
- Set up Linear projects for incident tracking
- Establish follow-up meeting schedules

## Configuration

Enable incident response in `AGENTS.md`:

```markdown
## Incident Response

- Runbooks: `docs/incidents/`
- Slack channel: `#platform-alerts`
- Linear project: `Platform / Incidents`
- Telemetry: Grafana, Datadog
```
