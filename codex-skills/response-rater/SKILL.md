---
name: response-rater
description: Run headless AI CLIs (Claude Code `claude`, Google `gemini`, optionally GitHub `copilot`) to rate an assistant response against a rubric and return actionable feedback plus a rewritten improved response; use for response quality audits, prompt/docs reviews, and "have another AI critique this answer" workflows.
model: opus
---

# Response Rater

Use this skill to get _independent_ critiques of an assistant response by calling external AI CLIs in headless mode and aggregating the results.

## Quick start

1. Save the response you want reviewed to a file (or copy/paste it when prompted).

2. Ensure you have at least one provider authenticated:

- **Claude Code**: either (a) you’re already logged in via subscription/session, or (b) set `ANTHROPIC_API_KEY`
- **Gemini CLI**: either (a) you’re already logged in via subscription/session, or (b) set `GEMINI_API_KEY` or `GOOGLE_API_KEY`
- **Copilot CLI**: sign in with the CLI’s normal auth flow (varies by setup)

3. Run:

`node codex-skills/response-rater/scripts/rate.js --response-file <path> --providers "claude,gemini"`

Or via stdin:

`Get-Content response.txt | node codex-skills/response-rater/scripts/rate.js --providers "claude,gemini"`

## Vocabulary review (Privacy Airlock Stage 1)

`Get-Content server/models/sentencepiece/vocabulary.json | node codex-skills/response-rater/scripts/rate.js --providers "claude,gemini" --template vocab-review`

If Claude times out, increase timeout:

`Get-Content server/models/sentencepiece/vocabulary.json | node codex-skills/response-rater/scripts/rate.js --providers "claude,gemini" --template vocab-review --timeout-ms 240000`

## Auth behavior

By default the runner uses `--auth-mode session-first`:

1. Try the CLI using your existing logged-in session/subscription
2. If that fails and env keys exist, retry using env keys

To flip the order:

`node codex-skills/response-rater/scripts/rate.js --response-file response.txt --auth-mode env-first --providers claude,gemini`

## Direct headless commands (no script)

Claude:

`Get-Content response.txt | claude -p --output-format json --permission-mode bypassPermissions`

Gemini:

`Get-Content response.txt | gemini --output-format json --model gemini-2.5-flash`

## What it outputs

JSON to stdout:

- per-provider raw output
- parsed `scores`/`summary`/`improvements`/`rewrite` when the model returns valid JSON

## Notes / constraints

- This skill **requires network access** to contact the providers.
- If a provider is missing credentials, it will be skipped with a clear error.
- Keep the reviewed response reasonably sized; start with the exact section you want critiqued.

## Install

Copy `codex-skills/response-rater` to your Codex skills directory (usually `$CODEX_HOME/skills/response-rater`).
