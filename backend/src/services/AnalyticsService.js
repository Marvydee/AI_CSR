/**
 * AnalyticsService.js
 *
 * Aggregates and serves analytics for dashboards:
 * - Conversation metrics (response time, sentiment, resolution rate)
 * - Daily metrics (messages, orders, revenue)
 * - Customer metrics (LTV, engagement, churn)
 * - AI provider performance (cost, latency, quality)
 * - Billing analytics (credit usage, plan breakdown)
 */

import { PrismaClient } from "@prisma/client";
import logger from "../utils/logger.js";

const prisma = new PrismaClient();

class AnalyticsService {
  /**
   * Get dashboard overview for a business
   * @param {string} businessId - Business ID
   * @param {object} options - Time range options
   * @returns {Promise<object>}
   */
  static async getDashboardOverview(businessId, { daysBack = 30 } = {}) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      // Parallel queries for performance
      const [
        conversations,
        orders,
        invoices,
        creditLogs,
        aiUsageLogs,
        customers,
      ] = await Promise.all([
        prisma.conversation.findMany({
          where: {
            businessId,
            updatedAt: { gte: startDate },
          },
        }),
        prisma.order.findMany({
          where: {
            businessId,
            createdAt: { gte: startDate },
          },
        }),
        prisma.invoice.findMany({
          where: {
            businessId,
            createdAt: { gte: startDate },
          },
        }),
        prisma.creditLog.findMany({
          where: {
            businessId,
            timestamp: { gte: startDate },
          },
        }),
        prisma.aIUsageLog.findMany({
          where: {
            businessId,
            timestamp: { gte: startDate },
          },
        }),
        prisma.customer.findMany({
          where: { businessId },
        }),
      ]);

      // Calculate metrics
      const overview = {
        period: { start: startDate, end: new Date(), days: daysBack },
        conversations: {
          total: conversations.length,
          average_per_day: Math.round(conversations.length / daysBack),
        },
        orders: {
          total: orders.length,
          total_value: orders.reduce((sum, o) => sum + o.totalAmount, 0),
          average_value:
            orders.length > 0
              ? orders.reduce((sum, o) => sum + o.totalAmount, 0) /
                orders.length
              : 0,
        },
        invoices: {
          total: invoices.length,
          paid: invoices.filter((i) => i.status === "PAID").length,
          pending: invoices.filter(
            (i) => i.status === "ISSUED" || i.status === "SENT",
          ).length,
          total_value: invoices.reduce((sum, i) => sum + i.total, 0),
        },
        credits: {
          total_used: creditLogs.reduce(
            (sum, log) => sum + Math.max(0, log.creditsDeducted),
            0,
          ),
          by_task_type: this._groupByKey(creditLogs, "taskType"),
        },
        ai_providers: this._analyzeAIProviders(aiUsageLogs),
        customers: {
          total: customers.length,
          active_in_period: new Set(conversations.map((c) => c.customerId))
            .size,
        },
      };

