/**
 * Hierarchical Memory Manager
 *
 * Implements 3-tier memory system (project > agent > conversation)
 * with automatic promotion based on reference patterns
 *
 * Tiers:
 * - **Conversation**: Ephemeral, conversation-scoped memories (TTL: 24 hours)
 * - **Agent**: Agent-specific patterns and learnings (TTL: 7 days)
 * - **Project**: Cross-agent, persistent knowledge (no TTL)
 *
 * Promotion Rules:
 * - Conversation → Agent: 3+ references across different conversations
 * - Agent → Project: 5+ references from different agents OR confirmed pattern
 *
 * Performance Targets:
 * - Tier assignment: <5ms
 * - Promotion check: <50ms
 * - Cross-tier search: <200ms
 *
 * @module hierarchical-memory
 */

import { createMemoryDatabase } from './database.mjs';

/**
 * Memory Tier Enumeration
 */
export const MemoryTier = {
  CONVERSATION: 'conversation',
  AGENT: 'agent',
  PROJECT: 'project',
};

/**
 * SECURITY: Allowlist of valid ORDER BY columns
 *
 * SEC-001 Mitigation: Prevents SQL injection via orderBy parameter
 * by restricting to known-safe column names only.
 *
 * Defense Layers:
 * 1. Allowlist validation (primary)
 * 2. Regex pattern validation (secondary)
 * 3. Error on invalid input (fail-safe)
 */
const ALLOWED_ORDER_BY_COLUMNS = new Set([
  'id',
  'created_at',
  'timestamp',
  'importance_score',
  'reference_count',
  'tier',
  'last_referenced_at',
  'tier_promoted_at',
  'promotion_count',
  'agent_id',
  'conversation_id',
]);

/**
 * SECURITY: Valid ORDER BY directions
 */
const ALLOWED_ORDER_DIRECTIONS = new Set(['ASC', 'DESC', 'asc', 'desc', '']);

/**
 * Validate and sanitize ORDER BY clause
 *
 * @param {string} orderBy - The ORDER BY clause to validate
 * @returns {string} - Sanitized ORDER BY clause
 * @throws {Error} - If orderBy contains invalid values
 *
 * @security SEC-001 - SQL Injection Prevention
 */
function validateOrderBy(orderBy) {
  if (!orderBy || typeof orderBy !== 'string') {
    return 'created_at DESC'; // Safe default
  }

  // Trim and normalize
  const normalized = orderBy.trim();

  // Empty string gets default
  if (normalized === '') {
    return 'created_at DESC';
  }

  // SECURITY: Block obvious injection patterns (defense layer 2)
  const dangerousPatterns = [
    /;/, // Statement terminator
    /--/, // SQL comment
    /\/\*/, // Block comment start
    /\*\//, // Block comment end
    /\bDROP\b/i, // DROP keyword
    /\bDELETE\b/i, // DELETE keyword
    /\bUPDATE\b/i, // UPDATE keyword
    /\bINSERT\b/i, // INSERT keyword
    /\bEXEC\b/i, // EXEC keyword
    /\bUNION\b/i, // UNION keyword
    /\bOR\b/i, // OR keyword (used in boolean injection)
    /\bAND\b/i, // AND keyword (used in boolean injection)
    /'/, // Single quote
    /"/, // Double quote
    /\\/, // Backslash
    /\x00/, // Null byte
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(normalized)) {
      console.error(`[SECURITY] SQL injection attempt blocked in orderBy: ${normalized}`);
      throw new Error('Invalid orderBy: contains forbidden characters or keywords');
    }
  }

  // Parse column and direction
  const parts = normalized.split(/\s+/);
  const column = parts[0];
  const direction = parts[1] || 'DESC';

  // SECURITY: Validate column against allowlist (defense layer 1 - primary)
  if (!ALLOWED_ORDER_BY_COLUMNS.has(column)) {
    console.error(`[SECURITY] Invalid orderBy column rejected: ${column}`);
    throw new Error(
      `Invalid orderBy column: ${column}. Allowed: ${[...ALLOWED_ORDER_BY_COLUMNS].join(', ')}`
    );
  }

  // SECURITY: Validate direction
  if (!ALLOWED_ORDER_DIRECTIONS.has(direction)) {
    console.error(`[SECURITY] Invalid orderBy direction rejected: ${direction}`);
    throw new Error(`Invalid orderBy direction: ${direction}. Allowed: ASC, DESC`);
  }

  // Return sanitized value
  return `${column} ${direction.toUpperCase()}`;
}

