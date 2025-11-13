/**
 * Enterprise Claude Agent SDK - Main Client
 * @module @anthropic-ai/claude-agent-sdk/client
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  ClaudeAgentOptions,
  SDKMessage,
  PromptInput,
  Model,
  SessionState,
  ToolUseRequest,
  ToolResult,
  TokenUsage,
  CumulativeTokenUsage,
  CostBreakdown,
} from '../types/index.js';
import { ClaudeSDKError, SessionError } from '../types/index.js';
import { SessionManager } from '../session/session-manager.js';
import { PermissionManager } from '../permissions/permission-manager.js';
import { ToolManager } from '../tools/tool-manager.js';
import { MCPManager } from '../mcp/mcp-manager.js';
import { StreamingManager } from '../streaming/streaming-manager.js';
import { GuardrailManager } from '../guardrails/guardrail-manager.js';
import { CostTracker } from '../tracking/cost-tracker.js';
import { HookManager } from '../hooks/hook-manager.js';
import { v4 as uuidv4 } from 'uuid';

const MODEL_MAP: Record<Model, string> = {
  sonnet: 'claude-sonnet-4-5-20250929',
  opus: 'claude-opus-4-20250514',
  haiku: 'claude-haiku-4-5-20250702',
  inherit: 'claude-sonnet-4-5-20250929', // default
};

/**
 * Main query function for single-turn interactions
 *
 * @example
 * ```typescript
 * import { query } from '@anthropic-ai/claude-agent-sdk';
 *
 * // Simple query
 * for await (const message of query('Hello, Claude!')) {
 *   console.log(message);
 * }
 *
 * // With options
 * for await (const message of query('Analyze this code', {
 *   model: 'opus',
 *   systemPrompt: 'code-assistant',
 *   allowedTools: ['Read', 'Grep', 'Glob']
 * })) {
 *   console.log(message);
 * }
 *
 * // Streaming input
 * async function* generatePrompts() {
 *   yield 'First part';
 *   yield 'Second part';
 * }
 * for await (const message of query(generatePrompts(), options)) {
 *   console.log(message);
 * }
 * ```
 */
export async function* query(
  prompt: PromptInput,
  options: ClaudeAgentOptions = {}
): AsyncGenerator<SDKMessage> {
  const client = new ClaudeSDKClient(options);

  try {
    await client.connect();

    // Handle streaming input
    if (typeof prompt === 'string') {
      await client.query(prompt);
    } else {
      // AsyncIterable input
      for await (const part of prompt) {
        await client.query(part);
      }
    }

    // Yield all responses
    for await (const message of client.receiveResponse()) {
      yield message;
    }

    // Yield final result message
    const result = client.getResult();
    if (result) {
      yield result;
    }
  } finally {
    await client.disconnect();
  }
}

/**
 * Main SDK client for multi-turn conversations
 *
 * @example
 * ```typescript
 * import { ClaudeSDKClient } from '@anthropic-ai/claude-agent-sdk';
 *
 * const client = new ClaudeSDKClient({
 *   model: 'sonnet',
 *   systemPrompt: 'You are a helpful coding assistant',
 *   allowedTools: ['Read', 'Write', 'Bash']
 * });
 *
 * await client.connect();
 *
 * // First query
 * await client.query('Read the package.json file');
 * for await (const msg of client.receiveResponse()) {
 *   console.log(msg);
 * }
 *
 * // Follow-up query (maintains context)
 * await client.query('What version is it?');
 * for await (const msg of client.receiveResponse()) {
 *   console.log(msg);
 * }
 *
 * await client.disconnect();
 * ```
 */
export class ClaudeSDKClient {
  private options: Required<ClaudeAgentOptions>;
  private anthropic: Anthropic;
  private sessionManager: SessionManager;
  private permissionManager: PermissionManager;
  private toolManager: ToolManager;
  private mcpManager: MCPManager;
  private streamingManager: StreamingManager;
  private guardrailManager: GuardrailManager;
  private costTracker: CostTracker;
  private hookManager: HookManager;
  private connected: boolean = false;
  private currentPrompt: string | null = null;
  private messageQueue: string[] = [];

  constructor(options: ClaudeAgentOptions = {}) {
    // Merge with defaults
    this.options = this.mergeWithDefaults(options);

    // Initialize Anthropic client
    this.anthropic = new Anthropic({
      apiKey: this.options.apiKey || process.env.ANTHROPIC_API_KEY,
    });

    // Initialize managers
    this.sessionManager = new SessionManager(this.options.session);
    this.permissionManager = new PermissionManager(this.options.permissions);
    this.toolManager = new ToolManager(this.options.allowedTools, this.options.disallowedTools);
    this.mcpManager = new MCPManager(this.options.mcpServers);
    this.streamingManager = new StreamingManager(this.options.streaming);
    this.guardrailManager = new GuardrailManager(this.options.guardrails);
    this.costTracker = new CostTracker();
    this.hookManager = new HookManager(this.options.hooks);
  }