      return overview;
    } catch (error) {
      logger.error(`Failed to get dashboard overview: ${error.message}`);
      return null;
    }
  }

  /**
   * Get conversation analytics
   * @param {string} businessId - Business ID
   * @returns {Promise<object>}
   */
  static async getConversationAnalytics(businessId) {
    try {
      const analytics = await prisma.conversationAnalytics.findMany({
        where: { businessId },
        orderBy: { date: "desc" },
        take: 30,
      });

      return analytics.map((a) => ({
        date: a.date,
        totalConversations: a.totalConversations,
        activeCustomers: a.activeCustomers,
        averageResponseTime: a.averageResponseTime,
        totalMessages: a.totalMessages,
        resolutionRate: a.resolutionRate,
      }));
    } catch (error) {
      logger.error(`Failed to get conversation analytics: ${error.message}`);
      return [];
    }
  }

  /**
   * Get AI provider performance analytics
   * @param {string} businessId - Business ID
   * @returns {Promise<object>}
   */
  static async getAIProviderAnalytics(businessId) {
    try {
      const logs = await prisma.aIUsageLog.findMany({
        where: { businessId },
      });

      const byProvider = {};

      logs.forEach((log) => {
        if (!byProvider[log.provider]) {
          byProvider[log.provider] = {
            provider: log.provider,
            calls: 0,
            totalInputTokens: 0,
            totalOutputTokens: 0,
            totalCost: 0,
            tasks: {},
          };
        }

        const p = byProvider[log.provider];
        p.calls++;
        p.totalInputTokens += log.inputTokens;
        p.totalOutputTokens += log.outputTokens;
        p.totalCost += log.costInCredits;

        if (!p.tasks[log.taskType]) {
          p.tasks[log.taskType] = { count: 0, cost: 0 };
        }
        p.tasks[log.taskType].count++;
        p.tasks[log.taskType].cost += log.costInCredits;
      });

      return Object.values(byProvider);
    } catch (error) {
      logger.error(`Failed to get AI provider analytics: ${error.message}`);
      return [];
    }
  }

  /**
   * Get customer analytics (LTV, engagement, etc)
   * @param {string} businessId - Business ID
   * @returns {Promise<object>}
   */
  static async getCustomerAnalytics(businessId) {
    try {
      const customers = await prisma.customer.findMany({
        where: { businessId },
        include: {
          orders: true,
          conversations: true,
        },
      });

      const analytics = customers.map((c) => ({
        customerId: c.id,
        name: c.name,
        phone: c.phone,
        lifetime_value: c.orders.reduce((sum, o) => sum + o.totalAmount, 0),
        total_orders: c.orders.length,
        total_conversations: c.conversations?.length || 0,
        last_interaction: c.updatedAt,
      }));

      // Sort by lifetime value
      analytics.sort((a, b) => b.lifetime_value - a.lifetime_value);

      return {
        total_customers: customers.length,
        total_lifetime_value: analytics.reduce(
          (sum, a) => sum + a.lifetime_value,
          0,
        ),
        average_ltv:
          customers.length > 0
            ? analytics.reduce((sum, a) => sum + a.lifetime_value, 0) /
              customers.length
            : 0,
        top_customers: analytics.slice(0, 10),
      };
    } catch (error) {
      logger.error(`Failed to get customer analytics: ${error.message}`);
      return { total_customers: 0, total_lifetime_value: 0, average_ltv: 0 };
    }
  }

  /**
   * Get billing analytics
   * @param {string} businessId - Business ID
   * @returns {Promise<object>}
   */
  static async getBillingAnalytics(businessId) {
    try {
      const [subscription, creditLogs, invoices] = await Promise.all([
        prisma.subscription.findUnique({
          where: { businessId },
          include: { pricingPlan: true },
        }),
        prisma.creditLog.findMany({
          where: { businessId },
          orderBy: { timestamp: "desc" },
          take: 100,
        }),
        prisma.invoice.findMany({
          where: { businessId },
        }),
      ]);

      if (!subscription) {
        return null;
      }

      const monthlyLimit = subscription.pricingPlan.monthlyAICredits;
      const used = monthlyLimit - subscription.remainingCredits;

      return {
        plan: {
          name: subscription.pricingPlan.name,
          monthlyCredits: monthlyLimit,
        },
        current_period: {
          start: subscription.currentPeriodStart,
          end: subscription.currentPeriodEnd,
        },
        credits: {
          monthly_limit: monthlyLimit,
          used,
          remaining: subscription.remainingCredits,
          usage_percent: Math.round((used / monthlyLimit) * 100),
        },
        invoices: {
          total: invoices.length,
          paid: invoices.filter((i) => i.status === "PAID").length,
          pending: invoices.filter(
            (i) => i.status !== "PAID" && i.status !== "CANCELLED",
          ).length,
          total_revenue: invoices.reduce((sum, i) => sum + i.total, 0),
        },
        credit_usage_by_task: this._groupByKey(creditLogs, "taskType"),
      };
    } catch (error) {
      logger.error(`Failed to get billing analytics: ${error.message}`);
      return null;
    }
  }

  /**
   * Record daily analytics (should be called by cron job)
   * @param {string} businessId - Business ID
   * @param {Date} date - Date to record for (default: today)
   * @returns {Promise<object>}
   */
  static async recordDailyMetrics(businessId, date = new Date()) {
    try {
      // Normalize date to midnight
      const analyticsDate = new Date(date);
      analyticsDate.setHours(0, 0, 0, 0);

      // Get metrics for the day
      const dayStart = new Date(analyticsDate);
      const dayEnd = new Date(analyticsDate);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const conversations = await prisma.conversation.findMany({
        where: {
          businessId,
          updatedAt: { gte: dayStart, lt: dayEnd },
        },
        include: { messages: true },
      });

      const orders = await prisma.order.findMany({
        where: {
          businessId,
          createdAt: { gte: dayStart, lt: dayEnd },
        },
      });

      const invoices = await prisma.invoice.findMany({
        where: {
          businessId,
          createdAt: { gte: dayStart, lt: dayEnd },
        },
      });

      // Calculate metrics
      let totalMessages = 0;
      let totalResolutionTime = 0;
      let resolvedCount = 0;

      conversations.forEach((c) => {
        totalMessages += c.messages?.length || 0;
        if (c.status === "RESOLVED") {
          resolvedCount++;
          totalResolutionTime += c.updatedAt.getTime() - c.createdAt.getTime();
        }
      });

      const metrics = {
        totalConversations: conversations.length,
        activeCustomers: new Set(conversations.map((c) => c.customerId)).size,
        totalMessages,
        averageResponseTime:
          totalMessages > 0 ? totalMessages / conversations.length : 0,
        resolutionRate:
          conversations.length > 0
            ? (resolvedCount / conversations.length) * 100
            : 0,
        totalOrders: orders.length,
        totalRevenue: orders.reduce((sum, o) => sum + o.totalAmount, 0),
        totalInvoices: invoices.length,
      };

      // Save to database
      const analytics = await prisma.dailyAnalytics.create({
        data: {
          businessId,
          date: analyticsDate,
          ...metrics,
        },
      });

      logger.info(
        `Daily metrics recorded for ${businessId}: ${metrics.totalConversations} conversations`,
      );

      return analytics;
    } catch (error) {
      logger.error(`Failed to record daily metrics: ${error.message}`);
      return null;
    }
  }

  /**
   * Helper: Group items by key and count
   * @private
   */
  static _groupByKey(items, key) {
    const grouped = {};
    items.forEach((item) => {
      const k = item[key];
      grouped[k] = (grouped[k] || 0) + 1;
    });
    return grouped;
  }

  /**
   * Helper: Analyze AI provider logs
   * @private
   */
  static _analyzeAIProviders(logs) {
    const byProvider = {};

    logs.forEach((log) => {
      if (!byProvider[log.provider]) {
        byProvider[log.provider] = {
          calls: 0,
          totalTokens: 0,
          totalCost: 0,
        };
      }

      byProvider[log.provider].calls++;
      byProvider[log.provider].totalTokens +=
        log.inputTokens + log.outputTokens;
      byProvider[log.provider].totalCost += log.costInCredits;
    });

    return byProvider;
  }
}

export default AnalyticsService;
