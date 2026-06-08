/**
 * GeminiProvider.js
 *
 * Google Gemini Flash API provider (placeholder).
 * Ready for integration when API key becomes available.
 *
 * Currently returns mock responses for development/testing.
 */

import BaseAIProvider from "./BaseAIProvider.js";

class GeminiProvider extends BaseAIProvider {
  constructor(config = {}) {
    super(config);
    this.name = "GeminiProvider";
    this.model = config.customModel || "gemini-1.5-flash";
    this.baseUrl = "https://generativelanguage.googleapis.com/v1beta/models";
  }

  async generateResponse(systemPrompt, userMessage, conversationHistory = []) {
    try {
      if (!this.isConfigured() && process.env.NODE_ENV === "production") {
        throw new Error("Gemini API key not configured");
      }

      // DEVELOPMENT: Return mock response
      if (!this.isConfigured()) {
        console.warn(
          "[Gemini-Mock] Returning mock response. Configure GEMINI_API_KEY for production.",
        );
        return this._generateMockResponse(userMessage);
      }

      // TODO: Implement actual Gemini API call
      // This will be implemented when API key is available
      /*
      const response = await fetch(
        `${this.baseUrl}/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: { text: systemPrompt } },
            contents: [
              ...conversationHistory,
              { role: "user", parts: { text: userMessage } },
            ],
            generationConfig: {
              temperature: this.temperature,
              maxOutputTokens: this.maxTokens,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.statusText}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

      return {
        text,
        tokens: {
          input: data.usageMetadata?.promptTokenCount || 0,
          output: data.usageMetadata?.candidatesTokenCount || 0,
        },
        model: this.model,
      };
      */

      return this._generateMockResponse(userMessage);
    } catch (error) {
      console.error("GeminiProvider error:", error.message);
      throw error;
    }
  }

  isConfigured() {
    return !!process.env.GEMINI_API_KEY;
  }

  async healthCheck() {
    try {
      if (!this.isConfigured()) {
        return { healthy: false, error: "GEMINI_API_KEY not configured" };
      }

      // TODO: Implement health check with Gemini API
      return { healthy: true };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }

  _generateMockResponse(userMessage) {
    // Mock response for testing/development
    const mockResponses = {
      greeting: "Hello! Thank you for reaching out. How can I help you today?",
      order:
        "Great! I'd be happy to help you place an order. What would you like?",
      invoice:
        "I can help you generate an invoice. Could you provide the order details?",
      default: `Thank you for your message: "${userMessage.substring(0, 50)}...". We're processing your request.`,
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

export default GeminiProvider;
