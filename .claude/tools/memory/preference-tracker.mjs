/**
 * Preference Tracking for Memory System (Step 2.8)
 *
 * Manages user preferences across sessions with confidence scoring.
 *
 * Features:
 * - Record user preferences (code style, language, frameworks)
 * - Get/update preferences with confidence tracking
 * - Cross-session preference persistence
 * - Confidence decay for stale preferences
 *
 * Architecture Reference: Section 9.3 - User Preference Tracking
 *
 * Performance Targets:
 * - Single preference insert/update: <1ms
 * - Preference retrieval: <1ms
 * - Bulk preference fetch: <5ms
 *
 * Usage:
 * ```javascript
 * const tracker = new PreferenceTracker(database);
 * await tracker.recordPreference('sess-123', 'code_style', 'airbnb', 0.9);
 * const pref = await tracker.getPreference('user-456', 'code_style');
 * ```
 */

/**
 * PreferenceTracker Class
 *
 * Manages user preferences with confidence scoring and temporal tracking.
 */
export class PreferenceTracker {
  /**
   * @param {object} database - MemoryDatabase instance
   */
  constructor(database) {
    if (!database) {
      throw new Error('Database instance required');
    }
    this.db = database;
  }

  /**
   * Record a user preference
   *
   * Inserts or updates a preference with confidence scoring.
   * Higher confidence scores indicate more certain preferences.
   *
   * @param {string} sessionId - Session ID to get user_id from
   * @param {string} key - Preference key (e.g., 'code_style', 'language')
   * @param {string} value - Preference value
   * @param {number} confidence - Confidence score (0.0-1.0, default 1.0)
   * @returns {Promise<{success: boolean, userId: string, key: string, value: string, confidence: number}>}
   *
   * @example
   * // Record code style preference with high confidence
   * await tracker.recordPreference('sess-123', 'code_style', 'airbnb', 0.95);
   *
   * // Record language preference with medium confidence
   * await tracker.recordPreference('sess-123', 'language', 'typescript', 0.7);
   */
  async recordPreference(sessionId, key, value, confidence = 1.0) {
    if (!sessionId || typeof sessionId !== 'string') {
      throw new Error('Valid sessionId required');
    }
    if (!key || typeof key !== 'string') {
      throw new Error('Valid preference key required');
    }
    if (value === null || value === undefined) {
      throw new Error('Preference value required');
    }
    if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
      throw new Error('Confidence must be a number between 0.0 and 1.0');
    }

