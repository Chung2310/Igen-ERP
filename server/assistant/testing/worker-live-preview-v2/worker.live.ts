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
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { processTurn } from "../../service";
import { operationById } from "../../catalog";
import { parseAssistantResultTable } from "../../../../src/shared/assistant-result-table";
import { CASES } from "./cases.mjs";
import { branchId, workers, projects, contracts, businessFixture, today } from "./fixtures";
import { ledger, dryRun, replayRun, resumeRun, previousRun, pricingGuard, providerFetch, providerPreflight, safety, sanitize } from "./provider";
import { createStudentSchema } from "../../../modules/student-management/validations/student.validation";
import { extraScript, extraChecks, extraStudent, extraPolicy } from './extra-scenarios';
import { moduleScript, moduleChecks } from './module-scenarios';

const sourceFiles = ['catalog.ts', 'operation-metadata.ts', 'list-analysis.ts', 'business-result.ts', 'legal-reference.ts', 'result-format.ts', 'semantic-interpreter.ts', 'interpretation-budget.ts', 'request-coverage.ts', 'module-context.ts', 'composite-query.ts', 'function-context.ts', 'service.ts', 'result-field-policy.ts', 'read-relations.ts', 'collection-form.ts', 'policy.ts'];
const report: any = { mode: replayRun ? "offline-replay-of-captured-real-luna-outputs" : dryRun ? "offline-harness-check" : "real-luna-synthetic-business-fixtures", startedAt: new Date().toISOString(),
  sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  data: "Artificial entity names only; no screenshot names; no real business API or DB", settings: { alwaysConfirm: true, memoryEnabled: false, responseRules: "application default" },
  cases: previousRun?.cases.filter((row: any) => row.functionalPass) || [], previousStoppedCases: previousRun?.cases.filter((row: any) => !row.functionalPass) || [],
  sourceFiles: Object.fromEntries(sourceFiles.map(name => [name, createHash('sha256').update(readFileSync(new URL(`../../${name}`, import.meta.url))).digest('hex')])),
  resumed: resumeRun, pricingGuard, ledger, business: previousRun?.business || [], forbiddenBusinessWrites: [], violations: safety.violations };
const outputDirectory = process.env.ASSISTANT_WORKER_LIVE_OUTPUT_DIR
  ? pathToFileURL(resolve(process.env.ASSISTANT_WORKER_LIVE_OUTPUT_DIR) + '/') : new URL('./', import.meta.url);
