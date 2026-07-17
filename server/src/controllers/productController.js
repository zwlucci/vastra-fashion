import { query, withTransaction } from "../config/db.js";
import { sendSystemMessageToUser } from "./messageController.js";
import { saveProductMedia } from "../utils/imageUpload.js";
import { AppError, notFound } from "../utils/errors.js";
import { serializeProduct } from "../utils/serializers.js";
import { emitCartStockInvalidated, emitProductUpdated } from "../socket.js";
import { createOrderNotifications } from "../utils/orderNotifications.js";
import { formatCurrency } from "../../../shared/currency.mjs";

function parseList(value) {
  if (!value) return null;
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function productSelect(extra = "") {
  return `SELECT products.*, users.name AS vendor_name, users.profile_image_url AS vendor_profile_image_url,
                 users.brand_name AS vendor_brand_name, users.brand_description AS vendor_brand_description,
                 COALESCE((
                   SELECT jsonb_agg(jsonb_build_object(
                     'id', components.id,
                     'componentProductId', components.id,
                     'name', components.name,
                     'componentProductName', components.name,
                     'price', components.price,
                     'category', components.category,
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
                     'vendorId', components.vendor_id,
                     'productType', components.product_type,
                     'sortOrder', product_bundle_items.position
                   ) ORDER BY product_bundle_items.position)
                   FROM product_bundle_items
                   JOIN products AS components ON components.id = product_bundle_items.component_product_id
                   WHERE product_bundle_items.bundle_product_id = products.id
                 ), '[]'::jsonb) AS bundle_components ${extra}
          FROM products
          LEFT JOIN users ON users.id = products.vendor_id`;
}

function vendorBrand(user) {
  return user.brandName || user.name || "VASTRA Vendor";
}

function firstProductImage(product) {
  const media = Array.isArray(product.product_images) ? product.product_images : [];
  return media.find((item) => item?.url && (!item.type || item.type === "image"))?.url || product.custom_bundle_image_url || product.image_url || "";
}

function minEffectivePrice(product) {
  const base = Number(product.price);
  const sizePrices = product.size_prices || {};
  const prices = Object.values(sizePrices).map(Number).filter((value) => Number.isFinite(value) && value >= 0);
  prices.push(base);
  return Math.min(...prices);
}

function componentPrimaryImage(product) {
  const media = Array.isArray(product.product_images) ? product.product_images : [];
  return media.find((item) => item?.url && (!item.type || item.type === "image"))?.url || product.image_url || "";
}

function roundCurrency(value) {
  return Math.round(Number(value) * 100) / 100;
}

function sharedValues(products, field) {
  const [first, ...rest] = products;
  const shared = new Set(first?.[field] || []);
  rest.forEach((product) => {
    const current = new Set(product[field] || []);
    [...shared].forEach((value) => {
      if (!current.has(value)) shared.delete(value);
    });
  });
  return [...shared];
}

async function getBundleComponentProducts(client, ids, vendorId) {
  const { rows } = await client.query(
    `SELECT id, vendor_id, name, description, price, category, gender, brand, sizes, size_prices,
            colors, color_stock_status, stock, image_url, product_images, status, product_type
     FROM products
     WHERE id = ANY($1::uuid[])
     ORDER BY array_position($1::uuid[], id)`,
    [ids]
  );

  if (rows.length !== ids.length) throw new AppError("Every bundled product must still exist.", 400);
  const invalid = rows.find((product) => product.vendor_id !== vendorId || product.status !== "approved" || product.product_type !== "normal");
  if (invalid) {
    throw new AppError("Bundles can only include your own approved normal products.", 400);
  }
  return rows;
}

function assertBundleConfiguration({ components, sizes, stock, discountPercentage }) {
  if (components.length < 2 || components.length > 4) {
    throw new AppError("Bundles must include between two and four products.", 400);
  }

  const sharedSizes = sharedValues(components, "sizes");
  const invalidSize = sizes.find((size) => !sharedSizes.includes(size));
  if (invalidSize) {
    throw new AppError("Selected bundle sizes must be shared by every included product.", 400);
  }

  const maxStock = Math.min(...components.map((product) => Number(product.stock || 0)));
  if (stock > maxStock) {
    throw new AppError(`Bundle stock cannot exceed the current component stock limit of ${maxStock}.`, 400);
  }

  const originalPrice = roundCurrency(components.reduce((sum, product) => sum + minEffectivePrice(product), 0));
  const finalPrice = roundCurrency(originalPrice * (1 - Number(discountPercentage) / 100));
  if (!Number.isFinite(finalPrice) || finalPrice < 0 || finalPrice > originalPrice) {
    throw new AppError("Bundle discount and calculated prices are invalid.", 400);
  }

  return { originalPrice, finalPrice, maxStock, sharedSizes };
}

function hasCustomBundleMediaInput({ media = [], images = [], imageData }) {
  return Boolean(imageData || images.some((item) => item.imageData || item.url) || media.some((item) => item.mediaData || item.url));
}

async function buildCustomBundleMedia(payload, fallbackMedia = []) {
  if (!hasCustomBundleMediaInput(payload)) {
    return fallbackMedia.map((item) => ({ ...item, type: item.type || "image" }));
  }
  return buildProductMedia(payload);
}

function bundleFallbackImage(components) {
  return components.map(componentPrimaryImage).find(Boolean);
}

async function notifyWishlistPriceDrop(previous, current) {
  if (previous.status !== "approved" || current.status !== "approved") return;
  const previousPrice = minEffectivePrice(previous);
  const newPrice = minEffectivePrice(current);
  if (!(newPrice < previousPrice)) return;

  const event = await query(
    `INSERT INTO product_price_drop_events (product_id, previous_price, new_price)
     VALUES ($1, $2, $3)
     ON CONFLICT (product_id, previous_price, new_price) DO NOTHING
     RETURNING id`,
    [current.id, previousPrice, newPrice]
  );
  if (!event.rows[0]) return;

  const wishlists = await query("SELECT DISTINCT user_id FROM wishlist_items WHERE product_id = $1", [current.id]);
  const recipientIds = wishlists.rows.map((row) => row.user_id).filter((id) => id !== current.vendor_id);
  if (!recipientIds.length) return;

  await createOrderNotifications(recipientIds, {
    type: "price_drop",
    title: "Price drop",
    message: `Price drop: ${current.name} is now ${formatCurrency(newPrice)}, reduced from ${formatCurrency(previousPrice)}.`,
    metadata: {
      notificationType: "price_drop",
      productId: current.id,
      previousPrice,
      newPrice,
      timestamp: new Date().toISOString(),
      targetType: "product",
      targetId: current.id,
      targetUrl: `/shop/${current.id}`,
      imageUrl: current.image_url || ""
    }
  });
}

async function buildProductMedia({ media = [], images = [], imageData }, fallbackMedia = []) {
  const inputs = media.length ? media : images.map((image) => ({ ...image, mediaData: image.imageData, type: "image" }));
  const nextMedia = [];

  for (const item of inputs) {
    const color = item.color?.trim() || "";
    const type = item.type === "video" ? "video" : "image";
    const data = item.mediaData || item.imageData || "";
    const uploadedUrl = data ? await saveProductMedia(data, type) : null;
    const url = uploadedUrl || item.url || "";
    if (url) nextMedia.push({ color, url, type });
  }

  if (imageData) {
    const uploadedUrl = await saveProductMedia(imageData, "image");
    if (uploadedUrl) nextMedia.unshift({ color: "", url: uploadedUrl, type: "image" });
  }

  if (!nextMedia.length) {
    nextMedia.push(...fallbackMedia.map((item) => ({ ...item, type: item.type || "image" })));
  }

  return nextMedia;
}

function normalizedProductOptions({ sizes, sizePrices, colors, colorStockStatus }) {
  const uniqueSizes = [...new Set(sizes.map((size) => size.trim()).filter(Boolean))];
  const uniqueColors = [...new Set(colors.map((color) => color.trim()).filter(Boolean))];
  return {
    sizes: uniqueSizes,
    colors: uniqueColors,
    sizePrices: Object.fromEntries(uniqueSizes
      .filter((size) => sizePrices[size] !== undefined && sizePrices[size] !== "")
      .map((size) => [size, Number(sizePrices[size])])),
    colorStockStatus: Object.fromEntries(uniqueColors.map((color) => [color, Boolean(colorStockStatus[color])]))
  };
}

export async function listPublicProducts(req, res) {
  const filters = ["products.status = 'approved'"];
  const params = [];
  const addParam = (value) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (req.query.search) {
    const key = addParam(`%${req.query.search}%`);
    filters.push(`(products.name ILIKE ${key} OR products.description ILIKE ${key} OR products.brand ILIKE ${key} OR users.name ILIKE ${key} OR users.brand_name ILIKE ${key})`);
  }
  if (req.query.category) filters.push(`products.category = ${addParam(req.query.category)}`);
  if (req.query.gender) filters.push(`products.gender = ${addParam(req.query.gender)}`);
  if (req.query.brand) filters.push(`products.brand ILIKE ${addParam(`%${req.query.brand}%`)}`);
  if (req.query.minPrice) filters.push(`products.price >= ${addParam(req.query.minPrice)}`);
  if (req.query.maxPrice) filters.push(`products.price <= ${addParam(req.query.maxPrice)}`);
  if (req.query.purchased === "true") {
    filters.push(`EXISTS (
      SELECT 1 FROM order_items
      JOIN orders ON orders.id = order_items.order_id
      WHERE order_items.product_id = products.id AND orders.status <> 'cancelled'
    )`);
  }

  const sizes = parseList(req.query.size);
  if (sizes?.length) filters.push(`products.sizes && ${addParam(sizes)}::text[]`);

  const sortMap = {
    newest: "products.created_at DESC",
    oldest: "products.created_at ASC",
    price_asc: "products.price ASC",
    price_desc: "products.price DESC",
    popular: `COALESCE((
      SELECT SUM(order_items.quantity)
      FROM order_items
      JOIN orders ON orders.id = order_items.order_id
      WHERE order_items.product_id = products.id AND orders.status <> 'cancelled'
    ), 0) DESC, products.created_at DESC`
  };
  const orderBy = sortMap[req.query.sort] || sortMap.newest;

  const { rows } = await query(
    `${productSelect()} WHERE ${filters.join(" AND ")} ORDER BY ${orderBy}`,
    params
  );

  res.json({ products: rows.map(serializeProduct) });
}

export async function listSearchSuggestions(req, res) {
  const term = String(req.query.q || "").trim();
  if (!term) return res.json({ suggestions: [] });
  const like = `%${term}%`;
  const [products, categories] = await Promise.all([
    query(
      `SELECT id, name, brand, image_url
       FROM products
       WHERE status = 'approved'
         AND (name ILIKE $1 OR brand ILIKE $1 OR description ILIKE $1)
       ORDER BY
         CASE WHEN name ILIKE $2 THEN 0 ELSE 1 END,
         name ASC
       LIMIT 7`,
      [like, `${term}%`]
    ),
    query(
      `SELECT category
       FROM products
       WHERE status = 'approved' AND category ILIKE $1
       GROUP BY category
       ORDER BY category ASC
       LIMIT 7`,
      [like]
    )
  ]);
  const productSuggestions = products.rows.map((product) => ({
    type: "product",
    id: product.id,
    label: product.name,
    subtitle: product.brand,
    imageUrl: product.image_url,
    url: `/shop/${product.id}`
  }));
  const categorySuggestions = categories.rows.map((category) => ({
    type: "category",
    id: category.category,
    label: category.category,
    subtitle: "Category",
    url: `/shop?category=${encodeURIComponent(category.category)}`
  }));
  res.json({ suggestions: [...productSuggestions, ...categorySuggestions].slice(0, 7) });
}

export async function getPublicProduct(req, res) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.id)) {
    throw notFound("Product not found");
  }
  const { rows } = await query(`${productSelect()} WHERE products.id = $1 AND products.status = 'approved'`, [
    req.params.id
  ]);
  if (!rows[0]) throw notFound("Product not found");
  res.json({ product: serializeProduct(rows[0]) });
}

