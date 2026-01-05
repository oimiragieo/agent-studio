#!/bin/bash
# Skill Injection Hook - Shell Wrapper
#
# PreToolUse hook for Task tool - injects skill requirements into subagent prompts
# Receives JSON on stdin, outputs modified JSON on stdout
#
# This is a cross-platform wrapper that calls the Node.js implementation.

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed or not in PATH" >&2
    exit 1
fi

# Call the Node.js hook implementation
node "$SCRIPT_DIR/skill-injection-hook.js"
