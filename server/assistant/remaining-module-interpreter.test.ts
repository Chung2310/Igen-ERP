import { beforeEach, expect, it, vi } from "vitest";
import { ASSISTANT_OPERATIONS, defaultWorkflow, operationById } from "./catalog";
import { interpretRequest } from "./interpreter";
import { missingReferencePrompts } from "./service";
import { resolveModuleAccess } from "../middleware/require-module";

const provider = vi.hoisted(() => vi.fn().mockResolvedValue({ text: JSON.stringify({ actionId: null, values: {} }) }));
vi.mock("../service/openrouter.service", () => ({ openrouterChat: provider }));
beforeEach(() => provider.mockReset().mockResolvedValue({ text: JSON.stringify({ actionId: null, values: {} }) }));

const cases = [
  ["inventory", "Danh sách phiếu nhập kho", "inventory.receipt.list"],
  ["resource", "Danh sách tài nguyên", "resource.list"],
  ["chat", "Danh sách phòng trò chuyện", "chat.rooms.list"],
  ["customer", "Danh sách khách hàng", "customer.list"],
  ["student-partner", "Danh sách đối tác giới thiệu", "partner.list"],
  ["retail", "Danh sách đơn bán lẻ", "retail.order.list"],
  ["repair", "Danh sách phiếu sửa chữa", "repair.list"],
  ["finance", "Danh sách khoản phải thu", "finance.receivable.list"],
  ["marketing", "Danh sách chiến dịch email lễ tết", "marketing.holiday-campaign.list"],
  ["social-marketing", "Danh sách chiến dịch marketing", "marketing.campaign.list"],
  ["omni-inbox", "Danh sách hội thoại Facebook gần đây", "omni-inbox.facebook-conversations.list"],
  ["company-knowledge", "Danh sách tài liệu kho tri thức doanh nghiệp", "company-knowledge.documents.list"],
  ["labor-partner", "Danh sách đối tác cung ứng lao động", "worker.partner.list"],
  ["retail-partner", "Danh sách đối tác bán lẻ", "retail.partner.list"],
] as const;

it.each(cases)("routes a plain-language collection request in the %s module: %s", async (module, text, actionId) => {
  const workflows = ASSISTANT_OPERATIONS.filter(operation => operation.module === module).map(defaultWorkflow);
  const result = await interpretRequest(text, workflows, null, []);
  expect(result.actionId).toBe(actionId);
  expect(result.values).toEqual({});

  const searchResult = await interpretRequest(text.replace(/^Danh sách/, "Tìm kiếm"), workflows, null, []);
  expect(searchResult.actionId).toBe(actionId);
});

it("does not turn a filtered list request into an unfiltered lookup", async () => {
  const workflows = ASSISTANT_OPERATIONS.filter(operation => operation.module === "customer").map(defaultWorkflow);
  const result = await interpretRequest("Danh sách khách hàng trạng thái ngừng hoạt động", workflows, null, []);
  expect(result.actionId).toBeNull();
});

it.each([
  ["Tìm khách hàng theo số điện thoại 0900000000", "0900000000"],
  ["Tìm đúng khách hàng La Văn Sến", "La Văn Sến"],
  ["Tra cứu khách hàng theo tên La Văn Sến", "La Văn Sến"],
  ["Tìm khách hàng theo mã KH-AUDIT-001", "KH-AUDIT-001"],
])("keeps a customer search term in the supported query field: %s", async (text, search) => {
  provider.mockClear();
  const workflows = ASSISTANT_OPERATIONS.filter(operation => operation.module === "customer").map(defaultWorkflow);
  const result = await interpretRequest(text, workflows, null, []);

  expect(result).toMatchObject({ actionId: "customer.list", values: { query_q: search }, intentType: "workflow" });
  expect(provider).not.toHaveBeenCalled();
});

it("understands that bổ sung thông tin for a customer edits the existing profile", async () => {
  provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: null, values: { path_id: "La Văn Sến", address: "12 Đường Mới" } }) });
  const workflows = ASSISTANT_OPERATIONS.filter(operation => operation.module === "customer").map(defaultWorkflow);

  const result = await interpretRequest("Bổ sung thông tin cho khách hàng La Văn Sến, địa chỉ 12 Đường Mới", workflows, null, []);

  expect(result).toMatchObject({ actionId: "customer.update", values: { path_id: "La Văn Sến", address: "12 Đường Mới" } });
  const selectedWorkflows = provider.mock.calls.at(-1)?.[0].messages[0].content as string;
  expect(selectedWorkflows).toContain("customer.update");
  expect(selectedWorkflows).not.toContain("customer.create");
});

