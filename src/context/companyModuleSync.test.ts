import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCompanyModulesEvent } from "./companyModuleSync";

test("normalizes company code and keeps unique valid module keys in canonical order", () => {
  assert.deepEqual(
    normalizeCompanyModulesEvent({ companyCode: " acme ", enabledModules: ["chat", "hr", "chat", "unknown"] }),
    { companyCode: "ACME", enabledModules: ["hr", "chat"] },
  );
});

test("rejects malformed module update events and accepts an explicit empty grant", () => {
  assert.equal(normalizeCompanyModulesEvent(null), null);
  assert.equal(normalizeCompanyModulesEvent({ companyCode: "", enabledModules: ["hr"] }), null);
  assert.equal(normalizeCompanyModulesEvent({ companyCode: "ACME", enabledModules: "hr" }), null);
  assert.deepEqual(normalizeCompanyModulesEvent({ companyCode: "ACME", enabledModules: [] }), { companyCode: "ACME", enabledModules: [] });
  assert.equal(normalizeCompanyModulesEvent({ companyCode: "ACME", enabledModules: ["unknown"] }), null);
});
