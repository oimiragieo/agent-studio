#!/usr/bin/env node

/**
 * Orchestrator Enforcement Hook
 *
 * Purpose: Block orchestrators from using implementation tools directly
 * Trigger: PreToolUse (before any tool is executed)
 * Action: Block Write, Edit, Bash (for rm/git), Read (>2 files)
 *
 * This hook prevents orchestrators from doing implementation work
 * and forces them to delegate to subagents via Task tool.
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const ORCHESTRATOR_AGENTS = [
  'orchestrator',
  'master-orchestrator',
  'model-orchestrator'
];

const BLOCKED_TOOLS = {
  Write: 'spawn developer subagent',
  Edit: 'spawn developer subagent',
  Bash: 'check command (rm/git blocked → spawn developer)',
  Read: 'check file count (>2 files → spawn analyst/Explore)',
  Grep: 'spawn analyst subagent',
  Glob: 'spawn analyst subagent'
};

// Dangerous Bash commands that orchestrators should never run
const DANGEROUS_BASH_COMMANDS = [
  'rm -f',
  'rm -rf',
  'git add',
  'git commit',
  'git push',
  'git pull',
  'git merge',
  'node .claude/tools/', // Validation scripts
  'npm run',
  'pnpm'
];

// Track Read tool usage per agent session
const readCountTracker = new Map();

/**
 * PreToolUse Hook - Validates tool usage before execution
 *
 * @param {Object} context - Hook context
 * @param {string} context.tool - Tool being used
 * @param {Object} context.parameters - Tool parameters
 * @param {string} context.agentName - Current agent name
 * @returns {Object} - { decision: "allow" | "block", message?: string }
 */
