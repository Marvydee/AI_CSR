import express from "express";
import crypto from "crypto";
import { prisma } from "../lib/prisma.js";
import { authenticateJWT, authenticateSuperAdmin } from "../middleware/auth.js";
import { getOnboardingData } from "../services/onboarding.js";

const router = express.Router();

router.use(authenticateJWT, authenticateSuperAdmin);

const buildRegistrationCode = () => {
  const first = crypto.randomBytes(3).toString("hex").toUpperCase();
  const second = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `AICSR-${first}-${second}`;
};

router.post("/invite-codes/generate", async (req, res) => {
  const requestedCount = Number(req.body?.count ?? 1);
  const count = Number.isInteger(requestedCount)
    ? Math.min(Math.max(requestedCount, 1), 20)
    : 1;

  const generatedCodes = [];

  while (generatedCodes.length < count) {
    const code = buildRegistrationCode();

    try {
      const created = await prisma.registrationInviteCode.create({
        data: {
          code,
          createdBySuperAdminId: req.user.id,
        },
        select: {
          id: true,
          code: true,
          usedAt: true,
          usedByAdminEmail: true,
          createdAt: true,
        },
      });
      generatedCodes.push(created);
    } catch (error) {
      if (error.code !== "P2002") {
        throw error;
      }
    }
  }

  return res.status(201).json({ codes: generatedCodes });
});

router.get("/invite-codes", async (_req, res) => {
  const codes = await prisma.registrationInviteCode.findMany({
    select: {
      id: true,
      code: true,
      usedAt: true,
      usedByAdminEmail: true,
      usedByBusinessId: true,
      createdAt: true,
      createdBySuperAdmin: {
        select: {
          email: true,
          name: true,
        },
      },
      usedByBusiness: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 500,
  });

  return res.status(200).json(codes);
});

router.get("/tenants", async (_req, res) => {
  const businesses = await prisma.business.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      whatsappPhoneNumberId: true,
      aiTrainingData: true,
      subscriptionStatus: true,
      isPaused: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 500,
  });

  return res.status(200).json(
    businesses.map((business) => {
      const onboardingData = getOnboardingData(business);

      return {
        ...business,
        onboardingCompleted: onboardingData.onboarding.completed,
        onboardingStage: onboardingData.onboarding.stage,
        whatsappConnected: onboardingData.whatsappConnected,
      };
    }),
  );
});

router.put("/tenants/:businessId/pause", async (req, res) => {
  const businessId = String(req.params.businessId || "").trim();
  const isPaused = Boolean(req.body?.isPaused);

  if (!businessId) {
    return res.status(400).json({ error: "businessId is required" });
  }

  const existing = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true },
  });

  if (!existing) {
    return res.status(404).json({ error: "Business not found" });
  }

  const updated = await prisma.business.update({
    where: { id: businessId },
    data: { isPaused },
    select: {
      id: true,
      isPaused: true,
      updatedAt: true,
    },
  });

  return res.status(200).json(updated);
});

router.get("/metrics", async (_req, res) => {
  const businessCountPromise = prisma.business.count();
  const pausedCountPromise = prisma.business.count({
    where: { isPaused: true },
  });
  const metricAggregatePromise = prisma.platformMetric.aggregate({
    _sum: {
      metaWebhooksCount: true,
      groqRequestsCount: true,
    },
    _avg: {
      averageReplyTime: true,
    },
  });

  const [businessCount, pausedCount, metricAggregate] = await Promise.all([
    businessCountPromise,
    pausedCountPromise,
    metricAggregatePromise,
  ]);

  const totalRequests = Number(metricAggregate._sum?.metaWebhooksCount || 0);
  const groqApiUsage = Number(metricAggregate._sum?.groqRequestsCount || 0);
  const averageReplyTime = Number(metricAggregate._avg?.averageReplyTime || 0);

  const errorRate =
    totalRequests > 0
      ? ((pausedCount / totalRequests) * 100).toFixed(2)
      : "0.00";

  return res.status(200).json({
    totalRequests,
    errorRate: `${errorRate}%`,
    averageResponseTime: `${averageReplyTime.toFixed(0)}ms`,
    groqApiUsage: String(groqApiUsage),
    tenantCount: businessCount,
  });
});

export default router;
