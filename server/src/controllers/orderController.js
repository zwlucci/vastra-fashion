import { query, withTransaction } from "../config/db.js";
import { AppError, notFound } from "../utils/errors.js";
import { sendOrderConfirmationEmail, sendOrderReceiptEmail, sendOrderStatusEmail, sendReturnReceiptEmail } from "../utils/mailer.js";
import { emitCartStockInvalidated, emitOrderCreated, emitOrderStatusUpdated, emitOrderUpdated, emitOrderUserCancelled, emitOrderVendorCancelled, emitProductUpdated } from "../socket.js";
import { updateStockAlertState } from "./productController.js";
import { calculateCouponDiscount, getActiveCoupon } from "../utils/coupons.js";
import { createOrderNotifications, createOrderNotificationsInTransaction, emitCreatedOrderNotifications } from "../utils/orderNotifications.js";
import { assertForwardOrderTransition, assertOrderCancellable } from "../utils/orderStatusTransitions.js";
import { RESERVATION_EXPIRED_MESSAGE, releaseExpiredReservations } from "../utils/cartReservations.js";

const RETURN_PRIORITY = ["requested", "approved", "rejected", "completed"];

function statusLabel(status) {
  return String(status || "").replace(/_/g, " ");
}

function actorFor(user) {
  if (!user) return { id: null, role: "system" };
  return { id: user.id, role: user.role };
}

