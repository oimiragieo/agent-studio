#!/usr/bin/env node
/**
 * Artifact Registry System
 * 
 * **DEPRECATED**: This module is being phased out in favor of run-manager.mjs.
 * 
 * **Migration Guide**:
 * - For new code, use `run-manager.mjs` functions:
 *   - `registerArtifact(runId, artifact)` instead of `registerArtifact(workflowId, ...)`
 *   - `readArtifactRegistry(runId)` instead of `loadRegistry(workflowId)`
 *   - `updateArtifactPublishingStatus(runId, artifactName, status)` for publishing updates
 * 
 * **Why migrate?**
 * - run-manager.mjs provides unified artifact registry at `.claude/context/runtime/runs/<run_id>/artifact-registry.json`
 * - Better integration with workflow execution state
 * - Supports publishing metadata and retry tracking
 * - Atomic writes and better error handling
 * 
 * **Backward Compatibility**:
 * This module maintains backward compatibility with workflowId-based paths:
 * - Old path: `.claude/context/registry/<workflow_id>/artifacts.json`
 * - New path (run-manager): `.claude/context/runtime/runs/<run_id>/artifact-registry.json`
 * 
 * When workflowId === runId, both paths refer to the same execution.
 * 
 * **Legacy Functionality** (maintained for backward compatibility):
 * - Track artifact name, step number, agent, creation timestamp
 * - Map artifact dependencies (which artifacts this artifact depends on)
 * - Version artifacts if updated (track version history)
 * - Store artifact metadata (size, type, validation status)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { resolveRuntimePath } from './context-path-resolver.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Get artifact registry path
 * @param {string} workflowId - Workflow ID (same as runId in run-manager)
 * @returns {string} Path to registry file
 * 
 * **Canonical Path**: `.claude/context/runtime/runs/<run_id>/artifact-registry.json` (via run-manager)
 * **Legacy Path**: `.claude/context/registry/<workflow_id>/artifacts.json` (this module)
 * 
 * When workflowId === runId, prefer using run-manager's path for consistency.
 */
function getRegistryPath(workflowId) {
  // Check if run-manager path exists (canonical)
  const runManagerPath = resolve(process.cwd(), `.claude/context/runtime/runs/${workflowId}/artifact-registry.json`);
  if (existsSync(runManagerPath)) {
    // Prefer run-manager path if it exists
    return runManagerPath;
  }
  
  // Fall back to legacy path for backward compatibility
  const registryDir = resolve(process.cwd(), `.claude/context/registry/${workflowId}`);
  if (!existsSync(registryDir)) {
    mkdirSync(registryDir, { recursive: true });
  }
  return resolve(registryDir, 'artifacts.json');
}

/**
 * Load artifact registry
 * @param {string} workflowId - Workflow ID
 * @returns {Object} Registry data
 */
