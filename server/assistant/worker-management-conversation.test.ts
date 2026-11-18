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
      updateOne: vi.fn(async (_filter, update) => {
        state.session ??= { messages: [], pending: null, busy: false, messageCount: 0 };
        apply(state.session, update);
      }),
      findOneAndUpdate: vi.fn(async () => { state.session.busy = true; return structuredClone(state.session); }),
      findOne: vi.fn(() => chain(() => state.session)),
    },
    AssistantTurnModel: {
      create: vi.fn(async input => {
        const turn = { ...input, _id: String(state.turns.length + 1), createdAt: new Date(), updatedAt: new Date(), status: "processing" };
        state.turns.push(turn); return turn;
      }),
      updateOne: vi.fn(async (filter, update) => { apply(state.turns.find(turn => turn._id === filter._id), update); }),
      findOne: vi.fn(filter => chain(() => [...state.turns].reverse().find(turn => filter.requestId
        ? turn.requestId === filter.requestId
        : turn.actionId && turn.result?.status === "completed"))),
    },
  };
});
vi.mock("./workflows", async () => {
  const { ASSISTANT_OPERATIONS, defaultWorkflow, operationById } = await import("./catalog");
  return {
    actorScope: () => ({ userId: "actor", companyCode: "TEST" }),
    assertOperation: vi.fn(async (_req, id) => operationById(id)),
    currentWorkflow: vi.fn(async (_req, id) => defaultWorkflow(operationById(id)!)),
    listWorkflows: vi.fn(async () => ASSISTANT_OPERATIONS.filter(op => op.module === "worker").map(defaultWorkflow)),
  };
});
vi.mock("./settings", async () => {
  const { defaultAssistantSettings } = await import("../../src/shared/assistant-workflow");
  return { getSettings: vi.fn(async () => ({ ...defaultAssistantSettings, memoryEnabled: false, autoMemoryEnabled: false, responseRules: "" })) };
});
vi.mock("./interpreter", () => ({ interpretRequest: state.interpret, isEmployeeDetailsIntent: () => false }));
vi.mock("./semantic-interpreter", () => ({ interpretRequest: state.interpret }));
vi.mock("./reply-rules", () => ({ applyAssistantResponseRules: async (reply: unknown) => reply }));
vi.mock("./documents", () => ({ answerAssistantConversation: vi.fn() }));
vi.mock("./session-memory", () => ({ SESSION_MEMORY_LIMIT: 2400, summarizeAssistantSession: async () => null }));

import { processTurn } from "./service";
import { parseAssistantResultTable } from "../../src/shared/assistant-result-table";

const projectId = "64b000000000000000000021";
const workerId = "64b000000000000000000022";
const contractId = "64b000000000000000000023";
const req = { user: { id: "actor", uid: "actor", email: "actor@example.com", companyCode: "TEST", branchId: "507f1f77bcf86cd799439012", role: "admin" }, headers: { authorization: "Bearer scoped" }, socket: { localPort: 4050, localAddress: "127.0.0.1" } } as any;
const turn = (input: any) => processTurn(req, { conversationId: "worker-conversation", requestId: randomUUID(), ...input });
const json = (data: unknown) => new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
let fetcher: ReturnType<typeof vi.fn>;
let savedWorker: Record<string, unknown> | undefined;

beforeEach(() => {
  state.session = null; state.turns = []; state.interpret.mockReset(); state.provider.mockReset();
  savedWorker = undefined;
  fetcher = vi.fn(async (url: URL, init?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    if (path === "/api/v1/worker-management/projects") return json({ success: true, data: [{ _id: projectId, id: projectId, code: "P-10", name: "Dự án lắp đặt", status: "active" }] });
    if (path === "/api/v1/worker-management/workers" && init?.method === "POST") {
      const body = JSON.parse(String(init.body || "{}"));
      savedWorker = { _id: workerId, id: workerId, ...body, status: body.status || "active", laborType: body.laborType || "official" };
      return json({ worker: savedWorker });
    }
    if (path === "/api/v1/worker-management/workers") return json({ workers: [savedWorker || { _id: workerId, id: workerId, fullName: "Lê Minh", status: "active", laborType: "seasonal" }] });
    if (path === `/api/v1/worker-management/workers/${workerId}` && init?.method === "PATCH") {
      Object.assign(savedWorker || {}, JSON.parse(String(init.body || "{}")));
      return json({ worker: savedWorker });
    }
    if (path === "/api/v1/worker-management/labor-contracts") return json({ success: true, data: [{
      _id: contractId, id: contractId, code: "LD-10", clientName: "Công ty Igen", workerId,
      startDate: "2026-01-01", endDate: "2026-12-31", status: "active",
    }] });
    throw new Error(`Unexpected API: ${path}`);
  });
  vi.stubGlobal("fetch", fetcher);
});

it("lets the user choose a contract by its worker and contract code before confirming deletion", async () => {
  state.interpret.mockResolvedValueOnce({ actionId: "worker.labor.contract.delete", values: {}, intentType: "workflow", newRequest: true });

  const selectionPrompt = await turn({ text: "Xóa hợp đồng lao động" });
  expect(selectionPrompt.status).toBe("collecting");
  const contractSelection = selectionPrompt.referenceSelections?.find(group => group.key === "path_id");
  expect(contractSelection?.options.map(option => option.label)).toContain("Lê Minh — mã LD-10");
  expect(selectionPrompt.reply).not.toContain(contractId);

  const preview = await turn({ referenceSelections: { path_id: [contractSelection!.options[0].value] } });
  expect(preview.status).toBe("confirmation");
  expect(preview.action?.title).toBe("Xóa hợp đồng lao động");
  expect(JSON.stringify(preview)).toContain("Lê Minh — mã LD-10");
  expect(JSON.stringify(preview)).not.toContain(contractId);
  expect(fetcher.mock.calls.every(([url]) => !new URL(String(url)).pathname.includes("/renew"))).toBe(true);
});

