# Windows Setup Guide for Agent Studio

This guide covers Windows-specific setup requirements for Agent Studio, including CLI tool installation and Codex skills compatibility.

## Prerequisites

| Requirement | Version | Verify Command |
|-------------|---------|----------------|
| Windows | 10/11 | - |
| Node.js | 18+ | node --version |
| Git | 2.30+ | git --version |
| PowerShell | 5.1+ | Get-Host |

## CLI Tools Installation

### 1. Claude CLI

The Claude CLI is required for multi-AI code review and response-rater skills.

**Install via npm:**



**Verify installation:**



**If command not found:**
- Ensure %APPDATA%
pm is in your PATH
- Restart your terminal

### 2. Gemini CLI (Optional)



## Windows Compatibility Notes

### Path Handling

All Agent Studio code uses path.join() for cross-platform compatibility.

### CLI Spawning (.cmd Shims)

On Windows, npm installs CLI tools as .cmd files. All Codex skill code uses shell: true when spawning CLI processes.

## Troubleshooting

### Problem: CLI command not found

**Solutions:**
1. Verify npm global path is in PATH
2. Add npm to PATH manually in System Properties
3. Restart your terminal/IDE

### Problem: Path contains malformed segments

**Solutions:**
1. Always use path.join() for path construction
2. Run Windows compatibility test:



## Running Windows Compatibility Tests



## WSL Recommendation

For best compatibility with Unix-based tools, consider using WSL:



## Related Documentation

- [GETTING_STARTED.md](../../GETTING_STARTED.md) - Main setup guide
- [Troubleshooting](../../GETTING_STARTED.md#troubleshooting) - General troubleshooting