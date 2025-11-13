import type { PermissionConfig, PermissionCheckResult } from '../types/index.js';

export class PermissionManager {
  constructor(private config: PermissionConfig) {}
  async checkPermission(name: string, input: Record<string, unknown>): Promise<PermissionCheckResult> {
    if (this.config.mode === 'bypassPermissions') {
      return { allow: true };
    }
    if (this.config.canUseTool) {
      return await this.config.canUseTool(name, input);
    }
    return { allow: true };
  }
}

export async function checkPermission(name: string, input: Record<string, unknown>, config: PermissionConfig): Promise<PermissionCheckResult> {
  const manager = new PermissionManager(config);
  return manager.checkPermission(name, input);
}
export function createPermissionRule(tool: string | string[], action: 'allow' | 'deny' | 'ask') {
  return { tool, action };
}
export { PermissionManager as default };
