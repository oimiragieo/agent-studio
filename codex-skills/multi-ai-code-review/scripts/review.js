#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Multi-AI Code Review
 *
 * Enhanced with:
 * - Partial Failure Recovery (Cursor Recommendation #11)
 * - Circuit Breaker Pattern (Cursor Recommendation #14)
 * - Enhanced Error Context (Cursor Recommendation #10)
 */

const { spawn, execSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// Try to load js-yaml for config parsing, fallback to simple parsing if not available
let yaml;
try {
  yaml = require("js-yaml");
} catch (e) {
  // Fallback: simple YAML parsing not available, will use defaults
  yaml = null;
}
const { withRetry } = require("../../shared/retry-utils.js");
const { sanitize, sanitizeError } = require("../../shared/sanitize-secrets.js");

// Try to import circuit breaker (ESM module)
let CircuitBreaker = null;
let getProviderCircuitBreaker = null;
try {
  // Dynamic import for ESM module from CommonJS
  const circuitBreakerPath = path.join(__dirname, "../../../.claude/tools/circuit-breaker.mjs");
  if (fs.existsSync(circuitBreakerPath)) {
    // We'll use a synchronous check and async import later
    // For now, we'll implement a simple inline circuit breaker for CommonJS compatibility
  }
} catch (e) {
  // Circuit breaker not available
}

// Simple inline Circuit Breaker for CommonJS compatibility
class SimpleCircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 3;
    this.resetTimeout = options.resetTimeout || 60000;
    this.states = new Map();
  }

  canExecute(provider) {
    const state = this.getState(provider);
    if (state.state === "open") {
      if (Date.now() > state.openUntil) {
        state.state = "half-open";
        this.states.set(provider, state);
        return true;
      }
      return false;
    }
    return true;
  }

  recordSuccess(provider) {
    const state = this.getState(provider);
    state.failures = 0;
    state.state = "closed";
    this.states.set(provider, state);
  }

  recordFailure(provider) {
    const state = this.getState(provider);
    state.failures++;
    if (state.failures >= this.failureThreshold) {
      state.state = "open";
      state.openUntil = Date.now() + this.resetTimeout;
      console.warn(`[circuit-breaker] ${provider}: Circuit OPEN (${state.failures} failures)`);
    }
    this.states.set(provider, state);
  }

  getState(provider) {
    if (!this.states.has(provider)) {
      this.states.set(provider, { failures: 0, state: "closed", openUntil: null });
    }
    return this.states.get(provider);
  }
}

// Global circuit breaker instance
const providerCircuitBreaker = new SimpleCircuitBreaker({
  failureThreshold: 3,
  resetTimeout: 60000
});

// CLI command mappings for each provider
const CLI_COMMANDS = {
  claude: "claude",
  gemini: "gemini",
  codex: "codex",
  cursor: "cursor-agent",
  copilot: "copilot"
};

/**
 * Load provider configuration from config.yaml
 * @returns {Object} Provider priority configuration
 */
function loadProviderConfig() {
  const defaults = {
    primary: "claude",
    secondary: ["gemini", "codex"],
    fallback_threshold: 1
  };

  // If yaml parser not available, use defaults
  if (!yaml) {
    return defaults;
  }

  const configPath = path.join(__dirname, "../../../.claude/config.yaml");
  try {
    if (fs.existsSync(configPath)) {
      const configContent = fs.readFileSync(configPath, "utf8");
      const config = yaml.load(configContent);
      return config?.codex_skills?.provider_priority || defaults;
    }
  } catch (err) {
    console.warn(`[config] Could not load provider config: ${err.message}`);
  }
  return defaults;
}

/**
 * Load partial failure configuration from config.yaml (Cursor Recommendation #11)
 * @returns {Object} Partial failure configuration
 */
function loadPartialFailureConfig() {
  const defaults = {
    enabled: true,
    min_success_count: 2,
    min_success_rate: 0.67
  };

  if (!yaml) {
    return defaults;
  }

  const configPath = path.join(__dirname, "../../../.claude/config.yaml");
  try {
    if (fs.existsSync(configPath)) {
      const configContent = fs.readFileSync(configPath, "utf8");
      const config = yaml.load(configContent);
      return config?.codex_skills?.partial_failure || defaults;
    }
  } catch (err) {
    console.warn(`[config] Could not load partial failure config: ${err.message}`);
  }
  return defaults;
}

/**
 * Load circuit breaker configuration from config.yaml (Cursor Recommendation #14)
 * @returns {Object} Circuit breaker configuration
 */
function loadCircuitBreakerConfig() {
  const defaults = {
    enabled: true,
    failure_threshold: 3,
    reset_timeout_ms: 60000,
    half_open_max_attempts: 2
  };

  if (!yaml) {
    return defaults;
  }

  const configPath = path.join(__dirname, "../../../.claude/config.yaml");
  try {
    if (fs.existsSync(configPath)) {
      const configContent = fs.readFileSync(configPath, "utf8");
      const config = yaml.load(configContent);
      const cbConfig = config?.codex_skills?.circuit_breaker;
      if (cbConfig) {
        // Update global circuit breaker with config values
        providerCircuitBreaker.failureThreshold = cbConfig.failure_threshold || defaults.failure_threshold;
        providerCircuitBreaker.resetTimeout = cbConfig.reset_timeout_ms || defaults.reset_timeout_ms;
      }
      return cbConfig || defaults;
    }
  } catch (err) {
    console.warn(`[config] Could not load circuit breaker config: ${err.message}`);
  }
  return defaults;
}

/**
 * Log error with enhanced context (Cursor Recommendation #10)
 * @param {Error} error - The error to log
 * @param {Object} context - Error context
 */
function logErrorWithContext(error, context = {}) {
  const errorDir = path.join(__dirname, "../../../.claude/context/errors");

  try {
    if (!fs.existsSync(errorDir)) {
      fs.mkdirSync(errorDir, { recursive: true });
    }

    const timestamp = Date.now();
    const provider = context.provider || "unknown";
    const errorFile = path.join(errorDir, `review-${provider}-${timestamp}.json`);

    const errorData = {
      timestamp: new Date().toISOString(),
      operation: "multi_ai_code_review",
      provider: context.provider,
      error: {
        message: sanitize(error.message || String(error)),
        name: error.name || "Error",
        code: error.code || null,
        stack: sanitize(error.stack || "").split("\n").slice(0, 10).join("\n")
      },
      context: {
        diffMeta: context.diffMeta || null,
        attempt: context.attempt || 1,
        authMode: context.authMode || null
      },
      system: {
        platform: process.platform,
        nodeVersion: process.version
      }
    };

    fs.writeFileSync(errorFile, JSON.stringify(errorData, null, 2));
    console.error(`[error-logger] Error logged to: ${errorFile}`);
  } catch (logError) {
    console.error(`[error-logger] Failed to log error: ${logError.message}`);
  }
}

/**
 * Validate CLI availability for a provider
 * Re-validates CLI immediately before invoking Codex skills
 * @param {string} provider - Provider name
 * @returns {Promise<{available: boolean, provider: string, version?: string, error?: string}>}
 */
async function validateProviderCli(provider) {
  const cli = CLI_COMMANDS[provider];
  if (!cli) {
    // Unknown provider - assume available (will fail at runtime if not)
    return { available: true, provider, note: "unknown_cli" };
  }

  return new Promise((resolve) => {
    try {
      // Use execSync with short timeout for quick validation
      const result = execSync(`${cli} --version`, {
        timeout: 5000,
        stdio: ["pipe", "pipe", "pipe"],
        shell: true,
        encoding: "utf8"
      });
      resolve({
        available: true,
        provider,
        version: result.trim().split("\n")[0]
      });
    } catch (err) {
      resolve({
        available: false,
        provider,
        error: sanitize(err.message || String(err))
      });
    }
  });
}

// JSON Schema validation (Ajv or simple fallback)
let ajv, validate;
try {
  const Ajv = require("ajv");
  ajv = new Ajv({ allErrors: true });
  const schemaPath = path.join(__dirname, "../../../.claude/schemas/multi-ai-review-report.schema.json");
  if (fs.existsSync(schemaPath)) {
    const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
    validate = ajv.compile(schema);
  }
} catch (err) {
  console.warn(`⚠️  Schema validation unavailable: ${err.message}`);
}

/**
 * Validate output against schema
 * Supports both warning mode (default) and blocking mode
 * @param {Object} output - The output object to validate
 * @param {string} mode - Validation mode: 'warning' (default) or 'blocking'
 * @returns {Object} Validated output with _validation field
 * @throws {Error} In blocking mode, throws if validation fails
 */
function validateOutput(output, mode = "warning") {
  if (!validate) {
    // Validation not available - no Ajv or no schema
    return {
      ...output,
      _validation: { valid: false, reason: "validator_unavailable", mode }
    };
  }

  const valid = validate(output);
  if (!valid) {
    const errors = validate.errors || [];
    console.warn("⚠️  Output validation failed:");
    errors.forEach((error, index) => {
      console.warn(`   ${index + 1}. ${error.instancePath || "/"}: ${error.message}`);
      if (error.params) {
        console.warn(`      params: ${JSON.stringify(error.params)}`);
      }
    });

    // In blocking mode, throw an error to fail fast
    if (mode === "blocking") {
      const errorSummary = errors
        .slice(0, 5)
        .map((e) => `${e.instancePath || "/"}: ${e.message}`)
        .join("; ");
      throw new Error(`Schema validation failed (blocking mode): ${errorSummary}`);
    }

    return {
      ...output,
      _validation: {
        valid: false,
        errors,
        errorCount: errors.length,
        mode
      }
    };
  }

  return {
    ...output,
    _validation: { valid: true, mode }
  };
}

function parseArgs(argv) {
  const args = {
    providers: "claude,gemini",
    authMode: "session-first", // session-first | env-first
    output: "json", // json | markdown
    timeoutMs: 240000,
    staged: false,
    range: null,
    diffFile: null,
    maxDiffChars: 220000,
    synthesize: true,
    synthesizeWith: null, // defaults to first provider
    strictJsonOnly: false,
    ci: false,
    dryRun: false,
    validationMode: "warning", // warning | blocking
    skipCliValidation: false, // skip CLI availability check
  };

  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === "--providers") args.providers = argv[++i];
    else if (t === "--auth-mode") args.authMode = argv[++i];
    else if (t === "--output") args.output = argv[++i];
    else if (t === "--timeout-ms") args.timeoutMs = Number(argv[++i]);
    else if (t === "--staged") args.staged = true;
    else if (t === "--range") args.range = argv[++i];
    else if (t === "--diff-file") args.diffFile = argv[++i];
    else if (t === "--max-diff-chars") args.maxDiffChars = Number(argv[++i]);
    else if (t === "--no-synthesis") args.synthesize = false;
    else if (t === "--synthesize-with") args.synthesizeWith = argv[++i];
    else if (t === "--strict-json-only") args.strictJsonOnly = true;
    else if (t === "--ci") args.ci = true;
    else if (t === "--dry-run") args.dryRun = true;
    else if (t === "--validation-mode") args.validationMode = argv[++i];
    else if (t === "--skip-cli-validation") args.skipCliValidation = true;
    else if (t === "--help" || t === "-h") args.help = true;
  }

  return args;
}

