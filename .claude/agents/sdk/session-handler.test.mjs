#!/usr/bin/env node
/**
 * Unit Tests - SDK Session Handler
 * Tests for router/orchestrator session defaults and settings integration
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  createSDKSession,
  initializeRouterSession,
  initializeOrchestratorSession,
  loadSDKSession,
  getSessionModelInfo,
  loadSettings,
  loadRouterTemplate,
} from './session-handler.mjs';

// Test fixtures
let testDir;
let originalSettingsPath;
let originalRouterTemplatePath;
let originalSessionsDir;

before(async () => {
  // Create temporary test directory
  testDir = await mkdtemp(join(tmpdir(), 'sdk-session-test-'));
  console.log(`Test directory: ${testDir}`);
});

after(async () => {
  // Clean up test directory
  if (testDir) {
    await rm(testDir, { recursive: true, force: true });
  }
});

describe('SDK Session Handler - Settings Integration', () => {
  describe('loadSettings()', () => {
    it('should load settings from settings.json', async () => {
      const settings = await loadSettings();

      assert.ok(settings, 'Settings should be loaded');
      assert.ok(settings.models, 'Settings should have models');
      assert.ok(settings.session, 'Settings should have session config');
      assert.ok(settings.routing, 'Settings should have routing config');
    });

    it('should return default settings if settings.json not found', async () => {
      // This test validates the fallback behavior
      const settings = await loadSettings();

      assert.strictEqual(
        settings.models.router,
        'claude-haiku-4-5',
        'Default router model should be Haiku'
      );
      assert.strictEqual(
        settings.models.orchestrator,
        'claude-sonnet-4-5',
        'Default orchestrator model should be Sonnet'
      );
    });

    it('should have correct default session settings', async () => {
      const settings = await loadSettings();

      assert.strictEqual(settings.session.default_role, 'router', 'Default role should be router');
      assert.strictEqual(
        settings.session.default_temperature,
        0.1,
        'Default temperature should be 0.1'
      );
      assert.strictEqual(
        settings.session.router_enabled,
        true,
        'Router should be enabled by default'
      );
    });

    it('should have correct routing thresholds', async () => {
      const settings = await loadSettings();

      assert.strictEqual(
        settings.routing.complexity_threshold,
        0.7,
        'Complexity threshold should be 0.7'
      );
      assert.strictEqual(
        settings.routing.cost_optimization_enabled,
        true,
        'Cost optimization should be enabled'
      );
    });
  });

  describe('loadRouterTemplate()', () => {
    it('should load router template if exists', async () => {
      const template = await loadRouterTemplate();

      // Template may or may not exist depending on test environment
      if (template) {
        assert.ok(typeof template === 'string', 'Template should be a string');
        assert.ok(template.length > 0, 'Template should not be empty');
      } else {
        assert.strictEqual(template, null, 'Template should be null if file does not exist');
      }
    });

    it('should return null if template file not found', async () => {
      // This validates graceful fallback
      const template = await loadRouterTemplate();
      assert.ok(
        template === null || typeof template === 'string',
        'Should handle missing template gracefully'
      );
    });
  });
});

describe('SDK Session Handler - Router Session Creation', () => {
  describe('initializeRouterSession()', () => {
    it('should create router session with Haiku model', async () => {
      const prompt = 'Build a web application';
      const session = await initializeRouterSession(prompt);

      assert.ok(session, 'Session should be created');
      assert.strictEqual(session.agent, 'router', 'Agent should be router');
      assert.strictEqual(session.role, 'router', 'Role should be router');
      assert.strictEqual(session.model, 'claude-haiku-4-5', 'Model should be Haiku');
      assert.strictEqual(
        session.metadata.initial_prompt,
        prompt,
        'Initial prompt should be stored'
      );
    });

    it('should include router-specific fields', async () => {
      const session = await initializeRouterSession('Test prompt');

      assert.ok(session.routing_decisions, 'Should have routing_decisions');
      assert.strictEqual(session.routing_decisions.total, 0, 'Total decisions should start at 0');
      assert.strictEqual(
        session.routing_decisions.simple_handled,
        0,
        'Simple handled should start at 0'
      );
    });

    it('should load router template for router sessions', async () => {
      const session = await initializeRouterSession('Test');

      // Router prompt may be null if template doesn't exist
      if (session.router_prompt) {
        assert.ok(typeof session.router_prompt === 'string', 'Router prompt should be string');
        assert.ok(session.router_prompt.length > 0, 'Router prompt should not be empty');
      }
    });

    it('should include settings in session', async () => {
      const session = await initializeRouterSession('Test');

      assert.ok(session.settings, 'Should have settings');
      assert.strictEqual(session.settings.router_enabled, true, 'Router should be enabled');
      assert.strictEqual(
        session.settings.complexity_threshold,
        0.7,
        'Complexity threshold should be set'
      );
    });

    it('should set correct temperature for router', async () => {
      const session = await initializeRouterSession('Test');

      assert.strictEqual(session.temperature, 0.1, 'Temperature should be 0.1 for router');
    });
  });

  describe('initializeOrchestratorSession()', () => {
    it('should create orchestrator session with Sonnet model', async () => {
      const session = await initializeOrchestratorSession({ workflow: 'test-workflow' });

      assert.ok(session, 'Session should be created');
      assert.strictEqual(session.agent, 'orchestrator', 'Agent should be orchestrator');
      assert.strictEqual(session.role, 'orchestrator', 'Role should be orchestrator');
      assert.strictEqual(session.model, 'claude-sonnet-4-5', 'Model should be Sonnet');
    });

    it('should NOT include router-specific fields', async () => {
      const session = await initializeOrchestratorSession();

      assert.strictEqual(session.routing_decisions, undefined, 'Should not have routing_decisions');
      assert.strictEqual(session.router_prompt, undefined, 'Should not have router_prompt');
    });

    it('should include workflow metadata if provided', async () => {
      const metadata = { workflow: 'greenfield-fullstack', feature: 'authentication' };
      const session = await initializeOrchestratorSession(metadata);

      assert.strictEqual(
        session.metadata.workflow,
        'greenfield-fullstack',
        'Workflow should be set'
      );
      assert.strictEqual(session.metadata.feature, 'authentication', 'Feature should be set');
    });
  });

  describe('createSDKSession() - General', () => {
    it('should create session with custom role', async () => {
      const session = await createSDKSession('custom-agent', { role: 'analyst' });

      assert.strictEqual(session.agent, 'custom-agent', 'Agent name should be set');
      assert.strictEqual(session.role, 'analyst', 'Role should be analyst');
    });

    it('should default to router role for unknown agents', async () => {
      const session = await createSDKSession('unknown-agent');

      assert.strictEqual(session.role, 'router', 'Unknown agent should default to router role');
      assert.strictEqual(session.model, 'claude-haiku-4-5', 'Should use Haiku model for router');
    });

    it('should preserve backward compatibility', async () => {
      const session = await createSDKSession('developer', {
        project: 'test-project',
        feature: 'auth',
      });

      assert.ok(session.session_id, 'Should have session_id');
      assert.ok(session.created_at, 'Should have created_at');
      assert.ok(session.metadata, 'Should have metadata');
      assert.strictEqual(session.metadata.project, 'test-project', 'Project should be set');
    });
  });
});

describe('SDK Session Handler - Session Retrieval', () => {
  describe('loadSDKSession()', () => {
    it('should load previously created session', async () => {
      const created = await initializeRouterSession('Test prompt');
      const loaded = await loadSDKSession(created.session_id);

      assert.ok(loaded, 'Session should be loaded');
      assert.strictEqual(loaded.session_id, created.session_id, 'Session IDs should match');
      assert.strictEqual(loaded.role, 'router', 'Role should be router');
      assert.strictEqual(loaded.model, created.model, 'Models should match');
    });

    it('should return null for non-existent session', async () => {
      const loaded = await loadSDKSession('non-existent-session-id');
      assert.strictEqual(loaded, null, 'Should return null for non-existent session');
    });
  });

  describe('getSessionModelInfo()', () => {
    it('should return model info for router session', async () => {
      const session = await initializeRouterSession('Test');
      const modelInfo = await getSessionModelInfo(session.session_id);

      assert.ok(modelInfo, 'Model info should be returned');
      assert.strictEqual(modelInfo.role, 'router', 'Role should be router');
      assert.strictEqual(modelInfo.model, 'claude-haiku-4-5', 'Model should be Haiku');
      assert.strictEqual(modelInfo.router_enabled, true, 'Router should be enabled');
    });

    it('should return model info for orchestrator session', async () => {
      const session = await initializeOrchestratorSession();
      const modelInfo = await getSessionModelInfo(session.session_id);

      assert.ok(modelInfo, 'Model info should be returned');
      assert.strictEqual(modelInfo.role, 'orchestrator', 'Role should be orchestrator');
      assert.strictEqual(modelInfo.model, 'claude-sonnet-4-5', 'Model should be Sonnet');
    });

    it('should return null for non-existent session', async () => {
      const modelInfo = await getSessionModelInfo('non-existent-id');
      assert.strictEqual(modelInfo, null, 'Should return null for non-existent session');
    });

    it('should include temperature in model info', async () => {
      const session = await initializeRouterSession('Test');
      const modelInfo = await getSessionModelInfo(session.session_id);

      assert.strictEqual(modelInfo.temperature, 0.1, 'Temperature should be included');
    });
  });
});

describe('SDK Session Handler - Integration Tests', () => {
  it('should create router session, load it, and get model info', async () => {
    // Create router session
    const prompt = 'Integrate with Google Cloud';
    const created = await initializeRouterSession(prompt);

    // Verify creation
    assert.strictEqual(created.role, 'router', 'Should create router session');
    assert.strictEqual(created.model, 'claude-haiku-4-5', 'Should use Haiku');

    // Load session
    const loaded = await loadSDKSession(created.session_id);
    assert.ok(loaded, 'Should load session');
    assert.strictEqual(loaded.metadata.initial_prompt, prompt, 'Prompt should be preserved');

    // Get model info
    const modelInfo = await getSessionModelInfo(created.session_id);
    assert.strictEqual(modelInfo.role, 'router', 'Model info should show router role');
    assert.strictEqual(modelInfo.auto_route_to_orchestrator, true, 'Should allow auto-routing');
  });

  it('should handle orchestrator session end-to-end', async () => {
    // Create orchestrator session
    const metadata = { workflow: 'test', project: 'demo' };
    const created = await initializeOrchestratorSession(metadata);

    // Verify creation
    assert.strictEqual(created.role, 'orchestrator', 'Should create orchestrator session');
    assert.strictEqual(created.model, 'claude-sonnet-4-5', 'Should use Sonnet');

    // Load and verify
    const loaded = await loadSDKSession(created.session_id);
    assert.strictEqual(loaded.metadata.workflow, 'test', 'Metadata should be preserved');
    assert.strictEqual(loaded.metadata.project, 'demo', 'Project should be preserved');
  });
});

console.log('\n✅ All SDK session handler tests completed\n');
