#!/usr/bin/env node
/**
 * Orchestrator Wrapper - Silent Context Recycling
 *
 * CLI wrapper that manages orchestrator lifecycle for seamless context recycling
 * Implements "Baton Pass Protocol" - detects termination, clears context, respawns
 *
 * Usage:
 *   node .claude/tools/orchestrator-wrapper.mjs --run-id <id> --user-request "<request>"
 */

import { spawn } from 'child_process';
import { readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { readProjectDatabase } from './project-db.mjs';
// Note: updateProjectDatabase() is deprecated - all writes go to run.json via updateRun() from run-manager.mjs
import {
  PHOENIX_SIGNALS,
  triggerPhoenixReset,
  resumeFromPhoenix,
  shouldTriggerPhoenixReset,
} from './phoenix-manager.mjs';
import { getRunDirectoryStructure } from './run-manager.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Exit codes (aligned with Phoenix signals)
const EXIT_CODE_CONTEXT_LIMIT = PHOENIX_SIGNALS.RESET_CONTEXT; // 100 - Signal for context limit reached
const EXIT_CODE_RESET_WITH_PROMPT = PHOENIX_SIGNALS.RESET_WITH_PROMPT; // 101 - Reset with resurrection prompt
const EXIT_CODE_NORMAL = PHOENIX_SIGNALS.RESET_COMPLETE; // 0
const EXIT_CODE_ERROR = 1;

/**
 * Spawn orchestrator instance
 * @param {string} runId - Run ID
 * @param {string} userRequest - User request
 * @returns {Promise<ChildProcess>} Spawned process
 */
function spawnOrchestrator(runId, userRequest) {
  // In a real implementation, this would spawn the actual orchestrator agent
  // For now, we'll use a placeholder that simulates orchestrator execution
  // The actual implementation would call Claude API or use agent SDK

  console.log(`[Wrapper] Spawning orchestrator instance for run ${runId}...`);
  console.log(`[Wrapper] User request: ${userRequest}`);

  // Placeholder: In production, this would be:
  // const orchestratorProcess = spawn('node', ['.claude/tools/orchestrator-executor.mjs', '--run-id', runId, '--request', userRequest]);
  // For now, return a mock process that we can control

  return {
    pid: process.pid + 1, // Mock PID
    exitCode: null,
    on: (event, handler) => {
      // Mock event handlers
      if (event === 'exit') {
        // Simulate orchestrator execution
        setTimeout(() => {
          // In real implementation, this would be the actual orchestrator process
          handler(EXIT_CODE_CONTEXT_LIMIT); // Simulate context limit
        }, 1000);
      }
    },
    kill: () => {
      console.log('[Wrapper] Terminating orchestrator process...');
    },
  };
}

/**
 * Main wrapper loop - implements Baton Pass Protocol
 * @param {string} runId - Run ID
 * @param {string} userRequest - User request
 */
export async function runOrchestratorWrapper(runId, userRequest) {
  let iteration = 0;
  const maxIterations = 100; // Safety limit

  console.log(`[Wrapper] Starting orchestrator wrapper for run ${runId}`);
  console.log(`[Wrapper] Implementing Baton Pass Protocol for silent context recycling`);

  while (iteration < maxIterations) {
    iteration++;
    console.log(`[Wrapper] Iteration ${iteration}: Spawning orchestrator instance...`);

    // Read Project Database to get current state
    let projectDb;
    try {
      projectDb = await readProjectDatabase(runId);
      console.log(
        `[Wrapper] Resuming from: Phase ${projectDb.current_phase || 'N/A'}, Step ${projectDb.current_step}`
      );
    } catch (error) {
      // First run - initialize Project Database
      console.log(`[Wrapper] First run - initializing Project Database...`);
      const { initializeProjectDatabase } = await import('./project-db.mjs');
      projectDb = await initializeProjectDatabase(runId, {
        user_request: userRequest,
        status: 'in_progress',
      });
    }

    // Spawn orchestrator instance
    const orchestratorProcess = spawnOrchestrator(runId, userRequest);

    // Wait for orchestrator to complete or hit context limit
    return new Promise((resolve, reject) => {
      orchestratorProcess.on('exit', async exitCode => {
        if (exitCode === EXIT_CODE_CONTEXT_LIMIT || exitCode === EXIT_CODE_RESET_WITH_PROMPT) {
          // Phoenix reset triggered - seamless context recycling
          console.log(`[Wrapper] Phoenix reset detected (exit code ${exitCode})`);

          // Resume from Phoenix snapshot
          const resumeInfo = await resumeFromPhoenix(runId);

          console.log(`[Wrapper] Phoenix snapshot loaded. Resurrecting orchestrator...`);
          console.log(`[Wrapper] Current step: ${resumeInfo.runRecord.current_step}`);
          console.log(`[Wrapper] Status: ${resumeInfo.runRecord.status}`);

          // Clear context (in real implementation, this would clear Claude session context)
          console.log(`[Wrapper] Context cleared. Injecting resurrection prompt...`);

          // Use resurrection prompt if exit code indicates it
          const nextRequest =
            exitCode === EXIT_CODE_RESET_WITH_PROMPT ? resumeInfo.resurrectionPrompt : userRequest;

          // Recursively call wrapper to respawn (with iteration limit)
          if (iteration < maxIterations) {
            // Small delay before respawning
            setTimeout(() => {
              runOrchestratorWrapper(runId, nextRequest).then(resolve).catch(reject);
            }, 100);
          } else {
            console.error(`[Wrapper] Max iterations reached. Stopping.`);
            reject(new Error('Max iterations reached'));
          }
        } else if (exitCode === EXIT_CODE_NORMAL) {
          // Normal completion
          console.log(`[Wrapper] Orchestrator completed successfully`);
          // Update run.json directly (project-db is read-only derived cache)
          const { updateRun } = await import('./run-manager.mjs');
          await updateRun(runId, { status: 'completed' });
          const finalDb = await readProjectDatabase(runId);
          resolve(finalDb);
        } else {
          // Error
          console.error(`[Wrapper] Orchestrator exited with error code ${exitCode}`);
          // Update run.json directly (project-db is read-only derived cache)
          const { updateRun } = await import('./run-manager.mjs');
          await updateRun(runId, { status: 'failed' });
          reject(new Error(`Orchestrator failed with exit code ${exitCode}`));
        }
      });
    });
  }
}

/**
 * Check if orchestrator should continue (not at max iterations)
 * @param {number} iteration - Current iteration
 * @param {number} maxIterations - Maximum iterations
 * @returns {boolean} True if should continue
 */
function shouldContinue(iteration, maxIterations) {
  return iteration < maxIterations;
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const runIdIndex = args.indexOf('--run-id');
  const requestIndex = args.indexOf('--user-request');

  if (runIdIndex === -1 || runIdIndex === args.length - 1) {
    console.error('Usage: node orchestrator-wrapper.mjs --run-id <id> --user-request "<request>"');
    process.exit(1);
  }

  if (requestIndex === -1 || requestIndex === args.length - 1) {
    console.error('Usage: node orchestrator-wrapper.mjs --run-id <id> --user-request "<request>"');
    process.exit(1);
  }

  const runId = args[runIdIndex + 1];
  const userRequest = args[requestIndex + 1];

  try {
    const result = await runOrchestratorWrapper(runId, userRequest);
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (error) {
    console.error(`[Wrapper] Error: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default {
  runOrchestratorWrapper,
  spawnOrchestrator,
};
