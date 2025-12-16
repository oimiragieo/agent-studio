#!/usr/bin/env node
/**
 * Web Search Tool - Native Agent SDK Implementation
 * Search integration with result ranking, filtering, and citation tracking
 * Based on: https://docs.claude.com/en/docs/agents-and-tools/tool-use/web-search-tool.md
 */

import { webFetchTool } from './web-fetch-tool.mjs';

// Search providers configuration
const SEARCH_PROVIDERS = {
  exa: {
    name: 'Exa',
    apiKey: process.env.EXA_API_KEY,
    endpoint: 'https://api.exa.ai/search'
  },
  google: {
    name: 'Google',
    apiKey: process.env.GOOGLE_SEARCH_API_KEY,
    endpoint: 'https://www.googleapis.com/customsearch/v1'
  },
  duckduckgo: {
    name: 'DuckDuckGo',
    endpoint: 'https://api.duckduckgo.com/'
  }
};

/**
 * Search using Exa API
 */
async function searchExa(query, options = {}) {
  const provider = SEARCH_PROVIDERS.exa;
  if (!provider.apiKey) {
    throw new Error('EXA_API_KEY not configured');
  }

  const response = await fetch(provider.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': provider.apiKey
    },
    body: JSON.stringify({
      query,
      num_results: options.num_results || 10,
      type: options.type || 'neural',
      use_autoprompt: options.use_autoprompt !== false
    })
  });

  if (!response.ok) {
    throw new Error(`Exa API error: ${response.statusText}`);
  }

  const data = await response.json();
  
  return {
    provider: 'exa',
    query,
    results: data.results.map((result, index) => ({
      title: result.title,
      url: result.url,
      snippet: result.text || result.snippet,
      score: result.score || (1 - index * 0.1),
      published_date: result.published_date,
      author: result.author,
      index: index + 1
    })),
    total_results: data.results.length
  };
}

/**
 * Search using Google Custom Search API
 */
async function searchGoogle(query, options = {}) {
  const provider = SEARCH_PROVIDERS.google;
  if (!provider.apiKey) {
    throw new Error('GOOGLE_SEARCH_API_KEY not configured');
  }

  const cx = process.env.GOOGLE_SEARCH_ENGINE_ID;
  if (!cx) {
    throw new Error('GOOGLE_SEARCH_ENGINE_ID not configured');
  }

  const params = new URLSearchParams({
    key: provider.apiKey,
    cx,
    q: query,
    num: (options.num_results || 10).toString()
  });

  const response = await fetch(`${provider.endpoint}?${params}`);
  
  if (!response.ok) {
    throw new Error(`Google API error: ${response.statusText}`);
  }

  const data = await response.json();
  
  return {
    provider: 'google',
    query,
    results: (data.items || []).map((item, index) => ({
      title: item.title,
      url: item.link,
      snippet: item.snippet,
      score: 1 - index * 0.1,
      index: index + 1
    })),
    total_results: parseInt(data.searchInformation?.totalResults || '0', 10)
  };
}

/**
 * Search using DuckDuckGo (no API key required)
 */
async function searchDuckDuckGo(query, options = {}) {
  const provider = SEARCH_PROVIDERS.duckduckgo;
  
  // DuckDuckGo HTML scraping (simplified - production should use proper API)
  const params = new URLSearchParams({ q: query });
  const response = await fetch(`${provider.endpoint}?${params}`);
  const html = await response.text();
  
  // Simple extraction (production should use proper HTML parsing)
  const results = [];
  const linkRegex = /<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
  let match;
  let count = 0;
  
  while ((match = linkRegex.exec(html)) !== null && count < (options.num_results || 10)) {
    const url = match[1];
    const title = match[2];
    
    if (url.startsWith('http') && !url.includes('duckduckgo.com')) {
      results.push({
        title: title.trim(),
        url,
        snippet: '',
        score: 1 - count * 0.1,
        index: count + 1
      });
      count++;
    }
  }
  
  return {
    provider: 'duckduckgo',
    query,
    results,
    total_results: results.length
  };
}

