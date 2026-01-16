#!/usr/bin/env node

/**
 * Schema Validator Tool
 *
 * Validates agent output JSON files against their respective JSON Schema definitions.
 * Supports all 10 agent types with evidence-based validation.
 *
 * Usage:
 *   node .claude/tools/schema-validator.mjs --agent <type> --output <path> [--strict] [--verbose]
 *
 * Exit codes:
 *   0 - Valid output
 *   1 - Invalid (non-critical) - warnings only
 *   2 - Invalid (critical) - blocking errors
 *   3 - File or schema not found
 *
 * Examples:
 *   node .claude/tools/schema-validator.mjs --agent developer --output .claude/context/artifacts/dev-output.json
 *   node .claude/tools/schema-validator.mjs --agent qa --output .claude/context/artifacts/qa-output.json --strict
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');

// Agent type to schema file mapping
const AGENT_SCHEMA_MAP = {
  developer: 'developer-output.schema.json',
  qa: 'qa-output.schema.json',
  'code-reviewer': 'code-reviewer-output.schema.json',
  'security-architect': 'security-architect-output.schema.json',
  devops: 'devops-output.schema.json',
  'technical-writer': 'technical-writer-output.schema.json',
  architect: 'architect-output.schema.json',
  analyst: 'analyst-output.schema.json',
  planner: 'planner-output.schema.json',
  'performance-engineer': 'performance-engineer-output.schema.json',
};

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    agent: null,
    output: null,
    strict: false,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--agent' && args[i + 1]) {
      options.agent = args[i + 1];
      i++;
    } else if (arg === '--output' && args[i + 1]) {
      options.output = args[i + 1];
      i++;
    } else if (arg === '--strict') {
      options.strict = true;
    } else if (arg === '--verbose') {
      options.verbose = true;
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }
  }

  return options;
}

// Print usage information
function printUsage() {
  console.log(`
Schema Validator Tool

Validates agent output JSON files against their respective JSON Schema definitions.

USAGE:
  node .claude/tools/schema-validator.mjs --agent <type> --output <path> [OPTIONS]

REQUIRED:
  --agent <type>     Agent type (developer, qa, code-reviewer, security-architect,
                     devops, technical-writer, architect, analyst, planner,
                     performance-engineer)
  --output <path>    Path to agent output JSON file to validate

OPTIONS:
  --strict           Exit with code 2 for any validation error (blocking)
  --verbose          Show detailed error messages and validation context
  --help, -h         Show this help message

EXIT CODES:
  0 - Valid output (passes schema validation)
  1 - Invalid (non-critical) - warnings only
  2 - Invalid (critical) - blocking errors (in strict mode, any error)
  3 - File or schema not found

EXAMPLES:
  # Validate developer output
  node .claude/tools/schema-validator.mjs \\
    --agent developer \\
    --output .claude/context/artifacts/dev-output.json

  # Validate with strict mode (any error blocks)
  node .claude/tools/schema-validator.mjs \\
    --agent qa \\
    --output .claude/context/artifacts/qa-output.json \\
    --strict

  # Validate with verbose error messages
  node .claude/tools/schema-validator.mjs \\
    --agent security-architect \\
    --output .claude/context/artifacts/security-output.json \\
    --verbose

SUPPORTED AGENTS:
  developer          - Developer agent output (code, tests, compilation)
  qa                 - QA agent output (test results, coverage)
  code-reviewer      - Code reviewer output (syntax, paths, dependencies)
  security-architect - Security architect output (vulnerabilities, compliance)
  devops             - DevOps agent output (deployment, build, PR)
  technical-writer   - Technical writer output (documentation, changelog)
  architect          - Architect output (diagrams, decisions, trade-offs)
  analyst            - Analyst output (findings, recommendations)
  planner            - Planner output (execution plan, dependencies, risks)
  performance-engineer - Performance engineer output (metrics, bottlenecks)
`);
}

// Validate command line arguments
function validateArgs(options) {
  if (!options.agent) {
    console.error('ERROR: --agent is required');
    console.error('Run with --help for usage information');
    process.exit(3);
  }

  if (!options.output) {
    console.error('ERROR: --output is required');
    console.error('Run with --help for usage information');
    process.exit(3);
  }

  if (!AGENT_SCHEMA_MAP[options.agent]) {
    console.error(`ERROR: Invalid agent type "${options.agent}"`);
    console.error(`Supported agents: ${Object.keys(AGENT_SCHEMA_MAP).join(', ')}`);
    process.exit(3);
  }
}

// Load JSON schema for agent type
function loadSchema(agentType) {
  const schemaFileName = AGENT_SCHEMA_MAP[agentType];
  const schemaPath = join(PROJECT_ROOT, '.claude', 'schemas', 'agent-outputs', schemaFileName);

  if (!existsSync(schemaPath)) {
    console.error(`ERROR: Schema file not found: ${schemaPath}`);
    process.exit(3);
  }

  try {
    const schemaContent = readFileSync(schemaPath, 'utf-8');
    return JSON.parse(schemaContent);
  } catch (error) {
    console.error(`ERROR: Failed to parse schema file: ${error.message}`);
    process.exit(3);
  }
}

// Load agent output JSON file
function loadOutput(outputPath) {
  if (!existsSync(outputPath)) {
    console.error(`ERROR: Output file not found: ${outputPath}`);
    process.exit(3);
  }

  try {
    const outputContent = readFileSync(outputPath, 'utf-8');
    return JSON.parse(outputContent);
  } catch (error) {
    console.error(`ERROR: Failed to parse output file: ${error.message}`);
    process.exit(3);
  }
}

// Validate output against schema
function validateOutput(schema, output, options) {
  const ajv = new Ajv({
    allErrors: true,
    verbose: options.verbose,
    strict: false,
  });

  addFormats(ajv);

  const validate = ajv.compile(schema);
  const valid = validate(output);

  return {
    valid,
    errors: validate.errors || [],
  };
}

// Categorize errors by severity
function categorizeErrors(errors) {
  const critical = [];
  const warnings = [];

  for (const error of errors) {
    // Critical errors (required fields, type mismatches)
    if (
      error.keyword === 'required' ||
      error.keyword === 'type' ||
      error.keyword === 'enum' ||
      error.keyword === 'const'
    ) {
      critical.push(error);
    } else {
      // Warnings (additional properties, format issues)
      warnings.push(error);
    }
  }

  return { critical, warnings };
}

// Format error message for display
function formatError(error, verbose) {
  const path = error.instancePath || error.dataPath || 'root';
  const message = error.message;

  if (verbose) {
    return `
  Path: ${path}
  Error: ${message}
  Keyword: ${error.keyword}
  Schema: ${JSON.stringify(error.schemaPath)}
  Data: ${JSON.stringify(error.data)}
  Params: ${JSON.stringify(error.params)}
`;
  } else {
    return `  ${path}: ${message}`;
  }
}

// Print validation results
function printResults(result, options) {
  const { valid, errors } = result;

  if (valid) {
    console.log('✓ VALIDATION PASSED');
    console.log(`\nOutput file: ${options.output}`);
    console.log(`Agent type: ${options.agent}`);
    console.log('Schema: Valid\n');
    return;
  }

  console.log('✗ VALIDATION FAILED\n');
  console.log(`Output file: ${options.output}`);
  console.log(`Agent type: ${options.agent}`);
  console.log(`Total errors: ${errors.length}\n`);

  const { critical, warnings } = categorizeErrors(errors);

  if (critical.length > 0) {
    console.log(`CRITICAL ERRORS (${critical.length}):`);
    critical.forEach((error) => {
      console.log(formatError(error, options.verbose));
    });
    console.log();
  }

  if (warnings.length > 0) {
    console.log(`WARNINGS (${warnings.length}):`);
    warnings.forEach((error) => {
      console.log(formatError(error, options.verbose));
    });
    console.log();
  }
}

// Generate JSON output report
function generateReport(result, options, schema) {
  const { valid, errors } = result;
  const { critical, warnings } = categorizeErrors(errors);

  return {
    valid,
    agent_type: options.agent,
    output_file: options.output,
    schema_path: AGENT_SCHEMA_MAP[options.agent],
    validation_timestamp: new Date().toISOString(),
    total_errors: errors.length,
    critical_errors: critical.length,
    warnings: warnings.length,
    errors: errors.map((error) => ({
      path: error.instancePath || error.dataPath || 'root',
      keyword: error.keyword,
      message: error.message,
      severity: critical.includes(error) ? 'critical' : 'warning',
      params: error.params,
    })),
    schema_version: schema.$id || 'unknown',
  };
}

// Determine exit code
function determineExitCode(result, options) {
  const { valid, errors } = result;

  if (valid) {
    return 0; // Valid
  }

  if (options.strict) {
    return 2; // Strict mode: any error is critical
  }

  const { critical } = categorizeErrors(errors);

  if (critical.length > 0) {
    return 2; // Critical errors
  }

  return 1; // Warnings only
}

// Main execution
function main() {
  const options = parseArgs();
  validateArgs(options);

  console.log('Schema Validator\n');
  console.log(`Agent: ${options.agent}`);
  console.log(`Output: ${options.output}`);
  console.log(`Mode: ${options.strict ? 'strict' : 'standard'}\n`);

  // Load schema and output
  const schema = loadSchema(options.agent);
  const output = loadOutput(options.output);

  // Validate
  const result = validateOutput(schema, output, options);

  // Print results
  printResults(result, options);

  // Generate JSON report
  const report = generateReport(result, options, schema);

  // Print JSON report if verbose
  if (options.verbose) {
    console.log('VALIDATION REPORT (JSON):\n');
    console.log(JSON.stringify(report, null, 2));
    console.log();
  }

  // Determine exit code
  const exitCode = determineExitCode(result, options);

  if (exitCode === 0) {
    console.log('✓ Output is valid and conforms to schema');
  } else if (exitCode === 1) {
    console.log('⚠ Output has warnings but is acceptable');
  } else if (exitCode === 2) {
    console.log('✗ Output has critical errors and should not be used');
  }

  process.exit(exitCode);
}

// Run main
main();
