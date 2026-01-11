#!/usr/bin/env node
/**
 * Workflow Monitor - Real-time workflow execution monitoring
 *
 * Tracks active workflow runs, displays progress, monitors for stalled steps,
 * and provides real-time status updates for orchestration debugging.
 *
 * Usage:
 *   node .claude/tools/workflow-monitor.mjs --run-id <id>
 *   node .claude/tools/workflow-monitor.mjs --watch
 *   node .claude/tools/workflow-monitor.mjs --list
 *   node .claude/tools/workflow-monitor.mjs --status
 */

import { readFile, readdir, stat } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const RUNS_DIR = join(__dirname, '..', 'context', 'runs');
const STALE_THRESHOLD = 300000; // 5 minutes in milliseconds

/**
 * Load run record
 * @param {string} runId - Run identifier
 * @returns {Promise<Object>} Run record
 */
async function loadRun(runId) {
  try {
    const runPath = join(RUNS_DIR, runId, 'run.json');
    if (!existsSync(runPath)) {
      throw new Error(`Run not found: ${runId}`);
    }

    const content = await readFile(runPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to load run ${runId}: ${error.message}`);
  }
}

/**
 * Load artifact registry
 * @param {string} runId - Run identifier
 * @returns {Promise<Object>} Artifact registry
 */
async function loadArtifactRegistry(runId) {
  try {
    const registryPath = join(RUNS_DIR, runId, 'artifact-registry.json');
    if (!existsSync(registryPath)) {
      return { artifacts: {} };
    }

    const content = await readFile(registryPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.warn(`Warning: Failed to load artifact registry for ${runId}: ${error.message}`);
    return { artifacts: {} };
  }
}

/**
 * Get list of all runs
 * @returns {Promise<Array>} Array of run IDs
 */
async function listRuns() {
  try {
    if (!existsSync(RUNS_DIR)) {
      return [];
    }

    const entries = await readdir(RUNS_DIR, { withFileTypes: true });
    return entries.filter(entry => entry.isDirectory()).map(entry => entry.name);
  } catch (error) {
    console.warn(`Warning: Failed to list runs: ${error.message}`);
    return [];
  }
}

/**
 * Check if run is stalled
 * @param {Object} run - Run record
 * @param {number} threshold - Stale threshold in milliseconds
 * @returns {boolean} True if stalled
 */
function isStalled(run, threshold = STALE_THRESHOLD) {
  if (run.status === 'completed' || run.status === 'failed') {
    return false;
  }

  const lastUpdate = new Date(run.updated_at).getTime();
  const now = Date.now();
  const age = now - lastUpdate;

  return age > threshold;
}

/**
 * Get step status from gates
 * @param {string} runId - Run identifier
 * @param {number} stepNumber - Step number
 * @returns {Promise<Object|null>} Gate result or null
 */
async function getStepStatus(runId, stepNumber) {
  try {
    const gatesDir = join(RUNS_DIR, runId, 'gates');
    if (!existsSync(gatesDir)) {
      return null;
    }

    const paddedStep = String(stepNumber).padStart(2, '0');
    const gatePath = join(gatesDir, `${paddedStep}-gate.json`);

    if (!existsSync(gatePath)) {
      return null;
    }

    const content = await readFile(gatePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

/**
 * Monitor a single run
 * @param {string} runId - Run identifier
 * @returns {Promise<Object>} Monitoring result
 */
export async function monitorRun(runId) {
  const result = {
    run_id: runId,
    status: 'unknown',
    current_step: 0,
    progress: {
      steps_completed: 0,
      total_steps: 0,
      percent_complete: 0,
    },
    stalled: false,
    stalled_duration_ms: 0,
    current_agent: null,
    artifacts: {
      total: 0,
      validated: 0,
      pending: 0,
      failed: 0,
    },
    last_update: null,
    age_ms: 0,
    metadata: {},
    warnings: [],
  };

  try {
    const run = await loadRun(runId);
    const registry = await loadArtifactRegistry(runId);

    result.status = run.status;
    result.current_step = run.current_step;
    result.current_agent = run.owners?.current_agent || null;
    result.last_update = run.updated_at;
    result.metadata = run.metadata || {};

    // Calculate age
    const lastUpdate = new Date(run.updated_at).getTime();
    const now = Date.now();
    result.age_ms = now - lastUpdate;

    // Check if stalled
    result.stalled = isStalled(run, STALE_THRESHOLD);
    if (result.stalled) {
      result.stalled_duration_ms = result.age_ms;
      result.warnings.push(
        `Run stalled for ${Math.round(result.age_ms / 1000)}s (threshold: ${STALE_THRESHOLD / 1000}s)`
      );
    }

    // Count artifacts
    const artifacts = Object.values(registry.artifacts || {});
    result.artifacts.total = artifacts.length;
    result.artifacts.validated = artifacts.filter(a => a.validationStatus === 'pass').length;
    result.artifacts.pending = artifacts.filter(a => a.validationStatus === 'pending').length;
    result.artifacts.failed = artifacts.filter(a => a.validationStatus === 'fail').length;

    // Get step status
    if (run.current_step > 0) {
      const stepStatus = await getStepStatus(runId, run.current_step);
      if (stepStatus) {
        result.current_step_status = {
          status: stepStatus.status,
          agent: stepStatus.agent,
          allowed: stepStatus.allowed,
          blockers: stepStatus.blockers || [],
          warnings: stepStatus.warnings || [],
        };

        if (stepStatus.blockers && stepStatus.blockers.length > 0) {
          result.warnings.push(
            `Step ${run.current_step} has ${stepStatus.blockers.length} blocker(s)`
          );
        }
      }
    }

    return result;
  } catch (error) {
    result.status = 'error';
    result.warnings.push(`Error monitoring run: ${error.message}`);
    return result;
  }
}

/**
 * Monitor all active runs
 * @returns {Promise<Object>} Aggregate monitoring result
 */
export async function monitorAllRuns() {
  const result = {
    total_runs: 0,
    active_runs: 0,
    stalled_runs: 0,
    completed_runs: 0,
    failed_runs: 0,
    runs: [],
    timestamp: new Date().toISOString(),
  };

  try {
    const runIds = await listRuns();
    result.total_runs = runIds.length;

    for (const runId of runIds) {
      try {
        const runResult = await monitorRun(runId);
        result.runs.push(runResult);

        if (runResult.status === 'in_progress' || runResult.status === 'pending') {
          result.active_runs++;
        }
        if (runResult.stalled) {
          result.stalled_runs++;
        }
        if (runResult.status === 'completed') {
          result.completed_runs++;
        }
        if (runResult.status === 'failed') {
          result.failed_runs++;
        }
      } catch (error) {
        console.warn(`Warning: Failed to monitor run ${runId}: ${error.message}`);
      }
    }
  } catch (error) {
    result.error = error.message;
  }

  return result;
}

/**
 * Watch mode - continuously monitor runs
 * @param {Object} options - Watch options
 */
async function watchMode(options = {}) {
  const interval = options.interval || 5000; // 5 seconds
  const runId = options.runId;

  console.log(`\nWorkflow Monitor - Watch Mode`);
  console.log(`Update interval: ${interval / 1000}s`);
  if (runId) {
    console.log(`Monitoring run: ${runId}`);
  } else {
    console.log(`Monitoring all runs`);
  }
  console.log(`Press Ctrl+C to exit\n`);

  const monitor = async () => {
    try {
      const result = runId ? await monitorRun(runId) : await monitorAllRuns();

      // Clear screen (optional)
      if (options.clearScreen) {
        console.clear();
      }

      console.log(`\n[${new Date().toISOString()}]`);

      if (runId) {
        // Single run display
        console.log(`\nRun: ${result.run_id}`);
        console.log(`  Status: ${result.status}`);
        console.log(`  Current Step: ${result.current_step}`);
        console.log(`  Current Agent: ${result.current_agent || 'none'}`);
        console.log(`  Last Update: ${Math.round(result.age_ms / 1000)}s ago`);
        console.log(`  Stalled: ${result.stalled ? 'YES ⚠' : 'no'}`);
        console.log(
          `  Artifacts: ${result.artifacts.validated}/${result.artifacts.total} validated`
        );

        if (result.warnings.length > 0) {
          console.log(`\nWarnings:`);
          result.warnings.forEach(w => console.log(`  - ${w}`));
        }

        if (result.current_step_status) {
          console.log(`\nCurrent Step Status:`);
          console.log(`  Status: ${result.current_step_status.status}`);
          console.log(`  Allowed: ${result.current_step_status.allowed}`);
          if (result.current_step_status.blockers.length > 0) {
            console.log(`  Blockers: ${result.current_step_status.blockers.length}`);
          }
        }
      } else {
        // All runs summary
        console.log(`\nRun Summary:`);
        console.log(`  Total: ${result.total_runs}`);
        console.log(`  Active: ${result.active_runs}`);
        console.log(`  Stalled: ${result.stalled_runs}`);
        console.log(`  Completed: ${result.completed_runs}`);
        console.log(`  Failed: ${result.failed_runs}`);

        if (result.runs.length > 0) {
          console.log(`\nRuns:`);
          result.runs.forEach(run => {
            const stalledFlag = run.stalled ? ' ⚠ STALLED' : '';
            const age = Math.round(run.age_ms / 1000);
            console.log(
              `  ${run.run_id}: ${run.status} (step ${run.current_step}, ${age}s ago)${stalledFlag}`
            );
          });
        }
      }

      console.log(`\n(Updated every ${interval / 1000}s)`);
    } catch (error) {
      console.error(`\nError: ${error.message}`);
    }

    // Schedule next update
    setTimeout(monitor, interval);
  };

  // Start monitoring
  monitor();
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Workflow Monitor - Real-time workflow execution monitoring

Usage:
  node workflow-monitor.mjs [options]

Options:
  --run-id <id>       Monitor specific run
  --watch             Watch mode (continuous monitoring)
  --list              List all runs
  --status            Show aggregate status
  --interval <ms>     Update interval for watch mode (default: 5000)
  --clear-screen      Clear screen on each update (watch mode)
  --json              Output as JSON
  --help, -h          Show this help

Examples:
  # Monitor specific run
  node workflow-monitor.mjs --run-id run-abc123

  # Watch all runs
  node workflow-monitor.mjs --watch

  # Watch specific run with 10s interval
  node workflow-monitor.mjs --run-id run-abc123 --watch --interval 10000

  # List all runs
  node workflow-monitor.mjs --list

  # Get aggregate status
  node workflow-monitor.mjs --status --json

Exit codes:
  0 - Success
  1 - Error
`);
    process.exit(0);
  }

  const getArg = name => {
    const index = args.indexOf(`--${name}`);
    return index !== -1 && args[index + 1] ? args[index + 1] : null;
  };

  const hasFlag = name => args.includes(`--${name}`);

  try {
    const runId = getArg('run-id');
    const interval = parseInt(getArg('interval'), 10) || 5000;

    if (hasFlag('watch')) {
      // Watch mode
      await watchMode({
        runId,
        interval,
        clearScreen: hasFlag('clear-screen'),
      });
      return; // Never exits (Ctrl+C to stop)
    }

    if (hasFlag('list')) {
      // List all runs
      const runIds = await listRuns();

      if (hasFlag('json')) {
        console.log(JSON.stringify({ runs: runIds }, null, 2));
      } else {
        console.log(`\nAll Runs (${runIds.length}):`);
        runIds.forEach(id => console.log(`  - ${id}`));
      }

      process.exit(0);
    }

    if (hasFlag('status') || !runId) {
      // Aggregate status
      const result = await monitorAllRuns();

      if (hasFlag('json')) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`\nWorkflow Status:`);
        console.log(`  Total Runs: ${result.total_runs}`);
        console.log(`  Active: ${result.active_runs}`);
        console.log(`  Stalled: ${result.stalled_runs}`);
        console.log(`  Completed: ${result.completed_runs}`);
        console.log(`  Failed: ${result.failed_runs}`);

        if (result.stalled_runs > 0) {
          console.log(`\nStalled Runs:`);
          result.runs
            .filter(r => r.stalled)
            .forEach(r => {
              const duration = Math.round(r.stalled_duration_ms / 1000);
              console.log(`  - ${r.run_id} (stalled for ${duration}s)`);
            });
        }
      }

      process.exit(0);
    }

    if (runId) {
      // Monitor specific run
      const result = await monitorRun(runId);

      if (hasFlag('json')) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`\nRun: ${result.run_id}`);
        console.log(`  Status: ${result.status}`);
        console.log(`  Current Step: ${result.current_step}`);
        console.log(`  Current Agent: ${result.current_agent || 'none'}`);
        console.log(`  Last Update: ${Math.round(result.age_ms / 1000)}s ago`);
        console.log(`  Stalled: ${result.stalled ? 'YES ⚠' : 'no'}`);
        console.log(`\nArtifacts:`);
        console.log(`  Total: ${result.artifacts.total}`);
        console.log(`  Validated: ${result.artifacts.validated}`);
        console.log(`  Pending: ${result.artifacts.pending}`);
        console.log(`  Failed: ${result.artifacts.failed}`);

        if (result.warnings.length > 0) {
          console.log(`\nWarnings:`);
          result.warnings.forEach(w => console.log(`  - ${w}`));
        }
      }

      process.exit(result.stalled ? 1 : 0);
    }
  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`;
if (isMainModule) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export default {
  monitorRun,
  monitorAllRuns,
};
