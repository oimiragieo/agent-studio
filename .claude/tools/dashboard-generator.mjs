#!/usr/bin/env node
/**
 * Dashboard Generator - Creates and updates run-summary.md
 * 
 * Generates a continuously updated operator dashboard that highlights:
 * - Current status and awaiting_approval states
 * - Current step and next steps
 * - Blockers and open questions
 * - Artifact links
 * - Recent milestones
 * 
 * Usage:
 *   import { generateRunSummary, updateRunSummary } from './dashboard-generator.mjs';
 */

import { readFile, writeFile } from 'fs/promises';
import { join, relative } from 'path';
import { existsSync } from 'fs';
import { readRun, readArtifactRegistry, getRunDirectoryStructure, getArtifactsArray } from './run-manager.mjs';
import { readFileSync } from 'fs';

/**
 * Generate run summary markdown
 * @param {string} runId - Run identifier
 * @returns {Promise<string>} Markdown content
 */
export async function generateRunSummary(runId) {
  const runRecord = await readRun(runId);
  const runDirs = getRunDirectoryStructure(runId);
  
  let artifactRegistry = { artifacts: {} };
  try {
    artifactRegistry = await readArtifactRegistry(runId);
  } catch (error) {
    // Registry may not exist yet
  }
  
  // Use shared helper to handle both map and array formats
  const artifactsArray = getArtifactsArray(artifactRegistry);
  
  // Determine status emoji and color
  const statusInfo = getStatusInfo(runRecord.status);
  
  // Build summary
  let summary = `# Run Summary: ${runId}\n\n`;
  summary += `**Last Updated**: ${new Date().toISOString()}\n\n`;
  summary += `---\n\n`;
  
  // Status Section
  summary += `## ${statusInfo.emoji} Status: ${runRecord.status}\n\n`;
  if (runRecord.status === 'awaiting_approval') {
    const approvalRequest = runRecord.metadata?.approval_request;
    if (approvalRequest) {
      summary += `⚠️ **APPROVAL REQUIRED**\n\n`;
      summary += `- **Step**: ${approvalRequest.step}\n`;
      summary += `- **Reason**: ${approvalRequest.reason}\n`;
      summary += `- **Artifact**: ${approvalRequest.artifact || 'N/A'}\n`;
      summary += `- **Requested**: ${approvalRequest.requested_at}\n\n`;
      summary += `**Action Required**: Review the artifact and approve to continue.\n\n`;
    }
  }
  
  summary += `- **Workflow**: \`${runRecord.selected_workflow || 'Not selected'}\`\n`;
  summary += `- **Current Step**: ${runRecord.current_step}\n`;
  summary += `- **Created**: ${runRecord.created_at}\n`;
  if (runRecord.timestamps?.started_at) {
    summary += `- **Started**: ${runRecord.timestamps.started_at}\n`;
  }
  if (runRecord.timestamps?.completed_at) {
    summary += `- **Completed**: ${runRecord.timestamps.completed_at}\n`;
  }
  summary += `\n---\n\n`;
  
  // Routing Section
  if (runRecord.metadata?.intent || runRecord.metadata?.routing_confidence) {
    summary += `## 🧭 Routing\n\n`;
    if (runRecord.metadata.intent) {
      summary += `- **Intent**: ${runRecord.metadata.intent}\n`;
    }
    if (runRecord.metadata.complexity) {
      summary += `- **Complexity**: ${runRecord.metadata.complexity}\n`;
    }
    if (runRecord.metadata.routing_confidence !== undefined) {
      summary += `- **Confidence**: ${(runRecord.metadata.routing_confidence * 100).toFixed(1)}%\n`;
    }
    if (runRecord.metadata.routing_method) {
      summary += `- **Method**: ${runRecord.metadata.routing_method}\n`;
    }
    summary += `\n---\n\n`;
  }
  
  // Progress Section
  summary += `## 📊 Progress\n\n`;
  
  if (runRecord.completed_steps && runRecord.completed_steps.length > 0) {
    summary += `- **Completed Steps**: ${runRecord.completed_steps.join(', ')}\n`;
  }
  
  if (runRecord.task_queue && runRecord.task_queue.length > 0) {
    const pending = runRecord.task_queue.filter(t => t.status === 'pending').length;
    const inProgress = runRecord.task_queue.filter(t => t.status === 'in_progress').length;
    const completed = runRecord.task_queue.filter(t => t.status === 'completed').length;
    
    summary += `- **Tasks**: ${completed} completed, ${inProgress} in progress, ${pending} pending\n`;
  }
  
  summary += `\n---\n\n`;
  
  // Next Steps Section
  summary += `## 🎯 Next Steps\n\n`;
  
  if (runRecord.status === 'awaiting_approval') {
    summary += `1. **REQUIRED**: Review and approve step ${runRecord.metadata?.approval_request?.step || runRecord.current_step}\n`;
    summary += `2. After approval, workflow will continue automatically\n`;
  } else if (runRecord.status === 'in_progress') {
    const nextStep = runRecord.current_step + 1;
    summary += `1. Continue workflow execution from step ${nextStep}\n`;
    if (runRecord.selected_workflow) {
      summary += `2. Execute: \`node workflow_runner.js --workflow "${runRecord.selected_workflow}" --step ${nextStep} --run-id ${runId}\`\n`;
    }
  } else if (runRecord.status === 'handoff_pending') {
    summary += `1. Handoff in progress - waiting for new orchestrator to acknowledge\n`;
  } else if (runRecord.status === 'paused') {
    summary += `1. Workflow is paused - resume to continue\n`;
  } else if (runRecord.status === 'failed') {
    summary += `1. Review error details in run.json\n`;
    if (runRecord.step_retries) {
      const failedSteps = Object.keys(runRecord.step_retries);
      if (failedSteps.length > 0) {
        summary += `2. Failed steps: ${failedSteps.join(', ')}\n`;
        summary += `3. Retry failed steps or fix errors manually\n`;
      }
    }
  } else if (runRecord.status === 'completed') {
    summary += `✅ Workflow completed successfully!\n`;
  }
  
  summary += `\n---\n\n`;
  
  // Blockers Section
  if (runRecord.metadata?.blockers && runRecord.metadata.blockers.length > 0) {
    summary += `## 🚫 Blockers\n\n`;
    runRecord.metadata.blockers.forEach(blocker => {
      summary += `- ${blocker}\n`;
    });
    summary += `\n---\n\n`;
  }
  
  // Open Questions Section
  if (runRecord.metadata?.open_questions && runRecord.metadata.open_questions.length > 0) {
    summary += `## ❓ Open Questions\n\n`;
    runRecord.metadata.open_questions.forEach(question => {
      summary += `- ${question}\n`;
    });
    summary += `\n---\n\n`;
  }
  
  // Artifacts Section
  summary += `## 📦 Artifacts\n\n`;
  
  if (artifactsArray && artifactsArray.length > 0) {
    summary += `**Total Artifacts**: ${artifactsArray.length}\n\n`;
    
    // Group by step
    const artifactsByStep = {};
    artifactsArray.forEach(artifact => {
      const step = artifact.step || 0;
      if (!artifactsByStep[step]) {
        artifactsByStep[step] = [];
      }
      artifactsByStep[step].push(artifact);
    });
    
    Object.keys(artifactsByStep).sort((a, b) => parseInt(a) - parseInt(b)).forEach(step => {
      summary += `### Step ${step}\n\n`;
      artifactsByStep[step].forEach(artifact => {
        // Standardize on validation_status (snake_case) with backward compatibility
        const validationStatus = artifact.metadata?.validation_status || artifact.validationStatus || 'pending';
        const statusEmoji = validationStatus === 'pass' ? '✅' : 
                           validationStatus === 'fail' ? '❌' : '⏳';
        summary += `- ${statusEmoji} \`${artifact.name}\` (${artifact.agent || 'unknown'})\n`;
        if (artifact.path && existsSync(artifact.path)) {
          const relativePath = relative(process.cwd(), artifact.path);
          summary += `  - Path: \`${relativePath}\`\n`;
        }
      });
      summary += `\n`;
    });
  } else {
    summary += `No artifacts registered yet.\n\n`;
  }
  
  summary += `---\n\n`;
  
  // Links Section
  summary += `## 🔗 Links\n\n`;
  summary += `- **Run Record**: \`${relative(process.cwd(), runDirs.run_json)}\`\n`;
  summary += `- **Artifact Registry**: \`${relative(process.cwd(), runDirs.artifact_registry)}\`\n`;
  if (existsSync(runDirs.handoff_json)) {
    summary += `- **Handoff Package**: \`${relative(process.cwd(), runDirs.handoff_json)}\`\n`;
  }
  if (existsSync(runDirs.handoff_md)) {
    summary += `- **Handoff Summary**: \`${relative(process.cwd(), runDirs.handoff_md)}\`\n`;
  }
  
  summary += `\n---\n\n`;
  
  // Recent Milestones
  if (runRecord.state_transitions && runRecord.state_transitions.length > 0) {
    summary += `## 📅 Recent Milestones\n\n`;
    const recentTransitions = runRecord.state_transitions.slice(-5).reverse();
    recentTransitions.forEach(transition => {
      summary += `- **${transition.to}** (${new Date(transition.timestamp).toLocaleString()})\n`;
      if (transition.reason) {
        summary += `  - ${transition.reason}\n`;
      }
    });
    summary += `\n`;
  }
  
  return summary;
}

