import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';

function runNode(args, { cwd } = {}) {
  return new Promise(resolve => {
    const proc = spawn(process.execPath, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', c => (stdout += c));
    proc.stderr.on('data', c => (stderr += c));
    proc.on('close', code => resolve({ code, stdout, stderr }));
  });
}

test('skills-registry emits JSON and counts', async () => {
  const root = await mkdtemp(join(tmpdir(), 'skills-registry-'));
  await mkdir(join(root, '.claude', 'skills', 'demo-skill'), { recursive: true });
  await writeFile(
    join(root, '.claude', 'skills', 'demo-skill', 'SKILL.md'),
    `---\nname: demo-skill\ndescription: demo\nversion: 1.0\nallowed-tools: [read, write]\n---\n\n# demo\n`,
    'utf8'
  );

  const out = join(root, '.claude', 'context', 'artifacts', 'skills', 'skills-registry.json');
  const res = await runNode(
    [
      join(process.cwd(), '.claude', 'tools', 'skills-registry.mjs'),
      '--project-root',
      root,
      '--out',
      out,
      '--json',
    ],
    { cwd: process.cwd() }
  );
  assert.equal(res.code, 0, res.stderr);

  const data = JSON.parse(await readFile(out, 'utf8'));
  assert.equal(typeof data.generated_at, 'string');
  assert.equal(data.counts.total, 1);
  assert.equal(data.skills[0].name, 'demo-skill');
  assert.deepEqual(data.skills[0].allowed_tools, ['read', 'write']);
});
