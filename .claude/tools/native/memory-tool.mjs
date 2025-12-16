#!/usr/bin/env node
/**
 * Memory Tool - Native Agent SDK Implementation
 * Long-term memory storage, context retrieval across sessions, and memory search
 * Based on: https://docs.claude.com/en/docs/agents-and-tools/tool-use/memory-tool.md
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const MEMORY_DIR = '.claude/context/memory';
const MEMORY_FILE = join(MEMORY_DIR, 'memories.json');

/**
 * Load memories from disk
 */
async function loadMemories() {
  try {
    if (existsSync(MEMORY_FILE)) {
      const content = await readFile(MEMORY_FILE, 'utf8');
      return JSON.parse(content);
    }
  } catch (error) {
    // File doesn't exist or is invalid, return empty structure
  }
  
  return {
    memories: [],
    metadata: {
      created: new Date().toISOString(),
      last_updated: new Date().toISOString(),
      version: '1.0'
    }
  };
}

/**
 * Save memories to disk
 */
async function saveMemories(data) {
  await mkdir(MEMORY_DIR, { recursive: true });
  data.metadata.last_updated = new Date().toISOString();
  await writeFile(MEMORY_FILE, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Simple text similarity (cosine similarity would be better in production)
 */
function calculateSimilarity(text1, text2) {
  const words1 = text1.toLowerCase().split(/\s+/);
  const words2 = text2.toLowerCase().split(/\s+/);
  const allWords = new Set([...words1, ...words2]);
  
  let intersection = 0;
  for (const word of words1) {
    if (words2.includes(word)) {
      intersection++;
    }
  }
  
  return intersection / allWords.size;
}

/**
 * Store a memory
 */
export async function storeMemory(input, context = {}) {
  const {
    content,
    tags = [],
    importance = 'medium',
    expires_at = null,
    metadata = {}
  } = input;

  const data = await loadMemories();
  
  const memory = {
    id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    content,
    tags,
    importance,
    created_at: new Date().toISOString(),
    expires_at,
    metadata: {
      ...metadata,
      agent: context.agent || 'unknown',
      session: context.session || 'unknown'
    }
  };

  data.memories.push(memory);
  await saveMemories(data);

  return {
    success: true,
    memory_id: memory.id,
    stored_at: memory.created_at
  };
}

/**
 * Retrieve memories
 */
export async function retrieveMemories(input, context = {}) {
  const {
    query = null,
    tags = [],
    limit = 10,
    importance = null,
    since = null
  } = input;

  const data = await loadMemories();
  let results = [...data.memories];

  // Filter by expiration
  const now = new Date();
  results = results.filter(m => !m.expires_at || new Date(m.expires_at) > now);

  // Filter by tags
  if (tags.length > 0) {
    results = results.filter(m => 
      tags.some(tag => m.tags.includes(tag))
    );
  }

  // Filter by importance
  if (importance) {
    results = results.filter(m => m.importance === importance);
  }

  // Filter by date
  if (since) {
    const sinceDate = new Date(since);
    results = results.filter(m => new Date(m.created_at) >= sinceDate);
  }

  // Search by query
  if (query) {
    results = results.map(m => ({
      ...m,
      similarity: calculateSimilarity(query, m.content)
    })).filter(m => m.similarity > 0.1)
      .sort((a, b) => b.similarity - a.similarity);
  } else {
    // Sort by creation date (newest first)
    results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  // Apply limit
  results = results.slice(0, limit);

  return {
    success: true,
    memories: results.map(m => ({
      id: m.id,
      content: m.content,
      tags: m.tags,
      importance: m.importance,
      created_at: m.created_at,
      metadata: m.metadata,
      similarity: m.similarity
    })),
    total_found: results.length
  };
}

/**
 * Delete a memory
 */
export async function deleteMemory(input, context = {}) {
  const { memory_id } = input;

  const data = await loadMemories();
  const initialLength = data.memories.length;
  
  data.memories = data.memories.filter(m => m.id !== memory_id);
  
  if (data.memories.length < initialLength) {
    await saveMemories(data);
    return {
      success: true,
      deleted: true,
      memory_id
    };
  }

  return {
    success: false,
    deleted: false,
    error: 'Memory not found',
    memory_id
  };
}

/**
 * Update a memory
 */
export async function updateMemory(input, context = {}) {
  const {
    memory_id,
    content = null,
    tags = null,
    importance = null,
    metadata = null
  } = input;

  const data = await loadMemories();
  const memory = data.memories.find(m => m.id === memory_id);

  if (!memory) {
    return {
      success: false,
      error: 'Memory not found',
      memory_id
    };
  }

  if (content !== null) memory.content = content;
  if (tags !== null) memory.tags = tags;
  if (importance !== null) memory.importance = importance;
  if (metadata !== null) memory.metadata = { ...memory.metadata, ...metadata };

  memory.updated_at = new Date().toISOString();
  await saveMemories(data);

  return {
    success: true,
    memory_id,
    updated_at: memory.updated_at
  };
}

/**
 * Tool definition for Agent SDK
 */
export const memoryTool = {
  name: 'memory',
  description: 'Store and retrieve long-term memories across sessions',
  inputSchema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['store', 'retrieve', 'delete', 'update'],
        description: 'Memory operation to perform'
      },
      // Store operation
      content: { type: 'string', description: 'Memory content to store' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Tags for categorization' },
      importance: { type: 'string', enum: ['low', 'medium', 'high'], default: 'medium' },
      expires_at: { type: 'string', description: 'ISO timestamp when memory expires' },
      metadata: { type: 'object', description: 'Additional metadata' },
      // Retrieve operation
      query: { type: 'string', description: 'Search query for memories' },
      limit: { type: 'number', default: 10, description: 'Maximum number of results' },
      since: { type: 'string', description: 'ISO timestamp to filter memories' },
      // Delete/Update operations
      memory_id: { type: 'string', description: 'Memory ID to delete or update' }
    },
    required: ['operation']
  },
  outputSchema: {
    type: 'object',
    properties: {
      success: {
        type: 'boolean',
        description: 'Whether the memory operation succeeded'
      },
      memory_id: {
        type: 'string',
        description: 'Memory ID (for store, update, delete operations)'
      },
      stored_at: {
        type: 'string',
        description: 'ISO timestamp when memory was stored'
      },
      updated_at: {
        type: 'string',
        description: 'ISO timestamp when memory was updated'
      },
      memories: {
        type: 'array',
        description: 'Array of retrieved memories (for retrieve operation)',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            content: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
            importance: { type: 'string', enum: ['low', 'medium', 'high'] },
            created_at: { type: 'string' },
            expires_at: { type: ['string', 'null'] },
            metadata: { type: 'object' },
            similarity: { type: 'number' }
          }
        }
      },
      count: {
        type: 'number',
        description: 'Number of memories retrieved'
      },
      error: {
        type: 'string',
        description: 'Error message if operation failed'
      }
    },
    required: ['success']
  },
  execute: async (input, context) => {
    const { operation, ...params } = input;

    switch (operation) {
      case 'store':
        return storeMemory(params, context);
      case 'retrieve':
        return retrieveMemories(params, context);
      case 'delete':
        return deleteMemory(params, context);
      case 'update':
        return updateMemory(params, context);
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }
};

export default memoryTool;

