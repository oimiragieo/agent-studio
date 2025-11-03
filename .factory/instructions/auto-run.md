# Auto-Run Mode Guide

Auto-Run Mode lets you choose how much autonomy droid has after approving a plan, reducing repeated confirmations while maintaining control.

## Autonomy Levels

| Level | What Runs Automatically | Typical Examples |
|-------|------------------------|------------------|
| **Auto (Low)** | File edits, file creation, read-only commands from allowlist | Edit, Create, ls, git status, rg |
| **Auto (Medium)** | Everything from Low plus reversible workspace changes | npm install, pip install, git commit, mv, cp, build tooling |
| **Auto (High)** | All commands except explicitly blocked safety commands | docker compose up, git push (if allowed), migrations, custom scripts |

## Risk Classification

Every command includes a risk rating and justification:

- **Low risk**: Read-only operations and changes that cannot create irreversible damage
  - Examples: listing files, showing logs, git diff, file reads
- **Medium risk**: Actions that alter workspace but are straightforward to undo
  - Examples: package installs, moving files, local git operations, builds
- **High risk**: Commands that could be destructive, hard to roll back, or security sensitive
  - Examples: sudo, wiping directories, deploying, piping remote scripts

Commands run automatically only when their risk level is **less than or equal to** your current setting.

## How Auto-Run Decides What to Execute

### File Tools

- **Create, Edit, MultiEdit, ApplyPatch**: Always treated as low risk
- Run instantly when Auto-Run is active (any level)

### Execute Commands

Follow the risk threshold:
- **Auto (Low)**: Auto-accepts only read-only allowlisted commands
- **Auto (Medium)**: Adds reversible commands (installs, local git, etc.)
- **Auto (High)**: Accepts any command with declared risk level (except safety blocks)

### Safety Interlocks

**Always trigger confirmation** (even in Auto High):
- Dangerous patterns: `rm -rf /`, `dd of=/dev/*`, etc.
- Command substitution: `$(...)`, backticks
- Explicitly flagged by CLI security checks
- Commands in denylist

### Allowlist Expansion

When you approve a command, add it to the session allowlist:
- Future occurrences run without another prompt
- Session-specific (not persistent across restarts)
- Useful for repeated safe commands

## Enabling and Switching Modes

### Keyboard Shortcut

Press `Shift+Tab` (or `Ctrl+T` on Windows) to cycle through:
- Normal → Spec → Auto (Low) → Auto (Medium) → Auto (High) → back to Normal

Active mode is shown in the status banner and Help popup.

### Settings Default

Set persistent default in Settings:
1. Open CLI settings: `/settings`
2. Choose preferred autonomy level
3. Settings persist for future sessions

### After Specification Approval

When approving a Specification Mode plan:
- **"Proceed"**: Manual confirmation (Normal mode)
- **"Auto (Low/Medium/High)"**: Enable Auto-Run for implementation phase

### Return to Manual

Cycle back to Normal mode at any time:
- Droid resumes asking for each file change and command
- Useful for sensitive or complex changes

## Workflow Examples

### Auto (Low) - Quick File Updates

```
Update docs/README.md with new instructions
Run ls, git status, and rg searches as needed
```

All edits and read-only checks happen without prompts, while anything that modifies dependencies asks first.

### Auto (Medium) - Feature Work

```
Add a new React component with tests
Install dependencies as needed
Run build and tests to verify
```

File edits, dependency installs, and test runs happen automatically. Only destructive operations require confirmation.

### Auto (High) - Infrastructure Changes

```
Deploy database migrations
Start docker containers
Update environment configurations
```

Most operations proceed automatically. Only explicit safety blocks (force push, dangerous deletes) require confirmation.

## Best Practices

### Start Conservative

- Begin with **Auto (Low)** for new projects or unfamiliar codebases
- Increase autonomy as you build trust with droid's decisions
- Use **Normal** mode for security-critical or architecture changes

### Review Changes

Even in Auto-Run:
- **Review file diffs** before committing
- **Verify test results** match expectations
- **Check logs** for unexpected errors or warnings

### Use Specification Mode First

For complex features:
1. Use **Specification Mode** to generate a complete plan
2. Review and approve the specification
3. Enable **Auto-Run** for implementation phase

This gives you control over planning while automating execution.

### Monitor Output

Auto-Run always shows:
- Streamed command output in real-time
- File changes highlighted in diffs
- Progress indicators for long-running tasks

Watch the output to catch issues early.

### Set Boundaries

Even in Auto-Run, set explicit boundaries:
```
Only modify files in the auth directory
Don't change the public API
Follow existing patterns in middleware/
```

## When You Will Still Get Prompted

**Always prompted** (regardless of Auto-Run level):
- Commands in denylist
- Dangerous patterns (rm -rf, sudo rm, format, etc.)
- Command substitution in scripts
- First occurrence of commands above risk threshold

**Auto (Low)** also prompts for:
- Package installs (npm, pip, etc.)
- Git commits and pushes
- File moves and copies
- Build and test commands

**Auto (Medium)** prompts for:
- Destructive operations
- Git force operations
- Database migrations
- Deployment commands

**Auto (High)** prompts only for:
- Explicitly blocked safety commands
- Commands in denylist

## Troubleshooting

### Too many prompts even in Auto (High)

- Check that commands aren't in denylist: `/settings` → `commandDenylist`
- Review risk classification: Some commands may be incorrectly flagged as high risk
- Add safe commands to allowlist: `/settings` → `commandAllowlist`

### Commands running when they shouldn't

- Check autonomy level in status banner
- Verify command isn't in allowlist
- Review risk classification in command output

### Want more control

- Cycle to **Normal** mode for manual confirmation
- Use **Specification Mode** for planning, then Normal for execution
- Adjust allowlist/denylist in settings

