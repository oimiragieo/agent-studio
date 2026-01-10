#!/usr/bin/env node
/**
 * Memory Pressure Event Handler
 * Monitors heap usage and triggers callbacks when pressure thresholds are exceeded
 *
 * Features:
 * - Configurable thresholds (80% high, 90% critical)
 * - 10-second polling interval
 * - Returns cleanup function
 * - Provides detailed memory statistics
 */

import v8 from 'v8';

const DEFAULT_HIGH_THRESHOLD = 0.75;  // 75% RSS usage (lowered from 80%)
const DEFAULT_CRITICAL_THRESHOLD = 0.85;  // 85% RSS usage (lowered from 90%)
const DEFAULT_CHECK_INTERVAL_MS = 10000;  // 10 seconds

/**
 * Setup memory pressure monitoring
 * @param {Function} onPressure - Callback function (level, usage, stats)
 * @param {Object} options - Configuration options
 * @param {number} options.highThreshold - High pressure threshold (0-1, default: 0.8)
 * @param {number} options.criticalThreshold - Critical pressure threshold (0-1, default: 0.9)
 * @param {number} options.checkIntervalMs - Polling interval (default: 10000ms)
 * @returns {Function} Cleanup function to stop monitoring
 */
export function setupMemoryPressureHandling(onPressure, options = {}) {
  const {
    highThreshold = DEFAULT_HIGH_THRESHOLD,
    criticalThreshold = DEFAULT_CRITICAL_THRESHOLD,
    checkIntervalMs = DEFAULT_CHECK_INTERVAL_MS
  } = options;

  if (typeof onPressure !== 'function') {
    throw new Error('onPressure callback is required');
  }

  if (highThreshold >= criticalThreshold) {
    throw new Error('highThreshold must be less than criticalThreshold');
  }

  let lastLevel = null;

  // Monitor memory pressure via RSS (actual process memory)
  const checkInterval = setInterval(() => {
    // Use RSS instead of heap for pressure calculation
    const memUsage = process.memoryUsage();
    const maxRSSMB = 4096 * 1024 * 1024; // 4GB in bytes
    const usage = memUsage.rss / maxRSSMB;

    const stats = v8.getHeapStatistics(); // Keep for stats logging
    const memoryStats = {
      rssMB: memUsage.rss / 1024 / 1024,
      rssMaxMB: 4096,
      rssUsagePercent: usage * 100,
      heapUsedMB: stats.used_heap_size / 1024 / 1024,
      heapLimitMB: stats.heap_size_limit / 1024 / 1024,
      externalMB: memUsage.external / 1024 / 1024,
      timestamp: new Date().toISOString()
    };

    if (usage > criticalThreshold) {
      // Critical level (85%+)
      if (lastLevel !== 'critical') {
        console.warn('[Memory Pressure] Critical level reached');
        console.warn(`  RSS usage: ${memoryStats.rssMB.toFixed(2)}MB / ${memoryStats.rssMaxMB}MB (${memoryStats.rssUsagePercent.toFixed(1)}%)`);
        lastLevel = 'critical';

        // Aggressive cleanup (async but don't await to avoid blocking monitoring)
        (async () => {
          console.warn('[MemoryPressure] CRITICAL: Aggressive cleanup initiated');

          // Import cleanup utilities dynamically
          const { cleanupAllCaches } = await import('./memory-cleanup.mjs');

          // 1. Clear all caches
          cleanupAllCaches();

          // 2. Force double GC
          if (global.gc) {
            global.gc();
            await new Promise(resolve => setImmediate(resolve));
            global.gc();
          }

          // 3. Log memory before/after
          const beforeMem = process.memoryUsage();
          console.log(`[MemoryPressure] Before cleanup: RSS ${(beforeMem.rss / 1024 / 1024).toFixed(2)}MB`);

          await new Promise(resolve => setTimeout(resolve, 500));

          const afterMem = process.memoryUsage();
          console.log(`[MemoryPressure] After cleanup: RSS ${(afterMem.rss / 1024 / 1024).toFixed(2)}MB`);
          console.log(`[MemoryPressure] Freed: ${((beforeMem.rss - afterMem.rss) / 1024 / 1024).toFixed(2)}MB`);

          // 4. Check if cleanup was sufficient
          const maxRSSBytes = 4096 * 1024 * 1024;
          const currentPressure = (afterMem.rss / maxRSSBytes) * 100;
          if (currentPressure > 90) {
            console.error('[MemoryPressure] EMERGENCY: Cleanup insufficient, pressure still at ' + currentPressure.toFixed(1) + '%');
            console.error('[MemoryPressure] Consider:');
            console.error('  1. Reduce concurrent subagents');
            console.error('  2. Clear artifact registry');
            console.error('  3. Restart process');

            // Optional: Save emergency checkpoint (if user changes mind later)
            // const checkpointPath = await saveEmergencyCheckpoint();
            // console.error('[MemoryPressure] Emergency checkpoint saved: ' + checkpointPath);

            // Continue anyway (user requested aggressive cleanup and continue)
            console.warn('[MemoryPressure] Continuing despite high pressure (as requested)');
          } else {
            // Continue (user requested no checkpoint/exit)
            console.log('[MemoryPressure] Continuing after cleanup');
          }
        })();
      }
      onPressure('critical', usage, memoryStats);
    } else if (usage > highThreshold) {
      // High level (75%+)
      if (lastLevel !== 'high') {
        console.warn('[Memory Pressure] High level reached');
        console.warn(`  RSS usage: ${memoryStats.rssMB.toFixed(2)}MB / ${memoryStats.rssMaxMB}MB (${memoryStats.rssUsagePercent.toFixed(1)}%)`);
        lastLevel = 'high';
      }
      onPressure('high', usage, memoryStats);
    } else if (lastLevel !== null && usage <= highThreshold * 0.9) {
      // Recovered from pressure (10% below high threshold)
      console.log('[Memory Pressure] Normal level restored');
      lastLevel = null;
    }
  }, checkIntervalMs);

  // Return cleanup function
  return () => {
    clearInterval(checkInterval);
    console.log('[Memory Pressure] Monitoring stopped');
  };
}

