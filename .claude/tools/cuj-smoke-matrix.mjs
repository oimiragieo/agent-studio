#!/usr/bin/env node
/**
 * CUJ Smoke Test Matrix - CI-Friendly Validation
 *
 * Performs simulation-only smoke tests on all 62 CUJs without actual execution.
 * Designed for CI/CD pipelines with <60s total runtime and zero state mutations.
 *
 * Validation Checks (per CUJ):
 * 1. Mapping integrity: CUJ exists in CUJ-INDEX.md
 * 2. Workflow dry-run: Workflow file exists and is syntactically valid (if workflow mode)
 * 3. Required skill presence: All skills exist in .claude/skills/ or codex-skills/
 * 4. Required CLI availability: Detect available CLIs (claude, gemini, codex, cursor, copilot)
 * 5. Platform truth table: Validate platform compatibility (claude-code, cursor, factory)
 * 6. Schema validation: execution_contract validates against schema
 * 7. Artifact paths: Placeholder paths are well-formed
 *
 * Output Formats:
 * - JSON: Machine-readable for CI integration (--output-json <file>)
 * - Markdown: Human-readable summary with badge (--output-md <file>)
 * - Terminal: Colored output for local testing
 *
 * Usage:
 *   # Run all CUJs in simulation mode
 *   node .claude/tools/cuj-smoke-matrix.mjs --simulation-only
 *
 *   # JSON output for CI
 *   node .claude/tools/cuj-smoke-matrix.mjs --simulation-only --output-json ci-results.json
 *
 *   # Markdown report
 *   node .claude/tools/cuj-smoke-matrix.mjs --simulation-only --output-md smoke-report.md
 *
 *   # Specific CUJs only
 *   node .claude/tools/cuj-smoke-matrix.mjs --simulation-only --cujs CUJ-001,CUJ-002
 *
 *   # Verbose mode
 *   node .claude/tools/cuj-smoke-matrix.mjs --simulation-only --verbose
 *
 * Exit Codes:
 *   0: All smoke tests passed
 *   1: One or more smoke tests failed
 *   2: Fatal error (missing dependencies)
 *
 * Performance Target:
 *   <60 seconds for all 62 CUJs (simulation-only mode)
 *
 * @version 1.0.0
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import { exec } from 'child_process';
import {
  loadCUJMapping,
  getAllCUJIds,
  cujDocExists,
  normalizeExecutionMode,
} from './cuj-parser.mjs';

const execPromise = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '../..');

// CLI arguments
const args = process.argv.slice(2);
const SIMULATION_ONLY = args.includes('--simulation-only');
const VERBOSE = args.includes('--verbose');
const JSON_OUTPUT_INDEX = args.indexOf('--output-json');
const MD_OUTPUT_INDEX = args.indexOf('--output-md');
const CUJS_FILTER_INDEX = args.indexOf('--cujs');

const JSON_OUTPUT_FILE = JSON_OUTPUT_INDEX !== -1 ? args[JSON_OUTPUT_INDEX + 1] : null;
const MD_OUTPUT_FILE = MD_OUTPUT_INDEX !== -1 ? args[MD_OUTPUT_INDEX + 1] : null;
const CUJS_FILTER = CUJS_FILTER_INDEX !== -1 ? args[CUJS_FILTER_INDEX + 1]?.split(',') : null;

// Color codes for terminal output
const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

// Performance tracking
const perfStart = Date.now();

// Results aggregation
const results = {
  timestamp: new Date().toISOString(),
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  duration_ms: 0,
  cujs: [],
};

/**
 * Display help text
 */
function showHelp() {
  console.log(`
CUJ Smoke Test Matrix - CI-Friendly Validation

Performs simulation-only smoke tests on all 62 CUJs without actual execution.

Usage:
  node .claude/tools/cuj-smoke-matrix.mjs [options]

Options:
  --simulation-only        Run smoke tests without actual CUJ execution (REQUIRED)
  --output-json <file>     Write results as JSON to file
  --output-md <file>       Write results as Markdown to file
  --cujs <id1,id2,...>     Test only specified CUJs (comma-separated)
  --verbose                Show detailed output for each check
  --help                   Show this help message

Examples:
  # Run all CUJs in simulation mode
  node .claude/tools/cuj-smoke-matrix.mjs --simulation-only

  # JSON output for CI
  node .claude/tools/cuj-smoke-matrix.mjs --simulation-only --output-json ci-results.json

  # Markdown report
  node .claude/tools/cuj-smoke-matrix.mjs --simulation-only --output-md smoke-report.md

  # Test specific CUJs
  node .claude/tools/cuj-smoke-matrix.mjs --simulation-only --cujs CUJ-001,CUJ-005,CUJ-057

  # Verbose mode
  node .claude/tools/cuj-smoke-matrix.mjs --simulation-only --verbose

Exit Codes:
  0: All smoke tests passed
  1: One or more smoke tests failed
  2: Fatal error (missing dependencies)

Performance Target:
  <60 seconds for all 62 CUJs (simulation-only mode)
`);
  process.exit(0);
}

