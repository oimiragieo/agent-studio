#!/usr/bin/env node
/**
 * MCP to Skill Converter - Convert MCP servers to Claude Code skills
 *
 * Usage:
 *   node convert.cjs --list                    List configured MCP servers
 *   node convert.cjs --server <name>           Convert specific MCP server
 *   node convert.cjs --all                     Convert all eligible servers
 *   node convert.cjs --catalog                 Show catalog entries
 *
 * Options:
 *   --mcp-config <path>    Path to .mcp.json (default: .claude/.mcp.json)
 *   --catalog <path>       Path to mcp-catalog.yaml
 *   --dest <dir>           Output directory (default: .claude/skills)
 *   --force                Overwrite existing skills
 *   --dry-run              Show what would be converted without creating files
 *
 * Examples:
 *   node convert.cjs --list
 *   node convert.cjs --server github
 *   node convert.cjs --all --dry-run
 */

const fs = require("fs");
const path = require("path");
const { spawnSync, execSync } = require("child_process");

const DEFAULT_MCP_CONFIG = ".claude/.mcp.json";
const DEFAULT_CATALOG = ".claude/skills/mcp-converter/mcp-catalog.yaml";
const DEFAULT_DEST = ".claude/skills";

// Known MCP servers from modelcontextprotocol/servers repo
const KNOWN_MCP_SERVERS = {
  filesystem: {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem"],
    description: "File system operations - read, write, list directories",
  },
  "sequential-thinking": {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-sequential-thinking"],
    description: "Sequential thinking and structured problem solving",
  },
  memory: {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-memory"],
    description: "Persistent memory and knowledge graph",
  },
  fetch: {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-fetch"],
    description: "HTTP fetch and web content retrieval",
  },
  github: {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    description: "GitHub API integration",
    env: { GITHUB_TOKEN: "${GITHUB_TOKEN}" },
  },
  gitlab: {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-gitlab"],
    description: "GitLab API integration",
  },
  slack: {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-slack"],
    description: "Slack workspace integration",
    env: { SLACK_BOT_TOKEN: "${SLACK_BOT_TOKEN}" },
  },
  postgres: {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-postgres"],
    description: "PostgreSQL database operations",
  },
  sqlite: {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-sqlite"],
    description: "SQLite database operations",
  },
  puppeteer: {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-puppeteer"],
    description: "Browser automation with Puppeteer",
  },
  brave: {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-brave-search"],
    description: "Brave Search API integration",
  },
  google: {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-google-maps"],
    description: "Google Maps API integration",
  },
  everart: {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-everart"],
    description: "AI image generation",
  },
  "everything": {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-everything"],
    description: "Demo server with all capabilities",
  },
};

// Known Python MCP servers from PyPI
const KNOWN_PYPI_SERVERS = {
  git: {
    command: "python",
    args: ["-m", "mcp_server_git"],
    pypiPackage: "mcp-server-git",
    description: "Git repository operations - status, diff, commit, branch, log",
    requiresPath: true, // Needs --repository flag
    pathFlag: "--repository",
    pathType: "git", // Auto-detect git root
  },
  time: {
    command: "python",
    args: ["-m", "mcp_server_time"],
    pypiPackage: "mcp-server-time",
    description: "Time and timezone operations",
  },
  "aws-kb-retrieval": {
    command: "python",
    args: ["-m", "mcp_server_aws_kb_retrieval"],
    pypiPackage: "mcp-server-aws-kb-retrieval",
    description: "AWS Knowledge Base retrieval",
    env: { AWS_ACCESS_KEY_ID: "${AWS_ACCESS_KEY_ID}", AWS_SECRET_ACCESS_KEY: "${AWS_SECRET_ACCESS_KEY}" },
  },
  sentry: {
    command: "python",
    args: ["-m", "mcp_server_sentry"],
    pypiPackage: "mcp-server-sentry",
    description: "Sentry error tracking integration",
    env: { SENTRY_AUTH_TOKEN: "${SENTRY_AUTH_TOKEN}" },
  },
  "linear-mcp": {
    command: "python",
    args: ["-m", "linear_mcp"],
    pypiPackage: "linear-mcp",
    description: "Linear issue tracking integration",
    env: { LINEAR_API_KEY: "${LINEAR_API_KEY}" },
  },
  raygun: {
    command: "python",
    args: ["-m", "mcp_server_raygun"],
    pypiPackage: "mcp-server-raygun",
    description: "Raygun error tracking integration",
  },
  "qdrant-mcp": {
    command: "python",
    args: ["-m", "qdrant_mcp"],
    pypiPackage: "qdrant-mcp",
    description: "Qdrant vector database operations",
  },
  axiom: {
    command: "python",
    args: ["-m", "mcp_server_axiom"],
    pypiPackage: "mcp-server-axiom",
    description: "Axiom observability platform integration",
    env: { AXIOM_TOKEN: "${AXIOM_TOKEN}" },
  },
  "mcp-twikit": {
    command: "python",
    args: ["-m", "mcp_twikit"],
    pypiPackage: "mcp-twikit",
    description: "Twitter/X API integration",
  },
};

// Known Docker-based MCP servers
const KNOWN_DOCKER_SERVERS = {
  "github-official": {
    command: "docker",
    args: ["run", "-i", "--rm", "-e", "GITHUB_PERSONAL_ACCESS_TOKEN", "ghcr.io/github/github-mcp-server"],
    dockerImage: "ghcr.io/github/github-mcp-server",
    description: "Official GitHub MCP server - repos, issues, PRs, actions, security (80+ tools)",
    env: { GITHUB_PERSONAL_ACCESS_TOKEN: "${GITHUB_PERSONAL_ACCESS_TOKEN}" },
    envAliases: ["GITHUB_TOKEN"], // Alternative env var names
    toolsets: ["repos", "issues", "pull_requests", "users", "actions", "code_security"],
    defaultToolsets: ["repos", "issues", "pull_requests", "users"],
  },
  "context7": {
    command: "docker",
    args: ["run", "-i", "--rm", "mcp/context7"],
    dockerImage: "mcp/context7",
    description: "Context7 - up-to-date code documentation for LLMs",
  },
  "playwright": {
    command: "docker",
    args: ["run", "-i", "--rm", "-e", "DISPLAY", "mcp/playwright"],
    dockerImage: "mcp/playwright",
    description: "Browser automation with Playwright",
  },
  "browserbase": {
    command: "docker",
    args: ["run", "-i", "--rm", "-e", "BROWSERBASE_API_KEY", "-e", "BROWSERBASE_PROJECT_ID", "ghcr.io/browserbase/mcp-server-browserbase"],
    dockerImage: "ghcr.io/browserbase/mcp-server-browserbase",
    description: "Browserbase cloud browser automation",
    env: { BROWSERBASE_API_KEY: "${BROWSERBASE_API_KEY}", BROWSERBASE_PROJECT_ID: "${BROWSERBASE_PROJECT_ID}" },
  },
  "firecrawl": {
    command: "docker",
    args: ["run", "-i", "--rm", "-e", "FIRECRAWL_API_KEY", "mcp/firecrawl"],
    dockerImage: "mcp/firecrawl",
    description: "Firecrawl web scraping and crawling",
    env: { FIRECRAWL_API_KEY: "${FIRECRAWL_API_KEY}" },
  },
  "e2b": {
    command: "docker",
    args: ["run", "-i", "--rm", "-e", "E2B_API_KEY", "mcp/e2b"],
    dockerImage: "mcp/e2b",
    description: "E2B code execution sandbox",
    env: { E2B_API_KEY: "${E2B_API_KEY}" },
  },
  "neo4j": {
    command: "docker",
    args: ["run", "-i", "--rm", "-e", "NEO4J_URI", "-e", "NEO4J_USER", "-e", "NEO4J_PASSWORD", "mcp/neo4j"],
    dockerImage: "mcp/neo4j",
    description: "Neo4j graph database operations",
    env: { NEO4J_URI: "${NEO4J_URI}", NEO4J_USER: "${NEO4J_USER}", NEO4J_PASSWORD: "${NEO4J_PASSWORD}" },
  },
  "neon": {
    command: "docker",
    args: ["run", "-i", "--rm", "-e", "NEON_API_KEY", "mcp/neon"],
    dockerImage: "mcp/neon",
    description: "Neon serverless Postgres",
    env: { NEON_API_KEY: "${NEON_API_KEY}" },
  },
};