export async function PreToolUse(context) {
  const { tool, parameters, agentName } = context;

  // Only enforce for orchestrator agents
  if (!ORCHESTRATOR_AGENTS.includes(agentName)) {
    return { decision: 'allow' };
  }

  // Check if tool is blocked
  if (tool === 'Write') {
    return {
      decision: 'block',
      message: `
╔═══════════════════════════════════════════════════════════════════╗
║  ORCHESTRATOR VIOLATION DETECTED                                  ║
║                                                                   ║
║  Tool: Write                                                      ║
║  Reason: Orchestrators MUST NOT write files directly              ║
║  Action: Spawn developer subagent via Task tool                   ║
║                                                                   ║
║  Correct Pattern:                                                 ║
║  Task: developer                                                  ║
║  Prompt: "Create/modify the file at ${parameters.file_path}"     ║
╚═══════════════════════════════════════════════════════════════════╝
      `.trim()
    };
  }

  if (tool === 'Edit') {
    return {
      decision: 'block',
      message: `
╔═══════════════════════════════════════════════════════════════════╗
║  ORCHESTRATOR VIOLATION DETECTED                                  ║
║                                                                   ║
║  Tool: Edit                                                       ║
║  Reason: Orchestrators MUST NOT edit files directly               ║
║  Action: Spawn developer subagent via Task tool                   ║
║                                                                   ║
║  Correct Pattern:                                                 ║
║  Task: developer                                                  ║
║  Prompt: "Edit the file at ${parameters.file_path}"              ║
╚═══════════════════════════════════════════════════════════════════╝
      `.trim()
    };
  }

  if (tool === 'Bash') {
    const command = parameters.command || '';

    // Check for dangerous commands
    for (const dangerousCmd of DANGEROUS_BASH_COMMANDS) {
      if (command.includes(dangerousCmd)) {
        return {
          decision: 'block',
          message: `
╔═══════════════════════════════════════════════════════════════════╗
║  ORCHESTRATOR VIOLATION DETECTED                                  ║
║                                                                   ║
║  Tool: Bash                                                       ║
║  Command: ${command.substring(0, 50)}...                          ║
║  Reason: Orchestrators MUST NOT run ${dangerousCmd} directly      ║
║  Action: Spawn developer or qa subagent via Task tool             ║
║                                                                   ║
║  Correct Pattern (for rm/git):                                    ║
║  Task: developer                                                  ║
║  Prompt: "Execute: ${command}"                                    ║
║                                                                   ║
║  Correct Pattern (for validation scripts):                        ║
║  Task: qa                                                         ║
║  Prompt: "Run validation: ${command}"                             ║
╚═══════════════════════════════════════════════════════════════════╝
          `.trim()
        };
      }
    }

    // Allow simple, safe Bash commands (e.g., pwd, ls)
    return { decision: 'allow' };
  }

  if (tool === 'Read') {
    // Track read count for this agent
    const currentCount = readCountTracker.get(agentName) || 0;
    const newCount = currentCount + 1;

    readCountTracker.set(agentName, newCount);

    // Block if exceeding 2-file rule
    if (newCount > 2) {
      return {
        decision: 'block',
        message: `
╔═══════════════════════════════════════════════════════════════════╗
║  ORCHESTRATOR VIOLATION DETECTED                                  ║
║                                                                   ║
║  Tool: Read (file #${newCount})                                   ║
║  Reason: 2-FILE RULE - Orchestrators limited to 2 Read calls      ║
║  Action: Spawn analyst or Explore subagent via Task tool          ║
║                                                                   ║
║  Correct Pattern:                                                 ║
║  Task: analyst (or Explore)                                       ║
║  Prompt: "Analyze the files in ${parameters.file_path}"          ║
╚═══════════════════════════════════════════════════════════════════╝
        `.trim()
      };
    }

    // Allow reads 1-2
    return { decision: 'allow' };
  }

  if (tool === 'Grep') {
    return {
      decision: 'block',
      message: `
╔═══════════════════════════════════════════════════════════════════╗
║  ORCHESTRATOR VIOLATION DETECTED                                  ║
║                                                                   ║
║  Tool: Grep                                                       ║
║  Reason: Orchestrators MUST NOT search code directly              ║
║  Action: Spawn analyst subagent via Task tool                     ║
║                                                                   ║
║  Correct Pattern:                                                 ║
║  Task: analyst                                                    ║
║  Prompt: "Search codebase for: ${parameters.pattern}"            ║
╚═══════════════════════════════════════════════════════════════════╝
      `.trim()
    };
  }

  if (tool === 'Glob') {
    return {
      decision: 'block',
      message: `
╔═══════════════════════════════════════════════════════════════════╗
║  ORCHESTRATOR VIOLATION DETECTED                                  ║
║                                                                   ║
║  Tool: Glob                                                       ║
║  Reason: Orchestrators MUST NOT search files directly             ║
║  Action: Spawn analyst subagent via Task tool                     ║
║                                                                   ║
║  Correct Pattern:                                                 ║
║  Task: analyst                                                    ║
║  Prompt: "Find files matching: ${parameters.pattern}"            ║
╚═══════════════════════════════════════════════════════════════════╝
      `.trim()
    };
  }

  // Allow all other tools (Task, Search, etc.)
  return { decision: 'allow' };
}

/**
 * PostToolUse Hook - Reset Read counter if Task tool was used
 * This allows orchestrators to reset their read count after delegating
 */
export async function PostToolUse(context) {
  const { tool, agentName } = context;

  // Reset read counter when orchestrator spawns a subagent
  if (ORCHESTRATOR_AGENTS.includes(agentName) && tool === 'Task') {
    readCountTracker.set(agentName, 0);
  }

  return { decision: 'allow' };
}

/**
 * Reset read counter (for testing or session start)
 */
export function resetReadCounter(agentName) {
  readCountTracker.delete(agentName);
}

/**
 * Get current read count (for testing)
 */
export function getReadCount(agentName) {
  return readCountTracker.get(agentName) || 0;
}

// Default export for hook registration
export default {
  PreToolUse,
  PostToolUse,
  resetReadCounter,
  getReadCount
};
