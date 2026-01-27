#!/usr/bin/env node
/**
 * anomaly-detector.cjs
 * Hook for detecting system anomalies in the multi-agent framework
 *
 * Detects:
 * | Anomaly              | Detection Logic                    | Threshold        |
 * |----------------------|-----------------------------------|------------------|
 * | Token explosion      | Token count > 2x average          | configurable     |
 * | Duration spike       | Execution time > 3x average       | configurable     |
 * | Repeated failures    | Same tool fails 3+ times          | 3 failures       |
 * | Infinite loop risk   | Same prompt pattern repeating     | 2 repetitions    |
 * | Resource exhaustion  | Memory/CPU metrics                 | system-defined   |
 *
 * Output: Logs to `.claude/context/self-healing/anomaly-log.jsonl`
 *
 * Environment Variables:
 *   ANOMALY_DETECTION_ENABLED=false  - Disable detection
 *   ANOMALY_TOKEN_MULTIPLIER=2       - Token explosion threshold (default: 2x)
 *   ANOMALY_DURATION_MULTIPLIER=3    - Duration spike threshold (default: 3x)
 *   ANOMALY_FAILURE_COUNT=3          - Repeated failure threshold (default: 3)
 *   ANOMALY_PATTERN_REPS=2           - Loop risk threshold (default: 2)
 *
 * Exit codes:
 *   0 - Always (detection is advisory, never blocks)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

// Configurable paths (can be overridden for testing)
let STATE_FILE = path.join(
  PROJECT_ROOT,
  '.claude',
  'context',
  'self-healing',
  'anomaly-state.json'
);
let ANOMALY_LOG = path.join(
  PROJECT_ROOT,
  '.claude',
  'context',
  'self-healing',
  'anomaly-log.jsonl'
);

// History limits
const MAX_TOKEN_HISTORY = 100;
const MAX_DURATION_HISTORY = 100;
const MAX_PROMPT_PATTERNS = 50;

// Resource thresholds
const HEAP_WARNING_THRESHOLD = 0.8; // 80%
const HEAP_CRITICAL_THRESHOLD = 0.9; // 90%

/**
 * Path setters for testing
 */
function setStateFile(filePath) {
  STATE_FILE = filePath;
}

function setAnomalyLog(filePath) {
  ANOMALY_LOG = filePath;
}

/**
 * Check if detection is enabled
 * @returns {boolean}
 */
function isEnabled() {
  return process.env.ANOMALY_DETECTION_ENABLED !== 'false';
}

/**
 * Get configurable thresholds from environment
 * @returns {Object} Threshold configuration
 */
function getThresholds() {
  return {
    tokenMultiplier: parseFloat(process.env.ANOMALY_TOKEN_MULTIPLIER || '2'),
    durationMultiplier: parseFloat(process.env.ANOMALY_DURATION_MULTIPLIER || '3'),
    failureCount: parseInt(process.env.ANOMALY_FAILURE_COUNT || '3', 10),
    patternRepetitions: parseInt(process.env.ANOMALY_PATTERN_REPS || '2', 10),
  };
}

/**
 * Create default state structure
 * @returns {Object} Default state
 */
function createDefaultState() {
  return {
    tokenHistory: [],
    durationHistory: [],
    failureTracking: {},
    promptPatterns: [],
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Load state from file
 * @returns {Object} Current state
 */
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const content = fs.readFileSync(STATE_FILE, 'utf8');
      const state = JSON.parse(content);
      // Ensure all fields exist
      return {
        ...createDefaultState(),
        ...state,
      };
    }
  } catch (e) {
    if (process.env.DEBUG_HOOKS) {
      console.error('[anomaly-detector] Error loading state:', e.message);
    }
  }
  return createDefaultState();
}

/**
 * Save state to file
 * @param {Object} state - State to save
 */
function saveState(state) {
  try {
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    state.lastUpdated = new Date().toISOString();
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    if (process.env.DEBUG_HOOKS) {
      console.error('[anomaly-detector] Error saving state:', e.message);
    }
  }
}

