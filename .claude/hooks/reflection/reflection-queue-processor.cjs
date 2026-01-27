#!/usr/bin/env node
/**
 * Hook: reflection-queue-processor.cjs
 * Trigger: Can be invoked manually or by session hooks
 * Purpose: Process pending reflection queue entries and spawn reflection-agent
 *
 * This hook reads the reflection queue file, processes pending entries,
 * outputs spawn instructions for the reflection-agent, and marks entries
 * as processed.
 *
 * The queue file is a JSONL file at:
 *   .claude/context/reflection-queue.jsonl
 *
 * Queue Entry Format:
 *   - taskId: (for task_completion) Task ID that was completed
 *   - context: (for session_end/error) Context type
 *   - trigger: "task_completion" | "session_end" | "error"
 *   - timestamp: ISO date string
 *   - priority: "high" | "medium" | "low"
 *   - processed: boolean (skip if true)
 *
 * ENFORCEMENT MODES:
 * - block (default): Process queue (no blocking, this is informational)
 * - warn: Process queue with extra logging
 * - off: Disabled, no processing
 *
 * Environment variables:
 *   REFLECTION_ENABLED=false - Disable all reflection
 *   REFLECTION_HOOK_MODE=off - Disable this hook
 *   DEBUG_HOOKS=true - Enable debug logging
 */

'use strict';

const fs = require('fs');
const path = require('path');

// Find project root
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

// Configuration
let QUEUE_FILE = path.join(PROJECT_ROOT, '.claude', 'context', 'reflection-queue.jsonl');

/**
 * Check if reflection is enabled
 * @returns {boolean} True if reflection should run
 */
function isEnabled() {
  // Check REFLECTION_ENABLED (default: true)
  if (process.env.REFLECTION_ENABLED === 'false') {
    return false;
  }

  // Check REFLECTION_HOOK_MODE (default: block, which means enabled)
  const mode = process.env.REFLECTION_HOOK_MODE || 'block';
  if (mode === 'off') {
    return false;
  }

  return true;
}

/**
 * Read all entries from the queue file
 * @param {string} queueFile - Path to queue file
 * @returns {Array<object>} Array of parsed queue entries (excluding processed)
 */
function readQueueEntries(queueFile) {
  try {
    if (!fs.existsSync(queueFile)) {
      return [];
    }

    const content = fs.readFileSync(queueFile, 'utf8');
    if (!content.trim()) {
      return [];
    }

    const lines = content.split('\n').filter(line => line.trim());
    const entries = [];

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        // Skip entries already marked as processed
        if (!entry.processed) {
          entries.push(entry);
        }
      } catch (parseErr) {
        // Skip malformed JSON lines, log if debug enabled
        if (process.env.DEBUG_HOOKS) {
          console.error('[reflection-queue-processor] Skipping malformed line:', line);
        }
      }
    }

    return entries;
  } catch (err) {
    if (process.env.DEBUG_HOOKS) {
      console.error('[reflection-queue-processor] Error reading queue:', err.message);
    }
    return [];
  }
}

/**
 * Filter entries to get only pending (unprocessed) entries
 * @param {Array<object>} entries - All queue entries
 * @returns {Array<object>} Pending entries only
 */
function getPendingEntries(entries) {
  return entries.filter(entry => !entry.processed);
}

/**
 * Generate spawn instruction for a reflection entry
 * @param {object} entry - Queue entry
 * @returns {string} Spawn instruction text
 */
function generateSpawnInstruction(entry) {
  const trigger = entry.trigger || 'unknown';
  const reason = buildReason(entry);
  const taskPrompt = buildTaskPrompt(entry);

  return `[REFLECTION-TRIGGER] Spawn reflection-agent for: ${reason}
Task({
  subagent_type: "reflection-agent",
  description: "Reflection: ${reason}",
  prompt: \`${taskPrompt}\`
})`;
}

/**
 * Build a human-readable reason from the entry
 * @param {object} entry - Queue entry
 * @returns {string} Human-readable reason
 */
function buildReason(entry) {
  switch (entry.trigger) {
    case 'task_completion':
      return `task ${entry.taskId || 'unknown'} completed`;
    case 'session_end':
      return 'session ended - batch reflection for unreflected tasks';
    case 'error':
      return `error in ${entry.tool || 'unknown tool'}: ${entry.error || 'unknown error'}`;
    default:
      return `${entry.trigger || 'unknown trigger'}`;
  }
}

/**
 * Build the task prompt for spawning reflection-agent
 * @param {object} entry - Queue entry
 * @returns {string} Task prompt
 */
