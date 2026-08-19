import assert from "node:assert/strict";
import test from "node:test";
import { formatRetailCustomerCode, normalizeCustomerInput, customerCompanyFilter, resolveCustomerTier, normalizeTierOverride, resolveEffectiveCustomerTier, summarizeCustomerTiers, buildCustomerTierFilterPipeline } from "./retail-customer-tier-api.service";

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

test("manual tier overrides require reason and a future valid interval", () => {
  const now = new Date("2026-08-12T00:00:00Z");
  assert.deepEqual(normalizeTierOverride({ tierCode: " vip ", reason: " Chăm sóc đặc biệt ", effectiveFrom: "2026-08-12", effectiveTo: "2026-09-12" }, now), { tierCode: "vip", reason: "Chăm sóc đặc biệt", effectiveFrom: new Date("2026-08-12T00:00:00.000Z"), effectiveTo: new Date("2026-09-12T23:59:59.999Z") });
  assert.throws(() => normalizeTierOverride({ tierCode: "vip", reason: "", effectiveFrom: "2026-08-12", effectiveTo: "2026-09-12" }, now));
  assert.throws(() => normalizeTierOverride({ tierCode: "vip", reason: "x", effectiveFrom: "2026-09-12", effectiveTo: "2026-08-12" }, now));
});

test("expired manual override falls back to the automatic tier", () => {
  const automatic = { code: "member", name: "Member", minSpend: 0 };
  const active = { source: "manual", toTierCode: "vip", toTierName: "VIP", effectiveFrom: new Date("2026-08-01"), effectiveTo: new Date("2026-08-31") };
  assert.equal(resolveEffectiveCustomerTier(automatic, [active], new Date("2026-08-12")).code, "vip");
  assert.equal(resolveEffectiveCustomerTier(automatic, [active], new Date("2026-09-01")).code, "member");
});

test("tier summary reports customer counts net sales and order frequency", () => {
  assert.deepEqual(summarizeCustomerTiers([{ tierCode: "vip", netSales: 300, orderCount: 3 }, { tierCode: "vip", netSales: 100, orderCount: 1 }, { tierCode: "member", netSales: 50, orderCount: 1 }]), [
    { tierCode: "member", customerCount: 1, netSales: 50, orderCount: 1, averageOrderFrequency: 1 },
    { tierCode: "vip", customerCount: 2, netSales: 400, orderCount: 4, averageOrderFrequency: 2 },
  ]);
});

test("tier filters prefer an active manual override over newer automatic history", () => {
  const pipeline: any[] = buildCustomerTierFilterPipeline(
    { companyCode: "ACME", branchId: "B1" }, "vip", new Date("2026-08-12T00:00:00Z"),
  );
  assert.deepEqual(pipeline[1], { $addFields: { sourcePriority: { $cond: [{ $eq: ["$source", "manual"] }, 1, 0] } } });
  assert.deepEqual(pipeline[2], { $sort: { sourcePriority: -1, changedAt: -1 } });
  assert.deepEqual(pipeline.at(-1), { $match: { tierCode: "vip" } });
});
