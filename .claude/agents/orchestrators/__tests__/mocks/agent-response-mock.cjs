#!/usr/bin/env node
/**
 * Agent Response Mock
 * ===================
 *
 * Mocks agent responses for orchestrator testing.
 * Provides realistic agent outputs for different scenarios.
 */

'use strict';

/**
 * Generate mock response for different agent types
 */
function generateMockResponse(agentType, scenario = 'success') {
  const responses = {
    developer: {
      success: {
        output: 'Feature implemented successfully',
        filesModified: ['src/feature.ts', 'src/feature.test.ts'],
        testsAdded: 5,
        testsPassing: true,
      },
      failure: {
        error: 'Syntax error in implementation',
        filesModified: ['src/feature.ts'],
        testsAdded: 0,
        testsPassing: false,
      },
    },
    architect: {
      success: {
        output: 'System design complete',
        diagrams: ['.claude/context/artifacts/diagrams/feature-design.mermaid'],
        decisions: ['Use REST API', 'PostgreSQL for persistence'],
      },
      failure: {
        error: 'Requirements unclear',
        needsClarification: ['What is the expected throughput?'],
      },
    },
    qa: {
      success: {
        output: 'All tests passing',
        testsRun: 42,
        testsPassing: 42,
        coverage: '95%',
      },
      failure: {
        error: 'Tests failing',
        testsRun: 42,
        testsPassing: 38,
        failures: [
          'test/auth.test.ts:23 - Expected 200, got 401',
          'test/api.test.ts:45 - Timeout after 5s',
        ],
      },
    },
    planner: {
      success: {
        output: 'Task breakdown complete',
        tasks: [
          {
            id: 'T1',
            subject: 'Design API',
            assignedTo: 'architect',
          },
          {
            id: 'T2',
            subject: 'Implement API',
            assignedTo: 'developer',
            blockedBy: ['T1'],
          },
          { id: 'T3', subject: 'Test API', assignedTo: 'qa', blockedBy: ['T2'] },
        ],
      },
      failure: {
        error: 'Scope too vague',
        needsClarification: ['What does "add auth" mean exactly?'],
      },
    },
    'security-architect': {
      success: {
        output: 'Security review complete',
        findings: [
          {
            severity: 'MEDIUM',
            issue: 'Rate limiting not implemented',
            recommendation: 'Add rate limiting middleware',
          },
        ],
        approved: true,
      },
      failure: {
        output: 'Security review failed',
        findings: [
          {
            severity: 'CRITICAL',
            issue: 'SQL injection vulnerability',
            file: 'src/db/query.ts:45',
            recommendation: 'Use parameterized queries',
          },
        ],
        approved: false,
      },
    },
  };

  return responses[agentType]?.[scenario] || { output: 'Generic response' };
}

/**
 * Generate mock agent completion with realistic timing
 */
function generateMockCompletion(agentType, scenario = 'success') {
  const response = generateMockResponse(agentType, scenario);

  return {
    taskId: `task-${Math.floor(Math.random() * 1000)}`,
    agentType,
    status: scenario === 'success' ? 'completed' : 'failed',
    startedAt: new Date(Date.now() - 5000).toISOString(),
    completedAt: new Date().toISOString(),
    duration: 5000,
    ...response,
  };
}

/**
 * Simulate agent timeout (never completes)
 */
function generateMockTimeout(agentType) {
  return {
    taskId: `task-${Math.floor(Math.random() * 1000)}`,
    agentType,
    status: 'timeout',
    startedAt: new Date(Date.now() - 60000).toISOString(),
    completedAt: null,
    duration: null,
    error: 'Agent exceeded timeout (10 minutes)',
  };
}

/**
 * Simulate partial agent response (still in progress)
 */
function generateMockPartial(agentType, progress) {
  return {
    taskId: `task-${Math.floor(Math.random() * 1000)}`,
    agentType,
    status: 'in_progress',
    startedAt: new Date(Date.now() - 2000).toISOString(),
    completedAt: null,
    duration: null,
    progress,
    output: `Progress: ${progress}`,
  };
}

module.exports = {
  generateMockResponse,
  generateMockCompletion,
  generateMockTimeout,
  generateMockPartial,
};
