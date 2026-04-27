import express from "express";
import crypto from "crypto";
import { prisma } from "../lib/prisma.js";
import {
  authenticateBusinessAdmin,
  authenticateJWT,
} from "../middleware/auth.js";
import { ensureTenantIsolation } from "../middleware/tenantFilter.js";
import {
  businessUpdateSchema,
  accountUpdateSchema,
  draftApproveSchema,
  draftRejectSchema,
  onboardingUpdateSchema,
  productCreateSchema,
  productImportSchema,
  productUpdateSchema,
  trainingUpdateSchema,
  validateRequest,
} from "../middleware/validateRequest.js";
import {
  parseProductsFromExcelBase64,
  syncProductTrainingData,
} from "../services/products.js";
import {
  getFollowUpQueue,
  runSalesFollowUpScan,
} from "../services/followUps.js";
import { sendWhatsAppText } from "../services/whatsapp.js";
import { getOnboardingData } from "../services/onboarding.js";
import {
  buildMetaOAuthAuthorizeUrl,
  exchangeOAuthCodeForToken,
  getWhatsAppBusinessAccountAndPhoneNumber,
} from "../services/metaOAuth.js";

const router = express.Router();

router.use(authenticateJWT, authenticateBusinessAdmin);

const ALLOWED_TOGGLE_KEYS = new Set([
  "togglePaymentDetails",
  "togglePriceQuotes",
  "toggleBookingConfirmation",
  "toggleFirstCustomerMessage",
]);

const ALLOWED_TOGGLE_VALUES = new Set(["AI_FULL", "AI_ASK", "HUMAN_ONLY"]);

const resolveBusinessIdFromRequest = (req) => {
  if (req.user?.role === "BUSINESS_ADMIN") {
    return req.user.businessId;
  }

  const queryBusinessId = String(req.query.businessId || "").trim();
  return queryBusinessId || req.user?.businessId || null;
};

const getTrainingData = (business) => {
  if (business?.aiTrainingData && typeof business.aiTrainingData === "object") {
    return business.aiTrainingData;
  }
  return {};
};

const hashPassword = (password) => {
  return crypto
    .createHash("sha256")
    .update(String(password || "") + String(process.env.PASSWORD_SALT || ""))
    .digest("hex");
};

router.get("/account", async (req, res) => {
  const account = await prisma.businessAdmin.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      businessId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!account) {
    return res.status(404).json({ error: "Account not found" });
  }

  return res.status(200).json(account);
});

router.put(
  "/account",
  validateRequest(accountUpdateSchema),
  async (req, res) => {
    const existing = await prisma.businessAdmin.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        businessId: true,
        passwordHash: true,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: "Account not found" });
    }

    const nextEmail =
      req.validatedBody.email !== undefined
        ? String(req.validatedBody.email).trim().toLowerCase()
        : undefined;
    const nextName =
      req.validatedBody.name !== undefined
        ? String(req.validatedBody.name).trim()
        : undefined;

    if (nextEmail && nextEmail !== existing.email) {
      const emailOwner = await prisma.businessAdmin.findUnique({
        where: {
          businessId_email: {
            businessId: existing.businessId,
            email: nextEmail,
          },
        },
        select: { id: true },
      });

      if (emailOwner && emailOwner.id !== existing.id) {
        return res.status(409).json({
          error: "Email is already in use for this business",
        });
      }
    }

    let nextPasswordHash;
    if (req.validatedBody.currentPassword && req.validatedBody.newPassword) {
      const currentHash = hashPassword(req.validatedBody.currentPassword);
      if (currentHash !== existing.passwordHash) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }

      nextPasswordHash = hashPassword(req.validatedBody.newPassword);
    }

    const updated = await prisma.businessAdmin.update({
      where: { id: existing.id },
      data: {
        ...(nextName !== undefined ? { name: nextName } : {}),
        ...(nextEmail !== undefined ? { email: nextEmail } : {}),
        ...(nextPasswordHash ? { passwordHash: nextPasswordHash } : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        businessId: true,
        updatedAt: true,
      },
    });

    return res.status(200).json({
      account: updated,
      passwordChanged: Boolean(nextPasswordHash),
    });
  },
);

