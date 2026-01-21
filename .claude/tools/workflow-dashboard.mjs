#!/usr/bin/env node

/**
 * Workflow Status Dashboard
 *
 * Displays workflow progress from `.claude/context/runtime/runs/<runId>/`:
 * - `state.json` (hook-driven, agent sessions)
 * - `run.json` (run-manager, workflow runner)
 * - `events.ndjson` (recent event tail)
 *
 * Usage:
 *   node .claude/tools/workflow-dashboard.mjs [--run-id <id>]
 *   node .claude/tools/workflow-dashboard.mjs --watch [--interval 30] [--run-id <id>]
 */

import { readFile, readdir } from 'fs/promises';
import { dirname, isAbsolute, join, relative } from 'path';
import { fileURLToPath } from 'url';
import { stat } from 'fs/promises';
import { resolveRuntimeScope } from './runtime-scope.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '../..');

function resolveDirEnv(envName, defaultPath) {
  const raw = String(process.env[envName] || '').trim();
  if (!raw) return defaultPath;
  return isAbsolute(raw) ? raw : join(PROJECT_ROOT, raw);
}

const RUNTIME_DIR = (() => {
  const override = String(process.env.CLAUDE_RUNTIME_DIR || '').trim();
  if (override)
    return resolveDirEnv('CLAUDE_RUNTIME_DIR', join(PROJECT_ROOT, '.claude', 'context', 'runtime'));
  return resolveRuntimeScope({ projectRoot: PROJECT_ROOT }).runtimeDir;
})();

const BASE_RUNTIME_DIR = (() => {
  const override = String(process.env.CLAUDE_RUNTIME_DIR || '').trim();
  if (override)
    return resolveDirEnv('CLAUDE_RUNTIME_DIR', join(PROJECT_ROOT, '.claude', 'context', 'runtime'));
  return resolveRuntimeScope({ projectRoot: PROJECT_ROOT }).baseRuntimeDir;
})();

function printHeaderClean() {
  console.log('');
  console.log('╔═════════════════════════════════════════════════════════════════╗');
  console.log('║  WORKFLOW STATUS DASHBOARD                                      ║');
  console.log('╚═════════════════════════════════════════════════════════════════╝');
  console.log('');
}

function printHeader() {
  console.log('');
  console.log('╔═════════════════════════════════════════════════════════════════╗');
  console.log('║  WORKFLOW STATUS DASHBOARD                                      ║');
  console.log('╚═════════════════════════════════════════════════════════════════╝');
  console.log('');
}

function printHelp() {
  console.log(`
Workflow Status Dashboard

Usage:
  node .claude/tools/workflow-dashboard.mjs [--run-id <id>]
  node .claude/tools/workflow-dashboard.mjs --watch [--interval <seconds>] [--run-id <id>]

Options:
  --run-id <id>          Show a specific run (defaults to most recent)
  --watch                Refresh continuously
  --interval <seconds>   Refresh interval (default: 30)
  --iterations <n>       Refresh n times then exit (watch mode only)
  --no-clear             Do not clear screen between refreshes (watch mode only)
  --help, -h             Show this help
`);
}

