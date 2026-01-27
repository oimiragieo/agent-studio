'use strict';

/**
 * Enforce CLAUDE.md Update Hook
 *
 * Validates that CLAUDE.md is updated when new agents/skills/workflows are created.
 * Triggers on: Write tool to .claude/agents/, .claude/skills/, .claude/workflows/
 *
 * This is a post-tool validation hook that provides warnings (not blocking).
 * It reminds agents to update CLAUDE.md routing tables when creating new
 * artifacts that need to be discoverable by the router.
 *
 * Environment:
 *   CLAUDE_MD_ENFORCEMENT=block|warn|off (default: warn)
 *
 * Exit codes:
 * - 0: Allow operation (with optional warning)
 * - 1: Block operation (when CLAUDE_MD_ENFORCEMENT=block)
 */

const fs = require('fs');
const path = require('path');

// Find project root by looking for .claude directory
function findProjectRoot() {
  let dir = __dirname;
  while (dir !== path.parse(dir).root) {
    if (fs.existsSync(path.join(dir, '.claude', 'CLAUDE.md'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return process.cwd();
}

const PROJECT_ROOT = findProjectRoot();
const ENFORCEMENT_MODE = process.env.CLAUDE_MD_ENFORCEMENT || 'warn';

// Paths that require CLAUDE.md update
const MONITORED_PATHS = ['.claude/agents/', '.claude/skills/', '.claude/workflows/'];

// CLAUDE.md location
const CLAUDE_MD_PATH = path.join(PROJECT_ROOT, '.claude', 'CLAUDE.md');

// Tools that create/modify files
const WRITE_TOOLS = ['Edit', 'Write'];

/**
 * Check if a path requires CLAUDE.md update
 * @param {string} filePath - The file path to check
 * @returns {boolean} True if the path is in a monitored directory
 */
function requiresClaudeMdUpdate(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  return MONITORED_PATHS.some(p => normalized.includes(p));
}

/**
 * Get the timestamp of CLAUDE.md
 * @returns {number} Modification time in milliseconds, or 0 if file doesn't exist
 */
function getClaudeMdTimestamp() {
  try {
    const stats = fs.statSync(CLAUDE_MD_PATH);
    return stats.mtimeMs;
  } catch {
    return 0;
  }
}

// Track CLAUDE.md timestamp at session start (module load time)
let sessionStartTimestamp = getClaudeMdTimestamp();

/**
 * Determine which section of CLAUDE.md should be updated based on file path
 * @param {string} filePath - The file path being modified
 * @returns {string} Description of which section to update
 */
function getSectionToUpdate(filePath) {
  const normalized = filePath.replace(/\\/g, '/');

  if (normalized.includes('.claude/agents/')) {
    return 'Section 3 (Agent Routing Table)';
  }
  if (normalized.includes('.claude/skills/')) {
    return 'Section 8.5+ (Workflow Enhancement Skills or Section 8.7 for new skills)';
  }
  if (normalized.includes('.claude/workflows/')) {
    return 'Section 8.6 (Enterprise Workflows)';
  }
  return 'appropriate section';
}

/**
 * Get artifact type from file path
 * @param {string} filePath - The file path being modified
 * @returns {string} Type of artifact (agent, skill, or workflow)
 */
function getArtifactType(filePath) {
  const normalized = filePath.replace(/\\/g, '/');

  if (normalized.includes('.claude/agents/')) return 'agent';
  if (normalized.includes('.claude/skills/')) return 'skill';
  if (normalized.includes('.claude/workflows/')) return 'workflow';
  return 'artifact';
}

/**
 * Parse hook input from Claude Code
 * @returns {Object|null} Parsed hook input or null
 */
function parseHookInput() {
  try {
    if (process.argv[2]) {
      return JSON.parse(process.argv[2]);
    }
  } catch (e) {
    // Fallback for testing or invalid input
  }
  return null;
}

/**
 * Extract file path from tool input
 * @param {Object} toolInput - The tool input object
 * @returns {string|null} The file path or null
 */
function getFilePath(toolInput) {
  if (!toolInput) return null;

  // Try common parameter names
  if (toolInput.file_path) return toolInput.file_path;
  if (toolInput.filePath) return toolInput.filePath;
  if (toolInput.path) return toolInput.path;

  return null;
}

/**
 * Validate hook - called after Write/Edit operations
 * This is the programmatic interface for use in tests or other hooks
 * @param {Object} context - Hook context with tool info
 * @returns {{ valid: boolean, error: string, warning?: string }}
 */
function validate(context) {
  const { tool, parameters } = context;

  // Only check Write/Edit operations
  if (tool !== 'Write' && tool !== 'Edit') {
    return { valid: true, error: '' };
  }

  const filePath = parameters?.file_path || parameters?.filePath || '';

  // Check if this write requires CLAUDE.md update
  if (!requiresClaudeMdUpdate(filePath)) {
    return { valid: true, error: '' };
  }

  // Check if CLAUDE.md was modified this session
  const currentTimestamp = getClaudeMdTimestamp();

  if (currentTimestamp <= sessionStartTimestamp) {
    const artifactType = getArtifactType(filePath);
    const section = getSectionToUpdate(filePath);

    // CLAUDE.md not updated - return warning (not blocking by default)
    return {
      valid: true,
      error: '',
      warning: `REMINDER: You created/modified a ${artifactType} at ${filePath}. Don't forget to update CLAUDE.md ${section}.`,
    };
  }

  // CLAUDE.md was updated this session
  return { valid: true, error: '' };
}

/**
 * Reset session tracking (call at session start)
 */
function resetSession() {
  sessionStartTimestamp = getClaudeMdTimestamp();
}

/**
 * Main execution for CLI hook usage
 */
function main() {
  // Skip if enforcement is off
  if (ENFORCEMENT_MODE === 'off') {
    process.exit(0);
  }

  const hookInput = parseHookInput();
  if (!hookInput) {
    process.exit(0);
  }

  // Get tool name and input
  const toolName = hookInput.tool_name || hookInput.tool;
  const toolInput = hookInput.tool_input || hookInput.input || {};

  // Only check write tools
  if (!WRITE_TOOLS.includes(toolName)) {
    process.exit(0);
  }

  // Get the file being modified
  const filePath = getFilePath(toolInput);
  if (!filePath) {
    process.exit(0);
  }

  // Check if this file requires CLAUDE.md update
  if (!requiresClaudeMdUpdate(filePath)) {
    process.exit(0);
  }

  // Normalize path for display
  const normalizedPath = path.normalize(filePath);
  const fileName = path.basename(normalizedPath);
  const artifactType = getArtifactType(filePath);
  const section = getSectionToUpdate(filePath);

  // Check if CLAUDE.md was modified this session
  const currentTimestamp = getClaudeMdTimestamp();

  if (currentTimestamp <= sessionStartTimestamp) {
    if (ENFORCEMENT_MODE === 'block') {
      console.log('\n' + '='.repeat(55));
      console.log(' CLAUDE.MD UPDATE REQUIRED - OPERATION BLOCKED');
      console.log('='.repeat(55));
      console.log(`\n  File: ${fileName}`);
      console.log(`  Type: ${artifactType}`);
      console.log(`\n  You created/modified a ${artifactType} but CLAUDE.md was not updated.`);
      console.log(`  The router won't know about this ${artifactType} without updating CLAUDE.md.`);
      console.log(`\n  Please update CLAUDE.md ${section} first.`);
      console.log(`\n  Set CLAUDE_MD_ENFORCEMENT=warn to allow anyway.`);
      console.log('='.repeat(55) + '\n');
      process.exit(1);
    } else {
      console.log('\n' + '-'.repeat(55));
      console.log(' REMINDER: Update CLAUDE.md');
      console.log('-'.repeat(55));
      console.log(`\n  You created/modified: ${fileName}`);
      console.log(`  Type: ${artifactType}`);
      console.log(`\n  Don't forget to update CLAUDE.md ${section}`);
      console.log(`  so the router can discover this ${artifactType}.`);
      console.log('-'.repeat(55) + '\n');
      process.exit(0);
    }
  }

  // CLAUDE.md was updated this session - all good
  process.exit(0);
}

// Run main if executed directly
if (require.main === module) {
  main();
}

// Export for programmatic use and testing
module.exports = {
  validate,
  resetSession,
  requiresClaudeMdUpdate,
  getArtifactType,
  getSectionToUpdate,
  MONITORED_PATHS,
};