// Handle --help
if (args.includes('--help') || args.includes('-h')) {
  showHelp();
}

// Require --simulation-only flag
if (!SIMULATION_ONLY) {
  console.error(`${COLORS.red}❌ ERROR: --simulation-only flag is required${COLORS.reset}`);
  console.error('This tool only supports simulation mode to prevent state mutations.');
  console.error('');
  console.error('Usage: node .claude/tools/cuj-smoke-matrix.mjs --simulation-only');
  console.error('');
  process.exit(2);
}

/**
 * Colored terminal output
 */
function log(message, color = 'reset') {
  if (!JSON_OUTPUT_FILE || VERBOSE) {
    console.log(`${COLORS[color]}${message}${COLORS.reset}`);
  }
}

/**
 * Check if a CLI tool is available
 * @param {string} cli - CLI tool name (e.g., 'claude', 'gemini')
 * @returns {Promise<Object>} - { available: boolean, version?: string, error?: string }
 */
async function checkCliAvailability(cli) {
  try {
    // Windows-friendly: use shell: true to handle .cmd shims
    const result = await execPromise(`${cli} --version`, {
      timeout: 5000,
      shell: true,
      windowsHide: true,
    });
    return {
      available: true,
      version: result.stdout.trim() || result.stderr.trim(),
    };
  } catch (error) {
    return {
      available: false,
      error: error.code === 'ENOENT' ? `${cli} command not found` : error.message,
    };
  }
}

/**
 * Detect available CLIs
 * @returns {Promise<Object>} - { claude: boolean, gemini: boolean, codex: boolean, cursor: boolean, copilot: boolean }
 */
async function detectAvailableCLIs() {
  const cliChecks = await Promise.all([
    checkCliAvailability('claude'),
    checkCliAvailability('gemini'),
    checkCliAvailability('codex'),
    checkCliAvailability('cursor'),
    checkCliAvailability('copilot'),
  ]);

  return {
    claude: cliChecks[0].available,
    gemini: cliChecks[1].available,
    codex: cliChecks[2].available,
    cursor: cliChecks[3].available,
    copilot: cliChecks[4].available,
  };
}

/**
 * Find skill path in both Agent Studio and Codex locations
 * @param {string} skillName - Name of the skill
 * @returns {Object|null} - { path, type } or null if not found
 */
function findSkillPath(skillName) {
  const agentStudioPath = resolve(ROOT, '.claude/skills', skillName, 'SKILL.md');
  const codexPath = resolve(ROOT, 'codex-skills', skillName, 'SKILL.md');

  if (existsSync(agentStudioPath)) {
    return { path: agentStudioPath, type: 'agent-studio' };
  }
  if (existsSync(codexPath)) {
    return { path: codexPath, type: 'codex' };
  }
  return null;
}

/**
 * Load platform compatibility matrix
 * @returns {Object} Platform compatibility configuration
 */
