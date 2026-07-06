import { query } from "../config/db.js";
import { emitOrderNotification } from "../socket.js";

function mapNotification(row) {
  return {
    id: row.id,
    orderId: row.order_id,
    type: row.type,
    title: row.title,
    message: row.message,
    metadata: row.metadata || {},
    targetType: row.metadata?.targetType || null,
    targetId: row.metadata?.targetId || row.order_id || null,
    targetUrl: row.metadata?.targetUrl || null,
    read: Boolean(row.read_at),
    readAt: row.read_at,
    createdAt: row.created_at
  };
}

export async function createOrderNotifications(recipientIds, notification) {
  const uniqueIds = [...new Set((recipientIds || []).filter(Boolean))];
  await Promise.all(uniqueIds.map(async (userId) => {
    const { rows } = await query(
      `INSERT INTO order_notifications (user_id, order_id, type, title, message, metadata)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [userId, notification.orderId || null, notification.type, notification.title, notification.message, notification.metadata || {}]
    );
    await emitOrderNotification(userId, mapNotification(rows[0]));
  }));
}

export { mapNotification };
