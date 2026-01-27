#!/usr/bin/env node
/**
 * Learnings Parser - Structured Entry Extraction
 * ==============================================
 *
 * Parses learnings.md into structured entries with importance extraction.
 * Supports semantic importance-based archival for memory management.
 *
 * Entry format in learnings.md:
 * ```markdown
 * ## [CATEGORY] Description Title
 * **Date**: YYYY-MM-DD
 * **Importance**: CRITICAL|HIGH|MEDIUM|LOW
 * Content body here...
 *
 * ---
 * ```
 *
 * Importance levels (from highest to lowest):
 * - CRITICAL: Must never be archived (security fixes, iron laws)
 * - HIGH: Keep indefinitely (key patterns, important decisions)
 * - MEDIUM: Keep for 30 days
 * - LOW: Archive when space needed
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ============================================================================
// Constants
// ============================================================================

/**
 * Valid importance levels in order of priority (highest first)
 */
const IMPORTANCE_LEVELS = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

/**
 * Default importance when not specified
 */
const DEFAULT_IMPORTANCE = 'LOW';

/**
 * Entry separator pattern (markdown horizontal rule)
 */
const ENTRY_SEPARATOR = /\n---+\n/;

/**
 * Header pattern: ## [CATEGORY] Title OR ### Title (Date)
 */
const HEADER_PATTERN = /^##\s*\[([^\]]+)\]\s*(.+)$/m;

/**
 * Alternative header pattern: ### Title (YYYY-MM-DD) - actual format in learnings.md
 */
const ALT_HEADER_PATTERN = /^###\s+(.+?)(?:\s+\((\d{4}-\d{2}-\d{2})\))?$/m;

/**
 * Date pattern: **Date**: YYYY-MM-DD
 */
const DATE_PATTERN = /\*\*Date\*\*:\s*(\d{4}-\d{2}-\d{2})/;

/**
 * Alternative date pattern: (YYYY-MM-DD) in header
 */
const ALT_DATE_PATTERN = /\((\d{4}-\d{2}-\d{2})\)/;

/**
 * Importance pattern: **Importance**: LEVEL
 */
const IMPORTANCE_PATTERN = /\*\*Importance\*\*:\s*(CRITICAL|HIGH|MEDIUM|LOW)/i;

/**
 * Keyword-based importance inference patterns
 *
 * TITLE_KEYWORDS: Strong indicators when found in title (primary check)
 * BODY_KEYWORDS: Weak indicators only used as fallback (secondary check)
 *
 * This two-tier approach prevents over-classification where security-related
 * content in the body would otherwise mark everything as CRITICAL/HIGH.
 */
const TITLE_KEYWORDS = {
  CRITICAL: [
    /\bCRITICAL\b/i,
    /\bIron Law\b/i,
    /\bSecurity\s+Fix\b/i,
    /\bSecurity\s+Vulnerability\b/i,
    /\bFail[\s-]?Closed\b/i,
    /\bMUST\s+(NEVER|ALWAYS)\b/i,
  ],
  HIGH: [/\bIMPORTANT\b/i, /\bSecurity\b/i, /\bSEC-\d+/i, /\bKey\s+(Finding|Pattern|Insight)\b/i],
  MEDIUM: [/\bPattern\b/i, /\bFix\b/i, /\bBug\b/i, /\bIntegration\b/i, /\bImplementation\b/i],
};

/**
 * Body keywords - only checked if title doesn't determine importance
 * These are weaker signals that only bump importance one level
 */
const BODY_KEYWORDS = {
  HIGH: [
    /\bMUST\s+(NEVER|ALWAYS)\b/i, // Strong mandate in body -> HIGH (not CRITICAL)
    /\bIron Law\b/i,
  ],
  MEDIUM: [/\bpattern\b/i, /\blearned\b/i, /\bimplemented\b/i],
};

// Keep backward compatibility alias
const IMPORTANCE_KEYWORDS = TITLE_KEYWORDS;

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Parse learnings.md content into structured entries
 *
 * @param {string} content - Raw markdown content
 * @returns {Array<Object>} Array of parsed entries
 */
function parseEntries(content) {
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return [];
  }

  // Split by entry separator
  const rawEntries = content.split(ENTRY_SEPARATOR).filter(e => e.trim().length > 0);

  const entries = [];

  for (const raw of rawEntries) {
    const entry = parseEntry(raw);
    if (entry) {
      entries.push(entry);
    }
  }

  return entries;
}

/**
 * Parse a single entry block
 *
 * @param {string} raw - Raw entry text
 * @returns {Object|null} Parsed entry or null if invalid
 */
