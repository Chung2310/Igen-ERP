import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import './safety.setup.mjs';

const state = vi.hoisted(() => ({
  session: null, turns: [], interpretation: [], calls: [], budgets: [],
  journalWrites: [], violations: [], products: [], evidence: [],
  scenario: '', currentTurn: '', replies: [], suppressSearch: false,
  expectedViolations: [], expectedSafetyViolations: [],
  sessionWriteCount: 0,
  rejectAction: null, interpretationCount: 0, denyOperation: false, requireConfirmation: false,
  workflowVersion: 1, detailTamper: null, exactVerify: false,
  observer: false, observations: [], turnDurations: [],
}));
const clone = value => structuredClone(value);

vi.mock('../../../service/openrouter.service.ts', () => ({
  openrouterChat: async () => {
    state.violations.push('provider');
    throw new Error('Provider forbidden in deterministic layer B');
  },
}));
vi.mock('../../semantic-interpreter.ts', () => ({
  interpretRequest: async () => {
    state.interpretationCount += 1;
    const next = state.interpretation.shift();
    if (!next) throw new Error('Missing deterministic interpretation');
    return structuredClone(next);
  },
}));
vi.mock('../../execution-budget.ts', async importOriginal => {
  const actual = await importOriginal();
  return {
    ...actual,
    ExecutionBudget: class extends actual.ExecutionBudget {
      constructor(...args) {
        super(...args);
        const trace = { requestId: state.currentTurn, calls: [], instance: this };
        state.budgets.push(trace);
        this.trace = trace;
      }
      beforeCall(actionId, values, readOnly) {
        const result = super.beforeCall(actionId, values, readOnly);
        this.trace.calls.push({ actionId, values: structuredClone(values), readOnly });
        return result;
      }
    },
  };
});
vi.mock('../../models.ts', () => {
  const copy = value => structuredClone(value);
  const apply = (record, update) => {
    for (const [key, value] of Object.entries(update.$set || {})) {
      const parts = key.split('.');
      let target = record;
      for (const part of parts.slice(0, -1)) target = target[part] ??= {};
      target[parts.at(-1)] = copy(value);
    }
    for (const [key, value] of Object.entries(update.$inc || {})) record[key] = (record[key] || 0) + value;
  };
  const get = (record, key) => key.split('.').reduce((value, part) => value?.[part], record);
  const matches = (record, filter) => Object.entries(filter).every(([key, expected]) => {
    const value = get(record, key);
    if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
      return (expected.$ne === undefined || value !== expected.$ne)
        && (expected.$exists === undefined || (value !== undefined) === expected.$exists)
        && (expected.$in === undefined || expected.$in.includes(value));
    }
    return value === expected;
  });
  const chain = getter => ({ sort: () => chain(getter), select: () => chain(getter), lean: async () => copy(getter()) });
  const deny = name => new Proxy({}, { get: () => () => { state.violations.push(name); throw new Error(`Unexpected model ${name}`); } });
  return {
    ensureAssistantIndexes: async () => {},
    AssistantSessionModel: {
      updateOne: async (filter, update) => {
        state.sessionWriteCount += 1;
        state.session ??= { ...filter, messages: [], pending: null, busy: false, messageCount: 0, sessionMemoryVersion: 0 };
        apply(state.session, { $set: update.$setOnInsert || {} });
        apply(state.session, update);
        return { matchedCount: 1 };
      },
      findOneAndUpdate: async (filter, update) => {
        state.sessionWriteCount += 1;
        if (!state.session || !matches(state.session, filter)) return null;
        apply(state.session, update);
        return copy(state.session);
      },
      findOne: filter => chain(() => state.session && matches(state.session, filter) ? state.session : null),
    },
    AssistantTurnModel: {
      create: async input => {
        if (state.turns.some(turn => turn.requestId === input.requestId)) throw Object.assign(new Error('Duplicate'), { code: 11000 });
        const record = { ...input, _id: `turn-${state.turns.length + 1}`, createdAt: new Date(), updatedAt: new Date(), status: 'processing', steps: [] };
        state.turns.push(record);
        return copy(record);
      },
      updateOne: async (filter, update) => {
        const record = state.turns.find(turn => matches(turn, filter));
        if (!record) throw new Error('Unknown turn update');
        state.journalWrites.push({ requestId: record.requestId, update: copy(update) });
        apply(record, update);
        return { matchedCount: 1 };
      },
      findOne: filter => chain(() => [...state.turns].reverse().find(turn => matches(turn, filter)) || null),
    },
    AssistantDocumentModel: deny('AssistantDocumentModel'),
    AssistantMemoryModel: deny('AssistantMemoryModel'),
    AssistantSettingsModel: deny('AssistantSettingsModel'),
    AssistantWorkflowModel: deny('AssistantWorkflowModel'),
    AssistantProjectModel: deny('AssistantProjectModel'),
    AssistantProjectFileModel: deny('AssistantProjectFileModel'),
  };
});
vi.mock('../../workflows.ts', async () => {
  const { operationById, defaultWorkflow } = await import('../../catalog.ts');
  const permitted = new Set(['product.list', 'inventory.product.detail']);
  const assertOperation = async (_req, id) => {
    if (state.denyOperation) throw new Error('Fixture permission revoked');
    if (!permitted.has(id)) {
      state.violations.push(`out-of-slice action: ${id}`);
      throw new Error(`Out of slice ${id}`);
    }
    return operationById(id);
  };
  return {
    actorScope: req => ({ userId: req.user.id, companyCode: req.user.companyCode }),
    assertOperation,
    currentWorkflow: async (req, id) => ({ ...defaultWorkflow(await assertOperation(req, id)), version: state.workflowVersion, requireConfirmation: state.requireConfirmation }),
    listWorkflows: async () => [...permitted].map(id => defaultWorkflow(operationById(id))),
  };
});
vi.mock('../../settings.ts', async () => {
  const { defaultAssistantSettings } = await import('../../../../src/shared/assistant-workflow.ts');
  return { getSettings: async () => ({ ...defaultAssistantSettings, memoryEnabled: false, autoMemoryEnabled: false, responseRules: '' }) };
});
vi.mock('../../reply-rules.ts', () => ({ applyAssistantResponseRules: async reply => reply }));
vi.mock('../../documents.ts', () => ({ answerAssistantConversation: async () => { state.violations.push('QA'); throw new Error('QA forbidden'); } }));
vi.mock('../../projects.ts', () => ({ projectInstructionsForConversation: async () => { state.violations.push('project'); throw new Error('Project context forbidden'); } }));
vi.mock('../../session-memory.ts', () => ({ SESSION_MEMORY_LIMIT: 2400, summarizeAssistantSession: async () => null }));

