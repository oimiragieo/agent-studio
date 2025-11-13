/**
 * Claude Agent SDK - Built-in Tools
 * Enterprise-grade tool implementations with security and performance optimization
 *
 * @module @anthropic-ai/claude-agent-sdk-tools
 */

// Export all tools
export { BashTool, createBashTool, type BashInput, type BashConfig } from './bash/bash-tool.js';
export { TextEditorTool, createTextEditorTool, type TextEditorInput } from './text-editor/text-editor-tool.js';
export { WebFetchTool, createWebFetchTool, type WebFetchInput } from './web-fetch/web-fetch-tool.js';
export { MemoryTool, createMemoryTool, type MemoryInput } from './memory/memory-tool.js';

// Re-export individual tool modules
export * as bash from './bash/bash-tool.js';
export * as textEditor from './text-editor/text-editor-tool.js';
export * as webFetch from './web-fetch/web-fetch-tool.js';
export * as memory from './memory/memory-tool.js';

// Tool registry
import { createBashTool } from './bash/bash-tool.js';
import { createTextEditorTool } from './text-editor/text-editor-tool.js';
import { createWebFetchTool } from './web-fetch/web-fetch-tool.js';
import { createMemoryTool } from './memory/memory-tool.js';
import type { Tool } from '@anthropic-ai/claude-agent-sdk';

/**
 * Create all built-in tools with default configuration
 */
export function createAllTools(config: {
  bash?: Parameters<typeof createBashTool>[0];
  textEditor?: Parameters<typeof createTextEditorTool>[0];
  webFetch?: Parameters<typeof createWebFetchTool>[0];
  memory?: Parameters<typeof createMemoryTool>[0];
} = {}): {
  bash: ReturnType<typeof createBashTool>;
  textEditor: ReturnType<typeof createTextEditorTool>;
  webFetch: ReturnType<typeof createWebFetchTool>;
  memory: ReturnType<typeof createMemoryTool>;
} {
  return {
    bash: createBashTool(config.bash),
    textEditor: createTextEditorTool(config.textEditor),
    webFetch: createWebFetchTool(config.webFetch),
    memory: createMemoryTool(config.memory),
  };
}

/**
 * Get array of all built-in tools for easy registration
 */
export function getAllTools(config?: Parameters<typeof createAllTools>[0]): Tool<any, any>[] {
  const tools = createAllTools(config);
  return Object.values(tools);
}

// Version
export const VERSION = '1.0.0';

// Default export
export default {
  createBashTool,
  createTextEditorTool,
  createWebFetchTool,
  createMemoryTool,
  createAllTools,
  getAllTools,
  VERSION,
};
