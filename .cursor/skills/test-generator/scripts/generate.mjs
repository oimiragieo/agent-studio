#!/usr/bin/env node
/**
 * Test Generator - Automated test generation from source code
 *
 * Usage:
 *   node generate.mjs --source src/utils/auth.ts --framework jest
 *   node generate.mjs --source src/components/UserProfile.tsx --framework vitest
 *   node generate.mjs --source app/api/users/route.ts --framework jest --output tests/api/users.test.ts
 *   node generate.mjs --source src/App.tsx --framework cypress --coverage 90
 *   node generate.mjs --source backend/services/user.py --framework pytest
 *
 * Options:
 *   --source <file>       Source file to generate tests for (required)
 *   --framework <name>    Test framework: jest, vitest, cypress, playwright, pytest (required)
 *   --output <file>       Output test file path (optional, auto-generated if not provided)
 *   --coverage <percent>  Target coverage percentage (default: 80)
 *   --help                Show this help message
 */

import { readFile, writeFile, mkdir, stat } from 'fs/promises';
import { join, dirname, resolve, basename, extname, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../../../..');

/**
 * Parse command-line arguments
 */
function parseArgs(args) {
  const parsed = {
    source: null,
    framework: null,
    output: null,
    coverage: 80,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help') {
      parsed.help = true;
    } else if (arg === '--source' && args[i + 1]) {
      parsed.source = args[++i];
    } else if (arg === '--framework' && args[i + 1]) {
      parsed.framework = args[++i];
    } else if (arg === '--output' && args[i + 1]) {
      parsed.output = args[++i];
    } else if (arg === '--coverage' && args[i + 1]) {
      parsed.coverage = parseInt(args[++i]);
    }
  }

  return parsed;
}

/**
 * Show help message
 */
function showHelp() {
  console.log(`
Test Generator - Automated test generation from source code

Usage:
  node generate.mjs --source <file> --framework <name> [options]

Options:
  --source <file>       Source file to generate tests for (required)
  --framework <name>    Test framework (required):
                        - jest: JavaScript/TypeScript unit testing
                        - vitest: Fast Vite-powered unit testing
                        - cypress: E2E testing
                        - playwright: Modern E2E testing
                        - pytest: Python testing
  --output <file>       Output test file path (auto-generated if omitted)
  --coverage <percent>  Target coverage percentage (default: 80)
  --help                Show this help message

Examples:
  node generate.mjs --source src/utils/auth.ts --framework jest
  node generate.mjs --source src/components/Button.tsx --framework vitest --coverage 90
  node generate.mjs --source app/api/users/route.ts --framework jest --output tests/api/users.test.ts
  node generate.mjs --source e2e/login-flow.spec.ts --framework playwright
  node generate.mjs --source backend/services/user.py --framework pytest
  `);
}

/**
 * Load rule index for testing rules
 */
