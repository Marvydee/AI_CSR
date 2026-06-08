import dotenv from "dotenv";
import { generateReply } from "../src/services/ai_engine.js";
import { buildDynamicSystemPrompt } from "../src/services/tenantAI.js";
import EXAMPLES from "../src/services/promptExamples.js";

dotenv.config();

const businessConfig = {
  name: "Customer Support Demo",
  description:
    "A generic customer service business used to validate prompt behavior.",
  services: ["Support", "Orders", "Scheduling"],
  faqs: [],
  restrictions: [],
  tone: "professional",
};

const scenarios = [
  { name: "greeting", message: "Hi", customerName: "John" },
  {
    name: "clarifying",
    message: "How did you know about that",
    customerName: "John",
  },
  { name: "affirmation", message: "Yes", customerName: "John" },
  {
    name: "quote",
    message: "Can you give me a rough quote?",
    customerName: "John",
  },
];

const runVariant = async (variantName, includeExamples) => {
  console.log(
    `\n===== Variant: ${variantName} (examples=${includeExamples}) =====`,
  );
  for (const s of scenarios) {
    const systemPrompt = buildDynamicSystemPrompt({
      businessConfig,
      customerName: s.customerName,
      dayPeriod: "evening",
      memory: null,
    });

    // Optionally prepend examples as a short few-shot block
    const prompt = includeExamples
      ? `${EXAMPLES.map((e) => `User: ${e.user}\nAssistant: ${e.assistant}`).join("\n\n")}\n\n${systemPrompt}`
      : systemPrompt;

    const reply = await generateReply({
      systemPrompt: prompt,
      customerMessage: s.message,
      conversationHistory: [],
    });

    console.log(`\nScenario: ${s.name}`);
    console.log(`User: ${s.message}`);
    console.log(`Assistant: ${reply}`);
  }
};

const run = async () => {
  await runVariant("base", false);
  await runVariant("few-shot", true);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