/**
 * Calculate average of an array
 * @param {number[]} arr - Array of numbers
 * @returns {number} Average value
 */
function calculateAverage(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((sum, val) => sum + val, 0) / arr.length;
}

/**
 * Hash a prompt for pattern detection
 * Normalizes the prompt before hashing
 * @param {string} prompt - The prompt to hash
 * @returns {string} Hash of normalized prompt
 */
function hashPrompt(prompt) {
  // Normalize: lowercase, trim, collapse whitespace
  const normalized = prompt.toLowerCase().trim().replace(/\s+/g, ' ');
  return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 16);
}

/**
 * Detect token explosion
 * @param {number} current - Current token count
 * @param {number} average - Historical average
 * @param {number} multiplier - Threshold multiplier (default from env)
 * @returns {Object} Detection result
 */
function detectTokenExplosion(current, average, multiplier = null) {
  if (multiplier === null) {
    multiplier = getThresholds().tokenMultiplier;
  }

  const result = {
    type: 'token_explosion',
    detected: false,
    current,
    average,
    threshold: multiplier,
    ratio: 0,
  };

  // Guard against division by zero
  if (average === 0 || average === null || average === undefined) {
    return result;
  }

  result.ratio = current / average;
  result.detected = result.ratio > multiplier;

  return result;
}

/**
 * Detect duration spike
 * @param {number} current - Current duration (ms)
 * @param {number} average - Historical average (ms)
 * @param {number} multiplier - Threshold multiplier (default from env)
 * @returns {Object} Detection result
 */
function detectDurationSpike(current, average, multiplier = null) {
  if (multiplier === null) {
    multiplier = getThresholds().durationMultiplier;
  }

  const result = {
    type: 'duration_spike',
    detected: false,
    current,
    average,
    threshold: multiplier,
    ratio: 0,
  };

  // Guard against division by zero
  if (average === 0 || average === null || average === undefined) {
    return result;
  }

  result.ratio = current / average;
  result.detected = result.ratio > multiplier;

  return result;
}

/**
 * Detect repeated failures for a tool
 * @param {string} tool - Tool name
 * @param {Object} state - Current state
 * @param {number} threshold - Failure count threshold (default from env)
 * @returns {Object} Detection result
 */
function detectRepeatedFailures(tool, state, threshold = null) {
  if (threshold === null) {
    threshold = getThresholds().failureCount;
  }

  const result = {
    type: 'repeated_failures',
    detected: false,
    tool,
    count: 0,
    threshold,
  };

  const tracking = state.failureTracking || {};
  if (tracking[tool]) {
    result.count = tracking[tool].count || 0;
    result.lastFailed = tracking[tool].lastFailed;
    result.errors = tracking[tool].errors || [];
    result.detected = result.count >= threshold;
  }

  return result;
}

/**
 * Detect infinite loop risk from repeated prompts
 * @param {string} prompt - Current prompt
 * @param {Object} state - Current state
 * @param {number} threshold - Repetition threshold (default from env)
 * @returns {Object} Detection result
 */
function detectLoopRisk(prompt, state, threshold = null) {
  if (threshold === null) {
    threshold = getThresholds().patternRepetitions;
  }

  const result = {
    type: 'infinite_loop_risk',
    detected: false,
    repetitions: 0,
    threshold,
  };

  const hash = hashPrompt(prompt);
  const patterns = state.promptPatterns || [];

  const existingPattern = patterns.find(p => p.hash === hash);
  if (existingPattern) {
    result.repetitions = existingPattern.count;
    result.detected = result.repetitions >= threshold;
  }

  return result;
}

/**
 * Detect resource exhaustion
 * @param {Object} metrics - Memory metrics object
 * @returns {Object} Detection result
 */
