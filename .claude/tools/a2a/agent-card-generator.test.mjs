/**
 * AgentCard Generator Tests
 *
 * Comprehensive tests for AgentCard generation covering:
 * - Parsing agent definitions
 * - Generating valid AgentCards
 * - Extracting skills
 * - Caching
 * - Feature flags
 * - Error handling
 * - Performance
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  parseAgentDefinition,
  extractSkills,
  generateAgentCard,
  generateAllAgentCards,
  generateAgentCardIfEnabled,
  clearCache,
  getCacheStats,
} from './agent-card-generator.mjs';
import { validateA2AAgentCard, assertAgentCardValid } from './test-utils.mjs';
import { mockFeatureFlags } from './test-utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AGENTS_DIR = path.join(__dirname, '..', '..', 'agents');

// Test suite
const tests = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
  tests.push({ name, fn });
}

function assert_throws(fn, message) {
  try {
    fn();
    throw new Error('Expected function to throw');
  } catch (error) {
    if (error.message === 'Expected function to throw') {
      throw error;
    }
    // Expected error
  }
}

// ============================================================================
// Test: parseAgentDefinition - valid agent file
// ============================================================================
test('parseAgentDefinition - valid agent file', () => {
  const developerFile = path.join(AGENTS_DIR, 'developer.md');
  const agentDef = parseAgentDefinition(developerFile);

  assert.strictEqual(agentDef.name, 'developer');
  assert.ok(agentDef.description);
  assert.ok(Array.isArray(agentDef.tools));
  assert.ok(agentDef.version);
});

// ============================================================================
// Test: parseAgentDefinition - missing file
// ============================================================================
test('parseAgentDefinition - missing file', () => {
  assert_throws(() => {
    parseAgentDefinition('/path/to/nonexistent.md');
  });
});

// ============================================================================
// Test: parseAgentDefinition - invalid format
// ============================================================================
test('parseAgentDefinition - invalid format (missing frontmatter)', () => {
  // Create temporary invalid file
  const tempFile = path.join(__dirname, 'temp-invalid.md');
  fs.writeFileSync(tempFile, '# Invalid Agent\n\nNo frontmatter here.');

  try {
    assert_throws(() => {
      parseAgentDefinition(tempFile);
    });
  } finally {
    fs.unlinkSync(tempFile);
  }
});

// ============================================================================
// Test: extractSkills - basic extraction
// ============================================================================
test('extractSkills - basic extraction', () => {
  const agentDef = {
    name: 'developer',
    description: 'Full-stack developer',
    tools: ['Read', 'Write', 'Edit'],
    priority: 'medium',
    goal: 'Implement features',
  };

  const skills = extractSkills(agentDef);

  assert.ok(Array.isArray(skills));
  assert.ok(skills.length > 0);

  // Should have primary skill
  const primarySkill = skills.find(s => s.id === 'developer-primary');
  assert.ok(primarySkill);
  assert.strictEqual(primarySkill.name, 'developer Core Capability');
});

// ============================================================================
// Test: extractSkills - no tools
// ============================================================================
test('extractSkills - no tools', () => {
  const agentDef = {
    name: 'simple-agent',
    description: 'Simple agent',
    tools: [],
    priority: 'low',
  };

  const skills = extractSkills(agentDef);

  assert.ok(Array.isArray(skills));
  assert.strictEqual(skills.length, 1); // Only primary skill
});

// ============================================================================
// Test: generateAgentCard - valid AgentCard
// ============================================================================
test('generateAgentCard - valid AgentCard', () => {
  const agentDef = {
    name: 'test-agent',
    description: 'Test agent for validation',
    version: '1.0.0',
    tools: ['Read', 'Write'],
    priority: 'medium',
    capabilities: {
      streaming: false,
      push_notifications: false,
      state_transition_history: true,
    },
  };

  const agentCard = generateAgentCard(agentDef);

  // Validate structure
  assertAgentCardValid(agentCard);

  // Validate specific fields
  assert.strictEqual(agentCard.name, 'test-agent');
  assert.strictEqual(agentCard.protocol_version, '0.3.0');
  assert.ok(agentCard.url);
  assert.ok(Array.isArray(agentCard.skills));
});

// ============================================================================
// Test: generateAgentCard - with options
// ============================================================================
test('generateAgentCard - with options', () => {
  const agentDef = {
    name: 'test-agent',
    description: 'Test agent',
    version: '1.0.0',
    tools: [],
    capabilities: {
      streaming: false,
      push_notifications: false,
      state_transition_history: true,
    },
  };

  const agentCard = generateAgentCard(agentDef, {
    baseUrl: 'https://custom.example.com',
    protocolVersion: '0.3.0',
    includeProvider: true,
    includeAuthentication: true,
  });

  assert.ok(agentCard.url.startsWith('https://custom.example.com'));
  assert.ok(agentCard.provider);
  assert.strictEqual(agentCard.provider.organization, 'LLM-Rules System');
  assert.ok(agentCard.authentication);
  assert.ok(Array.isArray(agentCard.authentication.schemes));
});

// ============================================================================
// Test: generateAgentCard - A2A schema compliance
// ============================================================================
test('generateAgentCard - A2A schema compliance', () => {
  const developerFile = path.join(AGENTS_DIR, 'developer.md');
  const agentDef = parseAgentDefinition(developerFile);
  const agentCard = generateAgentCard(agentDef);

  // Validate against A2A schema
  const validation = validateA2AAgentCard(agentCard);

  assert.strictEqual(validation.valid, true, `Validation errors: ${validation.errors.join(', ')}`);
});

// ============================================================================
// Test: generateAllAgentCards - all agents
// ============================================================================
test('generateAllAgentCards - all agents', () => {
  const agentCards = generateAllAgentCards();

  assert.ok(Array.isArray(agentCards));
  assert.ok(agentCards.length > 0);

  // Validate all cards
  for (const card of agentCards) {
    assertAgentCardValid(card);
  }
});

// ============================================================================
// Test: generateAllAgentCards - performance target (<50ms per card)
// ============================================================================
test('generateAllAgentCards - performance target', () => {
  const startTime = Date.now();
  const agentCards = generateAllAgentCards();
  const totalTime = Date.now() - startTime;

  const perCardTime = totalTime / agentCards.length;

  console.log(
    `  Generated ${agentCards.length} AgentCards in ${totalTime}ms (${perCardTime.toFixed(2)}ms per card)`
  );

  assert.ok(perCardTime < 50, `Per-card generation time ${perCardTime}ms exceeds 50ms target`);
});

// ============================================================================
// Test: generateAllAgentCards - caching
// ============================================================================
test('generateAllAgentCards - caching', () => {
  // Clear cache
  clearCache();

  // First call (cache miss)
  const start1 = Date.now();
  const cards1 = generateAllAgentCards();
  const time1 = Date.now() - start1;

  // Second call (cache hit)
  const start2 = Date.now();
  const cards2 = generateAllAgentCards();
  const time2 = Date.now() - start2;

  console.log(`  First call (cache miss): ${time1}ms`);
  console.log(`  Second call (cache hit): ${time2}ms`);

  // Cache hit should be faster
  assert.ok(time2 < time1, 'Cache hit should be faster than cache miss');

  // Results should be identical
  assert.strictEqual(cards1.length, cards2.length);
});

// ============================================================================
// Test: generateAgentCardIfEnabled - feature flag ON
// ============================================================================
test('generateAgentCardIfEnabled - feature flag ON', () => {
  // Mock feature flags with agent_card_generation enabled
  const originalIsEnabled = global.isEnabled;
  global.isEnabled = () => true;

  try {
    const agentCard = generateAgentCardIfEnabled('developer', { env: 'dev' });

    assert.ok(agentCard);
    assertAgentCardValid(agentCard);
    assert.strictEqual(agentCard.name, 'developer');
  } finally {
    global.isEnabled = originalIsEnabled;
  }
});

// ============================================================================
// Test: generateAgentCardIfEnabled - feature flag OFF
// ============================================================================
test('generateAgentCardIfEnabled - feature flag OFF', () => {
  // Mock feature flags with agent_card_generation disabled
  const originalIsEnabled = global.isEnabled;
  global.isEnabled = () => false;

  try {
    const agentCard = generateAgentCardIfEnabled('developer', { env: 'prod' });

    assert.strictEqual(agentCard, null, 'Should return null when feature flag is disabled');
  } finally {
    global.isEnabled = originalIsEnabled;
  }
});

// ============================================================================
// Test: generateAgentCardIfEnabled - agent not found
// ============================================================================
test('generateAgentCardIfEnabled - agent not found', () => {
  const originalIsEnabled = global.isEnabled;
  global.isEnabled = () => true;

  try {
    assert_throws(() => {
      generateAgentCardIfEnabled('nonexistent-agent', { env: 'dev' });
    });
  } finally {
    global.isEnabled = originalIsEnabled;
  }
});

// ============================================================================
// Test: clearCache - cache cleared
// ============================================================================
test('clearCache - cache cleared', () => {
  // Generate cards (populate cache)
  generateAllAgentCards();

  // Verify cache has entries
  let stats = getCacheStats();
  assert.ok(stats.size > 0, 'Cache should have entries');

  // Clear cache
  clearCache();

  // Verify cache is empty
  stats = getCacheStats();
  assert.strictEqual(stats.size, 0, 'Cache should be empty after clear');
});

// ============================================================================
// Test: getCacheStats - statistics
// ============================================================================
test('getCacheStats - statistics', () => {
  clearCache();

  // Generate cards
  generateAllAgentCards();
  generateAgentCardIfEnabled('developer');

  const stats = getCacheStats();

  assert.ok(stats.size > 0);
  assert.ok(Array.isArray(stats.entries));
  assert.strictEqual(stats.ttl_ms, 5 * 60 * 1000);

  // Verify entry format
  for (const entry of stats.entries) {
    assert.ok(entry.key);
    assert.ok(typeof entry.age_ms === 'number');
    assert.ok(typeof entry.expired === 'boolean');
  }
});

// ============================================================================
// Test: AgentCard skills validation
// ============================================================================
test('AgentCard skills validation', () => {
  const developerFile = path.join(AGENTS_DIR, 'developer.md');
  const agentDef = parseAgentDefinition(developerFile);
  const agentCard = generateAgentCard(agentDef);

  // Verify skills structure
  assert.ok(Array.isArray(agentCard.skills));
  assert.ok(agentCard.skills.length > 0);

  for (const skill of agentCard.skills) {
    // Required fields
    assert.ok(skill.id);
    assert.ok(skill.name);
    assert.ok(skill.description);

    // Optional fields
    if (skill.tags) {
      assert.ok(Array.isArray(skill.tags));
    }
    if (skill.examples) {
      assert.ok(Array.isArray(skill.examples));
    }
    if (skill.inputModes) {
      assert.ok(Array.isArray(skill.inputModes));
    }
    if (skill.outputModes) {
      assert.ok(Array.isArray(skill.outputModes));
    }
  }
});

// ============================================================================
// Test: Cache TTL expiration
// ============================================================================
test('Cache TTL expiration (simulated)', () => {
  clearCache();

  // Generate cards
  generateAllAgentCards();

  const stats1 = getCacheStats();
  assert.strictEqual(stats1.entries[0].expired, false);

  // Note: We can't actually wait 5 minutes in tests, so we verify the TTL logic exists
  assert.strictEqual(stats1.ttl_ms, 5 * 60 * 1000);
});

// ============================================================================
// Run all tests
// ============================================================================
async function runTests() {
  console.log('\n=== AgentCard Generator Tests ===\n');

  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`✓ ${name}`);
      passed++;
    } catch (error) {
      console.error(`✗ ${name}`);
      console.error(`  ${error.message}`);
      if (error.stack) {
        console.error(`  ${error.stack.split('\n').slice(1, 3).join('\n')}`);
      }
      failed++;
    }
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
