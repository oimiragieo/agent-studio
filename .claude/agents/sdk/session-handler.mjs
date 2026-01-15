#!/usr/bin/env node
/**
 * Session Handler - SDK Session Management
 * Manages agent sessions with SDK integration for context retention
 * Based on: https://docs.claude.com/en/docs/agent-sdk/sessions.md
 *
 * Features:
 * - Router session defaults (Haiku model)
 * - Orchestrator session defaults (Sonnet model)
 * - Settings.json integration
 * - Router prompt template injection
 * - Model-based session initialization
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { resolveRuntimePath } from '../../tools/context-path-resolver.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SESSIONS_DIR = resolveRuntimePath('sessions', { write: true });
const SETTINGS_PATH = join(__dirname, '../../../settings.json');
const ROUTER_TEMPLATE_PATH = join(__dirname, '../../../templates/user-session-router.md');

// ===========================
// Settings & Configuration
// ===========================

/**
 * Load settings from settings.json
 *
 * @returns {Promise<Object>} Settings object with defaults
 */
export async function loadSettings() {
  try {
    if (existsSync(SETTINGS_PATH)) {
      const content = await readFile(SETTINGS_PATH, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.warn('Failed to load settings.json, using defaults:', error.message);
  }

  // Return defaults if settings.json not found
  return {
    models: {
      router: 'claude-haiku-4-5',
      orchestrator: 'claude-sonnet-4-5',
      complex: 'claude-opus-4-5-20251101',
    },
    session: {
      default_model: 'claude-haiku-4-5',
      default_temperature: 0.1,
      default_role: 'router',
      router_enabled: true,
      auto_route_to_orchestrator: true,
    },
    routing: {
      complexity_threshold: 0.7,
      cost_optimization_enabled: true,
      fallback_to_sonnet: true,
    },
  };
}

/**
 * Load router prompt template
 *
 * @returns {Promise<string|null>} Router template content or null
 */
export async function loadRouterTemplate() {
  try {
    if (existsSync(ROUTER_TEMPLATE_PATH)) {
      return await readFile(ROUTER_TEMPLATE_PATH, 'utf-8');
    }
  } catch (error) {
    console.warn('Failed to load router template:', error.message);
  }
  return null;
}

/**
 * Determine model based on role and settings
 *
 * @param {string} role - Session role ('router', 'orchestrator', etc.)
 * @param {Object} settings - Settings object
 * @returns {string} Model identifier
 */
function getModelForRole(role, settings) {
  if (role === 'router') {
    return settings.models?.router || 'claude-haiku-4-5';
  } else if (role === 'orchestrator') {
    return settings.models?.orchestrator || 'claude-sonnet-4-5';
  } else if (role === 'complex') {
    return settings.models?.complex || 'claude-opus-4-5-20251101';
  }

  // Default to router model
  return settings.session?.default_model || 'claude-haiku-4-5';
}

// ===========================
// Session ID & File Management
// ===========================

/**
 * Generate unique session ID
 */
function generateSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get session file path
 */
function getSessionFilePath(sessionId) {
  return join(SESSIONS_DIR, `${sessionId}.json`);
}

/**
 * Create SDK session with router/orchestrator defaults
 * Note: Full implementation would use: import { Session } from '@anthropic-ai/sdk';
 *
 * @param {string} agentName - Agent name (or role: 'router', 'orchestrator')
 * @param {Object} metadata - Session metadata
 * @param {string} metadata.role - Session role ('router', 'orchestrator', etc.)
 * @param {string} metadata.initialPrompt - Initial user prompt (for router sessions)
 * @returns {Promise<Object>} Session object
 */
export async function createSDKSession(agentName, metadata = {}) {
  const sessionId = generateSessionId();

  // Load settings
  const settings = await loadSettings();

  // Determine role (default to router for user sessions)
  let role;
  if (metadata.role) {
    role = metadata.role;
  } else if (agentName === 'router') {
    role = 'router';
  } else if (agentName === 'orchestrator') {
    role = 'orchestrator';
  } else {
    role = settings.session?.default_role || 'router';
  }

  // Get model for role
  const model = getModelForRole(role, settings);

  // Load router template if router role
  const routerTemplate = role === 'router' ? await loadRouterTemplate() : null;

  // In production, this would use SDK Session class:
  // const session = new Session({
  //   agent: agentName,
  //   metadata: {
  //     project: metadata.project,
  //     feature: metadata.feature,
  //     workflow: metadata.workflow,
  //     ...metadata
  //   }
  // });

  const session = {
    session_id: sessionId,
    agent: agentName,
    role,
    model,
    temperature: settings.session?.default_temperature || 0.1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: 'active',
    metadata: {
      project: metadata.project || null,
      feature: metadata.feature || null,
      workflow: metadata.workflow || null,
      initial_prompt: metadata.initialPrompt || null,
      ...metadata,
    },
    messages: [],
    tool_calls: [],
    cost: {
      total: 0,
      input_tokens: 0,
      output_tokens: 0,
      tool_calls: 0,
    },
    history: [],
    settings: {
      router_enabled: settings.session?.router_enabled ?? true,
      auto_route_to_orchestrator: settings.session?.auto_route_to_orchestrator ?? true,
      complexity_threshold: settings.routing?.complexity_threshold ?? 0.7,
    },
    // Router-specific fields
    ...(role === 'router'
      ? {
          router_prompt: routerTemplate || null,
          routing_decisions: {
            total: 0,
            simple_handled: 0,
            routed_to_orchestrator: 0,
            average_complexity: 0.0,
            average_confidence: 0.0,
          },
        }
      : {}),
  };

  // Save session state
  await mkdir(SESSIONS_DIR, { recursive: true });
  await writeFile(getSessionFilePath(sessionId), JSON.stringify(session, null, 2), 'utf8');

  return session;
}

/**
 * Update SDK session
 */
export async function updateSDKSession(sessionId, updates) {
  const session = await loadSDKSession(sessionId);

  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  // Update session
  Object.assign(session, updates);
  session.updated_at = new Date().toISOString();

  // Save updated session
  await writeFile(getSessionFilePath(sessionId), JSON.stringify(session, null, 2), 'utf8');

  return session;
}

/**
 * Load SDK session
 */
export async function loadSDKSession(sessionId) {
  const sessionPath = getSessionFilePath(sessionId);

  if (!existsSync(sessionPath)) {
    return null;
  }

  const content = await readFile(sessionPath, 'utf8');
  return JSON.parse(content);
}

/**
 * Get session history
 */
export async function getSessionHistory(sessionId) {
  const session = await loadSDKSession(sessionId);

  if (!session) {
    return null;
  }

  return {
    session_id: session.session_id,
    agent: session.agent,
    created_at: session.created_at,
    updated_at: session.updated_at,
    status: session.status,
    message_count: session.messages?.length || 0,
    tool_call_count: session.tool_calls?.length || 0,
    cost: session.cost,
    history: session.history || [],
  };
}

/**
 * Add message to session
 */
export async function addSessionMessage(sessionId, message) {
  const session = await loadSDKSession(sessionId);

  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  if (!session.messages) {
    session.messages = [];
  }

  session.messages.push({
    ...message,
    timestamp: new Date().toISOString(),
  });

  return await updateSDKSession(sessionId, { messages: session.messages });
}

/**
 * Add tool call to session
 */
export async function addSessionToolCall(sessionId, toolCall) {
  const session = await loadSDKSession(sessionId);

  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  if (!session.tool_calls) {
    session.tool_calls = [];
  }

  session.tool_calls.push({
    ...toolCall,
    timestamp: new Date().toISOString(),
  });

  return await updateSDKSession(sessionId, { tool_calls: session.tool_calls });
}

/**
 * Update session cost
 */
export async function updateSessionCost(sessionId, costUpdate) {
  const session = await loadSDKSession(sessionId);

  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  session.cost = {
    total: (session.cost?.total || 0) + (costUpdate.total || 0),
    input_tokens: (session.cost?.input_tokens || 0) + (costUpdate.input_tokens || 0),
    output_tokens: (session.cost?.output_tokens || 0) + (costUpdate.output_tokens || 0),
    tool_calls: (session.cost?.tool_calls || 0) + (costUpdate.tool_calls || 1),
  };

  return await updateSDKSession(sessionId, { cost: session.cost });
}

/**
 * Close session
 */
export async function closeSDKSession(sessionId, reason = 'completed') {
  return await updateSDKSession(sessionId, {
    status: 'closed',
    closed_at: new Date().toISOString(),
    close_reason: reason,
  });
}

// ===========================
// Convenience Functions
// ===========================

/**
 * Initialize router session with Haiku model
 * Convenience wrapper for createSDKSession with router defaults
 *
 * @param {string} initialPrompt - User's initial prompt
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Object>} Router session object
 */
export async function initializeRouterSession(initialPrompt, metadata = {}) {
  return await createSDKSession('router', {
    role: 'router',
    initialPrompt,
    ...metadata,
  });
}

/**
 * Initialize orchestrator session with Sonnet model
 * Convenience wrapper for createSDKSession with orchestrator defaults
 *
 * @param {Object} metadata - Session metadata
 * @returns {Promise<Object>} Orchestrator session object
 */
export async function initializeOrchestratorSession(metadata = {}) {
  return await createSDKSession('orchestrator', {
    role: 'orchestrator',
    ...metadata,
  });
}

/**
 * Get session model and settings
 *
 * @param {string} sessionId - Session identifier
 * @returns {Promise<Object|null>} Session model info or null
 */
export async function getSessionModelInfo(sessionId) {
  const session = await loadSDKSession(sessionId);

  if (!session) {
    return null;
  }

  return {
    session_id: sessionId,
    role: session.role,
    model: session.model,
    temperature: session.temperature,
    router_enabled: session.settings?.router_enabled ?? false,
    auto_route_to_orchestrator: session.settings?.auto_route_to_orchestrator ?? false,
  };
}

export default {
  createSDKSession,
  updateSDKSession,
  loadSDKSession,
  getSessionHistory,
  addSessionMessage,
  addSessionToolCall,
  updateSessionCost,
  closeSDKSession,
  initializeRouterSession,
  initializeOrchestratorSession,
  getSessionModelInfo,
  loadSettings,
  loadRouterTemplate,
};
