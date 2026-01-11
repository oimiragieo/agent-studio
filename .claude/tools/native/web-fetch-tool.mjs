#!/usr/bin/env node
/**
 * Web Fetch Tool - Native Agent SDK Implementation
 * HTTP/HTTPS requests with security, content extraction, rate limiting, and caching
 * Based on: https://docs.claude.com/en/docs/agents-and-tools/tool-use/web-fetch-tool.md
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

// Simple in-memory cache (could be replaced with Redis in production)
const cache = new Map();
const CACHE_DIR = '.claude/cache/web-fetch';
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 60;
const requestHistory = [];

/**
 * Check rate limits
 */
function checkRateLimit() {
  const now = Date.now();
  const recentRequests = requestHistory.filter(t => now - t < RATE_LIMIT_WINDOW);

  if (recentRequests.length >= MAX_REQUESTS_PER_WINDOW) {
    throw new Error(`Rate limit exceeded: ${MAX_REQUESTS_PER_WINDOW} requests per minute`);
  }

  requestHistory.push(now);
  // Clean old entries
  while (requestHistory.length > 0 && now - requestHistory[0] > RATE_LIMIT_WINDOW) {
    requestHistory.shift();
  }
}

/**
 * Generate cache key
 */
function getCacheKey(url, options = {}) {
  return `${url}:${JSON.stringify(options)}`;
}

/**
 * Get cached response
 */
async function getCached(url, options) {
  const cacheKey = getCacheKey(url, options);
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < (options.cache_ttl || 300000)) {
    return cached.data;
  }

  return null;
}

/**
 * Set cached response
 */
function setCached(url, options, data) {
  const cacheKey = getCacheKey(url, options);
  cache.set(cacheKey, {
    data,
    timestamp: Date.now(),
  });
}

/**
 * Fetch URL with security and caching
 */
export async function fetchUrl(input, context = {}) {
  const {
    url,
    method = 'GET',
    headers = {},
    body = null,
    timeout = 30000,
    follow_redirects = true,
    max_redirects = 5,
    cache_ttl = 300000, // 5 minutes default
    use_cache = true,
  } = input;

  // Validate URL
  try {
    new URL(url);
  } catch (error) {
    throw new Error(`Invalid URL: ${url}`);
  }

  // Security: Block localhost and private IPs unless explicitly allowed
  const urlObj = new URL(url);
  if (
    urlObj.hostname === 'localhost' ||
    urlObj.hostname === '127.0.0.1' ||
    urlObj.hostname.startsWith('192.168.') ||
    urlObj.hostname.startsWith('10.')
  ) {
    if (!context.allow_localhost) {
      throw new Error('Access to localhost and private IPs is blocked for security');
    }
  }

  // Check rate limits
  checkRateLimit();

  // Check cache
  if (use_cache) {
    const cached = await getCached(url, { method, headers, body, cache_ttl });
    if (cached) {
      return {
        ...cached,
        cached: true,
      };
    }
  }

  // Perform fetch
  try {
    const fetchOptions = {
      method,
      headers: {
        'User-Agent': 'Claude-Agent/1.0',
        ...headers,
      },
      signal: AbortSignal.timeout(timeout),
    };

    if (body) {
      fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
      if (!headers['Content-Type']) {
        fetchOptions.headers['Content-Type'] = 'application/json';
      }
    }

    const response = await fetch(url, fetchOptions);

    // Handle redirects
    if (follow_redirects && response.status >= 300 && response.status < 400) {
      if (max_redirects <= 0) {
        throw new Error('Maximum redirects exceeded');
      }
      const location = response.headers.get('location');
      if (location) {
        return fetchUrl(
          {
            ...input,
            url: new URL(location, url).href,
            max_redirects: max_redirects - 1,
          },
          context
        );
      }
    }

    const contentType = response.headers.get('content-type') || '';
    let content;

    if (contentType.includes('application/json')) {
      content = await response.json();
    } else if (contentType.includes('text/')) {
      content = await response.text();
    } else {
      content = await response.arrayBuffer();
      content = Buffer.from(content).toString('base64');
    }

    const result = {
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      content,
      contentType,
      url: response.url,
      cached: false,
    };

    // Cache successful responses
    if (use_cache && response.ok) {
      setCached(url, { method, headers, body, cache_ttl }, result);
    }

    return result;
  } catch (error) {
    return {
      success: false,
      error: error.message,
      url,
      cached: false,
    };
  }
}

/**
 * Tool definition for Agent SDK
 */
export const webFetchTool = {
  name: 'web_fetch',
  description: 'Fetch URLs with security, rate limiting, and caching',
  inputSchema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'URL to fetch',
      },
      method: {
        type: 'string',
        enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        default: 'GET',
      },
      headers: {
        type: 'object',
        description: 'HTTP headers',
      },
      body: {
        oneOf: [{ type: 'string' }, { type: 'object' }],
        description: 'Request body',
      },
      timeout: {
        type: 'number',
        description: 'Timeout in milliseconds',
        default: 30000,
      },
      follow_redirects: {
        type: 'boolean',
        default: true,
      },
      max_redirects: {
        type: 'number',
        default: 5,
      },
      cache_ttl: {
        type: 'number',
        description: 'Cache TTL in milliseconds',
        default: 300000,
      },
      use_cache: {
        type: 'boolean',
        default: true,
      },
    },
    required: ['url'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      success: {
        type: 'boolean',
        description: 'Whether the fetch request succeeded',
      },
      status: {
        type: 'number',
        description: 'HTTP status code',
      },
      statusText: {
        type: 'string',
        description: 'HTTP status text',
      },
      headers: {
        type: 'object',
        description: 'HTTP response headers',
        additionalProperties: { type: 'string' },
      },
      content: {
        oneOf: [{ type: 'string' }, { type: 'object' }],
        description: 'Response content (parsed JSON or text)',
      },
      contentType: {
        type: 'string',
        description: 'Content-Type header value',
      },
      url: {
        type: 'string',
        description: 'Final URL after redirects',
      },
      cached: {
        type: 'boolean',
        description: 'Whether response was served from cache',
      },
      error: {
        type: 'string',
        description: 'Error message if request failed',
      },
    },
    required: ['success', 'url', 'cached'],
  },
  execute: fetchUrl,
};

export default webFetchTool;
