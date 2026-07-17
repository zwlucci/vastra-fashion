import { query, withTransaction } from "../config/db.js";
import { AppError, notFound } from "../utils/errors.js";
import {
  assertApprovedDemoCard,
  assertDemoSavedCardsAvailable,
  cardBrandFromNumber as demoCardBrandFromNumber,
  demoSavedCardsEnabled,
  encryptCardNumber,
  toSavedCard
} from "../utils/demoSavedCards.js";

const ADDRESS_FIELDS = [
  "id",
  "label",
  "full_name",
  "email",
  "phone_number",
  "country",
  "province",
  "city",
  "area",
  "detailed_address",
  "postal_code",
  "delivery_instructions",
  "is_default",
  "created_at",
  "updated_at"
];

function toAddress(row) {
  if (!row) return null;
  return {
    id: row.id,
    label: row.label,
    fullName: row.full_name,
    email: row.email,
    phoneNumber: row.phone_number,
    country: row.country,
    province: row.province,
    city: row.city,
    area: row.area,
    detailedAddress: row.detailed_address,
    postalCode: row.postal_code,
    deliveryInstructions: row.delivery_instructions,
    isDefault: row.is_default,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toPayment(row) {
  if (!row) return null;
  const cardDescription = row.method === "card" && row.card_last4
    ? `${row.card_brand || "Card"} ending in ${row.card_last4}`
    : "";
  return {
    id: row.id,
    method: row.method,
    label: row.label,
    cardholderName: row.cardholder_name || "",
    cardBrand: row.card_brand || "",
    cardLast4: row.card_last4 || "",
    providerReference: row.provider_reference || "",
    displayName: row.label || cardDescription || paymentMethodLabel(row.method),
    isDefault: row.is_default,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function paymentMethodLabel(method) {
  return {
    cod: "Cash on Delivery",
    card: "Card",
    esewa: "eSewa"
  }[method] || method;
}

export function formatAddress(address) {
  return [
    address.detailed_address,
    address.area,
    address.city,
    address.province,
    address.postal_code,
    address.country
  ].map((part) => String(part || "").trim()).filter(Boolean).join(", ");
}

function cardBrandFromNumber(cardNumber = "") {
  const digits = String(cardNumber).replace(/\D/g, "");
  if (/^4/.test(digits)) return "Visa";
  if (/^(5[1-5]|2[2-7])/.test(digits)) return "Mastercard";
  if (/^3[47]/.test(digits)) return "American Express";
  if (/^6(?:011|5)/.test(digits)) return "Discover";
  return "Card";
}

async function setOnlyDefault(client, table, userId, id) {
  await client.query(`UPDATE ${table} SET is_default = false WHERE user_id = $1`, [userId]);
  const { rows } = await client.query(
    `UPDATE ${table} SET is_default = true WHERE id = $1 AND user_id = $2 RETURNING *`,
    [id, userId]
  );
  if (!rows[0]) throw notFound("Saved checkout detail not found");
  return rows[0];
}

async function ensureDefault(client, table, userId, id) {
  const currentDefault = await client.query(`SELECT id FROM ${table} WHERE user_id = $1 AND is_default = true`, [userId]);
  if (!currentDefault.rows[0]) {
    await client.query(`UPDATE ${table} SET is_default = true WHERE id = $1 AND user_id = $2`, [id, userId]);
  }
}

export async function listCheckoutDetails(req, res) {
  const [addresses, payments, savedCards] = await Promise.all([
    query(`SELECT ${ADDRESS_FIELDS.join(", ")} FROM saved_checkout_addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC`, [req.user.id]),
    query("SELECT * FROM saved_payment_preferences WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC", [req.user.id]),
    demoSavedCardsEnabled()
      ? query("SELECT * FROM saved_payment_methods WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC", [req.user.id])
      : Promise.resolve({ rows: [] })
  ]);

  res.json({
    demoSavedCardsEnabled: demoSavedCardsEnabled(),
    contact: {
      fullName: req.user.name || "",
      email: req.user.email || "",
      phoneNumber: req.user.phoneNumber || ""
    },
    addresses: addresses.rows.map(toAddress),
    paymentPreferences: payments.rows.map(toPayment),
    savedPaymentMethods: savedCards.rows.map(toSavedCard)
  });
}

export async function addAddress(req, res) {
  const address = await withTransaction(async (client) => {
    if (req.body.isDefault) {
      await client.query("UPDATE saved_checkout_addresses SET is_default = false WHERE user_id = $1", [req.user.id]);
    }
    const { rows } = await client.query(
      `INSERT INTO saved_checkout_addresses
         (user_id, label, full_name, email, phone_number, country, province, city, area, detailed_address, postal_code, delivery_instructions, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING ${ADDRESS_FIELDS.join(", ")}`,
      [
        req.user.id,
        req.body.label,
        req.body.fullName,
        req.user.email,
        req.body.phoneNumber,
        req.body.country,
        req.body.province || "",
        req.body.city,
        req.body.area || "",
        req.body.detailedAddress,
        req.body.postalCode || "",
        req.body.deliveryInstructions || "",
        Boolean(req.body.isDefault)
      ]
    );
    await ensureDefault(client, "saved_checkout_addresses", req.user.id, rows[0].id);
    const refreshed = await client.query(`SELECT ${ADDRESS_FIELDS.join(", ")} FROM saved_checkout_addresses WHERE id = $1`, [rows[0].id]);
    return refreshed.rows[0];
  });

  res.status(201).json({ address: toAddress(address), message: "Address saved." });
}

export async function updateAddress(req, res) {
  const address = await withTransaction(async (client) => {
    const existing = await client.query("SELECT id FROM saved_checkout_addresses WHERE id = $1 AND user_id = $2 FOR UPDATE", [req.params.id, req.user.id]);
    if (!existing.rows[0]) throw notFound("Saved address not found");
    if (req.body.isDefault) {
      await client.query("UPDATE saved_checkout_addresses SET is_default = false WHERE user_id = $1", [req.user.id]);
    }
    const { rows } = await client.query(
      `UPDATE saved_checkout_addresses
       SET label = $3,
           full_name = $4,
           email = $5,
           phone_number = $6,
           country = $7,
           province = $8,
           city = $9,
           area = $10,
           detailed_address = $11,
           postal_code = $12,
           delivery_instructions = $13,
           is_default = CASE WHEN $14 THEN true ELSE is_default END
       WHERE id = $1 AND user_id = $2
       RETURNING ${ADDRESS_FIELDS.join(", ")}`,
      [
        req.params.id,
        req.user.id,
        req.body.label,
        req.body.fullName,
        req.user.email,
        req.body.phoneNumber,
        req.body.country,
        req.body.province || "",
        req.body.city,
        req.body.area || "",
        req.body.detailedAddress,
        req.body.postalCode || "",
        req.body.deliveryInstructions || "",
        Boolean(req.body.isDefault)
      ]
    );
    return rows[0];
  });

  res.json({ address: toAddress(address), message: "Address updated." });
}

export async function deleteAddress(req, res) {
  const result = await withTransaction(async (client) => {
    const deleted = await client.query(
      "DELETE FROM saved_checkout_addresses WHERE id = $1 AND user_id = $2 RETURNING is_default",
      [req.params.id, req.user.id]
    );
    if (!deleted.rows[0]) throw notFound("Saved address not found");
    if (deleted.rows[0].is_default) {
      const replacement = await client.query(
        "SELECT id FROM saved_checkout_addresses WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
        [req.user.id]
      );
      if (replacement.rows[0]) {
        await client.query("UPDATE saved_checkout_addresses SET is_default = true WHERE id = $1", [replacement.rows[0].id]);
      }
    }
    return deleted.rows[0];
  });
  res.json({ deleted: Boolean(result), message: "Address deleted." });
}

export async function setDefaultAddress(req, res) {
  const address = await withTransaction((client) => setOnlyDefault(client, "saved_checkout_addresses", req.user.id, req.params.id));
  res.json({ address: toAddress(address), message: "Default address updated." });
}

export async function addPaymentPreference(req, res) {
  const payment = await withTransaction(async (client) => {
    if (req.body.isDefault) {
      await client.query("UPDATE saved_payment_preferences SET is_default = false WHERE user_id = $1", [req.user.id]);
    }
    const cardNumber = String(req.body.cardNumber || "").replace(/\D/g, "");
    const method = req.body.method;
    const cardLast4 = method === "card" ? (req.body.cardLast4 || cardNumber.slice(-4) || null) : null;
    const cardBrand = method === "card" ? (req.body.cardBrand || cardBrandFromNumber(cardNumber)) : null;
    const label = req.body.label || (method === "card" && cardLast4 ? `${cardBrand} ending in ${cardLast4}` : paymentMethodLabel(method));
    const { rows } = await client.query(
      `INSERT INTO saved_payment_preferences
         (user_id, method, label, cardholder_name, card_brand, card_last4, provider_reference, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        req.user.id,
        method,
        label,
        method === "card" ? req.body.cardholderName || "" : null,
        cardBrand,
        cardLast4,
        req.body.providerReference || null,
        Boolean(req.body.isDefault)
      ]
    );
    await ensureDefault(client, "saved_payment_preferences", req.user.id, rows[0].id);
    const refreshed = await client.query("SELECT * FROM saved_payment_preferences WHERE id = $1", [rows[0].id]);
    return refreshed.rows[0];
  });

  res.status(201).json({ paymentPreference: toPayment(payment), message: "Payment preference saved." });
}

export async function updatePaymentPreference(req, res) {
  const payment = await withTransaction(async (client) => {
    const existing = await client.query("SELECT id FROM saved_payment_preferences WHERE id = $1 AND user_id = $2 FOR UPDATE", [req.params.id, req.user.id]);
    if (!existing.rows[0]) throw notFound("Saved payment preference not found");
    if (req.body.isDefault) {
      await client.query("UPDATE saved_payment_preferences SET is_default = false WHERE user_id = $1", [req.user.id]);
    }
    const method = req.body.method;
    const cardNumber = String(req.body.cardNumber || "").replace(/\D/g, "");
    const cardLast4 = method === "card" ? (req.body.cardLast4 || cardNumber.slice(-4) || null) : null;
    const cardBrand = method === "card" ? (req.body.cardBrand || cardBrandFromNumber(cardNumber)) : null;
    const label = req.body.label || (method === "card" && cardLast4 ? `${cardBrand} ending in ${cardLast4}` : paymentMethodLabel(method));
    const { rows } = await client.query(
      `UPDATE saved_payment_preferences
       SET method = $3,
           label = $4,
           cardholder_name = $5,
           card_brand = $6,
           card_last4 = $7,
           provider_reference = $8,
           is_default = CASE WHEN $9 THEN true ELSE is_default END
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [
        req.params.id,
        req.user.id,
        method,
        label,
        method === "card" ? req.body.cardholderName || "" : null,
        cardBrand,
        cardLast4,
        req.body.providerReference || null,
        Boolean(req.body.isDefault)
      ]
    );
    return rows[0];
  });

  res.json({ paymentPreference: toPayment(payment), message: "Payment preference updated." });
}

export async function deletePaymentPreference(req, res) {
  await withTransaction(async (client) => {
    const deleted = await client.query(
      "DELETE FROM saved_payment_preferences WHERE id = $1 AND user_id = $2 RETURNING is_default",
      [req.params.id, req.user.id]
    );
    if (!deleted.rows[0]) throw notFound("Saved payment preference not found");
    if (deleted.rows[0].is_default) {
      const replacement = await client.query(
        "SELECT id FROM saved_payment_preferences WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
        [req.user.id]
      );
      if (replacement.rows[0]) {
        await client.query("UPDATE saved_payment_preferences SET is_default = true WHERE id = $1", [replacement.rows[0].id]);
      }
    }
  });
  res.json({ message: "Payment preference deleted." });
}

export async function setDefaultPaymentPreference(req, res) {
  const payment = await withTransaction((client) => setOnlyDefault(client, "saved_payment_preferences", req.user.id, req.params.id));
  res.json({ paymentPreference: toPayment(payment), message: "Default payment preference updated." });
}

async function ensureSavedCardDefault(client, userId, id) {
  const currentDefault = await client.query("SELECT id FROM saved_payment_methods WHERE user_id = $1 AND is_default = true", [userId]);
  if (!currentDefault.rows[0]) {
    await client.query("UPDATE saved_payment_methods SET is_default = true WHERE id = $1 AND user_id = $2", [id, userId]);
  }
}

async function insertSavedPaymentMethod(client, userId, payload) {
  assertDemoSavedCardsAvailable();
  const cardNumber = assertApprovedDemoCard(payload.cardNumber);
  const encrypted = encryptCardNumber(cardNumber);
  const cardBrand = demoCardBrandFromNumber(cardNumber);
  if (payload.isDefault) {
    await client.query("UPDATE saved_payment_methods SET is_default = false WHERE user_id = $1", [userId]);
  }
  const { rows } = await client.query(
    `INSERT INTO saved_payment_methods
       (user_id, nickname, cardholder_name, encrypted_card_number, card_number_iv, card_number_auth_tag,
        card_last_four, card_brand, expiry_month, expiry_year, billing_address, billing_city, billing_state,
        billing_country, postal_code, is_default)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
     RETURNING *`,
    [
      userId,
      payload.nickname,
      payload.cardholderName,
      encrypted.encryptedCardNumber,
      encrypted.cardNumberIv,
      encrypted.cardNumberAuthTag,
      cardNumber.slice(-4),
      cardBrand,
      payload.expiryMonth,
      payload.expiryYear,
      payload.billingAddress,
      payload.billingCity,
      payload.billingState || "",
      payload.billingCountry,
      payload.postalCode,
      Boolean(payload.isDefault)
    ]
  );
  await ensureSavedCardDefault(client, userId, rows[0].id);
  const refreshed = await client.query("SELECT * FROM saved_payment_methods WHERE id = $1 AND user_id = $2", [rows[0].id, userId]);
  return refreshed.rows[0];
}

export async function listSavedPaymentMethods(req, res) {
  assertDemoSavedCardsAvailable();
  const { rows } = await query(
    "SELECT * FROM saved_payment_methods WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC",
    [req.user.id]
  );
  res.json({ savedPaymentMethods: rows.map(toSavedCard) });
}

export async function addSavedPaymentMethod(req, res) {
  const savedCard = await withTransaction((client) => insertSavedPaymentMethod(client, req.user.id, req.body));
  res.status(201).json({ savedPaymentMethod: toSavedCard(savedCard), message: "Saved test card added." });
}

export async function updateSavedPaymentMethod(req, res) {
  assertDemoSavedCardsAvailable();
  const savedCard = await withTransaction(async (client) => {
    const existing = await client.query("SELECT * FROM saved_payment_methods WHERE id = $1 AND user_id = $2 FOR UPDATE", [req.params.id, req.user.id]);
    if (!existing.rows[0]) throw notFound("This saved payment method could not be found.");
    if (req.body.isDefault) {
      await client.query("UPDATE saved_payment_methods SET is_default = false WHERE user_id = $1", [req.user.id]);
    }

    const encrypted = req.body.cardNumber
      ? encryptCardNumber(assertApprovedDemoCard(req.body.cardNumber))
      : {
          encryptedCardNumber: existing.rows[0].encrypted_card_number,
          cardNumberIv: existing.rows[0].card_number_iv,
          cardNumberAuthTag: existing.rows[0].card_number_auth_tag
        };
    const normalizedCardNumber = req.body.cardNumber ? assertApprovedDemoCard(req.body.cardNumber) : "";
    const cardLastFour = normalizedCardNumber ? normalizedCardNumber.slice(-4) : existing.rows[0].card_last_four;
    const cardBrand = normalizedCardNumber ? demoCardBrandFromNumber(normalizedCardNumber) : existing.rows[0].card_brand;

    const { rows } = await client.query(
      `UPDATE saved_payment_methods
       SET nickname = $3,
           cardholder_name = $4,
           encrypted_card_number = $5,
           card_number_iv = $6,
           card_number_auth_tag = $7,
           card_last_four = $8,
           card_brand = $9,
           expiry_month = $10,
           expiry_year = $11,
           billing_address = $12,
           billing_city = $13,
           billing_state = $14,
           billing_country = $15,
           postal_code = $16,
           is_default = CASE WHEN $17 THEN true ELSE is_default END
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [
        req.params.id,
        req.user.id,
        req.body.nickname,
        req.body.cardholderName,
        encrypted.encryptedCardNumber,
        encrypted.cardNumberIv,
        encrypted.cardNumberAuthTag,
        cardLastFour,
        cardBrand,
        req.body.expiryMonth,
        req.body.expiryYear,
        req.body.billingAddress,
        req.body.billingCity,
        req.body.billingState || "",
        req.body.billingCountry,
        req.body.postalCode,
        Boolean(req.body.isDefault)
      ]
    );
    return rows[0];
  });

  res.json({ savedPaymentMethod: toSavedCard(savedCard), message: "Saved test card updated." });
}

export async function deleteSavedPaymentMethod(req, res) {
  assertDemoSavedCardsAvailable();
  await withTransaction(async (client) => {
    const deleted = await client.query(
      "DELETE FROM saved_payment_methods WHERE id = $1 AND user_id = $2 RETURNING is_default",
      [req.params.id, req.user.id]
    );
    if (!deleted.rows[0]) throw notFound("This saved payment method could not be found.");
    if (deleted.rows[0].is_default) {
      const replacement = await client.query(
        "SELECT id FROM saved_payment_methods WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
        [req.user.id]
      );
      if (replacement.rows[0]) {
        await client.query("UPDATE saved_payment_methods SET is_default = true WHERE id = $1", [replacement.rows[0].id]);
      }
    }
  });
  res.json({ message: "Saved test card deleted." });
}

export async function setDefaultSavedPaymentMethod(req, res) {
  assertDemoSavedCardsAvailable();
  const savedCard = await withTransaction((client) => setOnlyDefault(client, "saved_payment_methods", req.user.id, req.params.id));
  res.json({ savedPaymentMethod: toSavedCard(savedCard), message: "Default saved card updated." });
}

export function buildSavedPaymentFromCard(card) {
  const cardNumber = String(card?.cardNumber || "").replace(/\D/g, "");
  return {
    method: "card",
    label: `${cardBrandFromNumber(cardNumber)} ending in ${cardNumber.slice(-4)}`,
    cardholderName: card?.cardholderName || "",
    cardBrand: cardBrandFromNumber(cardNumber),
    cardLast4: cardNumber.slice(-4)
  };
}

export async function saveCheckoutAddressInTransaction(client, userId, email, address) {
  await client.query("UPDATE saved_checkout_addresses SET is_default = false WHERE user_id = $1", [userId]);
  await client.query(
    `INSERT INTO saved_checkout_addresses
       (user_id, label, full_name, email, phone_number, country, province, city, area, detailed_address, postal_code, delivery_instructions, is_default)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true)`,
    [
      userId,
      address.label || "Home",
      address.fullName,
      email,
      address.phoneNumber,
      address.country || "Nepal",
      address.province || "",
      address.city || "",
      address.area || "",
      address.detailedAddress || address.deliveryAddress,
      address.postalCode || "",
      address.deliveryInstructions || ""
    ]
  );
}

export async function savePaymentPreferenceInTransaction(client, userId, payment) {
  await client.query("UPDATE saved_payment_preferences SET is_default = false WHERE user_id = $1", [userId]);
  await client.query(
    `INSERT INTO saved_payment_preferences
       (user_id, method, label, cardholder_name, card_brand, card_last4, provider_reference, is_default)
     VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
    [
      userId,
      payment.method,
      payment.label,
      payment.cardholderName || null,
      payment.cardBrand || null,
      payment.cardLast4 || null,
      payment.providerReference || null
    ]
  );
}

export async function saveDemoPaymentMethodInTransaction(client, userId, payment) {
  return insertSavedPaymentMethod(client, userId, {
    nickname: payment.nickname || "Checkout card",
    cardholderName: payment.cardholderName,
    cardNumber: payment.cardNumber,
    expiryMonth: payment.expiryMonth,
    expiryYear: payment.expiryYear,
    billingAddress: payment.billingAddress,
    billingCity: payment.billingCity,
    billingState: payment.billingState || "",
    billingCountry: payment.billingCountry || "Nepal",
    postalCode: payment.postalCode,
    isDefault: Boolean(payment.isDefault)
  });
}

export async function assertSavedAddressOwner(client, userId, addressId) {
  if (!addressId) return null;
  const { rows } = await client.query(
    `SELECT ${ADDRESS_FIELDS.join(", ")}
     FROM saved_checkout_addresses
     WHERE id = $1 AND user_id = $2`,
    [addressId, userId]
  );
  if (!rows[0]) throw new AppError("Saved address not found.", 404);
  return rows[0];
}

export async function assertSavedPaymentOwner(client, userId, paymentPreferenceId) {
  if (!paymentPreferenceId) return null;
  const { rows } = await client.query(
    "SELECT * FROM saved_payment_preferences WHERE id = $1 AND user_id = $2",
    [paymentPreferenceId, userId]
  );
  if (!rows[0]) throw new AppError("Saved payment preference not found.", 404);
  return rows[0];
}
