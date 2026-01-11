#!/usr/bin/env node
/**
 * Gate Validation Script
 *
 * Validates JSON artifacts against JSON schemas using AJV.
 *
 * Usage:
 *   node gate.mjs [--schema <schema-path>] --input <input-path> --gate <gate-path> [--autofix <0|1>]
 *   Note: --schema is optional. If not provided, only JSON structure validation is performed.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
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

// Main function
async function main() {
  const args = parseArgs();

  if (!args.input || !args.gate) {
    console.error(
      'Error: Missing required arguments (input and gate are required, schema is optional)'
    );
    process.exit(2);
  }

  const schemaPath = args.schema ? resolve(args.schema) : null;
  const inputPath = resolve(args.input);
  const gatePath = resolve(args.gate);
  const autofixEnabled = args.autofix === '1' || args.autofix === 'true';

  try {
    const inputData = JSON.parse(readFileSync(inputPath, 'utf-8'));

    let validation = { valid: true, errors: [] };
    let finalData = inputData;
    let fixedCount = 0;

    // Only validate against schema if schema is provided
    if (schemaPath) {
      const schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
      validation = await validateJSON(inputData, schema);

      if (autofixEnabled && !validation.valid) {
        const fixResult = autofix(inputData, schema);
        finalData = fixResult.fixed;
        fixedCount = fixResult.fixedCount;

        validation = await validateJSON(finalData, schema);
      }
    } else {
      // No schema provided - just validate that input is valid JSON (already done above)
      console.log(
        '⚠️  No schema provided - skipping schema validation, only validating JSON structure'
      );
    }

    const gateDir = dirname(gatePath);
    try {
      mkdirSync(gateDir, { recursive: true });
    } catch (e) {}

    const gateData = {
      timestamp: new Date().toISOString(),
      schema_path: args.schema || null,
      input_path: args.input,
      valid: validation.valid,
      errors: validation.errors || [],
      autofix_applied: autofixEnabled && fixedCount > 0,
      fixed_fields_count: fixedCount,
      validated_data: finalData,
    };

    writeFileSync(gatePath, JSON.stringify(gateData, null, 2), 'utf-8');

    if (validation.valid) {
      console.log(
        fixedCount > 0 ? `✅ Validation passed (autofix: ${fixedCount})` : '✅ Validation passed'
      );
      process.exit(0);
    } else {
      console.error('❌ Validation failed:');
      validation.errors.forEach(error => console.error(`  - ${error}`));
      process.exit(1);
    }
  } catch (error) {
    console.error('Unexpected error:', error.message);
    process.exit(2);
  }
}

main();
