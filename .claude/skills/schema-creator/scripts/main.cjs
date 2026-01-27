#!/usr/bin/env node
/**
 * Schema Creator CLI
 *
 * Creates JSON Schema validation files for skills, agents, hooks, workflows, and data structures.
 *
 * Usage:
 *   node main.cjs --type input --skill my-skill
 *   node main.cjs --type output --skill my-skill
 *   node main.cjs --type global --name my-data-format
 *   node main.cjs --type definition --entity workflow
 *   node main.cjs --validate .claude/schemas/my-schema.schema.json
 *   node main.cjs --from-example example.json --output generated.schema.json
 */

const fs = require('fs');
const path = require('path');

// Find project root
function findProjectRoot() {
  let dir = __dirname;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.claude'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return process.cwd();
}

const PROJECT_ROOT = findProjectRoot();

// Schema templates
const TEMPLATES = {
  input: skillName => ({
    $schema: 'https://json-schema.org/draft-07/schema#',
    $id: `https://claude.ai/schemas/${skillName}-input`,
    title: `${toTitleCase(skillName)} Input Schema`,
    description: `Input validation schema for ${skillName} skill`,
    type: 'object',
    required: [],
    properties: {},
    additionalProperties: true,
  }),

  output: skillName => ({
    $schema: 'https://json-schema.org/draft-07/schema#',
    $id: `https://claude.ai/schemas/${skillName}-output`,
    title: `${toTitleCase(skillName)} Output Schema`,
    description: `Output validation schema for ${skillName} skill`,
    type: 'object',
    required: ['success'],
    properties: {
      success: {
        type: 'boolean',
        description: 'Whether the skill executed successfully',
      },
      result: {
        type: 'object',
        description: 'The skill execution result',
        additionalProperties: true,
      },
      error: {
        type: 'string',
        description: 'Error message if execution failed',
      },
    },
    additionalProperties: true,
  }),

  global: name => ({
    $schema: 'https://json-schema.org/draft-07/schema#',
    $id: `https://claude.ai/schemas/${name}`,
    title: `${toTitleCase(name)} Schema`,
    description: `Schema for validating ${name} data structures`,
    type: 'object',
    required: [],
    properties: {},
    additionalProperties: false,
    examples: [],
  }),

  definition: {
    agent: () => ({
      $schema: 'https://json-schema.org/draft-07/schema#',
      $id: 'https://claude.ai/schemas/agent-definition',
      title: 'Agent Definition Schema',
      description: 'Schema for validating Claude Code agent definition files',
      type: 'object',
      required: ['frontmatter', 'content'],
      properties: {
        frontmatter: {
          type: 'object',
          required: ['name', 'description'],
          properties: {
            name: {
              type: 'string',
              pattern: '^[a-z][a-z0-9-]*$',
              description: 'Agent name in lowercase-with-hyphens format',
            },
            description: {
              type: 'string',
              minLength: 20,
              maxLength: 500,
              description: 'Description of what the agent does and WHEN to use it',
            },
            tools: {
              type: 'array',
              items: { type: 'string' },
              description: 'Tools available to the agent',
            },
            model: {
              type: 'string',
              enum: ['sonnet', 'opus', 'haiku', 'inherit'],
              description: 'Model to use for the agent',
            },
            temperature: {
              type: 'number',
              minimum: 0,
              maximum: 1,
              description: 'Temperature for model responses',
            },
            skills: {
              type: 'array',
              items: { type: 'string' },
              description: 'Skills to preload for the agent',
            },
          },
        },
        content: {
          type: 'string',
          minLength: 100,
          description: 'Markdown content with agent instructions',
        },
      },
    }),

    skill: () => ({
      $schema: 'https://json-schema.org/draft-07/schema#',
      $id: 'https://claude.ai/schemas/skill-definition',
      title: 'Skill Definition Schema',
      description: 'Schema for validating Claude Code skill definitions',
      type: 'object',
      required: ['name', 'description'],
      properties: {
        name: {
          type: 'string',
          pattern: '^[a-z][a-z0-9-]*$',
          description: 'Skill name in lowercase-with-hyphens format',
        },
        description: {
          type: 'string',
          minLength: 20,
          description: 'Clear description of what the skill does',
        },
        version: {
          type: 'string',
          pattern: '^\\d+\\.\\d+(\\.\\d+)?$',
          default: '1.0.0',
          description: 'Semantic version number',
        },
        model: {
          type: 'string',
          enum: ['sonnet', 'opus', 'haiku', 'inherit'],
          description: 'Preferred model for this skill',
        },
        tools: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tools this skill uses',
        },
      },
      additionalProperties: true,
    }),

    hook: () => ({
      $schema: 'https://json-schema.org/draft-07/schema#',
      $id: 'https://claude.ai/schemas/hook-definition',
      title: 'Hook Definition Schema',
      description: 'Schema for validating Claude Code hook definitions',
      type: 'object',
      required: ['name', 'type', 'purpose'],
      properties: {
        name: {
          type: 'string',
          pattern: '^[a-z][a-z0-9-]*$',
          description: 'Hook name in lowercase-with-hyphens format',
        },
        type: {
          type: 'string',
          enum: ['PreToolUse', 'PostToolUse', 'UserPromptSubmit'],
          description: 'Hook trigger type',
        },
        purpose: {
          type: 'string',
          minLength: 10,
          maxLength: 500,
          description: 'Description of what the hook does',
        },
        matcher: {
          type: 'string',
          description: 'Regex pattern for matching tool names',
        },
      },
    }),

    workflow: () => ({
      $schema: 'https://json-schema.org/draft-07/schema#',
      $id: 'https://claude.ai/schemas/workflow-definition',
      title: 'Workflow Definition Schema',
      description: 'Schema for validating Claude Code workflow definitions',
      type: 'object',
      required: ['name', 'steps'],
      properties: {
        name: {
          type: 'string',
          pattern: '^[a-z][a-z0-9-]*$',
          description: 'Workflow name in lowercase-with-hyphens format',
        },
        description: {
          type: 'string',
          maxLength: 500,
          description: 'Description of what the workflow does',
        },
        steps: {
          type: 'array',
          minItems: 1,
          description: 'Workflow steps',
        },
      },
    }),

    custom: name => ({
      $schema: 'https://json-schema.org/draft-07/schema#',
      $id: `https://claude.ai/schemas/${name}-definition`,
      title: `${toTitleCase(name)} Definition Schema`,
      description: `Schema for validating ${name} definitions`,
      type: 'object',
      required: ['name'],
      properties: {
        name: {
          type: 'string',
          pattern: '^[a-z][a-z0-9-]*$',
          description: `${toTitleCase(name)} name in lowercase-with-hyphens format`,
        },
      },
      additionalProperties: true,
    }),
  },
};

