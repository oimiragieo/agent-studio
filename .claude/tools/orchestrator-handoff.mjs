#!/usr/bin/env node
/**
 * Orchestrator Handoff - Manages seamless transition between orchestrator instances
 * 
 * When orchestrator reaches 90% context usage, this tool:
 * 1. Updates all state via subagents (plans, CLAUDE.md files, artifacts)
 * 2. Creates handoff package with all necessary state
 * 3. Initializes new orchestrator with handoff package
 * 4. Shuts down previous orchestrator cleanly
 * 
 * Usage:
 *   node .claude/tools/orchestrator-handoff.mjs --session-id <id> --project <name>
 */

import { readFile, writeFile, mkdir, readdir, stat } from 'fs/promises';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Get all phase directories for a project
 */
async function getProjectPhases(projectName) {
  const projectDir = join(__dirname, '..', 'projects', projectName);
  const entries = await readdir(projectDir, { withFileTypes: true });
  
  return entries
    .filter(entry => entry.isDirectory() && entry.name.startsWith('phase-'))
    .map(entry => entry.name)
    .sort();
}

/**
 * Get all plan files for a project
 */
async function getPlanFiles(projectName) {
  const phases = await getProjectPhases(projectName);
  const planFiles = {};
  
  for (const phase of phases) {
    const planPath = join(__dirname, '..', 'projects', projectName, phase, 'plan.md');
    try {
      await stat(planPath);
      planFiles[phase] = planPath;
    } catch (error) {
      // Plan file doesn't exist yet
    }
  }
  
  return planFiles;
}

/**
 * Get all CLAUDE.md files for a project
 */
async function getClaudeMdFiles(projectName) {
  const phases = await getProjectPhases(projectName);
  const claudeMdFiles = [];
  
  for (const phase of phases) {
    const claudePath = join(__dirname, '..', 'projects', projectName, phase, 'claude.md');
    try {
      await stat(claudePath);
      claudeMdFiles.push(claudePath);
    } catch (error) {
      // CLAUDE.md doesn't exist yet
    }
  }
  
  return claudeMdFiles;
}

/**
 * Get all artifacts for a project
 */
async function getArtifacts(projectName) {
  const phases = await getProjectPhases(projectName);
  const artifacts = [];
  
  for (const phase of phases) {
    const artifactsDir = join(__dirname, '..', 'projects', projectName, phase, 'artifacts');
    try {
      const entries = await readdir(artifactsDir, { recursive: true, withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile()) {
          artifacts.push(join(artifactsDir, entry.name));
        }
      }
    } catch (error) {
      // Artifacts directory doesn't exist
    }
  }
  
  return artifacts;
}

/**
 * Get memory files from orchestrator session
 */
async function getMemoryFiles(sessionId) {
  const memoryDir = join(__dirname, '..', 'orchestrators', `orchestrator-${sessionId}`, 'memory');
  const memoryFiles = [];
  
  try {
    const entries = await readdir(memoryDir, { recursive: true, withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        memoryFiles.push(join(memoryDir, entry.name));
      }
    }
  } catch (error) {
    // Memory directory doesn't exist
  }
  
  return memoryFiles;
}

/**
 * Get current project state
 */
async function getProjectState(projectName, sessionId) {
  const stateFile = join(__dirname, '..', 'projects', projectName, 'orchestrator-state.json');
  
  try {
    const state = JSON.parse(await readFile(stateFile, 'utf-8'));
    return state;
  } catch (error) {
    // State file doesn't exist, return default
    return {
      projectName,
      currentPhase: null,
      currentStep: 0,
      completedTasks: [],
      pendingTasks: [],
      contextSummary: 'Initial state'
    };
  }
}

/**
 * Create handoff package
 */
