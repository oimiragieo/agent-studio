#!/usr/bin/env node

/**
 * Post-Tool Hook: Memory Capture
 *
 * Captures tool results for memory storage
 *
 * Performance Targets:
 * - Async (non-blocking) - stores in background
 * - Never blocks tool completion
 *
 * Hook Type: PostToolUse
 * Execution: After tool execution completes
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
        managerInstance = createMemoryInjectionManager();
        await managerInstance.initialize();
    }

    return managerInstance;
}

/**
 * Main hook function
 */
async function main() {
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

        const {
            tool_name: toolName,
            tool_input: toolInput,
            tool_result: toolResult,
            duration
        } = input;

        // Extract context
        const context = {
            sessionId: process.env.CLAUDE_SESSION_ID || 'default',
            toolName,
            toolParams: toolInput,
            duration
        };

        // Get manager instance (lazy init)
        const manager = await getManager();

        // Capture tool result (async, non-blocking)
        // Use setImmediate to return immediately without waiting
        setImmediate(async () => {
            try {
                await manager.captureToolResult(context, toolResult);
            } catch (error) {
                console.error(`[Memory Capture] Background capture error: ${error.message}`);
            }
        });

        // Return immediately (don't block tool completion)
        const result = {
            captured: true,
            async: true
        };

        process.stdout.write(JSON.stringify(result));
        process.exit(0);

    } catch (error) {
        // FAIL-SAFE: Never block tool completion
        console.error(`[Memory Capture] Error (non-blocking): ${error.message}`);

        const result = {
            captured: false,
            error: error.message
        };

        process.stdout.write(JSON.stringify(result));
        process.exit(0);
    }
}

// Execute
main();
