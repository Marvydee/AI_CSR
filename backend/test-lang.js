import MultilingualService from "./src/services/MultilingualService.js";

(async () => {
  console.log(
    "Supported languages:",
    MultilingualService.getSupportedLanguages()
      .map((l) => l.code)
      .join(", "),
  );

  const samples = [
    { text: "Wetin you sabi do broda?", expected: "pid" },
    { text: "Pẹlẹ o, bawo ni?", expected: "yo" },
    { text: "Hello, I want to order", expected: "en" },
    {
      text: "Habari, ninaagiza bidhaa",
      expected: "en /* heuristic fallback */",
    },
  ];

  for (const s of samples) {
    const res = await MultilingualService.detectLanguage(s.text);
    console.log(
      `Text: "${s.text}" => detected: ${res.language} (confidence: ${res.confidence})`,
    );
  }

  // Test translation lookup
  console.log(
    "Translation (sw greeting):",
    MultilingualService.getTranslation("greeting", "sw"),
  );
  console.log(
    "Translation (yo greeting):",
    MultilingualService.getTranslation("greeting", "yo"),
  );

  process.exit(0);
})();
