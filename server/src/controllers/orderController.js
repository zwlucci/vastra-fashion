import { query, withTransaction } from "../config/db.js";
import { AppError, notFound } from "../utils/errors.js";
import { sendOrderStatusEmail } from "../utils/mailer.js";
import { emitCartStockInvalidated, emitOrderUpdated, emitProductUpdated } from "../socket.js";
import { sendOrderStatusMessage } from "./messageController.js";
import { updateStockAlertState } from "./productController.js";

function mapOrderRows(rows) {
  const orders = new Map();
  rows.forEach((row) => {
    if (!orders.has(row.id)) {
      orders.set(row.id, {
        id: row.id,
        userId: row.user_id,
        customerName: row.customer_name,
        customerEmail: row.customer_email,
        totalAmount: Number(row.total_amount),
        status: row.status,
        createdAt: row.created_at,
        items: []
      });
    }
    if (row.item_id) {
      orders.get(row.id).items.push({
        id: row.item_id,
        productId: row.product_id,
        vendorId: row.product_vendor_id,
        name: row.product_name,
        brand: row.product_brand,
        imageUrl: row.product_image_url,
        selectedSize: row.selected_size || "",
        selectedColor: row.selected_color || "",
        quantity: row.quantity,
        priceAtPurchase: Number(row.price_at_purchase)
      });
    }
  });
  return [...orders.values()];
}

async function getOrdersFor(where, params) {
  const { rows } = await query(
    `SELECT orders.*, users.name AS customer_name, users.email AS customer_email,
            order_items.id AS item_id, order_items.product_id, order_items.quantity,
            order_items.selected_size, order_items.selected_color, order_items.price_at_purchase, products.name AS product_name,
            products.vendor_id AS product_vendor_id, products.brand AS product_brand,
            products.image_url AS product_image_url
     FROM orders
     JOIN users ON users.id = orders.user_id
     LEFT JOIN order_items ON order_items.order_id = orders.id
     LEFT JOIN products ON products.id = order_items.product_id
     ${where}
     ORDER BY orders.created_at DESC`,
    params
  );
  return mapOrderRows(rows);
}

export async function createOrder(req, res) {
  const order = await withTransaction(async (client) => {
    const cart = await client.query(
      `SELECT cart_items.product_id, cart_items.quantity, cart_items.selected_size, cart_items.selected_color,
              products.price, products.sizes, products.size_prices, products.colors, products.color_stock_status,
              products.stock, products.name
       FROM cart_items
       JOIN products ON products.id = cart_items.product_id
       WHERE cart_items.user_id = $1 AND products.status = 'approved'
       ORDER BY cart_items.created_at
       FOR UPDATE OF products`,
      [req.user.id]
    );

    if (!cart.rows.length) throw new AppError("Cart is empty", 400);

    const totalsByProduct = new Map();
    for (const item of cart.rows) {
      if ((item.sizes || []).length && !(item.sizes || []).includes(item.selected_size)) {
        throw new AppError(`The selected size for ${item.name} is no longer available.`, 400);
      }
      if ((item.colors || []).length && !(item.colors || []).includes(item.selected_color)) {
        throw new AppError(`The selected color for ${item.name} is no longer available.`, 400);
      }
      if (item.selected_color && item.color_stock_status?.[item.selected_color]) {
        throw new AppError(`${item.selected_color} for ${item.name} is currently out of stock.`, 400);
      }
      item.effectivePrice = item.selected_size && item.size_prices?.[item.selected_size] !== undefined
        ? Number(item.size_prices[item.selected_size])
        : Number(item.price);
      const totalQuantity = (totalsByProduct.get(item.product_id) || 0) + item.quantity;
      totalsByProduct.set(item.product_id, totalQuantity);
      if (totalQuantity > item.stock) {
        throw new AppError(`Only ${item.stock} items of ${item.name} are available in stock.`, 400);
      }
    }

    const total = cart.rows.reduce((sum, item) => sum + item.effectivePrice * item.quantity, 0);
    const created = await client.query(
      "INSERT INTO orders (user_id, total_amount, status) VALUES ($1, $2, 'pending') RETURNING *",
      [req.user.id, total]
    );

    for (const item of cart.rows) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, selected_size, selected_color, quantity, price_at_purchase)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [created.rows[0].id, item.product_id, item.selected_size || "", item.selected_color || "", item.quantity, item.effectivePrice]
      );
      await client.query("UPDATE products SET stock = stock - $1 WHERE id = $2", [item.quantity, item.product_id]);
    }

    const updatedProducts = await client.query(
      "SELECT * FROM products WHERE id = ANY($1::uuid[])",
      [[...totalsByProduct.keys()]]
    );

    await client.query("DELETE FROM cart_items WHERE user_id = $1", [req.user.id]);
    return { order: created.rows[0], products: updatedProducts.rows };
  });

  await Promise.all(order.products.map((product) => updateStockAlertState(product)));
  await Promise.all(order.products.map(async (product) => {
    emitProductUpdated(product);
    await emitCartStockInvalidated(product);
  }));

  const vendorResult = await query(
    `SELECT DISTINCT products.vendor_id FROM order_items
     JOIN products ON products.id = order_items.product_id
     WHERE order_items.order_id = $1`,
    [order.order.id]
  );
  emitOrderUpdated(order.order, vendorResult.rows.map((row) => row.vendor_id));

  res.status(201).json({ order: order.order });
}

