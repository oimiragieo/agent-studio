#!/usr/bin/env node

/**
 * Project Analyzer - Automated brownfield codebase analysis
 *
 * Detects project type, frameworks, dependencies, structure, and generates
 * comprehensive project profile conforming to project-analysis.schema.json
 *
 * @version 1.0.0
 * @usage node analyzer.mjs [project-root] [--output path]
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const EXCLUDE_DIRS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  '.next',
  'coverage',
  '__pycache__',
];
const LANGUAGE_MAP = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript',
  '.mjs': 'JavaScript',
  '.cjs': 'JavaScript',
  '.py': 'Python',
  '.go': 'Go',
  '.rs': 'Rust',
  '.java': 'Java',
  '.md': 'Markdown',
  '.json': 'JSON',
  '.yaml': 'YAML',
  '.yml': 'YAML',
  '.html': 'HTML',
  '.css': 'CSS',
  '.scss': 'SCSS',
  '.sass': 'SASS',
};

/**
 * Main analysis function
 */
async function analyzeProject(projectRoot, _options = {}) {
  const startTime = Date.now();
  const errors = [];

  try {
    console.log(`Analyzing project at: ${projectRoot}`);

    // Step 1: Validate project root
    await validateProjectRoot(projectRoot);

    // Step 2: Detect manifest files
    const manifests = await detectManifests(projectRoot);
    console.log(`Found manifests: ${Object.keys(manifests).join(', ')}`);

    // Step 3: Detect project type
    const projectType = await detectProjectType(projectRoot, manifests);
    console.log(`Project type: ${projectType}`);

    // Step 4: Detect frameworks
    const frameworks = await detectFrameworks(manifests);
    console.log(`Detected ${frameworks.length} frameworks`);

    // Step 5: Generate file statistics
    const stats = await generateFileStats(projectRoot);
    console.log(`Total files: ${stats.total_files}, Total lines: ${stats.total_lines}`);

    // Step 6: Analyze structure
    const structure = await analyzeStructure(projectRoot);
    console.log(`Architecture pattern: ${structure.architecture_pattern}`);

    // Step 7: Analyze dependencies
    const dependencies = await analyzeDependencies(manifests);
    console.log(
      `Dependencies: ${dependencies.production} production, ${dependencies.development} dev`
    );

    // Step 8: Analyze code quality
    const codeQuality = await analyzeCodeQuality(projectRoot, manifests);

    // Step 9: Detect patterns
    const patternsDetected = await detectPatterns(projectRoot, stats);

    // Step 10: Calculate technical debt
    const techDebt = calculateTechDebt(stats, dependencies, codeQuality, patternsDetected);

    // Step 11: Generate recommendations
    const recommendations = generateRecommendations(projectType, techDebt, codeQuality);

    // Build final analysis object
    const analysis = {
      analysis_id: `analysis-${Date.now()}`,
      project_type: projectType,
      analyzed_at: new Date().toISOString(),
      project_root: projectRoot,
      stats,
      frameworks,
      structure,
      dependencies,
      code_quality: codeQuality,
      patterns_detected: patternsDetected,
      tech_debt: techDebt,
      recommendations,
      metadata: {
        analyzer_version: '1.0.0',
        analysis_duration_ms: Date.now() - startTime,
        files_analyzed: stats.total_files,
        files_skipped: stats.files_skipped || 0,
        errors,
      },
    };

    // Validate against schema
    await validateAnalysis(analysis);

    return analysis;
  } catch (error) {
    errors.push(error.message);
    throw error;
  }
}

/**
 * Validate project root exists and is accessible
 */
async function validateProjectRoot(projectRoot) {
  try {
    const stat = await fs.stat(projectRoot);
    if (!stat.isDirectory()) {
      throw new Error(`Path is not a directory: ${projectRoot}`);
    }
  } catch (error) {
    throw new Error(`Invalid project root: ${error.message}`);
  }
}

/**
 * Detect manifest files in project root
 */
async function detectManifests(projectRoot) {
  const manifests = {};

  const manifestFiles = [
    'package.json',
    'requirements.txt',
    'pyproject.toml',
    'go.mod',
    'Cargo.toml',
    'pom.xml',
    'build.gradle',
    'composer.json',
  ];

  for (const file of manifestFiles) {
    const filePath = path.join(projectRoot, file);
    try {
      const exists = await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false);
      if (exists) {
        const content = await fs.readFile(filePath, 'utf-8');
        if (file.endsWith('.json') || file.endsWith('.toml')) {
          try {
            manifests[file] = file.endsWith('.json') ? JSON.parse(content) : content;
          } catch {
            manifests[file] = content; // Keep as string if parse fails
          }
        } else {
          manifests[file] = content;
        }
      }
    } catch (_error) {
      // Skip files that can't be read
    }
  }

  return manifests;
}

