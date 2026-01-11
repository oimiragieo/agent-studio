#!/usr/bin/env node
/**
 * Skill Injection Hook - Phase 2B
 *
 * PreToolUse hook that automatically injects skill requirements when Task tool is used.
 * This hook intercepts Task tool calls and enhances the prompt with required and triggered skills.
 *
 * Hook Protocol:
 * - Receives JSON on stdin: { "tool": "Task", "input": { "subagent_type": "developer", "prompt": "..." } }
 * - Outputs modified JSON on stdout: Same structure with enhanced prompt
 * - Returns exit code 0 to continue, non-zero to block
 *
 * Performance Target: <100ms execution time
 */

import { readFile } from 'fs/promises';
import { stdin, stdout, stderr } from 'process';
import { injectSkillsForAgent } from '../tools/skill-injector.mjs';

/**
 * Read all data from stdin using async iteration
 * @returns {Promise<string>} Stdin content
 */
async function readStdin() {
  const chunks = [];

  // Use async iteration for automatic cleanup
  for await (const chunk of stdin) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString('utf-8');
}

/**
 * Log to stderr (stdout reserved for hook output)
 * @param {string} message - Log message
 */
function log(message) {
  stderr.write(`[skill-injection-hook] ${message}\n`);
}

/**
 * Main hook function
 */
async function main() {
  const startTime = Date.now();
  let inputStr; // Declare here so it's accessible in catch block

  try {
    // 1. Read input from stdin
    inputStr = await readStdin();

    if (!inputStr || inputStr.trim() === '') {
      log('Warning: Empty input received, passing through');
      process.exit(0);
    }

    // 2. Parse JSON input
    let input;
    try {
      input = JSON.parse(inputStr);
    } catch (parseError) {
      log(`Error parsing JSON input: ${parseError.message}`);
      log('Passing through unchanged due to parse error');
      stdout.write(inputStr);
      process.exit(0);
    }

    // 3. Check if this is a Task tool call
    if (!input || input.tool !== 'Task') {
      // Not a Task tool call, pass through unchanged
      log(`Not a Task tool call (tool: ${input?.tool}), passing through`);
      stdout.write(inputStr);
      process.exit(0);
    }

    // 4. Extract subagent_type and prompt
    const { subagent_type, prompt } = input.input || {};

    if (!subagent_type) {
      log('Warning: Task tool call missing subagent_type, passing through');
      stdout.write(inputStr);
      process.exit(0);
    }

    if (!prompt) {
      log('Warning: Task tool call missing prompt, passing through');
      stdout.write(inputStr);
      process.exit(0);
    }

    log(`Processing Task tool call for agent: ${subagent_type}`);

    // 5. Inject skills using skill-injector.mjs
    const injectionResult = await injectSkillsForAgent(subagent_type, prompt, {
      includeRecommended: false, // Only inject required + triggered skills
    });

    if (!injectionResult.success) {
      log(`Warning: Skill injection failed: ${injectionResult.error}`);
      log('Passing through unchanged');
      stdout.write(inputStr);
      process.exit(0);
    }

    // 6. Generate enhanced prompt
    const enhancedPrompt = injectionResult.skillPrompt
      ? `${prompt}\n\n---\n\n${injectionResult.skillPrompt}`
      : prompt;

    // 7. Create enhanced input
    const enhancedInput = {
      ...input,
      input: {
        ...input.input,
        prompt: enhancedPrompt,
      },
    };

    // 8. Output enhanced JSON to stdout
    stdout.write(JSON.stringify(enhancedInput, null, 2));

    // 9. Log success metrics
    const endTime = Date.now();
    const executionTime = endTime - startTime;

    log(`✓ Skills injected successfully (${executionTime}ms)`);
    log(`  Required: ${injectionResult.requiredSkills.length}`);
    log(`  Triggered: ${injectionResult.triggeredSkills.length}`);
    log(`  Loaded: ${injectionResult.loadedSkills.length}`);

    if (injectionResult.failedSkills.length > 0) {
      log(`  Warning: ${injectionResult.failedSkills.length} skills failed to load`);
    }

    // Warn if execution time exceeds target
    if (executionTime > 100) {
      log(`Warning: Execution time ${executionTime}ms exceeds target of 100ms`);
    }

    process.exit(0);
  } catch (error) {
    // Graceful error handling - never block on errors
    log(`Error in skill injection hook: ${error.message}`);
    log('Stack trace:');
    log(error.stack);
    log('Passing through unchanged due to error');

    // Pass through original input if available (already read at start of try block)
    if (inputStr) {
      stdout.write(inputStr);
    }

    process.exit(0); // Exit 0 to not block execution
  }
}

// Run main function
main().catch(error => {
  log(`Fatal error: ${error.message}`);
  process.exit(0); // Exit 0 to not block execution
});
