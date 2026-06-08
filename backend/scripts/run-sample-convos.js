import dotenv from "dotenv";
import { generateReply } from "../src/services/ai_engine.js";
import { buildDynamicSystemPrompt } from "../src/services/tenantAI.js";

dotenv.config();

const businessConfig = {
  name: "MDJ Forge",
  description:
    "Metal fabrication and welding services, including gates and repairs.",
  services: ["Welding", "Gate repair", "Fabrication"],
  faqs: [],
  restrictions: [],
  tone: "professional",
};

const run = async () => {
  const scenarios = [
    { name: "greeting", message: "Hi", customerName: "John" },
    {
      name: "clarifying",
      message: "How did you know about the iron gate",
      customerName: "John",
    },
    { name: "affirmation", message: "Yes", customerName: "John" },
  ];

  for (const s of scenarios) {
    console.log(`\n--- Scenario: ${s.name} ---`);
    const systemPrompt = buildDynamicSystemPrompt({
      businessConfig,
      customerName: s.customerName,
      dayPeriod: "evening",
      memory: null,
    });

    const reply = await generateReply({
      systemPrompt,
      customerMessage: s.message,
      conversationHistory: [],
    });

    console.log(`User: ${s.message}`);
    console.log(`Assistant: ${reply}`);
  }
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
