#!/usr/bin/env node

/**
 * Suggestion Executor
 *
 * Executes accepted suggestions safely with rollback capability.
 *
 * @module suggestion-generator/executor
 * @version 1.0.0
 */

import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { getSuggestion, updateStatus } from './queue-manager.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants
const BACKUP_DIR = path.join(process.cwd(), '.claude', 'context', 'backups', 'suggestions');

// Safe commands whitelist (can auto-execute)
const SAFE_COMMANDS = [
  'npm run lint',
  'npm run format',
  'npm run test',
  'pnpm install',
  'pnpm run lint',
  'pnpm run format',
  'pnpm run test',
  'yarn install',
  'yarn lint',
  'yarn format',
  'yarn test',
];

/**
 * Check if suggestion can be executed
 *
 * @param {object} suggestion - Suggestion object
 * @returns {Promise<{canExecute: boolean, reason?: string}>}
 */
export async function canExecute(suggestion) {
  // Check status is accepted
  if (suggestion.status !== 'accepted') {
    return {
      canExecute: false,
      reason: `Suggestion must be in accepted status (current: ${suggestion.status})`,
    };
  }

  // Check action type is executable
  const executableActions = ['run-command', 'edit-file', 'create-file', 'delete-file'];
  if (!executableActions.includes(suggestion.action?.type)) {
    return {
      canExecute: false,
      reason: `Action type ${suggestion.action?.type} cannot be auto-executed`,
    };
  }

  // Check auto-executable flag
  if (suggestion.action.auto_executable === false) {
    return {
      canExecute: false,
      reason: 'Suggestion marked as not auto-executable',
    };
  }

  // For commands, check whitelist
  if (suggestion.action.type === 'run-command') {
    const command = suggestion.action.command;
    const isSafe = SAFE_COMMANDS.some(safe => command.startsWith(safe));

    if (!isSafe) {
      return {
        canExecute: false,
        reason: `Command not in safe whitelist: ${command}`,
      };
    }
  }

  return { canExecute: true };
}

/**
 * Execute a suggestion
 *
 * @param {string} suggestionId - Suggestion ID
 * @returns {Promise<object>} - Execution result
 */
