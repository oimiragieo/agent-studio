-- ============================================
-- Migration 004: Cross-Agent Memory Sharing
-- ============================================
-- Migration: 004
-- Description: Add agent-to-agent memory handoff and shared entity registry
-- Created: 2026-01-13
-- ============================================

-- ============================================
-- Entities Table (if not exists)
-- ============================================
-- Create entities table for Phase 1 entity memory
CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  value TEXT NOT NULL,
  confidence REAL DEFAULT 1.0,
  context TEXT,
  metadata TEXT,
  occurrence_count INTEGER DEFAULT 1,
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Entity attributes (key-value pairs)
CREATE TABLE IF NOT EXISTS entity_attributes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
);

-- Entity relationships (graph edges)
CREATE TABLE IF NOT EXISTS entity_relationships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_id_1 TEXT NOT NULL,
  entity_id_2 TEXT NOT NULL,
  relationship_type TEXT NOT NULL,
  strength REAL DEFAULT 1.0,
  context TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (entity_id_1) REFERENCES entities(id) ON DELETE CASCADE,
  FOREIGN KEY (entity_id_2) REFERENCES entities(id) ON DELETE CASCADE
);

-- Create indices for performance
CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
CREATE INDEX IF NOT EXISTS idx_entities_value ON entities(value);
CREATE INDEX IF NOT EXISTS idx_entities_active ON entities(is_active);
CREATE INDEX IF NOT EXISTS idx_entity_attributes_entity_id ON entity_attributes(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_relationships_entity1 ON entity_relationships(entity_id_1);
CREATE INDEX IF NOT EXISTS idx_entity_relationships_entity2 ON entity_relationships(entity_id_2);
CREATE INDEX IF NOT EXISTS idx_entity_relationships_type ON entity_relationships(relationship_type);

-- ============================================
-- Agent Collaborations Table
-- ============================================
-- Tracks which agents worked together and what context was shared
CREATE TABLE IF NOT EXISTS agent_collaborations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
    workflow_id TEXT,
    source_agent_id TEXT NOT NULL,
    target_agent_id TEXT NOT NULL,
    handoff_id TEXT UNIQUE NOT NULL,
    handoff_context TEXT, -- JSON containing shared memories and entities
    handoff_type TEXT DEFAULT 'sequential' CHECK(handoff_type IN ('sequential', 'parallel', 'fork', 'join')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    applied_at DATETIME,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'applied', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_collaborations_session ON agent_collaborations(session_id);
CREATE INDEX IF NOT EXISTS idx_collaborations_workflow ON agent_collaborations(workflow_id);
CREATE INDEX IF NOT EXISTS idx_collaborations_source ON agent_collaborations(source_agent_id);
CREATE INDEX IF NOT EXISTS idx_collaborations_target ON agent_collaborations(target_agent_id);
CREATE INDEX IF NOT EXISTS idx_collaborations_handoff ON agent_collaborations(handoff_id);
CREATE INDEX IF NOT EXISTS idx_collaborations_status ON agent_collaborations(status);
CREATE INDEX IF NOT EXISTS idx_collaborations_created ON agent_collaborations(created_at);

-- ============================================
-- Session Resume Checkpoints Table
-- ============================================
-- Stores checkpoints for session resume functionality
CREATE TABLE IF NOT EXISTS session_resume_checkpoints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
    checkpoint_id TEXT UNIQUE NOT NULL,
    checkpoint_type TEXT DEFAULT 'manual' CHECK(checkpoint_type IN ('manual', 'automatic', 'workflow', 'milestone')),
    memory_snapshot TEXT NOT NULL, -- JSON snapshot of memories
    entity_snapshot TEXT NOT NULL, -- JSON snapshot of entities
    agents_involved TEXT, -- JSON array of agent IDs
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resume_count INTEGER DEFAULT 0,
    last_resumed_at DATETIME,
    is_archived BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_checkpoints_session ON session_resume_checkpoints(session_id);
CREATE INDEX IF NOT EXISTS idx_checkpoints_type ON session_resume_checkpoints(checkpoint_type);
CREATE INDEX IF NOT EXISTS idx_checkpoints_created ON session_resume_checkpoints(created_at);
CREATE INDEX IF NOT EXISTS idx_checkpoints_archived ON session_resume_checkpoints(is_archived);

-- ============================================
-- Alter Existing Tables
-- ============================================

-- Add columns to messages table for cross-agent tracking
-- SQLite doesn't support ALTER TABLE ADD COLUMN with CHECK constraints directly
-- So we'll add columns without constraints first

-- Track which agent created this message
ALTER TABLE messages ADD COLUMN source_agent_id TEXT;

-- Track which agents this message was shared with (JSON array)
ALTER TABLE messages ADD COLUMN shared_with_agents TEXT DEFAULT '[]';

-- Track which handoff this message belongs to
ALTER TABLE messages ADD COLUMN handoff_id TEXT;

-- Create index for agent-based queries
CREATE INDEX IF NOT EXISTS idx_messages_source_agent ON messages(source_agent_id);
CREATE INDEX IF NOT EXISTS idx_messages_handoff ON messages(handoff_id);

-- Update entities table to support global shared entities
-- Add columns to track entity sharing across agents
ALTER TABLE entities ADD COLUMN is_global BOOLEAN DEFAULT FALSE;
ALTER TABLE entities ADD COLUMN last_updated_by_agent TEXT;
ALTER TABLE entities ADD COLUMN version INTEGER DEFAULT 1;
ALTER TABLE entities ADD COLUMN merge_count INTEGER DEFAULT 0;

-- Create indices for global entity queries
CREATE INDEX IF NOT EXISTS idx_entities_global ON entities(is_global);
CREATE INDEX IF NOT EXISTS idx_entities_updated_by ON entities(last_updated_by_agent);
CREATE INDEX IF NOT EXISTS idx_entities_version ON entities(version);

-- ============================================
-- Collaboration History View
-- ============================================
-- View to analyze agent collaboration patterns
CREATE VIEW IF NOT EXISTS v_agent_collaboration_history AS
SELECT
    ac.id,
    ac.session_id,
    ac.workflow_id,
    ac.source_agent_id,
    ac.target_agent_id,
    ac.handoff_id,
    ac.handoff_type,
    ac.created_at,
    ac.applied_at,
    ac.status,
    COUNT(m.id) as shared_message_count,
    s.user_id,
    s.project_id
FROM agent_collaborations ac
LEFT JOIN messages m ON ac.handoff_id = m.handoff_id
LEFT JOIN sessions s ON ac.session_id = s.session_id
GROUP BY ac.id;

-- ============================================
-- Resume Checkpoint View
-- ============================================
-- View to show available resume points
CREATE VIEW IF NOT EXISTS v_session_resume_points AS
SELECT
    src.id,
    src.session_id,
    src.checkpoint_id,
    src.checkpoint_type,
    src.created_at,
    src.resume_count,
    src.last_resumed_at,
    src.is_archived,
    s.user_id,
    s.project_id,
    s.status as session_status,
    COUNT(DISTINCT ac.id) as collaboration_count
FROM session_resume_checkpoints src
JOIN sessions s ON src.session_id = s.session_id
LEFT JOIN agent_collaborations ac ON s.session_id = ac.session_id
    AND ac.created_at <= src.created_at
WHERE src.is_archived = FALSE
GROUP BY src.id
ORDER BY src.created_at DESC;

-- ============================================
-- Record Migration
-- ============================================
INSERT INTO schema_version (version, description)
VALUES (4, 'Cross-agent memory sharing with handoffs, session resume, and shared entity registry');
