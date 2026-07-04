import { query, withTransaction } from "../config/db.js";
import { formatCurrency } from "../../../shared/currency.mjs";
import { AppError, notFound } from "../utils/errors.js";
import {
  emitConversationEvent,
  emitMessagesRead,
  emitNewMessage,
  emitUnreadToAdmins,
  emitUnreadToUser
} from "../socket.js";

function otherParticipantFor(row, viewer) {
  if (viewer?.role === "admin") {
    return {
      id: row.user_id || row.vendor_id,
      name: row.vendor_id && row.user_id ? `${row.user_name} ↔ ${row.vendor_brand_name || row.vendor_name}` : row.user_name || row.vendor_brand_name || row.vendor_name || row.participant_name,
      email: row.user_email || row.vendor_email || row.participant_email,
      role: row.user_role || row.vendor_role || "user",
      profileImageUrl: row.user_profile_image_url || row.vendor_profile_image_url || ""
    };
  }

  if (row.vendor_id && viewer?.id === row.vendor_id) {
    return {
      id: row.user_id,
      name: row.user_name || row.participant_name,
      email: row.user_email || row.participant_email,
      role: row.user_role || "user",
      profileImageUrl: row.user_profile_image_url || ""
    };
  }

  if (row.vendor_id) {
    return {
      id: row.vendor_id,
      name: row.vendor_brand_name || row.vendor_name || "Vendor",
      email: row.vendor_email || "",
      role: "vendor",
      profileImageUrl: row.vendor_profile_image_url || ""
    };
  }

  return {
    id: null,
    name: "VASTRA Admin",
    email: "support@vastra.example",
    role: "admin",
    profileImageUrl: ""
  };
}

function mapConversation(row, viewer) {
  return {
    id: row.id,
    userId: row.user_id,
    vendorId: row.vendor_id,
    participantName: row.participant_name,
    participantEmail: row.participant_email,
    otherParticipant: otherParticipantFor(row, viewer),
    subject: row.subject,
    lastMessage: row.last_message,
    lastMessageAt: row.last_message_at,
    unreadCount: Number(row.unread_count || 0),
    archived: Boolean(row.archived),
    archivedAt: row.archived_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapMessage(row) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    senderRole: row.sender_role,
    senderName: ["admin", "system-admin"].includes(row.sender_role) ? "VASTRA Admin" : row.sender_name || "Unknown",
    senderProfileImageUrl: row.sender_profile_image_url || "",
    body: row.body,
    imageUrl: row.image_url,
    mediaType: row.media_type === "video" || /\.(mp4|webm)(\?|$)/i.test(row.image_url || "") ? "video" : "image",
    createdAt: row.created_at
  };
}

function firstProductMedia(product) {
  const media = Array.isArray(product?.product_images) ? product.product_images : [];
  const first = media.find((item) => item?.url);
  const url = first?.url || product?.image_url || "";
  const type = first?.type === "video" || /\.(mp4|webm)(\?|$)/i.test(url) ? "video" : "image";
  return { url, type };
}

async function getAuthorizedConversation(conversationId, user) {
  const params = [conversationId, user.id];
  let where = "message_conversations.id = $1";
  if (user.role === "admin") {
    where += " AND message_conversations.vendor_id IS NULL";
  } else {
    where += " AND (message_conversations.user_id = $2 OR message_conversations.vendor_id = $2)";
  }

  const { rows } = await query(
    `SELECT message_conversations.*,
            users.name AS user_name, users.email AS user_email, users.role AS user_role, users.profile_image_url AS user_profile_image_url,
            vendor_users.name AS vendor_name, vendor_users.email AS vendor_email, vendor_users.role AS vendor_role,
            vendor_users.brand_name AS vendor_brand_name, vendor_users.profile_image_url AS vendor_profile_image_url,
            latest_message.created_at AS last_message_at,
            (conversation_archives.user_id IS NOT NULL OR
              GREATEST(COALESCE(latest_message.created_at, message_conversations.created_at), message_conversations.updated_at) < NOW() - INTERVAL '3 days') AS archived,
            conversation_archives.archived_at
     FROM message_conversations
     LEFT JOIN users ON users.id = message_conversations.user_id
     LEFT JOIN users vendor_users ON vendor_users.id = message_conversations.vendor_id
     LEFT JOIN conversation_archives ON conversation_archives.conversation_id = message_conversations.id
       AND conversation_archives.user_id = $2
     LEFT JOIN LATERAL (
       SELECT created_at FROM conversation_messages
       WHERE conversation_messages.conversation_id = message_conversations.id
       ORDER BY created_at DESC LIMIT 1
     ) latest_message ON true
     WHERE ${where}`,
    params
  );
  if (!rows[0]) throw notFound("Conversation not found");
  return rows[0];
}