async function recordOrderTimeline(client, { orderId, orderItemId = null, actor = null, status, category = "order", note = "", metadata = {} }) {
  const performer = actorFor(actor);
  await client.query(
    `INSERT INTO order_status_history (order_id, order_item_id, actor_id, actor_role, status, status_category, note, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [orderId, orderItemId, performer.id, performer.role, status, category, note || null, metadata]
  );
}

async function syncOrderReturnSummary(client, orderId) {
  const { rows } = await client.query(
    `SELECT return_status, return_requested_at, return_reason, return_vendor_response, return_decided_at, returned_at
     FROM order_items
     WHERE order_id = $1 AND return_status <> 'none'`,
    [orderId]
  );
  if (!rows.length) {
    await client.query(
      `UPDATE orders
       SET return_status = 'none',
           return_requested_at = NULL,
           return_reason = NULL,
           return_vendor_reason = NULL,
           return_vendor_id = NULL,
           return_decided_at = NULL,
           return_processed_at = NULL
       WHERE id = $1`,
      [orderId]
    );
    return;
  }

  const status = RETURN_PRIORITY.find((candidate) => rows.some((row) => row.return_status === candidate)) || rows[0].return_status;
  const representative = rows.find((row) => row.return_status === status) || rows[0];
  await client.query(
    `UPDATE orders
     SET return_status = $1,
         return_requested_at = COALESCE($2, return_requested_at),
         return_reason = COALESCE($3, return_reason),
         return_vendor_reason = COALESCE($4, return_vendor_reason),
         return_decided_at = COALESCE($5, return_decided_at),
         return_processed_at = COALESCE($6, return_processed_at)
     WHERE id = $7`,
    [
      status,
      representative.return_requested_at,
      representative.return_reason,
      representative.return_vendor_response,
      representative.return_decided_at,
      representative.returned_at,
      orderId
    ]
  );
}

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
        items: [],
        timeline: []
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
        priceAtPurchase: Number(row.price_at_purchase),
        returnRequestId: row.return_request_id || "",
        returnStatus: row.item_return_status || "none",
        returnReason: row.item_return_reason || "",
        returnVendorResponse: row.item_return_vendor_response || "",
        returnRequestedAt: row.item_return_requested_at,
        returnDecidedAt: row.item_return_decided_at,
        returnedAt: row.item_returned_at
      });
    }
  });
  return [...orders.values()].map((order) => {
    const itemStatuses = order.items.map((item) => item.returnStatus).filter((status) => status && status !== "none");
    if ((!order.returnStatus || order.returnStatus === "none") && itemStatuses.length) {
      order.returnStatus = RETURN_PRIORITY.find((status) => itemStatuses.includes(status)) || itemStatuses[0];
    }
    return order;
  });
}

async function getOrdersFor(where, params, client = null) {
  const runQuery = client ? client.query.bind(client) : query;
  const { rows } = await runQuery(
    `SELECT orders.*, users.name AS customer_name, users.email AS customer_email,
            order_items.id AS item_id, order_items.product_id, order_items.quantity,
            order_items.selected_size, order_items.selected_color, order_items.price_at_purchase,
            COALESCE(return_requests.id::text, '') AS return_request_id,
            COALESCE(return_requests.status, order_items.return_status, 'none') AS item_return_status,
            COALESCE(return_requests.customer_reason, order_items.return_reason, '') AS item_return_reason,
            COALESCE(return_requests.vendor_response, order_items.return_vendor_response, '') AS item_return_vendor_response,
            COALESCE(return_requests.requested_at, order_items.return_requested_at) AS item_return_requested_at,
            COALESCE(return_requests.decided_at, order_items.return_decided_at) AS item_return_decided_at,
            COALESCE(return_requests.completed_at, order_items.returned_at) AS item_returned_at,
            products.name AS product_name,
            products.vendor_id AS product_vendor_id, products.brand AS product_brand,
            products.image_url AS product_image_url, vendor_users.name AS product_vendor_name
     FROM orders
     JOIN users ON users.id = orders.user_id
     LEFT JOIN order_items ON order_items.order_id = orders.id
     LEFT JOIN order_item_return_requests AS return_requests ON return_requests.order_item_id = order_items.id
     LEFT JOIN products ON products.id = order_items.product_id
     LEFT JOIN users AS vendor_users ON vendor_users.id = products.vendor_id
     ${where}
     ORDER BY orders.created_at DESC`,
    params
  );
  const orders = mapOrderRows(rows);
  const orderIds = orders.map((order) => order.id);
  if (orderIds.length) {
    const history = await runQuery(
      `SELECT history.*, users.name AS actor_name
       FROM order_status_history AS history
       LEFT JOIN users ON users.id = history.actor_id
       WHERE history.order_id = ANY($1::uuid[])
       ORDER BY history.created_at ASC, history.id ASC`,
      [orderIds]
    );
    const byOrder = new Map(orderIds.map((id) => [id, []]));
    history.rows.forEach((row) => {
      byOrder.get(row.order_id)?.push({
        id: row.id,
        orderItemId: row.order_item_id || "",
        status: row.status,
        statusName: statusLabel(row.status),
        category: row.status_category,
        actorId: row.actor_id || "",
        actorRole: row.actor_role || "",
        actorName: row.actor_name || "",
        note: row.note || "",
        metadata: row.metadata || {},
        createdAt: row.created_at
      });
    });
    orders.forEach((order) => {
      order.timeline = byOrder.get(order.id) || [];
      if (!order.timeline.length) {
        order.timeline = [{
          id: "fallback-created",
          orderItemId: "",
          status: "order_placed",
          statusName: "order placed",
          category: "order",
          actorRole: "system",
          actorName: "",
          note: "Order placed",
          metadata: {},
          createdAt: order.createdAt
        }];
      }
    });
  }
  return orders;
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
    await releaseExpiredReservations(client, req.user.id);
    const cart = await client.query(
      `SELECT cart_items.id AS cart_item_id, cart_items.product_id, cart_items.quantity,
              cart_items.reserved_quantity, cart_items.reservation_status, cart_items.reservation_expires_at,
              cart_items.selected_size, cart_items.selected_color,
              products.price, products.sizes, products.size_prices, products.colors, products.color_stock_status,
              products.status AS product_status,
              products.stock, products.name
       FROM cart_items
       JOIN products ON products.id = cart_items.product_id
       WHERE cart_items.user_id = $1
         AND cart_items.reservation_status IN ('active', 'expired')
       ORDER BY cart_items.created_at
       FOR UPDATE OF cart_items, products`,
      [req.user.id]
    );

    if (!cart.rows.length) throw new AppError("Cart is empty", 400);

    const totalsByProduct = new Map();
    for (const item of cart.rows) {
      if (item.reservation_status !== "active" || new Date(item.reservation_expires_at).getTime() <= Date.now()) {
        throw new AppError(RESERVATION_EXPIRED_MESSAGE, 409);
      }
      if (item.reserved_quantity < item.quantity) {
        throw new AppError(`"${item.name}" is no longer available in the requested quantity. Update your cart before continuing.`, 409);
      }
      if (item.product_status !== "approved") {
        throw new AppError(`"${item.name}" is no longer available. Remove it from your cart before continuing.`, 409);
      }
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
    await recordOrderTimeline(client, {
      orderId: created.rows[0].id,
      actor: req.user,
      status: "order_placed",
      category: "order",
      note: "Order placed"
    });
    await recordOrderTimeline(client, {
      orderId: created.rows[0].id,
      actor: req.user,
      status: paymentMethod === "card" ? "payment_confirmed" : "cash_on_delivery_selected",
      category: "payment",
      note: paymentMethod === "card" ? "Payment confirmed" : "Cash on delivery selected",
      metadata: { paymentMethod, paymentStatus: paymentMethod === "card" ? "paid" : "pending" }
    });

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
    }

    const updatedProducts = await client.query(
      "SELECT * FROM products WHERE id = ANY($1::uuid[])",
      [[...totalsByProduct.keys()]]
    );

    await client.query(
      `UPDATE cart_items
       SET reservation_status = 'converted'
       WHERE id = ANY($1::uuid[])
         AND user_id = $2`,
      [cart.rows.map((item) => item.cart_item_id), req.user.id]
    );
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
  emitOrderCreated(detailedOrder, vendorResult.rows.map((row) => row.vendor_id));

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
            order_items.selected_size, order_items.selected_color, order_items.price_at_purchase,
            COALESCE(return_requests.id::text, '') AS return_request_id,
            COALESCE(return_requests.status, order_items.return_status, 'none') AS item_return_status,
            COALESCE(return_requests.customer_reason, order_items.return_reason, '') AS item_return_reason,
            COALESCE(return_requests.vendor_response, order_items.return_vendor_response, '') AS item_return_vendor_response,
            COALESCE(return_requests.requested_at, order_items.return_requested_at) AS item_return_requested_at,
            COALESCE(return_requests.decided_at, order_items.return_decided_at) AS item_return_decided_at,
            COALESCE(return_requests.completed_at, order_items.returned_at) AS item_returned_at,
            products.name AS product_name,
            products.vendor_id AS product_vendor_id, products.brand AS product_brand,
            products.image_url AS product_image_url
     FROM orders
     JOIN users ON users.id = orders.user_id
     JOIN order_items ON order_items.order_id = orders.id
     LEFT JOIN order_item_return_requests AS return_requests ON return_requests.order_item_id = order_items.id
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
    `SELECT COUNT(*)::int AS total
     FROM order_item_return_requests AS returns
     JOIN order_items ON order_items.id = returns.order_item_id
     JOIN products ON products.id = order_items.product_id
     WHERE returns.vendor_id = $1 AND products.vendor_id = $1`,
    [req.user.id]
  );
  const { rows } = await query(
    `SELECT returns.id, returns.order_id, returns.order_item_id, returns.status, returns.customer_reason,
            returns.vendor_response, returns.requested_at, returns.decided_at, returns.completed_at,
            orders.created_at AS order_created_at, orders.delivered_at, orders.total_amount,
            orders.delivery_name, orders.delivery_phone, orders.delivery_address,
            users.name AS customer_name, users.email AS customer_email,
            order_items.product_id, order_items.quantity, order_items.selected_size,
            order_items.selected_color, order_items.price_at_purchase,
            products.name AS product_name, products.brand AS product_brand,
            products.image_url AS product_image_url, products.vendor_id AS product_vendor_id,
            vendor_users.name AS product_vendor_name
     FROM order_item_return_requests AS returns
     JOIN orders ON orders.id = returns.order_id
     JOIN users ON users.id = orders.user_id
     JOIN order_items ON order_items.id = returns.order_item_id
     JOIN products ON products.id = order_items.product_id
     LEFT JOIN users AS vendor_users ON vendor_users.id = products.vendor_id
     WHERE returns.vendor_id = $1 AND products.vendor_id = $1
     ORDER BY returns.requested_at DESC
     LIMIT $2 OFFSET $3`,
    [req.user.id, limit, offset]
  );
  res.json({
    returns: rows.map((row) => ({
      id: row.id,
      orderId: row.order_id,
      orderItemId: row.order_item_id,
      status: row.status,
      customerReason: row.customer_reason || "",
      vendorResponse: row.vendor_response || "",
      requestedAt: row.requested_at,
      decidedAt: row.decided_at,
      completedAt: row.completed_at,
      orderCreatedAt: row.order_created_at,
      deliveredAt: row.delivered_at,
      totalAmount: Number(row.total_amount),
      customerName: row.delivery_name || row.customer_name,
      customerEmail: row.customer_email,
      phoneNumber: row.delivery_phone || "",
      deliveryAddress: row.delivery_address || "",
      item: {
        id: row.order_item_id,
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
      }
    })),
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
  const requestedStatus = String(status || "").trim().toLowerCase();
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

    if (order.status === requestedStatus) return { order, changed: false };
    assertForwardOrderTransition(order.status, requestedStatus, order.return_status);

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
      [requestedStatus, orderId]
    );
    await recordOrderTimeline(client, {
      orderId,
      actor,
      status: requestedStatus,
      category: "order",
      note: explanation || "",
      metadata: { previousStatus: order.status }
    });
    if (requestedStatus === "delivered" && order.payment_method === "cod") {
      await recordOrderTimeline(client, {
        orderId,
        actor,
        status: "payment_confirmed",
        category: "payment",
        note: "Cash on delivery payment collected",
        metadata: { paymentMethod: "cod", paymentStatus: "paid" }
      });
    }
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
      type: "status_updated",
      title: "Delivery status updated",
      message: `Order #${orderId.slice(0, 8)} is now ${requestedStatus}.`,
      metadata: { status: requestedStatus, explanation }
    });

    try {
      if (requestedStatus === "delivered" && detailedOrder.paymentMethod === "cod") {
        await sendFinalReceiptOnce(orderId, result.order.customer_email, { ...detailedOrder, status: requestedStatus, explanation });
      } else {
        await sendOrderStatusEmail(result.order.customer_email, { ...detailedOrder, status: requestedStatus, explanation });
      }
    } catch (error) {
      console.error(`[VASTRA order status email] ${error.message}`);
    }
    emitOrderStatusUpdated(detailedOrder, vendors.rows.map((row) => row.vendor_id));
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

