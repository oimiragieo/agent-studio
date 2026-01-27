#!/usr/bin/env node
/**
 * Tests for atomic file write utility
 *
 * Prevents data corruption by writing to temp file first, then renaming.
 * This is a critical utility for state files that must not be corrupted
 * if the process crashes mid-write.
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Module under test (will be created after tests)
let atomicWrite;

// Test directory for isolation
let testDir;

describe('atomic-write', () => {
  beforeEach(() => {
    // Create isolated test directory
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atomic-write-test-'));

    // Clear require cache to get fresh module
    const modulePath = path.join(__dirname, 'atomic-write.cjs');
    delete require.cache[require.resolve(modulePath)];
    atomicWrite = require(modulePath);
  });

  afterEach(() => {
    // Clean up test directory
    if (testDir && fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('atomicWriteSync', () => {
    it('should write content to a new file', () => {
      const filePath = path.join(testDir, 'test.txt');
      const content = 'Hello, World!';

      atomicWrite.atomicWriteSync(filePath, content);

      assert.strictEqual(fs.readFileSync(filePath, 'utf8'), content);
    });

    it('should overwrite existing file atomically', () => {
      const filePath = path.join(testDir, 'existing.txt');
      fs.writeFileSync(filePath, 'original content');

      atomicWrite.atomicWriteSync(filePath, 'new content');

      assert.strictEqual(fs.readFileSync(filePath, 'utf8'), 'new content');
    });

    it('should create parent directories if they do not exist', () => {
      const filePath = path.join(testDir, 'nested', 'deep', 'file.txt');
      const content = 'nested content';

      atomicWrite.atomicWriteSync(filePath, content);

      assert.strictEqual(fs.readFileSync(filePath, 'utf8'), content);
    });

    it('should not leave temp files on success', () => {
      const filePath = path.join(testDir, 'clean.txt');
      atomicWrite.atomicWriteSync(filePath, 'content');

      const files = fs.readdirSync(testDir);
      // Should only have the target file, no .tmp-* files
      const tempFiles = files.filter(f => f.startsWith('.tmp-'));
      assert.strictEqual(tempFiles.length, 0, 'Should not leave temp files');
    });

    it('should handle binary content with encoding option', () => {
      const filePath = path.join(testDir, 'binary.bin');
      const buffer = Buffer.from([0x00, 0x01, 0x02, 0xff]);

      atomicWrite.atomicWriteSync(filePath, buffer);

      const result = fs.readFileSync(filePath);
      assert.deepStrictEqual(result, buffer);
    });
  });

  describe('atomicWriteJSONSync', () => {
    it('should write JSON with pretty printing', () => {
      const filePath = path.join(testDir, 'data.json');
      const data = { name: 'test', value: 42 };

      atomicWrite.atomicWriteJSONSync(filePath, data);

      const result = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      assert.deepStrictEqual(result, data);

      // Verify pretty printing (should have newlines)
      const rawContent = fs.readFileSync(filePath, 'utf8');
      assert.ok(rawContent.includes('\n'), 'Should be pretty printed');
    });

    it('should handle complex nested objects', () => {
      const filePath = path.join(testDir, 'complex.json');
      const data = {
        mode: 'agent',
        taskSpawned: true,
        details: {
          nested: {
            deeply: true,
          },
          array: [1, 2, 3],
        },
      };

      atomicWrite.atomicWriteJSONSync(filePath, data);

      const result = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      assert.deepStrictEqual(result, data);
    });

    it('should overwrite existing JSON files', () => {
      const filePath = path.join(testDir, 'overwrite.json');
      fs.writeFileSync(filePath, JSON.stringify({ old: 'data' }));

      atomicWrite.atomicWriteJSONSync(filePath, { new: 'data' });

      const result = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      assert.deepStrictEqual(result, { new: 'data' });
    });

    it('should handle arrays as root element', () => {
      const filePath = path.join(testDir, 'array.json');
      const data = [1, 2, { three: 3 }];

      atomicWrite.atomicWriteJSONSync(filePath, data);

      const result = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      assert.deepStrictEqual(result, data);
    });

    it('should handle null and empty objects', () => {
      const nullPath = path.join(testDir, 'null.json');
      const emptyPath = path.join(testDir, 'empty.json');

      atomicWrite.atomicWriteJSONSync(nullPath, null);
      atomicWrite.atomicWriteJSONSync(emptyPath, {});

      assert.strictEqual(JSON.parse(fs.readFileSync(nullPath, 'utf8')), null);
      assert.deepStrictEqual(JSON.parse(fs.readFileSync(emptyPath, 'utf8')), {});
    });
  });

  describe('error handling', () => {
    it('should clean up temp file on write error', () => {
      // Try to write to an invalid path (directory as file)
      const dirPath = path.join(testDir, 'is-a-dir');
      fs.mkdirSync(dirPath);
      const filePath = path.join(dirPath, '..', 'is-a-dir'); // Points to the directory

      assert.throws(() => {
        atomicWrite.atomicWriteSync(filePath, 'content');
      });

      // Verify no temp files are left
      const allFiles = fs.readdirSync(testDir);
      const tempFiles = allFiles.filter(f => f.startsWith('.tmp-'));
      assert.strictEqual(tempFiles.length, 0, 'Should clean up temp files on error');
    });

    it('should throw on invalid JSON serialization', () => {
      const filePath = path.join(testDir, 'invalid.json');
      const circular = {};
      circular.self = circular;

      assert.throws(() => {
        atomicWrite.atomicWriteJSONSync(filePath, circular);
      }, /circular|convert/i);
    });
  });
});
