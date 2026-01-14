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
 * Security Features (Phase 5):
 * - SEC-002: Agent ID validation against known agent registry
 * - SEC-003: Circular handoff blocking with circuit breaker
 *
 * @module agent-collaboration-manager
 */

import { randomUUID } from 'crypto';

/**
 * SECURITY: Registry of known/authorized agent IDs
 *
 * SEC-002 Mitigation: Validates agent IDs against allowlist
 * to prevent agent spoofing attacks.
 *
 * This list is derived from .claude/agents/ directory.
 * Update this list when adding new agents.
 *
 * Defense Layers:
 * 1. Allowlist validation (primary)
 * 2. Pattern validation (secondary - must be lowercase, no special chars)
 * 3. Logging of invalid attempts (audit trail)
 */
const VALID_AGENT_IDS = new Set([
  // Orchestration agents
  'master-orchestrator',
  'orchestrator',
  'router',
  'model-orchestrator',
  'ai-council',

  // Core development agents
  'developer',
  'architect',
  'code-reviewer',
  'qa',
  'devops',
  'technical-writer',

  // Specialized development agents
  'api-designer',
  'database-architect',
  'mobile-developer',
  'react-component-developer',
  'performance-engineer',
  'refactoring-specialist',
  'code-simplifier',
  'legacy-modernizer',

  // Analysis and planning agents
  'analyst',
  'planner',
  'pm',
  'impact-analyzer',

  // Security and compliance agents
  'security-architect',
  'compliance-auditor',
  'incident-responder',

  // Specialized agents
  'llm-architect',
  'ux-expert',
  'accessibility-expert',
  'cloud-integrator',
  'gcp-cloud-agent',
  'context-compressor',

  // Validation agents
  'cursor-validator',
  'gemini-validator',
  'codex-validator',
]);

/**
 * SECURITY: Validate agent ID against registry
 *
 * @param {string} agentId - Agent ID to validate
 * @param {string} context - Context for error messages
 * @returns {boolean} - True if valid
 * @throws {Error} - If agent ID is invalid
 *
 * @security SEC-002 - Agent ID Spoofing Prevention
 */
function validateAgentId(agentId, context = 'agent') {
  // Null/undefined check
  if (!agentId || typeof agentId !== 'string') {
    throw new Error(`Invalid ${context}: agent ID is required`);
  }

  // Trim and normalize
  const normalized = agentId.trim().toLowerCase();

  // Pattern validation (secondary defense)
  // Agent IDs must be lowercase alphanumeric with hyphens only
  const validPattern = /^[a-z][a-z0-9-]*[a-z0-9]$|^[a-z]{2,}$/;
  if (!validPattern.test(normalized)) {
    console.error(`[SECURITY] Invalid agent ID pattern rejected: ${agentId}`);
    throw new Error(
      `Invalid ${context}: "${agentId}" contains invalid characters. ` +
        'Agent IDs must be lowercase alphanumeric with hyphens only.'
    );
  }

  // Allowlist validation (primary defense)
  if (!VALID_AGENT_IDS.has(normalized)) {
    console.error(`[SECURITY] Unknown agent ID rejected: ${agentId}`);
    throw new Error(
      `Invalid ${context}: "${agentId}" is not a recognized agent. ` +
        'Possible agent spoofing attempt detected.'
    );
  }

  return true;
}

/**
 * Check if agent ID is valid without throwing
 *
 * @param {string} agentId - Agent ID to check
 * @returns {boolean} - True if valid
 */
function isValidAgentId(agentId) {
  try {
    validateAgentId(agentId, 'agent');
    return true;
  } catch {
    return false;
  }
}

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
 *
 * @security SEC-002 - All agent IDs are validated against registry
 * @security SEC-003 - Circular handoffs are blocked, not just warned
 */
