/**
 * Session Resume Service
 *
 * Enables resuming previous sessions with full or partial context transfer
 *
 * Features:
 * - Create session checkpoints (manual or automatic)
 * - Resume sessions with full context
 * - Resume sessions with partial context (recent only)
 * - Resume with agent-specific filtering
 *
 * Performance Targets:
 * - Checkpoint creation: <500ms
 * - Session resume: <1s
 * - Partial resume: <500ms
 *
 * Use Cases:
 * - User says "Continue where we left off yesterday"
 * - Multi-day projects with session boundaries
 * - Workflow resume after interruption
 *
 * @module session-resume-service
 */

import { randomUUID } from 'crypto';

/**
 * Checkpoint Types
 */
export const CheckpointType = {
  MANUAL: 'manual', // User explicitly created
  AUTOMATIC: 'automatic', // System auto-created
  WORKFLOW: 'workflow', // Created at workflow boundaries
  MILESTONE: 'milestone', // Created at project milestones
};

/**
 * Resume Modes
 */
export const ResumeMode = {
  FULL: 'full', // All memories and entities
  PARTIAL: 'partial', // Recent memories only
  AGENT_SPECIFIC: 'agent_specific', // Filtered by agent
};

/**
 * Session Resume Service
 *
 * Manages session checkpoints and resume functionality
 */
export class SessionResumeService {
  /**
   * @param {object} options - Configuration options
   */
  constructor(options = {}) {
    this.db = options.database || null;

    this.config = {
      autoCheckpointInterval: options.autoCheckpointInterval || 3600000, // 1 hour
      maxCheckpointsPerSession: options.maxCheckpointsPerSession || 10,
      checkpointRetention: options.checkpointRetention || 30, // days
      partialResumeLimit: options.partialResumeLimit || 50, // Recent messages
      ...options.config,
    };

    this.isInitialized = false;
  }

