@echo off
REM Windows ripgrep wrapper for LLM-RULES
REM Automatically uses the correct binary and configuration

set "SCRIPT_DIR=%~dp0"
set "RIPGREP_CONFIG_PATH=%SCRIPT_DIR%.ripgreprc"

"%SCRIPT_DIR%win32-x64\rg.exe" %*
