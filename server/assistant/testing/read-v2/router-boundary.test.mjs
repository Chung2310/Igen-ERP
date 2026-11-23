import { EventEmitter } from 'node:events';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ legacy: vi.fn(), direct: vi.fn(), submit: vi.fn(), active: vi.fn() }));
vi.mock('../../service.ts', () => ({
  processTurn: state.legacy, clearConversationMemory: vi.fn(), conversationMemory: vi.fn(), conversationState: vi.fn(), deleteConversation: vi.fn(), listConversations: vi.fn(), saveConversationMemory: vi.fn(),
}));
vi.mock('../../read-v2-service.ts', () => ({ processProductReadV2Turn: state.direct }));
vi.mock('../../jobs.ts', () => ({ submitAssistantJob: state.submit, assertNoActiveAssistantJob: state.active, assistantJobStatus: vi.fn(), cancelAssistantJob: vi.fn(), cancelConversationAssistantJob: vi.fn() }));
vi.mock('../../../middleware/auth.ts', () => ({ requireAuth: (_req, _res, next) => next(), requirePermission: () => (_req, _res, next) => next(), getEffectivePermissions: vi.fn() }));
import { assistantRouter } from '../../router.ts';
const input = () => ({ schemaVersion: 2, conversationId: '77777777-7777-4777-8777-777777777777', requestId: '88888888-8888-4888-8888-888888888888', mode: 'work', input: { kind: 'text', text: 'Tìm sản phẩm' } });
beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'test'); vi.stubEnv('ASSISTANT_SAFE_EXECUTION', 'true'); vi.stubEnv('ASSISTANT_BACKGROUND_ENABLED', 'true');
  state.legacy.mockReset().mockResolvedValue({ status: 'completed', reply: 'Legacy' }); state.direct.mockReset().mockResolvedValue({ schemaVersion: 2, status: 'completed', reply: 'V2' });
  state.submit.mockReset().mockResolvedValue({ status: 'processing', reply: 'Queued' }); state.active.mockReset().mockResolvedValue(undefined);
  globalThis.__layerBProductSafety.violations.length = 0;
});
afterEach(() => { expect(globalThis.__layerBProductSafety.violations).toEqual([]); vi.unstubAllEnvs(); });
const route = (url, body) => new Promise((resolve, reject) => {
  const req = { method: 'POST', url, originalUrl: url, body, headers: { 'content-type': 'application/json' }, is: () => false, user: { id: 'fixture', companyCode: 'FIX-A' } };
  const res = Object.assign(new EventEmitter(), { statusCode: 200, writableEnded: false, destroyed: false,
    status(code) { this.statusCode = code; return this; }, json(value) { this.writableEnded = true; resolve({ status: this.statusCode, body: value }); return this; } });
  assistantRouter.handle(req, res, error => reject(error || new Error('Unexpected next/router exit')));
});
it('V2 /turns goes direct before legacy background auto-queue and checks active jobs', async () => {
  const value = input(); expect((await route('/turns', value)).status).toBe(200);
  expect(state.direct).toHaveBeenCalledTimes(1); expect(state.active).toHaveBeenCalledWith(expect.anything(), value.conversationId);
  expect(state.submit).not.toHaveBeenCalled(); expect(state.legacy).not.toHaveBeenCalled();
});
it('legacy /turns still queues when background is enabled', async () => {
  const { schemaVersion, input: _input, ...value } = input(); expect((await route('/turns', { ...value, text: 'Tìm sản phẩm' })).status).toBe(200);
  expect(state.submit).toHaveBeenCalledTimes(1); expect(state.direct).not.toHaveBeenCalled();
});
it('legacy /turns remains direct with background disabled', async () => {
  vi.stubEnv('ASSISTANT_BACKGROUND_ENABLED', 'false'); const { schemaVersion, input: _input, ...value } = input(); await route('/turns', { ...value, text: 'Tìm sản phẩm' });
  expect(state.legacy).toHaveBeenCalledTimes(1); expect(state.direct).not.toHaveBeenCalled(); expect(state.submit).not.toHaveBeenCalled();
});
it.each(['version', 'extra', 'mixed'])('V2 /turns rejects %s before processing', async mode => {
  const value = input(); if (mode === 'version') value.schemaVersion = 99; if (mode === 'extra') value.input.payload = {}; if (mode === 'mixed') value.text = 'Legacy text';
  expect((await route('/turns', value)).status).toBe(400); expect(state.direct).not.toHaveBeenCalled(); expect(state.submit).not.toHaveBeenCalled(); expect(state.legacy).not.toHaveBeenCalled();
});
it('V2 /jobs is rejected before submission, claim or execution', async () => {
  expect((await route('/jobs', input())).status).toBe(400); expect(state.submit).not.toHaveBeenCalled(); expect(state.direct).not.toHaveBeenCalled();
});
it('legacy /jobs keeps its existing submission path', async () => {
  const { schemaVersion, input: _input, ...value } = input(); expect((await route('/jobs', { ...value, text: 'Tìm sản phẩm' })).status).toBe(200); expect(state.submit).toHaveBeenCalledTimes(1);
});
