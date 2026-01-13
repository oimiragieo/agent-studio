/**
 * Pattern Learning Engine
 *
 * Tracks and learns patterns across sessions for improved agent performance.
 *
 * Features:
 * - Record workflow patterns (successful agent sequences)
 * - Track tool usage patterns (common tool chains)
 * - Learn error resolution patterns (what fixed what error)
 * - Identify command sequences (repetitive operations)
 * - Calculate confidence scores (pattern reliability)
 *
 * Pattern Types:
 * - workflow: Agent workflow patterns (e.g., "architect → developer → qa")
 * - tool_sequence: Tool usage chains (e.g., "Read → Edit → Bash")
 * - error_pattern: Error-solution mappings
 * - command_sequence: CLI command patterns
 *
 * Usage:
 * ```javascript
 * import { createPatternLearner } from './pattern-learner.mjs';
 *
 * const learner = createPatternLearner(db);
 *
 * // Record a pattern
 * await learner.recordPattern('workflow', 'feature-implementation', {
 *   sequence: ['architect', 'developer', 'code-reviewer', 'qa'],
 *   success_rate: 0.95
 * });
 *
 * // Get frequent patterns
 * const patterns = await learner.getFrequentPatterns('workflow', 10);
 *
 * // Increment pattern usage
 * await learner.incrementFrequency(patternId);
 * ```
 *
 * Performance Targets:
 * - Record pattern: <1ms
 * - Get pattern: <1ms
 * - Get frequent patterns: <5ms
 * - Increment frequency: <1ms
 *
 * @module pattern-learner
 */

/**
 * Pattern Learning Engine Class
 */
export class PatternLearner {
  /**
   * @param {import('./database.mjs').MemoryDatabase} database - Initialized database instance
   */
  constructor(database) {
    if (!database) {
      throw new Error('Database instance is required');
    }

    this.db = database;

    /**
     * Pattern type constants
     */
    this.PATTERN_TYPES = {
      WORKFLOW: 'workflow',
      TOOL_SEQUENCE: 'tool_sequence',
      ERROR_PATTERN: 'error_pattern',
      COMMAND_SEQUENCE: 'command_sequence',
    };

    /**
     * Confidence thresholds
     */
    this.CONFIDENCE_THRESHOLDS = {
      MIN: 0.1, // Minimum confidence for new patterns
      USEFUL: 0.5, // Minimum for pattern suggestions
      HIGH: 0.7, // High confidence patterns
      VERY_HIGH: 0.9, // Very reliable patterns
    };

    /**
     * Frequency thresholds
     */
    this.FREQUENCY_THRESHOLDS = {
      RARE: 1, // Seen once
      OCCASIONAL: 5, // Seen a few times
      FREQUENT: 10, // Seen many times
      COMMON: 50, // Very common pattern
    };
  }

