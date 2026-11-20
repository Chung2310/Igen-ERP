import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ session: null as any, turns: [] as any[], interpret: vi.fn(), documents: vi.fn(), provider: vi.fn() }));
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
    ensureAssistantIndexes: vi.fn(), AssistantDocumentModel: { create: state.documents },
    AssistantSessionModel: {
      updateOne: vi.fn(async (_filter, update) => { state.session ??= { messages: [], pending: null, busy: false, messageCount: 0 }; apply(state.session, update); }),
      findOneAndUpdate: vi.fn(async () => { state.session.busy = true; return structuredClone(state.session); }),
      findOne: vi.fn(() => chain(() => state.session)),
    },
    AssistantTurnModel: {
      create: vi.fn(async input => { const turn = { ...input, _id: String(state.turns.length + 1), createdAt: new Date(), updatedAt: new Date(), status: "processing" }; state.turns.push(turn); return turn; }),
      updateOne: vi.fn(async (filter, update) => { apply(state.turns.find(turn => turn._id === filter._id), update); }),
      findOne: vi.fn(filter => chain(() => [...state.turns].reverse().find(turn => filter.requestId ? turn.requestId === filter.requestId : turn.actionId && turn.result?.status === "completed"))),
    },
  };
});
vi.mock("./workflows", async () => {
  const { ASSISTANT_OPERATIONS, defaultWorkflow, operationById } = await import("./catalog");
  return { actorScope: () => ({ userId: "actor", companyCode: "TEST" }),
    assertOperation: vi.fn(async (_req, id) => operationById(id)),
    currentWorkflow: vi.fn(async (_req, id) => defaultWorkflow(operationById(id)!)),
    listWorkflows: vi.fn(async () => ASSISTANT_OPERATIONS.filter(op => op.module === "legal-reference").map(defaultWorkflow)) };
});
vi.mock("./settings", async () => { const { defaultAssistantSettings } = await import("../../src/shared/assistant-workflow"); return { getSettings: vi.fn(async () => ({ ...defaultAssistantSettings, memoryEnabled: false, autoMemoryEnabled: false, responseRules: "" })) }; });
vi.mock("./interpreter", () => ({ interpretRequest: state.interpret, isEmployeeDetailsIntent: () => false }));
vi.mock("./semantic-interpreter", () => ({ interpretRequest: state.interpret }));
vi.mock("./reply-rules", () => ({ applyAssistantResponseRules: async reply => reply }));
vi.mock("./documents", () => ({ answerAssistantConversation: vi.fn() }));
vi.mock("./session-memory", () => ({ SESSION_MEMORY_LIMIT: 2400, summarizeAssistantSession: async () => null }));
import { processTurn } from "./service";
import { assertOperation } from "./workflows";
import { AssistantError } from "./policy";
import { parseAssistantResultTable } from "../../src/shared/assistant-result-table";
import { legalAnswerReply, legalQuestionValues } from "./legal-reference";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AssistantMessageContent } from "../../src/components/common/AssistantMessageContent";

