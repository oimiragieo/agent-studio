#!/usr/bin/env node
/**
 * Artifact Renderer - Deterministic Markdown rendering from JSON artifacts
 *
 * Renders human-readable Markdown from JSON artifacts using Handlebars templates
 * Ensures 100% consistency between JSON (canonical) and Markdown (derived)
 *
 * Usage:
 *   import { renderArtifact } from './artifact-renderer.mjs';
 */

import { readFile, writeFile } from 'fs/promises';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import Handlebars from 'handlebars';

/**
 * Render artifact from JSON to Markdown
 * @param {string} jsonPath - Path to JSON artifact
 * @param {string} templatePath - Path to Handlebars template (optional, will infer from artifact type)
 * @param {string} outputPath - Path to output Markdown file (optional, will infer from jsonPath)
 * @returns {Promise<string>} Path to rendered Markdown file
 */
export async function renderArtifact(jsonPath, templatePath = null, outputPath = null) {
  // Read JSON artifact
  if (!existsSync(jsonPath)) {
    throw new Error(`JSON artifact not found: ${jsonPath}`);
  }

  const jsonContent = await readFile(jsonPath, 'utf-8');
  const artifactData = JSON.parse(jsonContent);

  // Determine artifact type from filename or content
  const artifactType = inferArtifactType(jsonPath, artifactData);

  // Resolve template path
  if (!templatePath) {
    templatePath = resolveTemplatePath(artifactType);
  }

  if (!existsSync(templatePath)) {
    throw new Error(`Template not found: ${templatePath}`);
  }

  // Load template
  const templateContent = await readFile(templatePath, 'utf-8');
  const template = Handlebars.compile(templateContent);

  // Register Handlebars helpers
  registerHandlebarsHelpers();

  // Render Markdown
  const markdown = template(artifactData);

  // Resolve output path
  if (!outputPath) {
    outputPath = jsonPath.replace(/\.json$/, '.md');
  }

  // Write rendered Markdown
  await writeFile(outputPath, markdown, 'utf-8');

  return outputPath;
}

/**
 * Infer artifact type from path or content
 */
function inferArtifactType(jsonPath, artifactData) {
  const filename = jsonPath.split(/[/\\]/).pop().toLowerCase();

  // Check filename patterns
  if (filename.includes('plan')) return 'plan';
  if (filename.includes('architecture')) return 'architecture';
  if (filename.includes('prd')) return 'prd';
  if (filename.includes('test')) return 'test-plan';
  if (filename.includes('epic') || filename.includes('story')) return 'epics-stories';

  // Check content structure
  if (artifactData.phases || artifactData.tasks) return 'plan';
  if (artifactData.components || artifactData.layers) return 'architecture';
  if (artifactData.features || artifactData.requirements) return 'prd';
  if (artifactData.test_cases || artifactData.scenarios) return 'test-plan';

  return 'generic';
}

/**
 * Resolve template path for artifact type
 */
function resolveTemplatePath(artifactType) {
  const templatesDir = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    'templates',
    'renderers'
  );
  return join(templatesDir, `${artifactType}.hbs`);
}

/**
 * Register Handlebars helpers for common formatting
 */
function registerHandlebarsHelpers() {
  // Format date
  Handlebars.registerHelper('formatDate', date => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
  });

  // Format JSON
  Handlebars.registerHelper('json', obj => {
    return JSON.stringify(obj, null, 2);
  });

  // Markdown list
  Handlebars.registerHelper('list', (items, options) => {
    if (!Array.isArray(items)) return '';
    return items.map(item => `- ${options.fn(item)}`).join('\n');
  });

  // Conditional block
  Handlebars.registerHelper('ifEquals', (arg1, arg2, options) => {
    return arg1 === arg2 ? options.fn(this) : options.inverse(this);
  });

  // Join array
  Handlebars.registerHelper('join', (array, separator = ', ') => {
    if (!Array.isArray(array)) return '';
    return array.join(separator);
  });
}

/**
 * Batch render multiple artifacts
 * @param {Array} artifacts - Array of { jsonPath, templatePath?, outputPath? }
 * @returns {Promise<Array>} Array of rendered file paths
 */
export async function renderArtifacts(artifacts) {
  const results = [];
  for (const artifact of artifacts) {
    try {
      const outputPath = await renderArtifact(
        artifact.jsonPath,
        artifact.templatePath,
        artifact.outputPath
      );
      results.push({ success: true, jsonPath: artifact.jsonPath, outputPath });
    } catch (error) {
      results.push({ success: false, jsonPath: artifact.jsonPath, error: error.message });
    }
  }
  return results;
}

export default {
  renderArtifact,
  renderArtifacts,
};
