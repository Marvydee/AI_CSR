/**
 * CreditManagerService.js
 *
 * Manages credit allocation, consumption, and refunds.
 * Key responsibilities:
 * - Track monthly credit usage per business
 * - Enforce credit limits
 * - Handle overage policies
 * - Audit trail of all credit transactions
 * - Support multiple billing periods
 *
 * Credit System:
 * - Each business has monthly credit allocation based on plan
 * - Credits consumed per task type (text, voice, invoice generation)
 * - When credits exhausted: block AI features or trigger upgrade prompt
 * - Unused credits do NOT roll over to next month
 */

import { PrismaClient, CreditsTaskType } from "@prisma/client";
import logger from "../utils/logger.js";

const prisma = new PrismaClient();

class CreditManagerService {
  /**
   * Check if business has sufficient credits
   * @param {string} businessId - Business ID
   * @param {string} taskType - Task type (from CreditsTaskType enum)
   * @param {number} creditsRequired - Credits needed for this task
   * @returns {Promise<{available: boolean, remaining: number, shortage?: number}>}
   */
  static async hasCredits(businessId, taskType, creditsRequired = 1) {
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { businessId },
      });

      if (!subscription) {
        logger.warn(`No subscription found for business ${businessId}`);
        return { available: false, remaining: 0, shortage: creditsRequired };
      }

      if (subscription.status !== "ACTIVE") {
        logger.info(`Subscription inactive for business ${businessId}`);
        return { available: false, remaining: 0, shortage: creditsRequired };
      }

      // Check billing period validity
      const now = new Date();
      if (subscription.currentPeriodEnd < now) {
        logger.info(
          `Billing period expired for business ${businessId}, resetting credits`,
        );
        // Reset credits for new billing period
        await this.resetMonthlyCredits(businessId);
        return this.hasCredits(businessId, taskType, creditsRequired);
      }

      const remaining = subscription.remainingCredits || 0;
      const available = remaining >= creditsRequired;

      if (!available) {
        logger.warn(
          `Insufficient credits for business ${businessId}: has ${remaining}, needs ${creditsRequired}`,
        );
      }

      return {
        available,
        remaining,
        shortage: Math.max(0, creditsRequired - remaining),
      };
    } catch (error) {
      logger.error(`Credit check error for business ${businessId}:`, error);
      // Fail open but log
      return { available: true, remaining: 999999 };
    }
  }

  /**
   * Deduct credits for a task
   * @param {string} businessId - Business ID
   * @param {string} taskType - Task type
   * @param {number} creditsToDeduct - Credits to remove
   * @param {object} metadata - Additional metadata for audit trail
   * @returns {Promise<{success: boolean, remainingCredits: number, logId: string}>}
   */
  static async deductCredits(
    businessId,
    taskType,
    creditsToDeduct,
    metadata = {},
  ) {
    const txn = await prisma.$transaction(async (tx) => {
      try {
        // Check current credits
        const subscription = await tx.subscription.findUnique({
          where: { businessId },
        });

        if (!subscription) {
          throw new Error("No active subscription");
        }

        const remaining = subscription.remainingCredits || 0;
        if (remaining < creditsToDeduct) {
          throw new Error(
            `Insufficient credits: has ${remaining}, needs ${creditsToDeduct}`,
          );
        }

        // Deduct credits
        const updated = await tx.subscription.update({
          where: { businessId },
          data: {
            remainingCredits: remaining - creditsToDeduct,
          },
        });

        // Log transaction
        const log = await tx.creditLog.create({
          data: {
            businessId,
            taskType,
            creditsDeducted: creditsToDeduct,
            remainingCredits: updated.remainingCredits,
            metadata: JSON.stringify(metadata),
            timestamp: new Date(),
          },
        });

        logger.info(
          `Credits deducted for ${businessId}: ${creditsToDeduct} credits, remaining: ${updated.remainingCredits}`,
        );

        return {
          success: true,
          remainingCredits: updated.remainingCredits,
          logId: log.id,
        };
      } catch (error) {
        logger.error(`Failed to deduct credits for ${businessId}:`, error);
        throw error;
      }
    });

    return txn;
  }

  /**
   * Refund credits (for failed operations or customer support)
   * @param {string} businessId - Business ID
   * @param {number} creditsToRefund - Credits to restore
   * @param {string} reason - Reason for refund
   * @param {string} referenceId - Optional reference to original transaction
   * @returns {Promise<{success: boolean, newBalance: number}>}
   */
  static async refundCredits(businessId, creditsToRefund, reason, referenceId) {
    try {
      const updated = await prisma.subscription.update({
        where: { businessId },
        data: {
          remainingCredits: {
            increment: creditsToRefund,
          },
        },
      });

      // Log refund
      await prisma.creditLog.create({
        data: {
          businessId,
          taskType: "REFUND",
          creditsDeducted: -creditsToRefund, // Negative for refund
          remainingCredits: updated.remainingCredits,
          metadata: JSON.stringify({
            reason,
            referenceId,
          }),
          timestamp: new Date(),
        },
      });

      logger.info(
        `Refunded ${creditsToRefund} credits to ${businessId}: ${reason}`,
      );

      return { success: true, newBalance: updated.remainingCredits };
    } catch (error) {
      logger.error(`Failed to refund credits for ${businessId}:`, error);
      throw error;
    }
  }

  /**
   * Reset monthly credits at billing period boundary
   * @param {string} businessId - Business ID
   * @returns {Promise<{success: boolean, newCredits: number}>}
   */
  static async resetMonthlyCredits(businessId) {
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { businessId },
        include: { pricingPlan: true },
      });

      if (!subscription) {
        throw new Error("No subscription found");
      }

      // Calculate new billing period
      const now = new Date();
      const nextPeriodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      // Update subscription with new credits and period
      const updated = await prisma.subscription.update({
        where: { businessId },
        data: {
          remainingCredits: subscription.pricingPlan.monthlyAICredits,
          currentPeriodStart: now,
          currentPeriodEnd: nextPeriodEnd,
        },
      });

      // Log the reset
      await prisma.creditLog.create({
        data: {
          businessId,
          taskType: "MONTHLY_RESET",
          creditsDeducted: 0,
          remainingCredits: updated.remainingCredits,
          metadata: JSON.stringify({
            periodStart: now,
            periodEnd: nextPeriodEnd,
          }),
          timestamp: now,
        },
      });

      logger.info(
        `Monthly credits reset for ${businessId}: ${updated.remainingCredits} available`,
      );

      return { success: true, newCredits: updated.remainingCredits };
    } catch (error) {
      logger.error(`Failed to reset monthly credits for ${businessId}:`, error);
      throw error;
    }
  }

  /**
   * Get credit usage analytics for a business
   * @param {string} businessId - Business ID
   * @returns {Promise<{totalUsed: number, remaining: number, byTaskType: object, breakdown: array}>}
   */
  static async getUsageAnalytics(businessId) {
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { businessId },
        include: { pricingPlan: true },
      });

      if (!subscription) {
        return { totalUsed: 0, remaining: 0, byTaskType: {} };
      }

      // Get logs for current billing period
      const logs = await prisma.creditLog.findMany({
        where: {
          businessId,
          timestamp: {
            gte: subscription.currentPeriodStart,
            lte: subscription.currentPeriodEnd,
          },
        },
        orderBy: { timestamp: "desc" },
      });

      // Aggregate by task type
      const byTaskType = {};
      let totalUsed = 0;

      logs.forEach((log) => {
        if (log.creditsDeducted > 0) {
          byTaskType[log.taskType] =
            (byTaskType[log.taskType] || 0) + log.creditsDeducted;
          totalUsed += log.creditsDeducted;
        }
      });

      const usagePercent = Math.round(
        (totalUsed / subscription.pricingPlan.monthlyAICredits) * 100,
      );

      return {
        totalUsed,
        remaining: subscription.remainingCredits,
        monthly: subscription.pricingPlan.monthlyAICredits,
        usagePercent,
        byTaskType,
        breakdown: logs.slice(0, 50), // Last 50 transactions
      };
    } catch (error) {
      logger.error(`Failed to get usage analytics for ${businessId}:`, error);
      return { totalUsed: 0, remaining: 0, byTaskType: {}, breakdown: [] };
    }
  }

  /**
   * Get credit status for a business (for UI display)
   * @param {string} businessId - Business ID
   * @returns {Promise<object>}
   */
  static async getStatus(businessId) {
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { businessId },
        include: { pricingPlan: true },
      });

      if (!subscription) {
        return { status: "NO_SUBSCRIPTION", credits: 0 };
      }

      const now = new Date();
      const isExpired = subscription.currentPeriodEnd < now;

      return {
        status: subscription.status,
        plan: subscription.pricingPlan.name,
        credits: subscription.remainingCredits,
        monthlyLimit: subscription.pricingPlan.monthlyAICredits,
        periodEnd: subscription.currentPeriodEnd,
        isExpired,
        usagePercent: Math.round(
          ((subscription.pricingPlan.monthlyAICredits -
            subscription.remainingCredits) /
            subscription.pricingPlan.monthlyAICredits) *
            100,
        ),
      };
    } catch (error) {
      logger.error(`Failed to get credit status for ${businessId}:`, error);
      return { status: "ERROR", credits: 0 };
    }
  }
}

export default CreditManagerService;
