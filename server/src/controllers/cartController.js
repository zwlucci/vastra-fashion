import { query, withTransaction } from "../config/db.js";
import { AppError, notFound } from "../utils/errors.js";
import { emitCartStockInvalidated, emitProductUpdated } from "../socket.js";
import { updateStockAlertState } from "./productController.js";
import {
  RESERVATION_EXPIRED_MESSAGE,
  STOCK_CONFLICT_MESSAGE,
  cartReservationMinutes,
  releaseExpiredReservations,
  reserveProductStock,
  restoreProductStock
} from "../utils/cartReservations.js";

async function publishStockChanges(products) {
  const byId = new Map((products || []).filter(Boolean).map((product) => [product.id, product]));
  await Promise.all([...byId.values()].map(async (product) => {
    await updateStockAlertState(product);
    emitProductUpdated(product);
    await emitCartStockInvalidated(product);
  }));
}

async function getCartRows(userId, client = null) {
  const runQuery = client ? client.query.bind(client) : query;
  const { rows } = await runQuery(
    `SELECT cart_items.id, cart_items.quantity, cart_items.created_at,
            cart_items.selected_size, cart_items.selected_color,
            cart_items.reserved_quantity, cart_items.reservation_status, cart_items.reservation_expires_at,
            products.id AS product_id, products.name, products.price, products.size_prices, products.brand,
            products.status AS product_status,
            products.category, products.gender, products.image_url, products.product_images, products.stock
     FROM cart_items
     JOIN products ON products.id = cart_items.product_id
     WHERE cart_items.user_id = $1
       AND cart_items.reservation_status IN ('active', 'expired')
     ORDER BY cart_items.created_at DESC`,
    [userId]
  );
  return rows.map((row) => {
    const media = Array.isArray(row.product_images) ? row.product_images : [];
    const displayImage = media.find((item) => item.url && (!item.type || item.type === "image"))?.url || row.image_url;
    const effectivePrice = row.selected_size && row.size_prices?.[row.selected_size] !== undefined
      ? Number(row.size_prices[row.selected_size])
      : Number(row.price);
    const productUnavailable = row.product_status !== "approved";
    return ({
    id: row.id,
    quantity: row.quantity,
    reservedQuantity: row.reserved_quantity,
    reservationStatus: row.reservation_status,
    reservationExpiresAt: row.reservation_expires_at,
    reservationExpired: row.reservation_status === "expired" || productUnavailable,
    reservationMessage: row.reservation_status === "expired" ? RESERVATION_EXPIRED_MESSAGE : (productUnavailable ? `"${row.name}" is no longer available. Remove it from your cart before continuing.` : ""),
    selectedSize: row.selected_size || "",
    selectedColor: row.selected_color || "",
    createdAt: row.created_at,
    product: {
      id: row.product_id,
      name: row.name,
      price: effectivePrice,
      basePrice: Number(row.price),
      brand: row.brand,
      category: row.category,
      gender: row.gender,
      imageUrl: displayImage,
      stock: row.stock
    }
  });
  });
}

export async function getCart(req, res) {
  const result = await withTransaction(async (client) => {
    const products = await releaseExpiredReservations(client, req.user.id);
    const items = await getCartRows(req.user.id, client);
    return { items, products };
  });
  await publishStockChanges(result.products);
  res.json({ items: result.items });
}

export async function addToCart(req, res) {
  const { productId, quantity } = req.body;
  const requestedSize = req.body.selectedSize?.trim() || "";
  const requestedColor = req.body.selectedColor?.trim() || "";
  const result = await withTransaction(async (client) => {
    const expiredProducts = await releaseExpiredReservations(client, req.user.id);
    await client.query(
      `UPDATE cart_items
       SET reservation_status = 'released'
       WHERE user_id = $1
         AND product_id = $2
         AND selected_size = $3
         AND selected_color = $4
         AND reservation_status = 'expired'`,
      [req.user.id, productId, requestedSize, requestedColor]
    );

    const product = await client.query("SELECT id, stock, sizes, colors, color_stock_status FROM products WHERE id = $1 AND status = 'approved'", [productId]);
    const productRecord = product.rows[0];
    if (!productRecord) throw notFound("Approved product not found");

    const sizes = productRecord.sizes || [];
    if (sizes.length && !sizes.includes(requestedSize)) {
      throw new AppError("Please select an available size before adding to cart", 400);
    }
    const colors = productRecord.colors || [];
    if (colors.length && !colors.includes(requestedColor)) {
      throw new AppError("Please select an available color before adding to cart", 400);
    }
    if (requestedColor && productRecord.color_stock_status?.[requestedColor]) {
      throw new AppError(`${requestedColor} is currently out of stock.`, 400);
    }

    const reservedProduct = await reserveProductStock(client, productId, quantity);
    await client.query(
      `INSERT INTO cart_items
         (user_id, product_id, selected_size, selected_color, quantity, reserved_quantity, reservation_status, reservation_expires_at)
       VALUES ($1, $2, $3, $4, $5, $5, 'active', NOW() + ($6::int * INTERVAL '1 minute'))
       ON CONFLICT (user_id, product_id, selected_size, selected_color)
       WHERE reservation_status = 'active'
       DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity,
                     reserved_quantity = cart_items.reserved_quantity + EXCLUDED.reserved_quantity,
                     reservation_expires_at = EXCLUDED.reservation_expires_at`,
      [req.user.id, productId, requestedSize, requestedColor, quantity, cartReservationMinutes()]
    );
    return { products: [...expiredProducts, reservedProduct] };
  });

  await publishStockChanges(result.products);
  res.status(201).json({ items: await getCartRows(req.user.id) });
}

