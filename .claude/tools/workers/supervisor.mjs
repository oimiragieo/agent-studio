/**
 * Agent Supervisor - Worker Thread Manager
 *
 * Manages ephemeral worker threads for agent task execution.
 * Implements Supervisor-Worker pattern with memory isolation.
 *
 * Key Features:
 * - Spawn/terminate worker threads
 * - Track worker lifecycle in SQLite
 * - Automatic worker cleanup after completion
 * - Pool management (max concurrent workers)
 * - Worker crash recovery (supervisor survives)
 *
 * @module supervisor
 * @version 1.0.0
 * @created 2025-01-12
 */

import { Worker } from 'worker_threads';
import { WorkerDatabase } from './worker-db.mjs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveRuntimePath } from '../context-path-resolver.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Agent Supervisor - Manages worker thread pool
 */
export class AgentSupervisor {
  /**
   * Initialize supervisor
   * @param {object} options - Configuration options
   * @param {string} options.dbPath - Path to SQLite database
   * @param {number} options.maxWorkers - Maximum concurrent workers
   * @param {number} options.heapLimit - Heap limit per worker (MB)
   * @param {number} options.timeout - Worker timeout (ms)
   */
  constructor(options = {}) {
    this.dbPath = options.dbPath || resolveRuntimePath('memory/workers.db', { write: true });
    this.db = new WorkerDatabase(this.dbPath);
    this.maxWorkers = options.maxWorkers || 4;
    this.heapLimit = options.heapLimit || 4096; // 4GB per worker
    this.timeout = options.timeout || 600000; // 10 minutes default
    this.supervisorId = `supervisor-${Date.now()}`;

    // Active workers map: sessionId -> { worker, startTime, timeoutHandle }
    this.activeWorkers = new Map();

    // Task queue for when max workers reached
    this.taskQueue = [];

    // Metrics
    this.metrics = {
      workersSpawned: 0,
      workersCompleted: 0,
      workersFailed: 0,
      workersTimedOut: 0,
    };
  }

  /**
   * Initialize supervisor and database
   * @returns {Promise<void>}
   */
  async initialize() {
    await this.db.initialize();
    this._log('info', 'Supervisor initialized', {
      supervisorId: this.supervisorId,
      maxWorkers: this.maxWorkers,
      heapLimit: this.heapLimit,
    });
  }

