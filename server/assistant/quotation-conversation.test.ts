import { randomUUID } from "node:crypto";
import { conversationAudit } from "./testing/conversation-audit";
import { quoteCreatedRange } from "../modules/quotation/created-range";
import { appendFileSync } from "node:fs";
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
    listWorkflows: vi.fn(async () => ASSISTANT_OPERATIONS.filter(op => op.module === "quotation").map(defaultWorkflow)) };
});
vi.mock("./settings", async () => { const { defaultAssistantSettings } = await import("../../src/shared/assistant-workflow"); return { getSettings: vi.fn(async () => ({ ...defaultAssistantSettings, memoryEnabled: false, autoMemoryEnabled: false, responseRules: "" })) }; });
vi.mock("./interpreter", () => ({ interpretRequest: state.interpret, isEmployeeDetailsIntent: () => false }));
vi.mock("./semantic-interpreter", () => ({ interpretRequest: state.interpret }));
vi.mock("./reply-rules", () => ({ applyAssistantResponseRules: async reply => reply }));
vi.mock("./documents", () => ({ answerAssistantConversation: vi.fn() }));
vi.mock("./session-memory", () => ({ SESSION_MEMORY_LIMIT: 2400, summarizeAssistantSession: async () => null }));
import { processTurn } from "./service";
import { parseAssistantResultTable } from "../../src/shared/assistant-result-table";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AssistantActionProductTable, AssistantMessageContent } from "../../src/components/common/AssistantMessageContent";
import { AssistantQuotationAcceptanceForm } from "../../src/components/common/AssistantQuotationAcceptanceForm";
import { formatActionPreviewValues } from "../../src/components/common/assistant-message-format";
const branchId = "507f1f77bcf86cd799439012", productId = "507f1f77bcf86cd799439021", templateId = "507f1f77bcf86cd799439022", quoteId = "507f1f77bcf86cd799439023", contractId = "507f1f77bcf86cd799439024", acceptanceId = "507f1f77bcf86cd799439025";
const req = { user: { id: "actor", companyCode: "TEST", branchId, role: "admin" }, headers: { authorization: "Bearer scoped" }, socket: { localPort: 4050, localAddress: "127.0.0.1" } } as any;
const json = (data: unknown) => new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
let products: any[], quotes: any[], contracts: any[], acceptances: any[];
let fetcher: ReturnType<typeof vi.fn>;
let auditTurns: Array<{ input: unknown; reply: unknown }> = [];
const audit = conversationAudit("quotation");
const turn = async (input: any) => {
  const reply = await audit.turn(input, () => processTurn(req, { conversationId: "conversation", requestId: randomUUID(), ...input }));
  auditTurns.push({ input: structuredClone(input), reply: structuredClone(reply) });
  return reply;
};
const interpreted = (action: string, values: Record<string, unknown>) => state.interpret.mockResolvedValueOnce({ actionId: `quotation.${action}`, values, intentType: "workflow", newRequest: false });
const confirm = (reply: any) => turn({ decision: { id: reply.action.id, confirmed: true } });

it.each(["Cho xem dự toán đã duyệt của An", "Tìm các dự toán khách An đã được duyệt"])("simulated AI quotation report: %s", async text => {
  const { interpretRequest } = await vi.importActual<typeof import("./semantic-interpreter")>("./semantic-interpreter");
  state.interpret.mockImplementation(interpretRequest);
  state.provider.mockResolvedValue({ text: JSON.stringify({ actionId: "quotation.quote.list", values: { kind: "estimate", status: "approved", search: "An", page: 2 } }) });
  quotes = [{ _id: quoteId, quoteNumber: "DT-2026-0001", kind: "estimate", status: "approved", customerName: "An", total: 1500000, currency: "VND" }];
  const reply = await turn({ text: text + ", trang 2" });
  expect(reply.status, JSON.stringify(reply)).toBe("completed");
  expect(reply.reply).toContain("DT-2026-0001");
  const call = fetcher.mock.calls.find(([url]) => new URL(String(url)).pathname.endsWith("/quotes"));
  const query = Object.fromEntries(new URL(String(call![0])).searchParams);
  expect(query).toMatchObject({ kind: "estimate", status: "approved", search: "An", page: "2" });
  expect(fetcher.mock.calls.every(([, init]) => !init?.method || init.method === "GET")).toBe(true);
});

