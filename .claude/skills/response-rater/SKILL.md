---
name: response-rater
version: 1.0.0
description: Run headless AI CLIs (Claude Code, Gemini, OpenAI Codex, Cursor Agent, GitHub Copilot) to rate an assistant response against a rubric and return actionable feedback plus a rewritten improved response; use for response quality audits, prompt/docs reviews, and "have another AI critique this answer" workflows.
allowed-tools: bash
---

# Response Rater

Use this skill to get *independent* critiques of an assistant response by calling external AI CLIs in headless mode and aggregating the results.

## Supported Providers

| Provider | CLI Command | Auth | Default Model |
|----------|-------------|------|---------------|
| **Claude Code** | `claude` | Session or `ANTHROPIC_API_KEY` | (CLI default) |
| **Gemini CLI** | `gemini` | Session or `GEMINI_API_KEY`/`GOOGLE_API_KEY` | gemini-3-pro-preview |
| **OpenAI Codex** | `codex` | `OPENAI_API_KEY` or `CODEX_API_KEY` | gpt-5.1-codex-max |
| **Cursor Agent** | `cursor-agent` (via WSL on Windows) | Session or `CURSOR_API_KEY` | auto |
| **GitHub Copilot** | `copilot` | GitHub auth (`gh auth login`) | claude-sonnet-4.5 |

## Quick Start

1) Save the response you want reviewed to a file (or pipe it via stdin).

2) Ensure you have at least one provider authenticated (see table above).

3) Run:

```bash
node .claude/skills/response-rater/scripts/rate.cjs --response-file <path> --providers claude,gemini
```

Or via stdin (PowerShell):

```powershell
Get-Content response.txt | node .claude/skills/response-rater/scripts/rate.cjs --providers claude,gemini
```

Or via stdin (Bash):

```bash
cat response.txt | node .claude/skills/response-rater/scripts/rate.cjs --providers claude,gemini
```

## All Providers Example

```bash
node .claude/skills/response-rater/scripts/rate.cjs \
  --response-file response.txt \
  --providers claude,gemini,codex,cursor,copilot
```

## Model Selection

Each provider has a configurable model:

```bash
# Use specific models for each provider
node .claude/skills/response-rater/scripts/rate.cjs \
  --response-file response.txt \
  --providers gemini,codex,copilot \
  --gemini-model gemini-2.5-pro \
  --codex-model gpt-5.1-codex \
  --copilot-model gpt-5
```

### Available Models by Provider

**Gemini CLI:**
- `gemini-3-pro-preview` (default, latest flagship)
- `gemini-3-flash-preview` (fast, latest)
- `gemini-2.5-pro` (stable pro)
- `gemini-2.5-flash` (stable fast)
- `gemini-2.5-flash-lite` (lightweight)

**OpenAI Codex:**
- `gpt-5.1-codex-max` (default, flagship)
- `gpt-5.1-codex` (standard)
- `gpt-5.1-codex-mini` (faster/cheaper)

**Cursor Agent:**
- `auto` (default, smart selection)
- `gpt-5.1-high`, `gpt-5.1-codex-high`
- `opus-4.5`, `sonnet-4.5`
- `gemini-3-pro`

**GitHub Copilot:**
- `claude-sonnet-4.5` (default)
- `claude-opus-4.5`, `claude-haiku-4.5`, `claude-sonnet-4`
- `gpt-5.1-codex-max`, `gpt-5.1-codex`, `gpt-5.1-codex-mini`
- `gpt-5.2`, `gpt-5.1`, `gpt-5`, `gpt-5-mini`, `gpt-4.1`
- `gemini-3-pro-preview`

## Templates

```bash
# Response review (default) - critique against rubric
--template response-review

# Vocabulary review - security audit for LLM vocabulary files
--template vocab-review
```

### Vocabulary Review Example

```powershell
Get-Content vocabulary.json | node .claude/skills/response-rater/scripts/rate.cjs \
  --providers claude,gemini \
  --template vocab-review
```

## Auth Behavior

By default the runner uses `--auth-mode session-first`:

