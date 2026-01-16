#!/usr/bin/env node

/**
 * Dependency Validation Tool
 * Validates Node.js version, npm packages, system commands, and critical files
 * before task execution to prevent runtime failures.
 *
 * Usage:
 *   node .claude/tools/dependency-validator.mjs validate-all
 *   node .claude/tools/dependency-validator.mjs validate-node --min-version 18.0.0
 *   node .claude/tools/dependency-validator.mjs validate-packages --config path/to/config.json
 *   node .claude/tools/dependency-validator.mjs validate-commands --config path/to/config.json
 *   node .claude/tools/dependency-validator.mjs validate-files --config path/to/config.json
 *
 * Exit Codes:
 *   0 - All validations passed
 *   1 - Warnings found (non-critical missing dependencies)
 *   2 - Critical missing dependencies
 *   3 - Validation error (invalid config, unable to check)
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

/**
 * Parse command line arguments
 */
function parseArgs(args) {
  const command = args[2] || 'validate-all';
  const options = {};

  for (let i = 3; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];

    if (flag === '--min-version') {
      options.minVersion = value;
    } else if (flag === '--config') {
      options.configPath = value;
    } else if (flag === '--verbose') {
      options.verbose = true;
      i -= 1; // No value for this flag
    }
  }

  return { command, options };
}

/**
 * Load dependency requirements from config file
 */
function loadConfig(configPath) {
  try {
    const absolutePath = join(process.cwd(), configPath);
    if (!existsSync(absolutePath)) {
      throw new Error(`Config file not found: ${absolutePath}`);
    }

    const configContent = readFileSync(absolutePath, 'utf-8');
    return JSON.parse(configContent);
  } catch (error) {
    console.error(`${colors.red}Error loading config:${colors.reset} ${error.message}`);
    process.exit(3);
  }
}

/**
 * Validate Node.js version
 */
async function validateNodeVersion(minVersion) {
  console.log(`${colors.cyan}Validating Node.js version...${colors.reset}`);

  const currentVersion = process.version.substring(1); // Remove 'v' prefix
  const result = {
    valid: true,
    current_version: currentVersion,
    min_version: minVersion,
    errors: [],
    warnings: [],
  };

  if (compareVersions(currentVersion, minVersion) < 0) {
    result.valid = false;
    result.errors.push(
      `Node.js version ${currentVersion} is below minimum required version ${minVersion}`
    );
    result.recommendation = `Install Node.js ${minVersion} or later from https://nodejs.org`;
  } else {
    console.log(
      `${colors.green}✓${colors.reset} Node.js ${currentVersion} (>= ${minVersion})`
    );
  }

  return result;
}

/**
 * Validate npm packages
 */
async function validatePackages(packages) {
  console.log(`${colors.cyan}Validating npm packages...${colors.reset}`);

  const result = {
    valid: true,
    missing_dependencies: [],
    warnings: [],
    recommendations: [],
  };

  // Load package.json
  const packageJsonPath = join(process.cwd(), 'package.json');
  if (!existsSync(packageJsonPath)) {
    result.valid = false;
    result.errors = ['package.json not found'];
    return result;
  }

  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  const allDependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  for (const pkg of packages) {
    const installedVersion = allDependencies[pkg.name];

    if (!installedVersion) {
      if (pkg.optional) {
        result.warnings.push(
          `Optional package ${pkg.name} not installed (recommended: ${pkg.min_version})`
        );
      } else {
        result.valid = false;
        result.missing_dependencies.push({
          name: pkg.name,
          min_version: pkg.min_version,
          install_command: pkg.install_command || `npm install ${pkg.name}`,
        });
      }
    } else {
      // Extract version without range prefix (^, ~, etc.)
      const cleanVersion = installedVersion.replace(/^[\^~>=<]+/, '');

      if (compareVersions(cleanVersion, pkg.min_version) < 0) {
        result.valid = false;
        result.missing_dependencies.push({
          name: pkg.name,
          min_version: pkg.min_version,
          current_version: cleanVersion,
          install_command:
            pkg.install_command || `npm install ${pkg.name}@^${pkg.min_version}`,
        });
      } else {
        console.log(
          `${colors.green}✓${colors.reset} ${pkg.name} ${cleanVersion} (>= ${pkg.min_version})`
        );
      }
    }
  }

  if (result.missing_dependencies.length > 0) {
    result.recommendations = result.missing_dependencies.map(
      (dep) => dep.install_command
    );
  }

  return result;
}

/**
 * Validate system commands availability
 */
