import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const provider = vi.hoisted(() => vi.fn());
vi.mock("../service/openrouter.service", () => ({ openrouterChat: provider }));
vi.mock("./workflows", async () => {
  const { operationById } = await import("./catalog");
  return { actorScope: () => ({ userId: "actor", companyCode: "TEST" }), assertOperation: vi.fn((_req, id: string) => operationById(id)) };
});
import { ASSISTANT_OPERATIONS, defaultWorkflow, operationById } from "./catalog";
import { interpretRequest } from "./interpreter";
import { callOperation, lookupRecords, resolveReferences, UncertainExecutionError } from "./executor";
import { completeAssistantOperation, hasAssistantUpdatePayload } from "./completion";
import { collectValues } from "./policy";
import { formatQuotationResult } from "./quotation-result";
import { parseAssistantResultTable } from "../../src/shared/assistant-result-table";
import routeCoverage from "./quotation-route-coverage.json";

const branchId = "507f1f77bcf86cd799439012", id = "507f1f77bcf86cd799439021", templateId = "507f1f77bcf86cd799439022";
const req = { user: { id: "actor", companyCode: "TEST", branchId, role: "admin" }, headers: { authorization: "Bearer scoped" }, socket: { localPort: 4050, localAddress: "127.0.0.1" } } as any;
const op = (id: string) => operationById(`quotation.${id}`)!;
const workflows = ASSISTANT_OPERATIONS.map(defaultWorkflow);
const product = { _id: id, sku: "ML01", name: "Máy lọc", unit: "cái", price: 250000, currency: "VND", active: true, description: "", attributes: { Màu: "Trắng" }, effectiveFrom: "2026-01-01", updatedAt: "2026-11-11T01:00:00.000Z" };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
beforeEach(() => provider.mockReset());
afterEach(() => vi.unstubAllGlobals());

describe("quotation assistant routing and contracts", () => {
  it.each([
    ["Lập báo giá khách hàng cho An", "customer-quote.create"], ["tao du toan tu bao gia BG-2026-001", "estimate.from-customer"],
    ["Lập dự toán từ yêu cầu đã phân tích", "estimate.create"], ["Tạo yêu cầu lập dự toán", "request.create"], ["Phân tích yêu cầu dự toán", "request.analyze"],
    ["Duyệt báo giá BG-01", "quote.approve"], ["Gửi duyệt dự toán BG-02", "quote.submit-review"], ["Trả lại báo giá BG-03", "quote.reject"],
    ["Xem danh sách báo giá", "quote.list"], ["Xem chi tiết dự toán BG-03", "quote.detail"], ["Tính lại dự toán BG-03", "quote.recalculate"],
    ["Thêm sản phẩm vào bảng giá Báo giá", "catalog.create"], ["Nhập Excel vào bảng giá", "catalog.import"], ["Tăng giá hàng loạt trong bảng giá", "catalog.bulk"],
    ["Tạo phương án dự toán ngân sách 100 triệu", "budget.create"], ["Tạo hợp đồng từ dự toán BG-03", "contract.create"],
    ["Xác nhận đã ký hợp đồng trong Báo giá", "contract.sign"], ["Lập biên bản nghiệm thu", "acceptance.create"], ["Hoàn tất nghiệm thu", "acceptance.complete"],
    ["Xuất file quyết toán nghiệm thu", "acceptance.settlement"], ["Xuất báo giá theo mẫu", "quote.export"], ["Xuất PDF báo giá", "quote.pdf"],
    ["Xem mẫu dự toán", "template.list"], ["Xem tiến độ file báo giá", "export.latest"],
    ["Xem danh sách file báo giá", "file.list"], ["Tải file báo giá BG-01", "file.download"],
  ])("routes the business request without repair/POS confusion: %s", async (text, action) => {
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: null, values: {} }) });
    expect(await interpretRequest(text, workflows, null, [])).toMatchObject({ actionId: `quotation.${action}`, intentType: "workflow" });
    expect(provider).toHaveBeenCalledTimes(1);
  });
  it("does not intercept repair quotations or expand an unauthorized approval request", async () => {
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: "api.post.1ee164077121787a", values: { path_id: "SC01" } }) });
    expect((await interpretRequest("Duyệt báo giá sửa chữa SC01", [defaultWorkflow(operationById("api.post.1ee164077121787a")!)], null, [])).actionId).toBe("api.post.1ee164077121787a");
    provider.mockClear();
    expect((await interpretRequest("Duyệt báo giá BG01", [defaultWorkflow(op("quote.list"))], null, [])).actionId).toBeNull();
    expect(provider).not.toHaveBeenCalled();
  });
  it("keeps a same-workflow collecting turn and requires confirmation on all mutations and exports", async () => {
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: null, values: { customerEmail: "an@example.com" }, newRequest: false }) });
    const reply = await interpretRequest("Bổ sung báo giá email an@example.com", workflows, { actionId: "quotation.quote.update" }, []);
    expect(reply).toMatchObject({ actionId: "quotation.quote.update", newRequest: false });

    const manualModeReply = await interpretRequest("Tự chọn sản phẩm từ bảng giá", workflows, { actionId: "quotation.customer-quote.create" }, []);
    expect(manualModeReply).toMatchObject({ actionId: "quotation.customer-quote.create", newRequest: false });
    expect(provider).toHaveBeenCalledTimes(1);

    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: null, values: {}, newRequest: false }) });
    const requirementFollowUp = await interpretRequest(
      'khách tên Hiệp yêu cầu là "lặp đặt camera cho căn nhà 2 tầng 40m"',
      workflows,
      { actionId: "quotation.customer-quote.create" },
      [],
    );
    expect(requirementFollowUp).toMatchObject({ actionId: "quotation.customer-quote.create", newRequest: false });
    expect(provider).toHaveBeenCalledTimes(2);
    const all = ASSISTANT_OPERATIONS.filter(item => item.module === "quotation");
    expect(all.length).toBeGreaterThan(50);
    expect(new Set(all.map(item => item.id)).size).toBe(all.length);
    for (const item of all) {
      expect(item.permissionGroups).toContainEqual(["quotation:read", "quotation:manage"]);
      if (!item.readOnly) expect(defaultWorkflow(item).requireConfirmation).toBe(true);
      for (const f of item.fields) if (f.reference) expect(operationById(f.reference)).toBeDefined();
      expect(new Set(item.fields.map(field => field.key)).size).toBe(item.fields.length);
      expect(new Set(item.resultFields).size).toBe(item.resultFields.length);
      expect(routeCoverage.some(route => route.method === item.method && route.path === item.path && "operationId" in route)).toBe(true);
    }
    expect(op("quote.approve").permissionGroups).toContainEqual(["quotation-approval:manage"]);
  });
});