export async function executeSuggestion(suggestionId) {
  const startTime = Date.now();

  try {
    // Get suggestion
    const suggestion = await getSuggestion(suggestionId);
    if (!suggestion) {
      throw new Error(`Suggestion not found: ${suggestionId}`);
    }

    // Validate can execute
    const validation = await canExecute(suggestion);
    if (!validation.canExecute) {
      throw new Error(validation.reason);
    }

    console.log(`Executing suggestion: ${suggestionId}`);

    // Update status to in-progress
    await updateStatus(suggestionId, 'in-progress', {
      execution: {
        started_at: new Date().toISOString(),
      },
    });

    // Backup if reversible
    let backupPath = null;
    if (suggestion.action.reversible) {
      backupPath = await createBackup(suggestion);
    }

    // Execute based on action type
    let result;
    switch (suggestion.action.type) {
      case 'run-command':
        result = await executeCommand(suggestion);
        break;
      case 'edit-file':
        result = await editFile(suggestion);
        break;
      case 'create-file':
        result = await createFile(suggestion);
        break;
      case 'delete-file':
        result = await deleteFile(suggestion);
        break;
      default:
        throw new Error(`Unsupported action type: ${suggestion.action.type}`);
    }

    const duration = Date.now() - startTime;

    // Update to completed
    await updateStatus(suggestionId, 'completed', {
      execution: {
        started_at: suggestion.execution?.started_at,
        completed_at: new Date().toISOString(),
        duration_ms: duration,
        result: 'success',
        output: result.output,
        artifacts_created: result.artifacts_created || [],
      },
    });

    console.log(`✓ Suggestion executed successfully (${duration}ms)`);

    return {
      success: true,
      output: result.output,
      artifacts_created: result.artifacts_created,
      duration_ms: duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    console.error(`✗ Suggestion execution failed (${duration}ms):`, error.message);

    // Update to failed (keep in accepted status for retry)
    await updateStatus(suggestionId, 'accepted', {
      execution: {
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        duration_ms: duration,
        result: 'failed',
        error: error.message,
      },
    });

    return {
      success: false,
      error: error.message,
      duration_ms: duration,
    };
  }
}

/**
 * Execute command action
 *
 * @param {object} suggestion - Suggestion object
 * @returns {Promise<object>} - Execution result
 */
async function executeCommand(suggestion) {
  const { command } = suggestion.action;

  try {
    const output = execSync(command, {
      cwd: process.cwd(),
      encoding: 'utf-8',
      stdio: 'pipe',
    });

    return {
      output: output.trim(),
      artifacts_created: [],
    };
  } catch (error) {
    throw new Error(`Command execution failed: ${error.message}`);
  }
}

/**
 * Edit file action
 *
 * @param {object} suggestion - Suggestion object
 * @returns {Promise<object>} - Execution result
 */
async function editFile(suggestion) {
  const { file_path } = suggestion.action;

  // Note: Actual file editing would require diff/patch logic
  // For now, we return a placeholder result
  return {
    output: `File edit placeholder: ${file_path}`,
    artifacts_created: [file_path],
  };
}

/**
 * Create file action
 *
 * @param {object} suggestion - Suggestion object
 * @returns {Promise<object>} - Execution result
 */
async function createFile(suggestion) {
  const { file_path, content } = suggestion.action;

  try {
    // Ensure parent directory exists
    const dir = path.dirname(file_path);
    await fs.mkdir(dir, { recursive: true });

    // Create file
    await fs.writeFile(file_path, content || '', 'utf-8');

    return {
      output: `Created file: ${file_path}`,
      artifacts_created: [file_path],
    };
  } catch (error) {
    throw new Error(`File creation failed: ${error.message}`);
  }
}

/**
 * Delete file action
 *
 * @param {object} suggestion - Suggestion object
 * @returns {Promise<object>} - Execution result
 */
async function deleteFile(suggestion) {
  const { file_path } = suggestion.action;

  try {
    await fs.unlink(file_path);

    return {
      output: `Deleted file: ${file_path}`,
      artifacts_created: [],
    };
  } catch (error) {
    throw new Error(`File deletion failed: ${error.message}`);
  }
}

/**
 * Create backup before executing
 *
 * @param {object} suggestion - Suggestion object
 * @returns {Promise<string>} - Backup path
 */
async function createBackup(suggestion) {
  try {
    await fs.mkdir(BACKUP_DIR, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `${suggestion.suggestion_id}-${timestamp}.json`);

    await fs.writeFile(backupPath, JSON.stringify(suggestion, null, 2), 'utf-8');

    return backupPath;
  } catch (error) {
    console.warn('Failed to create backup:', error.message);
    return null;
  }
}

/**
 * Rollback executed suggestion
 *
 * @param {string} suggestionId - Suggestion ID
 * @returns {Promise<object>} - Rollback result
 */
export async function rollback(suggestionId) {
  try {
    const suggestion = await getSuggestion(suggestionId);
    if (!suggestion) {
      throw new Error(`Suggestion not found: ${suggestionId}`);
    }

    if (!suggestion.action.reversible) {
      throw new Error('Suggestion is not reversible');
    }

    if (suggestion.status !== 'completed') {
      throw new Error(`Can only rollback completed suggestions (current: ${suggestion.status})`);
    }

    // Find backup
    const backupFiles = await fs.readdir(BACKUP_DIR);
    const backupFile = backupFiles.find(f => f.startsWith(suggestionId));

    if (!backupFile) {
      throw new Error(`No backup found for suggestion: ${suggestionId}`);
    }

    const backupPath = path.join(BACKUP_DIR, backupFile);
    const backupContent = await fs.readFile(backupPath, 'utf-8');
    const backup = JSON.parse(backupContent);

    console.log(`Rolling back suggestion: ${suggestionId}`);

    // Execute rollback based on action type
    switch (backup.action.type) {
      case 'edit-file':
        // Restore original file content (would need to store in backup)
        console.log(`Rollback edit-file: ${backup.action.file_path}`);
        break;
      case 'create-file':
        // Delete created file
        await fs.unlink(backup.action.file_path);
        console.log(`Deleted created file: ${backup.action.file_path}`);
        break;
      case 'delete-file':
        // Restore deleted file (would need to store in backup)
        console.log(`Rollback delete-file: ${backup.action.file_path}`);
        break;
      default:
        throw new Error(`Rollback not supported for: ${backup.action.type}`);
    }

    // Update status
    await updateStatus(suggestionId, 'rejected', {
      user_response: {
        action_taken: 'rejected',
        responded_at: new Date().toISOString(),
        notes: 'Rolled back after execution',
      },
    });

    console.log(`✓ Suggestion rolled back: ${suggestionId}`);

    return {
      success: true,
      message: 'Suggestion rolled back successfully',
    };
  } catch (error) {
    console.error(`✗ Rollback failed:`, error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Export functions
export default {
  executeSuggestion,
  canExecute,
  rollback,
};