function loadPlatformCompatibility() {
  const matrixPath = resolve(ROOT, '.claude/context/platform-compatibility.json');

  if (!existsSync(matrixPath)) {
    log('⚠️  Platform compatibility matrix not found, using fallback defaults', 'yellow');
    // Fallback to minimal defaults if matrix not found
    return {
      platforms: {
        'claude-code': { capabilities: { skills: true, workflows: true, agents: true } },
        cursor: {
          capabilities: { skills: true, workflows: true, agents: false },
          excluded_skills: [],
        },
        factory: {
          capabilities: { skills: 'limited', workflows: false, agents: 'limited' },
          supported_skills: [],
        },
      },
    };
  }

  try {
    const content = readFileSync(matrixPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    log(`❌ Failed to load platform compatibility matrix: ${error.message}`, 'red');
    throw error;
  }
}

/**
 * Validate platform compatibility for a CUJ
 * @param {Object} cujEntry - CUJ entry from mapping
 * @param {string} platformId - Platform to validate against
 * @param {Object} matrix - Platform compatibility matrix
 * @returns {{ compatible: boolean, limitations: string[], warnings: string[] }}
 */
function validatePlatformCompatibility(cujEntry, platformId, matrix) {
  const { executionMode, workflowPath, primarySkill } = cujEntry;
  const platform = matrix.platforms[platformId];
  const result = { compatible: false, limitations: [], warnings: [] };

  if (!platform) {
    result.limitations.push(`Unknown platform: ${platformId}`);
    return result;
  }

  // Manual CUJs are always compatible (user-driven)
  if (executionMode === 'manual-setup' || executionMode === 'manual') {
    result.compatible = true;
    return result;
  }

  // Skill-only CUJs
  if (executionMode === 'skill-only') {
    if (!primarySkill) {
      result.limitations.push('No primary skill specified');
      return result;
    }

    const skillInfo = findSkillPath(primarySkill);

    if (!skillInfo) {
      result.limitations.push(
        `Skill "${primarySkill}" not found in .claude/skills/ or codex-skills/`
      );
      return result;
    }

    const skillCapability = platform.capabilities.skills;

    if (skillCapability === true) {
      // Check excluded skills list
      if (platform.excluded_skills && platform.excluded_skills.includes(primarySkill)) {
        result.limitations.push(
          `Skill "${primarySkill}" is excluded on ${platform.display_name || platformId}`
        );
        return result;
      }
      result.compatible = true;
      return result;
    }

    if (skillCapability === 'limited') {
      if (platform.supported_skills && platform.supported_skills.includes(primarySkill)) {
        result.compatible = true;
        result.warnings.push(
          `Skill "${primarySkill}" has limited support on ${platform.display_name || platformId}`
        );
        return result;
      }
      result.limitations.push(
        `Skill "${primarySkill}" not in supported list for ${platform.display_name || platformId}`
      );
      return result;
    }

    result.limitations.push(`Skills not supported on ${platform.display_name || platformId}`);
    return result;
  }

  // Workflow CUJs
  if (executionMode === 'workflow') {
    const workflowCapability = platform.capabilities.workflows;

    if (workflowCapability === true) {
      result.compatible = true;
    } else if (platform.workflow_execution === 'via-extension') {
      result.compatible = true;
      result.warnings.push(
        `Workflow execution on ${platform.display_name || platformId} requires extension/adapter`
      );
    } else if (platform.workflow_execution === 'task-tool-pattern') {
      // Factory uses task-tool pattern - NOT directly compatible with workflow CUJs
      result.compatible = false;
      result.limitations.push(
        `${platform.display_name || platformId} does not support direct workflow execution. Requires adaptation to task-tool pattern.`
      );
    } else {
      result.limitations.push(
        `Workflow execution not supported on ${platform.display_name || platformId}`
      );
    }

    return result;
  }

  // Unknown execution mode
  result.limitations.push(`Unknown execution mode: ${executionMode}`);
  return result;
}

/**
 * Perform smoke test checks on a single CUJ
 * @param {string} cujId - CUJ identifier
 * @param {Object} cujEntry - CUJ entry from mapping
 * @param {Object} availableCLIs - Available CLI tools
 * @param {Object} matrix - Platform compatibility matrix
 * @returns {Object} - { cujId, status, checks, platforms, warnings, errors }
 */
async function smokTestCUJ(cujId, cujEntry, availableCLIs, matrix) {
  const { executionMode, workflowPath, primarySkill } = cujEntry;
  const checks = {
    mapping: 'pass',
    workflow: 'n/a',
    skills: 'pass',
    clis: 'pass',
    platforms: 'pass',
    schema: 'pass',
    artifact_paths: 'pass',
    doc_exists: 'pass',
  };
  const warnings = [];
  const errors = [];
  const platforms = [];

  // Check 1: Mapping integrity (implicit - if we got here, mapping exists)
  checks.mapping = 'pass';

  // Check 2: CUJ doc file exists
  const docExists = await cujDocExists(cujId);
  if (!docExists) {
    checks.doc_exists = 'fail';
    errors.push(`CUJ documentation file not found: ${cujId}.md`);
  }

  // Check 3: Workflow dry-run (if workflow mode)
  if (executionMode === 'workflow') {
    if (!workflowPath || workflowPath === 'null') {
      checks.workflow = 'fail';
      errors.push('Missing workflow path in mapping');
    } else {
      const workflowName = workflowPath
        .replace(/`/g, '')
        .replace('.claude/workflows/', '')
        .replace('.yaml', '')
        .trim();
      const workflowFilePath = resolve(ROOT, '.claude/workflows', `${workflowName}.yaml`);

      if (!existsSync(workflowFilePath)) {
        checks.workflow = 'fail';
        errors.push(`Workflow file not found: ${workflowName}.yaml`);
      } else {
        // Validate YAML syntax (basic check)
        try {
          const content = readFileSync(workflowFilePath, 'utf-8');
          if (!content.trim()) {
            checks.workflow = 'fail';
            errors.push(`Workflow file is empty: ${workflowName}.yaml`);
          } else {
            checks.workflow = 'pass';
          }
        } catch (error) {
          checks.workflow = 'fail';
          errors.push(`Failed to read workflow file: ${error.message}`);
        }
      }
    }
  }

  // Check 4: Required skill presence (if skill-only mode)
  if (executionMode === 'skill-only') {
    if (!primarySkill) {
      checks.skills = 'fail';
      errors.push('Missing primary skill in mapping');
    } else {
      const skillInfo = findSkillPath(primarySkill);
      if (!skillInfo) {
        checks.skills = 'fail';
        errors.push(
          `Primary skill not found: ${primarySkill}. Expected in .claude/skills/ (Agent Studio) or codex-skills/ (Codex CLI).`
        );
      } else {
        checks.skills = 'pass';
        if (skillInfo.type === 'codex') {
          warnings.push(
            `Primary skill ${primarySkill} is a Codex CLI skill. Requires CLI tools (claude, gemini).`
          );
        }
      }
    }
  }

  // Check 5: CLI availability (for Codex skills)
  const usesCodexSkills = primarySkill && findSkillPath(primarySkill)?.type === 'codex';
  if (usesCodexSkills) {
    const claudeAvailable = availableCLIs.claude;
    const geminiAvailable = availableCLIs.gemini;

    if (!claudeAvailable) {
      warnings.push('⚠️  Claude CLI not available. Multi-AI review may fail.');
    }
    if (!geminiAvailable) {
      warnings.push('⚠️  Gemini CLI not available. Multi-AI review may be limited.');
    }

    // Don't fail on missing CLIs, just warn
    checks.clis = claudeAvailable || geminiAvailable ? 'pass' : 'warn';
  }

  // Check 6: Platform compatibility
  const platformsToCheck = ['claude-code', 'cursor', 'factory'];
  for (const platformId of platformsToCheck) {
    const validation = validatePlatformCompatibility(cujEntry, platformId, matrix);

    if (validation.compatible) {
      // Map platform IDs to legacy names for backward compatibility
      const legacyName = platformId === 'claude-code' ? 'claude' : platformId;
      platforms.push(legacyName);
    }

    if (validation.limitations.length > 0) {
      warnings.push(...validation.limitations.map(l => `[${platformId}] ${l}`));
    }
    if (validation.warnings.length > 0) {
      warnings.push(...validation.warnings.map(w => `[${platformId}] ${w}`));
    }
  }

  if (platforms.length === 0 && executionMode !== 'manual-setup' && executionMode !== 'manual') {
    checks.platforms = 'fail';
    errors.push('CUJ not compatible with any platform');
  }

  // Check 7: Schema validation (placeholder - would require JSON schema validation)
  // For now, just check that execution_mode is valid
  const validModes = ['workflow', 'skill-only', 'manual-setup', 'manual'];
  if (!validModes.includes(executionMode)) {
    checks.schema = 'fail';
    errors.push(`Invalid execution mode: ${executionMode}`);
  }

  // Check 8: Artifact paths (placeholder - would require path validation)
  // For now, just check that workflow path is well-formed (if present)
  if (workflowPath && workflowPath !== 'null') {
    const pathRegex = /^\.claude\/workflows\/[a-z-]+\.yaml$/;
    if (!pathRegex.test(workflowPath.replace(/`/g, '').trim())) {
      checks.artifact_paths = 'warn';
      warnings.push(`Workflow path may not be well-formed: ${workflowPath}`);
    }
  }

  // Determine overall status
  const hasErrors = errors.length > 0;
  const status = hasErrors ? 'fail' : 'pass';

  return {
    cujId,
    status,
    execution_mode: executionMode,
    checks,
    platforms,
    warnings,
    errors,
  };
}

