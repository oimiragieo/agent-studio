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

  describe('findProjectRoot', () => {
    test('module should export findProjectRoot function', () => {
      // This test will FAIL until we add findProjectRoot to exports
      assert.ok(
        typeof extractor.findProjectRoot === 'function',
        'Module should export findProjectRoot function'
      );
    });

    test('findProjectRoot returns correct project root', () => {
      // Skip if not exported yet
      if (typeof extractor.findProjectRoot !== 'function') {
        return;
      }
      const projectRoot = extractor.findProjectRoot();
      // Should find a directory containing .claude/CLAUDE.md
      const claudeMdPath = path.join(projectRoot, '.claude', 'CLAUDE.md');
      assert.ok(
        fs.existsSync(claudeMdPath),
        `Project root should contain .claude/CLAUDE.md: ${projectRoot}`
      );
    });
  });

  describe('projectRoot usage', () => {
    test('module should export PROJECT_ROOT constant', () => {
      // This test will FAIL until we add PROJECT_ROOT to exports
      assert.ok(extractor.PROJECT_ROOT !== undefined, 'Module should export PROJECT_ROOT constant');
    });

    test('PROJECT_ROOT should be a valid path', () => {
      // Skip if not exported yet
      if (extractor.PROJECT_ROOT === undefined) {
        return;
      }
      assert.ok(typeof extractor.PROJECT_ROOT === 'string', 'PROJECT_ROOT should be a string');
      assert.ok(fs.existsSync(extractor.PROJECT_ROOT), 'PROJECT_ROOT should exist');
    });
  });
});
