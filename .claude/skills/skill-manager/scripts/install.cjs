#!/usr/bin/env node
/**
 * Skill Installer - Install Claude Code skills from GitHub
 *
 * Usage:
 *   node install.cjs --repo owner/repo --path path/to/skill [options]
 *   node install.cjs --url https://github.com/owner/repo/tree/ref/path [options]
 *
 * Options:
 *   --repo <owner/repo>    GitHub repository (e.g., anthropics/skills)
 *   --url <url>            Full GitHub URL to skill directory
 *   --path <path>          Path(s) to skill(s) inside repo (can specify multiple)
 *   --ref <ref>            Branch, tag, or commit (default: main)
 *   --dest <dir>           Destination directory (default: .claude/skills)
 *   --name <name>          Override skill name (only for single path)
 *
 * Examples:
 *   node install.cjs --repo owner/repo --path skills/my-skill
 *   node install.cjs --url https://github.com/owner/repo/tree/main/skills/my-skill
 *   node install.cjs --repo owner/repo --path skills/skill-1 --path skills/skill-2
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const { execSync, spawn } = require("child_process");
const os = require("os");

const DEFAULT_REF = "main";
const DEFAULT_DEST = ".claude/skills";

function parseArgs(argv) {
  const args = {
    repo: null,
    url: null,
    paths: [],
    ref: DEFAULT_REF,
    dest: DEFAULT_DEST,
    name: null,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--repo") args.repo = argv[++i];
    else if (token === "--url") args.url = argv[++i];
    else if (token === "--path") args.paths.push(argv[++i]);
    else if (token === "--ref") args.ref = argv[++i];
    else if (token === "--dest") args.dest = argv[++i];
    else if (token === "--name") args.name = argv[++i];
    else if (token === "--help" || token === "-h") args.help = true;
  }

  return args;
}

function usage(exitCode = 0) {
  console.log(`
Skill Installer - Install Claude Code skills from GitHub

Usage:
  node install.cjs --repo owner/repo --path path/to/skill [options]
  node install.cjs --url https://github.com/owner/repo/tree/ref/path [options]

Options:
  --repo <owner/repo>    GitHub repository
  --url <url>            Full GitHub URL to skill directory
  --path <path>          Path(s) to skill(s) inside repo (repeatable)
  --ref <ref>            Branch, tag, or commit (default: main)
  --dest <dir>           Destination directory (default: .claude/skills)
  --name <name>          Override skill name (single path only)
  --help                 Show this help

Environment:
  GITHUB_TOKEN or GH_TOKEN for private repos

Examples:
  node install.cjs --repo anthropics/skills --path skills/my-skill
  node install.cjs --url https://github.com/owner/repo/tree/main/skills/my-skill
  node install.cjs --repo owner/repo --path skills/a --path skills/b
`);
  process.exit(exitCode);
}

function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    const reqHeaders = {
      "User-Agent": "claude-skill-install",
      ...headers,
    };
    if (token) {
      reqHeaders["Authorization"] = `token ${token}`;
    }

    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      headers: reqHeaders,
    };

    https
      .get(options, (res) => {
        // Handle redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return httpsGet(res.headers.location, headers).then(resolve).catch(reject);
        }

        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }

        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

function parseGitHubUrl(url, defaultRef) {
  const parsed = new URL(url);
  if (parsed.hostname !== "github.com") {
    throw new Error("Only GitHub URLs are supported");
  }

  const parts = parsed.pathname.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new Error("Invalid GitHub URL");
  }

  const owner = parts[0];
  const repo = parts[1];
  let ref = defaultRef;
  let subpath = "";

  if (parts.length > 2) {
    if (parts[2] === "tree" || parts[2] === "blob") {
      if (parts.length < 4) {
        throw new Error("GitHub URL missing ref or path");
      }
      ref = parts[3];
      subpath = parts.slice(4).join("/");
    } else {
      subpath = parts.slice(2).join("/");
    }
  }

  return { owner, repo, ref, subpath: subpath || null };
}

async function downloadFile(url) {
  return httpsGet(url);
}

async function fetchGitHubContents(owner, repo, path, ref) {
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${ref}`;
  const data = await httpsGet(apiUrl, { Accept: "application/vnd.github.v3+json" });
  return JSON.parse(data.toString());
}

async function downloadDirectory(owner, repo, dirPath, ref, destDir) {
  const contents = await fetchGitHubContents(owner, repo, dirPath, ref);

  if (!Array.isArray(contents)) {
    throw new Error(`Path is not a directory: ${dirPath}`);
  }

  fs.mkdirSync(destDir, { recursive: true });

  for (const item of contents) {
    const itemDest = path.join(destDir, item.name);

    if (item.type === "file") {
      console.log(`  Downloading: ${item.path}`);
      const content = await downloadFile(item.download_url);
      fs.writeFileSync(itemDest, content);
    } else if (item.type === "dir") {
      await downloadDirectory(owner, repo, item.path, ref, itemDest);
    }
  }
}

function gitSparseCheckout(owner, repo, ref, paths, destDir) {
  const repoUrl = `https://github.com/${owner}/${repo}.git`;
  const repoDir = path.join(destDir, "repo");

  try {
    // Clone with sparse checkout
    execSync(
      `git clone --filter=blob:none --depth 1 --sparse --single-branch --branch ${ref} ${repoUrl} ${repoDir}`,
      { stdio: "pipe" }
    );
  } catch (e) {
    // Try without branch (might be a tag or commit)
    execSync(
      `git clone --filter=blob:none --depth 1 --sparse --single-branch ${repoUrl} ${repoDir}`,
      { stdio: "pipe" }
    );
  }

  // Set sparse checkout paths
  execSync(`git -C ${repoDir} sparse-checkout set ${paths.join(" ")}`, {
    stdio: "pipe",
  });

  // Checkout specific ref
  execSync(`git -C ${repoDir} checkout ${ref}`, { stdio: "pipe" });

  return repoDir;
}

function validateSkillDir(skillPath) {
  if (!fs.existsSync(skillPath)) {
    throw new Error(`Skill path not found: ${skillPath}`);
  }

  const skillMd = path.join(skillPath, "SKILL.md");
  if (!fs.existsSync(skillMd)) {
    throw new Error("SKILL.md not found in skill directory");
  }
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function rmrf(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function installSkill(source, skillPath, destRoot, overrideName) {
  const skillName = overrideName || path.basename(skillPath);

  // Validate skill name
  if (!skillName || skillName === "." || skillName === "..") {
    throw new Error("Invalid skill name");
  }

  const destDir = path.join(destRoot, skillName);

  // Check destination doesn't exist
  if (fs.existsSync(destDir)) {
    throw new Error(`Destination already exists: ${destDir}`);
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skill-install-"));

  try {
    console.log(`Installing ${skillName} from ${source.owner}/${source.repo}...`);

    let repoRoot;
    let useGit = false;

    // Try direct download first
    try {
      const skillDestTmp = path.join(tmpDir, skillName);
      await downloadDirectory(
        source.owner,
        source.repo,
        skillPath,
        source.ref,
        skillDestTmp
      );
      repoRoot = tmpDir;
    } catch (e) {
      // Fall back to git sparse checkout
      if (
        e.message.includes("HTTP 401") ||
        e.message.includes("HTTP 403") ||
        e.message.includes("HTTP 404")
      ) {
        console.log("  Download failed, trying git sparse checkout...");
        useGit = true;
        repoRoot = gitSparseCheckout(
          source.owner,
          source.repo,
          source.ref,
          [skillPath],
          tmpDir
        );
      } else {
        throw e;
      }
    }

    // Validate and copy
    const srcPath = useGit
      ? path.join(repoRoot, skillPath)
      : path.join(repoRoot, skillName);

    validateSkillDir(srcPath);

    // Create destination directory
    fs.mkdirSync(path.dirname(destDir), { recursive: true });
    copyDir(srcPath, destDir);

    console.log(`[OK] Installed ${skillName} to ${destDir}`);
    return { name: skillName, path: destDir };
  } finally {
    rmrf(tmpDir);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) usage(0);

  // Resolve source
  let source;
  let paths = args.paths;

  if (args.url) {
    const parsed = parseGitHubUrl(args.url, args.ref);
    source = { owner: parsed.owner, repo: parsed.repo, ref: parsed.ref };
    if (parsed.subpath && paths.length === 0) {
      paths = [parsed.subpath];
    }
  } else if (args.repo) {
    const parts = args.repo.split("/").filter(Boolean);
    if (parts.length !== 2) {
      console.error("[ERROR] --repo must be in owner/repo format");
      process.exit(1);
    }
    source = { owner: parts[0], repo: parts[1], ref: args.ref };
  } else {
    console.error("[ERROR] Provide --repo or --url");
    usage(1);
  }

  if (paths.length === 0) {
    console.error("[ERROR] Missing --path");
    process.exit(1);
  }

  if (args.name && paths.length > 1) {
    console.error("[ERROR] --name can only be used with a single --path");
    process.exit(1);
  }

  // Validate paths
  for (const p of paths) {
    if (path.isAbsolute(p) || p.startsWith("..")) {
      console.error(`[ERROR] Path must be relative: ${p}`);
      process.exit(1);
    }
  }

  // Install each skill
  const installed = [];
  try {
    for (const skillPath of paths) {
      const name = paths.length === 1 ? args.name : null;
      const result = await installSkill(source, skillPath, args.dest, name);
      installed.push(result);
    }

    console.log("\n[OK] Installation complete");
    if (installed.length > 1) {
      console.log("Installed skills:");
      installed.forEach((s) => console.log(`  - ${s.name}`));
    }
    console.log("\nRestart Claude Code to pick up new skills.");
  } catch (e) {
    console.error(`[ERROR] ${e.message}`);
    process.exit(1);
  }
}

main();
