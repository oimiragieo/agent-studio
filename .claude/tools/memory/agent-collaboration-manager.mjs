/**
 * Agent Collaboration Manager
 *
 * Tracks agent-to-agent collaborations and detects circular handoffs
 *
 * Features:
 * - Register collaborations between agents
 * - Track collaboration history
 * - Detect circular handoff patterns
 * - Collaboration analytics
 *
 * Performance Targets:
 * - Registration: <10ms
 * - History retrieval: <50ms
 * - Circular detection: <100ms
 *
 * @module agent-collaboration-manager
 */

import { randomUUID } from 'crypto';

/**
 * Handoff Types
 */
export const HandoffType = {
  SEQUENTIAL: 'sequential', // Agent A → Agent B (linear chain)
  PARALLEL: 'parallel', // Agent A → [Agent B, Agent C] (fan-out)
  FORK: 'fork', // Agent A splits work to B and C
  JOIN: 'join', // Agents B and C merge results to D
};

/**
 * Collaboration Status
 */
export const CollaborationStatus = {
  PENDING: 'pending', // Handoff created but not yet applied
  APPLIED: 'applied', // Handoff successfully applied
  REJECTED: 'rejected', // Handoff rejected (e.g., circular detected)
};

/**
 * Agent Collaboration Manager
 *
 * Manages agent-to-agent memory handoffs and collaboration tracking
 */
export class AgentCollaborationManager {
  /**
   * @param {object} database - MemoryDatabase instance
   */
  constructor(database) {
    this.db = database;
    this.isInitialized = false;

    // Configuration
    this.config = {
      maxChainLength: 10, // Maximum collaboration chain before warning
      circularDetectionDepth: 5, // How deep to search for cycles
      handoffTTL: 3600000, // Handoff expiration (1 hour in ms)
    };
  }