  /**
   * Record or update a learned pattern
   *
   * @param {string} patternType - Type of pattern (workflow, tool_sequence, error_pattern, command_sequence)
   * @param {object} patternData - Pattern details (JSON serializable)
   * @param {number} [frequency=1] - Initial frequency (incremented if pattern exists)
   * @returns {Promise<{id: number, isNew: boolean, confidence: number}>}
   *
   * @example
   * await learner.recordPattern('workflow', {
   *   name: 'feature-implementation',
   *   sequence: ['architect', 'developer', 'qa'],
   *   success_rate: 0.95
   * });
   */
  async recordPattern(patternType, patternData, frequency = 1) {
    if (!this.db.isInitialized) {
      throw new Error('Database not initialized');
    }

    // Validate pattern type
    if (!Object.values(this.PATTERN_TYPES).includes(patternType)) {
      throw new Error(
        `Invalid pattern type: ${patternType}. Must be one of: ${Object.values(this.PATTERN_TYPES).join(', ')}`
      );
    }

    // Validate pattern data
    if (!patternData || typeof patternData !== 'object') {
      throw new Error('Pattern data must be a non-null object');
    }

    const startTime = Date.now();

    try {
      // Generate pattern key from data
      const patternKey = this._generatePatternKey(patternType, patternData);
      const patternValue = JSON.stringify(patternData);

      // Check if pattern exists
      const existing = this.db
        .prepare(
          `
                SELECT id, occurrence_count, confidence_score
                FROM learned_patterns
                WHERE pattern_type = ? AND pattern_key = ?
            `
        )
        .get(patternType, patternKey);

      if (existing) {
        // Update existing pattern
        const newOccurrenceCount = existing.occurrence_count + frequency;
        const newConfidence = this._calculateConfidence(
          existing.confidence_score,
          existing.occurrence_count,
          frequency
        );

        this.db
          .prepare(
            `
                    UPDATE learned_patterns
                    SET occurrence_count = ?,
                        confidence_score = ?,
                        last_seen = CURRENT_TIMESTAMP,
                        pattern_value = ?
                    WHERE id = ?
                `
          )
          .run(newOccurrenceCount, newConfidence, patternValue, existing.id);

        const duration = Date.now() - startTime;

        return {
          id: existing.id,
          isNew: false,
          confidence: newConfidence,
          occurrenceCount: newOccurrenceCount,
          durationMs: duration,
        };
      } else {
        // Insert new pattern
        const initialConfidence = this.CONFIDENCE_THRESHOLDS.MIN;

        const result = this.db
          .prepare(
            `
                    INSERT INTO learned_patterns (
                        pattern_type,
                        pattern_key,
                        pattern_value,
                        occurrence_count,
                        confidence_score
                    )
                    VALUES (?, ?, ?, ?, ?)
                `
          )
          .run(patternType, patternKey, patternValue, frequency, initialConfidence);

        const duration = Date.now() - startTime;

        return {
          id: result.lastInsertRowid,
          isNew: true,
          confidence: initialConfidence,
          occurrenceCount: frequency,
          durationMs: duration,
        };
      }
    } catch (error) {
      console.error('[PatternLearner] Error recording pattern:', error.message);
      throw new Error(`Failed to record pattern: ${error.message}`);
    }
  }

  /**
   * Get a specific pattern by type and key
   *
   * @param {string} patternType - Pattern type
   * @param {string} patternKey - Pattern key
   * @returns {Promise<object|null>} Pattern data or null if not found
   *
   * @example
   * const pattern = await learner.getPattern('workflow', 'feature-implementation');
   */
  async getPattern(patternType, patternKey) {
    if (!this.db.isInitialized) {
      throw new Error('Database not initialized');
    }

    try {
      const pattern = this.db
        .prepare(
          `
                SELECT
                    id,
                    pattern_type,
                    pattern_key,
                    pattern_value,
                    occurrence_count,
                    confidence_score,
                    first_seen,
                    last_seen
                FROM learned_patterns
                WHERE pattern_type = ? AND pattern_key = ?
            `
        )
        .get(patternType, patternKey);

      if (!pattern) {
        return null;
      }

      // Parse pattern value
      try {
        pattern.data = JSON.parse(pattern.pattern_value);
      } catch (error) {
        console.warn('[PatternLearner] Failed to parse pattern value:', error.message);
        pattern.data = pattern.pattern_value;
      }

      return {
        id: pattern.id,
        type: pattern.pattern_type,
        key: pattern.pattern_key,
        data: pattern.data,
        frequency: pattern.occurrence_count,
        confidence: pattern.confidence_score,
        firstSeen: pattern.first_seen,
        lastSeen: pattern.last_seen,
      };
    } catch (error) {
      console.error('[PatternLearner] Error getting pattern:', error.message);
      throw new Error(`Failed to get pattern: ${error.message}`);
    }
  }

