# Memory Patterns Guide - Dual Persistence (CLAUDE.md + Memory Tool)

## Overview

This guide explains how to use both CLAUDE.md files and the memory tool for redundancy and cross-conversation learning. All agents use **BOTH** systems to ensure knowledge persistence and fault tolerance.

## Dual Persistence Strategy

### CLAUDE.md Files (Primary - Version-Controlled)

**Purpose**: Static, version-controlled context

**Characteristics**:

- Hierarchical context loading (root → subdirectories)
- Version-controlled in git
- Project-specific, structured knowledge
- Loaded automatically by Claude Code
- Best for: Static rules, project structure, coding standards

**Location**:

- Root: `.claude/CLAUDE.md`
- Project: `.claude/projects/{project}/CLAUDE.md`
- Phase: `.claude/projects/{project}/phase-*/claude.md`
- Module: `{module}/claude.md`

### Memory Tool (Secondary - Dynamic Learning)

**Purpose**: Dynamic, learned patterns

**Characteristics**:

- Cross-conversation pattern persistence
- Dynamic knowledge accumulation
- Session-specific learnings
- File-based storage under `/memories/` directory
- Best for: Learned patterns, user preferences, task-specific insights

**Location**:

- `.claude/orchestrators/{session-id}/memory/`

**Tool ID**: `memory_20250818`

## How They Work Together

### 1. Initial Context Loading

- **CLAUDE.md files**: Load automatically (hierarchical: root → subdirectories)
- **Memory tool**: Available but not loaded until needed

### 2. During Task Execution

- **Agent references CLAUDE.md**: For rules and standards
- **Agent uses memory tool**: To store learned patterns
- **Agent can read from memory tool**: For previous insights

### 3. Pattern Learning

- **When agent discovers useful pattern**: Writes to memory tool
- **If pattern is project-wide**: Also documented in CLAUDE.md
- **Both systems maintain knowledge**: Redundancy ensures persistence

### 4. Context Retrieval

- **CLAUDE.md**: Provides immediate, structured context
- **Memory tool**: Provides learned, dynamic context
- **Agent combines both**: For comprehensive understanding

## Redundancy Benefits

### 1. Fault Tolerance

If memory tool fails, CLAUDE.md provides context:

- Memory tool unavailable → Use CLAUDE.md
- CLAUDE.md missing → Use memory tool
- Both available → Use both for comprehensive context

### 2. Version Control

CLAUDE.md changes are tracked in git:

- All rule changes versioned
- Project standards documented
- Team collaboration enabled

### 3. Dynamic Learning

Memory tool captures insights not in CLAUDE.md:

- User preferences discovered during interaction
- Task-specific solutions
- Workflow optimizations
- Common mistakes to avoid

### 4. Cross-Project Sharing

Memory tool can share patterns across projects:

- Patterns learned in one project
- Can be referenced in other projects
- Enables knowledge transfer

### 5. Performance

CLAUDE.md loads faster, memory tool provides depth:

- CLAUDE.md: Fast, structured, always available
- Memory tool: Deep, learned, on-demand

## Usage Patterns

### Storing Learned Patterns

**When to Store in Memory**:

- User preferences discovered during interaction
- Task-specific insights and solutions
- Patterns learned from codebase analysis
- Workflow optimizations discovered
- Common mistakes to avoid

**Example**:

```
User: "I prefer using async/await over promises"

Agent stores in memory:
- File: .claude/orchestrators/{session-id}/memory/preferences/coding-style.md
- Content: "User prefers async/await syntax over Promise chains"
```

### Reading from Memory

**When to Read from Memory**:

- Starting a new task (check for relevant patterns)
- Encountering similar problems (look for previous solutions)
- User preferences (check for known preferences)
- Workflow patterns (check for optimized approaches)

**Example**:

```
Agent needs to implement authentication

Agent reads from memory:
- Query: "authentication implementation patterns"
- Returns: Relevant patterns from memory files
- Uses patterns to guide implementation
```

### Syncing to CLAUDE.md

**When to Sync**:

- Pattern is project-wide and should be version-controlled
- Rule discovered that applies to all future work
- Standard that should be part of project documentation
- Important decision that affects project structure

**How to Sync**:

1. Read pattern from memory tool
2. Determine if it should be in CLAUDE.md
3. Add to appropriate CLAUDE.md file (root or phase-specific)
4. Keep in memory tool for redundancy

**Example**:

```
Agent discovers: "Always use TypeScript strict mode"

Agent syncs:
1. Reads from memory: "typescript-strict-mode-pattern.md"
2. Adds to .claude/CLAUDE.md: "TypeScript Configuration: Always use strict mode"
3. Keeps in memory for redundancy
```

## Memory File Organization

### Directory Structure

```
.claude/orchestrators/{session-id}/memory/
├── patterns/
│   ├── authentication-patterns.md
│   ├── api-design-patterns.md
│   └── testing-patterns.md
├── preferences/
│   ├── user-preferences.md
│   └── coding-style.md
└── insights/
    ├── performance-insights.md
    └── security-insights.md
```

### Naming Conventions

- **Patterns**: `{category}-patterns.md` (e.g., `authentication-patterns.md`)
- **Preferences**: `{type}-preferences.md` (e.g., `user-preferences.md`)
- **Insights**: `{domain}-insights.md` (e.g., `performance-insights.md`)

## Security Best Practices

### Path Validation

**Always validate memory file paths**:

- Only allow paths under `.claude/orchestrators/{session-id}/memory/`
- Reject paths with `..` (directory traversal)
- Reject absolute paths outside project
- Validate file extensions (only `.md`, `.json`, `.yaml` files)

### Memory Poisoning Prevention

**Prevent malicious memory content**:

- Validate memory content before storing
- Sanitize user input in memory files
- Review memory files periodically
- Use structured formats (JSON, YAML) when possible

## Integration with Agents

### All Agents Use Both

Every agent should:

1. **Load CLAUDE.md files** automatically (via Claude Code)
2. **Use memory tool** for learned patterns
3. **Store insights** in memory tool
4. **Sync important patterns** to CLAUDE.md when appropriate

### Agent-Specific Memory

- **Orchestrator**: Workflow patterns, routing decisions, coordination strategies
- **Developer**: Implementation patterns, code solutions, debugging insights
- **Architect**: Design patterns, technology choices, architecture decisions
- **QA**: Testing patterns, quality insights, bug patterns

## Memory Sync Utility

### Automatic Sync

The memory sync utility (`.claude/tools/memory-sync.mjs`) can:

- Sync important patterns from memory to CLAUDE.md
- Merge memory insights into project documentation
- Archive old memory files
- Validate memory file integrity

### Usage

```bash
# Sync patterns to CLAUDE.md
node .claude/tools/memory-sync.mjs --session-id <id> --sync-to-claude --project <name>

# Validate memory files
node .claude/tools/memory-sync.mjs --session-id <id> --validate
```

## Configuration

Memory tool is configured in `.claude/config.yaml`:

