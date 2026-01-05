#!/usr/bin/env node
/**
 * Security Enforcement - Security Trigger Integration
 *
 * Enforces security review requirements based on security-triggers-v2.json.
 * Provides blocking, escalation, and approval tracking for security-sensitive tasks.
 *
 * Usage:
 *   import { checkSecurityTriggers, hasSecurityArchitectApproval } from './security-enforcement.mjs';
 *   const check = await checkSecurityTriggers("Add OAuth authentication");
 */

import { readFile, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load security triggers v2 configuration
 * @returns {Promise<Object>} Security triggers configuration
 */
async function loadSecurityTriggersV2() {
  try {
    const triggersPath = join(__dirname, '..', 'context', 'security-triggers-v2.json');
    const content = await readFile(triggersPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to load security triggers v2: ${error.message}`);
  }
}

/**
 * Check security triggers against task description
 * @param {string} taskDescription - Task description to check
 * @returns {Promise<Object>} Security trigger analysis
 */
export async function checkSecurityTriggers(taskDescription) {
  const triggers = await loadSecurityTriggersV2();
  const taskLower = taskDescription.toLowerCase();

  const triggeredCategories = new Set();
  const matchedKeywords = [];
  const requiredAgents = new Set();
  const recommendedAgents = new Set();
  let highestPriority = 'low';

  const priorityLevels = ['low', 'medium', 'high', 'critical'];

  // Check each security category
  for (const [categoryName, categoryConfig] of Object.entries(triggers.categories)) {
    const categoryKeywords = [];

    for (const keyword of categoryConfig.keywords) {
      if (taskLower.includes(keyword.toLowerCase())) {
        categoryKeywords.push(keyword);
      }
    }

    if (categoryKeywords.length > 0) {
      triggeredCategories.add(categoryName);
      matchedKeywords.push(...categoryKeywords.map(k => ({
        keyword: k,
        category: categoryName,
        priority: categoryConfig.priority
      })));

      // Track highest priority
      const categoryPriorityIndex = priorityLevels.indexOf(categoryConfig.priority);
      const currentPriorityIndex = priorityLevels.indexOf(highestPriority);
      if (categoryPriorityIndex > currentPriorityIndex) {
        highestPriority = categoryConfig.priority;
      }

      // Add agents
      for (const agent of categoryConfig.required_agents) {
        requiredAgents.add(agent);
      }
      for (const agent of categoryConfig.recommended_agents || []) {
        recommendedAgents.add(agent);
      }
    }
  }

  // Check for critical combinations
  const categories = Array.from(triggeredCategories);
  for (const combo of triggers.combinationRules?.critical_combinations || []) {
    const hasAllCategories = combo.categories.every(cat => triggeredCategories.has(cat));
    if (hasAllCategories && combo.priority_override) {
      const comboPriorityIndex = priorityLevels.indexOf(combo.priority_override);
      const currentPriorityIndex = priorityLevels.indexOf(highestPriority);
      if (comboPriorityIndex > currentPriorityIndex) {
        highestPriority = combo.priority_override;
      }
    }
  }

  // Determine blocking status from escalation rules
  const escalationRule = triggers.escalationRules[highestPriority] || triggers.escalationRules.low;
  const blocking = escalationRule.blocking || false;
  const requireSignoff = escalationRule.require_signoff || false;
  const notifyAgents = escalationRule.notify || [];
  const maxResponseTimeHours = escalationRule.max_response_time_hours || 72;

  return {
    triggered: categories.length > 0,
    categories,
    matchedKeywords,
    priority: highestPriority,
    critical: highestPriority === 'critical',
    blocking,
    requireSignoff,
    notifyAgents,
    maxResponseTimeHours,
    requiredAgents: Array.from(requiredAgents),
    recommendedAgents: Array.from(recommendedAgents)
  };
}

/**
 * Check if security architect has approved a workflow
 * @param {string} workflowId - Workflow identifier
 * @returns {Promise<boolean>} Whether security-architect has approved
 */
export async function hasSecurityArchitectApproval(workflowId) {
  try {
    // Check gate files for security signoff
    const gatePath = join(__dirname, '..', 'context', 'history', 'gates', workflowId);
    const gateFiles = await readdir(gatePath);

    for (const file of gateFiles) {
      if (file.includes('security-architect') || file.includes('security')) {
        const content = await readFile(join(gatePath, file), 'utf-8');
        const gate = JSON.parse(content);

        // Check for approval status
        if (gate.approved === true || gate.status === 'approved' || gate.signoff === true) {
          return true;
        }
      }
    }

    return false;
  } catch (error) {
    // If gates directory doesn't exist or can't be read, assume no approval
    return false;
  }
}

/**
 * Get security requirements based on detected keywords
 * @param {string} taskDescription - Task description
 * @returns {Promise<Object>} Security requirements and recommendations
 */
export async function getSecurityRequirements(taskDescription) {
  const check = await checkSecurityTriggers(taskDescription);

  if (!check.triggered) {
    return {
      required: false,
      recommendations: ['Follow standard security best practices']
    };
  }

  const requirements = {
    required: true,
    priority: check.priority,
    blocking: check.blocking,
    requireSignoff: check.requireSignoff,
    agents: check.requiredAgents,
    recommendedAgents: check.recommendedAgents,
    maxResponseTimeHours: check.maxResponseTimeHours,
    categories: check.categories,
    recommendations: []
  };

  // Generate specific recommendations based on categories
  const triggers = await loadSecurityTriggersV2();

  for (const category of check.categories) {
    const categoryConfig = triggers.categories[category];
    requirements.recommendations.push(
      `${category}: ${categoryConfig.description}`
    );
  }

  // Add escalation-specific recommendations
  if (check.blocking) {
    requirements.recommendations.push(
      'BLOCKING: Security review MUST be completed before implementation'
    );
  }

  if (check.requireSignoff) {
    requirements.recommendations.push(
      `Requires formal signoff from: ${check.notifyAgents.join(', ')}`
    );
  }

  if (check.critical) {
    requirements.recommendations.push(
      `CRITICAL: Maximum response time: ${check.maxResponseTimeHours} hours`
    );
  }

  return requirements;
}

/**
 * Validate security approval before proceeding with execution
 * @param {string} workflowId - Workflow identifier
 * @param {Object} securityCheck - Result from checkSecurityTriggers
 * @returns {Promise<Object>} Validation result
 */
export async function validateSecurityApproval(workflowId, securityCheck) {
  if (!securityCheck.triggered) {
    return {
      approved: true,
      reason: 'No security concerns detected'
    };
  }

  if (!securityCheck.blocking) {
    return {
      approved: true,
      reason: 'Security review recommended but not blocking'
    };
  }

  const hasApproval = await hasSecurityArchitectApproval(workflowId);

  if (hasApproval) {
    return {
      approved: true,
      reason: 'Security architect approval found'
    };
  }

  return {
    approved: false,
    reason: 'Security review required before execution',
    requiredAgents: securityCheck.requiredAgents,
    priority: securityCheck.priority,
    maxResponseTime: `${securityCheck.maxResponseTimeHours} hours`,
    categories: securityCheck.categories
  };
}

/**
 * Parse command line arguments
 * @param {string[]} args - Command line arguments
 * @returns {Object} Parsed arguments
 */
function parseArgs(args) {
  const parsed = {
    task: null,
    workflowId: null,
    help: false,
    json: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--task' || arg === '-t') {
      parsed.task = args[++i];
    } else if (arg === '--workflow-id' || arg === '-w') {
      parsed.workflowId = args[++i];
    } else if (arg === '--json' || arg === '-j') {
      parsed.json = true;
    } else if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    }
  }

  return parsed;
}

/**
 * Print help message
 */
function printHelp() {
  console.log(`
Security Enforcement - Security Trigger Integration

Checks task descriptions against security triggers and enforces review requirements.

USAGE:
  node security-enforcement.mjs --task <description> [options]

OPTIONS:
  --task, -t <desc>       Task description to check (required)
  --workflow-id, -w <id>  Workflow ID to check for approval
  --json, -j              Output as JSON
  --help, -h              Show this help message

EXAMPLES:
  node security-enforcement.mjs --task "Add OAuth authentication"
  node security-enforcement.mjs --task "Update user permissions" --workflow-id wf-123
  node security-enforcement.mjs --task "Implement encryption" --json

PROGRAMMATIC USE:
  import { checkSecurityTriggers } from './security-enforcement.mjs';
  const check = await checkSecurityTriggers("Add login endpoint");
`);
}

// CLI interface
async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (!args.task) {
    console.error('Error: Task description is required. Use --task <description>');
    console.error('Use --help for usage information.');
    process.exit(1);
  }

  try {
    const check = await checkSecurityTriggers(args.task);
    const requirements = await getSecurityRequirements(args.task);

    const result = {
      check,
      requirements
    };

    // If workflow ID provided, check approval
    if (args.workflowId) {
      const approval = await validateSecurityApproval(args.workflowId, check);
      result.approval = approval;
    }

    if (args.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('\n=== Security Check Results ===\n');
      console.log(`Triggered: ${check.triggered ? 'YES' : 'NO'}`);

      if (check.triggered) {
        console.log(`Priority: ${check.priority.toUpperCase()}`);
        console.log(`Blocking: ${check.blocking ? 'YES' : 'NO'}`);
        console.log(`Requires Signoff: ${check.requireSignoff ? 'YES' : 'NO'}`);
        console.log(`Categories: ${check.categories.join(', ')}`);
        console.log(`Required Agents: ${check.requiredAgents.join(', ')}`);

        console.log('\nRecommendations:');
        for (const rec of requirements.recommendations) {
          console.log(`  - ${rec}`);
        }

        if (result.approval) {
          console.log(`\nApproval Status: ${result.approval.approved ? 'APPROVED' : 'PENDING'}`);
          console.log(`Reason: ${result.approval.reason}`);
        }
      }
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  main().catch(console.error);
}

export default {
  checkSecurityTriggers,
  hasSecurityArchitectApproval,
  getSecurityRequirements,
  validateSecurityApproval
};
