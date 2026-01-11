#!/usr/bin/env node
/**
 * Artifact Path Resolver
 *
 * Provides a single place to resolve artifact/report/task paths, supporting:
 * - New run-scoped paths: `.claude/context/runs/<runId>/...`
 * - Legacy paths (when runId is null): `.claude/context/<type>/...`
 */

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getRunDirectoryStructure } from './run-manager.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROJECT_ROOT = join(__dirname, '../..');
const LEGACY_CONTEXT_DIR = join(PROJECT_ROOT, '.claude', 'context');

export function getArtifactDir(runId) {
  if (runId) {
    const runDirs = getRunDirectoryStructure(runId);
    return runDirs.artifacts_dir;
  }
  return join(LEGACY_CONTEXT_DIR, 'artifacts');
}

export function getArtifactPath(runId, artifactName) {
  return join(getArtifactDir(runId), artifactName);
}

export function getReportPath(runId, reportName) {
  if (runId) {
    const runDirs = getRunDirectoryStructure(runId);
    return join(runDirs.reports_dir, reportName);
  }
  return join(LEGACY_CONTEXT_DIR, 'reports', reportName);
}

export function getTaskPath(runId, taskName) {
  if (runId) {
    const runDirs = getRunDirectoryStructure(runId);
    return join(runDirs.tasks_dir, taskName);
  }
  return join(LEGACY_CONTEXT_DIR, 'tasks', taskName);
}

export default {
  getArtifactDir,
  getArtifactPath,
  getReportPath,
  getTaskPath,
};
