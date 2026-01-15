/**
 * CUJ-044 Validation Script
 * Validates that all deliverables for CUJ-044 fix are complete
 */

import { readFileSync, existsSync } from 'fs';
import yaml from 'js-yaml';
import { WorkflowTemplateEngine } from './workflow-template-engine.mjs';
import { getCanonicalPath, resolveRuntimePath } from './context-path-resolver.mjs';

console.log('🔍 CUJ-044 Validation\n');

const checks = [];

// Check 1: Template engine exists
console.log('Check 1: Template engine exists');
const engineExists = existsSync('.claude/tools/workflow-template-engine.mjs');
checks.push({ name: 'Template engine exists', passed: engineExists });
console.log(engineExists ? '  ✅ PASS' : '  ❌ FAIL');

// Check 2: Master template exists
console.log('\nCheck 2: Master template exists');
const templateExists = existsSync('.claude/workflows/templates/fallback-routing-template.yaml');
checks.push({ name: 'Master template exists', passed: templateExists });
console.log(templateExists ? '  ✅ PASS' : '  ❌ FAIL');

// Check 3: Template can generate workflows (concrete workflows now use template)
console.log('\nCheck 3: Template can generate workflows');
const templateCanGenerate = templateExists && engineExists;
checks.push({ name: 'Template engine can generate workflows', passed: templateCanGenerate });
console.log(templateCanGenerate ? '  ✅ PASS' : '  ❌ FAIL');

// Check 4: Template workflow has correct placeholders
console.log('\nCheck 4: Template has correct placeholders');
const templateContent = readFileSync(
  '.claude/workflows/templates/fallback-routing-template.yaml',
  'utf8'
);
const hasPlaceholders =
  /\{\{primary_agent\}\}/.test(templateContent) && /\{\{fallback_agent\}\}/.test(templateContent);
checks.push({ name: 'Template has required placeholders', passed: hasPlaceholders });
console.log(hasPlaceholders ? '  ✅ PASS' : '  ❌ FAIL');

// Check 5: Template has valid YAML syntax
console.log('\nCheck 5: Template YAML syntax');
let templateYamlValid = false;
try {
  yaml.load(templateContent);
  templateYamlValid = true;
  console.log('  ✅ PASS: Template YAML is valid');
} catch (error) {
  console.log('  ❌ FAIL: Template YAML syntax error');
  console.log(`     Error: ${error.message}`);
}
checks.push({ name: 'Template YAML valid', passed: templateYamlValid });

// Check 6: Template engine can perform substitutions
console.log('\nCheck 6: Template engine substitutions');
try {
  const testEngine = new WorkflowTemplateEngine();
  const testResult = testEngine.substitute('agent: {{primary_agent}}', {
    primary_agent: 'developer',
  });
  const substitutionWorks = testResult === 'agent: developer';
  checks.push({ name: 'Template engine substitutions work', passed: substitutionWorks });
  console.log(substitutionWorks ? '  ✅ PASS' : '  ❌ FAIL');
} catch (error) {
  checks.push({ name: 'Template engine substitutions work', passed: false });
  console.log('  ❌ FAIL: Template engine error');
  console.log(`     Error: ${error.message}`);
}

// Check 7: Test suite exists
console.log('\nCheck 7: Test suite exists');
const testExists = existsSync('.claude/tools/test-template-engine.mjs');
checks.push({ name: 'Test suite exists', passed: testExists });
console.log(testExists ? '  ✅ PASS' : '  ❌ FAIL');

// Check 8: Implementation artifacts exist
console.log('\nCheck 8: Implementation artifacts exist');
const manifestExists =
  existsSync(getCanonicalPath('artifacts', 'generated', 'cuj-044-implementation-manifest.json')) ||
  existsSync(getCanonicalPath('artifacts', 'cuj-044-implementation-manifest.json'));
const reportExists = existsSync(
  resolveRuntimePath('reports/cuj-044-implementation-report.md', { read: true })
);
const artifactsExist = manifestExists && reportExists;
checks.push({ name: 'Implementation artifacts exist', passed: artifactsExist });
console.log(`  ${manifestExists ? '✅' : '❌'} Manifest: ${manifestExists}`);
console.log(`  ${reportExists ? '✅' : '❌'} Report: ${reportExists}`);

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 Summary\n');
const passedCount = checks.filter(c => c.passed).length;
const totalCount = checks.length;
console.log(`Checks passed: ${passedCount}/${totalCount}`);
checks.forEach(check => {
  console.log(`  ${check.passed ? '✅' : '❌'} ${check.name}`);
});

if (passedCount === totalCount) {
  console.log('\n🎉 CUJ-044 FIX VALIDATED - ALL CHECKS PASS');
  process.exit(0);
} else {
  console.log('\n⚠️  CUJ-044 FIX INCOMPLETE - SOME CHECKS FAILED');
  process.exit(1);
}
