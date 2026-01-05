# Skill Injection Hook - PowerShell Wrapper
#
# PreToolUse hook for Task tool - injects skill requirements into subagent prompts
# Receives JSON on stdin, outputs modified JSON on stdout
#
# This is a Windows PowerShell wrapper that calls the Node.js implementation.

# Get the directory of this script
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Check if Node.js is available
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Error: Node.js is not installed or not in PATH"
    exit 1
}

# Call the Node.js hook implementation
node "$ScriptDir\skill-injection-hook.js"
