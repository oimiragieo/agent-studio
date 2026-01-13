#!/usr/bin/env node
/* eslint-disable no-console */

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

function parseArgs(argv) {
  const args = {
    providers: "claude,gemini",
    geminiModel: "gemini-3-pro-preview",
    codexModel: "gpt-5.1-codex-max",
    cursorModel: "auto",
    copilotModel: "claude-sonnet-4.5",
    authMode: "session-first",
    template: "response-review",
  };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--response-file") args.responseFile = argv[++i];
    else if (token === "--question-file") args.questionFile = argv[++i];
    else if (token === "--providers") args.providers = argv[++i];
    else if (token === "--gemini-model") args.geminiModel = argv[++i];
    else if (token === "--codex-model") args.codexModel = argv[++i];
    else if (token === "--cursor-model") args.cursorModel = argv[++i];
    else if (token === "--copilot-model") args.copilotModel = argv[++i];
    else if (token === "--auth-mode") args.authMode = argv[++i];
    else if (token === "--template") args.template = argv[++i];
    else if (token === "--help" || token === "-h") args.help = true;
  }
  return args;
}

function usage(exitCode = 0) {
  console.log(
    [
      "Usage:",
      "  node .claude/skills/response-rater/scripts/rate.cjs --response-file <path> [options]",
      "  cat response.txt | node .claude/skills/response-rater/scripts/rate.cjs [options]",
      "",
      "Options:",
      "  --response-file <path>   # file containing the response to review",
      "  --question-file <path>   # optional; original question/request for context",
      "  --providers <list>       # comma-separated: claude,gemini,codex,cursor,copilot (default: claude,gemini)",
      "",
      "Models:",
      "  --gemini-model <model>   # default: gemini-3-pro-preview",
      "  --codex-model <model>    # default: gpt-5.1-codex-max",
      "  --cursor-model <model>   # default: auto",
      "  --copilot-model <model>  # default: claude-sonnet-4.5",
      "",
      "Templates:",
      "  --template response-review   # default; critique an assistant response using a rubric",
      "  --template vocab-review      # review a vocabulary.json for robustness/security",
      "",
      "Auth:",
      "  --auth-mode session-first   # default; try CLI session auth first, then env keys",
      "  --auth-mode env-first       # try env keys first, then CLI session auth",
      "",
      "Environment Variables:",
      "  ANTHROPIC_API_KEY           # for Claude Code",
      "  GEMINI_API_KEY / GOOGLE_API_KEY  # for Gemini CLI",
      "  OPENAI_API_KEY / CODEX_API_KEY   # for OpenAI Codex CLI",
      "  CURSOR_API_KEY              # for Cursor Agent",
      "  (GitHub auth via `gh auth`)  # for GitHub Copilot CLI",
      "",
      "Examples:",
      "  node .claude/skills/response-rater/scripts/rate.cjs --response-file response.txt --providers claude,gemini,codex",
      "  cat response.txt | node .claude/skills/response-rater/scripts/rate.cjs --providers copilot --copilot-model gpt-5",
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
    "Input is a JSON file containing a vocabulary list used to decide whether user content should be blocked or allowed.",
    "Assume this vocabulary may be used with SentencePiece tokenization and/or a fallback word tokenizer.",
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

function buildPrompt({ template, question, response }) {
  const t = String(template || "response-review").toLowerCase();
  if (t === "vocab-review") return buildVocabReviewPrompt({ response });
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
  const t = String(text || "").replace(/\r?\n/g, "\\n");
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen)}…`;
}

function truncate(text, maxLen = 8000) {
  const t = String(text || "");
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

async function runClaude(prompt, { authMode }) {
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
      { timeoutMs: 120000, env },
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

async function runGemini(prompt, model, { authMode }) {
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
      { timeoutMs: 120000, env },
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

async function runCodex(prompt, model, { authMode }) {
  const attempts = [];
  const order = providerAttemptOrder(authMode);
  const hasEnvKey = !!process.env.OPENAI_API_KEY || !!process.env.CODEX_API_KEY;

  for (const mode of order) {
    if (mode === "env" && !hasEnvKey) {
      attempts.push({
        mode,
        skipped: true,
        reason: "OPENAI_API_KEY/CODEX_API_KEY is not set",
      });
      continue;
    }

    const env =
      mode === "session"
        ? withoutEnvKeys(["OPENAI_API_KEY", "CODEX_API_KEY"])
        : process.env;

    // codex exec --json --model <model> --skip-git-repo-check "prompt"
    // Use temp file + node subprocess for cross-platform reliability
    const tempDir = process.env.TEMP || process.env.TMPDIR || "/tmp";
    const tempPromptFile = path.join(tempDir, `.codex-prompt-${Date.now()}.txt`);
    const tempScriptFile = path.join(tempDir, `.codex-runner-${Date.now()}.cjs`);

    // Write prompt to file (will be piped to stdin)
    fs.writeFileSync(tempPromptFile, prompt, "utf8");

    // Write a Node script that will pipe prompt to codex via stdin
    const wrapperScript = `
const { spawn } = require('child_process');
const fs = require('fs');
const prompt = fs.readFileSync(${JSON.stringify(tempPromptFile)}, 'utf8');
const model = ${JSON.stringify(model)};

// Spawn codex with stdin pipe - no prompt as argument, codex reads from stdin
const child = spawn('codex', ['exec', '--json', '--color', 'never', '--model', model, '--skip-git-repo-check'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  shell: process.platform === 'win32',  // For .cmd shim on Windows
});

let stdout = '';
let stderr = '';
child.stdout.on('data', d => { stdout += d.toString(); process.stdout.write(d); });
child.stderr.on('data', d => { stderr += d.toString(); process.stderr.write(d); });
child.on('close', code => process.exit(code || 0));
child.on('error', err => { process.stderr.write(err.message); process.exit(1); });

// Write prompt to stdin and close
child.stdin.write(prompt);
child.stdin.end();
`;
    fs.writeFileSync(tempScriptFile, wrapperScript, "utf8");

    const cmd = "node";
    const args = [tempScriptFile];
    const tempFile = tempPromptFile; // for cleanup

    const raw = await runCommand(
      cmd,
      args,
      "", // codex takes prompt as arg, not stdin
      { timeoutMs: 180000, env },
    );

    // Clean up temp files
    try { fs.unlinkSync(tempPromptFile); } catch { /* ignore */ }
    try { fs.unlinkSync(tempScriptFile); } catch { /* ignore */ }

    attempts.push({
      mode,
      ok: raw.ok,
      code: raw.code,
      stderr: redactNewlines(raw.stderr),
    });

    if (raw.ok) {
      // Codex outputs JSONL; find the last agent_message or final output
      const lines = raw.stdout.trim().split("\n").filter(Boolean);
      let parsed = null;
      for (const line of lines.reverse()) {
        const obj = tryParseJson(line);
        if (obj) {
          // Look for agent message content
          if (obj.type === "item.completed" && obj.item?.type === "agent_message") {
            parsed = tryParseJson(obj.item.text) || obj.item.text;
            break;
          }
          // Fallback: try to extract any JSON response
          if (!parsed) parsed = obj;
        }
      }
      return {
        ok: true,
        authUsed: mode,
        raw: summarizeRaw(raw),
        parsed: parsed ? compactValue(parsed) : null,
        attempts,
      };
    }
  }

  return {
    ok: false,
    error: "codex failed",
    attempts,
    hint:
      "Ensure OpenAI Codex CLI is installed (`npm i -g @openai/codex`) and authenticated via OPENAI_API_KEY or CODEX_API_KEY.",
  };
}

async function runCursor(prompt, model, { authMode }) {
  const attempts = [];
  const order = providerAttemptOrder(authMode);
  const hasEnvKey = !!process.env.CURSOR_API_KEY;

  for (const mode of order) {
    if (mode === "env" && !hasEnvKey) {
      attempts.push({
        mode,
        skipped: true,
        reason: "CURSOR_API_KEY is not set",
      });
      continue;
    }

    const env =
      mode === "session" ? withoutEnvKeys(["CURSOR_API_KEY"]) : process.env;

    // On Windows, cursor-agent runs via WSL
    // Command: wsl bash -lc "cursor-agent -p 'prompt' --output-format json --model <model>"
    const tempDir = process.env.TEMP || process.env.TMPDIR || "/tmp";
    const tempPromptFile = path.join(tempDir, `.cursor-prompt-${Date.now()}.txt`);
    const tempScriptFile = path.join(tempDir, `.cursor-runner-${Date.now()}.cjs`);

    // Write prompt to file
    fs.writeFileSync(tempPromptFile, prompt, "utf8");

    // Write a Node script that handles WSL execution
    const wrapperScript = `
const { spawn } = require('child_process');
const fs = require('fs');
const prompt = fs.readFileSync(${JSON.stringify(tempPromptFile)}, 'utf8');
const model = ${JSON.stringify(model)};

// Escape prompt for bash single quotes (replace ' with '\\''')
const escapedPrompt = prompt.replace(/'/g, "'\\\\''");

// Build the cursor-agent command for WSL
const bashCmd = \`cursor-agent -p '\${escapedPrompt}' --output-format json --model \${model}\`;

const child = spawn('wsl', ['bash', '-lc', bashCmd], {
  stdio: ['pipe', 'pipe', 'pipe'],
  shell: false,
});

let stdout = '';
let stderr = '';
child.stdout.on('data', d => { stdout += d.toString(); process.stdout.write(d); });
child.stderr.on('data', d => { stderr += d.toString(); process.stderr.write(d); });
child.on('close', code => process.exit(code || 0));
child.on('error', err => { process.stderr.write(err.message); process.exit(1); });

child.stdin.end();
`;
    fs.writeFileSync(tempScriptFile, wrapperScript, "utf8");

    const raw = await runCommand(
      "node",
      [tempScriptFile],
      "",
      { timeoutMs: 180000, env },
    );

    // Clean up temp files
    try { fs.unlinkSync(tempPromptFile); } catch { /* ignore */ }
    try { fs.unlinkSync(tempScriptFile); } catch { /* ignore */ }

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
        parsed: inner ? compactValue(inner) : (outer ? compactValue(outer) : null),
        attempts,
      };
    }
  }

  return {
    ok: false,
    error: "cursor failed",
    attempts,
    hint:
      "Ensure Cursor CLI is installed in WSL (`curl https://cursor.com/install -fsS | bash`) and authenticated.",
  };
}