  /**
   * Connect to the SDK and initialize session
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    try {
      // Initialize session
      await this.sessionManager.createSession();

      // Connect MCP servers
      await this.mcpManager.connectAll();

      // Fire SessionStart hook
      await this.hookManager.fire({
        type: 'SessionStart',
        sessionId: this.sessionManager.getSessionId(),
        cwd: this.options.cwd,
        timestamp: new Date(),
        options: this.options,
      });

      this.connected = true;

      // Yield init message
      await this.yieldSystemMessage('init', 'Session initialized', {
        session_id: this.sessionManager.getSessionId(),
        slash_commands: [], // TODO: Load slash commands
        mcp_servers: this.mcpManager.getServerStatus(),
      });
    } catch (error) {
      throw new SessionError('Failed to connect', error);
    }
  }

  /**
   * Send a query to Claude
   */
  async query(prompt: string): Promise<void> {
    if (!this.connected) {
      throw new SessionError('Not connected. Call connect() first.');
    }

    // Validate input
    const validation = await this.guardrailManager.validateInput(prompt);
    if (!validation.valid) {
      throw new ClaudeSDKError(`Input validation failed: ${validation.reason}`);
    }

    // Fire UserPromptSubmit hook
    await this.hookManager.fire({
      type: 'UserPromptSubmit',
      sessionId: this.sessionManager.getSessionId(),
      cwd: this.options.cwd,
      timestamp: new Date(),
      prompt,
    });

    this.currentPrompt = prompt;
    this.messageQueue.push(prompt);
  }

