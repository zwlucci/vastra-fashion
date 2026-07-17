import { query } from "../config/db.js";
import { notFound } from "../utils/errors.js";
import { serializeProduct } from "../utils/serializers.js";

async function getWishlistRows(userId) {
  const { rows } = await query(
    `SELECT wishlist_items.id AS wishlist_id, wishlist_items.created_at AS wishlist_created_at,
            products.*,
            COALESCE((
              SELECT jsonb_agg(jsonb_build_object(
                'id', components.id,
                'componentProductId', components.id,
                'name', components.name,
                'componentProductName', components.name,
                'price', components.price,
                'imageUrl', COALESCE((
                  SELECT media_item.value->>'url'
                  FROM jsonb_array_elements(COALESCE(components.product_images, '[]'::jsonb)) AS media_item(value)
                  WHERE media_item.value ? 'url' AND COALESCE(media_item.value->>'type', 'image') = 'image'
                  LIMIT 1
                ), components.image_url),
                'primaryImage', COALESCE((
                  SELECT media_item.value->>'url'
                  FROM jsonb_array_elements(COALESCE(components.product_images, '[]'::jsonb)) AS media_item(value)
                  WHERE media_item.value ? 'url' AND COALESCE(media_item.value->>'type', 'image') = 'image'
                  LIMIT 1
                ), components.image_url),
                'stock', components.stock,
                'sizes', components.sizes,
                'status', components.status,
                'productType', components.product_type,
                'sortOrder', product_bundle_items.position
              ) ORDER BY product_bundle_items.position)
              FROM product_bundle_items
              JOIN products AS components ON components.id = product_bundle_items.component_product_id
              WHERE product_bundle_items.bundle_product_id = products.id
            ), '[]'::jsonb) AS bundle_components
     FROM wishlist_items
     JOIN products ON products.id = wishlist_items.product_id
     WHERE wishlist_items.user_id = $1 AND products.status = 'approved'
     ORDER BY wishlist_items.created_at DESC`,
    [userId]
  );

  return rows.map((row) => {
    const { wishlist_id, wishlist_created_at, ...product } = row;
    return {
      id: wishlist_id,
      createdAt: wishlist_created_at,
      product: serializeProduct(product)
    };
  });
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