function parseEntry(raw) {
  if (!raw || raw.trim().length === 0) {
    return null;
  }

  const trimmed = raw.trim();

  // Try standard header format: ## [CATEGORY] Title
  let headerMatch = trimmed.match(HEADER_PATTERN);
  let category = 'UNKNOWN';
  let title = 'Untitled';
  let date = null;

  if (headerMatch) {
    category = headerMatch[1].trim();
    title = headerMatch[2].trim();
  } else {
    // Try alternative header format: ### Title (YYYY-MM-DD)
    const altHeaderMatch = trimmed.match(ALT_HEADER_PATTERN);
    if (altHeaderMatch) {
      title = altHeaderMatch[1].trim();
      // Remove date from title if present
      title = title.replace(/\s*\(\d{4}-\d{2}-\d{2}\)\s*$/, '').trim();

      // Extract date from header
      if (altHeaderMatch[2]) {
        date = altHeaderMatch[2];
      }

      // Infer category from title keywords
      category = inferCategory(title);
    }
  }

  // Extract date from **Date**: line if not already found
  if (!date) {
    const dateMatch = trimmed.match(DATE_PATTERN);
    date = dateMatch ? dateMatch[1] : null;
  }

  // Try alternative date pattern in header if still no date
  if (!date) {
    const altDateMatch = trimmed.match(ALT_DATE_PATTERN);
    date = altDateMatch ? altDateMatch[1] : null;
  }

  // Extract importance (explicit or inferred)
  const importance = extractImportance(trimmed);

  // Extract content (everything after the metadata lines)
  const content = extractContent(trimmed);

  return {
    category,
    title,
    date,
    importance,
    content,
    rawText: trimmed,
  };
}

/**
 * Infer category from title keywords
 *
 * @param {string} title - Entry title
 * @returns {string} Inferred category
 */
function inferCategory(title) {
  if (!title) return 'UNKNOWN';

  const lowerTitle = title.toLowerCase();

  if (lowerTitle.includes('security') || lowerTitle.includes('sec-')) {
    return 'SECURITY';
  }
  if (lowerTitle.includes('pattern')) {
    return 'PATTERN';
  }
  if (lowerTitle.includes('bug') || lowerTitle.includes('fix')) {
    return 'BUG-FIX';
  }
  if (lowerTitle.includes('performance') || lowerTitle.includes('optimization')) {
    return 'PERFORMANCE';
  }
  if (lowerTitle.includes('documentation') || lowerTitle.includes('doc')) {
    return 'DOCUMENTATION';
  }
  if (lowerTitle.includes('test')) {
    return 'TESTING';
  }
  if (lowerTitle.includes('insight') || lowerTitle.includes('analysis')) {
    return 'ANALYSIS';
  }
  if (lowerTitle.includes('implementation') || lowerTitle.includes('implemented')) {
    return 'IMPLEMENTATION';
  }

  return 'NOTE';
}

/**
 * Extract importance level from entry text
 *
 * Priority:
 * 1. Explicit **Importance**: marker (highest priority)
 * 2. Title keywords (TITLE_KEYWORDS) - strong indicators
 * 3. Body keywords (BODY_KEYWORDS) - weak indicators, lower level
 * 4. Default to LOW
 *
 * @param {string} text - Entry text
 * @param {string} title - Optional title for title-specific checking
 * @returns {string} Importance level (CRITICAL, HIGH, MEDIUM, LOW)
 */
function extractImportance(text, title = null) {
  if (!text) return DEFAULT_IMPORTANCE;

  // First, check for explicit importance marker
  const match = text.match(IMPORTANCE_PATTERN);
  if (match) {
    return match[1].toUpperCase();
  }

  // Extract title from text if not provided
  let titleToCheck = title;
  if (!titleToCheck) {
    const headerMatch = text.match(HEADER_PATTERN);
    if (headerMatch) {
      titleToCheck = headerMatch[2];
    } else {
      const altHeaderMatch = text.match(ALT_HEADER_PATTERN);
      if (altHeaderMatch) {
        titleToCheck = altHeaderMatch[1];
      }
    }
  }

  // Check title keywords first (strong indicators)
  if (titleToCheck) {
    for (const level of ['CRITICAL', 'HIGH', 'MEDIUM']) {
      const patterns = TITLE_KEYWORDS[level];
      if (patterns) {
        for (const pattern of patterns) {
          if (pattern.test(titleToCheck)) {
            return level;
          }
        }
      }
    }
  }

  // Check body keywords (weak indicators - one level lower)
  for (const level of ['HIGH', 'MEDIUM']) {
    const patterns = BODY_KEYWORDS[level];
    if (patterns) {
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          return level;
        }
      }
    }
  }

  return DEFAULT_IMPORTANCE;
}

