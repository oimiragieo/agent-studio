# Knowledge Base Maintenance Guide for Agents

This guide explains how agents should maintain their knowledge bases to enable Knowledge Base-Aware (KBA) orchestration.

## Why Maintain Knowledge Bases?

KBA orchestration significantly improves routing accuracy by:
- Using dynamic signals from agent knowledge bases
- Adapting as agents learn new capabilities
- Reducing dependency on static descriptions
- Enabling privacy-preserving relevance matching

## When to Update Your Knowledge Base

Agents should update their knowledge bases when:

1. **Implementing New Features**: After completing a feature, add relevant keywords and topics
2. **Learning New Technologies**: When gaining expertise in new frameworks or tools
3. **Solving Complex Problems**: Document domain-specific solutions
4. **Acquiring Specialized Knowledge**: When developing expertise in specific areas

## How to Update Your Knowledge Base

### Using the KB Manager

```javascript
import { addKnowledgeEntry } from '.claude/tools/orchestration/kb-manager.mjs';

// Example: Developer agent after implementing OAuth2
await addKnowledgeEntry('developer', {
  id: 'oauth2-implementation-2025-01',
  content: 'Successfully implemented OAuth2 authentication with JWT tokens, refresh token rotation, and secure cookie storage',
  description: 'OAuth2 authentication implementation with best practices',
  keywords: ['oauth2', 'authentication', 'jwt', 'security', 'tokens', 'refresh-token', 'cookies'],
  topics: ['authentication', 'authorization', 'security protocols', 'web security'],
  context: 'Full-stack React/Node.js application',
  related_technologies: ['React', 'Node.js', 'Express', 'Passport.js']
});
```

### Knowledge Base Structure

Each entry should include:

- **id**: Unique identifier for the entry
- **content**: Detailed description of the knowledge/experience
- **description**: Brief summary
- **keywords**: Array of relevant keywords (auto-extracted if not provided)
- **topics**: Array of topic categories
- **context**: Context where this knowledge was applied
- **related_technologies**: Technologies/frameworks involved

### Example Entries by Agent Type

#### Developer Agent

```javascript
// After implementing a feature
await addKnowledgeEntry('developer', {
  id: 'react-hooks-optimization',
  content: 'Optimized React component performance using useMemo, useCallback, and React.memo',
  keywords: ['react', 'hooks', 'performance', 'optimization', 'usememo', 'usecallback'],
  topics: ['frontend', 'react', 'performance optimization']
});
```

#### Architect Agent

```javascript
// After designing a system
await addKnowledgeEntry('architect', {
  id: 'microservices-pattern',
  content: 'Designed microservices architecture with event-driven communication using Kafka',
  keywords: ['microservices', 'architecture', 'kafka', 'event-driven', 'distributed-systems'],
  topics: ['system architecture', 'microservices', 'event-driven architecture']
});
```

#### Analyst Agent

```javascript
// After market research
await addKnowledgeEntry('analyst', {
  id: 'saas-market-analysis',
  content: 'Conducted competitive analysis of SaaS market with focus on pricing models',
  keywords: ['saas', 'market-research', 'competitive-analysis', 'pricing', 'business-model'],
  topics: ['market research', 'competitive analysis', 'business strategy']
});
```

## Best Practices

1. **Be Specific**: Include concrete technologies, frameworks, and patterns
2. **Update Regularly**: Add entries after significant work or learning
3. **Use Relevant Keywords**: Include terms users might search for
4. **Categorize Topics**: Use consistent topic categories
5. **Include Context**: Describe when/where knowledge was applied

## Privacy Considerations

- **Lightweight Signals**: Only keywords and topics are used for routing
- **No Full Content Exposure**: Full KB content is never exposed to orchestrator
- **ACK Signals Only**: Agents return relevance scores, not full knowledge

## Automatic Cache Invalidation

When you update your knowledge base:
- Cache entries involving your agent are automatically invalidated
- Future routing decisions will use your updated knowledge
- No manual cache management required

## Integration with Agent Workflows

Agents can update their KBs as part of their normal workflow:

1. **After Task Completion**: Add entry summarizing what was learned
2. **During Implementation**: Document new technologies or patterns encountered
3. **After Research**: Add findings from research or analysis
4. **Periodic Updates**: Review and update KB entries periodically

## Monitoring Knowledge Base Health

Check your knowledge base:

```javascript
import { getAgentKB } from '.claude/tools/orchestration/kb-manager.mjs';

const kb = await getAgentKB('developer');
console.log(`Total entries: ${kb.entries.length}`);
console.log(`Last updated: ${kb.metadata.updated_at}`);
```

## Benefits

Maintaining a knowledge base enables:
- ✅ More accurate routing to your agent
- ✅ Better handling of ambiguous queries
- ✅ Automatic adaptation as you learn
- ✅ Reduced dependency on static descriptions
- ✅ Privacy-preserving relevance matching

For more details, see [KBA_ORCHESTRATION.md](KBA_ORCHESTRATION.md).

