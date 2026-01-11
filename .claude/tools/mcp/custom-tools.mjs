#!/usr/bin/env node
/**
 * Custom Tools via MCP - Custom Tool Registration
 * Registers and validates custom tools via MCP
 * Based on: https://docs.claude.com/en/docs/agent-sdk/custom-tools.md
 */

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Validate tool schema
 */
export function validateToolSchema(tool) {
  const required = ['name', 'description', 'inputSchema'];
  const errors = [];

  for (const field of required) {
    if (!tool[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Validate inputSchema structure
  if (tool.inputSchema) {
    if (tool.inputSchema.type !== 'object') {
      errors.push('inputSchema.type must be "object"');
    }

    if (!tool.inputSchema.properties) {
      errors.push('inputSchema must have properties');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Register custom tool
 */
export function registerCustomTool(tool) {
  const validation = validateToolSchema(tool);

  if (!validation.valid) {
    throw new Error(`Invalid tool schema: ${validation.errors.join(', ')}`);
  }

  // In production, this would register with MCP connector
  return {
    success: true,
    tool: {
      name: tool.name,
      description: tool.description,
      version: tool.version || '1.0.0',
      registered_at: new Date().toISOString(),
    },
  };
}

/**
 * Load custom tool from file
 */
export async function loadCustomToolFromFile(toolPath) {
  const content = await readFile(toolPath, 'utf8');

  // Parse as ES module
  const module = await import(`file://${toolPath}`);

  if (!module.default && !module[toolPath]) {
    throw new Error('Tool file must export default tool or named export');
  }

  const tool = module.default || module[toolPath];
  return registerCustomTool(tool);
}

export default {
  validateToolSchema,
  registerCustomTool,
  loadCustomToolFromFile,
};