function usage(exitCode = 0) {
  console.log(
    [
      "Usage:",
      "  node codex-skills/multi-ai-code-review/scripts/review.js [--staged] [--range <A...B>] [--providers claude,gemini] [--output json|markdown]",
      "  node codex-skills/multi-ai-code-review/scripts/review.js --ci [--range <A...B>] [--providers claude,gemini]",
      "",
      "Examples:",
      "  node codex-skills/multi-ai-code-review/scripts/review.js --providers claude,gemini",
      "  node codex-skills/multi-ai-code-review/scripts/review.js --staged --providers claude,gemini",
      "  node codex-skills/multi-ai-code-review/scripts/review.js --range origin/main...HEAD --providers claude,gemini",
      "",
      "Auth:",
      "  --auth-mode session-first (default): try logged-in CLI session first, then env keys",
      "  --auth-mode env-first: try env keys first, then logged-in CLI session",
      "",
      "CI:",
      "  --ci (implies --no-synthesis, --output json, strict JSON-only, non-zero exit on provider/parse failure)",
      "  --strict-json-only (emit minimal JSON and non-zero exit on provider/parse failure)",
      "",
      "Synthesis:",
      "  --no-synthesis (skip final dedupe/synthesis step)",
      "  --synthesize-with <provider> (default: first provider)",
      "",
      "Validation:",
      "  --validation-mode warning (default): log validation errors but continue",
      "  --validation-mode blocking: fail fast if schema validation fails",
      "  --skip-cli-validation: skip CLI availability check (use when CLIs are known to be available)",
      "",
      "Safety:",
      "  --dry-run (no network calls; prints collected diff stats and exits)",
    ].join("\n"),
  );
  process.exit(exitCode);
}

