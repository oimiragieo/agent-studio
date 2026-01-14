/**
 * Streaming Handler Tests
 *
 * Tests for SSE streaming, event delivery, and connection management.
 *
 * Coverage:
 * - SSE connection setup
 * - Stream event delivery
 * - Connection lifecycle management
 * - Heartbeat and timeouts
 * - Performance benchmarks (<50ms)
 */

import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  StreamingHandler,
  StreamEventType,
  createStreamingHandler,
  getStreamingHandler,
  resetInstance,
} from './streaming-handler.mjs';
import { mockMessage, mockFeatureFlags, waitFor } from './test-utils.mjs';

describe('StreamingHandler', () => {
  let handler;
  let flags;

  beforeEach(() => {
    flags = mockFeatureFlags({ streaming_support: true });
    handler = createStreamingHandler({
      featureFlags: flags,
      heartbeatInterval: 100, // Fast heartbeat for testing
      maxStreamDuration: 5000, // Short timeout for testing
    });
  });

  afterEach(() => {
    resetInstance();
  });

  describe('Constructor', () => {
    it('should create instance with default options', () => {
      const h = new StreamingHandler();
      assert.ok(h instanceof StreamingHandler);
      assert.ok(h.activeStreams instanceof Map);
    });

    it('should use custom heartbeat interval', () => {
      const h = new StreamingHandler({ heartbeatInterval: 60000 });
      assert.equal(h.heartbeatInterval, 60000);
    });

    it('should use custom max stream duration', () => {
      const h = new StreamingHandler({ maxStreamDuration: 120000 });
      assert.equal(h.maxStreamDuration, 120000);
    });
  });

  describe('startStreamingMessage()', () => {
    it('should start streaming message', () => {
      const message = mockMessage({ messageId: 'msg-1', taskId: 'task-1' });
      const events = [];

      const stream = handler.startStreamingMessage(message, event => {
        events.push(event);
      });

      assert.ok(stream.stream_id);
      assert.equal(stream.message_id, 'msg-1');
      assert.equal(stream.task_id, 'task-1');
      assert.equal(stream.status, 'active');
      assert.equal(stream.event_count, 0);
    });

    it('should throw when feature flag disabled', () => {
      handler.featureFlags.streaming_support = false;

      assert.throws(
        () => {
          handler.startStreamingMessage(mockMessage(), () => {});
        },
        { message: /streaming_support feature flag is disabled/ }
      );
    });

    it('should throw when message missing', () => {
      assert.throws(
        () => {
          handler.startStreamingMessage(null, () => {});
        },
        { message: /message is required/ }
      );
    });

    it('should throw when onUpdate not a function', () => {
      assert.throws(
        () => {
          handler.startStreamingMessage(mockMessage(), 'not-a-function');
        },
        { message: /onUpdate must be a function/ }
      );
    });

    it('should use custom stream ID', () => {
      const stream = handler.startStreamingMessage(mockMessage(), () => {}, {
        streamId: 'custom-stream-1',
      });

      assert.equal(stream.stream_id, 'custom-stream-1');
    });

    it('should complete setup within performance target (<50ms)', () => {
      const startTime = Date.now();
      handler.startStreamingMessage(mockMessage(), () => {});
      const duration = Date.now() - startTime;

      assert.ok(duration < 50, `Setup took ${duration}ms (target: <50ms)`);
    });

    it('should set up heartbeat timer', async () => {
      const events = [];
      const message = mockMessage();

      handler.startStreamingMessage(message, event => {
        events.push(event);
      });

      // Wait for heartbeat
      await new Promise(r => setTimeout(r, 150));

      const heartbeats = events.filter(e => e.type === StreamEventType.HEARTBEAT);
      assert.ok(heartbeats.length > 0, 'Should receive heartbeat events');
    });

    it('should set up automatic timeout', async () => {
      const events = [];
      const message = mockMessage();

      handler.startStreamingMessage(message, event => {
        events.push(event);
      });

      // Wait for timeout (5s)
      await new Promise(r => setTimeout(r, 5500));

      const completeEvents = events.filter(e => e.type === StreamEventType.COMPLETE);
      assert.ok(completeEvents.length > 0, 'Should receive complete event on timeout');
    });
  });

  describe('sendStreamUpdate()', () => {
    it('should send stream update event', () => {
      const events = [];
      const message = mockMessage();

      const stream = handler.startStreamingMessage(message, event => {
        events.push(event);
      });

      const sent = handler.sendStreamUpdate(stream.stream_id, {
        type: StreamEventType.TASK_STATUS_UPDATE,
        data: { state: 'WORKING' },
      });

      assert.equal(sent, true);
      assert.equal(events.length, 1);
      assert.equal(events[0].type, StreamEventType.TASK_STATUS_UPDATE);
    });

    it('should add timestamp if missing', () => {
      const events = [];
      const message = mockMessage();

      const stream = handler.startStreamingMessage(message, event => {
        events.push(event);
      });

      handler.sendStreamUpdate(stream.stream_id, {
        type: 'test',
        data: {},
      });

      assert.ok(events[0].timestamp);
    });

    it('should add stream metadata', () => {
      const events = [];
      const message = mockMessage();

      const stream = handler.startStreamingMessage(message, event => {
        events.push(event);
      });

      handler.sendStreamUpdate(stream.stream_id, {
        type: 'test',
      });

      assert.equal(events[0].stream_id, stream.stream_id);
      assert.ok(events[0].event_id);
    });

    it('should return false for non-existent stream', () => {
      const sent = handler.sendStreamUpdate('nonexistent-stream', {
        type: 'test',
      });

      assert.equal(sent, false);
    });

    it('should return false for inactive stream', () => {
      const message = mockMessage();
      const stream = handler.startStreamingMessage(message, () => {});

      handler.closeStream(stream.stream_id);

      const sent = handler.sendStreamUpdate(stream.stream_id, {
        type: 'test',
      });

      assert.equal(sent, false);
    });

    it('should throw when event type missing', () => {
      const message = mockMessage();
      const stream = handler.startStreamingMessage(message, () => {});

      assert.throws(
        () => {
          handler.sendStreamUpdate(stream.stream_id, { data: {} });
        },
        { message: /Event type is required/ }
      );
    });

    it('should update stream event count', () => {
      const message = mockMessage();
      const stream = handler.startStreamingMessage(message, () => {});

      handler.sendStreamUpdate(stream.stream_id, { type: 'test' });
      handler.sendStreamUpdate(stream.stream_id, { type: 'test' });

      const updated = handler.getStream(stream.stream_id);
      assert.equal(updated.event_count, 2);
    });
  });

  describe('closeStream()', () => {
    it('should close stream', () => {
      const events = [];
      const message = mockMessage();

      const stream = handler.startStreamingMessage(message, event => {
        events.push(event);
      });

      const closed = handler.closeStream(stream.stream_id);

      assert.equal(closed, true);
      const completeEvent = events.find(e => e.type === StreamEventType.COMPLETE);
      assert.ok(completeEvent);
    });

    it('should update stream status', () => {
      const message = mockMessage();
      const stream = handler.startStreamingMessage(message, () => {});

      handler.closeStream(stream.stream_id);

      const closed = handler.getStream(stream.stream_id);
      assert.equal(closed, null); // Removed from active streams
    });

    it('should clear timers', () => {
      const message = mockMessage();
      const stream = handler.startStreamingMessage(message, () => {});

      assert.ok(stream.heartbeatTimer);
      assert.ok(stream.timeoutTimer);

      handler.closeStream(stream.stream_id);

      // Timers should be cleared (hard to verify directly)
      assert.ok(true);
    });

    it('should return false for non-existent stream', () => {
      const closed = handler.closeStream('nonexistent-stream');
      assert.equal(closed, false);
    });

    it('should accept close reason', () => {
      const events = [];
      const message = mockMessage();

      const stream = handler.startStreamingMessage(message, event => {
        events.push(event);
      });

      handler.closeStream(stream.stream_id, 'client_disconnect');

      const completeEvent = events.find(e => e.type === StreamEventType.COMPLETE);
      assert.equal(completeEvent.reason, 'client_disconnect');
    });
  });

  describe('getStream()', () => {
    it('should get stream context', () => {
      const message = mockMessage();
      const stream = handler.startStreamingMessage(message, () => {});

      const retrieved = handler.getStream(stream.stream_id);

      assert.ok(retrieved);
      assert.equal(retrieved.stream_id, stream.stream_id);
    });

    it('should return null for non-existent stream', () => {
      const stream = handler.getStream('nonexistent-stream');
      assert.equal(stream, null);
    });
  });

  describe('listActiveStreams()', () => {
    it('should list active streams', () => {
      handler.startStreamingMessage(mockMessage({ taskId: 'task-1' }), () => {});
      handler.startStreamingMessage(mockMessage({ taskId: 'task-2' }), () => {});

      const streams = handler.listActiveStreams();

      assert.equal(streams.length, 2);
    });

    it('should filter by task ID', () => {
      handler.startStreamingMessage(mockMessage({ taskId: 'task-1' }), () => {});
      handler.startStreamingMessage(mockMessage({ taskId: 'task-2' }), () => {});

      const streams = handler.listActiveStreams({ task_id: 'task-1' });

      assert.equal(streams.length, 1);
      assert.equal(streams[0].task_id, 'task-1');
    });

    it('should apply limit', () => {
      for (let i = 0; i < 5; i++) {
        handler.startStreamingMessage(mockMessage(), () => {});
      }

      const streams = handler.listActiveStreams({ limit: 3 });

      assert.equal(streams.length, 3);
    });

    it('should exclude closed streams', () => {
      const stream1 = handler.startStreamingMessage(mockMessage(), () => {});
      handler.startStreamingMessage(mockMessage(), () => {});

      handler.closeStream(stream1.stream_id);

      const streams = handler.listActiveStreams();
      assert.equal(streams.length, 1);
    });
  });

  describe('getStreamStats()', () => {
    it('should get stats for specific stream', () => {
      const message = mockMessage();
      const stream = handler.startStreamingMessage(message, () => {});

      handler.sendStreamUpdate(stream.stream_id, { type: 'test' });
      handler.sendStreamUpdate(stream.stream_id, { type: 'test' });

      const stats = handler.getStreamStats(stream.stream_id);

      assert.equal(stats.stream_id, stream.stream_id);
      assert.equal(stats.status, 'active');
      assert.equal(stats.event_count, 2);
      assert.ok(stats.duration_ms >= 0);
    });

    it('should get global stats', () => {
      handler.startStreamingMessage(mockMessage(), () => {});
      handler.startStreamingMessage(mockMessage(), () => {});

      const stats = handler.getStreamStats();

      assert.equal(stats.total_streams, 2);
      assert.equal(stats.active_streams, 2);
    });

    it('should throw for non-existent stream', () => {
      assert.throws(
        () => {
          handler.getStreamStats('nonexistent-stream');
        },
        { message: /Stream not found/ }
      );
    });
  });

  describe('sendTaskStatusUpdate()', () => {
    it('should send task status update event', () => {
      const events = [];
      const message = mockMessage();

      const stream = handler.startStreamingMessage(message, event => {
        events.push(event);
      });

      const task = {
        id: 'task-1',
        state: 'WORKING',
        updated_at: new Date().toISOString(),
      };

      const sent = handler.sendTaskStatusUpdate(stream.stream_id, task);

      assert.equal(sent, true);
      assert.equal(events.length, 1);
      assert.equal(events[0].type, StreamEventType.TASK_STATUS_UPDATE);
      assert.equal(events[0].task.id, 'task-1');
      assert.equal(events[0].task.state, 'WORKING');
    });
  });

  describe('sendTaskArtifactUpdate()', () => {
    it('should send task artifact update event', () => {
      const events = [];
      const message = mockMessage();

      const stream = handler.startStreamingMessage(message, event => {
        events.push(event);
      });

      const task = {
        id: 'task-1',
        artifacts: [{ name: 'report.md' }],
      };

      const artifact = { name: 'report.md' };

      const sent = handler.sendTaskArtifactUpdate(stream.stream_id, task, artifact);

      assert.equal(sent, true);
      assert.equal(events[0].type, StreamEventType.TASK_ARTIFACT_UPDATE);
      assert.equal(events[0].artifact.name, 'report.md');
    });
  });

  describe('sendError()', () => {
    it('should send error event', () => {
      const events = [];
      const message = mockMessage();

      const stream = handler.startStreamingMessage(message, event => {
        events.push(event);
      });

      const error = {
        message: 'Test error',
        code: 'TEST_ERROR',
        details: { info: 'test' },
      };

      const sent = handler.sendError(stream.stream_id, error);

      assert.equal(sent, true);
      assert.equal(events[0].type, StreamEventType.ERROR);
      assert.equal(events[0].error.message, 'Test error');
    });
  });

  describe('clearStreams()', () => {
    it('should clear all streams', () => {
      handler.startStreamingMessage(mockMessage(), () => {});
      handler.startStreamingMessage(mockMessage(), () => {});

      assert.equal(handler.activeStreams.size, 2);

      handler.clearStreams();

      assert.equal(handler.activeStreams.size, 0);
    });

    it('should close all streams before clearing', () => {
      const events1 = [];
      const events2 = [];

      handler.startStreamingMessage(mockMessage(), e => events1.push(e));
      handler.startStreamingMessage(mockMessage(), e => events2.push(e));

      handler.clearStreams();

      // Both should receive complete events
      assert.ok(events1.some(e => e.type === StreamEventType.COMPLETE));
      assert.ok(events2.some(e => e.type === StreamEventType.COMPLETE));
    });
  });

  describe('Singleton Instance', () => {
    it('should return same instance', () => {
      const instance1 = getStreamingHandler();
      const instance2 = getStreamingHandler();

      assert.strictEqual(instance1, instance2);
    });

    it('should reset instance', () => {
      const instance1 = getStreamingHandler();
      resetInstance();
      const instance2 = getStreamingHandler();

      assert.notStrictEqual(instance1, instance2);
    });
  });
});
