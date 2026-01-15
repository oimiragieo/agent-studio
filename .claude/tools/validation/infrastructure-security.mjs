#!/usr/bin/env node
/**
 * Infrastructure Security Validation Module
 *
 * Validates infrastructure-config.json for security compliance:
 * - No hardcoded secrets
 * - All secrets use Secret Manager references
 * - Resource names include unique suffixes
 * - Connection strings use placeholders
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { getCanonicalPath } from '../context-path-resolver.mjs';

/**
 * Validate infrastructure config for security compliance
 * @param {string} configPath - Path to infrastructure-config.json
 * @returns {Object} Validation result with valid flag, errors, and warnings
 */
export function validateInfrastructureSecurity(configPath) {
  const errors = [];
  const warnings = [];

  try {
    const configData = JSON.parse(readFileSync(configPath, 'utf-8'));

    // Check 1: No hardcoded secrets
    const hardcodedSecrets = findHardcodedSecrets(configData);
    if (hardcodedSecrets.length > 0) {
      errors.push(`Hardcoded secrets found: ${hardcodedSecrets.length} secret(s) detected`);
      hardcodedSecrets.forEach(secret => {
        errors.push(`  - ${secret.path}: Contains potential secret value`);
      });
    }

    // Check 2: All secrets use Secret Manager references
    const invalidSecretRefs = findInvalidSecretReferences(configData);
    if (invalidSecretRefs.length > 0) {
      errors.push(`Invalid secret references: ${invalidSecretRefs.length} reference(s) found`);
      invalidSecretRefs.forEach(ref => {
        errors.push(`  - ${ref.path}: ${ref.reason}`);
      });
    }

    // Check 3: Resource names include unique suffixes
    const resourcesWithoutSuffixes = findResourcesWithoutSuffixes(configData);
    if (resourcesWithoutSuffixes.length > 0) {
      warnings.push(
        `Resources without unique suffixes: ${resourcesWithoutSuffixes.length} resource(s) found`
      );
      resourcesWithoutSuffixes.forEach(resource => {
        warnings.push(`  - ${resource.path}: Resource name may cause namespace collisions`);
      });
    }

    // Check 4: Connection strings use placeholders
    const invalidConnectionStrings = findInvalidConnectionStrings(configData);
    if (invalidConnectionStrings.length > 0) {
      errors.push(
        `Invalid connection strings: ${invalidConnectionStrings.length} connection string(s) found`
      );
      invalidConnectionStrings.forEach(conn => {
        errors.push(`  - ${conn.path}: ${conn.reason}`);
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  } catch (error) {
    return {
      valid: false,
      errors: [`Failed to validate infrastructure config: ${error.message}`],
      warnings: [],
    };
  }
}

/**
 * Find hardcoded secrets in config data
 * @param {Object} data - Config data object
 * @param {string} path - Current path in object (for error reporting)
 * @returns {Array} Array of paths where secrets were found
 */
function findHardcodedSecrets(data, path = 'root') {
  const secrets = [];

  // Common secret patterns
  const secretPatterns = [
    /password\s*[:=]\s*["']?[^"'\s]{8,}/i,
    /api[_-]?key\s*[:=]\s*["']?[^"'\s]{16,}/i,
    /secret\s*[:=]\s*["']?[^"'\s]{16,}/i,
    /token\s*[:=]\s*["']?[^"'\s]{16,}/i,
    /private[_-]?key\s*[:=]/i,
    /access[_-]?key\s*[:=]\s*["']?[^"'\s]{16,}/i,
  ];

  // Secret Manager reference patterns (these are OK)
  const secretManagerPatterns = [
    /projects\/[^\/]+\/secrets\/[^\/]+\/versions\/\d+/,
    /secret[_-]?id/i,
    /secret[_-]?reference/i,
    /secret[_-]?manager/i,
  ];

  function traverse(obj, currentPath) {
    if (typeof obj === 'string') {
      // Check if string contains secret patterns
      for (const pattern of secretPatterns) {
        if (pattern.test(obj)) {
          // But skip if it's a Secret Manager reference
          const isSecretManagerRef = secretManagerPatterns.some(p => p.test(obj));
          if (!isSecretManagerRef) {
            secrets.push({ path: currentPath, value: obj.substring(0, 50) + '...' });
          }
        }
      }
    } else if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        traverse(item, `${currentPath}[${index}]`);
      });
    } else if (obj && typeof obj === 'object') {
      Object.keys(obj).forEach(key => {
        traverse(obj[key], `${currentPath}.${key}`);
      });
    }
  }

  traverse(data, path);
  return secrets;
}

/**
 * Find invalid secret references
 * @param {Object} data - Config data object
 * @returns {Array} Array of invalid references
 */
function findInvalidSecretReferences(data) {
  const invalid = [];

  // Expected secret reference patterns
  const validPatterns = [
    /^projects\/[^\/]+\/secrets\/[^\/]+\/versions\/\d+$/, // GCP Secret Manager
    /^arn:aws:secretsmanager:[^:]+:[^:]+:secret:[^:]+$/, // AWS Secrets Manager
    /^https:\/\/[^\/]+\/secrets\/[^\/]+$/, // Azure Key Vault
    /^SECRET_ID:/, // Custom format
    /^secret[_-]?id$/i, // Environment variable reference
  ];

  function traverse(obj, path = 'root') {
    if (typeof obj === 'string') {
      // Check if it looks like it should be a secret reference
      const lowerKey = path.toLowerCase();
      if (
        lowerKey.includes('secret') ||
        lowerKey.includes('password') ||
        lowerKey.includes('key') ||
        lowerKey.includes('token')
      ) {
        // But not if it's a placeholder
        if (!obj.includes('${') && !obj.includes('{{') && !obj.includes('placeholder')) {
          const isValid =
            validPatterns.some(p => p.test(obj)) ||
            obj.startsWith('$') || // Environment variable
            obj.startsWith('process.env.');
          if (!isValid && obj.length > 8) {
            // Likely a real value, not a reference
            invalid.push({
              path,
              reason: `Expected Secret Manager reference but found: ${obj.substring(0, 50)}`,
            });
          }
        }
      }
    } else if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        traverse(item, `${path}[${index}]`);
      });
    } else if (obj && typeof obj === 'object') {
      Object.keys(obj).forEach(key => {
        traverse(obj[key], `${path}.${key}`);
      });
    }
  }

  traverse(data);
  return invalid;
}

/**
 * Find resources without unique suffixes
 * @param {Object} data - Config data object
 * @returns {Array} Array of resources without suffixes
 */
function findResourcesWithoutSuffixes(data) {
  const resources = [];

  // Resource name fields that should have suffixes
  const resourceNameFields = [
    'name',
    'resource_name',
    'bucket_name',
    'database_name',
    'instance_name',
    'cluster_name',
    'queue_name',
    'topic_name',
  ];

  // Suffix patterns (hash, uuid, project_id, etc.)
  const suffixPatterns = [
    /-[a-f0-9]{8,}$/i, // Hash suffix
    /-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, // UUID
    /-\d{10,}$/, // Timestamp
    /-unique$/, // Explicit unique marker
    /\$\{.*\}$/, // Template variable
    /\{\{.*\}\}$/, // Template variable
  ];

  function traverse(obj, path = 'root') {
    if (obj && typeof obj === 'object') {
      Object.keys(obj).forEach(key => {
        const lowerKey = key.toLowerCase();
        if (resourceNameFields.some(field => lowerKey.includes(field))) {
          const value = obj[key];
          if (typeof value === 'string' && value.length > 0) {
            // Check if value has a suffix
            const hasSuffix = suffixPatterns.some(pattern => pattern.test(value));
            if (!hasSuffix && !value.includes('${') && !value.includes('{{')) {
              resources.push({ path: `${path}.${key}`, name: value });
            }
          }
        }
        traverse(obj[key], `${path}.${key}`);
      });
    } else if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        traverse(item, `${path}[${index}]`);
      });
    }
  }

  traverse(data);
  return resources;
}

