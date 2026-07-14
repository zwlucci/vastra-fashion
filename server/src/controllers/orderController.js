import { query, withTransaction } from "../config/db.js";
import { AppError, notFound } from "../utils/errors.js";
import { sendOrderConfirmationEmail, sendOrderReceiptEmail, sendOrderStatusEmail, sendReturnReceiptEmail } from "../utils/mailer.js";
import { emitCartStockInvalidated, emitOrderUpdated, emitProductUpdated } from "../socket.js";
import { updateStockAlertState } from "./productController.js";
import { calculateCouponDiscount, getActiveCoupon } from "../utils/coupons.js";
import { createOrderNotifications } from "../utils/orderNotifications.js";

function mapOrderRows(rows) {
  const orders = new Map();
  rows.forEach((row) => {
    if (!orders.has(row.id)) {
      orders.set(row.id, {
        id: row.id,
        userId: row.user_id,
        customerName: row.delivery_name || row.customer_name,
        customerEmail: row.customer_email,
        phoneNumber: row.delivery_phone || "",
        deliveryAddress: row.delivery_address || "",
        paymentMethod: row.payment_method,
        paymentStatus: row.payment_status,
        maskedCardNumber: row.card_last4 ? `**** **** **** ${row.card_last4}` : "",
        cardholderName: row.cardholder_name || "",
        cardExpiry: row.card_expiry || "",
        subtotalAmount: Number(row.subtotal_amount ?? row.total_amount),
        shippingFee: Number(row.shipping_fee || 0),
        discountAmount: Number(row.discount_amount || 0),
        couponCode: row.coupon_code || "",
        couponDiscountType: row.coupon_discount_type || "",
        couponDiscountValue: row.coupon_discount_value === null || row.coupon_discount_value === undefined ? null : Number(row.coupon_discount_value),
        totalAmount: Number(row.total_amount),
        status: row.status,
        deliveredAt: row.delivered_at || (row.status === "delivered" ? row.updated_at : null),
        returnRequestedAt: row.return_requested_at,
        returnStatus: row.return_status || "none",
        returnReason: row.return_reason || "",
        returnVendorReason: row.return_vendor_reason || "",
        returnVendorId: row.return_vendor_id || "",
        returnDecidedAt: row.return_decided_at,
        returnProcessedAt: row.return_processed_at,
        receiptSentAt: row.receipt_sent_at,
        returnReceiptSentAt: row.return_receipt_sent_at,
        createdAt: row.created_at,
        items: []
      });
    }
    if (row.item_id) {
      orders.get(row.id).items.push({
        id: row.item_id,
        productId: row.product_id,
        vendorId: row.product_vendor_id,
        vendorName: row.product_vendor_name || "",
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
            products.image_url AS product_image_url, vendor_users.name AS product_vendor_name
     FROM orders
     JOIN users ON users.id = orders.user_id
     LEFT JOIN order_items ON order_items.order_id = orders.id
     LEFT JOIN products ON products.id = order_items.product_id
     LEFT JOIN users AS vendor_users ON vendor_users.id = products.vendor_id
     ${where}
     ORDER BY orders.created_at DESC`,
    params
  );
  return mapOrderRows(rows);
}

async function sendFinalReceiptOnce(orderId, email, detailedOrder) {
  const claimed = await query(
    `UPDATE orders SET receipt_dispatch_started_at = NOW()
     WHERE id = $1 AND receipt_sent_at IS NULL
       AND (receipt_dispatch_started_at IS NULL OR receipt_dispatch_started_at < NOW() - INTERVAL '15 minutes')
     RETURNING receipt_dispatch_started_at`,
    [orderId]
  );
  if (!claimed.rows[0]) return;
  try {
    await sendOrderReceiptEmail(email, detailedOrder);
    await query("UPDATE orders SET receipt_sent_at = NOW(), receipt_dispatch_started_at = NULL WHERE id = $1", [orderId]);
  } catch (error) {
    await query("UPDATE orders SET receipt_dispatch_started_at = NULL WHERE id = $1", [orderId]);
    throw error;
  }
}

export async function createOrder(req, res) {
  const { paymentMethod, fullName, phoneNumber, deliveryAddress, card, couponCode, saveShippingInfo, saveCardDetails } = req.body;
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

    const subtotal = cart.rows.reduce((sum, item) => sum + item.effectivePrice * item.quantity, 0);
    const coupon = couponCode ? await getActiveCoupon(client, couponCode, { lock: true }) : null;
    const discountAmount = calculateCouponDiscount(subtotal, coupon);
    const shippingFee = 0;
    const total = Math.max(0, subtotal + shippingFee - discountAmount);
    const created = await client.query(
      `INSERT INTO orders
         (user_id, total_amount, status, payment_method, payment_status, delivery_name,
          delivery_phone, delivery_address, cardholder_name, card_last4, card_expiry,
          subtotal_amount, shipping_fee, discount_amount, coupon_id, coupon_code,
          coupon_discount_type, coupon_discount_value)
       VALUES ($1, $2, 'pending', $3, $4, $5, $6, $7, $8, $9, $10,
               $11, $12, $13, $14, $15, $16, $17)
       RETURNING *`,
      [
        req.user.id,
        total,
        paymentMethod,
        paymentMethod === "card" ? "paid" : "pending",
        fullName,
        phoneNumber,
        deliveryAddress,
        paymentMethod === "card" ? card.cardholderName : null,
        paymentMethod === "card" ? card.cardNumber.slice(-4) : null,
        paymentMethod === "card" ? card.expiryDate : null,
        subtotal,
        shippingFee,
        discountAmount,
        coupon?.id || null,
        coupon?.code || null,
        coupon?.discount_type || null,
        coupon ? Number(coupon.discount_value) : null
      ]
    );

    if (saveShippingInfo) {
      await client.query(
        "UPDATE users SET name = $1, phone_number = $2, shipping_address = $3 WHERE id = $4",
        [fullName, phoneNumber, deliveryAddress, req.user.id]
      );
    }
    if (paymentMethod === "card" && saveCardDetails) {
      await client.query(
        "UPDATE users SET saved_cardholder_name = $1, saved_card_last4 = $2, saved_card_expiry = $3 WHERE id = $4",
        [card.cardholderName, card.cardNumber.slice(-4), card.expiryDate, req.user.id]
      );
    }

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
  const detailedOrder = (await getOrdersFor("WHERE orders.id = $1", [order.order.id]))[0];
  emitOrderUpdated(detailedOrder, vendorResult.rows.map((row) => row.vendor_id));

  try {
    const adminResult = await query("SELECT id FROM users WHERE role = 'admin'");
    const vendorIds = vendorResult.rows.map((row) => row.vendor_id).filter(Boolean);
    await Promise.all([
      createOrderNotifications([detailedOrder.userId], {
        orderId: detailedOrder.id,
        type: "order_placed",
        title: "Order placed",
        message: `Order #${detailedOrder.id.slice(0, 8)} was placed successfully.`,
        metadata: { status: detailedOrder.status, paymentStatus: detailedOrder.paymentStatus }
      }),
      createOrderNotifications([...vendorIds, ...adminResult.rows.map((row) => row.id)], {
        orderId: detailedOrder.id,
        type: "order_placed",
        title: "New order",
        message: `A new order #${detailedOrder.id.slice(0, 8)} has been placed.`,
        metadata: { status: detailedOrder.status }
      }),
      sendOrderConfirmationEmail(detailedOrder.customerEmail, detailedOrder)
    ]);
  } catch (error) {
    console.error(`[VASTRA order confirmation] ${error.message}`);
  }
  if (detailedOrder.paymentMethod === "card" && detailedOrder.paymentStatus === "paid") {
    try {
      await sendFinalReceiptOnce(detailedOrder.id, detailedOrder.customerEmail, detailedOrder);
    } catch (error) {
      console.error(`[VASTRA card receipt] ${error.message}`);
    }
  }

  res.status(201).json({ order: detailedOrder });
}

