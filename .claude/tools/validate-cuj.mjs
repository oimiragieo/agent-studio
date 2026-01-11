#!/usr/bin/env node
/**
 * User-Facing CUJ Validation Command
 *
 * Validates a single CUJ by ID with comprehensive checks.
 *
 * Usage:
 *   node .claude/tools/validate-cuj.mjs <CUJ-ID>
 *
 * Example:
 *   node .claude/tools/validate-cuj.mjs CUJ-005
 *
 * Exit codes:
 *   0: CUJ is valid
 *   1: CUJ has validation errors
 *   2: CUJ not found or fatal error
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '../..');

const CUJ_DIR = path.join(ROOT, '.claude/docs/cujs');
const WORKFLOWS_DIR = path.join(ROOT, '.claude/workflows');
const SCHEMAS_DIR = path.join(ROOT, '.claude/schemas');
const AGENTS_DIR = path.join(ROOT, '.claude/agents');
const SKILLS_DIR = path.join(ROOT, '.claude/skills');

/**
 * Check if file exists
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Normalize execution mode to schema-compliant values
 */
function normalizeExecutionMode(mode) {
  if (!mode) return null;

  const modeMap = {
    workflow: 'workflow',
    'automated-workflow': 'workflow',
    'delegated-skill': 'skill-only',
    'skill-only': 'skill-only',
    skill: 'skill-only',
    'manual-setup': 'manual-setup',
    manual: 'manual-setup',
  };

  // Handle raw .yaml references as 'workflow'
  if (mode.endsWith('.yaml')) {
    return 'workflow';
  }

  return modeMap[mode] || mode;
}

/**
 * Extract execution mode from CUJ content
 */
function extractExecutionMode(content) {
  const executionModeMatch = content.match(
    /\*\*Execution Mode\*\*:\s*`?([a-z0-9-]+\.yaml|skill-only|delegated-skill|manual-setup|manual|automated-workflow|workflow|skill)`?/i
  );
  if (executionModeMatch) {
    return normalizeExecutionMode(executionModeMatch[1]);
  }

  // Fallback to legacy format
  const legacyMatch = content.match(
    /(?:Workflow Reference|Workflow)[:\s]+(?:`)?([a-z0-9-]+\.yaml|skill-only|delegated-skill|manual-setup|manual|automated-workflow|workflow|skill)(?:`)?/i
  );
  if (legacyMatch) {
    return normalizeExecutionMode(legacyMatch[1]);
  }

  return null;
}

/**
 * Extract sections from markdown content
 */
function extractSections(content) {
  const sections = {};
  const normalizedContent = content.replace(/\r\n/g, '\n');
  const lines = normalizedContent.split('\n');
  let currentSection = null;
  let currentContent = [];

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (currentSection) {
        sections[currentSection] = currentContent.join('\n').trim();
      }
      currentSection = line.trim();
      currentContent = [];
    } else if (currentSection) {
      currentContent.push(line);
    }
  }

  if (currentSection) {
    sections[currentSection] = currentContent.join('\n').trim();
  }

  return sections;
}

/**
 * Validate CUJ
 */
