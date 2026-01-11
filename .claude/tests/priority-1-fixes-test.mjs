#!/usr/bin/env node
/**
 * Test Priority 1 Foundation Fixes
 *
 * Tests the 4 critical fixes:
 * 1. Memory Threshold Mismatch (Issue 1.3)
 * 2. Cache Size Estimation Inefficiency (Issue 1.2)
 * 3. Artifact Persistence Path Inconsistency (Issue 3.2)
 * 4. Workflow ID Generation Not Collision-Proof (Issue 4.1)
 *
 * Usage:
 *   node .claude/tests/priority-1-fixes-test.mjs
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '../..');

let passed = 0;
let failed = 0;

/**
 * Test helper: assert condition
 */
function assert(condition, testName) {
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${testName}`);
    failed++;
  }
}

/**
 * Test Issue 1.3: Memory Threshold Mismatch
 */
async function testMemoryThresholdMismatch() {
  console.log('\n=== Testing Issue 1.3: Memory Threshold Mismatch ===\n');

  // Test 1: Config file exists
  const configPath = join(PROJECT_ROOT, '.claude/config/memory-thresholds.json');
  assert(existsSync(configPath), 'Memory thresholds config file exists');

  // Test 2: Config file has correct structure
  try {
    const configContent = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configContent);

    assert(config.warnThreshold === 3000, 'warnThreshold is 3000MB');
    assert(config.blockThreshold === 3500, 'blockThreshold is 3500MB');
    assert(config.unit === 'MB', 'unit is MB');
    assert(config.description, 'description field exists');
  } catch (error) {
    assert(false, `Config file is valid JSON: ${error.message}`);
  }

  // Test 3: skill-injection-hook.js imports config
  try {
    const hookPath = join(PROJECT_ROOT, '.claude/hooks/skill-injection-hook.js');
    const hookContent = readFileSync(hookPath, 'utf-8');

    assert(
      hookContent.includes('memory-thresholds.json'),
      'skill-injection-hook imports memory-thresholds.json'
    );
    assert(hookContent.includes('memoryConfig'), 'skill-injection-hook uses memoryConfig variable');
  } catch (error) {
    assert(false, `skill-injection-hook validation failed: ${error.message}`);
  }

  // Test 4: memory-monitor.mjs imports config
  try {
    const monitorPath = join(PROJECT_ROOT, '.claude/tools/memory-monitor.mjs');
    const monitorContent = readFileSync(monitorPath, 'utf-8');

    assert(
      monitorContent.includes('memory-thresholds.json'),
      'memory-monitor imports memory-thresholds.json'
    );
    assert(
      monitorContent.includes('loadMemoryThresholds'),
      'memory-monitor has loadMemoryThresholds function'
    );
  } catch (error) {
    assert(false, `memory-monitor validation failed: ${error.message}`);
  }
}

/**
 * Test Issue 1.2: Cache Size Estimation Inefficiency
 */
async function testCacheSizeEstimation() {
  console.log('\n=== Testing Issue 1.2: Cache Size Estimation Inefficiency ===\n');

  try {
    const injectorPath = join(PROJECT_ROOT, '.claude/tools/skill-injector.mjs');
    const injectorContent = readFileSync(injectorPath, 'utf-8');

    // Test 1: Incremental size tracking variable exists
    assert(
      injectorContent.includes('incrementalCacheSizeMB'),
      'incrementalCacheSizeMB variable exists'
    );

    // Test 2: estimateEntrySize function exists
    assert(
      injectorContent.includes('function estimateEntrySize'),
      'estimateEntrySize function exists'
    );

    // Test 3: estimateCacheSize is now O(1)
    const estimateFunction = injectorContent.match(/function estimateCacheSize\(\)[^}]+}/s)?.[0];
    assert(
      estimateFunction && !estimateFunction.includes('for ('),
      'estimateCacheSize is O(1) (no loops)'
    );

    // Test 4: cleanCache updates incremental size
    assert(
      injectorContent.includes('incrementalCacheSizeMB -='),
      'cleanCache decrements incrementalCacheSizeMB'
    );

    // Test 5: loadSkillContent updates incremental size
    assert(
      injectorContent.includes('incrementalCacheSizeMB +='),
      'loadSkillContent increments incrementalCacheSizeMB'
    );

    // Test 6: clearSkillContentCache resets incremental size
    const clearFunctionMatch = injectorContent.match(
      /export function clearSkillContentCache\(\)[\s\S]*?^}/m
    );
    const clearFunction = clearFunctionMatch ? clearFunctionMatch[0] : '';
    assert(
      clearFunction && clearFunction.includes('incrementalCacheSizeMB = 0'),
      'clearSkillContentCache resets incrementalCacheSizeMB'
    );
  } catch (error) {
    assert(false, `Cache size estimation validation failed: ${error.message}`);
  }
}

/**
 * Test Issue 3.2: Artifact Persistence Path Inconsistency
 */
async function testArtifactPathConsistency() {
  console.log('\n=== Testing Issue 3.2: Artifact Persistence Path Inconsistency ===\n');

  // Test 1: artifact-path-resolver.mjs exists
  const resolverPath = join(PROJECT_ROOT, '.claude/tools/artifact-path-resolver.mjs');
  assert(existsSync(resolverPath), 'artifact-path-resolver.mjs exists');

  // Test 2: Resolver has required functions
  try {
    const resolverContent = readFileSync(resolverPath, 'utf-8');

    assert(
      resolverContent.includes('export function getArtifactPath'),
      'getArtifactPath function exists'
    );
    assert(
      resolverContent.includes('export function getReportPath'),
      'getReportPath function exists'
    );
    assert(resolverContent.includes('export function getTaskPath'), 'getTaskPath function exists');
    assert(
      resolverContent.includes('export function getArtifactDir'),
      'getArtifactDir function exists'
    );
  } catch (error) {
    assert(false, `artifact-path-resolver validation failed: ${error.message}`);
  }

  // Test 3: multi-ai-review uses resolver
  try {
    const reviewPath = join(PROJECT_ROOT, 'codex-skills/multi-ai-code-review/scripts/review.js');
    const reviewContent = readFileSync(reviewPath, 'utf-8');

    assert(
      reviewContent.includes('artifact-path-resolver'),
      'multi-ai-review imports artifact-path-resolver'
    );
    assert(
      reviewContent.includes('artifactPathResolver'),
      'multi-ai-review uses artifactPathResolver variable'
    );
  } catch (error) {
    assert(false, `multi-ai-review validation failed: ${error.message}`);
  }

  // Test 4: Test path resolution logic
  try {
    // Dynamic import (convert Windows path to file:// URL)
    const resolverUrl = new URL(`file:///${resolverPath.replace(/\\/g, '/')}`);
    const { getArtifactPath, getReportPath, getTaskPath } = await import(resolverUrl.href);

    // Test run-specific path
    const runPath = getArtifactPath('run-123', 'test.json');
    const normalizedRunPath = runPath.replace(/\\/g, '/');
    assert(
      normalizedRunPath.includes('runs/run-123/artifacts/test.json'),
      'getArtifactPath generates run-specific path'
    );

    // Test legacy path
    const legacyPath = getArtifactPath(null, 'test.json');
    const normalizedLegacyPath = legacyPath.replace(/\\/g, '/');
    assert(
      normalizedLegacyPath.includes('.claude/context/artifacts/test.json') &&
        !normalizedLegacyPath.includes('runs'),
      'getArtifactPath generates legacy path when runId is null'
    );

    // Test report path
    const reportPath = getReportPath('run-123', 'report.md');
    const normalizedReportPath = reportPath.replace(/\\/g, '/');
    assert(
      normalizedReportPath.includes('runs/run-123/reports/report.md'),
      'getReportPath generates correct path'
    );

    // Test task path
    const taskPath = getTaskPath('run-123', 'task.md');
    const normalizedTaskPath = taskPath.replace(/\\/g, '/');
    assert(
      normalizedTaskPath.includes('runs/run-123/tasks/task.md'),
      'getTaskPath generates correct path'
    );
  } catch (error) {
    assert(false, `Path resolution logic test failed: ${error.message}`);
  }
}

