#!/usr/bin/env node

/**
 * Test Suite for Offline Plan Rating
 *
 * Tests both online and offline scoring modes with sample plans.
 *
 * @version 1.0.0
 */

import { ratePlanOffline } from '../scripts/offline-rater.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test fixtures directory
const FIXTURES_DIR = path.join(__dirname, 'fixtures');

// Ensure fixtures directory exists
if (!fs.existsSync(FIXTURES_DIR)) {
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });
}

/**
 * Create test plan fixtures
 */
function createTestFixtures() {
  // High-quality plan (should score >= 7)
  const highQualityPlan = {
    business_objective: 'Implement user authentication system',
    context: 'Current system lacks secure authentication. Need OAuth2 + JWT implementation.',
    phases: [
      { name: 'Design', steps: ['architecture', 'API design'] },
      { name: 'Implementation', steps: ['backend', 'frontend'] },
      { name: 'Testing', steps: ['unit tests', 'integration tests'] },
    ],
    steps: [
      {
        name: 'Design authentication architecture',
        agent: 'architect',
        estimated_duration: '2 days',
        dependencies: [],
      },
      {
        name: 'Implement OAuth2 backend',
        agent: 'developer',
        estimated_duration: '5 days',
        dependencies: ['Design authentication architecture'],
      },
      {
        name: 'Implement JWT middleware',
        agent: 'developer',
        estimated_duration: '3 days',
        dependencies: ['Implement OAuth2 backend'],
      },
      {
        name: 'Frontend authentication flow',
        agent: 'frontend-developer',
        estimated_duration: '4 days',
        dependencies: ['Implement OAuth2 backend'],
      },
      {
        name: 'Security review',
        agent: 'security-architect',
        estimated_duration: '2 days',
        dependencies: ['Implement JWT middleware', 'Frontend authentication flow'],
      },
    ],
    success_criteria: [
      'Users can authenticate via OAuth2',
      'JWT tokens issued and validated',
      'Security audit passes',
      'Test coverage >= 90%',
    ],
    timeline: '16 days total',
    deliverables: ['OAuth2 implementation', 'JWT middleware', 'Frontend auth UI', 'Security audit report'],
    risks: [
      {
        description: 'OAuth2 provider downtime',
        mitigation: 'Implement circuit breaker pattern and fallback authentication',
      },
      {
        description: 'JWT token theft',
        mitigation: 'Use short-lived tokens + refresh token rotation',
      },
      {
        description: 'CSRF attacks',
        mitigation: 'Implement CSRF tokens and SameSite cookie policy',
      },
    ],
    resources: ['2 backend developers', '1 frontend developer', '1 security architect'],
    constraints: ['Must integrate with existing user database', 'Backward compatibility required'],
    integration_points: ['User database', 'OAuth2 provider', 'Frontend application'],
    data_flow: 'User → Frontend → Backend → OAuth2 Provider → JWT issuance',
    backward_compatibility: 'Provide migration path for existing session-based auth',
  };

  // Low-quality plan (should score < 7)
  const lowQualityPlan = {
    business_objective: 'Add authentication',
    steps: [
      { name: 'Add login', agent: 'developer' },
      { name: 'Test', agent: 'qa' },
    ],
  };

  // Medium-quality plan (should score ~7)
  const mediumQualityPlan = {
    business_objective: 'Implement authentication',
    context: 'Need secure authentication',
    steps: [
      { name: 'Design auth', agent: 'architect', estimated_duration: '2 days' },
      { name: 'Implement auth', agent: 'developer', estimated_duration: '5 days' },
      { name: 'Test auth', agent: 'qa', estimated_duration: '2 days' },
    ],
    success_criteria: ['Users can log in', 'Security audit passes'],
    risks: [
      { description: 'Security vulnerabilities', mitigation: 'Code review and security audit' },
    ],
  };

  // Write fixtures
  fs.writeFileSync(
    path.join(FIXTURES_DIR, 'high-quality-plan.json'),
    JSON.stringify(highQualityPlan, null, 2)
  );

  fs.writeFileSync(
    path.join(FIXTURES_DIR, 'low-quality-plan.json'),
    JSON.stringify(lowQualityPlan, null, 2)
  );

  fs.writeFileSync(
    path.join(FIXTURES_DIR, 'medium-quality-plan.json'),
    JSON.stringify(mediumQualityPlan, null, 2)
  );
}

/**
 * Test: High-quality plan should score >= 7
 */
async function testHighQualityPlan() {
  const planPath = path.join(FIXTURES_DIR, 'high-quality-plan.json');
  const result = await ratePlanOffline(planPath);

  console.log('\n=== Test: High-Quality Plan ===');
  console.log(`Overall Score: ${result.overall_score}/10`);
  console.log(`Scores: ${JSON.stringify(result.scores, null, 2)}`);
  console.log(`Summary: ${result.summary}`);

  const passed = result.ok && result.overall_score >= 7;
  console.log(`Result: ${passed ? '✅ PASS' : '❌ FAIL'}`);

  if (!passed) {
    console.error(`Expected score >= 7, got ${result.overall_score}`);
  }

  return passed;
}