async function getConversationForEmit(conversationId) {
  const { rows } = await query("SELECT * FROM message_conversations WHERE id = $1", [conversationId]);
  return rows[0];
}

async function getConversationMessages(conversationId) {
  const { rows } = await query(
    `SELECT conversation_messages.*, users.name AS sender_name, users.profile_image_url AS sender_profile_image_url
     FROM conversation_messages
     LEFT JOIN users ON users.id = conversation_messages.sender_id
     WHERE conversation_messages.conversation_id = $1
     ORDER BY conversation_messages.created_at ASC`,
    [conversationId]
  );
  return rows.map(mapMessage);
}

function unreadWhereForUser(user, conversationAlias = "message_conversations", messageAlias = "conversation_messages") {
  if (user.role === "admin") return `${messageAlias}.read_by_admin = false AND ${messageAlias}.sender_role <> 'admin'`;
  return `((${conversationAlias}.user_id = $1 AND ${messageAlias}.read_by_user = false AND ${messageAlias}.sender_role <> 'user')
          OR (${conversationAlias}.vendor_id = $1 AND ${messageAlias}.read_by_vendor = false AND ${messageAlias}.sender_role <> 'vendor'))`;
}

async function getConversationUnreadCount(conversation, user) {
  let unreadWhere = "read_by_admin = false AND sender_role <> 'admin'";
  if (user.role !== "admin" && conversation.vendor_id === user.id) {
    unreadWhere = "read_by_vendor = false AND sender_role <> 'vendor'";
  } else if (user.role !== "admin") {
    unreadWhere = "read_by_user = false AND sender_role <> 'user'";
  }
  const { rows } = await query(
    `SELECT COUNT(*)::int AS count FROM conversation_messages WHERE conversation_id = $1 AND ${unreadWhere}`,
    [conversation.id]
  );
  return rows[0].count;
}

