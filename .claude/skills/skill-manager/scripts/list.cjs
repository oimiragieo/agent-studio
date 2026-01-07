#!/usr/bin/env node
/**
 * Skill Lister - List installed and available Claude Code skills
 *
 * Usage:
 *   node list.cjs [options]
 *
 * Options:
 *   --path <dir>           Skills directory (default: .claude/skills)
 *   --repo <owner/repo>    List skills from GitHub repo
 *   --repo-path <path>     Path within repo to list (default: skills/)
 *   --ref <ref>            Branch/tag for repo (default: main)
 *   --format <fmt>         Output format: text, json (default: text)
 *
 * Examples:
 *   node list.cjs
 *   node list.cjs --path .claude/skills
 *   node list.cjs --repo anthropics/skills --repo-path skills/
 *   node list.cjs --format json
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

const DEFAULT_SKILLS_PATH = ".claude/skills";
const DEFAULT_REF = "main";

function parseArgs(argv) {
  const args = {
    path: DEFAULT_SKILLS_PATH,
    repo: null,
    repoPath: "skills/",
    ref: DEFAULT_REF,
    format: "text",
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--path") args.path = argv[++i];
    else if (token === "--repo") args.repo = argv[++i];
    else if (token === "--repo-path") args.repoPath = argv[++i];
    else if (token === "--ref") args.ref = argv[++i];
    else if (token === "--format") args.format = argv[++i];
    else if (token === "--help" || token === "-h") args.help = true;
  }

  return args;
}

function usage(exitCode = 0) {
  console.log(`
Skill Lister - List installed and available Claude Code skills

Usage:
  node list.cjs [options]

Options:
  --path <dir>           Skills directory (default: .claude/skills)
  --repo <owner/repo>    List skills from GitHub repo
  --repo-path <path>     Path within repo to list (default: skills/)
  --ref <ref>            Branch/tag for repo (default: main)
  --format <fmt>         Output format: text, json (default: text)
  --help                 Show this help

Environment:
  GITHUB_TOKEN or GH_TOKEN for private repos

Examples:
  node list.cjs
  node list.cjs --path .claude/skills
  node list.cjs --repo owner/repo --repo-path skills/curated
  node list.cjs --format json
`);
  process.exit(exitCode);
}

function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    const reqHeaders = {
      "User-Agent": "claude-skill-list",
      Accept: "application/vnd.github.v3+json",
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

function getInstalledSkills(skillsPath) {
  const skills = [];
  const resolvedPath = path.resolve(skillsPath);

  if (!fs.existsSync(resolvedPath)) {
    return skills;
  }

  const entries = fs.readdirSync(resolvedPath, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const skillDir = path.join(resolvedPath, entry.name);
    const skillMd = path.join(skillDir, "SKILL.md");

    if (fs.existsSync(skillMd)) {
      const content = fs.readFileSync(skillMd, "utf8");

      // Extract name and description from frontmatter
      let name = entry.name;
      let description = "";

      // Normalize line endings to handle both LF and CRLF
      const normalizedContent = content.replace(/\r\n/g, '\n');
      const frontmatterMatch = normalizedContent.match(/^---\n([\s\S]*?)\n---/);
      if (frontmatterMatch) {
        const nameMatch = frontmatterMatch[1].match(/^name:\s*(.+)$/m);
        const descMatch = frontmatterMatch[1].match(/^description:\s*(.+)$/m);
        if (nameMatch) name = nameMatch[1].trim();
        if (descMatch) description = descMatch[1].trim();
      }

      // Truncate description
      if (description.length > 80) {
        description = description.slice(0, 77) + "...";
      }

      skills.push({
        name,
        folder: entry.name,
        path: skillDir,
        description,
        installed: true,
      });
    }
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

async function getRepoSkills(repo, repoPath, ref) {
  const [owner, repoName] = repo.split("/");
  const apiUrl = `https://api.github.com/repos/${owner}/${repoName}/contents/${repoPath}?ref=${ref}`;

  try {
    const data = await httpsGet(apiUrl);
    const contents = JSON.parse(data.toString());

    if (!Array.isArray(contents)) {
      throw new Error("Path is not a directory");
    }

    const skills = [];
    for (const item of contents) {
      if (item.type === "dir") {
        skills.push({
          name: item.name,
          path: item.path,
          url: `https://github.com/${repo}/tree/${ref}/${item.path}`,
          installed: false,
        });
      }
    }

    return skills.sort((a, b) => a.name.localeCompare(b.name));
  } catch (e) {
    if (e.message.includes("HTTP 404")) {
      throw new Error(`Path not found: https://github.com/${repo}/tree/${ref}/${repoPath}`);
    }
    throw e;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) usage(0);

  try {
    let skills;
    let source;

    if (args.repo) {
      // List from GitHub repo
      source = `${args.repo}/${args.repoPath}`;
      const repoSkills = await getRepoSkills(args.repo, args.repoPath, args.ref);

      // Check which are already installed
      const installed = new Set(
        getInstalledSkills(args.path).map((s) => s.name)
      );

      skills = repoSkills.map((s) => ({
        ...s,
        installed: installed.has(s.name),
      }));
    } else {
      // List installed skills
      source = path.resolve(args.path);
      skills = getInstalledSkills(args.path);
    }

    if (args.format === "json") {
      console.log(JSON.stringify(skills, null, 2));
    } else {
      if (args.repo) {
        console.log(`Skills from ${source}:\n`);
      } else {
        console.log(`Installed skills in ${source}:\n`);
      }

      if (skills.length === 0) {
        console.log("  (none)");
      } else {
        for (let i = 0; i < skills.length; i++) {
          const s = skills[i];
          const suffix = s.installed && args.repo ? " (installed)" : "";
          const desc = s.description ? ` - ${s.description}` : "";
          console.log(`  ${i + 1}. ${s.name}${suffix}${desc}`);
        }
      }

      if (args.repo) {
        console.log(
          "\nTo install: node install.cjs --repo " +
            args.repo +
            " --path " +
            args.repoPath +
            "<skill-name>"
        );
      }
    }
  } catch (e) {
    console.error(`[ERROR] ${e.message}`);
    process.exit(1);
  }
}

main();