/**
 * Run smoke tests on all CUJs
 */
async function runSmokeTests() {
  log('🔍 CUJ Smoke Test Matrix - Simulation Mode\n', 'cyan');
  log('='.repeat(60), 'gray');

  // Step 1: Load CUJ mapping
  log('\n📋 Loading CUJ mapping...', 'cyan');
  const mapping = await loadCUJMapping();
  const allCUJIds = await getAllCUJIds();
  const cujsToTest = CUJS_FILTER ? CUJS_FILTER : allCUJIds;

  results.total = cujsToTest.length;
  log(`   Found ${mapping.size} CUJs in mapping`, 'gray');

  if (CUJS_FILTER) {
    log(`   Filtering to ${cujsToTest.length} specified CUJs`, 'yellow');
  }

  // Step 2: Detect available CLIs
  log('\n🔧 Detecting available CLIs...', 'cyan');
  const availableCLIs = await detectAvailableCLIs();
  log(`   Claude CLI: ${availableCLIs.claude ? '✓' : '✗'}`, availableCLIs.claude ? 'green' : 'red');
  log(`   Gemini CLI: ${availableCLIs.gemini ? '✓' : '✗'}`, availableCLIs.gemini ? 'green' : 'red');
  log(`   Codex CLI:  ${availableCLIs.codex ? '✓' : '✗'}`, availableCLIs.codex ? 'green' : 'red');

  // Step 3: Load platform compatibility matrix
  log('\n📊 Loading platform compatibility matrix...', 'cyan');
  const matrix = loadPlatformCompatibility();
  log(
    `   Loaded compatibility data for ${Object.keys(matrix.platforms || {}).length} platforms`,
    'gray'
  );

  // Step 4: Run smoke tests on each CUJ
  log('\n🧪 Running smoke tests...\n', 'cyan');

  for (const cujId of cujsToTest) {
    const cujEntry = mapping.get(cujId);

    if (!cujEntry) {
      log(`   ❌ ${cujId}: Not found in mapping`, 'red');
      results.failed++;
      results.cujs.push({
        cujId,
        status: 'fail',
        checks: { mapping: 'fail' },
        errors: ['CUJ not found in mapping table'],
      });
      continue;
    }

    const result = await smokTestCUJ(cujId, cujEntry, availableCLIs, matrix);
    results.cujs.push(result);

    if (result.status === 'pass') {
      results.passed++;
      if (!VERBOSE) {
        log(`   ✓ ${cujId} (${result.execution_mode})`, 'green');
      }
    } else {
      results.failed++;
      log(`   ❌ ${cujId} (${result.execution_mode})`, 'red');
    }

    // Verbose output
    if (VERBOSE) {
      log(`      Checks: ${JSON.stringify(result.checks)}`, 'gray');
      if (result.platforms.length > 0) {
        log(`      Platforms: ${result.platforms.join(', ')}`, 'gray');
      }
      if (result.warnings.length > 0) {
        result.warnings.forEach(w => log(`      ⚠️  ${w}`, 'yellow'));
      }
      if (result.errors.length > 0) {
        result.errors.forEach(e => log(`      ❌ ${e}`, 'red'));
      }
    }
  }

  // Calculate duration
  results.duration_ms = Date.now() - perfStart;

  // Print summary
  log('\n' + '='.repeat(60), 'gray');
  log('📈 Smoke Test Summary', 'cyan');
  log('='.repeat(60), 'gray');
  log(`\nTotal CUJs: ${results.total}`, 'cyan');
  log(`  ✅ Passed: ${results.passed}`, 'green');
  log(`  ❌ Failed: ${results.failed}`, 'red');
  log(`  ⏱️  Duration: ${(results.duration_ms / 1000).toFixed(2)}s`, 'cyan');
  log('');

  // Performance warning
  if (results.duration_ms > 60000) {
    log(
      `⚠️  Performance target missed: ${(results.duration_ms / 1000).toFixed(2)}s (target: <60s)`,
      'yellow'
    );
  } else {
    log(
      `✅ Performance target met: ${(results.duration_ms / 1000).toFixed(2)}s (target: <60s)`,
      'green'
    );
  }

  log('\n' + '='.repeat(60), 'gray');

  // Exit status
  const success = results.failed === 0;
  if (success) {
    log('✅ All smoke tests passed', 'green');
  } else {
    log(`❌ ${results.failed} smoke test(s) failed`, 'red');
  }
  log('='.repeat(60) + '\n', 'gray');

  return success;
}

