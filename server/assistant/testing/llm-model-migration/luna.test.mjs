import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ERP_LLM_MODEL, ERP_LLM_FALLBACK_MODEL } from '../../../../shared/llm-model.ts';
import { interpretRequest } from '../../semantic-interpreter.ts';
import { ASSISTANT_OPERATIONS, defaultWorkflow, operationById } from '../../catalog.ts';
import { openrouterChat } from '../../../service/openrouter.service.ts';
import { assistantFunctionKey } from '../../function-context.ts';
import { INTERPRETATION_LIMITS } from '../../interpretation-budget.ts';
let requests;
let response;
beforeEach(() => {
  requests = []; response = { actionId: 'inventory.product.detail', values: { path_id: 'SP-MAY-A1' }, intentType: 'workflow', actionIntent: 'lookup',
    requestCoverage: [{ evidence: 'Xem chi tiết SP-MAY-A1', requirement: 'Chi tiết sản phẩm', mappedTo: ['action','values.path_id'] }] };
  vi.stubEnv('OPENROUTER_API_KEY', 'fixture-not-a-real-key');
  vi.stubEnv('CHATBOT_MODEL', 'google/gemini-2.5-flash');
  vi.stubEnv('OPENROUTER_MODEL', 'google/gemini-2.5-flash');
  vi.stubEnv('OPENROUTER_FALLBACK_MODEL', 'qwen/qwen3.6-flash');
  vi.stubEnv('FREELLM_API_URL', 'https://freellm.invalid/v1');
  vi.stubEnv('FREELLM_API_KEY', 'fixture-free-key');
  vi.stubGlobal('fetch', async (url, init) => {
    expect(String(url)).toBe('https://openrouter.ai/api/v1/chat/completions');
    requests.push(JSON.parse(init.body));
    const body = requests.at(-1);
    const prompt = body.messages[0].content;
    const answer = prompt.includes('BƯỚC 1 — CHỈ xác định phân hệ') ? { modules: ['inventory'] }
      : prompt.includes('BƯỚC 2 — CHỈ xác định nhóm') ? { featureKeys: [assistantFunctionKey(defaultWorkflow(operationById('inventory.product.detail')))], ambiguous:false, clarification:'' }
      : prompt.includes('Thu hẹp công cụ trong nhóm chức năng') ? { actionIds: ['inventory.product.detail'] } : response;
    return Response.json({ choices: [{ message: { content: JSON.stringify(answer) } }] });
  });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it('routes interpretation to Luna despite old environment models, preserving the target and schema', async () => {
  const workflows = ['product.list', 'inventory.product.detail'].map(id => defaultWorkflow(operationById(id)));
  const result = await interpretRequest('Xem chi tiết SP-MAY-A1', workflows, null, []);
  expect(result.actionId).toBe('inventory.product.detail');
  expect(result.values.path_id).toBe('SP-MAY-A1');
  expect(requests).toHaveLength(1);
  expect(requests[0].model).toBe(ERP_LLM_MODEL);
  expect(requests[0]).not.toHaveProperty('temperature');
  expect(requests[0].response_format).toEqual({ type: 'json_object' });
});
it('routes discovery and narrowed interpretation to Luna without unsupported sampling parameters', async () => {
  const workflows = ASSISTANT_OPERATIONS.map(defaultWorkflow).filter(workflow => workflow.enabled);
  expect(workflows.length).toBeGreaterThan(120);
  const result = await interpretRequest('Xem chi tiết SP-MAY-A1', workflows, null, []);
  expect(result.actionId).toBe('inventory.product.detail');
  expect(requests.length).toBeGreaterThanOrEqual(3);
  expect(requests.length).toBeLessThanOrEqual(INTERPRETATION_LIMITS.calls);
  for (const body of requests) {
    expect(body.model).toBe(ERP_LLM_MODEL);
    expect(body).not.toHaveProperty('temperature');
    expect(body.response_format).toEqual({ type: 'json_object' });
  }
});
it('uses only the approved Luna and Haiku chain, never FreeLLM', async () => {
  const fetchMock = vi.fn(async () => new Response('not available', { status: 503 }));
  vi.stubGlobal('fetch', fetchMock);
  await expect(openrouterChat({ model: 'google/gemini-2.5-flash', maxRetries: 1, messages: [{ role: 'user', content: 'test' }] })).rejects.toThrow();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe(ERP_LLM_MODEL);
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).model).toBe(ERP_LLM_FALLBACK_MODEL);
});