const req = { user: { id: "actor", companyCode: "TEST", role: "admin" }, headers: { authorization: "Bearer scoped" }, socket: { localPort: 4050, localAddress: "127.0.0.1" } } as any;
const turn = (text: string, mode: "qa" | "work" = "qa") => processTurn(req, { conversationId: "conversation", requestId: randomUUID(), mode, text });
let fetcher: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.clearAllMocks();
  state.session = null;
  state.turns = [];
  fetcher = vi.fn(async () => new Response(JSON.stringify({
    answer: "Nội dung được quy định tại Điều 1 [1].",
    sources: [{ citation: "[1]", symbol: "VB-01", title: "Văn bản kiểm thử", article: "Điều 1", issuingAuthority: "Cơ quan ban hành", sourceUrl: "https://vbpl.vn/document", _id: "secret", versionNumber: 2 }],
  }), { headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => vi.unstubAllGlobals());

it.each(["qa", "work"] as const)("answers legal questions through dispatch in %s and keeps a source table", async mode => {
  const reply = await turn("Theo luật lao động, nghỉ phép được quy định thế nào?", mode);
  expect(reply.status, JSON.stringify(reply)).toBe("completed");
  expect(reply.reply).toContain("Điều 1 [1]");
  expect(reply.reply).not.toContain("secret");
  expect(reply.reply).not.toContain("versionNumber");
  expect(parseAssistantResultTable(reply.reply)?.rows[0].values["Văn bản"]).toContain("VB-01");
  expect(renderToStaticMarkup(createElement(AssistantMessageContent, { content: reply.reply }))).toContain("VB-01");
  expect(reply.reply).not.toContain("Bạn có muốn bổ sung không?");
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(String(fetcher.mock.calls[0][0])).toContain("/legal-reference/answer");
  expect(state.turns[0].steps).toEqual([expect.objectContaining({ actionId: "legal.document.answer", status: "completed" })]);
  expect(state.interpret).not.toHaveBeenCalled();
});

it("uses the prior legal topic in a follow-up and sends an explicit date as ISO", async () => {
  await turn("Theo luật lao động, nghỉ phép được quy định thế nào?");
  const reply = await turn("Còn áp dụng tại ngày 01/07/2025 thì sao?");
  expect(reply.status, JSON.stringify(reply)).toBe("completed");
  const payload = JSON.parse(String(fetcher.mock.calls[1][1].body));
  expect(payload.query).toContain("nghỉ phép");
  expect(payload.query).toContain("01/07/2025");
  expect(payload.asOf).toBe("2025-07-01");
});

it("does not call the legal API without permission", async () => {
  vi.mocked(assertOperation).mockRejectedValueOnce(new AssistantError("Bạn không có quyền tra cứu kho pháp luật.", 403));
  const reply = await turn("Tra cứu luật lao động");
  expect(reply.status).not.toBe("completed");
  expect(fetcher).not.toHaveBeenCalled();
});

it("keeps an empty retrieval answer and does not fall back to general AI", async () => {
  fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ answer: "Kho văn bản chưa có đoạn phù hợp.", sources: [] }), { headers: { "Content-Type": "application/json" } }));
  const reply = await turn("Theo pháp luật, quy định này thế nào?");
  expect(reply.reply).toContain("chưa có đoạn phù hợp");
  expect(state.provider).not.toHaveBeenCalled();
});

it("reports API failure without inventing a legal answer", async () => {
  fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ message: "Kho văn bản tạm thời không khả dụng." }), { status: 503, headers: { "Content-Type": "application/json" } }));
  const reply = await turn("Tra cứu luật lao động");
  expect(reply.status).toBe("failed");
  expect(state.provider).not.toHaveBeenCalled();
});

it("leaves document mutations and unrelated questions to their existing paths", () => {
  expect(legalQuestionValues("Đồng bộ kho văn bản pháp luật")).toBeNull();
  expect(legalQuestionValues("Tạo hợp đồng theo luật lao động")).toBeNull();
  expect(legalQuestionValues("Thời tiết hôm nay ra sao?")).toBeNull();
  expect(legalQuestionValues("Người lao động được nghỉ phép bao nhiêu ngày?")?.query).toContain("nghỉ phép");
  expect(legalQuestionValues("Con ap dung tai ngay 31/02/2025 thi sao?", [{ role: "user", content: "Tra cứu luật lao động" }], "/van-ban-phap-luat")?.asOf).toBe("2025-02-31");
});

it("validates calendar dates before calling the API", async () => {
  const reply = await turn("Tra cứu luật lao động tại ngày 31/02/2025");
  expect(reply.status).toBe("collecting");
  expect(fetcher).not.toHaveBeenCalled();
  state.interpret.mockResolvedValueOnce({ actionId: "legal.document.answer", values: { asOf: "2025-02-28" }, intentType: "workflow", newRequest: false });
  const corrected = await turn("Ngày 28/02/2025");
  expect(corrected.status, JSON.stringify(corrected)).toBe("completed");
  expect(JSON.parse(String(fetcher.mock.calls[0][1].body)).asOf).toBe("2025-02-28");
});

it("keeps numbered explanations outside the source table and rejects unsafe links", () => {
  const reply = legalAnswerReply({ answer: "1. Nội dung [1]\n2. Nội dung khác [1]", sources: [{ citation: "[1]", symbol: "VB-01", sourceUrl: "javascript:alert(1)" }] });
  const table = parseAssistantResultTable(reply.reply);
  expect(table?.rows).toHaveLength(1);
  expect(table?.rows[0].values["Văn bản"]).toBe("VB-01");
  expect(table?.before.join("\n")).toContain("1) Nội dung");
  expect(reply.reply).not.toContain("javascript:");
});

it("retains an explicit application date in the next explanation", () => {
  const values = legalQuestionValues("Giải thích chi tiết hơn", [
    { role: "user", content: "Tra cứu luật lao động tại ngày 01/07/2025" },
    { role: "assistant", content: "Kết quả [1]" },
  ], "/van-ban-phap-luat");
  expect(values?.asOf).toBe("2025-07-01");
});