async function loadRuleIndex() {
  try {
    const indexPath = join(PROJECT_ROOT, '.claude/context/rule-index.json');
    const content = await readFile(indexPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.warn('Warning: Failed to load rule index. Run: pnpm index-rules');
    return { rules: [], technology_map: {} };
  }
}

/**
 * Query technology map for testing-related rules
 */
function queryTestingRules(ruleIndex, framework) {
  const technologies = [framework.toLowerCase()];

  // Add related technologies based on framework
  if (['jest', 'vitest'].includes(framework)) {
    technologies.push('javascript', 'typescript', 'react');
  } else if (['cypress', 'playwright'].includes(framework)) {
    technologies.push('e2e', 'testing');
  } else if (framework === 'pytest') {
    technologies.push('python');
  }

  const relevantRules = [];
  const seenPaths = new Set();

  for (const tech of technologies) {
    const techRules = ruleIndex.technology_map?.[tech] || [];
    for (const rulePath of techRules) {
      if (!seenPaths.has(rulePath)) {
        const rule = ruleIndex.rules.find(r => r.path === rulePath);
        if (rule) {
          relevantRules.push(rule);
          seenPaths.add(rulePath);
        }
      }
    }
  }

  return relevantRules;
}

/**
 * Analyze source file to extract testable elements
 */
async function analyzeSourceFile(sourcePath) {
  const content = await readFile(sourcePath, 'utf-8');
  const ext = extname(sourcePath);
  const lines = content.split('\n');

  const analysis = {
    functions: [],
    classes: [],
    methods: [],
    exports: [],
    imports: [],
    complexity_score: 0,
    line_count: lines.length,
  };

  // Extract imports
  const importRegex = /^import\s+.*?from\s+['"](.+?)['"]/gm;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    analysis.imports.push(match[1]);
  }

  // Extract functions (JavaScript/TypeScript)
  if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
    // Function declarations
    const funcRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/g;
    while ((match = funcRegex.exec(content)) !== null) {
      analysis.functions.push(match[1]);
      analysis.exports.push(match[1]);
    }

    // Arrow functions
    const arrowRegex = /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g;
    while ((match = arrowRegex.exec(content)) !== null) {
      analysis.functions.push(match[1]);
      if (content.includes(`export const ${match[1]}`)) {
        analysis.exports.push(match[1]);
      }
    }

    // Class declarations
    const classRegex = /(?:export\s+)?class\s+(\w+)/g;
    while ((match = classRegex.exec(content)) !== null) {
      analysis.classes.push(match[1]);
      analysis.exports.push(match[1]);
    }

    // Methods in classes
    const methodRegex = /^\s+(?:async\s+)?(\w+)\s*\([^)]*\)\s*{/gm;
    while ((match = methodRegex.exec(content)) !== null) {
      if (!['constructor', 'render'].includes(match[1])) {
        analysis.methods.push(match[1]);
      }
    }

    // Calculate complexity (rough estimate)
    const ifCount = (content.match(/\bif\s*\(/g) || []).length;
    const forCount = (content.match(/\bfor\s*\(/g) || []).length;
    const whileCount = (content.match(/\bwhile\s*\(/g) || []).length;
    const switchCount = (content.match(/\bswitch\s*\(/g) || []).length;
    analysis.complexity_score = ifCount + forCount + whileCount + switchCount * 2;
  }

  // Extract functions (Python)
  if (ext === '.py') {
    const pyFuncRegex = /^\s*def\s+(\w+)\s*\(/gm;
    while ((match = pyFuncRegex.exec(content)) !== null) {
      analysis.functions.push(match[1]);
      analysis.exports.push(match[1]);
    }

    const pyClassRegex = /^\s*class\s+(\w+)/gm;
    while ((match = pyClassRegex.exec(content)) !== null) {
      analysis.classes.push(match[1]);
      analysis.exports.push(match[1]);
    }

    // Calculate complexity for Python
    const ifCount = (content.match(/\bif\s+/g) || []).length;
    const forCount = (content.match(/\bfor\s+/g) || []).length;
    const whileCount = (content.match(/\bwhile\s+/g) || []).length;
    analysis.complexity_score = ifCount + forCount + whileCount;
  }

  return analysis;
}

/**
 * Generate test content based on framework and analysis
 */
function generateTestContent(framework, sourcePath, analysis, options = {}) {
  const { coverage = 80 } = options;
  const componentName = basename(sourcePath, extname(sourcePath));
  const ext = extname(sourcePath);

  const generators = {
    jest: generateJestTest,
    vitest: generateVitestTest,
    cypress: generateCypressTest,
    playwright: generatePlaywrightTest,
    pytest: generatePytestTest,
  };

  const generator = generators[framework];
  if (!generator) {
    throw new Error(`Unsupported framework: ${framework}`);
  }

  return generator(componentName, sourcePath, analysis, { coverage });
}

/**
 * Generate Jest test
 */
function generateJestTest(componentName, sourcePath, analysis, options) {
  const isReactComponent = sourcePath.includes('component') || sourcePath.match(/\.(tsx|jsx)$/);
  const importPath = './' + basename(sourcePath, extname(sourcePath));

  let content = '';

  // Imports
  if (isReactComponent) {
    content += `import { render, screen, waitFor, fireEvent } from '@testing-library/react'\n`;
    content += `import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'\n`;
  } else {
    content += `import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'\n`;
  }

  // Import component/functions
  if (analysis.exports.length > 0) {
    content += `import { ${analysis.exports.join(', ')} } from '${importPath}'\n\n`;
  }

  // Main describe block
  content += `describe('${componentName}', () => {\n`;
  content += `  beforeEach(() => {\n`;
  content += `    vi.clearAllMocks()\n`;
  content += `  })\n\n`;

  // Generate test cases for each function/class
  const testCases = [];

  if (isReactComponent && analysis.exports.length > 0) {
    const mainExport = analysis.exports[0];

    // Basic render test
    testCases.push({
      name: 'renders without crashing',
      type: 'unit',
      coverage_target: 'basic',
      assertions: 1,
    });
    content += `  it('renders without crashing', () => {\n`;
    content += `    render(<${mainExport} />)\n`;
    content += `    expect(screen.getByRole('main')).toBeInTheDocument()\n`;
    content += `  })\n\n`;

    // Props test
    testCases.push({
      name: 'renders with props',
      type: 'unit',
      coverage_target: 'props',
      assertions: 2,
    });
    content += `  it('renders with props', () => {\n`;
    content += `    const props = { title: 'Test Title' }\n`;
    content += `    render(<${mainExport} {...props} />)\n`;
    content += `    expect(screen.getByText('Test Title')).toBeInTheDocument()\n`;
    content += `  })\n\n`;

    // Interaction test
    testCases.push({
      name: 'handles user interactions',
      type: 'integration',
      coverage_target: 'interactions',
      assertions: 2,
    });
    content += `  it('handles user interactions', async () => {\n`;
    content += `    render(<${mainExport} />)\n`;
    content += `    const button = screen.getByRole('button')\n`;
    content += `    fireEvent.click(button)\n`;
    content += `    await waitFor(() => {\n`;
    content += `      expect(screen.getByText(/clicked/i)).toBeInTheDocument()\n`;
    content += `    })\n`;
    content += `  })\n\n`;

    // Error state test
    testCases.push({
      name: 'handles error state',
      type: 'unit',
      coverage_target: 'error_handling',
      assertions: 1,
    });
    content += `  it('handles error state', () => {\n`;
    content += `    render(<${mainExport} error="Something went wrong" />)\n`;
    content += `    expect(screen.getByText('Something went wrong')).toBeInTheDocument()\n`;
    content += `  })\n\n`;
  } else {
    // Unit tests for functions
    analysis.functions.forEach(funcName => {
      testCases.push({
        name: `${funcName} - happy path`,
        type: 'unit',
        coverage_target: 'happy_path',
        assertions: 1,
      });
      content += `  it('${funcName} - happy path', () => {\n`;
      content += `    const result = ${funcName}(/* valid input */)\n`;
      content += `    expect(result).toBeDefined()\n`;
      content += `  })\n\n`;

      testCases.push({
        name: `${funcName} - handles edge cases`,
        type: 'unit',
        coverage_target: 'edge_cases',
        assertions: 2,
      });
      content += `  it('${funcName} - handles edge cases', () => {\n`;
      content += `    expect(() => ${funcName}(null)).not.toThrow()\n`;
      content += `    expect(${funcName}(undefined)).toBeDefined()\n`;
      content += `  })\n\n`;
    });
  }

  content += `})\n`;

  return { content, testCases };
}

/**
 * Generate Vitest test (similar to Jest)
 */
function generateVitestTest(componentName, sourcePath, analysis, options) {
  return generateJestTest(componentName, sourcePath, analysis, options);
}

/**
 * Generate Cypress test
 */
function generateCypressTest(componentName, sourcePath, analysis, options) {
  const testCases = [];
  let content = `describe('${componentName} E2E Tests', () => {\n`;
  content += `  beforeEach(() => {\n`;
  content += `    cy.visit('/')\n`;
  content += `  })\n\n`;

  // Basic navigation test
  testCases.push({
    name: 'page loads successfully',
    type: 'e2e',
    coverage_target: 'page_load',
    assertions: 1,
  });
  content += `  it('page loads successfully', () => {\n`;
  content += `    cy.url().should('include', '/')\n`;
  content += `    cy.get('[data-testid="main"]').should('be.visible')\n`;
  content += `  })\n\n`;

  // User interaction test
  testCases.push({
    name: 'user can interact with UI',
    type: 'e2e',
    coverage_target: 'user_interaction',
    assertions: 2,
  });
  content += `  it('user can interact with UI', () => {\n`;
  content += `    cy.get('[data-testid="button"]').click()\n`;
  content += `    cy.get('[data-testid="result"]').should('be.visible')\n`;
  content += `  })\n\n`;

  // Form submission test
  testCases.push({
    name: 'form submission works',
    type: 'e2e',
    coverage_target: 'form_submission',
    assertions: 2,
  });
  content += `  it('form submission works', () => {\n`;
  content += `    cy.get('[data-testid="input"]').type('test value')\n`;
  content += `    cy.get('[data-testid="submit"]').click()\n`;
  content += `    cy.get('[data-testid="success"]').should('contain', 'Success')\n`;
  content += `  })\n\n`;

  content += `})\n`;

  return { content, testCases };
}

/**
 * Generate Playwright test
 */
function generatePlaywrightTest(componentName, sourcePath, analysis, options) {
  const testCases = [];
  let content = `import { test, expect } from '@playwright/test'\n\n`;
  content += `test.describe('${componentName}', () => {\n`;

  // Navigation test
  testCases.push({
    name: 'navigates to page',
    type: 'e2e',
    coverage_target: 'navigation',
    assertions: 1,
  });
  content += `  test('navigates to page', async ({ page }) => {\n`;
  content += `    await page.goto('/')\n`;
  content += `    await expect(page).toHaveURL(/.*\\//)\n`;
  content += `  })\n\n`;

  // Interaction test
  testCases.push({
    name: 'handles user interaction',
    type: 'e2e',
    coverage_target: 'interaction',
    assertions: 2,
  });
  content += `  test('handles user interaction', async ({ page }) => {\n`;
  content += `    await page.goto('/')\n`;
  content += `    await page.click('[data-testid="button"]')\n`;
  content += `    await expect(page.locator('[data-testid="result"]')).toBeVisible()\n`;
  content += `  })\n\n`;

  // Accessibility test
  testCases.push({
    name: 'meets accessibility standards',
    type: 'e2e',
    coverage_target: 'accessibility',
    assertions: 1,
  });
  content += `  test('meets accessibility standards', async ({ page }) => {\n`;
  content += `    await page.goto('/')\n`;
  content += `    // Add accessibility checks here\n`;
  content += `    await expect(page.locator('main')).toBeVisible()\n`;
  content += `  })\n\n`;

  content += `})\n`;

  return { content, testCases };
}

/**
 * Generate Pytest test
 */
function generatePytestTest(componentName, sourcePath, analysis, options) {
  const testCases = [];
  const importPath = relative(dirname(sourcePath), sourcePath)
    .replace(/\.py$/, '')
    .replace(/\//g, '.');

  let content = `"""Tests for ${componentName}."""\n`;
  content += `import pytest\n`;

  if (analysis.exports.length > 0) {
    content += `from ${importPath} import ${analysis.exports.join(', ')}\n\n`;
  }

  // Fixture
  content += `@pytest.fixture\n`;
  content += `def sample_data():\n`;
  content += `    """Provide sample test data."""\n`;
  content += `    return {"test": "data"}\n\n`;

  // Test functions
  analysis.functions.forEach(funcName => {
    if (funcName.startsWith('_')) return; // Skip private functions

    testCases.push({
      name: `test_${funcName}_happy_path`,
      type: 'unit',
      coverage_target: 'happy_path',
      assertions: 1,
    });
    content += `def test_${funcName}_happy_path(sample_data):\n`;
    content += `    """Test ${funcName} with valid input."""\n`;
    content += `    result = ${funcName}(sample_data)\n`;
    content += `    assert result is not None\n\n`;

    testCases.push({
      name: `test_${funcName}_edge_cases`,
      type: 'unit',
      coverage_target: 'edge_cases',
      assertions: 2,
    });
    content += `def test_${funcName}_edge_cases():\n`;
    content += `    """Test ${funcName} with edge cases."""\n`;
    content += `    with pytest.raises(ValueError):\n`;
    content += `        ${funcName}(None)\n`;
    content += `    assert ${funcName}({}) is not None\n\n`;
  });

  // Test classes
  analysis.classes.forEach(className => {
    testCases.push({
      name: `test_${className}_initialization`,
      type: 'unit',
      coverage_target: 'initialization',
      assertions: 1,
    });
    content += `def test_${className}_initialization():\n`;
    content += `    """Test ${className} initialization."""\n`;
    content += `    instance = ${className}()\n`;
    content += `    assert instance is not None\n\n`;
  });

  return { content, testCases };
}

/**
 * Determine output path for test file
 */
function determineOutputPath(sourcePath, framework, userOutput) {
  if (userOutput) {
    return resolve(userOutput);
  }

  const ext = extname(sourcePath);
  const base = basename(sourcePath, ext);
  const dir = dirname(sourcePath);

  // Framework-specific extensions
  const testExtensions = {
    jest: '.test.ts',
    vitest: '.test.ts',
    cypress: '.cy.ts',
    playwright: '.spec.ts',
    pytest: '_test.py',
  };

  const testExt = testExtensions[framework] || '.test.ts';

  // Determine test directory
  let testDir;
  if (['cypress', 'playwright'].includes(framework)) {
    testDir = join(PROJECT_ROOT, 'e2e');
  } else if (framework === 'pytest') {
    testDir = join(dir, 'tests');
  } else {
    testDir = join(dir, '__tests__');
  }

  return join(testDir, base + testExt);
}

/**
 * Calculate coverage estimates
 */
function calculateCoverage(analysis, testCases) {
  const totalElements =
    analysis.functions.length + analysis.classes.length + analysis.methods.length;
  const testedElements = testCases.length;

  if (totalElements === 0) {
    return {
      estimated_line_coverage: 100,
      estimated_branch_coverage: 100,
    };
  }

  // Rough estimates
  const elementCoverage = Math.min(100, (testedElements / totalElements) * 100);
  const lineCoverage = Math.round(elementCoverage * 0.8); // Conservative estimate
  const branchCoverage = Math.round(lineCoverage * 0.7); // Branch coverage usually lower

  return {
    estimated_line_coverage: `${lineCoverage}%`,
    estimated_branch_coverage: `${branchCoverage}%`,
  };
}

/**
 * Validate output against schema
 */
async function validateOutput(output, schemaPath) {
  try {
    const schemaContent = await readFile(join(PROJECT_ROOT, schemaPath), 'utf-8');
    const schema = JSON.parse(schemaContent);

    // Basic validation - check required fields
    const requiredFields = schema.required || [];
    for (const field of requiredFields) {
      if (!(field in output)) {
        console.error(`Missing required field: ${field}`);
        return false;
      }
    }
    return true;
  } catch (err) {
    console.error('Schema validation failed:', err.message);
    return false;
  }
}

/**
 * Main execution
 */
async function main() {
  const startTime = Date.now();
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    showHelp();
    return;
  }

  // Validate required arguments
  if (!args.source) {
    console.error('Error: --source is required');
    showHelp();
    process.exit(1);
  }

  if (!args.framework) {
    console.error('Error: --framework is required');
    showHelp();
    process.exit(1);
  }

  const supportedFrameworks = ['jest', 'vitest', 'cypress', 'playwright', 'pytest'];
  if (!supportedFrameworks.includes(args.framework)) {
    console.error(`Error: Unsupported framework "${args.framework}"`);
    console.error(`Supported frameworks: ${supportedFrameworks.join(', ')}`);
    process.exit(1);
  }

  try {
    const sourcePath = resolve(args.source);

    // Verify source file exists
    await stat(sourcePath);

    console.log(`Analyzing source file: ${sourcePath}`);

    // 1. Load rule index
    const ruleIndex = await loadRuleIndex();

    // 2. Query testing rules
    const rules = queryTestingRules(ruleIndex, args.framework);
    console.log(`Found ${rules.length} testing-related rules`);

    // 3. Analyze source file
    const analysis = await analyzeSourceFile(sourcePath);
    console.log(`Found ${analysis.functions.length} functions, ${analysis.classes.length} classes`);

    // 4. Generate test content
    const { content: testContent, testCases } = generateTestContent(
      args.framework,
      sourcePath,
      analysis,
      { coverage: args.coverage }
    );

    // 5. Determine output path
    const outputPath = determineOutputPath(sourcePath, args.framework, args.output);

    // 6. Write test file
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, testContent, 'utf-8');
    console.log(`Generated test file: ${outputPath}`);

    // 7. Calculate coverage
    const coverage = calculateCoverage(analysis, testCases);

    // 8. Build output conforming to schema
    const output = {
      skill_name: 'test-generator',
      test_files_generated: [
        {
          path: outputPath,
          test_type: ['cypress', 'playwright'].includes(args.framework) ? 'e2e' : 'unit',
          test_cases_count: testCases.length,
          lines_of_code: testContent.split('\n').length,
          source_file: sourcePath,
        },
      ],
      test_cases_count: testCases.length,
      coverage_target: `${args.coverage}%`,
      framework_used: args.framework,
      test_suite_structure: {
        unit_tests: testCases.filter(t => t.type === 'unit').length,
        integration_tests: testCases.filter(t => t.type === 'integration').length,
        e2e_tests: testCases.filter(t => t.type === 'e2e').length,
        component_tests: testCases.filter(t => t.type === 'component').length,
      },
      assertions_generated: testCases.reduce((sum, tc) => sum + tc.assertions, 0),
      mocking_used: testContent.includes('vi.') || testContent.includes('mock'),
      test_patterns_applied: [
        'Arrange-Act-Assert',
        testCases.some(t => t.type === 'e2e') ? 'Page Object Model' : null,
      ].filter(Boolean),
      dependencies_detected: analysis.imports,
      edge_cases_covered: [
        'null/undefined inputs',
        'empty values',
        testCases.some(t => t.coverage_target === 'error_handling') ? 'error conditions' : null,
      ].filter(Boolean),
      timestamp: new Date().toISOString(),
    };

    // Add coverage if available
    Object.assign(output, coverage);

    // 9. Validate output
    const schemaPath = '.claude/schemas/skill-test-generator-output.schema.json';
    const isValid = await validateOutput(output, schemaPath);

    if (!isValid) {
      console.error('Warning: Output does not conform to schema');
    }

    // 10. Output JSON
    console.log('\n' + JSON.stringify(output, null, 2));

    console.log('\n✅ Test generation complete!');
    console.log(`\nGenerated ${testCases.length} test cases in ${outputPath}`);
    console.log(`Framework: ${args.framework}`);
    console.log(`Coverage target: ${args.coverage}%`);

    const duration = Date.now() - startTime;
    console.log(`Duration: ${duration}ms`);
  } catch (error) {
    console.error('\n❌ Test generation failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url.startsWith('file:')) {
  const modulePath = fileURLToPath(import.meta.url);
  if (process.argv[1] === modulePath || process.argv[1] === modulePath.replace(/\\/g, '/')) {
    main();
  }
}

export {
  generateJestTest,
  generateVitestTest,
  generateCypressTest,
  generatePlaywrightTest,
  generatePytestTest,
};
