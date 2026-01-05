---
name: multi-ai-code-review
description: Run multi-provider code reviews over git diffs/PR changes using headless AI CLIs (Claude Code `claude`, Google `gemini`, optionally GitHub `copilot`) and output structured findings + an optional synthesized report; use for security/bug/perf review of recent changes and for generating PR-ready review comments.
---

# Multi-AI Code Review

This skill runs independent code reviews using external headless AI CLIs and produces a structured report you can paste into a PR.

## Quick start (git diff)

Unstaged diff:

`node codex-skills/multi-ai-code-review/scripts/review.js --providers claude,gemini`

Staged diff:

`node codex-skills/multi-ai-code-review/scripts/review.js --staged --providers claude,gemini`

Diff range (example: typical PR branch):

`node codex-skills/multi-ai-code-review/scripts/review.js --range origin/main...HEAD --providers claude,gemini`

## Output formats

- `--output json` (default): machine-readable results + optional synthesis
- `--output markdown`: PR comment format

## CI-friendly mode (strict JSON-only)

Use `--ci` to force stable CI behavior:

- implies `--no-synthesis`
- forces `--output json`
- exits non-zero if any provider fails or returns non-parseable JSON

Example:

`node codex-skills/multi-ai-code-review/scripts/review.js --ci --range origin/main...HEAD --providers claude,gemini > ai-review.json`

## Auth behavior (session-first)

Default is `--auth-mode session-first`:

1) Try CLI using your existing logged-in session/subscription (keys temporarily hidden)
2) If that fails and env keys exist, retry using env keys

To flip:

`node codex-skills/multi-ai-code-review/scripts/review.js --auth-mode env-first --providers claude,gemini`

## Environment variables

- Claude: `ANTHROPIC_API_KEY` (optional if already logged in)
- Gemini: `GEMINI_API_KEY` or `GOOGLE_API_KEY` (optional if already logged in)
- Copilot: uses its own CLI auth flow

## Optional: critique the review itself

Pipe the generated review into the existing `response-rater` skill:

`node codex-skills/multi-ai-code-review/scripts/review.js --output markdown | node codex-skills/response-rater/scripts/rate.js --providers claude,gemini`

## Notes / constraints

- Requires network access to contact providers.
- For very large diffs, the runner samples hunks and reports what was omitted.