  /**
   * Initialize the collaboration manager
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    if (!this.db.isInitialized) {
      await this.db.initialize();
    }

    this.isInitialized = true;
    console.log('[Agent Collaboration] Manager initialized');
  }

  /**
   * Register a collaboration between two agents
   *
   * @param {object} params - Collaboration parameters
   * @returns {Promise<object>} Collaboration record
   */
  async registerCollaboration(params) {
    await this.ensureInitialized();

    const {
      sessionId,
      workflowId = null,
      sourceAgentId,
      targetAgentId,
      handoffContext = {},
      handoffType = HandoffType.SEQUENTIAL,
    } = params;

    // Validate parameters
    if (!sessionId || !sourceAgentId || !targetAgentId) {
      throw new Error('sessionId, sourceAgentId, and targetAgentId are required');
    }

    // Detect circular handoffs
    const circularDetection = await this.detectCircularHandoff(
      sessionId,
      sourceAgentId,
      targetAgentId
    );

    if (circularDetection.isCircular) {
      console.warn('[Agent Collaboration] Circular handoff detected:', circularDetection);

      // Allow but log warning
      handoffContext.circularWarning = circularDetection;
    }

    // Create handoff ID
    const handoffId = `handoff-${randomUUID()}`;

    // Insert collaboration record
    const stmt = this.db.prepare(`
      INSERT INTO agent_collaborations (
        session_id, workflow_id, source_agent_id, target_agent_id,
        handoff_id, handoff_context, handoff_type, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      sessionId,
      workflowId,
      sourceAgentId,
      targetAgentId,
      handoffId,
      JSON.stringify(handoffContext),
      handoffType,
      CollaborationStatus.PENDING
    );

    const collaboration = {
      id: result.lastInsertRowid,
      sessionId,
      workflowId,
      sourceAgentId,
      targetAgentId,
      handoffId,
      handoffContext,
      handoffType,
      status: CollaborationStatus.PENDING,
      createdAt: new Date().toISOString(),
      circularWarning: circularDetection.isCircular ? circularDetection : null,
    };

    console.log(
      `[Agent Collaboration] Registered: ${sourceAgentId} → ${targetAgentId} (${handoffId})`
    );

    return collaboration;
  }

  /**
   * Mark collaboration as applied
   *
   * @param {string} handoffId - Handoff ID
   * @returns {Promise<void>}
   */
  async markHandoffApplied(handoffId) {
    await this.ensureInitialized();

    const stmt = this.db.prepare(`
      UPDATE agent_collaborations
      SET status = ?, applied_at = CURRENT_TIMESTAMP
      WHERE handoff_id = ?
    `);

    stmt.run(CollaborationStatus.APPLIED, handoffId);

    console.log(`[Agent Collaboration] Handoff applied: ${handoffId}`);
  }

  /**
   * Get collaboration history for a session
   *
   * @param {string} sessionId - Session ID
   * @param {object} options - Query options
   * @returns {Promise<Array>} Collaboration history
   */
  async getCollaborationHistory(sessionId, options = {}) {
    await this.ensureInitialized();

    const { limit = 50, agentId = null, workflowId = null } = options;

    let sql = `
      SELECT * FROM agent_collaborations
      WHERE session_id = ?
    `;

    const params = [sessionId];

    if (agentId) {
      sql += ' AND (source_agent_id = ? OR target_agent_id = ?)';
      params.push(agentId, agentId);
    }

    if (workflowId) {
      sql += ' AND workflow_id = ?';
      params.push(workflowId);
    }

    sql += ' ORDER BY id DESC LIMIT ?';  // Use id DESC for reliable ordering (created_at has 1-second precision)
    params.push(limit);

    const stmt = this.db.prepare(sql);
    const collaborations = stmt.all(...params);

    // Parse handoff_context JSON
    return collaborations.map(collab => ({
      ...collab,
      handoffContext: collab.handoff_context ? JSON.parse(collab.handoff_context) : {},
    }));
  }

  /**
   * Detect circular handoff patterns
   *
   * Checks if adding a handoff from sourceAgent → targetAgent
   * would create a circular dependency
   *
   * @param {string} sessionId - Session ID
   * @param {string} sourceAgentId - Source agent ID
   * @param {string} targetAgentId - Target agent ID
   * @returns {Promise<object>} Detection result
   */
  async detectCircularHandoff(sessionId, sourceAgentId, targetAgentId) {
    await this.ensureInitialized();

    // Build collaboration graph
    const graph = await this.buildCollaborationGraph(sessionId);

    // Check if targetAgent → sourceAgent path exists
    // If yes, adding sourceAgent → targetAgent creates a cycle
    const pathExists = this.findPath(graph, targetAgentId, sourceAgentId, this.config.circularDetectionDepth);

    if (pathExists) {
      return {
        isCircular: true,
        cycle: [...pathExists, sourceAgentId],
        message: `Circular collaboration detected: ${pathExists.join(' → ')} → ${sourceAgentId}`,
      };
    }

    // Check chain length
    const chainLength = this.getChainLength(graph, sourceAgentId);

    if (chainLength >= this.config.maxChainLength) {
      return {
        isCircular: false,
        longChain: true,
        chainLength,
        message: `Long collaboration chain detected: ${chainLength} agents`,
      };
    }

    return {
      isCircular: false,
      chainLength,
    };
  }

  /**
   * Build collaboration graph for a session
   *
   * @param {string} sessionId - Session ID
   * @returns {Promise<Map>} Adjacency list graph
   */
  async buildCollaborationGraph(sessionId) {
    const stmt = this.db.prepare(`
      SELECT source_agent_id, target_agent_id
      FROM agent_collaborations
      WHERE session_id = ?
      AND status != ?
      ORDER BY created_at
    `);

    const edges = stmt.all(sessionId, CollaborationStatus.REJECTED);

    // Build adjacency list
    const graph = new Map();

    for (const edge of edges) {
      if (!graph.has(edge.source_agent_id)) {
        graph.set(edge.source_agent_id, []);
      }
      graph.get(edge.source_agent_id).push(edge.target_agent_id);
    }

    return graph;
  }

  /**
   * Find path between two agents using BFS
   *
   * @param {Map} graph - Collaboration graph
   * @param {string} start - Start agent
   * @param {string} end - End agent
   * @param {number} maxDepth - Maximum search depth
   * @returns {Array|null} Path if exists, null otherwise
   */
  findPath(graph, start, end, maxDepth) {
    const queue = [[start]];
    const visited = new Set([start]);

    while (queue.length > 0) {
      const path = queue.shift();
      const current = path[path.length - 1];

      // Check depth limit
      if (path.length > maxDepth) {
        continue;
      }

      // Found target
      if (current === end) {
        return path;
      }

      // Explore neighbors
      const neighbors = graph.get(current) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push([...path, neighbor]);
        }
      }
    }

    return null;
  }

  /**
   * Get longest chain length from an agent
   *
   * @param {Map} graph - Collaboration graph
   * @param {string} agentId - Agent ID
   * @returns {number} Chain length
   */
  getChainLength(graph, agentId) {
    const visited = new Set();

    const dfs = (agent, depth) => {
      if (visited.has(agent)) {
        return depth;
      }

      visited.add(agent);

      const neighbors = graph.get(agent) || [];
      if (neighbors.length === 0) {
        return depth;
      }

      let maxDepth = depth;
      for (const neighbor of neighbors) {
        maxDepth = Math.max(maxDepth, dfs(neighbor, depth + 1));
      }

      return maxDepth;
    };

    return dfs(agentId, 1);
  }

  /**
   * Get collaboration statistics
   *
   * @param {string} sessionId - Session ID
   * @returns {Promise<object>} Statistics
   */
  async getCollaborationStats(sessionId) {
    await this.ensureInitialized();

    const stmt = this.db.prepare(`
      SELECT
        COUNT(*) as total_collaborations,
        COUNT(DISTINCT source_agent_id) as unique_source_agents,
        COUNT(DISTINCT target_agent_id) as unique_target_agents,
        COUNT(CASE WHEN status = ? THEN 1 END) as pending_handoffs,
        COUNT(CASE WHEN status = ? THEN 1 END) as applied_handoffs,
        COUNT(CASE WHEN status = ? THEN 1 END) as rejected_handoffs
      FROM agent_collaborations
      WHERE session_id = ?
    `);

    const stats = stmt.get(
      CollaborationStatus.PENDING,
      CollaborationStatus.APPLIED,
      CollaborationStatus.REJECTED,
      sessionId
    );

    // Get agent interaction matrix
    const matrixStmt = this.db.prepare(`
      SELECT source_agent_id, target_agent_id, COUNT(*) as handoff_count
      FROM agent_collaborations
      WHERE session_id = ?
      GROUP BY source_agent_id, target_agent_id
      ORDER BY handoff_count DESC
    `);

    const matrix = matrixStmt.all(sessionId);

    return {
      ...stats,
      interactionMatrix: matrix,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get collaboration by handoff ID
   *
   * @param {string} handoffId - Handoff ID
   * @returns {Promise<object|null>} Collaboration record
   */
  async getCollaboration(handoffId) {
    await this.ensureInitialized();

    const stmt = this.db.prepare(`
      SELECT * FROM agent_collaborations
      WHERE handoff_id = ?
    `);

    const collab = stmt.get(handoffId);

    if (!collab) {
      return null;
    }

    return {
      ...collab,
      handoffContext: collab.handoff_context ? JSON.parse(collab.handoff_context) : {},
    };
  }

  /**
   * Clean up expired handoffs
   *
   * @returns {Promise<number>} Number of handoffs cleaned
   */
  async cleanupExpiredHandoffs() {
    await this.ensureInitialized();

    const expiryTime = new Date(Date.now() - this.config.handoffTTL).toISOString();

    const stmt = this.db.prepare(`
      DELETE FROM agent_collaborations
      WHERE status = ?
      AND created_at < ?
    `);

    const result = stmt.run(CollaborationStatus.PENDING, expiryTime);

    console.log(`[Agent Collaboration] Cleaned up ${result.changes} expired handoffs`);

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
 * Create agent collaboration manager
 *
 * @param {object} database - MemoryDatabase instance
 * @returns {AgentCollaborationManager}
 */
export function createAgentCollaborationManager(database) {
  return new AgentCollaborationManager(database);
}
