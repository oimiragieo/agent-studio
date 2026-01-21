import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const PROJECT_ROOT = process.cwd();
const TOOL = path.join(PROJECT_ROOT, '.claude', 'tools', 'repair-claude-project-sessions.mjs');

function runTool(args, env = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [TOOL, ...args], { env: { ...process.env, ...env } });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', c => (stdout += c));
    proc.stderr.on('data', c => (stderr += c));
    proc.on('error', reject);
    proc.on('close', code => resolve({ code, stdout, stderr }));
    setTimeout(() => proc.kill('SIGTERM'), 5000);
  });
}

describe('repair-claude-project-sessions tool', () => {
  it('dry-run reports missing session jsonl, create makes empty placeholder', async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), 'claude-home-'));
    const home = tmp;
    const history = path.join(home, 'history.jsonl');
    const projects = path.join(home, 'projects');
    await mkdir(projects, { recursive: true });

    const projectPath = 'C:\\dev\\projects\\omega-main';
    const projectDir = path.join(projects, 'C--dev-projects-omega-main');
    await mkdir(projectDir, { recursive: true });

    const sessionId = '0da352dc-7ab7-4f8e-92f6-c90335ce1fe3';
    await writeFile(
      history,
      JSON.stringify({
        display: '/doctor',
        timestamp: Date.now(),
        project: projectPath,
        sessionId,
      }) + '\n',
      'utf-8'
    );

    const dry = await runTool(['--home', home, '--project', projectPath, '--json']);
    assert.equal(dry.code, 0);
    const dryJson = JSON.parse(dry.stdout);
    assert.equal(dryJson.mode, 'dry-run');
    assert.equal(Array.isArray(dryJson.missing), true);
    assert.equal(dryJson.missing.length, 1);
    assert.match(dryJson.missing[0].missing_path, /0da352dc-7ab7-4f8e-92f6-c90335ce1fe3\.jsonl$/i);

    const create = await runTool(['--home', home, '--project', projectPath, '--create', '--json']);
    assert.equal(create.code, 0);
    const createJson = JSON.parse(create.stdout);
    assert.equal(createJson.created_count, 1);

    const createdPath = path.join(projectDir, `${sessionId}.jsonl`);
    assert.equal(existsSync(createdPath), true);
    const contents = await readFile(createdPath, 'utf-8');
    assert.equal(contents, '');
  });
});
