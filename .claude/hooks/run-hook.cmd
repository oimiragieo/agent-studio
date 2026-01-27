: << 'CMDBLOCK'
@echo off
REM Polyglot wrapper: runs hooks cross-platform
REM Usage: run-hook.cmd <hook-script> [args...]
REM
REM On Windows: Runs via Git Bash
REM On Unix: Runs directly in shell
REM
REM This allows .sh hooks to work on Windows without modification.

if "%~1"=="" (
    echo run-hook.cmd: missing script name >&2
    exit /b 1
)

REM Try Git Bash first, fall back to WSL if available
if exist "C:\Program Files\Git\bin\bash.exe" (
    "C:\Program Files\Git\bin\bash.exe" -l "%~dp0%~1" %2 %3 %4 %5 %6 %7 %8 %9
) else if exist "C:\Windows\System32\wsl.exe" (
    wsl bash -l "%~dp0%~1" %2 %3 %4 %5 %6 %7 %8 %9
) else (
    echo run-hook.cmd: No bash found. Install Git for Windows or WSL. >&2
    exit /b 1
)
exit /b
CMDBLOCK

# Unix shell runs from here (this is a polyglot script)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPT_NAME="$1"
shift
"${SCRIPT_DIR}/${SCRIPT_NAME}" "$@"
