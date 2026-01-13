/**
 * Tiered Context Manager for Ephemeral Worker Pattern
 *
 * Implements 4-tier context storage strategy:
 * - TIER 1 (HEAD): System prompts, critical rules - permanent (10k tokens)
 * - TIER 2 (RECENT): Last 10-15 messages - high fidelity (40k tokens)
 * - TIER 3 (MID_TERM): Older messages, summarized - on-demand (20k tokens)
 * - TIER 4 (LONG_TERM): Very old, vectorized - RAG retrieval (10k tokens)
 *
 * @module context-manager
 * @version 1.0.0
 * @created 2025-01-12
 */

import { WorkerDatabase } from './worker-db.mjs';

/**
 * Context tier types
 * @readonly
 * @enum {string}
 */
export const ContextTier = {
  HEAD: 'head',
  RECENT: 'recent',
  MID_TERM: 'mid_term',
  LONG_TERM: 'long_term',
};

/**
 * Default token budgets per tier
 * @readonly
 */
const DEFAULT_TOKEN_BUDGETS = {
  [ContextTier.HEAD]: 10000,
  [ContextTier.RECENT]: 40000,
  [ContextTier.MID_TERM]: 20000,
  [ContextTier.LONG_TERM]: 10000,
};

/**
 * Tiered Context Manager
 * Manages context storage and retrieval with automatic compaction
 */
export class ContextManager {
  /**
   * Initialize context manager
   * @param {WorkerDatabase} db - Database instance
   * @param {object} options - Configuration options
   * @param {number} options.maxContextTokens - Maximum total context tokens (default: 80000)
   * @param {number} options.headTokens - Head tier token budget (default: 10000)
   * @param {number} options.recentTokens - Recent tier token budget (default: 40000)
   * @param {number} options.midTermTokens - Mid-term tier token budget (default: 20000)
   * @param {number} options.longTermTokens - Long-term tier token budget (default: 10000)
   */
  constructor(db, options = {}) {
    if (!db || !(db instanceof WorkerDatabase)) {
      throw new Error('ContextManager requires a WorkerDatabase instance');
    }

    this.db = db;
    this.maxContextTokens = options.maxContextTokens || 80000;
    this.tokenBudgets = {
      [ContextTier.HEAD]: options.headTokens || DEFAULT_TOKEN_BUDGETS[ContextTier.HEAD],
      [ContextTier.RECENT]: options.recentTokens || DEFAULT_TOKEN_BUDGETS[ContextTier.RECENT],
      [ContextTier.MID_TERM]: options.midTermTokens || DEFAULT_TOKEN_BUDGETS[ContextTier.MID_TERM],
      [ContextTier.LONG_TERM]: options.longTermTokens || DEFAULT_TOKEN_BUDGETS[ContextTier.LONG_TERM],
    };
  }

  /**
   * Load context segments for a session
   * @param {string} sessionId - Session identifier
   * @param {string|string[]} tier - Tier(s) to load ('all' for all tiers, or specific tier(s))
   * @returns {Promise<object>} Context segments by tier
   */
  async loadContext(sessionId, tier = 'all') {
    const tiersToLoad = tier === 'all'
      ? Object.values(ContextTier)
      : Array.isArray(tier) ? tier : [tier];

    const context = {};

    for (const tierName of tiersToLoad) {
      const segments = await this._loadTierSegments(sessionId, tierName);
      context[tierName] = segments;
    }

    return context;
  }

  /**
   * Load context segments for a specific tier
   * @private
   * @param {string} sessionId - Session identifier
   * @param {string} tier - Tier to load
   * @returns {Promise<Array>} Array of context segments
   */
  async _loadTierSegments(sessionId, tier) {
    const stmt = this.db.db.prepare(`
      SELECT id, content, token_count, created_at
      FROM context_segments
      WHERE session_id = ? AND segment_type = ?
      ORDER BY created_at DESC
    `);

    return stmt.all(sessionId, tier);
  }