```yaml
memory_tool:
  enabled: true
  tool_id: 'memory_20250818'
  storage_path: '.claude/orchestrators/{session-id}/memory'
  sync_with_claude_md: true
  agents_with_memory:
    - planner
    - orchestrator
    - developer
    # ... all agents
```

## Best Practices

1. **Store Frequently**: Store patterns as you discover them
2. **Read Before Starting**: Check memory for relevant patterns before new tasks
3. **Sync Important Patterns**: Move project-wide patterns to CLAUDE.md
4. **Organize by Category**: Use directory structure for organization
5. **Validate Paths**: Always validate memory file paths
6. **Review Periodically**: Clean up old or outdated memory files
7. **Maintain Redundancy**: Keep important patterns in both systems

## Troubleshooting

### Memory Tool Not Available

- Check that memory tool is enabled in `.claude/config.yaml`
- Verify memory tool is available in agent's tool list
- Ensure memory directory exists and is writable

### Memory Files Not Persisting

- Check file permissions on memory directory
- Verify memory tool is writing to correct location
- Check for errors in memory tool execution

### CLAUDE.md Sync Fails

- Verify CLAUDE.md file is writable
- Check that pattern is appropriate for CLAUDE.md
- Ensure proper formatting when adding to CLAUDE.md

## Examples

### Example 1: Storing User Preference

```
User: "I prefer using async/await over promises"

Agent stores in memory:
- File: .claude/orchestrators/{session-id}/memory/preferences/coding-style.md
- Content: "User prefers async/await syntax over Promise chains for asynchronous code"
```

### Example 2: Storing Learned Pattern

```
Agent discovers: "Using Zod for validation reduces bugs by 40%"

Agent stores in memory:
- File: .claude/orchestrators/{session-id}/memory/patterns/validation-patterns.md
- Content: "Zod validation pattern: Use Zod schemas for all API input validation. Reduces bugs by 40%."
```

### Example 3: Reading from Memory

```
Agent needs to implement authentication

Agent reads from memory:
- Query: "authentication implementation patterns"
- Returns: Relevant patterns from memory files
- Uses patterns to guide implementation
```

### Example 4: Syncing to CLAUDE.md

```
Agent discovers important pattern: "Always use TypeScript strict mode"

Agent syncs:
1. Reads from memory: "typescript-strict-mode-pattern.md"
2. Adds to .claude/CLAUDE.md: "TypeScript Configuration: Always use strict mode"
3. Keeps in memory for redundancy
```

## Entity Memory

### Overview

Entity Memory tracks people, organizations, tools, projects, decisions, and artifacts across sessions using a knowledge graph. This provides persistent entity recognition and relationship tracking.

### Entity Types

1. **PERSON**: Developers, users, stakeholders (e.g., "Alice", "@bob", "John Smith")
2. **ORGANIZATION**: Companies, teams, projects (e.g., "Engineering Team", "Anthropic Inc")
3. **TOOL**: Technologies, frameworks, libraries (e.g., "React", "Node.js", "PostgreSQL")
4. **PROJECT**: Repositories, initiatives (e.g., "LLM-RULES", "facebook/react")
5. **DECISION**: Technical decisions, ADRs (e.g., "decided to use TypeScript")
6. **ARTIFACT**: Files, documents, outputs (e.g., "README.md", "package.json")

### Usage

#### Extract Entities

```javascript
import { EntityExtractor } from './.claude/tools/memory/entity-extractor.mjs';

const extractor = new EntityExtractor();
const text = 'Alice decided to use React for the dashboard project';
const entities = extractor.extractFromText(text);
// Returns: [
//   { type: 'person', value: 'Alice', confidence: 0.95, context: '...' },
//   { type: 'tool', value: 'React', confidence: 1.0, context: '...' },
//   { type: 'project', value: 'dashboard', confidence: 0.8, context: '...' }
// ]
```

#### Store Entities

```javascript
import { EntityMemory } from './.claude/tools/memory/entity-memory.mjs';
import { createMemoryDatabase } from './.claude/tools/memory/database.mjs';

const db = createMemoryDatabase();
await db.initialize();

const memory = new EntityMemory(db);
await memory.initialize();

// Create entities
const personId = await memory.createEntity('person', 'Alice', { role: 'frontend dev' });
const toolId = await memory.createEntity('tool', 'React', { version: '18.0' });

// Create relationship
await memory.addRelationship(personId, toolId, 'used_in');
```

#### Query Entities

```javascript
// Search by name
const results = await memory.searchEntities('Alice');

// Get entity with relationships
const entity = await memory.getEntity(personId);
const relationships = await memory.getRelationships(personId);
// Returns: [{ entity_id_2: toolId, relationship_type: 'used_in', ... }]

// Get entity history
const history = await memory.getEntityHistory(personId);
// Returns timeline of mentions and relationship changes
```

#### Inject Entity Context

```javascript
import { MemoryInjectionManager } from './.claude/tools/memory/injection-manager.mjs';

const injectionManager = new MemoryInjectionManager(db, {
  entityMemoryEnabled: true,
});

await injectionManager.initialize();

// Inject entity context for relevant entities
const entityContext = await injectionManager.injectEntityContext(
  ['Alice', 'React', personId], // Entity names or IDs
  5000 // Max tokens
);

console.log(entityContext.context);
// Output:
// ## Known Entities
//
// **Alice** (person)
// - role: frontend dev
// - Related: used_in: React
// - Mentioned 3 times
//
// **React** (tool)
// - version: 18.0
// - Related: used_in: dashboard
```

### Relationship Types

- `worked_with`: Person ↔ Person
- `decided_on`: Person → Decision
- `contributed_to`: Person → Project
- `used_in`: Tool → Project
- `depends_on`: Project → Tool
- `created`: Person → Artifact
- `belongs_to`: Person → Organization
- `uses`: Person → Tool

### Performance Characteristics

- Entity extraction: <50ms
- Entity creation: <5ms
- Entity retrieval: <10ms
- Relationship creation: <5ms
- Search queries: <50ms
- Extraction accuracy: >85%

### Integration with Memory System

Entity Memory is automatically integrated with the Phase 2 Memory System:

1. **Automatic Extraction**: Messages are processed to extract entities
2. **Graph Storage**: Entities stored in SQLite with relationships
3. **Context Injection**: Relevant entities injected into tool context
4. **Cross-Session**: Entities persist across sessions

### Database Schema

```sql
-- Entities table
CREATE TABLE entities (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  value TEXT NOT NULL,
  confidence REAL DEFAULT 1.0,
  context TEXT,
  metadata TEXT,
  occurrence_count INTEGER DEFAULT 1,
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Entity relationships (graph edges)
CREATE TABLE entity_relationships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_id_1 TEXT NOT NULL,
  entity_id_2 TEXT NOT NULL,
  relationship_type TEXT NOT NULL,
  strength REAL DEFAULT 1.0,
  context TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (entity_id_1) REFERENCES entities(id) ON DELETE CASCADE,
  FOREIGN KEY (entity_id_2) REFERENCES entities(id) ON DELETE CASCADE
);
```