// Utility functions
function toTitleCase(str) {
  return str
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function parseArgs(args) {
  const result = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith('--')) {
        result[key] = nextArg;
        i++;
      } else {
        result[key] = true;
      }
    }
  }
  return result;
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function writeSchema(schemaPath, schema) {
  ensureDir(path.dirname(schemaPath));
  fs.writeFileSync(schemaPath, JSON.stringify(schema, null, 2) + '\n');
  console.log(`Created: ${schemaPath}`);
}

function validateSchema(schemaPath) {
  try {
    const content = fs.readFileSync(schemaPath, 'utf8');
    const schema = JSON.parse(content);

    const errors = [];

    // Check required fields
    if (!schema.$schema) {
      errors.push({ path: '/$schema', message: 'Missing $schema field' });
    }
    if (!schema.title) {
      errors.push({ path: '/title', message: 'Missing title field' });
    }
    if (!schema.description) {
      errors.push({ path: '/description', message: 'Missing description field' });
    }

    // Check that required properties are defined
    if (schema.required && schema.properties) {
      for (const field of schema.required) {
        if (!schema.properties[field]) {
          errors.push({
            path: `/required/${field}`,
            message: `Required field "${field}" not defined in properties`,
          });
        }
      }
    }

    // Check that properties have descriptions
    if (schema.properties) {
      for (const [name, prop] of Object.entries(schema.properties)) {
        if (typeof prop === 'object' && !prop.description && !prop.$ref) {
          errors.push({
            path: `/properties/${name}`,
            message: `Property "${name}" missing description`,
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  } catch (err) {
    return {
      valid: false,
      errors: [{ path: '/', message: `Parse error: ${err.message}` }],
    };
  }
}

function generateSchemaFromExample(examplePath) {
  const content = fs.readFileSync(examplePath, 'utf8');
  const example = JSON.parse(content);

  function inferType(value) {
    if (value === null) return { type: 'null' };
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return { type: 'array', items: {} };
      }
      return { type: 'array', items: inferType(value[0]) };
    }
    if (typeof value === 'object') {
      const properties = {};
      for (const [k, v] of Object.entries(value)) {
        properties[k] = inferType(v);
      }
      return { type: 'object', properties };
    }
    return { type: typeof value };
  }

  const inferred = inferType(example);
  return {
    $schema: 'https://json-schema.org/draft-07/schema#',
    title: 'Generated Schema',
    description: `Schema generated from ${path.basename(examplePath)}`,
    ...inferred,
  };
}

// Main function
function main() {
  const args = parseArgs(process.argv.slice(2));

  // Help
  if (args.help || Object.keys(args).length === 0) {
    console.log(`
Schema Creator CLI

Usage:
  --type <type>        Schema type: input, output, global, definition
  --skill <name>       Skill name (for input/output types)
  --name <name>        Schema name (for global type)
  --entity <type>      Entity type: agent, skill, hook, workflow, custom
  --validate <path>    Validate a schema file
  --from-example <path> Generate schema from JSON example
  --output <path>      Output path for generated schema
  --help               Show this help

Examples:
  node main.cjs --type input --skill my-skill
  node main.cjs --type output --skill my-skill
  node main.cjs --type global --name my-data-format
  node main.cjs --type definition --entity workflow
  node main.cjs --validate .claude/schemas/my-schema.schema.json
  node main.cjs --from-example example.json --output generated.schema.json
`);
    return;
  }

  // Validate existing schema
  if (args.validate) {
    const schemaPath = path.resolve(PROJECT_ROOT, args.validate);
    console.log(`Validating: ${schemaPath}`);

    const result = validateSchema(schemaPath);

    if (result.valid) {
      console.log('Schema is valid');
      console.log(
        JSON.stringify(
          {
            success: true,
            action: 'validated',
            schemaPath: args.validate,
            validation: result,
          },
          null,
          2
        )
      );
    } else {
      console.error('Schema validation failed:');
      for (const err of result.errors) {
        console.error(`  ${err.path}: ${err.message}`);
      }
      console.log(
        JSON.stringify(
          {
            success: false,
            action: 'validated',
            schemaPath: args.validate,
            validation: result,
            error: `Schema validation failed with ${result.errors.length} error(s)`,
          },
          null,
          2
        )
      );
      process.exit(1);
    }
    return;
  }

  // Generate schema from example
  if (args.fromExample) {
    const examplePath = path.resolve(PROJECT_ROOT, args.fromExample);
    const outputPath = args.output
      ? path.resolve(PROJECT_ROOT, args.output)
      : path.resolve(PROJECT_ROOT, '.claude/schemas/generated.schema.json');

    console.log(`Generating schema from: ${examplePath}`);

    const schema = generateSchemaFromExample(examplePath);
    writeSchema(outputPath, schema);

    console.log(
      JSON.stringify(
        {
          success: true,
          action: 'generated',
          schemaPath: outputPath,
          schemaType: 'global',
          metadata: {
            title: schema.title,
            description: schema.description,
            propertyCount: schema.properties ? Object.keys(schema.properties).length : 0,
          },
        },
        null,
        2
      )
    );
    return;
  }

  // Create schema
  if (args.type) {
    let schema;
    let schemaPath;

    switch (args.type) {
      case 'input':
        if (!args.skill) {
          console.error('Error: --skill required for input type');
          process.exit(1);
        }
        schema = TEMPLATES.input(args.skill);
        schemaPath = path.join(
          PROJECT_ROOT,
          '.claude/skills',
          args.skill,
          'schemas/input.schema.json'
        );
        break;

      case 'output':
        if (!args.skill) {
          console.error('Error: --skill required for output type');
          process.exit(1);
        }
        schema = TEMPLATES.output(args.skill);
        schemaPath = path.join(
          PROJECT_ROOT,
          '.claude/skills',
          args.skill,
          'schemas/output.schema.json'
        );
        break;

      case 'global':
        if (!args.name) {
          console.error('Error: --name required for global type');
          process.exit(1);
        }
        schema = TEMPLATES.global(args.name);
        schemaPath = path.join(PROJECT_ROOT, '.claude/schemas', `${args.name}.schema.json`);
        break;

      case 'definition':
        const entity = args.entity || 'custom';
        const entityName = args.name || entity;
        if (TEMPLATES.definition[entity]) {
          schema =
            entity === 'custom'
              ? TEMPLATES.definition.custom(entityName)
              : TEMPLATES.definition[entity]();
        } else {
          console.error(
            `Error: Unknown entity type "${entity}". Valid: agent, skill, hook, workflow, custom`
          );
          process.exit(1);
        }
        schemaPath = path.join(
          PROJECT_ROOT,
          '.claude/schemas',
          `${entityName}-definition.schema.json`
        );
        break;

      default:
        console.error(
          `Error: Unknown type "${args.type}". Valid: input, output, global, definition`
        );
        process.exit(1);
    }

    writeSchema(schemaPath, schema);

    // Validate the created schema
    const validation = validateSchema(schemaPath);

    console.log(
      JSON.stringify(
        {
          success: true,
          action: 'created',
          schemaPath: schemaPath.replace(PROJECT_ROOT + path.sep, ''),
          schemaType: args.type,
          validation,
          metadata: {
            title: schema.title,
            description: schema.description,
            propertyCount: schema.properties ? Object.keys(schema.properties).length : 0,
            requiredCount: schema.required ? schema.required.length : 0,
          },
        },
        null,
        2
      )
    );
  }
}

main();
