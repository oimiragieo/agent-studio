# Instruments

Agent Zero–style “instruments”: discoverable, on-disk helpers you can run without bloating prompts.

## Layout

- `.claude/instruments/default/` — version-controlled instruments shipped with this repo
- `.claude/instruments/custom/` — your local instruments (also version-controlled if you want)

Each instrument is a folder containing `instrument.json`.

## `instrument.json`

Example:

```json
{
  "name": "system-diagnostics",
  "description": "Run repo diagnostics (tests + validations)",
  "command": "node .claude/tools/system-diagnostics.mjs",
  "timeout_ms": 3600000
}
```

## Usage

- List: `node .claude/tools/instruments.mjs list`
- Run: `node .claude/tools/instruments.mjs run <name> -- <args...>`