router.get("/drafts", async (req, res) => {
  const businessId = resolveBusinessIdFromRequest(req);
  if (!businessId) {
    return res.status(400).json({ error: "businessId is required" });
  }

  const drafts = await prisma.message.findMany({
    where: {
      direction: "DRAFT_TO_APPROVE",
      needsApproval: true,
      conversation: { businessId },
    },
    select: {
      id: true,
      body: true,
      createdAt: true,
      conversationId: true,
      conversation: {
        select: {
          id: true,
          lastMessageAt: true,
          customer: {
            select: {
              id: true,
              name: true,
              waId: true,
            },
          },
          business: {
            select: {
              id: true,
              whatsappPhoneNumberId: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 200,
  });

  return res.status(200).json(drafts);
});

router.put(
  "/drafts/:draftId/approve",
  validateRequest(draftApproveSchema),
  async (req, res) => {
    const businessId = resolveBusinessIdFromRequest(req);
    if (!businessId) {
      return res.status(400).json({ error: "businessId is required" });
    }

    const draft = await prisma.message.findFirst({
      where: {
        id: req.params.draftId,
        direction: "DRAFT_TO_APPROVE",
        needsApproval: true,
        conversation: { businessId },
      },
      include: {
        conversation: {
          include: {
            customer: true,
            business: {
              select: {
                id: true,
                whatsappPhoneNumberId: true,
              },
            },
          },
        },
      },
    });

    if (!draft) {
      return res.status(404).json({ error: "Draft not found" });
    }

    const customerWaId = draft.conversation?.customer?.waId;
    const phoneNumberId = draft.conversation?.business?.whatsappPhoneNumberId;
    const outgoingBody = String(
      req.validatedBody?.body || draft.body || "",
    ).trim();

    if (!outgoingBody) {
      return res.status(400).json({ error: "Draft body cannot be empty" });
    }

    if (!customerWaId || !phoneNumberId) {
      return res
        .status(400)
        .json({ error: "Missing customer number or business phone number ID" });
    }

    const metaResponse = await sendWhatsAppText({
      phoneNumberId,
      to: customerWaId,
      text: outgoingBody,
    });

    const metaMessageId =
      Array.isArray(metaResponse?.messages) && metaResponse.messages[0]?.id
        ? String(metaResponse.messages[0].id)
        : null;

    await prisma.$transaction([
      prisma.message.update({
        where: { id: draft.id },
        data: {
          body: outgoingBody,
          needsApproval: false,
          approvalSeenAt: new Date(),
          rejectionReason: null,
        },
      }),
      prisma.message.create({
        data: {
          conversationId: draft.conversationId,
          direction: "OUTBOUND",
          body: outgoingBody,
          needsApproval: false,
          metaMessageId,
        },
      }),
      prisma.conversation.update({
        where: { id: draft.conversationId },
        data: {
          status: "AI_ACTIVE",
          humanReason: null,
          lastMessageAt: new Date(),
        },
      }),
    ]);

    return res.status(200).json({ success: true, sent: true });
  },
);

router.put(
  "/drafts/:draftId/reject",
  validateRequest(draftRejectSchema),
  async (req, res) => {
    const businessId = resolveBusinessIdFromRequest(req);
    if (!businessId) {
      return res.status(400).json({ error: "businessId is required" });
    }

    const draft = await prisma.message.findFirst({
      where: {
        id: req.params.draftId,
        direction: "DRAFT_TO_APPROVE",
        needsApproval: true,
        conversation: { businessId },
      },
      select: {
        id: true,
      },
    });

    if (!draft) {
      return res.status(404).json({ error: "Draft not found" });
    }

    await prisma.message.update({
      where: { id: draft.id },
      data: {
        needsApproval: false,
        approvalSeenAt: new Date(),
        rejectionReason:
          String(req.validatedBody.reason || "Owner rejected draft").trim() ||
          "Owner rejected draft",
      },
    });

    return res.status(200).json({ success: true });
  },
);

router.get("/:businessId/profile", ensureTenantIsolation, async (req, res) => {
  const business = await prisma.business.findUnique({
    where: { id: req.params.businessId },
    select: {
      id: true,
      name: true,
      email: true,
      whatsappPhoneNumberId: true,
      whatsappBusinessNumber: true,
      customSystemPrompt: true,
      aiTrainingData: true,
    },
  });

  if (!business) {
    return res.status(404).json({ error: "Business not found" });
  }

  const trainingData = getTrainingData(business);
  const onboardingData = getOnboardingData(business);
  const bankDetails =
    trainingData.bankDetails && typeof trainingData.bankDetails === "object"
      ? trainingData.bankDetails
      : {};

  return res.status(200).json({
    ...business,
    onboarding: onboardingData.onboarding,
    bankName: bankDetails.bankName || "",
    bankAccountName: bankDetails.bankAccountName || "",
    bankAccountNumber: bankDetails.bankAccountNumber || "",
  });
});

router.put(
  "/:businessId/profile",
  ensureTenantIsolation,
  validateRequest(businessUpdateSchema),
  async (req, res) => {
    const existing = await prisma.business.findUnique({
      where: { id: req.params.businessId },
      select: { aiTrainingData: true },
    });

    const previousTrainingData = getTrainingData(existing);
    const previousBankDetails =
      previousTrainingData.bankDetails &&
      typeof previousTrainingData.bankDetails === "object"
        ? previousTrainingData.bankDetails
        : {};

    const hasBankDetailUpdate =
      req.validatedBody.bankName !== undefined ||
      req.validatedBody.bankAccountName !== undefined ||
      req.validatedBody.bankAccountNumber !== undefined;

    const nextBankDetails = {
      ...previousBankDetails,
      ...(req.validatedBody.bankName !== undefined
        ? { bankName: req.validatedBody.bankName || "" }
        : {}),
      ...(req.validatedBody.bankAccountName !== undefined
        ? { bankAccountName: req.validatedBody.bankAccountName || "" }
        : {}),
      ...(req.validatedBody.bankAccountNumber !== undefined
        ? {
            bankAccountNumber:
              String(req.validatedBody.bankAccountNumber || "")
                .replace(/\s+/g, "")
                .trim() || "",
          }
        : {}),
    };

    const updated = await prisma.business.update({
      where: { id: req.params.businessId },
      data: {
        ...(req.validatedBody.name !== undefined
          ? { name: req.validatedBody.name }
          : {}),
        ...(req.validatedBody.whatsappPhoneNumberId !== undefined
          ? {
              whatsappPhoneNumberId: String(
                req.validatedBody.whatsappPhoneNumberId || "",
              ).trim(),
            }
          : {}),
        ...(req.validatedBody.whatsappBusinessNumber !== undefined
          ? {
              whatsappBusinessNumber:
                req.validatedBody.whatsappBusinessNumber || null,
            }
          : {}),
        ...(req.validatedBody.customSystemPrompt !== undefined
          ? { customSystemPrompt: req.validatedBody.customSystemPrompt || null }
          : {}),
        ...(hasBankDetailUpdate
          ? {
              aiTrainingData: {
                ...previousTrainingData,
                bankDetails: nextBankDetails,
              },
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        whatsappPhoneNumberId: true,
        whatsappBusinessNumber: true,
        customSystemPrompt: true,
        aiTrainingData: true,
      },
    });

    const trainingData = getTrainingData(updated);
    const onboardingData = getOnboardingData(updated);
    const bankDetails =
      trainingData.bankDetails && typeof trainingData.bankDetails === "object"
        ? trainingData.bankDetails
        : {};

    return res.status(200).json({
      ...updated,
      onboarding: onboardingData.onboarding,
      bankName: bankDetails.bankName || "",
      bankAccountName: bankDetails.bankAccountName || "",
      bankAccountNumber: bankDetails.bankAccountNumber || "",
    });
  },
);

router.get(
  "/:businessId/onboarding",
  ensureTenantIsolation,
  async (req, res) => {
    const business = await prisma.business.findUnique({
      where: { id: req.params.businessId },
      select: {
        id: true,
        name: true,
        email: true,
        whatsappPhoneNumberId: true,
        whatsappBusinessNumber: true,
        customSystemPrompt: true,
        aiTrainingData: true,
      },
    });

    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }

    return res.status(200).json(getOnboardingData(business));
  },
);

router.put(
  "/:businessId/onboarding",
  ensureTenantIsolation,
  validateRequest(onboardingUpdateSchema),
  async (req, res) => {
    const existing = await prisma.business.findUnique({
      where: { id: req.params.businessId },
      select: { aiTrainingData: true, whatsappPhoneNumberId: true },
    });

    if (!existing) {
      return res.status(404).json({ error: "Business not found" });
    }

    const currentTrainingData = getTrainingData(existing);
    const currentOnboarding =
      currentTrainingData.onboarding &&
      typeof currentTrainingData.onboarding === "object"
        ? currentTrainingData.onboarding
        : {};

    const nextOnboarding = {
      ...currentOnboarding,
      ...(req.validatedBody.completed !== undefined
        ? { completed: Boolean(req.validatedBody.completed) }
        : {}),
      ...(req.validatedBody.stage !== undefined
        ? { stage: String(req.validatedBody.stage).trim() }
        : {}),
      ...(req.validatedBody.notes !== undefined
        ? { notes: String(req.validatedBody.notes || "").trim() }
        : {}),
      ...(req.validatedBody.checklist !== undefined
        ? { checklist: req.validatedBody.checklist }
        : {}),
      lastUpdatedAt: new Date().toISOString(),
    };

    const updated = await prisma.business.update({
      where: { id: req.params.businessId },
      data: {
        aiTrainingData: {
          ...currentTrainingData,
          onboarding: nextOnboarding,
        },
      },
      select: {
        id: true,
        aiTrainingData: true,
        whatsappPhoneNumberId: true,
        name: true,
      },
    });

    return res.status(200).json(getOnboardingData(updated));
  },
);

router.get("/toggles", async (req, res) => {
  const businessId = resolveBusinessIdFromRequest(req);
  if (!businessId) {
    return res.status(400).json({ error: "businessId is required" });
  }

  const toggles = await prisma.controlToggles.upsert({
    where: { businessId },
    update: {},
    create: {
      businessId,
      updatedBy: req.user?.id || null,
    },
  });

  return res.status(200).json(toggles);
});

router.put("/toggles/:key", async (req, res) => {
  const businessId = resolveBusinessIdFromRequest(req);
  if (!businessId) {
    return res.status(400).json({ error: "businessId is required" });
  }

  const key = req.params.key;
  const value = String(req.body?.value || "").trim();

  if (!ALLOWED_TOGGLE_KEYS.has(key)) {
    return res.status(400).json({ error: "Invalid toggle key" });
  }

  if (!ALLOWED_TOGGLE_VALUES.has(value)) {
    return res.status(400).json({ error: "Invalid toggle value" });
  }

  const updated = await prisma.controlToggles.upsert({
    where: { businessId },
    update: {
      [key]: value,
      updatedBy: req.user?.id || null,
    },
    create: {
      businessId,
      [key]: value,
      updatedBy: req.user?.id || null,
    },
  });

  return res.status(200).json(updated);
});

router.get("/conversations", async (req, res) => {
  const businessId = resolveBusinessIdFromRequest(req);
  if (!businessId) {
    return res.status(400).json({ error: "businessId is required" });
  }

  const conversations = await prisma.conversation.findMany({
    where: { businessId },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          waId: true,
        },
      },
      messages: {
        select: {
          id: true,
        },
      },
    },
    orderBy: {
      lastMessageAt: "desc",
    },
    take: 200,
  });

  return res.status(200).json(conversations);
});

router.get("/handoffs", async (req, res) => {
  const businessId = resolveBusinessIdFromRequest(req);
  if (!businessId) {
    return res.status(400).json({ error: "businessId is required" });
  }

  const handoffs = await prisma.conversation.findMany({
    where: {
      businessId,
      status: "HUMAN_REQUIRED",
    },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          waId: true,
        },
      },
    },
    orderBy: {
      lastMessageAt: "desc",
    },
    take: 100,
  });

  return res.status(200).json(handoffs);
});

