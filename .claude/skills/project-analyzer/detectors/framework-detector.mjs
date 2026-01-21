/**
 * Framework Detector
 *
 * Detects frameworks and libraries from package manifests and code imports.
 * Supports 20+ popular frameworks across multiple ecosystems.
 *
 * @version 1.0.0
 */

/**
 * Framework detection rules
 * Maps package names to framework metadata
 */
export const FRAMEWORK_RULES = {
  // Frontend Frameworks
  next: { name: 'nextjs', category: 'framework', ecosystem: 'react' },
  react: { name: 'react', category: 'framework', ecosystem: 'react' },
  vue: { name: 'vue', category: 'framework', ecosystem: 'vue' },
  '@angular/core': { name: 'angular', category: 'framework', ecosystem: 'angular' },
  svelte: { name: 'svelte', category: 'framework', ecosystem: 'svelte' },
  'solid-js': { name: 'solid', category: 'framework', ecosystem: 'solid' },
  preact: { name: 'preact', category: 'framework', ecosystem: 'preact' },
  qwik: { name: 'qwik', category: 'framework', ecosystem: 'qwik' },

  // Backend Frameworks (Node.js)
  express: { name: 'express', category: 'framework', ecosystem: 'nodejs' },
  fastify: { name: 'fastify', category: 'framework', ecosystem: 'nodejs' },
  koa: { name: 'koa', category: 'framework', ecosystem: 'nodejs' },
  hapi: { name: 'hapi', category: 'framework', ecosystem: 'nodejs' },
  nestjs: { name: 'nestjs', category: 'framework', ecosystem: 'nodejs' },
  '@nestjs/core': { name: 'nestjs', category: 'framework', ecosystem: 'nodejs' },

  // Fullstack Frameworks
  remix: { name: 'remix', category: 'framework', ecosystem: 'react' },
  nuxt: { name: 'nuxt', category: 'framework', ecosystem: 'vue' },
  '@sveltejs/kit': { name: 'sveltekit', category: 'framework', ecosystem: 'svelte' },
  gatsby: { name: 'gatsby', category: 'framework', ecosystem: 'react' },
  astro: { name: 'astro', category: 'framework', ecosystem: 'multi' },

  // UI Libraries
  '@mui/material': { name: 'material-ui', category: 'ui-library', ecosystem: 'react' },
  antd: { name: 'ant-design', category: 'ui-library', ecosystem: 'react' },
  '@chakra-ui/react': { name: 'chakra-ui', category: 'ui-library', ecosystem: 'react' },
  '@radix-ui/react-primitive': { name: 'radix-ui', category: 'ui-library', ecosystem: 'react' },
  '@headlessui/react': { name: 'headlessui', category: 'ui-library', ecosystem: 'react' },
  '@mantine/core': { name: 'mantine', category: 'ui-library', ecosystem: 'react' },
  vuetify: { name: 'vuetify', category: 'ui-library', ecosystem: 'vue' },
  'element-plus': { name: 'element-plus', category: 'ui-library', ecosystem: 'vue' },

  // State Management
  redux: { name: 'redux', category: 'state-management', ecosystem: 'react' },
  '@reduxjs/toolkit': { name: 'redux-toolkit', category: 'state-management', ecosystem: 'react' },
  zustand: { name: 'zustand', category: 'state-management', ecosystem: 'react' },
  jotai: { name: 'jotai', category: 'state-management', ecosystem: 'react' },
  recoil: { name: 'recoil', category: 'state-management', ecosystem: 'react' },
  mobx: { name: 'mobx', category: 'state-management', ecosystem: 'multi' },
  xstate: { name: 'xstate', category: 'state-management', ecosystem: 'multi' },
  pinia: { name: 'pinia', category: 'state-management', ecosystem: 'vue' },

  // Testing Frameworks
  jest: { name: 'jest', category: 'testing', ecosystem: 'multi' },
  vitest: { name: 'vitest', category: 'testing', ecosystem: 'multi' },
  '@testing-library/react': {
    name: 'react-testing-library',
    category: 'testing',
    ecosystem: 'react',
  },
  cypress: { name: 'cypress', category: 'testing', ecosystem: 'multi' },
  '@playwright/test': { name: 'playwright', category: 'testing', ecosystem: 'multi' },
  mocha: { name: 'mocha', category: 'testing', ecosystem: 'multi' },
  chai: { name: 'chai', category: 'testing', ecosystem: 'multi' },
  supertest: { name: 'supertest', category: 'testing', ecosystem: 'nodejs' },

  // Build Tools
  vite: { name: 'vite', category: 'build-tool', ecosystem: 'multi' },
  webpack: { name: 'webpack', category: 'build-tool', ecosystem: 'multi' },
  esbuild: { name: 'esbuild', category: 'build-tool', ecosystem: 'multi' },
  rollup: { name: 'rollup', category: 'build-tool', ecosystem: 'multi' },
  parcel: { name: 'parcel', category: 'build-tool', ecosystem: 'multi' },
  turbopack: { name: 'turbopack', category: 'build-tool', ecosystem: 'multi' },
  tsup: { name: 'tsup', category: 'build-tool', ecosystem: 'typescript' },

  // Database & ORM
  prisma: { name: 'prisma', category: 'orm', ecosystem: 'nodejs' },
  '@prisma/client': { name: 'prisma', category: 'orm', ecosystem: 'nodejs' },
  typeorm: { name: 'typeorm', category: 'orm', ecosystem: 'nodejs' },
  sequelize: { name: 'sequelize', category: 'orm', ecosystem: 'nodejs' },
  mongoose: { name: 'mongoose', category: 'orm', ecosystem: 'nodejs' },
  'drizzle-orm': { name: 'drizzle', category: 'orm', ecosystem: 'nodejs' },
  kysely: { name: 'kysely', category: 'database', ecosystem: 'nodejs' },

  // API
  graphql: { name: 'graphql', category: 'api', ecosystem: 'multi' },
  '@apollo/client': { name: 'apollo-client', category: 'api', ecosystem: 'react' },
  '@trpc/server': { name: 'trpc', category: 'api', ecosystem: 'nodejs' },
  axios: { name: 'axios', category: 'utility', ecosystem: 'multi' },
  '@tanstack/react-query': { name: 'react-query', category: 'api', ecosystem: 'react' },
  swr: { name: 'swr', category: 'api', ecosystem: 'react' },

  // Auth
  'next-auth': { name: 'nextauth', category: 'auth', ecosystem: 'nextjs' },
  '@clerk/nextjs': { name: 'clerk', category: 'auth', ecosystem: 'nextjs' },
  passport: { name: 'passport', category: 'auth', ecosystem: 'nodejs' },
  jsonwebtoken: { name: 'jwt', category: 'auth', ecosystem: 'nodejs' },
  bcrypt: { name: 'bcrypt', category: 'auth', ecosystem: 'nodejs' },

  // Logging
  winston: { name: 'winston', category: 'logging', ecosystem: 'nodejs' },
  pino: { name: 'pino', category: 'logging', ecosystem: 'nodejs' },
  bunyan: { name: 'bunyan', category: 'logging', ecosystem: 'nodejs' },

  // Monitoring
  '@sentry/nextjs': { name: 'sentry', category: 'monitoring', ecosystem: 'multi' },
  '@sentry/node': { name: 'sentry', category: 'monitoring', ecosystem: 'nodejs' },
  'dd-trace': { name: 'datadog', category: 'monitoring', ecosystem: 'nodejs' },
  newrelic: { name: 'newrelic', category: 'monitoring', ecosystem: 'nodejs' },

  // Utility
  lodash: { name: 'lodash', category: 'utility', ecosystem: 'multi' },
  'date-fns': { name: 'date-fns', category: 'utility', ecosystem: 'multi' },
  dayjs: { name: 'dayjs', category: 'utility', ecosystem: 'multi' },
  zod: { name: 'zod', category: 'utility', ecosystem: 'typescript' },
  yup: { name: 'yup', category: 'utility', ecosystem: 'multi' },
};

