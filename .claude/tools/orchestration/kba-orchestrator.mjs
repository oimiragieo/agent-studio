#!/usr/bin/env node
/**
 * Knowledge Base-Aware (KBA) Orchestrator
 * Implements dynamic, privacy-preserving agent routing based on agent knowledge bases
 * Based on: https://arxiv.org/html/2509.19599v1
 *
 * Key Features:
 * - Semantic cache lookup for similar queries
 * - Confidence-based initial routing
 * - Dynamic knowledge probing when confidence is low
 * - Privacy-preserving ACK signals from agents
 * - Cache population and invalidation
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { resolveRuntimePath } from '../context-path-resolver.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CACHE_DIR = resolveRuntimePath('orchestration/orchestration-cache', { read: false });
const CACHE_FILE = join(CACHE_DIR, 'semantic-cache.json');
const CONFIDENCE_THRESHOLD = 0.7; // Threshold for triggering dynamic probing

/**
 * Initialize semantic cache
 */
async function initializeCache() {
  await mkdir(CACHE_DIR, { recursive: true });

  if (!existsSync(CACHE_FILE)) {
    await writeFile(
      CACHE_FILE,
      JSON.stringify({
        entries: [],
        metadata: {
          created_at: new Date().toISOString(),
          version: '1.0.0',
        },
      }),
      'utf8'
    );
  }
}

/**
 * Load semantic cache
 */
async function loadCache() {
  await initializeCache();
  const content = await readFile(CACHE_FILE, 'utf8');
  return JSON.parse(content);
}

/**
 * Save semantic cache
 */
