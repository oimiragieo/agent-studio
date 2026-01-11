#!/usr/bin/env node
/**
 * Circuit Breaker Pattern for Providers (Cursor Recommendation #14)
 *
 * Implements the circuit breaker pattern to prevent repeated calls to failing
 * providers. This saves time and resources by temporarily skipping providers
 * that are experiencing failures.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Provider is failing, requests are blocked
 * - HALF_OPEN: Testing if provider has recovered
 *
 * Usage:
 *   import { CircuitBreaker, getProviderCircuitBreaker } from './circuit-breaker.mjs';
 *
 *   // Create a circuit breaker
 *   const breaker = new CircuitBreaker({ failureThreshold: 3, resetTimeout: 60000 });
 *
 *   // Check if provider can be called
 *   if (breaker.canExecute('claude')) {
 *     try {
 *       const result = await callProvider('claude');
 *       breaker.recordSuccess('claude');
 *     } catch (e) {
 *       breaker.recordFailure('claude');
 *     }
 *   }
 *
 *   // Or use the global provider circuit breaker
 *   const globalBreaker = getProviderCircuitBreaker();
 *
 * @module circuit-breaker
 * @version 1.0.0
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Circuit breaker states
export const CircuitState = {
  CLOSED: 'closed',
  OPEN: 'open',
  HALF_OPEN: 'half-open'
};

/**
 * Circuit Breaker implementation
 *
 * Prevents repeated calls to failing providers by tracking failures
 * and temporarily blocking requests to providers that exceed the
 * failure threshold.
 */
export class CircuitBreaker {
  /**
   * Create a new CircuitBreaker
   *
   * @param {Object} options - Configuration options
   * @param {number} options.failureThreshold - Number of failures before opening circuit (default: 5)
   * @param {number} options.resetTimeout - Time in ms before attempting to close circuit (default: 60000)
   * @param {number} options.halfOpenMaxAttempts - Max attempts in half-open state (default: 2)
   * @param {boolean} options.persistent - Whether to persist state to disk (default: false)
   * @param {string} options.persistPath - Path to persist state (default: .claude/context/circuit-breaker-state.json)
   */
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000; // 1 minute
    this.halfOpenMaxAttempts = options.halfOpenMaxAttempts || 2;
    this.persistent = options.persistent || false;
    this.persistPath = options.persistPath || path.join(
      __dirname, '../context/circuit-breaker-state.json'
    );

    // State map: provider -> { failures, state, openUntil, halfOpenAttempts, lastFailure }
    this.states = new Map();

    // Event listeners
    this.listeners = {
      stateChange: [],
      failure: [],
      success: []
    };

