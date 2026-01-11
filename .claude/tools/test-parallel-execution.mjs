#!/usr/bin/env node
/**
 * Comprehensive Stress Test Suite for Parallel Workflow Execution
 * Cursor Recommendation #TS-2: Parallel Execution Stress Tests
 */

import assert from 'assert';
import {
  groupStepsByParallelGroup,
  validateParallelGroups,
  executeWorkflowSteps,
  checkParallelSupport,
} from './workflow/parallel-executor.mjs';

let passed = 0,
  failed = 0;
const failures = [];

async function runTest(d, f) {
  try {
    await f();
    passed++;
    console.log('  ✓', d);
  } catch (e) {
    failed++;
    failures.push({ d, e: e.message });
    console.log('  ✗', d, ':', e.message);
  }
}

function createMock(opts = {}) {
  const { delay = 100, failSteps = [], resourceContention = false } = opts;
  let act = 0,
    max = 0;
  const exec = async s => {
    act++;
    max = Math.max(max, act);
    if (resourceContention && act > 3) throw new Error('Contention');
    await new Promise(r => setTimeout(r, delay));
    if (failSteps.includes(s.step)) {
      act--;
      throw new Error('Fail ' + s.step);
    }
    act--;
    return { step: s.step };
  };
  exec.getMaxConcurrent = () => max;
  return exec;
}

(async () => {
  console.log('\nParallel Execution Stress Tests\n');
  await runTest('Basic parallel', async () => {
    const steps = [
      { step: 1 },
      { step: 2, parallel_group: 1 },
      { step: 3, parallel_group: 1 },
      { step: 4 },
    ];
    const e = createMock({ delay: 100 });
    const t = Date.now();
    const r = await executeWorkflowSteps(steps, {}, { stepExecutor: e, timeout: 5000 });
    assert(Date.now() - t < 350);
    assert.strictEqual(r.success.length, 4);
    assert.strictEqual(e.getMaxConcurrent(), 2);
  });
  await runTest('Groups correctly', async () => {
    const g = groupStepsByParallelGroup([
      { step: 1 },
      { step: 2, parallel_group: 1 },
      { step: 3, parallel_group: 1 },
    ]);
    assert(g.has(1) && g.get(1).length === 2);
  });
  await runTest('Handles failure', async () => {
    const e = createMock({ failSteps: [2] });
    const r = await executeWorkflowSteps(
      [
        { step: 1, parallel_group: 1 },
        { step: 2, parallel_group: 1 },
        { step: 3, parallel_group: 1 },
      ],
      {},
      { stepExecutor: e, timeout: 5000, failFast: false }
    );
    assert.strictEqual(r.success.length, 2);
    assert.strictEqual(r.failed.length, 1);
  });
  await runTest('Detects invalid deps', async () => {
    const v = validateParallelGroups([
      { step: 1, parallel_group: 1 },
      { step: 2, parallel_group: 1, inputs: ['a (from step 1)'] },
    ]);
    assert.strictEqual(v.valid, false);
  });
  await runTest('Allows cross-group deps', async () => {
    const v = validateParallelGroups([
      { step: 1, parallel_group: 1 },
      { step: 2, parallel_group: 2, inputs: ['a (from step 1)'] },
    ]);
    assert.strictEqual(v.valid, true);
  });
  await runTest('High concurrency', async () => {
    const steps = Array.from({ length: 10 }, (_, i) => ({ step: i + 1, parallel_group: 1 }));
    const e = createMock({ delay: 100 });
    const t = Date.now();
    const r = await executeWorkflowSteps(steps, {}, { stepExecutor: e, timeout: 10000 });
    assert.strictEqual(r.success.length, 10);
    assert(Date.now() - t < 300);
  });
  await runTest('Resource contention', async () => {
    const steps = Array.from({ length: 5 }, (_, i) => ({ step: i + 1, parallel_group: 1 }));
    const e = createMock({ delay: 100, resourceContention: true });
    const r = await executeWorkflowSteps(
      steps,
      {},
      { stepExecutor: e, timeout: 10000, failFast: false }
    );
    assert(r.failed.length > 0);
  });
  await runTest('Parallel support detection', async () => {
    const s = checkParallelSupport({
      steps: [
        { step: 1, parallel_group: 1 },
        { step: 2, parallel_group: 1 },
      ],
    });
    assert.strictEqual(s.supported, true);
  });
  await runTest('No parallel support detection', async () => {
    const s = checkParallelSupport({ steps: [{ step: 1 }, { step: 2 }] });
    assert.strictEqual(s.supported, false);
  });
  console.log('\nSummary:', passed + '/' + (passed + failed), 'passed');
  if (failed > 0) {
    console.log('\nFailures:');
    failures.forEach((f, i) => console.log(i + 1 + '.', f.d, '-', f.e));
    process.exit(1);
  }
  console.log('✓ All tests passed!');
})().catch(console.error);
