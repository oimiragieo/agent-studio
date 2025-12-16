#!/bin/bash
# Notification Hook
# Handles notification events and sends alerts

# Read JSON input from stdin
INPUT=$(cat)

# Extract notification details
EVENT_TYPE=$(echo "$INPUT" | jq -r '.event_type // "unknown"')
MESSAGE=$(echo "$INPUT" | jq -r '.message // ""')
SEVERITY=$(echo "$INPUT" | jq -r '.severity // "info"')

# Log notification
NOTIFICATION_LOG="${HOME}/.claude/notifications.log"
mkdir -p "$(dirname "$NOTIFICATION_LOG")"

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
echo "$TIMESTAMP | $SEVERITY | $EVENT_TYPE | $MESSAGE" >> "$NOTIFICATION_LOG"

# For critical events, could send to external systems
if [ "$SEVERITY" = "critical" ] || [ "$SEVERITY" = "error" ]; then
    # Could integrate with Slack, PagerDuty, etc.
    # For now, just log
    echo "Critical notification: $MESSAGE" >&2
fi

# Return success
echo '{"success": true, "logged": true}'

