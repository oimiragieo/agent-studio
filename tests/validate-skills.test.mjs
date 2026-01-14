/**
 * Unit tests for skill validation in validate-config.mjs
 * Tests the skill validation logic with various field combinations
 * Uses Node.js built-in test runner (node:test)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test skill frontmatter samples
const SKILL_SAMPLES = {
  completeSkill: `---
name: test-skill
description: A test skill with all recommended fields
allowed-tools: [read, write, grep]
version: 1.0
context:fork: true
model: sonnet
---

# Test Skill Content`,

  minimalSkill: `---
name: minimal-skill
description: A skill with only required fields
---

# Minimal Skill Content`,

  missingName: `---
description: Skill without name
allowed-tools: [read]
version: 1.0
---

# Invalid Skill`,

  missingDescription: `---
name: no-description
allowed-tools: [read]
version: 1.0
---

# Invalid Skill`,

  withoutVersion: `---
name: no-version-skill
description: Skill without version field
allowed-tools: [read, write]
---

# Should produce warning`,

  withoutAllowedTools: `---
name: no-tools-skill
description: Skill without allowed-tools field
version: 1.0
---

# Should produce warning`,

  invalidContextFork: `---
name: invalid-fork
description: Skill with invalid context:fork value
context:fork: "yes"
allowed-tools: [read]
version: 1.0
---

# Should error on context:fork type`,

  invalidModel: `---
name: invalid-model
description: Skill with invalid model value
model: gpt4
allowed-tools: [read]
version: 1.0
---

# Should error on invalid model`,

  nameMismatch: `---
name: different-name
description: Skill with mismatched directory name
allowed-tools: [read]
version: 1.0
---

# Should warn on name mismatch`,

  validPhase212: `---
name: phase212-skill
description: Phase 2.1.2 enhanced skill
context:fork: true
model: haiku
allowed-tools: [read, grep, search]
version: 2.1
---

# Phase 2.1.2 skill`,
};

/**
 * Helper function to create temporary skill directory and SKILL.md file
 */
async function createTempSkill(skillName, frontmatter) {
  const tempDir = await fs.mkdtemp(path.join(tmpdir(), 'skill-test-'));
  const skillDir = path.join(tempDir, skillName);
  await fs.mkdir(skillDir, { recursive: true });
  const skillFile = path.join(skillDir, 'SKILL.md');
  await fs.writeFile(skillFile, frontmatter);
  return { tempDir, skillDir, skillFile };
}

/**
 * Helper function to validate a skill (simplified version of validate-config.mjs logic)
 */
async function validateSkill(skillName, frontmatter) {
  const errors = [];
  const warnings = [];

  try {
    // Import js-yaml dynamically (same as validate-config.mjs)
    const yaml = await import('js-yaml').then(m => m.default).catch(() => null);

    const normalizedContent = frontmatter.replace(/\r\n/g, '\n');
    if (!normalizedContent.startsWith('---\n')) {
      errors.push(`Skill ${skillName}: Missing YAML frontmatter`);
      return { errors, warnings };
    }

    const frontmatterEnd = normalizedContent.indexOf('\n---\n', 4);
    if (frontmatterEnd === -1) {
      errors.push(`Skill ${skillName}: Invalid YAML frontmatter (missing closing ---)`);
      return { errors, warnings };
    }

    const frontmatterContent = normalizedContent.substring(4, frontmatterEnd);

    if (yaml) {
      try {
        const parsed = yaml.load(frontmatterContent);

        // Check required fields (MUST have these)
        const requiredFields = ['name', 'description'];
        for (const field of requiredFields) {
          if (!parsed[field]) {
            errors.push(`Skill ${skillName}: Missing required field: ${field}`);
          }
        }

        // Check recommended fields (SHOULD have these - warnings only)
        const recommendedFields = ['allowed-tools', 'version'];
        for (const field of recommendedFields) {
          if (!parsed[field]) {
            warnings.push(`Skill ${skillName}: Missing recommended field: ${field}`);
          }
        }

        // Validate skill name matches directory name
        if (parsed.name && parsed.name !== skillName) {
          warnings.push(
            `Skill ${skillName}: Frontmatter name "${parsed.name}" doesn't match directory name`
          );
        }

        // Validate context:fork field (Phase 2.1.2)
        if (parsed['context:fork'] !== undefined) {
          if (typeof parsed['context:fork'] !== 'boolean') {
            errors.push(
              `Skill ${skillName}: context:fork must be boolean, got ${typeof parsed['context:fork']}`
            );
          }
        }

        // Validate model field (Phase 2.1.2)
        if (parsed.model !== undefined) {
          const validModels = ['haiku', 'sonnet', 'opus'];
          if (!validModels.includes(parsed.model)) {
            errors.push(
              `Skill ${skillName}: model must be one of: ${validModels.join(', ')}, got '${parsed.model}'`
            );
          }
        }
      } catch (yamlError) {
        errors.push(`Skill ${skillName}: Invalid YAML frontmatter - ${yamlError.message}`);
      }
    } else {
      // Without yaml parser, do basic checks
      const requiredFields = ['name:', 'description:'];
      for (const field of requiredFields) {
        if (!frontmatterContent.includes(field)) {
          errors.push(`Skill ${skillName}: Missing required field: ${field.replace(':', '')}`);
        }
      }

      const recommendedFields = ['allowed-tools:', 'version:'];
      for (const field of recommendedFields) {
        if (!frontmatterContent.includes(field)) {
          warnings.push(`Skill ${skillName}: Missing recommended field: ${field.replace(':', '')}`);
        }
      }
    }
  } catch (error) {
    errors.push(`Error reading skill file ${skillName}: ${error.message}`);
  }

  return { errors, warnings };
}

