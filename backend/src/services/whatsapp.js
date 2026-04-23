import axios from "axios";

const META_BASE_URL = "https://graph.facebook.com/v22.0";
const DEFAULT_TEMPLATE_LANGUAGE =
  process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en_US";
const HANDOFF_TEMPLATE_NAME =
  process.env.WHATSAPP_HANDOFF_TEMPLATE || "owner_handoff_alert";
const DRAFT_TEMPLATE_NAME =
  process.env.WHATSAPP_DRAFT_TEMPLATE || "owner_draft_review_alert";
const FOLLOW_UP_TEMPLATE_NAME =
  process.env.WHATSAPP_FOLLOWUP_TEMPLATE || "customer_followup_sales";

const getHeaders = () => ({
  Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
  "Content-Type": "application/json",
});

const sendWhatsAppTemplate = async ({
  phoneNumberId,
  to,
  templateName,
  languageCode = DEFAULT_TEMPLATE_LANGUAGE,
  bodyParams = [],
}) => {
  const url = `${META_BASE_URL}/${phoneNumberId}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "template",
    template: {
      name: templateName,
      language: {
        code: languageCode,
      },
      components:
        bodyParams.length > 0
          ? [
              {
                type: "body",
                parameters: bodyParams.map((text) => ({
                  type: "text",
                  text,
                })),
              },
            ]
          : [],
    },
  };

  const { data } = await axios.post(url, payload, {
    headers: getHeaders(),
    timeout: 7000,
  });

  return data;
};

export const sendWhatsAppText = async ({ phoneNumberId, to, text }) => {
  try {
    const url = `${META_BASE_URL}/${phoneNumberId}/messages`;
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { body: text },
    };

    const { data } = await axios.post(url, payload, {
      headers: getHeaders(),
      timeout: 7000,
    });
    return data;
  } catch (error) {
    const errorDetails = {
      message: error.message || "Unknown error",
      code: error.code,
      errno: error.errno,
      statusCode: error.response?.status,
      responseData: error.response?.data,
      phoneNumberId,
      to,
      url: `${META_BASE_URL}/${phoneNumberId}/messages`,
    };

    if (error.message === "" || !error.message) {
      errorDetails.fullError = String(error);
      errorDetails.stack = error.stack;
    }

    console.error("[Meta API] Failed to send customer message", errorDetails);
    throw error;
  }
};

export const sendOwnerHandoffNotification = async ({
  phoneNumberId,
  ownerEmail,
  ownerWhatsAppNumber,
  customerName,
  reason,
}) => {
  if (!ownerWhatsAppNumber) {
    console.warn("[Whatsapp] Owner WhatsApp number missing for handoff alert", {
      ownerEmail,
      customerName,
      reason,
    });

    return {
      status: "skipped",
      message: "Owner WhatsApp number not configured",
    };
  }

  console.info("[Whatsapp] Sending handoff template to owner", {
    ownerEmail,
    ownerWhatsAppNumber,
    customerName,
    reason,
    templateName: HANDOFF_TEMPLATE_NAME,
  });

  try {
    const data = await sendWhatsAppTemplate({
      phoneNumberId,
      to: ownerWhatsAppNumber,
      templateName: HANDOFF_TEMPLATE_NAME,
      bodyParams: [customerName, reason],
    });

    return {
      status: "sent",
      message: `Handoff alert sent for ${customerName}`,
      data,
    };
  } catch (error) {
    console.error("[Whatsapp] Failed to send handoff template", {
      message: error.message,
      response: error.response?.data,
      ownerEmail,
      ownerWhatsAppNumber,
      customerName,
    });
    throw error;
  }
};

export const sendOwnerDraftNotification = async ({
  phoneNumberId,
  ownerEmail,
  ownerWhatsAppNumber,
  customerName,
  draftReply,
}) => {
  if (!ownerWhatsAppNumber) {
    console.warn("[Whatsapp] Owner WhatsApp number missing for draft alert", {
      ownerEmail,
      customerName,
    });

    return {
      status: "skipped",
      message: "Owner WhatsApp number not configured",
    };
  }

  console.info("[Whatsapp] Sending draft approval template to owner", {
    ownerEmail,
    ownerWhatsAppNumber,
    customerName,
    draftLength: draftReply.length,
    templateName: DRAFT_TEMPLATE_NAME,
  });

  try {
    const data = await sendWhatsAppTemplate({
      phoneNumberId,
      to: ownerWhatsAppNumber,
      templateName: DRAFT_TEMPLATE_NAME,
      bodyParams: [customerName],
    });

    return {
      status: "sent",
      message: `Draft review sent for ${customerName}`,
      data,
    };
  } catch (error) {
    console.error("[Whatsapp] Failed to send draft template", {
      message: error.message,
      response: error.response?.data,
      ownerEmail,
      ownerWhatsAppNumber,
      customerName,
    });
    throw error;
  }
};

export const sendCustomerFollowUpTemplate = async ({
  phoneNumberId,
  customerWhatsAppNumber,
  customerName,
  followUpMessage,
}) => {
  if (!customerWhatsAppNumber) {
    return {
      status: "skipped",
      message: "Customer WhatsApp number not configured",
    };
  }

  console.info("[Whatsapp] Sending follow-up message to customer", {
    customerWhatsAppNumber,
    customerName,
    messageType: "text",
  });

  const sanitizedMessage = String(followUpMessage || "")
    .replace(/\{\{name\}\}/gi, customerName || "Customer")
    .trim();

  if (!sanitizedMessage) {
    console.warn("[Whatsapp] Empty follow-up message after sanitization", {
      customerName,
      customerWhatsAppNumber,
    });
    return {
      status: "skipped",
      message: "Follow-up message is empty",
    };
  }

  try {
    const data = await sendWhatsAppText({
      phoneNumberId,
      to: customerWhatsAppNumber,
      text: sanitizedMessage,
    });

    return {
      status: "sent",
      message: `Follow-up text sent to ${customerName || customerWhatsAppNumber}`,
      data,
    };
  } catch (error) {
    console.error("[Whatsapp] Failed to send follow-up text", {
      message: error.message,
      response: error.response?.data,
      customerWhatsAppNumber,
      customerName,
    });
    throw error;
  }
};
