#!/usr/bin/env node
/**
 * Session State Manager
 *
 * Manages orchestrator session state for enforcement hooks.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SESSION_STATE_PATH = join(
  __dirname,
  '..',
  'context',
  'tmp',
  'orchestrator-session-state.json'
);

/**
 * Load session state
 */
export function loadSessionState() {
  try {
    if (existsSync(SESSION_STATE_PATH)) {
      return JSON.parse(readFileSync(SESSION_STATE_PATH, 'utf-8'));
    }
  } catch (e) {
    console.error('Error loading session state:', e.message);
  }

  return null;
}

/**
 * Save session state
 */
export function saveSessionState(state) {
  const dir = dirname(SESSION_STATE_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(SESSION_STATE_PATH, JSON.stringify(state, null, 2));
}

/**
 * Initialize new session
 */
export function initSession(agentRole = 'orchestrator') {
  const state = {
    session_id: `sess_${Date.now()}`,
    agent_role: agentRole,
    read_count: 0,
    violations: [],
    files_read: [],
    created_at: new Date().toISOString(),
  };

  saveSessionState(state);
  return state;
}

/**
 * Reset read counter (e.g., after Task spawn)
 */
export function resetReadCounter() {
  const state = loadSessionState();
  if (state) {
    state.read_count = 0;
    state.files_read = [];
    saveSessionState(state);
  }
}

/**
 * Add violation to session
 */
export function addViolation(violation) {
  const state = loadSessionState();
  if (state) {
    state.violations.push({
      ...violation,
      timestamp: new Date().toISOString(),
    });
    saveSessionState(state);
  }
}

/**
 * Get compliance summary
 */
export function getComplianceSummary() {
  const state = loadSessionState();
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

/**
 * Clear session state
 */
export function clearSession() {
  if (existsSync(SESSION_STATE_PATH)) {
    unlinkSync(SESSION_STATE_PATH);
  }
}

/**
 * CLI interface
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];

  switch (command) {
    case 'init':
      const role = process.argv[3] || 'orchestrator';
      const state = initSession(role);
      console.log('Session initialized:', state.session_id);
      break;

    case 'reset':
      resetReadCounter();
      console.log('Read counter reset');
      break;

    case 'summary':
      const summary = getComplianceSummary();
      console.log(JSON.stringify(summary, null, 2));
      break;

    case 'clear':
      clearSession();
      console.log('Session cleared');
      break;

    default:
      console.log('Usage: session-state.mjs [init|reset|summary|clear]');
  }
}
