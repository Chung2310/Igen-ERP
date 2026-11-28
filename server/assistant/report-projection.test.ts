import { describe, expect, it } from "vitest";
import { ASSISTANT_OPERATIONS, operationById } from "./catalog";
import { projectRecords } from "./executor";
import { formatAssistantResult } from "./result-format";

const project = (operationId: string, data: unknown, input: Record<string, unknown> = {}) => {
  const operation = operationById(operationId)!;
  return projectRecords(operation, { status: "success", data }, {} as any, input as any);
};

describe("assistant report envelope projection", () => {
  it("preserves approved nested fields from the retail summary API envelope", () => {
    const rows = project("retail.report.summary", {
      range: { from: "2026-11-26", to: "2026-11-26", branchId: "private-branch" },
      summary: { grossSales: 102900000, netSales: 100000000, orderCount: 3, grossProfit: 12000000, internalNote: "secret" },
      paymentMix: [{ method: "cash", amount: 40000000, bankAccountId: "private-account" }],
      timeSeries: [{ businessDate: "2026-11-26", grossSales: 102900000, orderCount: 3, orderIds: ["private-order"] }],
      products: [{ sku: "SKU-1", productName: "Điện thoại", netQuantity: 2, netSales: 102900000, productId: "private-product" }],
    });

    expect(rows).toEqual([{
      range: { from: "2026-11-26", to: "2026-11-26" },
      summary: { grossSales: 102900000, netSales: 100000000, orderCount: 3, grossProfit: 12000000 },
      paymentMix: [{ method: "cash", amount: 40000000 }],
      timeSeries: [{ businessDate: "2026-11-26", grossSales: 102900000, orderCount: 3 }],
      products: [{ sku: "SKU-1", productName: "Điện thoại", netQuantity: 2, netSales: 102900000 }],
    }]);
    expect(JSON.stringify(rows)).not.toMatch(/private-(?:branch|account|order|product)|internalNote/);
  });

  it("projects the daily retail report alias through the shared summary contract", () => {
    const rows = project("retail.report.daily.summary", {
      range: { from: "2026-11-27", to: "2026-11-27", branchId: "private-branch" },
      summary: { orderCount: 3, collectedAmount: 46000000, grossProfit: 34900000, internalNote: "secret" },
      paymentMix: [{ method: "cash", amount: 40000000, bankAccountId: "private-account" }],
    });

    expect(rows).toEqual([{
      range: { from: "2026-11-27", to: "2026-11-27" },
      summary: { orderCount: 3, collectedAmount: 46000000, grossProfit: 34900000 },
      paymentMix: [{ method: "cash", amount: 40000000 }],
    }]);
    expect(JSON.stringify(rows)).not.toMatch(/private-|internalNote/);
  });

  it("keeps the composite class attendance summary as one report row", () => {
    const rows = project("student.batch.attendance.summary", {
      className: "Excel căn bản - lớp buổi tối",
      date: "2026-11-27",
      startTime: "19:00",
      absent: 1,
      absentStudents: "Đặng Minh Khoa",
      remainingSlots: 4,
    });

    expect(rows).toEqual([{
      className: "Excel căn bản - lớp buổi tối",
      date: "2026-11-27",
      startTime: "19:00",
      absent: 1,
      absentStudents: "Đặng Minh Khoa",
      remainingSlots: 4,
    }]);
  });

  it("preserves both comparison periods for composite report synthesis", () => {
    const rows = project("retail.report.compare", {
      current: { from: "2026-11-01", to: "2026-11-26", grossSales: 900, netSales: 850, orderCount: 9, branchId: "private" },
      previous: { from: "2026-10-01", to: "2026-10-26", grossSales: 700, netSales: 660, orderCount: 7, customerIds: ["private"] },
      debug: "hidden",
    });

    expect(rows).toEqual([{
      current: { from: "2026-11-01", to: "2026-11-26", grossSales: 900, netSales: 850, orderCount: 9 },
      previous: { from: "2026-10-01", to: "2026-10-26", grossSales: 700, netSales: 660, orderCount: 7 },
    }]);
    expect(JSON.stringify(rows)).not.toContain("private");
  });

  it("preserves profit totals and SKU rows without internal properties", () => {
    const operation = ASSISTANT_OPERATIONS.find(candidate => candidate.path === "/retail/finance/profit")!;
    const rows = project(operation.id, {
      from: "2026-11-01", to: "2026-11-26",
      summary: { revenue: 1000, knownCost: 600, grossProfit: 400, operatingExpense: 50, commissionExpense: 10, netProfit: 340, missingCostCount: 1, privateLedgerId: "private" },
      bySku: [{ sku: "SKU-2", productName: "Máy tính", quantity: 2, revenue: 1000, cost: 600, grossProfit: 400, missingCostCount: 0, supplierId: "private" }],
    });

    expect(rows).toEqual([{
      from: "2026-11-01", to: "2026-11-26",
      summary: { revenue: 1000, knownCost: 600, grossProfit: 400, operatingExpense: 50, commissionExpense: 10, netProfit: 340, missingCostCount: 1 },
      bySku: [{ sku: "SKU-2", productName: "Máy tính", quantity: 2, revenue: 1000, cost: 600, grossProfit: 400, missingCostCount: 0 }],
    }]);
    expect(JSON.stringify(rows)).not.toContain("private");
  });

  it("projects receipt line items through the approved child field schema", () => {
    const rows = project("inventory.receipt.list", { items: [{
      receiptCode: "PN-001", status: "confirmed", supplierName: "Nhà cung cấp A", orderCode: "PO-001",
      subtotal: 60000000, receivedAt: "2026-11-20T03:00:00.000Z", notes: "Hàng mới",
      items: [{ productName: "iPhone 14", sku: "IP14-128", quantity: 2, unitCost: 30000000, lineTotal: 60000000, productId: "private-product" }],
      _id: "private-receipt",
    }] });

    expect(rows).toEqual([{
      receiptCode: "PN-001", status: "confirmed", supplierName: "Nhà cung cấp A", orderCode: "PO-001",
      subtotal: 60000000, receivedAt: "2026-11-20T03:00:00.000Z", notes: "Hàng mới",
      items: [{ productName: "iPhone 14", sku: "IP14-128", quantity: 2, unitCost: 30000000, lineTotal: 60000000 }],
    }]);
    expect(JSON.stringify(rows)).not.toContain("private-");
  });

  it("projects the retail collaborator statement as one approved report row", () => {
    const operation = ASSISTANT_OPERATIONS.find(candidate => candidate.path === "/retail/finance/commission/partners/:id/statement")!;
    const rows = projectRecords(operation, { status: "success", data: {
      entries: [{ businessDate: "2026-11-05", sourceCode: "DH-001", reason: "Bán điện thoại", amount: 300000, ledgerId: "private-ledger" }],
      payouts: [{ amount: 100000, account: "cash", reference: "PC-001", businessDate: "2026-11-10", bankAccountNo: "private-account" }],
      balance: 200000, earned: 300000, reversed: 0, paid: 100000, partnerId: "private-partner",
    } }, {} as any);

    expect(rows).toEqual([{
      entries: [{ businessDate: "2026-11-05", sourceCode: "DH-001", reason: "Bán điện thoại", amount: 300000 }],
      payouts: [{ amount: 100000, account: "cash", reference: "PC-001", businessDate: "2026-11-10" }],
      balance: 200000, earned: 300000, reversed: 0, paid: 100000,
    }]);
    expect(JSON.stringify(rows)).not.toContain("private-");
  });

  it("summarizes net profit and states when missing costs prevent a final figure", () => {
    const operation = ASSISTANT_OPERATIONS.find(candidate => candidate.path === "/retail/finance/profit")!;
    const complete = formatAssistantResult(operation, { data: {
      from: "2026-11-01", to: "2026-11-30",
      summary: { revenue: 1000, knownCost: 600, grossProfit: 400, operatingExpense: 50, commissionExpense: 10, netProfit: 340, missingCostCount: 0 },
    } });
    const incomplete = formatAssistantResult(operation, { data: {
      from: "2026-11-01", to: "2026-11-30",
      summary: { revenue: 1000, knownCost: 600, grossProfit: null, operatingExpense: 50, commissionExpense: 10, netProfit: null, missingCostCount: 1 },
    } });

    expect(complete).toContain("Lợi nhuận ròng trong kỳ: 340 ₫");
    expect(complete).toContain("Chi phí hoạt động");
    expect(incomplete).toContain("Chưa xác định được lợi nhuận ròng do còn thiếu giá vốn");
    expect(incomplete).toContain("Thiếu giá vốn ở 1 dòng");
  });

  it("filters leave balances by employee name locally and declares the filter assistant-only", () => {
    const rows = project("leave.balances.list", { year: 2026, balances: [
      { employeeName: "Nguyễn An", department: "Kế toán", entitlement: 12, used: 4, pending: 0, unexcused: 0, remaining: 8 },
      { employeeName: "Trần Bình", department: "Kinh doanh", entitlement: 12, used: 8, pending: 1, unexcused: 0, remaining: 3 },
    ] }, { query_search: "nguyễn an" });
    const operation = operationById("leave.balances.list")!;

    expect(rows[0]).toMatchObject({ balances: [{ employeeName: "Nguyễn An", remaining: 8 }] });
    expect(operation.assistantOnlyFields).toContain("query_search");
    expect(operation.fields.find(field => field.key === "query_search")?.source).toBe("query");
  });

  it("matches any explicitly named employee in a leave balance request", () => {
    const rows = project("leave.balances.list", { year: 2026, balances: [
      { employeeName: "Nam Văn Tú", entitlement: 12, used: 3, pending: 0, unexcused: 0, remaining: 9 },
      { employeeName: "Trần Quốc Bảo", entitlement: 12, used: 8, pending: 1, unexcused: 0, remaining: 3 },
      { employeeName: "Nguyễn An", entitlement: 12, used: 4, pending: 0, unexcused: 0, remaining: 8 },
    ] }, { query_search: "Nam Văn Tú|Trần Quốc Bảo" });

    expect(rows[0]).toMatchObject({ year: 2026, balances: [
      { employeeName: "Nam Văn Tú", remaining: 9 },
      { employeeName: "Trần Quốc Bảo", remaining: 3 },
    ] });
  });
});
