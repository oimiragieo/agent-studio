#!/usr/bin/env node
/**
 * Cursor Window Spawner
 * Spawns new Cursor IDE windows with handoff packages for shift-work orchestration
 *
 * Usage:
 *   node .claude/tools/cursor-spawner.mjs --handoff-package <path> --project-dir <path>
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Detect Cursor executable path
 */
async function findCursorExecutable() {
  const platform = process.platform;
  let cursorPath;

  if (platform === 'win32') {
    // Windows paths - use path.join() for cross-platform compatibility
    const possiblePaths = [
      join(process.env.LOCALAPPDATA, 'Programs', 'cursor', 'Cursor.exe'),
      join(process.env.PROGRAMFILES, 'Cursor', 'Cursor.exe'),
      join(process.env['PROGRAMFILES(X86)'], 'Cursor', 'Cursor.exe'),
      join(
        'C:',
        'Users',
        process.env.USERNAME,
        'AppData',
        'Local',
        'Programs',
        'cursor',
        'Cursor.exe'
      ),
    ];

    for (const path of possiblePaths) {
      try {
        await execAsync(`where "${path}"`);
        cursorPath = path;
        break;
      } catch (error) {
        // Try next path
      }
    }
  } else if (platform === 'darwin') {
    // macOS paths
    cursorPath = '/Applications/Cursor.app/Contents/MacOS/Cursor';
  } else {
    // Linux paths
    cursorPath = 'cursor'; // Assume in PATH
  }

  return cursorPath || 'cursor';
}

/**
 * Create Cursor workspace configuration with handoff package
 */
async function createWorkspaceConfig(projectDir, handoffPackage) {
  const workspaceFile = join(projectDir, '.cursor', 'workspace-handoff.json');
  await mkdir(dirname(workspaceFile), { recursive: true });

  const workspaceConfig = {
    version: '1.0.0',
    handoffPackage: {
      previousSessionId: handoffPackage.previousSessionId,
      newSessionId: handoffPackage.newSessionId,
      projectName: handoffPackage.projectName,
      createdAt: handoffPackage.createdAt,
      currentPhase: handoffPackage.currentPhase,
      contextSummary:
        handoffPackage.projectState?.contextSummary || 'Handoff from previous orchestrator',
    },
    projectState: handoffPackage.projectState || {},
    planFiles: handoffPackage.planFiles || {},
    artifacts: handoffPackage.artifacts || [],
    instructions: {
      initPrompt: `Initialize the codebase and pick up the project where the previous orchestrator left off.

Previous Session: ${handoffPackage.previousSessionId}
Project: ${handoffPackage.projectName}
Current Phase: ${handoffPackage.currentPhase || 'Not specified'}
Current Step: ${handoffPackage.projectState?.currentStep || 0}

Context Summary:
${handoffPackage.projectState?.contextSummary || 'Handoff from previous orchestrator'}

Available Resources:
- Plan files: ${Object.keys(handoffPackage.planFiles || {}).join(', ')}
- Artifacts: ${(handoffPackage.artifacts || []).length} files

Completed Tasks:
${(handoffPackage.projectState?.completedTasks || []).map(t => `- ${t}`).join('\n')}

Pending Tasks:
${(handoffPackage.projectState?.pendingTasks || []).map(t => `- ${t}`).join('\n')}

Your task:
1. Review the handoff package to understand the current project state
2. Load relevant plan files for context
3. Continue from where the previous orchestrator left off
4. Update the orchestrator state as you progress`,
    },
  };

  await writeFile(workspaceFile, JSON.stringify(workspaceConfig, null, 2), 'utf-8');
  return workspaceFile;
}

/**
 * Spawn new Cursor window with handoff package
 */
export async function spawnCursorWindow(handoffPackagePath, projectDir) {
  // Load handoff package
  const handoffPackage = JSON.parse(await readFile(handoffPackagePath, 'utf-8'));

  // Resolve project directory
  const resolvedProjectDir = resolve(projectDir || handoffPackage.projectName || process.cwd());

  // Create workspace configuration
  const workspaceConfigPath = await createWorkspaceConfig(resolvedProjectDir, handoffPackage);

  // Find Cursor executable
  const cursorExecutable = await findCursorExecutable();

  // Spawn new Cursor window
  const platform = process.platform;
  let spawnArgs;

  if (platform === 'win32') {
    // Windows: spawn with project directory
    spawnArgs = [resolvedProjectDir];
  } else if (platform === 'darwin') {
    // macOS: use open command or direct executable
    spawnArgs = ['-n', resolvedProjectDir];
  } else {
    // Linux: direct executable with project directory
    spawnArgs = [resolvedProjectDir];
  }

  return new Promise((resolve, reject) => {
    const cursorProcess = spawn(cursorExecutable, spawnArgs, {
      cwd: resolvedProjectDir,
      detached: true,
      stdio: 'ignore',
    });

    cursorProcess.on('error', error => {
      reject(new Error(`Failed to spawn Cursor window: ${error.message}`));
    });

    cursorProcess.on('spawn', () => {
      // Unref to allow parent process to exit
      cursorProcess.unref();
      resolve({
        success: true,
        processId: cursorProcess.pid,
        projectDir: resolvedProjectDir,
        workspaceConfig: workspaceConfigPath,
        handoffPackage: handoffPackage.newSessionId,
      });
    });
  });
}

/**
 * Spawn Cursor window with handoff package from orchestrator-handoff
 */
export async function spawnCursorWithHandoff(previousSessionId, projectName) {
  const { createHandoffPackage } = await import('./orchestrator-handoff.mjs');

  // Create handoff package
  const handoffPackage = await createHandoffPackage(previousSessionId, projectName);

  // Save handoff package to temp location
  const handoffPackagePath = join(
    __dirname,
    '..',
    'orchestrators',
    handoffPackage.newSessionId,
    'handoff-package.json'
  );

  // Spawn Cursor window
  const result = await spawnCursorWindow(handoffPackagePath, null);

  return {
    ...result,
    handoffPackage: handoffPackage,
  };
}

/**
 * CLI interface
 */
async function main() {
  const args = process.argv.slice(2);
  const handoffIndex = args.indexOf('--handoff-package');
  const projectIndex = args.indexOf('--project-dir');
  const sessionIndex = args.indexOf('--session-id');
  const projectNameIndex = args.indexOf('--project');

  if (handoffIndex !== -1 && args[handoffIndex + 1]) {
    // Direct handoff package path
    const handoffPackagePath = args[handoffIndex + 1];
    const projectDir = projectIndex !== -1 ? args[projectIndex + 1] : null;

    const result = await spawnCursorWindow(handoffPackagePath, projectDir);
    console.log(JSON.stringify(result, null, 2));
  } else if (sessionIndex !== -1 && projectNameIndex !== -1) {
    // Create handoff and spawn
    const sessionId = args[sessionIndex + 1];
    const projectName = args[projectNameIndex + 1];

    const result = await spawnCursorWithHandoff(sessionId, projectName);
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.error('Usage:');
    console.error('  node cursor-spawner.mjs --handoff-package <path> [--project-dir <path>]');
    console.error('  node cursor-spawner.mjs --session-id <id> --project <name>');
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default {
  spawnCursorWindow,
  spawnCursorWithHandoff,
  findCursorExecutable,
};
