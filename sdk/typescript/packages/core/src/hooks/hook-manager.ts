import type { HookConfig, HookEvent } from '../types/index.js';

export class HookManager {
  constructor(private hooks: HookConfig) {}
  async fire<T extends HookEvent>(event: T): Promise<void> {
    const hook = this.hooks[event.type];
    if (hook) {
      await hook(event as any);
    }
  }
}

export async function registerHook<T extends HookEvent>(type: T['type'], handler: (event: T) => Promise<void> | void): Promise<void> {}
export async function fireHook<T extends HookEvent>(event: T): Promise<void> {}
export { HookManager as default };