export async function listOrders(req, res) {
  const orders = await getOrdersFor("WHERE orders.user_id = $1", [req.user.id]);
  res.json({ orders });
}

export async function listAllOrders(_req, res) {
  const orders = await getOrdersFor("", []);
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

export async function listVendorReturnRequests(req, res) {
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(25, Math.max(1, Number(req.query.limit || 10)));
  const offset = (page - 1) * limit;
  const count = await query(
    `SELECT COUNT(DISTINCT orders.id)::int AS total
     FROM orders
     JOIN order_items ON order_items.order_id = orders.id
     JOIN products ON products.id = order_items.product_id
     WHERE products.vendor_id = $1 AND orders.return_status <> 'none'`,
    [req.user.id]
  );
  const { rows } = await query(
    `SELECT orders.*, users.name AS customer_name, users.email AS customer_email,
            order_items.id AS item_id, order_items.product_id, order_items.quantity,
            order_items.selected_size, order_items.selected_color, order_items.price_at_purchase,
            products.name AS product_name, products.vendor_id AS product_vendor_id,
            products.brand AS product_brand, products.image_url AS product_image_url,
            vendor_users.name AS product_vendor_name
     FROM orders
     JOIN users ON users.id = orders.user_id
     JOIN order_items ON order_items.order_id = orders.id
     JOIN products ON products.id = order_items.product_id
     LEFT JOIN users AS vendor_users ON vendor_users.id = products.vendor_id
     WHERE products.vendor_id = $1 AND orders.return_status <> 'none'
     ORDER BY COALESCE(orders.return_requested_at, orders.updated_at) DESC
     LIMIT $2 OFFSET $3`,
    [req.user.id, limit, offset]
  );
  res.json({
    returns: mapOrderRows(rows),
    meta: { page, limit, total: count.rows[0].total, totalPages: Math.max(1, Math.ceil(count.rows[0].total / limit)) }
  });
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
  const orders = await getOrdersFor("WHERE orders.id = $1 AND orders.user_id = $2", [req.params.id, req.user.id]);
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

    if (order.status === status) return { order, changed: false };
    if (["delivered", "cancelled"].includes(order.status)) {
      throw new AppError(`This order is finalized as ${order.status} and cannot be updated.`, 409);
    }

    const updated = await client.query(
      `UPDATE orders
       SET status = $1::order_status,
           delivered_at = CASE
             WHEN $1::order_status = 'delivered'::order_status THEN COALESCE(delivered_at, NOW())
             ELSE delivered_at
           END,
           payment_status = CASE
             WHEN $1::order_status = 'delivered'::order_status AND payment_method = 'cod' THEN 'paid'
             ELSE payment_status
           END
       WHERE id = $2 RETURNING *`,
      [status, orderId]
    );
    return { order: { ...updated.rows[0], customer_email: order.customer_email }, changed: true };
  });

  const vendors = await query(
    `SELECT DISTINCT products.vendor_id FROM order_items
     JOIN products ON products.id = order_items.product_id
     WHERE order_items.order_id = $1`,
    [orderId]
  );

  if (result.changed) {
    const detailedOrder = (await getOrdersFor("WHERE orders.id = $1", [orderId]))[0];
    await createOrderNotifications([detailedOrder.userId], {
      orderId,
      type: status === "cancelled" ? "order_cancelled" : "status_updated",
      title: status === "cancelled" ? "Order cancelled" : "Delivery status updated",
      message: `Order #${orderId.slice(0, 8)} is now ${status}.`,
      metadata: { status, explanation }
    });

    try {
      if (status === "delivered" && detailedOrder.paymentMethod === "cod") {
        await sendFinalReceiptOnce(orderId, result.order.customer_email, { ...detailedOrder, status, explanation });
      } else {
        await sendOrderStatusEmail(result.order.customer_email, { ...detailedOrder, status, explanation });
      }
    } catch (error) {
      console.error(`[VASTRA order status email] ${error.message}`);
    }
    emitOrderUpdated(detailedOrder, vendors.rows.map((row) => row.vendor_id));
    return detailedOrder;
  }

  const detailedOrder = (await getOrdersFor("WHERE orders.id = $1", [orderId]))[0];
  if (detailedOrder.status === "delivered" && detailedOrder.paymentMethod === "cod") {
    try {
      await sendFinalReceiptOnce(orderId, result.order.customer_email, detailedOrder);
    } catch (error) {
      console.error(`[VASTRA order receipt retry] ${error.message}`);
    }
  }
  return detailedOrder;
}

