#!/usr/bin/env node
/* eslint-disable no-console */

const { spawn } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { sanitize, sanitizeError } = require("../../shared/sanitize-secrets.js");

function parseArgs(argv) {
  const args = {
    providers: "claude,gemini",
    model: "gemini-2.5-flash",
    authMode: "session-first",
    template: "response-review",
    timeoutMs: 180000,
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--response-file") args.responseFile = argv[++i];
    else if (token === "--question-file") args.questionFile = argv[++i];
    else if (token === "--providers") {
      const parts = [];
      while (i + 1 < argv.length && !String(argv[i + 1]).startsWith("--")) {
        parts.push(argv[++i]);
      }
      args.providers = parts.join(",");
    }
    else if (token === "--gemini-model") args.model = argv[++i];
    else if (token === "--auth-mode") args.authMode = argv[++i];
    else if (token === "--template") args.template = argv[++i];
    else if (token === "--timeout-ms") args.timeoutMs = Number(argv[++i]);
    else if (token === "--dry-run") args.dryRun = true;
    else if (token === "--help" || token === "-h") args.help = true;
  }
  return args;
}

function usage(exitCode = 0) {
  console.log(
    [
      "Usage:",
      "  node codex-skills/response-rater/scripts/rate.js --response-file <path> [--question-file <path>] [--providers claude,gemini] [--gemini-model gemini-2.5-flash]",
      "  cat response.txt | node codex-skills/response-rater/scripts/rate.js [--question-file <path>] [--providers claude,gemini]",
      "",
      "Templates:",
      "  --template response-review   # default; critique an assistant response using a rubric",
      "  --template vocab-review      # review a vocabulary.json for robustness/security (Privacy Airlock stage 1)",
      "  --template vocab-review-sampled # vocab-review but with local sampling/statistics for very large vocabularies",
      "",
      "Timeouts:",
      "  --timeout-ms 180000          # default 180s for each provider call",
      "  --dry-run                   # print computed settings and exit (no network calls)",
      "",
      "Auth:",
      "  --auth-mode session-first   # default; try CLI session auth first, then env keys",
      "  --auth-mode env-first       # try env keys first, then CLI session auth",
      "",
      "Env:",
      "  ANTHROPIC_API_KEY (for claude)",
      "  GEMINI_API_KEY or GOOGLE_API_KEY (for gemini)",
    ].join("\n"),
  );
  process.exit(exitCode);
}

