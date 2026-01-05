#!/usr/bin/env node
/**
 * Multi-AI Validator
 * Orchestrates validation with multiple AI validators (Cursor/Gemini/Codex) using voting/consensus
 * 
 * Usage:
 *   node .claude/tools/multi-ai-validator.mjs --target <file-or-dir> --validators cursor,gemini,codex
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Run Cursor validator
 */
async function runCursorValidator(target, options = {}) {
  const model = options.model || 'claude-3-opus';
  const criteria = options.criteria || 'security,performance,maintainability';
  
  try {
    const command = `cursor-agent validate --target "${target}" --model ${model} --criteria ${criteria} --format json`;
    const { stdout, stderr } = await execAsync(command, { timeout: 60000 });
    
    if (stderr && !stderr.includes('warning')) {
      throw new Error(stderr);
    }
    
    return JSON.parse(stdout);
  } catch (error) {
    return {
      validator: 'cursor',
      error: error.message,
      issues: []
    };
  }
}

/**
 * Run Gemini validator
 */
async function runGeminiValidator(target, options = {}) {
  const model = options.model || 'gemini-pro';
  const criteria = options.criteria || 'security,performance,maintainability';
  
  try {
    const command = `gemini validate --target "${target}" --model ${model} --criteria ${criteria} --format json`;
    const { stdout, stderr } = await execAsync(command, { timeout: 60000 });
    
    if (stderr && !stderr.includes('warning')) {
      throw new Error(stderr);
    }
    
    return JSON.parse(stdout);
  } catch (error) {
    return {
      validator: 'gemini',
      error: error.message,
      issues: []
    };
  }
}

/**
 * Run Codex validator
 */
async function runCodexValidator(target, options = {}) {
  const model = options.model || 'codex-davinci';
  const criteria = options.criteria || 'security,performance,maintainability';
  
  try {
    const command = `codex validate --target "${target}" --model ${model} --criteria ${criteria} --format json`;
    const { stdout, stderr } = await execAsync(command, { timeout: 60000 });
    
    if (stderr && !stderr.includes('warning')) {
      throw new Error(stderr);
    }
    
    return JSON.parse(stdout);
  } catch (error) {
    return {
      validator: 'codex',
      error: error.message,
      issues: []
    };
  }
}

/**
 * Normalize issue for comparison
 */
function normalizeIssue(issue) {
  return {
    file: issue.file || issue.path || '',
    line: issue.line || issue.lineNumber || 0,
    column: issue.column || issue.columnNumber || 0,
    severity: issue.severity || issue.level || 'minor',
    message: issue.message || issue.description || '',
    category: issue.category || issue.type || 'general',
    code: issue.code || issue.rule || ''
  };
}

/**
 * Group issues by location and message
 */
function groupIssues(issues) {
  const groups = new Map();
  
  for (const issue of issues) {
    const key = `${issue.file}:${issue.line}:${issue.message}`;
    if (!groups.has(key)) {
      groups.set(key, {
        file: issue.file,
        line: issue.line,
        message: issue.message,
        votes: [],
        severities: [],
        categories: []
      });
    }
    
    const group = groups.get(key);
    group.votes.push(issue.validator);
    group.severities.push(issue.severity);
    group.categories.push(issue.category);
  }
  
  return Array.from(groups.values());
}

/**
 * Calculate consensus for grouped issues
 */
function calculateConsensus(groupedIssues, totalValidators) {
  const consensusThreshold = Math.ceil(totalValidators * 2 / 3); // 2/3 agreement required
  
  return groupedIssues.map(group => {
    const voteCount = group.votes.length;
    const hasConsensus = voteCount >= consensusThreshold;
    
    // Determine severity by majority vote
    const severityCounts = {};
    group.severities.forEach(sev => {
      severityCounts[sev] = (severityCounts[sev] || 0) + 1;
    });
    const majoritySeverity = Object.entries(severityCounts)
      .sort((a, b) => b[1] - a[1])[0][0];
    
    // Determine category by majority vote
    const categoryCounts = {};
    group.categories.forEach(cat => {
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });
    const majorityCategory = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])[0][0];
    
    return {
      file: group.file,
      line: group.line,
      message: group.message,
      severity: majoritySeverity,
      category: majorityCategory,
      consensus: hasConsensus,
      voteCount,
      totalValidators,
      validators: group.votes,
      confidence: (voteCount / totalValidators * 100).toFixed(1) + '%'
    };
  });
}

