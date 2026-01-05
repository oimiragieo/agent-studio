#!/usr/bin/env node
/**
 * Skill Creator - Initialize a new Claude Code skill from template
 *
 * Usage:
 *   node create.cjs <skill-name> [options]
 *
 * Options:
 *   --path <dir>           Output directory (default: .claude/skills)
 *   --resources <list>     Comma-separated: scripts,references,assets
 *   --examples             Create example files in resource directories
 *
 * Examples:
 *   node create.cjs my-skill
 *   node create.cjs my-skill --resources scripts,references
 *   node create.cjs my-skill --resources scripts --examples
 *   node create.cjs my-skill --path /custom/location
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const MAX_SKILL_NAME_LENGTH = 64;
const ALLOWED_RESOURCES = new Set(["scripts", "references", "assets"]);

const SKILL_TEMPLATE = `---
name: {skill_name}
description: [TODO: What the skill does and WHEN to use it. Include specific triggers, file types, or tasks.]
---

# {skill_title}

[TODO: 1-2 sentences explaining what this skill enables]

## Quick Start

[TODO: Basic usage example]

## Main Workflow

[TODO: Core instructions. Choose a structure:

**Workflow-Based** (sequential processes):
- Workflow Decision Tree → Step 1 → Step 2...

**Task-Based** (tool collections):
- Quick Start → Task 1 → Task 2...

**Reference-Based** (standards/specs):
- Guidelines → Specifications → Usage...

Delete this guidance when done.]

## Resources

[TODO: Document any scripts/, references/, or assets/ if created. Delete this section if no resources.]
`;

const EXAMPLE_SCRIPT = `#!/usr/bin/env node
/**
 * Example helper script for {skill_name}
 *
 * Replace with actual implementation or delete if not needed.
 */

function main() {
  console.log("Example script for {skill_name}");
  // TODO: Add actual script logic
}

main();
`;

const EXAMPLE_REFERENCE = `# Reference Documentation

[TODO: Replace with actual reference content]

## When to Use This File

- Comprehensive API documentation
- Detailed workflow guides
- Information too lengthy for main SKILL.md
- Content needed only for specific use cases

## Structure Suggestions

### API Reference
- Overview
- Authentication
- Endpoints with examples
- Error codes

### Workflow Guide
- Prerequisites
- Step-by-step instructions
- Common patterns
- Troubleshooting
`;

const EXAMPLE_ASSET = `# Example Asset Placeholder

This placeholder represents where asset files would be stored.
Replace with actual files (templates, images, fonts) or delete.

Asset files are NOT loaded into context—they're used in output.

Common asset types:
- Templates: .pptx, .docx, boilerplate directories
- Images: .png, .jpg, .svg
- Fonts: .ttf, .otf, .woff
- Data: .csv, .json, .xml
`;

function normalizeSkillName(name) {
  let normalized = name.trim().toLowerCase();
  normalized = normalized.replace(/[^a-z0-9]+/g, "-");
  normalized = normalized.replace(/^-+|-+$/g, "");
  normalized = normalized.replace(/-{2,}/g, "-");
  return normalized;
}

function titleCase(skillName) {
  return skillName
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function parseArgs(argv) {
  const args = {
    skillName: null,
    path: ".claude/skills",
    resources: [],
    examples: false,
    test: true, // Test after creation by default
    noTest: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--path") args.path = argv[++i];
    else if (token === "--resources") {
      const raw = argv[++i] || "";
      args.resources = raw
        .split(",")
        .map((r) => r.trim().toLowerCase())
        .filter(Boolean);
    } else if (token === "--examples") args.examples = true;
    else if (token === "--test") args.test = true;
    else if (token === "--no-test") args.noTest = true;
    else if (token === "--help" || token === "-h") args.help = true;
    else if (!token.startsWith("-") && !args.skillName) args.skillName = token;
  }

  // --no-test overrides default
  if (args.noTest) args.test = false;

  return args;
}

function usage(exitCode = 0) {
  console.log(`
Skill Creator - Initialize a new Claude Code skill

Usage:
  node create.cjs <skill-name> [options]

Options:
  --path <dir>           Output directory (default: .claude/skills)
  --resources <list>     Comma-separated: scripts,references,assets
  --examples             Create example files in resource directories
  --no-test              Skip validation test after creation
  --help                 Show this help

Testing:
  After creation, the skill is automatically validated (structure check).
  New skills will show [TODO] warnings - this is expected.
  Use --no-test to skip validation.

Examples:
  node create.cjs my-skill
  node create.cjs my-skill --resources scripts,references
  node create.cjs my-skill --resources scripts,references,assets --examples
  node create.cjs my-skill --path /custom/location
  node create.cjs my-skill --no-test
