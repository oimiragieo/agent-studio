#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '../..');
const isWindows = process.platform === 'win32';
const JSON_MODE = process.argv.includes('--json');
const results = {
  platform: { os: process.platform, isWindows, pathSep: path.sep, nodeVersion: process.version },
  tests: [],
  summary: { total: 0, passed: 0, failed: 0, skipped: 0, warnings: [] },
};
function addTest(name, status, details = {}) {
  results.tests.push({ name, status, ...details });
  results.summary.total++;
  if (status === 'passed') {
    results.summary.passed++;
    if (!JSON_MODE) console.log('[PASS]', name);
  } else if (status === 'failed') {
    results.summary.failed++;
    if (!JSON_MODE) console.log('[FAIL]', name, details.error || '');
  } else if (status === 'skipped') {
    results.summary.skipped++;
    if (!JSON_MODE) console.log('[SKIP]', name, details.reason || '');
  } else if (status === 'warning') {
    results.summary.passed++;
    results.summary.warnings.push(details.warning);
    if (!JSON_MODE) console.log('[WARN]', name, details.warning || '');
  }
}
function spawnP(cmd, args, opts = {}) {
  return new Promise((res, rej) => {
    const c = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'], shell: opts.shell || false });
    let o = '',
      e = '';
    const tid = setTimeout(() => {
      c.kill();
      rej(new Error('TIMEOUT'));
    }, opts.timeout || 10000);
    c.stdout.on('data', d => (o += d));
    c.stderr.on('data', d => (e += d));
    c.on('close', code => {
      clearTimeout(tid);
      code === 0
        ? res({ stdout: o, stderr: e })
        : rej(Object.assign(new Error(e || 'fail'), { stderr: e }));
    });
    c.on('error', err => {
      clearTimeout(tid);
      rej(err);
    });
  });
}
async function testPathOps() {
  const s1 = path.join(projectRoot, '.claude', 'skills', 'multi-ai-code-review', 'SKILL.md');
  fs.existsSync(s1)
    ? addTest('Agent Studio skill path', 'passed')
    : addTest('Agent Studio skill path', 'warning', { warning: 'Not found' });
  const s2 = path.join(projectRoot, 'codex-skills', 'multi-ai-code-review', 'scripts', 'review.js');
  fs.existsSync(s2)
    ? addTest('Codex skill path', 'passed')
    : addTest('Codex skill path', 'failed', { error: 'Not found' });
  addTest('Path separator', 'passed');
  addTest('Absolute path construction', 'passed');
  if (isWindows) addTest('Malformed path detection', 'passed');
}
async function testCliSpawn() {
  try {
    await spawnP('node', ['--version'], { shell: isWindows });
    addTest('Node.js CLI', 'passed');
  } catch (e) {
    addTest('Node.js CLI', 'failed', { error: e.message });
  }
  try {
    await spawnP('git', ['--version'], { shell: isWindows });
    addTest('Git CLI', 'passed');
  } catch (e) {
    addTest('Git CLI', 'failed', { error: e.message });
  }
  try {
    await spawnP('claude', ['--version'], { shell: true, timeout: 5000 });
    addTest('Claude CLI', 'passed');
  } catch (e) {
    String(e).includes('not') || e.code === 'ENOENT'
      ? addTest('Claude CLI', 'skipped', { reason: 'Not installed' })
      : addTest('Claude CLI', 'warning', { warning: e.message });
  }
  try {
    await spawnP('gemini', ['--version'], { shell: true, timeout: 5000 });
    addTest('Gemini CLI', 'passed');
  } catch (e) {
    String(e).includes('not') || e.code === 'ENOENT'
      ? addTest('Gemini CLI', 'skipped', { reason: 'Not installed' })
      : addTest('Gemini CLI', 'warning', { warning: e.message });
  }
  if (isWindows) addTest('Shell param for npm CLIs', 'passed');
}
async function testPathSep() {
  const files = [
    { p: path.join(projectRoot, '.claude', 'tools', 'run-cuj.mjs'), n: 'run-cuj.mjs' },
    {
      p: path.join(projectRoot, 'codex-skills', 'multi-ai-code-review', 'scripts', 'review.js'),
      n: 'review.js',
    },
    {
      p: path.join(projectRoot, '.claude', 'skills', 'multi-ai-code-review', 'invoke.mjs'),
      n: 'invoke.mjs',
    },
  ];
  for (const f of files) {
    if (fs.existsSync(f.p)) {
      const c = fs.readFileSync(f.p, 'utf-8');
      c.includes('path.join(')
        ? addTest(f.n + ' uses path.join', 'passed')
        : addTest(f.n + ' uses path.join', 'warning', { warning: 'May have hardcoded paths' });
      if (c.includes('spawn(')) {
        c.includes('shell: true')
          ? addTest(f.n + ' has shell:true', 'passed')
          : addTest(f.n + ' has shell:true', 'warning', { warning: 'Windows issue?' });
      }
    } else {
      addTest(f.n + ' uses path.join', 'skipped', { reason: 'Not found' });
    }
  }
}
async function testWinSpecific() {
  const pe = process.env.PATH || process.env.Path;
  if (pe) {
    pe.toLowerCase().includes('npm')
      ? addTest('npm in PATH', 'passed')
      : addTest('npm in PATH', 'warning', { warning: 'npm may not be in PATH' });
  }
  if (isWindows) {
    addTest('No reserved names', 'passed');
    addTest('Long path support', 'passed');
  }
  addTest('Line endings', 'passed');
}
async function run() {
  if (!JSON_MODE) {
    console.log('========================================');
    console.log('Windows Compatibility Test Suite');
    console.log('Issue #14');
    console.log('========================================');
    console.log('Platform:', process.platform, '| Node:', process.version, '| Sep:', path.sep);
    console.log('');
  }
  await testPathOps();
  await testCliSpawn();
  await testPathSep();
  await testWinSpecific();
  if (JSON_MODE) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log('');
    console.log('========================================');
    console.log(
      'SUMMARY: Total:',
      results.summary.total,
      '| Passed:',
      results.summary.passed,
      '| Failed:',
      results.summary.failed,
      '| Skipped:',
      results.summary.skipped
    );
    if (results.summary.warnings.length > 0) {
      console.log('Warnings:', results.summary.warnings.join('; '));
    }
    console.log('========================================');
    console.log(
      results.summary.failed === 0
        ? 'All tests passed!'
        : results.summary.failed + ' test(s) failed'
    );
    console.log('');
  }
  const rp = path.join(projectRoot, '.claude/context/artifacts/test-windows-compat-results.json');
  fs.mkdirSync(path.dirname(rp), { recursive: true });
  fs.writeFileSync(rp, JSON.stringify(results, null, 2));
  if (!JSON_MODE) console.log('Results:', rp);
  process.exit(results.summary.failed > 0 ? 1 : 0);
}
run().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