async function runCopilot(prompt, model, { authMode }) {
  const attempts = [];
  const order = providerAttemptOrder(authMode);
  // Copilot uses GitHub auth, not env keys typically

  for (const mode of order) {
    // Copilot primarily uses session auth via GitHub
    if (mode === "env") {
      attempts.push({
        mode,
        skipped: true,
        reason: "Copilot uses GitHub session auth (run `gh auth login` or `copilot` interactively)",
      });
      continue;
    }

    // Use Node.js wrapper to find and call copilot's entry script directly (bypasses shell)
    const tempDir = process.env.TEMP || process.env.TMPDIR || "/tmp";
    const tempPromptFile = path.join(tempDir, `.copilot-prompt-${Date.now()}.txt`);
    const tempScriptFile = path.join(tempDir, `.copilot-runner-${Date.now()}.cjs`);

    // Write prompt to file
    fs.writeFileSync(tempPromptFile, prompt, "utf8");

    // Write a Node script that finds copilot entry point and spawns node directly (no shell)
    const wrapperScript = `
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const prompt = fs.readFileSync(${JSON.stringify(tempPromptFile)}, 'utf8');
const model = ${JSON.stringify(model)};

// Find the copilot entry script by reading the .cmd shim
let copilotScript = null;
try {
  // On Windows, find the npm global prefix and copilot entry point
  if (process.platform === 'win32') {
    const npmPrefix = execSync('npm prefix -g', { encoding: 'utf8' }).trim();
    copilotScript = path.join(npmPrefix, 'node_modules', '@github', 'copilot', 'npm-loader.js');
    if (!fs.existsSync(copilotScript)) {
      // Try alternate location
      copilotScript = path.join(process.env.APPDATA || '', 'npm', 'node_modules', '@github', 'copilot', 'npm-loader.js');
    }
  } else {
    // On Unix, try global npm modules location
    copilotScript = execSync('npm root -g', { encoding: 'utf8' }).trim() + '/@github/copilot/npm-loader.js';
  }
} catch (e) {
  process.stderr.write('Failed to find copilot script: ' + e.message);
  process.exit(1);
}

if (!copilotScript || !fs.existsSync(copilotScript)) {
  process.stderr.write('Copilot script not found at: ' + copilotScript);
  process.exit(1);
}

// Spawn node directly with copilot script - NO shell parsing!
const child = spawn(process.execPath, [copilotScript, '-p', prompt, '--allow-all-tools', '--model', model], {
  stdio: ['pipe', 'pipe', 'pipe'],
  shell: false,  // CRITICAL: no shell, so no argument splitting
});

let stdout = '';
let stderr = '';
child.stdout.on('data', d => { stdout += d.toString(); process.stdout.write(d); });
child.stderr.on('data', d => { stderr += d.toString(); process.stderr.write(d); });
child.on('close', code => process.exit(code || 0));
child.on('error', err => { process.stderr.write(err.message); process.exit(1); });

child.stdin.end();
`;
    fs.writeFileSync(tempScriptFile, wrapperScript, "utf8");

    const raw = await runCommand(
      "node",
      [tempScriptFile],
      "",
      { timeoutMs: 180000 },
    );

    // Clean up temp files
    try { fs.unlinkSync(tempPromptFile); } catch { /* ignore */ }
    try { fs.unlinkSync(tempScriptFile); } catch { /* ignore */ }

    attempts.push({
      mode,
      ok: raw.ok,
      code: raw.code,
      stderr: redactNewlines(raw.stderr),
    });

    if (raw.ok) {
      // Copilot outputs response text
      const parsed = tryParseJson(raw.stdout);
      return {
        ok: true,
        authUsed: mode,
        raw: summarizeRaw(raw),
        parsed: parsed ? compactValue(parsed) : raw.stdout.trim(),
        attempts,
      };
    }
  }

  return {
    ok: false,
    error: "copilot failed",
    attempts,
    hint:
      "Ensure GitHub Copilot CLI is installed (`npm i -g @github/copilot`) and authenticated via `copilot` or `gh auth login`.",
  };
}

