#!/usr/bin/env node
/**
 * CUJ Test Runner - End-to-end Customer User Journey test execution
 *
 * Parses CUJ markdown files, executes test scenarios, validates success criteria,
 * and generates comprehensive test reports.
 *
 * Usage:
 *   node .claude/tools/cuj-test-runner.mjs --cuj CUJ-001
 *   node .claude/tools/cuj-test-runner.mjs --cuj CUJ-001 --dry-run
 *   node .claude/tools/cuj-test-runner.mjs --cuj CUJ-001 --scenario 1
 *   node .claude/tools/cuj-test-runner.mjs --all
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CUJS_DIR = join(__dirname, '..', 'docs', 'cujs');
const REPORTS_DIR = join(__dirname, '..', 'context', 'reports');

/**
 * Parse CUJ markdown file
 * @param {string} cujId - CUJ identifier (e.g., CUJ-001)
 * @returns {Promise<Object>} Parsed CUJ structure
 */
async function parseCujMarkdown(cujId) {
  const cujPath = join(CUJS_DIR, `${cujId}.md`);

  if (!existsSync(cujPath)) {
    throw new Error(`CUJ file not found: ${cujPath}`);
  }

  const content = await readFile(cujPath, 'utf-8');
  const lines = content.split('\n');

  const cuj = {
    id: cujId,
    title: '',
    overview: '',
    scenarios: [],
    successCriteria: [],
    dependencies: [],
    expectedArtifacts: [],
    skills: [],
    agentSequence: [],
  };

  let currentSection = null;
  let currentScenario = null;
  let currentStep = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Extract title
    if (trimmed.startsWith('# ') && !cuj.title) {
      cuj.title = trimmed.substring(2).trim();
      continue;
    }

    // Section headers
    if (trimmed.startsWith('## ')) {
      currentSection = trimmed.substring(3).toLowerCase();
      currentScenario = null;
      currentStep = null;
      continue;
    }

    // Scenario headers
    if (currentSection === 'scenarios' && trimmed.startsWith('### ')) {
      currentScenario = {
        name: trimmed.substring(4).trim(),
        description: '',
        steps: [],
        expectedResult: '',
        validations: [],
      };
      cuj.scenarios.push(currentScenario);
      continue;
    }

    // Step headers (#### prefix)
    if (currentScenario && trimmed.startsWith('#### ')) {
      currentStep = {
        description: trimmed.substring(5).trim(),
        commands: [],
        validations: [],
      };
      currentScenario.steps.push(currentStep);
      continue;
    }

    // Extract content based on current section
    if (currentSection === 'overview' && trimmed) {
      cuj.overview += trimmed + ' ';
    }

    // Extract code blocks (commands)
    if (currentStep && trimmed.startsWith('```')) {
      const language = trimmed.substring(3).trim();
      if (language === 'bash' || language === 'sh') {
        // Start collecting command
        currentStep.collectingCommand = true;
      }
      continue;
    }

    if (currentStep && currentStep.collectingCommand) {
      if (trimmed === '```') {
        currentStep.collectingCommand = false;
      } else {
        currentStep.commands.push(trimmed);
      }
      continue;
    }

    // Success criteria
    if (currentSection === 'success criteria' && trimmed.startsWith('- ')) {
      cuj.successCriteria.push(trimmed.substring(2).trim());
    }

    // Expected artifacts
    if (currentSection === 'expected artifacts' && trimmed.startsWith('- ')) {
      const artifact = trimmed.substring(2).trim();
      // Parse artifact format: `artifact-name` (step N)
      const match = artifact.match(/`([^`]+)`.*step (\d+)/i);
      if (match) {
        cuj.expectedArtifacts.push({
          name: match[1],
          step: parseInt(match[2], 10),
          raw: artifact,
        });
      }
    }

    // Skills
    if (currentSection === 'skills used' && trimmed.startsWith('- ')) {
      const skill = trimmed.substring(2).trim();
      cuj.skills.push(skill.replace(/`/g, '').trim());
    }

    // Agent sequence
    if (currentSection === 'agent sequence' && trimmed.match(/^\d+\./)) {
      const agentMatch = trimmed.match(/\*\*([^*]+)\*\*/);
      if (agentMatch) {
        cuj.agentSequence.push(agentMatch[1].trim());
      }
    }
  }

  return cuj;
}

