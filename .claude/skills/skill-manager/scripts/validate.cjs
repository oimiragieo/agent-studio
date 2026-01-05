#!/usr/bin/env node
/**
 * Skill Validator - Validate Claude Code skill structure
 *
 * Usage:
 *   node validate.cjs <skill-path> [options]
 *
 * Options:
 *   --strict       Fail on TODO placeholders
 *   --json         Output as JSON
 *
 * Examples:
 *   node validate.cjs .claude/skills/my-skill
 *   node validate.cjs .claude/skills/my-skill --strict
 */

const fs = require("fs");
const path = require("path");

const MAX_SKILL_NAME_LENGTH = 64;
const MAX_DESCRIPTION_LENGTH = 1024;
const ALLOWED_FRONTMATTER_KEYS = new Set([
  "name",
  "description",
  "license",
  "allowed-tools",
  "metadata",
  "version",
  "streaming",
  "templates",
  "best_practices",
  "error_handling",
]);

function parseArgs(argv) {
  const args = {
    skillPath: null,
    strict: false,
    json: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--strict") args.strict = true;
    else if (token === "--json") args.json = true;
    else if (token === "--help" || token === "-h") args.help = true;
    else if (!token.startsWith("-") && !args.skillPath) args.skillPath = token;
  }

  return args;
}

function usage(exitCode = 0) {
  console.log(`
Skill Validator - Validate Claude Code skill structure

Usage:
  node validate.cjs <skill-path> [options]

Options:
  --strict       Fail on TODO placeholders
  --json         Output as JSON
  --help         Show this help

Examples:
  node validate.cjs .claude/skills/my-skill
  node validate.cjs .claude/skills/my-skill --strict
`);
  process.exit(exitCode);
}

function parseYamlFrontmatter(content) {
  // Simple YAML parser for frontmatter (handles basic key: value pairs)
  // Normalize line endings (Windows \r\n -> \n, old Mac \r -> \n)
  const normalizedContent = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalizedContent.split("\n");
  const result = {};
  let currentKey = null;
  let multilineValue = [];
  let inMultiline = false;

  for (const line of lines) {
    // Check for key: value
    const keyMatch = line.match(/^([a-z-]+):\s*(.*)$/i);
    if (keyMatch) {
      // Save previous multiline if any
      if (currentKey && inMultiline) {
        result[currentKey] = multilineValue.join("\n").trim();
      }

      currentKey = keyMatch[1].toLowerCase();
      const value = keyMatch[2].trim();

      if (value) {
        result[currentKey] = value;
        inMultiline = false;
      } else {
        // Start multiline
        inMultiline = true;
        multilineValue = [];
      }
    } else if (inMultiline && line.startsWith("  ")) {
      multilineValue.push(line.slice(2));
    } else if (inMultiline && line.trim() === "") {
      multilineValue.push("");
    }
  }

  // Save last multiline
  if (currentKey && inMultiline) {
    result[currentKey] = multilineValue.join("\n").trim();
  }

  return result;
}

