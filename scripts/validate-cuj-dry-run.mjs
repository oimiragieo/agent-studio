#!/usr/bin/env node
/**
 * CUJ Dry-Run Validation Script
 * 
 * Validates CUJs without mutating .claude/context/ directory.
 * CI-safe and fast for automated validation.
 * 
 * This script:
 * - Resolves workflow/schema/template paths without executing
 * - Checks required artifacts/outputs exist in workflow definitions
 * - Verifies agent/skill references without creating runs/artifacts
 * - Validates CUJ structure without side effects
 * 
 * Usage:
 *   node scripts/validate-cuj-dry-run.mjs [--verbose]
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

const CUJ_DIR = path.join(ROOT, '.claude/docs/cujs');
const WORKFLOWS_DIR = path.join(ROOT, '.claude/workflows');
const SCHEMAS_DIR = path.join(ROOT, '.claude/schemas');
const AGENTS_DIR = path.join(ROOT, '.claude/agents');
const SKILLS_DIR = path.join(ROOT, '.claude/skills');
const TEMPLATES_DIR = path.join(ROOT, '.claude/templates');

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
 * Resolve workflow path
 */
function resolveWorkflowPath(workflowName) {
  if (workflowName === 'skill-only') {
    return { exists: true, path: null, type: 'skill-only' };
  }
  
  const workflowPath = path.join(WORKFLOWS_DIR, `${workflowName}.yaml`);
  return { exists: null, path: workflowPath, type: 'workflow' };
}

/**
 * Resolve schema path
 */
function resolveSchemaPath(schemaName) {
  const schemaPath = path.join(SCHEMAS_DIR, `${schemaName}.schema.json`);
  return { exists: null, path: schemaPath, type: 'schema' };
}

/**
 * Extract execution mode from CUJ content
 */
function extractExecutionMode(content) {
  const executionModeMatch = content.match(/\*\*Execution Mode\*\*:\s*`?([a-z0-9-]+\.yaml|skill-only|manual-setup|manual)`?/i);
  if (executionModeMatch) {
    return executionModeMatch[1];
  }

  // Fallback to legacy format
  const legacyMatch = content.match(/(?:Workflow Reference|Workflow)[:\s]+(?:`)?([a-z0-9-]+\.yaml|skill-only|manual-setup|manual)(?:`)?/i);
  if (legacyMatch) {
    return legacyMatch[1];
  }

  return null;
}

/**
 * Extract sections from markdown content
 */
function extractSections(content) {
  const sections = {};
  // Normalize line endings (handle both LF and CRLF)
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
 * Extract agent references from content
 */
function extractAgentReferences(content) {
  const agents = new Set();
  
  // Backticked agents
  const backtickMatches = content.match(/`([a-z-]+)`/g) || [];
  backtickMatches.forEach(m => {
    const slug = m.replace(/`/g, '').trim();
    if (slug && slug !== 'none' && slug !== 'agents') {
      agents.add(slug);
    }
  });
  
  return Array.from(agents);
}

/**
 * Extract skill references from content
 */
function extractSkillReferences(content) {
  const skills = new Set();
  
  // Backticked skills
  const backtickMatches = content.match(/`([a-z-]+)`/g) || [];
  backtickMatches.forEach(m => {
    const slug = m.replace(/`/g, '').trim();
    if (slug && slug !== 'none') {
      skills.add(slug);
    }
  });
  
  return Array.from(skills);
}

/**
 * Validate a single CUJ file (dry-run)
 */
async function validateCUJDryRun(filePath) {
  const fileName = path.basename(filePath);
  const issues = [];
  const warnings = [];
  
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const sections = extractSections(content);
    
    // Extract execution mode
    const executionMode = extractExecutionMode(content);
    if (!executionMode) {
      issues.push('Missing execution mode declaration');
    } else if (executionMode !== 'skill-only' && executionMode !== 'manual-setup' && executionMode !== 'manual') {
      // Validate workflow file exists
      const workflowName = executionMode.replace('.yaml', '');
      const workflowPath = path.join(WORKFLOWS_DIR, `${workflowName}.yaml`);
      const workflowExists = await fileExists(workflowPath);
      if (!workflowExists) {
        issues.push(`Referenced workflow file does not exist: ${executionMode} (checked ${workflowPath})`);
      }
    }
    
    // Validate agent references
    if (sections['## Agents Used']) {
      const agentRefs = extractAgentReferences(sections['## Agents Used']);
      for (const agentRef of agentRefs) {
        const agentPath = path.join(AGENTS_DIR, `${agentRef}.md`);
        const agentExists = await fileExists(agentPath);
        if (!agentExists) {
          warnings.push(`Agent reference may not exist: ${agentRef} (checked ${agentPath})`);
        }
      }
    }
    
    // Validate skill references
    if (sections['## Skills Used']) {
      const skillRefs = extractSkillReferences(sections['## Skills Used']);
      for (const skillRef of skillRefs) {
        const skillPath = path.join(SKILLS_DIR, skillRef, 'SKILL.md');
        const skillExists = await fileExists(skillPath);
        if (!skillExists) {
          warnings.push(`Skill reference may not exist: ${skillRef} (checked ${skillPath})`);
        }
      }
    }
    
    // Check for required sections
    const requiredSections = [
      '## User Goal',
      '## Trigger',
      '## Workflow',
      '## Agents Used',
      '## Expected Outputs',
      '## Success Criteria',
      '## Example Prompts'
    ];
    
    const hasSkillsOrCapabilities = sections['## Skills Used'] || sections['## Capabilities/Tools Used'];
    
    for (const section of requiredSections) {
      if (section === '## Skills Used') {
        // Skip - checked separately
        continue;
      }
      if (!sections[section]) {
        issues.push(`Missing required section: ${section}`);
      }
    }
    
    if (!hasSkillsOrCapabilities) {
      issues.push('Missing required section: "## Skills Used" or "## Capabilities/Tools Used"');
    }
    
    return {
      file: fileName,
      issues,
      warnings,
      valid: issues.length === 0
    };
    
  } catch (error) {
    return {
      file: fileName,
      issues: [`Error reading file: ${error.message}`],
      warnings: [],
      valid: false
    };
  }
}

