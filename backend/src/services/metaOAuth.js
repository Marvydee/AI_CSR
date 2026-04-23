import crypto from "crypto";
import axios from "axios";

const META_API_VERSION = "v22.0";
const META_AUTH_BASE_URL = "https://www.facebook.com";
const META_GRAPH_URL = `https://graph.instagram.com/${META_API_VERSION}`;
const META_BUSINESS_URL = `https://graph.facebook.com/${META_API_VERSION}`;

const generateStateToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

export const buildMetaOAuthAuthorizeUrl = ({ businessId }) => {
  const appId = process.env.META_APP_ID || "";
  const redirectUri = process.env.WHATSAPP_OAUTH_REDIRECT_URI || "";

  if (!appId || !redirectUri) {
    throw new Error(
      "META_APP_ID and WHATSAPP_OAUTH_REDIRECT_URI must be configured",
    );
  }

  const state = generateStateToken();
  const scope = [
    "whatsapp_business_management",
    "whatsapp_business_messaging",
    "business_management",
  ].join(",");

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    scope,
    state,
    response_type: "code",
  });

  return {
    authorizeUrl: `${META_AUTH_BASE_URL}/v22.0/dialog/oauth?${params.toString()}`,
    state,
  };
};

export const exchangeOAuthCodeForToken = async ({ code }) => {
  const appId = process.env.META_APP_ID || "";
  const appSecret = process.env.META_APP_SECRET || "";
  const redirectUri = process.env.WHATSAPP_OAUTH_REDIRECT_URI || "";

  if (!appId || !appSecret || !redirectUri) {
    throw new Error(
      "META_APP_ID, META_APP_SECRET, and WHATSAPP_OAUTH_REDIRECT_URI must be configured",
    );
  }

  try {
    const tokenResponse = await axios.get(
      `${META_AUTH_BASE_URL}/v22.0/oauth/access_token`,
      {
        params: {
          client_id: appId,
          client_secret: appSecret,
          redirect_uri: redirectUri,
          code,
        },
      },
    );

    const { access_token: accessToken, user_id: userId } = tokenResponse.data;

    if (!accessToken || !userId) {
      throw new Error("Invalid OAuth response from Meta");
    }

    return { accessToken, userId };
  } catch (error) {
    console.error("[Meta OAuth] Token exchange failed", {
      message: error.message,
      response: error.response?.data,
    });
    throw new Error(
      error.response?.data?.error?.message ||
        "Failed to exchange OAuth code for token",
    );
  }
};

export const getWhatsAppBusinessAccountAndPhoneNumber = async ({
  accessToken,
}) => {
  try {
    const meResponse = await axios.get(`${META_BUSINESS_URL}/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const userId = meResponse.data.id;

    const accountsResponse = await axios.get(
      `${META_BUSINESS_URL}/${userId}/accounts`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { fields: "id,name,whatsapp_business_account_id" },
      },
    );

    const accounts = accountsResponse.data.data || [];
    if (accounts.length === 0) {
      throw new Error(
        "No Meta business accounts found. Please link a business account.",
      );
    }

    const businessAccount = accounts[0];
    const whatsappBusinessAccountId =
      businessAccount.whatsapp_business_account_id;

    if (!whatsappBusinessAccountId) {
      throw new Error("No WhatsApp Business Account linked to this account.");
    }

    const phoneNumberResponse = await axios.get(
      `${META_BUSINESS_URL}/${whatsappBusinessAccountId}/phone_numbers`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { fields: "id,display_phone_number,phone_number_id" },
      },
    );

    const phoneNumbers = phoneNumberResponse.data.data || [];
    if (phoneNumbers.length === 0) {
      throw new Error("No phone numbers found in WhatsApp Business Account.");
    }

    const primaryNumber = phoneNumbers[0];

    return {
      whatsappBusinessAccountId,
      phoneNumberId: primaryNumber.phone_number_id,
      displayPhoneNumber: primaryNumber.display_phone_number,
    };
  } catch (error) {
    console.error("[Meta OAuth] Failed to get WhatsApp account info", {
      message: error.message,
      response: error.response?.data,
    });
    throw new Error(
      error.response?.data?.error?.message ||
        error.message ||
        "Failed to retrieve WhatsApp Business Account",
    );
  }
};

export const buildOAuthCallbackResponseString = ({ code, state } = {}) => {
  return `code=${encodeURIComponent(code || "")}&state=${encodeURIComponent(state || "")}`;
};
