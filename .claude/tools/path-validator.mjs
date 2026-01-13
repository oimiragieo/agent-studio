/**
 * Path Validator - Prevents nested .claude folders and other path issues
 * Use this in all tools that create directories or files in .claude/
 */

/**
 * Validates that a path doesn't contain nested .claude folders
 * @param {string} pathToValidate - The path to validate
 * @param {string} context - Context for error message (e.g., 'PROJECT_ROOT', 'TEMP_DIR')
 * @throws {Error} If nested .claude folder detected
 */
export function validateNoNestedClaude(pathToValidate, context = 'Path') {
  // Normalize path for consistent checking (handle both / and \)
  const normalizedPath = pathToValidate.replace(/\\/g, '/');

  if (normalizedPath.includes('.claude/.claude')) {
    throw new Error(
      `FATAL: Nested .claude folder detected in ${context}!\n` +
        `Path: ${pathToValidate}\n` +
        `Normalized: ${normalizedPath}\n` +
        `This indicates incorrect path resolution. Check __dirname and path.resolve logic.\n` +
        `The .claude folder should only appear ONCE in the path.`
    );
  }

  return true;
}

/**
 * Validates that a path is within the project and doesn't escape
 * @param {string} pathToValidate - The path to validate
 * @param {string} projectRoot - The project root directory
 * @throws {Error} If path escapes project root
 */
export function validateWithinProject(pathToValidate, projectRoot) {
  const normalizedPath = pathToValidate.replace(/\\/g, '/');
  const normalizedRoot = projectRoot.replace(/\\/g, '/');

  if (!normalizedPath.startsWith(normalizedRoot)) {
    throw new Error(
      `FATAL: Path escapes project root!\n` +
        `Path: ${pathToValidate}\n` +
        `Project Root: ${projectRoot}\n` +
        `This indicates a path traversal issue.`
    );
  }

  return true;
}

/**
 * Comprehensive path validation for .claude tools
 * @param {Object} paths - Object containing paths to validate
 * @param {string} paths.projectRoot - Project root path
 * @param {string} paths.claudeDir - .claude directory path
 * @param {string} [paths.tempDir] - Temp directory path (optional)
 * @throws {Error} If any validation fails
 */
export function validateClaudePaths({ projectRoot, claudeDir, tempDir }) {
  validateNoNestedClaude(projectRoot, 'PROJECT_ROOT');
  validateNoNestedClaude(claudeDir, 'CLAUDE_DIR');

  if (tempDir) {
    validateNoNestedClaude(tempDir, 'TEMP_DIR');
    validateWithinProject(tempDir, projectRoot);
  }

  validateWithinProject(claudeDir, projectRoot);

  // Ensure .claude is exactly one level deep from project root
  const normalizedRoot = projectRoot.replace(/\\/g, '/');
  const normalizedClaude = claudeDir.replace(/\\/g, '/');
  const expectedClaude = normalizedRoot + '/.claude';

  if (normalizedClaude !== expectedClaude) {
    throw new Error(
      `FATAL: .claude directory in wrong location!\n` +
        `Expected: ${expectedClaude}\n` +
        `Actual: ${normalizedClaude}\n` +
        `This indicates incorrect path resolution.`
    );
  }

  return true;
}
