#!/usr/bin/env node

/**
 * Skill Validator - Post-execution validation of skill usage
 *
 * Validates that agents actually USED their required skills during execution
 * by analyzing execution logs and outputs.
 *
 * Usage:
 *   node skill-validator.mjs --agent developer --task "Create component" --log ./execution.log
 *   echo "Used Skill: scaffolder" | node skill-validator.mjs --agent developer --task "Create"
 *   node skill-validator.mjs --run-id abc123 --step 6
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { detectAllSkills } from './skill-trigger-detector.mjs';
import { getRunDirectoryStructure } from './run-manager.mjs';

// ============================================================================
// SKILL INVOCATION PATTERNS
// ============================================================================

const SKILL_INVOCATION_PATTERNS = {
  // Explicit Skill tool usage
  skill_tool: /Skill:\s*(\w+[-\w]*)/gi,

  // Natural language invocation patterns
  natural_language: [
    /(?:using|invoking|running|executing|called|invoked)\s+(?:the\s+)?(\w+[-\w]*)\s+skill/gi,
    /(?:will|should|must)\s+(?:use|invoke|run|execute|call)\s+(?:the\s+)?(\w+[-\w]*)\s+skill/gi,
    /(?:delegat(?:e|ed|ing))\s+to\s+(?:the\s+)?(\w+[-\w]*)\s+skill/gi,
    /(?:skill|tool):\s*(\w+[-\w]*)/gi,
  ],

  // Skill-specific artifact patterns (evidence of skill execution)
  skill_artifacts: {
    scaffolder: [
      /generated.*(?:component|boilerplate|scaffold)/i,
      /SCAFFOLD_OUTPUT/i,
      /scaffolded.*files/i,
      /created.*(?:from\s+)?template/i,
      /boilerplate.*generated/i,
    ],
    'rule-auditor': [
      /(?:rule|compliance).*(?:audit|validation|check)/i,
      /RULE_VIOLATIONS/i,
      /compliance.*report/i,
      /audited.*(?:for\s+)?rules/i,
      /rule.*(?:violations?|compliance)/i,
      /found.*violations/i,
    ],
    'repo-rag': [
      /(?:searched|found|retrieved).*(?:codebase|repository)/i,
      /RAG_RESULTS/i,
      /codebase.*search.*results/i,
      /semantic.*search/i,
      /found.*(?:in\s+)?(?:codebase|repo)/i,
      /retrieved.*(?:from\s+)?(?:codebase|repo)/i,
    ],
    'test-generator': [
      /(?:generated|created).*test(?:s)?/i,
      /TEST_OUTPUT/i,
      /test.*(?:suite|cases?).*generated/i,
      /created.*test.*(?:suite|file)/i,
    ],
    'diagram-generator': [
      /(?:generated|created).*(?:diagram|mermaid)/i,
      /DIAGRAM_OUTPUT/i,
      /mermaid.*(?:diagram|chart)/i,
      /created.*(?:architecture|sequence|flow).*diagram/i,
    ],
    'response-rater': [
      /(?:rated|scored|evaluated).*(?:plan|response)/i,
      /RATING_OUTPUT/i,
      /(?:plan|response).*(?:rating|score)/i,
      /scored.*\/10/i,
      /evaluation.*(?:score|rating)/i,
    ],
    'claude-md-generator': [
      /(?:generated|created).*claude\.md/i,
      /CLAUDE_MD_OUTPUT/i,
      /module.*documentation.*generated/i,
    ],
    'plan-generator': [
      /(?:generated|created).*plan/i,
      /PLAN_OUTPUT/i,
      /implementation.*plan.*generated/i,
    ],
    'code-style-validator': [
      /(?:validated|checked).*(?:code\s+)?style/i,
      /STYLE_VIOLATIONS/i,
      /style.*(?:violations?|compliance)/i,
    ],
    'dependency-analyzer': [
      /(?:analyzed|checked).*dependencies/i,
      /DEPENDENCY_ANALYSIS/i,
      /dependency.*(?:conflicts?|vulnerabilities)/i,
      /breaking.*changes.*detected/i,
    ],
    'memory-manager': [
      /(?:stored|saved|retrieved).*(?:memory|knowledge)/i,
      /MEMORY_OUTPUT/i,
      /knowledge.*(?:stored|retrieved)/i,
    ],
    recovery: [
      /(?:recovered|retried).*(?:from\s+)?(?:failure|error)/i,
      /RECOVERY_OUTPUT/i,
      /workflow.*recovered/i,
    ],
    'conflict-resolution': [
      /(?:resolved|mediated).*conflict/i,
      /CONFLICT_RESOLUTION/i,
      /agent.*disagreement.*resolved/i,
    ],
    'sequential-thinking': [
      /(?:using|applied).*sequential.*thinking/i,
      /THINKING_OUTPUT/i,
      /step-by-step.*analysis/i,
      /structured.*reasoning/i,
    ],
    'doc-generator': [
      /(?:generated|created).*documentation/i,
      /DOC_OUTPUT/i,
      /documentation.*generated/i,
    ],
    'api-contract-generator': [
      /(?:generated|created).*(?:api|openapi|swagger).*(?:contract|spec)/i,
      /API_CONTRACT_OUTPUT/i,
      /api.*specification.*generated/i,
    ],
    'excel-generator': [/(?:generated|created).*excel/i, /EXCEL_OUTPUT/i, /\.xlsx.*created/i],
    'powerpoint-generator': [
      /(?:generated|created).*(?:powerpoint|presentation)/i,
      /POWERPOINT_OUTPUT/i,
      /\.pptx.*created/i,
    ],
    'pdf-generator': [/(?:generated|created).*pdf/i, /PDF_OUTPUT/i, /\.pdf.*created/i],
    evaluator: [
      /(?:evaluated|assessed).*(?:quality|performance)/i,
      /EVALUATION_OUTPUT/i,
      /evaluation.*results/i,
    ],
    classifier: [
      /(?:classified|categorized)/i,
      /CLASSIFICATION_OUTPUT/i,
      /classification.*results/i,
    ],
    summarizer: [/(?:summarized|condensed)/i, /SUMMARY_OUTPUT/i, /summary.*generated/i],
  },
};

// ============================================================================
// SKILL EXTRACTION
// ============================================================================

/**
 * Extract skill names from execution log using pattern matching
 * @param {string} executionLog - Full execution log text
 * @returns {Set<string>} Set of detected skill names (lowercase)
 */
