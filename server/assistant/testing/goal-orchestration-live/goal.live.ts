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


import dotenv from 'dotenv';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { processTurn } from '../../service';
import { semanticProviderFixture } from '../semantic-provider-fixture';
const mode = process.env.ERP_GOAL_LIVE_MODE;
if (!['dry', 'live'].includes(mode || '')) throw Error('Choose explicit evaluation mode');
if (mode === 'live') { dotenv.config({ quiet: true }); dotenv.config({ path: '.env.local', quiet: true }); }
if (mode === 'dry') process.env.OPENROUTER_API_KEY = 'fixture-only';
const safety = (globalThis as any).__workerPreviewSafety;
mkdirSync('tmp/goal-orchestration-live', { recursive: true });
const parentPath = 'tmp/goal-orchestration-live/ledger.json';
if (!existsSync(parentPath)) writeFileSync(parentPath, JSON.stringify({ capUSD: .25, spentUSD: 0, reservedUSD: 0, calls: [],
  authorization: 'User approved a separate USD 0.25 budget on 25/11/2026 for this goal-orchestration evaluation.' }, null, 2));
const initial = JSON.parse(readFileSync(parentPath, 'utf8'));
const report: any = { mode, source: 'production processTurn + semantic interpreter; full authorized catalog; mocked DB/business HTTP',
  capUSD: .25, initialSpentUSD: initial.spentUSD, initialReservedUSD: initial.reservedUSD,
  calls: [], businessCalls: [], turns: [], violations: safety.violations };
report.sourceHashes = Object.fromEntries(['service.ts', 'semantic-interpreter.ts', 'goal-context.ts', 'goal-plan.ts'].map(name => [name, createHash('sha256').update(readFileSync(`server/assistant/${name}`)).digest('hex')]));
const save = () => writeFileSync(`tmp/goal-orchestration-live/${mode}-results.json`, JSON.stringify(report, null, 2));
let inferenceInFlight = false;
let currentCase = 'G01';
const request = 'Trong Nhân sự, đếm nhân viên rồi sửa số điện thoại của QA An thành 0900090011';
const queued = 'sửa số điện thoại của QA An thành 0900090011';
const fixtureId = '507f1f77bcf86cd799439022';
const actor: any = { user: { id: 'fixture-actor', uid: 'fixture-actor', companyCode: 'QA', branchId: '507f1f77bcf86cd799439012', role: 'admin' },
  headers: { authorization: 'Bearer fixture-only' }, socket: { localPort: 4050, localAddress: '127.0.0.1' } };
beforeEach(() => { state.session = null; state.turns = []; state.documents = []; });
const caseTurn = async (caseId: string, input: any) => {
  currentCase = caseId;
  const reply = await processTurn(actor, { conversationId: `goal-${caseId}`, requestId: randomUUID(), ...input });
  report.turns.push({ caseId, input, reply }); save(); return reply;
};

