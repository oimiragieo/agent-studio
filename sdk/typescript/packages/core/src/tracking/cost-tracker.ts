import type { TokenUsage, CumulativeTokenUsage, CostBreakdown, SDKAssistantMessage } from '../types/index.js';

export class CostTracker {
  private deduplicatedMessages = new Set<string>();
  private cumulativeUsage: CumulativeTokenUsage = {
    input_tokens: 0,
    output_tokens: 0,
    total_input_tokens: 0,
    total_output_tokens: 0,
    total_tokens: 0
  };

  trackMessage(message: SDKAssistantMessage): void {
    if (this.deduplicatedMessages.has(message.id)) {
      return;
    }
    this.deduplicatedMessages.add(message.id);
    this.cumulativeUsage.input_tokens += message.usage.input_tokens;
    this.cumulativeUsage.output_tokens += message.usage.output_tokens;
    this.cumulativeUsage.total_input_tokens += message.usage.input_tokens;
    this.cumulativeUsage.total_output_tokens += message.usage.output_tokens;
    this.cumulativeUsage.total_tokens += message.usage.input_tokens + message.usage.output_tokens;
  }

  getCumulativeUsage(): CumulativeTokenUsage {
    return this.cumulativeUsage;
  }

  getCostBreakdown(): CostBreakdown {
    return {
      input_cost: this.cumulativeUsage.input_tokens * 0.00003,
      output_cost: this.cumulativeUsage.output_tokens * 0.00015,
      cache_creation_cost: 0,
      cache_read_cost: 0,
      total_cost: (this.cumulativeUsage.input_tokens * 0.00003) + (this.cumulativeUsage.output_tokens * 0.00015),
      currency: 'USD'
    };
  }
}

export function calculateCost(usage: TokenUsage): CostBreakdown {
  return {
    input_cost: usage.input_tokens * 0.00003,
    output_cost: usage.output_tokens * 0.00015,
    cache_creation_cost: (usage.cache_creation_input_tokens || 0) * 0.0000375,
    cache_read_cost: (usage.cache_read_input_tokens || 0) * 0.0000075,
    total_cost: (usage.input_tokens * 0.00003) + (usage.output_tokens * 0.00015),
    currency: 'USD'
  };
}
export function trackUsage(usage: TokenUsage): void {}
export { CostTracker as default };
