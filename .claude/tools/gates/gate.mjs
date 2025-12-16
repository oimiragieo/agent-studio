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
  console.error('❌ Error: \'ajv\' package is missing.');
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

// Main function
async function main() {
  const args = parseArgs();
  
  // Schema is optional, but input and gate are required
  if (!args.input || !args.gate) {
    console.error('Error: Missing required arguments (--input and --gate are required)');
    console.error('Usage: node gate.mjs --input <input-path> --gate <gate-path> [--schema <schema-path>] [--autofix <0|1>]');
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
    
    const gateDir = dirname(gatePath);
    try { mkdirSync(gateDir, { recursive: true }); } catch (e) {}
    
    const gateData = {
      timestamp: new Date().toISOString(),
      schema_path: args.schema || null,
      schema_used: hasSchema,
      input_path: args.input,
      valid: validation.valid,
      errors: validation.errors || [],
      autofix_applied: autofixEnabled && fixedCount > 0,
      fixed_fields_count: fixedCount,
      validated_data: finalData
    };
    
    writeFileSync(gatePath, JSON.stringify(gateData, null, 2), 'utf-8');
    
    if (validation.valid) {
      const message = hasSchema 
        ? (fixedCount > 0 ? `✅ Schema validation passed (autofix: ${fixedCount})` : '✅ Schema validation passed')
        : '✅ Basic validation passed (no schema)';
      console.log(message);
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