## Hierarchical Memory Tiers

### Overview

Hierarchical Memory organizes memories into 3 tiers based on scope and importance, with automatic promotion when patterns recur across contexts.

**Tiers** (from lowest to highest):

1. **Conversation Tier**: Ephemeral, conversation-specific memories (TTL: 24 hours)
2. **Agent Tier**: Agent-specific patterns and learnings (TTL: 7 days)
3. **Project Tier**: Cross-agent, persistent project knowledge (no TTL)

**Promotion Rules**:

- **Conversation → Agent**: Promoted after 3+ references across different conversations
- **Agent → Project**: Promoted after 5+ references from different agents

### Why Hierarchical Tiers?

**Benefits**:

1. **Automatic Importance Scoring**: Memories promote based on actual usage, not manual scoring
2. **Scope-Appropriate Persistence**: Ephemeral conversations don't clutter long-term memory
3. **Cross-Agent Knowledge Sharing**: Project-tier memories available to all agents
4. **Performance**: Tier-based filtering reduces search space
5. **Natural Decay**: Unused memories expire automatically

### Usage

#### Store Memory in Tier

```javascript
import {
  createHierarchicalMemory,
  MemoryTier,
} from './.claude/tools/memory/hierarchical-memory.mjs';

const manager = createHierarchicalMemory();
await manager.initialize();

// Store in conversation tier (default)
await manager.storeMemory({
  conversationId: 123,
  agentId: 'developer',
  content: 'User prefers TypeScript for new projects',
  importanceScore: 0.7,
});

// Store directly in project tier (important knowledge)
await manager.storeMemory({
  conversationId: 123,
  agentId: 'architect',
  content: 'Project uses React 18 with concurrent features',
  tier: MemoryTier.PROJECT,
  importanceScore: 0.9,
});
```

#### Reference Memory (Triggers Promotion Check)

```javascript
// Reference a memory (increments reference count)
const result = await manager.referenceMemory(messageId, 'qa');

if (result.promotion.promoted) {
  console.log(`Promoted from ${result.promotion.fromTier} to ${result.promotion.toTier}`);
  console.log(`Reason: ${result.promotion.reason}`);
}
```

#### Search Across Tiers

```javascript
// Search all tiers (prioritizes project > agent > conversation)
const searchResult = await manager.searchAcrossTiers('TypeScript best practices', {
  tiers: [MemoryTier.PROJECT, MemoryTier.AGENT, MemoryTier.CONVERSATION],
  agentId: 'developer', // Optional: filter by agent
  limit: 10,
  minImportance: 0.5,
});

searchResult.results.forEach(memory => {
  console.log(`[${memory.tier}] ${memory.content} (priority: ${memory.tier_priority})`);
});
```

#### Get Memories by Tier

```javascript
// Get all project-tier memories
const projectMemories = await manager.getMemoriesByTier(MemoryTier.PROJECT, {
  limit: 50,
  orderBy: 'importance_score DESC',
});

// Get agent-specific memories
const developerMemories = await manager.getMemoriesByTier(MemoryTier.AGENT, {
  agentId: 'developer',
  limit: 20,
});
```

#### Expire Old Memories

```javascript
// Expire conversation-tier (>24 hours) and agent-tier (>7 days) memories
const result = await manager.expireOldMemories();
console.log(`Expired ${result.totalExpired} memories`);
// Output: Expired 42 memories (35 conversation, 7 agent)
```

### Tier Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│  TIER LIFECYCLE (Automatic Promotion)                            │
│                                                                 │
│  1. Conversation Tier (TTL: 24 hours)                           │
│     ↓ (3+ references across conversations)                      │
│  2. Agent Tier (TTL: 7 days)                                    │
│     ↓ (5+ references from different agents)                     │
│  3. Project Tier (no expiration)                                │
└─────────────────────────────────────────────────────────────────┘
```

**Example Promotion Flow**:

1. User says: "I prefer async/await over promises" → Stored in **Conversation Tier**
2. Referenced in 3 different conversations → Promoted to **Agent Tier** (developer)
3. Referenced by QA, architect, and 3 other agents → Promoted to **Project Tier**

### Configuration

```javascript
const manager = createHierarchicalMemory({
  // Promotion thresholds
  conversationToAgent: 3, // 3+ refs → agent tier
  agentToProject: 5, // 5+ refs → project tier

  // Time-to-live (hours)
  conversationTTL: 24, // 24 hours
  agentTTL: 168, // 7 days
  projectTTL: null, // No expiration

  // Decay factor (for importance scoring)
  decayFactor: 0.95, // 5% decay per day
});
```

### Tier Statistics

```javascript
// Get tier statistics
const stats = await manager.getTierStats();

console.log(stats);
// Output:
// {
//   conversation: { count: 120, avgImportance: 0.5, avgReferences: 0.8, promotedCount: 15 },
//   agent: { count: 45, avgImportance: 0.7, avgReferences: 2.3, promotedCount: 8 },
//   project: { count: 12, avgImportance: 0.9, avgReferences: 5.1, promotedCount: 0 }
// }
```

### Promotion Candidates

```javascript
// Get memories close to promotion threshold
const candidates = await manager.getPromotionCandidates(MemoryTier.CONVERSATION);

candidates.forEach(memory => {
  console.log(`${memory.content} - ${memory.reference_count} refs (need 3 for promotion)`);
});
```

### Performance Characteristics

- **Tier assignment**: <5ms
- **Promotion check**: <50ms
- **Cross-tier search**: <200ms
- **Memory expiration**: <1s for 10,000 memories

### Integration with Semantic Memory

```javascript
import { createSemanticMemoryService } from './.claude/tools/memory/semantic-memory.mjs';
import { createHierarchicalMemory } from './.claude/tools/memory/hierarchical-memory.mjs';

const hierarchical = createHierarchicalMemory();
const semantic = createSemanticMemoryService();

await hierarchical.initialize();
await semantic.initialize();

// Store memory in tier + index for semantic search
const result = await hierarchical.storeMemory({
  conversationId: 123,
  content: 'User prefers functional programming patterns',
  agentId: 'developer',
});

await semantic.indexMessage({
  id: result.messageId,
  content: 'User prefers functional programming patterns',
  conversationId: 123,
});

// Search semantically, filtered by tier
const searchResult = await hierarchical.searchAcrossTiers('functional programming', {
  tiers: [MemoryTier.AGENT, MemoryTier.PROJECT],
});
```

### Database Schema

```sql
-- Hierarchical memory columns (added via migration)
ALTER TABLE messages ADD COLUMN tier TEXT DEFAULT 'conversation'
  CHECK(tier IN ('conversation', 'agent', 'project'));
