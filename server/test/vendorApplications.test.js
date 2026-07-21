import test from "node:test";
import assert from "node:assert/strict";
import {
  approveVendorApplicationForAdmin,
  createVendorApplicationForUser,
  vendorPlanFor
} from "../src/controllers/vendorApplicationController.js";

const userId = "22222222-2222-4222-8222-222222222222";
const adminId = "33333333-3333-4333-8333-333333333333";
const applicationId = "44444444-4444-4444-8444-444444444444";

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

const payload = {
  fullName: "Amisha Seller",
  brandName: "Amisha Atelier",
  contactNumber: "+977 9800000000",
  businessEmail: "seller@example.com",
  businessAddress: "Kathmandu, Nepal",
  businessDescription: "A handcrafted clothing studio focused on small-batch pieces.",
  subscriptionPlan: "annual",
  supportingDocumentData: ""
};

test("vendorPlanFor keeps subscription prices on the backend", () => {
  assert.equal(vendorPlanFor("monthly").price, 299);
  assert.equal(vendorPlanFor("annual").price, 2499);
  assert.throws(() => vendorPlanFor("enterprise"), { statusCode: 400 });
});

test("createVendorApplicationForUser inserts the backend plan price", async () => {
  const client = fakeClient([
    [{ id: userId, role: "user" }],
    [],
    [{ id: applicationId, user_id: userId, ...payload, full_name: payload.fullName, brand_name: payload.brandName, contact_number: payload.contactNumber, business_email: payload.businessEmail, business_address: payload.businessAddress, business_description: payload.businessDescription, subscription_plan: "annual", subscription_price: 2499, status: "pending", payment_status: "pending", subscription_status: "pending_admin_review", created_at: new Date().toISOString() }],
    [{ id: adminId }],
    [{ id: "55555555-5555-4555-8555-555555555555", metadata: {}, type: "vendor_application_submitted", title: "New vendor application", message: "Application", created_at: new Date().toISOString() }]
  ]);

  const result = await createVendorApplicationForUser(client, { id: userId, role: "user" }, { ...payload, subscriptionPrice: 1 });
  const insert = client.queries.find(({ text }) => /INSERT INTO vendor_applications/i.test(text));

  assert.equal(result.application.subscriptionPrice, 2499);
  assert.equal(insert.params[8], 2499);
});

test("createVendorApplicationForUser rejects vendors and admins", async () => {
  const client = fakeClient([[{ id: userId, role: "vendor" }]]);

  await assert.rejects(
    () => createVendorApplicationForUser(client, { id: userId, role: "vendor" }, payload),
    { statusCode: 403, message: "Only regular user accounts can submit a vendor application." }
  );
});

test("createVendorApplicationForUser blocks duplicate pending applications", async () => {
  const client = fakeClient([
    [{ id: userId, role: "user" }],
    [{ id: applicationId }]
  ]);

  await assert.rejects(
    () => createVendorApplicationForUser(client, { id: userId, role: "user" }, payload),
    { statusCode: 409, message: "You already have a pending vendor application." }
  );
});

test("approveVendorApplicationForAdmin promotes the applicant in the same review flow", async () => {
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
      status: "pending"
    }],
    [{ id: applicationId, user_id: userId, brand_name: "Amisha Atelier", subscription_plan: "monthly", subscription_price: 299, status: "approved", payment_status: "pending", subscription_status: "pending_payment" }],
    [{ id: userId, name: "Amisha Seller", email: "seller@example.com", role: "vendor", brand_name: "Amisha Atelier" }],
    [{ id: "55555555-5555-4555-8555-555555555555", metadata: {}, type: "vendor_application_approved", title: "Vendor application approved", message: "Approved", created_at: new Date().toISOString() }]
  ]);

  const result = await approveVendorApplicationForAdmin(client, applicationId, { id: adminId, role: "admin" }, "Welcome");

  assert.equal(result.application.status, "approved");
  assert.equal(result.user.role, "vendor");
  assert.equal(client.queries.some(({ text }) => /UPDATE users\s+SET role = 'vendor'/i.test(text)), true);
});