/**
 * Find invalid connection strings
 * @param {Object} data - Config data object
 * @returns {Array} Array of invalid connection strings
 */
function findInvalidConnectionStrings(data) {
  const invalid = [];

  // Connection string fields
  const connectionFields = [
    'connection_string',
    'connectionString',
    'connection',
    'database_url',
    'databaseUrl',
    'db_url',
    'dbUrl',
    'endpoint',
    'host',
    'uri',
    'url',
  ];

  function traverse(obj, path = 'root') {
    if (obj && typeof obj === 'object') {
      Object.keys(obj).forEach(key => {
        const lowerKey = key.toLowerCase();
        if (connectionFields.some(field => lowerKey.includes(field))) {
          const value = obj[key];
          if (typeof value === 'string') {
            // Check for hardcoded passwords in connection strings
            if (
              /password\s*=\s*[^;}\s]{8,}/i.test(value) &&
              !value.includes('${') &&
              !value.includes('{{')
            ) {
              invalid.push({
                path: `${path}.${key}`,
                reason:
                  'Connection string contains hardcoded password (use placeholder or Secret Manager reference)',
              });
            }
            // Check for hardcoded API keys
            if (
              /api[_-]?key\s*=\s*[^;}\s]{16,}/i.test(value) &&
              !value.includes('${') &&
              !value.includes('{{')
            ) {
              invalid.push({
                path: `${path}.${key}`,
                reason:
                  'Connection string contains hardcoded API key (use placeholder or Secret Manager reference)',
              });
            }
          }
        }
        traverse(obj[key], `${path}.${key}`);
      });
    } else if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        traverse(item, `${path}[${index}]`);
      });
    }
  }

  traverse(data);
  return invalid;
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const configPath =
    args[0] || getCanonicalPath('artifacts', 'reference', 'infrastructure-config.json');

  const result = validateInfrastructureSecurity(resolve(process.cwd(), configPath));

  if (result.valid) {
    console.log('✅ Infrastructure security validation: PASSED');
    if (result.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      result.warnings.forEach(warning => console.log(`  - ${warning}`));
    }
    process.exit(0);
  } else {
    console.error('❌ Infrastructure security validation: FAILED');
    console.error('\nErrors:');
    result.errors.forEach(error => console.error(`  - ${error}`));
    if (result.warnings.length > 0) {
      console.error('\n⚠️  Warnings:');
      result.warnings.forEach(warning => console.error(`  - ${warning}`));
    }
    process.exit(1);
  }
}
