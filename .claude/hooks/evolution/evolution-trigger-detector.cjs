#!/usr/bin/env node
/**
 * evolution-trigger-detector.cjs
 * PostToolUse hook for detecting evolution needs in prompts/responses
 *
 * Detects patterns that suggest evolution is needed:
 * - "create new agent"
 * - "need a * agent/skill"
 * - "no matching agent"
 * - capability gap indicators
 *
 * When detected, writes suggestion to evolution-state.json for Router to pick up.
 *
 * ENFORCEMENT MODES (EVOLUTION_TRIGGER_DETECTION):
 * - on (default): Detection active, writes suggestions
 * - off: Detection disabled
 *
 * Override via environment variable:
 *   EVOLUTION_TRIGGER_DETECTION=off
 *
 * Exit codes:
 * - 0: Always (detection is advisory, never blocks)
 *
 * This hook is advisory and never blocks operations.
 */

'use strict';

const fs = require('fs');
const path = require('path');
// PERF-006/PERF-007: Use shared utilities instead of duplicated code
const { PROJECT_ROOT } = require('../../lib/utils/project-root.cjs');
const { parseHookInputAsync } = require('../../lib/utils/hook-input.cjs');
const { getCachedState, invalidateCache } = require('../../lib/utils/state-cache.cjs');

// Evolution trigger patterns
const EVOLUTION_TRIGGERS = [
  {
    pattern: /create\s+(a\s+)?new\s+(agent|skill|workflow|hook)/i,
    type: 'explicit_creation',
    priority: 'high',
  },
  {
    pattern: /need\s+(a|an)\s+\w+\s+(agent|skill)/i,
    type: 'capability_need',
    priority: 'high',
  },
  {
    pattern: /no\s+(matching|suitable|existing)\s+(agent|skill)/i,
    type: 'gap_detection',
    priority: 'high',
  },
  {
    pattern: /can('t|not)\s+find\s+(an?\s+)?(agent|skill)\s+for/i,
    type: 'gap_detection',
    priority: 'medium',
  },
  {
    pattern: /missing\s+(agent|skill|capability)/i,
    type: 'gap_detection',
    priority: 'medium',
  },
  {
    pattern: /add\s+(support|capability)\s+for/i,
    type: 'capability_request',
    priority: 'medium',
  },
  {
    pattern: /evolve\s+(the\s+)?(system|framework|ecosystem)/i,
    type: 'explicit_evolution',
    priority: 'high',
  },
  {
    pattern: /self[- ]evolv(e|ing)/i,
    type: 'explicit_evolution',
    priority: 'high',
  },
  {
    pattern: /extend\s+(the\s+)?(agent|skill)\s+(system|ecosystem)/i,
    type: 'extension_request',
    priority: 'medium',
  },
];

const EVOLUTION_STATE_PATH = path.join(PROJECT_ROOT, '.claude', 'context', 'evolution-state.json');

/**
 * Check if detection is enabled
 * @returns {boolean}
 */
function isDetectionEnabled() {
  const mode = process.env.EVOLUTION_TRIGGER_DETECTION || 'on';
  return mode !== 'off';
}

/**
 * Detect evolution triggers in text
 * @param {string} text - Text to analyze
 * @returns {Array<{pattern: string, type: string, priority: string, match: string}>}
 */
function detectTriggers(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const triggers = [];

  EVOLUTION_TRIGGERS.forEach(({ pattern, type, priority }) => {
    const match = text.match(pattern);
    if (match) {
      triggers.push({
        pattern: pattern.source,
        type,
        priority,
        match: match[0],
        context: extractContext(text, match.index, 100),
      });
    }
  });

  return triggers;
}

/**
 * Extract context around a match
 * @param {string} text - Full text
 * @param {number} index - Match index
 * @param {number} radius - Characters to include before/after
 * @returns {string}
 */
function extractContext(text, index, radius) {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + radius);
  let context = text.substring(start, end);

  if (start > 0) context = '...' + context;
  if (end < text.length) context = context + '...';

  return context.replace(/\n/g, ' ').trim();
}

/**
 * Get the evolution state from file
 * PERF-004: Uses state-cache for TTL-based caching
 * @returns {Object}
 */
function getEvolutionState() {
  // Default state if not found
  const defaultState = {
    version: '1.0.0',
    state: 'idle',
    currentEvolution: null,
    evolutions: [],
    patterns: [],
    suggestions: [],
    lastUpdated: new Date().toISOString(),
  };

  // PERF-004: Use cached state with 1s TTL
  return getCachedState(EVOLUTION_STATE_PATH, defaultState);
}

