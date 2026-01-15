#!/usr/bin/env node
/**
 * Rule Validator
 * Validates consolidated master files for duplicate content, completeness, and markdown structure
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RULES_DIR = path.join(__dirname, '../../.claude/rules/_core');
const VERBOSE = process.argv.includes('--verbose');

const issues = [];

/**
 * Validate a master rule file
 */
function validateMasterFile(filePath) {
  const fileName = path.basename(filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  const fileIssues = [];

  // Check for frontmatter
  if (!content.startsWith('---')) {
    fileIssues.push({
      type: 'error',
      message: 'Missing YAML frontmatter',
    });
  }

  // Check for description
  if (!content.includes('description:')) {
    fileIssues.push({
      type: 'warning',
      message: 'Missing description in frontmatter',
    });
  }

  // Check for migration notes
  if (!content.includes('Migration Notes') && !content.includes('Consolidated from')) {
    fileIssues.push({
      type: 'warning',
      message: 'Missing migration notes section',
    });
  }

  // Check markdown structure
  const headers = lines.filter(line => line.startsWith('#'));
  if (headers.length === 0) {
    fileIssues.push({
      type: 'error',
      message: 'No markdown headers found',
    });
  }

  // Check for minimum content length
  if (content.length < 1000) {
    fileIssues.push({
      type: 'warning',
      message: 'File seems too short (may be incomplete)',
    });
  }

  // Check for duplicate sections
  const sectionCounts = {};
  headers.forEach(header => {
    const section = header.trim();
    sectionCounts[section] = (sectionCounts[section] || 0) + 1;
  });

  Object.entries(sectionCounts).forEach(([section, count]) => {
    if (count > 1) {
      fileIssues.push({
        type: 'error',
        message: `Duplicate section: ${section}`,
      });
    }
  });

  if (fileIssues.length > 0) {
    issues.push({
      file: fileName,
      issues: fileIssues,
    });
  }

  return fileIssues.length === 0;
}

/**
 * Check for duplicate content across files
 */
function checkDuplicates() {
  const masterFiles = fs
    .readdirSync(RULES_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => path.join(RULES_DIR, f));

  const contents = masterFiles.map(file => ({
    file: path.basename(file),
    content: fs.readFileSync(file, 'utf8'),
  }));

  // Check for significant content overlap (>50% similarity)
  for (let i = 0; i < contents.length; i++) {
    for (let j = i + 1; j < contents.length; j++) {
      const similarity = calculateSimilarity(contents[i].content, contents[j].content);

      if (similarity > 0.5) {
        issues.push({
          file: `${contents[i].file} vs ${contents[j].file}`,
          issues: [
            {
              type: 'warning',
              message: `High content similarity: ${(similarity * 100).toFixed(1)}%`,
            },
          ],
        });
      }
    }
  }
}

/**
 * Calculate similarity between two texts (simple word-based)
 */
function calculateSimilarity(text1, text2) {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));

  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * Validate all master files
 */
function validateAll() {
  console.log('🔍 Validating master rule files...\n');

  if (!fs.existsSync(RULES_DIR)) {
    console.error(`❌ Rules directory not found: ${RULES_DIR}`);
    process.exit(1);
  }

  const masterFiles = fs
    .readdirSync(RULES_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => path.join(RULES_DIR, f));

  if (masterFiles.length === 0) {
    console.error('❌ No master rule files found');
    process.exit(1);
  }

  console.log(`Found ${masterFiles.length} master file(s)\n`);

  let allValid = true;

  masterFiles.forEach(file => {
    const valid = validateMasterFile(file);
    if (!valid) {
      allValid = false;
    }
  });

  // Check for duplicates
  checkDuplicates();

  // Report results
  if (issues.length === 0) {
    console.log('✅ All master files are valid!\n');
  } else {
    console.log(`⚠️  Found ${issues.length} issue(s):\n`);

    issues.forEach(({ file, issues: fileIssues }) => {
      console.log(`📄 ${file}:`);
      fileIssues.forEach(issue => {
        const icon = issue.type === 'error' ? '❌' : '⚠️';
        console.log(`   ${icon} ${issue.message}`);
      });
      console.log();
    });

    allValid = false;
  }

  if (VERBOSE) {
    console.log('\n📊 Summary:');
    console.log(`   Files checked: ${masterFiles.length}`);
    console.log(`   Issues found: ${issues.length}`);
  }

  process.exit(allValid ? 0 : 1);
}

// Run validation
validateAll();