  /**
   * Get top N most frequent patterns by type
   *
   * @param {string} patternType - Pattern type to filter by
   * @param {number} [limit=10] - Maximum number of patterns to return
   * @param {number} [minConfidence=0.5] - Minimum confidence threshold
   * @returns {Promise<Array>} Array of patterns sorted by frequency
   *
   * @example
   * const patterns = await learner.getFrequentPatterns('workflow', 10, 0.7);
   */
  async getFrequentPatterns(patternType, limit = 10, minConfidence = 0.5) {
    if (!this.db.isInitialized) {
      throw new Error('Database not initialized');
    }

    try {
      const patterns = this.db
        .prepare(
          `
                SELECT
                    id,
                    pattern_type,
                    pattern_key,
                    pattern_value,
                    occurrence_count,
                    confidence_score,
                    first_seen,
                    last_seen
                FROM learned_patterns
                WHERE pattern_type = ?
                  AND confidence_score >= ?
                ORDER BY occurrence_count DESC, confidence_score DESC, last_seen DESC
                LIMIT ?
            `
        )
        .all(patternType, minConfidence, limit);

      return patterns.map(pattern => {
        // Parse pattern value
        let data;
        try {
          data = JSON.parse(pattern.pattern_value);
        } catch (error) {
          console.warn('[PatternLearner] Failed to parse pattern value:', error.message);
          data = pattern.pattern_value;
        }

        return {
          id: pattern.id,
          type: pattern.pattern_type,
          key: pattern.pattern_key,
          data,
          frequency: pattern.occurrence_count,
          confidence: pattern.confidence_score,
          firstSeen: pattern.first_seen,
          lastSeen: pattern.last_seen,
        };
      });
    } catch (error) {
      console.error('[PatternLearner] Error getting frequent patterns:', error.message);
      throw new Error(`Failed to get frequent patterns: ${error.message}`);
    }
  }

  /**
   * Increment pattern frequency and update confidence
   *
   * @param {number} patternId - Pattern ID
   * @param {number} [incrementBy=1] - Amount to increment frequency
   * @returns {Promise<{confidence: number, frequency: number}>}
   *
   * @example
   * await learner.incrementFrequency(42, 1);
   */
  async incrementFrequency(patternId, incrementBy = 1) {
    if (!this.db.isInitialized) {
      throw new Error('Database not initialized');
    }

    if (!Number.isInteger(patternId) || patternId <= 0) {
      throw new Error('Pattern ID must be a positive integer');
    }

    if (!Number.isInteger(incrementBy) || incrementBy <= 0) {
      throw new Error('Increment value must be a positive integer');
    }

    try {
      // Get current pattern
      const pattern = this.db
        .prepare(
          `
                SELECT occurrence_count, confidence_score
                FROM learned_patterns
                WHERE id = ?
            `
        )
        .get(patternId);

      if (!pattern) {
        throw new Error(`Pattern with ID ${patternId} not found`);
      }

      // Calculate new values
      const newOccurrenceCount = pattern.occurrence_count + incrementBy;
      const newConfidence = this._calculateConfidence(
        pattern.confidence_score,
        pattern.occurrence_count,
        incrementBy
      );

      // Update pattern
      this.db
        .prepare(
          `
                UPDATE learned_patterns
                SET occurrence_count = ?,
                    confidence_score = ?,
                    last_seen = CURRENT_TIMESTAMP
                WHERE id = ?
            `
        )
        .run(newOccurrenceCount, newConfidence, patternId);

      return {
        confidence: newConfidence,
        frequency: newOccurrenceCount,
      };
    } catch (error) {
      console.error('[PatternLearner] Error incrementing frequency:', error.message);
      throw new Error(`Failed to increment frequency: ${error.message}`);
    }
  }

  /**
   * Get all patterns above a confidence threshold
   *
   * @param {number} [minConfidence=0.7] - Minimum confidence threshold
   * @param {number} [limit=50] - Maximum number of patterns
   * @returns {Promise<Array>} High-confidence patterns
   */
  async getHighConfidencePatterns(minConfidence = 0.7, limit = 50) {
    if (!this.db.isInitialized) {
      throw new Error('Database not initialized');
    }

    try {
      const patterns = this.db
        .prepare(
          `
                SELECT
                    id,
                    pattern_type,
                    pattern_key,
                    pattern_value,
                    occurrence_count,
                    confidence_score,
                    first_seen,
                    last_seen
                FROM learned_patterns
                WHERE confidence_score >= ?
                ORDER BY confidence_score DESC, occurrence_count DESC
                LIMIT ?
            `
        )
        .all(minConfidence, limit);

      return patterns.map(pattern => {
        let data;
        try {
          data = JSON.parse(pattern.pattern_value);
        } catch (error) {
          data = pattern.pattern_value;
        }

        return {
          id: pattern.id,
          type: pattern.pattern_type,
          key: pattern.pattern_key,
          data,
          frequency: pattern.occurrence_count,
          confidence: pattern.confidence_score,
          firstSeen: pattern.first_seen,
          lastSeen: pattern.last_seen,
        };
      });
    } catch (error) {
      console.error('[PatternLearner] Error getting high-confidence patterns:', error.message);
      throw new Error(`Failed to get high-confidence patterns: ${error.message}`);
    }
  }

