/**
 * Condition Evaluation Engine
 *
 * A standalone module for evaluating workflow step conditions with:
 * - Nested expression parsing with proper operator precedence (AND > OR)
 * - Parentheses support for grouping
 * - NOT operator support
 * - Safe variable resolution (missing paths return false, not errors)
 *
 * Implements Cursor Recommendations #5 and #6:
 * - #5: Nested Condition Parsing with Operator Precedence
 * - #6: Safe Context Variable Resolution
 *
 * @module condition-evaluator
 */

/**
 * Safe property access utility - handles undefined/null paths gracefully
 * @param {Object} obj - The object to traverse
 * @param {string} path - Dot-separated path (e.g., 'step.output.risk')
 * @param {*} defaultValue - Value to return if path not found
 * @returns {*} - The value at the path, or defaultValue if not found
 */
export function safeGet(obj, path, defaultValue = undefined) {
  if (obj == null || typeof path !== 'string') {
    return defaultValue;
  }

  const keys = path.split('.');
  let result = obj;

  for (const key of keys) {
    if (result == null || typeof result !== 'object') {
      return defaultValue;
    }
    result = result[key];
  }

  return result !== undefined ? result : defaultValue;
}

/**
 * Tokenize condition string into tokens for parsing
 * Handles parentheses, quotes, operators, and function calls
 * @param {string} condition - The condition string to tokenize
 * @returns {string[]} - Array of tokens
 */
export function tokenizeCondition(condition) {
  const tokens = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = null;
  let parenDepth = 0; // Track nested parentheses in function calls
  let inFunctionCall = false;

  for (let i = 0; i < condition.length; i++) {
    const char = condition[i];

    // Handle quote toggling
    if ((char === '"' || char === "'") && !inQuotes) {
      inQuotes = true;
      quoteChar = char;
      current += char;
    } else if (char === quoteChar && inQuotes) {
      inQuotes = false;
      quoteChar = null;
      current += char;
    } else if (!inQuotes && char === '(') {
      // Check if this is a function call (current ends with function-like pattern)
      // Patterns like: .includes(, .startsWith(, .endsWith(, .match(
      if (/\.[a-zA-Z]+$/.test(current)) {
        // This is a function call - include the parentheses in the token
        inFunctionCall = true;
        parenDepth = 1;
        current += char;
      } else {
        // This is a grouping parenthesis
        if (current.trim()) {
          tokens.push(current.trim());
        }
        tokens.push(char);
        current = '';
      }
    } else if (!inQuotes && char === ')') {
      if (inFunctionCall) {
        current += char;
        parenDepth--;
        if (parenDepth === 0) {
          inFunctionCall = false;
        }
      } else {
        // This is a grouping parenthesis
        if (current.trim()) {
          tokens.push(current.trim());
        }
        tokens.push(char);
        current = '';
      }
    } else if (!inQuotes && !inFunctionCall && /\s/.test(char)) {
      // Whitespace separates tokens (outside quotes and function calls)
      if (current.trim()) {
        tokens.push(current.trim());
      }
      current = '';
    } else {
      current += char;
    }
  }

  // Push final token
  if (current.trim()) {
    tokens.push(current.trim());
  }

  return tokens;
}

/**
 * Evaluate an atomic condition (no operators, no parentheses)
 * @param {string} condition - The atomic condition to evaluate
 * @param {Object} safeContext - The evaluation context
 * @returns {boolean} - The evaluation result
 */
