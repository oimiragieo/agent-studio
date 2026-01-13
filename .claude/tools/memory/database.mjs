/**
 * Memory Database Manager
 *
 * SQLite-based memory persistence for Phase 2 Memory System
 *
 * Features:
 * - Session and conversation tracking
 * - Message storage with FTS5 full-text search
 * - Agent interaction logging
 * - Routing decision tracking
 * - Cost tracking and metrics
 * - User preferences and learned patterns
 *
 * Performance Targets:
 * - Database initialization: <100ms
 * - Schema creation: <500ms
 * - Single row insert: <1ms
 * - FTS5 search (1000 messages): <10ms
 * - Vacuum operation: <5s
 */

import Database from 'better-sqlite3';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Memory Database Class
 */
export class MemoryDatabase {
    /**
     * @param {string} dbPath - Path to SQLite database file
     * @param {object} options - Database configuration options
     */
    constructor(dbPath, options = {}) {
        this.dbPath = dbPath;
        this.options = {
            verbose: options.verbose || null,
            fileMustExist: false,
            timeout: options.timeout || 5000,
            readonly: options.readonly || false,
            ...options
        };

        this.db = null;
        this.isInitialized = false;
    }

    /**
     * Initialize database connection and schema
     *
     * @returns {Promise<void>}
     */
    async initialize() {
        const startTime = Date.now();

        try {
            // Ensure database directory exists
            const dbDir = dirname(this.dbPath);
            if (!existsSync(dbDir)) {
                mkdirSync(dbDir, { recursive: true });
            }

            // Open database connection
            this.db = new Database(this.dbPath, this.options);

            // Configure SQLite for optimal performance
            this.configureSQLite();

            // Run migrations if needed
            await this.runMigrations();

            this.isInitialized = true;

            const duration = Date.now() - startTime;
            console.log(`[MemoryDB] Initialized in ${duration}ms`);

            return { success: true, duration };
        } catch (error) {
            console.error('[MemoryDB] Initialization failed:', error.message);
            throw new Error(`Database initialization failed: ${error.message}`);
        }
    }

    /**
     * Configure SQLite settings for optimal performance
     */
    configureSQLite() {
        // Enable Write-Ahead Logging for better concurrency
        this.db.pragma('journal_mode = WAL');

        // Enable foreign key constraints
        this.db.pragma('foreign_keys = ON');

        // Set synchronous mode (balance durability and performance)
        this.db.pragma('synchronous = NORMAL');

        // Set journal size limit (64MB)
        this.db.pragma('journal_size_limit = 67108864');

        // Set page size (4KB)
        this.db.pragma('page_size = 4096');

        // Set cache size (10MB)
        this.db.pragma('cache_size = -10000');

        // Enable memory-mapped I/O (128MB)
        this.db.pragma('mmap_size = 134217728');

        // Set temp store to memory
        this.db.pragma('temp_store = MEMORY');
    }

    /**
     * Run database migrations
     *
     * @returns {Promise<{applied: number, current: number}>}
     */
    async runMigrations() {
        try {
            const currentVersion = this.getSchemaVersion();
            const migrationsDir = join(__dirname, 'migrations');

            // If schema_version table doesn't exist, this is initial migration
            if (currentVersion === 0) {
                console.log('[MemoryDB] Running initial migration...');
                const initialMigration = join(migrationsDir, '001-initial.sql');

                if (existsSync(initialMigration)) {
                    const sql = readFileSync(initialMigration, 'utf-8');
                    this.db.exec(sql);
                    console.log('[MemoryDB] Initial migration complete');
                    return { applied: 1, current: 1 };
                } else {
                    throw new Error('Initial migration file not found');
                }
            }

            // Future migrations can be added here
            // For now, we only have the initial migration

            return { applied: 0, current: currentVersion };
        } catch (error) {
            console.error('[MemoryDB] Migration failed:', error.message);
            throw error;
        }
    }