export function extractUsedSkills(executionLog) {
  const usedSkills = new Set();

  if (!executionLog || typeof executionLog !== 'string') {
    return usedSkills;
  }

  // 1. Check explicit Skill tool usage
  const toolMatches = executionLog.matchAll(SKILL_INVOCATION_PATTERNS.skill_tool);
  for (const match of toolMatches) {
    const skillName = match[1].toLowerCase();
    usedSkills.add(skillName);
  }

  // 2. Check natural language invocation patterns
  for (const pattern of SKILL_INVOCATION_PATTERNS.natural_language) {
    const nlMatches = executionLog.matchAll(pattern);
    for (const match of nlMatches) {
      const skillName = match[1].toLowerCase();
      // Only add if it looks like a skill name (contains hyphen or known skill)
      if (skillName.includes('-') || isKnownSkill(skillName)) {
        usedSkills.add(skillName);
      }
    }
  }

  // 3. Check for skill-specific artifacts (evidence of execution)
  for (const [skillName, patterns] of Object.entries(SKILL_INVOCATION_PATTERNS.skill_artifacts)) {
    for (const pattern of patterns) {
      if (pattern.test(executionLog)) {
        usedSkills.add(skillName);
        break; // One match per skill is enough
      }
    }
  }

  return usedSkills;
}

/**
 * Check if a name matches a known skill
 * @param {string} name - Potential skill name
 * @returns {boolean}
 */
