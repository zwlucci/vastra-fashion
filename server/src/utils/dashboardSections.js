import { query } from "../config/db.js";
import { AppError } from "./errors.js";

const adminSections = {
  "product-approvals": {
    sql: "SELECT COUNT(*)::int AS count FROM products WHERE status = 'pending' AND created_at > $2",
    params: () => []
  },
  "users-vendors": {
    sql: "SELECT COUNT(*)::int AS count FROM users WHERE role IN ('user', 'vendor') AND id <> $1 AND GREATEST(created_at, updated_at) > $2",
    params: () => []
  },
  "order-history": {
    sql: "SELECT COUNT(*)::int AS count FROM orders WHERE GREATEST(created_at, updated_at) > $2",
    params: () => []
  },
  "contact-messages": {
    sql: "SELECT COUNT(*)::int AS count FROM contact_messages WHERE created_at > $2",
    params: () => []
  },
  "user-reviews": {
    sql: "SELECT COUNT(*)::int AS count FROM reviews WHERE GREATEST(created_at, updated_at) > $2",
    params: () => []
  },
  "product-reviews": {
    sql: "SELECT COUNT(*)::int AS count FROM product_reviews WHERE GREATEST(created_at, updated_at) > $2",
    params: () => []
  },
  "vendor-reviews": {
    sql: "SELECT COUNT(*)::int AS count FROM vendor_reviews WHERE GREATEST(created_at, updated_at) > $2",
    params: () => []
  },
  "newsletter-broadcast": {
    sql: "SELECT COUNT(*)::int AS count FROM newsletter_broadcasts WHERE COALESCE(completed_at, created_at) > $2 AND (sent_by IS NULL OR sent_by <> $1)",
    params: () => []
  }
};

const vendorSections = {
  products: {
    sql: "SELECT COUNT(*)::int AS count FROM products WHERE vendor_id = $1 AND status IN ('pending', 'rejected') AND GREATEST(created_at, updated_at) > $2",
    params: () => []
  },
  orders: {
    sql: `SELECT COUNT(DISTINCT orders.id)::int AS count
          FROM orders
          JOIN order_items ON order_items.order_id = orders.id
          JOIN products ON products.id = order_items.product_id
          WHERE products.vendor_id = $1 AND GREATEST(orders.created_at, orders.updated_at) > $2`,
    params: () => []
  },
  "returned-products": {
    sql: `SELECT COUNT(DISTINCT orders.id)::int AS count
          FROM orders
          JOIN order_items ON order_items.order_id = orders.id
          JOIN products ON products.id = order_items.product_id
          WHERE products.vendor_id = $1
            AND orders.return_status IN ('requested', 'approved')
            AND COALESCE(orders.return_requested_at, orders.updated_at) > $2`,
    params: () => []
  }
};

function registryFor(role) {
  if (role === "admin") return adminSections;
  if (role === "vendor") return vendorSections;
  throw new AppError("Dashboard updates are only available to admins and vendors.", 403);
}

async function seenMap(userId) {
  const { rows } = await query("SELECT section_key, seen_at FROM dashboard_section_seen WHERE user_id = $1", [userId]);
  return new Map(rows.map((row) => [row.section_key, row.seen_at]));
}

export async function dashboardSectionCounts(user) {
  const sections = registryFor(user.role);
  const seen = await seenMap(user.id);
  const entries = await Promise.all(Object.entries(sections).map(async ([sectionKey, config]) => {
    const seenAt = seen.get(sectionKey) || new Date(0).toISOString();
    const { rows } = await query(config.sql, [user.id, seenAt, ...config.params(user)]);
    return [sectionKey, rows[0]?.count || 0];
  }));
  return Object.fromEntries(entries);
}

export async function markDashboardSectionSeen(user, sectionKey) {
  const sections = registryFor(user.role);
  if (!sections[sectionKey]) throw new AppError("Unknown dashboard section.", 400);
  await query(
    `INSERT INTO dashboard_section_seen (user_id, section_key, seen_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (user_id, section_key) DO UPDATE SET seen_at = EXCLUDED.seen_at`,
    [user.id, sectionKey]
  );
  return dashboardSectionCounts(user);
}
