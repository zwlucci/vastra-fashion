import jwt from "jsonwebtoken";
import { query } from "../config/db.js";
import { AppError } from "../utils/errors.js";
import { sendNewsletterEmail } from "../utils/mailer.js";

const BROADCAST_BATCH_SIZE = Math.max(1, Number(process.env.NEWSLETTER_BATCH_SIZE || 5));
const BROADCAST_BATCH_DELAY_MS = Math.max(0, Number(process.env.NEWSLETTER_BATCH_DELAY_MS || 250));

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function sleep(ms) {
  return ms ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

function serializeBroadcast(row) {
  return {
    id: row.id,
    subject: row.subject,
    heading: row.heading,
    message: row.message,
    ctaText: row.cta_text || "",
    ctaUrl: row.cta_url || "",
    recipientCount: row.recipient_count,
    successfulCount: row.successful_count,
    failedCount: row.failed_count,
    status: row.status,
    createdAt: row.created_at,
    completedAt: row.completed_at
  };
}

function clientBaseUrl(req) {
  return (process.env.CLIENT_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
}

function buildUnsubscribeUrl(req, subscriber) {
  const token = jwt.sign(
    { type: "newsletter-unsubscribe", sub: subscriber.id, email: subscriber.email },
    process.env.JWT_SECRET
  );
  return `${clientBaseUrl(req)}/newsletter/unsubscribe?token=${encodeURIComponent(token)}`;
}

async function activeSubscriberCount() {
  const { rows } = await query("SELECT COUNT(*)::int AS total FROM newsletter_subscribers WHERE subscribed = true");
  return rows[0]?.total || 0;
}

async function recentBroadcasts(limit = 8) {
  const { rows } = await query(
    `SELECT *
     FROM newsletter_broadcasts
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows.map(serializeBroadcast);
}

export async function subscribeToNewsletter(req, res) {
  const email = normalizeEmail(req.body.email);
  const existing = await query(
    "SELECT id, subscribed FROM newsletter_subscribers WHERE LOWER(email) = LOWER($1)",
    [email]
  );

  if (existing.rows[0]?.subscribed) {
    return res.json({ message: "You're already on the VASTRA newsletter list." });
  }

  if (existing.rows[0]) {
    await query(
      `UPDATE newsletter_subscribers
       SET email = $1, subscribed = true, subscribed_at = NOW(), unsubscribed_at = NULL
       WHERE id = $2`,
      [email, existing.rows[0].id]
    );
    return res.json({ message: "Welcome back to VASTRA updates." });
  }

  await query(
    "INSERT INTO newsletter_subscribers (email, subscribed, subscribed_at) VALUES ($1, true, NOW())",
    [email]
  );
  return res.status(201).json({ message: "You're subscribed to VASTRA updates." });
}

export async function unsubscribeFromNewsletter(req, res) {
  let payload;
  try {
    payload = jwt.verify(req.body.token, process.env.JWT_SECRET);
  } catch {
    throw new AppError("This unsubscribe link is invalid or expired.", 400);
  }

  if (payload.type !== "newsletter-unsubscribe" || !payload.sub || !payload.email) {
    throw new AppError("This unsubscribe link is invalid.", 400);
  }

  const { rowCount } = await query(
    `UPDATE newsletter_subscribers
     SET subscribed = false, unsubscribed_at = NOW()
     WHERE id = $1 AND LOWER(email) = LOWER($2)`,
    [payload.sub, payload.email]
  );

  if (!rowCount) {
    throw new AppError("This subscription could not be found.", 404);
  }

  res.json({ message: "You have been unsubscribed from VASTRA newsletters." });
}

export async function getNewsletterAdmin(req, res) {
  const [subscriberCount, broadcasts] = await Promise.all([
    activeSubscriberCount(),
    recentBroadcasts(8)
  ]);
  res.json({ stats: { activeSubscribers: subscriberCount }, broadcasts });
}

export async function sendNewsletterTest(req, res) {
  const testEmail = normalizeEmail(req.body.testEmail);
  await sendNewsletterEmail(testEmail, {
    ...req.body,
    subject: `[Test] ${req.body.subject}`,
    unsubscribeUrl: `${clientBaseUrl(req)}/newsletter/unsubscribe`
  });
  res.json({ message: `Test newsletter sent to ${testEmail}.` });
}

async function sendBroadcastBatch(req, subscribers, payload) {
  let successful = 0;
  let failed = 0;

  for (let index = 0; index < subscribers.length; index += BROADCAST_BATCH_SIZE) {
    const batch = subscribers.slice(index, index + BROADCAST_BATCH_SIZE);
    const results = await Promise.allSettled(batch.map((subscriber) => sendNewsletterEmail(subscriber.email, {
      ...payload,
      unsubscribeUrl: buildUnsubscribeUrl(req, subscriber)
    })));

    results.forEach((result) => {
      if (result.status === "fulfilled") successful += 1;
      else failed += 1;
    });

    if (index + BROADCAST_BATCH_SIZE < subscribers.length) {
      await sleep(BROADCAST_BATCH_DELAY_MS);
    }
  }

  return { successful, failed };
}

export async function sendNewsletterBroadcast(req, res) {
  const subscribers = (await query(
    `SELECT id, email
     FROM newsletter_subscribers
     WHERE subscribed = true
     ORDER BY subscribed_at ASC`
  )).rows;

  if (!subscribers.length) {
    throw new AppError("There are no active newsletter subscribers yet.", 400);
  }

  const created = await query(
    `INSERT INTO newsletter_broadcasts
      (subject, heading, message, cta_text, cta_url, recipient_count, sent_by, status)
     VALUES ($1, $2, $3, NULLIF($4, ''), NULLIF($5, ''), $6, $7, 'processing')
     RETURNING *`,
    [req.body.subject, req.body.heading, req.body.message, req.body.ctaText, req.body.ctaUrl, subscribers.length, req.user.id]
  );
  const broadcast = created.rows[0];

  const summary = await sendBroadcastBatch(req, subscribers, req.body);
  const status = summary.failed === 0 ? "completed" : (summary.successful > 0 ? "partially_failed" : "failed");

  const updated = await query(
    `UPDATE newsletter_broadcasts
     SET successful_count = $1, failed_count = $2, status = $3, completed_at = NOW()
     WHERE id = $4
     RETURNING *`,
    [summary.successful, summary.failed, status, broadcast.id]
  );

  res.json({
    message: status === "completed" ? "Newsletter broadcast sent." : "Newsletter broadcast finished with delivery failures.",
    summary: {
      totalRecipients: subscribers.length,
      sentSuccessfully: summary.successful,
      failed: summary.failed
    },
    broadcast: serializeBroadcast(updated.rows[0])
  });
}
