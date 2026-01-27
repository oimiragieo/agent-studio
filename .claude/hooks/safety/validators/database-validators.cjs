'use strict';

/**
 * Database command validators
 * Converted from Auto-Claude database_validators.py
 *
 * Validators for database operations (postgres, mysql, redis, mongodb).
 * Prevents destructive SQL operations and dangerous database commands.
 */

// =============================================================================
// SQL PATTERNS AND UTILITIES
// =============================================================================

/**
 * Patterns that indicate destructive SQL operations
 * @type {RegExp[]}
 */
const DESTRUCTIVE_SQL_PATTERNS = [
  /\bDROP\s+(DATABASE|SCHEMA|TABLE|INDEX|VIEW|FUNCTION|PROCEDURE|TRIGGER)\b/i,
  /\bTRUNCATE\s+(TABLE\s+)?\w+/i,
  /\bDELETE\s+FROM\s+\w+\s*(;|$)/i, // DELETE without WHERE clause
  /\bDROP\s+ALL\b/i,
  /\bDESTROY\b/i,
];

/**
 * Safe database names that can be dropped (test/dev databases)
 * @type {RegExp[]}
 */
const SAFE_DATABASE_PATTERNS = [
  /^test/i,
  /_test$/i,
  /^dev/i,
  /_dev$/i,
  /^local/i,
  /_local$/i,
  /^tmp/i,
  /_tmp$/i,
  /^temp/i,
  /_temp$/i,
  /^scratch/i,
  /^sandbox/i,
  /^mock/i,
  /_mock$/i,
];

/**
 * Parse a command string into tokens, handling quotes.
 *
 * @param {string} commandString - The command string to parse
 * @returns {string[]|null} Array of tokens or null if parsing fails
 */
function parseCommand(commandString) {
  const tokens = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escaped = false;

  for (let i = 0; i < commandString.length; i++) {
    const char = commandString[i];

    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === '\\' && !inSingleQuote) {
      escaped = true;
      continue;
    }

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (char === ' ' && !inSingleQuote && !inDoubleQuote) {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (inSingleQuote || inDoubleQuote) {
    return null;
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

/**
 * Check if a database name appears to be a safe test/dev database.
 *
 * @param {string} dbName - The database name to check
 * @returns {boolean} True if the name matches safe patterns
 */
function isSafeDatabaseName(dbName) {
  return SAFE_DATABASE_PATTERNS.some(pattern => pattern.test(dbName));
}

/**
 * Check if SQL contains destructive operations.
 *
 * @param {string} sql - The SQL statement to check
 * @returns {{isDestructive: boolean, matched: string}} Check result
 */
function containsDestructiveSql(sql) {
  for (const pattern of DESTRUCTIVE_SQL_PATTERNS) {
    const match = sql.match(pattern);
    if (match) {
      return { isDestructive: true, matched: match[0] };
    }
  }
  return { isDestructive: false, matched: '' };
}

// =============================================================================
// POSTGRESQL VALIDATORS
// =============================================================================

/**
 * Validate dropdb commands - only allow dropping test/dev databases.
 *
 * @param {string} commandString - The full dropdb command string
 * @returns {{valid: boolean, error: string}} Validation result
 */
function validateDropdbCommand(commandString) {
  const tokens = parseCommand(commandString);

  if (tokens === null) {
    return { valid: false, error: 'Could not parse dropdb command' };
  }

  if (tokens.length === 0) {
    return { valid: false, error: 'Empty dropdb command' };
  }

  // Find the database name (last non-flag argument)
  // Flags that take arguments
  const flagsWithArgs = new Set([
    '-h',
    '--host',
    '-p',
    '--port',
    '-U',
    '--username',
    '-w',
    '--no-password',
    '-W',
    '--password',
    '--maintenance-db',
  ]);

  let dbName = null;
  let skipNext = false;

  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i];

    if (skipNext) {
      skipNext = false;
      continue;
    }

    if (flagsWithArgs.has(token)) {
      skipNext = true;
      continue;
    }

    if (token.startsWith('-')) {
      continue;
    }

    dbName = token;
  }

  if (!dbName) {
    return { valid: false, error: 'dropdb requires a database name' };
  }

  if (isSafeDatabaseName(dbName)) {
    return { valid: true, error: '' };
  }

  return {
    valid: false,
    error:
      `dropdb '${dbName}' blocked for safety. Only test/dev databases can be dropped autonomously. ` +
      'Safe patterns: test*, *_test, dev*, *_dev, local*, tmp*, temp*, scratch*, sandbox*, mock*',
  };
}

/**
 * Validate dropuser commands - only allow dropping test/dev users.
 *
 * @param {string} commandString - The full dropuser command string
 * @returns {{valid: boolean, error: string}} Validation result
 */
function validateDropuserCommand(commandString) {
  const tokens = parseCommand(commandString);

  if (tokens === null) {
    return { valid: false, error: 'Could not parse dropuser command' };
  }

  if (tokens.length === 0) {
    return { valid: false, error: 'Empty dropuser command' };
  }

  const flagsWithArgs = new Set([
    '-h',
    '--host',
    '-p',
    '--port',
    '-U',
    '--username',
    '-w',
    '--no-password',
    '-W',
    '--password',
  ]);

  let username = null;
  let skipNext = false;

  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i];

    if (skipNext) {
      skipNext = false;
      continue;
    }

    if (flagsWithArgs.has(token)) {
      skipNext = true;
      continue;
    }

    if (token.startsWith('-')) {
      continue;
    }

    username = token;
  }

  if (!username) {
    return { valid: false, error: 'dropuser requires a username' };
  }

  // Only allow dropping test/dev users
  const safeUserPatterns = [/^test/i, /_test$/i, /^dev/i, /_dev$/i, /^tmp/i, /^temp/i, /^mock/i];

  if (safeUserPatterns.some(pattern => pattern.test(username))) {
    return { valid: true, error: '' };
  }

  return {
    valid: false,
    error:
      `dropuser '${username}' blocked for safety. Only test/dev users can be dropped autonomously. ` +
      'Safe patterns: test*, *_test, dev*, *_dev, tmp*, temp*, mock*',
  };
}

