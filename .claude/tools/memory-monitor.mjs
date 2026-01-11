#!/usr/bin/env node
/**
 * Memory Monitoring Utility
 * Tracks memory usage and provides warnings when approaching limits
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MEMORY_THRESHOLDS_PATH = join(__dirname, '..', 'config', 'memory-thresholds.json');

const DEFAULT_WARN_THRESHOLD_MB = 3500; // 3.5GB warning threshold
const DEFAULT_CHECK_INTERVAL_MS = 60000; // 1 minute
const DEFAULT_MAX_RSS_MB = 4096; // Matches --max-old-space-size=4096
const DEFAULT_MIN_FREE_MB_SPAWN_SUBAGENT = 800;

let cachedThresholds = null;

export function loadMemoryThresholds() {
  if (cachedThresholds) return cachedThresholds;

  const defaults = {
    max_rss_mb: DEFAULT_MAX_RSS_MB,
    warn_rss_mb: DEFAULT_WARN_THRESHOLD_MB,
    min_free_mb_spawn_subagent: DEFAULT_MIN_FREE_MB_SPAWN_SUBAGENT,
    monitor_interval_ms: DEFAULT_CHECK_INTERVAL_MS,
  };

  try {
    const raw = readFileSync(MEMORY_THRESHOLDS_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    const merged = { ...defaults, ...parsed };
    // Back-compat: prefer legacy keys if present
    if (typeof merged.warnThreshold === 'number' && typeof merged.warn_rss_mb !== 'number') {
      merged.warn_rss_mb = merged.warnThreshold;
    }
    if (typeof merged.warnThreshold === 'number') {
      merged.warn_rss_mb = merged.warnThreshold;
    }
    cachedThresholds = merged;
    return cachedThresholds;
  } catch {
    cachedThresholds = defaults;
    return cachedThresholds;
  }
}

let monitoringInterval = null;
let warnThresholdMB = DEFAULT_WARN_THRESHOLD_MB;

export function startMonitoring(options = {}) {
  const thresholds = loadMemoryThresholds();
  const {
    warnThresholdMB: threshold = thresholds.warn_rss_mb ?? DEFAULT_WARN_THRESHOLD_MB,
    checkIntervalMs = thresholds.monitor_interval_ms ?? DEFAULT_CHECK_INTERVAL_MS,
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
export function canSpawnSubagent(minFreeMB = null) {
  const thresholds = loadMemoryThresholds();
  const usage = getMemoryUsage();
  // NEW: Use RSS as primary metric
  const effectiveMinFreeMB =
    minFreeMB == null
      ? (thresholds.min_free_mb_spawn_subagent ?? DEFAULT_MIN_FREE_MB_SPAWN_SUBAGENT)
      : minFreeMB;
  const maxRSSMB = thresholds.max_rss_mb ?? DEFAULT_MAX_RSS_MB;
  const freeRSSMB = maxRSSMB - usage.rssMB;
  const canSpawn = freeRSSMB >= effectiveMinFreeMB;

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
    result.warning = `Insufficient memory: ${freeRSSMB.toFixed(2)}MB RSS free, need ${effectiveMinFreeMB}MB`;
  }

  return result;
}

/**
 * Get effective memory usage (RSS + external as percentage)
 * @returns {number} Percentage of effective memory used (0-100)
 */
export function getEffectiveMemoryPercent() {
  const thresholds = loadMemoryThresholds();
  const usage = getMemoryUsage();
  const maxRSSMB = thresholds.max_rss_mb ?? DEFAULT_MAX_RSS_MB;
  return (usage.rssMB / maxRSSMB) * 100;
}
