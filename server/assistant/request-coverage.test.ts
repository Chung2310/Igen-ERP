import { describe, expect, it } from "vitest";
import type { AssistantWorkflow } from "../../src/shared/assistant-workflow";
import { ASSISTANT_OPERATIONS, defaultWorkflow, type AssistantOperation } from "./catalog";
import { validateRequestCoverage } from "./request-coverage";

const workflow: AssistantWorkflow = {
  actionId: "partner.list",
  title: "Tra cứu đối tác",
  module: "retail",
  description: "Tra cứu đối tác",
  fields: [
    { key: "search", label: "Tên đối tác", type: "text", source: "query", apiKey: "search" },
    { key: "createdFrom", label: "Từ ngày", type: "date", source: "query", apiKey: "createdFrom" },
  ],
  enabled: true,
  instructions: "",
  requireConfirmation: false,
  confirmationLocked: false,
  version: 1,
};

const operation: AssistantOperation = {
  id: workflow.actionId,
  title: workflow.title,
  description: workflow.description,
  module: "retail",
  permissions: [],
  method: "GET",
  path: "/partners",
  fields: workflow.fields,
  link: "/partners",
  resultFields: ["name"],
  analysis: { fields: { actualReferrals: { label: "Số lao động được giới thiệu", type: "number" } } },
};