export async function createProduct(req, res) {
  const status = req.user.role === "admin" ? "approved" : "pending";
  const vendorId = req.user.id;
  const { name, description, price, category, gender, stock, media, images, imageData } = req.body;
  const options = normalizedProductOptions(req.body);
  const productMedia = await buildProductMedia({ media, images, imageData });
  const mainImageUrl = productMedia[0]?.url;

  if (!mainImageUrl) {
    throw new AppError("At least one product image or video is required", 400);
  }

  const { rows } = await query(
    `INSERT INTO products (vendor_id, name, description, price, category, gender, brand, sizes, size_prices, colors, color_stock_status, stock, image_url, product_images, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     RETURNING *`,
    [vendorId, name, description, price, category, gender, vendorBrand(req.user), options.sizes, JSON.stringify(options.sizePrices), options.colors, JSON.stringify(options.colorStockStatus), stock, mainImageUrl, JSON.stringify(productMedia), status]
  );

  emitProductUpdated(rows[0]);

  res.status(201).json({ product: serializeProduct(rows[0]) });
}

export async function createBundle(req, res) {
  const vendorId = req.user.id;
  const { name, description, componentProductIds, discountPercentage, stock, sizes, media, images, imageData } = req.body;

  const product = await withTransaction(async (client) => {
    const components = await getBundleComponentProducts(client, componentProductIds, vendorId);
    const bundle = assertBundleConfiguration({ components, sizes, stock, discountPercentage });
    const productMedia = await buildCustomBundleMedia({ media, images, imageData });
    const customBundleImageUrl = productMedia.find((item) => item.url && (!item.type || item.type === "image"))?.url || null;
    const mainImageUrl = customBundleImageUrl || bundleFallbackImage(components);
    if (!mainImageUrl) throw new AppError("At least one bundle image or component image is required", 400);
    const gender = components.every((component) => component.gender === components[0].gender) ? components[0].gender : "Unisex";
    const category = components.every((component) => component.category === components[0].category) ? components[0].category : "Clothing";

    const inserted = await client.query(
      `INSERT INTO products
         (vendor_id, name, description, price, category, gender, brand, sizes, size_prices, colors,
          color_stock_status, stock, image_url, product_images, status, product_type, bundle_original_price,
          bundle_discount_percentage, custom_bundle_image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '{}'::jsonb, '{}'::text[], '{}'::jsonb, $9, $10, $11, 'pending', 'bundle', $12, $13, $14)
       RETURNING *`,
      [
        vendorId,
        name,
        description,
        bundle.finalPrice,
        category,
        gender,
        vendorBrand(req.user),
        sizes,
        stock,
        mainImageUrl,
        JSON.stringify(productMedia),
        bundle.originalPrice,
        discountPercentage,
        customBundleImageUrl
      ]
    );

    for (const [index, componentId] of componentProductIds.entries()) {
      await client.query(
        `INSERT INTO product_bundle_items (bundle_product_id, component_product_id, position)
         VALUES ($1, $2, $3)`,
        [inserted.rows[0].id, componentId, index]
      );
    }

    return inserted.rows[0];
  });

  emitProductUpdated(product);
  res.status(201).json({ product: serializeProduct(product) });
}