// Simple YAML parser for catalog (handles basic structure)
function parseSimpleYaml(content) {
  const result = { mcp_servers: [], conversion_rules: {} };
  const lines = content.split("\n");
  let currentServer = null;
  let inServers = false;
  let inRules = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === "mcp_servers:") {
      inServers = true;
      inRules = false;
      continue;
    }
    if (trimmed === "conversion_rules:") {
      inServers = false;
      inRules = true;
      continue;
    }
    if (trimmed === "statistics:") {
      inServers = false;
      inRules = false;
      continue;
    }

    if (inServers) {
      // New server entry
      if (trimmed.startsWith("- name:")) {
        if (currentServer) {
          result.mcp_servers.push(currentServer);
        }
        currentServer = { name: trimmed.slice(8).trim() };
      } else if (currentServer && trimmed.includes(":")) {
        const colonIdx = trimmed.indexOf(":");
        const key = trimmed.slice(0, colonIdx).trim();
        let value = trimmed.slice(colonIdx + 1).trim();

        // Parse booleans and numbers
        if (value === "true") value = true;
        else if (value === "false") value = false;
        else if (/^\d+$/.test(value)) value = parseInt(value, 10);
        else if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }

        currentServer[key] = value;
      }
    }
  }

  if (currentServer) {
    result.mcp_servers.push(currentServer);
  }

  return result;
}

// Check if an npm package exists
function checkNpmPackageExists(packageName) {
  try {
    // Use npm view to check if package exists (silent, just check exit code)
    execSync(`npm view ${packageName} version`, {
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 15000,
    });
    return { exists: true, source: "npm" };
  } catch (e) {
    // Check if it's a 404 (package not found) vs other error
    const stderr = e.stderr?.toString() || "";
    if (stderr.includes("404") || stderr.includes("Not found")) {
      return { exists: false, reason: "Package not found on npm" };
    }
    // Network error or other issue - assume it might exist
    return { exists: true, source: "npm", warning: "Could not verify package (network issue?)" };
  }
}

// Check if a PyPI package exists
function checkPyPiPackageExists(packageName) {
  try {
    // Use pip index versions to check if package exists
    const result = execSync(`pip index versions ${packageName}`, {
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 15000,
    });
    const output = result.toString();
    // Check if versions were returned
    if (output.includes(packageName) || output.includes("Available versions")) {
      return { exists: true, source: "pypi" };
    }
    return { exists: false, reason: "Package not found on PyPI" };
  } catch (e) {
    const stderr = e.stderr?.toString() || "";
    const stdout = e.stdout?.toString() || "";

    // pip index versions returns error if not found
    if (stderr.includes("No matching distribution") ||
        stderr.includes("not found") ||
        stderr.includes("ERROR")) {
      return { exists: false, reason: "Package not found on PyPI" };
    }

    // If we got version info in stdout, it exists
    if (stdout.includes(packageName)) {
      return { exists: true, source: "pypi" };
    }

    // Network error or other issue - try alternative check
    try {
      // Fallback: try pip show (works if already installed)
      execSync(`pip show ${packageName}`, {
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 10000,
      });
      return { exists: true, source: "pypi", note: "already installed" };
    } catch (e2) {
      // Package not installed and couldn't verify online
      return { exists: false, reason: "Package not found on PyPI", warning: "Could not verify (network issue?)" };
    }
  }
}

// Check if a Docker image exists (can be pulled)
function checkDockerImageExists(imageName) {
  try {
    // First check if Docker is available
    execSync("docker --version", {
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 5000,
    });
  } catch (e) {
    return { exists: false, reason: "Docker not available", dockerRequired: true };
  }

  try {
    // Check if image exists locally
    const result = execSync(`docker image inspect ${imageName}`, {
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 10000,
    });
    return { exists: true, source: "docker", local: true };
  } catch (e) {
    // Image not local - check if it can be pulled (manifest inspect)
    try {
      execSync(`docker manifest inspect ${imageName}`, {
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 30000,
      });
      return { exists: true, source: "docker", local: false, note: "Will be pulled on first use" };
    } catch (e2) {
      // Manifest inspect requires auth for some registries, try a different approach
      // For ghcr.io images, we can assume they exist if the pattern is valid
      if (imageName.startsWith("ghcr.io/")) {
        return { exists: true, source: "docker", local: false, warning: "Could not verify (may require auth)" };
      }
      return { exists: false, reason: "Docker image not found" };
    }
  }
}

// Check package existence on npm, PyPI, or Docker
function checkPackageExists(serverConfig) {
  const isPython = serverConfig.command === "python" || serverConfig.pypiPackage;
  const isDocker = serverConfig.command === "docker" || serverConfig.dockerImage;

  if (isDocker) {
    const dockerImage = serverConfig.dockerImage || extractDockerImage(serverConfig);
    if (dockerImage) {
      return checkDockerImageExists(dockerImage);
    }
    return { exists: true, source: "docker", warning: "Could not determine Docker image" };
  }

  if (isPython) {
    const pypiPackage = serverConfig.pypiPackage || extractPyPiPackageName(serverConfig);
    if (pypiPackage) {
      return checkPyPiPackageExists(pypiPackage);
    }
  } else {
    const npmPackage = extractNpmPackageName(serverConfig);
    if (npmPackage) {
      const npmResult = checkNpmPackageExists(npmPackage);
      if (npmResult.exists) {
        return npmResult;
      }

      // npm failed - try PyPI as fallback for official MCP servers
      if (npmPackage.startsWith("@modelcontextprotocol/server-")) {
        const serverName = npmPackage.replace("@modelcontextprotocol/server-", "");
        const pypiName = `mcp-server-${serverName}`;
        const pypiResult = checkPyPiPackageExists(pypiName);
        if (pypiResult.exists) {
          return { ...pypiResult, fallbackFrom: "npm", pypiPackage: pypiName };
        }
      }

      return npmResult;
    }
  }

  return { exists: true, warning: "Could not determine package name" };
}

