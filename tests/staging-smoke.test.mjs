/**
 * Staging Environment Smoke Tests
 *
 * Quick validation tests that run after staging deployment.
 * Verifies basic functionality without deep testing.
 *
 * Run with: AGENT_STUDIO_ENV=staging node --test tests/staging-smoke.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Skip staging tests in development environment
if (process.env.NODE_ENV !== 'staging' && process.env.NODE_ENV !== 'production') {
  console.log('Skipping staging smoke tests (not in staging environment)');
  process.exit(0);
}

// Import utilities (CommonJS modules)
let getEnvironment, getEnvironmentPath;

test('setup - load environment utilities', async () => {
  const envModule = await import(`file://${path.join(PROJECT_ROOT, '.claude', 'lib', 'utils', 'environment.cjs')}`);
  const configModule = await import(`file://${path.join(PROJECT_ROOT, '.claude', 'lib', 'utils', 'config-loader.cjs')}`);

  getEnvironment = envModule.getEnvironment;
  getEnvironmentPath = configModule.getEnvironmentPath;
});

test('smoke: environment detection', () => {
  const env = getEnvironment();
  assert.equal(env, 'staging', `Expected staging environment, got: ${env}`);
});

test('smoke: staging configuration exists', async () => {
  const configPath = path.join(PROJECT_ROOT, '.claude', 'config.staging.yaml');
  const stats = await fs.stat(configPath);
  assert.ok(stats.isFile(), 'config.staging.yaml should be a file');
  assert.ok(stats.size > 0, 'config.staging.yaml should not be empty');
});

test('smoke: staging directories exist', async () => {
  const stagingRoot = path.join(PROJECT_ROOT, '.claude', 'staging');
  const requiredDirs = [
    'knowledge',
    'metrics',
    'memory',
    'agents',
    'sessions',
    'context',
  ];

  for (const dir of requiredDirs) {
    const dirPath = path.join(stagingRoot, dir);
    const stats = await fs.stat(dirPath);
    assert.ok(stats.isDirectory(), `${dir} should be a directory`);
  }
});

test('smoke: staging log files initialized', async () => {
  const logFiles = [
    getEnvironmentPath('metrics/hooks.jsonl'),
    getEnvironmentPath('metrics/agents.jsonl'),
    getEnvironmentPath('metrics/errors.jsonl'),
    getEnvironmentPath('metrics/llm-usage.log'),
    getEnvironmentPath('sessions/session-log.jsonl'),
  ];

  for (const logFile of logFiles) {
    try {
      const stats = await fs.stat(logFile);
      assert.ok(stats.isFile(), `${path.basename(logFile)} should exist`);
    } catch (error) {
      assert.fail(`Log file missing: ${logFile}`);
    }
  }
});

test('smoke: staging memory files exist', async () => {
  const memoryFiles = [
    getEnvironmentPath('memory/learnings.md'),
    getEnvironmentPath('memory/decisions.md'),
    getEnvironmentPath('memory/issues.md'),
  ];

  for (const memoryFile of memoryFiles) {
    const stats = await fs.stat(memoryFile);
    assert.ok(stats.isFile(), `${path.basename(memoryFile)} should be a file`);
    assert.ok(stats.size > 0, `${path.basename(memoryFile)} should not be empty`);
  }
});

test('smoke: evolution state file exists', async () => {
  const evolutionStatePath = getEnvironmentPath('context/evolution-state.json');
  const stats = await fs.stat(evolutionStatePath);
  assert.ok(stats.isFile(), 'evolution-state.json should be a file');

  const content = await fs.readFile(evolutionStatePath, 'utf8');
  const state = JSON.parse(content);

  assert.ok(Array.isArray(state.researchEntries), 'researchEntries should be an array');
  assert.ok(Array.isArray(state.history), 'history should be an array');
  assert.ok(Array.isArray(state.patterns), 'patterns should be an array');
});

test('smoke: environment path resolution', () => {
  const knowledgePath = getEnvironmentPath('knowledge');
  assert.ok(knowledgePath.includes('staging'), 'Path should include staging directory');
  assert.ok(knowledgePath.endsWith('knowledge'), 'Path should end with knowledge');
});

test('smoke: config loader uses staging config', async () => {
  const { loadConfig } = await import(`file://${path.join(PROJECT_ROOT, '.claude', 'lib', 'utils', 'config-loader.cjs')}`);
  const config = loadConfig(false); // Don't use cache

  assert.equal(config.environment, 'staging', 'Config environment should be staging');
  assert.equal(config._meta.environment, 'staging', 'Config meta environment should be staging');
  assert.ok(config._meta.configFile.includes('staging'), 'Should load staging config file');
});

test('smoke: feature flags enabled in staging', async () => {
  const { loadConfig } = await import(`file://${path.join(PROJECT_ROOT, '.claude', 'lib', 'utils', 'config-loader.cjs')}`);
  const config = loadConfig(false);

  // All features should be enabled in staging for testing
  assert.equal(config.features.partyMode.enabled, true, 'Party Mode should be enabled in staging');
  assert.equal(config.features.advancedElicitation.enabled, true, 'Advanced Elicitation should be enabled in staging');
  assert.equal(config.features.knowledgeBase.enabled, true, 'Knowledge Base should be enabled in staging');
  assert.equal(config.features.costTracking.enabled, true, 'Cost Tracking should be enabled in staging');
});

test('smoke: staging has relaxed monitoring thresholds', async () => {
  const { loadConfig } = await import(`file://${path.join(PROJECT_ROOT, '.claude', 'lib', 'utils', 'config-loader.cjs')}`);
  const config = loadConfig(false);

  // Staging thresholds should be 2x more lenient than production
  assert.equal(config.monitoring.thresholds.hookExecutionTimeMs, 20, 'Hook execution threshold should be 20ms');
  assert.equal(config.monitoring.thresholds.agentFailureRate, 6, 'Agent failure rate should be 6%');
  assert.equal(config.monitoring.verboseLogging, true, 'Verbose logging should be enabled');
});
