const TONE_MAP = {
  friendly: "friendly",
  professional: "professional",
  casual: "casual",
};

const tenantMemory = new Map();

const uniq = (items) => [...new Set(items.filter(Boolean))];

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
    ? trainingData.services.map((item) => String(item || "").trim())
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
  };
};

export const classifyIntent = ({ message, businessConfig }) => {
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

  let intent = "general";
  if (pricingPatterns.test(normalizedMessage)) intent = "pricing";
  else if (bookingPatterns.test(normalizedMessage)) intent = "booking";
  else if (greetingPatterns.test(normalizedMessage)) intent = "greeting";

  const isGreeting = intent === "greeting";
  const hasServices = services.length > 0;
  const isRelevant = isGreeting || !hasServices || matchedKeywords.length > 0;

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
      ? businessConfig.services.join(", ")
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
    `You are a customer service assistant for ${businessConfig.name}.`,
    "",
    "Business Description:",
    `${businessConfig.description}`,
    "",
    "Services Offered:",
    `${servicesText}`,
    "",
    "Rules:",
    "- Only respond to questions related to these services",
    "- Do not answer outside this scope",
    "- Do not hallucinate or invent information",
    "- Keep responses short and natural",
    `- Match this tone: ${businessConfig.tone}`,
    "",
    "If a request is unrelated:",
    `Say: 'I can only assist with ${servicesText}.'`,
    "",
    "Additional Guidance:",
    `- Current customer display name: ${customerName || "Customer"}`,
    `- Current day period: ${dayPeriod}`,
    "- If customer name is unknown, use 'Customer' and politely ask for their name only when relevant.",
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

export const buildIrrelevantResponse = (businessConfig) => {
  const servicesText =
    businessConfig.services.length > 0
      ? businessConfig.services.join(", ")
      : "our listed services";
  return `I can only assist with ${servicesText}.`;
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
