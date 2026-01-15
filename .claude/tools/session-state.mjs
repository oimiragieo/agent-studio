#!/usr/bin/env node
/**
 * Session State Manager
 *
 * Manages session state for both orchestrator and router sessions.
 * Supports model tracking, session metrics, and cost persistence.
 *
 * Features:
 * - Orchestrator session tracking (violations, read counts)
 * - Router session tracking (model usage, routing decisions, costs)
 * - Atomic file writes with locking
 * - Session metrics and analytics
 * - Cost tracking and aggregation
 *
 * @module session-state
 */

import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  unlinkSync,
  readdirSync,
  statSync,
} from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { resolveRuntimePath } from './context-path-resolver.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ===========================
// Configuration & Constants
// ===========================

const SESSION_STATE_DIR = resolveRuntimePath('sessions', { write: true });
const ORCHESTRATOR_SESSION_PATH = resolveRuntimePath('tmp/orchestrator-session-state.json', {
  write: true,
});
const SETTINGS_PATH = join(__dirname, '..', 'settings.json');
const LOCK_TIMEOUT_MS = 5000; // 5 seconds

// Model pricing (per million tokens) - Updated from Anthropic model announcements
const MODEL_PRICING = {
  'claude-haiku-4-5': {
    input: 1.0,
    output: 5.0,
  },
  'claude-sonnet-4-5': {
    input: 3.0,
    output: 15.0,
  },
  'claude-opus-4-5-20251101': {
    input: 5.0,
    output: 25.0,
  },
};

const MODEL_ALIASES = {
  'claude-3-5-haiku-20241022': 'claude-haiku-4-5',
  'claude-3-5-sonnet-20241022': 'claude-sonnet-4-5',
  'claude-3-opus-20240229': 'claude-opus-4-5-20251101',
  'claude-sonnet-4-20250514': 'claude-sonnet-4-5',
  'claude-opus-4-20241113': 'claude-opus-4-5-20251101',
};

function normalizeModelId(modelId) {
  return MODEL_ALIASES[modelId] || modelId;
}

// ===========================
// Session Initialization
// ===========================

/**
 * Initialize new session
 *
 * @param {string} sessionId - Unique session identifier
 * @param {string} agentRole - Role: 'orchestrator', 'router', or agent name
 * @param {Object} metadata - Additional session metadata
 * @param {string} metadata.model - Model to use (optional, defaults from settings)
 * @param {string} metadata.initialPrompt - Initial user prompt (optional)
 * @returns {Object} Initialized session state
 */
export function initSession(sessionId, agentRole = 'orchestrator', metadata = {}) {
  const settings = loadSettings();

  // Determine model based on role
  const defaultModel =
    agentRole === 'router'
      ? normalizeModelId(settings.models?.router || 'claude-haiku-4-5')
      : normalizeModelId(settings.models?.orchestrator || 'claude-sonnet-4-5');

  const state = {
    session_id: sessionId || `sess_${Date.now()}`,
    agent_role: agentRole,
    model: normalizeModelId(metadata.model || defaultModel),
    modelHistory: [
      {
        model: normalizeModelId(metadata.model || defaultModel),
        timestamp: new Date().toISOString(),
        reason: 'initial_session',
      },
    ],
    read_count: 0,
    violations: [],
    files_read: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),

    // Router-specific metrics
    routingDecisions: {
      total: 0,
      simpleHandled: 0,
      routedToOrchestrator: 0,
      averageComplexity: 0.0,
      averageConfidence: 0.0,
    },

    // Cost tracking
    costs: {
      haiku: { inputTokens: 0, outputTokens: 0, costUSD: 0.0 },
      sonnet: { inputTokens: 0, outputTokens: 0, costUSD: 0.0 },
      opus: { inputTokens: 0, outputTokens: 0, costUSD: 0.0 },
      total: 0.0,
    },

    // Optional: initial prompt for router sessions
    initial_prompt: metadata.initialPrompt || null,

    // Session metadata
    metadata: metadata || {},
  };

  // Save to appropriate location
  if (agentRole === 'orchestrator') {
    saveOrchestratorSession(state);
  } else {
    saveSession(sessionId, state);
  }

  return state;
}