ALTER TABLE messages ADD COLUMN promotion_count INTEGER DEFAULT 0;
ALTER TABLE messages ADD COLUMN tier_promoted_at DATETIME;
ALTER TABLE messages ADD COLUMN agent_id TEXT;
ALTER TABLE messages ADD COLUMN reference_count INTEGER DEFAULT 0;
ALTER TABLE messages ADD COLUMN last_referenced_at DATETIME DEFAULT CURRENT_TIMESTAMP;

-- Indexes for tier queries
CREATE INDEX idx_messages_tier ON messages(tier);
CREATE INDEX idx_messages_promotion ON messages(reference_count, tier);
CREATE INDEX idx_messages_agent ON messages(agent_id, tier);
```

### Best Practices

1. **Let Promotion Happen Automatically**: Don't manually promote unless necessary
2. **Reference Frequently Used Memories**: Referencing signals importance
3. **Start in Conversation Tier**: Let the system decide if it's agent/project-worthy
4. **Use Tier Filtering**: Search specific tiers when scope is known
5. **Expire Regularly**: Run `expireOldMemories()` daily to clean up
6. **Monitor Tier Stats**: Check `getTierStats()` to understand memory distribution

### Common Patterns

**Pattern 1: User Preference Learning**

```javascript
// Conversation 1: User mentions preference
await manager.storeMemory({
  conversationId: conv1,
  content: 'User prefers dark mode',
  tier: MemoryTier.CONVERSATION,
});

// Conversation 2: Reference the preference
await manager.referenceMemory(memoryId, 'ux-expert');

// Conversation 3: Reference again → Promoted to Agent tier
await manager.referenceMemory(memoryId, 'ux-expert');
// Now available to all UX expert conversations
```

**Pattern 2: Project-Wide Knowledge**

```javascript
// Architect stores project decision
await manager.storeMemory({
  conversationId: conv1,
  content: 'Project uses monorepo with pnpm workspaces',
  tier: MemoryTier.PROJECT, // Immediately project-tier
  agentId: 'architect',
});

// All agents can access
const memories = await manager.getMemoriesByTier(MemoryTier.PROJECT);
```

**Pattern 3: Automatic Decay**

```javascript
// Conversation-tier memory not referenced for 24 hours
// → Automatically expired

// Agent-tier memory not referenced for 7 days
// → Automatically expired

// Project-tier memory
// → Never expires (unless manually deleted)
```

## Enhanced Context Injection (Phase 3)

### Overview

Phase 3 introduces query-aware memory retrieval with multi-factor relevance scoring, replacing simple recency-based retrieval with intelligent scoring that considers semantic similarity, recency, hierarchical tier, and entity overlap.

**Algorithm**: Multi-factor scoring with weighted components:

```
score = (0.4 × semantic_similarity) + (0.2 × recency) + (0.3 × tier_priority) + (0.1 × entity_overlap)
```

**Key Improvements over Phase 2.4**:

1. **Query-Aware**: Retrieves memories relevant to the current query, not just recent
2. **Multi-Factor Scoring**: Combines 4 factors instead of just recency
3. **Dynamic Token Budget**: Adapts to context usage instead of fixed allocation
4. **Tier-Aware**: Prioritizes project-tier memories over conversation-tier
5. **Entity-Aware**: Boosts memories mentioning same entities as query

### Performance Characteristics

- **Scoring**: <100ms (p95) for 50 candidate memories
- **Injection**: <500ms (p95) end-to-end
- **Cache Hit Rate**: >50% for repeated queries
- **Relevance**: 30-40% improvement over recency-only ranking

### Usage

#### Enable Enhanced Injection

```javascript
import { createMemoryInjectionManager } from './.claude/tools/memory/injection-manager.mjs';

// Enhanced injection enabled by default
const manager = createMemoryInjectionManager({
  useEnhancedInjection: true, // Phase 3 (default)
});

await manager.initialize();

// Inject memory with query-aware retrieval
const result = await manager.injectRelevantMemory({
  sessionId: 'sess123',
  conversationId: 456,
  query: 'TypeScript best practices for React hooks', // Explicit query
  toolName: 'Task',
  toolParams: {
    description: 'Implement useCallback optimization',
  },
  conversationTokens: 50000,
  maxTokens: 200000,
});

console.log(result.memory); // Formatted memory context
console.log(result.relevanceScores); // Score breakdown for each memory
```

#### Disable for Backward Compatibility

```javascript
// Use Phase 2.4 logic (FTS5 + semantic search only)
const manager = createMemoryInjectionManager({
  useEnhancedInjection: false, // Fall back to Phase 2.4
});
```

**Environment Variable**:

```bash
# Disable globally
export USE_ENHANCED_INJECTION=false
```

### Scoring Breakdown

Each memory receives a relevance score from 0-1 based on 4 factors:

#### 1. Semantic Similarity (40% weight)

Measures how semantically similar the memory content is to the query.

- Uses semantic embeddings if available
- Falls back to Jaccard similarity (word overlap) if not

**Example**:

- Query: "TypeScript React hooks"
- Memory: "Use TypeScript with React hooks for type safety"
- Semantic Score: 0.92 (high similarity)

#### 2. Recency (20% weight)

How recent the memory is, using exponential decay.

- Formula: `score = e^(-age/maxAge)` where maxAge = 7 days
- Recent memories (< 1 hour): score ≈ 1.0
- Old memories (> 7 days): score < 0.5

**Example**:

- Memory from 2 hours ago: recency = 0.98
- Memory from 3 days ago: recency = 0.65
- Memory from 10 days ago: recency = 0.24

#### 3. Tier Priority (30% weight)

Hierarchical tier of the memory (project > agent > conversation).

- Project tier: 1.0 (highest priority)
- Agent tier: 0.7 (medium priority)
- Conversation tier: 0.4 (lowest priority)

**Example**:

- Project-tier: "Use monorepo with pnpm workspaces" → tier = 1.0
- Agent-tier: "Developer prefers async/await" → tier = 0.7
- Conversation-tier: "User mentioned TypeScript" → tier = 0.4

#### 4. Entity Overlap (10% weight)

Overlap between entities in the query and memory.

- Extracts entities (people, tools, projects, etc.)
- Calculates Jaccard similarity of entity sets
- Boosts memories mentioning same entities

**Example**:

- Query entities: ["TypeScript", "React", "hooks"]
- Memory entities: ["TypeScript", "React", "useState"]
- Entity Score: 0.67 (2 of 3 entities overlap)

### Combined Scoring Example

**Query**: "TypeScript best practices for React hooks"

**Memory 1** (Project Tier):

- Content: "Always use TypeScript strict mode with React hooks"
- Semantic: 0.95 (very similar)
- Recency: 0.88 (from yesterday)
- Tier: 1.0 (project tier)
- Entity: 0.75 (TypeScript, React match)
- **Combined Score**: (0.4 × 0.95) + (0.2 × 0.88) + (0.3 × 1.0) + (0.1 × 0.75) = **0.93**

**Memory 2** (Conversation Tier):

- Content: "User mentioned TypeScript"
- Semantic: 0.45 (low similarity)
- Recency: 0.99 (from 10 minutes ago)
- Tier: 0.4 (conversation tier)
- Entity: 0.33 (only TypeScript matches)
- **Combined Score**: (0.4 × 0.45) + (0.2 × 0.99) + (0.3 × 0.4) + (0.1 × 0.33) = **0.53**

Memory 1 scores higher despite being older because of semantic similarity, tier priority, and entity overlap.

### Dynamic Token Budget

Token budget adapts to context usage instead of being fixed:

```javascript
// Context nearly full (190k of 200k tokens used)
const budget1 = calculateDynamicTokenBudget(190000, 200000);
// Returns: 1000 (minimum bound enforced)