/**
 * Python framework detection rules
 */
export const PYTHON_FRAMEWORKS = {
  fastapi: { name: 'fastapi', category: 'framework', ecosystem: 'python' },
  django: { name: 'django', category: 'framework', ecosystem: 'python' },
  flask: { name: 'flask', category: 'framework', ecosystem: 'python' },
  starlette: { name: 'starlette', category: 'framework', ecosystem: 'python' },
  tornado: { name: 'tornado', category: 'framework', ecosystem: 'python' },
  pytest: { name: 'pytest', category: 'testing', ecosystem: 'python' },
  sqlalchemy: { name: 'sqlalchemy', category: 'orm', ecosystem: 'python' },
  pydantic: { name: 'pydantic', category: 'utility', ecosystem: 'python' },
  celery: { name: 'celery', category: 'utility', ecosystem: 'python' },
};

/**
 * Detect frameworks from package.json
 */
export function detectFromPackageJson(packageJson) {
  const frameworks = [];
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  for (const [depName, depVersion] of Object.entries(allDeps || {})) {
    if (FRAMEWORK_RULES[depName]) {
      const rule = FRAMEWORK_RULES[depName];
      frameworks.push({
        name: rule.name,
        version: cleanVersion(depVersion),
        category: rule.category,
        confidence: 1.0,
        source: 'package.json',
        ecosystem: rule.ecosystem,
      });
    }
  }

  return frameworks;
}