/**
 * Load session state
 *
 * @param {string} sessionId - Session identifier (optional for orchestrator)
 * @returns {Object|null} Session state or null if not found
 */
export function loadSessionState(sessionId = null) {
  try {
    // If no sessionId provided, try to load orchestrator session
    if (!sessionId) {
      return loadOrchestratorSession();
    }

    // Load from session directory
    const sessionPath = join(SESSION_STATE_DIR, `${sessionId}.json`);
    if (existsSync(sessionPath)) {
      return JSON.parse(readFileSync(sessionPath, 'utf-8'));
    }

    // Fallback: check if it's an orchestrator session
    if (sessionId === 'orchestrator' || sessionId.startsWith('orch-')) {
      return loadOrchestratorSession();
    }

    return null;
  } catch (e) {
    console.error('Error loading session state:', e.message);
    return null;
  }
}

/**
 * Update session state
 *
 * @param {string} sessionId - Session identifier
 * @param {Object} updates - Partial state updates
 * @returns {Object} Updated session state
 */
export function updateSessionState(sessionId, updates) {
  const state = loadSessionState(sessionId);
  if (!state) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  // Merge updates
  const updatedState = {
    ...state,
    ...updates,
    updated_at: new Date().toISOString(),
  };

  // Save based on agent role
  if (state.agent_role === 'orchestrator') {
    saveOrchestratorSession(updatedState);
  } else {
    saveSession(sessionId, updatedState);
  }

  return updatedState;
}

/**
 * Clear session state
 *
 * @param {string} sessionId - Session identifier (optional for orchestrator)
 */
export function clearSession(sessionId = null) {
  if (!sessionId || sessionId === 'orchestrator') {
    // Clear orchestrator session
    if (existsSync(ORCHESTRATOR_SESSION_PATH)) {
      unlinkSync(ORCHESTRATOR_SESSION_PATH);
    }
  } else {
    // Clear specific session
    const sessionPath = join(SESSION_STATE_DIR, `${sessionId}.json`);
    if (existsSync(sessionPath)) {
      unlinkSync(sessionPath);
    }
  }
}

// ===========================
// Router-Specific Functions
// ===========================

/**
 * Record routing decision
 *
 * @param {string} sessionId - Session identifier
 * @param {Object} decision - Routing decision object
 * @param {string} decision.type - 'simple' | 'orchestrator'
 * @param {number} decision.complexity - Complexity score (0-1)
 * @param {number} decision.confidence - Confidence score (0-1)
 * @param {string} decision.workflow - Selected workflow path (optional)
 * @returns {Object} Updated session state
 */
export function recordRoutingDecision(sessionId, decision) {
  const state = loadSessionState(sessionId);
  if (!state) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  // Update routing metrics
  state.routingDecisions.total++;

  if (decision.type === 'simple') {
    state.routingDecisions.simpleHandled++;
  } else if (decision.type === 'orchestrator') {
    state.routingDecisions.routedToOrchestrator++;
  }

  // Update averages (running average)
  const total = state.routingDecisions.total;
  state.routingDecisions.averageComplexity =
    (state.routingDecisions.averageComplexity * (total - 1) + decision.complexity) / total;
  state.routingDecisions.averageConfidence =
    (state.routingDecisions.averageConfidence * (total - 1) + decision.confidence) / total;

  // Record decision in metadata
  if (!state.metadata.routingHistory) {
    state.metadata.routingHistory = [];
  }
  state.metadata.routingHistory.push({
    timestamp: new Date().toISOString(),
    type: decision.type,
    complexity: decision.complexity,
    confidence: decision.confidence,
    workflow: decision.workflow || null,
  });

  state.updated_at = new Date().toISOString();
  saveSession(sessionId, state);

  return state;
}

/**
 * Update model usage and calculate costs
 *
 * @param {string} sessionId - Session identifier
 * @param {string} model - Model identifier (e.g., 'claude-haiku-4-5')
 * @param {number} inputTokens - Input token count
 * @param {number} outputTokens - Output token count
 * @returns {Object} Cost summary for this update
 */
