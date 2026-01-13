/**
 * Worker Database Schema and Basic CRUD Operations
 *
 * Manages SQLite database for ephemeral worker pattern:
 * - worker_sessions: Worker lifecycle state
 * - context_segments: Tiered context storage
 * - worker_artifacts: File references (pointers, not contents)
 * - task_queue: Supervisor task queue
 *
 * @module worker-db
 * @version 1.0.0
 * @created 2025-01-12
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

/**
 * Worker Database Manager
 * Handles SQLite connection and CRUD operations for worker state
 */
export class WorkerDatabase {
  /**
   * Initialize database connection
   * @param {string} dbPath - Path to SQLite database file
   */
  constructor(dbPath = '.claude/context/memory/workers.db') {
    // Ensure directory exists
    const dbDir = dirname(dbPath);
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }

    this.dbPath = dbPath;
    this.db = null;
  }

  /**
   * Open database connection and create tables
   * @returns {Promise<void>}
   */
  async initialize() {
    this.db = new Database(this.dbPath);

    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');

    // Create tables
    this._createTables();
    this._createIndexes();
  }

  /**
   * Create database schema
   * @private
   */
  _createTables() {
    // Worker session state (replaces in-memory session-state.mjs)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS worker_sessions (
        id TEXT PRIMARY KEY,
        supervisor_id TEXT NOT NULL,
        agent_type TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        task_description TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        started_at TEXT,
        completed_at TEXT,
        result_json TEXT,
        error_message TEXT,
        memory_peak_mb REAL,
        execution_time_ms INTEGER
      )
    `);

    // Context segments for tiered memory (replaces in-memory history)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS context_segments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        segment_type TEXT NOT NULL,
        content TEXT NOT NULL,
        token_count INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (session_id) REFERENCES worker_sessions(id)
      )
    `);

    // Artifact references (pointers to files, not file contents)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS worker_artifacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        artifact_type TEXT NOT NULL,
        file_path TEXT NOT NULL,
        size_bytes INTEGER,
        checksum TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (session_id) REFERENCES worker_sessions(id)
      )
    `);

    // Task queue for supervisor
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS task_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_type TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        priority INTEGER DEFAULT 0,
        status TEXT DEFAULT 'queued',
        created_at TEXT DEFAULT (datetime('now')),
        dispatched_at TEXT,
        completed_at TEXT,
        worker_id TEXT
      )
    `);
  }

  /**
   * Create indexes for performance
   * @private
   */
  _createIndexes() {
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_sessions_status
      ON worker_sessions(status)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_context_session
      ON context_segments(session_id, segment_type)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_queue_status
      ON task_queue(status, priority DESC)
    `);
  }

  /**
   * Create a new worker session
   * @param {string} supervisorId - Supervisor process identifier
   * @param {string} agentType - Agent type (e.g., 'developer', 'analyst')
   * @param {string} taskDescription - Task description
   * @returns {string} Session ID
   */
  createWorkerSession(supervisorId, agentType, taskDescription = '') {
    const sessionId = `worker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const stmt = this.db.prepare(`
      INSERT INTO worker_sessions (id, supervisor_id, agent_type, task_description)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(sessionId, supervisorId, agentType, taskDescription);

    return sessionId;
  }

  /**
   * Get worker session by ID
   * @param {string} sessionId - Session identifier
   * @returns {object|null} Session object or null if not found
   */
  getWorkerSession(sessionId) {
    const stmt = this.db.prepare(`
      SELECT * FROM worker_sessions WHERE id = ?
    `);

    return stmt.get(sessionId) || null;
  }

  /**
   * Update worker session status
   * @param {string} sessionId - Session identifier
   * @param {string} status - New status ('pending', 'running', 'completed', 'failed')
   * @param {object} updates - Additional fields to update
   * @returns {void}
   */
  updateWorkerStatus(sessionId, status, updates = {}) {
    const fields = ['status = ?'];
    const values = [status];

    // Add timestamp based on status
    if (status === 'running' && !updates.started_at) {
      fields.push('started_at = datetime("now")');
    } else if ((status === 'completed' || status === 'failed') && !updates.completed_at) {
      fields.push('completed_at = datetime("now")');
    }

    // Add optional fields
    if (updates.result_json !== undefined) {
      fields.push('result_json = ?');
      values.push(JSON.stringify(updates.result_json));
    }
    if (updates.error_message !== undefined) {
      fields.push('error_message = ?');
      values.push(updates.error_message);
    }
    if (updates.memory_peak_mb !== undefined) {
      fields.push('memory_peak_mb = ?');
      values.push(updates.memory_peak_mb);
    }
    if (updates.execution_time_ms !== undefined) {
      fields.push('execution_time_ms = ?');
      values.push(updates.execution_time_ms);
    }

    values.push(sessionId);

    const stmt = this.db.prepare(`
      UPDATE worker_sessions
      SET ${fields.join(', ')}
      WHERE id = ?
    `);

    stmt.run(...values);
  }

  /**
   * Close database connection
   * @returns {void}
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

export default WorkerDatabase;
