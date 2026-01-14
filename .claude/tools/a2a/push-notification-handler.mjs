/**
 * Push Notification Handler
 *
 * Handles webhook callbacks for long-running task updates.
 * Supports push notification registration, delivery, and signature validation.
 *
 * Features:
 * - configurePushNotification(): Register webhook callbacks
 * - handlePushNotification(): Process incoming webhooks
 * - Signature validation: HMAC-SHA256
 * - Delivery tracking: Success/failure logging
 * - Feature flag integration: push_notifications
 * - Performance target: <20ms webhook POST
 *
 * @module push-notification-handler
 */

import crypto from 'crypto';
import { randomUUID } from 'crypto';
import { isEnabled } from '../feature-flags-manager.mjs';

/**
 * Default webhook secret for signature validation
 */
const DEFAULT_WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'default-secret';

/**
 * Push notification configurations (task_id → callback config)
 */
const pushConfigs = new Map();

/**
 * Delivery log for webhook attempts
 */
const deliveryLog = [];

/**
 * Maximum delivery log size
 */
const MAX_LOG_SIZE = 1000;

/**
 * Push Notification Handler
 *
 * Manages webhook callbacks for task updates
 */
export class PushNotificationHandler {
  /**
   * @param {object} options - Configuration options
   */
  constructor(options = {}) {
    this.featureFlags = options.featureFlags || {
      push_notifications: process.env.PUSH_NOTIFICATIONS === 'true' || false,
    };
    this.webhookSecret = options.webhookSecret || DEFAULT_WEBHOOK_SECRET;
    this.pushConfigs = pushConfigs;
    this.deliveryLog = deliveryLog;
  }

  /**
   * Configure push notification for task
   *
   * @param {string} taskId - Task ID
   * @param {string} callbackUrl - Webhook callback URL
   * @param {object} options - Configuration options
   * @returns {object} Push notification configuration
   */
  configurePushNotification(taskId, callbackUrl, options = {}) {
    const enabled = this.featureFlags.isEnabled?.('push_notifications') ?? this.featureFlags.push_notifications;
    if (!enabled) {
      throw new Error('push_notifications feature flag is disabled');
    }

    if (!taskId) {
      throw new Error('taskId is required');
    }

    if (!callbackUrl) {
      throw new Error('callbackUrl is required');
    }

    // Validate callback URL
    try {
      new URL(callbackUrl);
    } catch (error) {
      throw new Error(`Invalid callbackUrl: ${error.message}`);
    }

    // Create configuration
    const config = {
      task_id: taskId,
      callback_url: callbackUrl,
      secret: options.secret || this.webhookSecret,
      events: options.events || ['task_status_update', 'task_artifact_update'],
      created_at: new Date().toISOString(),
      delivery_count: 0,
      last_delivery_at: null,
    };

    // Store configuration
    this.pushConfigs.set(taskId, config);

    console.log(
      `[Push Notifications] Configured for task ${taskId} → ${callbackUrl}`
    );

    return config;
  }

  /**
   * Handle incoming push notification webhook
   *
   * @param {object} webhook - Webhook payload
   * @param {object} options - Handler options
   * @returns {object} Handler result
   */
  handlePushNotification(webhook, options = {}) {
    const startTime = Date.now();

    const enabled = this.featureFlags.isEnabled?.('push_notifications') ?? this.featureFlags.push_notifications;
    if (!enabled) {
      throw new Error('push_notifications feature flag is disabled');
    }

    // Validate webhook structure
    const validation = this.validateWebhookPayload(webhook);
    if (!validation.valid) {
      throw new Error(
        `Invalid webhook payload: ${validation.errors.join(', ')}`
      );
    }

    // Validate signature if provided
    if (options.signature) {
      const signatureValid = this.validateWebhookSignature(
        webhook,
        options.signature,
        options.secret
      );

      if (!signatureValid) {
        throw new Error('Invalid webhook signature');
      }
    }

    // Process webhook
    const result = {
      webhook_id: webhook.webhook_id || `webhook-${randomUUID()}`,
      task_id: webhook.task_id,
      event_type: webhook.event_type,
      received_at: new Date().toISOString(),
      processing_time_ms: 0,
    };

    // Execute webhook handlers (placeholder for now)
    // In production, this would trigger callbacks, update state, etc.

    result.processing_time_ms = Date.now() - startTime;

    console.log(
      `[Push Notifications] Handled ${webhook.event_type} for task ${webhook.task_id} (${result.processing_time_ms}ms)`
    );

    return result;
  }

