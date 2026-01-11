#!/usr/bin/env node
/**
 * MCP Connector - Model Context Protocol Integration
 * Connects to MCP servers and manages tool discovery
 * Based on: https://docs.claude.com/en/docs/agents-and-tools/mcp-connector.md
 */

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MCP_CONFIG_PATH = join(__dirname, '../../config.yaml');

/**
 * Load MCP configuration
 */
async function loadMCPConfig() {
  const configContent = await readFile(MCP_CONFIG_PATH, 'utf8');
  const config = yaml.load(configContent);
  return config.mcp_registry || { active_tools: [] };
}

/**
 * MCP Server connection
 */
class MCPServer {
  constructor(name, config) {
    this.name = name;
    this.config = config;
    this.connected = false;
    this.tools = [];
  }

  async connect() {
    // In production, this would establish actual MCP connection
    // For now, simulate connection
    this.connected = true;
    return { success: true, server: this.name };
  }

  async disconnect() {
    this.connected = false;
    return { success: true };
  }

  async listTools() {
    // In production, this would query MCP server for available tools
    return this.tools;
  }
}

/**
 * MCP Connector class
 */
export class MCPConnector {
  constructor() {
    this.servers = new Map();
    this.connectedServers = new Set();
  }

  /**
   * Connect to an MCP server
   */
  async connect(serverName) {
    if (this.connectedServers.has(serverName)) {
      return { success: true, already_connected: true };
    }

    const config = await loadMCPConfig();
    const serverConfig = config.active_tools.find(t => t.name === serverName);

    if (!serverConfig) {
      throw new Error(`MCP server ${serverName} not found in configuration`);
    }

    const server = new MCPServer(serverName, serverConfig);
    await server.connect();

    this.servers.set(serverName, server);
    this.connectedServers.add(serverName);

    return {
      success: true,
      server: serverName,
      tools: await server.listTools(),
    };
  }

  /**
   * Disconnect from an MCP server
   */
  async disconnect(serverName) {
    const server = this.servers.get(serverName);

    if (!server) {
      return { success: false, error: 'Server not connected' };
    }

    await server.disconnect();
    this.connectedServers.delete(serverName);

    return { success: true, server: serverName };
  }

  /**
   * Get all connected servers
   */
  getConnectedServers() {
    return Array.from(this.connectedServers);
  }

  /**
   * Get all available tools from connected servers
   */
  async getAllTools() {
    const allTools = [];

    for (const serverName of this.connectedServers) {
      const server = this.servers.get(serverName);
      const tools = await server.listTools();
      allTools.push(
        ...tools.map(tool => ({
          ...tool,
          server: serverName,
        }))
      );
    }

    return allTools;
  }

  /**
   * Discover available MCP servers
   */
  async discoverServers() {
    const config = await loadMCPConfig();
    return config.active_tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      connected: this.connectedServers.has(tool.name),
    }));
  }
}

/**
 * Create MCP connector instance
 */
export function createMCPConnector() {
  return new MCPConnector();
}

export default {
  MCPConnector,
  createMCPConnector,
};
