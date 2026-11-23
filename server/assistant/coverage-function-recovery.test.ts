import { readFileSync } from "node:fs";
import { afterEach, expect, it, vi } from "vitest";
const provider = vi.hoisted(() => vi.fn());
vi.mock("../service/openrouter.service", () => ({ openrouterChat: provider }));
import { defaultWorkflow, operationById } from "./catalog";
import { interpretRequest } from "./semantic-interpreter";
import { findUncoveredRequestTerms, validateRequestCoverage } from "./request-coverage";
import { assistantFunctionContextCatalog } from "./function-context";
import { INTERPRETATION_LIMITS, interpretationPromptBytes } from "./interpretation-budget";

const workflow = (id: string) => defaultWorkflow(operationById(id)!);
it('normalizes harmless coverage path wrappers and still rejects unknown nested analysis fields', () => {
  const op=operationById('api.get.f7d7b097f3b2fca2')!;
  const check=(field:string)=>validateRequestCoverage('Đối tác đã đạt đủ KPI',[{evidence:'Đối tác',requirement:'Đối tác',mappedTo:['actionId']},{evidence:'đã đạt đủ KPI',requirement:'Lọc KPI',mappedTo:[`values.analysis.filters.${field}`]}],defaultWorkflow(op),op,{analysis:JSON.stringify({filters:[{field:'status',operator:'eq',value:'achieved'}]})});
  expect(check('status')).toEqual({ok:true});
  expect(check('password')).toMatchObject({ok:false});
});
it('distinguishes a declared report polar question from an unsupported negative filter', () => {
  const op=operationById('student.batch.attendance.summary')!;
  const check=(evidence:string)=>validateRequestCoverage(evidence,[{evidence,requirement:'Điểm danh',mappedTo:['action']}],defaultWorkflow(op),op,{});
  expect(check('đi đủ không')).toEqual({ok:true});
  expect(check('chưa có hợp đồng')).toMatchObject({ok:false});
  expect(check('đi đủ không tại Hà Nội')).toMatchObject({ok:false});
});
it('accepts a structured-field qualifier but still rejects an omitted date or location', () => {
  const op = operationById('api.patch.2971d5a8a97f8be8')!;
  const text='chỉnh sửa chính sách phần Số mốc tháng thành 2 tháng';
  const coverage=[{evidence:'chỉnh sửa chính sách',requirement:'Sửa chính sách',mappedTo:['action']},{evidence:'Số mốc tháng thành 2 tháng',requirement:'Số mốc tháng',mappedTo:['values.official']}];
  expect(validateRequestCoverage(text,coverage,defaultWorkflow(op),op,{official:{maxMonths:2}})).toEqual({ok:true});
  expect(validateRequestCoverage(text+' ở Hà Nội',coverage,defaultWorkflow(op),op,{official:{maxMonths:2}})).toMatchObject({ok:false});
});
const response = (output: unknown) => ({ text: JSON.stringify(output) });
const group = (key: string) => response({ featureKeys: [key], ambiguous: false, clarification: "" });
afterEach(() => provider.mockReset());

const captured = JSON.parse(readFileSync(new URL('./testing/catalog-routing/captured-coverage.json', import.meta.url), 'utf8'));
it.each(captured)("accepts the captured real-model coverage after shared validation fixes: $id", ({ text, output }: any) => {
  const op = operationById(output.actionId)!;
  const result = validateRequestCoverage(text, output.requestCoverage, defaultWorkflow(op), op, output.values);
  expect(result, JSON.stringify(result)).toEqual({ ok: true });
});

it.each(['employee.create', 'worker.create', 'student.create', 'category.create'])("accepts singular creation without a filter across modules: %s", id => {
  const op = operationById(id)!;
  const check = (text: string) => validateRequestCoverage(text, [{ evidence: text, requirement: 'Tạo hồ sơ', mappedTo: ['action'] }], defaultWorkflow(op), op, {});
  expect(check('Tạo 1 hồ sơ mới')).toEqual({ ok: true });
  expect(check('Tạo 2 hồ sơ mới')).toMatchObject({ ok: false });
  expect(check('Tạo 1 hồ sơ mới có số tiền trên 1 triệu')).toMatchObject({ ok: false });
});

it("preserves meaningful existence, negation and location while ignoring only covered name grammar", () => {
  expect(findUncoveredRequestTerms('Dự án có ai vắng', [{ evidence: 'Dự án' }, { evidence: 'ai vắng' }])).toEqual([]);
  expect(findUncoveredRequestTerms('Tạo dự án tên QA', [{ evidence: 'Tạo dự án' }, { evidence: 'QA' }])).toEqual([]);
  expect(findUncoveredRequestTerms('Mình chọn Tên lao động: QA', [{ evidence: 'Tên lao động: QA' }])).toEqual([]);
  expect(findUncoveredRequestTerms('lao động có hợp đồng', [{ evidence: 'lao động' }, { evidence: 'hợp đồng' }])).toContain('có');
  const op = operationById('worker.report')!;
  expect(findUncoveredRequestTerms('Xem "Quản lý lao động"', [{ evidence: 'Xem' }], defaultWorkflow(op)))
    .toEqual(expect.arrayContaining(['Quản', 'lý', 'lao', 'động']));
  for (const [text, evidence] of [['trong Hà Nội', 'Hà Nội'], ['các lao động hôm nay', 'các lao động']]) {
    expect(validateRequestCoverage(text, [{ evidence, requirement: 'Phạm vi', mappedTo: ['action'] }], defaultWorkflow(op), op, {})).toMatchObject({ ok: false });
  }
  for (const text of ['các lao động chưa có hợp đồng', 'các lao động hôm nay', 'các lao động ở Hà Nội', 'các lao động tại quận 1']) {
    expect(validateRequestCoverage(text, [{ evidence: text, requirement: 'Điều kiện', mappedTo: ['context.module', 'values.projectId'] }], defaultWorkflow(op), op, { projectId: 'QA' })).toMatchObject({ ok: false });
  }
});

