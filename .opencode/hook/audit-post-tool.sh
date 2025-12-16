#!/bin/bash
# Audit logging hook for PostToolUse
# Logs tool executions for security audit trail

# Read JSON input from stdin
INPUT=$(cat)

# Extract relevant fields
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // "unknown"')
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Create audit log directory if needed
AUDIT_DIR="${HOME}/.opencode/audit"
mkdir -p "$AUDIT_DIR"

# Log to audit file
AUDIT_FILE="$AUDIT_DIR/tool-usage.log"

# Extract summary based on tool type
case "$TOOL_NAME" in
    "Bash")
        SUMMARY=$(echo "$INPUT" | jq -r '.tool_input.command // "no command"' | head -c 100)
        ;;
    "Edit"|"Write")
        SUMMARY=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // "no path"')
        ;;
    "Read")
        SUMMARY=$(echo "$INPUT" | jq -r '.tool_input.file_path // "no path"')
        ;;
    *)
        SUMMARY="tool execution"
        ;;
esac

# Append to audit log
echo "$TIMESTAMP | $TOOL_NAME | $SUMMARY" >> "$AUDIT_FILE"

# Keep log file under 10MB
if [ -f "$AUDIT_FILE" ] && [ $(stat -f%z "$AUDIT_FILE" 2>/dev/null || stat -c%s "$AUDIT_FILE" 2>/dev/null) -gt 10485760 ]; then
    tail -n 10000 "$AUDIT_FILE" > "$AUDIT_FILE.tmp"
    mv "$AUDIT_FILE.tmp" "$AUDIT_FILE"
fi
