#!/usr/bin/env node
/**
 * Comprehensive Memory Leak Test for Skill Injection Hook
 *
 * Simulates long-running sessions with thousands of hook calls to verify
 * memory leak fixes are working correctly.
 *
 * Usage:
 *   node .claude/tools/test-skill-injection-memory.mjs
 *   node .claude/tools/test-skill-injection-memory.mjs --iterations 10000 --agents developer,qa,architect
 */

import {
  injectSkillsForAgent,
  getSkillContentCacheStats,
  clearSkillContentCache,
} from './skill-injector.mjs';
import { getMemoryUsage, canSpawnSubagent } from './memory-monitor.mjs';
import { readFile } from 'fs/promises';
import { stdin, stdout, stderr } from 'process';

const DEFAULT_ITERATIONS = 5000;
const MEMORY_CHECK_INTERVAL = 100; // Check memory every 100 iterations
const MAX_MEMORY_MB = 3500; // Fail if memory exceeds this

/**
 * Simulate a Task tool call (what the hook receives)
 */
function createTaskCall(agentType, prompt) {
  return {
    tool: 'Task',
    input: {
      subagent_type: agentType,
      prompt: prompt,
    },
  };
}

/**
 * Test skill injection with memory monitoring
 */
async function testSkillInjection(agentType, prompt, iteration) {
  const memoryBefore = getMemoryUsage();

  try {
    const result = await injectSkillsForAgent(agentType, prompt, {
      includeRecommended: false,
    });

    const memoryAfter = getMemoryUsage();
    const memoryDelta = memoryAfter.rssMB - memoryBefore.rssMB;

    return {
      success: result.success,
      memoryDelta,
      memoryAfter: memoryAfter.rssMB,
      loadedSkills: result.loadedSkills.length,
      cacheStats: getSkillContentCacheStats(),
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      memoryAfter: getMemoryUsage().rssMB,
    };
  }
}

/**
 * Run comprehensive memory leak test
 */
