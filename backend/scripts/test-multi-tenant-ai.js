import {
  loadBusinessConfig,
  classifyIntent,
  buildDynamicSystemPrompt,
  buildIrrelevantResponse,
} from "../src/services/tenantAI.js";

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const weldingBusiness = {
  id: "biz_welding",
  name: "SteelCraft Welding",
  aiTrainingData: {
    description: "We build and install gates, railings, and metal doors.",
    tone: "professional",
    services: ["welding", "gates", "railings"],
    faqs: [
      { question: "Do you install gates?", answer: "Yes, we install gates." },
    ],
  },
};

const loanBusiness = {
  id: "biz_loan",
  name: "QuickCredit Services",
  aiTrainingData: {
    description: "We provide personal and SME loan services.",
    tone: "friendly",
    services: ["loans", "loan application", "credit advisory"],
    faqs: [
      {
        question: "How long does loan approval take?",
        answer: "Approval can take 24 to 72 hours.",
      },
    ],
  },
};

const weldingConfig = loadBusinessConfig({ business: weldingBusiness });
const loanConfig = loadBusinessConfig({ business: loanBusiness });

const weldingIntent = classifyIntent({
  message: "Can I apply for a loan?",
  businessConfig: weldingConfig,
});
const loanIntent = classifyIntent({
  message: "Can I apply for a loan?",
  businessConfig: loanConfig,
});

assert(
  weldingIntent.isRelevant === false,
  "Welding tenant should reject loan intent",
);
assert(loanIntent.isRelevant === true, "Loan tenant should accept loan intent");

const weldingPrompt = buildDynamicSystemPrompt({
  businessConfig: weldingConfig,
  customerName: "Customer",
  conversationMemory: { intent: "general", collectedData: {}, stage: "new" },
});
const loanPrompt = buildDynamicSystemPrompt({
  businessConfig: loanConfig,
  customerName: "Customer",
  conversationMemory: { intent: "general", collectedData: {}, stage: "new" },
});

assert(
  weldingPrompt.includes("welding") &&
    !weldingPrompt.includes("loan application"),
  "Welding prompt should be tenant-specific",
);
assert(
  loanPrompt.includes("loan application") && !loanPrompt.includes("railings"),
  "Loan prompt should be tenant-specific",
);

const weldingIrrelevant = buildIrrelevantResponse(weldingConfig);
const loanIrrelevant = buildIrrelevantResponse(loanConfig);

assert(
  weldingIrrelevant !== loanIrrelevant,
  "Irrelevant responses should differ across tenants",
);

console.log("Multi-tenant AI scenario checks passed.");