  /**
   * Initialize the resume service
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    // Initialize database
    if (!this.db?.isInitialized) {
      if (!this.db) {
        const { createMemoryDatabase } = await import('./database.mjs');
        this.db = createMemoryDatabase();
      }
      await this.db.initialize();
    }

    this.isInitialized = true;
    console.log('[Session Resume] Service initialized');
  }

  /**
   * Create a session checkpoint
   *
   * @param {object} params - Checkpoint parameters
   * @returns {Promise<object>} Checkpoint record
   */
  async createCheckpoint(params) {
    const startTime = Date.now();
    await this.ensureInitialized();

    const {
      sessionId,
      checkpointType = CheckpointType.MANUAL,
      agentsInvolved = [],
      memoryLimit = null,
    } = params;

    if (!sessionId) {
      throw new Error('sessionId is required');
    }

    try {
      // 1. Snapshot memories
      const memorySnapshot = await this.snapshotMemories(sessionId, memoryLimit);

      // 2. Snapshot entities
      const entitySnapshot = await this.snapshotEntities(sessionId);

      // 3. Create checkpoint ID
      const checkpointId = `checkpoint-${randomUUID()}`;

      // 4. Insert checkpoint record
      const stmt = this.db.prepare(`
        INSERT INTO session_resume_checkpoints (
          session_id, checkpoint_id, checkpoint_type,
          memory_snapshot, entity_snapshot, agents_involved
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        sessionId,
        checkpointId,
        checkpointType,
        JSON.stringify(memorySnapshot),
        JSON.stringify(entitySnapshot),
        JSON.stringify(agentsInvolved)
      );

      // 5. Cleanup old checkpoints if needed
      await this.cleanupOldCheckpoints(sessionId);

      const duration = Date.now() - startTime;

      console.log(
        `[Session Resume] Created checkpoint ${checkpointId} for session ${sessionId} in ${duration}ms`
      );

      return {
        id: result.lastInsertRowid,
        checkpointId,
        sessionId,
        checkpointType,
        memoryCount: memorySnapshot.length,
        entityCount: entitySnapshot.length,
        createdAt: new Date().toISOString(),
        duration,
      };
    } catch (error) {
      console.error('[Session Resume] Checkpoint creation failed:', error.message);
      throw error;
    }
  }

  /**
   * Snapshot memories for checkpoint
   *
   * @param {string} sessionId - Session ID
   * @param {number} limit - Maximum memories to snapshot
   * @returns {Promise<Array>} Memory snapshot
   */
  async snapshotMemories(sessionId, limit = null) {
    let sql = `
      SELECT m.*
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE c.session_id = ?
      ORDER BY m.created_at DESC
    `;

    const params = [sessionId];

    if (limit !== null) {
      sql += ' LIMIT ?';
      params.push(limit);
    }

    const stmt = this.db.prepare(sql);
    return stmt.all(...params);
  }

  /**
   * Snapshot entities for checkpoint
   *
   * @param {string} sessionId - Session ID
   * @returns {Promise<Array>} Entity snapshot
   */
  async snapshotEntities(sessionId) {
    // Get entities created or updated during this session
    // For now, get all active entities (future: session-scoped entities)
    const stmt = this.db.prepare(`
      SELECT * FROM entities
      WHERE is_active = 1
      ORDER BY last_seen DESC
      LIMIT 100
    `);

    const entities = stmt.all();

    return entities.map(entity => ({
      ...entity,
      metadata: entity.metadata ? JSON.parse(entity.metadata) : {},
    }));
  }

  /**
   * Resume session from checkpoint
   *
   * @param {object} params - Resume parameters
   * @returns {Promise<object>} Resume result
   */
  async resumeSession(params) {
    const startTime = Date.now();
    await this.ensureInitialized();

    const {
      sessionId = null,
      checkpointId = null,
      mode = ResumeMode.FULL,
      agentId = null,
    } = params;

    // Either sessionId or checkpointId must be provided
    if (!sessionId && !checkpointId) {
      throw new Error('Either sessionId or checkpointId is required');
    }

    try {
      // 1. Find checkpoint
      const checkpoint = await this.findCheckpoint(sessionId, checkpointId);

      if (!checkpoint) {
        throw new Error('Checkpoint not found');
      }

      // 2. Load context based on mode
      let context;

      switch (mode) {
        case ResumeMode.FULL:
          context = await this.loadFullContext(checkpoint);
          break;

        case ResumeMode.PARTIAL:
          context = await this.loadPartialContext(checkpoint);
          break;

        case ResumeMode.AGENT_SPECIFIC:
          if (!agentId) {
            throw new Error('agentId is required for agent-specific resume');
          }
          context = await this.loadAgentContext(checkpoint, agentId);
          break;

        default:
          throw new Error(`Unknown resume mode: ${mode}`);
      }

      // 3. Update checkpoint stats
      await this.updateCheckpointStats(checkpoint.checkpoint_id);

      const duration = Date.now() - startTime;

      console.log(
        `[Session Resume] Resumed session ${checkpoint.session_id} (mode: ${mode}) in ${duration}ms`
      );

      return {
        checkpointId: checkpoint.checkpoint_id,
        sessionId: checkpoint.session_id,
        mode,
        context,
        metadata: {
          checkpointType: checkpoint.checkpoint_type,
          checkpointCreated: checkpoint.created_at,
          memoriesResumed: context.memories.length,
          entitiesResumed: context.entities.length,
          agentsInvolved: checkpoint.agents_involved ? JSON.parse(checkpoint.agents_involved) : [],
          duration,
        },
      };
    } catch (error) {
      console.error('[Session Resume] Resume failed:', error.message);
      throw error;
    }
  }

  /**
   * Find checkpoint by session or checkpoint ID
   *
   * @param {string} sessionId - Session ID
   * @param {string} checkpointId - Checkpoint ID
   * @returns {Promise<object|null>} Checkpoint record
   */
  async findCheckpoint(sessionId, checkpointId) {
    if (checkpointId) {
      const stmt = this.db.prepare(`
        SELECT * FROM session_resume_checkpoints
        WHERE checkpoint_id = ?
      `);

      return stmt.get(checkpointId);
    }

    // Find most recent checkpoint for session
    const stmt = this.db.prepare(`
      SELECT * FROM session_resume_checkpoints
      WHERE session_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `);

    return stmt.get(sessionId);
  }

  /**
   * Load full context from checkpoint
   *
   * @param {object} checkpoint - Checkpoint record
   * @returns {Promise<object>} Full context
   */
  async loadFullContext(checkpoint) {
    const memories = JSON.parse(checkpoint.memory_snapshot);
    const entities = JSON.parse(checkpoint.entity_snapshot);

    return {
      memories,
      entities,
      formatted: this.formatResumeContext(memories, entities, ResumeMode.FULL),
    };
  }

  /**
   * Load partial context (recent memories only)
   *
   * @param {object} checkpoint - Checkpoint record
   * @returns {Promise<object>} Partial context
   */
  async loadPartialContext(checkpoint) {
    const allMemories = JSON.parse(checkpoint.memory_snapshot);
    const memories = allMemories.slice(0, this.config.partialResumeLimit);

    const entities = JSON.parse(checkpoint.entity_snapshot);

    return {
      memories,
      entities: entities.slice(0, 20), // Limit entities too
      formatted: this.formatResumeContext(memories, entities, ResumeMode.PARTIAL),
    };
  }

  /**
   * Load agent-specific context
   *
   * @param {object} checkpoint - Checkpoint record
   * @param {string} agentId - Agent ID to filter by
   * @returns {Promise<object>} Agent-specific context
   */
  async loadAgentContext(checkpoint, agentId) {
    const allMemories = JSON.parse(checkpoint.memory_snapshot);

    // Filter memories by agent
    const memories = allMemories.filter(m => m.source_agent_id === agentId);

    const entities = JSON.parse(checkpoint.entity_snapshot);

    return {
      memories,
      entities,
      formatted: this.formatResumeContext(memories, entities, ResumeMode.AGENT_SPECIFIC, agentId),
    };
  }

  /**
   * Format resume context for injection
   *
   * @param {Array} memories - Memories to include
   * @param {Array} entities - Entities to include
   * @param {string} mode - Resume mode
   * @param {string} agentId - Agent ID (for agent-specific mode)
   * @returns {string} Formatted context
   */
  formatResumeContext(memories, entities, mode, agentId = null) {
    const memoryParts = memories
      .slice()
      .reverse() // Chronological order
      .map(memory => `**${memory.role}**: ${memory.content}`);

    const entityParts = entities.map(entity => `- **${entity.value}** (${entity.type})`);

    const modeLabel = mode === ResumeMode.AGENT_SPECIFIC ? `${mode} (${agentId})` : mode;

    return `
## Session Resume Context (Mode: ${modeLabel})

${memoryParts.length > 0 ? '### Previous Conversation\n\n' + memoryParts.join('\n\n') : ''}

${entityParts.length > 0 ? '### Known Entities\n\n' + entityParts.join('\n') : ''}
`.trim();
  }

  /**
   * Update checkpoint stats after resume
   *
   * @param {string} checkpointId - Checkpoint ID
   * @returns {Promise<void>}
   */
  async updateCheckpointStats(checkpointId) {
    const stmt = this.db.prepare(`
      UPDATE session_resume_checkpoints
      SET resume_count = resume_count + 1,
          last_resumed_at = CURRENT_TIMESTAMP
      WHERE checkpoint_id = ?
    `);

    stmt.run(checkpointId);
  }

  /**
   * Get available resume points for session
   *
   * @param {string} sessionId - Session ID
   * @returns {Promise<Array>} Available checkpoints
   */
  async getResumePoints(sessionId) {
    await this.ensureInitialized();

    const stmt = this.db.prepare(`
      SELECT * FROM session_resume_checkpoints
      WHERE session_id = ?
      AND is_archived = FALSE
      ORDER BY created_at DESC
    `);

    const checkpoints = stmt.all(sessionId);

    return checkpoints.map(cp => ({
      checkpointId: cp.checkpoint_id,
      checkpointType: cp.checkpoint_type,
      createdAt: cp.created_at,
      resumeCount: cp.resume_count,
      lastResumedAt: cp.last_resumed_at,
      agentsInvolved: cp.agents_involved ? JSON.parse(cp.agents_involved) : [],
    }));
  }

  /**
   * Cleanup old checkpoints for a session
   *
   * @param {string} sessionId - Session ID
   * @returns {Promise<number>} Number of checkpoints removed
   */
  async cleanupOldCheckpoints(sessionId) {
    // Keep only the N most recent checkpoints
    const stmt = this.db.prepare(`
      UPDATE session_resume_checkpoints
      SET is_archived = TRUE
      WHERE session_id = ?
      AND id NOT IN (
        SELECT id FROM session_resume_checkpoints
        WHERE session_id = ?
        AND is_archived = FALSE
        ORDER BY created_at DESC
        LIMIT ?
      )
    `);

    const result = stmt.run(sessionId, sessionId, this.config.maxCheckpointsPerSession);

    if (result.changes > 0) {
      console.log(`[Session Resume] Archived ${result.changes} old checkpoints`);
    }

    return result.changes;
  }

  /**
   * Archive expired checkpoints
   *
   * @returns {Promise<number>} Number of checkpoints archived
   */
  async archiveExpiredCheckpoints() {
    await this.ensureInitialized();

    const expiryDate = new Date(
      Date.now() - this.config.checkpointRetention * 24 * 60 * 60 * 1000
    ).toISOString();

    const stmt = this.db.prepare(`
      UPDATE session_resume_checkpoints
      SET is_archived = TRUE
      WHERE created_at < ?
      AND is_archived = FALSE
    `);

    const result = stmt.run(expiryDate);

    console.log(`[Session Resume] Archived ${result.changes} expired checkpoints`);

    return result.changes;
  }

  /**
   * Ensure initialized
   *
   * @returns {Promise<void>}
   */
  async ensureInitialized() {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }
}

/**
 * Create session resume service
 *
 * @param {object} options - Configuration options
 * @returns {SessionResumeService}
 */
export function createSessionResumeService(options = {}) {
  return new SessionResumeService(options);
}
