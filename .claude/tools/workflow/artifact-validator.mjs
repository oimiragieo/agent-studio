import { existsSync, readFileSync } from 'fs';
import { readArtifactRegistry } from '../run-manager.mjs';

/**
 * Validate artifacts required for a step before execution
 * Checks that all required artifacts from previous steps exist and are validated
 *
 * @param {string} runId - Run identifier
 * @param {number} stepNumber - Current step number
 * @param {Array} requiredArtifacts - List of required artifact names
 * @returns {Promise<Object>} Validation result
 */
export async function validateRequiredArtifacts(runId, stepNumber, requiredArtifacts = []) {
  if (!runId || requiredArtifacts.length === 0) {
    return { valid: true, missing: [], failed: [] };
  }

  const missing = [];
  const failed = [];

  try {
    const registry = await readArtifactRegistry(runId);
    const registeredArtifacts = registry.artifacts || {};

    for (const artifactName of requiredArtifacts) {
      const artifact = registeredArtifacts[artifactName];

      if (!artifact) {
        missing.push({
          name: artifactName,
          error: 'Artifact not found in registry',
        });
        continue;
      }

      // Check validation status
      if (artifact.validationStatus === 'fail') {
        failed.push({
          name: artifactName,
          step: artifact.step,
          error: 'Artifact validation failed',
        });
      } else if (artifact.validationStatus === 'pending') {
        // Pending is allowed for now - agent may still be working
        console.warn(`⚠️  Artifact ${artifactName} validation is pending`);
      }
    }

    return {
      valid: missing.length === 0 && failed.length === 0,
      missing,
      failed,
    };
  } catch (error) {
    return {
      valid: false,
      missing: requiredArtifacts.map(name => ({ name, error: 'Registry read failed' })),
      failed: [],
      error: error.message,
    };
  }
}