/**
 * Main validation function
 */
async function validateAllCUJsDryRun() {
  console.log('🔍 Validating CUJ files (DRY-RUN - no mutations)...\n');
  
  try {
    const files = await fs.readdir(CUJ_DIR);
    // Only match CUJ-XXX.md where XXX is a 3-digit number (e.g., CUJ-001.md)
    // This excludes CUJ-INDEX.md, CUJ-AUDIT-REPORT.md, CUJ-EXECUTION-EXAMPLES.md, etc.
    const cujFiles = files.filter(f => /^CUJ-\d{3}\.md$/.test(f));

    console.log(`Found ${cujFiles.length} CUJ files to validate\n`);
    
    const results = [];
    for (const file of cujFiles.sort()) {
      const filePath = path.join(CUJ_DIR, file);
      const result = await validateCUJDryRun(filePath);
      results.push(result);
    }
    
    // Report results
    let totalIssues = 0;
    let totalWarnings = 0;
    let validCount = 0;
    
    for (const result of results) {
      if (result.valid) {
        validCount++;
        if (result.warnings.length > 0) {
          console.log(`⚠️  ${result.file} (valid with warnings)`);
          result.warnings.forEach(w => console.log(`   - ${w}`));
        }
      } else {
        console.log(`❌ ${result.file}`);
        result.issues.forEach(i => console.log(`   - ${i}`));
        result.warnings.forEach(w => console.log(`   ⚠️  ${w}`));
      }
      totalIssues += result.issues.length;
      totalWarnings += result.warnings.length;
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Summary (DRY-RUN):`);
    console.log(`  ✅ Valid: ${validCount}/${results.length}`);
    console.log(`  ❌ Issues: ${totalIssues}`);
    console.log(`  ⚠️  Warnings: ${totalWarnings}`);
    console.log(`${'='.repeat(60)}\n`);
    
    if (totalIssues > 0) {
      console.log('💡 This is a dry-run validation. No files were modified.');
      process.exit(1);
    } else if (totalWarnings > 0) {
      console.log('All CUJs are valid, but some have warnings.');
      console.log('💡 This is a dry-run validation. No files were modified.');
      process.exit(0);
    } else {
      console.log('✅ All CUJs are valid!');
      console.log('💡 This is a dry-run validation. No files were modified.');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('❌ Error during validation:', error);
    process.exit(1);
  }
}

// CLI interface
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log('Usage: node scripts/validate-cuj-dry-run.mjs [--verbose]');
  console.log('');
  console.log('Validates all CUJ files without mutating .claude/context/');
  console.log('CI-safe and fast for automated validation.');
  console.log('');
  console.log('This script:');
  console.log('  - Resolves workflow/schema/template paths without executing');
  console.log('  - Checks required artifacts/outputs exist in workflow definitions');
  console.log('  - Verifies agent/skill references without creating runs/artifacts');
  console.log('  - Validates CUJ structure without side effects');
  process.exit(0);
}

// Run validation
validateAllCUJsDryRun();