export async function updateProduct(req, res) {
  const { name, description, price, category, gender, stock, media, images, imageData } = req.body;
  const options = normalizedProductOptions(req.body);
  const existing = req.user.role === "admin"
    ? await query("SELECT image_url, product_images, brand, status, price, size_prices, vendor_id FROM products WHERE id = $1", [req.params.id])
    : await query("SELECT image_url, product_images, brand, status, price, size_prices, vendor_id FROM products WHERE id = $1 AND vendor_id = $2", [req.params.id, req.user.id]);
  if (!existing.rows[0]) throw notFound("Product not found or not owned by vendor");
  if (req.user.role === "vendor" && existing.rows[0].status === "rejected") {
    throw new AppError("Rejected products cannot be edited", 403);
  }

  const productMedia = await buildProductMedia({ media, images, imageData }, existing.rows[0].product_images || []);
  const mainImageUrl = productMedia[0]?.url || existing.rows[0].image_url;
  const brand = req.user.role === "admin" ? existing.rows[0].brand : vendorBrand(req.user);
  const params = [req.params.id, name, description, price, category, gender, brand, options.sizes, JSON.stringify(options.sizePrices), options.colors, JSON.stringify(options.colorStockStatus), stock, mainImageUrl, JSON.stringify(productMedia)];
  let sql = `UPDATE products
             SET name = $2, description = $3, price = $4, category = $5, gender = $6, brand = $7,
                 sizes = $8, size_prices = $9, colors = $10, color_stock_status = $11,
                 stock = $12, image_url = $13, product_images = $14`;

  if (req.user.role === "vendor") {
    params.push(req.user.id);
    sql += ` WHERE id = $1 AND vendor_id = $15 RETURNING *`;
  } else {
    sql += ` WHERE id = $1 RETURNING *`;
  }

  const { rows } = await query(sql, params);
  if (!rows[0]) throw notFound("Product not found or not owned by vendor");
  try {
    await notifyWishlistPriceDrop(existing.rows[0], rows[0]);
  } catch (error) {
    console.error(`[VASTRA wishlist price drop] ${error.message}`);
  }
  await updateStockAlertState(rows[0]);
  emitProductUpdated(rows[0]);
  await emitCartStockInvalidated(rows[0]);
  res.json({ product: serializeProduct(rows[0]) });
}

