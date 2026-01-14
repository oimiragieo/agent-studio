/**
 * Streaming Handler
 *
 * Implements Server-Sent Events (SSE) streaming for real-time task updates.
 * Supports streaming message setup, event delivery, and connection management.
 *
 * Features:
 * - startStreamingMessage(): Initiate SSE connection
 * - sendStreamUpdate(): Send streaming events
 * - Connection management: Active stream tracking
 * - Event types: task_status_update, task_artifact_update, heartbeat
 * - Feature flag integration: streaming_support
 * - Performance target: <50ms streaming setup
 *
 * @module streaming-handler
 */

import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';
import { isEnabled } from '../feature-flags-manager.mjs';

/**
 * Active streaming connections (stream_id → stream context)
 */
const activeStreams = new Map();

/**
 * Heartbeat interval (30 seconds)
 */
const HEARTBEAT_INTERVAL_MS = 30000;

/**
 * Maximum stream duration (1 hour)
 */
const MAX_STREAM_DURATION_MS = 60 * 60 * 1000;

/**
 * Stream event types
 */
export const StreamEventType = Object.freeze({
  TASK_STATUS_UPDATE: 'task_status_update',
  TASK_ARTIFACT_UPDATE: 'task_artifact_update',
  TASK_MESSAGE: 'task_message',
  HEARTBEAT: 'heartbeat',
  ERROR: 'error',
  COMPLETE: 'complete',
});

/**
 * Streaming Handler
 *
 * Manages SSE streaming for real-time updates
 */
export class StreamingHandler {
  /**
   * @param {object} options - Configuration options
   */
  constructor(options = {}) {
    this.featureFlags = options.featureFlags || {
      streaming_support: process.env.STREAMING_SUPPORT === 'true' || false,
    };
    this.activeStreams = activeStreams;
    this.heartbeatInterval = options.heartbeatInterval || HEARTBEAT_INTERVAL_MS;
    this.maxStreamDuration = options.maxStreamDuration || MAX_STREAM_DURATION_MS;
  }

  /**
   * Start streaming message
   *
   * @param {object} message - A2A Message to stream
   * @param {function} onUpdate - Update callback
   * @param {object} options - Streaming options
   * @returns {object} Stream context
   */
  startStreamingMessage(message, onUpdate, options = {}) {
    const startTime = Date.now();

    const enabled =
      this.featureFlags.isEnabled?.('streaming_support') ?? this.featureFlags.streaming_support;
    if (!enabled) {
      throw new Error('streaming_support feature flag is disabled');
    }

    if (!message) {
      throw new Error('message is required');
    }

    if (typeof onUpdate !== 'function') {
      throw new Error('onUpdate must be a function');
    }

    // Generate stream ID
    const streamId = options.streamId || `stream-${randomUUID()}`;

    // Create event emitter for stream
    const emitter = new EventEmitter();

    // Create stream context
    const streamContext = {
      stream_id: streamId,
      message_id: message.messageId,
      task_id: message.taskId,
      started_at: new Date().toISOString(),
      event_count: 0,
      last_event_at: null,
      status: 'active',
      emitter,
      onUpdate,
    };

    // Store stream
    this.activeStreams.set(streamId, streamContext);

    // Set up event listener
    emitter.on('event', event => {
      streamContext.event_count++;
      streamContext.last_event_at = new Date().toISOString();

      // Call update callback
      onUpdate(event);
    });

    // Set up heartbeat
    const heartbeatTimer = setInterval(() => {
      if (streamContext.status === 'active') {
        this.sendStreamUpdate(streamId, {
          type: StreamEventType.HEARTBEAT,
          timestamp: new Date().toISOString(),
        });
      }
    }, this.heartbeatInterval);

    streamContext.heartbeatTimer = heartbeatTimer;

    // Set up automatic timeout
    const timeoutTimer = setTimeout(() => {
      console.log(`[Streaming] Stream ${streamId} timed out after ${this.maxStreamDuration}ms`);
      this.closeStream(streamId, 'timeout');
    }, this.maxStreamDuration);

    streamContext.timeoutTimer = timeoutTimer;

    const duration = Date.now() - startTime;

    console.log(
      `[Streaming] Started stream ${streamId} for message ${message.messageId} (${duration}ms)`
    );

    return streamContext;
  }

  /**
   * Send stream update event
   *
   * @param {string} streamId - Stream ID
   * @param {object} event - Event data
   * @returns {boolean} True if sent
   */
  sendStreamUpdate(streamId, event) {
    const stream = this.activeStreams.get(streamId);

    if (!stream) {
      console.warn(`[Streaming] Stream ${streamId} not found`);
      return false;
    }

    if (stream.status !== 'active') {
      console.warn(`[Streaming] Stream ${streamId} is not active (${stream.status})`);
      return false;
    }

    // Validate event
    if (!event.type) {
      throw new Error('Event type is required');
    }

    // Add timestamp if not present
    if (!event.timestamp) {
      event.timestamp = new Date().toISOString();
    }

    // Add stream metadata
    event.stream_id = streamId;
    event.event_id = `event-${randomUUID()}`;

    // Emit event
    stream.emitter.emit('event', event);

    // console.log(`[Streaming] Sent ${event.type} to stream ${streamId}`);

    return true;
  }

