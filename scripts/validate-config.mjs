#!/usr/bin/env node
/**
 * Config Validation Script
 * 
 * Validates that all referenced files in configuration exist and are valid.
 * 
 * Usage:
 *   node scripts/validate-config.mjs [--verbose]
 * 
 * Exit codes:
 *   0: All validations passed
 *   1: One or more validations failed
 */

import { readFileSync, existsSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Try to import js-yaml, fail loudly if not available
let yaml;
try {
  yaml = (await import('js-yaml')).default;
} catch (error) {
  console.error('='.repeat(60));
  console.error('ERROR: js-yaml is required for config validation');
  console.error('='.repeat(60));
  console.error('');
  console.error('The validate-config script requires js-yaml to parse YAML files.');
  console.error('Install it with one of the following commands:');
  console.error('');
  console.error('  pnpm install js-yaml');
  console.error('  npm install js-yaml');
  console.error('  yarn add js-yaml');
  console.error('');
  console.error('Without js-yaml, YAML validation cannot proceed.');
  console.error('='.repeat(60));
  process.exit(2);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

const verbose = process.argv.includes('--verbose');
const errors = [];
const warnings = [];

// Helper to check if file exists
function checkFile(path, description) {
  const fullPath = resolve(rootDir, path);
  if (!existsSync(fullPath)) {
    errors.push(`Missing ${description}: ${path}`);
    return false;
  }
  if (verbose) {
    console.log(`* Found ${description}: ${path}`);
  }
  return true;
}

// Helper to check if directory exists
function checkDirectory(path, description) {
  const fullPath = resolve(rootDir, path);
  if (!existsSync(fullPath)) {
    errors.push(`Missing ${description}: ${path}`);
    return false;
  }
  try {
    const stat = statSync(fullPath);
    if (!stat.isDirectory()) {
      errors.push(`${description} is not a directory: ${path}`);
      return false;
    }
  } catch (error) {
    errors.push(`Cannot access ${description}: ${path} - ${error.message}`);
    return false;
  }
  if (verbose) {
    console.log(`* Found ${description}: ${path}`);
  }
  return true;
}

// Validate YAML file
function validateYAML(path, description) {
  const fullPath = resolve(rootDir, path);
  if (!existsSync(fullPath)) {
    errors.push(`Missing ${description}: ${path}`);
    return false;
  }
  
  if (!yaml) {
    // Just check file exists if yaml parser not available
  if (verbose) {
    console.log(`* Found ${description}: ${path} (YAML validation skipped)`);
    }
    return true;
  }
  
  try {
    const content = readFileSync(fullPath, 'utf-8');
    yaml.load(content);
    if (verbose) {
      console.log(`* Valid YAML ${description}: ${path}`);
    }
    return true;
  } catch (error) {
    errors.push(`Invalid YAML in ${description}: ${path} - ${error.message}`);
    return false;
  }
}

// Validate JSON file
function validateJSON(path, description) {
  const fullPath = resolve(rootDir, path);
  if (!existsSync(fullPath)) {
    errors.push(`Missing ${description}: ${path}`);
    return false;
  }
  
  try {
    const content = readFileSync(fullPath, 'utf-8');
    JSON.parse(content);
    if (verbose) {
      console.log(`* Valid JSON ${description}: ${path}`);
    }
    return true;
  } catch (error) {
    errors.push(`Invalid JSON in ${description}: ${path} - ${error.message}`);
    return false;
  }
}

// Main validation function
function validateConfig() {
  console.log('Validating LLM-RULES configuration...\n');
  
  // 1. Check gate script
  console.log('Checking gate script...');
  checkFile('.claude/tools/gates/gate.mjs', 'gate script');
  
  // 2. Load and validate config.yaml
  console.log('\nValidating config.yaml...');
  const configPath = resolve(rootDir, '.claude/config.yaml');
  if (!existsSync(configPath)) {
    errors.push('Missing config.yaml: .claude/config.yaml');
    return;
  }
  
  let config;
  try {
    const configContent = readFileSync(configPath, 'utf-8');
    if (yaml) {
      config = yaml.load(configContent);
    } else {
      // Basic parsing without yaml library - just check file exists
      warnings.push('YAML parsing skipped (js-yaml not installed). Install with: npm install js-yaml');
      config = {}; // Empty config, will skip agent/template checks
    }
  } catch (error) {
    if (yaml) {
      errors.push(`Invalid YAML in config.yaml: ${error.message}`);
      return;
    } else {
      warnings.push('Cannot parse config.yaml without js-yaml');
      config = {};
    }
  }
  
  // 3. Check agent files referenced in config
  console.log('\nChecking agent files...');
  if (config.agent_routing) {
    for (const agentName of Object.keys(config.agent_routing)) {
      const agentFile = `.claude/agents/${agentName}.md`;
      if (!checkFile(agentFile, `agent file for ${agentName}`)) {
        warnings.push(`Agent ${agentName} referenced in config but file missing`);
      }
    }
  }
  
  // 4. Check template files
  console.log('\nChecking template files...');
  if (config.templates && config.templates.base_dir) {
    checkDirectory(config.templates.base_dir, 'templates directory');
    
    if (config.templates.project_brief) {
      checkFile(`${config.templates.base_dir}/${config.templates.project_brief}`, 'project brief template');
    }
    if (config.templates.prd) {
      checkFile(`${config.templates.base_dir}/${config.templates.prd}`, 'PRD template');
    }
    if (config.templates.architecture) {
      checkFile(`${config.templates.base_dir}/${config.templates.architecture}`, 'architecture template');
    }
    if (config.templates.implementation_plan) {
      checkFile(`${config.templates.base_dir}/${config.templates.implementation_plan}`, 'implementation plan template');
    }
    if (config.templates.test_plan) {
      checkFile(`${config.templates.base_dir}/${config.templates.test_plan}`, 'test plan template');
    }
    if (config.templates.ui_spec) {
      checkFile(`${config.templates.base_dir}/${config.templates.ui_spec}`, 'UI spec template');
    }
  }
  
  // 5. Check schema directory
  console.log('\nChecking schema files...');
  if (config.quality_gates && config.quality_gates.validation_schemas_dir) {
    checkDirectory(config.quality_gates.validation_schemas_dir, 'schemas directory');
  }
  
  // 6. Validate workflow files and check referenced schemas
  console.log('\nValidating workflow files...');
  const workflowFiles = [
    '.claude/workflows/enterprise-track.yaml',
    '.claude/workflows/greenfield-fullstack.yaml',
    '.claude/workflows/brownfield-fullstack.yaml',
    '.claude/workflows/quick-flow.yaml'
  ];
  
  const referencedSchemas = new Set();
  
  for (const workflowFile of workflowFiles) {
    if (!existsSync(resolve(rootDir, workflowFile))) {
      warnings.push(`Workflow file not found: ${workflowFile}`);
      continue;
    }
    
    validateYAML(workflowFile, `workflow file ${workflowFile}`);
    
    // Extract schema references from workflow
    if (yaml) {
      try {
        const workflowContent = readFileSync(resolve(rootDir, workflowFile), 'utf-8');
        const workflow = yaml.load(workflowContent);
        
        if (workflow.steps && Array.isArray(workflow.steps)) {
          for (const step of workflow.steps) {
            if (step.validation && step.validation.schema) {
              referencedSchemas.add(step.validation.schema);
            }
          }
        }
      } catch (error) {
        // Already reported as YAML error
      }
    } else {
      // Without yaml parser, try basic regex to find schema references
      try {
        const workflowContent = readFileSync(resolve(rootDir, workflowFile), 'utf-8');
        const schemaMatches = workflowContent.match(/schema:\s*([^\s]+)/g);
        if (schemaMatches) {
          schemaMatches.forEach(match => {
            const schemaPath = match.replace(/schema:\s*/, '').trim();
            referencedSchemas.add(schemaPath);
          });
        }
      } catch (error) {
        // Skip if can't read
      }
    }
  }
  
  // 7. Check referenced schema files
  console.log('\nChecking referenced schema files...');
  for (const schemaPath of referencedSchemas) {
    checkFile(schemaPath, `schema file ${schemaPath}`);
  }
  
  // 8. Check hook files
  console.log('\nChecking hook files...');
  const hookDir = '.claude/hooks';
  checkDirectory(hookDir, 'hooks directory');
  
  // Check common hook files
  const commonHooks = [
    'pre_tool_use.yaml',
    'post_tool_use.yaml',
    'user_prompt_submit.yaml',
    'security_validation.yaml',
    'streaming_monitor.yaml'
  ];
  
  for (const hookFile of commonHooks) {
    const hookPath = `${hookDir}/${hookFile}`;
    if (existsSync(resolve(rootDir, hookPath))) {
      validateYAML(hookPath, `hook file ${hookFile}`);
    } else {
      warnings.push(`Hook file not found (optional): ${hookPath}`);
    }
  }
  
  // 9. Check settings.json
  console.log('\nValidating settings.json...');
  validateJSON('.claude/settings.json', 'settings.json');
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('Validation Summary');
  console.log('='.repeat(60));
  
  if (errors.length === 0 && warnings.length === 0) {
    console.log('+ All validations passed!');
    return true;
  }
  
  if (errors.length > 0) {
    console.log(`\n- Found ${errors.length} error(s):`);
    errors.forEach(error => console.log(`  - ${error}`));
  }
  
  if (warnings.length > 0) {
    console.log(`\n+  Found ${warnings.length} warning(s):`);
    warnings.forEach(warning => console.log(`  - ${warning}`));
  }
  
  return errors.length === 0;
}

// Run validation
try {
  const isValid = validateConfig();
  process.exit(isValid ? 0 : 1);
} catch (error) {
  console.error('Fatal error during validation:', error.message);
  console.error(error.stack);
  process.exit(2);
}

