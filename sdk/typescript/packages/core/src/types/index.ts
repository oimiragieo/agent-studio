/**
 * Enterprise Claude Agent SDK - Type Definitions
 * @module @anthropic-ai/claude-agent-sdk/types
 */

import type { MessageParam, ContentBlock } from '@anthropic-ai/sdk/resources/messages';

// ============================================================================
// Core Types
// ============================================================================

export type Model = 'sonnet' | 'opus' | 'haiku' | 'inherit';

export type PermissionMode = 'default' | 'plan' | 'acceptEdits' | 'bypassPermissions';

export type SettingSource = 'user' | 'project' | 'local';

// ============================================================================
// Message Types
// ============================================================================

export interface TextBlock {
  type: 'text';
  text: string;
}

export interface ThinkingBlock {
  type: 'thinking';
  thinking: string;
}

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string | ContentBlock[];
  is_error?: boolean;
}

export interface ImageBlock {
  type: 'image';
  source: {
    type: 'base64';
    media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
    data: string;
  };
}

export type MessageContent = TextBlock | ThinkingBlock | ToolUseBlock | ToolResultBlock | ImageBlock;

export interface SDKUserMessage {
  type: 'user';
  id: string;
  content: MessageContent[];
  timestamp: Date;
}

export interface SDKAssistantMessage {
  type: 'assistant';
  id: string;
  content: MessageContent[];
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' | null;
  model: string;
  usage: TokenUsage;
  timestamp: Date;
}

export interface SDKPartialAssistantMessage {
  type: 'assistant_partial';
  id: string;
  content: Partial<MessageContent>[];
  delta?: {
    type: 'text_delta' | 'thinking_delta' | 'tool_use_delta';
    text?: string;
    thinking?: string;
    partial_json?: string;
  };
  timestamp: Date;
}

export interface SDKSystemMessage {
  type: 'system';
  subtype: 'init' | 'compact' | 'clear' | 'notification';
  content: string;
  data?: {
    session_id?: string;
    slash_commands?: SlashCommand[];
    mcp_servers?: MCPServerStatus[];
    tokens_saved?: number;
    old_token_count?: number;
    new_token_count?: number;
  };
  timestamp: Date;
}

export interface SDKResultMessage {
  type: 'result';
  id: string;
  usage: CumulativeTokenUsage;
  cost: CostBreakdown;
  session_id: string;
  timestamp: Date;
}

export type SDKMessage =
  | SDKUserMessage
  | SDKAssistantMessage
  | SDKPartialAssistantMessage
  | SDKSystemMessage
  | SDKResultMessage;

// ============================================================================
// Token Usage & Cost Tracking
// ============================================================================

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export interface CumulativeTokenUsage extends TokenUsage {
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
}

export interface CostBreakdown {
  input_cost: number;
  output_cost: number;
  cache_creation_cost: number;
  cache_read_cost: number;
  total_cost: number;
  currency: 'USD';
}

export interface CostTracking {
  deduplicatedMessages: Set<string>;
  cumulativeUsage: CumulativeTokenUsage;
  costBreakdown: CostBreakdown;
  calculateCost(usage: TokenUsage): CostBreakdown;
  trackMessage(message: SDKAssistantMessage): void;
  reset(): void;
}

// ============================================================================
// Tool System
// ============================================================================

export interface Tool<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  input_schema: JSONSchema;
  handler: (input: TInput) => Promise<TOutput>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: JSONSchema;
}

export interface ToolUseRequest {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  tool_use_id: string;
  content: ContentBlock[];
  is_error?: boolean;
}

export type BuiltInTool =
  | 'Read'
  | 'Write'
  | 'Edit'
  | 'Glob'
  | 'Grep'
  | 'Bash'
  | 'NotebookEdit'
  | 'WebSearch'
  | 'WebFetch'
  | 'Task'
  | 'Memory'
  | 'TodoWrite'
  | 'Skill'
  | 'SlashCommand'
  | 'ListMcpResources'
  | 'ReadMcpResource';

// ============================================================================
// MCP (Model Context Protocol)
// ============================================================================

export interface MCPServerConfig {
  // stdio transport
  command?: string;
  args?: string[];
  env?: Record<string, string>;

  // HTTP/SSE transport
  url?: string;
  headers?: Record<string, string>;

  // SDK transport (in-process)
  tools?: Tool[];
  resources?: MCPResource[];
}

