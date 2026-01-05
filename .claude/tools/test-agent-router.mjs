#!/usr/bin/env node
/**
 * Test Agent Router
 *
 * Test the agent routing system with various task examples
 */

import { selectAgents } from './agent-router.mjs';

const testCases = [
  {
    name: 'Mobile Authentication',
    task: 'Add user authentication to the mobile app',
    expected: {
      taskType: 'MOBILE',
      primaryAgent: 'mobile-developer',
      hasCrossCutting: true,
      crossCuttingAgents: ['security-architect']
    }
  },
  {
    name: 'Database Migration',
    task: 'Create database schema migration for user profiles',
    expected: {
      taskType: 'DATABASE',
      primaryAgent: 'database-architect',
      hasCrossCutting: true,
      crossCuttingAgents: ['database-architect']
    }
  },
  {
    name: 'UI Bug Fix',
    task: 'Fix button alignment issue in the login form',
    expected: {
      taskType: 'UI_UX',
      primaryAgent: 'ux-expert'
    }
  },
  {
    name: 'API Performance',
    task: 'Optimize slow API endpoint for user search',
    expected: {
      taskType: 'PERFORMANCE',
      primaryAgent: 'performance-engineer',
      hasCrossCutting: true,
      crossCuttingAgents: ['performance-engineer']
    }
  },
  {
    name: 'Security Audit',
    task: 'Audit authentication system for GDPR compliance',
    expected: {
      taskType: 'SECURITY',
      primaryAgent: 'security-architect',
      hasCrossCutting: true,
      crossCuttingAgents: ['security-architect', 'compliance-auditor']
    }
  },
  {
    name: 'Documentation Update',
    task: 'Update API documentation for new endpoints',
    expected: {
      taskType: 'DOCUMENTATION',
      primaryAgent: 'technical-writer'
    }
  },
  {
    name: 'Production Incident',
    task: 'Fix production outage in payment processing system',
    expected: {
      taskType: 'INCIDENT',
      primaryAgent: 'incident-responder',
      hasCrossCutting: true,
      crossCuttingAgents: ['incident-responder']
    }
  },
  {
    name: 'Legacy Modernization',
    task: 'Modernize legacy monolith to microservices architecture',
    expected: {
      taskType: 'LEGACY',
      primaryAgent: 'legacy-modernizer'
    }
  },
  {
    name: 'AI Feature',
    task: 'Implement RAG system with embeddings for document search',
    expected: {
      taskType: 'AI_LLM',
      primaryAgent: 'llm-architect'
    }
  },
  {
    name: 'Infrastructure Setup',
    task: 'Set up CI/CD pipeline with Kubernetes deployment',
    expected: {
      taskType: 'INFRASTRUCTURE',
      primaryAgent: 'devops',
      hasCrossCutting: true,
      crossCuttingAgents: ['devops']
    }
  }
];

async function runTests() {
  console.log('Testing Agent Router\n');
  console.log('='.repeat(80));

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    console.log(`\nTest: ${testCase.name}`);
    console.log(`Task: "${testCase.task}"`);

    try {
      const result = await selectAgents(testCase.task, { verbose: true });

      // Validate task type
      const taskTypeMatch = result.taskType === testCase.expected.taskType;
      console.log(`  Task Type: ${result.taskType} ${taskTypeMatch ? '✓' : '✗ (expected ' + testCase.expected.taskType + ')'}`);

      // Validate primary agent
      const primaryMatch = result.primary === testCase.expected.primaryAgent;
      console.log(`  Primary Agent: ${result.primary} ${primaryMatch ? '✓' : '✗ (expected ' + testCase.expected.primaryAgent + ')'}`);

      // Validate cross-cutting
      if (testCase.expected.hasCrossCutting) {
        const hasCrossCutting = result.crossCutting.length > 0;
        console.log(`  Cross-Cutting Agents: ${result.crossCutting.join(', ')} ${hasCrossCutting ? '✓' : '✗'}`);

        if (testCase.expected.crossCuttingAgents) {
          const allPresent = testCase.expected.crossCuttingAgents.every(agent =>
            result.crossCutting.includes(agent)
          );
          console.log(`  Expected Agents Present: ${allPresent ? '✓' : '✗'}`);
        }
      }

      // Show full chain
      console.log(`  Full Chain: ${result.fullChain.join(' → ')}`);

      // Show complexity and gates
      console.log(`  Complexity: ${result.complexity}`);
      console.log(`  Gates: Planner=${result.gates.planner}, Review=${result.gates.review}, Impact=${result.gates.impactAnalysis}`);

      if (taskTypeMatch && primaryMatch) {
        passed++;
        console.log(`  Result: ✓ PASS`);
      } else {
        failed++;
        console.log(`  Result: ✗ FAIL`);
      }
    } catch (error) {
      failed++;
      console.log(`  Error: ${error.message}`);
      console.log(`  Result: ✗ FAIL`);
    }

    console.log('-'.repeat(80));
  }

  console.log(`\nTest Summary: ${passed}/${testCases.length} passed, ${failed}/${testCases.length} failed`);

  if (failed === 0) {
    console.log('✓ All tests passed!');
    process.exit(0);
  } else {
    console.log('✗ Some tests failed');
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});