export function evaluateAtomic(condition, safeContext) {
  // Pattern: providers.includes('provider_name')
  if (condition.includes('providers.includes')) {
    const match = condition.match(/providers\.includes\(['"]([^'"]+)['"]\)/);
    if (match) {
      const providers = safeGet(safeContext, 'providers', []);
      return Array.isArray(providers) && providers.includes(match[1]);
    }
  }

  // Pattern: step.output.field === 'value' or step.output.field === true/false
  if (condition.includes('step.output.')) {
    // Boolean match
    const boolMatch = condition.match(/step\.output\.([a-zA-Z_]+)\s*===?\s*(true|false)/);
    if (boolMatch) {
      const fieldName = boolMatch[1];
      const expectedValue = boolMatch[2] === 'true';
      const actualValue = safeGet(safeContext, `step.output.${fieldName}`);
      return actualValue === expectedValue;
    }

    // String match
    const strMatch = condition.match(/step\.output\.([a-zA-Z_]+)\s*===?\s*['"]([^'"]*)['"]/);
    if (strMatch) {
      const fieldName = strMatch[1];
      const expectedValue = strMatch[2];
      const actualValue = safeGet(safeContext, `step.output.${fieldName}`);
      return actualValue === expectedValue;
    }

    // Inequality match (!==)
    const neqMatch = condition.match(/step\.output\.([a-zA-Z_]+)\s*!==?\s*['"]([^'"]*)['"]/);
    if (neqMatch) {
      const fieldName = neqMatch[1];
      const expectedValue = neqMatch[2];
      const actualValue = safeGet(safeContext, `step.output.${fieldName}`);
      return actualValue !== expectedValue;
    }
  }

  // Pattern: config.field === true|false or config.field === 'value' or config.field === number
  if (condition.includes('config.')) {
    // Boolean match
    const boolMatch = condition.match(/config\.([a-zA-Z_]+)\s*===?\s*(true|false)/);
    if (boolMatch) {
      const fieldName = boolMatch[1];
      const expectedValue = boolMatch[2] === 'true';
      const actualValue = safeGet(safeContext, `config.${fieldName}`);
      return actualValue === expectedValue;
    }

    // String match
    const strMatch = condition.match(/config\.([a-zA-Z_]+)\s*===?\s*['"]([^'"]*)['"]/);
    if (strMatch) {
      const fieldName = strMatch[1];
      const expectedValue = strMatch[2];
      const actualValue = safeGet(safeContext, `config.${fieldName}`);
      return actualValue === expectedValue;
    }

    // Numeric match (including == for loose equality)
    const numMatch = condition.match(/config\.([a-zA-Z_]+)\s*[!=<>]=?\s*(-?\d+(?:\.\d+)?)/);
    if (numMatch) {
      const fieldName = numMatch[1];
      const expectedValue = parseFloat(numMatch[2]);
      const actualValue = safeGet(safeContext, `config.${fieldName}`);
      // Check operator type
      if (condition.includes('!==') || condition.includes('!=')) {
        return actualValue !== expectedValue;
      } else if (condition.includes('>=')) {
        return actualValue >= expectedValue;
      } else if (condition.includes('<=')) {
        return actualValue <= expectedValue;
      } else if (condition.includes('>')) {
        return actualValue > expectedValue;
      } else if (condition.includes('<')) {
        return actualValue < expectedValue;
      } else {
        // == or ===
        return actualValue === expectedValue || actualValue == expectedValue;
      }
    }
  }

  // Pattern: env.VARIABLE === 'value' or env.VARIABLE === true/false
  if (condition.includes('env.')) {
    // Boolean match
    const boolMatch = condition.match(/env\.([A-Z_]+)\s*===?\s*(true|false)/);
    if (boolMatch) {
      const varName = boolMatch[1];
      const expectedValue = boolMatch[2] === 'true';
      const actualValue = safeGet(safeContext, `env.${varName}`);
      return actualValue === expectedValue || actualValue === String(expectedValue);
    }

    // String match
    const strMatch = condition.match(/env\.([A-Z_]+)\s*===?\s*['"]([^'"]*)['"]/);
    if (strMatch) {
      const varName = strMatch[1];
      const expectedValue = strMatch[2];
      const actualValue = safeGet(safeContext, `env.${varName}`);
      return actualValue === expectedValue;
    }
  }

  // Pattern: artifacts.field.subfield === 'value'
  if (condition.includes('artifacts.')) {
    const match = condition.match(/artifacts\.([a-zA-Z_.]+)\s*===?\s*['"]([^'"]*)['"]/);
    if (match) {
      const fieldPath = match[1];
      const expectedValue = match[2];
      const actualValue = safeGet(safeContext, `artifacts.${fieldPath}`);
      return actualValue === expectedValue;
    }
  }

  // Pattern: simple boolean flags (snake_case identifiers)
  // These are common patterns in code-review-flow.yaml
  if (/^[a-z][a-z0-9_]*$/i.test(condition)) {
    // Check in config first
    const configValue = safeGet(safeContext, `config.${condition}`);
    if (configValue !== undefined) {
      return !!configValue;
    }

    // Check in artifacts
    const artifactValue = safeGet(safeContext, `artifacts.${condition}`);
    if (artifactValue !== undefined) {
      return !!artifactValue;
    }

    // Check environment variables (uppercase version)
    const envKey = condition.toUpperCase();
    const envValue = safeGet(safeContext, `env.${envKey}`);
    if (envValue !== undefined) {
      return envValue === 'true' || envValue === true;
    }

    // Check direct context property
    const directValue = safeGet(safeContext, condition);
    if (directValue !== undefined) {
      return !!directValue;
    }

    // Not found anywhere - return false (fail closed for booleans)
    return false;
  }

  // Unrecognized pattern - log warning and return false (fail closed)
  console.warn(`Warning: Unrecognized atomic condition: "${condition}"`);
  return false;
}

/**
 * Parse primary expression (handles parentheses, NOT, comparisons, and atomic conditions)
 * @param {string[]} tokens - Mutable array of tokens
 * @param {Object} safeContext - The evaluation context
 * @returns {boolean} - The evaluation result
 */
