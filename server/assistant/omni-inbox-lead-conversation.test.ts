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
    listWorkflows: vi.fn(async () => ASSISTANT_OPERATIONS.filter(op => op.module === "omni-inbox").map(defaultWorkflow)),
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

const leadId = "64b000000000000000000031";
const studentId = "64b000000000000000000032";
const req = { user: { id: "actor", uid: "actor", email: "actor@example.com", companyCode: "TEST", role: "admin" }, headers: { authorization: "Bearer scoped" }, socket: { localPort: 4050, localAddress: "127.0.0.1" } } as any;
const turn = (input: any) => processTurn(req, { conversationId: "omni-lead-conversation", requestId: randomUUID(), ...input });
const json = (data: unknown) => new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
let fetcher: ReturnType<typeof vi.fn>;
let exportedBody: Record<string, unknown> | undefined;

beforeEach(() => {
  state.session = null; state.turns = []; state.interpret.mockReset(); state.provider.mockReset();
  exportedBody = undefined;
  fetcher = vi.fn(async (url: URL, init?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    if (path === "/api/v1/omni-inbox/leads") return json({ status: "success", data: [{ _id: leadId, customerName: "La Văn Sến", phone: "0987217127", status: "warm" }] });
    if (path === "/api/v1/students") return json({ success: true, students: [{ _id: studentId, fullName: "La Văn Sến", phone: "0987217127", status: "active" }] });
    if (path === "/api/v1/omni-inbox/leads/export-google-sheets" && init?.method === "POST") {
      exportedBody = JSON.parse(String(init.body || "{}"));
      return json({ status: "success", data: { queued: 1, skipped: 0 } });
    }
    if (path === `/api/v1/omni-inbox/leads/${leadId}/module-sync` && init?.method === "POST") {
      return json({ status: "success", data: { targetModule: "students", targetRecordId: studentId, syncedAt: "2026-11-15T04:00:00.000Z" } });
    }
    throw new Error(`Unexpected API: ${path}`);
  });
  vi.stubGlobal("fetch", fetcher);
});

it("lets a user choose both records, review the link, and confirm it without exposing internal IDs", async () => {
  state.interpret.mockResolvedValueOnce({ actionId: "omni-inbox.leads.link-student", values: {}, intentType: "workflow", newRequest: true });

  const selectionPrompt = await turn({ text: "Liên kết khách tiềm năng với học viên" });
  expect(selectionPrompt.status).toBe("collecting");
  const leadSelection = selectionPrompt.referenceSelections?.find(group => group.key === "path_id");
  const studentSelection = selectionPrompt.referenceSelections?.find(group => group.key === "targetRecordId");
  expect(leadSelection?.options.map(option => option.label)).toContain("La Văn Sến");
  expect(studentSelection?.options.map(option => option.label).some(label => label.includes("La Văn Sến"))).toBe(true);
  expect(JSON.stringify(selectionPrompt)).not.toContain(leadId);
  expect(JSON.stringify(selectionPrompt)).not.toContain(studentId);

  const preview = await turn({ referenceSelections: {
    path_id: [leadSelection!.options[0].value],
    targetRecordId: [studentSelection!.options[0].value],
  } });
  expect(preview.status).toBe("confirmation");
  expect(JSON.stringify(preview)).toContain("La Văn Sến");
  expect(JSON.stringify(preview)).not.toContain(leadId);
  expect(JSON.stringify(preview)).not.toContain(studentId);
  expect(fetcher.mock.calls.some(([url, init]) => new URL(String(url)).pathname.endsWith("/module-sync") && init?.method === "POST")).toBe(false);

  const completed = await turn({ decision: { id: preview.action!.id, confirmed: true } });
  expect(completed.status).toBe("completed");
  expect(parseAssistantResultTable(completed.reply)?.rows[0]?.values).toMatchObject({
    "Phân hệ được liên kết": "Học viên",
    "Hồ sơ được liên kết": "La Văn Sến",
  });
  expect(completed.reply).not.toContain(leadId);
  expect(completed.reply).not.toContain(studentId);
  const writes = fetcher.mock.calls.filter(([url, init]) => new URL(String(url)).pathname.endsWith("/module-sync") && init?.method === "POST");
  expect(writes).toHaveLength(1);
  expect(JSON.parse(String(writes[0][1]?.body))).toEqual({ targetModule: "students", targetRecordId: studentId });
});

it("shows selectable CRM records and requires confirmation before queuing Google Sheets export", async () => {
  state.interpret.mockResolvedValueOnce({ actionId: "omni-inbox.leads.export-google-sheets", values: {}, intentType: "workflow", newRequest: true });

  const selectionPrompt = await turn({ text: "Gửi khách tiềm năng sang Google Sheets" });
  expect(selectionPrompt.status).toBe("collecting");
  const leadSelection = selectionPrompt.referenceSelections?.find(group => group.key === "ids");
  expect(leadSelection?.multiple).toBe(true);
  expect(leadSelection?.options.some(option => option.label.includes("La Văn Sến"))).toBe(true);
  expect(JSON.stringify(selectionPrompt)).not.toContain(leadId);

  const preview = await turn({ referenceSelections: { ids: [leadSelection!.options[0].value] } });
  expect(preview.status).toBe("confirmation");
  expect(preview.action?.title).toContain("Google Sheets");
  expect(JSON.stringify(preview)).toContain("La Văn Sến");
  expect(exportedBody).toBeUndefined();

  const completed = await turn({ decision: { id: preview.action!.id, confirmed: true } });
  expect(completed.status).toBe("completed");
  expect(parseAssistantResultTable(completed.reply)?.rows[0]?.values).toMatchObject({ "Đã xếp hàng gửi": "1", "Bỏ qua": "0" });
  expect(exportedBody).toEqual({ ids: [leadId] });
  expect(completed.reply).not.toContain(leadId);
});

afterEach(() => vi.unstubAllGlobals());
