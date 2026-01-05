#!/usr/bin/env node
/**
 * Agent Executor - Executes agents programmatically with proper context assembly
 * 
 * Provides adapter interface for different runtimes (Claude Code, CLI, Cursor)
 * Implements context assembly pipeline and approval gates
 * 
 * Usage:
 *   import { executeAgent, AgentContextBuilder } from './agent-executor.mjs';
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { getRunDirectoryStructure, readRun, updateRun } from './run-manager.mjs';
import { resolveArtifactPath, resolveGatePath, resolveReasoningPath } from './path-resolver.mjs';
import { createContextPacket, injectContext } from './context-injector.mjs';
import { transitionState, requestApproval } from './run-state-machine.mjs';
import { updateRunSummary } from './dashboard-generator.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * @typedef {Object} ExecutionResult
 * @property {'completed'|'failed'|'timeout'|'awaiting_approval'} status
 * @property {string[]} artifacts_written
 * @property {string} gate_path
 * @property {string|null} reasoning_path
 * @property {Object} token_usage
 * @property {number} token_usage.used
 * @property {number} token_usage.limit
 * @property {'api'|'session'|'estimate'|'heuristic'} token_usage.source
 * @property {'high'|'medium'|'low'} token_usage.confidence
 * @property {string} stderr
 * @property {string} stdout
 * @property {number} duration_ms
 * @property {string} [error]
 */

/**
 * Agent Executor Adapter Interface
 */
export class AgentExecutorAdapter {
  /**
   * Execute agent with assembled context
   * @param {Object} params - Execution parameters
   * @returns {Promise<ExecutionResult>} Execution result
   */
  async execute(params) {
    throw new Error('Adapter must implement execute()');
  }
  
  /**
   * Check if adapter is available for current runtime
   * @returns {boolean} True if adapter can be used
   */
  isAvailable() {
    return false;
  }
}

/**
 * Claude Code Adapter - Uses Task tool for subagent invocation
 */
export class ClaudeCodeAdapter extends AgentExecutorAdapter {
  isAvailable() {
    // Check if running in Claude Code environment
    return !!process.env.CLAUDE_CODE_SESSION_ID || !!process.env.CLAUDE_CODE;
  }
  
  async execute({ agent, systemPrompt, messages, tools, runId, step }) {
    // In Claude Code, we use the Task tool to invoke subagents
    // This is a placeholder - actual implementation would use Claude Agent SDK
    // Fail fast instead of fake success to prevent false positives
    
    const startTime = Date.now();
    
    // TODO: Actual implementation would:
    // 1. Use Claude Agent SDK to invoke Task tool with subagent specification
    // 2. Wait for completion
    // 3. Capture artifacts, stdout, stderr
    // 4. Read token usage from API
    
    // Return failed status since adapter is not fully implemented
    return {
      status: 'failed',
      error: 'ClaudeCodeAdapter not fully implemented - requires Claude Agent SDK integration',
      artifacts_written: [],
      gate_path: resolveGatePath(runId, step),
      reasoning_path: resolveReasoningPath(runId, step, agent),
      token_usage: {
        used: 0,
        limit: 100000,
        source: 'estimate',
        confidence: 'low'
      },
      stderr: 'Adapter placeholder - not implemented',
      stdout: '',
      duration_ms: Date.now() - startTime
    };
  }
}

/**
 * CLI Adapter - Spawns claude CLI commands
 */
