#!/usr/bin/env node
/**
 * Memory Tiers - STM/MTM/LTM Implementation
 * ==========================================
 *
 * Implements a three-tier memory hierarchy based on research findings:
 * - STM (Short-Term Memory): Current session context, session-bound
 * - MTM (Mid-Term Memory): Recent sessions (last 10), detailed retention
 * - LTM (Long-Term Memory): Permanent knowledge, compressed summaries
 *
 * Based on research report: memory-system-research.md
 * Key patterns:
 * - Hierarchical Memory Architecture (MemoryOS, H-MEM)
 * - Rolling Summary Compression (Factory.ai pattern)
 * - Utility-based pruning for overflow handling
 */

'use strict';

const fs = require('fs');
const path = require('path');

// BUG-001 Fix: Import findProjectRoot to prevent nested .claude folder creation
const { PROJECT_ROOT } = require('../utils/project-root.cjs');

// Configuration
const CONFIG = {
  MTM_MAX_SESSIONS: 10,
  MTM_WARN_THRESHOLD: 8, // Warn when approaching limit
  SUMMARY_MIN_SESSIONS: 5, // Minimum sessions to summarize
};

// Memory tier definitions
const MEMORY_TIERS = {
  STM: {
    name: 'short-term',
    retention: 'current_session',
    path: '.claude/context/memory/stm/',
    maxSessions: 1,
  },
  MTM: {
    name: 'mid-term',
    retention: '10_sessions',
    path: '.claude/context/memory/mtm/',
    maxSessions: 10,
  },
  LTM: {
    name: 'long-term',
    retention: 'permanent',
    path: '.claude/context/memory/ltm/',
    maxSessions: null, // unlimited but summarized
  },
};

/**
 * Get the memory directory path
 */
function getMemoryDir(projectRoot = PROJECT_ROOT) {
  return path.join(projectRoot, '.claude', 'context', 'memory');
}

/**
 * Ensure directory exists
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Get tier directory path
 */
function getTierPath(tier, projectRoot = PROJECT_ROOT) {
  const memoryDir = getMemoryDir(projectRoot);
  switch (tier) {
    case 'STM':
      return path.join(memoryDir, 'stm');
    case 'MTM':
      return path.join(memoryDir, 'mtm');
    case 'LTM':
      return path.join(memoryDir, 'ltm');
    default:
      throw new Error(`Unknown tier: ${tier}`);
  }
}

// ============================================================================
// STM Operations (Short-Term Memory)
// ============================================================================

/**
 * Write current session data to STM
 */
function writeSTMEntry(sessionData, projectRoot = PROJECT_ROOT) {
  const stmDir = getTierPath('STM', projectRoot);
  ensureDir(stmDir);

  const stmPath = path.join(stmDir, 'session_current.json');
  const entry = {
    ...sessionData,
    tier: 'STM',
    updated_at: new Date().toISOString(),
  };

  fs.writeFileSync(stmPath, JSON.stringify(entry, null, 2));
  return { success: true, path: stmPath };
}

/**
 * Read current STM entry
 */
function readSTMEntry(projectRoot = PROJECT_ROOT) {
  const stmDir = getTierPath('STM', projectRoot);
  const stmPath = path.join(stmDir, 'session_current.json');

  if (!fs.existsSync(stmPath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(stmPath, 'utf8'));
  } catch (e) {
    return null;
  }
}

/**
 * Clear STM (called after session consolidation)
 */
function clearSTM(projectRoot = PROJECT_ROOT) {
  const stmDir = getTierPath('STM', projectRoot);
  const stmPath = path.join(stmDir, 'session_current.json');

  if (fs.existsSync(stmPath)) {
    fs.unlinkSync(stmPath);
  }
}

// ============================================================================
// MTM Operations (Mid-Term Memory)
// ============================================================================

/**
 * Get all sessions in MTM, sorted by timestamp (oldest first)
 */
function getMTMSessions(projectRoot = PROJECT_ROOT) {
  const mtmDir = getTierPath('MTM', projectRoot);
  ensureDir(mtmDir);

  const files = fs
    .readdirSync(mtmDir)
    .filter(f => f.endsWith('.json'))
    .sort();

  return files
    .map(f => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(mtmDir, f), 'utf8'));
        return { ...data, _filename: f };
      } catch (e) {
        return null;
      }
    })
    .filter(Boolean);
}

/**
 * Consolidate session from STM to MTM
 * Called when a session ends
 */
