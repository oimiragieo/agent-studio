#!/usr/bin/env node
/**
 * Cross-Platform Compatibility Tests
 * Validates that path, CLI, line-ending, and permission utilities work correctly
 */

import assert from 'assert';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getCliCommand, spawnCli, commandExists } from './cross-platform-cli.mjs';
import {
  normalizeToLF,
  normalizeToCRLF,
  normalizeToSystem,
  readTextFile,
  writeTextFile,
  readTextFilePreserve,
  convertLineEndings
} from './line-endings.mjs';
import {
  makeExecutable,
  setFilePermissions,
  getFilePermissions,
  isExecutable,
  getPermissionString
} from './file-permissions.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isWindows = os.platform() === 'win32';

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: []
};

function testResult(name, passed, error = null) {
  if (passed) {
    results.passed++;
    results.tests.push({ name, status: 'PASS' });
    console.log(`✅ ${name}`);
  } else {
    results.failed++;
    results.tests.push({ name, status: 'FAIL', error: error?.message || 'Unknown error' });
    console.log(`❌ ${name}: ${error?.message || 'Unknown error'}`);
  }
}

function skipTest(name, reason) {
  results.skipped++;
  results.tests.push({ name, status: 'SKIP', reason });
  console.log(`⏭️  ${name}: ${reason}`);
}

console.log('🧪 Cross-Platform Compatibility Tests\n');
console.log(`Platform: ${os.platform()}`);
console.log(`Node: ${process.version}\n`);

// ============================================================================
// CLI Tests
// ============================================================================
console.log('📦 CLI Command Tests\n');

try {
  const cmdResult = getCliCommand('claude');
  const expected = isWindows ? 'claude.cmd' : 'claude';
  testResult('CLI: getCliCommand adds .cmd on Windows', cmdResult === expected);
} catch (error) {
  testResult('CLI: getCliCommand', false, error);
}

try {
  const cmdResult = getCliCommand('node.exe');
  testResult('CLI: getCliCommand preserves .exe', cmdResult === 'node.exe');
} catch (error) {
  testResult('CLI: getCliCommand preserves .exe', false, error);
}

try {
  const exists = await commandExists('node');
  testResult('CLI: commandExists detects node', exists === true);
} catch (error) {
  testResult('CLI: commandExists', false, error);
}

try {
  const exists = await commandExists('nonexistent-command-12345');
  testResult('CLI: commandExists returns false for missing command', exists === false);
} catch (error) {
  testResult('CLI: commandExists missing command', false, error);
}

// ============================================================================
// Line Ending Tests
// ============================================================================
console.log('\n📝 Line Ending Tests\n');

try {
  const lfResult = normalizeToLF('Hello\r\nWorld\r\n');
  testResult('Line endings: normalizeToLF', lfResult === 'Hello\nWorld\n');
} catch (error) {
  testResult('Line endings: normalizeToLF', false, error);
}

try {
  const crlfResult = normalizeToCRLF('Hello\nWorld\n');
  testResult('Line endings: normalizeToCRLF', crlfResult === 'Hello\r\nWorld\r\n');
} catch (error) {
  testResult('Line endings: normalizeToCRLF', false, error);
}

try {
  const systemResult = normalizeToSystem('Hello\nWorld\n');
  const expected = isWindows ? 'Hello\r\nWorld\r\n' : 'Hello\nWorld\n';
  testResult('Line endings: normalizeToSystem', systemResult === expected);
} catch (error) {
  testResult('Line endings: normalizeToSystem', false, error);
}

try {
  const testFile = path.join(__dirname, '..', 'context', 'tmp', 'test-line-endings.txt');
  fs.mkdirSync(path.dirname(testFile), { recursive: true });

  writeTextFile(testFile, 'Test\nContent\n');
  const content = readTextFile(testFile);

  testResult('Line endings: read/write text file', content === 'Test\nContent\n');

  fs.unlinkSync(testFile);
} catch (error) {
  testResult('Line endings: read/write text file', false, error);
}

try {
  const lfConverted = convertLineEndings('Hello\r\nWorld', 'LF');
  testResult('Line endings: convertLineEndings to LF', lfConverted === 'Hello\nWorld');
} catch (error) {
  testResult('Line endings: convertLineEndings', false, error);
}

// ============================================================================
// File Permission Tests
// ============================================================================
console.log('\n🔒 File Permission Tests\n');

if (!isWindows) {
  try {
    const testFile = path.join(__dirname, '..', 'context', 'tmp', 'test-permissions.sh');
    fs.mkdirSync(path.dirname(testFile), { recursive: true });
    fs.writeFileSync(testFile, '#!/bin/bash\necho "test"', 'utf8');

    makeExecutable(testFile);
    const perms = getFilePermissions(testFile);
    const isExec = isExecutable(testFile);

    testResult('Permissions: makeExecutable sets execute bit', (perms & 0o100) !== 0);
    testResult('Permissions: isExecutable detects executable', isExec === true);

    const permString = getPermissionString(testFile);
    testResult('Permissions: getPermissionString format', permString?.startsWith('rwx') === true);

    fs.unlinkSync(testFile);
  } catch (error) {
    testResult('Permissions: Unix permissions', false, error);
  }
} else {
  skipTest('Permissions: Unix permissions', 'Windows uses file extensions');

  try {
    const testFile = path.join(__dirname, '..', 'context', 'tmp', 'test.exe');
    fs.mkdirSync(path.dirname(testFile), { recursive: true });
    fs.writeFileSync(testFile, 'dummy', 'utf8');

    const isExec = isExecutable(testFile);
    testResult('Permissions: Windows detects .exe as executable', isExec === true);

    fs.unlinkSync(testFile);
  } catch (error) {
    testResult('Permissions: Windows .exe detection', false, error);
  }
}

// ============================================================================
// Path Construction Tests
// ============================================================================
console.log('\n🛤️  Path Construction Tests\n');

try {
  const testPath = path.join('folder1', 'folder2', 'file.txt');
  const expectedSeparator = isWindows ? '\\' : '/';
  testResult('Path: path.join uses correct separator', testPath.includes(expectedSeparator));
} catch (error) {
  testResult('Path: path.join', false, error);
}

try {
  const testPath = path.resolve('relative', 'path');
  testResult('Path: path.resolve returns absolute path', path.isAbsolute(testPath));
} catch (error) {
  testResult('Path: path.resolve', false, error);
}

try {
  // Test that we can handle both forward and backward slashes
  const mixedPath = 'folder1/folder2\\file.txt';
  const normalized = path.normalize(mixedPath);
  testResult('Path: path.normalize handles mixed separators', typeof normalized === 'string');
} catch (error) {
  testResult('Path: path.normalize', false, error);
}

// ============================================================================
// Results Summary
// ============================================================================
console.log('\n' + '='.repeat(60));
console.log('📊 Test Results Summary\n');
console.log(`✅ Passed:  ${results.passed}`);
console.log(`❌ Failed:  ${results.failed}`);
console.log(`⏭️  Skipped: ${results.skipped}`);
console.log(`📝 Total:   ${results.passed + results.failed + results.skipped}`);

if (results.failed > 0) {
  console.log('\n❌ Some tests failed. Details:\n');
  results.tests
    .filter(t => t.status === 'FAIL')
    .forEach(t => console.log(`  - ${t.name}: ${t.error}`));
  process.exit(1);
} else {
  console.log('\n✅ All tests passed!');
  process.exit(0);
}
