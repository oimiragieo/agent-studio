#!/usr/bin/env node
/**
 * Validate Security Integration
 *
 * Tests the security enforcement integration to ensure all components work correctly.
 */

import { selectAgents } from './agent-router.mjs';
import { checkSecurityTriggers, getSecurityRequirements } from './security-enforcement.mjs';

const testCases = [
  {
    name: 'Critical: Authentication',
    task: 'Add OAuth authentication for users',
    expectedPriority: 'critical',
    expectedBlocking: true,
    expectedCategories: ['authentication']
  },
  {
    name: 'Critical: Authorization + Secrets',
    task: 'Implement RBAC with JWT tokens',
    expectedPriority: 'critical',
    expectedBlocking: true,
    expectedCategories: ['authorization', 'secrets_management']
  },
  {
    name: 'Critical: Data Protection + Compliance',
    task: 'Implement GDPR-compliant data encryption',
    expectedPriority: 'critical',
    expectedBlocking: true,
    expectedCategories: ['data_protection', 'compliance']
  },
  {
    name: 'High: Network Security',
    task: 'Add CORS and WAF configuration',
    expectedPriority: 'high',
    expectedBlocking: true,
    expectedCategories: ['network_security']
  },
  {
    name: 'Medium: Logging',
    task: 'Add security event logging and monitoring',
    expectedPriority: 'medium',
    expectedBlocking: false,
    expectedCategories: ['logging_monitoring']
  },
  {
    name: 'Non-Security: UI Component',
    task: 'Add new button component',
    expectedPriority: 'low',
    expectedBlocking: false,
    expectedCategories: []
  }
];

let passed = 0;
let failed = 0;

console.log('🔐 Security Integration Validation\n');
console.log('=' .repeat(80));

for (const testCase of testCases) {
  console.log(`\n📋 Test: ${testCase.name}`);
  console.log(`   Task: "${testCase.task}"`);

  try {
    // Test security enforcement
    const securityCheck = await checkSecurityTriggers(testCase.task);

    // Test agent routing
    const routing = await selectAgents(testCase.task);

    // Validate priority
    const priorityMatch = securityCheck.priority === testCase.expectedPriority;
    console.log(`   Priority: ${securityCheck.priority} ${priorityMatch ? '✅' : '❌ Expected: ' + testCase.expectedPriority}`);

    // Validate blocking
    const blockingMatch = securityCheck.blocking === testCase.expectedBlocking;
    console.log(`   Blocking: ${securityCheck.blocking} ${blockingMatch ? '✅' : '❌ Expected: ' + testCase.expectedBlocking}`);

    // Validate categories
    const categoriesMatch = testCase.expectedCategories.length === 0
      ? securityCheck.categories.length === 0
      : testCase.expectedCategories.every(cat => securityCheck.categories.includes(cat));
    console.log(`   Categories: ${securityCheck.categories.join(', ') || 'none'} ${categoriesMatch ? '✅' : '❌ Expected: ' + testCase.expectedCategories.join(', ')}`);

    // Validate routing integration
    const routingBlocked = routing.blocked === testCase.expectedBlocking;
    console.log(`   Routing Blocked: ${routing.blocked} ${routingBlocked ? '✅' : '❌ Expected: ' + testCase.expectedBlocking}`);

    // Validate security-architect in chain for security tasks
    const hasSecurityArchitect = routing.fullChain.includes('security-architect');
    const shouldHaveSecurityArchitect = securityCheck.categories.length > 0; // Any security category should trigger security-architect
    const securityArchitectMatch = hasSecurityArchitect === shouldHaveSecurityArchitect;
    console.log(`   Security-Architect in Chain: ${hasSecurityArchitect} ${securityArchitectMatch ? '✅' : '❌'}`);

    if (priorityMatch && blockingMatch && categoriesMatch && routingBlocked && securityArchitectMatch) {
      console.log(`   Result: ✅ PASSED`);
      passed++;
    } else {
      console.log(`   Result: ❌ FAILED`);
      failed++;
    }
  } catch (error) {
    console.log(`   Result: ❌ ERROR - ${error.message}`);
    failed++;
  }
}

console.log('\n' + '='.repeat(80));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed (${testCases.length} total)`);

if (failed === 0) {
  console.log('\n✅ All tests passed! Security enforcement integration is working correctly.\n');
  process.exit(0);
} else {
  console.log(`\n❌ ${failed} test(s) failed. Please review the integration.\n`);
  process.exit(1);
}
