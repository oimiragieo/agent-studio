#!/usr/bin/env node
/**
 * Cross-Workflow Trigger
 * ======================
 *
 * Enables one workflow to spawn/trigger another workflow.
 * Part of the EVOLVE workflow integration layer.
 *
 * Features:
 * - Sync triggers (wait for result)
 * - Async triggers (fire-and-forget)
 * - Trigger history tracking
 * - Circular trigger detection
 * - Multiple workflow triggering
 *
 * Usage:
 *   const { CrossWorkflowTrigger } = require('./cross-workflow-trigger.cjs');
 *
 *   const trigger = new CrossWorkflowTrigger(workflowEngine);
 *   await trigger.trigger('agent-creator', 'skill-creator', { skillName: 'test' });
 */

'use strict';

// =============================================================================
// Constants
// =============================================================================

/**
 * Maximum trigger chain depth to prevent runaway triggers
 */
const MAX_CHAIN_DEPTH = 10;

/**
 * Default timeout for sync triggers (60 seconds)
 */
const DEFAULT_TIMEOUT = 60000;

// =============================================================================
// CrossWorkflowTrigger Class
// =============================================================================

/**
 * Manages cross-workflow triggering with history and circular detection
 */
class CrossWorkflowTrigger {
  /**
   * Create a new CrossWorkflowTrigger
   *
   * @param {Object} workflowEngine - Workflow engine instance
   * @param {Object} options - Configuration options
   * @param {number} options.maxChainDepth - Max trigger chain depth
   * @param {number} options.defaultTimeout - Default timeout for sync triggers
   */
  constructor(workflowEngine, options = {}) {
    this.engine = workflowEngine;
    this.options = {
      maxChainDepth: options.maxChainDepth || MAX_CHAIN_DEPTH,
      defaultTimeout: options.defaultTimeout || DEFAULT_TIMEOUT,
    };

    // Trigger history
    this.history = [];

    // Registered trigger handlers
    this.handlers = new Map();

    // Active trigger chain (for circular detection)
    this._activeChain = [];

    // Pending async triggers
    this._pendingTriggers = new Map();
  }

  /**
   * Trigger a workflow from another workflow
   *
   * @param {string} fromWorkflow - Source workflow ID
   * @param {string} toWorkflow - Target workflow ID
   * @param {Object} context - Context to pass to target workflow
   * @param {Object} options - Trigger options
   * @param {boolean} options.sync - If true, wait for result (default: true)
   * @param {number} options.timeout - Timeout for sync triggers
   * @returns {Promise<Object>} Result or pending status
   */
  async trigger(fromWorkflow, toWorkflow, context = {}, options = {}) {
    const { sync = true, timeout = this.options.defaultTimeout } = options;

    // Check for circular triggers
    if (this.detectCircularTrigger(this._activeChain, toWorkflow)) {
      throw new Error(
        `Circular trigger detected: ${[...this._activeChain, toWorkflow].join(' -> ')}`
      );
    }

    // Check chain depth
    if (this._activeChain.length >= this.options.maxChainDepth) {
      throw new Error(`Trigger chain depth exceeded (max: ${this.options.maxChainDepth})`);
    }

    // Create trigger record
    const triggerId = this._generateTriggerId();
    const triggerRecord = {
      id: triggerId,
      fromWorkflow,
      toWorkflow,
      context,
      timestamp: Date.now(),
      sync,
      status: 'pending',
    };

    // Add to history
    this.history.push(triggerRecord);

    if (sync) {
      // Synchronous trigger - wait for result
      return this._executeSyncTrigger(triggerRecord, timeout);
    } else {
      // Asynchronous trigger - fire and forget
      return this._executeAsyncTrigger(triggerRecord);
    }
  }

  /**
   * Trigger multiple workflows in parallel
   *
   * @param {string} fromWorkflow - Source workflow ID
   * @param {Array<{workflowId: string, context: Object}>} targets - Target workflows
   * @param {Object} context - Shared context (merged with individual contexts)
   * @returns {Promise<Array<{workflowId: string, status: string, result?: Object, error?: string}>>}
   */
  async triggerMultiple(fromWorkflow, targets, sharedContext = {}) {
    const promises = targets.map(async target => {
      const mergedContext = { ...sharedContext, ...target.context };

      try {
        const result = await this.trigger(fromWorkflow, target.workflowId, mergedContext, {
          sync: true,
        });
        return {
          workflowId: target.workflowId,
          status: 'success',
          result,
        };
      } catch (e) {
        return {
          workflowId: target.workflowId,
          status: 'error',
          error: e.message,
        };
      }
    });

    return Promise.all(promises);
  }