export function updateModelUsage(sessionId, model, inputTokens, outputTokens) {
  const state = loadSessionState(sessionId);
  if (!state) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  const normalizedModel = normalizeModelId(model);

  // Get pricing for model
  const pricing = MODEL_PRICING[normalizedModel];
  if (!pricing) {
    console.warn(`No pricing found for model: ${normalizedModel}, using Haiku pricing`);
  }
  const modelPricing = pricing || MODEL_PRICING['claude-haiku-4-5'];

  // Calculate costs (pricing is per million tokens)
  const inputCost = (inputTokens / 1_000_000) * modelPricing.input;
  const outputCost = (outputTokens / 1_000_000) * modelPricing.output;
  const totalCost = inputCost + outputCost;

  // Determine model category (haiku, sonnet, opus)
  let modelCategory = 'haiku';
  if (normalizedModel.includes('sonnet')) {
    modelCategory = 'sonnet';
  } else if (normalizedModel.includes('opus')) {
    modelCategory = 'opus';
  }

  // Update costs
  state.costs[modelCategory].inputTokens += inputTokens;
  state.costs[modelCategory].outputTokens += outputTokens;
  state.costs[modelCategory].costUSD += totalCost;
  state.costs.total += totalCost;

  // Record model usage in history
  if (state.model !== normalizedModel) {
    state.modelHistory.push({
      model: normalizedModel,
      timestamp: new Date().toISOString(),
      reason: 'model_switch',
    });
    state.model = normalizedModel;
  }

  state.updated_at = new Date().toISOString();
  saveSession(sessionId, state);

  return {
    inputTokens,
    outputTokens,
    costUSD: totalCost,
    model: normalizedModel,
    modelCategory,
  };
}

/**
 * Get session costs
 *
 * @param {string} sessionId - Session identifier
 * @returns {Object} Cost breakdown
 */
export function getSessionCosts(sessionId) {
  const state = loadSessionState(sessionId);
  if (!state) {
    return {
      error: 'Session not found',
      total: 0,
    };
  }

  return {
    sessionId,
    costs: state.costs,
    modelHistory: state.modelHistory,
    createdAt: state.created_at,
    updatedAt: state.updated_at,
  };
}

/**
 * Get routing metrics
 *
 * @param {string} sessionId - Session identifier
 * @returns {Object} Routing metrics
 */
export function getRoutingMetrics(sessionId) {
  const state = loadSessionState(sessionId);
  if (!state) {
    return {
      error: 'Session not found',
      total: 0,
    };
  }

  return {
    sessionId,
    metrics: state.routingDecisions,
    routingHistory: state.metadata.routingHistory || [],
    createdAt: state.created_at,
    updatedAt: state.updated_at,
  };
}

// ===========================
// Orchestrator-Specific Functions
// ===========================

/**
 * Reset read counter (e.g., after Task spawn)
 */
export function resetReadCounter() {
  const state = loadOrchestratorSession();
  if (state) {
    state.read_count = 0;
    state.files_read = [];
    state.updated_at = new Date().toISOString();
    saveOrchestratorSession(state);
  }
}

/**
 * Add violation to session
 *
 * @param {Object} violation - Violation object
 */
export function addViolation(violation) {
  const state = loadOrchestratorSession();
  if (state) {
    state.violations.push({
      ...violation,
      timestamp: new Date().toISOString(),
    });
    state.updated_at = new Date().toISOString();
    saveOrchestratorSession(state);
  }
}

/**
 * Get compliance summary
 *
 * @returns {Object} Compliance summary
 */
export function getComplianceSummary() {
  const state = loadOrchestratorSession();
  if (!state) {
    return {
      valid: true,
      compliance_score: 100,
      message: 'No orchestrator session found',
    };
  }

  const totalCalls = state.read_count + state.violations.length;
  const blockedCount = state.violations.filter(v => v.blocked).length;

  const complianceScore =
    totalCalls === 0 ? 100 : Math.round(((totalCalls - blockedCount) / totalCalls) * 100);

  return {
    valid: complianceScore >= 80,
    compliance_score: complianceScore,
    total_tool_calls: totalCalls,
    violations: {
      blocked: blockedCount,
      allowed: totalCalls - blockedCount,
    },
    violation_breakdown: groupViolationsByType(state.violations),
  };
}

