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
import { createRun, readRun, updateRun, registerArtifact, getRunDirectoryStructure } from './run-manager.mjs';
import { routeWorkflow } from './workflow-router.mjs';
import { updateRunSummary } from './dashboard-generator.mjs';
import { exec } from 'child_process';
import { promisify } from 'util';
// Generate simple UUID-like ID
function generateSimpleId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Runtime capability matrix
const RUNTIME_CAPABILITIES = {
  claude_code: {
    spawnWindow: 'optional',
    readContext: 'required',
    invokeSubagents: 'required',
    persistState: 'required',
    clearContext: 'api_signal'
  },
  cli_wrapper: {
    spawnWindow: 'required',
    readContext: 'optional',
    invokeSubagents: 'required',
    persistState: 'required',
    clearContext: 'exit_code'
  },
  cursor: {
    spawnWindow: 'required',
    readContext: 'optional',
    invokeSubagents: 'optional',
    persistState: 'required',
    clearContext: 'not_supported'
  }
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
 * Execute step 0 via workflow runner
 */
async function executeStep0(runId, workflowPath) {
  const runtime = detectRuntime();
  const runDirs = getRunDirectoryStructure(runId);
  
  // Build command
  const workflowRunnerPath = join(__dirname, 'workflow_runner.js');
  const command = `node "${workflowRunnerPath}" --workflow "${workflowPath}" --step 0 --id "${runId}" --run-id "${runId}"`;
  
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: join(__dirname, '../..'),
      maxBuffer: 10 * 1024 * 1024 // 10MB
    });
    
    if (stderr) {
      console.warn(`Workflow runner stderr: ${stderr}`);
    }
    
    return {
      success: true,
      output: stdout,
      runId
    };
  } catch (error) {
    console.error(`Error executing step 0: ${error.message}`);
    throw error;
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
    /\/cuj-(\d{3})/i,           // /cuj-001
    /\bcuj-(\d{3})\b/i,          // CUJ-001 (standalone)
    /run\s+cuj-(\d{3})/i,        // run cuj-001
    /execute\s+cuj-(\d{3})/i,    // execute cuj-001
    /test\s+cuj-(\d{3})/i        // test cuj-001
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
        error: 'CUJ-INDEX.md not found'
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
        error: 'Run CUJ Mapping table not found'
      };
    }

    const mappingTable = runMappingMatch[1];

    // Parse table rows for the specific CUJ
    const rows = mappingTable.split('\n').filter(line => line.trim().startsWith('|'));

    // Skip header rows
    const dataRows = rows.slice(2);

    for (const row of dataRows) {
      const cells = row.split('|').map(cell => cell.trim()).filter(cell => cell);

      // Handle malformed rows gracefully
      if (cells.length < 4) {
        console.warn(`[CUJ Resolver] Skipping malformed row (expected 4+ columns, got ${cells.length}): ${row}`);
        continue;
      }

      // Validate required fields
      if (!cells[0] || !cells[1]) {
        console.warn(`[CUJ Resolver] Skipping row with missing required fields (CUJ ID or execution mode): ${row}`);
        continue;
      }

      if (cells[0] === cujId) {
        const executionMode = cells[1];
        const workflowPath = cells[2] && cells[2] !== '-' && cells[2] !== 'null' ? cells[2] : null;
        const primarySkill = cells[3] && cells[3] !== '-' && cells[3] !== 'null' ? cells[3] : null;

        // Validate execution mode
        const validModes = ['workflow', 'skill', 'manual', 'skill-only', 'manual-setup'];
        if (!validModes.includes(executionMode)) {
          console.warn(`[CUJ Resolver] Invalid execution mode '${executionMode}' for ${cujId}. Expected one of: ${validModes.join(', ')}`);
        }

        return {
          executionMode,
          workflowPath,
          primarySkill
        };
      }
    }

    // CUJ not found in mapping table
    console.warn(`[CUJ Resolver] ${cujId} not found in Run CUJ Mapping table`);
    return {
      executionMode: 'not_mapped',
      workflowPath: null,
      primarySkill: null,
      error: `${cujId} not found in mapping table`
    };

  } catch (error) {
    console.error(`[CUJ Resolver] Error reading CUJ-INDEX.md: ${error.message}`);
    return {
      executionMode: 'error',
      workflowPath: null,
      primarySkill: null,
      error: error.message
    };
  }
}

/**
 * Main entry point
 */
