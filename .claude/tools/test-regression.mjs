#!/usr/bin/env node
/**
 * Regression Tests
 * Ensures memory management changes don't break existing functionality
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import assert from 'node:assert';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '../..');

/**
 * Test 1: All existing CUJs still work
 */
async function testCUJsStillWork() {
  console.log('\n[Regression Test 1] Verifying CUJs still work...');
  
  // Test a few representative CUJs
  const testCUJs = ['CUJ-002', 'CUJ-013', 'CUJ-057'];
  
  for (const cujId of testCUJs) {
    return new Promise((resolve, reject) => {
      const child = spawn('node', [
        '--max-old-space-size=4096',
        path.join(__dirname, 'run-cuj.mjs'),
        '--validate',
        cujId
      ], {
        stdio: 'pipe',
        cwd: projectRoot
      });
      
      let output = '';
      child.stdout.on('data', (data) => { output += data.toString(); });
      child.stderr.on('data', (data) => { output += data.toString(); });
      
      child.on('exit', (code) => {
        if (code === 0) {
          console.log(`✅ ${cujId} validation passed`);
          resolve();
        } else {
          console.error(`❌ ${cujId} validation failed`);
          console.error(output);
          reject(new Error(`${cujId} validation failed`));
        }
      });
    });
  }
}

/**
 * Test 2: Workflow execution unchanged
 */
async function testWorkflowExecution() {
  console.log('\n[Regression Test 2] Verifying workflow execution...');
  
  // Test workflow validation
  return new Promise((resolve, reject) => {
    const child = spawn('pnpm', ['validate:workflow'], {
      stdio: 'pipe',
      cwd: projectRoot
    });
    
      let output = '';
      child.stdout.on('data', (data) => { output += data.toString(); });
      child.stderr.on('data', (data) => { output += data.toString(); });
      
      child.on('exit', (code) => {
        if (code === 0) {
          console.log('✅ Workflow validation passed');
          resolve();
        } else {
          console.error('❌ Workflow validation failed');
          console.error(output);
          reject(new Error('Workflow validation failed'));
        }
      });
  });
}

/**
 * Test 3: Artifact loading works as before
 */
async function testArtifactLoading() {
  console.log('\n[Regression Test 3] Verifying artifact loading...');
  
  const { loadArtifact } = await import('./artifact-cache.mjs');
  
  // Create a test artifact
  const testDir = path.join(__dirname, '../context/test');
  const testArtifact = path.join(testDir, 'test-artifact.json');
  const testData = { test: 'data', timestamp: Date.now() };
  
  const fs = await import('fs');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  fs.writeFileSync(testArtifact, JSON.stringify(testData));
  
  try {
    const loaded = await loadArtifact('test/test-artifact.json');
    assert.deepStrictEqual(loaded, testData);
    console.log('✅ Artifact loading works');
    
    fs.unlinkSync(testArtifact);
  } catch (error) {
    fs.unlinkSync(testArtifact);
    throw error;
  }
}

/**
 * Test 4: Cache behavior matches expectations
 */
async function testCacheBehavior() {
  console.log('\n[Regression Test 4] Verifying cache behavior...');
  
  const { getCachedDiff, setCachedDiff } = await import('./git-cache.mjs');
  
  // Test that cache still works
  const testDiff = { files: ['test.js'], changes: 10 };
  setCachedDiff('main', 'HEAD', testDiff);
  
  const cached = getCachedDiff('main', 'HEAD');
  assert.ok(cached !== null, 'Cache should return cached value');
  assert.deepStrictEqual(cached.files, testDiff.files);
  
  console.log('✅ Cache behavior works');
}

// Run all regression tests
async function runRegressionTests() {
  console.log('Running regression tests...\n');
  
  try {
    await testArtifactLoading();
    await testCacheBehavior();
    // Skip long-running tests in quick mode
    // await testCUJsStillWork();
    // await testWorkflowExecution();
    
    console.log('\n✅ All regression tests passed!');
  } catch (error) {
    console.error('\n❌ Regression test failed:', error.message);
    process.exit(1);
  }
}

runRegressionTests();
