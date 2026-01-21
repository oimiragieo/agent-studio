#!/usr/bin/env node
/**
 * Pre-PR Gate Enforcement
 * BLOCKS PR creation if code quality checks fail
 *
 * This is a HARD GATE - cannot be bypassed without --force
 *
 * Auto-detects and runs:
 * - Code formatting (prettier, black, rustfmt)
 * - Linting (eslint, pylint, flake8)
 * - Validation (custom validation scripts)
 * - Tests (jest, pytest, vitest, mocha)
 *
 * Exit codes:
 * 0 = All checks passed
 * 1 = One or more checks failed (BLOCKED)
 * 2 = Fatal error during gate execution
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class PrePRGate {
  constructor(options = {}) {
    this.force = options.force || false;
    this.verbose = options.verbose || false;
    this.skipTests = options.skipTests || false;
    this.results = {
      formatting: { status: 'pending', errors: [], tool: null },
      linting: { status: 'pending', errors: [], tool: null },
      validation: { status: 'pending', errors: [], tool: null },
      tests: { status: 'pending', errors: [], tool: null },
    };
  }

  /**
   * Run all pre-PR checks
   * Returns: { passed: boolean, results: object }
   */
  async run() {
    console.log('🚦 Running Pre-PR Gate Checks...\n');

    try {
      // Step 1: Detect tools
      const tools = this.detectTools();
      console.log('📦 Detected Tools:');
      console.log(`   Formatter:  ${tools.formatter || 'none'}`);
      console.log(`   Linter:     ${tools.linter || 'none'}`);
      console.log(`   Validator:  ${tools.validator || 'none'}`);
      console.log(`   Test Runner: ${tools.testRunner || 'none'}`);
      console.log('');

      // Step 2: Run formatting check
      await this.checkFormatting(tools);

      // Step 3: Run linting check
      await this.checkLinting(tools);

      // Step 4: Run validation check
      await this.checkValidation(tools);

      // Step 5: Run tests (if available and not skipped)
      if (!this.skipTests) {
        await this.checkTests(tools);
      } else {
        console.log('🧪 Checking tests...');
        console.log('  ⚠️  Tests skipped (--skip-tests flag)\n');
        this.results.tests.status = 'skipped';
      }

      // Step 6: Generate report
      const report = this.generateReport();

      // Step 7: Block if failed (unless --force)
      if (!report.passed && !this.force) {
        console.error('\n❌ PRE-PR GATE FAILED - BLOCKING PR CREATION\n');
        console.error('┌─────────────────────────────────────────────────────────┐');
        console.error('│  Fix the issues above or use --force to bypass         │');
        console.error('│  (NOT RECOMMENDED - creates technical debt)            │');
        console.error('└─────────────────────────────────────────────────────────┘\n');

        this.printFailureSummary(report);

        process.exit(1);
      }

      if (!report.passed && this.force) {
        console.warn('\n⚠️  PRE-PR GATE FAILED - BYPASSED WITH --force\n');
        console.warn('┌─────────────────────────────────────────────────────────┐');
        console.warn('│  WARNING: This PR has known quality issues!            │');
        console.warn('│  Fix before merge to avoid technical debt              │');
        console.warn('└─────────────────────────────────────────────────────────┘\n');

        this.printFailureSummary(report);
      }

      if (report.passed) {
        console.log('\n✅ PRE-PR GATE PASSED - Ready for PR creation\n');
        console.log('All quality checks completed successfully:');
        if (report.results.formatting.status === 'passed') {
          console.log(`  ✓ Formatting (${report.results.formatting.tool})`);
        }
        if (report.results.linting.status === 'passed') {
          console.log(`  ✓ Linting (${report.results.linting.tool})`);
        }
        if (report.results.validation.status === 'passed') {
          console.log(`  ✓ Validation (${report.results.validation.tool})`);
        }
        if (report.results.tests.status === 'passed') {
          console.log(`  ✓ Tests (${report.results.tests.tool})`);
        }
        console.log('');
      }

      return report;
    } catch (error) {
      console.error('\n💥 FATAL ERROR during pre-PR gate execution:\n');
      console.error(error.message);
      if (this.verbose) {
        console.error('\nStack trace:');
        console.error(error.stack);
      }
      process.exit(2);
    }
  }

  /**
   * Auto-detect which tools are available
   */
  detectTools() {
    const packageJson = this.readPackageJson();
    const tools = {
      formatter: null,
      linter: null,
      validator: null,
      testRunner: null,
    };

    // Detect formatter
    if (packageJson.scripts?.format || packageJson.scripts?.['format:check']) {
      if (packageJson.devDependencies?.prettier || packageJson.dependencies?.prettier) {
        tools.formatter = 'prettier';
      } else {
        tools.formatter = 'custom';
      }
    } else if (packageJson.devDependencies?.black || packageJson.dependencies?.black) {
      tools.formatter = 'black';
    } else if (this.commandExists('rustfmt')) {
      tools.formatter = 'rustfmt';
    } else if (this.commandExists('gofmt')) {
      tools.formatter = 'gofmt';
    } else if (packageJson.devDependencies?.['@biomejs/biome']) {
      tools.formatter = 'biome';
    }

    // Detect linter
    if (packageJson.scripts?.lint) {
      if (packageJson.devDependencies?.eslint || packageJson.dependencies?.eslint) {
        tools.linter = 'eslint';
      } else if (packageJson.devDependencies?.['@biomejs/biome']) {
        tools.linter = 'biome';
      } else {
        tools.linter = 'custom';
      }
    } else if (packageJson.devDependencies?.pylint || packageJson.dependencies?.pylint) {
      tools.linter = 'pylint';
    } else if (packageJson.devDependencies?.flake8 || packageJson.dependencies?.flake8) {
      tools.linter = 'flake8';
    } else if (this.commandExists('clippy')) {
      tools.linter = 'clippy';
    } else if (this.commandExists('golangci-lint')) {
      tools.linter = 'golangci-lint';
    }

    // Detect validator
    if (packageJson.scripts?.validate || packageJson.scripts?.['validate:full']) {
      tools.validator = 'custom';
    }

    // Detect test runner
    if (packageJson.scripts?.test) {
      if (packageJson.devDependencies?.jest || packageJson.dependencies?.jest) {
        tools.testRunner = 'jest';
      } else if (packageJson.devDependencies?.vitest || packageJson.dependencies?.vitest) {
        tools.testRunner = 'vitest';
      } else if (packageJson.devDependencies?.mocha || packageJson.dependencies?.mocha) {
        tools.testRunner = 'mocha';
      } else if (packageJson.devDependencies?.ava || packageJson.dependencies?.ava) {
        tools.testRunner = 'ava';
      } else {
        tools.testRunner = 'custom';
      }
    } else if (packageJson.devDependencies?.pytest || packageJson.dependencies?.pytest) {
      tools.testRunner = 'pytest';
    } else if (this.commandExists('cargo')) {
      tools.testRunner = 'cargo';
    } else if (this.commandExists('go')) {
      tools.testRunner = 'go';
    }

    return tools;
  }

  /**
   * Check code formatting
   */
  async checkFormatting(tools) {
    console.log('🎨 Checking code formatting...');

    if (!tools.formatter) {
      console.log('  ⚠️  No formatter detected - skipping');
      this.results.formatting.status = 'skipped';
      return;
    }

    this.results.formatting.tool = tools.formatter;

    try {
      if (tools.formatter === 'prettier') {
        const packageJson = this.readPackageJson();
        if (packageJson.scripts?.['format:check']) {
          this.execCommand('npm run format:check', 'Prettier format check');
        } else if (packageJson.scripts?.format) {
          // Run format and check if files changed
          const status = this.getGitStatus();
          this.execCommand('npm run format', 'Prettier format');
          const newStatus = this.getGitStatus();
          if (status !== newStatus) {
            throw new Error('Files were reformatted - commit the changes before creating PR');
          }
        }
      } else if (tools.formatter === 'black') {
        this.execCommand('black --check .', 'Black format check');
      } else if (tools.formatter === 'rustfmt') {
        this.execCommand('cargo fmt -- --check', 'Rustfmt format check');
      } else if (tools.formatter === 'gofmt') {
        const output = this.execCommand('gofmt -l .', 'Gofmt format check', false);
        if (output.trim()) {
          throw new Error(`Files need formatting:\n${output}`);
        }
      } else if (tools.formatter === 'biome') {
        this.execCommand('npx @biomejs/biome format .', 'Biome format check');
      } else if (tools.formatter === 'custom') {
        this.execCommand('npm run format:check || npm run format', 'Custom format check');
      }

      console.log('  ✅ Formatting check passed\n');
      this.results.formatting.status = 'passed';
    } catch (error) {
      console.error('  ❌ Formatting check failed');
      const errorMsg = this.extractErrorMessage(error);
      console.error(`     ${errorMsg}\n`);
      this.results.formatting.status = 'failed';
      this.results.formatting.errors.push(errorMsg);
    }
  }

  /**
   * Check linting
   */
  async checkLinting(tools) {
    console.log('🔍 Checking linting...');

    if (!tools.linter) {
      console.log('  ⚠️  No linter detected - skipping');
      this.results.linting.status = 'skipped';
      return;
    }

    this.results.linting.tool = tools.linter;

    try {
      if (tools.linter === 'eslint') {
        this.execCommand('npm run lint', 'ESLint');
      } else if (tools.linter === 'pylint') {
        this.execCommand('pylint .', 'Pylint');
      } else if (tools.linter === 'flake8') {
        this.execCommand('flake8 .', 'Flake8');
      } else if (tools.linter === 'clippy') {
        this.execCommand('cargo clippy -- -D warnings', 'Clippy');
      } else if (tools.linter === 'golangci-lint') {
        this.execCommand('golangci-lint run', 'golangci-lint');
      } else if (tools.linter === 'biome') {
        this.execCommand('npx @biomejs/biome lint .', 'Biome lint');
      } else if (tools.linter === 'custom') {
        this.execCommand('npm run lint', 'Custom linter');
      }

      console.log('  ✅ Linting check passed\n');
      this.results.linting.status = 'passed';
    } catch (error) {
      console.error('  ❌ Linting check failed');
      const errorMsg = this.extractErrorMessage(error);
      console.error(`     ${errorMsg}\n`);
      this.results.linting.status = 'failed';
      this.results.linting.errors.push(errorMsg);
    }
  }

  /**
   * Check validation
   */
  async checkValidation(tools) {
    console.log('✓ Checking validation...');

    if (!tools.validator) {
      console.log('  ⚠️  No validator detected - skipping');
      this.results.validation.status = 'skipped';
      return;
    }

    this.results.validation.tool = tools.validator;

    try {
      const packageJson = this.readPackageJson();
      if (packageJson.scripts?.['validate:full']) {
        this.execCommand('npm run validate:full', 'Full validation');
      } else if (packageJson.scripts?.validate) {
        this.execCommand('npm run validate', 'Validation');
      }

      console.log('  ✅ Validation check passed\n');
      this.results.validation.status = 'passed';
    } catch (error) {
      console.error('  ❌ Validation check failed');
      const errorMsg = this.extractErrorMessage(error);
      console.error(`     ${errorMsg}\n`);
      this.results.validation.status = 'failed';
      this.results.validation.errors.push(errorMsg);
    }
  }

  /**
   * Check tests
   */
  async checkTests(tools) {
    console.log('🧪 Checking tests...');

    if (!tools.testRunner) {
      console.log('  ⚠️  No test runner detected - skipping');
      this.results.tests.status = 'skipped';
      return;
    }

    this.results.tests.tool = tools.testRunner;

    try {
      if (tools.testRunner === 'jest') {
        this.execCommand('npm test -- --passWithNoTests', 'Jest tests');
      } else if (tools.testRunner === 'vitest') {
        this.execCommand('npm test', 'Vitest tests');
      } else if (tools.testRunner === 'mocha') {
        this.execCommand('npm test', 'Mocha tests');
      } else if (tools.testRunner === 'ava') {
        this.execCommand('npm test', 'Ava tests');
      } else if (tools.testRunner === 'pytest') {
        this.execCommand('pytest', 'Pytest tests');
      } else if (tools.testRunner === 'cargo') {
        this.execCommand('cargo test', 'Cargo tests');
      } else if (tools.testRunner === 'go') {
        this.execCommand('go test ./...', 'Go tests');
      } else if (tools.testRunner === 'custom') {
        this.execCommand('npm test', 'Custom tests');
      }

      console.log('  ✅ Tests passed\n');
      this.results.tests.status = 'passed';
    } catch (error) {
      console.error('  ❌ Tests failed');
      const errorMsg = this.extractErrorMessage(error);
      console.error(`     ${errorMsg}\n`);
      this.results.tests.status = 'failed';
      this.results.tests.errors.push(errorMsg);
    }
  }

  /**
   * Generate final report
   */
  generateReport() {
    const checks = Object.entries(this.results);
    const failed = checks.filter(([_, result]) => result.status === 'failed');
    const passed = checks.filter(([_, result]) => result.status === 'passed');
    const skipped = checks.filter(([_, result]) => result.status === 'skipped');

    const report = {
      passed: failed.length === 0,
      timestamp: new Date().toISOString(),
      summary: {
        total: checks.length,
        passed: passed.length,
        failed: failed.length,
        skipped: skipped.length,
      },
      results: this.results,
      failedChecks: failed.map(([name, result]) => ({
        check: name,
        tool: result.tool,
        errors: result.errors,
      })),
    };

    return report;
  }

  /**
   * Print failure summary
   */
  printFailureSummary(report) {
    if (report.failedChecks.length === 0) return;

    console.error('Failed checks:\n');
    report.failedChecks.forEach(check => {
      console.error(`  ❌ ${check.check} (${check.tool})`);
      check.errors.forEach(error => {
        const lines = error.split('\n').slice(0, 5); // First 5 lines only
        lines.forEach(line => console.error(`     ${line}`));
        if (error.split('\n').length > 5) {
          console.error('     ... (truncated)');
        }
      });
      console.error('');
    });

    console.error('How to fix:');
    report.failedChecks.forEach(check => {
      const fixes = {
        formatting: `  Run: npm run format`,
        linting: `  Run: npm run lint -- --fix`,
        validation: `  Fix validation errors and run: npm run validate`,
        tests: `  Fix failing tests and run: npm test`,
      };
      console.error(fixes[check.check] || `  Fix ${check.check} issues`);
    });
    console.error('');
  }

  // Helper methods

  /**
   * Execute command and return output
   */
  execCommand(command, description, throwOnError = true) {
    try {
      if (this.verbose) {
        console.log(`  Running: ${command}`);
      }
      const output = execSync(command, {
        encoding: 'utf-8',
        stdio: this.verbose ? 'inherit' : 'pipe',
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });
      return output;
    } catch (error) {
      if (throwOnError) {
        throw error;
      }
      return error.stdout || error.stderr || '';
    }
  }

  /**
   * Extract meaningful error message
   */
  extractErrorMessage(error) {
    if (error.stderr) {
      // Take last 10 lines of stderr for context
      const lines = error.stderr.split('\n').filter(l => l.trim());
      return lines.slice(-10).join('\n');
    }
    if (error.stdout) {
      const lines = error.stdout.split('\n').filter(l => l.trim());
      return lines.slice(-10).join('\n');
    }
    return error.message || 'Unknown error';
  }

  /**
   * Read package.json
   */
  readPackageJson() {
    try {
      const packagePath = path.resolve(process.cwd(), 'package.json');
      return JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
    } catch {
      return { scripts: {}, devDependencies: {}, dependencies: {} };
    }
  }

  /**
   * Check if command exists
   */
  commandExists(cmd) {
    try {
      const isWindows = process.platform === 'win32';
      const command = isWindows ? `where ${cmd}` : `which ${cmd}`;
      execSync(command, { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get git status hash for change detection
   */
  getGitStatus() {
    try {
      return execSync('git status --porcelain', { encoding: 'utf-8' }).trim();
    } catch {
      return null;
    }
  }
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const options = {
    force: args.includes('--force'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    skipTests: args.includes('--skip-tests'),
  };

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Pre-PR Quality Gate

USAGE:
  node .claude/tools/pre-pr-gate.mjs [OPTIONS]

OPTIONS:
  --force        Bypass gate failures (NOT RECOMMENDED)
  --skip-tests   Skip running tests
  --verbose, -v  Verbose output
  --json         Output report as JSON
  --help, -h     Show this help

EXIT CODES:
  0  All checks passed
  1  One or more checks failed (BLOCKED)
  2  Fatal error during gate execution

EXAMPLES:
  # Run all checks
  node .claude/tools/pre-pr-gate.mjs

  # Run with verbose output
  node .claude/tools/pre-pr-gate.mjs --verbose

  # Skip tests (formatting + linting only)
  node .claude/tools/pre-pr-gate.mjs --skip-tests

  # Bypass failures (creates technical debt!)
  node .claude/tools/pre-pr-gate.mjs --force
`);
    process.exit(0);
  }

  const gate = new PrePRGate(options);
  gate
    .run()
    .then(report => {
      if (args.includes('--json')) {
        console.log(JSON.stringify(report, null, 2));
      }
      process.exit(report.passed ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Fatal error:', error.message);
      if (options.verbose) {
        console.error(error.stack);
      }
      process.exit(2);
    });
}

export default PrePRGate;
