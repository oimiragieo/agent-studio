#!/usr/bin/env node
/**
 * Model Name Validation Script
 * 
 * Validates that model names in config.yaml match expected Claude API model identifiers.
 * This helps catch configuration errors before workflows are executed.
 * 
 * Usage:
 *   node scripts/validate-model-names.mjs
 *   node scripts/validate-model-names.mjs --verbose
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Expected model name patterns
const VALID_MODEL_PATTERNS = {
  opus: /^claude-3-opus-(\d{8})$/,
  sonnet: /^claude-3-5-sonnet-(\d{8})$/,
  haiku: /^claude-3-5-haiku-(\d{8})$/,
  // Allow legacy patterns for backward compatibility
  legacy_opus: /^claude-opus-(\d+)$/,
  legacy_sonnet: /^claude-sonnet-(\d+)$/,
};

// Known valid model names (as of 2024)
const KNOWN_VALID_MODELS = [
  'claude-3-opus-20240229',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
];

function validateModelName(modelName, context = '') {
  const issues = [];
  
  // Check if it's a known valid model
  if (KNOWN_VALID_MODELS.includes(modelName)) {
    return { valid: true, issues: [] };
  }
  
  // Check against patterns
  let matchesPattern = false;
  for (const [type, pattern] of Object.entries(VALID_MODEL_PATTERNS)) {
    if (pattern.test(modelName)) {
      matchesPattern = true;
      if (type.startsWith('legacy_')) {
        issues.push({
          severity: 'warning',
          message: `Model name "${modelName}" uses legacy pattern. Consider updating to full date format (e.g., claude-3-opus-20240229).`,
        });
      }
      break;
    }
  }
  
  if (!matchesPattern) {
    issues.push({
      severity: 'error',
      message: `Model name "${modelName}" does not match expected Claude API model name pattern.`,
      suggestion: `Expected format: claude-3-opus-YYYYMMDD, claude-3-5-sonnet-YYYYMMDD, or claude-3-5-haiku-YYYYMMDD`,
    });
  }
  
  return {
    valid: issues.filter(i => i.severity === 'error').length === 0,
    issues,
  };
}

function extractModelNames(config) {
  const models = [];

  // Extract from agent_routing
  if (config.agent_routing) {
    for (const [agentName, agentConfig] of Object.entries(config.agent_routing)) {
      if (agentConfig.model) {
        models.push({
          source: `agent_routing.${agentName}`,
          model: agentConfig.model,
        });
      }
    }
  }

  // Extract from model_config
  if (config.model_config) {
    for (const [complexity, modelConfig] of Object.entries(config.model_config)) {
      if (modelConfig.model) {
        models.push({
          source: `model_config.${complexity}`,
          model: modelConfig.model,
        });
      }
    }
  }

  return models;
}

function main() {
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose');
  
  const configPath = resolve(__dirname, '..', '.claude', 'config.yaml');
  
  console.log('🔍 Validating model names in config.yaml...\n');
  
  try {
    const configContent = readFileSync(configPath, 'utf-8');
    const config = yaml.load(configContent);
    
    const modelEntries = extractModelNames(config);
    let hasErrors = false;
    let hasWarnings = false;
    
    console.log(`Found ${modelEntries.length} model references:\n`);
    
    for (const entry of modelEntries) {
      const validation = validateModelName(entry.model, entry.source);
      
      if (validation.valid && validation.issues.length === 0) {
        if (verbose) {
          console.log(`✅ ${entry.source}: ${entry.model}`);
        }
      } else {
        for (const issue of validation.issues) {
          if (issue.severity === 'error') {
            hasErrors = true;
            console.error(`❌ ${entry.source}: ${entry.model}`);
            console.error(`   ${issue.message}`);
            if (issue.suggestion) {
              console.error(`   💡 ${issue.suggestion}`);
            }
          } else if (issue.severity === 'warning') {
            hasWarnings = true;
            console.warn(`⚠️  ${entry.source}: ${entry.model}`);
            console.warn(`   ${issue.message}`);
          }
        }
      }
    }
    
    console.log('');
    
    if (hasErrors) {
      console.error('❌ Validation failed: Some model names are invalid.');
      console.error('   Please update config.yaml with correct Claude API model names.');
      process.exit(1);
    } else if (hasWarnings) {
      console.warn('⚠️  Validation passed with warnings.');
      console.warn('   Consider updating to recommended model name formats.');
      process.exit(0);
    } else {
      console.log('✅ All model names are valid!');
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Error reading or parsing config.yaml:');
    console.error(error.message);
    process.exit(1);
  }
}

main();

