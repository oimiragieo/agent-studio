#!/usr/bin/env node

/**
 * Router Session Handler
 *
 * Core logic for initializing Haiku router sessions, classifying intents,
 * and routing to the orchestrator when needed.
 *
 * Features:
 * - Lightweight intent classification
 * - Complexity assessment
 * - Workflow selection
 * - Cost tracking
 * - Seamless orchestrator handoff
 *
 * @module router-session-handler
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===========================
// Configuration & Constants
// ===========================

const SETTINGS_PATH = path.join(__dirname, '..', 'settings.json');
const SESSION_STATE_DIR = path.join(__dirname, '..', 'context', 'tmp');
const CUJ_INDEX_PATH = path.join(__dirname, '..', 'context', 'CUJ-INDEX.json');

// Model pricing (per million tokens) - Updated Jan 2025
const MODEL_PRICING = {
  'claude-3-5-haiku-20241022': {
    input: 1.0,
    output: 5.0,
  },
  'claude-sonnet-4-20250514': {
    input: 3.0,
    output: 15.0,
  },
  'claude-opus-4-20241113': {
    input: 15.0,
    output: 75.0,
  },
};

// Complexity scoring thresholds
const COMPLEXITY_THRESHOLDS = {
  TOKEN_WEIGHT: 0.3,
  ACTION_WEIGHT: 0.4,
  QUESTION_WEIGHT: 0.2,
  FILE_WEIGHT: 0.3,
  ROUTE_THRESHOLD: 0.7,
};

// Intent classification keywords
const INTENT_KEYWORDS = {
  web_app: [
    'web app',
    'website',
    'full-stack',
    'enterprise app',
    'application',
    'frontend',
    'backend',
    'api',
  ],
  script: ['script', 'automate', 'one-off', 'quick', 'simple task', 'utility'],
  analysis: ['analyze', 'review', 'audit', 'refactor', 'inspect', 'examine', 'check'],
  infrastructure: ['deploy', 'infrastructure', 'devops', 'ci/cd', 'docker', 'kubernetes'],
  mobile: ['mobile', 'ios', 'android', 'react native', 'flutter'],
  ai_system: ['ai', 'llm', 'rag', 'embeddings', 'chatbot', 'machine learning'],
};

const ACTION_KEYWORDS = ['implement', 'create', 'build', 'design', 'develop', 'generate'];
const CLOUD_KEYWORDS = {
  gcp: ['google cloud', 'gcp', 'cloud run', 'cloud sql', 'gcs', 'pub/sub'],
  aws: ['aws', 'amazon web services', 'lambda', 's3', 'rds', 'ec2'],
  azure: ['azure', 'microsoft azure', 'functions', 'cosmos db', 'blob storage'],
};

// ===========================
// Session Management
// ===========================

/**
 * Initialize a router session with Haiku model
 *
 * @param {string} sessionId - Unique session identifier
 * @param {string} initialPrompt - User's initial prompt
 * @returns {Promise<Object>} Session object with settings and state
 */
export async function initializeRouterSession(sessionId, initialPrompt) {
  try {
    // Load settings
    const settings = await loadSettings();

    // Create session state directory if needed
    await fs.mkdir(SESSION_STATE_DIR, { recursive: true });

    // Initialize session object
    const session = {
      session_id: sessionId,
      created_at: new Date().toISOString(),
      model: settings.models.router || 'claude-3-5-haiku-20241022',
      temperature: settings.session.default_temperature || 0.1,
      role: 'router',
      initial_prompt: initialPrompt,
      cost_tracking: {
        total_input_tokens: 0,
        total_output_tokens: 0,
        total_cost_usd: 0,
        model_usage: [],
      },
      routing_history: [],
      settings,
    };

    // Save session state
    await saveSessionState(sessionId, session);

    return session;
  } catch (error) {
    throw new Error(`Failed to initialize router session: ${error.message}`);
  }
}

/**
 * Load settings from settings.json
 *
 * @returns {Promise<Object>} Settings object
 */
