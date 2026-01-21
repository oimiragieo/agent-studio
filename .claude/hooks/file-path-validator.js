#!/usr/bin/env node
/**
 * File Path Validator Hook (PreToolUse)
 *
 * Layer 1: Hard block malformed paths and root directory violations
 *
 * Validates:
 * - Malformed Windows paths (Cdevprojects...)
 * - Windows reserved names (nul, con, prn, aux)
 * - Concatenated path segments
 * - Root directory violations (except allowlist)
 * - Bash file creation redirects (Layer 2)
 *
 * Usage: Configured as PreToolUse hook in Claude Code settings
 */

import { readFileSync } from 'fs';
import { resolve, dirname, basename, join } from 'path';
import { fileURLToPath } from 'url';

// Recursion protection - prevent hook from triggering itself
if (process.env.CLAUDE_PATH_VALIDATOR_EXECUTING === 'true') {
  console.log(JSON.stringify({ decision: 'approve' }));
  process.exit(0);
}
process.env.CLAUDE_PATH_VALIDATOR_EXECUTING = 'true';

// Timeout protection - force exit after 1 second
const timeout = setTimeout(() => {
  console.error('[PATH VALIDATOR] Timeout exceeded, allowing by default');
  console.log(JSON.stringify({ decision: 'approve', warning: 'Hook timeout' }));
  process.exit(0);
}, 1000);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load root allowlist from schema
const SCHEMA_PATH = resolve(__dirname, '..', 'schemas', 'file-location.schema.json');
const ROOT_ALLOWLIST = [
  'package.json',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'README.md',
  'GETTING_STARTED.md',
  'LICENSE',
  '.gitignore',
  '.npmrc',
  '.nvmrc',
  '.editorconfig',
  'tsconfig.json',
  'eslint.config.js',
  '.eslintrc.json',
  'prettier.config.js',
  '.prettierrc',
  'CHANGELOG.md',
  'CONTRIBUTING.md',
  'CODE_OF_CONDUCT.md',
  'SECURITY.md',
];

// Load allowlist from schema if available
let rootAllowlist = ROOT_ALLOWLIST;
try {
  const schemaContent = readFileSync(SCHEMA_PATH, 'utf-8');
  const schema = JSON.parse(schemaContent);
  if (schema.properties?.root_allowlist?.default) {
    rootAllowlist = schema.properties.root_allowlist.default;
  }
} catch (error) {
  // Use default allowlist if schema not found
}

// Malformed path patterns
const MALFORMED_PATTERNS = [
  /^C[a-zA-Z][^:\\\/]/, // Malformed Windows path (missing separator)
  /^(nul|con|prn|aux)$/i, // Windows reserved names
  /^[A-Z][a-z]+[A-Z].*\.md$/, // Concatenated path segments
  /[a-z]{4,}[A-Z][a-z].*[a-z]{4,}[A-Z]/, // Multiple concatenated segments
];

// Prohibited directories
const PROHIBITED_DIRS = [
  'node_modules/',
  '.git/',
  'dist/',
  'build/',
  'out/',
  '.next/',
  '.nuxt/',
  'coverage/',
];

/**
 * Check if path is in project root
 */
function isRootPath(filePath) {
  // Normalize path separators
  const normalized = filePath.replace(/\\/g, '/');
  // Check if path has no directory separators (except leading ./)
  const parts = normalized.split('/').filter(p => p);
  return parts.length === 1 || (parts.length === 2 && parts[0] === '.');
}

/**
 * Get filename from path
 */
function getFilename(filePath) {
  return basename(filePath);
}

/**
 * Suggest correct path
 */
function suggestPath(filePath, reason) {
  const filename = getFilename(filePath);

  if (reason === 'root_violation') {
    // Suggest .claude/context/reports/ or .claude/context/tasks/ based on filename
    if (
      filename.includes('report') ||
      filename.includes('audit') ||
      filename.includes('analysis')
    ) {
      return `.claude/context/reports/${filename}`;
    } else if (filename.includes('task') || filename.includes('todo')) {
      return `.claude/context/tasks/${filename}`;
    } else {
      return `.claude/context/artifacts/${filename}`;
    }
  }

  if (reason === 'malformed_path') {
    // Try to reconstruct path
    // Common pattern: CdevprojectsLLM-RULES.claude... → .claude/...
    if (filePath.includes('.claude')) {
      const match = filePath.match(/\.claude[^\/]*\/(.+)/);
      if (match) {
        return `.claude/${match[1]}`;
      }
    }
    // Default suggestion
    return `.claude/context/artifacts/${filename}`;
  }

  return null;
}