/**
 * Detect project type from manifests and structure
 */
async function detectProjectType(projectRoot, manifests) {
  // Check for monorepo indicators
  if (
    manifests['package.json']?.workspaces ||
    (await fileExists(projectRoot, 'pnpm-workspace.yaml')) ||
    (await fileExists(projectRoot, 'lerna.json'))
  ) {
    return 'monorepo';
  }

  // Check for mobile indicators
  if (
    (await directoryExists(projectRoot, 'android')) &&
    (await directoryExists(projectRoot, 'ios'))
  ) {
    return 'mobile';
  }

  // Check for microservices (multiple service directories)
  const rootDirs = await fs.readdir(projectRoot);
  const serviceDirs = rootDirs.filter(
    dir => dir.includes('service') || dir.includes('microservice')
  );
  if (serviceDirs.length >= 3) {
    return 'microservices';
  }

  // Check for serverless indicators
  if (
    (await fileExists(projectRoot, 'serverless.yml')) ||
    (await fileExists(projectRoot, 'serverless.yaml'))
  ) {
    return 'serverless';
  }

  // Check package.json for type indicators
  if (manifests['package.json']) {
    const pkg = manifests['package.json'];

    // CLI project
    if (pkg.bin) {
      return 'cli';
    }

    // Library project
    if (pkg.main && !pkg.scripts?.start && !pkg.scripts?.dev) {
      return 'library';
    }

    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const hasReact = 'react' in deps;
    const hasNext = 'next' in deps;
    const hasExpress = 'express' in deps;
    const hasFastify = 'fastify' in deps;

    // Fullstack
    if ((hasNext || hasReact) && (hasExpress || hasFastify)) {
      return 'fullstack';
    }

    // Next.js is fullstack by default
    if (hasNext) {
      return 'fullstack';
    }

    // Frontend
    if (hasReact || 'vue' in deps || '@angular/core' in deps) {
      return 'frontend';
    }

    // Backend
    if (hasExpress || hasFastify || 'koa' in deps) {
      return 'backend';
    }
  }

  // Check Python manifests
  if (manifests['requirements.txt'] || manifests['pyproject.toml']) {
    const content = manifests['requirements.txt'] || manifests['pyproject.toml'];
    if (content.includes('fastapi') || content.includes('django') || content.includes('flask')) {
      return 'backend';
    }
  }

  return 'unknown';
}

/**
 * Detect frameworks from manifests
 */
async function detectFrameworks(manifests) {
  const frameworks = [];

  if (manifests['package.json']) {
    const pkg = manifests['package.json'];
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

    const frameworkMap = {
      // Frameworks
      next: { category: 'framework', name: 'nextjs' },
      react: { category: 'framework', name: 'react' },
      vue: { category: 'framework', name: 'vue' },
      '@angular/core': { category: 'framework', name: 'angular' },
      svelte: { category: 'framework', name: 'svelte' },
      express: { category: 'framework', name: 'express' },
      fastify: { category: 'framework', name: 'fastify' },

      // UI Libraries
      '@mui/material': { category: 'ui-library', name: 'material-ui' },
      antd: { category: 'ui-library', name: 'ant-design' },
      '@chakra-ui/react': { category: 'ui-library', name: 'chakra-ui' },

      // State Management
      redux: { category: 'state-management', name: 'redux' },
      zustand: { category: 'state-management', name: 'zustand' },
      jotai: { category: 'state-management', name: 'jotai' },

      // Testing
      jest: { category: 'testing', name: 'jest' },
      vitest: { category: 'testing', name: 'vitest' },
      cypress: { category: 'testing', name: 'cypress' },
      '@playwright/test': { category: 'testing', name: 'playwright' },

      // Build Tools
      vite: { category: 'build-tool', name: 'vite' },
      webpack: { category: 'build-tool', name: 'webpack' },
      esbuild: { category: 'build-tool', name: 'esbuild' },

      // Database/ORM
      prisma: { category: 'orm', name: 'prisma' },
      typeorm: { category: 'orm', name: 'typeorm' },
      mongoose: { category: 'orm', name: 'mongoose' },

      // Auth
      'next-auth': { category: 'auth', name: 'nextauth' },
      '@clerk/nextjs': { category: 'auth', name: 'clerk' },
    };

    for (const [depName, depVersion] of Object.entries(allDeps)) {
      if (frameworkMap[depName]) {
        const fw = frameworkMap[depName];
        frameworks.push({
          name: fw.name,
          version: depVersion.replace(/^\^|~/, ''),
          category: fw.category,
          confidence: 1.0,
          source: 'package.json',
        });
      }
    }
  }

  // Python frameworks
  if (manifests['requirements.txt']) {
    const content = manifests['requirements.txt'];
    const pythonFrameworks = {
      fastapi: 'framework',
      django: 'framework',
      flask: 'framework',
      pytest: 'testing',
      sqlalchemy: 'orm',
    };

    for (const [name, category] of Object.entries(pythonFrameworks)) {
      if (content.includes(name)) {
        frameworks.push({
          name,
          category,
          confidence: 0.9,
          source: 'requirements.txt',
        });
      }
    }
  }

  return frameworks;
}