function buildTaskPrompt(entry) {
  const trigger = entry.trigger || 'unknown';
  const timestamp = entry.timestamp || new Date().toISOString();
  const priority = entry.priority || 'medium';

  let context = '';
  switch (trigger) {
    case 'task_completion':
      context = `Analyze completed task ${entry.taskId || 'unknown'}.
${entry.summary ? `Summary: ${entry.summary}` : ''}`;
      break;
    case 'session_end':
      context = `Session ended. Perform batch reflection for all unreflected tasks.
${entry.stats ? `Stats: ${JSON.stringify(entry.stats)}` : ''}`;
      break;
    case 'error':
      context = `Error occurred during ${entry.tool || 'unknown'} execution.
Error: ${entry.error || 'unknown'}`;
      break;
    default:
      context = `Reflection triggered: ${trigger}`;
  }

  return `You are the REFLECTION-AGENT.

Trigger: ${trigger}
Timestamp: ${timestamp}
Priority: ${priority}

${context}

Instructions:
1. Read your agent definition: .claude/agents/core/reflection-agent.md
2. Analyze the context and extract learnings
3. Update memory files as appropriate
4. Document any patterns or issues discovered`;
}

/**
 * Mark entries as processed in the queue file
 * @param {Array<object>} processedEntries - Entries that were processed
 * @param {string} queueFile - Path to queue file
 */
function markEntriesProcessed(processedEntries, queueFile) {
  if (!processedEntries || processedEntries.length === 0) {
    return;
  }

  try {
    if (!fs.existsSync(queueFile)) {
      return;
    }

    const content = fs.readFileSync(queueFile, 'utf8');
    if (!content.trim()) {
      return;
    }

    const lines = content.split('\n').filter(line => line.trim());
    const updatedLines = [];

    // Create a set of processed entry identifiers for fast lookup
    const processedSet = new Set(
      processedEntries.map(e => `${e.trigger}:${e.timestamp}:${e.taskId || e.context || ''}`)
    );

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        const identifier = `${entry.trigger}:${entry.timestamp}:${entry.taskId || entry.context || ''}`;

        if (processedSet.has(identifier)) {
          entry.processed = true;
        }

        updatedLines.push(JSON.stringify(entry));
      } catch (parseErr) {
        // Keep malformed lines as-is
        updatedLines.push(line);
      }
    }

    const tempFile = queueFile + '.tmp';
    fs.writeFileSync(tempFile, updatedLines.join('\n') + '\n');
    fs.renameSync(tempFile, queueFile); // Atomic on POSIX/Windows
  } catch (err) {
    if (process.env.DEBUG_HOOKS) {
      console.error(
        '[reflection-queue-processor] Error marking entries as processed:',
        err.message
      );
    }
  }
}

/**
 * Process the queue and return spawn instructions
 * @param {string} queueFile - Path to queue file
 * @returns {object} Result with processed count and instructions
 */
function processQueue(queueFile = QUEUE_FILE) {
  const result = {
    processed: 0,
    instructions: [],
  };

  if (!isEnabled()) {
    return result;
  }

  const entries = readQueueEntries(queueFile);
  const pending = getPendingEntries(entries);

  if (pending.length === 0) {
    return result;
  }

  for (const entry of pending) {
    const instruction = generateSpawnInstruction(entry);
    result.instructions.push(instruction);
    result.processed++;
  }

  // Mark entries as processed
  markEntriesProcessed(pending, queueFile);

  return result;
}

/**
 * Main execution
 */
async function main() {
  try {
    // Check if enabled
    if (!isEnabled()) {
      process.exit(0);
    }

    // Process the queue
    const result = processQueue(QUEUE_FILE);

    // Output spawn instructions to stderr for visibility
    if (result.instructions.length > 0) {
      for (const instruction of result.instructions) {
        console.error(instruction);
        console.error(''); // Blank line between instructions
      }

      const mode = process.env.REFLECTION_HOOK_MODE || 'block';
      if (mode === 'warn') {
        console.log(`[reflection-queue-processor] Processed ${result.processed} entries`);
      }
    }

    // Informational hook - always exit 0
    process.exit(0);
  } catch (err) {
    // Fail open - log error but don't block
    if (process.env.DEBUG_HOOKS) {
      console.error('[reflection-queue-processor] Error:', err.message);
    }
    process.exit(0);
  }
}

// Run if main module
if (require.main === module) {
  main();
}

// Exports for testing
module.exports = {
  isEnabled,
  readQueueEntries,
  getPendingEntries,
  generateSpawnInstruction,
  markEntriesProcessed,
  processQueue,
  main,
  get QUEUE_FILE() {
    return QUEUE_FILE;
  },
  set QUEUE_FILE(val) {
    QUEUE_FILE = val;
  },
};