function readFileOrNull(filePath) {
  if (!filePath) return null;
  const resolved = path.resolve(process.cwd(), filePath);
  return fs.readFileSync(resolved, "utf8");
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

function buildResponseReviewPrompt({ question, response }) {
  const questionBlock = question
    ? `\nQUESTION/REQUEST:\n\"\"\"\n${question.trim()}\n\"\"\"\n`
    : "";

  return [
    "You are an independent reviewer.",
    "",
    "Evaluate the ASSISTANT RESPONSE below against this rubric.",
    "Return JSON with keys: scores, summary, improvements, rewrite.",
    "",
    "scores: 1-10 integers for: correctness, completeness, clarity, actionability, risk_management, constraint_alignment, brevity.",
    "summary: 2-5 sentences.",
    "improvements: 5-12 concrete bullets (strings).",
    "rewrite: a rewritten improved response, <= 10 lines, preserving the original intent.",
    questionBlock.trimEnd(),
    "ASSISTANT RESPONSE:",
    '"""',
    response.trim(),
    '"""',
    "",
    "Output ONLY valid JSON.",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildVocabReviewPrompt({ response }) {
  return [
    "You are a senior application security engineer reviewing a Stage-1 vocabulary allowlist for an LLM Privacy Airlock.",
    "",
    "Context:",
    "- Stage 1 is a coarse allowlist gate to reduce prompt-injection / unsafe payload surface.",
    "- Stage 2 is content moderation and Stage 3 is PII redaction; Stage 1 is NOT the only privacy control.",
    "- The implementation normalizes tokens to lowercase and strips the SentencePiece word-boundary prefix '▁' (U+2581) before lookup.",
    "",
    "Input is a JSON file containing a vocabulary list used to decide whether user content should be blocked or allowed.",
    "Assume tokenization may be SentencePiece (preferred) or a fallback word tokenizer that preserves apostrophes in contractions (e.g., \"don't\").",
    "",
    "Return ONLY valid JSON with keys:",
    "- summary: 2-5 sentences",
    "- major_risks: array of strings (5-12 items)",
    "- recommended_changes: array of strings (8-20 items, actionable)",
    "- remove_tokens: array of strings (tokens that should not be present, e.g. section markers/placeholders)",
    "- add_token_sets: object mapping set_name -> array of strings (each array <= 40 tokens; focus on high-coverage safe tokens)",
    "- normalization_notes: array of strings (casing, punctuation, SentencePiece '▁', duplicates, etc.)",
    "",
    "VOCABULARY JSON:",
    '"""',
    response.trim(),
    '"""',
  ].join("\n");
}

function tryParseVocabularyJson(rawText) {
  try {
    const parsed = JSON.parse(String(rawText || ""));
    const tokens = Array.isArray(parsed?.tokens)
      ? parsed.tokens
      : Array.isArray(parsed?.vocabulary)
        ? parsed.vocabulary
        : null;
    return tokens ? { meta: parsed, tokens } : null;
  } catch {
    return null;
  }
}

function seededSampleIndices(length, sampleCount, seed) {
  if (!Number.isFinite(length) || length <= 0) return [];
  const target = Math.max(0, Math.min(sampleCount, length));
  if (target === 0) return [];

  // Park–Miller LCG for deterministic sampling
  let state = (seed % 2147483647) || 1;
  const out = new Set();
  while (out.size < target) {
    state = (state * 48271) % 2147483647;
    out.add(state % length);
  }
  return Array.from(out).sort((a, b) => a - b);
}

function buildVocabReviewPromptSampled({ response }) {
  const parsed = tryParseVocabularyJson(response);
  if (!parsed) return buildVocabReviewPrompt({ response });

  const { meta, tokens } = parsed;
  const tokenStrings = tokens.map((t) => String(t));
  const uniqueCount = new Set(tokenStrings).size;
  const nonAscii = tokenStrings.filter((t) => /[^\x00-\x7F]/.test(t));
  const longest = tokenStrings
    .map((t) => ({ t, len: t.length }))
    .sort((a, b) => b.len - a.len)
    .slice(0, 25)
    .map((x) => x.t);

  const seed = parseInt(
    crypto.createHash("sha256").update(String(meta?.version || "") + String(tokens.length)).digest("hex").slice(0, 8),
    16,
  );

  const head = tokenStrings.slice(0, 250);
  const tail = tokenStrings.slice(-250);
  const sampleIdx = seededSampleIndices(tokenStrings.length, 750, seed);
  const sample = sampleIdx.map((i) => tokenStrings[i]);

  const payload = {
    metadata: {
      version: meta?.version,
      updated: meta?.updated,
      source: meta?.source,
      tokenCount: tokenStrings.length,
      uniqueCount,
      nonAsciiCount: nonAscii.length,
      build: meta?.build || null,
    },
    samples: {
      head,
      tail,
      seededSample: sample,
      longestTokens: longest,
      nonAsciiTokens: nonAscii.slice(0, 200),
    },
  };

  return [
    "You are a senior application security engineer reviewing a Stage-1 vocabulary allowlist for an LLM Privacy Airlock.",
    "",
    "Context:",
    "- Stage 1 is a coarse allowlist gate to reduce unsafe payload surface.",
    "- Stage 2 is content moderation and Stage 3 is PII redaction; Stage 1 is NOT the only privacy control.",
    "- The implementation normalizes tokens to lowercase and strips the SentencePiece word-boundary prefix '▁' (U+2581) before lookup.",
    "",
    "The full vocabulary is too large to include inline; you are given metadata and representative samples.",
    "",
    "Return ONLY valid JSON with keys:",
    "- summary: 2-5 sentences",
    "- major_risks: array of strings (5-12 items)",
    "- recommended_changes: array of strings (8-20 items, actionable)",
    "- remove_tokens: array of strings (tokens that should not be present)",
    "- add_token_sets: object mapping set_name -> array of strings (each array <= 40 tokens; focus on high-coverage safe tokens)",
    "- normalization_notes: array of strings",
    "",
    "VOCABULARY SUMMARY + SAMPLES (JSON):",
    '"""',
    JSON.stringify(payload, null, 2),
    '"""',
  ].join("\n");
}

function buildPrompt({ template, question, response }) {
  const t = String(template || "response-review").toLowerCase();
  if (t === "vocab-review") {
    // Large vocabularies can exceed provider limits; automatically sample when needed.
    if (response.length > 200000) return buildVocabReviewPromptSampled({ response });
    return buildVocabReviewPrompt({ response });
  }
  if (t === "vocab-review-sampled") return buildVocabReviewPromptSampled({ response });
  return buildResponseReviewPrompt({ question, response });
}

function runCommand(command, args, input, { timeoutMs = 60000, env } = {}) {
  return new Promise((resolve) => {
    const resolvedEnv = env || process.env;
    if (process.platform === "win32") {
      const child = spawn(command, args, {
        stdio: ["pipe", "pipe", "pipe"],
        env: resolvedEnv,
        shell: true, // enables running .cmd shims (npm global bins) reliably
      });

      let stdout = "";
      let stderr = "";
      const timeoutId = setTimeout(() => {
        child.kill();
        resolve({ ok: false, stdout, stderr: `${stderr}\nTIMEOUT` });
      }, timeoutMs);

      child.stdout.on("data", (d) => (stdout += d.toString()));
      child.stderr.on("data", (d) => (stderr += d.toString()));
      child.on("close", (code) => {
        clearTimeout(timeoutId);
        resolve({ ok: code === 0, code, stdout, stderr });
      });

      child.on("error", (err) => {
        clearTimeout(timeoutId);
        resolve({
          ok: false,
          code: null,
          stdout,
          stderr: `${stderr}\n${err?.message || String(err)}`,
        });
      });

      child.stdin.write(input);
      child.stdin.end();

      return;
    }

    const candidates = !path.extname(command)
      ? [command, `${command}.cmd`, `${command}.exe`]
      : [command];

    const trySpawn = (idx) => {
      const cmd = candidates[idx];
      const child = spawn(cmd, args, {
        stdio: ["pipe", "pipe", "pipe"],
        env: resolvedEnv,
      });

      let stdout = "";
      let stderr = "";
      const timeoutId = setTimeout(() => {
        child.kill();
        resolve({ ok: false, stdout, stderr: `${stderr}\nTIMEOUT` });
      }, timeoutMs);

      child.stdout.on("data", (d) => (stdout += d.toString()));
      child.stderr.on("data", (d) => (stderr += d.toString()));
      child.on("close", (code) => {
        clearTimeout(timeoutId);
        resolve({ ok: code === 0, code, stdout, stderr });
      });

      child.on("error", (err) => {
        clearTimeout(timeoutId);
        if (err?.code === "ENOENT" && idx + 1 < candidates.length) {
          trySpawn(idx + 1);
          return;
        }
        resolve({
          ok: false,
          code: null,
          stdout,
          stderr: `${stderr}\n${err?.message || String(err)}`,
        });
      });

      child.stdin.write(input);
      child.stdin.end();
    };

    trySpawn(0);
  });
}

function tryParseJson(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;

  const candidates = [];

  // 1) Direct JSON
  candidates.push(raw);

  // 2) Strip fenced code blocks ```json ... ```
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch?.[1]) candidates.push(fenceMatch[1].trim());

  // 3) Heuristic: extract first {...} block
  const firstObj = raw.indexOf("{");
  const lastObj = raw.lastIndexOf("}");
  if (firstObj !== -1 && lastObj !== -1 && lastObj > firstObj) {
    candidates.push(raw.slice(firstObj, lastObj + 1));
  }

  // 4) Heuristic: extract first [...] block
  const firstArr = raw.indexOf("[");
  const lastArr = raw.lastIndexOf("]");
  if (firstArr !== -1 && lastArr !== -1 && lastArr > firstArr) {
    candidates.push(raw.slice(firstArr, lastArr + 1));
  }

  for (const c of candidates) {
    try {
      return JSON.parse(c);
    } catch {
      // continue
    }
  }
  return null;
}

function redactNewlines(text, maxLen = 1200) {
  // Sanitize to remove potential API keys before processing
  const sanitized = sanitize(String(text || ""));
  const t = sanitized.replace(/\r?\n/g, "\\n");
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen)}…`;
}

function truncate(text, maxLen = 8000) {
  // Sanitize to remove potential API keys before truncation
  const t = sanitize(String(text || ""));
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen)}…`;
}

