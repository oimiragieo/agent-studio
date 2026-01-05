---
name: memory
description: Persistent knowledge graph memory system. Store and retrieve entities, relations, and observations across conversations. Use for maintaining user context, preferences, and learned patterns.
allowed-tools: read, write, bash
version: 1.0
best_practices:
  - Create entities for important people, organizations, and concepts
  - Use relations to capture connections between entities
  - Add observations as discrete, atomic facts
  - Search before creating to avoid duplicates
  - Use active voice for relations
error_handling: graceful
streaming: supported
---

# Memory Skill

## Overview

This skill provides persistent memory using a local knowledge graph. It enables Claude to retain information about users, topics, and patterns across conversations through three core components:

- **Entities**: Primary nodes representing people, organizations, or concepts
- **Relations**: Directed connections between entities (stored in active voice)
- **Observations**: Discrete, atomic facts attached to specific entities

**Context Savings**: ~95% reduction
- **MCP Mode**: ~12,000 tokens always loaded
- **Skill Mode**: ~400 tokens metadata + on-demand loading

## When to Use

- Remembering user preferences and context across sessions
- Tracking relationships between people and organizations
- Storing learned patterns and insights
- Building knowledge graphs about domains
- Maintaining conversation context over time

## Quick Reference

```bash
# List available tools
python executor.py --list

# Create an entity
python executor.py --tool create_entities --args '{"entities": [{"name": "John", "entityType": "person", "observations": ["Works at Acme Corp"]}]}'

# Search for entities
python executor.py --tool search_nodes --args '{"query": "John"}'

# Read entire graph
python executor.py --tool read_graph --args '{}'
```

## Tools

### create_entities

Create new entities in the knowledge graph.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `entities` | array | Array of entity objects |

**Entity Object:**

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Unique identifier for the entity |
| `entityType` | string | Type classification (person, organization, concept, etc.) |
| `observations` | array | Initial observations about the entity |

**Example:**
```bash
python executor.py --tool create_entities --args '{
  "entities": [
    {
      "name": "Alice",
      "entityType": "person",
      "observations": ["Software engineer", "Works on AI projects"]
    }
  ]
}'
```

### create_relations

Create relations between existing entities.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `relations` | array | Array of relation objects |

**Relation Object:**

| Field | Type | Description |
|-------|------|-------------|
| `from` | string | Source entity name |
| `to` | string | Target entity name |
| `relationType` | string | Type of relationship (active voice) |

**Example:**
```bash
python executor.py --tool create_relations --args '{
  "relations": [
    {
      "from": "Alice",
      "to": "Acme Corp",
      "relationType": "works_at"
    }
  ]
}'
```

### add_observations

Add new observations to existing entities.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `observations` | array | Array of observation objects |

**Observation Object:**

| Field | Type | Description |
|-------|------|-------------|
| `entityName` | string | Name of entity to add observations to |
| `contents` | array | New observations to add |

**Example:**
```bash
python executor.py --tool add_observations --args '{
  "observations": [
    {
      "entityName": "Alice",
      "contents": ["Prefers TypeScript over JavaScript"]
    }
  ]
}'
```

### delete_entities

Delete entities and their associated relations.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `entityNames` | array | Names of entities to delete |

**Example:**
```bash
python executor.py --tool delete_entities --args '{
  "entityNames": ["OldEntity"]
}'
```

### delete_observations

Delete specific observations from entities.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `deletions` | array | Array of deletion objects |

**Deletion Object:**

| Field | Type | Description |
|-------|------|-------------|
| `entityName` | string | Name of entity |
| `observations` | array | Specific observations to delete |

**Example:**
```bash
python executor.py --tool delete_observations --args '{
  "deletions": [
    {
      "entityName": "Alice",
      "observations": ["Outdated info"]
    }
  ]
}'
```

### delete_relations

Delete specific relations between entities.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `relations` | array | Array of relation objects to delete |

**Example:**
```bash
python executor.py --tool delete_relations --args '{
  "relations": [
    {
      "from": "Alice",
      "to": "OldCompany",
      "relationType": "worked_at"
    }
  ]
}'
```

### read_graph

Read the entire knowledge graph.

**Parameters:** None

**Example:**
```bash
python executor.py --tool read_graph --args '{}'
```

**Returns:**
```json
{
  "entities": [
    {
      "name": "Alice",
      "entityType": "person",
      "observations": ["Software engineer"]
    }
  ],
  "relations": [
    {
      "from": "Alice",
      "to": "Acme Corp",
      "relationType": "works_at"
    }
  ]
}
```

### search_nodes

Search for entities by name, type, or observation content.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `query` | string | Search query string |

**Example:**
```bash
python executor.py --tool search_nodes --args '{"query": "software engineer"}'
```

### open_nodes

Open specific entities by name.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `names` | array | Names of entities to retrieve |

**Example:**
```bash
python executor.py --tool open_nodes --args '{"names": ["Alice", "Bob"]}'
```

## Usage Strategy

The recommended approach for using memory:

1. **Identify User**: Create an entity for the user if not exists
2. **Retrieve Memories**: At conversation start, search for user's entity
3. **Track Information**: As you learn new things, categorize by:
   - Identity (name, preferences, background)
   - Behaviors (patterns, habits, workflows)
   - Preferences (likes, dislikes, choices)
   - Goals (objectives, targets, aspirations)
   - Relationships (connections to other entities)
4. **Update Graph**: Add observations and relations as you learn

## Best Practices

### Entity Design

- **Unique Names**: Use specific, unique names for entities
- **Clear Types**: Use consistent entity types (person, organization, project, concept)
- **Atomic Observations**: Keep observations discrete and fact-based

### Relation Design

- **Active Voice**: Always use active voice for relations ("works_at" not "is_employed_by")
- **Bidirectional**: Consider if both directions are needed
- **Typed**: Use consistent relation types

### Maintenance

- **Search First**: Before creating, search for existing entities
- **Prune Stale Data**: Delete outdated observations
- **Update Relations**: Keep relations current

## Configuration

MCP server configuration stored in `config.json`:
- **Command**: `npx -y @modelcontextprotocol/server-memory`
- **Environment**: `MEMORY_FILE_PATH` for custom storage location

### Custom Storage Location

```json
{
  "env": {
    "MEMORY_FILE_PATH": "/path/to/memory.json"
  }
}
```

## Integration

### With Memory Manager Skill

This skill works alongside the `memory-manager` skill:
- **memory**: Low-level knowledge graph operations
- **memory-manager**: High-level patterns for dual persistence

### With Agents

All agents can use memory to:
- Store learned patterns
- Track user preferences
- Remember decisions and rationale
- Build domain knowledge

## Error Handling

**Common Issues:**
- Entity not found: Search first, create if needed
- Duplicate entity: Use unique names or merge observations
- Relation invalid: Both entities must exist

**Recovery:**
- Read graph to verify state
- Delete and recreate if corrupted
- Use search to find correct entity names

## Related

- Original MCP server: `@modelcontextprotocol/server-memory`
- Memory Manager Skill: `.claude/skills/memory-manager/`
- MCP Converter Skill: `.claude/skills/mcp-converter/`
