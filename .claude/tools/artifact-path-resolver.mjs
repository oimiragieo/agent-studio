#!/usr/bin/env node
/**
 * Artifact Path Resolver (with Compression Support)
 *
 * Centralized path resolution for artifacts across the system.
 * Ensures consistent artifact location logic between:
 * - Multi-AI code review artifacts
 * - Workflow artifacts
 * - Report artifacts
 * - Task artifacts
 *
 * Performance Optimizations (Issue 5.2):
 * - Transparent compression for artifacts >1MB (gzip)
 * - Streaming support for large artifacts >10MB
 * - O(1) file size detection
 * - Target: <500ms for 10MB artifact read
 *
 * Usage:
 *   import { getArtifactPath, getReportPath, getTaskPath } from '.claude/tools/artifact-path-resolver.mjs';
 *
 *   const path = getArtifactPath(runId, 'plan-greenfield.json');
 *   const reportPath = getReportPath(runId, 'security-audit-report.md');
 *
 *   // Compression (Issue 5.2)
 *   import { compressArtifact, decompressArtifact, getArtifactStream } from '.claude/tools/artifact-path-resolver.mjs';
 */

import { join, dirname, basename, extname } from 'path';
import { fileURLToPath } from 'url';
import { resolveRuntimePath, resolveArtifactPath } from './context-path-resolver.mjs';
import { existsSync, mkdirSync, statSync, createReadStream, createWriteStream } from 'fs';
import { readFile, writeFile, stat, rename, unlink } from 'fs/promises';
import { createGzip, createGunzip, gzip, gunzip } from 'zlib';
import { promisify } from 'util';
import { pipeline } from 'stream/promises';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROJECT_ROOT = join(__dirname, '../..');
const CONTEXT_DIR = join(PROJECT_ROOT, '.claude/context');
const HISTORY_DIR = join(CONTEXT_DIR, 'history');

// Canonical global artifacts live under artifacts/generated (MCP artifacts root)
const GENERATED_ARTIFACTS_DIR = dirname(
  resolveArtifactPath({ kind: 'generated', filename: '.gitkeep' })
);

/**
 * Get artifact path based on run ID
 *
 * @param {string|null} runId - Run identifier (null for default/legacy location)
 * @param {string} artifactName - Artifact filename
 * @param {string} category - Category/subdirectory (default: 'artifacts')
 * @returns {string} Full artifact path
 *
 * @example
 * // Run-specific artifact
 * getArtifactPath('run-123', 'plan.json')
 * // => '.claude/context/runtime/runs/run-123/artifacts/plan.json'
 *
 * // Legacy/default artifact
 * getArtifactPath(null, 'plan.json')
 * // => '.claude/context/artifacts/plan.json'
 */
export function getArtifactPath(runId, artifactName, category = 'artifacts') {
  if (runId) {
    // Run-scoped artifacts belong under runtime runs directory
    return resolveRuntimePath(join('runs', runId, category, artifactName), { write: true });
  }

  // Global artifacts (MCP artifacts root): default to generated artifacts
  if (category === 'artifacts') {
    return join(GENERATED_ARTIFACTS_DIR, artifactName);
  }

  // Other global categories live under runtime root
  return resolveRuntimePath(join(category, artifactName), { write: true });
}

/**
 * Get report path based on run ID
 *
 * @param {string|null} runId - Run identifier (null for default/legacy location)
 * @param {string} reportName - Report filename
 * @returns {string} Full report path
 *
 * @example
 * // Run-specific report
 * getReportPath('run-123', 'security-audit.md')
 * // => '.claude/context/runtime/runs/run-123/reports/security-audit.md'
 *
 * // Legacy/default report
 * getReportPath(null, 'security-audit.md')
 * // => '.claude/context/reports/security-audit.md'
 */
export function getReportPath(runId, reportName) {
  return getArtifactPath(runId, reportName, 'reports');
}

