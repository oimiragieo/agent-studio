#!/usr/bin/env node
/**
 * Security Validation Hook (PreToolUse) - Cross-Platform
 *
 * Blocks dangerous commands and validates file operations
 * Converted from security-pre-tool.sh for Windows compatibility
 */

import { stdin, stdout, stderr } from 'process';

// Recursion protection - prevent hook from triggering itself
if (process.env.CLAUDE_SECURITY_HOOK_EXECUTING === 'true') {
  process.exit(0);
}
process.env.CLAUDE_SECURITY_HOOK_EXECUTING = 'true';

// Timeout protection - force exit after 1 second
const timeout = setTimeout(() => {
  stderr.write('[SECURITY HOOK] Timeout exceeded, allowing by default\n');
  stdout.write(JSON.stringify({ decision: 'allow', warning: 'Hook timeout' }));
  delete process.env.CLAUDE_SECURITY_HOOK_EXECUTING;
  process.exit(0);
}, 1000);

// Dangerous command patterns
const DANGEROUS_PATTERNS = [
  // File system destruction
  /rm\s+-rf\s+\//,
  /rm\s+-rf\s+~/,
  /rm\s+-rf\s+\*/,
  /sudo\s+rm/,
  /mkfs/,
  /dd\s+if=/,
  /format\s+/,
  />\s*\/dev\//,
  /chmod\s+777/,
  // Remote code execution via download
  /curl.*\|\s*bash/,
  /wget.*\|\s*bash/,
  /curl.*\|\s*sh/,
  /wget.*\|\s*sh/,
  // Arbitrary code execution via interpreters
  /python\s+-c/,
  /python3\s+-c/,
  /node\s+-e/,
  /perl\s+-e/,
  /ruby\s+-e/,
  // Obfuscated/encoded execution
  /base64.*\|.*bash/,
  /base64.*\|.*sh/,
  /eval\s+["\$]/,
  // PowerShell encoded/hidden commands (Windows)
  /powershell\s+-enc/,
  /powershell\s+-encodedcommand/,
  /powershell\s+-windowstyle\s+hidden/,
  /powershell\s+-noprofile\s+-executionpolicy\s+bypass/,
  // SQL injection / database destruction
  /DROP\s+DATABASE/i,
  /DROP\s+TABLE/i,
  /TRUNCATE\s+TABLE/i,
  /DELETE\s+FROM.*WHERE\s+1\s*=\s*1/i,
  // System control commands
  /shutdown/,
  /reboot/,
  /systemctl\s+stop/,
  /systemctl\s+disable/,
  /init\s+0/,
  /init\s+6/,
  // Network/firewall manipulation
  /iptables\s+-F/,
  /iptables\s+--flush/,
  /ufw\s+disable/,
];

// Sensitive file patterns
const SENSITIVE_FILE_PATTERNS = [
  /\.env($|\.local|\.production|\.secret)/,
  /(credentials|secrets|\.pem|\.key|id_rsa)/i,
];

/**
 * Read stdin asynchronously
 */
async function readStdin() {
  const chunks = [];
  for await (const chunk of stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

/**
 * Log to stderr
 */
function log(message) {
  stderr.write(`[security-pre-tool] ${message}\n`);
}

/**
 * Output JSON response
 */
function respond(decision, reason = null) {
  const response = { decision };
  if (reason) {
    response.reason = reason;
  }
  stdout.write(JSON.stringify(response));
}

/**
 * Main hook logic
 */
async function main() {
  try {
    // Read JSON from stdin
    const inputStr = await readStdin();

    if (!inputStr || inputStr.trim() === '') {
      respond('allow');
      process.exit(0);
    }

    const input = JSON.parse(inputStr);
    const toolName = input.tool_name || input.tool || '';
    const toolInput = input.tool_input || input.input || {};

    // Skip validation for TodoWrite and Task tools
    if (toolName === 'TodoWrite' || toolName === 'Task') {
      respond('allow');
      process.exit(0);
    }

    // For Bash tool, check command
    if (toolName === 'Bash') {
      const command = toolInput.command || '';

      // Check for dangerous patterns
      for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(command)) {
          const patternStr = pattern.source.substring(0, 50);
          respond('block', `Blocked dangerous command pattern: ${patternStr}`);
          process.exit(0);
        }
      }

      // Block force push to main/master
      if (/git\s+push.*(--force|-f).*(main|master)/.test(command)) {
        respond('block', 'Blocked force push to protected branch');
        process.exit(0);
      }
    }

    // For Edit/Write tools, protect sensitive files
    if (toolName === 'Edit' || toolName === 'Write') {
      const filePath = toolInput.file_path || toolInput.path || '';

      // Check for sensitive file patterns
      for (const pattern of SENSITIVE_FILE_PATTERNS) {
        if (pattern.test(filePath)) {
          respond('block', 'Blocked editing environment/secrets file');
          process.exit(0);
        }
      }
    }

    // Allow by default
    respond('allow');
    process.exit(0);
  } catch (error) {
    // On error, allow (fail open) but log warning
    log(`Error: ${error.message}`);
    respond('allow', `Security validator error: ${error.message}`);
    process.exit(0);
  } finally {
    clearTimeout(timeout);
    // Clean up recursion guard
    delete process.env.CLAUDE_SECURITY_HOOK_EXECUTING;
  }
}

main();
