/**
 * Plan Manager Tool
 * Handles hierarchical plan document creation, updates, and status tracking
 * Supports master plan (overview) + phase plans (detailed)
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';

const PLANS_DIR = '.claude/context/plans';
const MAX_MASTER_PLAN_SIZE = 5000; // 5KB
const MAX_PHASE_PLAN_SIZE = 20000; // 20KB

// Ensure plans directory exists
async function ensurePlansDir() {
  if (!existsSync(PLANS_DIR)) {
    await mkdir(PLANS_DIR, { recursive: true });
  }
}

/**
 * Create master plan (lightweight overview)
 * @param {Object} planData - Master plan data
 * @returns {Promise<string>} Path to master plan file
 */
export async function createMasterPlan(planData) {
  await ensurePlansDir();

  const planId = planData.planId || `plan-${Date.now()}`;
  const masterPlanPath = join(PLANS_DIR, `${planId}.md`);

  const masterPlan = {
    metadata: {
      planId,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      orchestratorSessionId: planData.orchestratorSessionId || null,
      planName: planData.planName || 'Untitled Plan',
      planVersion: planData.planVersion || 1,
    },
    phases: planData.phases || [],
    overallStatus: {
      status: 'planning',
      currentPhase: null,
      totalPhases: planData.phases?.length || 0,
      completedPhases: 0,
    },
  };

  // Create markdown overview (lightweight)
  const markdown = `# ${masterPlan.metadata.planName}

**Plan ID**: ${planId}
**Created**: ${masterPlan.metadata.createdAt}
**Status**: ${masterPlan.overallStatus.status}

## Phases

${masterPlan.phases
  .map(
    (phase, idx) => `### Phase ${idx + 1}: ${phase.phaseName}
- **Status**: ${phase.status}
- **Plan**: ${phase.phasePlanPath}
- **Tasks**: ${phase.completedTasks || 0}/${phase.estimatedTasks || 0} completed
`
  )
  .join('\n')}

## Overall Progress

- **Total Phases**: ${masterPlan.overallStatus.totalPhases}
- **Completed**: ${masterPlan.overallStatus.completedPhases}
- **Current Phase**: ${masterPlan.overallStatus.currentPhase || 'None'}
`;

  await writeFile(masterPlanPath, markdown, 'utf-8');

  // Also save JSON for programmatic access
  const jsonPath = join(PLANS_DIR, `${planId}.json`);
  await writeFile(jsonPath, JSON.stringify(masterPlan, null, 2), 'utf-8');

  return masterPlanPath;
}

/**
 * Create detailed phase plan
 * @param {Object} phaseData - Phase plan data
 * @param {string} masterPlanId - Master plan ID
 * @returns {Promise<string>} Path to phase plan file
 */
export async function createPhasePlan(phaseData, masterPlanId) {
  await ensurePlansDir();

  const phaseId = phaseData.phaseId || `phase-${Date.now()}`;
  const phasePlanPath = join(PLANS_DIR, `${masterPlanId}-${phaseId}.json`);

  const phasePlan = {
    metadata: {
      phaseId,
      phaseName: phaseData.phaseName || 'Untitled Phase',
      masterPlanId,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    },
    tasks: phaseData.tasks || [],
    agentAssignments: phaseData.agentAssignments || {},
    testResults: phaseData.testResults || [],
    statusTracking: {
      overallStatus: 'planning',
      completedTasks: 0,
      inProgressTasks: 0,
      pendingTasks: phaseData.tasks?.length || 0,
      failedTasks: 0,
      lastTaskCompleted: null,
      nextTask: phaseData.tasks?.[0]?.taskId || null,
    },
    recoveryMetadata: {
      canResume: false,
      resumePoint: null,
      contextSummary: '',
      completedWork: '',
      pendingWork: '',
      scratchpad: [],
    },
    councilDecisions: [],
  };

  // Validate size
  const jsonString = JSON.stringify(phasePlan, null, 2);
  if (jsonString.length > MAX_PHASE_PLAN_SIZE) {
    throw new Error(
      `Phase plan exceeds size limit: ${jsonString.length} bytes (max: ${MAX_PHASE_PLAN_SIZE})`
    );
  }

  await writeFile(phasePlanPath, jsonString, 'utf-8');
  return phasePlanPath;
}

