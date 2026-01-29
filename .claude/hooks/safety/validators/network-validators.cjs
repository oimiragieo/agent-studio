'use strict';

/**
 * Network command validators
 *
 * Validators for network and remote execution commands (curl, wget, ssh, nc, sudo, scp, rsync).
 * Prevents data exfiltration, remote code execution, and privilege escalation attacks.
 *
 * Security rationale:
 * - curl/wget: Can download and execute malicious code, exfiltrate data
 * - nc/netcat: Can create reverse shells, exfiltrate data
 * - ssh: Can access remote systems, tunnel traffic
 * - sudo: Can escalate privileges
 * - scp/rsync: Can transfer files to/from remote systems
 */

/**
 * Allowed domains for curl/wget downloads (safe package registries)
 * @type {Set<string>}
 */
const ALLOWED_DOWNLOAD_DOMAINS = new Set([
  // Package registries
  'registry.npmjs.org',
  'pypi.org',
  'files.pythonhosted.org',
  'crates.io',
  'static.crates.io',
  'rubygems.org',
  'packagist.org',
  'repo.maven.apache.org',
  'central.sonatype.com',

  // Version managers
  'raw.githubusercontent.com',
  'github.com',
  'objects.githubusercontent.com',

  // Language installers
  'nodejs.org',
  'python.org',
  'rustup.rs',
  'go.dev',

  // CDNs for dev tools
  'deb.nodesource.com',
  'dl.yarnpkg.com',
  'get.docker.com',

  // localhost for development
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
]);

/**
 * Dangerous curl/wget patterns that execute downloaded content
 * @type {RegExp[]}
 */
const DANGEROUS_PIPE_PATTERNS = [
  /\|\s*sh\b/, // | sh
  /\|\s*bash\b/, // | bash
  /\|\s*zsh\b/, // | zsh
  /\|\s*sudo\b/, // | sudo
  /\|\s*python\b/, // | python
  /\|\s*python3\b/, // | python3
  /\|\s*node\b/, // | node
  /\|\s*perl\b/, // | perl
  /\|\s*ruby\b/, // | ruby
  /\|\s*source\b/, // | source
  /\|\s*eval\b/, // | eval
  />\s*\/dev\/tcp\//, // >/dev/tcp/ (bash TCP redirect)
];

/**
 * Parse a command string into tokens, handling quotes.
 *
 * @param {string} commandString - The command string to parse
 * @returns {string[]|null} Array of tokens or null if parsing fails
 */
function parseCommand(commandString) {
  const tokens = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escaped = false;

  for (let i = 0; i < commandString.length; i++) {
    const char = commandString[i];

    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === '\\' && !inSingleQuote) {
      escaped = true;
      continue;
    }

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (char === ' ' && !inSingleQuote && !inDoubleQuote) {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (inSingleQuote || inDoubleQuote) {
    return null;
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

/**
 * Extract hostname from a URL
 *
 * @param {string} url - The URL to parse
 * @returns {string|null} The hostname or null if invalid
 */
function extractHostname(url) {
  try {
    // Handle URLs without protocol
    let urlToParse = url;
    if (!url.includes('://')) {
      urlToParse = 'https://' + url;
    }
    const parsed = new URL(urlToParse);
    return parsed.hostname;
  } catch (_e) {
    return null;
  }
}

/**
 * Check if command contains dangerous pipe patterns
 *
 * @param {string} commandString - The full command string
 * @returns {{dangerous: boolean, pattern: string}} Result
 */
function checkDangerousPipes(commandString) {
  for (const pattern of DANGEROUS_PIPE_PATTERNS) {
    if (pattern.test(commandString)) {
      return { dangerous: true, pattern: pattern.toString() };
    }
  }
  return { dangerous: false, pattern: '' };
}

/**
 * Validate curl commands - block piping to shell, restrict domains
 *
 * @param {string} commandString - The full curl command string
 * @returns {{valid: boolean, error: string}} Validation result
 */
function validateCurlCommand(commandString) {
  // Check for dangerous pipe patterns first (applies to full command)
  const pipeCheck = checkDangerousPipes(commandString);
  if (pipeCheck.dangerous) {
    return {
      valid: false,
      error: 'curl piped to shell interpreter is not allowed (remote code execution risk)',
    };
  }

  const tokens = parseCommand(commandString);

  if (tokens === null) {
    return { valid: false, error: 'Could not parse curl command' };
  }

  // Extract URLs from command
  const urls = [];
  let skipNext = false;

  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i];

    if (skipNext) {
      skipNext = false;
      continue;
    }

    // Skip flags that take arguments
    if (
      [
        '-o',
        '-O',
        '-d',
        '-H',
        '-X',
        '-u',
        '-A',
        '-e',
        '-b',
        '-c',
        '-F',
        '-T',
        '--data',
        '--header',
        '--output',
        '--user-agent',
      ].includes(token)
    ) {
      skipNext = true;
      continue;
    }

    // Skip single-letter flags and long flags
    if (token.startsWith('-')) {
      continue;
    }

    // This is likely a URL
    urls.push(token);
  }

  // Validate each URL
  for (const url of urls) {
    const hostname = extractHostname(url);

    if (hostname === null) {
      return { valid: false, error: `Invalid URL in curl command: ${url}` };
    }

    // Allow localhost and allowed domains
    if (!ALLOWED_DOWNLOAD_DOMAINS.has(hostname)) {
      return {
        valid: false,
        error: `curl to '${hostname}' is not allowed. Allowed domains: ${Array.from(ALLOWED_DOWNLOAD_DOMAINS).slice(0, 5).join(', ')}...`,
      };
    }
  }

  return { valid: true, error: '' };
}

/**
 * Validate wget commands - same restrictions as curl
 *
 * @param {string} commandString - The full wget command string
 * @returns {{valid: boolean, error: string}} Validation result
 */
function validateWgetCommand(commandString) {
  // Check for dangerous pipe patterns first
  const pipeCheck = checkDangerousPipes(commandString);
  if (pipeCheck.dangerous) {
    return {
      valid: false,
      error: 'wget piped to shell interpreter is not allowed (remote code execution risk)',
    };
  }

  const tokens = parseCommand(commandString);

  if (tokens === null) {
    return { valid: false, error: 'Could not parse wget command' };
  }

  // Extract URLs from command
  const urls = [];
  let skipNext = false;

  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i];

    if (skipNext) {
      skipNext = false;
      continue;
    }

    // Skip flags that take arguments
    if (
      ['-O', '-o', '-P', '-a', '--output-document', '--output-file', '--directory-prefix'].includes(
        token
      )
    ) {
      skipNext = true;
      continue;
    }

    // Skip flags
    if (token.startsWith('-')) {
      continue;
    }

    // This is likely a URL
    urls.push(token);
  }

  // Validate each URL
  for (const url of urls) {
    const hostname = extractHostname(url);

    if (hostname === null) {
      return { valid: false, error: `Invalid URL in wget command: ${url}` };
    }

    if (!ALLOWED_DOWNLOAD_DOMAINS.has(hostname)) {
      return {
        valid: false,
        error: `wget from '${hostname}' is not allowed. Use curl/wget only for known package registries.`,
      };
    }
  }

  return { valid: true, error: '' };
}

