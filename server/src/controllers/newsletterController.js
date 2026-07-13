import { randomBytes } from "node:crypto";
import { query } from "../config/db.js";
import { AppError } from "../utils/errors.js";
import { sendNewsletterEmail } from "../utils/mailer.js";

const BROADCAST_BATCH_SIZE = Math.max(1, Number(process.env.NEWSLETTER_BATCH_SIZE || 5));
const BROADCAST_BATCH_DELAY_MS = Math.max(0, Number(process.env.NEWSLETTER_BATCH_DELAY_MS || 250));
const BROADCAST_HISTORY_LIMIT = 10;

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function makeUnsubscribeToken() {
  return randomBytes(32).toString("hex");
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
    sentBy: row.sent_by,
    sentByName: row.sent_by_name || "",
    status: row.status,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at
  };
}

function clientBaseUrl(req) {
  return (process.env.CLIENT_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
}

function buildUnsubscribeUrl(req, subscriber) {
  return `${clientBaseUrl(req)}/newsletter/unsubscribe?token=${encodeURIComponent(subscriber.unsubscribe_token)}`;
}

function publicSubscribeResponse(kind) {
  const messages = {
    new: "You have successfully subscribed to the VASTRA newsletter.",
    existing: "This email is already subscribed.",
    reactivated: "Your newsletter subscription has been reactivated."
  };
  return { success: true, subscribed: true, message: messages[kind] };
}

async function findSubscriberByEmail(email) {
  const { rows } = await query(
    `SELECT id, email, is_active, unsubscribe_token
     FROM newsletter_subscribers
     WHERE LOWER(email) = LOWER($1)`,
    [email]
  );
  return rows[0] || null;
}

async function activateSubscriber(email) {
  const normalizedEmail = normalizeEmail(email);
  const existing = await findSubscriberByEmail(normalizedEmail);

  if (existing?.is_active) {
    return { subscriber: existing, kind: "existing" };
  }

  if (existing) {
    const { rows } = await query(
      `UPDATE newsletter_subscribers
       SET email = $1,
           is_active = true,
           subscribed_at = NOW(),
           unsubscribed_at = NULL,
           unsubscribe_token = COALESCE(NULLIF(unsubscribe_token, ''), $2)
       WHERE id = $3
       RETURNING id, email, is_active, unsubscribe_token`,
      [normalizedEmail, makeUnsubscribeToken(), existing.id]
    );
    return { subscriber: rows[0], kind: "reactivated" };
  }

  try {
    const { rows } = await query(
      `INSERT INTO newsletter_subscribers (email, is_active, subscribed_at, unsubscribe_token)
       VALUES ($1, true, NOW(), $2)
       RETURNING id, email, is_active, unsubscribe_token`,
      [normalizedEmail, makeUnsubscribeToken()]
    );
    return { subscriber: rows[0], kind: "new" };
  } catch (error) {
    if (error.code !== "23505") throw error;
    const raced = await findSubscriberByEmail(normalizedEmail);
    if (raced?.is_active) return { subscriber: raced, kind: "existing" };
    const { rows } = await query(
      `UPDATE newsletter_subscribers
       SET is_active = true,
           subscribed_at = NOW(),
           unsubscribed_at = NULL,
           unsubscribe_token = COALESCE(NULLIF(unsubscribe_token, ''), $1)
       WHERE LOWER(email) = LOWER($2)
       RETURNING id, email, is_active, unsubscribe_token`,
      [makeUnsubscribeToken(), normalizedEmail]
    );
    return { subscriber: rows[0], kind: "reactivated" };
  }
}

async function deactivateSubscriber(email) {
  const normalizedEmail = normalizeEmail(email);
  await query(
    `UPDATE newsletter_subscribers
     SET is_active = false, unsubscribed_at = NOW()
     WHERE LOWER(email) = LOWER($1)`,
    [normalizedEmail]
  );
  return { success: true, newsletterEnabled: false, message: "Newsletter emails disabled." };
}

async function activeSubscriberCount() {
  const { rows } = await query("SELECT COUNT(*)::int AS total FROM newsletter_subscribers WHERE is_active = true");
  return rows[0]?.total || 0;
}

async function paginatedBroadcasts(page = 1, limit = BROADCAST_HISTORY_LIMIT) {
  const safePage = Math.max(1, Number(page || 1));
  const safeLimit = Math.min(25, Math.max(1, Number(limit || BROADCAST_HISTORY_LIMIT)));
  const offset = (safePage - 1) * safeLimit;
  const [{ rows: countRows }, { rows }] = await Promise.all([
    query("SELECT COUNT(*)::int AS total FROM newsletter_broadcasts"),
    query(
      `SELECT newsletter_broadcasts.*, users.name AS sent_by_name
       FROM newsletter_broadcasts
       LEFT JOIN users ON users.id = newsletter_broadcasts.sent_by
       ORDER BY newsletter_broadcasts.created_at DESC
       LIMIT $1 OFFSET $2`,
      [safeLimit, offset]
    )
  ]);
  const total = countRows[0]?.total || 0;
  return {
    broadcasts: rows.map(serializeBroadcast),
    meta: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit))
    }
  };
}