export async function createHandoffPackage(previousSessionId, projectName) {
  const newSessionId = `orchestrator-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const orchestratorDir = join(__dirname, '..', 'orchestrators', `orchestrator-${previousSessionId}`);
  const handoffFile = join(orchestratorDir, 'handoff-package.json');
  
  // Ensure directory exists
  await mkdir(orchestratorDir, { recursive: true });
  
  // Gather all state
  const [planFiles, claudeMdFiles, artifacts, memoryFiles, projectState] = await Promise.all([
    getPlanFiles(projectName),
    getClaudeMdFiles(projectName),
    getArtifacts(projectName),
    getMemoryFiles(previousSessionId),
    getProjectState(projectName, previousSessionId)
  ]);
  
  const handoffPackage = {
    previousSessionId,
    newSessionId,
    projectName,
    createdAt: new Date().toISOString(),
    currentPhase: projectState.currentPhase,
    planFiles: Object.fromEntries(
      Object.entries(planFiles).map(([phase, path]) => [
        phase,
        relative(join(__dirname, '..'), path)
      ])
    ),
    claudeMdFiles: claudeMdFiles.map(path => relative(join(__dirname, '..'), path)),
    artifacts: artifacts.map(path => relative(join(__dirname, '..'), path)),
    memoryFiles: memoryFiles.map(path => relative(join(__dirname, '..'), path)),
    projectState: {
      currentStep: projectState.currentStep,
      completedTasks: projectState.completedTasks,
      pendingTasks: projectState.pendingTasks,
      contextSummary: projectState.contextSummary || 'Handoff from previous orchestrator'
    }
  };
  
  // Save handoff package
  await writeFile(handoffFile, JSON.stringify(handoffPackage, null, 2), 'utf-8');
  
  // Also save to new orchestrator directory for initialization
  const newOrchestratorDir = join(__dirname, '..', 'orchestrators', newSessionId);
  await mkdir(newOrchestratorDir, { recursive: true });
  await writeFile(
    join(newOrchestratorDir, 'handoff-package.json'),
    JSON.stringify(handoffPackage, null, 2),
    'utf-8'
  );
  
  return handoffPackage;
}

/**
 * Initialize new orchestrator with handoff package
 */
export async function initializeNewOrchestrator(newSessionId) {
  const orchestratorDir = join(__dirname, '..', 'orchestrators', newSessionId);
  const handoffFile = join(orchestratorDir, 'handoff-package.json');
  
  const handoffPackage = JSON.parse(await readFile(handoffFile, 'utf-8'));
  
  // Create initialization prompt
  const initPrompt = `Initialize the codebase and pick up the project where the previous orchestrator left off.

Previous Session: ${handoffPackage.previousSessionId}
Project: ${handoffPackage.projectName}
Current Phase: ${handoffPackage.currentPhase || 'Not specified'}
Current Step: ${handoffPackage.projectState.currentStep}

Context Summary:
${handoffPackage.projectState.contextSummary}

Available Resources:
- Plan files: ${Object.keys(handoffPackage.planFiles).join(', ')}
- CLAUDE.md files: ${handoffPackage.claudeMdFiles.length} files
- Artifacts: ${handoffPackage.artifacts.length} files
- Memory files: ${handoffPackage.memoryFiles.length} files

Completed Tasks:
${handoffPackage.projectState.completedTasks.map(t => `- ${t}`).join('\n')}

Pending Tasks:
${handoffPackage.projectState.pendingTasks.map(t => `- ${t}`).join('\n')}

Your task:
1. Review the handoff package to understand the current project state
2. Load relevant plan files and CLAUDE.md files for context
3. Continue from where the previous orchestrator left off
4. Update the orchestrator state as you progress
5. Once initialized, send a shutdown signal to the previous orchestrator (${handoffPackage.previousSessionId})`;

  // Save initialization prompt
  await writeFile(
    join(orchestratorDir, 'init-prompt.md'),
    initPrompt,
    'utf-8'
  );
  
  return {
    newSessionId,
    initPrompt,
    handoffPackage
  };
}

/**
 * Shutdown previous orchestrator
 */
export async function shutdownOrchestrator(sessionId) {
  const orchestratorDir = join(__dirname, '..', 'orchestrators', `orchestrator-${sessionId}`);
  const sessionFile = join(orchestratorDir, 'session.json');
  
  let sessionData = {};
  try {
    sessionData = JSON.parse(await readFile(sessionFile, 'utf-8'));
  } catch (error) {
    // Session file doesn't exist
  }
  
  sessionData.status = 'shutdown';
  sessionData.shutdownAt = new Date().toISOString();
  
  await writeFile(sessionFile, JSON.stringify(sessionData, null, 2), 'utf-8');
  
  // Note: Actual agent shutdown would be handled by Claude Code
  // This just marks the session as shutdown in our tracking
  
  return sessionData;
}

/**
 * Main handoff process
 */
export async function executeHandoff(previousSessionId, projectName) {
  // Step 1: Create handoff package
  const handoffPackage = await createHandoffPackage(previousSessionId, projectName);
  
  // Step 2: Initialize new orchestrator
  const initResult = await initializeNewOrchestrator(handoffPackage.newSessionId);
  
  // Step 3: Shutdown previous orchestrator (after new one is ready)
  // Note: In practice, the new orchestrator would handle this after initialization
  // await shutdownOrchestrator(previousSessionId);
  
  return {
    handoffPackage,
    initResult,
    message: `Handoff complete. New orchestrator: ${handoffPackage.newSessionId}`
  };
}

/**
 * CLI interface
 */
async function main() {
  const args = process.argv.slice(2);
  const sessionIdIndex = args.indexOf('--session-id');
  const projectIndex = args.indexOf('--project');
  
  if (sessionIdIndex === -1 || !args[sessionIdIndex + 1] || 
      projectIndex === -1 || !args[projectIndex + 1]) {
    console.error('Usage: node orchestrator-handoff.mjs --session-id <id> --project <name>');
    process.exit(1);
  }
  
  const sessionId = args[sessionIdIndex + 1];
  const projectName = args[projectIndex + 1];
  
  const result = await executeHandoff(sessionId, projectName);
  
  console.log(JSON.stringify(result, null, 2));
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default { 
  createHandoffPackage, 
  initializeNewOrchestrator, 
  shutdownOrchestrator, 
  executeHandoff 
};

