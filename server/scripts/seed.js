import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { pool, withTransaction } from "../src/config/db.js";

dotenv.config();

const passwordMap = {
  admin: "Admin123!",
  user: "User123!",
  user2: "User123!",
  vendor: "Vendor123!",
  vendor2: "Vendor123!"
};

async function hash(password) {
  return bcrypt.hash(password, 12);
}

async function insertOrder(client, users, products, order) {
  const created = await client.query(
    `INSERT INTO orders
      (user_id, total_amount, subtotal_amount, shipping_fee, discount_amount, status,
       payment_method, payment_status, delivery_name, delivery_phone, delivery_address,
       cardholder_name, card_last4, card_expiry, delivered_at, return_requested_at,
       return_status, return_reason, return_vendor_reason, return_vendor_id,
       return_decided_at, return_processed_at, receipt_sent_at, return_receipt_sent_at, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
       $12, $13, $14, $15, $16, $17, $18, $19, $20,
       $21, $22, $23, $24, COALESCE($25, NOW()))
     RETURNING id`,
    [
      users[order.user],
      order.total,
      order.subtotal ?? order.total,
      order.shippingFee ?? 0,
      order.discountAmount ?? 0,
      order.status,
      order.paymentMethod,
      order.paymentStatus,
      order.deliveryName,
      order.deliveryPhone,
      order.deliveryAddress,
      order.cardholderName || null,
      order.cardLast4 || null,
      order.cardExpiry || null,
      order.deliveredAt || null,
      order.returnRequestedAt || null,
      order.returnStatus || "none",
      order.returnReason || null,
      order.returnVendorReason || null,
      order.returnVendor ? users[order.returnVendor] : null,
      order.returnDecidedAt || null,
      order.returnProcessedAt || null,
      order.receiptSentAt || null,
      order.returnReceiptSentAt || null,
      order.createdAt || null
    ]
  );

  for (const item of order.items) {
    await client.query(
      `INSERT INTO order_items (order_id, product_id, selected_size, selected_color, quantity, price_at_purchase)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [created.rows[0].id, products[item.product], item.size || "", item.color || "", item.quantity, item.price]
    );
  }

  return created.rows[0].id;
}

async function seed() {
  await withTransaction(async (client) => {
    await client.query("DELETE FROM dashboard_section_seen");
    await client.query("DELETE FROM product_price_drop_events");
    await client.query("DELETE FROM order_notifications");
    await client.query("DELETE FROM conversation_deletions");
    await client.query("DELETE FROM conversation_messages");
    await client.query("DELETE FROM message_conversations");
    await client.query("DELETE FROM product_reviews");
    await client.query("DELETE FROM vendor_reviews");
    await client.query("DELETE FROM reviews");
    await client.query("DELETE FROM wardrobe_items");
    await client.query("DELETE FROM home_collection_products");
    await client.query("DELETE FROM contact_messages");
    await client.query("DELETE FROM wishlist_items");
    await client.query("DELETE FROM order_items");
    await client.query("DELETE FROM orders");
    await client.query("DELETE FROM cart_items");
    await client.query("DELETE FROM products");
    await client.query("DELETE FROM users");

    const users = {};
    const userRows = [
      { key: "admin", name: "Avery Admin", email: "admin@example.com", role: "admin" },
      { key: "user", name: "Uma Customer", email: "user@example.com", role: "user" },
      { key: "user2", name: "Nira Shopper", email: "nira@example.com", role: "user" },
      { key: "vendor", name: "Veda Studio", email: "vendor@example.com", role: "vendor", brandName: "Veda Studio", brandDescription: "Minimal tailoring and everyday occasionwear." },
      { key: "vendor2", name: "Kirana Loom", email: "vendor2@example.com", role: "vendor", brandName: "Kirana Loom", brandDescription: "Textiles and soft accessories made for daily rituals." }
    ];

    for (const item of userRows) {
      const result = await client.query(
        `INSERT INTO users (name, email, password_hash, role, brand_name, brand_description, email_verified, shipping_address)
         VALUES ($1, $2, $3, $4, $5, $6, true, $7)
         RETURNING id`,
        [item.name, item.email, await hash(passwordMap[item.key]), item.role, item.brandName || null, item.brandDescription || null, "Lazimpat, Kathmandu"]
      );
      users[item.key] = result.rows[0].id;
    }

    const productRows = [
      { key: "linen-blazer", vendor: "vendor", name: "Linen Hour Blazer", price: 148, category: "Blazers", gender: "Women", sizes: ["S", "M", "L"], sizePrices: { L: 158 }, colors: ["Ivory", "Clay"], stock: 18, status: "approved", imageUrl: "https://images.unsplash.com/photo-1487222477894-8943e31ef7b2?auto=format&fit=crop&w=900&q=80" },
      { key: "silk-shirt", vendor: "vendor", name: "Washed Silk Shirt", price: 92, category: "Shirts", gender: "Unisex", sizes: ["XS", "S", "M", "L"], sizePrices: { XS: 88 }, colors: ["Black", "Pearl"], stock: 24, status: "approved", imageUrl: "https://images.unsplash.com/photo-1520975682031-a69d1d07b134?auto=format&fit=crop&w=900&q=80" },
      { key: "loom-scarf", vendor: "vendor2", name: "Monsoon Loom Scarf", price: 64, category: "Scarves", gender: "Unisex", sizes: ["One Size"], sizePrices: {}, colors: ["Indigo"], stock: 12, status: "approved", imageUrl: "https://images.unsplash.com/photo-1601924994987-69e26d50dc26?auto=format&fit=crop&w=900&q=80" },
      { key: "pending-coat", vendor: "vendor", name: "Cropped Wool Coat", price: 186, category: "Coats", gender: "Women", sizes: ["S", "M"], sizePrices: {}, colors: ["Camel"], stock: 9, status: "pending", imageUrl: "https://images.unsplash.com/photo-1543076447-215ad9ba6923?auto=format&fit=crop&w=900&q=80" }
    ];

    const products = {};
    for (const product of productRows) {
      const result = await client.query(
        `INSERT INTO products
          (vendor_id, name, description, price, category, gender, brand, sizes, size_prices, colors, color_stock_status, stock, image_url, product_images, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, '{}'::jsonb, $11, $12, $13, $14)
         RETURNING id`,
        [
          users[product.vendor],
          product.name,
          `${product.name} sample product for VASTRA testing.`,
          product.price,
          product.category,
          product.gender,
          product.vendor === "vendor" ? "Veda Studio" : "Kirana Loom",
          product.sizes,
          JSON.stringify(product.sizePrices),
          product.colors,
          product.stock,
          product.imageUrl,
          JSON.stringify([{ color: product.colors[0] || "", url: product.imageUrl, type: "image" }]),
          product.status
        ]
      );
      products[product.key] = result.rows[0].id;
    }

    await client.query(
      `INSERT INTO wishlist_items (user_id, product_id)
       VALUES ($1, $2), ($3, $2), ($1, $4)`,
      [users.user, products["linen-blazer"], users.user2, products["silk-shirt"]]
    );

    const cardOrderId = await insertOrder(client, users, products, {
      user: "user",
      total: 148,
      status: "processing",
      paymentMethod: "card",
      paymentStatus: "paid",
      deliveryName: "Uma Customer",
      deliveryPhone: "+977 9800000001",
      deliveryAddress: "Lazimpat, Kathmandu",
      cardholderName: "Uma Customer",
      cardLast4: "4242",
      cardExpiry: "12/30",
      receiptSentAt: new Date(),
      items: [{ product: "linen-blazer", size: "M", color: "Ivory", quantity: 1, price: 148 }]
    });

    const codOrderId = await insertOrder(client, users, products, {
      user: "user",
      total: 92,
      status: "pending",
      paymentMethod: "cod",
      paymentStatus: "pending",
      deliveryName: "Uma Customer",
      deliveryPhone: "+977 9800000001",
      deliveryAddress: "Lazimpat, Kathmandu",
      items: [{ product: "silk-shirt", size: "S", color: "Black", quantity: 1, price: 92 }]
    });

    await insertOrder(client, users, products, {
      user: "user2",
      total: 64,
      status: "delivered",
      paymentMethod: "cod",
      paymentStatus: "paid",
      deliveryName: "Nira Shopper",
      deliveryPhone: "+977 9800000002",
      deliveryAddress: "Jhamsikhel, Lalitpur",
      deliveredAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      receiptSentAt: new Date(),
      items: [{ product: "loom-scarf", size: "One Size", color: "Indigo", quantity: 1, price: 64 }]
    });

    const activeReturnId = await insertOrder(client, users, products, {
      user: "user",
      total: 148,
      status: "delivered",
      paymentMethod: "card",
      paymentStatus: "paid",
      deliveryName: "Uma Customer",
      deliveryPhone: "+977 9800000001",
      deliveryAddress: "Lazimpat, Kathmandu",
      cardholderName: "Uma Customer",
      cardLast4: "1881",
      cardExpiry: "11/30",
      deliveredAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      returnRequestedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      returnStatus: "requested",
      returnReason: "The sleeve length was not right for me.",
      receiptSentAt: new Date(),
      items: [{ product: "linen-blazer", size: "S", color: "Clay", quantity: 1, price: 148 }]
    });

    await insertOrder(client, users, products, {
      user: "user2",
      total: 92,
      status: "delivered",
      paymentMethod: "card",
      paymentStatus: "paid",
      deliveryName: "Nira Shopper",
      deliveryPhone: "+977 9800000002",
      deliveryAddress: "Jhamsikhel, Lalitpur",
      cardholderName: "Nira Shopper",
      cardLast4: "2222",
      cardExpiry: "10/30",
      deliveredAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      returnRequestedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      returnStatus: "approved",
      returnReason: "The shirt arrived with a loose button.",
      returnVendorReason: "Approved after reviewing the customer photos.",
      returnVendor: "vendor",
      returnDecidedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      returnProcessedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      receiptSentAt: new Date(),
      returnReceiptSentAt: new Date(),
      items: [{ product: "silk-shirt", size: "M", color: "Pearl", quantity: 1, price: 92 }]
    });

    await insertOrder(client, users, products, {
      user: "user",
      total: 64,
      status: "delivered",
      paymentMethod: "cod",
      paymentStatus: "paid",
      deliveryName: "Uma Customer",
      deliveryPhone: "+977 9800000001",
      deliveryAddress: "Lazimpat, Kathmandu",
      deliveredAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
      returnRequestedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      returnStatus: "rejected",
      returnReason: "I changed my mind after delivery.",
      returnVendorReason: "Rejected because the item was used and outside return policy.",
      returnVendor: "vendor2",
      returnDecidedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      receiptSentAt: new Date(),
      items: [{ product: "loom-scarf", size: "One Size", color: "Indigo", quantity: 1, price: 64 }]
    });

    await client.query(
      `INSERT INTO order_notifications (user_id, order_id, type, title, message, metadata)
       VALUES
       ($1, $2, 'order_placed', 'Order placed', 'Card order sample is processing.', '{"status":"processing"}'::jsonb),
       ($1, $3, 'order_placed', 'Order placed', 'COD order sample is pending.', '{"status":"pending"}'::jsonb),
       ($4, $5, 'return_requested', 'Return requested', 'A customer requested a return.', '{"returnStatus":"requested"}'::jsonb),
       ($1, NULL, 'price_drop', 'Price drop', 'Price drop: Linen Hour Blazer is now NPR 132, reduced from NPR 148.', $6)`,
      [
        users.user,
        cardOrderId,
        codOrderId,
        users.vendor,
        activeReturnId,
        JSON.stringify({ productId: products["linen-blazer"], previousPrice: 148, newPrice: 132, targetUrl: `/shop/${products["linen-blazer"]}` })
      ]
    );

    await client.query(
      `INSERT INTO product_price_drop_events (product_id, previous_price, new_price)
       VALUES ($1, 148, 132) ON CONFLICT DO NOTHING`,
      [products["linen-blazer"]]
    );

    await client.query(
      `INSERT INTO dashboard_section_seen (user_id, section_key, seen_at)
       VALUES
       ($1, 'product-approvals', NOW() - INTERVAL '3 days'),
       ($1, 'order-history', NOW() - INTERVAL '3 days'),
       ($1, 'contact-messages', NOW() - INTERVAL '3 days'),
       ($2, 'returned-products', NOW() - INTERVAL '3 days'),
       ($2, 'orders', NOW() - INTERVAL '3 days')`,
      [users.admin, users.vendor]
    );

    await client.query(
      `INSERT INTO contact_messages (name, email, subject, message)
       VALUES
       ('Mira Lane', 'mira@example.com', 'Styling appointment', 'Do you offer styling consultations for capsule wardrobes?'),
       ('Jon Bell', 'jon@example.com', 'Sizing help', 'I would love help choosing the right blazer size.')`
    );
  });

  await pool.end();
  console.log("Seed complete");
  console.log("Admin: admin@example.com / Admin123!");
  console.log("User: user@example.com / User123!");
  console.log("Vendor: vendor@example.com / Vendor123!");
}

seed().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
