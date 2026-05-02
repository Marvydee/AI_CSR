import axios from "axios";

const META_BASE_URL = "https://graph.facebook.com/v22.0";
const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";

const getMetaHeaders = () => ({
  Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
});

const getMediaTimeoutMs = () => {
  const value = Number(process.env.WHATSAPP_MEDIA_TIMEOUT_MS);
  return Number.isFinite(value) && value >= 1000 ? value : 15000;
};

const getVisionTimeoutMs = () => {
  const value = Number(process.env.GROQ_VISION_TIMEOUT_MS);
  return Number.isFinite(value) && value >= 1000 ? value : 30000;
};

const getVisionModel = () =>
  String(
    process.env.GROQ_VISION_MODEL ||
      "meta-llama/llama-4-scout-17b-16e-instruct",
  ).trim() || "meta-llama/llama-4-scout-17b-16e-instruct";

const getMetaMediaDetails = async (mediaId) => {
  const url = `${META_BASE_URL}/${mediaId}`;
  const { data } = await axios.get(url, {
    headers: getMetaHeaders(),
    timeout: getMediaTimeoutMs(),
  });

  return {
    mediaUrl: data?.url,
    mimeType: data?.mime_type || null,
  };
};

const downloadMetaMedia = async ({ mediaUrl }) => {
  const { data } = await axios.get(mediaUrl, {
    headers: getMetaHeaders(),
    responseType: "arraybuffer",
    timeout: getMediaTimeoutMs(),
  });

  return Buffer.from(data);
};

const summarizeImageIntent = async ({
  imageBuffer,
  mimeType,
  businessName,
  services,
}) => {
  const base64 = imageBuffer.toString("base64");
  if (!base64) return null;

  const servicesText =
    Array.isArray(services) && services.length
      ? services.join(", ")
      : "business services";

  const prompt = [
    `You are extracting customer intent from an image sent to ${businessName || "a business"}.`,
    `Business services: ${servicesText}.`,
    "Describe what the customer likely needs in one short sentence for customer support routing.",
    "If uncertain, say that the customer sent an image and needs guidance.",
    "Do not invent exact measurements, prices, or guarantees.",
  ].join(" ");

  const payload = {
    model: getVisionModel(),
    temperature: 0.1,
    max_tokens: 120,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType || "image/jpeg"};base64,${base64}`,
            },
          },
        ],
      },
    ],
  };

  const headers = {
    Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    "Content-Type": "application/json",
  };

  const { data } = await axios.post(GROQ_CHAT_URL, payload, {
    headers,
    timeout: getVisionTimeoutMs(),
  });

  return String(data?.choices?.[0]?.message?.content || "").trim() || null;
};

export const analyzeWhatsAppImageByMediaId = async ({
  mediaId,
  fallbackMimeType,
  businessName,
  services,
}) => {
  if (!mediaId || !process.env.WHATSAPP_TOKEN || !process.env.GROQ_API_KEY) {
    return null;
  }

  try {
    const mediaDetails = await getMetaMediaDetails(mediaId);
    if (!mediaDetails.mediaUrl) return null;

    const imageBuffer = await downloadMetaMedia({
      mediaUrl: mediaDetails.mediaUrl,
    });

    if (!imageBuffer || imageBuffer.length === 0) return null;

    // Keep request size bounded for reliability.
    const maxBytes = 6 * 1024 * 1024;
    if (imageBuffer.length > maxBytes) return null;

    const imageSummary = await summarizeImageIntent({
      imageBuffer,
      mimeType: mediaDetails.mimeType || fallbackMimeType,
      businessName,
      services,
    });

    return imageSummary || null;
  } catch (error) {
    console.warn("[Vision] Failed to analyze WhatsApp image", {
      mediaId,
      message: error.message,
    });
    return null;
  }
};
