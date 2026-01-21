#!/usr/bin/env node

/**
 * Suggestion Queue Manager
 *
 * Manages suggestion lifecycle and queue operations.
 *
 * @module suggestion-generator/queue-manager
 * @version 1.0.0
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants
const SUGGESTIONS_DIR = path.join(process.cwd(), '.claude', 'conductor', 'context', 'suggestions');

const INDEX_PATH = path.join(SUGGESTIONS_DIR, 'index.json');

/**
 * Get suggestions by status
 *
 * @param {string[]} statuses - Status filters (e.g., ['pending', 'deferred'])
 * @returns {Promise<object[]>} - Array of suggestion summaries
 */
export async function getByStatus(statuses = ['pending']) {
  try {
    const indexContent = await fs.readFile(INDEX_PATH, 'utf-8');
    const index = JSON.parse(indexContent);

    const results = [];

    for (const [suggestionId, entry] of Object.entries(index.suggestions)) {
      if (statuses.includes(entry.status)) {
        results.push({
          suggestion_id: suggestionId,
          ...entry,
        });
      }
    }

    return results;
  } catch (error) {
    console.error('Failed to get suggestions by status:', error.message);
    return [];
  }
}

/**
 * Get prioritized suggestions for review
 *
 * @param {number} limit - Maximum number of suggestions to return
 * @returns {Promise<object[]>} - Prioritized suggestions
 */
export async function getPrioritized(limit = 10) {
  try {
    const indexContent = await fs.readFile(INDEX_PATH, 'utf-8');
    const index = JSON.parse(indexContent);

    // Collect all pending and deferred suggestions
    const suggestions = [];

    for (const [suggestionId, entry] of Object.entries(index.suggestions)) {
      if (entry.status === 'pending' || entry.status === 'deferred') {
        suggestions.push({
          suggestion_id: suggestionId,
          ...entry,
        });
      }
    }

    // Sort by priority (P0 > P1 > P2 > P3), then by created_at (newest first)
    const priorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
    suggestions.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;

      // Sort by created_at descending (newest first)
      return new Date(b.created_at) - new Date(a.created_at);
    });

    // Apply limit
    return suggestions.slice(0, limit);
  } catch (error) {
    console.error('Failed to get prioritized suggestions:', error.message);
    return [];
  }
}

/**
 * Get specific suggestion by ID
 *
 * @param {string} suggestionId - Suggestion ID
 * @returns {Promise<object|null>} - Full suggestion object or null
 */
export async function getSuggestion(suggestionId) {
  try {
    // Find suggestion in index to determine status/directory
    const indexContent = await fs.readFile(INDEX_PATH, 'utf-8');
    const index = JSON.parse(indexContent);

    const entry = index.suggestions[suggestionId];
    if (!entry) {
      return null;
    }

    // Load full suggestion from appropriate directory
    const suggestionPath = path.join(SUGGESTIONS_DIR, entry.status, `${suggestionId}.json`);

    const suggestionContent = await fs.readFile(suggestionPath, 'utf-8');
    return JSON.parse(suggestionContent);
  } catch (error) {
    console.error(`Failed to get suggestion ${suggestionId}:`, error.message);
    return null;
  }
}

/**
 * Update suggestion status
 *
 * @param {string} suggestionId - Suggestion ID
 * @param {string} newStatus - New status
 * @param {object} updates - Additional fields to update
 * @returns {Promise<object|null>} - Updated suggestion or null
 */
export async function updateStatus(suggestionId, newStatus, updates = {}) {
  try {
    // Get current suggestion
    const suggestion = await getSuggestion(suggestionId);
    if (!suggestion) {
      throw new Error(`Suggestion not found: ${suggestionId}`);
    }

    const oldStatus = suggestion.status;

    // Update suggestion object
    suggestion.status = newStatus;
    suggestion.updated_at = new Date().toISOString();

    // Apply additional updates
    Object.assign(suggestion, updates);

    // Move file to new directory
    const oldPath = path.join(SUGGESTIONS_DIR, oldStatus, `${suggestionId}.json`);
    const newPath = path.join(SUGGESTIONS_DIR, newStatus, `${suggestionId}.json`);

    await fs.writeFile(newPath, JSON.stringify(suggestion, null, 2), 'utf-8');

    // Delete old file
    if (oldPath !== newPath) {
      try {
        await fs.unlink(oldPath);
      } catch {
        // Ignore if old file doesn't exist
      }
    }

    // Update index
    await updateIndex(suggestion, 'update');

    console.log(`✓ Suggestion ${suggestionId} status updated: ${oldStatus} → ${newStatus}`);

    return suggestion;
  } catch (error) {
    console.error(`Failed to update suggestion ${suggestionId} status:`, error.message);
    return null;
  }
}

/**
 * Update index with suggestion
 *
 * @param {object} suggestion - Suggestion object
 * @param {string} operation - 'add', 'update', 'remove'
 */
