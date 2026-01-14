#!/usr/bin/env node
/**
 * Output Validator Examples
 *
 * Demonstrates usage of the output validation system
 */

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { OutputValidator, validateOutput, createValidator } from '../output-validator.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Example 1: Basic inline schema validation
console.log('\n=== Example 1: Basic Validation ===');
const validator = new OutputValidator();

const userOutput = {
  name: 'Alice',
  score: 8.5,
  tags: ['developer', 'typescript'],
};

const basicSchema = {
  type: 'object',
  required: ['name', 'score'],
  properties: {
    name: { type: 'string', minLength: 1 },
    score: { type: 'number', minimum: 0, maximum: 10 },
    tags: { type: 'array', items: { type: 'string' } },
  },
};

const result1 = validator.validate(userOutput, basicSchema);
console.log('Valid:', result1.valid);
console.log('Data:', result1.data);

// Example 2: Validation with errors
console.log('\n=== Example 2: Validation with Errors ===');
const invalidOutput = {
  name: '', // Too short
  score: 11, // Out of range
  tags: [123], // Wrong type
};

const result2 = validator.validate(invalidOutput, basicSchema);
console.log('Valid:', result2.valid);
console.log('Errors:', result2.errors);

// Example 3: Using validateWithReport for detailed feedback
console.log('\n=== Example 3: Detailed Report ===');
const result3 = validator.validateWithReport(invalidOutput, basicSchema);
console.log(result3.report);

// Example 4: Using common schema (analysis output)
console.log('\n=== Example 4: Analysis Output Schema ===');
const analysisSchemaPath = join(
  __dirname,
  '..',
  '..',
  'schemas',
  'output-schemas',
  'analysis-output.schema.json'
);
const analysisSchema = JSON.parse(await readFile(analysisSchemaPath, 'utf-8'));

const analysisOutput = {
  components_found: [
    {
      name: 'OutputValidator',
      type: 'class',
      location: '.claude/tools/output-validator.mjs',
      description: 'Core validation service',
    },
  ],
  patterns_extracted: [
    {
      pattern: 'Schema caching',
      occurrences: 1,
      examples: ['output-validator.mjs:78'],
      category: 'design-pattern',
    },
  ],
  recommendations: [
    {
      title: 'Add schema versioning',
      priority: 'medium',
      effort: 'medium',
      impact: 'high',
      category: 'maintainability',
    },
  ],
  summary: 'Validation system implemented successfully',
};

const result4 = validator.validate(analysisOutput, analysisSchema);
console.log('Analysis output valid:', result4.valid);

// Example 5: Creating reusable validator
console.log('\n=== Example 5: Reusable Validator ===');
const validateEmail = createValidator(
  {
    type: 'object',
    required: ['email'],
    properties: {
      email: { type: 'string', format: 'email' },
    },
  },
  { name: 'EmailValidator' }
);

const emailOutput1 = { email: 'alice@example.com' };
const emailResult1 = validateEmail(emailOutput1);
console.log('Valid email:', emailResult1.valid);

const emailOutput2 = { email: 'not-an-email' };
const emailResult2 = validateEmail(emailOutput2);
console.log('Invalid email:', emailResult2.valid);
console.log('Email error:', emailResult2.errors[0].message);

// Example 6: Helper function usage
console.log('\n=== Example 6: Helper Functions ===');
const quickResult = validateOutput(
  { count: 5 },
  { type: 'object', required: ['count'], properties: { count: { type: 'integer', minimum: 0 } } }
);
console.log('Quick validation:', quickResult.valid);

// Example 7: Implementation output schema
console.log('\n=== Example 7: Implementation Output Schema ===');
const implementationSchemaPath = join(
  __dirname,
  '..',
  '..',
  'schemas',
  'output-schemas',
  'implementation-output.schema.json'
);
const implementationSchema = JSON.parse(await readFile(implementationSchemaPath, 'utf-8'));

const implementationOutput = {
  files_created: [{ path: '.claude/tools/validator.mjs', purpose: 'Validation', lines: 308 }],
  files_modified: [
    {
      path: '.claude/tools/orchestrator.mjs',
      changes: 'Added validation',
      lines_added: 20,
      lines_removed: 0,
    },
  ],
  tests_added: 35,
  test_coverage: 100,
  breaking_changes: false,
  documentation_updated: true,
  performance_impact: 'neutral',
};

const result7 = validator.validate(implementationOutput, implementationSchema);
console.log('Implementation output valid:', result7.valid);

// Example 8: Review output schema
console.log('\n=== Example 8: Review Output Schema ===');
const reviewSchemaPath = join(
  __dirname,
  '..',
  '..',
  'schemas',
  'output-schemas',
  'review-output.schema.json'
);
const reviewSchema = JSON.parse(await readFile(reviewSchemaPath, 'utf-8'));

const reviewOutput = {
  verdict: 'PASS_WITH_WARNINGS',
  score: 8.5,
  issues_found: [
    {
      severity: 'medium',
      category: 'maintainability',
      description: 'Function complexity could be reduced',
      location: 'validator.mjs:150',
      suggestion: 'Refactor into smaller functions',
    },
  ],
  strengths: ['Good test coverage', 'Clear documentation'],
  recommendations: ['Add more edge case tests'],
};

const result8 = validator.validate(reviewOutput, reviewSchema);
console.log('Review output valid:', result8.valid);

console.log('\n=== All Examples Complete ===');