function detectResourceExhaustion(metrics) {
  const result = {
    type: 'resource_exhaustion',
    detected: false,
    warning: false,
    metrics: {},
  };

  // Use provided metrics or get from process
  const memMetrics = metrics || process.memoryUsage();

  const heapUsedRatio = memMetrics.heapUsed / memMetrics.heapTotal;

  result.metrics = {
    heapUsed: memMetrics.heapUsed,
    heapTotal: memMetrics.heapTotal,
    heapUsedRatio: heapUsedRatio,
    external: memMetrics.external,
  };

  if (heapUsedRatio >= HEAP_CRITICAL_THRESHOLD) {
    result.detected = true;
  } else if (heapUsedRatio >= HEAP_WARNING_THRESHOLD) {
    result.warning = true;
  }

  return result;
}

/**
 * Log an anomaly to the log file
 * @param {Object} anomaly - Anomaly details
 */
function logAnomaly(anomaly) {
  try {
    const dir = path.dirname(ANOMALY_LOG);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const entry = {
      ...anomaly,
      timestamp: new Date().toISOString(),
    };

    fs.appendFileSync(ANOMALY_LOG, JSON.stringify(entry) + '\n');

    if (process.env.DEBUG_HOOKS) {
      console.log('[anomaly-detector] Logged anomaly:', anomaly.type);
    }
  } catch (e) {
    if (process.env.DEBUG_HOOKS) {
      console.error('[anomaly-detector] Error logging anomaly:', e.message);
    }
  }
}

/**
 * Record a failure for a tool
 * @param {string} tool - Tool name
 * @param {string} error - Error message
 * @param {Object} state - Current state (modified in place)
 */
function recordFailure(tool, error, state) {
  if (!state.failureTracking) {
    state.failureTracking = {};
  }

  if (!state.failureTracking[tool]) {
    state.failureTracking[tool] = {
      count: 0,
      errors: [],
      lastFailed: null,
    };
  }

  state.failureTracking[tool].count++;
  state.failureTracking[tool].lastFailed = new Date().toISOString();

  // Keep last 5 errors
  state.failureTracking[tool].errors = [
    ...(state.failureTracking[tool].errors || []).slice(-4),
    error,
  ];
}

/**
 * Record token usage
 * @param {number} tokens - Token count
 * @param {Object} state - Current state (modified in place)
 */
function recordTokenUsage(tokens, state) {
  if (!state.tokenHistory) {
    state.tokenHistory = [];
  }

  state.tokenHistory.push(tokens);

  // Limit history size
  if (state.tokenHistory.length > MAX_TOKEN_HISTORY) {
    state.tokenHistory = state.tokenHistory.slice(-MAX_TOKEN_HISTORY);
  }
}

/**
 * Record duration
 * @param {number} duration - Duration in ms
 * @param {Object} state - Current state (modified in place)
 */
function recordDuration(duration, state) {
  if (!state.durationHistory) {
    state.durationHistory = [];
  }

  state.durationHistory.push(duration);

  // Limit history size
  if (state.durationHistory.length > MAX_DURATION_HISTORY) {
    state.durationHistory = state.durationHistory.slice(-MAX_DURATION_HISTORY);
  }
}

/**
 * Record prompt pattern
 * @param {string} prompt - Prompt to record
 * @param {Object} state - Current state (modified in place)
 */
