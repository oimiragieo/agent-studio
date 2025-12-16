# Knowledge Base-Aware (KBA) Orchestration

This document describes the Knowledge Base-Aware orchestration system implemented in LLM-RULES, based on the research paper: [Knowledge Base-Aware Orchestration: A Dynamic, Privacy-Preserving Method for Multi-Agent Systems](https://arxiv.org/html/2509.19599v1)

## Overview

Traditional orchestration relies on static agent descriptions, which become outdated as agents acquire new knowledge. KBA Orchestration addresses this by:

1. **Semantic Caching**: Remembering past routing decisions for similar queries
2. **Confidence-based Routing**: Using static descriptions first, but calculating confidence
3. **Dynamic Knowledge Probing**: When confidence is low, querying agents' knowledge bases in parallel
4. **Privacy-Preserving Signals**: Agents return lightweight ACK signals without exposing full KB content
5. **Adaptive Learning**: System improves routing accuracy over time

## Key Benefits

- **Higher Routing Accuracy**: Significantly outperforms static description-driven methods
- **Adaptive**: Automatically adapts as agent knowledge bases evolve
- **Privacy-Preserving**: Agents don't expose full knowledge base content
- **Efficient**: Semantic cache reduces redundant probing
- **Reduced Sensitivity**: Less dependent on description quality

## Architecture

### Components

1. **KBA Orchestrator** (`.claude/tools/orchestration/kba-orchestrator.mjs`)
   - Main orchestration logic
   - Semantic cache management
   - Confidence calculation
   - Dynamic probing coordination

2. **Agent Knowledge Probe** (`.claude/tools/orchestration/agent-knowledge-probe.mjs`)
   - Privacy-preserving KB queries
   - Relevance score calculation
   - ACK signal generation

3. **Semantic Cache** (`.claude/context/orchestration-cache/semantic-cache.json`)
   - Stores past routing decisions
   - Enables similarity-based lookup
   - Supports cache invalidation

4. **Agent Knowledge Bases** (`.claude/context/knowledge-bases/<agent>.json`)
   - Private knowledge stores per agent
   - Keywords and topics for relevance matching
   - Updated as agents learn

## Usage

### Basic KBA Orchestration

```javascript
import { kbaOrchestrate } from '.claude/tools/orchestration/kba-orchestrator.mjs';
import { probeAgentKB } from '.claude/tools/orchestration/agent-knowledge-probe.mjs';

// Agent descriptions from config
const agentDescriptions = {
  'analyst': 'Business analysis, market research, requirements gathering...',
  'developer': 'Code implementation, debugging, refactoring...',
  'architect': 'System design, technology selection, scalability...'
};

// Route query using KBA
const result = await kbaOrchestrate(
  'How do I implement OAuth2 authentication?',
  agentDescriptions,
  probeAgentKB
);

console.log(`Selected agent: ${result.selected_agent}`);
console.log(`Confidence: ${result.confidence}`);
console.log(`Method: ${result.method}`); // 'cached', 'static', or 'probed'
```

### Agent Knowledge Base Setup

Agents should maintain knowledge bases in `.claude/context/knowledge-bases/<agent>.json`:

```json
{
  "agent": "developer",
  "entries": [
    {
      "keywords": ["oauth2", "authentication", "security", "jwt"],
      "topics": ["authentication", "authorization", "security protocols"],
      "last_updated": "2025-01-15T10:00:00Z"
    },
    {
      "keywords": ["react", "hooks", "state management"],
      "topics": ["frontend", "react", "ui development"],
      "last_updated": "2025-01-14T15:30:00Z"
    }
  ],
  "metadata": {
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-15T10:00:00Z"
  }
}
```

### Cache Invalidation

When an agent's knowledge base is updated, invalidate the cache:

```javascript
import { invalidateCache } from '.claude/tools/orchestration/kba-orchestrator.mjs';

// Invalidate cache for specific agent
await invalidateCache('developer', 'knowledge_base_updated');

// Or invalidate all cache
await invalidateCache(null, 'system_update');
```

## Configuration

### Confidence Threshold

Adjust the confidence threshold in `kba-orchestrator.mjs`:

```javascript
const CONFIDENCE_THRESHOLD = 0.7; // Lower = more probing, Higher = more static routing
```

### Cache Settings

- **Max Cache Size**: 1000 entries (configurable)
- **Similarity Threshold**: 0.6 for cache lookup (configurable)
- **High Similarity Threshold**: 0.8 for direct cache hit (configurable)

## Performance Considerations

### When to Use KBA

- ✅ **Use KBA when**:
  - Routing accuracy is critical
  - Agents have evolving knowledge bases
  - Queries are ambiguous
  - Managing many agents with overlapping capabilities

- ❌ **Skip KBA when**:
  - Simple, unambiguous queries
  - Single-agent tasks
  - Latency is more critical than accuracy
  - Agent knowledge bases are static

### Optimization Tips

1. **Pre-populate Cache**: Seed cache with common queries
2. **Regular Invalidation**: Invalidate cache when KBs update
3. **Parallel Probing**: All agent probes run in parallel
4. **Cache Size Management**: Limit cache to prevent memory issues

## Research Reference

This implementation is based on:
- **Paper**: [Knowledge Base-Aware Orchestration: A Dynamic, Privacy-Preserving Method for Multi-Agent Systems](https://arxiv.org/html/2509.19599v1)
- **Authors**: Danilo Trombino, Vincenzo Pecorella, Alessandro De Giulii, Davide Tresoldi (2025)
- **Key Concepts**:
  - Semantic cache lookup
  - Confidence-based initial routing
  - Dynamic knowledge probing
  - Privacy-preserving ACK signals
  - Cache population and invalidation

## Agent Knowledge Base Maintenance

Agents should maintain their knowledge bases to enable effective KBA orchestration. See [KBA_AGENT_GUIDE.md](KBA_AGENT_GUIDE.md) for detailed instructions.

### Quick Start for Agents

```javascript
import { addKnowledgeEntry } from '.claude/tools/orchestration/kb-manager.mjs';

// After completing a task, add relevant knowledge
await addKnowledgeEntry('your-agent-name', {
  id: 'unique-entry-id',
  content: 'Description of knowledge or experience',
  keywords: ['keyword1', 'keyword2', 'keyword3'],
  topics: ['topic1', 'topic2']
});
```

## Future Enhancements

1. **Embedding-based Similarity**: Replace simple word overlap with proper embeddings
2. **Adaptive Thresholds**: Learn optimal confidence thresholds per agent
3. **Multi-hop Probing**: Probe agents that agents recommend
4. **Federated Learning**: Share routing patterns across systems
5. **Real-time KB Updates**: Automatic cache invalidation on KB changes
6. **Automatic KB Population**: Extract knowledge from agent outputs automatically

