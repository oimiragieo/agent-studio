#!/usr/bin/env node

/**
 * A2A Test Runner - CLI Entry Point
 *
 * Command-line interface for executing A2A test scenarios.
 *
 * Features:
 * - Scenario filtering (by ID, category, priority, tags)
 * - Multiple output formats (JSON, Markdown)
 * - Verbose logging
 * - CI mode support
 * - Coverage reporting
 *
 * Usage:
 *   node test-runner.mjs [options]
 *
 * Options:
 *   --scenario <id>        Run specific scenario by ID
 *   --category <name>      Run all scenarios in category
 *   --priority <P0|P1|P2>  Run scenarios by priority
 *   --tags <tag1,tag2>     Run scenarios matching tags
 *   --verbose              Enable verbose logging
 *   --ci                   CI mode (strict, no retries)
 *   --coverage             Generate coverage report
 *   --format <json|md>     Report format (default: json)
 *   --output <path>        Output directory for reports
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { A2ATestHarness } from './test-harness.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Parse command-line arguments
 */
function parseArgs() {
  const args = {
    scenario: null,
    category: null,
    priority: null,
    tags: null,
    verbose: false,
    ci: false,
    coverage: false,
    format: 'json',
    output: path.join(__dirname, '../../context/reports/a2a-test-results'),
    scenariosPath: path.join(__dirname, 'scenarios'),
  };

  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    const next = process.argv[i + 1];

    switch (arg) {
      case '--scenario':
        args.scenario = next;
        i++;
        break;
      case '--category':
        args.category = next;
        i++;
        break;
      case '--priority':
        args.priority = next;
        i++;
        break;
      case '--tags':
        args.tags = next ? next.split(',') : null;
        i++;
        break;
      case '--verbose':
        args.verbose = true;
        break;
      case '--ci':
        args.ci = true;
        break;
      case '--coverage':
        args.coverage = true;
        break;
      case '--format':
        args.format = next;
        i++;
        break;
      case '--output':
        args.output = next;
        i++;
        break;
      case '--scenarios':
        args.scenariosPath = next;
        i++;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
    }
  }

  return args;
}

/**
 * Print help message
 */
function printHelp() {
  console.log(`
A2A Test Runner - Execute A2A communication validation tests

Usage:
  node test-runner.mjs [options]

Options:
  --scenario <id>        Run specific scenario by ID
  --category <name>      Run all scenarios in category
                         (agent-chain, template-enforcement, security-trigger,
                          verification-protocol, workflow-execution, complex-graph)
  --priority <P0|P1|P2>  Run scenarios by priority level
  --tags <tag1,tag2>     Run scenarios matching tags (comma-separated)
  --verbose              Enable verbose logging
  --ci                   CI mode (strict validation, no retries)
  --coverage             Generate coverage report
  --format <json|md>     Report format (json or markdown, default: json)
  --output <path>        Output directory for reports
  --scenarios <path>     Path to scenarios directory
  --help, -h             Show this help message

Examples:
  # Run all P0 scenarios
  node test-runner.mjs --priority P0

  # Run specific category with verbose output
  node test-runner.mjs --category template-enforcement --verbose

  # Run single scenario
  node test-runner.mjs --scenario a2a-template-001

  # Generate coverage report
  node test-runner.mjs --coverage --format md

  # CI mode (all P0 + P1)
  node test-runner.mjs --ci
`);
}

/**
 * Main execution function
 */
async function main() {
  const args = parseArgs();

  console.log('🚀 A2A Test Runner');
  console.log('==================\n');

  // Initialize test harness
  const harness = new A2ATestHarness({
    verboseLogging: args.verbose,
    reportDir: args.output,
    reportFormats: [args.format],
    timeout: args.ci ? 60000 : 30000,
    retryCount: args.ci ? 0 : 1,
  });

  try {
    // Load scenarios
    if (args.verbose) {
      console.log(`Loading scenarios from: ${args.scenariosPath}`);
    }

    await harness.loadScenarios(args.scenariosPath);
    console.log(`✅ Loaded ${harness.scenarios.size} scenario(s)\n`);

    // Build filter
    const filter = {};
    if (args.scenario) filter.scenario = args.scenario;
    if (args.category) filter.category = args.category;
    if (args.priority) filter.priority = args.priority;
    if (args.tags) filter.tags = args.tags;

    // Execute tests
    const startTime = Date.now();
    console.log('Running tests...\n');

    const result = await harness.executeFiltered(filter);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Test Summary');
    console.log('='.repeat(50));
    console.log(`Total:    ${result.summary.total}`);
    console.log(`Passed:   ${result.summary.passed} ✅`);
    console.log(`Failed:   ${result.summary.failed} ❌`);
    console.log(`Skipped:  ${result.summary.skipped} ⏭️`);
    console.log(`Duration: ${duration}s`);
    console.log(`Pass Rate: ${result.summary.pass_rate}%`);
    console.log('='.repeat(50));

    // Print failed tests
    if (result.summary.failed > 0) {
      console.log('\n❌ Failed Tests:');
      const failedTests = result.results.filter(r => r.status === 'failed');
      for (const test of failedTests) {
        console.log(`  - ${test.scenario_id}: ${test.name}`);
        if (test.failure) {
          console.log(`    Step: ${test.failure.step_id}`);
          console.log(`    Error: ${test.failure.message}`);
        }
      }
    }

    // Print coverage if requested
    if (args.coverage) {
      console.log('\n📈 Coverage Report:');
      console.log(
        `  Hooks Tested: ${result.coverage.hooks_tested.length} (${result.coverage.hooks_coverage}%)`
      );
      console.log(
        `  Categories: ${result.coverage.categories_tested.length} (${result.coverage.categories_coverage}%)`
      );
      console.log(
        `  Scenarios: ${result.coverage.scenarios_executed}/${result.coverage.scenarios_total}`
      );
    }

    // Save reports
    await fs.mkdir(args.output, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    // JSON report
    const jsonPath = path.join(args.output, `a2a-test-results-${timestamp}.json`);
    await fs.writeFile(jsonPath, JSON.stringify(result, null, 2));
    console.log(`\n💾 JSON report saved: ${jsonPath}`);

    // Markdown report if requested
    if (args.format === 'markdown' || args.format === 'md') {
      const mdReport = await harness.generateReport('markdown');
      const mdPath = path.join(args.output, `a2a-test-results-${timestamp}.md`);
      await fs.writeFile(mdPath, mdReport);
      console.log(`💾 Markdown report saved: ${mdPath}`);
    }

    // Cleanup
    await harness.cleanup();

    // Exit with appropriate code
    if (args.ci) {
      // CI mode: fail on any P0 failures
      const p0Failed = result.results.some(r => r.priority === 'P0' && r.status === 'failed');
      if (p0Failed) {
        console.log('\n❌ CI FAILURE: P0 scenarios failed');
        process.exit(1);
      }
    }

    if (result.summary.failed > 0) {
      console.log('\n⚠️  Some tests failed');
      process.exit(1);
    }

    console.log('\n✅ All tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('\n💥 Test execution error:', error.message);
    if (args.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run if executed directly
// Fix for Windows path handling - convert both to file URLs for comparison
const scriptPath = import.meta.url;
const execPath = process.argv[1];
const isDirectExecution =
  scriptPath.endsWith(execPath.replace(/\\/g, '/')) ||
  scriptPath === `file:///${execPath.replace(/\\/g, '/')}` ||
  process.argv[1].includes('test-runner.mjs');

if (isDirectExecution || process.argv.length > 2) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main, parseArgs };