import { processTurn } from '../../service.ts';
import { lookupRecords, resolveReferences } from '../../executor.ts';
import { operationById } from '../../catalog.ts';
import { observeAssistantTurn } from '../../call-observer.ts';
import { parseAssistantResultTable } from '../../../../src/shared/assistant-result-table.ts';

const ids = {
  P1: '65aa00000000000000000001', P2: '65aa00000000000000000002',
  P3: '65aa00000000000000000003', P4: '65aa00000000000000000004',
  P5: '65aa00000000000000000005',
};
const req = {
  user: { id: '65bb00000000000000000001', companyCode: 'FIX-A', branchId: '65bb00000000000000000002', role: 'user' },
  headers: { authorization: 'Bearer fixture-not-a-real-token' },
  socket: { localPort: 4321, localAddress: '127.0.0.1' },
};
const product = (key, name, productCode, companyCode = 'FIX-A') => ({
  _id: ids[key], companyCode, name, productCode, normalizedName: name.toLowerCase(),
  categoryCode: 'DT', productType: 'physical', status: key === 'P4' ? 'inactive' : 'active',
  variants: [1, 2].map(index => ({
    _id: `66cc${ids[key].slice(6)}${String(index).padStart(2, '0')}`, productId: ids[key],
    sku: `SKU-${productCode}-${index}`, displayName: `${name} ${index}`, unitCode: 'PCS', trackingMode: 'quantity',
  })),
});
const baseProducts = () => [
  product('P1', 'Điện thoại Mây A1', 'SP-MAY-A1'),
  product('P2', 'Tai nghe Sóng', 'SP-SONG-DEN'),
  product('P3', 'Tai nghe Sóng', 'SP-SONG-TRANG'),
  product('P4', 'Ốp Mây A1', 'SP-OP-A1'),
  product('P5', 'Điện thoại Mây A1', 'SP-MAY-A1', 'FIX-B'),
];
const failTransport = message => {
  state.violations.push(message);
  throw new Error(`LAYER_B_FORBIDDEN_FETCH: ${message}`);
};
const fixtureFetch = async (input, init = {}) => {
  const url = new URL(String(input));
  const method = init.method || 'GET';
  if (url.origin !== 'http://127.0.0.1:4321' || method !== 'GET') return failTransport(`${method} ${url.origin}${url.pathname}`);
  const prefix = '/api/v1/inventory/catalog/products';
  if (url.pathname !== prefix && !new RegExp(`^${prefix}/[a-f\\d]{24}$`, 'i').test(url.pathname)) return failTransport(url.pathname);
  if ([...url.searchParams.keys()].some(key => !['q', 'companyCode', 'branchId', 'page', 'limit'].includes(key))) return failTransport(`unexpected query ${url.search}`);
  if (url.searchParams.get('companyCode') !== 'FIX-A') return failTransport('unexpected company scope');
  const call = { requestId: state.currentTurn, method, path: url.pathname, query: Object.fromEntries(url.searchParams), kind: url.pathname === prefix ? 'list' : 'detail', status: 200 };
  state.calls.push(call);
  if ((state.rejectAction === 'product.list' && call.kind === 'list') || (state.rejectAction === 'inventory.product.detail' && call.kind === 'detail')) {
    call.status = 422;
    if (call.kind === 'detail') call.target = url.pathname.split('/').at(-1);
    return Response.json({ status: 'error', message: 'Fixture từ chối API chính.' }, { status: 422 });
  }
  const scoped = state.products.filter(item => item.companyCode === 'FIX-A');
  if (call.kind === 'list') {
    const q = (url.searchParams.get('q') || '').toLowerCase();
    const selected = state.suppressSearch && q ? [] : scoped.filter(item => !q || [item.name, item.normalizedName, item.productCode, ...item.variants.map(variant => variant.sku)].some(value => typeof value === 'string' && value.toLowerCase().includes(q)));
    selected.sort((a, b) => a.name.localeCompare(b.name));
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 20));
    const items = selected.slice((page - 1) * limit, page * limit).map(({ variants, ...row }) => row);
    call.returnedIds = items.map(item => item._id);
    call.total = selected.length;
    return Response.json({ status: 'success', data: { items, total: selected.length, page, limit } });
  }
  const id = url.pathname.split('/').at(-1);
  call.target = id;
  const row = scoped.find(item => item._id === id);
  call.status = row ? 200 : 404;
  call.returnedProductId = row?._id;
  call.variantIds = row?.variants.map(variant => variant._id) || [];
  const data = row && clone(row);
  if (data && state.detailTamper === 'parent') data._id = ids.P4;
  if (data && state.detailTamper === 'company') data.companyCode = 'FIX-B';
  if (data && state.detailTamper === 'variant') data.variants[0].productId = ids.P4;
  return row ? Response.json({ status: 'success', data }) : Response.json({ status: 'error', message: 'Không tìm thấy sản phẩm.' }, { status: 404 });
};
const proposal = (actionId, values, remainingRequests = []) => ({ actionId, values, intentType: 'workflow', newRequest: false, remainingRequests });
const turn = async (data, control = {}, request = req) => {
  const input = { conversationId: '77777777-7777-4777-8777-777777777777', requestId: randomUUID(), mode: 'work', ...data };
  state.currentTurn = input.requestId;
  const started = performance.now();
  const reply = await processTurn(request, input, control);
  state.turnDurations.push({ requestId: input.requestId, elapsedMs: performance.now() - started });
  state.replies.push({ requestId: input.requestId, status: reply.status, reply: reply.reply, action: reply.action, referenceSelections: reply.referenceSelections });
  return reply;
};
const seedPage = (count = 25) => {
  const target = product('P1', 'Zzz Điện thoại Mây A1', 'SP-MAY-A1');
  state.products = [...Array.from({ length: count - 1 }, (_, index) => ({
    ...product('P4', `AAA sản phẩm ${String(index).padStart(2, '0')}`, `SP-FILL-${index}`),
    _id: `65dd${String(index).padStart(20, '0')}`,
    variants: [],
  })), target];
  return target;
};

