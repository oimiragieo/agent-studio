#!/usr/bin/env node
/**
 * Orchestrator Entry - Unified entry point for all runtimes
 *
 * Handles heavy orchestration: run creation, routing, step execution
 * Detects runtime (Claude Code, CLI, Cursor) and routes appropriately
 *
 * Usage:
 *   node orchestrator-entry.mjs --prompt "<user request>" [--run-id <id>]
 *   node orchestrator-entry.mjs --queue (reads from prompt queue)
 */

import { readFile, writeFile, mkdir, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import {
  createRun,
  readRun,
  updateRun,
  registerArtifact,
  getRunDirectoryStructure,
} from './run-manager.mjs';
import { routeWorkflow } from './workflow-router.mjs';
import { updateRunSummary } from './dashboard-generator.mjs';
import { detectAllSkills } from './skill-trigger-detector.mjs';
import { AgentSupervisor } from './workers/supervisor.mjs';
import { exec } from 'child_process';
import { promisify } from 'util';
// Generate simple UUID-like ID
function generateSimpleId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Feature flag for worker pattern (default: false for safe rollback)
const USE_WORKERS = process.env.USE_WORKERS === 'true' || false;

// Global supervisor instance (only when workers enabled)
let globalSupervisor = null;

// Runtime capability matrix
const RUNTIME_CAPABILITIES = {
  claude_code: {
    spawnWindow: 'optional',
    readContext: 'required',
    invokeSubagents: 'required',
    persistState: 'required',
    clearContext: 'api_signal',
  },
  cli_wrapper: {
    spawnWindow: 'required',
    readContext: 'optional',
    invokeSubagents: 'required',
    persistState: 'required',
    clearContext: 'exit_code',
  },
  cursor: {
    spawnWindow: 'required',
    readContext: 'optional',
    invokeSubagents: 'optional',
    persistState: 'required',
    clearContext: 'not_supported',
  },
};

/**
 * Detect runtime environment
 */
function detectRuntime() {
  // Check for Claude Code environment
  if (process.env.CLAUDE_CODE_SESSION_ID || process.env.CLAUDE_CODE) {
    return 'claude_code';
  }

  // Check for Cursor environment
  if (process.env.CURSOR_SESSION_ID || process.env.CURSOR) {
    return 'cursor';
  }

  // Default to CLI wrapper
  return 'cli_wrapper';
}

/**
 * Initialize supervisor for worker pattern
 * @returns {Promise<AgentSupervisor|null>}
 */
async function initializeSupervisor() {
  if (!USE_WORKERS) {
    console.log('[Orchestrator Entry] Worker pattern disabled (USE_WORKERS=false)');
    return null;
  }

  if (globalSupervisor) {
    return globalSupervisor;
  }

  console.log('[Orchestrator Entry] Initializing worker supervisor');
  globalSupervisor = new AgentSupervisor({
    maxWorkers: 4,
    heapLimit: 4096, // 4GB per worker
    timeout: 600000, // 10 minutes
  });

  await globalSupervisor.initialize();
  console.log('[Orchestrator Entry] Supervisor initialized successfully');

  return globalSupervisor;
}

/**
 * Determine if task should use worker pattern based on heuristics
 * @param {string} taskDescription - Task description
 * @param {number} complexity - Task complexity (0-1)
 * @returns {boolean}
 */
function isLongRunningTask(taskDescription, complexity = 0.5) {
  // Long-running keywords
  const longRunningKeywords = [
    'implement',
    'refactor',
    'analyze codebase',
    'migrate',
    'redesign',
    'architecture',
    'comprehensive',
    'extensive',
    'large-scale',
  ];

  // Short-running keywords
  const shortRunningKeywords = ['fix', 'update', 'add', 'remove', 'delete', 'rename', 'quick'];

  const lowerTask = taskDescription.toLowerCase();

  // Check for short-running indicators
  const hasShortKeywords = shortRunningKeywords.some(kw => lowerTask.includes(kw));
  if (hasShortKeywords && complexity < 0.5) {
    return false;
  }

  // Check for long-running indicators
  const hasLongKeywords = longRunningKeywords.some(kw => lowerTask.includes(kw));
  if (hasLongKeywords || complexity > 0.7) {
    return true;
  }

  // Default: use complexity threshold
  return complexity > 0.6;
}

/**
 * Aggregate costs from router and orchestrator sessions
 * @param {Object|null} routerCosts - Cost tracking from router session
 * @param {Object} orchestratorCosts - Cost tracking from orchestrator session
 * @returns {Object} Aggregated cost summary
 */
function aggregateCostsFromRouter(routerCosts, orchestratorCosts = {}) {
  if (!routerCosts) {
    return {
      router: null,
      orchestrator: orchestratorCosts,
      total: orchestratorCosts.total_cost_usd || 0,
    };
  }

  return {
    router: {
      total_cost_usd: routerCosts.total_cost_usd || 0,
      total_input_tokens: routerCosts.total_input_tokens || 0,
      total_output_tokens: routerCosts.total_output_tokens || 0,
      model_usage: routerCosts.model_usage || [],
    },
    orchestrator: {
      total_cost_usd: orchestratorCosts.total_cost_usd || 0,
      total_input_tokens: orchestratorCosts.total_input_tokens || 0,
      total_output_tokens: orchestratorCosts.total_output_tokens || 0,
      model_usage: orchestratorCosts.model_usage || [],
    },
    total: (routerCosts.total_cost_usd || 0) + (orchestratorCosts.total_cost_usd || 0),
  };
}

/**
 * Read prompt from queue
 */
async function readPromptQueue() {
  const queueDir = join(__dirname, '..', 'context', 'queue');
  const queueFile = join(queueDir, 'incoming-prompt.json');

  if (!existsSync(queueFile)) {
    return null;
  }

  try {
    const content = await readFile(queueFile, 'utf-8');
    const prompt = JSON.parse(content);

    // Move to processed (optional - could append timestamp)
    const processedFile = join(queueDir, `processed-${Date.now()}.json`);
    await writeFile(processedFile, content, 'utf-8');

    // Clear queue file
    await writeFile(queueFile, '{}', 'utf-8');

    return prompt;
  } catch (error) {
    console.error(`Error reading prompt queue: ${error.message}`);
    return null;
  }
}

/**
 * Generate run ID
 */
function generateRunId() {
  return `run-${Date.now()}-${generateSimpleId().substring(0, 8)}`;
}

/**
 * Detect and log triggered skills for a task
 * @param {string} agentType - Agent type (e.g., "developer", "orchestrator")
 * @param {string} taskDescription - Task description to match against triggers
 * @param {string} runId - Run ID for logging
 * @returns {Promise<Object>} Triggered skills info
 */
async function detectAndLogSkills(agentType, taskDescription, runId) {
  try {
    const skillsInfo = await detectAllSkills(agentType, taskDescription);

    // Log triggered skills
    console.log(`[Orchestrator Entry] Skill detection for ${agentType}:`);
    console.log(`  Required skills: ${skillsInfo.required.join(', ') || 'none'}`);
    console.log(`  Triggered skills: ${skillsInfo.triggered.join(', ') || 'none'}`);
    console.log(`  Recommended skills: ${skillsInfo.recommended.join(', ') || 'none'}`);
    console.log(`  Matched triggers: ${skillsInfo.matchedTriggers.join(', ') || 'none'}`);

    // Save skill detection artifact
    const runDirs = getRunDirectoryStructure(runId);
    const skillArtifactPath = join(runDirs.artifacts_dir, 'skill-detection.json');

    await writeFile(
      skillArtifactPath,
      JSON.stringify(
        {
          agent: agentType,
          task: taskDescription,
          detection_timestamp: new Date().toISOString(),
          ...skillsInfo,
        },
        null,
        2
      ),
      'utf-8'
    );

    // Register artifact
    await registerArtifact(runId, {
      name: 'skill-detection.json',
      step: 0,
      agent: 'orchestrator',
      path: skillArtifactPath,
      dependencies: [],
      validationStatus: 'pass',
    });

    return skillsInfo;
  } catch (error) {
    console.error(`[Orchestrator Entry] Skill detection failed: ${error.message}`);
    // Non-fatal error - continue execution
    return {
      required: [],
      triggered: [],
      recommended: [],
      all: [],
      matchedTriggers: [],
      error: error.message,
    };
  }
}

/**
 * Execute step 0 via workflow runner (legacy in-process execution)
 */
async function executeStep0Legacy(runId, workflowPath) {
  const runtime = detectRuntime();
  const runDirs = getRunDirectoryStructure(runId);

  // Build command
  const workflowRunnerPath = join(__dirname, 'workflow_runner.js');
  const command = `node "${workflowRunnerPath}" --workflow "${workflowPath}" --step 0 --id "${runId}" --run-id "${runId}"`;

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: join(__dirname, '../..'),
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });

    if (stderr) {
      console.warn(`Workflow runner stderr: ${stderr}`);
    }

    return {
      success: true,
      output: stdout,
      runId,
    };
  } catch (error) {
    console.error(`Error executing step 0: ${error.message}`);
    throw error;
  }
}