export async function updateBundle(req, res) {
  const vendorId = req.user.id;
  const { name, description, componentProductIds, discountPercentage, stock, sizes, media, images, imageData } = req.body;

  const product = await withTransaction(async (client) => {
    const existing = await client.query(
      `SELECT id, vendor_id, status, product_images, image_url, name, description, sizes, stock,
              bundle_discount_percentage, custom_bundle_image_url
       FROM products
       WHERE id = $1 AND vendor_id = $2 AND product_type = 'bundle'
       FOR UPDATE`,
      [req.params.id, vendorId]
    );
    if (!existing.rows[0]) throw notFound("Bundle not found or not owned by vendor");
    if (existing.rows[0].status === "rejected") {
      throw new AppError("Rejected bundles cannot be edited", 403);
    }

    const previousItems = await client.query(
      "SELECT component_product_id FROM product_bundle_items WHERE bundle_product_id = $1 ORDER BY position",
      [req.params.id]
    );
    const previousComponentIds = previousItems.rows.map((row) => row.component_product_id);
    const components = await getBundleComponentProducts(client, componentProductIds, vendorId);
    const bundle = assertBundleConfiguration({ components, sizes, stock, discountPercentage });
    const existingCustomMedia = existing.rows[0].custom_bundle_image_url ? existing.rows[0].product_images || [] : [];
    const productMedia = await buildCustomBundleMedia({ media, images, imageData }, existingCustomMedia);
    const customBundleImageUrl = productMedia.find((item) => item.url && (!item.type || item.type === "image"))?.url || null;
    const mainImageUrl = customBundleImageUrl || bundleFallbackImage(components);
    if (!mainImageUrl) throw new AppError("At least one bundle image or component image is required", 400);
    const gender = components.every((component) => component.gender === components[0].gender) ? components[0].gender : "Unisex";
    const category = components.every((component) => component.category === components[0].category) ? components[0].category : "Clothing";
    const customMediaChanged = Boolean(imageData || images?.some((item) => item.imageData) || media?.some((item) => item.mediaData));
    const sensitiveChanged = existing.rows[0].name !== name
      || existing.rows[0].description !== description
      || Number(existing.rows[0].bundle_discount_percentage) !== Number(discountPercentage)
      || JSON.stringify(existing.rows[0].sizes || []) !== JSON.stringify(sizes)
      || JSON.stringify(previousComponentIds) !== JSON.stringify(componentProductIds)
      || customMediaChanged;
    const nextStatus = sensitiveChanged ? "pending" : existing.rows[0].status;

    const updated = await client.query(
      `UPDATE products
       SET name = $2, description = $3, price = $4, category = $5, gender = $6, brand = $7,
           sizes = $8, stock = $9, image_url = $10, product_images = $11,
           status = $12, rejection_reason = CASE WHEN $12 = 'pending' THEN NULL ELSE rejection_reason END,
           bundle_original_price = $13, bundle_discount_percentage = $14, custom_bundle_image_url = $16
       WHERE id = $1 AND vendor_id = $15 AND product_type = 'bundle'
       RETURNING *`,
      [
        req.params.id,
        name,
        description,
        bundle.finalPrice,
        category,
        gender,
        vendorBrand(req.user),
        sizes,
        stock,
        mainImageUrl,
        JSON.stringify(productMedia),
        nextStatus,
        bundle.originalPrice,
        discountPercentage,
        vendorId,
        customBundleImageUrl
      ]
    );

    await client.query("DELETE FROM product_bundle_items WHERE bundle_product_id = $1", [req.params.id]);
    for (const [index, componentId] of componentProductIds.entries()) {
      await client.query(
        `INSERT INTO product_bundle_items (bundle_product_id, component_product_id, position)
         VALUES ($1, $2, $3)`,
        [req.params.id, componentId, index]
      );
    }
    return updated.rows[0];
  });

  await updateStockAlertState(product);
  emitProductUpdated(product);
  await emitCartStockInvalidated(product);
  res.json({ product: serializeProduct(product) });
}

