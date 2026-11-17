import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ session: null as any, turns: [] as any[], interpret: vi.fn(), provider: vi.fn() }));
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
    listWorkflows: vi.fn(async () => ASSISTANT_OPERATIONS.filter(operation => operation.module === "hr").map(defaultWorkflow)),
  };
});
vi.mock("./settings", async () => {
  const { defaultAssistantSettings } = await import("../../src/shared/assistant-workflow");
  return { getSettings: vi.fn(async () => ({ ...defaultAssistantSettings, memoryEnabled: false, autoMemoryEnabled: false, responseRules: "" })) };
});
vi.mock("./interpreter", () => ({ interpretRequest: state.interpret, isEmployeeDetailsIntent: () => false }));
vi.mock("./reply-rules", () => ({ applyAssistantResponseRules: async (reply: unknown) => reply }));
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

import { processTurn } from "./service";
import { parseAssistantResultTable } from "../../src/shared/assistant-result-table";

const employeeId = "507f1f77bcf86cd799439022";
const secondEmployeeId = "507f1f77bcf86cd799439023";
const applicantId = "507f1f77bcf86cd799439032";
const jobId = "507f1f77bcf86cd799439033";
const financeDepartmentId = "507f1f77bcf86cd799439052";
const hrContractId = "507f1f77bcf86cd799439062";
const departmentName = "Phòng kinh doanh";
const branchId = "507f1f77bcf86cd799439012";
const nextMonthBirthday = () => {
  const current = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", month: "2-digit" }).format(new Date()));
  return `1990-${String(current === 12 ? 1 : current + 1).padStart(2, "0")}-04`;
};
const req = { user: { id: "actor", uid: "actor", email: "actor@example.com", companyCode: "TEST", branchId: "507f1f77bcf86cd799439012", role: "admin" }, headers: { authorization: "Bearer scoped" }, socket: { localPort: 4050, localAddress: "127.0.0.1" } } as any;
const turn = (input: any) => processTurn(req, { conversationId: "hr-conversation", requestId: randomUUID(), ...input });
const json = (data: unknown) => new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
let fetcher: ReturnType<typeof vi.fn>;
beforeEach(() => {
  state.session = null; state.turns = []; state.interpret.mockReset(); state.provider.mockReset();
  fetcher = vi.fn(async (url: URL, init?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    if (path === "/api/v1/auth/users" && (init?.method || "GET") === "GET") return json([
      { _id: employeeId, id: employeeId, displayName: "La Văn Sến", email: "sen@example.com", monthlySalary: 35000000 },
      { _id: secondEmployeeId, id: secondEmployeeId, displayName: "Nguyễn Anh", email: "anh@example.com", department: "Phòng tài chính", birthDate: nextMonthBirthday(), monthlySalary: 9000000 },
    ]);
    if (path === "/api/v1/hr/departments" && (init?.method || "GET") === "GET") return json({ data: [
      { id: "507f1f77bcf86cd799439042", name: departmentName, code: "KD", isActive: true, managerName: "Mai Anh", employeeCount: 3 },
      { id: financeDepartmentId, name: "Phòng tài chính", code: "TC", isActive: true, managerName: "Lê Minh", employeeCount: 6 },
      { id: "507f1f77bcf86cd799439072", name: "Phòng Marketing", code: "MKT", isActive: true, managerName: "Mai Anh", employeeCount: 3 },
    ] });
    if (path === "/api/v1/hr/departments/507f1f77bcf86cd799439042" && init?.method === "PATCH") return json({ data: { id: "507f1f77bcf86cd799439042", name: departmentName, code: "SALES", isActive: true, ...JSON.parse(String(init.body)) } });
    if (path === `/api/v1/hr/departments/${financeDepartmentId}` && init?.method === "PATCH") return json({ data: { id: financeDepartmentId, name: "kế toán tài chính", code: "TC", isActive: true, ...JSON.parse(String(init.body)) } });
    if (path === "/api/v1/auth/register-user" && init?.method === "POST") return json({ status: "success", data: { _id: employeeId, ...JSON.parse(String(init.body)) } });
    if (path === "/api/v1/recruitment/applicants" && (init?.method || "GET") === "GET") return json([{ _id: applicantId, id: applicantId, fullName: "Nguyễn Thị Mai", email: "mai@example.com", jobTitle: "Kế toán" }]);
    if (path === "/api/v1/recruitment/jobs" && (init?.method || "GET") === "GET") return json([{ _id: jobId, id: jobId, title: "Kế toán", code: "JOB-001", status: "open" }]);
    if (path === `/api/v1/auth/users/${employeeId}` && init?.method === "DELETE") return json({ status: "success", message: "Xóa nhân sự thành công" });
    if (path === `/api/v1/auth/users/${employeeId}` && init?.method === "PATCH") return json({ status: "success", data: { _id: employeeId, id: employeeId, displayName: "La Văn Sến", ...JSON.parse(String(init.body)) } });
    if (path === `/api/v1/auth/users/${secondEmployeeId}` && init?.method === "PATCH") return json({ status: "success", data: { _id: secondEmployeeId, id: secondEmployeeId, displayName: "Nguyễn Anh", ...JSON.parse(String(init.body)) } });
    if (path === "/api/v1/hr-contracts" && (init?.method || "GET") === "GET") return json({ data: {
      contracts: [{ _id: hrContractId, employeeId: secondEmployeeId, employeeName: "Nguyễn Anh", contractType: "Không xác định thời hạn", startDate: "2025-01-01", endDate: "2026-12-31", status: "active", salaryTerms: [{ contractSalary: 9000000 }] }],
      total: 1, expiryAlerts: [], expiryAlertTotal: 0,
    } });
    if (path === `/api/v1/hr-contracts/${hrContractId}/extensions` && init?.method === "POST") return json({ data: {
      contract: { _id: hrContractId, employeeId: secondEmployeeId, employeeName: "Nguyễn Anh", endDate: "2027-04-30T00:00:00.000Z" },
      extension: { contractId: hrContractId, employeeName: "Nguyễn Anh", previousEndDate: "2026-12-31T00:00:00.000Z", newEndDate: "2027-04-30T00:00:00.000Z", extensionDate: "2026-11-17T00:00:00.000Z" },
    } });
    if (path === "/api/v1/crud/training-enrollments" && (init?.method || "GET") === "GET") return json({
      data: [
        { _id: "507f1f77bcf86cd799439082", userName: "Nguyễn Anh", uid: secondEmployeeId, courseTitle: "An toàn lao động", progress: 35, status: "in_progress" },
        { _id: "507f1f77bcf86cd799439083", userName: "La Văn Sến", uid: employeeId, courseTitle: "An toàn lao động", progress: 100, status: "completed" },
      ], total: 2,
    });
    throw new Error(`Unexpected API: ${init?.method || "GET"} ${path}`);
  });
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => vi.unstubAllGlobals());

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

it("updates an employee phone number by matching the employee name", async () => {
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

it("lets the user choose an applicant and job from the chat when scheduling an interview", async () => {
  state.interpret.mockResolvedValueOnce({
    actionId: "recruitment.interview.create",
    values: { scheduledStart: "2026-12-01T10:00:00+07:00", scheduledEnd: "2026-12-01T11:00:00+07:00", format: "online" },
    intentType: "workflow",
    newRequest: true,
  });

  const prompt = await turn({ text: "Tạo lịch phỏng vấn" });

  expect(prompt.status).toBe("collecting");
  const applicants = prompt.referenceSelections?.find(group => group.key === "applicantId");
  const jobs = prompt.referenceSelections?.find(group => group.key === "jobId");
  expect(applicants?.options.map(option => option.label)).toContain("Nguyễn Thị Mai");
  expect(jobs?.options.map(option => option.label)).toContain("Kế toán — mã JOB-001");
  expect(JSON.stringify(prompt)).not.toContain(applicantId);
  expect(JSON.stringify(prompt)).not.toContain(jobId);
  expect(prompt.reply).not.toContain(branchId);
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

it("reports only incomplete internal training enrollments in the shared table", async () => {
  const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
  state.interpret.mockImplementationOnce((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));

  const result = await turn({ text: "Kiểm tra ai chưa hoàn thành các bài học trong đào tạo nội bộ" });
  expect(result.status).toBe("completed");
  const rows = parseAssistantResultTable(result.reply)?.rows || [];
  expect(rows).toHaveLength(1);
  expect(rows[0].values).toMatchObject({ "Nhân sự": "Nguyễn Anh", "Khóa đào tạo": "An toàn lao động", "Tiến độ": "35%" });
  expect(result.reply).not.toContain(secondEmployeeId);
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