export async function updateCartItem(req, res) {
  const result = await withTransaction(async (client) => {
    const expiredProducts = await releaseExpiredReservations(client, req.user.id);
    const item = await client.query(
      `SELECT cart_items.id, cart_items.product_id, cart_items.quantity, cart_items.reserved_quantity,
              cart_items.reservation_status, cart_items.reservation_expires_at,
              cart_items.selected_size, cart_items.selected_color,
              products.name, products.sizes, products.colors, products.stock, products.color_stock_status, products.status
       FROM cart_items JOIN products ON products.id = cart_items.product_id
       WHERE cart_items.id = $1 AND cart_items.user_id = $2
       FOR UPDATE OF cart_items`,
      [req.params.itemId, req.user.id]
    );
    if (!item.rows[0]) throw notFound("Cart item not found");
    const cartItem = item.rows[0];
    if (cartItem.reservation_status !== "active" || new Date(cartItem.reservation_expires_at).getTime() <= Date.now()) {
      throw new AppError(RESERVATION_EXPIRED_MESSAGE, 409);
    }
    if (cartItem.status !== "approved") {
      throw new AppError(`"${cartItem.name || "This item"}" is no longer available. Remove it from your cart before continuing.`, 409);
    }
    if ((cartItem.sizes || []).length && !(cartItem.sizes || []).includes(cartItem.selected_size)) {
      throw new AppError("This size is no longer available.", 400);
    }
    if ((cartItem.colors || []).length && !(cartItem.colors || []).includes(cartItem.selected_color)) {
      throw new AppError("This color is no longer available.", 400);
    }
    if (cartItem.selected_color && cartItem.color_stock_status?.[cartItem.selected_color]) {
      throw new AppError(`${cartItem.selected_color} is currently out of stock.`, 400);
    }
    const nextQuantity = req.body.quantity;
    const delta = nextQuantity - cartItem.reserved_quantity;
    const products = [...expiredProducts];
    if (delta > 0) {
      products.push(await reserveProductStock(client, cartItem.product_id, delta));
    } else if (delta < 0) {
      const restored = await restoreProductStock(client, cartItem.product_id, Math.abs(delta));
      if (restored) products.push(restored);
    }
    await client.query(
      `UPDATE cart_items
       SET quantity = $1,
           reserved_quantity = $1,
           reservation_expires_at = NOW() + ($2::int * INTERVAL '1 minute')
       WHERE id = $3`,
      [nextQuantity, cartReservationMinutes(), req.params.itemId]
    );
    return { products };
  });
  await publishStockChanges(result.products);
  res.json({ items: await getCartRows(req.user.id) });
}

export async function removeCartItem(req, res) {
  const result = await withTransaction(async (client) => {
    const expiredProducts = await releaseExpiredReservations(client, req.user.id);
    const item = await client.query(
      `SELECT id, product_id, reserved_quantity, reservation_status
       FROM cart_items
       WHERE id = $1
         AND user_id = $2
         AND reservation_status IN ('active', 'expired')
       FOR UPDATE`,
      [req.params.itemId, req.user.id]
    );
    if (!item.rows[0]) throw notFound("Cart item not found");
    const products = [...expiredProducts];
    if (item.rows[0].reservation_status === "active" && item.rows[0].reserved_quantity > 0) {
      const restored = await restoreProductStock(client, item.rows[0].product_id, item.rows[0].reserved_quantity);
      if (restored) products.push(restored);
    }
    await client.query(
      `UPDATE cart_items
       SET reservation_status = 'released',
           reserved_quantity = 0
       WHERE id = $1`,
      [req.params.itemId]
    );
    return { products };
  });
  await publishStockChanges(result.products);
  res.status(204).send();
}
