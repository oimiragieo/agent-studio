#!/usr/bin/env node
/**
 * Migrate CUJ registry to include skill type metadata (Issue #8)
 * Converts flat skill name arrays to structured skill objects with type information
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveConfigPath } from './context-path-resolver.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const registryReadPath = resolveConfigPath('cuj-registry.json', { read: true });
const registryWritePath = resolveConfigPath('cuj-registry.json', { read: false });

// Skill type mapping: Codex skills require CLI tools
const skillTypeMap = {
  // Codex skills (require CLI)
  'multi-ai-code-review': {
    type: 'codex',
    location: 'codex-skills/multi-ai-code-review',
    requires_cli: ['claude', 'gemini'],
  },
  'response-rater': {
    type: 'codex',
    location: 'codex-skills/response-rater',
    requires_cli: ['claude'],
  },
  // All other skills are Agent Studio skills (default)
  // These don't need explicit mapping - handled by default case
};

/**
 * Convert skill name to structured skill object
 */
function convertSkill(skillName) {
  if (typeof skillName === 'object') {
    // Already converted
    return skillName;
  }

  const codexSkill = skillTypeMap[skillName];
  if (codexSkill) {
    return {
      name: skillName,
      ...codexSkill,
    };
  }

  // Default: Agent Studio skill
  return {
    name: skillName,
    type: 'agent-studio',
    location: `.claude/skills/${skillName}`,
  };
}

/**
 * Determine CUJ skill_type based on skills array
 */
function determineSkillType(skills) {
  const hasCodex = skills.some(s => {
    const name = typeof s === 'object' ? s.name : s;
    return skillTypeMap[name] !== undefined;
  });

  const hasAgentStudio = skills.some(s => {
    const name = typeof s === 'object' ? s.name : s;
    return skillTypeMap[name] === undefined;
  });

  if (hasCodex && hasAgentStudio) {
    return 'hybrid';
  } else if (hasCodex) {
    return 'codex';
  } else {
    return 'agent-studio';
  }
}

/**
 * Migrate a single CUJ
 */
function migrateCUJ(cuj) {
  // Skip if no skills
  if (!cuj.skills || cuj.skills.length === 0) {
    return { ...cuj, skill_type: 'none' };
  }

  // Convert skills array
  const convertedSkills = cuj.skills.map(convertSkill);

  // Determine skill_type
  const skillType = determineSkillType(convertedSkills);

  return {
    ...cuj,
    skills: convertedSkills,
    skill_type: skillType,
  };
}

/**
 * Main migration function
 */
function migrateRegistry() {
  console.log('Loading CUJ registry...');
  const registry = JSON.parse(fs.readFileSync(registryReadPath, 'utf-8'));

  console.log(`Migrating ${registry.cujs.length} CUJs...`);

  let migrated = 0;
  let skipped = 0;

  const migratedCUJs = registry.cujs.map(cuj => {
    // Skip if already has skill_type (already migrated)
    if (cuj.skill_type !== undefined) {
      skipped++;
      return cuj;
    }

    migrated++;
    return migrateCUJ(cuj);
  });

  // Update registry
  const updatedRegistry = {
    ...registry,
    cujs: migratedCUJs,
  };

  // Write back to file
  console.log('Writing updated registry...');
  fs.writeFileSync(registryWritePath, JSON.stringify(updatedRegistry, null, 2));

  console.log(`✅ Migration complete!`);
  console.log(`   Migrated: ${migrated} CUJs`);
  console.log(`   Skipped: ${skipped} CUJs (already migrated)`);

  // Summary of skill types
  const skillTypeCounts = {};
  migratedCUJs.forEach(cuj => {
    const type = cuj.skill_type || 'none';
    skillTypeCounts[type] = (skillTypeCounts[type] || 0) + 1;
  });

  console.log('\nSkill Type Distribution:');
  Object.entries(skillTypeCounts).forEach(([type, count]) => {
    console.log(`   ${type}: ${count} CUJs`);
  });
}

// Run migration
try {
  migrateRegistry();
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  console.error(error.stack);
  process.exit(1);
}