  /**
   * Get patterns by agent type (for workflow patterns)
   *
   * @param {string} agentType - Agent type (e.g., 'developer', 'architect')
   * @param {number} [limit=5] - Maximum patterns to return
   * @returns {Promise<Array>} Workflow patterns for agent
   */
  async getPatternsForAgent(agentType, limit = 5) {
    if (!this.db.isInitialized) {
      throw new Error('Database not initialized');
    }

    try {
      const patterns = this.db
        .prepare(
          `
                SELECT
                    id,
                    pattern_type,
                    pattern_key,
                    pattern_value,
                    occurrence_count,
                    confidence_score,
                    first_seen,
                    last_seen
                FROM learned_patterns
                WHERE pattern_type = 'workflow'
                  AND pattern_key LIKE ?
                  AND confidence_score > 0.5
                ORDER BY confidence_score DESC, occurrence_count DESC
                LIMIT ?
            `
        )
        .all(`%${agentType}%`, limit);

      return patterns.map(pattern => {
        let data;
        try {
          data = JSON.parse(pattern.pattern_value);
        } catch (error) {
          data = pattern.pattern_value;
        }

        return {
          id: pattern.id,
          type: pattern.pattern_type,
          key: pattern.pattern_key,
          data,
          frequency: pattern.occurrence_count,
          confidence: pattern.confidence_score,
          firstSeen: pattern.first_seen,
          lastSeen: pattern.last_seen,
        };
      });
    } catch (error) {
      console.error('[PatternLearner] Error getting patterns for agent:', error.message);
      throw new Error(`Failed to get patterns for agent: ${error.message}`);
    }
  }

  /**
   * Delete patterns below confidence threshold (cleanup)
   *
   * @param {number} [maxConfidence=0.3] - Delete patterns below this threshold
   * @param {number} [olderThanDays=30] - Only delete if not seen in N days
   * @returns {Promise<{deleted: number}>}
   */
  async cleanupLowConfidencePatterns(maxConfidence = 0.3, olderThanDays = 30) {
    if (!this.db.isInitialized) {
      throw new Error('Database not initialized');
    }

    try {
      const thresholdDate = new Date(
        Date.now() - olderThanDays * 24 * 60 * 60 * 1000
      ).toISOString();

      const result = this.db
        .prepare(
          `
                DELETE FROM learned_patterns
                WHERE confidence_score < ?
                  AND last_seen < ?
            `
        )
        .run(maxConfidence, thresholdDate);

      console.log(`[PatternLearner] Cleaned up ${result.changes} low-confidence patterns`);

      return { deleted: result.changes };
    } catch (error) {
      console.error('[PatternLearner] Error cleaning up patterns:', error.message);
      throw new Error(`Failed to cleanup patterns: ${error.message}`);
    }
  }