/**
 * Get status info (emoji, color)
 * @param {string} status - Run status
 * @returns {Object} Status info
 */
function getStatusInfo(status) {
  const statusMap = {
    pending: { emoji: '⏳', color: 'gray' },
    in_progress: { emoji: '🔄', color: 'blue' },
    awaiting_approval: { emoji: '⚠️', color: 'yellow' },
    handoff_pending: { emoji: '🔄', color: 'orange' },
    handed_off: { emoji: '✅', color: 'green' },
    paused: { emoji: '⏸️', color: 'gray' },
    completed: { emoji: '✅', color: 'green' },
    failed: { emoji: '❌', color: 'red' },
    cancelled: { emoji: '🚫', color: 'gray' }
  };
  
  return statusMap[status] || { emoji: '❓', color: 'gray' };
}

/**
 * Update run summary file
 * @param {string} runId - Run identifier
 * @returns {Promise<string>} Path to summary file
 */
export async function updateRunSummary(runId) {
  const summary = await generateRunSummary(runId);
  const runDirs = getRunDirectoryStructure(runId);
  const summaryPath = join(runDirs.run_dir, 'run-summary.md');
  
  await writeFile(summaryPath, summary, 'utf-8');
  
  return summaryPath;
}

/**
 * Get summary content (read from file if exists, otherwise generate)
 * @param {string} runId - Run identifier
 * @returns {Promise<string>} Summary content
 */
export async function getRunSummary(runId) {
  const runDirs = getRunDirectoryStructure(runId);
  const summaryPath = join(runDirs.run_dir, 'run-summary.md');
  
  if (existsSync(summaryPath)) {
    try {
      return await readFile(summaryPath, 'utf-8');
    } catch (error) {
      // If read fails, regenerate
    }
  }
  
  // Generate if doesn't exist
  return await generateRunSummary(runId);
}

export default {
  generateRunSummary,
  updateRunSummary,
  getRunSummary
};
