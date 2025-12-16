#!/bin/bash
# Stop Hook
# Handles graceful shutdown, cleanup resources, and saves state

# Read JSON input from stdin
INPUT=$(cat)

# Extract stop reason
REASON=$(echo "$INPUT" | jq -r '.reason // "normal"')
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // ""')

# Log stop event
STOP_LOG="${HOME}/.claude/stops.log"
mkdir -p "$(dirname "$STOP_LOG")"

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
echo "$TIMESTAMP | $REASON | $SESSION_ID" >> "$STOP_LOG"

# If session ID provided, save session state
if [ -n "$SESSION_ID" ]; then
    # Save session state (would integrate with session manager)
    echo "Saving session state for $SESSION_ID" >&2
fi

# Cleanup temporary files
TEMP_DIR="${HOME}/.claude/temp"
if [ -d "$TEMP_DIR" ]; then
    # Remove files older than 1 hour
    find "$TEMP_DIR" -type f -mmin +60 -delete 2>/dev/null || true
fi

# Return success
echo '{"success": true, "cleaned_up": true, "reason": "'"$REASON"'"}'

