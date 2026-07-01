import { query, withTransaction } from "../config/db.js";
import { AppError, notFound } from "../utils/errors.js";

async function getCartRows(userId) {
  const { rows } = await query(
    `SELECT cart_items.id, cart_items.quantity, cart_items.created_at,
            cart_items.selected_size, cart_items.selected_color,
            products.id AS product_id, products.name, products.price, products.size_prices, products.brand,
            products.category, products.gender, products.image_url, products.product_images, products.stock
     FROM cart_items
     JOIN products ON products.id = cart_items.product_id
     WHERE cart_items.user_id = $1 AND products.status = 'approved'
     ORDER BY cart_items.created_at DESC`,
    [userId]
  );
  return rows.map((row) => {
    const media = Array.isArray(row.product_images) ? row.product_images : [];
    const displayImage = media.find((item) => item.url && (!item.type || item.type === "image"))?.url || row.image_url;
    const effectivePrice = row.selected_size && row.size_prices?.[row.selected_size] !== undefined
      ? Number(row.size_prices[row.selected_size])
      : Number(row.price);
    return ({
    id: row.id,
    quantity: row.quantity,
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
  res.json({ items: await getCartRows(req.user.id) });
}

export async function addToCart(req, res) {
  const { productId, quantity } = req.body;
  const requestedSize = req.body.selectedSize?.trim() || "";
  const requestedColor = req.body.selectedColor?.trim() || "";
  await withTransaction(async (client) => {
    const product = await client.query("SELECT id, stock, sizes, colors, color_stock_status FROM products WHERE id = $1 AND status = 'approved' FOR UPDATE", [productId]);
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

    const existing = await client.query(
      "SELECT COALESCE(SUM(quantity), 0)::int AS quantity FROM cart_items WHERE user_id = $1 AND product_id = $2",
      [req.user.id, productId]
    );
    const remaining = Math.max(0, productRecord.stock - existing.rows[0].quantity);
    if (quantity > remaining) throw new AppError(`Only ${remaining} items are available in stock.`, 400);

    await client.query(
      `INSERT INTO cart_items (user_id, product_id, selected_size, selected_color, quantity)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, product_id, selected_size, selected_color)
       DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity`,
      [req.user.id, productId, requestedSize, requestedColor, quantity]
    );
  });

  res.status(201).json({ items: await getCartRows(req.user.id) });
}

export async function updateCartItem(req, res) {
  await withTransaction(async (client) => {
    const item = await client.query(
      `SELECT cart_items.id, cart_items.product_id, cart_items.selected_size, cart_items.selected_color,
              products.sizes, products.colors, products.stock, products.color_stock_status
       FROM cart_items JOIN products ON products.id = cart_items.product_id
       WHERE cart_items.id = $1 AND cart_items.user_id = $2 AND products.status = 'approved'
       FOR UPDATE OF products`,
      [req.params.itemId, req.user.id]
    );
    if (!item.rows[0]) throw notFound("Cart item not found");
    if ((item.rows[0].sizes || []).length && !(item.rows[0].sizes || []).includes(item.rows[0].selected_size)) {
      throw new AppError("This size is no longer available.", 400);
    }
    if ((item.rows[0].colors || []).length && !(item.rows[0].colors || []).includes(item.rows[0].selected_color)) {
      throw new AppError("This color is no longer available.", 400);
    }
    if (item.rows[0].selected_color && item.rows[0].color_stock_status?.[item.rows[0].selected_color]) {
      throw new AppError(`${item.rows[0].selected_color} is currently out of stock.`, 400);
    }
    const otherItems = await client.query(
      `SELECT COALESCE(SUM(quantity), 0)::int AS quantity FROM cart_items
       WHERE user_id = $1 AND product_id = $2 AND id <> $3`,
      [req.user.id, item.rows[0].product_id, req.params.itemId]
    );
    const availableForItem = Math.max(0, item.rows[0].stock - otherItems.rows[0].quantity);
    if (req.body.quantity > availableForItem) {
      throw new AppError(`Only ${availableForItem} items are available in stock.`, 400);
    }
    await client.query("UPDATE cart_items SET quantity = $1 WHERE id = $2", [req.body.quantity, req.params.itemId]);
  });
  res.json({ items: await getCartRows(req.user.id) });
}

export async function removeCartItem(req, res) {
  const { rows } = await query("DELETE FROM cart_items WHERE id = $1 AND user_id = $2 RETURNING id", [
    req.params.itemId,
    req.user.id
  ]);
  if (!rows[0]) throw notFound("Cart item not found");
  res.status(204).send();
}
