/**
 * CreditCheckMiddleware.js
 *
 * Express middleware to check credits before AI operations.
 * Returns 402 (Payment Required) if credits exhausted.
 *
 * Usage:
 *   app.post('/api/ai/reply', creditCheckMiddleware(), handleReply);
 *
 * Or with task type:
 *   app.post('/api/orders/summary', creditCheckMiddleware('ORDER_SUMMARY'), generateSummary);
 */

import CreditManagerService from "../services/CreditManagerService.js";
import logger from "../utils/logger.js";

/**
 * Create credit check middleware
 * @param {string} taskType - Optional task type (default: TEXT_MESSAGE)
 * @param {number} estimatedCredits - Optional estimated credits needed (default: 1)
 * @returns {function} Express middleware
 */
export function creditCheckMiddleware(
  taskType = "TEXT_MESSAGE",
  estimatedCredits = 1,
) {
  return async (req, res, next) => {
    try {
      const businessId = req.user?.businessId || req.business?.id;

      if (!businessId) {
        logger.warn("No business ID in credit check");
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Check credits
      const check = await CreditManagerService.hasCredits(
        businessId,
        taskType,
        estimatedCredits,
      );

      if (!check.available) {
        logger.info(
          `[CreditGate] Credit exhaustion: ${businessId}, task: ${taskType}, shortage: ${check.shortage}`,
        );

        return res.status(402).json({
          error: "Insufficient credits",
          remaining: check.remaining,
          required: estimatedCredits,
          shortage: check.shortage,
          message: `You need ${check.shortage} more credits. Please upgrade your plan.`,
        });
      }

      // Store credit info for later use
      req.creditCheck = {
        taskType,
        estimatedCredits,
        remaining: check.remaining,
      };

      logger.debug(
        `[CreditGate] ✓ ${businessId} has sufficient credits: ${check.remaining} remaining`,
      );

      next();
    } catch (error) {
      logger.error("Credit check middleware error:", error);
      // Fail open but log issue
      next();
    }
  };
}

/**
 * Middleware to track and deduct credits after successful operation
 * Should be called in route handler after successful AI operation
 * @param {string} taskType - Task type
 * @param {number} creditsUsed - Credits actually used
 * @param {object} metadata - Metadata to log
 * @returns {Promise<{success: boolean}>}
 */
export async function deductCreditsAfterOperation(
  req,
  taskType,
  creditsUsed,
  metadata = {},
) {
  try {
    const businessId = req.user?.businessId || req.business?.id;

    if (!businessId) {
      logger.warn("No business ID for credit deduction");
      return { success: false };
    }

    const result = await CreditManagerService.deductCredits(
      businessId,
      taskType,
      creditsUsed,
      {
        ...metadata,
        timestamp: new Date(),
      },
    );

    logger.info(
      `[CreditDeduct] ${businessId} deducted ${creditsUsed} credits for ${taskType}`,
    );

    return result;
  } catch (error) {
    logger.error("Failed to deduct credits:", error);
    // Don't fail operation if logging fails
    return { success: false, error: error.message };
  }
}

/**
 * Express route handler wrapper that automatically deducts credits
 * @param {function} handler - Original handler function
 * @param {string} taskType - Task type for credit deduction
 * @returns {function} Wrapped handler
 */
export function withCreditDeduction(handler, taskType) {
  return async (req, res, next) => {
    try {
      // Call original handler but intercept response
      const originalJson = res.json;
      const originalSend = res.send;

      let deducted = false;

      res.json = function (data) {
        if (!deducted && res.statusCode === 200) {
          // Deduct credits on successful response
          const creditsUsed = req.creditsUsed || 1;
          CreditManagerService.deductCredits(
            req.user?.businessId || req.business?.id,
            taskType,
            creditsUsed,
            { route: req.path },
          ).catch((e) => logger.error("Credit deduction failed:", e));
          deducted = true;
        }
        return originalJson.call(this, data);
      };

      res.send = function (data) {
        if (!deducted && res.statusCode === 200) {
          // Deduct credits on successful response
          const creditsUsed = req.creditsUsed || 1;
          CreditManagerService.deductCredits(
            req.user?.businessId || req.business?.id,
            taskType,
            creditsUsed,
            { route: req.path },
          ).catch((e) => logger.error("Credit deduction failed:", e));
          deducted = true;
        }
        return originalSend.call(this, data);
      };

      await handler(req, res, next);
    } catch (error) {
      logger.error("Handler error:", error);
      next(error);
    }
  };
}

export default creditCheckMiddleware;
