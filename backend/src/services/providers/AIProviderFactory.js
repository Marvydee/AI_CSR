/**
 * AIProviderFactory.js
 *
 * Factory pattern for AI provider instantiation.
 * Supports LLAMA (currently active), Gemini Flash, GPT-4o Mini, Claude Sonnet
 * with extensible architecture for adding providers.
 *
 * Usage:
 *   const provider = AIProviderFactory.create(AIProviderType.LLAMA, config);
 *   const response = await provider.generateResponse(prompt);
 */

import LlamaProvider from "./LlamaProvider.js";
import GeminiProvider from "./GeminiProvider.js";
import GPTProvider from "./GPTProvider.js";
import ClaudeProvider from "./ClaudeProvider.js";

export const AIProviderType = {
  LLAMA: "LLAMA",
  GEMINI_FLASH: "GEMINI_FLASH",
  GPT_4O_MINI: "GPT_4O_MINI",
  CLAUDE_SONNET: "CLAUDE_SONNET",
};

// Cost per 1K tokens (in credits)
const PROVIDER_COSTS = {
  [AIProviderType.LLAMA]: { input: 1, output: 2 }, // Cheapest - local
  [AIProviderType.GEMINI_FLASH]: { input: 0.075, output: 0.3 }, // Budget-friendly
  [AIProviderType.GPT_4O_MINI]: { input: 0.15, output: 0.6 }, // Moderate
  [AIProviderType.CLAUDE_SONNET]: { input: 3, output: 15 }, // Premium
};

class AIProviderFactory {
  static create(providerType, config) {
    switch (providerType) {
      case AIProviderType.LLAMA:
        return new LlamaProvider(config);
      case AIProviderType.GEMINI_FLASH:
        return new GeminiProvider(config);
      case AIProviderType.GPT_4O_MINI:
        return new GPTProvider(config);
      case AIProviderType.CLAUDE_SONNET:
        return new ClaudeProvider(config);
      default:
        throw new Error(`Unknown AI provider: ${providerType}`);
    }
  }

  static getCost(providerType, inputTokens, outputTokens) {
    const costs = PROVIDER_COSTS[providerType];
    if (!costs) throw new Error(`Unknown provider: ${providerType}`);

    // Calculate cost: (inputTokens / 1000) * input_cost + (outputTokens / 1000) * output_cost
    const inputCost = (inputTokens / 1000) * costs.input;
    const outputCost = (outputTokens / 1000) * costs.output;

    return {
      inputCost,
      outputCost,
      totalCost: inputCost + outputCost,
    };
  }

  static getProviderTierCost(providerType) {
    // Returns relative cost tier (0-3, lower = cheaper)
    const tiers = {
      [AIProviderType.LLAMA]: 0,
      [AIProviderType.GEMINI_FLASH]: 1,
      [AIProviderType.GPT_4O_MINI]: 2,
      [AIProviderType.CLAUDE_SONNET]: 3,
    };
    return tiers[providerType] ?? 999;
  }
}

export default AIProviderFactory;