export async function deleteProduct(req, res) {
  const params = [req.params.id];
  let sql = "DELETE FROM products WHERE id = $1";
  if (req.user.role === "vendor") {
    params.push(req.user.id);
    sql += " AND vendor_id = $2";
  }
  sql += " RETURNING id";

  const { rows } = await query(sql, params);
  if (!rows[0]) throw notFound("Product not found or not owned by vendor");
  res.status(204).send();
}

export async function listVendorProducts(req, res) {
  const vendorId = req.user.role === "admin" && req.query.vendorId ? req.query.vendorId : req.user.id;
  if (req.user.role === "vendor" && vendorId !== req.user.id) {
    throw new AppError("Vendors can only view their own products", 403);
  }
  const { rows } = await query(`${productSelect()} WHERE products.vendor_id = $1 AND products.product_type = 'normal' ORDER BY products.created_at DESC`, [
    vendorId
  ]);
  res.json({ products: rows.map(serializeProduct) });
}

export async function listVendorBundles(req, res) {
  const vendorId = req.user.role === "admin" && req.query.vendorId ? req.query.vendorId : req.user.id;
  if (req.user.role === "vendor" && vendorId !== req.user.id) {
    throw new AppError("Vendors can only view their own bundles", 403);
  }

  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(25, Math.max(1, Number(req.query.limit || 10)));
  const offset = (page - 1) * limit;
  const params = [vendorId];
  const filters = ["products.vendor_id = $1", "products.product_type = 'bundle'"];
  if (req.query.status && ["pending", "approved", "rejected"].includes(req.query.status)) {
    params.push(req.query.status);
    filters.push(`products.status = $${params.length}`);
  }
  if (req.query.search) {
    params.push(`%${req.query.search}%`);
    filters.push(`(products.name ILIKE $${params.length} OR products.description ILIKE $${params.length})`);
  }
  const where = filters.join(" AND ");
  const count = await query(`SELECT COUNT(*)::int AS total FROM products WHERE ${where}`, params);
  params.push(limit, offset);
  const { rows } = await query(
    `${productSelect()} WHERE ${where} ORDER BY products.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  const indicators = await query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
       COUNT(*) FILTER (WHERE status = 'approved')::int AS approved,
       COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected,
       COUNT(*) FILTER (WHERE status = 'approved' AND stock = 1)::int AS low_stock,
       COUNT(*) FILTER (WHERE status <> 'approved' OR stock = 0)::int AS unavailable
     FROM products
     WHERE vendor_id = $1 AND product_type = 'bundle'`,
    [vendorId]
  );
  res.json({
    products: rows.map(serializeProduct),
    indicators: indicators.rows[0],
    meta: { page, limit, total: count.rows[0].total, totalPages: Math.max(1, Math.ceil(count.rows[0].total / limit)) }
  });
}