let observationConsole;
beforeEach(ctx => {
  state.scenario = ctx.task.name;
  state.session = null; state.turns = []; state.calls = []; state.budgets = [];
  state.journalWrites = []; state.violations = []; state.interpretation = [];
  state.products = baseProducts(); state.replies = []; state.suppressSearch = false;
  state.expectedViolations = []; state.expectedSafetyViolations = [];
  state.sessionWriteCount = 0;
  state.rejectAction = null;
  state.interpretationCount = 0; state.denyOperation = false; state.requireConfirmation = false;
  state.workflowVersion = 1; state.detailTamper = null;
  state.observations = [];
  state.turnDurations = []; state.observer = false; state.exactVerify = false;
  vi.stubEnv('ASSISTANT_CALL_OBSERVATION', 'false');
  vi.stubEnv('NODE_ENV', 'test');
  observationConsole = vi.spyOn(console, 'info').mockImplementation((tag, data) => {
    if (tag === '[assistant-call-observation]') state.observations.push(JSON.parse(data));
  });
  globalThis.__layerBProductSafety.violations.length = 0;
  vi.stubGlobal('fetch', fixtureFetch);
});
afterEach(ctx => {
  state.evidence.push({
    scenario: state.scenario, exactVerify: state.exactVerify, observer: state.observer, observations: clone(state.observations), turnDurations: clone(state.turnDurations), outcome: ctx.task.result?.state || 'unknown',
    replies: clone(state.replies), calls: clone(state.calls),
    budgets: state.budgets.map(entry => ({ requestId: entry.requestId, charged: clone(entry.calls), reads: entry.instance.reads, writes: entry.instance.writes, stoppedForNoProgress: entry.instance.stoppedForNoProgress })),
    turns: clone(state.turns), journalWriteCount: state.journalWrites.length,
    sessionWriteCount: state.sessionWriteCount, turnCreateCount: state.turns.length,
    violations: [...state.violations, ...globalThis.__layerBProductSafety.violations],
  });
  observationConsole.mockRestore();
  if (state.observer && state.turns.length && process.env.NODE_ENV === 'test') {
    expect(state.observations.reduce((n, row) => n + row.fetchInvocations, 0)).toBe(state.calls.length);
    for (const row of state.observations) {
      expect(row.events).toHaveLength(row.fetchInvocations);
      expect(row.events.every(event => event.durationMs >= 0)).toBe(true);
    }
  }
  expect(state.violations).toEqual(state.expectedViolations);
  expect(globalThis.__layerBProductSafety.violations).toEqual(state.expectedSafetyViolations);
});
afterAll(() => {
  writeFileSync(new URL('./p3-observations.json', import.meta.url), JSON.stringify({
    generatedAt: new Date().toISOString(), scope: ['product.list', 'inventory.product.detail'],
    method: 'real processTurn/executor/catalog/budget; mocked interpretation, auth, assistant persistence and HTTP product API',
    runtimeSourceChanged: true, phase: 'P3 observer OFF/ON x exact verification OFF/ON', scenarios: state.evidence,
  }, null, 2) + '\n');
});

