/**
 * Context Overflow Handler
 *
 * Manages context window limits through progressive compaction.
 *
 * Implementation Scope:
 * ✅ Overflow detection with threshold-based actions
 * ✅ Stage 1: Compress old messages (keep first 100 chars) - Step 2.5a
 * ✅ Stage 2: Summarize conversations - Step 2.5b
 * ✅ Stage 3: Session handoff - Step 2.5b
 * ✅ Token estimation helper
 *
 * Performance Targets:
 * - Overflow detection: <5ms
 * - Message compression (50 messages): <50ms
 * - Conversation summarization (5 conversations): <100ms
 * - Session handoff: <200ms
 * - Token estimation: <1ms per call
 */

/**
 * Context Overflow Handler
 *
 * Detects context overflow and applies progressive compression strategies
 */
export class ContextOverflowHandler {
    /**
     * @param {object} database - MemoryDatabase instance
     */
    constructor(database) {
        this.db = database;

        // Context usage thresholds
        this.THRESHOLDS = {
            WARNING: 0.85,      // 85% - start monitoring
            COMPRESS: 0.90,     // 90% - compress old messages
            SUMMARIZE: 0.93,    // 93% - summarize conversations
            HANDOFF: 0.97       // 97% - session handoff
        };
    }

    /**
     * Detect context overflow and determine action
     *
     * Calculates current context usage ratio and returns appropriate action
     * based on thresholds.
     *
     * @param {string} sessionId - Current session ID
     * @param {number} currentTokens - Current context token count
     * @param {number} maxTokens - Maximum context tokens allowed
     * @returns {Promise<object>} Detection result with action and usage
     *
     * @example
     * const result = await handler.detectOverflow('sess-123', 180000, 200000);
     * // { action: 'compress', usage: 0.90, threshold: 'COMPRESS' }
     */
    async detectOverflow(sessionId, currentTokens, maxTokens) {
        const usage = currentTokens / maxTokens;

        // No action needed if below warning threshold
        if (usage < this.THRESHOLDS.WARNING) {
            return {
                action: 'none',
                usage,
                threshold: null,
                message: 'Context usage within safe limits'
            };
        }

        // Determine which threshold was crossed
        let action = 'warn';
        let threshold = 'WARNING';

        if (usage >= this.THRESHOLDS.HANDOFF) {
            action = 'handoff';
            threshold = 'HANDOFF';
        } else if (usage >= this.THRESHOLDS.SUMMARIZE) {
            action = 'summarize';
            threshold = 'SUMMARIZE';
        } else if (usage >= this.THRESHOLDS.COMPRESS) {
            action = 'compress';
            threshold = 'COMPRESS';
        }

        // Log warning
        console.warn(
            `[Overflow] Context usage at ${(usage * 100).toFixed(1)}% ` +
            `(threshold: ${threshold})`
        );

        return {
            action,
            usage,
            threshold,
            message: `Context usage at ${(usage * 100).toFixed(1)}% - action: ${action}`
        };
    }

