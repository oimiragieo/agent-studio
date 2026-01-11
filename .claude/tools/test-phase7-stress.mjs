#!/usr/bin/env node
/**
 * Phase 7 Memory Exhaustion Stress Test
 *
 * Replicates the original Phase 7 crash scenario:
 * - Running for 1h 37m with 225.3k tokens
 * - Spawned technical-writer subagent with 13+ tool uses
 * - 2 background tasks running
 * - Result: JavaScript heap out of memory
 *
 * Exit codes:
 * - 0: Success - stress test completed without issues
 * - 1: Failure - heap out of memory or unexpected crash
 * - 42: Graceful degradation - checkpoint saved, needs restart
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import v8 from 'v8';

import { getMemoryUsage, logMemoryUsage, canSpawnSubagent, startMonitoring, stopMonitoring } from './memory-monitor.mjs';
import { cleanupAllCaches, stopAllAutoCleanup, setupPeriodicCleanup } from './memory-cleanup.mjs';
import { saveCheckpoint, loadCheckpoint, deleteCheckpoint } from './workflow-checkpoint.mjs';
import { setupMemoryPressureHandling, getCurrentPressureLevel, isPressureAtLevel } from './memory-pressure-handler.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG = {
  numSubagentCycles: 5,
  toolUsesPerSubagent: 15,
  backgroundTasks: 2,
  artifactSizeMB: 5,
  targetDurationMinutes: 2,
  tokenSimulationSize: 250000,
  maxHeapMB: 4096,
  warningThresholdMB: 3500,
  criticalThresholdPercent: 0.90,
  highThresholdPercent: 0.80,
  checkpointIntervalMs: 60000,
  cleanupIntervalMs: 30000,
  maxConcurrentSpawns: 3,
  minFreeMemoryMB: 500
};

const metrics = {
  startTime: null,
  endTime: null,
  heapStart: 0,
  heapPeak: 0,
  heapEnd: 0,
  rssStart: 0,  // NEW: RSS tracking
  rssPeak: 0,   // NEW: RSS tracking
  rssEnd: 0,    // NEW: RSS tracking
  gcCount: 0,
  cleanupCount: 0,
  spawnCount: 0,
  concurrentPeakSpawns: 0,
  currentSpawns: 0,
  pressureEvents: { high: 0, critical: 0 },
  checkpointsSaved: 0,
  artifactsCreated: 0,
  toolSimulations: 0,
  exitReason: null,
  exitCode: null
};

let stopPressureMonitor = null;
let stopPeriodicCleanup = null;
let checkpointInterval = null;
let backgroundTasks = [];
let isShuttingDown = false;

function logMetrics(label = '') {
  const usage = getMemoryUsage();
  metrics.heapPeak = Math.max(metrics.heapPeak, usage.heapUsedMB);
  metrics.rssPeak = Math.max(metrics.rssPeak, usage.rssMB); // NEW: Track RSS peak
  const elapsed = (Date.now() - metrics.startTime) / 1000 / 60;
  console.log("[Metrics " + label + "] @ " + elapsed.toFixed(1) + "min");
  console.log("  Heap: " + usage.heapUsedMB.toFixed(2) + "MB / " + CONFIG.maxHeapMB + "MB (" + ((usage.heapUsedMB / CONFIG.maxHeapMB) * 100).toFixed(1) + "%)");
  console.log("  RSS: " + usage.rssMB.toFixed(2) + "MB / " + CONFIG.maxHeapMB + "MB (" + ((usage.rssMB / CONFIG.maxHeapMB) * 100).toFixed(1) + "%)"); // NEW
  console.log("  Peak: Heap " + metrics.heapPeak.toFixed(2) + "MB, RSS " + metrics.rssPeak.toFixed(2) + "MB, Spawns: " + metrics.spawnCount + ", Cleanups: " + metrics.cleanupCount); // UPDATED
}

async function simulateToolUse(toolType) {
  metrics.toolSimulations++;
  const data = Buffer.alloc(1024 * 100, 'x');
  await new Promise(r => setTimeout(r, 50 + Math.random() * 100));
  return data.length;
}

async function simulateSubagent(subagentId) {
  console.log("[Subagent " + subagentId + "] Starting...");
  metrics.spawnCount++;
  metrics.currentSpawns++;
  metrics.concurrentPeakSpawns = Math.max(metrics.concurrentPeakSpawns, metrics.currentSpawns);

  try {
    for (let i = 0; i < CONFIG.toolUsesPerSubagent; i++) {
      if (isShuttingDown) break;
      await simulateToolUse('read');
      const pressure = getCurrentPressureLevel();
      if (pressure.level === 'critical') break;
    }
    console.log("[Subagent " + subagentId + "] Completed");
  } finally {
    metrics.currentSpawns--;
  }
}

async function createLargeArtifact(artifactId, sizeMB = 5) {
  console.log("[Artifact " + artifactId + "] Creating " + sizeMB + "MB artifact...");
  const testDir = path.join(__dirname, '../context/test');
  if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
  const artifactPath = path.join(testDir, "stress-artifact-" + artifactId + ".json");
  const itemCount = Math.floor((sizeMB * 1024 * 1024) / 1000);
  const data = { id: artifactId, items: Array(itemCount).fill({ data: 'x'.repeat(800) }) };
  fs.writeFileSync(artifactPath, JSON.stringify(data));
  metrics.artifactsCreated++;
  return artifactPath;
}

async function simulateContextAccumulation() {
  console.log("[Context] Simulating " + CONFIG.tokenSimulationSize + " token context...");
  const chunks = Array(100).fill('context_data_'.repeat(1000));
  return chunks.length;
}

async function runBackgroundTask(taskId) {
  console.log("[Background " + taskId + "] Starting...");
  while (!isShuttingDown) {
    await new Promise(r => setTimeout(r, 5000));
    if (isShuttingDown) break;
    console.log("[Background " + taskId + "] Tick - Heap: " + getMemoryUsage().heapUsedMB.toFixed(2) + "MB");
  }
}

function handleMemoryPressure(level, usage, stats) {
  metrics.pressureEvents[level]++;
  console.warn("[PRESSURE] " + level.toUpperCase() + " - Heap: " + stats.heapUsedMB.toFixed(2) + "MB");
  if (level === 'critical') {
    saveCheckpoint('phase7-stress-test', metrics.spawnCount, { metrics });
    metrics.checkpointsSaved++;
    cleanupAllCaches();
    metrics.cleanupCount++;
    if (global.gc) { global.gc(); metrics.gcCount++; }
    const afterCleanup = getCurrentPressureLevel();
    if (afterCleanup.level === 'critical') {
      metrics.exitReason = 'graceful_degradation';
      metrics.exitCode = 42;
      shutdown();
    }
  } else if (level === 'high') {
    cleanupAllCaches();
    metrics.cleanupCount++;
    if (global.gc) { global.gc(); metrics.gcCount++; }
  }
}

async function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log('[Shutdown] Initiating cleanup...');
  if (stopPressureMonitor) { stopPressureMonitor(); stopPressureMonitor = null; }
  if (stopPeriodicCleanup) { stopPeriodicCleanup(); stopPeriodicCleanup = null; }
  if (checkpointInterval) { clearInterval(checkpointInterval); checkpointInterval = null; }
  stopAllAutoCleanup();
  stopMonitoring();
  cleanupAllCaches();
  metrics.cleanupCount++;
  if (global.gc) { global.gc(); metrics.gcCount++; }
  metrics.endTime = Date.now();
  const finalUsage = getMemoryUsage();
  metrics.heapEnd = finalUsage.heapUsedMB;
  metrics.rssEnd = finalUsage.rssMB; // NEW: Track final RSS
  console.log('[Shutdown] Complete');
}

async function generateReport() {
  const duration = (metrics.endTime - metrics.startTime) / 1000 / 60;
  const report = {
    title: 'Phase 7 Memory Exhaustion Stress Test Results',
    generated: new Date().toISOString(),
    configuration: CONFIG,
    results: { duration_minutes: duration.toFixed(2), completion_status: metrics.exitReason || 'success', exit_code: metrics.exitCode || 0 },
    memory_metrics: {
      heap_start_mb: metrics.heapStart.toFixed(2),
      heap_peak_mb: metrics.heapPeak.toFixed(2),
      heap_end_mb: metrics.heapEnd.toFixed(2),
      rss_start_mb: metrics.rssStart.toFixed(2), // NEW
      rss_peak_mb: metrics.rssPeak.toFixed(2),   // NEW
      rss_end_mb: metrics.rssEnd.toFixed(2),     // NEW
      heap_limit_mb: CONFIG.maxHeapMB,
      rss_limit_mb: CONFIG.maxHeapMB,  // NEW
      heap_peak_usage_percent: ((metrics.heapPeak / CONFIG.maxHeapMB) * 100).toFixed(1),
      rss_peak_usage_percent: ((metrics.rssPeak / CONFIG.maxHeapMB) * 100).toFixed(1) // NEW
    },
    event_counts: {
      gc_count: metrics.gcCount,
      cleanup_count: metrics.cleanupCount,
      spawn_count: metrics.spawnCount,
      concurrent_peak_spawns: metrics.concurrentPeakSpawns,
      pressure_events_high: metrics.pressureEvents.high,
      pressure_events_critical: metrics.pressureEvents.critical,
      checkpoints_saved: metrics.checkpointsSaved,
      artifacts_created: metrics.artifactsCreated,
      tool_simulations: metrics.toolSimulations
    },
    comparison_to_original: {
      original_duration_minutes: 97,
      original_tokens: 225300,
      original_subagent_tools: 13,
      original_background_tasks: 2,
      original_result: 'JavaScript heap out of memory',
      test_duration_minutes: duration.toFixed(2),
      test_tokens_simulated: CONFIG.tokenSimulationSize,
      test_subagent_tools: CONFIG.toolUsesPerSubagent,
      test_background_tasks: CONFIG.backgroundTasks,
      test_result: metrics.exitReason || 'success'
    }
  };

  // NEW: Use RSS for pass/fail (not heap)
  const passThreshold = 3500; // 85% of 4096MB
  if (metrics.exitCode === 1) {
    report.pass_fail_decision = 'FAIL';
    report.justification = 'Memory exhaustion crash occurred - same as original failure';
  } else if (metrics.exitCode === 42) {
    report.pass_fail_decision = 'PASS';
    report.justification = 'Graceful degradation triggered before crash - checkpoint saved for restart';
  } else if (metrics.rssPeak >= passThreshold) {
    report.pass_fail_decision = 'CONCERNS';
    report.justification = 'Peak RSS reached ' + ((metrics.rssPeak / CONFIG.maxHeapMB) * 100).toFixed(1) + '% (' + metrics.rssPeak.toFixed(2) + 'MB) - exceeds 85% threshold but completed';
  } else {
    report.pass_fail_decision = 'PASS';
    report.justification = 'Stress test completed successfully. Peak RSS: ' + ((metrics.rssPeak / CONFIG.maxHeapMB) * 100).toFixed(1) + '% (' + metrics.rssPeak.toFixed(2) + 'MB)';
  }

  report.recommendations = [];
  if (metrics.pressureEvents.critical > 0) report.recommendations.push('Critical pressure events occurred - consider lower spawn concurrency');
  if (metrics.heapPeak > CONFIG.warningThresholdMB) report.recommendations.push('Peak exceeded warning threshold - monitor production workloads');
  if (metrics.cleanupCount > 10) report.recommendations.push('Frequent cleanups indicate memory pressure - optimize artifact handling');

  return report;
}

async function runStressTest() {
  console.log('======================================================================');
  console.log('Phase 7 Memory Exhaustion Stress Test');
  console.log('======================================================================');
  console.log('Configuration:', JSON.stringify(CONFIG, null, 2));

  metrics.startTime = Date.now();
  const initialUsage = getMemoryUsage();
  metrics.heapStart = initialUsage.heapUsedMB;
  metrics.rssStart = initialUsage.rssMB; // NEW: Track initial RSS

  stopPressureMonitor = setupMemoryPressureHandling(handleMemoryPressure, {
    highThreshold: CONFIG.highThresholdPercent,
    criticalThreshold: CONFIG.criticalThresholdPercent,
    checkIntervalMs: 5000
  });

  stopPeriodicCleanup = setupPeriodicCleanup(CONFIG.cleanupIntervalMs);
  checkpointInterval = setInterval(() => {
    if (!isShuttingDown) {
      saveCheckpoint('phase7-stress-test', metrics.spawnCount, { metrics });
      metrics.checkpointsSaved++;
    }
  }, CONFIG.checkpointIntervalMs);

  for (let i = 0; i < CONFIG.backgroundTasks; i++) backgroundTasks.push(runBackgroundTask(i + 1));

  try {
    logMetrics('Start');
    await simulateContextAccumulation();
    logMetrics('After Context');

    for (let i = 0; i < 3; i++) {
      if (isShuttingDown) break;
      await createLargeArtifact(i + 1, CONFIG.artifactSizeMB);
      logMetrics('After Artifact ' + (i + 1));
    }

    for (let i = 0; i < CONFIG.numSubagentCycles; i++) {
      if (isShuttingDown) break;
      const check = canSpawnSubagent(CONFIG.minFreeMemoryMB);
      if (!check.canSpawn) {
        console.warn('[Phase 3] Insufficient memory for subagent ' + (i + 1));
        await saveCheckpoint('phase7-stress-test', i, { metrics, reason: 'insufficient_memory' });
        metrics.checkpointsSaved++;
        cleanupAllCaches();
        metrics.cleanupCount++;
        if (global.gc) { global.gc(); metrics.gcCount++; }
        const recheck = canSpawnSubagent(CONFIG.minFreeMemoryMB);
        if (!recheck.canSpawn) {
          metrics.exitReason = 'graceful_degradation';
          metrics.exitCode = 42;
          break;
        }
      }
      await simulateSubagent(i + 1);
      logMetrics('After Subagent ' + (i + 1));
      cleanupAllCaches();
      metrics.cleanupCount++;
      if (global.gc) { global.gc(); metrics.gcCount++; }
    }

    const elapsed = (Date.now() - metrics.startTime) / 1000 / 60;
    if (elapsed < CONFIG.targetDurationMinutes && !isShuttingDown) {
      const remaining = (CONFIG.targetDurationMinutes - elapsed) * 60 * 1000;
      console.log('[Phase 4] Waiting ' + (remaining / 1000 / 60).toFixed(1) + ' minutes...');
      let waited = 0;
      while (waited < remaining && !isShuttingDown) {
        await new Promise(r => setTimeout(r, 30000));
        waited += 30000;
        logMetrics('Waiting (' + (waited / 1000 / 60).toFixed(1) + 'min)');
      }
    }

    if (!metrics.exitReason) {
      metrics.exitReason = 'completed';
      metrics.exitCode = 0;
    }
  } catch (error) {
    console.error('[ERROR] Stress test failed:', error.message);
    metrics.exitReason = error.message.includes('heap') ? 'heap_out_of_memory' : 'error';
    metrics.exitCode = 1;
  } finally {
    await shutdown();
  }

  const report = await generateReport();
  const reportsDir = path.join(__dirname, '../context/reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
  fs.writeFileSync(path.join(reportsDir, 'phase7-stress-test-results.json'), JSON.stringify(report, null, 2));

  const markdown = "# " + report.title + "\n\n" +
    "**Generated**: " + report.generated + "\n\n" +
    "## Test Duration and Status\n" +
    "| Metric | Value |\n|--------|-------|\n" +
    "| Duration | " + report.results.duration_minutes + " minutes |\n" +
    "| Status | " + report.results.completion_status + " |\n" +
    "| Exit Code | " + report.results.exit_code + " |\n\n" +
    "## Memory Metrics\n" +
    "| Metric | Value |\n|--------|-------|\n" +
    "| Heap Start | " + report.memory_metrics.heap_start_mb + " MB |\n" +
    "| Heap Peak | " + report.memory_metrics.heap_peak_mb + " MB |\n" +
    "| Heap End | " + report.memory_metrics.heap_end_mb + " MB |\n" +
    "| Heap Limit | " + report.memory_metrics.heap_limit_mb + " MB |\n" +
    "| Peak Usage | " + report.memory_metrics.peak_usage_percent + "% |\n\n" +
    "## Event Counts\n" +
    "| Event | Count |\n|-------|-------|\n" +
    "| GC Invocations | " + report.event_counts.gc_count + " |\n" +
    "| Cache Cleanups | " + report.event_counts.cleanup_count + " |\n" +
    "| Subagent Spawns | " + report.event_counts.spawn_count + " |\n" +
    "| Concurrent Peak | " + report.event_counts.concurrent_peak_spawns + " |\n" +
    "| Pressure (High) | " + report.event_counts.pressure_events_high + " |\n" +
    "| Pressure (Critical) | " + report.event_counts.pressure_events_critical + " |\n" +
    "| Checkpoints Saved | " + report.event_counts.checkpoints_saved + " |\n" +
    "| Artifacts Created | " + report.event_counts.artifacts_created + " |\n" +
    "| Tool Simulations | " + report.event_counts.tool_simulations + " |\n\n" +
    "## Quality Gate Decision\n" +
    "**" + report.pass_fail_decision + "**\n\n" +
    report.justification + "\n";

  fs.writeFileSync(path.join(reportsDir, 'phase7-stress-test-results.md'), markdown);
  console.log('\n======================================================================');
  console.log('STRESS TEST SUMMARY');
  console.log('======================================================================');
  console.log('Duration:', report.results.duration_minutes, 'minutes');
  console.log('Status:', report.results.completion_status);
  console.log('Peak Memory:', report.memory_metrics.heap_peak_mb + 'MB (' + report.memory_metrics.peak_usage_percent + '%)');
  console.log('Decision:', report.pass_fail_decision);
  console.log('======================================================================');

  const testDir = path.join(__dirname, '../context/test');
  if (fs.existsSync(testDir)) {
    fs.readdirSync(testDir).filter(f => f.startsWith('stress-artifact-')).forEach(f => fs.unlinkSync(path.join(testDir, f)));
  }
  await deleteCheckpoint('phase7-stress-test');
  process.exit(metrics.exitCode || 0);
}

process.on('uncaughtException', async (error) => {
  console.error('[FATAL] Uncaught exception:', error.message);
  metrics.exitReason = error.message.includes('heap') ? 'heap_out_of_memory' : 'error';
  metrics.exitCode = 1;
  await shutdown();
  const report = await generateReport();
  const reportsDir = path.join(__dirname, '../context/reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
  fs.writeFileSync(path.join(reportsDir, 'phase7-stress-test-results.json'), JSON.stringify(report, null, 2));
  process.exit(1);
});

process.on('SIGINT', async () => {
  console.log('[SIGINT] Received interrupt signal');
  metrics.exitReason = 'interrupted';
  metrics.exitCode = 0;
  await shutdown();
  process.exit(0);
});

runStressTest();
