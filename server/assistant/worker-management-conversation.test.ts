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
        if (state.turns.some(turn => turn.requestId === input.requestId && turn.userId === input.userId && turn.companyCode === input.companyCode)) {
          throw Object.assign(new Error("Duplicate request"), { code: 11000 });
        }
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
    listWorkflows: vi.fn(async () => ASSISTANT_OPERATIONS.filter(op => ["worker", "labor-partner", "student-partner", "retail-partner"].includes(op.module) || op.path === "/retail/finance/commission/kpi").map(defaultWorkflow)),
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
import { ASSISTANT_OPERATIONS } from "./catalog";
import { callOperation } from "./executor";
import { parseAssistantResultTable } from "../../src/shared/assistant-result-table";

const projectId = "64b000000000000000000021";
const workerId = "64b000000000000000000022";
const contractId = "64b000000000000000000023";
const req = { user: { id: "actor", uid: "actor", email: "actor@example.com", companyCode: "TEST", branchId: "507f1f77bcf86cd799439012", role: "admin" }, headers: { authorization: "Bearer scoped" }, socket: { localPort: 4050, localAddress: "127.0.0.1" } } as any;
const turn = (input: any) => processTurn(req, { conversationId: "worker-conversation", requestId: randomUUID(), ...input });
const json = (data: unknown) => new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
let fetcher: ReturnType<typeof vi.fn>;
let savedWorker: Record<string, unknown> | undefined;