    /**
     * Stage 1: Compress old messages
     *
     * Compresses messages older than the last 10 turns by keeping only
     * the first 100 characters. This reduces token usage while preserving
     * message structure and recent context.
     *
     * Algorithm:
     * 1. Query messages older than last 10 turns
     * 2. Filter to non-summarized messages only
     * 3. Limit to 50 messages per run (performance constraint)
     * 4. Compress content to first 100 chars + "..."
     * 5. Update database with compressed content
     * 6. Store original content for recovery
     *
     * @param {string} sessionId - Session ID to compress messages for
     * @returns {Promise<object>} Compression result
     *
     * @example
     * const result = await handler.compressOldMessages('sess-123');
     * // { tokensFreed: 15420, messagesCompressed: 48 }
     */
    async compressOldMessages(sessionId) {
        const startTime = Date.now();

        try {
            // Get messages older than last 10 turns that haven't been summarized
            // Note: This query finds messages NOT in the most recent 10 for their conversation
            const oldMessages = this.db.prepare(`
                SELECT m.id, m.content, m.token_count, m.conversation_id
                FROM messages m
                JOIN conversations c ON m.conversation_id = c.id
                WHERE c.session_id = ?
                  AND m.is_summarized = FALSE
                  AND m.id NOT IN (
                      -- Exclude most recent 10 messages per conversation
                      SELECT id FROM messages
                      WHERE conversation_id = m.conversation_id
                      ORDER BY created_at DESC
                      LIMIT 10
                  )
                ORDER BY m.created_at ASC
                LIMIT 50
            `).all(sessionId);

            if (oldMessages.length === 0) {
                console.log('[Overflow] No messages to compress');
                return {
                    tokensFreed: 0,
                    messagesCompressed: 0,
                    duration: Date.now() - startTime
                };
            }

            let tokensFreed = 0;

            // Prepare update statement (reuse for performance)
            const updateStmt = this.db.prepare(`
                UPDATE messages
                SET content = ?,
                    token_count = ?,
                    is_summarized = TRUE,
                    original_content = ?
                WHERE id = ?
            `);

            // Compress each message
            for (const msg of oldMessages) {
                // Compress: keep first 100 chars as summary
                const compressed = msg.content.length > 100
                    ? msg.content.substring(0, 100) + '...'
                    : msg.content;

                // Estimate new token count
                const compressedTokens = this.estimateTokens(compressed);
                const originalTokens = msg.token_count || this.estimateTokens(msg.content);

                // Calculate tokens saved
                tokensFreed += originalTokens - compressedTokens;

                // Update database
                updateStmt.run(
                    compressed,
                    compressedTokens,
                    msg.content,
                    msg.id
                );
            }

            const duration = Date.now() - startTime;

            console.log(
                `[Overflow] Compressed ${oldMessages.length} messages, ` +
                `freed ${tokensFreed} tokens in ${duration}ms`
            );

            return {
                tokensFreed,
                messagesCompressed: oldMessages.length,
                duration
            };

        } catch (error) {
            console.error('[Overflow] Compression failed:', error.message);
            throw new Error(`Message compression failed: ${error.message}`);
        }
    }

    /**
     * Estimate token count for text
     *
     * Uses a simple heuristic: ~4 characters per token.
     * This is a rough approximation suitable for overflow detection.
     * For accurate token counts, use a proper tokenizer.
     *
     * @param {string} text - Text to estimate tokens for
     * @returns {number} Estimated token count
     *
     * @example
     * const tokens = handler.estimateTokens("Hello world!");
     * // Returns: 3 (12 chars / 4 = 3 tokens)
     */
    estimateTokens(text) {
        if (!text || typeof text !== 'string') {
            return 0;
        }

        // Heuristic: ~4 characters per token
        // This is conservative (OpenAI's GPT models average ~4 chars/token)
        return Math.ceil(text.length / 4);
    }

    /**
     * Get current context usage for a session
     *
     * Calculates total token usage by summing all non-compressed message tokens.
     * This is a helper for external callers to check current usage.
     *
     * @param {string} sessionId - Session ID
     * @returns {Promise<object>} Usage statistics
     *
     * @example
     * const usage = await handler.getContextUsage('sess-123');
     * // { totalTokens: 145230, messageCount: 287, compressedCount: 48 }
     */
    async getContextUsage(sessionId) {
        const result = this.db.prepare(`
            SELECT
                SUM(m.token_count) as total_tokens,
                COUNT(*) as message_count,
                SUM(CASE WHEN m.is_summarized = TRUE THEN 1 ELSE 0 END) as compressed_count
            FROM messages m
            JOIN conversations c ON m.conversation_id = c.id
            WHERE c.session_id = ?
        `).get(sessionId);

        return {
            totalTokens: result.total_tokens || 0,
            messageCount: result.message_count || 0,
            compressedCount: result.compressed_count || 0
        };
    }

