#!/usr/bin/env node

/**
 * CUJ Execution Mode Validation Script
 *
 * Validates all 62 CUJs have proper execution mode format
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const cujDir = path.join(__dirname, '..', '.claude', 'docs', 'cujs');
  const files = await fs.readdir(cujDir);
  const cujFiles = files.filter((f) => f.startsWith('CUJ-') && f.endsWith('.md')).sort();

  console.log('CUJ Execution Mode Validation Report');
  console.log('='.repeat(80));
  console.log(`Total CUJs: ${cujFiles.length}\n`);

  const results = {
    workflow: [],
    planMode: [],
    subagentOnly: [],
    skillOnly: [],
    missing: [],
    invalid: [],
  };

  for (const file of cujFiles) {
    const content = await fs.readFile(path.join(cujDir, file), 'utf-8');
    const modeMatch = content.match(/\*\*Execution Mode\*\*:\s*(.+)/);
    const workflowMatch = content.match(/\*\*Workflow File\*\*:\s*`(.+)`/);

    if (!modeMatch) {
      results.missing.push(file);
      continue;
    }

    const mode = modeMatch[1].trim().replace(/`/g, '');

    if (mode === 'workflow') {
      if (workflowMatch) {
        results.workflow.push({ file, workflow: workflowMatch[1] });
      } else {
        results.invalid.push({ file, reason: 'workflow mode but missing workflow_file' });
      }
    } else if (mode === 'plan-mode' || mode === 'plan') {
      results.planMode.push(file);
    } else if (mode === 'subagent-only') {
      results.subagentOnly.push(file);
    } else if (mode === 'skill-only') {
      results.skillOnly.push(file);
    } else {
      results.invalid.push({ file, reason: `Unknown mode: ${mode}` });
    }
  }

  // Display results
  console.log(`✅ Valid Workflow Mode: ${results.workflow.length}`);
  results.workflow.forEach((r) => console.log(`   ${r.file} → ${r.workflow}`));

  console.log(`\n✅ Plan Mode: ${results.planMode.length}`);
  results.planMode.forEach((f) => console.log(`   ${f}`));

  console.log(`\n✅ Subagent Only: ${results.subagentOnly.length}`);
  results.subagentOnly.forEach((f) => console.log(`   ${f}`));

  console.log(`\n✅ Skill Only: ${results.skillOnly.length}`);
  results.skillOnly.forEach((f) => console.log(`   ${f}`));

  if (results.missing.length > 0) {
    console.log(`\n❌ Missing Execution Mode: ${results.missing.length}`);
    results.missing.forEach((f) => console.log(`   ${f}`));
  }

  if (results.invalid.length > 0) {
    console.log(`\n⚠️  Invalid/Incomplete: ${results.invalid.length}`);
    results.invalid.forEach((r) => console.log(`   ${r.file}: ${r.reason}`));
  }

  console.log('\n' + '='.repeat(80));
  console.log('Summary:');
  console.log(
    `  Workflow: ${results.workflow.length}, Plan Mode: ${results.planMode.length}, ` +
      `Subagent Only: ${results.subagentOnly.length}, Skill Only: ${results.skillOnly.length}`
  );
  console.log(`  Missing: ${results.missing.length}, Invalid: ${results.invalid.length}`);

  if (results.missing.length === 0 && results.invalid.length === 0) {
    console.log('\n✅ All CUJs have valid execution modes!');
    process.exit(0);
  } else {
    console.log('\n❌ Some CUJs have issues. Review above.');
    process.exit(1);
  }
}

main().catch(console.error);