async function validateCommands(commands) {
  console.log(`${colors.cyan}Validating system commands...${colors.reset}`);

  const result = {
    valid: true,
    missing_dependencies: [],
    warnings: [],
    recommendations: [],
  };

  for (const cmd of commands) {
    try {
      const checkCommand =
        process.platform === 'win32' ? `where ${cmd.command}` : `which ${cmd.command}`;
      await execAsync(checkCommand);
      console.log(`${colors.green}✓${colors.reset} ${cmd.command} (${cmd.purpose})`);
    } catch (error) {
      if (cmd.optional) {
        result.warnings.push(
          `Optional command '${cmd.command}' not found (purpose: ${cmd.purpose})`
        );
        if (cmd.install_instructions) {
          console.log(
            `${colors.yellow}⚠${colors.reset} ${cmd.command} (optional) - ${cmd.install_instructions}`
          );
        }
      } else {
        result.valid = false;
        result.missing_dependencies.push({
          command: cmd.command,
          purpose: cmd.purpose,
          install_instructions: cmd.install_instructions || 'No installation instructions provided',
        });
      }
    }
  }

  if (result.missing_dependencies.length > 0) {
    result.recommendations = result.missing_dependencies.map(
      (dep) => dep.install_instructions
    );
  }

  return result;
}

/**
 * Validate critical files exist
 */
async function validateFiles(files) {
  console.log(`${colors.cyan}Validating critical files...${colors.reset}`);

  const result = {
    valid: true,
    missing_dependencies: [],
    warnings: [],
    recommendations: [],
  };

  for (const file of files) {
    const filePath = join(process.cwd(), file.path);

    if (!existsSync(filePath)) {
      if (file.optional) {
        result.warnings.push(`Optional file '${file.path}' not found (${file.description})`);
        console.log(
          `${colors.yellow}⚠${colors.reset} ${file.path} (optional) - ${file.description}`
        );
      } else {
        result.valid = false;
        result.missing_dependencies.push({
          path: file.path,
          description: file.description,
        });
      }
    } else {
      console.log(`${colors.green}✓${colors.reset} ${file.path} (${file.description})`);
    }
  }

  if (result.missing_dependencies.length > 0) {
    result.recommendations = result.missing_dependencies.map(
      (dep) => `Create ${dep.path} (${dep.description})`
    );
  }

  return result;
}

/**
 * Validate all dependencies
 */
async function validateAll(configPath) {
  console.log(`${colors.blue}Starting comprehensive dependency validation...${colors.reset}\n`);

  const config = configPath
    ? loadConfig(configPath)
    : loadDefaultConfig();

  const results = {
    node: null,
    packages: null,
    commands: null,
    files: null,
  };

  // Validate Node.js version
  if (config.node) {
    results.node = await validateNodeVersion(config.node.min_version);
  }

  console.log('');

  // Validate npm packages
  if (config.npm_packages && config.npm_packages.length > 0) {
    results.packages = await validatePackages(config.npm_packages);
  }

  console.log('');

  // Validate system commands
  if (config.system_commands && config.system_commands.length > 0) {
    results.commands = await validateCommands(config.system_commands);
  }

  console.log('');

  // Validate critical files
  if (config.critical_files && config.critical_files.length > 0) {
    results.files = await validateFiles(config.critical_files);
  }

  console.log('');

  // Aggregate results
  const allValid =
    (!results.node || results.node.valid) &&
    (!results.packages || results.packages.valid) &&
    (!results.commands || results.commands.valid) &&
    (!results.files || results.files.valid);

  const hasWarnings =
    (results.node && results.node.warnings?.length > 0) ||
    (results.packages && results.packages.warnings?.length > 0) ||
    (results.commands && results.commands.warnings?.length > 0) ||
    (results.files && results.files.warnings?.length > 0);

  // Print summary
  console.log(`${colors.blue}Validation Summary:${colors.reset}`);
  if (allValid && !hasWarnings) {
    console.log(`${colors.green}✓ All dependencies validated successfully${colors.reset}\n`);
  } else if (allValid && hasWarnings) {
    console.log(`${colors.yellow}⚠ Validation passed with warnings${colors.reset}\n`);
    printWarnings(results);
  } else {
    console.log(`${colors.red}✗ Validation failed - missing critical dependencies${colors.reset}\n`);
    printErrors(results);
  }

  // Output JSON result
  const output = {
    valid: allValid,
    timestamp: new Date().toISOString(),
    results,
  };

  console.log(JSON.stringify(output, null, 2));

  // Exit with appropriate code
  if (!allValid) {
    process.exit(2); // Critical missing dependencies
  } else if (hasWarnings) {
    process.exit(1); // Warnings
  } else {
    process.exit(0); // Success
  }
}

/**
 * Print error details
 */
