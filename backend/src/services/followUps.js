import { prisma } from "../lib/prisma.js";
import { sendCustomerFollowUpTemplate } from "./whatsapp.js";

const DEFAULT_FOLLOW_UP_DELAY_HOURS = 24;
let hasWarnedMissingFollowUpColumns = false;

const parseFollowUpDelayHours = (value) => {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed >= 1) {
    return parsed;
  }

  return DEFAULT_FOLLOW_UP_DELAY_HOURS;
};

const isFollowUpEnabled = (trainingData) => {
  if (!trainingData || typeof trainingData !== "object") return true;
  if (typeof trainingData.followUpEnabled === "boolean") {
    return trainingData.followUpEnabled;
  }
  return true;
};

const isMissingFollowUpColumnError = (error) => {
  if (!error) return false;
  const message = String(error.message || "").toLowerCase();
  return (
    message.includes("unknown argument `followupsentat`") ||
    message.includes("unknown argument `followupcount`")
  );
};

const warnMissingFollowUpColumnsOnce = () => {
  if (hasWarnedMissingFollowUpColumns) return;

  hasWarnedMissingFollowUpColumns = true;
  console.warn(
    "[FollowUps] followUpSentAt/followUpCount columns are missing in Conversation table. Follow-up sending is paused until DB migration is applied.",
  );
};

const findEligibleConversations = async ({
  businessId,
  cutoff,
  limit,
  includeLegacyWithoutTracking = false,
}) => {
  try {
    return await prisma.conversation.findMany({
      where: {
        businessId,
        status: "AI_ACTIVE",
        followUpSentAt: null,
        lastMessageAt: { lt: cutoff },
      },
      include: {
        customer: true,
      },
      take: limit,
      orderBy: { lastMessageAt: "asc" },
    });
  } catch (error) {
    if (!isMissingFollowUpColumnError(error)) {
      throw error;
    }

    warnMissingFollowUpColumnsOnce();

    if (!includeLegacyWithoutTracking) {
      return [];
    }

    const legacyRows = await prisma.conversation.findMany({
      where: {
        businessId,
        status: "AI_ACTIVE",
        lastMessageAt: { lt: cutoff },
      },
      include: {
        customer: true,
      },
      take: limit,
      orderBy: { lastMessageAt: "asc" },
    });

    return legacyRows.map((row) => ({
      ...row,
      followUpCount:
        typeof row.followUpCount === "number" ? row.followUpCount : 0,
    }));
  }
};

export const getFollowUpQueue = async (businessId = null, limit = 50) => {
  const businesses = await prisma.business.findMany({
    where: businessId ? { id: businessId } : undefined,
    select: {
      id: true,
      name: true,
      whatsappPhoneNumberId: true,
      whatsappBusinessNumber: true,
      aiTrainingData: true,
    },
  });

  const queue = [];
  const now = Date.now();

  for (const business of businesses) {
    const trainingData =
      business.aiTrainingData && typeof business.aiTrainingData === "object"
        ? business.aiTrainingData
        : {};

    if (!isFollowUpEnabled(trainingData)) continue;

    const followUpDelayHours = parseFollowUpDelayHours(
      trainingData.followUpDelayHours,
    );
    const cutoff = new Date(now - followUpDelayHours * 60 * 60 * 1000);

    const conversations = await findEligibleConversations({
      businessId: business.id,
      cutoff,
      limit,
      includeLegacyWithoutTracking: true,
    });

    for (const conversation of conversations) {
      queue.push({
        businessId: business.id,
        businessName: business.name,
        conversationId: conversation.id,
        customerId: conversation.customerId,
        customerName:
          conversation.customer?.name ||
          conversation.customer?.waId ||
          "Customer",
        customerWaId: conversation.customer?.waId,
        lastMessageAt: conversation.lastMessageAt,
        followUpDelayHours,
        followUpCount: conversation.followUpCount,
      });
    }
  }

  return queue.slice(0, limit);
};

export const runSalesFollowUpScan = async (businessId = null) => {
  const businesses = await prisma.business.findMany({
    where: businessId ? { id: businessId } : undefined,
    select: {
      id: true,
      name: true,
      whatsappPhoneNumberId: true,
      whatsappBusinessNumber: true,
      aiTrainingData: true,
    },
  });

  const now = Date.now();

  for (const business of businesses) {
    const trainingData =
      business.aiTrainingData && typeof business.aiTrainingData === "object"
        ? business.aiTrainingData
        : {};

    if (!isFollowUpEnabled(trainingData)) {
      continue;
    }

    const followUpDelayHours = parseFollowUpDelayHours(
      trainingData.followUpDelayHours,
    );
    const followUpMessage =
      typeof trainingData.followUpMessage === "string" &&
      trainingData.followUpMessage.trim()
        ? trainingData.followUpMessage
        : "Hi {{name}}, just checking in. Would you like me to help you get started?";

    const cutoff = new Date(now - followUpDelayHours * 60 * 60 * 1000);

    const conversations = await findEligibleConversations({
      businessId: business.id,
      cutoff,
      limit: 50,
      includeLegacyWithoutTracking: false,
    });

    for (const conversation of conversations) {
      const customerName =
        conversation.customer?.name ||
        conversation.customer?.waId ||
        "Customer";

      try {
        await sendCustomerFollowUpTemplate({
          phoneNumberId: business.whatsappPhoneNumberId,
          customerWhatsAppNumber: conversation.customer?.waId,
          customerName,
          followUpMessage,
        });

        await prisma.conversation.update({
          where: { id: conversation.id },
          data: {
            followUpSentAt: new Date(),
            followUpCount: { increment: 1 },
          },
        });
      } catch (error) {
        console.error("[FollowUps] Failed to send sales follow-up", {
          businessId: business.id,
          conversationId: conversation.id,
          message: error.message || "Unknown error",
          code: error.code,
          statusCode: error.response?.status,
          responseData: error.response?.data,
          customerWhatsAppNumber: conversation.customer?.waId,
          customerName,
        });
      }
    }
  }
};
