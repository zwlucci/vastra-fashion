import { query } from "../config/db.js";
import { notFound } from "../utils/errors.js";

async function getWishlistRows(userId) {
  const { rows } = await query(
    `SELECT wishlist_items.id, wishlist_items.created_at,
            products.id AS product_id, products.name, products.price, products.brand,
            products.category, products.gender, products.image_url, products.stock
     FROM wishlist_items
     JOIN products ON products.id = wishlist_items.product_id
     WHERE wishlist_items.user_id = $1 AND products.status = 'approved'
     ORDER BY wishlist_items.created_at DESC`,
    [userId]
  );

  return rows.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    product: {
      id: row.product_id,
      name: row.name,
      price: Number(row.price),
      brand: row.brand,
      category: row.category,
      gender: row.gender,
      imageUrl: row.image_url,
      stock: row.stock
    }
  }));
}

export async function getWishlist(req, res) {
  res.json({ items: await getWishlistRows(req.user.id) });
}

export async function addToWishlist(req, res) {
  const { productId } = req.body;
  const product = await query("SELECT id FROM products WHERE id = $1 AND status = 'approved'", [productId]);
  if (!product.rows[0]) throw notFound("Approved product not found");

  await query(
    `INSERT INTO wishlist_items (user_id, product_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, product_id) DO NOTHING`,
    [req.user.id, productId]
  );

  res.status(201).json({ items: await getWishlistRows(req.user.id) });
}

export async function removeFromWishlist(req, res) {
  await query("DELETE FROM wishlist_items WHERE user_id = $1 AND product_id = $2", [
    req.user.id,
    req.params.productId
  ]);
  res.json({ items: await getWishlistRows(req.user.id) });
}