export async function getVendorProfile(req, res) {
  const { rows } = await query(
    `SELECT id, name, email, role, brand_name, brand_description, profile_image_url, created_at
     FROM users
     WHERE id = $1 AND role = 'vendor'`,
    [req.params.id]
  );
  if (!rows[0]) throw notFound("Vendor not found");
  res.json({
    vendor: {
      id: rows[0].id,
      name: rows[0].name,
      email: rows[0].email,
      role: rows[0].role,
      brandName: rows[0].brand_name,
      brandDescription: rows[0].brand_description,
      profileImageUrl: rows[0].profile_image_url,
      createdAt: rows[0].created_at
    }
  });
}

export async function listVendorProfiles(req, res) {
  const params = [];
  let where = "WHERE role = 'vendor'";
  if (req.query.search) {
    params.push(`%${req.query.search}%`);
    where += " AND (name ILIKE $1 OR brand_name ILIKE $1 OR brand_description ILIKE $1)";
  }
  const { rows } = await query(
    `SELECT id, name, email, role, brand_name, brand_description, profile_image_url, created_at
     FROM users ${where}
     ORDER BY created_at DESC
     LIMIT 8`,
    params
  );
  res.json({
    vendors: rows.map((vendor) => ({
      id: vendor.id,
      name: vendor.name,
      email: vendor.email,
      role: vendor.role,
      brandName: vendor.brand_name,
      brandDescription: vendor.brand_description,
      profileImageUrl: vendor.profile_image_url,
      createdAt: vendor.created_at
    }))
  });
}

