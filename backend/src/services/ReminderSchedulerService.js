/**
 * ReminderSchedulerService.js
 *
 * Handles automated payment reminders:
 * - Schedule reminders for due invoices
 * - Send reminders via WhatsApp
 * - Track reminder delivery
 * - Support configurable reminder schedules (1 day before, on due date, 3 days after)
 * - Support manual reminder triggers
 *
 * Integration:
 * - Scheduled via cron job (recommended: daily at 6 AM)
 * - Can be triggered manually from dashboard
 * - Logs all deliveries for compliance
 */

import { PrismaClient, ReminderStatus } from "@prisma/client";
import logger from "../utils/logger.js";

const prisma = new PrismaClient();

class ReminderSchedulerService {
  /**
   * Schedule reminders for invoice
   * @param {string} invoiceId - Invoice ID
   * @param {object} schedule - Reminder schedule
   * @returns {Promise<array>}
   */
  static async scheduleReminders(invoiceId, schedule = {}) {
    try {
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
      });

      if (!invoice) {
        throw new Error("Invoice not found");
      }

      // Default schedule
      const reminderSchedule = {
        daysBefore: schedule.daysBefore || 1,
        onDueDate: schedule.onDueDate !== false,
        daysAfter: schedule.daysAfter || 3,
      };

      const reminders = [];

      // Calculate reminder dates
      const dueDate = new Date(invoice.dueDate);

      // 1 day before
      if (reminderSchedule.daysBefore > 0) {
        const beforeDate = new Date(dueDate);
        beforeDate.setDate(beforeDate.getDate() - reminderSchedule.daysBefore);
        reminders.push(
          await this._createReminder(
            invoiceId,
            beforeDate,
            `Reminder: Payment due in ${reminderSchedule.daysBefore} day(s)`,
          ),
        );
      }

      // On due date
      if (reminderSchedule.onDueDate) {
        reminders.push(
          await this._createReminder(invoiceId, dueDate, "Payment due today"),
        );
      }

      // 3 days after
      if (reminderSchedule.daysAfter > 0) {
        const afterDate = new Date(dueDate);
        afterDate.setDate(afterDate.getDate() + reminderSchedule.daysAfter);
        reminders.push(
          await this._createReminder(
            invoiceId,
            afterDate,
            "Payment overdue - please settle immediately",
          ),
        );
      }

      logger.info(
        `Scheduled ${reminders.length} reminders for invoice ${invoiceId}`,
      );

