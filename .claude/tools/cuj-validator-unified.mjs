#!/usr/bin/env node
/** Unified CUJ Validation Framework - Consolidates validate-cuj, cuj-doctor, and validate-cuj-e2e */

import fs from 'fs/promises';
import { existsSync, readFileSync, readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '../..');

const CUJ_DIR = path.join(ROOT, '.claude/docs/cujs');
const WORKFLOWS_DIR = path.join(ROOT, '.claude/workflows');
const SCHEMAS_DIR = path.join(ROOT, '.claude/schemas');
const SKILLS_DIR = path.join(ROOT, '.claude/skills');
const REGISTRY_PATH = path.join(ROOT, '.claude/context/cuj-registry.json');
const INDEX_PATH = path.join(ROOT, '.claude/docs/cujs/CUJ-INDEX.md');

const colors = { reset: '\x1b[0m', red: '\x1b[31m', yellow: '\x1b[33m', green: '\x1b[32m', cyan: '\x1b[36m', bold: '\x1b[1m' };

/** @class CUJValidator - Unified validation framework for CUJs */
export class CUJValidator {
  constructor(options = {}) {
    this.mode = options.mode || 'full'; // 'quick', 'dry-run', 'full', 'doctor'
    this.verbose = options.verbose || false;
    this.jsonOutput = options.json || false;
    this.fixSuggestions = options.fixSuggestions || false;
    this.performanceMetrics = options.performance || false;

    this.checks = {
      structure: true,
      references: true,
      execution: this.mode === 'full' || this.mode === 'dry-run',
      performance: this.performanceMetrics,
      systemWide: this.mode === 'doctor',
    };

    this.results = {
      timestamp: new Date().toISOString(),
      mode: this.mode,
      summary: {
        total_cujs: 0,
        passed: 0,
        failed: 0,
        warnings: 0,
      },
      details: {},
      recommendations: [],
      errors: [],
      warnings: [],
    };
  }

  /** Validate a single CUJ */
  async validate(cujId) {
    const startTime = Date.now();
    const result = {
      cuj_id: cujId,
      timestamp: new Date().toISOString(),
      mode: this.mode,
      valid: true,
      errors: [],
      warnings: [],
      info: {},
      checks: {},
    };

    this.log(`\n${'='.repeat(60)}`);
    this.log(`Validating: ${cujId}`);
    this.log('='.repeat(60));

    // Check if CUJ file exists
    const cujPath = path.join(CUJ_DIR, `${cujId}.md`);
    if (!existsSync(cujPath)) {
      result.valid = false;
      result.errors.push(`CUJ file not found: ${cujPath}`);
      return result;
    }

    try {
      const content = await fs.readFile(cujPath, 'utf-8');

      if (this.checks.structure) {
        this.log('  → Running structure validation...');
        result.checks.structure = await this.validateStructure(cujId, content);
        if (!result.checks.structure.valid) result.valid = false;
      }

      if (this.checks.references) {
        this.log('  → Running reference validation...');
        result.checks.references = await this.validateReferences(cujId, content);
        if (!result.checks.references.valid) result.valid = false;
      }

      if (this.checks.execution && this.mode !== 'quick') {
        this.log('  → Running execution validation...');
        result.checks.execution = await this.validateExecution(cujId, content);
        if (!result.checks.execution.valid) result.valid = false;
      }

      if (this.checks.performance) {
        this.log('  → Running performance validation...');
        result.checks.performance = await this.validatePerformance(cujId, content);
      }

      // Aggregate errors and warnings from checks
      for (const check of Object.values(result.checks)) {
        if (check.errors) result.errors.push(...check.errors);
        if (check.warnings) result.warnings.push(...check.warnings);
      }

      const duration = Date.now() - startTime;
      result.info.validation_duration_ms = duration;

      this.log(`\n  ${result.valid ? '✅' : '❌'} Validation ${result.valid ? 'PASSED' : 'FAILED'} (${duration}ms)`);

    } catch (error) {
      result.valid = false;
      result.errors.push(`Error during validation: ${error.message}`);
    }

    return result;
  }