function summarizeRaw(raw) {
  return {
    ok: raw.ok,
    code: raw.code,
    stdout: truncate(raw.stdout, 2000),
    stderr: truncate(raw.stderr, 1200),
  };
}

function compactValue(value, { maxArray = 30, maxString = 1600 } = {}) {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return truncate(value, maxString);
  if (Array.isArray(value)) {
    if (value.length <= maxArray) return value.map((v) => compactValue(v));
    return [
      ...value.slice(0, maxArray).map((v) => compactValue(v)),
      `…truncated ${value.length - maxArray} items…`,
    ];
  }
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = compactValue(v);
    }
    return out;
  }
  return value;
}

function withoutEnvKeys(keys) {
  const next = { ...process.env };
  for (const key of keys) {
    delete next[key];
  }
  return next;
}

function providerAttemptOrder(authMode) {
  const mode = String(authMode || "session-first").toLowerCase();
  if (mode === "env-first") return ["env", "session"];
  return ["session", "env"];
}

async function runClaude(prompt, { authMode, timeoutMs }) {
  const attempts = [];
  const order = providerAttemptOrder(authMode);
  const hasEnvKey = !!process.env.ANTHROPIC_API_KEY;

  for (const mode of order) {
    if (mode === "env" && !hasEnvKey) {
      attempts.push({
        mode,
        skipped: true,
        reason: "ANTHROPIC_API_KEY is not set",
      });
      continue;
    }

    const env =
      mode === "session" ? withoutEnvKeys(["ANTHROPIC_API_KEY"]) : process.env;

    const raw = await runCommand(
      "claude",
      ["-p", "--output-format", "json", "--permission-mode", "bypassPermissions"],
      prompt,
      { timeoutMs, env },
    );

    attempts.push({
      mode,
      ok: raw.ok,
      code: raw.code,
      stderr: redactNewlines(raw.stderr),
    });

    if (raw.ok) {
      const outer = tryParseJson(raw.stdout);
      const inner = outer?.result ? tryParseJson(outer.result) : null;
      return {
        ok: true,
        authUsed: mode,
        raw: summarizeRaw(raw),
        parsed: inner ? compactValue(inner) : null,
        attempts,
      };
    }
  }

  return {
    ok: false,
    error: "claude failed",
    attempts,
    hint:
      "If you rely on a logged-in Claude Code session, run `claude` interactively once to authenticate. If you rely on env auth, set ANTHROPIC_API_KEY.",
  };
}