async function createConversationMessage(client, { conversationId, senderId = null, senderRole, body, imageUrl = "", mediaType = "" }) {
  const readByAdmin = senderRole === "admin" || senderRole === "system-admin";
  const readByUser = senderRole === "user";
  const readByVendor = senderRole === "vendor";
  const { rows } = await client.query(
    `INSERT INTO conversation_messages
       (conversation_id, sender_id, sender_role, body, image_url, media_type, read_by_user, read_by_vendor, read_by_admin)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [conversationId, senderId, senderRole, body, imageUrl || null, mediaType || (/\.(mp4|webm)(\?|$)/i.test(imageUrl) ? "video" : "image"), readByUser, readByVendor, readByAdmin]
  );
  await client.query("UPDATE message_conversations SET updated_at = NOW() WHERE id = $1", [conversationId]);
  await client.query("DELETE FROM conversation_archives WHERE conversation_id = $1", [conversationId]);
  return rows[0];
}

async function emitMessageSideEffects(conversation, rawMessage) {
  if (!conversation || !rawMessage) return;
  const messages = await getConversationMessages(conversation.id);
  const message = messages.find((item) => item.id === rawMessage.id) || mapMessage(rawMessage);
  emitNewMessage(conversation, message);
  emitConversationEvent(conversation);

  if (rawMessage.sender_role === "admin" || rawMessage.sender_role === "system-admin") {
    if (conversation.user_id) await emitUnreadToUser({ id: conversation.user_id, role: "user" });
    if (conversation.vendor_id) await emitUnreadToUser({ id: conversation.vendor_id, role: "vendor" });
  } else if (rawMessage.sender_role === "vendor") {
    if (conversation.user_id) await emitUnreadToUser({ id: conversation.user_id, role: "user" });
    if (!conversation.vendor_id) await emitUnreadToAdmins();
  } else {
    if (conversation.vendor_id) await emitUnreadToUser({ id: conversation.vendor_id, role: "vendor" });
    if (!conversation.vendor_id) await emitUnreadToAdmins();
  }
}

export async function createConversationFromContactMessage(contactMessageId) {
  const result = await withTransaction(async (client) => {
    const contact = await client.query("SELECT * FROM contact_messages WHERE id = $1", [contactMessageId]);
    if (!contact.rows[0]) throw notFound("Contact message not found");
    const message = contact.rows[0];
    const matchedUser = await client.query("SELECT id, role FROM users WHERE lower(email) = lower($1) LIMIT 1", [message.email]);

    const conversation = await client.query(
      `INSERT INTO message_conversations
         (user_id, contact_message_id, participant_name, participant_email, subject)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (contact_message_id)
       DO UPDATE SET participant_name = EXCLUDED.participant_name
       RETURNING *`,
      [matchedUser.rows[0]?.id || null, message.id, message.name, message.email, message.subject]
    );

    const existingMessage = await client.query("SELECT id FROM conversation_messages WHERE conversation_id = $1 LIMIT 1", [conversation.rows[0].id]);
    if (existingMessage.rows[0]) return { conversation: conversation.rows[0], message: null };

    const created = await createConversationMessage(client, {
      conversationId: conversation.rows[0].id,
      senderId: matchedUser.rows[0]?.id || null,
      senderRole: matchedUser.rows[0]?.role || "user",
      body: message.message
    });

    return { conversation: conversation.rows[0], message: created };
  });

  if (result.message) await emitMessageSideEffects(result.conversation, result.message);
  return result.conversation;
}

export async function openContactConversation(req, res) {
  const conversation = await createConversationFromContactMessage(req.params.id);
  res.status(201).json({ conversation: mapConversation(conversation, req.user) });
}

export async function openVendorConversation(req, res) {
  const { vendorId } = req.params;
  const { productId, body = "" } = req.body;
  if (vendorId === req.user.id) throw new AppError("You cannot message yourself", 400);

  const vendor = await query("SELECT id, name, email, brand_name FROM users WHERE id = $1 AND role = 'vendor'", [vendorId]);
  if (!vendor.rows[0]) throw notFound("Vendor not found");

  let product = null;
  if (productId) {
    const result = await query("SELECT id, name, price, image_url, product_images FROM products WHERE id = $1 AND vendor_id = $2 AND status = 'approved'", [productId, vendorId]);
    product = result.rows[0] || null;
  }

  const result = await withTransaction(async (client) => {
    const existing = await client.query(
      `SELECT * FROM message_conversations
       WHERE user_id = $1 AND vendor_id = $2 AND contact_message_id IS NULL
       ORDER BY created_at ASC
       LIMIT 1`,
      [req.user.id, vendorId]
    );
    const subject = product ? `Question about ${product.name}` : `Chat with ${vendor.rows[0].brand_name || vendor.rows[0].name}`;
    const conversation = existing.rows[0]
      ? existing
      : await client.query(
        `INSERT INTO message_conversations (user_id, vendor_id, participant_name, participant_email, subject)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [req.user.id, vendorId, req.user.name, req.user.email, subject]
      );
    const text = [
      product ? `Product: ${product.name}\nPrice: ${formatCurrency(product.price)}\nProduct ID: ${product.id}` : "",
      body.trim()
    ].filter(Boolean).join("\n\n");
    const productMedia = firstProductMedia(product);
    const message = text
      ? await createConversationMessage(client, {
        conversationId: conversation.rows[0].id,
        senderId: req.user.id,
        senderRole: req.user.role === "vendor" ? "vendor" : "user",
        body: text,
        imageUrl: productMedia.url,
        mediaType: productMedia.type
      })
      : null;
    return { conversation: conversation.rows[0], message };
  });

  if (result.message) await emitMessageSideEffects(result.conversation, result.message);
  res.status(201).json({ conversation: mapConversation(result.conversation, req.user) });
}

