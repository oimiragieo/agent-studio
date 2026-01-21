#!/usr/bin/env node

/**
 * Post-Task Output Retriever Hook
 *
 * Automatically retrieves and displays agent outputs after Task tool completes.
 * Solves the "black box" problem where users don't see what agents produced.
 *
 * @hook PostToolUse
 * @priority 50
 * @triggers Task tool completion
 */

import { readdir, stat, readFile } from 'fs/promises';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROJECT_ROOT = join(__dirname, '../..');

/**
 * Main hook handler
 */
async function handlePostTask(toolUse, result) {
  // Only process Task tool invocations
  if (toolUse.name !== 'Task') {
    return { allowed: true };
  }

  console.log('\n┌─────────────────────────────────────────────────────────────┐');
  console.log('│  🔍 POST-TASK OUTPUT RETRIEVAL                              │');
  console.log('└─────────────────────────────────────────────────────────────┘\n');

  // Extract agent information
  const agentType = toolUse.params?.subagent_type || 'unknown';
  const description = toolUse.params?.description || 'No description';
  const agentId = result?.agentId || 'unknown';

  console.log(`Agent Type: ${agentType}`);
  console.log(`Description: ${description}`);
  console.log(`Agent ID: ${agentId}\n`);

  // Scan for new artifacts
  console.log('📁 Scanning for artifacts created by agent...\n');

  try {
    const artifacts = await scanForRecentArtifacts(60); // Last 60 seconds

    if (artifacts.length === 0) {
      console.log('⚠️  No new artifacts found in last 60 seconds');
    } else {
      console.log(`✓ Found ${artifacts.length} artifact(s):\n`);

      for (const artifact of artifacts) {
        const relPath = relative(PROJECT_ROOT, artifact.path);
        const sizeKB = (artifact.size / 1024).toFixed(1);
        const timestamp = artifact.modified.toISOString().replace('T', ' ').slice(0, 19);

        console.log(`  📄 ${relPath}`);
        console.log(`     Size: ${sizeKB} KB`);
        console.log(`     Modified: ${timestamp}`);

        // Try to show summary for markdown/JSON files
        if (artifact.path.endsWith('.md') || artifact.path.endsWith('.json')) {
          const summary = await getFileSummary(artifact.path);
          if (summary) {
            console.log(`     Summary: ${summary}`);
          }
        }
        console.log('');
      }
    }
  } catch (error) {
    console.log(`⚠️  Error scanning artifacts: ${error.message}`);
  }

  // Check if agent output is available
  console.log('📤 Attempting to retrieve agent output...\n');

  if (result && typeof result === 'object') {
    const outputText = result.output || result.message || JSON.stringify(result, null, 2);

    if (outputText && outputText.length > 0) {
      console.log('✓ Agent Output:');
      console.log('─────────────────────────────────────────────────────────────');
      console.log(outputText.slice(0, 1000)); // Show first 1000 chars
      if (outputText.length > 1000) {
        console.log(`\n... (${outputText.length - 1000} more characters)`);
      }
      console.log('─────────────────────────────────────────────────────────────\n');
    } else {
      console.log('⚠️  No output text available from agent\n');
    }
  } else {
    console.log('⚠️  Agent result is not in expected format\n');
  }

  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│  ✓ POST-TASK RETRIEVAL COMPLETE                             │');
  console.log('└─────────────────────────────────────────────────────────────┘\n');

  return { allowed: true };
}

/**
 * Scan for recently modified files in .claude/context/
 */
async function scanForRecentArtifacts(maxAgeSeconds = 60) {
  const artifacts = [];
  const contextDir = join(PROJECT_ROOT, '.claude', 'context');
  const now = Date.now();
  const maxAge = maxAgeSeconds * 1000;

  try {
    await scanDirectory(contextDir, async (filePath, stats) => {
      const age = now - stats.mtimeMs;
      if (age <= maxAge && stats.isFile()) {
        artifacts.push({
          path: filePath,
          size: stats.size,
          modified: stats.mtime,
        });
      }
    });
  } catch (error) {
    // Directory might not exist, that's okay
  }

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

      if (entry.isDirectory()) {
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

    if (filePath.endsWith('.json')) {
      const data = JSON.parse(content);
      if (data.objective) return data.objective;
      if (data.summary) return data.summary;
      if (data.description) return data.description;
      return `JSON with ${Object.keys(data).length} keys`;
    } else if (filePath.endsWith('.md')) {
      // Get first non-empty line
      const lines = content.split('\n').filter(l => l.trim().length > 0);
      if (lines.length > 0) {
        const firstLine = lines[0].replace(/^#+\s*/, ''); // Remove markdown headers
        return firstLine.slice(0, 80);
      }
    }
  } catch (error) {
    return null;
  }

  return null;
}

// Hook configuration
export const config = {
  name: 'post-task-output-retriever',
  description: 'Automatically retrieves and displays agent outputs after Task tool completes',
  version: '1.0.0',
  hook: 'PostToolUse',
  priority: 50,
  enabled: true,
};

// Hook handler
export async function handler(context) {
  return handlePostTask(context.toolUse, context.result);
}

// CLI mode for testing
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Post-Task Output Retriever Hook v1.0.0');
  console.log('This hook runs automatically after Task tool invocations.');
  console.log('\nTest mode: Scanning for recent artifacts...\n');

  const artifacts = await scanForRecentArtifacts(300); // Last 5 minutes
  console.log(`Found ${artifacts.length} artifacts modified in last 5 minutes:`);
  artifacts.forEach(a => {
    console.log(`  - ${relative(PROJECT_ROOT, a.path)}`);
  });
}