function printErrors(results) {
  console.log(`${colors.red}Errors:${colors.reset}`);

  if (results.node && !results.node.valid) {
    console.log(`  - Node.js: ${results.node.errors.join(', ')}`);
    if (results.node.recommendation) {
      console.log(`    ${colors.yellow}→${colors.reset} ${results.node.recommendation}`);
    }
  }

  if (results.packages && !results.packages.valid) {
    console.log(`  - Missing packages:`);
    results.packages.missing_dependencies.forEach((dep) => {
      console.log(`    • ${dep.name} (>= ${dep.min_version})`);
      console.log(`      ${colors.yellow}→${colors.reset} ${dep.install_command}`);
    });
  }

  if (results.commands && !results.commands.valid) {
    console.log(`  - Missing commands:`);
    results.commands.missing_dependencies.forEach((dep) => {
      console.log(`    • ${dep.command} (${dep.purpose})`);
      console.log(`      ${colors.yellow}→${colors.reset} ${dep.install_instructions}`);
    });
  }

  if (results.files && !results.files.valid) {
    console.log(`  - Missing files:`);
    results.files.missing_dependencies.forEach((dep) => {
      console.log(`    • ${dep.path} (${dep.description})`);
    });
  }

  console.log('');
}

/**
 * Print warning details
 */
function printWarnings(results) {
  console.log(`${colors.yellow}Warnings:${colors.reset}`);

  const allWarnings = [
    ...(results.node?.warnings || []),
    ...(results.packages?.warnings || []),
    ...(results.commands?.warnings || []),
    ...(results.files?.warnings || []),
  ];

  allWarnings.forEach((warning) => {
    console.log(`  - ${warning}`);
  });

  console.log('');
}

/**
 * Load default configuration
 */
function loadDefaultConfig() {
  return {
    node: { min_version: '18.0.0' },
    npm_packages: [
      { name: 'prettier', min_version: '3.0.0', install_command: 'npm install -D prettier' },
      { name: 'eslint', min_version: '8.0.0', install_command: 'npm install -D eslint' },
    ],
    system_commands: [
      {
        command: 'git',
        purpose: 'Version control',
        install_instructions: 'Install Git from https://git-scm.com',
      },
      {
        command: 'node',
        purpose: 'Node.js runtime',
        install_instructions: 'Install Node.js from https://nodejs.org',
      },
    ],
    critical_files: [
      { path: 'package.json', description: 'NPM package manifest' },
      { path: '.gitignore', description: 'Git ignore rules' },
    ],
  };
}

/**
 * Compare semantic versions
 * Returns: -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;

    if (part1 < part2) return -1;
    if (part1 > part2) return 1;
  }

  return 0;
}

/**
 * Print usage information
 */
function printUsage() {
  console.log(`
${colors.cyan}Dependency Validator${colors.reset}

Usage:
  node .claude/tools/dependency-validator.mjs <command> [options]

Commands:
  validate-all                 Validate all dependencies (Node.js, packages, commands, files)
  validate-node                Validate Node.js version only
  validate-packages            Validate npm packages only
  validate-commands            Validate system commands only
  validate-files               Validate critical files only

Options:
  --config <path>              Path to dependency requirements config file
  --min-version <version>      Minimum Node.js version (for validate-node command)
  --verbose                    Enable verbose output

Examples:
  node .claude/tools/dependency-validator.mjs validate-all
  node .claude/tools/dependency-validator.mjs validate-node --min-version 18.0.0
  node .claude/tools/dependency-validator.mjs validate-all --config .claude/templates/dependency-requirements-example.json

Exit Codes:
  0 - All validations passed
  1 - Warnings found (non-critical missing dependencies)
  2 - Critical missing dependencies
  3 - Validation error (invalid config, unable to check)
  `);
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv;

  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  const { command, options } = parseArgs(args);

  try {
    switch (command) {
      case 'validate-all': {
        await validateAll(options.configPath);
        break;
      }

      case 'validate-node': {
        const minVersion = options.minVersion || '18.0.0';
        const result = await validateNodeVersion(minVersion);
        console.log(JSON.stringify(result, null, 2));
        process.exit(result.valid ? 0 : 2);
        break;
      }

      case 'validate-packages': {
        const config = options.configPath
          ? loadConfig(options.configPath)
          : loadDefaultConfig();
        const result = await validatePackages(config.npm_packages || []);
        console.log(JSON.stringify(result, null, 2));
        process.exit(result.valid ? 0 : 2);
        break;
      }

      case 'validate-commands': {
        const config = options.configPath
          ? loadConfig(options.configPath)
          : loadDefaultConfig();
        const result = await validateCommands(config.system_commands || []);
        console.log(JSON.stringify(result, null, 2));
        process.exit(result.valid ? 0 : 2);
        break;
      }

      case 'validate-files': {
        const config = options.configPath
          ? loadConfig(options.configPath)
          : loadDefaultConfig();
        const result = await validateFiles(config.critical_files || []);
        console.log(JSON.stringify(result, null, 2));
        process.exit(result.valid ? 0 : 2);
        break;
      }

      default:
        console.error(`${colors.red}Unknown command: ${command}${colors.reset}\n`);
        printUsage();
        process.exit(3);
    }
  } catch (error) {
    console.error(`${colors.red}Validation error:${colors.reset} ${error.message}`);
    console.error(error.stack);
    process.exit(3);
  }
}

main();