/**
 * Extract content body from entry (excluding metadata lines)
 *
 * @param {string} text - Raw entry text
 * @returns {string} Content body
 */
function extractContent(text) {
  if (!text) return '';

  const lines = text.split('\n');
  const contentLines = [];
  let inMetadata = true;

  for (const line of lines) {
    // Skip header lines (both ## and ### formats)
    if (HEADER_PATTERN.test(line) || ALT_HEADER_PATTERN.test(line)) {
      continue;
    }

    // Skip date line
    if (DATE_PATTERN.test(line)) {
      continue;
    }

    // Skip importance line
    if (IMPORTANCE_PATTERN.test(line)) {
      continue;
    }

    // Skip empty lines at the beginning
    if (inMetadata && line.trim().length === 0) {
      continue;
    }

    // We've hit content
    inMetadata = false;
    contentLines.push(line);
  }

  return contentLines.join('\n').trim();
}

// ============================================================================
// Grouping and Filtering
// ============================================================================

/**
 * Group entries by importance level
 *
 * @param {Array<Object>} entries - Parsed entries
 * @returns {Object} Entries grouped by importance { CRITICAL: [...], HIGH: [...], ... }
 */
function groupByImportance(entries) {
  const groups = {
    CRITICAL: [],
    HIGH: [],
    MEDIUM: [],
    LOW: [],
  };

  for (const entry of entries) {
    const level = entry.importance || DEFAULT_IMPORTANCE;
    if (groups[level]) {
      groups[level].push(entry);
    } else {
      groups.LOW.push(entry);
    }
  }

  return groups;
}

/**
 * Filter entries by importance levels
 *
 * @param {Array<Object>} entries - Parsed entries
 * @param {Array<string>} levels - Importance levels to keep
 * @returns {Array<Object>} Filtered entries
 */
function filterByImportance(entries, levels) {
  if (!levels || levels.length === 0) {
    return entries;
  }

  const normalizedLevels = levels.map(l => l.toUpperCase());
  return entries.filter(e => normalizedLevels.includes(e.importance));
}

/**
 * Filter entries by age (keep entries newer than maxAgeDays)
 *
 * @param {Array<Object>} entries - Parsed entries
 * @param {number} maxAgeDays - Maximum age in days
 * @param {Date} referenceDate - Reference date (defaults to now)
 * @returns {Array<Object>} Entries within age limit
 */
function filterByAge(entries, maxAgeDays, referenceDate = new Date()) {
  if (!maxAgeDays || maxAgeDays <= 0) {
    return entries;
  }

  const cutoffDate = new Date(referenceDate);
  cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

  return entries.filter(entry => {
    if (!entry.date) {
      // Keep entries without dates (they're recent enough to not have been archived)
      return true;
    }

    const entryDate = new Date(entry.date);
    return entryDate >= cutoffDate;
  });
}

// ============================================================================
// Size Calculation
// ============================================================================

/**
 * Calculate character count for a single entry
 *
 * @param {Object} entry - Parsed entry
 * @returns {number} Character count
 */
function getEntrySize(entry) {
  if (!entry) return 0;

  // Use rawText if available, otherwise reconstruct
  if (entry.rawText) {
    return entry.rawText.length;
  }

  // Estimate from components
  return (
    (entry.category || '').length +
    (entry.title || '').length +
    (entry.date || '').length +
    (entry.importance || '').length +
    (entry.content || '').length +
    50 // Overhead for markdown formatting
  );
}

/**
 * Calculate total size of all entries
 *
 * @param {Array<Object>} entries - Parsed entries
 * @returns {number} Total character count
 */
function getTotalSize(entries) {
  if (!entries || entries.length === 0) return 0;

  return entries.reduce((total, entry) => total + getEntrySize(entry), 0);
}

// ============================================================================
// Serialization (Back to Markdown)
// ============================================================================

/**
 * Convert a single entry back to markdown format
 *
 * @param {Object} entry - Parsed entry
 * @returns {string} Markdown formatted entry
 */
function serializeEntry(entry) {
  if (!entry) return '';

  const lines = [];

  // Header
  lines.push(`## [${entry.category || 'UNKNOWN'}] ${entry.title || 'Untitled'}`);

  // Date
  if (entry.date) {
    lines.push(`**Date**: ${entry.date}`);
  }

  // Importance
  lines.push(`**Importance**: ${entry.importance || DEFAULT_IMPORTANCE}`);

  // Content (with blank line before)
  if (entry.content) {
    lines.push('');
    lines.push(entry.content);
  }

  return lines.join('\n');
}

