import type { GuardrailConfig } from '../types/index.js';

export class GuardrailManager {
  constructor(private config: GuardrailConfig) {}
  async validateInput(input: string): Promise<{ valid: boolean; reason?: string }> {
    if (this.config.customValidation) {
      return this.config.customValidation(input);
    }
    return { valid: true };
  }
}

export async function validateInput(input: string, config: GuardrailConfig): Promise<{ valid: boolean; reason?: string }> {
  const manager = new GuardrailManager(config);
  return manager.validateInput(input);
}
export async function detectJailbreak(input: string): Promise<boolean> {
  return false;
}
export async function preventHallucination(prompt: string): Promise<string> {
  return prompt;
}
export { GuardrailManager as default };