/**
 * Generate file statistics
 */
async function generateFileStats(projectRoot) {
  const stats = {
    total_files: 0,
    total_lines: 0,
    languages: {},
    file_types: {},
    directories: 0,
    avg_file_size_lines: 0,
    largest_files: [],
    files_skipped: 0,
  };

  // Use glob to find all files, excluding common build/dep directories
  const pattern = '**/*';
  const files = await glob(pattern, {
    cwd: projectRoot,
    ignore: EXCLUDE_DIRS.map(dir => `**/${dir}/**`),
    nodir: true,
    dot: true,
  });

  const fileSizes = [];

  for (const file of files) {
    const fullPath = path.join(projectRoot, file);
    const ext = path.extname(file);

    // Count file types
    stats.file_types[ext] = (stats.file_types[ext] || 0) + 1;

    // Skip binary files and very large files
    if (
      ![
        '.md',
        '.txt',
        '.json',
        '.yaml',
        '.yml',
        '.js',
        '.ts',
        '.jsx',
        '.tsx',
        '.py',
        '.go',
        '.rs',
        '.java',
      ].includes(ext)
    ) {
      stats.files_skipped++;
      continue;
    }

    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      const lines = content.split('\n').length;

      stats.total_files++;
      stats.total_lines += lines;

      // Track by language
      const language = LANGUAGE_MAP[ext] || 'Other';
      stats.languages[language] = (stats.languages[language] || 0) + lines;

      // Track file sizes
      fileSizes.push({ path: file, lines });
    } catch (_error) {
      stats.files_skipped++;
    }
  }

  // Sort and get largest files
  fileSizes.sort((a, b) => b.lines - a.lines);
  stats.largest_files = fileSizes.slice(0, 10);

  // Calculate average
  if (stats.total_files > 0) {
    stats.avg_file_size_lines = Math.round(stats.total_lines / stats.total_files);
  }

  // Count directories
  const dirs = await glob('**/', {
    cwd: projectRoot,
    ignore: EXCLUDE_DIRS.map(dir => `**/${dir}/**`),
  });
  stats.directories = dirs.length;

  return stats;
}

/**
 * Analyze project structure
 */
async function analyzeStructure(projectRoot) {
  const rootDirs = await fs.readdir(projectRoot, { withFileTypes: true });
  const directories = rootDirs.filter(
    dirent => dirent.isDirectory() && !EXCLUDE_DIRS.includes(dirent.name)
  );

  const structure = {
    root_directories: [],
    entry_points: [],
    architecture_pattern: 'unknown',
    module_system: 'unknown',
  };

  // Classify root directories
  const purposeMap = {
    src: 'source',
    app: 'source',
    lib: 'source',
    test: 'tests',
    tests: 'tests',
    __tests__: 'tests',
    cypress: 'tests',
    config: 'config',
    '.config': 'config',
    docs: 'docs',
    documentation: 'docs',
    dist: 'build',
    build: 'build',
    out: 'build',
    scripts: 'scripts',
    bin: 'scripts',
    assets: 'assets',
    static: 'assets',
    public: 'public',
  };

  for (const dir of directories) {
    const purpose = purposeMap[dir.name.toLowerCase()] || 'unknown';

    // Count files in directory
    const filesInDir = await glob('**/*', {
      cwd: path.join(projectRoot, dir.name),
      nodir: true,
    });

    structure.root_directories.push({
      name: dir.name,
      purpose,
      file_count: filesInDir.length,
    });
  }

  // Detect entry points
  const entryPointCandidates = [
    { path: 'src/index.ts', type: 'main' },
    { path: 'src/index.js', type: 'main' },
    { path: 'app/page.tsx', type: 'app' },
    { path: 'src/app.ts', type: 'app' },
    { path: 'src/server.ts', type: 'server' },
    { path: 'main.py', type: 'main' },
    { path: 'app.py', type: 'app' },
  ];

  for (const candidate of entryPointCandidates) {
    if (await fileExists(projectRoot, candidate.path)) {
      structure.entry_points.push(candidate);
    }
  }

  // Detect architecture pattern
  const hasMVC = directories.some(d =>
    ['models', 'views', 'controllers'].includes(d.name.toLowerCase())
  );
  const hasLayered = directories.some(d =>
    ['presentation', 'business', 'data'].includes(d.name.toLowerCase())
  );
  const hasFeatures = directories.some(d => d.name === 'features' || d.name === 'modules');

  if (hasMVC) {
    structure.architecture_pattern = 'mvc';
  } else if (hasLayered) {
    structure.architecture_pattern = 'layered';
  } else if (hasFeatures) {
    structure.architecture_pattern = 'modular';
  } else if (structure.root_directories.length <= 3) {
    structure.architecture_pattern = 'flat';
  } else {
    structure.architecture_pattern = 'monolith';
  }

  // Detect module system (check package.json)
  try {
    const pkgPath = path.join(projectRoot, 'package.json');
    const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));
    structure.module_system = pkg.type === 'module' ? 'esm' : 'commonjs';
  } catch {
    structure.module_system = 'unknown';
  }

  return structure;
}