async function applyOrderCancellation({ orderId, actor, cancelledBy }) {
  const result = await withTransaction(async (client) => {
    const orderResult = await client.query(
      `SELECT orders.*, users.email AS customer_email
       FROM orders JOIN users ON users.id = orders.user_id
       WHERE orders.id = $1 FOR UPDATE OF orders`,
      [orderId]
    );
    const order = orderResult.rows[0];
    if (!order) throw notFound("Order not found");
    if (cancelledBy === "customer" && order.user_id !== actor.id) {
      throw notFound("Order not found");
    }
    if (cancelledBy === "vendor") {
      const ownership = await client.query(
        `SELECT
           COUNT(*)::int AS total_items,
           COUNT(*) FILTER (WHERE products.vendor_id = $2)::int AS vendor_items
         FROM order_items
         JOIN products ON products.id = order_items.product_id
         WHERE order_items.order_id = $1`,
        [order.id, actor.id]
      );
      const { total_items: totalItems, vendor_items: vendorItems } = ownership.rows[0];
      if (!vendorItems) throw notFound("Order not found or not owned by vendor");
      if (vendorItems !== totalItems) {
        throw new AppError("This order includes products from another vendor and cannot be cancelled by a single vendor.", 403);
      }
    }
    assertOrderCancellable(order, cancelledBy === "vendor" ? "vendor" : "user");

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
    await recordOrderTimeline(client, {
      orderId: order.id,
      actor,
      status: "cancelled",
      category: "order",
      note: cancelledBy === "vendor" ? "Cancelled by vendor" : "Cancelled by customer"
    });
    if (order.payment_status === "paid") {
      await recordOrderTimeline(client, {
        orderId: order.id,
        actor,
        status: "refund_status",
        category: "refund",
        note: "Refund marked for cancelled paid order",
        metadata: { paymentStatus: "refunded" }
      });
    }
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
    [orderId]
  );
  const detailedOrder = (await getOrdersFor("WHERE orders.id = $1", [orderId]))[0];
  const vendorIds = vendors.rows.map((row) => row.vendor_id);
  if (cancelledBy === "vendor") {
    emitOrderVendorCancelled(detailedOrder, vendorIds);
  } else {
    emitOrderUserCancelled(detailedOrder, vendorIds);
  }
  try {
    const admins = await query("SELECT id FROM users WHERE role = 'admin'");
    await Promise.all([
      createOrderNotifications([detailedOrder.userId, ...vendorIds, ...admins.rows.map((row) => row.id)], {
        orderId: detailedOrder.id,
        type: "order_cancelled",
        title: "Order cancelled",
        message: `Order #${detailedOrder.id.slice(0, 8)} was cancelled by the ${cancelledBy}.`,
        metadata: { status: "cancelled", paymentStatus: detailedOrder.paymentStatus }
      }),
      sendOrderStatusEmail(result.order.customer_email, { ...detailedOrder, status: "cancelled", explanation: `Cancelled by ${cancelledBy}.` })
    ]);
  } catch (error) {
    console.error(`[VASTRA order cancellation notice] ${error.message}`);
  }
  return detailedOrder;
}

export async function cancelOrder(req, res) {
  const detailedOrder = await applyOrderCancellation({
    orderId: req.params.id,
    actor: req.user,
    cancelledBy: "customer"
  });
  res.json({ order: detailedOrder, message: "Order cancelled successfully." });
}

export async function cancelVendorOrder(req, res) {
  const detailedOrder = await applyOrderCancellation({
    orderId: req.params.id,
    actor: req.user,
    cancelledBy: "vendor"
  });
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
    const itemResult = await client.query(
      `SELECT order_items.id, order_items.return_status, products.vendor_id
       FROM order_items
       LEFT JOIN products ON products.id = order_items.product_id
       WHERE order_items.order_id = $1
       FOR UPDATE OF order_items`,
      [order.id]
    );
    if (!itemResult.rows.length) throw new AppError("This order has no returnable items.", 400);
    if (itemResult.rows.some((item) => item.return_status && item.return_status !== "none")) {
      throw new AppError("A return request already exists for this order.", 409);
    }
    const result = await client.query(
      `UPDATE orders SET return_status = 'requested', return_requested_at = NOW(), return_reason = $1
       WHERE id = $2 RETURNING *`,
      [req.body.reason || null, order.id]
    );
    for (const item of itemResult.rows) {
      await client.query(
        `UPDATE order_items
         SET return_status = 'requested', return_requested_at = NOW(), return_reason = $1
         WHERE id = $2`,
        [req.body.reason || null, item.id]
      );
      await client.query(
        `INSERT INTO order_item_return_requests (order_id, order_item_id, user_id, vendor_id, status, customer_reason)
         VALUES ($1, $2, $3, $4, 'requested', $5)
         ON CONFLICT (order_item_id) DO NOTHING`,
        [order.id, item.id, req.user.id, item.vendor_id, req.body.reason || null]
      );
      await recordOrderTimeline(client, {
        orderId: order.id,
        orderItemId: item.id,
        actor: req.user,
        status: "return_requested",
        category: "return",
        note: req.body.reason || "",
        metadata: { vendorId: item.vendor_id }
      });
    }
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

export async function requestOrderItemReturn(req, res) {
  const result = await withTransaction(async (client) => {
    const orderResult = await client.query(
      "SELECT * FROM orders WHERE id = $1 AND user_id = $2 FOR UPDATE",
      [req.params.id, req.user.id]
    );
    const order = orderResult.rows[0];
    if (!order) throw notFound("Order not found");
    if (order.status !== "delivered") throw new AppError("Only delivered items can be returned.", 409);
    const deliveredAt = order.delivered_at || order.updated_at;
    if (!deliveredAt || Date.now() - new Date(deliveredAt).getTime() > 7 * 24 * 60 * 60 * 1000) {
      throw new AppError("The 7-day return window has closed.", 409);
    }

    const itemResult = await client.query(
      `SELECT order_items.id, order_items.return_status, order_items.product_id,
              products.vendor_id, products.name AS product_name
       FROM order_items
       JOIN products ON products.id = order_items.product_id
       WHERE order_items.id = $1
         AND order_items.order_id = $2
       FOR UPDATE OF order_items`,
      [req.params.itemId, order.id]
    );
    const item = itemResult.rows[0];
    if (!item) throw notFound("Order item not found");
    if (item.return_status && item.return_status !== "none") {
      throw new AppError("A return request already exists for this item.", 409);
    }

    const existing = await client.query(
      `SELECT id
       FROM order_item_return_requests
       WHERE order_item_id = $1
         AND status IN ('requested', 'approved')
       LIMIT 1`,
      [item.id]
    );
    if (existing.rows[0]) throw new AppError("A return request already exists for this item.", 409);

    await client.query(
      `UPDATE order_items
       SET return_status = 'requested',
           return_requested_at = NOW(),
           return_reason = $1
       WHERE id = $2`,
      [req.body.reason || null, item.id]
    );
    const inserted = await client.query(
      `INSERT INTO order_item_return_requests (order_id, order_item_id, user_id, vendor_id, status, customer_reason)
       VALUES ($1, $2, $3, $4, 'requested', $5)
       ON CONFLICT (order_item_id) DO NOTHING
       RETURNING *`,
      [order.id, item.id, req.user.id, item.vendor_id, req.body.reason || null]
    );
    if (!inserted.rows[0]) throw new AppError("A return request already exists for this item.", 409);

    await recordOrderTimeline(client, {
      orderId: order.id,
      orderItemId: item.id,
      actor: req.user,
      status: "return_requested",
      category: "return",
      note: req.body.reason || "",
      metadata: { returnRequestId: inserted.rows[0].id, vendorId: item.vendor_id, productId: item.product_id }
    });
    await syncOrderReturnSummary(client, order.id);

    return {
      orderId: order.id,
      orderItemId: item.id,
      productName: item.product_name,
      returnRequestId: inserted.rows[0].id,
      vendorId: item.vendor_id
    };
  });

  const detailedOrder = (await getOrdersFor("WHERE orders.id = $1", [result.orderId]))[0];
  emitOrderUpdated(detailedOrder, result.vendorId ? [result.vendorId] : []);
  try {
    const vendorTarget = `/vendor/dashboard/returned-products?returnRequestId=${result.returnRequestId}`;
    await Promise.all([
      createOrderNotifications([detailedOrder.userId], {
        orderId: detailedOrder.id,
        type: "return_requested",
        title: "Return item requested",
        message: `Your return request for ${result.productName} was submitted.`,
        metadata: {
          returnStatus: detailedOrder.returnStatus,
          returnRequestId: result.returnRequestId,
          orderItemId: result.orderItemId,
          targetUrl: "/orders"
        }
      }),
      result.vendorId ? createOrderNotifications([result.vendorId], {
        orderId: detailedOrder.id,
        type: "return_requested",
        title: "Return item requested",
        message: `A return was requested for ${result.productName}.`,
        metadata: {
          notificationType: "return_requested",
          returnRequestId: result.returnRequestId,
          orderId: detailedOrder.id,
          orderItemId: result.orderItemId,
          vendorId: result.vendorId,
          destinationRoute: vendorTarget,
          targetUrl: vendorTarget,
          targetType: "return_request"
        }
      }) : Promise.resolve()
    ]);
  } catch (error) {
    console.error(`[VASTRA return notification] ${error.message}`);
  }
  res.json({ order: detailedOrder, message: "Return item request submitted successfully." });
}

export async function updateOrderReturnStatus(req, res) {
  const updated = await withTransaction(async (client) => {
    const result = await client.query(
      `SELECT returns.*, orders.user_id, users.email AS customer_email,
              order_items.product_id, products.vendor_id AS product_vendor_id,
              products.name AS product_name
       FROM order_item_return_requests AS returns
       JOIN orders ON orders.id = returns.order_id
       JOIN users ON users.id = orders.user_id
       JOIN order_items ON order_items.id = returns.order_item_id
       JOIN products ON products.id = order_items.product_id
       WHERE returns.id = $1
       FOR UPDATE OF returns, order_items`,
      [req.params.id]
    );
    const returnRequest = result.rows[0];
    if (!returnRequest) throw notFound("Return request not found");
    if (returnRequest.product_vendor_id !== req.user.id || returnRequest.vendor_id !== req.user.id) {
      throw new AppError("You can only manage returns for products you own.", 403);
    }
    if (returnRequest.status !== "requested") {
      throw new AppError(`This return is already ${returnRequest.status}.`, 409);
    }

    const saved = await client.query(
      `UPDATE order_item_return_requests
       SET status = $1,
           vendor_response = $2,
           decided_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [req.body.status, req.body.reason, returnRequest.id]
    );
    await client.query(
      `UPDATE order_items
       SET return_status = $1,
           return_vendor_response = $2,
           return_decided_at = NOW()
       WHERE id = $3`,
      [req.body.status, req.body.reason, returnRequest.order_item_id]
    );
    await recordOrderTimeline(client, {
      orderId: returnRequest.order_id,
      orderItemId: returnRequest.order_item_id,
      actor: req.user,
      status: req.body.status === "approved" ? "return_accepted" : "return_rejected",
      category: "return",
      note: req.body.reason,
      metadata: { returnRequestId: returnRequest.id, productId: returnRequest.product_id }
    });
    await syncOrderReturnSummary(client, returnRequest.order_id);
    await client.query("UPDATE orders SET return_vendor_id = $1 WHERE id = $2", [req.user.id, returnRequest.order_id]);
    const notifications = await createOrderNotificationsInTransaction(client, [returnRequest.user_id], {
      orderId: returnRequest.order_id,
      type: "return_updated",
      title: req.body.status === "approved" ? "Return accepted" : "Return rejected",
      message: `Your return request for ${returnRequest.product_name} was ${req.body.status === "approved" ? "accepted" : "rejected"}.`,
      metadata: {
        returnRequestId: returnRequest.id,
        orderItemId: returnRequest.order_item_id,
        returnStatus: req.body.status,
        reason: req.body.reason,
        targetUrl: `/orders`
      }
    });
    return {
      orderId: returnRequest.order_id,
      customerEmail: returnRequest.customer_email,
      returnRequest: saved.rows[0],
      notifications
    };
  });

  await emitCreatedOrderNotifications(updated.notifications);
  const detailedOrder = (await getOrdersFor("WHERE orders.id = $1", [updated.orderId]))[0];
  const vendors = await query(
    `SELECT DISTINCT products.vendor_id FROM order_items
     JOIN products ON products.id = order_items.product_id WHERE order_items.order_id = $1`,
    [updated.orderId]
  );

  if (updated.returnRequest.status === "approved") {
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
