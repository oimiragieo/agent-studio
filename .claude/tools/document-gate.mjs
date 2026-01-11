#!/usr/bin/env node
/**
 * Document Gate - Document-Driven Control
 *
 * Enforces document approval workflow for document-driven control
 * No agent proceeds until prerequisites are approved
 *
 * Usage:
 *   node .claude/tools/document-gate.mjs check --run-id <id> --document <name>
 *   node .claude/tools/document-gate.mjs approve --run-id <id> --document <name> --approved-by <agent>
 */

import { readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { isDocumentApproved, approveDocument, readProjectDatabase } from './project-db.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Document gate definitions - which documents must be approved before proceeding
 */
const DOCUMENT_GATES = {
  'ARCHITECTURE.md': {
    required_for: ['implementation', 'development', 'coding'],
    approved_by: 'architect',
    description: 'System architecture must be approved before implementation',
  },
  'PRD.md': {
    required_for: ['architecture', 'design', 'implementation'],
    approved_by: 'pm',
    description: 'Product requirements must be approved before architecture',
  },
  'UX_SPEC.md': {
    required_for: ['implementation', 'frontend'],
    approved_by: 'ux-expert',
    description: 'UX specification must be approved before frontend implementation',
  },
  'DATABASE_SCHEMA.md': {
    required_for: ['implementation', 'backend', 'api'],
    approved_by: 'database-architect',
    description: 'Database schema must be approved before backend implementation',
  },
  'SECURITY_PLAN.md': {
    required_for: ['implementation', 'deployment'],
    approved_by: 'security-architect',
    description: 'Security plan must be approved before deployment',
  },
};

/**
 * Check if document gate is passed
 * @param {string} runId - Run ID
 * @param {string} documentName - Document name
 * @returns {Promise<Object>} Gate check result
 */
export async function checkDocumentGate(runId, documentName) {
  const approved = await isDocumentApproved(runId, documentName);
  const gate = DOCUMENT_GATES[documentName];

  return {
    document: documentName,
    approved: approved,
    required_for: gate?.required_for || [],
    approved_by: gate?.approved_by || null,
    description: gate?.description || 'Document approval required',
    can_proceed: approved,
  };
}

/**
 * Check if agent can proceed with task
 * @param {string} runId - Run ID
 * @param {string} taskType - Task type (e.g., 'implementation', 'architecture')
 * @returns {Promise<Object>} Gate check result
 */
export async function checkGateForTask(runId, taskType) {
  const projectDb = await readProjectDatabase(runId);
  const blockers = [];
  const requiredDocuments = [];

  // Find documents required for this task type
  for (const [docName, gate] of Object.entries(DOCUMENT_GATES)) {
    if (gate.required_for.includes(taskType)) {
      requiredDocuments.push(docName);
      const approved = await isDocumentApproved(runId, docName);
      if (!approved) {
        blockers.push({
          document: docName,
          reason: gate.description,
          required_approver: gate.approved_by,
        });
      }
    }
  }

  return {
    task_type: taskType,
    can_proceed: blockers.length === 0,
    required_documents: requiredDocuments,
    blockers: blockers,
    message:
      blockers.length > 0
        ? `Cannot proceed with ${taskType}. Missing approvals: ${blockers.map(b => b.document).join(', ')}`
        : `All required documents approved. Can proceed with ${taskType}.`,
  };
}

/**
 * Enforce document gate - throws error if gate not passed
 * @param {string} runId - Run ID
 * @param {string} taskType - Task type
 * @throws {Error} If gate not passed
 */
export async function enforceDocumentGate(runId, taskType) {
  const gateCheck = await checkGateForTask(runId, taskType);

  if (!gateCheck.can_proceed) {
    throw new Error(`Document gate failed: ${gateCheck.message}`);
  }

  return gateCheck;
}

/**
 * Get all document gates for a run
 * @param {string} runId - Run ID
 * @returns {Promise<Array>} All document gate statuses
 */
export async function getAllDocumentGates(runId) {
  const gates = [];

  for (const [docName, gate] of Object.entries(DOCUMENT_GATES)) {
    const approved = await isDocumentApproved(runId, docName);
    gates.push({
      document: docName,
      approved: approved,
      required_for: gate.required_for,
      approved_by: gate.approved_by,
      description: gate.description,
    });
  }

  return gates;
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'check') {
    const runIdIndex = args.indexOf('--run-id');
    const docIndex = args.indexOf('--document');
    const taskIndex = args.indexOf('--task-type');

    if (runIdIndex === -1 || runIdIndex === args.length - 1) {
      console.error(
        'Usage: node document-gate.mjs check --run-id <id> [--document <name> | --task-type <type>]'
      );
      process.exit(1);
    }

    const runId = args[runIdIndex + 1];

    if (docIndex !== -1 && docIndex < args.length - 1) {
      const docName = args[docIndex + 1];
      const result = await checkDocumentGate(runId, docName);
      console.log(JSON.stringify(result, null, 2));
    } else if (taskIndex !== -1 && taskIndex < args.length - 1) {
      const taskType = args[taskIndex + 1];
      const result = await checkGateForTask(runId, taskType);
      console.log(JSON.stringify(result, null, 2));
    } else {
      // Get all gates
      const gates = await getAllDocumentGates(runId);
      console.log(JSON.stringify(gates, null, 2));
    }
  } else if (command === 'approve') {
    const runIdIndex = args.indexOf('--run-id');
    const docIndex = args.indexOf('--document');
    const approvedByIndex = args.indexOf('--approved-by');

    if (runIdIndex === -1 || docIndex === -1 || approvedByIndex === -1) {
      console.error(
        'Usage: node document-gate.mjs approve --run-id <id> --document <name> --approved-by <agent>'
      );
      process.exit(1);
    }

    const runId = args[runIdIndex + 1];
    const docName = args[docIndex + 1];
    const approvedBy = args[approvedByIndex + 1];

    const result = await approveDocument(runId, docName, approvedBy);
    console.log(JSON.stringify(result, null, 2));
  } else if (command === 'enforce') {
    const runIdIndex = args.indexOf('--run-id');
    const taskIndex = args.indexOf('--task-type');

    if (runIdIndex === -1 || taskIndex === -1) {
      console.error('Usage: node document-gate.mjs enforce --run-id <id> --task-type <type>');
      process.exit(1);
    }

    const runId = args[runIdIndex + 1];
    const taskType = args[taskIndex + 1];

    try {
      const result = await enforceDocumentGate(runId, taskType);
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error(`Gate enforcement failed: ${error.message}`);
      process.exit(1);
    }
  } else {
    console.error('Unknown command. Available: check, approve, enforce');
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default {
  checkDocumentGate,
  checkGateForTask,
  enforceDocumentGate,
  approveDocument,
  getAllDocumentGates,
};
