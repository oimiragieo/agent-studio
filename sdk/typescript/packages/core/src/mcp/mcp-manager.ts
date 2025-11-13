import type { MCPServerConfig, MCPServerStatus, MCPToolDefinition } from '../types/index.js';

export class MCPManager {
  constructor(private servers: Record<string, MCPServerConfig>) {}
  async connectAll(): Promise<void> {}
  async disconnectAll(): Promise<void> {}
  async getTools(): Promise<MCPToolDefinition[]> {
    return [];
  }
  getServerStatus(): MCPServerStatus[] {
    return Object.keys(this.servers).map(name => ({
      name,
      status: 'connected' as const,
      transport: 'sdk' as const
    }));
  }
}

export async function connectMCPServer(name: string, config: MCPServerConfig): Promise<void> {}
export async function listMCPResources(server: string): Promise<any[]> {
  return [];
}
export { MCPManager as default };