/**
 * Validate psql commands - block destructive SQL operations.
 *
 * @param {string} commandString - The full psql command string
 * @returns {{valid: boolean, error: string}} Validation result
 */
function validatePsqlCommand(commandString) {
  const tokens = parseCommand(commandString);

  if (tokens === null) {
    return { valid: false, error: 'Could not parse psql command' };
  }

  if (tokens.length === 0) {
    return { valid: false, error: 'Empty psql command' };
  }

  // Look for -c flag (command to execute)
  let sqlCommand = null;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token === '-c' && i + 1 < tokens.length) {
      sqlCommand = tokens[i + 1];
      break;
    }

    if (token.startsWith('-c') && token.length > 2) {
      // Handle -c"SQL" format
      sqlCommand = token.slice(2);
      break;
    }
  }

  if (sqlCommand) {
    const { isDestructive, matched } = containsDestructiveSql(sqlCommand);
    if (isDestructive) {
      return {
        valid: false,
        error:
          `psql command contains destructive SQL: '${matched}'. ` +
          'DROP/TRUNCATE/DELETE operations require manual confirmation.',
      };
    }
  }

  return { valid: true, error: '' };
}

// =============================================================================
// MYSQL VALIDATORS
// =============================================================================

/**
 * Validate mysql commands - block destructive SQL operations.
 *
 * @param {string} commandString - The full mysql command string
 * @returns {{valid: boolean, error: string}} Validation result
 */
function validateMysqlCommand(commandString) {
  const tokens = parseCommand(commandString);

  if (tokens === null) {
    return { valid: false, error: 'Could not parse mysql command' };
  }

  if (tokens.length === 0) {
    return { valid: false, error: 'Empty mysql command' };
  }

  // Look for -e flag (execute command)
  let sqlCommand = null;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if ((token === '-e' || token === '--execute') && i + 1 < tokens.length) {
      sqlCommand = tokens[i + 1];
      break;
    }

    if (token.startsWith('-e') && token.length > 2) {
      sqlCommand = token.slice(2);
      break;
    }
  }

  if (sqlCommand) {
    const { isDestructive, matched } = containsDestructiveSql(sqlCommand);
    if (isDestructive) {
      return {
        valid: false,
        error:
          `mysql command contains destructive SQL: '${matched}'. ` +
          'DROP/TRUNCATE/DELETE operations require manual confirmation.',
      };
    }
  }

  return { valid: true, error: '' };
}

/**
 * Validate mysqladmin commands - block destructive operations.
 *
 * @param {string} commandString - The full mysqladmin command string
 * @returns {{valid: boolean, error: string}} Validation result
 */
function validateMysqladminCommand(commandString) {
  const dangerousOps = new Set(['drop', 'shutdown', 'kill']);

  const tokens = parseCommand(commandString);

  if (tokens === null) {
    return { valid: false, error: 'Could not parse mysqladmin command' };
  }

  if (tokens.length === 0) {
    return { valid: false, error: 'Empty mysqladmin command' };
  }

  // Check for dangerous operations
  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i].toLowerCase();
    if (dangerousOps.has(token)) {
      return {
        valid: false,
        error:
          `mysqladmin '${tokens[i]}' is blocked for safety. ` +
          'Destructive operations require manual confirmation.',
      };
    }
  }

  return { valid: true, error: '' };
}