it("creates a worker, asks for missing optional details, and updates that same worker", async () => {
  state.interpret.mockResolvedValueOnce({ actionId: "worker.create", values: { fullName: "Lê Minh", phone: "0900000000" }, intentType: "workflow" });

  const optionalProjectPrompt = await turn({ text: "Tạo hồ sơ lao động cho Lê Minh, số điện thoại 0900000000" });
  expect(optionalProjectPrompt.status).toBe("collecting");
  expect(optionalProjectPrompt.referenceSelections?.find(group => group.key === "projectId")?.required).toBe(false);
  const preview = await turn({ skipReferenceKeys: ["projectId"] });
  expect(preview.status).toBe("confirmation");
  expect(savedWorker).toBeUndefined();

  const created = await turn({ decision: { id: preview.action!.id, confirmed: true } });
  expect(created.status).toBe("completed");
  expect(created.reply).toContain("Bạn có muốn bổ sung không?");
  expect(savedWorker?.fullName).toBe("Lê Minh");
  expect(parseAssistantResultTable(created.reply)?.rows[0]?.values).toMatchObject({ "Họ và tên": "Lê Minh" });

  const agreed = await turn({ text: "Có" });
  expect(agreed.status).toBe("collecting");
  state.interpret.mockResolvedValueOnce({ actionId: "worker.update", values: { email: "leminh@example.com", address: "Hà Nội" }, intentType: "workflow" });
  const updatePreview = await turn({ text: "Thêm email leminh@example.com, địa chỉ Hà Nội cho lao động vừa tạo" });
  expect(updatePreview.status).toBe("confirmation");
  expect(JSON.stringify(updatePreview)).not.toContain(workerId);

  const updated = await turn({ decision: { id: updatePreview.action!.id, confirmed: true } });
  expect(updated.status).toBe("completed");
  expect(savedWorker).toMatchObject({ fullName: "Lê Minh", email: "leminh@example.com" });
  expect(parseAssistantResultTable(updated.reply)?.rows[0]?.values).toMatchObject({ "Họ và tên": "Lê Minh", Email: "leminh@example.com", "Địa chỉ": "Hà Nội" });
  expect(fetcher.mock.calls.filter(([url, init]) => new URL(String(url)).pathname === "/api/v1/worker-management/workers" && init?.method === "POST")).toHaveLength(1);
  expect(fetcher.mock.calls.filter(([url, init]) => new URL(String(url)).pathname === `/api/v1/worker-management/workers/${workerId}` && init?.method === "PATCH")).toHaveLength(1);
});
afterEach(() => vi.unstubAllGlobals());
it.each([
  ["Đổi địa điểm Dự án lắp đặt thành Hà Nội", {location: "Hà Nội"}],
  ["Dời ngày kết thúc Dự án lắp đặt sang 30/12/2026", {endDate: "2026-12-30"}],
])("does not require unrelated workers or weekdays on partial project updates: %s", async (text, values) => {
  state.interpret.mockResolvedValueOnce({actionId:"worker.project.update",values:{path_id:"Dự án lắp đặt",...values},intentType:"workflow"});
  const preview=await turn({text});
  expect(preview.status,preview.reply).toBe("confirmation");
  expect(preview.referenceSelections).toBeUndefined();
  expect(state.session.pending.resolved).not.toHaveProperty("workerIds");
  expect(state.session.pending.resolved).not.toHaveProperty("daysOfWeek");
});

it("lets the user choose a project and a worker in chat before confirming the assignment", async () => {
  state.interpret.mockResolvedValueOnce({ actionId: "worker.project.worker.add", values: {}, intentType: "workflow", newRequest: true });

  const projectPrompt = await turn({ text: "Thêm lao động vào dự án" });
  expect(projectPrompt.status).toBe("collecting");
  const projectSelection = projectPrompt.referenceSelections?.find(group => group.key === "path_id");
  expect(projectSelection?.options.map(option => option.label)).toContain("Dự án lắp đặt — mã P-10");
  const workerSelection = projectPrompt.referenceSelections?.find(group => group.key === "workerId");
  expect(workerSelection?.options.map(option => option.label)).toContain("Lê Minh");
  expect(projectPrompt.reply).not.toContain(projectId);

  const preview = await turn({ referenceSelections: {
    path_id: [projectSelection!.options[0].value],
    workerId: [workerSelection!.options[0].value],
  } });
  expect(preview.status).toBe("confirmation");
  expect(preview.action?.title).toBe("Thêm lao động vào dự án");
  expect(JSON.stringify(preview)).toContain("Dự án lắp đặt");
  expect(JSON.stringify(preview)).toContain("Lê Minh");
  expect(JSON.stringify(preview)).not.toContain(projectId);
  expect(JSON.stringify(preview)).not.toContain(workerId);
  expect(fetcher.mock.calls.every(([url]) => ["/api/v1/worker-management/projects", "/api/v1/worker-management/workers"].includes(new URL(String(url)).pathname))).toBe(true);
});
