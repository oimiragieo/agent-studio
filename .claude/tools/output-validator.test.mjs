#!/usr/bin/env node
/**
 * Output Validator Tests
 *
 * Tests for Zod-based output validation system
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { OutputValidator, ValidationError, validateOutput, createValidator } from './output-validator.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('OutputValidator', () => {
  const validator = new OutputValidator();

  describe('Basic Type Validation', () => {
    it('should validate valid object output', () => {
      const schema = {
        type: 'object',
        required: ['name', 'count'],
        properties: {
          name: { type: 'string', minLength: 1 },
          count: { type: 'integer', minimum: 0 }
        }
      };

      const output = { name: 'Test', count: 5 };
      const result = validator.validate(output, schema);

      assert.strictEqual(result.valid, true);
      assert.deepStrictEqual(result.data, output);
    });

    it('should reject invalid output with helpful errors', () => {
      const schema = {
        type: 'object',
        required: ['name', 'count'],
        properties: {
          name: { type: 'string', minLength: 1 },
          count: { type: 'integer', minimum: 0 }
        }
      };

      const output = { name: '', count: -1 };
      const result = validator.validate(output, schema);

      assert.strictEqual(result.valid, false);
      assert(result.errors.length > 0);
      assert(result.errors.some(e => e.path.includes('name')));
      assert(result.errors.some(e => e.path.includes('count')));
    });

    it('should validate array outputs', () => {
      const schema = {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' }
          }
        }
      };

      const output = [{ id: 'a' }, { id: 'b' }];
      const result = validator.validate(output, schema);

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.data.length, 2);
    });

    it('should reject empty arrays when minItems is specified', () => {
      const schema = {
        type: 'array',
        minItems: 1,
        items: { type: 'string' }
      };

      const output = [];
      const result = validator.validate(output, schema);

      assert.strictEqual(result.valid, false);
      assert(result.errors.some(e => e.code === 'too_small'));
    });

    it('should validate string constraints', () => {
      const schema = {
        type: 'string',
        minLength: 3,
        maxLength: 10
      };

      const validOutput = 'hello';
      const result1 = validator.validate(validOutput, schema);
      assert.strictEqual(result1.valid, true);

      const tooShort = 'hi';
      const result2 = validator.validate(tooShort, schema);
      assert.strictEqual(result2.valid, false);

      const tooLong = 'hello world is too long';
      const result3 = validator.validate(tooLong, schema);
      assert.strictEqual(result3.valid, false);
    });

    it('should validate number ranges', () => {
      const schema = {
        type: 'number',
        minimum: 0,
        maximum: 100
      };

      const valid = 50;
      const result1 = validator.validate(valid, schema);
      assert.strictEqual(result1.valid, true);

      const tooSmall = -1;
      const result2 = validator.validate(tooSmall, schema);
      assert.strictEqual(result2.valid, false);

      const tooLarge = 101;
      const result3 = validator.validate(tooLarge, schema);
      assert.strictEqual(result3.valid, false);
    });

    it('should validate integer type', () => {
      const schema = {
        type: 'integer',
        minimum: 0
      };

      const validInt = 42;
      const result1 = validator.validate(validInt, schema);
      assert.strictEqual(result1.valid, true);

      const notInt = 42.5;
      const result2 = validator.validate(notInt, schema);
      assert.strictEqual(result2.valid, false);
    });

    it('should validate boolean type', () => {
      const schema = { type: 'boolean' };

      const validTrue = true;
      const result1 = validator.validate(validTrue, schema);
      assert.strictEqual(result1.valid, true);

      const validFalse = false;
      const result2 = validator.validate(validFalse, schema);
      assert.strictEqual(result2.valid, true);

      const notBoolean = 'true';
      const result3 = validator.validate(notBoolean, schema);
      assert.strictEqual(result3.valid, false);
    });

    it('should validate enum values', () => {
      const schema = {
        type: 'string',
        enum: ['PASS', 'FAIL', 'PENDING']
      };

      const valid = 'PASS';
      const result1 = validator.validate(valid, schema);
      assert.strictEqual(result1.valid, true);

      const invalid = 'UNKNOWN';
      const result2 = validator.validate(invalid, schema);
      assert.strictEqual(result2.valid, false);
    });
  });

  describe('Complex Schema Validation', () => {
    it('should validate nested objects', () => {
      const schema = {
        type: 'object',
        required: ['user'],
        properties: {
          user: {
            type: 'object',
            required: ['name', 'age'],
            properties: {
              name: { type: 'string' },
              age: { type: 'integer', minimum: 0 }
            }
          }
        }
      };

      const valid = { user: { name: 'Alice', age: 30 } };
      const result = validator.validate(valid, schema);
      assert.strictEqual(result.valid, true);
    });

    it('should validate optional fields', () => {
      const schema = {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' }
        }
      };

      const withOptional = { name: 'Test', description: 'Optional field' };
      const result1 = validator.validate(withOptional, schema);
      assert.strictEqual(result1.valid, true);

      const withoutOptional = { name: 'Test' };
      const result2 = validator.validate(withoutOptional, schema);
      assert.strictEqual(result2.valid, true);
    });

    it('should validate arrays of objects', () => {
      const schema = {
        type: 'object',
        required: ['items'],
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              required: ['id', 'value'],
              properties: {
                id: { type: 'string' },
                value: { type: 'number' }
              }
            }
          }
        }
      };

      const valid = {
        items: [
          { id: 'a', value: 1 },
          { id: 'b', value: 2 }
        ]
      };

      const result = validator.validate(valid, schema);
      assert.strictEqual(result.valid, true);
    });

    it('should validate pattern constraints', () => {
      const schema = {
        type: 'string',
        pattern: '^[A-Z]{3}-\\d{3}$'
      };

      const valid = 'CUJ-001';
      const result1 = validator.validate(valid, schema);
      assert.strictEqual(result1.valid, true);

      const invalid = 'invalid-format';
      const result2 = validator.validate(invalid, schema);
      assert.strictEqual(result2.valid, false);
    });
  });

  describe('Analysis Output Schema', () => {
    it('should validate valid analysis output', async () => {
      const schemaPath = join(__dirname, '..', 'schemas', 'output-schemas', 'analysis-output.schema.json');
      const schema = JSON.parse(await readFile(schemaPath, 'utf-8'));

      const validOutput = {
        components_found: [
          {
            name: 'EntityMemory',
            type: 'class',
            location: '.claude/tools/memory/entity-memory.mjs',
            description: 'Memory storage for entities'
          }
        ],
        patterns_extracted: [
          {
            pattern: 'Singleton pattern',
            occurrences: 3,
            examples: ['entity-memory.mjs', 'conversation-memory.mjs']
          }
        ],
        recommendations: [
          {
            title: 'Add error handling',
            priority: 'high',
            effort: 'small'
          }
        ],
        summary: 'Analysis complete'
      };

      const result = validator.validate(validOutput, schema);
      assert.strictEqual(result.valid, true);
    });

    it('should reject analysis output missing required fields', async () => {
      const schemaPath = join(__dirname, '..', 'schemas', 'output-schemas', 'analysis-output.schema.json');
      const schema = JSON.parse(await readFile(schemaPath, 'utf-8'));

      const invalidOutput = {
        components_found: [],
        // Missing patterns_extracted
        recommendations: []
      };

      const result = validator.validate(invalidOutput, schema);
      assert.strictEqual(result.valid, false);
      assert(result.errors.some(e => e.path.includes('patterns_extracted')));
    });

    it('should reject empty components_found array', async () => {
      const schemaPath = join(__dirname, '..', 'schemas', 'output-schemas', 'analysis-output.schema.json');
      const schema = JSON.parse(await readFile(schemaPath, 'utf-8'));

      const invalidOutput = {
        components_found: [], // Must have minItems: 1
        patterns_extracted: [],
        recommendations: []
      };

      const result = validator.validate(invalidOutput, schema);
      assert.strictEqual(result.valid, false);
      assert(result.errors.some(e => e.path === 'components_found'));
    });
  });

  describe('Implementation Output Schema', () => {
    it('should validate valid implementation output', async () => {
      const schemaPath = join(__dirname, '..', 'schemas', 'output-schemas', 'implementation-output.schema.json');
      const schema = JSON.parse(await readFile(schemaPath, 'utf-8'));

      const validOutput = {
        files_created: [
          {
            path: '.claude/tools/output-validator.mjs',
            purpose: 'Output validation',
            lines: 250
          }
        ],
        files_modified: [
          {
            path: '.claude/tools/orchestrator-entry.mjs',
            changes: 'Added validation support',
            lines_added: 20,
            lines_removed: 5
          }
        ],
        tests_added: 15,
        test_coverage: 85.5,
        breaking_changes: false
      };

      const result = validator.validate(validOutput, schema);
      assert.strictEqual(result.valid, true);
    });

    it('should reject invalid test coverage percentage', async () => {
      const schemaPath = join(__dirname, '..', 'schemas', 'output-schemas', 'implementation-output.schema.json');
      const schema = JSON.parse(await readFile(schemaPath, 'utf-8'));

      const invalidOutput = {
        files_created: [],
        files_modified: [],
        tests_added: 0,
        test_coverage: 105 // Invalid: > 100
      };

      const result = validator.validate(invalidOutput, schema);
      assert.strictEqual(result.valid, false);
      assert(result.errors.some(e => e.path === 'test_coverage'));
    });
  });

  describe('Review Output Schema', () => {
    it('should validate valid review output', async () => {
      const schemaPath = join(__dirname, '..', 'schemas', 'output-schemas', 'review-output.schema.json');
      const schema = JSON.parse(await readFile(schemaPath, 'utf-8'));

      const validOutput = {
        verdict: 'PASS_WITH_WARNINGS',
        score: 8.5,
        issues_found: [
          {
            severity: 'medium',
            category: 'maintainability',
            description: 'Function too complex',
            location: 'validator.mjs:150',
            suggestion: 'Refactor into smaller functions'
          }
        ],
        strengths: ['Good test coverage', 'Clear documentation'],
        recommendations: ['Add more edge case tests']
      };

      const result = validator.validate(validOutput, schema);
      assert.strictEqual(result.valid, true);
    });

    it('should reject invalid verdict', async () => {
      const schemaPath = join(__dirname, '..', 'schemas', 'output-schemas', 'review-output.schema.json');
      const schema = JSON.parse(await readFile(schemaPath, 'utf-8'));

      const invalidOutput = {
        verdict: 'INVALID_VERDICT',
        score: 7,
        issues_found: []
      };

      const result = validator.validate(invalidOutput, schema);
      assert.strictEqual(result.valid, false);
      assert(result.errors.some(e => e.path === 'verdict'));
    });

    it('should reject score out of range', async () => {
      const schemaPath = join(__dirname, '..', 'schemas', 'output-schemas', 'review-output.schema.json');
      const schema = JSON.parse(await readFile(schemaPath, 'utf-8'));

      const invalidOutput = {
        verdict: 'PASS',
        score: 11, // Invalid: > 10
        issues_found: []
      };

      const result = validator.validate(invalidOutput, schema);
      assert.strictEqual(result.valid, false);
      assert(result.errors.some(e => e.path === 'score'));
    });
  });

  describe('Helper Functions', () => {
    it('should create validator with custom options', () => {
      const schema = {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' }
        }
      };

      const customValidator = validator.createValidator(schema, {
        name: 'UserOutput',
        throwOnError: false
      });

      const valid = { name: 'Test' };
      const result1 = customValidator(valid);
      assert.strictEqual(result1.valid, true);

      const invalid = { name: 123 };
      const result2 = customValidator(invalid);
      assert.strictEqual(result2.valid, false);
    });

    it('should throw ValidationError when throwOnError is true', () => {
      const schema = {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' }
        }
      };

      const customValidator = validator.createValidator(schema, {
        name: 'UserOutput',
        throwOnError: true
      });

      const invalid = { name: 123 };
      assert.throws(() => {
        customValidator(invalid);
      }, ValidationError);
    });

    it('should generate detailed validation report', () => {
      const schema = {
        type: 'object',
        required: ['name', 'age'],
        properties: {
          name: { type: 'string', minLength: 1 },
          age: { type: 'integer', minimum: 0 }
        }
      };

      const invalid = { name: '', age: -1 };
      const result = validator.validateWithReport(invalid, schema);

      assert.strictEqual(result.valid, false);
      assert(result.report.includes('❌'));
      assert(result.report.includes('Total errors:'));
    });
  });

  describe('Module Exports', () => {
    it('should export validateOutput helper', () => {
      const schema = { type: 'string' };
      const result = validateOutput('test', schema);
      assert.strictEqual(result.valid, true);
    });

    it('should export createValidator helper', () => {
      const schema = { type: 'number' };
      const customValidator = createValidator(schema);
      const result = customValidator(42);
      assert.strictEqual(result.valid, true);
    });
  });

  describe('Schema Caching', () => {
    it('should cache converted schemas', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' }
        }
      };

      // First call - converts and caches
      const result1 = validator.validate({ name: 'Test' }, schema);
      assert.strictEqual(result1.valid, true);

      // Second call - should use cache
      const result2 = validator.validate({ name: 'Test2' }, schema);
      assert.strictEqual(result2.valid, true);

      // Cache should have the schema
      assert(validator.schemaCache.size > 0);
    });

    it('should clear schema cache', () => {
      const schema = { type: 'string' };
      validator.validate('test', schema);

      assert(validator.schemaCache.size > 0);
      validator.clearCache();
      assert.strictEqual(validator.schemaCache.size, 0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null values', () => {
      const schema = { type: 'null' };
      const result = validator.validate(null, schema);
      assert.strictEqual(result.valid, true);
    });

    it('should handle const values', () => {
      const schema = { const: 'CONSTANT_VALUE' };
      const result1 = validator.validate('CONSTANT_VALUE', schema);
      assert.strictEqual(result1.valid, true);

      const result2 = validator.validate('OTHER_VALUE', schema);
      assert.strictEqual(result2.valid, false);
    });

    it('should handle missing minItems on array', () => {
      const schema = {
        type: 'array',
        items: { type: 'string' }
      };

      const empty = [];
      const result = validator.validate(empty, schema);
      assert.strictEqual(result.valid, true); // No minItems specified
    });

    it('should handle maxItems on array', () => {
      const schema = {
        type: 'array',
        maxItems: 2,
        items: { type: 'string' }
      };

      const tooMany = ['a', 'b', 'c'];
      const result = validator.validate(tooMany, schema);
      assert.strictEqual(result.valid, false);
    });

    it('should handle format email', () => {
      const schema = {
        type: 'string',
        format: 'email'
      };

      const validEmail = 'test@example.com';
      const result1 = validator.validate(validEmail, schema);
      assert.strictEqual(result1.valid, true);

      const invalidEmail = 'not-an-email';
      const result2 = validator.validate(invalidEmail, schema);
      assert.strictEqual(result2.valid, false);
    });

    it('should handle format url', () => {
      const schema = {
        type: 'string',
        format: 'url'
      };

      const validUrl = 'https://example.com';
      const result1 = validator.validate(validUrl, schema);
      assert.strictEqual(result1.valid, true);

      const invalidUrl = 'not-a-url';
      const result2 = validator.validate(invalidUrl, schema);
      assert.strictEqual(result2.valid, false);
    });

    it('should handle format uuid', () => {
      const schema = {
        type: 'string',
        format: 'uuid'
      };

      const validUuid = '550e8400-e29b-41d4-a716-446655440000';
      const result1 = validator.validate(validUuid, schema);
      assert.strictEqual(result1.valid, true);

      const invalidUuid = 'not-a-uuid';
      const result2 = validator.validate(invalidUuid, schema);
      assert.strictEqual(result2.valid, false);
    });
  });
});
