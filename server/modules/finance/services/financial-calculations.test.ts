import { describe, expect, it } from "vitest";
import { breakEven, debtAging, financeRange, financeToday, moneyInput, profitTotals, retailFinancialMovements, validDay, vatTotals } from "./financial-calculations";
describe("financial calculations", () => {
  it("uses Vietnamese midnight and correct leap/month/quarter/year boundaries", () => {
    expect(financeToday(new Date("2026-09-22T17:00:00Z"))).toBe("2026-09-23");
    expect(financeRange({ period: "2024-02" }).to).toBe("2024-02-29");
    expect(financeRange({ period: "2026-Q4" })).toMatchObject({ from: "2026-10-01", to: "2026-12-31" });
    expect(financeRange({ period: "2026" }).start.toISOString()).toBe("2025-12-31T17:00:00.000Z");
    for (const input of [{ period: "2026-13" }, { period: "2026-Q5" }, { from: "2026-02-30", to: "2026-03-01" }, { from: "2026-03-02", to: "2026-03-01" }]) expect(() => financeRange(input)).toThrow();
    expect(() => validDay("2026-02-29")).toThrow();
    for (const input of [null, "", -1, 1.2, Infinity, "abc"]) expect(() => moneyInput(input)).toThrow();
  });
  it("separates not due, due today and all overdue age boundaries", () => {
    const asOf = "2026-09-23";
    expect(debtAging(undefined, asOf).bucket).toBe("unscheduled");
    expect(debtAging("2026-09-28", asOf)).toMatchObject({ bucket: "notDue", daysUntilDue: 5 });
    expect(debtAging(asOf, asOf).bucket).toBe("dueToday");
    for (const [days, bucket] of [[1, "1-30"], [30, "1-30"], [31, "31-60"], [60, "31-60"], [61, "61-90"], [90, "61-90"], [91, "over90"]] as const) expect(debtAging(new Date(+new Date(asOf) - days * 86400000).toISOString().slice(0, 10), asOf).bucket).toBe(bucket);
  });
  it("computes VAT from deductible amounts, opening credit and signed adjustments", () => {
    const rows = [{ direction: "input", taxableAmount: 18000000, vatAmount: 1800000, deductibleVat: 1500000 }, { direction: "output", taxableAmount: 16500000, vatAmount: 1650000, deductibleVat: 0 }];
    expect(vatTotals(rows, 0)).toMatchObject({ payable: 150000, closingCredit: 0, nonDeductibleVat: 300000 });
    expect(vatTotals(rows, 500000)).toMatchObject({ payable: 0, closingCredit: 350000 });
    expect(vatTotals([...rows, { direction: "input", taxableAmount: -1000000, vatAmount: -100000, deductibleVat: -100000 }], 0).payable).toBe(250000);
  });
  const order = { _id: "o1", orderCode: "DH1", confirmedAt: "2026-09-01T03:00:00Z", grandTotal: 16500000, taxAmount: 0, totalCost: 18000000, shippingFee: 0, items: [{ sku: "PHONE", lineTotal: 16500000, unitCost: 18000000, quantity: 1, trackingMode: "serial" }] };
  it("retains a 1.5 million loss and does not expense it twice", () => {
    const movements = retailFinancialMovements([order], [], { from: "2026-09-01", to: "2026-09-30" });
    expect(movements[0].grossProfit).toBe(-1500000);
    expect(profitTotals(movements, [{ category: "rent", amount: 5000000 }, { category: "payroll", amount: 10000000 }])).toMatchObject({ revenue: 16500000, costOfGoods: 18000000, grossProfit: -1500000, netProfit: -16500000 });
  });
  it("allocates order discount per product while preserving integer totals", () => {
    const movements = retailFinancialMovements([{ ...order, grandTotal: 21, taxAmount: 1, shippingFee: 2, items: [{ sku: "A", lineTotal: 10, unitCost: 15, quantity: 1 }, { sku: "B", lineTotal: 10, unitCost: 1, quantity: 1 }] }], [], { from: "2026-09-01", to: "2026-09-30" });
    expect(movements.reduce((sum, row) => sum + row.revenue, 0)).toBe(20);
    expect(movements[0].grossProfit).toBe(-6);
  });
  it("reverses returns in their own period and does not treat buybacks as sales returns", () => {
    const returns = [{ orderId: "o1", code: "TH1", createdAt: "2026-10-01", totalAmount: 16500000, items: [{ orderLineIndex: 0, quantity: 1, unitCost: 18000000 }] }];
    const result = retailFinancialMovements([order], returns, { from: "2026-10-01", to: "2026-10-31" });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ revenue: -16500000, cost: -18000000, grossProfit: 1500000 });
  });
  it("does not reverse a prior return again on cancellation and excludes shipping from return VAT ratio", () => {
    const sale = { ...order, grandTotal: 18250000, taxAmount: 1650000, shippingFee: 100000, cancelledAt: "2026-10-04" };
    const returns = [{ orderId: "o1", code: "TH1", createdAt: "2026-09-03", totalAmount: 18150000, items: [{ orderLineIndex: 0, quantity: 1, unitCost: 18000000 }] }];
    const rows = retailFinancialMovements([sale], returns, { from: "2026-10-01", to: "2026-10-31" });
    expect(rows).toHaveLength(1); expect(rows[0].revenue).toBe(-100000); expect(Math.abs(rows[0].cost)).toBe(0);
    const all = retailFinancialMovements([sale], returns, { from: "2026-09-01", to: "2026-10-31" });
    expect(profitTotals(all, []).netProfit).toBe(0);
  });
  it("calculates contribution break-even, rounds machines up and handles negative margins", () => {
    const plan = { rent: 10000000, payroll: 21000000, expectedUnitPrice: 20000000, expectedUnitCost: 18000000, variableCostPerUnit: 500000 };
    expect(breakEven(plan, [])).toMatchObject({ unitContribution: 1500000, units: 21, revenue: 413333334 });
    expect(breakEven({ ...plan, expectedUnitPrice: 16500000 }, []).units).toBeNull();
    expect(breakEven({ ...plan, expectedUnitPrice: 18000000, variableCostPerUnit: 0 }, []).revenue).toBeNull();
  });
  it("records the first reached date but reports a later loss of break-even", () => {
    const rows = [{ date: "2026-09-02", source: "retail", code: "a", revenue: 30, cost: 15, units: 1 }, { date: "2026-09-03", source: "return", code: "b", revenue: -30, cost: -15, units: -1 }];
    const result = breakEven({ rent: 10, expectedUnitPrice: 30, expectedUnitCost: 15 }, rows);
    expect(result).toMatchObject({ firstReachedOn: "2026-09-02", currentlyReached: false, remaining: 10 });
  });
});

it("uses weighted product mix and reverses estimated variable costs on returns", () => {
  const plan = { rent: 1000, salesMix: [{ segment: "phone", weight: 50, price: 1000, cost: 700, variable: 20, commission: 30 }, { segment: "accessory", weight: 50, price: 100, cost: 50, variable: 10, commission: 0 }] };
  const result = breakEven(plan, [{ date: "2026-01-01", code: "x", source: "retail", revenue: 1100, cost: 750, units: 1, composition: [{ segment: "phone", quantity: 1 }, { segment: "accessory", quantity: 1 }] }, { date: "2026-01-02", code: "y", source: "return", revenue: -100, cost: -50, units: 0, composition: [{ segment: "accessory", quantity: -1 }] }]);
  expect(result.unitContribution).toBe(145); expect(result.units).toBe(7); expect(result.actualContribution).toBe(280);
});
