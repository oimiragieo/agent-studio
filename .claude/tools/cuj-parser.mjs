#!/usr/bin/env node
/**
 * Unified CUJ Parser Module
 *
 * Centralized parsing logic for Customer User Journeys (CUJs).
 * Replaces duplicate parsing logic across run-cuj.mjs, validate-cuj-e2e.mjs, and validate-cujs.mjs.
 *
 * @module cuj-parser
 * @version 1.0.0
 *
 * Features:
 * - Single source of truth for CUJ parsing
 * - Streaming JSON support for large files
 * - Markdown table parsing for CUJ-INDEX.md
 * - Windows path compatibility
 * - Comprehensive error handling
 *
 * Usage:
 *   import { loadRegistry, getCUJById, getCUJsByMode } from '.claude/tools/cuj-parser.mjs';
 *
 *   const registry = await loadRegistry();
 *   const cuj = await getCUJById('CUJ-005');
 *   const skillCUJs = await getCUJsByMode('skill-only');
 */

import fs from 'fs/promises';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseLargeJSON, shouldUseStreaming } from './streaming-json-parser.mjs';
import { resolveConfigPath } from './context-path-resolver.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

// File paths (use forward slashes for cross-platform compatibility)
const REGISTRY_JSON_PATH = resolveConfigPath('cuj-registry.json', { read: true });
const INDEX_MD_PATH = path.join(ROOT, '.claude/docs/cujs/CUJ-INDEX.md');
const CUJ_DOCS_DIR = path.join(ROOT, '.claude/docs/cujs');

// Validation state tracking
let lastFileReadTimestamp = null;
let lastFileModificationTime = null;

/**
 * Log file read operation for stateless behavior validation
 * @private
 * @param {string} filePath - Path to file being read
 * @param {Object} stats - File stats object
 */
function logFileRead(filePath, stats) {
  const readTimestamp = new Date().toISOString();
  lastFileReadTimestamp = readTimestamp;
  lastFileModificationTime = stats?.mtime?.toISOString() || null;

  if (process.env.DEBUG_CUJ_PARSER) {
    console.log(`[CUJ Parser] File read: ${filePath}`);
    console.log(`[CUJ Parser]   Read at: ${readTimestamp}`);
    console.log(`[CUJ Parser]   Modified: ${lastFileModificationTime}`);
  }
}

/**
 * Load CUJ registry from cuj-registry.json
 *
 * Supports streaming JSON parser for large files (>1MB).
 * Uses forward slashes for Windows compatibility.
 *
 * @async
 * @returns {Promise<Object>} CUJ registry object with `cujs` array
 * @throws {Error} If registry file not found or invalid JSON
 *
 * @example
 * const registry = await loadRegistry();
 * console.log(`Loaded ${registry.cujs.length} CUJs`);
 */
