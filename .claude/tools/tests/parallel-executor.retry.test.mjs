import test from 'node:test';
import assert from 'node:assert/strict';
import { executeWorkflowSteps } from '../workflow/parallel-executor.mjs';

test('parallel-executor retries a failing step and emits attempt events', async () => {
  let calls = 0;
  const events = [];
  const steps = [{ step: 1, title: 'retry me' }];

  const result = await executeWorkflowSteps(
    steps,
    { workflowId: 't', runId: 'r' },
    {
      timeout: 2000,
      retry: { retries: 1, retryDelayMs: 1, backoffMultiplier: 1, maxRetryDelayMs: 5 },
      onEvent: e => events.push(e),
      stepExecutor: async () => {
        calls += 1;
        if (calls === 1) throw new Error('boom');
        return { ok: true };
      },
    }
  );

  assert.equal(result.failed.length, 0);
  assert.equal(result.success.length, 1);
  assert.equal(result.success[0].step, 1);
  assert.equal(result.success[0].attempts, 2);
  assert.ok(Number.isFinite(result.success[0].duration_ms));

  const attemptEvents = events.filter(e => e.type === 'step_attempt' && e.step === 1);
  assert.equal(attemptEvents.length, 2);
  assert.equal(attemptEvents[0].attempt, 1);
  assert.equal(attemptEvents[1].attempt, 2);
});

test('parallel-executor allows per-step retry override', async () => {
  let calls = 0;
  const steps = [
    { step: 1, title: 'override', retry: { retries: 2, retryDelayMs: 1, backoffMultiplier: 1 } },
  ];

  const result = await executeWorkflowSteps(
    steps,
    { workflowId: 't', runId: 'r' },
    {
      timeout: 2000,
      retry: { retries: 0 },
      stepExecutor: async () => {
        calls += 1;
        if (calls <= 2) throw new Error('nope');
        return { ok: true };
      },
    }
  );

  assert.equal(result.failed.length, 0);
  assert.equal(result.success[0].attempts, 3);
});
