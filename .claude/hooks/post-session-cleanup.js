#!/usr/bin/env node
/**
 * Post-Session Cleanup Hook (PostToolUse)
 * 
 * Layer 4: Auto-remove files matching SLOP patterns after session
 * 
 * Cleans up:
 * - Files in root directory (except allowlist)
 * - Files with malformed paths (nul, concatenated paths)
 * - Temporary files created during session
 * 
 * Usage: Configured as PostToolUse hook in Claude Code settings
 * Note: Runs after each tool execution to catch SLOP immediately
 */

import { unlink, readdir, stat, readFile, writeFile, mkdir } from 'fs/promises';
import { join, resolve, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// SLOP patterns to detect and clean
const SLOP_PATTERNS = [
  /^nul$/i,  // Windows nul file
  /^con$/i,  // Windows con file
  /^prn$/i,  // Windows prn file
  /^aux$/i,  // Windows aux file
  /^C[a-zA-Z][^:\\\/]/,  // Malformed Windows path
  /^[A-Z][a-z]+[A-Z].*\.md$/,  // Concatenated paths
];

// Root allowlist (same as file-path-validator)
const ROOT_ALLOWLIST = [
  'package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock',
  'README.md', 'GETTING_STARTED.md', 'LICENSE', '.gitignore',
  '.npmrc', '.nvmrc', '.editorconfig', 'tsconfig.json',
  'eslint.config.js', '.eslintrc.json', 'prettier.config.js', '.prettierrc',
  'CHANGELOG.md', 'CONTRIBUTING.md', 'CODE_OF_CONDUCT.md', 'SECURITY.md'
];

// Cleanup log path
const CLEANUP_LOG = join(__dirname, '..', 'context', 'cleanup-log.json');

/**
 * Check if file matches SLOP pattern
 */
function matchesSlopPattern(filename) {
  return SLOP_PATTERNS.some(pattern => pattern.test(filename));
}

/**
 * Check if file is in root directory
 */
function isInRoot(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(p => p && p !== '.');
  return parts.length === 1;
}

/**
 * Load cleanup log
 */
async function loadCleanupLog() {
  try {
    if (existsSync(CLEANUP_LOG)) {
      const content = await readFile(CLEANUP_LOG, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    // Return empty log on error
  }
  return { cleaned_files: [], last_cleanup: null };
}

/**
 * Save cleanup log
 */
async function saveCleanupLog(log) {
  try {
    const logDir = dirname(CLEANUP_LOG);
    if (!existsSync(logDir)) {
      await mkdir(logDir, { recursive: true });
    }
    await writeFile(CLEANUP_LOG, JSON.stringify(log, null, 2), 'utf-8');
  } catch (error) {
    // Fail silently - logging is not critical
  }
}

/**
 * Cleanup file if it matches SLOP patterns
 */
async function cleanupFile(filePath) {
  try {
    const filename = basename(filePath);
    const projectRoot = resolve(__dirname, '../..');
    const fullPath = resolve(projectRoot, filePath);
    
    // Check if file exists
    if (!existsSync(fullPath)) {
      return null; // File doesn't exist, nothing to clean
    }
    
    let shouldClean = false;
    let reason = '';
    
    // Check SLOP patterns
    if (matchesSlopPattern(filename)) {
      shouldClean = true;
      reason = 'matches_slop_pattern';
    }
    
    // Check root directory violation
    if (isInRoot(filePath) && !ROOT_ALLOWLIST.includes(filename)) {
      shouldClean = true;
      reason = 'root_directory_violation';
    }
    
    if (shouldClean) {
      await unlink(fullPath);
      return {
        file: filePath,
        reason: reason,
        cleaned_at: new Date().toISOString()
      };
    }
    
    return null;
  } catch (error) {
    // Fail silently - don't block on cleanup errors
    return null;
  }
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
    
    // Only cleanup after Write operations
    if (toolName === 'Write') {
      const filePath = toolInput.file_path || toolInput.path || '';
      
      if (filePath) {
        const cleaned = await cleanupFile(filePath);
        
        if (cleaned) {
          // Log cleanup
          const log = await loadCleanupLog();
          log.cleaned_files.push(cleaned);
          log.last_cleanup = new Date().toISOString();
          await saveCleanupLog(log);
          
          // Output warning (non-blocking)
          console.error(JSON.stringify({
            action: 'cleaned',
            file: cleaned.file,
            reason: cleaned.reason,
            message: `Cleaned up SLOP file: ${cleaned.file} (${cleaned.reason})`
          }));
        }
      }
    }
    
    // Always allow (this is post-execution, non-blocking)
    process.exit(0);
    
  } catch (error) {
    // Fail silently - cleanup is non-critical
    process.exit(0);
  }
}

main();
