import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { existsSync, utimesSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const PROJECT_ROOT = process.cwd();
const TOOL_PATH = join(PROJECT_ROOT, '.claude', 'tools', 'cleanup-repo.mjs');
const REPORTS_DIR = join(PROJECT_ROOT, '.claude', 'context', 'reports', 'test-retention');

async function runCleanupDryRun(args = []) {
  return await new Promise((resolve, reject) => {
    const proc = spawn('node', [TOOL_PATH, '--dry-run', ...args], { cwd: PROJECT_ROOT });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', c => (stdout += c));
    proc.stderr.on('data', c => (stderr += c));
    proc.on('error', reject);
    proc.on('close', code => resolve({ code, stdout, stderr }));
  });
}

describe('cleanup-repo.mjs reports retention', () => {
  it('lists reports older than retention days', async () => {
    await mkdir(REPORTS_DIR, { recursive: true });
    const oldPath = join(REPORTS_DIR, 'old.md');
    const newPath = join(REPORTS_DIR, 'new.md');

    try {
      await writeFile(oldPath, '# old', 'utf-8');
      await writeFile(newPath, '# new', 'utf-8');

      // Make old file 10 days old; keep new file current.
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      utimesSync(oldPath, tenDaysAgo, tenDaysAgo);

      const res = await runCleanupDryRun(['--reports-retention-days', '5']);
      assert.equal(res.code, 0);
      assert.equal(existsSync(oldPath), true);
      assert.equal(existsSync(newPath), true);

      assert.match(res.stdout, /Report files older than configured retention/i);
      assert.match(res.stdout, /test-retention[\\/]+old\.md/i);
      assert.doesNotMatch(res.stdout, /test-retention[\\/]+new\.md/i);
    } finally {
      await rm(REPORTS_DIR, { recursive: true, force: true });
    }
  });
});
