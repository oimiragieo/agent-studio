#!/usr/bin/env node
/**
 * Runtime Scope Helper
 *
 * Agent Zero–inspired "Projects" isolation for runtime artifacts:
 * - Base runtime dir: `.claude/context/runtime/`
 * - Optional active project namespace: `.claude/context/runtime/projects/<id>/`
 *
 * This keeps runs/jobs/events separated when you intentionally switch
 * between multiple “projects” inside the same repo.
 *
 * By default, if no active project is set, runtimeDir === baseRuntimeDir.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DEFAULT_PROJECT_ROOT = join(__dirname, '..', '..');

function resolveDirEnv(envName, defaultPath, projectRoot = DEFAULT_PROJECT_ROOT) {
  const raw = String(process.env[envName] || '').trim();
  if (!raw) return defaultPath;
  return isAbsolute(raw) ? raw : join(projectRoot, raw);
}

function safeFileId(input) {
  const raw = String(input ?? '');
  const hash = createHash('sha256').update(raw).digest('hex').slice(0, 10);
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60);
  return `${cleaned || 'project'}-${hash}`;
}

function readJsonFile(path) {
  try {
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

export function getBaseRuntimeDir({ projectRoot = DEFAULT_PROJECT_ROOT } = {}) {
  return resolveDirEnv(
    'CLAUDE_RUNTIME_DIR',
    join(projectRoot, '.claude', 'context', 'runtime'),
    projectRoot
  );
}

export function getActiveProject({ baseRuntimeDir } = {}) {
  if (!baseRuntimeDir) return null;
  const activePath = join(baseRuntimeDir, 'active-project.json');
  const active = readJsonFile(activePath);
  const name = typeof active?.name === 'string' ? active.name.trim() : '';
  if (!name) return null;
  return { name, id: safeFileId(name), active_path: activePath };
}

export function resolveRuntimeScope({ projectRoot = DEFAULT_PROJECT_ROOT } = {}) {
  const baseRuntimeDir = getBaseRuntimeDir({ projectRoot });
  const active = getActiveProject({ baseRuntimeDir });
  const runtimeDir = active ? join(baseRuntimeDir, 'projects', active.id) : baseRuntimeDir;
  return { projectRoot, baseRuntimeDir, runtimeDir, activeProject: active };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const scope = resolveRuntimeScope();
  process.stdout.write(JSON.stringify(scope, null, 2));
}