async function updateIndex(suggestion, operation) {
  try {
    const indexContent = await fs.readFile(INDEX_PATH, 'utf-8');
    const index = JSON.parse(indexContent);

    if (operation === 'update') {
      // Update existing entry
      if (index.suggestions[suggestion.suggestion_id]) {
        const oldStatus = index.suggestions[suggestion.suggestion_id].status;
        const oldPriority = index.suggestions[suggestion.suggestion_id].priority;

        // Update counts
        if (oldStatus !== suggestion.status) {
          index.counts[oldStatus] = Math.max(0, (index.counts[oldStatus] || 0) - 1);
          index.counts[suggestion.status] = (index.counts[suggestion.status] || 0) + 1;
        }

        // Update priority index
        if (oldPriority !== suggestion.priority) {
          index.by_priority[oldPriority] = (index.by_priority[oldPriority] || []).filter(
            id => id !== suggestion.suggestion_id
          );
          if (!index.by_priority[suggestion.priority]) {
            index.by_priority[suggestion.priority] = [];
          }
          index.by_priority[suggestion.priority].push(suggestion.suggestion_id);
        }

        // Update entry
        index.suggestions[suggestion.suggestion_id] = {
          status: suggestion.status,
          priority: suggestion.priority,
          type: suggestion.type,
          agent: suggestion.metadata?.agent || 'unknown',
          created_at: suggestion.created_at,
        };
      }
    }

    // Update timestamp
    index.updated_at = new Date().toISOString();

    // Save index
    await fs.writeFile(INDEX_PATH, JSON.stringify(index, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to update index:', error.message);
  }
}

/**
 * Respond to suggestion (accept/reject/defer/modify)
 *
 * @param {string} suggestionId - Suggestion ID
 * @param {object} response - User response
 * @returns {Promise<object|null>} - Updated suggestion or null
 */
export async function respondToSuggestion(suggestionId, response) {
  try {
    const { action, notes, defer_until, modified_action } = response;

    // Get current suggestion
    const suggestion = await getSuggestion(suggestionId);
    if (!suggestion) {
      throw new Error(`Suggestion not found: ${suggestionId}`);
    }

    // Update user_response field
    suggestion.user_response = {
      action_taken: action,
      responded_at: new Date().toISOString(),
      notes: notes || '',
    };

    if (action === 'deferred' && defer_until) {
      suggestion.user_response.defer_until = defer_until;
    }

    if (action === 'modified' && modified_action) {
      suggestion.user_response.modified_action = modified_action;
      suggestion.action = modified_action; // Update action itself
    }

    // Map action to status
    const statusMap = {
      accepted: 'accepted',
      rejected: 'rejected',
      deferred: 'deferred',
      modified: 'accepted', // Modified suggestions go to accepted
    };

    const newStatus = statusMap[action];

    // Update status
    return await updateStatus(suggestionId, newStatus, {
      user_response: suggestion.user_response,
    });
  } catch (error) {
    console.error(`Failed to respond to suggestion ${suggestionId}:`, error.message);
    return null;
  }
}

/**
 * Get suggestions by agent
 *
 * @param {string} agentId - Agent identifier
 * @returns {Promise<object[]>} - Array of suggestions from agent
 */
export async function getByAgent(agentId) {
  try {
    const indexContent = await fs.readFile(INDEX_PATH, 'utf-8');
    const index = JSON.parse(indexContent);

    const results = [];

    for (const [suggestionId, entry] of Object.entries(index.suggestions)) {
      if (entry.agent === agentId) {
        results.push({
          suggestion_id: suggestionId,
          ...entry,
        });
      }
    }

    return results;
  } catch (error) {
    console.error(`Failed to get suggestions by agent ${agentId}:`, error.message);
    return [];
  }
}

/**
 * Expire stale suggestions
 *
 * @param {number} maxAgeHours - Maximum age in hours
 * @returns {Promise<number>} - Count of expired suggestions
 */
export async function expireStale(maxAgeHours = 72) {
  try {
    const now = Date.now();
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;

    // Get pending and deferred suggestions
    const pending = await getByStatus(['pending', 'deferred']);

    let expiredCount = 0;

    for (const entry of pending) {
      const createdAt = new Date(entry.created_at).getTime();
      const age = now - createdAt;

      if (age > maxAgeMs) {
        await updateStatus(entry.suggestion_id, 'expired');
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      console.log(`✓ Expired ${expiredCount} stale suggestions`);
    }

    return expiredCount;
  } catch (error) {
    console.error('Failed to expire stale suggestions:', error.message);
    return 0;
  }
}

/**
 * List suggestions with filters
 *
 * @param {object} filters - Filter criteria
 * @returns {Promise<object[]>} - Filtered suggestions
 */
export async function listSuggestions(filters = {}) {
  try {
    const { status, priority, type, agent, limit, offset } = filters;

    const indexContent = await fs.readFile(INDEX_PATH, 'utf-8');
    const index = JSON.parse(indexContent);

    let results = [];

    // Collect suggestions matching filters
    for (const [suggestionId, entry] of Object.entries(index.suggestions)) {
      let matches = true;

      if (status && !status.includes(entry.status)) matches = false;
      if (priority && !priority.includes(entry.priority)) matches = false;
      if (type && entry.type !== type) matches = false;
      if (agent && entry.agent !== agent) matches = false;

      if (matches) {
        results.push({
          suggestion_id: suggestionId,
          ...entry,
        });
      }
    }

    // Sort by priority, then created_at
    const priorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
    results.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(b.created_at) - new Date(a.created_at);
    });

    // Apply pagination
    const startIndex = offset || 0;
    const endIndex = limit ? startIndex + limit : results.length;
    results = results.slice(startIndex, endIndex);

    return results;
  } catch (error) {
    console.error('Failed to list suggestions:', error.message);
    return [];
  }
}

// Export functions
export default {
  getByStatus,
  getPrioritized,
  getSuggestion,
  updateStatus,
  respondToSuggestion,
  getByAgent,
  expireStale,
  listSuggestions,
};
