#!/usr/bin/env node
/**
 * Workflow Router Tool
 *
 * Semantic routing for workflow selection using router agent.
 * Falls back to keyword matching if router unavailable or low confidence.
 *
 * Usage:
 *   node workflow-router.mjs --prompt "user prompt text"
 *   node workflow-router.mjs --prompt "user prompt" --config .claude/config.yaml
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import yaml from 'js-yaml';
import Ajv from 'ajv';

const execAsync = promisify(exec);
const ajv = new Ajv();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load config.yaml
 */
function loadConfig(configPath = null) {
  const configPathResolved = configPath
    ? resolve(process.cwd(), configPath)
    : resolve(__dirname, '../../.claude/config.yaml');

  if (!existsSync(configPathResolved)) {
    throw new Error(`Config file not found: ${configPathResolved}`);
  }

  const configContent = readFileSync(configPathResolved, 'utf-8');
  return yaml.load(configContent);
}

/**
 * Invoke router agent via Claude CLI or Anthropic SDK
 * @param {string} userPrompt - User prompt to classify
 * @returns {Promise<Object>} Router agent classification result
 */
async function invokeRouterAgent(userPrompt) {
  const routerPromptPath = resolve(__dirname, '..', 'agents', 'router.md');

  if (!existsSync(routerPromptPath)) {
    throw new Error('Router agent prompt not found: router.md');
  }

  const routerPrompt = readFileSync(routerPromptPath, 'utf-8');

  // Build prompt for router agent
  const fullPrompt = `${routerPrompt}

## User Request
${userPrompt}

## Task
Classify this user request and return a JSON object matching the route_decision schema.
Output ONLY valid JSON, no markdown, no explanation.`;

  // Try Anthropic SDK first (if available)
  try {
    const { Anthropic } = await import('@anthropic-ai/sdk');
    const anthropic = new Anthropic();

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-20250514',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: fullPrompt,
        },
      ],
    });

    const responseText = message.content[0].text;

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    } else {
      return JSON.parse(responseText);
    }
  } catch (sdkError) {
    // Fallback to Claude CLI
    try {
      // Escape prompt for shell
      const escapedPrompt = fullPrompt.replace(/"/g, '\\"').replace(/\$/g, '\\$');
      const command = `claude -p "${escapedPrompt}" --model claude-haiku-4-20250514 --output-format json`;

      const { stdout, stderr } = await execAsync(command, {
        cwd: resolve(__dirname, '../..'),
        maxBuffer: 10 * 1024 * 1024, // 10MB
        timeout: 30000, // 30 second timeout
      });

      if (stderr && !stderr.includes('warning')) {
        console.warn(`Router agent stderr: ${stderr}`);
      }

      // Parse JSON response
      let routerResponse;
      try {
        // Try to extract JSON from response (may have markdown code blocks)
        const jsonMatch = stdout.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          routerResponse = JSON.parse(jsonMatch[0]);
        } else {
          routerResponse = JSON.parse(stdout);
        }
      } catch (parseError) {
        throw new Error(
          `Router agent returned invalid JSON: ${parseError.message}. Output: ${stdout.substring(0, 200)}`
        );
      }

      return routerResponse;
    } catch (cliError) {
      if (cliError.code === 'ENOENT' || cliError.message.includes('claude')) {
        throw new Error(
          'Router agent not available. Claude CLI not found and Anthropic SDK unavailable. Semantic routing requires either Claude CLI or Anthropic SDK.'
        );
      }
      throw new Error(`Router agent invocation failed: ${cliError.message}`);
    }
  }
}

/**
 * Validate router response against schema
 * @param {Object} routerResponse - Response from router agent
 * @returns {Object} Validated and normalized response
 */
function validateRouterResponse(routerResponse) {
  // Load schema
  const schemaPath = resolve(__dirname, '..', 'schemas', 'route_decision.schema.json');
  if (!existsSync(schemaPath)) {
    throw new Error('Route decision schema not found');
  }

  const schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
  const validate = ajv.compile(schema);

  const valid = validate(routerResponse);

  if (!valid) {
    throw new Error(`Router response validation failed: ${ajv.errorsText(validate.errors)}`);
  }

  // Normalize response (ensure selected_workflow is set)
  if (!routerResponse.selected_workflow && routerResponse.workflow_selection) {
    routerResponse.selected_workflow = routerResponse.workflow_selection;
  }

  return routerResponse;
}

/**
 * Semantic routing using router agent (REAL IMPLEMENTATION)
 * Calls router agent via Claude CLI and validates response
 */
