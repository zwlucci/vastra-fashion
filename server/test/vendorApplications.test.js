import test from "node:test";
import assert from "node:assert/strict";
import {
  approveVendorApplicationForAdmin,
  createPaidVendorApplicationForUser,
  vendorPlanFor
} from "../src/controllers/vendorApplicationController.js";
import { vendorApplicationPaymentSchema } from "../src/utils/validators.js";

const userId = "22222222-2222-4222-8222-222222222222";
const adminId = "33333333-3333-4333-8333-333333333333";
const applicationId = "44444444-4444-4444-8444-444444444444";
const paymentId = "66666666-6666-4666-8666-666666666666";
const idempotencyKey = "77777777-7777-4777-8777-777777777777";

function fakeClient(responses) {
  const queries = [];
  return {
    queries,
    async query(text, params) {
      queries.push({ text, params });
      const response = responses.shift();
      if (response instanceof Error) throw response;
      return { rows: response || [] };
    }
  };
}

const card = {
  cardholderName: "Amisha Seller",
  cardNumber: "4242424242424242",
  expiryDate: "12/30",
  cvv: "123"
};

const payload = {
  fullName: "Amisha Seller",
  brandName: "Amisha Atelier",
  contactNumber: "+977 9800000000",
  businessEmail: "seller@example.com",
  businessAddress: "Kathmandu, Nepal",
  businessDescription: "A handcrafted clothing studio focused on small-batch pieces.",
  subscriptionPlan: "annual",
  supportingDocumentData: "",
  paymentMethod: "card",
  paymentPreferenceId: "",
  savedPaymentMethodId: "",
  savedCardCvv: "",
  saveCardDetails: false,
  savePaymentPreference: false,
  saveCardAsDefault: false,
  card,
  idempotencyKey
};

function applicationRow(overrides = {}) {
  return {
    id: applicationId,
    user_id: userId,
    full_name: payload.fullName,
    brand_name: payload.brandName,
    contact_number: payload.contactNumber,
    business_email: payload.businessEmail,
    business_address: payload.businessAddress,
    business_description: payload.businessDescription,
    subscription_plan: payload.subscriptionPlan,
    subscription_price: 2499,
    status: "pending",
    payment_status: "paid",
    subscription_status: "pending_admin_review",
    subscription_start_date: new Date("2026-07-21T00:00:00.000Z"),
    subscription_expiry_date: new Date("2027-07-21T00:00:00.000Z"),
    vendor_payment_id: paymentId,
    created_at: new Date().toISOString(),
    payment_id: paymentId,
    payment_amount: 2499,
    payment_payment_method: "card",
    payment_payment_status: "paid",
    payment_transaction_reference: "VENDOR-TEST",
    payment_payment_date: new Date().toISOString(),
    payment_subscription_plan: payload.subscriptionPlan,
    payment_billing_period: payload.subscriptionPlan,
    payment_subscription_start_date: new Date("2026-07-21T00:00:00.000Z"),
    payment_subscription_expiry_date: new Date("2027-07-21T00:00:00.000Z"),
    payment_cardholder_name: card.cardholderName,
    payment_card_brand: "Visa",
    payment_card_last4: "4242",
    ...overrides
  };
}

test("vendorPlanFor keeps subscription prices on the backend", () => {
  assert.equal(vendorPlanFor("monthly").price, 299);
  assert.equal(vendorPlanFor("annual").price, 2499);
  assert.throws(() => vendorPlanFor("enterprise"), { statusCode: 400 });
});

test("vendor application payment schema rejects tampered frontend amount", () => {
  const parsed = vendorApplicationPaymentSchema.safeParse({ ...payload, amount: 1 });
  assert.equal(parsed.success, false);
  assert.ok(parsed.error.flatten().formErrors.includes("Unrecognized key(s) in object: 'amount'"));
});

test("vendor application payment schema rejects cancelled or unfinished methods", () => {
  const parsed = vendorApplicationPaymentSchema.safeParse({ ...payload, paymentMethod: "cod" });
  assert.equal(parsed.success, false);
});

test("createPaidVendorApplicationForUser records annual payment and pending application", async () => {
  const client = fakeClient([
    [{ id: userId, role: "user", email: "seller@example.com", name: "Amisha Seller" }],
    [],
    [],
    [{ ...applicationRow(), vendor_payment_id: null }],
    [{ id: paymentId, transaction_reference: "VENDOR-TEST" }],
    [],
    [applicationRow()],
    [{ id: adminId }],
    [{ id: "55555555-5555-4555-8555-555555555555", metadata: {}, type: "vendor_application_submitted", title: "Paid vendor application", message: "Application", created_at: new Date().toISOString() }]
  ]);

  const result = await createPaidVendorApplicationForUser(client, { id: userId, role: "user" }, { ...payload, subscriptionPrice: 1 });
  const appInsert = client.queries.find(({ text }) => /INSERT INTO vendor_applications/i.test(text));
  const paymentInsert = client.queries.find(({ text }) => /INSERT INTO vendor_subscription_payments/i.test(text));

  assert.equal(result.application.subscriptionPrice, 2499);
  assert.equal(result.application.paymentStatus, "paid");
  assert.equal(result.application.payment.paymentStatus, "paid");
  assert.equal(appInsert.params[8], 2499);
  assert.equal(paymentInsert.params[4], 2499);
});

