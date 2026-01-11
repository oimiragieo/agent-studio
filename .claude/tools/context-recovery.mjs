/**
 * Context Recovery Tool
 * Manages context recovery via plan documents
 * Enables orchestrator handoff when context exhausted
 */

import { getMasterPlan, getPhasePlan, updatePhasePlanStatus } from './plan-manager.mjs';

/**
 * Prepare recovery metadata in plan
 * @param {string} planId - Master plan ID
 * @param {string} orchestratorSessionId - Current orchestrator session ID
 * @returns {Promise<void>}
 */
export async function prepareRecovery(planId, orchestratorSessionId) {
  const masterPlan = await getMasterPlan(planId);

  // Find current phase
  const currentPhase = masterPlan.phases.find(
    p => p.status === 'in_progress' || p.status === 'pending'
  );

  if (currentPhase) {
    const phasePlan = await getPhasePlan(`${planId}-${currentPhase.phaseId}`);

    // Find last completed task
    const completedTasks = phasePlan.tasks.filter(t => t.status === 'completed');
    const lastTask = completedTasks[completedTasks.length - 1];

    // Find next pending task
    const nextTask = phasePlan.tasks.find(t => t.status === 'pending');

    // Update recovery metadata
    phasePlan.recoveryMetadata = {
      canResume: true,
      resumePoint: nextTask?.taskId || null,
      contextSummary: `Phase ${currentPhase.phaseName}: ${completedTasks.length}/${phasePlan.tasks.length} tasks completed`,
      completedWork: completedTasks.map(t => t.taskId).join(', '),
      pendingWork: phasePlan.tasks
        .filter(t => t.status === 'pending' || t.status === 'in_progress')
        .map(t => t.taskId)
        .join(', '),
      scratchpad: phasePlan.recoveryMetadata?.scratchpad || [],
    };

    await updatePhasePlanStatus(`${planId}-${currentPhase.phaseId}`, {
      recoveryMetadata: phasePlan.recoveryMetadata,
    });
  }
}

/**
 * Resume execution from plan
 * @param {string} planId - Master plan ID
 * @returns {Promise<Object>} Recovery instructions
 */
export async function resumeFromPlan(planId) {
  const masterPlan = await getMasterPlan(planId);

  // Find current phase
  const currentPhase = masterPlan.phases.find(
    p => p.status === 'in_progress' || (p.status === 'pending' && masterPlan.phases.indexOf(p) > 0)
  );

  if (!currentPhase) {
    throw new Error(`No active phase found in plan ${planId}`);
  }

  const phasePlan = await getPhasePlan(`${planId}-${currentPhase.phaseId}`);

  const recoveryMetadata = phasePlan.recoveryMetadata || {};

  return {
    planId,
    phaseId: currentPhase.phaseId,
    resumePoint: recoveryMetadata.resumePoint,
    contextSummary: recoveryMetadata.contextSummary,
    completedWork: recoveryMetadata.completedWork,
    pendingWork: recoveryMetadata.pendingWork,
    scratchpad: recoveryMetadata.scratchpad || [],
    phasePlan,
  };
}
