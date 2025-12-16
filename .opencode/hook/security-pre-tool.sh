#!/bin/bash
# Security validation hook for PreToolUse
# Blocks dangerous commands and validates file operations

# Read JSON input from stdin
INPUT=$(cat)

# Extract tool name and input
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
TOOL_INPUT=$(echo "$INPUT" | jq -r '.tool_input // empty')

# For Bash tool, check command
if [ "$TOOL_NAME" = "Bash" ]; then
    COMMAND=$(echo "$TOOL_INPUT" | jq -r '.command // empty')

    # Block dangerous commands
    DANGEROUS_PATTERNS=(
        # File system destruction
        "rm -rf /"
        "rm -rf ~"
        "rm -rf \*"
        "sudo rm"
        "mkfs"
        "dd if="
        "format "
        "> /dev/"
        "chmod 777"
        # Remote code execution via download
        "curl.*| bash"
        "wget.*| bash"
        "curl.*| sh"
        "wget.*| sh"
        # Arbitrary code execution
        "python -c"
        "python3 -c"
        "node -e"
        "perl -e"
        "ruby -e"
        # Obfuscated/encoded execution
        "base64.*|.*bash"
        "base64.*|.*sh"
        "eval \"\$"
        # PowerShell dangerous commands
        "powershell -enc"
        "powershell -encodedcommand"
        "powershell -windowstyle hidden"
        # SQL destruction
        "DROP DATABASE"
        "DROP TABLE"
        "TRUNCATE TABLE"
        # System control
        "shutdown"
        "reboot"
        "systemctl stop"
        "init 0"
        "init 6"
        # Network manipulation
        "iptables -F"
        "iptables --flush"
        "ufw disable"
    )

    for pattern in "${DANGEROUS_PATTERNS[@]}"; do
        if echo "$COMMAND" | grep -qiE "$pattern"; then
            echo '{"decision": "block", "reason": "Blocked dangerous command pattern: '"$pattern"'"}'
            exit 0
        fi
    done

    # Block force push to main/master
    if echo "$COMMAND" | grep -qE "git push.*(--force|-f).*(main|master)"; then
        echo '{"decision": "block", "reason": "Blocked force push to protected branch"}'
        exit 0
    fi
fi

# For Edit tool, protect sensitive files
if [ "$TOOL_NAME" = "Edit" ] || [ "$TOOL_NAME" = "Write" ]; then
    FILE_PATH=$(echo "$TOOL_INPUT" | jq -r '.file_path // .path // empty')

    # Block editing .env files
    if echo "$FILE_PATH" | grep -qE "\.env($|\.local|\.production|\.secret)"; then
        echo '{"decision": "block", "reason": "Blocked editing environment/secrets file"}'
        exit 0
    fi

    # Block editing credential files
    if echo "$FILE_PATH" | grep -qiE "(credentials|secrets|\.pem|\.key|id_rsa)"; then
        echo '{"decision": "block", "reason": "Blocked editing credential file"}'
        exit 0
    fi
fi

# Allow by default
echo '{"decision": "allow"}'