async function runMemoryLeakTest(options = {}) {
  const {
    iterations = DEFAULT_ITERATIONS,
    agentTypes = ['developer', 'qa', 'architect', 'orchestrator', 'planner'],
    verbose = false,
  } = options;

  console.log('🧪 Starting Skill Injection Memory Leak Test');
  console.log(`   Iterations: ${iterations}`);
  console.log(`   Agents: ${agentTypes.join(', ')}`);
  console.log('');

  const initialMemory = getMemoryUsage();
  console.log(`📊 Initial Memory:`);
  console.log(`   RSS: ${initialMemory.rssMB.toFixed(2)}MB`);
  console.log(`   Heap Used: ${initialMemory.heapUsedMB.toFixed(2)}MB`);
  console.log('');

  const results = {
    total: 0,
    successful: 0,
    failed: 0,
    memoryChecks: [],
    maxMemoryMB: initialMemory.rssMB,
    minMemoryMB: initialMemory.rssMB,
    cacheStats: [],
  };

  // Clear cache before starting
  clearSkillContentCache();

  for (let i = 0; i < iterations; i++) {
    const agentType = agentTypes[i % agentTypes.length];
    const prompt = `Test task ${i}: Create component and test it`;

    if (verbose && i % 100 === 0) {
      console.log(`⏳ Iteration ${i}/${iterations}...`);
    }

    const result = await testSkillInjection(agentType, prompt, i);
    results.total++;

    if (result.success) {
      results.successful++;
    } else {
      results.failed++;
      if (verbose) {
        console.error(`❌ Iteration ${i} failed: ${result.error}`);
      }
    }

    // Track memory
    const currentMemory = getMemoryUsage();
    if (currentMemory.rssMB > results.maxMemoryMB) {
      results.maxMemoryMB = currentMemory.rssMB;
    }
    if (currentMemory.rssMB < results.minMemoryMB) {
      results.minMemoryMB = currentMemory.rssMB;
    }

    // Periodic memory checks
    if (i % MEMORY_CHECK_INTERVAL === 0) {
      const memory = getMemoryUsage();
      const cacheStats = getSkillContentCacheStats();

      results.memoryChecks.push({
        iteration: i,
        rssMB: memory.rssMB,
        heapUsedMB: memory.heapUsedMB,
        cacheSize: cacheStats.size,
        cacheSizeMB: parseFloat(cacheStats.estimatedSizeMB),
      });

      if (verbose) {
        console.log(
          `   [${i}] Memory: ${memory.rssMB.toFixed(2)}MB RSS, Cache: ${cacheStats.size} skills (${cacheStats.estimatedSizeMB}MB)`
        );
      }

      // Fail if memory exceeds threshold
      if (memory.rssMB > MAX_MEMORY_MB) {
        console.error(`\n❌ TEST FAILED: Memory exceeded threshold at iteration ${i}`);
        console.error(`   Memory: ${memory.rssMB.toFixed(2)}MB (threshold: ${MAX_MEMORY_MB}MB)`);
        return {
          passed: false,
          reason: 'memory_exceeded',
          iteration: i,
          results,
        };
      }
    }

    // Periodic cache cleanup simulation (every 500 iterations)
    if (i % 500 === 0 && i > 0) {
      const cacheStats = getSkillContentCacheStats();
      results.cacheStats.push({
        iteration: i,
        ...cacheStats,
      });
    }
  }

  const finalMemory = getMemoryUsage();
  const memoryIncrease = finalMemory.rssMB - initialMemory.rssMB;
  const memoryIncreasePercent = ((memoryIncrease / initialMemory.rssMB) * 100).toFixed(2);

  console.log('\n📊 Test Results:');
  console.log(`   Total Iterations: ${results.total}`);
  console.log(`   Successful: ${results.successful}`);
  console.log(`   Failed: ${results.failed}`);
  console.log(`   Success Rate: ${((results.successful / results.total) * 100).toFixed(2)}%`);
  console.log('');
  console.log('📈 Memory Statistics:');
  console.log(`   Initial RSS: ${initialMemory.rssMB.toFixed(2)}MB`);
  console.log(`   Final RSS: ${finalMemory.rssMB.toFixed(2)}MB`);
  console.log(`   Increase: ${memoryIncrease.toFixed(2)}MB (${memoryIncreasePercent}%)`);
  console.log(`   Max RSS: ${results.maxMemoryMB.toFixed(2)}MB`);
  console.log(`   Min RSS: ${results.minMemoryMB.toFixed(2)}MB`);
  console.log('');

  const finalCacheStats = getSkillContentCacheStats();
  console.log('💾 Cache Statistics:');
  console.log(`   Cached Skills: ${finalCacheStats.size}`);
  console.log(`   Cache Size: ${finalCacheStats.estimatedSizeMB}MB`);
  console.log(`   Max Size: ${finalCacheStats.maxSize} skills`);
  console.log('');

  // Analyze memory growth
  if (results.memoryChecks.length > 0) {
    const firstCheck = results.memoryChecks[0];
    const lastCheck = results.memoryChecks[results.memoryChecks.length - 1];
    const memoryGrowth = lastCheck.rssMB - firstCheck.rssMB;
    const growthPerIteration = memoryGrowth / (iterations / MEMORY_CHECK_INTERVAL);

    console.log('📉 Memory Growth Analysis:');
    console.log(`   First Check (${firstCheck.iteration}): ${firstCheck.rssMB.toFixed(2)}MB`);
    console.log(`   Last Check (${lastCheck.iteration}): ${lastCheck.rssMB.toFixed(2)}MB`);
    console.log(`   Total Growth: ${memoryGrowth.toFixed(2)}MB`);
    console.log(
      `   Growth per ${MEMORY_CHECK_INTERVAL} iterations: ${growthPerIteration.toFixed(2)}MB`
    );
    console.log('');
  }

  // Determine if test passed
  const passed = memoryIncrease < 500 && results.failed < results.total * 0.01; // Less than 500MB increase and <1% failure rate

  if (passed) {
    console.log('✅ TEST PASSED: Memory leak appears to be fixed!');
    console.log(`   Memory increase (${memoryIncrease.toFixed(2)}MB) is within acceptable limits`);
    console.log(
      `   Failure rate (${((results.failed / results.total) * 100).toFixed(2)}%) is acceptable`
    );
  } else {
    console.log('❌ TEST FAILED: Potential memory leak detected');
    if (memoryIncrease >= 500) {
      console.log(`   Memory increased by ${memoryIncrease.toFixed(2)}MB (threshold: 500MB)`);
    }
    if (results.failed >= results.total * 0.01) {
      console.log(
        `   Failure rate ${((results.failed / results.total) * 100).toFixed(2)}% exceeds 1%`
      );
    }
  }

  return {
    passed,
    results: {
      ...results,
      initialMemory: initialMemory.rssMB,
      finalMemory: finalMemory.rssMB,
      memoryIncrease,
      memoryIncreasePercent: parseFloat(memoryIncreasePercent),
    },
  };
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);

  const iterationsIndex = args.indexOf('--iterations');
  const iterations =
    iterationsIndex !== -1 && iterationsIndex + 1 < args.length
      ? parseInt(args[iterationsIndex + 1])
      : DEFAULT_ITERATIONS;

  const agentsIndex = args.indexOf('--agents');
  const agentTypes =
    agentsIndex !== -1 && agentsIndex + 1 < args.length
      ? args[agentsIndex + 1].split(',')
      : ['developer', 'qa', 'architect', 'orchestrator', 'planner'];

  const verbose = args.includes('--verbose') || args.includes('-v');

  try {
    const result = await runMemoryLeakTest({
      iterations,
      agentTypes,
      verbose,
    });

    process.exit(result.passed ? 0 : 1);
  } catch (error) {
    console.error('Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (
  import.meta.url === `file://${process.argv[1]}` ||
  import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`
) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { runMemoryLeakTest };