/**
 * Detect frameworks from requirements.txt
 */
export function detectFromRequirementsTxt(content) {
  const frameworks = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Parse package name (handle version specifiers)
    const match = trimmed.match(/^([a-zA-Z0-9_-]+)/);
    if (!match) continue;

    const packageName = match[1].toLowerCase();
    if (PYTHON_FRAMEWORKS[packageName]) {
      const rule = PYTHON_FRAMEWORKS[packageName];

      // Try to extract version
      const versionMatch = trimmed.match(/==([0-9.]+)/);
      const version = versionMatch ? versionMatch[1] : undefined;

      frameworks.push({
        name: rule.name,
        version,
        category: rule.category,
        confidence: 0.9,
        source: 'requirements.txt',
        ecosystem: rule.ecosystem,
      });
    }
  }

  return frameworks;
}

/**
 * Detect frameworks from pyproject.toml
 */
export function detectFromPyprojectToml(content) {
  const frameworks = [];

  // Simple regex-based parsing for dependencies section
  const depMatch = content.match(/\[project\.dependencies\]([\s\S]*?)(?:\[|$)/);
  if (!depMatch) return frameworks;

  const depsSection = depMatch[1];
  const lines = depsSection.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Parse package from line like: "fastapi>=0.100.0"
    const match = trimmed.match(/"([a-zA-Z0-9_-]+)/);
    if (!match) continue;

    const packageName = match[1].toLowerCase();
    if (PYTHON_FRAMEWORKS[packageName]) {
      const rule = PYTHON_FRAMEWORKS[packageName];
      frameworks.push({
        name: rule.name,
        category: rule.category,
        confidence: 0.9,
        source: 'pyproject.toml',
        ecosystem: rule.ecosystem,
      });
    }
  }

  return frameworks;
}

/**
 * Clean version string (remove ^, ~, >=, etc.)
 */
function cleanVersion(version) {
  return version.replace(/^[^\d]*/, '').replace(/[^\d.].*$/, '');
}

/**
 * Deduplicate frameworks (prefer higher confidence)
 */
export function deduplicateFrameworks(frameworks) {
  const seen = new Map();

  for (const fw of frameworks) {
    const existing = seen.get(fw.name);
    if (!existing || fw.confidence > existing.confidence) {
      seen.set(fw.name, fw);
    }
  }

  return Array.from(seen.values());
}

/**
 * Main framework detection function
 */
export function detectFrameworks(manifests) {
  let frameworks = [];

  // Detect from package.json
  if (manifests['package.json']) {
    const pkgFrameworks = detectFromPackageJson(manifests['package.json']);
    frameworks.push(...pkgFrameworks);
  }

  // Detect from requirements.txt
  if (manifests['requirements.txt']) {
    const pyFrameworks = detectFromRequirementsTxt(manifests['requirements.txt']);
    frameworks.push(...pyFrameworks);
  }

  // Detect from pyproject.toml
  if (manifests['pyproject.toml']) {
    const pyprojectFrameworks = detectFromPyprojectToml(manifests['pyproject.toml']);
    frameworks.push(...pyprojectFrameworks);
  }

  // Deduplicate
  frameworks = deduplicateFrameworks(frameworks);

  return frameworks;
}
