#!/usr/bin/env node
/**
 * Test suite for scaffolder
 *
 * Usage:
 *   node test-scaffold.mjs
 */

import { readFile, rm, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '../../../..');
const TEST_OUTPUT_DIR = join(PROJECT_ROOT, '.test-output');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

let passedTests = 0;
let failedTests = 0;

/**
 * Test runner
 */
async function test(name, fn) {
  try {
    await fn();
    console.log(`${colors.green}✓${colors.reset} ${name}`);
    passedTests++;
  } catch (error) {
    console.log(`${colors.red}✗${colors.reset} ${name}`);
    console.error(`  ${colors.red}${error.message}${colors.reset}`);
    failedTests++;
  }
}

/**
 * Setup test environment
 */
async function setup() {
  await rm(TEST_OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(TEST_OUTPUT_DIR, { recursive: true });
}

/**
 * Cleanup test environment
 */
async function cleanup() {
  await rm(TEST_OUTPUT_DIR, { recursive: true, force: true });
}

/**
 * Assert helper
 */
function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

/**
 * Run scaffolder and parse output
 */
async function runScaffolder(args) {
  const { stdout, stderr } = await execAsync(
    `node ${join(__dirname, 'scaffold.mjs')} ${args}`,
    { cwd: PROJECT_ROOT }
  );

  // Extract JSON from output (last JSON object)
  const jsonMatch = stdout.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON output found');
  }

  return JSON.parse(jsonMatch[0]);
}

/**
 * Test: Component scaffolding
 */
await test('Scaffold Server Component', async () => {
  const output = await runScaffolder(`component TestComponent --path ${TEST_OUTPUT_DIR}/components/test-component`);

  assert(output.skill_name === 'scaffolder', 'skill_name should be "scaffolder"');
  assert(output.template_type === 'component', 'template_type should be "component"');
  assert(output.component_type === 'TestComponent', 'component_type should be "TestComponent"');
  assert(output.files_generated.length >= 4, 'Should generate at least 4 files');
  assert(output.patterns_applied.length > 0, 'Should have applied patterns');
  assert(output.rule_index_consulted === true, 'Should have consulted rule index');

  // Verify files exist
  const indexContent = await readFile(join(TEST_OUTPUT_DIR, 'components/test-component/index.tsx'), 'utf-8');
  assert(indexContent.includes('TestComponent'), 'index.tsx should contain component name');
  assert(indexContent.includes('Suspense'), 'index.tsx should include Suspense');
});

/**
 * Test: Client Component scaffolding
 */
await test('Scaffold Client Component', async () => {
  const output = await runScaffolder(`client-component InteractiveButton --path ${TEST_OUTPUT_DIR}/components/interactive-button`);

  assert(output.template_type === 'client-component', 'template_type should be "client-component"');
  assert(output.component_type === 'InteractiveButton', 'component_type should be "InteractiveButton"');

  const indexContent = await readFile(join(TEST_OUTPUT_DIR, 'components/interactive-button/index.tsx'), 'utf-8');
  assert(indexContent.includes("'use client'"), "index.tsx should include 'use client' directive");
  assert(indexContent.includes('useState'), 'index.tsx should use useState');
});

/**
 * Test: API Route scaffolding
 */
await test('Scaffold API Route', async () => {
  const output = await runScaffolder(`api users --path ${TEST_OUTPUT_DIR}/app/api/users`);

  assert(output.template_type === 'api', 'template_type should be "api"');

  const routeContent = await readFile(join(TEST_OUTPUT_DIR, 'app/api/users/route.ts'), 'utf-8');
  assert(routeContent.includes('export async function GET'), 'route.ts should have GET handler');
  assert(routeContent.includes('export async function POST'), 'route.ts should have POST handler');
  assert(routeContent.includes('NextRequest'), 'route.ts should use NextRequest');
  assert(routeContent.includes('zod'), 'route.ts should include Zod validation');
});

/**
 * Test: Feature module scaffolding
 */
await test('Scaffold Feature Module', async () => {
  const output = await runScaffolder(`feature user-management --path ${TEST_OUTPUT_DIR}/app/(dashboard)/user-management`);

  assert(output.template_type === 'feature', 'template_type should be "feature"');
  assert(output.files_generated.length >= 4, 'Should generate at least 4 files');

  // Verify main page exists
  const pageContent = await readFile(join(TEST_OUTPUT_DIR, 'app/(dashboard)/user-management/page.tsx'), 'utf-8');
  assert(pageContent.includes('UserManagement'), 'page.tsx should contain feature name');
});

/**
 * Test: Hook scaffolding
 */
await test('Scaffold Custom Hook', async () => {
  const output = await runScaffolder(`hook useCounter --path ${TEST_OUTPUT_DIR}/hooks`);

  assert(output.template_type === 'hook', 'template_type should be "hook"');

  const hookContent = await readFile(join(TEST_OUTPUT_DIR, 'hooks/use-counter.ts'), 'utf-8');
  assert(hookContent.includes('export function useCounter'), 'Should export useCounter hook');
  assert(hookContent.includes('useState'), 'Should use useState');
});

/**
 * Test: Context scaffolding
 */
await test('Scaffold Context Provider', async () => {
  const output = await runScaffolder(`context Theme --path ${TEST_OUTPUT_DIR}/contexts/theme`);

  assert(output.template_type === 'context', 'template_type should be "context"');

  const contextContent = await readFile(join(TEST_OUTPUT_DIR, 'contexts/theme/index.tsx'), 'utf-8');
  assert(contextContent.includes('ThemeProvider'), 'Should export ThemeProvider');
  assert(contextContent.includes('useTheme'), 'Should export useTheme hook');
  assert(contextContent.includes('createContext'), 'Should use createContext');
});