export async function processUserPrompt(userPrompt, options = {}) {
  const { runId: providedRunId } = options;
  const runtime = detectRuntime();

  console.log(`[Orchestrator Entry] Runtime detected: ${runtime}`);
  console.log(`[Orchestrator Entry] Processing prompt: ${userPrompt.substring(0, 100)}...`);

  // Generate or use provided run ID
  const runId = providedRunId || generateRunId();

  // Step 1: Create run
  console.log(`[Orchestrator Entry] Creating run: ${runId}`);
  const runRecord = await createRun(runId, {
    userRequest: userPrompt,
    sessionId: process.env.CLAUDE_CODE_SESSION_ID || process.env.CURSOR_SESSION_ID || null
  });

  // Step 2: Check for CUJ reference
  const cujId = detectCUJReference(userPrompt);
  let routingResult;

  if (cujId) {
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
        complexity: 'medium'
      };
    } else if (cujMapping.executionMode === 'skill' && cujMapping.primarySkill) {
      // Use CUJ-specified skill (route to skill-based workflow)
      routingResult = {
        selected_workflow: null,
        workflow_selection: null,
        routing_method: 'cuj_skill',
        cuj_id: cujId,
        primary_skill: cujMapping.primarySkill,
        confidence: 1.0,
        intent: `Execute ${cujId} via ${cujMapping.primarySkill} skill`,
        complexity: 'low'
      };

      console.log(`[Orchestrator Entry] CUJ uses skill: ${cujMapping.primarySkill}`);
      console.warn(`[Orchestrator Entry] Skill-based CUJ execution not yet implemented. Falling back to semantic routing.`);

      // Fall back to semantic routing for now
      try {
        routingResult = await routeWorkflow(userPrompt);
        routingResult.routing_method = 'semantic_fallback_from_cuj';
        routingResult.cuj_id = cujId;
      } catch (error) {
        console.error(`[Orchestrator Entry] Routing failed: ${error.message}`);
        await updateRun(runId, {
          status: 'failed',
          metadata: {
            error: error.message
          }
        });
        throw error;
      }
    } else {
      // CUJ mapping error or not found - fall back to semantic routing
      console.warn(`[Orchestrator Entry] CUJ mapping failed: ${cujMapping.error}. Falling back to semantic routing.`);

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
            error: error.message
          }
        });
        throw error;
      }
    }
  } else {
    // No CUJ reference - use standard semantic routing
    console.log(`[Orchestrator Entry] No CUJ reference detected. Using semantic routing.`);

    try {
      routingResult = await routeWorkflow(userPrompt);
    } catch (error) {
      console.error(`[Orchestrator Entry] Routing failed: ${error.message}`);
      await updateRun(runId, {
        status: 'failed',
        metadata: {
          error: error.message
        }
      });
      throw error;
    }
  }
  
  // Validate routing result
  if (!routingResult.selected_workflow && !routingResult.workflow_selection) {
    throw new Error('Router did not return a workflow selection');
  }
  
  const selectedWorkflow = routingResult.selected_workflow || routingResult.workflow_selection;
  
  // Save routing decision as artifact
  const routingArtifact = {
    name: 'route_decision.json',
    step: 0,
    agent: 'router',
    path: join(getRunDirectoryStructure(runId).artifacts_dir, 'route_decision.json'),
    dependencies: [],
    validationStatus: 'pass'
  };
  
  await writeFile(
    routingArtifact.path,
    JSON.stringify(routingResult, null, 2),
    'utf-8'
  );
  
  await registerArtifact(runId, routingArtifact);
  
  // Update run with workflow selection
  await updateRun(runId, {
    selected_workflow: selectedWorkflow,
    metadata: {
      routing_confidence: routingResult.confidence,
      routing_method: routingResult.routing_method || routingResult.method,
      intent: routingResult.intent,
      complexity: routingResult.complexity
    }
  });
  
  // Step 3: Execute step 0
  console.log(`[Orchestrator Entry] Executing step 0: ${selectedWorkflow}`);
  try {
    const stepResult = await executeStep0(runId, selectedWorkflow);
    
    // Step 4: Generate initial run-summary.md
    await updateRunSummary(runId);
    
    return {
      runId,
      routing: routingResult,
      step0Result: stepResult,
      runRecord: await readRun(runId)
    };
  } catch (error) {
    console.error(`[Orchestrator Entry] Step 0 execution failed: ${error.message}`);
    await updateRun(runId, {
      status: 'failed',
      metadata: {
        error: error.message,
        failed_at_step: 0
      }
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

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default {
  processUserPrompt,
  detectRuntime
};

