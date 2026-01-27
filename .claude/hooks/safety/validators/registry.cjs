'use strict';

/**
 * Validator Registry
 * Converted from Auto-Claude validator_registry.py
 *
 * Central registry mapping commands to their validators.
 * Provides a unified interface for command validation.
 */

const shellValidators = require('./shell-validators.cjs');
const databaseValidators = require('./database-validators.cjs');
const filesystemValidators = require('./filesystem-validators.cjs');
const gitValidators = require('./git-validators.cjs');
const processValidators = require('./process-validators.cjs');
const networkValidators = require('./network-validators.cjs');

/**
 * Registry mapping command names to their validator functions.
 * Each validator function takes a command string and returns
 * { valid: boolean, error: string }
 *
 * @type {Map<string, function(string): {valid: boolean, error: string}>}
 */
const VALIDATOR_REGISTRY = new Map([
  // Shell interpreters
  ['bash', shellValidators.validateBashCommand],
  ['sh', shellValidators.validateShCommand],
  ['zsh', shellValidators.validateZshCommand],

  // PostgreSQL
  ['dropdb', databaseValidators.validateDropdbCommand],
  ['dropuser', databaseValidators.validateDropuserCommand],
  ['psql', databaseValidators.validatePsqlCommand],

  // MySQL
  ['mysql', databaseValidators.validateMysqlCommand],
  ['mysqladmin', databaseValidators.validateMysqladminCommand],

  // Redis
  ['redis-cli', databaseValidators.validateRedisCliCommand],

  // MongoDB
  ['mongosh', databaseValidators.validateMongoshCommand],
  ['mongo', databaseValidators.validateMongoshCommand], // Legacy command

  // Filesystem
  ['chmod', filesystemValidators.validateChmodCommand],
  ['rm', filesystemValidators.validateRmCommand],

  // Git
  ['git', gitValidators.validateGitCommand],

  // Process management
  ['kill', processValidators.validateKillCommand],
  ['pkill', processValidators.validatePkillCommand],
  ['killall', processValidators.validateKillallCommand],

  // Network and remote execution (SECURITY CRITICAL)
  ['curl', networkValidators.validateCurlCommand],
  ['wget', networkValidators.validateWgetCommand],
  ['nc', networkValidators.validateNcCommand],
  ['netcat', networkValidators.validateNetcatCommand],
  ['ssh', networkValidators.validateSshCommand],
  ['sudo', networkValidators.validateSudoCommand],
  ['scp', networkValidators.validateScpCommand],
  ['rsync', networkValidators.validateRsyncCommand],
]);

/**
 * Get the validator function for a command.
 *
 * @param {string} commandName - The command name (e.g., 'bash', 'git', 'rm')
 * @returns {function|null} The validator function or null if none exists
 */
function getValidator(commandName) {
  return VALIDATOR_REGISTRY.get(commandName) || null;
}

/**
 * Check if a command has a registered validator.
 *
 * @param {string} commandName - The command name to check
 * @returns {boolean} True if a validator exists for this command
 */
function hasValidator(commandName) {
  return VALIDATOR_REGISTRY.has(commandName);
}

/**
 * Get all registered command names.
 *
 * @returns {string[]} Array of command names with validators
 */
function getRegisteredCommands() {
  return Array.from(VALIDATOR_REGISTRY.keys());
}

/**
 * Validate a command string.
 *
 * Extracts the command name and applies the appropriate validator.
 *
 * @param {string} commandString - The full command string
 * @returns {{valid: boolean, error: string, hasValidator: boolean}} Validation result
 */
function validateCommand(commandString) {
  if (!commandString || typeof commandString !== 'string') {
    return { valid: false, error: 'Invalid command string', hasValidator: false };
  }

  // Extract the command name (first token)
  const trimmed = commandString.trim();
  const firstSpace = trimmed.indexOf(' ');
  const commandName = firstSpace === -1 ? trimmed : trimmed.slice(0, firstSpace);

  // Handle paths (e.g., /usr/bin/git -> git)
  const baseName = commandName.includes('/')
    ? commandName.split('/').pop()
    : commandName.includes('\\')
      ? commandName.split('\\').pop()
      : commandName;

  const validator = getValidator(baseName);

  if (!validator) {
    // No validator registered - allow by default
    return { valid: true, error: '', hasValidator: false };
  }

  const result = validator(commandString);
  return { ...result, hasValidator: true };
}

/**
 * Register a new validator for a command.
 *
 * @param {string} commandName - The command name
 * @param {function} validator - The validator function
 */
function registerValidator(commandName, validator) {
  if (typeof validator !== 'function') {
    throw new Error('Validator must be a function');
  }
  VALIDATOR_REGISTRY.set(commandName, validator);
}

module.exports = {
  VALIDATOR_REGISTRY,
  getValidator,
  hasValidator,
  getRegisteredCommands,
  validateCommand,
  registerValidator,

  // Re-export individual validators for convenience
  validators: {
    shell: shellValidators,
    database: databaseValidators,
    filesystem: filesystemValidators,
    git: gitValidators,
    process: processValidators,
    network: networkValidators,
  },
};