export function loadRegistry(workflowId) {
  const registryPath = getRegistryPath(workflowId);
  
  if (!existsSync(registryPath)) {
    return {
      workflow_id: workflowId,
      artifacts: [],
      dependencies: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }
  
  try {
    return JSON.parse(readFileSync(registryPath, 'utf-8'));
  } catch (error) {
    console.warn(`Warning: Could not load artifact registry: ${error.message}`);
    return {
      workflow_id: workflowId,
      artifacts: [],
      dependencies: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }
}

/**
 * Save artifact registry
 * @param {string} workflowId - Workflow ID
 * @param {Object} registry - Registry data
 */
export function saveRegistry(workflowId, registry) {
  const registryPath = getRegistryPath(workflowId);
  registry.updated_at = new Date().toISOString();
  writeFileSync(registryPath, JSON.stringify(registry, null, 2), 'utf-8');
}

/**
 * Register a new artifact
 * @param {string} workflowId - Workflow ID (same as runId in run-manager)
 * @param {string} artifactName - Name of the artifact
 * @param {string} stepNumber - Step number that created it
 * @param {string} agentName - Agent that created it
 * @param {Array<string>} dependencies - Artifact names this depends on
 * @param {Object} metadata - Additional metadata
 * 
 * **NOTE**: For new code, prefer using run-manager.mjs `registerArtifact(runId, artifact)`.
 * This function maintains backward compatibility.
 */
export function registerArtifact(workflowId, artifactName, stepNumber, agentName, dependencies = [], metadata = {}) {
  const registry = loadRegistry(workflowId);
  
  // Check if artifact already exists
  const existingIndex = registry.artifacts.findIndex(a => a.name === artifactName);
  
  const artifactData = {
    name: artifactName,
    step: stepNumber,
    agent: agentName,
    dependencies,
    created_at: new Date().toISOString(),
    version: existingIndex >= 0 ? registry.artifacts[existingIndex].version + 1 : 1,
    metadata: {
      ...metadata,
      size: metadata.size || 0,
      type: metadata.type || 'json',
      validation_status: metadata.validation_status || 'pending',
      // Publishing metadata
      publishable: metadata.publishable !== undefined ? metadata.publishable : false,
      published: metadata.published !== undefined ? metadata.published : false,
      published_at: metadata.published_at || null,
      publish_targets: metadata.publish_targets || [],
      publish_attempts: metadata.publish_attempts || [],
      publish_status: metadata.publish_status || 'pending', // 'pending' | 'success' | 'failed'
      publish_error: metadata.publish_error || null
    }
  };
  
  if (existingIndex >= 0) {
    // Update existing artifact
    registry.artifacts[existingIndex] = artifactData;
  } else {
    // Add new artifact
    registry.artifacts.push(artifactData);
  }
  
  // Update dependency map
  if (!registry.dependencies[artifactName]) {
    registry.dependencies[artifactName] = [];
  }
  registry.dependencies[artifactName] = dependencies;
  
  saveRegistry(workflowId, registry);
  
  return artifactData;
}

/**
 * Enrich artifact metadata with registry data and gate file information
 * @param {string} workflowId - Workflow ID
 * @param {string} artifactName - Name of the artifact
 * @returns {Object} Enriched metadata including validation status, dependencies, workflow info
 */
export function enrichArtifactMetadata(workflowId, artifactName) {
  const registry = loadRegistry(workflowId);
  const artifact = registry.artifacts.find(a => a.name === artifactName);
  
  if (!artifact) {
    return null;
  }
  
  // Try to load gate file for validation status
  let validationStatus = artifact.metadata?.validation_status || 'pending';
  let gateData = null;
  
  try {
    // Using ESM imports (readFileSync, existsSync, resolve imported at top of file)
    
    // Try to find gate file (multiple possible locations)
    const possibleGatePaths = [
      resolve(process.cwd(), `.claude/context/history/gates/${workflowId}/${artifact.step}-${artifact.agent}.json`),
      resolve(process.cwd(), `.claude/context/runtime/runs/${workflowId}/gates/step-${artifact.step}.json`),
      resolve(process.cwd(), `.claude/context/registry/${workflowId}/gates/${artifact.step}.json`)
    ];
    
    for (const gatePath of possibleGatePaths) {
      if (existsSync(gatePath)) {
        try {
          gateData = JSON.parse(readFileSync(gatePath, 'utf-8'));
          validationStatus = gateData.valid ? 'pass' : 'fail';
          break;
        } catch (error) {
          // Continue to next path
        }
      }
    }
  } catch (error) {
    // Gate file loading failed - use registry metadata
  }
  
  return {
    ...artifact.metadata,
    validation_status: validationStatus,
    dependencies: artifact.dependencies || [],
    workflow_id: workflowId,
    step_number: artifact.step,
    agent: artifact.agent,
    created_at: artifact.created_at,
    version: artifact.version,
    gate_validation: gateData ? {
      valid: gateData.valid,
      errors: gateData.errors || [],
      warnings: gateData.warnings || []
    } : null
  };
}

/**
 * Get artifact information
 * @param {string} workflowId - Workflow ID
 * @param {string} artifactName - Name of the artifact
 * @returns {Object|null} Artifact data or null if not found
 */
export async function getArtifact(workflowId, artifactName) {
  const registry = loadRegistry(workflowId);
  // Use shared helper to handle both map and array formats
  const { getArtifactsArray } = await import('./run-manager.mjs');
  const artifactsArray = getArtifactsArray(registry);
  return artifactsArray.find(a => a.name === artifactName) || null;
}

/**
 * Check if artifact exists
 * @param {string} workflowId - Workflow ID
 * @param {string} artifactName - Name of the artifact
 * @returns {boolean} True if artifact exists
 */
export async function artifactExists(workflowId, artifactName) {
  const artifact = await getArtifact(workflowId, artifactName);
  return artifact !== null;
}

/**
 * Get all artifacts for a step
 * @param {string} workflowId - Workflow ID
 * @param {string} stepNumber - Step number
 * @returns {Array} Array of artifact data
 */
export function getArtifactsForStep(workflowId, stepNumber) {
  const registry = loadRegistry(workflowId);
  return registry.artifacts.filter(a => a.step === stepNumber);
}

/**
 * Get artifact dependencies
 * @param {string} workflowId - Workflow ID
 * @param {string} artifactName - Name of the artifact
 * @returns {Array} Array of dependency artifact names
 */
export function getArtifactDependencies(workflowId, artifactName) {
  const registry = loadRegistry(workflowId);
  return registry.dependencies[artifactName] || [];
}

/**
 * Cleanup old artifacts (older than specified days)
 * @param {string} workflowId - Workflow ID
 * @param {number} daysOld - Number of days old to consider for cleanup
 */
export function cleanupOldArtifacts(workflowId, daysOld = 30) {
  const registry = loadRegistry(workflowId);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  const initialCount = registry.artifacts.length;
  registry.artifacts = registry.artifacts.filter(artifact => {
    const artifactDate = new Date(artifact.created_at);
    return artifactDate >= cutoffDate;
  });
  
  const removedCount = initialCount - registry.artifacts.length;
  if (removedCount > 0) {
    saveRegistry(workflowId, registry);
    return removedCount;
  }
  
  return 0;
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    const args = process.argv.slice(2);
    const command = args[0];
    
    if (command === 'register') {
    const workflowId = args[1];
    const artifactName = args[2];
    const stepNumber = args[3];
    const agentName = args[4];
    const dependencies = args[5] ? args[5].split(',') : [];
    
    if (!workflowId || !artifactName || !stepNumber || !agentName) {
      console.error('Usage: node artifact-registry.mjs register <workflow-id> <artifact-name> <step> <agent> [dependencies]');
      process.exit(1);
    }
    
    const artifact = registerArtifact(workflowId, artifactName, stepNumber, agentName, dependencies);
    console.log(`✅ Registered artifact: ${artifactName} (version ${artifact.version})`);
  } else if (command === 'get') {
    const workflowId = args[1];
    const artifactName = args[2];
    
    if (!workflowId || !artifactName) {
      console.error('Usage: node artifact-registry.mjs get <workflow-id> <artifact-name>');
      process.exit(1);
    }
    
      const artifact = await getArtifact(workflowId, artifactName);
    if (artifact) {
      console.log(JSON.stringify(artifact, null, 2));
    } else {
      console.error(`❌ Artifact not found: ${artifactName}`);
      process.exit(1);
    }
  } else if (command === 'list') {
    const workflowId = args[1];
    
    if (!workflowId) {
      console.error('Usage: node artifact-registry.mjs list <workflow-id>');
      process.exit(1);
    }
    
      const registry = loadRegistry(workflowId);
      console.log(`Artifacts for workflow ${workflowId}:`);
      // Use shared helper to handle both map and array formats
      const { getArtifactsArray } = await import('./run-manager.mjs');
      const artifactsArray = getArtifactsArray(registry);
      artifactsArray.forEach(artifact => {
        console.log(`  - ${artifact.name} (step ${artifact.step}, agent: ${artifact.agent}, version: ${artifact.version || 1})`);
      });
  } else if (command === 'cleanup') {
    const workflowId = args[1];
    const daysOld = parseInt(args[2]) || 30;
    
    if (!workflowId) {
      console.error('Usage: node artifact-registry.mjs cleanup <workflow-id> [days-old]');
      process.exit(1);
    }
    
    const removed = cleanupOldArtifacts(workflowId, daysOld);
    console.log(`✅ Cleaned up ${removed} old artifact(s)`);
  } else {
    console.error('Usage:');
    console.error('  node artifact-registry.mjs register <workflow-id> <artifact-name> <step> <agent> [dependencies]');
    console.error('  node artifact-registry.mjs get <workflow-id> <artifact-name>');
    console.error('  node artifact-registry.mjs list <workflow-id>');
    console.error('  node artifact-registry.mjs cleanup <workflow-id> [days-old]');
    process.exit(1);
  }
}