async function useSemanticModel(actionId: string, values: Record<string, unknown>) {
  const actual = await vi.importActual<typeof import("./semantic-interpreter")>("./semantic-interpreter");
  state.interpret.mockImplementation(actual.interpretRequest);
  state.provider.mockResolvedValue({ text: JSON.stringify({ actionId, values, intentType: "workflow" }) });
}
const kpiOperation = ASSISTANT_OPERATIONS.find(op => op.path === "/worker-management/partners/kpi")!;
it("does not write a legacy student commission value that cannot change the calculated commission", async () => {
  const op = ASSISTANT_OPERATIONS.find(op => op.id === "partner.commission.update")!;
  await expect(callOperation(req, op, { path_id: workerId, commissionType: "percentage", commissionValue: 7 })).rejects.toThrow("không thay đổi kết quả tính");
  expect(fetcher).not.toHaveBeenCalled();
});
it("does not silently discard a monthly constraint on cumulative student partner data", async () => {
  await useSemanticModel("partner.analysis", { from: "2026-11-01", to: "2026-11-30", analysis: { extreme: { field: "referredStudentsCount", direction: "max" } } });
  const result = await turn({ text: "Đối tác học viên giới thiệu nhiều nhất tháng 11/2026" });
  expect(result.reply).toContain("lũy kế");
  expect(fetcher).not.toHaveBeenCalled();
  expect(result.reply).not.toContain("kết quả:");
});
it("ranks all student partner pages, including a winner on the next page, with an explicit cumulative scope", async () => {
  await useSemanticModel("partner.analysis", { analysis: { extreme: { field: "referredStudentsCount", direction: "max" } } });
  const partner = (id: string, name: string, count: number) => ({ _id: id, name, levelName: "Bạc", referredStudentsCount: count, totalReferredTuition: count * 1000000, totalCommission: count * 10000, totalPaid: 0, unpaidBalance: count * 10000, bankAccountNo: "PRIVATE" });
  fetcher.mockImplementation(async (url, init) => {
    expect(init?.method).toBe("GET");
    const query = new URL(String(url)).searchParams;
    expect(query.has("analysis")).toBe(false);
    expect(query.has("query_periodAnchor")).toBe(false);
    const page = Number(query.get("page"));
    return json({ success: true, page, total: 3, partners: page === 1 ? [partner("a", "An", 2), partner("b", "Bình", 0)] : [partner("c", "Chi", 9)] });
  });
  const result = await turn({ text: "Đối tác học viên nào giới thiệu nhiều học viên nhất từ trước đến nay?" });
  expect(result.status, JSON.stringify(result)).toBe("completed");
  expect(parseAssistantResultTable(result.reply)?.rows.map(row => row.values["Đối tác"])).toEqual(["Chi"]);
  expect(result.reply).toContain("lũy kế");
  expect(result.reply).not.toContain("PRIVATE");
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it("analyzes retail net commission by date range without treating entries as orders or KPI targets", async () => {
  const op = ASSISTANT_OPERATIONS.find(op => op.path === "/retail/finance/commission/kpi")!;
  await useSemanticModel(op.id, { from: "2026-11-01", to: "2026-11-30", analysis: { filters: [{ field: "commission", operator: "gte", value: 500000 }], sort: { field: "commission", direction: "desc" } } });
  fetcher.mockImplementation(async (url, init) => {
    const parsed = new URL(String(url));
    expect(parsed.pathname).toBe("/api/v1/retail/finance/commission/kpi");
    expect(parsed.searchParams.get("from")).toBe("2026-11-01");
    expect(parsed.searchParams.get("to")).toBe("2026-11-30");
    expect(init?.method).toBe("GET");
    return json({ success: true, data: [{ partnerName: "An", partnerCode: "A", commission: 700000, sources: 3 }, { partnerName: "Bình", partnerCode: "B", commission: 0, sources: 0 }] });
  });
  const result = await turn({ text: "Đối tác bán lẻ có hoa hồng tháng 11/2026 ít nhất 500 nghìn, sắp giảm dần" });
  expect(result.status, JSON.stringify(result)).toBe("completed");
  expect(result.reply).toContain("01/11/2026");
  expect(parseAssistantResultTable(result.reply)?.rows.map(row => row.values["Đối tác"])).toEqual(["An"]);
  expect(result.reply).toContain("Số bút toán hoa hồng");
  expect(result.reply).not.toContain("Số đơn hàng");
});

it.each([
  ["/partners/commission-levels/:id", "partner.commission.levels.list", { name: "Bạc", minTuition: 10000000, commissionRate: 5 }, { commissionRate: 7 }, "Sửa tỷ lệ hoa hồng cấp Bạc thành 7%", { commissionRate: 7, minTuition: 10000000, name: "Bạc" }],
  ["/retail/partners/commission-policies/:id", "retail.partner.commission.policy.list", { effectiveAt: "2026-12-01T00:00:00.000Z", config: { phoneAmount: 250000, accessoryBps: 1000, repairBps: 1100 }, partnerId: "" }, { config: { accessoryBps: 1200 } }, "Sửa hoa hồng phụ kiện thành 12%", { config: { phoneAmount: 250000, accessoryBps: 1200, repairBps: 1100 } }],
])("partially updates partner commission configuration at %s", async (path, _listId, existing, change, text, expected) => {
  const op = ASSISTANT_OPERATIONS.find(op => op.path === path && op.method === "PATCH")!;
  const id = "64b000000000000000000096";
  let record = { id, _id: id, ...existing };
  let writes = 0;
  fetcher.mockImplementation(async (url, init) => {
    const pathname = new URL(String(url)).pathname;
    if (init?.method === "PATCH") { writes++; record = { ...record, ...JSON.parse(String(init.body)) }; return json({ success: true, data: record }); }
    return json({ success: true, data: pathname.includes("retail") ? { items: [record], legacy: [] } : [record] });
  });
  await useSemanticModel(op.id, change);
  const selection = await turn({ text });
  expect(selection.status, JSON.stringify(selection)).toBe("collecting");
  const choice = selection.referenceSelections?.find(group => group.key === "path_id")?.options[0];
  expect(choice, JSON.stringify(selection)).toBeDefined();
  if (path.includes("retail")) expect(choice!.label).toContain("Chính sách chung");
  const preview = await turn({ referenceSelections: { path_id: [choice!.value] } });
  expect(preview.status, JSON.stringify(preview)).toBe("confirmation");
  expect(writes).toBe(0);
  const saved = await turn({ decision: { id: preview.action!.id, confirmed: true } });
  expect(saved.status, JSON.stringify(saved)).toBe("completed");
  expect(record).toMatchObject(expected);
  expect(writes).toBe(1);
  expect(parseAssistantResultTable(saved.reply)).not.toBeNull();
});
it.each([
  ["Đối tác nào giới thiệu được nhiều lao động nhất trong tháng", { extreme: { field: "actualReferrals", direction: "max" } }, ["An", "Bình"]],
  ["Đối tác nào giới thiệu được ít lao động nhất trong tháng", { extreme: { field: "actualReferrals", direction: "min" } }, ["Dung"]],
  ["Đối tác nào đang thiếu KPI tháng", { filters: [{ field: "status", operator: "eq", value: "incomplete" }] }, ["Chi"]],
  ["Các đối tác nào đã đạt đủ KPI", { filters: [{ field: "status", operator: "eq", value: "achieved" }] }, ["An", "Bình"]],
  ["Đối tác chưa đạt KPI nhưng đã giới thiệu ít nhất 3 lao động, xếp giảm dần", { filters: [{ field: "status", operator: "eq", value: "incomplete" }, { field: "actualReferrals", operator: "gte", value: 3 }], sort: { field: "actualReferrals", direction: "desc" } }, ["Chi"]],
])("executes declared analysis through the shared conversation: %s", async (question, analysis, names) => {
  await useSemanticModel(kpiOperation.id, { query_periodAnchor: "2026-11-01", analysis });
  fetcher.mockImplementation(async (url, init) => {
    expect(init?.method).toBe("GET");
    const parsed = new URL(String(url));
    expect(parsed.pathname).toBe("/api/v1/worker-management/partners/kpi");
    expect(parsed.searchParams.get("periodAnchor")).toBe("2026-11-01");
    expect(parsed.searchParams.has("analysis")).toBe(false);
    return json({ success: true, data: { periodStart: "2026-11-01", periodEnd: "2026-12-01", items: [
      { partner: { name: "An", code: "A" }, actualReferrals: 10, targetReferrals: 5, remainingReferrals: 0, completionRate: 200, status: "achieved" },
      { partner: { name: "Bình", code: "B" }, actualReferrals: 10, targetReferrals: 10, remainingReferrals: 0, completionRate: 100, status: "achieved" },
      { partner: { name: "Chi", code: "C" }, actualReferrals: 3, targetReferrals: 5, remainingReferrals: 2, completionRate: 60, status: "incomplete" },
      { partner: { name: "Dung", code: "D" }, actualReferrals: 0, targetReferrals: 0, remainingReferrals: null, completionRate: null, status: "not_set" },
    ] } });
  });
  const result = await turn({ text: `Trong quản lí lao động, ${question}` });
  expect(result.status, JSON.stringify(result)).toBe("completed");
  const table = parseAssistantResultTable(result.reply)!;
  expect(table.rows.map(row => row.values["Đối tác"])).toEqual(names);
  expect(result.reply).toContain("11/2026");
  expect(state.turns.at(-1).steps.at(-1).status).toBe("completed");
});

it.each([false, true])("merges a nested policy edit and checks the confirmation snapshot (concurrent change=%s)", async concurrentChange => {
  const op = ASSISTANT_OPERATIONS.find(op => op.partialUpdate && op.module === "labor-partner")!;
  const policyId = "64b000000000000000000099";
  let policy: any = { id: policyId, _id: policyId, name: "Chính sách cuối năm", effectiveFrom: "2026-12-01", version: 1, status: "active", settlementCycle: { type: "calendar_month", cutoffDay: null }, official: { enabled: true, maxMonths: 3, milestones: [1, 2, 3].map(month => ({ month, amount: 100000 * month, eligibilityRule: "contract_active" })) }, seasonal: { enabled: false, tiers: [] } };
  const original = structuredClone(policy);
  let writes = 0;
  fetcher.mockImplementation(async (url, init) => {
    const path = new URL(String(url)).pathname;
    if (path.endsWith("/policies")) return json({ success: true, data: [policy] });
    if (path.endsWith(`/policies/${policyId}`) && init?.method === "PATCH") {
      writes++; policy = { ...policy, ...JSON.parse(String(init.body)) };
      if (policy.settlementCycle.type === "calendar_month") policy.settlementCycle.cutoffDay = null;
      return json({ success: true, data: policy });
    }
    if (path.endsWith(`/policies/${policyId}`)) return json({ success: true, data: policy });
    throw new Error(`Unexpected ${path}`);
  });
  await useSemanticModel(op.id, { official: { maxMonths: 2 } });
  const selection = await turn({ text: "Trong quản lý lao động, chỉnh sửa chính sách phần Số mốc tháng thành 2 tháng" });
  expect(selection.status, JSON.stringify(selection)).toBe("collecting");
  expect(selection.reply).not.toContain("Trường không được hỗ trợ");
  expect(selection.referenceSelections).toHaveLength(1);
  const policyChoice = selection.referenceSelections?.find(group => group.key === "path_policyId")?.options[0];
  expect(policyChoice, JSON.stringify(selection)).toBeDefined();
  const preview = await turn({ referenceSelections: { path_policyId: [policyChoice!.value] } });
  expect(preview.status, JSON.stringify(preview)).toBe("confirmation");
  expect(JSON.parse(String(state.session.pending.provided.official))).toEqual({ maxMonths: 2 });
  expect(writes).toBe(0);
  if (concurrentChange) policy.official.milestones[0].amount = 999999;
  const saved = await turn({ decision: { id: preview.action!.id, confirmed: true } });
  if (concurrentChange) {
    expect(saved.status).toBe("failed");
    expect(saved.reply).toContain("đã thay đổi");
    expect(writes).toBe(0);
    return;
  }
  expect(saved.status, JSON.stringify(saved)).toBe("completed");
  expect(writes).toBe(1);
  expect(policy.official.milestones).toEqual(original.official.milestones.slice(0, 2));
  expect(policy.official.maxMonths).toBe(2);
  expect(policy.seasonal).toEqual(original.seasonal);
  expect(policy.settlementCycle).toEqual(original.settlementCycle);
  expect(parseAssistantResultTable(saved.reply)).not.toBeNull();
});

it("collects missing commission rules instead of inventing them for a named new policy", async () => {
  const op = ASSISTANT_OPERATIONS.find(op => op.method === "POST" && op.path === "/worker-management/partners/policies")!;
  await useSemanticModel(op.id, { name: "Chính sách lao động cuối năm", effectiveFrom: "2026-12-01" });
  const result = await turn({ text: "Thêm 1 chính sách hoa hồng mới - Chính sách lao động cuối năm, áp dụng từ 1/12/2026" });
  expect(result.status, JSON.stringify(result)).toBe("collecting");
  expect(state.session.pending.provided).toMatchObject({ name: "Chính sách lao động cuối năm", effectiveFrom: "2026-12-01" });
  expect(fetcher.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  expect(result.referenceSelections?.some(group => group.key === "laborPolicyTypes")).toBe(true);
  const policyId = "64b000000000000000000098";
  let policy: any;
  let creations = 0;
  fetcher.mockImplementation(async (url, init) => {
    const path = new URL(String(url)).pathname;
    if (path.endsWith("/policies") && init?.method === "POST") {
      creations++;
      policy = { id: policyId, _id: policyId, ...JSON.parse(String(init.body)), status: "active", version: 1 };
      return json({ success: true, data: policy });
    }
    if (path.endsWith("/policies")) return json({ success: true, data: [policy] });
    if (path.endsWith(`/policies/${policyId}`) && init?.method === "PATCH") Object.assign(policy, JSON.parse(String(init.body)));
    if (path.endsWith(`/policies/${policyId}`)) return json({ success: true, data: policy });
    throw new Error(`Unexpected ${path}`);
  });
  await useSemanticModel(op.id, { settlementCycle: { type: "calendar_month" }, official: { enabled: true, maxMonths: 1, milestones: [{ month: 1, amount: 300000, eligibilityRule: "contract_active" }] }, seasonal: { enabled: false, tiers: [] } });
  const preview = await turn({ text: "Áp dụng lao động chính thức 1 tháng, hoa hồng 300000 khi hợp đồng còn hiệu lực, đối soát tháng dương lịch. Không áp dụng thời vụ." });
  expect(preview.status, JSON.stringify(preview)).toBe("confirmation");
  const created = await turn({ decision: { id: preview.action!.id, confirmed: true } });
  expect(created.status, JSON.stringify(created)).toBe("completed");
  expect(created.reply).toContain("Bạn có muốn bổ sung không?");
  expect(parseAssistantResultTable(created.reply)).not.toBeNull();
  expect(policy.name).toBe("Chính sách lao động cuối năm");
  const update = ASSISTANT_OPERATIONS.find(candidate => candidate.partialUpdate && candidate.module === "labor-partner")!;
  await useSemanticModel(update.id, { path_policyId: policyId, effectiveTo: "2026-12-31" });
  const updatePreview = await turn({ text: "Có, bổ sung ngày kết thúc hiệu lực 31/12/2026" });
  expect(updatePreview.status, JSON.stringify(updatePreview)).toBe("confirmation");
  const updated = await turn({ decision: { id: updatePreview.action!.id, confirmed: true } });
  expect(updated.status, JSON.stringify(updated)).toBe("completed");
  expect(policy.effectiveTo).toBe("2026-12-31");
  expect(creations).toBe(1);
});

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
it.each(["supplement", "skip", "cancel"])("recovers the screenshot project request through collection, confirmation and %s", async followUp => {
  const names = ["Phạm Quốc Dũng (mẫu)", "Hoàng Thu Hà (mẫu)", "Đỗ Thanh Khoa (mẫu)", "Lê Minh Châu (mẫu)", "Trần Thị Bình (mẫu)"];
  const workers = names.map((fullName, i) => ({ _id: `64b00000000000000000010${i}`, fullName, status: "active" }));
  const days = ["Thứ 2", "Thứ 4", "Thứ 6", "Thứ 3", "Thứ 5", "Thứ 7"];
  let project: Record<string, unknown> | undefined;
  let creations = 0;
  let updates = 0;
  fetcher.mockImplementation(async (url, init) => {
    const path = new URL(String(url)).pathname;
    if (path === "/api/v1/worker-management/workers") return json({ workers });
    if (path === "/api/v1/worker-management/projects" && init?.method === "POST") {
      creations++;
      project = { _id: projectId, id: projectId, ...JSON.parse(String(init.body)) };
      return json({ success: true, data: project });
    }
    if (path === "/api/v1/worker-management/projects") return json({ success: true, data: project ? [project] : [] });
    if (path === `/api/v1/worker-management/projects/${projectId}`) {
      if (init?.method === "PATCH") { updates++; Object.assign(project!, JSON.parse(String(init.body))); }
      return json({ success: true, data: project });
    }
    throw new Error(`Unexpected API: ${path}`);
  });
  await useSemanticModel("worker.project.create", {});
  state.provider.mockReset();
  state.provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: null, values: {}, intentType: "unsupported" }) });
  state.provider.mockResolvedValueOnce({ text: JSON.stringify({ actionIds: ["worker.project.create"] }) });
  state.provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: "worker.project.create", values: { name: "VINSCON20", workerIds: names, daysOfWeek: days }, intentType: "workflow" }) });
  const text = `"tạo 1 dự án mới tên VINSCON20 trong mục quản lí lao động\nMình chọn Tên lao động: ${names.map(name => `${name} — Chi nhánh Trụ sở chính`).join(", ")}; Các ngày trong tuần · Các ngày trong tuần: ${days.join(", ")}."`;
  const missing = await turn({ text });
  expect(missing.status, JSON.stringify(missing)).toBe("collecting");
  expect(missing.reply).toContain("Mã dự án");
  expect(missing.reply).not.toContain("Hướng dẫn dự phòng");
  expect(state.session.pending.provided).toMatchObject({ name: "VINSCON20" });
  expect(creations).toBe(0);
  expect(state.provider).toHaveBeenCalledTimes(3);
  expect(missing.inputForm?.fields.map(field => field.key)).toEqual(["code"]);
  const preview = await turn({ formValues: { id: missing.inputForm!.id, values: { code: "DA-VINSCON20" } } });
  expect(state.provider).toHaveBeenCalledTimes(3);
  expect(preview.status, JSON.stringify(preview)).toBe("confirmation");
  expect(creations).toBe(0);
  for (const name of names) expect(JSON.stringify(preview)).toContain(name);
  for (const worker of workers) expect(JSON.stringify(preview)).not.toContain(worker._id);
  if (followUp === "cancel") {
    const cancelled = await turn({ decision: { id: preview.action!.id, confirmed: false } });
    expect(cancelled.status, JSON.stringify(cancelled)).toBe("cancelled");
    expect(creations).toBe(0);
    expect(updates).toBe(0);
    return;
  }
  const confirmed = { requestId: randomUUID(), decision: { id: preview.action!.id, confirmed: true } };
  const created = await turn(confirmed);
  expect(created.status, JSON.stringify(created)).toBe("completed");
  expect(project).toMatchObject({ code: "DA-VINSCON20", name: "VINSCON20", workerIds: workers.map(worker => worker._id), daysOfWeek: [1, 2, 3, 4, 5, 6] });
  expect((await turn(confirmed)).status).toBe("completed");
  expect(creations).toBe(1);
  expect(parseAssistantResultTable(created.reply)).not.toBeNull();
  expect(created.reply).toContain("Bạn có muốn bổ sung không?");
  if (followUp === "skip") {
    await turn({ text: "Bỏ qua" });
    expect(creations).toBe(1);
    expect(updates).toBe(0);
    return;
  }
  const agreed = await turn({ text: "Có" });
  expect(agreed.status, JSON.stringify(agreed)).toBe("collecting");
  await useSemanticModel("worker.project.update", { location: "Hà Nội" });
  const updatePreview = await turn({ text: "Bổ sung địa điểm Hà Nội cho dự án vừa tạo" });
  expect(updatePreview.status, JSON.stringify(updatePreview)).toBe("confirmation");
  const updated = await turn({ decision: { id: updatePreview.action!.id, confirmed: true } });
  expect(updated.status, JSON.stringify(updated)).toBe("completed");
  expect(project?.location).toBe("Hà Nội");
  expect(parseAssistantResultTable(updated.reply)).not.toBeNull();
  expect(creations).toBe(1);
  expect(updates).toBe(1);
});
it("keeps the short screenshot request as a draft and asks for its missing code", async () => {
  await useSemanticModel("worker.project.create", {});
  state.provider.mockReset();
  state.provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: null, values: {}, intentType: "unsupported" }) });
  state.provider.mockResolvedValueOnce({ text: JSON.stringify({ actionIds: ["worker.project.create"] }) });
  state.provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: "worker.project.create", values: { name: "vinscon20" }, intentType: "workflow" }) });
  const result = await turn({ text: "tạo 1 dự án mới tên vinscon20 quản lí lao động" });
  expect(result.status, JSON.stringify(result)).toBe("collecting");
  expect(result.reply).toContain("Mã dự án");
  expect(result.reply).not.toContain("Hướng dẫn dự phòng");
  expect(state.session.pending.provided).toMatchObject({ name: "vinscon20" });
  expect(state.session.pending.provided).not.toHaveProperty("code");
  expect(result.inputForm?.fields.map(field => field.label)).toEqual(["Mã dự án"]);
  expect(fetcher.mock.calls.some(([, init]) => init?.method !== "GET")).toBe(false);
});
it("offers a server-bound action choice instead of asking the user to rewrite the screenshot request", async () => {
  const text = "tạo 1 dự án mới tên VINSCON20 trong mục quản lí lao động";
  await useSemanticModel("worker.project.create", {});
  state.provider.mockReset();
  state.provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: null, values: {}, intentType: "unsupported" }) });
  state.provider.mockResolvedValueOnce({ text: JSON.stringify({ actionIds: ["worker.project.create"] }) });
  state.provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: null, values: {}, intentType: "unsupported" }) });
  const choice = await turn({ text });
  expect(choice.status, JSON.stringify(choice)).toBe("collecting");
  expect(choice.reply).not.toContain("Ví dụ cách viết");
  expect(choice.workflowSelection?.options.map(option => option.label)).toEqual(["Tạo dự án lao động — Quản lý lao động"]);
  expect(JSON.stringify(choice.workflowSelection)).not.toContain("worker.project.create");
  state.provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: null, values: { name: "VINSCON20" }, intentType: "unsupported" }) });
  const missing = await turn({ workflowSelection: { id: choice.workflowSelection!.id, value: choice.workflowSelection!.options[0].value } });
  expect(missing.status, JSON.stringify(missing)).toBe("collecting");
  expect(missing.inputForm?.fields.map(field => field.key)).toEqual(["code"]);
  expect(state.session.pending.provided).toMatchObject({ name: "VINSCON20" });
  expect(state.session.workflowChoice).toBeNull();
  const interpretation = state.provider.mock.calls[3][0];
  expect(interpretation.messages.at(-1).content).toBe(text);
  expect(fetcher.mock.calls.every(([, init]) => init?.method === "GET")).toBe(true);
});
it.each(["stale", "unexpected-field"])("rejects a %s form without changing the draft or writing", async mode => {
  state.interpret.mockResolvedValueOnce({ actionId: "worker.project.create", values: { name: "VINSCON20" }, intentType: "workflow" });
  const missing = await turn({ text: "Tạo dự án VINSCON20 quản lý lao động" });
  const result = await turn({ formValues: { id: mode === "stale" ? randomUUID() : missing.inputForm!.id, values: mode === "unexpected-field" ? { name: "changed-without-consent" } : { code: "P20" } } });
  expect(result.status).toBe("failed");
  expect(state.session.pending.provided.name).toBe("VINSCON20");
  expect(fetcher.mock.calls.every(([, init]) => init?.method === "GET")).toBe(true);
});
it.each(["project.create", "project.update", "project.delete", "project.list"])("blocks the wrong HR namespace before any API call: %s", async actionId => {
  state.interpret.mockResolvedValueOnce({ actionId, values: { name: "X", id: "X" }, intentType: "workflow" });
  const result = await turn({ text: "Thao tác với dự án X trong mục quản lí lao động" });
  expect(result.status).toBe("failed");
  expect(result.reply).toContain("không khớp yêu cầu thuộc Quản lý lao động");
  expect(fetcher).not.toHaveBeenCalled();
});
it("blocks confirmation of a wrong-module preview persisted before the fix", async () => {
  state.interpret.mockResolvedValueOnce({ actionId: "project.create", values: { name: "X" }, intentType: "workflow" });
  const preview = await turn({ text: "Tạo dự án X trong Nhân sự" });
  expect(preview.status, JSON.stringify(preview)).toBe("confirmation");
  // Simulate the old wrong preview: the saved action is HR but the original request was worker.
  state.session.pending.intent = "Tạo dự án X trong Quản lý lao động";
  fetcher.mockClear();
  const result = await turn({ decision: { id: preview.action!.id, confirmed: true } });
  expect(result.status).toBe("failed");
  expect(result.reply).toContain("không khớp");
  expect(fetcher).not.toHaveBeenCalled();
});
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
