/**
 * Orchestrator Coordinator
 * Reads planner's plan and coordinates subagent execution
 * Supports all 24 agent types (22 original + gcp-cloud-agent + ai-council)
 * Handles hierarchical plans, data flow, and fallback agents
 */

import { 
  getMasterPlan, 
  getPhasePlan, 
  updatePhasePlanStatus,
  updateMasterPlanStatus,
  getPhasePlanSize,
  optimizePhasePlanSize,
  addArtifactToTask,
  addScratchpadEntry,
  getNextTask
} from './plan-manager.mjs';
import { createContextPacket, injectContext, extractConstraintsFromArchitecture } from './context-injector.mjs';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

// Fallback agent mapping
const FALLBACK_AGENT_MAP = {
  'security-architect': 'architect',
  'performance-engineer': 'developer',
  'compliance-auditor': 'security-architect',
  'llm-architect': 'architect',
  'database-architect': 'architect',
  'api-designer': 'architect',
  'mobile-developer': 'developer',
  'refactoring-specialist': 'developer',
  'legacy-modernizer': 'developer',
  'accessibility-expert': 'ux-expert',
  'incident-responder': 'devops',
  'model-orchestrator': 'architect',
  'gcp-cloud-agent': 'devops',
  'ai-council': 'planner'
};

/**
 * Load delegation template from external file
 * @param {string} agentName - Agent name
 * @returns {Promise<string>} Template content
 */
async function loadDelegationTemplate(agentName) {
  const templatePath = join('.claude/templates/delegation', `${agentName}.md`);
  
  if (existsSync(templatePath)) {
    return await readFile(templatePath, 'utf-8');
  }
  
  // Fallback to generic template
  return `# Task: {description}

## Context from Dependencies
{contextBlock}

## Instructions
{description}

Complete the task as specified.
`;
}

/**
 * Execute plan (hierarchical)
 * @param {string} planId - Master plan ID
 * @returns {Promise<Object>} Execution results
 */
export async function executePlan(planId) {
  const masterPlan = await getMasterPlan(planId);
  const completedResults = [];
  
  // Execute phases in order
  for (const phase of masterPlan.phases) {
    if (phase.status === 'pending' || phase.status === 'in_progress') {
      // Update phase status to in_progress
      await updateMasterPlanStatus(planId, {
        phaseStatus: {
          phaseId: phase.phaseId,
          status: 'in_progress'
        },
        overallStatus: {
          currentPhase: phase.phaseId
        }
      });
      
      const phasePlan = await getPhasePlan(`${planId}-${phase.phaseId}`);
      
      // Execute tasks in current phase
      for (const task of phasePlan.tasks) {
        if (task.status === 'pending' && dependenciesMet(task, phasePlan.tasks, completedResults)) {
          // Get results from dependent tasks (may be from previous phases)
          const dependentResults = completedResults.filter(r => 
            task.dependencies?.includes(r.taskId)
          );
          
          // Delegate with context injection
          const delegation = await delegateTask(task, dependentResults, phasePlan);
          
          // Execute task (with fallback handling)
          let result = await executeTaskWithFallback(delegation, task);
          
          // Capture artifacts
          result.artifacts = await extractArtifacts(result);
          
          // Add artifacts to task
          if (result.artifacts && result.artifacts.length > 0) {
            for (const artifact of result.artifacts) {
              await addArtifactToTask(`${planId}-${phase.phaseId}`, task.taskId, artifact);
            }
          }
          
          // Store for next iteration
          completedResults.push({
            taskId: task.taskId,
            phaseId: phase.phaseId,
            status: result.status,
            artifacts: result.artifacts,
            result: result
          });
          
          await updatePhasePlanStatus(`${planId}-${phase.phaseId}`, {
            taskStatus: {
              taskId: task.taskId,
              status: result.status,
              result: result
            }
          });
          
          // Check phase plan size - optimize if needed
          const phasePlanSize = await getPhasePlanSize(`${planId}-${phase.phaseId}`);
          if (phasePlanSize > 20000) {
            await optimizePhasePlanSize(`${planId}-${phase.phaseId}`);
          }
        }
      }
      
      // Update phase status in master plan
      await updateMasterPlanStatus(planId, {
        phaseStatus: {
          phaseId: phase.phaseId,
          status: 'completed'
        },
        overallStatus: {
          completedPhases: masterPlan.phases.filter(p => p.status === 'completed').length + 1
        }
      });
    }
  }
  
  return {
    planId,
    completedPhases: masterPlan.phases.filter(p => p.status === 'completed').length,
    totalPhases: masterPlan.phases.length,
    results: completedResults
  };
}

/**
 * Delegate task to agent with strict context injection
 * @param {Object} task - Task object
 * @param {Array} previousTaskResults - Results from previous tasks
 * @param {Object} phasePlan - Phase plan
 * @param {string} runId - Optional run ID for context packet
 * @returns {Promise<Object>} Delegation object
 */