function validateSkill(skillPath, options = {}) {
  const errors = [];
  const warnings = [];
  const resolvedPath = path.resolve(skillPath);

  // Check skill directory exists
  if (!fs.existsSync(resolvedPath)) {
    return {
      valid: false,
      errors: [`Skill directory not found: ${resolvedPath}`],
      warnings: [],
    };
  }

  if (!fs.statSync(resolvedPath).isDirectory()) {
    return {
      valid: false,
      errors: [`Path is not a directory: ${resolvedPath}`],
      warnings: [],
    };
  }

  // Check SKILL.md exists
  const skillMdPath = path.join(resolvedPath, "SKILL.md");
  if (!fs.existsSync(skillMdPath)) {
    return {
      valid: false,
      errors: ["SKILL.md not found"],
      warnings: [],
    };
  }

  const content = fs.readFileSync(skillMdPath, "utf8");

  // Check frontmatter exists
  if (!content.startsWith("---")) {
    errors.push("No YAML frontmatter found (must start with ---)");
    return { valid: false, errors, warnings };
  }

  // Extract frontmatter (handle both Unix and Windows line endings)
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatterMatch) {
    errors.push("Invalid frontmatter format (missing closing ---)");
    return { valid: false, errors, warnings };
  }

  const frontmatterText = frontmatterMatch[1];
  let frontmatter;

  try {
    frontmatter = parseYamlFrontmatter(frontmatterText);
  } catch (e) {
    errors.push(`Invalid YAML in frontmatter: ${e.message}`);
    return { valid: false, errors, warnings };
  }

  // Check for unexpected keys
  const keys = Object.keys(frontmatter);
  const unexpectedKeys = keys.filter((k) => !ALLOWED_FRONTMATTER_KEYS.has(k));
  if (unexpectedKeys.length > 0) {
    errors.push(
      `Unexpected key(s) in frontmatter: ${unexpectedKeys.join(", ")}. Allowed: ${[...ALLOWED_FRONTMATTER_KEYS].join(", ")}`
    );
  }

  // Check required fields
  if (!frontmatter.name) {
    errors.push("Missing 'name' in frontmatter");
  }

  if (!frontmatter.description) {
    errors.push("Missing 'description' in frontmatter");
  }

  // Validate name format
  const name = (frontmatter.name || "").trim();
  if (name) {
    if (!/^[a-z0-9-]+$/.test(name)) {
      errors.push(
        `Name '${name}' should be hyphen-case (lowercase letters, digits, hyphens only)`
      );
    }

    if (name.startsWith("-") || name.endsWith("-") || name.includes("--")) {
      errors.push(
        `Name '${name}' cannot start/end with hyphen or contain consecutive hyphens`
      );
    }

    if (name.length > MAX_SKILL_NAME_LENGTH) {
      errors.push(
        `Name is too long (${name.length} chars). Maximum: ${MAX_SKILL_NAME_LENGTH}`
      );
    }

    // Check folder name matches
    const folderName = path.basename(resolvedPath);
    if (folderName !== name) {
      warnings.push(
        `Folder name '${folderName}' doesn't match skill name '${name}'`
      );
    }
  }

  // Validate description
  const description = (frontmatter.description || "").trim();
  if (description) {
    if (description.includes("<") || description.includes(">")) {
      errors.push("Description cannot contain angle brackets (< or >)");
    }

    if (description.length > MAX_DESCRIPTION_LENGTH) {
      errors.push(
        `Description is too long (${description.length} chars). Maximum: ${MAX_DESCRIPTION_LENGTH}`
      );
    }

    // Check for placeholder
    if (description.includes("[TODO:") || description === "[TODO]") {
      if (options.strict) {
        errors.push("Description contains TODO placeholder");
      } else {
        warnings.push("Description contains TODO placeholder");
      }
    }
  }

  // Check for TODO placeholders in body (strict mode)
  const body = content.slice(frontmatterMatch[0].length);
  if (options.strict && body.includes("[TODO:")) {
    const todoCount = (body.match(/\[TODO:/g) || []).length;
    errors.push(`SKILL.md body contains ${todoCount} TODO placeholder(s)`);
  } else if (body.includes("[TODO:")) {
    const todoCount = (body.match(/\[TODO:/g) || []).length;
    warnings.push(`SKILL.md body contains ${todoCount} TODO placeholder(s)`);
  }

  // Check resource directories
  const resourceDirs = ["scripts", "references", "assets"];
  for (const dir of resourceDirs) {
    const dirPath = path.join(resolvedPath, dir);
    if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
      const files = fs.readdirSync(dirPath);
      if (files.length === 0) {
        warnings.push(`Empty resource directory: ${dir}/`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    name,
    description: description.slice(0, 100) + (description.length > 100 ? "..." : ""),
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) usage(0);
  if (!args.skillPath) {
    console.error("[ERROR] Skill path is required");
    usage(1);
  }

  const result = validateSkill(args.skillPath, { strict: args.strict });

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    if (result.valid) {
      console.log(`[OK] Skill is valid: ${result.name}`);
      if (result.warnings.length > 0) {
        console.log("\nWarnings:");
        result.warnings.forEach((w) => console.log(`  - ${w}`));
      }
    } else {
      console.log("[ERROR] Skill validation failed\n");
      console.log("Errors:");
      result.errors.forEach((e) => console.log(`  - ${e}`));
      if (result.warnings.length > 0) {
        console.log("\nWarnings:");
        result.warnings.forEach((w) => console.log(`  - ${w}`));
      }
    }
  }

  process.exit(result.valid ? 0 : 1);
}

// Export for use by other scripts
module.exports = { validateSkill };

// Run if called directly
if (require.main === module) {
  main();
}
