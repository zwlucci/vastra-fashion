import { query } from "../config/db.js";
import { AppError, notFound } from "../utils/errors.js";
import { saveWardrobeImage } from "../utils/imageUpload.js";
import { serializeProduct } from "../utils/serializers.js";

async function wardrobeItemsForUser(userId) {
  const { rows } = await query(
    `SELECT wardrobe_items.id AS wardrobe_item_id, wardrobe_items.created_at AS wardrobe_created_at,
            products.*, users.name AS vendor_name, users.brand_name AS vendor_brand_name,
            users.profile_image_url AS vendor_profile_image_url
     FROM wardrobe_items
     JOIN products ON products.id = wardrobe_items.product_id
     LEFT JOIN users ON users.id = products.vendor_id
     WHERE wardrobe_items.user_id = $1
       AND products.status = 'approved'
       AND products.wardrobe_enabled = true
     ORDER BY wardrobe_items.created_at DESC`,
    [userId]
  );
  return rows.map((row) => ({
    id: row.wardrobe_item_id,
    createdAt: row.wardrobe_created_at,
    product: serializeProduct(row)
  }));
}

export async function listWardrobe(req, res) {
  res.json({ items: await wardrobeItemsForUser(req.user.id) });
}

export async function addWardrobeItem(req, res) {
  const product = await query(
    "SELECT id, wardrobe_enabled FROM products WHERE id = $1 AND status = 'approved'",
    [req.body.productId]
  );
  if (!product.rows[0]) throw notFound("Approved product not found");
  if (!product.rows[0].wardrobe_enabled) {
    throw new AppError("This product is not available for wardrobe preview yet.", 400);
  }
  await query(
    `INSERT INTO wardrobe_items (user_id, product_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, product_id) DO NOTHING`,
    [req.user.id, req.body.productId]
  );
  res.status(201).json({ items: await wardrobeItemsForUser(req.user.id) });
}

export async function removeWardrobeItem(req, res) {
  await query("DELETE FROM wardrobe_items WHERE user_id = $1 AND product_id = $2", [req.user.id, req.params.productId]);
  res.json({ items: await wardrobeItemsForUser(req.user.id) });
}

function serializeCombo(combo) {
  return {
    id: combo.id,
    name: combo.name,
    items: combo.items || [],
    previewImageUrl: combo.preview_image_url || "",
    createdAt: combo.created_at,
    updatedAt: combo.updated_at
  };
}

async function normalizedComboItems(userId, items) {
  const productIds = items.map((item) => item.productId);
  const { rows } = await query(
    `SELECT products.id, products.name, products.image_url, products.wardrobe_image_url
     FROM wardrobe_items
     JOIN products ON products.id = wardrobe_items.product_id
     WHERE wardrobe_items.user_id = $1
       AND products.id = ANY($2::uuid[])
       AND products.status = 'approved'
       AND products.wardrobe_enabled = true`,
    [userId, productIds]
  );
  if (rows.length !== productIds.length) {
    throw new AppError("Every combo item must still be available in your wardrobe.", 400);
  }
  const products = new Map(rows.map((product) => [product.id, product]));
  return items.map((item) => {
    const product = products.get(item.productId);
    return {
      productId: item.productId,
      name: product.name,
      imageUrl: product.wardrobe_image_url || product.image_url,
      x: item.x,
      y: item.y,
      size: item.size,
      z: item.z
    };
  });
}

export async function listWardrobeCombos(req, res) {
  const { rows } = await query(
    "SELECT * FROM wardrobe_combos WHERE user_id = $1 ORDER BY updated_at DESC",
    [req.user.id]
  );
  res.json({ combos: rows.map(serializeCombo) });
}

export async function createWardrobeCombo(req, res) {
  const items = await normalizedComboItems(req.user.id, req.body.items);
  const { rows } = await query(
    `INSERT INTO wardrobe_combos (user_id, name, items)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [req.user.id, req.body.name, JSON.stringify(items)]
  );
  res.status(201).json({ combo: serializeCombo(rows[0]) });
}

export async function updateWardrobeCombo(req, res) {
  const existing = await query("SELECT id FROM wardrobe_combos WHERE id = $1 AND user_id = $2", [req.params.comboId, req.user.id]);
  if (!existing.rows[0]) throw notFound("Wardrobe combo not found");
  const items = await normalizedComboItems(req.user.id, req.body.items);
  const { rows } = await query(
    `UPDATE wardrobe_combos SET name = $3, items = $4
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [req.params.comboId, req.user.id, req.body.name, JSON.stringify(items)]
  );
  res.json({ combo: serializeCombo(rows[0]) });
}

export async function deleteWardrobeCombo(req, res) {
  const { rowCount } = await query("DELETE FROM wardrobe_combos WHERE id = $1 AND user_id = $2", [req.params.comboId, req.user.id]);
  if (!rowCount) throw notFound("Wardrobe combo not found");
  res.status(204).send();
}

export async function listWardrobeProducts(_req, res) {
  const { rows } = await query(
    `SELECT products.*, users.name AS vendor_name, users.brand_name AS vendor_brand_name,
            users.profile_image_url AS vendor_profile_image_url
     FROM products
     LEFT JOIN users ON users.id = products.vendor_id
     ORDER BY products.created_at DESC`
  );
  res.json({ products: rows.map(serializeProduct) });
}

export async function updateWardrobeProduct(req, res) {
  const existing = await query("SELECT * FROM products WHERE id = $1", [req.params.id]);
  if (!existing.rows[0]) throw notFound("Product not found");

  let imageUrl = existing.rows[0].wardrobe_image_url || null;
  if (req.body.removeWardrobeImage) imageUrl = null;
  if (req.body.wardrobeImageData) imageUrl = await saveWardrobeImage(req.body.wardrobeImageData);
  const enabled = req.body.wardrobeEnabled ?? existing.rows[0].wardrobe_enabled;

  const { rows } = await query(
    `UPDATE products
     SET wardrobe_enabled = $2, wardrobe_image_url = $3
     WHERE id = $1
     RETURNING *`,
    [req.params.id, enabled, imageUrl]
  );
  res.json({ product: serializeProduct(rows[0]) });
}
