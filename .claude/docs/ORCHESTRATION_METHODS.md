# Orchestration Methods Comparison

This document compares the different orchestration methods available in LLM-RULES and when to use each.

## Available Methods

### 1. Static Description-Based Routing (Baseline)

**How it works**: Matches queries against agent descriptions using trigger words and keyword matching.

**Pros**:
- Fast and simple
- No additional infrastructure needed
- Works immediately

**Cons**:
- Limited to agent-level descriptions
- Doesn't adapt to evolving capabilities
- Misses fine-grained tool matches

**When to use**: Simple queries, unambiguous routing, or when latency is critical.

### 2. Knowledge Base-Aware (KBA) Orchestration

**How it works**: 
- Semantic cache lookup for similar queries
- Confidence-based routing from static descriptions
- Dynamic knowledge probing when confidence is low
- Privacy-preserving ACK signals from agent knowledge bases

**Performance**: Significantly outperforms static methods

**Pros**:
- Adapts as agents learn
- Privacy-preserving
- Reduces description dependency
- Semantic cache improves efficiency

**Cons**:
- Requires agents to maintain knowledge bases
- Slight latency overhead for probing

**When to use**: 
- Evolving agent capabilities
- Ambiguous queries
- When routing accuracy is critical
- Agents with dynamic knowledge bases

**Reference**: [KBA_ORCHESTRATION.md](KBA_ORCHESTRATION.md)

### 3. Agent-as-a-Graph Retrieval

**How it works**:
- Bipartite knowledge graph (agents and tools as nodes)
- Joint vector search over agents and tools
- Type-specific weighted RRF (agents: 1.5, tools: 1.0)
- Graph traversal to find parent agents from tool matches

**Performance**: 
- **14.9% improvement in Recall@5** over agent-only methods
- **14.6% improvement in nDCG@5**

**Pros**:
- Fine-grained tool matching
- Automatic agent discovery from tools
- Works with many tools per agent
- Architecture agnostic (works with any embeddings)

**Cons**:
- Requires graph construction
- More complex than static routing

**When to use**:
- Agents with many tools (hundreds/thousands)
- Tool-specific queries
- Need to discover agents through their tools
- When fine-grained matching is important

**Reference**: [AGENT_AS_GRAPH.md](AGENT_AS_GRAPH.md)

### 4. Combined Graph + KBA (Recommended)

**How it works**: Combines both methods with weighted scoring:
- Graph retrieval: 50% weight
- KBA orchestration: 50% weight
- Final ranking combines both signals

**Performance**: Best of both approaches

**Pros**:
- Fine-grained tool matching (graph)
- Dynamic knowledge signals (KBA)
- Highest routing accuracy
- Adapts to both tool capabilities and agent knowledge

**Cons**:
- Most complex
- Requires both graph and KB infrastructure

**When to use**: 
- Production systems requiring highest accuracy
- Complex multi-agent systems
- When both tool matching and knowledge evolution matter

## Comparison Table

| Method | Recall@5 | nDCG@5 | Latency | Complexity | Adaptability |
|--------|----------|--------|---------|------------|--------------|
| Static | Baseline | Baseline | Low | Low | None |
| KBA | High | High | Medium | Medium | High |
| Graph | +14.9% | +14.6% | Medium | Medium | Medium |
| Combined | Highest | Highest | Medium-High | High | Highest |

## Implementation

### Static Routing (Default)

```javascript
// Uses config.yaml trigger_words and agent descriptions
// Automatic - no code needed
```

### KBA Only

```javascript
import { kbaOrchestrate } from '.claude/tools/orchestration/kba-orchestrator.mjs';
import { probeAgentKB } from '.claude/tools/orchestration/agent-knowledge-probe.mjs';

const result = await kbaOrchestrate(query, agentDescriptions, probeAgentKB);
```

### Graph Only

```javascript
import { agentAsGraphRetrieve } from '.claude/tools/orchestration/agent-as-graph.mjs';

const result = await agentAsGraphRetrieve(query, 5);
```

### Combined (Recommended)

```javascript
import { graphOrchestrate } from '.claude/tools/orchestration/graph-orchestrator.mjs';

const result = await graphOrchestrate(query, {
  use_graph: true,
  use_kba: true,
  graph_weight: 0.5,
  kba_weight: 0.5,
  top_k: 5
});
```

## Choosing the Right Method

### Use Static When:
- ✅ Simple, unambiguous queries
- ✅ Latency is critical
- ✅ Agent descriptions are highly accurate
- ✅ Agents have few tools

### Use KBA When:
- ✅ Agents learn new capabilities over time
- ✅ Queries are ambiguous
- ✅ Agent knowledge bases are maintained
- ✅ Privacy-preserving routing is important

### Use Graph When:
- ✅ Agents have many tools (100+)
- ✅ Queries are tool-specific
- ✅ Need to discover agents through tools
- ✅ Fine-grained matching is critical

### Use Combined When:
- ✅ Production systems
- ✅ Highest accuracy required
- ✅ Both tool matching and knowledge evolution matter
- ✅ Complex multi-agent systems

## Performance Tips

1. **Pre-build Graph**: Build knowledge graph at startup or on agent/tool changes
2. **Maintain KBs**: Keep agent knowledge bases updated
3. **Cache Results**: Use semantic cache for repeated queries
4. **Tune Weights**: Adjust graph/KBA weights based on your use case
5. **Monitor Metrics**: Track Recall@K and nDCG@K to optimize

## Research References

- **KBA**: [Knowledge Base-Aware Orchestration](https://arxiv.org/html/2509.19599v1)
- **Graph**: [Agent-as-a-Graph](https://arxiv.org/html/2511.18194v1)

