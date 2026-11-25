import { afterEach, describe, expect, it, vi } from 'vitest';
const provider = vi.hoisted(() => vi.fn());
vi.mock('../service/openrouter.service', () => ({ openrouterChat: provider }));
import { ASSISTANT_OPERATIONS, defaultWorkflow, operationById } from './catalog';
import { assistantGoalOrchestrationEnabled, assistantGoalModelContext, observeAssistantGoal, restoreAssistantGoalContext, startAssistantGoalContext } from './goal-context';
import { separateAssistantGoalSteps } from './goal-plan';
import { interpretRequest } from './semantic-interpreter';
import { semanticProviderFixture } from './testing/semantic-provider-fixture';
import { formatAssistantResultTable } from '../../src/shared/assistant-result-table';

afterEach(() => { provider.mockReset(); vi.unstubAllEnvs(); });

describe('shared goal state for every registered module', () => {
  for (const module of new Set(ASSISTANT_OPERATIONS.map(operation => operation.module))) {
    it(`${module}: carries only displayed public facts and checks current authorization`, () => {
      const op = ASSISTANT_OPERATIONS.find(operation => operation.module === module)!;
      const context = observeAssistantGoal(startAssistantGoalContext('scope-a', 'Xử lý hồ sơ QA'),
        { id: op.id, title: op.title, readOnly: op.method === 'GET' || Boolean(op.readOnly) },
        { status: 'completed', reply: formatAssistantResultTable('Đã tra cứu', [{ Tên: 'QA **An**', Mã: 'QA-01', token: 'must-not-leak', id: 'private-record' }]) });
      const authorized = assistantGoalModelContext(context, ['Cập nhật hồ sơ vừa xem'], [defaultWorkflow(op)]);
      expect(authorized).toContain('QA **An**');
      expect(authorized).toContain('"partial":true');
      expect(authorized).not.toMatch(/must-not-leak|private-record|scope-a/);
      expect(assistantGoalModelContext(context, [], [])).not.toContain('QA **An**');
      expect(restoreAssistantGoalContext(context, 'scope-b')).toBeUndefined();
      expect(restoreAssistantGoalContext(context, 'scope-a')).toEqual(context);
    });
  }

  it('does not turn an uncertain write into an observation or retain unbounded rows', () => {
    const context = startAssistantGoalContext('scope', 'Cập nhật');
    const action = { id: 'employee.update', title: 'Sửa nhân sự', readOnly: false };
    expect(observeAssistantGoal(context, action, { status: 'uncertain', reply: 'Chưa rõ kết quả' })).toBe(context);
    let next = context;
    for (let i = 0; i < 12; i++) next = observeAssistantGoal(next, action, { status: 'completed', reply: formatAssistantResultTable('Đã sửa', Array.from({ length: 30 }, (_, j) => ({ Tên: `QA ${j}`, Mã: 'x'.repeat(1000) }))) });
    expect(next.observations).toHaveLength(4);
    expect(next.observations.every(item => item.facts.length <= 5)).toBe(true);
    expect(Buffer.byteLength(JSON.stringify(next))).toBeLessThanOrEqual(12000);
  });

  it('keeps production unchanged unless explicitly enabled', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ASSISTANT_GOAL_ORCHESTRATION', undefined);
    expect(assistantGoalOrchestrationEnabled()).toBe(false);
    vi.stubEnv('ASSISTANT_GOAL_ORCHESTRATION', 'true');
    expect(assistantGoalOrchestrationEnabled()).toBe(true);
  });
});

