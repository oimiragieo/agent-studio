/**
 * Pattern Learning Engine - Usage Examples
 *
 * This file demonstrates practical usage of the PatternLearner class.
 * Run: node .claude/tools/memory/pattern-learner.example.mjs
 */

import { createMemoryDatabase } from './database.mjs';
import { createPatternLearner } from './pattern-learner.mjs';
import { existsSync, unlinkSync } from 'fs';

const EXAMPLE_DB_PATH = '.claude/context/memory/example-patterns.db';

/**
 * Example 1: Track Workflow Patterns
 */
async function exampleWorkflowTracking() {
  console.log('\n=== Example 1: Track Workflow Patterns ===\n');

  // Setup
  const db = createMemoryDatabase(EXAMPLE_DB_PATH);
  await db.initialize();
  const learner = createPatternLearner(db);

  // Simulate recording successful workflows
  console.log('Recording workflow patterns...');

  const workflows = [
    {
      name: 'feature-implementation',
      sequence: ['architect', 'developer', 'code-reviewer', 'qa'],
      success_rate: 0.95,
      avg_duration_hours: 4.5,
    },
    {
      name: 'bug-fix',
      sequence: ['developer', 'qa'],
      success_rate: 0.92,
      avg_duration_hours: 1.2,
    },
    {
      name: 'security-audit',
      sequence: ['security-architect', 'developer', 'code-reviewer', 'qa'],
      success_rate: 0.88,
      avg_duration_hours: 6.0,
    },
  ];

  // Record each workflow multiple times
  for (const workflow of workflows) {
    const frequency = Math.floor(Math.random() * 20) + 5; // 5-24 times
    for (let i = 0; i < frequency; i++) {
      await learner.recordPattern('workflow', workflow);
    }
    console.log(`✓ Recorded "${workflow.name}" ${frequency} times`);
  }

  // Get most frequent workflows
  console.log('\nTop 3 Workflow Patterns:');
  const topWorkflows = await learner.getFrequentPatterns('workflow', 3, 0.3);

  topWorkflows.forEach((pattern, index) => {
    console.log(`${index + 1}. ${pattern.data.name}`);
    console.log(`   Sequence: ${pattern.data.sequence.join(' → ')}`);
    console.log(`   Frequency: ${pattern.frequency} times`);
    console.log(`   Confidence: ${(pattern.confidence * 100).toFixed(1)}%`);
    console.log(`   Success Rate: ${(pattern.data.success_rate * 100).toFixed(1)}%`);
    console.log('');
  });

  // Cleanup
  db.close();
}

/**
 * Example 2: Learn Error Resolution Patterns
 */
async function exampleErrorResolution() {
  console.log('\n=== Example 2: Learn Error Resolution Patterns ===\n');

  // Setup
  const db = createMemoryDatabase(EXAMPLE_DB_PATH);
  await db.initialize();
  const learner = createPatternLearner(db);

  console.log('Recording error resolution patterns...');

  const errorPatterns = [
    {
      errorType: 'TypeError: Cannot read property of undefined',
      solution: 'Add null check before property access',
      success_rate: 0.95,
    },
    {
      errorType: 'ReferenceError: variable is not defined',
      solution: 'Add variable declaration or import statement',
      success_rate: 0.98,
    },
    {
      errorType: 'SyntaxError: Unexpected token',
      solution: 'Check for missing brackets or commas',
      success_rate: 0.85,
    },
    {
      errorType: 'TypeError: X is not a function',
      solution: 'Verify function name and check if imported correctly',
      success_rate: 0.92,
    },
  ];

  // Record error patterns
  for (const error of errorPatterns) {
    const frequency = Math.floor(Math.random() * 15) + 3; // 3-17 times
    for (let i = 0; i < frequency; i++) {
      await learner.recordPattern('error_pattern', error);
    }
    console.log(`✓ Recorded "${error.errorType}" ${frequency} times`);
  }

  // Get high-confidence error solutions
  console.log('\nHigh-Confidence Error Solutions (>60%):');
  const errorSolutions = await learner.getFrequentPatterns('error_pattern', 5, 0.6);

  errorSolutions.forEach((pattern, index) => {
    console.log(`${index + 1}. Error: ${pattern.data.errorType}`);
    console.log(`   Solution: ${pattern.data.solution}`);
    console.log(`   Seen: ${pattern.frequency} times`);
    console.log(`   Confidence: ${(pattern.confidence * 100).toFixed(1)}%`);
    console.log('');
  });

  // Cleanup
  db.close();
}

/**
 * Example 3: Track Tool Usage Patterns
 */
async function exampleToolSequences() {
  console.log('\n=== Example 3: Track Tool Usage Patterns ===\n');

  // Setup
  const db = createMemoryDatabase(EXAMPLE_DB_PATH);
  await db.initialize();
  const learner = createPatternLearner(db);

  console.log('Recording tool usage patterns...');

  const toolPatterns = [
    {
      tools: ['Read', 'Edit', 'Bash'],
      purpose: 'File modification with validation',
      efficiency: 'high',
    },
    {
      tools: ['Grep', 'Read', 'Edit'],
      purpose: 'Search and replace',
      efficiency: 'medium',
    },
    {
      tools: ['Read', 'Write'],
      purpose: 'File creation',
      efficiency: 'high',
    },
    {
      tools: ['Glob', 'Read', 'Edit', 'Bash'],
      purpose: 'Batch file operations',
      efficiency: 'medium',
    },
  ];

  // Record tool sequences
  for (const toolPattern of toolPatterns) {
    const frequency = Math.floor(Math.random() * 25) + 5; // 5-29 times
    for (let i = 0; i < frequency; i++) {
      await learner.recordPattern('tool_sequence', toolPattern);
    }
    console.log(`✓ Recorded "${toolPattern.purpose}" ${frequency} times`);
  }

  // Get frequent tool sequences
  console.log('\nMost Used Tool Sequences:');
  const toolSequences = await learner.getFrequentPatterns('tool_sequence', 4, 0.3);

  toolSequences.forEach((pattern, index) => {
    console.log(`${index + 1}. ${pattern.data.tools.join(' → ')}`);
    console.log(`   Purpose: ${pattern.data.purpose}`);
    console.log(`   Efficiency: ${pattern.data.efficiency}`);
    console.log(`   Used: ${pattern.frequency} times`);
    console.log(`   Confidence: ${(pattern.confidence * 100).toFixed(1)}%`);
    console.log('');
  });

  // Cleanup
  db.close();
}

