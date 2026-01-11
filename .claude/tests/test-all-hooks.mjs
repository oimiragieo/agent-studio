#!/usr/bin/env node
import { spawn } from 'child_process';
import { writeFile, mkdir, access } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';
import { HOOKS } from './fixtures/hook-test-cases.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const HOOKS_DIR = join(__dirname, '..', 'hooks');
const RESULTS_DIR = join(__dirname, '..', 'context', 'test-results');

const args = process.argv.slice(2);
const OPTIONS = {
  isolation:
    args.includes('--isolation') || !args.some(a => a.startsWith('--') && !a.includes('verbose')),
  integration:
    args.includes('--integration') || !args.some(a => a.startsWith('--') && !a.includes('verbose')),
  verbose: args.includes('--verbose'),
  hookFilter: args.includes('--hook') ? args[args.indexOf('--hook') + 1] : null,
};

async function runHook(hookPath, input, env = {}, timeout = 5000) {
  return new Promise(resolve => {
    const startTime = performance.now();
    const proc = spawn('node', [hookPath], { env: { ...process.env, ...env } });
    let stdout = '',
      stderr = '';
    proc.stdout.on('data', c => {
      stdout += c;
    });
    proc.stderr.on('data', c => {
      stderr += c;
    });
    proc.on('error', e =>
      resolve({
        success: false,
        exitCode: -1,
        error: e.message,
        stdout: null,
        stderr,
        duration: performance.now() - startTime,
      })
    );
    proc.on('close', code => {
      let parsed = null;
      try {
        if (stdout.trim()) parsed = JSON.parse(stdout.trim());
      } catch {}
      resolve({
        success: code === 0,
        exitCode: code,
        stdout: parsed,
        rawStdout: stdout,
        stderr,
        duration: performance.now() - startTime,
      });
    });
    proc.stdin.write(typeof input === 'string' ? input : JSON.stringify(input));
    proc.stdin.end();
    setTimeout(() => proc.kill('SIGTERM'), timeout);
  });
}

function validate(result, expected) {
  const errors = [];
  if (
    expected.decision !== undefined &&
    (!result.stdout || result.stdout.decision !== expected.decision)
  )
    errors.push('Expected: ' + expected.decision + ', Got: ' + (result.stdout?.decision || 'null'));
  if (expected.exitCode !== undefined && result.exitCode !== expected.exitCode)
    errors.push('Expected exitCode: ' + expected.exitCode + ', Got: ' + result.exitCode);
  return { passed: errors.length === 0, errors };
}

async function runIsolationTests() {
  console.log('ISOLATION TESTS');
  const results = { total: 0, passed: 0, failed: 0, hookResults: {} };
  for (const [hookName, cfg] of Object.entries(HOOKS)) {
    if (OPTIONS.hookFilter && !hookName.includes(OPTIONS.hookFilter)) continue;
    const hookPath = join(HOOKS_DIR, hookName);
    try {
      await access(hookPath);
    } catch {
      console.log('[SKIP] ' + hookName);
      continue;
    }
    console.log('Testing: ' + hookName);
    const hr = { passed: 0, failed: 0, tests: [], avgDuration: 0 };
    let dur = 0;
    for (const tc of cfg.testCases) {
      results.total++;
      const r = await runHook(hookPath, tc.input, tc.env || {});
      const v = validate(r, tc.expected);
      dur += r.duration;
      if (v.passed) {
        results.passed++;
        hr.passed++;
        process.stdout.write('.');
      } else {
        results.failed++;
        hr.failed++;
        console.log('[FAIL] ' + tc.name + ': ' + v.errors.join(', '));
      }
    }
    hr.avgDuration = dur / cfg.testCases.length;
    results.hookResults[hookName] = hr;
    console.log(
      ' Summary: ' +
        hr.passed +
        '/' +
        cfg.testCases.length +
        ' (' +
        hr.avgDuration.toFixed(1) +
        'ms avg)'
    );
  }
  return results;
}

async function main() {
  console.log('HOOK TESTING FRAMEWORK - ' + new Date().toISOString());
  try {
    await mkdir(RESULTS_DIR, { recursive: true });
  } catch {}
  const results = { timestamp: new Date().toISOString(), isolation: null };
  if (OPTIONS.isolation) results.isolation = await runIsolationTests();
  const total = results.isolation?.total || 0;
  const passed = results.isolation?.passed || 0;
  console.log('SUMMARY: ' + passed + '/' + total + ' passed');
  console.log('HOOK SAFETY:');
  if (results.isolation)
    for (const [n, r] of Object.entries(results.isolation.hookResults))
      console.log((r.failed === 0 && r.avgDuration < 100 ? '[SAFE]' : '[REVIEW]') + ' ' + n);
  const path = join(RESULTS_DIR, 'results-' + Date.now() + '.json');
  await writeFile(path, JSON.stringify(results, null, 2));
  console.log('Saved: ' + path);
  process.exit((results.isolation?.failed || 0) > 0 ? 1 : 0);
}
main().catch(e => {
  console.error(e);
  process.exit(1);
});
