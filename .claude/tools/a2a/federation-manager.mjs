/**
 * Federation Manager
 *
 * Coordinates interactions with external A2A-compliant agents.
 * Orchestrates discovery, task execution, and federated workflows.
 *
 * Features:
 * - executeExternalTask(): Send tasks to external agents
 * - getFederatedAgents(): List discovered external agents
 * - isFederationEnabled(): Check feature flag status
 * - End-to-end federation: Discovery → Task → Streaming → Webhooks
 * - Feature flag integration: external_federation
 *
 * @module federation-manager
 */

import { randomUUID } from 'crypto';
import { isEnabled } from '../feature-flags-manager.mjs';
import { getExternalAgentDiscovery } from './external-agent-discovery.mjs';
import { getPushNotificationHandler } from './push-notification-handler.mjs';
import { getStreamingHandler } from './streaming-handler.mjs';
import { Role } from './message-wrapper.mjs';
import { TaskState } from './task-state-manager.mjs';

/**
 * Federation Manager
 *
 * Manages external agent interactions and federated workflows
 */
export class FederationManager {
  /**
   * @param {object} options - Configuration options
   */
  constructor(options = {}) {
    this.featureFlags = options.featureFlags || {
      external_federation: process.env.EXTERNAL_FEDERATION === 'true' || false,
    };

    // Get component instances
    this.discovery = options.discovery || getExternalAgentDiscovery(options);
    this.pushHandler = options.pushHandler || getPushNotificationHandler(options);
    this.streamingHandler = options.streamingHandler || getStreamingHandler(options);

    // Federated task tracking
    this.federatedTasks = new Map();
  }

  /**
   * Check if federation is enabled
   *
   * @returns {boolean} True if enabled
   */
  isFederationEnabled() {
    const enabled =
      this.featureFlags.isEnabled?.('external_federation') ?? this.featureFlags.external_federation;
    return enabled === true;
  }

  /**
   * Execute task on external agent
   *
   * @param {string} agentUrl - External agent URL
   * @param {object} message - A2A Message
   * @param {object} options - Execution options
   * @returns {Promise<object>} Task result
   */
  async executeExternalTask(agentUrl, message, options = {}) {
    const startTime = Date.now();

    if (!this.isFederationEnabled()) {
      throw new Error('external_federation feature flag is disabled');
    }

    // Step 1: Discover external agent
    console.log(`[Federation] Discovering agent at ${agentUrl}`);
    const agentCard = await this.discovery.discoverAgent(agentUrl, options);

    // Step 2: Validate agent capabilities
    if (!agentCard.supported_interfaces.includes('a2a')) {
      throw new Error(`Agent at ${agentUrl} does not support A2A interface`);
    }

    // Step 3: Send message to external agent
    console.log(`[Federation] Sending message to ${agentCard.name}`);
    const task = await this.sendMessageToExternalAgent(agentUrl, agentCard, message, options);

    // Step 4: Set up streaming if supported
    if (agentCard.capabilities.streaming && options.streaming !== false) {
      console.log(`[Federation] Setting up streaming for task ${task.id}`);
      await this.setupStreamingForTask(agentUrl, task, options);
    }

    // Step 5: Set up push notifications if supported
    if (agentCard.capabilities.push_notifications && options.callbackUrl) {
      console.log(`[Federation] Configuring push notifications for task ${task.id}`);
      await this.setupPushNotificationsForTask(agentUrl, task, options.callbackUrl, options);
    }

    // Track federated task
    this.federatedTasks.set(task.id, {
      task_id: task.id,
      agent_url: agentUrl,
      agent_name: agentCard.name,
      started_at: new Date().toISOString(),
      status: task.state,
      capabilities_used: {
        streaming: agentCard.capabilities.streaming && options.streaming !== false,
        push_notifications: agentCard.capabilities.push_notifications && !!options.callbackUrl,
      },
    });

    const duration = Date.now() - startTime;

    console.log(`[Federation] Task ${task.id} initiated on ${agentCard.name} (${duration}ms)`);

    return task;
  }