/**
 * Perform web search
 */
export async function searchWeb(input, context = {}) {
  const {
    query,
    provider = 'exa',
    num_results = 10,
    filter_domains = [],
    exclude_domains = [],
    date_range = null,
    language = 'en'
  } = input;

  if (!query || typeof query !== 'string') {
    throw new Error('Query is required and must be a string');
  }

  let searchResult;

  try {
    switch (provider.toLowerCase()) {
      case 'exa':
        searchResult = await searchExa(query, { num_results, date_range, language });
        break;
      case 'google':
        searchResult = await searchGoogle(query, { num_results });
        break;
      case 'duckduckgo':
        searchResult = await searchDuckDuckGo(query, { num_results });
        break;
      default:
        throw new Error(`Unsupported provider: ${provider}. Supported: exa, google, duckduckgo`);
    }

    // Filter results
    if (filter_domains.length > 0) {
      searchResult.results = searchResult.results.filter(r => 
        filter_domains.some(domain => r.url.includes(domain))
      );
    }

    if (exclude_domains.length > 0) {
      searchResult.results = searchResult.results.filter(r => 
        !exclude_domains.some(domain => r.url.includes(domain))
      );
    }

    // Add citations
    searchResult.citations = searchResult.results.map(r => ({
      url: r.url,
      title: r.title,
      snippet: r.snippet
    }));

    return searchResult;
  } catch (error) {
    return {
      success: false,
      error: error.message,
      query,
      provider
    };
  }
}

/**
 * Tool definition for Agent SDK
 */
export const webSearchTool = {
  name: 'web_search',
  description: 'Search the web with result ranking, filtering, and citation tracking',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query'
      },
      provider: {
        type: 'string',
        enum: ['exa', 'google', 'duckduckgo'],
        default: 'exa',
        description: 'Search provider to use'
      },
      num_results: {
        type: 'number',
        default: 10,
        description: 'Number of results to return'
      },
      filter_domains: {
        type: 'array',
        items: { type: 'string' },
        description: 'Filter results to specific domains'
      },
      exclude_domains: {
        type: 'array',
        items: { type: 'string' },
        description: 'Exclude results from specific domains'
      },
      date_range: {
        type: 'object',
        properties: {
          start: { type: 'string' },
          end: { type: 'string' }
        },
        description: 'Date range for results'
      },
      language: {
        type: 'string',
        default: 'en',
        description: 'Language code for results'
      }
    },
    required: ['query']
  },
  outputSchema: {
    type: 'object',
    properties: {
      success: {
        type: 'boolean',
        description: 'Whether the search succeeded'
      },
      provider: {
        type: 'string',
        enum: ['exa', 'google', 'duckduckgo'],
        description: 'Search provider used'
      },
      query: {
        type: 'string',
        description: 'Search query that was executed'
      },
      results: {
        type: 'array',
        description: 'Array of search results',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            url: { type: 'string' },
            snippet: { type: 'string' },
            score: { type: 'number' },
            index: { type: 'number' },
            published_date: { type: ['string', 'null'] },
            author: { type: ['string', 'null'] }
          },
          required: ['title', 'url', 'snippet', 'score', 'index']
        }
      },
      total_results: {
        type: 'number',
        description: 'Total number of results available'
      },
      citations: {
        type: 'array',
        description: 'Array of citations for the results',
        items: {
          type: 'object',
          properties: {
            url: { type: 'string' },
            title: { type: 'string' },
            snippet: { type: 'string' }
          }
        }
      },
      error: {
        type: 'string',
        description: 'Error message if search failed'
      }
    },
    required: ['success', 'provider', 'query', 'results', 'total_results']
  },
  execute: searchWeb
};

export default webSearchTool;