async function validateCUJ(cujId) {
  const result = {
    cujId,
    valid: true,
    errors: [],
    warnings: [],
    info: {},
  };

  // Check if CUJ file exists
  const cujPath = path.join(CUJ_DIR, `${cujId}.md`);
  if (!existsSync(cujPath)) {
    result.valid = false;
    result.errors.push(`CUJ file not found: ${cujPath}`);
    return result;
  }

  try {
    const content = await fs.readFile(cujPath, 'utf-8');
    const sections = extractSections(content);

    // Extract execution mode
    const executionMode = extractExecutionMode(content);
    if (!executionMode) {
      result.valid = false;
      result.errors.push('Missing execution mode declaration');
    } else {
      result.info.executionMode = executionMode;

      // Extract raw workflow file reference if present (separate from normalized mode)
      const rawModeMatch = content.match(/\*\*Execution Mode\*\*:\s*`?([a-z0-9-]+\.yaml)`?/i);
      const workflowFile = rawModeMatch ? rawModeMatch[1] : null;

      // Validate workflow file exists if referenced
      if (workflowFile) {
        const workflowName = workflowFile.replace('.yaml', '');
        const workflowPath = path.join(WORKFLOWS_DIR, `${workflowName}.yaml`);
        const workflowExists = await fileExists(workflowPath);
        if (!workflowExists) {
          result.valid = false;
          result.errors.push(`Referenced workflow file does not exist: ${workflowFile}`);
        }
        result.info.workflowFile = workflowFile;
      }

      // Check execution mode contradiction (use normalized mode)
      const hasStep0 = content.includes('## Step 0:') || content.includes('**Step 0**');
      if (executionMode === 'skill-only' && hasStep0) {
        result.valid = false;
        result.errors.push('Execution mode mismatch: skill-only CUJ has planning step (Step 0)');
      }

      // Check plan rating step (use normalized mode)
      const hasStep0_1 = content.includes('## Step 0.1:') || content.includes('**Step 0.1**');
      if (executionMode === 'workflow' && hasStep0 && !hasStep0_1) {
        result.warnings.push('Workflow CUJ has Step 0 but missing Step 0.1 (Plan Rating Gate)');
      }

      // Check error recovery (use normalized mode)
      if (executionMode === 'workflow') {
        const hasRecovery =
          content.toLowerCase().includes('error recovery') ||
          content.toLowerCase().includes('failure handling') ||
          content.toLowerCase().includes('retry');
        if (!hasRecovery) {
          result.warnings.push('Workflow CUJ missing error recovery steps');
        }
      }
    }

    // Validate schema references
    const schemaMatches = content.match(/`([a-z0-9-]+\.schema\.json)`/gi) || [];
    for (const match of schemaMatches) {
      const schemaName = match.replace(/`/g, '');
      const schemaPath = path.join(SCHEMAS_DIR, schemaName);
      const exists = await fileExists(schemaPath);
      if (!exists) {
        result.valid = false;
        result.errors.push(`Schema not found: ${schemaName}`);
      }
    }

    // Check required sections
    const requiredSections = [
      '## User Goal',
      '## Trigger',
      '## Workflow',
      '## Agents Used',
      '## Expected Outputs',
      '## Success Criteria',
      '## Example Prompts',
    ];

    const hasSkillsOrCapabilities =
      sections['## Skills Used'] || sections['## Capabilities/Tools Used'];

    for (const section of requiredSections) {
      if (!sections[section]) {
        result.valid = false;
        result.errors.push(`Missing required section: ${section}`);
      }
    }

    if (!hasSkillsOrCapabilities) {
      result.valid = false;
      result.errors.push(
        'Missing required section: "## Skills Used" or "## Capabilities/Tools Used"'
      );
    }
  } catch (error) {
    result.valid = false;
    result.errors.push(`Error reading CUJ file: ${error.message}`);
  }

  return result;
}

/**
 * Print validation result
 */
function printResult(result) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`CUJ Validation: ${result.cujId}`);
  console.log('='.repeat(60));

  if (result.info.executionMode) {
    console.log(`Execution Mode: ${result.info.executionMode}`);
  }

  if (result.errors.length > 0) {
    console.log(`\n❌ Errors (${result.errors.length}):`);
    result.errors.forEach(err => console.log(`  - ${err}`));
  }

  if (result.warnings.length > 0) {
    console.log(`\n⚠️  Warnings (${result.warnings.length}):`);
    result.warnings.forEach(warn => console.log(`  - ${warn}`));
  }

  console.log(`\n${'='.repeat(60)}`);

  if (result.valid) {
    if (result.warnings.length > 0) {
      console.log('✅ CUJ is valid (with warnings)');
    } else {
      console.log('✅ CUJ is valid');
    }
  } else {
    console.log('❌ CUJ validation failed');
  }

  console.log('='.repeat(60) + '\n');
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);
  const cujId = args.find(arg => !arg.startsWith('--'));

  // Show help
  if (args.includes('--help') || args.includes('-h') || !cujId) {
    console.log('Usage: node .claude/tools/validate-cuj.mjs <CUJ-ID> [options]');
    console.log('');
    console.log('Example:');
    console.log('  node .claude/tools/validate-cuj.mjs CUJ-005');
    console.log('  node .claude/tools/validate-cuj.mjs CUJ-005 --json');
    console.log('');
    console.log('Options:');
    console.log('  --json          Output results as JSON');
    console.log('  --help, -h      Show this help message');
    console.log('');
    console.log('Validates a single CUJ by ID with comprehensive checks:');
    console.log('  - Execution mode validation');
    console.log('  - Workflow/schema reference validation');
    console.log('  - Required sections validation');
    console.log('  - Execution mode contradiction checks');
    console.log('  - Plan rating step checks');
    console.log('  - Error recovery checks');
    process.exit(args.includes('--help') || args.includes('-h') ? 0 : 2);
  }

  try {
    const result = await validateCUJ(cujId);
    printResult(result);

    // Output JSON for programmatic usage
    if (process.argv.includes('--json')) {
      console.log('\nJSON Output:');
      console.log(JSON.stringify(result, null, 2));
    }

    process.exit(result.valid ? 0 : 1);
  } catch (error) {
    console.error('❌ Fatal error during validation:', error.message);
    console.error(error.stack);
    process.exit(2);
  }
}

// Run validation
main();
