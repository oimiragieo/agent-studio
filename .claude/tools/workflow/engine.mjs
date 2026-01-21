/**
 * Workflow Engine Utilities - Extracted from workflow_runner.js
 * Handles step discovery and condition evaluation
 */

/**
 * Find step in workflow (handles both flat steps array and nested phases)
 * @param {Object} workflow - Workflow configuration object
 * @param {string|number} stepNumber - Step identifier
 * @returns {Object|null} Step configuration or null if not found
 */
export function findStepInWorkflow(workflow, stepNumber) {
  const stepKey = String(stepNumber);
  const numeric = /^\d+$/.test(stepKey) ? String(parseInt(stepKey, 10)) : null;
  const padded2 = numeric ? numeric.padStart(2, '0') : null;

  // Handle flat steps array
  if (workflow.steps && Array.isArray(workflow.steps)) {
    for (const step of workflow.steps) {
      const stepId = step.id != null ? String(step.id) : null;
      if (
        String(step.step) === stepKey ||
        stepId === stepKey ||
        (padded2 && stepId && stepId.startsWith(`${padded2}-`))
      ) {
        return step;
      }
    }
  }

  // Handle phase-based workflows (nested structure)
  if (workflow.phases && Array.isArray(workflow.phases)) {
    for (const phase of workflow.phases) {
      if (phase.steps && Array.isArray(phase.steps)) {
        for (const step of phase.steps) {
          const stepId = step.id != null ? String(step.id) : null;
          if (
            String(step.step) === stepKey ||
            stepId === stepKey ||
            (padded2 && stepId && stepId.startsWith(`${padded2}-`))
          ) {
            return step;
          }
        }
      }
      // Check decision paths
      if (phase.decision) {
        if (phase.decision.if_yes && Array.isArray(phase.decision.if_yes)) {
          for (const step of phase.decision.if_yes) {
            const stepId = step.id != null ? String(step.id) : null;
            if (
              String(step.step) === stepKey ||
              stepId === stepKey ||
              (padded2 && stepId && stepId.startsWith(`${padded2}-`))
            ) {
              return step;
            }
          }
        }
        if (phase.decision.if_no && Array.isArray(phase.decision.if_no)) {
          for (const step of phase.decision.if_no) {
            const stepId = step.id != null ? String(step.id) : null;
            if (
              String(step.step) === stepKey ||
              stepId === stepKey ||
              (padded2 && stepId && stepId.startsWith(`${padded2}-`))
            ) {
              return step;
            }
          }
        }
      }
      // Check loops
      if (
        phase.epic_loop &&
        phase.epic_loop.story_loop &&
        Array.isArray(phase.epic_loop.story_loop)
      ) {
        for (const step of phase.epic_loop.story_loop) {
          const stepId = step.id != null ? String(step.id) : null;
          if (
            String(step.step) === stepKey ||
            stepId === stepKey ||
            (padded2 && stepId && stepId.startsWith(`${padded2}-`))
          ) {
            return step;
          }
        }
      }
    }
  }

  return null;
}

/**
 * Evaluate step condition expression to determine if step should execute
 */
export function evaluateCondition(condition, context = {}) {
  if (!condition || typeof condition !== 'string') {
    return true;
  }

  const safeContext = {
    providers: context.providers || [],
    step: context.step || {},
    config: context.config || {},
    env: {
      MULTI_AI_ENABLED: process.env.MULTI_AI_ENABLED === 'true',
      CI: process.env.CI === 'true',
      NODE_ENV: process.env.NODE_ENV || 'development',
      ...context.env,
    },
    artifacts: context.artifacts || {},
  };

  try {
    const trimmed = condition.trim();
    const tokens = tokenizeCondition(trimmed);
    if (tokens.length === 0) return true;
    return parseExpression(tokens, safeContext);
  } catch (error) {
    console.warn(`⚠️  Warning: Condition evaluation failed: ${error.message}`);
    return true; // Fail open
  }
}

// Private helpers (internal to this module)

