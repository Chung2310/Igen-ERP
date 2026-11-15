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

import { processTurn } from "./service";
import { parseAssistantResultTable } from "../../src/shared/assistant-result-table";

const employeeId = "507f1f77bcf86cd799439022";
const applicantId = "507f1f77bcf86cd799439032";
const jobId = "507f1f77bcf86cd799439033";
const branchId = "507f1f77bcf86cd799439012";
const req = { user: { id: "actor", uid: "actor", email: "actor@example.com", companyCode: "TEST", branchId: "507f1f77bcf86cd799439012", role: "admin" }, headers: { authorization: "Bearer scoped" }, socket: { localPort: 4050, localAddress: "127.0.0.1" } } as any;
const turn = (input: any) => processTurn(req, { conversationId: "hr-conversation", requestId: randomUUID(), ...input });
const json = (data: unknown) => new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
let fetcher: ReturnType<typeof vi.fn>;
beforeEach(() => {
  state.session = null; state.turns = []; state.interpret.mockReset(); state.provider.mockReset();
  fetcher = vi.fn(async (url: URL, init?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    if (path === "/api/v1/auth/users" && (init?.method || "GET") === "GET") return json([{ _id: employeeId, id: employeeId, displayName: "La Văn Sến", email: "sen@example.com", monthlySalary: 35000000 }]);
    if (path === "/api/v1/recruitment/applicants" && (init?.method || "GET") === "GET") return json([{ _id: applicantId, id: applicantId, fullName: "Nguyễn Thị Mai", email: "mai@example.com", jobTitle: "Kế toán" }]);
    if (path === "/api/v1/recruitment/jobs" && (init?.method || "GET") === "GET") return json([{ _id: jobId, id: jobId, title: "Kế toán", code: "JOB-001", status: "open" }]);
    if (path === `/api/v1/auth/users/${employeeId}` && init?.method === "DELETE") return json({ status: "success", message: "Xóa nhân sự thành công" });
    throw new Error(`Unexpected API: ${init?.method || "GET"} ${path}`);
  });
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => vi.unstubAllGlobals());

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
