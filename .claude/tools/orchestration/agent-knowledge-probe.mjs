#!/usr/bin/env node
/**
 * Agent Knowledge Probe
 * Allows agents to provide lightweight relevance signals from their knowledge bases
 * Privacy-preserving: returns ACK signals without exposing full KB content
 * Based on: https://arxiv.org/html/2509.19599v1
 */

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const KB_DIR = join(__dirname, '../../../context/knowledge-bases');

/**
 * Load agent knowledge base
 */
async function loadAgentKB(agentName) {
  const kbPath = join(KB_DIR, `${agentName}.json`);
  
  if (!existsSync(kbPath)) {
    return null;
  }
  
  try {
    const content = await readFile(kbPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

/**
 * Calculate relevance score for query against agent's KB
 * Privacy-preserving: only returns score, not KB content
 */
function calculateKBRelevance(query, knowledgeBase) {
  if (!knowledgeBase || !knowledgeBase.entries) {
    return {
      relevance_score: 0,
      confidence: 0,
      has_knowledge: false
    };
  }
  
  // Extract keywords from query
  const queryKeywords = extractKeywords(query);
  
  // Check relevance against KB entries (without exposing content)
  let totalRelevance = 0;
  let matchingEntries = 0;
  
  for (const entry of knowledgeBase.entries) {
    const entryKeywords = entry.keywords || [];
    const entryTopics = entry.topics || [];
    
    // Calculate keyword overlap
    const keywordOverlap = queryKeywords.filter(k => 
      entryKeywords.some(ek => ek.toLowerCase() === k.toLowerCase())
    ).length;
    
    // Calculate topic relevance
    const topicRelevance = entryTopics.some(topic => 
      query.toLowerCase().includes(topic.toLowerCase())
    ) ? 0.5 : 0;
    
    const entryRelevance = (keywordOverlap / Math.max(queryKeywords.length, 1)) + topicRelevance;
    
    if (entryRelevance > 0.2) {
      totalRelevance += entryRelevance;
      matchingEntries++;
    }
  }
  
  const avgRelevance = matchingEntries > 0 ? totalRelevance / matchingEntries : 0;
  const confidence = Math.min(avgRelevance, 1.0);
  
  return {
    relevance_score: avgRelevance,
    confidence: confidence,
    has_knowledge: matchingEntries > 0,
    matching_entries_count: matchingEntries, // Lightweight metadata
    total_entries: knowledgeBase.entries.length // Lightweight metadata
  };
}

/**
 * Extract keywords from query
 */
function extractKeywords(query) {
  // Simple keyword extraction (production would use NLP)
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
  const words = query.toLowerCase().split(/\s+/);
  return words.filter(w => w.length > 3 && !stopWords.has(w));
}

/**
 * Probe agent's knowledge base for query relevance
 * Returns privacy-preserving ACK signal
 */
export async function probeAgentKB(agentName, query) {
  const knowledgeBase = await loadAgentKB(agentName);
  
  if (!knowledgeBase) {
    // No KB available - return neutral signal
    return {
      agent: agentName,
      relevance_score: 0,
      confidence: 0,
      has_knowledge: false,
      signal_type: 'ack',
      timestamp: new Date().toISOString()
    };
  }
  
  const relevance = calculateKBRelevance(query, knowledgeBase);
  
  return {
    agent: agentName,
    relevance_score: relevance.relevance_score,
    confidence: relevance.confidence,
    has_knowledge: relevance.has_knowledge,
    signal_type: 'ack', // Privacy-preserving acknowledgment
    metadata: {
      matching_entries: relevance.matching_entries_count,
      total_entries: relevance.total_entries
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Initialize agent knowledge base structure
 */
export async function initializeAgentKB(agentName, initialEntries = []) {
  const kbPath = join(KB_DIR, `${agentName}.json`);
  
  const kb = {
    agent: agentName,
    entries: initialEntries,
    metadata: {
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: '1.0.0'
    }
  };
  
  // In production, would save to file
  return kb;
}

/**
 * Update agent knowledge base
 * Triggers cache invalidation for this agent
 */
export async function updateAgentKB(agentName, newEntries) {
  const kb = await loadAgentKB(agentName) || await initializeAgentKB(agentName);
  
  kb.entries = [...kb.entries, ...newEntries];
  kb.metadata.updated_at = new Date().toISOString();
  
  // Trigger cache invalidation
  const { invalidateCache } = await import('./kba-orchestrator.mjs');
  await invalidateCache(agentName, 'knowledge_base_updated');
  
  return kb;
}

export default {
  probeAgentKB,
  initializeAgentKB,
  updateAgentKB
};