describe.each([
  { exactVerify: false, observer: false }, { exactVerify: true, observer: false },
  { exactVerify: false, observer: true }, { exactVerify: true, observer: true },
])('Local layer B product call audit, exact=$exactVerify observer=$observer', ({ exactVerify, observer }) => {
  beforeEach(() => {
    state.exactVerify = exactVerify;
    state.observer = observer;
    vi.stubEnv('ASSISTANT_PRODUCT_DETAIL_EXACT_VERIFY', exactVerify ? 'true' : 'false');
    vi.stubEnv('ASSISTANT_CALL_OBSERVATION', observer ? 'true' : 'false');
  });
  it.each(['product.list', 'inventory.product.detail'])('EXISTING REJECTION %s mirrors generic api-rejection-probe', async actionId => {
    state.rejectAction = actionId;
    state.interpretation.push(proposal(actionId, actionId === 'product.list' ? {} : { path_id: ids.P1 }));
    const reply = await turn({ text: operationById(actionId).title });
    expect(reply.status).toBe('failed');
    expect(state.calls.at(-1).status).toBe(422);
    expect(state.budgets[0].instance.reads).toBe(1);
  });
  it('CONTROL product.list mirrors existing generic success-probe shape', async () => {
    state.interpretation.push(proposal('product.list', { search: 'SP-MAY-A1' }));
    const reply = await turn({ text: 'Tìm sản phẩm SP-MAY-A1' });
    expect(reply.status).toBe('completed');
    expect(state.calls.map(call => call.kind)).toEqual(['list']);
    expect(state.calls[0].returnedIds).toEqual([ids.P1]);
    expect(state.budgets[0].instance.reads).toBe(1);
  });
  it('CG02 unique detail traces parent product and every physical read', async () => {
    state.interpretation.push(proposal('inventory.product.detail', { path_id: 'SP-MAY-A1' }));
    const reply = await turn({ text: 'Xem chi tiết SP-MAY-A1' });
    expect(reply.status).toBe('completed');
    expect(state.calls.filter(call => call.kind === 'detail').map(call => call.target)).toEqual([ids.P1]);
    expect(state.calls.length).toBeGreaterThan(state.budgets[0].instance.reads);
    expect(state.calls).toHaveLength(exactVerify ? 2 : 3);
  });
  it.each(['P2', 'P3'])('P1 O02 selects %s by its public product code without variant retargeting', async key => {
    state.interpretation.push(proposal('inventory.product.detail', { path_id: 'Tai nghe Sóng' }));
    const first = await turn({ text: 'Xem chi tiết Tai nghe Sóng' });
    expect(first.status).toBe('collecting');
    expect(state.calls.filter(call => call.kind === 'detail')).toHaveLength(0);
    const group = first.referenceSelections?.find(group => group.key === 'path_id');
    expect(group).toBeDefined();
    expect(group.options.map(option => option.label)).toEqual([
      'Tai nghe Sóng [mã: SP-SONG-DEN]', 'Tai nghe Sóng [mã: SP-SONG-TRANG]',
    ]);
    expect(new Set(group.options.map(option => option.value)).size).toBe(2);
    expect(JSON.stringify(group)).not.toMatch(/65aa|66cc/);
    const code = state.products.find(item => item._id === ids[key]).productCode;
    const option = group.options.find(option => option.label.includes(code));
    const selected = await turn({ referenceSelections: { path_id: [option.value] } });
    expect(selected.status).toBe('completed');
    expect(state.interpretationCount).toBe(1);
    expect(state.calls.filter(call => call.kind === 'detail').map(call => call.target)).toEqual([ids[key]]);
    expect(parseAssistantResultTable(selected.reply)).not.toBeNull();
    expect(state.turns.at(-1).steps.some(step => step.status === 'completed')).toBe(true);
  });
  it('P1 retains free-text product code recovery from same-name choices', async () => {
    state.interpretation.push(proposal('inventory.product.detail', { path_id: 'Tai nghe Sóng' }));
    expect((await turn({ text: 'Xem chi tiết Tai nghe Sóng' })).status).toBe('collecting');
    state.interpretation.push(proposal('inventory.product.detail', { path_id: 'SP-SONG-TRANG' }));
    const selected = await turn({ text: 'Mã sản phẩm SP-SONG-TRANG' });
    expect(selected.status).toBe('completed');
    expect(state.calls.filter(call => call.kind === 'detail').map(call => call.target)).toEqual([ids.P3]);
    expect(parseAssistantResultTable(selected.reply)).not.toBeNull();
  });
  it.each(['missing', 'same'])('P1 keeps asking when duplicate product codes are %s', async kind => {
    for (const item of state.products.filter(item => [ids.P2, ids.P3].includes(item._id))) {
      if (kind === 'missing') delete item.productCode;
      else item.productCode = 'SP-SONG-DUP';
    }
    state.interpretation.push(proposal('inventory.product.detail', { path_id: 'Tai nghe Sóng' }));
    const first = await turn({ text: 'Xem chi tiết Tai nghe Sóng' });
    expect(first.status).toBe('collecting');
    const group = first.referenceSelections.find(group => group.key === 'path_id');
    expect(group.options).toHaveLength(1);
    expect(group.options[0].label).toContain('trùng tên');
    expect(JSON.stringify(group)).not.toMatch(/65aa|66cc/);
    const selected = await turn({ referenceSelections: { path_id: [group.options[0].value] } });
    expect(selected.status).toBe('collecting');
    expect(state.calls.filter(call => call.kind === 'detail')).toHaveLength(0);
  });
  it('P1 keeps an ambiguous pre-fix pending selection safe and allows choosing again after restating the name', async () => {
    state.interpretation.push(proposal('inventory.product.detail', { path_id: 'Tai nghe Sóng' }));
    await turn({ text: 'Xem chi tiết Tai nghe Sóng' });
    const legacy = 'Tai nghe Sóng [trùng tên, cần thêm thông tin]';
    state.session.pending.referenceSelections.find(group => group.key === 'path_id').options = [{ label: legacy, value: legacy }];
    const selected = await turn({ referenceSelections: { path_id: [legacy] } });
    expect(selected.status).toBe('collecting');
    expect(state.interpretationCount).toBe(1);
    expect(state.calls.filter(call => call.kind === 'detail')).toHaveLength(0);
    // Old labels contain no public code: the existing path asks for the name again.
    state.interpretation.push(proposal('inventory.product.detail', { path_id: 'Tai nghe Sóng' }));
    const refreshed = await turn({ text: 'Tai nghe Sóng' });
    const group = refreshed.referenceSelections.find(group => group.key === 'path_id');
    expect(group.options).toHaveLength(2);
    const option = group.options.find(option => option.label.includes('SP-SONG-TRANG'));
    expect((await turn({ referenceSelections: { path_id: [option.value] } })).status).toBe('completed');
    expect(state.calls.filter(call => call.kind === 'detail').map(call => call.target)).toEqual([ids.P3]);
    expect(state.interpretationCount).toBe(2);
  });
  it('P1 rejects a fabricated option that was not offered by the server', async () => {
    state.interpretation.push(proposal('inventory.product.detail', { path_id: 'Tai nghe Sóng' }));
    await turn({ text: 'Xem chi tiết Tai nghe Sóng' });
    const selected = await turn({ referenceSelections: { path_id: ['Tai nghe Sóng [mã: SP-FAKE]'] } });
    expect(selected.status).toBe('failed');
    expect(state.calls.filter(call => call.kind === 'detail')).toHaveLength(0);
  });
  it('P1 respects revoked permission between showing and selecting an option', async () => {
    state.interpretation.push(proposal('inventory.product.detail', { path_id: 'Tai nghe Sóng' }));
    const first = await turn({ text: 'Xem chi tiết Tai nghe Sóng' });
    state.denyOperation = true;
    const group = first.referenceSelections.find(group => group.key === 'path_id');
    const selected = await turn({ referenceSelections: { path_id: [group.options[0].value] } });
    expect(selected.status).toBe('failed');
    expect(state.calls.filter(call => call.kind === 'detail')).toHaveLength(0);
  });
  it('P1 still requires configured confirmation after selecting a product', async () => {
    state.requireConfirmation = true;
    state.interpretation.push(proposal('inventory.product.detail', { path_id: 'Tai nghe Sóng' }));
    const first = await turn({ text: 'Xem chi tiết Tai nghe Sóng' });
    const option = first.referenceSelections.find(group => group.key === 'path_id').options.find(option => option.label.includes('SP-SONG-TRANG'));
    const preview = await turn({ referenceSelections: { path_id: [option.value] } });
    expect(preview.status).toBe('confirmation');
    expect(state.calls.filter(call => call.kind === 'detail')).toHaveLength(0);
    const selected = await turn({ decision: { id: preview.action.id, confirmed: true } });
    expect(selected.status).toBe('completed');
    expect(state.calls.filter(call => call.kind === 'detail').map(call => call.target)).toEqual([ids.P3]);
    expect(state.interpretationCount).toBe(1);
  });
  it('O14 CG05 F25 succeeds because executor requests limit100 instead of API default20', async () => {
    const target = seedPage(25);
    state.interpretation.push(proposal('inventory.product.detail', { path_id: target.productCode }));
    const reply = await turn({ text: `Xem chi tiết ${target.productCode}` });
    expect(state.products.find(item => item._id === ids.P1)).toBeDefined();
    expect(state.calls.some(call => call.kind === 'list' && call.returnedIds.includes(ids.P1))).toBe(true);
    expect(state.calls.filter(call => call.kind === 'list').every(call => call.query.limit === '100')).toBe(true);
    expect(reply.status).toBe('completed');
    expect(state.calls.filter(call => call.kind === 'detail').map(call => call.target)).toEqual([ids.P1]);
  });
  it('O14 CG05 F101 compares revalidation beyond first100', async () => {
    const target = seedPage(101);
    state.interpretation.push(proposal('inventory.product.detail', { path_id: target.productCode }));
    const reply = await turn({ text: `Xem chi tiết ${target.productCode}` });
    expect(state.calls[0].returnedIds).toContain(ids.P1);
    if (exactVerify) {
      expect(reply.status).toBe('completed');
      expect(state.calls).toHaveLength(2);
      expect(state.calls.filter(call => call.kind === 'detail').map(call => call.target)).toEqual([ids.P1]);
    } else {
      expect(state.calls.some(call => call.kind === 'list' && call.query.q === '' && call.total === 101 && call.returnedIds.length === 100 && !call.returnedIds.includes(ids.P1))).toBe(true);
      expect(reply.status).not.toBe('completed');
      expect(state.calls.filter(call => call.kind === 'detail')).toHaveLength(0);
    }
  });
  it('O15 CG03 fallback reads are counted physically but not all in the current journal', async () => {
    state.suppressSearch = true;
    state.interpretation.push(proposal('inventory.product.detail', { path_id: 'Điện thoại Mây A1' }));
    const reply = await turn({ text: 'Xem chi tiết Điện thoại Mây A1' });
    expect(reply.status).toBe('completed');
    expect(state.calls.some(call => call.kind === 'list' && call.query.q)).toBe(true);
    expect(state.calls.some(call => call.kind === 'list' && !call.query.q)).toBe(true);
    expect(state.calls.length).toBeGreaterThan(state.turns[0].steps.length);
    expect(state.calls.length).toBeGreaterThan(state.budgets[0].instance.reads);
  });
  it('CG06 empty variants preserves existing transport parent but projects zero rows', async () => {
    state.products.find(item => item._id === ids.P1).variants = [];
    const rows = await lookupRecords(req, 'inventory.product.detail', '', { path_id: ids.P1 });
    expect(state.calls[0].returnedProductId).toBe(ids.P1);
    expect(rows).toEqual([]);
  });
  it('CG06 nonempty detail projects SKU ids while keeping a separate productId', async () => {
    const rows = await lookupRecords(req, 'inventory.product.detail', '', { path_id: ids.P3 });
    expect(rows).toHaveLength(2);
    expect(rows.every(row => row.productId === ids.P3 && row.id !== ids.P3)).toBe(true);
    expect(state.calls.map(call => call.target)).toEqual([ids.P3]);
  });
  it('DISTRIBUTION two sequential read steps keep independent physical calls', async () => {
    state.interpretation.push(
      proposal('product.list', { search: 'SP-MAY-A1' }, ['Xem chi tiết SP-MAY-A1']),
      proposal('inventory.product.detail', { path_id: 'SP-MAY-A1' }),
    );
    const reply = await turn({ text: 'Tìm SP-MAY-A1 rồi xem chi tiết' });
    expect(reply.status).toBe('completed');
    expect(state.calls.filter(call => call.kind === 'detail').map(call => call.target)).toEqual([ids.P1]);
    expect(state.budgets[0].instance.reads).toBe(2);
    expect(state.calls.length).toBeGreaterThan(2);
  });
  it('CONTROL raw-ID reference after first100 is distinct from product absence', async () => {
    seedPage(101);
    const resolution = await resolveReferences(req, operationById('inventory.product.detail'), { path_id: ids.P1 });
    expect(state.products.some(item => item._id === ids.P1)).toBe(true);
    expect(resolution.errors.length).toBeGreaterThan(0);
    expect(state.calls.every(call => call.kind === 'list' && !call.returnedIds.includes(ids.P1))).toBe(true);
  });
  it('DISTRIBUTION nine distinct detail steps compare physical reads with9 charged', async () => {
    state.products = Array.from({ length: 9 }, (_, index) => {
      const id = `65ee${String(index).padStart(20, '0')}`;
      const row = product('P1', `Sản phẩm chuỗi ${index}`, `SP-CHAIN-${index}`);
      return { ...row, _id: id, variants: row.variants.map((variant, child) => ({
        ...variant, productId: id, sku: `SKU-CHAIN-${index}-${child}`,
        _id: `66ee${String(index).padStart(18, '0')}${String(child).padStart(2, '0')}`,
      })) };
    });
    const tasks = state.products.map(row => `Xem chi tiết ${row.productCode}`);
    for (const [index, row] of state.products.entries()) {
      state.interpretation.push(proposal('inventory.product.detail', { path_id: row.productCode }, index === 0 ? tasks.slice(1) : []));
    }
    const reply = await turn({ text: tasks.join(', rồi ') });
    expect(reply.status).toBe('completed');
    expect(state.calls).toHaveLength(exactVerify ? 18 : 27);
    expect(state.calls.filter(call => call.kind === 'detail').map(call => call.target)).toEqual(state.products.map(row => row._id));
    expect(state.budgets[0].instance.reads).toBe(9);
    expect(state.calls).toHaveLength(exactVerify ? 18 : 27);
  });
  it('SAFETY external fetch and direct DB/provider calls fail before real I/O', async () => {
    state.expectedViolations = ['GET https://example.invalid/', 'provider'];
    state.expectedSafetyViolations = ['mongoose.connect', 'http.request'];
    await expect(fixtureFetch('https://example.invalid/')).rejects.toThrow('LAYER_B_FORBIDDEN_FETCH');
    const mongoose = (await import('mongoose')).default;
    expect(() => mongoose.connect('mongodb://127.0.0.1:1/forbidden')).toThrow('LAYER_B_FORBIDDEN_IO');
    const http = (await import('node:http')).default;
    expect(() => http.request('http://127.0.0.1:1/')).toThrow('LAYER_B_FORBIDDEN_IO');
    const { openrouterChat } = await import('../../../service/openrouter.service.ts');
    await expect(openrouterChat({})).rejects.toThrow('Provider forbidden');
  });
  it('P2 detail with no SKU preserves the existing parent product', async () => {
    state.products.find(item => item._id === ids.P1).variants = [];
    state.interpretation.push(proposal('inventory.product.detail', { path_id: 'SP-MAY-A1' }));
    const reply = await turn({ text: 'Xem chi tiết SP-MAY-A1' });
    expect(reply.status).toBe('completed');
    if (exactVerify) {
      expect(parseAssistantResultTable(reply.reply)).not.toBeNull();
      expect(reply.reply).toContain('SP-MAY-A1');
      expect(reply.reply).toContain('Điện thoại Mây A1');
    }
    expect(reply.reply).not.toContain(ids.P1);
    expect(state.calls.filter(call => call.kind === 'detail')).toHaveLength(1);
  });
  it('P2 flag is off when unset, regardless of the comparison group', async () => {
    vi.stubEnv('ASSISTANT_PRODUCT_DETAIL_EXACT_VERIFY', undefined);
    state.interpretation.push(proposal('inventory.product.detail', { path_id: 'SP-MAY-A1' }));
    expect((await turn({ text: 'Xem chi tiết SP-MAY-A1' })).status).toBe('completed');
    expect(state.calls).toHaveLength(3);
  });
  if (exactVerify) {
    const previewProduct = async () => {
      state.requireConfirmation = true;
      state.interpretation.push(proposal('inventory.product.detail', { path_id: 'SP-MAY-A1' }));
      const preview = await turn({ text: 'Xem chi tiết SP-MAY-A1' });
      expect(preview.status).toBe('confirmation');
      expect(state.session.pending.productReadProof.version).toBe(1);
      expect(JSON.stringify(preview)).not.toContain('productReadProof');
      expect(JSON.stringify(preview)).not.toContain(ids.P1);
      return preview;
    };
    const confirm = preview => turn({ decision: { id: preview.action.id, confirmed: true } });
    it.each(['parent', 'company', 'variant'])('P2 rejects a mismatched %s in the exact response before completing the step', async kind => {
      state.detailTamper = kind;
      state.interpretation.push(proposal('inventory.product.detail', { path_id: 'SP-MAY-A1' }));
      const reply = await turn({ text: 'Xem chi tiết SP-MAY-A1' });
      expect(reply.status).toBe('failed');
      expect(state.calls.map(call => call.kind)).toEqual(['list', 'detail']);
      expect(state.turns.at(-1).steps.some(step => step.status === 'completed')).toBe(false);
    });
    it.each(['version', 'owner', 'pendingId', 'expired', 'workflowDigest', 'targetId'])('P2 rejects invalid stored proof: %s', async field => {
      const preview = await previewProduct();
      const proof = state.session.pending.productReadProof;
      if (field === 'expired') { proof.issuedAt -= 301000; proof.expiresAt -= 301000; }
      else proof[field] = field === 'version' ? 2 : 'invalid-fixture-value';
      expect((await confirm(preview)).status).toBe('failed');
      expect(state.calls.filter(call => call.kind === 'detail')).toHaveLength(0);
    });
    it('P2 rejects command target changes after a persisted preview', async () => {
      const preview = await previewProduct();
      state.session.pending.resolved.path_id = ids.P4;
      expect((await confirm(preview)).status).toBe('failed');
      expect(state.calls.filter(call => call.kind === 'detail')).toHaveLength(0);
    });
    it('P2 rejects a proof from a different branch session without treating products as branch-owned', async () => {
      const preview = await previewProduct();
      // Simulate a restored pending crossing session scope: no product ownership claim is made.
      state.session.branchId = 'another-branch';
      const changed = { ...req, user: { ...req.user, branchId: 'another-branch' } };
      const reply = await turn({ decision: { id: preview.action.id, confirmed: true } }, {}, changed);
      expect(reply.status).toBe('failed');
      expect(state.calls.filter(call => call.kind === 'detail')).toHaveLength(0);
    });
    it('P2 rebuilds the preview when workflow version changes, then verifies the same product', async () => {
      const preview = await previewProduct();
      state.workflowVersion += 1;
      const refreshed = await confirm(preview);
      expect(refreshed.status).toBe('confirmation');
      expect(state.calls.filter(call => call.kind === 'detail')).toHaveLength(0);
      expect((await confirm(refreshed)).status).toBe('completed');
      expect(state.calls.filter(call => call.kind === 'detail').map(call => call.target)).toEqual([ids.P1]);
    });
    it('P2 detects workflow changes even if its version was not incremented', async () => {
      const preview = await previewProduct();
      state.requireConfirmation = false;
      expect((await confirm(preview)).status).toBe('failed');
      expect(state.calls.filter(call => call.kind === 'detail')).toHaveLength(0);
    });
    it('P2 does not retarget a deleted product to another record with the same name', async () => {
      const preview = await previewProduct();
      state.products = state.products.filter(item => item._id !== ids.P1);
      state.products.push({ ...product('P4', 'Điện thoại Mây A1', 'SP-REPLACEMENT'), _id: ids.P4 });
      expect((await confirm(preview)).status).toBe('failed');
      expect(state.calls.map(call => call.kind)).toEqual(['list', 'detail']);
      expect(state.calls.at(-1).target).toBe(ids.P1);
      expect(state.calls.at(-1).status).toBe(404);
    });
    it('P2 resumes a legacy pending without proof using legacy verification', async () => {
      const preview = await previewProduct();
      delete state.session.pending.productReadProof;
      expect((await confirm(preview)).status).toBe('completed');
      expect(state.calls.map(call => call.kind)).toEqual(['list', 'list', 'detail']);
    });
    it('P2 flag-off restores legacy verification without clearing pending or duplicating detail', async () => {
      const preview = await previewProduct();
      vi.stubEnv('ASSISTANT_PRODUCT_DETAIL_EXACT_VERIFY', 'false');
      expect((await confirm(preview)).status).toBe('completed');
      expect(state.calls.map(call => call.kind)).toEqual(['list', 'list', 'detail']);
      expect(state.session.pending).toBeNull();
    });
    it('P2 flag-off retains pending beyond page100; explicit flag-on resume can still complete', async () => {
      seedPage(101);
      const preview = await previewProduct();
      vi.stubEnv('ASSISTANT_PRODUCT_DETAIL_EXACT_VERIFY', 'false');
      expect((await confirm(preview)).status).toBe('failed');
      expect(state.session.pending.id).toBe(preview.action.id);
      expect(state.calls.filter(call => call.kind === 'detail')).toHaveLength(0);
      vi.stubEnv('ASSISTANT_PRODUCT_DETAIL_EXACT_VERIFY', 'true');
      expect((await confirm(preview)).status).toBe('completed');
      expect(state.calls.filter(call => call.kind === 'detail').map(call => call.target)).toEqual([ids.P1]);
    });
    it('P2 request replay after flag-off returns the cached result without another GET', async () => {
      state.interpretation.push(proposal('inventory.product.detail', { path_id: 'SP-MAY-A1' }));
      const input = { text: 'Xem chi tiết SP-MAY-A1', requestId: randomUUID() };
      const first = await turn(input);
      const reads = state.calls.length;
      vi.stubEnv('ASSISTANT_PRODUCT_DETAIL_EXACT_VERIFY', 'false');
      const replay = await turn(input);
      expect(replay.status).toBe('completed');
      expect(replay.reply).toBe(first.reply);
      expect(state.calls).toHaveLength(reads);
    });
    it.each(['production', 'staging', 'unset', 'background'])('P2 keeps the prototype disabled for %s', async mode => {
      if (mode !== 'background') vi.stubEnv('NODE_ENV', mode === 'unset' ? undefined : mode);
      state.interpretation.push(proposal('inventory.product.detail', { path_id: 'SP-MAY-A1' }));
      expect((await turn({ text: 'Xem chi tiết SP-MAY-A1' }, { background: mode === 'background' })).status).toBe('completed');
      expect(state.calls.map(call => call.kind)).toEqual(['list', 'list', 'detail']);
    });
    it('P2 does not accept a model or client proof to bypass resolving an invented ID', async () => {
      seedPage(101);
      const forged = { version: 1, targetId: ids.P1, entity: 'Product' };
      state.interpretation.push(proposal('inventory.product.detail', { path_id: ids.P1, productReadProof: forged }));
      expect((await turn({ text: 'Xem chi tiết sản phẩm', productReadProof: forged })).status).not.toBe('completed');
      expect(state.calls.filter(call => call.kind === 'detail')).toHaveLength(0);
    });
    it('P2 cancellation prevents the primary exact GET', async () => {
      state.interpretation.push(proposal('inventory.product.detail', { path_id: 'SP-MAY-A1' }));
      const reply = await turn({ text: 'Xem chi tiết SP-MAY-A1' }, { cancelled: async () => true });
      expect(reply.status).not.toBe('completed');
      expect(state.calls.filter(call => call.kind === 'detail')).toHaveLength(0);
    });
  }
});

