// Smoke test - verifies test infrastructure works
import { test } from 'node:test';
import assert from 'node:assert';

test('smoke test - test infrastructure is working', () => {
  assert.strictEqual(1 + 1, 2, 'Basic arithmetic should work');
});

test('smoke test - environment is configured', () => {
  assert.ok(process.version, 'Node version should be available');
  assert.ok(process.cwd(), 'Working directory should be available');
});
