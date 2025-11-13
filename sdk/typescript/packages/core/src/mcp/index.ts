import type { Tool, MCPServerConfig } from '../types/index.js';
import { z } from 'zod';

export { MCPManager, connectMCPServer, listMCPResources } from './mcp-manager.js';

export function tool<TInput = unknown, TOutput = unknown>(config: {
  name: string;
  description: string;
  schema: z.ZodType<TInput>;
  handler: (input: TInput) => Promise<TOutput>;
}): Tool<TInput, TOutput> {
  return {
    name: config.name,
    description: config.description,
    input_schema: zodToJsonSchema(config.schema),
    handler: config.handler as any
  };
}

export function createSdkMcpServer(config: {
  name: string;
  version: string;
  tools: Tool[];
}): MCPServerConfig {
  return {
    tools: config.tools
  };
}

function zodToJsonSchema(schema: z.ZodType): any {
  return { type: 'object', properties: {}, required: [] };
}

export { tool as betaZodTool };
