/**
 * Dependency Detector
 *
 * Analyzes dependencies from multiple package managers:
 * - Node.js: package.json, package-lock.json, pnpm-lock.yaml, yarn.lock
 * - Python: requirements.txt, pyproject.toml, Pipfile
 * - Go: go.mod
 * - Rust: Cargo.toml
 * - Java: pom.xml, build.gradle
 *
 * @version 1.0.0
 */

/**
 * Parse Node.js dependencies from package.json
 */
export function parsePackageJson(packageJson) {
  const dependencies = {
    production: {},
    development: {},
    peer: {},
    optional: {},
  };

  if (packageJson.dependencies) {
    dependencies.production = packageJson.dependencies;
  }

  if (packageJson.devDependencies) {
    dependencies.development = packageJson.devDependencies;
  }

  if (packageJson.peerDependencies) {
    dependencies.peer = packageJson.peerDependencies;
  }

  if (packageJson.optionalDependencies) {
    dependencies.optional = packageJson.optionalDependencies;
  }

  return {
    type: 'nodejs',
    manager: detectPackageManager(packageJson),
    dependencies,
    totalProduction: Object.keys(dependencies.production).length,
    totalDevelopment: Object.keys(dependencies.development).length,
  };
}

/**
 * Detect package manager from package.json
 */
function detectPackageManager(packageJson) {
  if (packageJson.packageManager) {
    if (packageJson.packageManager.startsWith('pnpm')) return 'pnpm';
    if (packageJson.packageManager.startsWith('yarn')) return 'yarn';
    if (packageJson.packageManager.startsWith('npm')) return 'npm';
  }

  // Default to npm if not specified
  return 'npm';
}

/**
 * Parse Python dependencies from requirements.txt
 */
export function parseRequirementsTxt(content) {
  const dependencies = {
    production: {},
    development: {},
  };

  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Parse package name and version
    const match = trimmed.match(/^([a-zA-Z0-9_-]+)([>=<~!]*)([0-9.]*)/);
    if (!match) continue;

    const [, packageName, operator, version] = match;

    // Development dependencies typically have "dev" in the name or are test-related
    const isDev =
      packageName.toLowerCase().includes('test') ||
      packageName.toLowerCase().includes('dev') ||
      packageName.toLowerCase().includes('pytest') ||
      packageName.toLowerCase().includes('coverage');

    const versionSpec = operator && version ? `${operator}${version}` : '*';

    if (isDev) {
      dependencies.development[packageName] = versionSpec;
    } else {
      dependencies.production[packageName] = versionSpec;
    }
  }

  return {
    type: 'python',
    manager: 'pip',
    dependencies,
    totalProduction: Object.keys(dependencies.production).length,
    totalDevelopment: Object.keys(dependencies.development).length,
  };
}

/**
 * Parse Python dependencies from pyproject.toml
 */
export function parsePyprojectToml(content) {
  const dependencies = {
    production: {},
    development: {},
  };

  // Parse [project.dependencies]
  const prodMatch = content.match(/\[project\.dependencies\]([\s\S]*?)(?:\[|$)/);
  if (prodMatch) {
    const deps = parseTOMLDependencies(prodMatch[1]);
    dependencies.production = deps;
  }

  // Parse [project.optional-dependencies.dev] or similar
  const devMatch = content.match(
    /\[project\.optional-dependencies\.(?:dev|test)\]([\s\S]*?)(?:\[|$)/
  );
  if (devMatch) {
    const deps = parseTOMLDependencies(devMatch[1]);
    dependencies.development = deps;
  }

  return {
    type: 'python',
    manager: 'poetry',
    dependencies,
    totalProduction: Object.keys(dependencies.production).length,
    totalDevelopment: Object.keys(dependencies.development).length,
  };
}

/**
 * Parse dependencies from TOML format
 */
function parseTOMLDependencies(content) {
  const deps = {};
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Parse line like: "fastapi>=0.100.0" or "fastapi = ">=0.100.0""
    const match = trimmed.match(/"([a-zA-Z0-9_-]+)\s*([>=<~!]*)\s*([0-9.]*)/);
    if (match) {
      const [, packageName, operator, version] = match;
      const versionSpec = operator && version ? `${operator}${version}` : '*';
      deps[packageName] = versionSpec;
    }
  }

  return deps;
}

/**
 * Parse Go dependencies from go.mod
 */
export function parseGoMod(content) {
  const dependencies = {
    production: {},
    development: {},
  };

  const lines = content.split('\n');
  let inRequire = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('require (')) {
      inRequire = true;
      continue;
    }

    if (inRequire && trimmed === ')') {
      inRequire = false;
      continue;
    }

    if (inRequire || trimmed.startsWith('require ')) {
      // Parse line like: "github.com/pkg/errors v0.9.1"
      const match = trimmed.match(/([a-zA-Z0-9._/-]+)\s+v([0-9.]+)/);
      if (match) {
        const [, packageName, version] = match;
        dependencies.production[packageName] = `v${version}`;
      }
    }
  }

  return {
    type: 'go',
    manager: 'go',
    dependencies,
    totalProduction: Object.keys(dependencies.production).length,
    totalDevelopment: 0,
  };
}