async function semanticRouting(userPrompt, config) {
  const routerConfig = config.agent_routing?.router;
  if (!routerConfig) {
    return { method: 'fallback', reason: 'Router agent not configured' };
  }

  try {
    // Invoke router agent
    const routerResponse = await invokeRouterAgent(userPrompt);

    // Validate response against schema
    const validatedResponse = validateRouterResponse(routerResponse);

    // Map to workflow file if not already set
    if (!validatedResponse.selected_workflow && !validatedResponse.workflow_selection) {
      // Use workflow mapping from router agent doc
      const workflowMapping = {
        web_app: '.claude/workflows/greenfield-fullstack.yaml',
        script: '.claude/workflows/quick-flow.yaml',
        mobile: '.claude/workflows/mobile-flow.yaml',
        ai_system: '.claude/workflows/ai-system-flow.yaml',
        infrastructure: '.claude/workflows/automated-enterprise-flow.yaml',
        analysis: '.claude/workflows/code-quality-flow.yaml',
      };

      const intent = validatedResponse.intent || 'web_app';
      validatedResponse.selected_workflow =
        workflowMapping[intent] || '.claude/workflows/greenfield-fullstack.yaml';
    }

    // Verify workflow file exists
    const workflowPath = resolve(
      process.cwd(),
      validatedResponse.selected_workflow || validatedResponse.workflow_selection
    );
    if (!existsSync(workflowPath)) {
      console.warn(`Warning: Workflow file not found: ${workflowPath}. Using default.`);
      validatedResponse.selected_workflow = '.claude/workflows/greenfield-fullstack.yaml';
    }

    return {
      method: 'semantic',
      ...validatedResponse,
      routing_method: 'semantic',
    };
  } catch (error) {
    // Fail fast with clear error
    throw new Error(
      `Router agent not available. Semantic routing requires router agent. Error: ${error.message}`
    );
  }
}

/**
 * Keyword-based routing (fallback)
 */
function keywordRouting(userPrompt, config) {
  const workflowSelection = config.workflow_selection || {};
  const promptLower = userPrompt.toLowerCase();

  // Score each workflow based on keyword matches
  const workflowScores = [];

  for (const [workflowName, workflowConfig] of Object.entries(workflowSelection)) {
    const keywords = workflowConfig.keywords || [];
    let matchCount = 0;
    const matchedKeywords = [];

    for (const keyword of keywords) {
      if (promptLower.includes(keyword.toLowerCase())) {
        matchCount++;
        matchedKeywords.push(keyword);
      }
    }

    if (matchCount > 0) {
      workflowScores.push({
        name: workflowName,
        matches: matchCount,
        priority: workflowConfig.priority || 999,
        workflow_file: workflowConfig.workflow_file,
        matched_keywords: matchedKeywords,
      });
    }
  }

  if (workflowScores.length === 0) {
    // Use default workflow
    const defaultWorkflow = config.intelligent_routing?.default_workflow || 'fullstack';
    return {
      method: 'default',
      workflow_selection: `.claude/workflows/greenfield-fullstack.yaml`,
      confidence: 0.5,
      reasoning: `No keyword matches found, using default workflow: ${defaultWorkflow}`,
    };
  }

  // Select workflow with lowest priority number (0 = highest priority)
  workflowScores.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return b.matches - a.matches; // If same priority, prefer more matches
  });

  const selected = workflowScores[0];

  return {
    method: 'keyword',
    workflow_selection: selected.workflow_file,
    confidence: Math.min(0.9, 0.5 + selected.matches * 0.1),
    reasoning: `Matched ${selected.matches} keywords for ${selected.name} workflow (priority ${selected.priority})`,
    keywords_detected: selected.matched_keywords,
  };
}

/**
 * Main routing function
 */
export async function routeWorkflow(userPrompt, configPath = null) {
  const config = loadConfig(configPath);

  // Try semantic routing first
  let result = await semanticRouting(userPrompt, config);

  // If semantic routing has low confidence or fails, fall back to keyword matching
  if (result.method === 'fallback' || (result.confidence && result.confidence < 0.8)) {
    const keywordResult = keywordRouting(userPrompt, config);

    // Prefer semantic if confidence is reasonable, otherwise use keyword
    if (result.confidence && result.confidence >= 0.6) {
      result.routing_method = 'semantic_with_fallback';
      result.fallback_reason = 'Low confidence, keyword match available';
    } else {
      result = keywordResult;
    }
  }

  // Ensure workflow_selection is set (for backward compatibility)
  if (result.workflow_selection && !result.selected_workflow) {
    result.selected_workflow = result.workflow_selection;
  }

  // Set routing_method if not already set
  if (!result.routing_method) {
    result.routing_method = result.method;
  }

  return result;
}

/**
 * CLI entry point
 */
async function main() {
  const args = process.argv.slice(2);
  let prompt = null;
  let configPath = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--prompt' && args[i + 1]) {
      prompt = args[i + 1];
      i++;
    } else if (args[i] === '--config' && args[i + 1]) {
      configPath = args[i + 1];
      i++;
    }
  }

  if (!prompt) {
    console.error('Error: --prompt argument required');
    console.error(
      'Usage: node workflow-router.mjs --prompt "user prompt text" [--config path/to/config.yaml]'
    );
    process.exit(1);
  }

  try {
    const result = await routeWorkflow(prompt, configPath);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
