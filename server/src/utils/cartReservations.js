import { AppError } from "./errors.js";

export const RESERVATION_EXPIRED_MESSAGE = "Your reservation for this item expired because checkout was not completed in time. Please add it to your cart again.";
export const STOCK_CONFLICT_MESSAGE = "This item is no longer available in the requested quantity.";

export function cartReservationMinutes() {
  const value = Number(process.env.CART_RESERVATION_MINUTES || 15);
  return Number.isFinite(value) && value > 0 ? value : 15;
}

export async function releaseExpiredReservations(client, userId = null) {
  const params = [];
  let userFilter = "";
  if (userId) {
    params.push(userId);
    userFilter = `AND user_id = $${params.length}`;
  }

  const { rows } = await client.query(
    `WITH expired AS (
       SELECT id, product_id, reserved_quantity
       FROM cart_items
       WHERE reservation_status = 'active'
         AND reservation_expires_at IS NOT NULL
         AND reservation_expires_at <= NOW()
         AND reserved_quantity > 0
         ${userFilter}
       FOR UPDATE
     ),
     restored AS (
       UPDATE products
       SET stock = products.stock + expired.reserved_quantity
       FROM expired
       WHERE products.id = expired.product_id
       RETURNING products.*
     ),
     marked AS (
       UPDATE cart_items
       SET reservation_status = 'expired',
           reserved_quantity = 0
       FROM expired
       WHERE cart_items.id = expired.id
       RETURNING cart_items.id
     )
     SELECT * FROM restored`,
    params
  );
  return rows;
}

export async function reserveProductStock(client, productId, quantity) {
  const { rows } = await client.query(
    `UPDATE products
     SET stock = stock - $1
     WHERE id = $2
       AND status = 'approved'
       AND stock >= $1
     RETURNING *`,
    [quantity, productId]
  );
  if (!rows[0]) throw new AppError(STOCK_CONFLICT_MESSAGE, 409);
  return rows[0];
}

export async function restoreProductStock(client, productId, quantity) {
  if (quantity <= 0) return null;
  const { rows } = await client.query(
    "UPDATE products SET stock = stock + $1 WHERE id = $2 RETURNING *",
    [quantity, productId]
  );
  return rows[0] || null;
}
