#!/usr/bin/env node
/**
 * Audit Logger - Standardized event logging for debugging and post-mortem analysis
 * 
 * Logs all transitions, errors, retries, handoffs, and approval requests to run-events.jsonl
 * 
 * Usage:
 *   import { logEvent } from './audit-logger.mjs';
 */

import { appendFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { getRunDirectoryStructure } from './run-manager.mjs';

/**
 * Event types
 */
export const EVENT_TYPES = {
  STATE_TRANSITION: 'state_transition',
  ERROR: 'error',
  RETRY: 'retry',
  HANDOFF: 'handoff',
  APPROVAL_REQUEST: 'approval_request',
  APPROVAL_GRANTED: 'approval_granted',
  STEP_STARTED: 'step_started',
  STEP_COMPLETED: 'step_completed',
  STEP_FAILED: 'step_failed',
  ARTIFACT_REGISTERED: 'artifact_registered',
  GATE_PASSED: 'gate_passed',
  GATE_FAILED: 'gate_failed',
  CONTEXT_THRESHOLD: 'context_threshold',
  PHOENIX_RESET: 'phoenix_reset'
};

/**
 * Log an event to the audit trail
 * @param {string} runId - Run identifier
 * @param {string} eventType - Event type (from EVENT_TYPES)
 * @param {Object} details - Event details
 * @param {Object} metadata - Additional metadata
 */
export async function logEvent(runId, eventType, details = {}, metadata = {}) {
  try {
    const runDirs = getRunDirectoryStructure(runId);
    const eventsFile = join(runDirs.run_dir, 'run-events.jsonl');
    
    // Ensure run directory exists
    if (!existsSync(runDirs.run_dir)) {
      await mkdir(runDirs.run_dir, { recursive: true });
    }
    
    const event = {
      timestamp: new Date().toISOString(),
      event_type: eventType,
      run_id: runId,
      step: details.step || metadata.step || null,
      agent: details.agent || metadata.agent || null,
      details: details,
      metadata: metadata
    };
    
    // Append to JSONL file (one JSON object per line)
    const line = JSON.stringify(event) + '\n';
    await appendFile(eventsFile, line, 'utf-8');
    
    return event;
  } catch (error) {
    // Logging failures should not break execution
    console.error(`Warning: Failed to log event for run ${runId}: ${error.message}`);
    return null;
  }
}

/**
 * Read events from audit trail
 * @param {string} runId - Run identifier
 * @param {Object} options - Query options
 * @param {number} options.limit - Maximum number of events to return
 * @param {string} options.eventType - Filter by event type
 * @param {number} options.step - Filter by step number
 * @returns {Promise<Array>} Array of events
 */
export async function readEvents(runId, options = {}) {
  const { limit = 100, eventType = null, step = null } = options;
  const runDirs = getRunDirectoryStructure(runId);
  const eventsFile = join(runDirs.run_dir, 'run-events.jsonl');
  
  if (!existsSync(eventsFile)) {
    return [];
  }
  
  const { readFile } = await import('fs/promises');
  const content = await readFile(eventsFile, 'utf-8');
  const lines = content.trim().split('\n').filter(line => line.trim());
  
  let events = lines.map(line => JSON.parse(line));
  
  // Apply filters
  if (eventType) {
    events = events.filter(e => e.event_type === eventType);
  }
  if (step !== null) {
    events = events.filter(e => e.step === step);
  }
  
  // Sort by timestamp (newest first) and limit
  events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return events.slice(0, limit);
}

/**
 * Get recent events for dashboard
 * @param {string} runId - Run identifier
 * @param {number} limit - Maximum number of events
 * @returns {Promise<Array>} Recent events
 */
export async function getRecentEvents(runId, limit = 20) {
  return await readEvents(runId, { limit });
}

export default {
  logEvent,
  readEvents,
  getRecentEvents,
  EVENT_TYPES
};

