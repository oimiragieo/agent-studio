/**
 * Streaming File Reader - Memory-efficient file operations
 *
 * @module streaming-file-reader
 * @version 1.0.0
 * @created 2026-01-12
 *
 * Purpose: Prevent heap exhaustion by streaming files instead of loading into memory
 *
 * Architecture:
 * - Never loads entire file into memory
 * - Processes line-by-line or chunk-by-chunk
 * - Hard limits to prevent memory bloat
 * - Compatible with existing Read tool API
 *
 * Memory Benefits:
 * - 10-100x memory reduction for large files
 * - Only requested lines allocated
 * - Stream destroyed when done
 * - No full-file string allocation
 */

import fs from 'fs';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import path from 'path';

/**
 * Hard limits to prevent memory bloat
 */
const LIMITS = {
  MAX_LINE_LENGTH: 2000, // Truncate lines longer than this
  MAX_LINES: 2000, // Maximum lines to return
  CHUNK_SIZE: 64 * 1024, // 64KB chunks for streaming
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB warning threshold
};

/**
 * Streaming File Reader - Memory-efficient file operations
 */
class StreamingFileReader {
  /**
   * Async generator for line-by-line reading
   *
   * @param {string} filePath - Absolute path to file
   * @param {Object} options - Streaming options
   * @param {string} options.encoding - File encoding (default: 'utf-8')
   * @param {number} options.highWaterMark - Buffer size (default: 64KB)
   * @yields {string} Individual lines from file
   *
   * @example
   * for await (const line of StreamingFileReader.readLines('/path/to/file.txt')) {
   *   console.log(line);
   * }
   */
  static async *readLines(filePath, options = {}) {
    const { encoding = 'utf-8', highWaterMark = LIMITS.CHUNK_SIZE } = options;

    // Validate file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Create read stream
    const fileStream = createReadStream(filePath, {
      encoding,
      highWaterMark,
    });

    // Create readline interface
    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity, // Recognize all CR LF instances
    });

    try {
      for await (const line of rl) {
        yield line;
      }
    } finally {
      // Ensure stream is closed
      rl.close();
      fileStream.destroy();
    }
  }

  /**
   * Read file with offset/limit (compatible with Read tool API)
   *
   * @param {string} filePath - Absolute path to file
   * @param {Object} options - Read options
   * @param {number} options.offset - Line number to start from (0-indexed)
   * @param {number} options.limit - Maximum lines to return
   * @param {number} options.maxLineLength - Truncate lines longer than this
   * @returns {Promise<string[]>} Array of lines
   *
   * @example
   * const lines = await StreamingFileReader.readFile('/path/to/file.txt', {
   *   offset: 100,
   *   limit: 50,
   *   maxLineLength: 2000
   * });
   */
  static async readFile(filePath, options = {}) {
    const {
      offset = 0,
      limit = LIMITS.MAX_LINES,
      maxLineLength = LIMITS.MAX_LINE_LENGTH,
    } = options;

    // Enforce hard limits
    const safeLimit = Math.min(limit, LIMITS.MAX_LINES);
    const safeMaxLineLength = Math.min(maxLineLength, LIMITS.MAX_LINE_LENGTH);

    const lines = [];
    let lineNum = 0;

    try {
      for await (const line of this.readLines(filePath)) {
        // Stop when we've read enough lines
        if (lineNum >= offset + safeLimit) {
          break;
        }

        // Only collect lines in the requested range
        if (lineNum >= offset) {
          const truncated =
            line.length > safeMaxLineLength
              ? line.substring(0, safeMaxLineLength) + '...[truncated]'
              : line;
          lines.push(truncated);
        }

        lineNum++;
      }
    } catch (error) {
      throw new Error(`Failed to read file ${filePath}: ${error.message}`);
    }

    return lines;
  }

  /**
   * Search file for pattern without loading full file
   *
   * @param {string} filePath - Absolute path to file
   * @param {string|RegExp} pattern - Search pattern
   * @param {Object} options - Search options
   * @param {boolean} options.caseInsensitive - Case-insensitive search
   * @param {number} options.maxMatches - Maximum matches to return
   * @param {number} options.contextLines - Lines of context before/after match
   * @returns {Promise<Array>} Array of match objects
   *
   * @example
   * const matches = await StreamingFileReader.searchFile('/path/to/file.txt',
   *   /error/i,
   *   { maxMatches: 10, contextLines: 2 }
   * );
   */
  static async searchFile(filePath, pattern, options = {}) {
    const { caseInsensitive = false, maxMatches = 100, contextLines = 0 } = options;

    // Convert string pattern to RegExp
    const regex =
      typeof pattern === 'string' ? new RegExp(pattern, caseInsensitive ? 'i' : '') : pattern;

    const matches = [];
    let lineNum = 0;
    const contextBuffer = []; // For context lines

    try {
      for await (const line of this.readLines(filePath)) {
        lineNum++;

        // Maintain context buffer
        if (contextLines > 0) {
          contextBuffer.push({ lineNum, line });
          if (contextBuffer.length > contextLines) {
            contextBuffer.shift();
          }
        }

        // Check for match
        if (regex.test(line)) {
          const match = {
            lineNum,
            line: line.substring(0, LIMITS.MAX_LINE_LENGTH),
            context: contextLines > 0 ? [...contextBuffer.slice(0, -1)] : [],
          };

          matches.push(match);

          // Stop if max matches reached
          if (matches.length >= maxMatches) {
            break;
          }
        }
      }
    } catch (error) {
      throw new Error(`Failed to search file ${filePath}: ${error.message}`);
    }

    return matches;
  }

  /**
   * Count lines without loading file into memory
   *
   * @param {string} filePath - Absolute path to file
   * @returns {Promise<number>} Total line count
   *
   * @example
   * const lineCount = await StreamingFileReader.countLines('/path/to/file.txt');
   * console.log(`File has ${lineCount} lines`);
   */
  static async countLines(filePath) {
    let count = 0;

    try {
      for await (const _ of this.readLines(filePath)) {
        count++;
      }
    } catch (error) {
      throw new Error(`Failed to count lines in ${filePath}: ${error.message}`);
    }

    return count;
  }

  /**
   * Get file stats and check size threshold
   *
   * @param {string} filePath - Absolute path to file
   * @returns {Promise<Object>} File stats with warnings
   *
   * @example
   * const stats = await StreamingFileReader.getFileStats('/path/to/file.txt');
   * if (stats.warning) console.warn(stats.warning);
   */
  static async getFileStats(filePath) {
    try {
      const stats = fs.statSync(filePath);
      const sizeMB = stats.size / (1024 * 1024);

      return {
        size: stats.size,
        sizeMB: sizeMB.toFixed(2),
        modified: stats.mtime,
        warning:
          sizeMB > LIMITS.MAX_FILE_SIZE / (1024 * 1024)
            ? `Large file (${sizeMB.toFixed(2)}MB) - streaming recommended`
            : null,
      };
    } catch (error) {
      throw new Error(`Failed to get stats for ${filePath}: ${error.message}`);
    }
  }

  /**
   * Read file chunk-by-chunk (for binary or non-line-based processing)
   *
   * @param {string} filePath - Absolute path to file
   * @param {Object} options - Chunk options
   * @param {number} options.chunkSize - Size of each chunk
   * @param {number} options.maxChunks - Maximum chunks to read
   * @yields {Buffer} File chunks
   *
   * @example
   * for await (const chunk of StreamingFileReader.readChunks('/path/to/file.bin')) {
   *   processChunk(chunk);
   * }
   */
  static async *readChunks(filePath, options = {}) {
    const { chunkSize = LIMITS.CHUNK_SIZE, maxChunks = Infinity } = options;

    const stream = createReadStream(filePath, {
      highWaterMark: chunkSize,
    });

    let chunkCount = 0;

    try {
      for await (const chunk of stream) {
        yield chunk;
        chunkCount++;

        if (chunkCount >= maxChunks) {
          break;
        }
      }
    } finally {
      stream.destroy();
    }
  }
}

/**
 * Export class and limits
 */
export { StreamingFileReader, LIMITS };

/**
 * Export convenience functions for backward compatibility
 */
export const readLines = StreamingFileReader.readLines.bind(StreamingFileReader);
export const readFile = StreamingFileReader.readFile.bind(StreamingFileReader);
export const searchFile = StreamingFileReader.searchFile.bind(StreamingFileReader);
export const countLines = StreamingFileReader.countLines.bind(StreamingFileReader);
export const getFileStats = StreamingFileReader.getFileStats.bind(StreamingFileReader);
export const readChunks = StreamingFileReader.readChunks.bind(StreamingFileReader);