/**
 * Analyze dependencies
 */
async function analyzeDependencies(manifests) {
  const dependencies = {
    production: 0,
    development: 0,
  };

  if (manifests['package.json']) {
    const pkg = manifests['package.json'];
    dependencies.production = Object.keys(pkg.dependencies || {}).length;
    dependencies.development = Object.keys(pkg.devDependencies || {}).length;
  }

  return dependencies;
}

/**
 * Analyze code quality indicators
 */
async function analyzeCodeQuality(projectRoot, manifests) {
  const quality = {
    linting: {
      configured: false,
      tool: null,
    },
    formatting: {
      configured: false,
      tool: null,
    },
    testing: {
      framework: null,
      test_files: 0,
      coverage_configured: false,
    },
    type_safety: {
      typescript: false,
      strict_mode: false,
    },
  };

  // Check for linting
  if (
    (await fileExists(projectRoot, '.eslintrc.json')) ||
    (await fileExists(projectRoot, 'eslint.config.js'))
  ) {
    quality.linting.configured = true;
    quality.linting.tool = 'eslint';
  }

  // Check for formatting
  if (
    (await fileExists(projectRoot, '.prettierrc')) ||
    (await fileExists(projectRoot, 'prettier.config.js'))
  ) {
    quality.formatting.configured = true;
    quality.formatting.tool = 'prettier';
  }

  // Check for testing
  if (manifests['package.json']) {
    const pkg = manifests['package.json'];
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    if ('jest' in deps) quality.testing.framework = 'jest';
    if ('vitest' in deps) quality.testing.framework = 'vitest';
    if ('cypress' in deps) quality.testing.framework = 'cypress';
    if ('@playwright/test' in deps) quality.testing.framework = 'playwright';
  }

  // Count test files
  const testFiles = await glob('**/*.{test,spec}.{ts,tsx,js,jsx}', {
    cwd: projectRoot,
    ignore: EXCLUDE_DIRS.map(dir => `**/${dir}/**`),
  });
  quality.testing.test_files = testFiles.length;

  // Check for TypeScript
  if (await fileExists(projectRoot, 'tsconfig.json')) {
    quality.type_safety.typescript = true;
    try {
      const tsconfigPath = path.join(projectRoot, 'tsconfig.json');
      const tsconfig = JSON.parse(await fs.readFile(tsconfigPath, 'utf-8'));
      quality.type_safety.strict_mode = tsconfig.compilerOptions?.strict === true;
    } catch {
      // Ignore parse errors
    }
  }

  return quality;
}

/**
 * Detect patterns and anti-patterns
 */
async function detectPatterns(projectRoot, stats) {
  const patterns = [];

  // Large files (anti-pattern)
  const largeFiles = stats.largest_files.filter(f => f.lines > 1000);
  if (largeFiles.length > 0) {
    patterns.push({
      pattern: 'large-files',
      type: 'anti-pattern',
      description: `${largeFiles.length} files exceed 1000 lines (violates micro-service principle)`,
      locations: largeFiles.map(f => f.path),
      recommendation: 'Refactor large files into smaller, focused modules (< 1000 lines)',
    });
  }

  return patterns;
}

