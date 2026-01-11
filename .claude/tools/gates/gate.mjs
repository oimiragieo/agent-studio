#!/usr/bin/env node
/**
 * Gate Validation Script
 *
 * Validates JSON artifacts against JSON schemas using AJV.
 * Schema is optional - if not provided, performs basic JSON validation only.
 *
 * Usage:
 *   node gate.mjs --input <input-path> --gate <gate-path> [--schema <schema-path>] [--autofix <0|1>]
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].substring(2);
      const value = args[i + 1];
      if (value && !value.startsWith('--')) {
        parsed[key] = value;
        i++;
      } else {
        parsed[key] = true;
      }
    }
  }

  return parsed;
}

// Import AJV
let Ajv;
try {
  const ajvModule = await import('ajv');
  Ajv = ajvModule.default || ajvModule;
} catch (error) {
  console.error("❌ Error: 'ajv' package is missing.");
  console.error('   This gate script requires AJV for strict JSON Schema validation.');
  console.error('   Please install it: pnpm add -D ajv');
  process.exit(1);
}

// Full JSON Schema validation using ajv
async function validateJSON(data, schema) {
  try {
    const ajv = new Ajv({ allErrors: true, verbose: true, strict: false }); // strict: false to allow loose schemas
    const validate = ajv.compile(schema);
    const valid = validate(data);

    if (!valid) {
      const errors = validate.errors.map(err => {
        const path = err.instancePath || 'root';
        return `${path}: ${err.message}${err.params ? ` (${JSON.stringify(err.params)})` : ''}`;
      });
      return { valid: false, errors };
    }

    return { valid: true, errors: [] };
  } catch (error) {
    return { valid: false, errors: [`AJV Error: ${error.message}`] };
  }
}

// Basic autofix (structure only)
function autofix(data, schema) {
  const fixed = JSON.parse(JSON.stringify(data)); // Deep clone
  let fixedCount = 0;

  // Fix missing required fields with defaults
  if (schema.properties && schema.required) {
    for (const field of schema.required) {
      if (!(field in fixed) || fixed[field] === undefined || fixed[field] === null) {
        const propSchema = schema.properties[field];
        if (propSchema) {
          if (propSchema.type === 'string') {
            fixed[field] = '';
            fixedCount++;
          } else if (propSchema.type === 'array') {
            fixed[field] = [];
            fixedCount++;
          } else if (propSchema.type === 'object') {
            fixed[field] = {};
            fixedCount++;
          }
        }
      }
    }
  }

  return { fixed, fixedCount };
}

// Basic JSON validation (structure only, no schema)
function validateBasicJSON(data) {
  try {
    // Check if it's valid JSON structure
    if (typeof data !== 'object' || data === null) {
      return { valid: false, errors: ['Data must be a JSON object'] };
    }
    return { valid: true, errors: [] };
  } catch (error) {
    return { valid: false, errors: [`JSON structure error: ${error.message}`] };
  }
}

/**
 * Validate that no actual secrets are present in connection strings or environment variables
 * Rejects connection strings with actual passwords, tokens, or API keys
 *
 * @param {Object} data - The data object to validate
 * @returns {Array} Array of error messages (empty if no secrets found)
 */
