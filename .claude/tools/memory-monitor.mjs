#!/usr/bin/env node
/**
 * Memory Monitoring Utility
 * Tracks memory usage and provides warnings when approaching limits
 */

const DEFAULT_WARN_THRESHOLD_MB = 3500; // 3.5GB warning threshold
const DEFAULT_CHECK_INTERVAL_MS = 60000; // 1 minute

let monitoringInterval = null;
let warnThresholdMB = DEFAULT_WARN_THRESHOLD_MB;

export function startMonitoring(options = {}) {
  const {
    warnThresholdMB: threshold = DEFAULT_WARN_THRESHOLD_MB,
    checkIntervalMs = DEFAULT_CHECK_INTERVAL_MS,
    onWarning = null,
  } = options;

  warnThresholdMB = threshold;

  if (monitoringInterval) {
    stopMonitoring();
  }

  monitoringInterval = setInterval(() => {
    const usage = getMemoryUsage();

    if (usage.rssMB > warnThresholdMB) {
      const warning = `[Memory] WARNING: RSS usage ${usage.rssMB.toFixed(2)}MB exceeds threshold ${warnThresholdMB}MB`;
      console.warn(warning);

      if (onWarning) {
        onWarning(usage);
      }

      // Attempt GC if available
      if (global.gc) {
        global.gc();
        const afterGC = getMemoryUsage();
        console.log(`[Memory] After GC: ${afterGC.heapUsedMB.toFixed(2)}MB`);
      }
    }
  }, checkIntervalMs);
}

export function stopMonitoring() {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
  }
}

export function getMemoryUsage() {
  const usage = process.memoryUsage();
  return {
    heapUsedMB: usage.heapUsed / 1024 / 1024,
    heapTotalMB: usage.heapTotal / 1024 / 1024,
    rssMB: usage.rss / 1024 / 1024,
    externalMB: usage.external / 1024 / 1024,
  };
}

export function logMemoryUsage(label = '') {
  const usage = getMemoryUsage();
  console.log(
    `[Memory${label ? ` ${label}` : ''}] Heap: ${usage.heapUsedMB.toFixed(2)}MB / ${usage.heapTotalMB.toFixed(2)}MB, RSS: ${usage.rssMB.toFixed(2)}MB`
  );
  return usage;
}

/**
 * Check if there's enough memory to spawn a subagent
 * @param {number} minFreeMB - Minimum free memory required (default: 500MB)
 * @returns {Object} { canSpawn: boolean, currentUsageMB: number, freeMB: number, warning?: string }
 */
export function canSpawnSubagent(minFreeMB = 500) {
  const usage = getMemoryUsage();
  // NEW: Use RSS as primary metric
  const maxRSSMB = 4096; // Match --max-old-space-size=4096
  const freeRSSMB = maxRSSMB - usage.rssMB;
  const canSpawn = freeRSSMB >= minFreeMB;

  const result = {
    canSpawn,
    currentUsageMB: usage.rssMB, // Changed from heapUsedMB
    freeMB: freeRSSMB, // Changed from freeMB
    maxRSSMB, // NEW
    // BACKWARD COMPAT: Keep old fields
    heapUsedMB: usage.heapUsedMB,
    maxHeapMB: 4096,
  };

  if (!canSpawn) {
    result.warning = `Insufficient memory: ${freeRSSMB.toFixed(2)}MB RSS free, need ${minFreeMB}MB`;
  }

  return result;
}

/**
 * Get effective memory usage (RSS + external as percentage)
 * @returns {number} Percentage of effective memory used (0-100)
 */
export function getEffectiveMemoryPercent() {
  const usage = getMemoryUsage();
  const maxRSSMB = 4096;
  return (usage.rssMB / maxRSSMB) * 100;
}
