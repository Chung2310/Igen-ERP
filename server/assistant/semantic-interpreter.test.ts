import { afterEach, describe, expect, it, vi } from "vitest";
const mockState = vi.hoisted(() => ({ provider: vi.fn(), inferIntentType: true, autoCoverage: true }));
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
      try { requestText = JSON.parse(requestText).text ?? requestText; } catch { /* last user message is already the request */ }
      if (typeof requestText === "string") parsed.requestCoverage = [{ evidence: requestText, requirement: "Yêu cầu thao tác", mappedTo: ["action"] }];
    }
    return { ...response, text: JSON.stringify(parsed) };
  } catch { return response; }
} }));
import { inferRelevantFunctionKeys, interpretRequest, validateRemainingRequests } from "./semantic-interpreter";
import { ASSISTANT_OPERATIONS, defaultWorkflow, operationById } from "./catalog";
import { assistantFunctionContextCatalog, assistantFunctionKey } from "./function-context";
import { quotationIntent } from "./quotation-intent";
import { validateRequestCoverage } from "./request-coverage";
afterEach(() => { provider.mockReset(); mockState.inferIntentType = true; mockState.autoCoverage = true; });
const employee = defaultWorkflow(operationById("employee.update")!);
describe("estimate versus budget routing", () => {
  const workflows = ["quotation.budget.create", "quotation.request.create", "quotation.estimate.create", "quotation.estimate.from-customer"].map(id => defaultWorkflow(operationById(id)!));
  it("keeps an order-value ranking when clarification says to ignore debt limits", async () => {
    const workflow = defaultWorkflow(operationById("retail.order.top-value")!);
    const result = await interpretRequest(
      "Không giới hạn công nợ. Tìm đơn có tổng tiền lớn nhất trong toàn bộ đơn bán tháng trước, kèm mã đơn và tên khách.",
      [workflow], null, [{ role: "user", content: "Đơn hàng giá trị lớn nhất trong tháng vừa rồi là đơn nào, của khách nào?" }, { role: "assistant", content: "Bạn muốn giới hạn đơn còn công nợ không?" }],
      "", [], "", [], false, true,
    );
    expect(result.actionId).toBe("retail.order.top-value");
  });
  it("routes a two-result cancellation and cash variance clarification", async () => {
    const workflow = defaultWorkflow(operationById("retail.report.employee-cancelled-cash-variance")!);
    const result = await interpretRequest(
      "Trả hai kết quả riêng trong tháng này: nhân viên hủy nhiều đơn nhất và thu ngân/ca có tổng tiền lệch lớn nhất.",
      [workflow], null, [{ role: "user", content: "Nhân viên nào có nhiều đơn bị hủy hoặc lệch tiền két nhất trong tháng này?" }, { role: "assistant", content: "Bạn muốn xếp theo số đơn hủy và tổng tiền chênh lệch không?" }],
      "", [], "", [], false, true,
    );
    expect(result.actionId).toBe("retail.report.employee-cancelled-cash-variance");
  });
  it("asks a targeted date-window question for recent return analysis", async () => {
    const workflow = defaultWorkflow(operationById("retail.after-sale.return-product-analysis")!);
    const result = await interpretRequest("Mặt hàng nào bị khách trả lại nhiều nhất gần đây? Khách thường chê hay báo lỗi gì?", [workflow], null, []);
    expect(result).toMatchObject({ actionId: null, intentType: "ambiguous" });
    expect(result.clarification).toContain("7 ngày gần đây, 30 ngày gần đây");
  });
  it("routes a question about the largest and oldest customer debt", async () => {
    const workflow = defaultWorkflow(operationById("retail.order.debt-ranking")!);
    const result = await interpretRequest("Ai đang nợ cửa hàng nhiều tiền nhất hoặc nợ lâu nhất chưa thanh toán?", [workflow], null, []);
    expect(result.actionId).toBe("retail.order.debt-ranking");
  });
  it.each([
    ["retail.customer.purchase-warranty-summary", "Khách Lê Anh Tú (098874464) đã mua những đơn nào ở shop rồi?", "Anh ấy có đang nợ tiền không và mấy món đã mua còn bảo hành không?"],
    ["retail.report.top-products-return-status", "Tuần này 3 mặt hàng nào bán chạy nhất?", "Trong 3 món đó món nào lãi cao nhất và có món nào bị khách trả lại không?"],
  ])("uses the previous retail result for a contextual follow-up: %s", async (actionId, original, followup) => {
    const workflow = defaultWorkflow(operationById(actionId)!);
    const workflows = actionId === "retail.report.top-products-return-status"
      ? [workflow, defaultWorkflow(operationById("retail.after-sale.return-product-analysis")!)]
      : [workflow];
    const result = await interpretRequest(followup, workflows, null, [
      { role: "user", content: original },
      { role: "assistant", content: "Mình đã tra cứu xong." },
    ]);
    expect(result.actionId).toBe(actionId);
    expect(result.intentType).toBe("workflow");
  });
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
    expect(result.actionId).toBe(actionId);
    expect(result.values).not.toHaveProperty("budget");
    expect(result.remainingRequests).toEqual([]);
    if (actionId === "quotation.request.create") {
      expect(result.values.requestText).toBe(text);
      expect(result.values.customerName).toBe("An");
    }
  });
  it("keeps a budget constraint on the pending estimate even if AI calls it a new request", async () => {
    provider.mockResolvedValue({ text: JSON.stringify({ actionId: "quotation.budget.create", values: {}, newRequest: true }) });
    const result = await interpretRequest("Ngân sách 100 triệu nhé", workflows, { actionId: "quotation.request.create", values: { requestText: "Lắp 10 camera" } }, []);
    expect(result).toMatchObject({ actionId: "quotation.request.create", newRequest: false, values: { requestText: "Lắp 10 camera\nNgân sách 100 triệu nhé" } });
  });
  it.each(["Tạo phương án dự toán ngân sách 100 triệu", "Lập ngân sách 100 triệu", "Đề xuất phương án ngân sách cho dự toán"])("preserves an explicit budget request: %s", async text => {
    provider.mockResolvedValue({ text: JSON.stringify({ actionId: "quotation.budget.create", values: {} }) });
    expect((await interpretRequest(text, workflows, { actionId: "quotation.request.create" }, [])).actionId).toBe("quotation.budget.create");
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
  it("uses a small lexical function shortlist before action selection", async () => {
    const workflows = ASSISTANT_OPERATIONS.map(defaultWorkflow);
    const text = "Tình hình chấm công hôm nay";
    expect(inferRelevantFunctionKeys(text, workflows)).toHaveLength(3);
    provider.mockResolvedValue({ text: JSON.stringify({
      intentType: "ambiguous", actionId: null, values: {}, actionIntent: "unknown", requestCoverage: [],
    }) });

    const result = await interpretRequest(text, workflows, null, []);

    expect(result).toMatchObject({ actionId: null, intentType: "ambiguous" });
    expect(provider).toHaveBeenCalledTimes(1);
    const schema = provider.mock.calls[0][0].responseSchema;
    expect(schema.properties.actionId.enum.length).toBeLessThanOrEqual(121);
  });

  it("does not send an oversized action catalog after function discovery fails", async () => {
    const workflows = ASSISTANT_OPERATIONS.slice(0, 121).map(defaultWorkflow);
    provider.mockImplementation(async (params: any) => {
      const schema = params.responseSchema;
      if (schema?.properties?.modules) return { text: JSON.stringify({ modules: schema.properties.modules.items.enum }) };
      if (schema?.properties?.featureKeys) throw new Error("function discovery unavailable");
      throw new Error("final action planner must not receive an oversized catalog");
    });

    const result = await interpretRequest("banana xyz", workflows, null, []);

    expect(result).toMatchObject({ actionId: null, intentType: "ambiguous" });
    expect(provider).toHaveBeenCalledTimes(2);
  });

  it("routes an explicit retail revenue comparison to two fully specified periods", async () => {
    const workflow = defaultWorkflow(operationById("retail.report.compare")!);
    const text = "So sánh doanh thu và lợi nhuận gộp tháng 11 này với tháng 10 vừa rồi";
    const year = new Intl.DateTimeFormat("en", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric" }).format(new Date());

    const result = await interpretRequest(text, [workflow], null, []);

    expect(result).toMatchObject({
      actionId: "retail.report.compare",
      intentType: "workflow",
      actionIntent: "report",
      values: {
        currentFrom: `${year}-11-01`,
        currentTo: `${year}-11-30`,
        previousFrom: `${year}-10-01`,
        previousTo: `${year}-10-31`,
      },
    });
    expect(validateRequestCoverage(text, result.requestCoverage, workflow, operationById(workflow.actionId)!, result.values)).toEqual({ ok: true });
    expect(provider).not.toHaveBeenCalled();
  });

  it("routes this-week revenue growth requests to the weekly comparison periods", async () => {
    const workflow = defaultWorkflow(operationById("retail.report.compare")!);
    const text = "Doanh thu tuần này tăng hay giảm bao nhiêu phần trăm so với tuần trước?";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-26T05:00:00.000Z"));
    try {
      const result = await interpretRequest(text, [workflow], null, []);

      expect(result).toMatchObject({ actionId: workflow.actionId, intentType: "workflow", actionIntent: "report", values: {
        currentFrom: "2026-11-23", currentTo: "2026-11-29", previousFrom: "2026-11-16", previousTo: "2026-11-22",
      } });
      expect(validateRequestCoverage(text, result.requestCoverage, workflow, operationById(workflow.actionId)!, result.values)).toEqual({ ok: true });
      expect(provider).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps a 31-day product-profit report within the exact requested window", async () => {
    const workflow = defaultWorkflow(operationById("retail.report.summary")!);
    const text = "Những mặt hàng nào mang lại nhiều tiền lãi nhất cho cửa hàng trong 31 ngày qua?";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-26T05:00:00.000Z"));
    try {
      const result = await interpretRequest(text, [workflow], null, []);

      expect(result).toMatchObject({ actionId: workflow.actionId, intentType: "workflow", actionIntent: "report", values: {
        from: "2026-10-27", to: "2026-11-26",
      } });
      expect(validateRequestCoverage(text, result.requestCoverage, workflow, operationById(workflow.actionId)!, result.values)).toEqual({ ok: true });
      expect(provider).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("routes net profit after expenses to the retail profit report", async () => {
    const operation = ASSISTANT_OPERATIONS.find(candidate => candidate.path === "/retail/finance/profit")!;
    const workflow = defaultWorkflow(operation);
    const text = "Tháng này trừ tiền vốn hàng và chi phí đi thì cửa hàng còn lãi thực bao nhiêu?";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-26T05:00:00.000Z"));
    try {
      const result = await interpretRequest(text, [workflow], null, []);

      expect(result).toMatchObject({ actionId: workflow.actionId, intentType: "workflow", actionIntent: "report", values: {
        from: "2026-11-01", to: "2026-11-30",
      } });
      expect(validateRequestCoverage(text, result.requestCoverage, workflow, operation, result.values)).toEqual({ ok: true });
      expect(provider).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("maps picked-up orders with unpaid balances to completed orders due more than zero", async () => {
    const workflow = defaultWorkflow(operationById("retail.order.completed-unpaid.report")!);
    const text = "Có đơn hàng nào khách đã lấy hàng rồi nhưng chưa thanh toán đủ tiền không?";
    const result = await interpretRequest(text, [workflow], null, []);

    expect(result.actionId).toBe("retail.order.completed-unpaid.report");
    expect(result.values.query_status).toBe("completed");
    expect(JSON.parse(String(result.values.analysis))).toEqual({ filters: [{ field: "dueAmount", operator: "gt", value: 0 }] });
    expect(validateRequestCoverage(text, result.requestCoverage, workflow, operationById(workflow.actionId)!, result.values)).toEqual({ ok: true });
    expect(provider).not.toHaveBeenCalled();
  });

  it("routes an explicit warehouse transfer slip to the transfer action and preserves supplied details", async () => {
    const workflow = defaultWorkflow(operationById("inventory.transfer.create")!);
    const text = "Tạo giúp tôi phiếu điều chuyển 2 máy Samsung Galaxy Ultra từ kho Trụ sở chính sang kho KHO2A";
    const result = await interpretRequest(text, [workflow], null, []);

    expect(result).toMatchObject({
      actionId: "inventory.transfer.create",
      intentType: "workflow",
      actionIntent: "create",
      values: {
        fromWarehouseId: "Trụ sở chính",
        toWarehouseId: "KHO2A",
      },
    });
    expect(JSON.parse(String(result.values.items))).toEqual([
      { productId: "Samsung Galaxy Ultra", quantity: 2 },
    ]);
    expect(validateRequestCoverage(text, result.requestCoverage, workflow, operationById(workflow.actionId)!, result.values)).toEqual({ ok: true });
    expect(provider).not.toHaveBeenCalled();
  });

  it.each([
    ["worker.labor.contract.list", "Những hợp đồng lao động nào sắp hết hạn trong vòng 30 ngày tới"],
    ["batch.list", "Cho tôi danh sách các lớp của giảng viên Nguyễn Lan"],
    ["batch.capacity.report", "Nhóm nào đã gom đủ sĩ số tối đa"],
    ["batch.capacity.report", "Học viên Nguyễn Sinh Sôi đăng kí khóa học HSK2 cần xếp lớp, tìm kiếm các lớp còn trống"],
    ["student.learning-roadmap.waitlist.count", "Hiện có bao nhiêu học viên đang nằm trong danh sách Chờ lớp"],
    ["inventory.receipt.list", "Cho xem các phiếu nhập kho tháng này"],
    ["retail.order.list", "Tìm các đơn bán lẻ trong tháng này"],
    ["retail.order.list", "Trong phân hệ bán lẻ, tìm đơn hàng đã giao nhưng chưa thanh toán hết"],
  ])("keeps a matching read function when discovery selects a different group: %s", async (actionId, text) => {
    const targetOperation = operationById(actionId)!;
    const workflows = ASSISTANT_OPERATIONS.filter(operation => operation.module === targetOperation.module).map(defaultWorkflow);
    const targetWorkflow = workflows.find(workflow => workflow.actionId === actionId)!;
    const targetKey = assistantFunctionKey(targetWorkflow);
    const decoy = assistantFunctionContextCatalog(workflows).find(feature => feature.key !== targetKey);
    expect(decoy).toBeDefined();

    provider.mockImplementation((request: any) => {
      const systemPrompt = request.messages.find((message: any) => message.role === "system")?.content || "";
      if (systemPrompt.includes("BƯỚC 2")) {
        return { text: JSON.stringify({ featureKeys: [decoy!.key], ambiguous: false, clarification: "" }) };
      }
      return { text: JSON.stringify({ actionId, values: {} }) };
    });

    const result = await interpretRequest(text, workflows, null, []);

    expect(result.actionId).toBe(actionId);
    const finalPrompt = provider.mock.calls.at(-1)![0].messages.map((message: any) => message.content).join("\n");
    expect(finalPrompt).toContain(actionId);
  });

  it("builds a valid available-class filter for a class-slot lookup", async () => {
    const workflow = defaultWorkflow(operationById("batch.capacity.report")!);
    const text = "Lớp nào thuộc khóa tiếng anh giao tiếp còn slot?";
    provider.mockImplementation((request: any) => {
      const systemPrompt = request.messages.find((message: any) => message.role === "system")?.content || "";
      if (systemPrompt.includes("BƯỚC 2")) return { text: JSON.stringify({ featureKeys: [assistantFunctionKey(workflow)], ambiguous: false, clarification: "" }) };
      return { text: JSON.stringify({ actionId: workflow.actionId, values: { analysis: JSON.stringify({ filters: [{ field: "wrongField", operator: "contains", value: "available" }] }) } }) };
    });

    const result = await interpretRequest(text, [workflow], null, []);

    expect(result.actionId).toBe("batch.capacity.report");
    expect(result.values.search).toBe("tiếng anh giao tiếp");
    expect(JSON.parse(String(result.values.analysis))).toEqual({ filters: [{ field: "capacityStatus", operator: "eq", value: "available" }] });
  });

  it("builds a valid full-capacity filter for a class-capacity lookup", async () => {
    const workflow = defaultWorkflow(operationById("batch.capacity.report")!);
    const text = "Nhóm nào đã gom đủ sĩ số tối đa";
    provider.mockResolvedValue({ text: JSON.stringify({ actionId: workflow.actionId, values: { analysis: JSON.stringify({ filters: [{ field: "wrongField", operator: "contains", value: "full" }] }) } }) });

    const result = await interpretRequest(text, [workflow], null, []);

    expect(result.actionId).toBe("batch.capacity.report");
    expect(JSON.parse(String(result.values.analysis))).toEqual({ filters: [{ field: "capacityStatus", operator: "eq", value: "full" }] });
  });

  it("counts student partners by the public commission-level field", async () => {
    const workflow = defaultWorkflow(operationById("partner.analysis")!);
    const analysisField = workflow.fields.find(field => field.key === "analysis")!;
    provider.mockImplementation((request: any) => {
      const systemPrompt = request.messages.find((message: any) => message.role === "system")?.content || "";
      if (systemPrompt.includes("BƯỚC 2")) return { text: JSON.stringify({ featureKeys: [assistantFunctionKey(workflow)], ambiguous: false, clarification: "" }) };
      return { text: JSON.stringify({ actionId: workflow.actionId, values: { [analysisField.key]: JSON.stringify({ groupBy: "commissionLevel" }) } }) };
    });
    const text = "Thống kê số lượng đối tác tuyển sinh theo từng cấp bậc hoa hồng";

    const result = await interpretRequest(text, [workflow], null, []);

    expect(result.actionId).toBe("partner.analysis");
    expect(JSON.parse(String(result.values[analysisField.key]))).toEqual({ groupBy: "levelName", aggregate: { operation: "count" } });
  });

  it("lists labor-partner KPI statuses without inventing a grouped aggregate", async () => {
    const operation = ASSISTANT_OPERATIONS.find(candidate => candidate.method === "GET" && candidate.path === "/worker-management/partners/kpi")!;
    const workflow = defaultWorkflow(operation);
    const analysisField = workflow.fields.find(field => field.key === "analysis")!;
    const periodField = workflow.fields.find(field => field.apiKey === "periodAnchor")!;
    provider.mockImplementation((request: any) => {
      const systemPrompt = request.messages.find((message: any) => message.role === "system")?.content || "";
      if (systemPrompt.includes("BƯỚC 2")) return { text: JSON.stringify({ featureKeys: [assistantFunctionKey(workflow)], ambiguous: false, clarification: "" }) };
      return { text: JSON.stringify({ actionId: workflow.actionId, values: { [analysisField.key]: JSON.stringify({ groupBy: "status" }) } }) };
    });
    const text = "Tháng này đối tác giới thiệu công nhân nào đủ người, ai còn thiếu?";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-26T05:00:00.000Z"));
    try {
      const result = await interpretRequest(text, [workflow], null, []);

      expect(result.actionId).toBe(operation.id);
      expect(result.values[periodField.key]).toBe("2026-11-01");
      expect(result.values[analysisField.key]).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("lets the final planner resolve a read function after ambiguous discovery when vocabulary matches a catalog action", async () => {
    const receiptList = operationById("inventory.receipt.list")!;
    provider.mockImplementation((request: any) => {
      const systemPrompt = request.messages.find((message: any) => message.role === "system")?.content || "";
      if (systemPrompt.includes("BƯỚC 2")) {
        return { text: JSON.stringify({ featureKeys: [], ambiguous: true, clarification: "Bạn muốn xử lý nhóm chức năng nào?" }) };
      }
      return { text: JSON.stringify({ actionId: receiptList.id, values: {} }) };
    });

    const result = await interpretRequest(
      "Cho xem các phiếu nhập kho",
      ASSISTANT_OPERATIONS.filter(operation => operation.module === receiptList.module).map(defaultWorkflow),
      null,
      [],
    );

    expect(result.actionId).toBe(receiptList.id);
    expect(provider).toHaveBeenCalledTimes(2);
  });

  it("maps a requested instructor column to the class-list output", async () => {
    const batchList = operationById("batch.list")!;
    provider.mockResolvedValue({ text: JSON.stringify({
      actionId: batchList.id,
      values: {},
      requestCoverage: [{ evidence: "giảng viên Nguyễn Lan", requirement: "Hiển thị giảng viên phụ trách lớp", mappedTo: ["result.instructorName"] }],
    }) });

    const result = await interpretRequest(
      "Cho tôi danh sách các lớp của giảng viên Nguyễn Lan",
      ASSISTANT_OPERATIONS.filter(operation => operation.module === batchList.module).map(defaultWorkflow),
      null,
      [],
    );

    expect(result.actionId).toBe(batchList.id);
  });

  it("uses the available expiring-contract filter for an explicit 30-day window", async () => {
    const contracts = operationById("worker.labor.contract.list")!;
    provider.mockResolvedValue({ text: JSON.stringify({
      actionId: contracts.id,
      values: {},
      requestCoverage: [{ evidence: "sắp hết hạn trong vòng 30 ngày tới", requirement: "Lọc hợp đồng sắp hết hạn trong 30 ngày", mappedTo: ["values.query_alert"] }],
    }) });

    const result = await interpretRequest(
      "Những hợp đồng lao động nào sắp hết hạn trong vòng 30 ngày tới",
      ASSISTANT_OPERATIONS.filter(operation => operation.module === contracts.module).map(defaultWorkflow),
      null,
      [],
    );

    expect(result.actionId).toBe(contracts.id);
    expect(result.values.query_alert).toBe("expiring");
  });

  it.each([30, 60, 90])("preserves a changed expiry window for HR employee contracts: %i days", async days => {
    const text = `Hợp đồng lao động của nhân viên nào sắp hết hạn trong ${days} ngày tới?`;
    const workflows = ASSISTANT_OPERATIONS.filter(operation => operation.module === "hr").map(defaultWorkflow);

    const result = await interpretRequest(text, workflows, null, []);

    expect(result).toMatchObject({
      actionId: "hr.contract.expiring.list",
      intentType: "workflow",
      actionIntent: "report",
      values: { query_alertDays: days },
    });
    expect(provider).not.toHaveBeenCalled();
  });

  it.each([
    ["Khách đang hỏi mua Samsung Galaxy Ultra, báo nhanh giúp tôi giá bán và số lượng còn sẵn", "Samsung Galaxy Ultra"],
    ["Tôi cần mua 3 máy iPhone 14 bản Titan Sa Mạc. Cho biết giá bán và số lượng còn sẵn.", "Titan Sa Mạc"],
    ["Tra cứu sản phẩm Xiaomi Redmi Note 14, xem giá bán và tồn khả dụng", "Xiaomi Redmi Note 14"],
  ])("routes retail product price and stock lookups with the requested product: %s", async (text, product) => {
    const workflows = ASSISTANT_OPERATIONS.filter(operation => operation.module === "retail").map(defaultWorkflow);

    const result = await interpretRequest(text, workflows, null, []);

    expect(result).toMatchObject({
      actionId: "retail.order.products.list",
      intentType: "workflow",
      actionIntent: "lookup",
      values: { query_q: product },
    });
    expect(result.requestCoverage).toEqual(expect.arrayContaining([
      expect.objectContaining({ mappedTo: ["result.price"] }),
      expect.objectContaining({ mappedTo: ["result.stock"] }),
    ]));
    expect(provider).not.toHaveBeenCalled();
  });

  it("filters foreign-worker permits expiring within 30 days", async () => {
    const workers = operationById("worker.list")!;
    const workflow = defaultWorkflow(workers);
    const expiryWindowField = workflow.fields.find(field => field.apiKey === "permitExpiryWithinDays");
    expect(expiryWindowField).toBeDefined();
    provider.mockResolvedValue({ text: JSON.stringify({ actionId: workers.id, values: {} }) });

    const result = await interpretRequest(
      "Liệt kê lao động nước ngoài có visa sắp hết hạn trong 30 ngày tới",
      ASSISTANT_OPERATIONS.filter(operation => operation.module === workers.module).map(defaultWorkflow),
      null,
      [],
    );

    expect(result.actionId).toBe(workers.id);
    expect(result.values[expiryWindowField!.key]).toBe(30);
  });

  it("routes an explicit foreign permit expiry report when the planner asks an unnecessary question", async () => {
    const worker = defaultWorkflow(operationById("worker.list")!);
    provider.mockResolvedValueOnce({ text: JSON.stringify({
      intentType: "ambiguous", actionId: null, values: {}, requestCoverage: [],
      clarification: "Bạn có muốn xem danh sách lao động có giấy phép sắp hết hạn không?",
    }) });
    const text = "Lao động nước ngoài nào có giấy phép lao động hoặc visa sắp hết hạn trong 30 ngày tới?";

    const result = await interpretRequest(text, [worker], null, []);

    expect(result).toMatchObject({ actionId: "worker.list", intentType: "workflow", values: { query_permitExpiryWithinDays: 30 } });
    expect(result.clarification).toBeUndefined();
  });

  it.each(["supplier", "dealer"])("maps retail partner role %s to the existing list filter", async role => {
    const partnerList = operationById("retail.partner.list")!;
    const roleField = defaultWorkflow(partnerList).fields.find(field => field.apiKey === "role")!;
    const wording = role === "supplier" ? "nhà cung cấp" : "đại lý";
    provider.mockResolvedValue({ text: JSON.stringify({
      actionId: partnerList.id,
      values: { [roleField.key]: role },
      requestCoverage: [{ evidence: wording, requirement: "Lọc theo vai trò đối tác", mappedTo: [`values.${roleField.key}`] }],
    }) });

    const result = await interpretRequest(
      `Liệt kê các đối tác bán lẻ có vai trò ${wording}`,
      ASSISTANT_OPERATIONS.filter(operation => operation.module === partnerList.module).map(defaultWorkflow),
      null,
      [],
    );

    expect(result.actionId).toBe(partnerList.id);
    expect(result.values[roleField.key]).toBe(role);
  });

  it("routes a retail partner overview to the retail partner list", async () => {
    const workflow = defaultWorkflow(operationById("retail.partner.list")!);
    provider.mockResolvedValueOnce({ text: JSON.stringify({ intentType: "ambiguous", actionId: null, values: {} }) });

    const result = await interpretRequest(
      "Báo cáo tổng quan tình hình đối tác bán lẻ hiện tại của cửa hàng",
      [workflow], null, [],
    );

    expect(result).toMatchObject({ intentType: "workflow", actionId: workflow.actionId });
    expect(result.clarification).toBeUndefined();
  });

  it("uses the current retail commission balance instead of asking for a statement date range", async () => {
    const statementOperation = ASSISTANT_OPERATIONS.find(operation => operation.path === "/retail/finance/commission/partners/:id/statement")!;
    const statement = defaultWorkflow(statementOperation);
    const balance = defaultWorkflow(ASSISTANT_OPERATIONS.find(operation => operation.path === "/retail/finance/commission/balances")!);
    const partner = defaultWorkflow(operationById("retail.partner.list")!);
    provider.mockResolvedValueOnce({ text: JSON.stringify({ intentType: "ambiguous", actionId: null, values: {} }) });

    const result = await interpretRequest(
      "Cộng tác viên Đinh Viết Tường hiện đang có số dư hoa hồng là bao nhiêu",
      [statement, balance, partner], null, [],
    );

    expect(result).toMatchObject({ intentType: "workflow", actionId: balance.actionId, values: { query_partnerId: "Đinh Viết Tường" } });
    expect(JSON.parse(String(result.values.analysis))).toEqual({});
  });

  it("filters positive retail partner balances and aggregates the amount still payable", async () => {
    const balance = defaultWorkflow(ASSISTANT_OPERATIONS.find(operation => operation.path === "/retail/finance/commission/balances")!);
    const partner = defaultWorkflow(operationById("retail.partner.list")!);
    provider.mockResolvedValue({ text: JSON.stringify({ intentType: "ambiguous", actionId: null, values: {} }) });

    const listed = await interpretRequest("Những cộng tác viên bán lẻ nào đang có số dư hoa hồng lớn hơn 0 đồng", [balance, partner], null, []);
    const total = await interpretRequest("Tổng số dư hoa hồng cửa hàng đang còn phải trả cho các cộng tác viên bán lẻ là bao nhiêu", [balance, partner], null, []);

    expect(listed.actionId).toBe(balance.actionId);
    expect(JSON.parse(String(listed.values.analysis))).toEqual({ filters: [{ field: "balance", operator: "gt", value: 0 }] });
    expect(total.actionId).toBe(balance.actionId);
    expect(total.values).not.toHaveProperty("query_partnerId");
    expect(JSON.parse(String(total.values.analysis))).toEqual({
      filters: [{ field: "balance", operator: "gt", value: 0 }], aggregate: { operation: "sum", field: "balance" },
    });
  });

  it("drops a stale composite plan when the total retail balance route is selected", async () => {
    const balance = defaultWorkflow(ASSISTANT_OPERATIONS.find(operation => operation.path === "/retail/finance/commission/balances")!);
    const partner = defaultWorkflow(operationById("retail.partner.list")!);
    const text = "Tổng số dư hoa hồng cửa hàng đang còn phải trả cho các cộng tác viên bán lẻ là bao nhiêu";
    provider.mockResolvedValue({ text: JSON.stringify({
      intentType: "workflow", actionId: null, actionIntent: "report", values: {},
      queryPlan: [
        { actionId: balance.actionId, purpose: "số dư hoa hồng", values: {}, resultFields: ["partnerName", "balance"] },
        { actionId: partner.actionId, purpose: "cộng tác viên bán lẻ", values: {}, resultFields: ["name"] },
      ],
      requestCoverage: [{ evidence: text, requirement: "Tổng số dư hoa hồng còn phải trả", mappedTo: ["action"] }],
    }) });

    const result = await interpretRequest(text, [balance, partner], null, []);

    expect(result).toMatchObject({ intentType: "workflow", actionId: balance.actionId });
    expect(result.queryPlan).toBeUndefined();
    expect(result.values).not.toHaveProperty("query_partnerId");
  });

  it("routes product commission configuration counts to the read-only settings report", async () => {
    const operation = ASSISTANT_OPERATIONS.find(candidate => candidate.method === "GET" && candidate.path === "/retail/partners/product-commissions")!;
    const workflow = defaultWorkflow(operation);
    provider.mockResolvedValueOnce({ text: JSON.stringify({ intentType: "ambiguous", actionId: null, values: {} }) });

    const result = await interpretRequest(
      "Báo cáo tổng quan cấu hình hoa hồng sản phẩm bán lẻ: có mấy nhóm ngành hàng, mấy sản phẩm, bao nhiêu biến thể và bao nhiêu mẫu đã đặt mức riêng",
      [workflow], null, [],
    );

    expect(result).toMatchObject({ intentType: "workflow", actionId: workflow.actionId });
  });

  it("groups inventory transfer counts by status for an explicit status summary", async () => {
    const workflow = defaultWorkflow(operationById("inventory.transfer.list")!);
    provider.mockResolvedValueOnce({ text: JSON.stringify({ intentType: "ambiguous", actionId: null, values: {} }) });

    const result = await interpretRequest(
      "Báo cáo tổng hợp tình hình điều chuyển kho: bao nhiêu phiếu đang chuyển, đã nhận và đã hủy",
      [workflow], null, [],
    );

    expect(result).toMatchObject({ intentType: "workflow", actionId: workflow.actionId });
    expect(JSON.parse(String(result.values.analysis))).toEqual({ groupBy: "status", aggregate: { operation: "count" } });
  });

  it("recovers the requested total-tuition extremum for student-partner analysis", async () => {
    const analysis = operationById("partner.analysis")!;
    provider.mockResolvedValue({ text: JSON.stringify({ actionId: analysis.id, values: {} }) });

    const result = await interpretRequest(
      "Đối tác nào có tổng học phí được giới thiệu cao nhất?",
      ASSISTANT_OPERATIONS.filter(operation => operation.module === analysis.module).map(defaultWorkflow),
      null,
      [],
    );

    expect(result.actionId).toBe(analysis.id);
    expect(result.values.analysis).toEqual({ extreme: { field: "totalReferredTuition", direction: "max" } });
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

    expect(result.actionId).toBe(laborKpi.id);
    expect(result.values.analysis).toEqual({ extreme: { field: "actualReferrals", direction: "max" } });
    expect(provider).toHaveBeenCalled();
    const prompts = provider.mock.calls.map((call: any) => call[0].messages.map((message: any) => message.content).join("\n")).join("\n");
    expect(prompts).toContain(laborKpi.id);
    expect(prompts).not.toContain("Tra cứu đối tác tuyển sinh");
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
    expect(prompt).toContain("periodAnchor");
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
        { evidence: "nhiều lao động nhất", requirement: "Xếp theo số lao động được giới thiệu cao nhất", mappedTo: ["analysis.extreme.actualReferrals"] },
        { evidence: "trong tháng", requirement: "Kỳ tháng hiện tại", mappedTo: [`values.${periodField.key}`] },
      ],
    }) });

    const result = await interpretRequest(text, [workflow], null, []);

    expect(result.actionId).toBe(operation.id);
    expect(result.values.analysis).toEqual({ extreme: { field: "actualReferrals", direction: "max" } });
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

    const result = await interpretRequest("Trong phân hệ học viên, tìm Lan", [employee, student], null, []);

    expect(result.actionId).toBe(student.actionId);
    expect(provider).toHaveBeenCalledTimes(2);
    const actionPrompt = provider.mock.calls[1][0].messages[0].content;
    const capabilityCatalog = actionPrompt.slice(actionPrompt.indexOf("DANH MỤC NĂNG LỰC:"), actionPrompt.indexOf("\nPHÂN HỆ CÓ THỂ TRUY CẬP:"));
    expect(capabilityCatalog).toContain(student.actionId);
    expect(capabilityCatalog).not.toContain(employee.actionId);
  });
  it.each([
    "Báo cáo tình hình chấm công các lao động hôm nay",
    "Báo cáo tình hình chấm công các lao động trong dự án: dự án mẫu kho vận",
  ])("keeps explicit project-labor attendance requests in the worker module: %s", async text => {
    const workerReport = defaultWorkflow(operationById("worker.report")!);
    provider.mockResolvedValue({ text: JSON.stringify({ actionId: workerReport.actionId, values: {} }) });

    const result = await interpretRequest(text, ASSISTANT_OPERATIONS.map(defaultWorkflow), null, [], "", [], "", [], true);

    expect(result.actionId).toBe(workerReport.actionId);
    const finalPrompt = provider.mock.calls.at(-1)![0].messages[0].content;
    expect(finalPrompt).toContain(workerReport.actionId);
    expect(finalPrompt).not.toContain("hr.daily.overview");
    expect(finalPrompt).toContain("Tách tên phân hệ khỏi loại hồ sơ/người được hỏi");
    expect(finalPrompt).toContain("chọn worker.report");
    expect(finalPrompt).toContain("các từ lao động/công nhân là đối tượng dữ liệu");
  });
  it("uses a compact module and function catalog for large authorized workflow sets", async () => {
    const employeeList = defaultWorkflow(operationById("employee.list")!);
    const workflows = ASSISTANT_OPERATIONS.map(operation => defaultWorkflow(operation));
    provider.mockResolvedValueOnce({ text: JSON.stringify({ modules: ["hr"] }) });
    provider.mockResolvedValueOnce({ text: JSON.stringify({ featureKeys: ["hr:employee"], ambiguous: false, clarification: "" }) });
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: employeeList.actionId, values: {} }) });

    const result = await interpretRequest("Tìm nhân sự", workflows, null, []);

    expect(result.actionId).toBe(employeeList.actionId);
    expect(provider).toHaveBeenCalledTimes(3);
    const modulePrompt = provider.mock.calls[0][0].messages[0].content;
    expect(modulePrompt).toContain("Chấm công và lịch làm việc");
    expect(modulePrompt).not.toContain(employeeList.actionId);
    expect(Buffer.byteLength(modulePrompt)).toBeLessThan(50_000);
  });
  it("keeps a focused clarification instead of retrying the entire large catalog", async () => {
    const workflows = ASSISTANT_OPERATIONS.map(operation => defaultWorkflow(operation));
    provider.mockResolvedValueOnce({ text: JSON.stringify({ intentType: "ambiguous", actionId: null, values: {}, requestCoverage: [], clarification: "Bạn có muốn xem báo cáo hôm nay không?" }) });
    const result = await interpretRequest("Tổng hợp giúp tôi tỉ lệ chấm công hôm nay", workflows, null, []);

    expect(result.intentType).toBe("ambiguous");
    expect(result.clarification).toContain("toàn bộ nhân sự trong chi nhánh");
    expect(result.clarification).toContain("người có lịch");
    expect(provider).toHaveBeenCalledTimes(1);
  });
  it("resumes the attendance-rate report when the user clarifies company-wide scope", async () => {
    const attendance = operationById("timekeeping.records.overview")!;
    const workflows = ASSISTANT_OPERATIONS.filter(operation => operation.module === attendance.module).map(defaultWorkflow);
    provider.mockResolvedValue({ text: JSON.stringify({ intentType: "general_question", actionId: null, values: {} }) });

    const result = await interpretRequest(
      "tôi muốn xem toàn công ty",
      workflows,
      null,
      [
        { role: "user", content: "tổng hợp giúp tôi tỉ lệ chấm công hôm nay" },
        { role: "assistant", content: "Bạn muốn tính tỷ lệ trên toàn bộ nhân sự trong chi nhánh hay chỉ những người được xếp lịch làm hôm nay? Báo cáo hiện chưa kèm danh sách người có lịch." },
      ],
      "",
      [],
      "",
      [],
      true,
      true,
    );

    expect(result.actionId).toBe(attendance.id);
    expect(result.values.query_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.values.scope).toBe("company");
    expect(result.newRequest).toBe(false);
  });
  it("resumes a company attendance request after a short scope clarification", async () => {
    const workflows = ASSISTANT_OPERATIONS.map(defaultWorkflow);
    provider.mockResolvedValue({ text: JSON.stringify({ intentType: "general_question", actionId: null, values: {} }) });

    const result = await interpretRequest(
      "Nhân sự công ty nhé.",
      workflows,
      null,
      [
        { role: "user", content: "Hôm nay bên mình ai xin nghỉ, ai đi trễ vậy?" },
        { role: "assistant", content: "Bạn muốn tra cứu ở phân hệ nhân sự công ty hay lao động theo dự án?" },
      ],
      "",
      [],
      "",
      [],
      true,
      true,
    );

    expect(result.actionId, JSON.stringify(result)).toBe("timekeeping.records.leave");
    expect(result.values.query_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.values).not.toHaveProperty("query_scope");
    expect(result.remainingRequests).toEqual(["Liệt kê nhân sự đi trễ hôm nay trong chi nhánh hiện tại"]);
    expect(result.newRequest).toBe(false);
  });
  it("routes the follow-up late-attendance lookup to the current branch explicitly", async () => {
    const lateAttendance = defaultWorkflow(operationById("timekeeping.records.late")!);
    const result = await interpretRequest("Liệt kê nhân sự đi trễ hôm nay trong chi nhánh hiện tại", [lateAttendance], null, []);
    expect(result).toMatchObject({ actionId: lateAttendance.actionId, intentType: "workflow", values: { query_scope: "branch" } });
    expect(result.values.query_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(provider).not.toHaveBeenCalled();
  });
  it("asks for the full name when leave balance is requested for an incomplete employee reference", async () => {
    const leaveBalances = defaultWorkflow(operationById("leave.balances.list")!);

    const result = await interpretRequest("Anh Nam bên kế toán còn mấy ngày phép?", [leaveBalances], null, []);

    expect(result).toMatchObject({ intentType: "ambiguous", actionId: null, values: {} });
    expect(result.clarification).toContain("họ tên đầy đủ");
    expect(provider).not.toHaveBeenCalled();
  });
  it("asks which student the user means before looking up a pronoun-based tuition balance", async () => {
    const studentList = defaultWorkflow(operationById("student.list")!);

    const result = await interpretRequest("Bạn đó còn nợ học phí không?", [studentList], null, []);

    expect(result).toMatchObject({ intentType: "ambiguous", actionId: null, values: {} });
    expect(result.clarification).toContain("họ tên hoặc số điện thoại");
    expect(provider).not.toHaveBeenCalled();
  });
  it("asks a supported-scope follow-up when attendance cannot be filtered by department", async () => {
    const lateAttendance = defaultWorkflow(operationById("timekeeping.records.late")!);

    const result = await interpretRequest(
      "Còn bên hành chính thì ai vậy?",
      [lateAttendance],
      null,
      [
        { role: "user", content: "Hôm nay nhân sự công ty có ai đi làm trễ không?" },
        { role: "assistant", content: "Có 2 nhân sự đi muộn trong ngày 27/11/2026." },
      ],
    );

    expect(result).toMatchObject({ intentType: "ambiguous", actionId: null, values: {} });
    expect(result.clarification).toContain("phòng hành chính");
    expect(result.clarification).toContain("chi nhánh hiện tại");
    expect(provider).not.toHaveBeenCalled();
  });
  it("resumes a late-attendance report when the user accepts the branch-wide scope", async () => {
    const lateAttendance = defaultWorkflow(operationById("timekeeping.records.late")!);

    const result = await interpretRequest(
      "Cả chi nhánh cũng được.",
      [lateAttendance],
      null,
      [
        { role: "user", content: "Hôm nay nhân sự công ty có ai đi làm trễ không?" },
        { role: "assistant", content: "Có 2 nhân sự đi muộn trong ngày 27/11/2026." },
        { role: "user", content: "Còn bên hành chính thì ai vậy?" },
        { role: "assistant", content: "Báo cáo hiện chưa lọc được theo phòng Hành chính. Bạn có muốn xem danh sách nhân sự đi muộn hôm nay theo chi nhánh không?" },
      ],
      "",
      [],
      "",
      [],
      false,
      true,
    );

    expect(result).toMatchObject({ intentType: "workflow", actionId: "timekeeping.records.late", newRequest: false });
    expect(result.values.query_scope).toBe("branch");
    expect(result.values.query_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(provider).not.toHaveBeenCalled();
  });
  it("keeps the date and switches from an office attendance question to a project report", async () => {
    const workerReport = defaultWorkflow(operationById("worker.report")!);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-26T17:00:00.000Z"));
    try {
      const result = await interpretRequest(
        "Còn bên công trình Cầu An Bình thì sao?",
        [workerReport], null,
        [
          { role: "user", content: "Hôm nay nhân sự công ty có ai xin nghỉ không?" },
          { role: "assistant", content: "Trần Quốc Bảo nghỉ phép hôm nay." },
        ],
      );

      expect(result).toMatchObject({ actionId: "worker.report", intentType: "workflow", newRequest: false });
      expect(result.values.projectId).toBe("cau an binh");
      expect(result.values.date).toBe("2026-11-27");
      expect(result.values.mode).toBe("all");
      expect(provider).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
  it("reuses a POS report context when the user asks a short cash follow-up", async () => {
    const retailSummary = defaultWorkflow(operationById("retail.report.summary")!);
    const result = await interpretRequest(
      "Tiền mặt thu được bao nhiêu?",
      [retailSummary], null,
      [
        { role: "user", content: "Hôm nay shop chốt được mấy đơn?" },
        { role: "assistant", content: "Đơn hàng: 3\nThanh toán: Tiền mặt 40.000.000 ₫ · Chuyển khoản 6.000.000 ₫" },
      ],
    );

    expect(result).toMatchObject({ actionId: "retail.report.summary", intentType: "workflow", newRequest: false });
    expect(provider).not.toHaveBeenCalled();
  });
  it("sums positive unpaid balances for a plain labor-partner debt question", async () => {
    const settlementList = defaultWorkflow(operationById("worker.partner.settlements.list")!);
    const result = await interpretRequest(
      "Công ty còn nợ tiền hoa hồng đối tác lao động bao nhiêu?",
      [settlementList], null, [],
    );

    expect(result).toMatchObject({ actionId: "worker.partner.settlements.list", intentType: "workflow", actionIntent: "report" });
    expect(JSON.parse(String(result.values.analysis))).toEqual({
      filters: [{ field: "balanceAmount", operator: "gt", value: 0 }],
      aggregate: { operation: "sum", field: "balanceAmount" },
    });
    expect(provider).not.toHaveBeenCalled();
  });
  it("routes onboarded totals and department ranking through the recruitment report", async () => {
    const recruitmentReport = defaultWorkflow(operationById("recruitment.report")!);
    provider.mockResolvedValueOnce({ text: JSON.stringify({ intentType: "ambiguous", actionId: null, values: {}, requestCoverage: [], clarification: "C\u1ea7n l\u00e0m r\u00f5 b\u00e1o c\u00e1o." }) });
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-25T05:00:00.000Z"));
    try {
      const result = await interpretRequest(
        "Th\u00e1ng n\u00e0y c\u00f3 bao nhi\u00eau \u1ee9ng vi\u00ean onboard v\u00e0 ch\u1ee7 y\u1ebfu \u1edf ph\u00f2ng n\u00e0o",
        [recruitmentReport], null, [],
      );

      expect(result).toMatchObject({ intentType: "workflow", actionId: "recruitment.report", values: {
        query_reportType: "onboarded", query_from: "2026-11-01", query_to: "2026-11-30",
      } });
    } finally {
      vi.useRealTimers();
    }
  });

  it("routes an informal new-hire count and department ranking through the recruitment report", async () => {
    const recruitmentReport = defaultWorkflow(operationById("recruitment.report")!);
    provider.mockResolvedValueOnce({ text: JSON.stringify({ intentType: "ambiguous", actionId: null, values: {}, requestCoverage: [], clarification: "Cần làm rõ báo cáo." }) });
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-25T05:00:00.000Z"));
    try {
      const result = await interpretRequest(
        "Tháng này có mấy bạn mới vào làm, bên phòng nào nhận nhiều nhất?",
        [recruitmentReport], null, [],
      );

      expect(result).toMatchObject({ intentType: "workflow", actionId: "recruitment.report", values: {
        query_reportType: "onboarded", query_from: "2026-11-01", query_to: "2026-11-30",
      } });
    } finally {
      vi.useRealTimers();
    }
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it("routes below-target employee KPI requests for the previous month", async () => {
    const kpiWorkflow = defaultWorkflow(operationById("task.kpi.monthly")!);
    provider.mockResolvedValueOnce({ text: JSON.stringify({ intentType: "ambiguous", actionId: null, values: {}, clarification: "Cần làm rõ báo cáo." }) });
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-26T05:00:00.000Z"));
    try {
      const text = "Tháng trước, những nhân sự nào không đạt KPI?";
      const result = await interpretRequest(text, [kpiWorkflow], null, []);

      expect(result).toMatchObject({ actionId: "task.kpi.monthly", intentType: "workflow", values: {
        period: "2026-10", completionFilter: "below-100",
      } });
      expect(result.clarification).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("resumes the single supported labor-partner report when the user accepts the scope offer", async () => {
    const operation = ASSISTANT_OPERATIONS.find(candidate => candidate.path === "/worker-management/partners/reports/commission")!;
    const workflow = defaultWorkflow(operation);
    const request = "Lập báo cáo tổng quan phân hệ Lao động tháng 11/2026: số dự án, tổng lao động, tỉ lệ chuyên cần, hợp đồng sắp hết hạn và công nợ hoa hồng đối tác";
    const messages = [
      { role: "user", content: request },
      { role: "assistant", content: "Danh mục hiện chỉ hỗ trợ báo cáo công nợ hoa hồng đối tác lao động. Bạn có muốn xem riêng phần này cho tháng 11/2026 không?" },
    ];

    const result = await interpretRequest("có", [workflow], null, messages, "", [], "", ["labor-partner"], false, true);

    expect(result).toMatchObject({ actionId: operation.id, intentType: "workflow", newRequest: false, values: {
      query_periodFrom: "2026-11-01", query_periodTo: "2026-11-30",
    } });
    expect(provider).not.toHaveBeenCalled();
  });

  it("routes colloquial project attendance questions to the labor report with project and date filters", async () => {
    const workflow = defaultWorkflow(operationById("worker.report")!);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-27T05:00:00.000Z"));
    try {
      const result = await interpretRequest("cho tui coi hom nay cong trinh cau an binh ai di tre nha", [workflow], null, []);
      expect(result).toMatchObject({ actionId: "worker.report", intentType: "workflow", values: {
        projectId: "cau an binh", date: "2026-11-27", mode: "late",
      } });
      expect(provider).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("looks up the named student's fee and paid amount for a plain outstanding-balance question", async () => {
    const workflow = defaultWorkflow(operationById("student.list")!);
    const result = await interpretRequest("Bạn Lê Thanh Hạ còn thiếu bao nhiêu tiền học?", [workflow], null, []);
    expect(result).toMatchObject({ actionId: workflow.actionId, intentType: "workflow", values: { search: "Lê Thanh Hạ" } });
    expect(result.requestCoverage).toEqual(expect.arrayContaining([
      expect.objectContaining({ mappedTo: expect.arrayContaining(["result.fee", "result.paidAmount"]) }),
    ]));
    expect(provider).not.toHaveBeenCalled();
  });

  it("routes an upcoming labor contract question to the expiring-contract filter", async () => {
    const workflow = defaultWorkflow(operationById("worker.labor.contract.list")!);
    const result = await interpretRequest("Có hợp đồng lao động nào sắp đến hạn không?", [workflow], null, []);
    expect(result).toMatchObject({ actionId: workflow.actionId, intentType: "workflow", values: { query_alert: "expiring" } });
    expect(provider).not.toHaveBeenCalled();
  });

  it("routes a cash-count shortage question to closed POS shifts", async () => {
    const workflow = defaultWorkflow(operationById("retail.shift.list")!);
    const result = await interpretRequest("Có ca bán hàng nào kiểm tiền bị thiếu không?", [workflow], null, []);
    expect(result).toMatchObject({ actionId: workflow.actionId, intentType: "workflow", values: { query_status: "closed" } });
    expect(provider).not.toHaveBeenCalled();
  });

  it("runs both HR leave and late reports after the user clarifies the employee module", async () => {
    const leave = defaultWorkflow(operationById("timekeeping.records.leave")!);
    const late = defaultWorkflow(operationById("timekeeping.records.late")!);
    const messages = [
      { role: "user", content: "Hôm nay bên mình ai xin nghỉ, ai đi trễ vậy?" },
      { role: "assistant", content: "Bạn muốn xem nhân sự công ty hay lao động ở công trình?" },
    ];
    const result = await interpretRequest("Nhân sự công ty nhé", [leave, late], null, messages, "", [], "", [], false, true);

    expect(result).toMatchObject({
      actionId: leave.actionId,
      intentType: "workflow",
      remainingRequests: ["Liệt kê nhân sự đi trễ hôm nay trong chi nhánh hiện tại"],
    });
    expect(provider).not.toHaveBeenCalled();
  });

  it("reports class time, absences, and remaining seats from an informal question", async () => {
    const workflow = defaultWorkflow(operationById("student.batch.attendance.summary")!);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-27T05:00:00.000Z"));
    try {
      const result = await interpretRequest(
        "Lop Excel can ban toi nay hoc luc may gio, co bao nhieu nguoi nghi va con may cho?",
        [workflow], null, [],
      );
      expect(result).toMatchObject({ actionId: workflow.actionId, intentType: "workflow", values: {
        path_id: "Excel can ban", date: "2026-11-27",
      } });
      expect(provider).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops an accented class name before the following attendance question", async () => {
    const workflow = defaultWorkflow(operationById("student.batch.attendance.summary")!);
    const result = await interpretRequest("Tối nay lớp Excel căn bản có ai nghỉ học không?", [workflow], null, []);

    expect(result).toMatchObject({ actionId: workflow.actionId, intentType: "workflow", values: { path_id: "Excel căn bản" } });
    expect(provider).not.toHaveBeenCalled();
  });

  it("keeps a named learner's tuition as the second step of a class schedule question", async () => {
    const attendance = defaultWorkflow(operationById("student.batch.attendance.summary")!);
    const first = await interpretRequest("Lớp Excel tối nay bắt đầu lúc mấy giờ, chị Hạ còn thiếu học phí không?", [attendance], null, []);
    expect(first).toMatchObject({ actionId: attendance.actionId, remainingRequests: ["Học viên Hạ còn nợ học phí bao nhiêu?"] });
    const studentList = defaultWorkflow(operationById("student.list")!);
    const second = await interpretRequest(first.remainingRequests![0], [studentList], null, []);
    expect(second).toMatchObject({ actionId: studentList.actionId, values: { search: "Hạ" } });
    expect(provider).not.toHaveBeenCalled();
  });

  it("checks an absent student's tuition using the name in the preceding attendance result", async () => {
    const workflow = defaultWorkflow(operationById("student.list")!);
    const result = await interpretRequest("Bạn đó còn nợ học phí không?", [workflow], null, [
      { role: "assistant", content: "Lớp Excel căn bản · Học viên vắng: Đặng Minh Khoa" },
    ]);
    expect(result).toMatchObject({ actionId: workflow.actionId, intentType: "workflow", values: { search: "Đặng Minh Khoa" } });
    expect(provider).not.toHaveBeenCalled();
  });

  it("extracts only the absent learner's name from a detailed attendance summary", async () => {
    const workflow = defaultWorkflow(operationById("student.list")!);
    const result = await interpretRequest("Bạn đó còn nợ học phí không?", [workflow], null, [
      { role: "assistant", content: "Lớp Excel căn bản · Học viên vắng: Đặng Minh Khoa · Có phép: 0 · Chưa ghi nhận: 0 · Ghi chú: chưa ghi nhận không đồng nghĩa vắng" },
    ]);
    expect(result).toMatchObject({ actionId: workflow.actionId, intentType: "workflow", values: { search: "Đặng Minh Khoa" } });
    expect(provider).not.toHaveBeenCalled();
  });

  it("continues a two-context project attendance and labor-contract request", async () => {
    const report = defaultWorkflow(operationById("worker.report")!);
    const contract = defaultWorkflow(operationById("worker.labor.contract.list")!);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-27T05:00:00.000Z"));
    try {
      const result = await interpretRequest(
        "Công trình Cầu An Bình hôm nay ai đi trễ, hợp đồng của Đỗ Hoàng Nam còn tới ngày nào?",
        [report, contract], null, [],
      );
      expect(result).toMatchObject({ actionId: report.actionId, intentType: "workflow", remainingRequests: [
        "Hợp đồng của Đỗ Hoàng Nam còn tới ngày nào?",
      ] });
      const followUp = await interpretRequest("Còn hợp đồng của anh Nam bao lâu nữa?", [contract], null, [
        { role: "user", content: "Công trình Cầu An Bình hôm nay ai đi trễ, hợp đồng của Đỗ Hoàng Nam còn tới ngày nào?" },
      ]);
      expect(followUp).toMatchObject({ actionId: contract.actionId, intentType: "workflow", values: { query_search: "Đỗ Hoàng Nam" } });
      expect(provider).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("looks up cable stock and price, and schedules product sales plus stock as two reads", async () => {
    const products = defaultWorkflow(operationById("retail.order.products.list")!);
    const stock = await interpretRequest("Cáp sạc Gia Bảo còn mấy cái vậy?", [products], null, []);
    expect(stock).toMatchObject({ actionId: products.actionId, intentType: "workflow", values: { query_q: "Gia Bảo" } });

    const summary = defaultWorkflow(operationById("retail.report.summary")!);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-27T05:00:00.000Z"));
    try {
      const combined = await interpretRequest(
        "Tháng này cáp Gia Bảo bán được mấy cái, giờ trong kho còn bao nhiêu?", [summary, products], null, [],
      );
      expect(combined).toMatchObject({ actionId: summary.actionId, intentType: "workflow", values: {
        from: "2026-11-01", to: "2026-11-30",
      }, remainingRequests: ["Tra cứu tồn kho sản phẩm Gia Bảo"] });
    } finally {
      vi.useRealTimers();
    }
    expect(provider).not.toHaveBeenCalled();
  });

  it("corrects a wrong list action for a clear onboarded department report", async () => {
    const recruitmentReport = defaultWorkflow(operationById("recruitment.report")!);
    const employeeList = defaultWorkflow(operationById("employee.list")!);
    provider.mockResolvedValue({ text: JSON.stringify({
      intentType: "workflow", actionId: "employee.list", values: {}, requestCoverage: [],
    }) });
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-25T05:00:00.000Z"));
    try {
      const result = await interpretRequest(
        "Tháng này có bao nhiêu ứng viên onboard và chủ yếu ở phòng nào",
        [recruitmentReport, employeeList], null, [],
      );

      expect(result).toMatchObject({ intentType: "workflow", actionId: "recruitment.report", values: {
        query_reportType: "onboarded", query_from: "2026-11-01", query_to: "2026-11-30",
      } });
    } finally {
      vi.useRealTimers();
    }
  });

  it("handles a department phrase and explicit month in the onboarded report", async () => {
    const recruitmentReport = defaultWorkflow(operationById("recruitment.report")!);
    const employeeList = defaultWorkflow(operationById("employee.list")!);
    provider.mockResolvedValue({ text: JSON.stringify({
      intentType: "workflow", actionId: "employee.list", values: {}, requestCoverage: [{ evidence: "phòng ban nào", requirement: "Lọc hồ sơ", mappedTo: ["action"] }],
    }) });
    const text = "Trong tháng 11/2026 có bao nhiêu ứng viên onboard và chủ yếu thuộc phòng ban nào?";

    const result = await interpretRequest(text, [recruitmentReport, employeeList], null, []);

    expect(result).toMatchObject({ actionId: "recruitment.report", intentType: "workflow", values: {
      query_reportType: "onboarded", query_from: "2026-11-01", query_to: "2026-11-30",
    } });
    expect(result.clarification).toBeUndefined();
  });

  it("restores the onboarded department report when the user confirms a clarification", async () => {
    const recruitmentReport = defaultWorkflow(operationById("recruitment.report")!);
    provider.mockResolvedValueOnce({ text: JSON.stringify({ intentType: "ambiguous", actionId: null, values: {}, requestCoverage: [], clarification: "C\u1ea7n l\u00e0m r\u00f5 b\u00e1o c\u00e1o." }) });
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-25T05:00:00.000Z"));
    const history = [
      { role: "user", content: "Th\u00e1ng n\u00e0y c\u00f3 bao nhi\u00eau \u1ee9ng vi\u00ean onboard v\u00e0 ch\u1ee7 y\u1ebfu \u1edf ph\u00f2ng n\u00e0o" },
      { role: "assistant", content: "B\u1ea1n c\u00f3 mu\u1ed1n xem t\u1ed5ng s\u1ed1 tr\u01b0\u1edbc kh\u00f4ng?" },
      { role: "user", content: "c\u00f3" },
      { role: "assistant", content: "B\u1ea1n mu\u1ed1n tra c\u1ee9u th\u00f4ng tin hay c\u1eadp nh\u1eadt d\u1eef li\u1ec7u n\u00e0o?" },
    ];
    try {
      const result = await interpretRequest("c\u00f3", [recruitmentReport], null, history, "", [], "", [], false, true);

      expect(result).toMatchObject({ intentType: "workflow", actionId: "recruitment.report", newRequest: false, values: {
        query_reportType: "onboarded", query_from: "2026-11-01", query_to: "2026-11-30",
      } });
    } finally {
      vi.useRealTimers();
    }
  });

  it("maps requested leave balance columns to declared report outputs", async () => {
    const leaveReport = defaultWorkflow(operationById("leave.balances.list")!);
    provider.mockResolvedValue({ text: JSON.stringify({
      intentType: "workflow",
      actionId: leaveReport.actionId,
      actionIntent: "report",
      values: { year: 2026 },
      requestCoverage: [
        { evidence: "Thống kê", requirement: "Tra cứu báo cáo phép năm", mappedTo: ["action"] },
        { evidence: "lượt nghỉ phép còn lại", requirement: "Hiển thị số ngày phép năm còn lại", mappedTo: ["result.balances.remaining"] },
        { evidence: "các nhân sư", requirement: "Tên nhân sự trong báo cáo", mappedTo: ["result.balances.employeeName"] },
      ],
    }) });

    const result = await interpretRequest("Thống kê lượt nghỉ phép còn lại của các nhân sư", [leaveReport], null, []);

    expect(result).toMatchObject({ intentType: "workflow", actionId: "leave.balances.list", values: { year: 2026 } });
    const prompt = provider.mock.calls[0][0].messages.map((message: any) => message.content).join("\n");
    expect(prompt).toContain("result.<fieldPath>");
  });
  it("routes an explicit leave balance request to the leave report when planning is ambiguous", async () => {
    const leaveReport = defaultWorkflow(operationById("leave.balances.list")!);
    provider.mockResolvedValueOnce({ text: JSON.stringify({
      intentType: "ambiguous",
      actionId: null,
      values: {},
      clarification: "Bạn muốn tra cứu thông tin hay cập nhật dữ liệu nào?",
    }) });

    const result = await interpretRequest("Thống kê lượt nghỉ phép còn lại của các nhân sư", [leaveReport], null, []);

    expect(result).toMatchObject({ intentType: "workflow", actionId: "leave.balances.list" });
    expect(result.values).toMatchObject({ year: expect.any(Number) });
    expect(result.clarification).toBeUndefined();
  });
  it("filters a named multi-employee leave balance request for its stated year", async () => {
    const leaveReport = defaultWorkflow(operationById("leave.balances.list")!);
    provider.mockResolvedValueOnce({ text: JSON.stringify({ intentType: "ambiguous", actionId: null, values: {}, requestCoverage: [] }) });
    const text = "Cho tôi xem số ngày phép năm 2026 còn lại của Nam Văn Tú và Trần Quốc Bảo.";

    const result = await interpretRequest(text, [leaveReport], null, []);

    expect(result).toMatchObject({ actionId: "leave.balances.list", intentType: "workflow", values: {
      year: 2026, query_search: "Nam Văn Tú|Trần Quốc Bảo",
    } });
    expect(result.clarification).toBeUndefined();
  });

  it("routes class promotion criteria questions to the progression report", async () => {
    const progression = defaultWorkflow(operationById("student.learning-roadmap.progression.list")!);
    provider.mockResolvedValueOnce({ text: JSON.stringify({ intentType: "ambiguous", actionId: null, values: {}, requestCoverage: [] }) });
    const text = "Ở lớp IGENTEST-1 có những học viên nào chưa đủ điều kiện lên lớp và đang thiếu tiêu chí nào?";

    const result = await interpretRequest(text, [progression], null, []);

    expect(result).toMatchObject({ actionId: progression.actionId, intentType: "workflow", values: { path_batchId: "IGENTEST-1" } });
    expect(result.clarification).toBeUndefined();
  });
  it("recognizes partner requests for bank accounts that have not been updated", async () => {
    const partnerList = defaultWorkflow(operationById("partner.list")!);
    provider.mockResolvedValueOnce({ text: JSON.stringify({
      intentType: "ambiguous",
      actionId: null,
      values: {},
      clarification: "Bạn muốn tra cứu thông tin hay cập nhật dữ liệu nào?",
    }) });

    const result = await interpretRequest("Kiểm tra những đối tác tuyển sinh nào chưa cập nhật tài khoản ngân hàng nhận hoa hồng", [partnerList], null, []);

    expect(result).toMatchObject({ intentType: "workflow", actionId: "partner.list", values: { query_bankAccountFilter: "missing" } });
    expect(result.clarification).toBeUndefined();
  });
  it("keeps account and unpaid-commission conditions when filtering referral partners", async () => {
    const partnerList = defaultWorkflow(operationById("partner.list")!);
    provider.mockResolvedValue({ text: JSON.stringify({ intentType: "ambiguous", actionId: null, values: {} }) });

    const result = await interpretRequest(
      "Liệt kê đối tác tuyển sinh chưa có tài khoản ngân hàng và còn nợ hoa hồng",
      [partnerList], null, [],
    );

    expect(result).toMatchObject({ intentType: "workflow", actionId: "partner.list", values: {
      query_bankAccountFilter: "missing", query_unpaidOnly: true,
    } });
  });
  it("resumes the attendance rate report directly from a short scope clarification", async () => {
    const workflows = ASSISTANT_OPERATIONS.map(operation => defaultWorkflow(operation));
    provider.mockResolvedValue({ text: JSON.stringify({ intentType: "general_question", actionId: null, values: {} }) });
    const history = [
      { role: "user", content: "Tổng hợp giúp tôi tỉ lệ chấm công hôm nay" },
      { role: "assistant", content: "Bạn muốn tính tỷ lệ trên toàn bộ nhân sự hay người có lịch hôm nay?" },
      { role: "user", content: "tôi muốn xem toàn công ty" },
      { role: "assistant", content: "Bạn muốn tra cứu thông tin hay cập nhật dữ liệu nào?" },
    ];

    const result = await interpretRequest("tôi muốn xem toàn công ty", workflows, null, history, "", [], "", [], false, true);

    expect(result).toMatchObject({ intentType: "workflow", actionId: "timekeeping.records.overview" });
    expect(result.values.query_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.values.scope).toBe("company");
    expect(provider).not.toHaveBeenCalled();
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
  it("keeps both HR office and project labor attendance in a cross-module request", async () => {
    const officeAttendance = defaultWorkflow(operationById("hr.daily.overview")!);
    const workerAttendance = defaultWorkflow(operationById("worker.report")!);
    provider.mockResolvedValueOnce({ text: JSON.stringify({
      intentType: "workflow",
      actionId: null,
      actionIntent: "report",
      values: {},
      queryPlan: [
        { actionId: "hr.daily.overview", purpose: "Tình hình nhân sự văn phòng", values: { query_date: "2026-11-27" }, resultFields: ["employeeName", "attendanceStatus"] },
        { actionId: "worker.report", purpose: "Lao động vắng tại Cầu An Bình", values: { projectId: "Cầu An Bình", date: "2026-11-27", mode: "absent" }, resultFields: ["workerName", "projectName", "attendanceStatus"] },
      ],
      requestCoverage: [
        { evidence: "Ở văn phòng ai nghỉ hôm nay", requirement: "Tra cứu nhân sự văn phòng nghỉ hôm nay", mappedTo: ["query:hr.daily.overview:values.query_date", "query:hr.daily.overview:result.employeeName", "query:hr.daily.overview:result.attendanceStatus"] },
        { evidence: "bên công trình Cầu An Bình ai không tới", requirement: "Tra cứu lao động vắng tại công trình Cầu An Bình hôm nay", mappedTo: ["query:worker.report:values.projectId", "query:worker.report:values.date", "query:worker.report:values.mode", "query:worker.report:result.workerName", "query:worker.report:result.attendanceStatus"] },
      ],
    }) });

    const text = "Ở văn phòng ai nghỉ hôm nay, còn bên công trình Cầu An Bình ai không tới?";
    const result = await interpretRequest(text, [officeAttendance, workerAttendance], null, [], "", [], "", [], true);

    expect(result.queryPlan?.map(query => query.actionId), JSON.stringify(result)).toEqual(["hr.daily.overview", "worker.report"]);
  });
  it("plans every source in a labor monthly overview instead of stopping at partner debt", async () => {
    const workflows = ASSISTANT_OPERATIONS.map(defaultWorkflow);
    const result = await interpretRequest(
      "Báo cáo tháng 11/2026 giúp tôi: có bao nhiêu công trình, tổng cộng bao nhiêu lao động, tỷ lệ đi làm trong tháng, hợp đồng nào sắp hết hạn và đối tác nào còn nợ hoa hồng?",
      workflows, null, [],
    );

    expect(result.queryPlan?.map(query => query.actionId), JSON.stringify(result)).toEqual([
      "worker.project.list",
      "worker.list",
      "worker.report",
      "worker.labor.contract.list",
      "worker.partner.settlements.list",
    ]);
    expect(result.queryPlan?.find(query => query.actionId === "worker.report")?.values).toMatchObject({ mode: "all", from: "2026-11-01", to: "2026-11-30" });
    expect(result.queryPlan?.find(query => query.actionId === "worker.partner.settlements.list")?.values.analysis).toContain("balanceAmount");
    expect(result.requestCoverage).toContainEqual(expect.objectContaining({
      evidence: "tháng 11/2026",
      mappedTo: expect.arrayContaining([
        "query:worker.report:values.from",
        "query:worker.report:values.to",
        "query:worker.partner.settlements.list:values.query_periodStart",
        "query:worker.partner.settlements.list:values.query_periodEnd",
      ]),
    }));
    expect(provider).not.toHaveBeenCalled();
  });
  it("plans today's retail cash report alongside monthly product sales and stock", async () => {
    const workflows = ASSISTANT_OPERATIONS.map(defaultWorkflow);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-27T05:00:00.000Z"));
    try {
      const result = await interpretRequest(
        "Hôm nay cửa hàng bán được mấy đơn, thu tiền mặt bao nhiêu; tháng này cáp sạc Gia Bảo bán được mấy cái và trong kho còn bao nhiêu?",
        workflows, null, [],
      );

      expect(result.queryPlan?.map(query => query.actionId), JSON.stringify(result)).toEqual([
        "retail.report.daily.summary",
        "retail.report.summary",
        "retail.order.products.list",
      ]);
      expect(result.queryPlan?.[0].values).toMatchObject({ from: "2026-11-27", to: "2026-11-27" });
      expect(result.queryPlan?.[1].values).toMatchObject({ from: "2026-11-01", to: "2026-11-30" });
      expect(result.queryPlan?.[2].values).toMatchObject({ query_q: "cáp sạc Gia Bảo" });
    } finally {
      vi.useRealTimers();
    }
    expect(provider).not.toHaveBeenCalled();
  });
  it.each([
    ["Mã TEST hiện giảm bao nhiêu phần trăm, đơn tối thiểu bao nhiêu tiền và hết hạn ngày nào?", "retail.coupon.assistant-options.list", { query_code: "TEST" }],
    ["Mức hoa hồng riêng hiện tại của iPhone 14 bản Titan Sa Mạc là bao nhiêu mỗi máy?", "api.get.d9daa6226ed98e83", { query_q: "iPhone 14 Titan Sa Mạc" }],
    ["Kho Trụ sở chính còn bao nhiêu iPhone 15 Pro Max màu Titan Đen 256 GB có thể bán ngay?", "inventory.warehouse.balances.list", { query_warehouseId: "Trụ sở chính", query_q: "iPhone 15 Pro Max Titan Đen 256 GB" }],
    ["Phiếu nhập đã xác nhận gần nhất từ IHONE trong tháng 11/2026 nhập gì và tổng tiền bao nhiêu?", "inventory.receipt.list", { query_q: "IHONE", query_status: "confirmed", query_from: "2026-11-01", query_to: "2026-11-30", query_limit: 100 }],
    ["Có phiếu điều chuyển nào đang đi từ Trụ sở chính sang KHO2A không? Nêu mặt hàng và số lượng.", "inventory.transfer.list", { query_status: "in_transit", query_limit: 100 }],
  ])("routes the POS and inventory read directly: %s", async (text, actionId, values) => {
    const workflows = ASSISTANT_OPERATIONS.map(defaultWorkflow);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-27T05:00:00.000Z"));
    try {
      const result = await interpretRequest(text, workflows, null, []);
      expect(result.actionId).toBe(actionId);
      expect(result.values).toMatchObject(values);
    } finally {
      vi.useRealTimers();
    }
    expect(provider).not.toHaveBeenCalled();
  });
  it("routes a standalone previous-month stock issue count to the scoped stock-log report", async () => {
    const workflows = ASSISTANT_OPERATIONS.map(defaultWorkflow);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-27T05:00:00.000Z"));
    try {
      const result = await interpretRequest(
        "Tháng trước có bao nhiêu phiếu xuất bán hàng và bao nhiêu phiếu xuất dùng nội bộ",
        workflows, null, [],
      );
      expect(result.actionId).toBe("inventory.stock-log.list");
      expect(result.values).toMatchObject({
        createdFrom: "2026-10-01",
        createdTo: "2026-10-31",
        page: 1,
        limit: 1000,
        reportType: "previous-month-issue-counts",
      });
    } finally {
      vi.useRealTimers();
    }
    expect(provider).not.toHaveBeenCalled();
  });
  it("routes a monthly retail commission statement with the named collaborator and exact period", async () => {
    const workflows = ASSISTANT_OPERATIONS.map(defaultWorkflow);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-27T05:00:00.000Z"));
    try {
      const result = await interpretRequest(
        "Cộng tác viên Đinh Viết Tường đã phát sinh, được thanh toán và còn lại bao nhiêu tiền hoa hồng trong tháng 11/2026?",
        workflows, null, [],
      );
      const statement = ASSISTANT_OPERATIONS.find(operation => operation.path === "/retail/finance/commission/partners/:id/statement")!;
      expect(result.actionId).toBe(statement.id);
      expect(result.values).toMatchObject({ path_id: "Đinh Viết Tường", from: "2026-11-01", to: "2026-11-30" });
    } finally {
      vi.useRealTimers();
    }
    expect(provider).not.toHaveBeenCalled();
  });
  it("plans a mixed retail, stock and returns overview with each requested date range", async () => {
    const workflows = ASSISTANT_OPERATIONS.map(defaultWorkflow);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-27T05:00:00.000Z"));
    try {
      const result = await interpretRequest(
        "Tóm tắt nhanh tình hình kinh doanh tháng 11 giúp tôi: doanh thu, lãi gộp, đơn hủy/trả hàng, khách còn nợ và tiền hoa hồng CTV, Trong 30 ngày qua có những dòng máy nào bán ế không xuất được cái nào mà trong kho vẫn tồn nhiều, Dòng Redmi Note 14 gần đây đã xuất cho những ai hoặc bộ phận nào, Tháng trước có bao nhiêu phiếu xuất bán hàng và bao nhiêu phiếu xuất dùng nội bộ",
        workflows, null, [],
      );

      expect(result.queryPlan?.map(query => query.actionId), JSON.stringify(result)).toEqual([
        "retail.report.summary",
        "retail.order.list",
        "retail.after-sale.list",
        "api.get.78da159ec226e07e",
        "retail.report.daily.summary",
        "retail.order.products.list",
        "inventory.stock-log.list",
      ]);
      expect(result.queryPlan?.find(query => query.actionId === "retail.report.summary")?.values).toMatchObject({ from: "2026-11-01", to: "2026-11-30" });
      expect(result.queryPlan?.find(query => query.actionId === "retail.after-sale.list")?.values).toMatchObject({ query_type: "return", from: "2026-11-01", to: "2026-11-30" });
      expect(result.queryPlan?.find(query => query.actionId === "retail.report.daily.summary")?.values).toMatchObject({ from: "2026-10-29", to: "2026-11-27" });
      expect(result.queryPlan?.find(query => query.actionId === "inventory.stock-log.list")?.values).toMatchObject({ createdFrom: "2026-10-01", createdTo: "2026-11-27", limit: 1000 });
      expect(result.queryPlan?.find(query => query.actionId === "api.get.78da159ec226e07e")?.values.analysis).toContain('"operation":"sum"');
      expect(provider).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
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
  it("retries the authorized workflows when module discovery picks an incompatible workflow", async () => {
    const employeeList = defaultWorkflow(operationById("employee.list")!);
    const studentList = defaultWorkflow(operationById("student.list")!);
    provider.mockResolvedValueOnce({ text: JSON.stringify({ modules: ["student"] }) });
    provider.mockResolvedValueOnce({ text: JSON.stringify({
      actionId: studentList.actionId,
      intentType: "workflow",
      values: {},
      requestCoverage: [{ evidence: "Trong nhân sự", requirement: "Phân hệ nhân sự", mappedTo: ["context.module"] }],
    }) });
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: employeeList.actionId, intentType: "workflow", values: {} }) });

    const result = await interpretRequest("Trong nhân sự, tìm Lan", [employeeList, studentList], null, []);

    expect(result.actionId).toBe(employeeList.actionId);
    expect(provider).toHaveBeenCalledTimes(3);
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
    expect(result.values).toEqual({ title: "Họp tuần" });
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
    provider.mockResolvedValue({ text: JSON.stringify({ actionId: employee.actionId, values: {}, remainingRequests: ["Tạo việc bàn giao"], newRequest: false }) });
    const result = await interpretRequest("Chuyển Lan và tạo việc bàn giao", [employee], null, []);
    expect(result.remainingRequests).toEqual(["Tạo việc bàn giao"]);
    await interpretRequest("tiếp tục", [employee], null, [{role:"assistant", content:"Đã cập nhật Lan"}], "", [], JSON.stringify(result.remainingRequests));
    expect(JSON.stringify(provider.mock.calls[1][0])).toContain("Tạo việc bàn giao");
  });
  it("does not let a keyword override cancellation or clarification", async () => {
    provider.mockResolvedValue({ text: JSON.stringify({ actionId: null, values: {}, cancel: true, intentType: "ambiguous", clarification: "Bạn muốn chuyển Lan nào?" }) });
    expect(await interpretRequest("Không chuyển nhân viên Lan nữa", [employee], null, [])).toMatchObject({actionId:null,cancel:true});
  });
  it("discovers new tools from the authorized catalog without a twelve-tool cutoff", async () => {
    const workflows = Array.from({length:121}, (_, i) => ({...employee, actionId:`custom.${i}`, module:"custom"}));
    provider.mockResolvedValueOnce({text:JSON.stringify({modules:["custom"]})});
    provider.mockResolvedValueOnce({text:JSON.stringify({actionId:"custom.120", values:{}, intentType:"workflow"})});
    expect((await interpretRequest("chức năng mới", workflows, null, [])).actionId).toBe("custom.120");
  });
  it.each(['{"modules":["employee","department"]}', 'not json', '{"modules":["hr","unknown"]}', '{"modules":null}'])("recovers from invalid discovery without losing authorized tools: %s", async discovery => {
    const create = defaultWorkflow(operationById("employee.create")!);
    const workflows = [create, ...Array.from({length:120}, (_, i) => ({...employee, actionId:`custom.${i}`}))];
    provider.mockResolvedValueOnce({text:discovery});
    provider.mockResolvedValueOnce({text:JSON.stringify({actionId:create.actionId, values:{displayName:"Hoàng Tài",department:"công nghệ thông tin"}, intentType:"workflow"})});
    const result = await interpretRequest("thêm cho tôi nhân sự tên là Hoàng Tài, thuộc phòng công nghệ thông tin", workflows, null, []);
    expect(result.actionId).toBe("employee.create");
    expect(result.values.displayName).toBe("Hoàng Tài");
    expect(provider).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(provider.mock.calls[1][0].messages)).toContain("custom.119");
  });
  it("retains the permission boundary after discovery fails", async () => {
    const workflows = Array.from({length:121}, (_, i) => ({...employee, actionId:`custom.${i}`}));
    provider.mockRejectedValueOnce(new Error("Discovery unavailable"));
    provider.mockResolvedValueOnce({text:JSON.stringify({actionId:"employee.create",values:{},intentType:"workflow"})});
    await expect(interpretRequest("thêm nhân sự", workflows, null, [])).rejects.toThrow("ngoài danh mục");
  });
  it("routes unsupported POS reports to allow-listed retail data", async () => {
    const workflows = [
      "retail.report.summary", "retail.report.top-products", "retail.report.daily-extremes",
      "retail.report.category-brand-summary", "retail.report.export", "retail.order.top-value", "retail.order.top-customers", "retail.order.top-customers.completed", "retail.invoice.bulk-pdf",
      "retail.order.payment-qr", "customer.tier.counts", "customer.upcoming-birthdays",
      "retail.order.discount-anomalies",
    ].map(id => defaultWorkflow(operationById(id)!));
    const cashier = await interpretRequest("Tháng này nhân viên thu ngân nào bán được doanh số cao nhất?", workflows, null, []);
    expect(cashier).toMatchObject({ actionId: "retail.report.summary", values: { from: expect.any(String), to: expect.any(String) } });

    const topProducts = await interpretRequest("Top 10 mặt hàng bán chạy nhất tháng này là những món nào?", workflows, null, []);
    expect(topProducts).toMatchObject({ actionId: "retail.report.top-products", values: { topN: 10, from: expect.any(String), to: expect.any(String) } });

    const dailyExtremes = await interpretRequest("30 ngày gần nhất ngày nào cửa hàng bán được nhiều tiền nhất, ngày nào vắng nhất?", workflows, null, []);
    expect(dailyExtremes).toMatchObject({ actionId: "retail.report.daily-extremes", values: { from: expect.any(String), to: expect.any(String) } });

    const topOrder = await interpretRequest("Đơn hàng giá trị lớn nhất trong tháng vừa rồi là đơn nào, của khách nào?", workflows, null, []);
    expect(topOrder).toMatchObject({ actionId: "retail.order.top-value", values: { query_from: expect.any(String), query_to: expect.any(String) } });

    const topCustomers = await interpretRequest("Top khách hàng mua nhiều tiền nhất của cửa hàng trong tháng này là ai?", workflows, null, []);
    expect(topCustomers).toMatchObject({ actionId: "retail.order.top-customers", values: { query_from: expect.any(String), query_to: expect.any(String), topN: 10 } });

    const completedTopCustomers = await interpretRequest("Trong tháng này, xếp khách hàng theo tổng tiền đơn hoàn tất sau khi trừ hoàn tiền.", workflows, null, []);
    expect(completedTopCustomers).toMatchObject({ actionId: "retail.order.top-customers.completed", values: { query_from: expect.any(String), query_to: expect.any(String), topN: 10 } });

    const categoryBrand = await interpretRequest("Nhóm hàng / thương hiệu nào đang đóng góp doanh thu cao nhất tháng này?", workflows, null, []);
    expect(categoryBrand).toMatchObject({ actionId: "retail.report.category-brand-summary", values: { from: expect.any(String), to: expect.any(String) } });

    const excel = await interpretRequest("Xuất giúp tôi file Excel báo cáo doanh thu và lợi nhuận bán lẻ tháng 11 này", workflows, null, []);
    expect(excel).toMatchObject({ actionId: "retail.report.export", values: { from: expect.stringMatching(/^\d{4}-11-01$/), to: expect.stringMatching(/^\d{4}-11-\d{2}$/) } });

    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit" }).formatToParts(new Date());
    const currentYear = Number(parts.find(part => part.type === "year")?.value);
    const lastDayOfNovember = new Date(Date.UTC(currentYear, 11, 0)).getUTCDate();
    const pdf = await interpretRequest("Xuất giúp tôi file PDF các hóa đơn bán hàng tháng 11 này để gửi kế toán", workflows, null, []);
    expect(pdf).toMatchObject({ actionId: "retail.invoice.bulk-pdf", values: { status: "issued", limit: 500, from: `${currentYear}-11-01`, to: `${currentYear}-11-${String(lastDayOfNovember).padStart(2, "0")}` } });

    const tiers = await interpretRequest("Cửa hàng hiện có bao nhiêu khách hàng hạng Bạc, hạng Vàng và hạng VIP?", workflows, null, []);
    expect(tiers.actionId).toBe("customer.tier.counts");

    const birthdays = await interpretRequest("Tháng này có những khách hàng nào sắp đến sinh nhật để cửa hàng gửi ưu đãi?", workflows, null, []);
    const currentDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
    const [year, month] = currentDate.split("-").map(Number);
    const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    expect(birthdays).toMatchObject({ actionId: "customer.upcoming-birthdays", values: { from: expect.any(String), to: `${year}-${String(month).padStart(2, "0")}-${String(lastDayOfMonth).padStart(2, "0")}` } });
  });
  it("routes IMEI stock rankings to the serial stock summary", async () => {
    const workflow = defaultWorkflow(operationById("inventory.serial.stock-ranking")!);
    const result = await interpretRequest("Dòng máy nào đang có số lượng IMEI tồn trong kho nhiều nhất", [workflow], null, []);

    expect(result).toMatchObject({ actionId: "inventory.serial.stock-ranking", values: {} });
  });
  it.each([
    ["retail.shift.variance-report", "Gần đây có ca nào đóng ca bị hụt tiền hoặc lệch tiền không?", "Xem 30 ngày gần đây, chỉ các ca đã đóng ở chi nhánh hiện tại, kèm tiền dự kiến, tiền thực đếm và chênh lệch."],
    ["retail.order.discount-anomalies", "Trong tuần này có đơn nào được giảm giá hoặc chiết khấu cao bất thường không?", "Chi nhánh hiện tại; coi mức giảm từ 20% trở lên là cao bất thường, liệt kê đơn và mức giảm nếu dữ liệu có hỗ trợ."],
    ["retail.after-sale.customer-return-summary", "Tháng này có bao nhiêu khách mang hàng đến trả hoặc đổi? Cửa hàng phải hoàn lại bao nhiêu tiền?", "Tháng 11/2026, đếm khách riêng biệt có phiếu đổi trả hoàn tất và cộng tổng tiền hoàn."],
    ["retail.warranty.status-counts", "Hiện cửa hàng đang có bao nhiêu sản phẩm còn trong thời hạn bảo hành và bao nhiêu đã hết hạn?", "Đếm trực tiếp toàn bộ thiết bị đã bán ở chi nhánh hiện tại, chia số còn hạn và đã hết hạn; không cần danh sách từng máy."],
    ["retail.report.business-overview", "Tóm tắt nhanh tình hình kinh doanh tháng 11 giúp tôi: doanh thu, lãi gộp, đơn hủy/trả hàng, khách còn nợ và tiền hoa hồng CTV", "Dùng tháng 11/2026 và chi nhánh hiện tại; tổng hợp đủ doanh thu, lãi gộp, đơn hủy/trả, công nợ khách và hoa hồng CTV."],
    ["retail.partner.supplier-dealer-directory", "Liệt kê danh sách các nhà cung cấp và đại lý đang hợp tác với cửa hàng kèm số điện thoại", "Lấy cả nhà cung cấp và đại lý, bỏ cộng tác viên; chỉ cần tên và số điện thoại."],
    ["retail.order.invoice-debt-exceptions", "Kiểm tra xem có đơn hàng nào đã hoàn tất nhưng chưa xuất hóa đơn hoặc khách vẫn còn thiếu tiền không?", "Ở chi nhánh hiện tại, liệt kê đơn đã hoàn tất nếu chưa có hóa đơn hoặc còn công nợ; kèm mã đơn, khách và số tiền còn thiếu."],
  ])("keeps the retail goal through clarification and routes the clarified request: %s", async (actionId, original, answer) => {
    const workflow = defaultWorkflow(operationById(actionId)!);
    const result = await interpretRequest(answer, [workflow], null, [
      { role: "user", content: original },
      { role: "assistant", content: "Bạn vui lòng làm rõ kỳ, chi nhánh hoặc tiêu chí cần xem nhé?" },
    ], "", [], "", [], false, true);
    expect(result.actionId).toBe(actionId);
    expect(result.intentType).toBe("workflow");
  });
  it("asks for an order code before generating a remaining-balance QR and resumes the same request", async () => {
    const workflow = defaultWorkflow(operationById("retail.order.payment-qr")!);
    const first = await interpretRequest("Lấy mã QR chuyển khoản để gửi khách thanh toán khoản nợ còn lại", [workflow], null, []);
    expect(first).toMatchObject({ actionId: null, intentType: "ambiguous" });
    const continued = await interpretRequest("Mã đơn hàng DH-RETAIL-0001", [workflow], null, [
      { role: "user", content: "Lấy mã QR chuyển khoản để gửi khách thanh toán khoản nợ còn lại" },
      { role: "assistant", content: first.clarification || "Bạn gửi mã đơn hàng nhé?" },
    ], "", [], "", [], false, true);
    expect(continued).toMatchObject({ actionId: "retail.order.payment-qr", values: { path_id: "DH-RETAIL-0001" } });
  });
});
