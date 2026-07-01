import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { pool, withTransaction } from "../src/config/db.js";
import { DEFAULT_PRODUCT_CATEGORY } from "../../shared/productCategories.mjs";

dotenv.config();

const passwordMap = {
  admin: "Admin123!",
  user: "User123!",
  vendor: "Vendor123!"
};

async function hash(password) {
  return bcrypt.hash(password, 12);
}

async function seed() {
  await withTransaction(async (client) => {
    await client.query("DELETE FROM contact_messages");
    await client.query("DELETE FROM order_items");
    await client.query("DELETE FROM orders");
    await client.query("DELETE FROM cart_items");
    await client.query("DELETE FROM products");
    await client.query("DELETE FROM users");

    const users = {};
    const userRows = [
      {
        key: "admin",
        name: "Avery Admin",
        email: "admin@example.com",
        role: "admin",
        brandName: null,
        brandDescription: null
      },
      {
        key: "user",
        name: "Uma Customer",
        email: "user@example.com",
        role: "user",
        brandName: null,
        brandDescription: null
      },
      {
        key: "vendor",
        name: "Veda Studio",
        email: "vendor@example.com",
        role: "vendor",
        brandName: "Veda Studio",
        brandDescription: "Minimal tailoring and everyday occasionwear."
      }
    ];

    for (const item of userRows) {
      const result = await client.query(
        `INSERT INTO users (name, email, password_hash, role, brand_name, brand_description, email_verified)
         VALUES ($1, $2, $3, $4, $5, $6, true)
         RETURNING id`,
        [
          item.name,
          item.email,
          await hash(passwordMap[item.key]),
          item.role,
          item.brandName,
          item.brandDescription
        ]
      );
      users[item.key] = result.rows[0].id;
    }

    const products = [
      {
        key: "linen-blazer",
        vendor: "vendor",
        name: "Linen Hour Blazer",
        description: "A breathable linen blend blazer with a softly structured shoulder.",
        price: 148,
        category: "Outerwear",
        gender: "Women",
        brand: "Veda Studio",
        sizes: ["S", "M", "L"],
        colors: ["Ivory", "Clay"],
        stock: 18,
        status: "approved",
        imageUrl: "https://images.unsplash.com/photo-1487222477894-8943e31ef7b2?auto=format&fit=crop&w=900&q=80"
      },
      {
        key: "silk-shirt",
        vendor: "vendor",
        name: "Washed Silk Shirt",
        description: "Fluid silk with a quiet sheen, cut for relaxed layering.",
        price: 92,
        category: "Shirts",
        gender: "Unisex",
        brand: "Veda Studio",
        sizes: ["XS", "S", "M", "L"],
        colors: ["Black", "Pearl"],
        stock: 24,
        status: "approved",
        imageUrl: "https://images.unsplash.com/photo-1520975682031-a69d1d07b134?auto=format&fit=crop&w=900&q=80"
      },
      {
        key: "pending-coat",
        vendor: "vendor",
        name: "Cropped Wool Coat",
        description: "A compact wool coat awaiting seasonal approval.",
        price: 186,
        category: "Outerwear",
        gender: "Women",
        brand: "Veda Studio",
        sizes: ["S", "M"],
        colors: ["Camel"],
        stock: 9,
        status: "pending",
        imageUrl: "https://images.unsplash.com/photo-1543076447-215ad9ba6923?auto=format&fit=crop&w=900&q=80"
      }
    ];

    const productIds = {};
    for (const product of products) {
      const result = await client.query(
        `INSERT INTO products
          (vendor_id, name, description, price, category, gender, brand, sizes, colors, stock, image_url, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING id`,
        [
          users[product.vendor],
          product.name,
          product.description,
          product.price,
          DEFAULT_PRODUCT_CATEGORY,
          product.gender,
          product.brand,
          product.sizes,
          product.colors,
          product.stock,
          product.imageUrl,
          product.status
        ]
      );
      productIds[product.key] = result.rows[0].id;
    }

    const order = await client.query(
      "INSERT INTO orders (user_id, total_amount, status) VALUES ($1, $2, 'processing') RETURNING id",
      [users.user, 240]
    );
    await client.query(
      `INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase)
       VALUES ($1, $2, 1, 148), ($1, $3, 1, 92)`,
      [order.rows[0].id, productIds["linen-blazer"], productIds["silk-shirt"]]
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