async function saveCache(cache) {
  cache.metadata.updated_at = new Date().toISOString();
  await writeFile(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
}

/**
 * Calculate semantic similarity between two queries
 * Simplified version - in production, use proper embeddings
 */
function calculateSimilarity(query1, query2) {
  // Simple word overlap similarity (production would use embeddings)
  const words1 = new Set(query1.toLowerCase().split(/\s+/));
  const words2 = new Set(query2.toLowerCase().split(/\s+/));

  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * Semantic cache lookup
 * Find similar queries and their routing decisions
 */
export async function semanticCacheLookup(query, threshold = 0.6) {
  const cache = await loadCache();
  const results = [];

  for (const entry of cache.entries) {
    const similarity = calculateSimilarity(query, entry.query);
    if (similarity >= threshold) {
      results.push({
        ...entry,
        similarity,
      });
    }
  }

  // Sort by similarity descending
  results.sort((a, b) => b.similarity - a.similarity);

  return results.slice(0, 5); // Return top 5 matches
}

/**
 * Confidence-based initial routing
 * Uses static agent descriptions first
 */
export async function confidenceBasedRouting(query, agentDescriptions) {
  const scores = [];

  for (const [agentName, description] of Object.entries(agentDescriptions)) {
    // Calculate relevance score based on description match
    const relevance = calculateSimilarity(query, description);
    const confidence = relevance; // Simplified - production would use more sophisticated scoring

    scores.push({
      agent: agentName,
      relevance,
      confidence,
      method: 'static_description',
    });
  }

  // Sort by confidence descending
  scores.sort((a, b) => b.confidence - a.confidence);

  const topCandidate = scores[0];

  return {
    top_agent: topCandidate.agent,
    confidence: topCandidate.confidence,
    all_scores: scores,
    needs_probing: topCandidate.confidence < CONFIDENCE_THRESHOLD,
  };
}

/**
 * Dynamic knowledge probing
 * Query agents in parallel to get relevance signals from their knowledge bases
 */
export async function dynamicKnowledgeProbing(query, agentNames, probeFunction) {
  // Probe all agents in parallel
  const probePromises = agentNames.map(async agentName => {
    try {
      // Call agent's knowledge probe function
      // This should return a lightweight ACK signal without exposing full KB
      const signal = await probeFunction(agentName, query);
      return {
        agent: agentName,
        relevance_score: signal.relevance_score,
        confidence: signal.confidence,
        has_knowledge: signal.has_knowledge,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        agent: agentName,
        relevance_score: 0,
        confidence: 0,
        has_knowledge: false,
        error: error.message,
      };
    }
  });

  const results = await Promise.all(probePromises);

  // Sort by relevance score descending
  results.sort((a, b) => b.relevance_score - a.relevance_score);

  return results;
}

/**
 * Agent knowledge probe function template
 * Agents should implement this to return lightweight relevance signals
 */
export async function probeAgentKnowledge(agentName, query) {
  // In production, this would:
  // 1. Load agent's knowledge base (from .claude/context/knowledge-bases/<agent>.json)
  // 2. Check query relevance against KB without exposing full content
  // 3. Return lightweight ACK signal

  // For now, return placeholder
  return {
    relevance_score: 0.5,
    confidence: 0.5,
    has_knowledge: false,
    signal_type: 'ack', // Privacy-preserving acknowledgment
  };
}

/**
 * Cache population
 * Store routing decision in semantic cache
 */
export async function populateCache(query, routingDecision, agentScores) {
  const cache = await loadCache();

  const entry = {
    query,
    routed_to: routingDecision.selected_agent,
    confidence: routingDecision.confidence,
    method: routingDecision.method, // 'static', 'probed', 'cached'
    agent_scores: agentScores,
    timestamp: new Date().toISOString(),
    query_hash: hashQuery(query), // For deduplication
  };

  cache.entries.push(entry);

  // Limit cache size (keep last 1000 entries)
  if (cache.entries.length > 1000) {
    cache.entries = cache.entries.slice(-1000);
  }

  await saveCache(cache);
}

/**
 * Cache invalidation
 * Invalidate entries when agent knowledge bases change
 */
export async function invalidateCache(agentName = null, invalidationReason = 'knowledge_update') {
  const cache = await loadCache();

  if (agentName) {
    // Invalidate entries for specific agent
    cache.entries = cache.entries.filter(entry => {
      // Invalidate if this agent was involved
      const agentInvolved =
        entry.routed_to === agentName ||
        (entry.agent_scores && entry.agent_scores.some(s => s.agent === agentName));

      if (agentInvolved) {
        entry.invalidated = true;
        entry.invalidation_reason = invalidationReason;
        entry.invalidated_at = new Date().toISOString();
        return false; // Remove from active cache
      }
      return true;
    });
  } else {
    // Invalidate all entries
    cache.entries.forEach(entry => {
      entry.invalidated = true;
      entry.invalidation_reason = invalidationReason;
      entry.invalidated_at = new Date().toISOString();
    });
    cache.entries = [];
  }

  await saveCache(cache);
}

/**
 * Hash query for deduplication
 */
function hashQuery(query) {
  // Simple hash - production would use proper hashing
  return Buffer.from(query).toString('base64').substring(0, 32);
}

/**
 * Main KBA orchestration function
 */
export async function kbaOrchestrate(query, agentDescriptions, probeFunction = null) {
  // Step 1: Semantic cache lookup
  const cacheResults = await semanticCacheLookup(query, 0.6);

  if (cacheResults.length > 0 && cacheResults[0].similarity > 0.8) {
    // High similarity found in cache - use cached routing
    return {
      selected_agent: cacheResults[0].routed_to,
      confidence: cacheResults[0].confidence,
      method: 'cached',
      cache_hit: true,
      similarity: cacheResults[0].similarity,
    };
  }

  // Step 2: Confidence-based initial routing
  const routingResult = await confidenceBasedRouting(query, agentDescriptions);

  if (!routingResult.needs_probing && routingResult.confidence >= CONFIDENCE_THRESHOLD) {
    // High confidence from static description - use it
    await populateCache(
      query,
      {
        selected_agent: routingResult.top_agent,
        confidence: routingResult.confidence,
        method: 'static',
      },
      routingResult.all_scores
    );

    return {
      selected_agent: routingResult.top_agent,
      confidence: routingResult.confidence,
      method: 'static',
      cache_hit: false,
    };
  }

  // Step 3: Dynamic knowledge probing (low confidence)
  const topCandidates = routingResult.all_scores.slice(0, 3).map(s => s.agent);
  const probeFunctionToUse = probeFunction || probeAgentKnowledge;
  const probeResults = await dynamicKnowledgeProbing(query, topCandidates, probeFunctionToUse);

  // Step 4: Combine static and probed scores
  const combinedScores = routingResult.all_scores.map(staticScore => {
    const probed = probeResults.find(p => p.agent === staticScore.agent);
    if (probed) {
      // Weighted combination: 40% static, 60% probed
      return {
        agent: staticScore.agent,
        relevance: staticScore.relevance * 0.4 + probed.relevance_score * 0.6,
        confidence: staticScore.confidence * 0.4 + probed.confidence * 0.6,
        has_knowledge: probed.has_knowledge,
        method: 'probed',
      };
    }
    return {
      ...staticScore,
      method: 'static',
    };
  });

  combinedScores.sort((a, b) => b.relevance - a.relevance);
  const selectedAgent = combinedScores[0];

  // Step 5: Populate cache
  await populateCache(
    query,
    {
      selected_agent: selectedAgent.agent,
      confidence: selectedAgent.confidence,
      method: 'probed',
    },
    combinedScores
  );

  return {
    selected_agent: selectedAgent.agent,
    confidence: selectedAgent.confidence,
    method: 'probed',
    cache_hit: false,
    probe_results: probeResults,
    combined_scores: combinedScores,
  };
}

export default {
  kbaOrchestrate,
  semanticCacheLookup,
  confidenceBasedRouting,
  dynamicKnowledgeProbing,
  populateCache,
  invalidateCache,
};
