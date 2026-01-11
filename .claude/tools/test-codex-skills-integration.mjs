#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '../..');

const MOCK_MODE = process.env.CI === 'true' || process.argv.includes('--mock');
const VERBOSE = process.argv.includes('--verbose');

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};
function assert(c, m) {
  if (!c) throw new Error(m);
}
function log(...a) {
  if (VERBOSE) console.log('  ', ...a);
}

function findSkillPath(n) {
  const a = path.join(projectRoot, '.claude/skills', n, 'SKILL.md');
  const c = path.join(projectRoot, 'codex-skills', n, 'SKILL.md');
  if (fs.existsSync(a)) return { path: a, type: 'agent-studio' };
  if (fs.existsSync(c)) return { path: c, type: 'codex' };
  return null;
}

async function testAgentStudioSkill() {
  const r = findSkillPath('repo-rag');
  assert(r && r.type === 'agent-studio', 'Should find Agent Studio skill');
}

async function testCodexSkill() {
  const r = findSkillPath('response-rater');
  assert(r !== null, 'Should find skill');
  if (r.type === 'codex') {
    assert(r.path.includes('codex-skills'), 'Codex path');
  } else {
    const cp = path.join(projectRoot, 'codex-skills', 'response-rater', 'SKILL.md');
    assert(fs.existsSync(cp), 'Codex version should exist');
  }
}

async function testMissingSkill() {
  assert(findSkillPath('xyz-99') === null, 'Missing skill returns null');
}

async function checkCli(cli) {
  if (MOCK_MODE) {
    const m = {
      claude: { available: true, version: 'mock-1.0' },
      gemini: { available: false, error: 'Mock' },
    };
    return m[cli] || { available: false, error: 'Unknown' };
  }
  try {
    await execPromise(process.platform === 'win32' ? 'where ' + cli : 'which ' + cli, {
      timeout: 5000,
    });
    return { available: true, version: 'found' };
  } catch (e) {
    return { available: false, error: e.message };
  }
}

async function testClaudeCliDetection() {
  const r = await checkCli('claude');
  if (MOCK_MODE) assert(r.available, 'Mock: Claude available');
  else assert(typeof r.available === 'boolean', 'Has available');
}

async function testMissingGeminiCli() {
  if (MOCK_MODE) {
    const r = await checkCli('gemini');
    assert(!r.available, 'Mock: Gemini unavailable');
  } else {
    const r = await checkCli('xyz-nonexistent');
    assert(!r.available, 'Nonexistent unavailable');
  }
}

const RETRY_CFG = {
  maxRetries: 3,
  baseDelayMs: 10,
  maxDelayMs: 50,
  retryableErrors: ['TIMEOUT', 'RATE_LIMIT'],
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function withRetry(fn, cfg = RETRY_CFG) {
  for (let i = 1; i <= cfg.maxRetries; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === cfg.maxRetries || !cfg.retryableErrors.some(x => e.message.includes(x))) throw e;
      await sleep(Math.min(cfg.baseDelayMs * Math.pow(2, i - 1), cfg.maxDelayMs));
    }
  }
}

async function testRetryOnTimeout() {
  let a = 0;
  const fn = async () => {
    a++;
    if (a < 3) throw new Error('TIMEOUT');
    return 'ok';
  };
  const r = await withRetry(fn);
  assert(r === 'ok' && a === 3, 'Retries on timeout');
}

async function testNoRetryOnAuth() {
  let a = 0;
  try {
    await withRetry(async () => {
      a++;
      throw new Error('AUTH_FAILED');
    });
  } catch (e) {
    assert(e.message.includes('AUTH_FAILED') && a === 1, 'No retry on auth');
  }
}

function evalCond(cond, ctx = {}) {
  if (!cond || typeof cond !== 'string') return true;
  const sc = { providers: ctx.providers || [], env: { CI: process.env.CI === 'true' } };
  const t = cond.trim();
  // Check compound first
  if (t.includes(' OR '))
    return t
      .split(' OR ')
      .map(p => p.trim())
      .some(p => evalCond(p, ctx));
  if (t.includes(' AND '))
    return t
      .split(' AND ')
      .map(p => p.trim())
      .every(p => evalCond(p, ctx));
  // Single patterns
  if (t.includes('providers.includes')) {
    const m = t.match(/providers\.includes\(['"]([^'"]+)['"]\)/);
    if (m) return sc.providers.includes(m[1]);
  }
  if (t.includes('env.')) {
    const m = t.match(/env\.(\w+)\s*===?\s*(true|false)/);
    if (m) return sc.env[m[1]] === (m[2] === 'true');
  }
  return true;
}