function consolidateSession(sessionId, projectRoot = PROJECT_ROOT) {
  const stmDir = getTierPath('STM', projectRoot);
  const mtmDir = getTierPath('MTM', projectRoot);
  ensureDir(mtmDir);

  // Find session in STM
  const stmPath = path.join(stmDir, 'session_current.json');
  if (!fs.existsSync(stmPath)) {
    return { success: false, error: 'No STM session found' };
  }

  let sessionData;
  try {
    sessionData = JSON.parse(fs.readFileSync(stmPath, 'utf8'));
  } catch (e) {
    return { success: false, error: 'Failed to read STM session' };
  }

  // Check if MTM is at capacity
  const mtmSessions = getMTMSessions(projectRoot);
  if (mtmSessions.length >= CONFIG.MTM_MAX_SESSIONS) {
    // Trigger summarization of oldest sessions to make room
    summarizeOldSessions(projectRoot);
  }

  // Generate MTM filename with timestamp
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const mtmFilename = `session_${timestamp}.json`;
  const mtmPath = path.join(mtmDir, mtmFilename);

  // Add consolidation metadata
  const mtmData = {
    ...sessionData,
    tier: 'MTM',
    consolidated_at: now.toISOString(),
  };

  // Write to MTM
  fs.writeFileSync(mtmPath, JSON.stringify(mtmData, null, 2));

  // Clear STM
  clearSTM(projectRoot);

  return {
    success: true,
    mtmPath: mtmPath,
    sessionId: sessionData.session_id || sessionId,
  };
}

/**
 * Find session in MTM by session_id
 */
function findMTMSession(sessionId, projectRoot = PROJECT_ROOT) {
  const mtmDir = getTierPath('MTM', projectRoot);
  const sessions = getMTMSessions(projectRoot);

  for (const session of sessions) {
    if (session.session_id === sessionId) {
      return {
        data: session,
        path: path.join(mtmDir, session._filename),
      };
    }
  }

  return null;
}

// ============================================================================
// LTM Operations (Long-Term Memory)
// ============================================================================

/**
 * Promote a high-value session from MTM to LTM
 */
function promoteToLTM(sessionId, projectRoot = PROJECT_ROOT) {
  const mtmDir = getTierPath('MTM', projectRoot);
  const ltmDir = getTierPath('LTM', projectRoot);
  ensureDir(ltmDir);

  // Find session in MTM
  const found = findMTMSession(sessionId, projectRoot);
  if (!found) {
    return { success: false, error: 'Session not found in MTM' };
  }

  // Generate LTM filename
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const ltmFilename = `promoted_${timestamp}.json`;
  const ltmPath = path.join(ltmDir, ltmFilename);

  // Add promotion metadata
  const ltmData = {
    ...found.data,
    tier: 'LTM',
    promoted_at: now.toISOString(),
    promotion_reason: 'manual_promotion',
  };
  delete ltmData._filename;

  // Write to LTM
  fs.writeFileSync(ltmPath, JSON.stringify(ltmData, null, 2));

  // Remove from MTM
  if (fs.existsSync(found.path)) {
    fs.unlinkSync(found.path);
  }

  return {
    success: true,
    ltmPath: ltmPath,
    sessionId: sessionId,
  };
}

/**
 * Generate a summary from multiple sessions (for LTM archive)
 */