  /**
   * Receive response from Claude
   */
  async *receiveResponse(): AsyncGenerator<SDKMessage> {
    if (!this.connected) {
      throw new SessionError('Not connected. Call connect() first.');
    }

    if (!this.currentPrompt) {
      return;
    }

    const prompt = this.currentPrompt;
    this.currentPrompt = null;

    try {
      // Build messages array
      const messages = this.sessionManager.getMessageHistory();
      messages.push({
        role: 'user',
        content: prompt,
      });

      // Get tools
      const tools = await this.toolManager.getAvailableTools();
      const mcpTools = await this.mcpManager.getTools();
      const allTools = [...tools, ...mcpTools];

      // Create streaming request
      const stream = await this.anthropic.messages.stream({
        model: MODEL_MAP[this.options.model],
        max_tokens: this.options.maxTokens,
        temperature: this.options.temperature,
        system: this.getSystemPrompt(),
        messages,
        tools: allTools.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: t.input_schema,
        })),
      });

      // Handle streaming with fine-grained streaming if enabled
      if (this.options.streaming.enableFineGrainedStreaming) {
        yield* this.streamingManager.handleFineGrainedStream(stream);
      } else {
        yield* this.streamingManager.handleStandardStream(stream);
      }

      // Get final message
      const finalMessage = await stream.finalMessage();

      // Track usage and cost
      this.costTracker.trackMessage({
        type: 'assistant',
        id: finalMessage.id,
        content: finalMessage.content as any,
        stop_reason: finalMessage.stop_reason,
        model: finalMessage.model,
        usage: finalMessage.usage,
        timestamp: new Date(),
      });

      // Handle tool uses
      const toolUses = finalMessage.content.filter((c) => c.type === 'tool_use') as any[];

      if (toolUses.length > 0) {
        // Execute tools
        const results = await this.executeTools(toolUses);

        // Add tool results to history
        this.sessionManager.addMessage({
          role: 'user',
          content: results,
        });

        // Recurse to get next response
        yield* this.receiveResponse();
      }

      // Check for context compaction
      if (this.shouldCompact()) {
        await this.compact();
      }
    } catch (error) {
      throw new ClaudeSDKError('Failed to receive response', 'RECEIVE_ERROR', error);
    }
  }

  /**
   * Interrupt the current operation
   */
  async interrupt(): Promise<void> {
    if (!this.connected) {
      return;
    }

    this.messageQueue = [];
    this.currentPrompt = null;

    await this.hookManager.fire({
      type: 'Stop',
      sessionId: this.sessionManager.getSessionId(),
      cwd: this.options.cwd,
      timestamp: new Date(),
      reason: 'User interrupt',
    });
  }

  /**
   * Disconnect from the SDK
   */
  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    try {
      // Fire SessionEnd hook
      await this.hookManager.fire({
        type: 'SessionEnd',
        sessionId: this.sessionManager.getSessionId(),
        cwd: this.options.cwd,
        timestamp: new Date(),
        usage: this.costTracker.getCumulativeUsage(),
        cost: this.costTracker.getCostBreakdown(),
      });

      // Disconnect MCP servers
      await this.mcpManager.disconnectAll();

      // Save session if persistence enabled
      if (this.options.session.persist) {
        await this.sessionManager.saveSession();
      }

      this.connected = false;
    } catch (error) {
      throw new SessionError('Failed to disconnect', error);
    }
  }

  /**
   * Get current session state
   */
  getSessionState(): SessionState {
    return this.sessionManager.getState();
  }

  /**
   * Get final result message
   */
  getResult(): SDKMessage | null {
    return {
      type: 'result',
      id: uuidv4(),
      usage: this.costTracker.getCumulativeUsage(),
      cost: this.costTracker.getCostBreakdown(),
      session_id: this.sessionManager.getSessionId(),
      timestamp: new Date(),
    };
  }

  // Private methods

  private mergeWithDefaults(options: ClaudeAgentOptions): Required<ClaudeAgentOptions> {
    return {
      model: options.model || 'sonnet',
      apiKey: options.apiKey || process.env.ANTHROPIC_API_KEY || '',
      cwd: options.cwd || process.cwd(),
      mcpServers: options.mcpServers || {},
      permissionMode: options.permissionMode || 'default',
      permissions: options.permissions || { mode: 'default' },
      allowedTools: options.allowedTools || [],
      disallowedTools: options.disallowedTools || [],
      systemPrompt: options.systemPrompt || '',
      settingSources: options.settingSources || ['project'],
      hooks: options.hooks || {},
      agents: options.agents || {},
      streaming: {
        enableFineGrainedStreaming: true,
        fineGrainedStreamingThreshold: 1000,
        enablePartialMessages: true,
        bufferSize: 8192,
        ...options.streaming,
      },
      guardrails: {
        enableJailbreakMitigation: true,
        enableHallucinationPrevention: true,
        enableCommandValidation: true,
        blockPatterns: ['rm -rf /', 'dd if=', 'mkfs', 'format'],
        piiDetection: { enabled: true, redact: true },
        enablePromptLeakProtection: true,
        ...options.guardrails,
      },
      session: {
        persist: false,
        storageDir: '.claude/sessions',
        compactionThreshold: 100000,
        ...options.session,
      },
      maxTokens: options.maxTokens || 4096,
      temperature: options.temperature || 1.0,
      extendedThinking: options.extendedThinking || false,
      timeout: options.timeout || 60000,
      maxRetries: options.maxRetries || 3,
    };
  }

  private getSystemPrompt(): string {
    if (typeof this.options.systemPrompt === 'string') {
      return this.options.systemPrompt;
    }
    // TODO: Load preset prompts
    return '';
  }

  private async executeTools(toolUses: ToolUseRequest[]): Promise<ToolResult[]> {
    const results: ToolResult[] = [];

    for (const toolUse of toolUses) {
      try {
        // Fire PreToolUse hook
        await this.hookManager.fire({
          type: 'PreToolUse',
          sessionId: this.sessionManager.getSessionId(),
          cwd: this.options.cwd,
          timestamp: new Date(),
          tool: toolUse,
        });

        // Check permissions
        const permission = await this.permissionManager.checkPermission(toolUse.name, toolUse.input);

        if (!permission.allow) {
          results.push({
            tool_use_id: toolUse.id,
            content: [
              {
                type: 'text',
                text: `Permission denied: ${permission.reason || 'Tool not allowed'}`,
              },
            ],
            is_error: true,
          });
          continue;
        }

        // Execute tool
        const startTime = Date.now();
        const result = await this.toolManager.executeTool(
          toolUse.name,
          permission.modifiedInput || toolUse.input
        );

        // Fire PostToolUse hook
        await this.hookManager.fire({
          type: 'PostToolUse',
          sessionId: this.sessionManager.getSessionId(),
          cwd: this.options.cwd,
          timestamp: new Date(),
          tool: toolUse,
          result,
          duration: Date.now() - startTime,
        });

        results.push(result);
      } catch (error) {
        results.push({
          tool_use_id: toolUse.id,
          content: [
            {
              type: 'text',
              text: `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          is_error: true,
        });
      }
    }

    return results;
  }

  private shouldCompact(): boolean {
    const tokenCount = this.sessionManager.getTokenCount();
    return tokenCount > this.options.session.compactionThreshold;
  }

  private async compact(): Promise<void> {
    const oldTokenCount = this.sessionManager.getTokenCount();

    await this.hookManager.fire({
      type: 'PreCompact',
      sessionId: this.sessionManager.getSessionId(),
      cwd: this.options.cwd,
      timestamp: new Date(),
      tokenCount: oldTokenCount,
    });

    await this.sessionManager.compact();

    const newTokenCount = this.sessionManager.getTokenCount();

    await this.yieldSystemMessage('compact', 'Context compacted', {
      old_token_count: oldTokenCount,
      new_token_count: newTokenCount,
      tokens_saved: oldTokenCount - newTokenCount,
    });
  }

  private async yieldSystemMessage(subtype: string, content: string, data?: any): Promise<void> {
    // This would be yielded in the actual implementation
    // For now, just log
    console.log(`[${subtype}] ${content}`, data);
  }
}

/**
 * Async context manager support (for Python-style usage)
 */
export async function withClient<T>(
  options: ClaudeAgentOptions,
  callback: (client: ClaudeSDKClient) => Promise<T>
): Promise<T> {
  const client = new ClaudeSDKClient(options);
  try {
    await client.connect();
    return await callback(client);
  } finally {
    await client.disconnect();
  }
}
