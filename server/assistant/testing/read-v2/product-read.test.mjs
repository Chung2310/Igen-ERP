import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ERP_LLM_MODEL } from '../../../../shared/llm-model.ts';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import '../layer-b-product-audit/safety.setup.mjs';

const state = vi.hoisted(() => ({
  session: null, turns: [], interpretation: [], calls: [], budgets: [],
  journalWrites: [], violations: [], products: [], evidence: [],
  modelInputs: [], modelAnswer: null, searchDefault: undefined, requireSearch: false,
  scenario: '', currentTurn: '', replies: [], suppressSearch: false,
  expectedViolations: [], expectedSafetyViolations: [],
  sessionWriteCount: 0,
  rejectAction: null, interpretationCount: 0, denyOperation: false, requireConfirmation: false,
  workflowVersion: 1, detailTamper: null, exactVerify: false,
  gate: false, journalFailure: null, journalSeed: undefined, gateReadCount: 0, gateWriteAttempts: 0, workflowReadCount: 0,
  observer: false, observations: [], turnDurations: [],
}));
const clone = value => structuredClone(value);

vi.mock('../../../service/openrouter.service.ts', () => ({
  openrouterChat: async params => {
    const dto = JSON.parse(params.messages.at(-1).content);
    if (dto.schemaVersion !== 2 || !dto.inputRef || !dto.contextRef) { state.violations.push('unexpected provider'); throw new Error('Only V2 DTO permitted'); }
    state.modelInputs.push({ model: params.model, dto, system: params.messages[0].content });
    const result = typeof state.modelAnswer === 'function' ? await state.modelAnswer(dto) : state.modelAnswer;
    return { text: typeof result === 'string' ? result : JSON.stringify(result) };
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
    for (const key of Object.keys(update.$unset || {})) {
      const parts = key.split('.'); const target = parts.slice(0,-1).reduce((v,k)=>v?.[k],record);
      if (target) delete target[parts.at(-1)];
    }
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
        && (expected.$in === undefined || expected.$in.includes(value))
        && (expected.$lte === undefined || typeof value === "number" && value <= expected.$lte);
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
      updateMany: async (filter, update) => { for (const row of state.turns.filter(row => matches(row, filter))) apply(row, update); return { acknowledged: true }; },
      create: async input => {
        if (state.turns.some(turn => turn.requestId === input.requestId)) throw Object.assign(new Error('Duplicate'), { code: 11000 });
        const record = { ...input, businessCallJournal: clone(state.journalSeed), _id: `turn-${state.turns.length + 1}`, createdAt: new Date(), updatedAt: new Date(), status: 'processing', steps: [] };
        state.turns.push(record);
        return copy(record);
      },
      updateOne: async (filter, update) => {
        if (update.$set?.businessCallJournal) {
          state.gateWriteAttempts++;
          const entry = update.$set.businessCallJournal.calls.at(-1);
          if (state.journalFailure === entry?.status) throw new Error('Fixture journal failure');
        }
        const record = state.turns.find(turn => matches(turn, filter));
        if (!record) throw new Error('Unknown turn update');
        state.journalWrites.push({ requestId: record.requestId, update: copy(update) });
        apply(record, update);
        return { matchedCount: 1 };
      },
      findOne: filter => {
        const query = chain(() => [...state.turns].reverse().find(turn => matches(turn, filter)) || null);
        const select = query.select;
        query.select = fields => { if (fields === 'businessCallJournal') state.gateReadCount++; return select(fields); };
        return query;
      },
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
    currentWorkflow: async (req, id) => {
      state.workflowReadCount++;
      const workflow = defaultWorkflow(await assertOperation(req, id));
      if (id === 'product.list' && state.searchDefault !== undefined) workflow.fields = workflow.fields.map(field => field.key === 'search' ? { ...field, defaultValue: state.searchDefault } : field);
      if (id === 'product.list' && state.requireSearch) workflow.fields = workflow.fields.map(field => field.key === 'search' ? { ...field, required: true } : field);
      return { ...workflow, version: state.workflowVersion, requireConfirmation: state.requireConfirmation };
    },
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
vi.mock('../../session-memory.ts', () => ({ SESSION_MEMORY_LIMIT: 2400, summarizeAssistantSession: async () => { state.violations.push('legacy session summarizer'); throw new Error('Raw history must not enter a model in V2'); } }));

import { processTurn, conversationState } from '../../service.ts';
import { processProductReadV2Turn } from '../../read-v2-service.ts';
import { READ_V2_TTL } from '../../read-v2-contract.ts';
import { callOperation, lookupRecords, resolveReferences } from '../../executor.ts';
import { businessCallFetch, withBusinessCallTurn, withBusinessCallOwner, withBusinessOperation, pinBusinessWorkflowVersion, readBusinessCallJournal } from '../../business-call-gate.ts';
import { withAssistantExecution } from '../../execution-control.ts';
import { ExecutionBudget } from '../../execution-budget.ts';
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
  state.modelInputs = []; state.searchDefault = undefined; state.requireSearch = false; state.modelAnswer = dto => proposalV2('product.list', {});
  vi.stubEnv('JWT_ACCESS_SECRET', 'synthetic-v2-cache-key-fixture-only');
  vi.stubEnv('ASSISTANT_PRODUCT_READ_V2', 'true');
  state.gate = true; state.journalFailure = null; state.journalSeed = undefined; state.gateReadCount = 0; state.gateWriteAttempts = 0; state.workflowReadCount = 0;
  vi.stubEnv('ASSISTANT_SAFE_EXECUTION', 'true');
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
    scenario: state.scenario, gate: state.gate, gateReadCount: state.gateReadCount, gateWriteAttempts: state.gateWriteAttempts, workflowReadCount: state.workflowReadCount, exactVerify: state.exactVerify, observer: state.observer, observations: clone(state.observations), turnDurations: clone(state.turnDurations), outcome: ctx.task.result?.state || 'unknown',
    replies: clone(state.replies), modelInputs: clone(state.modelInputs), calls: clone(state.calls),
    budgets: state.budgets.map(entry => ({ requestId: entry.requestId, charged: clone(entry.calls), reads: entry.instance.reads, writes: entry.instance.writes, stoppedForNoProgress: entry.instance.stoppedForNoProgress })),
    turns: clone(state.turns), businessJournalWriteCount: state.journalWrites.filter(row => row.update.$set?.businessCallJournal).length, journalWriteCount: state.journalWrites.length,
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
  writeFileSync(new URL('./v2-observations.json', import.meta.url), JSON.stringify({
    generatedAt: new Date().toISOString(), scope: ['product.list', 'inventory.product.detail'],
    method: 'real processTurn/executor/catalog/budget; mocked interpretation, auth, assistant persistence and HTTP product API',
    runtimeSourceChanged: true, phase: 'V2 direct/read fixtures;provider/HTTP/auth/persistence mocked;legacy_primary accounting', scenarios: state.evidence,
  }, null, 2) + '\n');
});

const proposalV2 = (actionId, values) => ({ schemaVersion: 2, intentType: 'workflow', proposal: { actionId, values }, cancel: false, newRequest: false, remainingRequests: [] });
const quote = (dto, raw) => ({ raw, source: 'utterance', evidence: { kind: 'text_quote', inputRef: dto.inputRef, quote: raw } });
const by = (action, raw) => dto => proposalV2(action, raw ? action === 'product.list' ? { search: quote(dto, raw) } : { path_id: { kind: 'name_or_code', extracted: quote(dto, raw) } } : {});
const handle = (dto, index = 0, evidence = {}) => proposalV2('inventory.product.detail', { path_id: { kind: 'handle', handle: dto.entities[index]?.handle || 'invented', evidence: { kind: 'selected_handle', contextRef: dto.contextRef, handle: dto.entities[index]?.handle || 'invented', ...evidence } } });
const context = (selected = [ids.P1], multi = false) => ({ version: 2, route: '/kho-san-pham', viewInstance: 'fixture-view', revision: 1, capturedAt: new Date(Date.now()).toISOString(), pageType: multi ? 'list' : 'detail', ...(multi ? { selection: { type: 'product', ids: selected } } : { entity: { type: 'product', id: selected[0] } }) });
const envelope = input => ({ schemaVersion: 2, conversationId: '77777777-7777-4777-8777-777777777777', requestId: randomUUID(), mode: 'work', input });
const v2 = async (input, control = {}, request = req) => {
  const payload = input.schemaVersion ? input : envelope(input); state.currentTurn = payload.requestId;
  const reply = await processProductReadV2Turn(request, payload, control);
  state.replies.push({ status: reply.status, reply: reply.reply }); return reply;
};
const ask = (text, screenContext, control) => v2({ kind: 'text', text, ...(screenContext ? { screenContext } : {}) }, control);
const select = (reply, index = 0, overrides = {}) => v2({ kind: 'selection', pendingId: reply.clarification.pendingId, pendingVersion: reply.clarification.pendingVersion, optionToken: reply.clarification.options[index].optionToken, ...overrides });
const decide = (reply, confirmed = true, overrides = {}) => v2({ kind: 'decision', pendingId: reply.clarification.pendingId, pendingVersion: reply.clarification.pendingVersion, confirmed, ...overrides });
let clock;
const advance = ms => { const now = Date.now() + ms; clock ||= vi.spyOn(Date, 'now'); clock.mockReturnValue(now); };
afterEach(() => { clock?.mockRestore(); clock = undefined; });

it('V2 list quote uses common dispatch, table and unchanged primary budget', async () => {
  state.modelAnswer = by('product.list', 'SP-MAY-A1'); const reply = await ask('Tìm SP-MAY-A1');
  expect(reply.status).toBe('completed'); expect(reply.schemaVersion).toBe(2); expect(parseAssistantResultTable(reply.reply)).not.toBeNull();
  expect(state.calls).toHaveLength(1); expect(state.calls[0].query.q).toBe('SP-MAY-A1'); expect(state.budgets[0].instance.reads).toBe(1);
  expect(state.turns[0].steps.map(step => step.status)).toEqual(['completed']); expect(state.turns[0].readV2.inputRequestDigest).toBe(state.turns[0].digest);
  expect(state.modelInputs[0].model).toBe(ERP_LLM_MODEL);
});
it('V2 exact target bypasses first-page recheck independently of C flag', async () => {
  vi.stubEnv('ASSISTANT_PRODUCT_DETAIL_EXACT_VERIFY', 'false'); state.modelAnswer = by('inventory.product.detail', 'SP-MAY-A1');
  expect((await ask('Xem SP-MAY-A1')).status).toBe('completed'); expect(state.calls.map(row => row.kind)).toEqual(['list', 'detail']);
  expect(state.calls.at(-1).target).toBe(ids.P1); expect(state.budgets[0].instance.reads).toBe(1); expect(state.interpretationCount).toBe(0);
  expect(state.turns[0].steps.map(step => step.actionId)).toEqual(['inventory.product.detail']);
});
it.each(['P2', 'P3'])('V2 duplicate name selects %s by opaque token without another interpretation', async key => {
  state.modelAnswer = by('inventory.product.detail', 'Tai nghe Sóng'); const first = await ask('Xem Tai nghe Sóng');
  expect(first.status).toBe('collecting'); expect(first.clarification.kind).toBe('choose_entity');
  expect(first.clarification.options.map(option => option.label)).toEqual(['Tai nghe Sóng [mã: SP-SONG-DEN]', 'Tai nghe Sóng [mã: SP-SONG-TRANG]']);
  const token = first.clarification.options[0].optionToken;
  expect(token).toMatch(/^opt_[A-Za-z0-9_-]{43}$/); expect(JSON.stringify(state.session)).not.toContain(token); expect(JSON.stringify(state.turns)).not.toContain(token);
  expect((await select(first, key === 'P2' ? 0 : 1)).status).toBe('completed'); expect(state.calls.at(-1).target).toBe(ids[key]); expect(state.modelInputs).toHaveLength(1);
  expect(state.session.pending).toBeNull();
});
it('V2 missing target asks for data and accepts a free-text continuation', async () => {
  state.modelAnswer = by('inventory.product.detail'); const first = await ask('Xem chi tiết sản phẩm');
  expect(first.clarification.kind).toBe('fill_fields'); expect(state.calls).toHaveLength(0);
  state.modelAnswer = by('inventory.product.detail', 'SP-MAY-A1'); expect((await ask('SP-MAY-A1')).status).toBe('completed');
  expect(state.modelInputs[1].dto.pending).toEqual({ actionId: 'inventory.product.detail', kind: 'fill_fields' });
});
it('V2 indistinguishable product labels remain a question, never a positional choice', async () => {
  state.products.filter(row => [ids.P2, ids.P3].includes(row._id)).forEach(row => { row.productCode = 'SAME'; });
  state.modelAnswer = by('inventory.product.detail', 'Tai nghe Sóng'); const reply = await ask('Xem Tai nghe Sóng');
  expect(reply.clarification.kind).toBe('fill_fields'); expect(reply.clarification.options).toBeUndefined(); expect(state.calls).toHaveLength(1);
});
it.each(['product.list', 'inventory.product.detail'])('V2 respects custom confirmation for %s', async action => {
  state.requireConfirmation = true; state.modelAnswer = by(action, 'SP-MAY-A1'); const first = await ask('Xem SP-MAY-A1');
  expect(first.status).toBe('confirmation'); expect(JSON.stringify(first)).not.toMatch(/65aa|66cc/);
  expect((await decide(first)).status).toBe('completed'); expect(state.session.pending).toBeNull(); expect(state.modelInputs).toHaveLength(1);
  expect(state.calls.at(-1).kind).toBe(action === 'product.list' ? 'list' : 'detail');
});
it('V2 option selection does not satisfy required confirmation or allow the previous decision', async () => {
  state.requireConfirmation = true; state.modelAnswer = by('inventory.product.detail', 'Tai nghe Sóng'); const choices = await ask('Xem Tai nghe Sóng');
  expect((await decide(choices)).status).toBe('collecting'); const preview = await select(choices, 1);
  expect(preview.status).toBe('confirmation'); expect(preview.clarification.pendingVersion).toBe(choices.clarification.pendingVersion + 1);
  expect(state.calls.filter(row => row.kind === 'detail')).toHaveLength(0);
  expect((await decide(preview)).status).toBe('completed'); expect(state.calls.at(-1).target).toBe(ids.P3);
});
it('V2 decline cancels without primary read', async () => {
  state.requireConfirmation = true; state.modelAnswer = by('inventory.product.detail', 'SP-MAY-A1'); const first = await ask('Xem SP-MAY-A1');
  expect((await decide(first, false)).status).toBe('cancelled'); expect(state.calls.map(row => row.kind)).toEqual(['list']); expect(state.session.pending).toBeNull();
});
it('V2 screen context is exact-verified before exposing a model-safe handle', async () => {
  state.modelAnswer = dto => handle(dto); expect((await ask('Xem cái này', context())).status).toBe('completed');
  expect(state.calls.map(row => row.kind)).toEqual(['detail', 'detail']); expect(state.calls.every(row => row.target === ids.P1)).toBe(true); expect(state.budgets[0].instance.reads).toBe(1);
  expect(JSON.stringify(state.modelInputs)).not.toMatch(/65aa|65bb|66cc|FIX-A|recordId|productId|conversationId|requestId/);
});
it('V2 context_field extraction matches the verified public value and source', async () => {
  state.modelAnswer = dto => proposalV2('product.list', { search: { raw: dto.entities[0].productCode, source: 'screen', evidence: { kind: 'context_field', contextRef: dto.contextRef, handle: dto.entities[0].handle, field: 'productCode' } } });
  expect((await ask('Tìm cùng mã này', context())).status).toBe('completed'); expect(state.calls.at(-1).query.q).toBe('SP-MAY-A1');
});
it('V2 session context is revalidated without raw legacy history, memory or pending', async () => {
  state.modelAnswer = by('inventory.product.detail', 'SP-MAY-A1'); await ask('Xem SP-MAY-A1');
  state.session.messages.push({ role: 'assistant', content: '65aa00000000000000000001 Bearer secret-hidden' }); state.session.sessionMemory = '65aa00000000000000000001';
  state.modelAnswer = dto => handle(dto); expect((await ask('Xem lại cái đó')).status).toBe('completed');
  expect(state.modelInputs[1].dto.entities[0].origin).toBe('session'); expect(JSON.stringify(state.modelInputs[1])).not.toMatch(/65aa|Bearer|secret-hidden|sessionMemory/);
});
it.each([false, true])('V2 multiple selection requires a unique public mention, explicit=%s', async explicit => {
  state.modelAnswer = dto => handle(dto, 1); const reply = await ask(explicit ? 'Xem SP-SONG-TRANG' : 'Xem cái này', context([ids.P2, ids.P3], true));
  expect(reply.status).toBe(explicit ? 'completed' : 'collecting'); expect(state.budgets[0].instance.reads).toBe(explicit ? 1 : 0);
  if (explicit) expect(state.calls.at(-1).target).toBe(ids.P3);
});
it.each(['handle', 'context'])('V2 rejects a mismatched %s binding', async mode => {
  state.modelAnswer = dto => handle(dto, 0, mode === 'handle' ? { handle: 'old-handle' } : { contextRef: 'old-context' });
  expect((await ask('Xem cái này', context())).status).toBe('collecting'); expect(state.calls).toHaveLength(1); expect(state.budgets[0].instance.reads).toBe(0);
});
it.each(['input', 'quote', 'case', 'source', 'repeat'])('V2 bad evidence %s sends no query', async mode => {
  state.modelAnswer = dto => { const claim = quote(dto, mode === 'case' ? 'sp-may-a1' : 'SP-MAY-A1');
    if (mode === 'input') claim.evidence.inputRef = 'old'; if (mode === 'quote') claim.evidence.quote = 'OTHER'; if (mode === 'case') claim.evidence.quote = 'SP-MAY-A1'; if (mode === 'source') claim.source = 'screen';
    return proposalV2('product.list', { search: claim }); };
  expect((await ask(mode === 'repeat' ? 'SP-MAY-A1 rồi SP-MAY-A1' : 'Tìm SP-MAY-A1')).status).toBe('collecting'); expect(state.calls).toHaveLength(0);
});
it('V2 NFC evidence supports NFD Vietnamese and server-computed code-point offsets', async () => {
  state.modelAnswer = by('product.list', 'Điện thoại Mây A1'); expect((await ask('😀 Tìm Điện thoại Mây A1'.normalize('NFD'))).status).toBe('completed');
  expect(state.turns[0].readV2.provenance[0]).toMatchObject({ canonicalStart: 6, canonicalEnd: 23 }); expect(state.calls[0].query.q).toBe('Điện thoại Mây A1');
});
it.each(['write', 'id', 'field', 'offset', 'default', 'array', 'intent', 'json'])('V2 strict model contract rejects %s', async mode => {
  state.modelAnswer = dto => { const result = by('product.list', 'SP-MAY-A1')(dto);
    if (mode === 'write') result.proposal.actionId = 'inventory.product.create'; if (mode === 'id') result.proposal.values.search.raw = ids.P1;
    if (mode === 'field') result.proposal.values.status = 'active'; if (mode === 'offset') result.proposal.values.search.evidence.start = 0;
    if (mode === 'default') result.provenance = { source: 'server_default' }; if (mode === 'array') result.proposal.values = []; if (mode === 'intent') result.intentType = 'unsupported';
    return mode === 'json' ? 'invalid-json' : result; };
  expect((await ask('Tìm SP-MAY-A1')).status).toBe('failed'); expect(state.calls).toHaveLength(0);
});
it('V2 multistep output is rejected as a whole without partial execution', async () => {
  state.modelAnswer = dto => ({ ...by('product.list', 'SP-MAY-A1')(dto), remainingRequests: ['Xem SP-MAY-A1'] });
  expect((await ask('Tìm SP-MAY-A1 rồi xem chi tiết')).status).toBe('collecting'); expect(state.calls).toHaveLength(0);
});
it.each(['unsupported', 'ambiguous', 'general_question', 'cancel'])('V2 %s produces no command and no untrusted model reply', async type => {
  state.modelAnswer = { schemaVersion: 2, intentType: type === 'cancel' ? 'workflow' : type, cancel: type === 'cancel', newRequest: false, clarification: 'Model says this' };
  const reply = await ask('Yêu cầu khác'); expect(reply.status).toBe(type === 'cancel' ? 'cancelled' : type === 'ambiguous' ? 'collecting' : 'unsupported');
  expect(reply.reply).not.toContain('Model says this'); expect(state.calls).toHaveLength(0);
});
it.each(['schema', 'mode', 'action', 'scope', 'file', 'payload', 'context-field', 'duplicate'])('V2 request rejects %s before claim', async mode => {
  const input = envelope({ kind: 'text', text: 'Tìm SP-MAY-A1' });
  if (mode === 'schema') input.schemaVersion = 3; if (mode === 'mode') input.mode = 'qa'; if (mode === 'action') input.actionId = 'product.list'; if (mode === 'scope') input.companyCode = 'FIX-B';
  if (mode === 'file') input.attachment = {}; if (mode === 'payload') input.input.payload = { path_id: ids.P1 };
  if (mode === 'context-field') input.input.screenContext = { ...context(), branchId: 'other' }; if (mode === 'duplicate') input.input.screenContext = context([ids.P1, ids.P1], true);
  await expect(v2(input)).rejects.toThrow('định dạng'); expect(state.calls).toHaveLength(0); expect(state.turns).toHaveLength(0); expect(state.modelInputs).toHaveLength(0);
});
it.each(['production', 'staging', 'unset', 'off', 'gate-off'])('V2 disabled in %s sends no model or API', async mode => {
  if (mode === 'off') vi.stubEnv('ASSISTANT_PRODUCT_READ_V2', 'false'); else if (mode === 'gate-off') vi.stubEnv('ASSISTANT_SAFE_EXECUTION', 'false'); else vi.stubEnv('NODE_ENV', mode === 'unset' ? undefined : mode);
  await expect(ask('Tìm sản phẩm')).rejects.toThrow(); expect(state.turns).toHaveLength(0); expect(state.modelInputs).toHaveLength(0); expect(state.calls).toHaveLength(0);
});
it('V2 completed replay after flag-off ignores DB and context age changes', async () => {
  state.modelAnswer = dto => handle(dto); const input = envelope({ kind: 'text', text: 'Xem cái này', screenContext: context() }); const first = await v2(input); const before = state.calls.length;
  state.products = []; advance(60 * 60_000); vi.stubEnv('ASSISTANT_PRODUCT_READ_V2', 'false');
  expect((await v2(input)).reply).toBe(first.reply); expect(state.calls).toHaveLength(before); expect(state.modelInputs).toHaveLength(1);
});
it('V2 stable input digest tolerates key ordering, but rejects semantic changes', async () => {
  state.modelAnswer = by('product.list', 'SP-MAY-A1'); const input = envelope({ kind: 'text', text: 'Tìm SP-MAY-A1' }); await v2(input); const pin = clone(state.turns[0].readV2);
  await v2({ mode: input.mode, input: { text: input.input.text, kind: 'text' }, requestId: input.requestId, schemaVersion: 2, conversationId: input.conversationId });
  expect(state.turns[0].readV2).toEqual(pin); await expect(v2({ ...input, input: { kind: 'text', text: 'Tìm SP-OP-A1' } })).rejects.toThrow('nội dung khác'); expect(state.calls).toHaveLength(1);
});
it('V2 encrypted collecting replay and conversation restore recover the same public tokens', async () => {
  state.modelAnswer = by('inventory.product.detail', 'Tai nghe Sóng'); const input = envelope({ kind: 'text', text: 'Xem Tai nghe Sóng' }); const first = await v2(input);
  vi.stubEnv('ASSISTANT_PRODUCT_READ_V2', 'false'); expect((await v2(input)).clarification).toEqual(first.clarification);
  const restored = await conversationState(req, input.conversationId); expect(restored.lastReply.clarification).toEqual(first.clarification); expect(JSON.stringify(restored)).not.toMatch(/65aa|tokenHash|recordId|replyTokens/);
  expect((await select(first, 1)).status).toBe('completed'); expect(state.modelInputs).toHaveLength(1); expect(state.calls.at(-1).target).toBe(ids.P3);
});
it('V2 corrupted replay cache fails closed without regenerating a choice', async () => {
  state.modelAnswer = by('inventory.product.detail', 'Tai nghe Sóng'); const input = envelope({ kind: 'text', text: 'Xem Tai nghe Sóng' }); await v2(input); state.turns[0].readV2.replyTokens = 'broken';
  await expect(v2(input)).rejects.toThrow('khôi phục'); expect(state.calls).toHaveLength(1);
});
it.each(['token', 'version', 'pending', 'scope'])('V2 invalid selection %s sends no primary', async mode => {
  state.modelAnswer = by('inventory.product.detail', 'Tai nghe Sóng'); const first = await ask('Xem Tai nghe Sóng');
  const overrides = mode === 'token' ? { optionToken: 'opt_' + 'A'.repeat(43) } : mode === 'version' ? { pendingVersion: 999 } : mode === 'pending' ? { pendingId: randomUUID() } : {};
  if (mode === 'scope') state.session.pending.readV2.owner = 'foreign'; expect((await select(first, 0, overrides)).status).toBe('collecting'); expect(state.calls).toHaveLength(1);
});
it('V2 consumed option with a new request ID cannot send another detail', async () => {
  state.modelAnswer = by('inventory.product.detail', 'Tai nghe Sóng'); const first = await ask('Xem Tai nghe Sóng'); await select(first);
  expect((await select(first)).status).toBe('collecting'); expect(state.calls.filter(row => row.kind === 'detail')).toHaveLength(1);
});
it.each([6, 16])('V2 option TTL is independent of context at %s minutes', async minutes => {
  state.modelAnswer = by('inventory.product.detail', 'Tai nghe Sóng'); const first = await ask('Xem Tai nghe Sóng'); advance(minutes * 60_000);
  expect((await select(first)).status).toBe(minutes === 6 ? 'completed' : 'collecting'); expect(state.modelInputs).toHaveLength(1);
});
it('V2 pending expires without renewal; fresh text prepares a new preview', async () => {
  state.requireConfirmation = true; state.modelAnswer = by('inventory.product.detail', 'SP-MAY-A1'); const first = await ask('Xem SP-MAY-A1'); advance(31 * 60_000);
  expect((await decide(first)).status).toBe('collecting'); const next = await ask('Xem SP-MAY-A1'); expect(next.status).toBe('confirmation'); expect(next.action.id).not.toBe(first.action.id);
});
it('V2 stale or future client context is rejected before provider and reads', async () => {
  const old = context(); advance(6 * 60_000); expect((await ask('Xem cái này', old)).status).toBe('collecting');
  expect((await ask('Xem cái này', { ...context(), capturedAt: new Date(Date.now() + 120_000).toISOString() })).status).toBe('collecting'); expect(state.calls).toHaveLength(0); expect(state.modelInputs).toHaveLength(0);
});
it('V2 regressing page revision is rejected and session handles expire for new interpretation', async () => {
  state.modelAnswer = dto => handle(dto); await ask('Xem cái này', context()); expect((await ask('Xem lại', { ...context(), revision: 0 })).status).toBe('collecting');
  advance(6 * 60_000); expect((await ask('Xem lại cái đó')).status).toBe('collecting'); expect(state.calls).toHaveLength(2);
});
it('V2 long-lived confirmation after ingress off revalidates its target rather than reusing a handle', async () => {
  state.requireConfirmation = true; state.modelAnswer = by('inventory.product.detail', 'SP-MAY-A1'); const first = await ask('Xem SP-MAY-A1'); advance(6 * 60_000); vi.stubEnv('ASSISTANT_PRODUCT_READ_V2', 'false');
  expect((await decide(first)).status).toBe('completed'); expect(state.modelInputs).toHaveLength(1);
});
it.each(['version', 'digest'])('V2 changed workflow %s creates a new preview and rejects the old one', async mode => {
  state.requireConfirmation = true; state.modelAnswer = by('inventory.product.detail', 'SP-MAY-A1'); const first = await ask('Xem SP-MAY-A1');
  if (mode === 'version') state.workflowVersion++; else state.requireConfirmation = false;
  const fresh = await decide(first); expect(fresh.status).toBe('confirmation'); expect(fresh.action.id).not.toBe(first.action.id); expect(state.budgets.at(-1).instance.reads).toBe(0);
  expect((await decide(first)).status).toBe('collecting'); expect((await decide(fresh)).status).toBe('completed');
});
it('V2 deleted selected record never retargets another record with the same name', async () => {
  state.modelAnswer = by('inventory.product.detail', 'Tai nghe Sóng'); const first = await ask('Xem Tai nghe Sóng'); state.products = state.products.filter(row => row._id !== ids.P2);
  expect((await select(first)).status).toBe('failed'); expect(state.calls.at(-1).target).toBe(ids.P2); expect(state.calls.at(-1).status).toBe(404);
});
it('V2 revoked permission blocks confirmation without sending the primary', async () => {
  state.requireConfirmation = true; state.modelAnswer = by('inventory.product.detail', 'SP-MAY-A1'); const first = await ask('Xem SP-MAY-A1'); state.denyOperation = true;
  expect((await decide(first)).status).toBe('failed'); expect(state.calls).toHaveLength(1);
});
it.each(['P5', 'variant', 'parent', 'company', 'variant-owner'])('V2 exact context rejects %s before sending model context', async mode => {
  state.modelAnswer = dto => handle(dto);
  if (mode === 'parent' || mode === 'company') state.detailTamper = mode; if (mode === 'variant-owner') state.detailTamper = 'variant';
  const target = mode === 'P5' ? ids.P5 : mode === 'variant' ? state.products[0].variants[0]._id : ids.P1;
  expect((await ask('Xem cái này', context([target]))).status).toBe('failed'); expect(state.modelInputs).toHaveLength(0);
});
it.each(['code', 'context'])('V2 F101 succeeds via %s without unfiltered list recheck', async mode => {
  seedPage(101); state.modelAnswer = mode === 'code' ? by('inventory.product.detail', 'SP-MAY-A1') : dto => handle(dto);
  expect((await ask(mode === 'code' ? 'Xem SP-MAY-A1' : 'Xem cái này', mode === 'context' ? context() : undefined)).status).toBe('completed');
  expect(state.calls).toHaveLength(2); expect(state.calls.at(-1).target).toBe(ids.P1);
});
it('V2 incomplete result page cannot prove a unique reference', async () => {
  seedPage(101); state.products.forEach((row, index) => { row.name = index ? `Sản phẩm ${index}` : 'Sản phẩm'; });
  state.modelAnswer = by('inventory.product.detail', 'Sản phẩm'); expect((await ask('Xem Sản phẩm')).status).toBe('collecting'); expect(state.calls.map(row => row.kind)).toEqual(['list']);
});
it('V2 empty variants do not erase the parent Product', async () => {
  state.products[0].variants = []; state.modelAnswer = by('inventory.product.detail', 'SP-MAY-A1'); expect((await ask('Xem SP-MAY-A1')).status).toBe('completed'); expect(state.calls.at(-1).target).toBe(ids.P1);
});
it('V2 a single fuzzy/SKU hit still needs explicit parent selection', async () => {
  state.modelAnswer = by('inventory.product.detail', 'SKU-SP-MAY-A1-1'); const first = await ask('Xem SKU-SP-MAY-A1-1');
  expect(first.status).toBe('collecting'); expect(first.clarification.options).toHaveLength(1); expect((await select(first)).status).toBe('completed');
});
it('V2 never silently drops a client screen search filter', async () => {
  state.modelAnswer = by('product.list'); const screen = { version: 2, route: '/kho-san-pham', pageType: 'list', viewInstance: 'view', revision: 1, capturedAt: new Date(Date.now()).toISOString(), filters: { search: 'SP-MAY-A1' } };
  expect((await ask('Tìm trên trang', screen)).status).toBe('collecting'); expect(state.calls).toHaveLength(0);
});
it('V2 cannot be resumed by a legacy decision', async () => {
  state.requireConfirmation = true; state.modelAnswer = by('inventory.product.detail', 'SP-MAY-A1'); const first = await ask('Xem SP-MAY-A1');
  expect((await turn({ decision: { id: first.action.id, confirmed: true } })).status).toBe('collecting'); expect(state.calls).toHaveLength(1); expect(state.session.pending.id).toBe(first.action.id);
});
it('V2 unknown pending version is not downgraded to legacy', async () => {
  state.requireConfirmation = true; state.modelAnswer = by('inventory.product.detail', 'SP-MAY-A1'); const first = await ask('Xem SP-MAY-A1'); state.session.pending.readV2.schemaVersion = 99;
  expect((await decide(first)).status).toBe('collecting'); expect(state.calls).toHaveLength(1);
});
it('V2 cancellation prevents provider/context/reference requests', async () => {
  state.modelAnswer = by('inventory.product.detail', 'SP-MAY-A1'); expect((await ask('Xem SP-MAY-A1', undefined, { cancelled: async () => true })).status).toBe('cancelled'); expect(state.calls).toHaveLength(0);
});
it('V2 journal failure prevents model access to any context handle', async () => {
  state.journalFailure = 'prepared'; state.modelAnswer = dto => handle(dto); expect((await ask('Xem cái này', context())).status).toBe('failed'); expect(state.calls).toHaveLength(0); expect(state.modelInputs).toHaveLength(0);
});
it('V2 retention sweep removes old private pins but preserves completed replay identity and results', async () => {
  state.modelAnswer = by('inventory.product.detail', 'SP-MAY-A1'); const input = envelope({ kind: 'text', text: 'Xem SP-MAY-A1' }); const first = await v2(input);
  advance(READ_V2_TTL.retention + READ_V2_TTL.pending + 1); state.modelAnswer = by('product.list'); await ask('Danh sách sản phẩm'); expect(state.turns[0].readV2).toBeUndefined();
  const before = state.calls.length; expect((await v2(input)).reply).toBe(first.reply); expect(state.calls).toHaveLength(before);
});
it('V2 selected request replay sends no additional detail call', async () => {
  state.modelAnswer = by('inventory.product.detail', 'Tai nghe Sóng'); const first = await ask('Xem Tai nghe Sóng');
  const input = envelope({ kind: 'selection', pendingId: first.clarification.pendingId, pendingVersion: first.clarification.pendingVersion, optionToken: first.clarification.options[0].optionToken });
  const result = await v2(input); const before = state.calls.length; expect((await v2(input)).reply).toBe(result.reply); expect(state.calls).toHaveLength(before);
});
it('V2 recorded model DTOs contain no raw IDs, scopes, option tokens or legacy state', () => {
  for (const row of state.evidence) expect(JSON.stringify(row.modelInputs || [])).not.toMatch(/65aa|65bb|66cc|recordId|tokenHash|Bearer fixture|replyTokens/);
});

it.each([false, true])('V2 server defaults stay internal while explicit equal values remain visible: explicit=%s', async explicit => {
  state.requireConfirmation = true; state.searchDefault = 'SP-MAY-A1'; state.modelAnswer = by('product.list', explicit ? 'SP-MAY-A1' : undefined);
  const preview = await ask(explicit ? 'Tìm SP-MAY-A1' : 'Danh sách sản phẩm'); expect(preview.status).toBe('confirmation');
  expect(JSON.stringify(preview.action.values).includes('SP-MAY-A1')).toBe(explicit);
  expect(state.turns[0].readV2.provenance[0].source).toBe(explicit ? 'utterance' : 'server_default');
  expect((await decide(preview)).status).toBe('completed'); expect(state.calls[0].query.q).toBe('SP-MAY-A1');
});
it('V2 decline still cancels the owned draft after business permission is revoked', async () => {
  state.requireConfirmation = true; state.modelAnswer = by('inventory.product.detail', 'SP-MAY-A1'); const first = await ask('Xem SP-MAY-A1'); state.denyOperation = true;
  expect((await decide(first, false)).status).toBe('cancelled'); expect(state.session.pending).toBeNull(); expect(state.calls).toHaveLength(1);
});
it.each(['turn', 'session'])('V2 failed %s pin persistence blocks primary send', async mode => {
  const { AssistantTurnModel, AssistantSessionModel } = await import('../../models.ts');
  const model = mode === 'turn' ? AssistantTurnModel : AssistantSessionModel, original = model.updateOne;
  const spy = vi.spyOn(model, 'updateOne').mockImplementation(async (...args) => {
    const update = args[1]; if (mode === 'turn' ? update.$set?.readV2 : update.$set?.readV2Context) return { matchedCount: 0 };
    return original(...args);
  });
  try {
    state.modelAnswer = by('product.list', 'SP-MAY-A1'); expect((await ask('Tìm SP-MAY-A1')).status).toBe('failed'); expect(state.calls).toHaveLength(0); expect(state.budgets[0].instance.reads).toBe(0);
  } finally { spy.mockRestore(); }
});
it.each(['legacy-pending', 'legacy-plan'])('V2 preserves %s without migrating or calling the model', async mode => {
  const id = randomUUID(); state.session = { userId: req.user.id, companyCode: req.user.companyCode, branchId: req.user.branchId,
    conversationId: '77777777-7777-4777-8777-777777777777', messages: [], busy: false,
    pending: mode === 'legacy-pending' ? { id, actionId: 'employee.create', workflowVersion: 1, intent: 'Legacy create', provided: { displayName: 'Fixture' }, preview: { id, title: 'Tạo nhân sự', values: [] } } : null,
    remainingRequests: mode === 'legacy-plan' ? ['Legacy remaining request'] : [] };
  const pending = clone(state.session.pending), plan = clone(state.session.remainingRequests);
  expect((await ask('Tìm sản phẩm')).status).toBe(mode === 'legacy-pending' ? 'collecting' : 'failed');
  expect(state.session.pending).toEqual(pending); expect(state.session.remainingRequests).toEqual(plan); expect(state.modelInputs).toHaveLength(0); expect(state.calls).toHaveLength(0);
});
it('V2 normalizes internal ObjectId casing at the server boundary, without exposing it', async () => {
  state.modelAnswer = dto => handle(dto); expect((await ask('Xem cái này', context([ids.P1.toUpperCase()]))).status).toBe('completed');
  expect(state.calls.every(call => call.target === ids.P1)).toBe(true);
});
it('V2 duplicate IDs differing only in hex case are rejected before claim', async () => {
  await expect(ask('Xem cái này', context([ids.P1, ids.P1.toUpperCase()], true))).rejects.toThrow('định dạng'); expect(state.turns).toHaveLength(0);
});
it.each([false, true])('V2 interrupted turn replay stays processing/uncertain without another API: stale=%s', async stale => {
  state.modelAnswer = by('inventory.product.detail', 'SP-MAY-A1'); const input = envelope({ kind: 'text', text: 'Xem SP-MAY-A1' }); await v2(input);
  delete state.turns[0].result; state.turns[0].status = 'executing'; state.turns[0].updatedAt = new Date(Date.now() - (stale ? 9 * 60_000 : 0));
  const before = state.calls.length; expect((await v2(input)).status).toBe(stale ? 'uncertain' : 'processing'); expect(state.calls).toHaveLength(before); expect(state.modelInputs).toHaveLength(1);
});
it('V2 public results and clarification metadata never display internal Product/SKU IDs', () => {
  for (const row of state.evidence) expect(JSON.stringify(row.replies)).not.toMatch(/65aa|65bb|66cc|recordId|tokenHash|replyTokens/);
});
it('V2 configured required search asks a field question and accepts the continuation', async () => {
  state.requireSearch = true; state.modelAnswer = by('product.list'); const first = await ask('Danh sách sản phẩm');
  expect(first.status).toBe('collecting'); expect(first.clarification.fields).toEqual([{ key: 'search', type: 'text', required: true, label: 'Từ khóa' }]); expect(state.calls).toHaveLength(0);
  state.modelAnswer = by('product.list', 'SP-MAY-A1'); expect((await ask('SP-MAY-A1')).status).toBe('completed'); expect(state.calls[0].query.q).toBe('SP-MAY-A1');
});
it.each([`prefix65aa00000000000000000001suffix`, 'Xem 77777777-7777-4777-8777-777777777777', 'Bearer fixture-token-not-a-real-token'])('V2 blocks private identifier/credential text before the model: %s', async text => {
  expect((await ask(text)).status).toBe('collecting'); expect(state.modelInputs).toHaveLength(0); expect(state.calls).toHaveLength(0);
});
it('V2 cache authentication binds tokens to actor/scope/request/digest, not just ciphertext', async () => {
  const { openReadV2Reply } = await import('../../read-v2-cache.ts');
  state.modelAnswer = by('inventory.product.detail', 'Tai nghe Sóng'); await ask('Xem Tai nghe Sóng');
  const record = clone(state.turns[0]); record.requestId = randomUUID();
  expect(() => openReadV2Reply(req, record)).toThrow('khôi phục');
  expect(() => openReadV2Reply({ ...req, user: { ...req.user, branchId: 'other' } }, state.turns[0])).toThrow('khôi phục');
  record.requestId = state.turns[0].requestId; record.readV2.schemaVersion = 99;
  expect(() => openReadV2Reply(req, record)).toThrow('Phiên bản'); expect(state.calls).toHaveLength(1);
});
it('V2 a new explicit target invalidates the old confirmation and preserves required review', async () => {
  state.requireConfirmation = true; state.modelAnswer = by('inventory.product.detail', 'SP-MAY-A1'); const old = await ask('Xem SP-MAY-A1');
  state.modelAnswer = by('inventory.product.detail', 'SP-OP-A1'); const fresh = await ask('Xem SP-OP-A1'); expect(fresh.status).toBe('confirmation');
  const readsBeforeOldDecision = state.calls.length;
  expect((await decide(old)).status).toBe('collecting'); expect(state.calls).toHaveLength(readsBeforeOldDecision); expect(state.budgets.at(-1).instance.reads).toBe(0);
  expect((await decide(fresh)).status).toBe('completed'); expect(state.calls.at(-1).target).toBe(ids.P4);
});
it('V2 corrupt private target cannot fall back to a legacy reference lookup', async () => {
  state.modelAnswer = by('inventory.product.detail', 'Tai nghe Sóng'); const first = await ask('Xem Tai nghe Sóng');
  state.session.pending.readV2.options[0].target.recordId = 'not-an-internal-product-id';
  expect((await select(first)).status).toBe('failed'); expect(state.calls.map(row => row.kind)).toEqual(['list']);
});
it('V2 long history never triggers the legacy background summarizer or sends raw history to a model', async () => {
  state.session = { userId: req.user.id, companyCode: req.user.companyCode, branchId: req.user.branchId, conversationId: '77777777-7777-4777-8777-777777777777',
    messages: Array.from({ length: 10 }, () => ({ role: 'user', content: 'old private record 65aa00000000000000000001' })), messageCount: 10, busy: false, pending: null };
  state.modelAnswer = by('product.list', 'SP-MAY-A1'); expect((await ask('Tìm SP-MAY-A1')).status).toBe('completed');
  expect(state.modelInputs).toHaveLength(1); expect(JSON.stringify(state.modelInputs)).not.toContain('65aa'); expect(state.violations).toEqual([]);
});
it('V2 a pasted bearer option token is neither forwarded to a model nor stored as raw chat history', async () => {
  state.modelAnswer = by('inventory.product.detail', 'Tai nghe Sóng'); const first = await ask('Xem Tai nghe Sóng'); const token = first.clarification.options[0].optionToken;
  expect((await ask(`Tôi chọn ${token}`)).status).toBe('collecting'); expect(state.modelInputs).toHaveLength(1); expect(state.calls).toHaveLength(1);
  expect(JSON.stringify(state.session)).not.toContain(token); expect(JSON.stringify(state.turns)).not.toContain(token);
});
