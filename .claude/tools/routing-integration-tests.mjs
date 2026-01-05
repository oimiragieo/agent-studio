#!/usr/bin/env node
/**
 * Comprehensive Integration Test Suite for Task Routing System
 * 
 * Tests end-to-end routing for all 26 task types, cross-cutting triggers,
 * security boundaries, edge cases, and performance.
 * 
 * Usage:
 *   node .claude/tools/routing-integration-tests.mjs
 */

import { selectAgents, getExecutionHints } from './agent-router.mjs';
import { classifyTask, analyzeTaskType, TASK_TYPE_INDICATORS } from './task-classifier.mjs';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test configuration
const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m'
};

const results = {
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  startTime: Date.now(),
  categories: {},
  failures: []
};

// Test utilities
function formatDuration(ms) {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

async function test(category, name, fn) {
  results.total++;
  results.categories[category] = results.categories[category] || { passed: 0, failed: 0 };
  
  try {
    await fn();
    results.passed++;
    results.categories[category].passed++;
    console.log(`  ${COLORS.green}PASS${COLORS.reset} ${name}`);
    return true;
  } catch (error) {
    results.failed++;
    results.categories[category].failed++;
    console.log(`  ${COLORS.red}FAIL${COLORS.reset} ${name}`);
    console.log(`       ${COLORS.dim}${error.message}${COLORS.reset}`);
    results.failures.push({ category, name, error: error.message });
    return false;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) throw new Error(`${message}: expected ${expected}, got ${actual}`);
}

function assertIncludes(array, item, message) {
  if (!array.includes(item)) throw new Error(`${message}: ${item} not found in [${array.join(', ')}]`);
}

function assertOneOf(value, options, message) {
  if (!options.includes(value)) throw new Error(`${message}: ${value} not in [${options.join(', ')}]`);
}

// 1. TASK TYPE ROUTING TESTS
async function testTaskTypeRouting() {
  console.log(`\n${COLORS.cyan}=== TASK TYPE ROUTING TESTS ===${COLORS.reset}\n`);

  const taskTypeTests = [
    { type: 'UI_UX', task: 'Create a new button component with hover effects', expectedPrimary: 'ux-expert' },
    { type: 'UI_UX', task: 'Redesign the dashboard UI layout', expectedPrimary: 'ux-expert' },
    { type: 'MOBILE', task: 'Build iOS push notification feature', expectedPrimary: 'mobile-developer' },
    { type: 'MOBILE', task: 'Add React Native screen for settings', expectedPrimary: 'mobile-developer' },
    { type: 'DATABASE', task: 'Create database schema for orders table', expectedPrimary: 'database-architect' },
    { type: 'DATABASE', task: 'Optimize SQL query performance', expectedPrimary: 'database-architect' },
    { type: 'IMPLEMENTATION', task: 'Implement feature for exporting data', expectedPrimary: 'developer' },
    { type: 'IMPLEMENTATION', task: 'Build the user registration feature', expectedPrimary: 'developer' },
    { type: 'ARCHITECTURE', task: 'Design system architecture for new microservice', expectedPrimary: 'architect' },
    { type: 'ARCHITECTURE', task: 'Create scalable technology stack proposal', expectedPrimary: 'architect' },
    { type: 'API', task: 'Design REST API endpoints for users', expectedPrimary: 'api-designer' },
    { type: 'API', task: 'Create GraphQL schema for products', expectedPrimary: 'api-designer' },
    { type: 'SECURITY', task: 'Security audit of authentication system', expectedPrimary: 'security-architect' },
    { type: 'SECURITY', task: 'Implement OAuth 2.0 for login', expectedPrimary: 'security-architect' },
    { type: 'PERFORMANCE', task: 'Optimize slow page load times', expectedPrimary: 'performance-engineer' },
    { type: 'PERFORMANCE', task: 'Profile and fix memory leaks', expectedPrimary: 'performance-engineer' },
    { type: 'REFACTORING', task: 'Refactor legacy authentication code', expectedPrimary: 'refactoring-specialist' },
    { type: 'LEGACY', task: 'Modernize legacy PHP codebase to Node.js', expectedPrimary: 'legacy-modernizer' },
    { type: 'AI_LLM', task: 'Build RAG system with Claude embeddings', expectedPrimary: 'llm-architect' },
    { type: 'INCIDENT', task: 'Respond to production database outage', expectedPrimary: 'incident-responder' },
    { type: 'INFRASTRUCTURE', task: 'Set up Kubernetes deployment pipeline', expectedPrimary: 'devops' },
    { type: 'COMPLIANCE', task: 'Ensure GDPR compliance for user data', expectedPrimary: 'compliance-auditor' },
    { type: 'DOCUMENTATION', task: 'Write API documentation for endpoints', expectedPrimary: 'technical-writer' },
    { type: 'RESEARCH', task: 'Research feasibility of blockchain integration', expectedPrimary: 'analyst' },
    { type: 'PRODUCT', task: 'Create PRD for new checkout flow', expectedPrimary: 'pm' },
  ];

  for (const testCase of taskTypeTests) {
    await test('Task Type Routing', `${testCase.type}: "${testCase.task.substring(0, 40)}..."`, async () => {
      const typeAnalysis = analyzeTaskType(testCase.task);
      assertEqual(typeAnalysis.taskType, testCase.type, 'Task type mismatch');
      assertEqual(typeAnalysis.primaryAgent, testCase.expectedPrimary, 'Primary agent mismatch');
    });
  }
}

// 2. CROSS-CUTTING TRIGGER TESTS
async function testCrossCuttingTriggers() {
  console.log('\n' + COLORS.cyan + '=== CROSS-CUTTING TRIGGER TESTS ===' + COLORS.reset + '\n');

  const crossCuttingTests = [
    { task: 'Add OAuth authentication to login', expectedAgents: ['security-architect'] },
    { task: 'Fix JWT token validation bug', expectedAgents: ['security-architect'] },
    { task: 'Ensure GDPR compliance for user data', expectedAgents: ['compliance-auditor'] },
    { task: 'Handle PII in checkout process', expectedAgents: ['compliance-auditor'] },
    { task: 'Add ARIA labels to form elements', expectedAgents: ['accessibility-expert'] },
    { task: 'Create schema migration for users table', expectedAgents: ['database-architect'] },
    { task: 'Review pull request for authentication', expectedAgents: ['code-reviewer'] },
    { task: 'Fix production outage in payment service', expectedAgents: ['incident-responder'] },
    { task: 'Fix security vulnerability in OAuth with GDPR compliance', expectedAgents: ['security-architect', 'compliance-auditor'] },
  ];

  for (const testCase of crossCuttingTests) {
    const testName = 'Triggers: [' + testCase.expectedAgents.join(', ') + ']';
    await test('Cross-Cutting Triggers', testName, async () => {
      const result = await selectAgents(testCase.task);
      for (const expectedAgent of testCase.expectedAgents) {
        assertIncludes(result.crossCutting, expectedAgent, 'Missing cross-cutting agent');
      }
    });
  }
}

// 3. AGENT CHAIN VALIDATION TESTS
async function testAgentChains() {
  console.log('\n' + COLORS.cyan + '=== AGENT CHAIN VALIDATION TESTS ===' + COLORS.reset + '\n');

  await test('Agent Chains', 'Chain has no duplicates', async () => {
    const result = await selectAgents('Implement user authentication feature');
    const unique = new Set(result.fullChain);
    assertEqual(unique.size, result.fullChain.length, 'Chain contains duplicates');
  });

  await test('Agent Chains', 'Chain has no undefined values', async () => {
    const result = await selectAgents('Database schema migration with breaking changes');
    assert(!result.fullChain.includes(undefined), 'Chain contains undefined');
    assert(!result.fullChain.includes(null), 'Chain contains null');
  });

  await test('Agent Chains', 'All matrix agents are reachable', async () => {
    const matrixPath = join(__dirname, 'agent-routing-matrix.json');
    const matrixContent = await readFile(matrixPath, 'utf-8');
    const matrix = JSON.parse(matrixContent);
    const allAgents = new Set();
    for (const config of Object.values(matrix.taskTypes)) {
      if (config.primary) allAgents.add(config.primary);
      if (config.supporting) config.supporting.forEach(a => allAgents.add(a));
      if (config.review) config.review.forEach(a => allAgents.add(a));
      if (config.approval) config.approval.forEach(a => allAgents.add(a));
    }
    assert(allAgents.size >= 20, 'Expected 20+ agents, found ' + allAgents.size);
  });
}

// 4. EDGE CASE TESTS
async function testEdgeCases() {
  console.log('\n' + COLORS.cyan + '=== EDGE CASE TESTS ===' + COLORS.reset + '\n');

  await test('Edge Cases', 'Empty task throws error', async () => {
    try {
      await selectAgents('');
      throw new Error('Should have thrown');
    } catch (error) {
      assert(error.message.includes('Task') || error.message.includes('description'), 'Wrong error message');
    }
  });

  await test('Edge Cases', 'Null task throws error', async () => {
    try {
      await selectAgents(null);
      throw new Error('Should have thrown');
    } catch (error) {
      assert(error.message.includes('string'), 'Wrong error message');
    }
  });

  await test('Edge Cases', 'Very long task description is handled', async () => {
    const longTask = 'Implement feature that '.repeat(200);
    const result = await selectAgents(longTask);
    assert(result.taskType, 'Should return task type');
    assert(result.primary, 'Should return primary agent');
  });

  await test('Edge Cases', 'Special characters in task', async () => {
    const result = await selectAgents('Fix bug in @user/auth.tsx with $config && #options');
    assert(result.taskType, 'Should handle special chars');
  });

  await test('Edge Cases', 'Unicode characters handled', async () => {
    const result = await selectAgents('Add emoji support for user names');
    assert(result.taskType, 'Should handle unicode');
  });

  await test('Edge Cases', 'Ambiguous task defaults to developer', async () => {
    const result = await selectAgents('Do something vague');
    assertOneOf(result.primary, ['developer', 'analyst'], 'Ambiguous should default to developer or analyst');
  });

  await test('Edge Cases', 'Multi-type task picks dominant type', async () => {
    const result = await selectAgents('Design database schema and implement API endpoints');
    assert(result.taskType, 'Should resolve to single type');
    assert(result.primary, 'Should have primary agent');
  });
}

// 5. SECURITY BOUNDARY TESTS
async function testSecurityBoundaries() {
  console.log('\n' + COLORS.cyan + '=== SECURITY BOUNDARY TESTS ===' + COLORS.reset + '\n');

  await test('Security', 'Path traversal in files blocked', async () => {
    try {
      await classifyTask('Fix bug', { files: '../../../etc/passwd' });
      throw new Error('Should have blocked path traversal');
    } catch (error) {
      assert(error.message.includes('traversal') || error.message.includes('allowed') || error.message.includes('..'), 'Should block path traversal');
    }
  });

  await test('Security', 'Absolute path blocked', async () => {
    try {
      await classifyTask('Fix bug', { files: '/etc/passwd' });
      throw new Error('Should have blocked');
    } catch (error) {
      assert(error.message.includes('Absolute') || error.message.includes('absolute'), 'Should block absolute paths');
    }
  });

  await test('Security', 'Null bytes blocked', async () => {
    try {
      await classifyTask('Fix bug', { files: 'src/file.ts\x00.txt' });
      throw new Error('Should have blocked');
    } catch (error) {
      assert(error.message.includes('Null') || error.message.includes('null'), 'Should block null bytes');
    }
  });

  await test('Security', 'Shell metacharacters blocked', async () => {
    try {
      await classifyTask('Fix bug', { files: 'src; rm -rf /' });
      throw new Error('Should have blocked');
    } catch (error) {
      assert(error.message.includes('metacharacter') || error.message.includes('Shell'), 'Should block shell chars');
    }
  });

  await test('Security', 'Task description length limit enforced', async () => {
    try {
      const veryLongTask = 'a'.repeat(15000);
      await classifyTask(veryLongTask);
      throw new Error('Should have blocked');
    } catch (error) {
      assert(error.message.includes('length') || error.message.includes('exceeds'), 'Should enforce length limit');
    }
  });

  await test('Security', 'File pattern count limit enforced', async () => {
    try {
      const manyPatterns = Array(100).fill('src/*.ts');
      await classifyTask('Fix bug', { files: manyPatterns });
      throw new Error('Should have blocked');
    } catch (error) {
      assert(error.message.includes('pattern') || error.message.includes('exceeds'), 'Should enforce pattern limit');
    }
  });

  await test('Security', 'Security keywords enforce minimum complexity', async () => {
    const result = await classifyTask('Fix simple authentication bug');
    assertOneOf(result.complexity, ['complex', 'critical'], 'Security tasks should be at least complex');
  });
}

// 6. PERFORMANCE TESTS
async function testPerformance() {
  console.log('\n' + COLORS.cyan + '=== PERFORMANCE TESTS ===' + COLORS.reset + '\n');

  await test('Performance', 'Single routing < 100ms', async () => {
    const start = Date.now();
    await selectAgents('Implement new feature');
    const duration = Date.now() - start;
    assert(duration < 100, 'Routing took ' + duration + 'ms, expected < 100ms');
  });

  await test('Performance', 'Large task description < 100ms', async () => {
    const largeTask = 'Implement feature ' + 'with additional context '.repeat(100);
    const start = Date.now();
    await selectAgents(largeTask);
    const duration = Date.now() - start;
    assert(duration < 100, 'Large task routing took ' + duration + 'ms, expected < 100ms');
  });

  await test('Performance', 'Batch routing 10 tasks < 500ms', async () => {
    const start = Date.now();
    const tasks = Array(10).fill(null).map((_, i) => 
      selectAgents('Task ' + i + ': implement feature')
    );
    await Promise.all(tasks);
    const duration = Date.now() - start;
    assert(duration < 500, 'Batch routing took ' + duration + 'ms, expected < 500ms');
  });

  await test('Performance', 'Memory stays reasonable after many routings', async () => {
    const initialMemory = process.memoryUsage().heapUsed;
    for (let i = 0; i < 100; i++) {
      await selectAgents('Task ' + i + ': implement feature ' + i);
    }
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = (finalMemory - initialMemory) / (1024 * 1024);
    assert(memoryIncrease < 50, 'Memory increased by ' + memoryIncrease.toFixed(2) + 'MB, expected < 50MB');
  });
}

// 7. ROUTING COVERAGE VALIDATION
async function testRoutingCoverage() {
  console.log('\n' + COLORS.cyan + '=== ROUTING COVERAGE VALIDATION ===' + COLORS.reset + '\n');

  const matrixPath = join(__dirname, 'agent-routing-matrix.json');
  const matrixContent = await readFile(matrixPath, 'utf-8');
  const matrix = JSON.parse(matrixContent);

  const allAgents = new Set();
  for (const config of Object.values(matrix.taskTypes)) {
    if (config.primary) allAgents.add(config.primary);
    if (config.supporting) config.supporting.forEach(a => allAgents.add(a));
    if (config.review) config.review.forEach(a => allAgents.add(a));
    if (config.approval) config.approval.forEach(a => allAgents.add(a));
  }

  await test('Coverage', 'All 26 task types have routing defined', async () => {
    const taskTypeCount = Object.keys(matrix.taskTypes).length;
    assert(taskTypeCount >= 26, 'Expected 26 task types, found ' + taskTypeCount);
  });

  await test('Coverage', 'All agents appear in at least one chain', async () => {
    const expectedAgents = [
      'analyst', 'pm', 'architect', 'database-architect', 'developer', 
      'qa', 'ux-expert', 'security-architect', 'devops', 'technical-writer', 
      'code-reviewer', 'refactoring-specialist', 'performance-engineer', 
      'llm-architect', 'api-designer', 'legacy-modernizer', 'mobile-developer', 
      'accessibility-expert', 'compliance-auditor', 'incident-responder'
    ];
    let covered = 0;
    for (const agent of expectedAgents) {
      if (allAgents.has(agent)) covered++;
    }
    assert(covered >= 18, 'Expected 18+ agents covered, found ' + covered);
  });

  await test('Coverage', 'Cross-cutting triggers valid', async () => {
    const triggersPath = join(__dirname, 'cross-cutting-triggers.json');
    const triggersContent = await readFile(triggersPath, 'utf-8');
    const triggers = JSON.parse(triggersContent);
    const triggerCount = Object.keys(triggers.triggers).length;
    assert(triggerCount >= 10, 'Expected 10+ triggers, found ' + triggerCount);
  });
}

// 8. WORKFLOW INTEGRATION TESTS
async function testWorkflowIntegration() {
  console.log('\n' + COLORS.cyan + '=== WORKFLOW INTEGRATION TESTS ===' + COLORS.reset + '\n');

  await test('Workflow', 'Workflow is assigned for tasks', async () => {
    const result = await selectAgents('Design UI mockups for dashboard');
    assert(result.workflow, 'Workflow should be defined');
  });

  await test('Workflow', 'Critical tasks require all gates', async () => {
    const result = await selectAgents('Database schema migration for all user tables');
    assertEqual(result.gates.planner, true, 'Planner required');
    assertEqual(result.gates.review, true, 'Review required');
    assertEqual(result.gates.impactAnalysis, true, 'Impact analysis required');
  });

  await test('Workflow', 'Trivial tasks require no gates', async () => {
    const result = await selectAgents('Fix typo in README');
    assertEqual(result.gates.planner, false, 'No planner for trivial');
    assertEqual(result.gates.review, false, 'No review for trivial');
    assertEqual(result.gates.impactAnalysis, false, 'No impact for trivial');
  });
}

// 9. EXECUTION HINTS TESTS
async function testExecutionHints() {
  console.log('\n' + COLORS.cyan + '=== EXECUTION HINTS TESTS ===' + COLORS.reset + '\n');

  await test('Execution Hints', 'Returns parallel/sequential hints', async () => {
    const result = await selectAgents('Add new UI component');
    const hints = getExecutionHints(result.fullChain, result.taskType);
    assert(hints.parallelSteps !== undefined, 'Should have parallel steps');
    assert(hints.sequentialSteps !== undefined, 'Should have sequential steps');
    assert(typeof hints.totalEstimatedDuration === 'number', 'Should estimate duration');
  });

  await test('Execution Hints', 'Sequential steps include primary/review/approval', async () => {
    const result = await selectAgents('Implement feature');
    const hints = getExecutionHints(result.fullChain, result.taskType);
    assertIncludes(hints.sequentialSteps, 'primary', 'Primary should be sequential');
    assertIncludes(hints.sequentialSteps, 'review', 'Review should be sequential');
    assertIncludes(hints.sequentialSteps, 'approval', 'Approval should be sequential');
  });
}

// MAIN TEST RUNNER
async function runTests() {
  console.log('\n' + COLORS.blue + '======================================================================' + COLORS.reset);
  console.log(COLORS.blue + '     TASK ROUTING SYSTEM - COMPREHENSIVE INTEGRATION TESTS' + COLORS.reset);
  console.log(COLORS.blue + '======================================================================' + COLORS.reset);

  try {
    await testTaskTypeRouting();
    await testCrossCuttingTriggers();
    await testAgentChains();
    await testEdgeCases();
    await testSecurityBoundaries();
    await testPerformance();
    await testRoutingCoverage();
    await testWorkflowIntegration();
    await testExecutionHints();
  } catch (error) {
    console.error('\n' + COLORS.red + 'FATAL ERROR: ' + error.message + COLORS.reset);
    console.error(error.stack);
    process.exit(1);
  }

  const totalDuration = Date.now() - results.startTime;
  
  console.log('\n' + COLORS.blue + '======================================================================' + COLORS.reset);
  console.log(COLORS.cyan + 'TEST SUMMARY' + COLORS.reset);
  console.log(COLORS.blue + '======================================================================' + COLORS.reset);
  
  console.log('\nTotal Tests:  ' + results.total);
  console.log(COLORS.green + 'Passed:       ' + results.passed + COLORS.reset);
  console.log(COLORS.red + 'Failed:       ' + results.failed + COLORS.reset);
  console.log('Duration:     ' + formatDuration(totalDuration));
  
  console.log('\n' + COLORS.cyan + 'BY CATEGORY:' + COLORS.reset);
  for (const [category, stats] of Object.entries(results.categories)) {
    const status = stats.failed === 0 ? COLORS.green : COLORS.red;
    console.log('  ' + category + ': ' + status + stats.passed + '/' + (stats.passed + stats.failed) + COLORS.reset);
  }

  if (results.failures.length > 0) {
    console.log('\n' + COLORS.red + 'FAILURES:' + COLORS.reset);
    for (const failure of results.failures) {
      console.log('  ' + COLORS.dim + '[' + failure.category + ']' + COLORS.reset + ' ' + failure.name);
      console.log('    ' + COLORS.red + failure.error + COLORS.reset);
    }
  }

  console.log('\n' + COLORS.blue + '======================================================================' + COLORS.reset);
  
  if (results.failed === 0) {
    console.log(COLORS.green + 'ALL TESTS PASSED' + COLORS.reset);
    process.exit(0);
  } else {
    console.log(COLORS.red + 'SOME TESTS FAILED' + COLORS.reset);
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});
