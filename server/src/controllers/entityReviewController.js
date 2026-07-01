import { query } from "../config/db.js";
import { AppError, notFound } from "../utils/errors.js";

function mapReview(row) {
  return {
    id: row.id,
    rating: Number(row.rating),
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    user: {
      id: row.user_id,
      name: row.user_name,
      profileImageUrl: row.profile_image_url || ""
    }
  };
}

async function listFor(table, targetColumn, targetId) {
  const { rows } = await query(
    `SELECT entity_reviews.*, users.name AS user_name, users.profile_image_url
     FROM ${table} entity_reviews
     JOIN users ON users.id = entity_reviews.user_id
     WHERE entity_reviews.${targetColumn} = $1
     ORDER BY entity_reviews.created_at DESC`,
    [targetId]
  );
  const count = rows.length;
  const averageRating = count ? rows.reduce((sum, row) => sum + Number(row.rating), 0) / count : 0;
  return { reviews: rows.map(mapReview), summary: { averageRating, count } };
}

export async function listProductReviews(req, res) {
  const product = await query("SELECT id FROM products WHERE id = $1 AND status = 'approved'", [req.params.productId]);
  if (!product.rows[0]) throw notFound("Product not found");
  res.json(await listFor("product_reviews", "product_id", req.params.productId));
}

export async function createProductReview(req, res) {
  const product = await query("SELECT id, vendor_id FROM products WHERE id = $1 AND status = 'approved'", [req.params.productId]);
  if (!product.rows[0]) throw notFound("Product not found");
  if (product.rows[0].vendor_id === req.user.id) throw new AppError("You cannot review your own product", 400);
  try {
    await query(
      "INSERT INTO product_reviews (user_id, product_id, rating, body) VALUES ($1, $2, $3, $4)",
      [req.user.id, req.params.productId, req.body.rating, req.body.body]
    );
  } catch (error) {
    if (error.code === "23505") throw new AppError("You have already reviewed this product", 409);
    throw error;
  }
  res.status(201).json(await listFor("product_reviews", "product_id", req.params.productId));
}

export async function updateProductReview(req, res) {
  const { rows } = await query(
    "UPDATE product_reviews SET rating = $3, body = $4 WHERE id = $1 AND user_id = $2 RETURNING product_id",
    [req.params.reviewId, req.user.id, req.body.rating, req.body.body]
  );
  if (!rows[0]) throw notFound("Review not found or not owned by user");
  res.json(await listFor("product_reviews", "product_id", rows[0].product_id));
}

export async function deleteProductReview(req, res) {
  const { rows } = await query(
    "DELETE FROM product_reviews WHERE id = $1 AND user_id = $2 RETURNING product_id",
    [req.params.reviewId, req.user.id]
  );
  if (!rows[0]) throw notFound("Review not found or not owned by user");
  res.json(await listFor("product_reviews", "product_id", rows[0].product_id));
}

export async function listVendorReviews(req, res) {
  const vendor = await query("SELECT id FROM users WHERE id = $1 AND role = 'vendor'", [req.params.vendorId]);
  if (!vendor.rows[0]) throw notFound("Vendor not found");
  res.json(await listFor("vendor_reviews", "vendor_id", req.params.vendorId));
}

export async function createVendorReview(req, res) {
  const vendor = await query("SELECT id FROM users WHERE id = $1 AND role = 'vendor'", [req.params.vendorId]);
  if (!vendor.rows[0]) throw notFound("Vendor not found");
  if (vendor.rows[0].id === req.user.id) throw new AppError("You cannot review yourself", 400);
  try {
    await query(
      "INSERT INTO vendor_reviews (user_id, vendor_id, rating, body) VALUES ($1, $2, $3, $4)",
      [req.user.id, req.params.vendorId, req.body.rating, req.body.body]
    );
  } catch (error) {
    if (error.code === "23505") throw new AppError("You have already reviewed this vendor", 409);
    throw error;
  }
  res.status(201).json(await listFor("vendor_reviews", "vendor_id", req.params.vendorId));
}

export async function updateVendorReview(req, res) {
  const { rows } = await query(
    "UPDATE vendor_reviews SET rating = $3, body = $4 WHERE id = $1 AND user_id = $2 RETURNING vendor_id",
    [req.params.reviewId, req.user.id, req.body.rating, req.body.body]
  );
  if (!rows[0]) throw notFound("Review not found or not owned by user");
  res.json(await listFor("vendor_reviews", "vendor_id", rows[0].vendor_id));
}

export async function deleteVendorReview(req, res) {
  const { rows } = await query(
    "DELETE FROM vendor_reviews WHERE id = $1 AND user_id = $2 RETURNING vendor_id",
    [req.params.reviewId, req.user.id]
  );
  if (!rows[0]) throw notFound("Review not found or not owned by user");
  res.json(await listFor("vendor_reviews", "vendor_id", rows[0].vendor_id));
}

export async function listEntityReviewsForAdmin(req, res) {
  const type = req.query.type || "product";
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(25, Math.max(1, Number(req.query.limit || 5)));
  const offset = (page - 1) * limit;
  const config = type === "product"
    ? {
        table: "product_reviews",
        targetJoin: "JOIN products targets ON targets.id = entity_reviews.product_id",
        targetName: "targets.name"
      }
    : type === "vendor"
      ? {
          table: "vendor_reviews",
          targetJoin: "JOIN users targets ON targets.id = entity_reviews.vendor_id",
          targetName: "COALESCE(targets.brand_name, targets.name)"
        }
      : null;
  if (!config) throw new AppError("Invalid review type", 400);

  const count = await query(`SELECT COUNT(*)::int AS total FROM ${config.table}`);
  const { rows } = await query(
    `SELECT entity_reviews.id, entity_reviews.rating, entity_reviews.body, entity_reviews.created_at,
            users.name AS user_name, ${config.targetName} AS entity_name
     FROM ${config.table} entity_reviews
     JOIN users ON users.id = entity_reviews.user_id
     ${config.targetJoin}
     ORDER BY entity_reviews.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  res.json({ reviews: rows.map((row) => ({
    id: row.id,
    entityType: type,
    entityName: row.entity_name,
    rating: Number(row.rating),
    body: row.body,
    createdAt: row.created_at,
    userName: row.user_name
  })), meta: {
    page,
    limit,
    total: count.rows[0].total,
    totalPages: Math.max(1, Math.ceil(count.rows[0].total / limit))
  } });
}

export async function deleteEntityReviewAsAdmin(req, res) {
  const table = req.params.type === "product" ? "product_reviews" : req.params.type === "vendor" ? "vendor_reviews" : null;
  if (!table) throw new AppError("Invalid review type", 400);
  const result = await query(`DELETE FROM ${table} WHERE id = $1`, [req.params.id]);
  if (!result.rowCount) throw notFound("Review not found");
  res.status(204).send();
}
