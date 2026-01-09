---
name: multi-ai-code-review
description: Run multi-provider code reviews over git diffs/PR changes using headless AI CLIs (Claude Code `claude`, Google `gemini`, optionally GitHub `copilot`) and output structured findings + an optional synthesized report; use for security/bug/perf review of recent changes and for generating PR-ready review comments.
context:fork: true
type: codex-adapter
model: sonnet
allowed-tools: bash, git
version: 2.0
best_practices:
  - Use for PR reviews and security audits
  - Run against staged changes or commit ranges
  - Enable synthesis for consensus findings
  - Use CI mode for automated pipelines
error_handling: graceful
streaming: not_supported
---

<identity>
Multi-AI Code Review - Agent Studio adapter for Codex CLI skill that performs multi-provider code reviews using external AI CLIs.
</identity>

<capabilities>
- Multi-provider code review (Claude, Gemini, Copilot)
- Git diff analysis (staged, unstaged, commit ranges)
- Structured JSON output conforming to `.claude/schemas/multi-ai-review-report.schema.json`
- Markdown PR comment generation
- CI-friendly strict JSON mode
- Consensus synthesis from multiple AI providers
- Session-first or env-first authentication
- Large diff sampling and truncation
</capabilities>

<instructions>
<execution_process>
## Adapter Pattern

This is an **Agent Studio-compatible wrapper** for the Codex CLI skill located in `codex-skills/multi-ai-code-review/`.

### Invocation Methods

**Natural Language**:
```
Run multi-AI code review on these changes
Review this PR with Claude and Gemini
```

**Direct Skill Invocation**:
```javascript
// Via Agent Studio Skill tool
{
  "skill": "multi-ai-code-review",
  "params": {
    "providers": ["claude", "gemini"],
    "output": "json",
    "range": "origin/main...HEAD"
  }
}
```

**Direct CLI (Codex pattern)**:
```bash
node codex-skills/multi-ai-code-review/scripts/review.js --providers claude,gemini --range origin/main...HEAD
```

## Parameters

### Required
- None (defaults to unstaged diff with claude,gemini)

### Optional
- `providers` (Array|String): AI providers to use (default: `["claude", "gemini"]`)
- `output` (String): Output format - `"json"` or `"markdown"` (default: `"json"`)
- `staged` (Boolean): Review staged changes instead of unstaged (default: `false`)
- `range` (String): Git commit range (e.g., `"origin/main...HEAD"`)
- `diffFile` (String): Path to diff file instead of git diff
- `authMode` (String): `"session-first"` or `"env-first"` (default: `"session-first"`)
- `timeoutMs` (Number): Provider timeout in milliseconds (default: `240000`)
- `synthesize` (Boolean): Enable consensus synthesis (default: `true`)
- `synthesizeWith` (String): Provider for synthesis (default: first provider)
- `maxDiffChars` (Number): Max diff characters before sampling (default: `220000`)
- `ci` (Boolean): CI mode - implies `--no-synthesis`, `--output json`, strict JSON-only (default: `false`)
- `strictJsonOnly` (Boolean): Strict JSON mode with non-zero exit on failure (default: `false`)
- `dryRun` (Boolean): No network calls, prints collected diff stats (default: `false`)

## Output Schema

All JSON output conforms to `.claude/schemas/multi-ai-review-report.schema.json`.

**Success Response**:
```json
{
  "success": true,
  "data": {
    "diffMeta": {
      "bytes": 12345,
      "sha256": "abc123...",
      "staged": false,
      "range": "origin/main...HEAD",
      "truncated": false
    },
    "providers": [
      { "provider": "claude", "ok": true },
      { "provider": "gemini", "ok": true }
    ],
    "perProvider": [
      {
        "provider": "claude",
        "ok": true,
        "parsed": {
          "overall_risk": "low",
          "summary": "Code changes look good...",
          "findings": [...]
        }
      }
    ],
    "synthesis": {
      "provider": "claude",
      "ok": true,
      "parsed": {
        "overall_risk": "low",
        "summary": "Synthesized review...",
        "findings": [...]
      }
    }
  },
  "format": "json"
}
```

**Error Response**:
```json
{
  "success": false,
  "error": "Codex CLI execution failed",
  "exitCode": 1
}
```

## Authentication

### Session-First (Default)
1. Try CLI using logged-in session (API keys hidden)
2. If fails and env keys exist, retry with env keys

### Environment Variables
- Claude: `ANTHROPIC_API_KEY` (optional if logged in)
- Gemini: `GEMINI_API_KEY` or `GOOGLE_API_KEY` (optional if logged in)
- Copilot: Uses its own CLI auth flow

### Override to Env-First
```javascript
{
  "skill": "multi-ai-code-review",
  "params": {
    "authMode": "env-first"
  }
}
```
</execution_process>

<usage_patterns>
## Common Use Cases

### PR Review (Standard)
```javascript
{
  "skill": "multi-ai-code-review",
  "params": {
    "range": "origin/main...HEAD",
    "providers": ["claude", "gemini"],
    "output": "markdown"
  }
}
```

### Security Audit (High Stakes)
```javascript
{
  "skill": "multi-ai-code-review",
  "params": {
    "providers": ["claude", "gemini", "copilot"],
    "synthesize": true,
    "output": "json"
  }
}
```

