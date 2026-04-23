import axios from "axios";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_GROQ_TIMEOUT_MS = 20000;

const getGroqTimeoutMs = () => {
  const rawTimeout = Number(process.env.GROQ_TIMEOUT_MS);
  if (Number.isFinite(rawTimeout) && rawTimeout >= 1000) {
    return rawTimeout;
  }

  return DEFAULT_GROQ_TIMEOUT_MS;
};

const fallbackReply =
  process.env.GROQ_FALLBACK_REPLY ||
  "Thanks for your message. We’re unable to respond fully right now, but we’ll get back to you shortly.";

const isRetryableGroqError = (error) => {
  if (!error) return false;

  return (
    error.code === "ECONNABORTED" ||
    error.code === "ETIMEDOUT" ||
    String(error.message || "")
      .toLowerCase()
      .includes("timeout") ||
    String(error.message || "")
      .toLowerCase()
      .includes("network error") ||
    String(error.message || "")
      .toLowerCase()
      .includes("econnreset") ||
    String(error.message || "")
      .toLowerCase()
      .includes("eai_again")
  );
};

export const generateReply = async ({ systemPrompt, customerMessage }) => {
  try {
    const payload = {
      model: "llama-3.3-70b-versatile",
      temperature: 0.4,
      max_tokens: 280,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: customerMessage },
      ],
    };

    const headers = {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    };

    const { data } = await axios.post(GROQ_URL, payload, {
      headers,
      timeout: getGroqTimeoutMs(),
    });

    return data?.choices?.[0]?.message?.content?.trim() || fallbackReply;
  } catch (error) {
    console.warn("[Groq API] Falling back after generation failure", {
      message: error.message,
      response: error.response?.data,
      code: error.code,
    });

    if (isRetryableGroqError(error)) {
      return fallbackReply;
    }

    return fallbackReply;
  }
};
