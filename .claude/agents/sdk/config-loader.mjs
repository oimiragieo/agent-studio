#!/usr/bin/env node
/**
 * Config Loader - Loads agent configuration
 * Helper for loading and parsing agent configurations
 */

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let cachedConfig = null;

/**
 * Load configuration from YAML file
 */
export async function loadConfig() {
  if (cachedConfig) {
    return cachedConfig;
  }

  const configPath = join(__dirname, '../../config.yaml');
  const configContent = await readFile(configPath, 'utf8');
  cachedConfig = yaml.load(configContent);

  return cachedConfig;
}

/**
 * Get agent routing configuration
 */
export async function getAgentRouting() {
  const config = await loadConfig();
  return config.agent_routing || {};
}

/**
 * Get workflow selection configuration
 */
export async function getWorkflowSelection() {
  const config = await loadConfig();
  return config.workflow_selection || {};
}

/**
 * Get tool restrictions
 */
export async function getToolRestrictions() {
  const config = await loadConfig();
  return config.tool_restrictions || {};
}

/**
 * Get model configuration
 */
export async function getModelConfig() {
  const config = await loadConfig();
  return config.model_config || {};
}

/**
 * Clear cached configuration
 */
export function clearCache() {
  cachedConfig = null;
}

export default {
  loadConfig,
  getAgentRouting,
  getWorkflowSelection,
  getToolRestrictions,
  getModelConfig,
  clearCache,
};
