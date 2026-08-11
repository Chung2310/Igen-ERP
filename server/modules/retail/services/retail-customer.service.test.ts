import assert from "node:assert/strict";
import test from "node:test";
import { formatRetailCustomerCode, normalizeCustomerInput, customerCompanyFilter, resolveCustomerTier } from "./retail-customer.service";

test("customer codes use a permanent company-wide sequence", () => {
  assert.equal(formatRetailCustomerCode("acme", 1), "KH-ACME-000001");
  assert.equal(formatRetailCustomerCode("ACME", 1234567), "KH-ACME-1234567");
});

test("customer input normalizes contact values without lifecycle state", () => {
  assert.deepEqual(normalizeCustomerInput({
    name: "  Nguyễn Văn A  ", phone: " 090 123-4567 ", email: " A@Example.COM ", address: "  Q1 ", notes: "  VIP ", status: "active",
  }), {
    name: "Nguyễn Văn A", phone: "090 123-4567", normalizedPhone: "0901234567",
    email: "a@example.com", address: "Q1", notes: "VIP",
  });
});

test("customer queries are company-wide even when created in a branch", () => {
  assert.deepEqual(customerCompanyFilter({ companyCode: "ACME", branchId: "B1" }), { companyCode: "ACME" });
});

test("customer requires a name and rejects empty normalized phone", () => {
  assert.throws(() => normalizeCustomerInput({ name: " " }));
  assert.deepEqual(normalizeCustomerInput({ name: "Khách không SĐT", phone: "" }), {
    name: "Khách không SĐT", phone: undefined, normalizedPhone: undefined,
    email: undefined, address: undefined, notes: undefined,
  });
});

test("customer tier follows configured cumulative net sales thresholds", () => {
  const tiers = [
    { code: "member", name: "Thành viên", minSpend: 0 },
    { code: "gold", name: "Vàng", minSpend: 20_000_000 },
    { code: "vip", name: "VIP", minSpend: 50_000_000 },
  ];
  assert.equal(resolveCustomerTier(19_999_999, tiers).code, "member");
  assert.equal(resolveCustomerTier(20_000_000, tiers).code, "gold");
  assert.equal(resolveCustomerTier(70_000_000, tiers).code, "vip");
});