/**
 * Execute step 0 via worker thread (when USE_WORKERS enabled)
 */
async function executeStep0Worker(runId, workflowPath, taskDescription, complexity) {
  const supervisor = await initializeSupervisor();
  if (!supervisor) {
    throw new Error('Supervisor not initialized');
  }

  console.log('[Orchestrator Entry] Spawning worker for step 0');

  // Spawn worker with workflow execution task
  const sessionId = await supervisor.spawnWorker('orchestrator', taskDescription, {
    runId,
    workflowPath,
    step: 0,
    executionMode: 'workflow',
  });

  console.log(`[Orchestrator Entry] Worker spawned: ${sessionId}`);

  // Wait for worker completion
  try {
    const result = await supervisor.waitForCompletion(sessionId, {
      timeout: 600000, // 10 minutes
    });

    console.log(`[Orchestrator Entry] Worker completed: ${sessionId}`);

    return {
      success: true,
      output: result.result || result,
      runId,
      sessionId,
      executionMode: 'worker',
    };
  } catch (error) {
    console.error(`[Orchestrator Entry] Worker execution failed: ${error.message}`);
    throw error;
  }
}

/**
 * Execute step 0 with conditional worker usage
 */
async function executeStep0(runId, workflowPath, taskDescription = '', complexity = 0.5) {
  if (USE_WORKERS && isLongRunningTask(taskDescription, complexity)) {
    console.log('[Orchestrator Entry] Using worker pattern for long-running task');
    return await executeStep0Worker(runId, workflowPath, taskDescription, complexity);
  } else {
    const reason = USE_WORKERS
      ? 'task is short-running'
      : 'worker pattern disabled (USE_WORKERS=false)';
    console.log(`[Orchestrator Entry] Using legacy in-process execution (${reason})`);
    return await executeStep0Legacy(runId, workflowPath);
  }
}