/**
 * Execute a single test step
 * @param {Object} step - Step object with commands and validations
 * @param {Object} context - Test execution context
 * @returns {Promise<Object>} Step execution result
 */
async function executeStep(step, context) {
  const result = {
    description: step.description,
    passed: true,
    commands: [],
    errors: [],
    validations: [],
  };

  for (const command of step.commands) {
    try {
      if (context.dryRun) {
        result.commands.push({
          command,
          dryRun: true,
          skipped: true,
        });
      } else {
        const { stdout, stderr } = await execAsync(command, {
          cwd: context.projectRoot,
          timeout: context.timeout || 60000,
        });

        result.commands.push({
          command,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          success: true,
        });
      }
    } catch (error) {
      result.passed = false;
      result.errors.push({
        command,
        error: error.message,
        code: error.code,
        stderr: error.stderr,
      });
    }
  }

  return result;
}

/**
 * Execute a test scenario
 * @param {Object} scenario - Scenario object with steps
 * @param {Object} context - Test execution context
 * @returns {Promise<Object>} Scenario execution result
 */
async function executeScenario(scenario, context) {
  const result = {
    name: scenario.name,
    passed: true,
    steps: [],
    startTime: new Date().toISOString(),
    endTime: null,
    duration: 0,
  };

  const startMs = Date.now();

  for (const step of scenario.steps) {
    const stepResult = await executeStep(step, context);
    result.steps.push(stepResult);

    if (!stepResult.passed) {
      result.passed = false;
      if (context.failFast) {
        break;
      }
    }
  }

  result.endTime = new Date().toISOString();
  result.duration = Date.now() - startMs;

  return result;
}

/**
 * Validate success criteria
 * @param {Object} cuj - Parsed CUJ object
 * @param {Object} scenarioResults - Scenario execution results
 * @param {Object} context - Test execution context
 * @returns {Object} Validation result
 */
function validateSuccessCriteria(cuj, scenarioResults, context) {
  const validations = {
    passed: true,
    criteria: [],
    errors: [],
  };

  for (const criterion of cuj.successCriteria) {
    const validation = {
      criterion,
      passed: false,
      message: '',
    };

    // Simple validation logic (can be extended)
    if (context.dryRun) {
      validation.passed = true;
      validation.message = 'Skipped (dry run)';
    } else {
      // Check if all scenarios passed
      const allScenariosPassed = scenarioResults.every(r => r.passed);
      validation.passed = allScenariosPassed;
      validation.message = allScenariosPassed
        ? 'All scenarios passed'
        : 'One or more scenarios failed';
    }

    validations.criteria.push(validation);

    if (!validation.passed) {
      validations.passed = false;
      validations.errors.push(criterion);
    }
  }

  return validations;
}

/**
 * Generate test report
 * @param {Object} cuj - Parsed CUJ object
 * @param {Array} scenarioResults - Scenario execution results
 * @param {Object} validations - Success criteria validations
 * @param {Object} context - Test execution context
 * @returns {Object} Test report
 */
function generateTestReport(cuj, scenarioResults, validations, context) {
  const report = {
    cuj_id: cuj.id,
    title: cuj.title,
    test_run_id: context.testRunId || `test-${Date.now()}`,
    timestamp: new Date().toISOString(),
    status: validations.passed ? 'passed' : 'failed',
    dry_run: context.dryRun || false,
    summary: {
      total_scenarios: cuj.scenarios.length,
      scenarios_passed: scenarioResults.filter(r => r.passed).length,
      scenarios_failed: scenarioResults.filter(r => !r.passed).length,
      total_criteria: cuj.successCriteria.length,
      criteria_passed: validations.criteria.filter(c => c.passed).length,
      criteria_failed: validations.criteria.filter(c => !c.passed).length,
    },
    scenario_results: scenarioResults,
    success_criteria_validations: validations,
    metadata: {
      skills_required: cuj.skills,
      agent_sequence: cuj.agentSequence,
      expected_artifacts: cuj.expectedArtifacts,
    },
  };

  return report;
}

/**
 * Save test report to file
 * @param {Object} report - Test report object
 * @returns {Promise<string>} Report file path
 */