    /**
     * Stage 2: Summarize entire conversations
     *
     * Generates summaries for completed conversations that don't have summaries yet.
     * Uses simple text extraction (first + last message) to avoid external API dependencies.
     *
     * Algorithm:
     * 1. Query old conversations (ended, not current, no summary)
     * 2. Limit to 5 conversations per run (performance constraint)
     * 3. For each conversation:
     *    - Get all messages
     *    - Generate simple summary (first + last message)
     *    - Update conversation.summary
     *    - Mark all messages as summarized
     *    - Calculate tokens freed
     *
     * @param {string} sessionId - Session ID to summarize conversations for
     * @returns {Promise<object>} Summarization result
     *
     * @example
     * const result = await handler.summarizeConversations('sess-123');
     * // { tokensFreed: 23410, conversationsSummarized: 3 }
     */
    async summarizeConversations(sessionId) {
        const startTime = Date.now();

        try {
            // Get old conversations (not current, ended, no summary)
            const oldConversations = this.db.prepare(`
                SELECT c.id, c.conversation_id, c.message_count, c.title
                FROM conversations c
                WHERE c.session_id = ?
                  AND c.summary IS NULL
                  AND c.ended_at IS NOT NULL
                ORDER BY c.started_at ASC
                LIMIT 5
            `).all(sessionId);

            if (oldConversations.length === 0) {
                console.log('[Overflow] No conversations to summarize');
                return {
                    tokensFreed: 0,
                    conversationsSummarized: 0,
                    duration: Date.now() - startTime
                };
            }

            let tokensFreed = 0;

            // Process each conversation
            for (const conv of oldConversations) {
                // Get all messages for summarization
                const messages = this.db.prepare(`
                    SELECT role, content, token_count
                    FROM messages
                    WHERE conversation_id = ?
                    ORDER BY created_at
                `).all(conv.id);

                if (messages.length === 0) {
                    continue;
                }

                // Generate simple summary (first + last message)
                const firstMsg = messages[0];
                const lastMsg = messages[messages.length - 1];

                const summary = this._generateSimpleSummary(firstMsg, lastMsg, conv.title);

                // Calculate tokens freed
                const originalTokens = messages.reduce((sum, m) =>
                    sum + (m.token_count || this.estimateTokens(m.content)), 0
                );
                const summaryTokens = this.estimateTokens(summary);
                tokensFreed += originalTokens - summaryTokens;

                // Update conversation with summary
                this.db.prepare(`
                    UPDATE conversations SET summary = ? WHERE id = ?
                `).run(summary, conv.id);

                // Mark all messages as summarized
                this.db.prepare(`
                    UPDATE messages SET is_summarized = TRUE WHERE conversation_id = ?
                `).run(conv.id);
            }

            const duration = Date.now() - startTime;

            console.log(
                `[Overflow] Summarized ${oldConversations.length} conversations, ` +
                `freed ${tokensFreed} tokens in ${duration}ms`
            );

            return {
                tokensFreed,
                conversationsSummarized: oldConversations.length,
                duration
            };

        } catch (error) {
            console.error('[Overflow] Conversation summarization failed:', error.message);
            throw new Error(`Conversation summarization failed: ${error.message}`);
        }
    }

    /**
     * Generate simple summary from first and last messages
     *
     * Creates a concise summary without external API dependencies.
     * Format: "User requested: [first message]. Result: [last message]."
     *
     * @param {object} firstMsg - First message in conversation
     * @param {object} lastMsg - Last message in conversation
     * @param {string} title - Conversation title (optional)
     * @returns {string} Summary text (max 200 chars)
     * @private
     */
    _generateSimpleSummary(firstMsg, lastMsg, title) {
        // Use title if available
        if (title) {
            return `${title.substring(0, 200)}`;
        }

        // Extract key parts from messages
        const userRequest = firstMsg.role === 'user'
            ? firstMsg.content.substring(0, 80)
            : 'User initiated conversation';

        const finalResult = lastMsg.content.substring(0, 80);

        const summary = `User requested: ${userRequest}. Result: ${finalResult}.`;

        // Ensure summary stays under 200 chars
        return summary.length > 200 ? summary.substring(0, 197) + '...' : summary;
    }