// Context half-full (100k of 200k tokens used)
const budget2 = calculateDynamicTokenBudget(100000, 200000);
// Returns: 20000 (20% of 100k remaining)

// Context mostly empty (10k of 200k tokens used)
const budget3 = calculateDynamicTokenBudget(10000, 200000);
// Returns: 38000 (20% of 190k remaining, capped at 40k max)
```

**Configuration**:

```javascript
const manager = createMemoryInjectionManager({
  tokenBudget: 0.2, // 20% of remaining context (default)
  minTokens: 1000, // Minimum tokens to inject
  maxTokens: 40000, // Maximum tokens to inject (hard cap)
});
```

### Caching

Enhanced injector caches scored results for 1 minute:

- **Cache Key**: `sessionId:query` (first 50 chars of query)
- **TTL**: 60 seconds (configurable)
- **Max Size**: 100 entries (LRU eviction)
- **Hit Rate**: Typically >50% for repeated queries

**Benefits**:

- Reduces scoring latency for repeated queries
- Improves responsiveness for common patterns
- Automatically expires stale entries

### Performance Metrics

Track performance with built-in metrics:

```javascript
// After several injections
const metrics = injector.getMetrics();

console.log(metrics);
// Output:
// {
//   scoring: { avg: 45, p50: 42, p95: 78, p99: 95 },
//   injection: { avg: 120, p50: 110, p95: 280, p99: 450 },
//   cache: { hits: 15, misses: 10, hitRate: 0.6 }
// }
```

### Custom Weights

Adjust scoring weights for domain-specific needs:

```javascript
// Prioritize recency over semantic similarity
const manager = createMemoryInjectionManager({
  weights: {
    semantic: 0.2, // Reduced
    recency: 0.5, // Increased
    tier: 0.2,
    entity: 0.1,
  },
});

// Prioritize tier over everything else
const manager2 = createMemoryInjectionManager({
  weights: {
    semantic: 0.2,
    recency: 0.1,
    tier: 0.6, // Increased
    entity: 0.1,
  },
});
```

### Integration with Existing Systems

Enhanced injector works seamlessly with Phase 2 systems:

- **Hierarchical Memory**: Automatically filters by tier
- **Entity Memory**: Extracts and matches entities
- **Semantic Memory**: Uses embeddings for similarity
- **FTS5 Search**: Falls back when semantic unavailable

### Migration from Phase 2.4

Phase 3 is **backward compatible** via feature flag:

```javascript
// Option 1: Environment variable (global)
export USE_ENHANCED_INJECTION=false

// Option 2: Constructor option (per-instance)
const manager = createMemoryInjectionManager({
  useEnhancedInjection: false, // Use Phase 2.4 logic
});

// Option 3: Default (Phase 3 enabled)
const manager = createMemoryInjectionManager(); // Uses Phase 3
```

**No breaking changes** - existing code continues to work.

### Best Practices

1. **Provide Explicit Queries**: Pass `query` field for best results
2. **Monitor Metrics**: Check p95 latencies to ensure targets met
3. **Tune Weights**: Adjust based on your domain needs
4. **Use Caching**: Leverage cache for repeated queries
5. **Set Relevance Threshold**: Filter low-relevance memories with `minRelevance`

### Troubleshooting

**Slow Scoring (>100ms p95)**:

- Check candidate count (should be <50)
- Disable entity extraction if not needed
- Increase cache TTL to reduce scoring frequency

**Low Relevance Scores**:

- Check semantic memory initialization
- Verify query quality (not too generic)
- Lower `minRelevance` threshold

**High Memory Usage**:

- Reduce cache max size
- Lower token budget allocation
- Decrease candidate count in retrieval

## Phase 4: Cross-Agent Memory Sharing

### Overview

Phase 4 introduces seamless memory transfer between agents in multi-agent workflows, enabling knowledge sharing across agent boundaries while maintaining memory consistency and preventing circular dependencies. This phase transforms memory from an agent-local system into a collaborative, workflow-aware system.

**Key Capabilities**:

1. **Agent-to-Agent Memory Handoff**: Selective transfer of relevant memories when spawning new agents
2. **Shared Entity Registry**: Global entity tracking visible to all agents in a session
3. **Session Resume**: Restore previous sessions with full context and collaboration history
4. **Collaboration Tracking**: Record and analyze agent-to-agent handoffs with circular dependency detection

**When to Use Phase 4**:

- Multi-agent workflows where downstream agents need upstream agent context
- Long-running projects requiring session continuity
- Complex systems where multiple agents collaborate on shared work
- Projects needing full audit trail of agent interactions

### Agent-to-Agent Handoff

Agent Handoff transfers relevant memories from a source agent to a target agent when the orchestrator spawns a new agent in a workflow. This ensures continuity and prevents work duplication.

**How It Works**:

```
┌─────────────────────────────────────────────────────────┐
│  AGENT HANDOFF FLOW                                      │
│                                                         │
│  1. Source Agent completes task → memories accumulated  │
│  2. Orchestrator spawns Target Agent                    │
│  3. Handoff Service prepares handoff:                   │
│     - Query source agent memories                       │
│     - Score by relevance to target task                 │
│     - Filter within token budget                        │
│     - Extract entities from memories                    │
│  4. Register collaboration + circular check              │
│  5. Apply handoff → inject context to target agent      │
│  6. Target agent continues with full context            │
└─────────────────────────────────────────────────────────┘
```

**Example: Developer → Code Reviewer Handoff**

```javascript
import { createMemoryHandoffService } from './.claude/tools/memory/memory-handoff-service.mjs';

const handoffService = createMemoryHandoffService({
  database: db,
  config: {
    maxMemories: 10, // Share top 10 memories
    tokenBudget: 5000, // 5k tokens max
    includeEntities: true, // Include entity context
  },
});

await handoffService.initialize();

// Prepare handoff from developer to code-reviewer
const handoff = await handoffService.prepareHandoff({
  sessionId: 'sess-123',
  workflowId: 'wf-code-review',
  sourceAgentId: 'developer',
  targetAgentId: 'code-reviewer',
  targetTask: 'Review React components for type safety',
  tokenBudget: 5000,
});