async function saveTestReport(report) {
  if (!existsSync(REPORTS_DIR)) {
    await mkdir(REPORTS_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportFileName = `cuj-test-${report.cuj_id}-${timestamp}.json`;
  const reportPath = join(REPORTS_DIR, reportFileName);

  await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');

  return reportPath;
}

/**
 * Run CUJ test
 * @param {string} cujId - CUJ identifier
 * @param {Object} options - Test execution options
 * @returns {Promise<Object>} Test result
 */
export async function runCujTest(cujId, options = {}) {
  const context = {
    projectRoot: options.projectRoot || process.cwd(),
    dryRun: options.dryRun || false,
    failFast: options.failFast !== false,
    timeout: options.timeout || 60000,
    testRunId: options.testRunId,
  };

  try {
    // Parse CUJ
    const cuj = await parseCujMarkdown(cujId);

    // Execute scenarios
    const scenarioResults = [];
    const scenariosToRun =
      options.scenario !== undefined ? [cuj.scenarios[options.scenario - 1]] : cuj.scenarios;

    for (const scenario of scenariosToRun) {
      if (!scenario) continue;
      const result = await executeScenario(scenario, context);
      scenarioResults.push(result);
    }

    // Validate success criteria
    const validations = validateSuccessCriteria(cuj, scenarioResults, context);

    // Generate report
    const report = generateTestReport(cuj, scenarioResults, validations, context);

    // Save report
    const reportPath = await saveTestReport(report);
    report.report_path = reportPath;

    return report;
  } catch (error) {
    return {
      cuj_id: cujId,
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
CUJ Test Runner - Execute Customer User Journey tests

Usage:
  node cuj-test-runner.mjs --cuj <CUJ-ID> [options]
  node cuj-test-runner.mjs --all [options]

Options:
  --cuj <id>          CUJ to test (e.g., CUJ-001)
  --all               Test all CUJs
  --scenario <n>      Run specific scenario only (1-based index)
  --dry-run           Parse and validate without executing commands
  --no-fail-fast      Continue on first failure
  --timeout <ms>      Command timeout in milliseconds (default: 60000)
  --json              Output as JSON only
  --help, -h          Show this help

Examples:
  # Run all scenarios for CUJ-001
  node cuj-test-runner.mjs --cuj CUJ-001

  # Dry run (validation only)
  node cuj-test-runner.mjs --cuj CUJ-001 --dry-run

  # Run specific scenario
  node cuj-test-runner.mjs --cuj CUJ-001 --scenario 1

  # Test all CUJs
  node cuj-test-runner.mjs --all

Exit codes:
  0 - All tests passed
  1 - One or more tests failed
`);
    process.exit(0);
  }

  const getArg = name => {
    const index = args.indexOf(`--${name}`);
    return index !== -1 && args[index + 1] ? args[index + 1] : null;
  };

  const hasFlag = name => args.includes(`--${name}`);

  try {
    const options = {
      dryRun: hasFlag('dry-run'),
      failFast: !hasFlag('no-fail-fast'),
      timeout: parseInt(getArg('timeout'), 10) || 60000,
      scenario: getArg('scenario') ? parseInt(getArg('scenario'), 10) : undefined,
    };

    const cujId = getArg('cuj');

    if (!cujId && !hasFlag('all')) {
      console.error('Error: --cuj or --all required');
      console.error('Run with --help for usage information');
      process.exit(1);
    }

    if (hasFlag('all')) {
      // TODO: Implement test all CUJs
      console.error('--all not yet implemented');
      process.exit(1);
    }

    const result = await runCujTest(cujId, options);

    if (hasFlag('json')) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`\nCUJ Test Result: ${result.cuj_id}`);
      console.log(`Status: ${result.status?.toUpperCase() || 'UNKNOWN'}`);

      if (result.status === 'error') {
        console.log(`Error: ${result.error}`);
      } else {
        console.log(`\nSummary:`);
        console.log(
          `  Scenarios: ${result.summary.scenarios_passed}/${result.summary.total_scenarios} passed`
        );
        console.log(
          `  Criteria: ${result.summary.criteria_passed}/${result.summary.total_criteria} passed`
        );
        console.log(`\nReport saved to: ${result.report_path}`);
      }
    }

    process.exit(result.status === 'passed' ? 0 : 1);
  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`;
if (isMainModule) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export default {
  runCujTest,
  parseCujMarkdown,
};
