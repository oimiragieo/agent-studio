#!/usr/bin/env node
/**
 * Router Session Entry Hook
 *
 * Intercepts user prompts at session start and routes through Haiku router layer
 * for cost-effective intent classification before routing to orchestrator.
 *
 * Features:
 * - Lightweight classification (Haiku model)
 * - Complexity assessment
 * - Direct handling of simple prompts
 * - Orchestrator routing for complex prompts
 * - Cost tracking and aggregation
 * - Graceful error handling (fail-open to orchestrator)
 *
 * Hook Type: UserPromptSubmit or PreToolUse
 * Priority: 1 (executes first)
 *
 * @module router-session-entry-hook
 */

import {
  classifyIntent,
  selectWorkflow,
  routeToOrchestrator,
  initializeRouterSession,
} from '../tools/router-session-handler.mjs';
import { processUserPrompt } from '../tools/orchestrator-entry.mjs';

// ===========================
// Configuration
// ===========================

const COMPLEXITY_THRESHOLD = 0.7; // Route to orchestrator if complexity >= this value
const SESSION_ID_PREFIX = 'router-session';

// Generate simple session ID
function generateSessionId() {
  return `${SESSION_ID_PREFIX}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// ===========================
// Hook Main Function
// ===========================

/**
 * Main hook function - intercepts user prompts and routes appropriately
 *
 * @param {Object} hookContext - Hook execution context
 * @param {string} hookContext.userPrompt - The user's input prompt
 * @param {Object} hookContext.sessionContext - Current session context
 * @returns {Promise<Object>} Hook result with routing decision
 */
export async function main(hookContext = {}) {
  const { userPrompt, sessionContext = {} } = hookContext;

  // Validate inputs
  if (!userPrompt || typeof userPrompt !== 'string') {
    console.warn('[Router Hook] Invalid user prompt - failing open to orchestrator');
    return {
      proceed: true,
      handle_directly: false,
      routing_decision: null,
      error: 'invalid_user_prompt',
    };
  }

  console.log('[Router Hook] Intercepting user prompt for classification');
  console.log(`[Router Hook] Prompt preview: ${userPrompt.substring(0, 100)}...`);

  try {
    // Step 1: Initialize router session
    const sessionId = generateSessionId();
    console.log(`[Router Hook] Initializing router session: ${sessionId}`);

    const session = await initializeRouterSession(sessionId, userPrompt);

    // Step 2: Classify intent and determine complexity
    console.log('[Router Hook] Classifying intent...');
    const classification = await classifyIntent(userPrompt);

    console.log('[Router Hook] Classification result:');
    console.log(`  Intent: ${classification.intent}`);
    console.log(`  Complexity: ${classification.complexity} (score: ${classification.complexity_score.toFixed(2)})`);
    console.log(`  Should route: ${classification.should_route}`);
    console.log(`  Confidence: ${classification.confidence.toFixed(2)}`);

    // Step 3: Determine handling strategy
    if (classification.complexity_score < COMPLEXITY_THRESHOLD) {
      // Simple prompt - handle directly with Haiku (no orchestrator needed)
      console.log('[Router Hook] Simple prompt detected - handling directly with Haiku');

      return {
        proceed: true,
        handle_directly: true,
        routing_decision: {
          intent: classification.intent,
          complexity: classification.complexity,
          complexity_score: classification.complexity_score,
          confidence: classification.confidence,
          router_session_id: sessionId,
          model: session.model,
          classification_time_ms: classification.classification_time_ms,
          routing_method: 'direct_haiku_handling',
        },
        message: 'Simple prompt - handling directly with Haiku router',
      };
    }

    // Complex prompt - route to orchestrator
    console.log('[Router Hook] Complex prompt detected - routing to orchestrator');

    // Step 4: Select appropriate workflow
    const workflow = await selectWorkflow(classification.intent, classification.complexity);
    console.log(`[Router Hook] Selected workflow: ${workflow}`);

    // Step 5: Prepare routing decision for orchestrator
    const routingDecision = {
      intent: classification.intent,
      complexity: classification.complexity,
      complexity_score: classification.complexity_score,
      confidence: classification.confidence,
      workflow,
      selected_workflow: workflow,
      cloud_provider: classification.cloud_provider,
      router_session_id: sessionId,
      model: session.model,
      classification_time_ms: classification.classification_time_ms,
      routing_method: 'router_classification',
      keywords_detected: classification.keywords_detected,
    };

    // Step 6: Route to orchestrator
    console.log('[Router Hook] Preparing orchestrator handoff...');
    const orchestratorResult = await routeToOrchestrator(workflow, userPrompt, {
      session_id: sessionId,
      classification: routingDecision,
    });

    console.log('[Router Hook] Orchestrator handoff prepared successfully');

    // Step 7: Invoke orchestrator with routing decision
    // This passes the routing decision to orchestrator-entry.mjs
    console.log('[Router Hook] Invoking orchestrator with routing decision...');

    const orchestratorResponse = await processUserPrompt(
      userPrompt,
      {
        runId: null, // Let orchestrator generate run ID
        sessionContext: {
          session_id: sessionId,
          router_classification: routingDecision,
          cost_tracking: session.cost_tracking,
        },
      },
      routingDecision // Pass routing decision as third argument
    );

    console.log('[Router Hook] Orchestrator invocation complete');

    return {
      proceed: false, // Hook handled the prompt - no further processing needed
      handle_directly: false,
      routing_decision: routingDecision,
      orchestrator_response: orchestratorResponse,
      message: `Complex prompt routed to orchestrator with workflow: ${workflow}`,
    };
  } catch (error) {
    // Fail-open: On any error, route to orchestrator without classification
    console.error(`[Router Hook] Classification/routing failed: ${error.message}`);
    console.warn('[Router Hook] Failing open - routing to orchestrator without classification');

    return {
      proceed: true,
      handle_directly: false,
      routing_decision: null,
      error: error.message,
      fallback_mode: 'orchestrator_without_routing',
      message: 'Router classification failed - failing open to orchestrator',
    };
  }
}

// ===========================
// Hook Metadata (for hook registry)
// ===========================

export const hookMetadata = {
  name: 'router-session-entry',
  version: '1.0.0',
  description: 'Intercepts user prompts and routes through Haiku router for cost optimization',
  type: 'UserPromptSubmit', // or 'PreToolUse' depending on hook system
  priority: 1, // Execute first
  enabled: true,
};

// ===========================
// Exports
// ===========================

export default {
  main,
  hookMetadata,
};