/**
 * Group violations by type
 *
 * @param {Array} violations - Violations array
 * @returns {Array} Grouped violations
 */
function groupViolationsByType(violations) {
  const groups = {};

  for (const v of violations) {
    if (!groups[v.type]) {
      groups[v.type] = { count: 0, blocked: v.blocked };
    }
    groups[v.type].count++;
  }

  return Object.entries(groups).map(([type, data]) => ({ type, ...data }));
}

// ===========================
// File Operations (Atomic)
// ===========================

/**
 * Save session state to session directory
 *
 * @param {string} sessionId - Session identifier
 * @param {Object} state - Session state
 */
function saveSession(sessionId, state) {
  const dir = SESSION_STATE_DIR;
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const sessionPath = join(dir, `${sessionId}.json`);

  // Atomic write with lock
  atomicWrite(sessionPath, JSON.stringify(state, null, 2));
}

/**
 * Save orchestrator session state
 *
 * @param {Object} state - Session state
 */
function saveOrchestratorSession(state) {
  const dir = dirname(ORCHESTRATOR_SESSION_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  atomicWrite(ORCHESTRATOR_SESSION_PATH, JSON.stringify(state, null, 2));
}

/**
 * Load orchestrator session state
 *
 * @returns {Object|null} Session state or null
 */
function loadOrchestratorSession() {
  try {
    if (existsSync(ORCHESTRATOR_SESSION_PATH)) {
      return JSON.parse(readFileSync(ORCHESTRATOR_SESSION_PATH, 'utf-8'));
    }
  } catch (e) {
    console.error('Error loading orchestrator session:', e.message);
  }

  return null;
}

/**
 * Atomic write with file locking
 *
 * @param {string} filePath - File path
 * @param {string} content - File content
 */
function atomicWrite(filePath, content) {
  const lockPath = `${filePath}.lock`;
  const tempPath = `${filePath}.tmp`;

  try {
    // Attempt to acquire lock
    const lockAcquired = acquireLock(lockPath);
    if (!lockAcquired) {
      throw new Error(`Failed to acquire lock for ${filePath}`);
    }

    // Write to temp file
    writeFileSync(tempPath, content, 'utf-8');

    // Rename temp to actual (atomic on most filesystems)
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
    writeFileSync(filePath, content, 'utf-8');

    // Clean up temp
    if (existsSync(tempPath)) {
      unlinkSync(tempPath);
    }
  } finally {
    // Release lock
    releaseLock(lockPath);
  }
}

/**
 * Acquire file lock
 *
 * @param {string} lockPath - Lock file path
 * @returns {boolean} True if lock acquired
 */
function acquireLock(lockPath) {
  const startTime = Date.now();

  while (Date.now() - startTime < LOCK_TIMEOUT_MS) {
    try {
      // Try to create lock file (exclusive)
      if (!existsSync(lockPath)) {
        writeFileSync(lockPath, Date.now().toString(), { flag: 'wx' });
        return true;
      }

      // Check if lock is stale (older than timeout)
      const lockTime = parseInt(readFileSync(lockPath, 'utf-8'));
      if (Date.now() - lockTime > LOCK_TIMEOUT_MS) {
        // Remove stale lock
        unlinkSync(lockPath);
      }

      // Wait a bit before retry
      // eslint-disable-next-line no-await-in-loop
      sleepSync(50); // 50ms
    } catch (e) {
      // Lock already exists, retry
      sleepSync(50);
    }
  }

  return false;
}

/**
 * Release file lock
 *
 * @param {string} lockPath - Lock file path
 */
function releaseLock(lockPath) {
  try {
    if (existsSync(lockPath)) {
      unlinkSync(lockPath);
    }
  } catch (e) {
    // Ignore errors on lock release
  }
}

/**
 * Synchronous sleep (for lock retry)
 *
 * @param {number} ms - Milliseconds to sleep
 */
function sleepSync(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    // Busy wait
  }
}

// ===========================
// Utility Functions
// ===========================

/**
 * Load settings from settings.json
 *
 * @returns {Object} Settings object
 */
