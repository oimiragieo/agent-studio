#!/usr/bin/env node
/**
 * Manual integration test for agent-task-template-enforcer.mjs
 */

import { readFileSync } from 'fs';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runHookTest(testName, inputFile) {
  return new Promise((resolve, reject) => {
    console.log(`\n🧪 Test: ${testName}`);
    console.log('═'.repeat(70));

    const hook = spawn('node', [join(__dirname, 'agent-task-template-enforcer.mjs')]);
    const input = readFileSync(inputFile, 'utf8');

    let stdout = '';
    let stderr = '';

    hook.stdout.on('data', data => {
      stdout += data.toString();
    });

    hook.stderr.on('data', data => {
      stderr += data.toString();
    });

    hook.on('close', code => {
      console.log(`Input: ${input.substring(0, 100)}...`);
      console.log(`\nStdout: ${stdout || '(none)'}`);
      if (stderr) console.log(`Stderr: ${stderr}`);
      console.log(`Exit code: ${code}`);

      if (stdout) {
        try {
          const result = JSON.parse(stdout);
          console.log(`\n✅ Decision: ${result.decision}`);
          if (result.reason) {
            console.log(`Reason (first 200 chars): ${result.reason.substring(0, 200)}...`);
          }
        } catch (error) {
          console.log(`⚠️  Could not parse output as JSON: ${error.message}`);
        }
      }

      resolve({ stdout, stderr, code });
    });

    hook.stdin.write(input);
    hook.stdin.end();
  });
}

async function main() {
  console.log('🚀 Agent Task Template Enforcer - Manual Integration Tests');
  console.log('═'.repeat(70));

  await runHookTest(
    'Should block freeform text prompt',
    join(__dirname, '..', 'context', 'tmp', 'tmp-test-hook-input.json')
  );

  await runHookTest(
    'Should allow valid template',
    join(__dirname, '..', 'context', 'tmp', 'tmp-test-valid-task.json')
  );

  console.log('\n✅ Manual integration tests complete');
}

main().catch(console.error);