/**
 * Convert array of entries back to full markdown file
 *
 * @param {Array<Object>} entries - Parsed entries
 * @returns {string} Full markdown content
 */
function serializeEntries(entries) {
  if (!entries || entries.length === 0) return '';

  return entries.map(serializeEntry).join('\n\n---\n\n') + '\n';
}

// ============================================================================
// File Operations
// ============================================================================

/**
 * Parse entries from a file path
 *
 * @param {string} filePath - Path to learnings.md
 * @returns {Array<Object>} Parsed entries (empty array if file not found)
 */
function parseEntriesFromFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return [];
    }

    const content = fs.readFileSync(filePath, 'utf8');
    return parseEntries(content);
  } catch (err) {
    // Return empty array on any read error
    return [];
  }
}

/**
 * Write entries to a file
 *
 * @param {string} filePath - Path to write
 * @param {Array<Object>} entries - Entries to write
 */
function writeEntriesToFile(filePath, entries) {
  const content = serializeEntries(entries);
  fs.writeFileSync(filePath, content, 'utf8');
}

// ============================================================================
// CLI Interface
// ============================================================================

if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'parse': {
      const filePath = args[1];
      if (!filePath) {
        console.error('Usage: learnings-parser.cjs parse <file.md>');
        process.exit(1);
      }

      const entries = parseEntriesFromFile(filePath);
      console.log(JSON.stringify(entries, null, 2));
      break;
    }

    case 'group': {
      const filePath = args[1];
      if (!filePath) {
        console.error('Usage: learnings-parser.cjs group <file.md>');
        process.exit(1);
      }

      const entries = parseEntriesFromFile(filePath);
      const grouped = groupByImportance(entries);

      console.log('Entries by importance:');
      for (const level of IMPORTANCE_LEVELS) {
        console.log(`  ${level}: ${grouped[level].length} entries`);
      }
      break;
    }

    case 'filter': {
      const filePath = args[1];
      const levels = args.slice(2);

      if (!filePath || levels.length === 0) {
        console.error('Usage: learnings-parser.cjs filter <file.md> CRITICAL HIGH ...');
        process.exit(1);
      }

      const entries = parseEntriesFromFile(filePath);
      const filtered = filterByImportance(entries, levels);

      console.log(`Filtered to ${filtered.length} entries (from ${entries.length})`);
      console.log(serializeEntries(filtered));
      break;
    }

    case 'stats': {
      const filePath = args[1];
      if (!filePath) {
        console.error('Usage: learnings-parser.cjs stats <file.md>');
        process.exit(1);
      }

      const entries = parseEntriesFromFile(filePath);
      const grouped = groupByImportance(entries);
      const totalSize = getTotalSize(entries);

      console.log('Learnings Statistics:');
      console.log(`  Total entries: ${entries.length}`);
      console.log(`  Total size: ${(totalSize / 1024).toFixed(2)} KB`);
      console.log('  By importance:');
      for (const level of IMPORTANCE_LEVELS) {
        const levelEntries = grouped[level];
        const levelSize = getTotalSize(levelEntries);
        console.log(
          `    ${level}: ${levelEntries.length} entries (${(levelSize / 1024).toFixed(2)} KB)`
        );
      }
      break;
    }

    default:
      console.log(`
Learnings Parser - Structured Entry Extraction

Commands:
  parse <file.md>              Parse and output entries as JSON
  group <file.md>              Show entries grouped by importance
  filter <file.md> LEVEL...    Filter entries by importance levels
  stats <file.md>              Show statistics about entries

Examples:
  node learnings-parser.cjs parse .claude/context/memory/learnings.md
  node learnings-parser.cjs group .claude/context/memory/learnings.md
  node learnings-parser.cjs filter .claude/context/memory/learnings.md CRITICAL HIGH
  node learnings-parser.cjs stats .claude/context/memory/learnings.md
`);
  }
}

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  // Constants
  IMPORTANCE_LEVELS,
  DEFAULT_IMPORTANCE,
  IMPORTANCE_KEYWORDS,
  TITLE_KEYWORDS,
  BODY_KEYWORDS,

  // Core parsing
  parseEntries,
  parseEntry,
  extractImportance,
  extractContent,
  inferCategory,

  // Grouping and filtering
  groupByImportance,
  filterByImportance,
  filterByAge,

  // Size calculation
  getEntrySize,
  getTotalSize,

  // Serialization
  serializeEntry,
  serializeEntries,

  // File operations
  parseEntriesFromFile,
  writeEntriesToFile,
};
