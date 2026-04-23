import crypto from "crypto";

export const validateMetaWebhookSignature = (req, res, next) => {
  const signature = req.headers["x-hub-signature-256"];
  const body = req.rawBody || JSON.stringify(req.body);

  if (!signature) {
    console.warn("[Webhook] Missing X-Hub-Signature-256 header");
    return res.status(403).json({ error: "Signature validation failed" });
  }

  const hmac = crypto.createHmac("sha256", process.env.META_APP_SECRET);
  hmac.update(body);
  const expectedSignature = `sha256=${hmac.digest("hex")}`;

  if (signature !== expectedSignature) {
    console.warn("[Webhook] Signature mismatch", {
      received: signature,
      expected: expectedSignature,
    });
    return res.status(403).json({ error: "Signature validation failed" });
  }

  next();
};

export const rawBodyMiddleware = express.raw({ type: "application/json" });
