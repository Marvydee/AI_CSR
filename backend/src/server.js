import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import crypto from "crypto";
import { prisma } from "./lib/prisma.js";
import { processIncomingWhatsAppPayload } from "./controllers/webhook.js";
import { runSalesFollowUpScan } from "./services/followUps.js";
import { webhookLimiter, apiLimiter } from "./middleware/rateLimiter.js";
import authRoutes from "./routes/auth.js";
import businessRoutes from "./routes/business.js";
import superAdminRoutes from "./routes/superadmin.js";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 5000);
const defaultAllowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];
const configuredAllowedOrigins = String(process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = new Set([
  ...defaultAllowedOrigins,
  ...configuredAllowedOrigins,
]);

// ngrok and similar tunnels send X-Forwarded-For, so trust one proxy by default.
const trustProxyRaw = process.env.TRUST_PROXY;
if (typeof trustProxyRaw === "string") {
  const parsedValue = trustProxyRaw.trim().toLowerCase();
  if (parsedValue === "false") {
    app.set("trust proxy", false);
  } else if (parsedValue === "true") {
    app.set("trust proxy", 1);
  } else {
    const proxyHops = Number(parsedValue);
    app.set("trust proxy", Number.isFinite(proxyHops) ? proxyHops : 1);
  }
} else {
  app.set("trust proxy", 1);
}

app.use(helmet());
app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With",
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});
app.use(
  express.json({
    limit: "8mb",
    verify: (req, _res, buffer) => {
      req.rawBody = Buffer.from(buffer);
    },
  }),
);
app.use(apiLimiter);

app.use((req, res, next) => {
  res.setHeader("ngrok-skip-browser-warning", "true");
  next();
});

const validateMetaSignature = (req, res, next) => {
  const signature = req.headers["x-hub-signature-256"];

  if (!signature) {
    const message = req.path === "/webhook" ? "Missing signature" : "";
    if (message) {
      console.warn("[Security] Missing X-Hub-Signature-256 header", {
        path: req.path,
      });
      return res.status(403).json({ error: "Signature validation failed" });
    }
  }

  const body = Buffer.isBuffer(req.rawBody)
    ? req.rawBody
    : Buffer.from(JSON.stringify(req.body || {}));
  const hmac = crypto.createHmac("sha256", process.env.META_APP_SECRET || "");
  hmac.update(body);
  const expectedSignature = `sha256=${hmac.digest("hex")}`;

  if (signature && signature !== expectedSignature) {
    console.warn("[Security] Webhook signature mismatch", { path: req.path });
    return res.status(403).json({ error: "Signature validation failed" });
  }

  next();
};

app.get("/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "whats-csr-backend",
    timestamp: new Date().toISOString(),
  });
});

app.get("/", (_req, res) => {
  res.status(200).json({
    ok: true,
    message: "Whats_CSR backend is running",
    endpoints: [
      "/health",
      "/webhook",
      "/api/auth",
      "/api/business/:businessId",
    ],
  });
});

app.get("/favicon.ico", (_req, res) => {
  res.status(204).end();
});

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const verifyToken = String(req.query["hub.verify_token"] || "").trim();
  const challenge = String(req.query["hub.challenge"] || "");
  const expectedVerifyToken = String(
    process.env.WHATSAPP_VERIFY_TOKEN || "",
  ).trim();

  if (
    mode === "subscribe" &&
    expectedVerifyToken &&
    verifyToken === expectedVerifyToken
  ) {
    console.info("[Webhook] Meta verification successful");
    return res.status(200).send(challenge);
  }

  console.warn("[Security] Webhook verification failed", {
    mode,
    hasToken: !!verifyToken,
    hasChallenge: !!challenge,
    hasExpectedToken: !!expectedVerifyToken,
  });
  return res.sendStatus(403);
});

