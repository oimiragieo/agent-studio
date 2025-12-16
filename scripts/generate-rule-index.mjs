#!/usr/bin/env node
/**
 * Rule Index Generator
 * Scans all rule files and generates a searchable index with metadata.
 * Enables Skills to discover rules dynamically without hard-coding.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

const MASTER_RULES_DIR = path.join(ROOT, '.claude/rules-master');
const ARCHIVE_DIR = path.join(ROOT, '.claude/archive');
const OUTPUT_PATH = path.join(ROOT, '.claude/context/rule-index.json');

// Technology keywords for detection
const TECH_KEYWORDS = [
  'nextjs', 'next.js', 'react', 'typescript', 'javascript', 'jsx', 'tsx',
  'python', 'fastapi', 'django', 'flask', 'pydantic',
  'cypress', 'playwright', 'jest', 'vitest', 'pytest',
  'solidity', 'ethereum', 'web3',
  'vue', 'angular', 'svelte', 'sveltekit',
  'flutter', 'react-native', 'android', 'ios', 'swift', 'kotlin',
  'nodejs', 'node.js', 'express', 'nestjs',
  'tailwind', 'css', 'scss', 'sass',
  'prisma', 'sql', 'postgresql', 'mongodb',
  'docker', 'kubernetes', 'terraform',
  'go', 'golang', 'rust', 'java', 'php', 'ruby', 'rails',
  'graphql', 'rest', 'api',
  'html', 'htmx', 'webassembly', 'wasm'
];

/**
 * Extract YAML frontmatter from markdown file
 */
function extractFrontmatter(content) {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  const metadata = {};
  
  if (frontmatterMatch) {
    const frontmatter = frontmatterMatch[1];
    frontmatter.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      
      const colonIndex = trimmed.indexOf(':');
      if (colonIndex === -1) return;
      
      const key = trimmed.substring(0, colonIndex).trim();
      let value = trimmed.substring(colonIndex + 1).trim();
      
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      
      if (key && value) {
        metadata[key] = value;
      }
    });
  }
  
  return metadata;
}

/**
 * Extract technologies from file path and content
 */
function extractTechnologies(filePath, content) {
  const found = new Set();
  const lowerPath = filePath.toLowerCase();
  const lowerContent = content.toLowerCase();
  
  TECH_KEYWORDS.forEach(tech => {
    const techLower = tech.toLowerCase();
    // Check filename/path
    if (lowerPath.includes(techLower)) {
      found.add(tech);
    }
    // Check content (first 2000 chars for performance)
    const contentPreview = lowerContent.substring(0, 2000);
    if (contentPreview.includes(techLower)) {
      found.add(tech);
    }
  });
  
  // Normalize common variations
  const normalized = new Set();
  found.forEach(tech => {
    if (tech === 'next.js') normalized.add('nextjs');
    else if (tech === 'node.js') normalized.add('nodejs');
    else normalized.add(tech);
  });
  
  return Array.from(normalized).sort();
}

/**
 * Extract rule metadata from file
 */
async function extractRuleMetadata(filePath, content) {
  const relativePath = path.relative(ROOT, filePath).replace(/\\/g, '/');
  const fileName = path.basename(filePath, path.extname(filePath));
  const metadata = extractFrontmatter(content);
  const technologies = extractTechnologies(filePath, content);
  
  return {
    path: relativePath,
    name: fileName,
    description: metadata.description || '',
    globs: metadata.globs || '',
    priority: metadata.priority || '',
    technologies,
    type: filePath.includes('rules-master') ? 'master' : 'archive',
    size: content.length,
    line_count: content.split('\n').length
  };
}

/**
 * Recursively scan directory for markdown files
 */
async function scanDirectory(dirPath, rules = []) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        await scanDirectory(fullPath, rules);
      } else if (entry.isFile() && 
                 (entry.name.endsWith('.md') || entry.name.endsWith('.mdc'))) {
        try {
          const content = await fs.readFile(fullPath, 'utf-8');
          const metadata = await extractRuleMetadata(fullPath, content);
          rules.push(metadata);
        } catch (error) {
          console.warn(`⚠️  Error reading ${fullPath}: ${error.message}`);
        }
      }
    }
  } catch (error) {
    // Directory might not exist or be inaccessible
    if (error.code !== 'ENOENT') {
      console.warn(`⚠️  Error scanning ${dirPath}: ${error.message}`);
    }
  }
  
  return rules;
}

/**
 * Build technology map from rules
 */
function buildTechnologyMap(rules) {
  const techMap = {};
  
  rules.forEach(rule => {
    rule.technologies.forEach(tech => {
      if (!techMap[tech]) {
        techMap[tech] = [];
      }
      // Store only path for efficiency
      techMap[tech].push(rule.path);
    });
  });
  
  // Sort paths for consistency
  Object.keys(techMap).forEach(tech => {
    techMap[tech].sort();
  });
  
  return techMap;
}

/**
 * Generate rule index
 */
async function generateIndex() {
  console.log('🔍 Scanning rules...\n');
  
  // Scan master rules
  const masterRules = [];
  if (await fs.access(MASTER_RULES_DIR).then(() => true).catch(() => false)) {
    await scanDirectory(MASTER_RULES_DIR, masterRules);
  }
  
  // Scan archive rules
  const archiveRules = [];
  if (await fs.access(ARCHIVE_DIR).then(() => true).catch(() => false)) {
    await scanDirectory(ARCHIVE_DIR, archiveRules);
  }
  
  const allRules = [...masterRules, ...archiveRules];
  
  if (allRules.length === 0) {
    console.error('❌ No rules found!');
    process.exit(1);
  }
  
  // Build technology map
  const technologyMap = buildTechnologyMap(allRules);
  
  // Create index structure
  const index = {
    version: '1.0.0',
    generated_at: new Date().toISOString(),
    total_rules: allRules.length,
    master_rules: masterRules.length,
    archive_rules: archiveRules.length,
    rules: allRules,
    technology_map: technologyMap
  };
  
  // Ensure output directory exists
  const outputDir = path.dirname(OUTPUT_PATH);
  await fs.mkdir(outputDir, { recursive: true });
  
  // Write index file
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(index, null, 2), 'utf-8');
  
  // Calculate approximate token count (rough estimate: 1 token ≈ 4 chars)
  const indexSize = JSON.stringify(index).length;
  const estimatedTokens = Math.ceil(indexSize / 4);
  
  console.log(`✅ Generated index with ${allRules.length} rules`);
  console.log(`   - ${masterRules.length} master rules`);
  console.log(`   - ${archiveRules.length} archive rules`);
  console.log(`   - ${Object.keys(technologyMap).length} technologies mapped`);
  console.log(`   - Index size: ~${estimatedTokens.toLocaleString()} tokens`);
  console.log(`📄 Index saved to: ${path.relative(ROOT, OUTPUT_PATH)}`);
  
  return index;
}

// Run generator
generateIndex().catch(error => {
  console.error('❌ Error generating index:', error);
  process.exit(1);
});