export class CLIAdapter extends AgentExecutorAdapter {
  async isAvailable() {
    // Check if claude CLI is available
    try {
      const { execSync } = await import('child_process');
      execSync('claude --version', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }
  
  async execute({ agent, systemPrompt, messages, tools, runId, step }) {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    const startTime = Date.now();
    
    // Build command to invoke agent via CLI
    const agentPrompt = `${systemPrompt}\n\n${messages.map(m => `${m.role}: ${m.content}`).join('\n\n')}`;
    const command = `claude -p "${agentPrompt.replace(/"/g, '\\"')}" --agent ".claude/agents/${agent}.md"`;
    
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: resolve(__dirname, '../..'),
        maxBuffer: 10 * 1024 * 1024,
        timeout: 300000 // 5 minutes
      });
      
      return {
        status: 'completed',
        artifacts_written: [],
        gate_path: resolveGatePath(runId, step),
        reasoning_path: resolveReasoningPath(runId, step, agent),
        token_usage: {
          used: 0, // Would need CLI to report usage
          limit: 100000,
          source: 'estimate',
          confidence: 'low'
        },
        stderr: stderr || '',
        stdout: stdout || '',
        duration_ms: Date.now() - startTime
      };
    } catch (error) {
      return {
        status: 'failed',
        artifacts_written: [],
        gate_path: resolveGatePath(runId, step),
        reasoning_path: null,
        token_usage: {
          used: 0,
          limit: 100000,
          source: 'estimate',
          confidence: 'low'
        },
        stderr: error.stderr || error.message,
        stdout: error.stdout || '',
        duration_ms: Date.now() - startTime,
        error: error.message
      };
    }
  }
}

/**
 * Agent Context Builder - Assembles context for agent execution
 */
export class AgentContextBuilder {
  /**
   * Build complete context for agent execution
   * @param {Object} params - Context parameters
   * @param {string} params.agent - Agent name
   * @param {string} params.runId - Run ID
   * @param {number} params.step - Step number
   * @param {string[]} params.injections - Constraint injections (e.g., ['architecture', 'style-guide'])
   * @returns {Promise<Object>} Assembled context
   */
  static async build({ agent, runId, step, injections = [] }) {
    // 1. System Prompt: Load agent persona
    const systemPrompt = await this.loadAgentPersona(agent);
    
    // 2. Constraint Block: Inject from architecture.json, project-rules.md, etc.
    const constraints = await this.loadConstraints(runId, injections);
    
    // 3. Task Block: Step-specific instructions
    const taskBlock = await this.buildTaskBlock(runId, step);
    
    // 4. Tool Definitions: Allowed tools for this agent
    const allowedTools = this.getAgentTools(agent);
    
    // 5. Message History: Previous context from run
    const messageHistory = await this.buildMessageHistory(runId, step);
    
    return {
      systemPrompt: `${systemPrompt}\n\n## Constraints\n${constraints}\n\n## Task\n${taskBlock}`,
      messages: messageHistory,
      tools: allowedTools
    };
  }
  
  /**
   * Load agent persona from agent file
   */
  static async loadAgentPersona(agentName) {
    try {
      const agentPath = resolve(__dirname, '..', 'agents', `${agentName}.md`);
      if (!existsSync(agentPath)) {
        throw new Error(`Agent file not found: ${agentName}.md (path: ${agentPath})`);
      }
      return await readFile(agentPath, 'utf-8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Agent file not found: ${agentName}.md. ${error.message}`);
      }
      throw new Error(`Failed to load agent persona for ${agentName}: ${error.message}`);
    }
  }
  
  /**
   * Load constraints from architecture, style guides, etc.
   */
  static async loadConstraints(runId, injections) {
    const constraints = [];
    const runDirs = getRunDirectoryStructure(runId);
    
    for (const injection of injections) {
      let constraintPath;
      switch (injection) {
        case 'architecture':
          constraintPath = resolveArtifactPath(runId, 'system-architecture.json');
          break;
        case 'style-guide':
          constraintPath = resolve(__dirname, '..', 'templates', 'project-constitution.md');
          break;
        case 'project-rules':
          constraintPath = resolve(__dirname, '..', 'templates', 'project-constitution.md');
          break;
        default:
          continue;
      }
      
      if (constraintPath && existsSync(constraintPath)) {
        try {
          const content = await readFile(constraintPath, 'utf-8');
          if (constraintPath.endsWith('.json')) {
            const json = JSON.parse(content);
            constraints.push(`From ${injection}: ${JSON.stringify(json, null, 2)}`);
          } else {
            constraints.push(`From ${injection}:\n${content}`);
          }
        } catch (error) {
          // Skip if can't read
        }
      }
    }
    
    return constraints.join('\n\n') || 'No additional constraints specified.';
  }
  
