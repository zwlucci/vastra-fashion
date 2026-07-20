import test from "node:test";
import assert from "node:assert/strict";
import { revokeVendorAccessForUser } from "../src/controllers/adminController.js";
import { requireAdmin, requireRole } from "../src/middleware/auth.js";
import { adminUserParamsSchema, validate } from "../src/utils/validators.js";

const vendorId = "11111111-1111-4111-8111-111111111111";

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

test("revokeVendorAccessForUser demotes a vendor without touching marketplace data", async () => {
  const client = fakeClient([
    [{ id: vendorId, role: "vendor" }],
    [{ id: vendorId, role: "user", name: "Seller", email: "seller@example.com" }]
  ]);

  const user = await revokeVendorAccessForUser(client, vendorId);

  assert.equal(user.role, "user");
  assert.equal(client.queries.length, 2);
  assert.match(client.queries[1].text, /UPDATE users SET role = 'user'/);
  assert.equal(client.queries.some(({ text }) => /\bproducts\b|\borders\b|\bmessage_conversations\b|\bincome_records\b|\border_item_return_requests\b|\breturns\b/i.test(text)), false);
  assert.equal(client.queries.some(({ text }) => /\bDELETE\b/i.test(text)), false);
});

test("vendor access revocation rejects an invalid vendor id before the controller", () => {
  const middleware = validate(adminUserParamsSchema, "params");
  const req = { params: { id: "not-a-uuid" } };
  let statusCode = 0;
  let payload = null;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      payload = body;
      return this;
    }
  };

  middleware(req, res, () => assert.fail("validation should not pass"));

  assert.equal(statusCode, 400);
  assert.equal(payload.message, "Validation failed");
  assert.ok(payload.issues.id);
});

test("revokeVendorAccessForUser returns not found for an unknown user", async () => {
  const client = fakeClient([[]]);

  await assert.rejects(
    () => revokeVendorAccessForUser(client, vendorId),
    { statusCode: 404, message: "User not found" }
  );
});

test("revokeVendorAccessForUser rejects already-revoked accounts", async () => {
  const client = fakeClient([[{ id: vendorId, role: "user" }]]);

  await assert.rejects(
    () => revokeVendorAccessForUser(client, vendorId),
    { statusCode: 409, message: "Vendor access has already been revoked for this account." }
  );
});

test("revokeVendorAccessForUser rejects duplicate revocation races", async () => {
  const client = fakeClient([
    [{ id: vendorId, role: "vendor" }],
    []
  ]);

  await assert.rejects(
    () => revokeVendorAccessForUser(client, vendorId),
    { statusCode: 409, message: "Vendor access has already been revoked for this account." }
  );
});

test("admin route middleware rejects non-admin callers", () => {
  const middleware = requireAdmin;
  let nextError = null;

  middleware({ user: { id: vendorId, role: "vendor" } }, {}, (error) => {
    nextError = error;
  });

  assert.equal(nextError.statusCode, 403);
  assert.equal(nextError.message, "Insufficient role");
});

test("revoked vendors receive access denied for vendor-only routes", () => {
  const middleware = requireRole("vendor");
  let nextError = null;

  middleware({ user: { id: vendorId, role: "user" } }, {}, (error) => {
    nextError = error;
  });

  assert.equal(nextError.statusCode, 403);
  assert.equal(nextError.message, "Insufficient role");
});
