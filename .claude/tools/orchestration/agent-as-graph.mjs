#!/usr/bin/env node
/**
 * Agent-as-a-Graph Retrieval
 * Knowledge graph-based tool and agent retrieval for improved routing
 * Based on: https://arxiv.org/html/2511.18194v1
 *
 * Key Features:
 * - Bipartite knowledge graph (agents and tools as nodes)
 * - Joint vector search over agents and tools
 * - Type-specific weighted reciprocal rank fusion (wRRF)
 * - Graph traversal to find parent agents from tool matches
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import yaml from 'js-yaml';
import { getAllTools, getTool } from '../native/registry.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const GRAPH_DIR = join(__dirname, '../../../context/knowledge-graph');
const GRAPH_FILE = join(GRAPH_DIR, 'agent-tool-graph.json');
const VECTOR_INDEX_FILE = join(GRAPH_DIR, 'vector-index.json');

// Type-specific weights (optimal from paper: α_A=1.5, α_T=1.0)
const AGENT_WEIGHT = 1.5;
const TOOL_WEIGHT = 1.0;
const RRF_K = 60; // Reciprocal rank fusion parameter

/**
 * Node types in the knowledge graph
 */
const NodeType = {
  AGENT: 'agent',
  TOOL: 'tool',
  MCP_SERVER: 'mcp_server',
};

/**
 * Initialize knowledge graph
 */
async function initializeGraph() {
  await mkdir(GRAPH_DIR, { recursive: true });

  if (!existsSync(GRAPH_FILE)) {
    const graph = {
      nodes: [],
      edges: [],
      metadata: {
        created_at: new Date().toISOString(),
        version: '1.0.0',
      },
    };
    await writeFile(GRAPH_FILE, JSON.stringify(graph, null, 2), 'utf8');
  }
}

/**
 * Build bipartite knowledge graph from agents and tools
 */
export async function buildKnowledgeGraph() {
  try {
    await initializeGraph();

    const configPath = join(__dirname, '../../../config.yaml');
    const configContent = await readFile(configPath, 'utf8');
    const config = yaml.load(configContent);

    console.log('[Graph] Building knowledge graph from config...');

    const graph = {
      nodes: [],
      edges: [],
      metadata: {
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        version: '1.0.0',
      },
    };

    // Add agent nodes
    for (const [agentName, agentConfig] of Object.entries(config.agent_routing || {})) {
      try {
        // Get agent description with proper error handling
        let description = agentConfig.description;
        if (!description) {
          try {
            description = await getAgentDescription(agentName);
          } catch (error) {
            console.warn(
              `[Graph] Failed to load description for agent ${agentName}:`,
              error.message
            );
            description = '';
          }
        }

        const agentNode = {
          id: `agent_${agentName}`,
          type: NodeType.AGENT,
          name: agentName,
          description: description,
          metadata: {
            model: agentConfig.model,
            temperature: agentConfig.temperature,
            complexity: agentConfig.complexity,
            trigger_words: agentConfig.trigger_words || [],
          },
          embedding_text: buildAgentEmbeddingText(agentName, agentConfig),
        };

        graph.nodes.push(agentNode);

        // Add tool nodes and edges
        const allowedTools = agentConfig.allowed_tools || agentConfig.tools || [];
        for (const toolName of allowedTools) {
          try {
            // Normalize tool name (handle case variations)
            const normalizedToolName = normalizeToolName(toolName);

            // Check if tool node already exists
            let toolNode = graph.nodes.find(
              n => n.type === NodeType.TOOL && n.name === normalizedToolName
            );

            if (!toolNode) {
              // Create tool node with error handling
              let tool = null;
              try {
                tool = getTool(normalizedToolName);
              } catch (error) {
                console.warn(
                  `[Graph] Tool ${normalizedToolName} not found in registry:`,
                  error.message
                );
              }

              if (!tool) {
                try {
                  tool = await getMCPTool(normalizedToolName, config);
                } catch (error) {
                  console.warn(`[Graph] MCP tool ${normalizedToolName} not found:`, error.message);
                }
              }

              toolNode = {
                id: `tool_${normalizedToolName}`,
                type: NodeType.TOOL,
                name: normalizedToolName,
                description: tool?.description || `Tool: ${normalizedToolName}`,
                metadata: {
                  input_schema: tool?.inputSchema || {},
                  output_schema: tool?.outputSchema || {},
                },
                embedding_text: buildToolEmbeddingText(normalizedToolName, tool),
              };

              graph.nodes.push(toolNode);
            }

            // Create edge from agent to tool
            const edge = {
              id: `edge_${agentName}_${normalizedToolName}`,
              source: agentNode.id,
              target: toolNode.id,
              type: 'has_tool',
              weight: 1.0,
            };

            graph.edges.push(edge);
          } catch (error) {
            console.error(
              `[Graph] Error processing tool ${toolName} for agent ${agentName}:`,
              error.message
            );
            // Continue with next tool
          }
        }
      } catch (error) {
        console.error(`[Graph] Error processing agent ${agentName}:`, error.message);
        // Continue with next agent
      }
    }

    await writeFile(GRAPH_FILE, JSON.stringify(graph, null, 2), 'utf8');
    console.log(
      `[Graph] Knowledge graph built successfully: ${graph.nodes.length} nodes, ${graph.edges.length} edges`
    );
    return graph;
  } catch (error) {
    console.error('[Graph] Error building knowledge graph:', error.message);
    throw error;
  }
}

