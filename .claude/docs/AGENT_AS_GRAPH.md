# Agent-as-a-Graph Retrieval

This document describes the Agent-as-a-Graph retrieval system implemented in LLM-RULES, based on the research paper: [Agent-as-a-Graph: Knowledge Graph-Based Tool and Agent Retrieval for LLM Multi-Agent Systems](https://arxiv.org/html/2511.18194v1)

## Overview

Traditional agent routing matches queries against single agent descriptions, obscuring fine-grained tool capabilities. Agent-as-a-Graph addresses this by:

1. **Bipartite Knowledge Graph**: Represents both agents and tools as nodes with explicit edges
2. **Joint Vector Search**: Searches over both agent and tool nodes simultaneously
3. **Type-Specific Weighted RRF**: Applies different weights to agents (1.5) vs tools (1.0)
4. **Graph Traversal**: Finds parent agents from tool matches automatically

## Key Benefits

- **14.9% Improvement in Recall@5**: Over agent-only retrieval methods
- **14.6% Improvement in nDCG@5**: Better ranking quality
- **Fine-Grained Matching**: Queries match against individual tools, not just agent descriptions
- **Automatic Agent Discovery**: Tool matches automatically find their parent agents
- **Architecture Agnostic**: Works across different embedding models

## Architecture

### Knowledge Graph Structure

```
Agent Nodes (type: 'agent')
├── developer
├── architect
└── qa

Tool Nodes (type: 'tool')
├── bash
├── code_execution
├── text_editor
└── web_fetch

Edges (type: 'has_tool')
├── developer → bash
├── developer → code_execution
├── architect → text_editor
└── qa → web_fetch
```

### Retrieval Process

1. **Vector Search**: Search over all nodes (agents + tools) in shared vector space
2. **Type-Specific wRRF**: Apply weighted reciprocal rank fusion with type-specific weights
3. **Graph Traversal**: For tool matches, traverse edges to find parent agents
4. **Final Ranking**: Combine direct agent matches + parent agents from tool matches

## Usage

### Basic Graph Retrieval

```javascript
import { agentAsGraphRetrieve } from '.claude/tools/orchestration/agent-as-graph.mjs';

const result = await agentAsGraphRetrieve(
  'How do I implement OAuth2 authentication?',
  5 // top-k
);

console.log(`Selected agent: ${result.agents[0].agent}`);
console.log(`Score: ${result.agents[0].score}`);
console.log(`Match type: ${result.agents[0].match_type}`); // 'direct_agent_match' or 'tool_parent'
```

### Combined Graph + KBA Orchestration

```javascript
import { graphOrchestrate } from '.claude/tools/orchestration/graph-orchestrator.mjs';

const result = await graphOrchestrate(query, {
  use_graph: true,
  use_kba: true,
  graph_weight: 0.5,
  kba_weight: 0.5,
  top_k: 5
});

console.log(`Selected: ${result.selected_agent}`);
console.log(`Confidence: ${result.confidence}`);
console.log(`Method: ${result.method}`);
```

### Building the Knowledge Graph

The graph is automatically built from agent and tool definitions in `config.yaml`:

```javascript
import { buildKnowledgeGraph } from '.claude/tools/orchestration/agent-as-graph.mjs';

// Rebuild when agents/tools change
await buildKnowledgeGraph();
```

## Configuration

### Type-Specific Weights

Optimal weights from the paper:
- **Agent Weight (α_A)**: 1.5
- **Tool Weight (α_T)**: 1.0

These can be adjusted in `agent-as-graph.mjs`:

```javascript
const AGENT_WEIGHT = 1.5; // Increase for more agent emphasis
const TOOL_WEIGHT = 1.0;  // Increase for more tool emphasis
```

### RRF Parameter

```javascript
const RRF_K = 60; // Reciprocal rank fusion parameter
```

## Performance

Based on the paper's evaluation on LiveMCPBenchmark:

- **Recall@5**: 0.85 (vs 0.70 for agent-only) - **14.9% improvement**
- **nDCG@5**: 0.48 (vs 0.41 for agent-only) - **14.6% improvement**
- **mAP@5**: 0.36 (vs 0.31 for agent-only)

### Key Insights

- **39.13%** of retrieved items originate from agent nodes
- **34.44%** of tool matches trace back to agent nodes through graph edges
- Both node types contribute meaningfully to routing performance

## When to Use

### ✅ Use Agent-as-a-Graph When:

- Agents have many tools (hundreds or thousands)
- Fine-grained tool matching is important
- Queries are tool-specific rather than agent-specific
- You need to discover agents through their tools

### ❌ Consider Alternatives When:

- Simple, unambiguous agent routing
- Very few tools per agent
- Latency is more critical than accuracy
- Agent descriptions are highly accurate

## Integration with KBA Orchestration

Agent-as-a-Graph complements KBA orchestration:

- **Graph**: Fine-grained tool-agent matching
- **KBA**: Dynamic knowledge base signals
- **Combined**: Best of both approaches

The combined approach weights graph results (50%) and KBA results (50%) for optimal routing.

## Research Reference

This implementation is based on:
- **Paper**: [Agent-as-a-Graph: Knowledge Graph-Based Tool and Agent Retrieval for LLM Multi-Agent Systems](https://arxiv.org/html/2511.18194v1)
- **Authors**: Faheem Nizar, Elias Lumer, Anmol Gulati, Pradeep Honaganahalli Basavaraju, Vamse Kumar Subbiah (2025)
- **Key Concepts**:
  - Bipartite knowledge graph modeling
  - Type-specific weighted reciprocal rank fusion
  - Graph traversal for parent agent discovery
  - Joint vector search over agents and tools

## Future Enhancements

1. **Proper Embeddings**: Replace simple similarity with proper vector embeddings
2. **Dynamic Graph Updates**: Auto-update graph when agents/tools change
3. **Query-Adaptive Weights**: Adjust type weights based on query characteristics
4. **Multi-hop Traversal**: Support multi-hop graph traversal
5. **Graph Embeddings**: Use graph neural networks for node embeddings