it("filters quotation creation dates to the requested month with Vietnamese day boundaries", async () => {
  const { interpretRequest } = await vi.importActual<typeof import("./semantic-interpreter")>("./semantic-interpreter");
  state.interpret.mockImplementation(interpretRequest);
  state.provider.mockResolvedValue({ text: JSON.stringify({ actionId: "quotation.quote.list", values: { from: "2026-11-01", to: "2026-11-30" } }) });
  quotes = [
    { _id: quoteId, quoteNumber: "DT-NOV", kind: "estimate", customerName: "An", createdAt: "2026-10-31T17:00:00.000Z" },
    { _id: productId, quoteNumber: "DT-OCT", kind: "estimate", customerName: "An", createdAt: "2026-10-31T16:59:59.999Z" },
    { _id: templateId, quoteNumber: "DT-DEC", kind: "estimate", customerName: "An", createdAt: "2026-11-30T17:00:00.000Z" },
  ];
  const reply = await turn({ text: "Danh sách dự toán lập trong tháng 11/2026" });
  expect(reply.status, JSON.stringify(reply)).toBe("completed");
  expect(reply.reply).toContain("DT-NOV");
  expect(reply.reply).not.toContain("DT-OCT");
  expect(reply.reply).not.toContain("DT-DEC");
  const calls = fetcher.mock.calls.filter(([url]) => new URL(String(url)).pathname.endsWith("/quotes"));
  expect(calls.length).toBeGreaterThan(0);
  for (const [url] of calls) expect(Object.fromEntries(new URL(String(url)).searchParams)).toMatchObject({ from: "2026-11-01", to: "2026-11-30" });
});

it("must not report an unfiltered quotation list when simulated AI omits the requested month", async () => {
  const { interpretRequest } = await vi.importActual<typeof import("./semantic-interpreter")>("./semantic-interpreter");
  state.interpret.mockImplementation(interpretRequest);
  state.provider.mockResolvedValue({ text: JSON.stringify({ actionId: "quotation.quote.list", values: { kind: "estimate" } }) });
  quotes = [{ _id: quoteId, quoteNumber: "DT-2026-0001", kind: "estimate", status: "approved", customerName: "An", total: 1500000, createdAt: "2026-10-01T00:00:00.000Z" }];
  const reply = await turn({ text: "Danh sách dự toán lập trong tháng 11/2026" });
  expect(reply.status, JSON.stringify(reply)).not.toBe("completed");
});

it("creates an estimate request after correcting the model's budget choice", async () => {
  const { interpretRequest } = await vi.importActual<typeof import("./semantic-interpreter")>("./semantic-interpreter");
  state.interpret.mockImplementation(interpretRequest);
  state.provider.mockResolvedValue({ text: JSON.stringify({ actionId: "quotation.budget.create", values: { templateId, customerName: "An" } }) });
  const saved: any[] = [];
  const original = fetcher.getMockImplementation()! as (url: URL, init?: RequestInit) => Promise<Response>;
  fetcher.mockImplementation(async (url, init) => {
    const path = new URL(String(url)).pathname;
    if (path.endsWith("/quote-templates")) return json({ templates: [{ id: templateId, name: "Mẫu dự toán", category: "estimate" }] });
    if (path.endsWith("/price-lists")) return json({ priceLists: [] });
    if (path.endsWith("/quote-requests") && init?.method === "POST") {
      const request = { _id: quoteId, ...JSON.parse(String(init.body)), status: "draft" };
      saved.push(request);
      return json({ request });
    }
    return original(url, init);
  });
  const text = "Tạo dự toán cho An theo mẫu dự toán, ngân sách 100 triệu";
  let preview = await turn({ text });
  if (preview.status !== "confirmation") preview = await turn({ skipReferenceKeys: ["priceListId"] });
  expect(preview.status, JSON.stringify(preview)).toBe("confirmation");
  expect(state.session.pending.actionId).toBe("quotation.request.create");
  const result = await confirm(preview);
  expect(result.status, JSON.stringify(result)).toBe("completed");
  expect(saved).toHaveLength(1);
  expect(saved[0].requestText).toBe(text);
  expect(fetcher.mock.calls.some(([url]) => String(url).includes("/budget"))).toBe(false);
});

