-- ============================================
-- Phase 2 Memory System - Database Schema
-- ============================================
-- Version: 1.0.0
-- Created: 2026-01-12
-- SQLite 3.40+ with FTS5 and WAL mode
-- ============================================

-- ============================================
-- Sessions Table
-- ============================================
-- Top-level session tracking
CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    project_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'paused', 'completed', 'archived')),
    metadata_json TEXT DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_last_active ON sessions(last_active_at);

-- Partial index for active sessions (faster lookups)
CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(user_id, last_active_at DESC)
WHERE status = 'active';

-- ============================================
-- Conversations Table
-- ============================================
-- Individual conversation threads within sessions
CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
    conversation_id TEXT UNIQUE NOT NULL,
    title TEXT,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME,
    message_count INTEGER DEFAULT 0,
    summary TEXT,
    metadata_json TEXT DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_conversations_session ON conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_conversations_started ON conversations(started_at);

-- ============================================
-- Messages Table
-- ============================================
-- Individual messages with importance scoring
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system', 'tool')),
    content TEXT NOT NULL,
    token_count INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    importance_score REAL DEFAULT 0.5,
    is_summarized BOOLEAN DEFAULT FALSE,
    original_content TEXT
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_importance ON messages(importance_score);

-- Partial index for non-summarized messages (active context)
CREATE INDEX IF NOT EXISTS idx_messages_recent ON messages(conversation_id, created_at DESC)
WHERE is_summarized = FALSE;

-- ============================================
-- Full-Text Search Index (FTS5)
-- ============================================
-- Enable fast text search across message content
CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
    content,
    content='messages',
    content_rowid='id',
    tokenize='porter unicode61'
);

-- Triggers to keep FTS5 in sync with messages table
CREATE TRIGGER IF NOT EXISTS messages_fts_insert AFTER INSERT ON messages BEGIN
    INSERT INTO messages_fts(rowid, content) VALUES (new.id, new.content);
END;

CREATE TRIGGER IF NOT EXISTS messages_fts_delete AFTER DELETE ON messages BEGIN
    INSERT INTO messages_fts(messages_fts, rowid, content) VALUES ('delete', old.id, old.content);
END;

CREATE TRIGGER IF NOT EXISTS messages_fts_update AFTER UPDATE ON messages BEGIN
    INSERT INTO messages_fts(messages_fts, rowid, content) VALUES ('delete', old.id, old.content);
    INSERT INTO messages_fts(rowid, content) VALUES (new.id, new.content);
END;

-- ============================================
-- Agent Interactions Table
-- ============================================
-- Track agent usage, costs, and results
CREATE TABLE IF NOT EXISTS agent_interactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    agent_type TEXT NOT NULL,
    task_description TEXT,
    result_summary TEXT,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    cost_usd REAL DEFAULT 0.0,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    status TEXT DEFAULT 'running' CHECK(status IN ('running', 'completed', 'failed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_agent_interactions_conversation ON agent_interactions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_agent_interactions_agent ON agent_interactions(agent_type);
CREATE INDEX IF NOT EXISTS idx_agent_interactions_status ON agent_interactions(status);

-- ============================================
-- Routing Decisions Table
-- ============================================
-- Log all routing decisions for analysis
CREATE TABLE IF NOT EXISTS routing_decisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
    intent TEXT,
    complexity TEXT,
    confidence REAL,
    selected_workflow TEXT,
    routing_method TEXT,
    decided_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reasoning TEXT
);

CREATE INDEX IF NOT EXISTS idx_routing_decisions_conversation ON routing_decisions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_routing_decisions_intent ON routing_decisions(intent);

-- ============================================
-- Cost Tracking Table
-- ============================================
-- Aggregate costs per session and model
CREATE TABLE IF NOT EXISTS cost_tracking (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
    model TEXT NOT NULL,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    cost_usd REAL DEFAULT 0.0,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cost_tracking_session ON cost_tracking(session_id);
CREATE INDEX IF NOT EXISTS idx_cost_tracking_model ON cost_tracking(model);
CREATE INDEX IF NOT EXISTS idx_cost_tracking_recorded ON cost_tracking(recorded_at);

-- ============================================
-- Message Embeddings Table
-- ============================================
-- Vector embeddings for semantic search
CREATE TABLE IF NOT EXISTS message_embeddings (
    message_id INTEGER PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
    embedding BLOB NOT NULL,
    embedding_model TEXT DEFAULT 'text-embedding-3-small',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- User Preferences Table
-- ============================================
-- Cross-session user preferences
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id TEXT NOT NULL,
    preference_key TEXT NOT NULL,
    preference_value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, preference_key)
);

CREATE INDEX IF NOT EXISTS idx_preferences_user ON user_preferences(user_id);

-- ============================================
-- Learned Patterns Table
-- ============================================
-- Pattern recognition across sessions
CREATE TABLE IF NOT EXISTS learned_patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern_type TEXT NOT NULL,
    pattern_key TEXT NOT NULL,
    pattern_value TEXT,
    occurrence_count INTEGER DEFAULT 1,
    confidence_score REAL DEFAULT 0.5,
    first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(pattern_type, pattern_key)
);