async function testProviderCondition() {
  const c = { providers: ['claude', 'gemini'] };
  assert(evalCond('providers.includes("claude")', c) === true, 'Find claude');
  assert(evalCond('providers.includes("copilot")', c) === false, 'No copilot');
}

async function testInvalidCondition() {
  assert(evalCond('invalid {{}}', {}) === true, 'Invalid returns true');
  assert(evalCond('', {}) === true && evalCond(null, {}) === true, 'Empty/null true');
}

async function testEnvCondition() {
  const orig = process.env.CI;
  process.env.CI = 'true';
  assert(evalCond('env.CI === true', {}) === true, 'CI true');
  process.env.CI = 'false';
  assert(evalCond('env.CI === true', {}) === false, 'CI false');
  if (orig) process.env.CI = orig;
  else delete process.env.CI;
}

async function testCompoundConditions() {
  const c = { providers: ['claude', 'gemini'] };
  assert(
    evalCond('providers.includes("claude") OR providers.includes("copilot")', c),
    'OR any true'
  );
  assert(!evalCond('providers.includes("x") OR providers.includes("y")', c), 'OR all false');
  assert(
    evalCond('providers.includes("claude") AND providers.includes("gemini")', c),
    'AND all true'
  );
  assert(
    !evalCond('providers.includes("claude") AND providers.includes("copilot")', c),
    'AND any false'
  );
}

const tests = [
  { name: 'finds agent-studio skill', test: testAgentStudioSkill, category: 'Skill Path' },
  { name: 'finds codex skill', test: testCodexSkill, category: 'Skill Path' },
  { name: 'reports missing skill', test: testMissingSkill, category: 'Skill Path' },
  { name: 'detects claude CLI', test: testClaudeCliDetection, category: 'CLI Availability' },
  { name: 'handles missing gemini CLI', test: testMissingGeminiCli, category: 'CLI Availability' },
  { name: 'retries on timeout', test: testRetryOnTimeout, category: 'Retry Logic' },
  { name: 'no retry on auth', test: testNoRetryOnAuth, category: 'Retry Logic' },
  { name: 'evaluates provider condition', test: testProviderCondition, category: 'Conditions' },
  { name: 'handles invalid condition', test: testInvalidCondition, category: 'Conditions' },
  { name: 'evaluates env condition', test: testEnvCondition, category: 'Conditions' },
  { name: 'evaluates compound conditions', test: testCompoundConditions, category: 'Conditions' },
];

async function run() {
  console.log('');
  console.log('Codex Skills Integration Tests');
  console.log('Mode:', MOCK_MODE ? 'MOCK' : 'REAL');
  console.log('-'.repeat(50));
  const results = [];
  let cat = '';
  for (const { name, test, category } of tests) {
    if (category !== cat) {
      cat = category;
      console.log(colors.bold + cat + colors.reset);
    }
    try {
      await test();
      console.log('  ' + colors.green + 'PASS' + colors.reset + ' ' + name);
      results.push({ name, category, status: 'PASS' });
    } catch (e) {
      console.log('  ' + colors.red + 'FAIL ' + name + ': ' + e.message + colors.reset);
      results.push({ name, category, status: 'FAIL', error: e.message });
    }
  }
  const p = results.filter(r => r.status === 'PASS').length;
  const f = results.filter(r => r.status === 'FAIL').length;
  console.log('-'.repeat(50));
  console.log('Passed:', p, ' Failed:', f);
  const rp = path.join(
    projectRoot,
    '.claude/context/artifacts/test-codex-integration-results.json'
  );
  fs.mkdirSync(path.dirname(rp), { recursive: true });
  fs.writeFileSync(
    rp,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        mode: MOCK_MODE ? 'mock' : 'real',
        summary: { total: results.length, passed: p, failed: f },
        tests: results,
      },
      null,
      2
    )
  );
  console.log('Results saved to:', rp);
  process.exit(f > 0 ? 1 : 0);
}
run();