  /**
   * Save a context segment to database
   * @param {string} sessionId - Session identifier
   * @param {string} tier - Context tier (head, recent, mid_term, long_term)
   * @param {string} content - Content to save
   * @param {number} tokenCount - Token count (optional, will be estimated if not provided)
   * @returns {Promise<number>} Segment ID
   */
  async saveContextSegment(sessionId, tier, content, tokenCount = null) {
    if (!Object.values(ContextTier).includes(tier)) {
      throw new Error(`Invalid context tier: ${tier}`);
    }

    const tokens = tokenCount !== null ? tokenCount : this.estimateTokens(content);

    const stmt = this.db.db.prepare(`
      INSERT INTO context_segments (session_id, segment_type, content, token_count)
      VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(sessionId, tier, content, tokens);

    // Check if compaction is needed for this tier
    await this._checkCompaction(sessionId, tier);

    return result.lastInsertRowid;
  }

  /**
   * Add a message to the recent tier
   * @param {string} sessionId - Session identifier
   * @param {string} role - Message role (user, assistant, system)
   * @param {string} content - Message content
   * @returns {Promise<number>} Segment ID
   */
  async addMessage(sessionId, role, content) {
    const messageText = `${role}: ${content}`;
    const tokenCount = this.estimateTokens(messageText);

    return await this.saveContextSegment(sessionId, ContextTier.RECENT, messageText, tokenCount);
  }

  /**
   * Get total token count for a tier
   * @param {string} sessionId - Session identifier
   * @param {string} tier - Context tier
   * @returns {Promise<number>} Total token count
   */
  async getTierTokenCount(sessionId, tier) {
    const stmt = this.db.db.prepare(`
      SELECT COALESCE(SUM(token_count), 0) as total_tokens
      FROM context_segments
      WHERE session_id = ? AND segment_type = ?
    `);

    const result = stmt.get(sessionId, tier);
    return result.total_tokens || 0;
  }

  /**
   * Get total context token count across all tiers
   * @param {string} sessionId - Session identifier
   * @returns {Promise<object>} Token counts by tier
   */
  async getTotalTokenCount(sessionId) {
    const tokenCounts = {};

    for (const tier of Object.values(ContextTier)) {
      tokenCounts[tier] = await this.getTierTokenCount(sessionId, tier);
    }

    tokenCounts.total = Object.values(tokenCounts).reduce((sum, count) => sum + count, 0);

    return tokenCounts;
  }

  /**
   * Check if compaction is needed for a tier
   * @private
   * @param {string} sessionId - Session identifier
   * @param {string} tier - Context tier
   * @returns {Promise<void>}
   */
  async _checkCompaction(sessionId, tier) {
    const currentTokens = await this.getTierTokenCount(sessionId, tier);
    const budget = this.tokenBudgets[tier];

    if (currentTokens > budget) {
      await this.compactContext(sessionId, tier);
    }
  }

  /**
   * Compact context for a specific tier
   * Moves content from higher-fidelity tier to lower-fidelity tier
   * @param {string} sessionId - Session identifier
   * @param {string} tier - Tier to compact (recent or mid_term)
   * @returns {Promise<void>}
   */
  async compactContext(sessionId, tier) {
    if (tier === ContextTier.RECENT) {
      // Move oldest 50% of RECENT to MID_TERM (summarized)
      await this._compactRecentToMidTerm(sessionId);
    } else if (tier === ContextTier.MID_TERM) {
      // Move oldest 50% of MID_TERM to LONG_TERM (vectorized placeholder)
      await this._compactMidTermToLongTerm(sessionId);
    } else if (tier === ContextTier.LONG_TERM) {
      // Archive oldest LONG_TERM segments (delete or move to external storage)
      await this._archiveLongTerm(sessionId);
    }
    // HEAD tier is never compacted
  }

  /**
   * Compact RECENT tier to MID_TERM tier
   * @private
   * @param {string} sessionId - Session identifier
   * @returns {Promise<void>}
   */
  async _compactRecentToMidTerm(sessionId) {
    // Get oldest 50% of recent segments
    const oldSegments = await this._getOldestSegments(sessionId, ContextTier.RECENT, 0.5);

    if (oldSegments.length === 0) {
      return;
    }

    // Summarize segments (simple extraction for now)
    const summary = this._generateSummary(oldSegments);
    const summaryTokens = this.estimateTokens(summary);

    // Insert into MID_TERM tier
    await this.saveContextSegment(sessionId, ContextTier.MID_TERM, summary, summaryTokens);

    // Delete compacted segments from RECENT
    await this._deleteSegments(sessionId, oldSegments.map(s => s.id));
  }

  /**
   * Compact MID_TERM tier to LONG_TERM tier
   * @private
   * @param {string} sessionId - Session identifier
   * @returns {Promise<void>}
   */
  async _compactMidTermToLongTerm(sessionId) {
    // Get oldest 50% of mid-term segments
    const oldSegments = await this._getOldestSegments(sessionId, ContextTier.MID_TERM, 0.5);

    if (oldSegments.length === 0) {
      return;
    }

    // Vectorize segments (placeholder - use simple reference for now)
    const vectorReference = this._generateVectorReference(oldSegments);
    const referenceTokens = this.estimateTokens(vectorReference);

    // Insert into LONG_TERM tier
    await this.saveContextSegment(sessionId, ContextTier.LONG_TERM, vectorReference, referenceTokens);

    // Delete compacted segments from MID_TERM
    await this._deleteSegments(sessionId, oldSegments.map(s => s.id));
  }

  /**
   * Archive old LONG_TERM segments
   * @private
   * @param {string} sessionId - Session identifier
   * @returns {Promise<void>}
   */
  async _archiveLongTerm(sessionId) {
    // Get oldest 50% of long-term segments
    const oldSegments = await this._getOldestSegments(sessionId, ContextTier.LONG_TERM, 0.5);

    if (oldSegments.length === 0) {
      return;
    }

    // Delete archived segments (future: move to external storage)
    await this._deleteSegments(sessionId, oldSegments.map(s => s.id));
  }

  /**
   * Get oldest segments from a tier
   * @private
   * @param {string} sessionId - Session identifier
   * @param {string} tier - Context tier
   * @param {number} fraction - Fraction of segments to retrieve (0.5 = 50%)
   * @returns {Promise<Array>} Oldest segments
   */
  async _getOldestSegments(sessionId, tier, fraction = 0.5) {
    const stmt = this.db.db.prepare(`
      SELECT id, content, token_count, created_at
      FROM context_segments
      WHERE session_id = ? AND segment_type = ?
      ORDER BY created_at ASC
      LIMIT (SELECT CAST(COUNT(*) * ? AS INTEGER) FROM context_segments WHERE session_id = ? AND segment_type = ?)
    `);

    return stmt.all(sessionId, tier, fraction, sessionId, tier);
  }

  /**
   * Delete segments by IDs
   * @private
   * @param {string} sessionId - Session identifier
   * @param {number[]} segmentIds - Array of segment IDs to delete
   * @returns {Promise<void>}
   */
  async _deleteSegments(sessionId, segmentIds) {
    if (segmentIds.length === 0) {
      return;
    }

    const placeholders = segmentIds.map(() => '?').join(',');
    const stmt = this.db.db.prepare(`
      DELETE FROM context_segments
      WHERE session_id = ? AND id IN (${placeholders})
    `);

    stmt.run(sessionId, ...segmentIds);
  }

  /**
   * Generate a summary from segments (simple extraction)
   * @private
   * @param {Array} segments - Segments to summarize
   * @returns {string} Summary text
   */
  _generateSummary(segments) {
    if (segments.length === 0) {
      return '';
    }

    // Simple summarization: first + last message + metadata
    const first = segments[0];
    const last = segments[segments.length - 1];

    const summary = [
      `[SUMMARY: ${segments.length} messages from ${first.created_at} to ${last.created_at}]`,
      `First: ${first.content.substring(0, 200)}...`,
      `Last: ${last.content.substring(0, 200)}...`,
    ].join('\n');

    return summary;
  }

  /**
   * Generate a vector reference for segments (placeholder)
   * @private
   * @param {Array} segments - Segments to vectorize
   * @returns {string} Vector reference
   */
  _generateVectorReference(segments) {
    if (segments.length === 0) {
      return '';
    }

    // Placeholder: just store metadata reference
    // Future: integrate with RAG/vector DB
    const first = segments[0];
    const last = segments[segments.length - 1];

    const reference = [
      `[VECTOR_REF: ${segments.length} segments]`,
      `Timespan: ${first.created_at} to ${last.created_at}`,
      `Total tokens: ${segments.reduce((sum, s) => sum + s.token_count, 0)}`,
    ].join('\n');

    return reference;
  }

  /**
   * Estimate token count for text
   * Uses simple heuristic: ~4 characters per token
   * @param {string} text - Text to estimate
   * @returns {number} Estimated token count
   */
  estimateTokens(text) {
    if (!text) {
      return 0;
    }
    return Math.ceil(text.length / 4);
  }

  /**
   * Format context for agent consumption
   * @param {string} sessionId - Session identifier
   * @param {object} options - Formatting options
   * @param {boolean} options.includeHead - Include HEAD tier (default: true)
   * @param {boolean} options.includeRecent - Include RECENT tier (default: true)
   * @param {boolean} options.includeMidTerm - Include MID_TERM tier (default: false)
   * @param {boolean} options.includeLongTerm - Include LONG_TERM tier (default: false)
   * @returns {Promise<string>} Formatted context string
   */
  async formatContext(sessionId, options = {}) {
    const {
      includeHead = true,
      includeRecent = true,
      includeMidTerm = false,
      includeLongTerm = false,
    } = options;

    const sections = [];

    if (includeHead) {
      const headSegments = await this._loadTierSegments(sessionId, ContextTier.HEAD);
      if (headSegments.length > 0) {
        sections.push('=== SYSTEM CONTEXT (HEAD) ===');
        sections.push(headSegments.map(s => s.content).join('\n\n'));
      }
    }

    if (includeRecent) {
      const recentSegments = await this._loadTierSegments(sessionId, ContextTier.RECENT);
      if (recentSegments.length > 0) {
        sections.push('=== RECENT MESSAGES ===');
        sections.push(recentSegments.map(s => s.content).join('\n'));
      }
    }

    if (includeMidTerm) {
      const midTermSegments = await this._loadTierSegments(sessionId, ContextTier.MID_TERM);
      if (midTermSegments.length > 0) {
        sections.push('=== CONTEXT SUMMARY (MID-TERM) ===');
        sections.push(midTermSegments.map(s => s.content).join('\n\n'));
      }
    }

    if (includeLongTerm) {
      const longTermSegments = await this._loadTierSegments(sessionId, ContextTier.LONG_TERM);
      if (longTermSegments.length > 0) {
        sections.push('=== ARCHIVED CONTEXT (LONG-TERM) ===');
        sections.push(longTermSegments.map(s => s.content).join('\n\n'));
      }
    }

    return sections.join('\n\n');
  }

  /**
   * Initialize HEAD tier with system prompts and critical rules
   * @param {string} sessionId - Session identifier
   * @param {string} systemPrompt - System prompt text
   * @param {string[]} criticalRules - Array of critical rule texts
   * @returns {Promise<void>}
   */
  async initializeHead(sessionId, systemPrompt, criticalRules = []) {
    // Save system prompt
    await this.saveContextSegment(sessionId, ContextTier.HEAD, systemPrompt);

    // Save critical rules
    for (const rule of criticalRules) {
      await this.saveContextSegment(sessionId, ContextTier.HEAD, rule);
    }
  }

  /**
   * Clear all context for a session
   * @param {string} sessionId - Session identifier
   * @returns {Promise<void>}
   */
  async clearContext(sessionId) {
    const stmt = this.db.db.prepare(`
      DELETE FROM context_segments WHERE session_id = ?
    `);

    stmt.run(sessionId);
  }
}

export default ContextManager;
