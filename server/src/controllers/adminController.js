import { query } from "../config/db.js";
import { AppError, notFound } from "../utils/errors.js";
import { serializeUser } from "../utils/serializers.js";
import { emitDashboardUpdated } from "../socket.js";
import { dashboardSectionCounts, markDashboardSectionSeen } from "../utils/dashboardSections.js";

export async function listUsers(req, res) {
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(25, Math.max(1, Number(req.query.limit || 8)));
  const offset = (page - 1) * limit;
  const filters = [];
  const params = [];
  const addParam = (value) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (req.query.role) filters.push(`role = ${addParam(req.query.role)}`);
  if (req.query.search) {
    const key = addParam(`%${req.query.search}%`);
    filters.push(`(name ILIKE ${key} OR email ILIKE ${key} OR role::text ILIKE ${key})`);
  }

  const sortMap = {
    newest: "created_at DESC",
    oldest: "created_at ASC",
    name_asc: "name ASC",
    name_desc: "name DESC",
    role: "role ASC, name ASC"
  };
  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const orderBy = sortMap[req.query.sort] || sortMap.newest;
  const count = await query(`SELECT COUNT(*)::int AS total FROM users ${where}`, params);
  const { rows } = await query(
    `SELECT * FROM users ${where} ORDER BY ${orderBy} LIMIT ${addParam(limit)} OFFSET ${addParam(offset)}`,
    params
  );
  res.json({ users: rows.map(serializeUser), meta: { page, limit, total: count.rows[0].total, totalPages: Math.max(1, Math.ceil(count.rows[0].total / limit)) } });
}

export async function updateUserRole(req, res) {
  if (req.body.role !== "vendor") {
    throw new AppError("Only user-to-vendor promotion is supported", 400);
  }

  const existing = await query("SELECT role FROM users WHERE id = $1", [req.params.id]);
  if (!existing.rows[0]) throw notFound("User not found");
  if (existing.rows[0].role !== "user") {
    throw new AppError("Only normal users can be promoted to vendor", 400);
  }

  const { rows } = await query("UPDATE users SET role = 'vendor' WHERE id = $1 RETURNING *", [req.params.id]);
  emitDashboardUpdated("users");
  res.json({ user: serializeUser(rows[0]) });
}

export async function getStats(req, res) {
  const { rows } = await query(`
    SELECT
      (SELECT COUNT(*)::int FROM products WHERE status = 'pending') AS pending_approvals,
      (SELECT COUNT(*)::int FROM orders WHERE status NOT IN ('delivered', 'cancelled')) AS active_orders,
      (SELECT COUNT(DISTINCT conversation_messages.conversation_id)::int
       FROM conversation_messages
       JOIN message_conversations ON message_conversations.id = conversation_messages.conversation_id
       WHERE message_conversations.vendor_id IS NULL
         AND conversation_messages.read_by_admin = false
         AND conversation_messages.sender_role NOT IN ('admin', 'system-admin')) AS unread_chats,
      (SELECT COUNT(*)::int FROM products WHERE status = 'approved' AND stock = 1) AS low_stock,
      (SELECT COUNT(*)::int FROM products WHERE status = 'approved' AND stock = 0) AS out_of_stock,
      (SELECT COUNT(*)::int FROM products WHERE created_at >= NOW() - INTERVAL '7 days') AS recently_added_products,
      (SELECT COUNT(*)::int FROM users WHERE role = 'user' AND created_at >= DATE_TRUNC('week', NOW())) AS new_users_this_week,
      (SELECT COUNT(*)::int
       FROM users
       WHERE role = 'vendor' AND GREATEST(created_at, updated_at) >= DATE_TRUNC('week', NOW())) AS new_vendors_this_week,
      (SELECT COUNT(*)::int FROM products WHERE status = 'approved') AS total_approved_products,
      (SELECT products.name
       FROM order_items
       JOIN orders ON orders.id = order_items.order_id
       JOIN products ON products.id = order_items.product_id
       WHERE orders.status <> 'cancelled'
       GROUP BY products.id, products.name
       ORDER BY SUM(order_items.quantity) DESC, products.name ASC
       LIMIT 1) AS top_selling_product,
      (SELECT products.name
       FROM wishlist_items
       JOIN products ON products.id = wishlist_items.product_id
       WHERE products.status = 'approved'
       GROUP BY products.id, products.name
       ORDER BY COUNT(*) DESC, products.name ASC
       LIMIT 1) AS most_wishlisted_product,
      (SELECT products.category
       FROM order_items
       JOIN orders ON orders.id = order_items.order_id
       JOIN products ON products.id = order_items.product_id
       WHERE orders.status <> 'cancelled'
       GROUP BY products.category
       ORDER BY SUM(order_items.quantity) DESC, products.category ASC
       LIMIT 1) AS popular_category
  `);
  res.json({ stats: rows[0] });
}

export async function getDashboardUpdates(req, res) {
  res.json({ updates: await dashboardSectionCounts(req.user) });
}

export async function markDashboardUpdateSeen(req, res) {
  res.json({ updates: await markDashboardSectionSeen(req.user, req.params.section) });
}