/**
 * Build embedding text for agent node
 */
function buildAgentEmbeddingText(agentName, agentConfig) {
  const parts = [
    agentName,
    agentConfig.description || '',
    ...(agentConfig.trigger_words || []),
    agentConfig.complexity || '',
    agentConfig.model || '',
  ];
  return parts.filter(p => p).join(' ');
}

/**
 * Build embedding text for tool node
 */
function buildToolEmbeddingText(toolName, tool) {
  const parts = [toolName, tool?.description || '', tool?.name || ''];
  return parts.filter(p => p).join(' ');
}

/**
 * Get agent description from agent file
 */
async function getAgentDescription(agentName) {
  try {
    const agentPath = join(__dirname, `../../agents/${agentName}.md`);
    if (existsSync(agentPath)) {
      const content = await readFile(agentPath, 'utf8');
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (frontmatterMatch) {
        const frontmatter = frontmatterMatch[1];
        const descMatch = frontmatter.match(/description:\s*(.+)/);
        if (descMatch) {
          return descMatch[1].trim();
        }
      }
    }
  } catch (error) {
    console.warn(`[Graph] Error loading agent description for ${agentName}:`, error.message);
  }
  return '';
}

/**
 * Normalize tool name to match registry conventions
 * Maps common variations to registry names
 */
function normalizeToolName(toolName) {
  const name = toolName.trim();

  // Tool name mapping (agent frontmatter -> registry)
  const toolNameMap = {
    read: 'text_editor',
    Read: 'text_editor',
    write: 'text_editor',
    Write: 'text_editor',
    edit: 'text_editor',
    Edit: 'text_editor',
    bash: 'bash',
    Bash: 'bash',
    web_fetch: 'web_fetch',
    WebFetch: 'web_fetch',
    'web-fetch': 'web_fetch',
    web_search: 'web_search',
    WebSearch: 'web_search',
    'web-search': 'web_search',
    code_execution: 'code_execution',
    CodeExecution: 'code_execution',
    'code-execution': 'code_execution',
    memory: 'memory',
    Memory: 'memory',
    computer_use: 'computer_use',
    ComputerUse: 'computer_use',
    'computer-use': 'computer_use',
    grep: 'grep',
    Grep: 'grep',
    glob: 'glob',
    Glob: 'glob',
    search: 'web_search',
    Search: 'web_search',
  };

  // Check mapping first
  if (toolNameMap[name]) {
    return toolNameMap[name];
  }

  // Convert to lowercase with underscores if needed
  if (name.includes('-')) {
    return name.replace(/-/g, '_').toLowerCase();
  }

  // Convert CamelCase to snake_case
  if (name !== name.toLowerCase() && name !== name.toUpperCase()) {
    return name
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '');
  }

  return name.toLowerCase();
}

/**
 * Get MCP tool information
 */
async function getMCPTool(toolName, config) {
  try {
    const normalizedName = normalizeToolName(toolName);
    const mcpTool = config.mcp_registry?.active_tools?.find(
      t => normalizeToolName(t.name) === normalizedName || t.name === toolName
    );
    return mcpTool || null;
  } catch (error) {
    console.warn(`[Graph] Error getting MCP tool ${toolName}:`, error.message);
    return null;
  }
}

/**
 * Calculate semantic similarity (simplified - production would use embeddings)
 */
function calculateSimilarity(text1, text2) {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));

  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * Vector search over graph nodes
 */
export async function vectorSearch(query, topK = 10) {
  const graph = await loadGraph();

  const scores = [];

  for (const node of graph.nodes) {
    const similarity = calculateSimilarity(query, node.embedding_text);
    scores.push({
      node,
      similarity,
      rank: 0, // Will be set after sorting
    });
  }

  // Sort by similarity descending
  scores.sort((a, b) => b.similarity - a.similarity);

  // Assign ranks
  scores.forEach((score, index) => {
    score.rank = index + 1;
  });

  return scores.slice(0, topK);
}

/**
 * Type-specific weighted Reciprocal Rank Fusion (wRRF)
 * Based on paper's Equation 3
 */