it('P2 paired fixtures preserve replies, targets and command-to-transport identity', () => {
  const before = state.evidence.filter(row => !row.exactVerify && !row.observer);
  const pairs = before.map(off => ({ off, on: state.evidence.find(row => row.exactVerify && !row.observer && row.scenario === off.scenario) }));
  expect(pairs).toHaveLength(24);
  for (const { off, on } of pairs) {
    expect(on).toBeDefined();
    if (!off.scenario.includes('F101')) {
      expect(on.replies.map(row => ({ status: row.status, reply: row.reply })))
        .toEqual(off.replies.map(row => ({ status: row.status, reply: row.reply })));
      expect(on.calls.filter(call => call.kind === 'detail').map(call => call.target))
        .toEqual(off.calls.filter(call => call.kind === 'detail').map(call => call.target));
    }
    // Helper-only projection probes deliberately have no processTurn/ExecutionBudget.
    for (const call of on.budgets.length ? on.calls.filter(call => call.kind === 'detail') : []) {
      const commands = on.budgets.filter(budget => budget.requestId === call.requestId)
        .flatMap(budget => budget.charged).filter(command => command.actionId === 'inventory.product.detail');
      expect(commands.some(command => command.values.path_id === call.target)).toBe(true);
    }
  }
  writeFileSync(new URL('./p3-exact-comparison.json', import.meta.url), JSON.stringify(pairs.map(({ off, on }) => ({
    scenario: off.scenario,
    before: { calls: off.calls.length, charged: off.budgets.reduce((n, row) => n + row.reads, 0), statuses: off.replies.map(row => row.status) },
    after: { calls: on.calls.length, charged: on.budgets.reduce((n, row) => n + row.reads, 0), statuses: on.replies.map(row => row.status) },
  })), null, 2) + '\n');
});

it('P3 observer OFF/ON preserves replies, API sequence, budgets, no-progress and persistence counts', () => {
  const observed = state.evidence.filter(row => row.observer);
  expect(observed).toHaveLength(72);
  const calls = row => row.calls.map(({ requestId, ...call }) => call);
  const budgets = row => row.budgets.map(({ requestId, ...budget }) => budget);
  for (const on of observed) {
    const off = state.evidence.find(row => !row.observer && row.exactVerify === on.exactVerify && row.scenario === on.scenario);
    expect(off).toBeDefined();
    expect(on.replies.map(row => ({ status: row.status, reply: row.reply }))).toEqual(off.replies.map(row => ({ status: row.status, reply: row.reply })));
    expect(calls(on)).toEqual(calls(off));
    expect(budgets(on)).toEqual(budgets(off));
    expect(on.journalWriteCount).toBe(off.journalWriteCount);
    expect(on.sessionWriteCount).toBe(off.sessionWriteCount);
    expect(on.turnCreateCount).toBe(off.turnCreateCount);
  }
});
