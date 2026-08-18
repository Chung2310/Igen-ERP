import { describe, expect, it } from "vitest";
import { computeWarrantyEnd, evaluateCoverage, inheritCustomerWarranty, snapshotCoverage, warrantyGapMonths } from "./warranty-clock";

const unit = (overrides: Record<string, unknown> = {}) => ({
  supplierWarranty: { supplierId: "s1", supplierName: "NCC", receiptId: "r1", receiptCode: "GR-1", months: 12, startAt: new Date("2024-01-31"), startSource: "receipt", endAt: new Date("2025-01-31") },
  customerWarranty: { months: 12, startAt: new Date("2024-06-15"), endAt: new Date("2025-06-15"), source: "variant" },
  ...overrides,
} as any);

describe("warranty clock", () => {
  it("clamps month ends and handles leap years", () => {
    expect(computeWarrantyEnd(new Date("2024-01-31"), 1).toISOString()).toBe("2024-02-29T00:00:00.000Z");
    expect(computeWarrantyEnd(new Date("2023-01-31"), 1).toISOString()).toBe("2023-02-28T00:00:00.000Z");
  });

  it.each([
    [true, true, "supplier"], [true, false, "shop"], [false, true, "customer"], [false, false, "customer"],
  ])("calculates cost bearer", (customerCovered, supplierCovered, costBearer) => {
    const result = evaluateCoverage(unit({
      customerWarranty: { ...unit().customerWarranty, endAt: customerCovered ? new Date("2025-06-15") : new Date("2023-06-15") },
      supplierWarranty: { ...unit().supplierWarranty, endAt: supplierCovered ? new Date("2025-01-31") : new Date("2023-01-31") },
    }), new Date("2024-08-01"));
    expect(result.costBearer).toBe(costBearer);
  });

  it("reports the customer commitment gap in months", () => {
    expect(warrantyGapMonths(unit(), new Date("2024-06-15"), 12)).toBe(5);
  });

  it("creates a repair intake snapshot with a fixed checkedAt", () => {
    const checkedAt = new Date("2024-08-01T00:00:00.000Z");
    const snapshot = snapshotCoverage(unit(), checkedAt);
    expect(snapshot.checkedAt).toBe(checkedAt);
    expect(snapshot.supplier.supplierId).toBe("s1");
    expect(snapshot.costBearer).toBe("supplier");
  });

  it("inherits the original customer warranty when replacing a unit", () => {
    const inherited = inheritCustomerWarranty(unit(), "original-1");
    expect(inherited?.endAt.toISOString()).toBe("2025-06-15T00:00:00.000Z");
    expect(inherited?.source).toBe("inherited");
    expect(inherited?.inheritedFromSerialUnitId).toBe("original-1");
  });
});
