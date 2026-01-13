/**
 * Memory Cleanup Service
 *
 * Provides automatic cleanup and maintenance for the memory database:
 * - Removes old archived sessions beyond TTL
 * - Clears original_content from old summarized messages
 * - Removes orphaned vector embeddings
 * - Runs SQLite VACUUM to reclaim space
 *
 * @module cleanup-service
 */

import { DatabaseSync } from 'node:sqlite';

/**
 * Memory cleanup service configuration
 * @typedef {Object} CleanupConfig
 * @property {number} sessionTTL - Session TTL in days (default: 30)
 * @property {number} messageTTL - Message TTL in days (default: 90)
 * @property {number} vectorTTL - Vector TTL in days (default: 180)
 * @property {number} runInterval - Cleanup interval in milliseconds (default: 3600000 - 1 hour)
 */

/**
 * Cleanup statistics
 * @typedef {Object} CleanupStats
 * @property {number} sessionsDeleted - Number of sessions removed
 * @property {number} messagesCleared - Number of messages with content cleared
 * @property {number} vectorsDeleted - Number of orphaned vectors removed
 * @property {number} spaceReclaimed - Approximate bytes reclaimed (from VACUUM)
 * @property {string} lastRun - ISO timestamp of last cleanup
 * @property {number} duration - Cleanup duration in milliseconds
 */

/**
 * Memory Cleanup Service
 * Manages automatic cleanup and maintenance of the memory database
 */
export class MemoryCleanupService {
  /**
   * Create a cleanup service
   * @param {DatabaseSync} database - SQLite database instance
   * @param {CleanupConfig} [config={}] - Cleanup configuration
   */
  constructor(database, config = {}) {
    this.db = database;
    this.config = {
      sessionTTL: config.sessionTTL || 30, // days
      messageTTL: config.messageTTL || 90, // days
      vectorTTL: config.vectorTTL || 180, // days
      runInterval: config.runInterval || 3600000, // 1 hour in ms
    };

    this.isRunning = false;
    this.intervalId = null;
    this.lastRun = null;
    this.stats = {
      sessionsDeleted: 0,
      messagesCleared: 0,
      vectorsDeleted: 0,
      spaceReclaimed: 0,
      lastRun: null,
      duration: 0,
    };
  }

  /**
   * Start the cleanup service background loop
   * @returns {void}
   */
  start() {
    if (this.isRunning) {
      console.warn('[MemoryCleanup] Service already running');
      return;
    }

    this.isRunning = true;
    console.log('[MemoryCleanup] Starting cleanup service', {
      sessionTTL: `${this.config.sessionTTL} days`,
      messageTTL: `${this.config.messageTTL} days`,
      vectorTTL: `${this.config.vectorTTL} days`,
      interval: `${this.config.runInterval / 1000}s`,
    });

    // Run initial cleanup
    this.runCleanup().catch(err => {
      console.error('[MemoryCleanup] Initial cleanup failed:', err);
    });

    // Schedule periodic cleanup
    this.intervalId = setInterval(() => {
      this.runCleanup().catch(err => {
        console.error('[MemoryCleanup] Periodic cleanup failed:', err);
      });
    }, this.config.runInterval);
  }

  /**
   * Stop the cleanup service
   * @returns {void}
   */
  stop() {
    if (!this.isRunning) {
      console.warn('[MemoryCleanup] Service not running');
      return;
    }

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log('[MemoryCleanup] Cleanup service stopped');
  }

  /**
   * Execute one cleanup cycle
   * @returns {Promise<CleanupStats>} Cleanup statistics
   */
  async runCleanup() {
    const startTime = Date.now();
    console.log('[MemoryCleanup] Starting cleanup cycle');

    try {
      // Get database size before cleanup
      const sizeBeforeStmt = this.db.prepare(
        'SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()'
      );
      const sizeBefore = sizeBeforeStmt.get().size;

      // Run cleanup operations
      const sessionsDeleted = this.cleanupOldSessions();
      const messagesCleared = this.cleanupOldMessages();
      const vectorsDeleted = this.cleanupOrphanedVectors();

      // Vacuum database to reclaim space
      this.vacuumDatabase();

      // Get database size after cleanup
      const sizeAfterStmt = this.db.prepare(
        'SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()'
      );
      const sizeAfter = sizeAfterStmt.get().size;
      const spaceReclaimed = Math.max(0, sizeBefore - sizeAfter);

      // Update statistics
      const duration = Date.now() - startTime;
      this.stats = {
        sessionsDeleted,
        messagesCleared,
        vectorsDeleted,
        spaceReclaimed,
        lastRun: new Date().toISOString(),
        duration,
      };
      this.lastRun = this.stats.lastRun;

      console.log('[MemoryCleanup] Cleanup cycle complete', {
        sessionsDeleted,
        messagesCleared,
        vectorsDeleted,
        spaceReclaimed: `${(spaceReclaimed / 1024).toFixed(2)} KB`,
        duration: `${duration}ms`,
      });

      return this.stats;
    } catch (error) {
      console.error('[MemoryCleanup] Cleanup cycle failed:', error);
      throw error;
    }
  }