it("classifies a clear ERP request outside the available workflows as unsupported without returning executable values", async () => {
  provider.mockResolvedValueOnce({ text: JSON.stringify({
    intentType: "unsupported", actionId: null, values: { customerName: "La Văn Sến" }, unsupportedModule: "customer",
  }) });
  const workflows = ASSISTANT_OPERATIONS.filter(operation => operation.module === "customer").map(defaultWorkflow);

  const result = await interpretRequest("Phân tích doanh thu theo nhóm khách hàng", workflows, null, []);

  expect(result).toMatchObject({ actionId: null, values: {}, intentType: "unsupported", unsupportedModule: "customer" });
  const prompt = provider.mock.calls.at(-1)?.[0].messages[0].content as string;
  expect(prompt).toContain("intentType=unsupported");
  expect(prompt).toContain('"customer"');
});

it("ignores an unsupported module outside the user's available module list", async () => {
  provider.mockResolvedValueOnce({ text: JSON.stringify({
    intentType: "unsupported", actionId: null, values: {}, unsupportedModule: "finance",
  }) });
  const workflows = ASSISTANT_OPERATIONS.filter(operation => operation.module === "customer").map(defaultWorkflow);

  const result = await interpretRequest("Phân tích doanh thu theo nhóm khách hàng", workflows, null, []);

  expect(result).toMatchObject({ actionId: null, intentType: "unsupported" });
  expect(result.unsupportedModule).toBeUndefined();
});

it.each([
  ["social-marketing", "Xem thông tin nội dung marketing đã lưu", "marketing.content.detail"],
  ["finance", "Xem thông tin tài sản cố định", "finance.asset.detail"],
] as const)("routes a request for one saved record to its detail view: %s / %s", async (module, text, actionId) => {
  const workflows = ASSISTANT_OPERATIONS.filter(operation => operation.module === module).map(defaultWorkflow);
  const result = await interpretRequest(text, workflows, null, []);

  expect(result.actionId).toBe(actionId);
  expect(provider).not.toHaveBeenCalled();
});

it.each([
  ["Tạo phiếu thu hoặc chi tài chính", "finance.voucher.create"],
  ["Tạo phiếu thu từ quỹ tiền mặt", "finance.treasury.vouchers.create"],
] as const)("distinguishes a normal finance voucher from a treasury voucher: %s", async (text, actionId) => {
  provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: null, values: {} }) });
  const workflows = ASSISTANT_OPERATIONS.filter(operation => operation.module === "finance").map(defaultWorkflow);

  const result = await interpretRequest(text, workflows, null, []);

  expect(result.actionId).toBe(actionId);
});

it("uses business descriptions and field labels when narrowing a large workflow catalog", async () => {
  provider.mockReset();
  provider
    .mockResolvedValueOnce({ text: JSON.stringify({ actionIds: ["customer.list"] }) })
    .mockResolvedValueOnce({ text: JSON.stringify({ intentType: "workflow", actionId: "customer.list", values: { query_q: "Nguyễn An" } }) });
  const workflows = ASSISTANT_OPERATIONS.map(defaultWorkflow);

  const result = await interpretRequest("Tìm hồ sơ khách hàng Nguyễn An", workflows, null, []);

  expect(result.actionId).toBe("customer.list");
  expect(result.values).toMatchObject({ query_q: "Nguyễn An" });
  const shortlistPrompt = provider.mock.calls[0][0].messages[0].content as string;
  expect(shortlistPrompt).toContain("description");
  expect(shortlistPrompt).toContain("Tên khách hàng");
  expect(shortlistPrompt).toContain("Số điện thoại");
});

it("requires every writable action to confirm and every no-confirmation POST to be read-only", () => {
  for (const operation of ASSISTANT_OPERATIONS) {
    if (operation.method === "GET" || operation.readOnly) continue;
    expect(operation.confirmation, operation.id).toBe(true);
  }

  for (const id of [
    "company-email.celebration.preview",
    "inventory.reconciliation.run",
    "repair.device.lookup",
    "retail.order.quote",
    "marketing.tiktok.creator-info",
    "marketing.tiktok-business.creator-info",
    "student.bulk.preview",
    "student.bulk.delete.preview",
    "marketing.video-caption.drive-videos.list",
  ]) {
    expect(operationById(id)?.readOnly, id).toBe(true);
  }
});

it("gives every supported lookup approved display fields and resolvable selection references", () => {
  for (const operation of ASSISTANT_OPERATIONS) {
    if (operation.method === "GET") expect(operation.resultFields.length, operation.id).toBeGreaterThan(0);
    for (const field of operation.fields) {
      if (field.reference) expect(operationById(field.reference), `${operation.id}.${field.key}`).toBeDefined();
    }
    for (const childKey of Object.keys(operation.resultChildFields || {})) {
      expect(operation.resultFields, `${operation.id}.${childKey}`).toContain(childKey);
    }
  }
});