/**
 * Get current memory pressure level
 * @returns {Object} { level, usage, stats }
 */
export function getCurrentPressureLevel() {
  // Use RSS instead of heap for pressure calculation
  const memUsage = process.memoryUsage();
  const maxRSSMB = 4096 * 1024 * 1024; // 4GB in bytes
  const usage = memUsage.rss / maxRSSMB;

  const stats = v8.getHeapStatistics(); // Keep for stats logging
  const memoryStats = {
    rssMB: memUsage.rss / 1024 / 1024,
    rssMaxMB: 4096,
    rssUsagePercent: usage * 100,
    heapUsedMB: stats.used_heap_size / 1024 / 1024,
    heapLimitMB: stats.heap_size_limit / 1024 / 1024,
    externalMB: memUsage.external / 1024 / 1024,
    timestamp: new Date().toISOString()
  };

  let level = 'normal';
  if (usage > DEFAULT_CRITICAL_THRESHOLD) {
    level = 'critical';
  } else if (usage > DEFAULT_HIGH_THRESHOLD) {
    level = 'high';
  }

  return { level, usage, stats: memoryStats };
}

/**
 * Check if memory pressure requires action
 * @param {string} requiredLevel - Minimum level to check ('high' or 'critical')
 * @returns {boolean} True if at or above required level
 */
export function isPressureAtLevel(requiredLevel = 'high') {
  const { level } = getCurrentPressureLevel();

  if (requiredLevel === 'critical') {
    return level === 'critical';
  } else if (requiredLevel === 'high') {
    return level === 'high' || level === 'critical';
  }

  return false;
}