it("keeps the quotation export job flow when the user explicitly requests Excel", async () => {
  quotes.push({ _id: quoteId, quoteNumber: "BG-2026-00001", kind: "estimate", status: "approved", customerName: "An", updatedAt: "2026-11-11T01:00:00.000Z", lines: [] });
  const original = fetcher.getMockImplementation()! as (url: URL, init?: RequestInit) => Promise<Response>;
  fetcher.mockImplementation(async (url, init) => new URL(String(url)).pathname.endsWith(`/quotes/${quoteId}/export`)
    ? json({ status: "queued" }) : original(url, init));
  interpreted("quote.export", { path_id: quoteId, draft: true, excel: true });
  const preview = await turn({ text: "Xuất Excel bản nháp dự toán BG-2026-00001" });
  expect(preview.status, JSON.stringify(preview)).toBe("confirmation");
  const reply = await confirm(preview);
  expect(reply.status).toBe("completed");
  expect(reply.reply).toContain("Đang chờ xử lý");
  expect(reply.reply).toContain("File đang được xử lý");
  expect(reply.files).toBeUndefined();
  expect(reply.reply).not.toContain("Không có dữ liệu");
  expect(state.documents).not.toHaveBeenCalled();
});
it("exports a quotation list as Excel without confusing it with a document export", async () => {
  quotes.push({ _id: quoteId, quoteNumber: "BG-2026-00001", kind: "estimate", status: "draft", customerName: "An", total: 250000, currency: "VND", updatedAt: "2026-11-11T01:00:00.000Z" });
  const original = fetcher.getMockImplementation()! as (url: URL, init?: RequestInit) => Promise<Response>;
  fetcher.mockImplementation(async (url, init) => new URL(String(url)).pathname.endsWith("/quotes")
    ? json({ quotes: quotes.filter(quote => !new URL(String(url)).searchParams.get("kind") || quote.kind === new URL(String(url)).searchParams.get("kind")) }) : original(url, init));
  interpreted("quote.list", {});
  const reply = await turn({ text: "Xuất danh sách báo giá ra Excel" });
  expect(reply.status).toBe("completed");
  expect(reply.files).toHaveLength(1);
  expect(reply.files?.[0].format).toBe("xlsx");
  const content = JSON.stringify(state.documents.mock.calls[0][0].content);
  expect(content, content).toContain("BG-2026-00001");
  expect(content).not.toContain(quoteId);
  expect(state.documents.mock.calls[0][0].content.sheets[0].rows).toHaveLength(1);
  expect(state.session.messages.at(-1).files).toEqual(reply.files);
});