export async function cancelOrder(req, res) {
  const result = await withTransaction(async (client) => {
    const orderResult = await client.query(
      `SELECT orders.*, users.email AS customer_email
       FROM orders JOIN users ON users.id = orders.user_id
       WHERE orders.id = $1 AND orders.user_id = $2 FOR UPDATE OF orders`,
      [req.params.id, req.user.id]
    );
    const order = orderResult.rows[0];
    if (!order) throw notFound("Order not found");
    if (!["pending", "processing"].includes(order.status)) {
      throw new AppError("Only pending or processing orders can be cancelled.", 409);
    }

    const itemTotals = await client.query(
      `SELECT product_id, SUM(quantity)::int AS quantity
       FROM order_items WHERE order_id = $1 AND product_id IS NOT NULL GROUP BY product_id`,
      [order.id]
    );
    const products = [];
    for (const item of itemTotals.rows) {
      const updated = await client.query(
        "UPDATE products SET stock = stock + $1 WHERE id = $2 RETURNING *",
        [item.quantity, item.product_id]
      );
      if (updated.rows[0]) products.push(updated.rows[0]);
    }

    const updated = await client.query(
      `UPDATE orders SET status = 'cancelled', payment_status = CASE WHEN payment_status = 'paid' THEN 'refunded' ELSE payment_status END
       WHERE id = $1 RETURNING *`,
      [order.id]
    );
    return { order: { ...updated.rows[0], customer_email: order.customer_email }, products };
  });

  await Promise.all(result.products.map(async (product) => {
    await updateStockAlertState(product);
    emitProductUpdated(product);
    await emitCartStockInvalidated(product);
  }));
  const vendors = await query(
    `SELECT DISTINCT products.vendor_id FROM order_items
     JOIN products ON products.id = order_items.product_id WHERE order_items.order_id = $1`,
    [req.params.id]
  );
  const detailedOrder = (await getOrdersFor("WHERE orders.id = $1", [req.params.id]))[0];
  emitOrderUpdated(detailedOrder, vendors.rows.map((row) => row.vendor_id));
  try {
    const admins = await query("SELECT id FROM users WHERE role = 'admin'");
    await Promise.all([
      createOrderNotifications([detailedOrder.userId, ...vendors.rows.map((row) => row.vendor_id), ...admins.rows.map((row) => row.id)], {
        orderId: detailedOrder.id,
        type: "order_cancelled",
        title: "Order cancelled",
        message: `Order #${detailedOrder.id.slice(0, 8)} was cancelled by the customer.`,
        metadata: { status: "cancelled", paymentStatus: detailedOrder.paymentStatus }
      }),
      sendOrderStatusEmail(result.order.customer_email, { ...detailedOrder, status: "cancelled", explanation: "Cancelled by customer." })
    ]);
  } catch (error) {
    console.error(`[VASTRA order cancellation notice] ${error.message}`);
  }
  res.json({ order: detailedOrder, message: "Order cancelled successfully." });
}