  /** Validate CUJ structure */
  async validateStructure(cujId, content) {
    const result = {
      valid: true,
      errors: [],
      warnings: [],
      sections_found: [],
    };

    // Extract sections
    const sections = this.extractSections(content);
    result.sections_found = Object.keys(sections);

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

    for (const section of requiredSections) {
      if (!sections[section]) {
        result.valid = false;
        result.errors.push(`Missing required section: ${section}`);
      }
    }

    // Check for Skills or Capabilities section
    const hasSkillsOrCapabilities =
      sections['## Skills Used'] || sections['## Capabilities/Tools Used'];
    if (!hasSkillsOrCapabilities) {
      result.valid = false;
      result.errors.push('Missing required section: "## Skills Used" or "## Capabilities/Tools Used"');
    }

    // Extract and validate execution mode
    const executionMode = this.extractExecutionMode(content);
    if (!executionMode) {
      result.valid = false;
      result.errors.push('Missing execution mode declaration');
    } else {
      result.execution_mode = executionMode;

      // Check execution mode contradiction
      const hasStep0 = content.includes('## Step 0:') || content.includes('**Step 0**');
      if (executionMode === 'skill-only' && hasStep0) {
        result.valid = false;
        result.errors.push('Execution mode mismatch: skill-only CUJ has planning step (Step 0)');
      }

      // Check plan rating step for workflow CUJs
      const hasStep0_1 = content.includes('## Step 0.1:') || content.includes('**Step 0.1**');
      if (executionMode === 'workflow' && hasStep0 && !hasStep0_1) {
        result.warnings.push('Workflow CUJ has Step 0 but missing Step 0.1 (Plan Rating Gate)');
      }

      // Verify Step 0.1 contains response-rater
      if (executionMode === 'workflow' && hasStep0_1) {
        const step01Match = content.match(/## Step 0\.1:[\s\S]*?(?=## Step|$)/);
        if (step01Match) {
          const step01Content = step01Match[0];
          const hasResponseRater =
            step01Content.toLowerCase().includes('skill: response-rater') ||
            step01Content.toLowerCase().includes('response-rater');
          if (!hasResponseRater) {
            result.valid = false;
            result.errors.push(
              'Step 0.1 exists but does not contain "Skill: response-rater" - correct mechanism required'
            );
          }
        }
      }

      // Check error recovery for workflow CUJs
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

    return result;
  }

  /** Validate references */
  async validateReferences(cujId, content) {
    const result = {
      valid: true,
      errors: [],
      warnings: [],
      references: {
        workflows: [],
        schemas: [],
        skills: [],
      },
    };

    // Validate workflow references
    const rawModeMatch = content.match(/\*\*Execution Mode\*\*:\s*`?([a-z0-9-]+\.yaml)`?/i);
    if (rawModeMatch) {
      const workflowFile = rawModeMatch[1];
      const workflowName = workflowFile.replace('.yaml', '');
      const workflowPath = path.join(WORKFLOWS_DIR, `${workflowName}.yaml`);

      result.references.workflows.push(workflowFile);

      if (!existsSync(workflowPath)) {
        result.valid = false;
        result.errors.push(`Referenced workflow file does not exist: ${workflowFile}`);
      }
    }

    // Validate schema references
    const schemaMatches = content.match(/`([a-z0-9-]+\.schema\.json)`/gi) || [];
    for (const match of schemaMatches) {
      const schemaName = match.replace(/`/g, '');
      result.references.schemas.push(schemaName);

      const schemaPath = path.join(SCHEMAS_DIR, schemaName);
      if (!existsSync(schemaPath)) {
        result.valid = false;
        result.errors.push(`Schema not found: ${schemaName}`);
      }
    }

    // Validate skill references (extract from Skills Used section)
    const skillMatches = content.match(/- \*\*([a-z0-9-]+)\*\*:/gi) || [];
    for (const match of skillMatches) {
      const skillName = match.replace(/- \*\*/, '').replace(/\*\*:/, '');
      result.references.skills.push(skillName);

      const skillPath = path.join(SKILLS_DIR, skillName, 'SKILL.md');
      if (!existsSync(skillPath)) {
        result.warnings.push(`Skill not found: ${skillName}`);
      }
    }

    return result;
  }

  /** Validate execution */
  async validateExecution(cujId, content) {
    const result = {
      valid: true,
      errors: [],
      warnings: [],
      execution_type: null,
    };

    const executionMode = this.extractExecutionMode(content);

    if (executionMode === 'workflow') {
      result.execution_type = 'workflow';
      const rawModeMatch = content.match(/\*\*Execution Mode\*\*:\s*`?([a-z0-9-]+\.yaml)`?/i);

      if (rawModeMatch) {
        const workflowFile = rawModeMatch[1];
        const workflowName = workflowFile.replace('.yaml', '');
        const workflowPath = path.join(WORKFLOWS_DIR, `${workflowName}.yaml`);

        if (existsSync(workflowPath)) {
          if (this.mode === 'full') {
            // Full workflow dry-run
            try {
              execSync(`node .claude/tools/workflow_runner.js --workflow ${workflowPath} --dry-run`, {
                cwd: ROOT,
                encoding: 'utf-8',
                stdio: 'pipe',
              });
              this.log(`    ✓ Workflow dry-run passed`);
            } catch (error) {
              result.valid = false;
              result.errors.push(`Workflow dry-run failed: ${error.message}`);
            }
          } else {
            // Dry-run mode: just check workflow file exists and is valid YAML
            result.warnings.push('Dry-run mode: skipping actual workflow execution');
          }
        }
      }
    } else if (executionMode === 'skill-only') {
      result.execution_type = 'skill';
      // Check primary skill exists
      const skillMatch = content.match(/\*\*Primary Skill\*\*:\s*`?([a-z0-9-]+)`?/i);
      if (skillMatch) {
        const skillName = skillMatch[1];
        const skillPath = path.join(SKILLS_DIR, skillName, 'SKILL.md');
        if (!existsSync(skillPath)) {
          result.valid = false;
          result.errors.push(`Primary skill not found: ${skillName}`);
        }
      }
    } else if (executionMode === 'manual-setup') {
      result.execution_type = 'manual';
      result.warnings.push('Manual setup mode: no automated execution validation');
    }

    return result;
  }

  /** Validate performance */
  async validatePerformance(cujId, content) {
    const result = {
      warnings: [],
      metrics: {},
    };

    // Estimate execution time based on workflow steps
    const stepMatches = content.match(/## Step \d+(\.\d+)?:/gi) || [];
    const stepCount = stepMatches.length;

    result.metrics.estimated_steps = stepCount;
    result.metrics.estimated_duration_minutes = stepCount * 2; // Rough estimate: 2 min per step

    if (stepCount > 10) {
      result.warnings.push(`High step count (${stepCount}): May have long execution time`);
    }

    // Check for resource-intensive operations
    const resourceKeywords = ['build', 'compile', 'test', 'deploy', 'migration'];
    const resourceOps = resourceKeywords.filter(keyword =>
      content.toLowerCase().includes(keyword)
    );

    if (resourceOps.length > 0) {
      result.metrics.resource_intensive_operations = resourceOps;
      result.warnings.push(`Resource-intensive operations detected: ${resourceOps.join(', ')}`);
    }

    return result;
  }

  /** Run system-wide health check (doctor mode) */
  async runDoctorMode() {
    this.log(`\n${colors.bold}${colors.cyan}🏥 CUJ Doctor - System Health Check${colors.reset}`);
    this.log('Analyzing CUJ system...\n');

    const doctorResults = {
      critical: [],
      warnings: [],
      passed: [],
      stats: {},
    };

    // Check 1: CUJ count drift
    await this.checkCujCountDrift(doctorResults);

    // Check 2: Missing workflows
    await this.checkMissingWorkflows(doctorResults);

    // Check 3: Missing skills
    await this.checkMissingSkills(doctorResults);

    // Check 4: Broken links
    await this.checkBrokenLinks(doctorResults);

    // Check 5: Platform compatibility
    await this.checkPlatformCompatibility(doctorResults);

    // Check 6: Success criteria
    await this.checkSuccessCriteria(doctorResults);

    // Check 7: Execution modes
    await this.checkExecutionModes(doctorResults);

    // Store results
    this.results.doctor = doctorResults;
    this.results.summary.passed = doctorResults.passed.length;
    this.results.summary.failed = doctorResults.critical.length;
    this.results.summary.warnings = doctorResults.warnings.length;

    return doctorResults;
  }

  /** Check for CUJ count drift */
  async checkCujCountDrift(doctorResults) {
    this.log('📊 Checking CUJ count consistency...');

    try {
      const cujFiles = readdirSync(CUJ_DIR).filter(f => f.match(/^CUJ-\d{3}\.md$/));
      const docCount = cujFiles.length;

      const registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf-8'));
      const registryCount = registry.cujs.length;

      const indexContent = readFileSync(INDEX_PATH, 'utf-8');
      const indexMatches = indexContent.match(/\[CUJ-\d{3}(?::|])/g) || [];
      const indexCount = new Set(indexMatches.map(m => m.match(/CUJ-\d{3}/)[0])).size;

      doctorResults.stats.docCount = docCount;
      doctorResults.stats.registryCount = registryCount;
      doctorResults.stats.indexCount = indexCount;

      if (docCount === registryCount && docCount === indexCount) {
        doctorResults.passed.push(
          `CUJ counts aligned: ${docCount} docs, ${registryCount} registry, ${indexCount} index`
        );
      } else {
        const drift = [];
        if (docCount !== registryCount)
          drift.push(`Docs (${docCount}) ≠ Registry (${registryCount})`);
        if (docCount !== indexCount) drift.push(`Docs (${docCount}) ≠ Index (${indexCount})`);
        if (registryCount !== indexCount)
          drift.push(`Registry (${registryCount}) ≠ Index (${indexCount})`);

        doctorResults.critical.push(`CUJ count drift detected: ${drift.join(', ')}`);
      }

      // Check for orphaned docs
      const registryIds = new Set(registry.cujs.map(c => c.id));
      const orphanedDocs = cujFiles.filter(f => !registryIds.has(f.replace('.md', '')));
      if (orphanedDocs.length > 0) {
        doctorResults.critical.push(`Orphaned CUJ docs (not in registry): ${orphanedDocs.join(', ')}`);
      }

      // Check for missing docs
      const docIds = new Set(cujFiles.map(f => f.replace('.md', '')));
      const missingDocs = registry.cujs.filter(c => !docIds.has(c.id));
      if (missingDocs.length > 0) {
        const missingIds = missingDocs.map(c => c.id).join(', ');
        doctorResults.critical.push(`Missing CUJ docs (in registry but no file): ${missingIds}`);
      }
    } catch (error) {
      doctorResults.critical.push(`Failed to check CUJ count drift: ${error.message}`);
    }
  }

  /** Check for missing workflows */
  async checkMissingWorkflows(doctorResults) {
    this.log('🔄 Checking workflow references...');

    try {
      const registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf-8'));
      const workflowFiles = readdirSync(WORKFLOWS_DIR)
        .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
        .map(f => f.replace(/\.(yaml|yml)$/, ''));

      const missingWorkflows = new Map();

      for (const cuj of registry.cujs) {
        const workflowList = cuj.workflow ? [cuj.workflow] : cuj.workflows || [];

        if (Array.isArray(workflowList)) {
          for (const workflow of workflowList) {
            const normalizedWorkflow = workflow.replace(/^\.claude\/workflows\//, '');
            const workflowName = normalizedWorkflow.replace(/\.(yaml|yml)$/, '');

            if (!workflowFiles.includes(workflowName)) {
              if (!missingWorkflows.has(workflow)) {
                missingWorkflows.set(workflow, []);
              }
              missingWorkflows.get(workflow).push(cuj.id);
            }
          }
        }
      }

      if (missingWorkflows.size === 0) {
        doctorResults.passed.push('All workflow references valid');
      } else {
        for (const [workflow, cujIds] of missingWorkflows.entries()) {
          doctorResults.critical.push(`Missing workflow "${workflow}" referenced by: ${cujIds.join(', ')}`);
        }
      }
    } catch (error) {
      doctorResults.critical.push(`Failed to check workflow references: ${error.message}`);
    }
  }

  /** Check for missing skills */
  async checkMissingSkills(doctorResults) {
    this.log('🛠️ Checking skill references...');

    try {
      const registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf-8'));
      const skillDirs = readdirSync(SKILLS_DIR, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);

      const missingSkills = new Map();

      for (const cuj of registry.cujs) {
        const skillList = cuj.skills || cuj.required_skills || [];

        if (Array.isArray(skillList)) {
          for (const skill of skillList) {
            let skillName;
            if (typeof skill === 'string') {
              skillName = skill;
            } else if (typeof skill === 'object' && skill !== null) {
              skillName = skill.name || String(skill);
            } else {
              skillName = String(skill);
            }

            if (skillName && !skillDirs.includes(skillName)) {
              if (!missingSkills.has(skillName)) {
                missingSkills.set(skillName, []);
              }
              missingSkills.get(skillName).push(cuj.id);
            }
          }
        }
      }

      if (missingSkills.size === 0) {
        doctorResults.passed.push('All skill references valid');
      } else {
        for (const [skill, cujIds] of missingSkills.entries()) {
          doctorResults.warnings.push(`Missing skill "${skill}" referenced by: ${cujIds.join(', ')}`);
        }
      }
    } catch (error) {
      doctorResults.critical.push(`Failed to check skill references: ${error.message}`);
    }
  }

  /** Check for broken links */
  async checkBrokenLinks(doctorResults) {
    this.log('🔗 Checking for broken links...');

    try {
      const cujFiles = readdirSync(CUJ_DIR).filter(f => f.match(/^CUJ-\d{3}\.md$/));
      let totalLinks = 0;
      let brokenLinks = 0;

      for (const file of cujFiles) {
        const content = readFileSync(path.join(CUJ_DIR, file), 'utf-8');
        const cujId = file.replace('.md', '');

        // Check markdown links
        const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
        let match;

        while ((match = linkRegex.exec(content)) !== null) {
          totalLinks++;
          const linkPath = match[2];

          if (linkPath.startsWith('http://') || linkPath.startsWith('https://') || linkPath.startsWith('#')) {
            continue;
          }

          let resolvedPath = linkPath;
          if (linkPath.startsWith('.')) {
            resolvedPath = path.resolve(CUJ_DIR, linkPath);
          } else if (linkPath.startsWith('/')) {
            resolvedPath = path.join(ROOT, linkPath.substring(1));
          } else {
            resolvedPath = path.join(CUJ_DIR, linkPath);
          }

          resolvedPath = resolvedPath.split('#')[0];

          if (!existsSync(resolvedPath)) {
            brokenLinks++;
            doctorResults.warnings.push(`${cujId}: Broken link to "${linkPath}"`);
          }
        }

        // Check @-references
        const atRefRegex = /@(\.claude\/[^\s]+)/g;
        while ((match = atRefRegex.exec(content)) !== null) {
          totalLinks++;
          const refPath = match[1];
          const resolvedPath = path.join(ROOT, refPath);

          if (!existsSync(resolvedPath)) {
            brokenLinks++;
            doctorResults.warnings.push(`${cujId}: Broken @-reference to "${refPath}"`);
          }
        }
      }

      doctorResults.stats.totalLinks = totalLinks;
      doctorResults.stats.brokenLinks = brokenLinks;

      if (brokenLinks === 0) {
        doctorResults.passed.push(`All ${totalLinks} links valid`);
      }
    } catch (error) {
      doctorResults.critical.push(`Failed to check broken links: ${error.message}`);
    }
  }

  /** Check platform compatibility */
  async checkPlatformCompatibility(doctorResults) {
    this.log('🖥️ Checking platform compatibility...');

    try {
      const registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf-8'));
      const platformIssues = [];

      for (const cuj of registry.cujs) {
        if (!cuj.platform_compatibility || typeof cuj.platform_compatibility !== 'object') {
          platformIssues.push(`${cuj.id}: Missing platform_compatibility object`);
          continue;
        }

        const requiredKeys = ['claude', 'cursor', 'factory'];
        for (const key of requiredKeys) {
          if (!(key in cuj.platform_compatibility)) {
            platformIssues.push(`${cuj.id}: Missing platform_compatibility.${key}`);
          }
        }

        for (const [platform, supported] of Object.entries(cuj.platform_compatibility)) {
          if (typeof supported !== 'boolean') {
            platformIssues.push(
              `${cuj.id}: platform_compatibility.${platform} should be boolean (got ${typeof supported})`
            );
          }
        }
      }

      if (platformIssues.length === 0) {
        doctorResults.passed.push('Platform compatibility matrix consistent');
      } else {
        platformIssues.forEach(issue => doctorResults.warnings.push(issue));
      }
    } catch (error) {
      doctorResults.critical.push(`Failed to check platform compatibility: ${error.message}`);
    }
  }

  /** Check for non-measurable success criteria */
  async checkSuccessCriteria(doctorResults) {
    this.log('📏 Checking success criteria measurability...');

    try {
      const registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf-8'));
      const measurableKeywords = [
        'time', 'seconds', 'minutes', 'hours', 'count', 'number', 'total', 'size',
        'percentage', '%', 'ratio', 'score', 'rating', 'exists', 'contains', 'includes',
        'passes', 'fails', 'equal', 'greater', 'less', 'than', 'valid', 'invalid',
        'status code', 'response', 'deployed', 'running', 'coverage',
      ];

      const nonMeasurableIssues = [];
      let totalCriteria = 0;
      let measurableCriteria = 0;

      for (const cuj of registry.cujs) {
        if (!cuj.expected_outputs || !Array.isArray(cuj.expected_outputs)) {
          nonMeasurableIssues.push(`${cuj.id}: Missing expected_outputs array`);
          continue;
        }

        for (const output of cuj.expected_outputs) {
          totalCriteria++;
          const lowerOutput = output.toLowerCase();
          const isMeasurable = measurableKeywords.some(keyword => lowerOutput.includes(keyword));

          if (isMeasurable) {
            measurableCriteria++;
          } else {
            nonMeasurableIssues.push(`${cuj.id}: Non-measurable output: "${output}"`);
          }
        }
      }

      doctorResults.stats.totalCriteria = totalCriteria;
      doctorResults.stats.measurableCriteria = measurableCriteria;
      doctorResults.stats.nonMeasurablePercent =
        totalCriteria > 0 ? (((totalCriteria - measurableCriteria) / totalCriteria) * 100).toFixed(1) : 0;

      if (nonMeasurableIssues.length === 0) {
        doctorResults.passed.push(`All ${totalCriteria} success criteria measurable`);
      } else {
        const topIssues = nonMeasurableIssues.slice(0, 10);
        topIssues.forEach(issue => doctorResults.warnings.push(issue));

        if (nonMeasurableIssues.length > 10) {
          doctorResults.warnings.push(
            `... and ${nonMeasurableIssues.length - 10} more non-measurable criteria`
          );
        }
      }
    } catch (error) {
      doctorResults.critical.push(`Failed to check success criteria: ${error.message}`);
    }
  }

  /** Check execution mode consistency */
  async checkExecutionModes(doctorResults) {
    this.log('⚙️ Checking execution modes...');

    try {
      const registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf-8'));
      const validModes = ['manual-setup', 'skill-only', 'workflow', 'delegated-skill'];
      const modeIssues = [];

      for (const cuj of registry.cujs) {
        if (!cuj.execution_mode) {
          modeIssues.push(`${cuj.id}: Missing execution_mode`);
          continue;
        }

        if (!validModes.includes(cuj.execution_mode)) {
          modeIssues.push(
            `${cuj.id}: Invalid execution_mode "${cuj.execution_mode}" (expected: ${validModes.join(', ')})`
          );
        }

        if (cuj.execution_mode === 'workflow' && !cuj.workflow) {
          modeIssues.push(
            `${cuj.id}: Execution mode "workflow" but workflow field is null or missing`
          );
        }

        if (
          (cuj.execution_mode === 'skill-only' || cuj.execution_mode === 'delegated-skill') &&
          (!cuj.skills || cuj.skills.length === 0)
        ) {
          modeIssues.push(`${cuj.id}: Execution mode "${cuj.execution_mode}" but no skills defined`);
        }
      }

      if (modeIssues.length === 0) {
        doctorResults.passed.push('Execution modes consistent');
      } else {
        modeIssues.forEach(issue => doctorResults.warnings.push(issue));
      }
    } catch (error) {
      doctorResults.critical.push(`Failed to check execution modes: ${error.message}`);
    }
  }

  /** Extract sections from markdown content */
  extractSections(content) {
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

  /** Extract execution mode from CUJ content */
  extractExecutionMode(content) {
    const executionModeMatch = content.match(
      /\*\*Execution Mode\*\*:\s*`?([a-z0-9-]+\.yaml|skill-only|delegated-skill|manual-setup|manual|automated-workflow|workflow|skill)`?/i
    );
    if (executionModeMatch) {
      return this.normalizeExecutionMode(executionModeMatch[1]);
    }

    const legacyMatch = content.match(
      /(?:Workflow Reference|Workflow)[:\s]+(?:`)?([a-z0-9-]+\.yaml|skill-only|delegated-skill|manual-setup|manual|automated-workflow|workflow|skill)(?:`)?/i
    );
    if (legacyMatch) {
      return this.normalizeExecutionMode(legacyMatch[1]);
    }

    return null;
  }

  /** Normalize execution mode to schema-compliant values */
  normalizeExecutionMode(mode) {
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

    if (mode.endsWith('.yaml')) {
      return 'workflow';
    }

    return modeMap[mode] || mode;
  }

  /** Print validation result */
  printResult(result) {
    if (this.jsonOutput) return;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`CUJ Validation: ${result.cuj_id}`);
    console.log('='.repeat(60));

    if (result.info.execution_mode) {
      console.log(`Execution Mode: ${result.info.execution_mode}`);
    }

    if (result.errors.length > 0) {
      console.log(`\n${colors.red}❌ Errors (${result.errors.length}):${colors.reset}`);
      result.errors.forEach(err => console.log(`  - ${err}`));
    }

    if (result.warnings.length > 0) {
      console.log(`\n${colors.yellow}⚠️  Warnings (${result.warnings.length}):${colors.reset}`);
      result.warnings.forEach(warn => console.log(`  - ${warn}`));
    }

    console.log(`\n${'='.repeat(60)}`);

    if (result.valid) {
      if (result.warnings.length > 0) {
        console.log(`${colors.green}✅ CUJ is valid (with warnings)${colors.reset}`);
      } else {
        console.log(`${colors.green}✅ CUJ is valid${colors.reset}`);
      }
    } else {
      console.log(`${colors.red}❌ CUJ validation failed${colors.reset}`);
    }

    console.log('='.repeat(60) + '\n');
  }

  /** Print doctor mode results */
  printDoctorResults(doctorResults) {
    if (this.jsonOutput) {
      console.log(JSON.stringify(this.results, null, 2));
      return;
    }

    console.log('\n' + '='.repeat(70));
    console.log(`${colors.bold}${colors.cyan}CUJ DOCTOR REPORT${colors.reset}`);
    console.log('='.repeat(70));

    // Statistics
    if (Object.keys(doctorResults.stats).length > 0) {
      console.log(`\n${colors.bold}${colors.cyan}📊 Statistics:${colors.reset}`);
      for (const [key, value] of Object.entries(doctorResults.stats)) {
        console.log(`  ${key}: ${value}`);
      }
    }

    // Critical issues
    if (doctorResults.critical.length > 0) {
      console.log(
        `\n${colors.bold}${colors.red}❌ Critical Issues (${doctorResults.critical.length}):${colors.reset}`
      );
      doctorResults.critical.forEach(issue => {
        console.log(`  ${colors.red}• ${issue}${colors.reset}`);
      });
    }

    // Warnings
    if (doctorResults.warnings.length > 0) {
      console.log(
        `\n${colors.bold}${colors.yellow}⚠️  Warnings (${doctorResults.warnings.length}):${colors.reset}`
      );
      doctorResults.warnings.forEach(warning => {
        console.log(`  ${colors.yellow}• ${warning}${colors.reset}`);
      });
    }

    // Passed checks
    if (doctorResults.passed.length > 0) {
      console.log(
        `\n${colors.bold}${colors.green}✅ Passed Checks (${doctorResults.passed.length}):${colors.reset}`
      );
      doctorResults.passed.forEach(check => {
        console.log(`  ${colors.green}• ${check}${colors.reset}`);
      });
    }

    // Summary
    console.log('\n' + '='.repeat(70));
    const hasCritical = doctorResults.critical.length > 0;
    const statusColor = hasCritical ? colors.red : colors.green;
    const statusText = hasCritical ? 'FAILED' : 'PASSED';

    console.log(`${colors.bold}${statusColor}Status: ${statusText}${colors.reset}`);
    console.log(
      `Critical: ${doctorResults.critical.length} | Warnings: ${doctorResults.warnings.length} | Passed: ${doctorResults.passed.length}`
    );
    console.log('='.repeat(70) + '\n');
  }

  /** Log message (respects verbose mode) */
  log(message) {
    if (!this.jsonOutput && (this.verbose || this.mode === 'doctor')) {
      console.log(message);
    }
  }
}

/** CLI entry point */
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    try {
      const helpText = readFileSync(path.join(__dirname, 'help', 'cuj-validator-help.txt'), 'utf-8');
      console.log(helpText);
    } catch (error) {
      console.log('Help file not found. Run: node .claude/tools/cuj-validator-unified.mjs <CUJ-ID> [--mode quick|dry-run|full|doctor] [--json] [--verbose]');
    }
    process.exit(0);
  }

  // Parse arguments
  const mode = args.find(arg => args[args.indexOf(arg) - 1] === '--mode') || 'full';
  const verbose = args.includes('--verbose');
  const json = args.includes('--json');
  const fixSuggestions = args.includes('--fix-suggestions');
  const performance = args.includes('--performance');
  const doctor = args.includes('--doctor');

  const validator = new CUJValidator({
    mode: doctor ? 'doctor' : mode,
    verbose,
    json,
    fixSuggestions,
    performance,
  });

  try {
    if (doctor || mode === 'doctor') {
      // Doctor mode: system-wide health check
      const doctorResults = await validator.runDoctorMode();
      validator.printDoctorResults(doctorResults);

      const exitCode = doctorResults.critical.length > 0 ? 1 : 0;
      process.exit(exitCode);
    } else {
      // Single CUJ validation
      const cujId = args.find(arg => !arg.startsWith('--') && arg.match(/^CUJ-\d{3}$/));

      if (!cujId) {
        console.error('❌ Error: CUJ ID required (e.g., CUJ-005)');
        console.error('Run with --help for usage information');
        process.exit(2);
      }

      const result = await validator.validate(cujId);
      validator.printResult(result);

      // Output JSON if requested
      if (json) {
        console.log('\nJSON Output:');
        console.log(JSON.stringify(result, null, 2));
      }

      process.exit(result.valid ? 0 : 1);
    }
  } catch (error) {
    if (!json) {
      console.error('❌ Fatal error during validation:', error.message);
      console.error(error.stack);
    } else {
      console.log(
        JSON.stringify(
          {
            error: 'Fatal error',
            message: error.message,
            stack: error.stack,
          },
          null,
          2
        )
      );
    }
    process.exit(2);
  }
}

// Run if executed directly
const isMain =
  process.argv[1] &&
  (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` ||
    import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` ||
    import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/')));

if (isMain) {
  main();
}
