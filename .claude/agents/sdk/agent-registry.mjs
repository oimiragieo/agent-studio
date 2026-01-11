#!/usr/bin/env node
/**
 * Agent Registry - SDK-based Agent Creation and Management
 * Creates and manages agents using Agent SDK patterns
 * Based on: https://docs.claude.com/en/docs/agent-sdk/overview.md
 */

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import { getTool, getAllTools } from '../../tools/native/registry.mjs';
import { checkPermission, getAgentPermissions } from './permissions.mjs';
import { createSDKSession } from './session-handler.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load agent configuration from YAML
 */
async function loadAgentConfig(agentName) {
  const configPath = join(__dirname, '../../config.yaml');
  const configContent = await readFile(configPath, 'utf8');
  const config = yaml.load(configContent);

  return config.agent_routing?.[agentName] || null;
}

/**
 * Load agent prompt from markdown file
 */
async function loadAgentPrompt(agentName) {
  const agentPath = join(__dirname, `../${agentName}.md`);
  try {
    const content = await readFile(agentPath, 'utf8');
    // Extract content after YAML frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (frontmatterMatch) {
      return frontmatterMatch[2].trim();
    }
    return content;
  } catch (error) {
    throw new Error(`Failed to load agent prompt for ${agentName}: ${error.message}`);
  }
}

/**
 * Register tools for an agent
 */
async function registerAgentTools(agentName, toolNames = []) {
  const tools = [];
  const permissions = await getAgentPermissions(agentName);

  for (const toolName of toolNames) {
    // Check permissions
    const permissionCheck = await checkPermission(agentName, toolName);
    if (!permissionCheck.allowed) {
      console.warn(
        `Tool ${toolName} not allowed for agent ${agentName}: ${permissionCheck.reason}`
      );
      continue;
    }

    // Get tool from registry
    const tool = getTool(toolName);
    if (tool) {
      tools.push({
        name: tool.name,
        description: tool.description,
        input_schema: tool.inputSchema,
        output_schema: tool.outputSchema,
      });
    } else {
      // Tool might be MCP or custom - add placeholder
      tools.push({
        name: toolName,
        description: `Tool: ${toolName}`,
        input_schema: { type: 'object' },
        output_schema: { type: 'object' },
      });
    }
  }

  return tools;
}

/**
 * Apply SDK permissions to an agent
 */
async function applyAgentPermissions(agent, permissions) {
  // In production, this would use SDK Permissions class:
  // agent.setPermissions({
  //   tools: {
  //     allow: permissions.allowed,
  //     deny: permissions.restricted
  //   },
  //   files: {
  //     read: permissions.fileRead || [],
  //     write: permissions.fileWrite || []
  //   },
  //   network: {
  //     allow: permissions.networkAllowed || false
  //   }
  // });

  // For now, store permissions in agent metadata
  agent.permissions = {
    tools: {
      allow: permissions.allowed || [],
      deny: permissions.restricted || [],
    },
  };

  return agent;
}

/**
 * Create SDK agent instance
 * Note: Full implementation would use: import { Agent } from '@anthropic-ai/sdk';
 */
export async function createAgent(agentName, options = {}) {
  const config = await loadAgentConfig(agentName);

  if (!config) {
    throw new Error(`Agent ${agentName} not found in configuration`);
  }

  const prompt = await loadAgentPrompt(agentName);

  // Extract tool names from agent definition or config
  const toolNames = options.tools || config.tools || [];
  const tools = await registerAgentTools(agentName, toolNames);

  // Load permissions
  const permissions = await getAgentPermissions(agentName);

  // Create agent object (would use SDK Agent class in production)
  const agent = {
    name: agentName,
    system: prompt,
    model: config.model || options.model || 'claude-sonnet-4',
    temperature: config.temperature || options.temperature || 0.7,
    tools: tools,
    max_tokens: config.max_tokens || options.max_tokens || 4096,
    extended_thinking: config.extended_thinking || options.extendedThinking || false,
    context_files: config.context_files || options.contextFiles || [],
    metadata: {
      created: new Date().toISOString(),
      version: '1.0.0',
      complexity: config.complexity || 'medium',
      context_strategy: config.context_strategy || 'lazy_load',
    },
  };

  // Apply permissions
  await applyAgentPermissions(agent, permissions);

  // Create session if requested
  if (options.createSession) {
    agent.session = await createSDKSession(agentName, {
      project: options.project,
      feature: options.feature,
      workflow: options.workflow,
      ...options.metadata,
    });
  }

  return agent;
}

/**
 * Get all registered agents
 */
export async function getAllAgents() {
  const configPath = join(__dirname, '../../config.yaml');
  const configContent = await readFile(configPath, 'utf8');
  const config = yaml.load(configContent);

  return Object.keys(config.agent_routing || {});
}

/**
 * Get agent by name
 */
export async function getAgent(agentName) {
  return await createAgent(agentName);
}

/**
 * Register a custom agent
 */
export async function registerAgent(agentName, agentConfig) {
  // In production, this would register with SDK
  // For now, this is a placeholder
  return {
    name: agentName,
    config: agentConfig,
    registered_at: new Date().toISOString(),
  };
}

export default {
  createAgent,
  getAllAgents,
  getAgent,
  registerAgent,
  registerAgentTools,
  applyAgentPermissions,
};