describe("quotation assistant execution, completion and output", () => {
  it("pins the catalog version, keeps other fields during update and uses a stable idempotency key", async () => {
    const fetcher = vi.fn(async (_url: URL, init?: RequestInit) => json(init?.method === "PATCH" ? { item: { ...product, ...JSON.parse(String(init.body)) } } : { items: [product] }));
    vi.stubGlobal("fetch", fetcher);
    const resolved = await resolveReferences(req, op("catalog.update"), { targetBranch: branchId, path_id: "ML01", description: "Mô tả mới" });
    expect(resolved.errors).toEqual([]);
    expect(resolved.labels.path_id).toContain("ML01");
    await callOperation(req, op("catalog.update"), resolved.values, undefined, "turn-01");
    const [, init] = fetcher.mock.calls.find(([, init]) => init?.method === "PATCH")!;
    expect(JSON.parse(String(init?.body))).toMatchObject({ sku: "ML01", price: 250000, description: "Mô tả mới", attributes: { Màu: "Trắng" }, effectiveFrom: "2026-01-01" });
    expect(init?.headers).toMatchObject({ "x-branch-id": branchId, "If-Unmodified-Since": product.updatedAt, Authorization: "Bearer scoped" });
    await callOperation(req, op("catalog.update"), resolved.values, undefined, "turn-01");
    const writes = fetcher.mock.calls.filter(([, init]) => init?.method === "PATCH");
    expect((writes[0][1]?.headers as any)["Idempotency-Key"]).toBe((writes[1][1]?.headers as any)["Idempotency-Key"]);
  });
  it("rejects a changed record after confirmation, duplicate names, and cross-branch operations", async () => {
    let current = product;
    const fetcher = vi.fn(async () => json({ items: [current] })); vi.stubGlobal("fetch", fetcher);
    const before = await resolveReferences(req, op("catalog.update"), { targetBranch: branchId, path_id: "ML01", price: 300000 });
    current = { ...product, price: 290000, updatedAt: "2026-11-11T02:00:00.000Z" };
    await expect(resolveReferences(req, op("catalog.update"), before.values)).rejects.toThrow("đã thay đổi");
    fetcher.mockImplementation(async () => json({ items: [product, { ...product, _id: templateId, sku: "ML02" }] }));
    expect((await resolveReferences(req, op("catalog.update"), { targetBranch: branchId, path_id: "Máy lọc", price: 300000 })).errors.join(" ")).toContain("nhiều kết quả");
    fetcher.mockClear();
    await expect(callOperation({ ...req, user: { ...req.user, role: "staff" } }, op("catalog.create"), { targetBranch: templateId, sku: "A", name: "A", unit: "cái", price: 1 })).rejects.toThrow("chi nhánh đã được gán");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("resolves products and templates by public names and does not send raw identifiers to previews", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: URL) => json(String(url).includes("quote-templates") ? { templates: [{ id: templateId, name: "Mẫu chuẩn", category: "quote", createdAt: "2026-11-01T00:00:00.000Z" }] } : { items: [product] })));
    const resolved = await resolveReferences(req, op("customer-quote.create"), { targetBranch: branchId, templateId: "Mẫu chuẩn", customerName: "An", items: JSON.stringify([{ catalogItemId: "ML01" }]) });
    expect(resolved.errors).toEqual([]);
    expect(resolved.labels.items).toBe("ML01 — Máy lọc");
    expect(resolved.labels.items).not.toContain(id);
    expect(collectValues(defaultWorkflow(op("customer-quote.create")), Object.fromEntries(Object.entries(resolved.values).filter(([key]) => !key.startsWith("__assistant")))).errors).toEqual([]);
  });
  it("supports creating a customer quote via AI product suggestion from sourceRequirements or selecting products directly", async () => {
    const workflow = defaultWorkflow(op("customer-quote.create"));
    const missingBoth = collectValues(workflow, { targetBranch: branchId, customerName: "An", templateId: "Mẫu chuẩn" });
    expect(missingBoth.missing).toEqual(["Sản phẩm khách hàng cần báo giá (chọn sản phẩm từ bảng giá hoặc nhập Yêu cầu khách hàng để AI gợi ý)"]);
    const withPrompt = collectValues(workflow, { targetBranch: branchId, customerName: "An", templateId: "Mẫu chuẩn", sourceRequirements: "Cần máy lọc nước cho gia đình 4 người" });
    expect(withPrompt.missing).toEqual([]);
    expect(withPrompt.errors).toEqual([]);
    const fetcher = vi.fn(async (url: URL, init?: RequestInit) => {
      const path = String(url);
      if (path.includes("quote-templates")) return json({ templates: [{ id: templateId, name: "Mẫu chuẩn", category: "quote", createdAt: "2026-11-01T00:00:00.000Z" }] });
      if (path.endsWith("/customer-quotes/suggest")) return json({ items: [{ catalogItemId: id, quantity: 1, unit: "cái" }], missingProducts: ["Bình áp rời"] });
      if (path.endsWith("/customer-quotes") && init?.method === "POST") return json({ quote: { _id: id, quoteNumber: "BG-AI-01", kind: "customer", status: "draft" } });
      return json({ items: [product] });
    });
    vi.stubGlobal("fetch", fetcher);
    const resolved = await resolveReferences(req, op("customer-quote.create"), withPrompt.values);
    expect(resolved.errors).toEqual([]);
    expect(resolved.confirmationDetails.sourceRequirements).toEqual([
      { label: "Sản phẩm AI gợi ý", value: "ML01 — Máy lọc" },
      { label: "Chưa có trong bảng giá", value: "Bình áp rời" },
    ]);
    const rechecked = await resolveReferences(req, op("customer-quote.create"), resolved.values);
    expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith("/customer-quotes/suggest"))).toHaveLength(1);
    await callOperation(req, op("customer-quote.create"), rechecked.values);
    const createCall = fetcher.mock.calls.find(([url, init]) => String(url).endsWith("/customer-quotes") && init?.method === "POST")!;
    expect(JSON.parse(String(createCall[1]?.body))).toMatchObject({
      customerName: "An",
      templateId,
      sourceRequirements: "Cần máy lọc nước cho gia đình 4 người",
      items: [{ catalogItemId: id, unit: "cái", quantity: 1, catalogUpdatedAt: product.updatedAt }],
      missingProducts: ["Bình áp rời"],
    });
  });
  it("runs common completion, preserves the created record and branch, and formats only public fields", async () => {
    const create = op("customer-quote.create");
    const record = { _id: id, quoteNumber: "BG-01", customerName: "2026-11-11", status: "draft", createdAt: "2026-11-11T01:00:00.000Z", companyId: "SECRET", credentials: "SECRET" };
    const completion: any = { operation: create, workflow: defaultWorkflow(create), values: { targetBranch: branchId, customerName: "2026-11-11", templateId }, result: record };
    const result = await completeAssistantOperation({ status: "completed", reply: formatQuotationResult(create, record) }, completion, ASSISTANT_OPERATIONS, async () => true);
    expect(result.reply).toContain("Bạn có muốn bổ sung không?");
    expect(completion.followUp).toEqual({ actionId: "quotation.quote.update", values: { path_id: id, targetBranch: branchId } });
    const table = parseAssistantResultTable(result.reply)!;
    expect(table.rows[0].values).toMatchObject({ "Khách hàng": "2026-11-11", "Thời gian tạo": expect.stringContaining("11/11/2026") });
    expect(result.reply).not.toMatch(/SECRET|507f|workflow|credentials/);
    const noPermission = await completeAssistantOperation({ status: "completed", reply: "Đã tạo" }, completion, ASSISTANT_OPERATIONS, async () => false);
    expect(noPermission.reply).not.toContain("bổ sung");
  });
  it("checks imports before writing and reports uncertain network outcomes without replay", async () => {
    const fetcher = vi.fn(async (_url: URL, _init?: RequestInit) => json({ rows: [], invalidCount: 1, errors: ["Thiếu đơn giá"] })); vi.stubGlobal("fetch", fetcher);
    await expect(callOperation(req, op("catalog.import"), { targetBranch: branchId, rows: "[]" })).rejects.toThrow();
    expect(fetcher.mock.calls.some(([url]) => String(url).includes("/confirm"))).toBe(false);
    fetcher.mockRejectedValue(new Error("lost response"));
    await expect(callOperation(req, op("catalog.create"), { targetBranch: branchId, sku: "A", name: "A", unit: "cái", price: 1 })).rejects.toBeInstanceOf(UncertainExecutionError);
  });
  it("looks up customer quotes as well as estimates and renders queued exports truthfully", async () => {
    const fetcher = vi.fn(async (url: URL) => json({ quotes: [{ _id: id, quoteNumber: String(url).includes("customer") ? "BG-KH" : "BG-DT", kind: String(url).includes("customer") ? "customer" : "estimate" }] })); vi.stubGlobal("fetch", fetcher);
    expect(await lookupRecords(req, "quotation.quote.list")).toHaveLength(2);
    const result = formatQuotationResult(op("quote.export"), { id, status: "queued", filename: "bao-gia.xlsx", error: null });
    expect(parseAssistantResultTable(result)?.rows[0].values["Trạng thái"]).toBe("Đang chờ xử lý");
    expect(result).toContain("đang được xử lý"); expect(result).not.toContain(id);
  });
  it("keeps untouched quote lines when only one quantity is changed", async () => {
    const other = "507f1f77bcf86cd799439099";
    const quote = { _id: templateId, quoteNumber: "BG-01", kind: "estimate", updatedAt: product.updatedAt, lines: [{ catalogItemId: id, quantity: 2, unit: "cái" }, { catalogItemId: other, quantity: 7, unit: "bộ" }] };
    const fetcher = vi.fn(async (url: URL, init?: RequestInit) => json(init?.method === "PATCH" ? { quote } : String(url).includes("catalog") ? { items: [product] } : String(url).endsWith(templateId) ? { quote } : { quotes: String(url).includes("kind=customer") ? [] : [quote] })); vi.stubGlobal("fetch", fetcher);
    const resolved = await resolveReferences(req, op("quote.update"), { targetBranch: branchId, path_id: "BG-01", items: JSON.stringify([{ catalogItemId: "ML01", quantity: 3 }]) });
    expect(resolved.errors).toEqual([]);
    const checked = await resolveReferences(req, op("quote.update"), resolved.values);
    await callOperation(req, op("quote.update"), checked.values);
    const body = JSON.parse(String(fetcher.mock.calls.find(([, init]) => init?.method === "PATCH")![1]?.body));
    expect(body.items).toMatchObject([{ catalogItemId: id, quantity: 3 }, { catalogItemId: other, quantity: 7, unit: "bộ" }]);
  });
  it("previews bulk price changes before applying the exact selection", async () => {
    const fetcher = vi.fn(async (url: URL, _init?: RequestInit) => json(String(url).includes("/bulk/preview") ? { previewHash: "pinned", rows: [{ ...product, before: { price: 250000 }, after: { price: 275000 } }] } : String(url).endsWith("/bulk") ? { items: [product] } : { items: [product] })); vi.stubGlobal("fetch", fetcher);
    const resolved = await resolveReferences(req, op("catalog.bulk"), { targetBranch: branchId, action: "price", selection: JSON.stringify(["ML01"]), adjustment: JSON.stringify({ mode: "percent", value: 10 }) });
    expect(resolved.errors).toEqual([]); expect(resolved.confirmationDetails.selection[0].value).toContain("275.000");
    await callOperation(req, op("catalog.bulk"), resolved.values);
    const body = JSON.parse(String(fetcher.mock.calls.find(([url]) => String(url).endsWith("/bulk"))![1]?.body));
    expect(body).toMatchObject({ previewHash: "pinned", selection: [{ id, updatedAt: product.updatedAt }], adjustment: { mode: "percent", value: 10 } });
    expect(hasAssistantUpdatePayload(op("budget.recalculate"), { path_id: id })).toBe(true);
  });
  it("surfaces backend denials and leaves protected downloads scoped to this listener", async () => {
    const fetcher = vi.fn(async (_url: URL, _init?: RequestInit) => json({ error: "Bạn không có quyền duyệt." }, 403)); vi.stubGlobal("fetch", fetcher);
    await expect(callOperation(req, op("catalog.create"), { targetBranch: branchId, sku: "A", name: "A", unit: "cái", price: 1 })).rejects.toThrow("không có quyền");
    fetcher.mockImplementation(async () => new Response(new Uint8Array([1, 2, 3]), { headers: { "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="bao-gia.pdf"' } }));
    const file = await callOperation(req, op("file.download"), { targetBranch: branchId, path_id: id });
    expect(file.__assistantQuotationFile).toMatchObject({ fileName: "bao-gia.pdf", format: "pdf" });
    expect(file.__assistantQuotationFile.bytes).toEqual(Buffer.from([1, 2, 3]));
    expect(String(fetcher.mock.calls.at(-1)![0])).toBe(`http://127.0.0.1:4050/api/v1/quotation/files/${id}/download`);
  });
  it("does not silently discard a requested quantity when creating a customer product list", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url: URL) => json({ items: [product] })));
    const resolved = await resolveReferences(req, op("customer-quote.create"), { targetBranch: branchId, customerName: "An", items: JSON.stringify([{ catalogItemId: "ML01", quantity: 10 }]) });
    expect(resolved.errors.join(" ")).toContain("lập dự toán từ báo giá");
  });
  it("downloads the completed customer quotation artifact and queues an explicit Excel draft correctly", async () => {
    const quote = { _id: id, quoteNumber: "BG-01", kind: "customer", updatedAt: product.updatedAt, template: { id: templateId } };
    const fetcher = vi.fn(async (url: URL, _init?: RequestInit) => String(url).endsWith("/download")
      ? new Response(new Uint8Array([1, 2]), { headers: { "Content-Type": "application/pdf" } })
      : json(String(url).includes("generated-export-files") ? { file: { id: templateId }, job: { status: "completed" } } : String(url).includes("/export?") ? { status: "queued" } : { quote }));
    vi.stubGlobal("fetch", fetcher);
    const resolved = await resolveReferences(req, op("quote.export"), { targetBranch: branchId, path_id: id });
    const completed = await callOperation(req, op("quote.export"), resolved.values);
    expect(completed.__assistantQuotationFile.format).toBe("pdf");
    expect(fetcher.mock.calls.some(([url]) => String(url).includes(`/quotes/${id}/export`))).toBe(false);
    const estimate = { ...quote, kind: "estimate" };
    await callOperation(req, op("quote.export"), { targetBranch: branchId, path_id: id, draft: true, excel: true, __assistantQuotationRecord: JSON.stringify(estimate), __assistantQuotationSnapshot: "private" });
    const request = new URL(String(fetcher.mock.calls.at(-1)![0]));
    expect(Object.fromEntries(request.searchParams)).toMatchObject({ draft: "1", excel: "1", templateId: "none", background: "1" });
  });
  it("follows only scoped document redirects and returns the actual PDF format", async () => {
    const fetcher = vi.fn(async (url: URL, _init?: RequestInit) => String(url).endsWith("/pdf")
      ? new Response(null, { status: 307, headers: { location: `/files/${templateId}/download` } })
      : new Response(new Uint8Array([1]), { headers: { "Content-Type": "application/pdf" } }));
    vi.stubGlobal("fetch", fetcher);
    const values = { targetBranch: branchId, path_id: id, __assistantQuotationRecord: JSON.stringify({ kind: "customer" }), __assistantQuotationSnapshot: "private" };
    expect((await callOperation(req, op("quote.pdf"), values)).__assistantQuotationFile.format).toBe("pdf");
    expect(String(fetcher.mock.calls.at(-1)![0])).toBe(`http://127.0.0.1:4050/api/v1/quotation/files/${templateId}/download`);
    fetcher.mockClear().mockImplementation(async () => new Response(null, { status: 307, headers: { location: "https://outside.example/download" } }));
    await expect(callOperation(req, op("quote.pdf"), values)).rejects.toThrow("không hợp lệ");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
