/**
 * ClaudeProvider.js
 *
 * Anthropic Claude Sonnet API provider (placeholder).
 * Premium provider for complex reasoning tasks.
 * Ready for integration when API key becomes available.
 *
 * Currently returns mock responses for development/testing.
 */

import BaseAIProvider from "./BaseAIProvider.js";

class ClaudeProvider extends BaseAIProvider {
  constructor(config = {}) {
    super(config);
    this.name = "ClaudeProvider";
    this.model = config.customModel || "claude-3-5-sonnet-20241022";
    this.baseUrl = "https://api.anthropic.com/v1/messages";
  }

  async generateResponse(systemPrompt, userMessage, conversationHistory = []) {
    try {
      if (!this.isConfigured() && process.env.NODE_ENV === "production") {
        throw new Error("Claude API key not configured");
      }

      // DEVELOPMENT: Return mock response
      if (!this.isConfigured()) {
        console.warn(
          "[Claude-Mock] Returning mock response. Configure ANTHROPIC_API_KEY for production.",
        );
        return this._generateMockResponse(userMessage);
      }

      // TODO: Implement actual Claude API call
      // This will be implemented when API key is available
      /*
      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: this.maxTokens,
          system: systemPrompt,
          messages: [
            ...conversationHistory,
            { role: "user", content: userMessage },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`Claude API error: ${response.statusText}`);
      }

      const data = await response.json();
      const text = data.content?.[0]?.text || "";
      const inputTokens = data.usage?.input_tokens || 0;
      const outputTokens = data.usage?.output_tokens || 0;

      return {
        text,
        tokens: { input: inputTokens, output: outputTokens },
        model: this.model,
      };
      */

      return this._generateMockResponse(userMessage);
    } catch (error) {
      console.error("ClaudeProvider error:", error.message);
      throw error;
    }
  }

  isConfigured() {
    return !!process.env.ANTHROPIC_API_KEY;
  }

  async healthCheck() {
    try {
      if (!this.isConfigured()) {
        return { healthy: false, error: "ANTHROPIC_API_KEY not configured" };
      }

      // TODO: Implement health check with Claude API
      return { healthy: true };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }

  _generateMockResponse(userMessage) {
    // Mock response for testing/development - Claude usually more detailed
    const mockResponses = {
      greeting:
        "Hello! Thank you for contacting us. I'm an AI assistant designed to help with your business needs. What can I assist you with today?",
      order:
        "Excellent! I'd be delighted to help you place an order. To get started, could you tell me what products or services you're interested in? I can walk you through the entire process.",
      invoice:
        "I can definitely assist with invoice generation. To create an accurate invoice, I'll need the following information: items ordered, quantities, unit prices, and any applicable discounts or taxes.",
      default: `Thank you for reaching out. I understand your message is about: "${userMessage.substring(0, 50)}...". Let me help you with this in the most effective way possible.`,
    };

    let response = mockResponses.default;
    const msg = userMessage.toLowerCase();

    if (msg.includes("hello") || msg.includes("hi"))
      response = mockResponses.greeting;
    else if (msg.includes("order")) response = mockResponses.order;
    else if (msg.includes("invoice")) response = mockResponses.invoice;

    const inputTokens = this.estimateTokens(userMessage);
    const outputTokens = this.estimateTokens(response);

    return {
      text: response,
      tokens: { input: inputTokens, output: outputTokens },
      model: this.model,
      mock: true,
    };
  }
}

export default ClaudeProvider;