    /**
     * Stage 3: Initiate session handoff
     *
     * Creates a new session when context is nearly full, preserving critical context.
     * Archives the old session and records the handoff for tracking.
     *
     * Algorithm:
     * 1. Get current session from database
     * 2. Generate overall summary from all conversations
     * 3. Extract critical context (last 5 messages)
     * 4. Create new session with handoff metadata
     * 5. Archive old session
     * 6. Record handoff in session_handoffs table
     *
     * @param {string} sessionId - Current session ID to hand off from
     * @returns {Promise<object>} Handoff result with new session details
     *
     * @example
     * const result = await handler.initiateHandoff('sess-123');
     * // {
     * //   newSessionId: 'sess_1736701234567_handoff',
     * //   summary: 'Session summary...',
     * //   criticalContext: [{ role: 'user', content: '...' }, ...]
     * // }
     */
    async initiateHandoff(sessionId) {
        const startTime = Date.now();

        try {
            // Get current session
            const session = this.db.prepare(`
                SELECT * FROM sessions WHERE session_id = ?
            `).get(sessionId);

            if (!session) {
                throw new Error(`Session ${sessionId} not found`);
            }

            // Get all conversations for summary
            const conversations = this.db.prepare(`
                SELECT conversation_id, title, summary, started_at
                FROM conversations
                WHERE session_id = ?
                ORDER BY started_at DESC
            `).all(sessionId);

            // Generate overall summary
            const overallSummary = this._generateHandoffSummary(conversations);

            // Extract critical context (last 5 messages)
            const criticalMessages = this.db.prepare(`
                SELECT m.role, m.content
                FROM messages m
                JOIN conversations c ON m.conversation_id = c.id
                WHERE c.session_id = ?
                ORDER BY m.created_at DESC
                LIMIT 5
            `).all(sessionId).reverse();

            // Create new session
            const newSessionId = `sess_${Date.now()}_handoff`;

            this.db.prepare(`
                INSERT INTO sessions (session_id, user_id, project_id, metadata_json)
                VALUES (?, ?, ?, ?)
            `).run(
                newSessionId,
                session.user_id,
                session.project_id,
                JSON.stringify({
                    handoff_from: sessionId,
                    handoff_at: new Date().toISOString(),
                    summary_tokens: this.estimateTokens(overallSummary)
                })
            );

            // Archive old session
            this.db.prepare(`
                UPDATE sessions SET status = 'archived' WHERE session_id = ?
            `).run(sessionId);

            // Record handoff
            this.db.prepare(`
                INSERT INTO session_handoffs
                (from_session_id, to_session_id, summary, context_preserved, handoff_reason)
                VALUES (?, ?, ?, ?, ?)
            `).run(
                sessionId,
                newSessionId,
                overallSummary,
                JSON.stringify(criticalMessages),
                'context_overflow'
            );

            const duration = Date.now() - startTime;

            console.log(
                `[Overflow] Session handoff from ${sessionId} to ${newSessionId} ` +
                `completed in ${duration}ms`
            );

            return {
                newSessionId,
                summary: overallSummary,
                criticalContext: criticalMessages,
                duration
            };

        } catch (error) {
            console.error('[Overflow] Session handoff failed:', error.message);
            throw new Error(`Session handoff failed: ${error.message}`);
        }
    }

    /**
     * Generate handoff summary from conversations
     *
     * Creates a summary of the entire session for handoff to new session.
     * Lists conversation titles/summaries and key outcomes.
     *
     * @param {Array} conversations - Array of conversation objects
     * @returns {string} Overall session summary
     * @private
     */
    _generateHandoffSummary(conversations) {
        if (conversations.length === 0) {
            return 'Empty session - no conversations';
        }

        const summaryParts = ['Session summary:'];

        conversations.forEach((conv, idx) => {
            const convSummary = conv.summary || conv.title || `Conversation ${idx + 1}`;
            summaryParts.push(`- ${convSummary.substring(0, 100)}`);
        });

        const summary = summaryParts.join('\n');

        // Keep summary under 1000 chars
        return summary.length > 1000 ? summary.substring(0, 997) + '...' : summary;
    }

    /**
     * Handle overflow orchestration
     *
     * Coordinates all three overflow stages based on context usage thresholds.
     * Executes appropriate action and returns result.
     *
     * @param {string} sessionId - Session ID to handle overflow for
     * @param {number} currentTokens - Current context token count
     * @param {number} maxTokens - Maximum context tokens allowed
     * @returns {Promise<object>} Overflow handling result
     *
     * @example
     * const result = await handler.handleOverflow('sess-123', 185000, 200000);
     * // { action: 'compressed', tokensFreed: 15420, messagesCompressed: 48 }
     */
    async handleOverflow(sessionId, currentTokens, maxTokens) {
        const usage = currentTokens / maxTokens;

        // Stage 1: Compress (at 90%)
        if (usage >= this.THRESHOLDS.COMPRESS && usage < this.THRESHOLDS.SUMMARIZE) {
            const result = await this.compressOldMessages(sessionId);
            return { action: 'compressed', usage, ...result };
        }

        // Stage 2: Summarize (at 93%)
        if (usage >= this.THRESHOLDS.SUMMARIZE && usage < this.THRESHOLDS.HANDOFF) {
            const result = await this.summarizeConversations(sessionId);
            return { action: 'summarized', usage, ...result };
        }

        // Stage 3: Handoff (at 97%)
        if (usage >= this.THRESHOLDS.HANDOFF) {
            const result = await this.initiateHandoff(sessionId);
            return { action: 'handoff', usage, ...result };
        }

        return { action: 'none', usage };
    }
}

/**
 * Create overflow handler instance
 *
 * @param {object} database - MemoryDatabase instance
 * @returns {ContextOverflowHandler}
 */
export function createOverflowHandler(database) {
    return new ContextOverflowHandler(database);
}