export async function listVendorProfileProducts(req, res) {
  const sortMap = {
    newest: "products.created_at DESC",
    oldest: "products.created_at ASC",
    price_asc: "products.price ASC",
    price_desc: "products.price DESC",
    stock: "products.stock DESC, products.created_at DESC"
  };
  const orderBy = sortMap[req.query.sort] || sortMap.newest;
  const { rows } = await query(
    `${productSelect()} WHERE products.vendor_id = $1 AND products.status = 'approved' ORDER BY ${orderBy}`,
    [req.params.id]
  );
  res.json({ products: rows.map(serializeProduct) });
}

export async function listAdminProducts(req, res) {
  const { rows } = await query(`${productSelect()} ORDER BY products.created_at DESC`);
  res.json({ products: rows.map(serializeProduct) });
}

export async function setProductStatus(req, res) {
  if (req.params.status === "rejected" && !req.body.reason) {
    throw new AppError("A rejection reason is required", 400);
  }

  const product = await withTransaction(async (client) => {
    const existing = await client.query("SELECT * FROM products WHERE id = $1 FOR UPDATE", [req.params.id]);
    if (!existing.rows[0]) throw notFound("Product not found");

    let recalculated = null;
    if (req.params.status === "approved" && existing.rows[0].product_type === "bundle") {
      const bundleItems = await client.query(
        "SELECT component_product_id FROM product_bundle_items WHERE bundle_product_id = $1 ORDER BY position",
        [req.params.id]
      );
      const componentIds = bundleItems.rows.map((row) => row.component_product_id);
      const components = await getBundleComponentProducts(client, componentIds, existing.rows[0].vendor_id);
      recalculated = assertBundleConfiguration({
        components,
        sizes: existing.rows[0].sizes || [],
        stock: existing.rows[0].stock,
        discountPercentage: existing.rows[0].bundle_discount_percentage
      });
    }

    const { rows } = await client.query(
      `UPDATE products
       SET status = $1,
           rejection_reason = $3,
           price = COALESCE($4::numeric, price),
           bundle_original_price = COALESCE($5::numeric, bundle_original_price)
       WHERE id = $2
       RETURNING *`,
      [
        req.params.status,
        req.params.id,
        req.params.status === "rejected" ? req.body.reason : null,
        recalculated?.finalPrice ?? null,
        recalculated?.originalPrice ?? null
      ]
    );
    return rows[0];
  });

  if (product.vendor_id) {
    const subjectNoun = product.product_type === "bundle" ? "Bundled product" : "Product";
    const bodyNoun = product.product_type === "bundle" ? "bundled product" : "product";
    if (req.params.status === "approved") {
      await sendSystemMessageToUser({
        userId: product.vendor_id,
        senderId: req.user.id,
        subject: `${subjectNoun} approved: ${product.name}`,
        body: `Good news. Your ${bodyNoun} "${product.name}" has been approved and is now visible in the VASTRA shop.\n\nStatus: Approved\n\nThank you for keeping the marketplace fresh and polished.`,
        imageUrl: firstProductImage(product)
      });
    }

    if (req.params.status === "rejected") {
      await sendSystemMessageToUser({
        userId: product.vendor_id,
        senderId: req.user.id,
        subject: `${subjectNoun} needs revision: ${product.name}`,
        body: `Your ${bodyNoun} "${product.name}" was not approved.\n\nProduct ID: ${product.id}\nReason:\n${req.body.reason}\n\nPlease review the feedback before creating a revised listing.`,
        imageUrl: firstProductImage(product)
      });
    }
  }

  await updateStockAlertState(product);

  emitProductUpdated(product);
  await emitCartStockInvalidated(product);

  res.json({ product: serializeProduct(product) });
}

