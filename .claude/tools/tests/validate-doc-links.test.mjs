import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function runValidator(root, args = []) {
  const result = spawnSync(
    process.execPath,
    [join(process.cwd(), '.claude/tools/validate-doc-links.mjs'), ...args],
    {
      cwd: root,
      encoding: 'utf8',
    }
  );
  return {
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

test('validate-doc-links passes for valid intra-doc links and anchors', () => {
  const root = mkdtempSync(join(tmpdir(), 'llm-rules-docs-ok-'));
  const docsDir = join(root, '.claude', 'docs');
  mkdirSync(docsDir, { recursive: true });

  writeFileSync(join(docsDir, 'b.md'), ['# Hello', '', 'Some content.'].join('\n'), 'utf8');
  writeFileSync(join(docsDir, 'a.md'), ['See [B](./b.md#hello).'].join('\n'), 'utf8');

  const r = runValidator(root, ['--root', root, '--docs-dir', '.claude/docs']);
  assert.equal(r.status, 0, r.stdout || r.stderr);
});

test('validate-doc-links fails for missing targets', () => {
  const root = mkdtempSync(join(tmpdir(), 'llm-rules-docs-missing-'));
  const docsDir = join(root, '.claude', 'docs');
  mkdirSync(docsDir, { recursive: true });
  writeFileSync(join(docsDir, 'a.md'), ['Broken [X](./missing.md).'].join('\n'), 'utf8');

  const r = runValidator(root, ['--root', root, '--docs-dir', '.claude/docs']);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /Target not found/i);
});

test('validate-doc-links treats existing directories as valid targets', () => {
  const root = mkdtempSync(join(tmpdir(), 'llm-rules-docs-dir-'));
  const claudeDir = join(root, '.claude');
  const docsDir = join(claudeDir, 'docs');
  mkdirSync(join(claudeDir, 'workflows'), { recursive: true });
  mkdirSync(docsDir, { recursive: true });

  writeFileSync(join(docsDir, 'a.md'), ['See [workflows](../workflows/).'].join('\n'), 'utf8');

  const r = runValidator(root, ['--root', root, '--docs-dir', '.claude/docs']);
  assert.equal(r.status, 0, r.stdout || r.stderr);
});