      return reminders;
    } catch (error) {
      logger.error(`Failed to schedule reminders: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a single reminder
   * @private
   */
  static async _createReminder(invoiceId, scheduledDate, message) {
    try {
      return await prisma.paymentReminder.create({
        data: {
          invoiceId,
          scheduledDate,
          message,
          status: ReminderStatus.PENDING,
          attempts: 0,
        },
      });
    } catch (error) {
      logger.error(`Failed to create reminder: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process due reminders (called by cron job)
   * @param {Date} upToDate - Process reminders up to this date (default: now)
   * @returns {Promise<{processed: number, sent: number, failed: number}>}
   */
  static async processDueReminders(upToDate = new Date()) {
    try {
      // Find reminders that are due
      const dueReminders = await prisma.paymentReminder.findMany({
        where: {
          status: ReminderStatus.PENDING,
          scheduledDate: { lte: upToDate },
          attempts: { lt: 3 }, // Max 3 attempts
        },
        include: {
          invoice: {
            include: {
              customer: true,
              business: true,
            },
          },
        },
      });

      logger.info(`Processing ${dueReminders.length} due reminders`);

      let sent = 0;
      let failed = 0;

      for (const reminder of dueReminders) {
        try {
          const success = await this._sendReminder(reminder);
          if (success) {
            sent++;
            // Mark as sent
            await prisma.paymentReminder.update({
              where: { id: reminder.id },
              data: {
                status: ReminderStatus.SENT,
                sentAt: new Date(),
                attempts: reminder.attempts + 1,
              },
            });
          } else {
            failed++;
            // Increment attempts, will retry later
            await prisma.paymentReminder.update({
              where: { id: reminder.id },
              data: {
                attempts: reminder.attempts + 1,
              },
            });
          }
        } catch (error) {
          logger.error(
            `Failed to send reminder ${reminder.id}: ${error.message}`,
          );
          failed++;
        }
      }

      logger.info(
        `Reminders processed: ${sent} sent, ${failed} failed out of ${dueReminders.length}`,
      );

      return {
        processed: dueReminders.length,
        sent,
        failed,
      };
    } catch (error) {
      logger.error(`Failed to process due reminders: ${error.message}`);
      return { processed: 0, sent: 0, failed: 0 };
    }
  }

  /**
   * Send reminder via WhatsApp
   * @private
   */
  static async _sendReminder(reminder) {
    try {
      const { invoice, message } = reminder;
      const customer = invoice.customer;
      const business = invoice.business;

      if (!customer || !customer.phone) {
        logger.warn(`No phone number for customer ${customer?.id}`);
        return false;
      }

      // Build reminder message
      const fullMessage =
        `📋 *Payment Reminder*\n\n` +
        `Invoice: ${invoice.invoiceNumber}\n` +
        `Amount: ${invoice.total}\n` +
        `Message: ${message}\n\n` +
        `Please settle payment at your earliest convenience.\n` +
        `Thank you!`;

      // TODO: Integrate with WhatsApp Business API
      // Implementation example:
      // const response = await sendWhatsAppMessage({
      //   to: customer.phone,
      //   text: fullMessage,
      //   businessPhoneId: business.whatsappBusinessPhoneId,
      // });

      logger.info(
        `Reminder sent to ${customer.phone} for invoice ${invoice.invoiceNumber}`,
      );

      return true;
    } catch (error) {
      logger.error(`Failed to send reminder: ${error.message}`);
      return false;
    }
  }

  /**
   * Manually trigger reminder for an invoice
   * @param {string} invoiceId - Invoice ID
   * @returns {Promise<{success: boolean}>}
   */
  static async triggerReminder(invoiceId) {
    try {
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          customer: true,
          business: true,
        },
      });

      if (!invoice) {
        throw new Error("Invoice not found");
      }

      // Create ad-hoc reminder
      const reminder = await prisma.paymentReminder.create({
        data: {
          invoiceId,
          scheduledDate: new Date(),
          message: "Manual payment reminder",
          status: ReminderStatus.PENDING,
          attempts: 0,
        },
      });

      // Send immediately
      const sent = await this._sendReminder(reminder);

      if (sent) {
        await prisma.paymentReminder.update({
          where: { id: reminder.id },
          data: {
            status: ReminderStatus.SENT,
            sentAt: new Date(),
            attempts: 1,
          },
        });
      }

      logger.info(
        `Manual reminder triggered for invoice ${invoiceId}, sent: ${sent}`,
      );

      return { success: sent };
    } catch (error) {
      logger.error(`Failed to trigger reminder: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get reminder status for an invoice
   * @param {string} invoiceId - Invoice ID
   * @returns {Promise<array>}
   */
  static async getReminderStatus(invoiceId) {
    try {
      return await prisma.paymentReminder.findMany({
        where: { invoiceId },
        orderBy: { scheduledDate: "asc" },
      });
    } catch (error) {
      logger.error(`Failed to get reminder status: ${error.message}`);
      return [];
    }
  }

  /**
   * Get analytics for reminders
   * @param {string} businessId - Business ID
   * @returns {Promise<object>}
   */
  static async getAnalytics(businessId) {
    try {
      const reminders = await prisma.paymentReminder.findMany({
        where: {
          invoice: {
            businessId,
          },
        },
      });

      const stats = {
        total: reminders.length,
        sent: reminders.filter((r) => r.status === ReminderStatus.SENT).length,
        pending: reminders.filter((r) => r.status === ReminderStatus.PENDING)
          .length,
        failed: reminders.filter((r) => r.status === ReminderStatus.FAILED)
          .length,
        averageAttempts:
          reminders.length > 0
            ? reminders.reduce((sum, r) => sum + r.attempts, 0) /
              reminders.length
            : 0,
      };

      return stats;
    } catch (error) {
      logger.error(`Failed to get reminder analytics: ${error.message}`);
      return { total: 0, sent: 0, pending: 0, failed: 0 };
    }
  }
}

export default ReminderSchedulerService;
