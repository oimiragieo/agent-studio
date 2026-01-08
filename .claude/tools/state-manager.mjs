#!/usr/bin/env node
/**
 * State Manager - Prevents context poisoning in multi-agent orchestration
 *
 * Features:
 * - Automatic compression when state exceeds thresholds
 * - Context budgets per agent type
 * - Windowed history (keeps last N handoffs)
 * - File-based canonical state (not context-dependent)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONTEXT_DIR = path.join(__dirname, '..', 'context', 'runs');

// Context budgets by agent type (in bytes)
const CONTEXT_BUDGETS = {
  opus: 16000,    // Opus agents get more context
  sonnet: 12000,  // Sonnet agents medium
  haiku: 6000,    // Haiku agents minimal
  default: 10000
};

// Compression thresholds
const THRESHOLDS = {
  maxStateSize: 10240,      // 10KB triggers compression
  maxHandoffs: 5,           // Keep last 5 handoffs
  maxAgentOutput: 2048,     // 2KB max per agent output
  maxHistoryChars: 2000     // Compressed history limit
};

class StateManager {
  constructor(runId) {
    this.runId = runId;
    this.stateDir = path.join(CONTEXT_DIR, runId);
    this.statePath = path.join(this.stateDir, 'state.json');
    this.handoffsDir = path.join(this.stateDir, 'handoffs');
  }

  // Initialize new run state
  init(workflow, goal) {
    if (!fs.existsSync(this.stateDir)) {
      fs.mkdirSync(this.stateDir, { recursive: true });
    }
    if (!fs.existsSync(this.handoffsDir)) {
      fs.mkdirSync(this.handoffsDir, { recursive: true });
    }

    const state = {
      run_id: this.runId,
      workflow: workflow,
      current_step: 0,
      goal: this.truncate(goal, 500),
      decisions: [],
      artifacts: [],
      active_agents: [],
      compressed_history: '',
      handoff_count: 0,
      metrics: {
        total_handoffs: 0,
        compression_count: 0,
        bytes_saved: 0,
        created_at: new Date().toISOString()
      }
    };

    this.saveState(state);
    return state;
  }

  // Get current state, optionally compressed for specific agent
  get(agentType = 'default') {
    const state = this.loadState();
    const budget = CONTEXT_BUDGETS[agentType] || CONTEXT_BUDGETS.default;

    // Check if compression needed
    const stateSize = JSON.stringify(state).length;
    if (stateSize > budget) {
      return this.compressForAgent(state, budget);
    }

    return state;
  }

  // Update state with new information
  update(updates) {
    const state = this.loadState();

    // Merge updates
    if (updates.decision) {
      state.decisions.push(this.truncate(updates.decision, 100));
      // Keep only last 10 decisions
      if (state.decisions.length > 10) {
        state.decisions = state.decisions.slice(-10);
      }
    }

    if (updates.artifact) {
      state.artifacts.push({
        name: updates.artifact.name,
        path: updates.artifact.path,
        added_at: new Date().toISOString()
      });
    }

    if (updates.step !== undefined) {
      state.current_step = updates.step;
    }

    if (updates.agent) {
      if (!state.active_agents.includes(updates.agent)) {
        state.active_agents.push(updates.agent);
      }
    }

    if (updates.history) {
      state.compressed_history = this.appendHistory(
        state.compressed_history,
        updates.history
      );
    }

    // Auto-compress if needed
    const stateSize = JSON.stringify(state).length;
    if (stateSize > THRESHOLDS.maxStateSize) {
      this.prune(state);
    }

    this.saveState(state);
    return state;
  }

  // Prepare state for agent handoff
  handoff(fromAgent, toAgent, summary) {
    const state = this.loadState();

    // Record handoff
    const handoff = {
      id: `handoff-${state.handoff_count + 1}`,
      from: fromAgent,
      to: toAgent,
      summary: this.truncate(summary, THRESHOLDS.maxAgentOutput),
      timestamp: new Date().toISOString()
    };

    // Save handoff to file
    const handoffPath = path.join(this.handoffsDir, `${handoff.id}.json`);
    fs.writeFileSync(handoffPath, JSON.stringify(handoff, null, 2));

    // Update state
    state.handoff_count++;
    state.metrics.total_handoffs++;

    // Compress history with handoff summary
    state.compressed_history = this.appendHistory(
      state.compressed_history,
      `[${fromAgent}→${toAgent}]: ${this.truncate(summary, 200)}`
    );

    // Window old handoffs
    this.windowHandoffs();

    // Get budget for target agent
    const agentModel = this.getAgentModel(toAgent);
    const budget = CONTEXT_BUDGETS[agentModel] || CONTEXT_BUDGETS.default;

    this.saveState(state);

    // Return compressed state for target agent
    return this.compressForAgent(state, budget);
  }

  // Manually trigger compression
  prune(state = null) {
    state = state || this.loadState();
    const originalSize = JSON.stringify(state).length;

    // Compress decisions (keep summaries)
    if (state.decisions.length > 5) {
      const oldDecisions = state.decisions.slice(0, -5);
      const summary = `[${oldDecisions.length} earlier decisions compressed]`;
      state.decisions = [summary, ...state.decisions.slice(-5)];
    }

    // Truncate history
    if (state.compressed_history.length > THRESHOLDS.maxHistoryChars) {
      state.compressed_history = '...' +
        state.compressed_history.slice(-THRESHOLDS.maxHistoryChars + 3);
    }

    // Clear inactive agents
    state.active_agents = state.active_agents.slice(-3);

    const newSize = JSON.stringify(state).length;
    state.metrics.compression_count++;
    state.metrics.bytes_saved += (originalSize - newSize);

    this.saveState(state);

    return {
      original_size: originalSize,
      new_size: newSize,
      bytes_saved: originalSize - newSize,
      compression_ratio: (1 - newSize / originalSize).toFixed(2)
    };
  }

  // Get statistics
  stats() {
    const state = this.loadState();
    const stateSize = JSON.stringify(state).length;

    // Count handoff files
    let handoffCount = 0;
    try {
      handoffCount = fs.readdirSync(this.handoffsDir).length;
    } catch (e) {}

    return {
      run_id: this.runId,
      state_size_bytes: stateSize,
      state_size_kb: (stateSize / 1024).toFixed(2),
      handoff_files: handoffCount,
      decisions_count: state.decisions.length,
      artifacts_count: state.artifacts.length,
      active_agents: state.active_agents,
      metrics: state.metrics,
      thresholds: THRESHOLDS,
      budgets: CONTEXT_BUDGETS
    };
  }

  // Helper methods
  loadState() {
    try {
      return JSON.parse(fs.readFileSync(this.statePath, 'utf8'));
    } catch (e) {
      throw new Error(`State not found for run ${this.runId}. Run 'init' first.`);
    }
  }

  saveState(state) {
    state.updated_at = new Date().toISOString();
    fs.writeFileSync(this.statePath, JSON.stringify(state, null, 2));
  }

  truncate(str, maxLen) {
    if (!str) return '';
    return str.length > maxLen ? str.slice(0, maxLen - 3) + '...' : str;
  }

  appendHistory(existing, newEntry) {
    const combined = existing ? `${existing}\n${newEntry}` : newEntry;
    if (combined.length > THRESHOLDS.maxHistoryChars) {
      return '...' + combined.slice(-THRESHOLDS.maxHistoryChars + 3);
    }
    return combined;
  }

  windowHandoffs() {
    try {
      const files = fs.readdirSync(this.handoffsDir)
        .sort()
        .map(f => path.join(this.handoffsDir, f));

      // Keep only last N handoffs
      if (files.length > THRESHOLDS.maxHandoffs) {
        const toDelete = files.slice(0, files.length - THRESHOLDS.maxHandoffs);
        toDelete.forEach(f => fs.unlinkSync(f));
      }
    } catch (e) {}
  }

  compressForAgent(state, budget) {
    const compressed = { ...state };
    let size = JSON.stringify(compressed).length;

    // Progressive compression until under budget
    while (size > budget) {
      // First: truncate history more aggressively
      if (compressed.compressed_history.length > 500) {
        compressed.compressed_history = '...' +
          compressed.compressed_history.slice(-500);
        size = JSON.stringify(compressed).length;
        continue;
      }

      // Second: reduce decisions
      if (compressed.decisions.length > 3) {
        compressed.decisions = compressed.decisions.slice(-3);
        size = JSON.stringify(compressed).length;
        continue;
      }

      // Third: remove artifacts details
      if (compressed.artifacts.length > 0) {
        compressed.artifacts = compressed.artifacts.map(a => ({
          name: a.name,
          path: a.path
        }));
        size = JSON.stringify(compressed).length;
        continue;
      }

      // Can't compress further
      break;
    }

    compressed._compressed = true;
    compressed._budget = budget;
    compressed._actual_size = size;

    return compressed;
  }

  getAgentModel(agentName) {
    // Map agent names to model types
    const opusAgents = [
      'orchestrator', 'architect', 'database-architect', 'qa',
      'security-architect', 'code-reviewer', 'refactoring-specialist',
      'performance-engineer', 'llm-architect', 'api-designer',
      'legacy-modernizer', 'compliance-auditor', 'planner',
      'ai-council', 'master-orchestrator'
    ];

    const haikuAgents = ['technical-writer'];

    if (opusAgents.includes(agentName)) return 'opus';
    if (haikuAgents.includes(agentName)) return 'haiku';
    return 'sonnet';
  }
}

// CLI Interface
function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  function getArg(name) {
    const idx = args.indexOf(`--${name}`);
    return idx !== -1 ? args[idx + 1] : null;
  }

  function hasFlag(name) {
    return args.includes(`--${name}`);
  }

  if (hasFlag('help') || !command) {
    console.log(`
State Manager - Prevents context poisoning in multi-agent orchestration

Usage: node state-manager.mjs <command> [options]

Commands:
  init       Initialize new run state
  get        Get current state (optionally compressed for agent)
  update     Update state with new information
  handoff    Prepare state for agent transition
  prune      Manually trigger compression
  stats      Show context size metrics

Options:
  --run-id <id>       Run ID (required for all commands)
  --workflow <name>   Workflow name (for init)
  --goal <text>       Goal description (for init)
  --agent <name>      Agent name (for get, update, handoff)
  --from <agent>      Source agent (for handoff)
  --to <agent>        Target agent (for handoff)
  --summary <text>    Handoff summary (for handoff)
  --decision <text>   Add decision (for update)
  --artifact <json>   Add artifact (for update)
  --step <n>          Update current step (for update)
  --json              Output as JSON
  --help              Show this help

Examples:
  node state-manager.mjs init --run-id run-001 --workflow quick-flow --goal "Fix bug"
  node state-manager.mjs get --run-id run-001 --agent developer
  node state-manager.mjs handoff --run-id run-001 --from architect --to developer --summary "Design complete"
  node state-manager.mjs stats --run-id run-001 --json
`);
    process.exit(0);
  }

  const runId = getArg('run-id');
  if (!runId && command !== 'help') {
    console.error('Error: --run-id is required');
    process.exit(1);
  }

  const manager = new StateManager(runId);
  const json = hasFlag('json');

  try {
    let result;

    switch (command) {
      case 'init':
        result = manager.init(getArg('workflow') || 'unknown', getArg('goal') || '');
        break;

      case 'get':
        result = manager.get(getArg('agent'));
        break;

      case 'update':
        const updates = {};
        if (getArg('decision')) updates.decision = getArg('decision');
        if (getArg('step')) updates.step = parseInt(getArg('step'));
        if (getArg('agent')) updates.agent = getArg('agent');
        if (getArg('artifact')) updates.artifact = JSON.parse(getArg('artifact'));
        if (getArg('history')) updates.history = getArg('history');
        result = manager.update(updates);
        break;

      case 'handoff':
        result = manager.handoff(
          getArg('from'),
          getArg('to'),
          getArg('summary') || ''
        );
        break;

      case 'prune':
        result = manager.prune();
        break;

      case 'stats':
        result = manager.stats();
        break;

      default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
    }

    if (json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(result);
    }

  } catch (e) {
    console.error(`Error: ${e.message}`);
    process.exit(1);
  }
}

main();
