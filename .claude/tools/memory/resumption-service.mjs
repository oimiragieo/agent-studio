/**
 * Conversation Resumption Service
 *
 * Provides session resumption capabilities for Phase 2 Memory System.
 *
 * Features:
 * - Resume sessions from session ID
 * - Load recent conversations and messages
 * - Format context for memory injection
 * - Respect token limits
 * - Provide session metadata
 *
 * Architecture Reference:
 * - Section 9.1: Conversation Resumption
 * - Section 9.2: Session Context Loading
 */

/**
 * Conversation Resumption Service
 */
export class ConversationResumptionService {
  /**
   * @param {import('./database.mjs').MemoryDatabase} database - Memory database instance
   */
  constructor(database) {
    this.database = database;
    this.defaultTokenLimit = 10000;
    this.defaultMessageCount = 20;
    this.defaultConversationCount = 3;
  }

  /**
   * Resume a session by loading recent context
   *
   * @param {string} sessionId - Session ID to resume
   * @param {object} options - Resumption options
   * @param {number} options.tokenLimit - Maximum tokens to include (default: 10000)
   * @param {number} options.messageCount - Number of recent messages (default: 20)
   * @param {number} options.conversationCount - Number of recent conversations (default: 3)
   * @returns {Promise<object>} Resumption context
   */
  async resumeSession(sessionId, options = {}) {
    const tokenLimit = options.tokenLimit || this.defaultTokenLimit;
    const messageCount = options.messageCount || this.defaultMessageCount;
    const conversationCount = options.conversationCount || this.defaultConversationCount;

    // Verify session exists and is not archived
    const canResume = await this.canResumeSession(sessionId);
    if (!canResume) {
      throw new Error(`Cannot resume session ${sessionId}: session not found or archived`);
    }

    // Get session metadata
    const session = this.database.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Get recent conversations
    const conversations = this.getRecentConversations(sessionId, conversationCount);

    // Get recent messages within token limit
    const messages = this.getRecentMessages(sessionId, messageCount, tokenLimit);

    // Calculate actual token count
    const tokenCount = messages.reduce((sum, msg) => sum + (msg.token_count || 0), 0);

    // Format context for injection
    const context = this.formatResumptionContext(session, conversations, messages);

    // Get session metadata
    const metadata = this.getSessionMetadata(sessionId);

    return {
      success: true,
      sessionId,
      context,
      tokenCount,
      metadata: {
        ...metadata,
        conversationCount: conversations.length,
        messageCount: messages.length,
        resumedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Check if a session can be resumed
   *
   * @param {string} sessionId - Session ID to check
   * @returns {Promise<boolean>} True if session can be resumed
   */
  async canResumeSession(sessionId) {
    const session = this.database.getSession(sessionId);

    if (!session) {
      return false;
    }

    // Cannot resume archived sessions
    if (session.status === 'archived') {
      return false;
    }

    return true;
  }

  /**
   * Get resumption context formatted for memory injection
   *
   * @param {string} sessionId - Session ID
   * @param {number} tokenLimit - Maximum tokens to include (default: 10000)
   * @returns {Promise<object>} Formatted resumption context
   */
  async getResumptionContext(sessionId, tokenLimit = 10000) {
    return this.resumeSession(sessionId, { tokenLimit });
  }

  /**
   * Get recent conversations for a session
   *
   * @param {string} sessionId - Session ID
   * @param {number} limit - Number of conversations to retrieve
   * @returns {Array<object>} Recent conversations
   */
  getRecentConversations(sessionId, limit = 3) {
    const stmt = this.database.prepare(`
      SELECT
        id,
        conversation_id,
        session_id,
        title,
        summary,
        created_at,
        updated_at,
        message_count,
        total_tokens
      FROM conversations
      WHERE session_id = ?
      ORDER BY updated_at DESC
      LIMIT ?
    `);

    return stmt.all(sessionId, limit);
  }

  /**
   * Get recent messages for a session within token limit
   *
   * @param {string} sessionId - Session ID
   * @param {number} messageLimit - Maximum number of messages
   * @param {number} tokenLimit - Maximum tokens to include
   * @returns {Array<object>} Recent messages
   */
  getRecentMessages(sessionId, messageLimit = 20, tokenLimit = 10000) {
    // Get all recent messages (ordered newest first)
    const stmt = this.database.prepare(`
      SELECT
        m.id,
        m.conversation_id,
        m.role,
        m.content,
        m.token_count,
        m.created_at,
        m.is_summarized,
        c.title as conversation_title
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE c.session_id = ?
      ORDER BY m.created_at DESC
      LIMIT ?
    `);

    const allMessages = stmt.all(sessionId, messageLimit);

    // Filter messages to stay within token limit
    let totalTokens = 0;
    const messages = [];

    for (const message of allMessages) {
      const messageTokens = message.token_count || 0;

      if (totalTokens + messageTokens <= tokenLimit) {
        messages.push(message);
        totalTokens += messageTokens;
      } else {
        break;
      }
    }

    // Reverse to get chronological order (oldest first)
    return messages.reverse();
  }

  /**
   * Format resumption context for memory injection
   *
   * @param {object} session - Session metadata
   * @param {Array<object>} conversations - Recent conversations
   * @param {Array<object>} messages - Recent messages
   * @returns {string} Formatted context string
   */
  formatResumptionContext(session, conversations, messages) {
    const sections = [];

    // Session summary
    sections.push('## Session Context');
    sections.push(`- Session ID: ${session.session_id}`);
    sections.push(`- User ID: ${session.user_id}`);
    sections.push(`- Project ID: ${session.project_id || 'N/A'}`);
    sections.push(`- Status: ${session.status}`);
    sections.push(`- Started: ${session.created_at}`);
    sections.push(`- Last Active: ${session.last_active_at}`);

    if (session.session_summary) {
      sections.push('');
      sections.push('### Session Summary');
      sections.push(session.session_summary);
    }

    sections.push('');

    // Conversation summaries
    if (conversations.length > 0) {
      sections.push('## Recent Conversations');
      sections.push('');

      conversations.forEach((conv, index) => {
        sections.push(`### ${index + 1}. ${conv.title || 'Untitled Conversation'}`);
        sections.push(`- Conversation ID: ${conv.conversation_id}`);
        sections.push(`- Created: ${conv.created_at}`);
        sections.push(`- Messages: ${conv.message_count || 0}`);
        sections.push(`- Tokens: ${conv.total_tokens || 0}`);

        if (conv.summary) {
          sections.push('');
          sections.push(`**Summary**: ${conv.summary}`);
        }

        sections.push('');
      });
    }

    // Recent messages
    if (messages.length > 0) {
      sections.push('## Recent Messages');
      sections.push('');

      let currentConversation = null;

      messages.forEach(message => {
        // Add conversation header if changed
        if (message.conversation_title && message.conversation_title !== currentConversation) {
          currentConversation = message.conversation_title;
          sections.push(`### Conversation: ${currentConversation}`);
          sections.push('');
        }

        // Format message
        const role = message.role.charAt(0).toUpperCase() + message.role.slice(1);
        const timestamp = new Date(message.created_at).toLocaleTimeString();

        sections.push(`**${role}** (${timestamp}):`);
        sections.push(message.content);

        if (message.is_summarized) {
          sections.push('*(This message has been summarized)*');
        }

        sections.push('');
      });
    }

    return sections.join('\n');
  }

  /**
   * Get session metadata for resumption
   *
   * @param {string} sessionId - Session ID
   * @returns {object} Session metadata
   */
  getSessionMetadata(sessionId) {
    // Get session stats
    const statsStmt = this.database.prepare(`
      SELECT
        COUNT(DISTINCT c.id) as conversation_count,
        COUNT(DISTINCT m.id) as message_count,
        SUM(m.token_count) as total_tokens,
        COUNT(DISTINCT ai.id) as agent_interaction_count
      FROM sessions s
      LEFT JOIN conversations c ON s.session_id = c.session_id
      LEFT JOIN messages m ON c.id = m.conversation_id
      LEFT JOIN agent_interactions ai ON c.id = ai.conversation_id
      WHERE s.session_id = ?
      GROUP BY s.session_id
    `);

    const stats = statsStmt.get(sessionId) || {
      conversation_count: 0,
      message_count: 0,
      total_tokens: 0,
      agent_interaction_count: 0,
    };

    // Get recent agents used
    const agentsStmt = this.database.prepare(`
      SELECT DISTINCT agent_name, COUNT(*) as usage_count
      FROM agent_interactions
      WHERE conversation_id IN (
        SELECT id FROM conversations WHERE session_id = ?
      )
      GROUP BY agent_name
      ORDER BY usage_count DESC
      LIMIT 5
    `);

    const recentAgents = agentsStmt.all(sessionId);

    // Get cost summary
    const costStmt = this.database.prepare(`
      SELECT
        SUM(cost_usd) as total_cost,
        SUM(input_tokens) as total_input_tokens,
        SUM(output_tokens) as total_output_tokens
      FROM cost_tracking
      WHERE session_id = ?
    `);

    const costs = costStmt.get(sessionId) || {
      total_cost: 0,
      total_input_tokens: 0,
      total_output_tokens: 0,
    };

    return {
      conversationCount: stats.conversation_count,
      messageCount: stats.message_count,
      totalTokens: stats.total_tokens,
      agentInteractionCount: stats.agent_interaction_count,
      recentAgents: recentAgents.map(a => ({
        name: a.agent_name,
        usageCount: a.usage_count,
      })),
      costs: {
        totalCostUSD: costs.total_cost || 0,
        totalInputTokens: costs.total_input_tokens || 0,
        totalOutputTokens: costs.total_output_tokens || 0,
      },
    };
  }

  /**
   * Update session status to active when resuming
   *
   * @param {string} sessionId - Session ID
   * @returns {void}
   */
  activateSession(sessionId) {
    this.database.updateSession(sessionId, {
      status: 'active',
      last_active_at: new Date().toISOString(),
    });
  }

  /**
   * Get session summary for quick preview
   *
   * @param {string} sessionId - Session ID
   * @returns {object} Session summary
   */
  getSessionSummary(sessionId) {
    const session = this.database.getSession(sessionId);
    if (!session) {
      return null;
    }

    const metadata = this.getSessionMetadata(sessionId);

    return {
      sessionId: session.session_id,
      userId: session.user_id,
      projectId: session.project_id,
      status: session.status,
      createdAt: session.created_at,
      lastActiveAt: session.last_active_at,
      summary: session.session_summary,
      ...metadata,
    };
  }

  /**
   * List resumable sessions for a user
   *
   * @param {string} userId - User ID
   * @param {number} limit - Maximum number of sessions to return
   * @returns {Array<object>} List of resumable sessions
   */
  listResumableSessions(userId, limit = 10) {
    const stmt = this.database.prepare(`
      SELECT
        s.session_id,
        s.user_id,
        s.project_id,
        s.status,
        s.created_at,
        s.last_active_at,
        s.session_summary,
        COUNT(DISTINCT c.id) as conversation_count,
        COUNT(DISTINCT m.id) as message_count
      FROM sessions s
      LEFT JOIN conversations c ON s.session_id = c.session_id
      LEFT JOIN messages m ON c.id = m.conversation_id
      WHERE s.user_id = ?
        AND s.status != 'archived'
      GROUP BY s.session_id
      ORDER BY s.last_active_at DESC
      LIMIT ?
    `);

    return stmt.all(userId, limit);
  }
}

/**
 * Factory function to create Conversation Resumption Service
 *
 * @param {import('./database.mjs').MemoryDatabase} database - Memory database instance
 * @returns {ConversationResumptionService}
 */
export function createResumptionService(database) {
  if (!database || !database.isInitialized) {
    throw new Error('Database must be initialized before creating resumption service');
  }

  return new ConversationResumptionService(database);
}