app.post("/webhook", webhookLimiter, validateMetaSignature, (req, res) => {
  const payload = req.body;

  res.sendStatus(200);

  setImmediate(async () => {
    try {
      await processIncomingWhatsAppPayload(payload);
    } catch (error) {
      console.error("[Webhook] Async processing failed", {
        message: error.message,
        stack: error.stack,
      });
    }
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/business", businessRoutes);
app.use("/api/superadmin", superAdminRoutes);

app.use((err, _req, res, _next) => {
  console.error("[Server] Unhandled error", {
    message: err.message,
    stack: err.stack,
  });
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`[Server] Whats_CSR backend listening on port ${PORT}`);
  console.log(`[Security] Helmet.js security headers enabled`);
  console.log(`[Security] Rate limiting enabled`);
});

const followUpIntervalMs = Number(
  process.env.FOLLOW_UP_SCAN_MS || 15 * 60 * 1000,
);
const followUpEnabledRaw = String(process.env.FOLLOW_UP_ENABLED || "true")
  .trim()
  .toLowerCase();
const followUpSchedulerEnabledFromEnv = followUpEnabledRaw !== "false";
let followUpScanRunning = false;
let followUpSchedulerActive = followUpSchedulerEnabledFromEnv;
let followUpPausedUntil = 0;
const followUpDbRetryMs = Number(
  process.env.FOLLOW_UP_DB_RETRY_MS || 5 * 60 * 1000,
);

const isPrismaAuthError = (error) => {
  if (!error) return false;
  if (error.code === "P1000") return true;

  const message = String(error.message || "").toLowerCase();
  return (
    message.includes("authentication failed against database server") ||
    message.includes("provided database credentials")
  );
};

const isPrismaConnectivityError = (error) => {
  if (!error) return false;
  if (
    error.code === "P1001" ||
    error.code === "P1002" ||
    error.code === "P1017"
  ) {
    return true;
  }

  const message = String(error.message || "").toLowerCase();
  return (
    message.includes("can't reach database server") ||
    message.includes("can not reach database server") ||
    message.includes("timed out") ||
    message.includes("connection")
  );
};

const runFollowUpScheduler = async () => {
  if (!followUpSchedulerActive || followUpScanRunning) return;

  if (followUpPausedUntil > Date.now()) {
    return;
  }

  followUpScanRunning = true;
  try {
    await runSalesFollowUpScan();
  } catch (error) {
    if (isPrismaAuthError(error)) {
      followUpSchedulerActive = false;
      console.error(
        "[Server] Follow-up scheduler disabled due to invalid database credentials (P1000). Fix DATABASE_URL and restart server.",
      );
      return;
    }

    if (isPrismaConnectivityError(error)) {
      const retryDelayMs = Number.isFinite(followUpDbRetryMs)
        ? followUpDbRetryMs
        : 5 * 60 * 1000;
      followUpPausedUntil = Date.now() + Math.max(retryDelayMs, 30 * 1000);

      console.warn(
        "[Server] Follow-up scan paused due to database connectivity issue",
        {
          retryInMs: Math.max(retryDelayMs, 30 * 1000),
          resumeAt: new Date(followUpPausedUntil).toISOString(),
          message: error.message,
        },
      );
      return;
    }

    console.error("[Server] Follow-up scan failed", {
      message: error.message,
      stack: error.stack,
    });
  } finally {
    followUpScanRunning = false;
  }
};

if (followUpSchedulerEnabledFromEnv) {
  setTimeout(() => {
    void runFollowUpScheduler();
    setInterval(
      () => {
        void runFollowUpScheduler();
      },
      Number.isFinite(followUpIntervalMs) ? followUpIntervalMs : 900000,
    );
  }, 30 * 1000);
} else {
  console.info(
    "[Server] Follow-up scheduler is disabled via FOLLOW_UP_ENABLED=false",
  );
}

const shutdown = async (signal) => {
  console.info(`[Server] Received ${signal}, disconnecting Prisma client`);
  try {
    await prisma.$disconnect();
  } catch (error) {
    console.error("[Server] Prisma disconnect failed", {
      message: error.message,
    });
  } finally {
    process.exit(0);
  }
};

process.once("SIGINT", () => {
  void shutdown("SIGINT");
});

process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});