export async function updateStockAlertState(product) {
  const { rows } = await query("SELECT * FROM products WHERE id = $1", [product.id]);
  const current = rows[0];
  if (!current?.vendor_id) return;

  if (current.status !== "approved") {
    if (current.low_stock_alert_sent || current.out_of_stock_alert_sent) {
      await query("UPDATE products SET low_stock_alert_sent = false, out_of_stock_alert_sent = false WHERE id = $1", [current.id]);
    }
    return;
  }

  if (current.stock > 1 && (current.low_stock_alert_sent || current.out_of_stock_alert_sent)) {
    await query("UPDATE products SET low_stock_alert_sent = false, out_of_stock_alert_sent = false WHERE id = $1", [current.id]);
    return;
  }

  if (current.stock === 1 && !current.low_stock_alert_sent) {
    await sendSystemMessageToUser({
      userId: current.vendor_id,
      subject: `Low stock warning: ${current.name}`,
      body: `Your product "${current.name}" is almost out of stock.\n\nCurrent stock: 1\nProduct ID: ${current.id}\n\nConsider updating inventory soon.`,
      imageUrl: firstProductImage(current)
    });
    await query("UPDATE products SET low_stock_alert_sent = true, out_of_stock_alert_sent = false WHERE id = $1", [current.id]);
  }

  if (current.stock === 0 && !current.out_of_stock_alert_sent) {
    await sendSystemMessageToUser({
      userId: current.vendor_id,
      subject: `Out of stock: ${current.name}`,
      body: `Your product "${current.name}" is now out of stock.\n\nCurrent stock: 0\nProduct ID: ${current.id}\n\nUpdate inventory before more customers try to purchase it.`,
      imageUrl: firstProductImage(current)
    });
    await query("UPDATE products SET low_stock_alert_sent = true, out_of_stock_alert_sent = true WHERE id = $1", [current.id]);
  }
}