function tokenizeCondition(condition) {
  const tokens = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = null;
  let parenDepth = 0;
  let inFunctionCall = false;

  for (let i = 0; i < condition.length; i++) {
    const char = condition[i];
    if ((char === '"' || char === "'") && !inQuotes) {
      inQuotes = true;
      quoteChar = char;
      current += char;
    } else if (char === quoteChar && inQuotes) {
      inQuotes = false;
      quoteChar = null;
      current += char;
    } else if (!inQuotes && char === '(') {
      if (/\.[a-zA-Z]+$/.test(current)) {
        inFunctionCall = true;
        parenDepth = 1;
        current += char;
      } else {
        if (current.trim()) tokens.push(current.trim());
        tokens.push(char);
        current = '';
      }
    } else if (!inQuotes && char === ')') {
      if (inFunctionCall) {
        current += char;
        parenDepth--;
        if (parenDepth === 0) inFunctionCall = false;
      } else {
        if (current.trim()) tokens.push(current.trim());
        tokens.push(char);
        current = '';
      }
    } else if (!inQuotes && !inFunctionCall && /\s/.test(char)) {
      if (current.trim()) tokens.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) tokens.push(current.trim());
  return tokens;
}

function parseExpression(tokens, safeContext) {
  const tokensCopy = [...tokens];
  return parseOr(tokensCopy, safeContext);
}

function parseOr(tokens, safeContext) {
  let left = parseAnd(tokens, safeContext);
  while (tokens.length > 0 && (tokens[0] === 'OR' || tokens[0] === '||')) {
    tokens.shift();
    const right = parseAnd(tokens, safeContext);
    left = left || right;
  }
  return left;
}

function parseAnd(tokens, safeContext) {
  let left = parsePrimary(tokens, safeContext);
  while (tokens.length > 0 && (tokens[0] === 'AND' || tokens[0] === '&&')) {
    tokens.shift();
    const right = parsePrimary(tokens, safeContext);
    left = left && right;
  }
  return left;
}

function parsePrimary(tokens, safeContext) {
  if (tokens.length === 0) return false;
  const token = tokens[0];
  if (token === '(') {
    tokens.shift();
    const result = parseOr(tokens, safeContext);
    if (tokens.length > 0 && tokens[0] === ')') tokens.shift();
    return result;
  }
  if (token === 'NOT' || token === '!') {
    tokens.shift();
    return !parsePrimary(tokens, safeContext);
  }
  tokens.shift();
  if (tokens.length >= 2 && /^[!=<>]=?=?$/.test(tokens[0])) {
    const operator = tokens.shift();
    const rightValue = tokens.shift();
    return evaluateAtomic(`${token} ${operator} ${rightValue}`, safeContext);
  }
  return evaluateAtomic(token, safeContext);
}

function evaluateAtomic(condition, safeContext) {
  const safeGet = (obj, path) => {
    if (obj == null) return undefined;
    const keys = path.split('.');
    let result = obj;
    for (const key of keys) {
      if (result == null || typeof result !== 'object') return undefined;
      result = result[key];
    }
    return result;
  };

  if (condition.includes('providers.includes')) {
    const match = condition.match(/providers\.includes\(['"]([^'"]+)['"]\)/);
    if (match) {
      const providers = safeGet(safeContext, 'providers') || [];
      return providers.includes(match[1]);
    }
  }

  if (condition.includes('step.output.')) {
    const boolMatch = condition.match(/step\.output\.([a-zA-Z_]+)\s*===?\s*(true|false)/);
    if (boolMatch)
      return safeGet(safeContext, `step.output.${boolMatch[1]}`) === (boolMatch[2] === 'true');
    const strMatch = condition.match(/step\.output\.([a-zA-Z_]+)\s*===?\s*['"]([^'"]*)['"]/);
    if (strMatch) return safeGet(safeContext, `step.output.${strMatch[1]}`) === strMatch[2];
  }

  if (condition.includes('config.')) {
    const boolMatch = condition.match(/config\.([a-zA-Z_]+)\s*===?\s*(true|false)/);
    if (boolMatch)
      return safeGet(safeContext, `config.${boolMatch[1]}`) === (boolMatch[2] === 'true');
    const strMatch = condition.match(/config\.([a-zA-Z_]+)\s*===?\s*['"]([^'"]*)['"]/);
    if (strMatch) return safeGet(safeContext, `config.${strMatch[1]}`) === strMatch[2];
  }

  if (/^[a-z][a-z0-9_]*$/i.test(condition)) {
    return !!(
      safeGet(safeContext, `config.${condition}`) ||
      safeGet(safeContext, `artifacts.${condition}`) ||
      safeGet(safeContext, condition)
    );
  }

  return false;
}