/**
 * Get task path based on run ID
 *
 * @param {string|null} runId - Run identifier (null for default/legacy location)
 * @param {string} taskName - Task filename
 * @returns {string} Full task path
 *
 * @example
 * // Run-specific task
 * getTaskPath('run-123', 'feature-implementation.md')
 * // => '.claude/context/runtime/runs/run-123/tasks/feature-implementation.md'
 *
 * // Legacy/default task
 * getTaskPath(null, 'feature-implementation.md')
 * // => '.claude/context/tasks/feature-implementation.md'
 */
export function getTaskPath(runId, taskName) {
  return getArtifactPath(runId, taskName, 'tasks');
}

/**
 * Get gate path based on run ID
 *
 * @param {string|null} runId - Run identifier (null for default/legacy location)
 * @param {string} gateName - Gate filename
 * @returns {string} Full gate path
 *
 * @example
 * // Run-specific gate
 * getGatePath('run-123', 'step-01-developer.json')
 * // => '.claude/context/runtime/runs/run-123/gates/step-01-developer.json'
 *
 * // Legacy/default gate
 * getGatePath(null, 'step-01-developer.json')
 * // => '.claude/context/history/gates/workflow-123/step-01-developer.json'
 */
export function getGatePath(runId, gateName, workflowId = null) {
  if (runId) {
    return resolveRuntimePath(join('runs', runId, 'gates', gateName), { write: true });
  }
  // Legacy location requires workflowId (history stays stable)
  if (!workflowId) {
    throw new Error('workflowId is required for legacy gate paths');
  }
  return join(HISTORY_DIR, 'gates', workflowId, gateName);
}

/**
 * Get reasoning path based on run ID
 *
 * @param {string|null} runId - Run identifier (null for default/legacy location)
 * @param {string} reasoningName - Reasoning filename
 * @returns {string} Full reasoning path
 *
 * @example
 * // Run-specific reasoning
 * getReasoningPath('run-123', 'developer.json')
 * // => '.claude/context/runtime/runs/run-123/reasoning/developer.json'
 *
 * // Legacy/default reasoning
 * getReasoningPath(null, 'developer.json')
 * // => '.claude/context/history/reasoning/workflow-123/developer.json'
 */
export function getReasoningPath(runId, reasoningName, workflowId = null) {
  if (runId) {
    return resolveRuntimePath(join('runs', runId, 'reasoning', reasoningName), { write: true });
  }
  // Legacy location requires workflowId (history stays stable)
  if (!workflowId) {
    throw new Error('workflowId is required for legacy reasoning paths');
  }
  return join(HISTORY_DIR, 'reasoning', workflowId, reasoningName);
}

/**
 * Get artifact directory path (ensures directory exists)
 *
 * @param {string|null} runId - Run identifier (null for default/legacy location)
 * @param {string} category - Category/subdirectory (default: 'artifacts')
 * @param {boolean} ensureExists - Whether to create directory if missing (default: true)
 * @returns {string} Full directory path
 */
