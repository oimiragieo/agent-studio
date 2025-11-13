/**
 * Memory Tool - Persistent key-value storage for agents
 *
 * Features:
 * - Key-value storage with namespaces
 * - TTL support
 * - Search and filtering
 * - Persistence to disk
 */

import { z } from 'zod';
import type { Tool, ToolResult } from '@anthropic-ai/claude-agent-sdk';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export const MemoryInputSchema = z.object({
  operation: z.enum(['set', 'get', 'delete', 'list', 'search']),
  key: z.string().optional(),
  value: z.any().optional(),
  namespace: z.string().optional().default('default'),
  ttl: z.number().optional(),
  query: z.string().optional(),
});

export type MemoryInput = z.infer<typeof MemoryInputSchema>;

interface MemoryEntry {
  value: unknown;
  timestamp: number;
  ttl?: number;
}

export class MemoryTool implements Tool<MemoryInput, string> {
  name = 'memory';
  description = 'Store and retrieve information across conversation turns with namespaces and TTL support';
  input_schema = {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['set', 'get', 'delete', 'list', 'search'] },
      key: { type: 'string' },
      value: { description: 'Value to store (any JSON-serializable data)' },
      namespace: { type: 'string', default: 'default' },
      ttl: { type: 'number', description: 'Time to live in seconds' },
      query: { type: 'string', description: 'Search query' },
    },
    required: ['operation'],
  };

  private storage = new Map<string, Map<string, MemoryEntry>>();
  private persistPath?: string;

  constructor(config: { persistPath?: string } = {}) {
    this.persistPath = config.persistPath;
    if (this.persistPath) {
      this.load().catch(console.error);
    }
  }

  async handler(input: MemoryInput): Promise<ToolResult> {
    try {
      const validated = MemoryInputSchema.parse(input);
      const namespace = this.getNamespace(validated.namespace);

      switch (validated.operation) {
        case 'set':
          if (!validated.key || validated.value === undefined) {
            throw new Error('key and value required for set operation');
          }
          return await this.set(namespace, validated.key, validated.value, validated.ttl);
        case 'get':
          if (!validated.key) throw new Error('key required for get operation');
          return this.get(namespace, validated.key);
        case 'delete':
          if (!validated.key) throw new Error('key required for delete operation');
          return this.delete(namespace, validated.key);
        case 'list':
          return this.list(namespace);
        case 'search':
          if (!validated.query) throw new Error('query required for search operation');
          return this.search(namespace, validated.query);
        default:
          throw new Error(`Unknown operation: ${validated.operation}`);
      }
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        is_error: true,
      };
    }
  }

  private async set(namespace: Map<string, MemoryEntry>, key: string, value: unknown, ttl?: number): Promise<ToolResult> {
    namespace.set(key, {
      value,
      timestamp: Date.now(),
      ttl: ttl ? ttl * 1000 : undefined,
    });

    if (this.persistPath) {
      await this.save();
    }

    return {
      content: [{ type: 'text', text: `Stored value for key "${key}"${ttl ? ` with TTL of ${ttl}s` : ''}` }],
    };
  }

  private get(namespace: Map<string, MemoryEntry>, key: string): ToolResult {
    const entry = namespace.get(key);

    if (!entry) {
      return {
        content: [{ type: 'text', text: `No value found for key "${key}"` }],
        is_error: true,
      };
    }

    // Check TTL
    if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
      namespace.delete(key);
      return {
        content: [{ type: 'text', text: `Key "${key}" has expired` }],
        is_error: true,
      };
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(entry.value, null, 2) }],
    };
  }

  private delete(namespace: Map<string, MemoryEntry>, key: string): ToolResult {
    const deleted = namespace.delete(key);

    if (this.persistPath) {
      this.save().catch(console.error);
    }

    return {
      content: [{ type: 'text', text: deleted ? `Deleted key "${key}"` : `Key "${key}" not found` }],
    };
  }

  private list(namespace: Map<string, MemoryEntry>): ToolResult {
    const keys = Array.from(namespace.keys());

    return {
      content: [
        {
          type: 'text',
          text: keys.length > 0 ? `Keys: ${keys.join(', ')}` : 'No keys stored',
        },
      ],
    };
  }

  private search(namespace: Map<string, MemoryEntry>, query: string): ToolResult {
    const matches: string[] = [];

    for (const [key, entry] of namespace.entries()) {
      const valueStr = JSON.stringify(entry.value).toLowerCase();
      if (key.toLowerCase().includes(query.toLowerCase()) || valueStr.includes(query.toLowerCase())) {
        matches.push(key);
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: matches.length > 0 ? `Matching keys: ${matches.join(', ')}` : 'No matches found',
        },
      ],
    };
  }

  private getNamespace(name: string): Map<string, MemoryEntry> {
    if (!this.storage.has(name)) {
      this.storage.set(name, new Map());
    }
    return this.storage.get(name)!;
  }

  private async save(): Promise<void> {
    if (!this.persistPath) return;

    const data: Record<string, Record<string, MemoryEntry>> = {};

    for (const [namespace, entries] of this.storage.entries()) {
      data[namespace] = Object.fromEntries(entries);
    }

    await mkdir(join(this.persistPath, '..'), { recursive: true });
    await writeFile(this.persistPath, JSON.stringify(data, null, 2), 'utf-8');
  }

  private async load(): Promise<void> {
    if (!this.persistPath) return;

    try {
      const data = JSON.parse(await readFile(this.persistPath, 'utf-8'));

      for (const [namespace, entries] of Object.entries(data)) {
        this.storage.set(namespace, new Map(Object.entries(entries as Record<string, MemoryEntry>)));
      }
    } catch (error) {
      // File doesn't exist or is invalid, start fresh
    }
  }
}

export function createMemoryTool(config?: { persistPath?: string }) {
  return new MemoryTool(config);
}
