import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ session: null as any, turns: [] as any[], interpret: vi.fn(), documents: vi.fn() }));
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
const turn = (input: any) => processTurn(req, { conversationId: "conversation", requestId: randomUUID(), ...input });
const interpreted = (action: string, values: Record<string, unknown>) => state.interpret.mockResolvedValueOnce({ actionId: `quotation.${action}`, values, intentType: "workflow", newRequest: false });
const confirm = (reply: any) => turn({ decision: { id: reply.action.id, confirmed: true } });
beforeEach(() => {
  state.session = null; state.turns = []; state.interpret.mockReset(); state.documents.mockReset(); products = []; quotes = []; contracts = []; acceptances = [];
  fetcher = vi.fn(async (url: URL, init?: RequestInit) => {
    const path = new URL(String(url)).pathname, body = init?.body ? JSON.parse(String(init.body)) : {};
    if (path.endsWith("/quote-templates")) return json({ templates: [{ id: templateId, name: "Mẫu chuẩn", category: "quote", createdAt: "2026-11-01T00:00:00.000Z" }] });
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
    if (path.endsWith("/quotes")) return json({ quotes });
    throw new Error(`Unexpected API: ${init?.method} ${path}`);
  });
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => vi.unstubAllGlobals());

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