export async function requestOrderReturn(req, res) {
  const updated = await withTransaction(async (client) => {
    const orderResult = await client.query(
      "SELECT * FROM orders WHERE id = $1 AND user_id = $2 FOR UPDATE",
      [req.params.id, req.user.id]
    );
    const order = orderResult.rows[0];
    if (!order) throw notFound("Order not found");
    if (order.status !== "delivered") throw new AppError("Only delivered orders can be returned.", 409);
    if (order.return_status && order.return_status !== "none") {
      throw new AppError("A return request already exists for this order.", 409);
    }
    const deliveredAt = order.delivered_at || order.updated_at;
    if (!deliveredAt || Date.now() - new Date(deliveredAt).getTime() > 7 * 24 * 60 * 60 * 1000) {
      throw new AppError("The 7-day return window has closed.", 409);
    }
    const result = await client.query(
      `UPDATE orders SET return_status = 'requested', return_requested_at = NOW(), return_reason = $1
       WHERE id = $2 RETURNING *`,
      [req.body.reason || null, order.id]
    );
    return result.rows[0];
  });

  const vendors = await query(
    `SELECT DISTINCT products.vendor_id FROM order_items
     JOIN products ON products.id = order_items.product_id WHERE order_items.order_id = $1`,
    [updated.id]
  );
  const detailedOrder = (await getOrdersFor("WHERE orders.id = $1", [updated.id]))[0];
  emitOrderUpdated(detailedOrder, vendors.rows.map((row) => row.vendor_id));
  try {
    await createOrderNotifications([detailedOrder.userId, ...vendors.rows.map((row) => row.vendor_id)], {
      orderId: detailedOrder.id,
      type: "return_requested",
      title: "Return requested",
      message: `A return was requested for order #${detailedOrder.id.slice(0, 8)}.`,
      metadata: { returnStatus: detailedOrder.returnStatus }
    });
  } catch (error) {
    console.error(`[VASTRA return notification] ${error.message}`);
  }
  res.json({ order: detailedOrder, message: "Return request submitted successfully." });
}