test("createPaidVendorApplicationForUser records monthly payment", async () => {
  const monthlyPayload = { ...payload, subscriptionPlan: "monthly" };
  const client = fakeClient([
    [{ id: userId, role: "user", email: "seller@example.com", name: "Amisha Seller" }],
    [],
    [],
    [{ ...applicationRow({ subscription_plan: "monthly", subscription_price: 299 }), vendor_payment_id: null }],
    [{ id: paymentId, transaction_reference: "VENDOR-TEST" }],
    [],
    [applicationRow({ subscription_plan: "monthly", subscription_price: 299, payment_amount: 299, payment_subscription_plan: "monthly", payment_billing_period: "monthly" })],
    [{ id: adminId }],
    [{ id: "55555555-5555-4555-8555-555555555555", metadata: {}, type: "vendor_application_submitted", title: "Paid vendor application", message: "Application", created_at: new Date().toISOString() }]
  ]);

  const result = await createPaidVendorApplicationForUser(client, { id: userId, role: "user" }, monthlyPayload);
  const paymentInsert = client.queries.find(({ text }) => /INSERT INTO vendor_subscription_payments/i.test(text));

  assert.equal(result.application.subscriptionPrice, 299);
  assert.equal(paymentInsert.params[4], 299);
});

test("createPaidVendorApplicationForUser returns existing application for duplicate idempotency key", async () => {
  const client = fakeClient([
    [{ id: userId, role: "user", email: "seller@example.com", name: "Amisha Seller" }],
    [applicationRow()]
  ]);

  const result = await createPaidVendorApplicationForUser(client, { id: userId, role: "user" }, payload);

  assert.equal(result.duplicate, true);
  assert.equal(result.application.transactionReference, "VENDOR-TEST");
  assert.equal(client.queries.some(({ text }) => /INSERT INTO vendor_subscription_payments/i.test(text)), false);
});

test("createPaidVendorApplicationForUser rejects vendors and admins", async () => {
  const client = fakeClient([[{ id: userId, role: "vendor" }]]);

  await assert.rejects(
    () => createPaidVendorApplicationForUser(client, { id: userId, role: "vendor" }, payload),
    { statusCode: 403, message: "Only regular user accounts can submit a vendor application." }
  );
});

test("createPaidVendorApplicationForUser blocks duplicate open applications", async () => {
  const client = fakeClient([
    [{ id: userId, role: "user" }],
    [],
    [{ id: applicationId }]
  ]);

  await assert.rejects(
    () => createPaidVendorApplicationForUser(client, { id: userId, role: "user" }, payload),
    { statusCode: 409, message: "You already have an active vendor application." }
  );
});

test("approveVendorApplicationForAdmin promotes only paid applications", async () => {
  const client = fakeClient([
    [{
      id: applicationId,
      user_id: userId,
      user_role: "user",
      user_email: "seller@example.com",
      user_name: "Amisha Seller",
      brand_name: "Amisha Atelier",
      business_description: "A studio description",
      subscription_plan: "monthly",
      subscription_price: 299,
      status: "pending",
      payment_status: "paid",
      payment_id: paymentId,
      linked_payment_status: "paid"
    }],
    [{ id: applicationId, user_id: userId, brand_name: "Amisha Atelier", subscription_plan: "monthly", subscription_price: 299, status: "approved", payment_status: "paid", subscription_status: "active" }],
    [{ id: userId, name: "Amisha Seller", email: "seller@example.com", role: "vendor", brand_name: "Amisha Atelier" }],
    [{ id: "55555555-5555-4555-8555-555555555555", metadata: {}, type: "vendor_application_approved", title: "Vendor application approved", message: "Approved", created_at: new Date().toISOString() }],
    [applicationRow({ subscription_plan: "monthly", subscription_price: 299, status: "approved", subscription_status: "active", payment_amount: 299 })]
  ]);

  const result = await approveVendorApplicationForAdmin(client, applicationId, { id: adminId, role: "admin" }, "Welcome");

  assert.equal(result.application.status, "approved");
  assert.equal(result.user.role, "vendor");
  assert.equal(client.queries.some(({ text }) => /UPDATE users\s+SET role = 'vendor'/i.test(text)), true);
});

test("approveVendorApplicationForAdmin rejects unpaid applications", async () => {
  const client = fakeClient([
    [{
      id: applicationId,
      user_id: userId,
      user_role: "user",
      brand_name: "Amisha Atelier",
      business_description: "A studio description",
      subscription_plan: "monthly",
      subscription_price: 299,
      status: "pending",
      payment_status: "pending",
      payment_id: null,
      linked_payment_status: null
    }]
  ]);

  await assert.rejects(
    () => approveVendorApplicationForAdmin(client, applicationId, { id: adminId, role: "admin" }, "Welcome"),
    { statusCode: 409, message: "Vendor access can only be approved after a confirmed paid subscription payment." }
  );
  assert.equal(client.queries.some(({ text }) => /UPDATE users\s+SET role = 'vendor'/i.test(text)), false);
});