/**
 * Validate file path
 */
function validateFilePath(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return { valid: true }; // Skip validation if no path
  }

  // Normalize path
  const normalized = filePath.replace(/\\/g, '/').trim();

  // Check malformed patterns
  for (const pattern of MALFORMED_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        valid: false,
        reason: 'malformed_path',
        message: `BLOCKED: Malformed file path detected. Path appears to have missing separators or corrupted Windows path format.`,
        suggested_path: suggestPath(normalized, 'malformed_path'),
      };
    }
  }

  // Check root directory violations
  if (isRootPath(normalized)) {
    const filename = getFilename(normalized);
    if (!rootAllowlist.includes(filename)) {
      return {
        valid: false,
        reason: 'root_violation',
        message: `BLOCKED: File "${filename}" not allowed in project root. Use appropriate .claude/ subdirectory. See .claude/rules/subagent-file-rules.md for correct locations.`,
        suggested_path: suggestPath(normalized, 'root_violation'),
      };
    }
  }

  // Check prohibited directories
  for (const prohibited of PROHIBITED_DIRS) {
    if (normalized.startsWith(prohibited) || normalized.includes(`/${prohibited}`)) {
      return {
        valid: false,
        reason: 'prohibited_directory',
        message: `BLOCKED: Cannot write to prohibited directory "${prohibited}". This location is reserved for build outputs or version control.`,
        suggested_path: `.claude/context/artifacts/${getFilename(normalized)}`,
      };
    }
  }

  return { valid: true };
}

/**
 * Detect Bash file creation redirects
 */
function detectBashFileCreation(command) {
  if (!command || typeof command !== 'string') {
    return null;
  }

  // Patterns: echo "..." > file.md, cat <<EOF > file.md
  const patterns = [
    /echo\s+["'].*["']\s*>\s+[^\s&|;]+/,
    /cat\s+<<\s*\w+\s*>\s+[^\s&|;]+/,
    /printf\s+.*\s*>\s+[^\s&|;]+/,
  ];

  for (const pattern of patterns) {
    if (pattern.test(command)) {
      // Extract filename
      const match = command.match(/>\s+([^\s&|;]+)/);
      const filename = match ? match[1].trim() : 'file';
      return {
        detected: true,
        filename: filename,
        message: `BLOCKED: File creation via Bash redirects is blocked. Use Write tool instead.`,
      };
    }
  }

  return null;
}

/**
 * Main hook logic
 */
async function main() {
  try {
    // Read JSON from stdin
    let input = '';
    for await (const chunk of process.stdin) {
      input += chunk.toString();
    }

    const data = JSON.parse(input);
    const toolName = data.tool_name || '';
    const toolInput = data.tool_input || {};

    // Skip validation for TodoWrite and Task tools
    if (toolName === 'TodoWrite' || toolName === 'Task') {
      console.log(JSON.stringify({ decision: 'approve' }));
      process.exit(0);
    }

    // Layer 2: Block Bash file creation
    if (toolName === 'Bash') {
      const command = toolInput.command || '';
      const bashFileCreation = detectBashFileCreation(command);

      if (bashFileCreation?.detected) {
        const response = {
          decision: 'block',
          reason: bashFileCreation.message,
          suggested_action: `Use Write tool to create ${bashFileCreation.filename} instead of Bash redirects.`,
        };
        console.log(JSON.stringify(response));
        process.exit(0);
      }
    }

    // Layer 1 & 3: Validate file paths for Write/Edit
    if (toolName === 'Write' || toolName === 'Edit') {
      const filePath = toolInput.file_path || toolInput.path || '';

      if (filePath) {
        const validation = validateFilePath(filePath);

        if (!validation.valid) {
          const response = {
            decision: 'block',
            reason: validation.message,
            suggested_path: validation.suggested_path,
          };
          console.log(JSON.stringify(response));
          process.exit(0);
        }
      }
    }

    // Allow by default
    console.log(JSON.stringify({ decision: 'approve' }));
    process.exit(0);
  } catch (error) {
    // On error, allow (fail open) but log warning
    console.error(
      JSON.stringify({
        decision: 'approve',
        warning: `Path validator error: ${error.message}`,
      })
    );
    process.exit(0);
  } finally {
    clearTimeout(timeout);
    // Clean up recursion guard
    delete process.env.CLAUDE_PATH_VALIDATOR_EXECUTING;
  }
}

main();
