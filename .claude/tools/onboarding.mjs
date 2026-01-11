#!/usr/bin/env node
/**
 * LLM-RULES Onboarding Tool
 *
 * Interactive checklist and validation tool for first-time users.
 *
 * Usage:
 *   node .claude/tools/onboarding.mjs [--check] [--interactive]
 *
 * Options:
 *   --check        Only check setup, don't run interactive mode
 *   --interactive  Run interactive onboarding checklist
 */

import { readFileSync, existsSync, statSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '../..');

const checkOnly = process.argv.includes('--check');
const interactive = process.argv.includes('--interactive') || !checkOnly;

const rl = interactive
  ? createInterface({
      input: process.stdin,
      output: process.stdout,
    })
  : null;

const checklist = {
  'Configuration Files': [
    { name: 'CLAUDE.md in project root', path: 'CLAUDE.md', required: true },
    { name: '.claude/ directory exists', path: '.claude', required: true },
    { name: '.claude/agents/ directory', path: '.claude/agents', required: true },
    { name: '.claude/skills/ directory', path: '.claude/skills', required: true },
    { name: '.claude/workflows/ directory', path: '.claude/workflows', required: true },
    { name: '.claude/config.yaml', path: '.claude/config.yaml', required: true },
  ],
  'New Features': [
    { name: 'Planner agent exists', path: '.claude/agents/planner.md', required: true },
    {
      name: 'claude-md-generator skill',
      path: '.claude/skills/claude-md-generator/SKILL.md',
      required: true,
    },
    {
      name: 'plan-generator skill',
      path: '.claude/skills/plan-generator/SKILL.md',
      required: true,
    },
    {
      name: 'diagram-generator skill',
      path: '.claude/skills/diagram-generator/SKILL.md',
      required: true,
    },
    {
      name: 'test-generator skill',
      path: '.claude/skills/test-generator/SKILL.md',
      required: true,
    },
    {
      name: 'dependency-analyzer skill',
      path: '.claude/skills/dependency-analyzer/SKILL.md',
      required: true,
    },
    { name: 'doc-generator skill', path: '.claude/skills/doc-generator/SKILL.md', required: true },
  ],
  Templates: [
    { name: 'Plan template', path: '.claude/templates/plan-template.md', required: true },
    { name: 'claude.md template', path: '.claude/templates/claude-md-template.md', required: true },
  ],
  Documentation: [
    { name: 'CUJ Index', path: '.claude/docs/cujs/CUJ-INDEX.md', required: true },
    { name: 'FIRST_TIME_USER.md', path: 'FIRST_TIME_USER.md', required: true },
  ],
  Optional: [
    { name: 'Hooks directory', path: '.claude/hooks', required: false },
    { name: 'Validation script', path: 'scripts/validate-config.mjs', required: false },
  ],
};

function checkItem(item) {
  const fullPath = resolve(rootDir, item.path);
  const exists = existsSync(fullPath);

  if (
    exists &&
    item.path.includes('/') &&
    !item.path.endsWith('.md') &&
    !item.path.endsWith('.yaml')
  ) {
    try {
      const stat = statSync(fullPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  return exists;
}

function checkCategory(categoryName, items) {
  const results = items.map(item => ({
    ...item,
    passed: checkItem(item),
  }));

  const passed = results.filter(r => r.passed).length;
  const total = items.length;
  const required = items.filter(i => i.required).length;
  const requiredPassed = results.filter(r => r.required && r.passed).length;

  return { categoryName, results, passed, total, required, requiredPassed };
}

function printResults(categoryResults) {
  console.log('\n' + '='.repeat(60));
  console.log('LLM-RULES Onboarding Checklist');
  console.log('='.repeat(60));

  let totalPassed = 0;
  let totalRequired = 0;
  let totalRequiredPassed = 0;

  for (const catResult of categoryResults) {
    console.log(`\n${catResult.categoryName}:`);
    console.log(
      `  ${catResult.requiredPassed}/${catResult.required} required, ${catResult.passed}/${catResult.total} total`
    );

    for (const item of catResult.results) {
      const status = item.passed ? '✓' : item.required ? '✗' : '○';
      const req = item.required ? '(required)' : '(optional)';
      console.log(`  ${status} ${item.name} ${req}`);

      if (!item.passed && item.required) {
        console.log(`    Missing: ${item.path}`);
      }
    }

    totalPassed += catResult.passed;
    totalRequired += catResult.required;
    totalRequiredPassed += catResult.requiredPassed;
  }

  console.log('\n' + '='.repeat(60));
  console.log('Summary:');
  console.log(`  Required items: ${totalRequiredPassed}/${totalRequired} passed`);
  console.log(`  All items: ${totalPassed}/${Object.values(checklist).flat().length} passed`);
  console.log('='.repeat(60));

  if (totalRequiredPassed === totalRequired) {
    console.log('\n✅ All required items are present! Setup looks good.');
    return true;
  } else {
    console.log('\n⚠️  Some required items are missing. Please check the list above.');
    return false;
  }
}

async function interactiveChecklist() {
  if (!rl) return;

  console.log('\nWelcome to LLM-RULES Onboarding!');
  console.log('This tool will help you verify your setup.\n');

  const categoryResults = Object.entries(checklist).map(([name, items]) =>
    checkCategory(name, items)
  );

  const allPassed = printResults(categoryResults);

  if (allPassed) {
    console.log('\n🎉 Your setup is complete! You can start using LLM-RULES.');
    console.log('\nNext steps:');
    console.log('  1. Try: /select-rules (to configure rules for your stack)');
    console.log('  2. Try: /review (to test code review)');
    console.log('  3. Read: FIRST_TIME_USER.md (for more guidance)');
    console.log('  4. Explore: .claude/docs/cujs/CUJ-INDEX.md (all user journeys)');
  } else {
    console.log('\n📝 To fix missing items:');
    console.log('  1. Ensure you copied .claude/ and CLAUDE.md to project root');
    console.log('  2. Run: pnpm validate (to check configuration)');
    console.log('  3. See: GETTING_STARTED.md (for detailed setup)');
  }

  rl.close();
}

function main() {
  const categoryResults = Object.entries(checklist).map(([name, items]) =>
    checkCategory(name, items)
  );

  if (interactive) {
    interactiveChecklist();
  } else {
    const allPassed = printResults(categoryResults);
    process.exit(allPassed ? 0 : 1);
  }
}

main();