describe("validateRequestCoverage", () => {
  it("requires an explicit clause map", () => {
    expect(validateRequestCoverage("Tìm đối tác", undefined, workflow, operation, {})).toMatchObject({ ok: false });
  });

  it("requires evidence to come from the current request", () => {
    expect(validateRequestCoverage("Tìm đối tác", [
      { evidence: "xóa dữ liệu", requirement: "Xóa dữ liệu", mappedTo: ["action"] },
    ], workflow, operation, {})).toMatchObject({ ok: false });
  });

  it("accepts exact evidence from the active clarification thread when the server provides that context", () => {
    const result = validateRequestCoverage("tháng 11", [
      { evidence: "Tổng hợp báo cáo đối tác", requirement: "Yêu cầu lập báo cáo đối tác", mappedTo: ["action"] },
      { evidence: "tháng 11", requirement: "Kỳ báo cáo tháng 11", mappedTo: ["values.createdFrom"] },
    ], workflow, operation, { createdFrom: "2026-11-01" }, [
      "tháng 11",
      "Tổng hợp báo cáo đối tác theo tháng",
    ]);
    expect(result).toEqual({ ok: true });
  });

  it("rejects a condition mapped to an unsupported field", () => {
    expect(validateRequestCoverage("Tìm đối tác tên An", [
      { evidence: "tên An", requirement: "Lọc theo tên An", mappedTo: ["values.customerName"] },
    ], workflow, operation, {})).toMatchObject({ ok: false });
  });

  it("accepts a requested nested output field declared by a read-only report", () => {
    const leaveOperation = ASSISTANT_OPERATIONS.find(item => item.id === "leave.balances.list")!;
    const leaveWorkflow = defaultWorkflow(leaveOperation);
    expect(validateRequestCoverage("Thống kê lượt nghỉ phép còn lại của các nhân sư", [
      { evidence: "lượt nghỉ phép còn lại", requirement: "Hiển thị số ngày phép năm còn lại", mappedTo: ["result.balances.remaining"] },
    ], leaveWorkflow, leaveOperation, {})).toEqual({ ok: true });
  });

  it("rejects a nested output field that the report does not declare", () => {
    const leaveOperation = ASSISTANT_OPERATIONS.find(item => item.id === "leave.balances.list")!;
    const leaveWorkflow = defaultWorkflow(leaveOperation);
    expect(validateRequestCoverage("Thống kê phép năm", [
      { evidence: "phép năm", requirement: "Hiển thị mã nội bộ", mappedTo: ["result.balances.employeeId"] },
    ], leaveWorkflow, leaveOperation, {})).toMatchObject({ ok: false });
  });

  it.each(["context.module", "values.module"])("treats a compatible module phrase as context (%s)", target => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.path === "/worker-management/partners/kpi")!;
    const partnerWorkflow = defaultWorkflow(operation);
    const periodField = partnerWorkflow.fields.find(field => field.apiKey === "periodAnchor")!;
    const result = validateRequestCoverage(
      "Trong quản lí lao động, Đối tác nào giới thiệu được nhiều lao động nhất trong tháng",
      [
        { evidence: "Trong quản lí lao động", requirement: "Phân hệ quản lý lao động", mappedTo: [target] },
        { evidence: "Đối tác nào", requirement: "Tra cứu đối tác", mappedTo: ["action"] },
        { evidence: "nhiều lao động nhất", requirement: "Xếp theo số lao động được giới thiệu cao nhất", mappedTo: ["analysis.extreme.actualReferrals"] },
        { evidence: "trong tháng", requirement: "Kỳ tháng hiện tại", mappedTo: [`values.${periodField.key}`] },
      ],
      partnerWorkflow,
      operation,
      {
        [periodField.key]: "2026-11-01",
        analysis: JSON.stringify({ extreme: { field: "actualReferrals", direction: "max" } }),
      },
    );
    expect(result).toEqual({ ok: true });
  });

  it.each(["Trong quản lí lao động", "Trong quản lý lao động"])("recognizes both spellings of the labor module label: %s", evidence => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.path === "/worker-management/partners/kpi")!;
    const partnerWorkflow = defaultWorkflow(operation);
    expect(validateRequestCoverage(evidence, [
      { evidence, requirement: "Ngữ cảnh phân hệ lao động", mappedTo: ["context.module"] },
    ], partnerWorkflow, operation, {})).toEqual({ ok: true });
  });

  it.each([
    { mappedTo: [], unresolved: true },
    { mappedTo: ["values.module"] },
    { mappedTo: ["values.query_periodAnchor"] },
  ])("resolves a compatible module phrase even when the model mapping is wrong or missing (%j)", mapping => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.path === "/worker-management/partners/kpi")!;
    const partnerWorkflow = defaultWorkflow(operation);
    const evidence = "Trong quản lí lao động";
    expect(validateRequestCoverage(evidence, [
      { evidence, requirement: "Phân hệ quản lý lao động", ...mapping },
    ], partnerWorkflow, operation, {})).toEqual({ ok: true });
  });

  it("does not treat a conflicting module phrase as a compatible context", () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.path === "/worker-management/partners/kpi")!;
    const partnerWorkflow = defaultWorkflow(operation);
    expect(validateRequestCoverage("Trong quản lí học viên, xem đối tác", [
      { evidence: "Trong quản lí học viên", requirement: "Phân hệ quản lý học viên", mappedTo: ["context.module"] },
    ], partnerWorkflow, operation, {})).toMatchObject({ ok: false, clarification: expect.stringContaining("phân hệ khác") });
  });

  it("rejects a ranking target that is absent from the report plan", () => {
    expect(validateRequestCoverage("Đối tác nhiều nhất", [
      { evidence: "nhiều nhất", requirement: "Xếp theo số lượt", mappedTo: ["analysis.extreme.actualReferrals"] },
    ], workflow, operation, { analysis: JSON.stringify({ sort: { field: "name", direction: "asc" } }) })).toMatchObject({ ok: false });
  });

  it("accepts a request when every clause maps to a represented field or analysis plan", () => {
    const request = "Đối tác giới thiệu nhiều lao động nhất trong tháng";
    const values = {
      search: "Đối tác",
      createdFrom: "2026-11-01",
      analysis: JSON.stringify({
        extreme: { field: "actualReferrals", direction: "max" },
      }),
    };
    const result = validateRequestCoverage(request, [
      { evidence: "Đối tác", requirement: "Xem đối tác", mappedTo: ["action", "values.search"] },
      { evidence: "nhiều lao động nhất", requirement: "Xếp theo số lao động được giới thiệu, cao nhất trước", mappedTo: ["analysis.extreme.actualReferrals"] },
      { evidence: "trong tháng", requirement: "Giới hạn theo tháng hiện tại", mappedTo: ["values.createdFrom"] },
    ], workflow, operation, values);
    expect(result).toEqual({ ok: true });
  });

  it("does not confuse the workers being reported with the worker module name", () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "worker.report")!;
    const workerWorkflow = defaultWorkflow(operation);
    const request = "Báo cáo tình hình chấm công các lao động hôm nay";

    expect(validateRequestCoverage(request, [
      { evidence: "các lao động", requirement: "Đối tượng được báo cáo là lao động", mappedTo: ["context.module"] },
    ], workerWorkflow, operation, {})).toEqual({ ok: true });
  });

  it("rejects an explicit unresolved requirement", () => {
    expect(validateRequestCoverage("Tìm đối tác theo khu vực", [
      { evidence: "theo khu vực", requirement: "Lọc theo khu vực", mappedTo: [], unresolved: true, clarification: "Bạn muốn khu vực nào?" },
    ], workflow, operation, {})).toEqual({ ok: false, clarification: "Bạn muốn khu vực nào?" });
  });
});