// Extract npm package name from server config
function extractNpmPackageName(serverConfig) {
  if (serverConfig.command !== "npx") return null;
  const args = serverConfig.args || [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("-")) continue;
    if (arg.startsWith("@") || !arg.startsWith("-")) {
      return arg;
    }
  }
  return null;
}

// Extract PyPI package name from server config
function extractPyPiPackageName(serverConfig) {
  if (serverConfig.pypiPackage) return serverConfig.pypiPackage;
  if (serverConfig.command !== "python") return null;
  const args = serverConfig.args || [];
  // Look for module name after -m
  const mIndex = args.indexOf("-m");
  if (mIndex !== -1 && mIndex + 1 < args.length) {
    // Convert module name to package name (mcp_server_git -> mcp-server-git)
    return args[mIndex + 1].replace(/_/g, "-");
  }
  return null;
}

// Extract npm package name from server config (legacy alias)
function extractPackageName(serverConfig) {
  const args = serverConfig.args || [];
  // Look for package name in args (usually after -y in npx)
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    // Skip flags
    if (arg.startsWith("-")) continue;
    // Found a package name
    if (arg.startsWith("@") || !arg.startsWith("-")) {
      return arg;
    }
  }
  return null;
}

// Extract Docker image name from server config
function extractDockerImage(serverConfig) {
  if (serverConfig.dockerImage) return serverConfig.dockerImage;
  if (serverConfig.command !== "docker") return null;
  const args = serverConfig.args || [];
  // Look for image name - it's usually the last arg after "run"
  // docker run -i --rm -e VAR ghcr.io/owner/image
  let foundRun = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "run") {
      foundRun = true;
      continue;
    }
    if (!foundRun) continue;
    // Skip flags and their values
    if (arg.startsWith("-")) {
      // Skip next arg if this is a flag with value (-e VAR)
      if (arg === "-e" || arg === "-v" || arg === "-p" || arg === "--env" || arg === "--volume") {
        i++;
      }
      continue;
    }
    // This should be the image name
    if (arg.includes("/") || arg.includes(":")) {
      return arg;
    }
  }
  return null;
}

// Parse GitHub URL to extract server name
// Supports:
//   https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem
//   https://github.com/owner/repo/tree/branch/path/to/server
//   modelcontextprotocol/servers/src/filesystem (shorthand)
function parseGitHubUrl(url) {
  // Remove trailing slashes
  url = url.replace(/\/+$/, "");

  // Handle shorthand: modelcontextprotocol/servers/src/filesystem
  if (!url.startsWith("http")) {
    const parts = url.split("/");
    if (parts.length >= 4 && parts[0] === "modelcontextprotocol" && parts[1] === "servers") {
      // Extract server name (last part of path)
      const serverName = parts[parts.length - 1];
      return { serverName, isOfficial: true };
    }
    // Assume it's just a server name
    return { serverName: url, isOfficial: true };
  }

  // Parse full GitHub URL
  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)\/tree\/[^\/]+\/(.+)/);
  if (match) {
    const [, owner, repo, pathInRepo] = match;
    const serverName = pathInRepo.split("/").pop();
    const isOfficial = owner === "modelcontextprotocol" && repo === "servers";
    return { serverName, isOfficial, owner, repo, path: pathInRepo };
  }

  // Try simpler pattern: github.com/owner/repo
  const simpleMatch = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (simpleMatch) {
    const [, owner, repo] = simpleMatch;
    // Assume repo name is the server name
    const serverName = repo.replace(/^server-/, "").replace(/-mcp$/, "");
    return { serverName, isOfficial: false, owner, repo };
  }

  return null;
}

// Get MCP config for a known server or try to infer it
// Returns { config, source: "npm" | "pypi" | "docker" | "auto" }
function getServerConfig(serverName, parsedUrl) {
  // Check known npm servers first
  if (KNOWN_MCP_SERVERS[serverName]) {
    return { config: KNOWN_MCP_SERVERS[serverName], source: "npm" };
  }

  // Check known PyPI servers
  if (KNOWN_PYPI_SERVERS[serverName]) {
    return { config: KNOWN_PYPI_SERVERS[serverName], source: "pypi" };
  }

  // Check known Docker servers
  if (KNOWN_DOCKER_SERVERS[serverName]) {
    return { config: KNOWN_DOCKER_SERVERS[serverName], source: "docker" };
  }

  // Try variations of the name
  const variations = [
    serverName,
    serverName.replace(/-/g, ""),
    serverName.replace(/_/g, "-"),
  ];

  for (const variant of variations) {
    if (KNOWN_MCP_SERVERS[variant]) {
      return { config: KNOWN_MCP_SERVERS[variant], source: "npm" };
    }
    if (KNOWN_PYPI_SERVERS[variant]) {
      return { config: KNOWN_PYPI_SERVERS[variant], source: "pypi" };
    }
    if (KNOWN_DOCKER_SERVERS[variant]) {
      return { config: KNOWN_DOCKER_SERVERS[variant], source: "docker" };
    }
  }

  // For official servers, try to construct the package name
  // Return as "auto" source so we can check both npm and PyPI
  if (parsedUrl?.isOfficial) {
    return {
      config: {
        command: "npx",
        args: ["-y", `@modelcontextprotocol/server-${serverName}`],
        description: `${serverName} MCP server (auto-detected)`,
      },
      source: "auto",
      serverName: serverName,
    };
  }

  // For third-party, we can't auto-detect
  return null;
}

// Convert server config to PyPI-based config when npm fails
function convertToPyPiConfig(serverName, pypiPackage) {
  const moduleName = pypiPackage.replace(/-/g, "_");
  return {
    command: "python",
    args: ["-m", moduleName],
    pypiPackage: pypiPackage,
    description: `${serverName} MCP server (PyPI)`,
  };
}

function parseArgs(argv) {
  const args = {
    list: false,
    server: null,
    fromUrl: null, // NEW: GitHub URL or shorthand
    all: false,
    catalog: false,
    knownServers: false, // NEW: List known servers
    mcpConfig: DEFAULT_MCP_CONFIG,
    catalogPath: DEFAULT_CATALOG,
    dest: DEFAULT_DEST,
    force: false,
    dryRun: false,
    test: true, // Test after conversion by default
    noTest: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--list") args.list = true;
    else if (token === "--server") args.server = argv[++i];
    else if (token === "--from-url" || token === "--url") args.fromUrl = argv[++i];
    else if (token === "--known" || token === "--known-servers") args.knownServers = true;
    else if (token === "--all") args.all = true;
    else if (token === "--catalog") args.catalog = true;
    else if (token === "--mcp-config") args.mcpConfig = argv[++i];
    else if (token === "--catalog-path") args.catalogPath = argv[++i];
    else if (token === "--dest") args.dest = argv[++i];
    else if (token === "--force") args.force = true;
    else if (token === "--dry-run") args.dryRun = true;
    else if (token === "--test") args.test = true;
    else if (token === "--no-test") args.noTest = true;
    else if (token === "--help" || token === "-h") args.help = true;
    // Handle positional argument: URL, path, or known server name
    else if (!token.startsWith("-") && !args.fromUrl) {
      // Could be a URL, path, or just a server name
      args.fromUrl = token;
    }
  }

  // --no-test overrides default
  if (args.noTest) args.test = false;

  return args;
}