async function runGemini(prompt, model, { authMode, timeoutMs }) {
  const attempts = [];
  const order = providerAttemptOrder(authMode);
  const hasEnvKey = !!process.env.GEMINI_API_KEY || !!process.env.GOOGLE_API_KEY;

  for (const mode of order) {
    if (mode === "env" && !hasEnvKey) {
      attempts.push({
        mode,
        skipped: true,
        reason: "GEMINI_API_KEY/GOOGLE_API_KEY is not set",
      });
      continue;
    }

    const env =
      mode === "session"
        ? withoutEnvKeys(["GEMINI_API_KEY", "GOOGLE_API_KEY"])
        : process.env;

    const raw = await runCommand(
      "gemini",
      ["--output-format", "json", "--model", model],
      prompt,
      { timeoutMs, env },
    );

    attempts.push({
      mode,
      ok: raw.ok,
      code: raw.code,
      stderr: redactNewlines(raw.stderr),
    });

    if (raw.ok) {
      const outer = tryParseJson(raw.stdout);
      const inner = outer?.response ? tryParseJson(outer.response) : null;
      return {
        ok: true,
        authUsed: mode,
        raw: summarizeRaw(raw),
        parsed: inner ? compactValue(inner) : null,
        attempts,
      };
    }
  }

  return {
    ok: false,
    error: "gemini failed",
    attempts,
    hint:
      "If you rely on a logged-in Gemini CLI session, run `gemini` interactively once to authenticate. If you rely on env auth, set GEMINI_API_KEY or GOOGLE_API_KEY.",
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) usage(0);

  const response = args.responseFile
    ? readFileOrNull(args.responseFile)
    : process.stdin.isTTY
      ? null
      : await readStdin();
  const question = readFileOrNull(args.questionFile);
  if (!response || !response.trim()) {
    if (!args.responseFile) usage(1);
    console.error("error: empty response");
    process.exit(2);
  }

  const providers = String(args.providers || "")
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);

  const prompt = buildPrompt({
    template: args.template,
    question,
    response,
  });

  if (args.dryRun) {
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          template: args.template,
          authMode: args.authMode,
          providers,
          geminiModel: args.model,
          timeoutMs: args.timeoutMs,
          responseChars: response.length,
          questionChars: question ? question.length : 0,
        },
        null,
        2,
      ),
    );
    return;
  }

  const results = {};
  for (const provider of providers) {
    if (provider === "claude") {
      results.claude = await runClaude(prompt, {
        authMode: args.authMode,
        timeoutMs: args.timeoutMs,
      });
    } else if (provider === "gemini") {
      results.gemini = await runGemini(prompt, args.model, {
        authMode: args.authMode,
        timeoutMs: args.timeoutMs,
      });
    } else {
      results[provider] = {
        skipped: true,
        reason: `unsupported provider '${provider}' (supported: claude, gemini)`,
      };
    }
  }

  console.log(
    JSON.stringify(
      {
        promptVersion: 3,
        template: args.template,
        authMode: args.authMode,
        providers: results,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  // Sanitize error output to prevent credential exposure
  console.error(`fatal: ${sanitize(e?.message || String(e))}`);
  process.exit(1);
});