  /**
   * Send message to external agent
   *
   * @param {string} agentUrl - External agent URL
   * @param {object} agentCard - AgentCard
   * @param {object} message - A2A Message
   * @param {object} options - Send options
   * @returns {Promise<object>} Task
   */
  async sendMessageToExternalAgent(agentUrl, agentCard, message, options = {}) {
    // Build SendMessage request
    const request = {
      message,
      session_id: options.sessionId || `session-${randomUUID()}`,
    };

    if (options.taskId) {
      request.task_id = options.taskId;
    }

    try {
      // Send to external agent's SendMessage endpoint
      const endpoint = agentCard.url || agentUrl;
      const response = await fetch(`${endpoint}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`External agent returned HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Validate task response
      if (!data.task || !data.task.id) {
        throw new Error('Invalid task response from external agent');
      }

      return data.task;
    } catch (error) {
      console.error(`[Federation] Failed to send message to ${agentUrl}:`, error);
      throw new Error(`External task execution failed: ${error.message}`);
    }
  }

  /**
   * Set up streaming for external task
   *
   * @param {string} agentUrl - External agent URL
   * @param {object} task - Task object
   * @param {object} options - Streaming options
   * @returns {Promise<object>} Stream context
   */
  async setupStreamingForTask(agentUrl, task, options = {}) {
    // Create message for streaming
    const streamMessage = {
      messageId: `msg-${randomUUID()}`,
      taskId: task.id,
      role: Role.USER,
      parts: [{ text: 'Stream task updates' }],
    };

    // Start streaming
    const stream = this.streamingHandler.startStreamingMessage(
      streamMessage,
      event => {
        // Handle streaming events
        if (options.onStreamEvent) {
          options.onStreamEvent(event);
        }

        // Update federated task status
        if (event.type === 'task_status_update' && event.task) {
          const federatedTask = this.federatedTasks.get(task.id);
          if (federatedTask) {
            federatedTask.status = event.task.state;
            federatedTask.last_update_at = new Date().toISOString();
          }
        }
      },
      options
    );

    return stream;
  }

  /**
   * Set up push notifications for external task
   *
   * @param {string} agentUrl - External agent URL
   * @param {object} task - Task object
   * @param {string} callbackUrl - Webhook callback URL
   * @param {object} options - Notification options
   * @returns {object} Push notification config
   */
  async setupPushNotificationsForTask(agentUrl, task, callbackUrl, options = {}) {
    // Configure push notification
    const config = this.pushHandler.configurePushNotification(task.id, callbackUrl, options);

    // Send subscription request to external agent
    try {
      const endpoint = agentUrl;
      const response = await fetch(`${endpoint}/subscribeToTask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task_id: task.id,
          callback_url: callbackUrl,
          events: config.events,
        }),
      });

      if (!response.ok) {
        console.warn(
          `[Federation] Failed to subscribe to task ${task.id} at ${agentUrl}: HTTP ${response.status}`
        );
      }
    } catch (error) {
      console.warn(`[Federation] Failed to subscribe to task ${task.id}:`, error);
    }

    return config;
  }

  /**
   * Get list of federated agents
   *
   * @param {object} filters - Filter options
   * @returns {Array} AgentCards
   */
  getFederatedAgents(filters = {}) {
    return this.discovery.listExternalAgents(filters);
  }

  /**
   * Get federated task status
   *
   * @param {string} taskId - Task ID
   * @returns {object|null} Federated task info
   */
  getFederatedTask(taskId) {
    return this.federatedTasks.get(taskId) || null;
  }

  /**
   * List all federated tasks
   *
   * @param {object} filters - Filter options
   * @returns {Array} Federated tasks
   */
  listFederatedTasks(filters = {}) {
    let tasks = Array.from(this.federatedTasks.values());

    // Filter by agent URL
    if (filters.agent_url) {
      tasks = tasks.filter(t => t.agent_url === filters.agent_url);
    }

    // Filter by status
    if (filters.status) {
      tasks = tasks.filter(t => t.status === filters.status);
    }

    // Apply limit
    if (filters.limit) {
      tasks = tasks.slice(0, filters.limit);
    }

    return tasks;
  }

  /**
   * Get federation statistics
   *
   * @returns {object} Federation stats
   */
  getFederationStats() {
    const tasks = Array.from(this.federatedTasks.values());
    const agents = this.discovery.listExternalAgents();

    return {
      total_external_agents: agents.length,
      total_federated_tasks: tasks.length,
      streaming_enabled: tasks.filter(t => t.capabilities_used.streaming).length,
      push_notifications_enabled: tasks.filter(t => t.capabilities_used.push_notifications).length,
      discovery_cache_size: this.discovery.cache.size,
      active_streams: this.streamingHandler.activeStreams.size,
    };
  }

  /**
   * Discover and execute task on best matching agent
   *
   * @param {Array<string>} agentUrls - Candidate agent URLs
   * @param {object} message - A2A Message
   * @param {object} criteria - Selection criteria
   * @param {object} options - Execution options
   * @returns {Promise<object>} Task result
   */
  async executeOnBestAgent(agentUrls, message, criteria = {}, options = {}) {
    const startTime = Date.now();

    // Discover all agents in parallel
    const discoveryResult = await this.discovery.discoverMultipleAgents(agentUrls, options);

    if (discoveryResult.discovered.length === 0) {
      throw new Error('No agents discovered successfully');
    }

    // Score agents based on criteria
    const scoredAgents = discoveryResult.discovered.map(agentCard => {
      let score = 0;

      // Score based on capabilities
      if (criteria.streaming && agentCard.capabilities.streaming) {
        score += 10;
      }

      if (criteria.push_notifications && agentCard.capabilities.push_notifications) {
        score += 10;
      }

      // Score based on skills
      if (criteria.required_skills) {
        const matchingSkills = agentCard.skills.filter(skill =>
          criteria.required_skills.includes(skill.name)
        );
        score += matchingSkills.length * 5;
      }

      return { agentCard, score };
    });

    // Sort by score
    scoredAgents.sort((a, b) => b.score - a.score);

    const bestAgent = scoredAgents[0].agentCard;

    console.log(`[Federation] Selected ${bestAgent.name} (score: ${scoredAgents[0].score})`);

    // Execute task on best agent
    const task = await this.executeExternalTask(bestAgent._discovery.source_url, message, options);

    const duration = Date.now() - startTime;

    console.log(`[Federation] Task execution with agent selection completed (${duration}ms)`);

    return {
      task,
      selected_agent: bestAgent,
      candidates: scoredAgents.length,
      selection_time_ms: duration,
    };
  }

  /**
   * Clear federation state (for testing)
   */
  clearFederation() {
    this.federatedTasks.clear();
    this.discovery.clearCache();
    this.pushHandler.clearPushNotifications();
    this.streamingHandler.clearStreams();
  }
}

/**
 * Create Federation Manager
 *
 * @param {object} options - Configuration options
 * @returns {FederationManager}
 */
export function createFederationManager(options = {}) {
  return new FederationManager(options);
}

/**
 * Singleton instance
 */
let instance = null;

/**
 * Get or create singleton instance
 *
 * @param {object} options - Configuration options
 * @returns {FederationManager}
 */
export function getFederationManager(options = {}) {
  if (!instance) {
    instance = new FederationManager(options);
  }
  return instance;
}

/**
 * Reset singleton instance (for testing)
 */
export function resetInstance() {
  if (instance) {
    instance.clearFederation();
  }
  instance = null;
}

export default {
  FederationManager,
  createFederationManager,
  getFederationManager,
  resetInstance,
};
