#!/usr/bin/env node
/**
 * Streaming JSON Parser
 * Parses large JSON files with memory limits using true streaming
 */

import { createReadStream } from 'fs';
import { statSync } from 'fs';
import streamChain from 'stream-chain';
import streamJson from 'stream-json';
import StreamValues from 'stream-json/streamers/StreamValues.js';
import StreamObject from 'stream-json/streamers/StreamObject.js';

const { chain } = streamChain;
const { parser } = streamJson;
const { streamValues } = StreamValues;
const { streamObject } = StreamObject;

const DEFAULT_MAX_SIZE = 100 * 1024 * 1024; // 100MB

/**
 * Parse large JSON file using true streaming (avoids buffering entire file)
 * @param {string} filePath - Path to JSON file
 * @param {Object} options - Parser options
 * @param {number} options.maxSize - Maximum file size in bytes (default: 100MB)
 * @param {string} options.encoding - File encoding (default: 'utf-8')
 * @param {number} options.highWaterMark - Stream buffer size (default: 64KB)
 * @returns {Promise<Object>} Parsed JSON object
 */
export async function parseLargeJSON(filePath, options = {}) {
  const {
    maxSize = DEFAULT_MAX_SIZE,
    encoding = 'utf-8',
    highWaterMark = 64 * 1024, // 64KB chunks
  } = options;

  return new Promise((resolve, reject) => {
    let totalSize = 0;
    let isComplete = false;
    let result = null;

    const fileStream = createReadStream(filePath, {
      encoding,
      highWaterMark,
    });

    // Track file size without buffering
    fileStream.on('data', chunk => {
      totalSize += Buffer.byteLength(chunk, encoding);
      if (totalSize > maxSize) {
        fileStream.destroy();
        reject(
          new Error(`File ${filePath} exceeds size limit (${totalSize} bytes > ${maxSize} bytes)`)
        );
      }
    });

    // Use stream-json for true streaming parsing
    const pipeline = chain([fileStream, parser(), streamObject()]);

    // Build object from streaming key-value pairs
    const obj = {};
    pipeline.on('data', data => {
      if (isComplete) return;
      // data.key is the property name, data.value is the value
      obj[data.key] = data.value;
    });

    pipeline.on('end', () => {
      if (isComplete) return;
      isComplete = true;
      resolve(obj);
    });

    pipeline.on('error', error => {
      if (!isComplete) {
        isComplete = true;
        reject(new Error(`Failed to parse JSON from ${filePath}: ${error.message}`));
      }
    });

    fileStream.on('error', error => {
      if (!isComplete) {
        isComplete = true;
        reject(error);
      }
    });
  });
}

/**
 * Check if file should use streaming parser
 * @param {string} filePath - Path to file
 * @param {number} thresholdMB - Size threshold in MB (default: 1MB)
 * @returns {boolean} True if file should use streaming
 */
export function shouldUseStreaming(filePath, thresholdMB = 1) {
  try {
    const stats = statSync(filePath);
    const sizeMB = stats.size / 1024 / 1024;
    return sizeMB > thresholdMB;
  } catch (error) {
    // If we can't stat the file, default to not streaming
    return false;
  }
}
