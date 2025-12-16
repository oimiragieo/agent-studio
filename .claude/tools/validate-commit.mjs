#!/usr/bin/env node
/**
 * Commit Message Validator
 * Programmatic validation tool for Conventional Commits
 * Implements the commit-validator skill
 */

const CONVENTIONAL_COMMIT_REGEX = /^(feat|fix|docs|style|refactor|perf|test|chore|ci|build|revert)(\(.+\))?: .{1,72}/;

const VALID_TYPES = [
  'feat', 'fix', 'docs', 'style', 'refactor',
  'perf', 'test', 'chore', 'ci', 'build', 'revert'
];

/**
 * Validate commit message
 */
function validateCommitMessage(message) {
  if (!message || typeof message !== 'string') {
    return {
      valid: false,
      error: 'Commit message is required'
    };
  }
  
  const lines = message.trim().split('\n');
  const header = lines[0];
  
  // Check format
  if (!CONVENTIONAL_COMMIT_REGEX.test(header)) {
    const match = header.match(/^(\w+)(\(.+\))?:?\s*(.*)/);
    
    let suggestions = [];
    if (!match) {
      suggestions.push('Use format: <type>(<scope>): <subject>');
    } else {
      const [, type, scope, subject] = match;
      
      if (!VALID_TYPES.includes(type?.toLowerCase())) {
        suggestions.push(`Invalid type "${type}". Valid types: ${VALID_TYPES.join(', ')}`);
      }
      
      if (scope && !scope.startsWith('(') || !scope.endsWith(')')) {
        suggestions.push('Scope must be in parentheses: (scope)');
      }
      
      if (!subject || subject.trim().length === 0) {
        suggestions.push('Subject is required after colon');
      }
    }
    
    return {
      valid: false,
      error: 'Commit message does not follow Conventional Commits format',
      suggestions: suggestions.length > 0 ? suggestions : [
        'Use format: <type>(<scope>): <subject>',
        `Valid types: ${VALID_TYPES.join(', ')}`,
        'Use imperative, present tense ("add" not "added")',
        'Don\'t capitalize first letter',
        'No period at end'
      ]
    };
  }
  
  // Extract components
  const match = header.match(/^(\w+)(\((.+)\))?:\s*(.+)/);
  if (!match) {
    return {
      valid: false,
      error: 'Failed to parse commit message'
    };
  }
  
  const [, type, , scope, subject] = match;
  
  // Check length
  const warnings = [];
  if (header.length > 72) {
    warnings.push('Commit header exceeds 72 characters (recommended)');
  }
  
  // Check imperative tense (basic check)
  const imperativeCheck = /^(add|fix|update|remove|refactor|improve|create|delete|change|implement)/i;
  if (!imperativeCheck.test(subject)) {
    warnings.push('Subject should use imperative, present tense');
  }
  
  // Check capitalization
  if (subject[0] && subject[0] === subject[0].toUpperCase()) {
    warnings.push('Subject should not start with capital letter');
  }
  
  // Check period
  if (subject.endsWith('.')) {
    warnings.push('Subject should not end with period');
  }
  
  return {
    valid: true,
    type: type.toLowerCase(),
    scope: scope || null,
    subject: subject.trim(),
    warnings: warnings.length > 0 ? warnings : []
  };
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const message = process.argv[2] || process.stdin.read()?.toString() || '';
  
  if (!message) {
    console.error('Usage: validate-commit.mjs "<commit message>"');
    console.error('   or: echo "<commit message>" | validate-commit.mjs');
    process.exit(1);
  }
  
  const result = validateCommitMessage(message);
  
  if (result.valid) {
    console.log(JSON.stringify(result, null, 2));
    if (result.warnings && result.warnings.length > 0) {
      console.error('\nWarnings:');
      result.warnings.forEach(w => console.error(`  - ${w}`));
    }
    process.exit(0);
  } else {
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }
}

export { validateCommitMessage };

