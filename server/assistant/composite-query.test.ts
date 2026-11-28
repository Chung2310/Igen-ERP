import { describe, expect, it } from "vitest";
import { ASSISTANT_OPERATIONS, defaultWorkflow, operationById } from "./catalog";
import { projectCompositeSourceData, publicCompositeResultTree, validateCompositeQueryPlan, validateCompositeRequestCoverage } from "./composite-query";

const workflows = ["employee.list", "hr.calendar.events.list", "employee.create"].map(id => defaultWorkflow(operationById(id)!));

describe("multi-API read plan", () => {
  it("allows only enabled read workflows and normalizes workflow input aliases", () => {
    const result = validateCompositeQueryPlan([
      { actionId: "employee.list", purpose: "employee count context", values: {}, resultFields: ["displayName"] },
      { actionId: "hr.calendar.events.list", purpose: "calendar events", values: { query_rangeStart: "2026-11-01" }, resultFields: ["title", "startDate"] },
    ], workflows);

    expect(result, JSON.stringify(result)).toMatchObject({ ok: true });
    if (result.ok) expect(result.queries[1].values).toEqual({ rangeStart: "2026-11-01" });
  });

  it("rejects write operations and private result fields before dispatch", () => {
    const write = validateCompositeQueryPlan([
      { actionId: "employee.list", purpose: "records", values: {}, resultFields: ["displayName"] },
      { actionId: "employee.create", purpose: "create", values: { displayName: "A" }, resultFields: ["displayName"] },
    ], workflows);
    const privateField = validateCompositeQueryPlan([
      { actionId: "employee.list", purpose: "records", values: {}, resultFields: ["displayName", "id"] },
      { actionId: "hr.calendar.events.list", purpose: "events", values: {}, resultFields: ["title"] },
    ], workflows);

    expect(write).toMatchObject({ ok: false });
    expect(privateField).toMatchObject({ ok: false });
  });

  it("requires each query condition to be present in the selected workflow values", () => {
    const valid = validateCompositeQueryPlan([
      { actionId: "employee.list", purpose: "employees", values: {}, resultFields: ["displayName"] },
      { actionId: "hr.calendar.events.list", purpose: "events", values: { rangeStart: "2026-11-01" }, resultFields: ["title", "startDate"] },
    ], workflows);
    expect(valid, JSON.stringify(valid)).toMatchObject({ ok: true });
    if (!valid.ok) return;

    expect(validateCompositeRequestCoverage("Tổng hợp sự kiện từ ngày 1/11", [
      { evidence: "Tổng hợp", requirement: "tổng hợp dữ liệu", mappedTo: ["action"] },
      { evidence: "từ ngày 1/11", requirement: "bắt đầu trong ngày đã nêu", mappedTo: ["query:hr.calendar.events.list:values.rangeStart"] },
    ], valid.queries, workflows)).toEqual({ ok: true });

    expect(validateCompositeRequestCoverage("Tổng hợp sự kiện từ ngày 1/11", [
      { evidence: "từ ngày 1/11", requirement: "bắt đầu trong ngày đã nêu", mappedTo: ["query:hr.calendar.events.list:values.rangeStart"] },
    ], [valid.queries[0], { ...valid.queries[1], values: {} }], workflows)).toMatchObject({ ok: false });
  });

  it("validates requirements answered across the active clarification turns", () => {
    const plan = validateCompositeQueryPlan([
      { actionId: "employee.list", purpose: "employee records", values: {}, resultFields: ["displayName"] },
      { actionId: "hr.calendar.events.list", purpose: "events in the selected period", values: { rangeStart: "2026-11-01" }, resultFields: ["title", "startDate"] },
    ], workflows);
    expect(plan).toMatchObject({ ok: true });
    if (!plan.ok) return;

    const result = validateCompositeRequestCoverage("tháng 11/2026", [
      { evidence: "Tổng hợp lịch sự kiện", requirement: "Tổng hợp các sự kiện", mappedTo: ["action"] },
      { evidence: "tháng 11/2026", requirement: "Giới hạn dữ liệu theo tháng 11/2026", mappedTo: ["query:hr.calendar.events.list:values.rangeStart"] },
    ], plan.queries, workflows, undefined, ["tháng 11/2026", "Tổng hợp lịch sự kiện trong tháng nào?"]);

    expect(result).toEqual({ ok: true });
  });

  it("projects selected fields and declared nested output fields only", () => {
    const operation = {
      ...operationById("hr.calendar.events.list")!,
      resultFields: ["title", "startDate", "participants"],
      resultChildFields: { participants: ["displayName", "employeeId"] },
    };
    const result = projectCompositeSourceData([{
      title: "Team sync",
      startDate: "2026-11-01",
      description: "private free text",
      participants: [{ displayName: "Linh", employeeId: "internal-123", password: "secret" }],
    }], ["title", "startDate", "participants"], operation);

    expect(result).toEqual([{ title: "Team sync", startDate: "2026-11-01", participants: [{ displayName: "Linh" }] }]);
  });

  it("keeps public nested sales metrics needed to summarize retail reports", () => {
    const operation = operationById("retail.report.summary")!;
    const result = projectCompositeSourceData([{
      range: { from: "2026-11-01", to: "2026-11-30", branchId: "private-branch-id" },
      summary: { netSales: 1200, collectedAmount: 900, dueAmount: 300, grossProfit: 400, internalCostRows: 9 },
      paymentMix: [{ method: "cash", amount: 500 }, { method: "bank_transfer", amount: 400, accountId: "private-account" }],
      timeSeries: [{ businessDate: "2026-11-25", netSales: 1200, orderCount: 2, orderIds: ["private-order-id"] }],
      products: [{ sku: "SKU-1", productName: "Phone", netQuantity: 2, netSales: 1200, profit: 400, productId: "private-product-id" }],
    }], ["range", "summary", "paymentMix", "timeSeries", "products"], operation);

    expect(result).toEqual([{
      range: { from: "2026-11-01", to: "2026-11-30" },
      summary: { netSales: 1200, collectedAmount: 900, dueAmount: 300, grossProfit: 400 },
      paymentMix: [{ method: "cash", amount: 500 }, { method: "bank_transfer", amount: 400 }],
      timeSeries: [{ businessDate: "2026-11-25", netSales: 1200, orderCount: 2 }],
      products: [{ sku: "SKU-1", productName: "Phone", netQuantity: 2, netSales: 1200, profit: 400 }],
    }]);
  });

  it("exposes only public nested field names to report analysis", () => {
    const operation = {
      ...operationById("hr.calendar.events.list")!,
      resultChildFields: { participants: ["displayName", "employeeId", "token"] },
    };

    expect(publicCompositeResultTree(operation, "participants")).toEqual(["displayName"]);
  });

  it("defaults metadata consistently for the exact operations used by a plan", () => {
    expect(ASSISTANT_OPERATIONS.find(operation => operation.id === "employee.list")?.assistantMetadata?.intent).toBe("lookup");
    expect(ASSISTANT_OPERATIONS.find(operation => operation.id === "hr.calendar.events.list")?.assistantMetadata?.intent).toBe("lookup");
  });
});