// Test suite
describe('Skill Validation', () => {
  describe('Required Fields Validation', () => {
    it('should pass with all required fields present', async () => {
      const { errors, warnings } = await validateSkill('test-skill', SKILL_SAMPLES.completeSkill);
      if (errors.length > 0) {
        console.error('Unexpected errors:', errors);
      }
      assert.strictEqual(errors.length, 0, 'Should have no errors');
    });

    it('should pass with only required fields (name and description)', async () => {
      const { errors, warnings } = await validateSkill('minimal-skill', SKILL_SAMPLES.minimalSkill);
      assert.strictEqual(errors.length, 0, 'Should have no errors');
      assert.ok(warnings.length > 0, 'Should have warnings for missing recommended fields');
    });

    it('should error when name is missing', async () => {
      const { errors } = await validateSkill('no-name', SKILL_SAMPLES.missingName);
      assert.ok(errors.length > 0, 'Should have errors');
      assert.ok(
        errors.some(e => e.includes('Missing required field: name')),
        'Should error on missing name'
      );
    });

    it('should error when description is missing', async () => {
      const { errors } = await validateSkill('no-description', SKILL_SAMPLES.missingDescription);
      assert.ok(errors.length > 0, 'Should have errors');
      assert.ok(
        errors.some(e => e.includes('Missing required field: description')),
        'Should error on missing description'
      );
    });
  });

  describe('Recommended Fields Validation', () => {
    it('should warn when version is missing', async () => {
      const { errors, warnings } = await validateSkill(
        'no-version-skill',
        SKILL_SAMPLES.withoutVersion
      );
      assert.strictEqual(errors.length, 0, 'Should have no errors');
      assert.ok(
        warnings.some(w => w.includes('Missing recommended field: version')),
        'Should warn about missing version'
      );
    });

    it('should warn when allowed-tools is missing', async () => {
      const { errors, warnings } = await validateSkill(
        'no-tools-skill',
        SKILL_SAMPLES.withoutAllowedTools
      );
      assert.strictEqual(errors.length, 0, 'Should have no errors');
      assert.ok(
        warnings.some(w => w.includes('Missing recommended field: allowed-tools')),
        'Should warn about missing allowed-tools'
      );
    });

    it('should warn when both version and allowed-tools are missing', async () => {
      const { errors, warnings } = await validateSkill('minimal-skill', SKILL_SAMPLES.minimalSkill);
      assert.strictEqual(errors.length, 0, 'Should have no errors');
      assert.strictEqual(warnings.length, 2, 'Should have 2 warnings');
      assert.ok(
        warnings.some(w => w.includes('Missing recommended field: version')),
        'Should warn about version'
      );
      assert.ok(
        warnings.some(w => w.includes('Missing recommended field: allowed-tools')),
        'Should warn about allowed-tools'
      );
    });
  });

  describe('Phase 2.1.2 Field Validation', () => {
    it('should error when context:fork is not boolean', async () => {
      const { errors } = await validateSkill('invalid-fork', SKILL_SAMPLES.invalidContextFork);
      assert.ok(
        errors.some(e => e.includes('context:fork must be boolean')),
        'Should error on invalid context:fork type'
      );
    });

    it('should error when model is not valid', async () => {
      const { errors } = await validateSkill('invalid-model', SKILL_SAMPLES.invalidModel);
      assert.ok(
        errors.some(e => e.includes('model must be one of: haiku, sonnet, opus')),
        'Should error on invalid model'
      );
    });

    it('should pass with valid Phase 2.1.2 fields', async () => {
      const { errors } = await validateSkill('phase212-skill', SKILL_SAMPLES.validPhase212);
      assert.strictEqual(errors.length, 0, 'Should have no errors');
    });
  });

  describe('Name Validation', () => {
    it('should warn when frontmatter name does not match directory name', async () => {
      const { errors, warnings } = await validateSkill('expected-name', SKILL_SAMPLES.nameMismatch);
      assert.strictEqual(errors.length, 0, 'Should have no errors');
      assert.ok(
        warnings.some(w => w.includes("doesn't match directory name")),
        'Should warn about name mismatch'
      );
    });

    it('should not warn when names match', async () => {
      const { warnings } = await validateSkill('test-skill', SKILL_SAMPLES.completeSkill);
      assert.ok(
        !warnings.some(w => w.includes("doesn't match directory name")),
        'Should not warn when names match'
      );
    });
  });

  describe('Error vs Warning Classification', () => {
    it('should distinguish errors from warnings', async () => {
      const { errors, warnings } = await validateSkill('minimal-skill', SKILL_SAMPLES.minimalSkill);

      // No required field errors
      assert.strictEqual(errors.length, 0, 'Should have no errors');

      // Warnings for recommended fields
      assert.ok(warnings.length > 0, 'Should have warnings');
      assert.ok(
        warnings.every(w => w.includes('Missing recommended field')),
        'All warnings should be about recommended fields'
      );
    });

    it('should have errors for truly invalid skills', async () => {
      const { errors } = await validateSkill('no-name', SKILL_SAMPLES.missingName);
      assert.ok(errors.length > 0, 'Should have errors');
      assert.ok(
        errors.some(e => e.includes('Missing required field')),
        'Should have required field errors'
      );
    });
  });

  describe('Real-World Skill Examples', () => {
    it('should validate rule-auditor pattern (complete skill)', async () => {
      const ruleAuditorPattern = `---
name: rule-auditor
description: Validates code against rules
context:fork: true
model: haiku
allowed-tools: [read, grep, glob]
version: 3.1
---

# Rule Auditor Skill`;
      const { errors, warnings } = await validateSkill('rule-auditor', ruleAuditorPattern);
      if (errors.length > 0) {
        console.error('rule-auditor errors:', errors);
      }
      if (warnings.length > 0) {
        console.warn('rule-auditor warnings:', warnings);
      }
      assert.strictEqual(errors.length, 0, 'Should have no errors');
      assert.strictEqual(warnings.length, 0, 'Should have no warnings');
    });

    it('should validate explaining-rules pattern (minimal skill)', async () => {
      const explainingRulesPattern = `---
name: explaining-rules
description: Explains which rules apply
---

# Explaining Rules Skill`;
      const { errors, warnings } = await validateSkill('explaining-rules', explainingRulesPattern);
      assert.strictEqual(errors.length, 0, 'Should have no errors');
      assert.strictEqual(warnings.length, 2, 'Should have 2 warnings for recommended fields');
    });

    it('should validate repo-rag pattern (has allowed-tools but no version)', async () => {
      const repoRagPattern = `---
name: repo-rag
description: Semantic codebase search
allowed-tools: [search, grep, read]
---

# Repo RAG Skill`;
      const { errors, warnings } = await validateSkill('repo-rag', repoRagPattern);
      assert.strictEqual(errors.length, 0, 'Should have no errors');
      assert.strictEqual(warnings.length, 1, 'Should have 1 warning for missing version');
      assert.ok(
        warnings[0].includes('Missing recommended field: version'),
        'Should warn about missing version'
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty frontmatter gracefully', async () => {
      const emptyFrontmatter = `---
---`;
      const { errors } = await validateSkill('empty-skill', emptyFrontmatter);
      assert.ok(errors.length > 0, 'Should have errors for empty frontmatter');
    });

    it('should handle malformed YAML gracefully', async () => {
      const malformedYaml = `---
name: test
description: test
invalid yaml: [
---`;
      const { errors } = await validateSkill('malformed', malformedYaml);
      assert.ok(errors.length > 0, 'Should have errors for malformed YAML');
    });

    it('should handle missing closing frontmatter marker', async () => {
      const noClosing = `---
name: test
description: test

# Content without closing marker`;
      const { errors } = await validateSkill('no-closing', noClosing);
      assert.ok(
        errors.some(e => e.includes('missing closing ---')),
        'Should error on missing closing marker'
      );
    });
  });
});

console.log('✅ Skill validation tests defined');
console.log('Run with: node --test tests/validate-skills.test.mjs');
