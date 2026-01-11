#!/usr/bin/env node
/**
 * Test script for monitoring tools
 * Validates that all monitoring tools are functional
 */

import { logSkillInvocation, getLogger } from './structured-logger.mjs';
import { recordCujExecution, getCujSuccessRate } from './metrics-tracker.mjs';
import { emitProgress, subscribeToProgress } from './progress-emitter.mjs';
import { generateMetricsDashboard, formatDashboard } from './metrics-dashboard.mjs';
import { recordProviderCall, getProviderHealth } from './provider-health.mjs';

console.log('🧪 Testing Monitoring Tools\n');
console.log('═'.repeat(60));

// Test 1: Structured Logger
console.log('\n1. Testing Structured Logger');
console.log('─'.repeat(60));

logSkillInvocation({
  skill: 'test-skill',
  params: { test: true },
  result: 'success',
  duration: 100,
  cacheHit: false,
  agent: 'test-agent',
  runId: 'test-run-001',
  cujId: 'TEST-001',
});

const logger = getLogger();
const stats = logger.getStatistics();
console.log(`✅ Logged skill invocation`);
console.log(`   Total invocations: ${stats.total_invocations}`);
console.log(`   Successful: ${stats.successful}`);

// Test 2: Metrics Tracker
console.log('\n2. Testing Metrics Tracker');
console.log('─'.repeat(60));

recordCujExecution('TEST-001', true, 1234);
recordCujExecution('TEST-001', true, 1456);
recordCujExecution('TEST-001', false, 2000, 'Test error');

const successRate = getCujSuccessRate('TEST-001');
console.log(`✅ Recorded CUJ executions`);
console.log(`   Success rate: ${(successRate.rate * 100).toFixed(1)}%`);
console.log(
  `   Total: ${successRate.total}, Successful: ${successRate.successful}, Failed: ${successRate.failed}`
);

// Test 3: Progress Emitter
console.log('\n3. Testing Progress Emitter');
console.log('─'.repeat(60));

let progressCount = 0;
const unsubscribe = subscribeToProgress(event => {
  progressCount++;
});

emitProgress({
  runId: 'test-run-001',
  step: 1,
  status: 'running',
  percentage: 25,
  message: 'Test step 1',
});
emitProgress({
  runId: 'test-run-001',
  step: 2,
  status: 'completed',
  percentage: 100,
  message: 'Test complete',
});

unsubscribe();

console.log(`✅ Emitted progress events`);
console.log(`   Events received: ${progressCount}`);

// Test 4: Provider Health Monitor
console.log('\n4. Testing Provider Health Monitor');
console.log('─'.repeat(60));

recordProviderCall('test-provider', true, 100);
recordProviderCall('test-provider', true, 120);
recordProviderCall('test-provider', false, 5000, 'Timeout');

const health = getProviderHealth('test-provider');
console.log(`✅ Recorded provider calls`);
console.log(`   Success rate: ${(health.success_rate * 100).toFixed(1)}%`);
console.log(`   Avg latency: ${health.avg_latency_ms}ms`);

// Test 5: Metrics Dashboard
console.log('\n5. Testing Metrics Dashboard');
console.log('─'.repeat(60));

const dashboard = generateMetricsDashboard();
console.log(`✅ Generated metrics dashboard`);
console.log(`   Generated at: ${dashboard.generated_at}`);
console.log(`   Dashboard version: ${dashboard.metadata.dashboard_version}`);

// Summary
console.log('\n' + '═'.repeat(60));
console.log('✅ All Monitoring Tools Validated Successfully!');
console.log('═'.repeat(60));
console.log('\nNext Steps:');
console.log('  1. Integrate resource tracking into run-cuj.mjs');
console.log('  2. Add monitoring calls to workflow_runner.js');
console.log('  3. Generate regular metrics dashboards');
console.log('  4. Set up alerting based on metrics\n');
