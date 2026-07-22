import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCompanyModulesEvent } from "./companyModuleSync";

test("normalizes company code and keeps unique valid module keys in canonical order", () => {
  assert.deepEqual(
    normalizeCompanyModulesEvent({ companyCode: " acme ", enabledModules: ["chat", "hr", "chat", "unknown"] }),
    { companyCode: "ACME", enabledModules: ["hr", "chat"] },
  );
});

test("rejects malformed or empty module update events", () => {
  assert.equal(normalizeCompanyModulesEvent(null), null);
  assert.equal(normalizeCompanyModulesEvent({ companyCode: "", enabledModules: ["hr"] }), null);
  assert.equal(normalizeCompanyModulesEvent({ companyCode: "ACME", enabledModules: "hr" }), null);
  assert.equal(normalizeCompanyModulesEvent({ companyCode: "ACME", enabledModules: [] }), null);
  assert.equal(normalizeCompanyModulesEvent({ companyCode: "ACME", enabledModules: ["unknown"] }), null);
});
