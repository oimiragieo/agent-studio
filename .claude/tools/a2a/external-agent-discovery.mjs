/**
 * External Agent Discovery
 *
 * Discovers and caches AgentCards from external A2A-compliant agents.
 * Supports AgentCard fetching, validation, caching, and federation.
 *
 * Features:
 * - discoverAgent(): Fetch AgentCards from external URLs
 * - AgentCard caching: 30-minute TTL
 * - Validation: A2A v0.3.0 compliance
 * - Feature flag integration: external_federation
 * - Performance target: <100ms for cached discovery
 *
 * @module external-agent-discovery
 */

import { randomUUID } from 'crypto';
import { isEnabled } from '../feature-flags-manager.mjs';

/**
 * Cache for external AgentCards (30 minute TTL)
 */
const CACHE_TTL_MS = 30 * 60 * 1000;
const cache = new Map();

/**
 * Default fetch timeout
 */
const DEFAULT_TIMEOUT_MS = 5000;

/**
 * External Agent Discovery
 *
 * Discovers external A2A agents via AgentCard endpoint
 */
export class ExternalAgentDiscovery {
  /**
   * @param {object} options - Configuration options
   */
  constructor(options = {}) {
    this.featureFlags = options.featureFlags || {
      external_federation: process.env.EXTERNAL_FEDERATION === 'true' || false,
    };
    this.timeout = options.timeout || DEFAULT_TIMEOUT_MS;
    this.cache = cache;
  }

  /**
   * Discover external agent by fetching AgentCard
   *
   * @param {string} url - External agent base URL
   * @param {object} options - Discovery options
   * @returns {Promise<object>} AgentCard
   */
  async discoverAgent(url, options = {}) {
    const startTime = Date.now();

    const enabled = this.featureFlags.isEnabled?.('external_federation') ?? this.featureFlags.external_federation;
    if (!enabled) {
      throw new Error('external_federation feature flag is disabled');
    }

    // Normalize URL
    const normalizedUrl = this.normalizeUrl(url);

    // Check cache first
    const cached = this.getCachedAgentCard(normalizedUrl);
    if (cached && !options.forceRefresh) {
      const duration = Date.now() - startTime;
      console.log(
        `[External Discovery] Cache hit for ${normalizedUrl} (${duration}ms)`
      );
      return cached;
    }

    // Fetch AgentCard from external agent
    const agentCardUrl = this.buildAgentCardUrl(normalizedUrl);

    try {
      const response = await this.fetchWithTimeout(
        agentCardUrl,
        options.timeout || this.timeout
      );

      if (!response.ok) {
        throw new Error(
          `Failed to fetch AgentCard: HTTP ${response.status} ${response.statusText}`
        );
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(
          `Invalid content type: expected application/json, got ${contentType}`
        );
      }

      const data = await response.json();

      // Extract AgentCard from response
      const agentCard = data.agents ? data.agents[0] : data;

      // Validate AgentCard
      const validation = this.validateExternalAgentCard(agentCard);
      if (!validation.valid) {
        throw new Error(
          `Invalid AgentCard: ${validation.errors.join(', ')}`
        );
      }

      // Add discovery metadata
      agentCard._discovery = {
        source_url: normalizedUrl,
        discovered_at: new Date().toISOString(),
        discovery_time_ms: Date.now() - startTime,
      };

      // Cache AgentCard
      this.cacheAgentCard(normalizedUrl, agentCard);

      const duration = Date.now() - startTime;
      console.log(
        `[External Discovery] Discovered agent ${agentCard.name} from ${normalizedUrl} (${duration}ms)`
      );

      return agentCard;
    } catch (error) {
      console.error(
        `[External Discovery] Failed to discover ${normalizedUrl}:`,
        error
      );
      throw new Error(
        `External agent discovery failed: ${error.message}`
      );
    }
  }

  /**
   * Get cached AgentCard
   *
   * @param {string} url - External agent URL
   * @returns {object|null} Cached AgentCard or null
   */
  getCachedAgentCard(url) {
    const normalizedUrl = this.normalizeUrl(url);
    const cached = this.cache.get(normalizedUrl);

    if (!cached) {
      return null;
    }

    const age = Date.now() - cached.timestamp;
    if (age >= CACHE_TTL_MS) {
      // Cache expired
      this.cache.delete(normalizedUrl);
      return null;
    }

    return cached.agentCard;
  }

  /**
   * Cache AgentCard
   *
   * @param {string} url - External agent URL
   * @param {object} agentCard - AgentCard to cache
   */
  cacheAgentCard(url, agentCard) {
    const normalizedUrl = this.normalizeUrl(url);

    this.cache.set(normalizedUrl, {
      agentCard,
      timestamp: Date.now(),
    });
  }

