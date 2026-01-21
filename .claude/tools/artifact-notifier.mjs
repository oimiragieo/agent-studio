#!/usr/bin/env node

/**
 * Artifact Notification System
 *
 * Scans for new artifacts and displays formatted notifications.
 * Called automatically by post-task hook and orchestrator.
 *
 * Usage:
 *   node .claude/tools/artifact-notifier.mjs [--since <seconds>] [--path <directory>]
 */

import { readdir, stat, readFile } from 'fs/promises';
import { join, relative, basename } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '../..');

/**
 * Main notification function
 */
async function notifyArtifacts(options = {}) {
  const { maxAgeSeconds = 60, searchPath = join(PROJECT_ROOT, '.claude', 'context') } = options;

  const artifacts = await scanForRecentArtifacts(searchPath, maxAgeSeconds);

  if (artifacts.length === 0) {
    return; // No notification needed
  }

  displayNotification(artifacts);
}

/**
 * Display formatted notification
 */
function displayNotification(artifacts) {
  console.log('\n');
  console.log('┌─────────────────────────────────────────────────────────────────┐');
  console.log('│  🎯 NEW ARTIFACTS CREATED                                       │');
  console.log('└─────────────────────────────────────────────────────────────────┘');
  console.log('');

  artifacts.forEach((artifact, index) => {
    const relPath = relative(PROJECT_ROOT, artifact.path);
    const fileName = basename(artifact.path);
    const sizeKB = (artifact.size / 1024).toFixed(1);
    const timestamp = artifact.modified.toISOString().replace('T', ' ').slice(0, 19);

    console.log(`  ${index + 1}. ${fileName}`);
    console.log(`     Location: ${relPath}`);
    console.log(`     Size: ${sizeKB} KB`);
    console.log(`     Created: ${timestamp}`);

    if (artifact.summary) {
      const summaryLines = artifact.summary.split('\n');
      console.log(`     Summary: ${summaryLines[0]}`);
      if (summaryLines.length > 1) {
        summaryLines.slice(1, 3).forEach(line => {
          console.log(`              ${line}`);
        });
      }
    }

    console.log('');
  });

  console.log('┌─────────────────────────────────────────────────────────────────┐');
  console.log('│  💡 Tip: Use Read tool to view artifact contents                │');
  console.log('└─────────────────────────────────────────────────────────────────┘');
  console.log('');
}

/**
 * Scan for recently modified artifacts
 */
async function scanForRecentArtifacts(searchPath, maxAgeSeconds) {
  const artifacts = [];
  const now = Date.now();
  const maxAge = maxAgeSeconds * 1000;

  await scanDirectory(searchPath, async (filePath, stats) => {
    const age = now - stats.mtimeMs;

    if (age <= maxAge && stats.isFile()) {
      // Skip temp files and logs
      const fileName = basename(filePath);
      if (fileName.startsWith('tmp-') || fileName.endsWith('.log')) {
        return;
      }

      const artifact = {
        path: filePath,
        size: stats.size,
        modified: stats.mtime,
      };

      // Try to get summary
      artifact.summary = await getFileSummary(filePath);

      artifacts.push(artifact);
    }
  });

  // Sort by most recent first
  artifacts.sort((a, b) => b.modified - a.modified);

  return artifacts;
}

/**
 * Recursively scan directory
 */
async function scanDirectory(dir, callback) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      // Skip certain directories
      if (entry.isDirectory()) {
        const dirName = entry.name;
        if (dirName === 'node_modules' || dirName === '.git' || dirName === 'logs') {
          continue;
        }
        await scanDirectory(fullPath, callback);
      } else if (entry.isFile()) {
        const stats = await stat(fullPath);
        await callback(fullPath, stats);
      }
    }
  } catch (error) {
    // Skip directories we can't read
  }
}

/**
 * Get a brief summary of file contents
 */
async function getFileSummary(filePath) {
  try {
    const content = await readFile(filePath, 'utf-8');
    const maxLength = 200;

    if (filePath.endsWith('.json')) {
      const data = JSON.parse(content);

      // Extract meaningful fields
      if (data.objective) return truncate(data.objective, maxLength);
      if (data.summary) return truncate(data.summary, maxLength);
      if (data.description) return truncate(data.description, maxLength);
      if (data.task_id) return `Task: ${data.task_id}`;

      return `JSON document with ${Object.keys(data).length} fields`;
    } else if (filePath.endsWith('.md')) {
      // Get first few non-empty lines
      const lines = content
        .split('\n')
        .filter(l => l.trim().length > 0)
        .slice(0, 3);

      if (lines.length === 0) return null;

      // Remove markdown headers
      const cleaned = lines.map(l => l.replace(/^#+\s*/, '').trim());
      return truncate(cleaned.join(' '), maxLength);
    } else if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
      const lines = content
        .split('\n')
        .filter(l => l.trim().length > 0 && !l.trim().startsWith('#'))
        .slice(0, 2);

      return truncate(lines.join(' '), maxLength);
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Truncate text to max length
 */
function truncate(text, maxLength) {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - 3) + '...';
}

// CLI execution
const args = process.argv.slice(2);

const options = {};

const sinceIndex = args.indexOf('--since');
if (sinceIndex >= 0) {
  options.maxAgeSeconds = parseInt(args[sinceIndex + 1], 10) || 60;
}

const pathIndex = args.indexOf('--path');
if (pathIndex >= 0) {
  options.searchPath = args[pathIndex + 1];
}

notifyArtifacts(options);