router.get("/follow-ups/queue", async (req, res) => {
  const businessId = resolveBusinessIdFromRequest(req);
  if (!businessId) {
    return res.status(400).json({ error: "businessId is required" });
  }

  const queue = await getFollowUpQueue(businessId);
  return res.status(200).json(queue);
});

router.post("/follow-ups/run", async (req, res) => {
  const businessId = resolveBusinessIdFromRequest(req);
  if (!businessId) {
    return res.status(400).json({ error: "businessId is required" });
  }

  await runSalesFollowUpScan(businessId);
  const queue = await getFollowUpQueue(businessId);

  return res.status(200).json({
    success: true,
    remainingQueue: queue.length,
  });
});

router.get("/:businessId/services", ensureTenantIsolation, async (req, res) => {
  const business = await prisma.business.findUnique({
    where: { id: req.params.businessId },
    select: { aiTrainingData: true },
  });

  const trainingData = getTrainingData(business);
  const services = Array.isArray(trainingData.services)
    ? trainingData.services
    : [];

  return res.status(200).json(services);
});

router.post(
  "/:businessId/services",
  ensureTenantIsolation,
  async (req, res) => {
    const name = String(req.body?.name || "").trim();
    const description = String(req.body?.description || "").trim();
    const currency = String(req.body?.currency || "NGN")
      .trim()
      .toUpperCase();
    const basePrice = Number(req.body?.basePrice);

    if (!name) {
      return res.status(400).json({ error: "Service name is required" });
    }

    if (!Number.isFinite(basePrice) || basePrice < 0) {
      return res
        .status(400)
        .json({ error: "basePrice must be a valid non-negative number" });
    }

    const business = await prisma.business.findUnique({
      where: { id: req.params.businessId },
      select: { aiTrainingData: true },
    });

    const trainingData = getTrainingData(business);
    const existingServices = Array.isArray(trainingData.services)
      ? trainingData.services
      : [];
    const createdService = {
      id: `svc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      name,
      description: description || null,
      basePrice,
      currency,
      isActive: true,
    };

    const updatedServices = [...existingServices, createdService];

    await prisma.business.update({
      where: { id: req.params.businessId },
      data: {
        aiTrainingData: {
          ...trainingData,
          services: updatedServices,
        },
      },
    });

    return res.status(201).json(createdService);
  },
);

router.put(
  "/:businessId/services/:serviceId",
  ensureTenantIsolation,
  async (req, res) => {
    const business = await prisma.business.findUnique({
      where: { id: req.params.businessId },
      select: { aiTrainingData: true },
    });

    const trainingData = getTrainingData(business);
    const existingServices = Array.isArray(trainingData.services)
      ? trainingData.services
      : [];

    const idx = existingServices.findIndex(
      (service) => String(service?.id) === String(req.params.serviceId),
    );

    if (idx < 0) {
      return res.status(404).json({ error: "Service not found" });
    }

    const next = [...existingServices];
    next[idx] = {
      ...next[idx],
      ...(req.body?.name !== undefined
        ? { name: String(req.body.name || "").trim() }
        : {}),
      ...(req.body?.description !== undefined
        ? { description: String(req.body.description || "").trim() || null }
        : {}),
      ...(req.body?.currency !== undefined
        ? {
            currency: String(req.body.currency || "NGN")
              .trim()
              .toUpperCase(),
          }
        : {}),
      ...(req.body?.basePrice !== undefined
        ? { basePrice: Number(req.body.basePrice) }
        : {}),
      ...(req.body?.isActive !== undefined
        ? { isActive: Boolean(req.body.isActive) }
        : {}),
    };

    if (!next[idx].name) {
      return res.status(400).json({ error: "Service name cannot be empty" });
    }

    if (
      !Number.isFinite(Number(next[idx].basePrice)) ||
      Number(next[idx].basePrice) < 0
    ) {
      return res
        .status(400)
        .json({ error: "basePrice must be a valid non-negative number" });
    }

    await prisma.business.update({
      where: { id: req.params.businessId },
      data: {
        aiTrainingData: {
          ...trainingData,
          services: next,
        },
      },
    });

    return res.status(200).json(next[idx]);
  },
);

router.delete(
  "/:businessId/services/:serviceId",
  ensureTenantIsolation,
  async (req, res) => {
    const business = await prisma.business.findUnique({
      where: { id: req.params.businessId },
      select: { aiTrainingData: true },
    });

    const trainingData = getTrainingData(business);
    const existingServices = Array.isArray(trainingData.services)
      ? trainingData.services
      : [];

    const next = existingServices.filter(
      (service) => String(service?.id) !== String(req.params.serviceId),
    );

    if (next.length === existingServices.length) {
      return res.status(404).json({ error: "Service not found" });
    }

    await prisma.business.update({
      where: { id: req.params.businessId },
      data: {
        aiTrainingData: {
          ...trainingData,
          services: next,
        },
      },
    });

    return res.status(200).json({ success: true });
  },
);

router.get("/:businessId/products", ensureTenantIsolation, async (req, res) => {
  const includeInactive =
    String(req.query.includeInactive || "false") === "true";

  const products = await prisma.product.findMany({
    where: {
      businessId: req.params.businessId,
      ...(includeInactive ? {} : { isActive: true }),
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  res.status(200).json(products);
});

router.post(
  "/:businessId/products",
  ensureTenantIsolation,
  validateRequest(productCreateSchema),
  async (req, res) => {
    const data = req.validatedBody;

    const created = await prisma.product.create({
      data: {
        businessId: req.params.businessId,
        name: data.name,
        sku: data.sku || null,
        description: data.description || null,
        category: data.category || null,
        price: data.price,
        currency: data.currency,
        isActive: data.isActive,
      },
    });

    await syncProductTrainingData(prisma, req.params.businessId);

    res.status(201).json(created);
  },
);

router.put(
  "/:businessId/products/:productId",
  ensureTenantIsolation,
  validateRequest(productUpdateSchema),
  async (req, res) => {
    const existing = await prisma.product.findFirst({
      where: {
        id: req.params.productId,
        businessId: req.params.businessId,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: "Product not found" });
    }

    const updated = await prisma.product.update({
      where: { id: req.params.productId },
      data: req.validatedBody,
    });

    await syncProductTrainingData(prisma, req.params.businessId);

    return res.status(200).json(updated);
  },
);

router.delete(
  "/:businessId/products/:productId",
  ensureTenantIsolation,
  async (req, res) => {
    const existing = await prisma.product.findFirst({
      where: {
        id: req.params.productId,
        businessId: req.params.businessId,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: "Product not found" });
    }

    await prisma.product.update({
      where: { id: req.params.productId },
      data: { isActive: false },
    });

    await syncProductTrainingData(prisma, req.params.businessId);

    return res.status(200).json({ success: true });
  },
);

router.post(
  "/:businessId/products/import",
  ensureTenantIsolation,
  validateRequest(productImportSchema),
  async (req, res) => {
    const { fileName, fileBase64 } = req.validatedBody;
    const { rows, errors } = parseProductsFromExcelBase64({
      fileName,
      fileBase64,
    });

    if (errors.length > 0) {
      return res.status(400).json({
        error: "Excel validation failed",
        details: errors,
      });
    }

    const stats = {
      created: 0,
      updated: 0,
      skipped: 0,
    };

    await prisma.$transaction(async (tx) => {
      for (const row of rows) {
        const existing = await tx.product.findFirst({
          where: {
            businessId: req.params.businessId,
            OR: row.sku
              ? [{ sku: row.sku }, { name: row.name }]
              : [{ name: row.name }],
          },
        });

        if (existing) {
          await tx.product.update({
            where: { id: existing.id },
            data: {
              name: row.name,
              sku: row.sku,
              description: row.description,
              category: row.category,
              price: row.price,
              currency: row.currency,
              isActive: row.isActive,
            },
          });
          stats.updated += 1;
          continue;
        }

        await tx.product.create({
          data: {
            businessId: req.params.businessId,
            name: row.name,
            sku: row.sku,
            description: row.description,
            category: row.category,
            price: row.price,
            currency: row.currency,
            isActive: row.isActive,
          },
        });
        stats.created += 1;
      }
    });

    await syncProductTrainingData(prisma, req.params.businessId);

    return res.status(200).json({
      success: true,
      importedRows: rows.length,
      ...stats,
    });
  },
);

router.get("/:businessId/training", ensureTenantIsolation, async (req, res) => {
  const business = await prisma.business.findUnique({
    where: { id: req.params.businessId },
    select: {
      id: true,
      name: true,
      customSystemPrompt: true,
      aiTrainingData: true,
    },
  });

  if (!business) {
    return res.status(404).json({ error: "Business not found" });
  }

  return res.status(200).json(business);
});

router.put(
  "/:businessId/training",
  ensureTenantIsolation,
  validateRequest(trainingUpdateSchema),
  async (req, res) => {
    const existing = await prisma.business.findUnique({
      where: { id: req.params.businessId },
      select: { aiTrainingData: true },
    });

    const previousData =
      existing?.aiTrainingData && typeof existing.aiTrainingData === "object"
        ? existing.aiTrainingData
        : {};

    const nextTrainingData = {
      ...previousData,
      ...req.validatedBody,
    };

    const updated = await prisma.business.update({
      where: { id: req.params.businessId },
      data: {
        aiTrainingData: nextTrainingData,
      },
      select: {
        id: true,
        aiTrainingData: true,
      },
    });

    return res.status(200).json(updated);
  },
);

router.get(
  "/:businessId/whatsapp/oauth/authorize",
  ensureTenantIsolation,
  async (req, res) => {
    try {
      const { authorizeUrl, state } = buildMetaOAuthAuthorizeUrl({
        businessId: req.params.businessId,
      });

      const business = await prisma.business.findUnique({
        where: { id: req.params.businessId },
        select: { aiTrainingData: true },
      });

      const trainingData = getTrainingData(business) || {};
      const oauthState = {
        ...trainingData.oauthState,
        loginState: state,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      };

      await prisma.business.update({
        where: { id: req.params.businessId },
        data: {
          aiTrainingData: {
            ...trainingData,
            oauthState,
          },
        },
      });

      return res.status(200).json({
        authorizeUrl,
        state,
      });
    } catch (error) {
      console.error("[WhatsApp OAuth] Authorization URL generation failed", {
        message: error.message,
        businessId: req.params.businessId,
      });
      return res.status(500).json({
        error: error.message || "Failed to generate authorization URL",
      });
    }
  },
);

router.post(
  "/:businessId/whatsapp/oauth/callback",
  ensureTenantIsolation,
  async (req, res) => {
    try {
      const { code, state } = req.body;

      if (!code || !state) {
        return res.status(400).json({
          error: "Missing code or state in callback",
        });
      }

      const business = await prisma.business.findUnique({
        where: { id: req.params.businessId },
        select: { aiTrainingData: true },
      });

      const trainingData = getTrainingData(business) || {};
      const storedState = trainingData.oauthState?.loginState;

      if (!storedState || storedState !== state) {
        return res.status(401).json({
          error: "Invalid OAuth state. Please restart the connection process.",
        });
      }

      let accessToken;
      try {
        ({ accessToken } = await exchangeOAuthCodeForToken({ code }));
      } catch (exchangeError) {
        const message = String(exchangeError.message || "").toLowerCase();
        const alreadyUsedOrExpiredCode =
          message.includes("already") ||
          message.includes("used") ||
          message.includes("expired") ||
          message.includes("invalid verification code") ||
          message.includes("code has expired");

        // In dev/StrictMode callback replays, code can be consumed already.
        // If the business is already connected, surface success instead of hard failure.
        if (
          alreadyUsedOrExpiredCode &&
          business?.whatsappPhoneNumberId &&
          !String(business.whatsappPhoneNumberId).startsWith("pending_")
        ) {
          const hydratedBusiness = await prisma.business.findUnique({
            where: { id: req.params.businessId },
            select: {
              id: true,
              name: true,
              whatsappPhoneNumberId: true,
              whatsappBusinessNumber: true,
              aiTrainingData: true,
            },
          });

          const onboardingData = getOnboardingData(hydratedBusiness);

          return res.status(200).json({
            success: true,
            recovered: true,
            business: {
              id: hydratedBusiness.id,
              whatsappPhoneNumberId: hydratedBusiness.whatsappPhoneNumberId,
              whatsappBusinessNumber: hydratedBusiness.whatsappBusinessNumber,
            },
            onboarding: onboardingData,
          });
        }

        throw exchangeError;
      }

      const { phoneNumberId, displayPhoneNumber, whatsappBusinessAccountId } =
        await getWhatsAppBusinessAccountAndPhoneNumber({ accessToken });

      const updated = await prisma.business.update({
        where: { id: req.params.businessId },
        data: {
          whatsappPhoneNumberId: phoneNumberId,
          whatsappBusinessNumber: displayPhoneNumber,
          aiTrainingData: {
            ...trainingData,
            metaAppId: whatsappBusinessAccountId,
            oauthState: null,
          },
        },
        select: {
          id: true,
          name: true,
          whatsappPhoneNumberId: true,
          whatsappBusinessNumber: true,
          aiTrainingData: true,
        },
      });

      const onboardingData = getOnboardingData(updated);

      console.info("[WhatsApp OAuth] Business successfully connected", {
        businessId: updated.id,
        phoneNumberId,
        displayPhoneNumber,
      });

      return res.status(200).json({
        success: true,
        business: {
          id: updated.id,
          whatsappPhoneNumberId: updated.whatsappPhoneNumberId,
          whatsappBusinessNumber: updated.whatsappBusinessNumber,
        },
        onboarding: onboardingData,
      });
    } catch (error) {
      console.error("[WhatsApp OAuth] Callback processing failed", {
        message: error.message,
        businessId: req.params.businessId,
      });
      return res.status(500).json({
        error: error.message || "Failed to process OAuth callback",
      });
    }
  },
);

export default router;