/**
 * Parse Rust dependencies from Cargo.toml
 */
export function parseCargoToml(content) {
  const dependencies = {
    production: {},
    development: {},
  };

  // Parse [dependencies]
  const prodMatch = content.match(/\[dependencies\]([\s\S]*?)(?:\[|$)/);
  if (prodMatch) {
    const deps = parseTOMLDependencies(prodMatch[1]);
    dependencies.production = deps;
  }

  // Parse [dev-dependencies]
  const devMatch = content.match(/\[dev-dependencies\]([\s\S]*?)(?:\[|$)/);
  if (devMatch) {
    const deps = parseTOMLDependencies(devMatch[1]);
    dependencies.development = deps;
  }

  return {
    type: 'rust',
    manager: 'cargo',
    dependencies,
    totalProduction: Object.keys(dependencies.production).length,
    totalDevelopment: Object.keys(dependencies.development).length,
  };
}

/**
 * Parse Java dependencies from pom.xml
 */
export function parsePomXml(content) {
  const dependencies = {
    production: {},
    development: {},
  };

  // Simple regex parsing for <dependency> blocks
  const depMatches = content.matchAll(/<dependency>([\s\S]*?)<\/dependency>/g);

  for (const match of depMatches) {
    const depBlock = match[1];

    const groupIdMatch = depBlock.match(/<groupId>(.*?)<\/groupId>/);
    const artifactIdMatch = depBlock.match(/<artifactId>(.*?)<\/artifactId>/);
    const versionMatch = depBlock.match(/<version>(.*?)<\/version>/);
    const scopeMatch = depBlock.match(/<scope>(.*?)<\/scope>/);

    if (groupIdMatch && artifactIdMatch) {
      const packageName = `${groupIdMatch[1]}:${artifactIdMatch[1]}`;
      const version = versionMatch ? versionMatch[1] : '*';
      const scope = scopeMatch ? scopeMatch[1] : 'compile';

      if (scope === 'test') {
        dependencies.development[packageName] = version;
      } else {
        dependencies.production[packageName] = version;
      }
    }
  }

  return {
    type: 'java',
    manager: 'maven',
    dependencies,
    totalProduction: Object.keys(dependencies.production).length,
    totalDevelopment: Object.keys(dependencies.development).length,
  };
}

/**
 * Parse Java dependencies from build.gradle
 */
export function parseBuildGradle(content) {
  const dependencies = {
    production: {},
    development: {},
  };

  // Parse implementation, api, compileOnly, testImplementation, etc.
  const depLines = content.match(
    /\s+(implementation|api|compileOnly|testImplementation|androidTestImplementation)\s+['"]([^'"]+)['"]/g
  );

  if (depLines) {
    for (const line of depLines) {
      const match = line.match(
        /(implementation|api|compileOnly|testImplementation|androidTestImplementation)\s+['"]([^'"]+)['"]/
      );
      if (match) {
        const [, scope, dependency] = match;
        const isTest = scope.toLowerCase().includes('test');

        if (isTest) {
          dependencies.development[dependency] = '*';
        } else {
          dependencies.production[dependency] = '*';
        }
      }
    }
  }

  return {
    type: 'java',
    manager: 'gradle',
    dependencies,
    totalProduction: Object.keys(dependencies.production).length,
    totalDevelopment: Object.keys(dependencies.development).length,
  };
}

/**
 * Main dependency analysis function
 */
export function analyzeDependencies(manifests) {
  const results = [];

  // Node.js
  if (manifests['package.json']) {
    const parsed = parsePackageJson(manifests['package.json']);
    results.push(parsed);
  }

  // Python
  if (manifests['requirements.txt']) {
    const parsed = parseRequirementsTxt(manifests['requirements.txt']);
    results.push(parsed);
  }

  if (manifests['pyproject.toml']) {
    const parsed = parsePyprojectToml(manifests['pyproject.toml']);
    results.push(parsed);
  }

  // Go
  if (manifests['go.mod']) {
    const parsed = parseGoMod(manifests['go.mod']);
    results.push(parsed);
  }

  // Rust
  if (manifests['Cargo.toml']) {
    const parsed = parseCargoToml(manifests['Cargo.toml']);
    results.push(parsed);
  }

  // Java
  if (manifests['pom.xml']) {
    const parsed = parsePomXml(manifests['pom.xml']);
    results.push(parsed);
  }

  if (manifests['build.gradle']) {
    const parsed = parseBuildGradle(manifests['build.gradle']);
    results.push(parsed);
  }

  // Aggregate results
  return aggregateDependencies(results);
}

/**
 * Aggregate dependency counts across all package managers
 */
function aggregateDependencies(results) {
  if (results.length === 0) {
    return {
      production: 0,
      development: 0,
    };
  }

  // If single package manager, return its counts
  if (results.length === 1) {
    return {
      production: results[0].totalProduction,
      development: results[0].totalDevelopment,
    };
  }

  // Multiple package managers (e.g., monorepo)
  let totalProduction = 0;
  let totalDevelopment = 0;

  for (const result of results) {
    totalProduction += result.totalProduction;
    totalDevelopment += result.totalDevelopment;
  }

  return {
    production: totalProduction,
    development: totalDevelopment,
  };
}
