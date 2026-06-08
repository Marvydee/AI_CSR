/**
 * BaseAIProvider.js
 *
 * Abstract base class for all AI providers.
 * Ensures consistent interface across different AI services.
 */

export class BaseAIProvider {
  constructor(config = {}) {
    this.config = config;
    this.name = "BaseProvider";
    this.apiKey = config.apiKey;
    this.customModel = config.customModel;
    this.temperature = config.temperature ?? 0.7;
    this.maxTokens = config.maxTokens ?? 1000;
  }

  /**
   * Generate a response from the AI provider
   * @param {string} systemPrompt - System instructions for the model
   * @param {string} userMessage - User input message
   * @param {array} conversationHistory - Previous messages for context
   * @returns {Promise<{text: string, tokens: {input, output}, model: string}>}
   */
  async generateResponse(systemPrompt, userMessage, conversationHistory = []) {
    throw new Error(`generateResponse() not implemented for ${this.name}`);
  }

  /**
   * Check if provider is properly configured
   * @returns {boolean}
   */
  isConfigured() {
    throw new Error(`isConfigured() not implemented for ${this.name}`);
  }

  /**
   * Get provider health status
   * @returns {Promise<{healthy: boolean, error?: string}>}
   */
  async healthCheck() {
    throw new Error(`healthCheck() not implemented for ${this.name}`);
  }

  /**
   * Calculate token count (useful for cost estimation)
   * @param {string} text
   * @returns {number}
   */
  estimateTokens(text) {
    // Simple approximation: ~1 token per 4 characters
    // Most models use similar tokenization
    return Math.ceil(text.length / 4);
  }
}

export default BaseAIProvider;