async function loadSettings() {
  try {
    const content = await fs.readFile(SETTINGS_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    // Return defaults if settings.json not found
    return {
      models: {
        router: 'claude-3-5-haiku-20241022',
        orchestrator: 'claude-sonnet-4-20250514',
        complex: 'claude-opus-4-20241113',
      },
      session: {
        default_temperature: 0.1,
        default_role: 'router',
      },
      routing: {
        complexity_threshold: 0.7,
        cost_optimization_enabled: true,
      },
    };
  }
}

/**
 * Save session state to disk
 *
 * @param {string} sessionId - Session identifier
 * @param {Object} session - Session object
 */
async function saveSessionState(sessionId, session) {
  const statePath = path.join(SESSION_STATE_DIR, `router-session-${sessionId}.json`);
  await fs.writeFile(statePath, JSON.stringify(session, null, 2));
}

/**
 * Load session state from disk
 *
 * @param {string} sessionId - Session identifier
 * @returns {Promise<Object>} Session object
 */
async function loadSessionState(sessionId) {
  const statePath = path.join(SESSION_STATE_DIR, `router-session-${sessionId}.json`);
  const content = await fs.readFile(statePath, 'utf-8');
  return JSON.parse(content);
}

// ===========================
// Intent Classification
// ===========================

/**
 * Classify user intent and determine if routing is needed
 *
 * Uses lightweight heuristics for fast classification:
 * - Token count estimation
 * - Keyword detection
 * - Question type analysis
 * - Complexity scoring
 *
 * @param {string} userPrompt - User's input prompt
 * @returns {Promise<Object>} Classification result
 */
export async function classifyIntent(userPrompt) {
  const startTime = Date.now();

  const prompt = userPrompt.toLowerCase();

  // Calculate complexity score
  const complexity = calculateComplexityScore(prompt, userPrompt);

  // Detect intent
  const intent = detectIntent(prompt);

  // Detect cloud provider
  const cloudProvider = detectCloudProvider(prompt);

  // Determine if routing is needed
  const shouldRoute = complexity.score >= COMPLEXITY_THRESHOLDS.ROUTE_THRESHOLD;

  // Calculate confidence based on keyword matches
  const confidence = calculateConfidence(intent, complexity, prompt);

  const classification = {
    intent: intent.type,
    complexity: complexity.level,
    complexity_score: complexity.score,
    cloud_provider: cloudProvider,
    should_route: shouldRoute,
    confidence,
    reasoning: buildReasoning(intent, complexity, cloudProvider, shouldRoute),
    keywords_detected: intent.keywords,
    classification_time_ms: Date.now() - startTime,
  };

  return classification;
}

/**
 * Calculate complexity score using multiple signals
 *
 * @param {string} promptLower - Lowercased prompt
 * @param {string} promptOriginal - Original prompt
 * @returns {Object} Complexity assessment
 */
function calculateComplexityScore(promptLower, promptOriginal) {
  let score = 0;
  const signals = [];

  // Token count estimation (rough: words * 1.3)
  const wordCount = promptOriginal.trim().split(/\s+/).length;
  const estimatedTokens = wordCount * 1.3;

  // Adjust token threshold - use word count > 30 as proxy for complexity
  if (wordCount > 30) {
    score += COMPLEXITY_THRESHOLDS.TOKEN_WEIGHT;
    signals.push('high_token_count');
  }

  // Action keywords
  const hasActionKeywords = ACTION_KEYWORDS.some(kw => promptLower.includes(kw));
  if (hasActionKeywords) {
    score += COMPLEXITY_THRESHOLDS.ACTION_WEIGHT;
    signals.push('action_keywords');
  }

  // Multiple questions
  const questionCount = (promptOriginal.match(/\?/g) || []).length;
  if (questionCount > 1) {
    score += COMPLEXITY_THRESHOLDS.QUESTION_WEIGHT;
    signals.push('multiple_questions');
  }

  // Multiple file references
  const fileReferences = (promptOriginal.match(/\.(ts|js|tsx|jsx|py|md|json|yaml|yml)/g) || [])
    .length;
  if (fileReferences > 2) {
    score += COMPLEXITY_THRESHOLDS.FILE_WEIGHT;
    signals.push('multiple_files');
  }

  // Check for complex technical terms (each adds to complexity)
  const complexTerms = [
    'full-stack',
    'enterprise',
    'authentication',
    'database',
    'deployment',
    'integration',
    'architecture',
    'api design',
  ];
  const matchedComplexTerms = complexTerms.filter(term => promptLower.includes(term));
  if (matchedComplexTerms.length > 0) {
    // Each complex term adds to score, capped at 0.3
    score += Math.min(matchedComplexTerms.length * 0.15, 0.3);
    signals.push('complex_technical_terms');
  }

  // Determine level
  let level = 'low';
  if (score >= 0.7) level = 'high';
  else if (score >= 0.4) level = 'medium';

  return { score, level, signals };
}

/**
 * Detect primary intent from prompt
 *
 * @param {string} promptLower - Lowercased prompt
 * @returns {Object} Intent type and matched keywords
 */
function detectIntent(promptLower) {
  const scores = {};
  const matchedKeywords = {};

  // Score each intent type
  for (const [intentType, keywords] of Object.entries(INTENT_KEYWORDS)) {
    let score = 0;
    const matched = [];

    for (const keyword of keywords) {
      if (promptLower.includes(keyword)) {
        score += 1;
        matched.push(keyword);
      }
    }

    scores[intentType] = score;
    matchedKeywords[intentType] = matched;
  }

  // Find highest scoring intent
  let maxScore = 0;
  let topIntent = 'web_app'; // default

  for (const [intentType, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      topIntent = intentType;
    }
  }

  return {
    type: topIntent,
    keywords: matchedKeywords[topIntent] || [],
    score: maxScore,
  };
}

/**
 * Detect cloud provider from prompt
 *
 * @param {string} promptLower - Lowercased prompt
 * @returns {string|null} Cloud provider or null
 */
function detectCloudProvider(promptLower) {
  for (const [provider, keywords] of Object.entries(CLOUD_KEYWORDS)) {
    for (const keyword of keywords) {
      if (promptLower.includes(keyword)) {
        return provider;
      }
    }
  }
  return null;
}

/**
 * Calculate confidence score
 *
 * @param {Object} intent - Intent detection result
 * @param {Object} complexity - Complexity assessment
 * @param {string} promptLower - Lowercased prompt
 * @returns {number} Confidence (0-1)
 */
function calculateConfidence(intent, complexity, promptLower) {
  let confidence = 0.5; // baseline

  // Higher confidence if clear intent keywords
  if (intent.score > 0) {
    confidence += Math.min(intent.score * 0.1, 0.3);
  }

  // Higher confidence if clear complexity signals
  if (complexity.signals.length > 0) {
    confidence += Math.min(complexity.signals.length * 0.05, 0.2);
  }

  // Lower confidence for ambiguous prompts
  if (promptLower.split(/\s+/).length < 5) {
    confidence -= 0.2;
  }

  return Math.max(0.1, Math.min(1.0, confidence));
}

/**
 * Build reasoning explanation
 *
 * @param {Object} intent - Intent detection
 * @param {Object} complexity - Complexity assessment
 * @param {string|null} cloudProvider - Cloud provider
 * @param {boolean} shouldRoute - Routing decision
 * @returns {string} Reasoning text
 */
function buildReasoning(intent, complexity, cloudProvider, shouldRoute) {
  const parts = [];

  parts.push(`Detected intent: ${intent.type} (${intent.keywords.join(', ')})`);
  parts.push(`Complexity: ${complexity.level} (score: ${complexity.score.toFixed(2)})`);

  if (cloudProvider) {
    parts.push(`Cloud provider: ${cloudProvider}`);
  }

  if (shouldRoute) {
    parts.push('Routing to orchestrator due to complexity');
  } else {
    parts.push('Handling directly with Haiku router');
  }

  return parts.join('. ');
}

// ===========================
// Workflow Selection
// ===========================

/**
 * Select appropriate workflow based on classification
 *
 * @param {string} intent - Intent type
 * @param {string} complexity - Complexity level
 * @returns {Promise<string|null>} Workflow path or null
 */
export async function selectWorkflow(intent, complexity) {
  try {
    // Try to load CUJ index for workflow mapping
    const cujIndex = await loadCUJIndex();

    // Map intent to workflow
    const workflowPath = mapIntentToWorkflow(intent, complexity, cujIndex);

    // Verify workflow exists
    if (workflowPath) {
      const workflowExists = await verifyWorkflowExists(workflowPath);
      if (workflowExists) {
        return workflowPath;
      }
    }

    // Fallback to default
    return '@.claude/workflows/greenfield-fullstack.yaml';
  } catch (error) {
    console.warn('Workflow selection failed, using default:', error.message);
    return '@.claude/workflows/greenfield-fullstack.yaml';
  }
}

/**
 * Load CUJ index
 *
 * @returns {Promise<Object|null>} CUJ index or null
 */
async function loadCUJIndex() {
  try {
    const content = await fs.readFile(CUJ_INDEX_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

/**
 * Map intent to workflow file
 *
 * @param {string} intent - Intent type
 * @param {string} complexity - Complexity level
 * @param {Object|null} cujIndex - CUJ index
 * @returns {string} Workflow path
 */
function mapIntentToWorkflow(intent, complexity, cujIndex) {
  // Workflow mapping based on router agent logic
  const workflowMap = {
    web_app: '@.claude/workflows/greenfield-fullstack.yaml',
    script: '@.claude/workflows/quick-flow.yaml',
    analysis: '@.claude/workflows/code-quality-flow.yaml',
    infrastructure: '@.claude/workflows/automated-enterprise-flow.yaml',
    mobile: '@.claude/workflows/mobile-flow.yaml',
    ai_system: '@.claude/workflows/ai-system-flow.yaml',
  };

  return workflowMap[intent] || '@.claude/workflows/greenfield-fullstack.yaml';
}

/**
 * Verify workflow file exists
 *
 * @param {string} workflowPath - Path to workflow (may have @ prefix)
 * @returns {Promise<boolean>} True if exists
 */
async function verifyWorkflowExists(workflowPath) {
  try {
    // Remove @ prefix if present
    const cleanPath = workflowPath.replace(/^@/, '');
    const fullPath = path.join(__dirname, '..', '..', cleanPath);

    await fs.access(fullPath);
    return true;
  } catch (error) {
    return false;
  }
}

// ===========================
// Orchestrator Routing
// ===========================

/**
 * Route request to orchestrator
 *
 * @param {string} workflow - Workflow path
 * @param {string} userPrompt - Original user prompt
 * @param {Object} sessionContext - Session context
 * @returns {Promise<Object>} Orchestrator response
 */
export async function routeToOrchestrator(workflow, userPrompt, sessionContext) {
  try {
    // Record routing decision
    const routingDecision = {
      timestamp: new Date().toISOString(),
      workflow,
      prompt_preview: userPrompt.substring(0, 100),
      session_id: sessionContext.session_id,
    };

    // Update session state
    const session = await loadSessionState(sessionContext.session_id);
    session.routing_history.push(routingDecision);
    await saveSessionState(sessionContext.session_id, session);

    // Prepare handoff data
    const handoffData = {
      workflow,
      user_prompt: userPrompt,
      session_context: {
        session_id: sessionContext.session_id,
        router_classification: sessionContext.classification,
        cost_tracking: session.cost_tracking,
      },
      routing_metadata: {
        routed_at: new Date().toISOString(),
        router_model: session.model,
        skip_redundant_routing: true, // Tell orchestrator routing is done
      },
    };

    // Return handoff data (orchestrator-entry.mjs will process this)
    return {
      success: true,
      handoff_data: handoffData,
      message: `Routing to orchestrator with workflow: ${workflow}`,
    };
  } catch (error) {
    throw new Error(`Orchestrator routing failed: ${error.message}`);
  }
}

// ===========================
// Cost Tracking
// ===========================

/**
 * Track costs for model usage
 *
 * @param {string} sessionId - Session identifier
 * @param {string} modelUsed - Model identifier
 * @param {number} inputTokens - Input token count
 * @param {number} outputTokens - Output token count
 * @returns {Promise<Object>} Updated cost summary
 */
export async function trackCosts(sessionId, modelUsed, inputTokens, outputTokens) {
  try {
    // Load session
    const session = await loadSessionState(sessionId);

    // Get pricing for model
    const pricing = MODEL_PRICING[modelUsed] || MODEL_PRICING['claude-3-5-haiku-20241022'];

    // Calculate costs (pricing is per million tokens)
    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;
    const totalCost = inputCost + outputCost;

    // Update session tracking
    session.cost_tracking.total_input_tokens += inputTokens;
    session.cost_tracking.total_output_tokens += outputTokens;
    session.cost_tracking.total_cost_usd += totalCost;
    session.cost_tracking.model_usage.push({
      timestamp: new Date().toISOString(),
      model: modelUsed,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: totalCost,
    });

    // Save updated session
    await saveSessionState(sessionId, session);

    // Return cost summary
    return {
      session_cost: session.cost_tracking.total_cost_usd,
      this_request: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd: totalCost,
        model: modelUsed,
      },
    };
  } catch (error) {
    throw new Error(`Cost tracking failed: ${error.message}`);
  }
}

/**
 * Get cost summary for session
 *
 * @param {string} sessionId - Session identifier
 * @returns {Promise<Object>} Cost summary
 */
export async function getCostSummary(sessionId) {
  try {
    const session = await loadSessionState(sessionId);
    return {
      session_id: sessionId,
      total_cost_usd: session.cost_tracking.total_cost_usd,
      total_input_tokens: session.cost_tracking.total_input_tokens,
      total_output_tokens: session.cost_tracking.total_output_tokens,
      model_breakdown: session.cost_tracking.model_usage,
    };
  } catch (error) {
    return {
      session_id: sessionId,
      error: error.message,
      total_cost_usd: 0,
    };
  }
}

// ===========================
// Utility Functions
// ===========================

/**
 * Handle simple query directly (no orchestrator needed)
 *
 * @param {string} query - User query
 * @param {Object} session - Session object
 * @returns {Promise<Object>} Direct response
 */
export async function handleSimpleQuery(query, session) {
  // For simple queries, provide direct response
  // This would integrate with Haiku API in production

  return {
    handled_by: 'router',
    model: session.model,
    response_type: 'direct',
    message: 'Query handled directly by router',
    classification: await classifyIntent(query),
  };
}

/**
 * Clean up old session files (older than 24 hours)
 *
 * @returns {Promise<number>} Number of files cleaned
 */
export async function cleanupOldSessions() {
  try {
    const files = await fs.readdir(SESSION_STATE_DIR);
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    let cleaned = 0;

    for (const file of files) {
      if (!file.startsWith('router-session-')) continue;

      const filePath = path.join(SESSION_STATE_DIR, file);
      const stats = await fs.stat(filePath);

      if (now - stats.mtimeMs > maxAge) {
        await fs.unlink(filePath);
        cleaned++;
      }
    }

    return cleaned;
  } catch (error) {
    console.warn('Session cleanup failed:', error.message);
    return 0;
  }
}

// ===========================
// CLI Support
// ===========================

/**
 * CLI entry point for testing
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case 'classify': {
        const prompt = args.slice(1).join(' ');
        const classification = await classifyIntent(prompt);
        console.log(JSON.stringify(classification, null, 2));
        break;
      }

      case 'init-session': {
        const sessionId = args[1] || `test-${Date.now()}`;
        const prompt = args.slice(2).join(' ');
        const session = await initializeRouterSession(sessionId, prompt);
        console.log(JSON.stringify(session, null, 2));
        break;
      }

      case 'select-workflow': {
        const intent = args[1];
        const complexity = args[2] || 'medium';
        const workflow = await selectWorkflow(intent, complexity);
        console.log(`Selected workflow: ${workflow}`);
        break;
      }

      case 'cleanup': {
        const cleaned = await cleanupOldSessions();
        console.log(`Cleaned up ${cleaned} old session files`);
        break;
      }

      default:
        console.log(`
Router Session Handler CLI

Commands:
  classify <prompt>                 - Classify intent
  init-session <id> <prompt>        - Initialize session
  select-workflow <intent> <level>  - Select workflow
  cleanup                           - Clean old sessions

Examples:
  node router-session-handler.mjs classify "build a web app"
  node router-session-handler.mjs init-session test-123 "create api"
  node router-session-handler.mjs select-workflow web_app high
        `);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run CLI if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

// ===========================
// Exports
// ===========================

export default {
  initializeRouterSession,
  classifyIntent,
  selectWorkflow,
  routeToOrchestrator,
  trackCosts,
  getCostSummary,
  handleSimpleQuery,
  cleanupOldSessions,
};
