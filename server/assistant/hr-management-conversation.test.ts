import { randomUUID } from "node:crypto";
import { conversationAudit } from "./testing/conversation-audit";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ session: null as any, turns: [] as any[], interpret: vi.fn(), provider: vi.fn(), saveMemory: vi.fn(), memoryEnabled: false, includeStudentCourses: false, includeRecruitmentReport: true }));
vi.mock("./memory", async () => ({ ...await vi.importActual<typeof import("./memory")>("./memory"), assistantMemoryContext: async () => [], saveAssistantMemory: state.saveMemory }));
vi.mock("../service/openrouter.service", () => ({ openrouterChat: state.provider }));
vi.mock("./models", () => {
  const apply = (record: any, updates: any) => {
    for (const [key, value] of Object.entries(updates.$set || {})) {
      const path = key.split("."); let target = record;
      for (const part of path.slice(0, -1)) target = target[part] ??= {};
      target[path.at(-1)!] = structuredClone(value);
    }
  };
  const chain = (getter: () => any): any => ({ sort: () => chain(getter), select: () => chain(getter), lean: async () => structuredClone(getter()) });
  return {
    ensureAssistantIndexes: vi.fn(), AssistantDocumentModel: { create: vi.fn() },
    AssistantSessionModel: {
      updateOne: vi.fn(async (_filter, update) => { state.session ??= { messages: [], pending: null, busy: false, messageCount: 0 }; apply(state.session, update); }),
      findOneAndUpdate: vi.fn(async () => { state.session.busy = true; return structuredClone(state.session); }),
      findOne: vi.fn(() => chain(() => state.session)),
    },
    AssistantTurnModel: {
      create: vi.fn(async input => { const turn = { ...input, _id: String(state.turns.length + 1), createdAt: new Date(), updatedAt: new Date(), status: "processing" }; state.turns.push(turn); return turn; }),
      updateOne: vi.fn(async (filter, update) => { apply(state.turns.find(turn => turn._id === filter._id), update); }),
      findOne: vi.fn(filter => chain(() => [...state.turns].reverse().find(turn => filter.requestId
        ? turn.requestId === filter.requestId : turn.actionId && turn.result?.status === "completed"))),
    },
  };
});
vi.mock("./workflows", async () => {
  const { ASSISTANT_OPERATIONS, defaultWorkflow, operationById } = await import("./catalog");
  return {
    actorScope: () => ({ userId: "actor", companyCode: "TEST" }),
    assertOperation: vi.fn(async (_req, id) => operationById(id)),
    currentWorkflow: vi.fn(async (_req, id) => defaultWorkflow(operationById(id)!)),
    listWorkflows: vi.fn(async () => ASSISTANT_OPERATIONS.filter(operation => (["hr", "architect-assistant", "legal-reference"].includes(operation.module) || state.includeStudentCourses && operation.id === "course.create")
      && (state.includeRecruitmentReport || operation.id !== "recruitment.report")).map(defaultWorkflow)),
  };
});
vi.mock("./settings", async () => {
  const { defaultAssistantSettings } = await import("../../src/shared/assistant-workflow");
  return { getSettings: vi.fn(async () => ({ ...defaultAssistantSettings, memoryEnabled: state.memoryEnabled, autoMemoryEnabled: false, responseRules: "" })) };
});
vi.mock("./interpreter", () => ({ interpretRequest: state.interpret, isEmployeeDetailsIntent: () => false }));
vi.mock("./semantic-interpreter", () => ({ interpretRequest: state.interpret }));
vi.mock("./reply-rules", () => ({ applyAssistantResponseRules: async (reply: unknown) => reply }));
vi.mock("./completion", async () => {
  const actual = await vi.importActual<typeof import("./completion")>("./completion");
  return { ...actual, completeAssistantOperation: vi.fn(actual.completeAssistantOperation) };
});
vi.mock("./documents", () => ({ answerAssistantConversation: vi.fn() }));
vi.mock("./session-memory", () => ({ SESSION_MEMORY_LIMIT: 2400, summarizeAssistantSession: async () => null }));
vi.mock("./conversation-file", () => ({
  readAssistantConversationFile: vi.fn(async ({ fileName }: { fileName: string }) => ({
    fileName,
    fileSummary: `Ảnh ${fileName}`,
    documentContext: { title: fileName, version: 1, content: { type: "uploaded-image", fileName } },
    visualAttachments: [{ fileName, dataUrl: "data:image/jpeg;base64,ZmFrZQ==" }],
  })),
}));

import { conversationState, processTurn } from "./service";
import { completeAssistantOperation } from "./completion";
import { parseAssistantResultTable } from "../../src/shared/assistant-result-table";

const employeeId = "507f1f77bcf86cd799439022";
const secondEmployeeId = "507f1f77bcf86cd799439023";
const applicantId = "507f1f77bcf86cd799439032";
const jobId = "507f1f77bcf86cd799439033";
const financeDepartmentId = "507f1f77bcf86cd799439052";
const hrContractId = "507f1f77bcf86cd799439062";
const calendarEventId = "507f1f77bcf86cd799439092";
const trainingCourseId = "507f1f77bcf86cd799439088";
const kanbanTaskId = "507f1f77bcf86cd799439093";
const departmentName = "Phòng kinh doanh";
const branchId = "507f1f77bcf86cd799439012";
const nextMonthBirthday = () => {
  const current = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", month: "2-digit" }).format(new Date()));
  return `1990-${String(current === 12 ? 1 : current + 1).padStart(2, "0")}-04`;
};
const req = { user: { id: "actor", uid: "actor", email: "actor@example.com", companyCode: "TEST", branchId: "507f1f77bcf86cd799439012", role: "admin" }, headers: { authorization: "Bearer scoped" }, socket: { localPort: 4050, localAddress: "127.0.0.1" } } as any;
const audit = conversationAudit("hr");
const turn = (input: any) => audit.turn(input, () => processTurn(req, { conversationId: "hr-conversation", requestId: randomUUID(), ...input }));
const json = (data: unknown) => new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });

it.each([
  ["Cho tôi tổng số nhân sự được thêm từ 01/11 đến 30/11/2026", "employee.count", { createdFrom: "2026-11-01", createdTo: "2026-11-30" }, "/auth/users/count", "12"],
  ["Báo cáo những người đi trễ nhiều nhất tháng 11 năm 2026", "timekeeping.records.monthly.most-late", { month: 11, year: 2026 }, "/timekeeping/monthly-report", "Nguyễn Anh"],
  ["Cho xem phép còn lại của nhân viên năm 2026", "leave.balances.report", { query_year: 2026 }, "/leave/balances", "Phạm Gia Hân"],
] as const)("simulated AI report: %s", async (text, actionId, values, path, expected) => {
  const { interpretRequest } = await vi.importActual<typeof import("./semantic-interpreter")>("./semantic-interpreter");
  state.interpret.mockImplementation(interpretRequest);
  state.provider.mockResolvedValue({ text: JSON.stringify({ actionId, values }) });
  const reply = await turn({ text });
  expect(reply.status, JSON.stringify(reply)).toBe("completed");
  expect(reply.reply).toContain(expected);
  if (actionId === "employee.count") {
    expect(reply.reply).toContain("01/11/2026");
    expect(reply.reply).toContain("30/11/2026");
    expect(reply.reply).toContain("hồ sơ được tạo");
  }
  const call = fetcher.mock.calls.find(([url]) => new URL(String(url)).pathname.endsWith(path));
  expect(call).toBeDefined();
  const params = new URL(String(call![0])).searchParams;
  for (const [key, value] of Object.entries(values)) expect(params.get(key.replace(/^query_/, ""))).toBe(String(value));
  expect(fetcher.mock.calls.every(([, init]) => !init?.method || init.method === "GET")).toBe(true);
});

it("refuses a simulated HR report condition that has no supported field instead of dropping it", async () => {
  const { interpretRequest } = await vi.importActual<typeof import("./semantic-interpreter")>("./semantic-interpreter");
  state.interpret.mockImplementation(interpretRequest);
  state.provider.mockResolvedValue({ text: JSON.stringify({ actionId: "employee.count", values: { salaryGreaterThan: 20000000 } }) });
  const reply = await turn({ text: "Có bao nhiêu nhân viên lương trên 20 triệu?" });
  expect(reply.status).not.toBe("completed");
  expect(fetcher).not.toHaveBeenCalled();
});

it("must not answer an unfiltered headcount when simulated AI omits the user's salary condition", async () => {
  const { interpretRequest } = await vi.importActual<typeof import("./semantic-interpreter")>("./semantic-interpreter");
  state.interpret.mockImplementation(interpretRequest);
  state.provider.mockResolvedValue({ text: JSON.stringify({ actionId: "employee.count", values: {} }) });
  const reply = await turn({ text: "Có bao nhiêu nhân viên lương trên 20 triệu?" });
  expect(reply.status, JSON.stringify(reply)).not.toBe("completed");
});

it("simulated AI reads the overall business report with an explicit date range", async () => {
  const { interpretRequest } = await vi.importActual<typeof import("./semantic-interpreter")>("./semantic-interpreter");
  state.interpret.mockImplementation(interpretRequest);
  state.provider.mockResolvedValue({ text: JSON.stringify({ actionId: "dashboard.business-overview", values: { query_filter: "custom", query_startDate: "2026-11-01", query_endDate: "2026-11-30" } }) });
  fetcher.mockImplementation(async (url: URL) => {
    expect(new URL(String(url)).pathname).toBe("/api/v1/dashboard/business-overview");
    return json({ status: "success", data: { businessType: "education", range: { from: "2026-11-01", to: "2026-11-30" }, generatedAt: "2026-11-19T03:00:00.000Z", access: { education: true, hr: true }, errors: [],
      education: { students: 43, newStudents: 5, activeClasses: 3, tuition: 12500000, previousTuition: 9000000, series: [], classes: [], topClasses: [], missingTeachers: 0, unpaidStudents: 7 },
      hr: { employees: 12, checkedIn: 10, late: 2, tasks: { todo: 3, doing: 4, done: 5, total: 12 }, overdueTasks: 1, pendingApprovals: 2, expiringContracts: 0 },
      labor: null, partners: null, inventory: null, repair: null, finance: null, customer: null } });
  });
  const reply = await turn({ text: "Báo cáo tổng quan các thông tin kinh doanh từ 01/11 đến 30/11/2026" });
  expect(reply.status, JSON.stringify(reply)).toBe("completed");
  expect(reply.reply).toContain("43");
  expect(reply.reply).not.toContain("[object Object]");
  const query = Object.fromEntries(new URL(String(fetcher.mock.calls[0][0])).searchParams);
  expect(query).toMatchObject({ filter: "custom", startDate: "2026-11-01", endDate: "2026-11-30" });
  // Business-level check: task counts must never be presented as assets or money.
  expect(reply.reply).not.toContain("Tổng tài sản");
  expect(reply.reply).not.toContain("Trình độ học vấn");
  expect(reply.reply).not.toContain("Thông tin: Thông tin:");
});

it.each(["invalid-json", "invalid-action", "provider-rejected"])("simulated report handles AI failure without business API calls: %s", async scenario => {
  const { interpretRequest } = await vi.importActual<typeof import("./semantic-interpreter")>("./semantic-interpreter");
  state.interpret.mockImplementation(interpretRequest);
  if (scenario === "provider-rejected") state.provider.mockRejectedValue(new Error("Mock provider: insufficient credits"));
  else state.provider.mockResolvedValue({ text: scenario === "invalid-json" ? "not JSON" : JSON.stringify({ actionId: "invented.report", values: {} }) });
  const reply = await turn({ text: "Báo cáo tình hình nhân sự giúp tôi" });
  expect(reply.status).not.toBe("completed");
  expect(fetcher).not.toHaveBeenCalled();
});
const payrollRunId = "507f1f77bcf86cd799439701";
const payrollOctoberRunId = "507f1f77bcf86cd799439703";
const payrollPolicyId = "507f1f77bcf86cd799439702";
async function usePayrollConversationFixtures() {
  const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
  state.interpret.mockImplementation((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));
  const fallback = fetcher.getMockImplementation() as (url: URL, init?: RequestInit) => Promise<Response>;
  let policy = { _id: payrollPolicyId, name: "Thu nhập An Bình", code: "AB", status: "draft", version: 3, baseSalary: 2340000, regionalMinimumWage: 4960000 };
  let schedule = { enabled: true, day: 3, hour: 8, minute: 15, periodOffset: -1, version: 2 };
  fetcher.mockImplementation(async (url: URL, init?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    if (path === "/api/v1/payroll/runs") {
      const requestUrl = new URL(String(url));
      const runs = [
        { _id: payrollRunId, periodKey: "2028-02", type: "regular", status: "draft", version: 4 },
        { _id: payrollOctoberRunId, periodKey: "2026-10", type: "regular", status: "draft", version: 7 },
        { _id: "507f1f77bcf86cd799439704", periodKey: "2026-10", type: "regular", status: "closed", version: 8 },
      ];
      const rows = runs.filter(run => (!requestUrl.searchParams.has("periodKey") || requestUrl.searchParams.get("periodKey") === run.periodKey)
        && (!requestUrl.searchParams.has("status") || requestUrl.searchParams.get("status") === run.status));
      return json({ data: rows });
    }
    if (path === "/api/v1/payroll/policies") return json({ data: [policy] });
    if (path === `/api/v1/payroll/policies/${payrollPolicyId}` && init?.method === "PATCH") {
      policy = { ...policy, ...JSON.parse(String(init.body)), version: policy.version + 1 };
      return json({ data: policy });
    }
    if (path === "/api/v1/payroll/reconciliation-schedule") {
      if (init?.method === "PUT") schedule = { ...schedule, ...JSON.parse(String(init.body)), version: schedule.version + 1 };
      return json({ data: schedule });
    }
    if (/^\/api\/v1\/payroll\/runs\/[^/]+\/reconciliation\/publish$/.test(path)) return json({ data: { employeeCount: 2 } });
    if (path === `/api/v1/payroll/runs/${payrollRunId}/reconciliation`) return json({ data: {
      runStatus: "draft", employeeCount: 2, items: [
        { employeeName: "Lê Thu Hà", periodKey: "2028-02", issues: [{ id: "private-issue", field: "overtime", status: "open", messages: [
          { role: "employee", body: "Thiếu hai giờ tăng ca", at: "2028-03-01T01:00:00Z", authorId: "private-user" },
        ] }] },
        { employeeName: "Người không khiếu nại", periodKey: "2028-02", issues: [] },
      ],
    } });
    if (path === `/api/v1/payroll/runs/${payrollRunId}/payslip-review-requests`) return json({ data: [
      { _id: "private-review", employeeName: "Đỗ Minh Quân", periodKey: "2028-02", status: "resolved", message: "Kiểm tra phụ cấp", response: "Đã bổ sung", createdAt: "2028-03-02T01:30:00Z" },
    ] });
    if (path === "/api/v1/payroll/periods/2028-02/adjustments") return json({ data: [
      { _id: "private-adjustment", employeeName: "Lê Thu Hà", kind: "bonus", amount: 950000, reason: "Thưởng tháng", status: "pending" },
      { employeeName: "Đã phê duyệt", kind: "bonus", amount: 500000, reason: "Đã duyệt", status: "approved" },
      { employeeName: "Bị từ chối", kind: "deduction", amount: 100000, reason: "Từ chối", status: "rejected" },
    ] });
    return fallback(url, init);
  });
}

it("test keys 74–75 aggregate both payroll complaint sources through a structured result", async () => {
  await usePayrollConversationFixtures();
  const result = await turn({ text: "Tổng hợp khiếu nại về bảng lương kỳ 2028-02" });
  expect(result.status, result.reply).toBe("completed");
  expect(parseAssistantResultTable(result.reply)).not.toBeNull();
  for (const text of ["Lê Thu Hà", "Đỗ Minh Quân", "Thiếu hai giờ tăng ca", "Kiểm tra phụ cấp", "Đã bổ sung"]) expect(result.reply).toContain(text);
  expect(completeAssistantOperation).toHaveBeenCalledWith(expect.objectContaining({ status: "completed" }),
    expect.objectContaining({ operation: expect.objectContaining({ id: "payroll.run.complaints.list" }) }), expect.any(Array), expect.any(Function));
  expect(result.reply).not.toMatch(/private-|Người không khiếu nại|507f1f77/);
  for (const suffix of ["reconciliation", "payslip-review-requests"]) {
    const call = fetcher.mock.calls.find(([url]) => new URL(String(url)).pathname.endsWith(`/${payrollRunId}/${suffix}`));
    expect(call).toBeDefined();
    expect(new URL(String(call![0])).searchParams.get("branchId")).toBe(branchId);
  }
});

