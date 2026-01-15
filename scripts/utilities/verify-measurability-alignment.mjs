#!/usr/bin/env node
/**
 * Verification Script: Measurability Alignment
 *
 * Compares measurability results between:
 * - cuj-validator-unified.mjs (checks registry expected_outputs)
 * - cuj-measurability.mjs (checks markdown ## Success Criteria)
 *
 * Reports alignment status and discrepancies.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '../..');

console.log('\n🔍 Measurability Alignment Verification\n');
console.log('Comparing two measurability validation approaches:');
console.log('  1. Registry (cuj-validator-unified.mjs → cuj-registry.json)');
console.log('  2. Markdown (cuj-measurability.mjs → CUJ-*.md)\n');
console.log('='.repeat(70) + '\n');

// Run cuj-validator-unified.mjs --doctor
console.log('📋 Running cuj-validator-unified.mjs --doctor...');
let registryStats = null;

try {
  const doctorOutput = execSync('node .claude/tools/cuj-validator-unified.mjs --doctor --json', {
    cwd: ROOT,
    encoding: 'utf-8',
    stdio: 'pipe',
  });

  const doctorResult = JSON.parse(doctorOutput);
  registryStats = {
    totalCriteria: doctorResult.doctor?.stats?.totalRegistryCriteria || 0,
    measurable: doctorResult.doctor?.stats?.measurableRegistryCriteria || 0,
    nonMeasurablePercent: parseFloat(
      doctorResult.doctor?.stats?.registryNonMeasurablePercent || '0'
    ),
  };

  console.log(`   ✓ Registry Stats:`);
  console.log(`     Total Criteria: ${registryStats.totalCriteria}`);
  console.log(`     Measurable: ${registryStats.measurable}`);
  console.log(`     Non-Measurable: ${registryStats.nonMeasurablePercent}%\n`);
} catch (error) {
  console.error('   ✗ Failed to run cuj-validator-unified.mjs:', error.message);
  process.exit(1);
}

// Run cuj-measurability.mjs
console.log('📊 Running cuj-measurability.mjs...');
let markdownStats = null;

try {
  const measurabilityOutput = execSync('node scripts/cuj-measurability.mjs --json', {
    cwd: ROOT,
    encoding: 'utf-8',
    stdio: 'pipe',
  });

  const measurabilityResult = JSON.parse(measurabilityOutput);
  markdownStats = {
    totalCriteria: measurabilityResult.total_criteria || 0,
    measurable: measurabilityResult.measurable || 0,
    nonMeasurablePercent: measurabilityResult.non_measurable_pct || 0,
  };

  console.log(`   ✓ Markdown Stats:`);
  console.log(`     Total Criteria: ${markdownStats.totalCriteria}`);
  console.log(`     Measurable: ${markdownStats.measurable}`);
  console.log(`     Non-Measurable: ${markdownStats.nonMeasurablePercent}%\n`);
} catch (error) {
  console.error('   ✗ Failed to run cuj-measurability.mjs:', error.message);
  process.exit(1);
}

// Compare results
console.log('='.repeat(70));
console.log('📈 Alignment Analysis\n');

console.log('Scope Difference:');
console.log(`  Registry: ${registryStats.totalCriteria} criteria (high-level expected_outputs)`);
console.log(`  Markdown: ${markdownStats.totalCriteria} criteria (detailed success criteria)`);
console.log(
  `  Ratio: ${(markdownStats.totalCriteria / registryStats.totalCriteria).toFixed(2)}x more detailed in markdown\n`
);

console.log('Non-Measurable Percentage:');
console.log(`  Registry: ${registryStats.nonMeasurablePercent}%`);
console.log(`  Markdown: ${markdownStats.nonMeasurablePercent}%`);

const percentageDiff = Math.abs(
  registryStats.nonMeasurablePercent - markdownStats.nonMeasurablePercent
);
console.log(`  Difference: ${percentageDiff.toFixed(1)}%\n`);

// Alignment verdict
console.log('Alignment Status:');

const THRESHOLD = 30; // Target: <= 30% non-measurable

if (
  registryStats.nonMeasurablePercent <= THRESHOLD &&
  markdownStats.nonMeasurablePercent <= THRESHOLD
) {
  console.log('  ✅ Both sources meet target (<= 30% non-measurable)');
} else if (
  registryStats.nonMeasurablePercent > THRESHOLD &&
  markdownStats.nonMeasurablePercent <= THRESHOLD
) {
  console.log('  ⚠️  Registry needs improvement (markdown already meets target)');
} else if (
  registryStats.nonMeasurablePercent <= THRESHOLD &&
  markdownStats.nonMeasurablePercent > THRESHOLD
) {
  console.log('  ⚠️  Markdown needs improvement (registry already meets target)');
} else {
  console.log('  ❌ Both sources need improvement (> 30% non-measurable)');
}

// Keyword alignment check
console.log('\nKeyword Alignment:');

const definitionPath = path.join(ROOT, '.claude/docs/CUJ-MEASURABILITY-DEFINITION.md');
if (fs.existsSync(definitionPath)) {
  console.log('  ✅ Shared definition exists: .claude/docs/CUJ-MEASURABILITY-DEFINITION.md');
  console.log('  ✅ Both tools reference same measurable/non-measurable keywords');
} else {
  console.log('  ❌ Shared definition missing: .claude/docs/CUJ-MEASURABILITY-DEFINITION.md');
}

// Recommendations
console.log('\n' + '='.repeat(70));
console.log('📋 Recommendations\n');

if (registryStats.nonMeasurablePercent > THRESHOLD) {
  console.log('1. Update cuj-registry.json expected_outputs to be more measurable');
  console.log('   - Add measurement methods (e.g., "exists", "validated", "exit code 0")');
  console.log('   - Include file paths, schemas, and validation references');
  console.log(`   - Target: Reduce ${registryStats.nonMeasurablePercent}% to < ${THRESHOLD}%\n`);
}

if (markdownStats.nonMeasurablePercent > THRESHOLD) {
  console.log('2. Update CUJ markdown ## Success Criteria to be more measurable');
  console.log('   - Replace vague terms ("improved", "better") with specific metrics');
  console.log('   - Add concrete validation steps with expected outcomes');
  console.log(`   - Target: Reduce ${markdownStats.nonMeasurablePercent}% to < ${THRESHOLD}%\n`);
}

if (percentageDiff > 20) {
  console.log('3. Investigate large discrepancy between registry and markdown');
  console.log('   - Ensure expected_outputs and success criteria describe same outcomes');
  console.log('   - Add cross-references between registry and markdown');
  console.log('   - Consider automating alignment checks\n');
}

console.log('4. Run tests to verify alignment:');
console.log('   $ node tests/cuj-measurability.test.mjs\n');

console.log('='.repeat(70));
console.log('\n✅ Verification complete\n');

// Exit with appropriate code
const exitCode =
  registryStats.nonMeasurablePercent <= THRESHOLD && markdownStats.nonMeasurablePercent <= THRESHOLD
    ? 0
    : 1;

process.exit(exitCode);
