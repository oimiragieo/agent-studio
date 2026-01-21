#!/usr/bin/env node

/**
 * Suggestion Generator
 *
 * Generates suggestions from agent outputs with priority scoring.
 *
 * @module suggestion-generator/generator
 * @version 1.0.0
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { nanoid } from 'nanoid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants
const SUGGESTIONS_DIR = path.join(process.cwd(), '.claude', 'conductor', 'context', 'suggestions');

const SCHEMA_PATH = path.join(process.cwd(), '.claude', 'schemas', 'suggestion.schema.json');

// Category impact weights (used in priority calculation)
const IMPACT_WEIGHTS = {
  'critical-fix': 1.5,
  security: 1.4,
  'quick-win': 1.2,
  architecture: 1.1,
  'next-step': 1.0,
  feature: 1.0,
  testing: 0.9,
  performance: 0.9,
  optimization: 0.8,
  accessibility: 0.8,
  refactor: 0.7,
  'dependency-update': 0.7,
  documentation: 0.6,
  cleanup: 0.5,
  learning: 0.4,
};

// Effort penalties (complexity-based divisors)
const EFFORT_PENALTIES = {
  trivial: 1.0,
  simple: 1.2,
  moderate: 1.5,
  complex: 2.0,
  'very-complex': 3.0,
};

// Risk multipliers
const RISK_MULTIPLIERS = {
  low: 1.0,
  medium: 1.1,
  high: 1.3,
  critical: 1.5,
};

/**
 * Calculate priority score for a suggestion
 *
 * Formula: (confidence × impact_weight × urgency_factor × risk_multiplier) / effort_penalty
 *
 * @param {object} suggestion - Suggestion object
 * @returns {object} - { priority: 'P0'|'P1'|'P2'|'P3', score: number }
 */
export function calculatePriority(suggestion) {
  const confidence = suggestion.impact?.confidence || 0.5;
  const impactWeight = IMPACT_WEIGHTS[suggestion.type] || 1.0;
  const effortPenalty = EFFORT_PENALTIES[suggestion.effort?.complexity || 'moderate'] || 1.5;
  const riskMultiplier = RISK_MULTIPLIERS[suggestion.impact?.risk_level || 'medium'] || 1.0;

  // Calculate urgency based on age (newer suggestions get slight boost)
  const createdAt = new Date(suggestion.created_at);
  const ageHours = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
  const urgencyFactor = Math.max(1.0, 1.5 - ageHours * 0.02); // Decays over 25 hours

  // Calculate raw score
  const rawScore = (confidence * impactWeight * urgencyFactor * riskMultiplier) / effortPenalty;

  // Map to priority levels
  let priority;
  if (rawScore >= 1.2) {
    priority = 'P0';
  } else if (rawScore >= 0.8) {
    priority = 'P1';
  } else if (rawScore >= 0.5) {
    priority = 'P2';
  } else {
    priority = 'P3';
  }

  return { priority, score: parseFloat(rawScore.toFixed(2)) };
}

/**
 * Validate suggestion against schema
 *
 * @param {object} suggestion - Suggestion object
 * @returns {Promise<{valid: boolean, errors: string[]}>}
 */
export async function validateSuggestion(suggestion) {
  try {
    const schemaContent = await fs.readFile(SCHEMA_PATH, 'utf-8');
    const schema = JSON.parse(schemaContent);

    // Simple validation - check required fields
    const errors = [];
    const required = schema.required || [];

    for (const field of required) {
      if (!(field in suggestion)) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // Validate type is in enum
    if (
      suggestion.type &&
      schema.properties?.type?.enum &&
      !schema.properties.type.enum.includes(suggestion.type)
    ) {
      errors.push(
        `Invalid type: ${suggestion.type}. Must be one of: ${schema.properties.type.enum.join(', ')}`
      );
    }

    // Validate priority is in enum
    if (
      suggestion.priority &&
      schema.properties?.priority?.enum &&
      !schema.properties.priority.enum.includes(suggestion.priority)
    ) {
      errors.push(
        `Invalid priority: ${suggestion.priority}. Must be one of: ${schema.properties.priority.enum.join(', ')}`
      );
    }

    // Validate status is in enum
    if (
      suggestion.status &&
      schema.properties?.status?.enum &&
      !schema.properties.status.enum.includes(suggestion.status)
    ) {
      errors.push(
        `Invalid status: ${suggestion.status}. Must be one of: ${schema.properties.status.enum.join(', ')}`
      );
    }

    // Validate title length
    if (suggestion.title) {
      const minLength = schema.properties?.title?.minLength || 5;
      const maxLength = schema.properties?.title?.maxLength || 100;
      if (suggestion.title.length < minLength || suggestion.title.length > maxLength) {
        errors.push(
          `Title must be ${minLength}-${maxLength} characters (got ${suggestion.title.length})`
        );
      }
    }

    // Validate description length
    if (suggestion.description) {
      const minLength = schema.properties?.description?.minLength || 10;
      const maxLength = schema.properties?.description?.maxLength || 1000;
      if (suggestion.description.length < minLength || suggestion.description.length > maxLength) {
        errors.push(
          `Description must be ${minLength}-${maxLength} characters (got ${suggestion.description.length})`
        );
      }
    }

    return { valid: errors.length === 0, errors };
  } catch (error) {
    return {
      valid: false,
      errors: [`Schema validation error: ${error.message}`],
    };
  }
}

/**
 * Generate a new suggestion
 *
 * @param {object} params - Suggestion parameters
 * @returns {Promise<object>} - Generated suggestion object
 */
export async function generateSuggestion(params) {
  const startTime = Date.now();

  try {
    // Generate unique ID
    const suggestionId = `sug-${nanoid(10)}`;

    // Create timestamp
    const createdAt = new Date().toISOString();

    // Build suggestion object
    const suggestion = {
      suggestion_id: suggestionId,
      type: params.type,
      title: params.title,
      description: params.description,
      priority: 'P2', // Placeholder, calculated below
      status: 'pending',
      created_at: createdAt,
      updated_at: createdAt,
      context: params.context || {},
      action: params.action || {},
      impact: params.impact || {},
      effort: params.effort || {},
      rationale: params.rationale || {},
      display: params.display || {},
      metadata: {
        generator_version: '1.0.0',
        ...params.metadata,
      },
    };

    // Set expiration (72 hours by default)
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
    suggestion.expires_at = expiresAt.toISOString();

    // Calculate priority
    const { priority, score } = calculatePriority(suggestion);
    suggestion.priority = priority;
    suggestion.metadata.priority_score = score;

    // Validate against schema
    const validation = await validateSuggestion(suggestion);
    if (!validation.valid) {
      throw new Error(`Suggestion validation failed:\n${validation.errors.join('\n')}`);
    }

    // Ensure directory structure exists
    await ensureDirectories();

    // Save to pending directory
    const pendingDir = path.join(SUGGESTIONS_DIR, 'pending');
    const suggestionPath = path.join(pendingDir, `${suggestionId}.json`);
    await fs.writeFile(suggestionPath, JSON.stringify(suggestion, null, 2), 'utf-8');

    // Update index
    await updateIndex(suggestion, 'add');

    const duration = Date.now() - startTime;
    console.log(`✓ Suggestion created: ${suggestionId} (${priority}, ${duration}ms)`);

    return suggestion;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`✗ Suggestion generation failed (${duration}ms):`, error.message);
    throw error;
  }
}

