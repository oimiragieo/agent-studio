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
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

// Lazy-load skill injector to prevent crashes if module has issues
let injectSkillsForAgent = null;
let skillInjectorLoaded = false;

// Memory thresholds (centralized config)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MEMORY_THRESHOLDS_PATH = join(__dirname, '..', 'config', 'memory-thresholds.json');
let memoryConfig = null;

async function loadMemoryConfig() {
  if (memoryConfig) return memoryConfig;
  const defaults = {
    max_rss_mb: 4096,
    min_free_mb_skill_injection: 300,
  };
  try {
    if (!existsSync(MEMORY_THRESHOLDS_PATH)) {
      memoryConfig = defaults;
      return memoryConfig;
    }
    const raw = await readFile(MEMORY_THRESHOLDS_PATH, 'utf-8');
    memoryConfig = { ...defaults, ...JSON.parse(raw) };
    return memoryConfig;
  } catch {
    memoryConfig = defaults;
    return memoryConfig;
  }
}

async function loadSkillInjector() {
  if (skillInjectorLoaded) {
    return injectSkillsForAgent;
  }
  skillInjectorLoaded = true;
  try {
    const skillInjector = await import('../tools/skill-injector.mjs');
    injectSkillsForAgent = skillInjector.injectSkillsForAgent;
  } catch (e) {
    // Skill injector not available - hook will pass through unchanged
    injectSkillsForAgent = null;
  }
  return injectSkillsForAgent;
}

// Recursion protection - prevent hook from triggering itself
if (process.env.CLAUDE_SKILL_INJECTION_EXECUTING === 'true') {
  // Read stdin and pass through unchanged
  let input = '';
  for await (const chunk of stdin) {
    input += chunk.toString();
  }
  stdout.write(input);
  process.exit(0);
}
process.env.CLAUDE_SKILL_INJECTION_EXECUTING = 'true';

// Timeout protection - force exit after 5 seconds (longer for skill injection)
let timeoutFired = false;
const timeout = setTimeout(() => {
  timeoutFired = true;
  stderr.write('[SKILL INJECTION] Timeout exceeded, passing through unchanged\n');
  // Try to read and pass through stdin if we haven't already
  // This is a fallback - main() should handle this, but this ensures we exit cleanly
  delete process.env.CLAUDE_SKILL_INJECTION_EXECUTING;
  process.exit(0); // Exit 0 to fail-open (pass through unchanged)
}, 5000);

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
    // 1. Read input from stdin (with timeout check)
    inputStr = await readStdin();

    // Check if timeout fired during read
    if (timeoutFired) {
      stdout.write(inputStr || '{}');
      process.exit(0);
    }

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

    // 3. Check if this is a Task tool call (handle both tool_name and tool formats)
    const toolName = input.tool_name || input.tool || '';
    if (toolName !== 'Task') {
      // Not a Task tool call, pass through unchanged
      log(`Not a Task tool call (tool: ${toolName}), passing through`);
      stdout.write(inputStr);
      process.exit(0);
    }

    // 4. Extract subagent_type and prompt (handle both input and tool_input formats)
    const toolInput = input.tool_input || input.input || {};
    const { subagent_type, prompt } = toolInput;

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

    // 4.5 Memory safety gate: skip injection under memory pressure (fail-open)
    const mem = await loadMemoryConfig();
    const rssMB = process.memoryUsage().rss / 1024 / 1024;
    const freeMB = (mem.max_rss_mb || 4096) - rssMB;
    if (freeMB < (mem.min_free_mb_skill_injection || 300)) {
      log(
        `Memory pressure: RSS=${rssMB.toFixed(1)}MB, free=${freeMB.toFixed(1)}MB < ${mem.min_free_mb_skill_injection}MB; passing through`
      );
      stdout.write(inputStr);
      process.exit(0);
    }

    // 5. Load skill injector (lazy load to prevent crashes)
    const skillInjectorFn = await loadSkillInjector();
    if (!skillInjectorFn) {
      log('Warning: Skill injector not available, passing through unchanged');
      stdout.write(inputStr);
      process.exit(0);
    }

    log(`Processing Task tool call for agent: ${subagent_type}`);

    // 6. Inject skills using skill-injector.mjs (with error handling)
    let injectionResult;
    try {
      injectionResult = await skillInjectorFn(subagent_type, prompt, {
        includeRecommended: false, // Only inject required + triggered skills
      });
    } catch (injectionError) {
      log(`Error during skill injection: ${injectionError.message}`);
      log('Passing through unchanged due to injection error');
      stdout.write(inputStr);
      process.exit(0);
    }

    if (!injectionResult.success) {
      log(`Warning: Skill injection failed: ${injectionResult.error}`);
      log('Passing through unchanged');
      stdout.write(inputStr);
      process.exit(0);
    }

    // 7. Generate enhanced prompt
    const enhancedPrompt = injectionResult.skillPrompt
      ? `${prompt}\n\n---\n\n${injectionResult.skillPrompt}`
      : prompt;

    // 8. Create enhanced input (preserve original format)
    const enhancedInput = {
      ...input,
      tool_input: {
        ...toolInput,
        prompt: enhancedPrompt,
      },
    };

    // Also preserve input format if it was used
    if (input.input) {
      enhancedInput.input = {
        ...input.input,
        prompt: enhancedPrompt,
      };
    }

    // 9. Output enhanced JSON to stdout
    stdout.write(JSON.stringify(enhancedInput, null, 2));

    // 10. Log success metrics
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
  } finally {
    clearTimeout(timeout);
    // Clean up recursion guard
    delete process.env.CLAUDE_SKILL_INJECTION_EXECUTING;
  }
}

// Run main function
main().catch(error => {
  log(`Fatal error: ${error.message}`);
  clearTimeout(timeout);
  delete process.env.CLAUDE_SKILL_INJECTION_EXECUTING;
  process.exit(0); // Exit 0 to not block execution
});
