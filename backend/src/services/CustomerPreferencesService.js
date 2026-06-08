/**
 * CustomerPreferencesService.js
 *
 * Manages customer preferences and memory:
 * - Store customer preferences (contact method, communication style)
 * - Track order history and buying patterns
 * - Manage conversation summaries for context
 * - Segment customers (VIP, new, at-risk)
 * - Estimate customer LTV
 * - Support customer profile enrichment
 */

import { PrismaClient } from "@prisma/client";
import logger from "../utils/logger.js";

const prisma = new PrismaClient();

class CustomerPreferencesService {
  /**
   * Get or create customer memory record
   * @param {string} customerId - Customer ID
   * @returns {Promise<object>}
   */
  static async getMemory(customerId) {
    try {
      let memory = await prisma.customerMemory.findUnique({
        where: { customerId },
      });

      if (!memory) {
        memory = await prisma.customerMemory.create({
          data: {
            customerId,
            preferences: JSON.stringify({}),
            orderHistory: JSON.stringify([]),
            conversationSummary: "",
            segmentationTags: JSON.stringify([]),
          },
        });
      }

      return {
        preferences: JSON.parse(memory.preferences || "{}"),
        orderHistory: JSON.parse(memory.orderHistory || "[]"),
        conversationSummary: memory.conversationSummary,
        segmentationTags: JSON.parse(memory.segmentationTags || "[]"),
        estimatedLTV: memory.estimatedLTV,
        lastUpdated: memory.updatedAt,
      };
    } catch (error) {
      logger.error(`Failed to get customer memory: ${error.message}`);
      return {
        preferences: {},
        orderHistory: [],
        conversationSummary: "",
        segmentationTags: [],
      };
    }
  }