CREATE INDEX IF NOT EXISTS idx_patterns_type ON learned_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_patterns_confidence ON learned_patterns(confidence_score);
CREATE INDEX IF NOT EXISTS idx_patterns_last_seen ON learned_patterns(last_seen);

-- ============================================
-- Session Handoffs Table
-- ============================================
-- Track session continuations and handoffs
CREATE TABLE IF NOT EXISTS session_handoffs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_session_id TEXT NOT NULL REFERENCES sessions(session_id),
    to_session_id TEXT NOT NULL REFERENCES sessions(session_id),
    summary TEXT NOT NULL,
    context_preserved TEXT,
    handoff_reason TEXT,
    handoff_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_handoffs_from ON session_handoffs(from_session_id);
CREATE INDEX IF NOT EXISTS idx_handoffs_to ON session_handoffs(to_session_id);

-- ============================================
-- Memory Metrics Table
-- ============================================
-- Performance and usage metrics
CREATE TABLE IF NOT EXISTS memory_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    metric_name TEXT NOT NULL,
    metric_value REAL NOT NULL,
    metric_unit TEXT,
    session_id TEXT REFERENCES sessions(session_id)
);

CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON memory_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_metrics_name ON memory_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_metrics_session ON memory_metrics(session_id);

-- ============================================
-- Cleanup Log Table
-- ============================================
-- Track cleanup operations
CREATE TABLE IF NOT EXISTS cleanup_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cleanup_type TEXT NOT NULL,
    records_affected INTEGER,
    bytes_freed INTEGER,
    executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    duration_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_cleanup_executed ON cleanup_log(executed_at);

-- ============================================
-- Helper Views
-- ============================================

-- Active sessions with message counts
CREATE VIEW IF NOT EXISTS v_active_sessions AS
SELECT
    s.session_id,
    s.user_id,
    s.project_id,
    s.created_at,
    s.last_active_at,
    COUNT(DISTINCT c.id) as conversation_count,
    COUNT(DISTINCT m.id) as message_count,
    SUM(ct.cost_usd) as total_cost_usd
FROM sessions s
LEFT JOIN conversations c ON s.session_id = c.session_id
LEFT JOIN messages m ON c.id = m.conversation_id
LEFT JOIN cost_tracking ct ON s.session_id = ct.session_id
WHERE s.status = 'active'
GROUP BY s.session_id;

-- Recent agent activity
CREATE VIEW IF NOT EXISTS v_recent_agent_activity AS
SELECT
    ai.agent_type,
    ai.task_description,
    ai.status,
    ai.started_at,
    ai.completed_at,
    ai.input_tokens + ai.output_tokens as total_tokens,
    ai.cost_usd,
    c.conversation_id,
    s.session_id
FROM agent_interactions ai
JOIN conversations c ON ai.conversation_id = c.id
JOIN sessions s ON c.session_id = s.session_id
ORDER BY ai.started_at DESC
LIMIT 100;