export function getArtifactDir(runId, category = 'artifacts', ensureExists = true) {
  let dir;

  if (runId) {
    dir = resolveRuntimePath(join('runs', runId, category), { write: ensureExists });
  } else if (category === 'artifacts') {
    dir = GENERATED_ARTIFACTS_DIR;
  } else {
    dir = resolveRuntimePath(category, { write: ensureExists });
  }

  if (ensureExists && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  return dir;
}

/**
 * Get all artifact category directories for a run
 *
 * @param {string} runId - Run identifier
 * @returns {Object} Object with all category directory paths
 */
export function getRunDirectories(runId) {
  return {
    artifacts: getArtifactDir(runId, 'artifacts', false),
    reports: getArtifactDir(runId, 'reports', false),
    tasks: getArtifactDir(runId, 'tasks', false),
    gates: getArtifactDir(runId, 'gates', false),
    reasoning: getArtifactDir(runId, 'reasoning', false),
    plans: getArtifactDir(runId, 'plans', false),
  };
}

/**
 * Ensure all artifact directories exist for a run
 *
 * @param {string} runId - Run identifier
 */
export function ensureRunDirectories(runId) {
  const categories = ['artifacts', 'reports', 'tasks', 'gates', 'reasoning', 'plans'];
  for (const category of categories) {
    getArtifactDir(runId, category, true);
  }
}

/**
 * Resolve legacy artifact path to run-specific path
 * Used for migration from legacy to run-specific artifacts
 *
 * @param {string} legacyPath - Legacy artifact path
 * @param {string} runId - Target run identifier
 * @returns {string} Run-specific path
 */
export function migrateLegacyPath(legacyPath, runId) {
  // Extract category and filename from legacy path
  // Example: '.claude/context/artifacts/plan.json' => 'artifacts/plan.json'
  const relativePath = legacyPath.replace(CONTEXT_DIR, '').replace(/^[\/\\]/, '');
  const parts = relativePath.split(/[\/\\]/);

  if (parts.length < 2) {
    throw new Error(`Invalid legacy path: ${legacyPath}`);
  }

  const category = parts[0];
  const filename = parts.slice(1).join('/');

  return getArtifactPath(runId, filename, category);
}

// ============================================================================
// Issue 5.2: Large Artifact Compression Support
// ============================================================================

// Compression thresholds (exported)
export const COMPRESSION_THRESHOLD_BYTES = 1 * 1024 * 1024; // 1MB - compress artifacts larger than this
export const STREAMING_THRESHOLD_BYTES = 10 * 1024 * 1024; // 10MB - use streaming for artifacts larger than this

/**
 * Get file size in bytes (synchronous for speed)
 *
 * @param {string} filePath - Path to file
 * @returns {number|null} File size in bytes or null if not found
 */
export function getFileSize(filePath) {
  try {
    const stats = statSync(filePath);
    return stats.size;
  } catch {
    return null;
  }
}

/**
 * Check if artifact should be compressed based on size
 *
 * @param {string|number} sizeOrPath - File size in bytes or path to file
 * @returns {boolean} True if compression is recommended
 */
export function shouldCompress(sizeOrPath) {
  const size = typeof sizeOrPath === 'number' ? sizeOrPath : getFileSize(sizeOrPath);
  return size !== null && size > COMPRESSION_THRESHOLD_BYTES;
}

/**
 * Check if artifact should use streaming based on size
 *
 * @param {string|number} sizeOrPath - File size in bytes or path to file
 * @returns {boolean} True if streaming is recommended
 */
export function shouldUseStreaming(sizeOrPath) {
  const size = typeof sizeOrPath === 'number' ? sizeOrPath : getFileSize(sizeOrPath);
  return size !== null && size > STREAMING_THRESHOLD_BYTES;
}

/**
 * Get compressed artifact path (.gz extension)
 *
 * @param {string} artifactPath - Original artifact path
 * @returns {string} Compressed artifact path
 */
export function getCompressedPath(artifactPath) {
  return `${artifactPath}.gz`;
}

/**
 * Check if compressed version of artifact exists
 *
 * @param {string} artifactPath - Original artifact path
 * @returns {boolean} True if compressed version exists
 */
export function hasCompressedVersion(artifactPath) {
  return existsSync(getCompressedPath(artifactPath));
}

/**
 * Compress artifact to .gz file (Issue 5.2a)
 * Uses streaming for large files
 *
 * @param {string} sourcePath - Source artifact path
 * @param {Object} options - Compression options
 * @param {boolean} options.deleteOriginal - Delete original after compression (default: false)
 * @param {boolean} options.forceStreaming - Force streaming mode (default: false)
 * @returns {Promise<{compressed: boolean, originalSize: number, compressedSize: number, ratio: number, path: string}>}
 */
export async function compressArtifact(sourcePath, options = {}) {
  const { deleteOriginal = false, forceStreaming = false } = options;

  if (!existsSync(sourcePath)) {
    throw new Error(`Artifact not found: ${sourcePath}`);
  }

  const stats = await stat(sourcePath);
  const originalSize = stats.size;

  // Skip if below threshold
  if (!shouldCompress(originalSize) && !forceStreaming) {
    return {
      compressed: false,
      originalSize,
      compressedSize: originalSize,
      ratio: 0,
      path: sourcePath,
      reason: 'Below compression threshold',
    };
  }

  const compressedPath = getCompressedPath(sourcePath);
  const useStreaming = forceStreaming || shouldUseStreaming(originalSize);

  try {
    if (useStreaming) {
      // Issue 5.2b: Streaming compression for large files
      await pipeline(
        createReadStream(sourcePath),
        createGzip({ level: 6 }), // Balanced compression level
        createWriteStream(compressedPath)
      );
    } else {
      // In-memory compression for smaller files
      const content = await readFile(sourcePath);
      const compressed = await gzipAsync(content, { level: 6 });
      await writeFile(compressedPath, compressed);
    }

    const compressedStats = await stat(compressedPath);
    const compressedSize = compressedStats.size;
    const ratio = (((originalSize - compressedSize) / originalSize) * 100).toFixed(1);

    // Optionally delete original
    if (deleteOriginal) {
      await unlink(sourcePath);
    }

    return {
      compressed: true,
      originalSize,
      compressedSize,
      ratio: parseFloat(ratio),
      path: compressedPath,
      streaming: useStreaming,
    };
  } catch (error) {
    // Clean up partial compressed file on error
    try {
      if (existsSync(compressedPath)) {
        await unlink(compressedPath);
      }
    } catch {
      // Ignore cleanup errors
    }
    throw new Error(`Compression failed: ${error.message}`);
  }
}

/**
 * Decompress .gz artifact (Issue 5.2a)
 * Uses streaming for large files
 *
 * @param {string} compressedPath - Compressed artifact path (.gz)
 * @param {Object} options - Decompression options
 * @param {string} options.destPath - Destination path (default: original path without .gz)
 * @param {boolean} options.deleteCompressed - Delete compressed after extraction (default: false)
 * @param {boolean} options.forceStreaming - Force streaming mode (default: false)
 * @returns {Promise<{decompressed: boolean, originalSize: number, decompressedSize: number, path: string}>}
 */
export async function decompressArtifact(compressedPath, options = {}) {
  const {
    destPath = compressedPath.replace(/\.gz$/, ''),
    deleteCompressed = false,
    forceStreaming = false,
  } = options;

  if (!existsSync(compressedPath)) {
    throw new Error(`Compressed artifact not found: ${compressedPath}`);
  }

  const stats = await stat(compressedPath);
  const compressedSize = stats.size;

  // Estimate uncompressed size (assume ~3x compression ratio for text)
  const estimatedUncompressedSize = compressedSize * 3;
  const useStreaming = forceStreaming || shouldUseStreaming(estimatedUncompressedSize);

  try {
    if (useStreaming) {
      // Issue 5.2b: Streaming decompression for large files
      await pipeline(createReadStream(compressedPath), createGunzip(), createWriteStream(destPath));
    } else {
      // In-memory decompression for smaller files
      const compressed = await readFile(compressedPath);
      const decompressed = await gunzipAsync(compressed);
      await writeFile(destPath, decompressed);
    }

    const decompressedStats = await stat(destPath);
    const decompressedSize = decompressedStats.size;

    // Optionally delete compressed
    if (deleteCompressed) {
      await unlink(compressedPath);
    }

    return {
      decompressed: true,
      originalSize: compressedSize,
      decompressedSize,
      path: destPath,
      streaming: useStreaming,
    };
  } catch (error) {
    // Clean up partial decompressed file on error
    try {
      if (existsSync(destPath)) {
        await unlink(destPath);
      }
    } catch {
      // Ignore cleanup errors
    }
    throw new Error(`Decompression failed: ${error.message}`);
  }
}

/**
 * Read artifact with automatic decompression (Issue 5.2a)
 * Transparently handles both compressed and uncompressed artifacts
 *
 * @param {string} artifactPath - Artifact path (with or without .gz)
 * @param {Object} options - Read options
 * @param {string} options.encoding - File encoding (default: 'utf-8')
 * @returns {Promise<{content: string|Buffer, compressed: boolean, size: number}>}
 */
export async function readArtifact(artifactPath, options = {}) {
  const { encoding = 'utf-8' } = options;

  // Check for compressed version first
  const compressedPath = getCompressedPath(artifactPath);
  const isCompressed = existsSync(compressedPath);
  const actualPath = isCompressed ? compressedPath : artifactPath;

  if (!existsSync(actualPath)) {
    throw new Error(`Artifact not found: ${artifactPath}`);
  }

  const stats = await stat(actualPath);

  if (isCompressed) {
    // Decompress and read
    const useStreaming = shouldUseStreaming(stats.size * 3); // Estimate uncompressed

    if (useStreaming) {
      // For very large files, stream to temp file then read
      const tempPath = `${artifactPath}.tmp.${process.pid}`;
      try {
        await pipeline(createReadStream(actualPath), createGunzip(), createWriteStream(tempPath));
        const content = await readFile(tempPath, encoding);
        await unlink(tempPath);
        return { content, compressed: true, size: content.length };
      } catch (error) {
        try {
          await unlink(tempPath);
        } catch {}
        throw error;
      }
    } else {
      // In-memory decompression
      const compressed = await readFile(actualPath);
      const decompressed = await gunzipAsync(compressed);
      const content = encoding ? decompressed.toString(encoding) : decompressed;
      return { content, compressed: true, size: decompressed.length };
    }
  } else {
    // Read uncompressed
    const content = await readFile(actualPath, encoding);
    return { content, compressed: false, size: stats.size };
  }
}

/**
 * Write artifact with automatic compression for large content (Issue 5.2a)
 *
 * @param {string} artifactPath - Artifact path
 * @param {string|Buffer} content - Content to write
 * @param {Object} options - Write options
 * @param {boolean} options.compress - Force compression (default: auto based on size)
 * @param {boolean} options.keepUncompressed - Keep uncompressed version too (default: false)
 * @returns {Promise<{path: string, compressed: boolean, originalSize: number, finalSize: number, ratio: number}>}
 */
export async function writeArtifact(artifactPath, content, options = {}) {
  const { compress, keepUncompressed = false } = options;
  const contentBuffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf-8');
  const originalSize = contentBuffer.length;

  // Determine if we should compress
  const shouldCompressArtifact = compress !== undefined ? compress : shouldCompress(originalSize);

  // Ensure directory exists
  const dir = dirname(artifactPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  if (shouldCompressArtifact) {
    // Write compressed version
    const compressedPath = getCompressedPath(artifactPath);

    if (shouldUseStreaming(originalSize)) {
      // Write uncompressed first, then stream compress
      await writeFile(artifactPath, contentBuffer);
      const result = await compressArtifact(artifactPath, {
        deleteOriginal: !keepUncompressed,
      });
      return {
        path: result.path,
        compressed: true,
        originalSize,
        finalSize: result.compressedSize,
        ratio: result.ratio,
      };
    } else {
      // In-memory compression
      const compressed = await gzipAsync(contentBuffer, { level: 6 });
      await writeFile(compressedPath, compressed);

      if (keepUncompressed) {
        await writeFile(artifactPath, contentBuffer);
      }

      const ratio = (((originalSize - compressed.length) / originalSize) * 100).toFixed(1);
      return {
        path: compressedPath,
        compressed: true,
        originalSize,
        finalSize: compressed.length,
        ratio: parseFloat(ratio),
      };
    }
  } else {
    // Write uncompressed
    await writeFile(artifactPath, contentBuffer);
    return {
      path: artifactPath,
      compressed: false,
      originalSize,
      finalSize: originalSize,
      ratio: 0,
    };
  }
}

/**
 * Get read stream for artifact with automatic decompression (Issue 5.2b)
 * For very large artifacts that shouldn't be loaded into memory
 *
 * @param {string} artifactPath - Artifact path
 * @returns {{stream: ReadStream, compressed: boolean, path: string}}
 */
export function getArtifactStream(artifactPath) {
  const compressedPath = getCompressedPath(artifactPath);
  const isCompressed = existsSync(compressedPath);
  const actualPath = isCompressed ? compressedPath : artifactPath;

  if (!existsSync(actualPath)) {
    throw new Error(`Artifact not found: ${artifactPath}`);
  }

  const readStream = createReadStream(actualPath);

  if (isCompressed) {
    // Pipe through gunzip
    const gunzipStream = createGunzip();
    readStream.pipe(gunzipStream);
    return {
      stream: gunzipStream,
      compressed: true,
      path: actualPath,
    };
  } else {
    return {
      stream: readStream,
      compressed: false,
      path: actualPath,
    };
  }
}

/**
 * Get write stream for artifact with optional compression (Issue 5.2b)
 *
 * @param {string} artifactPath - Artifact path
 * @param {Object} options - Stream options
 * @param {boolean} options.compress - Enable compression (default: false)
 * @returns {{stream: WriteStream, compressed: boolean, path: string}}
 */
export function getArtifactWriteStream(artifactPath, options = {}) {
  const { compress = false } = options;

  // Ensure directory exists
  const dir = dirname(artifactPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  if (compress) {
    const compressedPath = getCompressedPath(artifactPath);
    const gzipStream = createGzip({ level: 6 });
    const writeStream = createWriteStream(compressedPath);
    gzipStream.pipe(writeStream);
    return {
      stream: gzipStream,
      compressed: true,
      path: compressedPath,
    };
  } else {
    return {
      stream: createWriteStream(artifactPath),
      compressed: false,
      path: artifactPath,
    };
  }
}

/**
 * Get artifact metadata including compression status
 *
 * @param {string} artifactPath - Artifact path
 * @returns {Promise<{exists: boolean, compressed: boolean, size: number, uncompressedSize?: number, path: string}>}
 */
export async function getArtifactMetadata(artifactPath) {
  const compressedPath = getCompressedPath(artifactPath);
  const isCompressed = existsSync(compressedPath);
  const actualPath = isCompressed ? compressedPath : artifactPath;

  if (!existsSync(actualPath)) {
    return { exists: false, compressed: false, size: 0, path: actualPath };
  }

  const stats = await stat(actualPath);

  if (isCompressed) {
    return {
      exists: true,
      compressed: true,
      size: stats.size,
      uncompressedSize: stats.size * 3, // Estimate
      path: actualPath,
    };
  }

  return {
    exists: true,
    compressed: false,
    size: stats.size,
    path: actualPath,
  };
}

export default {
  getArtifactPath,
  getReportPath,
  getTaskPath,
  getGatePath,
  getReasoningPath,
  getArtifactDir,
  getRunDirectories,
  ensureRunDirectories,
  migrateLegacyPath,
  // Issue 5.2: Compression support
  getFileSize,
  shouldCompress,
  shouldUseStreaming,
  getCompressedPath,
  hasCompressedVersion,
  compressArtifact,
  decompressArtifact,
  readArtifact,
  writeArtifact,
  getArtifactStream,
  getArtifactWriteStream,
  getArtifactMetadata,
  // Thresholds
  COMPRESSION_THRESHOLD_BYTES,
  STREAMING_THRESHOLD_BYTES,
};
