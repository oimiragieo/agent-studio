/**
 * Discovery Endpoint
 *
 * HTTP server serving AgentCards at /.well-known/agent-card.json
 * Supports caching, feature flag gating, and comprehensive error handling.
 *
 * @module discovery-endpoint
 */

import http from 'http';
import { generateAllAgentCards, clearCache } from './agent-card-generator.mjs';
import { isEnabled } from '../feature-flags-manager.mjs';

// Response cache (5 minute TTL)
const CACHE_TTL_MS = 5 * 60 * 1000;
let responseCache = null;
let cacheTimestamp = null;

/**
 * Serve AgentCards at /.well-known/agent-card.json
 * @param {http.IncomingMessage} req - HTTP request
 * @param {http.ServerResponse} res - HTTP response
 * @param {Object} options - Server options
 */
export function serveAgentCards(req, res, options = {}) {
  const env = options.env || process.env.NODE_ENV || 'dev';
  const startTime = Date.now();

  // Feature flag check
  if (!isEnabled('agent_card_discovery', env)) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        error: 'Service Unavailable',
        message: 'AgentCard discovery is currently disabled',
        code: 'FEATURE_DISABLED',
      })
    );
    return;
  }

  // Method check
  if (req.method !== 'GET') {
    res.writeHead(405, {
      'Content-Type': 'application/json',
      Allow: 'GET',
    });
    res.end(
      JSON.stringify({
        error: 'Method Not Allowed',
        message: 'Only GET requests are supported',
        code: 'METHOD_NOT_ALLOWED',
      })
    );
    return;
  }

  try {
    // Check cache
    const now = Date.now();
    const cacheValid = responseCache && cacheTimestamp && now - cacheTimestamp < CACHE_TTL_MS;

    let agentCards;
    let cacheHit = false;

    if (cacheValid) {
      agentCards = responseCache;
      cacheHit = true;
    } else {
      // Generate fresh AgentCards
      agentCards = generateAllAgentCards(options);

      // Update cache
      responseCache = agentCards;
      cacheTimestamp = now;
    }

    const responseTime = Date.now() - startTime;

    // Build response
    const response = {
      agents: agentCards,
      metadata: {
        total: agentCards.length,
        protocol_version: '0.3.0',
        generated_at: new Date(cacheTimestamp).toISOString(),
        cache_hit: cacheHit,
        response_time_ms: responseTime,
      },
    };

    // Send response
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${Math.floor(CACHE_TTL_MS / 1000)}`,
      'X-Cache-Hit': cacheHit ? 'true' : 'false',
      'X-Response-Time': `${responseTime}ms`,
    });
    res.end(JSON.stringify(response, null, 2));
  } catch (error) {
    console.error('AgentCard discovery endpoint error:', error);

    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        error: 'Internal Server Error',
        message: 'Failed to generate AgentCards',
        code: 'GENERATION_ERROR',
        details: error.message,
      })
    );
  }
}

/**
 * Create HTTP server for AgentCard discovery
 * @param {Object} options - Server options
 * @returns {http.Server} HTTP server instance
 */
export function createDiscoveryServer(options = {}) {
  const port = options.port || 3000;
  const host = options.host || 'localhost';

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    // Route: /.well-known/agent-card.json
    if (url.pathname === '/.well-known/agent-card.json') {
      serveAgentCards(req, res, options);
      return;
    }

    // Route: /health (health check)
    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          features: {
            agent_card_generation: isEnabled('agent_card_generation', options.env),
            agent_card_discovery: isEnabled('agent_card_discovery', options.env),
          },
        })
      );
      return;
    }

    // Route: /cache/clear (admin endpoint)
    if (url.pathname === '/cache/clear' && req.method === 'POST') {
      clearCache();
      responseCache = null;
      cacheTimestamp = null;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'success',
          message: 'Cache cleared',
          timestamp: new Date().toISOString(),
        })
      );
      return;
    }

    // 404 for all other routes
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        error: 'Not Found',
        message: 'Endpoint not found',
        code: 'NOT_FOUND',
        available_endpoints: ['/.well-known/agent-card.json', '/health', '/cache/clear (POST)'],
      })
    );
  });

  // Error handling
  server.on('error', error => {
    console.error('Discovery server error:', error);
  });

  // Start server
  server.listen(port, host, () => {
    console.log(`AgentCard discovery endpoint listening on http://${host}:${port}`);
    console.log(`AgentCards available at: http://${host}:${port}/.well-known/agent-card.json`);
  });

  return server;
}

/**
 * Clear response cache
 */
export function clearResponseCache() {
  responseCache = null;
  cacheTimestamp = null;
}

/**
 * Get cache statistics
 * @returns {Object} Cache stats
 */
export function getResponseCacheStats() {
  const now = Date.now();

  return {
    cached: responseCache !== null,
    timestamp: cacheTimestamp,
    age_ms: cacheTimestamp ? now - cacheTimestamp : null,
    ttl_ms: CACHE_TTL_MS,
    expired: cacheTimestamp ? now - cacheTimestamp >= CACHE_TTL_MS : true,
    size_bytes: responseCache ? JSON.stringify(responseCache).length : 0,
  };
}

export default {
  serveAgentCards,
  createDiscoveryServer,
  clearResponseCache,
  getResponseCacheStats,
};
