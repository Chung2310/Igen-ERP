import assert from "node:assert/strict";
import test from "node:test";
import { getPartnerActionVisibility } from "./partnerAccess";

test("read-only partner users can export but cannot mutate", () => {
  assert.deepEqual(getPartnerActionVisibility(false), {
    configureCommission: false,
    importPartners: false,
    createPartner: false,
    editPartner: false,
    payCommission: false,
    deletePartner: false,
    exportPartners: true,
  });
});

test("partner managers can use every action", () => {
  assert.ok(Object.values(getPartnerActionVisibility(true)).every(Boolean));
});