1. Try the CLI using your existing logged-in session/subscription
2. If that fails and env keys exist, retry using env keys

To flip the order:

```bash
node .claude/skills/response-rater/scripts/rate.cjs \
  --response-file response.txt \
  --auth-mode env-first \
  --providers claude,gemini
```

## Direct Headless Commands (No Script)

**Claude Code:**
```powershell
Get-Content response.txt | claude -p --output-format json --permission-mode bypassPermissions
```

**Gemini CLI:**
```powershell
Get-Content response.txt | gemini --output-format json --model gemini-3-pro-preview
```

**OpenAI Codex:**
```bash
codex exec --json --color never --model gpt-5.1-codex-max --skip-git-repo-check "Your prompt"
```

**Cursor Agent (via WSL on Windows):**
```bash
wsl bash -lc "cursor-agent -p 'Your prompt' --output-format json --model auto"
```

**GitHub Copilot:**
```bash
copilot -p --silent --no-color --model claude-sonnet-4.5 "Your prompt"
```

## Output Format

JSON to stdout with:

- `promptVersion`: Schema version
- `template`: Template used
- `authMode`: Auth mode used
- `providers`: Object with per-provider results:
  - `ok`: Boolean success
  - `authUsed`: Which auth method worked
  - `raw`: Truncated raw output
  - `parsed`: Extracted JSON with `scores`, `summary`, `improvements`, `rewrite`
  - `attempts`: Auth attempt history

### Sample Output

```json
{
  "promptVersion": 3,
  "template": "response-review",
  "authMode": "session-first",
  "providers": {
    "claude": {
      "ok": true,
      "authUsed": "session",
      "parsed": {
        "scores": {
          "correctness": 8,
          "completeness": 7,
          "clarity": 9,
          "actionability": 8,
          "risk_management": 6,
          "constraint_alignment": 8,
          "brevity": 7
        },
        "summary": "The response is well-structured...",
        "improvements": ["Add error handling for...", "..."],
        "rewrite": "Improved version..."
      }
    },
    "gemini": { "ok": true, "..." },
    "codex": { "ok": true, "..." }
  }
}
```

## Notes / Constraints

- This skill **requires network access** to contact the providers.
- If a provider is missing credentials, it will be skipped with a clear error.
- Keep the reviewed response reasonably sized; start with the exact section you want critiqued.
- Timeout is 180 seconds per provider (3 minutes).

## Installation Requirements

Install the CLIs you want to use:

```bash
# Claude Code (via npm)
npm install -g @anthropic-ai/claude-code

# Gemini CLI (via npm)
npm install -g @anthropic-ai/gemini

# OpenAI Codex (via npm)
npm install -g @openai/codex

# Cursor Agent (via curl, inside WSL on Windows)
wsl bash -lc "curl https://cursor.com/install -fsS | bash"

# GitHub Copilot (via npm)
npm install -g @github/copilot
```

## Skill Invocation

**Natural language** (recommended):
```
"Rate this response against the rubric"
"Have another AI critique this answer"
"Review the vocabulary file for security issues"
"Get feedback from Claude, Gemini, and Codex on this response"
```

**Direct CLI**:
```bash
node .claude/skills/response-rater/scripts/rate.cjs --response-file response.txt --providers claude,gemini,codex,cursor,copilot
```

## CLI Reference

```
Usage:
  node .claude/skills/response-rater/scripts/rate.cjs --response-file <path> [options]
  cat response.txt | node .claude/skills/response-rater/scripts/rate.cjs [options]

Options:
  --response-file <path>   # file containing the response to review
  --question-file <path>   # optional; original question/request for context
  --providers <list>       # comma-separated: claude,gemini,codex,cursor,copilot

Models:
  --gemini-model <model>   # default: gemini-3-pro-preview
  --codex-model <model>    # default: gpt-5.1-codex-max
  --cursor-model <model>   # default: auto
  --copilot-model <model>  # default: claude-sonnet-4.5

Templates:
  --template response-review   # default
  --template vocab-review      # security audit

Auth:
  --auth-mode session-first   # default
  --auth-mode env-first       # try env keys first
```
