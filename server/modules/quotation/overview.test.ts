import { describe, expect, it } from "vitest";
import { summarizeQuotationOverview } from "./overview";

describe("quotation overview", () => {
  it("groups real documents and keeps currencies separate", () => {
    const result = summarizeQuotationOverview("2026-11-01", "2026-11-30", [
      { kind: "customer", status: "approved", total: 10_000_000, currency: "VND", customerName: "An", createdAt: new Date("2026-11-02T02:00:00Z"), lines: [{ name: "Máy tính", quantity: 2, unit: "bộ" }] },
      { kind: "estimate", status: "pending_review", total: 100, currency: "USD", customerName: "Bình", createdAt: new Date("2026-11-02T18:00:00Z"), lines: [{ name: "Máy tính", quantity: 1, unit: "bộ" }] },
      { kind: "customer", status: "needs_info", total: 0, totalUnknown: true, currency: "VND", customerName: "An", createdAt: new Date("2026-11-03T01:00:00Z"), lines: [] },
    ], [{ status: "signed" }, { status: "draft" }], [{ status: "completed" }]);
    expect(result.quotes.total).toBe(3);
    expect(result.quotes.byKind).toEqual({ customer: 2, estimate: 1 });
    expect(result.quotes.values).toEqual([
      { currency: "USD", customer: 0, estimate: 100, approvedCustomer: 0, approvedEstimate: 0 },
      { currency: "VND", customer: 10_000_000, estimate: 0, approvedCustomer: 10_000_000, approvedEstimate: 0 },
    ]);
    expect(result.quotes.trend).toEqual([
      { date: "2026-11-02", count: 1, approved: 1 },
      { date: "2026-11-03", count: 2, approved: 0 },
    ]);
    expect(result.quotes.customers[0]).toEqual({ name: "An", count: 2 });
    expect(result.quotes.products).toEqual([{ name: "Máy tính · bộ", quantity: 3 }]);
    expect(result.contracts).toEqual({ total: 2, draft: 1, signed: 1 });
    expect(result.acceptances).toEqual({ total: 1, draft: 0, completed: 1 });
  });

  it("omits document metrics when their read permission is absent", () => {
    const result = summarizeQuotationOverview("2026-11-01", "2026-11-30", [], null, null);
    expect(result.contracts).toBeNull();
    expect(result.acceptances).toBeNull();
  });
});