    // Load persisted state if enabled
    if (this.persistent) {
      this.loadState();
    }
  }

  /**
   * Check if a provider can be called
   *
   * @param {string} provider - Provider name
   * @returns {boolean} - Whether the provider can be called
   */
  canExecute(provider) {
    const state = this.getState(provider);

    switch (state.state) {
      case CircuitState.CLOSED:
        return true;

      case CircuitState.OPEN:
        // Check if reset timeout has passed
        if (Date.now() > state.openUntil) {
          // Transition to half-open
          this.transitionTo(provider, CircuitState.HALF_OPEN);
          return true;
        }
        return false;

      case CircuitState.HALF_OPEN:
        // Allow limited attempts in half-open state
        return state.halfOpenAttempts < this.halfOpenMaxAttempts;

      default:
        return true;
    }
  }

  /**
   * Record a successful call to a provider
   *
   * @param {string} provider - Provider name
   */
  recordSuccess(provider) {
    const state = this.getState(provider);

    if (state.state === CircuitState.HALF_OPEN) {
      // Success in half-open state, close the circuit
      this.transitionTo(provider, CircuitState.CLOSED);
      console.log(`[circuit-breaker] ${provider}: Circuit CLOSED (recovered)`);
    }

    // Reset failure count on success
    state.failures = 0;
    state.lastSuccess = Date.now();
    this.states.set(provider, state);

    // Emit success event
    this.emit('success', { provider, state });

    // Persist state if enabled
    if (this.persistent) {
      this.saveState();
    }
  }

  /**
   * Record a failed call to a provider
   *
   * @param {string} provider - Provider name
   * @param {Error} error - The error that occurred (optional)
   */
  recordFailure(provider, error = null) {
    const state = this.getState(provider);
    state.failures++;
    state.lastFailure = Date.now();
    state.lastError = error ? String(error.message || error) : null;

    if (state.state === CircuitState.HALF_OPEN) {
      // Failure in half-open state, increment attempt counter
      state.halfOpenAttempts++;

      if (state.halfOpenAttempts >= this.halfOpenMaxAttempts) {
        // Too many failures in half-open, reopen the circuit
        this.transitionTo(provider, CircuitState.OPEN);
        console.warn(
          `[circuit-breaker] ${provider}: Circuit REOPENED ` +
          `(${state.halfOpenAttempts} failures in half-open state)`
        );
      }
    } else if (state.failures >= this.failureThreshold) {
      // Trip circuit breaker
      this.transitionTo(provider, CircuitState.OPEN);
      console.warn(
        `[circuit-breaker] ${provider}: Circuit OPEN ` +
        `(${state.failures} failures, reset in ${this.resetTimeout}ms)`
      );
    }

    this.states.set(provider, state);

    // Emit failure event
    this.emit('failure', { provider, state, error });

    // Persist state if enabled
    if (this.persistent) {
      this.saveState();
    }
  }

  /**
   * Get the current state of a provider
   *
   * @param {string} provider - Provider name
   * @returns {Object} - State object
   */
  getState(provider) {
    if (!this.states.has(provider)) {
      this.states.set(provider, {
        failures: 0,
        state: CircuitState.CLOSED,
        openUntil: null,
        halfOpenAttempts: 0,
        lastFailure: null,
        lastSuccess: null,
        lastError: null
      });
    }
    return this.states.get(provider);
  }

  /**
   * Transition a provider to a new state
   *
   * @param {string} provider - Provider name
   * @param {string} newState - New state (from CircuitState)
   */
  transitionTo(provider, newState) {
    const state = this.getState(provider);
    const oldState = state.state;

    state.state = newState;

    if (newState === CircuitState.OPEN) {
      state.openUntil = Date.now() + this.resetTimeout;
      state.halfOpenAttempts = 0;
    } else if (newState === CircuitState.HALF_OPEN) {
      state.halfOpenAttempts = 0;
    } else if (newState === CircuitState.CLOSED) {
      state.failures = 0;
      state.openUntil = null;
      state.halfOpenAttempts = 0;
    }

    this.states.set(provider, state);

    // Emit state change event
    this.emit('stateChange', { provider, oldState, newState, state });
  }

  /**
   * Force reset a provider's circuit breaker
   *
   * @param {string} provider - Provider name
   */
  reset(provider) {
    this.transitionTo(provider, CircuitState.CLOSED);
    console.log(`[circuit-breaker] ${provider}: Circuit RESET (manual)`);

    if (this.persistent) {
      this.saveState();
    }
  }

  /**
   * Reset all circuit breakers
   */
  resetAll() {
    for (const provider of this.states.keys()) {
      this.reset(provider);
    }
  }

  /**
   * Get statistics for all providers
   *
   * @returns {Object} - Statistics object
   */
  getStats() {
    const stats = {
      providers: {},
      summary: {
        total: 0,
        closed: 0,
        open: 0,
        halfOpen: 0
      }
    };

    for (const [provider, state] of this.states.entries()) {
      stats.providers[provider] = {
        state: state.state,
        failures: state.failures,
        openUntil: state.openUntil,
        lastFailure: state.lastFailure,
        lastSuccess: state.lastSuccess
      };

      stats.summary.total++;

      switch (state.state) {
        case CircuitState.CLOSED:
          stats.summary.closed++;
          break;
        case CircuitState.OPEN:
          stats.summary.open++;
          break;
        case CircuitState.HALF_OPEN:
          stats.summary.halfOpen++;
          break;
      }
    }

    return stats;
  }

  /**
   * Add an event listener
   *
   * @param {string} event - Event name (stateChange, failure, success)
   * @param {Function} callback - Callback function
   */
  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }

  /**
   * Remove an event listener
   *
   * @param {string} event - Event name
   * @param {Function} callback - Callback function to remove
   */
  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }

  /**
   * Emit an event
   *
   * @param {string} event - Event name
   * @param {Object} data - Event data
   */
  emit(event, data) {
    if (this.listeners[event]) {
      for (const callback of this.listeners[event]) {
        try {
          callback(data);
        } catch (e) {
          console.error(`[circuit-breaker] Event listener error: ${e.message}`);
        }
      }
    }
  }

  /**
   * Save state to disk
   */
  saveState() {
    try {
      const dir = path.dirname(this.persistPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const data = {
        timestamp: new Date().toISOString(),
        config: {
          failureThreshold: this.failureThreshold,
          resetTimeout: this.resetTimeout,
          halfOpenMaxAttempts: this.halfOpenMaxAttempts
        },
        states: Object.fromEntries(this.states)
      };

      fs.writeFileSync(this.persistPath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.error(`[circuit-breaker] Failed to save state: ${e.message}`);
    }
  }

  /**
   * Load state from disk
   */
  loadState() {
    try {
      if (!fs.existsSync(this.persistPath)) {
        return;
      }

      const content = fs.readFileSync(this.persistPath, 'utf-8');
      const data = JSON.parse(content);

      if (data.states) {
        for (const [provider, state] of Object.entries(data.states)) {
          // Don't restore expired open states
          if (state.state === CircuitState.OPEN && state.openUntil < Date.now()) {
            state.state = CircuitState.HALF_OPEN;
            state.halfOpenAttempts = 0;
          }
          this.states.set(provider, state);
        }
      }

      console.log(`[circuit-breaker] Loaded state for ${this.states.size} providers`);
    } catch (e) {
      console.error(`[circuit-breaker] Failed to load state: ${e.message}`);
    }
  }
}

// Global provider circuit breaker instance
let globalProviderBreaker = null;

/**
 * Get the global provider circuit breaker instance
 *
 * @param {Object} options - Options to configure the breaker (only used on first call)
 * @returns {CircuitBreaker} - The global circuit breaker instance
 */
export function getProviderCircuitBreaker(options = {}) {
  if (!globalProviderBreaker) {
    globalProviderBreaker = new CircuitBreaker({
      failureThreshold: options.failureThreshold || 3,
      resetTimeout: options.resetTimeout || 60000,
      persistent: options.persistent !== false,
      ...options
    });
  }
  return globalProviderBreaker;
}

/**
 * Execute a provider call with circuit breaker protection
 *
 * @param {string} provider - Provider name
 * @param {Function} fn - Async function to execute
 * @param {Object} options - Options
 * @param {CircuitBreaker} options.breaker - Circuit breaker instance (default: global)
 * @returns {Promise<Object>} - Result with provider status
 */
export async function executeWithCircuitBreaker(provider, fn, options = {}) {
  const breaker = options.breaker || getProviderCircuitBreaker();

  // Check if circuit allows execution
  if (!breaker.canExecute(provider)) {
    const state = breaker.getState(provider);
    return {
      provider,
      ok: false,
      skipped: true,
      reason: 'circuit_breaker_open',
      circuit_state: state.state,
      open_until: state.openUntil,
      failures: state.failures
    };
  }

  try {
    const result = await fn();
    breaker.recordSuccess(provider);
    return {
      provider,
      ...result,
      ok: result.ok !== false,
      circuit_state: breaker.getState(provider).state
    };
  } catch (error) {
    breaker.recordFailure(provider, error);
    return {
      provider,
      ok: false,
      error: error.message || String(error),
      circuit_state: breaker.getState(provider).state
    };
  }
}

// Default export
export default {
  CircuitBreaker,
  CircuitState,
  getProviderCircuitBreaker,
  executeWithCircuitBreaker
};