async function tryOfflineRating(responseFile) {
  try {
    // Try to import offline rater (ESM)
    const offlineRaterPath = path.join(__dirname, "offline-rater.mjs");
    const { ratePlanOffline } = await import(`file:///${offlineRaterPath.replace(/\\/g, "/")}`);

    const result = await ratePlanOffline(responseFile);
    return result;
  } catch (error) {
    return {
      ok: false,
      error: `Offline rating failed: ${error.message}`,
      hint: "Ensure offline-rater.mjs exists and is executable",
    };
  }
}

function isNetworkError(error) {
  const networkPatterns = [
    /ENOTFOUND/i,
    /ECONNREFUSED/i,
    /ETIMEDOUT/i,
    /network/i,
    /connection/i,
    /ECONNRESET/i,
    /timeout/i,
  ];

  const errorStr = String(error?.message || error || "");
  return networkPatterns.some(pattern => pattern.test(errorStr));
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

  const results = {};
  let allProvidersFailed = true;
  let networkErrorDetected = false;

  for (const provider of providers) {
    let providerResult;

    if (provider === "claude") {
      providerResult = await runClaude(prompt, { authMode: args.authMode });
    } else if (provider === "gemini") {
      providerResult = await runGemini(prompt, args.geminiModel, {
        authMode: args.authMode,
      });
    } else if (provider === "codex") {
      providerResult = await runCodex(prompt, args.codexModel, {
        authMode: args.authMode,
      });
    } else if (provider === "cursor") {
      providerResult = await runCursor(prompt, args.cursorModel, {
        authMode: args.authMode,
      });
    } else if (provider === "copilot") {
      providerResult = await runCopilot(prompt, args.copilotModel, {
        authMode: args.authMode,
      });
    } else {
      providerResult = {
        skipped: true,
        reason: `unsupported provider '${provider}' (supported: claude, gemini, codex, cursor, copilot)`,
      };
    }

    results[provider] = providerResult;

    // Check if this provider succeeded
    if (providerResult.ok) {
      allProvidersFailed = false;
    }

    // Detect network errors
    if (!providerResult.ok && providerResult.error) {
      if (isNetworkError(providerResult.error)) {
        networkErrorDetected = true;
      }
    }
  }

  // If all providers failed due to network, try offline fallback
  if (allProvidersFailed && networkErrorDetected && args.responseFile) {
    console.error("All providers failed with network errors. Attempting offline fallback...");

    const offlineResult = await tryOfflineRating(args.responseFile);

    if (offlineResult.ok) {
      console.log(
        JSON.stringify(
          {
            promptVersion: 3,
            template: args.template,
            authMode: args.authMode,
            method: "offline",
            offline_fallback: true,
            providers: results,
            offline_rating: offlineResult,
          },
          null,
          2,
        ),
      );
      return;
    } else {
      // Offline also failed
      results.offline_fallback = offlineResult;
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
  console.error(`fatal: ${e?.message || e}`);
  process.exit(1);
});
