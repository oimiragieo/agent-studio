/**
 * Push Notification Handler Tests
 *
 * Tests for webhook callbacks, signature validation, and delivery tracking.
 *
 * Coverage:
 * - Webhook configuration and registration
 * - Push notification delivery
 * - HMAC-SHA256 signature validation
 * - Delivery tracking and logging
 * - Error handling and recovery
 */

import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import {
  PushNotificationHandler,
  createPushNotificationHandler,
  getPushNotificationHandler,
  resetInstance,
} from './push-notification-handler.mjs';
import { mockFeatureFlags } from './test-utils.mjs';

// Mock fetch globally
const originalFetch = global.fetch;
let fetchMock = null;

function setupFetchMock() {
  fetchMock = {
    calls: [],
    responses: [],
  };

  global.fetch = async (url, options) => {
    fetchMock.calls.push({ url, options });

    const response = fetchMock.responses.shift() || {
      ok: true,
      status: 200,
      json: async () => ({}),
    };

    return response;
  };
}

function teardownFetchMock() {
  global.fetch = originalFetch;
  fetchMock = null;
}

describe('PushNotificationHandler', () => {
  let handler;
  let flags;

  beforeEach(() => {
    setupFetchMock();
    flags = mockFeatureFlags({ push_notifications: true });
    handler = createPushNotificationHandler({ featureFlags: flags });
  });

  afterEach(() => {
    teardownFetchMock();
    resetInstance();
  });

  describe('Constructor', () => {
    it('should create instance with default options', () => {
      const h = new PushNotificationHandler();
      assert.ok(h instanceof PushNotificationHandler);
      assert.ok(h.pushConfigs instanceof Map);
    });

    it('should use custom webhook secret', () => {
      const h = new PushNotificationHandler({ webhookSecret: 'custom-secret' });
      assert.equal(h.webhookSecret, 'custom-secret');
    });
  });

  describe('configurePushNotification()', () => {
    it('should configure push notification', () => {
      const config = handler.configurePushNotification(
        'task-123',
        'https://webhook.example.com/callback'
      );

      assert.equal(config.task_id, 'task-123');
      assert.equal(config.callback_url, 'https://webhook.example.com/callback');
      assert.ok(config.events.includes('task_status_update'));
      assert.ok(config.created_at);
    });

    it('should throw when feature flag disabled', () => {
      handler.featureFlags.push_notifications = false;

      assert.throws(
        () => {
          handler.configurePushNotification('task-1', 'https://test.com');
        },
        { message: /push_notifications feature flag is disabled/ }
      );
    });

    it('should throw when taskId missing', () => {
      assert.throws(
        () => {
          handler.configurePushNotification(null, 'https://test.com');
        },
        { message: /taskId is required/ }
      );
    });

    it('should throw when callbackUrl missing', () => {
      assert.throws(
        () => {
          handler.configurePushNotification('task-1', null);
        },
        { message: /callbackUrl is required/ }
      );
    });

    it('should throw when callbackUrl invalid', () => {
      assert.throws(
        () => {
          handler.configurePushNotification('task-1', 'not-a-valid-url');
        },
        { message: /Invalid callbackUrl/ }
      );
    });

    it('should accept custom event types', () => {
      const config = handler.configurePushNotification('task-1', 'https://test.com', {
        events: ['task_completed'],
      });

      assert.deepEqual(config.events, ['task_completed']);
    });

    it('should accept custom secret', () => {
      const config = handler.configurePushNotification('task-1', 'https://test.com', {
        secret: 'custom-secret',
      });

      assert.equal(config.secret, 'custom-secret');
    });
  });

  describe('handlePushNotification()', () => {
    it('should handle valid webhook', () => {
      const webhook = {
        task_id: 'task-123',
        event_type: 'task_status_update',
        timestamp: new Date().toISOString(),
        data: { state: 'COMPLETED' },
      };

      const result = handler.handlePushNotification(webhook);

      assert.equal(result.task_id, 'task-123');
      assert.equal(result.event_type, 'task_status_update');
      assert.ok(result.received_at);
      assert.ok(result.processing_time_ms >= 0);
    });

    it('should throw when feature flag disabled', () => {
      handler.featureFlags.push_notifications = false;

      assert.throws(
        () => {
          handler.handlePushNotification({ task_id: 'task-1' });
        },
        { message: /push_notifications feature flag is disabled/ }
      );
    });

    it('should throw when webhook invalid', () => {
      assert.throws(
        () => {
          handler.handlePushNotification({});
        },
        { message: /Invalid webhook payload/ }
      );
    });

    it('should validate signature when provided', () => {
      const webhook = {
        task_id: 'task-1',
        event_type: 'test',
        timestamp: new Date().toISOString(),
      };

      const signature = handler.generateWebhookSignature(webhook);

      const result = handler.handlePushNotification(webhook, { signature });

      assert.ok(result);
    });

    it('should throw when signature invalid', () => {
      const webhook = {
        task_id: 'task-1',
        event_type: 'test',
        timestamp: new Date().toISOString(),
      };

      assert.throws(
        () => {
          handler.handlePushNotification(webhook, { signature: 'invalid-signature' });
        },
        { message: /Invalid webhook signature/ }
      );
    });

    it('should complete within performance target (<20ms)', () => {
      const webhook = {
        task_id: 'task-1',
        event_type: 'test',
        timestamp: new Date().toISOString(),
      };

      const startTime = Date.now();
      handler.handlePushNotification(webhook);
      const duration = Date.now() - startTime;

      assert.ok(duration < 20, `Handling took ${duration}ms (target: <20ms)`);
    });
  });

  describe('validateWebhookSignature()', () => {
    it('should validate correct signature', () => {
      const webhook = { task_id: 'task-1', data: 'test' };
      const signature = handler.generateWebhookSignature(webhook);

      const valid = handler.validateWebhookSignature(webhook, signature);

      assert.equal(valid, true);
    });

    it('should reject incorrect signature', () => {
      const webhook = { task_id: 'task-1', data: 'test' };
      const wrongSignature = 'wrong-signature-12345678901234567890123456789012';

      const valid = handler.validateWebhookSignature(webhook, wrongSignature);

      assert.equal(valid, false);
    });

    it('should use custom secret', () => {
      const webhook = { task_id: 'task-1' };
      const secret = 'custom-secret';
      const signature = handler.generateWebhookSignature(webhook, secret);

      const valid = handler.validateWebhookSignature(webhook, signature, secret);

      assert.equal(valid, true);
    });
  });

  describe('generateWebhookSignature()', () => {
    it('should generate HMAC-SHA256 signature', () => {
      const webhook = { task_id: 'task-1', event_type: 'test' };
      const signature = handler.generateWebhookSignature(webhook);

      assert.ok(signature);
      assert.equal(signature.length, 64); // SHA256 hex = 64 chars
    });

    it('should generate consistent signatures', () => {
      const webhook = { task_id: 'task-1' };
      const sig1 = handler.generateWebhookSignature(webhook);
      const sig2 = handler.generateWebhookSignature(webhook);

      assert.equal(sig1, sig2);
    });

    it('should generate different signatures for different webhooks', () => {
      const webhook1 = { task_id: 'task-1' };
      const webhook2 = { task_id: 'task-2' };

      const sig1 = handler.generateWebhookSignature(webhook1);
      const sig2 = handler.generateWebhookSignature(webhook2);

      assert.notEqual(sig1, sig2);
    });
  });

  describe('sendPushNotification()', () => {
    it('should send push notification to callback URL', async () => {
      handler.configurePushNotification('task-1', 'https://webhook.test.com');

      const event = {
        event_type: 'task_status_update',
        data: { state: 'COMPLETED' },
      };

      const result = await handler.sendPushNotification('task-1', event);

      assert.equal(result.status, 'success');
      assert.equal(result.task_id, 'task-1');
      assert.ok(fetchMock.calls.length > 0);
      assert.equal(fetchMock.calls[0].url, 'https://webhook.test.com');
    });

    it('should include signature header', async () => {
      handler.configurePushNotification('task-1', 'https://webhook.test.com');

      const event = {
        event_type: 'test',
        data: {},
      };

      await handler.sendPushNotification('task-1', event);

      const headers = fetchMock.calls[0].options.headers;
      assert.ok(headers['X-Webhook-Signature']);
    });

    it('should filter events by configuration', async () => {
      handler.configurePushNotification('task-1', 'https://test.com', {
        events: ['task_completed'],
      });

      const event = {
        event_type: 'task_status_update',
        data: {},
      };

      const result = await handler.sendPushNotification('task-1', event);

      assert.equal(result.skipped, true);
    });

    it('should throw when no configuration exists', async () => {
      await assert.rejects(
        async () => {
          await handler.sendPushNotification('nonexistent-task', {
            event_type: 'test',
          });
        },
        { message: /No push notification configured/ }
      );
    });

    it('should handle delivery errors', async () => {
      handler.configurePushNotification('task-1', 'https://fail.com');

      fetchMock.responses.push({
        ok: false,
        status: 500,
      });

      const event = { event_type: 'test', data: {} };

      const result = await handler.sendPushNotification('task-1', event);

      assert.equal(result.status, 'failed');
      assert.equal(result.http_status, 500);
    });

    it('should log all deliveries', async () => {
      handler.configurePushNotification('task-1', 'https://test.com');

      const event = { event_type: 'test', data: {} };

      await handler.sendPushNotification('task-1', event);

      const log = handler.getDeliveryLog('task-1');
      assert.ok(log.length > 0);
      assert.equal(log[0].task_id, 'task-1');
    });
  });

  describe('validateWebhookPayload()', () => {
    it('should validate valid payload', () => {
      const webhook = {
        task_id: 'task-1',
        event_type: 'test',
        timestamp: new Date().toISOString(),
      };

      const result = handler.validateWebhookPayload(webhook);

      assert.equal(result.valid, true);
      assert.equal(result.errors.length, 0);
    });

    it('should reject null payload', () => {
      const result = handler.validateWebhookPayload(null);

      assert.equal(result.valid, false);
      assert.ok(result.errors.length > 0);
    });

    it('should detect missing task_id', () => {
      const webhook = {
        event_type: 'test',
        timestamp: new Date().toISOString(),
      };

      const result = handler.validateWebhookPayload(webhook);

      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('task_id')));
    });
  });

  describe('Delivery Tracking', () => {
    it('should track delivery statistics', async () => {
      handler.configurePushNotification('task-1', 'https://test.com');

      // Successful delivery
      await handler.sendPushNotification('task-1', {
        event_type: 'test',
        data: {},
      });

      // Failed delivery
      fetchMock.responses.push({ ok: false, status: 500 });
      await handler.sendPushNotification('task-1', {
        event_type: 'test',
        data: {},
      });

      const stats = handler.getDeliveryStats('task-1');

      assert.equal(stats.total, 2);
      assert.equal(stats.successful, 1);
      assert.equal(stats.failed, 1);
    });

    it('should clear delivery log', async () => {
      handler.configurePushNotification('task-1', 'https://test.com');
      await handler.sendPushNotification('task-1', {
        event_type: 'test',
        data: {},
      });

      handler.clearDeliveryLog();

      const log = handler.getDeliveryLog('task-1');
      assert.equal(log.length, 0);
    });
  });

  describe('Configuration Management', () => {
    it('should list all push notifications', () => {
      handler.configurePushNotification('task-1', 'https://test1.com');
      handler.configurePushNotification('task-2', 'https://test2.com');

      const configs = handler.listPushNotifications();

      assert.equal(configs.length, 2);
    });

    it('should remove push notification', () => {
      handler.configurePushNotification('task-1', 'https://test.com');

      const removed = handler.removePushNotification('task-1');

      assert.equal(removed, true);
      assert.equal(handler.pushConfigs.size, 0);
    });

    it('should clear all push notifications', () => {
      handler.configurePushNotification('task-1', 'https://test1.com');
      handler.configurePushNotification('task-2', 'https://test2.com');

      handler.clearPushNotifications();

      assert.equal(handler.pushConfigs.size, 0);
    });
  });

  describe('Singleton Instance', () => {
    it('should return same instance', () => {
      const instance1 = getPushNotificationHandler();
      const instance2 = getPushNotificationHandler();

      assert.strictEqual(instance1, instance2);
    });

    it('should reset instance', () => {
      const instance1 = getPushNotificationHandler();
      resetInstance();
      const instance2 = getPushNotificationHandler();

      assert.notStrictEqual(instance1, instance2);
    });
  });
});
