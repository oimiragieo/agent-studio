#!/usr/bin/env node

/**
 * Repository Cleanup Script
 *
 * Removes temporary files and SLOP before committing:
 * - tmpclaude-* directories
 * - Malformed Windows path files
 * - AI logs and temporary outputs
 * - Test artifacts
 *
 * Usage:
 *   node .claude/tools/cleanup-repo.mjs --dry-run    # Preview deletions
 *   node .claude/tools/cleanup-repo.mjs --execute    # Actually delete
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

// CLI argument parsing
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isExecute = args.includes('--execute');
const skipConfirmation = args.includes('--yes') || args.includes('-y');

if (!isDryRun && !isExecute) {
  console.error('Error: Must specify --dry-run or --execute');
  console.error('Usage: node .claude/tools/cleanup-repo.mjs [--dry-run|--execute] [--yes]');
  process.exit(1);
}

// ============================================================================
// CLEANUP RULES
// ============================================================================

/**
 * Protected paths that should NEVER be deleted
 */
const PROTECTED_PATHS = [
  '.git',
  'node_modules',
  '.claude/rules-library',
  '.claude/rules-master',
  '.claude/agents',
  '.claude/skills',
  '.claude/workflows',
  '.claude/schemas',
  '.claude/templates',
  '.claude/docs',
  '.claude/system',
  'scripts',
  'src',
  'tests',
];

/**
 * File patterns to remove (relative to project root)
 */
const CLEANUP_PATTERNS = {
  // tmpclaude-* files and directories (200+ of them)
  tmpclaudeDirs: {
    pattern: 'tmpclaude-*',
    description: 'tmpclaude-* files and directories',
  },

  // Malformed Windows path files
  malformedPaths: {
    patterns: [
      'C:*',           // Files starting with C: (malformed Windows paths)
      'nul',           // Windows reserved names
      'con',
      'prn',
      'aux',
      'com[1-9]',
      'lpt[1-9]',
    ],
    description: 'Malformed Windows path files',
  },

  // Temporary files in .claude/context/tmp/
  claudeTempFiles: {
    pattern: '.claude/context/tmp/*.txt',
    description: 'Temporary files in .claude/context/tmp/',
  },

  // Old log files
  oldLogs: {
    patterns: [
      '*.log',
      '.claude/context/logs/*.log',
      '.claude/context/logs/*.txt',
    ],
    ageInHours: 168, // 7 days
    description: 'Log files older than 7 days',
  },

  // Files with tmp- prefix
  tmpPrefixFiles: {
    pattern: '**/tmp-*',
    ageInHours: 24,
    description: 'Files with tmp- prefix older than 24 hours',
  },

  // Test artifacts in root
  testArtifactsRoot: {
    pattern: 'validation-*.json',
    description: 'Test artifacts in root directory',
  },

  // Temporary working directories
  tempWorkingDirs: {
    pattern: '.claude/tools/tmpclaude-*',
    description: 'Temporary working directories',
  },

  // External dependencies in root (shouldn't be there)
  externalDeps: {
    patterns: [
      'crewAI-main/',
    ],
    description: 'External dependencies in root directory',
  },
};

/**
 * Files allowed in project root
 */
const ROOT_ALLOWLIST = new Set([
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
]);

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if path is protected (should never be deleted)
 */
