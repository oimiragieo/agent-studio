#!/usr/bin/env node
/**
 * Manual smoke test for the orchestrator enforcement hook command.
 *
 * Usage:
 *   node .claude/hooks/test-orchestrator-enforcement-hook.mjs
 */
import { spawn } from 'child_process';
import { rm } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const hookPath = join(__dirname, 'orchestrator-enforcement-hook.mjs');
const sessionStatePath = join(__dirname, '..', 'context', 'tmp', 'orchestrator-session-state.json');
const sessionDeltaPath = join(
  __dirname,
  '..',
  'context',
  'tmp',
  'orchestrator-session-state.delta.jsonl'
);

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    testsPassed++;
    console.log(`✅ PASS: ${message}`);
  } else {
    testsFailed++;
    console.error(`❌ FAIL: ${message}`);
  }
}

async function runHook(tool_name, tool_input) {
  const child = spawn(process.execPath, [hookPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, CLAUDE_AGENT_ROLE: 'orchestrator' },
  });

  const payload = JSON.stringify({ tool_name, tool_input });
  child.stdin.end(payload);

  const stdout = [];
  const stderr = [];
  child.stdout.on('data', d => stdout.push(d));
  child.stderr.on('data', d => stderr.push(d));

  const exitCode = await new Promise(resolve => child.on('close', resolve));
  const out = Buffer.concat(stdout).toString('utf-8').trim();
  const err = Buffer.concat(stderr).toString('utf-8').trim();

  let parsed = null;
  try {
    parsed = out ? JSON.parse(out) : null;
  } catch {
    parsed = null;
  }

  return { exitCode, out, err, parsed };
}

async function resetSessionState() {
  await rm(sessionStatePath, { force: true });
  await rm(sessionDeltaPath, { force: true });
}

async function main() {
  console.log('🧪 Orchestrator Enforcement Hook (command) smoke test\n');
  await resetSessionState();

  const writeResult = await runHook('Write', { file_path: 'test.txt', content: 'x' });
  assert(writeResult.parsed?.decision === 'block', 'Write is blocked for orchestrator');

  const bashSafe = await runHook('Bash', { command: 'pwd' });
  assert(bashSafe.parsed?.decision === 'allow', 'Safe Bash is allowed');

  const bashDanger = await runHook('Bash', { command: 'git add .' });
  assert(bashDanger.parsed?.decision === 'block', 'Dangerous Bash is blocked');

  await resetSessionState();
  const read1 = await runHook('Read', { file_path: 'file1.txt' });
  const read2 = await runHook('Read', { file_path: 'file2.txt' });
  const read3 = await runHook('Read', { file_path: 'file3.txt' });
  assert(read1.parsed?.decision === 'allow', 'Read #1 allowed');
  assert(read2.parsed?.decision === 'allow', 'Read #2 allowed');
  assert(read3.parsed?.decision === 'block', 'Read #3 blocked (2-file rule)');

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Passed: ${testsPassed}`);
  console.log(`❌ Failed: ${testsFailed}`);
  process.exit(testsFailed === 0 ? 0 : 1);
}

main().catch(err => {
  console.error('❌ Test runner error:', err);
  process.exit(1);
});
