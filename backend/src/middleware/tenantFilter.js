import { prisma } from "../lib/prisma.js";

export const ensureTenantIsolation = async (req, res, next) => {
  const { businessId } = req.params;

  if (!businessId) {
    return res.status(400).json({ error: "Business ID required" });
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
  });

  if (!business) {
    return res.status(404).json({ error: "Business not found" });
  }

  if (
    req.user?.role === "BUSINESS_ADMIN" &&
    req.user?.businessId !== businessId
  ) {
    console.warn("[Tenant] Unauthorized access attempt", {
      userId: req.user?.id,
      requestedBusinessId: businessId,
      authorizedBusinessId: req.user?.businessId,
    });
    return res
      .status(403)
      .json({ error: "Unauthorized access to this business" });
  }

  req.business = business;
  next();
};

export const tenantQueryFilter = (businessId) => {
  if (!businessId) {
    throw new Error("tenantQueryFilter: businessId is required");
  }
  return { businessId };
};