function runCommand(command, args, input, { timeoutMs = 60000, env } = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: env || process.env,
      shell: true, // Windows-friendly for .cmd shims
    });

    let stdout = "";
    let stderr = "";
    const timeoutId = setTimeout(() => {
      child.kill();
      resolve({ ok: false, stdout, stderr: `${stderr}\nTIMEOUT` });
    }, timeoutMs);

    child.stdout.on("data", (d) => (stdout += d.toString("utf8")));
    child.stderr.on("data", (d) => (stderr += d.toString("utf8")));
    child.on("close", (code) => {
      clearTimeout(timeoutId);
      resolve({ ok: code === 0, stdout, stderr, code });
    });

    if (input) child.stdin.write(input);
    child.stdin.end();
  });
}

async function getGitDiff({ staged, range }) {
  const args = ["diff", "--no-color", "--unified=3"];
  if (staged) args.push("--cached");
  if (range) args.push(range);
  const res = await runCommand("git", args, null, { timeoutMs: 120000 });
  if (!res.ok) throw new Error(`git diff failed: ${res.stderr || res.stdout}`);
  return res.stdout;
}

async function getGitStatus() {
  const res = await runCommand("git", ["status", "--porcelain=v1"], null, {
    timeoutMs: 60000,
  });
  if (!res.ok) return null;
  return res.stdout.trim();
}

function sampleDiff(diffText, maxChars) {
  const text = String(diffText || "");
  if (text.length <= maxChars) return { sampled: text, omitted: 0, strategy: "none" };

  // Keep header + first/last chunks (cheap, deterministic).
  const head = text.slice(0, Math.floor(maxChars * 0.6));
  const tail = text.slice(-Math.floor(maxChars * 0.35));
  const marker = "\n\n--- DIFF TRUNCATED FOR REVIEW (MIDDLE OMITTED) ---\n\n";
  const sampled = head + marker + tail;
  return { sampled, omitted: text.length - sampled.length, strategy: "head+tail" };
}

