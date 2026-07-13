import { Router } from "express";
import { getNewsletterPreference, subscribeToNewsletter, unsubscribeFromNewsletter, updateNewsletterPreference } from "../controllers/newsletterController.js";
import { authenticateUser } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { newsletterPreferenceSchema, newsletterSubscribeSchema, newsletterUnsubscribeSchema, validate } from "../utils/validators.js";

export const newsletterRoutes = Router();

const subscribeAttempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 6;

function newsletterRateLimit(req, res, next) {
  const key = `${req.ip}:${String(req.body?.email || "").trim().toLowerCase()}`;
  const now = Date.now();
  const record = subscribeAttempts.get(key) || { count: 0, resetAt: now + WINDOW_MS };

  if (record.resetAt <= now) {
    record.count = 0;
    record.resetAt = now + WINDOW_MS;
  }

  record.count += 1;
  subscribeAttempts.set(key, record);

  if (record.count > MAX_ATTEMPTS) {
    return res.status(429).json({ message: "Too many subscription attempts. Please try again later." });
  }

  return next();
}

newsletterRoutes.post("/subscribe", newsletterRateLimit, validate(newsletterSubscribeSchema), asyncHandler(subscribeToNewsletter));
newsletterRoutes.get("/preference", authenticateUser, asyncHandler(getNewsletterPreference));
newsletterRoutes.patch("/preference", authenticateUser, validate(newsletterPreferenceSchema), asyncHandler(updateNewsletterPreference));
newsletterRoutes.get("/unsubscribe/:token", asyncHandler(unsubscribeFromNewsletter));
newsletterRoutes.post("/unsubscribe", validate(newsletterUnsubscribeSchema), asyncHandler(unsubscribeFromNewsletter));
