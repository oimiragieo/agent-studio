#!/usr/bin/env node
/**
 * Memory Sync Utility - Syncs patterns between memory tool and CLAUDE.md files
 * 
 * This utility syncs important patterns from memory tool to CLAUDE.md files
 * for redundancy and version control. It also validates memory file integrity.
 * 
 * Usage:
 *   node .claude/tools/memory-sync.mjs --session-id <id> [--sync-to-claude] [--validate]
 */

import { readFile, writeFile, readdir, stat, mkdir } from 'fs/promises';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Get all memory files from orchestrator session
 */
async function getMemoryFiles(sessionId) {
  const memoryDir = join(__dirname, '..', 'orchestrators', `orchestrator-${sessionId}`, 'memory');
  const memoryFiles = [];
  
  try {
    const entries = await readdir(memoryDir, { recursive: true, withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.json'))) {
        memoryFiles.push(join(memoryDir, entry.name));
      }
    }
  } catch (error) {
    // Memory directory doesn't exist
    return [];
  }
  
  return memoryFiles;
}

/**
 * Read memory file content
 */
async function readMemoryFile(filePath) {
  try {
    const content = await readFile(filePath, 'utf-8');
    return {
      path: filePath,
      name: basename(filePath),
      content,
      size: content.length
    };
  } catch (error) {
    return null;
  }
}

/**
 * Validate memory file path (security)
 */
function validateMemoryPath(filePath, sessionId) {
  const allowedDir = join(__dirname, '..', 'orchestrators', `orchestrator-${sessionId}`, 'memory');
  const resolvedPath = join(dirname(filePath), basename(filePath));
  
  // Check for directory traversal
  if (filePath.includes('..')) {
    return { valid: false, reason: 'Directory traversal detected' };
  }
  
  // Check if path is within allowed directory
  if (!resolvedPath.startsWith(allowedDir)) {
    return { valid: false, reason: 'Path outside allowed directory' };
  }
  
  // Check file extension
  const ext = filePath.split('.').pop();
  if (!['md', 'json', 'yaml'].includes(ext)) {
    return { valid: false, reason: 'Invalid file extension' };
  }
  
  return { valid: true };
}

/**
 * Sync important patterns from memory to CLAUDE.md
 */
async function syncToClaudeMd(sessionId, projectName) {
  const memoryFiles = await getMemoryFiles(sessionId);
  const synced = [];
  
  for (const memoryFile of memoryFiles) {
    const memory = await readMemoryFile(memoryFile);
    if (!memory) continue;
    
    // Determine if pattern should be synced to CLAUDE.md
    // Patterns that should be synced:
    // - Project-wide rules
    // - Important decisions
    // - Standards that apply to all work
    
    const shouldSync = memory.name.includes('pattern') || 
                      memory.name.includes('rule') ||
                      memory.name.includes('standard') ||
                      memory.name.includes('decision');
    
    if (shouldSync) {
      // Determine target CLAUDE.md file
      // For now, sync to project root CLAUDE.md or phase-specific
      const targetClaudeMd = projectName
        ? join(__dirname, '..', 'projects', projectName, 'CLAUDE.md')
        : join(__dirname, '..', 'CLAUDE.md');
      
      try {
        let claudeContent = '';
        try {
          claudeContent = await readFile(targetClaudeMd, 'utf-8');
        } catch (error) {
          // File doesn't exist, create it
          await mkdir(dirname(targetClaudeMd), { recursive: true });
        }
        
        // Add memory content to CLAUDE.md if not already present
        if (!claudeContent.includes(memory.content.substring(0, 100))) {
          const syncSection = `\n\n## Synced from Memory: ${memory.name}\n\n${memory.content}\n`;
          claudeContent += syncSection;
          await writeFile(targetClaudeMd, claudeContent, 'utf-8');
          synced.push({ memory: memory.name, target: targetClaudeMd });
        }
      } catch (error) {
        console.error(`Failed to sync ${memory.name}: ${error.message}`);
      }
    }
  }
  
  return synced;
}

/**
 * Validate all memory files
 */
async function validateMemoryFiles(sessionId) {
  const memoryFiles = await getMemoryFiles(sessionId);
  const validationResults = [];
  
  for (const memoryFile of memoryFiles) {
    const validation = validateMemoryPath(memoryFile, sessionId);
    const memory = await readMemoryFile(memoryFile);
    
    validationResults.push({
      file: basename(memoryFile),
      path: memoryFile,
      valid: validation.valid,
      reason: validation.reason,
      size: memory?.size || 0,
      readable: memory !== null
    });
  }
  
  return validationResults;
}

/**
 * Main sync function
 */
export async function syncMemory(sessionId, options = {}) {
  const { syncToClaude = false, validate = false, projectName = null } = options;
  
  const results = {
    sessionId,
    memoryFiles: await getMemoryFiles(sessionId),
    synced: [],
    validated: []
  };
  
  if (syncToClaude) {
    results.synced = await syncToClaudeMd(sessionId, projectName);
  }
  
  if (validate) {
    results.validated = await validateMemoryFiles(sessionId);
  }
  
  return results;
}

/**
 * CLI interface
 */
async function main() {
  const args = process.argv.slice(2);
  const sessionIdIndex = args.indexOf('--session-id');
  const projectIndex = args.indexOf('--project');
  
  if (sessionIdIndex === -1 || !args[sessionIdIndex + 1]) {
    console.error('Usage: node memory-sync.mjs --session-id <id> [--sync-to-claude] [--validate] [--project <name>]');
    process.exit(1);
  }
  
  const sessionId = args[sessionIdIndex + 1];
  const projectName = projectIndex !== -1 && args[projectIndex + 1] ? args[projectIndex + 1] : null;
  const syncToClaude = args.includes('--sync-to-claude');
  const validate = args.includes('--validate');
  
  const result = await syncMemory(sessionId, { syncToClaude, validate, projectName });
  
  console.log(JSON.stringify(result, null, 2));
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default { syncMemory, validateMemoryFiles, syncToClaudeMd };

