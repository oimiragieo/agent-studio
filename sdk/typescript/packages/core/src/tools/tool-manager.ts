import type { ToolDefinition, ToolResult } from '../types/index.js';

export class ToolManager {
  constructor(private allowedTools: string[], private disallowedTools: string[]) {}
  async getAvailableTools(): Promise<ToolDefinition[]> {
    return [];
  }
  async executeTool(name: string, input: Record<string, unknown>): Promise<ToolResult> {
    return {
      tool_use_id: '',
      content: [{ type: 'text', text: 'Tool executed' }]
    };
  }
}

export async function registerTool(tool: ToolDefinition): Promise<void> {}
export async function executeTool(name: string, input: Record<string, unknown>): Promise<ToolResult> {
  const manager = new ToolManager([], []);
  return manager.executeTool(name, input);
}
export { ToolManager as default };