export async function sendSystemMessageToUser({ userId, subject, body, imageUrl = "", mediaType = "", senderId = null }) {
  const result = await withTransaction(async (client) => {
    const user = await client.query("SELECT id, name, email FROM users WHERE id = $1", [userId]);
    if (!user.rows[0]) return null;

    const conversation = await client.query(
      `INSERT INTO message_conversations (user_id, participant_name, participant_email, subject)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [user.rows[0].id, user.rows[0].name, user.rows[0].email, subject]
    );

    const message = await createConversationMessage(client, {
      conversationId: conversation.rows[0].id,
      senderId,
      senderRole: senderId ? "admin" : "system-admin",
      body,
      imageUrl,
      mediaType
    });
    return { conversation: conversation.rows[0], message };
  });

  if (result) await emitMessageSideEffects(result.conversation, result.message);
}

function orderItemLines(items = []) {
  return items.map((item) => {
    const variation = [item.selectedSize && `Size ${item.selectedSize}`, item.selectedColor].filter(Boolean).join(" / ");
    return `${item.name}${variation ? ` (${variation})` : ""} - Qty ${item.quantity} x ${formatCurrency(item.priceAtPurchase)}`;
  });
}

export async function sendOrderPlacedMessage(order) {
  const result = await withTransaction(async (client) => {
    const user = await client.query("SELECT id, name, email FROM users WHERE id = $1", [order.userId]);
    if (!user.rows[0]) return null;
    let conversation = await client.query(
      "SELECT * FROM message_conversations WHERE order_id = $1 AND user_id = $2 AND vendor_id IS NULL LIMIT 1",
      [order.id, order.userId]
    );
    if (!conversation.rows[0]) {
      conversation = await client.query(
        `INSERT INTO message_conversations
           (user_id, order_id, participant_name, participant_email, subject)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [order.userId, order.id, user.rows[0].name, user.rows[0].email, `Order #${String(order.id).slice(0, 8)} updates`]
      );
    }
    const body = [
      `Your VASTRA order #${order.id} has been placed successfully.`,
      ...orderItemLines(order.items),
      `Payment: ${order.paymentMethod === "card" ? "Card" : "Cash on Delivery"} (${order.paymentStatus})`,
      `Grand total: ${formatCurrency(order.totalAmount)}`,
      "We will let you know as soon as its shipping status changes."
    ].join("\n\n");
    const firstItem = order.items?.[0];
    const message = await createConversationMessage(client, {
      conversationId: conversation.rows[0].id,
      senderRole: "system-admin",
      body,
      imageUrl: firstItem?.imageUrl || ""
    });
    return { conversation: conversation.rows[0], message };
  });
  if (result) await emitMessageSideEffects(result.conversation, result.message);
  return result;
}

export async function sendOrderStatusMessage({ orderId, userId, vendorId = null, senderId, senderRole, status, explanation = "", items = [], totalAmount = 0 }) {
  const result = await withTransaction(async (client) => {
    const user = await client.query("SELECT id, name, email FROM users WHERE id = $1", [userId]);
    if (!user.rows[0]) return null;

    let conversation = await client.query(
      `SELECT * FROM message_conversations
       WHERE order_id = $1 AND user_id = $2 AND vendor_id IS NOT DISTINCT FROM $3
       LIMIT 1`,
      [orderId, userId, vendorId]
    );
    if (!conversation.rows[0]) {
      conversation = await client.query(
        `INSERT INTO message_conversations
           (user_id, vendor_id, order_id, participant_name, participant_email, subject)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [userId, vendorId, orderId, user.rows[0].name, user.rows[0].email, `Order #${String(orderId).slice(0, 8)} updates`]
      );
    }

    const displayStatus = status.charAt(0).toUpperCase() + status.slice(1);
    const timestamp = new Date().toISOString();
    const body = [
      `Your order #${orderId} shipping status has been updated to: ${displayStatus}.`,
      explanation ? `Details: ${explanation}` : "",
      ...orderItemLines(items),
      `Order total: ${formatCurrency(totalAmount)}`,
      `Updated: ${timestamp}`
    ].filter(Boolean).join("\n\n");
    const firstItem = items[0];
    const message = await createConversationMessage(client, {
      conversationId: conversation.rows[0].id,
      senderId,
      senderRole,
      body,
      imageUrl: firstItem?.imageUrl || ""
    });
    return { conversation: conversation.rows[0], message };
  });

  if (result) await emitMessageSideEffects(result.conversation, result.message);
  return result;
}