### CI Pipeline (Automated)
```javascript
{
  "skill": "multi-ai-code-review",
  "params": {
    "ci": true,
    "range": "origin/main...HEAD",
    "providers": ["claude", "gemini"]
  }
}
```

### Quick Staged Review
```javascript
{
  "skill": "multi-ai-code-review",
  "params": {
    "staged": true,
    "providers": ["claude"]
  }
}
```
</usage_patterns>
</instructions>

<examples>
<code_example>
**Agent Studio Invocation**:

```javascript
// Via Skill tool in Agent Studio
const result = await invoke({
  skill: "multi-ai-code-review",
  params: {
    providers: ["claude", "gemini"],
    range: "origin/main...HEAD",
    output: "json"
  }
});

console.log(result.data.synthesis.parsed.summary);
```

**Natural Language Invocation**:

```
Run multi-AI code review on the PR branch with Claude and Gemini
```

**Direct CLI (Codex Pattern)**:

```bash
# Unstaged diff
node codex-skills/multi-ai-code-review/scripts/review.js --providers claude,gemini

# Staged diff
node codex-skills/multi-ai-code-review/scripts/review.js --staged --providers claude,gemini

# PR branch
node codex-skills/multi-ai-code-review/scripts/review.js --range origin/main...HEAD --providers claude,gemini

# CI mode
node codex-skills/multi-ai-code-review/scripts/review.js --ci --range origin/main...HEAD --providers claude,gemini > ai-review.json
```
</code_example>
</examples>

## Implementation Details

### Adapter Architecture

```
Agent Studio Skill Invocation
         ↓
.claude/skills/multi-ai-code-review/invoke.mjs (Adapter)
         ↓
codex-skills/multi-ai-code-review/scripts/review.js (Codex CLI)
         ↓
External AI CLIs (claude, gemini, copilot)
         ↓
Structured JSON Output
```

### Bridging Patterns

1. **Parameter Mapping**: Agent Studio params → CLI args
2. **Output Formatting**: CLI stdout → Agent Studio response
3. **Error Handling**: CLI errors → Agent Studio error format
4. **Schema Validation**: Output conforms to `.claude/schemas/multi-ai-review-report.schema.json`

### Codex CLI Location

The underlying Codex CLI skill is located at:
- **Script**: `codex-skills/multi-ai-code-review/scripts/review.js`
- **Documentation**: `codex-skills/multi-ai-code-review/SKILL.md`

### Windows Compatibility

- Uses `spawn` with `shell: true` for Windows `.cmd` shims
- Proper path resolution with `path.join()`
- No path concatenation issues

## Integration with Workflows

### Step 0.1: Plan Rating (Multi-AI Fallback)

When high-stakes plans require multi-AI validation, this skill can be used as a fallback:

```yaml
# In workflow YAML
step: 0.1
agent: planner
validation:
  multi_ai_rating:
    enabled: true
    skill: multi-ai-code-review
    fallback_to_single_model: true
```

### Step 6: Code Review

Standard integration for code review steps:

```yaml
step: 6
agent: code-reviewer
tools:
  - multi-ai-code-review
params:
  providers: ["claude", "gemini"]
  range: "origin/main...HEAD"
```

## Security

### API Key Protection

This skill implements defense-in-depth for credential protection following OWASP A02:2021 guidelines.

**Automatic Sanitization**:
- All error messages are automatically sanitized to prevent API key leakage
- Stack traces and stderr output are filtered before logging
- Environment variable values are redacted in error contexts
- CI/CD pipeline logs are protected from credential exposure

**Sanitized Patterns**:
- Anthropic API keys (`sk-ant-...`)
- OpenAI API keys (`sk-...`)
- Google/Gemini API keys (`AIza...`)
- GitHub tokens (`ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`)
- JWT tokens
- Authorization headers (Bearer, Basic)
- Environment variable assignments (`KEY=value`)
- Long alphanumeric tokens (40+ characters)

**Best Practices**:
1. **Use session-first authentication** - Avoids storing API keys in environment
2. **Never commit API keys** - Use environment variables or secret managers
3. **Rotate keys regularly** - Especially after suspected exposure
4. **Monitor logs for `[REDACTED]` markers** - Indicates potential key exposure attempt was blocked
5. **Use CI secrets** - Store keys in CI/CD secret management, not in code

**Implementation**:
```javascript
// Error handling in review.js automatically sanitizes
const { sanitize } = require('../../shared/sanitize-secrets.js');
console.error(sanitize(error.message)); // Safe to log
```

**Security Audit**:
- Run `node .claude/tools/test-sanitization.mjs` to verify sanitization patterns
- All 15 test cases must pass before deployment

## Notes / Constraints

- **Network Access Required**: Contacts external AI provider APIs
- **Large Diff Sampling**: For diffs > `maxDiffChars`, samples head+tail with marker
- **Provider Availability**: Gracefully handles provider failures with per-provider status
- **Retry Logic**: Automatic retry with exponential backoff (3 attempts per provider)
- **Session vs API Keys**: Session-first auth avoids hitting API rate limits for logged-in users
- **CI Mode**: Strict JSON-only mode for automated pipelines (non-zero exit on failure)

## Related Skills

- **response-rater**: Rate the quality of review outputs
- **repo-rag**: Search codebase for context before review
- **git**: Git operations for diff generation
- **code-style-validator**: Style validation to complement review
