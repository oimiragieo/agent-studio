import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('ship-readiness-headless workflow', () => {
  it('passes workflow_id into headless runner', () => {
    const workflowPath = join(
      process.cwd(),
      '.claude',
      'workflows',
      'ship-readiness-headless.yaml'
    );
    const raw = readFileSync(workflowPath, 'utf8');
    assert.match(
      raw,
      /run-ship-readiness-headless\.mjs\s+--workflow-id\s+\{\{workflow_id\}\}/,
      'ship-readiness-headless.yaml should invoke the headless runner with --workflow-id {{workflow_id}}'
    );
  });
});
