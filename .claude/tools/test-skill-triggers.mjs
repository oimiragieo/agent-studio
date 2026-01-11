#!/usr/bin/env node

/**
 * Test Skill Trigger Detection
 *
 * Validates that skill trigger detection works correctly for various agents and tasks.
 *
 * Usage:
 *   node test-skill-triggers.mjs
 */

import { detectAllSkills } from './skill-trigger-detector.mjs';

// Test cases
const testCases = [
  {
    name: 'Developer: Create component',
    agent: 'developer',
    task: 'Create a new UserProfile component with TypeScript',
    expectedTriggered: ['scaffolder'],
    expectedTriggers: ['new_component'],
  },
  {
    name: 'Developer: Modify code',
    agent: 'developer',
    task: 'Modify the authentication logic to support OAuth2',
    expectedTriggered: ['rule-auditor'],
    expectedTriggers: ['code_changes'],
  },
  {
    name: 'Code Reviewer: Review code',
    agent: 'code-reviewer',
    task: 'Review the security changes in the authentication module',
    expectedTriggered: ['rule-auditor'],
    expectedTriggers: ['review_code'],
  },
  {
    name: 'Orchestrator: Validate plan',
    agent: 'orchestrator',
    task: 'Review and rate the implementation plan for quality',
    expectedTriggered: ['response-rater'],
    expectedTriggers: ['plan_validation'],
  },
  {
    name: 'QA: Create tests',
    agent: 'qa',
    task: 'Write unit tests for the UserProfile component',
    expectedTriggered: ['test-generator'],
    expectedTriggers: ['test_creation'],
  },
  {
    name: 'Architect: Create diagram',
    agent: 'architect',
    task: 'Create an architecture diagram for the authentication system',
    expectedTriggered: ['diagram-generator'],
    expectedTriggers: ['architecture_diagram'],
  },
  {
    name: 'Developer: Multiple triggers',
    agent: 'developer',
    task: 'Create a new API module with tests and documentation',
    expectedTriggered: ['scaffolder', 'test-generator'],
    expectedTriggers: ['new_component', 'new_module', 'test_creation'],
  },
  {
    name: 'Security Architect: Security audit',
    agent: 'security-architect',
    task: 'Audit the codebase for security vulnerabilities',
    expectedTriggered: ['rule-auditor', 'dependency-analyzer'],
    expectedTriggers: ['security_audit'],
  },
];

// Test runner
async function runTests() {
  console.log('🧪 Testing Skill Trigger Detection\n');

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    console.log(`\n📋 Test: ${testCase.name}`);
    console.log(`   Agent: ${testCase.agent}`);
    console.log(`   Task: "${testCase.task}"`);

    try {
      const result = await detectAllSkills(testCase.agent, testCase.task);

      console.log(`   ✓ Required skills: ${result.required.join(', ')}`);
      console.log(`   ✓ Triggered skills: ${result.triggered.join(', ') || 'none'}`);
      console.log(`   ✓ Matched triggers: ${result.matchedTriggers.join(', ') || 'none'}`);

      // Validate triggered skills
      let triggerMatch = true;
      for (const expectedSkill of testCase.expectedTriggered) {
        if (!result.triggered.includes(expectedSkill) && !result.required.includes(expectedSkill)) {
          console.log(`   ❌ FAIL: Expected triggered skill "${expectedSkill}" not found`);
          triggerMatch = false;
        }
      }

      // Validate triggers (at least one expected trigger should match)
      let triggerKeywordMatch = false;
      for (const expectedTrigger of testCase.expectedTriggers) {
        if (result.matchedTriggers.includes(expectedTrigger)) {
          triggerKeywordMatch = true;
          break;
        }
      }

      if (!triggerKeywordMatch && testCase.expectedTriggers.length > 0) {
        console.log(
          `   ⚠️  WARNING: None of the expected triggers matched: ${testCase.expectedTriggers.join(', ')}`
        );
        console.log(`   📝 Note: This may be okay if skill is required by default`);
      }

      if (triggerMatch) {
        console.log(`   ✅ PASS`);
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
      failed++;
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log(`\n📊 Test Results:`);
  console.log(`   Passed: ${passed}/${testCases.length}`);
  console.log(`   Failed: ${failed}/${testCases.length}`);

  if (failed === 0) {
    console.log('\n✅ All tests passed!');
  } else {
    console.log(`\n❌ ${failed} test(s) failed`);
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});