// Result includes:
// - handoffId: unique identifier for this handoff
// - context: formatted memories + entities
// - metadata: token usage, memory counts, etc.
console.log(handoff);
// Output:
// {
//   handoffId: 'handoff-abc123',
//   context: {
//     context: "## Handoff Context...",
//     tokensUsed: 3421,
//     memoriesShared: 8,
//     entitiesShared: 15
//   },
//   metadata: { ... }
// }
```

**Token Budget Management**:

Handoff respects a strict token budget to prevent context bloat:

```javascript
// Configure token budget
const handoff = await handoffService.prepareHandoff({
  sessionId: 'sess-123',
  sourceAgentId: 'developer',
  targetAgentId: 'qa',
  tokenBudget: 3000, // Max 3k tokens for handoff context
  maxMemories: 8, // Max 8 memories to share
});

// Handoff automatically:
// 1. Scores memories by relevance
// 2. Selects top memories within budget
// 3. Stops adding when budget would exceed limit
```

**Relevance Scoring**:

Memories are scored using Phase 3 multi-factor scoring (or fallback if unavailable):

```
Relevance Score = (0.4 × Semantic) + (0.2 × Recency) + (0.3 × Tier) + (0.1 × Entity)
```

- **Semantic**: Text similarity to target task
- **Recency**: How recent the memory is (exponential decay)
- **Tier**: Memory hierarchy tier (project > agent > conversation)
- **Entity**: Overlap between memory and task entities

**Handoff Types**:

Handoffs can take different forms depending on the workflow:

```javascript
const handoffTypes = {
  SEQUENTIAL: 'sequential', // A → B (linear chain)
  PARALLEL: 'parallel', // A → [B, C] (fan-out)
  FORK: 'fork', // A splits work to B and C
  JOIN: 'join', // B and C merge results to D
};

// Register collaborative handoff
await collaborationManager.registerCollaboration({
  sessionId: 'sess-123',
  sourceAgentId: 'developer',
  targetAgentId: 'qa',
  handoffType: HandoffType.SEQUENTIAL,
});
```

**Performance Characteristics**:

- Handoff preparation: <200ms (p95)
- Handoff application: <100ms (p95)
- Relevance scoring: <100ms (p95)
- Entity extraction: <50ms (p95)

### Shared Entity Registry

The Shared Entity Registry maintains a knowledge graph of entities (people, tools, projects, decisions, artifacts) with relationships that persist across the entire session. All agents can reference these entities without redundant extraction or storage.

**Entity Types**:

```javascript
const EntityTypes = {
  PERSON: 'person', // Developers, users, stakeholders
  ORGANIZATION: 'organization', // Teams, companies
  TOOL: 'tool', // Technologies, frameworks
  PROJECT: 'project', // Repositories, initiatives
  DECISION: 'decision', // Technical decisions, ADRs
  ARTIFACT: 'artifact', // Files, documents, outputs
};

// Example entities:
// - PERSON: "Alice" (frontend developer)
// - TOOL: "React" (frontend framework)
// - PROJECT: "LLM-RULES" (multi-agent system)
// - DECISION: "Use TypeScript strict mode"
```

**Relationship Types**:

```javascript
const relationships = {
  worked_with: 'Person ↔ Person',
  decided_on: 'Person → Decision',
  contributed_to: 'Person → Project',
  used_in: 'Tool → Project',
  depends_on: 'Project → Tool',
  created: 'Person → Artifact',
  belongs_to: 'Person → Organization',
  uses: 'Person → Tool',
};
```

**Entity Deduplication**:

The registry automatically deduplicates entities by matching names and types:

```javascript
import { createEntityMemory } from './.claude/tools/memory/entity-memory.mjs';

const entityMemory = createEntityMemory(db);
await entityMemory.initialize();

// Create or find entity
const personId1 = await entityMemory.createEntity('person', 'Alice', {
  role: 'frontend developer',
});

// Same entity - automatically deduplicated
const personId2 = await entityMemory.createEntity('person', 'Alice', {
  role: 'senior frontend dev', // merged with existing
});

console.log(personId1 === personId2); // true
```

**Entity Query**:

```javascript
// Search for entities
const results = await entityMemory.searchEntities('Alice');
// Returns all entities matching "Alice"

// Get entity with relationships
const entity = await entityMemory.getEntity(personId);
const relationships = await entityMemory.getRelationships(personId);
// Returns entity + all connected relationships

// Get entity history
const history = await entityMemory.getEntityHistory(personId);
// Returns timeline of mentions and relationship changes
```

**Entity Conflicts**:

When conflicting information exists about an entity, the system resolves conflicts:

```javascript
// Conflict: Two mentions of "React" with different versions
const entity1 = await entityMemory.createEntity('tool', 'React', {
  version: '18.0',
});

const entity2 = await entityMemory.createEntity('tool', 'React', {
  version: '19.0', // newer version
});

// System automatically:
// 1. Recognizes as same entity
// 2. Merges metadata (keeps newer version)
// 3. Tracks conflict in entity history
```

**Performance Characteristics**:

- Entity creation: <5ms
- Entity retrieval: <10ms
- Relationship creation: <5ms
- Search queries: <50ms
- Extraction accuracy: >85%

### Session Resume

Session Resume allows restoration of previous sessions with full context, including memories, entities, and collaboration history. This enables multi-day projects and interrupted workflows.

**How It Works**:

```
┌──────────────────────────────────────────────────────┐
│  SESSION RESUME FLOW                                 │
│                                                      │
│  1. Previous session ends → state saved             │
│  2. User starts new session → requests resume       │
│  3. Resume service loads:                           │
│     - All memories (organized by tier)              │
│     - Entity registry (relationships preserved)     │
│     - Collaboration history (handoffs)              │
│     - Agent state (current position in workflow)    │
│  4. Context injected into resumed agent             │
│  5. Workflow continues from checkpoint              │
└──────────────────────────────────────────────────────┘
```

**Resume Modes**:

```javascript
import { createSessionResumeService } from './.claude/tools/memory/session-resume-service.mjs';

const resumeService = createSessionResumeService(db);

// FULL RESUME: Restore everything
const result = await resumeService.resumeSession({
  sessionId: 'sess-123',
  mode: 'full', // Restore all context
  checkpointId: null, // Resume from latest checkpoint
});

// PARTIAL RESUME: Restore only recent memories
const result = await resumeService.resumeSession({
  sessionId: 'sess-123',
  mode: 'recent', // Only last N memories
  recentMemoriesCount: 50,
});

// CHECKPOINT RESUME: Resume from saved checkpoint
const result = await resumeService.resumeSession({
  sessionId: 'sess-123',
  mode: 'checkpoint',
  checkpointId: 'ckpt-abc123', // Specific checkpoint
});
```

**Checkpoint Management**:

```javascript
// Save checkpoint during workflow
const checkpoint = await resumeService.saveCheckpoint({
  sessionId: 'sess-123',
  workflowId: 'wf-code-quality',
  agentId: 'code-reviewer',
  stepNumber: 5,
  metadata: {
    description: 'After code review completed',
    filesModified: 15,
    issuesFound: 23,
  },
});

