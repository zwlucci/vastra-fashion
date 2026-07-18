import test from "node:test";
import assert from "node:assert/strict";
import { buildCodPolicy, COD_DISABLED_MESSAGE } from "../src/utils/codPolicy.js";

test("COD is available with zero refusal records", () => {
  const policy = buildCodPolicy(0);
  assert.equal(policy.codAvailable, true);
  assert.equal(policy.activeRefusalCount, 0);
  assert.equal(policy.status, "available");
});

test("COD stays available with a final warning at two refusal records", () => {
  const policy = buildCodPolicy(2);
  assert.equal(policy.codAvailable, true);
  assert.equal(policy.status, "final_warning");
  assert.match(policy.warning, /Final warning/);
});

test("COD is restricted at three or more refusal records", () => {
  const policy = buildCodPolicy(3);
  assert.equal(policy.codAvailable, false);
  assert.equal(policy.status, "restricted");
  assert.match(COD_DISABLED_MESSAGE, /three previous COD orders/);
});
