import { afterAll, afterEach, expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";
const provider = vi.hoisted(() => vi.fn());
vi.mock("../service/openrouter.service", () => ({ openrouterChat: provider }));
import { ASSISTANT_OPERATIONS, defaultWorkflow, operationById } from "./catalog";
import { interpretRequest } from "./semantic-interpreter";
import { assistantFunctionKey } from "./function-context";
import { INTERPRETATION_LIMITS, interpretationPromptBytes, newInterpretationBudget, requestAssistantInterpretation } from "./interpretation-budget";
import { validateRequestCoverage } from "./request-coverage";
import { matchesModuleContextEvidence } from "./module-context";
import { AssistantInterpretationError } from './interpretation-error';
import { PlanCancelledError } from './execution-budget';

const all = ASSISTANT_OPERATIONS.filter(operation => !operation.unavailableReason).map(defaultWorkflow);
const reportOperation = operationById("worker.report")!;
const report = defaultWorkflow(reportOperation);
const text = "Báo cáo tình hình chấm công các lao động hôm nay";
const values = { mode: "all", date: "2026-11-23" };
const coverage = [
  { evidence: "Báo cáo tình hình chấm công", requirement: "Tổng quan chấm công", mappedTo: ["action", "values.mode"] },
  { evidence: "các lao động", requirement: "Phân hệ lao động", mappedTo: ["context.module"] },
  { evidence: "hôm nay", requirement: "Ngày báo cáo", mappedTo: ["values.date"] },
];
const response = (extra: Record<string, unknown> = {}) => ({ text: JSON.stringify({ intentType: "workflow", actionId: report.actionId, actionIntent: "report", values, requestCoverage: coverage, ...extra }) });
const measurements: unknown[] = [];
it('preserves authorized module choices when coverage requires namespace clarification', async () => {
  const policy=defaultWorkflow(operationById('api.post.e57ae0da3cdf14f8')!);
  const student=defaultWorkflow(operationById('partner.analysis')!);
  provider.mockResolvedValueOnce({text:JSON.stringify({modules:['labor-partner','student-partner']})});
  provider.mockResolvedValueOnce({text:JSON.stringify({featureKeys:[assistantFunctionKey(policy)],ambiguous:false,clarification:''})})
    .mockResolvedValueOnce({text:JSON.stringify({actionId:policy.actionId,intentType:'workflow',actionIntent:'create',values:{},requestCoverage:[{evidence:'Thêm 1 chính sách hoa hồng mới',requirement:'Tạo chính sách',mappedTo:['action','context.module']}]})});
  expect(await interpretRequest('Thêm 1 chính sách hoa hồng mới',[policy,student],null,[])).toMatchObject({actionId:null,intentType:'ambiguous',clarificationModules:expect.arrayContaining(['labor-partner','student-partner'])});
  expect(provider).toHaveBeenCalledTimes(3);
});
it('keeps mutation schemas out of an explicit report request', async () => {
  const training=defaultWorkflow(operationById('hr.training.progress')!);
  provider.mockResolvedValueOnce({text:JSON.stringify({actionId:training.actionId,values:{courseName:'QA'},intentType:'workflow',actionIntent:'report',requestCoverage:[{evidence:'Báo cáo tiến độ QA',requirement:'Tiến độ khóa học',mappedTo:['action','values.courseName']}]})});
  const result=await interpretRequest('Báo cáo tiến độ QA',[training,defaultWorkflow(operationById('task.activity.update')!)],null,[]);
  expect(result,JSON.stringify(result)).toMatchObject({actionId:training.actionId});
  expect(provider.mock.calls[0][0].responseSchema.properties.actionId.enum).not.toContain('task.activity.update');
});
afterEach(() => provider.mockReset());
afterAll(() => { if (process.env.ASSISTANT_ROUTING_BUDGET_OUTPUT) writeFileSync(process.env.ASSISTANT_ROUTING_BUDGET_OUTPUT, JSON.stringify(measurements, null, 2)); });

it('accepts a declared two-source anti-join through the production interpreter', async () => {
  const request = 'Danh sách lao động chưa có hợp đồng';
  const sources = ['worker.list', 'worker.labor.contract.list'].map(id => defaultWorkflow(operationById(id)!));
  const queryPlan = [
    { actionId: sources[0].actionId, purpose: 'Lao động', values: {}, resultFields: ['fullName'], relation: 'workers-without-contracts' },
    { actionId: sources[1].actionId, purpose: 'Hợp đồng', values: {}, resultFields: ['workerName'] },
  ];
  provider.mockResolvedValueOnce({ text: JSON.stringify({ featureKeys: sources.map(workflow => assistantFunctionKey(workflow)), ambiguous: false, clarification: '' }) });
  provider.mockResolvedValueOnce({ text: JSON.stringify({ intentType: 'workflow', actionId: null, actionIntent: 'report', values: {}, queryPlan,
    requestCoverage: [{ evidence: request, requirement: 'Đối chiếu thiếu hợp đồng', mappedTo: ['query:worker.list:relation'] }] }) });
  expect(await interpretRequest(request, sources, null, [])).toMatchObject({ actionId: null, queryPlan, requestCoverage: [{ mappedTo: ['query:worker.list:relation'] }] });
  expect(provider).toHaveBeenCalledTimes(2);
  expect(provider.mock.calls[1][0].responseSchema.properties.queryPlan.items.properties.relation.enum).toEqual(['workers-without-contracts']);
  expect(JSON.stringify(provider.mock.calls[1][0])).not.toContain('foreignKey');
});

it("replays the observed worker module evidence against the full ERP catalog without expanding it", async () => {
  provider.mockResolvedValueOnce({ text: JSON.stringify({ modules: ["worker"] }) })
    .mockResolvedValueOnce({ text: JSON.stringify({ featureKeys: ["worker:reports"], ambiguous: false, clarification: "" }) })
    .mockResolvedValueOnce(response());
  expect(await interpretRequest(text, all, null, [])).toMatchObject({ actionId: "worker.report", values });
  expect(provider).toHaveBeenCalledTimes(3);
  const sizes = provider.mock.calls.map(([input]) => interpretationPromptBytes(input));
  expect(Math.max(...sizes)).toBeLessThanOrEqual(INTERPRETATION_LIMITS.promptBytes);
  expect(sizes.reduce((sum, bytes) => sum + bytes, 0)).toBeLessThanOrEqual(INTERPRETATION_LIMITS.totalPromptBytes);
  expect(provider.mock.calls[2][0].responseSchema.properties.actionId.enum).not.toContain('quotation.budget.create');
  const context = JSON.parse(provider.mock.calls[2][0].messages[0].content.match(/DANH MỤC PHÂN HỆ: ([^\n]+)/)[1]);
  expect(context.map((module: any) => module.key)).toEqual(['worker']);
  expect(context[0]).not.toHaveProperty('resources');
  expect(interpretationPromptBytes(provider.mock.calls[0][0])).toBeLessThan(32000);
  measurements.push({ case: "observed-worker-report", authorizedActions: all.length, calls: sizes.length, promptBytes: sizes });
});

it("repairs omitted evidence once on the selected action, without duplicating instructions", async () => {
  provider.mockResolvedValueOnce({ text: JSON.stringify({ modules: ["worker"] }) })
    .mockResolvedValueOnce({ text: JSON.stringify({ featureKeys: ["worker:reports"], ambiguous: false, clarification: "" }) })
    .mockResolvedValueOnce(response({ requestCoverage: coverage.slice(0, 2) }))
    .mockResolvedValueOnce(response());
  expect(await interpretRequest(text, all, null, [])).toMatchObject({ actionId: report.actionId });
  expect(provider).toHaveBeenCalledTimes(4);
  const repair = provider.mock.calls[3][0];
  expect(repair.responseSchema.properties.actionId.enum).toEqual([report.actionId, null]);
  expect(repair.messages[0].content.split("Bằng chứng trong requestCoverage phải cộng lại")).toHaveLength(2);
  expect(interpretationPromptBytes(repair)).toBeLessThan(INTERPRETATION_LIMITS.promptBytes);
  measurements.push({ case: "bounded-coverage-repair", calls: 4, repairBytes: interpretationPromptBytes(repair) });
});

it("stops a failed coverage repair without returning partial values or broadening the catalog", async () => {
  provider.mockResolvedValue(response({ requestCoverage: coverage.slice(0, 2) }));
  const result = await interpretRequest(text, [report], null, []);
  expect(result).toMatchObject({ actionId: null, values: {}, intentType: "ambiguous" });
  expect(provider).toHaveBeenCalledTimes(2);
});

it("reports failed discovery as an AI connection failure without sending a thousand schemas", async () => {
  provider.mockRejectedValueOnce(new Error("fixture discovery failure"));
  await expect(interpretRequest("Xử lý dữ liệu giúp tôi", all, null, [])).rejects.toBeInstanceOf(AssistantInterpretationError);
  expect(provider).toHaveBeenCalledTimes(1);
});

it.each([400, 401, 402, 403, 429, 503])('does not turn provider HTTP %s into module ambiguity or catalog overflow', async status => {
  provider.mockRejectedValueOnce(Object.assign(new Error('private provider response sk-secret'), { status }));
  const failure = await interpretRequest('Báo cáo tình hình nhân sự hôm nay.', all, null, []).catch(error => error);
  expect(failure).toBeInstanceOf(AssistantInterpretationError);
  expect(failure.providerStatus).toBe(status);
  expect(failure.message).not.toMatch(/sk-secret|phạm vi.*rộng|cho biết phân hệ/i);
  expect(provider).toHaveBeenCalledTimes(1);
});

it('does not widen a selected function when its provider request fails', async () => {
  provider.mockRejectedValueOnce(new TypeError('fetch failed'));
  await expect(interpretRequest('Trong phân hệ Nhân sự, hôm nay có ai nghỉ phép không?', all.filter(w => w.module === 'hr'), null, []))
    .rejects.toBeInstanceOf(AssistantInterpretationError);
  expect(provider).toHaveBeenCalledTimes(1);
});

it('preserves user cancellation during discovery without a fallback call', async () => {
  const cancellation = new PlanCancelledError('Đã hủy');
  provider.mockRejectedValueOnce(cancellation);
  await expect(interpretRequest('Xử lý dữ liệu', all, null, [])).rejects.toBe(cancellation);
  expect(provider).toHaveBeenCalledTimes(1);
});

it('reports a provider timeout without asking for another module or calling again', async () => {
  provider.mockRejectedValueOnce(Object.assign(new Error('private timeout detail'), { name: 'TimeoutError' }));
  const failure = await interpretRequest('Xử lý dữ liệu', all, null, []).catch(error => error);
  expect(failure).toBeInstanceOf(AssistantInterpretationError);
  expect(failure.timedOut).toBe(true);
  expect(failure.status).toBe(504);
  expect(failure.message).toContain('phản hồi quá lâu');
  expect(provider).toHaveBeenCalledTimes(1);
});

it("honors explicit ambiguity without a catalog-wide retry", async () => {
  provider.mockResolvedValueOnce({ text: JSON.stringify({ modules: ["worker"] }) })
    .mockResolvedValueOnce({ text: JSON.stringify({ featureKeys: ["worker:reports"], ambiguous: false, clarification: "" }) })
    .mockResolvedValueOnce(response({ intentType: "ambiguous", actionId: null, values: {}, requestCoverage: [], clarification: "Bạn muốn ngày nào?" }));
  expect(await interpretRequest(text, all, null, [])).toMatchObject({ actionId: null, intentType: "ambiguous" });
  expect(provider).toHaveBeenCalledTimes(3);
});

it("shortlists compact descriptors of a large routed function before loading its schemas", async () => {
  const payroll = all.filter(workflow => assistantFunctionKey(workflow) === "hr:payroll");
  const target = payroll.at(-1)!;
  expect(payroll.length).toBeGreaterThan(INTERPRETATION_LIMITS.workflows);
  provider.mockResolvedValueOnce({ text: JSON.stringify({ modules: ["hr"] }) })
    .mockResolvedValueOnce({ text: JSON.stringify({ featureKeys: ["hr:payroll"], ambiguous: false, clarification: "" }) })
    .mockResolvedValueOnce({ text: JSON.stringify({ actionIds: [target.actionId] }) })
    .mockResolvedValueOnce({ text: JSON.stringify({ intentType: "workflow", actionId: target.actionId, values: {}, requestCoverage: [{ evidence: "Xử lý lương", requirement: "Thao tác lương", mappedTo: ["action"] }] }) });
  expect(await interpretRequest("Xử lý lương", all, null, [])).toMatchObject({ actionId: target.actionId });
  expect(provider).toHaveBeenCalledTimes(4);
  expect(JSON.stringify(provider.mock.calls[2][0])).not.toContain('"inputs"');
  expect(provider.mock.calls[3][0].responseSchema.properties.actionId.enum).toEqual([target.actionId, null]);
});

it("does not accept foreign action IDs from compact selection", async () => {
  const payroll = all.filter(workflow => assistantFunctionKey(workflow) === "hr:payroll");
  provider.mockResolvedValueOnce({ text: JSON.stringify({ actionIds: ["worker.create"] }) });
  await expect(interpretRequest("Xử lý lương", payroll, null, [], "", [], "", [], true)).rejects.toThrow("cấp quyền");
  expect(provider).toHaveBeenCalledTimes(1);
});

it("rejects an oversized prompt and exhausted call budget before invoking the provider", async () => {
  const input = { model: "fixture", messages: [{ role: "user" as const, content: "x".repeat(INTERPRETATION_LIMITS.promptBytes) }] };
  await expect(requestAssistantInterpretation(newInterpretationBudget(), input)).rejects.toThrow();
  await expect(requestAssistantInterpretation({ calls: INTERPRETATION_LIMITS.calls, promptBytes: 0 }, { ...input, messages: [] })).rejects.toThrow();
  await expect(requestAssistantInterpretation({ calls: 0, promptBytes: INTERPRETATION_LIMITS.totalPromptBytes }, { ...input, messages: [] })).rejects.toThrow();
  expect(provider).not.toHaveBeenCalled();
});

it("caps provider attempts and response size for every admitted call", async () => {
  provider.mockResolvedValueOnce({ text: "{}" });
  await requestAssistantInterpretation(newInterpretationBudget(), {
    model: "fixture", messages: [], maxRetries: 10, maxTokens: 100_000,
  });
  expect(provider).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ maxRetries: 1, maxTokens: 4096 }));
});

