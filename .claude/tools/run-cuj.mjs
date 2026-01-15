#!/usr/bin/env node
/**
 * User-facing CUJ execution wrapper
 * Usage:
 *   node .claude/tools/run-cuj.mjs CUJ-005
 *   node .claude/tools/run-cuj.mjs --list
 *   node .claude/tools/run-cuj.mjs --simulate CUJ-005
 *   node .claude/tools/run-cuj.mjs --validate CUJ-005
 *   node .claude/tools/run-cuj.mjs --no-cache CUJ-005        # Disable skill caching
 *   node .claude/tools/run-cuj.mjs --cache-stats             # Show cache statistics
 *   node .claude/tools/run-cuj.mjs --no-analytics CUJ-005    # Skip analytics logging
 *   node .claude/tools/run-cuj.mjs --no-side-effects CUJ-005 # Read-only mode
 *   node .claude/tools/run-cuj.mjs --ci CUJ-005              # CI mode (no analytics/side effects)
 */

import fs from 'fs';
import path from 'path';
import { spawn, exec } from 'child_process';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import {
  getCachedResult,
  setCachedResult,
  getCacheStats,
  pruneExpiredCache,
} from './skill-cache.mjs';
import { parseLargeJSON, shouldUseStreaming } from './streaming-json-parser.mjs';
import {
  startMonitoring,
  stopMonitoring,
  logMemoryUsage,
  canSpawnSubagent,
} from './memory-monitor.mjs';
import { cleanupAllCaches, setupPeriodicCleanup } from './memory-cleanup.mjs';
import { setupMemoryPressureHandling } from './memory-pressure-handler.mjs';
import {
  resolveConfigPath,
  resolveRuntimePath,
  migrateIfNeeded,
  LEGACY_PATHS,
} from './context-path-resolver.mjs';
import { readRun } from './run-manager.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const execPromise = promisify(exec);
const projectRoot = path.join(__dirname, '../..');
const registryPath = resolveConfigPath('cuj-registry.json', { read: true });

// CI-friendly flags for read-only operation - parse BEFORE any side effects
const ciMode = process.argv.includes('--ci');
const noAnalytics = process.argv.includes('--no-analytics') || ciMode;
const noSideEffects = process.argv.includes('--no-side-effects') || ciMode;

// Analytics path: use resolver for reads, but ensure writes go to canonical
// Lazy evaluation to avoid dir creation at import time in --no-side-effects mode
let analyticsPath = null;
function getAnalyticsPath() {
  if (analyticsPath) return analyticsPath;

  const legacyAnalyticsPath = path.join(LEGACY_PATHS.runtime, 'analytics/cuj-performance.json');
  const canonicalAnalyticsPath = !noSideEffects
    ? resolveRuntimePath('analytics/cuj-performance.json', { read: false })
    : null;

  // Migrate analytics if needed (idempotent) - only if not in read-only mode
  if (!noSideEffects) {
    migrateIfNeeded(legacyAnalyticsPath, canonicalAnalyticsPath, { mergePolicy: 'prefer-newer' });
  }

  // For reads, use resolver (falls back to legacy if canonical doesn't exist)
  analyticsPath = resolveRuntimePath('analytics/cuj-performance.json', { read: true });
  return analyticsPath;
}

// Minimal lifecycle logging for integration tests + operational visibility
let lifecycleCleanupLogged = false;
function logLifecycle(message) {
  console.log(`[Lifecycle] ${message}`);
}
function logCleanupOnce() {
  if (lifecycleCleanupLogged) return;
  lifecycleCleanupLogged = true;
  logLifecycle('Starting cleanup');
  logLifecycle('cleanup');
}

process.on('exit', () => {
  logCleanupOnce();
});

process.on('SIGTERM', () => {
  logCleanupOnce();
  process.exit(1);
});

// Cache configuration
const SKILL_CACHE_TTL_MS = 3600000; // 1 hour default
// Disable cache writes in CI/read-only mode to make --ci/--no-side-effects truly side-effect-free
const cacheEnabled =
  !process.argv.includes('--no-cache') && !process.env.NO_SKILL_CACHE && !noSideEffects;

