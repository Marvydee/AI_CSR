import express from "express";
import {
  loginSchema,
  signupSchema,
  validateRequest,
} from "../middleware/validateRequest.js";
import { authLimiter } from "../middleware/rateLimiter.js";
import {
  loginBusinessAdmin,
  loginSuperAdmin,
  signupBusinessAdmin,
} from "../services/auth.js";

const router = express.Router();
const authOpTimeoutMs = Number(process.env.AUTH_OP_TIMEOUT_MS || 10000);

const withTimeout = (promise, timeoutMs) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("AUTH_TIMEOUT"));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
};

router.post(
  "/admin/signup",
  authLimiter,
  validateRequest(signupSchema),
  async (req, res) => {
    try {
      const payload = await withTimeout(
        signupBusinessAdmin(req.validatedBody),
        Number.isFinite(authOpTimeoutMs) ? authOpTimeoutMs : 10000,
      );
      return res.status(201).json(payload);
    } catch (error) {
      if (error.message === "DB_AUTH_INVALID") {
        return res.status(503).json({
          error:
            "Database credentials are invalid. Update DATABASE_URL and restart server.",
        });
      }

      if (error.message === "EMAIL_ALREADY_EXISTS") {
        return res.status(409).json({
          error:
            "An account already exists with this email address. Use a different email or log in.",
        });
      }

      if (error.message === "AUTH_TIMEOUT") {
        return res.status(503).json({
          error:
            "Signup service timeout. Please check database connectivity and try again.",
        });
      }

      return res.status(400).json({
        error: error.message || "Failed to create account",
      });
    }
  },
);

router.post(
  "/admin/login",
  authLimiter,
  validateRequest(loginSchema),
  async (req, res) => {
    try {
      const { email, password } = req.validatedBody;
      const payload = await withTimeout(
        loginBusinessAdmin(email, password),
        Number.isFinite(authOpTimeoutMs) ? authOpTimeoutMs : 10000,
      );
      res.status(200).json(payload);
    } catch (error) {
      if (error.message === "DB_AUTH_INVALID") {
        return res.status(503).json({
          error:
            "Database credentials are invalid. Update DATABASE_URL and restart server.",
        });
      }

      if (error.message === "AUTH_TIMEOUT") {
        return res.status(503).json({
          error:
            "Login service timeout. Please check database connectivity and try again.",
        });
      }

      res.status(401).json({ error: "Invalid email or password" });
    }
  },
);

router.post(
  "/superadmin/login",
  authLimiter,
  validateRequest(loginSchema),
  async (req, res) => {
    try {
      const { email, password } = req.validatedBody;
      const payload = await withTimeout(
        loginSuperAdmin(email, password),
        Number.isFinite(authOpTimeoutMs) ? authOpTimeoutMs : 10000,
      );
      res.status(200).json(payload);
    } catch (error) {
      if (error.message === "DB_AUTH_INVALID") {
        return res.status(503).json({
          error:
            "Database credentials are invalid. Update DATABASE_URL and restart server.",
        });
      }

      if (error.message === "AUTH_TIMEOUT") {
        return res.status(503).json({
          error:
            "Login service timeout. Please check database connectivity and try again.",
        });
      }

      res.status(401).json({ error: "Invalid email or password" });
    }
  },
);

export default router;