/**
 * Orchestrate multi-AI validation
 */
export async function validateWithMultiAI(target, validators = ['cursor', 'gemini', 'codex'], options = {}) {
  const validatorFunctions = {
    cursor: runCursorValidator,
    gemini: runGeminiValidator,
    codex: runCodexValidator
  };
  
  // Run all validators in parallel
  const validatorPromises = validators.map(validator => {
    const fn = validatorFunctions[validator];
    if (!fn) {
      console.warn(`Unknown validator: ${validator}`);
      return Promise.resolve({ validator, error: 'Unknown validator', issues: [] });
    }
    return fn(target, options).then(result => ({
      ...result,
      validator
    }));
  });
  
  const results = await Promise.all(validatorPromises);
  
  // Extract all issues
  const allIssues = [];
  for (const result of results) {
    if (result.issues && Array.isArray(result.issues)) {
      for (const issue of result.issues) {
        allIssues.push({
          ...normalizeIssue(issue),
          validator: result.validator
        });
      }
    }
  }
  
  // Group issues and calculate consensus
  const groupedIssues = groupIssues(allIssues);
  const consensusIssues = calculateConsensus(groupedIssues, validators.length);
  
  // Separate consensus and non-consensus issues
  const consensus = consensusIssues.filter(i => i.consensus);
  const disagreements = consensusIssues.filter(i => !i.consensus);
  
  // Generate report
  const report = {
    target,
    validators,
    timestamp: new Date().toISOString(),
    summary: {
      totalIssues: consensusIssues.length,
      consensusIssues: consensus.length,
      disagreements: disagreements.length,
      validatorResults: results.map(r => ({
        validator: r.validator,
        issueCount: r.issues?.length || 0,
        error: r.error || null
      }))
    },
    consensus,
    disagreements,
    rawResults: results
  };
  
  return report;
}

/**
 * Save validation report
 */
export async function saveValidationReport(report, outputPath) {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(report, null, 2), 'utf-8');
  return outputPath;
}

/**
 * CLI interface
 */
async function main() {
  const args = process.argv.slice(2);
  const targetIndex = args.indexOf('--target');
  const validatorsIndex = args.indexOf('--validators');
  const outputIndex = args.indexOf('--output');
  const modelIndex = args.indexOf('--model');
  const criteriaIndex = args.indexOf('--criteria');
  
  if (targetIndex === -1 || !args[targetIndex + 1]) {
    console.error('Usage: node multi-ai-validator.mjs --target <file-or-dir> [--validators cursor,gemini,codex] [--output <path>] [--model <model>] [--criteria <criteria>]');
    process.exit(1);
  }
  
  const target = args[targetIndex + 1];
  const validators = validatorsIndex !== -1 && args[validatorsIndex + 1]
    ? args[validatorsIndex + 1].split(',')
    : ['cursor', 'gemini', 'codex'];
  const outputPath = outputIndex !== -1 ? args[outputIndex + 1] : null;
  const model = modelIndex !== -1 ? args[modelIndex + 1] : null;
  const criteria = criteriaIndex !== -1 ? args[criteriaIndex + 1] : null;
  
  const options = {};
  if (model) options.model = model;
  if (criteria) options.criteria = criteria;
  
  const report = await validateWithMultiAI(target, validators, options);
  
  if (outputPath) {
    await saveValidationReport(report, outputPath);
    console.log(`Validation report saved to: ${outputPath}`);
  } else {
    console.log(JSON.stringify(report, null, 2));
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default {
  validateWithMultiAI,
  saveValidationReport
};