export function typeSpecificWRRF(agentScores, toolScores, k = RRF_K) {
  const combinedScores = new Map();

  // Process agent scores with agent weight
  for (const score of agentScores) {
    const nodeId = score.node.id;
    const rrfScore = AGENT_WEIGHT / (k + score.rank);

    if (!combinedScores.has(nodeId)) {
      combinedScores.set(nodeId, {
        node: score.node,
        score: 0,
        type: score.node.type,
      });
    }

    combinedScores.get(nodeId).score += rrfScore;
  }

  // Process tool scores with tool weight
  for (const score of toolScores) {
    const nodeId = score.node.id;
    const rrfScore = TOOL_WEIGHT / (k + score.rank);

    if (!combinedScores.has(nodeId)) {
      combinedScores.set(nodeId, {
        node: score.node,
        score: 0,
        type: score.node.type,
      });
    }

    combinedScores.get(nodeId).score += rrfScore;
  }

  // Convert to array and sort by score
  const results = Array.from(combinedScores.values());
  results.sort((a, b) => b.score - a.score);

  return results;
}

/**
 * Graph traversal: Find parent agents from tool nodes
 */
export async function traverseToParentAgents(toolNodeIds, graph = null) {
  if (!graph) {
    graph = await loadGraph();
  }

  const agentIds = new Set();

  for (const toolNodeId of toolNodeIds) {
    // Find edges where tool is target
    const edges = graph.edges.filter(e => e.target === toolNodeId && e.type === 'has_tool');

    for (const edge of edges) {
      // Edge source is the parent agent
      agentIds.add(edge.source);
    }
  }

  // Get agent nodes
  const agentNodes = graph.nodes.filter(n => agentIds.has(n.id));

  return agentNodes;
}

/**
 * Load knowledge graph
 */
async function loadGraph() {
  await initializeGraph();

  if (!existsSync(GRAPH_FILE)) {
    return await buildKnowledgeGraph();
  }

  const content = await readFile(GRAPH_FILE, 'utf8');
  return JSON.parse(content);
}

/**
 * Main Agent-as-a-Graph retrieval function
 */
export async function agentAsGraphRetrieve(query, topK = 5) {
  try {
    console.log(`[Graph] Retrieving agents for query: "${query.substring(0, 50)}..."`);

    // Step 1: Vector search over all nodes (agents and tools)
    const allScores = await vectorSearch(query, topK * 2);

    // Separate by type
    const agentScores = allScores.filter(s => s.node.type === NodeType.AGENT);
    const toolScores = allScores.filter(s => s.node.type === NodeType.TOOL);

    // Step 2: Type-specific weighted RRF
    const reranked = typeSpecificWRRF(agentScores, toolScores);

    // Step 3: Graph traversal for tool nodes
    const graph = await loadGraph();
    const toolNodeIds = reranked.filter(r => r.type === NodeType.TOOL).map(r => r.node.id);

    const parentAgents = await traverseToParentAgents(toolNodeIds, graph);

    // Step 4: Combine agent nodes and parent agents
    const agentNodeIds = new Set();
    const finalAgents = [];

    // Add directly matched agents
    for (const result of reranked) {
      if (result.type === NodeType.AGENT && !agentNodeIds.has(result.node.id)) {
        finalAgents.push({
          agent: result.node.name,
          score: result.score,
          match_type: 'direct_agent_match',
        });
        agentNodeIds.add(result.node.id);
      }
    }

    // Add parent agents from tool matches
    for (const agentNode of parentAgents) {
      if (!agentNodeIds.has(agentNode.id)) {
        // Find all related tools that led to this agent (not just the first)
        const relatedTools = reranked.filter(r => {
          return (
            r.type === NodeType.TOOL &&
            graph.edges.some(e => e.source === agentNode.id && e.target === r.node.id)
          );
        });

        // Use the highest scoring tool, or average if multiple
        let score = 0.5; // Default score
        let matchedTool = null;

        if (relatedTools.length > 0) {
          // Sort by score and take the highest
          relatedTools.sort((a, b) => b.score - a.score);
          score = relatedTools[0].score;
          matchedTool = relatedTools[0].node.name;

          // If multiple tools, slightly boost score (shows strong match)
          if (relatedTools.length > 1) {
            score = Math.min(score * 1.1, 1.0); // Boost by 10%, cap at 1.0
          }
        }

        finalAgents.push({
          agent: agentNode.name,
          score: score,
          match_type: 'tool_parent',
          matched_tool: matchedTool,
          matched_tools_count: relatedTools.length,
        });
        agentNodeIds.add(agentNode.id);
      }
    }

    // Sort by score
    finalAgents.sort((a, b) => b.score - a.score);

    const result = {
      agents: finalAgents.slice(0, topK),
      retrieval_stats: {
        total_nodes_searched: allScores.length,
        agent_matches: agentScores.length,
        tool_matches: toolScores.length,
        parent_agents_found: parentAgents.length,
      },
    };

    console.log(
      `[Graph] Retrieved ${result.agents.length} agents (${result.retrieval_stats.agent_matches} direct, ${result.retrieval_stats.parent_agents_found} from tools)`
    );
    return result;
  } catch (error) {
    console.error('[Graph] Error in agent retrieval:', error.message);
    throw error;
  }
}

export default {
  buildKnowledgeGraph,
  agentAsGraphRetrieve,
  vectorSearch,
  typeSpecificWRRF,
  traverseToParentAgents,
};