/**
 * Ensure suggestion directory structure exists
 */
async function ensureDirectories() {
  const subdirs = ['pending', 'accepted', 'completed', 'rejected', 'deferred', 'expired'];

  for (const subdir of subdirs) {
    const dirPath = path.join(SUGGESTIONS_DIR, subdir);
    await fs.mkdir(dirPath, { recursive: true });
  }

  // Ensure index exists
  const indexPath = path.join(SUGGESTIONS_DIR, 'index.json');
  try {
    await fs.access(indexPath);
  } catch {
    const emptyIndex = {
      version: '1.0.0',
      updated_at: new Date().toISOString(),
      suggestions: {},
      counts: {
        pending: 0,
        accepted: 0,
        completed: 0,
        rejected: 0,
        deferred: 0,
        expired: 0,
      },
      by_priority: {
        P0: [],
        P1: [],
        P2: [],
        P3: [],
      },
    };
    await fs.writeFile(indexPath, JSON.stringify(emptyIndex, null, 2), 'utf-8');
  }
}

/**
 * Update index with suggestion
 *
 * @param {object} suggestion - Suggestion object
 * @param {string} operation - 'add', 'update', 'remove'
 */
async function updateIndex(suggestion, operation) {
  const indexPath = path.join(SUGGESTIONS_DIR, 'index.json');

  try {
    const indexContent = await fs.readFile(indexPath, 'utf-8');
    const index = JSON.parse(indexContent);

    if (operation === 'add') {
      // Add to suggestions map
      index.suggestions[suggestion.suggestion_id] = {
        status: suggestion.status,
        priority: suggestion.priority,
        type: suggestion.type,
        agent: suggestion.metadata?.agent || 'unknown',
        created_at: suggestion.created_at,
      };

      // Update counts
      index.counts[suggestion.status] = (index.counts[suggestion.status] || 0) + 1;

      // Update priority index
      if (!index.by_priority[suggestion.priority]) {
        index.by_priority[suggestion.priority] = [];
      }
      index.by_priority[suggestion.priority].push(suggestion.suggestion_id);
    } else if (operation === 'update') {
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
    } else if (operation === 'remove') {
      // Remove from suggestions map
      const entry = index.suggestions[suggestion.suggestion_id];
      if (entry) {
        delete index.suggestions[suggestion.suggestion_id];

        // Update counts
        index.counts[entry.status] = Math.max(0, (index.counts[entry.status] || 0) - 1);

        // Update priority index
        index.by_priority[entry.priority] = (index.by_priority[entry.priority] || []).filter(
          id => id !== suggestion.suggestion_id
        );
      }
    }

    // Update timestamp
    index.updated_at = new Date().toISOString();

    // Save index
    await fs.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to update index:', error.message);
  }
}

/**
 * Batch generate multiple suggestions
 *
 * @param {object[]} paramsArray - Array of suggestion parameters
 * @returns {Promise<object[]>} - Array of generated suggestions
 */
export async function generateBatch(paramsArray) {
  const results = [];
  const errors = [];

  for (const params of paramsArray) {
    try {
      const suggestion = await generateSuggestion(params);
      results.push(suggestion);
    } catch (error) {
      errors.push({ params, error: error.message });
    }
  }

  if (errors.length > 0) {
    console.warn(`Batch generation completed with ${errors.length} errors:`, errors);
  }

  return results;
}

// Export functions
export default {
  generateSuggestion,
  generateBatch,
  calculatePriority,
  validateSuggestion,
};