function recordPromptPattern(prompt, state) {
  if (!state.promptPatterns) {
    state.promptPatterns = [];
  }

  const hash = hashPrompt(prompt);
  const existing = state.promptPatterns.find(p => p.hash === hash);

  if (existing) {
    existing.count++;
    existing.lastSeen = new Date().toISOString();
  } else {
    state.promptPatterns.push({
      hash,
      count: 1,
      lastSeen: new Date().toISOString(),
    });
  }

  // Limit patterns (remove oldest by lastSeen)
  if (state.promptPatterns.length > MAX_PROMPT_PATTERNS) {
    state.promptPatterns.sort(
      (a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime()
    );
    state.promptPatterns = state.promptPatterns.slice(0, MAX_PROMPT_PATTERNS);
  }
}

/**
 * Clear failure tracking for a tool (on success)
 * @param {string} tool - Tool name
 * @param {Object} state - Current state (modified in place)
 */
function clearFailures(tool, state) {
  if (state.failureTracking && state.failureTracking[tool]) {
    delete state.failureTracking[tool];
  }
}

/**
 * Parse hook input from stdin
 * @returns {Promise<Object|null>}
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
    // Check if enabled
    if (!isEnabled()) {
      process.exit(0);
    }

    // Parse hook input
    const hookInput = await parseHookInput();

    if (!hookInput) {
      process.exit(0);
    }

    // Load state
    const state = loadState();
    const thresholds = getThresholds();
    const anomalies = [];

    // Extract relevant data from hook input
    const tokenCount = hookInput.tokens || hookInput.token_count || null;
    const duration = hookInput.duration || hookInput.execution_time || null;
    const tool = hookInput.tool_name || hookInput.tool || null;
    const toolError = hookInput.error || null;
    const toolSuccess = hookInput.success !== false && !toolError;
    const prompt = hookInput.prompt || hookInput.user_message || null;

    // 1. Check for token explosion
    if (tokenCount !== null) {
      const avgTokens = calculateAverage(state.tokenHistory);
      const tokenResult = detectTokenExplosion(tokenCount, avgTokens, thresholds.tokenMultiplier);
      if (tokenResult.detected) {
        anomalies.push(tokenResult);
      }
      recordTokenUsage(tokenCount, state);
    }

    // 2. Check for duration spike
    if (duration !== null) {
      const avgDuration = calculateAverage(state.durationHistory);
      const durationResult = detectDurationSpike(
        duration,
        avgDuration,
        thresholds.durationMultiplier
      );
      if (durationResult.detected) {
        anomalies.push(durationResult);
      }
      recordDuration(duration, state);
    }

    // 3. Track tool failures
    if (tool) {
      if (!toolSuccess && toolError) {
        recordFailure(tool, toolError, state);
        const failureResult = detectRepeatedFailures(tool, state, thresholds.failureCount);
        if (failureResult.detected) {
          anomalies.push(failureResult);
        }
      } else if (toolSuccess) {
        // Clear failure tracking on success
        clearFailures(tool, state);
      }
    }

    // 4. Check for loop risk
    if (prompt) {
      const loopResult = detectLoopRisk(prompt, state, thresholds.patternRepetitions);
      if (loopResult.detected) {
        anomalies.push(loopResult);
      }
      recordPromptPattern(prompt, state);
    }

    // 5. Check resource exhaustion
    const resourceResult = detectResourceExhaustion(null);
    if (resourceResult.detected || resourceResult.warning) {
      anomalies.push(resourceResult);
    }

    // Log all detected anomalies
    for (const anomaly of anomalies) {
      logAnomaly(anomaly);
    }

    // Save updated state
    saveState(state);

    // Always exit successfully (advisory hook)
    process.exit(0);
  } catch (err) {
    if (process.env.DEBUG_HOOKS) {
      console.error('[anomaly-detector] Error:', err.message);
      console.error('Stack:', err.stack);
    }
    // Fail silently
    process.exit(0);
  }
}

// Run if main module
if (require.main === module) {
  main();
}

// Exports for testing
module.exports = {
  // Path setters
  setStateFile,
  setAnomalyLog,

  // Core functions
  isEnabled,
  getThresholds,
  loadState,
  saveState,
  calculateAverage,
  hashPrompt,

  // Detection functions
  detectTokenExplosion,
  detectDurationSpike,
  detectRepeatedFailures,
  detectLoopRisk,
  detectResourceExhaustion,

  // Recording functions
  recordFailure,
  recordTokenUsage,
  recordDuration,
  recordPromptPattern,
  clearFailures,

  // Logging
  logAnomaly,

  // Main
  parseHookInput,
  main,

  // Constants for testing
  get STATE_FILE() {
    return STATE_FILE;
  },
  get ANOMALY_LOG() {
    return ANOMALY_LOG;
  },
  PROJECT_ROOT,
};