export async function listConversations(req, res) {
  const params = [req.user.id];
  let where = "WHERE message_conversations.vendor_id IS NULL";
  if (req.user.role !== "admin") {
    where = "WHERE (message_conversations.user_id = $1 OR message_conversations.vendor_id = $1)";
  }
  const unreadExpression = req.user.role === "admin"
    ? "conversation_messages.read_by_admin = false AND conversation_messages.sender_role <> 'admin'"
    : unreadWhereForUser(req.user);

  const { rows } = await query(
    `SELECT message_conversations.*,
            users.name AS user_name, users.email AS user_email, users.role AS user_role, users.profile_image_url AS user_profile_image_url,
            vendor_users.name AS vendor_name, vendor_users.email AS vendor_email, vendor_users.role AS vendor_role,
            vendor_users.brand_name AS vendor_brand_name, vendor_users.profile_image_url AS vendor_profile_image_url,
            last_message.body AS last_message,
            last_message.created_at AS last_message_at,
            (conversation_archives.user_id IS NOT NULL OR
              GREATEST(COALESCE(last_message.created_at, message_conversations.created_at), message_conversations.updated_at) < NOW() - INTERVAL '3 days') AS archived,
            conversation_archives.archived_at,
            COUNT(conversation_messages.id) FILTER (WHERE ${unreadExpression}) AS unread_count
     FROM message_conversations
     LEFT JOIN users ON users.id = message_conversations.user_id
     LEFT JOIN users vendor_users ON vendor_users.id = message_conversations.vendor_id
     LEFT JOIN conversation_archives ON conversation_archives.conversation_id = message_conversations.id
       AND conversation_archives.user_id = $1
     LEFT JOIN LATERAL (
       SELECT body, created_at
       FROM conversation_messages
       WHERE conversation_messages.conversation_id = message_conversations.id
       ORDER BY created_at DESC
       LIMIT 1
     ) last_message ON true
     LEFT JOIN conversation_messages ON conversation_messages.conversation_id = message_conversations.id
     ${where}
     GROUP BY message_conversations.id, users.name, users.email, users.role, users.profile_image_url,
              vendor_users.name, vendor_users.email, vendor_users.role, vendor_users.brand_name, vendor_users.profile_image_url,
              last_message.body, last_message.created_at, conversation_archives.user_id, conversation_archives.archived_at
     ORDER BY COALESCE(last_message.created_at, message_conversations.updated_at) DESC`,
    params
  );
  res.json({ conversations: rows.map((row) => mapConversation(row, req.user)) });
}

export async function getUnreadMessageCount(req, res) {
  const params = [];
  let where = "AND message_conversations.vendor_id IS NULL";
  let unreadWhere = "conversation_messages.read_by_admin = false AND conversation_messages.sender_role <> 'admin'";
  if (req.user.role !== "admin") {
    params.push(req.user.id);
    where = "AND (message_conversations.user_id = $1 OR message_conversations.vendor_id = $1)";
    unreadWhere = unreadWhereForUser(req.user);
  }

  const { rows } = await query(
    `SELECT COUNT(conversation_messages.id)::int AS count
     FROM conversation_messages
     JOIN message_conversations ON message_conversations.id = conversation_messages.conversation_id
     WHERE ${unreadWhere} ${where}`,
    params
  );
  res.json({ count: rows[0].count });
}

export async function markConversationRead(req, res) {
  const conversation = await getAuthorizedConversation(req.params.id, req.user);
  if (req.user.role === "admin") {
    await query("UPDATE conversation_messages SET read_by_admin = true WHERE conversation_id = $1 AND sender_role <> 'admin'", [conversation.id]);
  } else if (conversation.vendor_id === req.user.id) {
    await query("UPDATE conversation_messages SET read_by_vendor = true WHERE conversation_id = $1 AND sender_role <> 'vendor'", [conversation.id]);
  } else {
    await query("UPDATE conversation_messages SET read_by_user = true WHERE conversation_id = $1 AND sender_role <> 'user'", [conversation.id]);
  }

  emitMessagesRead(conversation, req.user);
  emitConversationEvent(conversation);
  await emitUnreadToUser(req.user);
  res.json({ unreadCount: await getConversationUnreadCount(conversation, req.user) });
}

export async function setConversationArchived(req, res) {
  const conversation = await getAuthorizedConversation(req.params.id, req.user);
  if (req.body.archived) {
    await query(
      `INSERT INTO conversation_archives (conversation_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (conversation_id, user_id) DO UPDATE SET archived_at = NOW()`,
      [conversation.id, req.user.id]
    );
  } else {
    await query("DELETE FROM conversation_archives WHERE conversation_id = $1 AND user_id = $2", [conversation.id, req.user.id]);
    await query("UPDATE message_conversations SET updated_at = NOW() WHERE id = $1", [conversation.id]);
  }
  emitConversationEvent(conversation);
  res.json({ archived: req.body.archived, archivedAt: req.body.archived ? new Date().toISOString() : null });
}

export async function getConversation(req, res) {
  const conversation = await getAuthorizedConversation(req.params.id, req.user);
  const messages = await getConversationMessages(conversation.id);
  res.json({ conversation: mapConversation(conversation, req.user), messages });
}

export async function replyToConversation(req, res) {
  const conversation = await getAuthorizedConversation(req.params.id, req.user);
  const senderRole = req.user.role === "admin" ? "admin" : req.user.role;
  const rawMessage = await withTransaction(async (client) => createConversationMessage(client, {
    conversationId: conversation.id,
    senderId: req.user.id,
    senderRole,
    body: req.body.body
  }));
  await emitMessageSideEffects(await getConversationForEmit(conversation.id), rawMessage);
  res.status(201).json({ message: mapMessage(rawMessage) });
}