  /**
   * Validate external AgentCard structure
   *
   * @param {object} agentCard - AgentCard to validate
   * @returns {object} Validation result
   */
  validateExternalAgentCard(agentCard) {
    const errors = [];

    if (!agentCard) {
      return { valid: false, errors: ['AgentCard is null or undefined'] };
    }

    // Required fields per A2A v0.3.0
    const required = [
      'protocol_version',
      'name',
      'description',
      'version',
      'supported_interfaces',
      'capabilities',
      'default_input_modes',
      'default_output_modes',
      'skills',
    ];

    for (const field of required) {
      if (agentCard[field] === undefined || agentCard[field] === null) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // Validate array fields
    if (
      agentCard.supported_interfaces &&
      !Array.isArray(agentCard.supported_interfaces)
    ) {
      errors.push('supported_interfaces must be an array');
    }

    if (agentCard.skills && !Array.isArray(agentCard.skills)) {
      errors.push('skills must be an array');
    }

    // Validate capabilities
    if (
      agentCard.capabilities &&
      typeof agentCard.capabilities !== 'object'
    ) {
      errors.push('capabilities must be an object');
    }

    // Validate protocol version
    if (
      agentCard.protocol_version &&
      !agentCard.protocol_version.startsWith('0.3')
    ) {
      errors.push(
        `Unsupported protocol version: ${agentCard.protocol_version} (expected 0.3.x)`
      );
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * List all discovered external agents
   *
   * @param {object} filters - Filter options
   * @returns {Array} External AgentCards
   */
  listExternalAgents(filters = {}) {
    const agents = Array.from(this.cache.values())
      .map((entry) => entry.agentCard)
      .filter((card) => {
        // Filter by capability
        if (
          filters.capability &&
          !card.capabilities[filters.capability]
        ) {
          return false;
        }

        // Filter by skill
        if (filters.skill) {
          const hasSkill = card.skills.some(
            (s) => s.name === filters.skill || s.id === filters.skill
          );
          if (!hasSkill) return false;
        }

        return true;
      });

    // Apply limit
    if (filters.limit) {
      return agents.slice(0, filters.limit);
    }

    return agents;
  }

  /**
   * Clear discovery cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   *
   * @returns {object} Cache stats
   */
  getCacheStats() {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());

    return {
      size: this.cache.size,
      entries: entries.map(([url, entry]) => ({
        url,
        agent_name: entry.agentCard.name,
        age_ms: now - entry.timestamp,
        expired: now - entry.timestamp >= CACHE_TTL_MS,
      })),
      ttl_ms: CACHE_TTL_MS,
    };
  }

  /**
   * Normalize URL for consistency
   *
   * @param {string} url - URL to normalize
   * @returns {string} Normalized URL
   */
  normalizeUrl(url) {
    // Remove trailing slash
    return url.replace(/\/$/, '');
  }

  /**
   * Build AgentCard endpoint URL
   *
   * @param {string} baseUrl - Agent base URL
   * @returns {string} AgentCard endpoint URL
   */
  buildAgentCardUrl(baseUrl) {
    return `${baseUrl}/.well-known/agent-card.json`;
  }

  /**
   * Fetch with timeout
   *
   * @param {string} url - URL to fetch
   * @param {number} timeout - Timeout in ms
   * @returns {Promise<Response>} Fetch response
   */
  async fetchWithTimeout(url, timeout) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'LLM-Rules-A2A/1.0',
        },
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Discover multiple agents in parallel
   *
   * @param {Array<string>} urls - Agent URLs
   * @param {object} options - Discovery options
   * @returns {Promise<Array>} Discovered AgentCards
   */
  async discoverMultipleAgents(urls, options = {}) {
    const startTime = Date.now();

    const results = await Promise.allSettled(
      urls.map((url) => this.discoverAgent(url, options))
    );

    const discovered = [];
    const failed = [];

    results.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        discovered.push(result.value);
      } else {
        failed.push({
          url: urls[idx],
          error: result.reason.message,
        });
      }
    });

    const duration = Date.now() - startTime;

    console.log(
      `[External Discovery] Discovered ${discovered.length}/${urls.length} agents in ${duration}ms`
    );

    if (failed.length > 0) {
      console.warn('[External Discovery] Failed discoveries:', failed);
    }

    return { discovered, failed, duration };
  }

  /**
   * Check if agent supports capability
   *
   * @param {string} url - Agent URL
   * @param {string} capability - Capability name
   * @returns {Promise<boolean>} True if supported
   */
  async supportsCapability(url, capability) {
    const agentCard = await this.discoverAgent(url);
    return agentCard.capabilities[capability] === true;
  }
}

/**
 * Create External Agent Discovery
 *
 * @param {object} options - Configuration options
 * @returns {ExternalAgentDiscovery}
 */
export function createExternalAgentDiscovery(options = {}) {
  return new ExternalAgentDiscovery(options);
}

/**
 * Singleton instance
 */
let instance = null;

/**
 * Get or create singleton instance
 *
 * @param {object} options - Configuration options
 * @returns {ExternalAgentDiscovery}
 */
export function getExternalAgentDiscovery(options = {}) {
  if (!instance) {
    instance = new ExternalAgentDiscovery(options);
  }
  return instance;
}

/**
 * Reset singleton instance (for testing)
 */
export function resetInstance() {
  instance = null;
  cache.clear();
}

export default {
  ExternalAgentDiscovery,
  createExternalAgentDiscovery,
  getExternalAgentDiscovery,
  resetInstance,
};
