#!/usr/bin/env node
/**
 * Remote MCP Servers - Remote Server Management
 * Manages connections to remote MCP servers with connection pooling and failover
 * Based on: https://docs.claude.com/en/docs/agents-and-tools/remote-mcp-servers.md
 */

import { MCPConnector } from './connector.mjs';

/**
 * Connection pool for remote servers
 */
class ConnectionPool {
  constructor(maxConnections = 10) {
    this.maxConnections = maxConnections;
    this.connections = new Map();
    this.connectionQueue = [];
  }

  async acquire(serverName) {
    if (this.connections.has(serverName)) {
      return this.connections.get(serverName);
    }

    if (this.connections.size >= this.maxConnections) {
      // Wait for available connection
      return new Promise((resolve) => {
        this.connectionQueue.push({ serverName, resolve });
      });
    }

    const connector = new MCPConnector();
    await connector.connect(serverName);
    this.connections.set(serverName, connector);

    return connector;
  }

  release(serverName) {
    const connector = this.connections.get(serverName);
    if (connector) {
      connector.disconnect(serverName);
      this.connections.delete(serverName);

      // Process queue
      if (this.connectionQueue.length > 0) {
        const next = this.connectionQueue.shift();
        next.resolve(this.acquire(next.serverName));
      }
    }
  }
}

/**
 * Remote MCP Server Manager
 */
export class RemoteMCPServerManager {
  constructor() {
    this.pool = new ConnectionPool();
    this.failoverServers = new Map();
    this.healthChecks = new Map();
  }

  /**
   * Add failover server
   */
  addFailover(primaryServer, failoverServer) {
    if (!this.failoverServers.has(primaryServer)) {
      this.failoverServers.set(primaryServer, []);
    }
    this.failoverServers.get(primaryServer).push(failoverServer);
  }

  /**
   * Connect with failover
   */
  async connectWithFailover(serverName) {
    try {
      const connector = await this.pool.acquire(serverName);
      return { success: true, connector, server: serverName };
    } catch (error) {
      // Try failover servers
      const failovers = this.failoverServers.get(serverName) || [];
      
      for (const failover of failovers) {
        try {
          const connector = await this.pool.acquire(failover);
          return {
            success: true,
            connector,
            server: failover,
            failover: true,
            original: serverName
          };
        } catch (failoverError) {
          // Continue to next failover
          continue;
        }
      }

      throw new Error(`Failed to connect to ${serverName} and all failover servers`);
    }
  }

  /**
   * Health check for server
   */
  async healthCheck(serverName) {
    try {
      const connector = await this.pool.acquire(serverName);
      const tools = await connector.getAllTools();
      
      this.healthChecks.set(serverName, {
        healthy: true,
        lastCheck: new Date().toISOString(),
        toolCount: tools.length
      });

      return { healthy: true, server: serverName };
    } catch (error) {
      this.healthChecks.set(serverName, {
        healthy: false,
        lastCheck: new Date().toISOString(),
        error: error.message
      });

      return { healthy: false, server: serverName, error: error.message };
    }
  }

  /**
   * Get server health status
   */
  getHealthStatus(serverName) {
    return this.healthChecks.get(serverName) || {
      healthy: null,
      lastCheck: null
    };
  }
}

export default {
  RemoteMCPServerManager,
  ConnectionPool
};

