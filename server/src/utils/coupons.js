import { AppError } from "./errors.js";

export function normalizeCouponCode(value) {
  return String(value || "").trim().toUpperCase();
}

export function calculateCouponDiscount(subtotal, coupon) {
  const amount = Number(subtotal) || 0;
  if (!coupon) return 0;
  const value = Number(coupon.discount_value);
  const raw = coupon.discount_type === "percentage" ? amount * value / 100 : value;
  return Math.min(amount, Math.max(0, Math.round(raw * 100) / 100));
}

export async function getActiveCoupon(db, code, { lock = false } = {}) {
  const normalized = normalizeCouponCode(code);
  if (!normalized) return null;
  const result = await db.query(
    `SELECT * FROM coupons WHERE code = $1 AND enabled = true${lock ? " FOR UPDATE" : ""}`,
    [normalized]
  );
  if (!result.rows[0]) throw new AppError("Coupon code is invalid or inactive.", 400);
  return result.rows[0];
}