  /**
   * Register a handler for workflow triggers
   *
   * @param {string} workflowId - Workflow ID to handle
   * @param {Function} handler - Handler function (context) => result
   */
  registerTriggerHandler(workflowId, handler) {
    if (typeof handler !== 'function') {
      throw new Error('Handler must be a function');
    }
    this.handlers.set(workflowId, handler);
  }

  /**
   * Get trigger history, optionally filtered by workflow
   *
   * @param {string} [workflowId] - Filter by source workflow ID
   * @returns {Array} Trigger history
   */
  getTriggerHistory(workflowId = null) {
    if (workflowId) {
      return this.history.filter(h => h.fromWorkflow === workflowId);
    }
    return [...this.history];
  }

  /**
   * Detect if adding a workflow would create a circular trigger
   *
   * @param {string[]} chain - Current trigger chain
   * @param {string} nextWorkflow - Workflow to add
   * @returns {boolean} True if circular
   */
  detectCircularTrigger(chain, nextWorkflow) {
    return chain.includes(nextWorkflow);
  }

  /**
   * Execute a synchronous trigger
   * @private
   */
  async _executeSyncTrigger(triggerRecord, timeout) {
    const { toWorkflow, context } = triggerRecord;

    // Add to active chain
    this._activeChain.push(toWorkflow);

    try {
      // Create timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Trigger timeout after ${timeout}ms`)), timeout);
      });

      // Execute workflow
      const executionPromise = this._executeWorkflow(toWorkflow, context);

      // Race between execution and timeout
      const result = await Promise.race([executionPromise, timeoutPromise]);

      // Update record
      triggerRecord.status = 'completed';
      triggerRecord.result = result;

      return result;
    } catch (e) {
      triggerRecord.status = 'error';
      triggerRecord.error = e.message;
      throw e;
    } finally {
      // Remove from active chain
      const index = this._activeChain.indexOf(toWorkflow);
      if (index !== -1) {
        this._activeChain.splice(index, 1);
      }
    }
  }

  /**
   * Execute an asynchronous trigger (fire-and-forget)
   * @private
   */
  async _executeAsyncTrigger(triggerRecord) {
    const { id, toWorkflow, context } = triggerRecord;

    // Store pending trigger
    this._pendingTriggers.set(id, triggerRecord);

    // Execute in background
    this._executeWorkflow(toWorkflow, context)
      .then(result => {
        triggerRecord.status = 'completed';
        triggerRecord.result = result;
      })
      .catch(e => {
        triggerRecord.status = 'error';
        triggerRecord.error = e.message;
      })
      .finally(() => {
        this._pendingTriggers.delete(id);
      });

    // Return immediately with pending status
    return {
      triggerId: id,
      status: 'pending',
      fromWorkflow: triggerRecord.fromWorkflow,
      toWorkflow: triggerRecord.toWorkflow,
    };
  }

  /**
   * Execute a workflow through the engine
   * @private
   */
  async _executeWorkflow(workflowId, context) {
    if (this.engine && typeof this.engine.executeWorkflow === 'function') {
      return this.engine.executeWorkflow(workflowId, context);
    }

    // Fallback: check for registered handler
    if (this.handlers.has(workflowId)) {
      const handler = this.handlers.get(workflowId);
      return handler(context);
    }

    throw new Error(`Workflow not found: ${workflowId}`);
  }

  /**
   * Invoke a registered handler
   * @private
   */
  _invokeHandler(workflowId, context) {
    if (!this.handlers.has(workflowId)) {
      throw new Error(`Handler not found: ${workflowId}`);
    }
    return this.handlers.get(workflowId)(context);
  }

  /**
   * Generate a unique trigger ID
   * @private
   */
  _generateTriggerId() {
    return `trigger-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Get pending triggers
   *
   * @returns {Array} Pending trigger records
   */
  getPendingTriggers() {
    return Array.from(this._pendingTriggers.values());
  }

  /**
   * Check if a trigger is still pending
   *
   * @param {string} triggerId - Trigger ID
   * @returns {boolean}
   */
  isPending(triggerId) {
    return this._pendingTriggers.has(triggerId);
  }

  /**
   * Clear trigger history
   */
  clearHistory() {
    this.history = [];
  }
}

// =============================================================================
// Exports
// =============================================================================

module.exports = {
  CrossWorkflowTrigger,
  MAX_CHAIN_DEPTH,
  DEFAULT_TIMEOUT,
};
