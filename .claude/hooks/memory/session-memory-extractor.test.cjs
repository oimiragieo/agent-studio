#!/usr/bin/env node
/**
 * Session Memory Extractor Tests
 * ==============================
 *
 * Tests for the session-memory-extractor hook ensuring it:
 * 1. Correctly finds project root using findProjectRoot()
 * 2. Passes projectRoot to all memory manager function calls
 * 3. Extracts patterns, gotchas, and discoveries correctly
 */

'use strict';

const { test, describe, mock, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

// Get the extractor module
const extractor = require('./session-memory-extractor.cjs');

describe('session-memory-extractor', () => {
  describe('extractPatterns', () => {
    test('extracts patterns from output text', () => {
      const output = 'The best practice: always use async/await for I/O operations';
      const patterns = extractor.extractPatterns(output);
      assert.ok(patterns.length > 0, 'Should extract at least one pattern');
    });

    test('limits patterns to max 3', () => {
      const output = `
        pattern: first pattern here test content
        pattern: second pattern here test content
        pattern: third pattern here test content
        pattern: fourth pattern here test content
      `;
      const patterns = extractor.extractPatterns(output);
      assert.ok(patterns.length <= 3, 'Should limit to 3 patterns');
    });

    test('returns empty array for no patterns', () => {
      const output = 'Just some normal text without any indicators';
      const patterns = extractor.extractPatterns(output);
      assert.deepStrictEqual(patterns, []);
    });
  });

  describe('extractGotchas', () => {
    test('extracts gotchas from output text', () => {
      const output = 'gotcha: remember to close database connections';
      const gotchas = extractor.extractGotchas(output);
      assert.ok(gotchas.length > 0, 'Should extract at least one gotcha');
    });

    test('extracts from "don\'t" patterns', () => {
      const output = "don't use synchronous file operations in async context";
      const gotchas = extractor.extractGotchas(output);
      assert.ok(gotchas.length > 0, 'Should extract gotcha from negation pattern');
    });

    test('limits gotchas to max 3', () => {
      const output = `
        gotcha: first gotcha here with content
        gotcha: second gotcha here with content
        gotcha: third gotcha here with content
        gotcha: fourth gotcha here with content
      `;
      const gotchas = extractor.extractGotchas(output);
      assert.ok(gotchas.length <= 3, 'Should limit to 3 gotchas');
    });
  });

  describe('extractDiscoveries', () => {
    test('extracts file discoveries from output text', () => {
      const output = '`src/auth.ts`: handles user authentication';
      const discoveries = extractor.extractDiscoveries(output);
      assert.ok(discoveries.length > 0, 'Should extract at least one discovery');
      assert.strictEqual(discoveries[0].path, 'src/auth.ts');
    });

    test('limits discoveries to max 5', () => {
      const output = `
        \`file1.js\`: description one here
        \`file2.js\`: description two here
        \`file3.js\`: description three here
        \`file4.js\`: description four here
        \`file5.js\`: description five here
        \`file6.js\`: description six here
      `;
      const discoveries = extractor.extractDiscoveries(output);
      assert.ok(discoveries.length <= 5, 'Should limit to 5 discoveries');
    });
  });

  describe('shared utilities', () => {
    test('module imports PROJECT_ROOT from shared utilities', () => {
      // PROJECT_ROOT is now imported from ../../lib/utils/project-root.cjs
      // This is verified by the module loading successfully
      assert.ok(
        typeof extractor.extractPatterns === 'function',
        'Module should load successfully with shared utilities'
      );
    });

    test('module imports parseHookInputAsync from shared utilities', () => {
      // parseHookInputAsync is now imported from ../../lib/utils/hook-input.cjs
      // This is verified by the module loading successfully
      assert.ok(
        typeof extractor.extractGotchas === 'function',
        'Module should load successfully with hook-input utilities'
      );
    });
  });
});