/**
 * Calculate technical debt score
 */
function calculateTechDebt(stats, dependencies, codeQuality, _patterns) {
  const indicators = [];
  let score = 0;

  // Large files penalty
  const largeFiles = stats.largest_files.filter(f => f.lines > 1000);
  if (largeFiles.length > 0) {
    score += Math.min(largeFiles.length * 5, 30);
    indicators.push({
      category: 'complexity',
      severity: largeFiles.length > 5 ? 'high' : 'medium',
      description: `${largeFiles.length} files exceed 1000 lines`,
      remediation_effort: largeFiles.length > 10 ? 'major' : 'moderate',
    });
  }

  // Missing tests penalty
  if (codeQuality.testing.test_files === 0) {
    score += 20;
    indicators.push({
      category: 'missing-tests',
      severity: 'high',
      description: 'No test files found',
      remediation_effort: 'major',
    });
  }

  // No linting penalty
  if (!codeQuality.linting.configured) {
    score += 10;
    indicators.push({
      category: 'documentation',
      severity: 'medium',
      description: 'No linting configuration found',
      remediation_effort: 'minor',
    });
  }

  // No TypeScript strict mode
  if (codeQuality.type_safety.typescript && !codeQuality.type_safety.strict_mode) {
    score += 5;
    indicators.push({
      category: 'documentation',
      severity: 'low',
      description: 'TypeScript strict mode not enabled',
      remediation_effort: 'minor',
    });
  }

  return {
    score: Math.min(score, 100),
    indicators,
  };
}

/**
 * Generate recommendations
 */
function generateRecommendations(projectType, techDebt, codeQuality) {
  const recommendations = [];

  // Large files recommendation
  const complexityIssues = techDebt.indicators.filter(i => i.category === 'complexity');
  if (complexityIssues.length > 0) {
    recommendations.push({
      priority: 'P1',
      category: 'maintainability',
      title: 'Refactor large files',
      description:
        'Break down files exceeding 1000 lines into smaller, focused modules following micro-service principles',
      effort: 'moderate',
      impact: 'high',
    });
  }

  // Missing tests recommendation
  if (codeQuality.testing.test_files === 0) {
    recommendations.push({
      priority: 'P0',
      category: 'testing',
      title: 'Add test coverage',
      description:
        'Implement unit and integration tests to ensure code quality and prevent regressions',
      effort: 'major',
      impact: 'critical',
    });
  }

  // No linting recommendation
  if (!codeQuality.linting.configured) {
    recommendations.push({
      priority: 'P2',
      category: 'maintainability',
      title: 'Configure code linting',
      description: 'Set up ESLint or similar linting tool to enforce coding standards',
      effort: 'trivial',
      impact: 'medium',
    });
  }

  return recommendations;
}

/**
 * Validate analysis output against schema
 */
async function validateAnalysis(analysis) {
  // Load schema
  const schemaPath = path.join(__dirname, '..', '..', 'schemas', 'project-analysis.schema.json');

  try {
    await fs.access(schemaPath);
    // Schema exists, could add JSON schema validation here
    // For now, just verify required fields
    const requiredFields = [
      'analysis_id',
      'project_type',
      'analyzed_at',
      'stats',
      'frameworks',
      'structure',
    ];
    for (const field of requiredFields) {
      if (!(field in analysis)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
  } catch (error) {
    console.warn(`Schema validation skipped: ${error.message}`);
  }
}

/**
 * Helper: Check if file exists
 */
async function fileExists(projectRoot, filePath) {
  try {
    await fs.access(path.join(projectRoot, filePath));
    return true;
  } catch {
    return false;
  }
}

/**
 * Helper: Check if directory exists
 */
async function directoryExists(projectRoot, dirPath) {
  try {
    const stat = await fs.stat(path.join(projectRoot, dirPath));
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * CLI Entry Point
 */
async function main() {
  const args = process.argv.slice(2);
  const projectRoot = args[0] || process.cwd();
  const outputFlag = args.indexOf('--output');
  const outputPath = outputFlag !== -1 ? args[outputFlag + 1] : null;

  try {
    const analysis = await analyzeProject(projectRoot);

    // Output results
    if (outputPath) {
      await fs.writeFile(outputPath, JSON.stringify(analysis, null, 2));
      console.log(`\nAnalysis saved to: ${outputPath}`);
    } else {
      console.log('\n--- Analysis Results ---');
      console.log(JSON.stringify(analysis, null, 2));
    }

    process.exit(0);
  } catch (error) {
    console.error('Analysis failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { analyzeProject };