console.log(checkpoint);
// {
//   checkpointId: 'ckpt-abc123',
//   timestamp: '2025-01-05T12:34:56Z',
//   memoriesIncluded: 127,
//   entitiesIncluded: 45
// }

// List available checkpoints
const checkpoints = await resumeService.listCheckpoints({
  sessionId: 'sess-123',
  limit: 10,
});

// Resume from specific checkpoint
const result = await resumeService.resumeFromCheckpoint({
  sessionId: 'sess-123',
  checkpointId: 'ckpt-abc123',
});
```

**Resume Validation**:

```javascript
// Verify session can be resumed
const validation = await resumeService.validateResume({
  sessionId: 'sess-123',
});

console.log(validation);
// {
//   canResume: true,
//   memoriesAvailable: 487,
//   entitiesAvailable: 89,
//   lastActivity: '2025-01-05T12:00:00Z',
//   daysSinceLastActivity: 2,
//   warnings: []
// }
```

**Performance Characteristics**:

- Full session restore: <500ms (p95)
- Checkpoint save: <200ms (p95)
- Context injection: <300ms (p95)

### Collaboration Tracking

Collaboration Tracking records all agent-to-agent handoffs and detects circular dependencies that could cause infinite loops or redundant work.

**Collaboration History**:

```javascript
import { createAgentCollaborationManager } from './.claude/tools/memory/agent-collaboration-manager.mjs';

const collaborationManager = createAgentCollaborationManager(db);
await collaborationManager.initialize();

// Get collaboration history for a session
const history = await collaborationManager.getCollaborationHistory('sess-123', {
  limit: 50,
  agentId: 'developer', // Optional: filter by agent
  workflowId: 'wf-code-review', // Optional: filter by workflow
});

console.log(history);
// [
//   {
//     id: 1,
//     sourceAgentId: 'developer',
//     targetAgentId: 'code-reviewer',
//     handoffType: 'sequential',
//     status: 'applied',
//     createdAt: '2025-01-05T10:00:00Z',
//     handoffContext: { memories: [...], entities: [...] }
//   },
//   { ... }
// ]
```

**Circular Dependency Detection**:

The system detects circular handoffs before they cause problems:

```javascript
// Detect circular handoff
const detection = await collaborationManager.detectCircularHandoff(
  'sess-123',
  'developer', // source agent
  'qa' // target agent
);

console.log(detection);
// If circular: {
//   isCircular: true,
//   cycle: ['developer', 'architect', 'qa', 'developer'],
//   message: 'Circular collaboration detected: developer → architect → qa → developer'
// }
//
// If safe: {
//   isCircular: false,
//   chainLength: 3
// }
```

**How Circular Detection Works**:

1. Build graph of all agent handoffs in session
2. Check if adding new handoff (A → B) would create cycle
3. Search for path from B back to A in existing graph
4. If path exists: A → ... → B → A = circular
5. Also warns if chain length exceeds maximum (default: 10)

**Collaboration Statistics**:

```javascript
// Get collaboration statistics
const stats = await collaborationManager.getCollaborationStats('sess-123');

console.log(stats);
// {
//   total_collaborations: 15,
//   unique_source_agents: 5,
//   unique_target_agents: 4,
//   pending_handoffs: 2,
//   applied_handoffs: 12,
//   rejected_handoffs: 1,
//   interactionMatrix: [
//     { sourceAgentId: 'developer', targetAgentId: 'code-reviewer', handoff_count: 5 },
//     { sourceAgentId: 'developer', targetAgentId: 'qa', handoff_count: 3 },
//     { ... }
//   ]
// }
```

**Interaction Matrix Visualization**:

```
┌──────────────────────────────────────────────┐
│  AGENT INTERACTION MATRIX                    │
│                                              │
│          → code-reviewer  qa  architect      │
│  developer        5         3     2          │
│  architect        1         2     -          │
│  qa               -         -     1          │
│                                              │
│  Shows: developer → code-reviewer: 5 handoffs│
└──────────────────────────────────────────────┘
```

**Performance Characteristics**:

- Registration: <10ms
- History retrieval: <50ms
- Circular detection: <100ms (depth 5)
- Statistics: <200ms

### Configuration

Phase 4 is configured via environment variables and initialization options:

**Memory Handoff Service**:

```javascript
const handoffService = createMemoryHandoffService({
  database: db,
  config: {
    maxMemories: 10, // Maximum memories per handoff
    tokenBudget: 5000, // Max tokens for handoff context
    relevanceThreshold: 0.5, // Min score to include memory
    includeEntities: true, // Include entity context
    maxEntities: 20, // Max entities to share
  },
});
```

**Collaboration Manager**:

```javascript
const collaborationManager = createAgentCollaborationManager(db);

// Configure via properties
collaborationManager.config = {
  maxChainLength: 10, // Warn if chain exceeds this
  circularDetectionDepth: 5, // Search depth for cycles
  handoffTTL: 3600000, // Pending handoff expiration (1 hour)
};
```

**Session Resume Service**:

```javascript
const resumeService = createSessionResumeService(db, {
  checkpointInterval: 300000, // Auto-save every 5 min
  retentionDays: 30, // Keep checkpoints 30 days
  maxCheckpointsPerSession: 100, // Limit checkpoints per session
});
```

**Environment Variables**:

```bash
# Enable/disable Phase 4 features
export PHASE4_MEMORY_HANDOFF_ENABLED=true
export PHASE4_ENTITY_REGISTRY_ENABLED=true
export PHASE4_SESSION_RESUME_ENABLED=true

# Performance tuning
export HANDOFF_TOKEN_BUDGET=5000
export HANDOFF_MAX_MEMORIES=10
export COLLABORATION_MAX_CHAIN_LENGTH=10
```

### Best Practices

**When to Use Handoffs**:

1. **Use handoffs** for sequential workflows (developer → QA → code-reviewer)
2. **Use handoffs** when downstream agent needs context from upstream
3. **Don't use handoffs** for independent parallel tasks
4. **Don't use handoffs** for simple, isolated tasks

**Handoff Configuration**:

```javascript
// Small tasks: minimal handoff
const handoff = await handoffService.prepareHandoff({
  sourceAgentId: 'analyzer',
  targetAgentId: 'developer',
  maxMemories: 5, // Small set
  tokenBudget: 2000, // Tight budget
});

// Complex tasks: rich handoff
const handoff = await handoffService.prepareHandoff({
  sourceAgentId: 'architect',
  targetAgentId: 'developer',
  maxMemories: 15, // More memories
  tokenBudget: 8000, // Larger budget
});
```

**Entity Management**:

1. **Create entities early**: Extract entities at task start
2. **Link entities**: Create relationships between related entities
3. **Query entities**: Search by name or type before creating
4. **Monitor entity count**: Track total entities to detect issues

**Session Continuity**:

```javascript
// Save checkpoint at major milestones
await resumeService.saveCheckpoint({
  sessionId: 'sess-123',
  stepNumber: 10,
  metadata: {
    description: 'Architecture designed',
    status: 'milestone_complete',
  },
});

