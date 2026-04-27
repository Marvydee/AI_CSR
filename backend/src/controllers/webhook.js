import { MessageDirection, ConversationStatus, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import {
  inferToggleType,
  shouldAutoSendReply,
  shouldDraftForApproval,
  shouldForceHuman,
} from "../config/toggles.js";
import {
  buildStrictSystemPrompt,
  detectHumanRequest,
  createGuardRail,
} from "../services/guardrails.js";
import { generateReply } from "../services/ai_engine.js";
import {
  sendOwnerDraftNotification,
  sendOwnerHandoffNotification,
  sendWhatsAppText,
} from "../services/whatsapp.js";
import { ensureDatabaseTimestampsAreValid } from "../utils/repairTimestamps.js";

const isPlaceholderCustomerName = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (!normalized) return true;

  return new Set([
    "customer",
    "john doe",
    "jane doe",
    "test",
    "test user",
    "example",
    "sample",
  ]).has(normalized);
};

const resolveKnownCustomerName = (value) => {
  const candidate = String(value || "").trim();
  if (!candidate) return null;
  if (isPlaceholderCustomerName(candidate)) return null;
  if (/\d{5,}/.test(candidate)) return null;
  return candidate;
};

const normalizeExtractedName = (value) => {
  const normalized = String(value || "")
    .replace(/[.,!?;:()\[\]{}"`~@#$%^&*_+=\\/<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return null;

  const words = normalized
    .split(" ")
    .map((word) => word.trim())
    .filter(Boolean);

  if (words.length === 0 || words.length > 3) return null;

  const invalidLeadWords = new Set([
    "looking",
    "interested",
    "trying",
    "need",
    "want",
    "sorry",
    "ready",
    "here",
    "there",
    "available",
    "okay",
    "ok",
    "hello",
    "hi",
  ]);

  if (invalidLeadWords.has(words[0].toLowerCase())) {
    return null;
  }

  const cleaned = words
    .map((word) => word.replace(/[^a-zA-Z'-]/g, ""))
    .filter(Boolean)
    .join(" ")
    .trim();

  if (!cleaned) return null;
  if (cleaned.length < 2 || cleaned.length > 40) return null;
  return cleaned;
};

const extractCustomerNameFromMessage = (text) => {
  const input = String(text || "").trim();
  if (!input) return null;

  const patterns = [
    /\bmy\s+name\s+is\s+([a-z][a-z\s'\-]{1,40})\b/i,
    /\b(?:i\s+am|i['’]m)\s+([a-z][a-z\s'\-]{1,40})\b/i,
    /\bcall\s+me\s+([a-z][a-z\s'\-]{1,40})\b/i,
    /\bthis\s+is\s+([a-z][a-z\s'\-]{1,40})\b/i,
    /\bna\s+([a-z][a-z\s'\-]{1,40})\s+be\s+my\s+name\b/i,
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (!match?.[1]) continue;

    const cleaned = normalizeExtractedName(match[1]);
    const resolved = resolveKnownCustomerName(cleaned);
    if (resolved) return resolved;
  }

  return null;
};

const getDayPeriod = (timeZone) => {
  try {
    const hourPart = new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      hour12: false,
      timeZone,
    })
      .formatToParts(new Date())
      .find((part) => part.type === "hour");

    const hour = Number(hourPart?.value || "12");
    if (!Number.isFinite(hour)) return "afternoon";
    if (hour < 12) return "morning";
    if (hour < 17) return "afternoon";
    return "evening";
  } catch {
    return "afternoon";
  }
};

const enforceReplyQuality = ({
  reply,
  customerName,
  isFirstOutbound,
  timeZone,
}) => {
  let normalized = String(reply || "").trim();
  if (!normalized) return normalized;

  const dayPeriod = getDayPeriod(timeZone || "Africa/Lagos");

  normalized = normalized.replace(
    /\bgood\s+(morning|afternoon|evening)\b/i,
    `Good ${dayPeriod}`,
  );

  if (!isFirstOutbound) {
    normalized = normalized.replace(
      /^\s*good\s+(morning|afternoon|evening)\b[^.!?]*[.!?]?\s*/i,
      "",
    );
  }

  if (!customerName) {
    normalized = normalized.replace(
      /\b(Good\s+(?:morning|afternoon|evening),\s*)([A-Z][a-z]+)\b/,
      "$1Customer",
    );

    normalized = normalized.replace(
      /\b(john\s+doe|john|jane\s+doe|jane)\b/gi,
      "Customer",
    );
  } else {
    normalized = normalized.replace(
      /\b(john\s+doe|john|jane\s+doe|jane)\b/gi,
      customerName,
    );
  }

  return normalized.trim();
};

const DEFAULT_CUSTOMER_FALLBACK_REPLY =
  "Thanks for your message. We’re unable to respond fully right now, but we’ll get back to you shortly.";

const normalizePhoneNumber = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";

  // Meta display numbers can include country code or local leading zeroes.
  if (digits.length === 11 && digits.startsWith("0")) {
    return digits.slice(1);
  }

  return digits;
};

const parseIncomingMessages = (payload) => {
  const all = [];
  const entries = payload?.entry || [];

  for (const entry of entries) {
    for (const change of entry?.changes || []) {
      if (change?.value?.messages?.length) {
        const phoneNumberId = change.value.metadata?.phone_number_id;
        const displayPhoneNumber =
          change.value.metadata?.display_phone_number || null;
        const contacts = change.value.contacts || [];
        const contactByWaId = new Map(
          contacts
            .filter((contact) => contact?.wa_id)
            .map((contact) => [contact.wa_id, contact]),
        );

        for (const msg of change.value.messages) {
          const text = msg?.text?.body || "";
          if (!text) continue;

          const matchedContact = contactByWaId.get(msg.from) || contacts[0];

          all.push({
            text,
            customerWaId: msg.from,
            customerName: isPlaceholderCustomerName(
              matchedContact?.profile?.name,
            )
              ? null
              : matchedContact?.profile?.name || null,
            phoneNumberId,
            displayPhoneNumber,
            metaMessageId: msg.id,
          });
        }
      }
    }
  }

  return all;
};

const getOrCreateCustomer = async ({ businessId, waId, name }) => {
  return prisma.customer.upsert({
    where: { businessId_waId: { businessId, waId } },
    update: name ? { name } : {},
    create: { businessId, waId, name },
  });
};

const getOrCreateConversation = async ({ businessId, customerId }) => {
  return prisma.conversation.upsert({
    where: { businessId_customerId: { businessId, customerId } },
    update: { lastMessageAt: new Date() },
    create: { businessId, customerId, status: ConversationStatus.AI_ACTIVE },
  });
};

const markHumanRequired = async ({ conversationId, reason }) => {
  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      status: ConversationStatus.HUMAN_REQUIRED,
      humanReason: reason,
      lastMessageAt: new Date(),
    },
  });
};

const isDatabaseConnectivityError = (error) => {
  if (!error) return false;

  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  if (error.code === "P1001" || error.code === "P1002") return true;

  const message = String(error.message || "").toLowerCase();
  return (
    message.includes("can't reach database server") ||
    message.includes("can't reach database") ||
    message.includes("connection timed out") ||
    message.includes("connection refused")
  );
};

const sendCustomerFallbackReply = async (
  incoming,
  replyText = DEFAULT_CUSTOMER_FALLBACK_REPLY,
) => {
  try {
    await sendWhatsAppText({
      phoneNumberId: incoming.phoneNumberId,
      to: incoming.customerWaId,
      text: replyText,
    });
  } catch (sendError) {
    console.error("[Webhook] Failed to send customer fallback reply", {
      message: sendError.message,
      customerWaId: incoming.customerWaId,
      phoneNumberId: incoming.phoneNumberId,
    });
  }
};

const sendDbOutageReply = async (incoming) => {
  const fallbackReply =
    process.env.DB_OUTAGE_REPLY || DEFAULT_CUSTOMER_FALLBACK_REPLY;

  await sendCustomerFallbackReply(incoming, fallbackReply);
};

const resolveBusinessFromIncoming = async (incoming) => {
  const byPhoneId = await prisma.business.findUnique({
    where: { whatsappPhoneNumberId: incoming.phoneNumberId },
  });

  if (byPhoneId) return byPhoneId;

  const normalizedDisplayNumber = normalizePhoneNumber(
    incoming.displayPhoneNumber,
  );
  if (!normalizedDisplayNumber) return null;

  const pendingBusinesses = await prisma.business.findMany({
    where: {
      whatsappPhoneNumberId: { startsWith: "pending_" },
      isPaused: false,
    },
    select: {
      id: true,
      whatsappBusinessNumber: true,
    },
    take: 200,
  });

  const candidates = pendingBusinesses.filter((business) => {
    const normalizedBusinessNumber = normalizePhoneNumber(
      business.whatsappBusinessNumber,
    );
    return (
      Boolean(normalizedBusinessNumber) &&
      normalizedBusinessNumber === normalizedDisplayNumber
    );
  });

  if (candidates.length !== 1) {
    if (candidates.length > 1) {
      console.warn(
        "[Webhook] Multiple pending businesses matched display number",
        {
          displayPhoneNumber: incoming.displayPhoneNumber,
          normalizedDisplayNumber,
          phoneNumberId: incoming.phoneNumberId,
          candidateBusinessIds: candidates.map((candidate) => candidate.id),
        },
      );
    }
    return null;
  }

  try {
    const linkedBusiness = await prisma.business.update({
      where: { id: candidates[0].id },
      data: {
        whatsappPhoneNumberId: incoming.phoneNumberId,
      },
    });

    console.info(
      "[Webhook] Auto-linked pending business to WhatsApp phone_number_id",
      {
        businessId: linkedBusiness.id,
        phoneNumberId: incoming.phoneNumberId,
        displayPhoneNumber: incoming.displayPhoneNumber,
      },
    );

    return linkedBusiness;
  } catch (error) {
    console.error("[Webhook] Failed to auto-link pending business", {
      message: error.message,
      code: error.code,
      phoneNumberId: incoming.phoneNumberId,
      displayPhoneNumber: incoming.displayPhoneNumber,
      businessId: candidates[0].id,
    });
    return null;
  }
};

const handleSingleMessage = async (incoming) => {
  try {
    const business = await resolveBusinessFromIncoming(incoming);

    if (!business) {
      console.error(
        "[Webhook] Business not found for phone_number_id",
        incoming.phoneNumberId,
      );
      await sendCustomerFallbackReply(incoming);
      return;
    }

    if (business.isPaused) {
      console.info("[Webhook] Business is paused, skipping message", {
        businessId: business.id,
        customerWaId: incoming.customerWaId,
      });
      await sendCustomerFallbackReply(
        incoming,
        "Thanks for your message. We’re currently unavailable, but we’ll get back to you shortly.",
      );
      return;
    }

    const activeProducts = await prisma.product.findMany({
      where: { businessId: business.id, isActive: true },
      select: {
        name: true,
        price: true,
        currency: true,
        category: true,
        description: true,
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      take: 80,
    });

    const augmentedBusinessContext = {
      ...business,
      aiTrainingData: {
        ...(business.aiTrainingData &&
        typeof business.aiTrainingData === "object"
          ? business.aiTrainingData
          : {}),
        products: activeProducts,
      },
    };

    const guardrailCheck = await createGuardRail({
      userMessage: incoming.text,
      businessContext: augmentedBusinessContext,
    });

    if (!guardrailCheck.shouldProceed || guardrailCheck.isInjectionAttempt) {
      console.warn("[Webhook] Message blocked by guardrails", {
        businessId: business.id,
        customerWaId: incoming.customerWaId,
        warnings: guardrailCheck.warnings,
      });

      await sendCustomerFallbackReply(
        incoming,
        "Thanks for your message. Please rephrase it and I’ll help you right away.",
      );

      return;
    }

    const inferredNameFromMessage = extractCustomerNameFromMessage(
      guardrailCheck.sanitizedMessage,
    );
    const preferredIncomingName =
      resolveKnownCustomerName(incoming.customerName) || inferredNameFromMessage;

    const customer = await getOrCreateCustomer({
      businessId: business.id,
      waId: incoming.customerWaId,
      name: preferredIncomingName,
    });

    const customerDisplayName =
      resolveKnownCustomerName(customer.name) ||
      preferredIncomingName ||
      incoming.customerWaId;

    const conversation = await getOrCreateConversation({
      businessId: business.id,
      customerId: customer.id,
    });

    const previousMessages = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      select: {
        direction: true,
        body: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 12,
    });

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: MessageDirection.INBOUND,
        body: guardrailCheck.sanitizedMessage,
        metaMessageId: incoming.metaMessageId,
      },
    });

    if (detectHumanRequest(incoming.text)) {
      await markHumanRequired({
        conversationId: conversation.id,
        reason: "Customer requested human (person/human/boss detected)",
      });

      try {
        await sendOwnerHandoffNotification({
          phoneNumberId: incoming.phoneNumberId,
          ownerEmail: business.email,
          ownerWhatsAppNumber: business.whatsappBusinessNumber,
          customerName: customerDisplayName,
          reason: "Customer asked for human/boss",
        });
      } catch (error) {
        console.error(
          "[Webhook] Owner handoff notification failed",
          error.message,
        );
      }

      await sendCustomerFallbackReply(
        incoming,
        "Thanks for your message. I’ll connect you with someone from the team to assist you better.",
      );

      return;
    }

    const controlToggles = await prisma.controlToggles.findUnique({
      where: { businessId: business.id },
    });

    if (!controlToggles) {
      console.error(
        "[Webhook] ControlToggles not found for business",
        business.id,
      );
      await sendCustomerFallbackReply(incoming);
      return;
    }

    const existingInboundCount = await prisma.message.count({
      where: {
        conversationId: conversation.id,
        direction: MessageDirection.INBOUND,
      },
    });

    const existingOutboundCount = await prisma.message.count({
      where: {
        conversationId: conversation.id,
        direction: MessageDirection.OUTBOUND,
      },
    });

    const toggleKey = inferToggleType({
      text: guardrailCheck.sanitizedMessage,
      isFirstCustomerMessage: existingInboundCount === 1,
      sensitiveIntents: guardrailCheck.sensitiveIntents,
    });

    const toggleMode = controlToggles[toggleKey];

    if (shouldForceHuman(toggleMode)) {
      await markHumanRequired({
        conversationId: conversation.id,
        reason: `Toggle ${toggleKey} is HUMAN_ONLY`,
      });

      try {
        await sendOwnerHandoffNotification({
          phoneNumberId: incoming.phoneNumberId,
          ownerEmail: business.email,
          ownerWhatsAppNumber: business.whatsappBusinessNumber,
          customerName: customerDisplayName,
          reason: `${toggleKey} is HUMAN_ONLY`,
        });
      } catch (error) {
        console.error(
          "[Webhook] HUMAN_ONLY notification failed",
          error.message,
        );
      }

      await sendCustomerFallbackReply(
        incoming,
        "Thanks for your message. I’m connecting you with someone from the team now.",
      );

      return;
    }

    const resolvedCustomerName =
      resolveKnownCustomerName(customer.name) ||
      preferredIncomingName ||
      null;
    const promptBusinessContext = {
      ...augmentedBusinessContext,
      customerName: resolvedCustomerName || "Customer",
    };

    const strictPrompt = buildStrictSystemPrompt(promptBusinessContext);
    const systemPrompt = business.customSystemPrompt
      ? `${strictPrompt}\n\n=== BUSINESS CUSTOM INSTRUCTIONS ===\n${business.customSystemPrompt}`
      : strictPrompt;

    const aiReplyRaw = await generateReply({
      systemPrompt,
      customerMessage: guardrailCheck.sanitizedMessage,
      conversationHistory: [...previousMessages].reverse(),
    });

    const aiReply = enforceReplyQuality({
      reply: aiReplyRaw,
      customerName: resolvedCustomerName,
      isFirstOutbound: existingOutboundCount === 0,
      timeZone:
        augmentedBusinessContext?.aiTrainingData?.timeZone ||
        process.env.BUSINESS_TIMEZONE ||
        "Africa/Lagos",
    });

    if (shouldDraftForApproval(toggleMode)) {
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          direction: MessageDirection.DRAFT_TO_APPROVE,
          body: aiReply,
          needsApproval: true,
        },
      });

      try {
        await sendOwnerDraftNotification({
          phoneNumberId: incoming.phoneNumberId,
          ownerEmail: business.email,
          ownerWhatsAppNumber: business.whatsappBusinessNumber,
          customerName: customerDisplayName,
          draftReply: aiReply,
        });
      } catch (error) {
        console.error("[Webhook] Draft notification failed", error.message);
      }

      await sendCustomerFallbackReply(
        incoming,
        "Thanks for your message. We’ve received it and someone from the team will get back to you shortly.",
      );

      return;
    }

    if (shouldAutoSendReply(toggleMode)) {
      try {
        await sendWhatsAppText({
          phoneNumberId: incoming.phoneNumberId,
          to: incoming.customerWaId,
          text: aiReply,
        });

        await prisma.message.create({
          data: {
            conversationId: conversation.id,
            direction: MessageDirection.OUTBOUND,
            body: aiReply,
          },
        });
      } catch (error) {
        console.error("[Webhook] Failed to send AI reply", error.message);
        await sendCustomerFallbackReply(
          incoming,
          "Thanks for your message. We’ve received it and will get back to you shortly.",
        );
      }
    }

    if (
      !shouldAutoSendReply(toggleMode) &&
      !shouldDraftForApproval(toggleMode)
    ) {
      await sendCustomerFallbackReply(
        incoming,
        "Thanks for your message. We’ve received it and will get back to you shortly.",
      );
    }

    await prisma.platformMetric.upsert({
      where: { businessId: business.id },
      update: {
        groqRequestsCount: { increment: 1 },
        messagesProcessed: { increment: 1 },
      },
      create: {
        businessId: business.id,
        groqRequestsCount: 1,
        messagesProcessed: 1,
      },
    });
  } catch (error) {
    if (isDatabaseConnectivityError(error)) {
      console.error("[Webhook] Database unavailable in message handler", {
        message: error.message,
        code: error.code,
        incoming,
      });
      await sendDbOutageReply(incoming);
      return;
    }

    console.error("[Webhook] Unexpected error in message handler", {
      message: error.message,
      stack: error.stack,
      incoming,
    });
  }
};

export const processIncomingWhatsAppPayload = async (payload) => {
  await ensureDatabaseTimestampsAreValid();

  const messages = parseIncomingMessages(payload);
  if (messages.length === 0) return;

  for (const incoming of messages) {
    await handleSingleMessage(incoming);
  }
};