function buildReviewPrompt({ repoName, status, diffSampled, diffMeta }) {
  const schema = {
    type: "object",
    properties: {
      summary: { type: "string" },
      overall_risk: { type: "string", enum: ["low", "medium", "high", "critical"] },
      key_changes: { type: "array", items: { type: "string" } },
      findings: {
        type: "array",
        items: {
          type: "object",
          properties: {
            severity: { type: "string", enum: ["nit", "low", "medium", "high", "critical"] },
            area: { type: "string", enum: ["correctness", "security", "performance", "reliability", "maintainability", "observability"] },
            file: { type: "string" },
            issue: { type: "string" },
            recommendation: { type: "string" },
            confidence: { type: "number" },
          },
          required: ["severity", "area", "issue", "recommendation"],
        },
      },
      tests_to_add: { type: "array", items: { type: "string" } },
      questions: { type: "array", items: { type: "string" } },
    },
    required: ["summary", "overall_risk", "findings"],
  };

  return [
    "You are a senior engineer performing a code review of a git diff for a production system.",
    "",
    "Priorities (in order): correctness, security, reliability, observability, performance, maintainability.",
    "Be pragmatic: favor 'warn+monitor' for low/medium issues when usability matters, but do not downplay critical security issues.",
    "",
    "Return ONLY valid JSON that conforms to this JSON Schema (draft-07 style):",
    '"""',
    JSON.stringify(schema, null, 2),
    '"""',
    "",
    `REPO: ${repoName || "unknown"}`,
    status ? `GIT STATUS (porcelain):\n"""\n${status}\n"""` : "",
    "",
    `DIFF META: ${JSON.stringify(diffMeta)}`,
    "",
    "GIT DIFF (may be truncated):",
    '"""',
    diffSampled.trim(),
    '"""',
  ]
    .filter(Boolean)
    .join("\n");
}

function providerEnvForAttempt(provider, authMode, attempt) {
  const base = { ...process.env };
  const stripKeys = (env) => {
    delete env.ANTHROPIC_API_KEY;
    delete env.GEMINI_API_KEY;
    delete env.GOOGLE_API_KEY;
    delete env.GOOGLE_GENAI_API_KEY;
    delete env.COPILOT_API_KEY;
  };

  // attempt: 1 then 2 (fallback)
  if (authMode === "env-first") {
    if (attempt === 1) return base; // keys visible (if set)
    stripKeys(base);
    return base; // session-only retry
  }

  // session-first
  if (attempt === 1) {
    stripKeys(base);
    return base; // session-only first
  }
  return base; // keys visible retry
}

function looksLikeAuthFailure(stderrText) {
  const s = String(stderrText || "").toLowerCase();
  return (
    s.includes("api key") ||
    s.includes("auth") ||
    s.includes("unauthorized") ||
    s.includes("permission") ||
    s.includes("login") ||
    s.includes("not logged") ||
    s.includes("credentials")
  );
}

async function runClaude(prompt, { timeoutMs, authMode }) {
  const args = ["-p", "--output-format", "json", "--permission-mode", "bypassPermissions"];
  // Prefer stdin to avoid Windows command length limits.

  const attemptClaude = async () => {
    for (const attempt of [1, 2]) {
      const env = providerEnvForAttempt("claude", authMode, attempt);
      const res = await runCommand("claude", args, prompt, { timeoutMs, env });
      if (res.ok) return { provider: "claude", ...res };
      if (attempt === 1 && looksLikeAuthFailure(res.stderr)) continue;

      // If not successful and not an auth failure, throw to trigger retry
      if (!res.ok) {
        const error = new Error(res.stderr || "Claude CLI failed");
        error.code = res.stderr?.includes("TIMEOUT") ? "ETIMEDOUT" : "UNKNOWN";
        error.stderr = res.stderr;
        throw error;
      }

      return { provider: "claude", ...res };
    }
    return { provider: "claude", ok: false, stdout: "", stderr: "Unknown error" };
  };

  try {
    return await withRetry(attemptClaude, {
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 10000,
      onRetry: (attempt, error, delay) => {
        // Sanitize error messages to prevent API key leakage
        console.error(`⚠️  Claude CLI attempt ${attempt} failed: ${sanitize(error.message)}`);
        console.error(`   Retrying in ${delay}ms...`);
      }
    });
  } catch (error) {
    // Return error result instead of throwing
    // Sanitize all error output to prevent credential exposure
    return {
      provider: "claude",
      ok: false,
      stdout: "",
      stderr: sanitize(error.stderr || error.message || String(error))
    };
  }
}

