#!/usr/bin/env node
/**
 * Graph-Based Orchestrator
 * Combines Agent-as-a-Graph retrieval with KBA orchestration
 * Provides unified interface for graph-based agent routing
 */

import { agentAsGraphRetrieve, buildKnowledgeGraph } from './agent-as-graph.mjs';
import { kbaOrchestrate } from './kba-orchestrator.mjs';
import { probeAgentKB } from './agent-knowledge-probe.mjs';

/**
 * Unified graph + KBA orchestration
 */
export async function graphOrchestrate(query, options = {}) {
  const {
    use_graph = true,
    use_kba = true,
    graph_weight = 0.5,
    kba_weight = 0.5,
    top_k = 5
  } = options;
  
  const results = {
    query,
    graph_results: null,
    kba_results: null,
    combined_results: []
  };
  
  // Step 1: Agent-as-a-Graph retrieval
  if (use_graph) {
    results.graph_results = await agentAsGraphRetrieve(query, top_k);
  }
  
  // Step 2: KBA orchestration
  if (use_kba) {
    // Get agent descriptions for KBA
    const agentDescriptions = await getAgentDescriptions();
    results.kba_results = await kbaOrchestrate(query, agentDescriptions, probeAgentKB);
  }
  
  // Step 3: Combine results
  if (use_graph && use_kba) {
    results.combined_results = combineGraphAndKBAResults(
      results.graph_results,
      results.kba_results,
      graph_weight,
      kba_weight
    );
  } else if (use_graph) {
    results.combined_results = results.graph_results.agents.map(a => ({
      agent: a.agent,
      score: a.score,
      method: 'graph_only',
      match_type: a.match_type
    }));
  } else if (use_kba) {
    results.combined_results = [{
      agent: results.kba_results.selected_agent,
      score: results.kba_results.confidence,
      method: 'kba_only'
    }];
  }
  
  // Sort by combined score
  results.combined_results.sort((a, b) => b.score - a.score);
  
  return {
    selected_agent: results.combined_results[0]?.agent,
    confidence: results.combined_results[0]?.score || 0,
    method: 'graph_kba_combined',
    all_candidates: results.combined_results,
    graph_stats: results.graph_results?.retrieval_stats,
    kba_method: results.kba_results?.method
  };
}

/**
 * Combine graph and KBA results
 */
function combineGraphAndKBAResults(graphResults, kbaResults, graphWeight, kbaWeight) {
  const combined = new Map();
  
  // Add graph results
  if (graphResults && graphResults.agents) {
    for (const agentResult of graphResults.agents) {
      const agentName = agentResult.agent;
      combined.set(agentName, {
        agent: agentName,
        graph_score: agentResult.score,
        kba_score: 0,
        combined_score: agentResult.score * graphWeight,
        match_type: agentResult.match_type
      });
    }
  }
  
  // Add KBA results
  if (kbaResults && kbaResults.selected_agent) {
    const agentName = kbaResults.selected_agent;
    const kbaScore = kbaResults.confidence || 0;
    
    if (combined.has(agentName)) {
      combined.get(agentName).kba_score = kbaScore;
      combined.get(agentName).combined_score += kbaScore * kbaWeight;
    } else {
      combined.set(agentName, {
        agent: agentName,
        graph_score: 0,
        kba_score: kbaScore,
        combined_score: kbaScore * kbaWeight,
        match_type: 'kba_only'
      });
    }
  }
  
  return Array.from(combined.values());
}

/**
 * Get agent descriptions for KBA
 */
async function getAgentDescriptions() {
  const { readFile } = await import('fs/promises');
  const { join, dirname } = await import('path');
  const { fileURLToPath } = await import('url');
  const yaml = await import('js-yaml');
  
  // Use __dirname-based path resolution for reliability
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const configPath = join(__dirname, '../../config.yaml');
  
  try {
    const configContent = await readFile(configPath, 'utf8');
    const config = yaml.load(configContent);
    
    const descriptions = {};
    
    for (const [agentName, agentConfig] of Object.entries(config.agent_routing || {})) {
      descriptions[agentName] = agentConfig.description || `${agentName} agent`;
    }
    
    return descriptions;
  } catch (error) {
    console.error('[GraphOrchestrator] Error loading agent descriptions:', error.message);
    return {};
  }
}

/**
 * Rebuild knowledge graph (call when agents/tools change)
 */
export async function rebuildGraph() {
  return await buildKnowledgeGraph();
}

export default {
  graphOrchestrate,
  rebuildGraph
};