it("asks for the payroll run instead of treating a sending date as a run identifier", async () => {
  await usePayrollConversationFixtures();
  const result = await turn({ text: "Bảng lương đã được gửi về tài khoản ngày 12/11 cho các nhân sự, họ có khiếu nại gì không?" });
  expect(result.status).toBe("collecting");
  expect(result.referenceSelections?.some(selection => selection.key === "path_id")).toBe(true);
  expect(fetcher.mock.calls.some(([url]) => /\/runs\/[^/]+\/reconciliation$/.test(new URL(String(url)).pathname))).toBe(false);
});

it("test key 76 clarifies recurrence, preserves other schedule settings, and writes only after confirmation", async () => {
  await usePayrollConversationFixtures();
  const collecting = await turn({ text: "Đổi lịch tự động phát hành lương tạm tính sang ngày 22/12 lúc 9 giờ 45 phút" });
  expect(collecting.status).toBe("collecting");
  expect(collecting.reply).toContain("hằng tháng");
  const preview = await turn({ text: "Hằng tháng" });
  expect(preview.status, preview.reply).toBe("confirmation");
  expect(fetcher.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(false);
  const result = await turn({ decision: { id: preview.action!.id, confirmed: true } });
  expect(result.status, result.reply).toBe("completed");
  const write = fetcher.mock.calls.find(([url, init]) => String(url).includes("reconciliation-schedule") && init?.method === "PUT");
  expect(JSON.parse(String(write?.[1]?.body))).toEqual({ enabled: true, day: 22, hour: 9, minute: 45, periodOffset: -1, version: 2 });
});

it("test key 77 publishes provisional payroll only after selecting a run and confirming", async () => {
  await usePayrollConversationFixtures();
  const collecting = await turn({ text: "Giúp tôi phát hành bảng lương tạm tính" });
  expect(collecting.status).toBe("collecting");
  const runOption = collecting.referenceSelections!.find(selection => selection.key === "path_id")!.options[0].value;
  const preview = await turn({ referenceSelections: { path_id: [runOption] } });
  expect(preview.status, preview.reply).toBe("confirmation");
  expect(fetcher.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  const result = await turn({ decision: { id: preview.action!.id, confirmed: true } });
  expect(result.status, result.reply).toBe("completed");
  expect(parseAssistantResultTable(result.reply)).not.toBeNull();
  const writes = fetcher.mock.calls.filter(([, init]) => init?.method === "POST");
  expect(writes).toHaveLength(1);
  expect(new URL(String(writes[0][0])).pathname).toBe(`/api/v1/payroll/runs/${payrollRunId}/reconciliation/publish`);
  expect(JSON.parse(String(writes[0][1]?.body))).toEqual({ expectedVersion: 4 });
});

it("selects the draft run for a month-only request and confirms that exact payroll period", async () => {
  await usePayrollConversationFixtures();
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-17T18:00:00Z"));
  try {
    const collecting = await turn({ text: "Phát hành bảng lương tạm tính tháng 10" });
    expect(collecting.status, collecting.reply).toBe("confirmation");
    expect(collecting.action?.title).toContain("Phát hành bảng lương tạm tính");
    const runList = fetcher.mock.calls.find(([url]) => new URL(String(url)).pathname === "/api/v1/payroll/runs"
      && new URL(String(url)).searchParams.get("periodKey") === "2026-10");
    const query = new URL(String(runList?.[0])).searchParams;
    expect(query.get("periodKey")).toBe("2026-10");
    expect(query.get("status")).toBe("draft");

    const completed = await turn({ decision: { id: collecting.action!.id, confirmed: true } });
    expect(completed.status, completed.reply).toBe("completed");
    const write = fetcher.mock.calls.find(([url, init]) => new URL(String(url)).pathname === `/api/v1/payroll/runs/${payrollOctoberRunId}/reconciliation/publish` && init?.method === "POST");
    expect(write).toBeDefined();
    expect(JSON.parse(String(write?.[1]?.body))).toMatchObject({ expectedVersion: 7 });
  } finally { vi.useRealTimers(); }
});

it("explains that a month cannot be published when its draft payroll run is missing", async () => {
  await usePayrollConversationFixtures();
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-17T18:00:00Z"));
  const fallback = fetcher.getMockImplementation() as (url: URL, init?: RequestInit) => Promise<Response>;
  fetcher.mockImplementation((url: URL, init?: RequestInit) => new URL(String(url)).pathname === "/api/v1/payroll/runs"
    ? Promise.resolve(json({ data: [] }))
    : fallback(url, init));
  try {
    const result = await turn({ text: "Phát hành bảng lương tạm tính tháng 10" });
    expect(result.status).toBe("collecting");
    expect(result.reply).toContain("Không tìm thấy lượt lương nháp cho kỳ 2026-10");
    expect(result.reply).toContain("tạo lượt lương nháp cho kỳ này hoặc chọn một kỳ khác");
    expect(fetcher.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  } finally { vi.useRealTimers(); }
});

it("test key 78 asks for a period and displays only pending adjustments", async () => {
  await usePayrollConversationFixtures();
  const collecting = await turn({ text: "Các khoản nào đang cần chờ duyệt" });
  expect(collecting.status).toBe("collecting");
  const result = await turn({ text: "Tháng 2/2028" });
  expect(result.status, result.reply).toBe("completed");
  expect(parseAssistantResultTable(result.reply)).not.toBeNull();
  expect(result.reply).toContain("Lê Thu Hà");
  expect(result.reply).not.toMatch(/Đã phê duyệt|Bị từ chối|private-adjustment/);
});

it("test keys 79–80 rename the selected policy and update its base salary in the same conversation", async () => {
  await usePayrollConversationFixtures();
  const collecting = await turn({ text: "Đổi chính sách lương thành Thu nhập mới 2028" });
  expect(collecting.status).toBe("collecting");
  const policyOption = collecting.referenceSelections!.find(selection => selection.key === "path_id")!.options[0].value;
  const preview = await turn({ referenceSelections: { path_id: [policyOption] } });
  expect(preview.status, preview.reply).toBe("confirmation");
  expect(fetcher.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(false);
  // Supplement the selected policy before saving; do not select an employee or another policy.
  const salaryPreview = await turn({ text: "Cập nhật lương cơ bản lên 3450k" });
  expect(salaryPreview.status, salaryPreview.reply).toBe("confirmation");
  const result = await turn({ decision: { id: salaryPreview.action!.id, confirmed: true } });
  expect(result.status, result.reply).toBe("completed");
  const writes = fetcher.mock.calls.filter(([, init]) => init?.method === "PATCH");
  expect(writes).toHaveLength(1);
  expect(new URL(String(writes[0][0])).pathname).toBe(`/api/v1/payroll/policies/${payrollPolicyId}`);
  expect(JSON.parse(String(writes[0][1]?.body))).toMatchObject({ name: "Thu nhập mới 2028", baseSalary: 3450000, expectedVersion: 3 });
  expect(parseAssistantResultTable(result.reply)).not.toBeNull();
});

it("test key 80 asks whether an unqualified base salary belongs to a policy or employee", async () => {
  await usePayrollConversationFixtures();
  const result = await turn({ text: "Cập nhật lương cơ bản lên 3450k" });
  expect(result.status).toBe("collecting");
  expect(result.reply).toContain("nhân viên hay lương cơ bản trong chính sách");
  expect(fetcher.mock.calls.some(([, init]) => ["POST", "PATCH", "PUT"].includes(init?.method || ""))).toBe(false);
  const preview = await turn({ text: "Chính sách Thu nhập An Bình" });
  expect(preview.status, preview.reply).toBe("confirmation");
  const completed = await turn({ decision: { id: preview.action!.id, confirmed: true } });
  expect(completed.status, completed.reply).toBe("completed");
  const write = fetcher.mock.calls.find(([, init]) => init?.method === "PATCH");
  expect(JSON.parse(String(write?.[1]?.body))).toMatchObject({ baseSalary: 3450000 });
});

it("does not report an empty complaint list when either payroll source fails", async () => {
  await usePayrollConversationFixtures();
  const original = fetcher.getMockImplementation() as (url: URL, init?: RequestInit) => Promise<Response>;
  fetcher.mockImplementation((url: URL, init?: RequestInit) => String(url).includes("payslip-review-requests")
    ? Promise.resolve(new Response(JSON.stringify({ status: "error", message: "Không đọc được phiếu lương" }), { status: 503 }))
    : original(url, init));
  const result = await turn({ text: "Tổng hợp khiếu nại bảng lương kỳ 2028-02" });
  expect(result.status, JSON.stringify({ result, paths: fetcher.mock.calls.map(([url]) => String(url)) })).toBe("failed");
  expect(result.reply).not.toMatch(/Không có.*khiếu nại|không có dữ liệu/i);
});

it("can cancel provisional publication without sending a write", async () => {
  await usePayrollConversationFixtures();
  const preview = await turn({ text: "Phát hành bảng lương tạm tính kỳ 2028-02" });
  expect(preview.status, preview.reply).toBe("confirmation");
  await turn({ decision: { id: preview.action!.id, confirmed: false } });
  expect(fetcher.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
});

it("rejects invalid publication times before saving", async () => {
  await usePayrollConversationFixtures();
  const result = await turn({ text: "Đổi lịch phát hành lương tạm tính ngày 32 hằng tháng lúc 25 giờ" });
  expect(result.status).toBe("collecting");
  expect(fetcher.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(false);
});

it("asks which schedule setting to change when none was supplied", async () => {
  await usePayrollConversationFixtures();
  const result = await turn({ text: "Đổi lịch phát hành lương tạm tính" });
  expect(result.status, result.reply).toBe("collecting");
  expect(fetcher.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(false);
});

let fetcher: ReturnType<typeof vi.fn>;
let trainingCourses: Array<Record<string, unknown>>;
beforeEach(() => {
  audit.reset();
  state.memoryEnabled = false; state.saveMemory.mockReset();
  vi.mocked(completeAssistantOperation).mockClear();
  state.session = null; state.turns = []; state.interpret.mockReset(); state.provider.mockReset();
  state.includeStudentCourses = false;
  state.includeRecruitmentReport = true;
  trainingCourses = [{ _id: trainingCourseId, title: "hát", category: "Văn hóa", duration: "2 giờ", instructor: "Mai Anh" }];
  fetcher = vi.fn(async (url: URL, init?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    if (path === "/api/v1/auth/users/count" && (init?.method || "GET") === "GET") {
      const requestUrl = new URL(String(url));
      return requestUrl.searchParams.get("scope") === "company"
        ? json({ status: "success", data: { count: 12, scope: "company" } })
        : json({ status: "success", data: { count: 3, scope: "branch", branchName: "Chi nhánh A" } });
    }
    if (path === "/api/v1/recruitment/reports/assistant") return json({ data: {
      reportType: "interviewers", summary: "1 lịch phỏng vấn phù hợp.", total: 1,
      items: [{ applicantName: "Nguyễn An", jobTitle: "QA Lead", scheduledStart: "2026-11-18T02:00:00.000Z", interviewers: "Võ Minh Quân", result: "Đạt" }],
    } });
    if (path === "/api/v1/crud/training-courses") {
      if (init?.method === "POST") {
        const course = { _id: trainingCourseId, ...JSON.parse(String(init.body)) };
        trainingCourses = [course];
        return json({ status: "success", data: course });
      }
      return json({ status: "success", data: trainingCourses, total: trainingCourses.length });
    }
    if (path === `/api/v1/crud/training-courses/${trainingCourseId}`) {
      if (init?.method === "PATCH") trainingCourses[0] = { ...trainingCourses[0], ...JSON.parse(String(init.body)) };
      return json({ status: "success", data: trainingCourses[0] });
    }
    if (path === "/api/v1/auth/users" && (init?.method || "GET") === "GET") {
      const users = [
      { _id: employeeId, id: employeeId, displayName: "La Văn Sến", email: "sen@example.com", phone: "0901111222", monthlySalary: 35000000 },
      { _id: secondEmployeeId, id: secondEmployeeId, displayName: "Nguyễn Anh", email: "anh@example.com", department: "Phòng tài chính", birthDate: nextMonthBirthday(), monthlySalary: 9000000 },
      { _id: "507f1f77bcf86cd799439097", id: "507f1f77bcf86cd799439097", displayName: "Phạm Gia Hân", email: "han@example.com" },
      { _id: "507f1f77bcf86cd799439971", id: "507f1f77bcf86cd799439971", displayName: "Trần Minh", jobTitle: "Quản trị hệ thống", department: "IT" },
      { _id: "507f1f77bcf86cd799439972", id: "507f1f77bcf86cd799439972", displayName: "Hà My", jobTitle: "Hỗ trợ kỹ thuật", department: "IT" },
      { _id: "507f1f77bcf86cd799439973", id: "507f1f77bcf86cd799439973", displayName: "Cường", phone: "", jobTitle: "Nhân viên" },
      { _id: "507f1f77bcf86cd799439974", id: "507f1f77bcf86cd799439974", displayName: "IT1", department: "IT", monthlySalary: 12000000 },
      ];
      const department = new URL(String(url)).searchParams.get("department")?.toLocaleLowerCase("vi");
      return json(department ? users.filter(user => String(user.department || "").toLocaleLowerCase("vi").includes(department)) : users);
    }
    if (path === "/api/v1/hr/departments" && (init?.method || "GET") === "GET") return json({ data: [
      { id: "507f1f77bcf86cd799439042", name: departmentName, code: "KD", isActive: true, managerName: "Mai Anh", employeeCount: 3 },
      { id: financeDepartmentId, name: "Phòng tài chính", code: "TC", isActive: true, managerName: "Lê Minh", employeeCount: 6 },
      { id: "507f1f77bcf86cd799439072", name: "Phòng Marketing", code: "MKT", isActive: true, managerName: "Mai Anh", employeeCount: 3 },
      { id: "507f1f77bcf86cd799439098", name: "IT Support", code: "IT", isActive: true, managerName: "Trần Minh", employeeCount: 4 },
    ] });
    if (path === "/api/v1/branches" && (init?.method || "GET") === "GET") return json({ status: "success", data: [
      { _id: branchId, id: branchId, name: "Chi nhánh Hà Nội", code: "HN" },
    ] });
    if (path === "/api/v1/hr/departments/507f1f77bcf86cd799439042" && init?.method === "PATCH") return json({ data: { id: "507f1f77bcf86cd799439042", name: departmentName, code: "SALES", isActive: true, ...JSON.parse(String(init.body)) } });
    if (path === `/api/v1/hr/departments/${financeDepartmentId}` && init?.method === "PATCH") return json({ data: { id: financeDepartmentId, name: "kế toán tài chính", code: "TC", isActive: true, ...JSON.parse(String(init.body)) } });
    if (path === "/api/v1/auth/register-user" && init?.method === "POST") return json({ status: "success", data: { _id: employeeId, ...JSON.parse(String(init.body)) } });
    if (path === "/api/v1/recruitment/applicants" && (init?.method || "GET") === "GET") return json([{ _id: applicantId, id: applicantId, fullName: "Nguyễn Thị Mai", email: "mai@example.com", jobTitle: "Kế toán" }]);
    if (path === "/api/v1/recruitment/jobs" && (init?.method || "GET") === "GET") return json([{ _id: jobId, id: jobId, title: "Kế toán", code: "JOB-001", status: "open" }]);
    if (path === `/api/v1/auth/users/${employeeId}` && init?.method === "DELETE") return json({ status: "success", message: "Xóa nhân sự thành công" });
    if (path === `/api/v1/auth/users/${employeeId}` && init?.method === "PATCH") return json({ status: "success", data: { _id: employeeId, id: employeeId, displayName: "La Văn Sến", ...JSON.parse(String(init.body)) } });
    if (path === "/api/v1/auth/users/507f1f77bcf86cd799439973" && init?.method === "PATCH") return json({ status: "success", data: { _id: "507f1f77bcf86cd799439973", id: "507f1f77bcf86cd799439973", displayName: "Cường", ...JSON.parse(String(init.body)) } });
    if (path === "/api/v1/auth/users/507f1f77bcf86cd799439974" && init?.method === "PATCH") return json({ status: "success", data: { _id: "507f1f77bcf86cd799439974", id: "507f1f77bcf86cd799439974", displayName: "IT1", ...JSON.parse(String(init.body)) } });
    if (path === `/api/v1/auth/users/${secondEmployeeId}` && init?.method === "PATCH") return json({ status: "success", data: { _id: secondEmployeeId, id: secondEmployeeId, displayName: "Nguyễn Anh", ...JSON.parse(String(init.body)) } });
    if (path === "/api/v1/hr-contracts" && (init?.method || "GET") === "GET") {
      const requestUrl = new URL(String(url));
      const contractType = requestUrl.searchParams.get("contractType") || "";
      const expiryAlerts = contractType ? [
        { employeeName: "Phạm Gia Hân", contractType: "Thử việc", endDate: "2026-11-25", daysRemaining: 8 },
      ] : [
        { employeeName: "Nguyễn Anh", contractType: "Không xác định thời hạn", endDate: "2026-11-30", daysRemaining: 13 },
      ];
      return json({ data: {
        contracts: [{ _id: hrContractId, employeeId: secondEmployeeId, employeeName: "Nguyễn Anh", contractType: "Không xác định thời hạn", startDate: "2025-01-01", endDate: "2026-12-31", status: "active", salaryTerms: [{ contractSalary: 9000000 }] }],
        withoutContractEmployees: [{ id: employeeId, name: "La Văn Sến" }, { id: "507f1f77bcf86cd799439097", name: "Phạm Gia Hân" }],
        total: 1, expiryAlerts, expiryAlertTotal: expiryAlerts.length,
      } });
    }
    if (path === `/api/v1/hr-contracts/${hrContractId}/extensions` && init?.method === "POST") return json({ data: {
      contract: { _id: hrContractId, employeeId: secondEmployeeId, employeeName: "Nguyễn Anh", endDate: "2027-04-30T00:00:00.000Z" },
      extension: { contractId: hrContractId, employeeName: "Nguyễn Anh", previousEndDate: "2026-12-31T00:00:00.000Z", newEndDate: "2027-04-30T00:00:00.000Z", extensionDate: "2026-11-17T00:00:00.000Z" },
    } });
    if (path === "/api/v1/crud/training-enrollments" && (init?.method || "GET") === "GET") return json({
      data: [
        { _id: "507f1f77bcf86cd799439082", userName: "Nguyễn Anh", uid: secondEmployeeId, courseTitle: "An toàn lao động", progress: 35, status: "in_progress" },
        { _id: "507f1f77bcf86cd799439083", userName: "La Văn Sến", uid: employeeId, courseTitle: "An toàn lao động", progress: 100, status: "completed" },
        { _id: "507f1f77bcf86cd799439084", userName: "La Văn Sến", uid: employeeId, courseTitle: "Quy chế bảo mật", progress: 20, status: "in_progress" },
        { _id: "507f1f77bcf86cd799439085", userName: "Phạm Gia Hân", uid: "507f1f77bcf86cd799439097", courseTitle: "Hát dân ca", progress: 70, status: "in_progress" },
      ], total: 4,
    });
    if (path === "/api/v1/timekeeping/monthly-report" && (init?.method || "GET") === "GET") {
      const requestUrl = new URL(String(url));
      return json({ status: "success", data: { year: Number(requestUrl.searchParams.get("year")), month: Number(requestUrl.searchParams.get("month")), records: [
        { employeeName: "Nguyễn Anh", workedDays: 19, absentDays: 2, leaveDays: 1, daysOff: 3, lateDays: 3, leftEarlyDays: 0, unrecordedDays: 2 },
        { employeeName: "La Văn Sến", workedDays: 22, absentDays: 0, leaveDays: 0, daysOff: 0, lateDays: 0, leftEarlyDays: 0, unrecordedDays: 0 },
      ] } });
    }
    if (path === "/api/v1/timekeeping/records" && (init?.method || "GET") === "GET") return json({ status: "success", data: [
      { date: "2026-11-17", employeeName: "Nguyễn Anh", attendanceStatus: "Đã vào ca, đi muộn", checkIn: "08:12", checkOut: "17:30" },
      { date: "2026-11-17", employeeName: "La Văn Sến", attendanceStatus: "Chưa ghi nhận" },
      { date: "2026-11-17", employeeName: "Phạm Gia Hân", attendanceStatus: "Vắng" },
      { date: "2026-11-17", employeeName: "Nguyễn Mai", attendanceStatus: "Nghỉ phép" },
    ] });
    if (path === "/api/v1/timekeeping/records/adjust" && init?.method === "PATCH") return json({ status: "success", data: {
      date: "2026-11-16", status: "Present", checkIn: { time: "2026-11-16T00:59:00.000Z" }, checkOut: { time: "2026-11-16T11:00:00.000Z" },
      manuallyAdjusted: true, adjustmentReason: "Đi công tác",
    } });
    if (path === "/api/v1/leave/balances" && (init?.method || "GET") === "GET") return json({ status: "success", data: { year: 2026, balances: [
      { employeeName: "La Văn Sến", department: "Kế toán", entitlement: 12, used: 0, pending: 0, unexcused: 0, remaining: 12 },
      { employeeName: "Nguyễn Anh", department: "Marketing", entitlement: 12, used: 3, pending: 0, unexcused: 0, remaining: 9 },
      { employeeName: "Phạm Gia Hân", department: "Nhân sự", entitlement: 12, used: 12, pending: 0, unexcused: 0, remaining: 0 },
    ] } });
    if (path === "/api/v1/timekeeping/work-calendar" && (init?.method || "GET") === "GET") {
      const requestUrl = new URL(String(url));
      const days = [
        { _id: "507f1f77bcf86cd799439099", date: "2026-11-20", name: "Ngày nghỉ công ty", dayType: "holiday", isApplied: true },
        { _id: "507f1f77bcf86cd799439098", date: "2026-09-02", name: "Quốc khánh", dayType: "holiday", isApplied: true },
      ];
      const month = requestUrl.searchParams.get("month");
      return json(month ? days.filter(day => Number(day.date.slice(5, 7)) === Number(month)) : days);
    }
    if (path === "/api/v1/kanban/kpi/monthly" && (init?.method || "GET") === "GET") return json({ status: "success", data: {
      periodKey: "2026-11", periodStatus: "provisional", rows: [
        { employeeName: "Nguyễn Anh", totalTasks: 4, completedTasks: 2, pendingTasks: 2, percent: 50 },
        { employeeName: "La Văn Sến", totalTasks: 2, completedTasks: 2, pendingTasks: 0, percent: 100 },
        { employeeName: "Phạm Gia Hân", totalTasks: 0, completedTasks: 0, pendingTasks: 0, percent: null },
      ],
    } });
    if (path === "/api/v1/crud/hr-leave-applications" && (init?.method || "GET") === "GET") {
      const rangeStart = new URL(String(url)).searchParams.get("rangeStart") || "";
      if (rangeStart === "2026-11-17") return json({ status: "success", data: [
        { _id: "507f1f77bcf86cd799439094", employeeId, employeeName: "La Văn Sến", requestKind: "leave", type: "leave", startDate: "2026-11-17T00:00:00.000Z", endDate: "2026-11-17T00:00:00.000Z", chargeableDays: 1, status: "approved", reason: "Việc gia đình" },
        { _id: "507f1f77bcf86cd799439095", employeeId: secondEmployeeId, employeeName: "Nguyễn Anh", requestKind: "leave", type: "leave", startDate: "2026-11-17T00:00:00.000Z", endDate: "2026-11-17T00:00:00.000Z", chargeableDays: 1, status: "approved" },
        { _id: "507f1f77bcf86cd799439096", employeeId: "507f1f77bcf86cd799439097", employeeName: "Phạm Gia Hân", requestKind: "wfh", type: "wfh", startDate: "2026-11-17T00:00:00.000Z", endDate: "2026-11-17T00:00:00.000Z", status: "approved" },
      ], total: 3 });
      const monthRows = rangeStart.startsWith("2026-10") ? [
        { _id: "507f1f77bcf86cd799439094", employeeId, employeeName: "La Văn Sến", requestKind: "leave", type: "leave", startDate: "2026-10-05T00:00:00.000Z", endDate: "2026-10-06T00:00:00.000Z", chargeableDays: 2, status: "approved", reason: "Việc gia đình" },
        { _id: "507f1f77bcf86cd799439095", employeeId: secondEmployeeId, employeeName: "Nguyễn Anh", requestKind: "leave", type: "leave", startDate: "2026-10-09T00:00:00.000Z", endDate: "2026-10-09T00:00:00.000Z", chargeableDays: 1, status: "approved" },
        { _id: "507f1f77bcf86cd799439096", employeeId: secondEmployeeId, employeeName: "Nguyễn Anh", requestKind: "wfh", type: "wfh", startDate: "2026-10-12T00:00:00.000Z", endDate: "2026-10-14T00:00:00.000Z", status: "approved" },
      ] : [
        { _id: "507f1f77bcf86cd799439094", employeeId, employeeName: "La Văn Sến", requestKind: "leave", type: "leave", startDate: "2026-11-05T00:00:00.000Z", endDate: "2026-11-06T00:00:00.000Z", chargeableDays: 2, status: "approved", reason: "Việc gia đình" },
        { _id: "507f1f77bcf86cd799439095", employeeId: secondEmployeeId, employeeName: "Nguyễn Anh", requestKind: "leave", type: "leave", startDate: "2026-11-09T00:00:00.000Z", endDate: "2026-11-09T00:00:00.000Z", chargeableDays: 1, status: "approved" },
        { _id: "507f1f77bcf86cd799439096", employeeId: secondEmployeeId, employeeName: "Nguyễn Anh", requestKind: "wfh", type: "wfh", startDate: "2026-11-12T00:00:00.000Z", endDate: "2026-11-13T00:00:00.000Z", status: "approved" },
      ];
      return json({ status: "success", data: monthRows, total: monthRows.length });
    }
    if (path === "/api/v1/crud/hr-calendar-events" && (init?.method || "GET") === "GET") {
      const requestUrl = new URL(String(url));
      const startsAt = requestUrl.searchParams.get("rangeStart") || "";
      const endsAt = requestUrl.searchParams.get("rangeEnd") || "";
      const event = { _id: calendarEventId, title: "Họp tổng kết tuần", type: "meeting", startDate: "2026-11-21T00:00:00.000+07:00", endDate: "2026-11-21T01:00:00.000+07:00", status: "approved", location: "Phòng họp A" };
      const inRange = !startsAt || !endsAt || (event.startDate.slice(0, 10) <= endsAt && event.endDate.slice(0, 10) >= startsAt);
      return json({ status: "success", data: inRange ? [event] : [], total: inRange ? 1 : 0 });
    }
    if (path === "/api/v1/crud/hr-calendar-events" && init?.method === "POST") return json({ status: "success", data: {
      _id: calendarEventId, title: "Họp tổng kết tuần", type: "event", startDate: "2026-11-21T00:00:00.000Z", endDate: "2026-11-21T23:59:59.000Z", status: "approved", creatorId: employeeId,
    } });
    if (path === `/api/v1/crud/hr-calendar-events/${calendarEventId}` && init?.method === "PATCH") return json({ status: "success", data: {
      _id: calendarEventId, title: "Họp tổng kết tuần", type: "event", startDate: "2026-11-21T00:00:00.000Z", endDate: "2026-11-21T23:59:59.000Z", status: "approved", location: "Phòng họp tầng 2",
    } });
    if (path === "/api/v1/kanban/tasks" && (init?.method || "GET") === "GET") {
      const requestUrl = new URL(String(url));
      const tasks = [
        { _id: kanbanTaskId, title: "Dự hội thảo BNI EXPO ngày 20/11", assigneeUid: secondEmployeeId, assignee: "Nguyễn Anh", dueDate: "2026-11-20T00:00:00.000Z", priority: "High", status: "In Progress", progress: 25, branchId },
        { _id: "507f1f77bcf86cd799439098", title: "Kiểm thử sản phẩm mới 1234567890", assigneeUid: "507f1f77bcf86cd799439097", assignee: "Phạm Gia Hân", dueDate: "2026-11-18T00:00:00.000Z", priority: "Medium", status: "Done", progress: 100, branchId },
        { _id: "507f1f77bcf86cd799439099", title: "Chuẩn bị báo cáo quý", assigneeUid: employeeId, assignee: "La Văn Sến", dueDate: "2026-11-15T00:00:00.000Z", priority: "Low", status: "Not Started", progress: 0, branchId },
      ];
      const search = requestUrl.searchParams.get("search")?.toLocaleLowerCase("vi") || "";
      const status = requestUrl.searchParams.get("status") || "";
      const priority = requestUrl.searchParams.get("priority") || "";
      const assigneeUid = requestUrl.searchParams.get("assigneeUid") || "";
      const overdue = requestUrl.searchParams.get("overdue") === "true";
      const filtered = tasks.filter(task => (!search || task.title.toLocaleLowerCase("vi").includes(search))
        && (!status || task.status === status)
        && (!priority || task.priority === priority)
        && (!assigneeUid || task.assigneeUid === assigneeUid)
        && (!overdue || (new Date(task.dueDate).valueOf() < Date.now() && !["Done", "Archived"].includes(task.status))));
      return json({ status: "success", data: filtered });
    }
    if (path === `/api/v1/kanban/tasks/${kanbanTaskId}/activity` && init?.method === "PATCH") return json({ status: "success", data: {
      _id: kanbanTaskId, title: "Dự hội thảo BNI EXPO ngày 20/11", assignee: "Nguyễn Anh", dueDate: "2026-11-20T00:00:00.000Z", priority: "High", status: "In Progress", progress: 50,
    } });
    if (path === "/api/v1/recruitment/pipeline" && (init?.method || "GET") === "GET") return json({ status: "success", data: {
      version: 4, stages: [
        { id: "stage-1", name: "Tiếp nhận hồ sơ", color: "#111111", position: 0, isActive: true },
        { id: "stage-2", name: "Phỏng vấn", color: "#222222", position: 1, isActive: true },
      ],
    } });
    throw new Error(`Unexpected API: ${init?.method || "GET"} ${path}`);
  });
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => vi.unstubAllGlobals());
afterEach(context => audit.write(context, state, { persistedMockTurns: state.turns, pending: state.session?.pending }));

it.each([true, false])("creates an architecture project and handles optional data without duplicate creation: supplement=%s", async supplement => {
  const original = fetcher.getMockImplementation() as (...args: any[]) => Promise<Response>;
  const projectId = "e7c86155-ccf5-4dd4-bca5-312fc3be7c16";
  let project: any;
  fetcher.mockImplementation(async (url, init) => {
    const path = new URL(String(url)).pathname;
    if (path === "/api/v1/architect-assistant/projects") {
      if (init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        expect(body).toHaveProperty("requirements", "");
        project = { _id: projectId, ...body, revision: 1 }; return json({ project });
      }
      return json({ projects: project ? [project] : [] });
    }
    if (path === `/api/v1/architect-assistant/projects/${projectId}`) {
      if (init?.method === "PATCH") {
        const values = JSON.parse(String(init.body));
        expect(values.revision).toBe(project.revision);
        project = { ...project, ...values, revision: project.revision + 1 };
      }
      return json({ project });
    }
    return original(url, init);
  });
  state.interpret.mockResolvedValueOnce({ actionId: "architect.project.create", values: { name: "Nhà An", areaM2: 100, floors: 2, style: "Hiện đại" }, intentType: "workflow" });
  const preview = await turn({ text: "Tạo dự án Nhà An diện tích 100 m², 2 tầng, hiện đại" });
  expect(preview.status).toBe("confirmation");
  const created = await turn({ decision: { id: preview.action!.id, confirmed: true } });
  expect(created.status).toBe("completed");
  expect(created.reply).toContain("Bạn có muốn bổ sung không?");
  expect(parseAssistantResultTable(created.reply)).not.toBeNull();
  expect(created.reply).not.toContain(projectId);
  if (supplement) {
    await turn({ text: "có" });
    state.interpret.mockResolvedValueOnce({ actionId: "architect.project.update", values: { requirements: "Có sân vườn" }, intentType: "workflow", newRequest: false });
    const update = await turn({ text: "Bổ sung yêu cầu có sân vườn" });
    expect(update.status).toBe("confirmation");
    const updated = await turn({ decision: { id: update.action!.id, confirmed: true } });
    expect(updated.status).toBe("completed");
    expect(project.requirements).toBe("Có sân vườn");
    expect(parseAssistantResultTable(updated.reply)).not.toBeNull();
  } else await turn({ text: "bỏ qua" });
  expect(fetcher.mock.calls.filter(([url, init]) => new URL(String(url)).pathname === "/api/v1/architect-assistant/projects" && init?.method === "POST")).toHaveLength(1);
});

it("deletes an existing architecture project with its private current revision after confirmation", async () => {
  const projectId = "e7c86155-ccf5-4dd4-bca5-312fc3be7c16";
  const original = fetcher.getMockImplementation() as (...args: any[]) => Promise<Response>;
  fetcher.mockImplementation(async (url, init) => {
    const requestUrl = new URL(String(url));
    if (requestUrl.pathname === "/api/v1/architect-assistant/projects") return json({ projects: [{ _id: projectId, name: "Nhà cũ", revision: 7, areaM2: 100, floors: 2, style: "Hiện đại" }] });
    if (requestUrl.pathname === `/api/v1/architect-assistant/projects/${projectId}` && init?.method === "DELETE") {
      expect(requestUrl.searchParams.get("revision")).toBe("7");
      return json({ success: true });
    }
    return original(url, init);
  });
  state.interpret.mockResolvedValueOnce({ actionId: "architect.project.delete", values: { path_projectId: "Nhà cũ" }, intentType: "workflow" });
  const preview = await turn({ text: "Xóa dự án Nhà cũ" });
  expect(preview.status).toBe("confirmation");
  expect(JSON.stringify(preview)).not.toContain(projectId);
  expect(fetcher.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false);
  const result = await turn({ decision: { id: preview.action!.id, confirmed: true } });
  expect(result.status).toBe("completed");
  expect(fetcher.mock.calls.filter(([, init]) => init?.method === "DELETE")).toHaveLength(1);
});

it("looks up legal text with the API jurisdiction and preserves dated source citations", async () => {
  const original = fetcher.getMockImplementation() as (...args: any[]) => Promise<Response>;
  fetcher.mockImplementation(async (url, init) => {
    if (new URL(String(url)).pathname === "/api/v1/legal-reference/answer") {
      expect(JSON.parse(String(init?.body))).toMatchObject({ query: "Điều kiện áp dụng", jurisdiction: "central", asOf: "2026-11-18" });
      return json({ query: "Điều kiện áp dụng", asOf: "2026-11-18T00:00:00.000Z", answer: "Điều kiện theo nguồn [1].", sources: [{ citation: "[1]", symbol: "VB-01", title: "Văn bản thử nghiệm", sourceUrl: "https://example.com/source", versionNumber: 1, internalId: "private-source" }] });
    }
    return original(url, init);
  });
  state.interpret.mockResolvedValueOnce({ actionId: "legal.document.answer", values: { query: "Điều kiện áp dụng", jurisdiction: "central", asOf: "2026-11-18" }, intentType: "workflow" });
  const result = await turn({ text: "Tra điều kiện áp dụng văn bản trung ương ngày 18/11/2026" });
  expect(result.status).toBe("completed");
  expect(parseAssistantResultTable(result.reply)).not.toBeNull();
  expect(result.reply).toContain("[1]");
  expect(result.reply).toContain("VB-01");
  expect(result.reply).toContain("18/11/2026");
  expect(result.reply).not.toContain("private-source");
});

it("confirms a legal review decision against the selected task and formats its result", async () => {
  const reviewId = "507f1f77bcf86cd799439011";
  const original = fetcher.getMockImplementation() as (...args: any[]) => Promise<Response>;
  fetcher.mockImplementation(async (url, init) => {
    const path = new URL(String(url)).pathname;
    if (path === "/api/v1/legal-reference/review-queue") return json({ tasks: [{ id: reviewId, document: { title: "Văn bản thử nghiệm", symbol: "VB-01" }, taskType: "revision", reason: "Cần rà soát" }] });
    if (path === `/api/v1/legal-reference/review-queue/${reviewId}/decision`) {
      expect(JSON.parse(String(init?.body))).toMatchObject({ decision: "approve" });
      return json({ status: "resolved" });
    }
    return original(url, init);
  });
  state.interpret.mockResolvedValueOnce({ actionId: "legal.review.decision", values: { path_id: "Văn bản thử nghiệm", decision: "approve" }, intentType: "workflow" });
  const preview = await turn({ text: "Duyệt văn bản thử nghiệm" });
  expect(preview.status).toBe("confirmation");
  expect(fetcher.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(0);
  const result = await turn({ decision: { id: preview.action!.id, confirmed: true } });
  expect(result.status).toBe("completed");
  expect(parseAssistantResultTable(result.reply)).not.toBeNull();
  expect(result.reply).not.toContain(reviewId);
});

it("stores a terminology proposal only after explicit confirmation", async () => {
  state.memoryEnabled = true;
  state.interpret.mockResolvedValueOnce({ actionId: null, values: {}, intentType: "ambiguous", memoryProposal: "KT nghĩa là phòng Kế toán" });
  const proposal = await turn({ text: "Ở đây KT là cách gọi phòng Kế toán nhé" });
  expect(proposal.status).toBe("collecting");
  expect(state.saveMemory).not.toHaveBeenCalled();
  expect(state.session.pendingMemoryProposal).toBe("KT nghĩa là phòng Kế toán");
  const saved = await turn({ text: "đồng ý" });
  expect(saved.status).toBe("completed");
  expect(state.saveMemory).toHaveBeenCalledWith(req, "KT nghĩa là phòng Kế toán", "explicit");
  expect(state.session.pendingMemoryProposal).toBe("");
});

it("allows declining a terminology proposal", async () => {
  state.memoryEnabled = true;
  state.interpret.mockResolvedValueOnce({ actionId: null, values: {}, intentType: "ambiguous", memoryProposal: "KT nghĩa là phòng Kế toán" });
  await turn({ text: "KT là phòng Kế toán" });
  await turn({ text: "bỏ qua" });
  expect(state.saveMemory).not.toHaveBeenCalled();
  expect(state.session.pendingMemoryProposal).toBe("");
});

it("runs consecutive read steps through the shared completion path", async () => {
  state.interpret.mockResolvedValueOnce({ actionId: "employee.count", values: {}, intentType: "workflow", newRequest: true, remainingRequests: ["Đếm nhân viên lần nữa"] });
  state.interpret.mockResolvedValueOnce({ actionId: "employee.count", values: {}, intentType: "workflow", newRequest: false, remainingRequests: [] });
  const first = await turn({ text: "Đếm nhân viên rồi đếm lại" });
  expect(first.status).toBe("completed");
  expect(state.interpret.mock.calls.at(-1)?.[0]).toBe("Đếm nhân viên lần nữa");
  expect(state.session.remainingRequests).toEqual([]);
  expect(completeAssistantOperation).toHaveBeenCalledTimes(2);
  expect(state.turns[0].steps).toHaveLength(2);
  expect(new Set(state.turns[0].steps.map((step: any) => step.requestId)).size).toBe(2);
  expect(state.turns[0].steps.every((step: any) => step.status === "completed")).toBe(true);
});

it("retains unfinished steps when interpretation fails", async () => {
  state.interpret.mockResolvedValueOnce({ actionId: "employee.count", values: {}, intentType: "workflow", remainingRequests: ["Đếm lại"] });
  state.interpret.mockRejectedValueOnce(new Error("provider unavailable"));
  const failed = await turn({ text: "Đếm nhân viên rồi đếm lại" });
  expect(failed.status).toBe("failed");
  expect(state.session.remainingRequests).toEqual(["Đếm lại"]);
  expect(state.turns[0].steps).toHaveLength(1);
});

it.each([400, 422, 500])("a rejected new goal cannot resurrect the previous goal's queued steps (%s)", async status => {
  state.interpret.mockResolvedValueOnce({ actionId: "employee.count", values: {}, intentType: "workflow" });
  await turn({ text: "Đếm nhân viên" });
  state.session.remainingRequests = ["Sửa số điện thoại La Văn Sến"];
  const original = fetcher.getMockImplementation() as (...args: any[]) => Promise<Response>;
  fetcher.mockImplementation(async (...args) => new URL(String(args[0])).pathname === "/api/v1/auth/users/count"
    ? new Response(JSON.stringify({ message: "Phạm vi thống kê chưa hợp lệ" }), { status, headers: { "Content-Type": "application/json" } })
    : original(...args));
  state.interpret.mockResolvedValueOnce({ actionId: "employee.count", values: {}, intentType: "workflow", newRequest: true });
  const reply = await turn({ text: "Bỏ yêu cầu trước, đếm lại nhân viên thôi" });
  expect(reply.status).toBe("failed");
  expect(state.session.remainingRequests).toEqual([]);
  expect(fetcher.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(false);
});

it("stops before a write in a multi-step goal and preserves its preview", async () => {
  state.interpret.mockResolvedValueOnce({ actionId: "employee.count", values: {}, intentType: "workflow", remainingRequests: ["Sửa số điện thoại La Văn Sến"] });
  state.interpret.mockResolvedValueOnce({ actionId: "employee.update", values: { id: "La Văn Sến", phone: "0902222333" }, intentType: "workflow" });
  const reply = await turn({ text: "Đếm nhân viên rồi sửa điện thoại La Văn Sến" });
  expect(["confirmation", "collecting"]).toContain(reply.status);
  expect(state.session.pending.actionId).toBe("employee.update");
  expect(state.turns[0].steps).toHaveLength(1);
  expect(fetcher.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(false);
});

it("stops repeated reads with no new result and keeps unexecuted requests", async () => {
  state.interpret.mockResolvedValueOnce({ actionId: "employee.count", values: {}, intentType: "workflow", remainingRequests: Array.from({length: 6}, (_, i) => `Đếm lần ${i + 2}`) });
  state.interpret.mockResolvedValue({ actionId: "employee.count", values: {}, intentType: "workflow" });
  const reply = await turn({ text: "Đếm nhân viên bảy lần" });
  expect(reply.status).toBe("completed");
  expect(state.turns[0].steps).toHaveLength(2);
  expect(state.session.remainingRequests).toEqual(["Đếm lần 3", "Đếm lần 4", "Đếm lần 5", "Đếm lần 6", "Đếm lần 7"]);
});

it("stops a plan when an API result is uncertain without replaying the step", async () => {
  const original = fetcher.getMockImplementation() as (...args: any[]) => Promise<Response>;
  let calls = 0;
  fetcher.mockImplementation(async (...args) => {
    if (new URL(String(args[0])).pathname === "/api/v1/auth/users/count" && ++calls === 2) throw new Error("connection lost");
    return original(...args);
  });
  state.interpret.mockResolvedValueOnce({ actionId: "employee.count", values: {}, intentType: "workflow", remainingRequests: ["Đếm lần 2", "Đếm lần 3"] });
  state.interpret.mockResolvedValue({ actionId: "employee.count", values: {}, intentType: "workflow" });
  const reply = await turn({ text: "Đếm ba lần" });
  expect(reply.status).toBe("uncertain");
  expect(state.turns[0].steps).toHaveLength(2);
  expect(state.turns[0].steps[1].status).toBe("executing");
  expect(state.session.remainingRequests).toEqual([]);
});

it.each([true, false])("hides API defaults but preserves the same values when explicitly supplied: explicit=%s", async explicit => {
  const original = fetcher.getMockImplementation() as (...args: any[]) => Promise<Response>;
  fetcher.mockImplementation(async (url, init) => {
    if (new URL(String(url)).pathname === "/api/v1/auth/register-user" && init?.method === "POST") {
      return json({ status: "success", data: { _id: employeeId, division: "Nhân sự", phone: "Chưa cập nhật", ...JSON.parse(String(init.body)) } });
    }
    return original(url, init);
  });
  state.interpret.mockResolvedValueOnce({ actionId: "employee.create", values: {
    displayName: "An", email: "an@example.com", birthDate: "1995-01-01", ...(explicit ? { division: "Nhân sự" } : {}),
  }, intentType: "workflow" });
  await turn({ text: "Tạo nhân sự An" });
  const preview = await turn({ skipReferenceKeys: ["department"] });
  expect(preview.status).toBe("confirmation");
  const created = await turn({ decision: { id: preview.action!.id, confirmed: true, password: "test-secret-123" } });
  expect(created.status).toBe("completed");
  expect(created.reply).not.toContain("Chưa cập nhật");
  expect(created.reply).toContain("Số điện thoại");
  const table = parseAssistantResultTable(created.reply)!;
  expect(Object.values(table.rows[0].values).includes("Nhân sự")).toBe(explicit);
});

it("creates an employee by choosing a department and keeps the initial password out of the preview", async () => {
  state.interpret.mockResolvedValueOnce({ actionId: "employee.create", values: {
    displayName: "Trần Thu An", email: "an@example.com", birthDate: "1992-03-04", phone: "0901234567",
  }, intentType: "workflow", newRequest: true });

  const selectionPrompt = await turn({ text: "Thêm nhân sự Trần Thu An, email an@example.com" });
  expect(selectionPrompt.status).toBe("collecting");
  const department = selectionPrompt.referenceSelections?.find(group => group.key === "department");
  expect(department?.required).toBe(false);
  expect(department?.options.some(option => option.label.startsWith(departmentName))).toBe(true);
  expect(fetcher.mock.calls.some(([url, init]) => new URL(String(url)).pathname === "/api/v1/auth/register-user" && init?.method === "POST")).toBe(false);

  const preview = await turn({ referenceSelections: { department: [department!.options[0].value] } });
  expect(preview.status).toBe("confirmation");
  expect(preview.action?.requiresPassword).toBe(true);
  expect(JSON.stringify(preview)).toContain(departmentName);
  expect(JSON.stringify(preview)).not.toContain("initial-secret-123");

  const created = await turn({ decision: { id: preview.action!.id, confirmed: true, password: "initial-secret-123" } });
  const createCall = fetcher.mock.calls.find(([url, init]) => new URL(String(url)).pathname === "/api/v1/auth/register-user" && init?.method === "POST");
  expect(created.status).toBe("completed");
  expect(JSON.parse(String(createCall?.[1]?.body))).toMatchObject({
    displayName: "Trần Thu An", email: "an@example.com", birthDate: "1992-03-04", phone: "0901234567",
    department: departmentName, password: "initial-secret-123", role: "user", companyCode: "TEST", branchId,
  });
  expect(JSON.stringify(created)).not.toContain("initial-secret-123");
});

it("updates a department field by selecting its name and preserves that name", async () => {
  state.interpret.mockResolvedValueOnce({ actionId: "department.update", values: { code: "SALES" }, intentType: "workflow", newRequest: true });

  const selectionPrompt = await turn({ text: "Đổi mã phòng kinh doanh thành SALES" });
  expect(selectionPrompt.status).toBe("collecting");
  expect(selectionPrompt.referenceSelections?.some(group => group.key === "managerUid")).toBe(false);
  const selection = selectionPrompt.referenceSelections?.find(group => group.key === "id");
  expect(selection?.options.some(option => option.label.startsWith(departmentName))).toBe(true);

  const preview = await turn({ referenceSelections: { id: [selection!.options[0].value] } });
  expect(preview.status).toBe("confirmation");
  expect(JSON.stringify(preview)).toContain(departmentName);
  expect(JSON.stringify(preview)).toContain("SALES");

  const updated = await turn({ decision: { id: preview.action!.id, confirmed: true } });
  const updateCall = fetcher.mock.calls.find(([url, init]) => new URL(String(url)).pathname === "/api/v1/hr/departments/507f1f77bcf86cd799439042" && init?.method === "PATCH");
  expect(updated.status).toBe("completed");
  expect(JSON.parse(String(updateCall?.[1]?.body))).toMatchObject({ name: departmentName, code: "SALES" });
});

it("lets a beginner choose the employee by name and confirms before deleting", async () => {
  state.interpret.mockResolvedValueOnce({ actionId: "employee.delete", values: {}, intentType: "workflow", newRequest: true });

  const selectionPrompt = await turn({ text: "Xóa nhân sự La Văn Sến" });
  expect(selectionPrompt.status).toBe("collecting");
  const selection = selectionPrompt.referenceSelections?.find(group => group.key === "id");
  expect(selection?.options.map(option => option.label)).toContain("La Văn Sến");
  expect(selectionPrompt.reply).not.toContain(employeeId);

  const preview = await turn({ referenceSelections: { id: [selection!.options[0].value] } });
  expect(preview.status).toBe("confirmation");
  expect(preview.action?.title).toBe("Xóa tài khoản nhân sự");
  expect(JSON.stringify(preview)).toContain("La Văn Sến");
  expect(JSON.stringify(preview)).not.toContain(employeeId);
  expect(JSON.stringify(preview)).not.toContain("35000000");

  const deleted = await turn({ decision: { id: preview.action!.id, confirmed: true } });
  expect(deleted.status).toBe("completed");
  expect(deleted.reply).toContain("La Văn Sến");
  expect(fetcher.mock.calls.filter(([url, init]) => new URL(String(url)).pathname === `/api/v1/auth/users/${employeeId}` && init?.method === "DELETE")).toHaveLength(1);
});

it("finds an employee by the accented name and returns a safe, readable result", async () => {
  const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
  state.interpret.mockImplementationOnce((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));

  const result = await turn({ text: "Thông tin nhân sự La Văn Sến" });

  expect(result.status).toBe("completed");
  const values = parseAssistantResultTable(result.reply)?.rows[0]?.values;
  expect(values).toMatchObject({ "Họ và tên": "La Văn Sến", "Email": "sen@example.com" });
  expect(result.reply).not.toContain(employeeId);
  expect(result.reply).not.toContain("35000000");
});

it("counts the whole company even when the account is assigned to a branch", async () => {
  state.interpret.mockResolvedValueOnce({ actionId: "employee.count", values: {}, intentType: "workflow", newRequest: true });

  const result = await turn({ text: "Tổng số nhân sự của công ty" });

  expect(result.status).toBe("completed");
  expect(result.reply).toContain("Có 12 nhân sự trong toàn công ty, bao gồm các chi nhánh");
  const request = fetcher.mock.calls.find(([url]) => new URL(String(url)).pathname === "/api/v1/auth/users/count");
  const query = new URL(String(request?.[0])).searchParams;
  expect(query.get("scope")).toBe("company");
  expect(query.has("branchId")).toBe(false);
});

it("answers department count questions from the named department only", async () => {
  const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
  state.interpret.mockImplementationOnce((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));

  const result = await turn({ text: "phòng tài chính có bao nhiêu nhân sự" });

  expect(result.status).toBe("completed");
  const values = parseAssistantResultTable(result.reply)?.rows[0]?.values;
  expect(values).toMatchObject({ "Phòng ban": "Phòng tài chính", "Trưởng phòng": "Lê Minh", "Số nhân sự": "6" });
  expect(result.reply).not.toContain(departmentName);
  const lookup = fetcher.mock.calls.find(([url, init]) => new URL(String(url)).pathname === "/api/v1/hr/departments" && (init?.method || "GET") === "GET");
  expect(new URL(String(lookup?.[0])).searchParams.has("search")).toBe(false);
});

it("finds a department by part of its name after separating the word 'Phòng'", async () => {
  const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
  state.interpret.mockImplementationOnce((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));

  const result = await turn({ text: "phòng IT có bao nhiêu nhân sự" });

  expect(result.status).toBe("completed");
  expect(parseAssistantResultTable(result.reply)?.rows[0]?.values).toMatchObject({
    "Phòng ban": "IT Support",
    "Số nhân sự": "4",
  });
});

it("lists employees by a partial department name instead of searching employee names", async () => {
  const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
  state.interpret.mockImplementationOnce((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));

  const result = await turn({ text: "danh sách nhân sự phòng IT" });
  const request = fetcher.mock.calls.find(([url]) => {
    const requestUrl = new URL(String(url));
    return requestUrl.pathname === "/api/v1/auth/users" && requestUrl.searchParams.get("department") === "IT";
  });

  expect(result.status).toBe("completed");
  expect(parseAssistantResultTable(result.reply)?.rows.map(row => row.values["Nhân sự"])).toEqual(["Trần Minh", "Hà My", "IT1"]);
  expect(result.reply).not.toContain("Nguyễn Anh");
  expect(new URL(String(request?.[0])).searchParams.has("search")).toBe(false);
  expect(result.reply).not.toContain("507f1f77bcf86cd799439971");
});

it("looks up the manager for any requested department", async () => {
  const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
  for (const [text, department, manager] of [
    ["ai là quản lý phòng tài chính?", "Phòng tài chính", "Lê Minh"],
    ["ai quản lý phòng Marketing?", "Phòng Marketing", "Mai Anh"],
  ]) {
    state.interpret.mockImplementationOnce((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));

    const result = await turn({ text });

    expect(result.status).toBe("completed");
    expect(result.reply).toContain(department);
    expect(result.reply).toContain(manager);
    expect(result.reply).not.toContain(department === "Phòng tài chính" ? "Phòng Marketing" : "Phòng tài chính");
  }
});

it("renames the department selected by its existing name", async () => {
  const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
  state.interpret.mockImplementationOnce((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));

  const preview = await turn({ text: "sửa phòng tài chính thành kế toán tài chính" });

  expect(preview.status).toBe("confirmation");
  expect(JSON.stringify(preview)).toContain("Phòng tài chính");
  expect(JSON.stringify(preview)).toContain("kế toán tài chính");
  const result = await turn({ decision: { id: preview.action!.id, confirmed: true } });
  const update = fetcher.mock.calls.find(([url, init]) => new URL(String(url)).pathname === `/api/v1/hr/departments/${financeDepartmentId}` && init?.method === "PATCH");
  expect(result.status).toBe("completed");
  expect(JSON.parse(String(update?.[1]?.body))).toMatchObject({ name: "kế toán tài chính" });
});

it("replaces an employee phone number that was already set", async () => {
  const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
  state.interpret.mockImplementationOnce((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));

  const preview = await turn({ text: "bổ sung số điện thoại cho nhân sự La Văn Sến 0988373736" });

  expect(preview.status).toBe("confirmation");
  expect(JSON.stringify(preview)).toContain("0988373736");
  const result = await turn({ decision: { id: preview.action!.id, confirmed: true } });
  const update = fetcher.mock.calls.find(([url, init]) => new URL(String(url)).pathname === `/api/v1/auth/users/${employeeId}` && init?.method === "PATCH");
  expect(result.status).toBe("completed");
  expect(JSON.parse(String(update?.[1]?.body))).toMatchObject({ phone: "0988373736" });
  expect(result.reply).not.toContain("35000000");
});

it("asks for a missing phone number and updates the selected employee instead of creating a new one", async () => {
  const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
  state.interpret.mockImplementation((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));

  const question = await turn({ text: "bổ sung số điện thoại cho nhân sự Cường" });
  expect(question.status).toBe("collecting");
  expect(question.reply).toContain("số điện thoại mới");
  expect(question.action?.title).toContain("Cập nhật");

  const preview = await turn({ text: "0987654321" });
  expect(preview.status).toBe("confirmation");
  expect(JSON.stringify(preview)).toContain("0987654321");
  expect(JSON.stringify(preview)).not.toContain("Họ và tên");

  const result = await turn({ decision: { id: preview.action!.id, confirmed: true } });
  const update = fetcher.mock.calls.find(([url, init]) => new URL(String(url)).pathname === "/api/v1/auth/users/507f1f77bcf86cd799439973" && init?.method === "PATCH");
  expect(result.status).toBe("completed");
  expect(JSON.parse(String(update?.[1]?.body))).toMatchObject({ phone: "0987654321" });
  expect(fetcher.mock.calls.some(([url, init]) => new URL(String(url)).pathname === "/api/v1/auth/register-user" && init?.method === "POST")).toBe(false);
});

it("lets the user choose an applicant and job from the chat when scheduling an interview", async () => {
  const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
  state.interpret.mockImplementationOnce((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));

  const prompt = await turn({ text: "Thêm lịch phỏng vấn" });

  expect(prompt.status).toBe("collecting");
  expect(prompt.action?.title).toContain("lịch phỏng vấn");
  const applicants = prompt.referenceSelections?.find(group => group.key === "applicantId");
  const jobs = prompt.referenceSelections?.find(group => group.key === "jobId");
  const interviewers = prompt.referenceSelections?.find(group => group.key === "interviewerIds");
  expect(applicants?.options.map(option => option.label)).toContain("Nguyễn Thị Mai");
  expect(jobs?.options.map(option => option.label)).toContain("Kế toán — mã JOB-001");
  expect(interviewers?.options.length).toBeGreaterThan(0);
  expect(prompt.referenceSelections?.some(group => group.key === "managerUid")).toBe(false);
  expect(JSON.stringify(prompt)).not.toContain(applicantId);
  expect(JSON.stringify(prompt)).not.toContain(jobId);
  expect(prompt.reply).not.toContain(branchId);

  const afterSelection = await turn({ referenceSelections: {
    applicantId: [applicants!.options[0].value],
    jobId: [jobs!.options[0].value],
    interviewerIds: [interviewers!.options[0].value],
    format: ["online"],
  } });
  expect(afterSelection.status).toBe("collecting");
  expect(afterSelection.reply).toContain("Thời gian bắt đầu");
  const interviewerValue = afterSelection.action?.values.find(value => value.label === "Người phỏng vấn")?.value;
  expect(interviewerValue).toBe(interviewers!.options[0].label);
  expect(interviewerValue).not.toMatch(/^[\[{]|[\]{}"]$/);
});

it("test keys 82–107 return recruitment reports as structured results through the shared completion path", async () => {
  state.interpret.mockResolvedValueOnce({
    actionId: "recruitment.report",
    values: { query_reportType: "interviewers", query_from: "2026-11-18", query_to: "2026-11-18", query_search: "QA Lead" },
    intentType: "workflow",
    newRequest: true,
  });
  const result = await turn({ text: "Hôm nay có buổi phỏng vấn vị trí QA Lead, ai đã phỏng vấn?" });
  expect(result.status, result.reply).toBe("completed");
  expect(parseAssistantResultTable(result.reply)).not.toBeNull();
  expect(result.reply).toContain("Nguyễn An");
  expect(result.reply).toContain("Võ Minh Quân");
  expect(completeAssistantOperation).toHaveBeenCalledWith(expect.objectContaining({ status: "completed" }),
    expect.objectContaining({ operation: expect.objectContaining({ id: "recruitment.report" }) }), expect.any(Array), expect.any(Function));
  const reportRequest = fetcher.mock.calls.find(([url]) => new URL(String(url)).pathname === "/api/v1/recruitment/reports/assistant");
  expect(new URL(String(reportRequest?.[0])).searchParams.get("reportType")).toBe("interviewers");
  expect(new URL(String(reportRequest?.[0])).searchParams.get("search")).toBe("QA Lead");
});

it("routes tomorrow's interview schedule question to the recruitment report", async () => {
  const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
  state.interpret.mockImplementationOnce((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-17T17:00:00.000Z"));
  try {
    const result = await turn({ text: "Ngày mai có lịch phỏng vấn ứng viên nào" });
    expect(result.status, result.reply).toBe("completed");
    expect(parseAssistantResultTable(result.reply)).not.toBeNull();
    const reportRequest = fetcher.mock.calls.find(([url]) => new URL(String(url)).pathname === "/api/v1/recruitment/reports/assistant");
    const params = new URL(String(reportRequest?.[0])).searchParams;
    expect(params.get("reportType")).toBe("interviews");
    expect(params.get("from")).toBe("2026-11-19");
    expect(params.get("to")).toBe("2026-11-19");
    expect(fetcher.mock.calls.some(([url]) => new URL(String(url)).pathname.includes("hr-calendar-events"))).toBe(false);
  } finally {
    vi.useRealTimers();
  }
});

it("answers active applicant counts by department through the recruitment report", async () => {
  const { interpretRequest } = await vi.importActual<typeof import("./semantic-interpreter")>("./semantic-interpreter");
  state.interpret.mockImplementation(interpretRequest);
  fetcher.mockImplementation(async (url: URL, init?: RequestInit) => {
    const requestUrl = new URL(String(url));
    if (requestUrl.pathname === "/api/v1/recruitment/reports/assistant") {
      expect(init?.method || "GET").toBe("GET");
      expect(requestUrl.searchParams.get("reportType")).toBe("applicants-by-department");
      return json({ data: {
        reportType: "applicants-by-department",
        summary: "2 phÃ²ng ban cÃ³ á»©ng viÃªn Ä‘ang á»©ng tuyá»ƒn.",
        total: 2,
        items: [{ name: "PhÃ²ng kinh doanh", count: 3 }, { name: "PhÃ²ng Marketing", count: 2 }],
      } });
    }
    throw new Error(`Unexpected API path ${requestUrl.pathname}`);
  });

  const result = await turn({ mode: "qa", text: "Thống kê số ứng viên đang ứng tuyển vào từng phòng ban" });

  expect(result.status, JSON.stringify(result)).toBe("completed");
  expect(result.reply).toContain("PhÃ²ng kinh doanh");
  expect(result.reply).toContain("PhÃ²ng Marketing");
  expect(result.reply).toContain("3");
  expect(result.reply).toContain("2");
  expect(parseAssistantResultTable(result.reply)?.rows).toHaveLength(2);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(state.provider).not.toHaveBeenCalled();
});

it("does not substitute calendar events when the recruitment report workflow is unavailable", async () => {
  const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
  state.includeRecruitmentReport = false;
  state.interpret.mockImplementationOnce((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-17T17:00:00.000Z"));
  try {
    const result = await turn({ text: "Ngày mai có lịch phỏng vấn ứng viên nào" });
    expect(result.status).toBe("unsupported");
    expect(result.reply).not.toContain("demo sản phẩm cho khách");
    expect(fetcher.mock.calls.some(([url]) => new URL(String(url)).pathname.includes("hr-calendar-events"))).toBe(false);
  } finally {
    vi.useRealTimers();
  }
});

it("transfers an employee to a selected department only after confirmation", async () => {
  const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
  state.interpret.mockImplementationOnce((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));

  const preview = await turn({ text: "chuyển nhân sự Nguyễn Anh sang phòng Marketing" });
  expect(preview.status).toBe("confirmation");
  expect(JSON.stringify(preview)).toContain("Phòng Marketing");
  expect(JSON.stringify(preview)).not.toContain(secondEmployeeId);

  const result = await turn({ decision: { id: preview.action!.id, confirmed: true } });
  const update = fetcher.mock.calls.find(([url, init]) => new URL(String(url)).pathname === `/api/v1/auth/users/${secondEmployeeId}` && init?.method === "PATCH");
  expect(result.status).toBe("completed");
  expect(JSON.parse(String(update?.[1]?.body))).toMatchObject({ department: "Phòng Marketing" });
});

it("changes a requested salary with an explicit confirmation", async () => {
  const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
  state.interpret.mockImplementationOnce((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));

  const preview = await turn({ text: "Sửa lương cho Nguyễn Anh thành 12 triệu" });
  expect(preview.status).toBe("confirmation");
  expect(JSON.stringify(preview)).toContain("12000000");
  const result = await turn({ decision: { id: preview.action!.id, confirmed: true } });
  const update = fetcher.mock.calls.find(([url, init]) => new URL(String(url)).pathname === `/api/v1/auth/users/${secondEmployeeId}` && init?.method === "PATCH");
  expect(result.status).toBe("completed");
  expect(JSON.parse(String(update?.[1]?.body))).toMatchObject({ monthlySalary: 12000000 });
});

it("updates the base salary of the named employee instead of payroll-period inputs", async () => {
  const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
  state.interpret.mockImplementationOnce((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));

  const preview = await turn({ text: "sửa lương cơ bản của nhân sự IT1 thành 20 triệu" });
  expect(preview.status).toBe("confirmation");
  expect(preview.action?.title).toContain("Cập nhật nhân sự");
  expect(preview.action?.values.find(value => value.label === "Lương tháng")?.value).toBe(20000000);

  const result = await turn({ decision: { id: preview.action!.id, confirmed: true } });
  const update = fetcher.mock.calls.find(([url, init]) => new URL(String(url)).pathname === "/api/v1/auth/users/507f1f77bcf86cd799439974" && init?.method === "PATCH");
  expect(result.status).toBe("completed");
  expect(JSON.parse(String(update?.[1]?.body))).toMatchObject({ monthlySalary: 20000000 });
  expect(fetcher.mock.calls.some(([url]) => new URL(String(url)).pathname.includes("/payroll/periods/"))).toBe(false);
});

it("assigns, changes, and removes an employee job title through confirmed profile updates", async () => {
  const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
  state.interpret.mockImplementation((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));

  for (const [index, example] of [
    ["Đặt nhân sự Nguyễn Anh làm trưởng nhóm", "trưởng nhóm"],
    ["đổi chức danh cho Nguyễn Anh thành giám đốc tài chính", "giám đốc tài chính"],
    ["hủy chức vụ trưởng nhóm của Nguyễn Anh", ""],
  ].entries()) {
    const conversationId = `job-title-${index}`;
    const preview = await turn({ conversationId, text: example[0] });
    expect(preview.status, `${example[0]} — ${preview.reply} — ${JSON.stringify(preview.referenceSelections)}`).toBe("confirmation");
    const result = await turn({ conversationId, decision: { id: preview.action!.id, confirmed: true } });
    const updates = fetcher.mock.calls.filter(([url, init]) => new URL(String(url)).pathname === `/api/v1/auth/users/${secondEmployeeId}` && init?.method === "PATCH");
    expect(result.status).toBe("completed");
    expect(JSON.parse(String(updates.at(-1)?.[1]?.body))).toMatchObject({ jobTitle: example[1] });
  }
});

it("sets a department manager and requires confirmation before saving", async () => {
  const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
  state.interpret.mockImplementationOnce((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));

  const preview = await turn({ text: "Đưa nhân sự Nguyễn Anh làm quản lí phòng tài chính" });
  expect(preview.status).toBe("confirmation");
  expect(JSON.stringify(preview)).toContain("Nguyễn Anh");
  expect(JSON.stringify(preview)).not.toContain(secondEmployeeId);
  const result = await turn({ decision: { id: preview.action!.id, confirmed: true } });
  const update = fetcher.mock.calls.find(([url, init]) => new URL(String(url)).pathname === `/api/v1/hr/departments/${financeDepartmentId}` && init?.method === "PATCH");
  expect(result.status).toBe("completed");
  expect(JSON.parse(String(update?.[1]?.body))).toMatchObject({ managerUid: secondEmployeeId });
});

it("extends the matching HR contract and displays the new expiry date", async () => {
  const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
  state.interpret.mockImplementationOnce((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));

  const preview = await turn({ text: "gia hạn hợp đồng cho nhân sự Nguyễn Anh thành 30/4/2027" });
  expect(preview.status).toBe("confirmation");
  expect(JSON.stringify(preview)).toContain("30/04/2027");
  expect(JSON.stringify(preview)).not.toContain(hrContractId);
  const result = await turn({ decision: { id: preview.action!.id, confirmed: true } });
  const extension = fetcher.mock.calls.find(([url, init]) => new URL(String(url)).pathname === `/api/v1/hr-contracts/${hrContractId}/extensions` && init?.method === "POST");
  expect(result.status).toBe("completed");
  expect(result.reply).toContain("30/04/2027");
  expect(JSON.parse(String(extension?.[1]?.body))).toMatchObject({ newEndDate: "2027-04-30", extensionDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
});

it("reports expiring contracts for any requested employee contract type and alert window", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-17T08:00:00.000Z"));
  try {
    const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
    state.interpret.mockImplementation((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));

    const general = await turn({ text: "Nhân sự nào sắp hết hợp đồng" });
    expect(general.status).toBe("completed");
    expect(general.reply).toContain("Nguyễn Anh");
    expect(general.reply).not.toContain("Phạm Gia Hân");

    const trial = await turn({ text: "Lọc danh sách các nhân sự chuẩn bị hết hạn hợp đồng thử việc trong 10 ngày tới" });
    const request = fetcher.mock.calls.filter(([url]) => new URL(String(url)).pathname === "/api/v1/hr-contracts" && (new URL(String(url)).searchParams.get("contractType") || "") === "thử việc").at(-1);
    const requestUrl = new URL(String(request?.[0]));
    expect(trial.status).toBe("completed");
    expect(requestUrl.searchParams.get("alertDays")).toBe("10");
    expect(trial.reply).toContain("Phạm Gia Hân");
    expect(trial.reply).not.toContain("Nguyễn Anh");
  } finally {
    vi.useRealTimers();
  }
});

it("reports employees who do not have an active contract without exposing their IDs", async () => {
  const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
  state.interpret.mockImplementationOnce((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));

  const result = await turn({ text: "Ai nhân sự nào còn thiếu hợp đồng" });

  expect(result.status).toBe("completed");
  expect(result.reply).toContain("La Văn Sến");
  expect(result.reply).toContain("Phạm Gia Hân");
  expect(result.reply).not.toContain(employeeId);
  expect(result.reply).not.toContain("507f1f77bcf86cd799439097");
});

it("collects required contract details for the requested employee before creating a contract", async () => {
  const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
  state.interpret.mockImplementationOnce((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));

  const result = await turn({ text: "Tạo hợp đồng cho nhân sự Phạm Gia Hân" });

  expect(result.status).toBe("collecting");
  expect(JSON.stringify(result)).toContain("Phạm Gia Hân");
  expect(result.reply).toMatch(/loại hợp đồng|ngày bắt đầu|ngày kết thúc/i);
  expect(fetcher.mock.calls.some(([url, init]) => new URL(String(url)).pathname === "/api/v1/hr-contracts" && init?.method === "POST")).toBe(false);
});

it("reports only incomplete internal training enrollments in the shared table", async () => {
  const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
  state.interpret.mockImplementationOnce((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));

  const result = await turn({ text: "Kiểm tra ai chưa hoàn thành các bài học trong đào tạo nội bộ" });
  expect(result.status).toBe("completed");
  const rows = parseAssistantResultTable(result.reply)?.rows || [];
  expect(rows).toHaveLength(3);
  expect(rows[0].values).toMatchObject({ "Nhân sự": "Nguyễn Anh", "Khóa đào tạo": "An toàn lao động", "Tiến độ": "35%" });
  expect(rows[1].values).toMatchObject({ "Nhân sự": "La Văn Sến", "Khóa đào tạo": "Quy chế bảo mật", "Tiến độ": "20%" });
  expect(rows[2].values).toMatchObject({ "Nhân sự": "Phạm Gia Hân", "Khóa đào tạo": "Hát dân ca", "Tiến độ": "70%" });
  expect(result.reply).not.toContain(secondEmployeeId);
});

it("filters incomplete training by the course title supplied by the user", async () => {
  const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
  for (const [courseName, employeeName] of [["Quy chế bảo mật", "La Văn Sến"], ["An toàn lao động", "Nguyễn Anh"], ["hát", "Phạm Gia Hân"]]) {
    state.interpret.mockImplementationOnce((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));

    const result = await turn({ text: `những nhân sự nào chưa hoàn thành khóa học ${courseName}` });
    const request = fetcher.mock.calls.filter(([url]) => new URL(String(url)).pathname === "/api/v1/crud/training-enrollments").at(-1);
    expect(result.status).toBe("completed");
    const requestUrl = new URL(String(request?.[0]));
    expect(requestUrl.searchParams.get("courseName")).toBe(courseName);
    expect(requestUrl.searchParams.has("branchId")).toBe(false);
    const rows = parseAssistantResultTable(result.reply)?.rows || [];
    expect(rows).toHaveLength(1);
    expect(rows[0].values).toMatchObject({ "Nhân sự": employeeName });
    expect(rows[0].values["Khóa đào tạo"]).toMatch(new RegExp(courseName === "hát" ? "Hát dân ca" : courseName));
    expect(result.reply).not.toContain(courseName === "Quy chế bảo mật" ? "An toàn lao động" : courseName === "hát" ? "Quy chế bảo mật" : "Quy chế bảo mật");
  }
});

it("keeps the named training scope from the reported request through the result table", async () => {
  const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
  state.interpret.mockImplementationOnce((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));

  const result = await turn({ text: "Kiểm tra ai chưa hoàn thành các bài học trong đào tạo hát" });
  const request = fetcher.mock.calls.find(([url]) => new URL(String(url)).pathname === "/api/v1/crud/training-enrollments");
  expect(new URL(String(request?.[0])).searchParams.get("courseName")).toBe("hát");
  expect(result.status).toBe("completed");
  const rows = parseAssistantResultTable(result.reply)?.rows || [];
  expect(rows).toHaveLength(1);
  expect(rows[0].values).toMatchObject({ "Nhân sự": "Phạm Gia Hân", "Khóa đào tạo": "Hát dân ca", "Tiến độ": "70%" });
  expect(result.reply).not.toContain("Quy chế bảo mật");
  expect(result.reply).not.toContain("An toàn lao động");
});

it.each(["tạo khóa học mới", "thêm khóa học mới"])("asks for the course type and then required details: %s", async text => {
  state.includeStudentCourses = true;
  const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
  state.interpret.mockImplementation((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));
  const choice = await turn({ text });
  expect(choice.status).toBe("collecting");
  expect(choice.reply).toContain("đào tạo nội bộ");
  expect(choice.reply).toContain("cho học viên");
  expect(choice.reply).not.toContain("chưa hiểu");
  const details = await turn({ text: "nội bộ" });
  expect(details.status).toBe("collecting");
  expect(details.reply).toMatch(/Tên khóa học/);
  expect(state.session.pending.actionId).toBe("training.create");
  expect(fetcher.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
});

it.each([true, false])("creates one training course and handles optional follow-up (supplement: %s)", async supplement => {
  const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
  state.interpret.mockImplementationOnce((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));
  const details = await turn({ text: "tạo khóa học mới" });
  expect(details.status).toBe("collecting");
  expect(details.reply).toContain("Tên khóa học");

  state.interpret.mockResolvedValueOnce({ actionId: "training.create", values: { title: "Hát dân ca", category: "Văn hóa", duration: "2 giờ", lessons: "[]", quizzes: "[]" }, newRequest: false });
  const preview = await turn({ text: "Tên Hát dân ca, danh mục Văn hóa, thời lượng 2 giờ; bỏ qua bài giảng và câu hỏi" });
  expect(preview.status).toBe("confirmation");
  expect(JSON.stringify(preview)).not.toContain("actor@example.com");
  const created = await turn({ decision: { id: preview.action!.id, confirmed: true } });
  expect(created.status).toBe("completed");
  expect(parseAssistantResultTable(created.reply)?.rows).toHaveLength(1);
  expect(created.reply).toContain("Bạn có muốn bổ sung không?");
  expect(created.reply).not.toContain(trainingCourseId);

  const followUp = await turn({ text: supplement ? "có" : "bỏ qua" });
  if (supplement) {
    expect(followUp.status).toBe("collecting");
    expect(state.session.pending.actionId).toBe("training.update");
    state.interpret.mockResolvedValueOnce({ actionId: "training.update", values: { description: "Kỹ thuật hát dân ca cơ bản" }, newRequest: false });
    const updatePreview = await turn({ text: "Bổ sung mô tả: Kỹ thuật hát dân ca cơ bản" });
    expect(updatePreview.status).toBe("confirmation");
    const updated = await turn({ decision: { id: updatePreview.action!.id, confirmed: true } });
    expect(updated.status).toBe("completed");
    expect(parseAssistantResultTable(updated.reply)?.rows).toHaveLength(1);
    const patch = fetcher.mock.calls.find(([url, init]) => new URL(String(url)).pathname === `/api/v1/crud/training-courses/${trainingCourseId}` && init?.method === "PATCH");
    expect(JSON.parse(String(patch?.[1]?.body))).toMatchObject({ description: "Kỹ thuật hát dân ca cơ bản" });
  } else {
    expect(followUp.status).toBe("completed");
    expect(fetcher.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(false);
  }
  expect(fetcher.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
});

it.each([true, false])("only deletes the named training course after confirmation (confirm: %s)", async confirmed => {
  const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
  state.interpret.mockImplementationOnce((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));
  const preview = await turn({ text: "xóa khóa đạo tạo nhân sự hát" });
  expect(preview.status).toBe("confirmation");
  expect(preview.action?.title).toBe("Xóa khóa đào tạo nội bộ");
  expect(JSON.stringify(preview)).toContain("hát");
  expect(JSON.stringify(preview)).not.toContain(trainingCourseId);
  expect(fetcher.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false);
  const result = await turn({ decision: { id: preview.action!.id, confirmed } });
  expect(result.status).toBe(confirmed ? "completed" : "cancelled");
  const deletions = fetcher.mock.calls.filter(([, init]) => init?.method === "DELETE");
  expect(deletions).toHaveLength(confirmed ? 1 : 0);
  if (confirmed) expect(new URL(String(deletions[0][0])).pathname).toBe(`/api/v1/crud/training-courses/${trainingCourseId}`);
  expect(fetcher.mock.calls.some(([url]) => new URL(String(url)).pathname.startsWith("/api/v1/auth/users"))).toBe(false);
});

it("asks to select a training course when its name matches multiple records", async () => {
  trainingCourses[0].title = "Hát dân ca";
  trainingCourses.push({ _id: "507f1f77bcf86cd799439089", title: "Hát cơ bản", category: "Văn hóa", duration: "3 giờ" });
  const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
  state.interpret.mockImplementationOnce((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));
  const selection = await turn({ text: "xóa khóa đạo tạo nhân sự hát" });
  expect(selection.status).toBe("collecting");
  expect(selection.referenceSelections?.find(group => group.key === "id")?.options).toHaveLength(2);
  expect(fetcher.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false);
});

it("creates a shared workflow category after confirmation and renders the shared result table", async () => {
  state.interpret.mockResolvedValueOnce({ actionId: "hr.workflow.category.create", values: { name: "Bảo mật" }, intentType: "workflow" });
  const fallback = fetcher.getMockImplementation() as (url: URL, init?: RequestInit) => Promise<Response>;
  fetcher.mockImplementation(async (url: URL, init?: RequestInit) => {
    if (new URL(String(url)).pathname === "/api/v1/crud/workflow-categories" && init?.method === "POST") return json({ data: { _id: "507f1f77bcf86cd799439777", name: "Bảo mật" } });
    return fallback(url, init);
  });
  const preview = await turn({ text: "Tạo nhãn phân loại quy trình Bảo mật" });
  expect(preview.status).toBe("confirmation");
  expect(fetcher.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  const result = await turn({ decision: { id: preview.action!.id, confirmed: true } });
  expect(result.status, result.reply).toBe("completed");
  expect(result.reply).toContain("Bảo mật");
  expect(parseAssistantResultTable(result.reply)).not.toBeNull();
  expect(result.reply).not.toContain("507f1f77bcf86cd799439777");
  expect(completeAssistantOperation).toHaveBeenCalledWith(expect.objectContaining({ status: "completed" }), expect.objectContaining({ operation: expect.objectContaining({ id: "hr.workflow.category.create" }) }), expect.anything(), expect.anything());
});

it("shows numbered workflow steps in new and restored previews while preserving the execution payload", async () => {
  const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
  state.interpret.mockImplementation((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));
  const collecting = await turn({ text: "thêm quy trình tuyển dụng nhân sự" });
  expect(collecting.status).toBe("collecting");
  state.interpret.mockResolvedValueOnce({ actionId: "hr.workflow.create", values: {
    steps: JSON.stringify(["đăng bài", "lọc cv", "gọi phỏng vấn", "phỏng vấn", "gửi thư trúng tuyển"].map(title => ({ title }))),
  }, intentType: "workflow", newRequest: false });
  const preview = await turn({ text: "bước 1: đăng bài, bước 2: lọc cv, bước 3: gọi phỏng vấn, bước 4: phỏng vấn, bước 5: gửi thư trúng tuyển" });
  expect(preview.status).toBe("confirmation");
  const expected = "1. đăng bài\n2. lọc cv\n3. gọi phỏng vấn\n4. phỏng vấn\n5. gửi thư trúng tuyển";
  expect(preview.action?.values.find(field => field.label === "Các bước quy trình")?.value).toBe(expected);
  const pendingSteps = state.session.pending.resolved.steps;
  expect(JSON.parse(pendingSteps).map((step: { title: string }) => step.title)).toEqual([
    "đăng bài", "lọc cv", "gọi phỏng vấn", "phỏng vấn", "gửi thư trúng tuyển",
  ]);
  expect(fetcher.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);

  // Older saved previews still contain JSON; restoring them must use the same formatter.
  state.session.lastReply.action.values.find((field: { label: string }) => field.label === "Các bước quy trình").value = pendingSteps;
  const restored = await conversationState(req, "hr-conversation");
  expect(restored.lastReply?.action?.values.find(field => field.label === "Các bước quy trình")?.value).toBe(expected);
  expect(state.session.pending.resolved.steps).toBe(pendingSteps);

  const ordinaryFetch = fetcher.getMockImplementation() as (url: URL, init?: RequestInit) => Promise<Response>;
  fetcher.mockImplementation(async (url: URL, init?: RequestInit) => {
    if (new URL(String(url)).pathname === "/api/v1/crud/workflows" && init?.method === "POST") {
      return json({ data: { _id: "507f1f77bcf86cd799439090", ...JSON.parse(String(init.body)) } });
    }
    return ordinaryFetch(url, init);
  });
  const result = await turn({ decision: { id: preview.action!.id, confirmed: true } });
  expect(result.status).toBe("completed");
  const creation = fetcher.mock.calls.find(([url, init]) => new URL(String(url)).pathname === "/api/v1/crud/workflows" && init?.method === "POST");
  expect(JSON.parse(String(creation?.[1]?.body)).steps).toMatchObject(JSON.parse(pendingSteps));
});

it.each([true, false])("appends the requested process step while preserving existing steps (confirm: %s)", async confirmed => {
  const workflowId = "507f1f77bcf86cd799439090";
  const originalSteps = ["đăng bài", "lọc cv", "gọi phỏng vấn", "phỏng vấn", "gửi thư trúng tuyển"].map((title, index) => ({
    id: `step-${index + 1}`, title, type: "task", position: { x: index * 220, y: 20 },
    assigneeUid: employeeId, assignee: "La Văn Sến", estDays: index + 1,
    note: `Ghi chú bước ${index + 1}`, subTasks: [{ id: `child-${index}`, title: "Kiểm tra", done: true }],
  }));
  const edges = [{ id: "edge-1", source: "step-1", target: "step-2" }];
  const record = { _id: workflowId, name: "tuyển dụng nhân sự", companyCode: "TEST", steps: originalSteps, edges };
  const ordinaryFetch = fetcher.getMockImplementation() as (url: URL, init?: RequestInit) => Promise<Response>;
  fetcher.mockImplementation(async (url: URL, init?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    if (path === "/api/v1/crud/workflows") return json({ data: [record], total: 1 });
    if (path === `/api/v1/crud/workflows/${workflowId}`) return json({ data: { ...record, ...(init?.method === "PATCH" ? JSON.parse(String(init.body)) : {}) } });
    return ordinaryFetch(url, init);
  });
  const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
  state.interpret.mockImplementation((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));

  const preview = await turn({ text: "thêm bước trả lương cho quy trình tuyển dụng nhân sự" });
  expect(preview.status, preview.reply).toBe("confirmation");
  expect(JSON.stringify(preview)).toContain("trả lương");
  expect(JSON.stringify(preview)).toContain("tuyển dụng nhân sự");
  expect(JSON.stringify(preview)).not.toContain(workflowId);
  expect(preview.reply).not.toContain("Bạn muốn mình cập nhật thông tin nào");
  expect(fetcher.mock.calls.some(([, init]) => ["PATCH", "POST"].includes(init?.method || ""))).toBe(false);

  const result = await turn({ decision: { id: preview.action!.id, confirmed } });
  expect(result.status, result.reply).toBe(confirmed ? "completed" : "cancelled");
  const patches = fetcher.mock.calls.filter(([, init]) => init?.method === "PATCH");
  expect(patches).toHaveLength(confirmed ? 1 : 0);
  if (confirmed) {
    expect(new URL(String(patches[0][0])).pathname).toBe(`/api/v1/crud/workflows/${workflowId}`);
    const body = JSON.parse(String(patches[0][1]?.body));
    expect(body.steps).toHaveLength(6);
    expect(body.steps.slice(0, 5)).toEqual(originalSteps);
    expect(body.steps[5]).toMatchObject({ title: "trả lương" });
    expect(body.edges).toEqual(edges);
    expect(parseAssistantResultTable(result.reply)?.rows, result.reply).toHaveLength(1);
  }
  expect(fetcher.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
});

it.each([true, false])("collects the missing child step name and keeps it under the selected parent (confirm: %s)", async confirmed => {
  const workflowId = "507f1f77bcf86cd799439090";
  const originalSteps = ["đăng bài", "trả lương"].map((title, index) => ({
    id: `step-${index + 1}`, title, type: "task", position: { x: index * 220, y: 20 },
    assigneeUid: employeeId, assignee: "La Văn Sến", estDays: 2, note: "Giữ ghi chú",
    subTasks: [{ id: `child-${index}`, title: "Đối chiếu hồ sơ", done: true }],
  }));
  const edges = [{ id: "edge-1", source: "step-1", target: "step-2" }];
  const record = { _id: workflowId, name: "tuyển dụng nhân sự", companyCode: "TEST", steps: originalSteps, edges };
  const ordinaryFetch = fetcher.getMockImplementation() as (url: URL, init?: RequestInit) => Promise<Response>;
  fetcher.mockImplementation(async (url: URL, init?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    if (path === "/api/v1/crud/workflows") return json({ data: [record], total: 1 });
    if (path === `/api/v1/crud/workflows/${workflowId}`) return json({ data: { ...record, ...(init?.method === "PATCH" ? JSON.parse(String(init.body)) : {}) } });
    return ordinaryFetch(url, init);
  });
  const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
  state.interpret.mockImplementation((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));

  const question = await turn({ text: "thêm bước con trong bước trả lương trong quy tình tuyển dụng nhân sự" });
  expect(question.status, question.reply).toBe("collecting");
  expect(question.reply).toContain("tên bước con");
  expect(question.reply).toContain("trả lương");
  expect(question.reply).toContain("tuyển dụng nhân sự");
  expect(state.session.pending.provided).toMatchObject({ workflowAction: "Thêm giai đoạn con", workflowTarget: "trả lương" });
  expect(state.session.pending.provided.workflowValue).toBeUndefined();
  expect(fetcher.mock.calls.some(([, init]) => ["PATCH", "POST"].includes(init?.method || ""))).toBe(false);

  const preview = await turn({ text: "Kiểm tra bảng lương" });
  expect(preview.status, preview.reply).toBe("confirmation");
  expect(JSON.stringify(preview)).toContain("Kiểm tra bảng lương");
  expect(JSON.stringify(preview)).toContain("trả lương");
  expect(JSON.stringify(preview)).not.toContain(workflowId);
  expect(fetcher.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(false);

  const result = await turn({ decision: { id: preview.action!.id, confirmed } });
  expect(result.status, result.reply).toBe(confirmed ? "completed" : "cancelled");
  const patches = fetcher.mock.calls.filter(([, init]) => init?.method === "PATCH");
  expect(patches).toHaveLength(confirmed ? 1 : 0);
  if (confirmed) {
    expect(new URL(String(patches[0][0])).pathname).toBe(`/api/v1/crud/workflows/${workflowId}`);
    const body = JSON.parse(String(patches[0][1]?.body));
    expect(body.steps).toHaveLength(2);
    expect(body.steps[0]).toEqual(originalSteps[0]);
    expect(body.steps[1]).toEqual({ ...originalSteps[1], subTasks: [
      originalSteps[1].subTasks[0], expect.objectContaining({ title: "Kiểm tra bảng lương", done: false }),
    ] });
    expect(body.edges).toEqual(edges);
    expect(parseAssistantResultTable(result.reply)?.rows).toHaveLength(1);
  }
  expect(fetcher.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
});

it("reports next-month birthdays without including birth years", async () => {
  const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
  state.interpret.mockImplementationOnce((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));

  const result = await turn({ text: "Liệt kê danh sách nhân sự có sinh nhật trong tháng tới" });
  expect(result.status).toBe("completed");
  const birthday = parseAssistantResultTable(result.reply)?.rows[0]?.values;
  expect(birthday).toMatchObject({ "Nhân sự": "Nguyễn Anh", "Ngày sinh": "04/12" });
  expect(result.reply).not.toContain("1990");
});

it("asks for required employee details before creating from an ID-card request", async () => {
  const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
  state.interpret.mockImplementationOnce((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));

  const result = await turn({ text: "Đây là CCCD của nhân sự mới, dựa vào thông tin này tạo nhân sự này trên hệ thống giúp tôi" });
  expect(result.status).toBe("collecting");
  expect(result.reply).toMatch(/họ và tên|ngày sinh|email/i);
  expect(fetcher.mock.calls.some(([url, init]) => new URL(String(url)).pathname === "/api/v1/auth/register-user" && init?.method === "POST")).toBe(false);
});

it("moves an employee under the selected manager only after confirmation", async () => {
  const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
  state.interpret.mockImplementationOnce((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));

  const preview = await turn({ text: "điều chuyển La Văn Sến xuống dưới quyền quản lý của Nguyễn Anh" });
  expect(preview.status).toBe("confirmation");
  expect(JSON.stringify(preview)).toContain("La Văn Sến");
  expect(JSON.stringify(preview)).toContain("Nguyễn Anh");
  expect(JSON.stringify(preview)).not.toContain(employeeId);
  expect(JSON.stringify(preview)).not.toContain(secondEmployeeId);

  const result = await turn({ decision: { id: preview.action!.id, confirmed: true } });
  const update = fetcher.mock.calls.find(([url, init]) => new URL(String(url)).pathname === `/api/v1/auth/users/${employeeId}` && init?.method === "PATCH");
  expect(result.status).toBe("completed");
  expect(JSON.parse(String(update?.[1]?.body))).toMatchObject({ parentId: secondEmployeeId });
});

it("reads a monthly attendance report and formats it as the shared table", async () => {
  const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
  state.interpret.mockImplementationOnce((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));

  const result = await turn({ text: "tháng này ai nghỉ nhiều nhất" });
  const request = fetcher.mock.calls.find(([url]) => new URL(String(url)).pathname === "/api/v1/timekeeping/monthly-report");
  const requestUrl = new URL(String(request?.[0]));
  expect(result.status).toBe("completed");
  expect(requestUrl.searchParams.get("month")).toBe(String(Number(new Intl.DateTimeFormat("en", { timeZone: "Asia/Ho_Chi_Minh", month: "numeric" }).format(new Date()))));
  expect(parseAssistantResultTable(result.reply)?.rows[0]?.values["Nhân sự"]).toBe("Nguyễn Anh");
});

it("summarizes attendance for the requested month across all returned employees", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-17T08:00:00.000Z"));
  try {
    const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
    state.interpret.mockImplementationOnce((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));

    const result = await turn({ text: "tổng hợp dữ liệu chấm công tháng 10" });
    const request = fetcher.mock.calls.find(([url]) => new URL(String(url)).pathname === "/api/v1/timekeeping/monthly-report");
    const requestUrl = new URL(String(request?.[0]));
    const rows = parseAssistantResultTable(result.reply)?.rows || [];

    expect(result.status).toBe("completed");
    expect(requestUrl.searchParams.get("year")).toBe("2026");
    expect(requestUrl.searchParams.get("month")).toBe("10");
    expect(rows.map(row => row.values["Nhân sự"])).toEqual(["Nguyễn Anh", "La Văn Sến"]);
    expect(rows[0].values).toMatchObject({ "Công đã làm": "19", "Ngày vắng": "2", "Nghỉ phép": "1" });
  } finally {
    vi.useRealTimers();
  }
});

it("applies requested monthly thresholds and rankings to each employee row", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-17T08:00:00.000Z"));
  try {
    const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
    state.interpret.mockImplementation((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));

    const belowThreshold = await turn({ text: "tháng này ai không đủ 20 công" });
    expect(belowThreshold.status).toBe("completed");
    expect(belowThreshold.reply).toContain("Nguyễn Anh");
    expect(belowThreshold.reply).not.toContain("La Văn Sến");

    const mostAbsent = await turn({ text: "tháng này ai nghỉ nhiều nhất" });
    expect(mostAbsent.status).toBe("completed");
    expect(mostAbsent.reply).toContain("Nguyễn Anh");
    expect(mostAbsent.reply).not.toContain("La Văn Sến");
  } finally {
    vi.useRealTimers();
  }
});

it("filters annual leave to staff with at least twelve days remaining", async () => {
  const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
  state.interpret.mockImplementationOnce((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));

  const result = await turn({ text: "danh sách nhân sự còn đủ 12 phép" });
  expect(result.status).toBe("completed");
  expect(parseAssistantResultTable(result.reply)?.rows.map(row => row.values["Nhân sự"]), result.reply).toEqual(["La Văn Sến"]);
  expect(result.reply).not.toContain("Nguyễn Anh");
});

it("reports exhausted and remaining leave balances for arbitrary employees", async () => {
  const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
  state.interpret.mockImplementationOnce((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));
  const exhausted = await turn({ text: "Ai đã hết lượt nghỉ phép năm" });
  expect(exhausted.status).toBe("completed");
  expect(exhausted.reply).toContain("Phạm Gia Hân");
  expect(exhausted.reply).not.toContain("La Văn Sến");

  state.interpret.mockImplementationOnce((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));
  const allBalances = await turn({ text: "Thống kê lượt nghỉ phép còn lại của các nhân sự" });
  expect(allBalances.status).toBe("completed");
  expect(allBalances.reply).toContain("La Văn Sến");
  expect(allBalances.reply).toContain("Nguyễn Anh");
  expect(allBalances.reply).toContain("Phạm Gia Hân");
});

it("returns holidays for the requested month instead of the full annual calendar", async () => {
  const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
  state.interpret.mockImplementationOnce((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));

  const result = await turn({ text: "tháng này có những ngày nào được nghỉ" });
  const request = fetcher.mock.calls.find(([url]) => new URL(String(url)).pathname === "/api/v1/timekeeping/work-calendar");
  const requestUrl = new URL(String(request?.[0]));
  expect(result.status).toBe("completed");
  expect(requestUrl.searchParams.get("holidaysOnly")).toBe("true");
  expect(requestUrl.searchParams.get("month")).toBeTruthy();
  expect(parseAssistantResultTable(result.reply)?.rows[0]?.values["Nội dung"]).toBe("Ngày nghỉ công ty");
});

it("looks up the requested company holiday by its actual name", async () => {
  const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
  state.interpret.mockImplementationOnce((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));

  const result = await turn({ text: "ngày Quốc khánh của công ty diễn ra vào ngày nào" });
  expect(result.status).toBe("completed");
  expect(result.reply).toContain("Quốc khánh");
  expect(result.reply).toContain("02/09/2026");
  expect(result.reply).not.toContain("Ngày nghỉ công ty");
  expect(result.reply).not.toContain("Happy Day");
});

it("collects a task title and due date for any requested assignee before creating it", async () => {
  const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
  state.interpret.mockImplementationOnce((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));

  const result = await turn({ text: "tạo 1 giao việc mới cho Phạm Gia Hân" });

  expect(result.status).toBe("collecting");
  expect(result.reply).toMatch(/tên công việc/i);
  expect(result.reply).toMatch(/hạn hoàn thành/i);
  expect(fetcher.mock.calls.some(([url, init]) => new URL(String(url)).pathname === "/api/v1/kanban/tasks" && init?.method === "POST")).toBe(false);
});

it("applies the requested KPI filter and excludes employees with no tasks", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-17T08:00:00.000Z"));
  try {
    const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
    state.interpret.mockImplementation((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));

    const below = await turn({ text: "Tháng này, những nhân sự nào không đạt KPI" });
    const belowCall = fetcher.mock.calls.find(([url]) => new URL(String(url)).pathname === "/api/v1/kanban/kpi/monthly");
    expect(below.status).toBe("completed");
    expect(new URL(String(belowCall?.[0])).searchParams.get("period")).toBe("2026-11");
    expect(new URL(String(belowCall?.[0])).searchParams.has("completionFilter")).toBe(false);
    expect(below.reply).toContain("Nguyễn Anh");
    expect(below.reply).not.toContain("La Văn Sến");
    expect(below.reply).not.toContain("Phạm Gia Hân");

    const exact = await turn({ text: "Tháng này, những nhân sự nào hoàn thành 100% KPI" });
    expect(exact.status).toBe("completed");
    expect(exact.reply).toContain("La Văn Sến");
    expect(exact.reply).not.toContain("Nguyễn Anh");
    expect(exact.reply).not.toContain("Phạm Gia Hân");
  } finally {
    vi.useRealTimers();
  }
});

it("uses arbitrary task names in progress updates and confirms the selected task", async () => {
  const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
  state.interpret.mockImplementationOnce((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));

  const preview = await turn({ text: "Cập nhập tiến độ công việc Dự hội thảo BNI EXPO ngày 20/11 hoàn thành được 50%" });
  expect(preview.status, JSON.stringify(preview)).toBe("confirmation");
  expect(JSON.stringify(preview)).toContain("Dự hội thảo BNI EXPO ngày 20/11");
  const updated = await turn({ decision: { id: preview.action!.id, confirmed: true } });
  const updateCall = fetcher.mock.calls.find(([url, init]) => new URL(String(url)).pathname === `/api/v1/kanban/tasks/${kanbanTaskId}/activity` && init?.method === "PATCH");
  expect(updated.status).toBe("completed");
  expect(JSON.parse(String(updateCall?.[1]?.body))).toMatchObject({ action: "progress", progress: 50 });
  expect(fetcher.mock.calls.some(([url]) => new URL(String(url)).pathname === "/api/v1/kanban/tasks" && new URL(String(url)).searchParams.get("search") === "Dự hội thảo BNI EXPO")).toBe(true);
});

it("keeps the parsed task title when retrying a progress update after no task match", async () => {
  const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
  state.interpret.mockImplementationOnce((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));
  const text = "Cập nhập tiến độ công việc làm cho con bò ngày 20/11 hoàn thành được 50%";

  const first = await turn({ text });
  expect(first.status).toBe("collecting");
  state.interpret.mockImplementationOnce(() => ({
    actionId: "task.activity.update",
    values: { path_id: "làm cho con bò", action: "progress", progress: 50 },
    intentType: "workflow",
    newRequest: true,
  }));
  const retry = await turn({ text });
  const taskSearches = fetcher.mock.calls
    .filter(([url]) => new URL(String(url)).pathname === "/api/v1/kanban/tasks")
    .map(([url]) => new URL(String(url)).searchParams.get("search"));

  expect(retry.status, retry.reply).toBe("collecting");
  expect(taskSearches.length).toBeGreaterThanOrEqual(2);
  expect(taskSearches.at(-1)).toBe("làm cho con bò");
});

it("passes arbitrary task search, status, overdue, priority, and assignee filters to the API", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-17T08:00:00.000Z"));
  try {
    const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
    state.interpret.mockImplementation((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));
    const cases: Array<[string, (url: URL) => void, (reply: string) => void]> = [
      ["Công việc Kiểm thử sản phẩm mới 1234567890 đang được giao cho ai", url => expect(url.searchParams.get("search")).toBe("Kiểm thử sản phẩm mới 1234567890"), reply => expect(reply).toContain("Phạm Gia Hân")],
      ["Công việc Kiểm thử sản phẩm mới 1234567890 đã hoàn thành chưa", url => expect(url.searchParams.get("search")).toBe("Kiểm thử sản phẩm mới 1234567890"), reply => expect(reply).toContain("Done")],
      ["Những công việc nào đang làm chưa xong", url => expect(url.searchParams.has("status")).toBe(false), reply => expect(parseAssistantResultTable(reply)?.rows).toHaveLength(2)],
      ["Những công việc nào bị trễ deadline", url => expect(url.searchParams.get("overdue")).toBe("true"), reply => expect(reply).toContain("Chuẩn bị báo cáo quý")],
      ["Những công việc nào chưa bắt đầu", url => expect(url.searchParams.get("status")).toBe("Not Started"), reply => expect(reply).toContain("Chuẩn bị báo cáo quý")],
      ["Những công việc nào đang ở mức ưu tiên cao", url => expect(url.searchParams.get("priority")).toBe("High"), reply => expect(reply).toContain("Dự hội thảo BNI EXPO")],
      ["nhân sự Phạm Gia Hân đang đảm nhiệm những công việc nào", url => expect(url.searchParams.get("assigneeUid")).toBe("507f1f77bcf86cd799439097"), reply => expect(reply).toContain("Kiểm thử sản phẩm mới 1234567890")],
    ];
    for (const [text, assertFilter, assertResult] of cases) {
      const result = await turn({ text });
      const call = fetcher.mock.calls.filter(([url]) => new URL(String(url)).pathname === "/api/v1/kanban/tasks").at(-1);
      expect(result.status, text).toBe("completed");
      expect(call, text).toBeTruthy();
      assertFilter(new URL(String(call?.[0])));
      assertResult(result.reply);
    }
  } finally {
    vi.useRealTimers();
  }
});

it("uses requested leave types, dates, and employee identities for reports", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-17T08:00:00.000Z"));
  try {
    const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
    state.interpret.mockImplementation((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));

    const ranking = await turn({ text: "Nhân sự nào xin nghỉ nhiều nhất tháng qua" });
    const rankingCall = fetcher.mock.calls.find(([url]) => new URL(String(url)).pathname === "/api/v1/crud/hr-leave-applications");
    const rankingUrl = new URL(String(rankingCall?.[0]));
    expect(ranking.status).toBe("completed");
    expect(rankingUrl.searchParams.get("rangeStart")).toBe("2026-10-01");
    expect(rankingUrl.searchParams.get("rangeEnd")).toBe("2026-10-31");
    expect(rankingUrl.searchParams.get("requestKind")).toBe("leave");
    expect(rankingUrl.searchParams.has("reportKind")).toBe(false);
    expect(ranking.reply).toContain("La Văn Sến");
    expect(ranking.reply).not.toContain("507f1f77bcf86cd799439094");

    const wfh = await turn({ text: "Nhân sự nào làm online nhiều nhất tháng qua" });
    const wfhCall = fetcher.mock.calls.filter(([url]) => new URL(String(url)).pathname === "/api/v1/crud/hr-leave-applications").at(-1);
    expect(wfh.status).toBe("completed");
    expect(new URL(String(wfhCall?.[0])).searchParams.get("requestKind")).toBe("wfh");
    expect(wfh.reply).toContain("Nguyễn Anh");
    expect(wfh.reply).not.toContain("La Văn Sến");

    const summary = await turn({ text: "Tổng hợp những nhân sự nghỉ phép trong tháng này" });
    expect(summary.status).toBe("completed");
    expect(summary.reply).toContain("La Văn Sến");
    expect(summary.reply).toContain("Nguyễn Anh");
  } finally {
    vi.useRealTimers();
  }
});

it.each(["demo sản phẩm cho khách", "Họp triển khai dự án"]) ("preserves every calendar result cell through today's full conversation: %s", async title => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2028-02-29T18:00:00.000Z"));
  try {
    const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
    state.interpret.mockImplementationOnce((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));
    const original = fetcher.getMockImplementation() as (url: URL, init?: RequestInit) => Promise<Response>;
    fetcher.mockImplementation((url: URL, init?: RequestInit) => new URL(String(url)).pathname === "/api/v1/crud/hr-calendar-events"
      ? Promise.resolve(json({ data: [{ _id: calendarEventId, title, type: "event", startDate: "2028-02-29T17:30:00.000Z", endDate: "2028-02-29T19:00:00.000Z", status: "active" }] }))
      : original(url, init));
    const reply = await turn({ text: "Ngày hôm nay có lịch gì không ?" });
    expect(reply.status).toBe("completed");
    const table = parseAssistantResultTable(reply.reply);
    expect(table?.rows[0].values).toMatchObject({ "Sự kiện": title, "Loại": "Sự kiện", "Bắt đầu": "00:30, 01/03/2028", "Kết thúc": "02:00, 01/03/2028", "Trạng thái": "Đang hoạt động" });
    const requestUrl = new URL(String(fetcher.mock.calls.find(([url]) => new URL(String(url)).pathname === "/api/v1/crud/hr-calendar-events")![0]));
    expect(requestUrl.searchParams.get("rangeStart")).toBe("2028-03-01");
    expect(requestUrl.searchParams.get("rangeEnd")).toBe("2028-03-01");
    expect(reply.reply).not.toContain(calendarEventId);
  } finally { vi.useRealTimers(); }
});

it("lists calendar events and keeps optional event edits attached to the created record", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-17T08:00:00.000Z"));
  const previousUserId = req.user.id;
  req.user.id = employeeId;
  try {
    const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
    state.interpret.mockImplementationOnce((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));

    const listed = await turn({ text: "Báo cáo những sự kiện nội bộ diễn ra trong tháng này" });
    expect(listed.status).toBe("completed");
    expect(listed.reply).toContain("Họp tổng kết tuần");
    expect(listed.reply).toContain("21/11/2026");
    expect(listed.reply).not.toContain(calendarEventId);

    state.interpret.mockImplementationOnce((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));
    const today = await turn({ text: "Ngày hôm nay có lịch gì không?" });
    const todayCall = fetcher.mock.calls.filter(([url]) => new URL(String(url)).pathname === "/api/v1/crud/hr-calendar-events").at(-1);
    expect(today.status).toBe("completed");
    expect(today.reply).toContain("Không có sự kiện");
    expect(new URL(String(todayCall?.[0])).searchParams.get("rangeStart")).toBe("2026-11-17");
    expect(new URL(String(todayCall?.[0])).searchParams.get("rangeEnd")).toBe("2026-11-17");

    state.interpret.mockImplementationOnce((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));
    const preview = await turn({ text: "tạo sự kiện Họp tổng kết tuần vào thứ 7 tuần này" });
    expect(preview.status).toBe("confirmation");
    const created = await turn({ decision: { id: preview.action!.id, confirmed: true } });
    expect(created.status).toBe("completed");
    expect(created.reply).toContain("Bạn có muốn bổ sung không?");
    state.interpret.mockResolvedValueOnce({ actionId: "hr.calendar.event.update", values: { location: "Phòng họp tầng 2" }, intentType: "workflow", newRequest: false });
    const editPreview = await turn({ text: "Bổ sung địa điểm là Phòng họp tầng 2" });
    expect(editPreview.status).toBe("confirmation");
    expect(JSON.stringify(editPreview)).toContain("Phòng họp tầng 2");
    const edited = await turn({ decision: { id: editPreview.action!.id, confirmed: true } });
    const createCalls = fetcher.mock.calls.filter(([url, init]) => new URL(String(url)).pathname === "/api/v1/crud/hr-calendar-events" && init?.method === "POST");
    const updateCall = fetcher.mock.calls.find(([url, init]) => new URL(String(url)).pathname === `/api/v1/crud/hr-calendar-events/${calendarEventId}` && init?.method === "PATCH");
    expect(edited.status).toBe("completed");
    expect(createCalls).toHaveLength(1);
    expect(JSON.parse(String(updateCall?.[1]?.body))).toMatchObject({ location: "Phòng họp tầng 2" });
  } finally {
    req.user.id = previousUserId;
    vi.useRealTimers();
  }
});

it("reports dynamic monthly late and unrecorded attendance counts", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-17T08:00:00.000Z"));
  try {
    const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
    state.interpret.mockImplementation((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));

    const late = await turn({ text: "Tổng hợp những nhân sự đi trễ trong tháng này" });
    const lateCall = fetcher.mock.calls.filter(([url]) => new URL(String(url)).pathname === "/api/v1/timekeeping/monthly-report").at(-1);
    expect(late.status).toBe("completed");
    expect(new URL(String(lateCall?.[0])).searchParams.get("month")).toBe("11");
    expect(late.reply).toContain("Nguyễn Anh");
    expect(late.reply).not.toContain("La Văn Sến");

    const missing = await turn({ text: "Tổng hợp những nhân sự quên/chưa chấm công trong tháng này" });
    const missingCall = fetcher.mock.calls.filter(([url]) => new URL(String(url)).pathname === "/api/v1/timekeeping/monthly-report").at(-1);
    expect(missing.status).toBe("completed");
    expect(new URL(String(missingCall?.[0])).searchParams.get("month")).toBe("11");
    expect(missing.reply).toContain("Nguyễn Anh");
    expect(missing.reply).toContain("Ngày thiếu chấm công");
    expect(missing.reply).not.toContain("La Văn Sến");
  } finally {
    vi.useRealTimers();
  }
});

it("asks for the missing date and reason before changing an employee's timekeeping record", async () => {
  const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
  state.interpret.mockImplementationOnce((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));

  const result = await turn({ text: "Sửa lại dữ liệu chấm công cho Nguyễn Anh checkin lúc 7 giờ 59 phút và checkout lúc 18 giờ" });

  expect(result.status).toBe("collecting");
  expect(result.reply).toMatch(/ngày chấm công/i);
  expect(result.reply).toMatch(/lý do điều chỉnh/i);
  expect(fetcher.mock.calls.some(([url, init]) => new URL(String(url)).pathname.startsWith("/api/v1/crud/timekeeping-logs/") && init?.method === "PATCH")).toBe(false);
});

it("confirms and dispatches an attendance adjustment without requiring an existing attendance log", async () => {
  const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
  state.interpret.mockImplementation((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));

  const first = await turn({ text: "Sửa dữ liệu chấm công cho Nguyễn Anh ngày 16/11/2026 checkin lúc 7 giờ 59 phút và checkout lúc 18 giờ" });
  expect(first.status).toBe("collecting");
  expect(first.reply).toMatch(/lý do điều chỉnh/i);

  state.interpret.mockResolvedValueOnce({
    actionId: "timekeeping.record.update",
    values: { editReason: "Đi công tác" },
    intentType: "workflow",
    newRequest: false,
  });
  const preview = await turn({ text: "Lý do là đi công tác" });
  expect(preview.status).toBe("confirmation");
  expect(JSON.stringify(preview)).toContain("16/11/2026");
  expect(JSON.stringify(preview)).toContain("07:59");

  const completed = await turn({ decision: { id: preview.action!.id, confirmed: true } });
  const adjustmentCall = fetcher.mock.calls.find(([url, init]) => new URL(String(url)).pathname === "/api/v1/timekeeping/records/adjust" && init?.method === "PATCH");
  expect(completed.status).toBe("completed");
  expect(parseAssistantResultTable(completed.reply)?.rows).toHaveLength(1);
  expect(completed.reply).not.toContain(employeeId);
  expect(JSON.parse(String(adjustmentCall?.[1]?.body))).toMatchObject({
    employeeId: secondEmployeeId,
    date: "2026-11-16",
    checkInTime: "07:59",
    checkOutTime: "18:00",
    editReason: "Đi công tác",
  });
  expect(fetcher.mock.calls.some(([url, init]) => new URL(String(url)).pathname.startsWith("/api/v1/crud/timekeeping-logs/") && init?.method === "PATCH")).toBe(false);
});

it("reports today's leave requests while excluding other request kinds", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-17T08:00:00.000Z"));
  try {
    const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
    state.interpret.mockImplementationOnce((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));

    const result = await turn({ text: "Kiểm tra hôm nay có đơn nghỉ phép nào không" });
    const request = fetcher.mock.calls.find(([url]) => new URL(String(url)).pathname === "/api/v1/crud/hr-leave-applications");
    const requestUrl = new URL(String(request?.[0]));

    expect(result.status).toBe("completed");
    expect(requestUrl.searchParams.get("rangeStart")).toBe("2026-11-17");
    expect(requestUrl.searchParams.get("rangeEnd")).toBe("2026-11-17");
    expect(result.reply).toContain("La Văn Sến");
    expect(result.reply).toContain("Nguyễn Anh");
    expect(result.reply).not.toContain("Phạm Gia Hân");
  } finally {
    vi.useRealTimers();
  }
});

it("filters today's attendance reports by status across different employees", async () => {
  const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
  state.interpret.mockImplementation((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));
  const cases: Array<[string, string[]]> = [
    ["Báo cáo tình hình nhân sự hôm nay", ["Nguyễn Anh", "La Văn Sến", "Phạm Gia Hân", "Nguyễn Mai"]],
    ["Kiểm tra xem hôm nay có những nhân sự nào đi muộn", ["Nguyễn Anh"]],
    ["Tình hình chấm công hôm nay", ["Nguyễn Anh", "La Văn Sến", "Phạm Gia Hân", "Nguyễn Mai"]],
    ["Hôm nay nhân sự nào vắng", ["Phạm Gia Hân"]],
    ["Hôm nay nhân sự nào chưa chấm công", ["La Văn Sến"]],
    ["danh sách nhân sự hôm nay quên chấm công", ["La Văn Sến"]],
    ["Hôm nay có ai nghỉ phép không", ["La Văn Sến", "Nguyễn Anh"]],
  ];
  for (const [text, names] of cases) {
    const result = await turn({ text });
    expect(result.status, text).toBe("completed");
    for (const name of names) expect(result.reply, text).toContain(name);
    for (const name of ["Nguyễn Anh", "La Văn Sến", "Phạm Gia Hân", "Nguyễn Mai"]) {
      if (!names.includes(name)) expect(result.reply, text).not.toContain(name);
    }
  }
});

it("uses attached employee information in work mode and still asks for missing fields before confirmation", async () => {
  const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
  state.interpret.mockImplementationOnce((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));
  state.provider.mockResolvedValueOnce({ text: JSON.stringify({ displayName: "Trần Thu An", birthDate: "1992-03-04" }) });

  const collecting = await turn({
    mode: "work",
    text: "Đây là CCCD của nhân sự mới, dựa vào thông tin này tạo nhân sự này trên hệ thống giúp tôi",
    conversationUpload: { buffer: Buffer.from("image bytes"), fileName: "cccd.png" },
  });

  expect(collecting.status).toBe("collecting");
  expect(collecting.reply).toMatch(/email/i);
  expect(fetcher.mock.calls.some(([url, init]) => new URL(String(url)).pathname === "/api/v1/auth/register-user" && init?.method === "POST")).toBe(false);
  const extractionRequest = state.provider.mock.calls[0]?.[0];
  expect(extractionRequest.messages[1].content).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: "image_url", image_url: { url: "data:image/jpeg;base64,ZmFrZQ==" } }),
  ]));

  state.interpret.mockResolvedValueOnce({ actionId: "employee.create", values: { email: "an@example.com" }, intentType: "workflow", newRequest: false });
  const collectingReference = await turn({ mode: "work", text: "Email an@example.com" });
  expect(collectingReference.status).toBe("collecting");
  expect(JSON.stringify(collectingReference)).toContain("04/03/1992");
  expect(JSON.stringify(collectingReference)).toContain("an@example.com");
  const preview = await turn({ mode: "work", referenceSelections: {}, skipReferenceKeys: ["department"] });
  expect(preview.status).toBe("confirmation");
  expect(JSON.stringify(preview)).toContain("Trần Thu An");
  expect(JSON.stringify(preview)).toContain("04/03/1992");
  expect(JSON.stringify(preview)).toContain("an@example.com");
  expect(fetcher.mock.calls.some(([url, init]) => new URL(String(url)).pathname === "/api/v1/auth/register-user" && init?.method === "POST")).toBe(false);
});