async function runGemini(prompt, { timeoutMs, authMode }) {
  // gemini can read stdin for large payloads; keep the positional prompt short.
  const args = ["--output-format", "json", "--model", "gemini-2.5-flash", "Review this diff and return ONLY valid JSON per the provided schema."];
  const input = prompt;

  const attemptGemini = async () => {
    for (const attempt of [1, 2]) {
      const env = providerEnvForAttempt("gemini", authMode, attempt);
      const res = await runCommand("gemini", args, input, { timeoutMs, env });
      if (res.ok) return { provider: "gemini", ...res };
      if (attempt === 1 && looksLikeAuthFailure(res.stderr)) continue;

      // If not successful and not an auth failure, throw to trigger retry
      if (!res.ok) {
        const error = new Error(res.stderr || "Gemini CLI failed");
        error.code = res.stderr?.includes("TIMEOUT") ? "ETIMEDOUT" : "UNKNOWN";
        error.stderr = res.stderr;
        throw error;
      }

      return { provider: "gemini", ...res };
    }
    return { provider: "gemini", ok: false, stdout: "", stderr: "Unknown error" };
  };

  try {
    return await withRetry(attemptGemini, {
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 10000,
      onRetry: (attempt, error, delay) => {
        // Sanitize error messages to prevent API key leakage
        console.error(`⚠️  Gemini CLI attempt ${attempt} failed: ${sanitize(error.message)}`);
        console.error(`   Retrying in ${delay}ms...`);
      }
    });
  } catch (error) {
    // Return error result instead of throwing
    // Sanitize all error output to prevent credential exposure
    return {
      provider: "gemini",
      ok: false,
      stdout: "",
      stderr: sanitize(error.stderr || error.message || String(error))
    };
  }
}

async function runCopilot(prompt, { timeoutMs }) {
  // Copilot CLI flags vary by installation; keep it minimal.
  const args = ["-p", "--silent", prompt];
  const res = await runCommand("copilot", args, null, { timeoutMs });
  return { provider: "copilot", ...res };
}

function tryParseJson(text) {
  try {
    return JSON.parse(String(text));
  } catch {
    return null;
  }
}

function extractModelJson(provider, stdout) {
  const wrapper = tryParseJson(stdout);

  // If CLI returns wrapper JSON, attempt to extract the textual response field.
  const candidateText =
    (wrapper && typeof wrapper === "object" && (
      wrapper.result ||
      wrapper.response ||
      wrapper.output ||
      wrapper.message ||
      wrapper.text
    )) ||
    stdout;

  const inner = tryParseJson(candidateText);
  if (inner) return { wrapper, parsed: inner };
  return { wrapper, parsed: null };
}

function toMarkdownReport({ synthesized, perProvider }) {
  const s = synthesized?.parsed || synthesized?.rawParsed || null;
  const lines = [];
  lines.push("## AI Code Review");
  lines.push("");
  if (!s) {
    lines.push("- Synthesis unavailable; see per-provider outputs.");
    return lines.join("\n");
  }

  lines.push(`**Overall risk:** ${s.overall_risk || "unknown"}`);
  lines.push("");
  lines.push(s.summary || "");
  lines.push("");

  if (Array.isArray(s.findings) && s.findings.length) {
    lines.push("### Findings");
    for (const f of s.findings.slice(0, 20)) {
      const where = f.file ? ` (\`${f.file}\`)` : "";
      lines.push(`- [${f.severity || "?"}/${f.area || "?"}] ${f.issue}${where} — ${f.recommendation}`);
    }
    if (s.findings.length > 20) lines.push(`- …and ${s.findings.length - 20} more`);
    lines.push("");
  }

  if (Array.isArray(s.tests_to_add) && s.tests_to_add.length) {
    lines.push("### Tests to add");
    for (const t of s.tests_to_add.slice(0, 10)) lines.push(`- ${t}`);
    lines.push("");
  }

  if (Array.isArray(s.questions) && s.questions.length) {
    lines.push("### Questions");
    for (const q of s.questions.slice(0, 10)) lines.push(`- ${q}`);
    lines.push("");
  }

  lines.push("### Providers");
  lines.push(`- ${perProvider.map((p) => `${p.provider}:${p.ok ? "ok" : "error"}`).join(", ")}`);
  return lines.join("\n");
}

