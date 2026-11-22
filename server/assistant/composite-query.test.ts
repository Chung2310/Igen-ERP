import { describe, expect, it } from "vitest";
import { ASSISTANT_OPERATIONS, defaultWorkflow, operationById } from "./catalog";
import { projectCompositeSourceData, validateCompositeQueryPlan, validateCompositeRequestCoverage } from "./composite-query";

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
      { evidence: "sự kiện", requirement: "lấy sự kiện", mappedTo: ["query:hr.calendar.events.list:source"] },
      { evidence: "từ ngày 1/11", requirement: "bắt đầu trong ngày đã nêu", mappedTo: ["query:hr.calendar.events.list:values.rangeStart"] },
    ], valid.queries, workflows)).toEqual({ ok: true });

    expect(validateCompositeRequestCoverage("Tổng hợp sự kiện từ ngày 1/11", [
      { evidence: "Tổng hợp", requirement: "tổng hợp dữ liệu", mappedTo: ["action"] },
      { evidence: "sự kiện", requirement: "lấy sự kiện", mappedTo: ["query:hr.calendar.events.list:source"] },
      { evidence: "từ ngày 1/11", requirement: "bắt đầu trong ngày đã nêu", mappedTo: ["query:hr.calendar.events.list:values.rangeStart"] },
    ], [valid.queries[0], { ...valid.queries[1], values: {} }], workflows)).toMatchObject({ ok: false });
  });

  it("rejects a composite plan that silently omits a requested filter", () => {
    const plan = validateCompositeQueryPlan([
      { actionId: "employee.list", purpose: "employees", values: {}, resultFields: ["displayName"] },
      { actionId: "hr.calendar.events.list", purpose: "events", values: { rangeStart: "2026-11-01" }, resultFields: ["title", "startDate"] },
    ], workflows);
    expect(plan).toMatchObject({ ok: true });
    if (!plan.ok) return;

    const result = validateCompositeRequestCoverage("Tổng hợp sự kiện tại Hà Nội từ ngày 1/11", [
      { evidence: "Tổng hợp", requirement: "tổng hợp dữ liệu", mappedTo: ["action"] },
      { evidence: "sự kiện", requirement: "lấy sự kiện", mappedTo: ["query:hr.calendar.events.list:source"] },
      { evidence: "từ ngày 1/11", requirement: "bắt đầu trong ngày đã nêu", mappedTo: ["query:hr.calendar.events.list:values.rangeStart"] },
    ], plan.queries, workflows);

    expect(result).toMatchObject({ ok: false, clarification: expect.stringContaining("Hà Nội") });
  });

  it("requires a composite location condition to map to a source filter", () => {
    const plan = validateCompositeQueryPlan([
      { actionId: "employee.list", purpose: "employees", values: {}, resultFields: ["displayName"] },
      { actionId: "hr.calendar.events.list", purpose: "events", values: { rangeStart: "2026-11-01" }, resultFields: ["title", "startDate"] },
    ], workflows);
    expect(plan).toMatchObject({ ok: true });
    if (!plan.ok) return;

    const result = validateCompositeRequestCoverage("Tổng hợp sự kiện tại Hà Nội từ ngày 1/11", [
      { evidence: "Tổng hợp", requirement: "Tổng hợp dữ liệu", mappedTo: ["action"] },
      { evidence: "sự kiện", requirement: "Lấy sự kiện", mappedTo: ["query:hr.calendar.events.list:source"] },
      { evidence: "tại Hà Nội", requirement: "Chỉ lấy sự kiện ở Hà Nội", mappedTo: ["action"] },
      { evidence: "từ ngày 1/11", requirement: "Bắt đầu trong ngày đã nêu", mappedTo: ["query:hr.calendar.events.list:values.rangeStart"] },
    ], plan.queries, workflows);

    expect(result).toMatchObject({ ok: false, clarification: expect.stringContaining("bộ lọc") });
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

  it("defaults metadata consistently for the exact operations used by a plan", () => {
    expect(ASSISTANT_OPERATIONS.find(operation => operation.id === "employee.list")?.assistantMetadata?.intent).toBe("lookup");
    expect(ASSISTANT_OPERATIONS.find(operation => operation.id === "hr.calendar.events.list")?.assistantMetadata?.intent).toBe("lookup");
  });
});
