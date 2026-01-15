#!/usr/bin/env node
/**
 * Rule Migration Script
 * Automates rule consolidation, master file generation, archiving, and reference updates
 *
 * NOTE: This is a reference implementation. Actual migration should be done manually
 * with careful review to ensure no content is lost.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RULES_DIR = path.join(__dirname, '../../.claude/rules');
const LIBRARY_DIR = path.join(__dirname, '../../.claude/rules-library');
const CORE_DIR = path.join(__dirname, '../../.claude/rules/_core');

/**
 * Migration mapping: source files -> master file
 */
const MIGRATION_MAP = {
  'TECH_STACK_NEXTJS.md': [
    'typescript-nextjs-react-tailwind-supabase-cursorru',
    'nextjs15-react19-vercelai-tailwind-cursorrules-prompt-file',
    'nextjs-react-typescript-cursorrules-prompt-file',
    'nextjs-tailwind-typescript-apps-cursorrules-prompt',
    'cursor-ai-react-typescript-shadcn-ui-cursorrules-p',
    'tailwind-css-nextjs-guide-cursorrules-prompt-file',
    'typescript-nextjs-react-cursorrules-prompt-file',
    'typescript-shadcn-ui-nextjs-cursorrules-prompt-file',
  ],
  'PROTOCOL_ENGINEERING.md': [
    'code-guidelines-cursorrules-prompt-file',
    'code-style-consistency-cursorrules-prompt-file',
    'git-conventional-commit-messages',
    'github-code-quality-cursorrules-prompt-file',
    'pr-template-cursorrules-prompt-file',
    'how-to-documentation-cursorrules-prompt-file',
  ],
};

/**
 * Library mapping: patterns -> library directory (formerly archive)
 */
const LIBRARY_PATTERNS = [
  {
    pattern: /^(dragonruby|elixir|go-|unity|webassembly|salesforce|swift)/,
    category: 'niche-languages',
  },
  { pattern: /^(laravel|drupal|typo3cms|wordpress)/, category: 'unused-frameworks' },
  { pattern: /^(android-|flutter|react-native)/, category: 'mobile' },
  { pattern: /^(rails|svelte|vue-)/, category: 'other-frameworks' },
];

/**
 * Generate migration report
 */
function generateMigrationReport() {
  console.log('📋 Rule Migration Report\n');
  console.log('='.repeat(60));

  console.log('\n✅ Master Files Created:');
  const masterFiles = fs.readdirSync(CORE_DIR).filter(f => f.endsWith('.md'));
  masterFiles.forEach(file => {
    console.log(`   ✓ ${file}`);
  });

  console.log('\n📦 Files to Library:');
  if (fs.existsSync(LIBRARY_DIR)) {
    const libraryFiles = fs.readdirSync(LIBRARY_DIR);
    console.log(`   ${libraryFiles.length} directories in library (formerly archive)`);
  }

  console.log('\n📝 Next Steps:');
  console.log('   1. Review master files for completeness');
  console.log('   2. Test agent activation with new context files');
  console.log('   3. Update any remaining references to old rule files');
  console.log('   4. Monitor context usage after migration');

  console.log('\n' + '='.repeat(60));
}

/**
 * Validate migration completeness
 */
function validateMigration() {
  console.log('🔍 Validating migration...\n');

  const issues = [];

  // Check master files exist
  const requiredMasters = [
    'TECH_STACK_NEXTJS.md',
    'PROTOCOL_ENGINEERING.md',
    'TOOL_CYPRESS_MASTER.md',
    'TOOL_PLAYWRIGHT_MASTER.md',
    'LANG_PYTHON_GENERAL.md',
    'FRAMEWORK_FASTAPI.md',
    'LANG_SOLIDITY.md',
  ];

  requiredMasters.forEach(master => {
    const filePath = path.join(CORE_DIR, master);
    if (!fs.existsSync(filePath)) {
      issues.push(`Missing master file: ${master}`);
    }
  });

  // Check library directory exists
  if (!fs.existsSync(LIBRARY_DIR)) {
    issues.push('Library directory not found (formerly archive)');
  }

  // Check config.yaml has context_files
  const configPath = path.join(__dirname, '../../.claude/config.yaml');
  if (fs.existsSync(configPath)) {
    const config = fs.readFileSync(configPath, 'utf8');
    if (!config.includes('context_files:')) {
      issues.push('config.yaml missing context_files configuration');
    }
  }

  if (issues.length === 0) {
    console.log('✅ Migration validation passed!\n');
    return true;
  } else {
    console.log('⚠️  Migration validation issues:\n');
    issues.forEach(issue => console.log(`   - ${issue}`));
    return false;
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];

  if (command === 'report') {
    generateMigrationReport();
  } else if (command === 'validate') {
    validateMigration();
  } else {
    console.log('Usage: migrate-rules.mjs [report|validate]');
    console.log('\nNote: This script provides reporting and validation only.');
    console.log('Actual migration should be done manually with careful review.');
  }
}
