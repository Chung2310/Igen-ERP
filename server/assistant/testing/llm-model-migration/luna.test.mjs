import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ERP_LLM_MODEL } from '../../../../shared/llm-model.ts';
import { interpretRequest } from '../../semantic-interpreter.ts';
import { ASSISTANT_OPERATIONS, defaultWorkflow, operationById } from '../../catalog.ts';
import { openrouterChat } from '../../../service/openrouter.service.ts';
let requests;
let response;
beforeEach(() => {
  requests = []; response = { actionId: 'inventory.product.detail', values: { path_id: 'SP-MAY-A1' }, intentType: 'workflow' };
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
    const answer = body.messages[0].content.startsWith('Khám phá công cụ ERP') ? { modules: ['inventory'] } : response;
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
it('routes both discovery and its narrowed interpretation to Luna without unsupported sampling parameters', async () => {
  const workflows = ASSISTANT_OPERATIONS.map(defaultWorkflow).filter(workflow => workflow.enabled);
  expect(workflows.length).toBeGreaterThan(120);
  const result = await interpretRequest('Xem chi tiết SP-MAY-A1', workflows, null, []);
  expect(result.actionId).toBe('inventory.product.detail');
  expect(requests).toHaveLength(2);
  for (const body of requests) {
    expect(body.model).toBe(ERP_LLM_MODEL);
    expect(body).not.toHaveProperty('temperature');
    expect(body.response_format).toEqual({ type: 'json_object' });
  }
});
it('does not switch model or call FreeLLM after a failed Luna request', async () => {
  const fetchMock = vi.fn(async () => new Response('not available', { status: 503 }));
  vi.stubGlobal('fetch', fetchMock);
  await expect(openrouterChat({ model: 'google/gemini-2.5-flash', maxRetries: 1, messages: [{ role: 'user', content: 'test' }] })).rejects.toThrow();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe(ERP_LLM_MODEL);
});