  /**
   * Spawn a worker thread for agent task
   * @param {string} agentType - Agent type (e.g., 'developer', 'analyst')
   * @param {string} taskDescription - Task description
   * @param {object} taskPayload - Additional task data (kept minimal)
   * @returns {Promise<string>} Session ID
   */
  async spawnWorker(agentType, taskDescription, taskPayload = {}) {
    // Check if max workers reached
    if (this.activeWorkers.size >= this.maxWorkers) {
      this._log('warn', 'Max workers reached, queueing task', {
        activeWorkers: this.activeWorkers.size,
        maxWorkers: this.maxWorkers,
      });

      return new Promise((resolve, reject) => {
        this.taskQueue.push({ agentType, taskDescription, taskPayload, resolve, reject });
      });
    }

    // Create session in database
    const sessionId = this.db.createWorkerSession(this.supervisorId, agentType, taskDescription);

    this._log('info', 'Creating worker session', {
      sessionId,
      agentType,
      queueLength: this.taskQueue.length,
    });

    try {
      // Spawn worker thread
      const worker = await this._createWorker(sessionId, agentType, taskDescription, taskPayload);

      // Update metrics
      this.metrics.workersSpawned++;

      return sessionId;
    } catch (error) {
      // Update session as failed
      this.db.updateWorkerStatus(sessionId, 'failed', {
        error_message: error.message,
      });

      this._log('error', 'Failed to spawn worker', {
        sessionId,
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Create worker thread with proper configuration
   * @private
   * @param {string} sessionId - Session identifier
   * @param {string} agentType - Agent type
   * @param {string} taskDescription - Task description
   * @param {object} taskPayload - Task payload
   * @returns {Promise<Worker>} Worker instance
   */
  async _createWorker(sessionId, agentType, taskDescription, taskPayload) {
    return new Promise((resolve, reject) => {
      const workerPath = path.join(__dirname, 'worker-thread.mjs');

      // Worker configuration
      const workerOptions = {
        workerData: {
          sessionId,
          dbPath: this.dbPath,
          agentType,
          taskDescription,
          supervisorId: this.supervisorId,
          taskPayload: JSON.stringify(taskPayload), // Serialize to keep minimal
        },
        resourceLimits: {
          maxOldGenerationSizeMb: this.heapLimit,
          maxYoungGenerationSizeMb: Math.floor(this.heapLimit / 4),
          codeRangeSizeMb: 64,
          stackSizeMb: 4,
        },
      };

      try {
        const worker = new Worker(workerPath, workerOptions);
        const startTime = Date.now();

        // Set timeout
        const timeoutHandle = setTimeout(() => {
          this._handleWorkerTimeout(sessionId, worker);
        }, this.timeout);

        // Track worker
        this.activeWorkers.set(sessionId, {
          worker,
          startTime,
          timeoutHandle,
          agentType,
        });

        // Update status to running
        this.db.updateWorkerStatus(sessionId, 'running');

        // Handle worker messages
        worker.on('message', message => {
          this._handleWorkerMessage(sessionId, message);
        });

        // Handle worker errors
        worker.on('error', error => {
          this._handleWorkerError(sessionId, error);
        });

        // Handle worker exit
        worker.on('exit', code => {
          this._handleWorkerExit(sessionId, code);
        });

        this._log('info', 'Worker spawned', {
          sessionId,
          agentType,
          workerPath,
        });

        resolve(worker);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle worker message
   * @private
   * @param {string} sessionId - Session identifier
   * @param {object} message - Message from worker
   */
  _handleWorkerMessage(sessionId, message) {
    const { type, data } = message;

    this._log('debug', 'Worker message received', {
      sessionId,
      type,
    });

    switch (type) {
      case 'progress':
        // Progress update (could log or update DB)
        this._log('info', 'Worker progress', {
          sessionId,
          progress: data,
        });
        break;

      case 'result':
        // Task completed successfully
        this._handleWorkerSuccess(sessionId, data);
        break;

      case 'error':
        // Task failed
        this._handleWorkerFailure(sessionId, data.error);
        break;

      case 'memory_report':
        // Log memory metrics
        const { heapUsed, heapTotal, heapUsedPercent } = data;
        this._log('info', 'Worker memory report', {
          sessionId,
          heapUsed: `${heapUsed.toFixed(2)}MB`,
          heapTotal: `${heapTotal.toFixed(2)}MB`,
          heapUsedPercent: `${heapUsedPercent.toFixed(2)}%`,
        });

        // Warn if high memory usage
        if (heapUsedPercent > 80) {
          this._log('warn', 'Worker high memory usage', {
            sessionId,
            heapUsedPercent: `${heapUsedPercent.toFixed(2)}%`,
          });
        }
        break;

      default:
        this._log('warn', 'Unknown message type', {
          sessionId,
          type,
        });
    }
  }

  /**
   * Handle worker success
   * @private
   * @param {string} sessionId - Session identifier
   * @param {object} result - Result data
   */
  _handleWorkerSuccess(sessionId, result) {
    const workerInfo = this.activeWorkers.get(sessionId);
    if (!workerInfo) return;

    const executionTime = Date.now() - workerInfo.startTime;

    // Update database
    this.db.updateWorkerStatus(sessionId, 'completed', {
      result_json: result,
      execution_time_ms: executionTime,
    });

    this._log('info', 'Worker completed successfully', {
      sessionId,
      executionTime,
    });

    // Update metrics
    this.metrics.workersCompleted++;

    // Cleanup will happen on exit
  }

  /**
   * Handle worker failure
   * @private
   * @param {string} sessionId - Session identifier
   * @param {string} errorMessage - Error message
   */
  _handleWorkerFailure(sessionId, errorMessage) {
    const workerInfo = this.activeWorkers.get(sessionId);
    if (!workerInfo) return;

    const executionTime = Date.now() - workerInfo.startTime;

    // Update database
    this.db.updateWorkerStatus(sessionId, 'failed', {
      error_message: errorMessage,
      execution_time_ms: executionTime,
    });

    this._log('error', 'Worker failed', {
      sessionId,
      error: errorMessage,
      executionTime,
    });

    // Update metrics
    this.metrics.workersFailed++;

    // Cleanup will happen on exit
  }

  /**
   * Handle worker error
   * @private
   * @param {string} sessionId - Session identifier
   * @param {Error} error - Error object
   */
  _handleWorkerError(sessionId, error) {
    this._log('error', 'Worker error', {
      sessionId,
      error: error.message,
      stack: error.stack,
    });

    // Update as failed
    this._handleWorkerFailure(sessionId, error.message);
  }

  /**
   * Handle worker exit
   * @private
   * @param {string} sessionId - Session identifier
   * @param {number} exitCode - Exit code
   */
  _handleWorkerExit(sessionId, exitCode) {
    const workerInfo = this.activeWorkers.get(sessionId);
    if (!workerInfo) return;

    // Clear timeout
    if (workerInfo.timeoutHandle) {
      clearTimeout(workerInfo.timeoutHandle);
    }

    // Remove from active workers
    this.activeWorkers.delete(sessionId);

    this._log('info', 'Worker exited', {
      sessionId,
      exitCode,
      activeWorkers: this.activeWorkers.size,
    });

    // Process queued tasks
    this._processQueue();
  }

  /**
   * Handle worker timeout
   * @private
   * @param {string} sessionId - Session identifier
   * @param {Worker} worker - Worker instance
   */
  _handleWorkerTimeout(sessionId, worker) {
    this._log('warn', 'Worker timeout', {
      sessionId,
      timeout: this.timeout,
    });

    // Update database
    this.db.updateWorkerStatus(sessionId, 'failed', {
      error_message: `Worker timeout after ${this.timeout}ms`,
    });

    // Terminate worker forcefully
    worker.terminate();

    // Update metrics
    this.metrics.workersTimedOut++;
  }

  /**
   * Terminate a specific worker
   * @param {string} sessionId - Session identifier
   * @returns {Promise<void>}
   */
  async terminateWorker(sessionId) {
    const workerInfo = this.activeWorkers.get(sessionId);
    if (!workerInfo) {
      this._log('warn', 'Worker not found for termination', { sessionId });
      return;
    }

    this._log('info', 'Terminating worker', { sessionId });

    // Clear timeout
    if (workerInfo.timeoutHandle) {
      clearTimeout(workerInfo.timeoutHandle);
    }

    // Terminate worker
    await workerInfo.worker.terminate();

    // Update status
    this.db.updateWorkerStatus(sessionId, 'failed', {
      error_message: 'Worker manually terminated',
    });

    // Remove from active workers
    this.activeWorkers.delete(sessionId);
  }

  /**
   * Get worker session result
   * @param {string} sessionId - Session identifier
   * @returns {object|null} Session data
   */
  getResult(sessionId) {
    const session = this.db.getWorkerSession(sessionId);
    if (!session) return null;

    // Parse result_json if present
    if (session.result_json) {
      try {
        session.result = JSON.parse(session.result_json);
      } catch (error) {
        this._log('warn', 'Failed to parse result JSON', {
          sessionId,
          error: error.message,
        });
      }
    }

    return session;
  }

  /**
   * Wait for worker completion
   * @param {string} sessionId - Session identifier
   * @param {object} options - Wait options
   * @param {number} options.pollInterval - Poll interval (ms)
   * @param {number} options.timeout - Wait timeout (ms)
   * @returns {Promise<object>} Result data
   */
  async waitForCompletion(sessionId, options = {}) {
    const pollInterval = options.pollInterval || 500;
    const timeout = options.timeout || this.timeout;
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const poll = setInterval(() => {
        const session = this.getResult(sessionId);

        if (!session) {
          clearInterval(poll);
          reject(new Error(`Session ${sessionId} not found`));
          return;
        }

        // Check if completed or failed
        if (session.status === 'completed') {
          clearInterval(poll);
          resolve(session);
          return;
        }

        if (session.status === 'failed') {
          clearInterval(poll);
          reject(new Error(session.error_message || 'Worker failed'));
          return;
        }

        // Check timeout
        if (Date.now() - startTime > timeout) {
          clearInterval(poll);
          reject(new Error(`Wait timeout after ${timeout}ms`));
        }
      }, pollInterval);
    });
  }

  /**
   * Process queued tasks
   * @private
   */
  _processQueue() {
    if (this.taskQueue.length === 0) return;
    if (this.activeWorkers.size >= this.maxWorkers) return;

    const task = this.taskQueue.shift();
    if (!task) return;

    this._log('info', 'Processing queued task', {
      queueLength: this.taskQueue.length,
    });

    // Spawn worker for queued task
    this.spawnWorker(task.agentType, task.taskDescription, task.taskPayload)
      .then(sessionId => task.resolve(sessionId))
      .catch(error => task.reject(error));
  }

  /**
   * Get supervisor metrics
   * @returns {object} Metrics data
   */
  getMetrics() {
    return {
      ...this.metrics,
      activeWorkers: this.activeWorkers.size,
      queuedTasks: this.taskQueue.length,
      supervisorId: this.supervisorId,
    };
  }

  /**
   * Cleanup supervisor and terminate all workers
   * @returns {Promise<void>}
   */
  async cleanup() {
    this._log('info', 'Supervisor cleanup started', {
      activeWorkers: this.activeWorkers.size,
    });

    // Terminate all active workers
    const terminationPromises = Array.from(this.activeWorkers.keys()).map(sessionId =>
      this.terminateWorker(sessionId)
    );

    await Promise.all(terminationPromises);

    // Close database
    this.db.close();

    this._log('info', 'Supervisor cleanup completed');
  }

  /**
   * Log message with structured format
   * @private
   * @param {string} level - Log level (info, warn, error, debug)
   * @param {string} message - Log message
   * @param {object} metadata - Additional metadata
   */
  _log(level, message, metadata = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      component: 'supervisor',
      supervisorId: this.supervisorId,
      message,
      ...metadata,
    };

    console.log(JSON.stringify(logEntry));
  }
}

export default AgentSupervisor;