/**
 * Test: FastAPI route scaffolding
 */
await test('Scaffold FastAPI Route', async () => {
  const output = await runScaffolder(`fastapi-route products --path ${TEST_OUTPUT_DIR}/app/routers`);

  assert(output.template_type === 'fastapi-route', 'template_type should be "fastapi-route"');

  const routeContent = await readFile(join(TEST_OUTPUT_DIR, 'app/routers/products.py'), 'utf-8');
  assert(routeContent.includes('APIRouter'), 'Should use APIRouter');
  assert(routeContent.includes('ProductCreate'), 'Should have ProductCreate model');
  assert(routeContent.includes('ProductResponse'), 'Should have ProductResponse model');
  assert(routeContent.includes('list_products'), 'Should have list_products endpoint');
  assert(routeContent.includes('create_products'), 'Should have create_products endpoint');
});

/**
 * Test: Output schema compliance
 */
await test('Output conforms to schema', async () => {
  const output = await runScaffolder(`component SchemaTest --path ${TEST_OUTPUT_DIR}/components/schema-test`);

  // Required fields
  assert(output.skill_name, 'Should have skill_name');
  assert(output.files_generated, 'Should have files_generated');
  assert(output.patterns_applied, 'Should have patterns_applied');
  assert(typeof output.rule_index_consulted === 'boolean', 'Should have rule_index_consulted as boolean');
  assert(output.timestamp, 'Should have timestamp');

  // files_generated structure
  assert(Array.isArray(output.files_generated), 'files_generated should be array');
  const file = output.files_generated[0];
  assert(file.path, 'File should have path');
  assert(file.type, 'File should have type');
  assert(typeof file.lines_of_code === 'number', 'File should have lines_of_code as number');

  // Optional fields
  assert(output.template_used, 'Should have template_used');
  assert(output.component_type, 'Should have component_type');
  assert(Array.isArray(output.technology_stack), 'technology_stack should be array');
});

/**
 * Test: Rule index integration
 */
await test('Consults rule index for patterns', async () => {
  const output = await runScaffolder(`component RuleTest --path ${TEST_OUTPUT_DIR}/components/rule-test`);

  assert(output.rule_index_consulted === true, 'Should consult rule index');
  assert(Array.isArray(output.rules_loaded), 'Should have rules_loaded array');
  assert(output.rules_loaded.length > 0, 'Should load at least one rule');
  assert(output.patterns_applied.length > 0, 'Should apply at least one pattern');
});

/**
 * Test: Name case conversions
 */
await test('Converts names correctly', async () => {
  const output = await runScaffolder(`component user-profile-card --path ${TEST_OUTPUT_DIR}/components/user-profile-card`);

  assert(output.component_type === 'UserProfileCard', 'Should convert to PascalCase');

  const indexContent = await readFile(join(TEST_OUTPUT_DIR, 'components/user-profile-card/index.tsx'), 'utf-8');
  assert(indexContent.includes('UserProfileCard'), 'Should use PascalCase in code');
});

/**
 * Test: Custom path option
 */
await test('Respects --path option', async () => {
  const customPath = join(TEST_OUTPUT_DIR, 'custom/location/my-component');
  const output = await runScaffolder(`component MyComponent --path ${customPath}`);

  assert(output.files_generated[0].path.includes('custom/location/my-component'), 'Should use custom path');

  const indexContent = await readFile(join(customPath, 'index.tsx'), 'utf-8');
  assert(indexContent.includes('MyComponent'), 'Should generate in custom path');
});

/**
 * Test: Help flag
 */
await test('Shows help with --help', async () => {
  try {
    const { stdout } = await execAsync(
      `node ${join(__dirname, 'scaffold.mjs')} --help`,
      { cwd: PROJECT_ROOT }
    );
    assert(stdout.includes('Usage:'), 'Help should include usage');
    assert(stdout.includes('Templates:'), 'Help should list templates');
  } catch (error) {
    // --help exits with 0, should not throw
    assert(error.stdout.includes('Usage:'), 'Help should include usage');
  }
});

/**
 * Test: List templates
 */
await test('Lists templates with --list', async () => {
  try {
    const { stdout } = await execAsync(
      `node ${join(__dirname, 'scaffold.mjs')} --list`,
      { cwd: PROJECT_ROOT }
    );
    assert(stdout.includes('component'), 'Should list component template');
    assert(stdout.includes('client-component'), 'Should list client-component template');
    assert(stdout.includes('api'), 'Should list api template');
  } catch (error) {
    // --list exits with 0, should not throw
    assert(error.stdout.includes('component'), 'Should list templates');
  }
});

/**
 * Run tests
 */
console.log(`\n${colors.blue}Running scaffolder tests...${colors.reset}\n`);

await setup();

try {
  // Run all tests (defined above with await test(...))
  // Tests are already executed due to top-level await

  console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`\nTests complete:`);
  console.log(`  ${colors.green}${passedTests} passed${colors.reset}`);
  if (failedTests > 0) {
    console.log(`  ${colors.red}${failedTests} failed${colors.reset}`);
  }
  console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

  if (failedTests > 0) {
    process.exit(1);
  }
} finally {
  await cleanup();
}
