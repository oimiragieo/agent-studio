#!/usr/bin/env node
/**
 * Knowledge Base Manager
 * Helps agents maintain and update their knowledge bases for KBA orchestration
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const KB_DIR = join(__dirname, '../../../context/knowledge-bases');

/**
 * Add knowledge entry to agent's KB
 */
export async function addKnowledgeEntry(agentName, entry) {
  const kbPath = join(KB_DIR, `${agentName}.json`);
  await mkdir(KB_DIR, { recursive: true });
  
  let kb = {
    agent: agentName,
    entries: [],
    metadata: {
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  };
  
  if (existsSync(kbPath)) {
    const content = await readFile(kbPath, 'utf8');
    kb = JSON.parse(content);
  }
  
  // Add entry with keywords and topics extracted
  const entryWithMetadata = {
    ...entry,
    keywords: entry.keywords || extractKeywords(entry.content || entry.description || ''),
    topics: entry.topics || [],
    added_at: new Date().toISOString()
  };
  
  kb.entries.push(entryWithMetadata);
  kb.metadata.updated_at = new Date().toISOString();
  
  await writeFile(kbPath, JSON.stringify(kb, null, 2), 'utf8');
  
  // Trigger cache invalidation
  const { invalidateCache } = await import('./kba-orchestrator.mjs');
  await invalidateCache(agentName, 'knowledge_entry_added');
  
  return entryWithMetadata;
}

/**
 * Extract keywords from text
 */
function extractKeywords(text) {
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can']);
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w));
  
  // Return unique keywords, limit to top 10
  return [...new Set(words)].slice(0, 10);
}

/**
 * Get agent's knowledge base
 */
export async function getAgentKB(agentName) {
  const kbPath = join(KB_DIR, `${agentName}.json`);
  
  if (!existsSync(kbPath)) {
    return null;
  }
  
  const content = await readFile(kbPath, 'utf8');
  return JSON.parse(content);
}

/**
 * Update knowledge entry
 */
export async function updateKnowledgeEntry(agentName, entryId, updates) {
  const kb = await getAgentKB(agentName);
  
  if (!kb) {
    throw new Error(`Knowledge base not found for agent: ${agentName}`);
  }
  
  const entryIndex = kb.entries.findIndex(e => e.id === entryId);
  if (entryIndex === -1) {
    throw new Error(`Entry not found: ${entryId}`);
  }
  
  kb.entries[entryIndex] = {
    ...kb.entries[entryIndex],
    ...updates,
    updated_at: new Date().toISOString()
  };
  
  kb.metadata.updated_at = new Date().toISOString();
  
  const kbPath = join(KB_DIR, `${agentName}.json`);
  await writeFile(kbPath, JSON.stringify(kb, null, 2), 'utf8');
  
  // Trigger cache invalidation
  const { invalidateCache } = await import('./kba-orchestrator.mjs');
  await invalidateCache(agentName, 'knowledge_entry_updated');
  
  return kb.entries[entryIndex];
}

export default {
  addKnowledgeEntry,
  getAgentKB,
  updateKnowledgeEntry
};