    /**
     * Get current schema version
     *
     * @returns {number} Current schema version (0 if not initialized)
     */
    getSchemaVersion() {
        try {
            const result = this.db.prepare(`
                SELECT version FROM schema_version ORDER BY version DESC LIMIT 1
            `).get();

            return result ? result.version : 0;
        } catch (error) {
            // schema_version table doesn't exist yet
            return 0;
        }
    }

    /**
     * Close database connection
     */
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
            this.isInitialized = false;
            console.log('[MemoryDB] Connection closed');
        }
    }

    /**
     * Vacuum database to optimize storage
     *
     * @returns {Promise<{duration: number, success: boolean}>}
     */
    async vacuum() {
        if (!this.isInitialized) {
            throw new Error('Database not initialized');
        }

        const startTime = Date.now();

        try {
            this.db.exec('VACUUM');
            const duration = Date.now() - startTime;

            console.log(`[MemoryDB] Vacuum completed in ${duration}ms`);
            return { success: true, duration };
        } catch (error) {
            console.error('[MemoryDB] Vacuum failed:', error.message);
            throw error;
        }
    }

    /**
     * Get database statistics
     *
     * @returns {object} Database statistics
     */
    getStats() {
        if (!this.isInitialized) {
            throw new Error('Database not initialized');
        }

        const stats = {
            version: this.getSchemaVersion(),
            pageSize: this.db.pragma('page_size', { simple: true }),
            pageCount: this.db.pragma('page_count', { simple: true }),
            journalMode: this.db.pragma('journal_mode', { simple: true }),
            foreignKeys: this.db.pragma('foreign_keys', { simple: true }),
            synchronous: this.db.pragma('synchronous', { simple: true })
        };

        // Calculate database size
        stats.sizeBytes = stats.pageSize * stats.pageCount;
        stats.sizeMB = (stats.sizeBytes / (1024 * 1024)).toFixed(2);

        return stats;
    }

    /**
     * Execute a transaction
     *
     * @param {Function} fn - Transaction function
     * @returns {*} Result of transaction function
     */
    transaction(fn) {
        if (!this.isInitialized) {
            throw new Error('Database not initialized');
        }

        return this.db.transaction(fn)();
    }

    /**
     * Prepare a statement
     *
     * @param {string} sql - SQL statement
     * @returns {Statement} Prepared statement
     */
    prepare(sql) {
        if (!this.isInitialized) {
            throw new Error('Database not initialized');
        }

        return this.db.prepare(sql);
    }

    /**
     * Execute SQL directly
     *
     * @param {string} sql - SQL to execute
     * @returns {void}
     */
    exec(sql) {
        if (!this.isInitialized) {
            throw new Error('Database not initialized');
        }

        return this.db.exec(sql);
    }

    // ============================================
    // Session Management
    // ============================================

    /**
     * Create a new session
     *
     * @param {object} params - Session parameters
     * @returns {string} Session ID
     */
    createSession({ sessionId, userId = 'default', projectId = 'default', metadata = {} }) {
        const stmt = this.prepare(`
            INSERT INTO sessions (session_id, user_id, project_id, metadata_json)
            VALUES (?, ?, ?, ?)
        `);

        stmt.run(sessionId, userId, projectId, JSON.stringify(metadata));

        return sessionId;
    }

    /**
     * Get session by ID
     *
     * @param {string} sessionId - Session ID
     * @returns {object|null} Session data
     */
    getSession(sessionId) {
        const stmt = this.prepare(`
            SELECT * FROM sessions WHERE session_id = ?
        `);

        const session = stmt.get(sessionId);

        if (session && session.metadata_json) {
            session.metadata = JSON.parse(session.metadata_json);
        }

        return session;
    }

    /**
     * Update session
     *
     * @param {string} sessionId - Session ID
     * @param {object} updates - Fields to update
     */
    updateSession(sessionId, updates) {
        const fields = [];
        const values = [];

        if (updates.status) {
            fields.push('status = ?');
            values.push(updates.status);
        }

        if (updates.metadata) {
            fields.push('metadata_json = ?');
            values.push(JSON.stringify(updates.metadata));
        }

        fields.push('updated_at = CURRENT_TIMESTAMP');
        fields.push('last_active_at = CURRENT_TIMESTAMP');

        values.push(sessionId);

        const stmt = this.prepare(`
            UPDATE sessions SET ${fields.join(', ')} WHERE session_id = ?
        `);

        stmt.run(...values);
    }

    /**
     * Get active sessions for user
     *
     * @param {string} userId - User ID
     * @param {number} limit - Maximum number of sessions
     * @returns {Array} Active sessions
     */
    getActiveSessions(userId, limit = 10) {
        const stmt = this.prepare(`
            SELECT * FROM sessions
            WHERE user_id = ? AND status = 'active'
            ORDER BY last_active_at DESC
            LIMIT ?
        `);

        return stmt.all(userId, limit);
    }

    // ============================================
    // Message Management
    // ============================================

    /**
     * Add message to conversation
     *
     * @param {object} params - Message parameters
     * @returns {number} Message ID
     */
    addMessage({ conversationId, role, content, tokenCount = null, importanceScore = 0.5 }) {
        const stmt = this.prepare(`
            INSERT INTO messages (conversation_id, role, content, token_count, importance_score)
            VALUES (?, ?, ?, ?, ?)
        `);

        const result = stmt.run(conversationId, role, content, tokenCount, importanceScore);

        return result.lastInsertRowid;
    }

    /**
     * Get recent messages for session
     *
     * @param {string} sessionId - Session ID
     * @param {number} limit - Maximum number of messages
     * @returns {Array} Recent messages
     */
    getRecentMessages(sessionId, limit = 10) {
        const stmt = this.prepare(`
            SELECT m.*
            FROM messages m
            JOIN conversations c ON m.conversation_id = c.id
            WHERE c.session_id = ?
            ORDER BY m.created_at DESC
            LIMIT ?
        `);

        return stmt.all(sessionId, limit).reverse(); // Chronological order
    }

    /**
     * Search messages using FTS5
     *
     * @param {string} query - Search query
     * @param {number} limit - Maximum results
     * @returns {Array} Matching messages
     */
    searchMessages(query, limit = 10) {
        const stmt = this.prepare(`
            SELECT m.*, rank
            FROM messages m
            JOIN messages_fts ON m.id = messages_fts.rowid
            WHERE messages_fts MATCH ?
            ORDER BY rank
            LIMIT ?
        `);

        return stmt.all(query, limit);
    }

    // ============================================
    // Conversation Management
    // ============================================

    /**
     * Create conversation
     *
     * @param {object} params - Conversation parameters
     * @returns {number} Conversation ID
     */
    createConversation({ sessionId, conversationId, title = null, metadata = {} }) {
        const stmt = this.prepare(`
            INSERT INTO conversations (session_id, conversation_id, title, metadata_json)
            VALUES (?, ?, ?, ?)
        `);

        const result = stmt.run(sessionId, conversationId, title, JSON.stringify(metadata));

        return result.lastInsertRowid;
    }

    /**
     * Get conversation by ID
     *
     * @param {string} conversationId - Conversation ID
     * @returns {object|null} Conversation data
     */
    getConversation(conversationId) {
        const stmt = this.prepare(`
            SELECT * FROM conversations WHERE conversation_id = ?
        `);

        const conversation = stmt.get(conversationId);

        if (conversation && conversation.metadata_json) {
            conversation.metadata = JSON.parse(conversation.metadata_json);
        }

        return conversation;
    }
}

/**
 * Create default memory database instance
 *
 * @param {string} dbPath - Optional custom database path
 * @returns {MemoryDatabase}
 */
export function createMemoryDatabase(dbPath = null) {
    const defaultPath = join(
        process.cwd(),
        '.claude',
        'context',
        'memory',
        'sessions.db'
    );

    return new MemoryDatabase(dbPath || defaultPath);
}