it("exposes editable inputs and report options in compact function metadata", () => {
  const catalog = assistantFunctionContextCatalog(['worker.update', 'worker.report'].map(workflow));
  expect(JSON.stringify(catalog)).toContain('laborType');
  expect(JSON.stringify(catalog)).toContain('late');
  expect(JSON.stringify(catalog)).not.toContain('"structure"');
});

it("normalizes a single read source only for the selected action and declared public outputs", () => {
  const op = operationById('worker.labor.contract.list')!;
  const check = (text: string, target: string) => validateRequestCoverage(text, [{ evidence: text, requirement: 'Nguồn đọc', mappedTo: ['action', target] }], defaultWorkflow(op), op, {});
  expect(check('Xuất danh sách hợp đồng', `query:${op.id}:source`)).toEqual({ ok: true });
  expect(check('Xuất danh sách hợp đồng', `query:${op.id}:result.workerName`)).toEqual({ ok: true });
  for (const target of [`query:${op.id}:result.id`, `query:${op.id}:result.password`, 'query:employee.list:source']) {
    expect(check('Xuất danh sách hợp đồng', target)).toMatchObject({ ok: false });
  }
  expect(check('Lao động chưa có hợp đồng', `query:${op.id}:source`)).toMatchObject({ ok: false });
});

it("recovers an unknown filter through another authorized function without widening modules", async () => {
  const text = 'Dự án QA-P01 ai đi muộn';
  provider.mockResolvedValueOnce(group('worker:attendance'))
    .mockResolvedValueOnce(response({ actionId: 'worker.attendance.list', intentType: 'workflow', values: { query_projectId: 'QA-P01' }, requestCoverage: [{ evidence: text, requirement: 'Đi muộn', mappedTo: ['values.status'] }] }))
    .mockResolvedValueOnce(group('worker:reports'))
    .mockResolvedValueOnce(response({ actionId: 'worker.report', intentType: 'workflow', values: { mode: 'late', projectId: 'QA-P01' }, requestCoverage: [{ evidence: text, requirement: 'Đi muộn trong dự án', mappedTo: ['action', 'values.mode', 'values.projectId'] }] }));
  expect(await interpretRequest(text, ['worker.attendance.list', 'worker.report'].map(workflow), null, [])).toMatchObject({ actionId: 'worker.report', values: { mode: 'late' } });
  expect(provider).toHaveBeenCalledTimes(4);
  expect(provider.mock.calls[3][0].responseSchema.properties.actionId.enum).toEqual(['worker.report', null]);
  expect(provider.mock.calls.reduce((sum, [input]) => sum + interpretationPromptBytes(input), 0)).toBeLessThanOrEqual(INTERPRETATION_LIMITS.totalPromptBytes);
});

it("recovers unsupported once and refuses foreign group keys", async () => {
  const workflows = ['employee.update', 'payroll.policy.update'].map(workflow);
  const unsupported = response({ actionId: null, values: {}, intentType: 'unsupported', requestCoverage: [] });
  provider.mockResolvedValueOnce(group('hr:payroll')).mockResolvedValueOnce(unsupported)
    .mockResolvedValueOnce(group('hr:employee')).mockResolvedValueOnce(unsupported);
  expect(await interpretRequest('Cập nhật hồ sơ', workflows, null, [])).toMatchObject({ actionId: null, intentType: 'unsupported' });
  expect(provider).toHaveBeenCalledTimes(4);
  provider.mockReset();
  provider.mockResolvedValueOnce(group('hr:payroll')).mockResolvedValueOnce(unsupported).mockResolvedValueOnce(group('worker:workers'));
  expect(await interpretRequest('Cập nhật hồ sơ', workflows, null, [])).toMatchObject({ actionId: null, intentType: 'unsupported' });
  expect(provider).toHaveBeenCalledTimes(3);
});

it.each(['employee.list', 'employee.update'])("allows Excel export intent only on a read action: %s", async id => {
  const text = 'Xuất Excel danh sách nhân sự';
  provider.mockResolvedValueOnce(response({ actionId: id, actionIntent: 'export', intentType: 'workflow', values: {},
    requestCoverage: [{ evidence: text, requirement: 'Xuất danh sách', mappedTo: ['action'] }] }));
  const result = await interpretRequest(text, [workflow(id)], null, []);
  expect(result.actionId).toBe(id === 'employee.list' ? id : null);
  expect(provider).toHaveBeenCalledTimes(1);
});
