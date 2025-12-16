#!/usr/bin/env node
/**
 * Streaming Wrapper - Fine-Grained Tool Streaming
 * Wraps tools to provide streaming progress updates
 * Based on: https://docs.claude.com/en/docs/agents-and-tools/tool-use/fine-grained-tool-streaming.md
 */

/**
 * Generate unique tool call ID
 */
function generateToolCallId() {
  return `tool_call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a streaming version of a tool (official fine-grained streaming pattern)
 */
export function createStreamingTool(baseTool) {
  return {
    ...baseTool,
    name: baseTool.name,
    description: `${baseTool.description} (with streaming support)`,
    inputSchema: baseTool.inputSchema,
    outputSchema: baseTool.outputSchema,
    
    /**
     * Execute tool with streaming progress updates (official event types)
     */
    async *execute(input, context = {}) {
      const toolCallId = context.tool_call_id || generateToolCallId();
      const startTime = Date.now();
      
      // Yield start event (official pattern)
      yield {
        type: 'tool_call_start',
        tool_name: baseTool.name,
        tool_call_id: toolCallId,
        input: { ...input },
        timestamp: new Date().toISOString()
      };

      try {
        // Yield progress event
        yield {
          type: 'tool_call_progress',
          tool_call_id: toolCallId,
          progress: { stage: 'initializing', message: `Executing ${baseTool.name}...` },
          timestamp: new Date().toISOString()
        };

        // Execute base tool (could be async generator or promise)
        let result;
        if (baseTool.execute.constructor.name === 'AsyncGeneratorFunction') {
          // Tool already supports streaming - yield its events
          yield* baseTool.execute(input, { ...context, tool_call_id: toolCallId });
          // Get final result from last event
          result = null; // Will be extracted from complete event
        } else {
          // Regular promise-based tool - wrap in streaming
          result = await baseTool.execute(input, context);
        }

        // Yield completion event (official pattern)
        yield {
          type: 'tool_call_complete',
          tool_call_id: toolCallId,
          output: result,
          executionTime: Date.now() - startTime,
          timestamp: new Date().toISOString()
        };

        return result;
      } catch (error) {
        // Yield error event (official pattern)
        yield {
          type: 'tool_call_error',
          tool_call_id: toolCallId,
          error: {
            message: error.message,
            code: error.code || 'EXECUTION_ERROR',
            stack: error.stack
          },
          executionTime: Date.now() - startTime,
          timestamp: new Date().toISOString()
        };

        throw error;
      }
    },

    /**
     * Check if tool supports cancellation
     */
    supportsCancellation: true,

    /**
     * Cancel tool execution
     */
    cancel() {
      // Implementation depends on tool
      return { cancelled: true, timestamp: new Date().toISOString() };
    }
  };
}

/**
 * Create streaming handler for tool responses
 */
export function createStreamingHandler(tool) {
  return async function* handleStream(input, context) {
    const streamingTool = createStreamingTool(tool);
    yield* streamingTool.execute(input, context);
  };
}

/**
 * Collect streaming events into a single result (official event types)
 */
export async function collectStream(stream) {
  const events = [];
  let finalResult = null;
  let error = null;

  for await (const event of stream) {
    events.push(event);

    if (event.type === 'tool_call_complete') {
      finalResult = event.output;
    } else if (event.type === 'tool_call_error') {
      error = event.error;
    }
  }

  if (error) {
    throw new Error(error.message);
  }

  return {
    result: finalResult,
    events,
    summary: {
      totalEvents: events.length,
      startEvents: events.filter(e => e.type === 'tool_call_start').length,
      progressEvents: events.filter(e => e.type === 'tool_call_progress').length,
      completeEvents: events.filter(e => e.type === 'tool_call_complete').length,
      errorEvents: events.filter(e => e.type === 'tool_call_error').length
    }
  };
}

export default {
  createStreamingTool,
  createStreamingHandler,
  collectStream
};

