/**
 * A2A Message Wrapper
 *
 * Converts between A2A Message format and internal agent prompt format.
 * Supports text, file, and data Parts with bidirectional conversion.
 *
 * Features:
 * - toA2AMessage(): Convert internal prompts → A2A Message
 * - fromA2AMessage(): Extract prompts from A2A Message
 * - Part conversion: text/file/data support
 * - Feature flag integration
 * - Performance target: <10ms message wrapping
 *
 * @module message-wrapper
 */

import { randomUUID } from 'crypto';

/**
 * A2A Message Roles from specification
 */
export const Role = Object.freeze({
  UNSPECIFIED: 'ROLE_UNSPECIFIED',
  USER: 'ROLE_USER',
  AGENT: 'ROLE_AGENT',
});

/**
 * Feature flags for A2A message wrapper
 */
const FEATURE_FLAGS = {
  a2a_message_wrapper: process.env.A2A_MESSAGE_WRAPPER === 'true' || false,
};

/**
 * A2A Message Wrapper
 *
 * Converts between A2A Message format and internal format
 */
export class A2AMessageWrapper {
  /**
   * @param {object} options - Configuration options
   */
  constructor(options = {}) {
    this.featureFlags = options.featureFlags || FEATURE_FLAGS;
  }

  /**
   * Convert internal prompt to A2A Message
   *
   * @param {string|object} prompt - Internal prompt (string or object)
   * @param {object} options - Conversion options
   * @returns {object} A2A Message
   */
  toA2AMessage(prompt, options = {}) {
    const startTime = Date.now();

    if (!this.featureFlags.a2a_message_wrapper) {
      throw new Error('a2a_message_wrapper feature flag is disabled');
    }

    // Determine role
    const role = options.role || Role.USER;

    // Convert prompt to parts
    let parts;
    if (typeof prompt === 'string') {
      parts = [this.convertTextToPart(prompt)];
    } else if (typeof prompt === 'object' && prompt.parts) {
      // Already has parts
      parts = prompt.parts;
    } else if (typeof prompt === 'object') {
      // Convert object to data part
      parts = [{ data: prompt }];
    } else {
      throw new Error('Invalid prompt: must be string or object');
    }

    // Build A2A Message
    const message = {
      messageId: options.messageId || `msg-${randomUUID()}`,
      role,
      parts,
      metadata: options.metadata || {},
    };

    // Add optional fields
    if (options.contextId) {
      message.contextId = options.contextId;
    }
    if (options.taskId) {
      message.taskId = options.taskId;
    }

    const duration = Date.now() - startTime;

    console.log(`[Message Wrapper] Converted prompt to A2A Message in ${duration}ms`);

    return message;
  }

  /**
   * Extract prompt from A2A Message
   *
   * @param {object} message - A2A Message
   * @returns {object} Internal prompt format
   */
  fromA2AMessage(message) {
    const startTime = Date.now();

    if (!this.featureFlags.a2a_message_wrapper) {
      throw new Error('a2a_message_wrapper feature flag is disabled');
    }

    // Validate message
    if (!message || !message.parts || !Array.isArray(message.parts)) {
      throw new Error('Invalid A2A Message: parts array required');
    }

    // Extract text content from parts
    const textContent = this.convertPartsToText(message.parts);

    // Extract data from parts
    const dataParts = message.parts.filter(p => p.data);

    // Extract files from parts
    const fileParts = message.parts.filter(p => p.file);

    // Build internal format
    const prompt = {
      messageId: message.messageId,
      contextId: message.contextId,
      taskId: message.taskId,
      role: message.role === Role.USER ? 'user' : 'agent',
      content: textContent,
      data: dataParts.length > 0 ? dataParts.map(p => p.data) : undefined,
      files: fileParts.length > 0 ? fileParts.map(p => p.file) : undefined,
      metadata: message.metadata || {},
    };

    const duration = Date.now() - startTime;

    console.log(`[Message Wrapper] Extracted prompt from A2A Message in ${duration}ms`);

    return prompt;
  }

  /**
   * Convert text to A2A TextPart
   *
   * @param {string} text - Text content
   * @returns {object} A2A TextPart
   */
  convertTextToPart(text) {
    if (typeof text !== 'string') {
      throw new Error('Text must be a string');
    }

    return { text };
  }

  /**
   * Convert A2A Parts to text
   *
   * @param {Array} parts - A2A Parts
   * @returns {string} Combined text content
   */
  convertPartsToText(parts) {
    if (!Array.isArray(parts)) {
      throw new Error('Parts must be an array');
    }

    return parts
      .filter(p => p.text)
      .map(p => p.text)
      .join('\n\n');
  }

  /**
   * Convert file to A2A FilePart
   *
   * @param {object} file - File object
   * @returns {object} A2A FilePart
   */
  convertFileToPart(file) {
    if (!file || !file.name) {
      throw new Error('File must have a name');
    }

    const filePart = {
      file: {
        name: file.name,
        mime_type: file.mimeType || file.mime_type || 'application/octet-stream',
      },
    };

    // Add URI or bytes
    if (file.uri) {
      filePart.file.uri = file.uri;
    } else if (file.bytes) {
      filePart.file.bytes = file.bytes;
    }

    return filePart;
  }

  /**
   * Convert data to A2A DataPart
   *
   * @param {object} data - JSON data
   * @returns {object} A2A DataPart
   */
  convertDataToPart(data) {
    if (typeof data !== 'object' || data === null) {
      throw new Error('Data must be an object');
    }

    return { data };
  }

  /**
   * Validate A2A Message structure
   *
   * @param {object} message - A2A Message
   * @returns {object} Validation result
   */
  validateMessage(message) {
    const errors = [];

    // Check required fields
    if (!message) {
      return { valid: false, errors: ['Message is null or undefined'] };
    }

    if (!message.role) {
      errors.push('Missing required field: role');
    } else if (!Object.values(Role).includes(message.role)) {
      errors.push(`Invalid role: ${message.role}`);
    }

    if (!message.parts) {
      errors.push('Missing required field: parts');
    } else if (!Array.isArray(message.parts)) {
      errors.push('parts must be an array');
    } else if (message.parts.length === 0) {
      errors.push('parts must have at least one element');
    } else {
      // Validate each part
      for (let i = 0; i < message.parts.length; i++) {
        const part = message.parts[i];
        const hasText = 'text' in part;
        const hasFile = 'file' in part;
        const hasData = 'data' in part;

        if (!hasText && !hasFile && !hasData) {
          errors.push(`Part ${i} must have text, file, or data`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Create multi-part message
   *
   * @param {Array} parts - Array of parts (text/file/data)
   * @param {object} options - Message options
   * @returns {object} A2A Message
   */
  createMultiPartMessage(parts, options = {}) {
    if (!Array.isArray(parts)) {
      throw new Error('Parts must be an array');
    }

    // Convert parts to A2A format
    const a2aParts = parts.map(part => {
      if (typeof part === 'string') {
        return this.convertTextToPart(part);
      } else if (part.file) {
        return this.convertFileToPart(part);
      } else if (part.data || typeof part === 'object') {
        return this.convertDataToPart(part.data || part);
      } else {
        throw new Error('Invalid part type');
      }
    });

    return this.toA2AMessage({ parts: a2aParts }, options);
  }
}

/**
 * Create A2A Message Wrapper
 *
 * @param {object} options - Configuration options
 * @returns {A2AMessageWrapper}
 */
export function createMessageWrapper(options = {}) {
  return new A2AMessageWrapper(options);
}
