/**
 * LLM Cost Calculator
 *
 * Pricing table and cost calculation for various Claude models.
 * Updated as of 2026-01-01 with latest Anthropic pricing.
 */

// Pricing per 1K tokens (USD)
const PRICING = {
  'claude-3-haiku-20240307': {
    input: 0.00025,
    output: 0.00125,
  },
  'claude-3-5-sonnet-20241022': {
    input: 0.003,
    output: 0.015,
  },
  'claude-3-opus-20240229': {
    input: 0.015,
    output: 0.075,
  },
  // Aliases for convenience
  haiku: {
    input: 0.00025,
    output: 0.00125,
  },
  sonnet: {
    input: 0.003,
    output: 0.015,
  },
  opus: {
    input: 0.015,
    output: 0.075,
  },
};

/**
 * Calculate cost for LLM usage
 *
 * @param {string} model - Model identifier (e.g., 'claude-opus-4-5', 'sonnet', 'haiku')
 * @param {number} inputTokens - Number of input tokens
 * @param {number} outputTokens - Number of output tokens
 * @returns {number} Total cost in USD
 * @throws {Error} If model not found or invalid input
 */
function calculateCost(model, inputTokens, outputTokens) {
  // Validate inputs
  if (!model || typeof model !== 'string') {
    throw new Error('Model must be a non-empty string');
  }

  if (typeof inputTokens !== 'number' || inputTokens < 0) {
    throw new Error('inputTokens must be a non-negative number');
  }

  if (typeof outputTokens !== 'number' || outputTokens < 0) {
    throw new Error('outputTokens must be a non-negative number');
  }

  // Get pricing for model (default to sonnet if not found)
  const pricing = PRICING[model] || PRICING['sonnet'];

  // Calculate costs
  const inputCost = (inputTokens / 1000) * pricing.input;
  const outputCost = (outputTokens / 1000) * pricing.output;

  return inputCost + outputCost;
}

/**
 * Get pricing for a specific model
 *
 * @param {string} model - Model identifier
 * @returns {Object} { input: number, output: number }
 */
function getPricing(model) {
  return PRICING[model] || PRICING['sonnet'];
}

/**
 * Normalize model name to tier
 *
 * @param {string} model - Model identifier
 * @returns {string} Tier (haiku|sonnet|opus)
 */
function modelToTier(model) {
  if (!model) return 'sonnet';
  const m = model.toLowerCase();
  if (m.includes('haiku')) return 'haiku';
  if (m.includes('opus')) return 'opus';
  return 'sonnet';
}

/**
 * Get all available models
 *
 * @returns {Array<string>} List of model names
 */
function getAvailableModels() {
  return Object.keys(PRICING);
}

/**
 * Format cost as currency string
 *
 * @param {number} cost - Cost in USD
 * @returns {string} Formatted cost (e.g., "$0.0456")
 */
function formatCost(cost) {
  return `$${cost.toFixed(4)}`;
}

/**
 * Format token count with thousands separator
 *
 * @param {number} tokens - Number of tokens
 * @returns {string} Formatted token count (e.g., "1,234,567")
 */
function formatTokens(tokens) {
  return tokens.toLocaleString();
}

/**
 * Calculate cost breakdown for multiple calls
 *
 * @param {Array<Object>} calls - Array of {model, inputTokens, outputTokens}
 * @returns {Object} Breakdown by model tier and total
 */
function aggregateCosts(calls) {
  const breakdown = {
    haiku: { cost: 0, calls: 0, tokens: 0 },
    sonnet: { cost: 0, calls: 0, tokens: 0 },
    opus: { cost: 0, calls: 0, tokens: 0 },
    total: { cost: 0, calls: 0, tokens: 0 },
  };

  for (const call of calls) {
    const tier = modelToTier(call.model);
    const cost = calculateCost(call.model, call.inputTokens, call.outputTokens);
    const tokens = call.inputTokens + call.outputTokens;

    breakdown[tier].cost += cost;
    breakdown[tier].calls += 1;
    breakdown[tier].tokens += tokens;

    breakdown.total.cost += cost;
    breakdown.total.calls += 1;
    breakdown.total.tokens += tokens;
  }

  return breakdown;
}

module.exports = {
  PRICING,
  calculateCost,
  getPricing,
  modelToTier,
  getAvailableModels,
  formatCost,
  formatTokens,
  aggregateCosts,
};