function validateNoActualSecrets(data) {
  const errors = [];
  const secretPatterns = [
    /(:|\?|&)(password|passwd|pwd|secret|token|api[_-]?key)=[^&@\s"']+/i,
    /postgresql:\/\/[^:]+:[^@]+@/i,
    /mysql:\/\/[^:]+:[^@]+@/i,
    /mongodb:\/\/[^:]+:[^@]+@/i,
    /redis:\/\/:[^@]+@/i,
  ];

  // Check connection strings in resources
  if (data.resources) {
    ['compute', 'database', 'storage'].forEach(resourceType => {
      if (data.resources[resourceType]) {
        data.resources[resourceType].forEach((resource, index) => {
          // Check connection_string (old format, should not contain actual secrets)
          if (resource.connection_string) {
            const connStr = resource.connection_string;
            // Allow template placeholders like {DB_PASSWORD} or ${DB_PASSWORD}
            if (!connStr.includes('{') && !connStr.includes('$')) {
              secretPatterns.forEach(pattern => {
                if (pattern.test(connStr)) {
                  errors.push(
                    `Connection string in ${resourceType}[${index}] (${resource.name || 'unnamed'}) appears to contain actual secret. Use template with placeholder (e.g., {DB_PASSWORD}) and secret_references instead.`
                  );
                }
              });
            }
          }
        });
      }
    });
  }

  // Check environment variables
  if (data.environment_variables) {
    Object.entries(data.environment_variables).forEach(([key, value]) => {
      if (
        key.toLowerCase().includes('password') ||
        key.toLowerCase().includes('secret') ||
        key.toLowerCase().includes('token') ||
        key.toLowerCase().includes('key') ||
        key.toLowerCase().includes('credential')
      ) {
        // Check if value looks like actual secret (not a reference)
        if (
          typeof value === 'string' &&
          !value.startsWith('projects/') &&
          !value.includes('secret') &&
          !value.includes('SECRET_ID') &&
          value.length > 10 &&
          !value.match(/^[A-Z_]+$/)
        ) {
          // Not all caps (which would be env var name
          errors.push(
            `Environment variable ${key} appears to contain actual secret. Use Secret Manager reference (projects/.../secrets/...) instead.`
          );
        }
      }
    });
  }

  return errors;
}

/**
 * Validate that secret_references section exists and is properly formatted
 * when connection strings use placeholders
 *
 * @param {Object} data - The data object to validate
 * @returns {Object} Object with errors, warnings, and secretReferencesFound count
 */
function validateSecretReferences(data) {
  const errors = [];
  const warnings = [];
  const secretRefPattern = /^projects\/[^/]+\/secrets\/[^/]+\/versions\/[^/]+$/;

  // Check if connection strings use placeholders
  let hasPlaceholders = false;
  if (data.resources) {
    ['compute', 'database', 'storage'].forEach(resourceType => {
      if (data.resources[resourceType]) {
        data.resources[resourceType].forEach(resource => {
          // Check connection_string_template (new format)
          if (
            resource.connection_string_template &&
            (resource.connection_string_template.includes('{') ||
              resource.connection_string_template.includes('$'))
          ) {
            hasPlaceholders = true;
          }
          // Also check connection_string for placeholders (backward compatibility)
          if (
            resource.connection_string &&
            (resource.connection_string.includes('{') || resource.connection_string.includes('$'))
          ) {
            hasPlaceholders = true;
          }
        });
      }
    });
  }

  // If placeholders found, verify secret_references exists
  if (hasPlaceholders) {
    if (!data.secret_references || Object.keys(data.secret_references).length === 0) {
      errors.push(
        'Connection strings use placeholders but secret_references section is missing or empty.'
      );
    } else {
      // Validate each secret reference
      Object.entries(data.secret_references).forEach(([key, ref]) => {
        if (!ref.secret_id || !secretRefPattern.test(ref.secret_id)) {
          errors.push(
            `Secret reference "${key}" has invalid secret_id format. Expected: projects/{project_id}/secrets/{secret_name}/versions/{version}`
          );
        }
        if (!ref.environment_variable) {
          errors.push(`Secret reference "${key}" missing environment_variable field.`);
        }
      });
    }
  }

  // Check environment variables for secret references (should use SECRET_ID pattern)
  if (data.environment_variables) {
    Object.entries(data.environment_variables).forEach(([key, value]) => {
      if (
        key.toLowerCase().includes('password') ||
        key.toLowerCase().includes('secret') ||
        key.toLowerCase().includes('token') ||
        key.toLowerCase().includes('key')
      ) {
        // If it's a secret-related env var, it should be a reference or end with _SECRET_ID
        if (
          typeof value === 'string' &&
          !value.startsWith('projects/') &&
          !key.endsWith('_SECRET_ID') &&
          !key.endsWith('_SECRET_REF')
        ) {
          warnings.push(
            `Environment variable ${key} appears to be secret-related but doesn't follow SECRET_ID naming convention. Consider renaming to ${key}_SECRET_ID.`
          );
        }
      }
    });
  }

  return {
    errors,
    warnings,
    secretReferencesFound: data.secret_references ? Object.keys(data.secret_references).length : 0,
  };
}

// Main function
async function main() {
  const args = parseArgs();

  // Schema is optional, but input and gate are required
  if (!args.input || !args.gate) {
    console.error('Error: Missing required arguments (--input and --gate are required)');
    console.error(
      'Usage: node gate.mjs --input <input-path> --gate <gate-path> [--schema <schema-path>] [--autofix <0|1>]'
    );
    process.exit(2);
  }

  const inputPath = resolve(args.input);
  const gatePath = resolve(args.gate);
  const schemaPath = args.schema ? resolve(args.schema) : null;
  const autofixEnabled = args.autofix === '1' || args.autofix === 'true';
  const hasSchema = schemaPath && existsSync(schemaPath);

  try {
    // Load input data
    let inputData;
    try {
      const inputContent = readFileSync(inputPath, 'utf-8');
      inputData = JSON.parse(inputContent);
    } catch (error) {
      console.error(`❌ Error: Invalid JSON in input file ${inputPath}`);
      console.error(`   ${error.message}`);
      console.error(`   Content preview: ${readFileSync(inputPath, 'utf-8').substring(0, 200)}...`);
      process.exit(1);
    }

    let validation;
    let finalData = inputData;
    let fixedCount = 0;

    // Secret validation (always performed for infrastructure-config.json)
    const secretValidationErrors = [];
    const secretRefValidation = { errors: [], warnings: [], secretReferencesFound: 0 };
    const isInfrastructureConfig = args.input && args.input.includes('infrastructure-config');

    if (isInfrastructureConfig) {
      // Validate no actual secrets
      const secretErrors = validateNoActualSecrets(inputData);
      secretValidationErrors.push(...secretErrors);

      // Validate secret references
      const secretRefResult = validateSecretReferences(inputData);
      secretRefValidation.errors = secretRefResult.errors;
      secretRefValidation.warnings = secretRefResult.warnings;
      secretRefValidation.secretReferencesFound = secretRefResult.secretReferencesFound;
    }

    if (hasSchema) {
      // Schema-based validation
      let schema;
      try {
        const schemaContent = readFileSync(schemaPath, 'utf-8');
        try {
          schema = JSON.parse(schemaContent);
        } catch (parseError) {
          console.error(`❌ Error: Malformed JSON in schema file ${schemaPath}`);
          console.error(`   JSON Parse Error: ${parseError.message}`);
          console.error(`   Line ${parseError.message.match(/position (\d+)/)?.[1] || 'unknown'}`);
          console.error(`   Content preview: ${schemaContent.substring(0, 200)}...`);
          console.error(`\n💡 Suggestions:`);
          console.error(`   - Verify the schema file is valid JSON`);
          console.error(`   - Check for missing commas, brackets, or quotes`);
          console.error(`   - Use a JSON validator to identify syntax errors`);
          process.exit(1);
        }
      } catch (fileError) {
        console.error(`❌ Error: Failed to read schema file ${schemaPath}`);
        console.error(`   ${fileError.message}`);
        console.error(`\n💡 Suggestions:`);
        console.error(`   - Verify the schema file path is correct`);
        console.error(`   - Check file permissions`);
        console.error(`   - Ensure the file exists`);
        process.exit(1);
      }
      validation = await validateJSON(inputData, schema);

      if (autofixEnabled && !validation.valid) {
        const fixResult = autofix(inputData, schema);
        finalData = fixResult.fixed;
        fixedCount = fixResult.fixedCount;

        validation = await validateJSON(finalData, schema);
      }
    } else {
      // Basic JSON validation (no schema)
      validation = validateBasicJSON(inputData);
      console.log('ℹ️  No schema provided - performing basic JSON structure validation only');
    }

    // Combine schema validation errors with secret validation errors
    const allErrors = [
      ...(validation.errors || []),
      ...secretValidationErrors,
      ...secretRefValidation.errors,
    ];
    const isValid =
      validation.valid &&
      secretValidationErrors.length === 0 &&
      secretRefValidation.errors.length === 0;

    const gateDir = dirname(gatePath);
    try {
      mkdirSync(gateDir, { recursive: true });
    } catch (e) {}

    const gateData = {
      timestamp: new Date().toISOString(),
      schema_path: args.schema || null,
      schema_used: hasSchema,
      input_path: args.input,
      valid: isValid,
      errors: allErrors,
      autofix_applied: autofixEnabled && fixedCount > 0,
      fixed_fields_count: fixedCount,
      validated_data: finalData,
      // Secret validation results (for infrastructure-config.json)
      secrets_validated: isInfrastructureConfig,
      secret_validation_errors: secretValidationErrors,
      secret_references_validated: isInfrastructureConfig,
      secret_references_found: secretRefValidation.secretReferencesFound,
      secret_references_errors: secretRefValidation.errors,
      secret_references_warnings: secretRefValidation.warnings,
    };

    writeFileSync(gatePath, JSON.stringify(gateData, null, 2), 'utf-8');

    if (isValid) {
      const message = hasSchema
        ? fixedCount > 0
          ? `✅ Schema validation passed (autofix: ${fixedCount} fields)`
          : '✅ Schema validation passed'
        : '✅ Basic validation passed (no schema)';
      console.log(message);

      // Show secret validation status if applicable
      if (isInfrastructureConfig) {
        if (secretRefValidation.secretReferencesFound > 0) {
          console.log(
            `   ✅ Secret references validated: ${secretRefValidation.secretReferencesFound} found`
          );
        }
        if (secretRefValidation.warnings.length > 0) {
          console.log(`   ⚠️  Warnings: ${secretRefValidation.warnings.length}`);
          secretRefValidation.warnings.forEach(warning => {
            console.log(`      - ${warning}`);
          });
        }
      }

      console.log(`\n📋 Gate file created: ${gatePath}`);
      console.log(`   Validation status: PASSED`);
      if (hasSchema) {
        console.log(`   Schema: ${args.schema}`);
      }
      process.exit(0);
    } else {
      console.error('\n❌ Validation failed:');
      console.error(`   Input file: ${inputPath}`);
      if (hasSchema) {
        console.error(`   Schema: ${schemaPath}`);
      }
      console.error(`   Gate file: ${gatePath}`);
      console.error(`\n   Errors found:`);
      allErrors.forEach((error, index) => {
        console.error(`   ${index + 1}. ${error}`);
      });

      // Show secret validation errors separately if applicable
      if (isInfrastructureConfig && secretValidationErrors.length > 0) {
        console.error(`\n   Secret Validation Errors:`);
        secretValidationErrors.forEach((error, index) => {
          console.error(`   ${index + 1}. ${error}`);
        });
      }

      if (isInfrastructureConfig && secretRefValidation.errors.length > 0) {
        console.error(`\n   Secret References Validation Errors:`);
        secretRefValidation.errors.forEach((error, index) => {
          console.error(`   ${index + 1}. ${error}`);
        });
      }

      console.error(`\n💡 Suggestions:`);
      console.error(`   - Review the errors above and fix the issues in the input file`);
      if (hasSchema) {
        console.error(`   - Check the schema file to understand expected structure`);
      }
      if (isInfrastructureConfig) {
        console.error(
          `   - Ensure all secrets use Secret Manager references (projects/.../secrets/...)`
        );
        console.error(
          `   - Use connection string templates with placeholders (e.g., {DB_PASSWORD})`
        );
        console.error(`   - Include secret_references section for all secrets`);
      }
      console.error(`   - Use --autofix 1 to attempt automatic fixes (if supported)`);
      console.error(`   - Review the gate file for detailed validation results: ${gatePath}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('Unexpected error:', error.message);
    process.exit(2);
  }
}

main();