export async function loadRegistry() {
  try {
    // Check if file exists
    if (!existsSync(REGISTRY_JSON_PATH)) {
      throw new Error(`CUJ registry not found at: ${REGISTRY_JSON_PATH}`);
    }

    // Get file stats for logging
    const stats = await fs.stat(REGISTRY_JSON_PATH);
    logFileRead(REGISTRY_JSON_PATH, stats);

    // Use streaming parser for large files
    if (shouldUseStreaming(REGISTRY_JSON_PATH, 1)) {
      return await parseLargeJSON(REGISTRY_JSON_PATH);
    } else {
      const content = readFileSync(REGISTRY_JSON_PATH, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    throw new Error(`Failed to load CUJ registry: ${error.message}`);
  }
}

/**
 * Parse CUJ-INDEX.md mapping table
 *
 * Extracts CUJ metadata from the "Run CUJ Mapping" markdown table.
 * Normalizes execution modes to schema-compliant values.
 *
 * @async
 * @returns {Promise<Map<string, Object>>} Map of CUJ ID -> { executionMode, workflowPath, primarySkill }
 * @throws {Error} If CUJ-INDEX.md not found or parsing fails
 *
 * @example
 * const mapping = await loadCUJMapping();
 * const cuj005 = mapping.get('CUJ-005');
 * console.log(cuj005.executionMode); // 'workflow'
 */
export async function loadCUJMapping() {
  try {
    // Check if file exists
    if (!existsSync(INDEX_MD_PATH)) {
      throw new Error(`CUJ-INDEX.md not found at: ${INDEX_MD_PATH}`);
    }

    // Get file stats for logging
    const stats = await fs.stat(INDEX_MD_PATH);
    logFileRead(INDEX_MD_PATH, stats);

    const content = await fs.readFile(INDEX_MD_PATH, 'utf-8');
    const mapping = new Map();

    // Find the "Run CUJ Mapping" table (has "Execution Mode" column)
    const normalizedContent = content.replace(/\r\n/g, '\n');
    const lines = normalizedContent.split('\n');
    let inMappingTable = false;
    let headerPassed = false;

    for (const line of lines) {
      // Detect table header with "Execution Mode" column
      if (line.includes('| CUJ ID') && line.includes('Execution Mode')) {
        inMappingTable = true;
        continue;
      }

      // Skip separator line (matches "| --- | ---" or "|---|---")
      if (inMappingTable && !headerPassed && /\|\s*-+\s*\|/.test(line)) {
        headerPassed = true;
        continue;
      }

      // Parse table rows
      if (inMappingTable && headerPassed && line.startsWith('|')) {
        const cols = line
          .split('|')
          .map(c => c.trim())
          .filter(c => c);
        if (cols.length >= 4) {
          const cujId = cols[0]; // e.g., "CUJ-001"
          const executionMode = cols[1]; // e.g., "skill-only" or "greenfield-fullstack.yaml"
          const workflowPath = cols[2] === 'null' ? null : cols[2].replace(/`/g, '').trim();
          const primarySkill = cols[3] === 'null' ? null : cols[3].trim();

          if (cujId.startsWith('CUJ-')) {
            mapping.set(cujId, {
              executionMode: normalizeExecutionMode(executionMode),
              workflowPath,
              primarySkill,
            });
          }
        }
      }

      // Stop when we hit another section
      if (inMappingTable && headerPassed && line.startsWith('##')) {
        break;
      }
    }

    return mapping;
  } catch (error) {
    throw new Error(`Failed to parse CUJ-INDEX.md: ${error.message}`);
  }
}

/**
 * Normalize execution mode to schema-compliant values
 *
 * Handles various execution mode formats:
 * - 'workflow', 'automated-workflow' → 'workflow'
 * - 'delegated-skill', 'skill-only', 'skill' → 'skill-only'
 * - 'manual-setup', 'manual' → 'manual-setup'
 * - '*.yaml' → 'workflow'
 *
 * @param {string} mode - Raw execution mode string
 * @returns {string|null} Normalized execution mode or null if invalid
 *
 * @example
 * normalizeExecutionMode('greenfield-fullstack.yaml'); // 'workflow'
 * normalizeExecutionMode('skill'); // 'skill-only'
 */
export function normalizeExecutionMode(mode) {
  if (!mode) return null;

  const modeMap = {
    workflow: 'workflow',
    'automated-workflow': 'workflow',
    'delegated-skill': 'skill-only',
    'skill-only': 'skill-only',
    skill: 'skill-only',
    'manual-setup': 'manual-setup',
    manual: 'manual-setup',
  };

  // Handle raw .yaml references as 'workflow'
  if (mode.endsWith('.yaml')) {
    return 'workflow';
  }

  return modeMap[mode] || mode;
}

/**
 * Get a single CUJ by ID
 *
 * Searches both cuj-registry.json and CUJ-INDEX.md mapping.
 * Returns combined metadata from both sources.
 *
 * @async
 * @param {string} cujId - CUJ identifier (e.g., 'CUJ-005')
 * @returns {Promise<Object|null>} CUJ object or null if not found
 * @throws {Error} If registry loading fails
 *
 * @example
 * const cuj = await getCUJById('CUJ-005');
 * if (cuj) {
 *   console.log(`Found: ${cuj.name}`);
 *   console.log(`Mode: ${cuj.execution_mode}`);
 * }
 */
export async function getCUJById(cujId) {
  try {
    // Load both sources
    const registry = await loadRegistry();
    const mapping = await loadCUJMapping();

    // Find in registry
    const registryCUJ = registry.cujs?.find(c => c.id === cujId);

    // Find in mapping
    const mappingCUJ = mapping.get(cujId);

    // Combine metadata (registry is primary source)
    if (registryCUJ) {
      return {
        ...registryCUJ,
        // Add mapping metadata if available
        ...(mappingCUJ && {
          execution_mode_mapping: mappingCUJ.executionMode,
          workflow_path_mapping: mappingCUJ.workflowPath,
          primary_skill_mapping: mappingCUJ.primarySkill,
        }),
      };
    }

    // Fallback to mapping-only if registry entry missing
    if (mappingCUJ) {
      return {
        id: cujId,
        execution_mode: mappingCUJ.executionMode,
        workflow: mappingCUJ.workflowPath,
        primary_skill: mappingCUJ.primarySkill,
        source: 'mapping-only',
      };
    }

    return null;
  } catch (error) {
    throw new Error(`Failed to get CUJ ${cujId}: ${error.message}`);
  }
}

/**
 * Get all CUJs by execution mode
 *
 * Filters CUJs by execution mode (workflow, skill-only, manual-setup).
 * Returns array of CUJ objects matching the mode.
 *
 * @async
 * @param {string} mode - Execution mode to filter by
 * @returns {Promise<Array<Object>>} Array of CUJ objects
 * @throws {Error} If registry loading fails
 *
 * @example
 * const skillCUJs = await getCUJsByMode('skill-only');
 * console.log(`Found ${skillCUJs.length} skill-only CUJs`);
 */
export async function getCUJsByMode(mode) {
  try {
    const registry = await loadRegistry();
    const normalizedMode = normalizeExecutionMode(mode);

    return (
      registry.cujs?.filter(cuj => {
        const cujMode = normalizeExecutionMode(cuj.execution_mode);
        return cujMode === normalizedMode;
      }) || []
    );
  } catch (error) {
    throw new Error(`Failed to get CUJs by mode ${mode}: ${error.message}`);
  }
}

/**
 * Get all CUJ IDs from both registry and mapping
 *
 * Returns deduplicated list of all known CUJ IDs.
 *
 * @async
 * @returns {Promise<Array<string>>} Array of CUJ IDs (e.g., ['CUJ-001', 'CUJ-002'])
 * @throws {Error} If loading fails
 *
 * @example
 * const allIds = await getAllCUJIds();
 * console.log(`Total CUJs: ${allIds.length}`);
 */
export async function getAllCUJIds() {
  try {
    const registry = await loadRegistry();
    const mapping = await loadCUJMapping();

    const registryIds = registry.cujs?.map(c => c.id) || [];
    const mappingIds = Array.from(mapping.keys());

    // Deduplicate and sort
    return [...new Set([...registryIds, ...mappingIds])].sort();
  } catch (error) {
    throw new Error(`Failed to get all CUJ IDs: ${error.message}`);
  }
}

/**
 * Validate CUJ structure against schema requirements
 *
 * Checks for required fields, valid execution modes, and consistency.
 *
 * @param {Object} cuj - CUJ object to validate
 * @returns {Object} Validation result: { valid: boolean, errors: string[], warnings: string[] }
 *
 * @example
 * const result = validateCUJStructure(cuj);
 * if (!result.valid) {
 *   console.error('Validation errors:', result.errors);
 * }
 */
export function validateCUJStructure(cuj) {
  const errors = [];
  const warnings = [];

  // Required fields
  if (!cuj.id) errors.push('Missing required field: id');
  if (!cuj.name) errors.push('Missing required field: name');
  if (!cuj.execution_mode) errors.push('Missing required field: execution_mode');

  // Validate execution mode
  const validModes = ['workflow', 'skill-only', 'manual-setup'];
  const normalizedMode = normalizeExecutionMode(cuj.execution_mode);
  if (!validModes.includes(normalizedMode)) {
    errors.push(`Invalid execution mode: ${cuj.execution_mode} (normalized: ${normalizedMode})`);
  }

  // Execution mode consistency checks
  if (normalizedMode === 'workflow' && !cuj.workflow) {
    warnings.push('Workflow execution mode but no workflow specified');
  }
  if (normalizedMode === 'skill-only' && !cuj.primary_skill) {
    warnings.push('Skill-only execution mode but no primary_skill specified');
  }

  // CUJ ID format validation
  if (cuj.id && !/^CUJ-\d{3}$/.test(cuj.id)) {
    warnings.push(`CUJ ID format should be CUJ-XXX (3 digits): ${cuj.id}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Check if CUJ documentation file exists
 *
 * @param {string} cujId - CUJ identifier (e.g., 'CUJ-005')
 * @returns {Promise<boolean>} True if documentation file exists
 *
 * @example
 * const hasDoc = await cujDocExists('CUJ-005');
 * if (!hasDoc) console.warn('Missing documentation');
 */
export async function cujDocExists(cujId) {
  const docPath = path.join(CUJ_DOCS_DIR, `${cujId}.md`);
  return existsSync(docPath);
}

/**
 * Get stateless validation metadata
 *
 * Returns metadata about the last file read operation for stateless behavior validation.
 *
 * @returns {Object} Metadata: { lastFileReadTimestamp, lastFileModificationTime }
 *
 * @example
 * const meta = getValidationMetadata();
 * console.log(`Last read: ${meta.lastFileReadTimestamp}`);
 */
export function getValidationMetadata() {
  return {
    lastFileReadTimestamp,
    lastFileModificationTime,
    source: 'file_system',
    conversationHistoryReferenced: false,
  };
}

/**
 * Generate standardized artifact path with placeholders
 *
 * Creates artifact paths using the canonical <placeholder> format.
 * All paths follow the .claude/context/runtime/runs/<run_id>/ structure.
 *
 * @param {string} type - Artifact type (plan, plan_rating, manifest, reasoning, gate, checkpoint, error_log, recovery_state, browser_session)
 * @param {string} [runId='<run_id>'] - Run ID (defaults to placeholder)
 * @param {string} [planId='<plan_id>'] - Plan ID (defaults to placeholder)
 * @param {string} [agent='<agent>'] - Agent name (defaults to placeholder)
 * @param {string} [step='<step>'] - Step number (defaults to placeholder)
 * @returns {string} Standardized artifact path
 * @throws {Error} If artifact type is invalid
 *
 * @example
 * // With placeholders (for templates)
 * generateArtifactPath('plan'); // '.claude/context/runtime/runs/<run_id>/plans/<plan_id>.json'
 * generateArtifactPath('plan_rating'); // '.claude/context/runtime/runs/<run_id>/plans/<plan_id>-rating.json'
 * generateArtifactPath('reasoning'); // '.claude/context/runtime/runs/<run_id>/reasoning/<agent>.json'
 * generateArtifactPath('gate'); // '.claude/context/runtime/runs/<run_id>/gates/<step>-<agent>.json'
 *
 * @example
 * // With actual values (for runtime)
 * generateArtifactPath('plan', 'run-001', 'plan-greenfield');
 * // '.claude/context/runtime/runs/run-001/plans/plan-greenfield.json'
 *
 * generateArtifactPath('reasoning', 'run-001', null, 'developer');
 * // '.claude/context/runtime/runs/run-001/reasoning/developer.json'
 *
 * generateArtifactPath('gate', 'run-001', null, 'developer', '06');
 * // '.claude/context/runtime/runs/run-001/gates/06-developer.json'
 */
export function generateArtifactPath(
  type,
  runId = '<run_id>',
  planId = '<plan_id>',
  agent = '<agent>',
  step = '<step>'
) {
  const artifactTemplates = {
    plan: `.claude/context/runtime/runs/${runId}/plans/${planId}.json`,
    plan_rating: `.claude/context/runtime/runs/${runId}/plans/${planId}-rating.json`,
    plan_markdown: `.claude/context/runtime/runs/${runId}/plans/${planId}.md`,
    manifest: `.claude/context/runtime/runs/${runId}/artifacts/dev-manifest.json`,
    reasoning: `.claude/context/runtime/runs/${runId}/reasoning/${agent}.json`,
    gate: `.claude/context/runtime/runs/${runId}/gates/${step}-${agent}.json`,
    checkpoint: `.claude/context/runtime/runs/${runId}/checkpoint.json`,
    error_log: `.claude/context/runtime/runs/${runId}/errors.log`,
    recovery_state: `.claude/context/runtime/runs/${runId}/recovery-state.json`,
    browser_session: `.claude/context/runtime/runs/${runId}/browser-session.json`,
  };

  if (!artifactTemplates[type]) {
    throw new Error(
      `Invalid artifact type: ${type}. Valid types: ${Object.keys(artifactTemplates).join(', ')}`
    );
  }

  return artifactTemplates[type];
}

/**
 * Get all standardized artifact paths for a run
 *
 * Returns a complete set of artifact path templates for a given run.
 * Useful for initializing run state or generating execution contracts.
 *
 * @param {string} [runId='<run_id>'] - Run ID (defaults to placeholder)
 * @param {string} [planId='<plan_id>'] - Plan ID (defaults to placeholder)
 * @returns {Object} Object with all artifact path templates
 *
 * @example
 * const paths = getAllArtifactPaths('run-001', 'plan-greenfield');
 * console.log(paths.plan); // '.claude/context/runtime/runs/run-001/plans/plan-greenfield.json'
 * console.log(paths.checkpoint); // '.claude/context/runtime/runs/run-001/checkpoint.json'
 */
export function getAllArtifactPaths(runId = '<run_id>', planId = '<plan_id>') {
  return {
    plan: generateArtifactPath('plan', runId, planId),
    plan_rating: generateArtifactPath('plan_rating', runId, planId),
    plan_markdown: generateArtifactPath('plan_markdown', runId, planId),
    manifest: generateArtifactPath('manifest', runId),
    reasoning: generateArtifactPath('reasoning', runId),
    gate: generateArtifactPath('gate', runId),
    checkpoint: generateArtifactPath('checkpoint', runId),
    error_log: generateArtifactPath('error_log', runId),
    recovery_state: generateArtifactPath('recovery_state', runId),
    browser_session: generateArtifactPath('browser_session', runId),
  };
}

// Export all functions for backward compatibility
export default {
  loadRegistry,
  loadCUJMapping,
  normalizeExecutionMode,
  getCUJById,
  getCUJsByMode,
  getAllCUJIds,
  validateCUJStructure,
  cujDocExists,
  getValidationMetadata,
  generateArtifactPath,
  getAllArtifactPaths,
};