  /**
   * Close stream
   *
   * @param {string} streamId - Stream ID
   * @param {string} reason - Close reason
   * @returns {boolean} True if closed
   */
  closeStream(streamId, reason = 'complete') {
    const stream = this.activeStreams.get(streamId);

    if (!stream) {
      console.warn(`[Streaming] Stream ${streamId} not found`);
      return false;
    }

    // Send completion event
    this.sendStreamUpdate(streamId, {
      type: StreamEventType.COMPLETE,
      reason,
      timestamp: new Date().toISOString(),
    });

    // Update status
    stream.status = 'closed';
    stream.closed_at = new Date().toISOString();

    // Clear timers
    if (stream.heartbeatTimer) {
      clearInterval(stream.heartbeatTimer);
    }

    if (stream.timeoutTimer) {
      clearTimeout(stream.timeoutTimer);
    }

    // Remove all listeners
    stream.emitter.removeAllListeners();

    // Remove from active streams
    this.activeStreams.delete(streamId);

    console.log(`[Streaming] Closed stream ${streamId} (reason: ${reason})`);

    return true;
  }

  /**
   * Get stream context
   *
   * @param {string} streamId - Stream ID
   * @returns {object|null} Stream context
   */
  getStream(streamId) {
    return this.activeStreams.get(streamId) || null;
  }

  /**
   * List active streams
   *
   * @param {object} filters - Filter options
   * @returns {Array} Active streams
   */
  listActiveStreams(filters = {}) {
    let streams = Array.from(this.activeStreams.values()).filter(s => s.status === 'active');

    // Filter by task ID
    if (filters.task_id) {
      streams = streams.filter(s => s.task_id === filters.task_id);
    }

    // Apply limit
    if (filters.limit) {
      streams = streams.slice(0, filters.limit);
    }

    return streams;
  }

  /**
   * Get stream statistics
   *
   * @param {string} streamId - Stream ID (optional)
   * @returns {object} Stream stats
   */
  getStreamStats(streamId = null) {
    if (streamId) {
      const stream = this.activeStreams.get(streamId);
      if (!stream) {
        throw new Error(`Stream not found: ${streamId}`);
      }

      const now = Date.now();
      const startTime = new Date(stream.started_at).getTime();
      const duration = now - startTime;

      return {
        stream_id: streamId,
        status: stream.status,
        event_count: stream.event_count,
        duration_ms: duration,
        started_at: stream.started_at,
        last_event_at: stream.last_event_at,
        closed_at: stream.closed_at,
      };
    }

    // Global stats
    const allStreams = Array.from(this.activeStreams.values());
    const activeCount = allStreams.filter(s => s.status === 'active').length;
    const totalEvents = allStreams.reduce((sum, s) => sum + s.event_count, 0);

    return {
      total_streams: this.activeStreams.size,
      active_streams: activeCount,
      total_events: totalEvents,
      average_events_per_stream:
        this.activeStreams.size > 0 ? totalEvents / this.activeStreams.size : 0,
    };
  }

  /**
   * Send task status update event
   *
   * @param {string} streamId - Stream ID
   * @param {object} task - Task object
   * @returns {boolean} True if sent
   */
  sendTaskStatusUpdate(streamId, task) {
    return this.sendStreamUpdate(streamId, {
      type: StreamEventType.TASK_STATUS_UPDATE,
      task: {
        id: task.id,
        state: task.state,
        updated_at: task.updated_at,
      },
    });
  }

  /**
   * Send task artifact update event
   *
   * @param {string} streamId - Stream ID
   * @param {object} task - Task object
   * @param {object} artifact - Artifact object
   * @returns {boolean} True if sent
   */
  sendTaskArtifactUpdate(streamId, task, artifact) {
    return this.sendStreamUpdate(streamId, {
      type: StreamEventType.TASK_ARTIFACT_UPDATE,
      task: {
        id: task.id,
        artifacts: task.artifacts,
      },
      artifact,
    });
  }

  /**
   * Send task message event
   *
   * @param {string} streamId - Stream ID
   * @param {object} message - A2A Message
   * @returns {boolean} True if sent
   */
  sendTaskMessage(streamId, message) {
    return this.sendStreamUpdate(streamId, {
      type: StreamEventType.TASK_MESSAGE,
      message,
    });
  }

  /**
   * Send error event
   *
   * @param {string} streamId - Stream ID
   * @param {object} error - Error object
   * @returns {boolean} True if sent
   */
  sendError(streamId, error) {
    return this.sendStreamUpdate(streamId, {
      type: StreamEventType.ERROR,
      error: {
        message: error.message,
        code: error.code,
        details: error.details,
      },
    });
  }

  /**
   * Clear all streams (for testing)
   */
  clearStreams() {
    // Close all active streams
    for (const streamId of this.activeStreams.keys()) {
      this.closeStream(streamId, 'clear');
    }

    this.activeStreams.clear();
  }
}

/**
 * Create Streaming Handler
 *
 * @param {object} options - Configuration options
 * @returns {StreamingHandler}
 */
export function createStreamingHandler(options = {}) {
  return new StreamingHandler(options);
}

/**
 * Singleton instance
 */
let instance = null;

/**
 * Get or create singleton instance
 *
 * @param {object} options - Configuration options
 * @returns {StreamingHandler}
 */
export function getStreamingHandler(options = {}) {
  if (!instance) {
    instance = new StreamingHandler(options);
  }
  return instance;
}

/**
 * Reset singleton instance (for testing)
 */
export function resetInstance() {
  if (instance) {
    instance.clearStreams();
  }
  instance = null;
  activeStreams.clear();
}

export default {
  StreamingHandler,
  StreamEventType,
  createStreamingHandler,
  getStreamingHandler,
  resetInstance,
};