function generateSessionSummary(sessions) {
  if (!sessions || sessions.length === 0) {
    return null;
  }

  // Sort by timestamp
  const sorted = [...sessions].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const startDate = sorted[0].timestamp.split('T')[0];
  const endDate = sorted[sorted.length - 1].timestamp.split('T')[0];

  // Aggregate data
  const allLearnings = [];
  const allDecisions = [];
  const allPatterns = [];
  const fileFrequency = {};

  for (const session of sessions) {
    // Collect learnings (from summaries)
    if (session.summary) {
      allLearnings.push(session.summary);
    }

    // Collect decisions
    if (session.decisions_made) {
      allDecisions.push(...session.decisions_made);
    }

    // Collect patterns
    if (session.patterns_found) {
      allPatterns.push(...session.patterns_found);
    }

    // Track file frequency
    if (session.files_modified) {
      for (const file of session.files_modified) {
        fileFrequency[file] = (fileFrequency[file] || 0) + 1;
      }
    }
  }

  // Get frequently touched files (touched more than once)
  const frequentFiles = Object.entries(fileFrequency)
    .filter(([_, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .map(([file]) => file);

  return {
    type: 'session_summary',
    date_range: {
      start: startDate,
      end: endDate,
    },
    session_count: sessions.length,
    session_ids: sessions.map(s => s.session_id).filter(Boolean),
    key_learnings: allLearnings,
    major_decisions: allDecisions,
    important_patterns: allPatterns,
    files_frequently_touched: frequentFiles,
    created_at: new Date().toISOString(),
  };
}

/**
 * Summarize old sessions from MTM to LTM
 * Called when MTM exceeds max sessions
 */
function summarizeOldSessions(projectRoot = PROJECT_ROOT) {
  const mtmDir = getTierPath('MTM', projectRoot);
  const ltmDir = getTierPath('LTM', projectRoot);
  ensureDir(ltmDir);

  const sessions = getMTMSessions(projectRoot);

  // Only summarize if we have more than max sessions
  if (sessions.length <= CONFIG.MTM_MAX_SESSIONS) {
    return { summarized: 0, summaryPath: null };
  }

  // Calculate how many to summarize (keep MTM at max)
  const toSummarize = sessions.length - CONFIG.MTM_MAX_SESSIONS + CONFIG.SUMMARY_MIN_SESSIONS;
  const sessionsToSummarize = sessions.slice(
    0,
    Math.min(toSummarize, sessions.length - CONFIG.SUMMARY_MIN_SESSIONS)
  );

  if (sessionsToSummarize.length < CONFIG.SUMMARY_MIN_SESSIONS) {
    return { summarized: 0, summaryPath: null };
  }

  // Generate summary
  const summary = generateSessionSummary(sessionsToSummarize);

  // Write summary to LTM
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const summaryFilename = `summary_${timestamp}.json`;
  const summaryPath = path.join(ltmDir, summaryFilename);

  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

  // Remove summarized sessions from MTM
  for (const session of sessionsToSummarize) {
    const sessionPath = path.join(mtmDir, session._filename);
    if (fs.existsSync(sessionPath)) {
      fs.unlinkSync(sessionPath);
    }
  }

  return {
    summarized: sessionsToSummarize.length,
    summaryPath: summaryPath,
    summary: summary,
  };
}

// ============================================================================
// Health Check
// ============================================================================

/**
 * Get health status of all memory tiers
 */
function getTierHealth(projectRoot = PROJECT_ROOT) {
  const result = {
    stm: { sessionCount: 0, warnings: [] },
    mtm: { sessionCount: 0, warnings: [] },
    ltm: { summaryCount: 0, warnings: [] },
    overall: 'healthy',
  };

  // Check STM
  const stmEntry = readSTMEntry(projectRoot);
  result.stm.sessionCount = stmEntry ? 1 : 0;

  // Check MTM
  const mtmSessions = getMTMSessions(projectRoot);
  result.mtm.sessionCount = mtmSessions.length;

  if (mtmSessions.length >= CONFIG.MTM_WARN_THRESHOLD) {
    result.mtm.warnings.push(
      `MTM is approaching limit: ${mtmSessions.length}/${CONFIG.MTM_MAX_SESSIONS} sessions`
    );
    result.overall = 'warning';
  }

  // Check LTM
  const ltmDir = getTierPath('LTM', projectRoot);
  if (fs.existsSync(ltmDir)) {
    const ltmFiles = fs.readdirSync(ltmDir).filter(f => f.endsWith('.json'));
    result.ltm.summaryCount = ltmFiles.length;
  }

  return result;
}

// ============================================================================
// CLI Interface
// ============================================================================

if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'health':
      console.log(JSON.stringify(getTierHealth(), null, 2));
      break;

    case 'consolidate':
      const sessionId = args[1] || 'current';
      const result = consolidateSession(sessionId);
      console.log(JSON.stringify(result, null, 2));
      break;

    case 'summarize':
      const summaryResult = summarizeOldSessions();
      console.log(JSON.stringify(summaryResult, null, 2));
      break;

    case 'promote':
      if (!args[1]) {
        console.error('Usage: memory-tiers.cjs promote <session-id>');
        process.exit(1);
      }
      const promoteResult = promoteToLTM(args[1]);
      console.log(JSON.stringify(promoteResult, null, 2));
      break;

    case 'mtm-list':
      const sessions = getMTMSessions();
      console.log(
        JSON.stringify(
          sessions.map(s => ({
            session_id: s.session_id,
            timestamp: s.timestamp,
            summary: s.summary,
          })),
          null,
          2
        )
      );
      break;

    default:
      console.log(`
Memory Tiers - STM/MTM/LTM Implementation

Commands:
  health          Check health of all memory tiers
  consolidate     Consolidate current session from STM to MTM
  summarize       Summarize old MTM sessions to LTM
  promote <id>    Promote a session from MTM to LTM
  mtm-list        List all sessions in MTM

Examples:
  node memory-tiers.cjs health
  node memory-tiers.cjs consolidate
  node memory-tiers.cjs summarize
  node memory-tiers.cjs promote session-001
  node memory-tiers.cjs mtm-list
`);
  }
}

module.exports = {
  MEMORY_TIERS,
  CONFIG,
  getMemoryDir,
  getTierPath,
  // STM
  writeSTMEntry,
  readSTMEntry,
  clearSTM,
  // MTM
  getMTMSessions,
  consolidateSession,
  findMTMSession,
  // LTM
  promoteToLTM,
  generateSessionSummary,
  summarizeOldSessions,
  // Health
  getTierHealth,
};