it("does not send schemas when even an expanded or single-module catalog exceeds the candidate limit", async () => {
  expect(await interpretRequest("Xử lý giúp tôi", all, null, [], "", [], "", [], true)).toMatchObject({ actionId: null, values: {}, intentType: "ambiguous" });
  const oversizedArea = Array.from({ length: INTERPRETATION_LIMITS.candidateWorkflows + 1 }, (_, index) => ({ ...report, actionId: `fixture.${index}` }));
  expect(await interpretRequest("Xử lý giúp tôi", oversizedArea, null, [])).toMatchObject({ actionId: null, values: {}, intentType: "ambiguous" });
  expect(provider).not.toHaveBeenCalled();
});

it("rejects oversized conversation context before the first provider request", async () => {
  expect(await interpretRequest(text, [report], null, [{ role: "user", content: "x".repeat(INTERPRETATION_LIMITS.promptBytes) }]))
    .toMatchObject({ actionId: null, values: {}, intentType: "ambiguous" });
  expect(provider).not.toHaveBeenCalled();
});

it.each(["các lao động chưa có hợp đồng", "các lao động ở Hà Nội", "các lao động hôm nay"])("never treats a condition as module-only evidence: %s", evidence => {
  expect(matchesModuleContextEvidence(evidence, "worker", text)).toBe(false);
  expect(validateRequestCoverage(evidence, [{ evidence, requirement: "Điều kiện phải giữ", mappedTo: ["context.module"] }], report, reportOperation, {})).toMatchObject({ ok: false });
});

it("does not accept worker context in an explicitly different module", () => {
  expect(validateRequestCoverage("Trong quản lý học viên, tìm các lao động", [{ evidence: "các lao động", requirement: "Phạm vi", mappedTo: ["context.module"] }], report, reportOperation, {})).toMatchObject({ ok: false });
});
