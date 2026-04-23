export const ToggleMode = {
  AI_FULL: "AI_FULL",
  AI_ASK: "AI_ASK",
  HUMAN_ONLY: "HUMAN_ONLY",
};

const PAYMENT_KEYWORDS = ["pay", "payment", "bank", "transfer", "account"];
const PRICE_KEYWORDS = ["price", "cost", "how much", "quote", "amount"];
const BOOKING_KEYWORDS = [
  "book",
  "booking",
  "reserve",
  "appointment",
  "schedule",
];

const includesAny = (text, words) => words.some((word) => text.includes(word));

export const inferToggleType = ({
  text,
  isFirstCustomerMessage,
  sensitiveIntents = {},
}) => {
  const normalized = (text || "").toLowerCase();

  if (isFirstCustomerMessage) return "toggleFirstCustomerMessage";
  if (sensitiveIntents.PAYMENT || includesAny(normalized, PAYMENT_KEYWORDS))
    return "togglePaymentDetails";
  if (sensitiveIntents.BOOKING || includesAny(normalized, BOOKING_KEYWORDS))
    return "toggleBookingConfirmation";
  if (sensitiveIntents.PRICING || includesAny(normalized, PRICE_KEYWORDS))
    return "togglePriceQuotes";

  return "toggleFirstCustomerMessage";
};

export const shouldAutoSendReply = (mode) => mode === ToggleMode.AI_FULL;
export const shouldDraftForApproval = (mode) => mode === ToggleMode.AI_ASK;
export const shouldForceHuman = (mode) => mode === ToggleMode.HUMAN_ONLY;