  /**
   * Remove old archived sessions beyond TTL
   * @returns {number} Number of sessions deleted
   */
  cleanupOldSessions() {
    const stmt = this.db.prepare(`
      DELETE FROM sessions
      WHERE status = 'archived'
        AND last_activity < datetime('now', '-' || ? || ' days')
    `);

    const result = stmt.run(this.config.sessionTTL);
    const deleted = result.changes || 0;

    if (deleted > 0) {
      console.log(
        `[MemoryCleanup] Deleted ${deleted} old archived sessions (TTL: ${this.config.sessionTTL} days)`
      );
    }

    return deleted;
  }

  /**
   * Clear original_content from old summarized messages
   * @returns {number} Number of messages cleared
   */
  cleanupOldMessages() {
    const stmt = this.db.prepare(`
      UPDATE messages
      SET original_content = NULL
      WHERE is_summarized = TRUE
        AND original_content IS NOT NULL
        AND created_at < datetime('now', '-' || ? || ' days')
    `);

    const result = stmt.run(this.config.messageTTL);
    const cleared = result.changes || 0;

    if (cleared > 0) {
      console.log(
        `[MemoryCleanup] Cleared original_content from ${cleared} summarized messages (TTL: ${this.config.messageTTL} days)`
      );
    }

    return cleared;
  }

  /**
   * Remove orphaned vector embeddings
   * Vectors are orphaned when their associated message or session is deleted
   * @returns {number} Number of vectors deleted
   */
  cleanupOrphanedVectors() {
    // Delete vectors for non-existent messages
    const messageVectorsStmt = this.db.prepare(`
      DELETE FROM message_vectors
      WHERE message_id NOT IN (SELECT id FROM messages)
        OR created_at < datetime('now', '-' || ? || ' days')
    `);

    const messageVectorsResult = messageVectorsStmt.run(this.config.vectorTTL);
    const messageVectorsDeleted = messageVectorsResult.changes || 0;

    // Delete vectors for non-existent sessions
    const sessionVectorsStmt = this.db.prepare(`
      DELETE FROM session_vectors
      WHERE session_id NOT IN (SELECT id FROM sessions)
        OR created_at < datetime('now', '-' || ? || ' days')
    `);

    const sessionVectorsResult = sessionVectorsStmt.run(this.config.vectorTTL);
    const sessionVectorsDeleted = sessionVectorsResult.changes || 0;

    const totalDeleted = messageVectorsDeleted + sessionVectorsDeleted;

    if (totalDeleted > 0) {
      console.log(
        `[MemoryCleanup] Deleted ${totalDeleted} orphaned vectors (${messageVectorsDeleted} message, ${sessionVectorsDeleted} session) (TTL: ${this.config.vectorTTL} days)`
      );
    }

    return totalDeleted;
  }

  /**
   * Run SQLite VACUUM to reclaim space
   * @returns {void}
   */
  vacuumDatabase() {
    console.log('[MemoryCleanup] Running VACUUM to reclaim space...');
    this.db.exec('VACUUM');
    console.log('[MemoryCleanup] VACUUM complete');
  }

  /**
   * Get cleanup statistics
   * @returns {CleanupStats} Current cleanup statistics
   */
  getCleanupStats() {
    return { ...this.stats };
  }

  /**
   * Get service status
   * @returns {Object} Service status information
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      config: { ...this.config },
      lastRun: this.lastRun,
      stats: this.getCleanupStats(),
    };
  }
}

/**
 * Create and configure a cleanup service
 * @param {DatabaseSync} database - SQLite database instance
 * @param {CleanupConfig} [config={}] - Cleanup configuration
 * @returns {MemoryCleanupService} Configured cleanup service
 */
export function createCleanupService(database, config = {}) {
  return new MemoryCleanupService(database, config);
}

export default MemoryCleanupService;