// On resume, restore from last checkpoint
const result = await resumeService.resumeSession({
  sessionId: 'sess-123',
  mode: 'checkpoint', // Resume from saved state
});
```

**Circular Prevention**:

1. **Trust the system**: Circular detection is automatic
2. **Monitor warnings**: Long chains (>8) may indicate issues
3. **Verify workflows**: Ensure workflows don't have redundant loops
4. **Review stats**: Check interaction matrix for unusual patterns

**Memory Sharing Strategy**:

```javascript
// Share context for chained agents
const handoff = await handoffService.prepareHandoff({
  sourceAgentId: 'developer',
  targetAgentId: 'code-reviewer',
  targetTask: 'Review the implementation for security issues',
  // Handoff service automatically:
  // - Scores memories by relevance to security
  // - Includes entity context (frameworks, dependencies)
  // - Respects token budget
});

// Result: code-reviewer gets focused, relevant context
```

### Common Patterns

**Pattern 1: Sequential Workflow with Handoffs**

```javascript
// Developer implements feature → QA tests → Code reviewer reviews

// Step 1: Developer works
// (developer memories accumulate)

// Step 2: Prepare handoff to QA
const qaHandoff = await handoffService.prepareHandoff({
  sessionId: 'sess-123',
  sourceAgentId: 'developer',
  targetAgentId: 'qa',
  targetTask: 'Test the new authentication feature',
});

// Step 3: QA agent receives handoff context
// (QA knows what was implemented)

// Step 4: QA completes tests → Prepare handoff to code-reviewer
const reviewerHandoff = await handoffService.prepareHandoff({
  sessionId: 'sess-123',
  sourceAgentId: 'qa',
  targetAgentId: 'code-reviewer',
  targetTask: 'Review code for best practices',
});
```

**Pattern 2: Entity Tracking Across Workflow**

```javascript
// Team "Frontend" creates React component
const entityId = await entityMemory.createEntity('tool', 'React', {
  version: '18.0',
});

// All agents now see this entity in handoffs
// Entity grows with mentions:
// - developer: "Used React hooks"
// - qa: "Tested React component"
// - code-reviewer: "React best practices applied"
```

**Pattern 3: Long-Running Project Resume**

```javascript
// Day 1: Work progresses to step 5
await resumeService.saveCheckpoint({
  sessionId: 'sess-proj',
  stepNumber: 5,
});
// 50 memories accumulated, 20 entities tracked

// Day 2: Resume from checkpoint
const result = await resumeService.resumeSession({
  sessionId: 'sess-proj',
  mode: 'checkpoint',
  checkpointId: 'ckpt-day1-final',
});

// Agent resumes with full context
// - All 50 memories available
// - All 20 entities present
// - Collaboration history visible
```

**Pattern 4: Circular Prevention in Complex Workflow**

```javascript
// Workflow: developer → architect → developer (potential loop)

// First handoff: developer → architect
const collab1 = await collaborationManager.registerCollaboration({
  sessionId: 'sess-123',
  sourceAgentId: 'developer',
  targetAgentId: 'architect',
});
// OK, no cycle yet

// Second handoff: architect → qa
const collab2 = await collaborationManager.registerCollaboration({
  sessionId: 'sess-123',
  sourceAgentId: 'architect',
  targetAgentId: 'qa',
});
// OK, no cycle

// Attempted third handoff: qa → developer
const detection = await collaborationManager.detectCircularHandoff('sess-123', 'qa', 'developer');
// Result: { isCircular: false, chainLength: 3 }
// OK to proceed

// But if qa → developer → architect (would create cycle)
const detection2 = await collaborationManager.detectCircularHandoff(
  'sess-123',
  'architect',
  'developer' // Already have: developer → architect
);
// Result: { isCircular: true, cycle: ['developer', 'architect', 'developer'] }
// System warns but allows (may be legitimate re-planning)
```

### Database Schema

Phase 4 uses three new tables:

```sql
-- Agent collaborations (handoffs between agents)
CREATE TABLE agent_collaborations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  workflow_id TEXT,
  source_agent_id TEXT NOT NULL,
  target_agent_id TEXT NOT NULL,
  handoff_id TEXT NOT NULL UNIQUE,
  handoff_context TEXT NOT NULL,        -- JSON
  handoff_type TEXT DEFAULT 'sequential', -- sequential, parallel, fork, join
  status TEXT DEFAULT 'pending',        -- pending, applied, rejected
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  applied_at TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Session checkpoints (saved session states)
CREATE TABLE session_checkpoints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  workflow_id TEXT,
  checkpoint_id TEXT NOT NULL UNIQUE,
  step_number INTEGER,
  metadata TEXT,                        -- JSON
  memories_snapshot_count INTEGER,
  entities_snapshot_count INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Agent collaboration indices
CREATE INDEX idx_collaborations_session ON agent_collaborations(session_id);
CREATE INDEX idx_collaborations_agents ON agent_collaborations(source_agent_id, target_agent_id);
CREATE INDEX idx_collaborations_status ON agent_collaborations(status);
CREATE INDEX idx_collaborations_workflow ON agent_collaborations(workflow_id);
CREATE INDEX idx_checkpoints_session ON session_checkpoints(session_id);
CREATE INDEX idx_checkpoints_timestamp ON session_checkpoints(created_at);
```

### Troubleshooting

**Circular Handoff Detected**:

The system allows but warns about circular handoffs. This may be legitimate (e.g., architect revises based on developer feedback) or a workflow issue.

- **If legitimate**: Document in handoff context why the circle is needed
- **If problem**: Restructure workflow to avoid loop

**Handoff Context Too Large**:

If selected memories exceed token budget:

```javascript
// Option 1: Reduce token budget
const handoff = await handoffService.prepareHandoff({
  tokenBudget: 3000, // Reduce from default
});

// Option 2: Reduce max memories
const handoff = await handoffService.prepareHandoff({
  maxMemories: 5, // Share fewer memories
});

// Option 3: Increase threshold (filter low-relevance)
handoffService.config.relevanceThreshold = 0.7; // Higher threshold = fewer memories
```

**Session Resume Not Available**:

- Verify checkpoints exist: `await resumeService.listCheckpoints(sessionId)`
- Check retention period: `export CHECKPOINT_RETENTION_DAYS=30`
- Ensure session data not deleted: Check database for session_id

**Entity Count Exploding**:

Monitor entity growth:

```javascript
// Check entity stats
const stats = await entityMemory.getEntityStats();
console.log(`Total entities: ${stats.totalCount}`);

// If growing too fast, implement cleanup
await entityMemory.deduplicateEntities(); // Merge duplicates
```

## Related Documentation

- [Everlasting Agent System](EVERLASTING_AGENTS.md) - Context window management
- [Phase-Based Projects](PHASE_BASED_PROJECTS.md) - Project structure
- [Context Optimization](CONTEXT_OPTIMIZATION.md) - Context management best practices