beforeAll(() => {
  vi.stubEnv('ASSISTANT_GOAL_ORCHESTRATION', 'true');
  vi.stubEnv('ASSISTANT_SAFE_EXECUTION', 'false');
  vi.stubEnv('ASSISTANT_PRODUCT_READ_V2', 'false');
  vi.stubGlobal('fetch', async (input: any, init: any = {}) => {
    const url = new URL(String(input));
    if (url.href === 'https://openrouter.ai/api/v1/chat/completions' && init.method === 'POST') {
      const body = JSON.parse(String(init.body));
      if (body.model !== 'openai/gpt-6-luna' || body.tools) throw Error('Evaluation permits the approved primary model only');
      if (inferenceInFlight) { report.stop = 'PREVIOUS_INFERENCE_STILL_IN_FLIGHT'; save(); throw Error(report.stop); }
      if (report.stop || report.calls.length >= 40) throw Error('Evaluation request count limit or billing stop');
      body.max_tokens = Math.min(body.max_tokens || 1536, 1536);
      body.provider = { max_price: { prompt: .2, completion: .75 } };
      if (JSON.stringify(body.messages).includes('cache_control')) throw Error('Unexpected cache-write marker');
      const wire = JSON.stringify(body);
      const reserve = (Buffer.byteLength(wire) + 16384) * .2 / 1e6 + body.max_tokens * .75 / 1e6;
      const parent = JSON.parse(readFileSync(parentPath, 'utf8'));
      if (parent.capUSD !== .25 || parent.stopReason && parent.stopReason !== 'COST_RESERVE_LIMIT') throw Error('Parent budget state is not resumable');
      if (parent.spentUSD + parent.reservedUSD + reserve > .25) {
        report.overBudgetReservations ||= [];
        report.overBudgetReservations.push({ bytes: Buffer.byteLength(wire), reserveUSD: reserve, availableUSD: .25 - parent.spentUSD - parent.reservedUSD });
        if (mode === 'live') { report.stop = 'COST_RESERVE_LIMIT'; save(); throw Error('Evaluation reserve exceeds remaining parent budget'); }
      }
      const trace: any = { caseId: currentCase, bytes: Buffer.byteLength(wire), reservedUSD: reserve,
        sha256: createHash('sha256').update(wire).digest('hex'), at: new Date().toISOString() };
      report.calls.push(trace); save();
      if (mode === 'dry') {
        let schema = body.response_format?.json_schema?.schema;
        const marker = 'Respond ONLY with a valid JSON object matching this schema (no markdown, no explanation):\n';
        const prompt = body.messages[0].content;
        if (!schema && prompt.includes(marker)) schema = JSON.parse(prompt.slice(prompt.lastIndexOf(marker) + marker.length));
        let text = body.messages.at(-1).content;
        try { text = JSON.parse(text).text || text; } catch { /* final user text */ }
        let scripted: any = text === request ? { intentType: 'workflow', actionId: 'employee.count', actionIntent: 'report', values: {}, remainingRequests: [queued], requestCoverage: [
          { evidence: 'Trong Nhân sự', requirement: 'Phân hệ', mappedTo: ['context.module'] },
          { evidence: 'đếm nhân viên', requirement: 'Đếm', mappedTo: ['action'] },
          { evidence: queued, requirement: 'Bước sửa sau', mappedTo: ['remainingRequests.0'] },
        ] } : { intentType: 'workflow', actionId: 'employee.update', actionIntent: 'update', values: { id: 'QA An', phone: '0900090011' }, remainingRequests: [],
          requestCoverage: [{ evidence: queued, requirement: 'Sửa điện thoại hồ sơ QA', mappedTo: ['action', 'values.id', 'values.phone'] }] };
        if (currentCase === 'G02') scripted = { intentType: 'workflow', actionId: 'student.create', values: { fullName: 'QA Bảo Mẫu', phone: '0900090022' } };
        if (currentCase === 'G03') scripted = { intentType: 'workflow', actionId: 'student.batch.learner.add', values: { path_id: 'Giao tiếp QA', studentId: 'QA Học Mẫu' } };
        if (currentCase === 'G04') scripted = text.includes('người vừa xem')
          ? { intentType: 'workflow', actionId: 'employee.update', values: { id: 'QA An', phone: '0900090012' } }
          : { intentType: 'workflow', actionId: 'employee.list', values: { search: 'QA An' } };
        const result = await semanticProviderFixture(scripted)({ model: body.model, responseSchema: schema, messages: body.messages });
        const output = JSON.parse(result.text);
        trace.output = output; trace.costUSD = 0; save();
        return Response.json({ choices: [{ message: { content: JSON.stringify(output) }, finish_reason: 'stop' }], usage: { cost: 0 } });
      }
      if (!process.env.OPENROUTER_API_KEY) throw Error('No backend provider key loaded');
      parent.reservedUSD += reserve; parent.calls.push(trace);
      writeFileSync(parentPath, JSON.stringify(parent, null, 2));
      const started = Date.now();
      inferenceInFlight = true;
      try {
        const response = await safety.nativeFetch(input, { ...init, body: wire, signal: AbortSignal.timeout(60000) });
        const result = await response.clone().json();
        trace.status = response.status; trace.elapsedMs = Date.now() - started;
        trace.usage = result.usage; trace.output = result.choices?.[0]?.message?.content;
        if (typeof result.usage?.cost === 'number' && Number.isFinite(result.usage.cost) && result.usage.cost >= 0) {
          trace.costUSD = result.usage.cost; parent.spentUSD += result.usage.cost; parent.reservedUSD -= reserve;
        } else { report.stop = 'UNKNOWN_BILLING'; parent.stopReason = 'UNKNOWN_BILLING'; }
        report.finalSpentUSD = parent.spentUSD; report.finalReservedUSD = parent.reservedUSD;
        writeFileSync(parentPath, JSON.stringify(parent, null, 2)); save(); return response;
      } catch (error) {
        report.stop = 'UNKNOWN_PROVIDER_OUTCOME'; parent.stopReason = report.stop;
        trace.error = String(error).split(process.env.OPENROUTER_API_KEY || '[none]').join('[redacted]');
        writeFileSync(parentPath, JSON.stringify(parent, null, 2)); save(); throw error;
      } finally { inferenceInFlight = false; }
    }
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) { safety.violations.push('external endpoint'); throw Error('External endpoint blocked'); }
    if ((init.method || 'GET') !== 'GET') { safety.violations.push('business mutation'); throw Error('Business mutation forbidden'); }
    report.businessCalls.push({ path: url.pathname, query: Object.fromEntries(url.searchParams), method: 'GET' }); save();
    if (url.pathname === '/api/v1/auth/users/count') return Response.json({ status: 'success', data: { count: 2, scope: 'company' } });
    if (url.pathname === '/api/v1/auth/branches') return Response.json({ branches: [{ _id: actor.user.branchId, name: 'Chi nhánh QA', companyCode: 'QA' }] });
    const record = { _id: fixtureId, id: fixtureId, __v: 0, companyCode: 'QA', branchId: actor.user.branchId, displayName: 'QA An', email: 'qa-an@example.test', phone: '0900090000' };
    if (url.pathname === '/api/v1/auth/users') return Response.json([record]);
    if (url.pathname === `/api/v1/auth/users/${fixtureId}`) return Response.json({ status: 'success', data: record });
    const students = [0, 1].map(index => ({ _id: `507f1f77bcf86cd79943903${index}`, fullName: 'QA Học Mẫu', phone: `090009002${index}`, branchId: actor.user.branchId, __v: 0 }));
    const batches = [0, 1].map(index => ({ _id: `507f1f77bcf86cd79943904${index}`, name: 'Giao tiếp QA', code: `QA-A${index + 1}`, courseTitle: 'Khóa Tiếng Anh QA', status: 'Đang học', __v: 0 }));
    if (url.pathname === '/api/v1/students') return Response.json({ success: true, students, total: students.length, page: 1, totalPages: 1 });
    if (url.pathname === '/api/v1/batches') return Response.json({ success: true, batches, total: batches.length, page: 1, totalPages: 1 });
    if (url.pathname === '/api/v1/courses') return Response.json({ success: true, courses: [], total: 0, page: 1, totalPages: 1 });
    if (batches.some(batch => url.pathname === `/api/v1/batches/${batch._id}`)) return Response.json({ success: true, batch: batches.find(batch => url.pathname.endsWith(batch._id)) });
    if (students.some(student => url.pathname === `/api/v1/students/${student._id}`)) return Response.json({ success: true, student: students.find(student => url.pathname.endsWith(student._id)) });
    safety.violations.push(`unmocked ${url.pathname}`); throw Error('Unexpected business endpoint');
  });
});
afterAll(() => { save(); expect(safety.violations).toEqual([]); });
it('real goal: count first, retain the deferred request, resolve the synthetic person and stop before update confirmation', async () => {
  const input = { conversationId: 'goal-natural-synthetic', requestId: randomUUID(), text: request };
  const reply = await processTurn(actor, input);
  report.turns.push({ input: { text: request }, reply });
  report.pending = { actionId: state.session?.pending?.actionId, goalConfirmation: state.session?.pending?.goalConfirmation };
  report.goal = state.session?.goalContext;
  save();
  expect(reply.status, reply.reply).toBe('confirmation');
  expect(state.session.pending.actionId).toBe('employee.update');
  expect(state.session.pending.resolved.phone).toBe('0900090011');
  expect(state.session.goalContext.observations[0].actionId).toBe('employee.count');
  expect(report.businessCalls.some((call: any) => call.path === '/api/v1/auth/users/count')).toBe(true);
  expect(report.businessCalls.every((call: any) => call.method === 'GET')).toBe(true);
  expect(JSON.stringify(reply)).not.toContain(fixtureId);
});
it('natural intake asks for missing fields in a form and keeps the same draft until confirmation', async () => {
  const collecting = await caseTurn('G02', { text: 'Thêm hồ sơ học viên QA Bảo Mẫu giúp mình, số liên hệ 0900090022.' });
  expect(collecting.status, collecting.reply).toBe('collecting');
  expect(state.session.pending.actionId).toBe('student.create');
  expect(collecting.inputForm?.fields.map(field => field.key)).toEqual(expect.arrayContaining(['email', 'registrationDate']));
  const preview = await caseTurn('G02', { formValues: { id: collecting.inputForm!.id, values: { email: 'qa-bao@example.test', registrationDate: '25/11/2026' } } });
  expect(preview.status, preview.reply).toBe('confirmation');
  expect(state.session.pending.resolved.fullName).toBe('QA Bảo Mẫu');
});
it('ambiguous enrollment offers options for duplicate synthetic names then stops at confirmation', async () => {
  const collecting = await caseTurn('G03', { text: 'Cho học viên QA Học Mẫu vào lớp Giao tiếp QA giúp mình nhé.' });
  expect(collecting.status, collecting.reply).toBe('collecting');
  expect(state.session.pending.actionId).toBe('student.batch.learner.add');
  expect(collecting.referenceSelections?.length).toBeGreaterThanOrEqual(1);
  const chosen = Object.fromEntries(collecting.referenceSelections!.map(group => [group.key, [group.options[0].value]]));
  const preview = await caseTurn('G03', { referenceSelections: chosen });
  expect(preview.status, preview.reply).toBe('confirmation');
});
it('contextual correction understands the person just viewed from public observations', async () => {
  const listed = await caseTurn('G04', { text: 'Tìm hồ sơ QA An trong Nhân sự giúp mình.' });
  expect(listed.status, listed.reply).toBe('completed');
  expect(state.session.goalContext.observations[0].facts.length).toBeGreaterThan(0);
  const preview = await caseTurn('G04', { text: 'Đổi số liên lạc của người vừa xem thành 0900090012 nhé.' });
  expect(preview.status, preview.reply).toBe('confirmation');
  expect(state.session.pending.actionId).toBe('employee.update');
  expect(state.session.pending.resolved.id).toBe(fixtureId);
  expect(state.session.pending.resolved.phone).toBe('0900090012');
});
