import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const schemaDir = path.join(__dirname, '.claude', 'schemas');
const skillSchemasDir = path.join(__dirname, '.claude', 'skills');

let totalSchemas = 0;
let validSchemas = 0;
let invalidSchemas = 0;
let schemasWithoutRequired = 0;
let schemasWithoutDescriptions = 0;
let schemasWithIssues = [];

// Check main schemas
const mainSchemas = fs.readdirSync(schemaDir).filter(f => f.endsWith('.json'));
console.log(`Found ${mainSchemas.length} main schemas\n`);

for (const schema of mainSchemas) {
  totalSchemas++;
  const filePath = path.join(schemaDir, schema);
  try {
    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    validSchemas++;

    // Check for required fields
    if (!content.$schema) schemasWithIssues.push(`${schema}: Missing $schema`);
    if (!content.title) schemasWithIssues.push(`${schema}: Missing title`);
    if (!content.description) schemasWithIssues.push(`${schema}: Missing description`);
    if (!content.required) schemasWithoutRequired++;

    // Check properties have descriptions
    if (content.properties) {
      for (const [propName, propSchema] of Object.entries(content.properties)) {
        if (propSchema && typeof propSchema === 'object' && !propSchema.description) {
          schemasWithoutDescriptions++;
        }
      }
    }
  } catch (e) {
    invalidSchemas++;
    schemasWithIssues.push(`${schema}: Invalid JSON - ${e.message}`);
  }
}

console.log('=== MAIN SCHEMAS ===');
console.log(`Total: ${totalSchemas}, Valid: ${validSchemas}, Invalid: ${invalidSchemas}`);
console.log(`Schemas without 'required' field: ${schemasWithoutRequired}`);
console.log(`Properties without descriptions: ${schemasWithoutDescriptions}`);

if (schemasWithIssues.length > 0) {
  console.log('\nQuality Issues Found:');
  schemasWithIssues.slice(0, 15).forEach(i => console.log('  -', i));
  if (schemasWithIssues.length > 15) console.log(`  ... and ${schemasWithIssues.length - 15} more`);
}

// Now check skill schemas
console.log('\n=== SKILL SCHEMAS ===\n');
let skillSchemasTotal = 0;
let skillSchemasValid = 0;
let skillSchemasInvalid = 0;
let skillSchemaIssues = [];

function walkSkillSchemas(dir, baseSkillName = '') {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory() && item === 'schemas') {
      const schemaFiles = fs.readdirSync(fullPath).filter(f => f.endsWith('.json'));
      const skillName = path.basename(path.dirname(fullPath));

      for (const schemaFile of schemaFiles) {
        skillSchemasTotal++;
        const schemaPath = path.join(fullPath, schemaFile);
        try {
          const content = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
          skillSchemasValid++;

          // Check for required fields
          if (!content.$schema)
            skillSchemaIssues.push(`${skillName}/${schemaFile}: Missing $schema`);
          if (!content.title) skillSchemaIssues.push(`${skillName}/${schemaFile}: Missing title`);
          if (!content.description)
            skillSchemaIssues.push(`${skillName}/${schemaFile}: Missing description`);
        } catch (e) {
          skillSchemasInvalid++;
          skillSchemaIssues.push(`${skillName}/${schemaFile}: Invalid JSON`);
        }
      }
    } else if (stat.isDirectory() && item !== 'node_modules' && item !== '.git') {
      walkSkillSchemas(fullPath, item);
    }
  }
}

walkSkillSchemas(skillSchemasDir);

console.log(
  `Total Skill Schemas: ${skillSchemasTotal}, Valid: ${skillSchemasValid}, Invalid: ${skillSchemasInvalid}`
);

if (skillSchemaIssues.length > 0) {
  console.log('\nSkill Schema Issues:');
  skillSchemaIssues.slice(0, 15).forEach(i => console.log('  -', i));
  if (skillSchemaIssues.length > 15) console.log(`  ... and ${skillSchemaIssues.length - 15} more`);
}

console.log('\n=== SUMMARY ===');
console.log(`Total Schemas Found: ${totalSchemas + skillSchemasTotal}`);
console.log(`Valid: ${validSchemas + skillSchemasValid}`);
console.log(`Invalid: ${invalidSchemas + skillSchemasInvalid}`);
console.log(`Total Issues: ${schemasWithIssues.length + skillSchemaIssues.length}`);