function isKnownSkill(name) {
  const knownSkills = [
    'scaffolder',
    'rule-auditor',
    'repo-rag',
    'test-generator',
    'diagram-generator',
    'response-rater',
    'claude-md-generator',
    'plan-generator',
    'code-style-validator',
    'dependency-analyzer',
    'memory-manager',
    'memory',
    'recovery',
    'conflict-resolution',
    'sequential-thinking',
    'doc-generator',
    'api-contract-generator',
    'excel-generator',
    'powerpoint-generator',
    'pdf-generator',
    'evaluator',
    'classifier',
    'summarizer',
    'explaining-rules',
    'fixing-rule-violations',
    'migrating-rules',
    'rule-selector',
    'artifact-publisher',
    'context-bridge',
    'tool-search',
    'mcp-converter',
    'skill-manager',
    'commit-validator',
    'optional-artifact-handler',
    'text-to-sql',
    'filesystem',
    'git',
    'github',
    'puppeteer',
    'chrome-devtools',
    'cloud-run',
    'computer-use',
  ];

  return knownSkills.includes(name.toLowerCase());
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate skill usage against requirements
 * @param {string} agentType - Agent type (e.g., 'developer', 'code-reviewer')
 * @param {string} taskDescription - Task description for trigger detection
 * @param {string} executionLog - Full execution log text
 * @returns {Promise<Object>} Validation result
 */
export async function validateSkillUsage(agentType, taskDescription, executionLog) {
  // 1. Get required and triggered skills from matrix
  const { required, triggered } = await detectAllSkills(agentType, taskDescription);

  // 2. Extract actually used skills
  const usedSet = extractUsedSkills(executionLog);
  const used = Array.from(usedSet);

  // 3. Check compliance
  const expectedSkills = [...new Set([...required, ...triggered])];
  const missingRequired = required.filter(s => !used.includes(s));
  const missingTriggered = triggered.filter(s => !used.includes(s));
  const unexpectedUsed = used.filter(s => !expectedSkills.includes(s));

  // 4. Calculate compliance score
  const totalExpected = expectedSkills.length;
  const totalMissing = missingRequired.length + missingTriggered.length;
  const complianceScore =
    totalExpected > 0 ? Math.round(((totalExpected - totalMissing) / totalExpected) * 100) : 100; // 100% if no skills expected

  // 5. Determine overall compliance (must have all required skills)
  const compliant = missingRequired.length === 0;

  return {
    compliant,
    complianceScore,
    expected: expectedSkills,
    used,
    violations: {
      missingRequired, // BLOCKING
      missingTriggered, // WARNING
      unexpectedUsed, // INFO
    },
    recommendation: generateRecommendation(missingRequired, missingTriggered, unexpectedUsed),
    details: {
      required,
      triggered,
      agentType,
      taskDescription:
        taskDescription.substring(0, 100) + (taskDescription.length > 100 ? '...' : ''),
    },
  };
}

/**
 * Generate recommendation based on violations
 * @param {string[]} missingRequired - Missing required skills
 * @param {string[]} missingTriggered - Missing triggered skills
 * @param {string[]} unexpectedUsed - Unexpected skills used
 * @returns {string} Recommendation text
 */
function generateRecommendation(missingRequired, missingTriggered, unexpectedUsed) {
  const recommendations = [];

  if (missingRequired.length > 0) {
    recommendations.push(
      `❌ CRITICAL: Agent must use required skills: ${missingRequired.join(', ')}. ` +
        `These skills are mandatory for this agent type.`
    );
  }

  if (missingTriggered.length > 0) {
    recommendations.push(
      `⚠️ WARNING: Task triggers suggest using: ${missingTriggered.join(', ')}. ` +
        `Consider using these skills for better results.`
    );
  }

  if (unexpectedUsed.length > 0) {
    recommendations.push(
      `ℹ️ INFO: Agent used unexpected skills: ${unexpectedUsed.join(', ')}. ` +
        `This is acceptable but may indicate skill matrix needs updating.`
    );
  }

  if (recommendations.length === 0) {
    return '✅ All skill requirements met. Excellent compliance!';
  }

  return recommendations.join('\n\n');
}

// ============================================================================
// REPORTING
// ============================================================================

/**
 * Generate markdown violation report
 * @param {Object} validationResult - Result from validateSkillUsage
 * @returns {string} Markdown report
 */
export function generateViolationReport(validationResult) {
  const { compliant, complianceScore, violations, expected, used, details, recommendation } =
    validationResult;

  let report = `## Skill Usage Validation Report\n\n`;
  report += `**Agent**: ${details.agentType}\n`;
  report += `**Task**: ${details.taskDescription}\n`;
  report += `**Compliance**: ${compliant ? '✅ PASS' : '❌ FAIL'}\n`;
  report += `**Score**: ${complianceScore}%\n\n`;

  // Expected vs Used
  report += `### Skills Overview\n\n`;
  report += `**Expected**: ${expected.length > 0 ? expected.join(', ') : 'None'}\n`;
  report += `**Used**: ${used.length > 0 ? used.join(', ') : 'None'}\n\n`;

  // Violations
  if (violations.missingRequired.length > 0) {
    report += `### ❌ Missing Required Skills (BLOCKING)\n\n`;
    violations.missingRequired.forEach(s => {
      report += `- **${s}** - This skill is mandatory for ${details.agentType}\n`;
    });
    report += `\n`;
  }

  if (violations.missingTriggered.length > 0) {
    report += `### ⚠️ Missing Triggered Skills (WARNING)\n\n`;
    violations.missingTriggered.forEach(s => {
      report += `- **${s}** - Task triggers suggest using this skill\n`;
    });
    report += `\n`;
  }

  if (violations.unexpectedUsed.length > 0) {
    report += `### ℹ️ Unexpected Skills Used (INFO)\n\n`;
    violations.unexpectedUsed.forEach(s => {
      report += `- **${s}** - Used but not in skill matrix for this task\n`;
    });
    report += `\n`;
  }

  // Recommendation
  report += `### Recommendation\n\n`;
  report += `${recommendation}\n`;

  return report;
}

/**
 * Generate JSON report
 * @param {Object} validationResult - Result from validateSkillUsage
 * @returns {string} JSON report
 */
export function generateJSONReport(validationResult) {
  return JSON.stringify(validationResult, null, 2);
}

// ============================================================================
// RUN STATE INTEGRATION
// ============================================================================

/**
 * Validate skill usage from run state
 * @param {string} runId - Run identifier
 * @param {number} stepNumber - Workflow step number
 * @returns {Promise<Object>} Validation result
 */
export async function validateRunSkillUsage(runId, stepNumber) {
  // Use run directory structure from run-manager (already uses resolver)
  const runDirs = getRunDirectoryStructure(runId);

  // Read execution log from run state
  const logPath = path.join(runDirs.run_dir, 'logs', `step-${stepNumber}.log`);

  if (!existsSync(logPath)) {
    throw new Error(`Execution log not found: ${logPath}`);
  }

  const executionLog = await readFile(logPath, 'utf-8');

  // Get step metadata for agent type and task
  const statePath = path.join(runDirs.run_dir, 'state.json');

  if (!existsSync(statePath)) {
    throw new Error(`Run state not found: ${statePath}`);
  }

  const runState = JSON.parse(await readFile(statePath, 'utf-8'));
  const step = runState.steps?.[stepNumber];

  if (!step) {
    throw new Error(`Step ${stepNumber} not found in run state`);
  }

  return validateSkillUsage(step.agent, step.task || step.description || '', executionLog);
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  const params = {
    agent: null,
    task: '',
    log: null,
    runId: null,
    step: null,
    format: 'markdown', // 'markdown' or 'json'
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--agent':
        params.agent = args[++i];
        break;
      case '--task':
        params.task = args[++i];
        break;
      case '--log':
        params.log = args[++i];
        break;
      case '--run-id':
        params.runId = args[++i];
        break;
      case '--step':
        params.step = parseInt(args[++i], 10);
        break;
      case '--format':
        params.format = args[++i];
        break;
      case '--help':
        console.log(`
Skill Validator - Validate agent skill usage

Usage:
  # Validate from log file
  node skill-validator.mjs --agent developer --task "Create component" --log ./execution.log

  # Validate from stdin
  echo "Used Skill: scaffolder" | node skill-validator.mjs --agent developer --task "Create"

  # Validate from run state
  node skill-validator.mjs --run-id abc123 --step 6

Options:
  --agent <type>       Agent type (required unless --run-id provided)
  --task <desc>        Task description (required unless --run-id provided)
  --log <path>         Path to execution log file (optional, reads stdin if not provided)
  --run-id <id>        Run identifier (alternative to --agent/--task/--log)
  --step <num>         Step number (required with --run-id)
  --format <type>      Output format: 'markdown' or 'json' (default: markdown)
  --help               Show this help
        `);
        process.exit(0);
    }
  }

  try {
    let validationResult;

    // Mode 1: Validate from run state
    if (params.runId && params.step !== null) {
      validationResult = await validateRunSkillUsage(params.runId, params.step);
    }
    // Mode 2: Validate from explicit parameters
    else {
      if (!params.agent) {
        console.error('Error: --agent is required (or use --run-id with --step)');
        process.exit(1);
      }

      // Read execution log
      let executionLog = '';

      if (params.log) {
        // Read from file
        if (!existsSync(params.log)) {
          console.error(`Error: Log file not found: ${params.log}`);
          process.exit(1);
        }
        executionLog = await readFile(params.log, 'utf-8');
      } else {
        // Read from stdin
        const chunks = [];
        for await (const chunk of process.stdin) {
          chunks.push(chunk);
        }
        executionLog = Buffer.concat(chunks).toString('utf-8');
      }

      validationResult = await validateSkillUsage(params.agent, params.task, executionLog);
    }

    // Output result
    if (params.format === 'json') {
      console.log(generateJSONReport(validationResult));
    } else {
      console.log(generateViolationReport(validationResult));
    }

    // Exit with appropriate code
    process.exit(validationResult.compliant ? 0 : 1);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Run CLI if invoked directly (cross-platform detection)
const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`;
if (isMainModule) {
  main();
}