`);
  process.exit(exitCode);
}

function createResourceDirs(skillDir, skillName, resources, includeExamples) {
  for (const resource of resources) {
    const resourceDir = path.join(skillDir, resource);
    fs.mkdirSync(resourceDir, { recursive: true });

    if (resource === "scripts") {
      if (includeExamples) {
        const examplePath = path.join(resourceDir, "example.cjs");
        fs.writeFileSync(
          examplePath,
          EXAMPLE_SCRIPT.replace(/{skill_name}/g, skillName)
        );
        console.log("[OK] Created scripts/example.cjs");
      } else {
        console.log("[OK] Created scripts/");
      }
    } else if (resource === "references") {
      if (includeExamples) {
        const examplePath = path.join(resourceDir, "api-reference.md");
        fs.writeFileSync(examplePath, EXAMPLE_REFERENCE);
        console.log("[OK] Created references/api-reference.md");
      } else {
        console.log("[OK] Created references/");
      }
    } else if (resource === "assets") {
      if (includeExamples) {
        const examplePath = path.join(resourceDir, "example-asset.txt");
        fs.writeFileSync(examplePath, EXAMPLE_ASSET);
        console.log("[OK] Created assets/example-asset.txt");
      } else {
        console.log("[OK] Created assets/");
      }
    }
  }
}

function createSkill(skillName, outputPath, resources, includeExamples) {
  const skillDir = path.resolve(outputPath, skillName);

  // Check if exists
  if (fs.existsSync(skillDir)) {
    console.error(`[ERROR] Skill directory already exists: ${skillDir}`);
    return null;
  }

  // Create skill directory
  try {
    fs.mkdirSync(skillDir, { recursive: true });
    console.log(`[OK] Created skill directory: ${skillDir}`);
  } catch (e) {
    console.error(`[ERROR] Error creating directory: ${e.message}`);
    return null;
  }

  // Create SKILL.md
  const skillTitle = titleCase(skillName);
  const skillContent = SKILL_TEMPLATE.replace(/{skill_name}/g, skillName).replace(
    /{skill_title}/g,
    skillTitle
  );

  const skillMdPath = path.join(skillDir, "SKILL.md");
  try {
    fs.writeFileSync(skillMdPath, skillContent);
    console.log("[OK] Created SKILL.md");
  } catch (e) {
    console.error(`[ERROR] Error creating SKILL.md: ${e.message}`);
    return null;
  }

  // Create resource directories
  if (resources.length > 0) {
    try {
      createResourceDirs(skillDir, skillName, resources, includeExamples);
    } catch (e) {
      console.error(`[ERROR] Error creating resources: ${e.message}`);
      return null;
    }
  }

  // Print next steps
  console.log(`\n[OK] Skill '${skillName}' initialized at ${skillDir}`);
  console.log("\nNext steps:");
  console.log("1. Edit SKILL.md - complete TODO items and update description");
  if (resources.length > 0) {
    if (includeExamples) {
      console.log("2. Customize or delete example files in resource directories");
    } else {
      console.log("2. Add resources to scripts/, references/, assets/ as needed");
    }
  } else {
    console.log("2. Create resource directories only if needed");
  }
  console.log("3. Run validate.cjs to verify after editing");

  return skillDir;
}

function runTest(skillPath) {
  const testScript = path.join(__dirname, "test.cjs");

  console.log(`\n[TEST] Validating skill structure...`);

  const result = spawnSync("node", [testScript, skillPath], {
    stdio: "inherit",
    shell: true,
    timeout: 30000,
  });

  if (result.status === 0) {
    return { passed: true };
  } else {
    return { passed: false, exitCode: result.status };
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) usage(0);
  if (!args.skillName) {
    console.error("[ERROR] Skill name is required");
    usage(1);
  }

  // Normalize skill name
  const rawName = args.skillName;
  const skillName = normalizeSkillName(rawName);

  if (!skillName) {
    console.error("[ERROR] Skill name must include at least one letter or digit");
    process.exit(1);
  }

  if (skillName.length > MAX_SKILL_NAME_LENGTH) {
    console.error(
      `[ERROR] Skill name '${skillName}' is too long (${skillName.length} chars). Max: ${MAX_SKILL_NAME_LENGTH}`
    );
    process.exit(1);
  }

  if (skillName !== rawName) {
    console.log(`Note: Normalized skill name from '${rawName}' to '${skillName}'`);
  }

  // Validate resources
  const invalidResources = args.resources.filter((r) => !ALLOWED_RESOURCES.has(r));
  if (invalidResources.length > 0) {
    console.error(
      `[ERROR] Unknown resource type(s): ${invalidResources.join(", ")}`
    );
    console.error(`   Allowed: ${[...ALLOWED_RESOURCES].join(", ")}`);
    process.exit(1);
  }

  if (args.examples && args.resources.length === 0) {
    console.error("[ERROR] --examples requires --resources to be set");
    process.exit(1);
  }

  // Dedupe resources
  const resources = [...new Set(args.resources)];

  console.log(`Initializing skill: ${skillName}`);
  console.log(`   Location: ${args.path}`);
  if (resources.length > 0) {
    console.log(`   Resources: ${resources.join(", ")}`);
    if (args.examples) console.log("   Examples: enabled");
  } else {
    console.log("   Resources: none (create as needed)");
  }
  console.log();

  const skillDir = createSkill(skillName, args.path, resources, args.examples);

  if (!skillDir) {
    process.exit(1);
  }

  // Run validation tests automatically unless --no-test
  if (args.test) {
    const testResult = runTest(skillDir);
    if (!testResult.passed) {
      console.log(`\n[NOTE] Validation shows warnings - this is expected for new skills.`);
      console.log(`       Complete the TODO items in SKILL.md to fix them.`);
    }
  }

  process.exit(0);
}

main();
