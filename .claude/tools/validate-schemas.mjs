#!/usr/bin/env node
/**
 * Schema Validator - Validate JSON files against their schemas
 *
 * Validates JSON files against JSON Schema definitions in .claude/schemas/
 * Supports auto-detection of schemas based on file location and naming conventions
 *
 * Usage:
 *   node .claude/tools/validate-schemas.mjs --file <path> --schema <schema>
 *   node .claude/tools/validate-schemas.mjs --file <path> (auto-detect schema)
 *   node .claude/tools/validate-schemas.mjs --auto-detect <path>
 */

import { readFile } from 'fs/promises';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SCHEMAS_DIR = join(__dirname, '..', 'schemas');

// Schema auto-detection mapping
const SCHEMA_DETECTION_MAP = {
  // By directory
  'artifacts': {
    'plan-*.json': 'plan.schema.json',
    'plan-*.md': null, // Markdown plans don't have schema
    'dev-manifest.json': 'artifact_manifest.schema.json',
    'architecture-*.json': 'architecture.schema.json',
    'system-architecture.json': 'system-architecture.schema.json',
    'tech-spec.json': 'tech-spec.schema.json',
    'ui-spec.json': 'ui-spec.schema.json',
    'requirements.json': 'requirements.schema.json',
    'quality-report.json': 'quality-report.schema.json',
    'artifact-registry.json': 'artifact-registry.schema.json'
  },
  'gates': {
    '*-gate.json': 'gate-result.schema.json',
    '*.json': 'gate-result.schema.json'
  },
  'plans': {
    '*-rating.json': 'plan-rating.schema.json',
    '*.json': 'plan.schema.json'
  },
  'reasoning': {
    '*.json': 'reasoning.schema.json'
  },
  'reports': {
    '*-report.json': 'report.schema.json',
    'browser-test-report.json': 'browser-test-report.schema.json',
    'quality-report.json': 'quality-report.schema.json'
  },
  'tasks': {
    '*-task.json': 'task.schema.json',
    '*.json': 'task.schema.json'
  }
};

/**
 * Load JSON file safely
 * @param {string} filePath - Path to JSON file
 * @returns {Promise<Object>} Parsed JSON object
 */
async function loadJson(filePath) {
  try {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`File not found: ${filePath}`);
    }
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in ${filePath}: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Auto-detect schema based on file path and name
 * @param {string} filePath - File path to detect schema for
 * @returns {string|null} Schema file name or null if not detectable
 */
function autoDetectSchema(filePath) {
  const fileName = basename(filePath);
  const dirName = basename(dirname(filePath));

  // Check directory-specific patterns
  if (SCHEMA_DETECTION_MAP[dirName]) {
    const patterns = SCHEMA_DETECTION_MAP[dirName];

    // Try exact match first
    if (patterns[fileName]) {
      return patterns[fileName];
    }

    // Try wildcard patterns
    for (const [pattern, schemaName] of Object.entries(patterns)) {
      if (pattern.includes('*')) {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        if (regex.test(fileName)) {
          return schemaName;
        }
      }
    }
  }

  // Fallback: try to match by file name pattern
  if (fileName.endsWith('-report.json')) {
    return 'report.schema.json';
  }
  if (fileName.endsWith('-task.json')) {
    return 'task.schema.json';
  }
  if (fileName === 'dev-manifest.json') {
    return 'artifact_manifest.schema.json';
  }
  if (fileName === 'artifact-registry.json') {
    return 'artifact-registry.schema.json';
  }
  if (fileName.endsWith('-gate.json')) {
    return 'gate-result.schema.json';
  }

  return null;
}

/**
 * Validate JSON against schema
 * @param {Object} data - JSON data to validate
 * @param {Object} schema - JSON Schema
 * @param {Object} options - Validation options
 * @returns {Object} Validation result
 */
function validateAgainstSchema(data, schema, options = {}) {
  const ajv = new Ajv({
    allErrors: true,
    verbose: true,
    strict: options.strict !== false
  });
  addFormats(ajv);

  const validate = ajv.compile(schema);
  const valid = validate(data);

  const result = {
    valid,
    errors: valid ? [] : validate.errors || [],
    errorCount: valid ? 0 : (validate.errors?.length || 0),
    warnings: []
  };

  // Generate human-readable error messages
  if (!valid && validate.errors) {
    result.errorMessages = validate.errors.map(err => {
      const path = err.instancePath || 'root';
      const message = err.message || 'validation failed';
      const detail = err.params ? JSON.stringify(err.params) : '';
      return `${path}: ${message}${detail ? ' (' + detail + ')' : ''}`;
    });
  }

  return result;
}

/**
 * Main validation function
 * @param {string} filePath - Path to JSON file to validate
 * @param {string|null} schemaName - Schema name (or null for auto-detect)
 * @param {Object} options - Validation options
 * @returns {Promise<Object>} Validation result
 */
