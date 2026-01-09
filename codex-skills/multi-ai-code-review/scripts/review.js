#!/usr/bin/env node
/* eslint-disable no-console */

const { spawn } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { withRetry } = require("../../shared/retry-utils.js");

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
        console.error(`⚠️  Claude CLI attempt ${attempt} failed: ${error.message}`);
        console.error(`   Retrying in ${delay}ms...`);
      }
    });
  } catch (error) {
    // Return error result instead of throwing
    return {
      provider: "claude",
      ok: false,
      stdout: "",
      stderr: error.stderr || error.message || String(error)
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
        console.error(`⚠️  Gemini CLI attempt ${attempt} failed: ${error.message}`);
        console.error(`   Retrying in ${delay}ms...`);
      }
    });
  } catch (error) {
    // Return error result instead of throwing
    return {
      provider: "gemini",
      ok: false,
      stdout: "",
      stderr: error.stderr || error.message || String(error)
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

  // Performance measurement: start timing
  const providerStartTime = Date.now();

  // Parallel execution of provider calls using Promise.allSettled()
  // This reduces total time from sum(provider_times) to max(provider_times)
  // Each provider still has independent retry logic (up to 3 attempts)
  const providerPromises = providers.map((p) => {
    if (p === "claude") return runClaude(prompt, args);
    if (p === "gemini") return runGemini(prompt, args);
    if (p === "copilot") return runCopilot(prompt, args);
    // Return resolved promise for unknown providers (handles gracefully)
    return Promise.resolve({ provider: p, ok: false, stdout: "", stderr: `Unknown provider: ${p}` });
  });

  // Promise.allSettled() ensures ALL providers complete, even if some fail
  // This is preferred over Promise.all() which would reject on first failure
  const providerResults = await Promise.allSettled(providerPromises);

  // Map results to consistent format, handling both fulfilled and rejected promises
  const perProvider = providerResults.map((result, index) => {
    if (result.status === "fulfilled") {
      return result.value;
    }
    // Rejected promise - provider threw an unexpected error
    return {
      provider: providers[index],
      ok: false,
      stdout: "",
      stderr: result.reason?.message || result.reason?.stderr || String(result.reason),
      code: result.reason?.code || "REJECTED",
    };
  });

  // Performance measurement: end timing
  const providerEndTime = Date.now();
  const providerDurationMs = providerEndTime - providerStartTime;
  const successCount = perProvider.filter((p) => p.ok).length;

  // Log performance metrics (useful for debugging and optimization tracking)
  console.error(
    `[perf] ${providers.length} providers completed in ${providerDurationMs}ms (parallel execution, ${successCount}/${providers.length} succeeded)`
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
        providersCount: providers.length,
        successCount,
        parallelExecution: true,
      },
    });
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.ok ? 0 : 2);
  }

  let synthesized = null;
  let synthesisDurationMs = 0;
  if (args.synthesize) {
    const synthesisStartTime = Date.now();
    const synthProvider = args.synthesizeWith || providers[0];
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

  console.log(
    JSON.stringify(
      {
        diffMeta,
        providers: parsed.map((p) => ({ provider: p.provider, ok: p.ok })),
        perProvider: parsed,
        synthesis: synthesized
          ? {
              provider: args.synthesizeWith || providers[0],
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
          providersCount: providers.length,
          successCount,
          parallelExecution: true,
          // Estimated sequential time (for comparison)
          estimatedSequentialMs: providerDurationMs * providers.length,
          // Estimated time saved through parallelization
          estimatedTimeSavedMs: Math.max(0, (providerDurationMs * providers.length) - providerDurationMs),
        },
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  // Best-effort JSON-only failure if --ci/--strict-json-only was requested.
  const argv = process.argv.slice(2);
  const strict = argv.includes("--ci") || argv.includes("--strict-json-only");
  if (strict) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          mode: "strict-json-only",
          error: e && e.message ? e.message : String(e),
        },
        null,
        2,
      ),
    );
    process.exit(2);
  }
  console.error(e && e.stack ? e.stack : String(e));
  process.exit(1);
});
