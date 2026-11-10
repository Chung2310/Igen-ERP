import { afterEach, expect, it, vi } from "vitest";
vi.mock("./workflows", async () => {
  const { operationById } = await import("./catalog");
  return { assertOperation: vi.fn((_req, id: string) => operationById(id)), actorScope: () => ({ userId: "actor", companyCode: "TEST" }) };
});
import { ASSISTANT_OPERATIONS, defaultWorkflow } from "./catalog";
import { callOperation, lookupRecords, projectRecords, resolveReferences, suggestReferenceOptions, UncertainExecutionError } from "./executor";
import { formatAssistantResult } from "./result-format";
import { redactAssistantResult } from "./structured-data";
const req = { user: { id: "actor", companyCode: "TEST", branchId: "507f1f77bcf86cd799439012" }, headers: { authorization: "Bearer scoped", host: "attacker.invalid" }, socket: { localPort: 4050, localAddress: "127.0.0.1" } } as any;
afterEach(() => vi.unstubAllGlobals());
it("sends customer notes as additions so existing profile notes are preserved", async () => {
  const customerId = "507f1f77bcf86cd7994390a1";
  const fetcher = vi.fn(async (_url: URL, _init?: RequestInit) => new Response(JSON.stringify({ success: true, data: { _id: customerId, name: "An", phone: "0901234567", version: 5 } }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "customer.update")!;
  await callOperation(req, operation, { path_id: customerId, notes: "Ngân sách: 50 triệu", version: 4 } as any);
  expect(new URL(String(fetcher.mock.calls[0][0])).pathname).toBe(`/api/v1/customers/${customerId}`);
  const body = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
  expect(body).toMatchObject({ additionalNotes: "Ngân sách: 50 triệu", version: 4 });
  expect(body).not.toHaveProperty("notes");
});
it("creates a confirmed work process with server-owned creator and step identifiers", async () => {
  const fetcher = vi.fn(async (input: URL, init?: RequestInit) => new Response(JSON.stringify({
    status: "success",
    data: { _id: "507f1f77bcf86cd7994390f1", name: "Onboarding", category: "Nhân sự", steps: [] },
  }), { status: 201 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "hr.workflow.create")!;
  expect(operation).toMatchObject({ title: "Tạo quy trình làm việc", confirmation: true, permissions: ["hr:manage"] });

  await callOperation(req, operation, {
    name: "Onboarding",
    category: "Nhân sự",
    description: "Đón nhận và hướng dẫn nhân sự mới",
    steps: JSON.stringify([{ title: "Chuẩn bị hồ sơ" }, { title: "Bàn giao thiết bị", estDays: 2 }]),
  } as any);

  const [url, init] = fetcher.mock.calls[0];
  expect((url as URL).pathname).toBe("/api/v1/crud/workflows");
  expect((url as URL).searchParams.get("companyCode")).toBe("TEST");
  const body = JSON.parse(String(init?.body));
  expect(body).toMatchObject({
    name: "Onboarding",
    category: "Nhân sự",
    description: "Đón nhận và hướng dẫn nhân sự mới",
    creatorUid: "actor",
  });
  expect(body.steps).toHaveLength(2);
  expect(body.steps.map((step: any) => step.title)).toEqual(["Chuẩn bị hồ sơ", "Bàn giao thiết bị"]);
  expect(body.steps.every((step: any) => typeof step.id === "string" && step.id.length > 0)).toBe(true);
  expect(new Set(body.steps.map((step: any) => step.id)).size).toBe(2);
  expect(body.steps.map((step: any) => step.position)).toEqual([{ x: 0, y: 0 }, { x: 220, y: 0 }]);
  expect(body.steps.map((step: any) => step.estDays)).toEqual([1, 2]);
  expect(body).not.toHaveProperty("branchId");
});

it("keeps coupon audience choice inside the assistant while sending the selected customer scope", async () => {
  const fetcher = vi.fn(async (_input: URL, _init?: RequestInit) => new Response(JSON.stringify({ success: true, data: { code: "SALE10" } }), { status: 201 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "retail.coupon.create")!;
  const common = {
    targetBranch: req.user.branchId,
    code: "SALE10",
    name: "Ưu đãi tháng 11",
    discountType: "amount",
    value: 10000,
    startsAt: "2026-11-05T00:00:00.000Z",
    endsAt: "2026-11-30T23:59:00.000Z",
    active: true,
    minSubtotal: 0,
  };

  await callOperation(req, operation, { ...common, targetType: "all_customers" } as any);
  const allCustomersBody = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body));
  expect(allCustomersBody).not.toHaveProperty("targetType");
  expect(allCustomersBody).not.toHaveProperty("customerId");

  await callOperation(req, operation, { ...common, targetType: "specific_customer", customerId: "507f1f77bcf86cd799439431" } as any);
  const specificCustomerBody = JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body));
  expect(specificCustomerBody).not.toHaveProperty("targetType");
  expect(specificCustomerBody.customerId).toBe("507f1f77bcf86cd799439431");
});

it("passes assistant search and filters through to the matching list APIs", async () => {
  const fetcher = vi.fn(async (_input: URL, _init?: RequestInit) => new Response(JSON.stringify({ status: "success", success: true, data: [] }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);

  const projectList = ASSISTANT_OPERATIONS.find(item => item.id === "project.list")!;
  await callOperation(req, projectList, { search: "Khởi tạo dự án", status: "in_progress", priority: "high", dueFrom: "2026-11-05" } as any);
  const projectUrl = fetcher.mock.calls[0][0] as URL;
  expect(projectUrl.searchParams.get("search")).toBe("Khởi tạo dự án");
  expect(projectUrl.searchParams.get("status")).toBe("in_progress");
  expect(projectUrl.searchParams.get("priority")).toBe("high");
  expect(projectUrl.searchParams.get("dueFrom")).toBe("2026-11-05");

  const taskList = ASSISTANT_OPERATIONS.find(item => item.id === "task.list")!;
  await callOperation(req, taskList, { search: "bàn giao", status: "In Progress", assigneeUid: "507f1f77bcf86cd799439099", dueTo: "2026-11-30" } as any);
  const taskUrl = fetcher.mock.calls[1][0] as URL;
  expect(taskUrl.searchParams.get("search")).toBe("bàn giao");
  expect(taskUrl.searchParams.get("status")).toBe("In Progress");
  expect(taskUrl.searchParams.get("assigneeUid")).toBe("507f1f77bcf86cd799439099");
  expect(taskUrl.searchParams.get("dueTo")).toBe("2026-11-30");

  const repairList = ASSISTANT_OPERATIONS.find(item => item.id === "repair.list")!;
  await callOperation(req, repairList, { search: "SC-001", branchId: "507f1f77bcf86cd799439099", status: "waiting_parts", paymentStatus: "partial", from: "2026-11-01", to: "2026-11-05" } as any);
  const repairUrl = fetcher.mock.calls[2][0] as URL;
  expect(repairUrl.searchParams.get("q")).toBe("SC-001");
  expect(repairUrl.searchParams.get("branchId")).toBe("507f1f77bcf86cd799439099");
  expect(repairUrl.searchParams.get("status")).toBe("waiting_parts");
  expect(repairUrl.searchParams.get("paymentStatus")).toBe("partial");
  expect(repairUrl.searchParams.get("from")).toBe("2026-11-01");
  expect(repairUrl.searchParams.get("to")).toBe("2026-11-05");
});

it("sends employee, branch and product searches through their declared query fields", async () => {
  const fetcher = vi.fn(async (_input: URL, _init?: RequestInit) => new Response(JSON.stringify({ status: "success", data: [] }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);

  for (const [operationId, input] of [
    ["employee.list", { search: "Nguyễn Văn Cường" }],
    ["employee.detail", { search: "Cường" }],
    ["branch.list", { search: "Trụ sở chính" }],
    ["product.list", { search: "cốc sứ tai mèo" }],
    ["category.list", { search: "đồ uống" }],
    ["training.list", { search: "an toàn lao động" }],
  ] as const) {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === operationId)!;
    await callOperation(req, operation, input as any);
  }

  expect((fetcher.mock.calls[0][0] as URL).searchParams.get("search")).toBe("Nguyễn Văn Cường");
  expect((fetcher.mock.calls[1][0] as URL).searchParams.get("search")).toBe("Cường");
  expect((fetcher.mock.calls[2][0] as URL).searchParams.get("search")).toBe("Trụ sở chính");
  expect((fetcher.mock.calls[3][0] as URL).searchParams.get("q")).toBe("cốc sứ tai mèo");
  expect((fetcher.mock.calls[4][0] as URL).searchParams.get("search")).toBe("đồ uống");
  expect((fetcher.mock.calls[5][0] as URL).searchParams.get("search")).toBe("an toàn lao động");
});

it("resolves a work-process name to its tenant-scoped record and keeps its current steps private", async () => {
  const workflowId = "507f1f77bcf86cd7994390f2";
  const currentSteps = [{ id: "step-a", title: "Chuẩn bị hồ sơ", assigneeUid: "employee-a", assignee: "Nguyễn An", estDays: 2 }];
  const fetcher = vi.fn(async (_input: URL, _init?: RequestInit) => new Response(JSON.stringify({ status: "success", data: [
    { _id: workflowId, name: "Onboarding", category: "Nhân sự", description: "Quy trình tiếp nhận", steps: currentSteps, edges: [], companyCode: "TEST" },
  ], total: 1, page: 1, limit: 100 }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "hr.workflow.update")!;

  const resolution = await resolveReferences(req, operation, { path_id: "Onboarding" } as any);

  expect(resolution.errors).toEqual([]);
  expect(resolution.values.path_id).toBe(workflowId);
  expect(resolution.labels.path_id).toBe("Onboarding — Nhân sự");
  expect(JSON.parse(String(resolution.values.__assistantExistingRecord))).toMatchObject({
    name: "Onboarding",
    steps: currentSteps,
  });
  expect((fetcher.mock.calls[0][0] as URL).searchParams.has("branchId")).toBe(false);
  expect(JSON.stringify(resolution.labels)).not.toContain(workflowId);

  const selectedById = await resolveReferences(req, operation, { path_id: workflowId } as any);
  expect(selectedById.errors).toEqual([]);
  expect(selectedById.values.path_id).toBe(workflowId);
  expect(JSON.parse(String(selectedById.values.__assistantExistingRecord))).toMatchObject({ steps: currentSteps });
});

it("updates a work process without dropping existing step metadata or dangling edges", async () => {
  const workflowId = "507f1f77bcf86cd7994390f3";
  const first = { id: "step-a", title: "Chuẩn bị hồ sơ", assigneeUid: "employee-a", assignee: "Nguyễn An", estDays: 2, deliverable: "Hồ sơ", position: { x: 0, y: 10 } };
  const second = { id: "step-b", title: "Bàn giao thiết bị", assigneeUid: "employee-b", assignee: "Trần Bình", estDays: 3, position: { x: 220, y: 20 } };
  const fetcher = vi.fn(async (_input: URL, _init?: RequestInit) => new Response(JSON.stringify({ status: "success", data: { _id: workflowId, name: "Onboarding v2" } }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "hr.workflow.update")!;

  await callOperation(req, operation, {
    path_id: workflowId,
    name: "Onboarding v2",
    steps: JSON.stringify([
      { existingTitle: "Chuẩn bị hồ sơ", title: "Chuẩn bị hồ sơ", description: "Kiểm tra giấy tờ" },
      { existingTitle: "Bàn giao thiết bị", title: "Cấp phát thiết bị", estDays: 4 },
      { title: "Hướng dẫn hội nhập" },
    ]),
    __assistantExistingRecord: JSON.stringify({
      stepCount: 2,
      steps: [first, second],
      edges: [
        { id: "edge-kept", source: "step-a", target: "step-b", label: "" },
        { id: "edge-removed", source: "step-b", target: "step-deleted", label: "" },
      ],
    }),
  } as any);

  const [url, init] = fetcher.mock.calls[0];
  expect((url as URL).pathname).toBe(`/api/v1/crud/workflows/${workflowId}`);
  expect((init as RequestInit).method).toBe("PATCH");
  const body = JSON.parse(String((init as RequestInit).body));
  expect(body.name).toBe("Onboarding v2");
  expect(body.steps).toHaveLength(3);
  expect(body.steps[0]).toMatchObject({ id: "step-a", title: "Chuẩn bị hồ sơ", assigneeUid: "employee-a", estDays: 2, deliverable: "Hồ sơ", description: "Kiểm tra giấy tờ", position: { x: 0, y: 10 } });
  expect(body.steps[1]).toMatchObject({ id: "step-b", title: "Cấp phát thiết bị", assigneeUid: "employee-b", estDays: 4, position: { x: 220, y: 20 } });
  expect(body.steps[2]).toMatchObject({ title: "Hướng dẫn hội nhập", estDays: 1, assigneeUid: "", assignee: "", position: { x: 440, y: 0 } });
  expect(body.steps.every((step: any) => typeof step.id === "string" && step.id)).toBe(true);
  expect(body.steps.some((step: any) => "existingTitle" in step || "existingStepNumber" in step)).toBe(false);
  expect(body.edges).toEqual([{ id: "edge-kept", source: "step-a", target: "step-b", label: "" }]);
  expect(body).not.toHaveProperty("__assistantExistingRecord");
  expect(body).not.toHaveProperty("branchId");
});
it("suggests product categories by visible name and code, excluding inactive choices", async () => {
  const fetcher = vi.fn().mockImplementation(() => new Response(JSON.stringify({ data: [
    { id: "PRIVATE-CATEGORY-ID", name: "Linh kiện", code: "LINH-KIEN", status: "active" },
    { id: "PRIVATE-INACTIVE-ID", name: "Đã ngừng", code: "OLD", status: "inactive" },
  ] }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const create = ASSISTANT_OPERATIONS.find(item => item.method === "POST" && item.path === "/inventory/catalog/products")!;
  const category = create.fields.find(field => field.key === "categoryCode")!;
  const suggestions = await suggestReferenceOptions(req, create, category, {} as any);
  expect(suggestions).toEqual(["Linh kiện — mã LINH-KIEN"]);
  expect((fetcher.mock.calls[0][0] as URL).pathname).toBe("/api/v1/inventory/catalog/resources/categories");
  expect(JSON.stringify(suggestions)).not.toContain("PRIVATE");

  const update = ASSISTANT_OPERATIONS.find(item => item.method === "PATCH" && item.path === "/inventory/catalog/products/:id")!;
  for (const operation of [create, update]) {
    const field = operation.fields.find(candidate => candidate.key === "categoryCode")!;
    expect(await suggestReferenceOptions(req, operation, field, {} as any)).toEqual(suggestions);
    const selected = await resolveReferences(req, operation, { categoryCode: suggestions[0] } as any);
    expect(selected.errors).toEqual([]);
    expect(selected.values.categoryCode).toBe("LINH-KIEN");
    const inactive = await resolveReferences(req, operation, { categoryCode: "Đã ngừng — mã OLD" } as any);
    expect(inactive.errors.join(" ")).toContain("chưa tìm thấy");
  }
});
it("resolves a branch-qualified category name selected for deletion", async () => {
  const categoryId = "507f1f77bcf86cd7994390a3";
  const branchId = "507f1f77bcf86cd799439012";
  const marker = "AI-QA-MOD-20261102-CAT-01";
  const fetcher = vi.fn().mockImplementation((input: string | URL) => {
    const url = new URL(String(input));
    const body = url.pathname.endsWith("/crud/categories")
      ? [marker, ""].includes(url.searchParams.get("search") || "")
        ? { data: [{ _id: categoryId, name: marker, code: marker, branchId }] }
        : { data: [] }
      : url.pathname.endsWith("/auth/branches")
        ? { data: [{ _id: branchId, name: "Trụ sở chính", code: "MAIN", isActive: true }] }
        : { data: [] };
    return new Response(JSON.stringify(body), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);

  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "category.delete")!;
  const selected = await resolveReferences(req, operation, { id: `${marker} — Chi nhánh Trụ sở chính` } as any);

  expect(selected.errors).toEqual([]);
  expect(selected.values.id).toBe(categoryId);
  expect(selected.labels.id).toBe(`${marker} — Chi nhánh Trụ sở chính`);

  const revalidated = await resolveReferences(req, operation, selected.values as any);
  expect(revalidated.errors).toEqual([]);
  expect(revalidated.values.id).toBe(categoryId);
});
it("revalidates pinned marketing draft IDs through the scoped list", async () => {
  const draftId = "507f1f77bcf86cd7994390a4";
  const title = "AI-QA-MOD-20261102-MKT-01";
  const fetcher = vi.fn().mockImplementation((input: string | URL) => {
    const url = new URL(String(input));
    const body = url.pathname.endsWith("/marketing-contents")
      ? [title, ""].includes(url.searchParams.get("search") || "")
        ? { data: [{ _id: draftId, title, channel: "Facebook", contentType: "Bài đăng", status: "draft", bodyText: "QA" }] }
        : { data: [] }
      : { data: [] };
    return new Response(JSON.stringify(body), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);

  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.content.draft.update")!;
  const selected = await resolveReferences(req, operation, { path_id: title, bodyText: "Đã sửa" } as any);
  expect(selected.errors).toEqual([]);
  expect(selected.values.path_id).toBe(draftId);

  const revalidated = await resolveReferences(req, operation, selected.values as any);
  expect(revalidated.errors).toEqual([]);
  expect(revalidated.values.path_id).toBe(draftId);
});
it("suggests pending FAQ questions by their text and hides already-reviewed candidates from rejection", async () => {
  const pendingId = "507f1f77bcf86cd7994390a1";
  const approvedId = "507f1f77bcf86cd7994390a2";
  const fetcher = vi.fn().mockImplementation(() => new Response(JSON.stringify({ status: "success", candidates: [
    { _id: pendingId, question: "Chính sách đổi hàng thế nào?", suggestedAnswer: "Có thể đổi trong 7 ngày.", category: "Chính sách", frequency: 6, status: "pending" },
    { _id: approvedId, question: "Địa chỉ cửa hàng ở đâu?", suggestedAnswer: "Xem trang liên hệ.", category: "Liên hệ", frequency: 10, status: "approved" },
  ] }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);

  const reject = ASSISTANT_OPERATIONS.find(item => item.id === "company-knowledge.faq-candidate.reject")!;
  const field = reject.fields.find(candidate => candidate.key === "path_id")!;
  const suggestions = await suggestReferenceOptions(req, reject, field, {} as any);
  expect(suggestions).toHaveLength(1);
  expect(suggestions[0]).toContain("Chính sách đổi hàng thế nào?");
  expect(suggestions[0]).toContain("đang chờ duyệt");
  expect(suggestions[0]).not.toContain("Bản ghi");
  expect(JSON.stringify(suggestions)).not.toMatch(/507f1f77|Địa chỉ cửa hàng/);

  const selected = await resolveReferences(req, reject, { path_id: suggestions[0] } as any);
  expect(selected.errors).toEqual([]);
  expect(selected.values.path_id).toBe(pendingId);
  expect(JSON.stringify(selected.labels)).not.toContain(pendingId);

  const reviewed = await resolveReferences(req, reject, { path_id: "Địa chỉ cửa hàng ở đâu?" } as any);
  expect(reviewed.errors.join(" ")).toContain("chưa tìm thấy bản ghi");
});
it("proposes only active departments and resolves the user's choice for employee create and update", async () => {
  const fetcher = vi.fn().mockImplementation(() => new Response(JSON.stringify({ data: [
    { id: "PRIVATE-ACTIVE-DEPARTMENT", name: "Kỹ thuật", code: "KT", isActive: true },
    { id: "PRIVATE-INACTIVE-DEPARTMENT", name: "Ngừng hoạt động", code: "OLD", isActive: false },
  ] }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);

  for (const operation of [
    ASSISTANT_OPERATIONS.find(item => item.id === "employee.create")!,
    ASSISTANT_OPERATIONS.find(item => item.id === "employee.update")!,
  ]) {
    const field = operation.fields.find(candidate => candidate.key === "department")!;
    const suggestions = await suggestReferenceOptions(req, operation, field, {} as any);
    expect(suggestions).toEqual(["Kỹ thuật — mã KT"]);
    const selected = await resolveReferences(req, operation, { department: suggestions[0] } as any);
    expect(selected.errors).toEqual([]);
    expect(selected.values.department).toBe("Kỹ thuật");
    const inactive = await resolveReferences(req, operation, { department: "Ngừng hoạt động" } as any);
    expect(inactive.errors.join(" ")).toContain("chưa tìm thấy");
    expect(inactive.unresolvedReferenceKeys).toContain("department");
  }
  expect(JSON.stringify(fetcher.mock.calls)).not.toContain("PRIVATE-");
});
it("returns unresolved nested reference paths for selectable-choice recovery", async () => {
  const fetcher = vi.fn(async () => new Response(JSON.stringify({ data: [
    { id: "507f1f77bcf86cd7994390c1", name: "Kỹ thuật", code: "KT", isActive: true },
  ] }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const operation: any = {
    id: "test.nested-reference", method: "POST", path: "/test", fields: [{
      key: "items", label: "Danh sách", type: "json", source: "body", apiKey: "items", structure: {
        type: "array", items: { type: "object", keys: {
          department: { type: "string", reference: "department.list", referenceValueKey: "name", label: "Phòng ban" },
        } },
      },
    }],
  };

  const result = await resolveReferences(req, operation, {
    items: JSON.stringify([{ department: "Phòng ban không tồn tại" }]),
  } as any);

  expect(result.unresolvedReferenceKeys).toEqual(["items[1].department"]);
  expect(result.unresolvedReferenceErrors["items[1].department"]).toContain("chưa tìm thấy bản ghi");
});
it("keeps same-name employee relationship choices distinct without exposing record IDs", async () => {
  const ids = ["507f1f77bcf86cd7994390a1", "507f1f77bcf86cd7994390a2"];
  const fetcher = vi.fn().mockImplementation(() => new Response(JSON.stringify({ data: [
    { id: ids[0], displayName: "Đỗ Đức Chung", phone: "0901000001", email: "chung.one@example.test" },
    { id: ids[1], displayName: "Đỗ Đức Chung", phone: "0901000002", email: "chung.two@example.test" },
  ] }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);

  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "department.create")!;
  const field = operation.fields.find(candidate => candidate.key === "managerUid")!;
  expect(field.referenceValueKey).toBeUndefined();
  expect(field.reference).toBe("employee.list");
  const options = await suggestReferenceOptions(req, operation, field, {} as any);
  expect(options).toEqual([
    "Đỗ Đức Chung [SĐT: 0901000001; email: chung.one@example.test]",
    "Đỗ Đức Chung [SĐT: 0901000002; email: chung.two@example.test]",
  ]);
  expect(JSON.stringify(options)).not.toMatch(/507f1f77bcf86cd7994390a[12]/);

  const candidates = await lookupRecords(req, "employee.list", options[1]);
  expect(candidates.map(candidate => candidate.phone)).toEqual(["0901000002"]);
  const selected = await resolveReferences(req, operation, { managerUid: options[1] } as any);
  expect(selected.errors).toEqual([]);
  expect(selected.values.managerUid).toBe(ids[1]);
  expect(JSON.stringify(selected.labels)).not.toContain(ids[1]);
});
it("offers only active instructors assigned to the current branch for class workflows", async () => {
  const branchId = req.user.branchId;
  const activeId = "507f1f77bcf86cd7994390b1";
  const inactiveId = "507f1f77bcf86cd7994390b2";
  const unassignedId = "507f1f77bcf86cd7994390b3";
  const otherBranchId = "507f1f77bcf86cd7994390b4";
  const otherBranch = "507f1f77bcf86cd799439099";
  const fetcher = vi.fn().mockImplementation((input: string | URL) => {
    const url = input instanceof URL ? input : new URL(String(input));
    if (url.pathname === "/api/v1/auth/users") return new Response(JSON.stringify({ data: [
      { _id: activeId, displayName: "Giảng viên đang hoạt động", companyCode: "TEST", branchId, isActive: true },
      { _id: inactiveId, displayName: "Giảng viên đã ngừng", companyCode: "TEST", branchId, isActive: false },
      { _id: unassignedId, displayName: "Tài khoản chưa gán chi nhánh", companyCode: "TEST", isActive: true },
      { _id: otherBranchId, displayName: "Giảng viên chi nhánh khác", companyCode: "TEST", branchId: otherBranch, isActive: true },
    ] }), { status: 200 });
    if (url.pathname === "/api/v1/auth/branches") return new Response(JSON.stringify({ data: [
      { _id: branchId, name: "Trụ sở chính", code: "MAIN" },
    ] }), { status: 200 });
    throw new Error(`Unexpected request: ${url.pathname}`);
  });
  vi.stubGlobal("fetch", fetcher);

  for (const operationId of ["student.batch.create", "student.batch.update"]) {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === operationId)!;
    const field = operation.fields.find(candidate => candidate.key === "instructorId")!;
    const options = await suggestReferenceOptions(req, operation, field, {} as any);
    expect(options).toEqual(["Giảng viên đang hoạt động — Chi nhánh Trụ sở chính"]);
    expect(JSON.stringify(options)).not.toMatch(/507f1f77|đã ngừng|chưa gán|chi nhánh khác/i);

    const selected = await resolveReferences(req, operation, { instructorId: options[0] } as any);
    expect(selected.errors).toEqual([]);
    expect(selected.values.instructorId).toBe(activeId);

    const inactive = await resolveReferences(req, operation, { instructorId: "Giảng viên đã ngừng" } as any);
    expect(inactive.errors.join(" ")).toContain("chưa tìm thấy");
  }
  expect(new URL(String(fetcher.mock.calls[0][0])).searchParams.get("branchId")).toBe(branchId);
});
it("suggests customers by name, customer code, and phone and loads the current version for edits", async () => {
  const ids = { active: "507f1f77bcf86cd7994390a1", inactive: "507f1f77bcf86cd7994390a2" };
  const rows = [
    { _id: ids.active, customerCode: "KH-001", name: "Nguyễn An", phone: "0901000001", status: "active", version: 4 },
    { _id: ids.inactive, customerCode: "KH-002", name: "Nguyễn Bình", phone: "0901000002", status: "inactive", version: 7 },
  ];
  const fetcher = vi.fn().mockImplementation((rawInput: URL | string) => {
    const input = rawInput instanceof URL ? rawInput : new URL(String(rawInput));
    if (input.pathname !== "/api/v1/customers") throw new Error(`Unexpected request: ${input.pathname}`);
    const status = input.searchParams.get("status");
    const filtered = status === "all" ? rows : rows.filter(row => row.status === status);
    return new Response(JSON.stringify({ success: true, data: { items: filtered } }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);

  const update = ASSISTANT_OPERATIONS.find(item => item.id === "customer.update")!;
  const updateField = update.fields.find(field => field.key === "path_id")!;
  const suggestions = await suggestReferenceOptions(req, update, updateField, {} as any);
  expect(suggestions).toEqual([
    "Nguyễn An — KH-001 — 0901000001",
    "Nguyễn Bình — KH-002 — 0901000002",
  ]);
  expect(JSON.stringify(suggestions)).not.toMatch(/507f1f77|version/);

  const selected = await resolveReferences(req, update, { path_id: suggestions[1], name: "Nguyễn Bình mới" } as any);
  expect(selected.errors).toEqual([]);
  expect(selected.values).toMatchObject({ path_id: ids.inactive, version: 7 });
  expect(update).toMatchObject({ confirmation: true, systemBodyFields: ["version"] });

  const activate = ASSISTANT_OPERATIONS.find(item => item.id === "customer.activate")!;
  const activateField = activate.fields.find(field => field.key === "path_id")!;
  expect(await suggestReferenceOptions(req, activate, activateField, {} as any)).toEqual([suggestions[1]]);
  expect(fetcher.mock.calls.map(([input]) => new URL(String(input)).searchParams.get("status"))).toContain("inactive");
  const activation = await resolveReferences(req, activate, { path_id: suggestions[1] } as any);
  expect(activation.errors).toEqual([]);
  expect(activation.values).toMatchObject({ path_id: ids.inactive, version: 7 });

  const deactivate = ASSISTANT_OPERATIONS.find(item => item.id === "customer.deactivate")!;
  const deactivateField = deactivate.fields.find(field => field.key === "path_id")!;
  expect(await suggestReferenceOptions(req, deactivate, deactivateField, {} as any)).toEqual([suggestions[0]]);
  expect(fetcher.mock.calls.map(([input]) => new URL(String(input)).searchParams.get("status"))).toContain("active");
  expect(JSON.stringify(fetcher.mock.calls.map(([input]) => String(input)))).not.toContain(ids.active);
  expect(JSON.stringify(fetcher.mock.calls.map(([input]) => String(input)))).not.toContain(ids.inactive);
});
it("suggests roles and permissions by visible names and resolves only the selected business keys", async () => {
  const roleId = "PRIVATE-ROLE-ID";
  const permissionId = "PRIVATE-PERMISSION-ID";
  const fetcher = vi.fn().mockImplementation((rawInput: URL | string) => {
    const input = rawInput instanceof URL ? rawInput : new URL(String(rawInput));
    if (input.pathname === "/api/v1/role-permissions") return new Response(JSON.stringify({ success: true, data: [
      { _id: roleId, role: "cashier", displayName: "Thu ngân", permissions: ["retail:read"], level: 5, companyCode: "TEST" },
    ] }), { status: 200 });
    if (input.pathname === "/api/v1/permissions") return new Response(JSON.stringify({ success: true, data: [
      { _id: permissionId, code: "inventory:read", name: "Xem kho", module: "inventory", group: "inventory", action: "read" },
    ] }), { status: 200 });
    throw new Error(`Unexpected request: ${input.pathname}`);
  });
  vi.stubGlobal("fetch", fetcher);

  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "access.role-permissions.save")!;
  const roleField = operation.fields.find(field => field.apiKey === "role")!;
  const permissionsField = operation.fields.find(field => field.apiKey === "permissions")!;
  const roleOptions = await suggestReferenceOptions(req, operation, roleField, {} as any);
  const permissionOptions = await suggestReferenceOptions(req, operation, {
    ...permissionsField.structure!.items!, key: "permissions", type: "reference",
  } as any, {} as any);

  expect(roleOptions).toEqual(["Thu ngân · cashier · cấp 5"]);
  expect(permissionOptions).toEqual(["Xem kho — mã inventory:read"]);
  expect(JSON.stringify([roleOptions, permissionOptions])).not.toContain("PRIVATE");

  const resolved = await resolveReferences(req, operation, {
    role: roleOptions[0], permissions: JSON.stringify([permissionOptions[0]]), level: 6,
  } as any);
  expect(resolved.errors).toEqual([]);
  expect(resolved.values).toMatchObject({ role: "cashier", level: 6 });
  expect(JSON.parse(String(resolved.values.permissions))).toEqual(["inventory:read"]);
  expect(resolved.labels.role).toBe(roleOptions[0]);
  expect(resolved.labels.permissions).toContain("Xem kho — mã inventory:read");
});
it("suggests repair-part SKUs from the selected product and rejects a SKU from another product", async () => {
  const productId = "507f1f77bcf86cd799439451";
  const skuId = "507f1f77bcf86cd799439452";
  const fetcher = vi.fn().mockImplementation((rawInput: URL | string) => {
    const input = rawInput instanceof URL ? rawInput : new URL(String(rawInput));
    if (input.pathname === "/api/v1/inventory/catalog/products") {
      return new Response(JSON.stringify({ data: { items: [
        { _id: productId, name: "Điện thoại A", productCode: "DT-A", status: "active" },
      ], total: 1 } }), { status: 200 });
    }
    if (input.pathname === `/api/v1/inventory/catalog/products/${productId}`) {
      return new Response(JSON.stringify({ data: {
        _id: productId,
        name: "Điện thoại A",
        variants: [{ _id: skuId, sku: "DT-A-RED", displayName: "Màu đỏ", status: "active" }],
      } }), { status: 200 });
    }
    throw new Error(`Unexpected request: ${input.pathname}`);
  });
  vi.stubGlobal("fetch", fetcher);

  const operation = ASSISTANT_OPERATIONS.find(item => item.method === "POST" && item.path === "/repair/tickets/:id/parts")!;
  const skuField = operation.fields.find(field => field.apiKey === "sku")!;
  const suggestions = await suggestReferenceOptions(req, operation, skuField, { productId: "Điện thoại A" } as any);
  expect(suggestions).toHaveLength(1);
  expect(suggestions[0]).toContain("DT-A-RED");
  expect(JSON.stringify(suggestions)).not.toContain(productId);
  expect(JSON.stringify(suggestions)).not.toContain(skuId);

  const resolved = await resolveReferences(req, operation, { productId: "Điện thoại A", sku: suggestions[0] } as any);
  expect(resolved.errors).toEqual([]);
  expect(resolved.values).toMatchObject({ productId, sku: "DT-A-RED" });

  const wrongProductSku = await resolveReferences(req, operation, {
    productId: "Điện thoại A",
    sku: "Điện thoại B — DT-B-BLUE",
  } as any);
  expect(wrongProductSku.errors.join(" ")).toContain("chưa tìm thấy");
});
it("suggests course categories by name and writes the selected category name", async () => {
  const categoryId = "507f1f77bcf86cd799439421";
  const fetcher = vi.fn().mockImplementation(() => new Response(JSON.stringify({ success: true, data: [
    { _id: categoryId, name: "Tiếng Anh giao tiếp" },
    { _id: "507f1f77bcf86cd799439422", name: "Lái xe hạng B" },
  ] }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const create = ASSISTANT_OPERATIONS.find(item => item.method === "POST" && item.path === "/courses")!;
  const category = create.fields.find(field => field.apiKey === "category")!;
  const suggestions = await suggestReferenceOptions(req, create, category, {} as any);
  expect(suggestions).toEqual(["Tiếng Anh giao tiếp", "Lái xe hạng B"]);
  expect(JSON.stringify(suggestions)).not.toContain(categoryId);

  const resolved = await resolveReferences(req, create, {
    category: suggestions[0],
  } as any);
  expect(resolved.errors).toEqual([]);
  expect(resolved.values.category).toBe("Tiếng Anh giao tiếp");
});
it("creates a course category through the dedicated confirmed workflow contract", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: { name: "Tiếng Anh giao tiếp" } }), { status: 201 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "course.category.create")!;

  const result = await callOperation(req, operation, { name: "Tiếng Anh giao tiếp" } as any);
  const [rawUrl, init] = fetcher.mock.calls[0];

  expect(operation.confirmation).toBe(true);
  expect(new URL(String(rawUrl)).pathname).toBe("/api/v1/courses/categories");
  expect(init.method).toBe("POST");
  expect(JSON.parse(String(init.body))).toEqual({ name: "Tiếng Anh giao tiếp" });
  expect(result.data).toMatchObject({ name: "Tiếng Anh giao tiếp" });
});
it("suggests retail coupons by name, scopes them to the selected customer and branch, and resolves only the coupon code", async () => {
  const customerId = "507f1f77bcf86cd799439431";
  const couponId = "507f1f77bcf86cd799439432";
  const branchId = "507f1f77bcf86cd799439012";
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "retail.order.checkout")!;
  const draftOperation = ASSISTANT_OPERATIONS.find(item => item.id === "retail.order.draft.create")!;
  const customerList = ASSISTANT_OPERATIONS.find(item => item.id === "customer.list")!;
  const coupons = ASSISTANT_OPERATIONS.find(item => item.id === "retail.coupon.assistant-options.list")!;
  const products = ASSISTANT_OPERATIONS.find(item => item.id === "retail.order.products.list")!;
  const quote = ASSISTANT_OPERATIONS.find(item => item.id === "retail.order.quote")!;
  const currentShift = ASSISTANT_OPERATIONS.find(item => item.id === "retail.shift.current")!;
  const inputShape = operation.fields.find(field => field.key === "input")?.structure?.keys?.couponCode;
  expect(inputShape).toBeDefined();
  const couponField = { ...inputShape!, key: "input.couponCode", type: "reference" } as any;
  const fetcher = vi.fn().mockImplementation((rawInput: URL | string) => {
    const input = rawInput instanceof URL ? rawInput : new URL(String(rawInput));
    if (input.pathname === `/api/v1${customerList.path}`) return new Response(JSON.stringify({ success: true, data: [
      { _id: customerId, name: "Nguyễn An", phone: "0900000000" },
    ] }), { status: 200 });
    if (input.pathname === `/api/v1${coupons.path}`) return new Response(JSON.stringify({ success: true, data: [
      { _id: couponId, code: "SN2026", name: "Ưu đãi sinh nhật", discountType: "percent", value: 10, minSubtotal: 100000, maxDiscount: 50000 },
    ] }), { status: 200 });
    if (input.pathname === `/api/v1${products.path}`) return new Response(JSON.stringify({ success: true, data: [
      { _id: "507f1f77bcf86cd799439434", name: "Sản phẩm demo", sku: "SP01" },
    ] }), { status: 200 });
    if (input.pathname === `/api/v1${quote.path}`) return new Response(JSON.stringify({ success: true, data: { grandTotal: 0 } }), { status: 200 });
    if (input.pathname === `/api/v1${currentShift.path}`) return new Response(JSON.stringify({ success: true, data: {
      _id: "507f1f77bcf86cd799439433", status: "open", shiftCode: "CA-01", terminalId: "POS-01",
    } }), { status: 200 });
    throw new Error(`Unexpected request: ${input.pathname}`);
  });
  vi.stubGlobal("fetch", fetcher);

  const suggestions = await suggestReferenceOptions(req, operation, couponField, {
    targetBranch: branchId,
    customerId: "Nguyễn An",
  } as any);
  expect(suggestions).toEqual([expect.stringContaining("Ưu đãi sinh nhật")]);
  expect(suggestions[0]).toContain("SN2026");
  expect(JSON.stringify(suggestions)).not.toContain(couponId);
  const couponRequest = fetcher.mock.calls.map(([input]) => new URL(String(input))).find(input => input.pathname === `/api/v1${coupons.path}`)!;
  expect(couponRequest.searchParams.get("branchId")).toBe(branchId);
  expect(couponRequest.searchParams.get("customerId")).toBe(customerId);

  const nestedResolution = await resolveReferences(req, operation, {
    targetBranch: branchId,
    input: JSON.stringify({ items: [{ productId: "Sản phẩm demo", quantity: 1 }], customerId: "Nguyễn An", couponCode: suggestions[0] }),
  } as any);
  expect(nestedResolution.errors).toEqual([]);
  expect(JSON.parse(String(nestedResolution.values.input))).toMatchObject({ customerId, couponCode: "SN2026" });

  const resolution = await resolveReferences(req, draftOperation, {
    targetBranch: branchId,
    customerId: "Nguyễn An",
    couponCode: suggestions[0],
  } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values).toMatchObject({ customerId, couponCode: "SN2026" });
});
it("only offers folders and outstanding supplier payables for linked fields", async () => {
  const folderId = "507f1f77bcf86cd799439401";
  const payableId = "507f1f77bcf86cd799439402";
  const fetcher = vi.fn().mockImplementation(async (input: URL) => {
    if (input.pathname === "/api/v1/resources") return new Response(JSON.stringify({ data: [
      { id: folderId, name: "Nhân sự", type: "folder", section: "local" },
      { id: "507f1f77bcf86cd799439403", name: "CV.pdf", type: "file", section: "local" },
    ] }), { status: 200 });
    if (input.pathname === "/api/v1/finance/reporting/debts") return new Response(JSON.stringify({ data: { items: [
      { id: payableId, direction: "payable", partyKind: "supplier", partyName: "Công ty ABC", reference: "PN-01", balance: 1200 },
      { id: "507f1f77bcf86cd799439404", direction: "receivable", partyKind: "customer", partyName: "Khách A", reference: "DH-01", balance: 900 },
      { id: "507f1f77bcf86cd799439405", direction: "payable", partyKind: "supplier", partyName: "Đã thanh toán", reference: "PN-02", balance: 0 },
    ] } }), { status: 200 });
    throw new Error(`Unexpected request: ${input.pathname}`);
  });
  vi.stubGlobal("fetch", fetcher);

  const folderCreate = ASSISTANT_OPERATIONS.find(item => item.method === "POST" && item.path === "/resources/folder")!;
  const parentField = folderCreate.fields.find(field => field.key === "parentId")!;
  expect(await suggestReferenceOptions(req, folderCreate, parentField, { section: "local" } as any)).toEqual(["Nhân sự"]);
  const invalidParent = await resolveReferences(req, folderCreate, { name: "Báo cáo", section: "local", parentId: "CV.pdf" } as any);
  expect(invalidParent.errors.join(" ")).toContain("chưa tìm thấy");

  const voucher = ASSISTANT_OPERATIONS.find(item => item.id === "finance.voucher.create")!;
  const payableField = voucher.fields.find(field => field.key === "payableId")!;
  const options = await suggestReferenceOptions(req, voucher, payableField, {} as any);
  expect(options).toEqual(["Công ty ABC — mã PN-01"]);
  const resolved = await resolveReferences(req, voucher, { category: "supplier", payableId: options[0] } as any);
  expect(resolved.errors).toEqual([]);
  expect(resolved.values.payableId).toBe(payableId);
  expect(JSON.stringify(options)).not.toMatch(/507f1f77/);
});
it("offers waitlist entries using student, roadmap and source-class names instead of record IDs", async () => {
  const entryId = "507f1f77bcf86cd799439406";
  const fetcher = vi.fn().mockImplementation(() => new Response(JSON.stringify({ success: true, items: [
    { id: entryId, studentName: "Đỗ Đức Chung", roadmapName: "Lộ trình kỹ thuật", sourceBatchCode: "KT-01", learningFormat: "Tại lớp", preferredTimeSlot: "Buổi sáng", waitingDays: 3 },
  ], total: 1, page: 1, totalPages: 1 }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.method === "POST" && item.path === "/learning-roadmaps/waitlist/place")!;
  const entries = operation.fields.find(field => field.apiKey === "entryIds")!;
  const options = await suggestReferenceOptions(req, operation, { ...entries, key: "entryIds[]", ...entries.structure!.items } as any, {} as any);
  expect(options).toEqual(["Đỗ Đức Chung — lộ trình Lộ trình kỹ thuật — từ lớp KT-01"]);
  expect(JSON.stringify(options)).not.toContain(entryId);
  const resolved = await resolveReferences(req, operation, { entryIds: JSON.stringify([options[0]]) } as any);
  expect(resolved.errors).toEqual([]);
  expect(JSON.parse(String(resolved.values.entryIds))).toEqual([entryId]);
});
it("limits attendance worker suggestions and selection to the chosen project members", async () => {
  const projectId = "507f1f77bcf86cd799439407";
  const assignedWorkerId = "507f1f77bcf86cd799439408";
  const otherWorkerId = "507f1f77bcf86cd799439409";
  const fetcher = vi.fn().mockImplementation((input: URL) => {
    if (input.pathname === "/api/v1/worker-management/projects") return new Response(JSON.stringify({ success: true, data: [
      { _id: projectId, code: "DA", name: "Dự án A", status: "active" },
    ] }), { status: 200 });
    if (input.pathname === `/api/v1/worker-management/projects/${projectId}`) return new Response(JSON.stringify({ success: true, data: { _id: projectId, workerIds: [assignedWorkerId] } }), { status: 200 });
    if (input.pathname === "/api/v1/worker-management/workers") return new Response(JSON.stringify({ workers: [
      { _id: assignedWorkerId, fullName: "Đỗ Đức Chung", status: "active" },
      { _id: otherWorkerId, fullName: "Trần Văn An", status: "active" },
    ] }), { status: 200 });
    throw new Error(`Unexpected request: ${input.pathname}`);
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.method === "POST" && item.path === "/worker-management/attendance/mark")!;
  const workerField = operation.fields.find(field => field.apiKey === "workerId")!;
  const projectLabel = "Dự án A — mã DA";
  const options = await suggestReferenceOptions(req, operation, workerField, { projectId: projectLabel } as any);
  expect(options).toEqual(["Đỗ Đức Chung"]);
  expect(JSON.stringify(options)).not.toContain(assignedWorkerId);
  const accepted = await resolveReferences(req, operation, { projectId: projectLabel, workerId: "Đỗ Đức Chung" } as any);
  expect(accepted.errors).toEqual([]);
  expect(accepted.values).toMatchObject({ projectId, workerId: assignedWorkerId });
  const rejected = await resolveReferences(req, operation, { projectId: projectLabel, workerId: "Trần Văn An" } as any);
  expect(rejected.errors.join(" ")).toContain("chưa tìm thấy");
});
it("selects a chat message by its room, sender, excerpt and time", async () => {
  const roomId = "507f1f77bcf86cd799439410";
  const messageId = "507f1f77bcf86cd799439411";
  const fetcher = vi.fn().mockImplementation((input: URL) => {
    if (input.pathname === "/api/v1/chat/rooms") return new Response(JSON.stringify({ status: "success", data: [
      { _id: roomId, name: "Phòng thiết kế", isGroup: true, updatedAt: "2026-11-01T00:00:00.000Z" },
    ] }), { status: 200 });
    if (input.pathname === `/api/v1/chat/rooms/${roomId}/messages`) return new Response(JSON.stringify({ status: "success", data: [
      { _id: messageId, senderName: "Đỗ Đức Chung", content: "Chốt lịch họp vào sáng thứ Hai.", createdAt: "2026-11-01T00:00:00.000Z", isDeleted: false },
    ] }), { status: 200 });
    throw new Error(`Unexpected request: ${input.pathname}`);
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.method === "POST" && item.path === "/chat/rooms/:roomId/pin")!;
  const roomField = operation.fields.find(field => field.apiKey === "roomId")!;
  const messageField = operation.fields.find(field => field.apiKey === "messageId")!;
  const rooms = await suggestReferenceOptions(req, operation, roomField, {} as any);
  expect(rooms).toEqual(["Phòng thiết kế"]);
  const messages = await suggestReferenceOptions(req, operation, messageField, { path_roomId: rooms[0] } as any);
  expect(messages).toEqual([expect.stringContaining("Đỗ Đức Chung: Chốt lịch họp vào sáng thứ Hai.")]);
  expect(JSON.stringify(messages)).not.toContain(messageId);
  const resolved = await resolveReferences(req, operation, { path_roomId: rooms[0], messageId: messages[0] } as any);
  expect(resolved.errors).toEqual([]);
  expect(resolved.values).toMatchObject({ path_roomId: roomId, messageId });
});
it("offers only eligible room members by name when transferring group admin and hides member IDs", async () => {
  const roomId = "507f1f77bcf86cd799439420";
  const actorId = "507f1f77bcf86cd799439421";
  const recipientId = "507f1f77bcf86cd799439422";
  const otherAdminId = "507f1f77bcf86cd799439423";
  const fetcher = vi.fn().mockImplementation((input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/chat/rooms") return new Response(JSON.stringify({ status: "success", data: [
      { _id: roomId, name: "Nhóm vận hành", isGroup: true },
    ] }), { status: 200 });
    if (input.pathname === `/api/v1/chat/rooms/${roomId}/transfer-admin` && init?.method === "POST") return new Response(JSON.stringify({ status: "success", data: {
      _id: roomId,
      name: "Nhóm vận hành",
      members: [{ userId: { _id: recipientId, displayName: "Đỗ Đức Chung" }, role: "admin" }],
      lastMessage: { content: "không hiển thị" },
    } }), { status: 200 });
    if (input.pathname === `/api/v1/chat/rooms/${roomId}/members/${otherAdminId}/role` && init?.method === "POST") return new Response(JSON.stringify({ status: "success", data: {
      _id: roomId,
      name: "Nhóm vận hành",
      members: [{ userId: { _id: otherAdminId, displayName: "Quản trị viên khác" }, role: "deputy" }],
      lastMessage: { content: "không hiển thị" },
    } }), { status: 200 });
    if (input.pathname === `/api/v1/chat/rooms/${roomId}/members/${recipientId}` && init?.method === "DELETE") return new Response(JSON.stringify({ status: "success", data: {
      _id: roomId,
      name: "Nhóm vận hành",
      members: [{ userId: { _id: actorId, displayName: "Người quản lý" }, role: "admin" }],
      lastMessage: { content: "không hiển thị" },
    } }), { status: 200 });
    if (input.pathname === `/api/v1/chat/rooms/${roomId}`) return new Response(JSON.stringify({ status: "success", data: {
      _id: roomId,
      name: "Nhóm vận hành",
      isGroup: true,
      members: [
        { userId: { _id: actorId, displayName: "Người quản lý" }, role: "admin" },
        { userId: { _id: recipientId, displayName: "Đỗ Đức Chung" }, role: "member" },
        { userId: { _id: otherAdminId, displayName: "Quản trị viên khác" }, role: "admin" },
      ],
    } }), { status: 200 });
    throw new Error(`Unexpected request: ${input.pathname}`);
  });
  vi.stubGlobal("fetch", fetcher);
  const roomReq = { ...req, user: { ...req.user, id: actorId } } as any;
  const transfer = ASSISTANT_OPERATIONS.find(item => item.id === "chat.room.transfer-admin")!;
  const roomField = transfer.fields.find(field => field.apiKey === "roomId")!;
  const recipientField = transfer.fields.find(field => field.apiKey === "newAdminId")!;
  const rooms = await suggestReferenceOptions(roomReq, transfer, roomField, {} as any);
  expect(rooms).toEqual(["Nhóm vận hành"]);
  const memberList = ASSISTANT_OPERATIONS.find(item => item.id === "chat.room.members.list")!;
  const memberRows = await callOperation(roomReq, memberList, { path_roomId: roomId } as any);
  expect(memberRows.data).toEqual([
    { displayName: "Người quản lý", role: "admin", roleLabel: "Trưởng nhóm" },
    { displayName: "Đỗ Đức Chung", role: "member", roleLabel: "Thành viên" },
    { displayName: "Quản trị viên khác", role: "admin", roleLabel: "Trưởng nhóm" },
  ].filter(member => member.displayName !== "Người quản lý"));
  expect(JSON.stringify(memberRows)).not.toContain(recipientId);
  const lookedUpMembers = await lookupRecords(roomReq, "chat.room.members.list", "", { path_roomId: roomId } as any);
  expect(lookedUpMembers.map(member => member.role)).toEqual(["member", "admin"]);
  const nonAdminReq = { ...roomReq, user: { ...roomReq.user, id: recipientId } } as any;
  expect(nonAdminReq.user.id).toBe(recipientId);
  expect((await callOperation(nonAdminReq, memberList, { path_roomId: roomId } as any)).data).toEqual([]);
  const recipients = await suggestReferenceOptions(roomReq, transfer, recipientField, { path_roomId: rooms[0] } as any);
  expect(recipients).toEqual(["Đỗ Đức Chung"]);
  expect(JSON.stringify(recipients)).not.toMatch(/507f1f77/);
  const resolved = await resolveReferences(roomReq, transfer, { path_roomId: rooms[0], newAdminId: recipients[0] } as any);
  expect(resolved.errors).toEqual([]);
  expect(resolved.values).toMatchObject({ path_roomId: roomId, newAdminId: recipientId });
  const result = await callOperation(roomReq, transfer, { path_roomId: roomId, newAdminId: recipientId } as any);
  expect(result.data).toEqual({ roomName: "Nhóm vận hành", newAdminName: "Đỗ Đức Chung", transferred: true });
  expect(JSON.stringify(result)).not.toMatch(/507f1f77|không hiển thị/);
  const changeRole = ASSISTANT_OPERATIONS.find(item => item.id === "chat.room.member.role.update")!;
  const targetField = changeRole.fields.find(field => field.apiKey === "userId")!;
  const roleTargets = await suggestReferenceOptions(roomReq, changeRole, targetField, { path_roomId: rooms[0] } as any);
  expect(roleTargets).toEqual(["Đỗ Đức Chung", "Quản trị viên khác"]);
  const roleResolved = await resolveReferences(roomReq, changeRole, { path_roomId: rooms[0], path_userId: "Quản trị viên khác", role: "deputy" } as any);
  expect(roleResolved.errors).toEqual([]);
  expect(roleResolved.values.path_userId).toBe(otherAdminId);
  const roleResult = await callOperation(roomReq, changeRole, { path_roomId: roomId, path_userId: otherAdminId, role: "deputy" } as any);
  expect(roleResult.data).toEqual({ roomName: "Nhóm vận hành", memberName: "Quản trị viên khác", roleLabel: "Phó nhóm", updated: true });
  expect(JSON.stringify(roleResult)).not.toMatch(/507f1f77|không hiển thị/);
  const removeMember = ASSISTANT_OPERATIONS.find(item => item.id === "chat.room.member.remove")!;
  const removeTarget = removeMember.fields.find(field => field.apiKey === "userId")!;
  expect(await suggestReferenceOptions(roomReq, removeMember, removeTarget, { path_roomId: rooms[0] } as any)).toEqual(["Đỗ Đức Chung", "Quản trị viên khác"]);
  const removeResolved = await resolveReferences(roomReq, removeMember, { path_roomId: rooms[0], path_userId: "Đỗ Đức Chung" } as any);
  expect(removeResolved.errors).toEqual([]);
  expect(removeResolved.values.path_userId).toBe(recipientId);
  const removeResult = await callOperation(roomReq, removeMember, { path_roomId: roomId, path_userId: recipientId } as any);
  expect(removeResult.data).toEqual({ roomName: "Nhóm vận hành", removed: true });
  expect(JSON.stringify(removeResult)).not.toMatch(/507f1f77|không hiển thị/);
});
it("offers only unregistered receipts for payables and target-type-matched debts for follow-ups", async () => {
  const receiptId = "507f1f77bcf86cd799439412";
  const receivableId = "507f1f77bcf86cd799439413";
  const payableId = "507f1f77bcf86cd799439414";
  const fetcher = vi.fn().mockImplementation(() => new Response(JSON.stringify({ success: true, data: {
    receivables: [{ _id: receivableId, receivableCode: "PT-01", customerName: "Công ty An", originalAmount: 3000, balance: 2000, status: "open" }],
    payables: [{ _id: payableId, payableCode: "TR-01", supplierName: "Nhà cung cấp B", originalAmount: 4000, balance: 1000, status: "open" }],
    unregisteredReceipts: [{ _id: receiptId, receiptCode: "PN-01", supplierName: "Nhà cung cấp A", subtotal: 5000, receivedAt: "2026-10-30" }],
  } }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const payable = ASSISTANT_OPERATIONS.find(item => item.method === "POST" && item.path === "/finance/management/payables")!;
  const receiptField = payable.fields.find(field => field.apiKey === "receiptId")!;
  const receipts = await suggestReferenceOptions(req, payable, receiptField, {} as any);
  expect(receipts).toEqual(["Phiếu nhập chưa ghi công nợ — PN-01 — Nhà cung cấp A — 5.000 ₫"]);
  expect(JSON.stringify(receipts)).not.toContain(receiptId);
  const payableResolution = await resolveReferences(req, payable, { receiptId: receipts[0], dueDate: "2026-11-10", openingPaid: 0 } as any);
  expect(payableResolution.errors).toEqual([]);
  expect(payableResolution.values.receiptId).toBe(receiptId);

  const followup = ASSISTANT_OPERATIONS.find(item => item.method === "POST" && item.path === "/finance/management/followups")!;
  const targetField = followup.fields.find(field => field.apiKey === "targetId")!;
  const payableOptions = await suggestReferenceOptions(req, followup, targetField, { targetType: "payable" } as any);
  expect(payableOptions).toEqual(["Phải trả — TR-01 — Nhà cung cấp B — 1.000 ₫"]);
  const followupResolution = await resolveReferences(req, followup, { targetType: "payable", targetId: payableOptions[0], status: "contacted" } as any);
  expect(followupResolution.errors).toEqual([]);
  expect(followupResolution.values.targetId).toBe(payableId);
});
it("suggests finance follow-up assignees by employee name and stores the selected name", async () => {
  const employeeId = "507f1f77bcf86cd799439415";
  const fetcher = vi.fn().mockImplementation((rawInput: URL | string) => {
    const input = rawInput instanceof URL ? rawInput : new URL(String(rawInput));
    if (input.pathname === "/api/v1/auth/users") return new Response(JSON.stringify({ status: "success", data: [
      { _id: employeeId, displayName: "\u0110\u1ED7 \u0110\u1EE9c Chung", email: "chung@example.test", companyCode: "TEST" },
    ] }), { status: 200 });
    throw new Error(`Unexpected request: ${input.pathname}`);
  });
  vi.stubGlobal("fetch", fetcher);
  const followup = ASSISTANT_OPERATIONS.find(item => item.method === "POST" && item.path === "/finance/management/followups")!;
  const field = followup.fields.find(candidate => candidate.apiKey === "assignee")!;
  const suggestions = await suggestReferenceOptions(req, followup, field, {} as any);
  expect(suggestions).toContain("\u0110\u1ED7 \u0110\u1EE9c Chung");
  expect(JSON.stringify(suggestions)).not.toContain(employeeId);
  const resolved = await resolveReferences(req, followup, { targetType: "receivable", assignee: "\u0110\u1ED7 \u0110\u1EE9c Chung" } as any);
  expect(resolved.errors).toEqual([]);
  expect(resolved.values.assignee).toBe("\u0110\u1ED7 \u0110\u1EE9c Chung");
});
it("resolves Content Sheet rows by campaign and visible schedule label", async () => {
  const campaignId = "507f1f77bcf86cd799439501";
  const slotId = "507f1f77bcf86cd799439502";
  const fetcher = vi.fn().mockImplementation(async (input: URL) => {
    if (input.pathname === "/api/v1/marketing-campaigns/assistant/summaries") return new Response(JSON.stringify({ data: { items: [
      { _id: campaignId, title: "Chiến dịch tháng 11", status: "active", startDate: "2026-11-01", endDate: "2026-11-30" },
    ] } }), { status: 200 });
    if (input.pathname === `/api/v1/marketing-campaigns/${campaignId}/sheet/slots`) return new Response(JSON.stringify({ data: [
      { id: slotId, name: "Dòng 1 — 2026-11-03 09:00 — Facebook — Trang Igen — planned", scheduledAt: "2026-11-03T09:00:00.000Z", platform: "Facebook", page: "Trang Igen", status: "planned" },
    ] }), { status: 200 });
    throw new Error(`Unexpected request: ${input.pathname}`);
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.campaign.sheet.cells.update")!;
  const result = await resolveReferences(req, operation, {
    path_id: "Chiến dịch tháng 11",
    rows: JSON.stringify([{ slotId: "Dòng 1 — 2026-11-03 09:00 — Facebook — Trang Igen — planned", expectedRevision: 1, changes: [{ key: "title", value: "Bài viết mới" }] }]),
  } as any);
  expect(result.errors).toEqual([]);
  expect(JSON.parse(String(result.values.rows))[0].slotId).toBe(slotId);
  expect(JSON.stringify(result.labels)).toContain("Trang Igen");
  expect(JSON.stringify(result.labels)).not.toContain(campaignId);
  expect(JSON.stringify(result.labels)).not.toContain(slotId);
  expect(fetcher.mock.calls.map(([input]) => (input as URL).pathname)).toContain(`/api/v1/marketing-campaigns/${campaignId}/sheet/slots`);
});

it("resolves Content Sheet job rows and target columns within the selected campaign", async () => {
  const campaignId = "507f1f77bcf86cd799439511";
  const slotId = "507f1f77bcf86cd799439512";
  const fetcher = vi.fn().mockImplementation(async (input: URL) => {
    if (input.pathname === "/api/v1/marketing-campaigns/assistant/summaries") return new Response(JSON.stringify({ data: { items: [
      { _id: campaignId, title: "Chiến dịch tháng 12", status: "active", startDate: "2026-12-01", endDate: "2026-12-31" },
    ] } }), { status: 200 });
    if (input.pathname === `/api/v1/marketing-campaigns/${campaignId}/sheet/slots`) return new Response(JSON.stringify({ data: [
      { id: slotId, name: "Dòng 1 — 2026-12-03 09:00 — Facebook — Trang Igen — planned", scheduledAt: "2026-12-03T09:00:00.000Z", platform: "Facebook", page: "Trang Igen", status: "planned" },
    ] }), { status: 200 });
    if (input.pathname === `/api/v1/marketing-campaigns/${campaignId}/sheet/columns/assistant-summaries`) return new Response(JSON.stringify({ data: [
      { id: "column-hook", name: "Câu mở đầu (hook)", label: "Câu mở đầu", key: "hook", kind: "custom", dataType: "short_text", required: false, fieldPolicy: "input" },
    ] }), { status: 200 });
    throw new Error(`Unexpected request: ${input.pathname}`);
  });
  vi.stubGlobal("fetch", fetcher);

  const operation = ASSISTANT_OPERATIONS.find(item => item.method === "POST" && item.path === "/marketing-campaigns/:id/sheet/ai/jobs")!;
  const resolution = await resolveReferences(req, operation, {
    path_id: "Chiến dịch tháng 12",
    slotIds: JSON.stringify(["Dòng 1 — 2026-12-03 09:00 — Facebook — Trang Igen — planned"]),
    targetFieldKeys: JSON.stringify(["Câu mở đầu (hook)"]),
    overwritePolicy: "empty_only",
  } as any);

  expect(resolution.errors).toEqual([]);
  expect(resolution.values.path_id).toBe(campaignId);
  expect(JSON.parse(String(resolution.values.slotIds))).toEqual([slotId]);
  expect(JSON.parse(String(resolution.values.targetFieldKeys))).toEqual(["hook"]);
  expect(JSON.stringify(resolution.labels)).not.toMatch(/507f1f77|column-hook/);
  expect(fetcher.mock.calls.map(([input]) => (input as URL).pathname)).toContain(`/api/v1/marketing-campaigns/${campaignId}/sheet/columns/assistant-summaries`);
});
it("resolves settlement referrals under the selected labor partner", async () => {
  const partnerId = "507f1f77bcf86cd799439601";
  const referralId = "507f1f77bcf86cd799439602";
  const fetcher = vi.fn().mockImplementation(async (input: URL) => {
    if (input.pathname === "/api/v1/worker-management/partners") return new Response(JSON.stringify({ data: [
      { _id: partnerId, name: "Nhà thầu Minh", code: "NT01", status: "active" },
    ] }), { status: 200 });
    if (input.pathname === `/api/v1/worker-management/partners/${partnerId}/referrals`) return new Response(JSON.stringify({ data: [
      { _id: referralId, workerName: "Đỗ Đức Chung", effectiveFrom: "2026-01-01", effectiveTo: null, status: "active", commissionScheme: "official_monthly" },
    ] }), { status: 200 });
    throw new Error(`Unexpected request: ${input.pathname}`);
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "worker.partner.settlement.calculate")!;
  const result = await resolveReferences(req, operation, {
    partnerId: "Nhà thầu Minh — mã NT01",
    periodAnchor: "2026-11-01",
    manualEntries: JSON.stringify([{ referralId: "Đỗ Đức Chung — hiệu lực 2026-01-01 — active", officialMonths: 1 }]),
  } as any);
  expect(result.errors).toEqual([]);
  expect(JSON.parse(String(result.values.manualEntries))[0].referralId).toBe(referralId);
  expect(JSON.stringify(result.labels)).toContain("Đỗ Đức Chung");
  expect(JSON.stringify(result.labels)).not.toContain(partnerId);
  expect(JSON.stringify(result.labels)).not.toContain(referralId);
  expect(fetcher.mock.calls.map(([input]) => (input as URL).pathname)).toContain(`/api/v1/worker-management/partners/${partnerId}/referrals`);
});
it("suggests only the selected roadmap step for the selected course and resolves all links by name", async () => {
  const roadmapId = "507f1f77bcf86cd799439101";
  const courseId = "507f1f77bcf86cd799439102";
  const fetcher = vi.fn().mockImplementation(async (input: URL) => {
    if (input.pathname === "/api/v1/courses") return new Response(JSON.stringify({ success: true, courses: [
      { _id: courseId, title: "Tiếng Anh", code: "EN", status: "Hoạt động" },
      { _id: "507f1f77bcf86cd799439103", title: "Tin học", code: "IT", status: "Hoạt động" },
    ] }), { status: 200 });
    if (input.pathname === "/api/v1/learning-roadmaps") return new Response(JSON.stringify({ success: true, data: [
      { _id: roadmapId, name: "Lộ trình ngoại ngữ", code: "NN", status: "active" },
      { _id: "507f1f77bcf86cd799439104", name: "Lộ trình cũ", code: "OLD", status: "inactive" },
    ] }), { status: 200 });
    if (input.pathname === `/api/v1/learning-roadmaps/${roadmapId}/steps`) return new Response(JSON.stringify({ success: true, data: [
      { stepId: "english-1", name: "Chặng 1: Tiếng Anh", code: "EN", courseId, courseTitle: "Tiếng Anh", order: 1 },
    ] }), { status: 200 });
    throw new Error(`Unexpected request: ${input.pathname}`);
  });
  vi.stubGlobal("fetch", fetcher);

  const create = ASSISTANT_OPERATIONS.find(item => item.id === "student.batch.create")!;
  const roadmapField = create.fields.find(field => field.key === "roadmapId")!;
  const stepField = create.fields.find(field => field.key === "roadmapStepId")!;
  const roadmapOptions = await suggestReferenceOptions(req, create, roadmapField, {} as any);
  expect(roadmapOptions).toEqual(["Lộ trình ngoại ngữ — mã NN"]);
  const stepOptions = await suggestReferenceOptions(req, create, stepField, {
    roadmapId: "Lộ trình ngoại ngữ — mã NN",
    courseId: "Tiếng Anh — mã EN",
  } as any);
  expect(stepOptions).toEqual(["Chặng 1: Tiếng Anh — mã EN"]);
  const resolution = await resolveReferences(req, create, {
    code: "EN-01", name: "Lớp tiếng Anh", courseId: "Tiếng Anh — mã EN",
    roadmapId: "Lộ trình ngoại ngữ — mã NN", roadmapStepId: "Chặng 1: Tiếng Anh — mã EN",
    daysOfWeek: "[1,3]", startTime: "08:00", endTime: "09:30", startDate: "2026-11-02", endDate: "2027-02-02",
  } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values).toMatchObject({ courseId, roadmapId, roadmapStepId: "english-1" });
  const stepRequest = fetcher.mock.calls.map(([input]) => input as URL).find(url => url.pathname.endsWith("/steps"))!;
  expect(stepRequest.searchParams.get("courseId")).toBe(courseId);
});

it("offers exam choices by name and date without exposing student result rows", async () => {
  const firstId = "507f1f77bcf86cd799439201";
  const secondId = "507f1f77bcf86cd799439202";
  const fetcher = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ success: true, exams: [
    { _id: firstId, name: "Thi sát hạch", rank: "B2", tentativeDate: "2026-11-12", status: "Sắp diễn ra", results: [{ studentId: "PRIVATE-STUDENT", score: 88 }] },
    { _id: secondId, name: "Thi sát hạch", rank: "B2", tentativeDate: "2026-12-12", status: "Sắp diễn ra", results: [{ studentId: "PRIVATE-STUDENT-2", score: 91 }] },
  ] }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const deletion = ASSISTANT_OPERATIONS.find(item => item.id === "student.exam.delete")!;
  const pathField = deletion.fields.find(field => field.key === "path_id")!;
  const suggestions = await suggestReferenceOptions(req, deletion, pathField, {} as any);
  expect(suggestions).toEqual([
    "Thi sát hạch · B2 · 2026-11-12 · Sắp diễn ra",
    "Thi sát hạch · B2 · 2026-12-12 · Sắp diễn ra",
  ]);
  expect(JSON.stringify(suggestions)).not.toMatch(/PRIVATE-STUDENT|507f1f77/);
  const selected = await resolveReferences(req, deletion, { path_id: suggestions[1] } as any);
  expect(selected.errors).toEqual([]);
  expect(selected.values.path_id).toBe(secondId);
});
it("suggests and resolves exam students by name within the selected exam, then returns only grading summaries", async () => {
  const examId = "507f1f77bcf86cd799439211";
  const studentId = "507f1f77bcf86cd799439212";
  const examLabel = "Thi sát hạch · B2 · 2026-11-12 · Sắp diễn ra";
  const studentLabel = "Nguyễn An — 0900000000";
  const fetcher = vi.fn().mockImplementation(async (rawInput: URL | string, init?: RequestInit) => {
    const url = rawInput instanceof URL ? rawInput : new URL(String(rawInput));
    if (url.pathname === "/api/v1/exams" && init?.method !== "PATCH" && init?.method !== "POST") {
      return new Response(JSON.stringify({ success: true, exams: [
        { _id: examId, name: "Thi sát hạch", rank: "B2", tentativeDate: "2026-11-12", status: "Sắp diễn ra" },
      ] }), { status: 200 });
    }
    if (url.pathname === `/api/v1/exams/${examId}/grade-roster`) {
      return new Response(JSON.stringify({ success: true, data: [
        { _id: studentId, name: "Nguyễn An", phone: "0900000000", score: 0, outcome: "Chưa có" },
      ] }), { status: 200 });
    }
    if (url.pathname === `/api/v1/exams/${examId}/results` && init?.method === "PATCH") {
      return new Response(JSON.stringify({ success: true, data: {
        _id: examId, name: "Thi sát hạch", status: "Đã thi", studentCount: 1, passCount: 1, failCount: 0,
        results: [{ studentId, score: 88 }],
      } }), { status: 200 });
    }
    if (url.pathname === `/api/v1/exams/${examId}/students/${studentId}/result` && init?.method === "POST") {
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }
    throw new Error(`Unexpected request: ${init?.method || "GET"} ${url.pathname}`);
  });
  vi.stubGlobal("fetch", fetcher);

  const bulk = ASSISTANT_OPERATIONS.find(item => item.id === "student.exam.grade-results.update")!;
  const resultsField = bulk.fields.find(field => field.key === "results")!;
  const studentShape = resultsField.structure!.items!.keys!.studentId as any;
  const options = await suggestReferenceOptions(req, bulk, { ...studentShape, key: "results[].studentId" } as any, { path_id: examLabel } as any);
  expect(options).toEqual([studentLabel]);
  expect(JSON.stringify(options)).not.toMatch(/507f1f77|PRIVATE/);

  const resolved = await resolveReferences(req, bulk, {
    path_id: examLabel,
    results: JSON.stringify([{ studentId: studentLabel, score: 88, note: "Đạt yêu cầu" }]),
  } as any);
  expect(resolved.errors).toEqual([]);
  expect(resolved.values.path_id).toBe(examId);
  expect(JSON.parse(String(resolved.values.results))).toEqual([{ studentId, score: 88, note: "Đạt yêu cầu" }]);
  expect(String(resolved.labels.results)).toContain(studentLabel);

  const graded = await callOperation(req, bulk, resolved.values as any);
  expect(graded.data).toEqual({ name: "Thi sát hạch", status: "Đã thi", gradedCount: 1, studentCount: 1, passCount: 1, failCount: 0 });
  expect(JSON.stringify(graded)).not.toMatch(/507f1f77|studentId|results/);
  const bulkWrite = fetcher.mock.calls.find(([input, init]) => new URL(String(input)).pathname.endsWith("/results") && init?.method === "PATCH")!;
  expect(JSON.parse(String(bulkWrite[1].body))).toEqual({ results: [{ studentId, score: 88, note: "Đạt yêu cầu" }] });

  const individual = ASSISTANT_OPERATIONS.find(item => item.id === "student.exam.result.update")!;
  const studentPath = individual.fields.find(field => field.key === "path_studentId")!;
  const studentOptions = await suggestReferenceOptions(req, individual, studentPath, { path_id: examLabel } as any);
  expect(studentOptions).toEqual([studentLabel]);
  const singleResolution = await resolveReferences(req, individual, {
    path_id: examLabel, path_studentId: studentLabel, overallResult: "Đậu",
  } as any);
  expect(singleResolution.errors).toEqual([]);
  expect(singleResolution.values).toMatchObject({ path_id: examId, path_studentId: studentId, overallResult: "Đậu" });
  const updated = await callOperation(req, individual, singleResolution.values as any);
  expect(updated.data).toEqual({ updated: true });
  expect(JSON.stringify(updated)).not.toMatch(/507f1f77|studentId/);
});
it("unassigns only a student found in the selected exam's active-assignment roster", async () => {
  const examId = "507f1f77bcf86cd799439221";
  const studentId = "507f1f77bcf86cd799439222";
  const examLabel = "Thi sát hạch · B2 · 2026-11-12 · Sắp diễn ra";
  const studentLabel = "Nguyễn An — 0900000000";
  const fetcher = vi.fn().mockImplementation(async (rawInput: URL | string, init?: RequestInit) => {
    const url = rawInput instanceof URL ? rawInput : new URL(String(rawInput));
    if (url.pathname === "/api/v1/exams") return new Response(JSON.stringify({ success: true, exams: [
      { _id: examId, name: "Thi sát hạch", rank: "B2", tentativeDate: "2026-11-12", status: "Sắp diễn ra" },
    ] }), { status: 200 });
    if (url.pathname === `/api/v1/exams/${examId}/assigned-students`) return new Response(JSON.stringify({ success: true, data: [
      { _id: studentId, name: "Nguyễn An", phone: "0900000000", fee: "PRIVATE-TUITION" },
    ] }), { status: 200 });
    if (url.pathname === `/api/v1/exams/${examId}/unassign` && init?.method === "POST") {
      return new Response(JSON.stringify({ success: true, message: "Removed" }), { status: 200 });
    }
    throw new Error(`Unexpected request: ${init?.method || "GET"} ${url.pathname}`);
  });
  vi.stubGlobal("fetch", fetcher);

  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "student.exam.unassign")!;
  const studentField = operation.fields.find(field => field.key === "studentId")!;
  const suggestions = await suggestReferenceOptions(req, operation, studentField, { path_id: examLabel } as any);
  expect(suggestions).toEqual([studentLabel]);
  expect(JSON.stringify(suggestions)).not.toMatch(/507f1f77|PRIVATE/);

  const resolved = await resolveReferences(req, operation, { path_id: examLabel, studentId: studentLabel } as any);
  expect(resolved.errors).toEqual([]);
  expect(resolved.values).toMatchObject({ path_id: examId, studentId });
  const result = await callOperation(req, operation, resolved.values as any);
  expect(result.data).toEqual({ unassigned: true });
  expect(JSON.stringify(result)).not.toMatch(/507f1f77|studentId|PRIVATE/);
  const write = fetcher.mock.calls.find(([input, init]) => new URL(String(input)).pathname.endsWith("/unassign") && init?.method === "POST")!;
  expect(JSON.parse(String(write[1].body))).toEqual({ studentId });
});
it("shows department names and headcount, and preserves the selected name for metadata-only updates", async () => {
  const departmentId = "507f1f77bcf86cd799439301";
  const fetcher = vi.fn().mockImplementation(async (_input: URL, init?: RequestInit) => {
    if (init?.method === "PATCH") return new Response(JSON.stringify({ data: {
      id: departmentId, name: "Kinh doanh", code: "KD", description: "Bán hàng",
      managerName: "Nguyễn Văn An", sortOrder: 2, isActive: true,
    } }), { status: 200 });
    return new Response(JSON.stringify({ data: [{
      id: departmentId, name: "Kinh doanh", code: "KD", description: "Bán hàng",
      managerName: "Nguyễn Văn An", managerUid: "PRIVATE-MANAGER-ID", sortOrder: 2,
      isActive: true, employeeCount: 8, companyCode: "TEST",
    }] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);

  const list = ASSISTANT_OPERATIONS.find(item => item.id === "department.list")!;
  const listed = await callOperation(req, list, {} as any);
  const listReply = formatAssistantResult(list, listed.data);
  expect(listReply).toContain("Trưởng phòng: Nguyễn Văn An");
  expect(listReply).toContain("Số nhân sự: 8");
  expect(listReply).not.toMatch(/PRIVATE|companyCode|507f1f77bcf86cd799439301/);

  const update = ASSISTANT_OPERATIONS.find(item => item.id === "department.update")!;
  const resolution = await resolveReferences(req, update, { id: "Kinh doanh", code: "SALES" } as any);
  expect(resolution.errors).toEqual([]);
  const result = await callOperation(req, update, resolution.values as any);
  const write = fetcher.mock.calls.find(([, init]) => init?.method === "PATCH")!;
  expect(JSON.parse(String(write[1].body))).toEqual({ name: "Kinh doanh", code: "SALES" });
  expect(formatAssistantResult(update, result.data)).toContain("Tên phòng ban: Kinh doanh");
});

it("confirms department deletion and reports only completion status", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { id: "507f1f77bcf86cd799439302" } }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "department.delete")!;
  const result = await callOperation(req, operation, { id: "507f1f77bcf86cd799439302" } as any);
  expect(result.data).toEqual({ deleted: true });
  expect(formatAssistantResult(operation, result.data)).toContain("Đã xóa phòng ban: Có");
  expect(JSON.stringify(result)).not.toContain("507f1f77bcf86cd799439302");
});

it("binds path/query/body from code and pins authenticated scope and loopback origin", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: [] }), { status: 200 })); vi.stubGlobal("fetch", fetcher);
  const op = ASSISTANT_OPERATIONS.find(o => o.path === "/finance/management/report" && o.method === "GET")!;
  await callOperation(req, op, { query_from: "2026-10-01", query_to: "2026-10-31", companyCode: "OTHER", branchId: "OTHER" });
  const url = fetcher.mock.calls[0][0] as URL;
  expect(url.origin).toBe("http://127.0.0.1:4050"); expect(url.searchParams.get("companyCode")).toBe("TEST");
  expect(url.searchParams.get("branchId")).toBe(req.user.branchId);
  expect(url.searchParams.get("from")).toBe("2026-10-01"); expect(fetcher.mock.calls[0][1].body).toBeUndefined();
});
it("reads student standard-field overrides with an allowlisted response", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: [{
    key: "fullName", label: "Họ và tên", placeholder: "Nhập họ tên", isRequired: true, isVisible: true, isArchived: false,
    _id: "internal-field-id", tenantId: "INTERNAL-TENANT", updatedBy: "internal-user",
  }] }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "student.standard-fields.list")!;
  const result = await callOperation(req, operation, { path_moduleKey: "students" } as any);
  expect((fetcher.mock.calls[0][0] as URL).pathname).toBe("/api/v1/student-management/standard-fields/students");
  const reply = formatAssistantResult(operation, result.data);
  expect(reply).toContain("Bắt buộc: Có");
  expect(reply).toContain("Đang hiển thị: Có");
  expect(reply).not.toMatch(/internal-field-id|INTERNAL-TENANT|internal-user/);
});

it("updates a named standard field and preserves every other saved override", async () => {
  const currentFields = [
    { key: "fullName", label: "Họ và tên", placeholder: "Nhập họ tên", isRequired: false, isVisible: true, isArchived: false, tenantId: "PRIVATE-TENANT", updatedBy: "PRIVATE-ACTOR" },
    { key: "phone", label: "Số điện thoại", placeholder: "Nhập số điện thoại", isRequired: true, isVisible: true, isArchived: false, tenantId: "PRIVATE-TENANT", updatedBy: "PRIVATE-ACTOR" },
  ];
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/student-management/standard-fields/students" && init?.method === "PUT") {
      return new Response(JSON.stringify({ success: true, data: JSON.parse(String(init.body)).fields.map((field: any) => ({ ...field, _id: "PRIVATE-ID", tenantId: "PRIVATE-TENANT", updatedBy: "PRIVATE-ACTOR" })) }), { status: 200 });
    }
    if (input.pathname === "/api/v1/student-management/standard-fields/students") return new Response(JSON.stringify({ success: true, data: currentFields }), { status: 200 });
    return new Response(JSON.stringify({ success: false, error: "Unexpected route" }), { status: 404 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "student.standard-fields.update")!;
  const resolution = await resolveReferences(req, operation, {
    path_moduleKey: "students", selectedField: "Họ và tên", isRequired: true,
  } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.selectedField).toBe("fullName");
  expect(resolution.labels.selectedField).toContain("Họ và tên");

  const result = await callOperation(req, operation, resolution.values as any);
  const write = fetcher.mock.calls.find(([, init]) => init?.method === "PUT")!;
  const payload = JSON.parse(String(write[1].body));
  expect(payload.fields).toHaveLength(2);
  expect(payload.fields).toEqual([
    { key: "fullName", label: "Họ và tên", placeholder: "Nhập họ tên", isRequired: true, isVisible: true, isArchived: false },
    { key: "phone", label: "Số điện thoại", placeholder: "Nhập số điện thoại", isRequired: true, isVisible: true, isArchived: false },
  ]);
  expect(result.data).toEqual({ label: "Họ và tên", placeholder: "Nhập họ tên", isRequired: true, isVisible: true, isArchived: false });
  expect(formatAssistantResult(operation, result.data)).toContain("Bắt buộc nhập: Có");
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE|_id|updatedBy/);
});

it("stops a standard-field update when the existing configuration cannot be safely preserved", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: [
    { key: "fullName", label: "Họ và tên", isRequired: true, isVisible: true },
  ] }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "student.standard-fields.update")!;
  await expect(callOperation(req, operation, { path_moduleKey: "students", selectedField: "fullName", isRequired: false } as any))
    .rejects.toThrow("thiếu, trùng hoặc không hợp lệ");
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls.every(([, init]) => init?.method !== "PUT")).toBe(true);
});

it("reads worker profile fields safely and updates one selected field by its displayed name", async () => {
  const currentFields = [
    { key: "fullName", label: "Họ và tên", placeholder: "Nhập họ tên", isRequired: true, isVisible: true, isArchived: false, extraConfig: { section: "Thông tin chung" } },
    { key: "phone", label: "Số điện thoại", placeholder: "Nhập số điện thoại", isRequired: true, isVisible: true, isArchived: false, privateOwner: "PRIVATE-ACTOR" },
    { key: "customBadge", label: "Huy hiệu nội bộ", placeholder: "", isRequired: false, isVisible: true, isArchived: false, customRule: { source: "PRIVATE-RULE" } },
  ];
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/worker-management/standard-fields" && init?.method === "PUT") {
      const fields = JSON.parse(String(init.body)).fields;
      return new Response(JSON.stringify({ success: true, data: { moduleKey: "students", fields, companyCode: "PRIVATE-COMPANY" } }), { status: 200 });
    }
    if (input.pathname === "/api/v1/worker-management/standard-fields") {
      return new Response(JSON.stringify({ success: true, data: currentFields }), { status: 200 });
    }
    return new Response(JSON.stringify({ success: false, error: "Unexpected route" }), { status: 404 });
  });
  vi.stubGlobal("fetch", fetcher);

  const list = ASSISTANT_OPERATIONS.find(item => item.id === "worker.standard-fields.list")!;
  const listed = await callOperation(req, list, { query_moduleKey: "students" } as any);
  expect((fetcher.mock.calls[0][0] as URL).searchParams.get("moduleKey")).toBe("students");
  expect(formatAssistantResult(list, listed.data)).toContain("Số điện thoại");
  expect(JSON.stringify(listed)).not.toMatch(/PRIVATE|customBadge|privateOwner|extraConfig/);

  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "worker.standard-fields.update")!;
  const resolution = await resolveReferences(req, operation, { selectedField: "Số điện thoại", label: "Điện thoại liên hệ", isVisible: false } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.selectedField).toBe("phone");
  expect(resolution.labels.selectedField).toContain("Số điện thoại");

  const result = await callOperation(req, operation, resolution.values as any);
  const write = fetcher.mock.calls.find(([, init]) => init?.method === "PUT")!;
  const payload = JSON.parse(String(write[1].body));
  expect(payload).toMatchObject({ moduleKey: "students" });
  expect(payload.fields).toEqual([
    currentFields[0],
    { ...currentFields[1], label: "Điện thoại liên hệ", isRequired: false, isVisible: false },
    currentFields[2],
  ]);
  expect(result.data).toEqual({ label: "Điện thoại liên hệ", isRequired: false, isVisible: false, isArchived: false });
  expect(formatAssistantResult(operation, result.data)).toContain("Đang hiển thị: Không");
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE|customBadge|customRule|privateOwner|companyCode/);
});

it("does not write worker field overrides when the saved configuration is malformed", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: [
    { key: "phone", label: "Số điện thoại", isRequired: true, isVisible: true },
  ] }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "worker.standard-fields.update")!;
  await expect(callOperation(req, operation, { selectedField: "phone", isRequired: false } as any))
    .rejects.toThrow("thiếu, trùng hoặc không hợp lệ");
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls.every(([, init]) => init?.method !== "PUT")).toBe(true);
});

it("reverses a named worker partner payout only when it is still reversible in the selected settlement", async () => {
  const settlementId = "507f1f77bcf86cd799439211";
  const payoutId = "507f1f77bcf86cd799439212";
  const alreadyReversedId = "507f1f77bcf86cd799439213";
  const reversalId = "507f1f77bcf86cd799439214";
  const settlement = {
    _id: settlementId, partnerId: { _id: "507f1f77bcf86cd799439215", code: "LP-01", name: "Công ty Sao Mai", bankAccountNo: "PRIVATE-ACCOUNT" },
    periodStart: "2026-10-01", periodEnd: "2026-10-31", status: "paid", totalAmount: 350000, paidAmount: 350000, balanceAmount: 0, version: 4,
    payouts: [
      { _id: payoutId, amount: 250000, paidAt: "2026-10-31T08:15:00.000Z", method: "bank_transfer", reference: "PRIVATE-BANK-REFERENCE", idempotencyKey: "PRIVATE-KEY", createdBy: { userId: "PRIVATE-ACTOR" } },
      { _id: alreadyReversedId, amount: 100000, paidAt: "2026-10-31T08:16:00.000Z", method: "cash", reversalOfPayoutId: null },
      { _id: reversalId, amount: -100000, paidAt: "2026-10-31T08:17:00.000Z", method: "cash", reversalOfPayoutId: alreadyReversedId },
    ],
  };
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/worker-management/partners/settlements" && init?.method !== "POST") {
      return new Response(JSON.stringify({ success: true, data: [{
        _id: settlementId, partnerName: "Công ty Sao Mai", partnerCode: "LP-01", periodStart: "2026-10-01", periodEnd: "2026-10-31",
        status: "paid", totalAmount: 350000, paidAmount: 350000, balanceAmount: 0, version: 4,
      }] }), { status: 200 });
    }
    if (input.pathname === `/api/v1/worker-management/partners/settlements/${settlementId}`) {
      return new Response(JSON.stringify({ success: true, data: settlement }), { status: 200 });
    }
    if (input.pathname === `/api/v1/worker-management/partners/payouts/${payoutId}/reverse` && init?.method === "POST") {
      return new Response(JSON.stringify({ success: true, data: {
        reversal: { _id: reversalId, amount: -250000, paidAt: "2026-10-31T09:00:00.000Z", method: "bank_transfer", reference: "PRIVATE-BANK-REFERENCE" },
        settlement: { status: "partially_paid", balanceAmount: 250000, companyCode: "PRIVATE-COMPANY" },
      } }), { status: 201 });
    }
    return new Response(JSON.stringify({ success: false, error: "Unexpected route" }), { status: 404 });
  });
  vi.stubGlobal("fetch", fetcher);

  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "worker.partner.payout.reverse")!;
  const alreadyReversed = await resolveReferences(req, operation, {
    selectedSettlement: "Công ty Sao Mai", path_payoutId: "Công ty Sao Mai · 2026-10-01 đến 2026-10-31 · 2026-10-31T08:16:00.000Z · 100.000 ₫ · Tiền mặt",
  } as any);
  expect(alreadyReversed.errors.length).toBeGreaterThan(0);

  const resolution = await resolveReferences(req, operation, {
    selectedSettlement: "Công ty Sao Mai",
    path_payoutId: "Công ty Sao Mai · 2026-10-01 đến 2026-10-31 · 2026-10-31T08:15:00.000Z · 250.000 ₫ · Chuyển khoản",
  } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values).toMatchObject({ selectedSettlement: settlementId, path_payoutId: payoutId });

  const result = await callOperation(req, operation, resolution.values as any);
  const write = fetcher.mock.calls.find(([, init]) => init?.method === "POST")!;
  expect((write[0] as URL).pathname).toBe(`/api/v1/worker-management/partners/payouts/${payoutId}/reverse`);
  expect(JSON.parse(String(write[1].body))).toEqual({});
  expect(result.data).toEqual({ amount: 250000, paidAt: "2026-10-31T09:00:00.000Z", method: "Chuyển khoản", settlementStatus: "partially_paid", balanceAmount: 250000 });
  expect(formatAssistantResult(operation, result.data)).toContain("Số tiền: 250.000");
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE|507f1f77bcf86cd7994392/);
});

it("selects a connected Facebook Page and workflow version by visible names", async () => {
  const pageObjectId = "507f1f77bcf86cd799439131";
  const facebookPageId = "123456789012345";
  const flowId = "507f1f77bcf86cd799439132";
  const flow = {
    _id: flowId, companyCode: "PRIVATE-COMPANY", version: 2, status: "draft", goal: "Thu thập nhu cầu tư vấn",
    completionMessage: "Cảm ơn bạn đã chia sẻ.", fields: [{ key: "course_name", label: "Khóa học", question: "Bạn quan tâm khóa học nào?" }],
    sourceDocumentIds: ["PRIVATE-DOCUMENT-ID"], createdAt: "2026-10-30T01:14:21.000Z", createdBy: "PRIVATE-ACTOR",
  };
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/omni-inbox/accounts") return new Response(JSON.stringify({ success: true, data: [
      { _id: pageObjectId, companyCode: "TEST", displayName: "Page tiếp nhận", platform: "Facebook", username: facebookPageId, isConnected: true, accessToken: "PRIVATE-TOKEN" },
      { _id: "507f1f77bcf86cd799439133", companyCode: "TEST", displayName: "Page tiếp nhận", platform: "Facebook", username: "987654321012345", isConnected: false },
      { _id: "507f1f77bcf86cd799439134", companyCode: "TEST", displayName: "Page tiếp nhận", platform: "Zalo", username: "OA-1234567", isConnected: true },
    ] }), { status: 200 });
    if (input.pathname === `/api/v1/marketing-settings/chat-flows/${facebookPageId}` && init?.method !== "POST") {
      return new Response(JSON.stringify({ success: true, data: [flow] }), { status: 200 });
    }
    if (input.pathname === `/api/v1/marketing-settings/chat-flows/${facebookPageId}/2/activate` && init?.method === "POST") {
      return new Response(JSON.stringify({ success: true, data: { ...flow, status: "active" } }), { status: 200 });
    }
    if (input.pathname === `/api/v1/marketing-settings/chat-flows/${facebookPageId}/suggest` && init?.method === "POST") {
      return new Response(JSON.stringify({ success: true, data: {
        goal: "Thu thập nhu cầu tư vấn", completionMessage: "Cảm ơn bạn đã chia sẻ.",
        fields: [...flow.fields, { key: "invalid key", label: "Bỏ qua", question: "Không hợp lệ" }], sourceDocumentIds: ["PRIVATE-DOCUMENT-ID"],
      } }), { status: 200 });
    }
    if (input.pathname === `/api/v1/marketing-settings/chat-flows/${facebookPageId}/draft` && init?.method === "POST") {
      const draftBody = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ success: true, data: { ...flow, ...draftBody, version: 3, _id: "507f1f77bcf86cd799439135" } }), { status: 201 });
    }
    return new Response(JSON.stringify({ success: false, message: "Unexpected route" }), { status: 404 });
  });
  vi.stubGlobal("fetch", fetcher);

  const list = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.chat-flow.list")!;
  const pageCandidates = await lookupRecords(req, "omni-inbox.account.list", "Page tiếp nhận");
  expect(pageCandidates.map(candidate => ({ displayName: candidate.displayName, platform: candidate.platform, isConnected: candidate.isConnected, pageId: candidate.pageId }))).toEqual([
    { displayName: "Page tiếp nhận", platform: "Facebook", isConnected: true, pageId: facebookPageId },
    { displayName: "Page tiếp nhận", platform: "Facebook", isConnected: false, pageId: "987654321012345" },
    { displayName: "Page tiếp nhận", platform: "Zalo", isConnected: true, pageId: "OA-1234567" },
  ]);
  const pageResolution = await resolveReferences(req, list, { path_pageId: "Page tiếp nhận" } as any);
  expect(pageResolution.errors).toEqual([]);
  expect(pageResolution.values.path_pageId).toBe(facebookPageId);
  expect(pageResolution.labels.path_pageId).toContain("Page tiếp nhận");
  const listed = await callOperation(req, list, pageResolution.values as any);
  expect(listed.data).toEqual([{ version: 2, status: "draft", goal: "Thu thập nhu cầu tư vấn", completionMessage: "Cảm ơn bạn đã chia sẻ.", fields: flow.fields, createdAt: flow.createdAt }]);
  const listReply = formatAssistantResult(list, listed.data);
  expect(listReply).toContain("Bạn quan tâm khóa học nào?");
  expect(listReply).not.toMatch(/\{|\[|PRIVATE-DOCUMENT-ID/);

  const suggest = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.chat-flow.suggest")!;
  const suggestion = await callOperation(req, suggest, { path_pageId: facebookPageId, goal: "Thu thập nhu cầu tư vấn" } as any);
  expect(suggestion.data.fields).toEqual(flow.fields);
  expect(JSON.stringify(suggestion)).not.toMatch(/PRIVATE-DOCUMENT-ID|invalid key|sourceDocumentIds/);
  const draft = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.chat-flow.draft.create")!;
  const draftFields = [{ key: "course_name", label: "Khóa học", question: "Bạn quan tâm khóa học nào?" }];
  const createdDraft = await callOperation(req, draft, {
    path_pageId: facebookPageId, goal: "Thu thập nhu cầu tư vấn", completionMessage: "Cảm ơn bạn đã chia sẻ.", fields: JSON.stringify(draftFields),
  } as any);
  expect(createdDraft.data).toMatchObject({ version: 3, status: "draft", goal: "Thu thập nhu cầu tư vấn", fields: draftFields });
  expect(JSON.stringify(createdDraft)).not.toMatch(/PRIVATE|507f1f77bcf86cd799439135|sourceDocumentIds/);

  const activate = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.chat-flow.activate")!;
  const visibleVersion = "Thu thập nhu cầu tư vấn — phiên bản 2 — Bản nháp";
  const activation = await resolveReferences(req, activate, { path_pageId: "Page tiếp nhận", path_version: visibleVersion } as any);
  expect(activation.errors).toEqual([]);
  expect(activation.values).toMatchObject({ path_pageId: facebookPageId, path_version: "2" });
  const activated = await callOperation(req, activate, activation.values as any);
  expect(activated.data).toMatchObject({ version: 2, status: "active", goal: flow.goal, completionMessage: flow.completionMessage });
  const reply = formatAssistantResult(activate, activated.data);
  expect(reply).toContain("Đang hoạt động");
  expect(JSON.stringify({ listed, suggestion, createdDraft, activated, reply, labels: activation.labels })).not.toMatch(/PRIVATE|507f1f77bcf86cd79943913[1-5]|123456789012345|987654321012345|OA-1234567|accessToken|sourceDocumentIds/);
  const activateCall = fetcher.mock.calls.find(([url, init]) => init?.method === "POST" && (url as URL).pathname.endsWith("/2/activate"))!;
  expect((activateCall[0] as URL).pathname).toBe(`/api/v1/marketing-settings/chat-flows/${facebookPageId}/2/activate`);
  expect(JSON.parse(String(activateCall[1].body || "{}"))).toEqual({});
});

it("resolves personal notification actions by title and time and filters private fields", async () => {
  const notificationId = "507f1f77bcf86cd799439141";
  const notification = {
    _id: notificationId, companyCode: "TEST", recipientUid: "PRIVATE-RECIPIENT", title: "Cảnh báo tồn kho",
    body: "Sản phẩm cần kiểm tra số lượng.", type: "kho", read: false, createdAt: "2026-10-31T01:14:21.000Z",
    action: { tab: "PRIVATE-TAB", subTab: "PRIVATE-SUBTAB" }, privateMetadata: "PRIVATE-METADATA",
  };
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/notifications" && init?.method !== "PATCH") {
      return new Response(JSON.stringify({ status: "success", data: [notification], total: 1, unreadCount: 1 }), { status: 200 });
    }
    if (input.pathname === `/api/v1/notifications/${notificationId}/read` && init?.method === "PATCH") {
      return new Response(JSON.stringify({ status: "success", data: { ...notification, read: true } }), { status: 200 });
    }
    if (input.pathname === "/api/v1/notifications/read-all" && init?.method === "PATCH") {
      return new Response(JSON.stringify({ status: "success", data: { success: true } }), { status: 200 });
    }
    if (input.pathname === `/api/v1/notifications/${notificationId}` && init?.method === "DELETE") {
      return new Response(JSON.stringify({ status: "success", data: notification }), { status: 200 });
    }
    return new Response(JSON.stringify({ status: "error", message: "Unexpected route" }), { status: 404 });
  });
  vi.stubGlobal("fetch", fetcher);

  const list = ASSISTANT_OPERATIONS.find(op => op.id === "notification.list")!;
  const records = await lookupRecords(req, list.id, "Cảnh báo tồn kho");
  expect(records).toHaveLength(1);
  const displayTime = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(notification.createdAt));
  const visibleLabel = `Cảnh báo tồn kho · Kho · ${displayTime} · chưa đọc`;
  const listReply = formatAssistantResult(list, await callOperation(req, list, { query_limit: 10 } as any));
  expect(listReply).toContain("Sản phẩm cần kiểm tra số lượng.");
  expect(listReply).toContain("Kho");
  expect(listReply).toContain("Trạng thái đọc: Chưa đọc");
  expect(listReply).not.toMatch(/PRIVATE|507f1f77bcf86cd799439141/);

  const markRead = ASSISTANT_OPERATIONS.find(op => op.id === "notification.mark-read")!;
  const readResolution = await resolveReferences(req, markRead, { path_id: visibleLabel } as any);
  expect(readResolution.errors).toEqual([]);
  expect(readResolution.values.path_id).toBe(notificationId);
  const marked = await callOperation(req, markRead, readResolution.values as any);
  expect(marked.data).toMatchObject({ title: notification.title, type: "kho", read: true, createdAt: notification.createdAt });
  expect(JSON.stringify(marked)).not.toMatch(/PRIVATE|507f1f77bcf86cd799439141|recipientUid|action/);

  const markAllRead = ASSISTANT_OPERATIONS.find(op => op.id === "notification.mark-all-read")!;
  expect(await callOperation(req, markAllRead, {} as any)).toMatchObject({ data: { success: true } });
  const remove = ASSISTANT_OPERATIONS.find(op => op.id === "notification.delete")!;
  const deleteResolution = await resolveReferences(req, remove, { path_id: visibleLabel } as any);
  expect(deleteResolution.errors).toEqual([]);
  expect(deleteResolution.values.path_id).toBe(notificationId);
  expect(await callOperation(req, remove, deleteResolution.values as any)).toMatchObject({ data: { deleted: true } });
  const deleteCall = fetcher.mock.calls.find(([, init]) => init?.method === "DELETE")!;
  expect((deleteCall[0] as URL).pathname).toBe(`/api/v1/notifications/${notificationId}`);
});

it("reads the persisted entity preset without exposing or accepting a tenant id", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: { tenantId: "INTERNAL-TENANT", entityPreset: "worker" } }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "student.module-settings.get")!;
  const result = await callOperation(req, operation, {} as any);
  const reply = formatAssistantResult(operation, result.data);
  const url = fetcher.mock.calls[0][0] as URL;
  expect(url.pathname).toBe("/api/v1/student-management/settings");
  expect(url.searchParams.has("tenantId")).toBe(false);
  expect(reply).toContain("Loại hồ sơ: Người lao động");
  expect(reply).not.toContain("INTERNAL-TENANT");
});

it("resolves an education partner by exact name for bank and commission updates", async () => {
  const partnerId = "507f1f77bcf86cd799439108";
  const fetcher = vi.fn().mockImplementation(async (input: URL) => input.pathname === "/api/v1/partners"
    ? new Response(JSON.stringify({ success: true, partners: [{ _id: partnerId, __v: 0, name: "Nguyễn Hoàng Minh Phương", phone: "0985645175", isActive: true }] }), { status: 200 })
    : new Response(JSON.stringify({ success: true, data: [] }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  for (const id of ["partner.bank-details.update", "partner.commission.update"]) {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === id)!;
    const resolution = await resolveReferences(req, operation, { path_id: "Nguyễn Hoàng Minh Phương" } as any);
    expect(resolution.errors).toEqual([]);
    expect(resolution.values.path_id).toBe(partnerId);
    expect(resolution.labels.path_id).toContain("Nguyễn Hoàng Minh Phương");
    expect(JSON.stringify(resolution.labels)).not.toContain(partnerId);
  }
});
it("redacts private AI reply content and resolves feedback updates by visible channel and time", async () => {
  const logId = "507f1f77bcf86cd799439121";
  const rawLog = {
    _id: logId,
    channel: "facebook",
    status: "sent",
    feedback: "bad",
    createdAt: "2026-10-30T01:14:21.000Z",
    customerMessage: "PRIVATE CUSTOMER MESSAGE",
    aiResponse: "PRIVATE AI RESPONSE",
    contextPreview: "PRIVATE CONTEXT",
    feedbackNote: "PRIVATE INTERNAL NOTE",
    companyCode: "SECRET-COMPANY",
  };
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => input.pathname === "/api/v1/gemini/ai-reply-logs"
    ? new Response(JSON.stringify({ logs: [rawLog] }), { status: 200 })
    : new Response(JSON.stringify({ status: "success", log: { ...rawLog, feedback: "needs_fix", feedbackNote: "PRIVATE INTERNAL NOTE" } }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);

  const list = ASSISTANT_OPERATIONS.find(operation => operation.id === "omni-inbox.ai-reply-logs.list")!;
  const listed = await callOperation(req, list, { query_limit: 20 } as any);
  expect(listed.data).toEqual([{ __assistantRef: { id: logId }, channel: "facebook", status: "sent", feedback: "bad", createdAt: rawLog.createdAt }]);
  const reply = formatAssistantResult(list, listed.data);
  expect(reply).toContain("Facebook");
  expect(reply).toContain("Không đạt");
  expect(reply).toContain("Đã gửi");
  expect(reply).not.toMatch(/PRIVATE|SECRET-COMPANY|customerMessage|aiResponse|contextPreview|feedbackNote/);
  expect(JSON.stringify(listed)).not.toMatch(/PRIVATE|SECRET-COMPANY|customerMessage|aiResponse|contextPreview|feedbackNote/);

  const visibleRecord = (await lookupRecords(req, list.id))[0];
  const update = ASSISTANT_OPERATIONS.find(operation => operation.id === "omni-inbox.ai-reply-log.feedback.update")!;
  const displayTime = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(rawLog.createdAt));
  const visibleLabel = `Phản hồi AI · Facebook · ${displayTime} · không đạt · đã gửi`;
  const resolution = await resolveReferences(req, update, { path_id: visibleLabel, feedback: "needs_fix", note: "Rà soát cách trả lời" } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.path_id).toBe(logId);
  expect(resolution.labels.path_id).toBe(visibleLabel);
  expect(visibleRecord.id).toBe(logId);
  const updated = await callOperation(req, update, resolution.values as any);
  expect(updated.data).toEqual({ feedback: "needs_fix", channel: "facebook", status: "sent", createdAt: rawLog.createdAt });
  expect(JSON.stringify(updated)).not.toMatch(/PRIVATE|SECRET-COMPANY|customerMessage|aiResponse|contextPreview|feedbackNote/);
  const [url, options] = fetcher.mock.calls.at(-1) as [URL, RequestInit];
  expect(url.pathname).toBe(`/api/v1/gemini/ai-reply-logs/${logId}/feedback`);
  expect(JSON.parse(String(options.body))).toEqual({ feedback: "needs_fix", note: "Rà soát cách trả lời" });
});
it.each([
  ["omni-inbox.facebook-conversations.list", "/api/v1/facebook/messenger/conversations", "Facebook"],
  ["omni-inbox.zalo-conversations.list", "/api/v1/zalo/conversations", "Zalo"],
  ["omni-inbox.tiktok-conversations.list", "/api/v1/tiktok/messenger/conversations", "TikTok"],
])("projects %s to safe customer and inbox status fields", async (id, path, channel) => {
  const conversationId = "507f1f77bcf86cd799439122";
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: [{
    _id: conversationId,
    senderName: "Nguyễn An",
    lastMessageAt: "2026-10-30T01:14:21.000Z",
    unreadCount: 2,
    status: "open",
    isVip: true,
    lastMessageText: "PRIVATE CUSTOMER MESSAGE",
    recipientId: "PRIVATE-PSID",
    openId: "PRIVATE-OPEN-ID",
    pageId: "PRIVATE-PAGE-ID",
    oaId: "PRIVATE-OA-ID",
    businessAccountId: "PRIVATE-BUSINESS-ID",
    aiPausedUntil: "2026-11-01T00:00:00.000Z",
    tags: ["private-tag"],
  }] }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === id)!;
  const result = await callOperation(req, operation, { query_limit: 10 } as any);
  expect(result.data).toEqual([{ __assistantRef: { id: conversationId }, channel, senderName: "Nguyễn An", lastMessageAt: "2026-10-30T01:14:21.000Z", unreadCount: 2, status: "open", isVip: true }]);
  const reply = formatAssistantResult(operation, result.data);
  expect(reply).toContain("Nguyễn An");
  expect(reply).toContain(`Kênh: ${channel}`);
  expect(reply).toContain("Tin chưa đọc: 2");
  expect(reply).toContain("Đang mở");
  expect(result.data[0].__assistantRef.id).toBe(conversationId);
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE|lastMessageText|aiPausedUntil|private-tag/);
  expect(reply).not.toMatch(/PRIVATE|lastMessageText|aiPausedUntil|private-tag|507f1f77bcf86cd799439122/);
  const [url] = fetcher.mock.calls[0] as [URL, RequestInit];
  expect(url.pathname).toBe(path);
  expect(url.searchParams.get("limit")).toBe("10");
  expect(url.searchParams.has("sync")).toBe(false);
  expect(url.searchParams.has("pageId")).toBe(false);
  expect(url.searchParams.has("accountId")).toBe(false);
});
it("returns only the signed-in user's safe image or voice media history", async () => {
  const mediaId = "507f1f77bcf86cd799439123";
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "success", history: [{
    _id: mediaId,
    mediaType: "voice",
    url: "https://res.cloudinary.com/demo/video/upload/voice-sample.mp3",
    prompt: "PRIVATE SCRIPT",
    userId: "PRIVATE-USER-ID",
    createdAt: "2026-10-30T01:14:21.000Z",
    metadata: { title: "Lời chào", voiceName: "Giọng nữ miền Nam", duration: 12, provider: "private-provider", requestId: "private-request" },
  }, {
    _id: "507f1f77bcf86cd799439124", mediaType: "voice", url: "https://attacker.example/audio.mp3", prompt: "PRIVATE SECOND SCRIPT", metadata: { title: "Không tin cậy" },
  }] }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.media-history.list")!;
  const result = await callOperation(req, operation, { query_type: "voice" } as any);
  expect(result.data).toEqual([{ __assistantRef: { id: mediaId }, mediaType: "voice", title: "Lời chào", voiceName: "Giọng nữ miền Nam", duration: 12, createdAt: "2026-10-30T01:14:21.000Z", url: "https://res.cloudinary.com/demo/video/upload/voice-sample.mp3" }]);
  const reply = formatAssistantResult(operation, result.data);
  expect(reply).toContain("Giọng đọc: Giọng nữ miền Nam");
  expect(reply).toContain("Liên kết tệp: https://res.cloudinary.com/demo/video/upload/voice-sample.mp3");
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE|private-provider|private-request|attacker\.example|PRIVATE-USER-ID/);
  expect(reply).not.toMatch(/PRIVATE|private-provider|private-request|attacker\.example|507f1f77bcf86cd799439123/);
  const [url] = fetcher.mock.calls[0] as [URL, RequestInit];
  expect(url.pathname).toBe("/api/v1/gemini/media-history");
  expect(url.searchParams.get("type")).toBe("voice");
  await expect(callOperation(req, operation, { query_type: "video" } as any)).rejects.toThrow("không gọi lịch sử video");
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("deletes only the selected account's image or voice history entry after resolving its visible label", async () => {
  const mediaId = "507f1f77bcf86cd799439125";
  const fetcher = vi.fn().mockImplementation(async (url: URL, init?: RequestInit) => url.pathname === "/api/v1/gemini/media-history"
    ? new Response(JSON.stringify({ status: "success", history: [{ _id: mediaId, mediaType: "voice", url: "https://res.cloudinary.com/demo/voice.mp3", createdAt: "2026-10-30T01:14:21.000Z", metadata: { title: "Lời chào", voiceName: "Giọng nữ miền Nam", duration: 12 }, prompt: "PRIVATE SCRIPT" }] }), { status: 200 })
    : new Response(JSON.stringify({ status: "success" }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.media-history.delete")!;
  const displayTime = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date("2026-10-30T01:14:21.000Z"));
  const resolution = await resolveReferences(req, operation, { query_type: "voice", path_id: `Giọng đọc · Lời chào · ${displayTime}` } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.path_id).toBe(mediaId);
  expect(resolution.labels.path_id).toContain("Lời chào");
  const result = await callOperation(req, operation, resolution.values as any);
  expect(result.data).toEqual({ deleted: true });
  expect(formatAssistantResult(operation, result.data)).toContain("Đã xóa mục lịch sử: Có");
  expect(JSON.stringify(result)).not.toMatch(/507f1f77bcf86cd799439125|PRIVATE SCRIPT/);
  const [url, options] = fetcher.mock.calls.at(-1) as [URL, RequestInit];
  expect(url.pathname).toBe(`/api/v1/gemini/media-history/${mediaId}`);
  expect(url.searchParams.get("type")).toBe("voice");
  expect(options.method).toBe("DELETE");
});
it("generates paid speech with a voice and model selected by name and returns only the safe audio link", async () => {
  const voiceId = "voice-internal-id-123";
  const modelId = "eleven_turbo_v2_5";
  const script = "Xin chào, đây là đoạn đọc thử.";
  const fetcher = vi.fn().mockImplementation(async (url: URL, init?: RequestInit) => url.pathname === "/api/v1/elevenlabs/voices"
    ? new Response(JSON.stringify({ status: "success", voices: [{ voice_id: voiceId, name: "Rachel", category: "premade", preview_url: "https://secret.example/preview.mp3", settings: { token: "SECRET-TOKEN" } }] }), { status: 200 })
    : url.pathname === "/api/v1/elevenlabs/models"
      ? new Response(JSON.stringify({ status: "success", models: [
        { model_id: modelId, name: "Turbo v2.5", description: "Nhanh", can_do_text_to_speech: true, api_key: "SECRET-MODEL-KEY" },
        { model_id: "not-tts", name: "Voice changer", can_do_text_to_speech: false },
      ] }), { status: 200 })
      : new Response(JSON.stringify({ status: "success", record: {
      _id: "507f1f77bcf86cd799439126",
      userId: "PRIVATE-USER-ID",
      prompt: script,
      url: "https://res.cloudinary.com/demo/video/upload/generated-voice.mp3",
      createdAt: "2026-10-31T01:14:21.000Z",
      metadata: { voiceName: voiceId, duration: 3, resolution: "eleven_v3", description: "PRIVATE DESCRIPTION" },
    } }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.elevenlabs.voice.generate")!;
  const resolution = await resolveReferences(req, operation, { textToSpeak: script, voiceName: "Rachel", modelName: "Turbo v2.5" } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.voiceName).toBe(voiceId);
  expect(resolution.values.modelName).toBe(modelId);
  expect(resolution.labels.voiceName).toContain("Rachel");
  expect(resolution.labels.modelName).toContain("Turbo v2.5");
  const result = await callOperation(req, operation, resolution.values as any);
  expect(result.data).toEqual({ characters: script.length, duration: 3, url: "https://res.cloudinary.com/demo/video/upload/generated-voice.mp3" });
  const reply = formatAssistantResult(operation, result.data);
  expect(reply).toContain(`Số ký tự: ${script.length}`);
  expect(reply).toContain("Liên kết tệp: https://res.cloudinary.com/demo/video/upload/generated-voice.mp3");
  expect(JSON.stringify(result)).not.toMatch(/voice-internal-id-123|eleven_turbo_v2_5|SECRET-TOKEN|SECRET-MODEL-KEY|preview\.mp3|PRIVATE-USER-ID|PRIVATE DESCRIPTION|đoạn đọc thử/);
  const [url, options] = fetcher.mock.calls.at(-1) as [URL, RequestInit];
  expect(url.pathname).toBe("/api/v1/elevenlabs/generate-voice");
  expect(options.method).toBe("POST");
  expect(JSON.parse(String(options.body))).toEqual({ textToSpeak: script, voiceName: voiceId, modelName: modelId });
});
it("creates a confirmed custom-voice preview with bounded options and hides the provider voice id", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
    status: "success", generatedVoiceId: "PRIVATE-GENERATED-VOICE-ID",
    url: "https://res.cloudinary.com/demo/video/upload/custom-preview.mp3",
    providerDetails: { apiKey: "PRIVATE-API-KEY" },
  }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.elevenlabs.custom-voice.preview")!;
  const result = await callOperation(req, operation, { text: "  Xin chào, đây là giọng mới.  " } as any);
  expect((fetcher.mock.calls[0][0] as URL).pathname).toBe("/api/v1/elevenlabs/custom-voice-preview");
  expect(JSON.parse(String(fetcher.mock.calls[0][1].body))).toEqual({
    gender: "female", age: "young", accent: "american", accentStrength: 1, text: "Xin chào, đây là giọng mới.",
  });
  expect(result.data).toEqual({ url: "https://res.cloudinary.com/demo/video/upload/custom-preview.mp3" });
  const reply = formatAssistantResult(operation, result.data);
  expect(reply).toContain("Liên kết tệp: https://res.cloudinary.com/demo/video/upload/custom-preview.mp3");
  expect(reply).not.toMatch(/PRIVATE|generatedVoiceId|\{/);
  await expect(callOperation(req, operation, { text: "Xin chào", accent: "vietnamese" } as any))
    .rejects.toThrow("các lựa chọn được hỗ trợ");
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("reads and updates ElevenLabs voice settings by name while hiding provider metadata", async () => {
  const voiceId = "voice-internal-id-123";
  const fetcher = vi.fn().mockImplementation(async (url: URL, init?: RequestInit) => {
    if (url.pathname === "/api/v1/elevenlabs/voices") return new Response(JSON.stringify({ status: "success", voices: [
      { voice_id: voiceId, name: "Rachel", category: "premade", preview_url: "https://secret.example/preview.mp3", api_key: "PRIVATE-KEY" },
    ] }), { status: 200 });
    if (url.pathname === `/api/v1/elevenlabs/voices/${voiceId}/settings` && init?.method === "POST") return new Response(JSON.stringify({
      stability: 0.7, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true, token: "PRIVATE-TOKEN", voice_id: voiceId,
    }), { status: 200 });
    if (url.pathname === `/api/v1/elevenlabs/voices/${voiceId}/settings`) return new Response(JSON.stringify({
      stability: 0.5, similarity_boost: 0.75, style: 0.1, use_speaker_boost: false, token: "PRIVATE-TOKEN", voice_id: voiceId,
    }), { status: 200 });
    if (url.pathname === `/api/v1/elevenlabs/voices/${voiceId}`) return new Response(JSON.stringify({
      voice_id: voiceId, name: "Rachel", category: "premade", description: "Giọng đọc rõ ràng",
      preview_url: "https://secret.example/preview.mp3", labels: { accent: "american" }, api_key: "PRIVATE-KEY",
    }), { status: 200 });
    return new Response(JSON.stringify({ status: "error", message: "Unexpected route" }), { status: 404 });
  });
  vi.stubGlobal("fetch", fetcher);

  const detail = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.elevenlabs.voice.detail")!;
  const detailResolution = await resolveReferences(req, detail, { path_voiceId: "Rachel" } as any);
  expect(detailResolution.errors).toEqual([]);
  expect(detailResolution.values.path_voiceId).toBe(voiceId);
  expect(detailResolution.labels.path_voiceId).toContain("Rachel");
  const detailResult = await callOperation(req, detail, detailResolution.values as any);
  const detailReply = formatAssistantResult(detail, detailResult);
  expect(detailReply).toContain("Rachel");
  expect(detailReply).toContain("Giọng đọc rõ ràng");
  expect(detailReply).not.toMatch(/voice-internal-id-123|preview\.mp3|PRIVATE-KEY|american|\{/);

  const settings = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.elevenlabs.voice-settings.read")!;
  const settingsResolution = await resolveReferences(req, settings, { path_voiceId: "Rachel" } as any);
  const settingsResult = await callOperation(req, settings, settingsResolution.values as any);
  const settingsReply = formatAssistantResult(settings, settingsResult);
  expect(settingsReply).toContain("Độ ổn định: 0,5");
  expect(settingsReply).toContain("Độ tương đồng: 0,75");
  expect(settingsReply).not.toMatch(/voice-internal-id-123|PRIVATE-TOKEN|\{/);

  const update = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.elevenlabs.voice-settings.update")!;
  const updateResolution = await resolveReferences(req, update, { path_voiceId: "Rachel", stability: 0.7, use_speaker_boost: true } as any);
  expect(updateResolution.errors).toEqual([]);
  const updateResult = await callOperation(req, update, updateResolution.values as any);
  expect(updateResult).toMatchObject({ stability: 0.7, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true });
  expect(formatAssistantResult(update, updateResult)).toContain("Tăng cường người nói: Có");
  const [updateUrl, updateOptions] = fetcher.mock.calls.at(-1) as [URL, RequestInit];
  expect(updateUrl.pathname).toBe(`/api/v1/elevenlabs/voices/${voiceId}/settings`);
  expect(updateOptions.method).toBe("POST");
  expect(JSON.parse(String(updateOptions.body))).toEqual({ stability: 0.7, use_speaker_boost: true });
  expect(formatAssistantResult(update, updateResult)).not.toMatch(/voice-internal-id-123|PRIVATE-TOKEN|\{/);
});
it("rejects ElevenLabs voice settings updates without an actual setting", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.elevenlabs.voice-settings.update")!;
  await expect(callOperation(req, operation, { path_voiceId: "voice-internal-id-123" } as any)).rejects.toThrow("ít nhất một cài đặt");
  expect(fetcher).not.toHaveBeenCalled();
});
it("lists personal notifications without accepting a recipient identity from chat input", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "success", data: [] }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const notifications = ASSISTANT_OPERATIONS.find(op => op.id === "notification.list")!;
  await callOperation(req, notifications, { query_read: false, query_type: "task", recipientUid: "someone-else" } as any);
  const url = fetcher.mock.calls[0][0] as URL;
  expect(url.pathname).toBe("/api/v1/notifications");
  expect(url.searchParams.get("read")).toBe("false");
  expect(url.searchParams.get("type")).toBe("task");
  expect(url.searchParams.has("recipientUid")).toBe(false);
});
it("resolves an author by colleague name and projects only safe social connection status", async () => {
  const authorId = "507f1f77bcf86cd799439063";
  const fetcher = vi.fn().mockImplementation(async (input: URL) => {
    if (input.pathname === "/api/v1/auth/users/colleagues") return new Response(JSON.stringify({ status: "success", data: [{ _id: authorId, displayName: "Nguyễn An", email: "an@example.test", companyCode: "TEST" }] }), { status: 200 });
    if (input.pathname === `/api/v1/marketing-settings/authors/${authorId}`) return new Response(JSON.stringify({ status: "success", data: {
      _id: authorId,
      facebookIntegration: { isConnected: true, pageId: "internal-page-id", pageName: "iGen Hà Nội", pageAccessToken: "hidden-facebook-token", appSecret: "hidden-app-secret" },
      tiktokIntegration: { isConnected: false, username: "igen_hn", accessToken: "hidden-tiktok-token", clientKey: "hidden-client-key" },
      zaloIntegration: { isConnected: true, oaId: "internal-oa-id", oaName: "iGen OA", accessToken: "hidden-zalo-token" },
      role: "admin", companyCode: "TEST",
    } }), { status: 200 });
    return new Response(JSON.stringify({ status: "success", data: [] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.author.integration-status")!;
  const resolution = await resolveReferences(req, operation, { path_id: "Nguyễn An" } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.path_id).toBe(authorId);
  const result = await callOperation(req, operation, resolution.values as any);
  expect(result.data).toEqual({ facebookConnected: true, facebookPageName: "iGen Hà Nội", tiktokConnected: false, tiktokUsername: "igen_hn", zaloConnected: true, zaloName: "iGen OA" });
  expect(JSON.stringify(result)).not.toMatch(/internal-|hidden-|companyCode|role/);
});
it("projects current-account Telegram status and only shows a new link code after writes", async () => {
  const fetcher = vi.fn().mockImplementation(async (_input: URL, init?: RequestInit) => new Response(JSON.stringify({ status: "success", message: "internal message", data: {
    linked: init?.method !== "DELETE", linkedAt: "2026-10-30T00:00:00.000Z", pendingCode: "SAFE-LINK-CODE", pendingCodeExpiresAt: "2026-10-30T00:15:00.000Z",
    botUsername: "igen_helper_bot", telegramChatId: "private-chat-id", telegramUserId: "private-user-id", userId: "internal-user-id",
  } }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  for (const [id, method, shouldShowCode] of [
    ["marketing.account.telegram-link.status", "GET", false],
    ["marketing.account.telegram-link.create", "POST", true],
    ["marketing.account.telegram-link.unlink", "DELETE", true],
  ] as const) {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === id)!;
    const result = await callOperation(req, operation, {} as any);
    const summary = formatAssistantResult(operation, result.data);
    expect((fetcher.mock.calls.at(-1)![0] as URL).pathname).toBe("/api/v1/marketing-settings/telegram-link");
    expect(fetcher.mock.calls.at(-1)![1].method).toBe(method);
    expect(JSON.stringify(result)).not.toMatch(/telegramChatId|telegramUserId|private-chat-id|private-user-id|internal-user-id|internal message/);
    expect(summary).toContain("igen_helper_bot");
    expect(summary.includes("SAFE-LINK-CODE")).toBe(shouldShowCode);
    if (shouldShowCode) expect(summary).toContain("2026-10-30T00:15:00.000Z");
  }
});

it("projects AI marketing pillars and campaign concepts without model ids or image prompts", async () => {
  const fetcher = vi.fn().mockImplementation(async (input: URL) => input.pathname.endsWith("/marketing-pillars")
    ? new Response(JSON.stringify({ pillars: [{ id: "internal-pillar-id", title: "Giáo dục hữu ích", ratio: "35%", description: "Chia sẻ hướng dẫn thực tế." }], isMock: false, companyCode: "SECRET-COMPANY" }), { status: 200 })
    : input.pathname.endsWith("/marketing-ideas")
      ? new Response(JSON.stringify({ concepts: [{ id: "internal-concept-id", title: "Ngày hội trải nghiệm", summary: "Giới thiệu lợi ích qua câu chuyện khách hàng.", channels: ["Facebook", "TikTok"], suggestedContent: "Mời khách tham gia buổi trải nghiệm.", hashtags: ["#TraiNghiem"], mediaPrompt: "secret image prompt" }], isMock: false, internalModelTrace: "secret-trace" }), { status: 200 })
      : new Response(JSON.stringify({ posts: [{ id: "internal-post-id", channel: "Facebook", contentType: "Bài giới thiệu", outline: "Nêu lợi ích và ví dụ.", bodyText: "Tham gia lớp giao tiếp để tự tin hơn.", mediaPrompt: "secret media prompt", imageUrl: "secret-image-url" }], isMock: false, internalModelTrace: "secret-trace" }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const pillars = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.ai.content-pillars")!;
  const pillarResult = await callOperation(req, pillars, { campaignTopic: "Khóa học giao tiếp" } as any);
  expect(pillarResult.data).toEqual({ campaignTopic: "Khóa học giao tiếp", pillars: "Giáo dục hữu ích — 35% — Chia sẻ hướng dẫn thực tế.", count: 1, generatedByAi: true });
  expect(formatAssistantResult(pillars, pillarResult.data)).toContain("Giáo dục hữu ích");

  const ideas = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.ai.campaign-ideas")!;
  const ideasResult = await callOperation(req, ideas, { campaignTopic: "Khóa học giao tiếp", selectedPillars: JSON.stringify(["Giáo dục hữu ích"]), channels: JSON.stringify(["Facebook", "TikTok"]), mediaType: "none", images: "SECRET-IMAGE" } as any);
  expect(ideasResult.data).toMatchObject({ campaignTopic: "Khóa học giao tiếp", count: 1, generatedByAi: true });
  expect(String(ideasResult.data.concepts)).toContain("Ngày hội trải nghiệm");
  expect(JSON.stringify({ pillarResult, ideasResult })).not.toMatch(/internal-pillar-id|internal-concept-id|SECRET-COMPANY|secret image prompt|secret-trace|SECRET-IMAGE/);
  const ideasBody = JSON.parse(String(fetcher.mock.calls[1][1].body));
  expect(ideasBody).toEqual({ campaignTopic: "Khóa học giao tiếp", selectedPillars: ["Giáo dục hữu ích"], channels: ["Facebook", "TikTok"], mediaType: "none" });

  const draftPosts = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.ai.draft-posts")!;
  const postsResult = await callOperation(req, draftPosts, { title: "Ngày hội giao tiếp", summary: "Lớp học thực hành", suggestedContent: "Tự tin trò chuyện", channels: JSON.stringify(["Facebook"]) } as any);
  expect(postsResult.data.count).toBe(1);
  expect(String(postsResult.data.posts)).toContain("Tham gia lớp giao tiếp");
  expect(JSON.stringify(postsResult)).not.toMatch(/internal-post-id|secret media prompt|secret-image-url|secret-trace/);
  const postsBody = JSON.parse(String(fetcher.mock.calls[2][1].body));
  expect(postsBody).toEqual({ title: "Ngày hội giao tiếp", summary: "Lớp học thực hành", suggestedContent: "Tự tin trò chuyện", channels: ["Facebook"], mediaType: "none" });
});

it("projects speech script and image prompt edits without accepting model or media references", async () => {
  const fetcher = vi.fn().mockImplementation(async (input: URL) => input.pathname.endsWith("/optimize-script")
    ? new Response(JSON.stringify({ optimizedText: "Xin chào, mời bạn tham gia lớp học.", internalModel: "secret-model", companyCode: "secret-company" }), { status: 200 })
    : new Response(JSON.stringify({ subject: "Lớp học giao tiếp", optimized_english_prompt: "A clean education campaign banner.", negative_prompt: "blurry", isLocalFallback: false, imageUri: "secret-image", internalModel: "secret-model" }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const script = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.ai.optimize-script")!;
  const scriptResult = await callOperation(req, script, { text: "Mời tham gia lớp", readingStyle: "thân thiện", model: "attacker-model" } as any);
  expect(scriptResult.data).toEqual({ optimizedText: "Xin chào, mời bạn tham gia lớp học." });
  expect(formatAssistantResult(script, scriptResult.data)).toContain("Văn bản đã biên tập");
  expect(JSON.parse(String(fetcher.mock.calls[0][1].body))).toEqual({ text: "Mời tham gia lớp", readingStyle: "thân thiện" });

  const prompt = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.ai.optimize-image-prompt")!;
  const promptResult = await callOperation(req, prompt, { description: "Banner khóa học", imageUris: JSON.stringify(["secret-image"]), modelName: "attacker-model" } as any);
  expect(promptResult.data).toEqual({ subject: "Lớp học giao tiếp", optimizedPrompt: "A clean education campaign banner.", negativePrompt: "blurry", generatedByAi: true });
  expect(JSON.parse(String(fetcher.mock.calls[1][1].body))).toEqual({ description: "Banner khóa học" });
  expect(JSON.stringify({ scriptResult, promptResult })).not.toMatch(/secret-model|secret-company|secret-image|imageUri|attacker-model/);
});

it("projects charged marketing topic suggestions as short text without internal metadata", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ suggestions: ["Mẹo sử dụng sản phẩm", "Câu chuyện khách hàng", 42, "Ưu đãi theo mùa", "Giải đáp thắc mắc", "Hậu trường thương hiệu", "Gợi ý vượt giới hạn"], internalModel: "secret-model", companyCode: "secret-company" }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const suggestions = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.ai.topic-suggestions")!;
  const result = await callOperation(req, suggestions, {} as any);
  expect(result.data).toEqual({ suggestions: "1. Mẹo sử dụng sản phẩm\n2. Câu chuyện khách hàng\n3. Ưu đãi theo mùa\n4. Giải đáp thắc mắc\n5. Hậu trường thương hiệu", count: 5 });
  expect(formatAssistantResult(suggestions, result.data)).toContain("Gợi ý chủ đề");
  expect(JSON.stringify(result)).not.toMatch(/secret-model|secret-company|Gợi ý vượt giới hạn/);
});

it("returns only the authorized repair feedback link and omits the separate bearer token field", async () => {
  const ticketId = "507f1f77bcf86cd799439064";
  const branchId = req.user.branchId;
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: {
    ticketCode: "SC-1042", feedbackToken: "secret-feedback-token", url: "/repair/feedback/secret-feedback-token",
    _id: ticketId, companyCode: "SECRET-COMPANY", customerPhone: "0900000000",
  } }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "repair.feedback.link.create")!;
  const result = await callOperation(req, operation, { path_id: ticketId, targetBranch: branchId } as any);
  expect(result.data).toEqual({ ticketCode: "SC-1042", feedbackUrl: "/repair/feedback/secret-feedback-token" });
  expect(JSON.stringify(result)).not.toMatch(/feedbackToken|SECRET-COMPANY|0900000000|507f1f77bcf86cd799439064/);
  const [url, options] = fetcher.mock.calls[0] as [URL, RequestInit];
  expect(url.pathname).toBe(`/api/v1/repair/tickets/${ticketId}/feedback-qr`);
  expect(url.searchParams.get("branchId")).toBe(branchId);
  expect(JSON.parse(String(options.body))).toEqual({});
});

it("projects sold-device lookup to repair-safe fields and scopes it to the selected branch", async () => {
  const branchId = req.user.branchId;
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: {
    found: true,
    serialUnit: { serialNumber: "SN-001", sku: "PHONE-128", productName: "Điện thoại mẫu", customerId: "internal-customer-id", companyCode: "SECRET-COMPANY", imei1: "SECRET-IMEI", unitCost: 8_000_000 },
    coverage: { customer: { covered: true, endAt: "2026-12-01T00:00:00.000Z", daysLeft: 31 }, supplier: { covered: false, endAt: "2026-10-01T00:00:00.000Z", daysLeft: -30 }, costBearer: "shop", checkedAt: "2026-10-31T00:00:00.000Z" },
    sold: { soldAt: "2026-01-01T00:00:00.000Z", orderCode: "DH-001", customerCode: "KH-001", customerName: "Nguyễn An", customerPhone: "0900000000", branchId: "other-branch", orderId: "internal-order-id" },
  } }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "repair.device.lookup")!;
  const result = await callOperation(req, operation, { serialNumber: "SN-001", targetBranch: branchId } as any);
  expect(result.data).toEqual({
    found: true, serialNumber: "SN-001", sku: "PHONE-128", productName: "Điện thoại mẫu", soldAt: "2026-01-01T00:00:00.000Z", orderCode: "DH-001", customerCode: "KH-001", customerName: "Nguyễn An",
    customerCovered: true, customerWarrantyEndAt: "2026-12-01T00:00:00.000Z", customerWarrantyDaysLeft: 31, supplierCovered: false, supplierWarrantyEndAt: "2026-10-01T00:00:00.000Z", supplierWarrantyDaysLeft: -30, costBearer: "shop",
  });
  expect(JSON.stringify(result)).not.toMatch(/SECRET-COMPANY|SECRET-IMEI|customerPhone|0900000000|internal-customer-id|internal-order-id|unitCost|other-branch/);
  expect(formatAssistantResult(operation, result.data)).toContain("Mã đơn bán: DH-001");
  const [url, options] = fetcher.mock.calls[0] as [URL, RequestInit];
  expect(url.pathname).toBe("/api/v1/repair/tickets/lookup-device");
  expect(url.searchParams.get("branchId")).toBe(branchId);
  expect(JSON.parse(String(options.body))).toEqual({ serialNumber: "SN-001" });
});

it("sends a single confirmed email without returning HTML or SMTP message identifiers", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: { id: "secret-smtp-message-id" } }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "student.email.send")!;
  const input = { to: "customer@example.test", subject: "Cập nhật lịch hẹn", html: "<p>Thời gian giao máy là 16:00.</p>" };
  const result = await callOperation(req, operation, input as any);
  expect(result.data).toEqual({ sent: true, recipient: "customer@example.test", subject: "Cập nhật lịch hẹn" });
  expect(formatAssistantResult(operation, result.data)).toContain("Người nhận: customer@example.test");
  expect(JSON.stringify(result)).not.toMatch(/Thời gian giao máy|secret-smtp-message-id/);
  const [url, options] = fetcher.mock.calls[0] as [URL, RequestInit];
  expect(url.pathname).toBe("/api/v1/send-email");
  expect(url.searchParams.get("companyCode")).toBe("TEST");
  expect(JSON.parse(String(options.body))).toEqual({ ...input, check: false });
  await expect(callOperation(req, operation, { ...input, to: "one@example.test,two@example.test" } as any)).rejects.toThrow("một địa chỉ hợp lệ");
  await expect(callOperation(req, operation, { ...input, subject: "Subject\nBcc: bad@example.test" } as any)).rejects.toThrow("không chứa xuống dòng");
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("projects AI subscription plans and current-scope usage without internal identifiers", async () => {
  const fetcher = vi.fn().mockImplementation(async (input: URL) => input.pathname === "/api/v1/marketing-subscription/plans"
    ? new Response(JSON.stringify({ status: "success", data: { plans: [{ _id: "internal-plan-id", code: "TEAM", name: "Gói nhóm", description: "Dùng cho doanh nghiệp", durationDays: 30, aiLimit: 500, priceVnd: 250000, active: true, createdBy: "internal-user-id" }] } }), { status: 200 })
    : new Response(JSON.stringify({ status: "success", data: {
      subscription: { _id: "internal-period-id", companyCode: "internal-company", createdBy: "internal-user-id", planName: "Gói nhóm", status: "active", scope: "company", aiLimit: 500, used: 42, reserved: 3, remaining: 455, expiresAt: "2026-11-30T00:00:00.000Z" },
      usage: [{ _id: "internal-usage-id", userId: "internal-user-id", campaignId: "internal-campaign-id", kind: "content_generation", model: "model-x", units: 2, status: "succeeded", createdAt: "2026-10-30T00:00:00.000Z", completedAt: "2026-10-30T00:00:05.000Z", reason: "internal reason" }],
    } }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const plans = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.ai-subscription.plans")!;
  const planResult = await callOperation(req, plans, {} as any);
  expect(planResult.data).toEqual({ plans: [{ code: "TEAM", name: "Gói nhóm", description: "Dùng cho doanh nghiệp", durationDays: 30, aiLimit: 500, priceVnd: 250000 }] });
  const summary = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.ai-subscription.summary")!;
  const summaryResult = await callOperation(req, summary, {} as any);
  expect(summaryResult.data).toEqual({
    planName: "Gói nhóm", subscriptionStatus: "active", billingScope: "company", aiLimit: 500,
    used: 42, remaining: 455, expiresAt: "2026-11-30T00:00:00.000Z",
    usage: [{ kind: "content_generation", model: "model-x", units: 2, status: "succeeded", createdAt: "2026-10-30T00:00:00.000Z", completedAt: "2026-10-30T00:00:05.000Z" }],
  });
  expect(JSON.stringify(summaryResult)).not.toMatch(/internal-|companyCode|createdBy|userId|campaignId|reason/);
});
it("projects only the current user's Canva connection status", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "success", data: {
    connected: true, connectedAt: "2026-10-30T00:00:00.000Z", userId: "internal-user-id", accessToken: "hidden-token",
  } }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.canva.status")!;
  const result = await callOperation(req, operation, {} as any);
  expect(result.data).toEqual({ connected: true, connectedAt: "2026-10-30T00:00:00.000Z" });
  expect(JSON.stringify(result)).not.toMatch(/internal-|hidden-/);
});
it("lists Canva designs with only their titles and update times", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "success", data: [
    { id: "canva-design-private-id", title: "Bài đăng tháng 11", updated_at: "2026-10-30T09:00:00Z", thumbnail: { url: "https://private.example/preview.png" }, urls: { edit_url: "https://canva.example/edit/private" }, owner: { email: "owner@example.test" }, accessToken: "PRIVATE-TOKEN" },
    { id: "canva-design-private-id-2", title: "Thiết kế sản phẩm", updated_at: "2026-10-29T09:00:00Z", urls: { view_url: "https://canva.example/view/private" } },
  ] }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.canva.designs.list")!;
  const result = await callOperation(req, operation, {} as any);
  expect(result.data).toEqual([
    { title: "Bài đăng tháng 11", updatedAt: "2026-10-30T09:00:00Z" },
    { title: "Thiết kế sản phẩm", updatedAt: "2026-10-29T09:00:00Z" },
  ]);
  const reply = formatAssistantResult(operation, result.data);
  expect(reply).toContain("Bài đăng tháng 11");
  expect(reply).toContain("Thiết kế sản phẩm");
  expect(reply).not.toMatch(/canva-design-private-id|preview\.png|canva\.example|owner@example\.test|PRIVATE-TOKEN|\{/);
  expect((fetcher.mock.calls[0][0] as URL).pathname).toBe("/api/v1/canva/designs");
});
it("updates one personal assistant preference while preserving the remaining settings and custom instructions", async () => {
  const current = { version: 4, windowMode: "window", enterToSend: true, showSuggestions: true, instructions: "Giữ nguyên hướng dẫn riêng", alwaysConfirm: false, speakReplies: false, wakeWordEnabled: false };
  const fetcher = vi.fn().mockImplementation(async (url: URL, init?: RequestInit) => {
    if (init?.method === "PATCH") return new Response(JSON.stringify({ success: true, data: {
      ...current, ...JSON.parse(String(init.body)), version: 5, internalUserId: "PRIVATE-USER", apiToken: "PRIVATE-TOKEN",
    } }), { status: 200 });
    return new Response(JSON.stringify({ success: true, data: { ...current, internalUserId: "PRIVATE-USER", apiToken: "PRIVATE-TOKEN" } }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const read = ASSISTANT_OPERATIONS.find(item => item.id === "account.assistant-settings.read")!;
  const readResult = await callOperation(req, read, {} as any);
  expect(readResult.data).toMatchObject({ version: 4, windowMode: "window", speakReplies: false, wakeWordEnabled: false });
  expect(Object.keys(readResult.data)).not.toContain("instructions");
  expect(formatAssistantResult(read, readResult.data)).not.toContain("Giữ nguyên hướng dẫn riêng");
  expect(JSON.stringify(readResult)).not.toMatch(/Giữ nguyên hướng dẫn riêng|PRIVATE-USER|PRIVATE-TOKEN/);

  const update = ASSISTANT_OPERATIONS.find(item => item.id === "account.assistant-settings.update")!;
  const updated = await callOperation(req, update, { speakReplies: true } as any);
  expect(updated.data).toMatchObject({ version: 5, windowMode: "window", enterToSend: true, showSuggestions: true, alwaysConfirm: false, speakReplies: true, wakeWordEnabled: false });
  const reply = formatAssistantResult(update, updated.data);
  expect(reply).toContain("Phát âm thanh câu trả lời: Có");
  expect(reply).not.toMatch(/Giữ nguyên hướng dẫn riêng|PRIVATE-USER|PRIVATE-TOKEN|\{/);
  const [url, options] = fetcher.mock.calls.at(-1) as [URL, RequestInit];
  expect(url.pathname).toBe("/api/v1/chatbot/assistant/settings");
  expect(options.method).toBe("PATCH");
  expect(JSON.parse(String(options.body))).toEqual({
    version: 4, windowMode: "window", enterToSend: true, showSuggestions: true,
    instructions: "Giữ nguyên hướng dẫn riêng", alwaysConfirm: false, speakReplies: true, wakeWordEnabled: false,
  });
});
it("does not save personal assistant settings when no preference was named", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const update = ASSISTANT_OPERATIONS.find(item => item.id === "account.assistant-settings.update")!;
  await expect(callOperation(req, update, {} as any)).rejects.toThrow("ít nhất một cài đặt trợ lý");
  expect(fetcher).not.toHaveBeenCalled();
});
it("deletes only a custom ElevenLabs voice selected by name and always returns a safe confirmation result", async () => {
  const voiceId = "voice-custom-123";
  const fetcher = vi.fn().mockImplementation(async (url: URL, init?: RequestInit) => {
    if (url.pathname === "/api/v1/elevenlabs/voices") return new Response(JSON.stringify({ status: "success", voices: [
      { voice_id: voiceId, name: "Giọng riêng", category: "cloned", preview_url: "https://secret.example/preview.mp3", accessToken: "PRIVATE-TOKEN" },
      { voice_id: "voice-built-in-123", name: "Giọng dựng sẵn", category: "premade" },
    ] }), { status: 200 });
    if (url.pathname === `/api/v1/elevenlabs/voices/${voiceId}` && init?.method === "DELETE") return new Response(JSON.stringify({ success: true, voice_id: voiceId, token: "PRIVATE-TOKEN" }), { status: 200 });
    return new Response(JSON.stringify({ success: false, message: "Unexpected route" }), { status: 404 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.elevenlabs.voice.delete")!;
  const resolution = await resolveReferences(req, operation, { path_voiceId: "Giọng riêng" } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.path_voiceId).toBe(voiceId);
  expect(resolution.labels.path_voiceId).toContain("Giọng riêng");
  const result = await callOperation(req, operation, resolution.values as any);
  expect(result.data).toEqual({ deleted: true });
  expect(formatAssistantResult(operation, result.data)).toContain("Đã xóa giọng đọc: Có");
  expect(JSON.stringify(result)).not.toMatch(/voice-custom-123|PRIVATE-TOKEN|preview\.mp3/);
  const [url, options] = fetcher.mock.calls.at(-1) as [URL, RequestInit];
  expect(url.pathname).toBe(`/api/v1/elevenlabs/voices/${voiceId}`);
  expect(options.method).toBe("DELETE");
});
it("blocks deleting a premade ElevenLabs voice even when its provider ID is supplied", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "success", voices: [
    { voice_id: "voice-built-in-123", name: "Giọng dựng sẵn", category: "premade" },
  ] }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.elevenlabs.voice.delete")!;
  await expect(callOperation(req, operation, { path_voiceId: "voice-built-in-123" } as any)).rejects.toThrow("Chỉ xóa được một giọng cloned/generated");
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect((fetcher.mock.calls[0][0] as URL).pathname).toBe("/api/v1/elevenlabs/voices");
});
it("projects recent company orders without simulation data or customer contact details", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "success", data: [
    { isSimulation: false, customerName: "Nguyễn An", customerPhone: "0988123456", deliveryAddress: "Số 1 đường A", items: [{ productName: "Bánh kem", variantSummary: "Socola", quantity: 2, attributes: { message: "bí mật" } }], totalAmount: 350000, status: "confirmed", createdAt: "2026-10-30T00:00:00.000Z", depositStatus: "verified", paymentMethod: "bank_transfer", conversationId: "internal-conversation-id", paymentCode: "internal-payment-code" },
    { isSimulation: true, customerName: "Khách mô phỏng", items: [{ productName: "Mẫu", quantity: 1 }], status: "draft" },
  ] }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.order-sheet.orders.list")!;
  const result = await callOperation(req, operation, { query_limit: 20 } as any);
  expect(result.data).toEqual([{
    customerName: "Nguyễn An", itemsSummary: "2 × Bánh kem · Socola", totalAmount: 350000,
    orderStatus: "confirmed", createdAt: "2026-10-30T00:00:00.000Z", depositStatus: "verified", paymentMethod: "bank_transfer",
  }]);
  const url = fetcher.mock.calls[0][0] as URL;
  expect(url.pathname).toBe("/api/v1/order-sheets/orders");
  expect(url.searchParams.get("limit")).toBe("20");
  expect(JSON.stringify(result)).not.toMatch(/0988123456|Số 1 đường A|internal-|bí mật/);
});
it("projects Telegram notification status without group identifiers, errors or credentials", async () => {
  const fetcher = vi.fn().mockImplementation(() => new Response(JSON.stringify({ status: "success", data: {
    enabled: true, notifyNewOrder: true, hasBotToken: true, botUsername: "igen_order_bot", groupChatId: "-1001234567890",
    botToken: "hidden-bot-token", messageThreadId: 4, lastTestedAt: "2026-10-30T00:00:00.000Z", lastTestStatus: "success", lastTestError: "hidden provider error",
  } }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.telegram-order.config-status")!;
  const result = await callOperation(req, operation, {} as any);
  expect(result.data).toEqual({
    enabled: true, notifyNewOrder: true, botConfigured: true, botUsername: "igen_order_bot",
    lastTestedAt: "2026-10-30T00:00:00.000Z", lastTestStatus: "success",
  });
  expect(JSON.stringify(result)).not.toMatch(/-1001234567890|hidden-|messageThreadId/);

  const update = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.telegram-order.config.update")!;
  const updated = await callOperation(req, update, { enabled: false, notifyNewOrder: false } as any);
  expect(fetcher.mock.calls[1][1].method).toBe("PUT");
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ enabled: false, notifyNewOrder: false });
  expect(JSON.stringify(updated)).not.toMatch(/-1001234567890|hidden-|messageThreadId/);
});
it("reads and updates product catalog settings while hiding Drive and service account details", async () => {
  const fetcher = vi.fn().mockImplementation(() => new Response(JSON.stringify({ status: "success", data: {
    enabled: true, rootFolderUrl: "https://drive.google.com/drive/folders/private-folder-id", maxImagesPerReply: 4,
    catalogName: "Bộ sưu tập", itemLabel: "Mẫu bánh", selectionMessage: "Chọn mẫu phù hợp", businessDescription: "Tiệm bánh gia đình",
    serviceAccountEmail: "service-account@example.test", companyCode: "TEST", migratedFromLegacy: false,
  } }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const read = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.product-catalog.config")!;
  const readResult = await callOperation(req, read, {} as any);
  expect(readResult.data).toEqual({
    enabled: true, maxImagesPerReply: 4, catalogName: "Bộ sưu tập", itemLabel: "Mẫu bánh",
    selectionMessage: "Chọn mẫu phù hợp", businessDescription: "Tiệm bánh gia đình",
  });
  expect(JSON.stringify(readResult)).not.toMatch(/private-folder-id|service-account@example.test|companyCode|migratedFromLegacy/);

  const update = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.product-catalog.config.update")!;
  const updateResult = await callOperation(req, update, { enabled: true, rootFolderUrl: "https://drive.google.com/drive/folders/new-private-folder", maxImagesPerReply: 6, catalogName: "Mẫu mới" } as any);
  expect(updateResult.data).toEqual(readResult.data);
  const url = fetcher.mock.calls[1][0] as URL;
  expect(url.pathname).toBe("/api/v1/company-cake-catalog");
  expect(fetcher.mock.calls[1][1].method).toBe("PUT");
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ enabled: true, rootFolderUrl: "https://drive.google.com/drive/folders/new-private-folder", maxImagesPerReply: 6, catalogName: "Mẫu mới" });
  expect(JSON.stringify(updateResult)).not.toMatch(/private-folder-id|service-account@example.test|companyCode/);
});
it("returns a bounded product catalog scan summary without exposing preview URLs", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "success", data: {
    categoryCount: 3, imageCount: 18, categories: [{ name: "Bánh kem", imageCount: 7 }, { name: "Bánh mì", imageCount: 11 }],
    previewImageUrl: "https://drive.google.com/uc?id=private-image-id", serviceAccountEmail: "service-account@example.test",
  } }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.product-catalog.config.test")!;
  const result = await callOperation(req, operation, { rootFolderUrl: "https://drive.google.com/drive/folders/private-folder" } as any);
  expect(result.data).toEqual({ categoryCount: 3, imageCount: 18, categories: [{ name: "Bánh kem", imageCount: 7 }, { name: "Bánh mì", imageCount: 11 }] });
  expect(fetcher.mock.calls[0][1].method).toBe("POST");
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ rootFolderUrl: "https://drive.google.com/drive/folders/private-folder" });
  expect(JSON.stringify(result)).not.toMatch(/private-image-id|private-folder|service-account@example.test/);
});
it("resolves student names for delete preview and confirmed bulk delete without exposing IDs", async () => {
  const studentId = "507f1f77bcf86cd799439095";
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/students" && init?.method !== "POST") return new Response(JSON.stringify({ success: true, students: [
      { _id: studentId, fullName: "Đỗ Đức Chung", phone: "0988000000", email: "chung@example.test", status: ["Đang học"], ownerId: "internal-owner" },
    ], total: 1, page: 1, limit: 100 }), { status: 200 });
    if (input.pathname === "/api/v1/students/bulk-delete-preview") return new Response(JSON.stringify({ success: true, deletableCount: 1, blockedCount: 0, items: [
      { studentId, name: "Đỗ Đức Chung", reasons: [{ key: "classes", label: "Lớp học", count: 1, details: ["LỚP-01"] }] },
    ] }), { status: 200 });
    if (input.pathname === "/api/v1/students/bulk-delete") return new Response(JSON.stringify({ success: true, deletedCount: 1, deletedIds: [studentId], blocked: [] }), { status: 200 });
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);

  const preview = ASSISTANT_OPERATIONS.find(item => item.id === "student.bulk.delete.preview")!;
  const previewResolution = await resolveReferences(req, preview, { ids: JSON.stringify(["Đỗ Đức Chung"]) } as any);
  expect(previewResolution.errors).toEqual([]);
  expect(JSON.parse(String(previewResolution.values.ids))).toEqual([studentId]);
  const impact = await callOperation(req, preview, previewResolution.values as any);
  expect(impact.data).toEqual({ deletableCount: 1, blockedCount: 0, impactSummary: "Đỗ Đức Chung: Lớp học (1): LỚP-01" });
  expect(JSON.stringify(impact)).not.toMatch(/507f1f77bcf86cd799439095|internal-owner/);

  const deletion = ASSISTANT_OPERATIONS.find(item => item.id === "student.bulk.delete")!;
  const deleteResolution = await resolveReferences(req, deletion, { ids: JSON.stringify(["Đỗ Đức Chung"]) } as any);
  expect(deleteResolution.errors).toEqual([]);
  const result = await callOperation(req, deletion, deleteResolution.values as any);
  expect(result.data).toEqual({ deletedCount: 1, blockedCount: 0 });
  expect(JSON.parse(fetcher.mock.calls.at(-1)![1].body).ids).toEqual([studentId]);
  expect(JSON.stringify(result)).not.toContain(studentId);
});
it("resolves labor names for confirmed soft deletion within the worker scope", async () => {
  const workerId = "507f1f77bcf86cd799439195";
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/worker-management/workers" && init?.method !== "POST") return new Response(JSON.stringify({ success: true, data: [
      { _id: workerId, fullName: "Đỗ Đức Chung", status: "active", laborType: "official", registrationDate: "2026-10-01", phone: "0988000000", companyCode: "TEST", branchId: req.user.branchId },
    ], total: 1, page: 1, limit: 100 }), { status: 200 });
    if (input.pathname === "/api/v1/worker-management/workers/bulk-delete" && init?.method === "POST") return new Response(JSON.stringify({ deletedCount: 1 }), { status: 200 });
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);

  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "worker.bulk.delete")!;
  expect(operation.confirmation).toBe(true);
  expect(operation.fields.find(field => field.key === "ids")?.structure?.maxItems).toBe(20);
  const resolution = await resolveReferences(req, operation, { ids: JSON.stringify(["Đỗ Đức Chung"]) } as any);
  expect(resolution.errors).toEqual([]);
  expect(JSON.parse(String(resolution.values.ids))).toEqual([workerId]);

  const result = await callOperation(req, operation, resolution.values as any);
  expect(result).toEqual({ deletedCount: 1 });
  const write = fetcher.mock.calls.find(([input, init]) => (input as URL).pathname === "/api/v1/worker-management/workers/bulk-delete" && init?.method === "POST")!;
  expect(JSON.parse(write[1].body).ids).toEqual([workerId]);
  expect(JSON.stringify(result)).not.toMatch(/507f1f77bcf86cd799439195|TEST|0988000000/);
});
it("resolves a class by name before deleting attendance for a specified date", async () => {
  const batchId = "507f1f77bcf86cd799439096";
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/batches") return new Response(JSON.stringify({ success: true, batches: [
      { _id: batchId, code: "TOAN-01", name: "Lớp Toán A", courseTitle: "Toán cơ bản", status: "Đang học", ownerId: "internal-owner" },
    ], total: 1, page: 1, limit: 100 }), { status: 200 });
    if (input.pathname === `/api/v1/batches/${batchId}/attendance` && init?.method === "DELETE") return new Response(JSON.stringify({ success: true, data: {
      _id: batchId, code: "TOAN-01", name: "Lớp Toán A", courseTitle: "Toán cơ bản", status: "Đang học", ownerId: "internal-owner",
      attendanceSessions: [{ date: "2026-10-30", records: [{ studentId: "internal-student-id", status: "present" }] }],
    } }), { status: 200 });
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);

  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "batch.attendance.delete")!;
  const resolution = await resolveReferences(req, operation, { path_id: "Lớp Toán A", query_date: "2026-10-30" } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.path_id).toBe(batchId);
  const result = await callOperation(req, operation, resolution.values as any);
  const deleteCall = fetcher.mock.calls.at(-1)!;
  expect(deleteCall[1].method).toBe("DELETE");
  expect((deleteCall[0] as URL).searchParams.get("date")).toBe("2026-10-30");
  const reply = formatAssistantResult(operation, result);
  expect(reply).toContain("Xóa điểm danh của lớp trong ngày");
  expect(reply).toContain("Tên: Lớp Toán A");
  expect(reply).not.toMatch(/507f1f77bcf86cd799439096|internal-owner|internal-student-id|attendanceSessions|\{/);
});
it("offers only learners from the selected class and updates one attendance record by name", async () => {
  const batchId = "507f1f77bcf86cd799439196";
  const studentId = "507f1f77bcf86cd799439197";
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/batches" && init?.method !== "PATCH") return new Response(JSON.stringify({ success: true, batches: [
      { _id: batchId, code: "ENG-01", name: "Lớp tiếng Anh A", courseTitle: "Tiếng Anh", status: "Đang học", ownerId: "private-owner" },
    ], total: 1, page: 1, limit: 100 }), { status: 200 });
    if (input.pathname === `/api/v1/batches/${batchId}/attendance/learners`) return new Response(JSON.stringify({ success: true, data: [
      { id: studentId, name: "Nguyễn Văn An", phone: "0901234567", privateOwner: "PRIVATE" },
    ] }), { status: 200 });
    if (input.pathname === `/api/v1/batches/${batchId}/attendance/learner` && init?.method === "PATCH") return new Response(JSON.stringify({ success: true, data: {
      batchCode: "ENG-01", batchName: "Lớp tiếng Anh A", date: "2026-11-01", studentName: "Nguyễn Văn An", status: "late",
      attendanceSessions: [{ studentId: "PRIVATE-STUDENT-ID" }], ownerId: "PRIVATE-OWNER",
    } }), { status: 200 });
    return new Response(JSON.stringify({ success: true, batches: [] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);

  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "batch.attendance.record.update")!;
  expect(operation.confirmation).toBe(true);
  const resolution = await resolveReferences(req, operation, {
    path_id: "Lớp tiếng Anh A", date: "2026-11-01", studentId: "Nguyễn Văn An — 0901234567", status: "late",
  } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.path_id).toBe(batchId);
  expect(resolution.values.studentId).toBe(studentId);
  expect(fetcher.mock.calls.some(([input]) => (input as URL).pathname === `/api/v1/batches/${batchId}/attendance/learners`)).toBe(true);

  const result = await callOperation(req, operation, resolution.values as any);
  const write = fetcher.mock.calls.find(([input, init]) => (input as URL).pathname === `/api/v1/batches/${batchId}/attendance/learner` && init?.method === "PATCH")!;
  expect(JSON.parse(String(write[1].body))).toEqual({ date: "2026-11-01", studentId, status: "late" });
  const reply = formatAssistantResult(operation, result);
  expect(reply).toContain("Học viên: Nguyễn Văn An");
  expect(reply).toContain("Trạng thái: Đi muộn");
  expect(reply).not.toMatch(/507f1f77bcf86cd79943919[67]|PRIVATE|attendanceSessions|\{/);
});
it("projects and updates SePay status without revealing payment credentials or account numbers", async () => {
  const fetcher = vi.fn().mockImplementation(() => new Response(JSON.stringify({ status: "success", data: {
    enabled: true, hasWebhookSecret: true, webhookId: "private-webhook-id", webhookUrl: "https://erp.test/api/v1/webhooks/sepay/private-webhook-id",
    accountNumbers: ["1234567890", "9876543210"], paymentCodePrefix: "DH", depositEnabled: true, depositPercent: 35,
    qrBankId: "VCB", qrAccountNumber: "1234567890", qrAccountName: "Công ty iGen", lastWebhookAt: "2026-10-30T00:00:00.000Z",
    lastWebhookStatus: "success", lastWebhookError: "hidden provider detail", companyCode: "TEST",
  } }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const read = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.sepay.config")!;
  const result = await callOperation(req, read, {} as any);
  expect(result.data).toEqual({
    enabled: true, webhookConfigured: true, depositEnabled: true, depositPercent: 35, paymentCodePrefix: "DH",
    lastWebhookAt: "2026-10-30T00:00:00.000Z", lastWebhookStatus: "success", accountCount: 2,
  });
  expect(JSON.stringify(result)).not.toMatch(/private-webhook-id|1234567890|9876543210|Công ty iGen|hidden provider detail|companyCode/);

  const update = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.sepay.config.update")!;
  const updated = await callOperation(req, update, { enabled: true, paymentCodePrefix: "IG", depositEnabled: true, depositPercent: 40 } as any);
  expect(fetcher.mock.calls[1][1].method).toBe("PUT");
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ enabled: true, paymentCodePrefix: "IG", depositEnabled: true, depositPercent: 40 });
  expect(JSON.stringify(updated)).not.toMatch(/private-webhook-id|1234567890|hidden provider detail/);
});

it("imports VAT by exact issued invoice number in the selected finance branch", async () => {
  const invoiceId = "507f1f77bcf86cd799439219";
  const branchId = req.user.branchId;
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/retail/invoices") return new Response(JSON.stringify({ success: true, data: { items: [
      { _id: invoiceId, invoiceNo: "INV-205", orderCode: "SO-205", branchId, status: "issued", snapshot: { customerName: "Công ty Ánh Dương" } },
    ], total: 1 } }), { status: 200 });
    if (input.pathname === "/api/v1/branches") return new Response(JSON.stringify({ success: true, branches: [{ _id: branchId, name: "Chi nhánh Hà Nội" }] }), { status: 200 });
    if (input.pathname === `/api/v1/finance/management/tax/from-invoice/${invoiceId}` && init?.method === "POST") return new Response(JSON.stringify({ success: true, data: {
      direction: "output", invoiceNumber: "INV-205", counterparty: "Công ty Ánh Dương", date: "2026-10-28", base: 1000000, rate: 10, vat: 100000, deductible: false,
      sourceInvoiceId: invoiceId, companyCode: "TEST", branchId,
    } }), { status: 201 });
    throw new Error(`Unexpected request ${input.pathname}`);
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "finance.tax.from-invoice")!;
  const invoiceLookupOperation = ASSISTANT_OPERATIONS.find(item => item.id === "retail.invoice.list")!;
  expect(projectRecords(invoiceLookupOperation, { data: { items: [
    { _id: invoiceId, invoiceNo: "INV-205", orderCode: "SO-205", branchId, status: "issued", snapshot: { customerName: "Công ty Ánh Dương" } },
  ] } }, req)[0]).toMatchObject({ code: "INV-205", invoiceNo: "INV-205", customerName: "Công ty Ánh Dương" });
  expect(await lookupRecords(req, "retail.invoice.list", "INV-205", { targetBranch: branchId })).toEqual([
    expect.objectContaining({ code: "INV-205", invoiceNo: "INV-205", customerName: "Công ty Ánh Dương" }),
  ]);
  const resolution = await resolveReferences(req, operation, { query_branchId: branchId, path_id: "INV-205" } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.path_id).toBe(invoiceId);
  expect(resolution.labels.path_id).toContain("INV-205");
  const invoiceLookup = fetcher.mock.calls.find(([input]) => (input as URL).pathname === "/api/v1/retail/invoices")!;
  expect((invoiceLookup[0] as URL).searchParams.get("q")).toBe("INV-205");
  expect((invoiceLookup[0] as URL).searchParams.get("branchId")).toBe(branchId);

  const result = await callOperation(req, operation, resolution.values as any);
  const write = fetcher.mock.calls.find(([input, init]) => (input as URL).pathname === `/api/v1/finance/management/tax/from-invoice/${invoiceId}` && init?.method === "POST")!;
  expect((write[0] as URL).searchParams.get("branchId")).toBe(branchId);
  expect(JSON.parse(String(write[1].body))).toEqual({});
  const reply = formatAssistantResult(operation, result.data);
  expect(reply).toContain("INV-205");
  expect(reply).not.toContain(invoiceId);
});

it("does not prepare VAT import for a void retail invoice", async () => {
  const branchId = req.user.branchId;
  const fetcher = vi.fn().mockImplementation(async (input: URL) => input.pathname === "/api/v1/branches"
    ? new Response(JSON.stringify({ success: true, branches: [{ _id: branchId, name: "Chi nhánh Hà Nội" }] }), { status: 200 })
    : new Response(JSON.stringify({ success: true, data: { items: [
      { _id: "507f1f77bcf86cd799439220", invoiceNo: "INV-VOID", orderCode: "SO-VOID", branchId, status: "void", snapshot: { customerName: "Khách hàng" } },
    ], total: 1 } }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "finance.tax.from-invoice")!;
  const resolution = await resolveReferences(req, operation, { query_branchId: branchId, path_id: "INV-VOID" } as any);
  expect(resolution.errors.join(" ")).toContain("hóa đơn đã phát hành");
  expect(fetcher.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
});

it("reverses a manual internal stock issue by title and only within the selected branch", async () => {
  const logId = "507f1f77bcf86cd799439221";
  const branchId = req.user.branchId;
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/crud/stock-logs") return new Response(JSON.stringify({ success: true, data: { items: [
      { _id: logId, title: "Xuất nội bộ máy in", type: "xuất", purpose: "nội bộ", status: "Hoàn thành", branchId, quantity: 1, items: [{ sku: "PRN-1", productName: "Máy in", quantity: 1 }] },
    ], total: 1, page: 1, limit: 100 } }), { status: 200 });
    if (input.pathname === "/api/v1/branches") return new Response(JSON.stringify({ success: true, branches: [{ _id: branchId, name: "Chi nhánh Hà Nội" }] }), { status: 200 });
    if (input.pathname === `/api/v1/inventory/stock-logs/${logId}/reverse` && init?.method === "POST") return new Response(JSON.stringify({ success: true, data: {
      _id: "507f1f77bcf86cd799439222", title: "Đảo phiếu: Xuất nội bộ máy in", type: "nhập", status: "Hoàn thành", quantity: 1,
      reversalOf: logId, companyCode: "TEST", branchId,
    } }), { status: 201 });
    throw new Error(`Unexpected request ${input.pathname}`);
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "inventory.stock-log.reverse")!;
  const resolution = await resolveReferences(req, operation, { targetBranch: branchId, path_id: "Xuất nội bộ máy in", reason: "Cấp phát nhầm" } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.path_id).toBe(logId);
  expect(resolution.labels.path_id).toContain("Xuất nội bộ máy in");

  const result = await callOperation(req, operation, resolution.values as any);
  const read = fetcher.mock.calls.find(([input]) => (input as URL).pathname === "/api/v1/crud/stock-logs")!;
  expect((read[0] as URL).searchParams.get("search")).toBe("Xuất nội bộ máy in");
  expect((read[0] as URL).searchParams.get("branchId")).toBe(branchId);
  const write = fetcher.mock.calls.find(([input, init]) => (input as URL).pathname === `/api/v1/inventory/stock-logs/${logId}/reverse` && init?.method === "POST")!;
  expect((write[0] as URL).searchParams.get("branchId")).toBe(branchId);
  expect(JSON.parse(String(write[1].body))).toEqual({ reason: "Cấp phát nhầm" });
  const reply = formatAssistantResult(operation, result.data);
  expect(reply).toContain("Đảo phiếu: Xuất nội bộ máy in");
  expect(reply).not.toContain(logId);
});

it("blocks stock-log reversal for sales records and already reversed issues", async () => {
  const branchId = req.user.branchId;
  const blocked = [
    { _id: "507f1f77bcf86cd799439223", title: "Phiếu xuất bán", type: "xuất", purpose: "bán", status: "Hoàn thành", refType: "retail-order", branchId, quantity: 1 },
    { _id: "507f1f77bcf86cd799439224", title: "Phiếu đã đảo", type: "xuất", purpose: "hủy", status: "Hoàn thành", reversalId: "507f1f77bcf86cd799439225", branchId, quantity: 1 },
  ];
  const fetcher = vi.fn().mockImplementation(async (input: URL) => input.pathname === "/api/v1/branches"
    ? new Response(JSON.stringify({ success: true, branches: [{ _id: branchId, name: "Chi nhánh Hà Nội" }] }), { status: 200 })
    : new Response(JSON.stringify({ success: true, data: { items: blocked, total: blocked.length } }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "inventory.stock-log.reverse")!;
  for (const title of ["Phiếu xuất bán", "Phiếu đã đảo"]) {
    const resolution = await resolveReferences(req, operation, { targetBranch: branchId, path_id: title, reason: "Kiểm tra quyền đảo" } as any);
    expect(resolution.errors.join(" ")).toContain("phiếu xuất thủ công nội bộ hoặc hủy");
  }
  expect(fetcher.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
});
it("uses the request identity for financial deduplication and parses structured fields", async () => {
  const fetcher = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ success: true, data: { id: "result" } }), { status: 200 })); vi.stubGlobal("fetch", fetcher);
  const voucher = ASSISTANT_OPERATIONS.find(o => o.path === "/finance/management/vouchers" && o.method === "POST")!;
  await callOperation(req, voucher, { kind: "receipt", amount: 100, idempotencyKey: "model-controlled" }, undefined, "server-request-id");
  expect(JSON.parse(fetcher.mock.calls[0][1].body).idempotencyKey).toBe("server-request-id");
  const receipt = ASSISTANT_OPERATIONS.find(o => o.path === "/inventory/receiving/receipts" && o.method === "POST")!;
  const items = [{ productId: "507f1f77bcf86cd799439011", variantId: "507f1f77bcf86cd799439012", quantity: 2, unitCost: 3 }];
  await callOperation(req, receipt, { supplierId: "supplier", items: JSON.stringify(items) });
  expect(JSON.parse(fetcher.mock.calls[1][1].body).items).toEqual(items);
  await expect(callOperation(req, receipt, { items: '[{"companyCode":"OTHER"}]' })).rejects.toThrow("companyCode");
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it("rejects path traversal and does not report a timed-out mutation as completed", async () => {
  const fetcher = vi.fn().mockRejectedValue(new Error("timeout")); vi.stubGlobal("fetch", fetcher);
  const op = ASSISTANT_OPERATIONS.find(o => o.path === "/worker-management/workers/:id" && o.method === "DELETE")!;
  await expect(callOperation(req, op, { path_id: "../auth/users" })).rejects.toThrow("không hợp lệ"); expect(fetcher).not.toHaveBeenCalled();
  await expect(callOperation(req, op, { path_id: "507f1f77bcf86cd799439011" })).rejects.toBeInstanceOf(UncertainExecutionError);
});

it("resolves a resource restore by name against the trash list before posting", async () => {
  const resourceId = "507f1f77bcf86cd799439057";
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/resources/trash") return new Response(JSON.stringify({ success: true, items: [
      { _id: resourceId, name: "Quy trình tuyển dụng", type: "file", section: "local", mimeType: "text/plain", size: 120 },
    ] }), { status: 200 });
    if (input.pathname === `/api/v1/resources/${resourceId}/restore` && init?.method === "POST") {
      return new Response(JSON.stringify({ success: true, restoredCount: 1 }), { status: 200 });
    }
    return new Response(JSON.stringify({ success: true, items: [] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "resource.restore")!;
  const resolution = await resolveReferences(req, operation, { path_id: "Quy trình tuyển dụng" } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.path_id).toBe(resourceId);
  expect(fetcher.mock.calls.some(([url]) => (url as URL).pathname === "/api/v1/resources/trash")).toBe(true);
  await callOperation(req, operation, resolution.values as any);
  expect(fetcher.mock.calls.some(([url, init]) => (url as URL).pathname === `/api/v1/resources/${resourceId}/restore` && init?.method === "POST")).toBe(true);
});

it("resolves kanban task activity by title and pins the task revision from the list", async () => {
  const taskId = "507f1f77bcf86cd799439058";
  const branchId = req.user.branchId;
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/kanban/tasks" && init?.method !== "PATCH") return new Response(JSON.stringify({ status: "success", data: [
      { _id: taskId, title: "Chuẩn bị báo cáo tháng", description: "Tổng hợp doanh số", estTime: 3, progress: 25, revision: 4, branchId },
    ] }), { status: 200 });
    if (input.pathname === `/api/v1/kanban/tasks/${taskId}/activity`) return new Response(JSON.stringify({ status: "success", data: { title: "Chuẩn bị báo cáo tháng", progress: 50, revision: 5 } }), { status: 200 });
    return new Response(JSON.stringify({ status: "success", data: [] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "task.activity.update")!;
  const resolution = await resolveReferences(req, operation, { path_id: "Chuẩn bị báo cáo tháng", action: "progress", progress: 50, note: "Đã hoàn thành phần tổng hợp." } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.path_id).toBe(taskId);
  expect(resolution.values.revision).toBe(4);
  await callOperation(req, operation, resolution.values as any);
  const updateCall = fetcher.mock.calls.find(([url, init]) => (url as URL).pathname === `/api/v1/kanban/tasks/${taskId}/activity` && init?.method === "PATCH")!;
  expect(JSON.parse(updateCall[1].body)).toEqual({ action: "progress", progress: 50, note: "Đã hoàn thành phần tổng hợp.", revision: 4 });
});

const contractOperations = ASSISTANT_OPERATIONS.filter(operation => operation.adapter === "contract");
const sampleShape = (shape: any): any => {
  if (!shape) return "test";
  if (shape.type === "object") return Object.fromEntries(Object.entries(shape.keys || {}).filter(([, rule]: any) => rule.required).map(([key, rule]) => [key, sampleShape(rule)]));
  if (shape.type === "array") return shape.items ? [sampleShape(shape.items)] : [];
  if (shape.type === "number") return Math.max(1, shape.min || 0);
  if (shape.type === "boolean") return true;
  if (shape.pattern?.includes(":")) return "08:00";
  if (shape.pattern?.includes("\\d{4}")) return "2026-10-01";
  return shape.options?.[0] ?? "test";
};
const sampleValue = (field: any): any => {
  if (field.source === "path" && (/^(?:id|.*Id)$/i.test(field.apiKey) || /(?:^|_)id$/i.test(field.key))) return "507f1f77bcf86cd799439011";
  if (field.defaultValue !== undefined) return field.defaultValue;
  if (field.type === "json") return JSON.stringify(sampleShape(field.structure));
  if (field.type === "number") return Math.max(1, field.min || 0);
  if (field.type === "boolean") return true;
  if (field.type === "date") return "2026-10-01";
  if (field.options?.length) return field.options[0];
  if (field.type === "email") return "qa@example.test";
  return "test";
};
it("resolves a repair notification resend by ticket code within the selected branch", async () => {
  const ticketId = "507f1f77bcf86cd799439059";
  const branchId = "507f1f77bcf86cd799439060";
  const adminReq = { ...req, user: { ...req.user, role: "admin", branchId: "" } } as any;
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/auth/branches" && init?.method === "GET") {
      return new Response(JSON.stringify({ success: true, data: [{ _id: branchId, name: "Chi nhánh thử nghiệm", code: "TEST" }] }), { status: 200 });
    }
    if (input.pathname === "/api/v1/repair/tickets" && init?.method === "GET") {
      expect(input.searchParams.get("branchId")).toBe(branchId);
      return new Response(JSON.stringify({ success: true, data: [{ _id: ticketId, ticketCode: "SC-2048", customerName: "Khách kiểm thử", status: "received" }] }), { status: 200 });
    }
    if (input.pathname === `/api/v1/repair/tickets/${ticketId}/notifications/resend` && init?.method === "POST") {
      return new Response(JSON.stringify({ success: true, data: { status: "sent", channel: "email", ticketCode: "SC-2048" } }), { status: 200 });
    }
    return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "repair.notification.resend")!;
  const resolution = await resolveReferences(adminReq, operation, { path_id: "SC-2048", targetBranch: "Chi nhánh thử nghiệm", event: "received" } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.path_id).toBe(ticketId);
  expect(resolution.values.targetBranch).toBe(branchId);
  await callOperation(adminReq, operation, resolution.values as any);
  expect(fetcher.mock.calls.some(([input, init]) => (input as URL).pathname === `/api/v1/repair/tickets/${ticketId}/notifications/resend` && init?.method === "POST" && JSON.parse(String(init.body)).event === "received")).toBe(true);
});

it("resolves treasury records from their matching overview collections and pins current versions", async () => {
  const branchId = req.user.branchId;
  const accountId = "507f1f77bcf86cd799439061";
  const voucherId = "507f1f77bcf86cd799439062";
  const bankLineId = "507f1f77bcf86cd799439063";
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/finance/reporting/treasury" && init?.method !== "POST") {
      return new Response(JSON.stringify({ success: true, data: {
        accounts: [
          { _id: accountId, name: "Quỹ bán lẻ", kind: "cash", balance: 850000, version: 9, branchId },
          { _id: "507f1f77bcf86cd799439065", name: "Ngân hàng ACB", kind: "bank", balance: 1200000, version: 2, branchId },
        ],
        vouchers: [{ _id: voucherId, description: "Thu học phí tháng 10", kind: "receipt", amount: 850000, occurredOn: "2026-10-15", status: "pending", version: 4, branchId }],
        bankLines: [{ _id: bankLineId, bankKey: "VCB-1025", description: "Chuyển khoản học phí", amount: 850000, occurredOn: "2026-10-15", branchId }],
        periods: [{ _id: "507f1f77bcf86cd799439064", month: "2026-09", status: "closed", version: 3, branchId }],
      } }), { status: 200 });
    }
    return new Response(JSON.stringify({ success: true, data: { status: "ok" } }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const selectedBranch = { targetBranch: branchId } as any;

  const decision = ASSISTANT_OPERATIONS.find(op => op.id === "finance.treasury.vouchers.decision")!;
  const decisionValues = await resolveReferences(req, decision, { ...selectedBranch, path_id: "Thu học phí tháng 10", action: "approve" } as any);
  expect(decisionValues.errors).toEqual([]);
  expect(decisionValues.values).toMatchObject({ path_id: voucherId, version: 4 });
  await callOperation(req, decision, decisionValues.values as any);
  const decisionPost = fetcher.mock.calls.find(([, init]) => init?.method === "POST")!;
  expect((decisionPost[0] as URL).pathname).toBe(`/api/v1/finance/reporting/treasury/vouchers/${voucherId}/decision`);
  expect(JSON.parse(String(decisionPost[1].body))).toEqual({ action: "approve", version: 4 });

  fetcher.mockClear();
  const reconcile = ASSISTANT_OPERATIONS.find(op => op.id === "finance.treasury.reconciliation.create")!;
  const reconcileValues = await resolveReferences(req, reconcile, { ...selectedBranch, accountId: "Quỹ bán lẻ", actual: 850000, note: "Kiểm đếm cuối ngày" } as any);
  expect(reconcileValues.errors).toEqual([]);
  expect(reconcileValues.values).toMatchObject({ accountId, version: 9 });
  await callOperation(req, reconcile, reconcileValues.values as any, undefined, "request-reconcile-1");
  const reconcilePost = fetcher.mock.calls.find(([, init]) => init?.method === "POST")!;
  expect(JSON.parse(String(reconcilePost[1].body))).toMatchObject({ accountId, actual: 850000, note: "Kiểm đếm cuối ngày", version: 9, key: "request-reconcile-1" });

  fetcher.mockClear();
  const createBankLine = ASSISTANT_OPERATIONS.find(op => op.id === "finance.treasury.bank-lines.create")!;
  const cashAccount = await resolveReferences(req, createBankLine, { ...selectedBranch, accountId: "Quỹ bán lẻ", bankKey: "VCB-1026", amount: 1000, occurredOn: "2026-10-16", description: "Giao dịch thử" } as any);
  expect(cashAccount.errors.join(" ")).toContain("hãy chọn một tài khoản ngân hàng");
  const zeroValue = await resolveReferences(req, createBankLine, { ...selectedBranch, accountId: "Ngân hàng ACB", bankKey: "VCB-1026", amount: 0, occurredOn: "2026-10-16", description: "Giao dịch thử" } as any);
  expect(zeroValue.errors.join(" ")).toContain("không được bằng 0");
  const bankAccount = await resolveReferences(req, createBankLine, { ...selectedBranch, accountId: "Ngân hàng ACB", bankKey: "VCB-1026", amount: -1000, occurredOn: "2026-10-16", description: "Giao dịch thử" } as any);
  expect(bankAccount.errors).toEqual([]);
  expect(bankAccount.values.accountId).toBe("507f1f77bcf86cd799439065");

  fetcher.mockClear();
  const match = ASSISTANT_OPERATIONS.find(op => op.id === "finance.treasury.bank-lines.match")!;
  const matchValues = await resolveReferences(req, match, { ...selectedBranch, path_id: "VCB-1025", voucherId: "Thu học phí tháng 10" } as any);
  expect(matchValues.errors).toEqual([]);
  expect(matchValues.values).toMatchObject({ path_id: bankLineId, voucherId });
  await callOperation(req, match, matchValues.values as any);
  const matchPost = fetcher.mock.calls.find(([, init]) => init?.method === "POST")!;
  expect((matchPost[0] as URL).pathname).toBe(`/api/v1/finance/reporting/treasury/bank-lines/${bankLineId}/match`);
  expect(JSON.parse(String(matchPost[1].body))).toEqual({ voucherId });

  fetcher.mockClear();
  const period = ASSISTANT_OPERATIONS.find(op => op.id === "finance.treasury.period.update")!;
  const periodValues = await resolveReferences(req, period, { ...selectedBranch, month: "2026-09", action: "reopen", reason: "Điều chỉnh cuối kỳ" } as any);
  expect(periodValues.errors).toEqual([]);
  expect(periodValues.values.version).toBe(3);
});

it("runs a read-only inventory reconciliation by named warehouse in the admin-selected branch", async () => {
  const branchId = "507f1f77bcf86cd799439066";
  const warehouseId = "507f1f77bcf86cd799439067";
  const adminReq = { ...req, user: { ...req.user, role: "admin", branchId: "" } } as any;
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/auth/branches") {
      return new Response(JSON.stringify({ success: true, data: [{ _id: branchId, name: "Chi nhánh Hà Nội", code: "HN" }] }), { status: 200 });
    }
    if (input.pathname === "/api/v1/inventory/reconciliation/warehouses") {
      expect(input.searchParams.get("branchId")).toBe(branchId);
      return new Response(JSON.stringify({ success: true, data: [{ _id: warehouseId, name: "Kho trung tâm", code: "KHO-HN", kind: "selling", isActive: true, branchId }] }), { status: 200 });
    }
    if (input.pathname === "/api/v1/inventory/reconciliation/runs" && init?.method === "POST") {
      expect(input.searchParams.get("branchId")).toBe(branchId);
      return new Response(JSON.stringify({ success: true, data: { summary: { status: "complete", findings: 0 }, findings: [], truncated: false } }), { status: 200 });
    }
    return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(op => op.id === "inventory.reconciliation.run")!;
  const resolution = await resolveReferences(adminReq, operation, { targetBranch: "Chi nhánh Hà Nội", warehouseId: "Kho trung tâm" } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values).toMatchObject({ targetBranch: branchId, warehouseId });
  await callOperation(adminReq, operation, resolution.values as any);
  const post = fetcher.mock.calls.find(([, init]) => init?.method === "POST")!;
  expect((post[0] as URL).pathname).toBe("/api/v1/inventory/reconciliation/runs");
  expect(JSON.parse(String(post[1].body))).toEqual({ warehouseId });
  expect(fetcher).toHaveBeenCalledTimes(4);
});

it("dispatches every generated operation through its fixed route contract", async () => {
  let dispatchValues: Record<string, any> = {};
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/chatbot/assistant/settings") {
      const current = { version: 4, windowMode: "window", enterToSend: true, showSuggestions: true, instructions: "Existing settings", alwaysConfirm: false, speakReplies: false, wakeWordEnabled: false };
      const data = init?.method === "PATCH" ? { ...current, ...JSON.parse(String(init.body)), version: 5 } : current;
      return new Response(JSON.stringify({ success: true, data }), { status: 200 });
    }
    if (input.pathname === "/api/v1/elevenlabs/voices") return new Response(JSON.stringify({ status: "success", voices: [
      { voice_id: "voice-cloned-123", name: "Voice QA", category: "cloned" },
    ] }), { status: 200 });
    if (input.pathname === "/api/v1/company-email/smtp") return new Response(JSON.stringify({ data: {
      host: "smtp.example.test", port: 587, secure: false, user: "sender@example.test",
      fromEmail: "no-reply@example.test", fromName: "Công ty kiểm thử", hasPassword: true,
    } }), { status: 200 });
    if (input.pathname === "/api/v1/company-email/smtp/verify") return new Response(JSON.stringify({ success: true }), { status: 200 });
    if (input.pathname === "/api/v1/company-email/smtp/test") return new Response(JSON.stringify({ messageId: "private-smtp-test-id" }), { status: 200 });
    if (input.pathname === "/api/v1/gemini/media-history") return new Response(JSON.stringify({ status: "success", history: [{
      _id: "507f1f77bcf86cd799439126", mediaType: "image", url: "https://res.cloudinary.com/demo/image/upload/source.png",
      createdAt: "2026-10-30T01:14:21.000Z", metadata: { title: "Ảnh kiểm tra" },
    }] }), { status: 200 });
    if (input.pathname === "/api/v1/elevenlabs/voices/voice-cloned-123" && init?.method === "DELETE") return new Response(JSON.stringify({ success: true }), { status: 200 });
    if (init?.method !== "POST" && /^\/api\/v1\/finance\/receivables\/[a-f\d]{24}$/i.test(input.pathname)) return new Response(JSON.stringify({ success: true, data: {
      receivable: { receivableCode: "PT-QA", customerName: "Khách kiểm tra", balance: 100, status: "open" },
      entries: [{ _id: dispatchValues.path_entryId || "507f1f77bcf86cd799439011", type: "adjustment", amount: 100, reason: "Kiểm thử", createdAt: "2026-10-01T00:00:00.000Z" }],
    } }), { status: 200 });
    if (input.pathname === "/api/v1/company-knowledge/documents") return new Response(JSON.stringify({ status: "success", documents: [{
      id: "507f1f77bcf86cd799439011", title: "Tài liệu kiểm tra", channelScope: ["facebook"], purposeScope: ["sales"],
      pageScope: "all", documentType: "general",
    }] }), { status: 200 });
    if (/^\/api\/v1\/payroll\/runs\/[a-f\d]{24}\/payments$/i.test(input.pathname) && init?.method === "POST") {
      const body = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ status: "success", data: {
        _id: "507f1f77bcf86cd799439190", amount: body.amount, status: "draft", lines: body.lines,
        paymentDate: body.paymentDate, createdAt: "2026-10-01T00:00:00.000Z",
      } }), { status: 201 });
    }
    if (/^\/api\/v1\/payroll\/payments\/[a-f\d]{24}\/(cancel|confirm|reverse)$/i.test(input.pathname) && init?.method === "POST") {
      const action = input.pathname.split("/").at(-1);
      const status = action === "cancel" ? "cancelled" : action === "confirm" ? "confirmed" : "reversed";
      return new Response(JSON.stringify({ status: "success", runStatus: "closed", data: {
        _id: "507f1f77bcf86cd799439190", amount: 1, status, lines: [{ employeeId: "private-employee", amount: 1 }],
        paymentDate: "2026-10-01T00:00:00.000Z",
      } }), { status: 200 });
    }
    if (input.pathname === "/api/v1/elevenlabs/generate-voice") return new Response(JSON.stringify({ status: "success", record: {
      url: "https://res.cloudinary.com/demo/video/upload/generated-voice.mp3",
      metadata: { duration: 3 },
    } }), { status: 200 });
    if (input.pathname === "/api/v1/elevenlabs/custom-voice-preview") return new Response(JSON.stringify({
      status: "success", generatedVoiceId: "generated-voice-private-id",
      url: "https://res.cloudinary.com/demo/video/upload/custom-voice-preview.mp3",
    }), { status: 200 });
    if (input.pathname === "/api/v1/gemini/generate-image") return new Response(JSON.stringify({
      url: "https://res.cloudinary.com/demo/image/upload/generated-image.png", isMock: false,
    }), { status: 200 });
    if (input.pathname === "/api/v1/gemini/edit-image") return new Response(JSON.stringify({
      status: "success", url: "https://res.cloudinary.com/demo/image/upload/edited-image.png",
      replayed: false, record: { metadata: { revision: 2 } },
    }), { status: 200 });
    if (/^\/api\/v1\/auth\/branches\/[a-f\d]{24}\/pending$/i.test(input.pathname) && init?.method === "DELETE") return new Response(JSON.stringify({ status: "success", data: { name: "Chi nhánh kiểm thử" } }), { status: 200 });
    if (input.pathname.endsWith("/withdraw") && input.pathname.includes("/payslips/")) return new Response(JSON.stringify({ status: "success", data: { status: "withdrawn" } }), { status: 200 });
    const data = input.pathname === "/api/v1/retail/partners"
      ? [{ _id: "507f1f77bcf86cd799439011", code: "CTV-QA", name: "Đối tác kiểm tra", roles: ["collaborator"], phone: "", email: "", address: "", status: "active" }]
      : [];
    return new Response(JSON.stringify({ success: true, data }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  for (const operation of contractOperations) {
    fetcher.mockClear();
    const values = Object.fromEntries(operation.fields.map(field => [field.key, sampleValue(field)]));
    if (operation.id === "marketing.video-caption.project.create") {
      values.source = JSON.stringify({ kind: "upload", url: "https://example.test/video.mp4", originalName: "video.mp4" });
    }
    if (["marketing.campaign.calendar", "marketing.campaign.slot.reject", "marketing.campaign.slot.retry", "marketing.campaign.slot.approve", "marketing.campaign.slot.publish-now", "marketing.campaign.slot.content.update"].includes(operation.id)) {
      values.query_startDate = "2026-10-01";
      values.query_endDate = "2026-10-07";
    }
    if (operation.path.startsWith("/finance/reminders/")) values.targetBranch = req.user.branchId;
    if (operation.path.startsWith("/finance/reminders/")) expect(values.targetBranch).toBe(req.user.branchId);
    if (operation.path === "/inventory/warehouses") values.targetBranch = req.user.branchId;
    if (operation.path.startsWith("/inventory/transfers")) values.targetBranch = req.user.branchId;
    if (operation.path.startsWith("/finance/management/")) values.targetBranch = req.user.branchId;
    if (operation.path.startsWith("/retail/debt-reminders/")) values.targetBranch = req.user.branchId;
    if (operation.path.startsWith("/payroll/periods/") && operation.fields.some(field => field.apiKey === "periodKey")) values.path_periodKey = "2026-10";
    if (operation.id === "payroll.period.inputs.bulk") values.rows = JSON.stringify([{ employeeId: "507f1f77bcf86cd799439235", agreedSalary: 1, reason: "Kiểm thử catalog" }]);
    if (operation.id === "payroll.period.line-overrides.bulk") {
      values.rows = JSON.stringify([{ employeeId: "507f1f77bcf86cd799439235", reason: "Kiểm thử catalog", values: { baseSalary: 1 }, expectedVersion: 0 }]);
      values.__assistantEmployeeNames = JSON.stringify({ "507f1f77bcf86cd799439235": "Nhân viên kiểm thử" });
    }
    dispatchValues = values;
    for (const key of operation.optionalPathFields || []) values[`path_${key}`] = "507f1f77bcf86cd799439096";
    if (operation.id.startsWith("inventory.serial.") || operation.path.startsWith("/inventory/counts") || operation.path.startsWith("/inventory/reconciliation/") || operation.path.startsWith("/finance/management/") || operation.path.startsWith("/finance/receivables") || operation.path.startsWith("/finance/reporting/") || operation.path.startsWith("/payroll/periods/") || operation.path.startsWith("/payroll/runs") || operation.path.startsWith("/partners/commission-levels") || operation.path === "/retail/settings" || operation.path.startsWith("/retail/orders") || operation.path.startsWith("/retail/shifts") || operation.path.startsWith("/retail/finance/cashbook") || operation.path.startsWith("/retail/finance/commission/") || operation.path.startsWith("/retail/receivables/") || operation.path.startsWith("/retail/after-sales") || operation.id === "retail.warranty.serial.update" || operation.id === "repair.device.lookup" || operation.id === "repair.notification.resend" || operation.id === "repair.feedback.link.create") values.targetBranch = req.user.branchId;
    if (["finance.tax.from-invoice", "inventory.stock-log.reverse", "retail.invoice.list"].includes(operation.id)) values.targetBranch = req.user.branchId;
    if (operation.id.startsWith("recruitment.")) values.branchId = req.user.branchId;
    if (operation.id === "payroll.run.create") values.periodKey = "2026-10";
    if (operation.id === "payroll.run.payment.create") {
      values.path_id = "507f1f77bcf86cd799439194";
      values.targetBranch = req.user.branchId;
      values.amount = 1;
      values.lines = JSON.stringify([{ employeeId: "507f1f77bcf86cd799439191", amount: 1 }]);
    }
    if (operation.id.startsWith("payroll.payment.")) values.targetBranch = req.user.branchId;
    if (operation.systemBodyFields?.includes("version")) values.version = 0;
    if (operation.systemBodyFields?.includes("expectedVersion")) values.expectedVersion = 0;
    if (operation.systemBodyFields?.includes("expectedRevision")) values.expectedRevision = 0;
    if (operation.systemBodyFields?.includes("revision")) values.revision = 0;
    if (operation.systemBodyFields?.includes("terminalId")) values.terminalId = "terminal-qa";
    if (operation.systemBodyFields?.includes("expectedTerminalId")) values.expectedTerminalId = "";
    if (operation.mergeBodyWithReference) values.__assistantExistingRecord = JSON.stringify({ code: "QA", name: "QA", resultBucket: "bonus", priority: 1, conditions: { combinator: "and", items: [] }, expression: { type: "constant", value: 0 }, rounding: { mode: "nearest", unit: 1 }, funds: [{ code: "social", employeeRate: 0, employerRate: 0, capBasis: "none" }], taxBrackets: [{ rate: 0 }] });
    if (operation.id === "inventory.serial.create") { values.serialNumber = "SN-QA"; delete values.serialNumbers; delete values.internalBarcodes; }
    if (operation.id === "marketing.elevenlabs.voice.delete") values.path_voiceId = "voice-cloned-123";
    if (operation.id === "marketing.ai.image.edit") values.sourceMediaId = "507f1f77bcf86cd799439126";
    if (operation.id === "inventory.count.item.update") delete values.countedQuantity;
    if (operation.id === "retail.partner.product.commissions.update") {
      values.skus = JSON.stringify(["SKU-QA"]);
      values.rule = JSON.stringify({ kind: "phone", amount: 1 });
    }
    if (operation.id === "retail.after-sale.create") {
      values.__assistantAfterSaleItems = JSON.stringify([{ orderLineIndex: 0, quantity: 1, unitAmount: 1, serialNumbers: [], internalBarcodes: [], condition: "good" }]);
      values.cashSessionId = "507f1f77bcf86cd799439098";
    }
    if (operation.id === "inventory.variant.bulk.update" || operation.id === "inventory.variant.bulk.delete") {
      values.ids = JSON.stringify([{ productId: "507f1f77bcf86cd799439071", variantId: "507f1f77bcf86cd799439072" }]);
      if (operation.id === "inventory.variant.bulk.update") values.changes = JSON.stringify({ status: "inactive" });
    }
    if (["student.standard-fields.update", "worker.standard-fields.update", "worker.partner.payout.reverse"].includes(operation.id)) continue;
    try {
      await callOperation(req, operation, values, undefined, "507f1f77bcf86cd799439099");
      expect(fetcher).toHaveBeenCalledTimes(["retail.partner.update", "company-knowledge.documents.scopes.update", "finance.receivable.entry.reversal", "api.get.efd26957a4dbe889", "api.patch.cbf8c2b9d544f837", "account.assistant-settings.update", "marketing.elevenlabs.voice.delete", "marketing.ai.image.edit"].includes(operation.id) ? 2 : 1);
      const finalCall = fetcher.mock.calls[fetcher.mock.calls.length - 1];
      const target = finalCall[0] as URL;
      expect(target.origin).toBe("http://127.0.0.1:4050");
      expect(finalCall[1].method).toBe(operation.method);
    } catch (error) {
      throw new Error(operation.method + " " + operation.path + ": " + (error as Error).message);
    }
  }
});

it("resolves a payroll dispute reply by the employee's period and issue field", async () => {
  const runId = "507f1f77bcf86cd799439011";
  const issueId = "internal-payroll-issue-id";
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/payroll/employee/me/reconciliation" && init?.method !== "POST") {
      return new Response(JSON.stringify({ status: "success", data: [{
        runId, employeeId: "actor", periodKey: "2026-09", version: 3,
        snapshot: { values: { net: 42500000 } },
        issues: [{ id: issueId, field: "baseSalary", status: "open", messages: [{ body: "Kiểm tra giúp tôi khoản này" }] }],
      }] }), { status: 200 });
    }
    return new Response(JSON.stringify({ status: "success", data: { runId, employeeId: "actor", periodKey: "2026-09", version: 4, issues: [] } }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "payroll.employee.reconciliation.action")!;
  const resolution = await resolveReferences(req, operation, { path_id: "2026-09", action: "reply", field: "baseSalary", body: "Tôi gửi thêm thông tin về lương cơ bản." } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values).toMatchObject({ path_id: runId, expectedVersion: 3, issueId, action: "reply" });
  expect(resolution.labels.path_id).toContain("2026-09");
  expect(JSON.stringify(resolution.labels)).not.toContain(runId);
  expect(JSON.stringify(resolution.labels)).not.toContain(issueId);

  const actionResult = await callOperation(req, operation, resolution.values as any);
  expect(actionResult.data).toMatchObject({ action: "reply", periodKey: "2026-09", issues: [] });
  expect(JSON.stringify(actionResult)).not.toContain(runId);
  expect(JSON.stringify(actionResult)).not.toContain(issueId);
  const post = fetcher.mock.calls.find(([, init]) => init?.method === "POST");
  expect((post?.[0] as URL).pathname).toBe(`/api/v1/payroll/employee/me/reconciliation/${runId}/actions`);
  expect(JSON.parse(String(post?.[1].body))).toMatchObject({ action: "reply", field: "baseSalary", body: "Tôi gửi thêm thông tin về lương cơ bản.", expectedVersion: 3, issueId });
});

it("resolves a payslip review request by the employee's period", async () => {
  const runId = "507f1f77bcf86cd799439012";
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/payroll/employee/me/payslips" && init?.method !== "POST") {
      return new Response(JSON.stringify({ status: "success", data: [{ runId, employeeId: "actor", periodKey: "2026-08", netPay: 32000000 }] }), { status: 200 });
    }
    return new Response(JSON.stringify({ status: "success", data: { periodKey: "2026-08", status: "open", message: "Thiếu một ngày công" } }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "payroll.employee.me.payslip.review.request")!;
  const resolution = await resolveReferences(req, operation, { path_id: "2026-08", message: "Vui lòng kiểm tra ngày công ngày 12." } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.path_id).toBe(runId);
  expect(resolution.labels.path_id).toContain("2026-08");
  await callOperation(req, operation, resolution.values as any);
  const post = fetcher.mock.calls.find(([, init]) => init?.method === "POST");
  expect((post?.[0] as URL).pathname).toBe(`/api/v1/payroll/employee/me/payslips/${runId}/review-requests`);
  expect(JSON.parse(String(post?.[1].body))).toEqual({ message: "Vui lòng kiểm tra ngày công ngày 12." });
});

it("projects only the signed-in employee's attendance summary", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "success", data: {
    log: { uid: "internal-employee-id", branchId: "internal-branch-id", date: "2026-10-29", checkIn: "2026-10-29T08:02:00.000Z", checkOut: null },
    workCalendar: { date: "2026-10-29", isWorkingDay: true, label: "Ngày làm việc bình thường" },
  } }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "timekeeping.today.me")!;
  const result = await callOperation(req, operation, {} as any);
  expect(result.data).toEqual({
    date: "2026-10-29", isWorkingDay: true, dayLabel: "Ngày làm việc bình thường",
    attendanceStatus: "Đã vào ca", checkIn: "2026-10-29T08:02:00.000Z", checkOut: null,
  });
  expect(JSON.stringify(result)).not.toContain("internal-");
  expect(fetcher.mock.calls[0][0].pathname).toBe("/api/v1/timekeeping/today");
});

it("projects a name-based daily attendance roster without exposing internal fields", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "success", data: [
    { date: "2026-11-02", employeeName: "Đỗ Đức Chung", attendanceStatus: "Đã vào ca", checkIn: "2026-11-02T01:00:00.000Z", checkOut: null, uid: "private-employee-id", branchId: "private-branch-id" },
  ] }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "timekeeping.records.list")!;
  const result = await callOperation(req, operation, {} as any);
  expect(result.data).toEqual([{ date: "2026-11-02", employeeName: "Đỗ Đức Chung", attendanceStatus: "Đã vào ca", checkIn: "2026-11-02T01:00:00.000Z", checkOut: null }]);
  expect(formatAssistantResult(operation, result.data)).toContain("Đỗ Đức Chung");
  expect(JSON.stringify(result)).not.toContain("private-");
  const reportUrl = fetcher.mock.calls[0][0] as URL;
  expect(reportUrl.pathname).toBe("/api/v1/timekeeping/records");
  expect(reportUrl.searchParams.get("companyCode")).toBe("TEST");
  expect(reportUrl.searchParams.get("branchId")).toBe("507f1f77bcf86cd799439012");
});

it("omits exact office coordinates and internal calendar ids from timekeeping reads", async () => {
  const fetcher = vi.fn().mockImplementation(async (input: URL) => input.pathname.endsWith("/company-location")
    ? new Response(JSON.stringify({ status: "success", data: {
      addressName: "Văn phòng Hà Nội", latitude: 21.0285, longitude: 105.8542, allowedRadius: 150,
      checkInLimit: "08:30", checkOutLimit: "17:30", lunchBreakStart: "12:00", lunchBreakEnd: "13:00",
      annualLeaveDays: 12, workingDays: [1, 2, 3, 4, 5],
    } }), { status: 200 })
    : new Response(JSON.stringify({ status: "success", data: [{ _id: "internal-calendar-id", createdBy: "internal-user", date: "2026-01-01", name: "Tết Dương lịch", dayType: "holiday", isApplied: true }] }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const location = ASSISTANT_OPERATIONS.find(item => item.id === "timekeeping.company.location")!;
  const locationResult = await callOperation(req, location, {} as any);
  expect(locationResult.data).toEqual({
    addressName: "Văn phòng Hà Nội", allowedRadius: 150, checkInLimit: "08:30", checkOutLimit: "17:30",
    lunchBreakStart: "12:00", lunchBreakEnd: "13:00", annualLeaveDays: 12, workDays: "Thứ 2, Thứ 3, Thứ 4, Thứ 5, Thứ 6",
  });
  expect(JSON.stringify(locationResult)).not.toContain("21.0285");
  expect(JSON.stringify(locationResult)).not.toContain("105.8542");

  const calendar = ASSISTANT_OPERATIONS.find(item => item.id === "timekeeping.work-calendar.list")!;
  const calendarResult = await callOperation(req, calendar, { query_year: 2026, query_appliedOnly: "true" } as any);
  expect(calendarResult.data).toMatchObject([{ date: "2026-01-01", name: "Tết Dương lịch", dayTypeLabel: "Ngày nghỉ lễ", isApplied: true }]);
  expect(formatAssistantResult(calendar, calendarResult.data)).not.toContain("internal-calendar-id");
  const calendarUrl = fetcher.mock.calls[1][0] as URL;
  expect(calendarUrl.searchParams.get("year")).toBe("2026");
  expect(calendarUrl.searchParams.get("appliedOnly")).toBe("true");
});

it("lists rejected attendance attempts without exposing GPS, IP, email, or user identifiers", async () => {
  const attemptId = "507f1f77bcf86cd799439091";
  const userId = "507f1f77bcf86cd799439092";
  const fetcher = vi.fn().mockImplementation(() => new Response(JSON.stringify({ status: "success", data: [{
    _id: attemptId, uid: userId, companyCode: "PRIVATE-COMPANY", branchId: "PRIVATE-BRANCH", displayName: "Lê Minh An",
    email: "an@example.test", action: "check-in", outcome: "rejected", reasonCode: "outside_radius", attemptedAt: "2026-10-30T02:15:00.000Z",
    latitude: 21.0285, longitude: 105.8542, ipAddress: "203.0.113.10", distance: 420,
  }] }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "api.get.d2e63aaeb8682c88")!;
  const result = await callOperation(req, operation, { query_date: "2026-10-30" } as any);
  expect(result.data).toEqual([{
    employeeName: "Lê Minh An", actionLabel: "Vào ca", outcomeLabel: "Bị từ chối", reasonLabel: "Ngoài bán kính chấm công",
    attemptedAt: "2026-10-30T02:15:00.000Z", distanceMeters: 420,
  }]);
  const reply = formatAssistantResult(operation, result.data);
  expect(reply).toContain("Ngoài bán kính chấm công");
  expect(reply).not.toMatch(/PRIVATE-COMPANY|PRIVATE-BRANCH|507f1f77bcf86cd79943909[12]|21\.0285|105\.8542|203\.0\.113\.10|an@example\.test|outside_radius/);
  expect((fetcher.mock.calls[0][0] as URL).searchParams.get("date")).toBe("2026-10-30");
});

it("preserves company coordinates and all omitted settings when updating one attendance setting", async () => {
  const config = {
    latitude: 21.0285, longitude: 105.8542, allowedRadius: 150, addressName: "Văn phòng Hà Nội",
    checkInLimit: "08:30", checkOutLimit: "17:30", lunchBreakStart: "12:00", lunchBreakEnd: "13:00", workingDays: [1, 2, 3, 4, 5], annualLeaveDays: 14,
  };
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => init?.method === "PATCH"
    ? new Response(JSON.stringify({ status: "success", data: { ...config, allowedRadius: 250 } }), { status: 200 })
    : new Response(JSON.stringify({ status: "success", data: config }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "api.patch.cbf8c2b9d544f837")!;
  const result = await callOperation(req, operation, { allowedRadius: 250 } as any);
  expect(fetcher).toHaveBeenCalledTimes(2);
  const [readUrl] = fetcher.mock.calls[0] as [URL, RequestInit];
  const [writeUrl, writeInit] = fetcher.mock.calls[1] as [URL, RequestInit];
  expect(readUrl.pathname).toBe("/api/v1/timekeeping/company-location");
  expect(writeUrl.pathname).toBe("/api/v1/timekeeping/company-location");
  expect(JSON.parse(String(writeInit.body))).toEqual({
    latitude: 21.0285, longitude: 105.8542, allowedRadius: 250, addressName: "Văn phòng Hà Nội",
    checkInLimit: "08:30", checkOutLimit: "17:30", lunchBreakStart: "12:00", lunchBreakEnd: "13:00", workingDays: [1, 2, 3, 4, 5], annualLeaveDays: 14,
  });
  expect(result.data).toMatchObject({ addressName: "Văn phòng Hà Nội", allowedRadius: 250, workDays: "Thứ 2, Thứ 3, Thứ 4, Thứ 5, Thứ 6", annualLeaveDays: 14 });
  expect(formatAssistantResult(operation, result.data)).not.toMatch(/21\.0285|105\.8542/);
  expect(JSON.stringify(result)).not.toMatch(/21\.0285|105\.8542/);
});

it("resolves shift updates by name and sends weekday labels as numeric weekdays", async () => {
  const adminReq = { ...req, user: { ...req.user, role: "admin", branchId: undefined } } as any;
  const shiftId = "507f1f77bcf86cd799439101";
  const baseShift = {
    _id: shiftId, companyCode: "PRIVATE-COMPANY", code: "CA-SANG", name: "Ca sáng", color: "#336699",
    startTime: "08:00", endTime: "17:00", workingDays: [1, 2, 3, 4, 5], checkInFrom: "07:30", checkInUntil: "09:00",
    breakPeriods: [{ name: "Nghỉ trưa", startTime: "12:00", endTime: "13:00", paid: false }],
    employeeCount: 3, isDefault: true, isActive: true,
  };
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === `/api/v1/timekeeping/shifts/${shiftId}` && init?.method === "PATCH") return new Response(JSON.stringify({ status: "success", data: { ...baseShift, name: "Ca hành chính" } }), { status: 200 });
    if (input.pathname === "/api/v1/timekeeping/shifts" && init?.method === "POST") return new Response(JSON.stringify({ status: "success", data: { ...baseShift, _id: "507f1f77bcf86cd799439102", code: "CA-CHIEU", name: "Ca chiều", workingDays: [1, 5] } }), { status: 201 });
    return new Response(JSON.stringify({ status: "success", data: [baseShift] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);

  const shifts = ASSISTANT_OPERATIONS.find(item => item.id === "api.get.d632a938b9c72492")!;
  const listed = await callOperation(adminReq, shifts, {} as any);
  expect(listed.data).toMatchObject([{ name: "Ca sáng", code: "CA-SANG", workingDaysLabel: "Thứ 2, Thứ 3, Thứ 4, Thứ 5, Thứ 6", employeeCount: 3 }]);
  expect(formatAssistantResult(shifts, listed.data)).toContain("Tên: Ca sáng");
  expect(formatAssistantResult(shifts, listed.data)).not.toMatch(/PRIVATE-COMPANY|507f1f77bcf86cd799439101/);

  const update = ASSISTANT_OPERATIONS.find(item => item.id === "api.patch.08411917f1ed9b75")!;
  const resolution = await resolveReferences(adminReq, update, { path_id: "CA-SANG", name: "Ca hành chính" } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.path_id).toBe(shiftId);
  const updated = await callOperation(adminReq, update, resolution.values as any);
  expect(updated.data).toMatchObject({ name: "Ca hành chính", code: "CA-SANG", workingDaysLabel: "Thứ 2, Thứ 3, Thứ 4, Thứ 5, Thứ 6" });
  const [patchUrl, patchInit] = fetcher.mock.calls.at(-1) as [URL, RequestInit];
  expect(patchUrl.pathname).toBe(`/api/v1/timekeeping/shifts/${shiftId}`);
  expect(JSON.parse(String(patchInit.body))).toEqual({ name: "Ca hành chính" });

  const create = ASSISTANT_OPERATIONS.find(item => item.id === "api.post.4e68581113f1ef79")!;
  await callOperation(adminReq, create, {
    code: "CA-CHIEU", name: "Ca chiều", startTime: "13:00", endTime: "21:00", workingDays: JSON.stringify(["Thứ 2", "Thứ 6"]),
  } as any);
  const [createUrl, createInit] = fetcher.mock.calls.at(-1) as [URL, RequestInit];
  expect(createUrl.pathname).toBe("/api/v1/timekeeping/shifts");
  expect(JSON.parse(String(createInit.body))).toMatchObject({ code: "CA-CHIEU", workingDays: [1, 5] });
});

it("updates an employee's named work-hour settings while preserving every omitted value", async () => {
  const adminReq = { ...req, user: { ...req.user, role: "admin", branchId: undefined } } as any;
  const employeeId = "507f1f77bcf86cd799439111";
  const employee = {
    _id: employeeId, fullName: "Đỗ Đức Chung", email: "chung@example.test", role: "user", companyCode: "PRIVATE-COMPANY",
    employmentStatus: "probation", officialDate: "2024-02-01",
    workHoursConfig: { useCustom: true, checkInLimit: "09:00", checkOutLimit: "18:00", lunchBreakStart: "12:30", lunchBreakEnd: "13:30", workingDays: [1, 2, 3, 4, 5], annualLeaveDays: 12 },
  };
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => init?.method === "PATCH"
    ? new Response(JSON.stringify({ status: "success", data: { ...employee, workHoursConfig: { ...employee.workHoursConfig, annualLeaveDays: 15 } } }), { status: 200 })
    : new Response(JSON.stringify({ status: "success", data: [employee] }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);

  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "api.patch.6bc968347283a069")!;
  const resolution = await resolveReferences(adminReq, operation, { path_uid: "Đỗ Đức Chung", annualLeaveDays: 15 } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.path_uid).toBe(employeeId);
  expect(resolution.labels.path_uid).toContain("Đỗ Đức Chung");

  const result = await callOperation(adminReq, operation, resolution.values as any);
  const [url, init] = fetcher.mock.calls.at(-1) as [URL, RequestInit];
  expect(url.pathname).toBe(`/api/v1/timekeeping/work-hours/${employeeId}`);
  expect(JSON.parse(String(init.body))).toEqual({
    useCustom: true, checkInLimit: "09:00", checkOutLimit: "18:00", lunchBreakStart: "12:30", lunchBreakEnd: "13:30",
    workingDays: [1, 2, 3, 4, 5], annualLeaveDays: 15, employmentStatus: "probation", officialDate: "2024-02-01",
  });
  const reply = formatAssistantResult(operation, result.data);
  expect(reply).toContain("Nhân viên: Đỗ Đức Chung");
  expect(reply).toContain("Số ngày phép năm: 15");
  expect(reply).not.toMatch(/PRIVATE-COMPANY|507f1f77bcf86cd799439111|chung@example\.test/);
});

it("resolves employee and shift names when assigning a shift and translates selected weekdays", async () => {
  const adminReq = { ...req, user: { ...req.user, role: "admin", branchId: undefined } } as any;
  const employeeId = "507f1f77bcf86cd799439121";
  const shiftId = "507f1f77bcf86cd799439122";
  const assignmentId = "507f1f77bcf86cd799439123";
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/auth/users") return new Response(JSON.stringify({ status: "success", data: [{ _id: employeeId, displayName: "Đỗ Đức Chung", fullName: "Đỗ Đức Chung", email: "chung@example.test", companyCode: "TEST" }] }), { status: 200 });
    if (input.pathname === "/api/v1/timekeeping/shift-assignments") return new Response(JSON.stringify({ status: "success", data: [{ _id: assignmentId, employeeId, shiftId, effectiveFrom: "2026-11-01", effectiveTo: null, daysOfWeek: [1, 5] }] }), { status: 201 });
    return new Response(JSON.stringify({ status: "success", data: [{ _id: shiftId, name: "Ca sáng", code: "CA-SANG", isActive: true, workingDays: [1, 2, 3, 4, 5] }] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);

  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "api.post.5511b45cf3a736d1")!;
  const resolution = await resolveReferences(adminReq, operation, {
    employeeIds: JSON.stringify(["Đỗ Đức Chung"]), shiftId: "Ca sáng", effectiveFrom: "2026-11-01", daysOfWeek: JSON.stringify(["Thứ 2", "Thứ 6"]),
  } as any);
  expect(resolution.errors).toEqual([]);
  expect(JSON.parse(String(resolution.values.employeeIds))).toEqual([employeeId]);
  expect(resolution.values.shiftId).toBe(shiftId);

  const result = await callOperation(adminReq, operation, resolution.values as any);
  const [url, init] = fetcher.mock.calls.at(-1) as [URL, RequestInit];
  expect(url.pathname).toBe("/api/v1/timekeeping/shift-assignments");
  expect(JSON.parse(String(init.body))).toEqual({ employeeIds: [employeeId], shiftId, effectiveFrom: "2026-11-01", daysOfWeek: [1, 5] });
  expect(result.data).toEqual({ assignedCount: 1, effectiveFrom: "2026-11-01", effectiveTo: undefined, daysOfWeekLabel: "Thứ 2, Thứ 6" });
  expect(formatAssistantResult(operation, result.data)).not.toMatch(/507f1f77bcf86cd79943912[123]|PRIVATE-COMPANY/);
});

it("resolves company work-calendar audit by name and returns only safe audit fields", async () => {
  const calendarId = "507f1f77bcf86cd799439071";
  const adminReq = { ...req, user: { ...req.user, role: "admin" } } as any;
  const fetcher = vi.fn().mockImplementation(async (input: URL) => {
    if (input.pathname === "/api/v1/timekeeping/work-calendar") {
      return new Response(JSON.stringify({ status: "success", data: [{
        _id: calendarId, date: "2026-01-01", name: "Tết Dương lịch", dayType: "holiday", isApplied: true,
      }] }), { status: 200 });
    }
    if (input.pathname === `/api/v1/timekeeping/work-calendar/${calendarId}/audit`) {
      return new Response(JSON.stringify({ status: "success", data: [{
        _id: "507f1f77bcf86cd799439072", companyCode: "PRIVATE-COMPANY", calendarDayId: calendarId,
        actorId: "PRIVATE-ACTOR", action: "updated", reason: "Điều chỉnh theo lịch nghỉ của công ty",
        createdAt: "2026-01-02T03:04:05.000Z", before: { name: "Tên cũ", privateValue: "secret-before" },
        after: { name: "Tết Dương lịch", privateValue: "secret-after" },
      }] }), { status: 200 });
    }
    return new Response(JSON.stringify({ status: "error", message: "Unexpected route" }), { status: 404 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "timekeeping.work-calendar.audit")!;
  const calendarList = ASSISTANT_OPERATIONS.find(item => item.id === "timekeeping.work-calendar.list")!;
  expect(projectRecords(calendarList, { status: "success", data: [{
    _id: calendarId, date: "2026-01-01", name: "Tết Dương lịch", dayType: "holiday", isApplied: true,
  }] }, adminReq)).toMatchObject([{ id: calendarId, name: "Tết Dương lịch" }]);
  const listed = await lookupRecords(adminReq, "timekeeping.work-calendar.list", "Tết Dương lịch", { query_year: 2026 } as any);
  expect(listed).toMatchObject([{ id: calendarId, name: "Tết Dương lịch" }]);
  const resolution = await resolveReferences(adminReq, operation, { path_id: "Tết Dương lịch", query_year: 2026 } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.path_id).toBe(calendarId);
  expect(resolution.labels.path_id).toContain("Tết Dương lịch");
  expect((fetcher.mock.calls[0][0] as URL).searchParams.get("year")).toBe("2026");

  const result = await callOperation(adminReq, operation, resolution.values as any);
  const reply = formatAssistantResult(operation, result.data);
  expect(reply).toContain("Thao tác: Cập nhật");
  expect(reply).toContain("Lý do: Điều chỉnh theo lịch nghỉ của công ty");
  expect(reply).toContain("Thời điểm thay đổi: 2026-01-02T03:04:05.000Z");
  expect(reply).not.toMatch(/PRIVATE-COMPANY|PRIVATE-ACTOR|secret-before|secret-after|507f1f77bcf86cd79943907/);
});

it("creates a company calendar exception with a confirmation-safe result", async () => {
  const adminReq = { ...req, user: { ...req.user, role: "admin" } } as any;
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "success", data: {
    _id: "507f1f77bcf86cd799439081", companyCode: "PRIVATE-COMPANY", source: "admin",
    date: "2026-09-02", name: "Ngày làm bù", dayType: "working_override", isApplied: true,
    lastAdminBy: "PRIVATE-ACTOR",
  } }), { status: 201 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "timekeeping.work-calendar.create")!;
  const result = await callOperation(adminReq, operation, { date: "2026-09-02", name: "Ngày làm bù", dayType: "working_override", isApplied: true } as any);
  expect(result.data).toEqual({ date: "2026-09-02", name: "Ngày làm bù", dayTypeLabel: "Ngày làm việc bù", isApplied: true });
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE-COMPANY|PRIVATE-ACTOR|507f1f77bcf86cd799439081/);
  const [url, init] = fetcher.mock.calls[0] as [URL, RequestInit];
  expect(url.pathname).toBe("/api/v1/timekeeping/work-calendar");
  expect(init.method).toBe("POST");
  expect(JSON.parse(String(init.body))).toEqual({ date: "2026-09-02", name: "Ngày làm bù", dayType: "working_override", isApplied: true });
});

it("synchronizes only the reviewed holiday baseline and returns a count instead of raw rows", async () => {
  const adminReq = { ...req, user: { ...req.user, role: "admin" } } as any;
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "success", data: [
    { _id: "507f1f77bcf86cd799439084", companyCode: "PRIVATE-COMPANY", sourceKey: "new-year-2026", date: "2026-01-01", name: "Tết Dương lịch", dayType: "holiday", actorId: "PRIVATE-ACTOR" },
    { _id: "507f1f77bcf86cd799439085", companyCode: "PRIVATE-COMPANY", sourceKey: "tet-2026-1", date: "2026-02-16", name: "Tết Nguyên đán - ngày 1", dayType: "holiday", actorId: "PRIVATE-ACTOR" },
  ] }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "timekeeping.work-calendar.sync")!;
  const result = await callOperation(adminReq, operation, { year: 2026 } as any);
  expect(result.data).toEqual({ calendarDaysCount: 2 });
  expect(formatAssistantResult(operation, result.data)).toContain("Số ngày trong lịch sau đồng bộ: 2");
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE-COMPANY|PRIVATE-ACTOR|sourceKey|507f1f77bcf86cd79943908/);
  const [url, init] = fetcher.mock.calls[0] as [URL, RequestInit];
  expect(url.pathname).toBe("/api/v1/timekeeping/work-calendar/sync");
  expect(init.method).toBe("POST");
  expect(JSON.parse(String(init.body))).toEqual({ year: 2026 });
});

it("updates a named calendar day but rejects changing system holiday definitions", async () => {
  const adminReq = { ...req, user: { ...req.user, role: "admin" } } as any;
  const adminDayId = "507f1f77bcf86cd799439082";
  const systemDayId = "507f1f77bcf86cd799439083";
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/timekeeping/work-calendar" && init?.method !== "PATCH") return new Response(JSON.stringify({ status: "success", data: [
      { _id: adminDayId, date: "2026-09-02", name: "Ngày làm bù", dayType: "working_override", isApplied: true, source: "admin" },
      { _id: systemDayId, date: "2026-01-01", name: "Tết Dương lịch", dayType: "holiday", isApplied: true, source: "system" },
    ] }), { status: 200 });
    if (input.pathname === `/api/v1/timekeeping/work-calendar/${adminDayId}`) return new Response(JSON.stringify({ status: "success", data: {
      date: "2026-09-03", name: "Ngày làm bù mới", dayType: "working_override", isApplied: true,
    } }), { status: 200 });
    return new Response(JSON.stringify({ status: "error", message: "Unexpected route" }), { status: 404 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "timekeeping.work-calendar.update")!;
  const update = await resolveReferences(adminReq, operation, {
    path_id: "Ngày làm bù", query_year: 2026, date: "2026-09-03", name: "Ngày làm bù mới",
  } as any);
  expect(update.errors).toEqual([]);
  expect(update.values.path_id).toBe(adminDayId);
  const result = await callOperation(adminReq, operation, update.values as any);
  expect(result.data).toEqual({ date: "2026-09-03", name: "Ngày làm bù mới", dayTypeLabel: "Ngày làm việc bù", isApplied: true });
  const [url, init] = fetcher.mock.calls.at(-1) as [URL, RequestInit];
  expect(url.pathname).toBe(`/api/v1/timekeeping/work-calendar/${adminDayId}`);
  expect(init.method).toBe("PATCH");
  expect(JSON.parse(String(init.body))).toEqual({ date: "2026-09-03", name: "Ngày làm bù mới" });

  const forbiddenEdit = await resolveReferences(adminReq, operation, {
    path_id: "Tết Dương lịch", query_year: 2026, name: "Tên khác",
  } as any);
  expect(forbiddenEdit.errors.join(" ")).toContain("Ngày lễ do hệ thống tạo chỉ cho phép bật hoặc tắt áp dụng");
  const missingReason = await resolveReferences(adminReq, operation, {
    path_id: "Ngày làm bù", query_year: 2026, isApplied: false,
  } as any);
  expect(missingReason.errors.join(" ")).toContain("Khi tắt áp dụng một ngày trong lịch, vui lòng nêu lý do");
  expect(fetcher.mock.calls.filter(([, options]) => options?.method === "PATCH")).toHaveLength(1);
});

it("limits account profile operations to the signed-in user's safe fields", async () => {
  const fetcher = vi.fn().mockImplementation(() => new Response(JSON.stringify({ status: "success", user: {
    displayName: "Đỗ Đức Chung", email: "chung@example.test", role: "admin", companyCode: "SECRET-COMPANY",
    facebookIntegration: { pageAccessToken: "secret-page-token" }, tiktokIntegration: { accessToken: "secret-tiktok-token" },
  } }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const read = ASSISTANT_OPERATIONS.find(item => item.id === "account.profile.me")!;
  const readResult = await callOperation(req, read, {} as any);
  expect(readResult.data).toEqual({ displayName: "Đỗ Đức Chung", email: "chung@example.test" });
  expect(JSON.stringify(readResult)).not.toContain("SECRET");
  expect(JSON.stringify(readResult)).not.toContain("secret-");

  const update = ASSISTANT_OPERATIONS.find(item => item.id === "account.profile.update")!;
  const updateResult = await callOperation(req, update, { displayName: "Đức Chung", role: "admin", companyCode: "OTHER", facebookIntegration: "{}" } as any);
  expect(updateResult.data).toEqual({ displayName: "Đỗ Đức Chung" });
  expect(JSON.stringify(updateResult)).not.toContain("SECRET");
  expect(JSON.stringify(updateResult)).not.toContain("secret-");
  const writeCall = fetcher.mock.calls[1];
  expect(JSON.parse(String(writeCall[1].body))).toEqual({ displayName: "Đức Chung" });
});

it("updates only the signed-in account's training business type and hides returned profile data", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "success", data: { user: {
    uid: "internal-user-id", email: "admin@example.test", displayName: "Chủ trung tâm", role: "admin", centerId: "internal-company",
    businessType: "language", bankAccountNo: "123456789", bankId: "hidden-bank-id",
  } } }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "account.business-settings.update")!;
  const result = await callOperation(req, operation, { businessType: "language", companyCode: "OTHER", bankAccountNo: "attacker-value" } as any);
  expect(result.data).toEqual({ businessType: "language" });
  expect(formatAssistantResult(operation, result.data)).toContain("Đào tạo ngoại ngữ");
  expect(JSON.stringify(result)).not.toMatch(/internal-user-id|internal-company|123456789|hidden-bank-id|attacker-value|OTHER/);
  expect((fetcher.mock.calls[0][0] as URL).pathname).toBe("/api/v1/auth/business-settings");
  expect(JSON.parse(String(fetcher.mock.calls[0][1].body))).toEqual({ businessType: "language" });
});

it("projects safe company colleague fields and keeps the record ID only for internal name resolution", async () => {
  const colleagueId = "507f1f77bcf86cd799439064";
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "success", data: [{
    _id: colleagueId, displayName: "Nguyễn An", email: "an@example.test", department: "Kinh doanh",
    jobTitle: "Trưởng nhóm", qualification: "Cử nhân", role: "admin", branchId: "internal-branch-id",
    branchName: "Chi nhánh Hà Nội", photoURL: "https://example.test/photo.png", isActive: true,
  }] }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "account.colleagues.list")!;
  const result = await callOperation(req, operation, {} as any);
  expect(result.data).toEqual([{
    __assistantRef: { id: colleagueId },
    displayName: "Nguyễn An", email: "an@example.test", department: "Kinh doanh", jobTitle: "Trưởng nhóm",
    qualification: "Cử nhân", branchName: "Chi nhánh Hà Nội", isActive: true,
  }]);
  expect(JSON.stringify(result)).not.toContain("internal-");
  expect(JSON.stringify(result)).not.toContain("admin");
  expect(JSON.stringify(result)).not.toContain("photo.png");
  expect(fetcher.mock.calls[0][0].pathname).toBe("/api/v1/auth/users/colleagues");
});

it("projects company knowledge lists without source URLs, customer samples, or conflict values", async () => {
  const fetcher = vi.fn().mockImplementation(async (input: URL) => input.pathname.endsWith("/documents")
    ? new Response(JSON.stringify({ status: "success", companyCode: "SECRET-COMPANY", documents: [{
      id: "507f1f77bcf86cd799439041", title: "Bảng giá", sourceType: "google_doc", sourceUrl: "https://secret.example/doc",
      status: "active", documentType: "pricing", channelScope: ["facebook"], purposeScope: ["sales"], pageScope: "all",
      pageIds: ["secret-page"], chunksCount: 12, createdBy: "secret-user", createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-02T00:00:00.000Z",
    }] }), { status: 200 })
    : input.pathname.endsWith("/scopes")
      ? new Response(JSON.stringify({ status: "success", document: { documentType: "policy", channelScope: ["facebook"], purposeScope: ["sales"], pageScope: "all", updatedAt: "2026-10-04T00:00:00.000Z" } }), { status: 200 })
    : input.pathname.includes("/documents/")
      ? new Response(JSON.stringify({ status: "success", message: "Đã xóa tài liệu.", document: { id: "secret-id", title: "Bảng giá" } }), { status: 200 })
    : input.pathname.endsWith("/conflicts")
      ? new Response(JSON.stringify({ status: "success", conflicts: [{ type: "pricing", severity: "warning", title: "Giá sản phẩm chưa thống nhất", description: "secret description", conflictingValues: { a: "secret-price-a", b: "secret-price-b" }, documentA: { id: "secret-a", title: "Bảng giá cũ", documentType: "pricing" }, documentB: { id: "secret-b", title: "Bảng giá mới", documentType: "pricing" } }] }), { status: 200 })
      : new Response(JSON.stringify({ status: "success", candidates: [{ _id: "507f1f77bcf86cd799439042", question: "Có giao hàng không?", suggestedAnswer: "Có, vui lòng cung cấp địa chỉ.", sampleCustomerMessages: ["secret customer message"], reviewedBy: "secret-user", approvedDocumentId: "secret-doc", category: "shipping", frequency: 8, confidenceScore: 92, status: "pending", lastAskedAt: "2026-10-03T00:00:00.000Z" }] }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const documents = ASSISTANT_OPERATIONS.find(item => item.id === "company-knowledge.documents.list")!;
  const documentResult = await callOperation(req, documents, {} as any);
  expect(documentResult.data[0]).toMatchObject({ id: "507f1f77bcf86cd799439041", title: "Bảng giá", sourceType: "google_doc", chunksCount: 12 });
  expect(JSON.stringify(documentResult)).not.toContain("secret.example");
  expect(JSON.stringify(documentResult)).not.toContain("SECRET-COMPANY");
  expect(JSON.stringify(documentResult)).not.toContain("secret-user");

  const deleteDocument = ASSISTANT_OPERATIONS.find(item => item.id === "company-knowledge.documents.delete")!;
  const deletion = await callOperation(req, deleteDocument, { path_id: "507f1f77bcf86cd799439041" } as any);
  expect(deletion.data).toEqual({ message: "Đã xóa tài liệu.", document: { title: "Bảng giá" } });

  const scopeUpdate = ASSISTANT_OPERATIONS.find(item => item.id === "company-knowledge.documents.scopes.update")!;
  const scopeResult = await callOperation(req, scopeUpdate, { path_id: "507f1f77bcf86cd799439041", documentType: "policy" } as any);
  expect(scopeResult.data).toMatchObject({ documentType: "policy", channelScope: ["facebook"], purposeScope: ["sales"] });
  const scopeCall = fetcher.mock.calls.find(([url, init]) => (url as URL).pathname.endsWith("/documents/507f1f77bcf86cd799439041/scopes") && init?.method === "PATCH")!;
  expect(JSON.parse(String(scopeCall[1].body))).toEqual({ channelScope: ["facebook"], purposeScope: ["sales"], documentType: "policy" });

  const conflicts = ASSISTANT_OPERATIONS.find(item => item.id === "company-knowledge.conflicts.list")!;
  const conflictResult = await callOperation(req, conflicts, {} as any);
  expect(conflictResult.data[0]).toMatchObject({ type: "pricing", title: "Giá sản phẩm chưa thống nhất", documentA: { title: "Bảng giá cũ" } });
  expect(JSON.stringify(conflictResult)).not.toContain("secret-price");
  expect(JSON.stringify(conflictResult)).not.toContain("secret description");

  const faqs = ASSISTANT_OPERATIONS.find(item => item.id === "company-knowledge.faq-candidates.list")!;
  const faqResult = await callOperation(req, faqs, { query_status: "pending" } as any);
  expect(faqResult.data[0]).toMatchObject({ id: "507f1f77bcf86cd799439042", question: "Có giao hàng không?", status: "pending" });
  expect(JSON.stringify(faqResult)).not.toContain("secret customer message");
  expect(JSON.stringify(faqResult)).not.toContain("secret-user");
  expect(JSON.stringify(faqResult)).not.toContain("secret-doc");
  expect(fetcher.mock.calls[5][0].searchParams.get("status")).toBe("pending");
});

it("shows company knowledge health without document contents, company ids, or reply history", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
    companyCode: "TENANT-SECRET", mode: "trained", documentsCount: 2, chunksCount: 19,
    detectedTopics: [{ key: "pricing", label: "Giá và bảng giá" }, { key: "shipping", label: "Giao hàng" }],
    warnings: ["Tài liệu có thể cần cập nhật."], latestSyncAt: "2026-10-30T01:00:00.000Z", latestReplyAt: "2026-10-30T02:00:00.000Z",
    conflicts: [{ title: "secret conflict", conflictingValues: { old: "secret price" } }],
    documents: [{ id: "secret-document-id", title: "Bảng giá bí mật", sourceUrl: "https://secret.example/doc" }],
    scenarioDocuments: [{ id: "secret-scenario-id", title: "Kịch bản riêng" }],
  }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "company-knowledge.health")!;
  const result = await callOperation(req, operation, {} as any);
  expect(result.data).toEqual({
    mode: "trained", documentsCount: 2, chunksCount: 19, detectedTopics: "Giá và bảng giá, Giao hàng",
    warnings: "Tài liệu có thể cần cập nhật.", latestSyncAt: "2026-10-30T01:00:00.000Z",
  });
  const summary = formatAssistantResult(operation, result.data);
  expect(summary).toContain("Giá và bảng giá, Giao hàng");
  expect(JSON.stringify(result)).not.toMatch(/TENANT-SECRET|secret conflict|secret price|secret-document-id|secret\.example|Bảng giá bí mật|latestReplyAt|Kịch bản riêng/);
});

it("returns only a completion flag when clearing the company knowledge base", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
    status: "success", message: "Đã xóa dữ liệu của TENANT-SECRET", companyCode: "TENANT-SECRET",
  }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "company-knowledge.clear-all")!;
  const result = await callOperation(req, operation, {} as any);
  expect(result.data).toEqual({ cleared: true });
  expect(JSON.stringify(result)).not.toContain("TENANT-SECRET");
  expect(formatAssistantResult(operation, result.data)).toContain("Đã xóa toàn bộ kho tri thức: Có");
  expect(fetcher.mock.calls[0][1].method).toBe("POST");
  expect(JSON.parse(String(fetcher.mock.calls[0][1].body))).toEqual({});
});

it("resolves recruitment names within a selected branch and freezes record versions for confirmation", async () => {
  const jobId = "507f1f77bcf86cd799439031";
  const fetcher = vi.fn().mockImplementation(async (input: URL) => {
    if (input.pathname === "/api/v1/recruitment/jobs" && input.searchParams.has("search")) {
      return new Response(JSON.stringify({ data: [{ _id: jobId, code: "DEV-01", title: "Kỹ sư QA", branchId: req.user.branchId, version: 4 }] }), { status: 200 });
    }
    if (input.pathname === `/api/v1/recruitment/jobs/${jobId}`) {
      return new Response(JSON.stringify({ data: { _id: jobId, code: "DEV-01", title: "Kỹ sư QA", branchId: req.user.branchId, version: 4 } }), { status: 200 });
    }
    return new Response(JSON.stringify({ data: [] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const update = ASSISTANT_OPERATIONS.find(op => op.id === "recruitment.job.update")!;
  const resolution = await resolveReferences(req, update, { path_id: "Kỹ sư QA", title: "Kỹ sư kiểm thử" } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values).toMatchObject({ path_id: jobId, branchId: req.user.branchId, version: 4 });
  expect(resolution.labels.version).toContain("tự động");
  expect(fetcher.mock.calls.map(([url, init]) => ({ path: (url as URL).pathname, branchId: (url as URL).searchParams.get("branchId"), header: (init as any).headers["x-branch-id"] }))).toEqual([
    { path: "/api/v1/recruitment/jobs", branchId: req.user.branchId, header: req.user.branchId },
    { path: `/api/v1/recruitment/jobs/${jobId}`, branchId: req.user.branchId, header: req.user.branchId },
  ]);

  fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ data: { _id: jobId, version: 5 } }), { status: 200 }));
  const stale = await resolveReferences(req, update, { path_id: jobId, branchId: req.user.branchId, version: 4, __assistantPinnedVersion: true } as any);
  expect(stale.errors.join(" ")).toContain("đã thay đổi sau khi bạn xem bản xác nhận");
});

it("rechecks a pinned recruitment job by internal ID without sending the ID as a text search", async () => {
  const jobId = "507f1f77bcf86cd799439035";
  const branchId = req.user.branchId;
  const fetcher = vi.fn().mockImplementation(async (input: URL) => {
    if (input.pathname !== "/api/v1/recruitment/jobs") return new Response(JSON.stringify({ data: [] }), { status: 200 });
    if (input.searchParams.get("search") === jobId) return new Response(JSON.stringify({ data: [] }), { status: 200 });
    return new Response(JSON.stringify({ data: [{ _id: jobId, code: "QA-01", title: "QA HR Test", status: "draft", branchId }] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);

  const create = ASSISTANT_OPERATIONS.find(op => op.id === "recruitment.applicant.create")!;
  const resolved = await resolveReferences(req, create, { branchId, jobId, fullName: "QA Candidate" } as any);

  expect(resolved.errors).toEqual([]);
  expect(resolved.values.jobId).toBe(jobId);
  const listCall = fetcher.mock.calls.find(([input]) => (input as URL).pathname === "/api/v1/recruitment/jobs");
  expect(listCall).toBeDefined();
  expect((listCall![0] as URL).searchParams.get("search")).toBe("");
});

it("requires an admin-selected recruitment branch and sends system-managed versions", async () => {
  const branchId = "507f1f77bcf86cd799439032";
  const admin = { ...req, user: { id: "actor", companyCode: "TEST", role: "admin" }, headers: req.headers } as any;
  const fetcher = vi.fn().mockImplementation(async (input: URL) => input.pathname === "/api/v1/auth/branches"
    ? new Response(JSON.stringify({ data: [{ _id: branchId, name: "Chi nhánh Hà Nội", companyCode: "TEST", isActive: true }] }), { status: 200 })
    : new Response(JSON.stringify({ data: [] }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const list = ASSISTANT_OPERATIONS.find(op => op.id === "recruitment.job.list")!;
  const branch = await resolveReferences(admin, list, { branchId: "Chi nhánh Hà Nội" } as any);
  expect(branch.errors).toEqual([]);
  expect(branch.values.branchId).toBe(branchId);
  await expect(callOperation(admin, list, {})).rejects.toThrow("chi nhánh tuyển dụng");

  fetcher.mockClear();
  fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ data: { _id: "507f1f77bcf86cd799439033", version: 3 } }), { status: 200 }));
  const update = ASSISTANT_OPERATIONS.find(op => op.id === "recruitment.job.update")!;
  await callOperation(admin, update, { path_id: "507f1f77bcf86cd799439033", branchId, version: 3, title: "Vị trí mới" } as any);
  expect(JSON.parse(fetcher.mock.calls[0][1].body).version).toBe(3);
  expect((fetcher.mock.calls[0][0] as URL).searchParams.get("branchId")).toBe(branchId);
  expect(fetcher.mock.calls[0][1].headers["x-branch-id"]).toBe(branchId);
});

it("reports recruitment duplicate matches without implying an applicant was created", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { duplicateWarning: true, matches: [{ fullName: "Ứng viên đã có", email: "qa@example.test", phone: "0900000000" }] } }), { status: 201 }));
  vi.stubGlobal("fetch", fetcher);
  const create = ASSISTANT_OPERATIONS.find(op => op.id === "recruitment.applicant.create")!;
  const result = await callOperation(req, create, { jobId: "507f1f77bcf86cd799439034", fullName: "Ứng viên đã có" } as any);
  expect(result.data).toMatchObject({ created: false, duplicateWarning: true });
  expect(result.data.message).toContain("Chưa tạo ứng viên");
});

it("does not open a recruitment job without all publication fields and a future deadline", async () => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  const create = ASSISTANT_OPERATIONS.find(op => op.id === "recruitment.job.create")!;
  await expect(callOperation(req, create, { branchId: req.user.branchId, code: "DEV-01", title: "Kỹ sư QA", status: "open" } as any)).rejects.toThrow("Chưa thể mở tuyển");
  expect(fetcher).not.toHaveBeenCalled();
});

it("keeps repair intake scoped to known customers and a service-ticket default", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: { ticketCode: "REP-QA", status: "received" } }), { status: 201 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.path === "/repair/tickets" && item.method === "POST")!;
  expect(operation.confirmation).toBe(true);
  expect(operation.fields.find(field => field.key === "customerId")?.reference).toBe("customer.list");
  expect(operation.fields.find(field => field.key === "ticketType")?.defaultValue).toBe("service");
  const values = Object.fromEntries(operation.fields.map(field => [field.key, sampleValue(field)]));
  await callOperation(req, operation, values, undefined, "repair-create-test-id");
  const body = JSON.parse(fetcher.mock.calls[0][1].body);
  expect(body.ticketType).toBe("service");
  expect(body.subjectType).toBe("equipment");
  expect(body.idempotencyKey).toBe("repair-create-test-id");
  expect(body.device).toEqual({ name: "test", condition: "test" });
});

it("resolves a selected repair customer when branch details change its display label", async () => {
  const customerId = "507f1f77bcf86cd7994390b1";
  const branchId = req.user.branchId;
  let branchLookups = 0;
  const customer = { _id: customerId, name: "chung", customerCode: "KH-ABC-000001", phone: "0987218128", status: "active", branchId };
  const fetcher = vi.fn().mockImplementation((input: string | URL) => {
    const url = new URL(String(input));
    if (url.pathname === "/api/v1/customers") {
      const query = url.searchParams.get("q") || "";
      const items = !query || query === "chung" ? [customer] : [];
      return new Response(JSON.stringify({ success: true, data: { items, total: items.length } }), { status: 200 });
    }
    if (url.pathname === "/api/v1/auth/branches") {
      branchLookups += 1;
      const data = branchLookups === 1 ? [] : [{ _id: branchId, name: "Hà Nội" }];
      return new Response(JSON.stringify({ success: true, data }), { status: 200 });
    }
    return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);

  const operation = ASSISTANT_OPERATIONS.find(item => item.path === "/repair/tickets" && item.method === "POST")!;
  const customerField = operation.fields.find(field => field.key === "customerId")!;
  const options = await suggestReferenceOptions(req, operation, customerField, {} as any);
  expect(options).toContain("chung — KH-ABC-000001 — 0987218128");

  const selected = await resolveReferences(req, operation, { customerId: "chung — KH-ABC-000001 — 0987218128" } as any);
  expect(selected.errors).toEqual([]);
  expect(selected.values.customerId).toBe(customerId);
  expect(branchLookups).toBe(2);
});

it("resolves a named customer to an internal path ID without returning the ID in the prompt", async () => {
  const customerId = "507f1f77bcf86cd799439011";
  const branchId = "507f1f77bcf86cd799439012";
  const fetcher = vi.fn().mockImplementation(async (input: URL) => {
    if (input.pathname.endsWith("/auth/branches")) return new Response(JSON.stringify({ success: true, data: [{ _id: branchId, name: "Trụ sở chính", code: "MAIN" }] }), { status: 200 });
    return new Response(JSON.stringify({ success: true, data: [{ _id: customerId, customerCode: "KH-001", name: "Công ty Ánh Dương", phone: "0900000000", version: 3, branchId }] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.method === "PATCH" && item.path === "/customers/:id")!;
  const resolution = await resolveReferences({ ...req, user: { id: "actor", companyCode: "TEST", role: "admin" } } as any, operation, { path_id: "KH-001", phone: "0900000000" } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.path_id).toBe(customerId);
  expect(resolution.labels.path_id).toContain("KH-001");
  expect(resolution.labels.path_id).toContain("Trụ sở chính");
  expect(resolution.errors.join(" ")).not.toContain(customerId);
});

it("resolves partner updates by name from the partners list and sends only the requested bank details", async () => {
  const partnerId = "507f1f77bcf86cd799439051";
  const branchId = req.user.branchId;
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname.endsWith("/auth/branches")) return new Response(JSON.stringify({ success: true, data: [{ _id: branchId, name: "Chi nhánh Hà Nội" }] }), { status: 200 });
    if (input.pathname === "/api/v1/partners") return new Response(JSON.stringify({ success: true, partners: [{ _id: partnerId, name: "Nguyễn Hoàng Minh Phương", phone: "0985645175", branchId, __v: 3 }], total: 1 }), { status: 200 });
    if (input.pathname === `/api/v1/partners/${partnerId}`) return new Response(JSON.stringify({ success: true, data: { _id: partnerId, name: "Nguyễn Hoàng Minh Phương", bankName: "ACB" } }), { status: 200 });
    return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "partner.bank-details.update")!;
  expect(operation.fields.find(field => field.key === "path_id")?.label).toBe("Tên hoặc số điện thoại đối tác");
  expect(operation.fields.find(field => field.key === "path_id")?.reference).toBe("partner.list");
  const resolution = await resolveReferences(req, operation, {
    path_id: "Nguyễn Hoàng Minh Phương", bankName: "ACB", bankAccountNo: "12345678", bankAccountName: "NGUYEN HOANG MINH PHUONG",
  } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.path_id).toBe(partnerId);
  expect(resolution.values.expectedVersion).toBe(3);
  expect(resolution.labels.path_id).toContain("Nguyễn Hoàng Minh Phương");
  const listUrl = fetcher.mock.calls.map(([url]) => url as URL).find(url => url.pathname === "/api/v1/partners");
  expect(listUrl?.searchParams.get("search")).toBe("Nguyễn Hoàng Minh Phương");
  await callOperation(req, operation, resolution.values as any);
  const updateCall = fetcher.mock.calls.find(([url]) => (url as URL).pathname === `/api/v1/partners/${partnerId}`)!;
  expect(JSON.parse(updateCall[1].body)).toMatchObject({ expectedVersion: 3, bankName: "ACB", bankAccountNo: "12345678", bankAccountName: "NGUYEN HOANG MINH PHUONG" });
  expect((updateCall[0] as URL).pathname).not.toContain("Nguyễn Hoàng Minh Phương");
});

it("configures a named referral partner commission with an explicit rate type and value", async () => {
  const partnerId = "507f1f77bcf86cd799439052";
  const branchId = req.user.branchId;
  const fetcher = vi.fn().mockImplementation(async (input: URL) => {
    if (input.pathname.endsWith("/auth/branches")) return new Response(JSON.stringify({ success: true, data: [{ _id: branchId, name: "Chi nhánh Hà Nội" }] }), { status: 200 });
    if (input.pathname === "/api/v1/partners") return new Response(JSON.stringify({ success: true, partners: [{ _id: partnerId, name: "Nguyễn Hoàng Minh Phương", phone: "0985645175", branchId, __v: 2 }] }), { status: 200 });
    return new Response(JSON.stringify({ success: true, data: { name: "Nguyễn Hoàng Minh Phương", commissionType: "percentage", commissionValue: 5 } }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "partner.commission.update")!;
  const resolution = await resolveReferences(req, operation, { path_id: "Nguyễn Hoàng Minh Phương", commissionType: "percentage", commissionValue: 8 } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.path_id).toBe(partnerId);
  expect(resolution.values.expectedVersion).toBe(2);
  await callOperation(req, operation, resolution.values as any);
  const updateCall = fetcher.mock.calls.find(([url]) => (url as URL).pathname === `/api/v1/partners/${partnerId}`)!;
  expect(JSON.parse(updateCall[1].body)).toEqual({ expectedVersion: 2, commissionType: "percentage", commissionValue: 8 });
});

it("resolves class names inside a bulk student request before confirmation and dispatch", async () => {
  const batchId = "507f1f77bcf86cd799439057";
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/batches") return new Response(JSON.stringify({ success: true, data: [{ _id: batchId, code: "LOP-01", courseTitle: "Lớp Toán A" }] }), { status: 200 });
    return new Response(JSON.stringify({ success: true, data: { importedCount: 1, skippedCount: 0, errors: [] } }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.method === "POST" && item.path === "/students/bulk")!;
  const resolution = await resolveReferences(req, operation, { students: JSON.stringify([{ fullName: "Đỗ Đức Chung", phone: "0900000000", email: "chung@example.test", batchCode: "Lớp Toán A" }]) } as any);
  expect(resolution.errors).toEqual([]);
  expect(JSON.parse(String(resolution.values.students))).toEqual([{ fullName: "Đỗ Đức Chung", phone: "0900000000", email: "chung@example.test", batchCode: "LOP-01" }]);
  await callOperation(req, operation, resolution.values as any);
  const writeCall = fetcher.mock.calls.find(([, init]) => init?.method === "POST")!;
  expect(JSON.parse(String(writeCall[1].body)).students[0].batchCode).toBe("LOP-01");
});

it("resolves a class by a partial course title when adding a learner", async () => {
  const batchId = "507f1f77bcf86cd7994390c1";
  const studentId = "507f1f77bcf86cd7994390c2";
  const fetcher = vi.fn().mockImplementation((input: URL) => {
    if (input.pathname === "/api/v1/batches") return new Response(JSON.stringify({ success: true, data: [
      { _id: batchId, code: "LOPHOCKIEMTIEN001", courseTitle: "Lớp học kiếm tiền tỷ" },
    ] }), { status: 200 });
    if (input.pathname === "/api/v1/students") return new Response(JSON.stringify({ success: true, data: [
      { _id: studentId, fullName: "Sơn" },
    ] }), { status: 200 });
    throw new Error(`Unexpected request: ${input.pathname}`);
  });
  vi.stubGlobal("fetch", fetcher);

  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "student.batch.learner.add")!;
  const resolution = await resolveReferences(req, operation, {
    path_id: "lớp học kiếm tiền", studentId: "Sơn",
  } as any);

  expect(resolution.errors).toEqual([]);
  expect(resolution.values).toMatchObject({ path_id: batchId, studentId });
  const batchLookup = fetcher.mock.calls.find(([input]) => (input as URL).pathname === "/api/v1/batches")!;
  expect((batchLookup[0] as URL).searchParams.get("search")).toBe("lớp học kiếm tiền");
});

it("suggests a likely class after removing request wording and a misspelled final word, without auto-selecting it", async () => {
  const batchId = "507f1f77bcf86cd7994390c3";
  const searches: string[] = [];
  const fetcher = vi.fn().mockImplementation((input: URL) => {
    if (input.pathname === "/api/v1/batches") {
      const search = input.searchParams.get("search") || "";
      searches.push(search);
      const rows = search === "lớp học kiếm" ? [{ _id: batchId, code: "LOPHOCKIEMTIEN001", courseTitle: "Lớp học kiếm tiền tỷ" }] : [];
      return new Response(JSON.stringify({ success: true, data: rows }), { status: 200 });
    }
    throw new Error(`Unexpected request: ${input.pathname}`);
  });
  vi.stubGlobal("fetch", fetcher);

  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "student.batch.detail")!;
  const resolution = await resolveReferences(req, operation, { path_id: "thông tin lớp học kiếm tiềm" } as any);

  expect(searches.slice(0, 2)).toEqual(["lớp học kiếm tiềm", "lớp học kiếm"]);
  expect(searches).toContain("thông tin lớp học kiếm tiềm");
  expect(resolution.errors.length).toBeGreaterThan(0);
  expect(resolution.values.path_id).toBe("thông tin lớp học kiếm tiềm");
});

it("offers a selectable class when a short two-word class name contains a typo", async () => {
  const batchId = "507f1f77bcf86cd7994390c5";
  const searches: string[] = [];
  const fetcher = vi.fn().mockImplementation((input: URL) => {
    if (input.pathname !== "/api/v1/batches") throw new Error(`Unexpected request: ${input.pathname}`);
    const search = input.searchParams.get("search") || "";
    searches.push(search);
    const rows = search === "kiếm" ? [{ _id: batchId, code: "LOPKIEMTIEN", courseTitle: "Lớp học kiếm tiền" }] : [];
    return new Response(JSON.stringify({ success: true, data: rows }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);

  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "student.batch.detail")!;
  const resolution = await resolveReferences(req, operation, { path_id: "kiếm tiềm" } as any);

  expect(searches.slice(0, 2)).toEqual(["kiếm tiềm", "kiếm"]);
  expect(resolution.errors[0]).toContain("Lớp học kiếm tiền");
  expect(resolution.values.path_id).toBe("kiếm tiềm");
});

it("lets an admin disambiguate same-name partners by the displayed branch label", async () => {
  const partnerA = "507f1f77bcf86cd799439053";
  const partnerB = "507f1f77bcf86cd799439054";
  const branchA = "507f1f77bcf86cd799439055";
  const branchB = "507f1f77bcf86cd799439056";
  const adminReq = { ...req, user: { ...req.user, role: "admin", branchId: undefined } } as any;
  const fetcher = vi.fn().mockImplementation(async (input: URL) => {
    if (input.pathname === "/api/v1/partners") {
      const search = input.searchParams.get("search") || "";
      const rows = search.includes(" — ") ? [] : [
        { _id: partnerA, name: "Nguyễn Hoàng Minh Phương", phone: "0985645175", branchId: branchA, __v: 2 },
        { _id: partnerB, name: "Nguyễn Hoàng Minh Phương", phone: "0985645175", branchId: branchB, __v: 4 },
      ];
      return new Response(JSON.stringify({ success: true, partners: rows }), { status: 200 });
    }
    if (input.pathname === "/api/v1/auth/branches") return new Response(JSON.stringify({ success: true, data: [
      { _id: branchA, name: "Chi nhánh Hà Nội" }, { _id: branchB, name: "Chi nhánh Đà Nẵng" },
    ] }), { status: 200 });
    return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "partner.commission.update")!;
  const resolution = await resolveReferences(adminReq, operation, {
    path_id: "Nguyễn Hoàng Minh Phương — chi nhánh Đà Nẵng", commissionType: "fixed", commissionValue: 250000,
  } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.path_id).toBe(partnerB);
  expect(resolution.labels.path_id).toContain("Chi nhánh Đà Nẵng");
  expect(fetcher.mock.calls.some(([url]) => (url as URL).searchParams.get("search") === "Nguyễn Hoàng Minh Phương")).toBe(true);
});

it("finds labor contracts by worker name without exposing the worker's internal ID", async () => {
  const contractId = "507f1f77bcf86cd799439061";
  const workerId = "507f1f77bcf86cd799439062";
  const branchId = req.user.branchId;
  const fetcher = vi.fn().mockImplementation(async (input: URL) => {
    if (input.pathname === "/api/v1/worker-management/labor-contracts") return new Response(JSON.stringify({ success: true, data: [{ _id: contractId, workerId, code: "HD-2026-01", clientName: "Công ty Ánh Dương", startDate: "2026-01-01", endDate: "2026-12-31", status: "active", companyCode: "TEST", branchId }] }), { status: 200 });
    if (input.pathname === "/api/v1/worker-management/workers") return new Response(JSON.stringify({ workers: [{ _id: workerId, fullName: "Đỗ Đức Chung", companyCode: "TEST", branchId }] }), { status: 200 });
    return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const records = await lookupRecords(req, "worker.labor.contract.list", "Đỗ Đức Chung");
  const update = ASSISTANT_OPERATIONS.find(item => item.method === "PATCH" && item.path === "/worker-management/labor-contracts/:id")!;
  const resolution = await resolveReferences(req, update, { path_id: "Đỗ Đức Chung", note: "Bổ sung phụ lục" } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.path_id).toBe(contractId);
  expect(resolution.labels.path_id).toContain("HD-2026-01");
  expect(resolution.labels.path_id).not.toContain(contractId);

  expect(records[0]).toMatchObject({ workerName: "Đỗ Đức Chung", code: "HD-2026-01", clientName: "Công ty Ánh Dương" });
  expect(JSON.stringify(records)).not.toContain(workerId);
});

it("confirms only a pending labor referral by partner and worker names", async () => {
  const partnerId = "507f1f77bcf86cd799439091";
  const pendingReferralId = "507f1f77bcf86cd799439092";
  const activeReferralId = "507f1f77bcf86cd799439093";
  const branchId = req.user.branchId;
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/worker-management/partners" && init?.method !== "POST") {
      return new Response(JSON.stringify({ success: true, data: [{ _id: partnerId, code: "LAB-01", name: "Công ty Ánh Dương", companyCode: "TEST", branchId }] }), { status: 200 });
    }
    if (input.pathname === `/api/v1/worker-management/partners/${partnerId}/referrals` && init?.method !== "POST") {
      return new Response(JSON.stringify({ success: true, data: [
        { _id: activeReferralId, workerId: "507f1f77bcf86cd799439094", workerName: "Đỗ Đức Chung", effectiveFrom: "2025-01-01", effectiveTo: "2025-12-31", status: "active", companyCode: "TEST", branchId },
        { _id: pendingReferralId, workerId: "507f1f77bcf86cd799439095", workerName: "Đỗ Đức Chung", effectiveFrom: "2026-01-01", effectiveTo: null, status: "pending", companyCode: "TEST", branchId },
      ] }), { status: 200 });
    }
    if (input.pathname === `/api/v1/worker-management/partners/${partnerId}/referrals/${pendingReferralId}/confirm`) {
      return new Response(JSON.stringify({ success: true, data: { status: "active", confirmedAt: "2026-10-30T00:00:00.000Z" } }), { status: 200 });
    }
    return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "worker.partner.referral.confirm")!;
  const resolution = await resolveReferences(req, operation, {
    path_partnerId: "Công ty Ánh Dương",
    path_referralId: "Đỗ Đức Chung",
  } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.path_partnerId).toBe(partnerId);
  expect(resolution.values.path_referralId).toBe(pendingReferralId);
  expect(resolution.labels.path_referralId).toContain("2026-01-01");
  expect(resolution.labels.path_referralId).not.toContain(pendingReferralId);

  const result = await callOperation(req, operation, resolution.values as any);
  const write = fetcher.mock.calls.find(([url, init]) => (url as URL).pathname.endsWith(`/${pendingReferralId}/confirm`) && init?.method === "POST")!;
  expect((write[0] as URL).pathname).toBe(`/api/v1/worker-management/partners/${partnerId}/referrals/${pendingReferralId}/confirm`);
  expect(JSON.parse(String(write[1].body))).toEqual({});
  expect(formatAssistantResult(operation, result.data)).toContain("Đang hoạt động");
  expect(JSON.stringify(result)).not.toContain(pendingReferralId);

  const referralList = ASSISTANT_OPERATIONS.find(item => item.id === "worker.partner.referrals.list")!;
  const listResult = await callOperation(req, referralList, { path_partnerId: partnerId } as any);
  const listReply = formatAssistantResult(referralList, listResult.data);
  expect(listReply).toContain("Đỗ Đức Chung");
  expect(listReply).toContain("Đang hoạt động");
  expect(listReply).not.toContain(partnerId);
  expect(listReply).not.toContain(pendingReferralId);
  expect(listReply).not.toContain(activeReferralId);
});

it("creates cash vouchers by named branch and returns a sanitized cashbook", async () => {
  const branchId = "507f1f77bcf86cd799439101";
  const voucherId = "507f1f77bcf86cd799439102";
  const adminReq = { ...req, user: { id: "actor", companyCode: "TEST", role: "admin" } } as any;
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/auth/branches") return new Response(JSON.stringify({ success: true, data: [{ _id: branchId, name: "Chi nhánh Hà Nội", companyCode: "TEST" }] }), { status: 200 });
    if (input.pathname === "/api/v1/retail/finance/cashbook/vouchers" && init?.method === "POST") {
      return new Response(JSON.stringify({ success: true, data: {
        _id: voucherId, companyCode: "TEST", branchId, sourceKey: "voucher:request-123", createdBy: "internal-actor",
        businessDate: "2026-10-30", account: "cash", direction: "out", profitCategory: "expense", amount: 2000000,
        reason: "Mua vật tư cửa hàng", reference: "PX-01",
      } }), { status: 200 });
    }
    if (input.pathname === "/api/v1/retail/finance/cashbook" && init?.method !== "POST") {
      return new Response(JSON.stringify({ success: true, data: {
        entries: [{ sourceKey: "order:internal-order-id:payment:0", shiftId: "internal-shift-id", businessDate: "2026-10-30", account: "cash", direction: "in", amount: 100000, description: "Thu đơn DH-12", reference: "payment-ref" }],
        summary: { count: 1, cashNet: 100000, bankNet: 0, digest: "private-digest" },
        shiftsReconciliation: [{ shiftId: "internal-shift-id", shiftCode: "CA-01", businessDate: "2026-10-30", status: "closed", expectedCash: 100000, countedCash: 100000, varianceAmount: 0 }],
      } }), { status: 200 });
    }
    return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const create = ASSISTANT_OPERATIONS.find(item => item.id === "retail.finance.cashbook.voucher.create")!;
  const resolution = await resolveReferences(adminReq, create, {
    targetBranch: "Chi nhánh Hà Nội", businessDate: "2026-10-30", account: "cash", direction: "out",
    profitCategory: "expense", amount: 2000000, reason: "Mua vật tư cửa hàng", reference: "PX-01",
  } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.targetBranch).toBe(branchId);
  const created = await callOperation(adminReq, create, resolution.values as any, undefined, "request-123");
  const write = fetcher.mock.calls.find(([url, init]) => (url as URL).pathname.endsWith("/cashbook/vouchers") && init?.method === "POST")!;
  expect((write[0] as URL).searchParams.get("branchId")).toBe(branchId);
  expect(JSON.parse(String(write[1].body))).toEqual({ businessDate: "2026-10-30", account: "cash", direction: "out", profitCategory: "expense", amount: 2000000, reason: "Mua vật tư cửa hàng", reference: "PX-01", idempotencyKey: "request-123" });
  expect(JSON.stringify(created)).not.toMatch(/internal-|sourceKey|companyCode|branchId|voucherId/);
  expect(formatAssistantResult(create, created.data)).toContain("Mua vật tư cửa hàng");

  const list = ASSISTANT_OPERATIONS.find(item => item.id === "retail.finance.cashbook.list")!;
  const listed = await callOperation(req, list, { query_from: "2026-10-30", query_to: "2026-10-30" } as any);
  expect(JSON.stringify(listed)).not.toMatch(/internal-|sourceKey|shiftId|digest/);
  const reply = formatAssistantResult(list, listed.data);
  expect(reply).toContain("Thu đơn DH-12");
  expect(reply).toContain("Tiền mặt");
  expect(reply).toContain("payment-ref");
});

it("closes a retail cashbook period by named branch and hides its digest", async () => {
  const branchId = "507f1f77bcf86cd799439104";
  const periodId = "507f1f77bcf86cd799439105";
  const adminReq = { ...req, user: { id: "actor", companyCode: "TEST", role: "admin" } } as any;
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/auth/branches") return new Response(JSON.stringify({ success: true, data: [{ _id: branchId, name: "Chi nhánh Hà Nội", companyCode: "TEST" }] }), { status: 200 });
    if (input.pathname === "/api/v1/retail/finance/cashbook/close" && init?.method === "POST") return new Response(JSON.stringify({ success: true, data: {
      _id: periodId, branchId, from: "2026-10-01", to: "2026-10-31", count: 24, cashNet: 1200000, bankNet: 3400000,
      digest: "private-digest", closedBy: "internal-actor", closedAt: "2026-11-01T00:00:00.000Z",
    } }), { status: 200 });
    return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "retail.finance.cashbook.close")!;
  const resolution = await resolveReferences(adminReq, operation, { targetBranch: "Chi nhánh Hà Nội", from: "2026-10-01", to: "2026-10-31" } as any);
  expect(resolution.errors).toEqual([]);
  const result = await callOperation(adminReq, operation, resolution.values as any);
  const write = fetcher.mock.calls.find(([url, init]) => (url as URL).pathname.endsWith("/cashbook/close") && init?.method === "POST")!;
  expect((write[0] as URL).searchParams.get("branchId")).toBe(branchId);
  expect(JSON.parse(String(write[1].body))).toEqual({ from: "2026-10-01", to: "2026-10-31" });
  expect(JSON.stringify(result)).not.toMatch(/private-digest|internal-actor|periodId|branchId/);
  expect(formatAssistantResult(operation, result.data)).toContain("31/10/2026");
});

it("runs retail receivables reconciliation only for a named branch and hides internal order IDs", async () => {
  const branchId = "507f1f77bcf86cd799439130";
  const adminReq = { ...req, user: { id: "actor", companyCode: "TEST", role: "admin" } } as any;
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/auth/branches") return new Response(JSON.stringify({ success: true, data: [{ _id: branchId, name: "Chi nhánh Hà Nội", companyCode: "TEST" }] }), { status: 200 });
    if (input.pathname === "/api/v1/retail/receivables/reconciliations" && init?.method === "POST") return new Response(JSON.stringify({ success: true, data: {
      _id: "internal-reconciliation-id", branchId, orderTotal: 450000, ledgerTotal: 400000, differenceTotal: 50000,
      differences: [{ orderId: "internal-order-id", orderCode: "DH-130", amount: 50000 }],
      createdBy: "internal-actor-id", createdAt: "2026-10-30T00:00:00.000Z",
    } }), { status: 201 });
    if (input.pathname === "/api/v1/retail/receivables/reconciliations/latest") return new Response(JSON.stringify({ success: true, data: {
      _id: "internal-reconciliation-id", branchId, orderTotal: 450000, ledgerTotal: 400000, differenceTotal: 50000,
      differences: [{ orderId: "internal-order-id", orderCode: "DH-130", amount: 50000 }],
      createdBy: "internal-actor-id", createdAt: "2026-10-30T00:00:00.000Z",
    } }), { status: 200 });
    return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);

  const run = ASSISTANT_OPERATIONS.find(item => item.id === "retail.receivable.reconciliation.run")!;
  const missingBranch = await resolveReferences(adminReq, run, {} as any);
  expect(missingBranch.errors.join(" ")).toContain("nêu tên chi nhánh");

  const resolution = await resolveReferences(adminReq, run, { targetBranch: "Chi nhánh Hà Nội" } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.targetBranch).toBe(branchId);
  const result = await callOperation(adminReq, run, resolution.values as any);
  const write = fetcher.mock.calls.find(([url, init]) => (url as URL).pathname.endsWith("/reconciliations") && init?.method === "POST")!;
  expect((write[0] as URL).searchParams.get("branchId")).toBe(branchId);
  expect(JSON.parse(String(write[1].body))).toEqual({});
  expect(result.data).toEqual({ differenceCount: 1, orderTotal: 450000, ledgerTotal: 400000, differenceTotal: 50000, createdAt: "2026-10-30T00:00:00.000Z" });
  expect(JSON.stringify(result)).not.toMatch(/internal-|orderId|orderCode|branchId|createdBy/);

  const latest = ASSISTANT_OPERATIONS.find(item => item.id === "retail.receivable.reconciliation.latest")!;
  const latestResult = await callOperation(adminReq, latest, { targetBranch: branchId } as any);
  expect(latestResult.data).toEqual(result.data);
  expect(JSON.stringify(latestResult)).not.toMatch(/internal-|orderId|orderCode|branchId|createdBy/);
});

it("looks up retail receivable history by customer name and projects safe ledger fields", async () => {
  const branchId = "507f1f77bcf86cd799439131";
  const customerId = "507f1f77bcf86cd799439132";
  const adminReq = { ...req, user: { id: "actor", companyCode: "TEST", role: "admin" } } as any;
  const fetcher = vi.fn().mockImplementation(async (input: URL) => {
    if (input.pathname === "/api/v1/auth/branches") return new Response(JSON.stringify({ success: true, data: [{ _id: branchId, name: "Chi nhánh Hà Nội", companyCode: "TEST" }] }), { status: 200 });
    if (input.pathname === "/api/v1/customers") return new Response(JSON.stringify({ success: true, data: [{ _id: customerId, code: "KH-013", name: "Nguyễn Minh An", phone: "0900000132" }] }), { status: 200 });
    if (input.pathname === `/api/v1/retail/receivables/customers/${customerId}`) return new Response(JSON.stringify({ success: true, data: {
      items: [{ _id: "internal-entry-id", receivableId: "internal-receivable-id", customerId, orderId: "internal-order-id", type: "payment", amount: 125000, signedAmount: -125000, runningBalance: 375000, reason: "Khách thanh toán lần một", paymentMethod: "cash", reference: "PT-013", createdAt: "2026-10-30T00:00:00.000Z", createdBy: "internal-actor-id" }],
      total: 1, page: 1, limit: 20, currentBalance: 375000,
    } }), { status: 200 });
    return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "retail.receivable.customer.history")!;
  const resolution = await resolveReferences(adminReq, operation, { path_customerId: "Nguyễn Minh An", targetBranch: "Chi nhánh Hà Nội" } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values).toMatchObject({ path_customerId: customerId, targetBranch: branchId });

  const result = await callOperation(adminReq, operation, resolution.values as any);
  const historyCall = fetcher.mock.calls.find(([url]) => (url as URL).pathname === `/api/v1/retail/receivables/customers/${customerId}`)!;
  expect((historyCall[0] as URL).searchParams.get("branchId")).toBe(branchId);
  expect(result.data).toEqual([{ type: "payment", amount: 125000, signedAmount: -125000, runningBalance: 375000, reason: "Khách thanh toán lần một", paymentMethod: "cash", reference: "PT-013", createdAt: "2026-10-30T00:00:00.000Z" }]);
  expect(JSON.stringify(result)).not.toMatch(/internal-|customerId|orderId|receivableId|0900000132/);
  const reply = formatAssistantResult(operation, result.data);
  expect(reply).toContain("Khách thanh toán lần một");
  expect(reply).toContain("Loại bút toán: Đã thu");
  expect(reply).toContain("Ngày giao dịch");
  expect(reply).toContain("Số dư sau giao dịch");
});

it("lists and opens retail after-sale documents by order/document code without exposing device or customer identifiers", async () => {
  const branchId = "507f1f77bcf86cd799439133";
  const orderId = "507f1f77bcf86cd799439134";
  const afterSaleId = "507f1f77bcf86cd799439135";
  const adminReq = { ...req, user: { id: "actor", companyCode: "TEST", role: "admin" } } as any;
  const document = {
    _id: afterSaleId, branchId, code: "TH-20261030-9135", type: "return", status: "completed", orderId, orderCode: "DH-0134",
    customerName: "Nguyễn Minh An", customerPhone: "0900000134", totalAmount: 250000, paymentMethod: "transfer",
    paymentReference: "private-bank-reference", reason: "Khách trả sản phẩm", businessDate: "2026-10-30", receiptId: "internal-receipt-id",
    createdBy: "internal-actor-id", items: [{ sku: "SKU-13", productName: "Tai nghe mẫu", quantity: 1, unitAmount: 250000, lineAmount: 250000, serialNumbers: ["SERIAL-PRIVATE"], internalBarcodes: ["BARCODE-PRIVATE"] }],
  };
  const fetcher = vi.fn().mockImplementation(async (input: URL) => {
    if (input.pathname === "/api/v1/auth/branches") return new Response(JSON.stringify({ success: true, data: [{ _id: branchId, name: "Chi nhánh Hà Nội", companyCode: "TEST" }] }), { status: 200 });
    if (input.pathname === "/api/v1/retail/orders") return new Response(JSON.stringify({ success: true, data: [{ _id: orderId, branchId, orderCode: "DH-0134", customerName: "Nguyễn Minh An", grandTotal: 250000 }] }), { status: 200 });
    if (input.pathname === "/api/v1/retail/after-sales") return new Response(JSON.stringify({ success: true, data: { items: [document], total: 1, page: 1, limit: 20 } }), { status: 200 });
    if (input.pathname === `/api/v1/retail/after-sales/${afterSaleId}`) return new Response(JSON.stringify({ success: true, data: document }), { status: 200 });
    return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);

  const list = ASSISTANT_OPERATIONS.find(item => item.id === "retail.after-sale.list")!;
  const resolution = await resolveReferences(adminReq, list, { targetBranch: "Chi nhánh Hà Nội", query_type: "return", query_orderId: "DH-0134" } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values).toMatchObject({ targetBranch: branchId, query_type: "return", query_orderId: orderId });
  const listed = await callOperation(adminReq, list, resolution.values as any);
  const listCall = fetcher.mock.calls.find(([url]) => (url as URL).pathname === "/api/v1/retail/after-sales")!;
  expect((listCall[0] as URL).searchParams.get("branchId")).toBe(branchId);
  expect((listCall[0] as URL).searchParams.get("orderId")).toBe(orderId);
  expect(listed.data.items[0]).toMatchObject({ code: "TH-20261030-9135", type: "return", orderCode: "DH-0134", itemsSummary: "1 × Tai nghe mẫu (SKU-13)" });
  const listReply = formatAssistantResult(list, listed.data);
  expect(listReply).toContain("Trả hàng");
  expect(listReply).toContain("Chuyển khoản");
  expect(listReply).toContain("Tai nghe mẫu");
  expect(listReply).not.toMatch(/507f1f77bcf86cd799439135|0900000134|SERIAL-PRIVATE|BARCODE-PRIVATE|private-bank-reference|internal-receipt-id|internal-actor-id/);

  const detail = ASSISTANT_OPERATIONS.find(item => item.id === "retail.after-sale.detail")!;
  const detailResolution = await resolveReferences(adminReq, detail, { targetBranch: "Chi nhánh Hà Nội", path_id: "TH-20261030-9135" } as any);
  expect(detailResolution.errors).toEqual([]);
  expect(detailResolution.values).toMatchObject({ targetBranch: branchId, path_id: afterSaleId });
  const viewed = await callOperation(adminReq, detail, detailResolution.values as any);
  const detailCall = fetcher.mock.calls.find(([url]) => (url as URL).pathname === `/api/v1/retail/after-sales/${afterSaleId}`)!;
  expect((detailCall[0] as URL).searchParams.get("branchId")).toBe(branchId);
  const detailReply = formatAssistantResult(detail, viewed.data);
  expect(detailReply).toContain("Tai nghe mẫu");
  expect(detailReply).toContain("Loại chứng từ: Trả hàng");
  expect(detailReply).not.toMatch(/507f1f77bcf86cd799439135|0900000134|SERIAL-PRIVATE|BARCODE-PRIVATE|private-bank-reference|internal-receipt-id|internal-actor-id/);
});

it("prepares a retail return by order and product names, pins the order version and cash session, and sanitizes the created document", async () => {
  const branchId = "507f1f77bcf86cd799439141";
  const orderId = "507f1f77bcf86cd799439142";
  const variantId = "507f1f77bcf86cd799439143";
  const shiftId = "507f1f77bcf86cd799439144";
  const adminReq = { ...req, user: { id: "actor", companyCode: "TEST", role: "admin" } } as any;
  const order = {
    _id: orderId, branchId, orderCode: "DH-0141", customerName: "Nguyễn Minh An", customerPhone: "0900000141",
    status: "completed", paymentStatus: "paid", version: 7, subtotal: 250000, grandTotal: 250000, shippingFee: 0,
    afterSales: [], items: [{ sku: "SKU-14", productName: "Tai nghe mẫu", quantity: 1, lineTotal: 250000, trackingMode: "none" }],
  };
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/auth/branches") return new Response(JSON.stringify({ success: true, data: [{ _id: branchId, name: "Chi nhánh Hà Nội", code: "HN", companyCode: "TEST" }] }), { status: 200 });
    if (input.pathname === "/api/v1/retail/orders" && init?.method !== "POST") return new Response(JSON.stringify({ success: true, data: { items: [{ _id: orderId, branchId, orderCode: "DH-0141", customerName: "Nguyễn Minh An", status: "completed", paymentStatus: "paid" }], total: 1 } }), { status: 200 });
    if (input.pathname === "/api/v1/retail/orders/products") return new Response(JSON.stringify({ success: true, data: { items: [{ _id: variantId, branchId, name: "Tai nghe mẫu", sku: "SKU-14", variantName: "Màu đen", trackingMode: "none" }], total: 1 } }), { status: 200 });
    if (input.pathname === `/api/v1/retail/orders/${orderId}`) return new Response(JSON.stringify({ success: true, data: order }), { status: 200 });
    if (input.pathname === "/api/v1/retail/shifts/current") return new Response(JSON.stringify({ success: true, data: { _id: shiftId, branchId, shiftCode: "CA-141", cashierName: "Đỗ Đức Chung", status: "open" } }), { status: 200 });
    if (input.pathname === "/api/v1/retail/after-sales" && init?.method === "POST") return new Response(JSON.stringify({ success: true, data: {
      _id: "507f1f77bcf86cd799439145", code: "TH-20261030-9145", type: "return", status: "completed", orderCode: "DH-0141",
      customerName: "Nguyễn Minh An", customerPhone: "0900000141", totalAmount: 250000, paymentMethod: "cash", reason: "Khách trả sản phẩm",
      businessDate: "2026-10-30", receiptId: "private-receipt", createdBy: "private-actor",
      items: [{ productName: "Tai nghe mẫu", sku: "SKU-14", quantity: 1, serialNumbers: ["SERIAL-PRIVATE"], internalBarcodes: ["BARCODE-PRIVATE"] }],
    } }), { status: 201 });
    return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "retail.after-sale.create")!;
  const resolution = await resolveReferences(adminReq, operation, {
    targetBranch: "Chi nhánh Hà Nội", type: "return", orderId: "DH-0141", reason: "Khách trả sản phẩm", paymentMethod: "cash",
    items: JSON.stringify([{ sku: "Tai nghe mẫu", quantity: 1 }]),
  } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values).toMatchObject({ targetBranch: branchId, orderId, expectedVersion: 7, cashSessionId: shiftId, shiftSelector: shiftId });
  expect(resolution.labels.items).toContain("Tổng tiền hoàn/thu mua: 250.000 ₫");
  expect(resolution.labels.shiftSelector).toContain("CA-141");
  expect(JSON.stringify(resolution.labels)).not.toContain(orderId);

  const result = await callOperation(adminReq, operation, resolution.values as any, undefined, "after-sale-request-141");
  const write = fetcher.mock.calls.find(([url, init]) => (url as URL).pathname === "/api/v1/retail/after-sales" && init?.method === "POST")!;
  const url = write[0] as URL;
  const body = JSON.parse(String(write[1].body));
  expect(url.searchParams.get("branchId")).toBe(branchId);
  expect(body).toMatchObject({ orderId, expectedVersion: 7, cashSessionId: shiftId, paymentMethod: "cash", idempotencyKey: "after-sale-request-141" });
  expect(body.items).toEqual([{ orderLineIndex: 0, quantity: 1, unitAmount: 250000, serialNumbers: [], internalBarcodes: [], condition: "good" }]);
  expect(body).not.toHaveProperty("shiftSelector");
  const reply = formatAssistantResult(operation, result.data);
  expect(reply).toContain("TH-20261030-9145");
  expect(reply).toContain("250.000");
  expect(reply).not.toMatch(/507f1f77bcf86cd799439145|0900000141|SERIAL-PRIVATE|BARCODE-PRIVATE|private-receipt|private-actor/);
});

it("asks for an exact sold serial and buyback price when those fields cannot be inferred", async () => {
  const orderId = "507f1f77bcf86cd799439146";
  const variantId = "507f1f77bcf86cd799439147";
  const trackedOrder = {
    _id: orderId, branchId: req.user.branchId, orderCode: "DH-0142", customerName: "Khách thử", status: "completed", paymentStatus: "paid",
    version: 2, subtotal: 500000, grandTotal: 500000, shippingFee: 0, afterSales: [],
    items: [{ sku: "SKU-15", productName: "Điện thoại mẫu", quantity: 2, lineTotal: 500000, trackingMode: "serial", serialNumbers: ["IMEI-A", "IMEI-B"] }],
  };
  const fetcher = vi.fn().mockImplementation(async (input: URL) => {
    if (input.pathname === "/api/v1/retail/orders") return new Response(JSON.stringify({ success: true, data: { items: [{ _id: orderId, branchId: req.user.branchId, orderCode: "DH-0142", customerName: "Khách thử" }] } }), { status: 200 });
    if (input.pathname === "/api/v1/retail/orders/products") return new Response(JSON.stringify({ success: true, data: { items: [{ _id: variantId, branchId: req.user.branchId, name: "Điện thoại mẫu", sku: "SKU-15" }] } }), { status: 200 });
    if (input.pathname === `/api/v1/retail/orders/${orderId}`) return new Response(JSON.stringify({ success: true, data: trackedOrder }), { status: 200 });
    return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "retail.after-sale.create")!;
  const values = { type: "buyback", orderId: "DH-0142", reason: "Thu mua máy", paymentMethod: "transfer", items: JSON.stringify([{ sku: "Điện thoại mẫu", quantity: 1 }]) };
  const missingSerial = await resolveReferences(req, operation, values as any);
  expect(missingSerial.errors.join("\n")).toContain("cần chọn đúng 1 IMEI/serial");
  const missingPrice = await resolveReferences(req, operation, { ...values, items: JSON.stringify([{ sku: "Điện thoại mẫu", quantity: 1, serialNumbers: ["IMEI-A"] }]) } as any);
  expect(missingPrice.errors.join("\n")).toContain("cần nêu giá thu mua mỗi sản phẩm");
});

it("configures a retail commission policy by collaborator and branch name for a branchless admin", async () => {
  const branchId = "507f1f77bcf86cd799439106";
  const partnerId = "507f1f77bcf86cd799439107";
  const adminReq = { ...req, user: { id: "actor", companyCode: "TEST", role: "admin" } } as any;
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/auth/branches") return new Response(JSON.stringify({ success: true, data: [{ _id: branchId, name: "Chi nhánh Hà Nội", companyCode: "TEST" }] }), { status: 200 });
    if (input.pathname === "/api/v1/retail/partners") return new Response(JSON.stringify({ success: true, data: [{ _id: partnerId, code: "CTV-001", name: "Đỗ Đức Chung", roles: ["collaborator"], status: "active" }] }), { status: 200 });
    if (input.pathname === "/api/v1/retail/finance/commission/policies" && init?.method === "PUT") return new Response(JSON.stringify({ success: true, data: {
      partnerId, kind: "repair", sku: "*", ratePercent: 8, effectiveFrom: "2026-11-01T00:00:00.000Z", active: true,
      companyCode: "TEST", branchId,
    } }), { status: 200 });
    return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "retail.finance.commission.policy.update")!;
  const resolution = await resolveReferences(adminReq, operation, {
    targetBranch: "Chi nhánh Hà Nội", partnerId: "Đỗ Đức Chung", kind: "repair", ratePercent: 8, effectiveFrom: "2026-11-01",
  } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values).toMatchObject({ targetBranch: branchId, partnerId });
  await callOperation(adminReq, operation, resolution.values as any);
  const write = fetcher.mock.calls.find(([url, init]) => (url as URL).pathname.endsWith("/commission/policies") && init?.method === "PUT")!;
  expect((write[0] as URL).searchParams.get("branchId")).toBe(branchId);
  expect(JSON.parse(String(write[1].body))).toMatchObject({ partnerId, kind: "repair", ratePercent: 8, effectiveFrom: "2026-11-01" });
});

it("reviews a pending SePay transaction by its visible payment code and hides bank identifiers", async () => {
  const transactionId = "507f1f77bcf86cd799439121";
  const paymentCode = "PAY-700";
  const source = {
    _id: transactionId, transactionId: "bank-internal-transaction", accountNumber: "9704001234567890",
    paymentCode, orderCode: "DH-700", receivedAmount: 350000, appliedAmount: 0,
    reviewReason: "Không tìm thấy đơn khớp mã thanh toán", status: "pending_review",
  };
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/retail/payment-review" && init?.method !== "POST") {
      return new Response(JSON.stringify({ success: true, data: [source] }), { status: 200 });
    }
    if (input.pathname === `/api/v1/retail/payment-review/${transactionId}/review`) {
      return new Response(JSON.stringify({ success: true, data: { ...source, status: "reviewed", reviewNote: "Đã đối chiếu với chứng từ ngân hàng", reviewedAt: "2026-10-30T04:00:00.000Z" } }), { status: 200 });
    }
    return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "retail.payment-review.review")!;
  const resolution = await resolveReferences(req, operation, { path_id: paymentCode, note: "Đã đối chiếu với chứng từ ngân hàng" } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.path_id).toBe(transactionId);
  expect(resolution.labels.path_id).toContain(paymentCode);
  const reviewed = await callOperation(req, operation, resolution.values as any);
  const writeCall = fetcher.mock.calls.find(([url, init]) => (url as URL).pathname.endsWith("/review") && init?.method === "POST")!;
  expect(JSON.parse(String(writeCall[1].body))).toEqual({ note: "Đã đối chiếu với chứng từ ngân hàng" });
  expect(reviewed.data).toMatchObject({ orderCode: "DH-700", paymentCode, status: "reviewed", reviewNote: "Đã đối chiếu với chứng từ ngân hàng" });
  expect(JSON.stringify(reviewed)).not.toMatch(/bank-internal-transaction|9704001234567890|companyCode|reviewedBy/);
  const reviewReply = formatAssistantResult(operation, reviewed.data);
  expect(reviewReply).toContain(paymentCode);
  expect(reviewReply).not.toContain(transactionId);
  const list = ASSISTANT_OPERATIONS.find(item => item.id === "retail.payment-review.pending")!;
  const pending = await callOperation(req, list, {} as any);
  expect(JSON.stringify(pending)).not.toMatch(/bank-internal-transaction|9704001234567890|_id/);
  expect(pending.data[0]).toMatchObject({ code: paymentCode, orderCode: "DH-700", receivedAmount: 350000 });
  const pendingReply = formatAssistantResult(list, pending.data);
  expect(pendingReply).toContain(paymentCode);
  expect(pendingReply).not.toContain(transactionId);
});

it("resolves bulk SKU selections by product and SKU name, then sends internal IDs only to the API", async () => {
  const productId = "507f1f77bcf86cd799439071";
  const variantId = "507f1f77bcf86cd799439072";
  const fetcher = vi.fn().mockImplementation(async (input: URL) => {
    if (input.pathname === "/api/v1/inventory/catalog/products") return new Response(JSON.stringify({ success: true, data: [{ _id: productId, name: "Laptop văn phòng", productCode: "LT-01", companyCode: "TEST" }] }), { status: 200 });
    if (input.pathname === `/api/v1/inventory/catalog/products/${productId}`) return new Response(JSON.stringify({ success: true, data: { _id: productId, name: "Laptop văn phòng", companyCode: "TEST", variants: [{ _id: variantId, sku: "LT-01-256", displayName: "256 GB", status: "active" }] } }), { status: 200 });
    return new Response(JSON.stringify({ success: true, data: [{ sku: "LT-01-256", status: "inactive" }] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "inventory.variant.bulk.update")!;
  const resolution = await resolveReferences(req, operation, {
    ids: JSON.stringify([{ productId: "Laptop văn phòng", variantId: "LT-01-256" }]),
    changes: JSON.stringify({ status: "inactive" }),
  } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.labels.ids).toContain("Laptop văn phòng");
  expect(resolution.labels.ids).toContain("LT-01-256");
  expect(resolution.labels.ids).not.toContain(productId);
  expect(resolution.values.ids).toContain(variantId);
  await callOperation(req, operation, resolution.values as any);
  const updateCall = fetcher.mock.calls.at(-1)!;
  expect((updateCall[0] as URL).pathname).toBe("/api/v1/inventory/catalog/variants/bulk");
  expect(JSON.parse(updateCall[1].body)).toEqual({ ids: [variantId], changes: { status: "inactive" } });
});

it("resolves and recalculates a labor-partner settlement by its partner name", async () => {
  const settlementId = "507f1f77bcf86cd799439083";
  const partnerId = "507f1f77bcf86cd799439084";
  const settlement = { _id: settlementId, partnerId: { _id: partnerId, code: "LAB-01", name: "Công ty Ánh Dương" }, periodStart: "2026-10-01", periodEnd: "2026-10-31", status: "calculated", totalAmount: 2500000, paidAmount: 0, balanceAmount: 2500000, version: 2 };
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/worker-management/partners/settlements" && init?.method !== "POST") return new Response(JSON.stringify({ success: true, data: [settlement] }), { status: 200 });
    if (input.pathname === `/api/v1/worker-management/partners/settlements/${settlementId}/recalculate`) return new Response(JSON.stringify({ success: true, data: { settlement: { ...settlement, partnerId }, reused: false } }), { status: 200 });
    return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "worker.partner.settlement.recalculate")!;
  const resolution = await resolveReferences(req, operation, { path_settlementId: "Công ty Ánh Dương" } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.path_settlementId).toBe(settlementId);
  expect(resolution.labels.path_settlementId).toContain("Công ty Ánh Dương");

  const result = await callOperation(req, operation, resolution.values as any);
  const write = fetcher.mock.calls.find(([url, init]) => (url as URL).pathname.endsWith(`/settlements/${settlementId}/recalculate`) && init?.method === "POST")!;
  expect(JSON.parse(String(write[1].body))).toEqual({});
  const reply = formatAssistantResult(operation, result.data);
  expect(reply).toContain("2026-10-01");
  expect(reply).toContain("2.500.000");
  expect(reply).not.toContain(settlementId);
});

it("lets a branchless company admin update a commission level by name after selecting its branch", async () => {
  const levelId = "507f1f77bcf86cd799439081";
  const branchId = "507f1f77bcf86cd799439082";
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/auth/branches") return new Response(JSON.stringify({ success: true, data: [{ _id: branchId, name: "Chi nhánh Hà Nội", code: "HN" }] }), { status: 200 });
    if (input.pathname === "/api/v1/partners/commission-levels") return new Response(JSON.stringify({ success: true, data: [{ _id: levelId, name: "Cấp 1", minTuition: 0, commissionRate: 5, branchId }] }), { status: 200 });
    return new Response(JSON.stringify({ success: true, data: { name: "Cấp 1", minTuition: 10000000, commissionRate: 7 } }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const adminRequest = { ...req, user: { id: "actor", companyCode: "TEST", role: "admin" } } as any;
  const operation = ASSISTANT_OPERATIONS.find(item => item.method === "PATCH" && item.path === "/partners/commission-levels/:id")!;
  expect(operation.fields.find(field => field.key === "targetBranch")).toMatchObject({ apiKey: "branchId", reference: "branch.list" });
  const resolution = await resolveReferences(adminRequest, operation, {
    targetBranch: "Chi nhánh Hà Nội", path_id: "Cấp 1", name: "Cấp 1", minTuition: 10000000, commissionRate: 7,
  } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values).toMatchObject({ targetBranch: branchId, path_id: levelId });
  await callOperation(adminRequest, operation, resolution.values as any);
  const updateCall = fetcher.mock.calls.find(([url, init]) => (url as URL).pathname === `/api/v1/partners/commission-levels/${levelId}` && init?.method === "PATCH")!;
  expect((updateCall[0] as URL).searchParams.get("branchId")).toBe(branchId);
  expect(new Headers(updateCall[1].headers).get("x-branch-id")).toBe(branchId);
  expect(JSON.parse(updateCall[1].body)).toMatchObject({ name: "Cấp 1", minTuition: 10000000, commissionRate: 7 });
  expect(JSON.parse(updateCall[1].body)).not.toHaveProperty("targetBranch");
});

it("resolves student installment payments by name from the students list envelope", async () => {
  const studentId = "507f1f77bcf86cd799439061";
  const branchId = req.user.branchId;
  const fetcher = vi.fn().mockImplementation(async (input: URL) => {
    if (input.pathname.endsWith("/auth/branches")) return new Response(JSON.stringify({ success: true, data: [{ _id: branchId, name: "Chi nhánh Hà Nội" }] }), { status: 200 });
    if (input.pathname === "/api/v1/students") return new Response(JSON.stringify({ success: true, students: [{ _id: studentId, fullName: "Đỗ Đức Chung", phone: "0980000000", branchId }], total: 1 }), { status: 200 });
    return new Response(JSON.stringify({ success: true, message: "Đã đánh dấu đợt 2." }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.method === "PATCH" && item.path === "/students/:id/installment/:no/mark-paid")!;
  expect(operation.fields.find(field => field.key === "path_id")).toMatchObject({ label: "Tên, số điện thoại hoặc email học viên", reference: "student.list" });
  const resolution = await resolveReferences(req, operation, { path_id: "Đỗ Đức Chung", path_no: "2" } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.path_id).toBe(studentId);
  expect(resolution.values.path_no).toBe("2");
  expect(resolution.labels.path_id).toContain("Đỗ Đức Chung");
  await callOperation(req, operation, resolution.values as any);
  const updateCall = fetcher.mock.calls.find(([url, init]) => (url as URL).pathname.includes("/installment/2/mark-paid") && init?.method === "PATCH");
  expect((updateCall?.[0] as URL).pathname).toBe(`/api/v1/students/${studentId}/installment/2/mark-paid`);
});

it("resolves a payment student by name and fills the display name from the selected student", async () => {
  const studentId = "507f1f77bcf86cd799439062";
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/students" && init?.method !== "POST") return new Response(JSON.stringify({ success: true, students: [
      { _id: studentId, fullName: "Đỗ Đức Chung", phone: "0980000000", branchId: req.user.branchId },
    ] }), { status: 200 });
    if (input.pathname === "/api/v1/payments" && init?.method === "POST") return new Response(JSON.stringify({ success: true, data: { _id: "payment-id" } }), { status: 201 });
    throw new Error(`Unexpected request: ${input.pathname}`);
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.method === "POST" && item.path === "/payments")!;
  const resolution = await resolveReferences(req, operation, { studentId: "Đỗ Đức Chung", amount: 1500000, method: "Tiền mặt", date: "2026-11-01" } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values).toMatchObject({ studentId, studentName: "Đỗ Đức Chung" });
  expect(JSON.stringify(resolution.labels)).not.toContain(studentId);
  await callOperation(req, operation, resolution.values as any);
  const createCall = fetcher.mock.calls.find(([input, init]) => (input as URL).pathname === "/api/v1/payments" && init?.method === "POST")!;
  expect(JSON.parse(createCall[1].body)).toMatchObject({ studentId, studentName: "Đỗ Đức Chung", amount: 1500000 });
});

it("selects the student and assignment from the chosen class before updating a grade", async () => {
  const batchId = "507f1f77bcf86cd799439081";
  const studentId = "507f1f77bcf86cd799439082";
  const assignmentId = "507f1f77bcf86cd799439083";
  const fetcher = vi.fn().mockImplementation(async (input: URL) => {
    if (input.pathname === "/api/v1/batches") return new Response(JSON.stringify({ success: true, batches: [{ _id: batchId, code: "ENG-01", name: "Lớp tiếng Anh A", status: "Đang học" }] }), { status: 200 });
    if (input.pathname === `/api/v1/batches/${batchId}/attendance/learners`) return new Response(JSON.stringify({ success: true, data: [{ id: studentId, name: "Nguyễn Văn An", phone: "0901234567" }] }), { status: 200 });
    if (input.pathname === "/api/v1/assignments") return new Response(JSON.stringify({ success: true, data: [{ _id: assignmentId, title: "Bài tập tuần 1", batchId }] }), { status: 200 });
    throw new Error(`Unexpected request: ${input.pathname}`);
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.method === "PATCH" && item.path === "/student-quality/batches/:batchId/students/:studentId/assignments/:assignmentId")!;
  const resolution = await resolveReferences(req, operation, {
    path_batchId: "Lớp tiếng Anh A", path_studentId: "Nguyễn Văn An", path_assignmentId: "Bài tập tuần 1", score: 9, feedback: "Tốt",
  } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values).toMatchObject({ path_batchId: batchId, path_studentId: studentId, path_assignmentId: assignmentId });
  expect(JSON.stringify(resolution.labels)).not.toMatch(/507f1f77/);
  const assignmentLookup = fetcher.mock.calls.find(([input]) => (input as URL).pathname === "/api/v1/assignments")![0] as URL;
  expect(assignmentLookup.searchParams.get("batchId")).toBe(batchId);
});

it("resolves direct assignment grading by class, assignment, and enrolled student names", async () => {
  const batchId = "507f1f77bcf86cd799439091";
  const studentId = "507f1f77bcf86cd799439092";
  const assignmentId = "507f1f77bcf86cd799439093";
  const fetcher = vi.fn().mockImplementation(async (input: URL) => {
    if (input.pathname === "/api/v1/batches") return new Response(JSON.stringify({ success: true, batches: [
      { _id: batchId, code: "ENG-02", name: "Lớp tiếng Anh B", status: "Đang học" },
    ] }), { status: 200 });
    if (input.pathname === "/api/v1/assignments" && input.searchParams.get("batchId") === batchId) return new Response(JSON.stringify({ success: true, data: [
      { _id: assignmentId, title: "Bài tập tuần 2", batchId },
    ] }), { status: 200 });
    if (input.pathname === `/api/v1/batches/${batchId}/attendance/learners`) return new Response(JSON.stringify({ success: true, data: [
      { id: studentId, name: "Nguyễn Văn An", phone: "0901234567" },
    ] }), { status: 200 });
    throw new Error(`Unexpected request: ${input.pathname}`);
  });
  vi.stubGlobal("fetch", fetcher);

  const operation = ASSISTANT_OPERATIONS.find(item => item.method === "POST" && item.path === "/assignments/:id/students/:studentId/grade")!;
  const resolution = await resolveReferences(req, operation, {
    query_batchId: "Lớp tiếng Anh B",
    path_id: "Bài tập tuần 2",
    path_studentId: "Nguyễn Văn An",
    score: 9,
  } as any);

  expect(resolution.errors).toEqual([]);
  expect(resolution.values).toMatchObject({ query_batchId: batchId, path_id: assignmentId, path_studentId: studentId });
  expect(JSON.stringify(resolution.labels)).not.toMatch(/507f1f77/);
  expect(fetcher.mock.calls.some(([input]) => (input as URL).pathname === `/api/v1/batches/${batchId}/attendance/learners`)).toBe(true);
});

it("updates an SKU price by the selected product's visible SKU, even without an existing price record", async () => {
  const productId = "507f1f77bcf86cd799439093";
  const variantId = "507f1f77bcf86cd799439094";
  const fetcher = vi.fn().mockImplementation(async (input: URL) => {
    if (input.pathname === "/api/v1/inventory/catalog/products") return new Response(JSON.stringify({ success: true, data: { items: [
      { _id: productId, name: "Cốc sứ tai mèo" },
    ] } }), { status: 200 });
    if (input.pathname === `/api/v1/inventory/catalog/products/${productId}`) return new Response(JSON.stringify({ success: true, data: {
      _id: productId,
      name: "Cốc sứ tai mèo",
      variants: [{ _id: variantId, sku: "SKU-001", displayName: "Màu trắng", status: "active" }],
    } }), { status: 200 });
    throw new Error(`Unexpected request: ${input.pathname}`);
  });
  vi.stubGlobal("fetch", fetcher);

  const operation = ASSISTANT_OPERATIONS.find(item => item.method === "PUT" && item.path === "/inventory/catalog/prices/:variantId")!;
  const resolution = await resolveReferences(req, operation, {
    query_productId: "Cốc sứ tai mèo",
    path_variantId: "Màu trắng — mã SKU-001",
    sellingPrice: 50000,
    costPrice: 10000,
  } as any);

  expect(resolution.errors).toEqual([]);
  expect(resolution.values.path_variantId).toBe(variantId);
  expect(resolution.values.query_productId).toBe(productId);
  expect(JSON.stringify(resolution.labels)).not.toContain(productId);
  expect(JSON.stringify(resolution.labels)).not.toContain(variantId);
  expect(fetcher.mock.calls.some(([input]) => (input as URL).pathname === `/api/v1/inventory/catalog/products/${productId}`)).toBe(true);
});

it("creates a student profile and resolves updates by student, course, and partner names", async () => {
  const studentId = "507f1f77bcf86cd799439071";
  const courseId = "507f1f77bcf86cd799439072";
  const partnerId = "507f1f77bcf86cd799439073";
  const batchId = "507f1f77bcf86cd799439074";
  const branchId = "507f1f77bcf86cd799439075";
  const fetcher = vi.fn().mockImplementation(async (input: URL) => {
    if (input.pathname === "/api/v1/students") return new Response(JSON.stringify({ success: true, students: [{ _id: studentId, fullName: "Đỗ Đức Chung", phone: "0980000000", email: "chung@example.test" }] }), { status: 200 });
    if (input.pathname === "/api/v1/students/unassigned") return new Response(JSON.stringify({ success: true, students: [{ _id: studentId, fullName: "Đỗ Đức Chung", phone: "0980000000" }] }), { status: 200 });
    if (input.pathname === "/api/v1/courses") return new Response(JSON.stringify({ success: true, courses: [{ _id: courseId, title: "Khóa B2", code: "B2" }] }), { status: 200 });
    if (input.pathname === "/api/v1/partners") return new Response(JSON.stringify({ success: true, partners: [{ _id: partnerId, name: "Nguyễn Hoàng Minh Phương", phone: "0985645175" }] }), { status: 200 });
    if (input.pathname === "/api/v1/batches") return new Response(JSON.stringify({ success: true, batches: [{ _id: batchId, code: "B2-2026-01", courseTitle: "Khóa B2", status: "active" }] }), { status: 200 });
    if (input.pathname === `/api/v1/batches/${batchId}/attendance/learners`) return new Response(JSON.stringify({ success: true, data: [{ id: studentId, name: "Đỗ Đức Chung", phone: "0980000000" }] }), { status: 200 });
    if (input.pathname === "/api/v1/auth/branches") return new Response(JSON.stringify({ success: true, data: [{ _id: branchId, name: "Chi nhánh Hà Nội", code: "HN" }] }), { status: 200 });
    return new Response(JSON.stringify({ success: true, data: { _id: studentId, fullName: "Đỗ Đức Chung", phone: "0980000000", status: "Đang học" } }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);

  const create = ASSISTANT_OPERATIONS.find(item => item.method === "POST" && item.path === "/students")!;
  const createValues = Object.fromEntries(create.fields.map(field => [field.key, sampleValue(field)]));
  await callOperation(req, create, createValues as any);
  const createBody = JSON.parse(fetcher.mock.calls.find(([url, init]) => (url as URL).pathname === "/api/v1/students" && init?.method === "POST")![1].body);
  expect(createBody).toMatchObject({ fullName: "test", phone: "test", email: "qa@example.test", registrationDate: "2026-10-01" });

  const update = ASSISTANT_OPERATIONS.find(item => item.method === "PATCH" && item.path === "/students/:id")!;
  const resolution = await resolveReferences(req, update, {
    path_id: "Đỗ Đức Chung", fullName: "Đỗ Đức Chung mới", courseId: "Khóa B2", partnerId: "Nguyễn Hoàng Minh Phương",
  } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values).toMatchObject({ path_id: studentId, courseId, partnerId });
  expect(resolution.labels.path_id).toContain("Đỗ Đức Chung");
  expect(JSON.stringify(resolution.labels)).not.toContain(studentId);
  await callOperation(req, update, resolution.values as any);
  const updateCall = fetcher.mock.calls.find(([url, init]) => (url as URL).pathname === `/api/v1/students/${studentId}` && init?.method === "PATCH")!;
  expect(JSON.parse(updateCall[1].body)).toMatchObject({ fullName: "Đỗ Đức Chung mới", courseId, partnerId });
  expect(updateCall[1].body).not.toContain("expectedVersion");

  const miniTest = ASSISTANT_OPERATIONS.find(item => item.method === "POST" && item.path === "/student-quality/batches/:batchId/students/:studentId/mini-tests")!;
  const miniTestResolution = await resolveReferences(req, miniTest, {
    path_batchId: "B2-2026-01", path_studentId: "Đỗ Đức Chung", title: "Kiểm tra buổi 1", date: "2026-10-01", score: 8, maxScore: 10,
  } as any);
  expect(miniTestResolution.errors).toEqual([]);
  expect(miniTestResolution.values).toMatchObject({ path_batchId: batchId, path_studentId: studentId });
  await callOperation(req, miniTest, miniTestResolution.values as any);
  const miniTestCall = fetcher.mock.calls.find(([url, init]) => (url as URL).pathname === `/api/v1/student-quality/batches/${batchId}/students/${studentId}/mini-tests` && init?.method === "POST")!;
  expect(JSON.parse(miniTestCall[1].body)).toMatchObject({ title: "Kiểm tra buổi 1", date: "2026-10-01", score: 8, maxScore: 10 });
  const callsBeforeInvalidScore = fetcher.mock.calls.length;
  await expect(callOperation(req, miniTest, { ...miniTestResolution.values, score: 11 } as any)).rejects.toThrow("Điểm không được lớn hơn thang điểm");
  expect(fetcher).toHaveBeenCalledTimes(callsBeforeInvalidScore);

  const assignBranch = ASSISTANT_OPERATIONS.find(item => item.method === "PATCH" && item.path === "/students/:id/assign-branch")!;
  const branchResolution = await resolveReferences(req, assignBranch, { path_id: "Đỗ Đức Chung", targetBranch: "Chi nhánh Hà Nội" } as any);
  expect(branchResolution.errors).toEqual([]);
  expect(branchResolution.values).toMatchObject({ path_id: studentId, targetBranch: branchId });
  expect(JSON.stringify(branchResolution.labels)).not.toContain(branchId);
  await callOperation(req, assignBranch, branchResolution.values as any);
  const assignCall = fetcher.mock.calls.find(([url, init]) => (url as URL).pathname === `/api/v1/students/${studentId}/assign-branch` && init?.method === "PATCH")!;
  expect(JSON.parse(assignCall[1].body)).toMatchObject({ branchId });
});

it("opens student profiles and learning history by name with duplicate-name choices and safe projections", async () => {
  const studentId = "507f1f77bcf86cd799439078";
  const duplicateStudentId = "507f1f77bcf86cd799439079";
  const listRows = [
    { _id: studentId, fullName: "Đỗ Đức Chung", phone: "0900000001", email: "chung1@example.test", status: "Đang học", companyCode: "TEST", branchId: req.user.branchId },
    { _id: duplicateStudentId, fullName: "Đỗ Đức Chung", phone: "0900000002", email: "chung2@example.test", status: "Đang học", companyCode: "TEST", branchId: req.user.branchId },
  ];
  const fetcher = vi.fn().mockImplementation(async (input: URL) => {
    if (input.pathname === "/api/v1/students") return new Response(JSON.stringify({ success: true, data: listRows }), { status: 200 });
    if (input.pathname === `/api/v1/students/${studentId}`) return new Response(JSON.stringify({ success: true, data: {
      _id: studentId, companyCode: "TEST", branchId: req.user.branchId, fullName: "Đỗ Đức Chung", phone: "0900000001",
      email: "chung1@example.test", rank: "A", registrationDate: "2026-01-02", enrollmentDate: "2026-01-03", fee: "12000000", status: "Đang học",
      idCard: "PRIVATE-ID-CARD", address: "PRIVATE-ADDRESS", healthCheckNotes: "PRIVATE-HEALTH-NOTE", paymentHistory: [{ note: "PRIVATE-PAYMENT" }],
    } }), { status: 200 });
    if (input.pathname === `/api/v1/students/${studentId}/learning-history`) return new Response(JSON.stringify({ success: true, data: {
      studentId, summary: { totalClasses: 2, totalCourses: 1, totalAttendedSessions: 8, totalMiniTests: 2, totalExams: 1 },
      entries: [{ courseTitle: "Tiếng Anh", attendance: { attended: 8, total: 10 }, assignments: { completed: 3, total: 4 }, teacherAssessment: "PRIVATE-ASSESSMENT", assignmentsFeedback: "PRIVATE-FEEDBACK" }],
      completedCourses: [{ title: "Toán tư duy", code: "PRIVATE-COURSE-CODE" }], unassignedExams: [{ id: "PRIVATE-EXAM-ID", question: "PRIVATE-EXAM" }],
    } }), { status: 200 });
    throw new Error(`Unexpected request: ${input.pathname}`);
  });
  vi.stubGlobal("fetch", fetcher);

  const detail = ASSISTANT_OPERATIONS.find(item => item.id === "student.detail")!;
  const history = ASSISTANT_OPERATIONS.find(item => item.id === "student.learning-history")!;
  expect(detail.fields.find(field => field.key === "path_id")).toMatchObject({ reference: "student.list", label: "Tên, số điện thoại hoặc email học viên" });
  expect(history.fields.find(field => field.key === "path_id")).toMatchObject({ reference: "student.list", label: "Tên hoặc số điện thoại học viên" });

  const choices = await suggestReferenceOptions(req, detail, detail.fields.find(field => field.key === "path_id")!, {} as any);
  expect(choices).toHaveLength(2);
  expect(choices[0]).toContain("Đỗ Đức Chung — 0900000001");
  expect(choices[1]).toContain("Đỗ Đức Chung — 0900000002");
  const resolution = await resolveReferences(req, detail, { path_id: choices[0] } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.path_id).toBe(studentId);
  const profile = await callOperation(req, detail, resolution.values as any);
  expect(profile.data).toMatchObject({ fullName: "Đỗ Đức Chung", phone: "0900000001", email: "chung1@example.test", status: "Đang học" });
  expect(formatAssistantResult(detail, profile.data)).toContain("Điện thoại: 0900000001");
  expect(JSON.stringify(profile)).not.toMatch(/507f1f77|PRIVATE|companyCode|branchId/);

  const historyResolution = await resolveReferences(req, history, { path_id: choices[0] } as any);
  expect(historyResolution.errors).toEqual([]);
  expect(historyResolution.values.path_id).toBe(studentId);
  const learningHistory = await callOperation(req, history, historyResolution.values as any);
  expect(learningHistory.data).toMatchObject({
    totalClasses: 2, totalCourses: 1, totalAttendedSessions: 8, completedAssignments: 3, totalAssignments: 4,
    attendanceRate: 80, courseNames: ["Tiếng Anh", "Toán tư duy"],
  });
  expect(JSON.stringify(learningHistory)).not.toMatch(/507f1f77|PRIVATE|teacherAssessment|feedback|unassignedExams/);
  expect(formatAssistantResult(history, learningHistory.data)).toContain("80%");
});

it("resolves fixed assets by name and converts user dates to the API's strict UTC format", async () => {
  const assetId = "507f1f77bcf86cd799439076";
  const fetcher = vi.fn().mockImplementation(async (input: URL) => {
    if (input.pathname === "/api/v1/finance/assets") return new Response(JSON.stringify({ success: true, data: [{ _id: assetId, assetCode: "TS-001", barcode: "BC-001", name: "Laptop kế toán", branchId: req.user.branchId }] }), { status: 200 });
    if (input.pathname === "/api/v1/auth/branches") return new Response(JSON.stringify({ success: true, data: [{ _id: req.user.branchId, name: "Chi nhánh Hà Nội" }] }), { status: 200 });
    return new Response(JSON.stringify({ success: true, data: { _id: assetId, assetCode: "TS-001", name: "Laptop kế toán" } }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);

  const update = ASSISTANT_OPERATIONS.find(item => item.method === "PATCH" && item.path === "/finance/assets/:id")!;
  const resolution = await resolveReferences(req, update, { path_id: "Laptop kế toán", location: "Phòng kế toán" } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.path_id).toBe(assetId);
  expect(JSON.stringify(resolution.labels)).not.toContain(assetId);
  await callOperation(req, update, resolution.values as any);
  const updateCall = fetcher.mock.calls.find(([url, init]) => (url as URL).pathname === `/api/v1/finance/assets/${assetId}` && init?.method === "PATCH")!;
  expect(JSON.parse(updateCall[1].body)).toEqual({ location: "Phòng kế toán" });

  const create = ASSISTANT_OPERATIONS.find(item => item.method === "POST" && item.path === "/finance/assets")!;
  const values = Object.fromEntries(create.fields.map(field => [field.key, sampleValue(field)]));
  await callOperation(req, create, values as any);
  const createCall = fetcher.mock.calls.find(([url, init]) => (url as URL).pathname === "/api/v1/finance/assets" && init?.method === "POST")!;
  expect(JSON.parse(createCall[1].body)).toMatchObject({ purchaseDate: "2026-10-01T00:00:00.000Z", inServiceDate: "2026-10-01T00:00:00.000Z", salvageValue: 0 });
});

it("configures retail product commission by product or variant name and validates the rule before writing", async () => {
  const fetcher = vi.fn().mockImplementation(async (input: URL) => {
    if (input.pathname === "/api/v1/retail/partners/policy-products") return new Response(JSON.stringify({ success: true, data: [{ _id: "507f1f77bcf86cd799439081", sku: "PHONE-256", name: "Điện thoại mẫu", variantName: "256 GB" }] }), { status: 200 });
    return new Response(JSON.stringify({ success: true, data: { updated: 1 } }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.method === "PUT" && item.path === "/retail/partners/product-commissions")!;
  expect(operation.id).toBe("retail.partner.product.commissions.update");
  expect(defaultWorkflow(operation).confirmationLocked).toBe(true);
  const resolution = await resolveReferences(req, operation, {
    skus: JSON.stringify(["256 GB"]), rule: JSON.stringify({ kind: "phone", amount: 200_000 }),
  } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.skus).toBe(JSON.stringify(["PHONE-256"]));
  expect(JSON.stringify(resolution.labels)).not.toContain("507f1f77bcf86cd799439081");
  await callOperation(req, operation, resolution.values as any);
  const writeCall = fetcher.mock.calls.find(([url, init]) => (url as URL).pathname === "/api/v1/retail/partners/product-commissions" && init?.method === "PUT")!;
  expect(JSON.parse(writeCall[1].body)).toEqual({ skus: ["PHONE-256"], rule: { kind: "phone", amount: 200_000 } });

  const beforeInvalid = fetcher.mock.calls.length;
  await expect(callOperation(req, operation, { skus: JSON.stringify(["PHONE-256"]), rule: JSON.stringify({ kind: "accessory", amount: 10 }) } as any)).rejects.toThrow("không nhập mức tiền điện thoại");
  expect(fetcher).toHaveBeenCalledTimes(beforeInvalid);
  await expect(callOperation(req, operation, { skus: JSON.stringify(Array.from({ length: 101 }, () => "PHONE-256")), rule: JSON.stringify({ kind: "phone", amount: 10 }) } as any)).rejects.toThrow("1 đến 100");
});

it("creates retail partners with one API role and updates them by name while preserving omitted fields", async () => {
  const partnerId = "507f1f77bcf86cd799439099";
  const partner = { _id: partnerId, code: "DL-001", name: "Đại lý Phương", roles: ["dealer"], phone: "0900000001", email: "phuong@example.test", address: "Hà Nội", status: "active" };
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/retail/partners" && init?.method !== "POST") return new Response(JSON.stringify({ success: true, data: [partner] }), { status: 200 });
    if (input.pathname === "/api/v1/retail/partners" && init?.method === "POST") return new Response(JSON.stringify({ success: true, data: { ...partner, roles: ["collaborator"] } }), { status: 201 });
    return new Response(JSON.stringify({ success: true, data: partner }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);

  const update = ASSISTANT_OPERATIONS.find(item => item.id === "retail.partner.update")!;
  const resolution = await resolveReferences(req, update, { path_id: "Đại lý Phương", phone: "0900000002" } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.path_id).toBe(partnerId);
  await callOperation(req, update, resolution.values as any);
  const updateCall = fetcher.mock.calls.find(([url, init]) => (url as URL).pathname === `/api/v1/retail/partners/${partnerId}` && init?.method === "PATCH")!;
  expect(JSON.parse(updateCall[1].body)).toEqual({ code: "DL-001", name: "Đại lý Phương", phone: "0900000002", email: "phuong@example.test", address: "Hà Nội", status: "active", roles: ["dealer"] });

  const create = ASSISTANT_OPERATIONS.find(item => item.id === "retail.partner.create.collaborator")!;
  await callOperation(req, create, { code: "CTV-002", name: "Cộng tác viên mới", status: "active" } as any);
  const createCall = fetcher.mock.calls.find(([url, init]) => (url as URL).pathname === "/api/v1/retail/partners" && init?.method === "POST")!;
  expect(JSON.parse(createCall[1].body)).toEqual({ code: "CTV-002", name: "Cộng tác viên mới", status: "active", roles: ["collaborator"] });
});

it("requires a named branch for retail settings and binds it to the API request", async () => {
  const branchId = "507f1f77bcf86cd7994390a5";
  const adminReq = { ...req, user: { ...req.user, role: "admin", branchId: "" } } as any;
  const fetcher = vi.fn().mockImplementation(async (input: URL) => {
    if (input.pathname === "/api/v1/auth/branches") return new Response(JSON.stringify({ success: true, data: [{ _id: branchId, name: "Chi nhánh Đà Nẵng" }] }), { status: 200 });
    return new Response(JSON.stringify({ success: true, data: { defaultTaxRate: 8 } }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.method === "PUT" && item.path === "/retail/settings")!;
  const resolution = await resolveReferences(adminReq, operation, { targetBranch: "Chi nhánh Đà Nẵng", defaultTaxRate: 8 } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.targetBranch).toBe(branchId);
  await callOperation(adminReq, operation, resolution.values as any);
  const writeCall = fetcher.mock.calls.find(([url, init]) => (url as URL).pathname === "/api/v1/retail/settings" && init?.method === "PUT")!;
  expect((writeCall[0] as URL).searchParams.get("branchId")).toBe(branchId);
  expect(writeCall[1].headers).toMatchObject({ "x-branch-id": branchId });
  expect(JSON.parse(writeCall[1].body)).toEqual({ defaultTaxRate: 8 });
});

it("updates only requested retail points settings and reads the current version from the server", async () => {
  const current = { enabled: true, earnVndPerPoint: 12000, redeemVndPerPoint: 800, maxRedeemPercent: 40, version: 7 };
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/retail/points/policy" && init?.method !== "PUT") return new Response(JSON.stringify({ success: true, data: current }), { status: 200 });
    return new Response(JSON.stringify({ success: true, data: { ...current, maxRedeemPercent: 60, version: 8 } }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "retail.points.policy.update")!;
  const resolution = await resolveReferences(req, operation, { maxRedeemPercent: 60 } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values).toMatchObject({ enabled: true, earnVndPerPoint: 12000, redeemVndPerPoint: 800, maxRedeemPercent: 60, version: 7 });
  await callOperation(req, operation, resolution.values as any);
  const writeCall = fetcher.mock.calls.find(([url, init]) => (url as URL).pathname === "/api/v1/retail/points/policy" && init?.method === "PUT")!;
  expect(JSON.parse(writeCall[1].body)).toEqual({ enabled: true, earnVndPerPoint: 12000, redeemVndPerPoint: 800, maxRedeemPercent: 60, version: 7 });

  const noChange = await resolveReferences(req, operation, {} as any);
  expect(noChange.errors.join(" ")).toContain("Nêu ít nhất một trường");
});

it("creates a billing profile for a customer selected by name and formats only its business fields", async () => {
  const customerId = "507f1f77bcf86cd799439025";
  const profileId = "507f1f77bcf86cd799439026";
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/customers" && init?.method !== "POST") return new Response(JSON.stringify({ success: true, data: [{ _id: customerId, name: "Khách hàng An", phone: "0900000000" }] }), { status: 200 });
    return new Response(JSON.stringify({ success: true, data: { profile: { _id: profileId, legalName: "Công ty Ánh Dương", taxId: "0312345678", address: "1 Nguyễn Huệ", invoiceEmail: "invoice@anhduong.vn", isDefault: true }, warnings: [] } }), { status: 201 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "customer.billing.profile.create")!;
  const resolution = await resolveReferences(req, operation, {
    path_id: "Khách hàng An", legalName: "Công ty Ánh Dương", taxId: "0312345678", address: "1 Nguyễn Huệ", invoiceEmail: "invoice@anhduong.vn", isDefault: true,
  } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.path_id).toBe(customerId);
  const result = await callOperation(req, operation, resolution.values as any);
  expect(result.data).toMatchObject({ legalName: "Công ty Ánh Dương", taxId: "0312345678", isDefault: true, warnings: [] });
  const writeCall = fetcher.mock.calls.find(([url, init]) => (url as URL).pathname === `/api/v1/customers/${customerId}/billing-profiles` && init?.method === "POST")!;
  expect(JSON.parse(writeCall[1].body)).toEqual({ legalName: "Công ty Ánh Dương", taxId: "0312345678", address: "1 Nguyễn Huệ", invoiceEmail: "invoice@anhduong.vn", isDefault: true });
});

it("quotes a retail checkout and resolves its open POS session before confirmation", async () => {
  const variantId = "507f1f77bcf86cd799439021";
  const shiftId = "507f1f77bcf86cd799439022";
  const customerId = "507f1f77bcf86cd799439023";
  const billingProfileId = "507f1f77bcf86cd799439024";
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/customers") return new Response(JSON.stringify({ success: true, data: [{ _id: customerId, name: "Khách hàng An", phone: "0900000000" }] }), { status: 200 });
    if (input.pathname === `/api/v1/customers/${customerId}/billing-profiles`) return new Response(JSON.stringify({ success: true, data: [{ _id: billingProfileId, legalName: "Công ty Ánh Dương", taxId: "0312345678", address: "1 Nguyễn Huệ", invoiceEmail: "invoice@anhduong.vn", isDefault: true, status: "active" }] }), { status: 200 });
    if (input.pathname === "/api/v1/retail/orders/products") return new Response(JSON.stringify({ success: true, data: { items: [{ _id: variantId, name: "Áo xanh - M", sku: "AO-XANH-M", price: 125000, stock: 4, trackingMode: "none" }] } }), { status: 200 });
    if (input.pathname === "/api/v1/retail/orders/quote") return new Response(JSON.stringify({ success: true, data: { grandTotal: 125000 } }), { status: 200 });
    if (input.pathname === "/api/v1/retail/shifts/current") return new Response(JSON.stringify({ success: true, data: { _id: shiftId, shiftCode: "POS-012", status: "open", terminalId: "terminal-main" } }), { status: 200 });
    return new Response(JSON.stringify({ success: true, data: { order: { orderCode: "BH-001", status: "completed", grandTotal: 125000 } } }), { status: 201 });
  });
  vi.stubGlobal("fetch", fetcher);
  const checkout = ASSISTANT_OPERATIONS.find(item => item.id === "retail.order.checkout")!;
  const resolution = await resolveReferences(req, checkout, {
    input: JSON.stringify({ items: [{ productId: "Áo xanh - M", quantity: 1 }], customerId: "Khách hàng An", billingProfileId: "Công ty Ánh Dương" }),
    payments: JSON.stringify([{ method: "cash", amount: 125000, tenderedAmount: 130000 }]),
  } as any);
  expect(resolution.errors).toEqual([]);
  expect(JSON.parse(String(resolution.values.input)).items[0].productId).toBe(variantId);
  expect(JSON.parse(String(resolution.values.input))).toMatchObject({ customerId, billingProfileId });
  expect(resolution.values).toMatchObject({ posSessionId: shiftId, terminalId: "terminal-main", expectedGrandTotal: 125000, targetBranch: req.user.branchId });
  expect(resolution.labels.expectedGrandTotal).toBe("125.000 ₫");

  const result = await callOperation(req, checkout, resolution.values as any, undefined, "assistant-request-1");
  expect(result.data).toMatchObject({ orderCode: "BH-001", status: "completed", grandTotal: 125000 });
  const writeCall = fetcher.mock.calls.find(([url, init]) => (url as URL).pathname === "/api/v1/retail/orders/checkout" && init?.method === "POST")!;
  expect(JSON.parse(writeCall[1].body)).toMatchObject({
    idempotencyKey: "assistant-request-1", posSessionId: shiftId, terminalId: "terminal-main", expectedGrandTotal: 125000,
    input: { items: [{ productId: variantId, quantity: 1 }], customerId, billingProfileId },
    payments: [{ method: "cash", amount: 125000, tenderedAmount: 130000 }],
  });
  expect(fetcher.mock.calls.some(([url]) => (url as URL).pathname === "/api/v1/retail/orders/quote")).toBe(true);
  expect(fetcher.mock.calls.some(([url]) => (url as URL).pathname === "/api/v1/retail/shifts/current")).toBe(true);
  const missingCustomer = await resolveReferences(req, checkout, { input: JSON.stringify({ billingProfileId: "Công ty Ánh Dương" }) } as any);
  expect(missingCustomer.errors.join(" ")).toContain("trước hết cần chọn khách hàng");
});

it("confirms a named retail draft only after checking its version, current price, and open POS session", async () => {
  const orderId = "507f1f77bcf86cd799439027";
  const variantId = "507f1f77bcf86cd799439028";
  const shiftId = "507f1f77bcf86cd799439029";
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/retail/orders" && init?.method === "GET") return new Response(JSON.stringify({ success: true, data: { items: [{ _id: orderId, orderCode: "BH-NHAP-100", status: "draft", version: 3 }] } }), { status: 200 });
    if (input.pathname === `/api/v1/retail/orders/${orderId}`) return new Response(JSON.stringify({ success: true, data: {
      _id: orderId, orderCode: "BH-NHAP-100", status: "draft", version: 3, customerId: "507f1f77bcf86cd799439030", dueDate: "2026-11-10",
      items: [{ productId: variantId, quantity: 1, discount: { type: "amount", value: 0 } }], manualOrderDiscount: 0, taxRate: 0, shippingFee: 0,
    } }), { status: 200 });
    if (input.pathname === "/api/v1/retail/orders/quote") return new Response(JSON.stringify({ success: true, data: { grandTotal: 50000 } }), { status: 200 });
    if (input.pathname === "/api/v1/retail/shifts/current") return new Response(JSON.stringify({ success: true, data: { _id: shiftId, shiftCode: "POS-029", status: "open", terminalId: "terminal-a" } }), { status: 200 });
    return new Response(JSON.stringify({ success: true, data: { order: { orderCode: "BH-NHAP-100", status: "completed", grandTotal: 50000 } } }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "retail.order.confirm")!;
  const resolution = await resolveReferences(req, operation, {
    path_id: "BH-NHAP-100", payments: JSON.stringify([{ method: "cash", amount: 50000, tenderedAmount: 50000 }]),
  } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values).toMatchObject({ path_id: orderId, expectedVersion: 3, expectedGrandTotal: 50000, posSessionId: shiftId, terminalId: "terminal-a" });
  const result = await callOperation(req, operation, resolution.values as any, undefined, "confirm-draft-request");
  expect(result.data).toMatchObject({ orderCode: "BH-NHAP-100", status: "completed", grandTotal: 50000 });
  const confirmCall = fetcher.mock.calls.find(([url, init]) => (url as URL).pathname === `/api/v1/retail/orders/${orderId}/confirm` && init?.method === "POST")!;
  expect(JSON.parse(confirmCall[1].body)).toMatchObject({ idempotencyKey: "confirm-draft-request", expectedVersion: 3, expectedGrandTotal: 50000, posSessionId: shiftId, terminalId: "terminal-a" });
});

it("checks order version and refund total before collecting or cancelling a retail order", async () => {
  const orderId = "507f1f77bcf86cd799439031";
  const shiftId = "507f1f77bcf86cd799439032";
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/retail/orders" && init?.method !== "POST") return new Response(JSON.stringify({ success: true, data: { items: [{ _id: orderId, orderCode: "BH-042", version: 6, paidAmount: 50000, refundedAmount: 0 }] } }), { status: 200 });
    if (input.pathname === `/api/v1/retail/orders/${orderId}`) return new Response(JSON.stringify({ success: true, data: { _id: orderId, orderCode: "BH-042", version: 6, paidAmount: 50000, refundedAmount: 0, status: "confirmed" } }), { status: 200 });
    if (input.pathname === "/api/v1/retail/shifts/current") return new Response(JSON.stringify({ success: true, data: { _id: shiftId, shiftCode: "POS-012", status: "open", terminalId: "terminal-main" } }), { status: 200 });
    return new Response(JSON.stringify({ success: true, data: { orderCode: "BH-042", status: "completed" } }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);

  const collect = ASSISTANT_OPERATIONS.find(item => item.id === "retail.order.collect")!;
  const collectValues = await resolveReferences(req, collect, { path_id: "BH-042", payments: JSON.stringify([{ method: "cash", amount: 10000 }]) } as any);
  expect(collectValues.errors).toEqual([]);
  expect(collectValues.values).toMatchObject({ path_id: orderId, expectedVersion: 6, cashSessionId: shiftId });
  await callOperation(req, collect, collectValues.values as any, undefined, "assistant-collect-1");
  const collectCall = fetcher.mock.calls.find(([url, init]) => (url as URL).pathname === `/api/v1/retail/orders/${orderId}/payments` && init?.method === "POST")!;
  expect(JSON.parse(collectCall[1].body)).toMatchObject({ expectedVersion: 6, cashSessionId: shiftId, idempotencyKey: "assistant-collect-1" });

  fetcher.mockClear();
  const cancel = ASSISTANT_OPERATIONS.find(item => item.id === "retail.order.cancel")!;
  const missingRefund = await resolveReferences(req, cancel, { path_id: "BH-042", reason: "Khách đổi ý" } as any);
  expect(missingRefund.errors.join(" ")).toContain("cần hoàn");
  expect(fetcher.mock.calls.some(([url, init]) => (url as URL).pathname === `/api/v1/retail/orders/${orderId}/cancel` && init?.method === "POST")).toBe(false);

  const cancelValues = await resolveReferences(req, cancel, { path_id: "BH-042", reason: "Khách đổi ý", refunds: JSON.stringify([{ method: "transfer", amount: 50000, reference: "REFUND-42" }]) } as any);
  expect(cancelValues.errors).toEqual([]);
  expect(cancelValues.values).toMatchObject({ path_id: orderId, expectedVersion: 6 });
  await callOperation(req, cancel, cancelValues.values as any, undefined, "assistant-cancel-1");
  const cancelCall = fetcher.mock.calls.find(([url, init]) => (url as URL).pathname === `/api/v1/retail/orders/${orderId}/cancel` && init?.method === "POST")!;
  expect(JSON.parse(cancelCall[1].body)).toMatchObject({ expectedVersion: 6, reason: "Khách đổi ý", refunds: [{ method: "transfer", amount: 50000, reference: "REFUND-42" }], idempotencyKey: "assistant-cancel-1" });
  expect(fetcher.mock.calls.some(([url]) => (url as URL).pathname === "/api/v1/retail/shifts/current")).toBe(false);
});

it("opens, counts, and finalizes a branch-scoped asset inventory session by its visible code", async () => {
  const sessionId = "507f1f77bcf86cd799439091";
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/finance/asset-inventories" && init?.method === "GET") {
      return new Response(JSON.stringify({ success: true, data: [{ _id: sessionId, sessionCode: "KK-Q4", name: "Kiểm kê quý 4", status: "open" }] }), { status: 200 });
    }
    return new Response(JSON.stringify({ success: true, data: { sessionCode: "KK-Q4", status: "open" } }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);

  const open = ASSISTANT_OPERATIONS.find(item => item.id === "finance.asset.inventory.open")!;
  await callOperation(req, open, { sessionCode: "KK-Q4", name: "Kiểm kê quý 4", inventoryDate: "2026-10-29" } as any);
  const openCall = fetcher.mock.calls.find(([url, init]) => (url as URL).pathname === "/api/v1/finance/asset-inventories" && init?.method === "POST")!;
  expect(JSON.parse(openCall[1].body)).toMatchObject({ scope: "branch", branchIds: [req.user.branchId], inventoryDate: "2026-10-29T00:00:00.000Z" });
  expect(JSON.parse(openCall[1].body)).not.toHaveProperty("companyCode");

  const count = ASSISTANT_OPERATIONS.find(item => item.id === "finance.asset.inventory.count")!;
  const resolvedCount = await resolveReferences(req, count, { path_id: "KK-Q4", barcode: "ASSET-BC-1", result: "present" } as any);
  expect(resolvedCount.errors).toEqual([]);
  expect(resolvedCount.values.path_id).toBe(sessionId);
  expect(JSON.stringify(resolvedCount.labels)).not.toContain(sessionId);
  await callOperation(req, count, resolvedCount.values as any);
  const countCall = fetcher.mock.calls.find(([url, init]) => (url as URL).pathname === `/api/v1/finance/asset-inventories/${sessionId}/counts` && init?.method === "POST")!;
  expect(JSON.parse(countCall[1].body)).toEqual({ barcode: "ASSET-BC-1", result: "present" });

  const finalize = ASSISTANT_OPERATIONS.find(item => item.id === "finance.asset.inventory.finalize")!;
  const resolvedFinalize = await resolveReferences(req, finalize, { path_id: "Kiểm kê quý 4" } as any);
  expect(resolvedFinalize.errors).toEqual([]);
  await callOperation(req, finalize, resolvedFinalize.values as any);
  expect(fetcher.mock.calls.some(([url, init]) => (url as URL).pathname === `/api/v1/finance/asset-inventories/${sessionId}/finalize` && init?.method === "POST")).toBe(true);

  const callsBeforeBranchless = fetcher.mock.calls.length;
  await expect(callOperation({ ...req, user: { ...req.user, branchId: undefined } } as any, open, { sessionCode: "KK-X", name: "Kiểm kê", inventoryDate: "2026-10-29" } as any)).rejects.toThrow("gắn với chi nhánh");
  expect(fetcher).toHaveBeenCalledTimes(callsBeforeBranchless);
});

it("resolves source branch, destination branch, source warehouse, product, and SKU names before creating a transfer", async () => {
  const branchId = "507f1f77bcf86cd799439101";
  const sourceWarehouseId = "507f1f77bcf86cd799439103";
  const productId = "507f1f77bcf86cd799439106";
  const variantId = "507f1f77bcf86cd799439107";
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/auth/branches") return new Response(JSON.stringify({ success: true, data: [
      { _id: req.user.branchId, name: "Chi nhánh Hà Nội", code: "HN" }, { _id: branchId, name: "Chi nhánh Đà Nẵng", code: "DN" },
    ] }), { status: 200 });
    if (input.pathname === "/api/v1/inventory/warehouses") return new Response(JSON.stringify({ success: true, data: [
      { _id: sourceWarehouseId, name: "Kho gửi", code: "KHO-GUI", branchId: req.user.branchId, kind: "main", isActive: true },
    ] }), { status: 200 });
    if (input.pathname === "/api/v1/inventory/catalog/products") return new Response(JSON.stringify({ success: true, data: { products: [{ _id: productId, name: "Máy tính mẫu", productCode: "MT-01", status: "active" }] } }), { status: 200 });
    if (input.pathname === `/api/v1/inventory/catalog/products/${productId}`) return new Response(JSON.stringify({ success: true, data: {
      _id: productId, name: "Máy tính mẫu", variants: [{ _id: variantId, sku: "MT-01-16", displayName: "RAM 16 GB", trackingMode: "quantity" }],
    } }), { status: 200 });
    if (input.pathname === "/api/v1/inventory/transfers" && init?.method === "POST") return new Response(JSON.stringify({ success: true, data: { code: "DC-20261029-00000001", status: "in_transit" } }), { status: 201 });
    return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "inventory.transfer.create")!;
  const resolution = await resolveReferences(req, operation, {
    targetBranch: "Chi nhánh Hà Nội", toBranch: "Chi nhánh Đà Nẵng", fromWarehouseId: "KHO-GUI", reason: "Cấp hàng cho chi nhánh",
    items: JSON.stringify([{ productId: "Máy tính mẫu", variantId: "RAM 16 GB", quantity: 2 }]),
  } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values).toMatchObject({ targetBranch: req.user.branchId, toBranch: branchId, fromWarehouseId: sourceWarehouseId });
  expect(JSON.parse(String(resolution.values.items))).toEqual([{ productId, variantId, quantity: 2 }]);
  expect(JSON.stringify(resolution.labels)).not.toContain(productId);
  expect(JSON.stringify(resolution.labels)).not.toContain(variantId);
  await callOperation(req, operation, resolution.values as any, undefined, "transfer-request-2026-10-29");
  const writeCall = fetcher.mock.calls.find(([url, init]) => (url as URL).pathname === "/api/v1/inventory/transfers" && init?.method === "POST")!;
  const body = JSON.parse(writeCall[1].body);
  expect(body).toMatchObject({ toBranchId: branchId, fromWarehouseId: sourceWarehouseId, idempotencyKey: "transfer-request-2026-10-29" });
  expect(body).not.toHaveProperty("toWarehouseId");
  expect(body.items).toEqual([{ productId, variantId, quantity: 2 }]);
  expect((writeCall[0] as URL).searchParams.get("branchId")).toBe(req.user.branchId);
});

it("resolves a POS shift from its visible shift code and keeps the internal ID out of chat labels", async () => {
  const shiftId = "507f1f77bcf86cd799439081";
  const fetcher = vi.fn().mockImplementation(async (input: URL) => {
    if (input.pathname === "/api/v1/retail/shifts") return new Response(JSON.stringify({ success: true, data: { items: [{ _id: shiftId, shiftCode: "POS-HN-001", cashierName: "Đỗ Đức Chung", status: "open", branchId: req.user.branchId }] } }), { status: 200 });
    if (input.pathname.endsWith("/auth/branches")) return new Response(JSON.stringify({ success: true, data: [{ _id: req.user.branchId, name: "Chi nhánh Hà Nội" }] }), { status: 200 });
    return new Response(JSON.stringify({ success: true, data: {} }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.method === "POST" && item.path === "/retail/shifts/:id/close")!;
  expect(operation.fields.find(field => field.key === "path_id")?.reference).toBe("retail.shift.list");
  const resolution = await resolveReferences(req, operation, { path_id: "POS-HN-001", countedCash: 100000 } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.path_id).toBe(shiftId);
  expect(resolution.labels.path_id).toContain("POS-HN-001");
  expect(JSON.stringify(resolution.labels)).not.toContain(shiftId);
  const listUrl = fetcher.mock.calls.map(([url]) => url as URL).find(url => url.pathname === "/api/v1/retail/shifts");
  expect(listUrl?.searchParams.get("limit")).toBe("100");
  expect(listUrl?.searchParams.get("branchId")).toBe(req.user.branchId);
  expect(operation.contextQuery).toEqual(["terminalId"]);
  await callOperation({ ...req, headers: { ...req.headers, "x-device-id": "pos-device-1" } } as any, operation, { ...resolution.values, countedCash: 100000 } as any);
  const closeUrl = fetcher.mock.calls.map(([url, init]) => [url as URL, init] as const).find(([url, init]) => url.pathname === `/api/v1/retail/shifts/${shiftId}/close` && init?.method === "POST")?.[0];
  expect(closeUrl?.searchParams.get("terminalId")).toBe("pos-device-1");
});

it("resolves an unassigned POS payment by order code and keeps the payment index distinct", async () => {
  const orderId = "507f1f77bcf86cd799439082";
  const fetcher = vi.fn().mockImplementation(async (input: URL) => {
    if (input.pathname === "/api/v1/retail/shifts/settlements") return new Response(JSON.stringify({ success: true, data: { items: [{ _id: orderId, orderCode: "POS-ORD-009", paymentIndex: 1, payment: { method: "cash", amount: 25000 } }] } }), { status: 200 });
    return new Response(JSON.stringify({ success: true, data: { paymentIndex: 1 } }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.method === "POST" && item.path === "/retail/shifts/settlements/review")!;
  const resolution = await resolveReferences(req, operation, { orderId: "POS-ORD-009", paymentIndex: 1, reason: "Đã khớp chứng từ" } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.orderId).toBe(orderId);
  expect(resolution.labels.orderId).toContain("Khoản thu 2 (cash)");
  expect(JSON.stringify(resolution.labels)).not.toContain(orderId);
  await callOperation(req, operation, resolution.values as any);
  const reviewCall = fetcher.mock.calls.find(([url, init]) => (url as URL).pathname.endsWith("/settlements/review") && init?.method === "POST");
  expect(JSON.parse(reviewCall?.[1]?.body as string)).toMatchObject({ orderId, paymentIndex: 1, reason: "Đã khớp chứng từ" });
});

it("resolves finance debt payments by the visible reference and injects version and deduplication key", async () => {
  const debtId = "507f1f77bcf86cd799439083";
  const fetcher = vi.fn().mockImplementation(async (input: URL) => {
    if (input.pathname === "/api/v1/finance/reporting/debts") return new Response(JSON.stringify({ success: true, data: { items: [{ id: debtId, source: "manual", direction: "payable", partyKind: "supplier", partyName: "Nhà cung cấp A", reference: "NCC-2026-11", balance: 80000, version: 4 }] } }), { status: 200 });
    return new Response(JSON.stringify({ success: true, data: { reference: "NCC-2026-11", balance: 30000, version: 5 } }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.method === "POST" && item.path === "/finance/reporting/debts/:id/payments")!;
  const resolution = await resolveReferences(req, operation, { path_id: "NCC-2026-11", amount: 50000 } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.path_id).toBe(debtId);
  expect(resolution.values.version).toBe(4);
  await callOperation(req, operation, resolution.values as any, undefined, "finance-payment-request");
  const paymentCall = fetcher.mock.calls.find(([url, init]) => (url as URL).pathname.endsWith(`/debts/${debtId}/payments`) && init?.method === "POST");
  expect(JSON.parse(paymentCall?.[1]?.body as string)).toMatchObject({ amount: 50000, version: 4, key: "finance-payment-request" });
});

it("resolves receivable payments by the displayed receivable code and generates idempotency on the server", async () => {
  const receivableId = "507f1f77bcf86cd799439084";
  const fetcher = vi.fn().mockImplementation(async (input: URL) => {
    if (input.pathname === "/api/v1/finance/receivables") return new Response(JSON.stringify({ success: true, data: { items: [{ _id: receivableId, receivableCode: "PT-2026-001", customerName: "Nguyễn Hoàng", balance: 90000, branchId: req.user.branchId }] } }), { status: 200 });
    if (input.pathname.endsWith("/auth/branches")) return new Response(JSON.stringify({ success: true, data: [{ _id: req.user.branchId, name: "Chi nhánh Hà Nội" }] }), { status: 200 });
    return new Response(JSON.stringify({ success: true, data: { receivable: { receivableCode: "PT-2026-001", balance: 40000 }, entry: { amount: -50000, paymentMethod: "transfer" } } }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.method === "POST" && item.path === "/finance/receivables/:id/payments")!;
  const resolution = await resolveReferences(req, operation, { path_id: "PT-2026-001", amount: 50000, paymentMethod: "transfer", reference: "UNC-5001" } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.path_id).toBe(receivableId);
  expect(resolution.labels.path_id).toContain("PT-2026-001");
  await callOperation(req, operation, resolution.values as any, undefined, "receivable-payment-request");
  const paymentCall = fetcher.mock.calls.find(([url, init]) => (url as URL).pathname === `/api/v1/finance/receivables/${receivableId}/payments` && init?.method === "POST");
  expect(JSON.parse(paymentCall?.[1]?.body as string)).toMatchObject({ amount: 50000, paymentMethod: "transfer", reference: "UNC-5001", idempotencyKey: "receivable-payment-request" });
});

it("reverses an unreversed receivable adjustment by its safe name and keeps entry IDs private", async () => {
  const receivableId = "507f1f77bcf86cd799439184";
  const adjustmentId = "507f1f77bcf86cd799439185";
  const paymentId = "507f1f77bcf86cd799439186";
  const reversalId = "507f1f77bcf86cd799439187";
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/finance/receivables" && init?.method !== "POST") return new Response(JSON.stringify({ success: true, data: { items: [
      { _id: receivableId, receivableCode: "PT-2026-REV-01", customerName: "Nguyễn Hoàng", balance: 65000, status: "open", branchId: req.user.branchId },
    ], total: 1 } }), { status: 200 });
    if (input.pathname === `/api/v1/finance/receivables/${receivableId}`) return new Response(JSON.stringify({ success: true, data: {
      receivable: { _id: receivableId, receivableCode: "PT-2026-REV-01", customerName: "Nguyễn Hoàng", balance: 65000, status: "open", customerId: "hidden-customer" },
      entries: [
        { _id: adjustmentId, type: "adjustment", amount: -25000, reason: "Nhập sai khoản điều chỉnh", createdAt: "2026-10-29T10:00:00.000Z", idempotencyKey: "hidden-adjustment-key", companyCode: "TEST", branchId: req.user.branchId },
        { _id: paymentId, type: "payment", amount: -50000, reason: "Thu lần một", createdAt: "2026-10-28T10:00:00.000Z" },
        { _id: reversalId, type: "reversal", amount: 50000, reversalOfEntryId: paymentId, reason: "Đã đảo trước đó", createdAt: "2026-10-29T11:00:00.000Z" },
      ],
    } }), { status: 200 });
    if (input.pathname === `/api/v1/finance/receivables/${receivableId}/entries/${adjustmentId}/reversal` && init?.method === "POST") return new Response(JSON.stringify({ success: true, data: {
      receivable: { _id: receivableId, receivableCode: "PT-2026-REV-01", customerName: "Nguyễn Hoàng", balance: 90000, status: "open", customerId: "hidden-customer" },
      entry: { _id: reversalId, type: "reversal", amount: 25000, reason: "Sửa khoản điều chỉnh", idempotencyKey: "hidden-reversal-key" },
    } }), { status: 200 });
    return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);

  const detail = ASSISTANT_OPERATIONS.find(item => item.id === "finance.receivable.detail")!;
  const detailResult = await callOperation(req, detail, { path_id: receivableId, targetBranch: req.user.branchId } as any);
  const detailReply = formatAssistantResult(detail, detailResult.data);
  expect(detailReply).toContain("PT-2026-REV-01");
  expect(detailReply).not.toMatch(/507f1f77bcf86cd79943918[4-7]|hidden-customer|hidden-adjustment-key/);

  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "finance.receivable.entry.reversal")!;
  const entryLabel = "Điều chỉnh giảm · 25.000 ₫ · 2026-10-29 · Nhập sai khoản điều chỉnh";
  const resolution = await resolveReferences(req, operation, { targetBranch: req.user.branchId, path_id: "PT-2026-REV-01", path_entryId: entryLabel, reason: "Sửa khoản điều chỉnh" } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values).toMatchObject({ path_id: receivableId, path_entryId: adjustmentId, reason: "Sửa khoản điều chỉnh" });
  expect(JSON.stringify(resolution.labels)).not.toMatch(/507f1f77bcf86cd79943918[4-7]/);

  const result = await callOperation(req, operation, resolution.values as any, undefined, "receivable-entry-reversal-request");
  expect(result.data).toMatchObject({ receivableCode: "PT-2026-REV-01", balance: 90000, status: "open", type: "Đã đảo", amount: 25000, reason: "Sửa khoản điều chỉnh" });
  const write = fetcher.mock.calls.find(([input, init]) => (input as URL).pathname === `/api/v1/finance/receivables/${receivableId}/entries/${adjustmentId}/reversal` && init?.method === "POST")!;
  expect(JSON.parse(write[1].body)).toEqual({ reason: "Sửa khoản điều chỉnh", idempotencyKey: "receivable-entry-reversal-request" });
  expect((write[0] as URL).searchParams.get("branchId")).toBe(req.user.branchId);
  expect(JSON.stringify(result)).not.toMatch(/507f1f77bcf86cd79943918[4-7]|hidden-customer|hidden-reversal-key/);

  const alreadyReversed = await resolveReferences(req, operation, { targetBranch: req.user.branchId, path_id: "PT-2026-REV-01", path_entryId: "Khoản thu · 50.000 ₫ · 2026-10-28 · Thu lần một", reason: "Thử đảo lần hai" } as any);
  expect(alreadyReversed.errors.join(" ")).toContain("chưa tìm thấy");
});

it("lets a branchless admin extend a receivable by code after selecting an accounting branch by name", async () => {
  const branchId = "507f1f77bcf86cd799439087";
  const receivableId = "507f1f77bcf86cd799439088";
  const branchList = ASSISTANT_OPERATIONS.find(item => item.id === "branch.list")!;
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === `/api/v1${branchList.path}`) return new Response(JSON.stringify({ success: true, data: [{ _id: branchId, name: "Chi nhánh Cần Thơ" }] }), { status: 200 });
    if (input.pathname === "/api/v1/finance/receivables" && init?.method !== "POST") return new Response(JSON.stringify({ success: true, data: { items: [{ _id: receivableId, receivableCode: "PT-2026-CT-001", customerName: "Khách hàng Cần Thơ", balance: 80000, status: "open" }], total: 1 } }), { status: 200 });
    if (input.pathname === `/api/v1/finance/receivables/${receivableId}/extend`) return new Response(JSON.stringify({ success: true, data: { receivable: { receivableCode: "PT-2026-CT-001", dueDate: "2026-11-10T00:00:00.000Z", balance: 80000, status: "open" }, entry: { previousDueDate: "2026-11-05T00:00:00.000Z", newDueDate: "2026-11-10T00:00:00.000Z" } } }), { status: 200 });
    return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const adminReq = { ...req, user: { ...req.user, role: "admin", branchId: undefined } } as any;
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "finance.receivable.extend")!;
  const resolution = await resolveReferences(adminReq, operation, { targetBranch: "Chi nhánh Cần Thơ", path_id: "PT-2026-CT-001", dueDate: "2026-11-10", reason: "Khách hàng xin gia hạn" } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values).toMatchObject({ targetBranch: branchId, path_id: receivableId });
  expect(JSON.stringify(resolution.labels)).not.toContain(branchId);
  const result = await callOperation(adminReq, operation, resolution.values as any, undefined, "branchless-receivable-extension");
  expect(result.data).toMatchObject({ receivableCode: "PT-2026-CT-001", dueDate: "2026-11-10T00:00:00.000Z" });
  const writeCall = fetcher.mock.calls.find(([url, init]) => (url as URL).pathname.endsWith("/extend") && init?.method === "POST")!;
  expect((writeCall[1].headers as Record<string, string>)["x-branch-id"]).toBe(branchId);
  expect((writeCall[0] as URL).searchParams.get("branchId")).toBe(branchId);
  expect(JSON.parse(writeCall[1].body)).toMatchObject({ dueDate: "2026-11-10T00:00:00.000Z", idempotencyKey: "branchless-receivable-extension" });
});

it("suspends reminders and extends a receivable with exact dates and a safe extension result", async () => {
  const receivableId = "507f1f77bcf86cd799439085";
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname.endsWith("/suspend")) return new Response(JSON.stringify({ success: true, data: { receivableCode: "PT-2026-002", status: "open", reminderSuspendedUntil: "2026-11-01T00:00:00.000Z", reminderSuspendReason: "Đang đối soát" } }), { status: 200 });
    if (input.pathname.endsWith("/extend")) return new Response(JSON.stringify({ success: true, data: {
      receivable: { _id: receivableId, receivableCode: "PT-2026-002", dueDate: "2026-11-10T00:00:00.000Z", balance: 70000, status: "open" },
      entry: { _id: "507f1f77bcf86cd799439086", previousDueDate: "2026-11-05T00:00:00.000Z", newDueDate: "2026-11-10T00:00:00.000Z", reason: "Khách xin thêm thời gian" },
    } }), { status: 200 });
    return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const suspend = ASSISTANT_OPERATIONS.find(item => item.id === "finance.receivable.suspend")!;
  await callOperation(req, suspend, { path_id: receivableId, until: "2026-11-01", reason: "Đang đối soát" } as any);
  const suspendCall = fetcher.mock.calls.find(([url, init]) => (url as URL).pathname.endsWith("/suspend") && init?.method === "POST")!;
  expect(JSON.parse(suspendCall[1].body)).toEqual({ until: "2026-11-01T00:00:00.000Z", reason: "Đang đối soát" });
  const extend = ASSISTANT_OPERATIONS.find(item => item.id === "finance.receivable.extend")!;
  const result = await callOperation(req, extend, { path_id: receivableId, dueDate: "2026-11-10", reason: "Khách xin thêm thời gian" } as any, undefined, "receivable-extension-request");
  const extendCall = fetcher.mock.calls.find(([url, init]) => (url as URL).pathname.endsWith("/extend") && init?.method === "POST")!;
  expect(JSON.parse(extendCall[1].body)).toEqual({ dueDate: "2026-11-10T00:00:00.000Z", reason: "Khách xin thêm thời gian", idempotencyKey: "receivable-extension-request" });
  expect(result.data).toEqual({ receivableCode: "PT-2026-002", previousDueDate: "2026-11-05T00:00:00.000Z", newDueDate: "2026-11-10T00:00:00.000Z", dueDate: "2026-11-10T00:00:00.000Z", balance: 70000, status: "open" });
});

it("runs overdue reminders only for the selected finance branch and returns aggregate counts", async () => {
  const branchId = "507f1f77bcf86cd799439087";
  const branchList = ASSISTANT_OPERATIONS.find(item => item.id === "branch.list")!;
  const fetcher = vi.fn().mockImplementation(async (input: URL) => {
    if (input.pathname === `/api/v1${branchList.path}`) return new Response(JSON.stringify({ success: true, data: [{ _id: branchId, name: "Chi nhánh Cần Thơ" }] }), { status: 200 });
    return new Response(JSON.stringify({ success: true, data: {
    eligible: 3, queued: 4, skipped: 1, failed: 2, duplicates: 5,
    companyCode: "PRIVATE-COMPANY", receivables: [{ customerName: "PRIVATE-CUSTOMER", balance: 900000 }],
  } }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const adminReq = { ...req, user: { ...req.user, role: "admin", branchId: undefined } } as any;
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "finance.reminders.run")!;
  const missingBranch = await resolveReferences(adminReq, operation, {} as any);
  expect(missingBranch.errors.join(" ")).toContain("Chi nhánh tài chính");
  expect(fetcher).not.toHaveBeenCalled();

  const resolution = await resolveReferences(adminReq, operation, { targetBranch: "Chi nhánh Cần Thơ" } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.targetBranch).toBe(branchId);
  const result = await callOperation(adminReq, operation, resolution.values as any, undefined, "overdue-reminder-run-1");
  expect(result.data).toEqual({ eligibleCount: 3, queuedCount: 4, skippedCount: 1, failedCount: 2, duplicateCount: 5 });
  const [url, init] = fetcher.mock.calls.find(([input, request]) => (input as URL).pathname === "/api/v1/finance/reminders/runs" && request?.method === "POST") as [URL, RequestInit];
  expect(url.pathname).toBe("/api/v1/finance/reminders/runs");
  expect(url.searchParams.get("branchId")).toBe(branchId);
  expect((init.headers as Record<string, string>)["x-branch-id"]).toBe(branchId);
  expect(formatAssistantResult(operation, result.data)).toContain("(chưa khẳng định đã gửi)");
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE-COMPANY|PRIVATE-CUSTOMER|900000/);
});

it("lists overdue reminder runs by branch and date, then summarizes detail without customer payloads", async () => {
  const branchId = "507f1f77bcf86cd799439087";
  const runId = "507f1f77bcf86cd799439088";
  const branchList = ASSISTANT_OPERATIONS.find(item => item.id === "branch.list")!;
  const fetcher = vi.fn().mockImplementation(async (input: URL) => {
    if (input.pathname === `/api/v1${branchList.path}`) return new Response(JSON.stringify({ success: true, data: [{ _id: branchId, name: "Chi nhánh Cần Thơ" }] }), { status: 200 });
    if (input.pathname === "/api/v1/finance/reminders/runs" && !input.pathname.endsWith(runId)) return new Response(JSON.stringify({ success: true, data: [{
      _id: runId, businessDate: "2026-10-30", trigger: "manual", status: "completed", eligible: 3, queued: 4,
      skipped: 1, failed: 0, duplicates: 2, startedAt: "2026-10-30T03:00:00.000Z", completedAt: "2026-10-30T03:01:00.000Z",
      companyCode: "PRIVATE-COMPANY", branchId, actorId: "PRIVATE-ACTOR",
    }] }), { status: 200 });
    if (input.pathname === `/api/v1/finance/reminders/runs/${runId}`) return new Response(JSON.stringify({ success: true, data: {
      _id: runId, businessDate: "2026-10-30", trigger: "manual", status: "completed", eligible: 3, queued: 4,
      skipped: 1, failed: 0, duplicates: 2, startedAt: "2026-10-30T03:00:00.000Z", completedAt: "2026-10-30T03:01:00.000Z",
      companyCode: "PRIVATE-COMPANY", actorId: "PRIVATE-ACTOR",
      deliveries: [
        { _id: "PRIVATE-DELIVERY-1", status: "sent", channel: "in_app", payload: { customerId: "PRIVATE-CUSTOMER", balance: 900000 } },
        { _id: "PRIVATE-DELIVERY-2", status: "failed", channel: "marketing", payload: { receivableId: "PRIVATE-RECEIVABLE", balance: 800000 } },
        { _id: "PRIVATE-DELIVERY-3", status: "queued", channel: "marketing", payload: { customerId: "PRIVATE-CUSTOMER" } },
      ],
    } }), { status: 200 });
    return new Response(JSON.stringify({ success: false, error: "Unexpected route" }), { status: 404 });
  });
  vi.stubGlobal("fetch", fetcher);
  const adminReq = { ...req, user: { ...req.user, role: "admin", branchId: undefined } } as any;
  const list = ASSISTANT_OPERATIONS.find(item => item.id === "finance.reminders.runs.list")!;
  const detail = ASSISTANT_OPERATIONS.find(item => item.id === "finance.reminders.runs.detail")!;
  const listed = await callOperation(adminReq, list, { targetBranch: branchId } as any);
  expect(listed.data).toMatchObject([{ date: "2026-10-30", trigger: "manual", status: "completed", eligibleCount: 3, queuedCount: 4 }]);
  expect(formatAssistantResult(list, listed.data)).toContain("Ngày: 2026-10-30");
  expect(JSON.stringify(listed)).not.toMatch(/PRIVATE-COMPANY|PRIVATE-ACTOR|507f1f77bcf86cd799439088/);

  const resolution = await resolveReferences(adminReq, detail, { targetBranch: "Chi nhánh Cần Thơ", path_id: "2026-10-30" } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values).toMatchObject({ targetBranch: branchId, path_id: runId });
  const result = await callOperation(adminReq, detail, resolution.values as any);
  expect(result.data).toMatchObject({ date: "2026-10-30", deliveryQueuedCount: 1, deliverySentCount: 1, deliverySkippedCount: 0, deliveryFailedCount: 1 });
  const reply = formatAssistantResult(detail, result.data);
  expect(reply).toContain("Kết quả gửi: 1 đã gửi");
  expect(reply).not.toMatch(/PRIVATE|900000|800000|\{/);
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE|900000|800000|507f1f77bcf86cd799439088/);
});

it("moves a named Drive file into a named personal folder after resolving both references", async () => {
  const fileId = "1ZyXwVuTsRqPoNmLkJiHgFeDcBa9876543210";
  const folderId = "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789";
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/integrations/google-drive/resources/move" && init?.method === "POST") {
      return new Response(JSON.stringify({ status: "success", message: "Di chuyển tài nguyên thành công." }), { status: 200 });
    }
    return new Response(JSON.stringify({ success: true, data: [
      { _id: fileId, driveFileId: fileId, name: "Báo cáo.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", createdAt: "2026-10-30T01:00:00.000Z" },
      { _id: folderId, driveFileId: folderId, name: "Lưu trữ", mimeType: "application/vnd.google-apps.folder", createdAt: "2026-10-29T01:00:00.000Z" },
      { _id: "1FolderCannotMove000000000000000000000", driveFileId: "1FolderCannotMove000000000000000000000", name: "Thư mục khác", mimeType: "application/vnd.google-apps.folder", createdAt: "2026-10-28T01:00:00.000Z" },
    ] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "resource.google-drive.move")!;
  const fileField = operation.fields.find(field => field.apiKey === "fileId")!;
  const folderField = operation.fields.find(field => field.apiKey === "newParentId")!;
  const fileOptions = await suggestReferenceOptions(req, operation, fileField, {} as any);
  const folderOptions = await suggestReferenceOptions(req, operation, folderField, {} as any);
  expect(fileOptions.some(option => option.startsWith("Báo cáo.xlsx · tệp"))).toBe(true);
  expect(fileOptions.some(option => option.includes("Thư mục khác"))).toBe(false);
  expect(folderOptions.some(option => option.startsWith("Lưu trữ · thư mục"))).toBe(true);
  expect(folderOptions.some(option => option.includes("Báo cáo.xlsx"))).toBe(false);
  const resolution = await resolveReferences(req, operation, { fileId: "Báo cáo.xlsx", newParentId: "Lưu trữ" } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values).toMatchObject({ fileId, newParentId: folderId });
  expect(resolution.labels.fileId).toContain("Báo cáo.xlsx");
  expect(resolution.labels.newParentId).toContain("thư mục");
  const result = await callOperation(req, operation, resolution.values as any);
  const write = fetcher.mock.calls.find(([, init]) => init?.method === "POST")!;
  expect(JSON.parse(String(write[1].body))).toEqual({ fileId, newParentId: folderId });
  expect(formatAssistantResult(operation, result)).toContain("Di chuyển tài nguyên thành công.");
  expect(JSON.stringify(resolution.labels)).not.toMatch(/1ZyXw|1AbCd/);
});

it("renames a named personal Drive resource and exposes only the new name", async () => {
  const fileId = "1RenameDriveFile000000000000000000000";
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === `/api/v1/integrations/google-drive/resources/${fileId}/rename` && init?.method === "PATCH") {
      return new Response(JSON.stringify({ status: "success", data: { _id: fileId, driveFileId: fileId, name: "Bao cao Q4.xlsx", webViewLink: `https://drive.google.com/open?id=${fileId}` } }), { status: 200 });
    }
    return new Response(JSON.stringify({ success: true, data: [
      { _id: fileId, driveFileId: fileId, name: "Báo cáo.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", createdAt: "2026-10-30T01:00:00.000Z" },
      { _id: "1FolderForRename0000000000000000000000", driveFileId: "1FolderForRename0000000000000000000000", name: "Hồ sơ", mimeType: "application/vnd.google-apps.folder", createdAt: "2026-10-29T01:00:00.000Z" },
    ] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "resource.google-drive.rename")!;
  const resolution = await resolveReferences(req, operation, { path_id: "Báo cáo.xlsx", name: "Bao cao Q4.xlsx" } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.path_id).toBe(fileId);
  expect(resolution.labels.path_id).toContain("Báo cáo.xlsx");
  const result = await callOperation(req, operation, resolution.values as any);
  const write = fetcher.mock.calls.find(([, init]) => init?.method === "PATCH")!;
  expect((write[0] as URL).pathname).toBe(`/api/v1/integrations/google-drive/resources/${fileId}/rename`);
  expect(JSON.parse(String(write[1].body))).toEqual({ name: "Bao cao Q4.xlsx" });
  const reply = formatAssistantResult(operation, result.data);
  expect(reply).toContain("Bao cao Q4.xlsx");
  expect(reply).not.toMatch(/1Rename|drive\.google\.com|webViewLink/);
});

it("lists personal Google Drive files by folder name and hides provider links and IDs", async () => {
  const folderId = "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789";
  const fileId = "1ZyXwVuTsRqPoNmLkJiHgFeDcBa9876543210";
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "resource.google-drive.list")!;
  const folderField = operation.fields.find(field => field.apiKey === "folderId")!;
  const fetcher = vi.fn().mockImplementation(async (input: URL) => {
    const data = input.searchParams.get("folderId") === folderId
      ? [{ _id: fileId, driveFileId: fileId, name: "Báo cáo nội bộ.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: 2048, createdAt: "2026-10-30T01:00:00.000Z", webViewLink: `https://drive.google.com/open?id=${fileId}`, webContentLink: `https://drive.google.com/download?id=${fileId}`, thumbnailLink: "https://drive.google.com/thumbnail?id=private" }]
      : [{ _id: folderId, driveFileId: folderId, name: "Hồ sơ cá nhân", mimeType: "application/vnd.google-apps.folder", createdAt: "2026-10-29T01:00:00.000Z", webViewLink: `https://drive.google.com/open?id=${folderId}` }];
    return new Response(JSON.stringify({ success: true, data }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);

  const root = await callOperation(req, operation, {} as any);
  expect(root.data).toEqual([{ name: "Hồ sơ cá nhân", mimeType: "application/vnd.google-apps.folder", createdAt: "2026-10-29T01:00:00.000Z" }]);
  expect(JSON.stringify(root.data)).not.toMatch(/1AbCd|drive\.google\.com|webViewLink|webContentLink|thumbnailLink/);

  const resolution = await resolveReferences(req, operation, { [folderField.key]: "Hồ sơ cá nhân" } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values[folderField.key]).toBe(folderId);
  const contents = await callOperation(req, operation, resolution.values as any);
  expect((fetcher.mock.calls.at(-1)?.[0] as URL).searchParams.get("folderId")).toBe(folderId);
  expect(contents.data).toEqual([{ name: "Báo cáo nội bộ.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: 2048, createdAt: "2026-10-30T01:00:00.000Z" }]);
  expect(formatAssistantResult(operation, contents.data)).toContain("Báo cáo nội bộ.xlsx");
  expect(JSON.stringify(contents)).not.toMatch(/1AbCd|1ZyXw|drive\.google\.com|webViewLink|webContentLink|thumbnailLink/);

  fetcher.mockImplementationOnce(async () => new Response(JSON.stringify({ success: false, details: "PRIVATE-DRIVE-ERROR" }), { status: 500 }));
  await expect(callOperation(req, operation, {} as any)).rejects.toThrow("Không thể lấy danh sách Google Drive");
});

it("sends online attendance codes only after resolving a class name and returns aggregate counts", async () => {
  const batchId = "507f1f77bcf86cd799439144";
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "student.online-attendance.create-sessions")!;
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/batches") {
      return new Response(JSON.stringify({ success: true, data: [{ _id: batchId, code: "ENG-01", name: "Lớp tiếng Anh A", courseTitle: "Tiếng Anh", ownerId: "PRIVATE-OWNER" }] }), { status: 200 });
    }
    if (input.pathname === "/api/v1/attendance/online/sessions" && init?.method === "POST") {
      return new Response(JSON.stringify({ success: true, sent: 2, skippedNotRegistered: 1, skippedNoEmail: 1, failed: 0, total: 4, privateCodes: ["PRIVATE-CODE"], recipients: ["private@example.test"] }), { status: 200 });
    }
    return new Response(JSON.stringify({ success: false, error: "Unexpected route" }), { status: 404 });
  });
  vi.stubGlobal("fetch", fetcher);

  const resolution = await resolveReferences(req, operation, { batchId: "Lớp tiếng Anh A", date: "2026-10-31" } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values).toMatchObject({ batchId, date: "2026-10-31" });
  const result = await callOperation(req, operation, resolution.values as any);
  expect(JSON.parse(String(fetcher.mock.calls.find(([, init]) => init?.method === "POST")![1].body))).toEqual({ batchId, date: "2026-10-31" });
  expect(result.data).toEqual({ sent: 2, skippedNotRegistered: 1, skippedNoEmail: 1, failed: 0, total: 4 });
  expect(formatAssistantResult(operation, result.data)).toContain("Email đã gửi: 2");
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE|private@example/);
});

it("runs and reads retail debt reminders by named branch while hiding order and recipient payloads", async () => {
  const branchId = "507f1f77bcf86cd799439117";
  const runId = "507f1f77bcf86cd799439118";
  const adminReq = { ...req, user: { ...req.user, role: "admin", branchId: undefined } } as any;
  const branchList = ASSISTANT_OPERATIONS.find(item => item.id === "branch.list")!;
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1" + branchList.path) {
      return new Response(JSON.stringify({ success: true, data: [{ _id: branchId, name: "Chi nhánh Cần Thơ" }] }), { status: 200 });
    }
    if (input.pathname === "/api/v1/retail/debt-reminders/runs" && init?.method !== "POST") {
      return new Response(JSON.stringify({ success: true, data: { items: [{
        _id: runId, businessDate: "2026-10-30", status: "completed", overdueOrders: 4, recipients: 8,
        total: 12, queued: 3, sent: 5, failed: 2, duplicates: 2,
        startedAt: "2026-10-30T03:00:00.000Z", completedAt: "2026-10-30T03:01:00.000Z",
        settings: { emailEnabled: true }, companyCode: "PRIVATE-COMPANY", branchId, error: "PRIVATE-ERROR",
      }], total: 1, page: 1, limit: 20 } }), { status: 200 });
    }
    if (input.pathname === "/api/v1/retail/debt-reminders/runs/" + runId) {
      return new Response(JSON.stringify({ success: true, data: {
        run: {
          _id: runId, businessDate: "2026-10-30", status: "completed", overdueOrders: 4, recipients: 8,
          total: 12, queued: 3, sent: 5, failed: 2, duplicates: 2, startedAt: "2026-10-30T03:00:00.000Z",
          completedAt: "2026-10-30T03:01:00.000Z", settings: { recipientUserIds: ["PRIVATE-USER"] },
        },
        deliveries: [
          { status: "sent", channel: "email", payload: { to: "private@example.test", text: "PRIVATE-MESSAGE" } },
          { status: "failed", channel: "email", payload: { to: "private@example.test", text: "PRIVATE-MESSAGE" } },
          { status: "duplicate", channel: "notification", payload: { customerId: "PRIVATE-CUSTOMER" } },
        ],
      } }), { status: 200 });
    }
    if (input.pathname === "/api/v1/retail/debt-reminders/run" && init?.method === "POST") {
      return new Response(JSON.stringify({ success: true, data: {
        businessDate: "2026-10-31", cycleKey: "PRIVATE-CYCLE", skipped: false,
        overdueOrders: 6, recipients: 12, created: 9, duplicates: 3,
        companyCode: "PRIVATE-COMPANY", branchId,
      } }), { status: 200 });
    }
    return new Response(JSON.stringify({ success: false, error: "Unexpected route" }), { status: 404 });
  });
  vi.stubGlobal("fetch", fetcher);
  const runOperation = ASSISTANT_OPERATIONS.find(item => item.id === "retail.debt-reminders.run")!;
  const list = ASSISTANT_OPERATIONS.find(item => item.id === "retail.debt-reminders.runs.list")!;
  const detail = ASSISTANT_OPERATIONS.find(item => item.id === "retail.debt-reminders.runs.detail")!;

  const runResolution = await resolveReferences(adminReq, runOperation, { targetBranch: "Chi nhánh Cần Thơ" } as any);
  expect(runResolution.errors).toEqual([]);
  expect(runResolution.values.targetBranch).toBe(branchId);
  const runResult = await callOperation(adminReq, runOperation, runResolution.values as any);
  expect(runResult.data).toEqual({ businessDate: "2026-10-31", skipped: false, overdueOrders: 6, recipients: 12, created: 9, duplicates: 3 });
  const runRequest = fetcher.mock.calls.find(([url, init]) => (url as URL).pathname === "/api/v1/retail/debt-reminders/run" && init?.method === "POST")!;
  expect((runRequest[0] as URL).searchParams.get("branchId")).toBe(branchId);
  expect(JSON.parse(String(runRequest[1].body))).toEqual({});
  expect(formatAssistantResult(runOperation, runResult.data)).toContain("Thông báo tạo mới: 9");
  expect(JSON.stringify(runResult)).not.toMatch(/PRIVATE|507f1f77/);

  const listed = await callOperation(adminReq, list, { targetBranch: branchId, query_page: 1, query_limit: 20 } as any);
  expect(listed.data.items).toEqual([expect.objectContaining({ businessDate: "2026-10-30", status: "completed", overdueOrders: 4, failed: 2 })]);
  expect(formatAssistantResult(list, listed.data)).toContain("30/10/2026");
  expect(JSON.stringify(listed)).not.toMatch(/PRIVATE|507f1f77/);

  const detailResolution = await resolveReferences(adminReq, detail, {
    targetBranch: "Chi nhánh Cần Thơ",
    path_id: "2026-10-30",
  } as any);
  expect(detailResolution.errors).toEqual([]);
  expect(detailResolution.values).toMatchObject({ targetBranch: branchId, path_id: runId });
  const runDetail = await callOperation(adminReq, detail, detailResolution.values as any);
  expect(runDetail.data).toMatchObject({ businessDate: "2026-10-30", deliveryQueuedCount: 0, deliverySentCount: 1, deliveryFailedCount: 1, deliveryDuplicateCount: 1 });
  expect(formatAssistantResult(detail, runDetail.data)).toContain("1 đã gửi");
  expect(JSON.stringify(runDetail)).not.toMatch(/PRIVATE|507f1f77|private@example|PRIVATE-MESSAGE/);
});

it("reads the current VAT period version before saving the carry-forward credit", async () => {
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/finance/reporting/vat" && init?.method === "GET") return new Response(JSON.stringify({ success: true, data: { settings: { period: "2026-10", openingCredit: 200, version: 7 }, items: [] } }), { status: 200 });
    return new Response(JSON.stringify({ success: true, data: { period: "2026-10", openingCredit: 1000, version: 8 } }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.method === "PUT" && item.path === "/finance/reporting/vat/period")!;
  const resolution = await resolveReferences(req, operation, { period: "2026-10", openingCredit: 1000 } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.version).toBe(7);
  await callOperation(req, operation, resolution.values as any);
  const calls = fetcher.mock.calls.map(([url, init]) => [url as URL, init] as const);
  expect(calls[0][0].searchParams.get("period")).toBe("2026-10");
  expect(JSON.parse(calls[1][1]?.body as string)).toMatchObject({ period: "2026-10", openingCredit: 1000, version: 7 });
});

it("resolves nested product references by Vietnamese category and unit names", async () => {
  const fetcher = vi.fn().mockImplementation(async (input: URL) => {
    if (input.pathname.endsWith("/resources/categories")) return new Response(JSON.stringify({ success: true, data: [{ _id: "507f1f77bcf86cd799439071", code: "CAT-PHONE", name: "Điện thoại", status: "active" }] }), { status: 200 });
    if (input.pathname.endsWith("/resources/units")) return new Response(JSON.stringify({ success: true, data: [{ _id: "507f1f77bcf86cd799439072", code: "UOM-CAI", name: "Cái", status: "active" }] }), { status: 200 });
    return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.method === "POST" && item.path === "/inventory/catalog/products")!;
  const resolution = await resolveReferences(req, operation, {
    name: "Điện thoại thử", categoryCode: "Điện thoại", productType: "physical",
    variant: JSON.stringify({ sku: "DT-001", unitCode: "Cái" }),
  } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.categoryCode).toBe("CAT-PHONE");
  expect(JSON.parse(String(resolution.values.variant))).toMatchObject({ sku: "DT-001", unitCode: "UOM-CAI" });
  expect(resolution.labels.categoryCode).toContain("Điện thoại");
  expect(resolution.labels.variant).toContain('"unitCode": "Cái — mã UOM-CAI"');
  expect(JSON.stringify(resolution.labels)).not.toContain("507f1f77bcf86cd79943907");
  const urls = fetcher.mock.calls.map(([url]) => url as URL);
  expect(urls.some(url => url.pathname.endsWith("/resources/categories"))).toBe(true);
  expect(urls.some(url => url.pathname.endsWith("/resources/units"))).toBe(true);
});

it("resolves nested receipt product and SKU references using the chosen product", async () => {
  const supplierId = "507f1f77bcf86cd799439073";
  const warehouseId = "507f1f77bcf86cd799439074";
  const productId = "507f1f77bcf86cd799439075";
  const variantId = "507f1f77bcf86cd799439076";
  const branchId = req.user.branchId;
  const fetcher = vi.fn().mockImplementation(async (input: URL) => {
    if (input.pathname.endsWith("/receiving/suppliers")) return new Response(JSON.stringify({ status: "success", data: [{ _id: supplierId, code: "NCC-01", name: "Nhà cung cấp A" }] }), { status: 200 });
    if (input.pathname === "/api/v1/inventory/warehouses") return new Response(JSON.stringify({ success: true, data: [{ _id: warehouseId, code: "KHO-HN", name: "Kho Hà Nội", branchId }] }), { status: 200 });
    if (input.pathname === "/api/v1/inventory/catalog/products") return new Response(JSON.stringify({ success: true, data: { items: [{ _id: productId, name: "Điện thoại mẫu", productCode: "SP-001", branchId }] } }), { status: 200 });
    if (input.pathname === `/api/v1/inventory/catalog/products/${productId}`) return new Response(JSON.stringify({ success: true, data: { _id: productId, name: "Điện thoại mẫu", variants: [{ _id: variantId, sku: "SKU-001", displayName: "Bản 128GB", status: "active" }], branchId } }), { status: 200 });
    return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.method === "POST" && item.path === "/inventory/receiving/receipts")!;
  const resolution = await resolveReferences(req, operation, {
    supplierId: "Nhà cung cấp A", warehouseId: "Kho Hà Nội",
    items: JSON.stringify([{ productId: "Điện thoại mẫu", variantId: "SKU-001", quantity: 1, unitCost: 1000 }]),
  } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.supplierId).toBe(supplierId);
  expect(resolution.values.warehouseId).toBe(warehouseId);
  expect(JSON.parse(String(resolution.values.items))).toEqual([{ productId, variantId, quantity: 1, unitCost: 1000 }]);
  expect(resolution.labels.items).toContain("Điện thoại mẫu");
  expect(resolution.labels.items).toContain("SKU-001");
  expect(JSON.stringify(resolution.labels)).not.toContain(productId);
  const detailUrl = fetcher.mock.calls.map(([url]) => url as URL).find(url => url.pathname === `/api/v1/inventory/catalog/products/${productId}`);
  expect(detailUrl).toBeDefined();
});

it("offers receipt SKU choices directly from the selected product detail", async () => {
  const productId = "507f1f77bcf86cd799439081";
  const variantId = "507f1f77bcf86cd799439082";
  const fetcher = vi.fn().mockImplementation(async (input: URL) => {
    if (input.pathname === `/api/v1/inventory/catalog/products/${productId}`) {
      return new Response(JSON.stringify({ success: true, data: {
        _id: productId,
        name: "Cốc sứ tai mèo cute",
        variants: [
          { _id: variantId, sku: "COC-MEO-001", displayName: "Màu trắng", status: "active" },
          { _id: "507f1f77bcf86cd799439083", sku: "COC-MEO-OLD", displayName: "Màu cũ", status: "inactive" },
        ],
      } }), { status: 200 });
    }
    throw new Error(`Unexpected request: ${input.pathname}`);
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.method === "POST" && item.path === "/inventory/receiving/receipts")!;
  const variantShape = operation.fields.find(field => field.key === "items")?.structure?.items?.keys?.variantId!;
  const field = { ...variantShape, key: "items[1].variantId", type: "reference" } as any;

  const choices = await suggestReferenceOptions(req, operation, field, { productId } as any);

  expect(choices).toEqual(["Màu trắng — mã COC-MEO-001"]);
  expect(fetcher.mock.calls.map(([input]) => (input as URL).pathname)).toEqual([`/api/v1/inventory/catalog/products/${productId}`]);
  expect(JSON.stringify(choices)).not.toContain(variantId);
});

it("asks which branch when the same record name exists in multiple branches", async () => {
  const firstId = "507f1f77bcf86cd799439011";
  const secondId = "507f1f77bcf86cd799439013";
  const firstBranchId = "507f1f77bcf86cd799439012";
  const secondBranchId = "507f1f77bcf86cd799439014";
  const fetcher = vi.fn().mockImplementation(async (input: URL) => {
    if (input.pathname.endsWith("/auth/branches")) return new Response(JSON.stringify({ success: true, data: [
      { _id: firstBranchId, name: "Trụ sở chính", code: "MAIN" },
      { _id: secondBranchId, name: "Chi nhánh Hà Nội", code: "HN" },
    ] }), { status: 200 });
    return new Response(JSON.stringify({ success: true, data: [
      { _id: firstId, name: "Công ty Ánh Dương", customerCode: "KH-001", phone: "0900000001", status: "active", version: 2, branchId: firstBranchId },
      { _id: secondId, name: "Công ty Ánh Dương", customerCode: "KH-002", phone: "0900000002", status: "active", version: 4, branchId: secondBranchId },
    ] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.method === "PATCH" && item.path === "/customers/:id")!;
  const resolution = await resolveReferences({ ...req, user: { id: "actor", companyCode: "TEST", role: "admin" } } as any, operation, { path_id: "Công ty Ánh Dương", phone: "0900000000" } as any);
  expect(resolution.errors).toHaveLength(1);
  expect(resolution.errors[0]).toContain("Trụ sở chính");
  expect(resolution.errors[0]).toContain("Chi nhánh Hà Nội");
  expect(resolution.errors.join(" ")).not.toContain(firstId);
  expect(resolution.errors.join(" ")).not.toContain(secondId);
});

it("resolves a user name for UID path parameters from the matching list endpoint", async () => {
  const uid = "507f1f77bcf86cd799439131";
  const fetcher = vi.fn().mockImplementation(() => new Response(JSON.stringify({ success: true, data: [{ _id: uid, displayName: "Đỗ Đức Chung", fullName: "Đỗ Đức Chung", companyCode: "TEST" }] }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.method === "PATCH" && item.path === "/timekeeping/work-hours/:uid")!;
  expect(operation.fields.find(field => field.key === "path_uid")?.label).toBe("Tên hoặc email nhân viên cần cập nhật giờ làm");
  const listOperation = ASSISTANT_OPERATIONS.find(item => item.id === "api.get.5d0d3ea4fc0d9efb")!;
  const listed = await lookupRecords({ ...req, user: { id: "actor", companyCode: "TEST", role: "admin" } } as any, listOperation.id, "Đỗ Đức Chung");
  expect(listed).toMatchObject([{ id: uid, employeeName: "Đỗ Đức Chung" }]);
  const resolution = await resolveReferences({ ...req, user: { id: "actor", companyCode: "TEST", role: "admin" } } as any, operation, { path_uid: "Đỗ Đức Chung", useCustom: true } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.path_uid).toBe(uid);

  const confirmationResolution = await resolveReferences({ ...req, user: { id: "actor", companyCode: "TEST", role: "admin" } } as any, operation, { ...resolution.values } as any);
  expect(confirmationResolution.errors).toEqual([]);
  expect(confirmationResolution.values.path_uid).toBe(uid);
});

it("resolves customer records by their generated business code", async () => {
  const customerId = "507f1f77bcf86cd799439015";
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: [{ _id: customerId, name: "Khách hàng thử", customerCode: "KH-ABD-000002", phone: "0900000000", status: "active", version: 2 }] }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.method === "PATCH" && item.path === "/customers/:id")!;
  expect(ASSISTANT_OPERATIONS.find(item => item.id === "customer.list")?.resultFields).toContain("customerCode");
  const resolution = await resolveReferences({ ...req, user: { id: "actor", companyCode: "TEST", role: "admin" } } as any, operation, { path_id: "KH-ABD-000002", name: "Khách hàng đã cập nhật" } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.path_id).toBe(customerId);
  expect(resolution.labels.path_id).toContain("KH-ABD-000002");
});

it("resolves an optional warehouse location branch name into a company-scoped query", async () => {
  const branchId = "507f1f77bcf86cd799439016";
  const fetcher = vi.fn().mockImplementation(async (input: URL) => input.pathname.endsWith("/auth/branches")
    ? new Response(JSON.stringify({ success: true, data: [{ _id: branchId, name: "Trụ sở chính", code: "MAIN" }] }), { status: 200 })
    : new Response(JSON.stringify({ success: true, data: [] }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "inventory.warehouse.locations.list")!;
  const admin = { ...req, user: { id: "actor", companyCode: "TEST", role: "admin" } } as any;
  const resolution = await resolveReferences(admin, operation, { targetBranch: "Trụ sở chính" } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.labels.targetBranch).toContain("Trụ sở chính");
  await callOperation(admin, operation, resolution.values as any);
  const warehousesUrl = fetcher.mock.calls.map(([url]) => url as URL).find(url => url.pathname.endsWith("/inventory/warehouses"));
  expect(warehousesUrl?.searchParams.get("branchId")).toBe(branchId);
  expect(warehousesUrl?.searchParams.get("companyCode")).toBe("TEST");
});

it("redacts internal IDs and UIDs from assistant-visible results", () => {
  expect(redactAssistantResult({ name: "Chung", id: "record-id", uid: "user-id", employeeUid: "employee-id", branchId: "branch-id" })).toEqual({ name: "Chung" });
});

it("binds customer transaction history to the selected branch and keeps its requested pagination", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: { items: [], summary: { received: 100 } } }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "customer.transactions")!;
  await callOperation(req, operation, { id: "507f1f77bcf86cd799439011", branchId: "507f1f77bcf86cd799439012", type: "refund", page: 2, limit: 10 });
  const url = fetcher.mock.calls[0][0] as URL;
  expect(url.pathname).toBe("/api/v1/customers/507f1f77bcf86cd799439011/transactions");
  expect(url.searchParams.get("branchId")).toBe("507f1f77bcf86cd799439012");
  expect(url.searchParams.get("type")).toBe("refund");
  expect(url.searchParams.get("page")).toBe("2");
  expect(url.searchParams.get("limit")).toBe("10");
});

it("resolves refund tickets and approved vouchers by branch and business names", async () => {
  const ticketId = "507f1f77bcf86cd799439021";
  const branchId = "507f1f77bcf86cd799439022";
  const voucherId = "507f1f77bcf86cd799439023";
  const fetcher = vi.fn().mockImplementation(async (input: URL) => {
    if (input.pathname.endsWith("/auth/branches")) return new Response(JSON.stringify({ success: true, data: [{ _id: branchId, name: "Chi nhánh Hà Nội", code: "HN" }] }), { status: 200 });
    if (input.pathname === "/api/v1/repair/tickets") return new Response(JSON.stringify({ success: true, data: { items: [{ _id: ticketId, ticketCode: "REP-001", customerName: "Khách A", branchId }] } }), { status: 200 });
    if (input.pathname === `/api/v1/repair/tickets/${ticketId}/refunds/vouchers`) return new Response(JSON.stringify({ success: true, data: [{ _id: voucherId, key: "PC-001", amount: 1000, description: "Chi hoàn REP-001" }] }), { status: 200 });
    return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "repair.refund.create")!;
  expect(operation.confirmation).toBe(true);
  expect(defaultWorkflow(operation).confirmationLocked).toBe(true);
  const resolution = await resolveReferences({ ...req, user: { ...req.user, role: "admin", branchId: undefined } } as any, operation, {
    branchId: "Chi nhánh Hà Nội", id: "REP-001", amount: 1000, laborAmount: 250, reference: "PC-001", reason: "Khách trả hàng",
  } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.branchId).toBe(branchId);
  expect(resolution.values.id).toBe(ticketId);
  expect(resolution.values.reference).toBe(voucherId);
  expect(resolution.labels.id).toContain("REP-001");
  expect(resolution.labels.reference).toContain("PC-001");
  const voucherUrl = fetcher.mock.calls.map(([url]) => url as URL).find(url => url.pathname.endsWith("/refunds/vouchers"));
  expect(voucherUrl?.searchParams.get("branchId")).toBe(branchId);
});

it("posts repair refunds with a server-owned idempotency key and no branch or record ID in the body", async () => {
  const ticketId = "507f1f77bcf86cd799439031";
  const branchId = "507f1f77bcf86cd799439032";
  const voucherId = "507f1f77bcf86cd799439033";
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: { status: "completed" } }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "repair.refund.create")!;
  await callOperation({ ...req, user: { ...req.user, role: "admin", branchId: undefined } } as any, operation, { id: ticketId, branchId, amount: 1000, laborAmount: 250, reference: voucherId, reason: "Khách trả hàng" }, undefined, "refund-request-123");
  const url = fetcher.mock.calls[0][0] as URL;
  const headers = fetcher.mock.calls[0][1].headers;
  const body = JSON.parse(fetcher.mock.calls[0][1].body);
  expect(url.pathname).toBe(`/api/v1/repair/tickets/${ticketId}/refunds`);
  expect(url.searchParams.get("branchId")).toBe(branchId);
  expect(headers["x-branch-id"]).toBe(branchId);
  expect(body).toEqual({ amount: 1000, laborAmount: 250, reference: voucherId, reason: "Khách trả hàng", idempotencyKey: "refund-request-123" });
});

it("resolves a customer transaction code to internal detail path values", async () => {
  const customerId = "507f1f77bcf86cd799439041";
  const branchId = "507f1f77bcf86cd799439042";
  const sourceId = "507f1f77bcf86cd799439043";
  const fetcher = vi.fn().mockImplementation(async (input: URL) => {
    if (input.pathname.endsWith("/auth/branches")) return new Response(JSON.stringify({ success: true, data: [{ _id: branchId, name: "Chi nhánh Hà Nội" }] }), { status: 200 });
    if (input.pathname === "/api/v1/customers") return new Response(JSON.stringify({ success: true, data: [{ _id: customerId, name: "Khách A", customerCode: "KH-001", phone: "0900000001", status: "active", version: 1 }] }), { status: 200 });
    if (input.pathname === `/api/v1/customers/${customerId}/transactions`) return new Response(JSON.stringify({ success: true, data: { items: [{ id: `sale_refund:${sourceId}:0`, kind: "sale_refund", sourceId, eventId: "0", code: "DH-001", status: "posted", amount: 1000, description: "Hoàn tiền" }] } }), { status: 200 });
    return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "customer.transaction.detail")!;
  const resolution = await resolveReferences({ ...req, user: { ...req.user, role: "admin", branchId: undefined } } as any, operation, { branchId: "Chi nhánh Hà Nội", id: "KH-001", sourceId: "DH-001" } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values).toMatchObject({ branchId, id: customerId, kind: "sale_refund", sourceId, eventId: "0" });
  const detailFetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: { item: { code: "DH-001" } } }), { status: 200 }));
  vi.stubGlobal("fetch", detailFetcher);
  await callOperation({ ...req, user: { ...req.user, branchId } } as any, operation, resolution.values as any);
  const url = detailFetcher.mock.calls[0][0] as URL;
  expect(url.pathname).toBe(`/api/v1/customers/${customerId}/transactions/sale_refund/${sourceId}`);
  expect(url.searchParams.get("eventId")).toBe("0");
});

it("resolves named products and SKUs before registering a serial and derives the product name", async () => {
  const productId = "507f1f77bcf86cd799439071";
  const variantId = "507f1f77bcf86cd799439072";
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/inventory/catalog/products") return new Response(JSON.stringify({ success: true, data: { items: [{ _id: productId, name: "Điện thoại mẫu", productCode: "DT-01", status: "active" }] } }), { status: 200 });
    if (input.pathname === `/api/v1/inventory/catalog/products/${productId}`) return new Response(JSON.stringify({ success: true, data: { _id: productId, name: "Điện thoại mẫu", variants: [{ _id: variantId, sku: "DT-01-128", displayName: "128 GB", trackingMode: "serial" }] } }), { status: 200 });
    if (input.pathname === "/api/v1/inventory/serials" && init?.method === "POST") return new Response(JSON.stringify({ success: true, data: [{ serialNumber: "IMEI-QA", internalBarcode: "SN-DT-01-01", sku: "DT-01-128", productName: "Điện thoại mẫu", status: "in_stock" }] }), { status: 201 });
    return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "inventory.serial.create")!;
  const resolution = await resolveReferences(req, operation, { productId: "Điện thoại mẫu", sku: "DT-01-128", serialNumber: "IMEI-QA" } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values).toMatchObject({ productId, sku: "DT-01-128", productName: "Điện thoại mẫu", serialNumber: "IMEI-QA", targetBranch: req.user.branchId });
  expect(JSON.stringify(resolution.labels)).not.toContain(productId);
  await callOperation(req, operation, resolution.values as any);
  const writeCall = fetcher.mock.calls.find(([url, init]) => (url as URL).pathname === "/api/v1/inventory/serials" && init?.method === "POST")!;
  expect(JSON.parse(writeCall[1].body)).toMatchObject({ productId, sku: "DT-01-128", productName: "Điện thoại mẫu", serialNumber: "IMEI-QA" });
  expect((writeCall[1].headers as Record<string, string>)["x-branch-id"]).toBe(req.user.branchId);
  expect((writeCall[0] as URL).searchParams.get("branchId")).toBe(req.user.branchId);
});

it("updates an inventory count row by count code and SKU with a sanitized result", async () => {
  const countId = "507f1f77bcf86cd799439082";
  const itemId = "507f1f77bcf86cd799439083";
  const count = { _id: countId, countCode: "KK-2026-001", status: "counting", branchId: req.user.branchId, items: [{ _id: itemId, sku: "DT-01", productName: "Điện thoại", trackingMode: "quantity", systemQuantity: 10, countedQuantity: 10, quantityDelta: 0, note: "" }] };
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/inventory/counts" && init?.method !== "PATCH") return new Response(JSON.stringify({ status: "success", data: [{ _id: countId, countCode: count.countCode, status: count.status, branchId: count.branchId }] }), { status: 200 });
    if (input.pathname === `/api/v1/inventory/counts/${countId}` && init?.method !== "PATCH") return new Response(JSON.stringify({ status: "success", data: count }), { status: 200 });
    if (input.pathname === `/api/v1/inventory/counts/${countId}/items/${itemId}` && init?.method === "PATCH") return new Response(JSON.stringify({ status: "success", data: { ...count, items: [{ ...count.items[0], countedQuantity: 12, quantityDelta: 2, note: "Đếm lại" }], internalAuditId: "hidden-audit-id" } }), { status: 200 });
    return new Response(JSON.stringify({ status: "success", data: [] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "inventory.count.item.update")!;
  const resolution = await resolveReferences(req, operation, { path_id: "KK-2026-001", path_itemId: "DT-01", countedQuantity: 12, note: "Đếm lại" } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values).toMatchObject({ path_id: countId, path_itemId: itemId });
  expect(JSON.stringify(resolution.labels)).not.toContain(countId);
  expect(JSON.stringify(resolution.labels)).not.toContain(itemId);
  const result = await callOperation(req, operation, resolution.values as any);
  expect(result.data).toEqual({ countCode: "KK-2026-001", status: "counting", updatedItem: { sku: "DT-01", productName: "Điện thoại", countedQuantity: 12, quantityDelta: 2, note: "Đếm lại" } });
  expect(JSON.stringify(result)).not.toContain("hidden-audit-id");
  const write = fetcher.mock.calls.find(([url, init]) => (url as URL).pathname.endsWith(`/items/${itemId}`) && init?.method === "PATCH")!;
  expect((write[0] as URL).searchParams.get("branchId")).toBe(req.user.branchId);
  expect((write[1].headers as Record<string, string>)["x-branch-id"]).toBe(req.user.branchId);
  expect(JSON.parse(String(write[1].body))).toEqual({ countedQuantity: 12, note: "Đếm lại" });
});

it("requires count data and blocks manual quantities for serial-tracked count rows", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "success", data: { items: [{ _id: "507f1f77bcf86cd799439084", sku: "SN-01", trackingMode: "serial" }] } }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "inventory.count.item.update")!;
  await expect(callOperation(req, operation, { path_id: "507f1f77bcf86cd799439082", path_itemId: "507f1f77bcf86cd799439084" } as any)).rejects.toThrow("Nêu số lượng đếm hoặc ghi chú");
  expect(fetcher).not.toHaveBeenCalled();
  await expect(callOperation(req, operation, { path_id: "507f1f77bcf86cd799439082", path_itemId: "507f1f77bcf86cd799439084", countedQuantity: 2 } as any)).rejects.toThrow("phải đếm bằng cách quét");
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0][0].pathname).toBe("/api/v1/inventory/counts/507f1f77bcf86cd799439082");
});

it("resolves a serial transition by visible IMEI and sets the audit event server-side", async () => {
  const serialId = "507f1f77bcf86cd799439075";
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/inventory/serials" && init?.method !== "POST") return new Response(JSON.stringify({ success: true, data: { items: [{ _id: serialId, serialNumber: "IMEI-LOST-01", internalBarcode: "BC-LOST-01", sku: "DT-01", productName: "Điện thoại", status: "in_stock", branchId: req.user.branchId }], total: 1 } }), { status: 200 });
    if (input.pathname === `/api/v1/inventory/serials/${serialId}/transition`) return new Response(JSON.stringify({ success: true, data: { serialNumber: "IMEI-LOST-01", status: "lost" } }), { status: 200 });
    return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "inventory.serial.transition")!;
  const resolution = await resolveReferences(req, operation, { path_id: "IMEI-LOST-01", toStatus: "lost", reason: "Không thấy khi kiểm kê" } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.path_id).toBe(serialId);
  await callOperation(req, operation, resolution.values as any);
  const writeCall = fetcher.mock.calls.find(([url, init]) => (url as URL).pathname.endsWith("/transition") && init?.method === "POST")!;
  expect(JSON.parse(writeCall[1].body)).toEqual({ toStatus: "lost", reason: "Không thấy khi kiểm kê", eventType: "assistant_status_change" });
});

it("creates a serial transfer by barcode and uses the receiving branch default warehouse", async () => {
  const serialId = "507f1f77bcf86cd799439076";
  const targetBranchId = "507f1f77bcf86cd799439077";
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/inventory/serials" && input.searchParams.has("serial")) return new Response(JSON.stringify({ success: true, data: { items: [], total: 0 } }), { status: 200 });
    if (input.pathname === "/api/v1/inventory/serials" && input.searchParams.has("barcodes")) return new Response(JSON.stringify({ success: true, data: { items: [{ _id: serialId, serialNumber: "IMEI-MOVE-01", internalBarcode: "BC-MOVE-01", sku: "DT-01", productName: "Điện thoại", status: "in_stock", branchId: req.user.branchId }], total: 1 } }), { status: 200 });
    if (input.pathname === "/api/v1/auth/branches") return new Response(JSON.stringify({ success: true, data: [{ _id: targetBranchId, name: "Chi nhánh Đà Nẵng" }] }), { status: 200 });
    if (input.pathname === `/api/v1/inventory/serials/${serialId}/transfer/request` && init?.method === "POST") return new Response(JSON.stringify({ success: true, data: { _id: serialId, serialNumber: "IMEI-MOVE-01", sku: "DT-01", productName: "Điện thoại", status: "in_transit", branchId: req.user.branchId, transferToBranchId: targetBranchId, currentDocumentId: "internal-transfer-id" } }), { status: 201 });
    return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "inventory.serial.transfer.request")!;
  const resolution = await resolveReferences(req, operation, { path_id: "BC-MOVE-01", toBranch: "Chi nhánh Đà Nẵng", reason: "Bổ sung hàng cho chi nhánh" } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values).toMatchObject({ path_id: serialId, toBranch: targetBranchId });
  expect(JSON.stringify(resolution.labels)).not.toContain(serialId);
  const result = await callOperation(req, operation, resolution.values as any);
  expect(result.data).toEqual({ serialNumber: "IMEI-MOVE-01", sku: "DT-01", productName: "Điện thoại", status: "in_transit" });
  expect(JSON.stringify(result)).not.toContain("internal-transfer-id");
  const write = fetcher.mock.calls.find(([url, init]) => (url as URL).pathname.endsWith("/transfer/request") && init?.method === "POST")!;
  expect((write[0] as URL).searchParams.get("branchId")).toBe(req.user.branchId);
  expect((write[1].headers as Record<string, string>)["x-branch-id"]).toBe(req.user.branchId);
  expect(JSON.parse(String(write[1].body))).toEqual({ toBranchId: targetBranchId, reason: "Bổ sung hàng cho chi nhánh" });
  const barcodeLookup = fetcher.mock.calls.find(([url]) => (url as URL).searchParams.has("barcodes"))?.[0] as URL | undefined;
  expect(barcodeLookup?.searchParams.get("barcodes")).toBe("BC-MOVE-01");
  expect(barcodeLookup?.searchParams.has("serial")).toBe(false);
});

it("moves a serial between warehouses in the selected branch by visible names", async () => {
  const branchId = "507f1f77bcf86cd799439101";
  const serialId = "507f1f77bcf86cd799439102";
  const warehouseId = "507f1f77bcf86cd799439103";
  const adminReq = { ...req, user: { ...req.user, role: "admin", branchId: undefined } } as any;
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/auth/branches") {
      return new Response(JSON.stringify({ success: true, data: [{ _id: branchId, name: "Chi nhánh Bắc" }] }), { status: 200 });
    }
    if (input.pathname === "/api/v1/inventory/serials" && init?.method !== "POST") {
      return new Response(JSON.stringify({ success: true, data: { items: [{
        _id: serialId, serialNumber: "IMEI-LOCAL-01", sku: "PHONE-01", productName: "Điện thoại",
        status: "in_stock", branchId, companyCode: "TEST",
      }], total: 1 } }), { status: 200 });
    }
    if (input.pathname === "/api/v1/inventory/warehouses") {
      return new Response(JSON.stringify({ success: true, data: [
        { _id: warehouseId, branchId, code: "KHO-B", name: "Kho Bắc", kind: "selling", isActive: true },
        { _id: "507f1f77bcf86cd799439104", branchId: "507f1f77bcf86cd799439105", code: "KHO-X", name: "Kho ngoài chi nhánh", kind: "selling", isActive: true },
        { _id: "507f1f77bcf86cd799439106", branchId, code: "KHO-T", name: "Kho trung chuyển", kind: "transit", isActive: true },
      ] }), { status: 200 });
    }
    if (input.pathname === `/api/v1/inventory/serials/${serialId}/transfer` && init?.method === "POST") {
      return new Response(JSON.stringify({ success: true, data: {
        _id: serialId, branchId, serialNumber: "IMEI-LOCAL-01", sku: "PHONE-01", productName: "Điện thoại",
        status: "in_stock", currentDocumentId: "PRIVATE-DOCUMENT", companyCode: "TEST",
      } }), { status: 200 });
    }
    return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);

  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "inventory.serial.transfer.local")!;
  const resolution = await resolveReferences(adminReq, operation, {
    targetBranch: "Chi nhánh Bắc", path_id: "IMEI-LOCAL-01", toWarehouseId: "Kho Bắc", reason: "Sắp xếp lại tồn kho",
  } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values).toMatchObject({ targetBranch: branchId, path_id: serialId, toWarehouseId: warehouseId });
  expect(JSON.stringify(resolution.labels)).not.toContain(serialId);

  const result = await callOperation(adminReq, operation, resolution.values as any);
  expect(result.data).toEqual({ serialNumber: "IMEI-LOCAL-01", sku: "PHONE-01", productName: "Điện thoại", status: "in_stock" });
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE|507f1f77bcf86cd79943910[23456]/);
  const write = fetcher.mock.calls.find(([url, init]) => (url as URL).pathname.endsWith("/transfer") && init?.method === "POST")!;
  expect((write[0] as URL).searchParams.get("branchId")).toBe(branchId);
  expect((write[1].headers as Record<string, string>)["x-branch-id"]).toBe(branchId);
  expect(JSON.parse(String(write[1].body))).toEqual({ toWarehouseId: warehouseId, reason: "Sắp xếp lại tồn kho", toBranchId: branchId });
  const warehouseLookup = fetcher.mock.calls.find(([url]) => (url as URL).pathname === "/api/v1/inventory/warehouses")?.[0] as URL | undefined;
  expect(warehouseLookup?.searchParams.get("branchId")).toBe(branchId);
});

it("allows a receiving-branch user to resolve an incoming serial and accept only that serial", async () => {
  const sourceBranchId = req.user.branchId;
  const receivingBranchId = "507f1f77bcf86cd799439079";
  const serialId = "507f1f77bcf86cd799439080";
  const receivingReq = { ...req, user: { ...req.user, branchId: receivingBranchId } } as any;
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/inventory/serials" && init?.method !== "POST") return new Response(JSON.stringify({ success: true, data: { items: [{ _id: serialId, serialNumber: "IMEI-INCOMING-01", internalBarcode: "BC-IN-01", sku: "DT-02", productName: "Điện thoại nhận", status: "in_transit", branchId: sourceBranchId, transferToBranchId: receivingBranchId }], total: 1 } }), { status: 200 });
    if (input.pathname === `/api/v1/inventory/serials/${serialId}/transfer/accept` && init?.method === "POST") return new Response(JSON.stringify({ success: true, data: { _id: serialId, serialNumber: "IMEI-INCOMING-01", sku: "DT-02", productName: "Điện thoại nhận", status: "in_stock", branchId: receivingBranchId, warehouseId: "internal-warehouse-id" } }), { status: 200 });
    return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "inventory.serial.transfer.accept")!;
  const resolution = await resolveReferences(receivingReq, operation, { path_id: "IMEI-INCOMING-01" } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.path_id).toBe(serialId);
  const result = await callOperation(receivingReq, operation, resolution.values as any);
  const write = fetcher.mock.calls.find(([url, init]) => (url as URL).pathname.endsWith("/transfer/accept") && init?.method === "POST")!;
  expect((write[0] as URL).searchParams.get("branchId")).toBe(receivingBranchId);
  expect((write[1].headers as Record<string, string>)["x-branch-id"]).toBe(receivingBranchId);
  expect(JSON.parse(String(write[1].body))).toEqual({});
  expect(result.data).toEqual({ serialNumber: "IMEI-INCOMING-01", sku: "DT-02", productName: "Điện thoại nhận", status: "in_stock" });
  expect(JSON.stringify(result)).not.toContain("internal-warehouse-id");
});

it("resolves serial cancellation by IMEI and sends the required reason", async () => {
  const serialId = "507f1f77bcf86cd799439081";
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/inventory/serials" && init?.method !== "POST") return new Response(JSON.stringify({ success: true, data: { items: [{ _id: serialId, serialNumber: "IMEI-CANCEL-01", sku: "DT-03", productName: "Điện thoại gửi", status: "in_transit", branchId: req.user.branchId }], total: 1 } }), { status: 200 });
    if (input.pathname === `/api/v1/inventory/serials/${serialId}/transfer/cancel` && init?.method === "POST") return new Response(JSON.stringify({ success: true, data: { _id: serialId, serialNumber: "IMEI-CANCEL-01", sku: "DT-03", productName: "Điện thoại gửi", status: "in_stock", currentDocumentId: "hidden-document" } }), { status: 200 });
    return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "inventory.serial.transfer.cancel")!;
  const resolution = await resolveReferences(req, operation, { path_id: "IMEI-CANCEL-01", reason: "Gửi nhầm chi nhánh" } as any);
  expect(resolution.errors).toEqual([]);
  const result = await callOperation(req, operation, resolution.values as any);
  const write = fetcher.mock.calls.find(([url, init]) => (url as URL).pathname.endsWith("/transfer/cancel") && init?.method === "POST")!;
  expect(JSON.parse(String(write[1].body))).toEqual({ reason: "Gửi nhầm chi nhánh" });
  expect(JSON.stringify(result)).not.toContain("hidden-document");
});

it("resolves a branch-scoped serial by visible IMEI for a branchless admin", async () => {
  const branchId = "507f1f77bcf86cd799439073";
  const serialId = "507f1f77bcf86cd799439074";
  const branchList = ASSISTANT_OPERATIONS.find(item => item.id === "branch.list")!;
  const fetcher = vi.fn().mockImplementation(async (input: URL) => {
    if (input.pathname === `/api/v1${branchList.path}`) return new Response(JSON.stringify({ success: true, data: [{ _id: branchId, name: "Chi nhánh Đà Nẵng" }] }), { status: 200 });
    if (input.pathname === "/api/v1/inventory/serials") return new Response(JSON.stringify({ success: true, data: { items: [{ _id: serialId, serialNumber: "IMEI-ĐN-01", internalBarcode: "BC-01", sku: "DT-01", productName: "Điện thoại", status: "in_stock", branchId }], total: 1 } }), { status: 200 });
    if (input.pathname === `/api/v1/inventory/serials/${serialId}`) return new Response(JSON.stringify({ success: true, data: { _id: serialId, serialNumber: "IMEI-ĐN-01", internalBarcode: "BC-01", sku: "DT-01", productName: "Điện thoại", status: "in_stock", branchId } }), { status: 200 });
    return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const adminReq = { ...req, user: { ...req.user, role: "admin", branchId: undefined } } as any;
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "inventory.serial.detail")!;
  const resolution = await resolveReferences(adminReq, operation, { targetBranch: "Chi nhánh Đà Nẵng", path_id: "IMEI-ĐN-01" } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values).toMatchObject({ targetBranch: branchId, path_id: serialId });
  await callOperation(adminReq, operation, resolution.values as any);
  const detailCall = fetcher.mock.calls.find(([url]) => (url as URL).pathname === `/api/v1/inventory/serials/${serialId}`)!;
  expect((detailCall[1].headers as Record<string, string>)["x-branch-id"]).toBe(branchId);
  expect((detailCall[0] as URL).searchParams.get("branchId")).toBe(branchId);
  expect(JSON.stringify(resolution.labels)).not.toContain(serialId);
});

it("rejects ambiguous serial registration payloads before calling the inventory API", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "inventory.serial.create")!;
  await expect(callOperation(req, operation, { serialNumber: "SN-1", serialNumbers: JSON.stringify(["SN-1"]) } as any)).rejects.toThrow("không dùng cả hai");
  await expect(callOperation(req, operation, { serialNumbers: JSON.stringify(["SN-1"]), internalBarcodes: JSON.stringify(["BC-1", "BC-2"]) } as any)).rejects.toThrow("cùng số lượng");
  await expect(callOperation(req, operation, { serialNumbers: JSON.stringify(Array.from({ length: 101 }, (_, index) => `SN-${index}`)) } as any)).rejects.toThrow("1 đến 100");
  expect(fetcher).not.toHaveBeenCalled();
});

it("loads and preserves payroll formula fields while pinning the current version", async () => {
  const formulaId = "507f1f77bcf86cd799439081";
  const formula = {
    _id: formulaId, code: "OVERTIME", name: "Công thức tăng ca", description: "Tăng ca ngày thường",
    resultBucket: "bonus", priority: 3, effectiveFrom: "2026-01-01T00:00:00.000Z", status: "active", version: 7,
    conditions: { combinator: "and", items: [] }, expression: { type: "constant", value: 0 }, rounding: { mode: "nearest", unit: 1000 },
  };
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/payroll/formulas" && init?.method !== "PATCH") return new Response(JSON.stringify({ status: "success", data: [formula] }), { status: 200 });
    return new Response(JSON.stringify({ status: "success", data: { ...formula, priority: 9 } }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "payroll.formula.update")!;
  const resolution = await resolveReferences(req, operation, { path_id: "Công thức tăng ca", priority: 9 } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values).toMatchObject({ path_id: formulaId, expectedVersion: 7 });
  const result = await callOperation(req, operation, resolution.values as any);
  expect(result.data).toMatchObject({ priority: 9 });
  const update = fetcher.mock.calls.find(([, init]) => init?.method === "PATCH")!;
  expect((update[0] as URL).pathname).toBe(`/api/v1/payroll/formulas/${formulaId}`);
  expect(JSON.parse(String(update[1].body))).toMatchObject({
    code: "OVERTIME", name: "Công thức tăng ca", resultBucket: "bonus", priority: 9,
    conditions: { combinator: "and", items: [] }, expression: { type: "constant", value: 0 },
    rounding: { mode: "nearest", unit: 1000 }, expectedVersion: 7,
  });
  expect(JSON.stringify(resolution.labels)).not.toContain(formulaId);
});

it("reads the current payroll publication schedule version before saving it", async () => {
  const fetcher = vi.fn().mockImplementation(async (_input: URL, init?: RequestInit) => init?.method === "PUT"
    ? new Response(JSON.stringify({ status: "success", data: { enabled: true, day: 20, hour: 8, minute: 30, periodOffset: -1, version: 5 } }), { status: 200 })
    : new Response(JSON.stringify({ status: "success", data: { enabled: false, day: 15, hour: 9, minute: 0, periodOffset: 0, version: 4 } }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "payroll.reconciliation.schedule.update")!;
  const values = { enabled: true, day: 20, hour: 8, minute: 30, periodOffset: -1 };
  const resolution = await resolveReferences(req, operation, values as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.version).toBe(4);
  await callOperation(req, operation, resolution.values as any);
  const update = fetcher.mock.calls.find(([, init]) => init?.method === "PUT")!;
  expect(JSON.parse(String(update[1].body))).toEqual({ ...values, version: 4 });
});

it("finds archived custom fields by name before restoring them", async () => {
  const fieldId = "507f1f77bcf86cd799439091";
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/student-management/custom-fields/students" && init?.method !== "POST") {
      const data = input.searchParams.get("includeArchived") === "true"
        ? [{ _id: fieldId, label: "Số chứng chỉ", key: "soChungChi", type: "text", isArchived: true, tenantId: "TEST" }]
        : [];
      return new Response(JSON.stringify({ success: true, data }), { status: 200 });
    }
    return new Response(JSON.stringify({ success: true, data: { label: "Số chứng chỉ", key: "soChungChi", type: "text", isArchived: false } }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "student.custom-field.restore")!;
  const resolution = await resolveReferences(req, operation, { path_moduleKey: "students", path_id: "Số chứng chỉ" } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.path_id).toBe(fieldId);
  await callOperation(req, operation, resolution.values as any);
  const listCall = fetcher.mock.calls.find(([url]) => (url as URL).pathname === "/api/v1/student-management/custom-fields/students" && (url as URL).searchParams.get("includeArchived") === "true")!;
  expect((listCall[0] as URL).searchParams.get("includeArchived")).toBe("true");
  const restoreCall = fetcher.mock.calls.find(([, init]) => init?.method === "POST")!;
  expect((restoreCall[0] as URL).pathname).toBe(`/api/v1/student-management/custom-fields/students/${fieldId}/restore`);
  expect(JSON.stringify(resolution.labels)).not.toContain(fieldId);
});

it("preserves financial plan values and injects its current version for the selected branch", async () => {
  const currentPlan = {
    month: "2026-10", rent: 12000000, payroll: 45000000, otherFixed: 3000000,
    expectedUnitPrice: 900000, expectedUnitCost: 500000, variableCostPerUnit: 15000,
    expectedCommissionPerUnit: 8000, salesMix: [], version: 6,
  };
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/finance/reporting/breakeven" && init?.method === "GET") {
      return new Response(JSON.stringify({ success: true, data: { month: "2026-10", plan: currentPlan, configured: true } }), { status: 200 });
    }
    return new Response(JSON.stringify({ success: true, data: { ...currentPlan, rent: 15000000, version: 7 } }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "finance.reporting.plan.update")!;
  const values = { targetBranch: req.user.branchId, month: "2026-10", rent: 15000000 };
  const resolution = await resolveReferences(req, operation, values as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values).toMatchObject({ targetBranch: req.user.branchId, month: "2026-10", version: 6 });
  await callOperation(req, operation, resolution.values as any);
  const readCall = fetcher.mock.calls.find(([url]) => (url as URL).pathname === "/api/v1/finance/reporting/breakeven")!;
  expect((readCall[0] as URL).searchParams.get("month")).toBe("2026-10");
  expect((readCall[0] as URL).searchParams.get("branchId")).toBe(req.user.branchId);
  const writeCall = fetcher.mock.calls.find(([, init]) => init?.method === "PUT")!;
  expect((writeCall[0] as URL).searchParams.get("branchId")).toBe(req.user.branchId);
  expect(JSON.parse(String(writeCall[1].body))).toEqual({ ...currentPlan, rent: 15000000 });
});

it("requires a branch selection for branchless administrators using finance reporting", async () => {
  const adminReq = { ...req, user: { ...req.user, role: "admin", branchId: undefined } } as any;
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "finance.reporting.breakeven")!;
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  await expect(callOperation(adminReq, operation, { query_month: "2026-10" } as any)).rejects.toThrow("Cần chọn chi nhánh tài chính");
  expect(fetcher).not.toHaveBeenCalled();
});

it("resolves a payroll adjustment by employee and adjustment details within its period and branch", async () => {
  const adjustmentId = "507f1f77bcf86cd799439099";
  const branchId = req.user.branchId;
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/payroll/periods/2026-10/adjustments" && init?.method === "GET") {
      return new Response(JSON.stringify({ status: "success", data: [{
        _id: adjustmentId, employeeName: "\u0110\u1ED7 \u0110\u1EE9c Chung", kind: "bonus", amount: 100000,
        reason: "Th\u01B0\u1EDFng KPI", status: "pending", createdAt: "2026-10-30T01:00:00.000Z", branchId,
      }] }), { status: 200 });
    }
    if (input.pathname === `/api/v1/payroll/periods/2026-10/adjustments/${adjustmentId}/approve` && init?.method === "POST") {
      return new Response(JSON.stringify({ status: "success", data: {
        _id: adjustmentId, employeeName: "\u0110\u1ED7 \u0110\u1EE9c Chung", kind: "bonus", amount: 100000, reason: "Th\u01B0\u1EDFng KPI", status: "approved",
      } }), { status: 200 });
    }
    return new Response(JSON.stringify({ status: "success", data: [] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "payroll.adjustment.approve")!;
  const resolution = await resolveReferences(req, operation, {
    path_periodKey: "2026-10", path_adjustmentId: "\u0110\u1ED7 \u0110\u1EE9c Chung \u00B7 Th\u01B0\u1EDFng \u00B7 100.000 \u20AB \u00B7 Th\u01B0\u1EDFng KPI", targetBranch: branchId,
  } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.path_adjustmentId).toBe(adjustmentId);
  await callOperation(req, operation, resolution.values as any);
  const approveCall = fetcher.mock.calls.find(([, init]) => init?.method === "POST")!;
  expect((approveCall[0] as URL).pathname).toBe(`/api/v1/payroll/periods/2026-10/adjustments/${adjustmentId}/approve`);
  expect((approveCall[0] as URL).searchParams.get("branchId")).toBe(branchId);
  expect((approveCall[1].headers as Record<string, string>)["x-branch-id"]).toBe(branchId);
});

it("creates a payroll adjustment for an employee selected by name in the selected branch", async () => {
  const employeeId = "507f1f77bcf86cd799439098";
  const branchId = req.user.branchId;
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/auth/users") return new Response(JSON.stringify({ status: "success", data: [{
      _id: employeeId, displayName: "\u0110\u1ED7 \u0110\u1EE9c Chung", email: "chung@example.test", branchId,
    }] }), { status: 200 });
    if (input.pathname === "/api/v1/payroll/periods/2026-10/adjustments" && init?.method === "POST") {
      return new Response(JSON.stringify({ status: "success", data: {
        employeeName: "\u0110\u1ED7 \u0110\u1EE9c Chung", kind: "advance", amount: 1500000, reason: "T\u1EA1m \u1EE9ng th\u00E1ng 10", status: "pending",
      } }), { status: 201 });
    }
    return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "payroll.adjustment.create")!;
  const resolution = await resolveReferences(req, operation, {
    path_periodKey: "2026-10", targetBranch: branchId, employeeId: "\u0110\u1ED7 \u0110\u1EE9c Chung",
    kind: "advance", amount: 1500000, reason: "T\u1EA1m \u1EE9ng th\u00E1ng 10",
    advanceDetails: JSON.stringify({ date: "2026-10-30", method: "transfer", note: "" }),
  } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.employeeId).toBe(employeeId);
  await callOperation(req, operation, resolution.values as any);
  const employeeLookup = fetcher.mock.calls.find(([input]) => (input as URL).pathname === "/api/v1/auth/users")!;
  expect((employeeLookup[0] as URL).searchParams.get("branchId")).toBe(branchId);
  const createCall = fetcher.mock.calls.find(([, init]) => init?.method === "POST")!;
  expect((createCall[0] as URL).searchParams.get("branchId")).toBe(branchId);
  expect(JSON.parse(String(createCall[1].body))).toMatchObject({
    employeeId, kind: "advance", amount: 1500000,
    advanceDetails: { date: "2026-10-30", method: "transfer", note: "" },
  });
  expect(JSON.stringify(resolution.labels)).not.toContain(employeeId);
  await expect(callOperation(req, operation, { kind: "advance", amount: 0 } as any)).rejects.toThrow("số nguyên dương");
});

it("pauses only the signed-in cashier's open shift on the current POS device", async () => {
  const shiftId = "507f1f77bcf86cd799439199";
  const deviceId = "terminal-current";
  const branchId = req.user.branchId;
  const request = { ...req, headers: { ...req.headers, "x-device-id": deviceId } } as any;
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/retail/shifts/current") return new Response(JSON.stringify({ success: true, data: {
      _id: shiftId, shiftCode: "POS-012", cashierName: "Đỗ Đức Chung", status: "open", terminalId: deviceId,
    } }), { status: 200 });
    if (input.pathname === `/api/v1/retail/shifts/${shiftId}/pause` && init?.method === "POST") return new Response(JSON.stringify({ success: true, data: null }), { status: 200 });
    return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "retail.shift.pause")!;
  const resolution = await resolveReferences(request, operation, {} as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.path_id).toBe(shiftId);
  expect(resolution.labels.path_id).toBe("POS-012");
  const currentCall = fetcher.mock.calls[0][0] as URL;
  expect(currentCall.searchParams.get("terminalId")).toBe(deviceId);
  expect(currentCall.searchParams.get("branchId")).toBe(branchId);
  await callOperation(request, operation, resolution.values as any);
  const pauseCall = fetcher.mock.calls.at(-1)!;
  expect((pauseCall[0] as URL).pathname).toBe(`/api/v1/retail/shifts/${shiftId}/pause`);
  expect((pauseCall[0] as URL).searchParams.get("terminalId")).toBe(deviceId);
});

it("resumes the signed-in cashier's paused shift on this POS device with hidden server-resolved terminal fields", async () => {
  const shiftId = "507f1f77bcf86cd799439198";
  const deviceId = "terminal-current";
  const request = { ...req, headers: { ...req.headers, "x-device-id": deviceId } } as any;
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/retail/shifts/current") return new Response(JSON.stringify({ success: true, data: {
      _id: shiftId, shiftCode: "POS-013", cashierName: "Đỗ Đức Chung", status: "open",
    } }), { status: 200 });
    if (input.pathname === `/api/v1/retail/shifts/${shiftId}/resume` && init?.method === "POST") return new Response(JSON.stringify({ success: true, data: {
      shiftCode: "POS-013", cashierName: "Đỗ Đức Chung", status: "open", businessDate: "2026-10-30",
    } }), { status: 200 });
    return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "retail.shift.resume")!;
  const resolution = await resolveReferences(request, operation, {} as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values).toMatchObject({ path_id: shiftId, terminalId: deviceId, expectedTerminalId: "" });
  expect(operation.fields.some(field => field.source === "path" || ["terminalId", "expectedTerminalId"].includes(field.apiKey || ""))).toBe(false);
  await callOperation(request, operation, resolution.values as any);
  const resumeCall = fetcher.mock.calls.at(-1)!;
  expect((resumeCall[0] as URL).pathname).toBe(`/api/v1/retail/shifts/${shiftId}/resume`);
  expect(JSON.parse(String(resumeCall[1].body))).toEqual({ terminalId: deviceId, expectedTerminalId: "" });
});

it("refuses to pause a shift attached to a different device", async () => {
  const request = { ...req, headers: { ...req.headers, "x-device-id": "terminal-current" } } as any;
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: {
    _id: "507f1f77bcf86cd799439197", shiftCode: "POS-014", status: "open", terminalId: "terminal-other",
  } }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "retail.shift.pause")!;
  const resolution = await resolveReferences(request, operation, {} as any);
  expect(resolution.errors.join(" ")).toContain("đang hoạt động trên thiết bị khác");
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("creates a quick POS customer with server-owned source and hides phone and internal IDs from the reply", async () => {
  const phone = "0987654321";
  const customerId = "507f1f77bcf86cd799439196";
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: {
    _id: customerId, customerId, customerCode: "KH-TEST-000123", name: "Nguyễn An", phone,
    type: "regular", status: "active", source: "pos", normalizedPhone: phone, companyCode: "TEST",
  } }), { status: 201 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "customer.quick.create")!;

  const result = await callOperation(req, operation, { name: "Nguyễn An", phone } as any);

  const [url, init] = fetcher.mock.calls[0] as [URL, RequestInit];
  expect(url.pathname).toBe("/api/v1/customers/quick");
  expect(url.searchParams.get("companyCode")).toBe("TEST");
  expect(JSON.parse(String(init.body))).toEqual({ name: "Nguyễn An", phone });
  const reply = formatAssistantResult(operation, result.data);
  expect(reply).toContain("KH-TEST-000123");
  expect(reply).toContain("Nguyễn An");
  expect(reply).not.toContain(phone);
  expect(reply).not.toContain(customerId);
});

it("creates a disabled marketing email draft with a fixed audience and hides the HTML body", async () => {
  const emailHtml = "<p>Ưu đãi lễ hội cho khách hàng</p>";
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: {
    _id: "507f1f77bcf86cd799439195", name: "Ưu đãi cuối năm", runDate: "2026-12-20", enabled: false,
    channels: ["email"], targetTierCodes: [], subject: "Cảm ơn quý khách", html: emailHtml, createdBy: "actor",
  } }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.holiday-campaign.create-draft")!;

  const result = await callOperation(req, operation, {
    name: "Ưu đãi cuối năm", runDate: "2026-12-20", subject: "Cảm ơn quý khách", html: emailHtml,
    enabled: true, targetTierCodes: ["gold"], channels: ["sms"], companyCode: "OTHER",
  } as any);

  const [url, init] = fetcher.mock.calls[0] as [URL, RequestInit];
  expect(url.pathname).toBe("/api/v1/marketing/campaigns");
  expect(url.searchParams.get("companyCode")).toBe("TEST");
  expect(JSON.parse(String(init.body))).toEqual({
    name: "Ưu đãi cuối năm", runDate: "2026-12-20", subject: "Cảm ơn quý khách", html: emailHtml,
    enabled: false, channels: ["email"], targetTierCodes: [],
  });
  const reply = formatAssistantResult(operation, result.data);
  expect(reply).toContain("Ưu đãi cuối năm");
  expect(reply).toContain("Cảm ơn quý khách");
  expect(reply).not.toContain(emailHtml);
  expect(reply).not.toContain("actor");
});

it("clears only the authenticated company's customer-service scenario data", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
    status: "success", message: "Đã xóa kịch bản chăm sóc khách hàng khỏi RAG.", companyCode: "TEST",
  }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "company-knowledge.scenario.clear")!;

  const result = await callOperation(req, operation, { companyCode: "OTHER" } as any);

  const [url, init] = fetcher.mock.calls[0] as [URL, RequestInit];
  expect(url.pathname).toBe("/api/v1/gemini/customer-service-scenario");
  expect(url.searchParams.get("companyCode")).toBe("TEST");
  expect(init.method).toBe("DELETE");
  expect(init.body).toBeUndefined();
  const reply = formatAssistantResult(operation, result);
  expect(reply).toContain("Đã xóa kịch bản chăm sóc khách hàng");
  expect(reply).not.toContain("OTHER");
});

it("creates workers in the authenticated company and branch and redacts phone numbers from skipped rows", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
    importedCount: 1, skippedCount: 1,
    errors: [{ row: 2, name: "Trần Thị B", phone: "0987654321", reason: "Số điện thoại đã tồn tại trong hệ thống." }],
    importedWorkers: [{ workerId: "507f1f77bcf86cd799439194", partnerCode: "PARTNER-1" }],
  }), { status: 201 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "worker.bulk.create")!;
  const workers = [
    { fullName: "Nguyễn An", phone: "0912345678", status: "active" },
    { fullName: "Trần Thị B", phone: "0987654321" },
  ];

  const result = await callOperation(req, operation, { workers: JSON.stringify(workers), companyCode: "OTHER", branchId: "OTHER" } as any);

  const [url, init] = fetcher.mock.calls[0] as [URL, RequestInit];
  expect(url.pathname).toBe("/api/v1/worker-management/workers/bulk");
  expect(url.searchParams.get("companyCode")).toBe("TEST");
  expect(url.searchParams.get("branchId")).toBe(req.user.branchId);
  expect(JSON.parse(String(init.body))).toEqual({ workers });
  expect(result).toEqual({ importedCount: 1, skippedCount: 1, errors: [{ row: 2, name: "Trần Thị B", reason: "Số điện thoại đã tồn tại trong hệ thống." }] });
  const reply = formatAssistantResult(operation, result);
  expect(reply).toContain("1");
  expect(reply).toContain("Trần Thị B");
  expect(reply).not.toContain("0987654321");
  expect(reply).not.toContain("507f1f77bcf86cd799439194");
});

it("updates a worker by exact name, preserves omitted name and status, and hides contact details", async () => {
  const workerId = "507f1f77bcf86cd799439195";
  const existingWorker = {
    _id: workerId,
    companyCode: "TEST",
    branchId: req.user.branchId,
    fullName: "Nguyễn An",
    phone: "0912345678",
    email: "old@example.test",
    status: "inactive",
    laborType: "seasonal",
    registrationDate: "2026-01-01",
    idCard: "012345678901",
  };
  const fetcher = vi.fn().mockImplementation(async (input: URL) => {
    if (input.pathname === "/api/v1/worker-management/workers") {
      return new Response(JSON.stringify({ success: true, workers: [existingWorker] }), { status: 200 });
    }
    return new Response(JSON.stringify({ success: true, worker: {
      ...existingWorker,
      email: "new@example.test",
      updatedAt: "2026-10-30T00:00:00.000Z",
    } }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "worker.update")!;
  const resolution = await resolveReferences(req, operation, { path_id: "Nguyễn An", email: "new@example.test" } as any);

  expect(resolution.errors).toEqual([]);
  expect(resolution.values).toMatchObject({ path_id: workerId, fullName: "Nguyễn An", status: "inactive", email: "new@example.test" });
  expect(resolution.labels.path_id).toContain("Nguyễn An");
  expect(JSON.stringify(resolution.labels)).not.toContain(workerId);
  const result = await callOperation(req, operation, resolution.values as any);
  const patchCall = fetcher.mock.calls.find(([input, init]) => (input as URL).pathname === `/api/v1/worker-management/workers/${workerId}` && init?.method === "PATCH");
  expect(patchCall).toBeDefined();
  const [url, init] = patchCall as [URL, RequestInit];
  expect(url.searchParams.get("companyCode")).toBe("TEST");
  expect(url.searchParams.get("branchId")).toBe(req.user.branchId);
  expect(JSON.parse(String(init.body))).toEqual({ fullName: "Nguyễn An", status: "inactive", email: "new@example.test" });
  expect(result).toEqual({ fullName: "Nguyễn An", status: "inactive", laborType: "seasonal", registrationDate: "2026-01-01" });
  expect(JSON.stringify(result)).not.toMatch(/0912345678|old@example\.test|new@example\.test|012345678901|507f1f77bcf86cd799439195/);
  const reply = formatAssistantResult(operation, result);
  expect(reply).toContain("Nguyễn An");
  expect(reply).toContain("inactive");
  expect(reply).not.toMatch(/0912345678|old@example\.test|new@example\.test|012345678901|507f1f77bcf86cd799439195/);
});

it("updates only requested AI settings for a named messaging account and hides saved configuration", async () => {
  const accountId = "507f1f77bcf86cd799439196";
  const account = {
    _id: accountId,
    companyCode: "TEST",
    platform: "Facebook",
    displayName: "iGen Hà Nội",
    username: "internal-page-name",
    isConnected: true,
    accessToken: "hidden-access-token",
    aiAutoReplyConfig: { enabled: true, replyDelay: 15, advancedInstructions: "Không đưa cấu hình này vào chat." },
  };
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/omni-inbox/accounts") {
      return new Response(JSON.stringify({ status: "success", data: [account] }), { status: 200 });
    }
    if (input.pathname === `/api/v1/omni-inbox/accounts/${accountId}/ai-config` && init?.method === "PATCH") {
      return new Response(JSON.stringify({ status: "success", data: { ...account, aiAutoReplyConfig: { enabled: false, replyDelay: 30, advancedInstructions: "Không đưa cấu hình này vào chat." } } }), { status: 200 });
    }
    return new Response(JSON.stringify({ status: "error" }), { status: 404 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "omni-inbox.account.ai-config.update")!;
  const resolution = await resolveReferences(req, operation, { path_id: "iGen Hà Nội", enabled: false, replyDelay: 30 } as any);

  expect(resolution.errors).toEqual([]);
  expect(resolution.values.path_id).toBe(accountId);
  expect(resolution.labels.path_id).toBe("iGen Hà Nội · Facebook");
  expect(JSON.stringify(resolution.labels)).not.toContain(accountId);
  const result = await callOperation(req, operation, resolution.values as any);
  const patchCall = fetcher.mock.calls.find(([input, init]) => (input as URL).pathname === `/api/v1/omni-inbox/accounts/${accountId}/ai-config` && init?.method === "PATCH");
  expect(patchCall).toBeDefined();
  const [url, init] = patchCall as [URL, RequestInit];
  expect(url.searchParams.get("companyCode")).toBe("TEST");
  expect(JSON.parse(String(init.body))).toEqual({ aiAutoReplyConfig: { enabled: false, replyDelay: 30 } });
  expect(result).toEqual({ displayName: "iGen Hà Nội", platform: "Facebook", updated: true });
  expect(JSON.stringify(result)).not.toMatch(/internal-page-name|hidden-access-token|Không đưa cấu hình này vào chat|507f1f77bcf86cd799439196/);
  const reply = formatAssistantResult(operation, result);
  expect(reply).toContain("iGen Hà Nội");
  expect(reply).toContain("Facebook");
  expect(reply).not.toContain("advancedInstructions");

  const missingSetting = await resolveReferences(req, operation, { path_id: "iGen Hà Nội" } as any);
  expect(missingSetting.errors).toContain("Hãy nêu ít nhất một cài đặt AI cần thay đổi cho tài khoản đã chọn.");
});

it("lists payroll runs by period while keeping run ids and versions internal", async () => {
  const adminReq = { ...req, user: { ...req.user, role: "admin", branchId: undefined } } as any;
  const branchId = "507f1f77bcf86cd799439195";
  const runId = "507f1f77bcf86cd799439194";
  const fetcher = vi.fn().mockImplementation(() => new Response(JSON.stringify({ status: "success", data: [{
    _id: runId, companyCode: "PRIVATE-COMPANY", branchId, periodKey: "2026-10",
    startDate: "2026-10-01T00:00:00.000Z", endDate: "2026-10-31T23:59:59.999Z",
    type: "regular", status: "review", version: 3, createdAt: "2026-10-29T00:00:00.000Z", createdBy: "PRIVATE-ACTOR",
  }] }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "payroll.run.list")!;
  const result = await callOperation(adminReq, operation, { targetBranch: branchId, query_periodKey: "2026-10" } as any);
  expect(result.data[0]).toMatchObject({
    periodKey: "2026-10", startDate: "2026-10-01", endDate: "2026-10-31", type: "regular", status: "review",
    __assistantRef: { id: runId, version: 3 },
  });
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE|companyCode|createdBy/);
  const reply = formatAssistantResult(operation, result.data);
  expect(reply).toContain("Kỳ lương (YYYY-MM): 2026-10");
  expect(reply).not.toMatch(/507f1f77bcf86cd799439194|Phiên bản/);
  const [url, init] = fetcher.mock.calls[0] as [URL, RequestInit];
  expect(url.pathname).toBe("/api/v1/payroll/runs");
  expect(url.searchParams.get("periodKey")).toBe("2026-10");
  expect(url.searchParams.get("branchId")).toBeNull();
  expect(url.searchParams.get("companyCode")).toBeNull();
  expect((init.headers as Record<string, string>)["x-branch-id"]).toBe(branchId);

  const reference = await lookupRecords(adminReq, operation.id, "2026-10", { targetBranch: branchId } as any);
  expect(reference).toMatchObject([{ id: runId, periodKey: "2026-10", version: 3 }]);
});

it("lists payroll payment batches without exposing employee lines or audit details", async () => {
  const adminReq = { ...req, user: { ...req.user, role: "admin", branchId: undefined } } as any;
  const branchId = "507f1f77bcf86cd799439195";
  const runId = "507f1f77bcf86cd799439194";
  const paymentId = "507f1f77bcf86cd799439193";
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "success", data: [{
    _id: paymentId, companyCode: "PRIVATE-COMPANY", branchId, runId, amount: 1250000, status: "confirmed",
    paymentDate: "2026-10-30T00:00:00.000Z", createdAt: "2026-10-29T00:00:00.000Z", createdBy: "PRIVATE-ACTOR",
    lines: [{ employeeId: "PRIVATE-EMPLOYEE", amount: 1250000 }], evidenceUrl: "PRIVATE-EVIDENCE", note: "PRIVATE-NOTE",
  }] }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "payroll.run.payments.list")!;
  const result = await callOperation(adminReq, operation, { path_id: runId, targetBranch: branchId } as any);

  expect(result.data[0]).toMatchObject({ amount: 1250000, status: "confirmed", employeeCount: 1, paymentDate: "2026-10-30T00:00:00.000Z" });
  expect(result.data[0].__assistantRef).toEqual({ id: paymentId });
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE|companyCode|employeeId|evidenceUrl|runId/);
  const reply = formatAssistantResult(operation, result.data);
  expect(reply).toContain("1.250.000");
  expect(reply).toContain("1");
  expect(reply).not.toMatch(/507f1f77bcf86cd799439193|PRIVATE|\{/);
  const [url, init] = fetcher.mock.calls[0] as [URL, RequestInit];
  expect(url.pathname).toBe(`/api/v1/payroll/runs/${runId}/payments`);
  expect(url.searchParams.get("branchId")).toBe(branchId);
  expect((init.headers as Record<string, string>)["x-branch-id"]).toBe(branchId);
});

it("creates only a payroll payment draft with idempotency and a safe confirmation result", async () => {
  const branchId = req.user.branchId;
  const runId = "507f1f77bcf86cd799439194";
  const paymentId = "507f1f77bcf86cd799439192";
  const employeeId = "507f1f77bcf86cd799439191";
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "success", data: {
    _id: paymentId, runId, companyCode: "PRIVATE-COMPANY", branchId, amount: 1250000, status: "draft",
    idempotencyKey: "PRIVATE-IDEMPOTENCY", paymentDate: "2026-10-30T00:00:00.000Z", createdAt: "2026-10-29T00:00:00.000Z",
    createdBy: "PRIVATE-ACTOR", note: "PRIVATE-NOTE", evidenceUrl: "PRIVATE-EVIDENCE",
    lines: [{ employeeId, amount: 1250000 }],
  } }), { status: 201 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "payroll.run.payment.create")!;
  const requestId = "payroll-payment-draft-request";
  const result = await callOperation(req, operation, {
    path_id: runId, targetBranch: branchId, amount: 1250000,
    lines: JSON.stringify([{ employeeId, amount: 1250000 }]), paymentDate: "2026-10-30",
  } as any, undefined, requestId);

  expect(result.data).toEqual({ amount: 1250000, status: "draft", employeeCount: 1, paymentDate: "2026-10-30T00:00:00.000Z", createdAt: "2026-10-29T00:00:00.000Z" });
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE|507f1f77bcf86cd79943919[124]/);
  expect(formatAssistantResult(operation, result.data)).toContain("1.250.000");
  expect(formatAssistantResult(operation, result.data)).not.toMatch(/PRIVATE|\{/);
  const [url, init] = fetcher.mock.calls[0] as [URL, RequestInit];
  expect(url.pathname).toBe(`/api/v1/payroll/runs/${runId}/payments`);
  expect(url.searchParams.get("branchId")).toBe(branchId);
  expect((init.headers as Record<string, string>)["x-branch-id"]).toBe(branchId);
  expect(JSON.parse(String(init.body))).toEqual({
    amount: 1250000, lines: [{ employeeId, amount: 1250000 }], paymentDate: "2026-10-30T00:00:00.000Z", idempotencyKey: requestId,
  });
});

it("resolves a payroll payment batch by amount and date in an admin-selected branch", async () => {
  const branchId = "507f1f77bcf86cd799439195";
  const runId = "507f1f77bcf86cd799439194";
  const paymentId = "507f1f77bcf86cd799439193";
  const adminReq = { ...req, user: { ...req.user, role: "admin", branchId: undefined } } as any;
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/auth/branches") return new Response(JSON.stringify({ success: true, data: [
      { _id: branchId, name: "Chi nhánh Bắc", code: "B" },
    ] }), { status: 200 });
    if (input.pathname === "/api/v1/payroll/runs") return new Response(JSON.stringify({ status: "success", data: [{
      _id: runId, companyCode: "TEST", branchId, periodKey: "2026-10", type: "regular", status: "closed",
      startDate: "2026-10-01T00:00:00.000Z", endDate: "2026-10-31T23:59:59.999Z", createdAt: "2026-10-29T00:00:00.000Z",
    }] }), { status: 200 });
    if (input.pathname === `/api/v1/payroll/runs/${runId}/payments`) return new Response(JSON.stringify({ status: "success", data: [{
      _id: paymentId, companyCode: "TEST", branchId, runId, amount: 1250000, status: "draft",
      paymentDate: "2026-10-30T00:00:00.000Z", createdAt: "2026-10-29T00:00:00.000Z", lines: [{ employeeId: "PRIVATE-EMPLOYEE", amount: 1250000 }],
    }] }), { status: 200 });
    if (input.pathname === `/api/v1/payroll/payments/${paymentId}/cancel` && init?.method === "POST") return new Response(JSON.stringify({
      status: "success", runStatus: "closed", data: {
        _id: paymentId, amount: 1250000, status: "cancelled", lines: [{ employeeId: "PRIVATE-EMPLOYEE", amount: 1250000 }],
        note: "PRIVATE-NOTE", companyCode: "PRIVATE-COMPANY", branchId, cancelledBy: "PRIVATE-ACTOR",
      },
    }), { status: 200 });
    return new Response(JSON.stringify({ status: "success", data: [] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "payroll.payment.cancel")!;
  const resolution = await resolveReferences(adminReq, operation, {
    targetBranch: "Chi nhánh Bắc", query_id: "2026-10",
    path_id: "Đợt lương 1.250.000 ₫ · nháp · 30/10/26", note: "Hủy đợt tạo nhầm",
  } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values).toMatchObject({ targetBranch: branchId, query_id: runId, path_id: paymentId });
  const result = await callOperation(adminReq, operation, resolution.values as any, undefined, "cancel-payroll-payment-1");
  expect(result.data).toEqual({ status: "cancelled", amount: 1250000, employeeCount: 1, runStatus: "closed" });
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE|507f1f77bcf86cd79943919[345]/);
  const write = fetcher.mock.calls.find(([, init]) => init?.method === "POST")!;
  expect((write[0] as URL).pathname).toBe(`/api/v1/payroll/payments/${paymentId}/cancel`);
  expect((write[0] as URL).searchParams.get("id")).toBe(runId);
  expect((write[0] as URL).searchParams.get("branchId")).toBe(branchId);
  expect((write[1].headers as Record<string, string>)["x-branch-id"]).toBe(branchId);
  expect(JSON.parse(String(write[1].body))).toMatchObject({ note: "Hủy đợt tạo nhầm" });
});

it("blocks payroll payment confirmation when the selected run is not closed", async () => {
  const branchId = "507f1f77bcf86cd799439195";
  const runId = "507f1f77bcf86cd799439194";
  const paymentId = "507f1f77bcf86cd799439193";
  const adminReq = { ...req, user: { ...req.user, role: "admin", branchId: undefined } } as any;
  const fetcher = vi.fn().mockImplementation(async (input: URL) => {
    if (input.pathname === "/api/v1/auth/branches") return new Response(JSON.stringify({ success: true, data: [{ _id: branchId, name: "Chi nhánh Bắc", code: "B" }] }), { status: 200 });
    if (input.pathname === "/api/v1/payroll/runs") return new Response(JSON.stringify({ status: "success", data: [{
      _id: runId, companyCode: "TEST", branchId, periodKey: "2026-10", type: "regular", status: "review",
      startDate: "2026-10-01T00:00:00.000Z", endDate: "2026-10-31T23:59:59.999Z", createdAt: "2026-10-29T00:00:00.000Z",
    }] }), { status: 200 });
    if (input.pathname === `/api/v1/payroll/runs/${runId}/payments`) return new Response(JSON.stringify({ status: "success", data: [{
      _id: paymentId, companyCode: "TEST", branchId, amount: 1250000, status: "draft",
      paymentDate: "2026-10-30T00:00:00.000Z", createdAt: "2026-10-29T00:00:00.000Z", lines: [{ employeeId: "PRIVATE-EMPLOYEE", amount: 1250000 }],
    }] }), { status: 200 });
    return new Response(JSON.stringify({ status: "success", data: [] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "payroll.payment.confirm")!;
  const resolution = await resolveReferences(adminReq, operation, {
    targetBranch: "Chi nhánh Bắc", query_id: "2026-10",
    path_id: "Đợt lương 1.250.000 ₫ · nháp · 30/10/26", paymentDate: "2026-10-30", note: "Đã đối chiếu sao kê",
  } as any);
  expect(resolution.errors.join(" ")).toContain("Chỉ xác nhận thanh toán trong lượt lương đang ở trạng thái đã chốt");
  expect(fetcher.mock.calls.some(([url]) => (url as URL).pathname.startsWith("/api/v1/payroll/payments/"))).toBe(false);
});

it("sanitizes payroll payment confirm, cancel, and reverse responses", async () => {
  const branchId = "507f1f77bcf86cd799439195";
  const paymentId = "507f1f77bcf86cd799439193";
  const adminReq = { ...req, user: { ...req.user, role: "admin", branchId: undefined } } as any;
  const expected = { cancel: "cancelled", confirm: "confirmed", reverse: "reversed" } as const;
  const fetcher = vi.fn().mockImplementation(async (input: URL) => {
    const action = input.pathname.endsWith("/confirm") ? "confirm" : input.pathname.endsWith("/reverse") ? "reverse" : "cancel";
    return new Response(JSON.stringify({ status: "success", runStatus: "closed", data: {
      _id: paymentId, amount: 1250000, status: expected[action], paymentDate: "2026-10-30T00:00:00.000Z",
      lines: [{ employeeId: "PRIVATE-EMPLOYEE", amount: 1250000 }], evidenceUrl: "PRIVATE-EVIDENCE", note: "PRIVATE-NOTE",
      auditId: "PRIVATE-AUDIT", actorId: "PRIVATE-ACTOR", companyCode: "PRIVATE-COMPANY",
    } }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  for (const [action, status] of Object.entries(expected)) {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === `payroll.payment.${action}`)!;
    const result = await callOperation(adminReq, operation, {
      path_id: paymentId, query_id: "507f1f77bcf86cd799439194", targetBranch: branchId,
      note: "Đã đối chiếu", paymentDate: "2026-10-30",
    } as any, undefined, `payroll-payment-${action}`);
    expect(result.data).toMatchObject({ status, amount: 1250000, employeeCount: 1, runStatus: "closed" });
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE|507f1f77bcf86cd79943919[345]/);
    const [url, init] = fetcher.mock.calls[fetcher.mock.calls.length - 1] as [URL, RequestInit];
    expect(url.pathname).toBe(`/api/v1/payroll/payments/${paymentId}/${action}`);
    expect((init.headers as Record<string, string>)["x-branch-id"]).toBe(branchId);
    const body = JSON.parse(String(init.body));
    expect(body.note).toBe("Đã đối chiếu");
    if (action === "confirm") expect(body.paymentDate).toBe("2026-10-30T00:00:00.000Z");
  }
});

it("resolves an attendance sync target by period name and loads the current run version", async () => {
  const branchId = req.user.branchId;
  const runId = "507f1f77bcf86cd799439199";
  const fetcher = vi.fn().mockImplementation((input: URL | string) => {
    const url = new URL(String(input));
    if (url.pathname === "/api/v1/payroll/runs") return new Response(JSON.stringify({ status: "success", data: [{
      _id: runId, companyCode: "TEST", branchId, periodKey: "2026-10",
      startDate: "2026-10-01T00:00:00.000Z", endDate: "2026-10-31T23:59:59.999Z",
      type: "regular", status: "draft", version: 6, createdAt: "2026-10-29T00:00:00.000Z",
    }] }), { status: 200 });
    return new Response(JSON.stringify({ status: "success", data: [] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "payroll.run.sync-attendance")!;
  const resolved = await resolveReferences(req, operation, { path_id: "2026-10" } as any);

  expect(resolved.errors).toEqual([]);
  expect(resolved.values).toMatchObject({ path_id: runId, expectedVersion: 6, targetBranch: branchId });
  expect(JSON.stringify(resolved.values)).not.toContain("2026-10-29T00:00:00.000Z");
});

it("sends the workflow request id as payroll attendance sync idempotency key and returns a safe summary", async () => {
  const runId = "507f1f77bcf86cd799439200";
  const requestId = "507f1f77-bc3f-41c2-9d3a-bd392a33c870";
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "success", data: {
    runVersion: 7,
    job: { _id: "private-job", idempotencyKey: "private-key", status: "succeeded", result: { employeeCount: 12, blockingIssueCount: 2, runVersion: 7 } },
  } }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "payroll.run.sync-attendance")!;
  const result = await callOperation(req, operation, { path_id: runId, expectedVersion: 6 } as any, undefined, requestId);
  const [url, init] = fetcher.mock.calls[0] as [URL, RequestInit];

  expect(url.pathname).toBe("/api/v1/payroll/runs/507f1f77bcf86cd799439200/sync-attendance");
  expect((init.headers as Record<string, string>)["idempotency-key"]).toBe(requestId);
  expect((init.headers as Record<string, string>)["x-branch-id"]).toBe(req.user.branchId);
  expect(JSON.parse(String(init.body))).toEqual({ expectedVersion: 6 });
  expect(result.data).toEqual({ status: "succeeded", employeeCount: 12, blockingIssueCount: 2 });
  expect(JSON.stringify(result)).not.toMatch(/private-job|private-key|runVersion|507f1f77bcf86cd799439200/);
  const reply = formatAssistantResult(operation, result.data);
  expect(reply).toContain("Đã hoàn tất");
  expect(reply).toContain("12");
  expect(reply).toContain("2");
  expect(reply).not.toContain("{");
});

it("returns only the period, lock time, and employee count from payroll attendance snapshot locking", async () => {
  const runId = "507f1f77bcf86cd799439201";
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "success", data: {
    run: { _id: runId, companyCode: "PRIVATE-COMPANY", periodKey: "2026-10", status: "draft", version: 8 },
    snapshot: { _id: "private-snapshot", periodKey: "2026-10", lockedAt: "2026-10-29T01:00:00.000Z", lockedBy: "private-user", employees: [{ employeeId: "private-employee", monthlySalary: 50000000 }, { employeeId: "private-employee-2", monthlySalary: 40000000 }] },
  } }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "payroll.run.lock-attendance")!;
  const result = await callOperation(req, operation, { path_id: runId, expectedVersion: 7 } as any);
  const [url, init] = fetcher.mock.calls[0] as [URL, RequestInit];

  expect(url.pathname).toBe("/api/v1/payroll/runs/507f1f77bcf86cd799439201/lock-attendance");
  expect(JSON.parse(String(init.body))).toEqual({ expectedVersion: 7 });
  expect(result.data).toEqual({ periodKey: "2026-10", lockedAt: "2026-10-29T01:00:00.000Z", employeeCount: 2 });
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE|private-|50000000|40000000|507f1f77bcf86cd799439201/);
  const reply = formatAssistantResult(operation, result.data);
  expect(reply).toContain("2026-10");
  expect(reply).toContain("2");
  expect(reply).not.toContain("private-");
  expect(reply).not.toContain("{");
});

it("calculates payroll through versioned idempotent routes without returning salary lines or totals", async () => {
  const runId = "507f1f77bcf86cd799439202";
  const requestId = "507f1f77-bc3f-41c2-9d3a-bd392a33c871";
  const fetcher = vi.fn().mockImplementation(() => new Response(JSON.stringify({ status: "success", data: {
    runVersion: 9,
    revision: { _id: "private-revision", revision: 4, status: "completed", lines: [
      { employeeId: "private-employee-1", calculation: { net: 50000000 } },
      { employeeId: "private-employee-1", calculation: { net: 10000000 } },
      { employeeId: "private-employee-2", calculation: { net: 40000000 } },
    ], totals: { grossPay: 120000000, deductions: 20000000, netPay: 100000000 }, issues: [
      { employeeId: "private-employee-1", severity: "blocking", message: "private issue" },
      { employeeId: "private-employee-2", severity: "warning", message: "private warning" },
    ] },
  } }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);

  for (const [id, route] of [
    ["payroll.run.calculate", "calculate"],
    ["payroll.run.recalculate", "recalculate"],
  ]) {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === id)!;
    const result = await callOperation(req, operation, { path_id: runId, expectedVersion: 8 } as any, undefined, requestId);
    const [url, init] = fetcher.mock.calls[fetcher.mock.calls.length - 1] as [URL, RequestInit];
    expect(url.pathname).toBe(`/api/v1/payroll/runs/${runId}/${route}`);
    expect((init.headers as Record<string, string>)["idempotency-key"]).toBe(requestId);
    expect(JSON.parse(String(init.body))).toEqual({ expectedVersion: 8 });
    expect(result.data).toEqual({ status: "completed", revision: 4, employeeCount: 2, blockingIssueCount: 1, warningIssueCount: 1 });
    expect(JSON.stringify(result)).not.toMatch(/private-|50000000|10000000|40000000|120000000|100000000|runVersion/);
    const reply = formatAssistantResult(operation, result.data);
    expect(reply).toContain("Đã tính xong");
    expect(reply).toContain("2");
    expect(reply).toContain("1");
    expect(reply).not.toContain("private-");
    expect(reply).not.toContain("{");
  }
});

it("performs guarded payroll state transitions and removes full-run details from results", async () => {
  const runId = "507f1f77bcf86cd799439203";
  const requestId = "507f1f77-bc3f-41c2-9d3a-bd392a33c872";
  const fetcher = vi.fn().mockImplementation((input: URL | string) => {
    const route = new URL(String(input)).pathname.split("/").at(-1);
    const stateByRoute: Record<string, { status: string; closedAt?: string; paidAt?: string }> = {
      review: { status: "review" },
      close: { status: "closed", closedAt: "2026-10-31T12:00:00.000Z" },
      reopen: { status: "draft" },
      "mark-paid": { status: "paid", paidAt: "2026-10-31T12:05:00.000Z" },
    };
    return new Response(JSON.stringify({ status: "success", data: {
      _id: runId, companyCode: "PRIVATE-COMPANY", branchId: req.user.branchId, periodKey: "2026-10", version: 12,
      lines: [{ employeeId: "private-employee", calculation: { net: 50000000 } }],
      effectiveSnapshot: { checksum: "private-checksum", totals: { netPay: 50000000 } },
      ...stateByRoute[String(route)],
    } }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const transitions = [
    ["payroll.run.review", "review", undefined, "Chờ duyệt"],
    ["payroll.run.close", "close", undefined, "Đã chốt"],
    ["payroll.run.reopen", "reopen", "Lý do mở lại", "Bản nháp"],
    ["payroll.run.mark-paid", "mark-paid", "Đã đối chiếu khoản chi thực tế", "Đã thanh toán"],
  ] as const;

  for (const [id, route, reason, statusLabel] of transitions) {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === id)!;
    const result = await callOperation(req, operation, {
      path_id: runId, expectedVersion: 11, ...(reason ? { reason } : {}),
    } as any, undefined, requestId);
    const [url, init] = fetcher.mock.calls[fetcher.mock.calls.length - 1] as [URL, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(url.pathname).toBe(`/api/v1/payroll/runs/${runId}/${route}`);
    expect(body).toMatchObject({ expectedVersion: 11, correlationId: requestId });
    if (reason) expect(body.reason).toBe(reason);
    expect(result.data.periodKey).toBe("2026-10");
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE|private-|50000000|runId|effectiveSnapshot|checksum/);
    const reply = formatAssistantResult(operation, result.data);
    expect(reply).toContain(statusLabel);
    expect(reply).not.toContain("{");
  }
});

it("returns only the named employee's payroll summary and hides identifiers and calculation internals", async () => {
  const employeeId = "507f1f77bcf86cd799439224";
  const runId = "507f1f77bcf86cd799439225";
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "payroll.run.line.detail")!;
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "success", data: {
    employeeId, employeeName: "Đỗ Đức Chung", formulaVersion: "PRIVATE-FORMULA", sourceIds: ["PRIVATE-SOURCE"],
    vietnam: { bankAccount: "PRIVATE-BANK", personalIncomeTax: 1200000 }, periodInput: { reason: "PRIVATE-AUDIT" },
    calculation: { gross: 18000000, deductions: 2200000, net: 15800000, monthlySalary: 17000000, hourlyRate: 90000 },
  } }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const adminReq = { ...req, user: { ...req.user, role: "admin", branchId: undefined } } as any;
  await expect(callOperation(adminReq, operation, { path_id: runId, path_employeeId: employeeId } as any)).rejects.toThrow("Cần chọn chi nhánh bảng lương theo tên");
  const branchId = "507f1f77bcf86cd799439226";
  const result = await callOperation(adminReq, operation, { path_id: runId, path_employeeId: employeeId, targetBranch: branchId } as any);
  expect(fetcher.mock.calls[0][0].pathname).toBe("/api/v1/payroll/runs/" + runId + "/lines/" + employeeId);
  expect(fetcher.mock.calls[0][0].searchParams.get("branchId")).toBe(branchId);
  expect((fetcher.mock.calls[0][1].headers as Record<string, string>)["x-branch-id"]).toBe(branchId);
  expect(result.data).toEqual({ employeeName: "Đỗ Đức Chung", grossPay: 18000000, deductions: 2200000, netPay: 15800000 });
  expect(JSON.stringify(result)).not.toMatch(/507f1f77bcf86cd79943922[45]|PRIVATE|monthlySalary|hourlyRate|personalIncomeTax/);
  const reply = formatAssistantResult(operation, result.data);
  expect(reply).toContain("Tổng thu nhập: 18.000.000 ₫");
  expect(reply).toContain("Khấu trừ: 2.200.000 ₫");
  expect(reply).toContain("Thực nhận: 15.800.000 ₫");
  expect(reply).not.toContain("{");
});

it("filters payroll issue records to actionable text and removes run and employee identifiers", async () => {
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "payroll.run.issues.list")!;
  const runId = "507f1f77bcf86cd799439227";
  const employeeId = "507f1f77bcf86cd799439228";
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "success", data: [{
    runId, employeeId, code: "ATTENDANCE_MISSING", field: "workedMinutes", severity: "blocking",
    message: "Chưa có ngày công đã duyệt.", remediation: "Duyệt chấm công rồi đồng bộ lại.", internalTrace: "PRIVATE-TRACE",
  }] }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const result = await callOperation(req, operation, { path_id: runId, targetBranch: req.user.branchId } as any);
  expect(result.data).toEqual([{
    code: "ATTENDANCE_MISSING", field: "workedMinutes", severity: "blocking",
    message: "Chưa có ngày công đã duyệt.", remediation: "Duyệt chấm công rồi đồng bộ lại.",
  }]);
  expect(JSON.stringify(result)).not.toMatch(/507f1f77bcf86cd79943922[78]|PRIVATE|runId|employeeId|internalTrace/);
  const reply = formatAssistantResult(operation, result.data);
  expect(reply).toContain("Cần xử lý");
  expect(reply).toContain("Duyệt chấm công rồi đồng bộ lại");
  expect(reply).not.toContain("{");
});

it("publishes payroll reconciliation by selected period and branch with hidden version and safe result", async () => {
  const adminReq = { ...req, user: { ...req.user, role: "admin", branchId: undefined } } as any;
  const branchId = "507f1f77bcf86cd799439229";
  const runId = "507f1f77bcf86cd799439230";
  const fetcher = vi.fn().mockImplementation(async (input: URL | string, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname === "/api/v1/auth/branches") return new Response(JSON.stringify({ status: "success", data: [{ _id: branchId, name: "Chi nhánh Hà Nội", companyCode: "TEST", isActive: true }] }), { status: 200 });
    if (url.pathname === "/api/v1/payroll/runs" && init?.method !== "POST") return new Response(JSON.stringify({ status: "success", data: [{
      _id: runId, companyCode: "PRIVATE-COMPANY", branchId, periodKey: "2026-10", status: "draft", type: "regular", version: 6,
      startDate: "2026-10-01T00:00:00.000Z", endDate: "2026-10-31T23:59:59.999Z", createdAt: "2026-10-29T00:00:00.000Z",
    }] }), { status: 200 });
    if (url.pathname === `/api/v1/payroll/runs/${runId}/reconciliation/publish` && init?.method === "POST") return new Response(JSON.stringify({ status: "success", data: {
      employeeCount: 12, runId, employeeId: "PRIVATE-EMPLOYEE", snapshot: { values: { net: 50000000 } }, audit: "PRIVATE-AUDIT",
    } }), { status: 200 });
    return new Response(JSON.stringify({ status: "success", data: [] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "payroll.run.reconciliation.publish")!;

  await expect(callOperation(adminReq, operation, { path_id: runId } as any)).rejects.toThrow("Cần chọn chi nhánh bảng lương theo tên");
  const resolution = await resolveReferences(adminReq, operation, { path_id: "2026-10", targetBranch: "Chi nhánh Hà Nội" } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values).toMatchObject({ path_id: runId, expectedVersion: 6, targetBranch: branchId });
  expect(JSON.stringify(resolution.labels)).not.toContain(runId);

  const result = await callOperation(adminReq, operation, resolution.values as any);
  const write = fetcher.mock.calls.find(([input, init]) => (input as URL).pathname.endsWith("/reconciliation/publish") && init?.method === "POST")!;
  const [url, init] = write as [URL, RequestInit];
  expect(url.searchParams.get("branchId")).toBe(branchId);
  expect((init.headers as Record<string, string>)["x-branch-id"]).toBe(branchId);
  expect(JSON.parse(String(init.body))).toEqual({ expectedVersion: 6 });
  expect(result.data).toEqual({ employeeCount: 12 });
  expect(JSON.stringify(result)).not.toMatch(/507f1f77bcf86cd7994392(29|30)|PRIVATE|50000000|runId|employeeId|snapshot|audit/);
  expect(formatAssistantResult(operation, result.data)).toContain("Số nhân viên: 12");
  expect(formatAssistantResult(operation, result.data)).not.toContain("{");
});

it("lists payroll reconciliation confirmations and open issue fields without salary data or message bodies", async () => {
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "payroll.run.reconciliation.list")!;
  const runId = "507f1f77bcf86cd799439231";
  const employeeId = "507f1f77bcf86cd799439232";
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "success", data: {
    runVersion: 8, runStatus: "draft", employeeCount: 1, items: [{
      runId, employeeId, employeeName: "Đỗ Đức Chung", periodKey: "2026-10", version: 4, runStatus: "draft", stale: false,
      snapshot: { checksum: "PRIVATE-CHECKSUM", values: { net: 50000000 } }, confirmedChecksum: "PRIVATE-CHECKSUM", confirmedAt: "2026-10-31T10:00:00.000Z",
      issues: [{ id: "PRIVATE-ISSUE", field: "baseSalary", status: "open", messages: [{ body: "PRIVATE-DISPUTE-BODY", authorId: "PRIVATE-ACTOR" }] }],
      confirmations: [{ actorId: "PRIVATE-ACTOR", checksum: "PRIVATE-CHECKSUM" }],
    }],
  } }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const result = await callOperation(req, operation, { path_id: runId, targetBranch: req.user.branchId } as any);
  expect((fetcher.mock.calls[0][1] as RequestInit).headers).toMatchObject({ "x-branch-id": req.user.branchId });
  expect(result.data).toEqual({ runStatus: "draft", employeeCount: 1, items: [{
    employeeName: "Đỗ Đức Chung", periodKey: "2026-10", runStatus: "draft", isConfirmed: true, stale: false,
    confirmedAt: "2026-10-31T10:00:00.000Z", openIssueCount: 1, openIssueFields: ["Lương cơ bản"],
  }] });
  expect(JSON.stringify(result)).not.toMatch(/507f1f77bcf86cd79943923[12]|PRIVATE|50000000|snapshot|confirmedChecksum|messages|authorId/);
  const reply = formatAssistantResult(operation, result.data);
  expect(reply).toContain("Đỗ Đức Chung");
  expect(reply).toContain("Đã xác nhận");
  expect(reply).toContain("Lương cơ bản");
  expect(reply).not.toMatch(/PRIVATE|50000000|\{/);
});

it("resolves one payroll complaint by run, employee name, branch, and field before a confirmed staff action", async () => {
  const adminReq = { ...req, user: { ...req.user, role: "admin", branchId: undefined } } as any;
  const branchId = "507f1f77bcf86cd799439233";
  const runId = "507f1f77bcf86cd799439234";
  const employeeId = "507f1f77bcf86cd799439235";
  const issueId = "10000000-0000-4000-8000-000000000001";
  const employee = { _id: employeeId, displayName: "Đỗ Đức Chung", fullName: "Đỗ Đức Chung", branchId, companyCode: "TEST" };
  const reconciliationRecord = {
    runId, employeeId, employeeName: "Đỗ Đức Chung", periodKey: "2026-10", version: 7, runStatus: "draft", stale: false,
    snapshot: { checksum: "PRIVATE-CHECKSUM", values: { baseSalary: 20000000, net: 18000000 } },
    confirmedChecksum: undefined, confirmedAt: undefined,
    issues: [{ id: issueId, field: "baseSalary", status: "open", messages: [{ body: "PRIVATE-EMPLOYEE-MESSAGE" }] }],
  };
  const fetcher = vi.fn().mockImplementation(async (input: URL | string, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname === "/api/v1/auth/branches") return new Response(JSON.stringify({ status: "success", data: [{ _id: branchId, name: "Chi nhánh Hà Nội", companyCode: "TEST", isActive: true }] }), { status: 200 });
    if (url.pathname === "/api/v1/auth/users") return new Response(JSON.stringify({ status: "success", data: [employee] }), { status: 200 });
    if (url.pathname === "/api/v1/payroll/runs" && init?.method !== "POST") return new Response(JSON.stringify({ status: "success", data: [{
      _id: runId, companyCode: "PRIVATE-COMPANY", branchId, periodKey: "2026-10", status: "draft", type: "regular", version: 8,
      startDate: "2026-10-01T00:00:00.000Z", endDate: "2026-10-31T23:59:59.999Z", createdAt: "2026-10-31T00:00:00.000Z",
    }] }), { status: 200 });
    if (url.pathname === `/api/v1/payroll/runs/${runId}/reconciliation` && init?.method !== "POST") return new Response(JSON.stringify({ status: "success", data: {
      runVersion: 8, runStatus: "draft", employeeCount: 1, items: [reconciliationRecord],
    } }), { status: 200 });
    if (url.pathname === `/api/v1/payroll/runs/${runId}/reconciliation/${employeeId}/actions` && init?.method === "POST") return new Response(JSON.stringify({ status: "success", data: {
      ...reconciliationRecord, version: 8, issues: [{ id: issueId, field: "baseSalary", status: "resolved", messages: [{ body: "PRIVATE-STAFF-REPLY" }] }],
      resolvedBy: "PRIVATE-ACTOR", audit: "PRIVATE-AUDIT",
    } }), { status: 200 });
    return new Response(JSON.stringify({ status: "error", message: "Unexpected route" }), { status: 404 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "payroll.run.reconciliation.action")!;
  await expect(callOperation(adminReq, operation, { path_id: runId, path_employeeId: employeeId, action: "resolve", field: "baseSalary", body: "Đã kiểm tra và điều chỉnh." } as any))
    .rejects.toThrow("Cần chọn chi nhánh bảng lương theo tên");

  const resolution = await resolveReferences(adminReq, operation, {
    path_id: "2026-10", path_employeeId: "Đỗ Đức Chung", targetBranch: "Chi nhánh Hà Nội",
    action: "resolve", field: "baseSalary", body: "Đã kiểm tra và điều chỉnh.",
  } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values).toMatchObject({ path_id: runId, path_employeeId: employeeId, targetBranch: branchId, expectedVersion: 7, issueId });
  expect(JSON.stringify(resolution.labels)).not.toMatch(/507f1f77bcf86cd79943923[3-5]|10000000-0000/);

  const result = await callOperation(adminReq, operation, resolution.values as any);
  const write = fetcher.mock.calls.find(([input, init]) => (input as URL).pathname.endsWith(`/${employeeId}/actions`) && init?.method === "POST")!;
  const [url, init] = write as [URL, RequestInit];
  expect(url.searchParams.get("branchId")).toBe(branchId);
  expect((init.headers as Record<string, string>)["x-branch-id"]).toBe(branchId);
  expect(JSON.parse(String(init.body))).toEqual({ action: "resolve", field: "baseSalary", body: "Đã kiểm tra và điều chỉnh.", expectedVersion: 7, issueId });
  expect(result.data).toEqual({ employeeName: "Đỗ Đức Chung", periodKey: "2026-10", action: "resolve", openIssueCount: 0 });
  expect(JSON.stringify(result)).not.toMatch(/507f1f77bcf86cd79943923[3-5]|10000000-0000|PRIVATE|snapshot|checksum/);
  expect(formatAssistantResult(operation, result.data)).toContain("Đã đánh dấu đã xử lý");
  expect(formatAssistantResult(operation, result.data)).toContain("Đỗ Đức Chung");
  expect(formatAssistantResult(operation, result.data)).not.toMatch(/PRIVATE|\{/);
});

it("resolves and answers a named employee payslip review request without exposing payroll identifiers", async () => {
  const adminReq = { ...req, user: { ...req.user, role: "admin", branchId: undefined } } as any;
  const branchId = "507f1f77bcf86cd799439198";
  const runId = "507f1f77bcf86cd799439199";
  const openRequestId = "507f1f77bcf86cd799439200";
  const resolvedRequestId = "507f1f77bcf86cd799439201";
  const createdAt = "2026-10-31T03:00:00.000Z";
  const reviewRequests = [
    { id: openRequestId, runId, employeeId: "PRIVATE-EMPLOYEE-ID", employeeName: "Nguyễn An", periodKey: "2026-10", revisionChecksum: "PRIVATE-CHECKSUM", message: "Vui lòng kiểm tra phụ cấp đi lại.", status: "open", response: "", createdAt },
    { id: resolvedRequestId, runId, employeeId: "PRIVATE-EMPLOYEE-ID", employeeName: "Nguyễn An", periodKey: "2026-10", revisionChecksum: "PRIVATE-OLD-CHECKSUM", message: "Yêu cầu cũ.", status: "resolved", response: "Đã xử lý trước đó.", createdAt: "2026-10-29T03:00:00.000Z", resolvedAt: "2026-10-29T04:00:00.000Z" },
  ];
  const fetcher = vi.fn().mockImplementation(async (input: URL | string, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname === "/api/v1/auth/branches") return new Response(JSON.stringify({ status: "success", data: [
      { _id: branchId, name: "Chi nhánh Hà Nội", companyCode: "TEST", isActive: true },
    ] }), { status: 200 });
    if (url.pathname === "/api/v1/payroll/runs" && init?.method !== "POST") return new Response(JSON.stringify({ status: "success", data: [
      { _id: runId, companyCode: "PRIVATE-COMPANY", branchId, periodKey: "2026-10", status: "closed", type: "regular", version: 4, createdAt },
    ] }), { status: 200 });
    if (url.pathname === `/api/v1/payroll/runs/${runId}/payslip-review-requests` && init?.method !== "POST") return new Response(JSON.stringify({ status: "success", data: reviewRequests }), { status: 200 });
    if (url.pathname === `/api/v1/payroll/runs/${runId}/payslip-review-requests/${openRequestId}/resolve` && init?.method === "POST") return new Response(JSON.stringify({ status: "success", data: {
      ...reviewRequests[0], status: "resolved", response: "Đã kiểm tra và cập nhật phụ cấp.", resolvedAt: "2026-10-31T04:00:00.000Z",
      employeeId: "PRIVATE-EMPLOYEE-ID", revisionChecksum: "PRIVATE-CHECKSUM", resolvedBy: "PRIVATE-ACTOR", companyCode: "PRIVATE-COMPANY",
    } }), { status: 200 });
    return new Response(JSON.stringify({ status: "error", message: "Unexpected route" }), { status: 404 });
  });
  vi.stubGlobal("fetch", fetcher);

  const list = ASSISTANT_OPERATIONS.find(item => item.id === "payroll.run.payslip.review-requests.list")!;
  const listed = await callOperation(adminReq, list, { path_id: runId, targetBranch: branchId } as any);
  expect(listed.data).toHaveLength(2);
  expect(listed.data[0]).toMatchObject({ employeeName: "Nguyễn An", periodKey: "2026-10", status: "open", message: "Vui lòng kiểm tra phụ cấp đi lại." });
  expect(listed.data[0].__assistantRef).toMatchObject({ id: openRequestId, reviewRequest: true });
  expect(JSON.stringify(listed)).not.toMatch(/507f1f77bcf86cd799439200|PRIVATE|employeeId|revisionChecksum|resolvedBy/);
  expect(formatAssistantResult(list, listed.data)).toContain("Nội dung yêu cầu: Vui lòng kiểm tra phụ cấp đi lại.");

  const visibleTime = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(createdAt));
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "payroll.run.payslip.review-request.resolve")!;
  const resolution = await resolveReferences(adminReq, operation, {
    path_id: "2026-10", targetBranch: "Chi nhánh Hà Nội",
    path_requestId: `Nguyễn An · kỳ 2026-10 · đang chờ xử lý · ${visibleTime}`,
    response: "Đã kiểm tra và cập nhật phụ cấp.",
  } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values).toMatchObject({ path_id: runId, path_requestId: openRequestId, targetBranch: branchId });
  expect(JSON.stringify(resolution.labels)).not.toMatch(/507f1f77bcf86cd79943920[019]|PRIVATE/);

  const result = await callOperation(adminReq, operation, resolution.values as any);
  const [url, init] = fetcher.mock.calls.find(([input, options]) => (input as URL).pathname.endsWith(`/${openRequestId}/resolve`) && options?.method === "POST") as [URL, RequestInit];
  expect(url.searchParams.get("branchId")).toBe(branchId);
  expect((init.headers as Record<string, string>)["x-branch-id"]).toBe(branchId);
  expect(JSON.parse(String(init.body))).toEqual({ response: "Đã kiểm tra và cập nhật phụ cấp." });
  expect(result.data).toEqual({ employeeName: "Nguyễn An", periodKey: "2026-10", status: "resolved", response: "Đã kiểm tra và cập nhật phụ cấp.", resolvedAt: "2026-10-31T04:00:00.000Z" });
  const reply = formatAssistantResult(operation, result.data);
  expect(reply).toContain("Trạng thái: Đã xử lý");
  expect(reply).toContain("Nhân viên: Nguyễn An");
  expect(JSON.stringify(result)).not.toMatch(/507f1f77bcf86cd79943920[019]|PRIVATE|employeeId|revisionChecksum|resolvedBy|companyCode/);
});

it("creates a regular payroll draft for the selected branch and derives month dates", async () => {
  const adminReq = { ...req, user: { ...req.user, role: "admin", branchId: undefined } } as any;
  const branchId = "507f1f77bcf86cd799439197";
  const runId = "507f1f77bcf86cd799439196";
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "success", data: {
    _id: runId, companyCode: "PRIVATE-COMPANY", branchId, periodKey: "2026-10",
    startDate: "2026-10-01T00:00:00.000Z", endDate: "2026-10-31T23:59:59.999Z",
    type: "regular", status: "draft", version: 0, createdBy: "PRIVATE-ACTOR",
  } }), { status: 201 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "payroll.run.create")!;
  const result = await callOperation(adminReq, operation, { periodKey: "2026-10", targetBranch: branchId } as any);
  const [url, init] = fetcher.mock.calls[0] as [URL, RequestInit];
  expect(url.pathname).toBe("/api/v1/payroll/runs");
  expect(url.searchParams.get("branchId")).toBe(branchId);
  expect((init.headers as Record<string, string>)["x-branch-id"]).toBe(branchId);
  expect(JSON.parse(String(init.body))).toEqual({ periodKey: "2026-10", type: "regular", startDate: "2026-10-01", endDate: "2026-10-31" });
  expect(result.data).toEqual({ periodKey: "2026-10", startDate: "2026-10-01", endDate: "2026-10-31", type: "regular", status: "draft" });
  expect(JSON.stringify(result)).not.toMatch(/507f1f77bcf86cd799439196|PRIVATE|companyCode|createdBy/);
  expect(formatAssistantResult(operation, result.data)).toContain("Kỳ lương (YYYY-MM): 2026-10");
  await expect(callOperation(adminReq, operation, { periodKey: "2026-13", targetBranch: branchId } as any)).rejects.toThrow("YYYY-MM");
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("updates payroll input by employee name using the current version and returns only safe fields", async () => {
  const employeeId = "507f1f77bcf86cd799439198";
  const branchId = req.user.branchId;
  const employee = { _id: employeeId, displayName: "Đỗ Đức Chung", fullName: "Đỗ Đức Chung", email: "chung@example.test", branchId, companyCode: "TEST" };
  const currentInput = {
    employeeId, periodKey: "2026-10", version: 4, agreedSalary: 12000000, reconciledDays: 25,
    reason: "PRIVATE AUDIT NOTE", updatedBy: "PRIVATE-ACTOR", companyCode: "PRIVATE-COMPANY",
  };
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/auth/users") return new Response(JSON.stringify({ status: "success", data: [employee] }), { status: 200 });
    if (input.pathname === "/api/v1/payroll/periods/2026-10/inputs" && init?.method === "GET") {
      return new Response(JSON.stringify({ status: "success", data: { items: [currentInput], variables: [], editable: true, needsRefresh: false } }), { status: 200 });
    }
    if (input.pathname === `/api/v1/payroll/periods/2026-10/inputs/${employeeId}` && init?.method === "PUT") {
      return new Response(JSON.stringify({ status: "success", data: { ...currentInput, agreedSalary: 13500000, allowance: 500000, reason: "Điều chỉnh theo thỏa thuận" } }), { status: 200 });
    }
    return new Response(JSON.stringify({ status: "error", message: "Unexpected route" }), { status: 404 });
  });
  vi.stubGlobal("fetch", fetcher);

  const list = ASSISTANT_OPERATIONS.find(operation => operation.path === "/payroll/periods/:periodKey/inputs" && operation.method === "GET")!;
  const listed = await callOperation(req, list, { path_periodKey: "2026-10", targetBranch: branchId } as any);
  expect(listed.data[0]).toMatchObject({ employeeName: "Đỗ Đức Chung", periodKey: "2026-10", agreedSalary: 12000000, reconciledDays: 25 });
  expect(listed.data[0].__assistantRef).toMatchObject({ id: employeeId, version: 4 });
  const listReply = formatAssistantResult(list, listed.data);
  expect(listReply).toContain("Đỗ Đức Chung");
  expect(listReply).not.toMatch(/507f1f77bcf86cd799439198|PRIVATE|updatedBy|employeeId/);

  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "payroll.period.input.update")!;
  const resolution = await resolveReferences(req, operation, {
    path_periodKey: "2026-10", path_employeeId: "Đỗ Đức Chung", targetBranch: branchId,
    agreedSalary: 13500000, allowance: 500000, reason: "Điều chỉnh theo thỏa thuận",
  } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.path_employeeId).toBe(employeeId);
  expect(resolution.values.expectedVersion).toBe(4);
  expect(JSON.stringify(resolution.labels)).not.toContain(employeeId);

  const result = await callOperation(req, operation, resolution.values as any);
  const writeCall = fetcher.mock.calls.find(([input, init]) => (input as URL).pathname.endsWith(`/${employeeId}`) && init?.method === "PUT")!;
  expect((writeCall[0] as URL).searchParams.get("branchId")).toBe(branchId);
  expect(JSON.parse(String(writeCall[1].body))).toEqual({ agreedSalary: 13500000, allowance: 500000, reason: "Điều chỉnh theo thỏa thuận", expectedVersion: 4 });
  expect(result.data).toEqual({ periodKey: "2026-10", employeeName: "Đỗ Đức Chung", agreedSalary: 13500000, allowance: 500000, reconciledDays: 25 });
  const reply = formatAssistantResult(operation, result.data);
  expect(reply).toContain("Lương thỏa thuận (VND): 13.500.000 ₫");
  expect(reply).not.toMatch(/507f1f77bcf86cd799439198|PRIVATE|employeeId|updatedBy/);
  await expect(callOperation(req, operation, { path_periodKey: "2026-13", agreedSalary: 1 } as any)).rejects.toThrow("YYYY-MM");
});

it("updates payroll inputs for several named employees with branch-scoped versions and a concise partial result", async () => {
  const branchId = req.user.branchId;
  const employeeId = "507f1f77bcf86cd799439231";
  const secondEmployeeId = "507f1f77bcf86cd799439232";
  const employees = [
    { _id: employeeId, displayName: "Đỗ Đức Chung", fullName: "Đỗ Đức Chung", branchId, companyCode: "TEST" },
    { _id: secondEmployeeId, displayName: "Lê Thị Mai", fullName: "Lê Thị Mai", branchId, companyCode: "TEST" },
  ];
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/auth/users") return new Response(JSON.stringify({ status: "success", data: employees }), { status: 200 });
    if (input.pathname === "/api/v1/payroll/periods/2026-10/inputs" && init?.method === "GET") {
      return new Response(JSON.stringify({ status: "success", data: {
        items: [{ employeeId, periodKey: "2026-10", version: 3, agreedSalary: 12000000, reason: "PRIVATE-AUDIT" }],
        variables: [], editable: true, needsRefresh: false,
      } }), { status: 200 });
    }
    if (input.pathname === "/api/v1/payroll/periods/2026-10/inputs" && init?.method === "PUT") {
      return new Response(JSON.stringify({ status: "success", data: [
        { employeeId, status: "success", data: { employeeId, agreedSalary: 13500000, reason: "PRIVATE-AUDIT", updatedBy: "PRIVATE-ACTOR" } },
        { employeeId: secondEmployeeId, status: "error", code: "PAYROLL_PERIOD_INPUT_VERSION_CONFLICT", message: "PRIVATE-ERROR-DETAIL" },
      ] }), { status: 200 });
    }
    return new Response(JSON.stringify({ status: "error", message: "Unexpected route" }), { status: 404 });
  });
  vi.stubGlobal("fetch", fetcher);

  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "payroll.period.inputs.bulk")!;
  const resolution = await resolveReferences(req, operation, {
    path_periodKey: "2026-10", targetBranch: branchId,
    rows: JSON.stringify([
      { employeeId: "Đỗ Đức Chung", agreedSalary: 13500000, reason: "Điều chỉnh theo thỏa thuận" },
      { employeeId: "Lê Thị Mai", bonus: 250000, reason: "Thưởng tháng 10" },
    ]),
  } as any);
  expect(resolution.errors).toEqual([]);
  const resolvedRows = JSON.parse(String(resolution.values.rows));
  expect(resolvedRows).toEqual([
    { employeeId, agreedSalary: 13500000, reason: "Điều chỉnh theo thỏa thuận", expectedVersion: 3 },
    { employeeId: secondEmployeeId, bonus: 250000, reason: "Thưởng tháng 10", expectedVersion: 0 },
  ]);
  expect(JSON.stringify(resolution.labels)).not.toMatch(/507f1f77bcf86cd79943923[12]/);
  expect(JSON.stringify(resolution.labels)).toContain("Đỗ Đức Chung");

  const result = await callOperation(req, operation, resolution.values as any);
  const write = fetcher.mock.calls.find(([input, init]) => (input as URL).pathname === "/api/v1/payroll/periods/2026-10/inputs" && init?.method === "PUT")!;
  expect((write[0] as URL).searchParams.get("branchId")).toBe(branchId);
  expect(JSON.parse(String(write[1].body))).toEqual({ rows: resolvedRows });
  expect(result.data).toEqual({ updatedCount: 1, failedCount: 1, items: [
    { employeeName: "Đỗ Đức Chung", status: "Đã cập nhật", updatedFields: ["Lương thỏa thuận"] },
    { employeeName: "Lê Thị Mai", status: "Chưa cập nhật", detail: "Dữ liệu vừa thay đổi; cần tra cứu lại trước khi cập nhật." },
  ] });
  const reply = formatAssistantResult(operation, result.data);
  expect(reply).toContain("Đã cập nhật: 1 · Chưa cập nhật: 1");
  expect(reply).toContain("Đỗ Đức Chung: Đã cập nhật (Lương thỏa thuận)");
  expect(JSON.stringify(result)).not.toMatch(/507f1f77bcf86cd79943923[12]|PRIVATE|employeeId|companyCode/);
});

it("writes payroll line overrides by employee name, pins versions, and returns a safe summary", async () => {
  const branchId = req.user.branchId;
  const employeeId = "507f1f77bcf86cd799439231";
  let overrideVersion = 2;
  const employee = { _id: employeeId, displayName: "Đỗ Đức Chung", fullName: "Đỗ Đức Chung", branchId, companyCode: "TEST" };
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/auth/users") {
      return new Response(JSON.stringify({ status: "success", data: [employee] }), { status: 200 });
    }
    if (input.pathname === "/api/v1/payroll/period-input-variables") {
      return new Response(JSON.stringify({ status: "success", data: [
        { code: "salesBonus", name: "Thưởng doanh số", status: "active" },
        { code: "oldAllowance", name: "Phụ cấp cũ", status: "active" },
      ] }), { status: 200 });
    }
    if (input.pathname === "/api/v1/payroll/periods/2026-10/line-overrides" && (!init?.method || init.method === "GET")) {
      const data = overrideVersion === 0 ? [] : [{
        _id: "PRIVATE-OVERRIDE-ID", companyCode: "PRIVATE-COMPANY", branchId: "PRIVATE-BRANCH",
        employeeId, periodKey: "2026-10", version: overrideVersion, baseSalary: 12000000,
        reason: "PRIVATE-AUDIT", updatedBy: "PRIVATE-ACTOR",
      }];
      return new Response(JSON.stringify({ status: "success", data }), { status: 200 });
    }
    if (input.pathname === "/api/v1/payroll/periods/2026-10/line-overrides" && init?.method === "PUT") {
      const body = JSON.parse(String(init.body));
      expect(body.rows[0].expectedVersion).toBe(2);
      expect(body.rows[0].customValues).toEqual({ salesBonus: 250000 });
      expect(body.rows[0].clearFields).toEqual(["custom.oldAllowance"]);
      return new Response(JSON.stringify({ status: "success", data: [{
        employeeId, status: "success", data: { employeeId, version: 3, baseSalary: 13500000, reason: "PRIVATE-AUDIT", updatedBy: "PRIVATE-ACTOR" },
      }] }), { status: 200 });
    }
    return new Response(JSON.stringify({ status: "error", message: "Unexpected route" }), { status: 404 });
  });
  vi.stubGlobal("fetch", fetcher);

  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "payroll.period.line-overrides.bulk")!;
  const resolution = await resolveReferences(req, operation, {
    path_periodKey: "2026-10", targetBranch: branchId,
    rows: JSON.stringify([{
      employeeId: "Đỗ Đức Chung", reason: "Điều chỉnh theo thỏa thuận", values: { baseSalary: 13500000 },
      customValues: { "Thưởng doanh số": 250000 }, clearFields: ["custom.Phụ cấp cũ"],
    }]),
  } as any);
  expect(resolution.errors).toEqual([]);
  const resolvedRows = JSON.parse(String(resolution.values.rows));
  expect(resolvedRows).toEqual([{
    employeeId, reason: "Điều chỉnh theo thỏa thuận", values: { baseSalary: 13500000 },
    customValues: { salesBonus: 250000 }, clearFields: ["custom.oldAllowance"], expectedVersion: 2,
  }]);
  expect(JSON.stringify(resolution.labels)).toContain("Đỗ Đức Chung");
  expect(JSON.stringify(resolution.labels)).not.toContain(employeeId);

  const result = await callOperation(req, operation, resolution.values as any);
  expect(result.data).toEqual({ updatedCount: 1, failedCount: 0, items: [
    { employeeName: "Đỗ Đức Chung", status: "Đã cập nhật", updatedFields: ["Lương cơ bản", "Trường tùy chỉnh Thưởng doanh số", "Khôi phục Phụ cấp cũ"] },
  ] });
  expect(formatAssistantResult(operation, result.data)).toContain("Đỗ Đức Chung: Đã cập nhật (Lương cơ bản, Trường tùy chỉnh Thưởng doanh số, Khôi phục Phụ cấp cũ)");
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE|507f1f77bcf86cd799439231|employeeId|companyCode/);

  overrideVersion = 3;
  const pinned = await resolveReferences(req, operation, { ...resolution.values, __assistantPinnedVersion: true } as any);
  expect(pinned.errors.join(" ")).toMatch(/thay đổi sau khi bạn xem bản xác nhận/i);
  expect(fetcher.mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(1);
});

it("formats payroll line-override lookup results without exposing record identifiers", async () => {
  const branchId = req.user.branchId;
  const employeeId = "507f1f77bcf86cd799439232";
  const fetcher = vi.fn().mockImplementation(async (input: URL) => {
    if (input.pathname === "/api/v1/auth/users") {
      return new Response(JSON.stringify({ status: "success", data: [{ _id: employeeId, displayName: "Lê Thị Mai", branchId }] }), { status: 200 });
    }
    if (input.pathname === "/api/v1/payroll/period-input-variables") {
      return new Response(JSON.stringify({ status: "success", data: [{ code: "salesBonus", name: "Thưởng doanh số", status: "active" }] }), { status: 200 });
    }
    if (input.pathname === "/api/v1/payroll/periods/2026-10/line-overrides") {
      return new Response(JSON.stringify({ status: "success", data: [{
        _id: "PRIVATE-OVERRIDE-ID", companyCode: "PRIVATE-COMPANY", branchId: "PRIVATE-BRANCH",
        employeeId, periodKey: "2026-10", version: 4, bonusTotal: 500000, customValues: { salesBonus: 250000 },
        reason: "Điều chỉnh cuối kỳ", updatedBy: "PRIVATE-ACTOR",
      }] }), { status: 200 });
    }
    return new Response(JSON.stringify({ status: "error" }), { status: 404 });
  });
  vi.stubGlobal("fetch", fetcher);

  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "payroll.period.line-overrides.list")!;
  const result = await callOperation(req, operation, { path_periodKey: "2026-10", targetBranch: branchId } as any);
  expect(result.data[0].employeeName).toBe("Lê Thị Mai");
  expect(result.data[0].__assistantRef).toEqual({ id: employeeId, version: 4 });
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE|507f1f77bcf86cd799439232|employeeId|companyCode/);
  const reply = formatAssistantResult(operation, result.data);
  expect(reply).toContain("Lê Thị Mai");
  expect(reply).toContain("Tổng thưởng: 500.000 ₫");
  expect(reply).toContain("Thưởng doanh số: 250.000");
  expect(reply).not.toMatch(/PRIVATE|507f1f77bcf86cd799439232|employeeId|companyCode/);
});

it("publishes payslips by a closed payroll run name and returns only a count", async () => {
  const branchId = "507f1f77bcf86cd799439221";
  const draftRunId = "507f1f77bcf86cd799439222";
  const closedRunId = "507f1f77bcf86cd799439223";
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/payroll/runs" && init?.method !== "POST") {
      return new Response(JSON.stringify({ status: "success", data: [
        { _id: draftRunId, companyCode: "TEST", branchId, periodKey: "2026-10", type: "regular", status: "draft", createdAt: "2026-10-30T01:00:00.000Z" },
        { _id: closedRunId, companyCode: "TEST", branchId, periodKey: "2026-10", type: "regular", status: "closed", createdAt: "2026-10-30T02:00:00.000Z" },
      ] }), { status: 200 });
    }
    if (input.pathname === `/api/v1/payroll/runs/${closedRunId}/payslips/publish` && init?.method === "POST") {
      return new Response(JSON.stringify({ status: "success", data: [
        { employeeId: "PRIVATE-EMPLOYEE-1", revisionChecksum: "PRIVATE-CHECKSUM-1", status: "published" },
        { employeeId: "PRIVATE-EMPLOYEE-2", revisionChecksum: "PRIVATE-CHECKSUM-2", status: "published" },
      ] }), { status: 200 });
    }
    return new Response(JSON.stringify({ status: "error", message: "Unexpected route" }), { status: 404 });
  });
  vi.stubGlobal("fetch", fetcher);

  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "payroll.run.payslips.publish")!;
  const resolution = await resolveReferences(req, operation, { path_id: "2026-10" } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.path_id).toBe(closedRunId);

  const result = await callOperation(req, operation, resolution.values as any);
  const write = fetcher.mock.calls.find(([, init]) => init?.method === "POST")!;
  expect((write[0] as URL).pathname).toBe(`/api/v1/payroll/runs/${closedRunId}/payslips/publish`);
  expect(JSON.parse(String(write[1].body))).toEqual({});
  expect(result.data).toEqual({ publishedCount: 2 });
  expect(formatAssistantResult(operation, result.data)).toContain("Số phiếu lương đã công bố: 2");
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE|507f1f77bcf86cd79943922/);
});

it("withdraws one employee's published payslip by run and employee names without exposing ids", async () => {
  const branchId = req.user.branchId;
  const runId = "507f1f77bcf86cd799439225";
  const employeeId = "507f1f77bcf86cd799439226";
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/payroll/runs" && init?.method !== "POST") {
      return new Response(JSON.stringify({ status: "success", data: [
        { _id: runId, companyCode: "TEST", branchId, periodKey: "2026-10", type: "regular", status: "closed", createdAt: "2026-10-30T02:00:00.000Z" },
      ] }), { status: 200 });
    }
    if (input.pathname === "/api/v1/auth/users" && init?.method !== "POST") {
      return new Response(JSON.stringify({ status: "success", data: [
        { _id: employeeId, companyCode: "TEST", branchId, displayName: "Đỗ Đức Chung", role: "user", isActive: true },
      ] }), { status: 200 });
    }
    if (input.pathname === `/api/v1/payroll/runs/${runId}/payslips/${employeeId}/withdraw` && init?.method === "POST") {
      return new Response(JSON.stringify({ status: "success", data: {
        employeeId, runId, revisionChecksum: "PRIVATE-CHECKSUM", status: "withdrawn", withdrawnBy: "PRIVATE-ACTOR",
      } }), { status: 200 });
    }
    return new Response(JSON.stringify({ status: "error", message: "Unexpected route" }), { status: 404 });
  });
  vi.stubGlobal("fetch", fetcher);

  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "payroll.run.payslips.withdraw")!;
  const resolution = await resolveReferences(req, operation, { path_id: "2026-10", path_employeeId: "Đỗ Đức Chung" } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.path_id).toBe(runId);
  expect(resolution.values.path_employeeId).toBe(employeeId);

  const result = await callOperation(req, operation, resolution.values as any);
  const write = fetcher.mock.calls.find(([, init]) => init?.method === "POST")!;
  expect((write[0] as URL).pathname).toBe(`/api/v1/payroll/runs/${runId}/payslips/${employeeId}/withdraw`);
  expect(JSON.parse(String(write[1].body))).toEqual({});
  expect(result.data).toEqual({ withdrawn: true });
  expect(formatAssistantResult(operation, result.data)).toContain("Đã thu hồi phiếu lương: Có");
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE|507f1f77bcf86cd79943922[456]/);
});

it("creates and updates a branch with named selection and filtered results", async () => {
  const branchId = "507f1f77bcf86cd799439227";
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/auth/branches" && init?.method === "POST") {
      const body = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ status: "success", data: {
        _id: "PRIVATE-BRANCH-ID", companyCode: "PRIVATE-COMPANY", ...body, managerId: "PRIVATE-MANAGER",
        pendingOwnerSetup: true, locationConfig: { latitude: 21, longitude: 105, allowedRadius: 100, allowedPublicIps: ["203.0.113.10"] },
      } }), { status: 201 });
    }
    if (input.pathname === "/api/v1/auth/branches" && (!init?.method || init.method === "GET")) {
      return new Response(JSON.stringify({ status: "success", data: [
        { _id: branchId, companyCode: "TEST", name: "Chi nhánh Hà Nội", code: "HN-01", address: "Cầu Giấy", phone: "0900000000", isActive: true },
      ] }), { status: 200 });
    }
    if (input.pathname === `/api/v1/auth/branches/${branchId}` && init?.method === "PATCH") {
      return new Response(JSON.stringify({ status: "success", data: {
        _id: branchId, companyCode: "PRIVATE-COMPANY", name: "Chi nhánh Hà Nội mới", code: "HN-01",
        managerId: "PRIVATE-MANAGER", locationConfig: { allowedPublicIps: ["203.0.113.10"] }, isActive: true,
      } }), { status: 200 });
    }
    if (input.pathname === `/api/v1/auth/branches/${branchId}/pending` && init?.method === "DELETE") {
      return new Response(JSON.stringify({ status: "success", data: {
        _id: branchId, companyCode: "PRIVATE-COMPANY", name: "Chi nhánh Hà Nội", managerId: "", pendingOwnerSetup: true,
      } }), { status: 200 });
    }
    return new Response(JSON.stringify({ status: "error", message: "Unexpected route" }), { status: 404 });
  });
  vi.stubGlobal("fetch", fetcher);

  const create = ASSISTANT_OPERATIONS.find(item => item.id === "branch.create")!;
  const created = await callOperation(req, create, { code: "HN-02", name: "Chi nhánh Hà Nội 2", address: "Thanh Xuân", isActive: true } as any);
  const createWrite = fetcher.mock.calls.find(([, init]) => init?.method === "POST")!;
  expect((createWrite[0] as URL).pathname).toBe("/api/v1/auth/branches");
  expect(JSON.parse(String(createWrite[1].body))).toEqual({ code: "HN-02", name: "Chi nhánh Hà Nội 2", address: "Thanh Xuân", isActive: true });
  const createReply = formatAssistantResult(create, created.data);
  expect(createReply).toContain("Cần thiết lập chủ chi nhánh: Có");
  expect(createReply).not.toMatch(/PRIVATE|locationConfig|allowedPublicIps|managerId/);

  const update = ASSISTANT_OPERATIONS.find(item => item.id === "branch.update")!;
  const resolution = await resolveReferences(req, update, { path_id: "Chi nhánh Hà Nội", name: "Chi nhánh Hà Nội mới" } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.path_id).toBe(branchId);
  const updated = await callOperation(req, update, resolution.values as any);
  const updateWrite = fetcher.mock.calls.find(([, init]) => init?.method === "PATCH")!;
  expect((updateWrite[0] as URL).pathname).toBe(`/api/v1/auth/branches/${branchId}`);
  expect(JSON.parse(String(updateWrite[1].body))).toEqual({ name: "Chi nhánh Hà Nội mới" });
  const updateReply = formatAssistantResult(update, updated.data);
  expect(updateReply).toContain("Tên chi nhánh: Chi nhánh Hà Nội mới");
  expect(updateReply).not.toMatch(/PRIVATE|locationConfig|allowedPublicIps|managerId/);

  const removePending = ASSISTANT_OPERATIONS.find(item => item.id === "branch.pending.delete")!;
  const deleteResolution = await resolveReferences(req, removePending, { path_id: "Chi nhánh Hà Nội" } as any);
  expect(deleteResolution.errors).toEqual([]);
  expect(deleteResolution.values.path_id).toBe(branchId);
  const deleted = await callOperation(req, removePending, deleteResolution.values as any);
  const deleteWrite = fetcher.mock.calls.find(([, init]) => init?.method === "DELETE")!;
  expect((deleteWrite[0] as URL).pathname).toBe(`/api/v1/auth/branches/${branchId}/pending`);
  expect(deleted.data).toEqual({ deleted: true, name: "Chi nhánh Hà Nội" });
  const deleteReply = formatAssistantResult(removePending, deleted.data);
  expect(deleteReply).toContain("Đã hủy chi nhánh: Có");
  expect(deleteReply).not.toMatch(/PRIVATE|companyCode|managerId/);
});

it("returns only status totals from celebration email history", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "success", data: [
    { status: "sent", recipientEmail: "PRIVATE-EMAIL-1", subject: "PRIVATE-SUBJECT", messageId: "PRIVATE-MESSAGE-1" },
    { status: "failed", recipientEmail: "PRIVATE-EMAIL-2", error: "PRIVATE-ERROR", messageId: "PRIVATE-MESSAGE-2" },
    { status: "pending", recipientEmail: "PRIVATE-EMAIL-3", subject: "PRIVATE-SUBJECT" },
    { status: "sending", recipientEmail: "PRIVATE-EMAIL-4" },
    { status: "skipped", recipientEmail: "PRIVATE-EMAIL-5" },
    { status: "unknown", recipientEmail: "PRIVATE-EMAIL-6" },
  ] }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);

  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "company-email.celebration.history")!;
  const result = await callOperation(req, operation, {} as any);
  expect((fetcher.mock.calls[0][0] as URL).pathname).toBe("/api/v1/company-email/celebration/history");
  expect(result.data).toEqual({ totalCount: 6, sentCount: 1, failedCount: 1, pendingCount: 2, skippedCount: 1 });
  const reply = formatAssistantResult(operation, result.data);
  expect(reply).toContain("Tổng lượt gửi: 6");
  expect(reply).toContain("Đang chờ: 2");
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE|recipientEmail|messageId/);
});

it("shows only safe fields from company celebration email settings", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "success", data: {
    birthdayEnabled: true, holidayEnabled: false, sendTime: "08:30",
    birthdayTemplate: { subject: "PRIVATE-SUBJECT", html: "PRIVATE-HTML" },
    holidayTemplate: { subject: "PRIVATE-SUBJECT", html: "PRIVATE-HTML" },
    holidayOverrides: [{ date: "2026-11-01", subject: "PRIVATE-OVERRIDE", html: "PRIVATE-HTML" }],
    uploadTokens: ["PRIVATE-TOKEN"],
  } }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);

  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "company-email.celebration.config")!;
  const result = await callOperation(req, operation, {} as any);
  expect((fetcher.mock.calls[0][0] as URL).pathname).toBe("/api/v1/company-email/celebration");
  expect(result.data).toEqual({ configured: true, birthdayEnabled: true, holidayEnabled: false, sendTime: "08:30", holidayOverridesCount: 1 });
  const reply = formatAssistantResult(operation, result.data);
  expect(reply).toContain("Gửi email sinh nhật: Có");
  expect(reply).not.toMatch(/PRIVATE|birthdayTemplate|holidayTemplate|uploadTokens/);
});

it("shows SMTP settings without forwarding password material", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: {
    host: "smtp.example.test", port: 587, secure: false, user: "sender@example.test",
    fromEmail: "no-reply@example.test", fromName: "Công ty mẫu", hasPassword: true,
    password: "PRIVATE-PASSWORD", passwordEncrypted: "PRIVATE-ENCRYPTED",
  } }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);

  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "company-email.smtp.config")!;
  const result = await callOperation(req, operation, {} as any);
  expect((fetcher.mock.calls[0][0] as URL).pathname).toBe("/api/v1/company-email/smtp");
  expect(result.data).toEqual({ configured: true, host: "smtp.example.test", port: 587, secure: false, user: "sender@example.test", fromEmail: "no-reply@example.test", fromName: "Công ty mẫu", hasPassword: true });
  const reply = formatAssistantResult(operation, result.data);
  expect(reply).toContain("Email người gửi: no-reply@example.test");
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE|passwordEncrypted|"password"/);
});

it("reports an unconfigured SMTP account without inventing settings", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: null }), { status: 200 })));
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "company-email.smtp.config")!;
  expect((await callOperation(req, operation, {} as any)).data).toEqual({ configured: false });
});

it("confirms SMTP verification and test send without returning transport details", async () => {
  const fetcher = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ messageId: "PRIVATE-SMTP-MESSAGE-ID" }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);

  const verify = ASSISTANT_OPERATIONS.find(item => item.id === "company-email.smtp.verify")!;
  const verified = await callOperation(req, verify, {} as any);
  expect((fetcher.mock.calls[0][0] as URL).pathname).toBe("/api/v1/company-email/smtp/verify");
  expect(verified.data).toEqual({ verified: true });

  const test = ASSISTANT_OPERATIONS.find(item => item.id === "company-email.smtp.test")!;
  const sent = await callOperation(req, test, {} as any);
  expect((fetcher.mock.calls[1][0] as URL).pathname).toBe("/api/v1/company-email/smtp/test");
  expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toEqual({});
  expect(sent.data).toEqual({ sent: true });
  expect(JSON.stringify(sent)).not.toContain("PRIVATE-SMTP-MESSAGE-ID");
});

it("hides provider errors when an SMTP test email fails", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "PRIVATE SMTP AUTH RESPONSE" }), { status: 400 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "company-email.smtp.test")!;
  const failure = await callOperation(req, operation, {} as any).catch(error => error);
  expect(failure).toMatchObject({ message: "Không gửi được email thử. Hãy kiểm tra cấu hình SMTP công ty và hộp thư của bạn." });
  expect(String(failure)).not.toContain("PRIVATE SMTP AUTH RESPONSE");
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("resolves named inbox accounts and conversations before marking read or sending a confirmed reply", async () => {
  const fixtures = [
    { platform: "Facebook", listId: "omni-inbox.facebook-conversations.list", accountKey: "query_pageId", accountApiKey: "pageId", externalId: "PAGE-ALPHA", listPath: "/api/v1/facebook/messenger/conversations", markId: "omni-inbox.facebook-conversation.mark-read", markPath: "/api/v1/facebook/messenger/conversations/:recipientId/mark-read", resumeId: "omni-inbox.facebook-conversation.resume-ai", resumePath: "/api/v1/facebook/messenger/conversations/:recipientId/resume-ai", replyId: "omni-inbox.facebook-conversation.reply", replyPath: "/api/v1/facebook/messenger/reply", contactKey: "path_recipientId", bodyContactKey: "recipientId" },
    { platform: "Zalo", listId: "omni-inbox.zalo-conversations.list", accountKey: "query_accountId", accountApiKey: "accountId", externalId: "OA-ALPHA", listPath: "/api/v1/zalo/conversations", markId: "omni-inbox.zalo-conversation.mark-read", markPath: "/api/v1/zalo/conversations/:recipientId/mark-read", resumeId: "omni-inbox.zalo-conversation.resume-ai", resumePath: "/api/v1/zalo/conversations/:recipientId/resume-ai", replyId: "omni-inbox.zalo-conversation.reply", replyPath: "/api/v1/zalo/reply", contactKey: "path_recipientId", bodyContactKey: "conversationId" },
    { platform: "TikTok", listId: "omni-inbox.tiktok-conversations.list", accountKey: "query_accountId", accountApiKey: "accountId", externalId: "TIKTOK-ALPHA", listPath: "/api/v1/tiktok/messenger/conversations", markId: "omni-inbox.tiktok-conversation.mark-read", markPath: "/api/v1/tiktok/messenger/conversations/:conversationId/mark-read", resumeId: "omni-inbox.tiktok-conversation.resume-ai", resumePath: "/api/v1/tiktok/messenger/conversations/:conversationId/resume-ai", replyId: "omni-inbox.tiktok-conversation.reply", replyPath: "/api/v1/tiktok/messenger/reply", contactKey: "path_conversationId", bodyContactKey: "conversationId" },
  ];
  const requests: Array<{ url: URL; init?: RequestInit }> = [];
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    requests.push({ url: input, init });
    if (input.pathname === "/api/v1/omni-inbox/accounts") {
      const platform = String(input.searchParams.get("platform"));
      const fixture = fixtures.find(item => item.platform === platform)!;
      return new Response(JSON.stringify({ status: "success", data: [
        { _id: "507f1f77bcf86cd799439201", displayName: `Hộp thư ${platform}`, platform, username: fixture.externalId, isConnected: true },
        { _id: "507f1f77bcf86cd799439203", displayName: `Hộp thư ${platform}`, platform, username: `${fixture.externalId}-DISCONNECTED`, isConnected: false },
      ] }), { status: 200 });
    }
    const fixture = fixtures.find(item => item.listPath === input.pathname);
    if (fixture && (!init?.method || init.method === "GET")) {
      return new Response(JSON.stringify({ status: "success", data: [{
        _id: "507f1f77bcf86cd799439202", senderName: "Chị Lan", recipientId: "PRIVATE-RECIPIENT", channel: fixture.platform.toLowerCase(),
        pageId: fixture.externalId, oaId: fixture.externalId, businessAccountId: fixture.externalId,
        lastMessageAt: "2026-10-31T08:00:00.000Z", unreadCount: 2, status: "open", isVip: false,
      }] }), { status: 200 });
    }
    return new Response(JSON.stringify({ status: "success", message: init?.method === "POST" && input.pathname.endsWith("/reply") ? "Đã gửi tin nhắn phản hồi thành công." : "Đã đánh dấu đã đọc." }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);

  for (const fixture of fixtures) {
    const accountName = `Hộp thư ${fixture.platform}`;
    const mark = ASSISTANT_OPERATIONS.find(operation => operation.id === fixture.markId)!;
    const markInput = { [fixture.contactKey]: "Chị Lan", [fixture.accountKey]: accountName };
    const markResolution = await resolveReferences(req, mark, markInput as any);
    expect(markResolution.errors).toEqual([]);
    expect(markResolution.values[fixture.contactKey]).toBe("507f1f77bcf86cd799439202");
    expect(markResolution.values[fixture.accountKey]).toBe(fixture.externalId);
    expect(JSON.stringify(markResolution.labels)).not.toMatch(/507f1f77bcf86cd79943920[12]|PRIVATE/);
    await callOperation(req, mark, markResolution.values as any);
    const markRequest = requests.find(request => request.url.pathname.includes("/mark-read") && request.init?.method === "POST" && request.url.pathname.includes(fixture.externalId) === false && request.url.searchParams.get(fixture.accountApiKey) === fixture.externalId);
    expect(markRequest?.url.pathname).toBe(fixture.markPath.replace(/:recipientId|:conversationId/, "507f1f77bcf86cd799439202"));
    expect(markRequest?.url.searchParams.get(fixture.accountApiKey)).toBe(fixture.externalId);

    const resume = ASSISTANT_OPERATIONS.find(operation => operation.id === fixture.resumeId)!;
    const resumeResolution = await resolveReferences(req, resume, { [fixture.contactKey]: "Chị Lan", [fixture.accountKey]: accountName } as any);
    expect(resumeResolution.errors).toEqual([]);
    await callOperation(req, resume, resumeResolution.values as any);
    const expectedResumePath = fixture.resumePath.replace(/:recipientId|:conversationId/, "507f1f77bcf86cd799439202");
    const resumeRequest = requests.find(request => request.url.pathname === expectedResumePath && request.init?.method === "POST");
    expect(resumeRequest?.url.pathname).toBe(expectedResumePath);
    expect(resumeRequest?.url.searchParams.get(fixture.accountApiKey)).toBe(fixture.externalId);

    const reply = ASSISTANT_OPERATIONS.find(operation => operation.id === fixture.replyId)!;
    const accountBodyKey = fixture.platform === "Facebook" ? "pageId" : "accountId";
    const replyResolution = await resolveReferences(req, reply, {
      [accountBodyKey]: accountName,
      [fixture.bodyContactKey]: "Chị Lan",
      text: `Xin chào khách hàng trên ${fixture.platform}.`,
    } as any);
    expect(replyResolution.errors).toEqual([]);
    expect(replyResolution.values[fixture.bodyContactKey]).toBe("507f1f77bcf86cd799439202");
    expect(replyResolution.values[accountBodyKey]).toBe(fixture.externalId);
    const sent = await callOperation(req, reply, replyResolution.values as any);
    const replyRequest = requests.find(request => request.url.pathname === fixture.replyPath && request.init?.method === "POST")!;
    expect(JSON.parse(String(replyRequest.init?.body))).toEqual({
      [accountBodyKey]: fixture.externalId,
      [fixture.bodyContactKey]: "507f1f77bcf86cd799439202",
      text: `Xin chào khách hàng trên ${fixture.platform}.`,
    });
    expect(formatAssistantResult(reply, sent.data)).toContain("đã hoàn tất");
    expect(JSON.stringify(sent)).not.toMatch(/507f1f77bcf86cd79943920[12]|PAGE-ALPHA|OA-ALPHA|TIKTOK-ALPHA|PRIVATE-RECIPIENT/);
  }
  const accountRequests = requests.filter(request => request.url.pathname === "/api/v1/omni-inbox/accounts");
  expect(accountRequests.map(request => request.url.searchParams.get("platform"))).toEqual(["Facebook", "Facebook", "Facebook", "Zalo", "Zalo", "Zalo", "TikTok", "TikTok", "TikTok"]);
});

it("runs bounded company-knowledge simulations with server-owned scope and history", async () => {
  const requests: Array<{ url: URL; init?: RequestInit }> = [];
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    requests.push({ url: input, init });
    if (input.pathname.endsWith("/test-search")) {
      return new Response(JSON.stringify({
        status: "success", matches: 1, bestScore: 0.9, simulatedAnswer: "Mở cửa lúc 9 giờ.",
        items: [{ title: "Giờ hoạt động", documentType: "policy", text: "PRIVATE EXCERPT", sourceUrl: "https://private.example/doc" }],
      }), { status: 200 });
    }
    if (input.pathname.endsWith("/clear-all")) {
      return new Response(JSON.stringify({ status: "success", message: "Đã xóa kho của công ty TEST." }), { status: 200 });
    }
    return new Response(JSON.stringify({ status: "success", data: {
      text: "Đây là câu trả lời mô phỏng.", stage: "Tư vấn", nextStep: "Hỏi thêm nhu cầu", sources: ["Kho tri thức"],
      mode: "ai", known: { phone: "PRIVATE-PHONE" },
    } }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);

  const search = ASSISTANT_OPERATIONS.find(operation => operation.id === "company-knowledge.test-search")!;
  const searched = await callOperation(req, search, {
    query: "Giờ mở cửa?", channel: "zalo", pageId: "PRIVATE-PAGE-ID", topK: 20,
  } as any);
  const searchRequest = requests[0];
  expect(searchRequest.url.searchParams.get("companyCode")).toBe("TEST");
  expect(JSON.parse(String(searchRequest.init?.body))).toEqual({ query: "Giờ mở cửa?", channel: "zalo" });
  const searchReply = formatAssistantResult(search, searched.data ?? searched);
  expect(searchReply).toContain("Mở cửa lúc 9 giờ.");
  expect(searchReply).toContain("Giờ hoạt động");
  expect(searchReply).not.toMatch(/PRIVATE|private\.example|sourceUrl|\{/);

  const simulation = ASSISTANT_OPERATIONS.find(operation => operation.id === "company-knowledge.page-chat.simulate")!;
  const simulated = await callOperation(req, simulation, { message: "Khách muốn hỏi giờ mở cửa." } as any);
  const simulationRequest = requests[1];
  expect(simulationRequest.url.searchParams.get("companyCode")).toBe("TEST");
  expect(JSON.parse(String(simulationRequest.init?.body))).toEqual({ message: "Khách muốn hỏi giờ mở cửa.", history: [] });
  const simulationReply = formatAssistantResult(simulation, simulated.data);
  expect(simulationReply).toContain("Đây là câu trả lời mô phỏng.");
  expect(simulationReply).not.toMatch(/PRIVATE-PHONE|known|\{/);
});

it("runs a confirmed AI reply preview without conversation ids, images, or log identifiers", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
    text: "Xin chào, bên em sẵn sàng tư vấn.", mode: "trained", contextMatches: 2,
    dryRun: true, logId: "507f1f77bcf86cd799439093", companyCode: "PRIVATE-COMPANY",
    orderPreview: { orderId: "PRIVATE-ORDER" },
  }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "omni-inbox.ai-reply.test")!;
  const result = await callOperation(req, operation, {
    message: "Tôi muốn hỏi về sản phẩm.", channel: "zalo", images: ["PRIVATE-IMAGE"], conversationId: "507f1f77bcf86cd799439094", platformId: "PRIVATE-PAGE",
  } as any);
  const url = fetcher.mock.calls[0][0] as URL;
  expect(url.pathname).toBe("/api/v1/gemini/test-reply");
  expect(url.searchParams.get("companyCode")).toBe("TEST");
  expect(JSON.parse(String(fetcher.mock.calls[0][1].body))).toEqual({ message: "Tôi muốn hỏi về sản phẩm.", channel: "zalo" });
  const reply = formatAssistantResult(operation, result.data ?? result);
  expect(reply).toContain("Câu trả lời thử: Xin chào, bên em sẵn sàng tư vấn.");
  expect(reply).not.toMatch(/PRIVATE|507f1f77bcf86cd79943909[34]|\{/);
});

it("limits paid AI campaign planning to consistent schedules and readable draft summaries", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
    campaignTitle: "Ra mắt sản phẩm mới", contentPillars: ["Hướng dẫn", "Khách hàng"],
    slots: [
      { scheduledDate: "2026-11-01", scheduledTime: "09:00", channel: "Facebook", pillar: "Hướng dẫn", topicBrief: "Giới thiệu cách chọn sản phẩm phù hợp.", internalId: "PRIVATE-ID" },
      { scheduledDate: "2026-11-01", scheduledTime: "15:00", channel: "TikTok", pillar: "Khách hàng", topicBrief: "Chia sẻ câu chuyện trải nghiệm." },
    ], debug: "PRIVATE-DEBUG",
  }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.ai.scheduled-campaign")!;
  const input = {
    prompt: "Giới thiệu bộ sản phẩm mới", startDate: "2026-11-01", endDate: "2026-11-01", postsPerDay: 2,
    postingTimes: '["09:00","15:00"]', channels: '["Facebook","TikTok"]',
  } as any;
  const result = await callOperation(req, operation, input);
  const url = fetcher.mock.calls[0][0] as URL;
  expect(url.pathname).toBe("/api/v1/gemini/scheduled-campaign");
  expect(url.searchParams.get("companyCode")).toBe("TEST");
  expect(JSON.parse(String(fetcher.mock.calls[0][1].body))).toEqual({
    prompt: input.prompt, startDate: input.startDate, endDate: input.endDate, postsPerDay: 2,
    postingTimes: ["09:00", "15:00"], channels: ["Facebook", "TikTok"],
  });
  const reply = formatAssistantResult(operation, result.data ?? result);
  expect(reply).toContain("Ra mắt sản phẩm mới");
  expect(reply).toContain("2026-11-01 09:00 · Facebook");
  expect(reply).toContain("Bản nháp chưa được lưu hoặc lên lịch.");
  expect(reply).not.toMatch(/PRIVATE|debug|\{/);

  await expect(callOperation(req, operation, { ...input, postsPerDay: 1 } as any))
    .rejects.toThrow("Số bài mỗi ngày phải khớp");
  await expect(callOperation(req, operation, { ...input, endDate: "2026-12-01" } as any))
    .rejects.toThrow("tối đa 30 ngày");
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("reads a week of marketing slots while filtering campaign and integration identifiers", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "success", data: {
    timezone: "Asia/Bangkok",
    slots: [
      { _id: "PRIVATE-SLOT-ID", campaignId: "PRIVATE-CAMPAIGN-ID", campaignTitle: "Ra mắt bộ sưu tập", campaignType: "campaign", scheduledAt: "2026-11-01T02:00:00.000Z", platform: "Facebook", status: "pending_approval", mediaType: "image", topicBrief: "Giới thiệu sản phẩm mới", integrationId: "PRIVATE-INTEGRATION-ID", accessToken: "PRIVATE-TOKEN" },
      { _id: "PRIVATE-SLOT-ID-2", campaignId: "PRIVATE-CAMPAIGN-ID", campaignTitle: "Ra mắt bộ sưu tập", campaignType: "campaign", scheduledAt: "2026-11-02T02:00:00.000Z", platform: "TikTok", status: "published", mediaType: "video", topicBrief: "Chia sẻ cách sử dụng" },
    ],
  } }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.campaign.calendar")!;
  const result = await callOperation(req, operation, { query_startDate: "2026-11-01", query_endDate: "2026-11-07" } as any);
  const url = fetcher.mock.calls[0][0] as URL;
  expect(url.pathname).toBe("/api/v1/marketing-campaigns/calendar");
  expect(url.searchParams.get("startDate")).toBe("2026-11-01");
  expect(url.searchParams.get("endDate")).toBe("2026-11-07");
  expect(result.data).toEqual([
    { campaignTitle: "Ra mắt bộ sưu tập", campaignType: "campaign", scheduledAt: "2026-11-01T02:00:00.000Z", platform: "Facebook", status: "pending_approval", mediaType: "image", topicBrief: "Giới thiệu sản phẩm mới" },
    { campaignTitle: "Ra mắt bộ sưu tập", campaignType: "campaign", scheduledAt: "2026-11-02T02:00:00.000Z", platform: "TikTok", status: "published", mediaType: "video", topicBrief: "Chia sẻ cách sử dụng" },
  ]);
  const reply = formatAssistantResult(operation, result.data);
  expect(reply).toContain("Kênh đăng: Facebook");
  expect(reply).toContain("Trạng thái: Chờ duyệt");
  expect(reply).toContain("2026-11-01");
  expect(reply).not.toMatch(/PRIVATE|accessToken|\{/);
  await expect(callOperation(req, operation, { query_startDate: "2026-11-01", query_endDate: "2026-11-08" } as any))
    .rejects.toThrow("tối đa 7 ngày");
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("looks up a campaign by visible title and confirms a permitted lifecycle transition", async () => {
  const campaignId = "507f1f77bcf86cd799439811";
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/marketing-campaigns/assistant/summaries" && init?.method === "GET") {
      return new Response(JSON.stringify({ status: "success", data: { campaigns: [{
        _id: campaignId, title: "Ra mắt mùa hè", campaignType: "campaign", status: "active",
        startDate: "2026-11-01", endDate: "2026-11-30", postsPerDay: 2, sourceBrief: "PRIVATE-BRIEF",
        companyCode: "TEST", integrationIds: { Facebook: "PRIVATE-INTEGRATION" },
      }], pagination: { page: 1, limit: 100, total: 1 } } }), { status: 200 });
    }
    if (input.pathname === "/api/v1/marketing-campaigns/" + campaignId + "/pause" && init?.method === "POST") {
      return new Response(JSON.stringify({ status: "success", data: {
        title: "Ra mắt mùa hè", status: "paused", startDate: "2026-11-01", endDate: "2026-11-30",
        companyCode: "PRIVATE-COMPANY", sourceBrief: "PRIVATE-BRIEF", campaignId,
      } }), { status: 200 });
    }
    return new Response(JSON.stringify({ status: "error", message: "Unexpected route" }), { status: 404 });
  });
  vi.stubGlobal("fetch", fetcher);
  const list = ASSISTANT_OPERATIONS.find(operation => operation.id === "marketing.campaign.list")!;
  expect(await lookupRecords(req, list.id, "Ra mắt mùa hè")).toMatchObject([{
    id: campaignId, title: "Ra mắt mùa hè", status: "active", campaignType: "campaign",
  }]);
  const listResult = await callOperation(req, list, { query_search: "Ra mắt mùa hè" } as any);
  const listReply = formatAssistantResult(list, listResult.data);
  expect(listReply).toContain("Tiêu đề: Ra mắt mùa hè");
  expect(listReply).toContain("Trạng thái: Đang chạy");
  expect(listReply).not.toMatch(/PRIVATE|integrationIds|companyCode|\{/);
  const summaryRequest = fetcher.mock.calls.find(([url]) => (url as URL).pathname === list.path.replace(/^/, "/api/v1"))!;
  expect((summaryRequest[0] as URL).searchParams.get("search")).toBe("Ra mắt mùa hè");
  expect(JSON.stringify(await lookupRecords(req, list.id, "Ra mắt mùa hè"))).not.toMatch(/PRIVATE|integrationIds/);

  const lifecycle = ASSISTANT_OPERATIONS.find(operation => operation.id === "marketing.campaign.lifecycle")!;
  const resolved = await resolveReferences(req, lifecycle, { path_id: "Ra mắt mùa hè", path_action: "pause" } as any);
  expect(resolved.errors).toEqual([]);
  expect(resolved.values).toMatchObject({ path_id: campaignId, path_action: "pause" });
  const result = await callOperation(req, lifecycle, resolved.values as any);
  const reply = formatAssistantResult(lifecycle, result.data);
  expect(reply).toContain("Tiêu đề: Ra mắt mùa hè");
  expect(reply).toContain("Trạng thái: Đã tạm dừng");
  expect(fetcher.mock.calls.at(-1)?.[0]).toMatchObject({ pathname: "/api/v1/marketing-campaigns/" + campaignId + "/pause" });
  expect(reply).not.toMatch(/PRIVATE|integrationIds|campaignId|\{/);
});

it("reverts only a change-bearing Content Sheet revision within its named campaign", async () => {
  const campaignId = "507f1f77bcf86cd799439821";
  const revisionId = "507f1f77bcf86cd799439822";
  const alreadyRevertedId = "507f1f77bcf86cd799439823";
  const revisionsPath = `/api/v1/marketing-campaigns/${campaignId}/sheet/revisions`;
  const revertPath = `${revisionsPath}/${revisionId}/revert`;
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/marketing-campaigns/assistant/summaries" && init?.method === "GET") {
      return new Response(JSON.stringify({ status: "success", data: { campaigns: [{
        _id: campaignId, title: "Ra mắt mùa hè", campaignType: "campaign", status: "active", companyCode: "TEST",
      }] } }), { status: 200 });
    }
    if (input.pathname === revisionsPath && init?.method === "GET") {
      return new Response(JSON.stringify({ status: "success", data: [
        { _id: revisionId, baseRevision: 4, actorType: "user", createdAt: "2026-10-31T10:00:00.000Z", operation: "update_row", companyCode: "TEST", changes: [{ slotId: "PRIVATE-SLOT", fieldKey: "headline", before: "Trước", after: "Sau" }] },
        { _id: alreadyRevertedId, baseRevision: 4, actorType: "user", createdAt: "2026-10-31T11:00:00.000Z", operation: `revert:${revisionId}`, companyCode: "TEST", changes: [] },
      ] }), { status: 200 });
    }
    if (input.pathname === revertPath && init?.method === "POST") {
      return new Response(JSON.stringify({ status: "success", data: { revertedRows: 1, conflicts: ["PRIVATE-SLOT: lỗi nội bộ"] } }), { status: 207 });
    }
    return new Response(JSON.stringify({ status: "error", message: "Unexpected route" }), { status: 404 });
  });
  vi.stubGlobal("fetch", fetcher);

  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.campaign.sheet.revisions.revert")!;
  expect(operation.fields.find(field => field.key === "path_revisionId")).toMatchObject({ source: "path", apiKey: "revisionId", reference: "marketing.campaign.sheet.revisions.list" });
  const revisionRows = await lookupRecords(req, "marketing.campaign.sheet.revisions.list", "4", { path_id: campaignId });
  expect(revisionRows.map(row => ({ id: row.id, baseRevision: row.baseRevision, revertible: row.__assistantRevertible }))).toEqual([
    { id: revisionId, baseRevision: 4, revertible: true },
    { id: alreadyRevertedId, baseRevision: 4, revertible: false },
  ]);
  expect(revisionRows[0].__assistantRevisionAction).toBe("Sửa dòng");
  const revisionField = operation.fields.find(field => field.key === "path_revisionId")!;
  const revisionChoices = await suggestReferenceOptions(req, operation, revisionField, { path_id: "Ra mắt mùa hè" } as any);
  expect(revisionChoices).toHaveLength(1);
  expect(revisionChoices[0]).toContain("Content Sheet · phiên nền 4 · Sửa dòng");
  expect(revisionChoices[0]).toContain("người dùng");
  expect(revisionChoices[0]).toContain("1 ô thay đổi");
  expect(revisionChoices[0]).not.toMatch(/507f1f77|PRIVATE|Bản ghi/);
  const matchingRows = await lookupRecords(req, "marketing.campaign.sheet.revisions.list", revisionChoices[0], { path_id: campaignId });
  expect(matchingRows.map(row => row.__assistantRevisionAction)).toEqual(["Sửa dòng"]);
  const chosenRevision = await resolveReferences(req, operation, { path_id: "Ra mắt mùa hè", path_revisionId: revisionChoices[0] } as any);
  expect(chosenRevision.errors).toEqual([]);
  expect(chosenRevision.values).toMatchObject({ path_id: campaignId, path_revisionId: revisionId });
  const resolution = await resolveReferences(req, operation, { path_id: "Ra mắt mùa hè", path_revisionId: "4" } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values).toMatchObject({ path_id: campaignId, path_revisionId: revisionId });
  expect(JSON.stringify(resolution.labels)).not.toMatch(/507f1f77|PRIVATE/);

  const result = await callOperation(req, operation, resolution.values as any);
  expect(fetcher.mock.calls.some(([url, init]) => (url as URL).pathname === revisionsPath && init?.method === "GET")).toBe(true);
  const write = fetcher.mock.calls.find(([url, init]) => (url as URL).pathname === revertPath && init?.method === "POST")!;
  expect(JSON.parse(String(write[1].body))).toEqual({});
  expect(result.data).toEqual({ revertedRows: 1, conflictCount: 1 });
  const reply = formatAssistantResult(operation, result.data);
  expect(reply).toContain("Số dòng đã hoàn tác: 1");
  expect(reply).toContain("Số dòng xung đột: 1");
  expect(reply).not.toMatch(/PRIVATE|507f1f77|\{/);
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE|507f1f77|changes|operation/);

  const alreadyReverted = await resolveReferences(req, operation, { path_id: "Ra mắt mùa hè", path_revisionId: "Phiên bản lúc 11 giờ" } as any);
  expect(alreadyReverted.errors.join(" ")).toContain("chưa tìm thấy bản ghi");
  expect(alreadyReverted.errors.join(" ")).not.toMatch(/507f1f77|PRIVATE/);
});

it("resolves campaign Orders by name, binds current revisions, and returns only safe AI proposal fields", async () => {
  const campaignId = "507f1f77bcf86cd799439161";
  const orderId = "507f1f77bcf86cd799439162";
  const campaignPath = "/api/v1/marketing-campaigns/assistant/summaries";
  const orderListPath = `/api/v1/marketing-campaigns/${campaignId}/asset-orders/assistant-summaries`;
  const updatePath = `/api/v1/marketing-campaigns/${campaignId}/asset-orders/${orderId}`;
  const previewPath = `${updatePath}/ai/preview`;
  const applyPath = `${updatePath}/ai/apply`;
  const campaign = { _id: campaignId, title: "Ra mắt mùa hè", campaignType: "campaign", status: "active" };
  const order = { _id: orderId, title: "Brief video", contentGroup: "Hướng dẫn", headline: "Dùng đúng sản phẩm", status: "draft", format: "video", quantitySuggestion: "2 video", revision: 4, updatedAt: "2026-11-01T02:00:00.000Z" };
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === campaignPath) return new Response(JSON.stringify({ status: "success", data: [campaign] }), { status: 200 });
    if (input.pathname === orderListPath) return new Response(JSON.stringify({ status: "success", data: [{ ...order, assets: [{ sourceUrl: "PRIVATE-ASSET-URL" }], customFields: { secret: "PRIVATE-CUSTOM-FIELD" } }] }), { status: 200 });
    if (input.pathname === updatePath && init?.method === "PATCH") {
      const body = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ status: "success", data: { ...order, headline: body.headline, revision: 5, assets: [{ sourceUrl: "PRIVATE-ASSET-URL" }], companyCode: "PRIVATE-COMPANY" } }), { status: 200 });
    }
    if (input.pathname === previewPath && init?.method === "POST") {
      return new Response(JSON.stringify({ status: "success", data: {
        ...order, aiProposal: {
          headline: "Một tiêu đề gợi ý", subheadline: "Mô tả ngắn", cta: "Tìm hiểu thêm", visualBrief: "Cảnh quay sản phẩm",
          contentGroup: "Hướng dẫn", shootingContent: "Quay thao tác", productionRequirements: "Ánh sáng rõ", quantitySuggestion: "2 video",
          format: "video", videoScript: "Mở đầu, trình bày và kết luận", warnings: ["Cần xác nhận thông tin sản phẩm"],
          references: [{ id: "PRIVATE-KNOWLEDGE-ID", title: "PRIVATE-KNOWLEDGE" }], customFields: { secret: "PRIVATE-CUSTOM-FIELD" },
        }, companyCode: "PRIVATE-COMPANY", assets: [{ sourceUrl: "PRIVATE-ASSET-URL" }],
      } }), { status: 200 });
    }
    if (input.pathname === applyPath && init?.method === "POST") {
      return new Response(JSON.stringify({ status: "success", data: { ...order, revision: 5, headline: "Một tiêu đề gợi ý", companyCode: "PRIVATE-COMPANY" } }), { status: 200 });
    }
    return new Response(JSON.stringify({ status: "error", message: "Unexpected route" }), { status: 404 });
  });
  vi.stubGlobal("fetch", fetcher);

  const list = ASSISTANT_OPERATIONS.find(operation => operation.id === "marketing.campaign.asset-orders.list")!;
  const listed = await callOperation(req, list, { path_id: campaignId, query_search: "Brief" } as any);
  expect(formatAssistantResult(list, listed.data)).toContain("Tiêu đề: Brief video");
  expect(JSON.stringify(await lookupRecords(req, list.id, "Brief", { path_id: campaignId }))).not.toMatch(/PRIVATE|assets|customFields/);

  const update = ASSISTANT_OPERATIONS.find(operation => operation.id === "marketing.campaign.asset-order.update")!;
  const resolved = await resolveReferences(req, update, { path_id: "Ra mắt mùa hè", path_orderId: "Brief video", headline: "Tiêu đề mới" } as any);
  expect(resolved.errors).toEqual([]);
  expect(resolved.values).toMatchObject({ path_id: campaignId, path_orderId: orderId, expectedRevision: 4 });
  const updated = await callOperation(req, update, resolved.values as any);
  const updateCall = fetcher.mock.calls.find(([url, init]) => (url as URL).pathname === updatePath && init?.method === "PATCH")!;
  expect(JSON.parse(String(updateCall[1].body))).toEqual({ headline: "Tiêu đề mới", expectedRevision: 4 });
  const updateReply = formatAssistantResult(update, updated.data);
  expect(updateReply).toContain("Tiêu đề hiển thị: Tiêu đề mới");
  expect(updateReply).not.toMatch(/PRIVATE|assets|companyCode/);

  const preview = ASSISTANT_OPERATIONS.find(operation => operation.id === "marketing.campaign.asset-order.ai.preview")!;
  const previewResolved = await resolveReferences(req, preview, { path_id: "Ra mắt mùa hè", path_orderId: "Brief video", instruction: "Tập trung vào cách sử dụng" } as any);
  expect(previewResolved.errors).toEqual([]);
  const proposal = await callOperation(req, preview, previewResolved.values as any, undefined, "asset-order-preview-request");
  const previewCall = fetcher.mock.calls.find(([url, init]) => (url as URL).pathname === previewPath && init?.method === "POST")!;
  expect(JSON.parse(String(previewCall[1].body))).toMatchObject({ idempotencyKey: "asset-order-preview-request", instruction: "Tập trung vào cách sử dụng" });
  const previewReply = formatAssistantResult(preview, proposal.data);
  expect(previewReply).toContain("Tiêu đề hiển thị: Một tiêu đề gợi ý");
  expect(previewReply).toContain("Kịch bản video: Mở đầu, trình bày và kết luận");
  expect(previewReply).not.toMatch(/PRIVATE|references|assets|customFields|companyCode/);
  expect(JSON.stringify(proposal)).not.toMatch(/PRIVATE|references|assets|customFields|companyCode/);

  const apply = ASSISTANT_OPERATIONS.find(operation => operation.id === "marketing.campaign.asset-order.ai.apply")!;
  const applyResolved = await resolveReferences(req, apply, { path_id: "Ra mắt mùa hè", path_orderId: "Brief video" } as any);
  expect(applyResolved.errors).toEqual([]);
  expect(applyResolved.values.expectedRevision).toBe(4);
  await callOperation(req, apply, applyResolved.values as any);
  const applyCall = fetcher.mock.calls.find(([url, init]) => (url as URL).pathname === applyPath && init?.method === "POST")!;
  expect(JSON.parse(String(applyCall[1].body))).toEqual({ expectedRevision: 4 });
});

it("lists Content Sheet AI jobs safely and resolves cancel/retry by campaign and eligible job status", async () => {
  const campaignId = "507f1f77bcf86cd799439171";
  const queuedId = "507f1f77bcf86cd799439172";
  const failedId = "507f1f77bcf86cd799439173";
  const completedId = "507f1f77bcf86cd799439174";
  const campaignPath = "/api/v1/marketing-campaigns/assistant/summaries";
  const jobsPath = `/api/v1/marketing-campaigns/${campaignId}/sheet/ai/jobs/assistant-summaries`;
  const cancelPath = `/api/v1/marketing-campaigns/${campaignId}/sheet/ai/jobs/${queuedId}/cancel`;
  const retryPath = `/api/v1/marketing-campaigns/${campaignId}/sheet/ai/jobs/${failedId}/retry`;
  const campaign = { _id: campaignId, title: "Chiến dịch mùa hè", campaignType: "campaign", status: "active" };
  const jobs = [
    { _id: queuedId, operation: "cell", status: "queued", totalItems: 3, completedItems: 0, failedItems: 0, conflictedItems: 0, progress: 0 },
    { _id: failedId, operation: "row", status: "failed", totalItems: 4, completedItems: 1, failedItems: 3, conflictedItems: 0, progress: 25 },
    { _id: completedId, operation: "column", status: "completed", totalItems: 2, completedItems: 2, failedItems: 0, conflictedItems: 0, progress: 100 },
  ].map(job => ({ ...job, companyCode: "TEST", proposals: [{ prompt: "PRIVATE-PROPOSAL" }], errorMessage: "PRIVATE-ERROR", estimatedCost: 99, actualCost: 98, idempotencyKey: "PRIVATE-IDEMPOTENCY" }));
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === campaignPath) return new Response(JSON.stringify({ status: "success", data: [campaign] }), { status: 200 });
    if (input.pathname === jobsPath) return new Response(JSON.stringify({ status: "success", data: jobs }), { status: 200 });
    if (input.pathname === cancelPath) return new Response(JSON.stringify({ status: "success", data: { ...jobs[0], status: "cancelled", completedAt: "2026-11-01T02:00:00.000Z" } }), { status: 200 });
    if (input.pathname === retryPath) return new Response(JSON.stringify({ status: "success", data: { ...jobs[1], status: "queued", progress: 25 } }), { status: 202 });
    throw new Error(`Unexpected request: ${input.pathname} (${init?.method})`);
  });
  vi.stubGlobal("fetch", fetcher);

  const list = ASSISTANT_OPERATIONS.find(operation => operation.id === "marketing.campaign.sheet.ai.jobs.list")!;
  const listed = await callOperation(req, list, { path_id: campaignId, query_status: "failed", query_limit: 10 } as any);
  expect((fetcher.mock.calls.find(([url]) => (url as URL).pathname === jobsPath)?.[0] as URL).searchParams.get("status")).toBe("failed");
  const listReply = formatAssistantResult(list, listed.data);
  expect(listReply).toContain("Loại thao tác: Cột");
  expect(listReply).toContain("Trạng thái: Hoàn tất");
  expect(listReply).not.toMatch(/PRIVATE|companyCode|proposals|errorMessage|estimatedCost|actualCost|idempotencyKey|507f1f77bcf86cd79943917[234]/);
  const summaries = await lookupRecords(req, list.id, "", { path_id: campaignId });
  expect(summaries).toHaveLength(3);
  expect(JSON.stringify(summaries)).not.toMatch(/PRIVATE|companyCode|proposals|errorMessage|estimatedCost|actualCost|idempotencyKey/);

  const cancel = ASSISTANT_OPERATIONS.find(operation => operation.id === "marketing.campaign.sheet.ai.job.cancel")!;
  const queuedLabel = "AI Content Sheet · Ô dữ liệu · Đang chờ · 0%";
  const cancelResolution = await resolveReferences(req, cancel, { path_id: "Chiến dịch mùa hè", path_jobId: queuedLabel } as any);
  expect(cancelResolution.errors).toEqual([]);
  expect(cancelResolution.values).toMatchObject({ path_id: campaignId, path_jobId: queuedId });
  const cancelled = await callOperation(req, cancel, cancelResolution.values as any);
  expect(fetcher.mock.calls.some(([url, init]) => (url as URL).pathname === cancelPath && init?.method === "POST")).toBe(true);
  expect(JSON.stringify(cancelled)).not.toMatch(/PRIVATE|companyCode|proposals|errorMessage|estimatedCost|actualCost|idempotencyKey/);
  expect(formatAssistantResult(cancel, cancelled.data)).toContain("Trạng thái: Đã hủy");

  const retry = ASSISTANT_OPERATIONS.find(operation => operation.id === "marketing.campaign.sheet.ai.job.retry")!;
  const failedLabel = "AI Content Sheet · Dòng · Thất bại · 25%";
  const retryResolution = await resolveReferences(req, retry, { path_id: "Chiến dịch mùa hè", path_jobId: failedLabel } as any);
  expect(retryResolution.errors).toEqual([]);
  expect(retryResolution.values).toMatchObject({ path_id: campaignId, path_jobId: failedId });
  const retried = await callOperation(req, retry, retryResolution.values as any);
  expect(fetcher.mock.calls.some(([url, init]) => (url as URL).pathname === retryPath && init?.method === "POST")).toBe(true);
  expect(JSON.stringify(retried)).not.toMatch(/PRIVATE|companyCode|proposals|errorMessage|estimatedCost|actualCost|idempotencyKey/);
  expect(formatAssistantResult(retry, retried.data)).toContain("Trạng thái: Đang chờ");

  const invalidCancel = await resolveReferences(req, cancel, { path_id: campaignId, path_jobId: failedLabel } as any);
  expect(invalidCancel.errors).toHaveLength(1);
  const invalidRetry = await resolveReferences(req, retry, { path_id: campaignId, path_jobId: queuedLabel } as any);
  expect(invalidRetry.errors).toHaveLength(1);
});

it("lists asset-order AI fill jobs safely and cancels an eligible run by visible label", async () => {
  const campaignId = "507f1f77bcf86cd799439181";
  const queuedId = "507f1f77bcf86cd799439182";
  const completedId = "507f1f77bcf86cd799439183";
  const campaignPath = "/api/v1/marketing-campaigns/assistant/summaries";
  const jobsPath = `/api/v1/marketing-campaigns/${campaignId}/asset-orders/ai/jobs/assistant-summaries`;
  const cancelPath = `/api/v1/marketing-campaigns/${campaignId}/asset-orders/ai/jobs/${queuedId}/cancel`;
  const campaign = { _id: campaignId, title: "Ra mắt mùa thu", campaignType: "campaign", status: "active" };
  const jobs = [
    { _id: queuedId, operation: "fill_all", status: "queued", totalItems: 5, completedItems: 0, failedItems: 0, skippedItems: 0, conflictedItems: 0, progress: 0 },
    { _id: completedId, operation: "fill_all", status: "completed", totalItems: 2, completedItems: 2, failedItems: 0, skippedItems: 0, conflictedItems: 0, progress: 100 },
  ].map(job => ({ ...job, companyCode: "TEST", instruction: "PRIVATE-INSTRUCTION", targetOrderIds: ["PRIVATE-ORDER-ID"], results: [{ orderId: "PRIVATE-ORDER-ID" }], errorMessage: "PRIVATE-ERROR", estimatedCost: 10, actualCost: 9, idempotencyKey: "PRIVATE-IDEMPOTENCY" }));
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === campaignPath) return new Response(JSON.stringify({ status: "success", data: [campaign] }), { status: 200 });
    if (input.pathname === jobsPath) return new Response(JSON.stringify({ status: "success", data: jobs }), { status: 200 });
    if (input.pathname === cancelPath) return new Response(JSON.stringify({ status: "success", data: { ...jobs[0], status: "cancelled", completedAt: "2026-11-01T02:00:00.000Z" } }), { status: 200 });
    throw new Error(`Unexpected request: ${input.pathname} (${init?.method})`);
  });
  vi.stubGlobal("fetch", fetcher);

  const list = ASSISTANT_OPERATIONS.find(operation => operation.id === "marketing.campaign.asset-order.ai.jobs.list")!;
  const listed = await callOperation(req, list, { path_id: campaignId, query_status: "queued", query_limit: 10 } as any);
  const listReply = formatAssistantResult(list, listed.data);
  expect(listReply).toContain("Loại thao tác: Điền hàng loạt Order");
  expect(listReply).toContain("Trạng thái: Đang chờ");
  expect(listReply).not.toMatch(/PRIVATE|companyCode|instruction|targetOrderIds|results|errorMessage|estimatedCost|actualCost|idempotencyKey|507f1f77bcf86cd79943918[23]/);
  const summaries = await lookupRecords(req, list.id, "", { path_id: campaignId });
  expect(summaries).toHaveLength(2);
  expect(JSON.stringify(summaries)).not.toMatch(/PRIVATE|companyCode|instruction|targetOrderIds|results|errorMessage|estimatedCost|actualCost|idempotencyKey/);

  const cancel = ASSISTANT_OPERATIONS.find(operation => operation.id === "marketing.campaign.asset-order.ai.job.cancel")!;
  const resolution = await resolveReferences(req, cancel, {
    path_id: "Ra mắt mùa thu",
    path_jobId: "AI điền Order · Điền hàng loạt Order · Đang chờ · 0%",
  } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values).toMatchObject({ path_id: campaignId, path_jobId: queuedId });
  const result = await callOperation(req, cancel, resolution.values as any);
  expect(fetcher.mock.calls.some(([url, init]) => (url as URL).pathname === cancelPath && init?.method === "POST")).toBe(true);
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE|companyCode|instruction|targetOrderIds|results|errorMessage|estimatedCost|actualCost|idempotencyKey/);
  expect(formatAssistantResult(cancel, result.data)).toContain("Trạng thái: Đã hủy");

  const completedResolution = await resolveReferences(req, cancel, {
    path_id: campaignId,
    path_jobId: "AI điền Order · Điền hàng loạt Order · Hoàn tất · 100%",
  } as any);
  expect(completedResolution.errors).toHaveLength(1);
});

it("rejects, approves, or retries a named campaign slot only in its allowed status", async () => {
  const campaignId = "507f1f77bcf86cd799439111";
  const otherCampaignId = "507f1f77bcf86cd799439114";
  const pendingSlotId = "507f1f77bcf86cd799439112";
  const publishedSlotId = "507f1f77bcf86cd799439113";
  const otherSlotId = "507f1f77bcf86cd799439115";
  const retryableSlotId = "507f1f77bcf86cd799439116";
  const slots = [
    { _id: pendingSlotId, campaignId, campaignTitle: "Ra mắt bộ sưu tập", campaignType: "campaign", scheduledAt: "2026-11-01T02:00:00.000Z", platform: "Facebook", status: "pending_approval", mediaType: "image", topicBrief: "Giới thiệu sản phẩm mới", accessToken: "PRIVATE-TOKEN" },
    { _id: publishedSlotId, campaignId, campaignTitle: "Ra mắt bộ sưu tập", campaignType: "campaign", scheduledAt: "2026-11-02T02:00:00.000Z", platform: "TikTok", status: "published", mediaType: "video", topicBrief: "Chia sẻ cách sử dụng" },
    { _id: otherSlotId, campaignId: otherCampaignId, campaignTitle: "Chiến dịch khác", campaignType: "campaign", scheduledAt: "2026-11-03T02:00:00.000Z", platform: "Facebook", status: "pending_approval", mediaType: "text", topicBrief: "Nội dung khác" },
    { _id: retryableSlotId, campaignId, campaignTitle: "Ra mắt bộ sưu tập", campaignType: "campaign", scheduledAt: "2026-11-04T02:00:00.000Z", platform: "TikTok", status: "needs_attention", mediaType: "video", topicBrief: "Cần tạo lại nội dung" },
  ];
  const reason = "Cần chỉnh sửa thông tin sản phẩm trước khi đăng.";
  const rejectPath = "/api/v1/marketing-campaigns/" + campaignId + "/slots/" + pendingSlotId + "/reject";
  const approvePath = "/api/v1/marketing-campaigns/" + campaignId + "/slots/" + pendingSlotId + "/approve";
  const retryPath = "/api/v1/marketing-campaigns/" + campaignId + "/slots/" + retryableSlotId + "/retry";
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/marketing-campaigns/calendar") {
      return new Response(JSON.stringify({ status: "success", data: { slots } }), { status: 200 });
    }
    if (input.pathname === rejectPath) {
      return new Response(JSON.stringify({ status: "success", data: {
        status: "needs_attention", scheduledAt: slots[0].scheduledAt, platform: "Facebook", mediaType: "image",
        campaignId, companyCode: "PRIVATE-COMPANY", actorId: "PRIVATE-ACTOR", accessToken: "PRIVATE-TOKEN",
      } }), { status: 200 });
    }
    if (input.pathname === approvePath) {
      return new Response(JSON.stringify({ status: "success", data: {
        status: "ready_to_publish", scheduledAt: slots[0].scheduledAt, platform: "Facebook", mediaType: "image",
        campaignId, companyCode: "PRIVATE-COMPANY", approvedBy: "PRIVATE-ACTOR",
      } }), { status: 200 });
    }
    if (input.pathname === retryPath) {
      return new Response(JSON.stringify({ status: "success", data: {
        status: "planned", scheduledAt: slots[3].scheduledAt, platform: "TikTok", mediaType: "video",
        campaignId, companyCode: "PRIVATE-COMPANY", lastError: "PRIVATE-ERROR",
      } }), { status: 200 });
    }
    throw new Error("Unexpected request: " + input.pathname + " (" + init?.method + ")");
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.campaign.slot.reject")!;
  const values = {
    query_startDate: "2026-11-01",
    query_endDate: "2026-11-07",
    path_id: "Ra mắt bộ sưu tập",
    path_slotId: "Giới thiệu sản phẩm mới",
    reason,
  } as any;
  const resolution = await resolveReferences(req, operation, values);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.path_id).toBe(campaignId);
  expect(resolution.values.path_slotId).toBe(pendingSlotId);
  expect(resolution.labels.path_id).toBe("Ra mắt bộ sưu tập");
  expect(resolution.labels.path_slotId).toContain("Facebook");

  const result = await callOperation(req, operation, resolution.values as any);
  const request = fetcher.mock.calls.find(([, init]) => init?.method === "POST")!;
  const url = request[0] as URL;
  expect(url.pathname).toBe(rejectPath);
  expect(url.searchParams.get("startDate")).toBe("2026-11-01");
  expect(url.searchParams.get("endDate")).toBe("2026-11-07");
  expect(JSON.parse(String(request[1].body))).toEqual({ reason });
  expect(result.data).toEqual({ status: "needs_attention", scheduledAt: "2026-11-01T02:00:00.000Z", platform: "Facebook", mediaType: "image" });
  const reply = formatAssistantResult(operation, result.data);
  expect(reply).toContain("Trạng thái: Cần kiểm tra");
  expect(reply).toContain("Kênh: Facebook");
  expect(reply).not.toMatch(/PRIVATE|507f1f77|accessToken|\{/);

  const approveOperation = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.campaign.slot.approve")!;
  const approveResolution = await resolveReferences(req, approveOperation, {
    query_startDate: "2026-11-01",
    query_endDate: "2026-11-07",
    path_id: "Ra mắt bộ sưu tập",
    path_slotId: "Giới thiệu sản phẩm mới",
  } as any);
  expect(approveResolution.errors).toEqual([]);
  expect(approveResolution.values.path_slotId).toBe(pendingSlotId);
  const approved = await callOperation(req, approveOperation, approveResolution.values as any);
  const approveRequest = fetcher.mock.calls.find(([url, init]) => (url as URL).pathname === approvePath && init?.method === "POST")!;
  expect((approveRequest[0] as URL).searchParams.get("startDate")).toBe("2026-11-01");
  expect((approveRequest[0] as URL).searchParams.get("endDate")).toBe("2026-11-07");
  expect(JSON.parse(String(approveRequest[1].body))).toEqual({});
  expect(approved.data).toEqual({ status: "ready_to_publish", scheduledAt: "2026-11-01T02:00:00.000Z", platform: "Facebook", mediaType: "image" });
  const approveReply = formatAssistantResult(approveOperation, approved.data);
  expect(approveReply).toContain("Trạng thái: Đã duyệt, chờ hệ thống xử lý");
  expect(approveReply).not.toMatch(/PRIVATE|507f1f77|\{/);

  const tiktokApproval = await resolveReferences(req, approveOperation, {
    query_startDate: "2026-11-01",
    query_endDate: "2026-11-07",
    path_id: "Ra mắt bộ sưu tập",
    path_slotId: "Cần tạo lại nội dung",
  } as any);
  expect(tiktokApproval.errors.join(" ")).toContain("chưa tìm thấy bản ghi");
  expect(tiktokApproval.errors.join(" ")).not.toMatch(/507f1f77|PRIVATE/);

  const nonPending = await resolveReferences(req, operation, { ...values, path_slotId: "Chia sẻ cách sử dụng" } as any);
  expect(nonPending.errors.join(" ")).toContain("chưa tìm thấy bản ghi");
  expect(nonPending.errors.join(" ")).not.toMatch(/507f1f77|PRIVATE/);

  const mismatchedCampaign = await resolveReferences(req, operation, { ...values, path_slotId: "Nội dung khác" } as any);
  expect(mismatchedCampaign.errors.join(" ")).toContain("Chiến dịch và slot đã chọn không khớp");
  expect(mismatchedCampaign.errors.join(" ")).not.toMatch(/507f1f77|PRIVATE/);

  const retryOperation = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.campaign.slot.retry")!;
  const retryResolution = await resolveReferences(req, retryOperation, {
    query_startDate: "2026-11-01",
    query_endDate: "2026-11-07",
    path_id: "Ra mắt bộ sưu tập",
    path_slotId: "Cần tạo lại nội dung",
  } as any);
  expect(retryResolution.errors).toEqual([]);
  expect(retryResolution.values.path_id).toBe(campaignId);
  expect(retryResolution.values.path_slotId).toBe(retryableSlotId);
  const retried = await callOperation(req, retryOperation, retryResolution.values as any);
  const retryRequest = fetcher.mock.calls.find(([url, init]) => (url as URL).pathname === retryPath && init?.method === "POST")!;
  expect((retryRequest[0] as URL).searchParams.get("startDate")).toBe("2026-11-01");
  expect((retryRequest[0] as URL).searchParams.get("endDate")).toBe("2026-11-07");
  expect(JSON.parse(String(retryRequest[1].body))).toEqual({});
  expect(retried.data).toEqual({ status: "planned", scheduledAt: "2026-11-04T02:00:00.000Z", platform: "TikTok", mediaType: "video" });
  const retryReply = formatAssistantResult(retryOperation, retried.data);
  expect(retryReply).toContain("Trạng thái: Đã đưa vào hàng đợi thử lại");
  expect(retryReply).toContain("Kênh: TikTok");
  expect(retryReply).not.toMatch(/PRIVATE|507f1f77|lastError|\{/);
  expect(fetcher.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(3);
});

it("suggests and resolves editable or publishable campaign slots by name and schedule", async () => {
  const campaignId = "507f1f77bcf86cd799439121";
  const pendingSlotId = "507f1f77bcf86cd799439122";
  const tiktokSlotId = "507f1f77bcf86cd799439123";
  const publishedSlotId = "507f1f77bcf86cd799439124";
  const slots = [
    { _id: pendingSlotId, campaignId, campaignTitle: "Ra mắt sản phẩm", scheduledAt: "2026-11-04T02:00:00.000Z", platform: "Facebook", status: "pending_approval", mediaType: "image", topicBrief: "Ưu đãi tháng 11" },
    { _id: tiktokSlotId, campaignId, campaignTitle: "Ra mắt sản phẩm", scheduledAt: "2026-11-05T02:00:00.000Z", platform: "TikTok", status: "needs_attention", mediaType: "video", topicBrief: "Hướng dẫn sử dụng" },
    { _id: publishedSlotId, campaignId, campaignTitle: "Ra mắt sản phẩm", scheduledAt: "2026-11-06T02:00:00.000Z", platform: "Facebook", status: "published", mediaType: "image", topicBrief: "Câu chuyện khách hàng" },
  ];
  const publishPath = `/api/v1/marketing-campaigns/${campaignId}/slots/${pendingSlotId}/publish-now`;
  const editPath = `/api/v1/marketing-campaigns/${campaignId}/slots/${pendingSlotId}/content`;
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/marketing-campaigns/calendar") {
      return new Response(JSON.stringify({ status: "success", data: { slots } }), { status: 200 });
    }
    if (input.pathname === publishPath) return new Response(JSON.stringify({ status: "success", data: {
      status: "publishing", scheduledAt: "2026-11-01T05:00:00.000Z", platform: "Facebook", mediaType: "image", accessToken: "PRIVATE-TOKEN",
    } }), { status: 200 });
    if (input.pathname === editPath) return new Response(JSON.stringify({ status: "success", data: {
      title: "Tiêu đề đã sửa", bodyText: "PRIVATE-CONTENT", companyCode: "PRIVATE-COMPANY",
    } }), { status: 200 });
    throw new Error(`Unexpected request: ${input.pathname} (${init?.method})`);
  });
  vi.stubGlobal("fetch", fetcher);

  const dateRange = { query_startDate: "2026-11-01", query_endDate: "2026-11-07" } as any;
  const publish = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.campaign.slot.publish-now")!;
  const slotField = publish.fields.find(field => field.apiKey === "slotId")!;
  const choices = await suggestReferenceOptions(req, publish, slotField, dateRange);
  expect(choices).toHaveLength(1);
  expect(choices[0]).toContain("Ra mắt sản phẩm");
  expect(choices[0]).toContain("Ưu đãi tháng 11");
  expect(choices[0]).not.toMatch(/507f1f77|PRIVATE/);

  const selection = {
    ...dateRange,
    path_id: "Ra mắt sản phẩm",
    path_slotId: "Ưu đãi tháng 11",
  } as any;
  const resolved = await resolveReferences(req, publish, selection);
  expect(resolved.errors).toEqual([]);
  expect(resolved.values).toMatchObject({ path_id: campaignId, path_slotId: pendingSlotId });
  const result = await callOperation(req, publish, resolved.values as any);
  const post = fetcher.mock.calls.find(([, init]) => init?.method === "POST")!;
  expect((post[0] as URL).pathname).toBe(publishPath);
  expect(JSON.parse(String(post[1].body))).toEqual({});
  expect(result.data).toMatchObject({ status: "publishing", platform: "Facebook", mediaType: "image" });
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE|507f1f77|accessToken/);
  expect(formatAssistantResult(publish, result.data)).toContain("Đang xử lý đăng ngay");

  const edit = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.campaign.slot.content.update")!;
  const wrongPublishPlatform = await resolveReferences(req, publish, {
    ...dateRange, path_id: "Ra mắt sản phẩm", path_slotId: "Hướng dẫn sử dụng",
  } as any);
  expect(wrongPublishPlatform.errors.join(" ")).toContain("chưa tìm thấy bản ghi");

  const wrongStatus = await resolveReferences(req, edit, {
    ...dateRange, path_id: "Ra mắt sản phẩm", path_slotId: "Câu chuyện khách hàng",
  } as any);
  expect(wrongStatus.errors.join(" ")).toContain("chưa tìm thấy bản ghi");

  const editResolution = await resolveReferences(req, edit, {
    ...dateRange,
    path_id: "Ra mắt sản phẩm",
    path_slotId: selection.path_slotId,
    bodyText: "Nội dung đã được biên tập",
  } as any);
  expect(editResolution.errors).toEqual([]);
  const updated = await callOperation(req, edit, editResolution.values as any);
  const patch = fetcher.mock.calls.find(([, init]) => init?.method === "PATCH")!;
  expect((patch[0] as URL).pathname).toBe(editPath);
  expect(JSON.parse(String(patch[1].body))).toEqual({ bodyText: "Nội dung đã được biên tập" });
  const updateReply = formatAssistantResult(edit, updated.data);
  expect(updateReply).toContain("Tiêu đề đã sửa");
  expect(updateReply).not.toMatch(/PRIVATE|507f1f77/);

  await expect(callOperation(req, publish, { ...resolved.values, query_endDate: "2026-11-10" } as any))
    .rejects.toThrow("tối đa 7 ngày");
});

it("generates a paid image with bounded text inputs and only exposes a verified Cloudinary link", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
    url: "https://res.cloudinary.com/demo/image/upload/v123/sample.png",
    isMock: false,
    record: { url: "https://res.cloudinary.com/demo/image/upload/v123/sample.png", prompt: "PRIVATE-PROMPT", _id: "PRIVATE-ID" },
    providerDebug: "PRIVATE-DEBUG", accessToken: "PRIVATE-TOKEN",
  }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.ai.image.generate")!;
  const result = await callOperation(req, operation, {
    prompt: "  Ảnh quảng cáo sản phẩm màu xanh  ",
    negativePrompt: "Chữ khó đọc",
    imageReferenceUris: ["PRIVATE-IMAGE"], existingImageUris: ["PRIVATE-IMAGE"], companyCode: "PRIVATE-COMPANY",
  } as any);
  const url = fetcher.mock.calls[0][0] as URL;
  expect(url.pathname).toBe("/api/v1/gemini/generate-image");
  expect(url.searchParams.get("companyCode")).toBe("TEST");
  expect(JSON.parse(String(fetcher.mock.calls[0][1].body))).toEqual({
    prompt: "Ảnh quảng cáo sản phẩm màu xanh", aspectRatio: "3:4", modelName: "gemini-banana-flash", resolution: "1K", negativePrompt: "Chữ khó đọc",
  });
  expect(result.data).toEqual({
    url: "https://res.cloudinary.com/demo/image/upload/v123/sample.png",
    aspectRatio: "3:4", resolution: "1K", modelName: "gemini-banana-flash",
  });
  const reply = formatAssistantResult(operation, result.data ?? result);
  expect(reply).toContain("Tỷ lệ ảnh: 3:4");
  expect(reply).toContain("Độ phân giải: 1K");
  expect(reply).not.toMatch(/PRIVATE|providerDebug|accessToken|\{/);

  await expect(callOperation(req, operation, { prompt: "Tạo ảnh", modelName: "google/gemini-3-pro-image" } as any))
    .rejects.toThrow("Mô hình tạo ảnh không nằm trong các lựa chọn được hỗ trợ");
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("edits an image selected by title from the current user's media history", async () => {
  const sourceId = "507f1f77bcf86cd799439126";
  const sourceUrl = "https://res.cloudinary.com/demo/image/upload/v123/source.png";
  const outputUrl = "https://res.cloudinary.com/demo/image/upload/v124/edited.png";
  const fetcher = vi.fn().mockImplementation(async (url: URL, init?: RequestInit) => url.pathname === "/api/v1/gemini/media-history"
    ? new Response(JSON.stringify({ status: "success", history: [{
      _id: sourceId, mediaType: "image", url: sourceUrl, createdAt: "2026-10-30T01:14:21.000Z",
      metadata: { title: "Ảnh sản phẩm mùa thu", prompt: "PRIVATE-SOURCE-PROMPT", requestId: "PRIVATE-OLD-REQUEST" },
      userId: "PRIVATE-USER",
    }] }), { status: 200 })
    : new Response(JSON.stringify({ status: "success", url: outputUrl, replayed: false, isMock: false, record: {
      url: outputUrl, prompt: "PRIVATE-EDIT-PROMPT", metadata: { revision: 2, provider: "PRIVATE-PROVIDER" }, _id: "PRIVATE-OUTPUT-ID",
    } }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.ai.image.edit")!;
  const resolution = await resolveReferences(req, operation, {
    sourceMediaId: "Ảnh · Ảnh sản phẩm mùa thu · 08:14 30/10/26",
    instruction: "Đổi nền thành màu sáng, giữ nguyên sản phẩm.",
  } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.sourceMediaId).toBe(sourceId);
  const result = await callOperation(req, operation, resolution.values as any, undefined, "edit-image-request-1");
  const post = fetcher.mock.calls.find(([, init]) => init?.method === "POST")!;
  const url = post[0] as URL;
  expect(url.pathname).toBe("/api/v1/gemini/edit-image");
  expect(JSON.parse(String(post[1].body))).toEqual({
    sourceMediaId: sourceId, sourceImageUrl: sourceUrl,
    instruction: "Đổi nền thành màu sáng, giữ nguyên sản phẩm.",
    modelName: "gemini-banana-flash", resolution: "1K", preserveOutsideRegion: true,
    requestId: "edit-image-request-1",
  });
  expect(result.data).toEqual({ url: outputUrl, revision: 2, replayed: false });
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE|sourceId|sourceMediaId/);
  await expect(callOperation(req, operation, { ...resolution.values, modelName: "google/gemini-3-pro-image" } as any, undefined, "edit-image-request-2"))
    .rejects.toThrow("Mô hình chỉnh sửa ảnh không nằm trong các lựa chọn được hỗ trợ");
  expect(fetcher).toHaveBeenCalledTimes(3);
});

it("reads only the Facebook App ID and configuration source from the OAuth status endpoint", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
    status: "success", appId: "123456789012345", source: "database",
    companyCode: "PRIVATE-COMPANY", createdBy: "owner@example.test", appSecret: "PRIVATE-SECRET", accessToken: "PRIVATE-TOKEN",
  }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.facebook-app-config.read")!;
  const result = await callOperation(req, operation, {} as any);
  const url = fetcher.mock.calls[0][0] as URL;
  expect(url.pathname).toBe("/api/v1/facebook/config");
  expect(url.searchParams.get("companyCode")).toBe("TEST");
  const reply = formatAssistantResult(operation, result.data ?? result);
  expect(reply).toContain("Facebook App ID: 123456789012345");
  expect(reply).toContain("Nguồn cấu hình: database");
  expect(reply).not.toMatch(/PRIVATE|owner@example\.test|123456789012345.*PRIVATE|\{/);
});

it("opens a CRM lead by its visible name and filters the broad detail response", async () => {
  const leadId = "507f1f77bcf86cd799439928";
  const lead = {
    _id: leadId, customerName: "Nguyễn Minh An", company: "Công ty Ánh Dương", phone: "0900000123",
    email: "an@example.test", value: 25000000, productOfChoice: "Gói tư vấn", status: "warm", lastInteraction: "Gọi tư vấn ngày 30/10",
    avatar: "PRIVATE-AVATAR", selectedProducts: [{ productId: "PRIVATE-PRODUCT-ID", name: "Sản phẩm nội bộ", price: 900000, quantity: 1 }],
    companyCode: "TEST", createdBy: "PRIVATE-ACTOR", accessToken: "PRIVATE-TOKEN",
  };
  const fetcher = vi.fn().mockImplementation(async (input: URL) => {
    if (input.pathname === "/api/v1/omni-inbox/leads") return new Response(JSON.stringify({ status: "success", data: [lead] }), { status: 200 });
    if (input.pathname === `/api/v1/omni-inbox/leads/${leadId}`) return new Response(JSON.stringify({ status: "success", data: lead }), { status: 200 });
    return new Response(JSON.stringify({ status: "error", message: "Unexpected route" }), { status: 404 });
  });
  vi.stubGlobal("fetch", fetcher);

  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "omni-inbox.leads.detail")!;
  const resolution = await resolveReferences(req, operation, { path_id: "Nguyễn Minh An" } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.path_id).toBe(leadId);
  expect(resolution.labels.path_id).toBe("Nguyễn Minh An");

  const result = await callOperation(req, operation, resolution.values as any);
  expect(result.data).toEqual({
    customerName: "Nguyễn Minh An", company: "Công ty Ánh Dương", phone: "0900000123", email: "an@example.test",
    value: 25000000, productOfChoice: "Gói tư vấn", status: "warm", lastInteraction: "Gọi tư vấn ngày 30/10",
  });
  const reply = formatAssistantResult(operation, result.data);
  expect(reply).toContain("Tên khách tiềm năng: Nguyễn Minh An");
  expect(reply).toContain("Giá trị cơ hội (VND): 25.000.000 ₫");
  expect(JSON.stringify(result)).not.toMatch(/507f1f77bcf86cd799439928|PRIVATE|avatar|selectedProducts|accessToken/);
});

it("finds marketing content by title and limits draft create, update, and delete workflows", async () => {
  const contentId = "507f1f77bcf86cd799439921";
  const listed = {
    _id: contentId, title: "Bài ra mắt", channel: "Facebook", contentType: "Bài đăng", status: "draft",
    bodyText: "Bản nháp cũ", scheduledDate: "", scheduledTime: "", imageUrl: "PRIVATE-MEDIA",
    campaignId: "PRIVATE-CAMPAIGN", companyCode: "TEST", integrationId: "PRIVATE-INTEGRATION",
  };
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/marketing-contents" && init?.method === "GET") {
      return new Response(JSON.stringify({ status: "success", data: [listed] }), { status: 200 });
    }
    if (input.pathname === `/api/v1/marketing-contents/${contentId}` && init?.method === "GET") {
      return new Response(JSON.stringify({ status: "success", data: { ...listed, bodyText: "Bản nháp chi tiết", accessToken: "PRIVATE-TOKEN" } }), { status: 200 });
    }
    if (input.pathname === "/api/v1/marketing-contents/assistant/drafts" && init?.method === "POST") {
      return new Response(JSON.stringify({ status: "success", data: {
        title: "Bài mới", channel: "Facebook", contentType: "Bài đăng", status: "draft", bodyText: "Nội dung mới",
        imageUrl: "PRIVATE-MEDIA", companyCode: "PRIVATE-COMPANY", _id: contentId,
      } }), { status: 201 });
    }
    if (input.pathname === `/api/v1/marketing-contents/assistant/drafts/${contentId}` && init?.method === "PATCH") {
      return new Response(JSON.stringify({ status: "success", data: {
        title: "Bài ra mắt", channel: "Facebook", contentType: "Bài đăng", status: "draft", bodyText: "Bản nháp đã sửa",
        imageUrl: "PRIVATE-MEDIA", companyCode: "PRIVATE-COMPANY",
      } }), { status: 200 });
    }
    if (input.pathname === `/api/v1/marketing-contents/assistant/drafts/${contentId}` && init?.method === "DELETE") {
      return new Response(JSON.stringify({ status: "success", data: { deleted: true, title: "Bài ra mắt", _id: contentId, companyCode: "PRIVATE-COMPANY" } }), { status: 200 });
    }
    throw new Error(`Unexpected request: ${input.pathname} (${init?.method})`);
  });
  vi.stubGlobal("fetch", fetcher);

  const list = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.content.list")!;
  expect(await lookupRecords(req, list.id, "Bài ra mắt")).toMatchObject([{ id: contentId, title: "Bài ra mắt", status: "draft" }]);
  const detail = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.content.detail")!;
  const detailResolution = await resolveReferences(req, detail, { path_id: "Bài ra mắt" } as any);
  expect(detailResolution.errors).toEqual([]);
  const detailResult = await callOperation(req, detail, detailResolution.values as any);
  expect(detailResult.data).toMatchObject({ title: "Bài ra mắt", bodyText: "Bản nháp chi tiết", status: "draft" });
  const detailReply = formatAssistantResult(detail, detailResult.data);
  expect(detailReply).toContain("Nội dung bài viết: Bản nháp chi tiết");
  expect(detailReply).not.toMatch(/PRIVATE|accessToken|campaignId|integrationId|\{/);

  const create = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.content.draft.create")!;
  expect(create.confirmation).toBe(true);
  const created = await callOperation(req, create, {
    title: "Bài mới", channel: "Facebook", contentType: "Bài đăng", bodyText: "Nội dung mới", outline: "Dàn ý",
  } as any);
  expect(fetcher.mock.calls.find(([, init]) => init?.method === "POST")?.[0]).toMatchObject({ pathname: "/api/v1/marketing-contents/assistant/drafts" });
  expect(JSON.parse(String(fetcher.mock.calls.find(([, init]) => init?.method === "POST")?.[1]?.body))).toEqual({
    title: "Bài mới", channel: "Facebook", contentType: "Bài đăng", bodyText: "Nội dung mới", outline: "Dàn ý",
  });
  expect(formatAssistantResult(create, created.data)).toContain("Trạng thái: Bản nháp");
  expect(formatAssistantResult(create, created.data)).not.toMatch(/PRIVATE|imageUrl|companyCode|_id|\{/);

  const update = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.content.draft.update")!;
  expect(update.confirmation).toBe(true);
  const updateResolution = await resolveReferences(req, update, { path_id: "Bài ra mắt", bodyText: "Bản nháp đã sửa" } as any);
  expect(updateResolution.errors).toEqual([]);
  const updated = await callOperation(req, update, updateResolution.values as any);
  const patchRequest = fetcher.mock.calls.find(([, init]) => init?.method === "PATCH")!;
  expect((patchRequest[0] as URL).pathname).toBe(`/api/v1/marketing-contents/assistant/drafts/${contentId}`);
  expect(JSON.parse(String(patchRequest[1].body))).toEqual({ bodyText: "Bản nháp đã sửa" });
  expect(formatAssistantResult(update, updated.data)).toContain("Nội dung bài viết: Bản nháp đã sửa");

  const remove = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.content.draft.delete")!;
  expect(remove.confirmation).toBe(true);
  const deleteResolution = await resolveReferences(req, remove, { path_id: "Bài ra mắt" } as any);
  expect(deleteResolution.errors).toEqual([]);
  const deleted = await callOperation(req, remove, deleteResolution.values as any);
  expect(fetcher.mock.calls.at(-1)?.[0]).toMatchObject({ pathname: `/api/v1/marketing-contents/assistant/drafts/${contentId}` });
  const deleteReply = formatAssistantResult(remove, deleted.data);
  expect(deleteReply).toContain("Tiêu đề bản nháp: Bài ra mắt");
  expect(deleteReply).toContain("Đã xóa bản nháp: Đã xóa");
  expect(deleteReply).not.toMatch(/PRIVATE|507f1f77|companyCode|_id|\{/);
});

it("changes only a holiday email campaign enabled flag selected by its name", async () => {
  const campaignId = "507f1f77bcf86cd799439777";
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/marketing/campaigns" && init?.method === "GET") {
      return new Response(JSON.stringify({ success: true, data: [{
        _id: campaignId, name: "Tết 2026", runDate: "2026-12-01", targetTierCodes: ["gold"], channels: ["email"],
        subject: "Chúc mừng năm mới", enabled: true, html: "PRIVATE-HTML", companyCode: req.user?.companyCode,
      }] }), { status: 200 });
    }
    if (input.pathname === `/api/v1/marketing/campaigns/${campaignId}` && init?.method === "PATCH") {
      return new Response(JSON.stringify({ success: true, data: {
        _id: campaignId, name: "Tết 2026", runDate: "2026-12-01", enabled: false, html: "PRIVATE-HTML", companyCode: req.user?.companyCode,
      } }), { status: 200 });
    }
    throw new Error(`Unexpected request: ${input.pathname} (${init?.method})`);
  });
  vi.stubGlobal("fetch", fetcher);

  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.holiday-campaign.enabled.update")!;
  expect(operation.confirmation).toBe(true);
  expect(operation.fields.filter(field => field.source === "body").map(field => field.apiKey)).toEqual(["enabled"]);
  expect(operation.fields.find(field => field.key === "path_id")?.reference).toBe("marketing.holiday-campaign.list");
  const resolution = await resolveReferences(req, operation, { path_id: "Tết 2026", enabled: false } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.path_id).toBe(campaignId);
  expect(resolution.labels.path_id).toContain("Tết 2026");
  const result = await callOperation(req, operation, resolution.values as any);
  const write = fetcher.mock.calls.find(([, init]) => init?.method === "PATCH")!;
  expect((write[0] as URL).pathname).toBe(`/api/v1/marketing/campaigns/${campaignId}`);
  expect(JSON.parse(String(write[1].body))).toEqual({ enabled: false });
  const reply = formatAssistantResult(operation, result.data);
  expect(reply).toContain("Tết 2026");
  expect(reply).toContain("Trạng thái bật chiến dịch: Không");
  expect(reply).not.toMatch(/PRIVATE|html|507f1f77|companyCode|\{/);

  const remove = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.holiday-campaign.delete")!;
  expect(remove.confirmation).toBe(true);
  expect(remove.fields.find(field => field.key === "path_id")?.reference).toBe("marketing.holiday-campaign.list");
});

it("selects TikTok content and connected accounts by name and filters choices by channel", async () => {
  const contentId = "507f1f77bcf86cd799439901";
  const accountId = "507f1f77bcf86cd799439902";
  const fetcher = vi.fn().mockImplementation(async (input: URL) => {
    if (input.pathname === "/api/v1/marketing-contents") return new Response(JSON.stringify({ status: "success", data: [
      { _id: contentId, title: "Video TikTok", channel: "TikTok", status: "draft", bodyText: "Giới thiệu sản phẩm", videoUrl: "https://private.example/video.mp4", companyCode: "TEST" },
      { _id: "507f1f77bcf86cd799439903", title: "Bài Facebook", channel: "Facebook", status: "draft", bodyText: "Nội dung khác", companyCode: "TEST" },
    ] }), { status: 200 });
    if (input.pathname === "/api/v1/marketing-campaigns/accounts") return new Response(JSON.stringify({ status: "success", data: [
      { _id: accountId, displayName: "Tài khoản iGen", platform: "TikTok", isConnected: true, accessToken: "PRIVATE-TIKTOK-TOKEN" },
      { _id: "507f1f77bcf86cd799439904", displayName: "Tài khoản cũ", platform: "TikTok", isConnected: false, accessToken: "PRIVATE-OLD-TOKEN" },
      { _id: "507f1f77bcf86cd799439905", displayName: "Trang Facebook", platform: "Facebook", isConnected: true, accessToken: "PRIVATE-FACEBOOK-TOKEN" },
    ] }), { status: 200 });
    throw new Error(`Unexpected request: ${input.pathname}`);
  });
  vi.stubGlobal("fetch", fetcher);

  const publish = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.tiktok.publish")!;
  const cardField = publish.fields.find(field => field.apiKey === "cardId")!;
  const accountField = publish.fields.find(field => field.apiKey === "integrationId")!;
  expect(await suggestReferenceOptions(req, publish, cardField, {} as any)).toEqual(["Video TikTok"]);
  expect(await suggestReferenceOptions(req, publish, accountField, {} as any)).toEqual(["Tài khoản iGen · TikTok"]);
  const resolved = await resolveReferences(req, publish, {
    cardId: "Video TikTok",
    integrationId: "Tài khoản iGen · TikTok",
  } as any);
  expect(resolved.errors).toEqual([]);
  expect(resolved.values).toMatchObject({ cardId: contentId, integrationId: accountId });
  expect(JSON.stringify([await suggestReferenceOptions(req, publish, cardField, {} as any), await suggestReferenceOptions(req, publish, accountField, {} as any)]))
    .not.toMatch(/PRIVATE|507f1f77/);
  const scheduler = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.scheduler.schedule-post")!;
  expect(await suggestReferenceOptions(req, scheduler, scheduler.fields.find(field => field.apiKey === "cardId")!, { channel: "TikTok" } as any))
    .toEqual(["Video TikTok"]);
  expect(await suggestReferenceOptions(req, scheduler, scheduler.fields.find(field => field.apiKey === "integrationId")!, { channel: "TikTok" } as any))
    .toEqual(["Tài khoản iGen · TikTok"]);
  const accountCalls = fetcher.mock.calls.map(([url]) => url as URL).filter(url => url.pathname === "/api/v1/marketing-campaigns/accounts");
  expect(accountCalls.every(url => url.searchParams.get("platform") === "TikTok")).toBe(true);
});

it("selects a mini test by title and date within the chosen student and class", async () => {
  const batchId = "507f1f77bcf86cd799439911";
  const studentId = "507f1f77bcf86cd799439912";
  const miniTestId = "507f1f77bcf86cd799439913";
  const fetcher = vi.fn().mockImplementation(async (input: URL) => {
    if (input.pathname === "/api/v1/batches") return new Response(JSON.stringify({ success: true, data: [
      { _id: batchId, code: "K1", name: "Lớp K1", courseTitle: "Tin học" },
    ] }), { status: 200 });
    if (input.pathname === `/api/v1/batches/${batchId}/attendance/learners`) return new Response(JSON.stringify({ success: true, data: [
      { id: studentId, name: "Đỗ Đức Chung", phone: "0900000000" },
    ] }), { status: 200 });
    if (input.pathname === `/api/v1/student-quality/batches/${batchId}/students/${studentId}`) return new Response(JSON.stringify({ success: true, data: {
      studentName: "Đỗ Đức Chung", miniTests: [
        { id: miniTestId, title: "Kiểm tra cuối tuần", date: "2026-10-30T00:00:00.000Z", score: 8, maxScore: 10, note: "Ôn tập tốt", assessedBy: "PRIVATE-ASSESSOR" },
      ], companyCode: "PRIVATE-COMPANY",
    } }), { status: 200 });
    throw new Error(`Unexpected request: ${input.pathname}`);
  });
  vi.stubGlobal("fetch", fetcher);

  const update = ASSISTANT_OPERATIONS.find(item => item.method === "PATCH" && item.path === "/student-quality/batches/:batchId/students/:studentId/mini-tests/:miniTestId")!;
  const miniTestField = update.fields.find(field => field.apiKey === "miniTestId")!;
  const values = { path_batchId: "Lớp K1", path_studentId: "Đỗ Đức Chung" } as any;
  const choices = await suggestReferenceOptions(req, update, miniTestField, values);
  expect(choices).toEqual(["Kiểm tra cuối tuần · 2026-10-30 · 8/10 điểm"]);
  expect(JSON.stringify(choices)).not.toMatch(/PRIVATE|507f1f77/);

  const resolved = await resolveReferences(req, update, {
    ...values,
    path_miniTestId: choices[0],
    score: 9,
  } as any);
  expect(resolved.errors).toEqual([]);
  expect(resolved.values).toMatchObject({ path_batchId: batchId, path_studentId: studentId, path_miniTestId: miniTestId, score: 9 });
});

it("lists and opens bulk image templates by name without returning design layers or media URLs", async () => {
  const templateId = "507f1f77bcf86cd799439721";
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/bulk-create/templates" && (!init?.method || init.method === "GET")) return new Response(JSON.stringify({ success: true, data: [
      {
        _id: templateId, companyCode: "TEST", name: "Mẫu ảnh tháng 11", visibility: "private", version: 3, useCount: 4,
        updatedAt: "2026-10-31T08:00:00.000Z", status: "active", layers: [{ fieldName: "Ảnh", defaultValue: "PRIVATE-LAYER" }],
        background: { imageUrl: "https://PRIVATE-IMAGE.example/design.png" }, createdBy: "PRIVATE-ACTOR",
      },
      { _id: "507f1f77bcf86cd799439722", companyCode: "OTHER", name: "Mẫu công ty khác", status: "active" },
    ] }), { status: 200 });
    if (input.pathname === `/api/v1/bulk-create/templates/${templateId}`) return new Response(JSON.stringify({ success: true, data: {
      _id: templateId, companyCode: "TEST", name: "Mẫu ảnh tháng 11", visibility: "private", version: 3, useCount: 4,
      updatedAt: "2026-10-31T08:00:00.000Z", status: "active", layers: [{ fieldName: "Ảnh", defaultValue: "PRIVATE-LAYER" }],
      background: { imageUrl: "https://PRIVATE-IMAGE.example/design.png" }, thumbnailUrl: "https://PRIVATE-THUMB.example/thumb.png",
      createdBy: "PRIVATE-ACTOR",
    } }), { status: 200 });
    throw new Error(`Unexpected request: ${input.pathname} (${init?.method})`);
  });
  vi.stubGlobal("fetch", fetcher);

  const list = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.bulk-create.templates.list")!;
  const detail = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.bulk-create.templates.detail")!;
  expect(list).toMatchObject({ method: "GET", path: "/bulk-create/templates", permissions: ["marketing:post"], confirmation: false });
  expect(detail).toMatchObject({ method: "GET", path: "/bulk-create/templates/:id", permissions: ["marketing:post"], confirmation: false });
  expect(detail.fields.find(field => field.key === "path_id")?.reference).toBe(list.id);

  const listed = await callOperation(req, list, {} as any);
  expect(JSON.stringify(listed)).not.toMatch(/507f1f77|PRIVATE|layers|background|companyCode/);
  expect(JSON.stringify(listed)).not.toContain("Mẫu công ty khác");
  expect(formatAssistantResult(list, listed.data)).toContain("Mẫu ảnh tháng 11");
  expect(formatAssistantResult(list, listed.data)).not.toMatch(/507f1f77|PRIVATE|layers|imageUrl/);

  const choices = await suggestReferenceOptions(req, detail, detail.fields.find(field => field.key === "path_id")!, {} as any);
  expect(choices).toHaveLength(1);
  expect(choices[0]).toContain("Mẫu ảnh tháng 11 · phiên bản 3 · riêng tư");
  const resolution = await resolveReferences(req, detail, { path_id: choices[0] } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.path_id).toBe(templateId);
  const opened = await callOperation(req, detail, resolution.values as any);
  expect(opened.data).toMatchObject({ name: "Mẫu ảnh tháng 11", visibility: "private", version: 3, useCount: 4, status: "active" });
  expect(JSON.stringify(opened)).not.toMatch(/507f1f77|PRIVATE|layers|background|imageUrl|thumbnailUrl|companyCode/);
});

it("publishes owned bulk templates and copies community templates only after name selection", async () => {
  const ownedTemplateId = "507f1f77bcf86cd799439729";
  const otherTemplateId = "507f1f77bcf86cd799439730";
  const communityTemplateId = "507f1f77bcf86cd799439731";
  const calls: Array<{ url: URL; init?: RequestInit }> = [];
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    calls.push({ url: input, init });
    if (input.pathname === "/api/v1/bulk-create/templates" && (!init?.method || init.method === "GET")) return new Response(JSON.stringify({ success: true, data: [
      { _id: ownedTemplateId, companyCode: "TEST", createdBy: "actor", name: "Mẫu của tôi", visibility: "private", version: 2, useCount: 1, status: "active", layers: [{ defaultValue: "PRIVATE-LAYER" }] },
      { _id: otherTemplateId, companyCode: "TEST", createdBy: "OTHER-ACTOR", name: "Mẫu đồng nghiệp", visibility: "public", version: 1, status: "active" },
    ] }), { status: 200 });
    if (input.pathname === "/api/v1/bulk-create/templates/community") return new Response(JSON.stringify({ success: true, data: [
      { _id: communityTemplateId, name: "Mẫu cộng đồng", visibility: "public", version: 5, useCount: 12, publishedAt: "2026-10-30T08:00:00.000Z", status: "active", layers: [{ defaultValue: "PRIVATE-COMMUNITY-LAYER" }] },
      { _id: "507f1f77bcf86cd799439732", name: "Mẫu đã ẩn", visibility: "private", version: 1, status: "active" },
    ] }), { status: 200 });
    if (input.pathname === `/api/v1/bulk-create/templates/${ownedTemplateId}/publish` && init?.method === "POST") return new Response(JSON.stringify({ success: true, data: {
      _id: ownedTemplateId, name: "Mẫu của tôi", visibility: "public", publishedAt: "2026-11-01T10:00:00.000Z", layers: [{ defaultValue: "PRIVATE-LAYER" }], createdBy: "actor",
    } }), { status: 200 });
    if (input.pathname === `/api/v1/bulk-create/templates/${ownedTemplateId}/unpublish` && init?.method === "POST") return new Response(JSON.stringify({ success: true, data: {
      _id: ownedTemplateId, name: "Mẫu của tôi", visibility: "private", layers: [{ defaultValue: "PRIVATE-LAYER" }], createdBy: "actor",
    } }), { status: 200 });
    if (input.pathname === `/api/v1/bulk-create/templates/${communityTemplateId}/use` && init?.method === "POST") return new Response(JSON.stringify({ success: true, data: {
      _id: "507f1f77bcf86cd799439733", name: "Mẫu cộng đồng - bản sao", visibility: "private", version: 1,
      companyCode: "TEST", layers: [{ defaultValue: "PRIVATE-COMMUNITY-LAYER" }],
    } }), { status: 201 });
    throw new Error(`Unexpected request: ${input.pathname} (${init?.method})`);
  });
  vi.stubGlobal("fetch", fetcher);

  const publish = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.bulk-create.templates.publish")!;
  const unpublish = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.bulk-create.templates.unpublish")!;
  const use = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.bulk-create.templates.community.use")!;
  const publishField = publish.fields.find(field => field.key === "path_id")!;
  const ownedChoices = await suggestReferenceOptions(req, publish, publishField, {} as any);
  expect(ownedChoices).toHaveLength(1);
  expect(ownedChoices[0]).toContain("Mẫu của tôi");
  expect(ownedChoices.join(" ")).not.toContain("Mẫu đồng nghiệp");
  expect(JSON.stringify(ownedChoices)).not.toMatch(/507f1f77|PRIVATE/);

  const publishResolution = await resolveReferences(req, publish, { path_id: ownedChoices[0] } as any);
  expect(publishResolution.errors).toEqual([]);
  expect(publishResolution.values.path_id).toBe(ownedTemplateId);
  const published = await callOperation(req, publish, publishResolution.values as any);
  expect(calls.at(-1)?.url.pathname).toBe(`/api/v1/bulk-create/templates/${ownedTemplateId}/publish`);
  expect(published.data).toMatchObject({ name: "Mẫu của tôi", visibility: "public" });
  expect(JSON.stringify(published)).not.toMatch(/507f1f77|PRIVATE|createdBy|layers/);

  const unpublishChoices = await suggestReferenceOptions(req, unpublish, unpublish.fields.find(field => field.key === "path_id")!, {} as any);
  const unpublishResolution = await resolveReferences(req, unpublish, { path_id: unpublishChoices[0] } as any);
  expect(unpublishResolution.errors).toEqual([]);
  const unpublished = await callOperation(req, unpublish, unpublishResolution.values as any);
  expect(calls.at(-1)?.url.pathname).toBe(`/api/v1/bulk-create/templates/${ownedTemplateId}/unpublish`);
  expect(unpublished.data).toMatchObject({ name: "Mẫu của tôi", visibility: "private" });

  const communityChoices = await suggestReferenceOptions(req, use, use.fields.find(field => field.key === "path_id")!, {} as any);
  expect(communityChoices).toHaveLength(1);
  expect(communityChoices[0]).toContain("Mẫu cộng đồng");
  expect(JSON.stringify(communityChoices)).not.toMatch(/507f1f77|PRIVATE|Mẫu đã ẩn/);
  const useResolution = await resolveReferences(req, use, { path_id: communityChoices[0] } as any);
  expect(useResolution.errors).toEqual([]);
  expect(useResolution.values.path_id).toBe(communityTemplateId);
  const copied = await callOperation(req, use, useResolution.values as any);
  expect(calls.at(-1)?.url.pathname).toBe(`/api/v1/bulk-create/templates/${communityTemplateId}/use`);
  expect(copied.data).toMatchObject({ name: "Mẫu cộng đồng - bản sao", visibility: "private", version: 1 });
  expect(JSON.stringify(copied)).not.toMatch(/507f1f77|PRIVATE|companyCode|createdBy|layers/);
});

it("lists bulk image job progress with company scoping and safe result fields", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: [
    {
      _id: "507f1f77bcf86cd799439701", companyCode: "TEST", createdBy: "PRIVATE-ACTOR",
      templateName: "Ảnh sản phẩm vuông", targetType: "standalone", sourceType: "manual", status: "partial",
      totalItems: 12, completedItems: 10, failedItems: 2, progress: 100,
      createdAt: "2026-10-31T08:00:00.000Z", completedAt: "2026-10-31T08:03:00.000Z",
      errorMessage: "PRIVATE-ERROR", idempotencyKey: "PRIVATE-KEY", templateSnapshot: { background: { imageUrl: "PRIVATE-IMAGE" } },
    },
    { _id: "507f1f77bcf86cd799439702", companyCode: "OTHER", templateName: "Không thuộc công ty", status: "completed" },
  ] }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);

  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.bulk-create.jobs.list")!;
  expect(operation).toMatchObject({ method: "GET", path: "/bulk-create/jobs", permissions: ["marketing:post"], confirmation: false });
  const result = await callOperation(req, operation, { query_limit: 5 } as any);
  const url = fetcher.mock.calls[0][0] as URL;
  expect(url.pathname).toBe("/api/v1/bulk-create/jobs");
  expect(url.searchParams.get("limit")).toBe("5");

  const records = projectRecords(operation, result, req);
  expect(records).toHaveLength(1);
  expect(records[0]).toMatchObject({ templateName: "Ảnh sản phẩm vuông", status: "partial", totalItems: 12, completedItems: 10, failedItems: 2 });
  expect(JSON.stringify(records)).not.toMatch(/PRIVATE|imageUrl|idempotencyKey|createdBy|companyCode/);
  const reply = formatAssistantResult(operation, records);
  expect(reply).toContain("Ảnh sản phẩm vuông");
  expect(reply).toContain("Đã hoàn tất: 10");
  expect(reply).not.toMatch(/507f1f77|PRIVATE|Không thuộc công ty|imageUrl|\{/);
});

it("suggests eligible bulk image jobs by visible labels before confirmed cancel or retry", async () => {
  const cancelJobId = "507f1f77bcf86cd799439711";
  const retryJobId = "507f1f77bcf86cd799439712";
  const noFailuresJobId = "507f1f77bcf86cd799439713";
  const jobs = [
    { _id: cancelJobId, companyCode: "TEST", templateName: "Ảnh sản phẩm", status: "processing", totalItems: 3, completedItems: 1, failedItems: 2, createdAt: "2026-10-31T08:00:01.123Z" },
    { _id: retryJobId, companyCode: "TEST", templateName: "Ảnh sản phẩm", status: "partial", totalItems: 5, completedItems: 3, failedItems: 2, createdAt: "2026-10-31T08:02:03.456Z" },
    { _id: noFailuresJobId, companyCode: "TEST", templateName: "Ảnh sản phẩm", status: "partial", totalItems: 5, completedItems: 5, failedItems: 0, createdAt: "2026-10-31T08:03:04.567Z" },
    { _id: "507f1f77bcf86cd799439714", companyCode: "TEST", templateName: "Ảnh cũ", status: "completed", totalItems: 1, completedItems: 1, failedItems: 0, createdAt: "2026-10-31T08:04:05.678Z" },
  ];
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    if (input.pathname === "/api/v1/bulk-create/jobs" && (!init?.method || init.method === "GET")) return new Response(JSON.stringify({ success: true, data: jobs }), { status: 200 });
    if (input.pathname === `/api/v1/bulk-create/jobs/${cancelJobId}` && init?.method === "GET") {
      return new Response(JSON.stringify({ success: true, data: {
        ...jobs[0], companyCode: "TEST", idempotencyKey: "PRIVATE-KEY", templateSnapshot: { background: { imageUrl: "PRIVATE-IMAGE" } },
        errorMessage: "PRIVATE-ERROR", lockId: "PRIVATE-LOCK", createdBy: "PRIVATE-ACTOR",
      } }), { status: 200 });
    }
    const job = input.pathname.endsWith("/cancel")
      ? { _id: cancelJobId, templateName: "Ảnh sản phẩm", status: "cancelled", totalItems: 3, completedItems: 1, failedItems: 2, createdAt: jobs[0].createdAt, completedAt: "2026-10-31T08:05:00.000Z", errorMessage: "PRIVATE-ERROR", companyCode: "TEST" }
      : { _id: retryJobId, templateName: "Ảnh sản phẩm", status: "queued", totalItems: 5, completedItems: 3, failedItems: 2, createdAt: jobs[1].createdAt, idempotencyKey: "PRIVATE-KEY", companyCode: "TEST" };
    return new Response(JSON.stringify({ success: true, data: job }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);

  const cancel = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.bulk-create.jobs.cancel")!;
  const retry = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.bulk-create.jobs.retry")!;
  expect(cancel).toMatchObject({ method: "POST", path: "/bulk-create/jobs/:id/cancel", confirmation: true, permissions: ["marketing:post"] });
  expect(retry).toMatchObject({ method: "POST", path: "/bulk-create/jobs/:id/retry", confirmation: true, permissions: ["marketing:post"] });

  const cancelChoices = await suggestReferenceOptions(req, cancel, cancel.fields.find(field => field.key === "path_id")!, {} as any);
  expect(cancelChoices).toHaveLength(1);
  expect(cancelChoices[0]).toContain("Ảnh sản phẩm · Đang xử lý · 1/3 ảnh · 2 ảnh lỗi");
  expect(cancelChoices[0]).not.toMatch(/507f1f77|PRIVATE/);
  const cancelResolution = await resolveReferences(req, cancel, { path_id: cancelChoices[0] } as any);
  expect(cancelResolution.errors).toEqual([]);
  expect(cancelResolution.values.path_id).toBe(cancelJobId);

  const detail = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.bulk-create.jobs.detail")!;
  expect(detail).toMatchObject({ method: "GET", path: "/bulk-create/jobs/:id", confirmation: false, permissions: ["marketing:post"] });
  const detailResolution = await resolveReferences(req, detail, { path_id: cancelChoices[0] } as any);
  expect(detailResolution.errors).toEqual([]);
  expect(detailResolution.values.path_id).toBe(cancelJobId);
  const detailed = await callOperation(req, detail, detailResolution.values as any);
  expect(detailed.data).toMatchObject({ templateName: "Ảnh sản phẩm", status: "processing", totalItems: 3, completedItems: 1, failedItems: 2 });
  expect(JSON.stringify(detailed)).not.toMatch(/507f1f77|PRIVATE|companyCode|imageUrl/);
  expect(formatAssistantResult(detail, detailed.data)).toContain("Ảnh sản phẩm");

  const cancelled = await callOperation(req, cancel, cancelResolution.values as any);
  expect((fetcher.mock.calls.at(-1)?.[0] as URL).pathname).toBe(`/api/v1/bulk-create/jobs/${cancelJobId}/cancel`);
  expect(cancelled.data).toMatchObject({ templateName: "Ảnh sản phẩm", status: "cancelled", completedItems: 1, failedItems: 2 });
  expect(JSON.stringify(cancelled)).not.toMatch(/507f1f77|PRIVATE|companyCode/);
  expect(formatAssistantResult(cancel, cancelled.data)).toContain("Trạng thái: Đã hủy");

  const retryChoices = await suggestReferenceOptions(req, retry, retry.fields.find(field => field.key === "path_id")!, {} as any);
  expect(retryChoices).toHaveLength(1);
  expect(retryChoices[0]).toContain("Ảnh sản phẩm · Một phần · 3/5 ảnh · 2 ảnh lỗi");
  const retryResolution = await resolveReferences(req, retry, { path_id: retryChoices[0] } as any);
  expect(retryResolution.errors).toEqual([]);
  expect(retryResolution.values.path_id).toBe(retryJobId);
  const retried = await callOperation(req, retry, retryResolution.values as any);
  expect((fetcher.mock.calls.at(-1)?.[0] as URL).pathname).toBe(`/api/v1/bulk-create/jobs/${retryJobId}/retry`);
  expect(retried.data).toMatchObject({ templateName: "Ảnh sản phẩm", status: "queued", completedItems: 3, failedItems: 2 });
  expect(JSON.stringify(retried)).not.toMatch(/507f1f77|PRIVATE|companyCode/);
});

it("lists and opens video-caption projects by name while filtering video, subtitle, and job data", async () => {
  const projectId = "507f1f77bcf86cd799439703";
  const privateProject = {
    id: projectId, companyCode: "TEST", name: "Video giới thiệu tháng 11", mode: "combined", status: "ready_for_review",
    currentVersion: 4, createdAt: "2026-10-30T08:00:00.000Z", updatedAt: "2026-10-31T09:30:00.000Z",
    source: { kind: "upload", url: "https://PRIVATE-VIDEO.example/video.mp4", mediaId: "PRIVATE-MEDIA" },
    contextLinks: { marketingContentId: "PRIVATE-CONTENT", campaignId: "PRIVATE-CAMPAIGN", campaignSlotId: "PRIVATE-SLOT" },
    output: { captionedVideoUrl: "https://PRIVATE-OUTPUT.example/result.mp4", subtitleUrl: "https://PRIVATE-SRT.example/result.srt" },
    lastError: { message: "PRIVATE-ERROR" }, createdBy: "PRIVATE-ACTOR",
  };
  const fetcher = vi.fn().mockImplementation(async (input: URL) => {
    if (input.pathname === "/api/v1/video-caption-projects") {
      return new Response(JSON.stringify({ success: true, data: { projects: [privateProject], pagination: { page: 1, total: 1 } } }), { status: 200 });
    }
    if (input.pathname === `/api/v1/video-caption-projects/${projectId}`) {
      return new Response(JSON.stringify({ success: true, data: {
        project: privateProject,
        segments: [{ text: "PRIVATE-SUBTITLE", startMs: 10, endMs: 500 }],
        jobs: [{ id: "PRIVATE-JOB", error: "PRIVATE-JOB-ERROR" }],
      } }), { status: 200 });
    }
    throw new Error(`Unexpected request: ${input.pathname}`);
  });
  vi.stubGlobal("fetch", fetcher);

  const list = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.video-caption.project.list")!;
  const listed = await callOperation(req, list, { query_limit: 20 } as any);
  const listRecords = projectRecords(list, listed, req);
  expect(listRecords).toHaveLength(1);
  expect(listRecords[0]).toMatchObject({ id: projectId, name: "Video giới thiệu tháng 11", mode: "combined", status: "ready_for_review", currentVersion: 4 });
  expect(JSON.stringify(listRecords)).not.toMatch(/PRIVATE|source|output|contextLinks|companyCode/);
  const listReply = formatAssistantResult(list, listRecords);
  expect(listReply).toContain("Video giới thiệu tháng 11");
  expect(listReply).toContain("Lời thoại và ngữ cảnh");
  expect(listReply).not.toMatch(/507f1f77|PRIVATE|\.example|\{/);

  const detail = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.video-caption.project.detail")!;
  expect(detail.fields.find(field => field.key === "path_id")?.reference).toBe(list.id);
  const resolution = await resolveReferences(req, detail, { path_id: "Video giới thiệu tháng 11" } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.path_id).toBe(projectId);
  const result = await callOperation(req, detail, resolution.values as any);
  const detailRecords = projectRecords(detail, result, req);
  const detailReply = formatAssistantResult(detail, detailRecords);
  expect(detailReply).toContain("Trạng thái: Chờ duyệt");
  expect(detailReply).not.toMatch(/507f1f77|PRIVATE|\.example|PRIVATE-SUBTITLE|\{/);
});

it("cancels a selected video-caption project by name and excludes completed projects", async () => {
  const draftProjectId = "507f1f77bcf86cd799439713";
  const completedProjectId = "507f1f77bcf86cd799439714";
  const cancelledProjectId = "507f1f77bcf86cd799439715";
  const calls: Array<{ url: URL; init?: RequestInit }> = [];
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    calls.push({ url: input, init });
    if (input.pathname === "/api/v1/video-caption-projects" && init?.method !== "POST") {
      return new Response(JSON.stringify({ success: true, data: { projects: [
        { id: draftProjectId, name: "Video đang xử lý", status: "processing" },
        { id: completedProjectId, name: "Video đã hoàn tất", status: "completed" },
        { id: cancelledProjectId, name: "Video đã hủy", status: "cancelled" },
      ], pagination: { page: 1, total: 3 } } }), { status: 200 });
    }
    if (input.pathname === `/api/v1/video-caption-projects/${draftProjectId}/cancel` && init?.method === "POST") {
      return new Response(JSON.stringify({ success: true, data: { project: {
        id: draftProjectId, name: "Video đang xử lý", status: "cancelled",
        source: { url: "https://PRIVATE.example/video.mp4" }, jobs: [{ id: "PRIVATE-JOB", error: "PRIVATE-ERROR" }],
      } } }), { status: 200 });
    }
    throw new Error(`Unexpected request: ${input.pathname} (${init?.method})`);
  });
  vi.stubGlobal("fetch", fetcher);

  const cancel = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.video-caption.project.cancel")!;
  const target = cancel.fields.find(field => field.key === "path_id")!;
  const choices = await suggestReferenceOptions(req, cancel, target, {} as any);
  expect(choices).toHaveLength(1);
  expect(choices[0]).toContain("Video đang xử lý");
  expect(choices.join(" ")).not.toMatch(/Video đã hoàn tất|Video đã hủy|507f1f77/);

  const resolution = await resolveReferences(req, cancel, { path_id: "Video đang xử lý" } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.path_id).toBe(draftProjectId);
  const result = await callOperation(req, cancel, resolution.values as any);
  expect(calls.at(-1)?.url.pathname).toBe(`/api/v1/video-caption-projects/${draftProjectId}/cancel`);
  expect(calls.at(-1)?.init?.method).toBe("POST");
  expect(result.data).toEqual({ projectName: "Video đang xử lý", status: "cancelled", cancelled: true });
  expect(JSON.stringify(result)).not.toMatch(/507f1f77|PRIVATE|\.example|jobs|source/);
});

it("retries only failed video-caption projects by name and hides job identifiers", async () => {
  const failedProjectId = "507f1f77bcf86cd799439716";
  const cancelledProjectId = "507f1f77bcf86cd799439717";
  const activeProjectId = "507f1f77bcf86cd799439718";
  const calls: Array<{ url: URL; init?: RequestInit }> = [];
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    calls.push({ url: input, init });
    if (input.pathname === "/api/v1/video-caption-projects" && init?.method !== "POST") {
      return new Response(JSON.stringify({ success: true, data: { projects: [
        { id: failedProjectId, name: "Video lỗi", status: "failed" },
        { id: cancelledProjectId, name: "Video đã hủy", status: "cancelled" },
        { id: activeProjectId, name: "Video đang chạy", status: "processing" },
      ], pagination: { page: 1, total: 3 } } }), { status: 200 });
    }
    if (input.pathname === `/api/v1/video-caption-projects/${failedProjectId}/retry` && init?.method === "POST") {
      return new Response(JSON.stringify({ success: true, data: { job: {
        id: "PRIVATE-JOB", projectId: failedProjectId, operation: "transcribe", status: "queued",
        providerRequestId: "PRIVATE-REQUEST", error: "PRIVATE-ERROR",
      } } }), { status: 202 });
    }
    throw new Error(`Unexpected request: ${input.pathname} (${init?.method})`);
  });
  vi.stubGlobal("fetch", fetcher);

  const retry = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.video-caption.project.retry")!;
  const target = retry.fields.find(field => field.key === "path_id")!;
  const choices = await suggestReferenceOptions(req, retry, target, {} as any);
  expect(choices).toHaveLength(2);
  expect(choices.join(" ")).toContain("Video lỗi");
  expect(choices.join(" ")).toContain("Video đã hủy");
  expect(choices.join(" ")).not.toMatch(/Video đang chạy|507f1f77/);

  const resolution = await resolveReferences(req, retry, { path_id: "Video lỗi" } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.path_id).toBe(failedProjectId);
  const result = await callOperation(req, retry, resolution.values as any);
  expect(calls.at(-1)?.url.pathname).toBe(`/api/v1/video-caption-projects/${failedProjectId}/retry`);
  expect(calls.at(-1)?.init?.method).toBe("POST");
  expect(result.data).toEqual({ operationLabel: "Nhận diện lời thoại", status: "queued", queued: true });
  expect(JSON.stringify(result)).not.toMatch(/507f1f77|PRIVATE|providerRequestId|projectId/);
});

it("starts named video-caption jobs, requires explicit render mode, and filters provider metadata", async () => {
  const projectId = "507f1f77bcf86cd799439730";
  const calls: Array<{ url: URL; init?: RequestInit }> = [];
  const actions = [
    ["marketing.video-caption.project.analyze", "/video-caption-projects/:id/analyze", "analyze"],
    ["marketing.video-caption.project.transcribe", "/video-caption-projects/:id/transcribe", "transcribe"],
    ["marketing.video-caption.project.generate-context", "/video-caption-projects/:id/generate-context", "generate_context"],
    ["marketing.video-caption.project.render", "/video-caption-projects/:id/render", "render_preview"],
  ] as const;
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    calls.push({ url: input, init });
    if (input.pathname === "/api/v1/video-caption-projects" && init?.method !== "POST") {
      return new Response(JSON.stringify({ success: true, data: { projects: [
        { id: projectId, name: "Video mẫu tháng 11", mode: "combined", status: "ready_for_review" },
      ], pagination: { page: 1, total: 1 } } }), { status: 200 });
    }
    const action = actions.find(([, path]) => input.pathname === `/api/v1${path.replace(":id", projectId)}`);
    if (action && init?.method === "POST") {
      return new Response(JSON.stringify({ success: true, data: { job: {
        id: "PRIVATE-JOB", projectId, operation: action[2], status: "queued",
        provider: "PRIVATE-PROVIDER", model: "PRIVATE-MODEL", estimatedCost: 123,
        lastError: { message: "PRIVATE-ERROR" },
      } } }), { status: 202 });
    }
    throw new Error(`Unexpected request: ${input.pathname} (${init?.method})`);
  });
  vi.stubGlobal("fetch", fetcher);

  for (const [id, path] of actions) {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === id)!;
    const resolution = await resolveReferences(req, operation, { path_id: "Video mẫu tháng 11" } as any);
    expect(resolution.errors).toEqual([]);
    expect(resolution.values.path_id).toBe(projectId);

    const result = await callOperation(req, operation, {
      ...resolution.values,
      ...(id === "marketing.video-caption.project.render" ? { preview: true } : {}),
    } as any);
    expect(calls.at(-1)?.url.pathname).toBe(`/api/v1${path.replace(":id", projectId)}`);
    expect(calls.at(-1)?.init?.method).toBe("POST");
    expect(result.data.status).toBe("queued");
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE-JOB|PRIVATE-PROVIDER|PRIVATE-MODEL|PRIVATE-ERROR|estimatedCost/);
    if (id === "marketing.video-caption.project.render") expect(JSON.parse(String(calls.at(-1)?.init?.body))).toEqual({ preview: true });

    const reply = formatAssistantResult(operation, result.data);
    expect(reply).toContain("Tr\u1EA1ng th\u00E1i: \u0110ang ch\u1EDD");
    expect(reply).not.toMatch(/PRIVATE|123|\{/);
  }
});

it("creates draft-only caption projects with name-resolved links and preserves other links during edits", async () => {
  const projectId = "507f1f77bcf86cd799439704";
  const contentId = "507f1f77bcf86cd799439705";
  const firstCampaignId = "507f1f77bcf86cd799439706";
  const secondCampaignId = "507f1f77bcf86cd799439707";
  const calls: Array<{ url: URL; init?: RequestInit }> = [];
  const fetcher = vi.fn().mockImplementation(async (input: URL, init?: RequestInit) => {
    calls.push({ url: input, init });
    if (input.pathname === "/api/v1/marketing-contents" && init?.method !== "POST") {
      return new Response(JSON.stringify({ status: "success", data: [{
        _id: contentId, title: "Bài ra mắt", channel: "Facebook", contentType: "post", status: "draft", bodyText: "PRIVATE-CONTENT",
      }] }), { status: 200 });
    }
    if (input.pathname === "/api/v1/marketing-campaigns/assistant/summaries") {
      return new Response(JSON.stringify({ success: true, data: [
        { _id: firstCampaignId, title: "Chiến dịch Tết", status: "draft" },
        { _id: secondCampaignId, title: "Chiến dịch mùa hè", status: "draft" },
      ] }), { status: 200 });
    }
    if (input.pathname === "/api/v1/video-caption-projects" && init?.method === "POST") {
      return new Response(JSON.stringify({ success: true, data: { project: {
        id: projectId, name: "Video Tết", mode: "combined", status: "draft", currentVersion: 1,
        createdAt: "2026-11-01T08:00:00.000Z", source: { url: "PRIVATE-VIDEO" },
      }, segments: [], jobs: [] }, meta: { analysisQueued: false } }), { status: 201 });
    }
    if (input.pathname === "/api/v1/video-caption-projects" && init?.method === "GET") {
      return new Response(JSON.stringify({ success: true, data: { projects: [{
        id: projectId, companyCode: "TEST", name: "Video Tết", mode: "combined", status: "draft", currentVersion: 1,
        createdAt: "2026-11-01T08:00:00.000Z", contextLinks: { marketingContentId: contentId, campaignId: firstCampaignId, campaignSlotId: "PRIVATE-SLOT" },
      }], pagination: { page: 1, total: 1 } } }), { status: 200 });
    }
    if (input.pathname === `/api/v1/video-caption-projects/${projectId}` && init?.method === "PATCH") {
      const body = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ success: true, data: { project: {
        id: projectId, name: "Video Tết", mode: "combined", status: "draft", currentVersion: 1,
        updatedAt: "2026-11-01T09:00:00.000Z", contextLinks: body.contextLinks,
      } } }), { status: 200 });
    }
    throw new Error(`Unexpected request: ${input.pathname} (${init?.method})`);
  });
  vi.stubGlobal("fetch", fetcher);

  const create = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.video-caption.project.create")!;
  expect(create).toMatchObject({ method: "POST", confirmation: true, fixedBodyValues: { autoAnalyze: false }, contextBody: ["idempotencyKey"] });
  const createValues = await resolveReferences(req, create, {
    name: "Video Tết", mode: "combined", language: "vi",
    source: JSON.stringify({ kind: "upload", url: "https://media.example/video.mp4", originalName: "video.mp4" }),
    contextLinks: JSON.stringify({ marketingContentId: "Bài ra mắt", campaignId: "Chiến dịch Tết" }),
  } as any);
  expect(createValues.errors).toEqual([]);
  const created = await callOperation(req, create, createValues.values as any, undefined, "caption-project-create-1");
  const createCall = calls.find(call => call.url.pathname === "/api/v1/video-caption-projects" && call.init?.method === "POST")!;
  const createBody = JSON.parse(String(createCall.init?.body));
  expect(createBody).toMatchObject({
    name: "Video Tết", mode: "combined", autoAnalyze: false, idempotencyKey: "caption-project-create-1",
    source: { kind: "upload", url: "https://media.example/video.mp4" },
    contextLinks: { marketingContentId: contentId, campaignId: firstCampaignId },
  });
  expect(createBody.contextLinks.campaignSlotId).toBeUndefined();
  const createReply = formatAssistantResult(create, projectRecords(create, created, req));
  expect(createReply).toContain("Video Tết");
  expect(createReply).not.toMatch(/PRIVATE|\.example|507f1f77|\{/);

  const update = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.video-caption.project.update")!;
  const updateValues = await resolveReferences(req, update, {
    path_id: "Video Tết", contextLinks: JSON.stringify({ campaignId: "Chiến dịch mùa hè" }),
  } as any);
  expect(updateValues.errors).toEqual([]);
  const updated = await callOperation(req, update, updateValues.values as any);
  const updateCall = calls.find(call => call.url.pathname === `/api/v1/video-caption-projects/${projectId}` && call.init?.method === "PATCH")!;
  const updateBody = JSON.parse(String(updateCall.init?.body));
  expect(updateBody.contextLinks).toEqual({ marketingContentId: contentId, campaignId: secondCampaignId, campaignSlotId: "PRIVATE-SLOT" });
  const updateReply = formatAssistantResult(update, projectRecords(update, updated, req));
  expect(updateReply).toContain("Video Tết");
  expect(updateReply).not.toMatch(/PRIVATE|507f1f77|\{/);
});

it("selects a retryable retail debt email by recipient name and shows its exact send target", async () => {
  const deliveryId = "507f1f77bcf86cd799439901";
  const label = "Nguyễn An — customer@example.com — SO-001 — lượt 1/3";
  const fetcher = vi.fn().mockImplementation(() => new Response(JSON.stringify({ success: true, data: { items: [{
    _id: deliveryId,
    recipientName: "Nguyễn An",
    recipientEmail: "customer@example.com",
    orderCode: "SO-001",
    subject: "Nhắc thanh toán công nợ · SO-001",
    message: "Kính gửi Nguyễn An, đơn hàng SO-001 còn công nợ 1.000.000 ₫.",
    attempt: 1,
    maxAttempts: 3,
    createdAt: "2026-11-01T10:00:00.000Z",
  }], total: 1, page: 1, limit: 20 } }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);

  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "retail.debt-reminders.delivery.retry")!;
  expect(operation).toMatchObject({ confirmation: true, permissions: ["retail:manage"] });
  const field = operation.fields.find(item => item.apiKey === "id")!;
  expect(await suggestReferenceOptions(req, operation, field, {} as any)).toEqual([label]);

  const resolution = await resolveReferences(req, operation, { path_id: "Nguyễn An" } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.path_id).toBe(deliveryId);
  expect(resolution.labels.path_id).toBe(label);
  expect(JSON.stringify(resolution.labels)).not.toContain(deliveryId);
  expect(JSON.stringify(resolution.labels)).toContain("customer@example.com");
  expect(JSON.stringify(resolution.labels)).toContain("SO-001");
  expect(fetcher.mock.calls.every(([input]) => (input as URL).pathname === "/api/v1/retail/debt-reminders/deliveries/retryable")).toBe(true);
  expect(resolution.confirmationDetails.path_id).toEqual([
    { label: "Địa chỉ email nhận", value: "customer@example.com" },
    { label: "Đơn hàng", value: "SO-001" },
    { label: "Tiêu đề thư", value: "Nhắc thanh toán công nợ · SO-001" },
    { label: "Nội dung thư", value: "Kính gửi Nguyễn An, đơn hàng SO-001 còn công nợ 1.000.000 ₫." },
    { label: "Lượt gửi đã thực hiện", value: "1" },
    { label: "Số lượt tối đa", value: "3" },
  ]);
});

it("selects a retryable finance in-app reminder by customer name and shows the exact notification", async () => {
  const deliveryId = "507f1f77bcf86cd799439911";
  const branchId = req.user.branchId;
  const fetcher = vi.fn().mockImplementation((rawInput: URL | string) => {
    const input = rawInput instanceof URL ? rawInput : new URL(String(rawInput));
    if (input.pathname === "/api/v1/finance/reminders/deliveries/retryable") {
      expect(input.searchParams.get("branchId")).toBe(branchId);
      return new Response(JSON.stringify({ success: true, data: { items: [{
        _id: deliveryId, customerName: "Nguyễn An", receivableCode: "CN-001", sourceCode: "DH-001", balance: 125000,
        daysOverdue: 8, notificationTitle: "Công nợ quá hạn · DH-001", notificationBody: "Khoản công nợ còn 125000 ₫ và đã quá hạn 8 ngày.",
        attempt: 2, maxAttempts: 5, createdAt: "2026-11-01T10:00:00.000Z",
      }], total: 1, page: 1, limit: 20 } }), { status: 200 });
    }
    throw new Error(`Unexpected request: ${input.pathname}`);
  });
  vi.stubGlobal("fetch", fetcher);

  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "finance.reminders.delivery.retry-in-app")!;
  expect(operation).toMatchObject({ confirmation: true, permissions: ["finance-receivable:manage"] });
  const field = operation.fields.find(item => item.apiKey === "id")!;
  const choices = await suggestReferenceOptions(req, operation, field, { targetBranch: branchId } as any);
  expect(choices).toEqual(["Nguyễn An — CN-001 — DH-001 — lượt 2/5"]);

  const resolution = await resolveReferences(req, operation, { targetBranch: branchId, path_id: "Nguyễn An" } as any);
  expect(resolution.errors).toEqual([]);
  expect(resolution.values.path_id).toBe(deliveryId);
  expect(resolution.labels.path_id).toBe(choices[0]);
  expect(JSON.stringify(resolution.labels)).not.toContain(deliveryId);
  expect(resolution.confirmationDetails.path_id).toEqual([
    { label: "Khách hàng liên quan", value: "Nguyễn An" },
    { label: "Mã khoản công nợ", value: "CN-001" },
    { label: "Mã chứng từ", value: "DH-001" },
    { label: "Số dư công nợ (VND)", value: "125000" },
    { label: "Số ngày quá hạn", value: "8" },
    { label: "Tiêu đề thông báo", value: "Công nợ quá hạn · DH-001" },
    { label: "Nội dung thông báo", value: "Khoản công nợ còn 125000 ₫ và đã quá hạn 8 ngày." },
    { label: "Lượt gửi đã thực hiện", value: "2" },
    { label: "Số lượt tối đa", value: "5" },
  ]);
  expect(fetcher.mock.calls.every(([input]) => (input as URL).pathname === "/api/v1/finance/reminders/deliveries/retryable")).toBe(true);
});

it("formats structured API error details instead of exposing [object Object]", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
    success: false,
    message: "Dữ liệu báo cáo chưa hợp lệ.",
    details: { query: ["Thiếu khoảng ngày bắt đầu."] },
  }), { status: 400 })));
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "company-knowledge.documents.list")!;
  let message = "";
  try {
    await callOperation(req, operation, {} as any);
  } catch (error) {
    message = (error as Error).message;
  }
  expect(message).toContain("Dữ liệu báo cáo chưa hợp lệ.");
  expect(message).toContain('{"query":["Thiếu khoảng ngày bắt đầu."]}');
  expect(message).not.toContain("[object Object]");
});

it("does not append undeclared branch or company query keys to student read routes", async () => {
  const fetcher = vi.fn().mockImplementation(() => new Response(JSON.stringify({ success: true, data: [] }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  for (const actionId of ["api.get.511c92ed95ee79b7", "student.learning-roadmap.waitlist.list"]) {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === actionId)!;
    await callOperation(req, operation, {} as any);
    const [rawUrl, init] = fetcher.mock.calls.at(-1)!;
    const url = new URL(String(rawUrl));
    expect(url.searchParams.has("branchId")).toBe(false);
    expect(url.searchParams.has("companyCode")).toBe(false);
    expect((init as RequestInit).headers).toMatchObject({ "x-branch-id": req.user.branchId });
  }
});

it("sends training lessons and quiz questions as typed arrays and defaults instructor to the creator", async () => {
  const fetcher = vi.fn().mockImplementation(() => new Response(JSON.stringify({ status: "success", data: { _id: "course-1" } }), { status: 201 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "training.create")!;
  const lessons = [{ title: "Giới thiệu PLC", type: "text", content: "Các khái niệm cơ bản" }];
  const quizzes = [{ question: "PLC dùng để làm gì?", options: ["Điều khiển tự động", "Soạn thảo văn bản"], correctOptionIndex: 0 }];

  await callOperation({ ...req, user: { ...req.user, displayName: "Nguyễn An" } } as any, operation, {
    title: "Lập trình PLC",
    category: "Văn hóa",
    duration: "30 ngày",
    lessons: JSON.stringify(lessons),
    quizzes: JSON.stringify(quizzes),
  } as any);

  const body = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
  expect(body).toMatchObject({
    title: "Lập trình PLC",
    instructor: "Nguyễn An",
    creatorUid: "actor",
    icon: "GraduationCap",
    lessons,
    quizzes,
  });
});