async function displayDashboard(runId = null) {
  printHeaderClean();

  try {
    if (!runId) runId = await findMostRecentRun();

    if (!runId) {
      console.log('  No workflow runs found');
      console.log('');
      console.log('  Tips:');
      console.log(
        '  - Workflow runner: `node .claude/tools/run-manager.mjs create --run-id <id> --workflow <path>`'
      );
      console.log('  - Agent sessions: runs are created automatically by hooks');
      console.log('');
      return;
    }

    const runState = await loadRunState(runId);
    if (!runState) {
      console.log(`  Run not found: ${runId}`);
      console.log('');
      return;
    }

    const workflow = runState.workflow_name || runState.selected_workflow || 'Unknown';
    console.log(`  Run ID: ${runState.run_id || runId}`);
    console.log(`  Workflow: ${workflow}`);
    console.log(`  Status: ${formatStatus(runState.status)}`);
    console.log('');

    const totalSteps = Number.isFinite(runState.total_steps) ? runState.total_steps : 0;
    const currentStep = Number.isFinite(runState.current_step) ? runState.current_step : 0;
    const progress = totalSteps > 0 ? Math.round((currentStep / totalSteps) * 100) : null;

    if (progress === null) {
      console.log(`  Progress: ${currentStep} steps completed`);
      console.log(`  ${renderProgressBar(0, 40)} (total steps unknown)`);
    } else {
      console.log(`  Progress: ${currentStep}/${totalSteps} steps (${progress}%)`);
      console.log(`  ${renderProgressBar(progress, 40)}`);
    }
    console.log('');

    if (runState.current_agent) {
      console.log(`  Current Agent: ${runState.current_agent}`);
      console.log(`  Activity: ${runState.current_activity || 'Working...'}`);
      console.log('');
    }

    const lastHeartbeat =
      runState.last_heartbeat_at || runState.last_event_at || runState.updated_at || null;
    if (lastHeartbeat) {
      const staleMs = Number.isFinite(runState.stale_after_ms)
        ? runState.stale_after_ms
        : 30 * 60 * 1000;
      const ageMs = Date.now() - new Date(lastHeartbeat).getTime();
      const stale = Number.isFinite(ageMs) && ageMs > staleMs;
      console.log(`  Last Update: ${lastHeartbeat}`);
      console.log(`  Health: ${stale ? 'Stale (possible crash/timeout)' : 'Alive'}`);
      console.log('');
    }

    if (runState.started_at) {
      console.log(`  Duration: ${calculateDuration(runState.started_at)}`);
      if (runState.status === 'running' && progress !== null && progress > 0 && progress < 100) {
        console.log(`  Estimated Remaining: ${estimateRemaining(runState.started_at, progress)}`);
      }
      console.log('');
    }

    const artifacts = await findArtifacts(runId);
    if (artifacts.length > 0) {
      console.log(`  Artifacts: ${artifacts.length}`);
      for (const artifact of artifacts.slice(0, 5)) {
        console.log(`    - ${relative(PROJECT_ROOT, artifact)}`);
      }
      if (artifacts.length > 5) console.log(`    - ... and ${artifacts.length - 5} more`);
      console.log('');
    }

    if (Array.isArray(runState.errors) && runState.errors.length > 0) {
      console.log('  Recent Errors:');
      for (const err of runState.errors.slice(-3)) {
        console.log(`    - ${err?.message || err?.error || err}`);
      }
      console.log('');
    }

    const events = await readRecentEvents(runId, 6);
    if (events.length > 0) {
      console.log('  Recent Events:');
      for (const event of events) {
        const when = event.ts ? event.ts.slice(11, 19) : '';
        const who = event.agent || '?';
        const what = event.activity || event.tool || 'event';
        const ok = event.ok === false ? '!' : '-';
        console.log(`    ${ok} ${when} ${who} - ${what}`);
      }
      console.log('');
    }
  } catch (error) {
    console.log(`  Error: ${error.message}`);
    console.log('');
  }

  console.log(`  Updated: ${new Date().toISOString()}`);
  console.log('');
}

async function findMostRecentRun() {
  const runsDir = join(RUNTIME_DIR, 'runs');
  try {
    const entries = await readdir(runsDir, { withFileTypes: true });
    const runDirs = entries.filter(e => e.isDirectory()).map(e => e.name);
    if (runDirs.length === 0) return null;

    const scored = await Promise.all(
      runDirs.map(async name => {
        try {
          const s = await stat(join(runsDir, name));
          return { name, mtimeMs: Number(s.mtimeMs) || 0 };
        } catch {
          return { name, mtimeMs: 0 };
        }
      })
    );

    scored.sort((a, b) => b.mtimeMs - a.mtimeMs);
    return scored[0]?.name || null;
  } catch {
    return null;
  }
}