export class AgentCollaborationManager {
  /**
   * @param {object} database - MemoryDatabase instance
   * @param {object} options - Configuration options
   */
  constructor(database, options = {}) {
    this.db = database;
    this.isInitialized = false;

    // Configuration with security defaults
    this.config = {
      maxChainLength: options.maxChainLength || 10, // Maximum collaboration chain before warning
      circularDetectionDepth: options.circularDetectionDepth || 5, // How deep to search for cycles
      handoffTTL: options.handoffTTL || 3600000, // Handoff expiration (1 hour in ms)

      // SECURITY: SEC-003 - Circular handoff blocking configuration
      blockCircularHandoffs: options.blockCircularHandoffs !== false, // Default: block circular handoffs
      maxCircularViolations: options.maxCircularViolations || 3, // Max violations before circuit breaker
      circuitBreakerDuration: options.circuitBreakerDuration || 300000, // 5 minutes cooldown
    };

    // SECURITY: Circuit breaker state for SEC-003
    this.circuitBreaker = {
      violations: new Map(), // sessionId -> { count, lastViolation }
      isOpen: new Map(), // sessionId -> boolean
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
   * @throws {Error} - If agent IDs are invalid or circular handoff detected
   *
   * @security SEC-002 - Agent IDs are validated against registry
   * @security SEC-003 - Circular handoffs are blocked (not just warned)
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

    // Validate required parameters
    if (!sessionId || !sourceAgentId || !targetAgentId) {
      throw new Error('sessionId, sourceAgentId, and targetAgentId are required');
    }

    // SECURITY: SEC-002 - Validate agent IDs against registry
    validateAgentId(sourceAgentId, 'sourceAgentId');
    validateAgentId(targetAgentId, 'targetAgentId');

    // SECURITY: SEC-003 - Check circuit breaker
    if (this.isCircuitBreakerOpen(sessionId)) {
      const error = new Error(
        `[SECURITY] Circuit breaker open for session ${sessionId}. ` +
          'Too many circular handoff attempts detected. Please wait before retrying.'
      );
      console.error('[SECURITY] Circuit breaker blocked handoff registration:', error.message);
      throw error;
    }

    // Detect circular handoffs
    const circularDetection = await this.detectCircularHandoff(
      sessionId,
      sourceAgentId,
      targetAgentId
    );

    // SECURITY: SEC-003 - Block circular handoffs (not just warn)
    if (circularDetection.isCircular) {
      console.error('[SECURITY] Circular handoff BLOCKED:', circularDetection);

      // Record violation for circuit breaker
      this.recordCircularViolation(sessionId);

      if (this.config.blockCircularHandoffs) {
        // Store rejected handoff for audit trail
        const handoffId = `handoff-rejected-${randomUUID()}`;

        const stmt = this.db.prepare(`
          INSERT INTO agent_collaborations (
            session_id, workflow_id, source_agent_id, target_agent_id,
            handoff_id, handoff_context, handoff_type, status
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
          sessionId,
          workflowId,
          sourceAgentId,
          targetAgentId,
          handoffId,
          JSON.stringify({
            ...handoffContext,
            circularDetection,
            blockedAt: new Date().toISOString(),
            reason: 'circular_handoff_blocked',
          }),
          handoffType,
          CollaborationStatus.REJECTED
        );

        throw new Error(
          `[SECURITY] Circular handoff blocked: ${circularDetection.message}. ` +
            `Cycle path: ${circularDetection.cycle.join(' → ')}. ` +
            'This is a security violation that could lead to resource exhaustion.'
        );
      }
    }

    // Check for long chains (warning, not blocking)
    if (circularDetection.longChain) {
      console.warn(
        `[Agent Collaboration] Long chain detected: ${circularDetection.chainLength} agents. ` +
          'Consider breaking down the workflow.'
      );
      handoffContext.longChainWarning = circularDetection;
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
      circularWarning: null, // No warning since we block circular handoffs
    };

    console.log(
      `[Agent Collaboration] Registered: ${sourceAgentId} → ${targetAgentId} (${handoffId})`
    );

    return collaboration;
  }

  /**
   * SECURITY: Check if circuit breaker is open for session
   *
   * @param {string} sessionId - Session ID
   * @returns {boolean} - True if circuit breaker is open (blocking)
   *
   * @security SEC-003 - Circuit breaker prevents DoS via repeated circular attempts
   */
  isCircuitBreakerOpen(sessionId) {
    const isOpen = this.circuitBreaker.isOpen.get(sessionId);

    if (!isOpen) {
      return false;
    }

    // Check if cooldown has expired
    const violation = this.circuitBreaker.violations.get(sessionId);

    if (violation) {
      const elapsed = Date.now() - violation.lastViolation;

      if (elapsed >= this.config.circuitBreakerDuration) {
        // Reset circuit breaker
        this.circuitBreaker.isOpen.set(sessionId, false);
        this.circuitBreaker.violations.delete(sessionId);
        console.log(`[SECURITY] Circuit breaker reset for session ${sessionId}`);
        return false;
      }
    }

    return true;
  }

  /**
   * SECURITY: Record circular violation and potentially trip circuit breaker
   *
   * @param {string} sessionId - Session ID
   *
   * @security SEC-003 - Tracks violations and trips circuit breaker
   */
  recordCircularViolation(sessionId) {
    const existing = this.circuitBreaker.violations.get(sessionId) || {
      count: 0,
      lastViolation: 0,
    };

    existing.count += 1;
    existing.lastViolation = Date.now();

    this.circuitBreaker.violations.set(sessionId, existing);

    // Trip circuit breaker if threshold exceeded
    if (existing.count >= this.config.maxCircularViolations) {
      this.circuitBreaker.isOpen.set(sessionId, true);
      console.error(
        `[SECURITY] Circuit breaker TRIPPED for session ${sessionId}. ` +
          `${existing.count} circular violations detected. ` +
          `Cooldown: ${this.config.circuitBreakerDuration / 1000}s`
      );
    }
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

    sql += ' ORDER BY id DESC LIMIT ?'; // Use id DESC for reliable ordering (created_at has 1-second precision)
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
    const pathExists = this.findPath(
      graph,
      targetAgentId,
      sourceAgentId,
      this.config.circularDetectionDepth
    );

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
 * @param {object} options - Configuration options
 * @param {number} options.maxChainLength - Maximum collaboration chain length (default: 10)
 * @param {number} options.circularDetectionDepth - Depth for cycle detection (default: 5)
 * @param {number} options.handoffTTL - Handoff expiration in ms (default: 3600000)
 * @param {boolean} options.blockCircularHandoffs - Block circular handoffs (default: true)
 * @param {number} options.maxCircularViolations - Max violations before circuit breaker (default: 3)
 * @param {number} options.circuitBreakerDuration - Circuit breaker cooldown in ms (default: 300000)
 * @returns {AgentCollaborationManager}
 *
 * @security SEC-002 - Agent ID validation enabled by default
 * @security SEC-003 - Circular handoff blocking enabled by default
 */
export function createAgentCollaborationManager(database, options = {}) {
  return new AgentCollaborationManager(database, options);
}

/**
 * Export the valid agent IDs set for external validation
 *
 * @security SEC-002 - Allows other modules to validate agent IDs
 */
export { VALID_AGENT_IDS, validateAgentId, isValidAgentId };
