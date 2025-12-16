#!/usr/bin/env node
/**
 * Native Tools Registry
 * Registers and manages all native Agent SDK tools
 */

import { bashTool } from './bash-tool.mjs';
import { codeExecutionTool } from './code-execution-tool.mjs';
import { textEditorTool } from './text-editor-tool.mjs';
import { webFetchTool } from './web-fetch-tool.mjs';
import { webSearchTool } from './web-search-tool.mjs';
import { memoryTool } from './memory-tool.mjs';
import { computerUseTool } from './computer-use-tool.mjs';

/**
 * Registry of all native tools
 */
export const nativeTools = {
  bash: bashTool,
  code_execution: codeExecutionTool,
  text_editor: textEditorTool,
  web_fetch: webFetchTool,
  web_search: webSearchTool,
  memory: memoryTool,
  computer_use: computerUseTool
};

/**
 * Get tool by name
 */
export function getTool(name) {
  return nativeTools[name];
}

/**
 * Get all registered tools
 */
export function getAllTools() {
  return Object.values(nativeTools);
}

/**
 * Get tool names
 */
export function getToolNames() {
  return Object.keys(nativeTools);
}

/**
 * Register a custom tool
 */
export function registerTool(name, tool) {
  if (nativeTools[name]) {
    throw new Error(`Tool ${name} is already registered`);
  }
  
  nativeTools[name] = tool;
  return tool;
}

/**
 * Get tool metadata
 */
export function getToolMetadata(name) {
  const tool = getTool(name);
  if (!tool) {
    return null;
  }

  return {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    version: tool.version || '1.0.0'
  };
}

/**
 * Generate documentation for all tools
 */
export function generateToolDocumentation() {
  const docs = {
    version: '1.0.0',
    generated_at: new Date().toISOString(),
    tools: {}
  };

  for (const [name, tool] of Object.entries(nativeTools)) {
    docs.tools[name] = {
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      version: tool.version || '1.0.0'
    };
  }

  return docs;
}

export default {
  nativeTools,
  getTool,
  getAllTools,
  getToolNames,
  registerTool,
  getToolMetadata,
  generateToolDocumentation
};