async function loadRunState(runId) {
  const candidates = [];

  // Primary: active project runtime (new layout)
  candidates.push(join(RUNTIME_DIR, 'runs', runId, 'state.json'));
  candidates.push(join(RUNTIME_DIR, 'runs', runId, 'run.json'));

  // Fallback: base runtime (legacy layout, no project scoping)
  candidates.push(join(BASE_RUNTIME_DIR, 'runs', runId, 'state.json'));
  candidates.push(join(BASE_RUNTIME_DIR, 'runs', runId, 'run.json'));

  // Fallback: search all projects for a matching run id (useful when the active project differs)
  try {
    const projectsDir = join(BASE_RUNTIME_DIR, 'projects');
    const projects = await readdir(projectsDir, { withFileTypes: true });
    for (const p of projects) {
      if (!p.isDirectory()) continue;
      candidates.push(join(projectsDir, p.name, 'runs', runId, 'state.json'));
      candidates.push(join(projectsDir, p.name, 'runs', runId, 'run.json'));
    }
  } catch {
    // ignore
  }

  for (const path of candidates) {
    try {
      const content = await readFile(path, 'utf-8');
      return JSON.parse(content);
    } catch {
      // try next
    }
  }

  // legacy tmp location
  const altFile = join(PROJECT_ROOT, '.claude', 'context', 'tmp', `run-state-${runId}.json`);
  try {
    const content = await readFile(altFile, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function readRecentEvents(runId, limit = 5) {
  const eventsPaths = [
    join(RUNTIME_DIR, 'runs', runId, 'events.ndjson'),
    join(BASE_RUNTIME_DIR, 'runs', runId, 'events.ndjson'),
  ];

  try {
    for (const eventsPath of eventsPaths) {
      try {
        const content = await readFile(eventsPath, 'utf-8');
        const lines = content.trim().split(/\r?\n/).filter(Boolean);
        const tail = lines.slice(-limit);
        return tail
          .map(line => {
            try {
              return JSON.parse(line);
            } catch {
              return null;
            }
          })
          .filter(Boolean);
      } catch {
        // try next
      }
    }
    return [];
  } catch {
    return [];
  }
}

async function findArtifacts(runId) {
  const artifactsDir = join(RUNTIME_DIR, 'runs', runId, 'artifacts');
  try {
    const entries = await readdir(artifactsDir, { withFileTypes: true });
    return entries.filter(e => e.isFile()).map(e => join(artifactsDir, e.name));
  } catch {
    return [];
  }
}

function formatStatus(status) {
  switch (String(status || '').toLowerCase()) {
    case 'running':
    case 'in_progress':
      return 'Running';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    case 'paused':
      return 'Paused';
    default:
      return status || 'Unknown';
  }
}

function renderProgressBar(percent, width = 40) {
  const clamped = Math.max(0, Math.min(100, Number(percent) || 0));
  const filled = Math.round((clamped / 100) * width);
  const empty = width - filled;
  return `[${'#'.repeat(filled)}${'.'.repeat(empty)}]`;
}

function calculateDuration(startTime) {
  const start = new Date(startTime);
  const diffMs = Date.now() - start.getTime();
  const minutes = Math.floor(diffMs / 60000);
  const seconds = Math.floor((diffMs % 60000) / 1000);
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function estimateRemaining(startTime, progressPercent) {
  if (!progressPercent) return 'Calculating...';
  const start = new Date(startTime);
  const elapsed = Date.now() - start.getTime();
  const totalEstimated = (elapsed / progressPercent) * 100;
  const remaining = totalEstimated - elapsed;
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  return minutes > 0 ? `~${minutes}m ${seconds}s` : `~${seconds}s`;
}

const args = process.argv.slice(2);
const help = args.includes('--help') || args.includes('-h');
const watch = args.includes('--watch');
const noClear = args.includes('--no-clear');

const runIdIndex = args.indexOf('--run-id');
const runId = runIdIndex >= 0 ? args[runIdIndex + 1] : null;

const intervalIndex = args.indexOf('--interval');
const intervalSeconds = intervalIndex >= 0 ? Number(args[intervalIndex + 1] || 30) : 30;

const iterationsIndex = args.indexOf('--iterations');
const iterations =
  iterationsIndex >= 0 ? Math.max(1, Number(args[iterationsIndex + 1] || 1)) : null;

if (help) {
  printHelp();
  process.exit(0);
}

if (watch) {
  const intervalMs =
    Number.isFinite(intervalSeconds) && intervalSeconds > 0 ? intervalSeconds * 1000 : 30000;
  (async () => {
    let remaining = iterations;
    while (remaining == null || remaining > 0) {
      if (!noClear) console.clear();
      await displayDashboard(runId);
      await new Promise(r => setTimeout(r, intervalMs));
      if (remaining != null) remaining -= 1;
    }
  })();
} else {
  displayDashboard(runId);
}