function usage(exitCode = 0) {
  console.log(`
MCP to Skill Converter - Convert MCP servers to Claude Code skills

Usage:
  node convert.cjs --list                    List configured MCP servers
  node convert.cjs --server <name>           Convert MCP server from .mcp.json
  node convert.cjs --url <github-url>        Convert from GitHub URL (no .mcp.json needed)
  node convert.cjs --known                   List known MCP servers (built-in)
  node convert.cjs --all                     Convert all eligible servers
  node convert.cjs --catalog                 Show catalog entries

Convert from URL (no .mcp.json needed):
  Supports official MCP servers and auto-detects package names:

  node convert.cjs https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem
  node convert.cjs filesystem                # Shorthand for known servers
  node convert.cjs --url slack               # Same as above

Testing:
  After conversion, the skill is automatically tested (validation + introspection).
  Use --no-test to skip testing.

Options:
  --mcp-config <path>    Path to .mcp.json (default: .claude/.mcp.json)
  --catalog-path <path>  Path to mcp-catalog.yaml
  --dest <dir>           Output directory (default: .claude/skills)
  --force                Overwrite existing skills
  --dry-run              Show what would be converted without creating files
  --no-test              Skip automatic testing after conversion
  --help                 Show this help

Examples:
  node convert.cjs --list                    # List servers in .mcp.json
  node convert.cjs --known                   # List built-in known servers
  node convert.cjs --server github           # Convert from .mcp.json
  node convert.cjs filesystem                # Convert known server (no .mcp.json)
  node convert.cjs --url https://github.com/modelcontextprotocol/servers/tree/main/src/puppeteer
  node convert.cjs --all --dry-run
`);
  process.exit(exitCode);
}

function loadMcpConfig(configPath) {
  const resolved = path.resolve(configPath);
  if (!fs.existsSync(resolved)) {
    return { mcpServers: {} };
  }
  const content = fs.readFileSync(resolved, "utf8");
  return JSON.parse(content);
}

function loadCatalog(catalogPath) {
  const resolved = path.resolve(catalogPath);
  if (!fs.existsSync(resolved)) {
    return { mcp_servers: [], conversion_rules: {} };
  }
  const content = fs.readFileSync(resolved, "utf8");
  return parseSimpleYaml(content);
}

function getCatalogEntry(catalog, serverName) {
  return catalog.mcp_servers.find((s) => s.name === serverName);
}

function shouldConvert(catalogEntry) {
  if (!catalogEntry) return true; // Default: convert if not in catalog
  if (catalogEntry.keep_as_mcp) return false;
  if (catalogEntry.tool_count >= 10) return true;
  if (catalogEntry.estimated_tokens >= 15000) return true;
  return true; // Default to converting
}

