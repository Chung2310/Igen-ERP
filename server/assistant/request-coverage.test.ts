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

  it("rejects a condition mapped to an unsupported field", () => {
    expect(validateRequestCoverage("Tìm đối tác tên An", [
      { evidence: "tên An", requirement: "Lọc theo tên An", mappedTo: ["values.customerName"] },
    ], workflow, operation, {})).toMatchObject({ ok: false });
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
        { evidence: "giới thiệu được nhiều lao động nhất", requirement: "Xếp theo số lao động được giới thiệu cao nhất", mappedTo: ["analysis.extreme.actualReferrals"] },
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

  it.each(["dự án lao động", "thêm dự án lao động"])("accepts worker-project wording as module context: %s", evidence => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "worker.project.create")!;
    const workerProjectWorkflow = defaultWorkflow(operation);
    expect(validateRequestCoverage(evidence, [
      { evidence, requirement: "Tạo dự án trong phân hệ lao động", mappedTo: ["context.module"] },
    ], workerProjectWorkflow, operation, {})).toEqual({ ok: true });
  });

  it("accepts HR project wording as module context", () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "project.create")!;
    const projectWorkflow = defaultWorkflow(operation);
    const evidence = "tôi muốn thêm dự án cho nhân sự";
    expect(validateRequestCoverage(evidence, [
      { evidence: "muốn thêm dự án cho nhân sự", requirement: "Tạo dự án cho Nhân sự", mappedTo: ["action"] },
      { evidence: "dự án", requirement: "Tạo dự án trong phân hệ Nhân sự", mappedTo: ["context.module"] },
    ], projectWorkflow, operation, {})).toEqual({ ok: true });
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
      { evidence: "giới thiệu nhiều lao động nhất", requirement: "Xếp theo số lao động được giới thiệu, cao nhất trước", mappedTo: ["analysis.extreme.actualReferrals"] },
      { evidence: "trong tháng", requirement: "Giới hạn theo tháng hiện tại", mappedTo: ["values.createdFrom"] },
    ], workflow, operation, values);
    expect(result).toEqual({ ok: true });
  });

  it("rejects a plan that omits a meaningful user condition from its evidence", () => {
    const request = "Đối tác nào giới thiệu nhiều lao động nhất trong tháng ở Hà Nội";
    const result = validateRequestCoverage(request, [
      { evidence: "Đối tác nào", requirement: "Tra cứu đối tác", mappedTo: ["action"] },
      { evidence: "giới thiệu nhiều lao động nhất", requirement: "Xếp hạng theo số lao động giới thiệu", mappedTo: ["analysis.extreme.actualReferrals"] },
      { evidence: "trong tháng", requirement: "Giới hạn theo tháng", mappedTo: ["values.createdFrom"] },
    ], workflow, operation, {
      createdFrom: "2026-11-01",
      analysis: JSON.stringify({ extreme: { field: "actualReferrals", direction: "max" } }),
    });

    expect(result).toMatchObject({ ok: false, clarification: expect.stringContaining("Hà Nội") });
  });

  it("does not treat omitted negation as a harmless stop word", () => {
    const result = validateRequestCoverage("Liệt kê hồ sơ chưa hoàn thành", [
      { evidence: "Liệt kê hồ sơ hoàn thành", requirement: "Liệt kê hồ sơ hoàn thành", mappedTo: ["action"] },
    ], workflow, operation, {});

    expect(result).toMatchObject({ ok: false, clarification: expect.stringContaining("chưa") });
  });

  it("requires a location condition to map to a filter instead of only naming the action", () => {
    const result = validateRequestCoverage("Tìm đối tác ở Hà Nội", [
      { evidence: "Tìm đối tác", requirement: "Tra cứu đối tác", mappedTo: ["action"] },
      { evidence: "ở Hà Nội", requirement: "Chỉ lấy đối tác tại Hà Nội", mappedTo: ["action"] },
    ], workflow, operation, {});

    expect(result).toMatchObject({ ok: false, clarification: expect.stringContaining("trường lọc") });
  });

  it("does not mistake the noun 'tài khoản' for the preposition 'tại'", () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "employee.delete")!;
    const employeeWorkflow = defaultWorkflow(operation);
    const text = "Xóa tài khoản nhân sự";

    expect(validateRequestCoverage(text, [
      { evidence: text, requirement: "Xóa tài khoản nhân sự", mappedTo: ["action"] },
    ], employeeWorkflow, operation, {})).toEqual({ ok: true });
  });

  it("accepts constraints implemented by a dedicated workflow action", () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "department.unmanaged.list")!;
    const dedicatedWorkflow = defaultWorkflow(operation);
    const request = operation.title;

    expect(validateRequestCoverage(request, [
      { evidence: request, requirement: request, mappedTo: ["action"] },
    ], dedicatedWorkflow, operation, {})).toEqual({ ok: true });
  });

  it("still requires a field mapping for a location outside a dedicated action's scope", () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "department.unmanaged.list")!;
    const dedicatedWorkflow = defaultWorkflow(operation);
    const request = `${operation.title} ở Hà Nội`;

    expect(validateRequestCoverage(request, [
      { evidence: request, requirement: request, mappedTo: ["action"] },
    ], dedicatedWorkflow, operation, {})).toMatchObject({ ok: false });
  });

  it("does not treat a constraint mentioned only as excluded behavior as action coverage", () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "timekeeping.records.monthly.leave-summary")!;
    const dedicatedWorkflow = defaultWorkflow(operation);
    const request = "Nhân sự nghỉ phép nhiều nhất trong tháng";

    expect(validateRequestCoverage(request, [
      { evidence: request, requirement: request, mappedTo: ["action"] },
    ], dedicatedWorkflow, operation, {})).toMatchObject({ ok: false });
  });

  it("accepts a dedicated pre-ranked report when the requested metric matches its action", () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "timekeeping.records.monthly.most-late")!;
    const rankingWorkflow = defaultWorkflow(operation);
    const request = "Báo cáo những người đi trễ nhiều nhất tháng 11 năm 2026";
    const month = rankingWorkflow.fields.find(field => field.apiKey === "month")!;
    const year = rankingWorkflow.fields.find(field => field.apiKey === "year")!;
    const values = { [month.key]: 11, [year.key]: 2026 };

    expect(validateRequestCoverage(request, [
      { evidence: request, requirement: request, mappedTo: ["action", `values.${month.key}`, `values.${year.key}`] },
    ], rankingWorkflow, operation, values)).toEqual({ ok: true });
  });

  it("does not apply a dedicated ranking action to a different metric", () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "timekeeping.records.monthly.most-late")!;
    const rankingWorkflow = defaultWorkflow(operation);
    const request = "Nhân sự có lương cao nhất trong tháng";

    expect(validateRequestCoverage(request, [
      { evidence: request, requirement: request, mappedTo: ["action"] },
    ], rankingWorkflow, operation, {})).toMatchObject({ ok: false });
  });

  it("requires an extreme ranking to map to an analysis operation", () => {
    const result = validateRequestCoverage("Đối tác giới thiệu nhiều lao động nhất", [
      { evidence: "Đối tác", requirement: "Tra cứu đối tác", mappedTo: ["action"] },
      { evidence: "giới thiệu nhiều lao động nhất", requirement: "Tìm đối tác đứng đầu", mappedTo: ["action"] },
    ], workflow, operation, {});

    expect(result).toMatchObject({ ok: false, clarification: expect.stringContaining("phép xếp hạng") });
  });

  it("accepts a verified ranking plan when the model mapped evidence only to the action", () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.path === "/worker-management/partners/kpi")!;
    const partnerWorkflow = defaultWorkflow(operation);
    const text = "\u0110\u1ed1i t\u00e1c gi\u1edbi thi\u1ec7u nhi\u1ec1u lao \u0111\u1ed9ng nh\u1ea5t";
    const values = { analysis: { extreme: { field: "actualReferrals", direction: "max" as const } } };

    expect(validateRequestCoverage(text, [
      { evidence: text, requirement: "Ranking by introduced workers", mappedTo: ["action"] },
    ], partnerWorkflow, operation, values)).toEqual({ ok: true });
  });

  it("accepts the declared current-month default without pretending the user supplied an exact month", () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.path === "/worker-management/partners/kpi")!;
    const partnerWorkflow = defaultWorkflow(operation);
    const result = validateRequestCoverage("Trong quản lí lao động, đối tác nào giới thiệu nhiều lao động nhất trong tháng", [
      { evidence: "Trong quản lí lao động", requirement: "Phân hệ lao động", mappedTo: ["context.module"] },
      { evidence: "đối tác nào", requirement: "Tra cứu đối tác", mappedTo: ["action"] },
      { evidence: "giới thiệu nhiều lao động nhất", requirement: "Xếp hạng theo số lao động giới thiệu", mappedTo: ["analysis.extreme.actualReferrals"] },
      { evidence: "trong tháng", requirement: "Dùng kỳ tháng hiện tại theo mặc định khai báo", mappedTo: ["values.query_periodAnchor"] },
    ], partnerWorkflow, operation, { analysis: JSON.stringify({ extreme: { field: "actualReferrals", direction: "max" } }) });

    expect(result).toEqual({ ok: true });
  });

  it("rejects an explicit unresolved requirement", () => {
    expect(validateRequestCoverage("Tìm đối tác theo khu vực", [
      { evidence: "theo khu vực", requirement: "Lọc theo khu vực", mappedTo: [], unresolved: true, clarification: "Bạn muốn khu vực nào?" },
    ], workflow, operation, {})).toEqual({ ok: false, clarification: "Bạn muốn khu vực nào?" });
  });
});