/**
 * Add suggestion to evolution state
 * @param {Object} state - Current evolution state
 * @param {Array} triggers - Detected triggers
 * @returns {Object} Updated state
 */
function addSuggestion(state, triggers) {
  // Don't add suggestions if evolution is in progress
  if (state.state !== 'idle') {
    return state;
  }

  const suggestion = {
    id: `sug-${Date.now()}`,
    detectedAt: new Date().toISOString(),
    triggers: triggers.map(t => ({
      type: t.type,
      priority: t.priority,
      match: t.match,
    })),
    status: 'pending',
  };

  // Avoid duplicate suggestions (same trigger types within 5 minutes)
  const recentSuggestions = state.suggestions.filter(s => {
    const age = Date.now() - new Date(s.detectedAt).getTime();
    return age < 5 * 60 * 1000; // 5 minutes
  });

  const isDuplicate = recentSuggestions.some(s => {
    const existingTypes = new Set(s.triggers.map(t => t.type));
    const newTypes = new Set(triggers.map(t => t.type));
    return [...newTypes].every(t => existingTypes.has(t));
  });

  if (isDuplicate) {
    return state;
  }

  // Add suggestion (keep last 10)
  state.suggestions = [...recentSuggestions, suggestion].slice(-10);
  state.lastUpdated = new Date().toISOString();

  return state;
}

/**
 * Save evolution state to file
 * PERF-004: Invalidates cache after write to ensure consistency
 * @param {Object} state - State to save
 */
function saveEvolutionState(state) {
  try {
    const dir = path.dirname(EVOLUTION_STATE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(EVOLUTION_STATE_PATH, JSON.stringify(state, null, 2));
    // PERF-004: Invalidate cache after writing to ensure consistency
    invalidateCache(EVOLUTION_STATE_PATH);
  } catch (e) {
    if (process.env.DEBUG_HOOKS) {
      console.error('Failed to save evolution state:', e.message);
    }
  }
}

// PERF-006: parseHookInput is now imported from hook-input.cjs
// Alias for backward compatibility with exports
const parseHookInput = parseHookInputAsync;

/**
 * Main execution function.
 */
async function main() {
  try {
    // Check if detection is enabled
    if (!isDetectionEnabled()) {
      process.exit(0);
    }

    // Parse the hook input using shared utility
    const hookInput = await parseHookInputAsync();

    if (!hookInput) {
      // No input provided
      process.exit(0);
    }

    // Extract text to analyze from tool output or user message
    const toolOutput = hookInput.tool_output || hookInput.output || '';
    const userMessage = hookInput.user_message || hookInput.prompt || '';
    const textToAnalyze = `${userMessage} ${toolOutput}`.trim();

    if (!textToAnalyze) {
      process.exit(0);
    }

    // Detect evolution triggers
    const triggers = detectTriggers(textToAnalyze);

    if (triggers.length === 0) {
      // No triggers detected
      process.exit(0);
    }

    // Get current state and add suggestion
    const state = getEvolutionState();
    const updatedState = addSuggestion(state, triggers);

    // Save updated state
    if (updatedState !== state) {
      saveEvolutionState(updatedState);

      // Log detection for visibility (advisory)
      if (process.env.DEBUG_HOOKS) {
        console.log(
          JSON.stringify({
            result: 'detected',
            message: `Evolution trigger detected: ${triggers[0].match}`,
            triggers: triggers.length,
            suggestion_id: updatedState.suggestions[updatedState.suggestions.length - 1]?.id,
          })
        );
      }
    }

    // Always exit successfully (advisory hook)
    process.exit(0);
  } catch (err) {
    // Fail silently on errors (advisory hook)
    if (process.env.DEBUG_HOOKS) {
      console.error('evolution-trigger-detector error:', err.message);
      console.error('Stack trace:', err.stack);
    }
    process.exit(0);
  }
}

// Run if this is the main module
if (require.main === module) {
  main();
}

// Export for testing
module.exports = {
  main,
  parseHookInput,
  isDetectionEnabled,
  detectTriggers,
  extractContext,
  addSuggestion,
  getEvolutionState,
  saveEvolutionState,
  EVOLUTION_TRIGGERS,
  PROJECT_ROOT,
  EVOLUTION_STATE_PATH,
};
