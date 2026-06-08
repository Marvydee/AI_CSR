/**
 * GPTProvider.js
 *
 * OpenAI GPT-4o Mini API provider (placeholder).
 * Ready for integration when API key becomes available.
 *
 * Currently returns mock responses for development/testing.
 */

import BaseAIProvider from "./BaseAIProvider.js";

class GPTProvider extends BaseAIProvider {
  constructor(config = {}) {
    super(config);
    this.name = "GPTProvider";
    this.model = config.customModel || "gpt-4o-mini";
    this.baseUrl = "https://api.openai.com/v1/chat/completions";
  }

  async generateResponse(systemPrompt, userMessage, conversationHistory = []) {
    try {
      if (!this.isConfigured() && process.env.NODE_ENV === "production") {
        throw new Error("OpenAI API key not configured");
      }

      // DEVELOPMENT: Return mock response
      if (!this.isConfigured()) {
        console.warn(
          "[GPT-Mock] Returning mock response. Configure OPENAI_API_KEY for production.",
        );
        return this._generateMockResponse(userMessage);
      }

      // TODO: Implement actual OpenAI API call
      // This will be implemented when API key is available
      /*
      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: systemPrompt },
            ...conversationHistory,
            { role: "user", content: userMessage },
          ],
          temperature: this.temperature,
          max_tokens: this.maxTokens,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content || "";
      const inputTokens = data.usage?.prompt_tokens || 0;
      const outputTokens = data.usage?.completion_tokens || 0;

      return {
        text,
        tokens: { input: inputTokens, output: outputTokens },
        model: this.model,
      };
      */

      return this._generateMockResponse(userMessage);
    } catch (error) {
      console.error("GPTProvider error:", error.message);
      throw error;
    }
  }

  isConfigured() {
    return !!process.env.OPENAI_API_KEY;
  }

  async healthCheck() {
    try {
      if (!this.isConfigured()) {
        return { healthy: false, error: "OPENAI_API_KEY not configured" };
      }

      // TODO: Implement health check with OpenAI API
      return { healthy: true };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }

  _generateMockResponse(userMessage) {
    // Mock response for testing/development
    const mockResponses = {
      greeting: "Hello! Thanks for reaching out. How can I assist you?",
      order:
        "Perfect! I'd be happy to help you with your order. What would you like to purchase?",
      invoice:
        "I can help you with your invoice. Please provide me with the necessary details.",
      default: `Thank you for your message. I'm processing your request: "${userMessage.substring(0, 50)}..."`,
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

export default GPTProvider;