/**
 * Example 4: Pattern Statistics and Cleanup
 */
async function exampleStatisticsAndCleanup() {
  console.log('\n=== Example 4: Pattern Statistics and Cleanup ===\n');

  // Setup
  const db = createMemoryDatabase(EXAMPLE_DB_PATH);
  await db.initialize();
  const learner = createPatternLearner(db);

  // Get statistics
  console.log('Pattern Statistics:');
  const stats = await learner.getStatistics();

  console.log(`\nTotal Patterns: ${stats.total}`);
  console.log('\nBy Type:');

  for (const [type, typeStats] of Object.entries(stats.byType)) {
    console.log(`  ${type}:`);
    console.log(`    Count: ${typeStats.count}`);
    console.log(`    Avg Confidence: ${(typeStats.avgConfidence * 100).toFixed(1)}%`);
    console.log(`    Avg Frequency: ${typeStats.avgFrequency.toFixed(1)}`);
    console.log(`    Max Frequency: ${typeStats.maxFrequency}`);
    console.log('');
  }

  // Cleanup low-confidence patterns
  console.log('Cleaning up stale patterns...');
  const cleanupResult = await learner.cleanupLowConfidencePatterns(0.2, 30);
  console.log(`✓ Cleaned up ${cleanupResult.deleted} low-confidence patterns`);

  // Final stats
  const finalStats = await learner.getStatistics();
  console.log(`\nPatterns after cleanup: ${finalStats.total}`);

  // Cleanup
  db.close();
}

/**
 * Example 5: Agent-Specific Patterns
 */
async function exampleAgentPatterns() {
  console.log('\n=== Example 5: Agent-Specific Patterns ===\n');

  // Setup
  const db = createMemoryDatabase(EXAMPLE_DB_PATH);
  await db.initialize();
  const learner = createPatternLearner(db);

  console.log('Recording agent-specific workflows...');

  const agentWorkflows = {
    developer: [
      { sequence: ['developer', 'qa'], task: 'bug fix' },
      { sequence: ['developer', 'code-reviewer', 'qa'], task: 'feature' },
      { sequence: ['developer', 'security-architect', 'qa'], task: 'security fix' },
    ],
    architect: [
      { sequence: ['architect', 'developer', 'qa'], task: 'design' },
      { sequence: ['architect', 'security-architect', 'developer'], task: 'security design' },
    ],
    qa: [
      { sequence: ['qa', 'developer'], task: 'bug report' },
      { sequence: ['qa', 'developer', 'qa'], task: 'regression test' },
    ],
  };

  // Record patterns
  for (const [agent, workflows] of Object.entries(agentWorkflows)) {
    for (const workflow of workflows) {
      const frequency = Math.floor(Math.random() * 15) + 5;
      for (let i = 0; i < frequency; i++) {
        await learner.recordPattern('workflow', {
          ...workflow,
          initiator: agent,
        });
      }
    }
    console.log(`✓ Recorded ${workflows.length} workflow types for ${agent}`);
  }

  // Get developer-specific patterns
  console.log('\nDeveloper Workflow Patterns:');
  const devPatterns = await learner.getPatternsForAgent('developer', 5);

  devPatterns.forEach((pattern, index) => {
    console.log(`${index + 1}. ${pattern.data.sequence.join(' → ')}`);
    console.log(`   Task: ${pattern.data.task}`);
    console.log(`   Frequency: ${pattern.frequency}`);
    console.log(`   Confidence: ${(pattern.confidence * 100).toFixed(1)}%`);
    console.log('');
  });

  // Cleanup
  db.close();
}

/**
 * Run all examples
 */
async function runAllExamples() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║   Pattern Learning Engine - Usage Examples    ║');
  console.log('╚════════════════════════════════════════════════╝');

  // Clean up old example database
  if (existsSync(EXAMPLE_DB_PATH)) {
    unlinkSync(EXAMPLE_DB_PATH);
  }

  try {
    await exampleWorkflowTracking();
    await exampleErrorResolution();
    await exampleToolSequences();
    await exampleStatisticsAndCleanup();
    await exampleAgentPatterns();

    console.log('\n✅ All examples completed successfully!');
    console.log('\nKey Takeaways:');
    console.log('• Patterns learn from repeated occurrences');
    console.log('• Confidence increases with usage frequency');
    console.log('• High-confidence patterns (>70%) are reliable');
    console.log('• Cleanup removes stale low-confidence patterns');
    console.log('• Agent-specific patterns help optimize workflows');

    // Clean up example database
    if (existsSync(EXAMPLE_DB_PATH)) {
      unlinkSync(EXAMPLE_DB_PATH);
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Example failed:', error);

    // Clean up on error
    if (existsSync(EXAMPLE_DB_PATH)) {
      unlinkSync(EXAMPLE_DB_PATH);
    }

    process.exit(1);
  }
}

// Run examples
runAllExamples();
