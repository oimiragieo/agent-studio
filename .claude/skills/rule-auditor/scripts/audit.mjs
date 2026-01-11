#!/usr/bin/env node
/**
 * Rule Auditor - Validates code against project rules
 *
 * Usage:
 *   node audit.mjs src/components/
 *   node audit.mjs src/App.tsx --format json
 *   node audit.mjs src/ --fix-dry-run
 *   node audit.mjs src/ --fix
 *   node audit.mjs src/ --rules nextjs,typescript
 *
 * Outputs conforming JSON to skill-rule-auditor-output.schema.json
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Navigate from .claude/skills/rule-auditor/scripts to project root
const ROOT = path.resolve(__dirname, '../../../..');

/**
 * Parse command-line arguments
 */
function parseArgs(args) {
  const parsed = {
    target: args[0] || '.',
    format: 'json',
    fix: false,
    fixDryRun: false,
    rules: null,
    strict: false,
    severity: null,
  };

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--format' && args[i + 1]) {
      parsed.format = args[++i];
    } else if (arg === '--fix') {
      parsed.fix = true;
    } else if (arg === '--fix-dry-run') {
      parsed.fixDryRun = true;
    } else if (arg === '--rules' && args[i + 1]) {
      parsed.rules = args[++i].split(',').map(r => r.trim());
    } else if (arg === '--strict') {
      parsed.strict = true;
    } else if (arg === '--severity' && args[i + 1]) {
      parsed.severity = args[++i];
    }
  }

  return parsed;
}

/**
 * Load rule index
 */
