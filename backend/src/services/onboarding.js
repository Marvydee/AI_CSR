import crypto from "crypto";

const PENDING_PHONE_PREFIX = "pending_";

export const createPendingWhatsAppPhoneNumberId = () => {
  return `${PENDING_PHONE_PREFIX}${crypto.randomUUID().replace(/-/g, "")}`;
};

export const isConnectedWhatsAppPhoneNumberId = (phoneNumberId) => {
  const value = String(phoneNumberId || "").trim();
  return Boolean(value) && !value.startsWith(PENDING_PHONE_PREFIX);
};

export const buildInitialOnboardingData = ({
  startedAt = new Date().toISOString(),
} = {}) => {
  return {
    onboarding: {
      completed: false,
      stage: "WELCOME",
      startedAt,
      lastUpdatedAt: startedAt,
      steps: {
        account: true,
        businessProfile: false,
        whatsappConnection: false,
        bankDetails: false,
        aiSetup: false,
      },
    },
    bankDetails: {},
  };
};

export const getOnboardingData = (business) => {
  const trainingData =
    business?.aiTrainingData && typeof business.aiTrainingData === "object"
      ? business.aiTrainingData
      : {};
  const onboarding =
    trainingData.onboarding && typeof trainingData.onboarding === "object"
      ? trainingData.onboarding
      : {};

  const bankDetails =
    trainingData.bankDetails && typeof trainingData.bankDetails === "object"
      ? trainingData.bankDetails
      : {};

  const whatsappConnected = isConnectedWhatsAppPhoneNumberId(
    business?.whatsappPhoneNumberId,
  );
  const bankDetailsComplete =
    Boolean(bankDetails.bankName) &&
    Boolean(bankDetails.bankAccountName) &&
    Boolean(bankDetails.bankAccountNumber);

  const completed =
    Boolean(onboarding.completed) || (whatsappConnected && bankDetailsComplete);

  const stage = completed
    ? "COMPLETE"
    : whatsappConnected
      ? bankDetailsComplete
        ? "COMPLETE"
        : "BANK_DETAILS"
      : "WHATSAPP_CONNECTION";

  return {
    onboarding: {
      completed,
      stage,
      startedAt: onboarding.startedAt || null,
      lastUpdatedAt: onboarding.lastUpdatedAt || null,
      steps: {
        account: true,
        businessProfile: Boolean(business?.name),
        whatsappConnection: whatsappConnected,
        bankDetails: bankDetailsComplete,
        aiSetup: Boolean(
          trainingData?.services?.length ||
          trainingData?.prices ||
          trainingData?.faqs?.length,
        ),
      },
    },
    bankDetails,
    whatsappConnected,
    bankDetailsComplete,
  };
};