/**
 * Hierarchical Memory Manager
 */
export class HierarchicalMemoryManager {
  /**
   * @param {object} database - MemoryDatabase instance
   * @param {object} options - Configuration options
   */
  constructor(database = null, options = {}) {
    this.db = database;
    this.options = {
      // Promotion thresholds
      conversationToAgent: options.conversationToAgent || 3, // 3+ refs → agent tier
      agentToProject: options.agentToProject || 5, // 5+ refs → project tier

      // Time-to-live (hours)
      conversationTTL: options.conversationTTL || 24, // 24 hours
      agentTTL: options.agentTTL || 168, // 7 days (168 hours)
      projectTTL: options.projectTTL || null, // No expiration

      // Decay factors (for importance scoring)
      decayFactor: options.decayFactor || 0.95, // 5% decay per day

      ...options,
    };

    this.isInitialized = false;
  }

  /**
   * Initialize hierarchical memory system
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    const startTime = Date.now();

    try {
      // Initialize database connection
      if (!this.db) {
        this.db = createMemoryDatabase();
      }
      if (!this.db.isInitialized) {
        await this.db.initialize();
      }

      // Run hierarchical memory migration (add tier columns)
      await this.runHierarchicalMigration();

      this.isInitialized = true;

      const duration = Date.now() - startTime;
      console.log(`[HierarchicalMemory] Initialized in ${duration}ms`);

      return { success: true, duration };
    } catch (error) {
      console.error('[HierarchicalMemory] Initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Run migration to add hierarchical memory columns
   *
   * @returns {Promise<void>}
   */
  async runHierarchicalMigration() {
    try {
      // Add tier and promotion tracking columns to messages table
      const alterStatements = [
        `ALTER TABLE messages ADD COLUMN tier TEXT DEFAULT 'conversation' CHECK(tier IN ('conversation', 'agent', 'project'))`,
        `ALTER TABLE messages ADD COLUMN promotion_count INTEGER DEFAULT 0`,
        `ALTER TABLE messages ADD COLUMN tier_promoted_at DATETIME`,
        `ALTER TABLE messages ADD COLUMN agent_id TEXT`, // Track which agent created/referenced this
        `ALTER TABLE messages ADD COLUMN reference_count INTEGER DEFAULT 0`, // Track cross-context references
        `ALTER TABLE messages ADD COLUMN last_referenced_at DATETIME DEFAULT CURRENT_TIMESTAMP`,
      ];

      for (const sql of alterStatements) {
        try {
          this.db.exec(sql);
        } catch (error) {
          // Column may already exist - ignore
          if (!error.message.includes('duplicate column')) {
            throw error;
          }
        }
      }

      // Create index for tier-based queries
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_messages_tier ON messages(tier);
      `);

      // Create index for promotion queries
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_messages_promotion ON messages(reference_count, tier);
      `);

      // Create index for agent-scoped queries
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_messages_agent ON messages(agent_id, tier);
      `);

      console.log('[HierarchicalMemory] Migration complete - tier columns added');
    } catch (error) {
      console.error('[HierarchicalMemory] Migration failed:', error.message);
      throw error;
    }
  }

  /**
   * Store memory in appropriate tier
   *
   * @param {object} params - Memory parameters
   * @returns {Promise<object>} Storage result
   */
  async storeMemory({
    conversationId,
    agentId = null,
    content,
    role = 'assistant',
    tier = MemoryTier.CONVERSATION,
    importanceScore = 0.5,
    tokenCount = null,
  }) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();

    try {
      // Validate tier
      if (!Object.values(MemoryTier).includes(tier)) {
        throw new Error(`Invalid tier: ${tier}`);
      }

      // Store message with tier metadata
      const stmt = this.db.prepare(`
        INSERT INTO messages (
          conversation_id, role, content, token_count, importance_score,
          tier, agent_id, reference_count, last_referenced_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);

      const result = stmt.run(
        conversationId,
        role,
        content,
        tokenCount,
        importanceScore,
        tier,
        agentId,
        0 // Initial reference count
      );

      const messageId = result.lastInsertRowid;
      const duration = Date.now() - startTime;

      return {
        success: true,
        messageId,
        tier,
        duration,
      };
    } catch (error) {
      console.error('[HierarchicalMemory] Store memory failed:', error.message);
      throw error;
    }
  }

  /**
   * Reference a memory (increments reference count)
   *
   * @param {number} messageId - Message ID
   * @param {string} agentId - Agent making the reference
   * @returns {Promise<object>} Reference result with promotion decision
   */
  async referenceMemory(messageId, agentId = null) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();

    try {
      // Increment reference count and update last_referenced_at
      // Use datetime('now') instead of CURRENT_TIMESTAMP for higher precision
      const updateStmt = this.db.prepare(`
        UPDATE messages
        SET reference_count = reference_count + 1,
            last_referenced_at = datetime('now', 'localtime')
        WHERE id = ?
      `);

      updateStmt.run(messageId);

      // Get updated memory state
      const memory = this.db.prepare(`SELECT * FROM messages WHERE id = ?`).get(messageId);

      if (!memory) {
        throw new Error(`Memory not found: ${messageId}`);
      }

      // Check for promotion eligibility
      const promotion = await this.checkPromotion(memory, agentId);

      const duration = Date.now() - startTime;

      return {
        success: true,
        messageId,
        referenceCount: memory.reference_count, // Already updated in DB
        promotion,
        duration,
      };
    } catch (error) {
      console.error('[HierarchicalMemory] Reference memory failed:', error.message);
      throw error;
    }
  }

  /**
   * Check if memory should be promoted to higher tier
   *
   * @param {object} memory - Memory object
   * @param {string} agentId - Agent triggering promotion check
   * @returns {Promise<object>} Promotion decision
   */
  async checkPromotion(memory, agentId = null) {
    try {
      const { id, tier, reference_count, promotion_count } = memory;

      // Conversation → Agent promotion
      if (tier === MemoryTier.CONVERSATION && reference_count >= this.options.conversationToAgent) {
        await this.promoteMemory(id, MemoryTier.AGENT);
        return {
          promoted: true,
          fromTier: MemoryTier.CONVERSATION,
          toTier: MemoryTier.AGENT,
          reason: `${reference_count} references across conversations`,
        };
      }

      // Agent → Project promotion
      if (tier === MemoryTier.AGENT && reference_count >= this.options.agentToProject) {
        await this.promoteMemory(id, MemoryTier.PROJECT);
        return {
          promoted: true,
          fromTier: MemoryTier.AGENT,
          toTier: MemoryTier.PROJECT,
          reason: `${reference_count} references from multiple agents`,
        };
      }

      return {
        promoted: false,
        currentTier: tier,
        referenceCount: reference_count,
        promotionCount: promotion_count,
      };
    } catch (error) {
      console.error('[HierarchicalMemory] Promotion check failed:', error.message);
      return { promoted: false, error: error.message };
    }
  }

  /**
   * Promote memory to higher tier
   *
   * @param {number} messageId - Message ID
   * @param {string} newTier - Target tier
   * @returns {Promise<void>}
   */
  async promoteMemory(messageId, newTier) {
    const startTime = Date.now();

    try {
      const stmt = this.db.prepare(`
        UPDATE messages
        SET tier = ?,
            promotion_count = promotion_count + 1,
            tier_promoted_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      stmt.run(newTier, messageId);

      const duration = Date.now() - startTime;

      console.log(
        `[HierarchicalMemory] Promoted message ${messageId} to ${newTier} tier (${duration}ms)`
      );
    } catch (error) {
      console.error('[HierarchicalMemory] Promotion failed:', error.message);
      throw error;
    }
  }

  /**
   * Search memories across tiers
   *
   * @param {string} query - Search query
   * @param {object} options - Search options
   * @returns {Promise<Array>} Matching memories
   */
  async searchAcrossTiers(query, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const {
      tiers = [MemoryTier.PROJECT, MemoryTier.AGENT, MemoryTier.CONVERSATION],
      agentId = null,
      conversationId = null,
      limit = 10,
      minImportance = 0.3,
    } = options;

    const startTime = Date.now();

    try {
      // Build tier filter
      const tierPlaceholders = tiers.map(() => '?').join(',');

      // Build query with tier prioritization
      let sql = `
        SELECT
          m.*,
          CASE
            WHEN m.tier = 'project' THEN 3
            WHEN m.tier = 'agent' THEN 2
            WHEN m.tier = 'conversation' THEN 1
          END as tier_priority,
          rank
        FROM messages m
        JOIN messages_fts ON m.id = messages_fts.rowid
        WHERE messages_fts MATCH ?
          AND m.tier IN (${tierPlaceholders})
          AND m.importance_score >= ?
      `;

      const params = [query, ...tiers, minImportance];

      // Add agent filter if specified
      if (agentId) {
        sql += ` AND (m.agent_id = ? OR m.tier = 'project')`;
        params.push(agentId);
      }

      // Add conversation filter if specified
      if (conversationId) {
        sql += ` AND (m.conversation_id = ? OR m.tier IN ('agent', 'project'))`;
        params.push(conversationId);
      }

      // Order by tier priority (project > agent > conversation), then relevance
      sql += `
        ORDER BY tier_priority DESC, rank ASC, m.importance_score DESC
        LIMIT ?
      `;
      params.push(limit);

      const results = this.db.prepare(sql).all(...params);

      const duration = Date.now() - startTime;

      return {
        results,
        duration,
        query,
        tiersSearched: tiers,
      };
    } catch (error) {
      console.error('[HierarchicalMemory] Search across tiers failed:', error.message);
      return {
        results: [],
        duration: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  /**
   * Get memories by tier
   *
   * @param {string} tier - Target tier
   * @param {object} options - Query options
   * @returns {Promise<Array>} Memories in tier
   *
   * @security SEC-001 - orderBy parameter is validated against allowlist
   */
  async getMemoriesByTier(tier, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const {
      agentId = null,
      conversationId = null,
      limit = 50,
      orderBy = 'created_at DESC',
    } = options;

    try {
      // SECURITY: Validate orderBy to prevent SQL injection (SEC-001)
      const sanitizedOrderBy = validateOrderBy(orderBy);

      let sql = `
        SELECT * FROM messages
        WHERE tier = ?
      `;

      const params = [tier];

      if (agentId && tier === MemoryTier.AGENT) {
        sql += ` AND agent_id = ?`;
        params.push(agentId);
      }

      if (conversationId) {
        sql += ` AND conversation_id = ?`;
        params.push(conversationId);
      }

      // SECURITY: Use sanitized orderBy value
      sql += ` ORDER BY ${sanitizedOrderBy} LIMIT ?`;
      params.push(limit);

      const memories = this.db.prepare(sql).all(...params);

      return memories;
    } catch (error) {
      console.error('[HierarchicalMemory] Get memories by tier failed:', error.message);
      // SECURITY: Re-throw security errors, return empty for others
      if (error.message.includes('Invalid orderBy')) {
        throw error;
      }
      return [];
    }
  }

  /**
   * Expire old memories based on TTL
   *
   * @returns {Promise<object>} Cleanup result
   */
  async expireOldMemories() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();

    try {
      const now = Date.now();
      const conversationCutoff = new Date(now - this.options.conversationTTL * 60 * 60 * 1000);
      const agentCutoff = new Date(now - this.options.agentTTL * 60 * 60 * 1000);

      // Delete expired conversation-tier memories
      const conversationStmt = this.db.prepare(`
        DELETE FROM messages
        WHERE tier = 'conversation'
          AND created_at < ?
      `);
      const conversationResult = conversationStmt.run(conversationCutoff.toISOString());

      // Delete expired agent-tier memories
      const agentStmt = this.db.prepare(`
        DELETE FROM messages
        WHERE tier = 'agent'
          AND created_at < ?
      `);
      const agentResult = agentStmt.run(agentCutoff.toISOString());

      const duration = Date.now() - startTime;

      const result = {
        success: true,
        conversationExpired: conversationResult.changes,
        agentExpired: agentResult.changes,
        totalExpired: conversationResult.changes + agentResult.changes,
        duration,
      };

      console.log(
        `[HierarchicalMemory] Expired ${result.totalExpired} memories (${result.conversationExpired} conversation, ${result.agentExpired} agent) in ${duration}ms`
      );

      return result;
    } catch (error) {
      console.error('[HierarchicalMemory] Expiration failed:', error.message);
      throw error;
    }
  }

  /**
   * Get tier statistics
   *
   * @returns {Promise<object>} Tier statistics
   */
  async getTierStats() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const stats = this.db
        .prepare(
          `
        SELECT
          tier,
          COUNT(*) as count,
          AVG(importance_score) as avg_importance,
          AVG(reference_count) as avg_references,
          MAX(reference_count) as max_references,
          SUM(CASE WHEN promotion_count > 0 THEN 1 ELSE 0 END) as promoted_count
        FROM messages
        GROUP BY tier
      `
        )
        .all();

      // Convert to object keyed by tier
      const tierStats = {};
      for (const stat of stats) {
        tierStats[stat.tier] = {
          count: stat.count,
          avgImportance: parseFloat(stat.avg_importance.toFixed(3)),
          avgReferences: parseFloat(stat.avg_references.toFixed(1)),
          maxReferences: stat.max_references,
          promotedCount: stat.promoted_count,
        };
      }

      return tierStats;
    } catch (error) {
      console.error('[HierarchicalMemory] Get tier stats failed:', error.message);
      return {};
    }
  }

  /**
   * Get promotion candidates (memories close to promotion threshold)
   *
   * @param {string} tier - Current tier
   * @returns {Promise<Array>} Promotion candidates
   */
  async getPromotionCandidates(tier) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const threshold =
        tier === MemoryTier.CONVERSATION
          ? this.options.conversationToAgent
          : this.options.agentToProject;

      // Get memories within 1 reference of promotion
      const candidates = this.db
        .prepare(
          `
        SELECT *
        FROM messages
        WHERE tier = ?
          AND reference_count >= ?
        ORDER BY reference_count DESC, importance_score DESC
        LIMIT 20
      `
        )
        .all(tier, threshold - 1);

      return candidates;
    } catch (error) {
      console.error('[HierarchicalMemory] Get promotion candidates failed:', error.message);
      return [];
    }
  }

  /**
   * Close and cleanup
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.isInitialized = false;
      console.log('[HierarchicalMemory] Closed');
    }
  }
}

/**
 * Create default hierarchical memory manager
 *
 * @param {object} options - Configuration options
 * @returns {HierarchicalMemoryManager}
 */
export function createHierarchicalMemory(options = {}) {
  return new HierarchicalMemoryManager(null, options);
}