export async function validateFile(filePath, schemaName = null, options = {}) {
  const result = {
    file: filePath,
    schema: schemaName,
    valid: false,
    errors: [],
    warnings: [],
    timestamp: new Date().toISOString()
  };

  try {
    // Auto-detect schema if not provided
    if (!schemaName) {
      schemaName = autoDetectSchema(filePath);
      result.schema = schemaName;
      result.autoDetected = true;

      if (!schemaName) {
        result.warnings.push('Could not auto-detect schema for file');
        if (!options.requireSchema) {
          result.valid = true; // Pass if schema is optional
          result.warnings.push('Validation skipped (no schema detected)');
          return result;
        }
        throw new Error('Could not auto-detect schema and no schema specified');
      }
    }

    // Load schema
    const schemaPath = join(SCHEMAS_DIR, schemaName);
    if (!existsSync(schemaPath)) {
      throw new Error(`Schema not found: ${schemaPath}`);
    }

    const schema = await loadJson(schemaPath);
    result.schemaPath = schemaPath;

    // Load file to validate
    const data = await loadJson(filePath);

    // Perform validation
    const validationResult = validateAgainstSchema(data, schema, options);

    result.valid = validationResult.valid;
    result.errors = validationResult.errorMessages || validationResult.errors;
    result.errorCount = validationResult.errorCount;
    result.warnings.push(...validationResult.warnings);

    return result;

  } catch (error) {
    result.valid = false;
    result.errors.push(error.message);
    result.errorCount = 1;
    return result;
  }
}

/**
 * Validate multiple files
 * @param {string[]} filePaths - Array of file paths to validate
 * @param {Object} options - Validation options
 * @returns {Promise<Object>} Aggregate validation result
 */
export async function validateFiles(filePaths, options = {}) {
  const results = await Promise.all(
    filePaths.map(filePath => validateFile(filePath, null, options))
  );

  const summary = {
    total: results.length,
    passed: results.filter(r => r.valid).length,
    failed: results.filter(r => !r.valid).length,
    results,
    timestamp: new Date().toISOString()
  };

  summary.allPassed = summary.failed === 0;

  return summary;
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Schema Validator - Validate JSON files against schemas

Usage:
  node validate-schemas.mjs --file <path> [--schema <schema>]
  node validate-schemas.mjs --auto-detect <path>
  node validate-schemas.mjs --files <path1,path2,...>

Options:
  --file <path>         File to validate
  --schema <schema>     Schema name (auto-detects if not provided)
  --auto-detect <path>  Validate with auto-detected schema
  --files <paths>       Comma-separated list of files to validate
  --strict              Use strict validation mode (default: true)
  --require-schema      Fail if schema cannot be detected (default: false)
  --json                Output as JSON
  --help, -h            Show this help

Examples:
  # Validate with auto-detected schema
  node validate-schemas.mjs --file .claude/context/artifacts/plan-001.json

  # Validate with specific schema
  node validate-schemas.mjs --file plan.json --schema plan.schema.json

  # Validate multiple files
  node validate-schemas.mjs --files file1.json,file2.json,file3.json

  # JSON output for automation
  node validate-schemas.mjs --file data.json --json

Exit codes:
  0 - All validations passed
  1 - One or more validations failed
`);
    process.exit(0);
  }

  const getArg = (name) => {
    const index = args.indexOf(`--${name}`);
    return index !== -1 && args[index + 1] ? args[index + 1] : null;
  };

  const hasFlag = (name) => args.includes(`--${name}`);

  try {
    const options = {
      strict: !hasFlag('no-strict'),
      requireSchema: hasFlag('require-schema')
    };

    let result;

    if (hasFlag('files')) {
      // Validate multiple files
      const filesArg = getArg('files');
      if (!filesArg) {
        console.error('Error: --files requires comma-separated file paths');
        process.exit(1);
      }

      const filePaths = filesArg.split(',').map(p => p.trim());
      result = await validateFiles(filePaths, options);

      if (hasFlag('json')) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`\nValidation Summary:`);
        console.log(`  Total: ${result.total}`);
        console.log(`  Passed: ${result.passed}`);
        console.log(`  Failed: ${result.failed}`);
        console.log('');

        result.results.forEach((r, i) => {
          const status = r.valid ? '✓' : '✗';
          console.log(`${status} ${r.file}`);
          if (!r.valid) {
            r.errors.forEach(err => console.log(`    - ${err}`));
          }
        });
      }

      process.exit(result.allPassed ? 0 : 1);

    } else {
      // Validate single file
      const filePath = getArg('file') || getArg('auto-detect');
      const schemaName = getArg('schema');

      if (!filePath) {
        console.error('Error: --file or --auto-detect required');
        console.error('Run with --help for usage information');
        process.exit(1);
      }

      result = await validateFile(filePath, schemaName, options);

      if (hasFlag('json')) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`\nValidation Result:`);
        console.log(`  File: ${result.file}`);
        console.log(`  Schema: ${result.schema || 'none'}`);
        if (result.autoDetected) {
          console.log(`  Schema Detection: auto-detected`);
        }
        console.log(`  Status: ${result.valid ? 'PASSED ✓' : 'FAILED ✗'}`);

        if (result.warnings.length > 0) {
          console.log(`\nWarnings:`);
          result.warnings.forEach(w => console.log(`  - ${w}`));
        }

        if (!result.valid && result.errors.length > 0) {
          console.log(`\nErrors (${result.errorCount}):`);
          result.errors.forEach(err => console.log(`  - ${err}`));
        }
      }

      process.exit(result.valid ? 0 : 1);
    }

  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
const isMainModule = import.meta.url === `file://${process.argv[1]}` ||
                     import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`;
if (isMainModule) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export default {
  validateFile,
  validateFiles,
  autoDetectSchema
};