async function loadRuleIndex() {
  const indexPath = path.join(ROOT, '.claude/context/rule-index.json');
  try {
    const content = await fs.readFile(indexPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to load rule index: ${error.message}`);
  }
}

/**
 * Get target files to audit
 */
async function getTargetFiles(targetPath) {
  const fullPath = path.resolve(targetPath);
  const files = [];

  async function scan(dirPath) {
    try {
      const stats = await fs.stat(dirPath);

      if (stats.isFile()) {
        // Check if it's a code file
        const ext = path.extname(dirPath);
        if (
          ['.ts', '.tsx', '.js', '.jsx', '.py', '.mjs', '.cjs', '.vue', '.svelte'].includes(ext)
        ) {
          const content = await fs.readFile(dirPath, 'utf-8');
          files.push({
            path: dirPath,
            relativePath: path.relative(ROOT, dirPath),
            content,
            lineCount: content.split('\n').length,
            extension: ext,
          });
        }
        return;
      }

      if (stats.isDirectory()) {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
          // Skip node_modules, .git, etc.
          if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') {
            continue;
          }
          await scan(path.join(dirPath, entry.name));
        }
      }
    } catch (error) {
      // Ignore permission errors, etc.
    }
  }

  await scan(fullPath);
  return files;
}

/**
 * Detect technologies from files
 */
function detectTechnologies(files) {
  const technologies = new Set();

  files.forEach(file => {
    const { extension, content, relativePath } = file;
    const lower = content.toLowerCase();
    const pathLower = relativePath.toLowerCase();

    // Extension-based detection
    if (['.tsx', '.jsx'].includes(extension)) {
      technologies.add('react');
    }
    if (['.ts', '.tsx'].includes(extension)) {
      technologies.add('typescript');
    }
    if (['.js', '.jsx', '.mjs', '.cjs'].includes(extension)) {
      technologies.add('javascript');
    }
    if (extension === '.py') {
      technologies.add('python');
    }
    if (extension === '.vue') {
      technologies.add('vue');
    }
    if (extension === '.svelte') {
      technologies.add('svelte');
    }

    // Import/content-based detection
    if (lower.includes('next') || lower.includes('next/')) {
      technologies.add('nextjs');
    }
    if (lower.includes('fastapi')) {
      technologies.add('fastapi');
    }
    if (lower.includes('cypress') || pathLower.includes('cypress')) {
      technologies.add('cypress');
    }
    if (lower.includes('playwright') || pathLower.includes('playwright')) {
      technologies.add('playwright');
    }
    if (lower.includes('tailwind')) {
      technologies.add('tailwind');
    }
  });

  return Array.from(technologies);
}

/**
 * Query technology map for relevant rules
 */
function queryTechnologyMap(ruleIndex, technologies) {
  const relevantRulePaths = new Set();

  technologies.forEach(tech => {
    const rulePaths = ruleIndex.technology_map[tech] || [];
    rulePaths.forEach(rulePath => relevantRulePaths.add(rulePath));
  });

  // Get rule metadata
  const rules = Array.from(relevantRulePaths)
    .map(rulePath => {
      return ruleIndex.rules.find(r => r.path === rulePath);
    })
    .filter(Boolean);

  // Prioritize master rules
  return rules.sort((a, b) => {
    if (a.type === 'master' && b.type !== 'master') return -1;
    if (a.type !== 'master' && b.type === 'master') return 1;
    return 0;
  });
}

/**
 * Extract frontmatter from markdown
 */
function extractFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const metadata = {};
  const frontmatter = match[1];

  frontmatter.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) return;

    const key = trimmed.substring(0, colonIndex).trim();
    let value = trimmed.substring(colonIndex + 1).trim();

    // Remove quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && value) {
      metadata[key] = value;
    }
  });

  return metadata;
}

/**
 * Extract validation patterns from rules
 */
async function extractValidationPatterns(rules) {
  const patterns = [];

  for (const rule of rules) {
    try {
      const rulePath = path.join(ROOT, rule.path);
      const content = await fs.readFile(rulePath, 'utf-8');

      // 1. Look for <validation> block (preferred)
      const validationMatch = content.match(/<validation>([\s\S]*?)<\/validation>/);
      if (validationMatch) {
        const validationBlock = validationMatch[1];

        // Parse forbidden_patterns manually (simple YAML-like parsing)
        const patternMatches = validationBlock.matchAll(
          /- pattern:\s*"([^"]+)"\s+message:\s*"([^"]+)"\s+severity:\s*"([^"]+)"(?:\s+fix:\s*"([^"]*)")?/gs
        );

        for (const match of patternMatches) {
          patterns.push({
            rule_name: rule.name,
            pattern: match[1],
            message: match[2],
            severity: match[3],
            fix: match[4] !== undefined ? match[4] : null,
          });
        }
      }

      // 2. Look for frontmatter validation
      const frontmatter = extractFrontmatter(content);
      if (frontmatter.validation) {
        // This would require YAML parsing; skip for now
        // Could add yaml-lite parsing here
      }
    } catch (error) {
      console.error(`Warning: Failed to load rule ${rule.path}: ${error.message}`);
    }
  }

  return patterns;
}

/**
 * Run validation checks
 */
function runValidation(files, patterns) {
  const violations = [];

  files.forEach(file => {
    const lines = file.content.split('\n');

    patterns.forEach(pattern => {
      try {
        const regex = new RegExp(pattern.pattern, 'g');

        lines.forEach((line, lineNum) => {
          const matches = [...line.matchAll(regex)];

          matches.forEach(match => {
            violations.push({
              file: file.relativePath,
              line: lineNum + 1,
              column: match.index + 1,
              rule: pattern.rule_name,
              severity: pattern.severity,
              message: pattern.message,
              code_snippet: line.trim(),
              fix_instruction: pattern.fix || null,
            });
          });
        });
      } catch (error) {
        console.error(`Warning: Invalid regex pattern "${pattern.pattern}": ${error.message}`);
      }
    });
  });

  return violations;
}

/**
 * Apply fixes to violations
 */
async function applyFixes(violations, files, options = {}) {
  const { dryRun = false } = options;
  const fixResults = [];

  // Group violations by file
  const byFile = {};
  violations.forEach(v => {
    if (v.fix_instruction !== null) {
      if (!byFile[v.file]) byFile[v.file] = [];
      byFile[v.file].push(v);
    }
  });

  for (const [relPath, fileViolations] of Object.entries(byFile)) {
    const filePath = path.join(ROOT, relPath);
    const file = files.find(f => f.relativePath === relPath);
    if (!file) continue;

    // Create backup
    if (!dryRun) {
      await fs.copyFile(filePath, `${filePath}.bak`);
    }

    let content = file.content;
    const lines = content.split('\n');

    // Sort by line (descending) to preserve line numbers
    const sorted = fileViolations.sort((a, b) => b.line - a.line);

    for (const violation of sorted) {
      const lineIdx = violation.line - 1;
      if (lineIdx >= lines.length) continue;

      const line = lines[lineIdx];
      const regex = new RegExp(violation.pattern, 'g');
      const fixed = line.replace(regex, violation.fix_instruction);

      fixResults.push({
        file: relPath,
        line: violation.line,
        fix_type: 'regex_replace',
        before: line,
        after: fixed,
      });

      if (!dryRun) {
        lines[lineIdx] = fixed;
      }
    }

    if (!dryRun) {
      content = lines.join('\n');
      await fs.writeFile(filePath, content, 'utf-8');
    }
  }

  return fixResults;
}

/**
 * Calculate compliance score
 */
function calculateComplianceScore(files, violations) {
  if (files.length === 0) return 100;

  const totalLines = files.reduce((sum, f) => sum + f.lineCount, 0);
  const errorCount = violations.filter(v => v.severity === 'error').length;
  const warningCount = violations.filter(v => v.severity === 'warning').length;

  // Weight errors more heavily than warnings
  const penaltyPoints = errorCount * 2 + warningCount * 1;
  const violationsPerThousandLines = (penaltyPoints / totalLines) * 1000;

  // Score decreases as violations increase
  // 0 violations = 100, 10 violations per 1k lines = 50, 20+ = 0
  const score = Math.max(0, 100 - violationsPerThousandLines * 5);

  return Math.round(score * 10) / 10; // Round to 1 decimal
}

/**
 * Format output
 */
function formatOutput(files, rules, violations, args, fixResults = []) {
  const output = {
    skill_name: 'rule-auditor',
    files_audited: files.map(f => ({
      path: f.relativePath,
      lines_analyzed: f.lineCount,
      violations_count: violations.filter(v => v.file === f.relativePath).length,
    })),
    rules_applied: rules.map(r => ({
      rule_path: r.path,
      rule_name: r.name,
      violations_found: violations.filter(v => v.rule === r.name).length,
    })),
    compliance_score: calculateComplianceScore(files, violations),
    violations_found: violations,
    rule_index_consulted: true,
    technologies_detected: detectTechnologies(files),
    audit_summary: {
      total_files: files.length,
      total_lines: files.reduce((sum, f) => sum + f.lineCount, 0),
      total_violations: violations.length,
      errors: violations.filter(v => v.severity === 'error').length,
      warnings: violations.filter(v => v.severity === 'warning').length,
      info: violations.filter(v => v.severity === 'info').length,
    },
    timestamp: new Date().toISOString(),
  };

  if (args.fix || args.fixDryRun) {
    output.fixes_applied = fixResults;
  }

  return output;
}

/**
 * Main execution
 */
async function main() {
  const args = parseArgs(process.argv.slice(2));

  try {
    // 1. Load rule index
    const ruleIndex = await loadRuleIndex();

    // 2. Get target files
    const files = await getTargetFiles(args.target);
    if (files.length === 0) {
      console.error('No files found to audit');
      process.exit(1);
    }

    // 3. Detect technologies
    const technologies = detectTechnologies(files);

    // 4. Query relevant rules
    let rules = queryTechnologyMap(ruleIndex, technologies);

    // Filter by --rules flag if provided
    if (args.rules) {
      rules = rules.filter(r => args.rules.includes(r.name.toLowerCase()));
    }

    if (rules.length === 0) {
      console.error('No rules found for detected technologies');
      process.exit(1);
    }

    // 5. Extract validation patterns
    const validationPatterns = await extractValidationPatterns(rules);

    // 6. Run validation checks
    let violations = runValidation(files, validationPatterns);

    // Filter by severity if requested
    if (args.severity) {
      violations = violations.filter(v => v.severity === args.severity);
    }

    // 7. Apply fixes if requested
    let fixResults = [];
    if (args.fix || args.fixDryRun) {
      fixResults = await applyFixes(violations, files, { dryRun: args.fixDryRun });
    }

    // 8. Output
    const output = formatOutput(files, rules, violations, args, fixResults);

    if (args.format === 'json') {
      console.log(JSON.stringify(output, null, 2));
    } else {
      // Markdown format (basic)
      console.log('## Rule Audit Report\n');
      console.log(`**Files Audited**: ${output.audit_summary.total_files}`);
      console.log(`**Compliance Score**: ${output.compliance_score}/100`);
      console.log(
        `**Violations**: ${output.audit_summary.total_violations} (${output.audit_summary.errors} errors, ${output.audit_summary.warnings} warnings)\n`
      );

      violations.forEach(v => {
        console.log(`### ${v.severity.toUpperCase()}: ${v.message}`);
        console.log(`- **File**: ${v.file}:${v.line}:${v.column}`);
        console.log(`- **Rule**: ${v.rule}`);
        console.log(`- **Code**: \`${v.code_snippet}\``);
        if (v.fix_instruction) {
          console.log(`- **Fix**: ${v.fix_instruction}`);
        }
        console.log('');
      });
    }

    // Exit with error code if violations found (and strict mode or errors present)
    const hasErrors = violations.filter(v => v.severity === 'error').length > 0;
    if (hasErrors || (args.strict && violations.length > 0)) {
      process.exit(1);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
