/**
 * Test script for workflow template engine
 * Validates template substitution and placeholder resolution
 */

import { WorkflowTemplateEngine } from './workflow-template-engine.mjs';
import { readFileSync } from 'fs';
import yaml from 'js-yaml';

// Test 1: Basic substitution
console.log('Test 1: Basic substitution');
const engine = new WorkflowTemplateEngine();
const result1 = engine.substitute('agent: {{primary_agent}}', { primary_agent: 'developer' });
console.log('  Input:  agent: {{primary_agent}}');
console.log('  Output:', result1);
console.log('  Status:', result1 === 'agent: developer' ? '✅ PASS' : '❌ FAIL');
console.log('');

// Test 2: Multiple placeholders
console.log('Test 2: Multiple placeholders');
const result2 = engine.substitute(
  'Primary: {{primary_agent}}, Fallback: {{fallback_agent}}',
  { primary_agent: 'architect', fallback_agent: 'developer' }
);
console.log('  Input:  Primary: {{primary_agent}}, Fallback: {{fallback_agent}}');
console.log('  Output:', result2);
console.log('  Status:', result2 === 'Primary: architect, Fallback: developer' ? '✅ PASS' : '❌ FAIL');
console.log('');

// Test 3: Nested placeholders
console.log('Test 3: Nested placeholders');
const result3 = engine.substitute('Config: {{config.setting}}', {
  config: { setting: 'value' },
});
console.log('  Input:  Config: {{config.setting}}');
console.log('  Output:', result3);
console.log('  Status:', result3 === 'Config: value' ? '✅ PASS' : '❌ FAIL');
console.log('');

// Test 4: Validate template workflow
console.log('Test 4: Validate template workflow');
const templatePath = '.claude/workflows/templates/fallback-routing-template.yaml';
try {
  const content = readFileSync(templatePath, 'utf8');

  // Check for required placeholders
  const hasPlaceholders = /\{\{primary_agent\}\}/.test(content) && /\{\{fallback_agent\}\}/.test(content);

  if (hasPlaceholders) {
    console.log(`  ✅ PASS: ${templatePath}`);
    console.log(`     Required placeholders present: {{primary_agent}}, {{fallback_agent}}`);
  } else {
    console.log(`  ❌ FAIL: ${templatePath}`);
    console.log(`     Missing required placeholders`);
  }

  // Validate YAML syntax
  const parsed = yaml.load(content);
  console.log(`     YAML valid: ✅`);

  // Verify template structure
  const hasSteps = parsed.steps && parsed.steps.length > 0;
  console.log(`     Has steps: ${hasSteps ? '✅' : '❌'}`);
} catch (error) {
  console.log(`  ❌ ERROR: ${templatePath}`);
  console.log(`     ${error.message}`);
}
console.log('');

// Test 5: Validation function
console.log('Test 5: Validation function');
try {
  engine.validate('No placeholders here');
  console.log('  ✅ PASS: Valid content accepted');
} catch (error) {
  console.log('  ❌ FAIL: Valid content rejected');
}

try {
  engine.validate('Has {{placeholder}}');
  console.log('  ❌ FAIL: Invalid content accepted');
} catch (error) {
  console.log('  ✅ PASS: Invalid content rejected');
  console.log(`     Error: ${error.message}`);
}

console.log('\n🏁 All tests complete');