function loadSettings() {
  try {
    if (existsSync(SETTINGS_PATH)) {
      return JSON.parse(readFileSync(SETTINGS_PATH, 'utf-8'));
    }
  } catch (e) {
    console.error('Error loading settings:', e.message);
  }

  // Return defaults
  return {
    models: {
      router: 'claude-haiku-4-5',
      orchestrator: 'claude-sonnet-4-5',
      complex: 'claude-opus-4-5-20251101',
    },
    session: {
      default_model: 'claude-haiku-4-5',
      default_temperature: 0.1,
      default_role: 'router',
    },
  };
}

/**
 * List all active sessions
 *
 * @returns {Array} Array of session IDs
 */
export function listSessions() {
  const sessions = [];

  try {
    if (existsSync(SESSION_STATE_DIR)) {
      const files = readdirSync(SESSION_STATE_DIR);
      for (const file of files) {
        if (file.endsWith('.json') && !file.endsWith('.lock')) {
          sessions.push(file.replace('.json', ''));
        }
      }
    }

    // Add orchestrator session if exists
    if (existsSync(ORCHESTRATOR_SESSION_PATH)) {
      sessions.push('orchestrator');
    }
  } catch (e) {
    console.error('Error listing sessions:', e.message);
  }

  return sessions;
}

/**
 * Clean up old sessions (older than 24 hours)
 *
 * @returns {number} Number of sessions cleaned
 */
export function cleanupOldSessions() {
  let cleaned = 0;
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  const now = Date.now();

  try {
    if (existsSync(SESSION_STATE_DIR)) {
      const files = readdirSync(SESSION_STATE_DIR);
      for (const file of files) {
        if (!file.endsWith('.json') || file.endsWith('.lock')) continue;

        const filePath = join(SESSION_STATE_DIR, file);
        const stats = statSync(filePath);

        if (now - stats.mtimeMs > maxAge) {
          unlinkSync(filePath);
          cleaned++;
        }
      }
    }
  } catch (e) {
    console.error('Error cleaning sessions:', e.message);
  }

  return cleaned;
}

// ===========================
// CLI Interface
// ===========================

if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];

  switch (command) {
    case 'init': {
      const sessionId = process.argv[3] || `sess_${Date.now()}`;
      const role = process.argv[4] || 'router';
      const state = initSession(sessionId, role);
      console.log('Session initialized:', state.session_id);
      console.log(JSON.stringify(state, null, 2));
      break;
    }

    case 'reset':
      resetReadCounter();
      console.log('Read counter reset');
      break;

    case 'summary':
      const summary = getComplianceSummary();
      console.log(JSON.stringify(summary, null, 2));
      break;

    case 'clear': {
      const sessionId = process.argv[3];
      clearSession(sessionId);
      console.log(`Session cleared: ${sessionId || 'orchestrator'}`);
      break;
    }

    case 'list': {
      const sessions = listSessions();
      console.log('Active sessions:', sessions);
      break;
    }

    case 'cleanup': {
      const cleaned = cleanupOldSessions();
      console.log(`Cleaned ${cleaned} old sessions`);
      break;
    }

    case 'costs': {
      const sessionId = process.argv[3];
      if (!sessionId) {
        console.error('Usage: session-state.mjs costs <session-id>');
        process.exit(1);
      }
      const costs = getSessionCosts(sessionId);
      console.log(JSON.stringify(costs, null, 2));
      break;
    }

    case 'metrics': {
      const sessionId = process.argv[3];
      if (!sessionId) {
        console.error('Usage: session-state.mjs metrics <session-id>');
        process.exit(1);
      }
      const metrics = getRoutingMetrics(sessionId);
      console.log(JSON.stringify(metrics, null, 2));
      break;
    }

    default:
      console.log(`
Session State Manager CLI

Commands:
  init <session-id> <role>     - Initialize session (role: router|orchestrator)
  reset                        - Reset orchestrator read counter
  summary                      - Get orchestrator compliance summary
  clear <session-id>           - Clear session (omit for orchestrator)
  list                         - List all active sessions
  cleanup                      - Clean up old sessions (>24h)
  costs <session-id>           - Get cost breakdown for session
  metrics <session-id>         - Get routing metrics for session

Examples:
  node session-state.mjs init test-123 router
  node session-state.mjs costs test-123
  node session-state.mjs metrics test-123
  node session-state.mjs cleanup
      `);
  }
}