export function parsePrimary(tokens, safeContext) {
  if (tokens.length === 0) {
    return false;
  }

  const token = tokens[0];

  // Handle opening parenthesis - parse nested expression
  if (token === '(') {
    tokens.shift(); // consume '('
    const result = parseOr(tokens, safeContext);
    if (tokens.length > 0 && tokens[0] === ')') {
      tokens.shift(); // consume ')'
    }
    return result;
  }

  // Handle NOT operator
  if (token === 'NOT' || token === '!') {
    tokens.shift(); // consume 'NOT' or '!'
    return !parsePrimary(tokens, safeContext);
  }

  // Consume the first token
  tokens.shift();

  // Check if next token is a comparison operator
  // This handles patterns like: config.enabled === true
  if (tokens.length >= 2 && /^[!=<>]=?=?$/.test(tokens[0])) {
    const operator = tokens.shift(); // consume operator (===, ==, !==, !=, etc.)
    const rightValue = tokens.shift(); // consume right-hand value

    // Reconstruct the full comparison expression for evaluateAtomic
    const fullCondition = `${token} ${operator} ${rightValue}`;
    return evaluateAtomic(fullCondition, safeContext);
  }

  // Single token atomic condition (boolean flag, function call like providers.includes)
  return evaluateAtomic(token, safeContext);
}

/**
 * Parse AND expressions (higher precedence than OR)
 * @param {string[]} tokens - Mutable array of tokens
 * @param {Object} safeContext - The evaluation context
 * @returns {boolean} - The evaluation result
 */
export function parseAnd(tokens, safeContext) {
  let left = parsePrimary(tokens, safeContext);

  while (tokens.length > 0 && (tokens[0] === 'AND' || tokens[0] === '&&')) {
    tokens.shift(); // consume 'AND' or '&&'
    const right = parsePrimary(tokens, safeContext);
    left = left && right;
  }

  return left;
}

/**
 * Parse OR expressions (lower precedence than AND)
 * @param {string[]} tokens - Mutable array of tokens
 * @param {Object} safeContext - The evaluation context
 * @returns {boolean} - The evaluation result
 */
export function parseOr(tokens, safeContext) {
  let left = parseAnd(tokens, safeContext);

  while (tokens.length > 0 && (tokens[0] === 'OR' || tokens[0] === '||')) {
    tokens.shift(); // consume 'OR' or '||'
    const right = parseAnd(tokens, safeContext);
    left = left || right;
  }

  return left;
}

/**
 * Parse and evaluate a condition expression with proper operator precedence
 * @param {string[]} tokens - Array of tokens to parse
 * @param {Object} safeContext - The evaluation context
 * @returns {boolean} - The evaluation result
 */
export function parseExpression(tokens, safeContext) {
  // Create a copy to avoid mutating the original
  const tokensCopy = [...tokens];
  return parseOr(tokensCopy, safeContext);
}

/**
 * Evaluate step condition expression to determine if step should execute
 *
 * Supports:
 * - Nested expressions with parentheses: (A OR B) AND C
 * - Operator precedence: AND binds tighter than OR
 * - NOT operator: NOT condition, !condition
 * - Safe variable resolution: missing variables return false
 * - Multiple condition patterns:
 *   - providers.includes("name")
 *   - step.output.field === "value"
 *   - config.field === true/false/"value"
 *   - env.VARIABLE === "value"
 *   - artifacts.field === "value"
 *   - simple_boolean_flag
 *
 * @param {string} condition - Condition expression from workflow YAML
 * @param {Object} context - Context containing artifacts, config, env, providers
 * @returns {boolean} - true if step should execute, false if should skip
 */
export function evaluateCondition(condition, context = {}) {
  if (!condition || typeof condition !== 'string') {
    return true; // No condition means always execute
  }

  // Build safe evaluation context with defaults
  const safeContext = {
    providers: context.providers || [],
    step: context.step || {},
    config: context.config || {},
    env: {
      MULTI_AI_ENABLED: process.env?.MULTI_AI_ENABLED === 'true',
      CI: process.env?.CI === 'true',
      NODE_ENV: process.env?.NODE_ENV || 'development',
      ...context.env
    },
    artifacts: context.artifacts || {}
  };

  try {
    const trimmed = condition.trim();

    // Tokenize the condition
    const tokens = tokenizeCondition(trimmed);

    if (tokens.length === 0) {
      return true; // Empty condition means always execute
    }

    // Parse and evaluate the expression
    return parseExpression(tokens, safeContext);

  } catch (error) {
    // On any error, fail open (execute step)
    console.warn(`Warning: Condition evaluation failed: ${error.message}`);
    console.warn(`   Condition: "${condition}"`);
    console.warn(`   Defaulting to execute step (fail-open behavior)`);
    return true;
  }
}

// Default export for convenience
export default {
  evaluateCondition,
  tokenizeCondition,
  evaluateAtomic,
  safeGet,
  parseExpression,
  parseOr,
  parseAnd,
  parsePrimary
};