// =============================================================================
// REDIS VALIDATORS
// =============================================================================

/**
 * Dangerous Redis commands that should be blocked
 * @type {Set<string>}
 */
const DANGEROUS_REDIS_COMMANDS = new Set([
  'FLUSHALL', // Deletes ALL data from ALL databases
  'FLUSHDB', // Deletes all data from current database
  'DEBUG', // Can crash the server
  'SHUTDOWN', // Shuts down the server
  'SLAVEOF', // Can change replication
  'REPLICAOF', // Can change replication
  'CONFIG', // Can modify server config
  'BGSAVE', // Can cause disk issues
  'BGREWRITEAOF', // Can cause disk issues
  'CLUSTER', // Can modify cluster topology
]);

/**
 * Validate redis-cli commands - block destructive operations.
 *
 * @param {string} commandString - The full redis-cli command string
 * @returns {{valid: boolean, error: string}} Validation result
 */
function validateRedisCliCommand(commandString) {
  const tokens = parseCommand(commandString);

  if (tokens === null) {
    return { valid: false, error: 'Could not parse redis-cli command' };
  }

  if (tokens.length === 0) {
    return { valid: false, error: 'Empty redis-cli command' };
  }

  // Flags that take arguments
  const flagsWithArgs = new Set(['-h', '-p', '-a', '-n', '--pass', '--user', '-u']);
  let skipNext = false;

  // Find the Redis command (skip flags and their arguments)
  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i];

    if (skipNext) {
      skipNext = false;
      continue;
    }

    if (flagsWithArgs.has(token)) {
      skipNext = true;
      continue;
    }

    if (token.startsWith('-')) {
      continue;
    }

    // This should be the Redis command
    const redisCmd = token.toUpperCase();
    if (DANGEROUS_REDIS_COMMANDS.has(redisCmd)) {
      return {
        valid: false,
        error:
          `redis-cli command '${redisCmd}' is blocked for safety. ` +
          'Destructive Redis operations require manual confirmation.',
      };
    }
    break; // Only check the first non-flag token
  }

  return { valid: true, error: '' };
}

// =============================================================================
// MONGODB VALIDATORS
// =============================================================================

/**
 * Dangerous MongoDB patterns to block
 * @type {RegExp[]}
 */
const DANGEROUS_MONGO_PATTERNS = [
  /\.dropDatabase\s*\(/i,
  /\.drop\s*\(/i,
  /\.deleteMany\s*\(\s*\{\s*\}\s*\)/i, // deleteMany({}) - deletes all
  /\.remove\s*\(\s*\{\s*\}\s*\)/i, // remove({}) - deletes all (deprecated)
  /db\.dropAllUsers\s*\(/i,
  /db\.dropAllRoles\s*\(/i,
];

/**
 * Validate mongosh/mongo commands - block destructive operations.
 *
 * @param {string} commandString - The full mongosh command string
 * @returns {{valid: boolean, error: string}} Validation result
 */
function validateMongoshCommand(commandString) {
  const tokens = parseCommand(commandString);

  if (tokens === null) {
    return { valid: false, error: 'Could not parse mongosh command' };
  }

  if (tokens.length === 0) {
    return { valid: false, error: 'Empty mongosh command' };
  }

  // Look for --eval flag
  let evalScript = null;

  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] === '--eval' && i + 1 < tokens.length) {
      evalScript = tokens[i + 1];
      break;
    }
  }

  if (evalScript) {
    for (const pattern of DANGEROUS_MONGO_PATTERNS) {
      if (pattern.test(evalScript)) {
        return {
          valid: false,
          error:
            `mongosh command contains destructive operation matching '${pattern.source}'. ` +
            'Database drop/delete operations require manual confirmation.',
        };
      }
    }
  }

  return { valid: true, error: '' };
}

module.exports = {
  // Utilities
  isSafeDatabaseName,
  containsDestructiveSql,
  DESTRUCTIVE_SQL_PATTERNS,
  SAFE_DATABASE_PATTERNS,
  DANGEROUS_REDIS_COMMANDS,
  DANGEROUS_MONGO_PATTERNS,

  // PostgreSQL
  validateDropdbCommand,
  validateDropuserCommand,
  validatePsqlCommand,

  // MySQL
  validateMysqlCommand,
  validateMysqladminCommand,

  // Redis
  validateRedisCliCommand,

  // MongoDB
  validateMongoshCommand,
};
