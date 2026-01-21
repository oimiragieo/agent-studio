import { existsSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Resolve workflow path from project root
 */
export function resolveWorkflowPath(relativePath) {
  // If path is already absolute, return as-is
  if (
    relativePath.startsWith('/') ||
    (process.platform === 'win32' && /^[A-Z]:/.test(relativePath))
  ) {
    return relativePath;
  }

  // Strategy 1: Resolve from project root (parent of .claude directory)
  // path-resolver.mjs is in .claude/tools/workflow/, so go up three levels
  const projectRoot = resolve(__dirname, '../../..');
  const projectRootPath = resolve(projectRoot, relativePath);
  if (existsSync(projectRootPath)) {
    return projectRootPath;
  }

  // Strategy 2: Resolve from current working directory
  const cwdPath = resolve(process.cwd(), relativePath);
  if (existsSync(cwdPath)) {
    return cwdPath;
  }

  // Strategy 3: Resolve from script location
  const scriptPath = resolve(__dirname, relativePath);
  if (existsSync(scriptPath)) {
    return scriptPath;
  }

  // If none found, return project root path
  return projectRootPath;
}

/**
 * Resolve schema path using same strategy as workflow files
 */
export function resolveSchemaPath(relativePath) {
  return resolveWorkflowPath(relativePath);
}
