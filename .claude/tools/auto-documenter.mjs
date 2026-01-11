#!/usr/bin/env node
/**
 * Auto-Documenter - Automatic Documentation from Workflow Execution
 *
 * Automatically generates documentation after workflow completion:
 * - Workflow summaries with key decisions
 * - Pattern reports from execution history
 * - Updates to routing documentation based on learned patterns
 *
 * Usage:
 *   import { documentWorkflowCompletion } from './auto-documenter.mjs';
 *   await documentWorkflowCompletion(workflowResult);
 *
 * CLI:
 *   node auto-documenter.mjs --workflow <result.json>
 *   node auto-documenter.mjs --report --task-type UI_UX
 *   node auto-documenter.mjs --update-docs
 */

import { readFile, writeFile, mkdir, appendFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { recordExecution, getPatternInsights, getAllPatterns } from './pattern-learner.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DOCS_DIR = join(__dirname, '..', 'docs');
const ROUTING_DOCS_PATH = join(DOCS_DIR, 'routing-patterns.md');
const WORKFLOW_LOG_PATH = join(__dirname, '..', 'context', 'workflow-executions.log');

/**
 * Initialize documentation directories
 */
async function initDocs() {
  if (!existsSync(DOCS_DIR)) {
    await mkdir(DOCS_DIR, { recursive: true });
  }

  const contextDir = dirname(WORKFLOW_LOG_PATH);
  if (!existsSync(contextDir)) {
    await mkdir(contextDir, { recursive: true });
  }

  // Initialize routing patterns doc if it doesn't exist
  if (!existsSync(ROUTING_DOCS_PATH)) {
    const initialDoc = `# Agent Routing Patterns

This document is automatically updated by auto-documenter based on learned patterns from workflow executions.

Last Updated: ${new Date().toISOString()}

## Learned Patterns

<!-- Auto-generated content follows -->

`;
    await writeFile(ROUTING_DOCS_PATH, initialDoc);
  }
}

/**
 * Document workflow completion
 * @param {Object} workflowResult - Workflow execution result
 * @param {string} workflowResult.workflowId - Workflow identifier
 * @param {string} workflowResult.taskType - Task type
 * @param {string[]} workflowResult.agents - Agents used
 * @param {string} workflowResult.outcome - success|failure|partial
 * @param {number} workflowResult.duration - Duration in minutes
 * @param {Object} workflowResult.artifacts - Generated artifacts
 * @param {Object} workflowResult.feedback - User feedback or metrics
 * @returns {Promise<string>} Path to generated summary
 */
export async function documentWorkflowCompletion(workflowResult) {
  await initDocs();

  // Record execution in pattern learner
  await recordExecution({
    task: workflowResult.task || 'Workflow execution',
    taskType: workflowResult.taskType,
    agents: workflowResult.agents,
    outcome: workflowResult.outcome,
    duration: workflowResult.duration,
    feedback: workflowResult.feedback || {},
    complexity: workflowResult.complexity,
  });

  // Generate workflow summary
  const summary = generateWorkflowSummary(workflowResult);

  // Log to workflow executions
  const logEntry = `[${new Date().toISOString()}] ${workflowResult.workflowId} | ${workflowResult.taskType} | ${workflowResult.outcome} | ${workflowResult.duration}m | ${workflowResult.agents.join(' → ')}\n`;
  await appendFile(WORKFLOW_LOG_PATH, logEntry);

  // Save summary to file
  const summaryPath = join(DOCS_DIR, 'workflow-summaries', `${workflowResult.workflowId}.md`);
  const summaryDir = dirname(summaryPath);
  if (!existsSync(summaryDir)) {
    await mkdir(summaryDir, { recursive: true });
  }
  await writeFile(summaryPath, summary);

  // Update routing docs if outcome was successful
  if (workflowResult.outcome === 'success') {
    await updateRoutingDocs({
      taskType: workflowResult.taskType,
      agents: workflowResult.agents,
      duration: workflowResult.duration,
      insight: workflowResult.feedback?.insight || 'Successful execution',
    });
  }

  return summaryPath;
}

/**
 * Generate workflow summary markdown
 * @param {Object} workflowResult - Workflow result
 * @returns {string} Markdown summary
 */
function generateWorkflowSummary(workflowResult) {
  const lines = [];

  lines.push(`# Workflow Execution Summary`);
  lines.push('');
  lines.push(`**Workflow ID**: ${workflowResult.workflowId}`);
  lines.push(`**Task Type**: ${workflowResult.taskType}`);
  lines.push(`**Outcome**: ${workflowResult.outcome}`);
  lines.push(`**Duration**: ${workflowResult.duration} minutes`);
  lines.push(`**Timestamp**: ${new Date().toISOString()}`);
  lines.push('');

  lines.push(`## Task`);
  lines.push('');
  lines.push(workflowResult.task || 'No task description provided');
  lines.push('');

  lines.push(`## Agent Chain`);
  lines.push('');
  lines.push(workflowResult.agents.map((agent, i) => `${i + 1}. ${agent}`).join('\n'));
  lines.push('');

  if (workflowResult.artifacts && Object.keys(workflowResult.artifacts).length > 0) {
    lines.push(`## Artifacts Generated`);
    lines.push('');
    for (const [name, path] of Object.entries(workflowResult.artifacts)) {
      lines.push(`- **${name}**: \`${path}\``);
    }
    lines.push('');
  }

  if (workflowResult.feedback) {
    lines.push(`## Feedback & Metrics`);
    lines.push('');
    for (const [key, value] of Object.entries(workflowResult.feedback)) {
      lines.push(`- **${key}**: ${value}`);
    }
    lines.push('');
  }

  if (workflowResult.errors && workflowResult.errors.length > 0) {
    lines.push(`## Errors Encountered`);
    lines.push('');
    workflowResult.errors.forEach((error, i) => {
      lines.push(`${i + 1}. ${error.message || error}`);
      if (error.resolution) {
        lines.push(`   - **Resolution**: ${error.resolution}`);
      }
    });
    lines.push('');
  }

  lines.push(`## Outcome Details`);
  lines.push('');
  if (workflowResult.outcome === 'success') {
    lines.push('✓ Workflow completed successfully');
  } else if (workflowResult.outcome === 'failure') {
    lines.push('✗ Workflow failed');
    if (workflowResult.failureReason) {
      lines.push(`\n**Reason**: ${workflowResult.failureReason}`);
    }
  } else if (workflowResult.outcome === 'partial') {
    lines.push('⚠ Workflow partially completed');
    if (workflowResult.partialReason) {
      lines.push(`\n**Details**: ${workflowResult.partialReason}`);
    }
  }
  lines.push('');

  lines.push(`---`);
  lines.push(`*Generated by auto-documenter.mjs on ${new Date().toISOString()}*`);

  return lines.join('\n');
}

/**
 * Generate pattern report for a task type
 * @param {string} [taskType] - Optional task type (generates for all if not specified)
 * @returns {Promise<string>} Markdown report
 */
export async function generatePatternReport(taskType = null) {
  await initDocs();

  const lines = [];
  lines.push(`# Agent Routing Pattern Report`);
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');

  if (taskType) {
    const insights = await getPatternInsights(taskType);
    lines.push(...formatTaskTypeInsights(taskType, insights));
  } else {
    const registry = await getAllPatterns();
    const taskTypes = Object.keys(registry.patterns);

    lines.push(`## Summary`);
    lines.push('');
    lines.push(`- **Total Task Types**: ${taskTypes.length}`);
    lines.push(`- **Total Executions**: ${registry.metadata.totalExecutions}`);
    lines.push(`- **Last Updated**: ${registry.metadata.lastUpdated}`);
    lines.push('');

    for (const type of taskTypes) {
      const insights = await getPatternInsights(type);
      lines.push('---');
      lines.push('');
      lines.push(...formatTaskTypeInsights(type, insights));
    }
  }

  const reportPath = join(
    DOCS_DIR,
    taskType ? `pattern-report-${taskType}.md` : 'pattern-report-all.md'
  );
  await writeFile(reportPath, lines.join('\n'));

  return reportPath;
}

/**
 * Format task type insights as markdown
 * @param {string} taskType - Task type
 * @param {Object} insights - Insights data
 * @returns {string[]} Array of markdown lines
 */
function formatTaskTypeInsights(taskType, insights) {
  const lines = [];

  lines.push(`## ${taskType}`);
  lines.push('');

  if (!insights.hasData) {
    lines.push(insights.message);
    lines.push('');
    return lines;
  }

  lines.push(`**Executions**: ${insights.executionCount}`);
  lines.push(`**Success Rate**: ${insights.successRate.toFixed(1)}%`);
  lines.push(`**Avg Duration**: ${insights.avgDuration.toFixed(1)} minutes`);
  lines.push('');

  if (insights.insights && insights.insights.length > 0) {
    lines.push(`### Insights`);
    lines.push('');
    insights.insights.forEach(insight => {
      lines.push(`- ${insight}`);
    });
    lines.push('');
  }

  if (insights.topAgentCombinations && insights.topAgentCombinations.length > 0) {
    lines.push(`### Top Agent Combinations`);
    lines.push('');
    lines.push('| Agent Chain | Success Rate | Count | Avg Duration |');
    lines.push('|-------------|--------------|-------|--------------|');
    insights.topAgentCombinations.forEach(combo => {
      lines.push(
        `| ${combo.agents} | ${combo.successRate.toFixed(1)}% | ${combo.count} | ${combo.avgDuration.toFixed(1)}m |`
      );
    });
    lines.push('');
  }

  if (insights.recentExecutions && insights.recentExecutions.length > 0) {
    lines.push(`### Recent Executions`);
    lines.push('');
    insights.recentExecutions.forEach(exec => {
      const timestamp = new Date(exec.timestamp).toLocaleString();
      lines.push(
        `- **${timestamp}**: ${exec.outcome} (${exec.duration}m) - ${exec.agents.join(' → ')}`
      );
    });
    lines.push('');
  }

  return lines;
}

/**
 * Update routing documentation with new pattern
 * @param {Object} pattern - Pattern to document
 * @param {string} pattern.taskType - Task type
 * @param {string[]} pattern.agents - Agent chain
 * @param {number} pattern.duration - Duration
 * @param {string} pattern.insight - Insight or learning
 * @returns {Promise<void>}
 */
export async function updateRoutingDocs(pattern) {
  await initDocs();

  const timestamp = new Date().toISOString();
  const entry = `
### ${pattern.taskType} - ${new Date().toLocaleDateString()}

**Agent Chain**: ${pattern.agents.join(' → ')}
**Duration**: ${pattern.duration} minutes
**Insight**: ${pattern.insight}

`;

  // Read existing content
  let content = await readFile(ROUTING_DOCS_PATH, 'utf-8');

  // Update "Last Updated" line
  content = content.replace(/Last Updated: .*/, `Last Updated: ${timestamp}`);

  // Find the "Learned Patterns" section and append
  const markerIndex = content.indexOf('<!-- Auto-generated content follows -->');
  if (markerIndex !== -1) {
    const beforeMarker = content.substring(
      0,
      markerIndex + '<!-- Auto-generated content follows -->'.length
    );
    const afterMarker = content.substring(
      markerIndex + '<!-- Auto-generated content follows -->'.length
    );

    content = beforeMarker + '\n' + entry + afterMarker;
  } else {
    // Fallback: append to end
    content += '\n' + entry;
  }

  await writeFile(ROUTING_DOCS_PATH, content);
}

/**
 * Parse command line arguments
 */
function parseArgs(args) {
  const parsed = {
    action: null,
    file: null,
    taskType: null,
    json: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--workflow' || arg === '-w') {
      parsed.action = 'workflow';
      parsed.file = args[++i];
    } else if (arg === '--report' || arg === '-r') {
      parsed.action = 'report';
    } else if (arg === '--task-type' || arg === '-t') {
      parsed.taskType = args[++i];
    } else if (arg === '--update-docs' || arg === '-u') {
      parsed.action = 'update-docs';
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
Auto-Documenter - Automatic Workflow Documentation

Generates documentation after workflow execution and learns patterns.

USAGE:
  node auto-documenter.mjs <action> [options]

ACTIONS:
  --workflow, -w <file>    Document workflow completion from JSON file
  --report, -r             Generate pattern report
  --task-type, -t <type>   Generate report for specific task type
  --update-docs, -u        Update routing documentation with latest patterns

OPTIONS:
  --json, -j               Output as JSON
  --help, -h               Show this help message

EXAMPLES:
  # Document workflow completion
  node auto-documenter.mjs --workflow result.json

  # Generate pattern report for all task types
  node auto-documenter.mjs --report

  # Generate pattern report for specific task type
  node auto-documenter.mjs --report --task-type UI_UX

PROGRAMMATIC USE:
  import { documentWorkflowCompletion } from './auto-documenter.mjs';
  const summaryPath = await documentWorkflowCompletion(workflowResult);
`);
}

/**
 * CLI interface
 */
async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  try {
    switch (args.action) {
      case 'workflow': {
        if (!args.file) {
          console.error('Error: --workflow requires a file path');
          process.exit(1);
        }
        const workflowResult = JSON.parse(await readFile(args.file, 'utf-8'));
        const summaryPath = await documentWorkflowCompletion(workflowResult);
        console.log(`✓ Workflow documented: ${summaryPath}`);
        break;
      }

      case 'report': {
        const reportPath = await generatePatternReport(args.taskType);
        console.log(`✓ Pattern report generated: ${reportPath}`);
        break;
      }

      case 'update-docs': {
        // Regenerate full routing docs from all patterns
        const registry = await getAllPatterns();
        for (const taskType of Object.keys(registry.patterns)) {
          const insights = await getPatternInsights(taskType);
          if (insights.hasData && insights.topAgentCombinations.length > 0) {
            const topCombo = insights.topAgentCombinations[0];
            await updateRoutingDocs({
              taskType,
              agents: topCombo.agents.split(' → '),
              duration: topCombo.avgDuration,
              insight: `${topCombo.successRate.toFixed(1)}% success rate over ${topCombo.count} executions`,
            });
          }
        }
        console.log(`✓ Routing documentation updated`);
        break;
      }

      default:
        console.error('Error: No action specified. Use --help for usage information.');
        process.exit(1);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  main().catch(console.error);
}

export default {
  documentWorkflowCompletion,
  generatePatternReport,
  updateRoutingDocs,
};