export interface MCPServerStatus {
  name: string;
  status: 'connected' | 'disconnected' | 'error';
  transport: 'stdio' | 'http' | 'sse' | 'sdk';
  error?: string;
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPToolDefinition extends ToolDefinition {
  server: string;
}

// ============================================================================
// Permissions
// ============================================================================

export interface PermissionCheckResult {
  allow: boolean;
  modifiedInput?: Record<string, unknown>;
  interrupt?: boolean;
  reason?: string;
}

export type CanUseToolCallback = (
  name: string,
  input: Record<string, unknown>
) => Promise<PermissionCheckResult> | PermissionCheckResult;

export interface PermissionRule {
  tool: string | string[];
  action: 'allow' | 'deny' | 'ask';
  condition?: (input: Record<string, unknown>) => boolean;
}

export interface PermissionConfig {
  mode: PermissionMode;
  allowedTools?: string[];
  disallowedTools?: string[];
  rules?: PermissionRule[];
  canUseTool?: CanUseToolCallback;
}

// ============================================================================
// Subagents
// ============================================================================

export interface SubagentConfig {
  description: string;
  prompt: string;
  tools?: string[];
  model?: Model;
  maxTokens?: number;
  temperature?: number;
}

export interface SubagentDefinition extends SubagentConfig {
  name: string;
}

// ============================================================================
// Skills
// ============================================================================

export interface SkillMetadata {
  name: string;
  description: string;
  allowed_tools?: string[];
  model?: Model;
  location: 'user' | 'project' | 'plugin';
}

export interface Skill extends SkillMetadata {
  content: string;
}

// ============================================================================
// Slash Commands
// ============================================================================

export interface SlashCommandMetadata {
  name: string;
  description?: string;
  allowed_tools?: string[];
  model?: Model;
  argument_hint?: string;
  location: 'user' | 'project';
}

export interface SlashCommand extends SlashCommandMetadata {
  content: string;
}

// ============================================================================
// Hooks
// ============================================================================

export type HookType =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'UserPromptSubmit'
  | 'Notification'
  | 'Stop'
  | 'PreCompact'
  | 'SessionStart'
  | 'SessionEnd';

export interface HookEvent {
  type: HookType;
  sessionId: string;
  cwd: string;
  timestamp: Date;
}

export interface PreToolUseEvent extends HookEvent {
  type: 'PreToolUse';
  tool: ToolUseRequest;
}

export interface PostToolUseEvent extends HookEvent {
  type: 'PostToolUse';
  tool: ToolUseRequest;
  result: ToolResult;
  duration: number;
}

export interface UserPromptSubmitEvent extends HookEvent {
  type: 'UserPromptSubmit';
  prompt: string;
}

export interface NotificationEvent extends HookEvent {
  type: 'Notification';
  message: string;
  level: 'info' | 'warning' | 'error';
}

export interface StopEvent extends HookEvent {
  type: 'Stop';
  reason: string;
}

export interface PreCompactEvent extends HookEvent {
  type: 'PreCompact';
  tokenCount: number;
}

export interface SessionStartEvent extends HookEvent {
  type: 'SessionStart';
  options: ClaudeAgentOptions;
}

export interface SessionEndEvent extends HookEvent {
  type: 'SessionEnd';
  usage: CumulativeTokenUsage;
  cost: CostBreakdown;
}

export type Hook<T extends HookEvent = HookEvent> = (event: T) => Promise<void> | void;

export interface HookConfig {
  PreToolUse?: Hook<PreToolUseEvent>;
  PostToolUse?: Hook<PostToolUseEvent>;
  UserPromptSubmit?: Hook<UserPromptSubmitEvent>;
  Notification?: Hook<NotificationEvent>;
  Stop?: Hook<StopEvent>;
  PreCompact?: Hook<PreCompactEvent>;
  SessionStart?: Hook<SessionStartEvent>;
  SessionEnd?: Hook<SessionEndEvent>;
}

// ============================================================================
// Streaming
// ============================================================================

export interface StreamingConfig {
  /**
   * Enable fine-grained streaming for 67% latency reduction
   * @default true
   */
  enableFineGrainedStreaming?: boolean;

  /**
   * Minimum parameter size (in characters) to use fine-grained streaming
   * @default 1000
   */
  fineGrainedStreamingThreshold?: number;

  /**
   * Enable partial message streaming
   * @default true
   */
  enablePartialMessages?: boolean;

  /**
   * Buffer size for streaming chunks
   * @default 8192
   */
  bufferSize?: number;
}

// ============================================================================
// Security & Guardrails
// ============================================================================

export interface GuardrailConfig {
  /**
   * Enable jailbreak detection and mitigation
   * @default true
   */
  enableJailbreakMitigation?: boolean;

  /**
   * Enable hallucination prevention techniques
   * @default true
   */
  enableHallucinationPrevention?: boolean;

  /**
   * Enable command validation for bash tool
   * @default true
   */
  enableCommandValidation?: boolean;

  /**
   * Block dangerous command patterns
   * @default ['rm -rf /', 'dd if=', 'mkfs', 'format']
   */
  blockPatterns?: string[];

  /**
   * PII detection and redaction
   */
  piiDetection?: {
    enabled: boolean;
    redact: boolean;
    patterns?: RegExp[];
  };

