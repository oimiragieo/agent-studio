#!/usr/bin/env node
/**
 * Memory Cleanup Utility
 * Provides centralized cleanup for all caches and memory management
 */

import { clearCache as clearGitCache, stopAutoCleanup as stopGitCleanup } from './git-cache.mjs';
import {
  invalidateArtifact,
  cleanExpiredEntries,
  stopAutoCleanup as stopArtifactCleanup,
} from './artifact-cache.mjs';
import {
  clearCache as clearSkillCache,
  stopAutoCleanup as stopSkillCleanup,
} from './skill-cache.mjs';

/**
 * Cleanup all caches
 * @returns {Object} Results of cleanup operations
 */
export function cleanupAllCaches() {
  const results = {
    gitCache: 0,
    artifactCache: 0,
    skillCache: 0,
  };

  try {
    clearGitCache();
    results.gitCache = 1;
  } catch (error) {
    console.warn('[Cleanup] Failed to clear git cache:', error.message);
  }

  try {
    const removed = cleanExpiredEntries();
    invalidateArtifact(); // Clear all
    results.artifactCache = removed;
  } catch (error) {
    console.warn('[Cleanup] Failed to clear artifact cache:', error.message);
  }

  try {
    clearSkillCache();
    results.skillCache = 1;
  } catch (error) {
    console.warn('[Cleanup] Failed to clear skill cache:', error.message);
  }

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }

  return results;
}

/**
 * Stop all auto-cleanup intervals
 * Call this to prevent memory leaks from setInterval
 * @returns {void}
 */
export function stopAllAutoCleanup() {
  try {
    stopGitCleanup();
  } catch (error) {
    console.warn('[Cleanup] Failed to stop git auto-cleanup:', error.message);
  }

  try {
    stopArtifactCleanup();
  } catch (error) {
    console.warn('[Cleanup] Failed to stop artifact auto-cleanup:', error.message);
  }

  try {
    stopSkillCleanup();
  } catch (error) {
    console.warn('[Cleanup] Failed to stop skill auto-cleanup:', error.message);
  }
}

/**
 * Setup periodic cleanup
 * @param {number} intervalMs - Cleanup interval in milliseconds (default: 10 minutes)
 * @returns {Function} Function to stop the periodic cleanup
 */
export function setupPeriodicCleanup(intervalMs = 10 * 60 * 1000) {
  const interval = setInterval(() => {
    console.log('[Cleanup] Running periodic memory cleanup...');
    const results = cleanupAllCaches();
    console.log(
      `[Cleanup] Cleaned: git=${results.gitCache}, artifacts=${results.artifactCache}, skills=${results.skillCache}`
    );
  }, intervalMs);

  return () => clearInterval(interval);
}
