/**
 * Worker Thread Entry Point
 *
 * Runs in isolated Worker Thread with own V8 heap.
 * Executes agent tasks with memory monitoring and DB state persistence.
 *
 * Lifecycle:
 * 1. Initialize from workerData
 * 2. Connect to shared SQLite database
 * 3. Update status to 'running'
 * 4. Execute agent task (placeholder for now)
 * 5. Report memory usage every 10s
 * 6. Save result/error to DB
 * 7. Communicate completion to parent
 * 8. Exit cleanly (memory 100% reclaimed)
 *
 * @module worker-thread
 * @version 1.0.0
 * @created 2025-01-12
 */

import { parentPort, workerData } from 'worker_threads';
import { WorkerDatabase } from './worker-db.mjs';

/**
 * Memory usage reporting interval (milliseconds)
 */
const MEMORY_REPORT_INTERVAL = 10000; // 10 seconds

/**
 * Heap usage threshold for manual GC trigger (percentage)
 */
const GC_THRESHOLD = 80;

/**
 * Worker entry point - runs in isolated thread
 */
async function runWorkerTask() {
  const { sessionId, agentType, taskDescription, supervisorId } = workerData;

  // Validate required workerData
  if (!sessionId || !agentType || !supervisorId) {
    console.error('Missing required workerData:', { sessionId, agentType, supervisorId });
    parentPort.postMessage({
      type: 'error',
      sessionId,
      error: 'Missing required workerData (sessionId, agentType, supervisorId)',
    });
    process.exit(1);
  }

  const db = new WorkerDatabase();
  let memoryInterval = null;

  try {
    // Initialize database connection
    await db.initialize();

    // Update status to running
    await db.updateWorkerStatus(sessionId, 'running', {
      started_at: new Date().toISOString(),
    });

    // Notify parent of startup
    parentPort.postMessage({
      type: 'started',
      sessionId,
      agentType,
      timestamp: new Date().toISOString(),
    });

    // Start memory monitoring (report every 10 seconds)
    memoryInterval = startMemoryMonitoring(sessionId);

    // Record start time for execution duration
    const startTime = Date.now();

    // Execute agent task (placeholder - will integrate with actual agent logic)
    const result = await executeAgentTask(agentType, taskDescription);

    // Calculate execution time
    const executionTime = Date.now() - startTime;

    // Stop memory monitoring
    if (memoryInterval) {
      clearInterval(memoryInterval);
    }

    // Get peak memory usage
    const memUsage = process.memoryUsage();
    const memoryPeakMb = memUsage.heapUsed / 1024 / 1024;

    // Update status to completed
    await db.updateWorkerStatus(sessionId, 'completed', {
      result_json: result,
      ended_at: new Date().toISOString(),
      memory_peak_mb: memoryPeakMb,
      execution_time_ms: executionTime,
    });

    // Report success to parent
    parentPort.postMessage({
      type: 'result',
      sessionId,
      data: result,
      executionTime,
      memoryPeakMb,
    });
  } catch (error) {
    // Stop memory monitoring on error
    if (memoryInterval) {
      clearInterval(memoryInterval);
    }

    // Log error details
    console.error('Worker task failed:', {
      sessionId,
      agentType,
      error: error.message,
      stack: error.stack,
    });

    // Update status to failed
    await db.updateWorkerStatus(sessionId, 'failed', {
      error_message: error.message,
      ended_at: new Date().toISOString(),
    });

    // Report error to parent
    parentPort.postMessage({
      type: 'error',
      sessionId,
      error: error.message,
      stack: error.stack,
    });

    // Exit with error code
    process.exit(1);
  } finally {
    // Clean up database connection
    await db.close();
  }
}

/**
 * Start memory monitoring with periodic reporting to parent
 * @param {string} sessionId - Worker session identifier
 * @returns {NodeJS.Timeout} Interval handle for cleanup
 */
function startMemoryMonitoring(sessionId) {
  return setInterval(() => {
    const memUsage = process.memoryUsage();

    // Calculate metrics
    const heapUsedMb = memUsage.heapUsed / 1024 / 1024;
    const heapTotalMb = memUsage.heapTotal / 1024 / 1024;
    const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    const externalMb = memUsage.external / 1024 / 1024;
    const rss = memUsage.rss / 1024 / 1024;

    // Report to parent
    parentPort.postMessage({
      type: 'memory_report',
      sessionId,
      timestamp: new Date().toISOString(),
      data: {
        heapUsed: heapUsedMb,
        heapTotal: heapTotalMb,
        heapUsedPercent,
        external: externalMb,
        rss,
      },
    });

    // Trigger manual GC if available and heap usage exceeds threshold
    if (global.gc && heapUsedPercent > GC_THRESHOLD) {
      console.log(
        `Worker ${sessionId}: Heap usage ${heapUsedPercent.toFixed(2)}% exceeds threshold ${GC_THRESHOLD}%, triggering manual GC`
      );
      global.gc();
    }
  }, MEMORY_REPORT_INTERVAL);
}

/**
 * Execute agent task
 * PLACEHOLDER: Will integrate with actual agent execution logic
 *
 * @param {string} agentType - Agent type (e.g., 'developer', 'analyst')
 * @param {string} taskDescription - Task description
 * @returns {Promise<object>} Task result
 */
async function executeAgentTask(agentType, taskDescription) {
  // Placeholder implementation
  // In production, this will:
  // 1. Load context from database (via context-manager.mjs)
  // 2. Execute agent-specific logic
  // 3. Save intermediate results to database
  // 4. Return final result

  // Simulate task execution with delay
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Return mock result
  return {
    success: true,
    agentType,
    task: taskDescription,
    timestamp: new Date().toISOString(),
    message: `Agent task executed successfully (PLACEHOLDER)`,
  };
}

/**
 * Handle graceful shutdown on SIGTERM
 */
process.on('SIGTERM', async () => {
  console.log(`Worker ${workerData.sessionId}: Received SIGTERM, shutting down gracefully`);

  // Notify parent of termination
  parentPort.postMessage({
    type: 'terminated',
    sessionId: workerData.sessionId,
    reason: 'SIGTERM',
  });

  // Exit cleanly
  process.exit(0);
});

/**
 * Handle uncaught errors
 */
process.on('uncaughtException', async (error) => {
  console.error(`Worker ${workerData.sessionId}: Uncaught exception:`, error);

  // Notify parent of fatal error
  parentPort.postMessage({
    type: 'fatal_error',
    sessionId: workerData.sessionId,
    error: error.message,
    stack: error.stack,
  });

  // Exit with error code
  process.exit(1);
});

/**
 * Handle unhandled promise rejections
 */
process.on('unhandledRejection', async (reason, promise) => {
  console.error(`Worker ${workerData.sessionId}: Unhandled promise rejection:`, reason);

  // Notify parent of fatal error
  parentPort.postMessage({
    type: 'FATAL_ERROR',
    sessionId: workerData.sessionId,
    error: reason?.message || String(reason),
    stack: reason?.stack,
  });

  // Exit with error code
  process.exit(1);
});

// Start worker task execution
runWorkerTask().catch((error) => {
  console.error(`Worker ${workerData.sessionId}: Fatal error in runWorkerTask:`, error);

  // Notify parent
  parentPort.postMessage({
    type: 'FATAL_ERROR',
    sessionId: workerData.sessionId,
    error: error.message,
    stack: error.stack,
  });

  // Exit with error code
  process.exit(1);
});
