#!/usr/bin/env node
/**
 * Path Resolver - Single place that maps artifact/plan paths to run directory locations
 * 
 * Allows incremental migration: workflows/tools use resolver, old paths still work temporarily
 * 
 * Usage:
 *   import { resolveArtifactPath, resolvePlanPath, resolveGatePath } from './path-resolver.mjs';
 */

import { join } from 'path';
import { getRunDirectoryStructure } from './run-manager.mjs';

/**
 * Resolve artifact path in run directory
 * @param {string} runId - Run ID
 * @param {string} artifactName - Artifact name (e.g., 'plan-123.json', 'project-brief.json')
 * @returns {string} Full path to artifact in run directory
 */
export function resolveArtifactPath(runId, artifactName) {
  const runDirs = getRunDirectoryStructure(runId);
  return join(runDirs.artifacts_dir, artifactName);
}

/**
 * Resolve plan path in run directory
 * @param {string} runId - Run ID
 * @param {string} planName - Plan name (e.g., 'plan-123.json', 'plan-123.md')
 * @returns {string} Full path to plan in run directory
 */
export function resolvePlanPath(runId, planName) {
  const runDirs = getRunDirectoryStructure(runId);
  return join(runDirs.plans_dir, planName);
}

/**
 * Resolve gate path in run directory
 * @param {string} runId - Run ID
 * @param {number|string} step - Step number or step identifier
 * @returns {string} Full path to gate file in run directory
 */
export function resolveGatePath(runId, step) {
  const runDirs = getRunDirectoryStructure(runId);
  const stepStr = typeof step === 'number' ? `step-${step}` : step;
  return join(runDirs.gates_dir, `${stepStr}.json`);
}

/**
 * Resolve reasoning path in run directory
 * @param {string} runId - Run ID
 * @param {number|string} step - Step number or step identifier
 * @param {string} agent - Agent name (optional)
 * @returns {string} Full path to reasoning file in run directory
 */
export function resolveReasoningPath(runId, step, agent = null) {
  const runDirs = getRunDirectoryStructure(runId);
  const stepStr = typeof step === 'number' ? `step-${step}` : step;
  const filename = agent ? `${stepStr}-${agent}.json` : `${stepStr}.json`;
  return join(runDirs.reasoning_dir, filename);
}

/**
 * Resolve handoff path in run directory
 * @param {string} runId - Run ID
 * @param {string} type - Type of handoff file ('json', 'md', 'ack')
 * @returns {string} Full path to handoff file
 */
export function resolveHandoffPath(runId, type = 'json') {
  const runDirs = getRunDirectoryStructure(runId);
  switch (type) {
    case 'json':
      return runDirs.handoff_json;
    case 'md':
      return runDirs.handoff_md;
    case 'ack':
      return runDirs.handoff_ack_json;
    default:
      throw new Error(`Unknown handoff file type: ${type}`);
  }
}

/**
 * Legacy path compatibility - maps old paths to new run directory paths
 * @param {string} oldPath - Old path (e.g., '.claude/context/artifacts/plan-123.json')
 * @param {string} runId - Run ID
 * @returns {string} New path in run directory, or original if not mappable
 */
export function resolveLegacyPath(oldPath, runId) {
  // Map .claude/context/artifacts/* to runs/<run_id>/artifacts/*
  if (oldPath.includes('.claude/context/artifacts/')) {
    const artifactName = oldPath.split('.claude/context/artifacts/')[1];
    return resolveArtifactPath(runId, artifactName);
  }
  
  // Map .claude/context/plans/* to runs/<run_id>/plans/*
  if (oldPath.includes('.claude/context/plans/')) {
    const planName = oldPath.split('.claude/context/plans/')[1];
    return resolvePlanPath(runId, planName);
  }
  
  // Return original if not mappable
  return oldPath;
}

export default {
  resolveArtifactPath,
  resolvePlanPath,
  resolveGatePath,
  resolveReasoningPath,
  resolveHandoffPath,
  resolveLegacyPath
};