function isProtectedPath(filePath) {
  const relativePath = path.relative(projectRoot, filePath);

  for (const protectedPath of PROTECTED_PATHS) {
    if (relativePath === protectedPath || relativePath.startsWith(protectedPath + path.sep)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if file is older than specified hours
 */
function isOlderThan(filePath, hours) {
  try {
    const stats = fs.statSync(filePath);
    const ageInMs = Date.now() - stats.mtimeMs;
    const ageInHours = ageInMs / (1000 * 60 * 60);
    return ageInHours > hours;
  } catch (error) {
    // If file doesn't exist or can't be accessed, consider it not old
    return false;
  }
}

/**
 * Get file size in bytes
 */
function getFileSize(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return stats.isDirectory() ? getDirSize(filePath) : stats.size;
  } catch (error) {
    return 0;
  }
}

/**
 * Get directory size recursively
 */
function getDirSize(dirPath) {
  let size = 0;

  try {
    const items = fs.readdirSync(dirPath);

    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stats = fs.statSync(itemPath);

      if (stats.isDirectory()) {
        size += getDirSize(itemPath);
      } else {
        size += stats.size;
      }
    }
  } catch (error) {
    // Ignore errors
  }

  return size;
}

/**
 * Format bytes to human-readable size
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Detect malformed Windows paths
 */
function isMalformedWindowsPath(filePath) {
  const basename = path.basename(filePath);

  // Check for patterns like "C:devprojects" (missing separator)
  if (/^C:[a-zA-Z]/.test(basename) && !/^C:[\\\/]/.test(basename)) {
    return true;
  }

  // Check for concatenated segments (no separators)
  if (/[a-z]{3,}[A-Z][a-z]/.test(basename) && !/[\/\\]/.test(basename)) {
    return true;
  }

  // Check for Windows reserved names
  const reservedNames = ['nul', 'con', 'prn', 'aux', 'com1', 'com2', 'com3', 'com4', 'com5', 'com6', 'com7', 'com8', 'com9', 'lpt1', 'lpt2', 'lpt3', 'lpt4', 'lpt5', 'lpt6', 'lpt7', 'lpt8', 'lpt9'];
  if (reservedNames.includes(basename.toLowerCase())) {
    return true;
  }

  return false;
}

/**
 * Ask user for confirmation
 */
async function askConfirmation(message) {
  if (skipConfirmation) {
    return true;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Delete file or directory
 */
function deleteItem(itemPath) {
  try {
    const stats = fs.statSync(itemPath);

    if (stats.isDirectory()) {
      fs.rmSync(itemPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(itemPath);
    }

    return true;
  } catch (error) {
    console.error(`Error deleting ${itemPath}: ${error.message}`);
    return false;
  }
}

// ============================================================================
// SCANNING FUNCTIONS
// ============================================================================

/**
 * Find all tmpclaude-* files and directories
 */
async function findTmpClaudeDirs() {
  const results = [];

  try {
    // Search in root (both files and directories)
    const pattern = path.join(projectRoot, 'tmpclaude-*').replace(/\\/g, '/');
    const matches = await glob(pattern, {
      absolute: true,
      dot: false,
      ignore: PROTECTED_PATHS.map(p => `**/${p}/**`),
    });

    for (const match of matches) {
      if (!isProtectedPath(match)) {
        results.push(match);
      }
    }

    // Also check .claude/tools/
    const toolsPattern = path.join(projectRoot, '.claude', 'tools', 'tmpclaude-*').replace(/\\/g, '/');
    const toolsMatches = await glob(toolsPattern, {
      absolute: true,
      dot: false,
    });

    for (const match of toolsMatches) {
      if (!isProtectedPath(match)) {
        results.push(match);
      }
    }
  } catch (error) {
    console.error(`Error finding tmpclaude files/directories: ${error.message}`);
  }

  return results;
}

/**
 * Find malformed Windows path files
 */
async function findMalformedPaths() {
  const results = [];

  try {
    // Get all files in root
    const items = fs.readdirSync(projectRoot);

    for (const item of items) {
      const itemPath = path.join(projectRoot, item);

      // Skip directories and protected paths
      try {
        const stats = fs.statSync(itemPath);
        if (stats.isDirectory() || isProtectedPath(itemPath)) {
          continue;
        }
      } catch (error) {
        // If we can't stat the file, it might be a malformed path
        // Try to access it anyway
      }

      // Check if malformed
      if (isMalformedWindowsPath(itemPath)) {
        results.push(itemPath);
      }
    }

    // Also look for UTF-8 encoded malformed paths (like C\357\200\272devprojects...)
    // These appear in git status but might be hard to find with normal filesystem operations
    // Use glob to find any file starting with 'C' that isn't a normal filename
    const suspiciousPattern = path.join(projectRoot, 'C*').replace(/\\/g, '/');
    const suspiciousMatches = await glob(suspiciousPattern, {
      absolute: true,
      dot: false,
      ignore: PROTECTED_PATHS.map(p => `**/${p}/**`),
    });

    for (const match of suspiciousMatches) {
      const basename = path.basename(match);

      // If it starts with C and contains strange characters or patterns
      const utf8Marker = String.fromCharCode(0xef); // UTF-8 marker character
      if (basename.startsWith('C') && (
        /C[^a-zA-Z0-9_.-]/.test(basename) || // C followed by non-standard char
        basename.includes(utf8Marker) || // UTF-8 encoded marker
        basename.length > 100 // Suspiciously long
      )) {
        if (!results.includes(match) && !isProtectedPath(match)) {
          results.push(match);
        }
      }
    }
  } catch (error) {
    console.error(`Error finding malformed paths: ${error.message}`);
  }

  return results;
}

/**
 * Find temporary files in .claude/context/tmp/
 */
async function findClaudeTempFiles() {
  const results = [];

  try {
    const tmpDir = path.join(projectRoot, '.claude', 'context', 'tmp');

    if (!fs.existsSync(tmpDir)) {
      return results;
    }

    const pattern = path.join(tmpDir, '*.txt').replace(/\\/g, '/');
    const matches = await glob(pattern, {
      absolute: true,
      dot: false,
    });

    for (const match of matches) {
      if (!isProtectedPath(match)) {
        results.push(match);
      }
    }
  } catch (error) {
    console.error(`Error finding claude temp files: ${error.message}`);
  }

  return results;
}

/**
 * Find old log files
 */
async function findOldLogs() {
  const results = [];

  try {
    // Root log files
    const rootPattern = path.join(projectRoot, '*.log').replace(/\\/g, '/');
    const rootMatches = await glob(rootPattern, {
      absolute: true,
      dot: false,
      ignore: PROTECTED_PATHS.map(p => `**/${p}/**`),
    });

    for (const match of rootMatches) {
      if (!isProtectedPath(match) && isOlderThan(match, 168)) {
        results.push(match);
      }
    }

    // .claude/context/logs/ files
    const logsDir = path.join(projectRoot, '.claude', 'context', 'logs');
    if (fs.existsSync(logsDir)) {
      const logsPattern = path.join(logsDir, '*').replace(/\\/g, '/');
      const logsMatches = await glob(logsPattern, {
        absolute: true,
        dot: false,
      });

      for (const match of logsMatches) {
        if (!isProtectedPath(match) && isOlderThan(match, 168)) {
          results.push(match);
        }
      }
    }
  } catch (error) {
    console.error(`Error finding old logs: ${error.message}`);
  }

  return results;
}

/**
 * Find files with tmp- prefix
 */
async function findTmpPrefixFiles() {
  const results = [];

  try {
    const pattern = path.join(projectRoot, '**', 'tmp-*').replace(/\\/g, '/');
    const matches = await glob(pattern, {
      absolute: true,
      dot: false,
      ignore: PROTECTED_PATHS.map(p => `**/${p}/**`),
    });

    for (const match of matches) {
      if (!isProtectedPath(match) && isOlderThan(match, 24)) {
        results.push(match);
      }
    }
  } catch (error) {
    console.error(`Error finding tmp- prefix files: ${error.message}`);
  }

  return results;
}

/**
 * Find test artifacts in root
 */
async function findTestArtifactsRoot() {
  const results = [];

  try {
    const pattern = path.join(projectRoot, 'validation-*.json').replace(/\\/g, '/');
    const matches = await glob(pattern, {
      absolute: true,
      dot: false,
    });

    for (const match of matches) {
      if (!isProtectedPath(match)) {
        results.push(match);
      }
    }
  } catch (error) {
    console.error(`Error finding test artifacts: ${error.message}`);
  }

  return results;
}

/**
 * Find external dependencies in root
 */
async function findExternalDeps() {
  const results = [];

  try {
    const patterns = CLEANUP_PATTERNS.externalDeps.patterns;

    for (const pattern of patterns) {
      const fullPattern = path.join(projectRoot, pattern).replace(/\\/g, '/');
      const matches = await glob(fullPattern, {
        absolute: true,
        dot: false,
      });

      for (const match of matches) {
        if (!isProtectedPath(match)) {
          results.push(match);
        }
      }
    }
  } catch (error) {
    console.error(`Error finding external dependencies: ${error.message}`);
  }

  return results;
}

// ============================================================================
// MAIN CLEANUP LOGIC
// ============================================================================

async function runCleanup() {
  console.log('Repository Cleanup Script');
  console.log('========================\n');

  if (isDryRun) {
    console.log('[DRY RUN MODE] - No files will be deleted\n');
  } else {
    console.log('[EXECUTE MODE] - Files will be permanently deleted\n');
  }

  console.log('Scanning for temporary files...\n');

  // Collect all files to delete
  const filesToDelete = {
    tmpclaudeDirs: await findTmpClaudeDirs(),
    malformedPaths: await findMalformedPaths(),
    claudeTempFiles: await findClaudeTempFiles(),
    oldLogs: await findOldLogs(),
    tmpPrefixFiles: await findTmpPrefixFiles(),
    testArtifactsRoot: await findTestArtifactsRoot(),
    externalDeps: await findExternalDeps(),
  };

  // Calculate statistics
  let totalFiles = 0;
  let totalSize = 0;

  console.log('Found:\n');

  for (const [category, files] of Object.entries(filesToDelete)) {
    const count = files.length;
    const size = files.reduce((sum, file) => sum + getFileSize(file), 0);

    totalFiles += count;
    totalSize += size;

    const categoryName = CLEANUP_PATTERNS[category]?.description || category;
    console.log(`- ${count} ${categoryName} (${formatBytes(size)})`);
  }

  console.log(`\nTotal: ${totalFiles} files/directories`);
  console.log(`Total space to reclaim: ${formatBytes(totalSize)}\n`);

  if (totalFiles === 0) {
    console.log('No files to clean up. Repository is already clean!');
    return 0;
  }

  if (isDryRun) {
    console.log('[DRY RUN] Would delete the following files:\n');

    for (const [category, files] of Object.entries(filesToDelete)) {
      if (files.length > 0) {
        const categoryName = CLEANUP_PATTERNS[category]?.description || category;
        console.log(`${categoryName}:`);

        // Show first 10 files, then summarize
        const displayFiles = files.slice(0, 10);
        for (const file of displayFiles) {
          const relativePath = path.relative(projectRoot, file);
          console.log(`  - ${relativePath}`);
        }

        if (files.length > 10) {
          console.log(`  ... and ${files.length - 10} more\n`);
        } else {
          console.log('');
        }
      }
    }

    console.log('\nRun with --execute to perform cleanup');
    return 0;
  }

  // Execute mode - confirm before deleting
  if (totalFiles > 100) {
    const confirmed = await askConfirmation(
      `\nYou are about to delete ${totalFiles} files/directories. Continue?`
    );

    if (!confirmed) {
      console.log('Cleanup cancelled.');
      return 0;
    }
  }

  console.log('\nDeleting files...\n');

  let deletedCount = 0;
  let failedCount = 0;

  for (const [category, files] of Object.entries(filesToDelete)) {
    for (const file of files) {
      const relativePath = path.relative(projectRoot, file);

      if (deleteItem(file)) {
        console.log(`✓ Deleted: ${relativePath}`);
        deletedCount++;
      } else {
        console.log(`✗ Failed: ${relativePath}`);
        failedCount++;
      }
    }
  }

  console.log(`\nCleanup complete!`);
  console.log(`- Successfully deleted: ${deletedCount} files/directories`);
  console.log(`- Failed: ${failedCount} files/directories`);
  console.log(`- Space reclaimed: ${formatBytes(totalSize)}`);

  return failedCount > 0 ? 1 : 0;
}

// ============================================================================
// ENTRY POINT
// ============================================================================

runCleanup()
  .then((exitCode) => {
    process.exit(exitCode);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
