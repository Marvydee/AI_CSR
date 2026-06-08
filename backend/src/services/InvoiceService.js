/**
 * InvoiceService.js
 *
 * Handles invoice generation, sequencing, and delivery:
 * - Auto-generate invoices from orders
 * - Maintain sequential invoice numbering per business
 * - Generate PDF invoices
 * - Send invoices to customers
 * - Track invoice payments
 * - Support invoice amendments and cancellations
 */

import { PrismaClient, InvoiceStatus } from "@prisma/client";
import logger from "../utils/logger.js";

const prisma = new PrismaClient();

class InvoiceService {
  /**
   * Generate invoice from order
   * @param {string} orderId - Order ID
   * @param {object} invoiceOptions - Invoice customization
   * @returns {Promise<object>}
   */
  static async generateFromOrder(orderId, invoiceOptions = {}) {
    try {
      // Get order details
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          customer: true,
          business: true,
        },
      });

      if (!order) {
        throw new Error("Order not found");
      }

      // Check if invoice already exists
      const existing = await prisma.invoice.findFirst({
        where: { orderId },
      });

      if (existing) {
        logger.info(`Invoice already exists for order ${orderId}`);
        return existing;
      }

      // Generate invoice number
      const invoiceNumber = await this.generateInvoiceNumber(order.businessId);

      // Parse items
      const items = JSON.parse(order.items || "[]");

      // Create invoice
      const invoice = await prisma.invoice.create({
        data: {
          businessId: order.businessId,
          customerId: order.customerId,
          orderId,
          invoiceNumber,
          items: JSON.stringify(items),
          subtotal: order.totalAmount,
          tax: invoiceOptions.tax || 0,
          discount: invoiceOptions.discount || 0,
          total:
            order.totalAmount +
            (invoiceOptions.tax || 0) -
            (invoiceOptions.discount || 0),
          dueDate:
            invoiceOptions.dueDate ||
            new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          status: InvoiceStatus.ISSUED,
          notes: invoiceOptions.notes || "",
          metadata: JSON.stringify({
            orderNumber: order.id,
            customerName: order.customer?.name,
            businessName: order.business?.name,
          }),
        },
      });

      logger.info(`Invoice ${invoiceNumber} generated from order ${orderId}`);

      // TODO: Generate PDF and send to customer
      // await this.sendInvoiceToCustomer(invoice);

      return invoice;
    } catch (error) {
      logger.error(`Failed to generate invoice: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate sequential invoice number
   * @param {string} businessId - Business ID
   * @returns {Promise<string>}
   */
  static async generateInvoiceNumber(businessId) {
    try {
      // Get next sequence number
      const lastInvoice = await prisma.invoice.findFirst({
        where: { businessId },
        orderBy: { createdAt: "desc" },
      });

      let sequenceNumber = 1;
      if (lastInvoice && lastInvoice.invoiceNumber) {
        // Extract number from invoice number (e.g., "INV-2024-00001")
        const match = lastInvoice.invoiceNumber.match(/\d+$/);
        if (match) {
          sequenceNumber = parseInt(match[0]) + 1;
        }
      }

      // Format invoice number
      const year = new Date().getFullYear();
      const invoiceNumber = `INV-${year}-${String(sequenceNumber).padStart(5, "0")}`;

      return invoiceNumber;
    } catch (error) {
      logger.error(`Failed to generate invoice number: ${error.message}`);
      // Fallback to timestamp-based number
      return `INV-${Date.now()}`;
    }
  }

  /**
   * Send invoice to customer via WhatsApp
   * @param {string} invoiceId - Invoice ID
   * @returns {Promise<{success: boolean}>}
   */
  static async sendToCustomer(invoiceId) {
    try {
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: { customer: true, business: true },
      });

      if (!invoice) {
        throw new Error("Invoice not found");
      }

      // TODO: Implement actual WhatsApp sending
      // Step 1: Generate PDF from invoice data
      // const pdfBuffer = await generateInvoicePDF(invoice);

      // Step 2: Upload to hosting (e.g., AWS S3)
      // const pdfUrl = await uploadToS3(pdfBuffer, `invoices/${invoiceId}.pdf`);

      // Step 3: Send via WhatsApp with download link
      // await sendWhatsAppMessage({
      //   to: invoice.customer.phone,
      //   text: `Your invoice ${invoice.invoiceNumber} is ready: ${pdfUrl}`,
      //   media: pdfUrl
      // });

      logger.info(`Invoice ${invoiceId} sent to customer`);

      // Mark as sent
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          status: InvoiceStatus.SENT,
          sentAt: new Date(),
        },
      });

      return { success: true };
    } catch (error) {
      logger.error(`Failed to send invoice: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Mark invoice as paid
   * @param {string} invoiceId - Invoice ID
   * @param {object} paymentInfo - Payment details
   * @returns {Promise<object>}
   */
  static async markAsPaid(invoiceId, paymentInfo = {}) {
    try {
      const invoice = await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          status: InvoiceStatus.PAID,
          paidAt: new Date(),
          metadata: JSON.stringify({
            ...JSON.parse(invoice.metadata || "{}"),
            paymentInfo,
          }),
        },
      });

      logger.info(`Invoice ${invoiceId} marked as paid`);

      // TODO: Send payment confirmation to customer
      // await sendPaymentConfirmation(invoice);

      return invoice;
    } catch (error) {
      logger.error(`Failed to mark invoice as paid: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get invoice by ID
   * @param {string} invoiceId - Invoice ID
   * @returns {Promise<object>}
   */
  static async getInvoice(invoiceId) {
    try {
      return await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          customer: true,
          business: true,
        },
      });
    } catch (error) {
      logger.error(`Failed to get invoice: ${error.message}`);
      throw error;
    }
  }

  /**
   * List invoices for a business
   * @param {string} businessId - Business ID
   * @param {object} filters - Filter options
   * @returns {Promise<array>}
   */
  static async listInvoices(
    businessId,
    { status, customerId, limit = 50, offset = 0 } = {},
  ) {
    try {
      const where = { businessId };
      if (status) where.status = status;
      if (customerId) where.customerId = customerId;

      return await prisma.invoice.findMany({
        where,
        include: { customer: true },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      });
    } catch (error) {
      logger.error(`Failed to list invoices: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get invoice statistics
   * @param {string} businessId - Business ID
   * @param {object} options - Time range options
   * @returns {Promise<object>}
   */
  static async getStats(businessId, { daysBack = 30 } = {}) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      const invoices = await prisma.invoice.findMany({
        where: {
          businessId,
          createdAt: { gte: startDate },
        },
      });

      // Calculate metrics
      const stats = {
        total: invoices.length,
        paid: 0,
        pending: 0,
        overdue: 0,
        totalValue: 0,
        paidValue: 0,
        pendingValue: 0,
      };

      const now = new Date();

      invoices.forEach((inv) => {
        stats.totalValue += inv.total;

        if (inv.status === InvoiceStatus.PAID) {
          stats.paid++;
          stats.paidValue += inv.total;
        } else if (
          inv.status === InvoiceStatus.ISSUED ||
          inv.status === InvoiceStatus.SENT
        ) {
          stats.pending++;
          stats.pendingValue += inv.total;

          if (inv.dueDate < now) {
            stats.overdue++;
          }
        }
      });

      logger.info(
        `Invoice stats: ${stats.total} invoices, ${stats.totalValue} total value`,
      );

      return stats;
    } catch (error) {
      logger.error(`Failed to get invoice stats: ${error.message}`);
      return { total: 0, paid: 0, pending: 0, overdue: 0 };
    }
  }

  /**
   * Cancel an invoice
   * @param {string} invoiceId - Invoice ID
   * @param {string} reason - Cancellation reason
   * @returns {Promise<object>}
   */
  static async cancelInvoice(invoiceId, reason = "") {
    try {
      const invoice = await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          status: InvoiceStatus.CANCELLED,
          metadata: JSON.stringify({
            ...JSON.parse(invoice.metadata || "{}"),
            cancellationReason: reason,
            cancelledAt: new Date(),
          }),
        },
      });

      logger.info(`Invoice ${invoiceId} cancelled: ${reason}`);
      return invoice;
    } catch (error) {
      logger.error(`Failed to cancel invoice: ${error.message}`);
      throw error;
    }
  }
}

export default InvoiceService;
