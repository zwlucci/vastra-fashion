import { query } from "../config/db.js";
import { emitDashboardUpdated } from "../socket.js";
import { AppError, notFound } from "../utils/errors.js";
import { deleteUploadedFiles, reviewImageLimit, saveReviewImageFiles } from "../utils/imageUpload.js";

function mapReview(row) {
  return {
    id: row.id,
    rating: Number(row.rating),
    body: row.body,
    imageUrls: Array.isArray(row.image_urls) ? row.image_urls : [],
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

async function hasPurchasedProduct(userId, productId) {
  const { rows } = await query(
    `SELECT EXISTS (
       SELECT 1
       FROM orders
       JOIN order_items ON order_items.order_id = orders.id
       WHERE orders.user_id = $1
         AND order_items.product_id = $2
         AND orders.status = 'delivered'
     ) AS purchased`,
    [userId, productId]
  );
  return rows[0].purchased;
}

function retainedReviewImages(existingUrls = [], retainedUrls = []) {
  const existingSet = new Set(existingUrls);
  return (retainedUrls || []).filter((url) => existingSet.has(url));
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
  if (!(await hasPurchasedProduct(req.user.id, req.params.productId))) {
    throw new AppError("You can only review products you have purchased.", 403);
  }
  const imageUrls = await saveReviewImageFiles(req.files || []);
  try {
    await query(
      "INSERT INTO product_reviews (user_id, product_id, rating, body, image_urls) VALUES ($1, $2, $3, $4, $5)",
      [req.user.id, req.params.productId, req.body.rating, req.body.body, JSON.stringify(imageUrls)]
    );
  } catch (error) {
    await deleteUploadedFiles(imageUrls);
    if (error.code === "23505") throw new AppError("You have already reviewed this product", 409);
    throw error;
  }
  emitDashboardUpdated("product-reviews");
  res.status(201).json(await listFor("product_reviews", "product_id", req.params.productId));
}

export async function getProductReviewEligibility(req, res) {
  const product = await query("SELECT id, vendor_id FROM products WHERE id = $1 AND status = 'approved'", [req.params.productId]);
  if (!product.rows[0]) throw notFound("Product not found");
  const purchased = await hasPurchasedProduct(req.user.id, req.params.productId);
  res.json({ canReview: purchased && product.rows[0].vendor_id !== req.user.id });
}

export async function updateProductReview(req, res) {
  const existing = await query(
    "SELECT product_id, image_urls FROM product_reviews WHERE id = $1 AND user_id = $2",
    [req.params.reviewId, req.user.id]
  );
  if (!existing.rows[0]) throw notFound("Review not found or not owned by user");
  if (!(await hasPurchasedProduct(req.user.id, existing.rows[0].product_id))) {
    throw new AppError("You can only review products you have purchased.", 403);
  }
  const existingImageUrls = Array.isArray(existing.rows[0].image_urls) ? existing.rows[0].image_urls : [];
  const retainedImageUrls = Array.isArray(req.body.retainedImageUrls)
    ? retainedReviewImages(existingImageUrls, req.body.retainedImageUrls)
    : existingImageUrls;
  const newImageUrls = await saveReviewImageFiles(req.files || []);
  const nextImageUrls = [...retainedImageUrls, ...newImageUrls];
  if (nextImageUrls.length > reviewImageLimit) {
    await deleteUploadedFiles(newImageUrls);
    throw new AppError("You can upload a maximum of 5 images.", 400);
  }

  let rows;
  try {
    const result = await query(
      "UPDATE product_reviews SET rating = $3, body = $4, image_urls = $5 WHERE id = $1 AND user_id = $2 RETURNING product_id",
      [req.params.reviewId, req.user.id, req.body.rating, req.body.body, JSON.stringify(nextImageUrls)]
    );
    rows = result.rows;
  } catch (error) {
    await deleteUploadedFiles(newImageUrls);
    throw error;
  }
  if (!rows[0]) {
    await deleteUploadedFiles(newImageUrls);
    throw notFound("Review not found or not owned by user");
  }
  await deleteUploadedFiles(existingImageUrls.filter((url) => !nextImageUrls.includes(url)));
  res.json(await listFor("product_reviews", "product_id", rows[0].product_id));
}

export async function deleteProductReview(req, res) {
  const { rows } = await query(
    "DELETE FROM product_reviews WHERE id = $1 AND user_id = $2 RETURNING product_id, image_urls",
    [req.params.reviewId, req.user.id]
  );
  if (!rows[0]) throw notFound("Review not found or not owned by user");
  await deleteUploadedFiles(rows[0].image_urls);
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
  emitDashboardUpdated("vendor-reviews");
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
  const returning = req.params.type === "product" ? " RETURNING image_urls" : "";
  const result = await query(`DELETE FROM ${table} WHERE id = $1${returning}`, [req.params.id]);
  if (!result.rowCount) throw notFound("Review not found");
  if (req.params.type === "product") await deleteUploadedFiles(result.rows[0].image_urls);
  res.status(204).send();
}
