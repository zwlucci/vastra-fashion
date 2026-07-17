import crypto from "node:crypto";
import { AppError, notFound } from "./errors.js";

const DEFAULT_DEMO_CARD_NUMBERS = ["4242424242424242", "5555555555554444", "378282246310005"];
const DISABLED_MESSAGE = "Demo saved cards are currently disabled.";
const CONFIG_MESSAGE = "The saved-card security configuration is incomplete.";

export function demoSavedCardsEnabled() {
  return process.env.ENABLE_DEMO_SAVED_CARDS === "true";
}

export function normalizeCardNumber(value = "") {
  return String(value).replace(/[ -]/g, "");
}

export function demoCardAllowlist() {
  const configured = (process.env.DEMO_CARD_NUMBERS || "")
    .split(",")
    .map((value) => normalizeCardNumber(value.trim()))
    .filter(Boolean);
  return new Set(configured.length ? configured : DEFAULT_DEMO_CARD_NUMBERS);
}

function loadEncryptionKey() {
  const raw = process.env.DEMO_CARD_ENCRYPTION_KEY || "";
  if (!raw) return null;

  const decoders = [
    () => Buffer.from(raw, "base64"),
    () => /^[a-f0-9]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.alloc(0),
    () => Buffer.from(raw, "utf8")
  ];

  for (const decode of decoders) {
    const key = decode();
    if (key.length === 32) return key;
  }
  return null;
}

export function assertDemoSavedCardStartupConfig() {
  if (!demoSavedCardsEnabled()) return;
  if (!loadEncryptionKey()) {
    throw new Error(`${CONFIG_MESSAGE} DEMO_CARD_ENCRYPTION_KEY must decode to exactly 32 bytes.`);
  }
}

export function assertDemoSavedCardsAvailable() {
  if (!demoSavedCardsEnabled()) {
    throw new AppError(DISABLED_MESSAGE, 403);
  }
  if (!loadEncryptionKey()) {
    throw new AppError(CONFIG_MESSAGE, 503);
  }
}

export function luhnValid(cardNumber) {
  let sum = 0;
  let shouldDouble = false;
  for (let index = cardNumber.length - 1; index >= 0; index -= 1) {
    let digit = Number(cardNumber[index]);
    if (!Number.isInteger(digit)) return false;
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum > 0 && sum % 10 === 0;
}

export function cardBrandFromNumber(cardNumber = "") {
  const digits = normalizeCardNumber(cardNumber);
  if (/^4/.test(digits)) return "Visa";
  if (/^(5[1-5]|2[2-7])/.test(digits)) return "Mastercard";
  if (/^3[47]/.test(digits)) return "American Express";
  if (/^6(?:011|5)/.test(digits)) return "Discover";
  return "Card";
}

export function maskCardNumber(cardNumber = "") {
  const digits = normalizeCardNumber(cardNumber);
  return `**** **** **** ${digits.slice(-4)}`;
}

export function assertApprovedDemoCard(cardNumber) {
  const normalized = normalizeCardNumber(cardNumber);
  if (!/^\d+$/.test(normalized)) {
    throw new AppError("Only approved test card numbers can be saved in development mode.", 400);
  }
  if (!/^\d{13,19}$/.test(normalized)) {
    throw new AppError("Only approved test card numbers can be saved in development mode.", 400);
  }
  if (!luhnValid(normalized)) {
    throw new AppError("Only approved test cards can be used.", 400);
  }
  if (!demoCardAllowlist().has(normalized)) {
    throw new AppError("Only approved test card numbers can be saved in development mode.", 400);
  }
  return normalized;
}

export function encryptCardNumber(cardNumber) {
  assertDemoSavedCardsAvailable();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", loadEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(cardNumber, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    encryptedCardNumber: encrypted.toString("base64"),
    cardNumberIv: iv.toString("base64"),
    cardNumberAuthTag: authTag.toString("base64")
  };
}

export function decryptCardNumber(row) {
  assertDemoSavedCardsAvailable();
  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      loadEncryptionKey(),
      Buffer.from(row.card_number_iv, "base64")
    );
    decipher.setAuthTag(Buffer.from(row.card_number_auth_tag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(row.encrypted_card_number, "base64")),
      decipher.final()
    ]).toString("utf8");
  } catch {
    throw new AppError("Unable to use this saved payment method.", 400);
  }
}

export function expiryDateFromParts(month, year) {
  return `${String(month).padStart(2, "0")}/${String(year).slice(-2)}`;
}

export function assertNotExpired(month, year) {
  const expiry = new Date(Number(year), Number(month), 0, 23, 59, 59, 999);
  if (Number.isNaN(expiry.getTime()) || expiry < new Date()) {
    throw new AppError("This saved card has expired.", 400);
  }
}

export function assertCvvForBrand(cvv, brand) {
  const expected = brand === "American Express" ? /^\d{4}$/ : /^\d{3}$/;
  if (!expected.test(String(cvv || "").trim())) {
    throw new AppError("Enter a valid CVV for this saved card.", 400);
  }
}

export function toSavedCard(row) {
  if (!row) return null;
  return {
    id: row.id,
    nickname: row.nickname,
    cardholderName: row.cardholder_name,
    cardBrand: row.card_brand,
    cardLastFour: row.card_last_four,
    maskedCardNumber: `**** **** **** ${row.card_last_four}`,
    expiryMonth: row.expiry_month,
    expiryYear: row.expiry_year,
    billingAddress: row.billing_address,
    billingCity: row.billing_city,
    billingState: row.billing_state,
    billingCountry: row.billing_country,
    postalCode: row.postal_code,
    isDefault: row.is_default,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function assertSavedDemoCardForCheckout(client, userId, savedPaymentMethodId, cvv) {
  if (!savedPaymentMethodId) return null;
  assertDemoSavedCardsAvailable();
  const { rows } = await client.query(
    "SELECT * FROM saved_payment_methods WHERE id = $1 AND user_id = $2",
    [savedPaymentMethodId, userId]
  );
  const savedCard = rows[0];
  if (!savedCard) throw notFound("This saved payment method could not be found.");
  assertNotExpired(savedCard.expiry_month, savedCard.expiry_year);
  assertCvvForBrand(cvv, savedCard.card_brand);
  const cardNumber = decryptCardNumber(savedCard);
  assertApprovedDemoCard(cardNumber);
  return {
    id: savedCard.id,
    cardholderName: savedCard.cardholder_name,
    cardNumber,
    expiryDate: expiryDateFromParts(savedCard.expiry_month, savedCard.expiry_year),
    cardBrand: savedCard.card_brand,
    cardLastFour: savedCard.card_last_four
  };
}