export async function subscribeToNewsletter(req, res) {
  const { kind } = await activateSubscriber(req.body.email);
  const status = kind === "new" ? 201 : 200;
  return res.status(status).json(publicSubscribeResponse(kind));
}

export async function getNewsletterPreference(req, res) {
  const subscriber = await findSubscriberByEmail(req.user.email);
  res.json({ success: true, newsletterEnabled: Boolean(subscriber?.is_active) });
}

export async function updateNewsletterPreference(req, res) {
  if (req.body.enabled) {
    await activateSubscriber(req.user.email);
    return res.json({ success: true, newsletterEnabled: true, message: "Newsletter emails enabled." });
  }

  const result = await deactivateSubscriber(req.user.email);
  return res.json(result);
}

export async function unsubscribeFromNewsletter(req, res) {
  const token = String(req.params.token || req.body.token || "").trim();
  if (!token) throw new AppError("This unsubscribe link is invalid.", 400);

  const { rowCount } = await query(
    `UPDATE newsletter_subscribers
     SET is_active = false, unsubscribed_at = NOW()
     WHERE unsubscribe_token = $1`,
    [token]
  );

  if (!rowCount) {
    throw new AppError("This unsubscribe link is invalid or expired.", 400);
  }

  res.json({ success: true, message: "You have been unsubscribed from VASTRA newsletter emails." });
}

export async function getNewsletterAdmin(req, res) {
  const [subscriberCount, history] = await Promise.all([
    activeSubscriberCount(),
    paginatedBroadcasts(req.query.page, req.query.limit)
  ]);
  res.json({ stats: { activeSubscribers: subscriberCount }, ...history });
}

export async function getNewsletterStats(req, res) {
  const subscriberCount = await activeSubscriberCount();
  res.json({ stats: { activeSubscribers: subscriberCount } });
}

export async function listNewsletterBroadcasts(req, res) {
  const history = await paginatedBroadcasts(req.query.page, req.query.limit);
  res.json(history);
}

export async function sendNewsletterTest(req, res) {
  const testEmail = normalizeEmail(req.body.testEmail);
  await sendNewsletterEmail(testEmail, {
    ...req.body,
    subject: `[Test] ${req.body.subject}`,
    unsubscribeUrl: `${clientBaseUrl(req)}/newsletter/unsubscribe`
  });
  res.json({ success: true, message: `Test newsletter sent to ${testEmail}.` });
}

async function sendBroadcastBatch(req, subscribers, payload, broadcastId) {
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

    await query(
      `UPDATE newsletter_broadcasts
       SET successful_count = $1, failed_count = $2
       WHERE id = $3`,
      [successful, failed, broadcastId]
    );

    if (index + BROADCAST_BATCH_SIZE < subscribers.length) {
      await sleep(BROADCAST_BATCH_DELAY_MS);
    }
  }

  return { successful, failed };
}

export async function sendNewsletterBroadcast(req, res) {
  const subscribers = (await query(
    `SELECT id, email, unsubscribe_token
     FROM newsletter_subscribers
     WHERE is_active = true
     ORDER BY subscribed_at ASC`
  )).rows;

  if (!subscribers.length) {
    throw new AppError("There are no active newsletter subscribers.", 400);
  }

  const created = await query(
    `INSERT INTO newsletter_broadcasts
      (subject, heading, message, cta_text, cta_url, recipient_count, sent_by, status, started_at)
     VALUES ($1, $2, $3, NULLIF($4, ''), NULLIF($5, ''), $6, $7, 'processing', NOW())
     RETURNING *`,
    [req.body.subject, req.body.heading, req.body.message, req.body.ctaText, req.body.ctaUrl, subscribers.length, req.user.id]
  );
  const broadcast = created.rows[0];

  let summary;
  try {
    summary = await sendBroadcastBatch(req, subscribers, req.body, broadcast.id);
  } catch {
    const failedCount = subscribers.length;
    const updated = await query(
      `UPDATE newsletter_broadcasts
       SET failed_count = $1, status = 'failed', completed_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [failedCount, broadcast.id]
    );
    return res.status(502).json({
      message: "Newsletter broadcast failed before delivery could complete.",
      summary: { totalRecipients: subscribers.length, sentSuccessfully: 0, failed: failedCount },
      broadcast: serializeBroadcast(updated.rows[0])
    });
  }

  const status = summary.failed === 0 ? "completed" : (summary.successful > 0 ? "partially_failed" : "failed");
  const updated = await query(
    `UPDATE newsletter_broadcasts
     SET successful_count = $1, failed_count = $2, status = $3, completed_at = NOW()
     WHERE id = $4
     RETURNING *`,
    [summary.successful, summary.failed, status, broadcast.id]
  );

  res.json({
    success: true,
    message: status === "completed" ? "Newsletter broadcast sent." : "Newsletter broadcast finished with delivery failures.",
    summary: {
      totalRecipients: subscribers.length,
      sentSuccessfully: summary.successful,
      failed: summary.failed
    },
    broadcast: serializeBroadcast(updated.rows[0])
  });
}