  /**
   * Update customer preferences
   * @param {string} customerId - Customer ID
   * @param {object} preferences - New preferences
   * @returns {Promise<object>}
   */
  static async updatePreferences(customerId, preferences = {}) {
    try {
      // Get existing memory
      let memory = await prisma.customerMemory.findUnique({
        where: { customerId },
      });

      if (!memory) {
        memory = await prisma.customerMemory.create({
          data: {
            customerId,
            preferences: JSON.stringify(preferences),
            orderHistory: JSON.stringify([]),
            conversationSummary: "",
            segmentationTags: JSON.stringify([]),
          },
        });
      } else {
        const existing = JSON.parse(memory.preferences || "{}");
        memory = await prisma.customerMemory.update({
          where: { customerId },
          data: {
            preferences: JSON.stringify({ ...existing, ...preferences }),
            updatedAt: new Date(),
          },
        });
      }

      logger.info(`Customer preferences updated: ${customerId}`);
      return memory;
    } catch (error) {
      logger.error(`Failed to update preferences: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update conversation summary
   * @param {string} customerId - Customer ID
   * @param {string} summary - New summary
   * @returns {Promise<object>}
   */
  static async updateConversationSummary(customerId, summary) {
    try {
      let memory = await prisma.customerMemory.findUnique({
        where: { customerId },
      });

      if (!memory) {
        memory = await prisma.customerMemory.create({
          data: {
            customerId,
            conversationSummary: summary,
            preferences: JSON.stringify({}),
            orderHistory: JSON.stringify([]),
            segmentationTags: JSON.stringify([]),
          },
        });
      } else {
        memory = await prisma.customerMemory.update({
          where: { customerId },
          data: {
            conversationSummary: summary,
            updatedAt: new Date(),
          },
        });
      }

      logger.info(`Conversation summary updated for ${customerId}`);
      return memory;
    } catch (error) {
      logger.error(`Failed to update conversation summary: ${error.message}`);
      throw error;
    }
  }

  /**
   * Add tag to customer segmentation
   * @param {string} customerId - Customer ID
   * @param {string} tag - Tag to add
   * @returns {Promise<object>}
   */
  static async addSegmentationTag(customerId, tag) {
    try {
      let memory = await prisma.customerMemory.findUnique({
        where: { customerId },
      });

      if (!memory) {
        memory = await prisma.customerMemory.create({
          data: {
            customerId,
            segmentationTags: JSON.stringify([tag]),
            preferences: JSON.stringify({}),
            orderHistory: JSON.stringify([]),
          },
        });
      } else {
        const tags = JSON.parse(memory.segmentationTags || "[]");
        if (!tags.includes(tag)) {
          tags.push(tag);
          memory = await prisma.customerMemory.update({
            where: { customerId },
            data: {
              segmentationTags: JSON.stringify(tags),
              updatedAt: new Date(),
            },
          });
        }
      }

      logger.info(`Tag added to customer ${customerId}: ${tag}`);
      return memory;
    } catch (error) {
      logger.error(`Failed to add segmentation tag: ${error.message}`);
      throw error;
    }
  }

  /**
   * Calculate and update customer LTV
   * @param {string} customerId - Customer ID
   * @returns {Promise<number>}
   */
  static async calculateAndUpdateLTV(customerId) {
    try {
      // Get customer orders
      const orders = await prisma.order.findMany({
        where: { customerId },
      });

      // Calculate metrics
      const totalSpent = orders.reduce((sum, o) => sum + o.totalAmount, 0);
      const orderCount = orders.length;
      const avgOrderValue = orderCount > 0 ? totalSpent / orderCount : 0;

      // Simple LTV estimation (can be enhanced with ML)
      // LTV = Average Order Value × Average Number of Orders per Year × Customer Lifetime
      // For now: (Total Spent) * 1.5 assuming 50% additional future value
      const estimatedLTV = totalSpent * 1.5;

      // Update in database
      const memory = await prisma.customerMemory.findUnique({
        where: { customerId },
      });

      if (memory) {
        await prisma.customerMemory.update({
          where: { customerId },
          data: { estimatedLTV },
        });
      } else {
        await prisma.customerMemory.create({
          data: {
            customerId,
            estimatedLTV,
            preferences: JSON.stringify({}),
            orderHistory: JSON.stringify([]),
          },
        });
      }

      // Auto-segment based on LTV
      if (estimatedLTV > 10000) {
        await this.addSegmentationTag(customerId, "VIP");
      } else if (estimatedLTV > 5000) {
        await this.addSegmentationTag(customerId, "REGULAR");
      }

      logger.info(
        `LTV updated for customer ${customerId}: ${estimatedLTV.toFixed(2)}`,
      );

      return estimatedLTV;
    } catch (error) {
      logger.error(`Failed to calculate LTV: ${error.message}`);
      return 0;
    }
  }

  /**
   * Get customer segment
   * @param {string} customerId - Customer ID
   * @returns {Promise<array>}
   */
  static async getSegments(customerId) {
    try {
      const memory = await prisma.customerMemory.findUnique({
        where: { customerId },
      });

      return JSON.parse(memory?.segmentationTags || "[]");
    } catch (error) {
      logger.error(`Failed to get segments: ${error.message}`);
      return [];
    }
  }

  /**
   * Get customers by segment
   * @param {string} businessId - Business ID
   * @param {string} segment - Segment name
   * @returns {Promise<array>}
   */
  static async getCustomersBySegment(businessId, segment) {
    try {
      const memories = await prisma.customerMemory.findMany({
        where: {
          customer: {
            businessId,
          },
        },
      });

      return memories
        .filter((m) => {
          const tags = JSON.parse(m.segmentationTags || "[]");
          return tags.includes(segment);
        })
        .map((m) => m.customerId);
    } catch (error) {
      logger.error(`Failed to get customers by segment: ${error.message}`);
      return [];
    }
  }

  /**
   * Get enriched customer profile for AI context
   * @param {string} customerId - Customer ID
   * @returns {Promise<string>}
   */
  static async getAIContext(customerId) {
    try {
      const [customer, memory, orders] = await Promise.all([
        prisma.customer.findUnique({
          where: { id: customerId },
        }),
        this.getMemory(customerId),
        prisma.order.findMany({
          where: { customerId },
          take: 5,
          orderBy: { createdAt: "desc" },
        }),
      ]);

      if (!customer) {
        return "";
      }

      // Build context string for AI
      const context = `
Customer Profile:
- Name: ${customer.name}
- Segments: ${memory.segmentationTags.join(", ") || "New Customer"}
- Estimated Lifetime Value: ${memory.estimatedLTV || "Not calculated"}
- Preferences: ${JSON.stringify(memory.preferences)}
${
  memory.conversationSummary
    ? `- Previous Context: ${memory.conversationSummary}`
    : ""
}
${
  orders.length > 0
    ? `- Recent Orders: ${orders.map((o) => `${o.id} ($${o.totalAmount})`).join(", ")}`
    : "- No previous orders"
}

Use this information to provide personalized, contextual support.
      `.trim();

      return context;
    } catch (error) {
      logger.error(`Failed to get AI context: ${error.message}`);
      return "";
    }
  }

  /**
   * Get batch customer profiles for analytics
   * @param {string} businessId - Business ID
   * @returns {Promise<array>}
   */
  static async getCustomerProfiles(businessId, limit = 100) {
    try {
      const customers = await prisma.customer.findMany({
        where: { businessId },
        take: limit,
        include: {
          orders: {
            take: 1,
            orderBy: { createdAt: "desc" },
          },
        },
      });

      const profiles = [];

      for (const customer of customers) {
        const memory = await this.getMemory(customer.id);
        const ltv = await this.calculateAndUpdateLTV(customer.id);

        profiles.push({
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          ltv,
          segments: memory.segmentationTags,
          lastOrder:
            customer.orders.length > 0 ? customer.orders[0].createdAt : null,
          createdAt: customer.createdAt,
        });
      }

      return profiles;
    } catch (error) {
      logger.error(`Failed to get customer profiles: ${error.message}`);
      return [];
    }
  }
}

export default CustomerPreferencesService;
