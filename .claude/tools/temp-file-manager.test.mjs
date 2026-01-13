import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { TempFileManager } from './temp-file-manager.mjs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const TEMP_DIR = path.join(PROJECT_ROOT, '.claude/context/tmp');

describe('TempFileManager', () => {
  before(() => {
    // Ensure clean state before tests
    if (fs.existsSync(TEMP_DIR)) {
      fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    }
  });

  after(() => {
    // Clean up after tests
    if (fs.existsSync(TEMP_DIR)) {
      fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    }
  });

  it('should ensure temp directory exists', () => {
    TempFileManager.ensureTempDir();
    assert.ok(fs.existsSync(TEMP_DIR), 'Temp directory should exist');
  });

  it('should create temp directory with default prefix', () => {
    const tmpDir = TempFileManager.createTempDir();

    assert.ok(fs.existsSync(tmpDir), 'Temp directory should exist');
    assert.ok(tmpDir.includes('tmpclaude-'), 'Should have default prefix');
    assert.ok(tmpDir.startsWith(TEMP_DIR), 'Should be in .claude/context/tmp/');

    // Clean up
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should create temp directory with custom prefix', () => {
    const tmpDir = TempFileManager.createTempDir('test-prefix-');

    assert.ok(fs.existsSync(tmpDir), 'Temp directory should exist');
    assert.ok(tmpDir.includes('test-prefix-'), 'Should have custom prefix');
    assert.ok(tmpDir.startsWith(TEMP_DIR), 'Should be in .claude/context/tmp/');

    // Clean up
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should create temp file path', () => {
    const tmpFile = TempFileManager.createTempFile('test.json');

    assert.strictEqual(tmpFile, path.join(TEMP_DIR, 'test.json'), 'Should be correct path');
    assert.ok(fs.existsSync(TEMP_DIR), 'Temp directory should be created');
  });

  it('should cleanup old temp files', () => {
    // Create test directories
    const oldDir = TempFileManager.createTempDir('old-');
    const recentDir = TempFileManager.createTempDir('recent-');

    // Make old directory appear old (25 hours ago)
    const oldTime = Date.now() - (25 * 60 * 60 * 1000);
    fs.utimesSync(oldDir, new Date(oldTime), new Date(oldTime));

    // Cleanup files older than 24 hours
    const cleaned = TempFileManager.cleanup(24);

    assert.strictEqual(cleaned, 1, 'Should clean 1 old directory');
    assert.ok(!fs.existsSync(oldDir), 'Old directory should be removed');
    assert.ok(fs.existsSync(recentDir), 'Recent directory should remain');

    // Clean up
    fs.rmSync(recentDir, { recursive: true, force: true });
  });

  it('should cleanup with custom age threshold', () => {
    // Create test directories
    const dir1 = TempFileManager.createTempDir('test1-');
    const dir2 = TempFileManager.createTempDir('test2-');

    // Make dir1 appear 2 hours old
    const oldTime = Date.now() - (2 * 60 * 60 * 1000);
    fs.utimesSync(dir1, new Date(oldTime), new Date(oldTime));

    // Cleanup files older than 1 hour
    const cleaned = TempFileManager.cleanup(1);

    assert.strictEqual(cleaned, 1, 'Should clean 1 directory');
    assert.ok(!fs.existsSync(dir1), 'Directory 1 should be removed');
    assert.ok(fs.existsSync(dir2), 'Directory 2 should remain');

    // Clean up
    fs.rmSync(dir2, { recursive: true, force: true });
  });

  it('should skip hidden files during cleanup', () => {
    // Create hidden file
    const hiddenFile = path.join(TEMP_DIR, '.gitkeep');
    fs.writeFileSync(hiddenFile, '');

    // Make it old
    const oldTime = Date.now() - (25 * 60 * 60 * 1000);
    fs.utimesSync(hiddenFile, new Date(oldTime), new Date(oldTime));

    // Cleanup
    const cleaned = TempFileManager.cleanup(24);

    assert.strictEqual(cleaned, 0, 'Should not clean hidden files');
    assert.ok(fs.existsSync(hiddenFile), 'Hidden file should remain');

    // Clean up
    fs.unlinkSync(hiddenFile);
  });

  it('should return 0 if temp directory does not exist', () => {
    // Remove temp directory
    if (fs.existsSync(TEMP_DIR)) {
      fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    }

    const cleaned = TempFileManager.cleanup(24);
    assert.strictEqual(cleaned, 0, 'Should return 0 when directory does not exist');
  });
});
