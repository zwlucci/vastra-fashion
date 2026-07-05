import { query } from "../config/db.js";
import { calculateCouponDiscount, getActiveCoupon, normalizeCouponCode } from "../utils/coupons.js";
import { AppError, notFound } from "../utils/errors.js";
import { emitDashboardUpdated } from "../socket.js";

function mapCoupon(row) {
  return {
    id: row.id,
    code: row.code,
    discountType: row.discount_type,
    discountValue: Number(row.discount_value),
    enabled: row.enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function cartSubtotal(userId) {
  const { rows } = await query(
    `SELECT cart_items.quantity, cart_items.selected_size, products.price, products.size_prices
     FROM cart_items JOIN products ON products.id = cart_items.product_id
     WHERE cart_items.user_id = $1 AND products.status = 'approved'`,
    [userId]
  );
  return rows.reduce((sum, item) => {
    const price = item.selected_size && item.size_prices?.[item.selected_size] !== undefined
      ? Number(item.size_prices[item.selected_size])
      : Number(item.price);
    return sum + price * item.quantity;
  }, 0);
}

export async function validateCoupon(req, res) {
  const coupon = await getActiveCoupon({ query }, req.body.code);
  const subtotal = await cartSubtotal(req.user.id);
  const discountAmount = calculateCouponDiscount(subtotal, coupon);
  res.json({ coupon: mapCoupon(coupon), subtotal, discountAmount, total: Math.max(0, subtotal - discountAmount) });
}

export async function listCoupons(_req, res) {
  const { rows } = await query("SELECT * FROM coupons ORDER BY created_at DESC");
  res.json({ coupons: rows.map(mapCoupon) });
}

export async function createCoupon(req, res) {
  const code = normalizeCouponCode(req.body.code);
  const existing = await query("SELECT id FROM coupons WHERE code = $1", [code]);
  if (existing.rows[0]) throw new AppError("Coupon code already exists", 409);
  const { rows } = await query(
    `INSERT INTO coupons (code, discount_type, discount_value, enabled, created_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [code, req.body.discountType, req.body.discountValue, req.body.enabled, req.user.id]
  );
  emitDashboardUpdated("coupons");
  res.status(201).json({ coupon: mapCoupon(rows[0]) });
}

export async function updateCoupon(req, res) {
  const { rows } = await query("UPDATE coupons SET enabled = $1 WHERE id = $2 RETURNING *", [req.body.enabled, req.params.id]);
  if (!rows[0]) throw notFound("Coupon not found");
  emitDashboardUpdated("coupons");
  res.json({ coupon: mapCoupon(rows[0]) });
}

export async function disableCoupon(req, res) {
  const { rows } = await query("UPDATE coupons SET enabled = false WHERE id = $1 RETURNING *", [req.params.id]);
  if (!rows[0]) throw notFound("Coupon not found");
  emitDashboardUpdated("coupons");
  res.json({ coupon: mapCoupon(rows[0]), message: "Coupon disabled to preserve order history." });
}
