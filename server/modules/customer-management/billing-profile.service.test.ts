import assert from "node:assert/strict";
import test from "node:test";
import { createBillingProfileService, normalizeBillingProfileInput } from "./billing-profile.service";

const scope = { companyCode: "IGEN" };
const actor = { id: "u1", name: "Admin" };
const profile = { _id: "p1", customerId: "507f1f77bcf86cd799439011", companyCode: "IGEN", legalName: "Công ty A", taxId: "0312345678", address: "1 Nguyễn Huệ", invoiceEmail: "invoice@a.vn", contactName: "An", isDefault: true, status: "active", version: 0 };

test("normalizes required VAT fields", () => {
  assert.deepEqual(normalizeBillingProfileInput({ legalName: " Công ty A ", taxId: " 0312345678 ", address: " 1 Nguyễn Huệ ", invoiceEmail: " INVOICE@A.VN ", contactName: " An " }), { legalName: "Công ty A", taxId: "0312345678", address: "1 Nguyễn Huệ", invoiceEmail: "invoice@a.vn", contactName: "An" });
  assert.throws(() => normalizeBillingProfileInput({ legalName: "", taxId: "", address: "", invoiceEmail: "x" }), /bắt buộc|không hợp lệ/);
});

test("first billing profile becomes default and converts customer to VAT", async () => {
  let created: any; let converted = false;
  const service = createBillingProfileService({
    customer: async () => ({ _id: profile.customerId, status: "active" }), list: async () => [], taxIdCustomers: async () => [],
    clearDefault: async () => undefined, create: async (value: any) => { created = value; return { _id: "p1", ...value }; },
    setCustomerVat: async () => { converted = true; },
  } as any);
  const result = await service.create(scope, profile.customerId, { ...profile, isDefault: false }, actor);
  assert.equal(created.isDefault, true); assert.equal(converted, true); assert.deepEqual(result.warnings, []);
});

test("tax ID reuse returns a warning without blocking creation", async () => {
  const service = createBillingProfileService({
    customer: async () => ({ _id: profile.customerId, status: "active" }), list: async () => [profile], taxIdCustomers: async () => ["other"],
    clearDefault: async () => undefined, create: async (value: any) => ({ _id: "p2", ...value }), setCustomerVat: async () => undefined,
  } as any);
  const result = await service.create(scope, profile.customerId, { ...profile, isDefault: false }, actor);
  assert.equal(result.profile.isDefault, false); assert.equal(result.warnings[0].code, "BILLING_TAX_ID_REUSED");
});
