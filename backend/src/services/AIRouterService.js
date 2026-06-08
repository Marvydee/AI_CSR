/**
 * AIRouterService.js
 *
 * Smart AI provider routing system with intelligent fallback.
 * Routes tasks to appropriate providers based on:
 * - Task complexity
 * - Available credit budget
 * - Business configuration
 * - Provider availability
 *
 * Routing Logic:
 * 1. CHEAP tasks (simple Q&A, FAQs) → Gemini Flash or LLAMA
 * 2. NORMAL tasks (customer support, clarifications) → GPT-4o Mini or LLAMA
 * 3. COMPLEX tasks (order summary, invoice generation) → Claude or LLAMA
 *
 * Fallback chain: Preferred Provider → Lower-cost Alternative → LLAMA (always available)
 */

import { PrismaClient } from "@prisma/client";
import AIProviderFactory, {
  AIProviderType,
} from "./providers/AIProviderFactory.js";
import logger from "../utils/logger.js";

const prisma = new PrismaClient();

class AIRouterService {
  /**
   * Determine task complexity level
   * @param {string} taskType - Type of task (TEXT_MESSAGE, ORDER_SUMMARY, INVOICE_GENERATION, etc.)
   * @returns {string} - 'CHEAP', 'NORMAL', or 'COMPLEX'
   */
  static getTaskComplexity(taskType) {
    const complexityMap = {
      TEXT_MESSAGE: "CHEAP",
      CLARIFICATION: "CHEAP",
      FAQ_LOOKUP: "CHEAP",
      GREETING: "CHEAP",
      AFFIRMATION: "CHEAP",

      CUSTOMER_INQUIRY: "NORMAL",
      PRODUCT_INFO: "NORMAL",
      PRICE_INQUIRY: "NORMAL",
      STATUS_CHECK: "NORMAL",

      ORDER_SUMMARY: "COMPLEX",
      INVOICE_GENERATION: "COMPLEX",
      PAYMENT_REMINDER: "COMPLEX",
      VOICE_TRANSCRIPTION: "COMPLEX",
    };

    return complexityMap[taskType] || "NORMAL";
  }

  /**
   * Get providers based on task complexity and business configuration
   * @param {string} complexity - Task complexity ('CHEAP', 'NORMAL', 'COMPLEX')
   * @param {object} businessConfig - Business's AI configuration
   * @returns {array} - Ordered list of provider types to try
   */
  static getProviderChain(complexity, businessConfig = {}) {
    const preferences = businessConfig.supportedProviders || [
      AIProviderType.LLAMA,
    ];

    // Default provider chains by complexity
    const defaultChains = {
      CHEAP: [
        AIProviderType.GEMINI_FLASH,
        AIProviderType.LLAMA,
        AIProviderType.GPT_4O_MINI,
      ],
      NORMAL: [
        AIProviderType.LLAMA,
        AIProviderType.GPT_4O_MINI,
        AIProviderType.GEMINI_FLASH,
      ],
      COMPLEX: [
        AIProviderType.CLAUDE_SONNET,
        AIProviderType.LLAMA,
        AIProviderType.GPT_4O_MINI,
      ],
    };

    let chain = defaultChains[complexity] || defaultChains.NORMAL;

    // Filter by business preferences
    chain = chain.filter((provider) => preferences.includes(provider));

    // Ensure LLAMA is always in chain as ultimate fallback
    if (!chain.includes(AIProviderType.LLAMA)) {
      chain.push(AIProviderType.LLAMA);
    }

    return chain;
  }

