#!/usr/bin/env node
/**
 * Session Manager
 * Implements Claude Agent SDK session management patterns
 * Based on: https://docs.claude.com/en/docs/agent-sdk/sessions.md
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SESSIONS_DIR = path.join(__dirname, '../context/sessions');
const MAX_SESSION_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Create a new session
 */
export function createSession(agentName, metadata = {}) {
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const timestamp = new Date().toISOString();

  const session = {
    sessionId,
    agent: agentName,
    createdAt: timestamp,
    updatedAt: timestamp,
    status: 'active',
    metadata,
    messages: [],
    toolCalls: [],
    contextFiles: [],
    cost: {
      total: 0,
      tokens: 0,
    },
  };

  saveSession(session);
  return session;
}

/**
 * Get session by ID
 */
export function getSession(sessionId) {
  const filePath = path.join(SESSIONS_DIR, `${sessionId}.json`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading session:', error);
    return null;
  }
}

/**
 * Update session
 */
export function updateSession(sessionId, updates) {
  const session = getSession(sessionId);

  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  Object.assign(session, updates, {
    updatedAt: new Date().toISOString(),
  });

  saveSession(session);
  return session;
}

/**
 * Add message to session
 */
export function addMessage(sessionId, role, content, metadata = {}) {
  const session = getSession(sessionId);

  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  const message = {
    role, // 'user' | 'assistant' | 'system'
    content,
    timestamp: new Date().toISOString(),
    metadata,
  };

  session.messages.push(message);
  updateSession(sessionId, { messages: session.messages });

  return message;
}

/**
 * Add tool call to session
 */
export function addToolCall(sessionId, toolName, input, output, metadata = {}) {
  const session = getSession(sessionId);

  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  const toolCall = {
    tool: toolName,
    input,
    output,
    timestamp: new Date().toISOString(),
    metadata,
  };

  session.toolCalls.push(toolCall);
  updateSession(sessionId, { toolCalls: session.toolCalls });

  return toolCall;
}

/**
 * Close session
 */
export function closeSession(sessionId, reason = 'completed') {
  return updateSession(sessionId, {
    status: 'closed',
    closedAt: new Date().toISOString(),
    closeReason: reason,
  });
}

/**
 * List active sessions
 */
export function listActiveSessions(agentName = null) {
  if (!fs.existsSync(SESSIONS_DIR)) {
    return [];
  }

  const files = fs.readdirSync(SESSIONS_DIR);
  const sessions = [];

  files.forEach(file => {
    if (file.endsWith('.json')) {
      const session = getSession(file.replace('.json', ''));
      if (session && session.status === 'active') {
        if (!agentName || session.agent === agentName) {
          sessions.push(session);
        }
      }
    }
  });

  return sessions.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

/**
 * Cleanup old sessions
 */
export function cleanupOldSessions() {
  if (!fs.existsSync(SESSIONS_DIR)) {
    return;
  }

  const files = fs.readdirSync(SESSIONS_DIR);
  const now = Date.now();
  let cleaned = 0;

  files.forEach(file => {
    if (file.endsWith('.json')) {
      const session = getSession(file.replace('.json', ''));
      if (session) {
        const age = now - new Date(session.updatedAt).getTime();
        if (age > MAX_SESSION_AGE) {
          const filePath = path.join(SESSIONS_DIR, file);
          fs.unlinkSync(filePath);
          cleaned++;
        }
      }
    }
  });

  return cleaned;
}

/**
 * Get session statistics
 */
export function getSessionStats(agentName = null, days = 7) {
  if (!fs.existsSync(SESSIONS_DIR)) {
    return null;
  }

  const files = fs.readdirSync(SESSIONS_DIR);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const sessions = [];
  files.forEach(file => {
    if (file.endsWith('.json')) {
      const session = getSession(file.replace('.json', ''));
      if (session) {
        const sessionDate = new Date(session.createdAt);
        if (sessionDate >= cutoff && (!agentName || session.agent === agentName)) {
          sessions.push(session);
        }
      }
    }
  });

  if (sessions.length === 0) {
    return null;
  }

  const stats = {
    totalSessions: sessions.length,
    activeSessions: sessions.filter(s => s.status === 'active').length,
    closedSessions: sessions.filter(s => s.status === 'closed').length,
    averageMessages: Math.round(
      sessions.reduce((sum, s) => sum + s.messages.length, 0) / sessions.length
    ),
    averageToolCalls: Math.round(
      sessions.reduce((sum, s) => sum + s.toolCalls.length, 0) / sessions.length
    ),
    totalCost: sessions.reduce((sum, s) => sum + (s.cost?.total || 0), 0),
    byAgent: groupBy(sessions, 'agent', 'length'),
  };

  return stats;
}

/**
 * Save session to file
 */
function saveSession(session) {
  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  }

  const filePath = path.join(SESSIONS_DIR, `${session.sessionId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf8');
}

/**
 * Group sessions by field
 */
function groupBy(sessions, field, operation = 'count') {
  const grouped = {};
  sessions.forEach(session => {
    const key = session[field];
    if (!grouped[key]) {
      grouped[key] = operation === 'count' ? 0 : [];
    }
    if (operation === 'count') {
      grouped[key]++;
    } else {
      grouped[key].push(session);
    }
  });
  return grouped;
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  const arg1 = process.argv[3];
  const arg2 = process.argv[4];

  if (command === 'create' && arg1) {
    const session = createSession(arg1, {});
    console.log(JSON.stringify(session, null, 2));
  } else if (command === 'get' && arg1) {
    const session = getSession(arg1);
    console.log(JSON.stringify(session, null, 2));
  } else if (command === 'list') {
    const sessions = listActiveSessions(arg1);
    console.log(JSON.stringify(sessions, null, 2));
  } else if (command === 'close' && arg1) {
    const session = closeSession(arg1, arg2 || 'completed');
    console.log(JSON.stringify(session, null, 2));
  } else if (command === 'stats') {
    const stats = getSessionStats(arg1, parseInt(arg2) || 7);
    console.log(JSON.stringify(stats, null, 2));
  } else if (command === 'cleanup') {
    const cleaned = cleanupOldSessions();
    console.log(`Cleaned up ${cleaned} old sessions`);
  } else {
    console.log('Usage: session-manager.mjs [create|get|list|close|stats|cleanup] [args...]');
  }
}
