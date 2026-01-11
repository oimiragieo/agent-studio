#!/usr/bin/env node
/**
 * Validate Response-Rater Dependencies
 *
 * Checks if required CLI tools for the response-rater skill are available.
 * The response-rater skill uses multiple AI models to evaluate plan quality.
 *
 * Required Tools (at least one must be available):
 * - claude: Anthropic Claude CLI
 * - gemini: Google Gemini CLI
 * - codex: OpenAI Codex CLI
 * - cursor-agent: Cursor AI agent CLI
 * - copilot: GitHub Copilot CLI
 *
 * Exit Codes:
 * - 0: At least one rater CLI is available
 * - 1: No rater CLIs are available (response-rater will not work)
 *
 * Usage:
 *   node validate-response-rater-dependencies.mjs [--json] [--verbose]
 *
 * Options:
 *   --json       Output results in JSON format
 *   --verbose    Show detailed availability information
 *   --help       Show this help message
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

// Configuration
const RATER_CLIS = [
  {
    name: 'claude',
    displayName: 'Anthropic Claude',
    command: 'claude --version',
    description: 'Official Anthropic Claude CLI',
    priority: 'high',
  },
  {
    name: 'gemini',
    displayName: 'Google Gemini',
    command: 'gemini --version',
    description: 'Google Gemini CLI for AI responses',
    priority: 'high',
  },
  {
    name: 'codex',
    displayName: 'OpenAI Codex',
    command: 'codex --version',
    description: 'OpenAI Codex CLI',
    priority: 'medium',
  },
  {
    name: 'cursor-agent',
    displayName: 'Cursor Agent',
    command: 'cursor-agent --version',
    description: 'Cursor AI agent CLI',
    priority: 'medium',
  },
  {
    name: 'copilot',
    displayName: 'GitHub Copilot',
    command: 'copilot --version',
    description: 'GitHub Copilot CLI',
    priority: 'low',
  },
];

// Parse CLI arguments
const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const verbose = args.includes('--verbose');
const showHelp = args.includes('--help') || args.includes('-h');

// Show help and exit
if (showHelp) {
  console.log(`
Validate Response-Rater Dependencies

Checks if required CLI tools for the response-rater skill are available.

Usage:
  node validate-response-rater-dependencies.mjs [options]

Options:
  --json       Output results in JSON format
  --verbose    Show detailed availability information
  --help, -h   Show this help message

Exit Codes:
  0  At least one rater CLI is available
  1  No rater CLIs are available (response-rater will not work)

Required Tools (at least one):
  - claude: Anthropic Claude CLI
  - gemini: Google Gemini CLI
  - codex: OpenAI Codex CLI
  - cursor-agent: Cursor AI agent CLI
  - copilot: GitHub Copilot CLI
`);
  process.exit(0);
}

/**
 * Check if a CLI tool is available
 * @param {string} command - Command to execute
 * @returns {Promise<boolean>} True if available, false otherwise
 */
async function isCommandAvailable(command) {
  try {
    execSync(command, { stdio: 'ignore', timeout: 5000 });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Check availability of all rater CLIs
 * @returns {Promise<Object>} Results object with availability status
 */
async function checkAvailability() {
  const results = {
    timestamp: new Date().toISOString(),
    available: [],
    unavailable: [],
    summary: {
      total: RATER_CLIS.length,
      available_count: 0,
      unavailable_count: 0,
      status: 'unknown',
    },
  };

  if (!jsonOutput && !verbose) {
    console.log('🔍 Checking Response-Rater CLI Dependencies...\n');
  }

  for (const cli of RATER_CLIS) {
    const available = await isCommandAvailable(cli.command);

    const cliInfo = {
      name: cli.name,
      displayName: cli.displayName,
      description: cli.description,
      priority: cli.priority,
      available,
    };

    if (available) {
      results.available.push(cliInfo);
      results.summary.available_count++;

      if (!jsonOutput && verbose) {
        console.log(`✅ ${cli.displayName} (${cli.name}) - AVAILABLE`);
        console.log(`   Priority: ${cli.priority}`);
        console.log(`   Description: ${cli.description}\n`);
      } else if (!jsonOutput) {
        console.log(`✅ ${cli.displayName} - AVAILABLE`);
      }
    } else {
      results.unavailable.push(cliInfo);
      results.summary.unavailable_count++;

      if (!jsonOutput && verbose) {
        console.log(`❌ ${cli.displayName} (${cli.name}) - NOT AVAILABLE`);
        console.log(`   Priority: ${cli.priority}`);
        console.log(`   Description: ${cli.description}\n`);
      } else if (!jsonOutput) {
        console.log(`❌ ${cli.displayName} - NOT AVAILABLE`);
      }
    }
  }

  // Determine overall status
  if (results.summary.available_count === 0) {
    results.summary.status = 'critical';
    results.summary.message = 'No rater CLIs available - response-rater skill will not work';
  } else if (results.summary.available_count === 1) {
    results.summary.status = 'warning';
    results.summary.message = 'Only one rater CLI available - limited multi-model validation';
  } else if (results.summary.available_count >= 2) {
    results.summary.status = 'ok';
    results.summary.message = `${results.summary.available_count} rater CLIs available - multi-model validation enabled`;
  }

  return results;
}

/**
 * Output results in specified format
 * @param {Object} results - Results object from checkAvailability
 */
function outputResults(results) {
  if (jsonOutput) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log('\n' + '='.repeat(80));
    console.log(
      `\n📊 Summary: ${results.summary.available_count} of ${results.summary.total} CLIs available`
    );

    if (results.summary.status === 'critical') {
      console.log('\n❌ CRITICAL: No rater CLIs available');
      console.log('   The response-rater skill will not work without at least one CLI.');
      console.log('\n   Install at least one of the following:');
      results.unavailable.forEach(cli => {
        console.log(`   - ${cli.displayName} (${cli.name}) - ${cli.description}`);
      });
    } else if (results.summary.status === 'warning') {
      console.log('\n⚠️  WARNING: Only one rater CLI available');
      console.log('   Multi-model validation requires at least 2 CLIs.');
      console.log('\n   Consider installing additional CLIs:');
      results.unavailable.forEach(cli => {
        console.log(`   - ${cli.displayName} (${cli.name}) - ${cli.description}`);
      });
    } else {
      console.log(`\n✅ ${results.summary.message}`);
      console.log('\n   Available CLIs:');
      results.available.forEach(cli => {
        console.log(`   - ${cli.displayName} (${cli.name}) [Priority: ${cli.priority}]`);
      });

      if (results.unavailable.length > 0) {
        console.log('\n   Optional additional CLIs:');
        results.unavailable.forEach(cli => {
          console.log(`   - ${cli.displayName} (${cli.name}) [Priority: ${cli.priority}]`);
        });
      }
    }

    console.log('\n' + '='.repeat(80) + '\n');
  }
}

// Main execution
(async () => {
  try {
    const results = await checkAvailability();
    outputResults(results);

    // Exit with appropriate code
    if (results.summary.available_count === 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (error) {
    if (jsonOutput) {
      console.error(
        JSON.stringify(
          {
            error: true,
            message: error.message,
            stack: error.stack,
          },
          null,
          2
        )
      );
    } else {
      console.error(`\n❌ ERROR: ${error.message}\n`);
      if (verbose) {
        console.error(error.stack);
      }
    }
    process.exit(1);
  }
})();