export async function listOrders(req, res) {
  const orders =
    req.user.role === "admin"
      ? await getOrdersFor("", [])
      : await getOrdersFor("WHERE orders.user_id = $1", [req.user.id]);
  res.json({ orders });
}

export async function listVendorOrders(req, res) {
  const { rows } = await query(
    `SELECT orders.*, users.name AS customer_name, users.email AS customer_email,
            order_items.id AS item_id, order_items.product_id, order_items.quantity,
            order_items.selected_size, order_items.selected_color, order_items.price_at_purchase, products.name AS product_name,
            products.vendor_id AS product_vendor_id, products.brand AS product_brand,
            products.image_url AS product_image_url
     FROM orders
     JOIN users ON users.id = orders.user_id
     JOIN order_items ON order_items.order_id = orders.id
     JOIN products ON products.id = order_items.product_id
     WHERE products.vendor_id = $1
     ORDER BY orders.created_at DESC`,
    [req.user.id]
  );
  res.json({ orders: mapOrderRows(rows) });
}

export async function getVendorIncomeSummary(req, res) {
  // Delivered is the final fulfilled status in the current order_status enum, so only delivered vendor line items count as income.
  const totals = await query(
    `SELECT
       COALESCE(SUM(order_items.quantity * order_items.price_at_purchase), 0)::numeric AS total_income,
       COUNT(DISTINCT orders.id)::int AS total_orders,
       COALESCE(SUM(order_items.quantity), 0)::int AS total_items
     FROM orders
     JOIN order_items ON order_items.order_id = orders.id
     JOIN products ON products.id = order_items.product_id
     WHERE products.vendor_id = $1 AND orders.status = 'delivered'`,
    [req.user.id]
  );

  const recent = await query(
    `SELECT orders.id, orders.created_at, users.name AS customer_name,
            SUM(order_items.quantity * order_items.price_at_purchase)::numeric AS amount
     FROM orders
     JOIN users ON users.id = orders.user_id
     JOIN order_items ON order_items.order_id = orders.id
     JOIN products ON products.id = order_items.product_id
     WHERE products.vendor_id = $1 AND orders.status = 'delivered'
     GROUP BY orders.id, orders.created_at, users.name
     ORDER BY orders.created_at DESC
     LIMIT 5`,
    [req.user.id]
  );

  res.json({
    income: {
      totalIncome: Number(totals.rows[0].total_income),
      totalOrders: totals.rows[0].total_orders,
      totalItems: totals.rows[0].total_items,
      recentOrders: recent.rows.map((row) => ({
        id: row.id,
        createdAt: row.created_at,
        customerName: row.customer_name,
        amount: Number(row.amount)
      }))
    }
  });
}

export async function getOrder(req, res) {
  const where = req.user.role === "admin" ? "WHERE orders.id = $1" : "WHERE orders.id = $1 AND orders.user_id = $2";
  const params = req.user.role === "admin" ? [req.params.id] : [req.params.id, req.user.id];
  const orders = await getOrdersFor(where, params);
  if (!orders[0]) throw notFound("Order not found");
  res.json({ order: orders[0] });
}

async function applyOrderStatusUpdate({ orderId, status, explanation, actor }) {
  const result = await withTransaction(async (client) => {
    const orderResult = await client.query(
      `SELECT orders.*, users.email AS customer_email
       FROM orders JOIN users ON users.id = orders.user_id
       WHERE orders.id = $1 FOR UPDATE OF orders`,
      [orderId]
    );
    const order = orderResult.rows[0];
    if (!order) throw notFound("Order not found");

    if (actor.role === "vendor") {
      const ownership = await client.query(
        `SELECT 1 FROM order_items
         JOIN products ON products.id = order_items.product_id
         WHERE order_items.order_id = $1 AND products.vendor_id = $2 LIMIT 1`,
        [orderId, actor.id]
      );
      if (!ownership.rows[0]) throw notFound("Order not found or not owned by vendor");
    }

    if (["delivered", "cancelled"].includes(order.status)) {
      throw new AppError(`This order is finalized as ${order.status} and cannot be updated.`, 409);
    }
    if (order.status === status) return { order, changed: false };

    const updated = await client.query("UPDATE orders SET status = $1 WHERE id = $2 RETURNING *", [status, orderId]);
    return { order: { ...updated.rows[0], customer_email: order.customer_email }, changed: true };
  });

  const vendors = await query(
    `SELECT DISTINCT products.vendor_id FROM order_items
     JOIN products ON products.id = order_items.product_id
     WHERE order_items.order_id = $1`,
    [orderId]
  );

  if (result.changed) {
    await sendOrderStatusMessage({
      orderId,
      userId: result.order.user_id,
      vendorId: actor.role === "vendor" ? actor.id : null,
      senderId: actor.id,
      senderRole: actor.role,
      status,
      explanation
    });

    try {
      await sendOrderStatusEmail(result.order.customer_email, { orderId, status, explanation });
    } catch (error) {
      console.error(`[VASTRA order status email] ${error.message}`);
    }
    emitOrderUpdated(result.order, vendors.rows.map((row) => row.vendor_id));
  }

  return result.order;
}

export async function updateOrderStatus(req, res) {
  const order = await applyOrderStatusUpdate({
    orderId: req.params.id,
    status: req.body.status,
    explanation: req.body.explanation,
    actor: req.user
  });
  res.json({ order });
}

export async function updateVendorOrderStatus(req, res) {
  const order = await applyOrderStatusUpdate({
    orderId: req.params.id,
    status: req.body.status,
    explanation: req.body.explanation,
    actor: req.user
  });
  res.json({ order });
}
