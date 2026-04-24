import jwt from "jsonwebtoken";
import crypto from "crypto";
import { prisma } from "../lib/prisma.js";
import {
  buildInitialOnboardingData,
  createPendingWhatsAppPhoneNumberId,
  getOnboardingData,
} from "./onboarding.js";

let dbCredentialsInvalid = false;

const isPrismaAuthError = (error) => {
  if (!error) return false;
  if (error.code === "P1000") return true;

  const message = String(error.message || "").toLowerCase();
  return (
    message.includes("authentication failed against database server") ||
    message.includes("provided database credentials")
  );
};

const hashPassword = (password) => {
  return crypto
    .createHash("sha256")
    .update(password + process.env.PASSWORD_SALT)
    .digest("hex");
};

const buildAuthUser = (admin, business) => {
  const onboardingData = getOnboardingData(business);

  return {
    id: admin.id,
    email: admin.email,
    businessId: admin.businessId,
    businessName: business?.name || admin.business?.name || "Business",
    onboardingCompleted: onboardingData.onboarding.completed,
    onboardingStage: onboardingData.onboarding.stage,
    whatsappConnected: onboardingData.whatsappConnected,
  };
};

export const generateAccessToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      businessId: user.businessId,
    },
    process.env.JWT_SECRET,
    { algorithm: "HS256", expiresIn: "2h" },
  );
};

export const generateRefreshToken = (userId) => {
  return jwt.sign({ id: userId, type: "refresh" }, process.env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: "7d",
  });
};

export const signupBusinessAdmin = async ({
  fullName,
  email,
  password,
  businessName,
  inviteCode,
}) => {
  if (dbCredentialsInvalid) {
    throw new Error("DB_AUTH_INVALID");
  }

  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();
  const normalizedName = String(fullName || "").trim();
  const normalizedBusinessName = String(businessName || "").trim();
  const normalizedInviteCode = String(inviteCode || "")
    .trim()
    .toUpperCase();
  const hashedPassword = hashPassword(password);

  const existingAdmin = await prisma.businessAdmin.findFirst({
    where: { email: normalizedEmail },
    select: { id: true },
  });

  if (existingAdmin) {
    throw new Error("EMAIL_ALREADY_EXISTS");
  }

  const existingBusiness = await prisma.business.findFirst({
    where: { email: normalizedEmail },
    select: { id: true },
  });

  if (existingBusiness) {
    throw new Error("EMAIL_ALREADY_EXISTS");
  }

  const businessId = `biz_${crypto.randomUUID().replace(/-/g, "")}`;
  const pendingPhoneNumberId = createPendingWhatsAppPhoneNumberId();

  const { business, admin } = await prisma.$transaction(async (tx) => {
    const registrationCode = await tx.registrationInviteCode.findUnique({
      where: { code: normalizedInviteCode },
      select: {
        id: true,
        usedAt: true,
      },
    });

    if (!registrationCode) {
      throw new Error("INVALID_INVITE_CODE");
    }

    if (registrationCode.usedAt) {
      throw new Error("INVITE_CODE_ALREADY_USED");
    }

    const createdBusiness = await tx.business.create({
      data: {
        id: businessId,
        name: normalizedBusinessName,
        email: normalizedEmail,
        whatsappPhoneNumberId: pendingPhoneNumberId,
        subscriptionStatus: "ACTIVE",
        isPaused: false,
        aiTrainingData: buildInitialOnboardingData(),
      },
    });

    const createdAdmin = await tx.businessAdmin.create({
      data: {
        businessId,
        email: normalizedEmail,
        passwordHash: hashedPassword,
        name: normalizedName,
      },
    });

    const consumeResult = await tx.registrationInviteCode.updateMany({
      where: {
        id: registrationCode.id,
        usedAt: null,
      },
      data: {
        usedByBusinessId: createdBusiness.id,
        usedByAdminEmail: normalizedEmail,
        usedAt: new Date(),
      },
    });

    if (consumeResult.count !== 1) {
      throw new Error("INVITE_CODE_ALREADY_USED");
    }

    return {
      business: createdBusiness,
      admin: createdAdmin,
    };
  });

  const accessToken = generateAccessToken({
    id: admin.id,
    email: normalizedEmail,
    role: "BUSINESS_ADMIN",
    businessId: business.id,
  });

  const refreshToken = generateRefreshToken(admin.id);

  return {
    accessToken,
    refreshToken,
    user: {
      id: admin.id,
      email: normalizedEmail,
      businessId: business.id,
      businessName: business.name,
      onboardingCompleted: false,
      onboardingStage: "WELCOME",
      whatsappConnected: false,
    },
  };
};

export const loginBusinessAdmin = async (email, password) => {
  if (dbCredentialsInvalid) {
    throw new Error("DB_AUTH_INVALID");
  }

  const hashedPassword = hashPassword(password);
  let admins;
  try {
    admins = await prisma.businessAdmin.findMany({
      where: { email },
      include: { business: true },
      take: 20,
    });
  } catch (error) {
    if (isPrismaAuthError(error)) {
      dbCredentialsInvalid = true;
      throw new Error("DB_AUTH_INVALID");
    }
    throw error;
  }

  if (!admins.length) {
    throw new Error("Invalid email or password");
  }

  const admin = admins.find(
    (candidate) => candidate.passwordHash === hashedPassword,
  );
  if (!admin) {
    throw new Error("Invalid email or password");
  }

  const accessToken = generateAccessToken({
    id: admin.id,
    email: admin.email,
    role: "BUSINESS_ADMIN",
    businessId: admin.businessId,
  });

  const refreshToken = generateRefreshToken(admin.id);

  return {
    accessToken,
    refreshToken,
    user: buildAuthUser(admin, admin.business),
  };
};

export const loginSuperAdmin = async (email, password) => {
  if (dbCredentialsInvalid) {
    throw new Error("DB_AUTH_INVALID");
  }

  let admin;
  try {
    admin = await prisma.superAdmin.findUnique({
      where: { email },
    });
  } catch (error) {
    if (isPrismaAuthError(error)) {
      dbCredentialsInvalid = true;
      throw new Error("DB_AUTH_INVALID");
    }
    throw error;
  }

  if (!admin) {
    throw new Error("Invalid email or password");
  }

  const hashedPassword = hashPassword(password);
  if (admin.passwordHash !== hashedPassword) {
    throw new Error("Invalid email or password");
  }

  const accessToken = generateAccessToken({
    id: admin.id,
    email: admin.email,
    role: "SUPER_ADMIN",
  });

  const refreshToken = generateRefreshToken(admin.id);

  return {
    accessToken,
    refreshToken,
    user: {
      id: admin.id,
      email: admin.email,
      role: "SUPER_ADMIN",
    },
  };
};
