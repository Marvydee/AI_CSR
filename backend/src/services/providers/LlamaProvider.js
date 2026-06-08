/**
 * LlamaProvider.js
 *
 * Local LLAMA model provider (currently active).
 * Uses Groq API for LLAMA inference.
 */

import BaseAIProvider from "./BaseAIProvider.js";
import { generateReply } from "../ai_engine.js"; // Existing Groq implementation

class LlamaProvider extends BaseAIProvider {
  constructor(config = {}) {
    super(config);
    this.name = "LlamaProvider";
    this.model = config.customModel || "llama-3.1-70b-versatile";
  }

  async generateResponse(systemPrompt, userMessage, conversationHistory = []) {
    try {
      if (!this.isConfigured()) {
        throw new Error("Groq API key not configured");
      }

      // Use existing ai_engine implementation
      const reply = await generateReply({
        systemPrompt,
        customerMessage: userMessage,
        conversationHistory: conversationHistory || [],
      });

      // Count tokens for analytics
      const inputTokens = this.estimateTokens(systemPrompt + userMessage);
      const outputTokens = this.estimateTokens(reply);

      return {
        text: reply,
        tokens: {
          input: inputTokens,
          output: outputTokens,
        },
        model: this.model,
      };
    } catch (error) {
      console.error("LlamaProvider error:", error.message);
      throw error;
    }
  }

  isConfigured() {
    // Check if Groq API key exists in environment
    return !!process.env.GROQ_API_KEY;
  }

  async healthCheck() {
    try {
      if (!this.isConfigured()) {
        return { healthy: false, error: "GROQ_API_KEY not configured" };
      }

      // TODO: Implement actual health check with Groq API
      return { healthy: true };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }
}

export default LlamaProvider;