  /**
   * Get pattern statistics
   *
   * @returns {Promise<object>} Statistics about learned patterns
   */
  async getStatistics() {
    if (!this.db.isInitialized) {
      throw new Error('Database not initialized');
    }

    try {
      const stats = this.db
        .prepare(
          `
                SELECT
                    pattern_type,
                    COUNT(*) as count,
                    AVG(confidence_score) as avg_confidence,
                    AVG(occurrence_count) as avg_frequency,
                    MAX(occurrence_count) as max_frequency
                FROM learned_patterns
                GROUP BY pattern_type
            `
        )
        .all();

      const total = this.db
        .prepare(
          `
                SELECT COUNT(*) as total FROM learned_patterns
            `
        )
        .get();

      return {
        total: total.total,
        byType: stats.reduce((acc, stat) => {
          acc[stat.pattern_type] = {
            count: stat.count,
            avgConfidence: parseFloat(stat.avg_confidence.toFixed(3)),
            avgFrequency: parseFloat(stat.avg_frequency.toFixed(1)),
            maxFrequency: stat.max_frequency,
          };
          return acc;
        }, {}),
      };
    } catch (error) {
      console.error('[PatternLearner] Error getting statistics:', error.message);
      throw new Error(`Failed to get statistics: ${error.message}`);
    }
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  /**
   * Generate a unique pattern key from pattern data
   *
   * @private
   * @param {string} patternType - Pattern type
   * @param {object} patternData - Pattern data
   * @returns {string} Unique pattern key
   */
  _generatePatternKey(patternType, patternData) {
    switch (patternType) {
      case this.PATTERN_TYPES.WORKFLOW:
        // For workflows, key is agent sequence
        if (patternData.sequence && Array.isArray(patternData.sequence)) {
          return `workflow:${patternData.sequence.join('->')}`;
        }
        if (patternData.name) {
          return `workflow:${patternData.name}`;
        }
        break;

      case this.PATTERN_TYPES.TOOL_SEQUENCE:
        // For tool sequences, key is tool chain
        if (patternData.tools && Array.isArray(patternData.tools)) {
          return `tools:${patternData.tools.join('->')}`;
        }
        break;

      case this.PATTERN_TYPES.ERROR_PATTERN:
        // For errors, key is error type + solution
        if (patternData.errorType && patternData.solution) {
          return `error:${patternData.errorType}:${patternData.solution}`;
        }
        break;

      case this.PATTERN_TYPES.COMMAND_SEQUENCE:
        // For commands, key is command chain
        if (patternData.commands && Array.isArray(patternData.commands)) {
          return `cmd:${patternData.commands.join(';')}`;
        }
        break;
    }

    // Fallback: hash the entire data object
    return `${patternType}:${this._hashObject(patternData)}`;
  }

  /**
   * Calculate updated confidence score
   * Uses exponential moving average for confidence updates
   *
   * @private
   * @param {number} currentConfidence - Current confidence score
   * @param {number} currentCount - Current occurrence count
   * @param {number} increment - Number of new occurrences
   * @returns {number} Updated confidence score (0-0.99)
   */
  _calculateConfidence(currentConfidence, currentCount, increment) {
    // Confidence increases with more occurrences but asymptotically approaches 0.99
    // Formula: new_confidence = current + (1 - current) * growth_rate
    // Growth rate decreases with more occurrences

    const totalCount = currentCount + increment;

    // Growth rate based on frequency tier
    let growthRate;
    if (totalCount < this.FREQUENCY_THRESHOLDS.OCCASIONAL) {
      growthRate = 0.1; // 10% growth for rare patterns
    } else if (totalCount < this.FREQUENCY_THRESHOLDS.FREQUENT) {
      growthRate = 0.05; // 5% growth for occasional patterns
    } else if (totalCount < this.FREQUENCY_THRESHOLDS.COMMON) {
      growthRate = 0.02; // 2% growth for frequent patterns
    } else {
      growthRate = 0.01; // 1% growth for common patterns
    }

    // Calculate new confidence
    const newConfidence = currentConfidence + (1 - currentConfidence) * growthRate * increment;

    // Cap at 0.99 to avoid false certainty
    return Math.min(0.99, newConfidence);
  }

  /**
   * Simple hash function for objects
   *
   * @private
   * @param {object} obj - Object to hash
   * @returns {string} Hash string
   */
  _hashObject(obj) {
    const str = JSON.stringify(obj);
    let hash = 0;

    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(36);
  }
}

/**
 * Factory function to create PatternLearner instance
 *
 * @param {import('./database.mjs').MemoryDatabase} database - Initialized database
 * @returns {PatternLearner} Pattern learner instance
 *
 * @example
 * import { createMemoryDatabase } from './database.mjs';
 * import { createPatternLearner } from './pattern-learner.mjs';
 *
 * const db = createMemoryDatabase();
 * await db.initialize();
 *
 * const learner = createPatternLearner(db);
 */
export function createPatternLearner(database) {
  return new PatternLearner(database);
}