    try {
      // Get user_id from session
      const session = this.db.getSession(sessionId);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      const userId = session.user_id;

      // Prepare preference value with confidence metadata
      const preferenceData = {
        value: String(value),
        confidence,
        recordedAt: new Date().toISOString(),
      };

      // Insert or update preference
      const stmt = this.db.prepare(`
                INSERT INTO user_preferences (user_id, preference_key, preference_value, updated_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(user_id, preference_key) DO UPDATE SET
                    preference_value = excluded.preference_value,
                    updated_at = CURRENT_TIMESTAMP
            `);

      stmt.run(userId, key, JSON.stringify(preferenceData));

      console.log(
        `[PreferenceTracker] Recorded preference for user ${userId}: ${key} = ${value} (confidence: ${confidence})`
      );

      return {
        success: true,
        userId,
        key,
        value: String(value),
        confidence,
      };
    } catch (error) {
      console.error(`[PreferenceTracker] Failed to record preference:`, error.message);
      throw error;
    }
  }

  /**
   * Get a specific preference for a user
   *
   * Retrieves preference value with confidence score and metadata.
   * Returns null if preference not found.
   *
   * @param {string} userId - User ID
   * @param {string} key - Preference key
   * @returns {Promise<{key: string, value: string, confidence: number, lastUpdated: string}|null>}
   *
   * @example
   * const pref = await tracker.getPreference('user-123', 'code_style');
   * if (pref) {
   *   console.log(`Code style: ${pref.value} (${pref.confidence * 100}% confident)`);
   * }
   */
  async getPreference(userId, key) {
    if (!userId || typeof userId !== 'string') {
      throw new Error('Valid userId required');
    }
    if (!key || typeof key !== 'string') {
      throw new Error('Valid preference key required');
    }

    try {
      const stmt = this.db.prepare(`
                SELECT preference_key, preference_value, updated_at
                FROM user_preferences
                WHERE user_id = ? AND preference_key = ?
            `);

      const row = stmt.get(userId, key);

      if (!row) {
        return null;
      }

      // Parse preference data
      let preferenceData;
      try {
        preferenceData = JSON.parse(row.preference_value);
      } catch {
        // Handle legacy plain string values
        preferenceData = {
          value: row.preference_value,
          confidence: 0.5,
          recordedAt: row.updated_at,
        };
      }

      return {
        key: row.preference_key,
        value: preferenceData.value,
        confidence: preferenceData.confidence || 0.5,
        lastUpdated: row.updated_at,
      };
    } catch (error) {
      console.error(`[PreferenceTracker] Failed to get preference:`, error.message);
      throw error;
    }
  }

  /**
   * Get all preferences for a user
   *
   * Retrieves all preferences with confidence scores and metadata.
   * Results are sorted by most recently updated first.
   *
   * @param {string} userId - User ID
   * @returns {Promise<Array<{key: string, value: string, confidence: number, lastUpdated: string}>>}
   *
   * @example
   * const prefs = await tracker.getAllPreferences('user-123');
   * for (const pref of prefs) {
   *   console.log(`${pref.key}: ${pref.value} (${pref.confidence})`);
   * }
   */
  async getAllPreferences(userId) {
    if (!userId || typeof userId !== 'string') {
      throw new Error('Valid userId required');
    }

    try {
      const stmt = this.db.prepare(`
                SELECT preference_key, preference_value, updated_at
                FROM user_preferences
                WHERE user_id = ?
                ORDER BY updated_at DESC
            `);

      const rows = stmt.all(userId);

      return rows.map(row => {
        // Parse preference data
        let preferenceData;
        try {
          preferenceData = JSON.parse(row.preference_value);
        } catch {
          // Handle legacy plain string values
          preferenceData = {
            value: row.preference_value,
            confidence: 0.5,
            recordedAt: row.updated_at,
          };
        }

        return {
          key: row.preference_key,
          value: preferenceData.value,
          confidence: preferenceData.confidence || 0.5,
          lastUpdated: row.updated_at,
        };
      });
    } catch (error) {
      console.error(`[PreferenceTracker] Failed to get all preferences:`, error.message);
      throw error;
    }
  }

  /**
   * Update confidence score for a preference
   *
   * Updates the confidence score without changing the preference value.
   * Useful for reinforcing or weakening preferences based on user actions.
   *
   * @param {string} userId - User ID
   * @param {string} key - Preference key
   * @param {number} newConfidence - New confidence score (0.0-1.0)
   * @returns {Promise<{success: boolean, key: string, oldConfidence: number, newConfidence: number}>}
   *
   * @example
   * // Reinforce preference confidence
   * await tracker.updateConfidence('user-123', 'code_style', 0.95);
   *
   * // Weaken preference confidence (user changed behavior)
   * await tracker.updateConfidence('user-123', 'language', 0.4);
   */
  async updateConfidence(userId, key, newConfidence) {
    if (!userId || typeof userId !== 'string') {
      throw new Error('Valid userId required');
    }
    if (!key || typeof key !== 'string') {
      throw new Error('Valid preference key required');
    }
    if (typeof newConfidence !== 'number' || newConfidence < 0 || newConfidence > 1) {
      throw new Error('Confidence must be a number between 0.0 and 1.0');
    }

    try {
      // Get existing preference
      const existing = await this.getPreference(userId, key);
      if (!existing) {
        throw new Error(`Preference not found: ${userId}/${key}`);
      }

      const oldConfidence = existing.confidence;

      // Update with new confidence
      const preferenceData = {
        value: existing.value,
        confidence: newConfidence,
        recordedAt: new Date().toISOString(),
      };

      const stmt = this.db.prepare(`
                UPDATE user_preferences
                SET preference_value = ?, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ? AND preference_key = ?
            `);

      stmt.run(JSON.stringify(preferenceData), userId, key);

      console.log(
        `[PreferenceTracker] Updated confidence for ${userId}/${key}: ${oldConfidence} → ${newConfidence}`
      );

      return {
        success: true,
        key,
        oldConfidence,
        newConfidence,
      };
    } catch (error) {
      console.error(`[PreferenceTracker] Failed to update confidence:`, error.message);
      throw error;
    }
  }

  /**
   * Delete a preference
   *
   * Removes a preference from the database.
   *
   * @param {string} userId - User ID
   * @param {string} key - Preference key
   * @returns {Promise<{success: boolean, deleted: boolean}>}
   *
   * @example
   * await tracker.deletePreference('user-123', 'old_framework');
   */
  async deletePreference(userId, key) {
    if (!userId || typeof userId !== 'string') {
      throw new Error('Valid userId required');
    }
    if (!key || typeof key !== 'string') {
      throw new Error('Valid preference key required');
    }

    try {
      const stmt = this.db.prepare(`
                DELETE FROM user_preferences
                WHERE user_id = ? AND preference_key = ?
            `);

      const result = stmt.run(userId, key);

      const deleted = result.changes > 0;

      if (deleted) {
        console.log(`[PreferenceTracker] Deleted preference ${userId}/${key}`);
      }

      return {
        success: true,
        deleted,
      };
    } catch (error) {
      console.error(`[PreferenceTracker] Failed to delete preference:`, error.message);
      throw error;
    }
  }

  /**
   * Get preferences by pattern
   *
   * Retrieves all preferences matching a key pattern (e.g., 'lang_*').
   *
   * @param {string} userId - User ID
   * @param {string} pattern - Key pattern (SQL LIKE syntax)
   * @returns {Promise<Array<{key: string, value: string, confidence: number, lastUpdated: string}>>}
   *
   * @example
   * // Get all language-related preferences
   * const langPrefs = await tracker.getPreferencesByPattern('user-123', 'lang_%');
   */
  async getPreferencesByPattern(userId, pattern) {
    if (!userId || typeof userId !== 'string') {
      throw new Error('Valid userId required');
    }
    if (!pattern || typeof pattern !== 'string') {
      throw new Error('Valid pattern required');
    }

    try {
      const stmt = this.db.prepare(`
                SELECT preference_key, preference_value, updated_at
                FROM user_preferences
                WHERE user_id = ? AND preference_key LIKE ?
                ORDER BY updated_at DESC
            `);

      const rows = stmt.all(userId, pattern);

      return rows.map(row => {
        // Parse preference data
        let preferenceData;
        try {
          preferenceData = JSON.parse(row.preference_value);
        } catch {
          // Handle legacy plain string values
          preferenceData = {
            value: row.preference_value,
            confidence: 0.5,
            recordedAt: row.updated_at,
          };
        }

        return {
          key: row.preference_key,
          value: preferenceData.value,
          confidence: preferenceData.confidence || 0.5,
          lastUpdated: row.updated_at,
        };
      });
    } catch (error) {
      console.error(`[PreferenceTracker] Failed to get preferences by pattern:`, error.message);
      throw error;
    }
  }

  /**
   * Apply confidence decay to stale preferences
   *
   * Reduces confidence scores for preferences that haven't been updated
   * in a specified time period. This helps identify preferences that may
   * no longer be relevant.
   *
   * @param {string} userId - User ID
   * @param {number} daysStale - Number of days before decay applies
   * @param {number} decayFactor - Multiplier for confidence (e.g., 0.8 = 20% decay)
   * @returns {Promise<{success: boolean, decayed: number}>}
   *
   * @example
   * // Decay preferences older than 30 days by 20%
   * await tracker.applyConfidenceDecay('user-123', 30, 0.8);
   */
  async applyConfidenceDecay(userId, daysStale, decayFactor = 0.8) {
    if (!userId || typeof userId !== 'string') {
      throw new Error('Valid userId required');
    }
    if (typeof daysStale !== 'number' || daysStale <= 0) {
      throw new Error('daysStale must be a positive number');
    }
    if (typeof decayFactor !== 'number' || decayFactor <= 0 || decayFactor > 1) {
      throw new Error('decayFactor must be between 0 and 1');
    }

    try {
      const stmt = this.db.prepare(`
                SELECT preference_key, preference_value, updated_at
                FROM user_preferences
                WHERE user_id = ?
                AND updated_at < datetime('now', '-' || ? || ' days')
            `);

      const stalePrefs = stmt.all(userId, daysStale);

      let decayedCount = 0;

      for (const pref of stalePrefs) {
        let preferenceData;
        try {
          preferenceData = JSON.parse(pref.preference_value);
        } catch {
          preferenceData = {
            value: pref.preference_value,
            confidence: 0.5,
            recordedAt: pref.updated_at,
          };
        }

        const newConfidence = Math.max(0.1, preferenceData.confidence * decayFactor);

        if (newConfidence !== preferenceData.confidence) {
          await this.updateConfidence(userId, pref.preference_key, newConfidence);
          decayedCount++;
        }
      }

      console.log(
        `[PreferenceTracker] Applied confidence decay: ${decayedCount} preferences updated`
      );

      return {
        success: true,
        decayed: decayedCount,
      };
    } catch (error) {
      console.error(`[PreferenceTracker] Failed to apply confidence decay:`, error.message);
      throw error;
    }
  }

  /**
   * Get preference statistics for a user
   *
   * Returns aggregate statistics about user preferences.
   *
   * @param {string} userId - User ID
   * @returns {Promise<{totalPreferences: number, avgConfidence: number, mostRecent: string|null, oldestUpdated: string|null}>}
   *
   * @example
   * const stats = await tracker.getPreferenceStats('user-123');
   * console.log(`User has ${stats.totalPreferences} preferences`);
   * console.log(`Average confidence: ${stats.avgConfidence}`);
   */
  async getPreferenceStats(userId) {
    if (!userId || typeof userId !== 'string') {
      throw new Error('Valid userId required');
    }

    try {
      const prefs = await this.getAllPreferences(userId);

      if (prefs.length === 0) {
        return {
          totalPreferences: 0,
          avgConfidence: 0,
          mostRecent: null,
          oldestUpdated: null,
        };
      }

      const avgConfidence = prefs.reduce((sum, p) => sum + p.confidence, 0) / prefs.length;
      const mostRecent = prefs[0].lastUpdated;
      const oldestUpdated = prefs[prefs.length - 1].lastUpdated;

      return {
        totalPreferences: prefs.length,
        avgConfidence: parseFloat(avgConfidence.toFixed(3)),
        mostRecent,
        oldestUpdated,
      };
    } catch (error) {
      console.error(`[PreferenceTracker] Failed to get preference stats:`, error.message);
      throw error;
    }
  }
}

/**
 * Create PreferenceTracker instance
 *
 * @param {object} database - MemoryDatabase instance
 * @returns {PreferenceTracker}
 *
 * @example
 * import { createMemoryDatabase } from './database.mjs';
 * import { createPreferenceTracker } from './preference-tracker.mjs';
 *
 * const db = createMemoryDatabase();
 * await db.initialize();
 * const tracker = createPreferenceTracker(db);
 */
export function createPreferenceTracker(database) {
  return new PreferenceTracker(database);
}
