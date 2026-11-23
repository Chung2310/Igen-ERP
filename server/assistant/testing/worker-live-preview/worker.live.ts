import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ session: null as any, turns: [] as any[], documents: [] as any[] }));
vi.mock("../../models", () => {
  const apply = (record: any, updates: any) => {
    for (const [key, value] of Object.entries(updates.$set || {})) {
      const path = key.split("."); let target = record;
      for (const part of path.slice(0, -1)) target = target[part] ??= {};
      target[path.at(-1)!] = structuredClone(value);
    }
  };
  const chain = (getter: () => any): any => ({ sort: () => chain(getter), select: () => chain(getter), lean: async () => structuredClone(getter()) });
  return {
    ensureAssistantIndexes: vi.fn(), AssistantDocumentModel: { create: vi.fn(async input => { state.documents.push(input); return input; }) },
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
vi.mock("../../workflows", async () => {
  const { ASSISTANT_OPERATIONS, defaultWorkflow, operationById } = await import("../../catalog");
  return {
    actorScope: () => ({ userId: "actor", companyCode: "QA" }),
    assertOperation: vi.fn(async (_req, id) => operationById(id)),
    currentWorkflow: vi.fn(async (_req, id) => defaultWorkflow(operationById(id)!)),
    listWorkflows: vi.fn(async () => ASSISTANT_OPERATIONS.filter(op => !op.unavailableReason).map(defaultWorkflow).filter(workflow => workflow.enabled)),
  };
});
vi.mock("../../settings", async () => {
  const { defaultAssistantSettings } = await import("../../../../src/shared/assistant-workflow");
  return { getSettings: vi.fn(async () => ({ ...defaultAssistantSettings, memoryEnabled: false, autoMemoryEnabled: false, alwaysConfirm: true })) };
});
vi.mock("../../documents", () => ({ answerAssistantConversation: vi.fn() }));
vi.mock("../../session-memory", () => ({ SESSION_MEMORY_LIMIT: 2400, summarizeAssistantSession: async () => null }));


// Live evaluation body follows. Ordinary Vitest discovery does not include *.live.ts.
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { processTurn } from "../../service";
import { operationById } from "../../catalog";
import { parseAssistantResultTable } from "../../../../src/shared/assistant-result-table";
import { CASES } from "./cases.mjs";
import { branchId, workers, projects, contracts, businessFixture, today } from "./fixtures";
import { ledger, dryRun, replayRun, providerFetch, providerPreflight, safety, sanitize } from "./provider";

const report: any = { mode: replayRun ? "offline-replay-of-captured-real-luna-outputs" : dryRun ? "offline-harness-check" : "real-luna-synthetic-business-fixtures", startedAt: new Date().toISOString(),
  sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  data: "Artificial entity names only; no screenshot names; no real business API or DB", settings: { alwaysConfirm: true, memoryEnabled: false, responseRules: "application default" },
  cases: [], ledger, business: [], forbiddenBusinessWrites: [], violations: safety.violations };
const output = new URL(replayRun ? "./replay-observations.json" : dryRun ? "./dry-run-observations.json" : "./live-observations.json", import.meta.url);
const persist = () => writeFileSync(output, sanitize(JSON.stringify(report, null, 2)));
let current: any;
const req = { user: { id: "fixture-actor", uid: "fixture-actor", companyCode: "QA", branchId, role: "admin" }, headers: { authorization: "Bearer fixture-only" }, socket: { localPort: 4050, localAddress: "127.0.0.1" } } as any;
const turn = (input: any) => processTurn(req, { conversationId: `preview-${current.id}`, requestId: randomUUID(), mode: "work", ...input });
function scriptedOutput() {
  const cases: Record<string, any> = {
    L01: { name: "QA-LAB-NEW-20", workerIds: workers.slice(0, 5).map(w => `${w.fullName} — Chi nhánh MẪU-QA`), daysOfWeek: ["Thứ 2", "Thứ 4", "Thứ 6", "Thứ 3", "Thứ 5", "Thứ 7"] },
    L02: { mode: "all", date: today }, L03: { mode: "all", projectId: "QA-KHO-01" },
    L04: { mode: "late", projectId: "QA-KHO-01" }, L05: { mode: "absent", projectId: "QA-KHO-01" },
    L06: { path_id: "QA-BANLE-02", location: "140 Đường Kiểm Thử" },
    L07: { path_id: "QA-LAB-03", path_workerId: "LAO-DONG-MAU-06" }, L08: { mode: "shortage" },
    L09: { mode: "absence-threshold", projectId: "QA-LAB-03", threshold: 3 }, L10: { fullName: "LAO-DONG-MAU-08" },
    L12: {}, L13: { path_id: "LAO-DONG-MAU-07", laborType: "seasonal" },
    L14: { path_id: "LAO-DONG-MAU-04" }, L15: { path_id: "LAO-DONG-MAU-05", clientName: "CÔNG TY MẪU QA-EMPLOYER" },
    C01: { name: "QA-TYPE-CHOICE" }, C02: { name: "QA-HR-ONLY" },
  };
  if (current.id === "L11") return { actionId: null, values: {}, intentType: "ambiguous", clarification: "Chưa có bộ lọc lao động không có hợp đồng cho nguồn này. Bạn muốn chọn phạm vi nào?" };
  if (current.id === "C01") return { actionId: null, values: {}, intentType: "ambiguous", clarification: "Dự án thuộc phân hệ Nhân sự hay quản lý lao động?" };
  return { actionId: current.id === "C01" ? "project.create" : current.actions[0], values: cases[current.id] || {}, intentType: "workflow" };
}
beforeAll(async () => {
  vi.stubEnv("ASSISTANT_SAFE_EXECUTION", "false"); vi.stubEnv("ASSISTANT_PRODUCT_READ_V2", "false");
  if (dryRun || replayRun) vi.stubEnv("OPENROUTER_API_KEY", "fixture-only-not-a-real-provider-key");
  await providerPreflight();
  vi.stubGlobal("fetch", async (input: any, init: any = {}) => {
    const value = String(input);
    if (value === "https://openrouter.ai/api/v1/chat/completions") return providerFetch(value, init, current.id, scriptedOutput(), persist);
    const url = new URL(value);
    if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || !url.pathname.startsWith("/api/v1/")) {
      safety.violations.push("UNEXPECTED_FETCH_DESTINATION"); throw new Error("UNEXPECTED_FETCH_DESTINATION");
    }
    const entry = { caseId: current.id, method: init.method || "GET", path: url.pathname, query: Object.fromEntries(url.searchParams) };
    report.business.push(entry); persist();
    if (!["GET", "HEAD"].includes(entry.method)) { report.forbiddenBusinessWrites.push(entry); persist(); throw new Error("BUSINESS_WRITE_BLOCKED_BEFORE_TRANSPORT"); }
    try { return Response.json(businessFixture(url)); }
    catch (error) { safety.violations.push(String(error)); throw error; }
  });
});
beforeEach(() => { state.session = null; state.turns = []; state.documents = []; });
afterEach(() => { persist(); expect(safety.violations).toEqual([]); expect(report.forbiddenBusinessWrites).toEqual([]); });
afterAll(() => { report.finishedAt = new Date().toISOString(); persist(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it.each(CASES)("$id: preview/read for screenshot row $row", async (item: any, ctx: any) => {
  current = item;
  if (ledger.stopReason) { ctx.skip(); return; }
  const startCalls = ledger.calls.length, startBusiness = report.business.length;
  const row: any = { id: item.id, screenshotRow: item.row, control: Boolean(item.control), input: item.text, expectedActions: item.actions, turns: [], startedAt: new Date().toISOString() };
  report.cases.push(row); persist();
  try {
    let reply: any = await turn({ text: item.text });
    row.firstStatus = reply.status;
    row.namespaceQuestion = Boolean(reply.workflowSelection) || /nhân sự/i.test(reply.reply) && /(?:quản l[ýí]\s+(?:người\s+)?lao động|quản l[ýí] người lao động)/i.test(reply.reply);
    const record = (value: any, supplied?: any) => { row.turns.push({ status: value.status, reply: value.reply, action: value.action, inputForm: value.inputForm, workflowSelection: value.workflowSelection,
      referenceSelections: value.referenceSelections, files: value.files, supplied }); persist(); };
    record(reply);
    for (let round = 0; round < 4 && reply.status === "collecting" && item.kind !== "clarify"; round++) {
      if (reply.workflowSelection) {
        const chosen = reply.workflowSelection.options.find((option: any) => {
          const privateOption = state.session.workflowChoice?.options.find((saved: any) => saved.value === option.value);
          return privateOption && item.actions.includes(privateOption.actionId);
        });
        if (!chosen) { row.stopReason = "NO_EXPECTED_ACTION_IN_OPTIONS"; break; }
        reply = await turn({ workflowSelection: { id: reply.workflowSelection.id, value: chosen.value } });
        record(reply, { choiceLabel: chosen.label }); continue;
      }
      const pending = state.session.pending;
      if (!pending || !item.actions.includes(pending.actionId)) break;
      const groups = reply.referenceSelections || [];
      const selection: Record<string, string[]> = {}, skips: string[] = [];
      let cannotFill = false;
      for (const group of groups) {
        if (!group.required) { skips.push(group.key); continue; }
        const target = group.key.toLowerCase().includes("worker") ? item.worker : group.key.toLowerCase().includes("project") || pending.actionId.startsWith("worker.project.") && group.key === "path_id" ? item.project : undefined;
        const matches = target ? group.options.filter((option: any) => option.label.includes(target)) : [];
        if (matches.length !== 1) { cannotFill = true; break; }
        selection[group.key] = [matches[0].value];
      }
      const values: Record<string, unknown> = {};
      for (const field of reply.inputForm?.fields || []) {
        if (Object.hasOwn(item.fill || {}, field.key)) values[field.key] = item.fill[field.key];
        else if (field.required) cannotFill = true;
      }
      if (cannotFill || !reply.inputForm && !groups.length) break;
      reply = reply.inputForm
        ? await turn({ formValues: { id: reply.inputForm.id, values, referenceSelections: selection, skipReferenceKeys: skips } })
        : await turn({ referenceSelections: selection, skipReferenceKeys: skips });
      record(reply, { values, selectedKeys: Object.keys(selection), skippedKeys: skips });
    }
    // Confirm a read only when the catalog proves GET. Never confirm any write.
    if (item.kind === "read" && reply.status === "confirmation" && operationById(state.session.pending?.actionId)?.method === "GET") {
      reply = await turn({ decision: { id: reply.action.id, confirmed: true } });
      record(reply, { confirmedPureGetOnly: true });
    }
    row.finalStatus = reply.status;
    const finalTurn = state.turns.at(-1);
    row.actionId = state.session.pending?.actionId || finalTurn?.actionId || [...(finalTurn?.steps || [])].reverse().find(step => step.actionId)?.actionId;
    row.namespace = row.actionId ? operationById(row.actionId)?.module : null;
    row.pendingResolved = state.session.pending?.resolved;
    row.readCalls = report.business.slice(startBusiness);
    row.aiRequests = ledger.calls.slice(startCalls);
    const issues: string[] = [];
    if (item.kind !== "clarify" && !item.actions.includes(row.actionId)) issues.push("WRONG_OR_MISSING_ACTION");
    if (item.kind === "clarify" && reply.status !== "collecting") issues.push("DID_NOT_STOP_FOR_CLARIFICATION");
    if (item.kind === "write" && reply.status !== "confirmation") issues.push("NOT_AT_CONFIRMATION");
    if (item.kind === "read" && reply.status !== "completed") issues.push("READ_NOT_COMPLETED");
    for (const [key, value] of Object.entries(item.expected || {})) if (state.session.pending?.resolved && state.session.pending.resolved[key] !== value) issues.push(`WRONG_VALUE:${key}`);
    const resolved = state.session.pending?.resolved;
    if (item.kind === "write" && reply.status === "confirmation") {
      const expectedProject = projects.find(project => project.code === item.project);
      const expectedWorker = workers.find(worker => worker.fullName === item.worker);
      const expectedContract = expectedWorker && contracts.find(contract => contract.workerId === expectedWorker.id);
      if (expectedProject && resolved?.path_id !== expectedProject.id) issues.push("WRONG_TARGET_PROJECT");
      if (expectedWorker && row.actionId === "worker.project.worker.remove" && resolved?.path_workerId !== expectedWorker.id) issues.push("WRONG_TARGET_WORKER");
      if (expectedWorker && row.actionId === "worker.update" && resolved?.path_id !== expectedWorker.id) issues.push("WRONG_TARGET_WORKER");
      if (expectedContract && row.actionId.startsWith("worker.labor.contract.") && resolved?.path_id !== expectedContract.id) issues.push("WRONG_TARGET_CONTRACT");
      if (item.id === "L01") {
        const members = typeof resolved?.workerIds === "string" ? JSON.parse(resolved.workerIds) : resolved?.workerIds;
        if (JSON.stringify([...(members || [])].sort()) !== JSON.stringify(workers.slice(0, 5).map(worker => worker.id).sort())) issues.push("WRONG_PROJECT_MEMBERS");
        const days = typeof resolved?.daysOfWeek === "string" ? JSON.parse(resolved.daysOfWeek) : resolved?.daysOfWeek;
        const dayNumber = (value: unknown) => typeof value === "number" ? value : ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"].indexOf(String(value));
        if (JSON.stringify((days || []).map(dayNumber).sort()) !== JSON.stringify([1, 2, 3, 4, 5, 6])) issues.push("WRONG_PROJECT_WORKDAYS");
        if (resolved?.name !== "QA-LAB-NEW-20" || resolved?.code !== "QA-PREVIEW-20") issues.push("WRONG_NEW_PROJECT_IDENTITY");
      }
    }
    const reportCalls = row.readCalls.filter((call: any) => call.path.endsWith("/worker-management/reports/assistant"));
    if (item.mode && reply.status === "completed" && !reportCalls.some((call: any) => (call.query.mode || "all") === item.mode)) issues.push("REPORT_MODE_NOT_APPLIED");
    const project = item.project && projects.find(project => project.code === item.project);
    if (project && item.kind === "read" && reply.status === "completed" && !row.readCalls.some((call: any) => [call.query.projectId, call.query.project_id].includes(project.id))) issues.push("PROJECT_FILTER_NOT_APPLIED");
    if (item.threshold && reply.status === "completed" && !reportCalls.some((call: any) => Number(call.query.threshold) === item.threshold)) issues.push("WRONG_ABSENCE_THRESHOLD");
    if (item.today && reply.status === "completed" && !reportCalls.some((call: any) => call.query.date === today)) issues.push("TODAY_FILTER_NOT_APPLIED");
    if (item.mustAskPeriod && reply.status === "completed" && !reportCalls.some((call: any) => call.query.from === item.fill.from && call.query.to === item.fill.to)) issues.push("WRONG_REPORT_PERIOD");
    if (item.mustAskPeriod && row.firstStatus !== "collecting") issues.push("DID_NOT_ASK_PERIOD");
    if (item.expectNamespaceQuestion && !row.namespaceQuestion) issues.push("DID_NOT_ASK_PROJECT_NAMESPACE");
    if (item.unsupportedFilter) issues.push(reply.status === "completed" ? "CONTRACT_ABSENCE_FILTER_NOT_PROVEN" : "CAPABILITY_GAP_NEEDS_SUPPORTED_FILTER");
    if (item.export && !reply.files?.some((file: any) => file.format === "xlsx")) issues.push("NO_XLSX_OUTPUT");
    if (item.export && state.documents.length) {
      const file = state.documents.at(-1)?.files?.[0];
      if (file?.bytes?.subarray(0, 2).toString() !== "PK") issues.push("INVALID_XLSX_BYTES");
      else { const path = new URL(replayRun ? "./replay-export.xlsx" : dryRun ? "./dry-run-export.xlsx" : "./live-export.xlsx", import.meta.url); writeFileSync(path, file.bytes); row.exportFile = { fileName: file.fileName, size: file.bytes.length }; }
    }
    const visible = JSON.stringify({ reply: reply.reply, values: reply.action?.values });
    if ([...workers, ...projects, ...contracts].some(record => visible.includes(record.id))) issues.push("INTERNAL_RECORD_ID_VISIBLE");
    row.issues = issues; row.functionalPass = issues.length === 0; row.writeSafetyPass = report.forbiddenBusinessWrites.length === 0;
    row.tableParsed = Boolean(parseAssistantResultTable(reply.reply));
    row.elapsedMs = Date.now() - new Date(row.startedAt).valueOf(); persist();
    console.info(JSON.stringify({ case: row.id, status: row.finalStatus, action: row.actionId, issues, aiRequests: row.aiRequests.length, spentUSD: ledger.spentUSD }));
    // Dry-run validates harness safety/plumbing, never model accuracy or business capability.
    if (!dryRun) expect(row.functionalPass, JSON.stringify({ id: row.id, issues, status: row.finalStatus, action: row.actionId, reply: reply.reply })).toBe(true);
  } catch (error) {
    row.error = sanitize(String(error)); row.elapsedMs = Date.now() - new Date(row.startedAt).valueOf(); persist(); throw error;
  }
});