  /**
   * Validate webhook signature using HMAC-SHA256
   *
   * @param {object} webhook - Webhook payload
   * @param {string} signature - Provided signature
   * @param {string} secret - Webhook secret
   * @returns {boolean} True if valid
   */
  validateWebhookSignature(webhook, signature, secret = null) {
    const webhookSecret = secret || this.webhookSecret;

    // Compute expected signature
    const payload = JSON.stringify(webhook);
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex');

    // Constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Generate webhook signature
   *
   * @param {object} webhook - Webhook payload
   * @param {string} secret - Webhook secret
   * @returns {string} HMAC-SHA256 signature
   */
  generateWebhookSignature(webhook, secret = null) {
    const webhookSecret = secret || this.webhookSecret;
    const payload = JSON.stringify(webhook);

    return crypto
      .createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex');
  }

  /**
   * Send push notification to callback URL
   *
   * @param {string} taskId - Task ID
   * @param {object} event - Event data
   * @returns {Promise<object>} Delivery result
   */
  async sendPushNotification(taskId, event) {
    const startTime = Date.now();

    const config = this.pushConfigs.get(taskId);
    if (!config) {
      throw new Error(`No push notification configured for task ${taskId}`);
    }

    // Filter by event type
    if (config.events && !config.events.includes(event.event_type)) {
      console.log(
        `[Push Notifications] Event ${event.event_type} not in configured events for task ${taskId}`
      );
      return { skipped: true, reason: 'event_type_filtered' };
    }

    // Build webhook payload
    const webhook = {
      webhook_id: `webhook-${randomUUID()}`,
      task_id: taskId,
      event_type: event.event_type,
      timestamp: new Date().toISOString(),
      data: event.data || {},
    };

    // Generate signature
    const signature = this.generateWebhookSignature(
      webhook,
      config.secret
    );

    try {
      // Send POST request to callback URL
      const response = await fetch(config.callback_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Id': webhook.webhook_id,
        },
        body: JSON.stringify(webhook),
      });

      const duration = Date.now() - startTime;

      const deliveryResult = {
        webhook_id: webhook.webhook_id,
        task_id: taskId,
        callback_url: config.callback_url,
        status: response.ok ? 'success' : 'failed',
        http_status: response.status,
        duration_ms: duration,
        delivered_at: new Date().toISOString(),
      };

      // Update config
      config.delivery_count++;
      config.last_delivery_at = deliveryResult.delivered_at;

      // Log delivery
      this.logDelivery(deliveryResult);

      console.log(
        `[Push Notifications] Delivered ${event.event_type} to ${config.callback_url} (${duration}ms, HTTP ${response.status})`
      );

      return deliveryResult;
    } catch (error) {
      const duration = Date.now() - startTime;

      const deliveryResult = {
        webhook_id: webhook.webhook_id,
        task_id: taskId,
        callback_url: config.callback_url,
        status: 'error',
        error: error.message,
        duration_ms: duration,
        delivered_at: new Date().toISOString(),
      };

      // Log delivery error
      this.logDelivery(deliveryResult);

      console.error(
        `[Push Notifications] Failed to deliver to ${config.callback_url}:`,
        error
      );

      throw new Error(`Push notification delivery failed: ${error.message}`);
    }
  }

  /**
   * Validate webhook payload structure
   *
   * @param {object} webhook - Webhook payload
   * @returns {object} Validation result
   */
  validateWebhookPayload(webhook) {
    const errors = [];

    if (!webhook) {
      return { valid: false, errors: ['Webhook is null or undefined'] };
    }

    // Required fields
    if (!webhook.task_id) {
      errors.push('Missing required field: task_id');
    }

    if (!webhook.event_type) {
      errors.push('Missing required field: event_type');
    }

    if (!webhook.timestamp) {
      errors.push('Missing required field: timestamp');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Log webhook delivery attempt
   *
   * @param {object} deliveryResult - Delivery result
   */
  logDelivery(deliveryResult) {
    this.deliveryLog.push(deliveryResult);

    // Trim log if too large
    if (this.deliveryLog.length > MAX_LOG_SIZE) {
      this.deliveryLog.shift();
    }
  }

  /**
   * Get delivery log for task
   *
   * @param {string} taskId - Task ID
   * @returns {Array} Delivery log entries
   */
  getDeliveryLog(taskId) {
    return this.deliveryLog.filter((entry) => entry.task_id === taskId);
  }

  /**
   * Get delivery statistics
   *
   * @param {string} taskId - Task ID (optional)
   * @returns {object} Delivery stats
   */
  getDeliveryStats(taskId = null) {
    let entries = this.deliveryLog;

    if (taskId) {
      entries = entries.filter((e) => e.task_id === taskId);
    }

    const total = entries.length;
    const successful = entries.filter((e) => e.status === 'success').length;
    const failed = entries.filter((e) => e.status === 'failed').length;
    const errors = entries.filter((e) => e.status === 'error').length;

    return {
      total,
      successful,
      failed,
      errors,
      success_rate: total > 0 ? successful / total : 0,
    };
  }

  /**
   * Remove push notification configuration
   *
   * @param {string} taskId - Task ID
   * @returns {boolean} True if removed
   */
  removePushNotification(taskId) {
    return this.pushConfigs.delete(taskId);
  }

  /**
   * List all configured push notifications
   *
   * @returns {Array} Push notification configs
   */
  listPushNotifications() {
    return Array.from(this.pushConfigs.values());
  }

  /**
   * Clear all push notification configurations
   */
  clearPushNotifications() {
    this.pushConfigs.clear();
  }

  /**
   * Clear delivery log
   */
  clearDeliveryLog() {
    this.deliveryLog.length = 0;
  }
}

/**
 * Create Push Notification Handler
 *
 * @param {object} options - Configuration options
 * @returns {PushNotificationHandler}
 */
export function createPushNotificationHandler(options = {}) {
  return new PushNotificationHandler(options);
}

/**
 * Singleton instance
 */
let instance = null;

/**
 * Get or create singleton instance
 *
 * @param {object} options - Configuration options
 * @returns {PushNotificationHandler}
 */
export function getPushNotificationHandler(options = {}) {
  if (!instance) {
    instance = new PushNotificationHandler(options);
  }
  return instance;
}

/**
 * Reset singleton instance (for testing)
 */
export function resetInstance() {
  instance = null;
  pushConfigs.clear();
  deliveryLog.length = 0;
}

export default {
  PushNotificationHandler,
  createPushNotificationHandler,
  getPushNotificationHandler,
  resetInstance,
};
