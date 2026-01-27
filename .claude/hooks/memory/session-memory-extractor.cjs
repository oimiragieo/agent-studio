#!/usr/bin/env node
/**
 * Session Memory Extractor Hook
 * ==============================
 *
 * PostToolUse hook that extracts learnings from completed Task agent runs.
 * Automatically records patterns, gotchas, and discoveries.
 *
 * Triggers on: Task tool completion
 */

'use strict';

const path = require('path');
const fs = require('fs');

/**
 * Find project root by searching for .claude/CLAUDE.md
 * This ensures memory is written to correct location regardless of CWD
 */
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

// Find project root once at module load time
const PROJECT_ROOT = findProjectRoot();

// Import memory manager
let memoryManager;
try {
  memoryManager = require('../../lib/memory/memory-manager.cjs');
} catch (e) {
  // Fallback path resolution
  const libPath = path.join(__dirname, '..', '..', 'lib', 'memory', 'memory-manager.cjs');
  memoryManager = require(libPath);
}

/**
 * Extract patterns from task output
 */
function extractPatterns(output) {
  const patterns = [];

  // Look for pattern indicators
  const patternIndicators = [
    /(?:pattern|approach|solution|technique|best practice):\s*(.+)/gi,
    /(?:always|should|must|prefer)\s+(.{20,100})/gi,
    /(?:use|using)\s+(\w+)\s+(?:for|to|when)\s+(.{10,50})/gi,
  ];

  for (const regex of patternIndicators) {
    let match;
    while ((match = regex.exec(output)) !== null) {
      const patternText = match[1]?.trim();
      if (patternText && patternText.length > 10 && patternText.length < 200) {
        patterns.push(patternText);
      }
    }
  }

  return patterns.slice(0, 3); // Max 3 patterns per task
}

/**
 * Extract gotchas from task output
 */
function extractGotchas(output) {
  const gotchas = [];

  // Look for gotcha indicators
  const gotchaIndicators = [
    /(?:gotcha|pitfall|warning|caution|watch out|careful):\s*(.+)/gi,
    /(?:don't|do not|never|avoid)\s+(.{20,100})/gi,
    /(?:bug|issue|problem):\s*(.{20,150})/gi,
    /(?:fixed|resolved)\s+(?:by|with)\s+(.{20,100})/gi,
  ];

  for (const regex of gotchaIndicators) {
    let match;
    while ((match = regex.exec(output)) !== null) {
      const gotchaText = match[1]?.trim();
      if (gotchaText && gotchaText.length > 10 && gotchaText.length < 200) {
        gotchas.push(gotchaText);
      }
    }
  }

  return gotchas.slice(0, 3); // Max 3 gotchas per task
}

/**
 * Extract file discoveries from task output
 */
function extractDiscoveries(output) {
  const discoveries = [];

  // Look for file path mentions with descriptions
  const filePatterns = [
    /`([^`]+\.[a-z]{2,4})`[:\s-]+(.{10,100})/gi,
    /(?:file|module|component)\s+`?([^\s`]+\.[a-z]{2,4})`?\s+(?:is|handles|contains|manages)\s+(.{10,80})/gi,
  ];

  for (const regex of filePatterns) {
    let match;
    while ((match = regex.exec(output)) !== null) {
      const filePath = match[1]?.trim();
      const description = match[2]?.trim();
      if (filePath && description && !filePath.includes(' ')) {
        discoveries.push({ path: filePath, description });
      }
    }
  }

  return discoveries.slice(0, 5); // Max 5 discoveries per task
}

/**
 * Parse hook input from stdin
 */
async function parseHookInput() {
  return new Promise(resolve => {
    let input = '';
    let hasData = false;

    process.stdin.setEncoding('utf8');

    process.stdin.on('data', chunk => {
      hasData = true;
      input += chunk;
    });

    process.stdin.on('end', () => {
      if (!hasData || !input.trim()) {
        resolve(null);
        return;
      }

      try {
        resolve(JSON.parse(input));
      } catch (e) {
        resolve(null);
      }
    });

    process.stdin.on('error', () => {
      resolve(null);
    });

    setTimeout(() => {
      if (!hasData) {
        resolve(null);
      }
    }, 100);

    process.stdin.resume();
  });
}

/**
 * Main execution
 */
async function main() {
  try {
    const hookInput = await parseHookInput();

    if (!hookInput) {
      process.exit(0);
    }

    // Only process Task tool results
    const toolName = hookInput.tool_name || hookInput.tool;
    if (toolName !== 'Task') {
      process.exit(0);
    }

    // Get the tool output/result
    const toolOutput = hookInput.tool_output || hookInput.result || '';

    if (!toolOutput || typeof toolOutput !== 'string' || toolOutput.length < 50) {
      process.exit(0);
    }

    // Extract learnings
    const patterns = extractPatterns(toolOutput);
    const gotchas = extractGotchas(toolOutput);
    const discoveries = extractDiscoveries(toolOutput);

    // Record extracted items
    let recorded = 0;

    for (const pattern of patterns) {
      if (memoryManager.recordPattern(pattern, PROJECT_ROOT)) {
        recorded++;
      }
    }

    for (const gotcha of gotchas) {
      if (memoryManager.recordGotcha(gotcha, PROJECT_ROOT)) {
        recorded++;
      }
    }

    for (const discovery of discoveries) {
      if (
        memoryManager.recordDiscovery(
          discovery.path,
          discovery.description,
          'general',
          PROJECT_ROOT
        )
      ) {
        recorded++;
      }
    }

    // Log if we recorded anything (for debugging)
    if (recorded > 0 && process.env.DEBUG_HOOKS) {
      console.error(`[memory] Recorded ${recorded} items from Task output`);
    }

    process.exit(0);
  } catch (err) {
    // Fail silently - memory extraction is non-critical
    if (process.env.DEBUG_HOOKS) {
      console.error('Session memory extractor error:', err.message);
    }
    process.exit(0);
  }
}

main();

module.exports = {
  extractPatterns,
  extractGotchas,
  extractDiscoveries,
  findProjectRoot,
  PROJECT_ROOT,
};
