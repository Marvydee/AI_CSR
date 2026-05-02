const TONE_MAP = {
  friendly: "friendly",
  professional: "professional",
  casual: "casual",
};

const tenantMemory = new Map();

const uniq = (items) => [...new Set(items.filter(Boolean))];

const toServiceText = (item) => {
  if (!item) return "";

  if (typeof item === "string") {
    return item.trim();
  }

  if (typeof item === "object") {
    return String(
      item.name || item.title || item.service || item.label || "",
    ).trim();
  }

  return String(item).trim();
};

const formatNaturalList = (items) => {
  const values = uniq(
    Array.isArray(items) ? items.map(toServiceText) : [],
  ).filter(Boolean);

  if (values.length === 0) return "";
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} and ${values[1]}`;

  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
};

const normalizeText = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const toWords = (value) => normalizeText(value).split(" ").filter(Boolean);

const inferTone = (trainingData = {}) => {
  const direct = String(trainingData.tone || "")
    .trim()
    .toLowerCase();
  if (TONE_MAP[direct]) return TONE_MAP[direct];

  const toneProfile = String(trainingData.toneProfile || "")
    .trim()
    .toLowerCase();

  if (toneProfile.includes("casual")) return "casual";
  if (toneProfile.includes("friendly")) return "friendly";
  return "professional";
};

const normalizeFaq = (item) => {
  if (!item) return null;

  if (typeof item === "string") {
    const line = item.trim();
    if (!line) return null;

    const match = line.match(/^q:\s*(.*?)\s*a:\s*(.*)$/i);
    if (match) {
      return {
        question: String(match[1] || "").trim(),
        answer: String(match[2] || "").trim(),
      };
    }

    return null;
  }

  if (typeof item === "object") {
    const question = String(item.question || item.q || "").trim();
    const answer = String(item.answer || item.a || "").trim();
    if (!question || !answer) return null;
    return { question, answer };
  }

  return null;
};

export const loadBusinessConfig = ({ business, activeProducts = [] }) => {
  const trainingData =
    business?.aiTrainingData && typeof business.aiTrainingData === "object"
      ? business.aiTrainingData
      : {};

  const configuredServices = Array.isArray(trainingData.services)
    ? trainingData.services.map(toServiceText)
    : [];

  const productServices = activeProducts
    .map((product) => String(product?.name || "").trim())
    .filter(Boolean);

  const serviceCategories = activeProducts
    .map((product) => String(product?.category || "").trim())
    .filter(Boolean);

  const services = uniq([
    ...configuredServices,
    ...productServices,
    ...serviceCategories,
  ]);

  const description =
    String(
      trainingData.description || trainingData.businessDescription || "",
    ).trim() ||
    `${String(business?.name || "This business").trim()} customer service operations`;

  const faqs = (Array.isArray(trainingData.faqs) ? trainingData.faqs : [])
    .map(normalizeFaq)
    .filter(Boolean);

  const restrictions = Array.isArray(trainingData.restrictions)
    ? trainingData.restrictions
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    : [];

  return {
    id: String(business?.id || "").trim(),
    name: String(business?.name || "Business").trim(),
    services,
    description,
    tone: inferTone(trainingData),
    faqs,
    restrictions,
    imageAnalysisEnabled:
      typeof trainingData.imageAnalysisEnabled === "boolean"
        ? trainingData.imageAnalysisEnabled
        : true,
  };
};

export const classifyIntent = ({ message, businessConfig, memory = null }) => {
  const normalizedMessage = normalizeText(message);
  const services = Array.isArray(businessConfig?.services)
    ? businessConfig.services
    : [];

  const serviceKeywordSet = new Set();
  for (const service of services) {
    for (const word of toWords(service)) {
      if (word.length > 2) serviceKeywordSet.add(word);
    }
  }

  const messageWords = toWords(normalizedMessage);
  const matchedKeywords = messageWords.filter((word) =>
    serviceKeywordSet.has(word),
  );

  const greetingPatterns =
    /\b(hi|hello|hey|good morning|good afternoon|good evening)\b/i;
  const pricingPatterns =
    /\b(price|cost|how much|quote|amount|fee|charges?)\b/i;
  const bookingPatterns = /\b(book|booking|reserve|appointment|schedule)\b/i;
  const clarifyingQuestionPatterns =
    /^\s*(how|why|what|where|when|can|could|would|do|does|did|is|are|isn't|aren't|don't|doesn't|didn't|have|has|hadn't|will|won't)\b/i;
  const affirmationPatterns =
    /^\s*(yes|yeah|yep|sure|ok|okay|alright|absolutely|definitely|sounds good|got it|understood)\b/i;
  const negationPatterns =
    /^\s*(no|nope|not really|don't think so|not interested)\b/i;

  let intent = "general";
  if (pricingPatterns.test(normalizedMessage)) intent = "pricing";
  else if (bookingPatterns.test(normalizedMessage)) intent = "booking";
  else if (greetingPatterns.test(normalizedMessage)) intent = "greeting";

  const priorIntent = String(memory?.intent || "")
    .trim()
    .toLowerCase();
  const priorRelevant = memory?.collectedData?.isRelevant !== false;
  const contextualFollowUpPatterns =
    /\b(can i|could i|should i|can you|what about|how about|this one|that one|picture|photo|image|send a pic|send picture|send a picture|send photo|location|size)\b/i;
  const isContextualFollowUp =
    contextualFollowUpPatterns.test(normalizedMessage) &&
    priorRelevant &&
    Boolean(priorIntent);

  const isClarifyingQuestion =
    clarifyingQuestionPatterns.test(normalizedMessage) && Boolean(priorIntent);

  const isAffirmation =
    affirmationPatterns.test(normalizedMessage) && Boolean(priorIntent);

  const isNegation =
    negationPatterns.test(normalizedMessage) && Boolean(priorIntent);

  const isGreeting = intent === "greeting";
  const hasServices = services.length > 0;
  const isRelevant =
    isGreeting ||
    !hasServices ||
    matchedKeywords.length > 0 ||
    isContextualFollowUp ||
    isClarifyingQuestion ||
    isAffirmation ||
    isNegation;

  return {
    intent,
    isRelevant,
    entities: {
      matchedServices: uniq(
        services.filter((service) => {
          const words = toWords(service);
          return words.some((word) => matchedKeywords.includes(word));
        }),
      ),
      matchedKeywords: uniq(matchedKeywords),
      isContextualFollowUp,
      isClarifyingQuestion,
      isAffirmation,
      isNegation,
    },
  };
};

const faqSimilarityScore = (message, question) => {
  const messageWords = toWords(message);
  const questionWords = toWords(question);
  if (!messageWords.length || !questionWords.length) return 0;

  const questionSet = new Set(questionWords);
  const overlap = messageWords.filter((word) => questionSet.has(word));
  return overlap.length / Math.max(questionSet.size, 1);
};

export const findFaqMatch = ({ message, faqs = [] }) => {
  const normalizedMessage = normalizeText(message);
  let bestMatch = null;
  let bestScore = 0;

  for (const faq of faqs) {
    const score = faqSimilarityScore(normalizedMessage, faq.question);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = faq;
    }
  }

  if (bestMatch && bestScore >= 0.5) {
    return {
      question: bestMatch.question,
      answer: bestMatch.answer,
      score: bestScore,
    };
  }

  return null;
};

export const getTenantUserMemory = ({ tenantId, userId }) => {
  const tenantKey = String(tenantId || "").trim();
  const userKey = String(userId || "").trim();
  if (!tenantKey || !userKey) return null;

  const tenantMap = tenantMemory.get(tenantKey);
  if (!tenantMap) return null;

  return tenantMap.get(userKey) || null;
};

export const updateTenantUserMemory = ({ tenantId, userId, patch }) => {
  const tenantKey = String(tenantId || "").trim();
  const userKey = String(userId || "").trim();
  if (!tenantKey || !userKey) return null;

  if (!tenantMemory.has(tenantKey)) {
    tenantMemory.set(tenantKey, new Map());
  }

  const tenantMap = tenantMemory.get(tenantKey);
  const current = tenantMap.get(userKey) || {
    intent: null,
    collectedData: {},
    stage: "start",
  };

  const nextState = {
    ...current,
    ...patch,
    collectedData: {
      ...(current.collectedData || {}),
      ...(patch?.collectedData || {}),
    },
  };

  tenantMap.set(userKey, nextState);
  return nextState;
};

export const buildDynamicSystemPrompt = ({
  businessConfig,
  customerName,
  dayPeriod,
  memory,
}) => {
  const servicesText =
    businessConfig.services.length > 0
      ? formatNaturalList(businessConfig.services)
      : "No services configured yet";

  const restrictionsText =
    businessConfig.restrictions.length > 0
      ? businessConfig.restrictions.map((item) => `- ${item}`).join("\n")
      : "- None provided";

  const faqText =
    businessConfig.faqs.length > 0
      ? businessConfig.faqs
          .map((faq) => `Q: ${faq.question}\nA: ${faq.answer}`)
          .join("\n")
      : "No FAQs configured";

  const memorySummary = memory
    ? `intent=${memory.intent || "unknown"}, stage=${memory.stage || "start"}, collectedData=${JSON.stringify(memory.collectedData || {})}`
    : "No prior memory";

  return [
    `You are a friendly, helpful, professional customer service representative for ${businessConfig.name}.`,
    "",
    "Business Description:",
    `${businessConfig.description}`,
    "",
    "Services Offered:",
    `${servicesText}`,
    "",
    "Conversation Style:",
    "- ALWAYS answer the customer's question directly and naturally",
    "- Sound warm, human, and genuine—NOT robotic, templated, or overly formal",
    "- Keep replies to 2-3 short sentences maximum",
    "- Ask only ONE follow-up question (or skip if conversation flows better)",
    "- Never use canned responses",
    "- Acknowledge what the customer said before moving on",
    "- Never invent facts, names, prices, or services",
    "",
    "Rules:",
    "- Only respond within the business scope and avoid unrelated topics",
    "- Be firm about boundaries, but never harsh, dismissive, or rude",
    "- Do not hallucinate or invent information",
    `- Match this tone: friendly, helpful, professional${businessConfig.tone ? ` (${businessConfig.tone})` : ""}`,
    "",
    "Greeting handling:",
    "- If the customer greets you, respond warmly and offer to help",
    "- Keep first responses brief and friendly",
    `- Example: Hello! I'm here to help with ${servicesText}. What can I assist you with?`,
    "",
    "Handling Questions:",
    "- Clarifying questions (How, Why, What, When, Where) = Always answer directly",
    "- Don't deflect or redirect—explain naturally and continue",
    "- Only mention services if the customer asks or if you can genuinely help",
    "",
    "Additional Guidance:",
    `- Current customer display name: ${customerName || "Customer"}`,
    `- Current day period: ${dayPeriod}`,
    "- If the customer name is unknown, use 'Customer' and ask for their name only when it helps the conversation",
    "- If the customer asks about a service, answer directly and then ask one helpful follow-up question",
    "- Keep the conversation moving toward a quote, booking, order, or support resolution",
    "- Keep conversation continuity using prior memory summary.",
    "",
    "Business Restrictions:",
    restrictionsText,
    "",
    "Business FAQs:",
    faqText,
    "",
    "Tenant Memory Summary:",
    memorySummary,
  ].join("\n");
};

export const buildIrrelevantResponse = (
  businessConfig,
  customerName = null,
) => {
  const servicesText =
    businessConfig.services.length > 0
      ? formatNaturalList(businessConfig.services)
      : "our services";

  const namePrefix = customerName ? `${customerName}, ` : "";

  return `${namePrefix}I specialize in ${servicesText}. What can I help you with today?`;
};

export const getTenantMemorySnapshot = () => {
  const snapshot = {};
  for (const [tenantId, tenantMap] of tenantMemory.entries()) {
    snapshot[tenantId] = {};
    for (const [userId, memory] of tenantMap.entries()) {
      snapshot[tenantId][userId] = memory;
    }
  }
  return snapshot;
};
