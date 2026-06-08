/**
 * OrderService.js
 *
 * Handles order management in conversational context:
 * - Convert customer messages into structured orders
 * - Generate AI-assisted order summaries
 * - Track order status and history
 * - Create invoices from orders
 * - Support partial orders and amendments
 *
 * Integration points:
 * - AIRouterService: For order understanding and summaries
 * - InvoiceService: For invoice generation
 * - WebhookHandler: For order notifications
 */

import { PrismaClient, OrderStatus } from "@prisma/client";
import AIRouterService from "./AIRouterService.js";
import logger from "../utils/logger.js";

const prisma = new PrismaClient();

class OrderService {
  /**
   * Create a new order from conversation
   * @param {string} businessId - Business ID
   * @param {string} customerId - Customer ID
   * @param {object} orderData - Order data
   * @returns {Promise<object>}
   */
  static async createOrder(
    businessId,
    customerId,
    { items = [], totalAmount = 0, notes = "", conversationContext = {} } = {},
  ) {
    try {
      const order = await prisma.order.create({
        data: {
          businessId,
          customerId,
          items: JSON.stringify(items),
          totalAmount,
          notes,
          status: OrderStatus.PENDING,
          metadata: JSON.stringify(conversationContext),
          createdAt: new Date(),
        },
      });

      logger.info(
        `Order created: ${order.id} for business ${businessId}, customer ${customerId}`,
      );

      return order;
    } catch (error) {
      logger.error(`Failed to create order: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update order with AI-generated summary
   * @param {string} orderId - Order ID
   * @param {object} businessInfo - Business information
   * @returns {Promise<object>}
   */
  static async generateOrderSummary(orderId, businessInfo = {}) {
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { customer: true },
      });

      if (!order) {
        throw new Error("Order not found");
      }

      // Parse items
      const items = JSON.parse(order.items || "[]");
      const metadata = JSON.parse(order.metadata || "{}");

      // Build prompt for AI summary
      const systemPrompt = `You are a professional order confirmation system. Generate a clear, professional order summary from the provided order data. 
      Keep it concise but complete. Include order number, items, quantities, prices, and total.
      Format as a professional business communication.`;

      const userMessage = `
      Generate an order summary:
      Customer: ${order.customer?.name || "Customer"}
      Items: ${JSON.stringify(items)}
      Total: ${order.totalAmount}
      Special notes: ${order.notes || "None"}
      `;

      // Generate summary using AI
      const aiResult = await AIRouterService.generateResponse({
        businessId: order.businessId,
        taskType: "ORDER_SUMMARY",
        systemPrompt,
        userMessage,
      });

      // Update order with summary
      const updated = await prisma.order.update({
        where: { id: orderId },
        data: {
          summary: aiResult.text,
          status: OrderStatus.CONFIRMED,
        },
      });

      logger.info(`Order summary generated for order ${orderId}`);

      return updated;
    } catch (error) {
      logger.error(`Failed to generate order summary: ${error.message}`);
      throw error;
    }
  }

  /**
   * Extract order details from conversation using AI
   * @param {string} businessId - Business ID
   * @param {string} customerMessage - Customer's message
   * @param {array} conversationHistory - Previous messages
   * @returns {Promise<{items: array, totalAmount: number, confidence: number}>}
   */
  static async extractOrderDetails(
    businessId,
    customerMessage,
    conversationHistory = [],
  ) {
    try {
      const systemPrompt = `You are an expert order extraction system. 
      Extract order details from customer messages.
      Respond ONLY with valid JSON (no other text):
      {
        "items": [{"name": "product", "quantity": 1, "unitPrice": 0}],
        "totalAmount": 0,
        "confidence": 0.95,
        "reasoning": "why you extracted this"
      }
      If no order details found, return confidence: 0.`;

      const result = await AIRouterService.generateResponse({
        businessId,
        taskType: "ORDER_SUMMARY",
        systemPrompt,
        userMessage: customerMessage,
        conversationHistory,
      });

      try {
        const orderData = JSON.parse(result.text);
        return orderData;
      } catch (e) {
        logger.warn("Failed to parse order extraction JSON, returning empty");
        return {
          items: [],
          totalAmount: 0,
          confidence: 0,
          parsing_error: true,
        };
      }
    } catch (error) {
      logger.error(`Failed to extract order details: ${error.message}`);
      return { items: [], totalAmount: 0, confidence: 0 };
    }
  }

  /**
   * Get order by ID with full details
   * @param {string} orderId - Order ID
   * @returns {Promise<object>}
   */
  static async getOrder(orderId) {
    try {
      return await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          customer: true,
          invoices: true,
        },
      });
    } catch (error) {
      logger.error(`Failed to get order: ${error.message}`);
      throw error;
    }
  }

  /**
   * List orders for a business
   * @param {string} businessId - Business ID
   * @param {object} filters - Filter options
   * @returns {Promise<array>}
   */
  static async listOrders(businessId, { status, limit = 50, offset = 0 } = {}) {
    try {
      const where = { businessId };
      if (status) where.status = status;

      return await prisma.order.findMany({
        where,
        include: { customer: true },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      });
    } catch (error) {
      logger.error(`Failed to list orders: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update order status
   * @param {string} orderId - Order ID
   * @param {string} newStatus - New status (PENDING, CONFIRMED, PROCESSING, DELIVERED, CANCELLED)
   * @returns {Promise<object>}
   */
  static async updateOrderStatus(orderId, newStatus) {
    try {
      const order = await prisma.order.update({
        where: { id: orderId },
        data: {
          status: newStatus,
          updatedAt: new Date(),
        },
      });

      logger.info(`Order ${orderId} status updated to ${newStatus}`);

      // TODO: Send status update notification to customer via WhatsApp
      // await notifyCustomerOrderStatus(order);

      return order;
    } catch (error) {
      logger.error(`Failed to update order status: ${error.message}`);
      throw error;
    }
  }

  /**
   * Cancel an order
   * @param {string} orderId - Order ID
   * @param {string} reason - Cancellation reason
   * @returns {Promise<object>}
   */
  static async cancelOrder(orderId, reason = "") {
    try {
      const order = await prisma.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CANCELLED,
          notes: `${order.notes || ""}\n[CANCELLED] ${reason}`,
          updatedAt: new Date(),
        },
      });

      logger.info(`Order ${orderId} cancelled: ${reason}`);

      // TODO: Send cancellation notification
      // await notifyCustomerOrderCancellation(order, reason);

      return order;
    } catch (error) {
      logger.error(`Failed to cancel order: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get order analytics for dashboard
   * @param {string} businessId - Business ID
   * @param {object} options - Time range options
   * @returns {Promise<object>}
   */
  static async getAnalytics(
    businessId,
    { daysBack = 30, groupBy = "day" } = {},
  ) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      const orders = await prisma.order.findMany({
        where: {
          businessId,
          createdAt: { gte: startDate },
        },
      });

      // Calculate metrics
      const metrics = {
        total: orders.length,
        totalRevenue: orders.reduce((sum, o) => sum + o.totalAmount, 0),
        average:
          orders.length > 0
            ? orders.reduce((sum, o) => sum + o.totalAmount, 0) / orders.length
            : 0,
        byStatus: {},
      };

      // Group by status
      orders.forEach((o) => {
        metrics.byStatus[o.status] = (metrics.byStatus[o.status] || 0) + 1;
      });

      logger.info(
        `Order analytics: ${metrics.total} orders, ${metrics.totalRevenue} revenue`,
      );

      return metrics;
    } catch (error) {
      logger.error(`Failed to get order analytics: ${error.message}`);
      return { total: 0, totalRevenue: 0, average: 0, byStatus: {} };
    }
  }
}

export default OrderService;
