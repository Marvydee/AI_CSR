import axios from "axios";

const META_BASE_URL = "https://graph.facebook.com/v22.0";
const GROQ_TRANSCRIPTION_URL =
  "https://api.groq.com/openai/v1/audio/transcriptions";

const getMetaHeaders = () => ({
  Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
});

const getGroqHeaders = () => ({
  Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
});

const getTranscriptionModel = () =>
  String(
    process.env.GROQ_TRANSCRIPTION_MODEL || "whisper-large-v3-turbo",
  ).trim() || "whisper-large-v3-turbo";

const getMediaDownloadTimeoutMs = () => {
  const value = Number(process.env.WHATSAPP_MEDIA_TIMEOUT_MS);
  return Number.isFinite(value) && value >= 1000 ? value : 15000;
};

const getTranscriptionTimeoutMs = () => {
  const value = Number(process.env.GROQ_TRANSCRIPTION_TIMEOUT_MS);
  return Number.isFinite(value) && value >= 1000 ? value : 30000;
};

const inferFileExtension = (mimeType) => {
  const value = String(mimeType || "").toLowerCase();
  if (value.includes("ogg")) return "ogg";
  if (value.includes("mpeg") || value.includes("mp3")) return "mp3";
  if (value.includes("wav")) return "wav";
  if (value.includes("mp4") || value.includes("m4a")) return "m4a";
  if (value.includes("webm")) return "webm";
  return "audio";
};

const getMetaMediaDetails = async (mediaId) => {
  const url = `${META_BASE_URL}/${mediaId}`;
  const { data } = await axios.get(url, {
    headers: getMetaHeaders(),
    timeout: getMediaDownloadTimeoutMs(),
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
    timeout: getMediaDownloadTimeoutMs(),
  });

  return Buffer.from(data);
};

const transcribeWithGroq = async ({ audioBuffer, mimeType }) => {
  const form = new FormData();
  const extension = inferFileExtension(mimeType);
  const blob = new Blob([audioBuffer], {
    type: mimeType || "audio/ogg",
  });

  form.append("model", getTranscriptionModel());
  form.append("response_format", "json");
  form.append("temperature", "0");
  form.append("file", blob, `voice-note.${extension}`);

  const response = await fetch(GROQ_TRANSCRIPTION_URL, {
    method: "POST",
    headers: getGroqHeaders(),
    body: form,
    signal: AbortSignal.timeout(getTranscriptionTimeoutMs()),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Groq transcription failed (${response.status}): ${body || "No response body"}`,
    );
  }

  const payload = await response.json().catch(() => ({}));
  return String(payload?.text || "").trim();
};

export const transcribeWhatsAppAudioByMediaId = async ({
  mediaId,
  fallbackMimeType,
}) => {
  if (!mediaId || !process.env.WHATSAPP_TOKEN || !process.env.GROQ_API_KEY) {
    return null;
  }

  try {
    const mediaDetails = await getMetaMediaDetails(mediaId);
    if (!mediaDetails.mediaUrl) return null;

    const audioBuffer = await downloadMetaMedia({
      mediaUrl: mediaDetails.mediaUrl,
    });

    if (!audioBuffer || audioBuffer.length === 0) return null;

    const transcript = await transcribeWithGroq({
      audioBuffer,
      mimeType: mediaDetails.mimeType || fallbackMimeType,
    });

    return transcript || null;
  } catch (error) {
    console.warn("[Transcription] Failed to transcribe WhatsApp audio", {
      mediaId,
      message: error.message,
    });
    return null;
  }
};