function titleCase(str) {
  return str
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function generateSkillMd(serverName, mcpConfig, catalogEntry) {
  const description =
    mcpConfig.description ||
    catalogEntry?.description ||
    `Tools from ${serverName} MCP server`;
  const toolCount = catalogEntry?.tool_count || 10;
  const estimatedTokens = catalogEntry?.estimated_tokens || 15000;
  const categories = catalogEntry?.categories || ["general"];

  return `---
name: ${serverName}
description: ${description}. Converted from MCP server for 90%+ context savings.
allowed-tools: read, write, bash
---

# ${titleCase(serverName)} Skill

## Overview

This skill provides access to the ${serverName} MCP server tools with progressive disclosure for optimal context usage.

**Context Savings**: ~${Math.round((1 - 500 / estimatedTokens) * 100)}% reduction
- **MCP Mode**: ~${estimatedTokens.toLocaleString()} tokens always loaded
- **Skill Mode**: ~500 tokens metadata + on-demand loading

## Capabilities

- **Estimated Tools**: ${toolCount}
- **Categories**: ${categories.join(", ")}
- **Original MCP**: ${mcpConfig.command} ${(mcpConfig.args || []).join(" ")}

## Usage

This skill uses progressive disclosure:
1. **Initial Load**: ~500 tokens (this file)
2. **When Used**: Full tool documentation loaded on-demand
3. **Execution**: Via executor.py → MCP server

## Quick Reference

To use this skill, describe what you want to do with ${serverName}:
- "List all ${serverName} items"
- "Create a new ${serverName} resource"
- "Search ${serverName} for..."

## Tool Execution

Tools are executed via \`executor.py\` which connects to the original MCP server:

\`\`\`bash
python executor.py --tool <tool_name> --args '{"param": "value"}'
python executor.py --list  # List available tools
\`\`\`

## Configuration

MCP server configuration is stored in \`config.json\`:
- **Command**: ${mcpConfig.command}
- **Args**: ${JSON.stringify(mcpConfig.args || [])}
${mcpConfig.env ? `- **Environment**: ${Object.keys(mcpConfig.env).join(", ")}` : ""}

## Error Handling

If tool execution fails:
1. Check that required environment variables are set
2. Verify the MCP server package is installed
3. Review executor.py output for details
4. Fall back to using the MCP server directly if needed

## Related

- Original MCP server: \`${mcpConfig.command} ${(mcpConfig.args || []).slice(0, 2).join(" ")}\`
- MCP Converter Skill: \`.claude/skills/mcp-converter/\`
- Skill Manager: \`.claude/skills/skill-manager/\`
`;
}

function generateExecutor(serverName) {
  const className = serverName
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");

  return `"""
Executor for ${serverName} Skill - Handles dynamic MCP tool calls.

This executor connects to the ${serverName} MCP server and executes tool calls
on-demand, outside of Claude's context window.

Usage:
    python executor.py --list              List available tools
    python executor.py --tool <name>       Call a tool
    python executor.py --tool <name> --args '{"key": "value"}'
"""

import json
import sys
import asyncio
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client
except ImportError:
    print("Error: mcp package required. Install with: pip install mcp", file=sys.stderr)
    sys.exit(1)


class ${className}Executor:
    """Executor for ${serverName} MCP server tools."""

    def __init__(self, config_path: Optional[Path] = None):
        """Initialize executor with MCP server configuration."""
        if config_path is None:
            config_path = Path(__file__).parent / "config.json"

        with open(config_path, "r") as f:
            self.config = json.load(f)

        self.server_params = StdioServerParameters(
            command=self.config["command"],
            args=self.config.get("args", []),
            env=self.config.get("env", {}),
        )

    async def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Call an MCP tool with the given arguments."""
        async with stdio_client(self.server_params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                result = await session.call_tool(tool_name, arguments)

                # Serialize content objects to JSON-compatible format
                content = []
                for item in result.content:
                    if hasattr(item, "text"):
                        content.append({"type": "text", "text": item.text})
                    elif hasattr(item, "data"):
                        content.append({"type": "data", "data": str(item.data)})
                    else:
                        content.append({"type": "unknown", "value": str(item)})

                return {
                    "content": content,
                    "isError": result.isError if hasattr(result, "isError") else False,
                }

    async def list_tools(self) -> List[Dict[str, Any]]:
        """List all available tools from the MCP server."""
        async with stdio_client(self.server_params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                tools_result = await session.list_tools()
                return [
                    {
                        "name": tool.name,
                        "description": tool.description or "",
                        "inputSchema": tool.inputSchema if hasattr(tool, "inputSchema") else {},
                    }
                    for tool in tools_result.tools
                ]


async def main():
    """CLI entry point for executor."""
    import argparse

    parser = argparse.ArgumentParser(description=f"Execute ${serverName} MCP tools")
    parser.add_argument("--tool", help="Tool name to call")
    parser.add_argument("--args", help="Tool arguments as JSON", default="{}")
    parser.add_argument("--list", action="store_true", help="List available tools")

    args = parser.parse_args()

    executor = ${className}Executor()

    if args.list:
        tools = await executor.list_tools()
        print(json.dumps(tools, indent=2))
        return

    if args.tool:
        try:
            arguments = json.loads(args.args)
            result = await executor.call_tool(args.tool, arguments)
            print(json.dumps(result, indent=2))
        except Exception as e:
            print(f"Error calling tool: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        print("Use --list to see tools or --tool <name> --args <json> to call", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
`;
}

// Generate Python executor with path detection for servers that need it
function generatePythonExecutor(serverName, serverConfig) {
  const className = serverName
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");

  const requiresPath = serverConfig.requiresPath || false;
  const pathFlag = serverConfig.pathFlag || "--repository";
  const pathType = serverConfig.pathType || "cwd";

  // Generate path detection code based on type
  let pathDetectionCode = "";
  let constructorPathLogic = "";

  if (requiresPath) {
    if (pathType === "git") {
      pathDetectionCode = `
def find_git_root(start_path: Path = None) -> Optional[Path]:
    """Find the root of the git repository."""
    if start_path is None:
        start_path = Path.cwd()

    current = start_path.resolve()
    while current != current.parent:
        if (current / ".git").exists():
            return current
        current = current.parent

    # Check root
    if (current / ".git").exists():
        return current
    return None

`;
      constructorPathLogic = `
        # Find git repository
        if repo_path is None:
            repo_path = find_git_root()

        if repo_path is None:
            raise ValueError("Not in a git repository. Run from within a git repo.")

        # Build args with repository path
        args = self.config.get("args", []) + ["${pathFlag}", str(repo_path)]
`;
    } else {
      // Default: use current working directory
      pathDetectionCode = "";
      constructorPathLogic = `
        # Use current working directory if no path specified
        if repo_path is None:
            repo_path = Path.cwd()

        # Build args with path
        args = self.config.get("args", []) + ["${pathFlag}", str(repo_path)]
`;
    }
  }

  const constructorParams = requiresPath
    ? "config_path: Optional[Path] = None, repo_path: Optional[Path] = None"
    : "config_path: Optional[Path] = None";

  const serverParamsCode = requiresPath
    ? `self.server_params = StdioServerParameters(
            command=self.config["command"],
            args=args,
            env=self.config.get("env", {}),
        )`
    : `self.server_params = StdioServerParameters(
            command=self.config["command"],
            args=self.config.get("args", []),
            env=self.config.get("env", {}),
        )`;

  return `"""
Executor for ${serverName} Skill - Handles dynamic MCP tool calls.

This executor connects to the ${serverName} MCP server and executes tool calls
on-demand, outside of Claude's context window.

Usage:
    python executor.py --list              List available tools
    python executor.py --tool <name>       Call a tool
    python executor.py --tool <name> --args '{"key": "value"}'
"""

import json
import sys
import asyncio
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client
except ImportError:
    print("Error: mcp package required. Install with: pip install mcp", file=sys.stderr)
    sys.exit(1)

${pathDetectionCode}
class ${className}Executor:
    """Executor for ${serverName} MCP server tools."""

    def __init__(self, ${constructorParams}):
        """Initialize executor with MCP server configuration."""
        if config_path is None:
            config_path = Path(__file__).parent / "config.json"

        with open(config_path, "r") as f:
            self.config = json.load(f)
${constructorPathLogic}
        ${serverParamsCode}

    async def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Call an MCP tool with the given arguments."""
        async with stdio_client(self.server_params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                result = await session.call_tool(tool_name, arguments)

                # Serialize content objects to JSON-compatible format
                content = []
                for item in result.content:
                    if hasattr(item, "text"):
                        content.append({"type": "text", "text": item.text})
                    elif hasattr(item, "data"):
                        content.append({"type": "data", "data": str(item.data)})
                    else:
                        content.append({"type": "unknown", "value": str(item)})

                return {
                    "content": content,
                    "isError": result.isError if hasattr(result, "isError") else False,
                }

    async def list_tools(self) -> List[Dict[str, Any]]:
        """List all available tools from the MCP server."""
        async with stdio_client(self.server_params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                tools_result = await session.list_tools()
                return [
                    {
                        "name": tool.name,
                        "description": tool.description or "",
                        "inputSchema": tool.inputSchema if hasattr(tool, "inputSchema") else {},
                    }
                    for tool in tools_result.tools
                ]


async def main():
    """CLI entry point for executor."""
    import argparse

    parser = argparse.ArgumentParser(description=f"Execute ${serverName} MCP tools")
    parser.add_argument("--tool", help="Tool name to call")
    parser.add_argument("--args", help="Tool arguments as JSON", default="{}")
    parser.add_argument("--list", action="store_true", help="List available tools")

    args = parser.parse_args()

    executor = ${className}Executor()

    if args.list:
        tools = await executor.list_tools()
        print(json.dumps(tools, indent=2))
        return

    if args.tool:
        try:
            arguments = json.loads(args.args)
            result = await executor.call_tool(args.tool, arguments)
            print(json.dumps(result, indent=2))
        except Exception as e:
            print(f"Error calling tool: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        print("Use --list to see tools or --tool <name> --args <json> to call", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
`;
}

// Generate config for Python servers
function generatePythonConfig(serverName, serverConfig) {
  return JSON.stringify(
    {
      skill_name: serverName,
      command: serverConfig.command,
      args: serverConfig.args || [],
      env: serverConfig.env || {},
      description: serverConfig.description || "",
      pypi_package: serverConfig.pypiPackage || null,
      requires_path: serverConfig.requiresPath || false,
      path_flag: serverConfig.pathFlag || null,
      path_type: serverConfig.pathType || null,
      package_manager: "pypi",
      converted_at: new Date().toISOString(),
    },
    null,
    2
  );
}

// Generate executor for Docker-based servers (uses subprocess.Popen with JSON-RPC)
function generateDockerExecutor(serverName, serverConfig) {
  const className = serverName
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");

  const dockerImage = serverConfig.dockerImage || extractDockerImage(serverConfig);

  // Build environment variable check code
  const envVars = serverConfig.env || {};
  const envVarNames = Object.keys(envVars);
  const envAliases = serverConfig.envAliases || [];

  let envCheckCode = "";
  let getTokenCode = "";
  let tokenPassCode = "";

  if (envVarNames.length > 0) {
    const primaryVar = envVarNames[0];
    const allVars = [primaryVar, ...envAliases];

    envCheckCode = `
def check_env_token():
    """Check if required environment variable is set."""
    for var in ${JSON.stringify(allVars)}:
        if os.environ.get(var):
            return True
    return False


def get_env_token():
    """Get token from environment (checks aliases)."""
    for var in ${JSON.stringify(allVars)}:
        token = os.environ.get(var)
        if token:
            return token, var
    return None, None
`;

    getTokenCode = `
        if not check_env_token():
            raise RuntimeError(
                "${primaryVar} not set. "
                "Export it with: export ${primaryVar}=your_token"
            )

        self.token, self.token_var = get_env_token()
`;

    tokenPassCode = `
        # Add token to Docker command
        cmd.extend(["-e", f"${primaryVar}={self.token}"])
`;
  }

  // Build toolset support if available
  let toolsetCode = "";
  if (serverConfig.toolsets) {
    toolsetCode = `
        # Add toolset filtering if specified
        toolsets = os.environ.get("${serverName.toUpperCase().replace(/-/g, "_")}_TOOLSETS")
        if toolsets:
            cmd.extend(["-e", f"GITHUB_TOOLSETS={toolsets}"])
`;
  }

  return `"""
Executor for ${serverName} Skill - Handles dynamic MCP tool calls via Docker.

This executor connects to the ${serverName} MCP server running in Docker
and executes tool calls on-demand, outside of Claude's context window.

Usage:
    python executor.py --list              List available tools
    python executor.py --tool <name>       Call a tool
    python executor.py --tool <name> --args '{"key": "value"}'

Requirements:
    - Docker installed and running${envVarNames.length > 0 ? `\n    - ${envVarNames[0]} environment variable set` : ""}
"""

import json
import sys
import subprocess
import os
import time
from pathlib import Path
from typing import Any, Dict, List, Optional


def check_docker():
    """Check if Docker is available."""
    try:
        result = subprocess.run(
            ["docker", "--version"],
            capture_output=True,
            text=True,
            timeout=5
        )
        return result.returncode == 0
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return False

${envCheckCode}
class ${className}Executor:
    """Executor for ${serverName} MCP server tools via Docker using JSON-RPC."""

    def __init__(self, config_path: Optional[Path] = None):
        """Initialize executor with MCP server configuration."""
        if config_path is None:
            config_path = Path(__file__).parent / "config.json"

        with open(config_path, "r") as f:
            self.config = json.load(f)

        # Check prerequisites
        if not check_docker():
            raise RuntimeError("Docker is not available. Please install and start Docker.")
${getTokenCode}

    def _build_docker_cmd(self) -> List[str]:
        """Build the Docker command."""
        cmd = ["docker", "run", "-i", "--rm"]
${tokenPassCode}${toolsetCode}
        # Add the image
        cmd.append("${dockerImage}")
        return cmd

    def _send_jsonrpc(self, messages: List[Dict], wait_for_id: int = 2) -> List[Dict]:
        """Send JSON-RPC messages to the MCP server and get responses."""
        cmd = self._build_docker_cmd()

        # Start the process
        proc = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1  # Line buffered
        )

        responses = []
        try:
            # Send all messages
            for msg in messages:
                proc.stdin.write(json.dumps(msg) + "\\n")
                proc.stdin.flush()

            # Read responses until we get the one we're waiting for
            start_time = time.time()
            timeout = 30  # seconds
            found_response = False

            while time.time() - start_time < timeout and not found_response:
                line = proc.stdout.readline()
                if not line:
                    time.sleep(0.1)
                    continue

                line = line.strip()
                if line and line.startswith("{"):
                    try:
                        resp = json.loads(line)
                        responses.append(resp)
                        # Check if this is the response we're waiting for
                        if resp.get("id") == wait_for_id:
                            found_response = True
                    except json.JSONDecodeError:
                        pass

        except Exception as e:
            responses.append({"error": str(e)})
        finally:
            proc.stdin.close()
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()

        return responses

    def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Call an MCP tool with the given arguments."""
        messages = [
            {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {},
                    "clientInfo": {"name": "${serverName}-skill", "version": "1.0.0"}
                }
            },
            {
                "jsonrpc": "2.0",
                "method": "notifications/initialized"
            },
            {
                "jsonrpc": "2.0",
                "id": 2,
                "method": "tools/call",
                "params": {
                    "name": tool_name,
                    "arguments": arguments
                }
            }
        ]

        responses = self._send_jsonrpc(messages)

        # Find the tool call response
        for resp in responses:
            if resp.get("id") == 2:
                if "error" in resp:
                    return {
                        "content": [{"type": "text", "text": f"Error: {resp['error']}"}],
                        "isError": True
                    }
                result = resp.get("result", {})
                content = result.get("content", [])
                return {
                    "content": content,
                    "isError": result.get("isError", False)
                }

        return {
            "content": [{"type": "text", "text": "No response received"}],
            "isError": True
        }

    def list_tools(self) -> List[Dict[str, Any]]:
        """List all available tools from the MCP server."""
        messages = [
            {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {},
                    "clientInfo": {"name": "${serverName}-skill", "version": "1.0.0"}
                }
            },
            {
                "jsonrpc": "2.0",
                "method": "notifications/initialized"
            },
            {
                "jsonrpc": "2.0",
                "id": 2,
                "method": "tools/list",
                "params": {}
            }
        ]

        responses = self._send_jsonrpc(messages)

        # Find the tools list response
        for resp in responses:
            if resp.get("id") == 2:
                if "error" in resp:
                    return []
                result = resp.get("result", {})
                tools = result.get("tools", [])
                return [
                    {
                        "name": tool.get("name", ""),
                        "description": tool.get("description", ""),
                        "inputSchema": tool.get("inputSchema", {}),
                    }
                    for tool in tools
                ]

        return []


def main():
    """CLI entry point for executor."""
    import argparse

    parser = argparse.ArgumentParser(description="Execute ${serverName} MCP tools via Docker")
    parser.add_argument("--tool", help="Tool name to call")
    parser.add_argument("--args", help="Tool arguments as JSON", default="{}")
    parser.add_argument("--list", action="store_true", help="List available tools")
    parser.add_argument("--toolsets", help="Comma-separated toolsets to enable")

    args = parser.parse_args()

    # Set toolsets if provided
    if args.toolsets:
        os.environ["${serverName.toUpperCase().replace(/-/g, "_")}_TOOLSETS"] = args.toolsets

    try:
        executor = ${className}Executor()
    except RuntimeError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    if args.list:
        tools = executor.list_tools()
        print(json.dumps(tools, indent=2))
        return

    if args.tool:
        try:
            arguments = json.loads(args.args)
            result = executor.call_tool(args.tool, arguments)
            print(json.dumps(result, indent=2))
        except Exception as e:
            print(f"Error calling tool: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        print("Use --list to see tools or --tool <name> --args <json> to call", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
`;
}

// Generate config for Docker servers
function generateDockerConfig(serverName, serverConfig) {
  return JSON.stringify(
    {
      skill_name: serverName,
      command: serverConfig.command,
      args: serverConfig.args || [],
      env: serverConfig.env || {},
      description: serverConfig.description || "",
      docker_image: serverConfig.dockerImage || extractDockerImage(serverConfig),
      toolsets: serverConfig.toolsets || null,
      default_toolsets: serverConfig.defaultToolsets || null,
      package_manager: "docker",
      converted_at: new Date().toISOString(),
    },
    null,
    2
  );
}

function generateConfig(serverName, mcpConfig) {
  return JSON.stringify(
    {
      skill_name: serverName,
      command: mcpConfig.command,
      args: mcpConfig.args || [],
      env: mcpConfig.env || {},
      description: mcpConfig.description || "",
      converted_at: new Date().toISOString(),
    },
    null,
    2
  );
}

function convertServer(serverName, mcpConfig, catalogEntry, destDir, options) {
  const skillDir = path.join(destDir, serverName);

  // Check if exists
  if (fs.existsSync(skillDir) && !options.force) {
    return {
      server: serverName,
      status: "skipped",
      reason: "Already exists (use --force to overwrite)",
    };
  }

  if (options.dryRun) {
    return {
      server: serverName,
      status: "would_convert",
      destination: skillDir,
      packageManager: options.packageManager || "npm",
      catalogEntry: catalogEntry
        ? {
            tool_count: catalogEntry.tool_count,
            estimated_tokens: catalogEntry.estimated_tokens,
          }
        : null,
    };
  }

  // Create skill directory
  fs.mkdirSync(skillDir, { recursive: true });

  // Determine package type: Docker, Python, or Node.js
  const isDocker = mcpConfig.command === "docker" || mcpConfig.dockerImage;
  const isPython = mcpConfig.command === "python" || mcpConfig.pypiPackage;

  // Generate files based on package type
  const skillMd = generateSkillMd(serverName, mcpConfig, catalogEntry);

  let executor, config, packageManager;
  if (isDocker) {
    executor = generateDockerExecutor(serverName, mcpConfig);
    config = generateDockerConfig(serverName, mcpConfig);
    packageManager = "docker";
  } else if (isPython) {
    executor = generatePythonExecutor(serverName, mcpConfig);
    config = generatePythonConfig(serverName, mcpConfig);
    packageManager = "pypi";
  } else {
    executor = generateExecutor(serverName);
    config = generateConfig(serverName, mcpConfig);
    packageManager = "npm";
  }

  fs.writeFileSync(path.join(skillDir, "SKILL.md"), skillMd);
  fs.writeFileSync(path.join(skillDir, "executor.py"), executor);
  fs.writeFileSync(path.join(skillDir, "config.json"), config);

  return {
    server: serverName,
    status: "success",
    destination: skillDir,
    files: ["SKILL.md", "executor.py", "config.json"],
    packageManager: packageManager,
  };
}

function runTest(skillPath) {
  const testScript = path.join(__dirname, "test.cjs");

  console.log(`\n[TEST] Running tests on ${path.basename(skillPath)}...`);

  const result = spawnSync("node", [testScript, skillPath, "--introspect"], {
    stdio: "inherit",
    shell: true,
    timeout: 60000,
  });

  if (result.status === 0) {
    return { passed: true };
  } else {
    return { passed: false, exitCode: result.status };
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) usage(0);

  const mcpConfig = loadMcpConfig(args.mcpConfig);
  const catalog = loadCatalog(args.catalogPath);
  const servers = mcpConfig.mcpServers || {};

  // List known servers (built-in)
  if (args.knownServers) {
    console.log("Known MCP servers (built-in, no .mcp.json needed):\n");

    console.log("=== npm (Node.js) servers ===\n");
    for (const [name, config] of Object.entries(KNOWN_MCP_SERVERS)) {
      console.log(`  ${name}`);
      console.log(`      ${config.description}`);
      console.log(`      Command: ${config.command} ${config.args.join(" ")}`);
      if (config.env) {
        console.log(`      Env: ${Object.keys(config.env).join(", ")}`);
      }
    }

    console.log("\n=== PyPI (Python) servers ===\n");
    for (const [name, config] of Object.entries(KNOWN_PYPI_SERVERS)) {
      console.log(`  ${name}`);
      console.log(`      ${config.description}`);
      console.log(`      Package: ${config.pypiPackage}`);
      console.log(`      Command: ${config.command} ${config.args.join(" ")}`);
      if (config.env) {
        console.log(`      Env: ${Object.keys(config.env).join(", ")}`);
      }
      if (config.requiresPath) {
        console.log(`      Path: ${config.pathFlag} (auto-detected: ${config.pathType})`);
      }
    }

    console.log("\n=== Docker servers ===\n");
    for (const [name, config] of Object.entries(KNOWN_DOCKER_SERVERS)) {
      console.log(`  ${name}`);
      console.log(`      ${config.description}`);
      const dockerImage = config.dockerImage || extractDockerImage(config);
      console.log(`      Image: ${dockerImage}`);
      if (config.env) {
        console.log(`      Env: ${Object.keys(config.env).join(", ")}`);
      }
      if (config.toolsets) {
        console.log(`      Toolsets: ${config.toolsets.join(", ")}`);
      }
    }

    console.log("\nTo convert: node convert.cjs <server-name>");
    console.log("Example: node convert.cjs filesystem       # npm");
    console.log("         node convert.cjs git              # PyPI");
    console.log("         node convert.cjs github-official  # Docker");
    return;
  }

  // Convert from URL or known server name
  if (args.fromUrl) {
    const parsed = parseGitHubUrl(args.fromUrl);
    if (!parsed) {
      console.log(`[ERROR] Could not parse URL: ${args.fromUrl}`);
      console.log("Supported formats:");
      console.log("  - https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem");
      console.log("  - filesystem (known server shorthand)");
      process.exit(1);
    }

    const serverResult = getServerConfig(parsed.serverName, parsed);
    if (!serverResult) {
      console.log(`[ERROR] Unknown server: ${parsed.serverName}`);
      console.log("This server is not in the known servers list.");
      console.log("For third-party servers, add to .mcp.json first and use --server.");
      console.log("\nRun --known to see available servers.");
      process.exit(1);
    }

    let { config: serverConfig, source: packageSource } = serverResult;

    console.log(`[INFO] Converting: ${parsed.serverName}`);
    console.log(`       Command: ${serverConfig.command} ${serverConfig.args.join(" ")}`);
    console.log(`       Source: ${packageSource}`);

    // Check if package exists before converting (supports both npm and PyPI)
    if (!args.dryRun) {
      console.log(`[CHECK] Verifying package availability...`);
      const packageCheck = checkPackageExists(serverConfig);

      if (!packageCheck.exists) {
        console.log(`[ERROR] ${packageCheck.reason}`);
        console.log("");
        console.log("This MCP server package is not available.");
        console.log("");
        console.log("Options:");
        console.log("  1. Use a different server (run --known to see available)");
        console.log("  2. Clone the monorepo and run from source");
        console.log("  3. Check if there's an alternative package name");
        process.exit(1);
      }

      // Handle fallback from npm to PyPI
      if (packageCheck.fallbackFrom === "npm" && packageCheck.pypiPackage) {
        console.log(`[INFO] npm package not found, using PyPI: ${packageCheck.pypiPackage}`);
        // Update config to use Python instead
        const pypiServerName = parsed.serverName;
        if (KNOWN_PYPI_SERVERS[pypiServerName]) {
          serverConfig = KNOWN_PYPI_SERVERS[pypiServerName];
          packageSource = "pypi";
        } else {
          // Auto-generate PyPI config
          serverConfig = {
            command: "python",
            args: ["-m", packageCheck.pypiPackage.replace(/-/g, "_")],
            pypiPackage: packageCheck.pypiPackage,
            description: serverConfig.description || `${pypiServerName} MCP server`,
          };
          packageSource = "pypi";
        }
        console.log(`       Updated command: ${serverConfig.command} ${serverConfig.args.join(" ")}`);
      }

      if (packageCheck.warning) {
        console.log(`[WARN] ${packageCheck.warning}`);
      } else {
        console.log(`[CHECK] Package verified (${packageCheck.source || packageSource}) ✓`);
      }
    }

    const catalogEntry = getCatalogEntry(catalog, parsed.serverName);
    const result = convertServer(
      parsed.serverName,
      serverConfig,
      catalogEntry,
      args.dest,
      { force: args.force, dryRun: args.dryRun }
    );

    if (result.status === "success") {
      console.log(`[OK] Converted ${result.server} to ${result.destination}`);
      console.log(`     Files: ${result.files.join(", ")}`);

      if (args.test) {
        const testResult = runTest(result.destination);
        if (!testResult.passed) {
          console.log(`\n[WARN] Tests failed! The skill may not work correctly.`);
          console.log(`       Run manually: node scripts/test.cjs ${result.destination}`);
        }
      }
    } else if (result.status === "would_convert") {
      console.log(`[DRY-RUN] Would convert ${result.server} to ${result.destination}`);
    } else {
      console.log(`[SKIP] ${result.server}: ${result.reason}`);
    }
    return;
  }

  if (args.list) {
    console.log("Configured MCP servers (from .mcp.json):\n");
    for (const [name, config] of Object.entries(servers)) {
      const catalogEntry = getCatalogEntry(catalog, name);
      const eligible = shouldConvert(catalogEntry);
      const marker = eligible ? "✓" : "✗";
      const reason = catalogEntry?.keep_as_mcp
        ? "(keep as MCP)"
        : eligible
        ? "(eligible)"
        : "";
      console.log(`  ${marker} ${name} ${reason}`);
      if (config.description) {
        console.log(`      ${config.description.slice(0, 60)}...`);
      }
    }
    console.log(
      "\n✓ = eligible for conversion, ✗ = keep as MCP\n"
    );
    console.log("To convert: node convert.cjs --server <name>");
    console.log("\nTip: Use --known to see built-in servers that don't need .mcp.json");
    return;
  }

  if (args.catalog) {
    console.log("MCP Catalog entries:\n");
    for (const entry of catalog.mcp_servers) {
      const status = entry.keep_as_mcp ? "[keep as MCP]" : "[convert]";
      console.log(`  ${entry.name} ${status}`);
      console.log(`    Tools: ${entry.tool_count || "?"}, Tokens: ${entry.estimated_tokens || "?"}`);
      if (entry.description) {
        console.log(`    ${entry.description.slice(0, 60)}...`);
      }
    }
    return;
  }

  if (args.server) {
    const serverConfig = servers[args.server];
    if (!serverConfig) {
      console.error(`[ERROR] Server '${args.server}' not found in ${args.mcpConfig}`);
      console.error(`Available: ${Object.keys(servers).join(", ")}`);
      process.exit(1);
    }

    const catalogEntry = getCatalogEntry(catalog, args.server);
    const result = convertServer(
      args.server,
      serverConfig,
      catalogEntry,
      args.dest,
      { force: args.force, dryRun: args.dryRun }
    );

    if (result.status === "success") {
      console.log(`[OK] Converted ${result.server} to ${result.destination}`);
      console.log(`     Files: ${result.files.join(", ")}`);

      // Run tests automatically unless --no-test
      if (args.test) {
        const testResult = runTest(result.destination);
        if (!testResult.passed) {
          console.log(`\n[WARN] Tests failed! The skill may not work correctly.`);
          console.log(`       Run manually: node scripts/test.cjs ${result.destination}`);
        }
      }
    } else if (result.status === "would_convert") {
      console.log(`[DRY-RUN] Would convert ${result.server} to ${result.destination}`);
    } else {
      console.log(`[SKIP] ${result.server}: ${result.reason}`);
    }
    return;
  }

  if (args.all) {
    console.log("Converting all eligible MCP servers...\n");
    const results = [];

    for (const [name, config] of Object.entries(servers)) {
      const catalogEntry = getCatalogEntry(catalog, name);
      if (!shouldConvert(catalogEntry)) {
        console.log(`  [SKIP] ${name} (marked keep_as_mcp)`);
        continue;
      }

      const result = convertServer(name, config, catalogEntry, args.dest, {
        force: args.force,
        dryRun: args.dryRun,
      });
      results.push(result);

      if (result.status === "success") {
        console.log(`  [OK] ${name} → ${result.destination}`);
      } else if (result.status === "would_convert") {
        console.log(`  [DRY-RUN] ${name} → ${result.destination}`);
      } else {
        console.log(`  [SKIP] ${name}: ${result.reason}`);
      }
    }

    const successCount = results.filter((r) => r.status === "success").length;
    console.log(`\nConverted: ${successCount}`);
    console.log(`Skipped: ${results.filter((r) => r.status !== "success").length}`);

    // Run tests on all converted skills
    if (args.test && successCount > 0 && !args.dryRun) {
      console.log("\n--- Running Tests ---");
      let testsPassed = 0;
      let testsFailed = 0;

      for (const result of results) {
        if (result.status === "success") {
          const testResult = runTest(result.destination);
          if (testResult.passed) testsPassed++;
          else testsFailed++;
        }
      }

      console.log(`\nTest Summary: ${testsPassed}/${successCount} passed`);
      if (testsFailed > 0) {
        console.log(`[WARN] ${testsFailed} skill(s) failed tests`);
      }
    }
    return;
  }

  console.error("[ERROR] Specify --list, --server <name>, --all, or --catalog");
  usage(1);
}

main();
