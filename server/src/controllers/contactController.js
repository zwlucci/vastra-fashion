import { query } from "../config/db.js";
import { createConversationFromContactMessage } from "./messageController.js";

export async function createContactMessage(req, res) {
  const { name, email, subject, message } = req.body;
  const { rows } = await query(
    `INSERT INTO contact_messages (name, email, subject, message)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [name, email, subject, message]
  );
  await createConversationFromContactMessage(rows[0].id);
  res.status(201).json({ message: rows[0] });
}

export async function listContactMessages(req, res) {
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(25, Math.max(1, Number(req.query.limit || 6)));
  const offset = (page - 1) * limit;
  const count = await query("SELECT COUNT(*)::int AS total FROM contact_messages");
  const { rows } = await query("SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT $1 OFFSET $2", [limit, offset]);
  res.json({ messages: rows, meta: { page, limit, total: count.rows[0].total, totalPages: Math.max(1, Math.ceil(count.rows[0].total / limit)) } });
}
