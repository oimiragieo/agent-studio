#!/usr/bin/env node
/**
 * CUJ Measurability Analysis
 *
 * Analyzes success criteria in CUJ MARKDOWN files for measurability.
 * Source: .claude/docs/cujs/CUJ-*.md → ## Success Criteria section
 * Complementary to: cuj-validator-unified.mjs (checks registry expected_outputs)
 * Definition: .claude/docs/CUJ-MEASURABILITY-DEFINITION.md
 *
 * Usage: node scripts/cuj-measurability.mjs [--threshold N] [--json]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '../..');

const CUJ_DIR = path.join(ROOT, '.claude/docs/cujs');

// Parse CLI args
const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
let threshold = 30;
const thresholdIdx = args.findIndex(a => a === '--threshold');
if (thresholdIdx >= 0 && args[thresholdIdx + 1]) {
  threshold = parseInt(args[thresholdIdx + 1], 10);
}

if (args.includes('--help') || args.includes('-h')) {
  console.log('Usage: node scripts/cuj-measurability.mjs [options]');
  console.log('');
  console.log('Options:');
  console.log('  --threshold N    Set non-measurable threshold (default: 30)');
  console.log('  --json           Output as JSON');
  console.log('  --help, -h       Show this help message');
  console.log('');
  console.log('Exit codes:');
  console.log('  0 - Target met (non-measurable <= threshold)');
  console.log('  1 - Target not met (non-measurable > threshold)');
  process.exit(0);
}

const files = fs.readdirSync(CUJ_DIR).filter(f => /^CUJ-\d{3}\.md$/.test(f));

const results = {
  total_cujs: files.length,
  total_criteria: 0,
  measurable: 0,
  partially_measurable: 0,
  non_measurable: 0,
  cujs: [],
};

// Patterns that indicate measurability (aligned with CUJ-MEASURABILITY-DEFINITION.md)
const measurablePatterns = [
  // File references
  /\.json/i,
  /\.md/i,
  /\.yaml/i,
  /schema/i,
  /artifact/i,
  /manifest/i,

  // Validation terms
  /validated/i,
  /validation/i,
  /passes?\s+(validation|test)/i,
  /fails?/i,
  /gates?\//i,
  /validated\s+(by|against)/i,
  /validated by gate/i,

  // Numeric/threshold
  />=?\s*\d+/i,
  /<=?\s*\d+/i,
  /score.*\d+/i,
  /\d+%/i,
  /percentage/i,
  /ratio/i,
  /rating/i,
  /count/i,
  /number/i,
  /total/i,
  /size/i,
  /time/i,
  /seconds/i,
  /minutes/i,
  /hours/i,

  // Status/boolean
  /exists/i,
  /present/i,
  /contains/i,
  /includes/i,
  /\btrue\b/i,
  /\bfalse\b/i,
  /exit\s+code/i,
  /status\s+code/i,
  /response\s+code/i,

  // Data structure
  /array/i,
  /field/i,
  /populated/i,
  /empty/i,
  /\bnull\b/i,
  /undefined/i,

  // Path references
  /\.claude\/context\//i,
  /artifact-registry/i,
  /run_id/i,
  /workflow_id/i,
];

// Patterns that indicate non-measurable criteria (aligned with CUJ-MEASURABILITY-DEFINITION.md)
const nonMeasurablePatterns = [
  /\bimproved\b/i,
  /\bfaster\b/i,
  /\bbetter\b/i,
  /\bworking\b/i,
  /\bensured?\b/i,
  /\bcorrect(?!ly)\b/i,
  /\bfunctional\b/i,
  /\bsuccessful(?!ly)\b/i,
  /\baccurate\b/i,
  /\bmet\b/i,
  /\bstandards\b/i,
  /\bquality\b/i,
  /\bclean\b/i,
  /\bmaintainable\b/i,
  /\breliable\b/i,
];

files.forEach(file => {
  const content = fs.readFileSync(path.join(CUJ_DIR, file), 'utf-8');

  const scMatch = content.match(/## Success Criteria[\s\S]*?(?=##|$)/);
  if (!scMatch) {
    results.cujs.push({
      id: file.replace('.md', ''),
      criteria_count: 0,
      measurable: 0,
      partially_measurable: 0,
      non_measurable: 0,
      measurability_score: 0,
      missing_section: true,
    });
    return;
  }

  const scSection = scMatch[0];
  const criteria = [];
  const lines = scSection.split('\n');

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;
    if (trimmed.includes('---')) return;
    if (
      trimmed.toLowerCase().includes('criterion') &&
      trimmed.toLowerCase().includes('measurement')
    )
      return;
    if (trimmed === '## Success Criteria') return;
    if (trimmed.startsWith('**')) return;
    if (trimmed.startsWith('```')) return;
    if (trimmed.startsWith('>')) return;

    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const cells = trimmed
        .split('|')
        .map(c => c.trim())
        .filter(c => c);
      if (cells.length >= 2) {
        criteria.push({ text: trimmed, format: 'table' });
      }
    } else if (trimmed.match(/^[-*]\s*\[[ x\u2705]?\]/)) {
      criteria.push({ text: trimmed, format: 'checkbox' });
    } else if (trimmed.match(/^[-*\u2705]\s+\S/)) {
      criteria.push({ text: trimmed, format: 'bullet' });
    }
  });

  let measurable = 0;
  let partially = 0;
  let nonMeasurable = 0;

  criteria.forEach(c => {
    const text = c.text;
    const hasMeasurable = measurablePatterns.some(p => p.test(text));
    const hasNonMeasurable = nonMeasurablePatterns.some(p => p.test(text));

    if (hasMeasurable && !hasNonMeasurable) {
      c.category = 'measurable';
      measurable++;
    } else if (hasMeasurable && hasNonMeasurable) {
      c.category = 'partially_measurable';
      partially++;
    } else {
      c.category = 'non_measurable';
      nonMeasurable++;
    }
  });

  results.total_criteria += criteria.length;
  results.measurable += measurable;
  results.partially_measurable += partially;
  results.non_measurable += nonMeasurable;

  results.cujs.push({
    id: file.replace('.md', ''),
    criteria_count: criteria.length,
    measurable,
    partially_measurable: partially,
    non_measurable: nonMeasurable,
    measurability_score: criteria.length > 0 ? Math.round((measurable / criteria.length) * 100) : 0,
  });
});

// Calculate percentages
results.measurable_pct =
  results.total_criteria > 0 ? Math.round((results.measurable / results.total_criteria) * 100) : 0;
results.partially_pct =
  results.total_criteria > 0
    ? Math.round((results.partially_measurable / results.total_criteria) * 100)
    : 0;
results.non_measurable_pct =
  results.total_criteria > 0
    ? Math.round((results.non_measurable / results.total_criteria) * 100)
    : 0;

// Sort by measurability (worst first)
results.cujs.sort((a, b) => a.measurability_score - b.measurability_score);

// Add summary
results.summary = {
  cujs_needing_improvement: results.cujs.filter(c => c.measurability_score < 100).length,
  cujs_fully_measurable: results.cujs.filter(c => c.measurability_score === 100).length,
  worst_cujs: results.cujs.filter(c => c.measurability_score < 50).map(c => c.id),
  threshold,
  target_met: results.non_measurable_pct <= threshold,
};

if (jsonOutput) {
  console.log(JSON.stringify(results, null, 2));
} else {
  console.log('\n\ud83d\udcca CUJ Measurability Report\n');
  console.log('='.repeat(60) + '\n');
  console.log('Summary:');
  console.log('  Total CUJs: ' + results.total_cujs);
  console.log('  Total Criteria: ' + results.total_criteria);
  console.log('  Measurable: ' + results.measurable + ' (' + results.measurable_pct + '%)');
  console.log(
    '  Partially Measurable: ' + results.partially_measurable + ' (' + results.partially_pct + '%)'
  );
  console.log(
    '  Non-Measurable: ' + results.non_measurable + ' (' + results.non_measurable_pct + '%)'
  );
  console.log('');

  const worstCujs = results.cujs.filter(c => c.measurability_score < 50);
  if (worstCujs.length > 0) {
    console.log('CUJs needing improvement (< 50% measurable):');
    worstCujs.forEach(c => {
      console.log(
        '  ' +
          c.id +
          ': ' +
          c.measurability_score +
          '% measurable (' +
          c.non_measurable +
          '/' +
          c.criteria_count +
          ' non-measurable)'
      );
    });
    console.log('');
  }

  console.log('='.repeat(60));
  if (results.non_measurable_pct <= threshold) {
    console.log(
      '\n\u2705 Target met: ' +
        results.non_measurable_pct +
        '% non-measurable (<= ' +
        threshold +
        '% threshold)\n'
    );
  } else {
    console.log(
      '\n\u274c Target not met: ' +
        results.non_measurable_pct +
        '% non-measurable (> ' +
        threshold +
        '% threshold)\n'
    );
  }
}

process.exit(results.summary.target_met ? 0 : 1);
