#!/usr/bin/env node
/**
 * Add missing recommended fields to skills
 * Adds version and allowed-tools fields to skills that are missing them
 */

import { readFileSync, writeFileSync } from 'fs';
import { readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '../..');
const SKILLS_DIR = join(ROOT, '.claude/skills');

// Skills that need allowed-tools (based on their functionality)
const SKILL_ALLOWED_TOOLS = {
  'explaining-rules': 'read, grep, glob, search, codebase_search',
  'fixing-rule-violations': 'read, grep, glob, search, codebase_search, edit, write',
  'migrating-rules': 'read, grep, glob, search, codebase_search, edit, write',
  'recommending-rules': 'read, grep, glob, search, codebase_search',
  'skill-manager': 'read, grep, glob, search, codebase_search, edit, write, bash',
};

function processSkill(skillDir) {
  const skillFile = join(skillDir, 'SKILL.md');
  if (!statSync(skillFile).isFile()) {
    return { updated: false, reason: 'No SKILL.md file' };
  }

  const content = readFileSync(skillFile, 'utf-8');
  const skillName = skillDir.split(/[/\\]/).pop();

  let updated = false;
  let newContent = content;

  // Check if version exists
  const hasVersion = /^version:\s/m.test(content);
  const hasAllowedTools = /^allowed-tools:\s/m.test(content);

  // Find the frontmatter section
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    return { updated: false, reason: 'No frontmatter found' };
  }

  const frontmatter = frontmatterMatch[1];
  const frontmatterEnd = frontmatterMatch.index + frontmatterMatch[0].length;

  // Build new frontmatter
  let newFrontmatter = frontmatter;

  // Add version if missing
  if (!hasVersion) {
    // Insert after description line
    const descriptionMatch = newFrontmatter.match(/^description:\s*[^\n]+/m);
    if (descriptionMatch) {
      const insertPos = descriptionMatch.index + descriptionMatch[0].length;
      newFrontmatter =
        newFrontmatter.slice(0, insertPos) + '\nversion: 1.0.0' + newFrontmatter.slice(insertPos);
      updated = true;
    } else {
      // If no description, add after name
      const nameMatch = newFrontmatter.match(/^name:\s*[^\n]+/m);
      if (nameMatch) {
        const insertPos = nameMatch.index + nameMatch[0].length;
        newFrontmatter =
          newFrontmatter.slice(0, insertPos) + '\nversion: 1.0.0' + newFrontmatter.slice(insertPos);
        updated = true;
      }
    }
  }

  // Add allowed-tools if missing
  if (!hasAllowedTools && SKILL_ALLOWED_TOOLS[skillName]) {
    // Insert after version or description
    const versionMatch = newFrontmatter.match(/^version:\s*[^\n]+/m);
    const insertAfter =
      versionMatch ||
      newFrontmatter.match(/^description:\s*[^\n]+/m) ||
      newFrontmatter.match(/^name:\s*[^\n]+/m);
    if (insertAfter) {
      const insertPos = insertAfter.index + insertAfter[0].length;
      newFrontmatter =
        newFrontmatter.slice(0, insertPos) +
        `\nallowed-tools: ${SKILL_ALLOWED_TOOLS[skillName]}` +
        newFrontmatter.slice(insertPos);
      updated = true;
    }
  } else if (!hasAllowedTools) {
    // For skills that already have allowed-tools in the list, preserve it
    // For others, we need to check what they should have
    // For now, add a default based on common patterns
    const versionMatch = newFrontmatter.match(/^version:\s*[^\n]+/m);
    const insertAfter =
      versionMatch ||
      newFrontmatter.match(/^description:\s*[^\n]+/m) ||
      newFrontmatter.match(/^name:\s*[^\n]+/m);
    if (insertAfter) {
      const insertPos = insertAfter.index + insertAfter[0].length;
      // Default: read-only tools for most skills
      newFrontmatter =
        newFrontmatter.slice(0, insertPos) +
        '\nallowed-tools: read, grep, glob, search' +
        newFrontmatter.slice(insertPos);
      updated = true;
    }
  }

  if (updated) {
    // Reconstruct the file
    newContent =
      content.slice(0, frontmatterMatch.index) +
      '---\n' +
      newFrontmatter +
      '\n---' +
      content.slice(frontmatterEnd);

    writeFileSync(skillFile, newContent, 'utf-8');
    return { updated: true, skill: skillName };
  }

  return { updated: false, skill: skillName };
}

function main() {
  console.log('Adding missing recommended fields to skills...\n');

  const skills = readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => join(SKILLS_DIR, dirent.name));

  const results = [];
  for (const skillDir of skills) {
    const result = processSkill(skillDir);
    results.push(result);
  }

  const updated = results.filter(r => r.updated);
  const skipped = results.filter(r => !r.updated);

  console.log(`✅ Updated ${updated.length} skills:`);
  updated.forEach(r => console.log(`   - ${r.skill}`));

  if (skipped.length > 0) {
    console.log(`\n⏭️  Skipped ${skipped.length} skills (already have fields or no frontmatter)`);
  }

  console.log(`\n✨ Done! Updated ${updated.length} of ${results.length} skills.`);
}

main();
