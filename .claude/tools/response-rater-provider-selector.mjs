#!/usr/bin/env node
/**
 * Selects appropriate providers for response-rater based on workflow type
 * Usage: node .claude/tools/response-rater-provider-selector.mjs --workflow <name>
 */

import fs from 'fs';
import path from 'path';
import jsYaml from 'js-yaml';

const CONFIG_PATH = '.claude/config/response-rater.yaml';

function loadConfig() {
  const content = fs.readFileSync(CONFIG_PATH, 'utf8');
  return jsYaml.load(content);
}

function selectProviders(workflowName, config) {
  // Get workflow tier
  const tier = config.workflow_mapping[workflowName]
    || config.workflow_mapping.default
    || 'standard';

  // Get providers for tier
  const providers = config.providers[tier] || config.providers.standard;

  return {
    tier,
    providers,
    timeouts: config.timeouts,
    consensus: config.consensus,
    fallback: config.fallback,
    retry: config.retry
  };
}

function getProviderCommand(selection) {
  const providerList = selection.providers.join(',');
  return `--providers ${providerList} --timeout ${selection.timeouts.per_provider * 1000}`;
}

// CLI execution
const args = process.argv.slice(2);
const workflowIdx = args.indexOf('--workflow');
const workflowName = workflowIdx >= 0 ? args[workflowIdx + 1] : null;

if (!workflowName) {
  console.error('Usage: node response-rater-provider-selector.mjs --workflow <name>');
  process.exit(1);
}

const config = loadConfig();
const selection = selectProviders(workflowName, config);

console.log(JSON.stringify(selection, null, 2));
