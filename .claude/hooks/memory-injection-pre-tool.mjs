#!/usr/bin/env node

/**
 * Pre-Tool Hook: Memory Injection
 *
 * Injects relevant memory before tool execution
 *
 * Performance Targets:
 * - Latency: <100ms (p95)
 * - Token budget: 20% of remaining context, max 40k tokens
 * - Fail-safe: Never block tool execution on error
 *
 * Hook Type: PreToolUse
 * Execution: Before ANY tool is executed
 */

import { createMemoryInjectionManager } from '../tools/memory/injection-manager.mjs';

// Global singleton instance (lazy-initialized)
let managerInstance = null;

/**
 * Get or create memory injection manager instance
 *
 * @returns {Promise<MemoryInjectionManager>}
 */
async function getManager() {
  if (!managerInstance) {
    managerInstance = createMemoryInjectionManager({
      tokenBudget: 0.2, // 20% of remaining
      maxTokens: 40000, // Hard cap
      maxMemoryAge: 7, // days
      relevanceThreshold: 0.7,
      latencyBudget: 100, // ms
    });

    await managerInstance.initialize();
  }

  return managerInstance;
}

/**
 * Main hook function
 */
async function main() {
  const startTime = Date.now();

  try {
    // Read input from stdin
    const input = await new Promise((resolve, reject) => {
      let data = '';

      process.stdin.on('data', chunk => {
        data += chunk;
      });

      process.stdin.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(new Error(`Invalid JSON input: ${error.message}`));
        }
      });

      process.stdin.on('error', reject);

      // Timeout after 1 second
      setTimeout(() => {
        reject(new Error('stdin read timeout'));
      }, 1000);
    });

    const { tool_name: toolName, tool_input: toolInput } = input;

    // Extract context from environment variables and input
    const context = {
      sessionId: process.env.CLAUDE_SESSION_ID || 'default',
      toolName,
      toolParams: toolInput,
      conversationTokens: parseInt(process.env.CLAUDE_CONTEXT_TOKENS || '0'),
      maxTokens: parseInt(process.env.CLAUDE_CONTEXT_WINDOW || '200000'),
    };

    // Get manager instance
    const manager = await getManager();

    // Calculate token budget
    const tokenBudget = manager.calculateTokenBudget(context.conversationTokens, context.maxTokens);

    // Inject relevant memory (with timeout protection)
    const injection = await Promise.race([
      manager.injectRelevantMemory({ ...context, tokenBudget }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Injection timeout')), 100)),
    ]);

    const duration = Date.now() - startTime;

    // Log performance
    console.error(
      `[Memory Injection] Tool: ${toolName}, Tokens: ${injection.tokensUsed}/${tokenBudget}, Duration: ${duration}ms`
    );

    // Return result (injected memory will be prepended to tool context)
    const result = {
      decision: 'approve',
      injectedMemory: injection.memory,
      tokensUsed: injection.tokensUsed,
      sources: injection.sources,
      duration,
    };

    process.stdout.write(JSON.stringify(result));
    process.exit(0);
  } catch (error) {
    // FAIL-SAFE: Never block tool execution on memory error
    console.error(`[Memory Injection] Error (non-blocking): ${error.message}`);

    const duration = Date.now() - startTime;

    const result = {
      decision: 'approve',
      injectedMemory: null,
      tokensUsed: 0,
      sources: [],
      duration,
      error: error.message,
    };

    process.stdout.write(JSON.stringify(result));
    process.exit(0);
  }
}

// Execute
main();
