import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function runValidator(root, args = []) {
  const result = spawnSync(
    process.execPath,
    [join(process.cwd(), '.claude/tools/validate-agents-frontmatter.mjs'), ...args],
    { cwd: root, encoding: 'utf8' }
  );
  return { status: result.status, stdout: result.stdout || '', stderr: result.stderr || '' };
}

test('validate-agents-frontmatter passes for valid agent files', () => {
  const root = mkdtempSync(join(tmpdir(), 'llm-rules-agents-ok-'));
  const agentsDir = join(root, '.claude', 'agents');
  mkdirSync(agentsDir, { recursive: true });

  writeFileSync(
    join(agentsDir, 'ok.md'),
    [
      '---',
      'name: ok-agent',
      'description: Does a thing',
      'model: sonnet',
      'tools: Read, Grep',
      '---',
      '',
      'Body.',
      '',
    ].join('\n'),
    'utf8'
  );

  const r = runValidator(root, ['--root', root, '--agents-dir', '.claude/agents']);
  assert.equal(r.status, 0, r.stdout || r.stderr);
});

test('validate-agents-frontmatter fails for missing required fields', () => {
  const root = mkdtempSync(join(tmpdir(), 'llm-rules-agents-bad-'));
  const agentsDir = join(root, '.claude', 'agents');
  mkdirSync(agentsDir, { recursive: true });

  writeFileSync(
    join(agentsDir, 'bad.md'),
    ['---', 'name: BadName', '---', '', 'Body.'].join('\n'),
    'utf8'
  );

  const r = runValidator(root, ['--root', root, '--agents-dir', '.claude/agents']);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /Failed:\s*[1-9]/);
});