function toStrictJsonReport({ diffMeta, perProvider, synthesisDisabledReason, performance }) {
  const minimal = perProvider.map((p) => ({
    provider: p.provider,
    ok: p.ok,
    parsedOk: !!p.parsed,
    code: p.code,
    stderr: p.stderr ? String(p.stderr).trim().slice(0, 4000) : "",
    review: p.parsed || null,
  }));

  const ok = minimal.every((p) => p.ok && p.parsedOk);

  return {
    ok,
    mode: "strict-json-only",
    synthesis: synthesisDisabledReason || "skipped_in_strict_mode",
    diffMeta,
    providers: minimal.map((p) => ({ provider: p.provider, ok: p.ok, parsedOk: p.parsedOk })),
    perProvider: minimal,
    // Include performance metrics in CI/strict mode output
    performance: performance || null,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) usage(0);

  if (args.ci) {
    args.synthesize = false;
    args.output = "json";
    args.strictJsonOnly = true;
  }

  const providers = String(args.providers)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!providers.length) usage(1);

  const repoName = path.basename(process.cwd());

  let diffText = "";
  if (args.diffFile) {
    diffText = fs.readFileSync(path.resolve(process.cwd(), args.diffFile), "utf8");
  } else {
    diffText = await getGitDiff({ staged: args.staged, range: args.range });
  }

  const status = await getGitStatus();
  const diffMeta = {
    bytes: Buffer.byteLength(diffText, "utf8"),
    sha256: crypto.createHash("sha256").update(diffText).digest("hex").slice(0, 16),
    staged: !!args.staged,
    range: args.range || null,
  };

  const { sampled: diffSampled, omitted, strategy } = sampleDiff(diffText, args.maxDiffChars);
  diffMeta.truncated = omitted > 0;
  diffMeta.truncation = omitted > 0 ? { omittedChars: omitted, strategy } : null;

  const prompt = buildReviewPrompt({ repoName, status, diffSampled, diffMeta });

  if (args.dryRun) {
    const payload = { providers, diffMeta, note: "dry-run: no provider calls" };
    console.log(JSON.stringify(payload, null, 2));
    process.exit(0);
  }

  // CLI Availability Re-validation (Cursor Recommendation #1)
  // Re-validate CLI availability immediately before invoking providers
  // This prevents cryptic failures when CLIs become unavailable during execution
  let availableProviders = providers;
  let cliValidation = null;

  if (!args.skipCliValidation) {
    console.error("[cli-check] Validating provider CLI availability...");
    const cliCheckStart = Date.now();
    const providerChecks = await Promise.all(
      providers.map((p) => validateProviderCli(p))
    );
    const cliCheckDurationMs = Date.now() - cliCheckStart;

    cliValidation = {
      checks: providerChecks,
      durationMs: cliCheckDurationMs,
      timestamp: new Date().toISOString()
    };

    const unavailable = providerChecks.filter((c) => !c.available);
    const available = providerChecks.filter((c) => c.available);

    // Log CLI validation results
    for (const check of providerChecks) {
      if (check.available) {
        console.error(`[cli-check] ${check.provider}: available (${check.version || "version unknown"})`);
      } else {
        console.error(`[cli-check] ${check.provider}: unavailable (${check.error})`);
      }
    }

    // Provider Fallback Logic (Cursor Recommendation #4)
    // If all providers are unavailable, fail early with clear error
    if (unavailable.length === providers.length) {
      const errorMsg = `All providers unavailable: ${unavailable.map((c) => c.provider).join(", ")}`;
      console.error(`[cli-check] FATAL: ${errorMsg}`);

      if (args.strictJsonOnly || args.ci) {
        console.log(JSON.stringify({
          ok: false,
          mode: "strict-json-only",
          error: errorMsg,
          cliValidation
        }, null, 2));
        process.exit(2);
      }
      throw new Error(errorMsg);
    }

    // Filter to only available providers for execution
    if (unavailable.length > 0) {
      availableProviders = available.map((c) => c.provider);
      console.error(`[cli-check] Proceeding with available providers: ${availableProviders.join(", ")}`);

      // Load config for fallback threshold
      const providerConfig = loadProviderConfig();
      if (availableProviders.length < providerConfig.fallback_threshold) {
        const errorMsg = `Insufficient providers available (${availableProviders.length} < ${providerConfig.fallback_threshold})`;
        console.error(`[cli-check] FATAL: ${errorMsg}`);

        if (args.strictJsonOnly || args.ci) {
          console.log(JSON.stringify({
            ok: false,
            mode: "strict-json-only",
            error: errorMsg,
            cliValidation
          }, null, 2));
          process.exit(2);
        }
        throw new Error(errorMsg);
      }
    }

    console.error(`[cli-check] CLI validation completed in ${cliCheckDurationMs}ms`);
  }

  // Load configurations (Cursor Recommendations #11, #14)
  const partialFailureConfig = loadPartialFailureConfig();
  const circuitBreakerConfig = loadCircuitBreakerConfig();

  // Performance measurement: start timing
  const providerStartTime = Date.now();

  // Circuit Breaker Check (Cursor Recommendation #14)
  // Skip providers with open circuit breakers
  const circuitBreakerResults = [];
  const providersToExecute = [];

  if (circuitBreakerConfig.enabled) {
    for (const p of availableProviders) {
      if (providerCircuitBreaker.canExecute(p)) {
        providersToExecute.push(p);
      } else {
        const cbState = providerCircuitBreaker.getState(p);
        console.warn(`[circuit-breaker] Skipping ${p}: circuit OPEN (reset at ${new Date(cbState.openUntil).toISOString()})`);
        circuitBreakerResults.push({
          provider: p,
          ok: false,
          skipped: true,
          reason: "circuit_breaker_open",
          circuit_state: cbState.state,
          open_until: cbState.openUntil
        });
      }
    }
  } else {
    providersToExecute.push(...availableProviders);
  }

  // Parallel execution of provider calls using Promise.allSettled()
  // This reduces total time from sum(provider_times) to max(provider_times)
  // Each provider still has independent retry logic (up to 3 attempts)
  const providerPromises = providersToExecute.map((p) => {
    const executeProvider = async () => {
      let result;
      if (p === "claude") result = await runClaude(prompt, args);
      else if (p === "gemini") result = await runGemini(prompt, args);
      else if (p === "copilot") result = await runCopilot(prompt, args);
      else result = { provider: p, ok: false, stdout: "", stderr: `Unknown provider: ${p}` };

      // Record success/failure in circuit breaker (Cursor Recommendation #14)
      if (circuitBreakerConfig.enabled) {
        if (result.ok) {
          providerCircuitBreaker.recordSuccess(p);
        } else {
          providerCircuitBreaker.recordFailure(p);
          // Log error with context (Cursor Recommendation #10)
          logErrorWithContext(new Error(result.stderr || "Provider failed"), {
            provider: p,
            diffMeta,
            authMode: args.authMode
          });
        }
      }

      return result;
    };

    return executeProvider();
  });

  // Promise.allSettled() ensures ALL providers complete, even if some fail
  // This is preferred over Promise.all() which would reject on first failure
  const providerResults = await Promise.allSettled(providerPromises);

  // Map results to consistent format, handling both fulfilled and rejected promises
  const executedProviders = providerResults.map((result, index) => {
    if (result.status === "fulfilled") {
      return result.value;
    }
    // Rejected promise - provider threw an unexpected error
    const error = result.reason;
    const provider = providersToExecute[index];

    // Log error with context (Cursor Recommendation #10)
    logErrorWithContext(error, {
      provider,
      diffMeta,
      authMode: args.authMode
    });

    // Record failure in circuit breaker
    if (circuitBreakerConfig.enabled) {
      providerCircuitBreaker.recordFailure(provider);
    }

    return {
      provider,
      ok: false,
      stdout: "",
      stderr: error?.message || error?.stderr || String(error),
      code: error?.code || "REJECTED",
    };
  });

  // Combine circuit breaker skipped results with executed results
  const perProvider = [...circuitBreakerResults, ...executedProviders];

  // Performance measurement: end timing
  const providerEndTime = Date.now();
  const providerDurationMs = providerEndTime - providerStartTime;
  const successCount = perProvider.filter((p) => p.ok).length;
  const skippedCount = perProvider.filter((p) => p.skipped).length;

  // Partial Failure Recovery (Cursor Recommendation #11)
  // Determine if we have enough successful providers
  let partialFailureStatus = null;
  if (partialFailureConfig.enabled) {
    const executedCount = perProvider.length - skippedCount;
    const successRate = executedCount > 0 ? successCount / executedCount : 0;
    const meetsCount = successCount >= partialFailureConfig.min_success_count;
    const meetsRate = successRate >= partialFailureConfig.min_success_rate;

    partialFailureStatus = {
      enabled: true,
      success_count: successCount,
      executed_count: executedCount,
      success_rate: successRate,
      meets_count_threshold: meetsCount,
      meets_rate_threshold: meetsRate,
      partial_success: !meetsCount && !meetsRate ? false : (skippedCount > 0 || successCount < executedCount)
    };

    if (!meetsCount && !meetsRate && successCount > 0) {
      console.warn(
        `[partial-failure] Insufficient providers succeeded: ${successCount}/${executedCount} ` +
        `(need ${partialFailureConfig.min_success_count} or ${(partialFailureConfig.min_success_rate * 100).toFixed(0)}%)`
      );
    } else if (partialFailureStatus.partial_success) {
      console.error(
        `[partial-failure] Proceeding with partial success: ${successCount}/${executedCount} providers`
      );
    }
  }

  // Log performance metrics (useful for debugging and optimization tracking)
  console.error(
    `[perf] ${availableProviders.length} providers completed in ${providerDurationMs}ms (parallel execution, ${successCount}/${availableProviders.length} succeeded)`
  );

  const parsed = perProvider.map((r) => {
    const extracted = extractModelJson(r.provider, r.stdout);
    return {
      provider: r.provider,
      ok: !!r.ok,
      code: r.code,
      stderr: r.stderr,
      wrapper: extracted.wrapper,
      parsed: extracted.parsed,
      stdout: r.stdout,
    };
  });

  if (args.strictJsonOnly) {
    const report = toStrictJsonReport({
      diffMeta,
      perProvider: parsed,
      synthesisDisabledReason: "skipped_in_strict_mode",
      performance: {
        providerDurationMs,
        synthesisDurationMs: 0,
        totalDurationMs: providerDurationMs,
        providersCount: availableProviders.length,
        requestedProviders: providers.length,
        successCount,
        skippedCount,
        parallelExecution: true,
        cliValidation: cliValidation || null,
        // Cursor Recommendation #11 - Partial Failure Recovery
        partialFailure: partialFailureStatus,
        // Cursor Recommendation #14 - Circuit Breaker Status
        circuitBreaker: circuitBreakerConfig.enabled ? {
          enabled: true,
          skipped_providers: circuitBreakerResults.length,
          providers_state: Object.fromEntries(
            availableProviders.map(p => [p, providerCircuitBreaker.getState(p)])
          )
        } : null,
      },
    });
    // Validate output before returning (use blocking mode in CI)
    const validatedReport = validateOutput(report, args.validationMode);
    console.log(JSON.stringify(validatedReport, null, 2));
    process.exit(validatedReport.ok ? 0 : 2);
  }

  let synthesized = null;
  let synthesisDurationMs = 0;
  if (args.synthesize) {
    const synthesisStartTime = Date.now();
    // Use first available provider for synthesis if synthesizeWith is not specified
    const synthProvider = args.synthesizeWith || availableProviders[0];
    const synthPrompt = [
      "You are synthesizing multiple independent AI code review JSON outputs into a single deduped report.",
      "Prefer the safest interpretation when there is disagreement; keep usability in mind for low/medium issues.",
      "Output ONLY valid JSON using the same schema as the individual reviews.",
      "",
      "INPUT REVIEWS (JSON):",
      '"""',
      JSON.stringify(parsed.map((p) => ({ provider: p.provider, ok: p.ok, review: p.parsed })), null, 2),
      '"""',
    ].join("\n");

    if (synthProvider === "claude") synthesized = await runClaude(synthPrompt, args);
    else if (synthProvider === "gemini") synthesized = await runGemini(synthPrompt, args);
    else if (synthProvider === "copilot") synthesized = await runCopilot(synthPrompt, args);

    synthesisDurationMs = Date.now() - synthesisStartTime;
    console.error(`[perf] Synthesis completed in ${synthesisDurationMs}ms`);
  }

  // Calculate total execution time
  const totalDurationMs = providerDurationMs + synthesisDurationMs;
  console.error(`[perf] Total multi-AI review: ${totalDurationMs}ms`);

  const synthesizedExtracted = synthesized
    ? extractModelJson("synthesis", synthesized.stdout)
    : null;

  if (String(args.output).toLowerCase() === "markdown") {
    const report = toMarkdownReport({
      synthesized: synthesizedExtracted
        ? { ...synthesizedExtracted, ok: synthesized.ok, stderr: synthesized.stderr }
        : null,
      perProvider: parsed,
    });
    console.log(report);
    return;
  }

  const finalOutput = {
    diffMeta,
    providers: parsed.map((p) => ({ provider: p.provider, ok: p.ok })),
    perProvider: parsed,
    synthesis: synthesized
      ? {
          provider: args.synthesizeWith || availableProviders[0],
          ok: synthesized.ok,
          stderr: synthesized.stderr,
          ...synthesizedExtracted,
        }
      : null,
    // Performance metrics for tracking and optimization
    performance: {
      providerDurationMs,
      synthesisDurationMs,
      totalDurationMs,
      providersCount: availableProviders.length,
      requestedProviders: providers.length,
      successCount,
      skippedCount,
      parallelExecution: true,
      // Estimated sequential time (for comparison)
      estimatedSequentialMs: providerDurationMs * availableProviders.length,
      // Estimated time saved through parallelization
      estimatedTimeSavedMs: Math.max(0, (providerDurationMs * availableProviders.length) - providerDurationMs),
      // CLI validation info (Cursor Recommendation #1)
      cliValidation: cliValidation || null,
      // Cursor Recommendation #11 - Partial Failure Recovery
      partialFailure: partialFailureStatus,
      // Cursor Recommendation #14 - Circuit Breaker Status
      circuitBreaker: circuitBreakerConfig.enabled ? {
        enabled: true,
        skipped_providers: circuitBreakerResults.length,
        providers_state: Object.fromEntries(
          availableProviders.map(p => [p, providerCircuitBreaker.getState(p)])
        )
      } : null,
    },
  };

  // Validate output before returning (Cursor Recommendation #3: support blocking mode)
  const validatedOutput = validateOutput(finalOutput, args.validationMode);
  console.log(JSON.stringify(validatedOutput, null, 2));
}

main().catch((e) => {
  // Best-effort JSON-only failure if --ci/--strict-json-only was requested.
  const argv = process.argv.slice(2);
  const strict = argv.includes("--ci") || argv.includes("--strict-json-only");
  if (strict) {
    // Sanitize error output to prevent credential exposure in CI logs
    console.log(
      JSON.stringify(
        {
          ok: false,
          mode: "strict-json-only",
          error: sanitize(e && e.message ? e.message : String(e)),
        },
        null,
        2,
      ),
    );
    process.exit(2);
  }
  // Sanitize stack traces to prevent credential exposure
  console.error(sanitize(e && e.stack ? e.stack : String(e)));
  process.exit(1);
});