it("keeps field prompts in plain Vietnamese and makes record paths selectable", () => {
  const rawLabels = ASSISTANT_OPERATIONS.flatMap(operation => operation.fields
    .filter(field => /^[a-z][a-z0-9_]*$/.test(field.label))
    .map(field => `${operation.id}.${field.key}: ${field.label}`));
  const duplicatedLabels = ASSISTANT_OPERATIONS.flatMap(operation => operation.fields
    .filter(field => /^Tên hoặc mã Tên(?:\s|,)/.test(field.label))
    .map(field => `${operation.id}.${field.key}: ${field.label}`));
  expect(rawLabels).toEqual([]);
  expect(duplicatedLabels).toEqual([]);

  const referenceFor = (path: string, method: string, key: string) => ASSISTANT_OPERATIONS
    .find(operation => operation.path === path && operation.method === method)?.fields
    .find(field => field.source === "path" && field.apiKey === key)?.reference;
  expect(referenceFor("/inventory/counts/:id/start", "POST", "id")).toBe("inventory.count.list");
  expect(referenceFor("/repair/tickets/:id/status", "POST", "id")).toBe("repair.list");
  expect(referenceFor("/resources/:id/rename", "PATCH", "id")).toBe("resource.list");
  expect(referenceFor("/order-sheets/integrations/:integrationId/leads", "PUT", "integrationId")).toBe("omni-inbox.account.list");
  expect(referenceFor("/order-sheets/integrations/:integrationId/leads/test", "POST", "integrationId")).toBe("omni-inbox.account.list");
});

it("keeps write actions confirmable and reference fields resolvable across the remaining modules", () => {
  const modules = new Set<string>(cases.map(([module]) => module));
  const operations = ASSISTANT_OPERATIONS.filter(operation => modules.has(operation.module));
  for (const operation of operations) {
    const workflow = defaultWorkflow(operation);
    if (operation.confirmation) expect(workflow.requireConfirmation, operation.id).toBe(true);
    expect(workflow.confirmationLocked, operation.id).toBe(Boolean(operation.confirmation));
    for (const field of operation.fields) {
      if (field.reference) expect(operationById(field.reference), `${operation.id}.${field.key}`).toBeDefined();
    }
    expect(operation.resultFields, operation.id).not.toContain("password");
    expect(operation.resultFields, operation.id).not.toContain("accessToken");
    expect(operation.resultFields, operation.id).not.toContain("refreshToken");
  }
});

it("assigns each partner workflow to the module that protects its API route", () => {
  const partnerModules = [
    ["partner.list", "student-partner"],
    ["worker.partner.list", "labor-partner"],
    ["retail.partner.list", "retail-partner"],
  ] as const;
  for (const [actionId, module] of partnerModules) {
    const operation = operationById(actionId);
    expect(operation?.module, actionId).toBe(module);
    expect(resolveModuleAccess({ role: "admin", companyCode: "TEST" }, module, [module], true, "education"), actionId).toBe(true);
  }
});

it("offers inventory receipt references as selectable chat choices", async () => {
  const operation = operationById("inventory.receipt.create")!;
  const req = { user: { role: "user", companyCode: "TEST", branchId: "branch-1" } } as never;
  const suggest = async (_req: unknown, _operation: unknown, field: { reference?: string }) => field.reference === "branch.list"
    ? ["Chi nhánh Hà Nội"]
    : field.reference === "inventory.supplier.list" ? ["Công ty Thiết bị ABC"]
      : field.reference === "inventory.warehouse.locations.list" ? ["Kho trung tâm"]
        : field.reference === "product.list" ? ["Máy chiếu 001"]
          : field.reference === "inventory.product.detail" ? ["MAYCHIEU001"] : [];
  const initial = await missingReferencePrompts(
    req,
    operation,
    defaultWorkflow(operation),
    {},
    "Tạo phiếu nhập kho",
    new Set(),
    suggest,
  );
  expect(initial.referenceSelections).toEqual(expect.arrayContaining([
    expect.objectContaining({ key: "targetBranch", options: [{ label: "Chi nhánh Hà Nội", value: "Chi nhánh Hà Nội" }] }),
    expect.objectContaining({ key: "supplierId", options: [{ label: "Công ty Thiết bị ABC", value: "Công ty Thiết bị ABC" }] }),
  ]));
  expect(initial.referenceSelections.some(selection => selection.key === "warehouseId")).toBe(false);

  const response = await missingReferencePrompts(
    req,
    operation,
    defaultWorkflow(operation),
    { targetBranch: "branch-1", supplierId: "supplier-1" },
    "Tạo phiếu nhập kho",
    new Set(),
    suggest,
  );
  expect(response.referenceSelections).toContainEqual(expect.objectContaining({
    key: "warehouseId",
    required: false,
    options: [{ label: "Kho trung tâm", value: "Kho trung tâm" }],
  }));
  expect(response.referenceSelections).toContainEqual(expect.objectContaining({
    key: "items[1].productId",
    options: [{ label: "Máy chiếu 001", value: "Máy chiếu 001" }],
  }));
});