// Subagent spawning limits
const MAX_CONCURRENT_SUBAGENTS = 3;
let activeSubagents = 0;

async function loadRegistry() {
  if (shouldUseStreaming(registryPath, 1)) {
    return await parseLargeJSON(registryPath);
  } else {
    return JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
  }
}

/**
 * Spawn subagent with concurrency limiting
 * @param {string[]} args - Arguments to pass to spawn
 * @param {Object} options - Spawn options
 * @param {number} options.timeout - Maximum wait time in milliseconds (default: 30s)
 * @returns {Promise<Object>} Child process object
 */
async function spawnSubagentWithLimit(args, options = {}) {
  const { timeout = 30000 } = options;
  const startTime = Date.now();

  // Wait for available slot
  while (activeSubagents >= MAX_CONCURRENT_SUBAGENTS) {
    if (Date.now() - startTime > timeout) {
      throw new Error(`Timeout waiting for subagent slot after ${timeout}ms`);
    }
    // Wait for 100ms before checking again
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Increment counter before spawning
  activeSubagents++;
  console.log(`[Spawn] Active subagents: ${activeSubagents}/${MAX_CONCURRENT_SUBAGENTS}`);

  // Spawn child process
  const child = spawn('node', args, { stdio: 'inherit' });

  // Decrement counter when child exits
  child.on('exit', code => {
    activeSubagents--;
    console.log(
      `[Spawn] Subagent exited (code: ${code}), active: ${activeSubagents}/${MAX_CONCURRENT_SUBAGENTS}`
    );
  });

  return child;
}

/**
 * Execute a skill with caching support
 * @param {string} skillName - Name of the skill to execute
 * @param {Object} params - Skill parameters
 * @param {Object} options - Execution options
 * @param {boolean} options.cache - Whether to use caching (default: true)
 * @param {number} options.ttlMs - Cache TTL in milliseconds
 * @param {Function} options.executor - Function to execute the skill
 * @returns {Promise<Object>} Skill execution result
 */
async function executeSkillWithCache(skillName, params, options = {}) {
  const { cache = cacheEnabled, ttlMs = SKILL_CACHE_TTL_MS, executor } = options;

  if (!executor || typeof executor !== 'function') {
    throw new Error('executor function is required for skill execution');
  }

  // Check cache first
  if (cache) {
    const cached = getCachedResult(skillName, params, ttlMs);
    if (cached) {
      console.log(`  [CACHE HIT] ${skillName} (saved ~${cached._cached_duration_ms || 0}ms)`);
      return { ...cached, _from_cache: true };
    }
    console.log(`  [CACHE MISS] ${skillName}`);
  }

  // Execute skill and measure time
  const startTime = Date.now();
  const result = await executor(skillName, params);
  const duration = Date.now() - startTime;

  // Cache successful results
  if (cache && result && !result.error) {
    setCachedResult(skillName, params, { ...result, _cached_duration_ms: duration });
    console.log(`  [CACHED] ${skillName} (${duration}ms)`);
  }

  return { ...result, _from_cache: false, _duration_ms: duration };
}

/**
 * Display cache statistics
 */
function showCacheStats() {
  const stats = getCacheStats();
  console.log('\n📊 Skill Cache Statistics:\n');
  console.log(`  Files:        ${stats.files}`);
  console.log(`  Total Size:   ${stats.totalSizeMB || '0.00'} MB`);
  console.log(`  Oldest Entry: ${stats.oldest || 'N/A'}`);
  console.log(`  Newest Entry: ${stats.newest || 'N/A'}`);

  // Prune expired entries
  const pruned = pruneExpiredCache(SKILL_CACHE_TTL_MS);
  if (pruned > 0) {
    console.log(`\n  Pruned ${pruned} expired entries`);
  }

  console.log('');
}

/**
 * Find skill path in both Agent Studio and Codex locations
 * @param {string} skillName - Name of the skill
 * @returns {Object|null} - { path, type } or null if not found
 */
function findSkillPath(skillName) {
  const agentStudioPath = path.join(projectRoot, '.claude/skills', skillName, 'SKILL.md');
  const codexPath = path.join(projectRoot, 'codex-skills', skillName, 'SKILL.md');

  if (fs.existsSync(agentStudioPath)) {
    return { path: agentStudioPath, type: 'agent-studio' };
  }
  if (fs.existsSync(codexPath)) {
    return { path: codexPath, type: 'codex' };
  }
  return null;
}

/**
 * Check if a CLI tool is available
 * @param {string} cli - CLI tool name (e.g., 'claude', 'gemini')
 * @returns {Promise<Object>} - { available: boolean, version?: string, error?: string }
 */
async function checkCliAvailability(cli) {
  try {
    // Windows-friendly: use shell: true to handle .cmd shims
    const result = await execPromise(`${cli} --version`, {
      timeout: 5000,
      shell: true,
      windowsHide: true,
    });
    return {
      available: true,
      version: result.stdout.trim() || result.stderr.trim(),
    };
  } catch (error) {
    return {
      available: false,
      error: error.code === 'ENOENT' ? `${cli} command not found` : error.message,
    };
  }
}

/**
 * Pre-flight check before CUJ execution
 * Validates workflow, agents, schemas, artifacts, and skills
 */
async function preflightCheck(cuj) {
  const errors = [];
  const warnings = [];

  // 1. Verify workflow file exists (if workflow mode)
  if (cuj.workflow) {
    let workflowPath;
    if (cuj.workflow.startsWith('.claude/workflows/')) {
      workflowPath = path.join(projectRoot, cuj.workflow);
    } else {
      workflowPath = path.join(projectRoot, '.claude/workflows', cuj.workflow);
    }

    if (!fs.existsSync(workflowPath)) {
      errors.push(`Workflow file not found: ${workflowPath}`);
    } else {
      // Parse workflow YAML to check for referenced agents
      const workflowContent = fs.readFileSync(workflowPath, 'utf-8');

      // Extract agents from workflow (basic YAML parsing)
      const agentMatches = workflowContent.matchAll(/agent:\s+([a-z-]+)/g);
      const agents = [...agentMatches].map(m => m[1]);

      // 2. Check all referenced agents exist
      for (const agent of agents) {
        const agentPath = path.join(projectRoot, '.claude/agents', `${agent}.md`);
        if (!fs.existsSync(agentPath)) {
          errors.push(`Agent not found: ${agent} (referenced in workflow ${cuj.workflow})`);
        }
      }

      // 3. Validate all schemas exist (basic YAML parsing)
      const schemaMatches = workflowContent.matchAll(/schema:\s+([a-z-_.]+\.schema\.json)/g);
      const schemas = [...schemaMatches].map(m => m[1]);

      for (const schema of schemas) {
        const schemaPath = path.join(projectRoot, '.claude/schemas', schema);
        if (!fs.existsSync(schemaPath)) {
          errors.push(`Schema not found: ${schema} (referenced in workflow ${cuj.workflow})`);
        }
      }

      // 4. Check artifact dependencies (basic YAML parsing)
      const artifactMatches = workflowContent.matchAll(/input:\s+([a-z-_]+\.json)/g);
      const artifacts = [...artifactMatches].map(m => m[1]);

      for (const artifact of artifacts) {
        // Artifacts don't exist until runtime, so just warn
        if (artifact !== 'null' && artifact !== 'none') {
          warnings.push(
            `Workflow requires artifact: ${artifact} (ensure it exists or will be created)`
          );
        }
      }

      // 5. Verify skill availability (basic YAML parsing) - check both locations
      const skillMatches = workflowContent.matchAll(/skill:\s+([a-z-]+)/g);
      const skills = [...skillMatches].map(m => m[1]);

      for (const skill of skills) {
        const skillInfo = findSkillPath(skill);
        if (!skillInfo) {
          errors.push(
            `Skill not found: ${skill} (referenced in workflow ${cuj.workflow}). Expected in .claude/skills/ (Agent Studio) or codex-skills/ (Codex CLI).`
          );
        } else {
          // Log skill type for informational purposes
          if (skillInfo.type === 'codex') {
            warnings.push(
              `Skill ${skill} is a Codex CLI skill. Ensure required CLI tools (claude, gemini) are installed.`
            );
          }
        }
      }
    }
  }

  // For skill-only CUJs, verify primary skill exists - check both locations
  if (cuj.execution_mode === 'skill-only' && cuj.primary_skill) {
    const skillInfo = findSkillPath(cuj.primary_skill);
    if (!skillInfo) {
      errors.push(
        `Primary skill not found: ${cuj.primary_skill}. Expected in .claude/skills/ (Agent Studio) or codex-skills/ (Codex CLI).`
      );
    } else if (skillInfo.type === 'codex') {
      warnings.push(
        `Primary skill ${cuj.primary_skill} is a Codex CLI skill. Ensure required CLI tools (claude, gemini) are installed.`
      );
    }
  }

  // Check CLI availability for Codex skills
  const usesCodexSkills =
    cuj.skill_type === 'codex' ||
    cuj.uses_codex_skills ||
    (cuj.primary_skill && findSkillPath(cuj.primary_skill)?.type === 'codex');

  if (usesCodexSkills) {
    const claudeCli = await checkCliAvailability('claude');
    const geminiCli = await checkCliAvailability('gemini');

    if (!claudeCli.available) {
      warnings.push(`⚠️  Claude CLI not available: ${claudeCli.error}. Multi-AI review may fail.`);
      warnings.push(`   Install: npm install -g @anthropic-ai/claude-cli`);
    } else {
      warnings.push(`✓ Claude CLI available: ${claudeCli.version}`);
    }

    if (!geminiCli.available) {
      warnings.push(
        `⚠️  Gemini CLI not available: ${geminiCli.error}. Multi-AI review may be limited.`
      );
      warnings.push(`   Install: npm install -g @google/generative-ai-cli`);
    } else {
      warnings.push(`✓ Gemini CLI available: ${geminiCli.version}`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Load performance metrics from analytics file
 */
async function loadPerformanceMetrics() {
  const analyticsPath = getAnalyticsPath();
  if (!fs.existsSync(analyticsPath)) {
    return { runs: [] };
  }
  if (shouldUseStreaming(analyticsPath, 1)) {
    return await parseLargeJSON(analyticsPath);
  } else {
    return JSON.parse(fs.readFileSync(analyticsPath, 'utf-8'));
  }
}

/**
 * Save performance metrics to analytics file
 */
function savePerformanceMetrics(metrics) {
  // Respect --no-side-effects flag
  if (noSideEffects) {
    console.log('[--no-side-effects] Skipping performance metrics write');
    return;
  }

  // Writes always go to canonical path (lazy evaluation)
  const writePath = getAnalyticsPath();
  const dir = path.dirname(writePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(writePath, JSON.stringify(metrics, null, 2));
}

/**
 * Record CUJ execution performance with granular Codex skill timing
 * @param {string} cujId - CUJ identifier
 * @param {string} status - success/failure
 * @param {number} duration - Total duration in milliseconds
 * @param {Array} agents - List of agents used
 * @param {Array} warnings - Warnings encountered
 * @param {Object} codexSkillTimings - Detailed timings for Codex skills (optional)
 */
async function recordPerformance(
  cujId,
  status,
  duration,
  agents = [],
  warnings = [],
  codexSkillTimings = {}
) {
  // Skip analytics in CI mode or when explicitly disabled
  if (noAnalytics) {
    console.log(`[Analytics] Skipped (${ciMode ? 'CI mode' : '--no-analytics flag'})`);
    return;
  }

  const metrics = await loadPerformanceMetrics();

  const runEntry = {
    cuj_id: cujId,
    timestamp: new Date().toISOString(),
    duration_ms: duration,
    status,
    agents_used: agents,
    warnings,
  };

  // Add granular Codex skill timings if available
  if (Object.keys(codexSkillTimings).length > 0) {
    runEntry.codex_skills = codexSkillTimings;

    // Calculate aggregated Codex skill timing
    const codexTotalMs = Object.values(codexSkillTimings).reduce((sum, timing) => {
      return sum + (timing.duration_ms || 0);
    }, 0);

    runEntry.codex_total_ms = codexTotalMs;
    runEntry.agent_studio_ms = duration - codexTotalMs;
  }

  metrics.runs.push(runEntry);
  savePerformanceMetrics(metrics);
}

async function listCUJs() {
  const registry = await loadRegistry();
  console.log('\nAvailable CUJs:\n');
  console.log('| ID | Name | Mode | Workflow |');
  console.log('|----|------|------|----------|');
  for (const cuj of registry.cujs) {
    console.log(`| ${cuj.id} | ${cuj.name} | ${cuj.execution_mode} | ${cuj.workflow || '-'} |`);
  }
}

async function simulateCUJ(cujId) {
  const registry = await loadRegistry();
  const cuj = registry.cujs.find(c => c.id === cujId);
  if (!cuj) {
    console.error(`CUJ ${cujId} not found`);
    process.exit(1);
  }

  console.log(`\nSimulating ${cujId}: ${cuj.name}\n`);
  logLifecycle('initializing');

  // Priority 1: Check memory before spawning
  const memCheck = canSpawnSubagent();
  if (!memCheck.canSpawn) {
    console.warn(`[Memory] ${memCheck.warning}`);
    console.warn('[Memory] Attempting cleanup and GC before retry...');
    cleanupAllCaches();
    if (global.gc) {
      global.gc();
    }

    // Re-check after cleanup
    const recheckMem = canSpawnSubagent();
    if (!recheckMem.canSpawn) {
      console.error('[Memory] ERROR: Insufficient memory even after cleanup');
      console.error(
        `[Memory] Current: ${recheckMem.currentUsageMB.toFixed(2)}MB, Free: ${recheckMem.freeMB.toFixed(2)}MB`
      );
      process.exit(1);
    }
    console.log('[Memory] Cleanup successful, proceeding with spawn');
  }

  logLifecycle('running');
  const child = await spawnSubagentWithLimit([
    path.join(__dirname, 'workflow_runner.js'),
    '--cuj-simulation',
    cujId,
  ]);

  logLifecycle('monitoring');
  child.on('exit', code => process.exit(code));
}

function validateCUJ(cujId) {
  console.log(`\nValidating ${cujId}...\n`);

  const child = spawn(
    'node',
    [path.join(__dirname, 'validate-cuj-e2e.mjs'), '--cuj', cujId, '--json'],
    { stdio: 'inherit' }
  );

  child.on('exit', code => process.exit(code));
}

async function runCUJ(cujId) {
  // Display active flags for CI-friendly operation
  if (ciMode || noAnalytics || noSideEffects) {
    console.log('\n🔧 CI-Friendly Mode Active:');
    if (ciMode) console.log('  ✓ CI mode enabled (--ci)');
    if (noAnalytics) console.log('  ✓ Analytics disabled (--no-analytics)');
    if (noSideEffects) console.log('  ✓ Side effects disabled (--no-side-effects)');
    console.log('');
  }

  // Start memory monitoring
  logMemoryUsage('Initial');
  startMonitoring({
    warnThresholdMB: 3500,
    onWarning: usage => {
      console.warn(`[CUJ ${cujId}] Memory warning: ${usage.heapUsedMB.toFixed(2)}MB`);
    },
  });

  // Start periodic cleanup (every 10 minutes)
  const stopCleanup = setupPeriodicCleanup(10 * 60 * 1000);

  // Setup memory pressure handling
  const stopPressureMonitoring = setupMemoryPressureHandling((level, usage, stats) => {
    if (level === 'critical') {
      console.error(
        `[Memory] CRITICAL: ${stats.heapUsagePercent.toFixed(1)}% heap used - aborting CUJ`
      );
      console.error(
        `[Memory] Heap: ${stats.heapUsedMB.toFixed(2)}MB / ${stats.heapLimitMB.toFixed(2)}MB`
      );
      // Cleanup before exit
      stopMonitoring();
      if (stopCleanup) stopCleanup();
      cleanupAllCaches();
      process.exit(42); // Exit code 42 = memory pressure restart needed
    } else if (level === 'high') {
      console.warn(`[Memory] HIGH: ${stats.heapUsagePercent.toFixed(1)}% heap used - cleaning up`);
      console.warn(
        `[Memory] Heap: ${stats.heapUsedMB.toFixed(2)}MB / ${stats.heapLimitMB.toFixed(2)}MB`
      );
      cleanupAllCaches();
      if (global.gc) global.gc();
    }
  });

  // Initialize variables that may be used in exit handler
  let preflightResult = { warnings: [], valid: true, errors: [] };
  let workflowPath = null;
  let startTime = Date.now();

  try {
    const registry = await loadRegistry();
    const cuj = registry.cujs.find(c => c.id === cujId);
    if (!cuj) {
      console.error(`CUJ ${cujId} not found`);
      stopMonitoring();
      if (stopCleanup) {
        stopCleanup();
      }
      cleanupAllCaches();
      process.exit(1);
    }

    // Run pre-flight check
    console.log(`\n🔍 Pre-flight check for ${cujId}...\n`);
    preflightResult = await preflightCheck(cuj);

    if (preflightResult.warnings.length > 0) {
      console.log('⚠️  Warnings:');
      preflightResult.warnings.forEach(w => console.log(`  - ${w}`));
      console.log('');
    }

    if (!preflightResult.valid) {
      console.error('❌ Pre-flight check failed:\n');
      preflightResult.errors.forEach(e => console.error(`  - ${e}`));
      console.error('\nFix these issues before running the CUJ.');
      stopMonitoring();
      if (stopCleanup) {
        stopCleanup();
      }
      cleanupAllCaches();
      process.exit(1);
    }

    console.log('✅ Pre-flight check passed\n');

    if (!cuj.workflow) {
      console.log(`${cujId} is ${cuj.execution_mode} - no workflow to run`);
      console.log('Use --simulate to test or invoke the skill directly');
      return;
    }

    console.log(`\nRunning ${cujId}: ${cuj.name}`);
    console.log(`Workflow: ${cuj.workflow}\n`);

    // Normalize workflow path - avoid double .claude/workflows/ prefix
    if (cuj.workflow.startsWith('.claude/workflows/')) {
      // Already has full path, use as-is
      workflowPath = path.join(
        __dirname,
        '..',
        cuj.workflow.replace('.claude/workflows/', 'workflows/')
      );
    } else {
      // Just filename, prepend workflows directory
      workflowPath = path.join(__dirname, '../workflows', cuj.workflow);
    }

    // Track execution time
    startTime = Date.now();

    // Generate unique run ID for this CUJ execution
    const runId = `${cujId}-${Date.now()}`;

    // NEW: Pre-spawn memory check
    const memCheck = canSpawnSubagent(800); // Need 800MB for subagent
    if (!memCheck.canSpawn) {
      console.warn('[CUJ] Insufficient memory for spawn - running cleanup');
      console.warn(
        `[Memory] RSS: ${memCheck.currentUsageMB.toFixed(2)}MB, Free: ${memCheck.freeMB.toFixed(2)}MB`
      );

      // Aggressive cleanup
      cleanupAllCaches();
      if (global.gc) {
        global.gc();
        global.gc(); // Double GC for better cleanup
      }

      // Wait 2 seconds for cleanup to complete
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Re-check after cleanup
      const recheckMem = canSpawnSubagent(800);
      if (!recheckMem.canSpawn) {
        throw new Error(
          `Cannot spawn subagent: insufficient memory even after cleanup (${recheckMem.freeMB.toFixed(2)}MB free, need 800MB)`
        );
      }

      console.log('[Memory] Cleanup successful, proceeding with spawn');
    }

    // Initialize progress tracking
    const { ProgressTracker } = await import('./progress-emitter.mjs');
    const progressTracker = new ProgressTracker(runId, 11); // Estimate 11 steps (adjust based on workflow)
    progressTracker.start();

    // Track workflow execution progress
    let currentStep = 0;
    const stepProgressInterval = setInterval(async () => {
      try {
        const runRecord = await readRun(runId);
        if (runRecord && runRecord.current_step) {
          const newStep = parseInt(runRecord.current_step);
          if (newStep !== currentStep) {
            currentStep = newStep;
            const stepInfo = runRecord.metadata?.step_info || {};
            progressTracker.updateStep(
              `Step ${currentStep}/11: ${stepInfo.name || 'Executing'} (${stepInfo.agent || 'agent'})`,
              { step: currentStep, agent: stepInfo.agent }
            );
          }
        }
      } catch (error) {
        // Progress tracking failed - not critical
      }
    }, 2000); // Check every 2 seconds

    const child = await spawnSubagentWithLimit([
      path.join(__dirname, 'workflow_runner.js'),
      '--workflow',
      workflowPath,
      '--run-id',
      runId,
      '--id',
      runId, // Keep --id for backward compatibility
    ]);

    // Track child process output for progress
    let childOutput = '';
    child.stdout?.on('data', data => {
      childOutput += data.toString();
      // Parse step progress from workflow runner output
      const stepMatch = childOutput.match(/Step (\d+)\/(\d+)/);
      if (stepMatch) {
        const [, current, total] = stepMatch;
        progressTracker.updateStep(`Step ${current}/${total}: Executing workflow step`, {
          step: parseInt(current),
          total: parseInt(total),
        });
      }
    });

    child.on('exit', async code => {
      clearInterval(stepProgressInterval);
      progressTracker.complete();
      // Stop memory monitoring and cleanup
      stopMonitoring();
      if (stopCleanup) {
        stopCleanup();
      }
      if (stopPressureMonitoring) {
        stopPressureMonitoring();
      }
      cleanupAllCaches(); // Final cleanup
      logMemoryUsage('Final');

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Record performance metrics
      const status = code === 0 ? 'success' : 'failure';
      const warnings = preflightResult.warnings;

      // Extract agents from workflow (basic parsing)
      let agents = [];
      if (workflowPath && fs.existsSync(workflowPath)) {
        const workflowContent = fs.readFileSync(workflowPath, 'utf-8');
        const agentMatches = workflowContent.matchAll(/agent:\s+([a-z-]+)/g);
        agents = [...new Set([...agentMatches].map(m => m[1]))]; // Deduplicate
      }

      // Collect Codex skill timings from CUJ if available
      const codexSkillTimings = {};
      const registry = await loadRegistry();
      const cuj = registry.cujs.find(c => c.id === cujId);

      if (cuj && (cuj.skill_type === 'codex' || cuj.skill_type === 'hybrid')) {
        // Check for Codex skills in CUJ
        const codexSkills = (cuj.skills || []).filter(s => {
          const skillName = typeof s === 'object' ? s.name : s;
          const skillType = typeof s === 'object' ? s.type : null;
          return (
            skillType === 'codex' ||
            skillName === 'multi-ai-code-review' ||
            skillName === 'response-rater'
          );
        });

        // For now, we don't have exact per-skill timing from the workflow runner
        // But we can at least record which Codex skills were used
        codexSkills.forEach(skill => {
          const skillName = typeof skill === 'object' ? skill.name : skill;
          const providers = typeof skill === 'object' ? skill.requires_cli || [] : [];

          codexSkillTimings[skillName] = {
            duration_ms: 0, // Placeholder - actual timing would come from skill execution
            providers: providers,
            provider_timings: {}, // Placeholder
            cli_check_ms: 0, // Placeholder
            parallel_execution: providers.length > 1,
          };
        });
      }

      await recordPerformance(cujId, status, duration, agents, warnings, codexSkillTimings);

      // Enhanced console output with timing breakdown
      console.log(`\n[${cujId}] Execution complete in ${(duration / 1000).toFixed(1)}s`);

      if (Object.keys(codexSkillTimings).length > 0) {
        console.log(`  Codex skills: ${Object.keys(codexSkillTimings).join(', ')}`);
        Object.entries(codexSkillTimings).forEach(([skillName, timing]) => {
          const providers = timing.providers.join(', ');
          console.log(`    ├─ ${skillName} (providers: ${providers})`);
        });
      }

      // Only show analytics message if analytics were actually saved
      if (!noAnalytics) {
        console.log(`📊 Performance data saved to ${writePath}`);
      } else {
        console.log(`📊 Performance data not saved (analytics disabled)`);
      }

      process.exit(code);
    });
  } finally {
    // Ensure monitoring and cleanup are stopped even if there's an error
    stopMonitoring();
    if (stopCleanup) {
      stopCleanup();
    }
    if (stopPressureMonitoring) {
      stopPressureMonitoring();
    }
    cleanupAllCaches(); // Final cleanup
  }
}

// Parse arguments
const args = process.argv.slice(2);

function getFlagValue(flag) {
  const idx = args.indexOf(flag);
  if (idx === -1) return null;
  return args[idx + 1] || null;
}

function hasFlag(flag) {
  return args.includes(flag);
}

function getFirstPositional() {
  // First arg that isn't a flag and isn't a flag value for known flags
  // (minimal parsing; we explicitly handle flags that take a value)
  const flagsWithValues = new Set(['--simulate', '--validate']);
  for (let i = 0; i < args.length; i++) {
    const token = args[i];
    if (!token) continue;
    if (token.startsWith('--')) {
      if (flagsWithValues.has(token)) i++; // skip value
      continue;
    }
    return token;
  }
  return null;
}

if (args.length === 0 || hasFlag('--help')) {
  console.log(`
CUJ Command Wrapper

Usage:
  run-cuj.mjs <CUJ-ID>           Run a CUJ workflow
  run-cuj.mjs --list             List all available CUJs
  run-cuj.mjs --simulate <ID>    Simulate CUJ execution (dry run)
  run-cuj.mjs --validate <ID>    Validate CUJ structure
  run-cuj.mjs --cache-stats      Show skill cache statistics

Flags:
  --no-cache                     Disable skill caching for this run
  --no-analytics                 Skip analytics/performance logging
  --no-side-effects              Skip all state mutations (read-only mode)
  --ci                           CI mode (enables --no-analytics and --no-side-effects)

Examples:
  node .claude/tools/run-cuj.mjs CUJ-005
  node .claude/tools/run-cuj.mjs --list
  node .claude/tools/run-cuj.mjs --simulate CUJ-034
  node .claude/tools/run-cuj.mjs --ci CUJ-005                    # CI-friendly run
  node .claude/tools/run-cuj.mjs --no-analytics CUJ-005          # Skip analytics only
  node .claude/tools/run-cuj.mjs --no-cache --ci CUJ-005         # No cache + CI mode
  `);
  process.exit(0);
}

(async () => {
  if (hasFlag('--list')) {
    await listCUJs();
  } else if (hasFlag('--simulate')) {
    await simulateCUJ(getFlagValue('--simulate'));
  } else if (hasFlag('--validate')) {
    validateCUJ(getFlagValue('--validate'));
  } else if (hasFlag('--cache-stats')) {
    showCacheStats();
  } else {
    const cujId = getFirstPositional();
    if (!cujId) {
      console.error('Error: CUJ ID required');
      process.exit(1);
    }
    await runCUJ(cujId);
  }
})();