export async function delegateTask(task, previousTaskResults = [], phasePlan = null, runId = null) {
  const template = await loadDelegationTemplate(task.assignedAgent);
  
  // Extract constraints from architecture if available
  const constraints = [];
  if (task.constraints && Array.isArray(task.constraints)) {
    constraints.push(...task.constraints);
  }
  
  // Try to extract from architecture document if referenced
  if (task.architecturePath && existsSync(task.architecturePath)) {
    const archConstraints = extractConstraintsFromArchitecture(task.architecturePath);
    constraints.push(...archConstraints);
  }
  
  // Build references from previous task artifacts
  const references = previousTaskResults.flatMap(r => 
    (r.artifacts || []).map(a => a.path || a.name)
  );
  
  // Add task-specific file references
  if (task.files && Array.isArray(task.files)) {
    references.push(...task.files);
  }
  
  // Create strict context packet
  const contextPacket = createContextPacket({
    goal: task.description,
    constraints,
    references,
    definitionOfDone: task.testRequirements?.expectedResults || 
                      task.definitionOfDone || 
                      `Task ${task.taskId} completed successfully with all artifacts generated`,
    runId,
    step: task.step || null,
    agent: task.assignedAgent
  });
  
  // Inject context into template
  const basePrompt = template
    .replace(/{description}/g, task.description)
    .replace(/{files}/g, (task.files || []).join(', ') || 'None specified')
    .replace(/{testRequirements}/g, JSON.stringify(task.testRequirements || {}, null, 2))
    .replace(/{expectedResults}/g, task.testRequirements?.expectedResults || 'N/A')
    .replace(/{output paths}/g, 'To be determined')
    .replace(/{test output}/g, 'To be determined')
    .replace(/{docs}/g, 'To be determined');
  
  const prompt = injectContext(basePrompt, contextPacket);
  
  return {
    agent: task.assignedAgent,
    prompt,
    taskId: task.taskId,
    fallbackAgent: FALLBACK_AGENT_MAP[task.assignedAgent] || null,
    contextPacket // Include for debugging/auditing
  };
}

/**
 * Execute task with fallback handling
 * @param {Object} delegation - Delegation object
 * @param {Object} task - Task object
 * @returns {Promise<Object>} Task result
 */
async function executeTaskWithFallback(delegation, task) {
  try {
    // Execute via Task tool (would be called by orchestrator)
    // This is a placeholder - actual execution would use the Task tool
    const result = {
      status: 'completed',
      summary: `Task ${task.taskId} completed by ${delegation.agent}`,
      artifacts: []
    };
    
    return result;
  } catch (error) {
    if (delegation.fallbackAgent) {
      console.warn(`Primary agent ${delegation.agent} failed, using fallback ${delegation.fallbackAgent}`);
      
      // Record failure in scratchpad
      await addScratchpadEntry(task.phaseId || 'unknown', {
        taskId: task.taskId,
        failureReason: error.message,
        avoidApproach: `Using ${delegation.agent} for this task type`
      });
      
      // Retry with fallback
      delegation.agent = delegation.fallbackAgent;
      return await executeTaskWithFallback(delegation, task);
    }
    
    // Record failure
    await addScratchpadEntry(task.phaseId || 'unknown', {
      taskId: task.taskId,
      failureReason: error.message,
      avoidApproach: `Using ${delegation.agent} for this task type`
    });
    
    throw error;
  }
}

/**
 * Extract artifacts from task result
 * @param {Object} taskResult - Task result
 * @returns {Promise<Array>} Artifacts array
 */
async function extractArtifacts(taskResult) {
  const artifacts = [];
  
  if (taskResult.files) {
    for (const file of taskResult.files) {
      artifacts.push({
        path: file,
        description: `Generated file: ${file}`,
        type: 'file'
      });
    }
  }
  
  if (taskResult.testResults) {
    artifacts.push({
      path: taskResult.testResults.path || 'test-results.json',
      description: 'Test execution results',
      type: 'test_result'
    });
  }
  
  return artifacts;
}

/**
 * Check if task dependencies are met
 * @param {Object} task - Task object
 * @param {Array} allTasks - All tasks in phase
 * @param {Array} completedResults - Completed task results
 * @returns {boolean} True if dependencies met
 */
function dependenciesMet(task, allTasks, completedResults) {
  if (!task.dependencies || task.dependencies.length === 0) {
    return true;
  }
  
  return task.dependencies.every(depId => {
    // Check in current phase tasks
    const depTask = allTasks.find(t => t.taskId === depId);
    if (depTask && depTask.status === 'completed') {
      return true;
    }
    
    // Check in completed results (may be from previous phases)
    const depResult = completedResults.find(r => r.taskId === depId);
    return depResult && depResult.status === 'completed';
  });
}