/**
 * Validate nc/netcat commands - block entirely (reverse shell risk)
 *
 * @param {string} commandString - The full nc command string
 * @returns {{valid: boolean, error: string}} Validation result
 */
function validateNcCommand(_commandString) {
  // netcat is too dangerous - can create reverse shells, exfiltrate data
  return {
    valid: false,
    error: 'nc/netcat is blocked (can be used for reverse shells and data exfiltration)',
  };
}

/**
 * Validate ssh commands - block by default (remote access risk)
 *
 * @param {string} commandString - The full ssh command string
 * @returns {{valid: boolean, error: string}} Validation result
 */
function validateSshCommand(commandString) {
  const tokens = parseCommand(commandString);

  if (tokens === null) {
    return { valid: false, error: 'Could not parse ssh command' };
  }

  // Block SSH entirely - it provides remote access
  // In a sandboxed dev environment, SSH should go through controlled channels
  return {
    valid: false,
    error: 'ssh is blocked for security. Use git over HTTPS or approved deployment tools.',
  };
}

/**
 * Validate sudo commands - block entirely (privilege escalation)
 *
 * @param {string} commandString - The full sudo command string
 * @returns {{valid: boolean, error: string}} Validation result
 */
function validateSudoCommand(_commandString) {
  // sudo allows privilege escalation - never allow in sandboxed environment
  return {
    valid: false,
    error: 'sudo is blocked (privilege escalation not allowed in sandboxed environment)',
  };
}

/**
 * Validate scp commands - block by default (remote file transfer)
 *
 * @param {string} commandString - The full scp command string
 * @returns {{valid: boolean, error: string}} Validation result
 */
function validateScpCommand(_commandString) {
  return {
    valid: false,
    error: 'scp is blocked for security. Use git or approved file transfer methods.',
  };
}

/**
 * Validate rsync commands - block remote syncs
 *
 * @param {string} commandString - The full rsync command string
 * @returns {{valid: boolean, error: string}} Validation result
 */
function validateRsyncCommand(commandString) {
  const tokens = parseCommand(commandString);

  if (tokens === null) {
    return { valid: false, error: 'Could not parse rsync command' };
  }

  // Check for remote destinations (user@host: or host:)
  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i];

    // Skip flags
    if (token.startsWith('-')) {
      continue;
    }

    // Check for remote path patterns
    if (token.includes('@') || (token.includes(':') && !token.startsWith('/'))) {
      return {
        valid: false,
        error: 'rsync to/from remote hosts is blocked. Local rsync only.',
      };
    }
  }

  // Allow local rsync operations
  return { valid: true, error: '' };
}

module.exports = {
  ALLOWED_DOWNLOAD_DOMAINS,
  DANGEROUS_PIPE_PATTERNS,
  extractHostname,
  checkDangerousPipes,
  validateCurlCommand,
  validateWgetCommand,
  validateNcCommand,
  validateNetcatCommand: validateNcCommand, // Alias
  validateSshCommand,
  validateSudoCommand,
  validateScpCommand,
  validateRsyncCommand,
};