/**
 * Test Issue 4.1: Workflow ID Generation Not Collision-Proof
 */
async function testWorkflowIdGeneration() {
  console.log('\n=== Testing Issue 4.1: Workflow ID Generation Not Collision-Proof ===\n');

  try {
    const runManagerPath = join(PROJECT_ROOT, '.claude/tools/run-manager.mjs');
    const runManagerContent = readFileSync(runManagerPath, 'utf-8');

    // Test 1: run-manager imports crypto
    assert(
      runManagerContent.includes("import { randomUUID } from 'crypto'"),
      'run-manager imports randomUUID from crypto'
    );

    // Test 2: generateRunId function exists
    assert(
      runManagerContent.includes('export async function generateRunId'),
      'generateRunId function exists and is exported'
    );

    // Test 3: generateRunId uses randomUUID
    assert(runManagerContent.includes('randomUUID()'), 'generateRunId uses randomUUID()');

    // Test 4: Collision detection exists
    assert(runManagerContent.includes('existsSync(runDir)'), 'generateRunId checks for collision');

    // Test 5: validateRunId function exists
    assert(
      runManagerContent.includes('export async function validateRunId'),
      'validateRunId function exists'
    );
  } catch (error) {
    assert(false, `run-manager validation failed: ${error.message}`);
  }

  // Test 6: workflow_runner uses new ID generation
  try {
    const workflowPath = join(PROJECT_ROOT, '.claude/tools/workflow_runner.js');
    const workflowContent = readFileSync(workflowPath, 'utf-8');

    assert(workflowContent.includes('generateRunId'), 'workflow_runner uses generateRunId');
    assert(
      !workflowContent.includes('Math.random()') ||
        !workflowContent.match(/function generateWorkflowId\(\)[^}]+Math\.random\(\)/s),
      'workflow_runner does not use Math.random() for ID generation'
    );
  } catch (error) {
    assert(false, `workflow_runner validation failed: ${error.message}`);
  }

  // Test 7: Test actual ID generation
  try {
    const runManagerPath = join(PROJECT_ROOT, '.claude/tools/run-manager.mjs');
    const runManagerUrl = new URL(`file:///${runManagerPath.replace(/\\/g, '/')}`);
    const { generateRunId, validateRunId } = await import(runManagerUrl.href);

    const id1 = await generateRunId();
    const id2 = await generateRunId();

    assert(id1 !== id2, 'generateRunId produces unique IDs');
    assert(id1.length > 0, 'Generated ID is non-empty');
    assert(/^[a-zA-Z0-9-]+$/.test(id1), 'Generated ID contains only valid characters');

    // Test validation
    const validation = await validateRunId('test-' + Date.now());
    assert(validation.valid, 'validateRunId accepts valid ID format');
  } catch (error) {
    assert(false, `ID generation runtime test failed: ${error.message}`);
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('🧪 Testing Priority 1 Foundation Fixes\n');
  console.log('='.repeat(60));

  await testMemoryThresholdMismatch();
  await testCacheSizeEstimation();
  await testArtifactPathConsistency();
  await testWorkflowIdGeneration();

  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);

  if (failed === 0) {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  } else {
    console.error(`\n❌ ${failed} test(s) failed`);
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});