  /**
   * Enable prompt leak protection
   * @default true
   */
  enablePromptLeakProtection?: boolean;

  /**
   * Custom input validation
   */
  customValidation?: (input: string) => Promise<{ valid: boolean; reason?: string }>;
}

// ============================================================================
// Session
// ============================================================================

export interface SessionState {
  id: string;
  startTime: Date;
  messageHistory: SDKMessage[];
  tokenUsage: CumulativeTokenUsage;
  cost: CostBreakdown;
  tools: ToolUseRequest[];
  status: 'active' | 'paused' | 'completed' | 'error';
}

export interface SessionConfig {
  /**
   * Enable session persistence
   * @default false
   */
  persist?: boolean;

  /**
   * Session storage directory
   * @default '.claude/sessions'
   */
  storageDir?: string;

  /**
   * Automatic context compaction threshold (tokens)
   * @default 100000
   */
  compactionThreshold?: number;

  /**
   * Maximum session duration (ms)
   * @default undefined (no limit)
   */
  maxDuration?: number;
}

// ============================================================================
// Main SDK Options
// ============================================================================

export interface ClaudeAgentOptions {
  /**
   * Claude model to use
   * @default 'sonnet'
   */
  model?: Model;

  /**
   * Anthropic API key (or set ANTHROPIC_API_KEY env var)
   */
  apiKey?: string;

  /**
   * Working directory for file operations
   * @default process.cwd()
   */
  cwd?: string;

  /**
   * MCP server configurations
   */
  mcpServers?: Record<string, MCPServerConfig>;

  /**
   * Permission mode and configuration
   */
  permissionMode?: PermissionMode;
  permissions?: PermissionConfig;

  /**
   * Allowed tools (whitelist)
   */
  allowedTools?: string[];

  /**
   * Disallowed tools (blacklist)
   */
  disallowedTools?: string[];

  /**
   * System prompt (role definition)
   */
  systemPrompt?: string | SystemPromptPreset;

  /**
   * Setting sources to load
   * @default ['project']
   */
  settingSources?: SettingSource[];

  /**
   * Lifecycle hooks
   */
  hooks?: HookConfig;

  /**
   * Subagent definitions
   */
  agents?: Record<string, SubagentConfig>;

  /**
   * Streaming configuration
   */
  streaming?: StreamingConfig;

  /**
   * Security guardrails
   */
  guardrails?: GuardrailConfig;

  /**
   * Session configuration
   */
  session?: SessionConfig;

  /**
   * Max tokens for response
   * @default 4096
   */
  maxTokens?: number;

  /**
   * Temperature for response generation
   * @default 1.0
   */
  temperature?: number;

  /**
   * Enable extended thinking mode
   * @default false
   */
  extendedThinking?: boolean;

  /**
   * Timeout for API requests (ms)
   * @default 60000
   */
  timeout?: number;

  /**
   * Maximum retries for failed requests
   * @default 3
   */
  maxRetries?: number;
}

// ============================================================================
// System Prompt Presets
// ============================================================================

export type SystemPromptPreset =
  | 'code-assistant'
  | 'data-analyst'
  | 'legal-expert'
  | 'financial-advisor'
  | 'medical-assistant'
  | 'security-analyst'
  | 'devops-engineer'
  | 'product-manager'
  | 'ux-designer'
  | 'qa-engineer';

// ============================================================================
// Utility Types
// ============================================================================

export interface JSONSchema {
  type: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
  enum?: unknown[];
  [key: string]: unknown;
}

export type AsyncIterableInput<T> = AsyncIterable<T> | AsyncGenerator<T>;

export type PromptInput = string | AsyncIterableInput<string>;

// ============================================================================
// Error Types
// ============================================================================

export class ClaudeSDKError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ClaudeSDKError';
  }
}

export class PermissionDeniedError extends ClaudeSDKError {
  constructor(tool: string, reason?: string) {
    super(`Permission denied for tool: ${tool}${reason ? `. Reason: ${reason}` : ''}`, 'PERMISSION_DENIED');
    this.name = 'PermissionDeniedError';
  }
}

export class ToolExecutionError extends ClaudeSDKError {
  constructor(tool: string, error: unknown) {
    super(`Tool execution failed: ${tool}`, 'TOOL_EXECUTION_ERROR', error);
    this.name = 'ToolExecutionError';
  }
}

export class MCPConnectionError extends ClaudeSDKError {
  constructor(server: string, error: unknown) {
    super(`MCP server connection failed: ${server}`, 'MCP_CONNECTION_ERROR', error);
    this.name = 'MCPConnectionError';
  }
}

export class SessionError extends ClaudeSDKError {
  constructor(message: string, details?: unknown) {
    super(message, 'SESSION_ERROR', details);
    this.name = 'SessionError';
  }
}
