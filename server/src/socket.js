import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { query } from "./config/db.js";
import { serializeUser } from "./utils/serializers.js";

let io;

async function unreadCountFor(user) {
  const params = [user.id];
  let where = "AND message_conversations.vendor_id IS NULL";
  let unreadWhere = "conversation_messages.read_by_admin = false AND conversation_messages.sender_role <> 'admin'";

  if (user.role !== "admin") {
    where = "AND (message_conversations.user_id = $1 OR message_conversations.vendor_id = $1)";
    unreadWhere = `(
      (message_conversations.user_id = $1 AND conversation_messages.read_by_user = false AND conversation_messages.sender_role <> 'user')
      OR
      (message_conversations.vendor_id = $1 AND conversation_messages.read_by_vendor = false AND conversation_messages.sender_role <> 'vendor')
    )`;
  }

  const { rows } = await query(
    `SELECT COUNT(conversation_messages.id)::int AS count
     FROM conversation_messages
     JOIN message_conversations ON message_conversations.id = conversation_messages.conversation_id
     LEFT JOIN conversation_deletions ON conversation_deletions.conversation_id = message_conversations.id
       AND conversation_deletions.user_id = $1
     WHERE conversation_messages.created_at > COALESCE(conversation_deletions.hidden_before, '-infinity'::timestamptz)
       AND ${unreadWhere} ${where}`,
    params
  );
  return rows[0].count;
}

async function orderNotificationCountFor(userId) {
  const { rows } = await query(
    "SELECT COUNT(*)::int AS count FROM order_notifications WHERE user_id = $1 AND read_at IS NULL",
    [userId]
  );
  return rows[0].count;
}

export function initSocket(server, allowedOrigins) {
  io = new Server(server, {
    cors: {
      origin: [...allowedOrigins],
      credentials: true
    }
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Authentication required"));

      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const { rows } = await query("SELECT * FROM users WHERE id = $1", [payload.id]);
      if (!rows[0]) return next(new Error("User no longer exists"));

      socket.user = serializeUser(rows[0]);
      return next();
    } catch {
      return next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", async (socket) => {
    socket.join(`user:${socket.user.id}`);
    if (socket.user.role === "admin") {
      socket.join("admins");
    }

    socket.emit("unread:updated", { count: await unreadCountFor(socket.user) });
    socket.emit("order-notifications:updated", { count: await orderNotificationCountFor(socket.user.id) });
  });

  return io;
}

export async function emitOrderNotificationCount(userId) {
  if (!io || !userId) return;
  io.to(`user:${userId}`).emit("order-notifications:updated", { count: await orderNotificationCountFor(userId) });
}

export async function emitOrderNotification(userId, notification) {
  if (!io || !userId) return;
  io.to(`user:${userId}`).emit("order-notification:new", {
    notification,
    count: await orderNotificationCountFor(userId)
  });
}

export function emitConversationDeleted(userId, conversationId) {
  if (!io || !userId || !conversationId) return;
  io.to(`user:${userId}`).emit("conversation:deleted", { conversationId });
}

export async function emitUnreadToUser(user) {
  if (!io || !user) return;
  io.to(`user:${user.id}`).emit("unread:updated", { count: await unreadCountFor(user) });
}

export async function emitUnreadToAdmins() {
  if (!io) return;
  const { rows } = await query("SELECT * FROM users WHERE role = 'admin'");
  await Promise.all(rows.map(async (admin) => {
    io.to(`user:${admin.id}`).emit("unread:updated", { count: await unreadCountFor(serializeUser(admin)) });
  }));
}

export function emitConversationEvent(conversation, eventName = "conversation:updated") {
  if (!io || !conversation) return;
  if (!conversation.vendor_id) {
    io.to("admins").emit(eventName, { conversationId: conversation.id });
  }
  if (conversation.user_id) {
    io.to(`user:${conversation.user_id}`).emit(eventName, { conversationId: conversation.id });
  }
  if (conversation.vendor_id) {
    io.to(`user:${conversation.vendor_id}`).emit(eventName, { conversationId: conversation.id });
  }
}

export function emitNewMessage(conversation, message) {
  if (!io || !conversation || !message) return;
  const payload = { conversationId: conversation.id, message };
  if (!conversation.vendor_id) {
    io.to("admins").emit("message:new", payload);
  }
  if (conversation.user_id) {
    io.to(`user:${conversation.user_id}`).emit("message:new", payload);
  }
  if (conversation.vendor_id) {
    io.to(`user:${conversation.vendor_id}`).emit("message:new", payload);
  }
}

export function emitMessagesRead(conversation, user) {
  if (!io || !conversation || !user) return;
  const payload = { conversationId: conversation.id, userId: user.id, role: user.role };
  if (!conversation.vendor_id) {
    io.to("admins").emit("messages:read", payload);
  }
  if (conversation.user_id) {
    io.to(`user:${conversation.user_id}`).emit("messages:read", payload);
  }
  if (conversation.vendor_id) {
    io.to(`user:${conversation.vendor_id}`).emit("messages:read", payload);
  }
}

export function emitProductUpdated(product) {
  if (!io || !product) return;
  io.emit("product:updated", {
    productId: product.id,
    stock: Number(product.stock),
    status: product.status
  });
  io.to("admins").emit("dashboard:updated", { scope: "products" });
  if (product.vendor_id) {
    io.to(`user:${product.vendor_id}`).emit("dashboard:updated", { scope: "products" });
  }
}

export function emitDashboardUpdated(scope = "all") {
  if (!io) return;
  io.to("admins").emit("dashboard:updated", { scope });
}

export async function emitCartStockInvalidated(product) {
  if (!io || !product) return;
  const { rows } = await query("SELECT DISTINCT user_id FROM cart_items WHERE product_id = $1", [product.id]);
  rows.forEach(({ user_id: userId }) => {
    io.to(`user:${userId}`).emit("cart:stock-updated", {
      productId: product.id,
      stock: Number(product.stock)
    });
  });
}

export function emitOrderUpdated(order, vendorIds = []) {
  if (!io || !order) return;
  const userId = order.user_id || order.userId;
  const payload = { orderId: order.id, userId, status: order.status };
  io.to("admins").emit("order:updated", payload);
  io.to("admins").emit("dashboard:updated", { scope: "orders" });
  if (userId) io.to(`user:${userId}`).emit("order:updated", payload);
  [...new Set(vendorIds.filter(Boolean))].forEach((vendorId) => {
    io.to(`user:${vendorId}`).emit("order:updated", payload);
    io.to(`user:${vendorId}`).emit("dashboard:updated", { scope: "orders" });
  });
}
