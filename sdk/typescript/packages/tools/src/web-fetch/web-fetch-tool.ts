/**
 * Web Fetch Tool - HTTP requests with AI processing
 *
 * Features:
 * - HTTP/HTTPS requests
 * - HTML to Markdown conversion
 * - Response caching (15 min)
 * - Security validat ion
 */

import fetch from 'node-fetch';
import TurndownService from 'turndown';
import * as cheerio from 'cheerio';
import { z } from 'zod';
import type { Tool, ToolResult } from '@anthropic-ai/claude-agent-sdk';

export const WebFetchInputSchema = z.object({
  url: z.string().url(),
  prompt: z.string(),
  headers: z.record(z.string()).optional(),
});

export type WebFetchInput = z.infer<typeof WebFetchInputSchema>;

interface CacheEntry {
  content: string;
  timestamp: number;
}

export class WebFetchTool implements Tool<WebFetchInput, string> {
  name = 'web_fetch';
  description = 'Fetch and process web content with AI analysis. Converts HTML to markdown and applies your prompt.';
  input_schema = {
    type: 'object',
    properties: {
      url: { type: 'string', format: 'uri' },
      prompt: { type: 'string', description: 'What information to extract from the page' },
      headers: { type: 'object', additionalProperties: { type: 'string' } },
    },
    required: ['url', 'prompt'],
  };

  private cache = new Map<string, CacheEntry>();
  private turndown = new TurndownService();
  private readonly CACHE_TTL = 15 * 60 * 1000; // 15 minutes

  constructor(private config: { maxSize?: number; timeout?: number } = {}) {
    this.config.maxSize = config.maxSize || 5 * 1024 * 1024; // 5MB
    this.config.timeout = config.timeout || 30000; // 30s
  }

  async handler(input: WebFetchInput): Promise<ToolResult> {
    try {
      const validated = WebFetchInputSchema.parse(input);

      // Check cache
      const cached = this.getFromCache(validated.url);
      if (cached) {
        return this.processContent(cached, validated.prompt);
      }

      // Fetch content
      const response = await fetch(validated.url, {
        headers: {
          'User-Agent': 'Claude-Agent-SDK/1.0',
          ...validated.headers,
        },
        timeout: this.config.timeout,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Check size
      const contentLength = parseInt(response.headers.get('content-length') || '0');
      if (contentLength > this.config.maxSize!) {
        throw new Error(`Content too large: ${contentLength} bytes (max: ${this.config.maxSize})`);
      }

      const html = await response.text();

      // Convert to markdown
      const $ = cheerio.load(html);
      $('script, style, nav, footer, aside').remove(); // Remove non-content elements
      const markdown = this.turndown.turndown($.html());

      // Cache result
      this.addToCache(validated.url, markdown);

      return this.processContent(markdown, validated.prompt);
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        is_error: true,
      };
    }
  }

  private processContent(content: string, prompt: string): ToolResult {
    // In production, this would call Claude to process the content
    // For now, return the content with the prompt
    return {
      content: [
        {
          type: 'text',
          text: `Content fetched successfully. Prompt: "${prompt}"\n\n${content.substring(0, 2000)}...`,
        },
      ],
    };
  }

  private getFromCache(url: string): string | null {
    const entry = this.cache.get(url);
    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    if (age > this.CACHE_TTL) {
      this.cache.delete(url);
      return null;
    }

    return entry.content;
  }

  private addToCache(url: string, content: string): void {
    this.cache.set(url, { content, timestamp: Date.now() });

    // Cleanup old entries
    if (this.cache.size > 100) {
      const oldest = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
      if (oldest) {
        this.cache.delete(oldest[0]);
      }
    }
  }
}

export function createWebFetchTool(config?: { maxSize?: number; timeout?: number }) {
  return new WebFetchTool(config);
}
