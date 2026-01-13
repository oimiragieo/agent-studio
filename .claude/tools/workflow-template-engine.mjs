/**
 * Workflow Template Substitution Engine
 * Resolves mustache-style placeholders in workflow YAML files
 *
 * @module workflow-template-engine
 * @description Template engine for workflow YAML files with placeholder substitution
 */

import yaml from 'js-yaml';
import { readFileSync, writeFileSync } from 'fs';

/**
 * Workflow Template Engine Class
 * Handles placeholder substitution in workflow YAML files
 */
export class WorkflowTemplateEngine {
  /**
   * Substitute placeholders in content
   * @param {string} content - Content with {{placeholders}}
   * @param {object} context - Substitution values
   * @returns {string} - Content with substituted values
   */
  substitute(content, context) {
    let result = content;

    // Replace {{variable}} placeholders
    for (const [key, value] of Object.entries(context)) {
      const placeholder = `{{${key}}}`;
      result = result.replaceAll(placeholder, String(value));
    }

    // Handle nested properties {{object.property}}
    const nestedPattern = /\{\{(\w+\.\w+)\}\}/g;
    result = result.replace(nestedPattern, (match, path) => {
      const parts = path.split('.');
      let value = context;
      for (const part of parts) {
        value = value?.[part];
      }
      return value !== undefined ? String(value) : match;
    });

    return result;
  }

  /**
   * Load workflow file and substitute placeholders
   * @param {string} path - Path to workflow YAML file
   * @param {object} context - Substitution context
   * @returns {object} - Parsed workflow with substitutions
   */
  loadAndSubstitute(path, context) {
    const content = readFileSync(path, 'utf8');
    const substituted = this.substitute(content, context);
    return yaml.load(substituted);
  }

  /**
   * Validate all placeholders resolved
   * @param {string} content - Content to validate
   * @throws {Error} If unresolved placeholders found
   */
  validate(content) {
    const placeholderPattern = /\{\{(\w+(?:\.\w+)?)\}\}/g;
    const matches = content.match(placeholderPattern);
    if (matches) {
      throw new Error(`Unresolved placeholders: ${matches.join(', ')}`);
    }
  }

  /**
   * Create concrete workflow from template
   * @param {string} templatePath - Path to template YAML
   * @param {string} outputPath - Path for concrete workflow
   * @param {object} context - Substitution context
   */
  createConcreteWorkflow(templatePath, outputPath, context) {
    const content = readFileSync(templatePath, 'utf8');
    const substituted = this.substitute(content, context);
    this.validate(substituted);
    writeFileSync(outputPath, substituted, 'utf8');
  }
}

/**
 * CLI entry point for template engine
 */
if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: node workflow-template-engine.mjs <template> <output> [context-json]');
    console.error(
      'Example: node workflow-template-engine.mjs template.yaml output.yaml \'{"key":"value"}\''
    );
    process.exit(1);
  }

  const [templatePath, outputPath, contextJson = '{}'] = args;
  const context = JSON.parse(contextJson);

  try {
    const engine = new WorkflowTemplateEngine();
    engine.createConcreteWorkflow(templatePath, outputPath, context);

    console.log(`✅ Created concrete workflow: ${outputPath}`);
    console.log(`📝 Substitutions applied: ${Object.keys(context).length}`);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}