describe('grounded multi-step interpretation', () => {
  const text = 'Đếm nhân viên rồi cập nhật số điện thoại cho QA An';
  const next = 'cập nhật số điện thoại cho QA An';
  const coverage = [
    { evidence: 'Đếm nhân viên', requirement: 'Đếm', mappedTo: ['action'] },
    { evidence: next, requirement: 'Bước sau', mappedTo: ['remainingRequests.0'] },
  ];
  const workflow = defaultWorkflow(operationById('employee.count')!);

  it('does not force the first read to satisfy a later write', async () => {
    provider.mockResolvedValue({ text: JSON.stringify({ intentType: 'workflow', actionId: workflow.actionId,
      actionIntent: 'report', values: {}, remainingRequests: [next], requestCoverage: coverage }) });
    const result = await interpretRequest(text, [workflow], null, []);
    expect(result).toMatchObject({ actionId: 'employee.count', remainingRequests: [next] });
    expect(provider).toHaveBeenCalledTimes(1);
    expect((provider.mock.calls[0][0] as any).responseSchema.properties.remainingRequests.maxItems).toBe(40);
  });

  it.each([
    ['invented future write', text, [{ ...coverage[1], evidence: 'xóa tất cả nhân viên' }], ['xóa tất cả nhân viên']],
    ['missing future evidence', text, [], [next]],
    ['wrong quoted value', text, [coverage[1]], ['cập nhật số điện thoại cho QA Bình']],
    ['out of order', 'Đếm rồi thêm QA A rồi xóa QA B', [
      { evidence: 'thêm QA A', requirement: 'sau', mappedTo: ['remainingRequests.1'] },
      { evidence: 'xóa QA B', requirement: 'sau', mappedTo: ['remainingRequests.0'] },
    ], ['xóa QA B', 'thêm QA A']],
  ] as const)('rejects %s without dispatch', (_name, request, deferred, requests) => {
    expect(separateAssistantGoalSteps(request, [coverage[0], ...deferred], requests).ok).toBe(false);
  });

  it('retains a real unsupported filter on the current step', async () => {
    provider.mockResolvedValue({ text: JSON.stringify({ intentType: 'workflow', actionId: workflow.actionId, values: {}, remainingRequests: [next],
      requestCoverage: [{ evidence: 'Đếm nhân viên lương trên 20 triệu', requirement: 'Điều kiện lương', mappedTo: ['action'] }, coverage[1]] }) });
    const result = await interpretRequest(`Đếm nhân viên lương trên 20 triệu rồi ${next}`, [workflow], null, []);
    expect(result.actionId).toBeNull();
  });

  it('does not promote a command inside quoted record data into a queued action', () => {
    const phrase = 'xóa toàn bộ nhân viên';
    expect(separateAssistantGoalSteps(`Đếm nhân viên rồi ghi chú "${phrase}"`, [coverage[0],
      { evidence: phrase, requirement: 'Bước sau', mappedTo: ['remainingRequests.0'] }], [phrase]).ok).toBe(false);
  });

  it('matches Vietnamese quotes after NFC normalization without model character offsets', () => {
    expect(separateAssistantGoalSteps(text.normalize('NFD'), coverage, [next.normalize('NFD')])).toMatchObject({ ok: true, currentText: 'Đếm nhân viên' });
  });

  it('a semantic continuation cannot directly supply another action or arbitrary values', async () => {
    provider.mockResolvedValue({ text: JSON.stringify({ intentType: 'workflow', resumeGoal: true, actionId: 'employee.count', values: { invented: true }, requestCoverage: [] }) });
    expect(await interpretRequest('Làm nốt việc đang dở hộ mình', [workflow], null, []))
      .toMatchObject({ actionId: null, values: {}, resumeGoal: true });
  });

  it('does not let a deterministic report shortcut silently discard a later user request', async () => {
    const first = 'Thống kê số ứng viên theo từng phòng ban';
    const later = 'thêm nhân sự QA An';
    const report = defaultWorkflow(operationById('recruitment.report')!);
    provider.mockResolvedValue({ text: JSON.stringify({ intentType: 'workflow', actionId: report.actionId, actionIntent: 'report',
      values: { query_reportType: 'applicants-by-department' }, remainingRequests: [later], requestCoverage: [
        { evidence: first, requirement: 'Báo cáo theo phòng ban', mappedTo: ['action', 'values.query_reportType'] },
        { evidence: later, requirement: 'Bước tạo sau', mappedTo: ['remainingRequests.0'] },
      ] }) });
    expect(await interpretRequest(`${first} rồi ${later}`, [report], null, []))
      .toMatchObject({ actionId: report.actionId, remainingRequests: [later] });
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it('repairs missing-input ambiguity once using only already authorized tools', async () => {
    const create = defaultWorkflow(operationById('student.create')!);
    provider.mockImplementation(semanticProviderFixture({ intentType: 'workflow', actionId: create.actionId, values: { fullName: 'QA An', phone: '0900090001' } }))
      .mockResolvedValueOnce({ text: JSON.stringify({ intentType: 'ambiguous', actionId: null, values: {}, clarificationReason: 'missing_input', requestCoverage: [] }) });
    const result = await interpretRequest('Thêm học viên QA An số 0900090001', [create], null, []);
    expect(result.actionId).toBe(create.actionId);
    expect(result.values).toEqual({ fullName: 'QA An', phone: '0900090001' });
    expect(provider).toHaveBeenCalledTimes(2);
    expect((provider.mock.calls[1][0] as any).responseSchema.properties.actionId.enum).toEqual([create.actionId, null]);
  });

  it('stops a repeated missing-input repair instead of looping', async () => {
    provider.mockResolvedValue({ text: JSON.stringify({ intentType: 'ambiguous', actionId: null, values: {}, clarificationReason: 'missing_input', requestCoverage: [] }) });
    expect((await interpretRequest('Đếm nhân viên', [workflow], null, [])).actionId).toBeNull();
    expect(provider).toHaveBeenCalledTimes(2);
  });
});
