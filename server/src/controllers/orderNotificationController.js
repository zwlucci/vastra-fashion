import { query } from "../config/db.js";
import { notFound } from "../utils/errors.js";
import { mapNotification } from "../utils/orderNotifications.js";
import { emitOrderNotificationCount } from "../socket.js";

export async function listOrderNotifications(req, res) {
  const { rows } = await query(
    "SELECT * FROM order_notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 40",
    [req.user.id]
  );
  const count = await query("SELECT COUNT(*)::int AS count FROM order_notifications WHERE user_id = $1 AND read_at IS NULL", [req.user.id]);
  res.json({ notifications: rows.map(mapNotification), unreadCount: count.rows[0].count });
}

export async function markOrderNotificationRead(req, res) {
  const { rows } = await query(
    "UPDATE order_notifications SET read_at = COALESCE(read_at, NOW()) WHERE id = $1 AND user_id = $2 RETURNING *",
    [req.params.id, req.user.id]
  );
  if (!rows[0]) throw notFound("Notification not found");
  await emitOrderNotificationCount(req.user.id);
  res.json({ notification: mapNotification(rows[0]) });
}

export async function markAllOrderNotificationsRead(req, res) {
  await query("UPDATE order_notifications SET read_at = COALESCE(read_at, NOW()) WHERE user_id = $1", [req.user.id]);
  await emitOrderNotificationCount(req.user.id);
  res.json({ unreadCount: 0 });
}