  /**
   * Build task block from step configuration
   */
  static async buildTaskBlock(runId, step) {
    const runRecord = await readRun(runId);
    // TODO: Load step configuration from workflow YAML
    // For now, return basic task description
    return `Execute step ${step} for run ${runId}`;
  }
  
  /**
   * Get allowed tools for agent
   */
  static getAgentTools(agentName) {
    // Default tools for all agents
    const defaultTools = ['Read', 'Write', 'Edit'];
    
    // Agent-specific tools
    const agentTools = {
      'developer': [...defaultTools, 'Bash', 'Task'],
      'architect': [...defaultTools, 'Task'],
      'planner': [...defaultTools, 'Task'],
      'qa': [...defaultTools, 'Bash'],
      'devops': [...defaultTools, 'Bash', 'Task']
    };
    
    return agentTools[agentName] || defaultTools;
  }
  
  /**
   * Build message history from run context
   */
  static async buildMessageHistory(runId, step) {
    // TODO: Load previous messages from run context
    // For now, return empty history
    return [];
  }
}

/**
 * Execute agent with proper context assembly
 * @param {Object} params - Execution parameters
 * @param {string} params.agent - Agent name
 * @param {string} params.runId - Run ID
 * @param {number} params.step - Step number
 * @param {string[]} params.injections - Constraint injections
 * @param {Object} params.workflowStep - Workflow step configuration
 * @returns {Promise<ExecutionResult>} Execution result
 */
export async function executeAgent(params) {
  const { agent, runId, step, injections = [], workflowStep = {} } = params;
  
  // Check for approval requirement
  if (workflowStep.requires_approval) {
    await requestApproval(runId, step, {
      reason: workflowStep.approval_reason || 'Step requires user approval',
      artifact: workflowStep.output || null
    });
    
    // Update dashboard
    await updateRunSummary(runId);
    
    return {
      status: 'awaiting_approval',
      artifacts_written: [],
      gate_path: resolveGatePath(runId, step),
      reasoning_path: null,
      token_usage: {
        used: 0,
        limit: 100000,
        source: 'estimate',
        confidence: 'low'
      },
      stderr: '',
      stdout: 'Execution paused - awaiting user approval',
      duration_ms: 0
    };
  }
  
  // Assemble context
  const context = await AgentContextBuilder.build({ agent, runId, step, injections });
  
  // Select adapter
  const adapters = [
    new ClaudeCodeAdapter(),
    new CLIAdapter()
  ];
  
  // Check adapter availability (async)
  let adapter = null;
  for (const a of adapters) {
    if (await a.isAvailable()) {
      adapter = a;
      break;
    }
  }
  if (!adapter) {
    throw new Error('No agent executor adapter available. Requires Claude Code or claude CLI.');
  }
  
  // Execute agent
  const result = await adapter.execute({
    agent,
    systemPrompt: context.systemPrompt,
    messages: context.messages,
    tools: context.tools,
    runId,
    step
  });
  
  // Enforce real artifact creation - no fake success
  if (result.status === 'completed') {
    // Verify artifacts were actually created
    const missingArtifacts = [];
    for (const artifactPath of result.artifacts_written || []) {
      if (artifactPath && !existsSync(artifactPath)) {
        missingArtifacts.push(artifactPath);
      }
    }
    
    // If no artifacts were written at all, fail
    if ((result.artifacts_written || []).length === 0) {
      return {
        ...result,
        status: 'failed',
        error: 'No artifacts were written - adapter must create artifacts or return failed status',
        artifacts_written: []
      };
    }
    
    // If any artifacts are missing, fail
    if (missingArtifacts.length > 0) {
      return {
        ...result,
        status: 'failed',
        error: `Required artifacts not created: ${missingArtifacts.join(', ')}`,
        artifacts_written: []
      };
    }
  }
  
  return result;
}

export default {
  executeAgent,
  AgentContextBuilder,
  AgentExecutorAdapter,
  ClaudeCodeAdapter,
  CLIAdapter
};