it("asks the user to select a connected account before retrying Google Sheets lead sync", async () => {
  const operation = operationById("omni-inbox.lead-sheet.retry")!;
  expect(operation.confirmation).toBe(true);
  const response = await missingReferencePrompts(
    { user: { role: "user", companyCode: "TEST" } } as never,
    operation,
    defaultWorkflow(operation),
    {},
    "Thử đồng bộ lại khách hàng tiềm năng",
    new Set(),
    async (_req, _operation, field) => field.reference === "omni-inbox.account.list"
      ? ["Trang Facebook - Cửa hàng Hà Nội"]
      : [],
  );
  expect(response.referenceSelections).toContainEqual(expect.objectContaining({
    key: "path_integrationId",
    label: "Tài khoản nhắn tin cần đồng bộ lại",
    required: true,
    options: [{ label: "Trang Facebook - Cửa hàng Hà Nội", value: "Trang Facebook - Cửa hàng Hà Nội" }],
  }));
});

it("offers lead, student, patient, and worker choices before linking CRM records", async () => {
  for (const [id, targetReference, targetLabel] of [
    ["omni-inbox.leads.link-student", "student.list", "Học viên cần liên kết"],
    ["omni-inbox.leads.link-patient", "healthcare.patient.list", "Bệnh nhân cần liên kết"],
    ["omni-inbox.leads.link-worker", "worker.list", "Người lao động cần liên kết"],
  ] as const) {
    const operation = operationById(id)!;
    expect(operation.module).toBe("omni-inbox");
    expect(operation.confirmation).toBe(true);
    expect(operation.fields.find(field => field.key === "path_id")?.reference).toBe("omni-inbox.leads.list");
    expect(operation.fields.find(field => field.key === "targetRecordId")?.reference).toBe(targetReference);
    const response = await missingReferencePrompts(
      { user: { role: "admin", companyCode: "TEST" } } as never,
      operation,
      defaultWorkflow(operation),
      {},
      operation.title,
      new Set(),
      async (_req, _operation, field) => field.reference === "omni-inbox.leads.list"
        ? ["La Văn Sến — 0987217127"]
        : [targetLabel],
    );
    expect(response.referenceSelections.map(selection => selection.key)).toEqual(["path_id", "targetRecordId"]);
    expect(response.referenceSelections.map(selection => selection.options[0]?.label)).toContain("La Văn Sến — 0987217127");
    expect(response.referenceSelections.map(selection => selection.label)).toContain(targetLabel);
  }

  const exportOperation = operationById("omni-inbox.leads.export-google-sheets")!;
  expect(exportOperation.module).toBe("omni-inbox");
  expect(exportOperation.confirmation).toBe(true);
  expect(exportOperation.fields.find(field => field.key === "ids")?.structure?.items?.reference).toBe("omni-inbox.leads.list");
});

it.each([
  ["/analytics/revenue", "Xem báo cáo doanh thu"],
  ["/analytics/expenses", "Xem báo cáo chi phí"],
  ["/analytics/pnl", "Xem báo cáo lãi lỗ"],
  ["/marketing-settings/lead-intake-profiles", "Xem cài đặt tiếp nhận khách hàng tiềm năng"],
  ["/marketing-settings/chat-flows/:pageId", "Xem quy trình trả lời tự động trên Trang Facebook"],
  ["/retail/partners/collaborators", "Xem danh sách cộng tác viên bán lẻ"],
] as const)("uses a business-friendly label for %s", (path, title) => {
  expect(ASSISTANT_OPERATIONS.find(operation => operation.path === path)?.title).toBe(title);
});

it("does not expose camel-case API field names as user-facing labels", () => {
  const machineLabels = ASSISTANT_OPERATIONS.flatMap(operation => operation.fields
    .filter(field => field.label === field.apiKey && /[a-z][A-Z]/.test(field.apiKey))
    .map(field => `${operation.id}.${field.apiKey}`));
  expect(machineLabels).toEqual([]);
});