/**
 * Detect CUJ reference in user prompt
 * Supports formats: /cuj-001, CUJ-001, run cuj-001, execute CUJ-001
 * @param {string} userPrompt - The user's request
 * @returns {string|null} - CUJ ID if found, null otherwise
 */
export function detectCUJReference(userPrompt) {
  // Regex patterns for CUJ references
  const patterns = [
    /\/cuj-(\d{3})/i, // /cuj-001
    /\bcuj-(\d{3})\b/i, // CUJ-001 (standalone)
    /run\s+cuj-(\d{3})/i, // run cuj-001
    /execute\s+cuj-(\d{3})/i, // execute cuj-001
    /test\s+cuj-(\d{3})/i, // test cuj-001
  ];

  for (const pattern of patterns) {
    const match = userPrompt.match(pattern);
    if (match) {
      const cujNumber = match[1];
      return `CUJ-${cujNumber}`;
    }
  }

  return null;
}

/**
 * Resolve CUJ execution mode by parsing CUJ-INDEX.md
 * @param {string} cujId - CUJ ID (e.g., "CUJ-001")
 * @returns {Promise<{executionMode: string, workflowPath: string|null, primarySkill: string|null}>}
 */
export async function resolveCUJExecutionMode(cujId) {
  const cujIndexPath = join(__dirname, '..', 'docs', 'cujs', 'CUJ-INDEX.md');

  try {
    // Check if CUJ-INDEX.md exists
    if (!existsSync(cujIndexPath)) {
      console.warn(`[CUJ Resolver] CUJ-INDEX.md not found at ${cujIndexPath}`);
      return {
        executionMode: 'not_found',
        workflowPath: null,
        primarySkill: null,
        error: 'CUJ-INDEX.md not found',
      };
    }

    // Read CUJ-INDEX.md
    const indexContent = await readFile(cujIndexPath, 'utf-8');

    // Parse the "Run CUJ Mapping" table
    const runMappingMatch = indexContent.match(/## Run CUJ Mapping\s+([\s\S]*?)(?=\n##|$)/);

    if (!runMappingMatch) {
      console.warn(`[CUJ Resolver] Run CUJ Mapping table not found in CUJ-INDEX.md`);
      return {
        executionMode: 'mapping_not_found',
        workflowPath: null,
        primarySkill: null,
        error: 'Run CUJ Mapping table not found',
      };
    }

    const mappingTable = runMappingMatch[1];

    // Parse table rows for the specific CUJ
    const rows = mappingTable.split('\n').filter(line => line.trim().startsWith('|'));

    // Skip header rows
    const dataRows = rows.slice(2);

    for (const row of dataRows) {
      const cells = row
        .split('|')
        .map(cell => cell.trim())
        .filter(cell => cell);

      // Handle malformed rows gracefully
      if (cells.length < 4) {
        console.warn(
          `[CUJ Resolver] Skipping malformed row (expected 4+ columns, got ${cells.length}): ${row}`
        );
        continue;
      }

      // Validate required fields
      if (!cells[0] || !cells[1]) {
        console.warn(
          `[CUJ Resolver] Skipping row with missing required fields (CUJ ID or execution mode): ${row}`
        );
        continue;
      }

      if (cells[0] === cujId) {
        const executionMode = cells[1];
        const workflowPath = cells[2] && cells[2] !== '-' && cells[2] !== 'null' ? cells[2] : null;
        const primarySkill = cells[3] && cells[3] !== '-' && cells[3] !== 'null' ? cells[3] : null;

        // Validate execution mode
        const validModes = ['workflow', 'skill-only', 'manual', 'manual-setup'];
        if (!validModes.includes(executionMode)) {
          console.warn(
            `[CUJ Resolver] Invalid execution mode '${executionMode}' for ${cujId}. Expected one of: ${validModes.join(', ')}`
          );
        }

        return {
          executionMode,
          workflowPath,
          primarySkill,
        };
      }
    }

    // CUJ not found in mapping table
    console.warn(`[CUJ Resolver] ${cujId} not found in Run CUJ Mapping table`);
    return {
      executionMode: 'not_mapped',
      workflowPath: null,
      primarySkill: null,
      error: `${cujId} not found in mapping table`,
    };
  } catch (error) {
    console.error(`[CUJ Resolver] Error reading CUJ-INDEX.md: ${error.message}`);
    return {
      executionMode: 'error',
      workflowPath: null,
      primarySkill: null,
      error: error.message,
    };
  }
}

/**
 * Main entry point
 * @param {string} userPrompt - User's request
 * @param {Object} options - Options including runId and sessionContext
 * @param {Object|null} routingDecision - Optional routing decision from router session
 * @returns {Promise<Object>} Execution result
 */
export async function processUserPrompt(userPrompt, options = {}, routingDecision = null) {
  const { runId: providedRunId, sessionContext } = options;
  const runtime = detectRuntime();

  console.log(`[Orchestrator Entry] Runtime detected: ${runtime}`);
  console.log(`[Orchestrator Entry] Processing prompt: ${userPrompt.substring(0, 100)}...`);

  // Handle router session handoff
  if (routingDecision) {
    console.log(`[Orchestrator Entry] Router session handoff detected`);
    console.log(`[Orchestrator Entry] Intent: ${routingDecision.intent}`);
    console.log(
      `[Orchestrator Entry] Workflow: ${routingDecision.workflow || routingDecision.selected_workflow || 'none'}`
    );
    console.log(`[Orchestrator Entry] Complexity: ${routingDecision.complexity}`);
    console.log(`[Orchestrator Entry] Skipping redundant semantic routing`);
  }

  // Generate or use provided run ID
  const runId = providedRunId || generateRunId();

  // Step 1: Create run
  console.log(`[Orchestrator Entry] Creating run: ${runId}`);

  // Transfer session context from router if available
  const runMetadata = {
    userRequest: userPrompt,
    sessionId: process.env.CLAUDE_CODE_SESSION_ID || process.env.CURSOR_SESSION_ID || null,
  };

  if (sessionContext) {
    console.log(`[Orchestrator Entry] Transferring session context from router`);
    runMetadata.routerHandoff = {
      timestamp: new Date().toISOString(),
      sessionId: sessionContext.session_id,
      routerModel: sessionContext.router_classification?.model || 'claude-3-5-haiku-20241022',
      routingDecision,
      accumulatedCosts: sessionContext.cost_tracking || null,
    };
  }

  const runRecord = await createRun(runId, runMetadata);

  // Step 2: Routing logic (skip if router already decided)
  const cujId = detectCUJReference(userPrompt);
  let routingResult;
  let skipSemanticRouting = false;

  // Use routing decision from router if provided
  if (routingDecision) {
    const workflow = routingDecision.workflow || routingDecision.selected_workflow;

    if (workflow) {
      console.log(`[Orchestrator Entry] Using workflow from router: ${workflow}`);
      routingResult = {
        selected_workflow: workflow,
        workflow_selection: workflow,
        routing_method: 'router_handoff',
        intent: routingDecision.intent,
        complexity: routingDecision.complexity,
        confidence: routingDecision.confidence || 0.9,
        router_session_id: sessionContext?.session_id || null,
      };
      skipSemanticRouting = true;
    }
  }

  if (!skipSemanticRouting && cujId) {
    console.log(`[Orchestrator Entry] CUJ reference detected: ${cujId}`);

    // Resolve CUJ execution mode
    const cujMapping = await resolveCUJExecutionMode(cujId);
    console.log(`[Orchestrator Entry] CUJ mapping resolved:`, cujMapping);

    if (cujMapping.executionMode === 'workflow' && cujMapping.workflowPath) {
      // Use CUJ-specified workflow
      routingResult = {
        selected_workflow: cujMapping.workflowPath,
        workflow_selection: cujMapping.workflowPath,
        routing_method: 'cuj_mapping',
        cuj_id: cujId,
        confidence: 1.0,
        intent: `Execute ${cujId}`,
        complexity: 'medium',
      };
    } else if (cujMapping.executionMode === 'skill-only' && cujMapping.primarySkill) {
      // Skill-only CUJ execution - direct skill invocation without workflow
      console.log(
        `[Orchestrator Entry] Executing skill-only CUJ: ${cujId} via ${cujMapping.primarySkill} skill`
      );

      try {
        // Import and execute the skill directly
        const skillPath = join(__dirname, '..', 'skills', cujMapping.primarySkill, 'SKILL.md');

        if (!existsSync(skillPath)) {
          throw new Error(`Skill not found: ${cujMapping.primarySkill} at ${skillPath}`);
        }

        // For skill-only execution, we create a minimal routing result
        // that indicates no workflow is needed
        routingResult = {
          selected_workflow: null,
          workflow_selection: null,
          routing_method: 'skill_only',
          cuj_id: cujId,
          primary_skill: cujMapping.primarySkill,
          confidence: 1.0,
          intent: `Execute ${cujId} via ${cujMapping.primarySkill} skill (direct invocation)`,
          complexity: 'low',
          skill_execution_mode: 'direct',
        };

        // Save routing decision
        const routingArtifact = {
          name: 'route_decision.json',
          step: 0,
          agent: 'router',
          path: join(getRunDirectoryStructure(runId).artifacts_dir, 'route_decision.json'),
          dependencies: [],
          validationStatus: 'pass',
        };

        await writeFile(routingArtifact.path, JSON.stringify(routingResult, null, 2), 'utf-8');

        await registerArtifact(runId, routingArtifact);

        // Update run with skill-only execution mode
        await updateRun(runId, {
          selected_workflow: null,
          execution_mode: 'skill_only',
          primary_skill: cujMapping.primarySkill,
          metadata: {
            routing_confidence: routingResult.confidence,
            routing_method: 'skill_only',
            intent: routingResult.intent,
            complexity: routingResult.complexity,
            cuj_id: cujId,
          },
        });

        // For skill-only CUJs, return early with skill invocation instructions
        console.log(`[Orchestrator Entry] Skill-only CUJ ${cujId} prepared for execution`);
        console.log(`[Orchestrator Entry] User should invoke: Skill: ${cujMapping.primarySkill}`);

        // Generate initial run-summary.md
        await updateRunSummary(runId);

        // Aggregate costs if router session provided
        const aggregatedCosts = sessionContext
          ? aggregateCostsFromRouter(sessionContext.cost_tracking)
          : null;

        return {
          runId,
          routing: routingResult,
          executionMode: 'skill_only',
          primarySkill: cujMapping.primarySkill,
          skillInvocationCommand: `Skill: ${cujMapping.primarySkill}`,
          message: `CUJ ${cujId} is skill-only. Invoke with: Skill: ${cujMapping.primarySkill}`,
          runRecord: await readRun(runId),
          costs: aggregatedCosts,
        };
      } catch (error) {
        console.error(`[Orchestrator Entry] Skill-only execution failed: ${error.message}`);
        await updateRun(runId, {
          status: 'failed',
          metadata: {
            error: error.message,
            failed_at_stage: 'skill_only_preparation',
          },
        });
        throw error;
      }
    } else {
      // CUJ mapping error or not found - fall back to semantic routing
      console.warn(
        `[Orchestrator Entry] CUJ mapping failed: ${cujMapping.error}. Falling back to semantic routing.`
      );

      try {
        routingResult = await routeWorkflow(userPrompt);
        routingResult.routing_method = 'semantic_fallback_from_cuj';
        routingResult.cuj_id = cujId;
        routingResult.cuj_error = cujMapping.error;
      } catch (error) {
        console.error(`[Orchestrator Entry] Routing failed: ${error.message}`);
        await updateRun(runId, {
          status: 'failed',
          metadata: {
            error: error.message,
          },
        });
        throw error;
      }
    }
  } else if (!skipSemanticRouting) {
    // No CUJ reference and no router decision - use standard semantic routing
    console.log(`[Orchestrator Entry] No CUJ reference detected. Using semantic routing.`);

    try {
      routingResult = await routeWorkflow(userPrompt);
    } catch (error) {
      console.error(`[Orchestrator Entry] Routing failed: ${error.message}`);
      await updateRun(runId, {
        status: 'failed',
        metadata: {
          error: error.message,
        },
      });
      throw error;
    }
  }

  // Validate routing result (allow null workflow for skill-only execution)
  const isSkillOnly = routingResult.routing_method === 'skill_only';

  if (!isSkillOnly && !routingResult.selected_workflow && !routingResult.workflow_selection) {
    throw new Error('Router did not return a workflow selection');
  }

  const selectedWorkflow = routingResult.selected_workflow || routingResult.workflow_selection;

  // Save routing decision as artifact (if not already saved by skill-only path)
  if (!isSkillOnly) {
    const routingArtifact = {
      name: 'route_decision.json',
      step: 0,
      agent: 'router',
      path: join(getRunDirectoryStructure(runId).artifacts_dir, 'route_decision.json'),
      dependencies: [],
      validationStatus: 'pass',
    };

    await writeFile(routingArtifact.path, JSON.stringify(routingResult, null, 2), 'utf-8');

    await registerArtifact(runId, routingArtifact);
  }

  // Update run with workflow selection (if not already updated by skill-only path)
  if (!isSkillOnly) {
    await updateRun(runId, {
      selected_workflow: selectedWorkflow,
      metadata: {
        routing_confidence: routingResult.confidence,
        routing_method: routingResult.routing_method || routingResult.method,
        intent: routingResult.intent,
        complexity: routingResult.complexity,
      },
    });
  }

  // Step 2.5: Detect triggered skills for orchestrator
  console.log(`[Orchestrator Entry] Detecting triggered skills for orchestrator`);
  const skillsInfo = await detectAndLogSkills('orchestrator', userPrompt, runId);

  // Step 3: Execute step 0 (skip for skill-only CUJs)
  if (isSkillOnly) {
    console.log(`[Orchestrator Entry] Skipping step 0 execution (skill-only mode)`);

    // Generate initial run-summary.md
    await updateRunSummary(runId);

    // Aggregate costs if router session provided
    const aggregatedCosts = sessionContext
      ? aggregateCostsFromRouter(sessionContext.cost_tracking)
      : null;

    return {
      runId,
      routing: routingResult,
      executionMode: 'skill_only',
      primarySkill: routingResult.primary_skill,
      skillInvocationCommand: `Skill: ${routingResult.primary_skill}`,
      message: `Skill-only execution prepared. Invoke with: Skill: ${routingResult.primary_skill}`,
      runRecord: await readRun(runId),
      costs: aggregatedCosts,
    };
  }

  console.log(`[Orchestrator Entry] Executing step 0: ${selectedWorkflow}`);
  try {
    // Pass task description and complexity for worker decision
    const taskComplexity = routingResult.complexity
      ? routingResult.complexity === 'high'
        ? 0.8
        : routingResult.complexity === 'medium'
          ? 0.5
          : 0.3
      : 0.5;

    const stepResult = await executeStep0(runId, selectedWorkflow, userPrompt, taskComplexity);

    // Step 4: Generate initial run-summary.md
    await updateRunSummary(runId);

    // Aggregate costs if router session provided
    const aggregatedCosts = sessionContext
      ? aggregateCostsFromRouter(sessionContext.cost_tracking)
      : null;

    return {
      runId,
      routing: routingResult,
      step0Result: stepResult,
      runRecord: await readRun(runId),
      costs: aggregatedCosts,
      executionMode: stepResult.executionMode || 'legacy',
    };
  } catch (error) {
    console.error(`[Orchestrator Entry] Step 0 execution failed: ${error.message}`);
    await updateRun(runId, {
      status: 'failed',
      metadata: {
        error: error.message,
        failed_at_step: 0,
      },
    });
    throw error;
  }
}

/**
 * CLI interface
 */
async function main() {
  const args = process.argv.slice(2);
  const promptIndex = args.indexOf('--prompt');
  const queueFlag = args.includes('--queue');
  const runIdIndex = args.indexOf('--run-id');

  let userPrompt = null;
  let runId = null;

  if (runIdIndex !== -1 && runIdIndex + 1 < args.length) {
    runId = args[runIdIndex + 1];
  }

  if (queueFlag) {
    // Read from queue
    const promptData = await readPromptQueue();
    if (!promptData || !promptData.prompt) {
      console.error('No prompt found in queue');
      process.exit(1);
    }
    userPrompt = promptData.prompt;
  } else if (promptIndex !== -1 && promptIndex + 1 < args.length) {
    // Read from command line
    userPrompt = args[promptIndex + 1];
  } else {
    console.error('Usage:');
    console.error('  node orchestrator-entry.mjs --prompt "<user request>" [--run-id <id>]');
    console.error('  node orchestrator-entry.mjs --queue [--run-id <id>]');
    process.exit(1);
  }

  try {
    const result = await processUserPrompt(userPrompt, { runId });
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Cleanup handler for supervisor
process.on('exit', async () => {
  if (globalSupervisor) {
    console.log('[Orchestrator Entry] Cleaning up supervisor on exit');
    await globalSupervisor.cleanup();
  }
});

process.on('SIGINT', async () => {
  if (globalSupervisor) {
    console.log('[Orchestrator Entry] SIGINT received, cleaning up supervisor');
    await globalSupervisor.cleanup();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  if (globalSupervisor) {
    console.log('[Orchestrator Entry] SIGTERM received, cleaning up supervisor');
    await globalSupervisor.cleanup();
  }
  process.exit(0);
});

// Export helper functions for testing
export { detectRuntime, initializeSupervisor, isLongRunningTask };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

// Default export for backward compatibility
export default {
  processUserPrompt,
  detectRuntime,
  initializeSupervisor,
  isLongRunningTask,
};