it("shows the actual business rejection after confirmation without claiming creation", async () => {
  const original = fetcher.getMockImplementation()! as (url: URL, init?: RequestInit) => Promise<Response>;
  fetcher.mockImplementation(async (url, init) => new URL(String(url)).pathname.endsWith("/catalog") && init?.method === "POST"
    ? new Response(JSON.stringify({ error: "Mã hàng ML01 đã tồn tại." }), { status: 409, headers: { "Content-Type": "application/json" } }) : original(url, init));
  interpreted("catalog.create", { sku: "ML01", name: "Máy lọc", unit: "cái", price: 250000 });
  const preview = await turn({ text: "Thêm Máy lọc mã ML01, đơn vị cái, giá 250000 vào bảng giá" });
  expect(preview.status).toBe("confirmation");
  const reply = await confirm(preview);
  expect(reply.status).toBe("failed");
  expect(reply.reply).toContain("Mã hàng ML01 đã tồn tại");
  expect(products).toHaveLength(0);
  expect(fetcher.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
});

it("cancels a catalog creation without sending a write", async () => {
  interpreted("catalog.create", { sku: "ML01", name: "Máy lọc", unit: "cái", price: 250000 });
  const preview = await turn({ text: "Thêm sản phẩm Máy lọc vào bảng giá" });
  expect(preview.status).toBe("confirmation");
  const reply = await turn({ decision: { id: preview.action!.id, confirmed: false } });
  expect(reply.status).toBe("cancelled");
  expect(products).toHaveLength(0);
  expect(fetcher.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
});
beforeEach(() => {
  audit.reset();
  state.provider.mockReset();
  auditTurns = [];
  state.session = null; state.turns = []; state.interpret.mockReset(); state.documents.mockReset(); products = []; quotes = []; contracts = []; acceptances = [];
  fetcher = vi.fn(async (url: URL, init?: RequestInit) => {
    const path = new URL(String(url)).pathname, body = init?.body ? JSON.parse(String(init.body)) : {};
    if (path.endsWith("/quote-templates")) return json({ templates: [{ id: templateId, name: "Mẫu chuẩn", category: "quote", createdAt: "2026-11-01T00:00:00.000Z" }] });
    if (path.endsWith(`/contracts/${contractId}`) && init?.method === "PATCH") {
      Object.assign(contracts[0], body);
      return json({ contract: contracts[0] });
    }
    if (path.endsWith(`/contracts/${contractId}`)) return json({ contract: contracts[0] });
    if (path.endsWith("/contracts")) return json({ contracts });
    if (path.endsWith("/acceptance-records") && init?.method === "POST") {
      const contract = contracts[0];
      const record = { _id: acceptanceId, ...body, acceptanceNumber: "NT-2026-00001", contractNumber: contract.contractNumber, status: "draft", settlementAmount: contract.total, amountPaid: contract.depositAmount };
      acceptances.push(record);
      return json({ record });
    }
    if (path.endsWith("/catalog") && init?.method === "POST") {
      const item = { _id: productId, ...body, description: body.description || "", attributes: body.attributes || {}, active: true, updatedAt: "2026-11-11T01:00:00.000Z" }; products.push(item); return json({ item });
    }
    if (path.endsWith(`/catalog/${productId}`) && init?.method === "PATCH") { Object.assign(products[0], body, { updatedAt: "2026-11-11T02:00:00.000Z" }); return json({ item: products[0] }); }
    if (path.endsWith("/catalog")) return json({ items: products });
    if (path.endsWith("/customer-quotes/suggest") && init?.method === "POST") {
      return json({ items: products.map(p => ({ catalogItemId: p._id, quantity: 1, unit: p.unit })), missingProducts: ["Vòi inox phụ"] });
    }
    if (path.endsWith("/customer-quotes") && init?.method === "POST") {
      if ((body.items || []).some((item: any) => typeof item.catalogUpdatedAt !== "string")) {
        return new Response(JSON.stringify({ error: "Thiếu phiên bản bảng giá. Hãy tải lại sản phẩm trước khi tạo báo giá." }), { status: 428, headers: { "Content-Type": "application/json" } });
      }
      const quote = { _id: quoteId, quoteNumber: "BG-2026-00001", kind: "customer", ...body, customerEmail: body.customerEmail || "", customerPhone: body.customerPhone || "", status: "draft", lines: [{ catalogItemId: productId, quantity: 1, unit: "cái", source: "catalog", name: "Máy lọc" }], updatedAt: "2026-11-11T01:00:00.000Z" }; quotes.push(quote); return json({ quote });
    }
    if (path.endsWith(`/quotes/${quoteId}`) && init?.method === "PATCH") { Object.assign(quotes[0], body, { updatedAt: "2026-11-11T02:00:00.000Z" }); return json({ quote: quotes[0] }); }
    if (path.endsWith(`/quotes/${quoteId}`)) return json({ quote: { ...quotes[0], requestText: "" } });
    if (path.endsWith("/quotes")) {
      const query = new URL(String(url)).searchParams;
      const range = quoteCreatedRange(query.get("from") ?? undefined, query.get("to") ?? undefined);
      return json({ quotes: quotes.filter(quote => (!query.get("kind") || quote.kind === query.get("kind")) && (!range || new Date(quote.createdAt) >= range.$gte && new Date(quote.createdAt) < range.$lt)) });
    }
    throw new Error(`Unexpected API: ${init?.method} ${path}`);
  });
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => vi.unstubAllGlobals());
afterEach(context => audit.write(context, state, { products, quotes, contracts, acceptances, pending: state.session?.pending }));
afterEach(context => {
  if (!process.env.ASSISTANT_AUDIT_OUTPUT) return;
  appendFileSync(process.env.ASSISTANT_AUDIT_OUTPUT, JSON.stringify({
    name: context.task.name, turns: auditTurns, records: { products, quotes, contracts, acceptances },
    apiCalls: fetcher.mock.calls.map(([url, init]) => ({ path: new URL(String(url)).pathname, query: new URL(String(url)).search, method: init?.method || "GET", ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}) })),
    storedFiles: state.documents.mock.calls.map(([document]) => ({ title: document.title, content: document.content, files: document.files?.map(({ bytes: _bytes, ...file }: any) => file) })),
  }) + "\n", "utf8");
});

it.each([0, 500000, undefined])("updates only requested contract fields and preserves deposit when omitted: %s", async depositAmount => {
  contracts.push({ _id: contractId, contractNumber: "HD-2026-0001", status: "draft", total: 1500000, depositAmount: 300000,
    scope: "Lắp đặt", projectName: "Công trình A", projectAddress: "Hà Nội", deliverables: "Hồ sơ bàn giao", paymentTerms: "Hai đợt",
    deliveryTerms: "30 ngày", signingPlace: "Hà Nội", signedDate: "2026-11-01", bankDetails: "", otherTerms: "", updatedAt: "2026-11-01T00:00:00.000Z" });
  interpreted("contract.update", { path_id: contractId, ...(depositAmount === undefined ? { projectName: "Công trình B" } : { depositAmount }) });
  const preview = await turn({ text: depositAmount === undefined ? "Đổi tên công trình thành Công trình B" : `Sửa tiền đặt cọc hợp đồng HD-2026-0001 thành ${depositAmount} đồng` });
  expect(preview.status, JSON.stringify(preview)).toBe("confirmation");
  const reply = await confirm(preview);
  expect(reply.status, JSON.stringify(reply)).toBe("completed");
  expect(contracts).toHaveLength(1);
  expect(contracts[0]).toMatchObject({ depositAmount: depositAmount ?? 300000, paymentTerms: "Hai đợt", deliveryTerms: "30 ngày", projectName: depositAmount === undefined ? "Công trình B" : "Công trình A" });
  expect(fetcher.mock.calls.filter(([url, init]) => String(url).includes(`/contracts/${contractId}`) && init?.method === "PATCH")).toHaveLength(1);
});

it("shows signed-contract products and amounts in acceptance chat, then creates one record with the submitted line quantities", async () => {
  contracts.push({
    _id: contractId,
    contractNumber: "HD-2026-0001",
    status: "signed",
    signedDate: "2026-10-01",
    total: 1500000,
    depositAmount: 300000,
    currency: "VND",
    lines: [
      { name: "Máy lọc nước", sku: "ML01", description: "Máy lọc gia đình", unit: "cái", quantity: 2 },
      { name: "Vòi inox", sku: "VI02", unit: "cái", quantity: 3 },
    ],
  });
  interpreted("acceptance.create", {
    contractId: "HD-2026-0001",
    acceptedDate: "2026-11-13",
    location: "Hà Nội",
    result: "Đạt",
    notes: "Không có ghi chú thêm",
    startTime: "08:00",
    endTime: "10:00",
    handoverDetails: "Không có hồ sơ bàn giao thêm",
    qualityAssessment: "Đạt yêu cầu",
    paymentDueDays: 30,
  });

  const formStep = await turn({ text: "Tạo biên bản nghiệm thu hợp đồng HD-2026-0001" });
  expect(formStep.status, formStep.reply).toBe("collecting");
  expect(formStep.reply).toContain("khối lượng nghiệm thu cho từng sản phẩm");
  expect(formStep.quotationAcceptanceForm).toMatchObject({
    contractNumber: "HD-2026-0001",
    lines: [
      { lineIndex: 0, name: "Máy lọc nước", sku: "ML01", contractQuantity: 2, unit: "cái" },
      { lineIndex: 1, name: "Vòi inox", sku: "VI02", contractQuantity: 3, unit: "cái" },
    ],
  });
  expect(formStep.action.values).toContainEqual({ label: "Giá trị quyết toán theo hợp đồng", value: "1.500.000 VND", defaulted: false });
  expect(formStep.action.values).toContainEqual({ label: "Số tiền đã thanh toán theo hợp đồng", value: "300.000 VND", defaulted: false });
  expect(JSON.stringify(formStep)).not.toContain(contractId);

  const preview = await turn({ acceptanceLines: { lines: [
    { lineIndex: 0, acceptedQuantity: 1.5, acceptedDetails: "Đã kiểm tra hoạt động" },
    { lineIndex: 1, acceptedQuantity: 2, acceptedDetails: "Đủ số lượng" },
  ] } });
  expect(preview.status, preview.reply).toBe("confirmation");
  expect(preview.action.values).toContainEqual({ label: "Giá trị quyết toán theo hợp đồng", value: "1.500.000 VND", defaulted: false });
  expect(preview.action.values.map(value => value.label)).not.toContain("Khối lượng nghiệm thu theo thứ tự dòng hợp đồng (từ 0)");
  expect(preview.quotationAcceptanceForm).toMatchObject({
    lines: [
      { lineIndex: 0, name: "Máy lọc nước", contractQuantity: 2, acceptedQuantity: 1.5, acceptedDetails: "Đã kiểm tra hoạt động" },
      { lineIndex: 1, name: "Vòi inox", contractQuantity: 3, acceptedQuantity: 2, acceptedDetails: "Đủ số lượng" },
    ],
  });
  const acceptanceSummary = renderToStaticMarkup(createElement(AssistantQuotationAcceptanceForm, {
    value: preview.quotationAcceptanceForm!, readOnly: true, submitting: false, canSubmit: false, onSubmit: vi.fn(),
  }));
  expect(acceptanceSummary).toContain("Máy lọc nước");
  expect(acceptanceSummary).toContain("1.5 cái");
  expect(acceptanceSummary).toContain("Đã kiểm tra hoạt động");
  expect(acceptanceSummary).not.toMatch(/lineIndex|acceptedQuantity|<input|<button/);

  const created = await confirm(preview);
  expect(created.status).toBe("completed");
  expect(acceptances).toHaveLength(1);
  expect(acceptances[0]).toMatchObject({
    contractId,
    lines: [
      { lineIndex: 0, acceptedQuantity: 1.5, acceptedDetails: "Đã kiểm tra hoạt động" },
      { lineIndex: 1, acceptedQuantity: 2, acceptedDetails: "Đủ số lượng" },
    ],
    settlementAmount: 1500000,
    amountPaid: 300000,
  });
  const submittedBody = JSON.parse(String(fetcher.mock.calls.find(([url, init]) => String(url).endsWith("/acceptance-records") && init?.method === "POST")?.[1]?.body));
  expect(submittedBody).not.toHaveProperty("settlementAmount");
  expect(submittedBody).not.toHaveProperty("amountPaid");
  expect(parseAssistantResultTable(created.reply)?.rows[0].values).toMatchObject({
    "Giá trị quyết toán": "1.500.000",
    "Đã thanh toán": "300.000",
  });
  expect(created.reply).not.toMatch(/507f|__assistant|workflow/);
});

it("creates a price-book item, asks about missing optional data, agrees and updates that same item after confirmation", async () => {
  interpreted("catalog.create", { sku: "ML01", name: "Máy lọc", unit: "cái", price: 250000 });
  const preview = await turn({ text: "Thêm sản phẩm ML01 Máy lọc vào bảng giá, đơn vị cái, giá 250000" });
  expect(preview.status).toBe("confirmation"); expect(products).toHaveLength(0);
  const created = await confirm(preview);
  expect(created.status).toBe("completed"); expect(created.reply).toContain("Bạn có muốn bổ sung không?");
  expect(parseAssistantResultTable(created.reply)?.rows[0].values).toMatchObject({ "Mã hàng": "ML01", "Tên": "Máy lọc" });
  expect(created.reply).not.toContain("Tiền tệ: VND");
  const agreed = await turn({ text: "Có" }); expect(agreed.status).toBe("collecting");
  interpreted("catalog.update", { description: "Lõi lọc cao cấp" });
  const update = await turn({ text: "Bổ sung mô tả: Lõi lọc cao cấp" }); expect(update.status).toBe("confirmation");
  const saved = await confirm(update);
  expect(saved.status).toBe("completed"); expect(products).toHaveLength(1); expect(products[0]).toMatchObject({ sku: "ML01", description: "Lõi lọc cao cấp", price: 250000 });
  expect(fetcher.mock.calls.filter(([url, init]) => String(url).endsWith("/catalog") && init?.method === "POST")).toHaveLength(1);
  expect(saved.reply).not.toMatch(/507f|__assistant|workflow/);
});

it("lets the user skip optional data without another API write", async () => {
  interpreted("catalog.create", { sku: "ML01", name: "Máy lọc", unit: "cái", price: 250000 });
  const created = await confirm(await turn({ text: "Thêm sản phẩm vào bảng giá" })); expect(created.reply).toContain("Bạn có muốn bổ sung không?");
  const before = fetcher.mock.calls.length;
  const skipped = await turn({ text: "Bỏ qua" }); expect(skipped.status).toBe("completed");
  expect(fetcher).toHaveBeenCalledTimes(before); expect(products).toHaveLength(1);
});

it("keeps a created quotation privately for an email supplement and preserves its existing product lines", async () => {
  products.push({ _id: productId, sku: "ML01", name: "Máy lọc", unit: "cái", price: 250000, currency: "VND", active: true, updatedAt: "2026-11-11T01:00:00.000Z" });
  interpreted("customer-quote.create", { customerName: "An", templateId: "Mẫu chuẩn", items: JSON.stringify([{ catalogItemId: "ML01" }]) });
  const preview = await turn({ text: "Lập báo giá khách hàng An, máy lọc ML01, mẫu Mẫu chuẩn" }); expect(preview.status).toBe("confirmation");
  expect(JSON.stringify(preview)).not.toMatch(/507f|__assistant/);
  const created = await confirm(preview); expect(created.status).toBe("completed"); expect(created.reply).toContain("Bạn có muốn bổ sung không?");
  interpreted("quote.update", { customerEmail: "an@example.com" });
  const update = await turn({ text: "Bổ sung email báo giá an@example.com" }); expect(update.status).toBe("confirmation");
  const saved = await confirm(update); expect(saved.status).toBe("completed");
  expect(quotes).toHaveLength(1); expect(quotes[0].customerEmail).toBe("an@example.com"); expect(quotes[0].items).toMatchObject([{ catalogItemId: productId, quantity: 1, unit: "cái" }]);
  expect(parseAssistantResultTable(saved.reply)?.rows[0].values["Email khách hàng"]).toBe("an@example.com");
  const rendered = renderToStaticMarkup(createElement(AssistantMessageContent, { content: saved.reply }));
  expect(rendered).toContain("<table"); expect(rendered).toContain("an@example.com");
});

it("lets the user choose between manual product selection and AI product suggestions when creating a customer quotation", async () => {
  products.push({ _id: productId, sku: "ML01", name: "Máy lọc", unit: "cái", price: 250000, currency: "VND", active: true, updatedAt: "2026-11-11T01:00:00.000Z" });
  interpreted("customer-quote.create", { customerName: "Bình", templateId: "Mẫu chuẩn" });
  const modeStep = await turn({ text: "Lập báo giá khách hàng cho Bình, dùng Mẫu chuẩn" });
  expect(modeStep.status).toBe("collecting");
  expect(modeStep.reply).toContain("tự chọn sản phẩm từ bảng giá hay để AI gợi ý sản phẩm");
  expect(modeStep.referenceSelections).toEqual([
    {
      key: "customerQuoteMode",
      label: "Cách chọn sản phẩm báo giá",
      required: true,
      multiple: false,
      options: [
        { value: "manual", label: "Tự chọn sản phẩm từ bảng giá" },
        { value: "ai", label: "Để AI gợi ý sản phẩm theo yêu cầu" },
      ],
    },
  ]);
  const aiPromptStep = await turn({ referenceSelections: { customerQuoteMode: ["ai"] } });
  expect(aiPromptStep.status).toBe("collecting");
  expect(aiPromptStep.reply).toContain("nhập mô tả yêu cầu của khách hàng");
  expect(aiPromptStep.referenceSelections).toBeUndefined();
  interpreted("customer-quote.create", {});
  const preview = await turn({ text: "Gia đình 4 người cần máy lọc nước và vòi inox phụ" });
  expect(preview.status).toBe("confirmation");
  expect(preview.action?.values).toEqual(expect.arrayContaining([
    expect.objectContaining({ label: "Sản phẩm AI gợi ý", value: "ML01 — Máy lọc" }),
    expect.objectContaining({ label: "Chưa có trong bảng giá", value: "Vòi inox phụ" }),
  ]));
  const formattedPreviewValues = formatActionPreviewValues(preview.action!.values);
  const suggestedProductField = formattedPreviewValues.find(item => item.label === "Sản phẩm AI gợi ý");
  expect(suggestedProductField?.fullWidth).toBe(true);
  expect(suggestedProductField?.productTable).toEqual({
    hasSku: true,
    hasQuantity: false,
    rows: [{ number: 1, sku: "ML01", name: "Máy lọc" }],
  });
  const previewTableMarkup = renderToStaticMarkup(
    createElement(AssistantActionProductTable, {
      label: suggestedProductField!.label,
      table: suggestedProductField!.productTable!,
    }),
  );
  expect(previewTableMarkup).toContain("<table");
  expect(previewTableMarkup).toContain("Mã sản phẩm");
  expect(previewTableMarkup).toContain("Tên sản phẩm");
  expect(previewTableMarkup).toContain("ML01");
  expect(previewTableMarkup).toContain("Máy lọc");
  expect(JSON.stringify(preview)).not.toMatch(/507f|__assistant/);
  const created = await confirm(preview);
  expect(created.status).toBe("completed");
  expect(quotes).toHaveLength(1);
  expect(quotes[0]).toMatchObject({
    customerName: "Bình",
    sourceRequirements: "Gia đình 4 người cần máy lọc nước và vòi inox phụ",
    items: [{ catalogItemId: productId, unit: "cái", quantity: 1 }],
    missingProducts: ["Vòi inox phụ"],
  });
});

it("shows the price-book product selector after the user chooses manual product selection", async () => {
  products.push(
    { _id: productId, sku: "ML01", name: "Máy lọc", unit: "cái", price: 250000, currency: "VND", active: true, updatedAt: "2026-11-11T01:00:00.000Z" },
    { _id: "507f1f77bcf86cd799439099", sku: "ML99", name: "Máy lọc cũ", unit: "cái", price: 150000, currency: "VND", active: false, updatedAt: "2026-11-11T01:00:00.000Z" },
  );
  interpreted("customer-quote.create", { customerName: "Chi", templateId: "Mẫu chuẩn" });
  const modeStep = await turn({ text: "Lập báo giá khách hàng cho Chi, dùng Mẫu chuẩn" });
  expect(modeStep.referenceSelections?.some((group: any) => group.key === "customerQuoteMode")).toBe(true);
  const manualStep = await turn({ referenceSelections: { customerQuoteMode: ["manual"] } });
  expect(manualStep.status).toBe("collecting");
  expect(manualStep.reply).toContain("chọn một hoặc nhiều sản phẩm từ bảng giá bên dưới");
  const itemSelection = manualStep.referenceSelections?.find((group: any) => group.key === "items");
  expect(itemSelection).toMatchObject({
    key: "items",
    required: true,
    multiple: true,
    options: [{ value: "ML01 · Máy lọc", label: "ML01 · Máy lọc" }],
  });
  const preview = await turn({ referenceSelections: { items: [itemSelection!.options[0].value] } });
  expect(preview.status).toBe("confirmation");
  const created = await confirm(preview);
  expect(created.status).toBe("completed");
  expect(quotes).toHaveLength(1);
  expect(quotes[0]).toMatchObject({ customerName: "Chi", items: [{ catalogItemId: productId, unit: "cái", quantity: 1 }] });
});

it("handles a bare 'tạo báo giá mới' flow when the user selects template + AI mode and then replies with customer name and requirement together or separately", async () => {
  products.push({ _id: productId, sku: "CAM01", name: "Camera DAHUA 2MP", unit: "cái", price: 650000, currency: "VND", active: true, updatedAt: "2026-11-11T01:00:00.000Z" });
  interpreted("customer-quote.create", {});
  const startStep = await turn({ text: "tạo báo giá mới" });
  expect(startStep.status).toBe("collecting");
  expect(startStep.reply).toContain("Tên khách hàng");
  expect(startStep.referenceSelections?.map((group: any) => group.key)).toEqual(["templateId", "customerQuoteMode"]);

  const selectedModeStep = await turn({
    referenceSelections: {
      templateId: ["Mẫu chuẩn"],
      customerQuoteMode: ["ai"],
    },
  });
  expect(selectedModeStep.status).toBe("collecting");
  expect(selectedModeStep.reply).toContain("Tên khách hàng");
  expect(selectedModeStep.reply).toContain("nhập mô tả yêu cầu của khách hàng");

  interpreted("customer-quote.create", {});
  const preview = await turn({ text: 'khách tên Hiệp yêu cầu là "lặp đặt camera cho căn nhà 2 tầng 40m"' });
  expect(preview.status).toBe("confirmation");
  expect(preview.action?.values).toEqual(expect.arrayContaining([
    expect.objectContaining({ label: "Tên khách hàng", value: "Hiệp" }),
    expect.objectContaining({ label: "Yêu cầu khách hàng (để AI gợi ý sản phẩm)", value: "lặp đặt camera cho căn nhà 2 tầng 40m" }),
    expect.objectContaining({ label: "Sản phẩm AI gợi ý", value: "CAM01 — Camera DAHUA 2MP" }),
  ]));
  const created = await confirm(preview);
  expect(created.status).toBe("completed");
  expect(quotes).toHaveLength(1);
  expect(quotes[0]).toMatchObject({
    customerName: "Hiệp",
    sourceRequirements: "lặp đặt camera cho căn nhà 2 tầng 40m",
    items: [{ catalogItemId: productId, unit: "cái", quantity: 1, catalogUpdatedAt: "2026-11-11T01:00:00.000Z" }],
  });
});

it("does not mistake a customer-name-only reply for the AI requirement when both customerName and sourceRequirements were missing", async () => {
  products.push({ _id: productId, sku: "CAM01", name: "Camera DAHUA 2MP", unit: "cái", price: 650000, currency: "VND", active: true, updatedAt: "2026-11-11T01:00:00.000Z" });
  interpreted("customer-quote.create", {});
  await turn({ text: "tạo báo giá mới" });
  await turn({
    referenceSelections: {
      templateId: ["Mẫu chuẩn"],
      customerQuoteMode: ["ai"],
    },
  });
  interpreted("customer-quote.create", { customerName: "Vương" });
  const afterNameOnly = await turn({ text: "Vương" });
  expect(afterNameOnly.status).toBe("collecting");
  expect(afterNameOnly.reply).toContain("nhập mô tả yêu cầu của khách hàng");
  expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith("/customer-quotes/suggest"))).toHaveLength(0);

  interpreted("customer-quote.create", {});
  const preview = await turn({ text: "lắp đặt camera và wifi cho 1 tòa nhà 5 tầng diện tích sàn 50m2" });
  expect(preview.status).toBe("confirmation");
  expect(preview.action?.values).toEqual(expect.arrayContaining([
    expect.objectContaining({ label: "Tên khách hàng", value: "Vương" }),
    expect.objectContaining({ label: "Yêu cầu khách hàng (để AI gợi ý sản phẩm)", value: "lắp đặt camera và wifi cho 1 tòa nhà 5 tầng diện tích sàn 50m2" }),
  ]));
});