  /**
   * Check if business has sufficient credits for a task
   * @param {string} businessId - Business ID
   * @param {string} taskType - Task type
   * @param {number} estimatedTokens - Estimated tokens to be used
   * @returns {Promise<{hasCredits: boolean, remainingCredits: number}>}
   */
  static async checkCredits(businessId, taskType, estimatedTokens = 0) {
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { businessId },
        include: { pricingPlan: true },
      });

      if (!subscription) {
        return {
          hasCredits: false,
          remainingCredits: 0,
          reason: "No subscription",
        };
      }

      if (subscription.status !== "ACTIVE") {
        return {
          hasCredits: false,
          remainingCredits: 0,
          reason: "Subscription inactive",
        };
      }

      // Check if billing period is valid
      const now = new Date();
      if (
        subscription.currentPeriodEnd &&
        now > subscription.currentPeriodEnd
      ) {
        return {
          hasCredits: false,
          remainingCredits: 0,
          reason: "Billing period expired",
        };
      }

      const remainingCredits = subscription.remainingCredits || 0;
      // Assume at least 0 tokens for estimation
      const minRequiredCredits = Math.max(1, Math.ceil(estimatedTokens / 10));

      return {
        hasCredits: remainingCredits >= minRequiredCredits,
        remainingCredits,
        monthlyLimit: subscription.monthlyAICredits,
      };
    } catch (error) {
      logger.error(`Credit check failed for business ${businessId}:`, error);
      // Fail open - allow request but log issue
      return { hasCredits: true, remainingCredits: 999999 };
    }
  }

  /**
   * Main routing function - selects best provider and generates response
   * @param {object} params
   * @returns {Promise<{text: string, provider: string, tokensUsed: object, costInCredits: number}>}
   */
  static async generateResponse({
    businessId,
    taskType,
    systemPrompt,
    userMessage,
    conversationHistory = [],
  }) {
    const complexity = this.getTaskComplexity(taskType);
    logger.info(
      `[AIRouter] Task: ${taskType} (${complexity}), Business: ${businessId}`,
    );

    // Get business configuration
    let businessConfig = {};
    try {
      const aiConfig = await prisma.aIProviderConfig.findFirst({
        where: { businessId, isActive: true },
      });

      businessConfig = aiConfig || {};
    } catch (error) {
      logger.warn(`Could not load business AI config: ${error.message}`);
    }

    // Get provider chain for this task
    const providerChain = this.getProviderChain(complexity, businessConfig);

    // Try each provider in chain
    for (const providerType of providerChain) {
      try {
        logger.info(`[AIRouter] Attempting provider: ${providerType}`);

        // Get provider-specific config
        const providerConfig = {
          customModel: businessConfig.customModel,
          temperature: businessConfig.temperature || 0.7,
          maxTokens: businessConfig.maxTokens || 1000,
          apiKey: process.env[`${providerType}_API_KEY`],
        };

        // Create provider instance
        const provider = AIProviderFactory.create(providerType, providerConfig);

        // Check health
        const health = await provider.healthCheck();
        if (!health.healthy) {
          logger.warn(
            `[AIRouter] Provider ${providerType} unhealthy: ${health.error}`,
          );
          continue;
        }

        // Generate response
        const result = await provider.generateResponse(
          systemPrompt,
          userMessage,
          conversationHistory,
        );

        // Calculate cost
        const costData = AIProviderFactory.getCost(
          providerType,
          result.tokens.input,
          result.tokens.output,
        );

        logger.info(
          `[AIRouter] Success with ${providerType}: ${result.tokens.output} output tokens, cost: ${costData.totalCost} credits`,
        );

        // Log AI usage for analytics
        try {
          await prisma.aIUsageLog.create({
            data: {
              businessId,
              provider: providerType,
              taskType,
              inputTokens: result.tokens.input,
              outputTokens: result.tokens.output,
              costInCredits: costData.totalCost,
              responseTimeMs: 0, // TODO: Calculate actual response time
              model: result.model,
            },
          });
        } catch (logError) {
          logger.error("Failed to log AI usage:", logError.message);
        }

        return {
          text: result.text,
          provider: providerType,
          tokensUsed: result.tokens,
          costInCredits: costData.totalCost,
          model: result.model,
        };
      } catch (error) {
        logger.warn(
          `[AIRouter] Provider ${providerType} failed: ${error.message}`,
        );
        // Continue to next provider
      }
    }

    // All providers failed
    throw new Error(
      `All AI providers failed for task ${taskType}. Provider chain: ${providerChain.join(", ")}`,
    );
  }

  /**
   * Get provider configuration for a business
   * @param {string} businessId - Business ID
   * @returns {Promise<object>}
   */
  static async getBusinessConfig(businessId) {
    try {
      return await prisma.aIProviderConfig.findFirst({
        where: { businessId, isActive: true },
      });
    } catch (error) {
      logger.error(`Failed to get business config: ${error.message}`);
      return null;
    }
  }

  /**
   * Update business AI provider configuration
   * @param {string} businessId - Business ID
   * @param {object} config - New configuration
   * @returns {Promise<object>}
   */
  static async updateBusinessConfig(businessId, config) {
    try {
      // Disable previous config
      await prisma.aIProviderConfig.updateMany(
        {
          where: { businessId },
        },
        { isActive: false },
      );

      // Create new config
      return await prisma.aIProviderConfig.create({
        data: {
          businessId,
          ...config,
          isActive: true,
        },
      });
    } catch (error) {
      logger.error(`Failed to update business config: ${error.message}`);
      throw error;
    }
  }
}

export default AIRouterService;
