import { query } from "../config/db.js";
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
                 users.brand_name AS vendor_brand_name, users.brand_description AS vendor_brand_description ${extra}
          FROM products
          LEFT JOIN users ON users.id = products.vendor_id`;
}

function vendorBrand(user) {
  return user.brandName || user.name || "VASTRA Vendor";
}

function firstProductImage(product) {
  const media = Array.isArray(product.product_images) ? product.product_images : [];
  return media.find((item) => item?.url && (!item.type || item.type === "image"))?.url || "";
}

function minEffectivePrice(product) {
  const base = Number(product.price);
  const sizePrices = product.size_prices || {};
  const prices = Object.values(sizePrices).map(Number).filter((value) => Number.isFinite(value) && value >= 0);
  prices.push(base);
  return Math.min(...prices);
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
  const { rows } = await query(`${productSelect()} WHERE products.vendor_id = $1 ORDER BY products.created_at DESC`, [
    vendorId
  ]);
  res.json({ products: rows.map(serializeProduct) });
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

  const { rows } = await query("UPDATE products SET status = $1, rejection_reason = $3 WHERE id = $2 RETURNING *", [
    req.params.status,
    req.params.id,
    req.params.status === "rejected" ? req.body.reason : null
  ]);
  if (!rows[0]) throw notFound("Product not found");

  const product = rows[0];
  if (product.vendor_id) {
    if (req.params.status === "approved") {
      await sendSystemMessageToUser({
        userId: product.vendor_id,
        senderId: req.user.id,
        subject: `Product approved: ${product.name}`,
        body: `Good news. Your product "${product.name}" has been approved and is now visible in the VASTRA shop.\n\nStatus: Approved\n\nThank you for keeping the marketplace fresh and polished.`,
        imageUrl: firstProductImage(product)
      });
    }

    if (req.params.status === "rejected") {
      await sendSystemMessageToUser({
        userId: product.vendor_id,
        senderId: req.user.id,
        subject: `Product needs revision: ${product.name}`,
        body: `Your product "${product.name}" was not approved.\n\nProduct ID: ${product.id}\nReason:\n${req.body.reason}\n\nPlease review the feedback before creating a revised listing.`,
        imageUrl: firstProductImage(product)
      });
    }
  }

  await updateStockAlertState(product);

  emitProductUpdated(product);
  await emitCartStockInvalidated(product);

  res.json({ product: serializeProduct(rows[0]) });
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
