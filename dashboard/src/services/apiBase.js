const normalizeBaseUrl = (value) =>
  String(value || "")
    .trim()
    .replace(/\/$/, "");

const isLikelyValidUrl = (value) => {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return Boolean(parsed.protocol && parsed.host);
  } catch {
    return false;
  }
};

export const getApiBaseUrl = () => {
  const configured = normalizeBaseUrl(import.meta.env.VITE_API_URL);
  if (isLikelyValidUrl(configured)) {
    return configured;
  }

  const override =
    typeof window !== "undefined"
      ? normalizeBaseUrl(window.__VITE_API_URL__)
      : "";
  if (isLikelyValidUrl(override)) {
    return override;
  }

  return "";
};

export const apiUrl = (path) => {
  const baseUrl = getApiBaseUrl();
  const normalizedPath = String(path || "").startsWith("/")
    ? String(path || "")
    : `/${path || ""}`;
  return `${baseUrl}${normalizedPath}`;
};

export const fetchWithApiBase = (path, options) => {
  return fetch(apiUrl(path), options);
};
