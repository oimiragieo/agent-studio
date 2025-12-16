#!/usr/bin/env node
/**
 * Permissions System - Agent SDK Integration
 * Manages tool permissions for agents
 * Based on: https://docs.claude.com/en/docs/agent-sdk/permissions.md
 */

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Permission levels
 */
export const PermissionLevels = {
  READ_ONLY: ['Read', 'Search', 'Grep', 'Glob'],
  READ_WRITE: ['Read', 'Write', 'Edit', 'Search', 'Grep', 'Glob'],
  FULL_ACCESS: ['Read', 'Write', 'Edit', 'Bash', 'Docker', 'Git', 'Search', 'Grep', 'Glob']
};

/**
 * Load agent permissions from config
 */
async function loadAgentPermissions(agentName) {
  const configPath = join(__dirname, '../../config.yaml');
  const configContent = await readFile(configPath, 'utf8');
  const config = yaml.load(configContent);

  const agentConfig = config.agent_routing?.[agentName];
  const toolRestrictions = config.tool_restrictions?.[agentName];

  if (toolRestrictions) {
    return {
      allowed: toolRestrictions.allowed_tools || [],
      restricted: toolRestrictions.restricted_tools || []
    };
  }

  // Default permissions based on agent complexity
  if (agentConfig) {
    if (agentConfig.complexity === 'high') {
      return {
        allowed: PermissionLevels.FULL_ACCESS,
        restricted: []
      };
    } else if (agentConfig.complexity === 'medium') {
      return {
        allowed: PermissionLevels.READ_WRITE,
        restricted: ['Bash', 'Docker']
      };
    } else {
      return {
        allowed: PermissionLevels.READ_ONLY,
        restricted: ['Write', 'Edit', 'Bash', 'Docker']
      };
    }
  }

  // Default: read-only
  return {
    allowed: PermissionLevels.READ_ONLY,
    restricted: []
  };
}

/**
 * Check if agent has permission to use a tool
 */
export async function checkPermission(agentName, toolName) {
  const permissions = await loadAgentPermissions(agentName);

  // Check restricted list first
  if (permissions.restricted.includes(toolName)) {
    return {
      allowed: false,
      reason: `Tool ${toolName} is restricted for agent ${agentName}`
    };
  }

  // Check allowed list
  if (permissions.allowed.length > 0 && !permissions.allowed.includes(toolName)) {
    return {
      allowed: false,
      reason: `Tool ${toolName} is not in allowed list for agent ${agentName}`
    };
  }

  return {
    allowed: true
  };
}

/**
 * Get all permissions for an agent
 */
export async function getAgentPermissions(agentName) {
  return await loadAgentPermissions(agentName);
}

/**
 * Check multiple permissions at once
 */
export async function checkMultiplePermissions(agentName, toolNames) {
  const results = {};
  
  for (const toolName of toolNames) {
    results[toolName] = await checkPermission(agentName, toolName);
  }

  return results;
}

/**
 * Create agent with SDK permissions
 * Note: Full implementation would use SDK Permissions class
 */
export async function createAgentWithPermissions(agentName) {
  const permissions = await loadAgentPermissions(agentName);
  
  // In production, this would use SDK Permissions class:
  // const sdkPermissions = new Permissions({
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

  return {
    agent: agentName,
    permissions: {
      tools: {
        allow: permissions.allowed || [],
        deny: permissions.restricted || []
      },
      files: {
        read: permissions.fileRead || [],
        write: permissions.fileWrite || []
      },
      network: {
        allow: permissions.networkAllowed || false
      }
    }
  };
}

/**
 * Check tool permission (SDK pattern)
 */
export async function checkToolPermission(agentName, toolName) {
  return await checkPermission(agentName, toolName);
}

/**
 * Check file permission (SDK pattern)
 */
export async function checkFilePermission(agentName, filePath, operation) {
  const permissions = await loadAgentPermissions(agentName);
  
  // Check if file operation is allowed
  if (operation === 'read') {
    return { allowed: true }; // Read is generally allowed
  } else if (operation === 'write') {
    // Check if write is in restricted list
    if (permissions.restricted.includes('Write')) {
      return { allowed: false, reason: 'Write operations are restricted for this agent' };
    }
    return { allowed: true };
  }
  
  return { allowed: false, reason: `Unknown operation: ${operation}` };
}

export default {
  PermissionLevels,
  checkPermission,
  getAgentPermissions,
  checkMultiplePermissions,
  createAgentWithPermissions,
  checkToolPermission,
  checkFilePermission
};