/**
 * Test: Low-quality plan should score < 7
 */
async function testLowQualityPlan() {
  const planPath = path.join(FIXTURES_DIR, 'low-quality-plan.json');
  const result = await ratePlanOffline(planPath);

  console.log('\n=== Test: Low-Quality Plan ===');
  console.log(`Overall Score: ${result.overall_score}/10`);
  console.log(`Scores: ${JSON.stringify(result.scores, null, 2)}`);
  console.log(`Summary: ${result.summary}`);

  const passed = result.ok && result.overall_score < 7;
  console.log(`Result: ${passed ? '✅ PASS' : '❌ FAIL'}`);

  if (!passed) {
    console.error(`Expected score < 7, got ${result.overall_score}`);
  }

  return passed;
}

/**
 * Test: Medium-quality plan should score ~7 (6.5-7.5)
 */
async function testMediumQualityPlan() {
  const planPath = path.join(FIXTURES_DIR, 'medium-quality-plan.json');
  const result = await ratePlanOffline(planPath);

  console.log('\n=== Test: Medium-Quality Plan ===');
  console.log(`Overall Score: ${result.overall_score}/10`);
  console.log(`Scores: ${JSON.stringify(result.scores, null, 2)}`);
  console.log(`Summary: ${result.summary}`);

  const passed = result.ok && result.overall_score >= 6.5 && result.overall_score <= 7.5;
  console.log(`Result: ${passed ? '✅ PASS' : '❌ FAIL'}`);

  if (!passed) {
    console.error(`Expected score between 6.5-7.5, got ${result.overall_score}`);
  }

  return passed;
}

/**
 * Test: Offline rating completes within 1 second
 */
async function testPerformance() {
  const planPath = path.join(FIXTURES_DIR, 'high-quality-plan.json');
  const startTime = Date.now();
  const result = await ratePlanOffline(planPath);
  const duration = Date.now() - startTime;

  console.log('\n=== Test: Performance ===');
  console.log(`Duration: ${duration}ms`);

  const passed = duration < 1000;
  console.log(`Result: ${passed ? '✅ PASS' : '❌ FAIL'}`);

  if (!passed) {
    console.error(`Expected duration < 1000ms, got ${duration}ms`);
  }

  return passed;
}

/**
 * Test: Invalid plan file handling
 */
async function testInvalidPlanHandling() {
  const planPath = path.join(FIXTURES_DIR, 'nonexistent.json');
  const result = await ratePlanOffline(planPath);

  console.log('\n=== Test: Invalid Plan Handling ===');
  console.log(`Result: ${JSON.stringify(result, null, 2)}`);

  const passed = !result.ok && result.error;
  console.log(`Result: ${passed ? '✅ PASS' : '❌ FAIL'}`);

  if (!passed) {
    console.error('Expected error for invalid plan file');
  }

  return passed;
}

/**
 * Test: Offline scoring provides improvement suggestions
 */
async function testImprovementSuggestions() {
  const planPath = path.join(FIXTURES_DIR, 'low-quality-plan.json');
  const result = await ratePlanOffline(planPath);

  console.log('\n=== Test: Improvement Suggestions ===');
  console.log(`Improvements: ${JSON.stringify(result.improvements, null, 2)}`);

  const passed = result.ok && result.improvements && result.improvements.length > 0;
  console.log(`Result: ${passed ? '✅ PASS' : '❌ FAIL'}`);

  if (!passed) {
    console.error('Expected improvement suggestions for low-quality plan');
  }

  return passed;
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('======================================');
  console.log('Offline Plan Rating Test Suite');
  console.log('======================================');

  // Create test fixtures
  createTestFixtures();

  const tests = [
    testHighQualityPlan,
    testLowQualityPlan,
    testMediumQualityPlan,
    testPerformance,
    testInvalidPlanHandling,
    testImprovementSuggestions,
  ];

  const results = [];
  for (const test of tests) {
    try {
      const passed = await test();
      results.push(passed);
    } catch (error) {
      console.error(`\n❌ Test failed with exception: ${error.message}`);
      results.push(false);
    }
  }

  // Summary
  const totalTests = results.length;
  const passedTests = results.filter(Boolean).length;
  const failedTests = totalTests - passedTests;

  console.log('\n======================================');
  console.log('Test Summary');
  console.log('======================================');
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests} ✅`);
  console.log(`Failed: ${failedTests} ❌`);
  console.log(`Pass Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

  process.exit(failedTests > 0 ? 1 : 0);
}

// Run tests
runTests().catch((error) => {
  console.error(`Fatal error: ${error.message}`);
  process.exit(1);
});