export async function updateOrderReturnStatus(req, res) {
  const updated = await withTransaction(async (client) => {
    const result = await client.query(
      `SELECT orders.*, users.email AS customer_email
       FROM orders JOIN users ON users.id = orders.user_id
       WHERE orders.id = $1 FOR UPDATE OF orders`,
      [req.params.id]
    );
    const order = result.rows[0];
    if (!order) throw notFound("Order not found");
    if (req.user.role !== "vendor") throw new AppError("Only vendors can decide customer return requests.", 403);
    const ownership = await client.query(
      `SELECT 1 FROM order_items
       JOIN products ON products.id = order_items.product_id
       WHERE order_items.order_id = $1 AND products.vendor_id = $2 LIMIT 1`,
      [order.id, req.user.id]
    );
    if (!ownership.rows[0]) throw notFound("Return request not found or not owned by vendor");
    if (order.return_status === "none") throw new AppError("This order has no return request.", 409);
    if (["approved", "rejected", "completed"].includes(order.return_status)) throw new AppError(`This return is already ${order.return_status}.`, 409);
    if (order.return_status === req.body.status) return { order, customerEmail: order.customer_email, changed: false };

    const saved = await client.query(
      `UPDATE orders
       SET return_status = $1,
           return_vendor_reason = $3,
           return_vendor_id = $4,
           return_decided_at = NOW(),
           return_processed_at = CASE WHEN $1 IN ('approved', 'completed') THEN NOW() ELSE return_processed_at END,
           payment_status = CASE WHEN $1 = 'completed' AND payment_status = 'paid' THEN 'refunded' ELSE payment_status END
       WHERE id = $2 RETURNING *`,
      [req.body.status, order.id, req.body.reason, req.user.id]
    );
    return { order: saved.rows[0], customerEmail: order.customer_email, changed: true };
  });

  const detailedOrder = (await getOrdersFor("WHERE orders.id = $1", [req.params.id]))[0];
  const vendors = await query(
    `SELECT DISTINCT products.vendor_id FROM order_items
     JOIN products ON products.id = order_items.product_id WHERE order_items.order_id = $1`,
    [req.params.id]
  );
  if (updated.changed) {
    await createOrderNotifications([detailedOrder.userId, ...vendors.rows.map((row) => row.vendor_id)], {
      orderId: detailedOrder.id,
      type: "return_updated",
      title: "Return status updated",
      message: `The return for order #${detailedOrder.id.slice(0, 8)} is now ${detailedOrder.returnStatus}.`,
      metadata: { returnStatus: detailedOrder.returnStatus, reason: detailedOrder.returnVendorReason, targetUrl: `/orders` }
    });
  }

  if (["approved", "completed"].includes(detailedOrder.returnStatus)) {
    const claimed = await query(
      `UPDATE orders SET return_receipt_dispatch_started_at = NOW()
       WHERE id = $1 AND return_receipt_sent_at IS NULL
         AND (return_receipt_dispatch_started_at IS NULL OR return_receipt_dispatch_started_at < NOW() - INTERVAL '15 minutes')
       RETURNING return_receipt_dispatch_started_at`,
      [detailedOrder.id]
    );
    if (claimed.rows[0]) {
      try {
        await sendReturnReceiptEmail(updated.customerEmail, detailedOrder);
        await query("UPDATE orders SET return_receipt_sent_at = NOW(), return_receipt_dispatch_started_at = NULL WHERE id = $1", [detailedOrder.id]);
      } catch (error) {
        await query("UPDATE orders SET return_receipt_dispatch_started_at = NULL WHERE id = $1", [detailedOrder.id]);
        console.error(`[VASTRA return receipt] ${error.message}`);
      }
    }
  }
  emitOrderUpdated(detailedOrder, vendors.rows.map((row) => row.vendor_id));
  res.json({ order: detailedOrder, message: `Return marked ${detailedOrder.returnStatus}.` });
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
