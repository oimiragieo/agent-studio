#!/usr/bin/env node
/**
 * Safe File Loader - Memory-aware file loading utility
 * Validates memory availability before loading large files
 * Automatically uses streaming for files > 10MB
 */

import { readFile, stat } from 'fs/promises';
import { createReadStream } from 'fs';
import { getMemoryUsage, canSpawnSubagent } from './memory-monitor.mjs';
import { cleanupAllCaches } from './memory-cleanup.mjs';

const STREAMING_THRESHOLD_MB = 10; // Use streaming for files > 10MB
const JSON_EXPANSION_FACTOR = 3; // JSON parsing expands ~3x in memory

/**
 * Safely load JSON file with memory validation
 * @param {string} filePath - Path to JSON file
 * @param {Object} options - Loading options
 * @param {number} options.maxSizeMB - Maximum allowed file size (default: 50MB)
 * @param {boolean} options.forceStreaming - Force streaming regardless of size
 * @param {Function} options.onProgress - Progress callback for streaming
 * @returns {Promise<Object>} Parsed JSON object
 */
export async function loadJSONSafely(filePath, options = {}) {
  const {
    maxSizeMB = 50,
    forceStreaming = false,
    onProgress = null
  } = options;

  // Check file size
  const stats = await stat(filePath);
  const fileSizeMB = stats.size / 1024 / 1024;

  if (fileSizeMB > maxSizeMB) {
    throw new Error(`File too large: ${fileSizeMB.toFixed(2)}MB exceeds max ${maxSizeMB}MB`);
  }

  // Estimate memory required (file size * expansion factor)
  const estimatedMemoryMB = fileSizeMB * JSON_EXPANSION_FACTOR;

  // Check if we have enough memory
  const memCheck = canSpawnSubagent(estimatedMemoryMB);
  if (!memCheck.canSpawn) {
    console.warn(`[SafeLoader] Insufficient memory for ${filePath} (need ${estimatedMemoryMB.toFixed(2)}MB)`);

    // Aggressive cleanup
    cleanupAllCaches();
    if (global.gc) {
      global.gc();
      global.gc();
    }

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Re-check
    const recheckMem = canSpawnSubagent(estimatedMemoryMB);
    if (!recheckMem.canSpawn) {
      // Force streaming as fallback
      console.log('[SafeLoader] Using streaming parser as fallback');
      return loadJSONStreaming(filePath, onProgress);
    }
  }

  // Use streaming for large files or if forced
  if (fileSizeMB > STREAMING_THRESHOLD_MB || forceStreaming) {
    return loadJSONStreaming(filePath, onProgress);
  }

  // Load normally for small files
  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Load JSON using streaming parser (for large files)
 * @param {string} filePath - Path to JSON file
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>} Parsed JSON object
 */
async function loadJSONStreaming(filePath, onProgress) {
  // Import streaming parser dynamically
  const { default: StreamingJsonParser } = await import('./streaming-json-parser.mjs');

  return new Promise((resolve, reject) => {
    const stream = createReadStream(filePath, { encoding: 'utf-8' });
    const parser = new StreamingJsonParser();

    let bytesRead = 0;

    stream.on('data', chunk => {
      bytesRead += chunk.length;
      parser.parse(chunk);
      if (onProgress) {
        onProgress({ bytesRead, chunk: chunk.length });
      }
    });

    stream.on('end', () => {
      try {
        const result = parser.getResult();
        resolve(result);
      } catch (err) {
        reject(new Error(`Streaming parse error: ${err.message}`));
      }
    });

    stream.on('error', reject);
  });
}

/**
 * Safely load text file with memory validation
 * @param {string} filePath - Path to text file
 * @param {Object} options - Loading options
 * @param {number} options.maxSizeMB - Maximum allowed file size (default: 50MB)
 * @returns {Promise<string>} File contents
 */
export async function loadTextSafely(filePath, options = {}) {
  const { maxSizeMB = 50 } = options;

  const stats = await stat(filePath);
  const fileSizeMB = stats.size / 1024 / 1024;

  if (fileSizeMB > maxSizeMB) {
    throw new Error(`File too large: ${fileSizeMB.toFixed(2)}MB exceeds max ${maxSizeMB}MB`);
  }

  // Check memory (text files expand ~1.5x in memory as strings)
  const estimatedMemoryMB = fileSizeMB * 1.5;
  const memCheck = canSpawnSubagent(estimatedMemoryMB);

  if (!memCheck.canSpawn) {
    // Cleanup and retry
    cleanupAllCaches();
    if (global.gc) global.gc();

    await new Promise(resolve => setTimeout(resolve, 1000));

    const recheckMem = canSpawnSubagent(estimatedMemoryMB);
    if (!recheckMem.canSpawn) {
      throw new Error(`Cannot load ${filePath}: insufficient memory`);
    }
  }

  return readFile(filePath, 'utf-8');
}