/**
 * Get master plan
 * @param {string} planId - Plan ID
 * @returns {Promise<Object>} Master plan data
 */
export async function getMasterPlan(planId) {
  const jsonPath = join(PLANS_DIR, `${planId}.json`);
  const content = await readFile(jsonPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Get phase plan
 * @param {string} phaseId - Phase ID (format: masterPlanId-phaseId)
 * @returns {Promise<Object>} Phase plan data
 */
export async function getPhasePlan(phaseId) {
  const phasePlanPath = join(PLANS_DIR, `${phaseId}.json`);
  const content = await readFile(phasePlanPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Get phase plan size in bytes
 * @param {string} phaseId - Phase ID
 * @returns {Promise<number>} Size in bytes
 */
export async function getPhasePlanSize(phaseId) {
  const phasePlanPath = join(PLANS_DIR, `${phaseId}.json`);
  const content = await readFile(phasePlanPath, 'utf-8');
  return Buffer.byteLength(content, 'utf-8');
}

/**
 * Optimize phase plan size by archiving completed tasks
 * @param {string} phaseId - Phase ID
 * @returns {Promise<void>}
 */
export async function optimizePhasePlanSize(phaseId) {
  const phasePlan = await getPhasePlan(phaseId);

  // Archive completed tasks (keep only essential metadata)
  const archivedTasks = phasePlan.tasks
    .filter(t => t.status === 'completed')
    .map(t => ({
      taskId: t.taskId,
      description: t.description,
      status: t.status,
      completedAt: t.completedAt,
      artifacts: t.artifacts, // Keep artifacts for downstream tasks
    }));

  // Keep only pending/in-progress/failed tasks with full detail
  const activeTasks = phasePlan.tasks.filter(t => t.status !== 'completed');

  phasePlan.tasks = [...activeTasks, ...archivedTasks];
  phasePlan.metadata.lastUpdated = new Date().toISOString();

  // Save optimized plan
  const phasePlanPath = join(PLANS_DIR, `${phaseId}.json`);
  await writeFile(phasePlanPath, JSON.stringify(phasePlan, null, 2), 'utf-8');
}

/**
 * Update master plan status
 * @param {string} planId - Plan ID
 * @param {Object} updates - Status updates
 * @returns {Promise<void>}
 */
export async function updateMasterPlanStatus(planId, updates) {
  const masterPlan = await getMasterPlan(planId);

  if (updates.phaseStatus) {
    const phase = masterPlan.phases.find(p => p.phaseId === updates.phaseStatus.phaseId);
    if (phase) {
      phase.status = updates.phaseStatus.status;
      phase.completedAt =
        updates.phaseStatus.status === 'completed' ? new Date().toISOString() : phase.completedAt;
    }
  }

  if (updates.overallStatus) {
    Object.assign(masterPlan.overallStatus, updates.overallStatus);
  }

  masterPlan.metadata.lastUpdated = new Date().toISOString();

  const jsonPath = join(PLANS_DIR, `${planId}.json`);
  await writeFile(jsonPath, JSON.stringify(masterPlan, null, 2), 'utf-8');
}

/**
 * Update phase plan status
 * @param {string} phaseId - Phase ID
 * @param {Object} updates - Status updates
 * @returns {Promise<void>}
 */
export async function updatePhasePlanStatus(phaseId, updates) {
  const phasePlan = await getPhasePlan(phaseId);

  if (updates.taskStatus) {
    const task = phasePlan.tasks.find(t => t.taskId === updates.taskStatus.taskId);
    if (task) {
      task.status = updates.taskStatus.status;
      task.startedAt =
        updates.taskStatus.status === 'in_progress' && !task.startedAt
          ? new Date().toISOString()
          : task.startedAt;
      task.completedAt =
        updates.taskStatus.status === 'completed' ? new Date().toISOString() : task.completedAt;
      if (updates.taskStatus.result) {
        task.result = updates.taskStatus.result;
      }
    }
  }

  // Update status tracking
  phasePlan.statusTracking = {
    completedTasks: phasePlan.tasks.filter(t => t.status === 'completed').length,
    inProgressTasks: phasePlan.tasks.filter(t => t.status === 'in_progress').length,
    pendingTasks: phasePlan.tasks.filter(t => t.status === 'pending').length,
    failedTasks: phasePlan.tasks.filter(t => t.status === 'failed').length,
    lastTaskCompleted:
      phasePlan.tasks
        .filter(t => t.status === 'completed')
        .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0]?.taskId || null,
    nextTask: phasePlan.tasks.find(t => t.status === 'pending')?.taskId || null,
    overallStatus: phasePlan.tasks.every(t => t.status === 'completed' || t.status === 'failed')
      ? 'completed'
      : phasePlan.tasks.some(t => t.status === 'in_progress')
        ? 'in_progress'
        : 'planning',
  };

  phasePlan.metadata.lastUpdated = new Date().toISOString();

  const phasePlanPath = join(PLANS_DIR, `${phaseId}.json`);
  await writeFile(phasePlanPath, JSON.stringify(phasePlan, null, 2), 'utf-8');
}

/**
 * Add artifact to task
 * @param {string} phaseId - Phase ID
 * @param {string} taskId - Task ID
 * @param {Object} artifact - Artifact data
 * @returns {Promise<void>}
 */
export async function addArtifactToTask(phaseId, taskId, artifact) {
  const phasePlan = await getPhasePlan(phaseId);
  const task = phasePlan.tasks.find(t => t.taskId === taskId);

  if (task) {
    if (!task.artifacts) {
      task.artifacts = [];
    }
    task.artifacts.push(artifact);
    phasePlan.metadata.lastUpdated = new Date().toISOString();

    const phasePlanPath = join(PLANS_DIR, `${phaseId}.json`);
    await writeFile(phasePlanPath, JSON.stringify(phasePlan, null, 2), 'utf-8');
  }
}

/**
 * Add scratchpad entry
 * @param {string} phaseId - Phase ID
 * @param {Object} entry - Scratchpad entry
 * @returns {Promise<void>}
 */
export async function addScratchpadEntry(phaseId, entry) {
  const phasePlan = await getPhasePlan(phaseId);

  if (!phasePlan.recoveryMetadata.scratchpad) {
    phasePlan.recoveryMetadata.scratchpad = [];
  }

  phasePlan.recoveryMetadata.scratchpad.push({
    taskId: entry.taskId,
    attempts: entry.attempts || 1,
    failureReason: entry.failureReason,
    timestamp: new Date().toISOString(),
    avoidApproach: entry.avoidApproach,
  });

  phasePlan.metadata.lastUpdated = new Date().toISOString();

  const phasePlanPath = join(PLANS_DIR, `${phaseId}.json`);
  await writeFile(phasePlanPath, JSON.stringify(phasePlan, null, 2), 'utf-8');
}

/**
 * Get next task from phase plan
 * @param {string} phaseId - Phase ID
 * @returns {Promise<Object|null>} Next task or null
 */
export async function getNextTask(phaseId) {
  const phasePlan = await getPhasePlan(phaseId);
  return phasePlan.tasks.find(t => t.status === 'pending') || null;
}

/**
 * Mark task as complete
 * @param {string} phaseId - Phase ID
 * @param {string} taskId - Task ID
 * @param {Object} result - Task result
 * @returns {Promise<void>}
 */
export async function markTaskComplete(phaseId, taskId, result) {
  await updatePhasePlanStatus(phaseId, {
    taskStatus: {
      taskId,
      status: 'completed',
      result,
    },
  });
}
