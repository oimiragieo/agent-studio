/**
 * Enterprise Claude Agent SDK
 * @module @anthropic-ai/claude-agent-sdk
 *
 * @example
 * ```typescript
 * import { query, ClaudeSDKClient, tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
 *
 * // Single-turn query
 * for await (const message of query('Hello, Claude!', { model: 'sonnet' })) {
 *   console.log(message);
 * }
 *
 * // Multi-turn conversation
 * const client = new ClaudeSDKClient({ model: 'opus' });
 * await client.connect();
 * await client.query('First question');
 * for await (const msg of client.receiveResponse()) {
 *   console.log(msg);
 * }
 * await client.disconnect();
 * ```
 */

export { query, ClaudeSDKClient, withClient } from './client/index.js';

export * from './types/index.js';

export { tool, createSdkMcpServer } from './mcp/index.js';

export {
  PermissionManager,
  checkPermission,
  createPermissionRule,
} from './permissions/index.js';

export {
  SessionManager,
  createSession,
  loadSession,
  saveSession,
} from './session/index.js';

export {
  StreamingManager,
  enableFineGrainedStreaming,
  createStreamingConfig,
} from './streaming/index.js';

export {
  GuardrailManager,
  validateInput,
  detectJailbreak,
  preventHallucination,
} from './guardrails/index.js';

export {
  CostTracker,
  calculateCost,
  trackUsage,
} from './tracking/index.js';

export {
  ToolManager,
  registerTool,
  executeTool,
} from './tools/index.js';

export {
  MCPManager,
  connectMCPServer,
  listMCPResources,
} from './mcp/index.js';

export {
  HookManager,
  registerHook,
  fireHook,
} from './hooks/index.js';

// Version
export const VERSION = '1.0.0';

// Default export
export default {
  query,
  ClaudeSDKClient,
  withClient,
  tool,
  createSdkMcpServer,
  VERSION,
};
