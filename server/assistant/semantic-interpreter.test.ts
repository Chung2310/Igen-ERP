import { afterEach, describe, expect, it, vi } from "vitest";
const mockState = vi.hoisted(() => ({ provider: vi.fn(), inferIntentType: true, autoCoverage: true, coverageBuilder: null as any, lastCoverage: null as any, lastPendingActionId: null as any }));
const provider = mockState.provider;
vi.mock("../service/openrouter.service", () => ({ openrouterChat: async (...args: any[]) => {
  const response = await mockState.provider(...args);
  if (typeof response?.text !== "string") return response;
  try {
    const parsed = JSON.parse(response.text);
    if (mockState.inferIntentType && typeof parsed.actionId === "string" && parsed.intentType === undefined) parsed.intentType = "workflow";
    if (typeof parsed.actionId === "string" && parsed.actionIntent === undefined) parsed.actionIntent = operationById(parsed.actionId)?.assistantMetadata?.intent;
    if (mockState.autoCoverage && typeof parsed.actionId === "string" && parsed.requestCoverage === undefined) {
      let requestText = args[0]?.messages?.at(-1)?.content;
      let pendingActionId: string | undefined;
      try { const context = JSON.parse(requestText); requestText = context.text ?? requestText; pendingActionId = context.pending?.actionId; } catch { /* last user message is already the request */ }
      if (!pendingActionId) {
        const systemPrompt = args[0]?.messages?.find((message: any) => message.role === "system" && message.content.includes("ĐANG CHỜ:"))?.content || "";
        const pendingLine = systemPrompt.split("ĐANG CHỜ:").at(-1)?.split("\n")[0]?.trim();
        try { pendingActionId = JSON.parse(pendingLine).actionId; } catch { /* no pending workflow in this test */ }
      }
      if (typeof requestText === "string") {
        mockState.lastPendingActionId = pendingActionId;
        mockState.lastCoverage = mockState.coverageBuilder?.(requestText, parsed, pendingActionId)
          || [{ evidence: requestText, requirement: "Yêu cầu thao tác", mappedTo: ["action"] }];
        parsed.requestCoverage = mockState.lastCoverage;
      }
    }
    return { ...response, text: JSON.stringify(parsed) };
  } catch { return response; }
} }));
import { interpretRequest, validateRemainingRequests } from "./semantic-interpreter";
import { ASSISTANT_OPERATIONS, defaultWorkflow, operationById } from "./catalog";
import { explicitlyRequestsBudgetCreation, quotationIntent } from "./quotation-intent";
import { reconcileRequestedRanking } from "./list-analysis";
import { collectValues } from "./policy";
afterEach(() => { provider.mockReset(); mockState.inferIntentType = true; mockState.autoCoverage = true; });
const employee = defaultWorkflow(operationById("employee.update")!);
mockState.coverageBuilder = (text: string, parsed: any, pendingActionId?: string) => {
  const requestedAction = quotationIntent(text).actionId;
  const estimateActions = new Set(["quotation.request.create", "quotation.estimate.create", "quotation.estimate.from-customer"]);
  const explicitBudget = explicitlyRequestsBudgetCreation(text);
  const budgetSupplement = !requestedAction && parsed.actionId === "quotation.budget.create" && !explicitBudget;
  const targetAction = requestedAction && requestedAction !== "quotation.budget.create"
    ? requestedAction
    : budgetSupplement ? pendingActionId && estimateActions.has(pendingActionId) ? pendingActionId : "quotation.request.create"
      : requestedAction || parsed.actionId;
  const targetOperation = operationById(targetAction);
  if (!targetOperation) return undefined;
  const targetWorkflow = defaultWorkflow(targetOperation);
  const targets = ["action"];
  if (targetWorkflow.fields.some(field => field.key === "requestText")) targets.push("values.requestText");
  const values = parsed.values && typeof parsed.values === "object" ? parsed.values : {};
  for (const [key, value] of Object.entries(values)) {
    if (value == null) continue;
    const field = targetWorkflow.fields.find(candidate => candidate.key === key || candidate.apiKey === key
      || Boolean(candidate.source && candidate.apiKey && `${candidate.source}_${candidate.apiKey}` === key));
    if (field) targets.push(`values.${field.key}`);
  }
  if (targetOperation.id === "quotation.estimate.from-customer" && values.budget != null
    && targetWorkflow.fields.some(field => field.key === "sourceRequirements")) targets.push("values.sourceRequirements");
  if (targetWorkflow.fields.some(field => field.apiKey === "periodAnchor") && /\btháng\b|\bthang\b/iu.test(text)) {
    const periodField = targetWorkflow.fields.find(field => field.apiKey === "periodAnchor")!;
    targets.push(`values.${periodField.key}`);
  }
  let analysis: any = values.analysis;
  try { if (typeof analysis === "string") analysis = JSON.parse(analysis); } catch { analysis = undefined; }
  if (targetOperation.analysis && (!analysis || typeof analysis !== "object")) {
    const reconciled = reconcileRequestedRanking(text, targetOperation.analysis, analysis);
    if (reconciled.kind === "resolved") analysis = reconciled.analysis;
  }
  if (analysis && typeof analysis === "object") {
    if (analysis.extreme?.field) targets.push(`analysis.extreme.${analysis.extreme.field}`);
    if (analysis.sort?.field) targets.push(`analysis.sort.${analysis.sort.field}`);
    for (const filter of analysis.filters || []) if (filter?.field) targets.push(`analysis.filters.${filter.field}`);
    if (analysis.limit) targets.push("analysis.limit");
  }
  return [{ evidence: text, requirement: "Yêu cầu thao tác", mappedTo: [...new Set(targets)] }];
};
describe("estimate versus budget routing", () => {
  const workflows = ["quotation.budget.create", "quotation.request.create", "quotation.estimate.create", "quotation.estimate.from-customer"].map(id => defaultWorkflow(operationById(id)!));
  it.each([
    ["Tạo dự toán", "quotation.request.create"],
    ["Lập dự toán lắp camera, ngân sách 100 triệu", "quotation.request.create"],
    ["len du toan cho toi ngan sach 100 trieu", "quotation.request.create"],
    ["Tôi cần một dự toán cho công trình", "quotation.request.create"],
    ["Tạo dự toán, không tạo ngân sách", "quotation.request.create"],
    ["Tạo dự toán từ báo giá BG-001 với ngân sách 100 triệu", "quotation.estimate.from-customer"],
    ["Lập dự toán dựa trên báo giá BG-2026-001", "quotation.estimate.from-customer"],
    ["Tạo dự toán căn cứ vào BG-2026-001", "quotation.estimate.from-customer"],
    ["Lập dự toán từ yêu cầu đã phân tích, ngân sách 100 triệu", "quotation.estimate.create"],
  ])("corrects an incorrect model budget choice: %s", async (text, actionId) => {
    provider.mockResolvedValue({ text: JSON.stringify({ actionId: "quotation.budget.create", values: { customerName: "An", budget: 100000000 }, remainingRequests: ["Tạo ngân sách"] }) });
    expect(quotationIntent(text).actionId).toBe(actionId);
    const result = await interpretRequest(text, workflows, null, []);
    expect(result.actionId, JSON.stringify({ result, lastCoverage: mockState.lastCoverage })).toBe(actionId);
    expect(result.values).not.toHaveProperty("budget");
    expect(result.remainingRequests).toEqual([]);
    if (actionId === "quotation.request.create") {
      expect(result.values.requestText).toBe(text);
      expect(result.values.customerName).toBe("An");
    }
    if (actionId === "quotation.estimate.from-customer" && /ngân sách/i.test(text)) {
      expect(result.values.sourceRequirements).toContain(text);
    }
  });
  it("keeps a budget constraint on the pending estimate even if AI calls it a new request", async () => {
    provider.mockResolvedValue({ text: JSON.stringify({ actionId: "quotation.budget.create", values: {}, newRequest: true }) });
    const result = await interpretRequest("Ngân sách 100 triệu nhé", workflows, { actionId: "quotation.request.create", values: { requestText: "Lắp 10 camera" } }, []);
    expect(result, JSON.stringify({ result, lastCoverage: mockState.lastCoverage, lastPendingActionId: mockState.lastPendingActionId })).toMatchObject({ actionId: "quotation.request.create", newRequest: false, values: { requestText: "Lắp 10 camera\nNgân sách 100 triệu nhé" } });
  });
  it.each(["Tạo phương án dự toán ngân sách 100 triệu", "Lập ngân sách 100 triệu", "Đề xuất phương án ngân sách cho dự toán"])("preserves an explicit budget request: %s", async text => {
    const amount = text.match(/(\d+)\s*triệu/i);
    provider.mockResolvedValue({ text: JSON.stringify({ actionId: "quotation.budget.create", values: amount ? { budget: Number(amount[1]) * 1_000_000 } : {} }) });
    const result = await interpretRequest(text, workflows, { actionId: "quotation.request.create" }, []);
    expect(result.actionId, JSON.stringify(result)).toBe("quotation.budget.create");
  });
  it("does not substitute a budget when estimate permission is absent", async () => {
    provider.mockResolvedValue({ text: JSON.stringify({ actionId: "quotation.budget.create", values: {} }) });
    expect((await interpretRequest("Tạo dự toán", workflows.slice(0, 1), null, [])).actionId).toBeNull();
  });
  it("preserves cancellation", async () => {
    provider.mockResolvedValue({ text: JSON.stringify({ actionId: "quotation.budget.create", values: {}, cancel: true }) });
    expect(await interpretRequest("Không tạo dự toán nữa", workflows, null, [])).toMatchObject({ actionId: null, cancel: true });
  });
});
describe("semantic interpretation", () => {
  it("routes active applicants grouped by department to the recruitment report without an AI routing guess", async () => {
    const workflows = ASSISTANT_OPERATIONS.filter(candidate => candidate.module === "hr").map(defaultWorkflow);

    const result = await interpretRequest("Thống kê số ứng viên đang ứng tuyển vào từng phòng ban", workflows, null, []);

    expect(result).toMatchObject({
      actionId: "recruitment.report",
      intentType: "workflow",
      actionIntent: "report",
      values: { query_reportType: "applicants-by-department" },
    });
    expect(provider).not.toHaveBeenCalled();
  });

  it("does not route a department applicant report when the recruitment report workflow is unavailable", async () => {
    const workflows = ASSISTANT_OPERATIONS.filter(candidate => candidate.module === "hr" && candidate.id !== "recruitment.report").map(defaultWorkflow);

    const result = await interpretRequest("Thống kê số ứng viên đang ứng tuyển vào từng phòng ban", workflows, null, [], "", [], "", ["hr"]);

    expect(result).toMatchObject({ actionId: null, intentType: "unsupported", unsupportedModule: "hr" });
    expect(provider).not.toHaveBeenCalled();
  });

  it("routes a labor-partner referral ranking to the labor KPI workflow", async () => {
    const laborKpi = ASSISTANT_OPERATIONS.find(candidate => candidate.path === "/worker-management/partners/kpi")!;
    const studentPartners = defaultWorkflow(operationById("partner.list")!);
    provider.mockResolvedValue({ text: JSON.stringify({ actionId: laborKpi.id, values: {} }) });

    const laborPartnerWorkflows = ASSISTANT_OPERATIONS.filter(candidate => candidate.module === "labor-partner").map(defaultWorkflow);
    const result = await interpretRequest(
      "Trong quản lí lao động, Đối tác nào giới thiệu được nhiều lao động nhất trong tháng",
      [studentPartners, ...laborPartnerWorkflows],
      null,
      [],
    );

    expect(result.actionId, JSON.stringify(result)).toBe(laborKpi.id);
    expect(result.values.analysis).toEqual({ extreme: { field: "actualReferrals", direction: "max" } });
    expect(provider).toHaveBeenCalledTimes(1);
    const prompt = provider.mock.calls[0][0].messages.map((message: any) => message.content).join("\n");
    expect(prompt).toContain(laborKpi.id);
    expect(prompt).not.toContain(studentPartners.actionId);
    expect(prompt).not.toContain(operationById("worker.partner.policy.list")!.id);
    expect(prompt).not.toContain(operationById("worker.partner.referrals.list")!.id);
  });

  it("does not route an explicit labor-partner request into student-partner when labor tools are unavailable", async () => {
    const studentPartners = defaultWorkflow(operationById("partner.list")!);

    const result = await interpretRequest(
      "Tìm đối tác giới thiệu nhiều lao động nhất",
      [studentPartners],
      null,
      [],
      "",
      [],
      "",
      ["student-partner", "labor-partner"],
    );

    expect(result).toMatchObject({ actionId: null, values: {}, intentType: "unsupported", unsupportedModule: "labor-partner" });
    expect(provider).not.toHaveBeenCalled();
  });

  it("gives the model the real analysis measures and output contract", async () => {
    const operation = ASSISTANT_OPERATIONS.find(candidate => candidate.path === "/worker-management/partners/kpi")!;
    const workflow = defaultWorkflow(operation);
    provider.mockResolvedValue({ text: JSON.stringify({ actionId: null, intentType: "ambiguous", values: {}, requestCoverage: [], clarification: "Bạn muốn xem chỉ số nào?" }) });

    await interpretRequest("Đối tác nào giới thiệu nhiều lao động nhất?", [workflow], null, []);

    const prompt = provider.mock.calls[0][0].messages.map((message: any) => message.content).join("\n");
    expect(prompt).toContain("actualReferrals");
    expect(prompt).toContain("lao động được giới thiệu");
    expect(prompt).toContain("periodStart");
    expect(prompt).not.toContain(operation.path);
  });

  it("recovers a parent module phrase even when the model leaves its mapping empty", async () => {
    const operation = ASSISTANT_OPERATIONS.find(candidate => candidate.path === "/worker-management/partners/kpi")!;
    const workflow = defaultWorkflow(operation);
    const periodField = workflow.fields.find(field => field.apiKey === "periodAnchor")!;
    const text = "Trong quản lí lao động, Đối tác nào giới thiệu được nhiều lao động nhất trong tháng";
    provider.mockResolvedValue({ text: JSON.stringify({
      actionId: operation.id,
      intentType: "workflow",
      values: {
        [periodField.key]: "2026-11-01",
        analysis: { extreme: { field: "actualReferrals", direction: "max" } },
      },
      requestCoverage: [
        { evidence: "Trong quản lí lao động", requirement: "Phân hệ quản lý lao động", mappedTo: [], unresolved: true },
        { evidence: "Đối tác nào", requirement: "Tra cứu đối tác", mappedTo: ["action"] },
        { evidence: "giới thiệu được nhiều lao động nhất", requirement: "Xếp theo số lao động được giới thiệu cao nhất", mappedTo: ["analysis.extreme.actualReferrals"] },
        { evidence: "trong tháng", requirement: "Kỳ tháng hiện tại", mappedTo: [`values.${periodField.key}`] },
      ],
    }) });

    const result = await interpretRequest(text, [workflow], null, []);

    expect(result.actionId).toBe(operation.id);
    expect(result.values.analysis).toEqual({ extreme: { field: "actualReferrals", direction: "max" } });
  });

  it("repairs a single-workflow plan once when request evidence omitted the reporting period", async () => {
    const operation = ASSISTANT_OPERATIONS.find(candidate => candidate.path === "/worker-management/partners/kpi")!;
    const workflow = defaultWorkflow(operation);
    const periodField = workflow.fields.find(field => field.apiKey === "periodAnchor")!;
    const text = "Đối tác giới thiệu nhiều lao động nhất trong tháng 11/2026";
    const values = {
      [periodField.key]: "2026-11-01",
      analysis: { extreme: { field: "actualReferrals", direction: "max" } },
    };
    provider.mockResolvedValueOnce({ text: JSON.stringify({
      actionId: operation.id,
      intentType: "workflow",
      values,
      requestCoverage: [
        { evidence: "Đối tác giới thiệu", requirement: "Tra cứu đối tác", mappedTo: ["action"] },
        { evidence: "nhiều lao động nhất", requirement: "Xếp hạng theo số lao động giới thiệu", mappedTo: ["analysis.extreme.actualReferrals"] },
      ],
    }) });
    provider.mockResolvedValueOnce({ text: JSON.stringify({
      actionId: operation.id,
      intentType: "workflow",
      values,
      requestCoverage: [
        { evidence: "Đối tác giới thiệu", requirement: "Tra cứu đối tác", mappedTo: ["action"] },
        { evidence: "nhiều lao động nhất", requirement: "Xếp hạng theo số lao động giới thiệu", mappedTo: ["analysis.extreme.actualReferrals"] },
        { evidence: "trong tháng 11/2026", requirement: "Giới hạn theo tháng 11 năm 2026", mappedTo: [`values.${periodField.key}`] },
      ],
    }) });

    const result = await interpretRequest(text, [workflow], null, []);

    expect(result.actionId).toBe(operation.id);
    expect(result.values.analysis).toEqual({ extreme: { field: "actualReferrals", direction: "max" } });
    expect(provider).toHaveBeenCalledTimes(2);
    expect(provider.mock.calls[1][0].messages.map((message: any) => message.content).join("\n")).toContain("11/2026");
  });

  it("accepts a verified ranking map when the plan already matches", async () => {
    const operation = ASSISTANT_OPERATIONS.find(candidate => candidate.path === "/worker-management/partners/kpi")!;
    const workflow = defaultWorkflow(operation);
    const text = "Đối tác giới thiệu nhiều lao động nhất";
    const values = { analysis: { extreme: { field: "actualReferrals", direction: "max" } } };
    provider.mockResolvedValueOnce({ text: JSON.stringify({
      actionId: operation.id,
      intentType: "workflow",
      values,
      requestCoverage: [{ evidence: text, requirement: "Xếp hạng đối tác theo số lao động giới thiệu", mappedTo: ["action"] }],
    }) });

    const result = await interpretRequest(text, [workflow], null, []);

    expect(result.actionId).toBe(operation.id);
    expect(result.values.analysis).toEqual(values.analysis);
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it("repairs a composite plan once when it omitted a period clause", async () => {
    const employeeList = defaultWorkflow(operationById("employee.list")!);
    const calendarList = defaultWorkflow(operationById("hr.calendar.events.list")!);
    const text = "Tổng hợp danh sách nhân sự và lịch sự kiện trong tháng 11/2026";
    const plan = [
      { actionId: employeeList.actionId, purpose: "Danh sách nhân sự", values: {}, resultFields: ["displayName"] },
      { actionId: calendarList.actionId, purpose: "Lịch sự kiện", values: { rangeStart: "2026-11-01", rangeEnd: "2026-11-30" }, resultFields: ["title", "startDate"] },
    ];
    const baseCoverage = [
      { evidence: "Tổng hợp", requirement: "Tổng hợp dữ liệu", mappedTo: ["action"] },
      { evidence: "danh sách nhân sự", requirement: "Danh sách nhân sự", mappedTo: [`query:${employeeList.actionId}:result.displayName`] },
      { evidence: "lịch sự kiện", requirement: "Lịch sự kiện", mappedTo: [`query:${calendarList.actionId}:result.title`] },
    ];
    provider.mockResolvedValueOnce({ text: JSON.stringify({
      actionId: null,
      intentType: "workflow",
      actionIntent: "report",
      values: {},
      queryPlan: plan,
      requestCoverage: baseCoverage,
    }) });
    provider.mockResolvedValueOnce({ text: JSON.stringify({
      actionId: null,
      intentType: "workflow",
      actionIntent: "report",
      values: {},
      queryPlan: plan,
      requestCoverage: [
        ...baseCoverage,
        { evidence: "trong tháng 11/2026", requirement: "Chỉ lấy sự kiện của tháng 11 năm 2026", mappedTo: [`query:${calendarList.actionId}:values.rangeStart`] },
      ],
    }) });

    const result = await interpretRequest(text, [employeeList, calendarList], null, [], "", [], "", [], true);

    expect(result.queryPlan?.map(query => query.actionId), JSON.stringify(result)).toEqual([employeeList.actionId, calendarList.actionId]);
    expect(provider).toHaveBeenCalledTimes(2);
    expect(provider.mock.calls[1][0].messages.map((message: any) => message.content).join("\n")).toContain("11/2026");
  });

  it("does not promote an unclassified action proposal into a workflow", async () => {
    mockState.inferIntentType = false;
    provider.mockResolvedValue({ text: JSON.stringify({ actionId: "employee.update", values: { id: "Lan" } }) });
    const result = await interpretRequest("Cập nhật nhân sự Lan", [employee], null, []);
    expect(result).toMatchObject({ actionId: null, values: {}, intentType: "ambiguous" });
  });
  it("rejects a selected workflow whose action category conflicts with the request classification", async () => {
    provider.mockResolvedValue({ text: JSON.stringify({ actionId: "employee.update", actionIntent: "delete", intentType: "workflow", values: { id: "Lan" } }) });
    const result = await interpretRequest("Xóa nhân sự Lan", [employee], null, []);
    expect(result).toMatchObject({ actionId: null, values: {}, intentType: "ambiguous" });
    expect(result.clarification).toContain("xóa");
  });
  it("routes multi-module requests before choosing an action and workflow", async () => {
    const student = defaultWorkflow(operationById("student.list")!);
    provider.mockResolvedValueOnce({ text: JSON.stringify({ modules: ["student"] }) });
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: student.actionId, intentType: "workflow", values: { search: "Lan" } }) });

    const result = await interpretRequest("Tìm hồ sơ Lan", [employee, student], null, []);

    expect(result.actionId).toBe(student.actionId);
    expect(provider).toHaveBeenCalledTimes(2);
    const actionPrompt = provider.mock.calls[1][0].messages[0].content;
    const capabilityCatalog = actionPrompt.slice(actionPrompt.indexOf("DANH MỤC NĂNG LỰC:"), actionPrompt.indexOf("\nPHÂN HỆ CÓ THỂ TRUY CẬP:"));
    expect(capabilityCatalog).toContain(student.actionId);
    expect(capabilityCatalog).not.toContain(employee.actionId);
  });
  it("selects a business function inside HR before selecting the CRUD action", async () => {
    const employeeList = defaultWorkflow(operationById("employee.list")!);
    const applicantList = defaultWorkflow(operationById("recruitment.applicant.list")!);
    const contractCreate = defaultWorkflow(operationById("hr.contract.create")!);
    const calendarCreate = defaultWorkflow(operationById("hr.calendar.event.create")!);
    provider.mockResolvedValueOnce({ text: JSON.stringify({ featureKeys: ["hr:recruitment"], ambiguous: false, clarification: "" }) });
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: applicantList.actionId, intentType: "workflow", values: {} }) });

    const result = await interpretRequest("Tìm ứng viên tên Lan", [employeeList, applicantList, contractCreate, calendarCreate], null, []);

    expect(result.actionId).toBe(applicantList.actionId);
    expect(provider).toHaveBeenCalledTimes(2);
    const functionPrompt = provider.mock.calls[0][0].messages[0].content;
    expect(functionPrompt).toContain("Tuyển dụng");
    expect(functionPrompt).toContain("Hợp đồng");
    expect(functionPrompt).toContain("Lịch");
    const actionPrompt = provider.mock.calls[1][0].messages[0].content;
    const capabilityStart = actionPrompt.indexOf("DANH MỤC NĂNG LỰC:") + "DANH MỤC NĂNG LỰC:".length;
    const capabilityEnd = actionPrompt.indexOf("\nPHÂN HỆ CÓ THỂ TRUY CẬP", capabilityStart);
    const capabilityCatalogText = actionPrompt.slice(capabilityStart, capabilityEnd).trim();
    const capabilityActionIds = JSON.parse(capabilityCatalogText).map((item: any) => item.actionId);
    expect(capabilityActionIds).toEqual([applicantList.actionId]);
  });
  it("continues from a selected function to workflow routing when only record fields are missing", async () => {
    const employeeDelete = defaultWorkflow(operationById("employee.delete")!);
    const employeeList = defaultWorkflow(operationById("employee.list")!);
    const applicantList = defaultWorkflow(operationById("recruitment.applicant.list")!);
    provider.mockResolvedValue({ text: JSON.stringify({
      actionId: employeeDelete.actionId,
      intentType: "workflow",
      actionIntent: "delete",
      values: {},
      requestCoverage: [{ evidence: "Xóa tài khoản nhân sự", requirement: "xóa tài khoản nhân sự", mappedTo: ["action"] }],
    }) });
    provider.mockResolvedValueOnce({ text: JSON.stringify({
      featureKeys: ["hr:employee"],
      ambiguous: true,
      clarification: "Bạn muốn xóa nhân sự nào?",
    }) });
    provider.mockResolvedValueOnce({ text: JSON.stringify({
      actionId: employeeDelete.actionId,
      intentType: "workflow",
      actionIntent: "delete",
      values: {},
      requestCoverage: [{ evidence: "Xóa tài khoản nhân sự", requirement: "xóa tài khoản nhân sự", mappedTo: ["action"] }],
    }) });

    const result = await interpretRequest("Xóa tài khoản nhân sự", [employeeDelete, employeeList, applicantList], null, []);

    expect(result, JSON.stringify({ result, coverage: mockState.lastCoverage, calls: provider.mock.calls.length }))
      .toMatchObject({ actionId: "employee.delete", intentType: "workflow", values: {} });
    const collected = collectValues(employeeDelete, result.values);
    expect(collected.missing).toContain(employeeDelete.fields.find(field => field.key === "id")?.label);
    expect(provider).toHaveBeenCalledTimes(2);
  });
  it("plans multiple authorized read APIs for a cross-function HR summary", async () => {
    const employeeList = defaultWorkflow(operationById("employee.list")!);
    const calendarList = defaultWorkflow(operationById("hr.calendar.events.list")!);
    provider.mockResolvedValueOnce({ text: JSON.stringify({ featureKeys: ["hr:employee", "hr:calendar"], ambiguous: false, clarification: "" }) });
    provider.mockResolvedValueOnce({ text: JSON.stringify({
      intentType: "workflow",
      actionId: null,
      actionIntent: "report",
      values: {},
      queryPlan: [
        { actionId: "employee.list", purpose: "nhân sự trong phạm vi", values: {}, resultFields: ["displayName"] },
        { actionId: "hr.calendar.events.list", purpose: "sự kiện tháng được nêu", values: { rangeStart: "2026-11-01", rangeEnd: "2026-11-30" }, resultFields: ["title", "startDate"] },
      ],
      requestCoverage: [
        { evidence: "Tổng hợp", requirement: "tổng hợp thông tin", mappedTo: ["action"] },
        { evidence: "nhân sự", requirement: "danh sách nhân sự", mappedTo: ["query:employee.list:result.displayName"] },
        { evidence: "lịch sự kiện tháng 11/2026", requirement: "sự kiện lịch trong tháng 11/2026", mappedTo: ["query:hr.calendar.events.list:values.rangeStart", "query:hr.calendar.events.list:values.rangeEnd", "query:hr.calendar.events.list:result.title"] },
      ],
    }) });

    const result = await interpretRequest("Tổng hợp nhân sự và lịch sự kiện tháng 11/2026", [employeeList, calendarList], null, []);

    expect(result.actionId).toBeNull();
    expect(result.queryPlan?.map(query => query.actionId), JSON.stringify(result)).toEqual(["employee.list", "hr.calendar.events.list"]);
    expect(provider).toHaveBeenCalledTimes(2);
  });
  it("asks for the function area when the module is known but the requested area is not", async () => {
    const workflows = ["employee.list", "recruitment.applicant.list", "hr.contract.create", "hr.calendar.event.create"]
      .map(id => defaultWorkflow(operationById(id)!));
    provider.mockResolvedValueOnce({ text: JSON.stringify({
      featureKeys: [],
      ambiguous: true,
      clarification: "Bạn muốn làm việc với tuyển dụng, hồ sơ nhân sự, hợp đồng hay lịch?",
    }) });

    const result = await interpretRequest("Trong phân hệ nhân sự", workflows, null, []);

    expect(result).toMatchObject({ actionId: null, values: {}, intentType: "ambiguous" });
    expect(result.clarification).toContain("tuyển dụng");
    expect(provider).toHaveBeenCalledTimes(1);
  });
  it("keeps the function question when multiple candidate areas remain", async () => {
    const workflows = ["employee.update", "payroll.policy.update"].map(id => defaultWorkflow(operationById(id)!));
    provider.mockResolvedValueOnce({ text: JSON.stringify({
      featureKeys: ["hr:employee", "hr:payroll"],
      ambiguous: true,
      clarification: "Bạn muốn cập nhật lương của nhân viên hay lương cơ bản trong chính sách?",
    }) });

    const result = await interpretRequest("Cập nhật lương cơ bản lên 3450k", workflows, null, []);

    expect(result).toMatchObject({ actionId: null, intentType: "ambiguous" });
    expect(result.clarification).toContain("nhân viên hay lương cơ bản trong chính sách");
    expect(provider).toHaveBeenCalledTimes(1);
  });
  it("scopes an explicit module before asking the model to choose a workflow", async () => {
    const employeeList = defaultWorkflow(operationById("employee.list")!);
    const studentList = defaultWorkflow(operationById("student.list")!);
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: employeeList.actionId, intentType: "workflow", values: {} }) });

    const result = await interpretRequest("Trong nhân sự, tìm Lan", [employeeList, studentList], null, []);

    expect(result.actionId).toBe(employeeList.actionId);
    expect(provider).toHaveBeenCalledTimes(1);
    expect(provider.mock.calls[0][0].responseSchema.properties.actionId.enum).not.toContain(studentList.actionId);
  });
  it("does not execute a workflow proposal without requirement coverage", async () => {
    mockState.autoCoverage = false;
    provider.mockResolvedValue({ text: JSON.stringify({ actionId: "employee.update", intentType: "workflow", values: { id: "Lan" } }) });
    const result = await interpretRequest("Cập nhật nhân sự Lan", [employee], null, []);
    expect(result).toMatchObject({ actionId: null, values: {}, intentType: "ambiguous" });
  });
  it.each(["worker.list", "student.list", "retail.partner.update"])("does not silently execute a partial request in %s", async id => {
    const workflow = defaultWorkflow(operationById(id)!);
    provider.mockResolvedValue({ text: JSON.stringify({ actionId: id, values: { unsupportedCondition: "sensitive-value" } }) });
    const result = await interpretRequest("Xử lý đúng tất cả các điều kiện tôi vừa nêu", [workflow], null, []);
    expect(result).toMatchObject({ actionId: null, intentType: "ambiguous", values: {} });
    expect(JSON.stringify(result)).not.toContain("sensitive-value");
  });
  it("preserves equivalent schema names and refuses conflicting values", async () => {
    const workflow = defaultWorkflow(operationById("worker.list")!);
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: workflow.actionId, values: { search: "Lan" } }) });
    expect((await interpretRequest("Tìm lao động Lan", [workflow], null, [])).values).toEqual({ query_search: "Lan" });
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: workflow.actionId, values: { search: "Lan", query_search: "An" } }) });
    expect((await interpretRequest("Tìm lao động Lan", [workflow], null, [])).actionId).toBeNull();
  });
  it("does not turn a calendar date into authorization for a recurring schedule", async () => {
    const workflow = defaultWorkflow(operationById("payroll.reconciliation.schedule.update")!);
    provider.mockResolvedValue({ text: JSON.stringify({ actionId: workflow.actionId, values: { day:5, hour:16, recurrence:"monthly" } }) });
    const oneOff = await interpretRequest("Đổi lịch phát hành sang ngày 5/11 lúc 16 giờ", [workflow], null, []);
    expect(oneOff.values).not.toHaveProperty("recurrence");
    const recurring = await interpretRequest("Tôi xác nhận lặp hằng tháng vào ngày 5 lúc 16 giờ", [workflow], null, []);
    expect(recurring.values.recurrence).toBe("monthly");
    expect(recurring.values.day).toBe(5);
  });
  it("drops null values so authenticated branch context can be applied", async () => {
    const workflow = defaultWorkflow(operationById("recruitment.interview.list")!);
    provider.mockResolvedValue({ text: JSON.stringify({ actionId: workflow.actionId, values: { branchId: null } }) });
    expect((await interpretRequest("Lịch phỏng vấn hôm nay", [workflow], null, [])).values).not.toHaveProperty("branchId");
  });
  it("does not accept invented hours for a date-only event", async () => {
    const workflow = defaultWorkflow(operationById("hr.calendar.event.create")!);
    provider.mockResolvedValue({ text: JSON.stringify({ actionId: workflow.actionId, values: { title: "Họp tuần", startDate: "2026-11-21T09:00:00+07:00", endDate: "2026-11-21T10:00:00+07:00" } }) });
    const result = await interpretRequest("Tạo sự kiện Họp tuần vào thứ bảy", [workflow], null, []);
    expect(result, JSON.stringify(result)).toMatchObject({ actionId: null, intentType: "ambiguous", values: {} });
  });
  it("normalizes structured JSON arrays without changing reference names", async () => {
    const workflow = defaultWorkflow(operationById("recruitment.interview.update")!);
    provider.mockResolvedValue({ text: JSON.stringify({ actionId: workflow.actionId, values: { path_id: "Lan", interviewerIds: ["Minh"] } }) });
    expect((await interpretRequest("Đổi người phỏng vấn Lan thành Minh", [workflow], null, [])).values.interviewerIds).toBe('["Minh"]');
  });
  it.each(["Chị Lan từ nay làm bên kế toán nhé", "chuyen Lan qua ke toan", "Đổi phòng ban nhân viên Lan"])("uses AI for paraphrase: %s", async text => {
    provider.mockResolvedValue({ text: JSON.stringify({ actionId: employee.actionId, intentType: "workflow", values: {}, remainingRequests: [] }) });
    expect((await interpretRequest(text, [employee], null, [])).actionId).toBe(employee.actionId);
    expect(provider).toHaveBeenCalledTimes(1);
    expect(provider.mock.calls[0][0].messages.at(-1).content).toBe(text);
  });
  it("rejects unavailable operations and malformed plans", async () => {
    provider.mockResolvedValue({ text: JSON.stringify({ actionId: "not.allowed", values: {} }) });
    await expect(interpretRequest("làm giúp", [employee], null, [])).rejects.toThrow();
    expect(() => validateRemainingRequests(Array(41).fill("step"))).toThrow();
    expect(() => validateRemainingRequests([{}])).toThrow();
  });
  it("preserves a multi-step goal and supplies context for continuation", async () => {
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: employee.actionId, values: {}, remainingRequests: ["tạo việc bàn giao"], newRequest: false,
      requestCoverage: [{ evidence: 'Chuyển Lan', requirement: 'Bước hiện tại', mappedTo: ['action'] },
        { evidence: 'tạo việc bàn giao', requirement: 'Bước tiếp theo', mappedTo: ['remainingRequests.0'] }] }) });
    const result = await interpretRequest("Chuyển Lan và tạo việc bàn giao", [employee], null, []);
    expect(result.remainingRequests).toEqual(["tạo việc bàn giao"]);
    provider.mockResolvedValue({ text: JSON.stringify({ actionId: employee.actionId, values: {}, remainingRequests: [], newRequest: false }) });
    await interpretRequest("tiếp tục", [employee], null, [{role:"assistant", content:"Đã cập nhật Lan"}], "", [], JSON.stringify(result.remainingRequests));
    expect(JSON.stringify(provider.mock.calls[1][0])).toContain("tạo việc bàn giao");
  });
  it("does not let a keyword override cancellation or clarification", async () => {
    provider.mockResolvedValue({ text: JSON.stringify({ actionId: null, values: {}, cancel: true, intentType: "ambiguous", clarification: "Bạn muốn chuyển Lan nào?" }) });
    expect(await interpretRequest("Không chuyển nhân viên Lan nữa", [employee], null, [])).toMatchObject({actionId:null,cancel:true});
  });
  it("discovers new tools from the authorized catalog without a twelve-tool cutoff", async () => {
    const workflows = Array.from({length:120}, (_, i) => ({...employee, actionId:`custom.${i}`, module:"custom"}));
    provider.mockResolvedValueOnce({text:JSON.stringify({actionIds:["custom.119"]})});
    provider.mockResolvedValueOnce({text:JSON.stringify({actionId:"custom.119", values:{}, intentType:"workflow"})});
    expect((await interpretRequest("chức năng mới", workflows, null, [], "", [], "", [], true)).actionId).toBe("custom.119");
    expect(provider).toHaveBeenCalledTimes(2);
    expect(provider.mock.calls[1][0].responseSchema.properties.actionId.enum).toEqual(["custom.119", null]);
  });
  it.each(['{"modules":["employee","department"]}', 'not json', '{"modules":["hr","unknown"]}', '{"modules":null}'])("recovers from invalid discovery without losing authorized tools: %s", async discovery => {
    const create = defaultWorkflow(operationById("employee.create")!);
    const workflows = [create, ...Array.from({length:119}, (_, i) => ({...employee, actionId:`custom.${i}`, module:"worker"}))];
    provider.mockResolvedValueOnce({text:discovery});
    provider.mockResolvedValueOnce({text:JSON.stringify({actionIds:[create.actionId]})});
    provider.mockResolvedValueOnce({text:JSON.stringify({actionId:create.actionId, values:{displayName:"Hoàng Tài",department:"công nghệ thông tin"}, intentType:"workflow"})});
    const result = await interpretRequest("thêm hồ sơ Hoàng Tài thuộc phòng công nghệ thông tin", workflows, null, []);
    expect(result.actionId).toBe("employee.create");
    expect(result.values.displayName).toBe("Hoàng Tài");
    expect(provider).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(provider.mock.calls[1][0].messages)).toContain("custom.118");
    expect(provider.mock.calls[2][0].responseSchema.properties.actionId.enum).toEqual([create.actionId, null]);
  });
  it("retains the permission boundary after discovery fails", async () => {
    const workflows = Array.from({length:121}, (_, i) => ({...employee, actionId:`custom.${i}`, module:i ? "worker" : "hr"}));
    provider.mockRejectedValueOnce(new Error("Discovery unavailable"));
    provider.mockResolvedValueOnce({text:JSON.stringify({actionId:"employee.create",values:{},intentType:"workflow"})});
    await expect(interpretRequest("thêm hồ sơ", workflows, null, [])).rejects.toThrow('dịch vụ AI');
    expect(provider).toHaveBeenCalledTimes(1);
  });
});