mkdirSync(outputDirectory, { recursive: true });
const output = new URL(replayRun ? "./replay-observations.json" : dryRun ? "./dry-run-observations.json" : "./live-observations.json", outputDirectory);
const persist = () => writeFileSync(output, sanitize(JSON.stringify(report, null, 2)));
let current: any;
let followed = false;
let requestText = '';
const req = { user: { id: "fixture-actor", uid: "fixture-actor", companyCode: "QA", branchId, role: "admin" }, headers: { authorization: "Bearer fixture-only" }, socket: { localPort: 4050, localAddress: "127.0.0.1" } } as any;
const turn = (input: any) => {
  if(input.text) requestText = input.text;
  return processTurn(req, { conversationId: `preview-${current.id}`, requestId: randomUUID(), mode: "work", ...input });
};
function scriptedOutput() {
  if(current.id.startsWith('N')) return moduleScript(current);
  if (current.id.startsWith('X')) return extraScript(current, followed, today);
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
    E01: { fullName: "HOC-VIEN-MAU-01", phone: "0900000001", email: "qa@example.test", registrationDate: "2026-11-23" },
    E02: { fullName: "HOC-VIEN-MAU-02", phone: "0900000002", email: "qa@company.vn", registrationDate: "2026-11-23" },
  };
  if (current.id === "L11") return { actionId: null, values: {}, intentType: 'workflow', actionIntent: 'report', queryPlan: [
    { actionId: 'worker.list', purpose: 'Lao động', values: {}, resultFields: ['fullName'], relation: 'workers-without-contracts' },
    { actionId: 'worker.labor.contract.list', purpose: 'Hợp đồng', values: {}, resultFields: ['workerName'] },
  ], requestCoverage: [
    { evidence: 'trong quản lí lao động', requirement: 'Phân hệ', mappedTo: ['context.module'] },
    { evidence: 'báo cáo Danh sách các lao động chưa có hợp đồng', requirement: 'Không có hợp đồng', mappedTo: ['query:worker.list:relation'] },
  ] };
  if (current.id === "C01") return { actionId: null, values: {}, intentType: "ambiguous", clarification: "Dự án thuộc phân hệ Nhân sự hay quản lý lao động?" };
  return { actionId: current.id === "C01" ? "project.create" : current.actions[0], values: cases[current.id] || {}, intentType: "workflow" };
}
beforeAll(async () => {
  vi.stubEnv("ASSISTANT_SAFE_EXECUTION", "false"); vi.stubEnv("ASSISTANT_PRODUCT_READ_V2", "false");
  if (dryRun || replayRun) vi.stubEnv("OPENROUTER_API_KEY", "fixture-only-not-a-real-provider-key");
  await providerPreflight();
  vi.stubGlobal("fetch", async (input: any, init: any = {}) => {
    const value = String(input);
    if (value === "https://openrouter.ai/api/v1/chat/completions") return providerFetch(value, init, current.id, scriptedOutput(), persist, requestText);
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
beforeEach(() => { state.session = null; state.turns = []; state.documents = []; followed = false; });
afterEach(() => { persist(); expect(safety.violations).toEqual([]); expect(report.forbiddenBusinessWrites).toEqual([]); });
afterAll(() => { report.finishedAt = new Date().toISOString(); persist(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it.for(CASES)("$id: preview/read for screenshot row $row", async (item: any, ctx: any) => {
  current = item;
  if (previousRun?.cases.some((row: any) => row.id === item.id && row.functionalPass)) { ctx.skip(); return; }
  if (ledger.stopReason) { ctx.skip(); return; }
  const startCalls = ledger.calls.length, startBusiness = report.business.length;
  const row: any = { id: item.id, screenshotRow: item.row, control: Boolean(item.control), input: item.text, expectedActions: item.actions, turns: [], startedAt: new Date().toISOString() };
  report.cases.push(row); persist();
  try {
    let reply: any = await turn({ text: item.text });
    row.firstStatus = reply.status;
    row.namespaceQuestion = Boolean(reply.workflowSelection) || /nhân sự/i.test(reply.reply) && /(?:quản l[ýí]\s+(?:người\s+)?lao động|dự án lao động)/i.test(reply.reply);
    const record = (value: any, supplied?: any) => { row.turns.push({ status: value.status, reply: value.reply, action: value.action, inputForm: value.inputForm, workflowSelection: value.workflowSelection,
      referenceSelections: value.referenceSelections, files: value.files, supplied }); persist(); };
    let clarified = false;
    const canClarify = () => item.clarificationText && !clarified && reply.status==='collecting' && !state.session.pending && !reply.workflowSelection
      && /loại hồ sơ|khóa đào tạo|đào tạo nội bộ|phân hệ/iu.test(reply.reply) && !/ghi nhận.*phần trăm/iu.test(reply.reply);
    record(reply);
    if(canClarify()) {
      clarified = true;
      reply=await turn({text:item.clarificationText}); record(reply,{clarificationText:item.clarificationText});
    }
    if (item.followup && reply.status === 'collecting' && item.actions.includes(state.session.pending?.actionId)) {
      followed = true;
      reply = await turn({text:item.followup}); record(reply, {text:item.followup});
    }
    for (let round = 0; round < 4 && reply.status === "collecting" && item.kind !== "clarify"; round++) {
      if(canClarify()) { clarified=true; reply=await turn({text:item.clarificationText}); record(reply,{clarificationText:item.clarificationText}); continue; }
      if (reply.workflowSelection) {
        const chosen = reply.workflowSelection.options.find((option: any) => {
          const privateOption = state.session.workflowChoice?.options.find((saved: any) => saved.value === option.value);
          return privateOption && (item.actions.includes(privateOption.actionId)
            || privateOption.module && item.actions.some((id: string) => operationById(id)?.module === privateOption.module));
        });
        if (!chosen) { row.stopReason = "NO_EXPECTED_ACTION_IN_OPTIONS"; break; }
        reply = await turn({ workflowSelection: { id: reply.workflowSelection.id, value: chosen.value } });
        record(reply, { choiceLabel: chosen.label }); continue;
      }
      const pending = state.session.pending;
      if(item.followup && !followed && item.actions.includes(pending?.actionId)) {
        followed=true; reply=await turn({text:item.followup}); record(reply,{text:item.followup}); continue;
      }
      if (!pending || !item.actions.includes(pending.actionId)) break;
      const groups = reply.referenceSelections || [];
      const selection: Record<string, string[]> = {}, skips: string[] = [];
      let cannotFill = false;
      for (const group of groups) {
        if (!group.required) { skips.push(group.key); continue; }
        const target = item.referenceTarget || (group.key.toLowerCase().includes("worker") ? item.worker
          : group.key.toLowerCase().includes("project") || pending.actionId.startsWith("worker.project.") && group.key === "path_id" ? item.project
          : group.key === "path_id" && (pending.actionId.startsWith("worker.labor.contract.") || pending.actionId === "worker.update") ? item.worker : undefined);
        const scalarChoice = item.fill?.[group.key];
        if (scalarChoice) { const found = group.options.filter((option:any) => option.label===scalarChoice || option.value===scalarChoice); if(found.length===1){selection[group.key]=[found[0].value];continue;} }
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
    if(item.validationFollowup && reply.status==='completed') {
      current={...current,validationFollowupActive:true};
      reply=await turn({text:item.validationFollowup}); record(reply,{validationFollowup:item.validationFollowup});
    }
    row.finalStatus = reply.status;
    const finalTurn = state.turns.at(-1);
    row.actionId = state.session.pending?.actionId || finalTurn?.actionId || [...(finalTurn?.steps || [])].reverse().find(step => step.actionId)?.actionId;
    row.namespace = row.actionId ? operationById(row.actionId)?.module : null;
    row.pendingResolved = state.session.pending?.resolved;
    row.readCalls = report.business.slice(startBusiness);
    row.aiRequests = ledger.calls.slice(startCalls);
    const issues: string[] = [...extraChecks(item, row, reply, state.session.pending, today), ...moduleChecks(item,row,reply,state.session.pending)];
    if (item.kind !== "clarify" && !item.actions.includes(row.actionId)) issues.push("WRONG_OR_MISSING_ACTION");
    if (item.kind === "clarify" && reply.status !== "collecting") issues.push("DID_NOT_STOP_FOR_CLARIFICATION");
    if (item.kind === "write" && reply.status !== "confirmation") issues.push("NOT_AT_CONFIRMATION");
    if (item.kind === "read" && reply.status !== "completed") issues.push("READ_NOT_COMPLETED");
    for (const [key, value] of Object.entries(item.expected || {})) if (state.session.pending?.resolved?.[key] !== value) issues.push(`WRONG_VALUE:${key}`);
    const resolved = state.session.pending?.resolved;
    if (item.email && reply.status === "confirmation" && row.actionId === "student.create") {
      const validation = createStudentSchema.validate(resolved, { abortEarly: false });
      row.backendSchemaPreflight = { sentToApi: false, valid: !validation.error, errors: validation.error?.details.map(detail => ({ path: detail.path, type: detail.type, message: detail.message })) || [] };
      if (validation.error) issues.push("PREVIEW_ACCEPTS_API_INVALID_INPUT");
    }
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
    if (item.unsupportedFilter) {
      const expected = workers.filter(worker => !contracts.some(contract => contract.workerId === worker.id)).map(worker => worker.fullName).sort();
      const table = parseAssistantResultTable(reply.reply);
      const shown = JSON.stringify(table?.rows || []);
      const actual = workers.filter(worker => shown.includes(worker.fullName)).map(worker => worker.fullName).sort();
      const usedBothSources = row.readCalls.some((call: any) => call.path.endsWith('/worker-management/workers')) && row.readCalls.some((call: any) => call.path.endsWith('/worker-management/labor-contracts'));
      row.contractAbsenceCheck = { expected, actual, usedBothSources, safeClarification: reply.status === "collecting" };
      if (reply.status !== "completed") issues.push("CAPABILITY_GAP_NEEDS_SUPPORTED_FILTER");
      else if (JSON.stringify(actual) !== JSON.stringify(expected) || !usedBothSources) issues.push("CONTRACT_ABSENCE_FILTER_NOT_PROVEN");
    }
    if (item.export && !reply.files?.some((file: any) => file.format === "xlsx")) issues.push("NO_XLSX_OUTPUT");
    if (item.export && state.documents.length) {
      const file = state.documents.at(-1)?.files?.[0];
      if (file?.bytes?.subarray(0, 2).toString() !== "PK") issues.push("INVALID_XLSX_BYTES");
      else { const path = new URL(replayRun ? "./replay-export.xlsx" : dryRun ? "./dry-run-export.xlsx" : "./live-export.xlsx", outputDirectory); writeFileSync(path, file.bytes); row.exportFile = { fileName: file.fileName, size: file.bytes.length }; }
    }
    const visible = JSON.stringify({ reply: reply.reply, values: reply.action?.values });
    if ([...workers, ...projects, ...contracts, extraStudent, extraPolicy].some(record => visible.includes(record.id))) issues.push("INTERNAL_RECORD_ID_VISIBLE");
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