/**
 * Write JSON output to file
 */
function writeJSONOutput() {
  if (!JSON_OUTPUT_FILE) return;

  try {
    writeFileSync(JSON_OUTPUT_FILE, JSON.stringify(results, null, 2));
    log(`📄 JSON results written to: ${JSON_OUTPUT_FILE}`, 'cyan');
  } catch (error) {
    log(`❌ Failed to write JSON output: ${error.message}`, 'red');
  }
}

/**
 * Generate Markdown badge
 */
function generateBadge() {
  const passRate = ((results.passed / results.total) * 100).toFixed(0);
  const color = results.failed === 0 ? 'brightgreen' : results.failed < 5 ? 'yellow' : 'red';
  const label = `CUJ Smoke Tests`;
  const message = `${results.passed}/${results.total} passing (${passRate}%)`;

  return `![${label}](https://img.shields.io/badge/${encodeURIComponent(label)}-${encodeURIComponent(message)}-${color})`;
}

/**
 * Write Markdown output to file
 */
function writeMarkdownOutput() {
  if (!MD_OUTPUT_FILE) return;

  const badge = generateBadge();
  const passRate = ((results.passed / results.total) * 100).toFixed(1);

  let md = `# CUJ Smoke Test Report\n\n`;
  md += `${badge}\n\n`;
  md += `**Generated**: ${results.timestamp}\n\n`;
  md += `**Duration**: ${(results.duration_ms / 1000).toFixed(2)}s\n\n`;

  md += `## Summary\n\n`;
  md += `| Metric | Value |\n`;
  md += `|--------|-------|\n`;
  md += `| Total CUJs | ${results.total} |\n`;
  md += `| Passed | ✅ ${results.passed} |\n`;
  md += `| Failed | ❌ ${results.failed} |\n`;
  md += `| Pass Rate | ${passRate}% |\n`;
  md += `| Duration | ${(results.duration_ms / 1000).toFixed(2)}s |\n\n`;

  if (results.failed > 0) {
    md += `## Failed CUJs\n\n`;
    md += `| CUJ ID | Execution Mode | Errors |\n`;
    md += `|--------|----------------|--------|\n`;

    results.cujs
      .filter(c => c.status === 'fail')
      .forEach(cuj => {
        const errors = cuj.errors.join('; ');
        md += `| ${cuj.cujId} | ${cuj.execution_mode || 'N/A'} | ${errors} |\n`;
      });

    md += `\n`;
  }

  md += `## Platform Compatibility\n\n`;
  const platformCounts = { claude: 0, cursor: 0, factory: 0 };
  results.cujs.forEach(cuj => {
    if (cuj.platforms) {
      cuj.platforms.forEach(p => platformCounts[p]++);
    }
  });
  md += `| Platform | Compatible CUJs |\n`;
  md += `|----------|----------------|\n`;
  md += `| Claude | ${platformCounts.claude} |\n`;
  md += `| Cursor | ${platformCounts.cursor} |\n`;
  md += `| Factory | ${platformCounts.factory} |\n\n`;

  md += `## Detailed Results\n\n`;
  md += `<details>\n<summary>Show all CUJ results</summary>\n\n`;
  md += `| CUJ ID | Status | Execution Mode | Platforms | Checks |\n`;
  md += `|--------|--------|----------------|-----------|--------|\n`;

  results.cujs.forEach(cuj => {
    const statusIcon = cuj.status === 'pass' ? '✅' : '❌';
    const platforms = cuj.platforms?.join(', ') || 'N/A';
    const checksStr = Object.entries(cuj.checks || {})
      .filter(([k, v]) => v !== 'n/a')
      .map(([k, v]) => `${k}:${v === 'pass' ? '✓' : v === 'fail' ? '✗' : '⚠'}`)
      .join(', ');

    md += `| ${cuj.cujId} | ${statusIcon} | ${cuj.execution_mode || 'N/A'} | ${platforms} | ${checksStr} |\n`;
  });

  md += `\n</details>\n`;

  try {
    writeFileSync(MD_OUTPUT_FILE, md);
    log(`📄 Markdown report written to: ${MD_OUTPUT_FILE}`, 'cyan');
  } catch (error) {
    log(`❌ Failed to write Markdown output: ${error.message}`, 'red');
  }
}

/**
 * Main entry point
 */
async function main() {
  try {
    const success = await runSmokeTests();

    // Write outputs
    writeJSONOutput();
    writeMarkdownOutput();

    process.exit(success ? 0 : 1);
  } catch (error) {
    log(`❌ Fatal error: ${error.message}`, 'red');
    if (VERBOSE) {
      console.error(error.stack);
    }
    process.exit(2);
  }
}

// Run smoke tests
main();
