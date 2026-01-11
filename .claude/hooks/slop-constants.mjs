/**
 * Shared constants for SLOP prevention hooks
 *
 * These constants are used by both file-path-validator and post-session-cleanup
 * to ensure consistent validation across pre-tool and post-tool hooks.
 */

/**
 * Root allowlist - files permitted in project root
 * All other files must go in .claude/ hierarchy
 */
export const ROOT_ALLOWLIST = [
  'package.json',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'README.md',
  'GETTING_STARTED.md',
  'LICENSE',
  '.gitignore',
  '.npmrc',
  '.nvmrc',
  '.editorconfig',
  'tsconfig.json',
  'eslint.config.js',
  '.eslintrc.json',
  'prettier.config.js',
  '.prettierrc',
  'CHANGELOG.md',
  'CONTRIBUTING.md',
  'CODE_OF_CONDUCT.md',
  'SECURITY.md'
];

/**
 * Malformed path patterns
 * These patterns detect corrupted or incorrectly formatted file paths
 */
export const MALFORMED_PATTERNS = [
  // Windows path without separator after drive letter
  // Catches: "Cdev", "C:projects", "Cdevprojects"
  /^C[a-z]/i,

  // Windows reserved names (with or without extensions)
  // Catches: "nul", "nul.txt", "CON", "COM1.log", "LPT1"
  /^(nul|con|prn|aux|com[1-9]|lpt[1-9])(\..*)?$/i,

  // Path segments concatenated without separators
  // Catches: ".claudecontext", "contextartifacts", "reportsanalysis"
  /\.claude[a-zA-Z]/,
  /context[a-zA-Z]/,
  /artifacts[a-zA-Z]/,
  /reports[a-zA-Z]/,
  /tasks[a-zA-Z]/,
  /docs[a-zA-Z]/,
  /skills[a-zA-Z]/,
  /agents[a-zA-Z]/,

  // Multiple concatenated segments (camelCase)
  // Catches: "devProjectsLLM", "claudeContextArtifacts"
  /[a-z]{4,}[A-Z][a-z].*[a-z]{4,}[A-Z]/,
];

/**
 * Prohibited directories
 * Cannot write to these locations
 */
export const PROHIBITED_DIRS = [
  'node_modules/',
  '.git/',
  'dist/',
  'build/',
  'out/',
  '.next/',
  '.nuxt/',
  'coverage/',
  'target/',
  'bin/',
  'obj/'
];

/**
 * Bash file creation patterns
 * Commands that create files via redirects
 */
export const BASH_FILE_CREATION_PATTERNS = [
  // echo "..." > file
  /echo\s+["'].*["']\s*>\s*[^\s&|;]+/,

  // cat <<EOF > file or cat > file
  /cat\s+(?:<<\s*\w+\s*)?>\s*[^\s&|;]+/,

  // printf "..." > file
  /printf\s+.*\s*>\s*[^\s&|;]+/,

  // tee file (writes stdin to file)
  /\|\s*tee\s+[^\s&|;]+/,

  // sed -i (in-place edit creates file)
  /sed\s+-i/,

  // awk with redirect
  /awk\s+.*\s*>\s*[^\s&|;]+/,

  // Heredoc with redirect
  /<<\s*['"]?\w+['"]?\s*>\s*[^\s&|;]+/,
];
